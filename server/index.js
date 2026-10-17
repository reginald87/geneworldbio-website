import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

try {
  const envText = readFileSync(resolve('.env'), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
} catch { /* .env is optional when variables are configured in the environment. */ }

const port = Number(process.env.PORT || 8787);
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
`);

const collections = new Set(['pages', 'services', 'faqs', 'claims', 'inquiries']);
const sessions = new Map();
const requestCounts = new Map();
const safeJson = (value) => JSON.stringify(value);

const seeds = [
  ...[
    ['home', 'Diagnostics, connected with care', 'A dependable partner for healthcare teams and a clearer path to diagnostic support for patients.', 'Home'],
    ['services', 'Diagnostics and specimen support', 'Explore service pathways and talk with our team about access, referrals and logistics.', 'Services'],
    ['healthcare-providers', 'A diagnostics partner for your team', 'Build a dependable referral pathway with clear communication, logistics planning and account support.', 'Healthcare Providers'],
    ['patients', 'Clear guidance at every step', 'Understand what to expect, how to prepare and where to find support for your testing pathway.', 'Patients'],
    ['quality-compliance', 'Quality begins with clear standards', 'Our approach puts accountability, careful handling, privacy and transparent communication at the centre.', 'Quality & Compliance'],
    ['about', 'Built around better access', 'GeneWorldBio is developing a Nigeria-first diagnostics and laboratory-solutions model grounded in practical partnerships.', 'About'],
    ['contact', 'Let’s find the right route', 'Tell us what you need and we will direct your message to the appropriate team.', 'Contact'],
  ].map(([slug, title, summary, eyebrow]) => ({ id: `page-${slug}`, collection: 'pages', title, slug, status: 'published', data: { title, summary, eyebrow } })),
  ...[
    ['specialist-diagnostics', 'Specialist diagnostics', 'A route to specialist diagnostic services through an appropriate provider or referral pathway.'],
    ['molecular-referral', 'Molecular & referral testing', 'Discuss referral testing needs and the right pathway for your organisation or care team.'],
    ['specimen-logistics', 'Specimen collection & logistics', 'Plan specimen handling and logistics requirements with a member of our provider team.'],
    ['laboratory-solutions', 'Laboratory solutions', 'Explore operational support and laboratory-solutions discussions for institutions.'],
  ].map(([slug, title, description]) => ({ id: `service-${slug}`, collection: 'services', title, slug, status: 'published', data: { title, description, audience: 'Providers and patients', access: 'Availability and access are confirmed through a direct enquiry.' } })),
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
    for (const key of ['message', 'organisation', 'name', 'location', 'needs', 'volume', 'logistics', 'contactMethod']) {
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
    let input; try { input = await body(req); } catch (error) { return respond(res, 400, { error: error.message === 'Request is too large.' ? error.message : 'Invalid request.' }); }
    if (input.website) return respond(res, 202, { ok: true });
    const record = { ...input, title: `${input.category || 'general'} enquiry`, status: 'new' };
    const issue = validRecord('inquiries', record, true);
    if (issue) return respond(res, 400, { error: issue });
    const id = randomBytes(12).toString('hex');
    db.prepare('INSERT INTO content (id, collection, title, status, data) VALUES (?, ?, ?, ?, ?)').run(id, 'inquiries', record.title, 'new', safeJson({ ...record, createdAt: new Date().toISOString() }));
    return respond(res, 201, { ok: true, message: 'Thank you. Your enquiry has been received.' });
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
  const appFiles = { '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'], '/src/main.js': ['src/main.js', 'text/javascript; charset=utf-8'], '/src/style.css': ['src/style.css', 'text/css; charset=utf-8'] };
  if (req.method === 'GET' && appFiles[path]) {
    try {
      const [filename, contentType] = appFiles[path];
      const content = readFileSync(resolve(filename));
      res.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' });
      res.end(content);
      return;
    } catch {
      return respond(res, 500, { error: 'The website files could not be loaded.' });
    }
  }
  return respond(res, 404, { error: 'Not found.' });
});

server.listen(port, () => console.log(`GeneWorldBio API listening on http://localhost:${port}`));
