import { describe, expect, it } from 'vitest';
import { createTestDb } from '../helpers/d1';
import { pack, unpack } from '../../src/server/lib/pack';
import { taskReminders } from '../../src/server/services/taskReminders';

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

  it('dữ liệu tháng khác thì bỏ qua', async () => {
    const data = base();
    data.cards = [{ thang: '2026-09' }];
    const db = await seed(data);
    expect((await taskReminders(db as unknown as D1Database, MORNING)).skipped).toBeTruthy();
  });
});
