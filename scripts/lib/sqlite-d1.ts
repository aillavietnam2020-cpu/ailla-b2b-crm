/**
 * Adapter cho phép chạy đúng code Worker trên SQLite của Node (node:sqlite).
 * Dùng cho:
 *   - test tích hợp/e2e (chạy migration thật, SQL thật)
 *   - dev server dự phòng khi `wrangler dev` không chạy được trên máy (xem scripts/dev-server.ts)
 * KHÔNG dùng ở production - production luôn là Cloudflare D1.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const nodeRequire = createRequire(import.meta.url);
// node:sqlite chưa nằm trong danh sách builtin của Vite nên nạp qua createRequire.
const { DatabaseSync } = nodeRequire('node:sqlite') as typeof import('node:sqlite');
type Database = InstanceType<typeof DatabaseSync>;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

type Param = string | number | bigint | null | Uint8Array;

function normalize(params: unknown[]): Param[] {
  return params.map((value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'bigint') return value;
    if (value instanceof Uint8Array) return value;
    return JSON.stringify(value);
  });
}

export class SqliteStatement {
  constructor(
    private db: Database,
    private sql: string,
    private params: unknown[] = [],
  ) {}

  bind(...params: unknown[]): SqliteStatement {
    return new SqliteStatement(this.db, this.sql, params);
  }

  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...normalize(this.params)) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return (column ? (row[column] as T) : (row as T)) ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }> {
    return { results: this.db.prepare(this.sql).all(...normalize(this.params)) as T[], success: true };
  }

  async run(): Promise<{ success: boolean; meta: { changes: number } }> {
    const info = this.db.prepare(this.sql).run(...normalize(this.params));
    return { success: true, meta: { changes: Number(info.changes ?? 0) } };
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    const result = await this.all();
    return result.results.map((row) => Object.values(row as Record<string, unknown>)) as T[];
  }
}

export class SqliteD1 {
  constructor(private db: Database) {}

  prepare(sql: string): SqliteStatement {
    return new SqliteStatement(this.db, sql);
  }

  /** D1 batch = một transaction. */
  async batch<T = unknown>(statements: SqliteStatement[]): Promise<T[]> {
    this.db.exec('BEGIN');
    try {
      const results: unknown[] = [];
      for (const statement of statements) results.push(await statement.run());
      this.db.exec('COMMIT');
      return results as T[];
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async exec(sql: string): Promise<{ count: number }> {
    this.db.exec(sql);
    return { count: 0 };
  }

  close(): void {
    this.db.close();
  }
}

export interface CreateOptions {
  /** Đường dẫn file .sqlite; mặc định chạy trong RAM. */
  file?: string;
  /** Nạp thêm file SQL (ví dụ seed dev). */
  extraSqlFiles?: string[];
}

export function createSqliteD1(options: CreateOptions = {}): SqliteD1 {
  const db = new DatabaseSync(options.file ?? ':memory:');
  db.exec('PRAGMA foreign_keys = ON;');

  const migrationsDir = path.join(ROOT, 'migrations');
  for (const file of readdirSync(migrationsDir).filter((n) => n.endsWith('.sql')).sort()) {
    db.exec(readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
  for (const extra of options.extraSqlFiles ?? []) {
    db.exec(readFileSync(path.isAbsolute(extra) ? extra : path.join(ROOT, extra), 'utf8'));
  }
  return new SqliteD1(db);
}
