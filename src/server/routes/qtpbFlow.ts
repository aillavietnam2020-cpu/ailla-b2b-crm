import { Hono } from 'hono';
import { z } from 'zod';
import { nowIso } from '@shared/datetime';
import type { AppEnv } from '../env';
import { approvers, curStep, hasCustomSteps, stepsFor, type Wfi } from '../lib/flowSteps';
import { bellTo } from '../lib/hubBell';
import { badRequest, forbidden, notFound, ok } from '../lib/http';
import { newId } from '../lib/ids';
import { isDeptLead } from '../lib/qtpb';
import { requirePermission } from '../middleware/rbac';
import { crmsOf, hubOf, loadFlowMain, stepName, type FlowMain } from '../services/flowGate';

/**
 * WORK FLOW CỦA PHÒNG: /api/hub/qtpb/flow
 *  - GET /cho: việc đang chờ chính mình duyệt theo các bước Lead đặt (nghỉ phép, mua đồ dùng, hàng mẫu, đề xuất).
 *    Video, kịch bản, task nằm trong bản chung, trình duyệt tự tính (hub/src/qtpbwf.js).
 *  - Đề xuất theo Work Flow Lead tạo mới từ mẫu: gửi, duyệt từng bước, trả lại, hủy.
 */
export const qtpbFlowRoutes = new Hono<AppEnv>();
qtpbFlowRoutes.use('*', requirePermission('hub.access'));

/* eslint-disable @typescript-eslint/no-explicit-any */
type ItemRow = {
  id: string; dept: string; flow_id: string; flow_ten: string; tieu_de: string; noi_dung: string | null; link: string | null;
  by_id: string; by_crm: string | null; by_name: string | null; st: string; wfi: string | null; ly_do: string | null; created_at: string; updated_at: string;
};
const nm = (m: FlowMain, crm: string) => String(m.users.find((u) => u?.crm === crm)?.name ?? '');

function itemView(m: FlowMain, r: ItemRow, meId: string, ceo: boolean) {
  const steps = stepsFor(m.qtpb, r.dept, r.flow_id);
  const w = curStep(r.wfi, steps, r.created_at);
  const who = approvers(steps[w.i], m.users, r.dept, m.qtpb);
  const me = m.users.find((u) => u?.id === meId);
  const lead = !!me && me.phongBan === r.dept && isDeptLead(me, m.qtpb);
  return {
    ...r,
    buoc: w.i + 1,
    so_buoc: steps.length,
    cho: stepName(m, steps[w.i]),
    at: w.at,
    han: steps[w.i]?.han ?? 0,
    log: w.log ?? [],
    duyet: r.st === 'cho' && r.by_id !== meId && (who.includes(meId) || lead || ceo),
  };
}

qtpbFlowRoutes.get('/cho', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const m = await loadFlowMain(db);
  const me = hubOf(m, auth.user.id);
  const meId = String(me?.id ?? '');
  const ceo = auth.user.role === 'CEO';
  const out: any[] = [];
  const d1 = async (kind: string, table: string, fid: string, ten: (r: any) => string, startCol: string) => {
    const { results } = await db.prepare(`SELECT * FROM ${table} WHERE st = 'lead' ORDER BY created_at DESC LIMIT 300`).all<any>();
    for (const r of results ?? []) {
      if (!r.pb || r.user_id === auth.user.id) continue;
      const steps = stepsFor(m.qtpb, r.pb, fid);
      if (!hasCustomSteps(steps)) continue;
      const w = curStep(r.wfi, steps, String(r[startCol] ?? ''));
      if (!approvers(steps[w.i], m.users, r.pb, m.qtpb).includes(meId)) continue;
      out.push({ kind, id: r.id, ten: ten(r), nguoi: nm(m, r.user_id), pb: r.pb, buoc: w.i + 1, so_buoc: steps.length, at: w.at, han: steps[w.i]?.han ?? 0, last: w.i === steps.length - 1 });
    }
  };
  if (meId) {
    await d1('nghi', 'ns_don', 'nghi', (r) => `Đơn ${r.loai === 'ot' ? 'tăng ca' : 'nghỉ'} ${String(r.tu).slice(8)}/${String(r.tu).slice(5, 7)}${r.den && r.den !== r.tu ? ' → ' + String(r.den).slice(8) + '/' + String(r.den).slice(5, 7) : ''}${r.ly_do ? ': ' + r.ly_do : ''}`, 'created_at');
    await d1('mua', 'dd_mua', 'mua', (r) => `Đề nghị mua ${r.ten} · ${r.sl} ${r.dvt ?? ''}`, 'updated_at');
    await d1('mau', 'dd_mau', 'mau', (r) => `Xin hàng mẫu ${r.kho_code} · ${r.sl}`, 'created_at');
  }
  const { results } = await db.prepare("SELECT * FROM qtpb_flow_items WHERE st = 'cho' OR by_id = ? ORDER BY created_at DESC LIMIT 300").bind(meId).all<ItemRow>();
  const items = (results ?? []).map((r) => itemView(m, r, meId, ceo));
  const myDept = String(me?.phongBan ?? '');
  const flows = ((m.qtpb.dept ?? {})[myDept]?.cflows ?? []).map((f) => ({ id: f.id, ten: f.ten, so_buoc: f.steps.length }));
  return ok(c, {
    d1: out,
    items: items.filter((x) => x.duyet),
    mine: items.filter((x) => x.by_id === meId),
    flows,
  });
});

