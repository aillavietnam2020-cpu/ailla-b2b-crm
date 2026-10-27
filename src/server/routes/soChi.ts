import { Hono } from 'hono';
import { z } from 'zod';
import { nowIso, vnDate } from '@shared/datetime';
import { zodFieldErrors } from '@shared/schemas';
import type { AppEnv, AuthContext } from '../env';
import { auditStatement, clientIp } from '../lib/audit';
import { badRequest, conflict, forbidden, ok, unprocessable } from '../lib/http';
import { newId } from '../lib/ids';
import { pack, unpack } from '../lib/pack';
import { neutralizeTags } from '../lib/stateGuard';
import { agentSpendGuard, type SpendRow } from '../services/agentSpend';

/**
 * Phiếu chi loại "Chi phí khác" của Sổ chi phí, ghi từ máy chủ (dùng cho agent Kế toán trưởng làm theo lệnh chị Thảo).
 * Trên web, form "＋ Ghi phiếu chi" vẫn ghi thẳng từ trình duyệt (hub/src/sochi.js scForm); đường này ghi ĐÚNG dòng như form đó
 * vào hàng chờ duyệt (d.pcCho, nhãn "Chờ duyệt"): chị Huệ duyệt rồi mới vào sổ, khoản từ ngưỡng chi thì chị Huệ duyệt xong chuyển chị Hoa.
 * Không bao giờ ghi thẳng vào sổ (không tự duyệt).
 */
export const soChiRoutes = new Hono<AppEnv>();

const canWrite = (a: AuthContext) =>
  a.user.role === 'CEO' || a.permissions.includes('order.approve.normal') || a.permissions.includes('order.accounting.confirm');

const schema = z.object({
  pay_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày chi dạng YYYY-MM-DD'),
  amount: z.number().int('Số tiền là số nguyên (đồng)').min(1, 'Số tiền phải lớn hơn 0').max(10_000_000_000),
  content: z.string().trim().min(3, 'Ghi rõ chi cho việc gì').max(300),
  payee: z.string().trim().min(1, 'Ghi người nhận tiền').max(120),
  requester: z.string().trim().max(80).optional().default(''),
  department: z.string().trim().max(80).optional().default(''),
  method: z.enum(['CHUYEN_KHOAN', 'TIEN_MAT']).default('CHUYEN_KHOAN'),
  from_account: z.string().trim().max(160).optional().default(''),
  to_account: z.string().trim().max(160).optional().default(''),
  group: z.string().trim().max(20).optional().default(''),
  channel: z.string().trim().max(40).optional().default('Chung'),
  note: z.string().trim().max(600).optional().default(''),
});

type Row = Record<string, unknown> & { d?: string; t?: number; ct?: string; nn?: string; tkn?: string };
type Hub = { pcCho?: Row[]; activity?: unknown[] } & Record<string, unknown>;

async function readRow(db: D1Database, id: string) {
  const r = await db.prepare('SELECT version, data FROM hub_state WHERE id = ?').bind(id).first<{ version: number; data: string }>();
  return r ? { version: r.version, d: JSON.parse(await unpack(r.data)) as Hub } : null;
}

const asSpend = (r: Row): SpendRow => ({ no: String(r.ct ?? ''), date: String(r.d ?? ''), amount: Number(r.t ?? 0), payees: [String(r.nn ?? ''), String(r.tkn ?? '')] });

/** Số phiếu PC-YYYY-MM-xxxx, đếm như trình duyệt (sổ + hàng chờ). */
const nextNo = (date: string, rows: Row[]) => {
  const ym = date.slice(0, 7);
  return `PC-${ym}-${String(rows.filter((x) => String(x.ct ?? '').startsWith('PC-' + ym)).length + 1).padStart(4, '0')}`;
};

