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
const { DatabaseSync } = nodeRequire('node:sqlite');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function normalize(params) {
    return params.map((value) => {
        if (value === undefined || value === null)
            return null;
        if (typeof value === 'boolean')
            return value ? 1 : 0;
        if (typeof value === 'number' || typeof value === 'string' || typeof value === 'bigint')
            return value;
        if (value instanceof Uint8Array)
            return value;
        return JSON.stringify(value);
    });
}
export class SqliteStatement {
    db;
    sql;
    params;
    constructor(db, sql, params = []) {
        this.db = db;
        this.sql = sql;
        this.params = params;
    }
    bind(...params) {
        return new SqliteStatement(this.db, this.sql, params);
    }
    async first(column) {
        const row = this.db.prepare(this.sql).get(...normalize(this.params));
        if (!row)
            return null;
        return (column ? row[column] : row) ?? null;
    }
    async all() {
        return { results: this.db.prepare(this.sql).all(...normalize(this.params)), success: true };
    }
    async run() {
        const info = this.db.prepare(this.sql).run(...normalize(this.params));
        return { success: true, meta: { changes: Number(info.changes ?? 0), last_row_id: Number(info.lastInsertRowid ?? 0) } };
    }
    async raw() {
        const result = await this.all();
        return result.results.map((row) => Object.values(row));
    }
}
export class SqliteD1 {
    db;
    constructor(db) {
        this.db = db;
    }
    prepare(sql) {
        return new SqliteStatement(this.db, sql);
    }
    /** D1 batch = một transaction. */
    async batch(statements) {
        this.db.exec('BEGIN');
        try {
            const results = [];
            for (const statement of statements)
                results.push(await statement.run());
            this.db.exec('COMMIT');
            return results;
        }
        catch (error) {
            this.db.exec('ROLLBACK');
            throw error;
        }
    }
    async exec(sql) {
        this.db.exec(sql);
        return { count: 0 };
    }
    close() {
        this.db.close();
    }
}
export function createSqliteD1(options = {}) {
    const db = new DatabaseSync(options.file ?? ':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    // File đã có dữ liệu (mở lại dev server) thì không chạy lại migration; muốn làm mới dùng --fresh.
    const existing = db.prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
    const migrationsDir = path.join(ROOT, 'migrations');
    for (const file of existing ? [] : readdirSync(migrationsDir).filter((n) => n.endsWith('.sql')).sort()) {
        db.exec(readFileSync(path.join(migrationsDir, file), 'utf8'));
    }
    for (const extra of options.extraSqlFiles ?? []) {
        db.exec(readFileSync(path.isAbsolute(extra) ? extra : path.join(ROOT, extra), 'utf8'));
    }
    return new SqliteD1(db);
}
