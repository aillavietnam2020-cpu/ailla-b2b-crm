import type { Env } from '../env';

/**
 * Khoá cửa Cloudflare Access của qt.ailla.vn: danh sách email được vào = mọi tài khoản đang hoạt động.
 * Thêm tài khoản → email được thêm; khoá tài khoản → email bị rút ra. CEO tự làm trên Trang quản trị,
 * không phải vào Cloudflare. Cần: CF_ACCOUNT_ID, ACCESS_POLICY_ID (biến) và CF_ACCESS_TOKEN (secret,
 * mã khoá chỉ có quyền "Access: Apps and Policies Edit"). Thiếu cấu hình thì bỏ qua, không báo lỗi.
 */
export async function syncAccessEmails(env: Env): Promise<{ ok: boolean; count?: number; error?: string }> {
  if (!env.CF_ACCESS_TOKEN || !env.CF_ACCOUNT_ID || !env.ACCESS_POLICY_ID) return { ok: false, error: 'chưa cấu hình' };
  const rows = await env.DB.prepare(
    "SELECT DISTINCT lower(email) AS email FROM users WHERE status = 'ACTIVE' AND deleted_at IS NULL ORDER BY 1",
  ).all<{ email: string }>();
  const emails = (rows.results ?? []).map((r) => r.email).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  if (!emails.length) return { ok: false, error: 'không có email' }; // không bao giờ để danh sách rỗng (khoá cả CEO)
  // Chính sách gắn riêng vào ứng dụng (có ACCESS_APP_ID) hoặc chính sách dùng chung của tài khoản.
  const base = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/access`;
  const url = env.ACCESS_APP_ID
    ? `${base}/apps/${env.ACCESS_APP_ID}/policies/${env.ACCESS_POLICY_ID}`
    : `${base}/policies/${env.ACCESS_POLICY_ID}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${env.CF_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Nhan su AILLA (tu cap nhat tu Trang quan tri)',
      decision: 'allow',
      include: emails.map((email) => ({ email: { email } })),
      exclude: [],
      require: [],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('[access-sync]', res.status, text.slice(0, 300));
    return { ok: false, error: `Cloudflare báo lỗi ${res.status}` };
  }
  return { ok: true, count: emails.length };
}
