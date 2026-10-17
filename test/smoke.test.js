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
  const child = spawn(node, [serverEntry], {
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
      ADMIN_PASSWORD: 'smoke-test-password-123',
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
      const login = await fetch(`${server.base}/api/admin/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'smoke-test-password-123' }),
      });
      assert.equal(login.status, 200);
      const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
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
