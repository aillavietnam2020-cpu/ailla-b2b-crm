/**
 * Test dùng lại đúng adapter SQLite của dev server: cùng migration, cùng SQL, cùng logic backend.
 */
export { SqliteD1 as TestD1, createSqliteD1 } from '../../scripts/lib/sqlite-d1';
import { createSqliteD1, type SqliteD1 } from '../../scripts/lib/sqlite-d1';

export function createTestDb(): SqliteD1 {
  return createSqliteD1();
}
