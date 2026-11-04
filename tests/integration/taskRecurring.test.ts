import { describe, expect, it } from 'vitest';
import { createTestDb } from '../helpers/d1';
import { pack, unpack } from '../../src/server/lib/pack';
import { applyRecurring, recurHit, taskRecurring } from '../../src/server/services/taskRecurring';

// 9 giờ sáng 20/10/2026 (Thứ Ba) giờ Việt Nam = 02:00 UTC
const NOW = new Date('2026-10-20T02:00:00Z');
let n = 0;
const uid = (p: string) => p + ++n;
const opts = { stamp: '09:00:00 20/10/2026', at: NOW.toISOString(), uid };

const tpls = () => [
  { id: 'tp1', ten: 'Xem doanh thu hôm qua', nguoi: 'u_chi', tao: 'u_chi', lap: 'ngay', last: '2026-06-01', hanSau: 0, gio: '08:30', theoDoi: ['u_kt'] },
  { id: 'tp2', ten: 'Báo cáo Ads tuần', nguoi: 'u_va', tao: 'u_chi', lap: 'tuan', ngay: 1, last: '2026-10-13', hanSau: 1 },
  { id: 'tp3', ten: 'Chốt số ngày 10', nguoi: 'u_kt', tao: 'u_chi', lap: 'thang', ngay: 10, last: '2026-10-19' },
  { id: 'tp4', ten: 'Gấp: kiểm kho', nguoi: 'u_kho', tao: 'u_chi', lap: 'ngay', last: '2026-10-19', dung: true },
  { id: 'tp5', ten: 'Đã giao hôm nay', nguoi: 'u_kho', tao: 'u_chi', lap: 'ngay', last: '2026-10-20' },
];

describe('việc lặp lại do máy chủ giao', () => {
  it('recurHit: hằng ngày chỉ hôm nay, tuần theo thứ, tháng theo ngày', () => {
    expect(recurHit({ id: 'a', ten: '', lap: 'ngay' }, '2026-10-19', '2026-10-20')).toBe(false);
    expect(recurHit({ id: 'a', ten: '', lap: 'ngay' }, '2026-10-20', '2026-10-20')).toBe(true);
    expect(recurHit({ id: 'a', ten: '', lap: 'tuan', ngay: 1 }, '2026-10-19', '2026-10-20')).toBe(true); // Thứ Hai
    expect(recurHit({ id: 'a', ten: '', lap: 'thang', ngay: 10 }, '2026-10-10', '2026-10-20')).toBe(true);
  });

  it('hằng ngày không bù ngày cũ, tuần bù thứ Hai bị lỡ, tạm dừng / đã giao hôm nay thì bỏ qua; chạy lại không giao trùng', () => {
    const d = { tasks: [] as Record<string, unknown>[], taskTpl: tpls(), notifs: [] };
    const r = applyRecurring(d, '2026-10-20', '2026-10', opts);
    expect(r.created).toBe(2);
    expect(d.tasks.find((t) => t.tpl === 'tp1')).toMatchObject({ han: 20, bd: 20, gio: '08:30', theoDoi: ['u_kt'], st: 'todo', tao: 'u_chi', gap: false });
    expect(d.tasks.find((t) => t.tpl === 'tp2')).toMatchObject({ han: 20, bd: 19 });
    expect(d.taskTpl.find((p) => p.id === 'tp4')!.last).toBe('2026-10-19');
    expect(d.taskTpl.find((p) => p.id === 'tp1')!.last).toBe('2026-10-20');
    expect(d.notifs.length).toBe(2);
    expect(applyRecurring(d, '2026-10-20', '2026-10', opts).created).toBe(0);
  });

  it('taskRecurring ghi vào dữ liệu chung một lần trong ngày', async () => {
    const db = createTestDb();
    await db
      .prepare("INSERT INTO hub_state (id, version, data, updated_at) VALUES ('main', 1, ?, ?)")
      .bind(await pack(JSON.stringify({ cards: [{ thang: '2026-10' }], tasks: [], taskTpl: tpls() })), 'x')
      .run();
    expect(await taskRecurring(db as unknown as D1Database, NOW)).toMatchObject({ created: 2 });
    expect(await taskRecurring(db as unknown as D1Database, NOW)).toMatchObject({ created: 0 });
    const row = await db.prepare("SELECT version, data FROM hub_state WHERE id = 'main'").first<{ version: number; data: string }>();
    expect(row!.version).toBe(2);
    expect(JSON.parse(await unpack(row!.data)).tasks.length).toBe(2);
  });
});