soChiRoutes.post('/phieu-chi', async (c) => {
  const auth = c.get('auth');
  if (!canWrite(auth)) throw forbidden('Chỉ CEO, quản lý điều phối hoặc kế toán ghi được phiếu chi');
  const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw unprocessable('VALIDATION_FAILED', 'Phiếu chi chưa hợp lệ', zodFieldErrors(parsed.error));
  const b = parsed.data;
  if (b.pay_date > vnDate()) throw badRequest('DATE_FUTURE', 'Ngày chi không được sau hôm nay');
  if (/^chi ph[ií]$/i.test(b.content)) throw badRequest('BAD_CONTENT', 'Ghi rõ chi cho việc gì, không ghi mỗi chữ "Chi phí"');
  if (b.method === 'CHUYEN_KHOAN' && !b.from_account) throw badRequest('NEED_FROM', 'Chuyển khoản: ghi tài khoản công ty chi tiền');

  for (let attempt = 0; attempt < 4; attempt++) {
    const main = await readRow(c.env.DB, 'main');
    if (!main) throw conflict('NO_HUB', 'Trang quản trị chưa khởi tạo dữ liệu');
    const fin = ((await readRow(c.env.DB, 'secure'))?.d.fin ?? {}) as { nkc?: Row[] };
    const all = [...(fin.nkc ?? []), ...(main.d.pcCho ?? [])];
    const src = await agentSpendGuard(c.env.DB, auth, 'CP', { date: b.pay_date, amount: b.amount, payees: [b.payee, b.to_account] }, async () => all.map(asSpend));
    const ck = b.method === 'CHUYEN_KHOAN';
    const ct = nextNo(b.pay_date, all);
    const now = Date.now();
    const by = src ? `Agent ${src.agent} (theo lệnh ${src.by})` : auth.user.display_name;
    const row = neutralizeTags({
      id: 'pc' + newId().replace(/-/g, '').slice(-10).toLowerCase(),
      tkc: ck ? b.from_account : '',
      tkn: ck ? b.to_account : '',
      d: b.pay_date,
      ct,
      lct: 'Phiếu chi',
      dg: b.content,
      tk: ck ? '1121' : '1111',
      t: b.amount,
      g: b.group,
      k: b.channel || 'Chung',
      gc: src ? `${src.source} ${b.note}`.trim() : b.note,
      dn: b.requester,
      bp: b.department,
      nn: b.payee,
      ht: ck ? 'Chuyển khoản' : 'Tiền mặt',
      src: 'phieu',
      by,
      at: now,
      st: 'Chờ duyệt',
      ...(src ? { agent: src.agent, theoLenh: src.by, agentAt: src.at } : {}),
    });
    const d = main.d;
    (d.pcCho = d.pcCho ?? []).push(row);
    const vn = new Date(now + 7 * 3_600_000).toISOString();
    d.activity = [{ t: vn.slice(11, 16), d: `${vn.slice(8, 10)}/${vn.slice(5, 7)}/${vn.slice(0, 4)}`, who: by, msg: 'ghi phiếu chi chờ duyệt ' + ct }, ...(d.activity ?? [])].slice(0, 400);
    const res = await c.env.DB.prepare('UPDATE hub_state SET version = version + 1, data = ?, updated_at = ?, updated_by = ? WHERE id = ? AND version = ?')
      .bind(await pack(JSON.stringify(d)), nowIso(), auth.user.id, 'main', main.version)
      .run();
    if (!res.meta.changes) continue;
    await auditStatement(c.env.DB, {
      actorId: auth.delegation?.agentId ?? auth.user.id,
      actorType: auth.delegation ? 'AGENT' : undefined,
      action: 'COST_VOUCHER_CREATED',
      entityType: 'COST_VOUCHER',
      entityId: ct,
      after: { date: b.pay_date, amount: b.amount, payee: b.payee, on_behalf_of: src ? src.by : undefined },
      requestId: c.get('requestId'),
      ip: clientIp(c.req.raw.headers),
    }).run();
    return ok(c, { id: row.id, ct, st: 'Chờ duyệt' });
  }
  throw conflict('VERSION_CONFLICT', 'Có người vừa sửa trước, thử lại sau ít giây');
});
