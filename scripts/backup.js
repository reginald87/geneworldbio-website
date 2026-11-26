import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const driver = String(process.env.DB_DRIVER || 'sqlite').toLowerCase();
const dbPath = resolve(process.env.DB_PATH || 'data/geneworldbio.sqlite');
const outDir = resolve(process.env.BACKUP_DIR || 'data/backups');
const keep = Math.max(1, Number(process.env.BACKUP_KEEP || 30) || 30);

mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const extension = driver === 'mysql' ? 'sql' : 'sqlite';
const target = join(outDir, `geneworldbio-${stamp}.${extension}`);

if (driver === 'mysql') {
  const { mysqlConnectionConfig } = await import('../server/db.js');
  const config = mysqlConnectionConfig();
  const args = [
    `--host=${config.host}`,
    `--port=${config.port}`,
    `--user=${config.user}`,
    '--single-transaction',
    '--routines',
    '--events',
    '--triggers',
    '--default-character-set=utf8mb4',
    `--result-file=${target}`,
    config.database,
  ];
  if (String(process.env.MYSQL_SSL || '').toLowerCase() === 'true') args.push('--ssl-mode=REQUIRED');
  await new Promise((resolvePromise, reject) => {
    const child = spawn('mysqldump', args, { env: { ...process.env, MYSQL_PWD: config.password }, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolvePromise() : reject(new Error(`mysqldump exited with code ${code}`)));
  });
} else {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }
}

const backups = readdirSync(outDir)
  .filter((name) => new RegExp(`^geneworldbio-.*\\.${extension}$`).test(name))
  .map((name) => ({ path: join(outDir, name), time: statSync(join(outDir, name)).mtimeMs }))
  .sort((a, b) => b.time - a.time);

for (const stale of backups.slice(keep)) {
  try { unlinkSync(stale.path); } catch { /* best effort */ }
}

console.log(`Backup written to ${target} (${Math.min(backups.length, keep)} of ${backups.length} kept).`);
