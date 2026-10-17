import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dbPath = resolve(process.env.DB_PATH || 'data/geneworldbio.sqlite');
const outDir = resolve(process.env.BACKUP_DIR || 'data/backups');
const keep = Math.max(1, Number(process.env.BACKUP_KEEP || 30) || 30);

mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = join(outDir, `geneworldbio-${stamp}.sqlite`);

const db = new DatabaseSync(dbPath);
try {
  // VACUUM INTO writes a consistent snapshot, including any pending WAL content.
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
} finally {
  db.close();
}

const backups = readdirSync(outDir)
  .filter((name) => /^geneworldbio-.*\.sqlite$/.test(name))
  .map((name) => ({ path: join(outDir, name), time: statSync(join(outDir, name)).mtimeMs }))
  .sort((a, b) => b.time - a.time);

for (const stale of backups.slice(keep)) {
  try { unlinkSync(stale.path); } catch { /* best effort */ }
}

console.log(`Backup written to ${target} (${Math.min(backups.length, keep)} of ${backups.length} kept).`);
