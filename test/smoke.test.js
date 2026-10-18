import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const node = process.execPath;
const serverEntry = resolve('server/index.js');

function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });
}

async function startServer(extraEnv = {}) {
  const port = await freePort();
  const dbPath = resolve(tmpdir(), `gw-smoke-${port}.sqlite`);
  const uploadsPath = resolve(tmpdir(), `gw-smoke-uploads-${port}`);
  const child = spawn(node, [serverEntry], {
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
      UPLOADS_DIR: uploadsPath,
      ADMIN_PASSWORD: 'smoke-test-password-123',
      ADMIN_LOGIN_RATE_LIMIT: '1000',
      ENQUIRY_RATE_LIMIT: '100',
      ...extraEnv,
    },
    stdio: 'ignore',
  });

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 25000;
  for (;;) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) break;
    } catch { /* server is not listening yet */ }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`server did not become healthy on ${base}`);
    }
    await new Promise((done) => setTimeout(done, 150));
  }

  return {
    base,
    async stop() {
      child.kill();
      await new Promise((done) => setTimeout(done, 250));
      for (const suffix of ['', '-wal', '-shm']) {
        try { rmSync(`${dbPath}${suffix}`); } catch { /* already gone */ }
      }
      try { rmSync(uploadsPath, { recursive: true, force: true }); } catch { /* already gone */ }
    },
  };
}

async function post(base, body) {
  const response = await fetch(`${base}/api/public/inquiries`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await response.json(); } catch { /* empty body */ }
  return { status: response.status, data };
}

async function login(base, username, password) {
  const response = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const cookie = (response.headers.get('set-cookie') || '').split(';')[0];
  let data = {};
  try { data = await response.json(); } catch { /* empty body */ }
  return { status: response.status, cookie, data };
}

async function admin(base, cookie, path, init) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie, ...(init?.headers || {}) },
  });
  let data = {};
  try { data = await response.json(); } catch { /* empty body */ }
  return { status: response.status, data };
}

const enquiry = (overrides = {}) => ({
  category: 'general',
  name: 'Smoke Test',
  email: 'smoke@example.com',
  contactMethod: 'email',
  message: 'Automated smoke test enquiry.',
  website: '',
  consent: true,
  ...overrides,
});

