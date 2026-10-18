import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { mailerConfigured, sendEnquiryEmails } from './email.js';
import { turnstileConfigured, verifyTurnstile } from './turnstile.js';

try {
  const envText = readFileSync(resolve('.env'), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
} catch { /* .env is optional when variables are configured in the environment. */ }

const port = Number(process.env.PORT || 8787);
const siteUrl = (process.env.SITE_URL || `http://localhost:${port}`).replace(/\/+$/, '');
const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
const secret = process.env.ADMIN_PASSWORD;
if (!secret || secret.length < 12) {
  console.error('Set ADMIN_PASSWORD to a value of at least 12 characters in .env before starting the server.');
  process.exit(1);
}

const dbPath = resolve(process.env.DB_PATH || 'data/geneworldbio.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);

const uploadsDir = resolve(process.env.UPLOADS_DIR || 'data/uploads');
mkdirSync(uploadsDir, { recursive: true });
const maxUploadBytes = 5 * 1024 * 1024;
const uploadTypes = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS content (
    id TEXT PRIMARY KEY,
    collection TEXT NOT NULL,
    title TEXT NOT NULL,
    slug TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS content_collection ON content(collection, created_at);
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    username TEXT,
    action TEXT NOT NULL,
    collection TEXT,
    record_id TEXT,
    ip TEXT,
    user_agent TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS audit_logs_created ON audit_logs(created_at);
  CREATE INDEX IF NOT EXISTS audit_logs_user ON audit_logs(user_id);
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    role TEXT NOT NULL,
    expires INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS sessions_expires ON sessions(expires);
`);

const collections = new Set(['pages', 'services', 'faqs', 'claims', 'inquiries', 'team']);
const requestCounts = new Map();
const inquiryCounts = new Map();
const safeJson = (value) => JSON.stringify(value);

const privacyNoticeVersion = process.env.PRIVACY_NOTICE_VERSION || 'v1.0';
const enquiryReference = () => `GWB-${randomBytes(3).toString('hex').toUpperCase()}`;
const enquiryRateLimit = Math.max(1, Number(process.env.ENQUIRY_RATE_LIMIT || 5) || 5);
const adminLoginRateLimit = Math.max(1, Number(process.env.ADMIN_LOGIN_RATE_LIMIT || 8) || 8);

if (!mailerConfigured()) console.warn('Enquiry email notifications are disabled. Set RESEND_API_KEY or SMTP_HOST (plus ENQUIRY_NOTIFY_TO) to enable them.');
if (!turnstileConfigured()) console.warn('Turnstile bot protection is disabled for the contact form. Set VITE_TURNSTILE_SITE_KEY (client) and TURNSTILE_SECRET_KEY (server) to enable it.');

const heroSlides = [
  {
    eyebrow: 'Diagnostics, connected with care',
    heading: 'A clearer path to better',
    highlight: 'health.',
    text: 'We bring healthcare teams, diagnostic pathways and people closer together — with thoughtful support at every step.',
    note: 'Designed around trusted partnerships and more connected access.',
    primary: { label: 'Partner with us', href: '/healthcare-providers' },
    secondary: { label: 'Explore our services', href: '/services' },
  },
  {
    eyebrow: 'For healthcare teams',
    heading: 'Good partnerships make better',
    highlight: 'pathways.',
    text: 'Referral planning, specimen logistics and a responsive point of contact shaped around your operational needs.',
    note: 'Institution-led, quality-controlled and easy to work with.',
    primary: { label: 'Start a conversation', href: '/healthcare-providers' },
    secondary: { label: 'View services', href: '/services' },
  },
  {
    eyebrow: 'For patients & carers',
    heading: 'Know what to expect, feel',
    highlight: 'supported.',
    text: 'Practical guidance that makes diagnostic pathways easier to understand, with a clear route for your questions.',
    note: 'Clear information at every step of your journey.',
    primary: { label: 'Find patient support', href: '/patients' },
    secondary: { label: 'Contact us', href: '/contact' },
  },
];

const serviceCatalog = [
  { slug: 'genomics-molecular-biology', title: 'Genomics & Molecular Biology', description: 'DNA and RNA sequencing, whole-genome and targeted sequencing, genotyping, molecular epidemiology, pathogen genomics and antimicrobial-resistance surveillance.', audience: 'Providers, researchers and institutions', preparation: 'Confirm the sample type, sequencing scope and any data or consent requirements before collection.' },
  { slug: 'molecular-diagnostics', title: 'Molecular Diagnostics', description: 'PCR and qPCR testing, infectious-disease and genetic testing, antimicrobial-resistance detection, plus molecular screening and laboratory diagnostics.', audience: 'Providers and patients', preparation: 'Follow the referring clinician’s or provider’s instructions on sample type and timing.' },
  { slug: 'bioinformatics-data-science', title: 'Bioinformatics & Data Science', description: 'Genomic data analysis, next-generation sequencing analysis, bioinformatics pipelines, AI and machine learning, genomic databases, visualisation and health-data analytics.', audience: 'Researchers and institutions', preparation: 'Share the data format, analysis goals and any governance or privacy requirements.' },
  { slug: 'research-contract-research', title: 'Research & Contract Research', description: 'Contract research, study design, laboratory investigations, biomarker discovery, clinical and translational research, and research consultancy.', audience: 'Researchers, institutions and industry', preparation: 'Outline the study aims, scope and timelines so we can agree a research plan.' },
  { slug: 'laboratory-reagents-consumables', title: 'Laboratory Reagents & Consumables', description: 'Importation, distribution and supply of molecular biology reagents, extraction kits, PCR reagents, sequencing consumables, plastics and laboratory supplies.', audience: 'Laboratories and institutions', preparation: 'List the reagents, kits and consumables you need, with quantities and delivery details.' },
  { slug: 'laboratory-equipment-technology', title: 'Laboratory Equipment & Technology', description: 'Supply, installation, maintenance and servicing of molecular biology, genomics and diagnostic equipment.', audience: 'Laboratories and institutions', preparation: 'Share the equipment, site requirements and any installation or servicing needs.' },
  { slug: 'research-training-capacity-building', title: 'Research Training & Capacity Building', description: 'Workshops, professional training and laboratory-skills development across genomics, bioinformatics, molecular diagnostics and research commercialisation.', audience: 'Researchers, laboratories and institutions', preparation: 'Tell us the skills, audience size and preferred format or location.' },
  { slug: 'clinical-translational-research', title: 'Clinical & Translational Research', description: 'Clinical research support, biobanking, biomarker studies, clinical laboratory support and translational research infrastructure.', audience: 'Clinicians, researchers and institutions', preparation: 'Confirm the protocol, sample or biobanking needs and any approvals already in place.' },
  { slug: 'biotechnology-innovation-commercialisation', title: 'Biotechnology Innovation & Commercialisation', description: 'Development of diagnostic products and research tools, intellectual property, technology licensing, patents and commercialisation support.', audience: 'Innovators, institutions and industry', preparation: 'Describe the technology, its stage of development and the support you are seeking.' },
  { slug: 'environmental-public-health-genomics', title: 'Environmental & Public Health Genomics', description: 'Disease surveillance, wastewater and environmental surveillance, outbreak investigation, antimicrobial-resistance surveillance and environmental-health studies.', audience: 'Public-health bodies and institutions', preparation: 'Outline the surveillance or study objectives, sites and sampling approach.' },
];

const serviceAccess = 'Availability and access are confirmed through a direct enquiry.';

const teamCatalog = [
  {
    slug: 'adaeze-okafor',
    title: 'Dr. Adaeze Okafor',
    role: 'Founder & Chief Executive Officer',
    credentials: 'MBBS, MSc Public Health',
    location: 'Yenagoa, Bayelsa State',
    education: 'MBBS, University of Port Harcourt; MSc Public Health, London School of Hygiene & Tropical Medicine',
    focus: ['Diagnostic access strategy', 'Institutional partnerships', 'Public-health genomics'],
    bio: 'Adaeze founded GeneWorldBio to close the gap between world-class diagnostics and the communities that need them most. She has spent more than fifteen years building clinical and public-health programmes across Nigeria, with a focus on making complex testing understandable and reachable. She leads the company’s vision, partnerships and long-term service strategy.',
    linkedin: 'https://www.linkedin.com/company/geneworldbio',
    order: 1,
  },
  {
    slug: 'ibrahim-yusuf',
    title: 'Dr. Ibrahim Yusuf',
    role: 'Director, Laboratory Science & Quality',
    credentials: 'PhD, Clinical Microbiology',
    location: 'Abuja, FCT',
    education: 'PhD Clinical Microbiology, Ahmadu Bello University; Postdoctoral fellowship in molecular diagnostics',
    focus: ['Laboratory quality systems', 'Molecular diagnostics', 'Antimicrobial-resistance surveillance'],
    bio: 'Ibrahim oversees GeneWorldBio’s scientific standards, test validation and laboratory quality systems. He has established and audited molecular laboratories across West Africa and is responsible for ensuring that every result we support is accurate, traceable and clinically meaningful.',
    linkedin: 'https://www.linkedin.com/company/geneworldbio',
    order: 2,
  },
  {
    slug: 'ngozi-eze',
    title: 'Ngozi Eze',
    role: 'Head of Partnerships & Operations',
    credentials: 'MBA, BSc Biomedical Science',
    location: 'Lagos, Nigeria',
    education: 'MBA, Lagos Business School; BSc Biomedical Science, University of Lagos',
    focus: ['Referral pathways', 'Specimen logistics', 'Account management'],
    bio: 'Ngozi designs the operational backbone that keeps referrals, specimen logistics and provider relationships running smoothly. She works closely with hospitals, clinics and laboratories to build dependable pathways and to make sure every partner has a clear point of contact.',
    linkedin: 'https://www.linkedin.com/company/geneworldbio',
    order: 3,
  },
];

const teamSeeds = teamCatalog.map((member, index) => ({
  id: `team-${member.slug}`,
  collection: 'team',
  title: member.title,
  slug: member.slug,
  status: 'published',
  data: {
    title: member.title,
    role: member.role,
    credentials: member.credentials,
    bio: member.bio,
    location: member.location,
    education: member.education,
    focus: member.focus,
    linkedin: member.linkedin,
    order: member.order ?? index + 1,
  },
}));

const seeds = [
  ...[
    ['home', 'Diagnostics, connected with care', 'A dependable partner for healthcare teams and a clearer path to diagnostic support for patients.', 'Home'],
    ['services', 'Diagnostics and specimen support', 'Explore service pathways and talk with our team about access, referrals and logistics.', 'Services'],
    ['healthcare-providers', 'A diagnostics partner for your team', 'Build a dependable referral pathway with clear communication, logistics planning and account support.', 'Healthcare Providers'],
    ['patients', 'Clear guidance at every step', 'Understand what to expect, how to prepare and where to find support for your testing pathway.', 'Patients'],
    ['quality-compliance', 'Quality begins with clear standards', 'Our approach puts accountability, careful handling, privacy and transparent communication at the centre.', 'Quality & Compliance'],
    ['about', 'Built around better access', 'GeneWorldBio is developing a Nigeria-first diagnostics and laboratory-solutions model grounded in practical partnerships.', 'About'],
    ['contact', 'Let’s find the right route', 'Tell us what you need and we will direct your message to the appropriate team.', 'Contact'],
    ['faqs', 'Frequently Asked Questions', 'Answers to common questions about our services, access and how to get in touch.', 'GeneWorldBio'],
  ].map(([slug, title, summary, eyebrow]) => ({ id: `page-${slug}`, collection: 'pages', title, slug, status: 'published', data: slug === 'home' ? { title, summary, eyebrow, hero: { slides: heroSlides } } : { title, summary, eyebrow } })),
  ...serviceCatalog.map((service, index) => ({
    id: `service-${service.slug}`,
    collection: 'services',
    title: service.title,
    slug: service.slug,
    status: 'published',
    data: { title: service.title, description: service.description, audience: service.audience, access: serviceAccess, preparation: service.preparation, order: index + 1 },
  })),
  ...[
    ['privacy-notice', 'Privacy notice', 'We collect only the information needed to respond to your enquiry. Do not submit clinical results, detailed medical histories or genomic files through this website.'],
    ['terms', 'Website terms', 'Website information is general guidance and is not medical advice. Contact your care team for clinical decisions. For urgent care, contact local emergency services.'],
    ['complaints', 'Complaints & feedback', 'Share feedback with our team so it can be reviewed and routed appropriately.'],
    ['accessibility', 'Accessibility statement', 'We aim to make this website accessible and usable on mobile and desktop devices. If you encounter a barrier, contact us and describe the page and issue so we can help.'],
    ['cookies', 'Cookie information', 'The public site does not use advertising or analytics cookies. Essential session cookies are used only when an administrator signs in to the staff workspace.'],
  ].map(([slug, title, body]) => ({ id: `page-${slug}`, collection: 'pages', title, slug, status: 'published', data: { title, summary: body, eyebrow: 'Information' } })),
  ...teamSeeds,
];

const count = db.prepare('SELECT COUNT(*) AS n FROM content').get().n;
if (!count) {
  const insert = db.prepare('INSERT INTO content (id, collection, title, slug, status, data) VALUES (?, ?, ?, ?, ?, ?)');
  db.exec('BEGIN');
  try {
    for (const item of seeds) insert.run(item.id, item.collection, item.title, item.slug, item.status, safeJson(item.data));
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

const homeRow = db.prepare("SELECT id, data FROM content WHERE collection = 'pages' AND slug = 'home'").get();
if (homeRow) {
  const homeData = JSON.parse(homeRow.data);
  if (!homeData.hero || !Array.isArray(homeData.hero.slides) || !homeData.hero.slides.length) {
    homeData.hero = { slides: heroSlides };
    db.prepare('UPDATE content SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(safeJson(homeData), homeRow.id);
  }
}

const SERVICE_SET_VERSION = 'service-catalog-2026-10-v1';
if (!db.prepare('SELECT value FROM meta WHERE key = ?').get(SERVICE_SET_VERSION)) {
  const insertService = db.prepare('INSERT OR IGNORE INTO content (id, collection, title, slug, status, data) VALUES (?, ?, ?, ?, ?, ?)');
  const placeholders = ['service-specialist-diagnostics', 'service-molecular-referral', 'service-specimen-logistics', 'service-laboratory-solutions'];
  db.exec('BEGIN');
  try {
    for (const id of placeholders) db.prepare('DELETE FROM content WHERE id = ? AND collection = ?').run(id, 'services');
    serviceCatalog.forEach((service, index) => {
      insertService.run(
        `service-${service.slug}`,
        'services',
        service.title,
        service.slug,
        'published',
        safeJson({ title: service.title, description: service.description, audience: service.audience, access: serviceAccess, preparation: service.preparation, order: index + 1 })
      );
    });
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run(SERVICE_SET_VERSION, new Date().toISOString());
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

const TEAM_SET_VERSION = 'team-catalog-2026-10-v1';
if (!db.prepare('SELECT value FROM meta WHERE key = ?').get(TEAM_SET_VERSION)) {
  const insertTeam = db.prepare('INSERT OR IGNORE INTO content (id, collection, title, slug, status, data) VALUES (?, ?, ?, ?, ?, ?)');
  db.exec('BEGIN');
  try {
    teamSeeds.forEach((member) => insertTeam.run(member.id, member.collection, member.title, member.slug, member.status, safeJson(member.data)));
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run(TEAM_SET_VERSION, new Date().toISOString());
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

const COOKIES_COPY_VERSION = 'turnstile-cookies-2026-10-v1';
if (!db.prepare('SELECT value FROM meta WHERE key = ?').get(COOKIES_COPY_VERSION)) {
  const cookiesRow = db.prepare("SELECT id, data FROM content WHERE collection = 'pages' AND slug = 'cookies'").get();
  if (cookiesRow) {
    const cookiesData = JSON.parse(cookiesRow.data);
    const originalCookiesCopy = 'The public site does not use advertising or analytics cookies. Essential session cookies are used only when an administrator signs in to the staff workspace.';
    if (cookiesData.summary === originalCookiesCopy) {
      cookiesData.summary = `${originalCookiesCopy} The contact form is protected by a privacy-focused bot check (Cloudflare Turnstile), which may set a short-lived cookie to prevent abuse.`;
      db.prepare('UPDATE content SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(safeJson(cookiesData), cookiesRow.id);
    }
  }
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run(COOKIES_COPY_VERSION, new Date().toISOString());
}

const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (!userCount) {
  db.prepare('INSERT INTO users (id, username, password_hash, role, status) VALUES (?, ?, ?, ?, ?)').run(
    randomUUID(), adminUsername, hashPassword(secret), 'admin', 'active',
  );
  console.log(`Created initial administrator account "${adminUsername}". Add more users from the staff workspace.`);
}

function respond(res, code, body, headers = {}) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', ...headers });
  res.end(JSON.stringify(body));
}
function parseCookies(header = '') { return Object.fromEntries(header.split(';').map(x => x.trim().split('=').map(decodeURIComponent)).filter(x => x.length === 2)); }
function sessionFor(req) {
  const token = parseCookies(req.headers.cookie).gw_session;
  if (!token) return null;
  const row = db.prepare(
    'SELECT u.id AS user_id, u.username, u.role, u.status, s.expires FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?',
  ).get(token);
  if (!row) return null;
  if (row.expires < Date.now() || row.status !== 'active') {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return { userId: row.user_id, username: row.username, role: row.role };
}
function authenticated(req) {
  return Boolean(sessionFor(req));
}
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const computed = scryptSync(password, salt, 64).toString('hex');
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
  } catch {
    return false;
  }
}
function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) { const first = String(fwd).split(',')[0].trim(); if (first) return first; }
  const real = req.headers['x-real-ip'];
  if (real) return String(real).trim();
  return req.socket?.remoteAddress || '';
}
function logAudit(payload) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, username, action, collection, record_id, ip, user_agent, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      randomUUID(),
      payload.userId || null,
      payload.username || null,
      payload.action,
      payload.collection || null,
      payload.recordId || null,
      payload.ip || null,
      payload.userAgent || null,
      payload.metadata ? safeJson(payload.metadata) : null,
    );
  } catch (error) {
    console.error('audit log failed:', error);
  }
}
async function body(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 20000) throw new Error('Request is too large.'); }
  return raw ? JSON.parse(raw) : {};
}
function readBinary(req, limit) {
  return new Promise((resolveBuffer, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(new Error(`The image must be ${Math.round(limit / (1024 * 1024))} MB or smaller.`)); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolveBuffer(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function validRecord(collection, record, creating) {
  const title = String(record.title || '').trim();
  if (!title || title.length > 140) return 'A title of 1–140 characters is required.';
  const status = record.status || (collection === 'inquiries' ? 'new' : 'draft');
  const options = collection === 'inquiries' ? ['new', 'in-progress', 'resolved', 'archived'] : ['draft', 'published'];
  if (!options.includes(status)) return 'Status is invalid.';
  if (collection === 'team') {
    const bio = String(record.bio || '');
    if (bio.length > 4000) return 'The biography must be 4000 characters or fewer.';
    const role = String(record.role || '');
    if (role.length > 140) return 'The role must be 140 characters or fewer.';
    const credentials = String(record.credentials || '');
    if (credentials.length > 300) return 'Credentials must be 300 characters or fewer.';
  }
  if (collection === 'inquiries') {
    const email = String(record.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'A valid email address is required.';
    const category = String(record.category || 'general');
    if (!['provider', 'patient', 'research', 'supplier', 'general'].includes(category)) return 'Enquiry category is invalid.';
    const method = String(record.contactMethod || 'email');
    if (!['email', 'phone', 'whatsapp'].includes(method)) return 'Preferred contact method is invalid.';
    if (method === 'phone' || method === 'whatsapp') {
      const phone = String(record.phone || '').trim();
      if (!/^[+()\-.\s0-9]{6,40}$/.test(phone)) return `A valid phone number is required when ${method === 'whatsapp' ? 'WhatsApp' : 'phone'} contact is preferred.`;
    }
    if (creating && record.consent !== true) return 'Please accept the privacy notice before sending your enquiry.';
    if (record.gender && !['female', 'male', 'non-binary', 'other'].includes(String(record.gender))) return 'Gender value is invalid.';
    if (record.service && !serviceCatalog.some((service) => service.slug === record.service) && record.service !== 'other') return 'Service selection is invalid.';
    for (const key of ['message', 'organisation', 'orgType', 'institutionType', 'role', 'location', 'language', 'subject', 'needs', 'volume', 'volumeUnit', 'logistics', 'ethicsStatus', 'timeline', 'website', 'registrationNumber', 'contactMethod', 'phone', 'reference', 'consentVersion', 'country', 'state', 'gender', 'service']) {
      if (record[key] && String(record[key]).length > (key === 'message' ? 3000 : 500)) return `${key} is too long.`;
    }
  }
  return null;
}
function list(collection, publicOnly) {
  const q = publicOnly
    ? db.prepare("SELECT * FROM content WHERE collection = ? AND status = 'published' ORDER BY created_at, title")
    : db.prepare('SELECT * FROM content WHERE collection = ? ORDER BY created_at DESC');
  const rows = q.all(collection).map(row => ({ ...row, data: JSON.parse(row.data) }));
  if (collection === 'team') {
    rows.sort((a, b) => {
      const ao = Number(a.data.order) || 0;
      const bo = Number(b.data.order) || 0;
      return ao !== bo ? ao - bo : String(a.title).localeCompare(String(b.title));
    });
  }
  return rows;
}

const distDir = resolve('dist');
const staticRoot = existsSync(join(distDir, 'index.html')) ? distDir : resolve('.');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};
function serveStatic(res, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return false; }
  const relative = normalize(decoded).replace(/^([/\\])+/, '');
  const filePath = join(staticRoot, relative);
  if (filePath !== staticRoot && !filePath.startsWith(staticRoot + sep)) return false;
  try {
    if (!existsSync(filePath) || !statSync(filePath).isFile()) return false;
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, {
      'content-type': mime[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    });
    res.end(readFileSync(filePath));
    return true;
  } catch {
    return false;
  }
}
function serveUpload(res, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return false; }
  const relative = normalize(decoded.replace(/^\/uploads\/?/, '')).replace(/^([/\\])+/, '');
  const filePath = join(uploadsDir, relative);
  if (!relative || (filePath !== uploadsDir && !filePath.startsWith(uploadsDir + sep))) return false;
  try {
    if (!existsSync(filePath) || !statSync(filePath).isFile()) return false;
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, {
      'content-type': mime[ext] || 'application/octet-stream',
      'cache-control': 'public, max-age=86400',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    });
    res.end(readFileSync(filePath));
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');

  if (req.method === 'GET' && path === '/api/health') return respond(res, 200, { ok: true });
  if (req.method === 'POST' && path === '/api/admin/login') {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const now = Date.now(); const bucket = requestCounts.get(ip) || { count: 0, until: now + 60000 };
    if (now > bucket.until) { bucket.count = 0; bucket.until = now + 60000; }
    if (bucket.count >= adminLoginRateLimit) return respond(res, 429, { error: 'Too many sign-in attempts. Please wait a minute.' });
    bucket.count++; requestCounts.set(ip, bucket);
    let payload;
    try { payload = await body(req); } catch { return respond(res, 400, { error: 'Invalid request.' }); }
    const username = String(payload.username || '').trim().toLowerCase();
    const password = String(payload.password || '');
    const row = username
      ? db.prepare("SELECT * FROM users WHERE username = ? AND status = 'active'").get(username)
      : null;
    if (!row || !verifyPassword(password, row.password_hash)) {
      logAudit({ action: 'login_failed', username: username || null, ip, userAgent, metadata: { reason: 'invalid_credentials' } });
      return respond(res, 401, { error: 'Those credentials were not accepted.' });
    }
    db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    db.prepare('INSERT INTO sessions (token, user_id, username, role, expires) VALUES (?, ?, ?, ?, ?)')
      .run(token, row.id, row.username, row.role, Date.now() + 8 * 60 * 60 * 1000);
    logAudit({ userId: row.id, username: row.username, action: 'login', ip, userAgent, metadata: { method: 'password' } });
    return respond(res, 200, { ok: true, username: row.username, role: row.role }, { 'set-cookie': `gw_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}` });
  }
  if (req.method === 'POST' && path === '/api/admin/logout') {
    const session = sessionFor(req);
    const token = parseCookies(req.headers.cookie).gw_session;
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    if (session) logAudit({ userId: session.userId, username: session.username, action: 'logout', ip: getClientIp(req), userAgent: req.headers['user-agent'] || '' });
    return respond(res, 200, { ok: true }, { 'set-cookie': 'gw_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }
  if (req.method === 'GET' && path === '/api/admin/me') {
    const session = sessionFor(req);
    if (!session) return respond(res, 401, { error: 'Not signed in.' });
    return respond(res, 200, { username: session.username, role: session.role });
  }
  const publicMatch = path.match(/^\/api\/public\/(pages|services|faqs|team)$/);
  if (req.method === 'GET' && publicMatch) return respond(res, 200, list(publicMatch[1], true));
  if (req.method === 'POST' && path === '/api/public/inquiries') {
    const ip = req.socket.remoteAddress || 'local';
    const now = Date.now();
    const bucket = inquiryCounts.get(ip) || { count: 0, until: now + 10 * 60 * 1000 };
    if (now > bucket.until) { bucket.count = 0; bucket.until = now + 10 * 60 * 1000; }
    if (bucket.count >= enquiryRateLimit) return respond(res, 429, { error: 'Too many enquiries from this device. Please try again later.' });
    bucket.count++; inquiryCounts.set(ip, bucket);

    let input; try { input = await body(req); } catch (error) { return respond(res, 400, { error: error.message === 'Request is too large.' ? error.message : 'Invalid request.' }); }
    if (input.website) return respond(res, 202, { ok: true });
    if (input.formStartedAt && Number.isFinite(Number(input.formStartedAt)) && now - Number(input.formStartedAt) < 1500) return respond(res, 202, { ok: true });

    const turnstile = await verifyTurnstile(input.turnstileToken, ip);
    if (!turnstile.ok) return respond(res, 400, { error: turnstile.error });
    delete input.turnstileToken;
    delete input['cf-turnstile-response'];

    const reference = enquiryReference();
    const record = { ...input, reference, consentAt: new Date().toISOString(), consentVersion: privacyNoticeVersion, title: `${input.category || 'general'} enquiry (${reference})`, status: 'new' };
    record.consent = input.consent === true;
    delete record.formStartedAt;
    delete record.website;
    const issue = validRecord('inquiries', record, true);
    if (issue) return respond(res, 400, { error: issue });
    const id = randomBytes(12).toString('hex');
    db.prepare('INSERT INTO content (id, collection, title, status, data) VALUES (?, ?, ?, ?, ?)').run(id, 'inquiries', record.title, 'new', safeJson({ ...record, createdAt: new Date().toISOString() }));
    respond(res, 201, { ok: true, reference, message: 'Thank you. Your enquiry has been received.' });
    sendEnquiryEmails(record, reference)
      .then((status) => {
        try {
          const stored = JSON.parse(db.prepare('SELECT data FROM content WHERE id = ?').get(id).data);
          stored.notify = status;
          db.prepare('UPDATE content SET data = ? WHERE id = ?').run(safeJson(stored), id);
        } catch { /* notification status is best-effort. */ }
      })
      .catch(() => {});
    return;
  }

  if (path.startsWith('/api/admin/')) {
    const session = sessionFor(req);
    if (!session) return respond(res, 401, { error: 'Please sign in to continue.' });
    if (path === '/api/admin/audit' || path === '/api/admin/audit-logs') {
      if (session.role !== 'admin') return respond(res, 403, { error: 'Administrator access is required.' });
      if (req.method !== 'GET') return respond(res, 405, { error: 'Method not allowed.' });
      const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 100) || 100));
      const rows = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC, rowid DESC LIMIT ?').all(limit)
        .map(row => ({ ...row, metadata: row.metadata ? JSON.parse(row.metadata) : null }));
      return respond(res, 200, rows);
    }

    if (path === '/api/admin/stats/enquiries') {
      if (req.method !== 'GET') return respond(res, 405, { error: 'Method not allowed.' });
      const rows = db.prepare("SELECT data FROM content WHERE collection = 'inquiries'").all();
      const records = rows.map((row) => { try { return JSON.parse(row.data); } catch { return null; } }).filter(Boolean);
      const tally = (pick) => {
        const counts = new Map();
        for (const record of records) {
          const value = String(pick(record) || '').trim();
          if (!value) continue;
          counts.set(value, (counts.get(value) || 0) + 1);
        }
        return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
      };
      const serviceTitles = new Map(
        db.prepare("SELECT slug, title FROM content WHERE collection = 'services'").all().map((row) => [row.slug, row.title])
      );
      const byService = tally((r) => r.service).map((row) => ({ ...row, label: serviceTitles.get(row.label) || row.label }));
      const byStatus = tally((r) => r.status);
      const byCategory = tally((r) => r.category);
      const byMonth = tally((r) => (r.createdAt || r.consentAt || '').slice(0, 7));
      const summary = {
        total: records.length,
        newCount: records.filter((r) => r.status === 'new').length,
        resolvedCount: records.filter((r) => r.status === 'resolved' || r.status === 'archived').length,
        withCountry: records.filter((r) => r.country).length,
        withState: records.filter((r) => r.state).length,
        withGender: records.filter((r) => r.gender).length,
        withService: records.filter((r) => r.service).length,
      };
      return respond(res, 200, {
        summary,
        byCountry: tally((r) => r.country),
        byState: tally((r) => r.state),
        byCategory,
        byService,
        byGender: tally((r) => r.gender),
        byStatus,
        byMonth,
      });
    }

    if (path === '/api/admin/uploads') {
      if (req.method !== 'POST') return respond(res, 405, { error: 'Method not allowed.' });
      const filename = String(url.searchParams.get('filename') || '').trim();
      const ext = extname(filename).toLowerCase();
      if (!uploadTypes[ext]) return respond(res, 400, { error: 'Unsupported image type. Use PNG, JPG, WEBP, GIF or AVIF.' });
      let buffer;
      try { buffer = await readBinary(req, maxUploadBytes); } catch (error) { return respond(res, 400, { error: error.message }); }
      if (!buffer.length) return respond(res, 400, { error: 'The uploaded image was empty.' });
      const stored = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
      writeFileSync(join(uploadsDir, stored), buffer);
      logAudit({ userId: session.userId, username: session.username, action: 'upload', collection: 'uploads', recordId: stored, ip: getClientIp(req), userAgent: req.headers['user-agent'] || '', metadata: { filename, size: buffer.length } });
      return respond(res, 201, { url: `/uploads/${stored}`, size: buffer.length });
    }

    if (path === '/api/admin/users' || path.startsWith('/api/admin/users/')) {
      if (session.role !== 'admin') return respond(res, 403, { error: 'Only administrators can manage user accounts.' });
      const userIdMatch = path.match(/^\/api\/admin\/users(?:\/([a-zA-Z0-9-]+))?$/);
      if (!userIdMatch) return respond(res, 404, { error: 'Not found.' });
      const userId = userIdMatch[1] || null;

      if (req.method === 'GET' && !userId) {
        const users = db.prepare('SELECT id, username, role, status, created_at, last_login_at, updated_at FROM users ORDER BY created_at').all();
        return respond(res, 200, users);
      }
      if (req.method === 'POST' && !userId) {
        let payload; try { payload = await body(req); } catch { return respond(res, 400, { error: 'Invalid request.' }); }
        const username = String(payload.username || '').trim().toLowerCase();
        const password = String(payload.password || '');
        const role = payload.role === 'admin' ? 'admin' : 'editor';
        if (!/^[a-z0-9._-]{3,32}$/.test(username)) return respond(res, 400, { error: 'Usernames must be 3–32 characters: letters, numbers, dot, dash or underscore.' });
        if (password.length < 12) return respond(res, 400, { error: 'Passwords must be at least 12 characters.' });
        if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) return respond(res, 409, { error: 'That username is already in use.' });
        const newId = randomUUID();
        db.prepare('INSERT INTO users (id, username, password_hash, role, status) VALUES (?, ?, ?, ?, ?)').run(newId, username, hashPassword(password), role, 'active');
        logAudit({ userId: session.userId, username: session.username, action: 'create', collection: 'users', recordId: newId, ip: getClientIp(req), userAgent: req.headers['user-agent'] || '', metadata: { username, role } });
        return respond(res, 201, { id: newId });
      }
      if (userId && req.method === 'PUT') {
        const target = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!target) return respond(res, 404, { error: 'User not found.' });
        let payload; try { payload = await body(req); } catch { return respond(res, 400, { error: 'Invalid request.' }); }
        const updates = [];
        const values = [];
        if (payload.role !== undefined) {
          if (!['admin', 'editor'].includes(payload.role)) return respond(res, 400, { error: 'Role is invalid.' });
          if (target.id === session.userId && payload.role !== 'admin') return respond(res, 400, { error: 'You cannot remove your own administrator role.' });
          updates.push('role = ?'); values.push(payload.role);
        }
        if (payload.status !== undefined) {
          if (!['active', 'disabled'].includes(payload.status)) return respond(res, 400, { error: 'Status is invalid.' });
          if (target.id === session.userId && payload.status !== 'active') return respond(res, 400, { error: 'You cannot disable your own account.' });
          updates.push('status = ?'); values.push(payload.status);
        }
        if (payload.password !== undefined && payload.password !== '') {
          if (String(payload.password).length < 12) return respond(res, 400, { error: 'Passwords must be at least 12 characters.' });
          updates.push('password_hash = ?'); values.push(hashPassword(String(payload.password)));
        }
        if (!updates.length) return respond(res, 400, { error: 'Nothing to update.' });
        updates.push('updated_at = CURRENT_TIMESTAMP');
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values, userId);
        logAudit({ userId: session.userId, username: session.username, action: 'update', collection: 'users', recordId: userId, ip: getClientIp(req), userAgent: req.headers['user-agent'] || '', metadata: { fields: Object.keys(payload) } });
        return respond(res, 200, { ok: true });
      }
      if (userId && req.method === 'DELETE') {
        if (userId === session.userId) return respond(res, 400, { error: 'You cannot delete your own account.' });
        const target = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!target) return respond(res, 404, { error: 'User not found.' });
        const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'").get().n;
        if (target.role === 'admin' && admins <= 1) return respond(res, 400, { error: 'At least one active administrator is required.' });
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        logAudit({ userId: session.userId, username: session.username, action: 'delete', collection: 'users', recordId: userId, ip: getClientIp(req), userAgent: req.headers['user-agent'] || '', metadata: { username: target.username } });
        return respond(res, 200, { ok: true });
      }
      return respond(res, 405, { error: 'Method not allowed.' });
    }

    const match = path.match(/^\/api\/admin\/(pages|services|faqs|claims|inquiries|team)(?:\/([a-zA-Z0-9-]+))?$/);
    if (!match) return respond(res, 404, { error: 'Not found.' });
    const [, collection, id] = match;
    const ua = req.headers['user-agent'] || '';
    const ipAddr = getClientIp(req);
    const auditContext = { userId: session.userId, username: session.username, collection, ip: ipAddr, userAgent: ua };
    if (req.method === 'GET' && !id) return respond(res, 200, list(collection, false));
    if (req.method === 'POST' && !id) {
      let record; try { record = await body(req); } catch { return respond(res, 400, { error: 'Invalid request.' }); }
      const issue = validRecord(collection, record, true); if (issue) return respond(res, 400, { error: issue });
      const newId = randomBytes(6).toString('hex');
      const slugSource = record.slug || (collection === 'team' ? record.title : '');
      const slug = String(slugSource || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || null;
      db.prepare('INSERT INTO content (id, collection, title, slug, status, data) VALUES (?, ?, ?, ?, ?, ?)').run(newId, collection, record.title.trim(), slug, record.status || (collection === 'inquiries' ? 'new' : 'draft'), safeJson(record));
      logAudit({ ...auditContext, action: 'create', recordId: newId, metadata: { title: record.title.trim(), status: record.status || (collection === 'inquiries' ? 'new' : 'draft') } });
      return respond(res, 201, { id: newId });
    }
    if (id && req.method === 'GET') {
      const row = db.prepare('SELECT * FROM content WHERE id = ? AND collection = ?').get(id, collection);
      return row ? respond(res, 200, { ...row, data: JSON.parse(row.data) }) : respond(res, 404, { error: 'Record not found.' });
    }
    if (id && req.method === 'PUT') {
      let record; try { record = await body(req); } catch { return respond(res, 400, { error: 'Invalid request.' }); }
      const issue = validRecord(collection, record, false); if (issue) return respond(res, 400, { error: issue });
      const slugSource = record.slug || (collection === 'team' ? record.title : '');
      const slug = String(slugSource || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || null;
      const result = db.prepare('UPDATE content SET title = ?, slug = ?, status = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND collection = ?').run(record.title.trim(), slug, record.status || 'draft', safeJson(record), id, collection);
      if (result.changes) logAudit({ ...auditContext, action: 'update', recordId: id, metadata: { title: record.title.trim(), status: record.status || 'draft' } });
      return result.changes ? respond(res, 200, { ok: true }) : respond(res, 404, { error: 'Record not found.' });
    }
    if (id && req.method === 'DELETE') {
      const result = db.prepare('DELETE FROM content WHERE id = ? AND collection = ?').run(id, collection);
      if (result.changes) logAudit({ ...auditContext, action: 'delete', recordId: id });
      return result.changes ? respond(res, 200, { ok: true }) : respond(res, 404, { error: 'Record not found.' });
    }
    return respond(res, 405, { error: 'Method not allowed.' });
  }

  if (req.method === 'GET' && path === '/robots.txt') {
    const text = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' });
    return res.end(text);
  }
  if (req.method === 'GET' && path === '/sitemap.xml') {
    const paths = ['/', '/services', '/healthcare-providers', '/patients', '/quality-compliance', '/about', '/contact', '/privacy-notice', '/terms', '/complaints', '/accessibility', '/cookies'];
    const urls = paths.map((p) => `  <url><loc>${siteUrl}${p === '/' ? '/' : p}</loc></url>`).join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
    res.writeHead(200, { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' });
    return res.end(xml);
  }

  if (req.method === 'GET' && path.startsWith('/uploads/')) {
    if (serveUpload(res, path)) return;
    return respond(res, 404, { error: 'Not found.' });
  }

  if (path.startsWith('/api/')) return respond(res, 404, { error: 'Not found.' });
  if (req.method === 'GET') {
    if (serveStatic(res, path)) return;
    if (serveStatic(res, '/index.html')) return;
  }
  return respond(res, 404, { error: 'Not found.' });
});

server.listen(port, () => console.log(`GeneWorldBio API listening on http://localhost:${port}`));
