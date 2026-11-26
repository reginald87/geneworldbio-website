import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const sqliteSchema = [
  `CREATE TABLE IF NOT EXISTS content (
    id TEXT PRIMARY KEY,
    collection TEXT NOT NULL,
    title TEXT NOT NULL,
    slug TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  'CREATE INDEX IF NOT EXISTS content_collection ON content(collection, created_at)',
  'CREATE TABLE IF NOT EXISTS meta (`key` TEXT PRIMARY KEY, value TEXT NOT NULL)',
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
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
  )`,
  'CREATE INDEX IF NOT EXISTS audit_logs_created ON audit_logs(created_at)',
  'CREATE INDEX IF NOT EXISTS audit_logs_user ON audit_logs(user_id)',
  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    role TEXT NOT NULL,
    expires INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  'CREATE INDEX IF NOT EXISTS sessions_expires ON sessions(expires)',
];

const mysqlSchema = [
  `CREATE TABLE IF NOT EXISTS content (
    id VARCHAR(64) PRIMARY KEY,
    collection VARCHAR(40) NOT NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    data LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX content_collection (collection, created_at)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS meta (
    \`key\` VARCHAR(255) PRIMARY KEY,
    value LONGTEXT NOT NULL
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'admin',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    username VARCHAR(64),
    action VARCHAR(64) NOT NULL,
    collection VARCHAR(40),
    record_id VARCHAR(64),
    ip VARCHAR(64),
    user_agent TEXT,
    metadata LONGTEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX audit_logs_created (created_at),
    INDEX audit_logs_user (user_id)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    username VARCHAR(64) NOT NULL,
    role VARCHAR(20) NOT NULL,
    expires BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX sessions_expires (expires)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
];

function mysqlSql(sql) {
  return String(sql)
    .replace(/\bINSERT OR IGNORE\b/gi, 'INSERT IGNORE')
    .replace(/^\s*BEGIN\s*$/i, 'START TRANSACTION');
}

async function createSqliteDb() {
  const { DatabaseSync } = await import('node:sqlite');
  const dbPath = resolve(process.env.DB_PATH || 'data/geneworldbio.sqlite');
  mkdirSync(dirname(dbPath), { recursive: true });
  const raw = new DatabaseSync(dbPath);
  const db = {
    driver: 'sqlite',
    async exec(sql) { raw.exec(sql); },
    async get(sql, ...params) { return raw.prepare(sql).get(...params) ?? null; },
    async all(sql, ...params) { return raw.prepare(sql).all(...params); },
    async run(sql, ...params) {
      const result = raw.prepare(sql).run(...params);
      return { changes: result.changes, insertId: Number(result.lastInsertRowid ?? 0) };
    },
    async close() { raw.close(); },
  };
  for (const statement of sqliteSchema) await db.exec(statement);
  return db;
}

async function createMysqlDb() {
  const { default: mysql } = await import('mysql2/promise');
  const poolOptions = {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'geneworldbio',
    waitForConnections: true,
    connectionLimit: Math.max(1, Number(process.env.MYSQL_CONNECTION_LIMIT || 10) || 10),
    charset: 'utf8mb4',
    dateStrings: true,
    timezone: 'Z',
    multipleStatements: true,
  };
  if (String(process.env.MYSQL_SSL || '').toLowerCase() === 'true') {
    poolOptions.ssl = { rejectUnauthorized: String(process.env.MYSQL_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false' };
  }
  const pool = mysql.createPool(poolOptions);
  const db = {
    driver: 'mysql',
    async exec(sql) { await pool.query(mysqlSql(sql)); },
    async get(sql, ...params) {
      const [rows] = await pool.execute(mysqlSql(sql), params);
      return rows[0] ?? null;
    },
    async all(sql, ...params) {
      const [rows] = await pool.execute(mysqlSql(sql), params);
      return rows;
    },
    async run(sql, ...params) {
      const [result] = await pool.execute(mysqlSql(sql), params);
      return { changes: result.affectedRows, insertId: Number(result.insertId || 0) };
    },
    async close() { await pool.end(); },
  };
  await db.exec('SELECT 1');
  for (const statement of mysqlSchema) await db.exec(statement);
  return db;
}

export async function createDb() {
  const driver = String(process.env.DB_DRIVER || 'sqlite').toLowerCase();
  if (driver === 'sqlite') return createSqliteDb();
  if (driver === 'mysql' || driver === 'mysql2') return createMysqlDb();
  throw new Error(`Unsupported DB_DRIVER "${driver}". Use "sqlite" or "mysql".`);
}

export function mysqlConnectionConfig() {
  return {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'geneworldbio',
  };
}