test('enquiry form smoke', async (t) => {
  const server = await startServer();
  try {
    await t.test('health check responds', async () => {
      const response = await fetch(`${server.base}/api/health`);
      assert.equal(response.status, 200);
    });

    await t.test('service catalogue is seeded with the ten real services', async () => {
      const services = await (await fetch(`${server.base}/api/public/services`)).json();
      assert.equal(services.length, 10, `expected 10 services, got ${services.length}`);
      assert.deepEqual([...services.map((row) => row.data.order)].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const slugs = services.map((row) => row.slug);
      for (const placeholder of ['service-specialist-diagnostics', 'service-molecular-referral', 'service-specimen-logistics', 'service-laboratory-solutions']) {
        assert.ok(!slugs.includes(placeholder), `placeholder service ${placeholder} should have been removed`);
      }
    });

    await t.test('contact page is served through the SPA fallback', async () => {
      const response = await fetch(`${server.base}/contact`);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /<div id="app">|<main/i);
    });

    await t.test('valid enquiry is accepted with a reference', async () => {
      const { status, data } = await post(server.base, enquiry());
      assert.equal(status, 201);
      assert.match(data.reference, /^GWB-[0-9A-F]{6}$/);
    });

    await t.test('consent is required', async () => {
      const { status, data } = await post(server.base, enquiry({ consent: undefined }));
      assert.equal(status, 400);
      assert.match(data.error, /privacy notice/i);
    });

    await t.test('honeypot submissions are silently accepted', async () => {
      const { status } = await post(server.base, enquiry({ website: 'spam.example' }));
      assert.equal(status, 202);
    });

    await t.test('submissions faster than the timing guard are silently accepted', async () => {
      const { status } = await post(server.base, enquiry({ formStartedAt: Date.now() }));
      assert.equal(status, 202);
    });

    await t.test('phone contact requires a phone number', async () => {
      const { status } = await post(server.base, enquiry({ category: 'provider', organisation: 'Test Lab', contactMethod: 'phone' }));
      assert.equal(status, 400);
    });

    await t.test('whatsapp contact accepts a phone number', async () => {
      const { status } = await post(server.base, enquiry({ category: 'patient', contactMethod: 'whatsapp', phone: '+234 801 234 5678' }));
      assert.equal(status, 201);
    });

    await t.test('admin endpoints reject anonymous access', async () => {
      const response = await fetch(`${server.base}/api/admin/inquiries`);
      assert.equal(response.status, 401);
    });

    await t.test('stored enquiries carry consent metadata', async () => {
      const { status, cookie } = await login(server.base, 'admin', 'smoke-test-password-123');
      assert.equal(status, 200);
      const list = await (await fetch(`${server.base}/api/admin/inquiries`, { headers: { cookie } })).json();
      const stored = list.find((row) => row.data.reference);
      assert.ok(stored, 'expected at least one stored enquiry');
      assert.equal(stored.data.consent, true);
      assert.ok(stored.data.consentAt, 'expected a consent timestamp');
      assert.ok(stored.data.consentVersion, 'expected a consent version');
      for (const row of list) {
        await fetch(`${server.base}/api/admin/inquiries/${row.id}`, { method: 'DELETE', headers: { cookie } });
      }
    });
  } finally {
    await server.stop();
  }
});

test('rate limiting and turnstile', async (t) => {
  const server = await startServer({
    ENQUIRY_RATE_LIMIT: '5',
    TURNSTILE_SECRET_KEY: '2x0000000000000000000000000000000AA',
  });
  try {
    await t.test('turnstile rejects a submission without a token', async () => {
      const { status, data } = await post(server.base, enquiry());
      assert.equal(status, 400);
      assert.match(data.error, /bot check/i);
    });

    await t.test('submissions are rate limited per device', async () => {
      const statuses = [];
      for (let i = 0; i < 6; i += 1) {
        statuses.push((await post(server.base, enquiry({ email: `limit-${i}@example.com` }))).status);
      }
      assert.equal(statuses.at(-1), 429, `expected the final request to be rate limited, got ${statuses.join(', ')}`);
    });
  } finally {
    await server.stop();
  }
});

