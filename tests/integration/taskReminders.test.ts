import { describe, expect, it } from 'vitest';
import { createTestDb } from '../helpers/d1';
import { pack, unpack } from '../../src/server/lib/pack';
import { buildDigest, taskReminders } from '../../src/server/services/taskReminders';

// 8 giờ sáng 20/10/2026 giờ Việt Nam = 01:00 UTC
const MORNING = new Date('2026-10-20T01:00:00Z');

async function seed(data: unknown) {
  const db = createTestDb();
  await db
    .prepare("INSERT INTO hub_state (id, version, data, updated_at) VALUES ('main', 1, ?, ?)")
    .bind(await pack(JSON.stringify(data)), '2026-10-19T00:00:00Z')
    .run();
  return db;
}
const read = async (db: ReturnType<typeof createTestDb>) => {
  const row = await db.prepare("SELECT version, data FROM hub_state WHERE id = 'main'").first<{ version: number; data: string }>();
  return { version: row!.version, d: JSON.parse(await unpack(row!.data)) };
};

const base = () => ({
  cards: [{ thang: '2026-10' }],
  users: [
    { id: 'u_chi', name: 'Chị Hoa', role: 'admin', active: true },
    { id: 'u_may', name: 'Mây', role: 'content', active: true },
    { id: 'u_oanh', name: 'Oanh', role: 'lead', active: true },
  ],
  tasks: [
    { id: 'cv1', ten: 'Gửi footage', nguoi: 'u_may', tao: 'u_chi', han: 17, st: 'doing' },
    { id: 'cv2', ten: 'Kịch bản', nguoi: 'u_may', tao: 'u_oanh', han: 25, st: 'review' },
    { id: 'cv3', ten: 'Đã xong', nguoi: 'u_may', tao: 'u_chi', han: 10, st: 'done' },
  ],
});

describe('nhắc việc Task mỗi sáng', () => {
  it('chưa tới 8 giờ thì không làm gì', async () => {
    const db = await seed(base());
    const r = await taskReminders(db as unknown as D1Database, new Date('2026-10-20T03:00:00Z'));
    expect(r.skipped).toBeTruthy();
  });

  it('báo trễ cho người làm, người giao; chờ duyệt cho người giao; tóm tắt cho chị; chạy lại không báo trùng', async () => {
    const db = await seed(base());
    const r = await taskReminders(db as unknown as D1Database, MORNING);
    expect(r).toMatchObject({ late: 1, review: 1 });
    const { d } = await read(db);
    const to = (id: string) => d.notifs.filter((n: { to: string }) => n.to === id).map((n: { text: string }) => n.text);
    expect(to('u_may').some((t: string) => t.includes('Trễ 3 ngày: Gửi footage'))).toBe(true);
    expect(to('u_chi').some((t: string) => t.startsWith('Sáng nay: 1 việc trễ hạn (Mây 1)'))).toBe(true);
    expect(to('u_oanh').some((t: string) => t.includes('đang chờ bạn duyệt'))).toBe(true);
    expect(to('u_may').some((t: string) => t.includes('Đã xong'))).toBe(false);

    const again = await taskReminders(db as unknown as D1Database, MORNING);
    expect(again).toMatchObject({ changed: 0 });
  });

  it('đến hạn: báo Lead team; Lead tự làm thì không báo CEO; team chưa có Lead thì báo CEO', async () => {
    const data = base();
    data.users.push({ id: 'u_kt', name: 'Kế toán', role: 'nhanvien', active: true, phongBan: 'KT' } as never);
    data.tasks = [
      { id: 'a', ten: 'Việc Mây', nguoi: 'u_may', tao: 'u_may', han: 20, st: 'doing' },
      { id: 'b', ten: 'Lead tự giao', nguoi: 'u_oanh', tao: 'u_oanh', han: 20, st: 'doing' },
      { id: 'c', ten: 'Việc kế toán', nguoi: 'u_kt', tao: 'u_kt', han: 20, st: 'doing' },
    ];
    const db = await seed(data);
    await taskReminders(db as unknown as D1Database, MORNING);
    const { d } = await read(db);
    const to = (id: string) => d.notifs.filter((n: { to: string }) => n.to === id).map((n: { text: string }) => n.text).join('|');
    expect(to('u_oanh')).toContain('Việc Mây');
    expect(to('u_chi')).not.toContain('Việc Mây');
    expect(to('u_chi')).not.toContain('Lead tự giao');
    expect(to('u_chi')).toContain('Việc kế toán');
  });

  it('dữ liệu tháng khác thì bỏ qua', async () => {
    const data = base();
    data.cards = [{ thang: '2026-09' }];
    const db = await seed(data);
    expect((await taskReminders(db as unknown as D1Database, MORNING)).skipped).toBeTruthy();
  });
});

