import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
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
const secret = process.env.ADMIN_PASSWORD;
if (!secret || secret.length < 12) {
  console.error('Set ADMIN_PASSWORD to a value of at least 12 characters in .env before starting the server.');
  process.exit(1);
}

const dbPath = resolve(process.env.DB_PATH || 'data/geneworldbio.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
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
`);

const collections = new Set(['pages', 'services', 'faqs', 'claims', 'inquiries']);
const sessions = new Map();
const requestCounts = new Map();
const inquiryCounts = new Map();
const safeJson = (value) => JSON.stringify(value);

const privacyNoticeVersion = process.env.PRIVACY_NOTICE_VERSION || 'v1.0';
const enquiryReference = () => `GWB-${randomBytes(3).toString('hex').toUpperCase()}`;
const enquiryRateLimit = Math.max(1, Number(process.env.ENQUIRY_RATE_LIMIT || 5) || 5);

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

const seeds = [
  ...[
    ['home', 'Diagnostics, connected with care', 'A dependable partner for healthcare teams and a clearer path to diagnostic support for patients.', 'Home'],
    ['services', 'Diagnostics and specimen support', 'Explore service pathways and talk with our team about access, referrals and logistics.', 'Services'],
    ['healthcare-providers', 'A diagnostics partner for your team', 'Build a dependable referral pathway with clear communication, logistics planning and account support.', 'Healthcare Providers'],
    ['patients', 'Clear guidance at every step', 'Understand what to expect, how to prepare and where to find support for your testing pathway.', 'Patients'],
    ['quality-compliance', 'Quality begins with clear standards', 'Our approach puts accountability, careful handling, privacy and transparent communication at the centre.', 'Quality & Compliance'],
    ['about', 'Built around better access', 'GeneWorldBio is developing a Nigeria-first diagnostics and laboratory-solutions model grounded in practical partnerships.', 'About'],
    ['contact', 'Let’s find the right route', 'Tell us what you need and we will direct your message to the appropriate team.', 'Contact'],
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

function respond(res, code, body, headers = {}) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', ...headers });
  res.end(JSON.stringify(body));
}
function parseCookies(header = '') { return Object.fromEntries(header.split(';').map(x => x.trim().split('=').map(decodeURIComponent)).filter(x => x.length === 2)); }
function authenticated(req) {
  const token = parseCookies(req.headers.cookie).gw_session;
  if (!token || !sessions.has(token)) return false;
  if (sessions.get(token) < Date.now()) { sessions.delete(token); return false; }
  return true;
}
function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a)); const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}
async function body(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 20000) throw new Error('Request is too large.'); }
  return raw ? JSON.parse(raw) : {};
}
function validRecord(collection, record, creating) {
  const title = String(record.title || '').trim();
  if (!title || title.length > 140) return 'A title of 1–140 characters is required.';
  const status = record.status || (collection === 'inquiries' ? 'new' : 'draft');
  const options = collection === 'inquiries' ? ['new', 'in-progress', 'resolved', 'archived'] : ['draft', 'published'];
  if (!options.includes(status)) return 'Status is invalid.';
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
    for (const key of ['message', 'organisation', 'orgType', 'institutionType', 'role', 'location', 'language', 'subject', 'needs', 'volume', 'volumeUnit', 'logistics', 'ethicsStatus', 'timeline', 'website', 'registrationNumber', 'contactMethod', 'phone', 'reference', 'consentVersion']) {
      if (record[key] && String(record[key]).length > (key === 'message' ? 3000 : 500)) return `${key} is too long.`;
    }
  }
  return null;
}
function list(collection, publicOnly) {
  const q = publicOnly
    ? db.prepare("SELECT * FROM content WHERE collection = ? AND status = 'published' ORDER BY created_at, title")
    : db.prepare('SELECT * FROM content WHERE collection = ? ORDER BY created_at DESC');
  return q.all(collection).map(row => ({ ...row, data: JSON.parse(row.data) }));
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

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');

  if (req.method === 'GET' && path === '/api/health') return respond(res, 200, { ok: true });
  if (req.method === 'POST' && path === '/api/admin/login') {
    const ip = req.socket.remoteAddress || 'local';
    const now = Date.now(); const bucket = requestCounts.get(ip) || { count: 0, until: now + 60000 };
    if (now > bucket.until) { bucket.count = 0; bucket.until = now + 60000; }
    if (bucket.count >= 8) return respond(res, 429, { error: 'Too many sign-in attempts. Please wait a minute.' });
    bucket.count++; requestCounts.set(ip, bucket);
    let payload;
    try { payload = await body(req); } catch { return respond(res, 400, { error: 'Invalid request.' }); }
    if (!constantTimeEqual(payload.password || '', secret)) return respond(res, 401, { error: 'The password was not accepted.' });
    const token = randomBytes(32).toString('hex'); sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
    return respond(res, 200, { ok: true }, { 'set-cookie': `gw_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}` });
  }
  if (req.method === 'POST' && path === '/api/admin/logout') {
    const token = parseCookies(req.headers.cookie).gw_session; sessions.delete(token);
    return respond(res, 200, { ok: true }, { 'set-cookie': 'gw_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }
  const publicMatch = path.match(/^\/api\/public\/(pages|services|faqs)$/);
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
    if (!authenticated(req)) return respond(res, 401, { error: 'Please sign in to continue.' });
    const match = path.match(/^\/api\/admin\/(pages|services|faqs|claims|inquiries)(?:\/([a-zA-Z0-9-]+))?$/);
    if (!match) return respond(res, 404, { error: 'Not found.' });
    const [, collection, id] = match;
    if (req.method === 'GET' && !id) return respond(res, 200, list(collection, false));
    if (req.method === 'POST' && !id) {
      let record; try { record = await body(req); } catch { return respond(res, 400, { error: 'Invalid request.' }); }
      const issue = validRecord(collection, record, true); if (issue) return respond(res, 400, { error: issue });
      const newId = randomBytes(12).toString('hex');
      const slug = String(record.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || null;
      db.prepare('INSERT INTO content (id, collection, title, slug, status, data) VALUES (?, ?, ?, ?, ?, ?)').run(newId, collection, record.title.trim(), slug, record.status || (collection === 'inquiries' ? 'new' : 'draft'), safeJson(record));
      return respond(res, 201, { id: newId });
    }
    if (id && req.method === 'GET') {
      const row = db.prepare('SELECT * FROM content WHERE id = ? AND collection = ?').get(id, collection);
      return row ? respond(res, 200, { ...row, data: JSON.parse(row.data) }) : respond(res, 404, { error: 'Record not found.' });
    }
    if (id && req.method === 'PUT') {
      let record; try { record = await body(req); } catch { return respond(res, 400, { error: 'Invalid request.' }); }
      const issue = validRecord(collection, record, false); if (issue) return respond(res, 400, { error: issue });
      const slug = String(record.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || null;
      const result = db.prepare('UPDATE content SET title = ?, slug = ?, status = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND collection = ?').run(record.title.trim(), slug, record.status || 'draft', safeJson(record), id, collection);
      return result.changes ? respond(res, 200, { ok: true }) : respond(res, 404, { error: 'Record not found.' });
    }
    if (id && req.method === 'DELETE') {
      const result = db.prepare('DELETE FROM content WHERE id = ? AND collection = ?').run(id, collection);
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

  if (path.startsWith('/api/')) return respond(res, 404, { error: 'Not found.' });
  if (req.method === 'GET') {
    if (serveStatic(res, path)) return;
    if (serveStatic(res, '/index.html')) return;
  }
  return respond(res, 404, { error: 'Not found.' });
});

server.listen(port, () => console.log(`GeneWorldBio API listening on http://localhost:${port}`));