test('admin accounts and audit trail', async (t) => {
  const server = await startServer();
  try {
    await t.test('the seeded administrator can sign in', async () => {
      const { status, data, cookie } = await login(server.base, 'admin', 'smoke-test-password-123');
      assert.equal(status, 200);
      assert.equal(data.role, 'admin');
      assert.ok(cookie, 'expected a session cookie');
    });

    await t.test('wrong credentials are rejected', async () => {
      const { status, data } = await login(server.base, 'admin', 'wrong-password-here');
      assert.equal(status, 401);
      assert.match(data.error, /credentials/i);
    });

    let editorId;
    await t.test('an administrator can create an editor account', async () => {
      const { cookie } = await login(server.base, 'admin', 'smoke-test-password-123');
      const { status, data } = await admin(server.base, cookie, '/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ username: 'editor.one', password: 'editor-password-123', role: 'editor' }),
      });
      assert.equal(status, 201);
      editorId = data.id;
      assert.ok(editorId, 'expected a new user id');
    });

    await t.test('duplicate usernames are rejected', async () => {
      const { cookie } = await login(server.base, 'admin', 'smoke-test-password-123');
      const { status } = await admin(server.base, cookie, '/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ username: 'editor.one', password: 'editor-password-123' }),
      });
      assert.equal(status, 409);
    });

    await t.test('the new editor can sign in', async () => {
      const { status, data } = await login(server.base, 'editor.one', 'editor-password-123');
      assert.equal(status, 200);
      assert.equal(data.role, 'editor');
    });

    await t.test('an editor cannot manage accounts or read the audit log', async () => {
      const { cookie } = await login(server.base, 'editor.one', 'editor-password-123');
      const users = await admin(server.base, cookie, '/api/admin/users');
      assert.equal(users.status, 403);
      const audit = await admin(server.base, cookie, '/api/admin/audit');
      assert.equal(audit.status, 403);
    });

    await t.test('the audit log records sign-ins', async () => {
      const { cookie } = await login(server.base, 'admin', 'smoke-test-password-123');
      const audit = await admin(server.base, cookie, '/api/admin/audit');
      assert.equal(audit.status, 200);
      const logins = audit.data.filter((row) => row.action === 'login');
      assert.ok(logins.some((row) => row.username === 'editor.one'), 'expected the editor sign-in to be audited');
      const failures = audit.data.filter((row) => row.action === 'login_failed');
      assert.ok(failures.length >= 1, 'expected the failed sign-in to be audited');
    });

    await t.test('an administrator can disable and delete an editor', async () => {
      const { cookie } = await login(server.base, 'admin', 'smoke-test-password-123');
      const disabled = await admin(server.base, cookie, `/api/admin/users/${editorId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'disabled' }),
      });
      assert.equal(disabled.status, 200);
      const blocked = await login(server.base, 'editor.one', 'editor-password-123');
      assert.equal(blocked.status, 401, 'a disabled account should not be able to sign in');
      const removed = await admin(server.base, cookie, `/api/admin/users/${editorId}`, { method: 'DELETE' });
      assert.equal(removed.status, 200);
    });

    await t.test('an administrator cannot delete their own account', async () => {
      const { cookie } = await login(server.base, 'admin', 'smoke-test-password-123');
      const users = await admin(server.base, cookie, '/api/admin/users');
      const adminUser = users.data.find((row) => row.username === 'admin');
      const removed = await admin(server.base, cookie, `/api/admin/users/${adminUser.id}`, { method: 'DELETE' });
      assert.equal(removed.status, 400);
      assert.match(removed.data.error, /own account/i);
    });

    await t.test('an administrator can remove a second administrator', async () => {
      const { cookie } = await login(server.base, 'admin', 'smoke-test-password-123');
      const created = await admin(server.base, cookie, '/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ username: 'temp.admin', password: 'temp-admin-password-123', role: 'admin' }),
      });
      assert.equal(created.status, 201);
      const removed = await admin(server.base, cookie, `/api/admin/users/${created.data.id}`, { method: 'DELETE' });
      assert.equal(removed.status, 200);
      const after = await admin(server.base, cookie, '/api/admin/users');
      assert.equal(after.data.filter((row) => row.role === 'admin').length, 1, 'one administrator should remain');
    });

    await t.test('content edits are recorded in the audit log', async () => {
      const { cookie } = await login(server.base, 'admin', 'smoke-test-password-123');
      const pages = await admin(server.base, cookie, '/api/admin/pages');
      const page = pages.data.find((row) => row.slug === 'home');
      await admin(server.base, cookie, `/api/admin/pages/${page.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...page.data, title: page.data.title }),
      });
      const audit = await admin(server.base, cookie, '/api/admin/audit');
      assert.ok(audit.data.some((row) => row.action === 'update' && row.collection === 'pages'), 'expected a page update to be audited');
    });
  } finally {
    await server.stop();
  }
});

