import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { createDb } from '../server/db.js';

const sourcePath = resolve(process.env.DB_PATH || 'data/geneworldbio.sqlite');
const source = new DatabaseSync(sourcePath);
process.env.DB_DRIVER = 'mysql';
const target = await createDb();

const quote = (identifier) => `\`${identifier}\``;
const tables = {
  content: ['id', 'collection', 'title', 'slug', 'status', 'data', 'created_at', 'updated_at'],
  meta: ['key', 'value'],
  users: ['id', 'username', 'password_hash', 'role', 'status', 'created_at', 'last_login_at', 'updated_at'],
  audit_logs: ['id', 'user_id', 'username', 'action', 'collection', 'record_id', 'ip', 'user_agent', 'metadata', 'created_at'],
  sessions: ['token', 'user_id', 'username', 'role', 'expires', 'created_at'],
};

try {
  for (const [table, columns] of Object.entries(tables)) {
    const rows = source.prepare(`SELECT ${columns.map(quote).join(', ')} FROM ${quote(table)}`).all();
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT IGNORE INTO ${quote(table)} (${columns.map(quote).join(', ')}) VALUES (${placeholders})`;
    for (const row of rows) {
      await target.run(sql, ...columns.map((column) => row[column] ?? null));
    }
    console.log(`${table}: ${rows.length} row(s) copied.`);
  }
} finally {
  source.close();
  await target.close();
}

console.log(`SQLite migration from ${sourcePath} completed.`);
