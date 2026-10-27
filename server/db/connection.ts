import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<{ rowCount: number }>;
}

let pgPool: pg.Pool | null = null;
let sqliteDb: any = null;
export let isPostgres = false;

const rawDbUrl = process.env.DATABASE_URL?.trim() || '';

if (rawDbUrl.startsWith('postgres://') || rawDbUrl.startsWith('postgresql://')) {
  isPostgres = true;
  pgPool = new pg.Pool({
    connectionString: rawDbUrl,
    ssl: rawDbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000
  });
} else {
  // Use built-in node:sqlite
  const { DatabaseSync } = (await import('node:sqlite')) as any;
  const dbDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbFile = rawDbUrl.replace(/^sqlite:/, '') || path.join(dbDir, 'crm.sqlite');
  sqliteDb = new DatabaseSync(dbFile);
  // Enable foreign keys, WAL mode, and busy timeout for smooth concurrency
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
  try {
    sqliteDb.exec('PRAGMA journal_mode = WAL;');
    sqliteDb.exec('PRAGMA busy_timeout = 5000;');
  } catch {}
}

function convertSqlAndParamsForSqlite(sql: string, params: any[]): { sql: string; params: any[] } {
  const newParams: any[] = [];
  const convertedSql = sql.replace(/\$(\d+)/g, (_, idxStr) => {
    const index = parseInt(idxStr, 10) - 1;
    newParams.push(params[index]);
    return '?';
  });
  return { sql: convertedSql, params: newParams };
}

export const db: DbClient = {
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (isPostgres && pgPool) {
      const res = await pgPool.query(sql, params);
      return res.rows as T[];
    } else {
      const { sql: converted, params: mappedParams } = convertSqlAndParamsForSqlite(sql, params);
      const stmt = sqliteDb.prepare(converted);
      // Clean params for sqlite (boolean to 0/1 or string)
      const cleanParams = mappedParams.map(p => (p instanceof Date ? p.toISOString() : p));
      return stmt.all(...cleanParams) as T[];
    }
  },

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  },

  async execute(sql: string, params: any[] = []): Promise<{ rowCount: number }> {
    if (isPostgres && pgPool) {
      const res = await pgPool.query(sql, params);
      return { rowCount: res.rowCount ?? 0 };
    } else {
      const { sql: converted, params: mappedParams } = convertSqlAndParamsForSqlite(sql, params);
      const stmt = sqliteDb.prepare(converted);
      const cleanParams = mappedParams.map(p => (p instanceof Date ? p.toISOString() : p));
      const info = stmt.run(...cleanParams);
      return { rowCount: info.changes ?? 0 };
    }
  }
};

export async function transaction<T>(callback: (client: DbClient) => Promise<T>): Promise<T> {
  if (isPostgres && pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const txClient: DbClient = {
        async query<R = any>(sql: string, params: any[] = []): Promise<R[]> {
          const res = await client.query(sql, params);
          return res.rows as R[];
        },
        async queryOne<R = any>(sql: string, params: any[] = []): Promise<R | null> {
          const rows = await this.query<R>(sql, params);
          return rows.length > 0 ? rows[0] : null;
        },
        async execute(sql: string, params: any[] = []): Promise<{ rowCount: number }> {
          const res = await client.query(sql, params);
          return { rowCount: res.rowCount ?? 0 };
        }
      };
      const result = await callback(txClient);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    // SQLite transaction
    sqliteDb.exec('BEGIN TRANSACTION;');
    try {
      const result = await callback(db);
      sqliteDb.exec('COMMIT;');
      return result;
    } catch (err) {
      sqliteDb.exec('ROLLBACK;');
      throw err;
    }
  }
}

export async function initDatabase(): Promise<void> {
  const schemaPath = path.resolve(process.cwd(), 'server', 'db', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  if (isPostgres && pgPool) {
    // Run schema
    try { await pgPool.query(schemaSql); } catch {}
    // Ensure new columns exist for existing tables
    const alterQueries = [
      'ALTER TABLE leads ADD COLUMN IF NOT EXISTS amount NUMERIC NOT NULL DEFAULT 0;',
      "ALTER TABLE leads ADD COLUMN IF NOT EXISTS temperature VARCHAR(32) NOT NULL DEFAULT 'cold';",
      "ALTER TABLE leads ADD COLUMN IF NOT EXISTS manager VARCHAR(255) NOT NULL DEFAULT '';",
      'ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_call_at TIMESTAMP;',
      "ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_status VARCHAR(32) NOT NULL DEFAULT 'none';"
    ];
    for (const q of alterQueries) {
      try { await pgPool.query(q); } catch {}
    }
  } else {
    // Safely add columns first if table exists
    const alterColumns = [
      'ALTER TABLE leads ADD COLUMN amount NUMERIC NOT NULL DEFAULT 0',
      "ALTER TABLE leads ADD COLUMN temperature VARCHAR(32) NOT NULL DEFAULT 'cold'",
      "ALTER TABLE leads ADD COLUMN manager VARCHAR(255) NOT NULL DEFAULT ''",
      'ALTER TABLE leads ADD COLUMN next_call_at TEXT',
      "ALTER TABLE leads ADD COLUMN call_status VARCHAR(32) NOT NULL DEFAULT 'none'"
    ];
    for (const q of alterColumns) {
      try {
        sqliteDb.exec(q);
      } catch (e: any) {
        // Ignored if column already exists or table doesn't exist yet
      }
    }
    // Now execute schema
    sqliteDb.exec(schemaSql);
  }
  console.log(`[Database] Initialized schema successfully using ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);
}