describe('Trợ lý công việc nhắn vào Tin nhắn mỗi sáng', () => {
  const withCrm = () => {
    const d = base();
    d.users = d.users.map((u) => ({ ...u, crm: 'c_' + u.id.slice(2) })) as never;
    d.users.push({ id: 'u_td', name: 'Kế toán theo dõi', role: 'nhanvien', active: true, crm: 'c_td' } as never);
    d.tasks = [
      { id: 'a', ten: 'Gửi footage', nguoi: 'u_may', tao: 'u_chi', han: 17, st: 'doing', theoDoi: ['u_td'] },
      { id: 'b', ten: 'Xem doanh thu hôm qua', nguoi: 'u_may', tao: 'u_may', han: 20, st: 'todo', gio: '08:30', tpl: 'tp1' },
      { id: 'c', ten: 'Gấp: quay 5 video', nguoi: 'u_may', tao: 'u_oanh', han: 20, st: 'todo', gap: true },
      { id: 'd', ten: 'Viết kịch bản mai', nguoi: 'u_may', tao: 'u_oanh', han: 21, st: 'todo' },
      { id: 'e', ten: 'Banner sale', nguoi: 'u_oanh', tao: 'u_chi', han: 22, st: 'review' },
    ] as never;
    return d;
  };
  const msgs = async (db: ReturnType<typeof createTestDb>) =>
    (await db.prepare("SELECT room, user_id, body FROM chat_msgs WHERE user_id = 'sys-congviec' ORDER BY id").all<{ room: string; user_id: string; body: string }>()).results ?? [];

  it('buildDigest: quá hạn, hôm nay theo giờ (gấp lên đầu, định kỳ), mai; người theo dõi không nhận; CEO có tóm tắt', () => {
    const d = withCrm();
    const b = buildDigest(d as never, 'u_may', 20, '2026-10')!;
    expect(b).toContain('Việc ngày 20/10');
    expect(b).toContain('⚠ Quá hạn (1)\n• Gửi footage · trễ 3 ngày');
    expect(b).toContain('Hôm nay (2)\n• [GẤP] Gấp: quay 5 video\n• 08:30 Xem doanh thu hôm qua · định kỳ');
    expect(b).toContain('Mai: 1 việc (Viết kịch bản mai)');
    expect(buildDigest(d as never, 'u_td', 20, '2026-10')).toBeNull();
    const ceo = buildDigest(d as never, 'u_chi', 20, '2026-10')!;
    expect(ceo).toContain('Chờ bạn duyệt (1)\n• Banner sale · Oanh');
    expect(ceo).toContain('Việc CEO giao đang trễ (1)\n• Gửi footage · Mây · trễ 3 ngày');
    expect(ceo).toContain('Cả công ty: 1 việc trễ hạn (Mây 1)');
  });

  it('gửi một tin cho mỗi người có việc vào phòng riêng với trợ lý, chạy lại không gửi trùng', async () => {
    const db = await seed(withCrm());
    const r = await taskReminders(db as unknown as D1Database, MORNING);
    expect(r.messaged).toBe(2);
    const L = await msgs(db);
    expect(L.map((m) => m.room).sort()).toEqual(['dm:c_chi~sys-congviec', 'dm:c_may~sys-congviec']);
    const again = await taskReminders(db as unknown as D1Database, MORNING);
    expect(again.messaged).toBe(0);
    expect((await msgs(db)).length).toBe(2);
  });

  it('tắt ở Cấu hình thì không nhắn (chuông vẫn chạy); đổi giờ gửi thì chạy theo giờ mới', async () => {
    const db = await seed(withCrm());
    await db
      .prepare("INSERT INTO app_settings (key, value_json, version, updated_by, updated_at) VALUES ('task.reminder', ?, 1, NULL, 'x')")
      .bind(JSON.stringify({ on: false, hour: 8 }))
      .run();
    const r = await taskReminders(db as unknown as D1Database, MORNING);
    expect(r.messaged).toBe(0);
    expect(r.late).toBe(1);
    await db.prepare("UPDATE app_settings SET value_json = ? WHERE key = 'task.reminder'").bind(JSON.stringify({ on: true, hour: 9 })).run();
    expect((await taskReminders(db as unknown as D1Database, MORNING)).skipped).toBeTruthy();
    const r9 = await taskReminders(db as unknown as D1Database, new Date('2026-10-20T02:00:00Z'));
    expect(r9.messaged).toBe(2);
  });
});