const newSchema = z.object({
  flow_id: z.string().max(20),
  tieu_de: z.string().trim().min(2, 'Ghi tiêu đề').max(200),
  noi_dung: z.string().trim().max(3000).optional().default(''),
  link: z.string().trim().max(1000).optional().default(''),
});

qtpbFlowRoutes.post('/items', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const m = await loadFlowMain(db);
  const me = hubOf(m, auth.user.id);
  if (!me?.phongBan) throw forbidden('Tài khoản chưa gắn phòng');
  const v = newSchema.parse(await c.req.json());
  const f = (m.qtpb.dept ?? {})[me.phongBan]?.cflows?.find((x) => x.id === v.flow_id);
  if (!f) throw notFound('Phòng không có Work Flow này');
  if (v.link && !/^https?:\/\//i.test(v.link)) throw badRequest('LINK', 'Link phải bắt đầu bằng http');
  const id = 'DX' + newId().slice(-6).toUpperCase();
  const at = nowIso();
  const w: Wfi = { k: '', i: 0, at, log: [] };
  await db
    .prepare(
      `INSERT INTO qtpb_flow_items (id, dept, flow_id, flow_ten, tieu_de, noi_dung, link, by_id, by_crm, by_name, st, wfi, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cho', ?, ?, ?)`,
    )
    .bind(id, me.phongBan, f.id, f.ten, v.tieu_de, v.noi_dung, v.link, String(me.id), auth.user.id, String(me.name ?? ''), JSON.stringify(w), at, at)
    .run();
  await bellTo(db, crmsOf(m, approvers(f.steps[0], m.users, me.phongBan, m.qtpb)), `${String(me.name ?? '')} gửi ${f.ten}: ${v.tieu_de} · cần bạn duyệt`, 'page:qw_cho');
  return ok(c, { id });
});

qtpbFlowRoutes.post('/items/:id/duyet', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const m = await loadFlowMain(db);
  const me = hubOf(m, auth.user.id);
  const r = await db.prepare('SELECT * FROM qtpb_flow_items WHERE id = ?').bind(c.req.param('id')).first<ItemRow>();
  if (!r) throw notFound();
  if (r.st !== 'cho') throw badRequest('DONE', 'Đề xuất này không còn chờ duyệt');
  const view = itemView(m, r, String(me?.id ?? ''), auth.user.role === 'CEO');
  if (!view.duyet) throw forbidden('Bạn không duyệt được bước này');
  const b = (await c.req.json().catch(() => ({}))) as { ok?: boolean; ly_do?: string };
  const steps = stepsFor(m.qtpb, r.dept, r.flow_id);
  const w = curStep(r.wfi, steps, r.created_at);
  const at = nowIso();
  const log = [...(w.log ?? []), { by: String(me?.id ?? ''), name: String(me?.name ?? ''), at }];
  if (b.ok === false) {
    const ly = String(b.ly_do ?? '').trim().slice(0, 500);
    if (!ly) throw badRequest('LY_DO', 'Ghi lý do trả lại');
    await db.prepare("UPDATE qtpb_flow_items SET st = 'tl', ly_do = ?, wfi = ?, updated_at = ? WHERE id = ?").bind(ly, JSON.stringify({ ...w, log }), at, r.id).run();
    await bellTo(db, r.by_crm ? [r.by_crm] : [], `${r.flow_ten} "${r.tieu_de}" bị trả lại: ${ly}`, 'page:qw_cho');
    return ok(c, { st: 'tl' });
  }
  const isApprover = approvers(steps[w.i], m.users, r.dept, m.qtpb).includes(String(me?.id ?? ''));
  // Người duyệt bước giữa thì chuyển bước sau; Lead / CEO duyệt thay hoặc bước cuối thì xong.
  if (isApprover && w.i < steps.length - 1) {
    const nw: Wfi = { k: '', i: w.i + 1, at, log };
    await db.prepare('UPDATE qtpb_flow_items SET wfi = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(nw), at, r.id).run();
    await bellTo(db, crmsOf(m, approvers(steps[nw.i], m.users, r.dept, m.qtpb)), `${r.flow_ten} "${r.tieu_de}" đã qua bước ${w.i + 1}, cần bạn duyệt`, 'page:qw_cho');
    return ok(c, { st: 'cho', buoc: nw.i + 1 });
  }
  await db.prepare("UPDATE qtpb_flow_items SET st = 'xong', wfi = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify({ ...w, log }), at, r.id).run();
  await bellTo(db, r.by_crm ? [r.by_crm] : [], `${r.flow_ten} "${r.tieu_de}" đã được duyệt`, 'page:qw_cho');
  return ok(c, { st: 'xong' });
});

qtpbFlowRoutes.post('/items/:id/huy', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const r = await db.prepare('SELECT * FROM qtpb_flow_items WHERE id = ?').bind(c.req.param('id')).first<ItemRow>();
  if (!r) throw notFound();
  if (r.by_crm !== auth.user.id) throw forbidden('Chỉ người gửi hủy được');
  if (r.st !== 'cho' && r.st !== 'tl') throw badRequest('DONE', 'Đề xuất đã xong, không hủy được');
  await db.prepare("UPDATE qtpb_flow_items SET st = 'huy', updated_at = ? WHERE id = ?").bind(nowIso(), r.id).run();
  return ok(c, { st: 'huy' });
});
