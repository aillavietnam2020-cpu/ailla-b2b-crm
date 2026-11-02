import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

const form = (name: string, type: string, bytes: number) => {
  const f = new FormData();
  f.set('task', 'cv_test');
  f.set('file', new File([new Uint8Array(bytes).fill(7)], name, { type }));
  return f;
};

describe('File đính kèm Task giao việc (/api/hub/task-files)', () => {
  it('chưa có quyền vào web vận hành thì không tải lên được', async () => {
    const res = await ctx.request('/api/hub/task-files', { as: USERS.thao, method: 'POST', formData: form('a.png', 'image/png', 10) });
    expect(res.status).toBe(403);
  });

  it('tải lên, mở lại đúng nội dung, chặn loại lạ và file quá to; chỉ người tải hoặc CEO được xóa', async () => {
    await ctx.request('/api/admin/users/user-thao/marketing', { as: USERS.ceo, body: { mode: 'with_b2b' } });
    const up = await ctx.request('/api/hub/task-files', { as: USERS.ceo, method: 'POST', formData: form('ket-qua.png', 'image/png', 1234) });
    expect(up.status).toBe(200);
    const id = up.body.data.id as string;

    const get = await ctx.app.fetch(new Request(`http://local/api/hub/task-files/${id}`, { headers: { 'X-Dev-Email': USERS.thao } }), ctx.env);
    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toBe('image/png');
    expect((await get.arrayBuffer()).byteLength).toBe(1234);

    const bad = await ctx.request('/api/hub/task-files', { as: USERS.thao, method: 'POST', formData: form('x.exe', 'application/x-msdownload', 10) });
    expect(bad.status).toBe(400);
    const big = await ctx.request('/api/hub/task-files', { as: USERS.thao, method: 'POST', formData: form('to.jpg', 'image/jpeg', 1_700_000) });
    expect(big.status).toBe(400);

    const delOther = await ctx.request(`/api/hub/task-files/${id}`, { as: USERS.thao, method: 'DELETE' });
    expect(delOther.status).toBe(403);
    const del = await ctx.request(`/api/hub/task-files/${id}`, { as: USERS.ceo, method: 'DELETE' });
    expect(del.status).toBe(200);
  });
});