test('team profiles', async (t) => {
  const server = await startServer();
  const seededTeam = 3;
  try {
    let memberId;
    await t.test('an administrator can create a team member', async () => {
      const { cookie } = await login(server.base, 'admin', 'smoke-test-password-123');
      const { status, data } = await admin(server.base, cookie, '/api/admin/team', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Dr Amina Bello',
          slug: 'amina-bello',
          status: 'published',
          role: 'Laboratory Lead',
          credentials: 'PhD, Molecular Biology',
          bio: 'Leads day-to-day laboratory operations and quality oversight.',
          order: 1,
        }),
      });
      assert.equal(status, 201);
      memberId = data.id;
    });

    await t.test('published team members appear on the public endpoint', async () => {
      const team = await (await fetch(`${server.base}/api/public/team`)).json();
      assert.equal(team.length, seededTeam + 1);
      const created = team.find((row) => row.id === memberId);
      assert.equal(created.title, 'Dr Amina Bello');
      assert.equal(created.data.role, 'Laboratory Lead');
    });

    await t.test('draft team members stay private', async () => {
      const { cookie } = await login(server.base, 'admin', 'smoke-test-password-123');
      await admin(server.base, cookie, '/api/admin/team', {
        method: 'POST',
        body: JSON.stringify({ title: 'Draft Person', slug: 'draft-person', status: 'draft', role: 'Trainee', order: 2 }),
      });
      const team = await (await fetch(`${server.base}/api/public/team`)).json();
      assert.equal(team.length, seededTeam + 1, 'only the published members should be public');
      const all = await admin(server.base, cookie, '/api/admin/team');
      assert.equal(all.data.length, seededTeam + 2);
    });

    await t.test('team members can be updated and deleted', async () => {
      const { cookie } = await login(server.base, 'admin', 'smoke-test-password-123');
      const updated = await admin(server.base, cookie, `/api/admin/team/${memberId}`, {
        method: 'PUT',
        body: JSON.stringify({ title: 'Dr Amina Bello', slug: 'amina-bello', status: 'published', role: 'Head of Laboratory', order: 1 }),
      });
      assert.equal(updated.status, 200);
      const team = await (await fetch(`${server.base}/api/public/team`)).json();
      assert.equal(team.find((row) => row.id === memberId).data.role, 'Head of Laboratory');
      const removed = await admin(server.base, cookie, `/api/admin/team/${memberId}`, { method: 'DELETE' });
      assert.equal(removed.status, 200);
      const after = await (await fetch(`${server.base}/api/public/team`)).json();
      assert.equal(after.length, seededTeam);
    });
  } finally {
    await server.stop();
  }
});

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);

async function upload(base, cookie, filename, body, type) {
  const response = await fetch(`${base}/api/admin/uploads?filename=${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: { 'content-type': type, ...(cookie ? { cookie } : {}) },
    body,
  });
  let data = {};
  try { data = await response.json(); } catch { /* empty body */ }
  return { status: response.status, data };
}

test('image uploads', async (t) => {
  const server = await startServer();
  try {
    await t.test('anonymous uploads are rejected', async () => {
      const { status } = await upload(server.base, '', 'photo.png', onePixelPng, 'image/png');
      assert.equal(status, 401);
    });

    await t.test('an administrator can upload an image and it is served back', async () => {
      const { cookie } = await login(server.base, 'admin', 'smoke-test-password-123');
      const { status, data } = await upload(server.base, cookie, 'photo.png', onePixelPng, 'image/png');
      assert.equal(status, 201);
      assert.match(data.url, /^\/uploads\/[a-z0-9-]+\.png$/i);
      const image = await fetch(`${server.base}${data.url}`);
      assert.equal(image.status, 200);
      assert.equal(image.headers.get('content-type'), 'image/png');
      assert.equal((await image.arrayBuffer()).byteLength, onePixelPng.length);
    });

    await t.test('unsupported file types are rejected', async () => {
      const { cookie } = await login(server.base, 'admin', 'smoke-test-password-123');
      const { status } = await upload(server.base, cookie, 'payload.svg', onePixelPng, 'image/svg+xml');
      assert.equal(status, 400);
    });
  } finally {
    await server.stop();
  }
});
