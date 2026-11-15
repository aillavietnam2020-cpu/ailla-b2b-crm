/**
 * WORK FLOW CỦA PHÒNG trên máy chủ: chặn / chuyển bước cho các luồng lưu ở D1 (nghỉ phép, mua đồ dùng, hàng mẫu,
 * đề xuất theo Work Flow mới) và nhắc việc (bước mới, quá hạn) cho cả các luồng ở bản chung (video, kịch bản, task).
 */
import { nowIso } from '@shared/datetime';
import { bellTo } from '../lib/hubBell';
import { approvers, curStep, hasCustomSteps, leadIds, parseTime, qhFor, stepsFor, type Wfi } from '../lib/flowSteps';
import { unpack } from '../lib/pack';
import type { FlowStep, QtpbData } from '../lib/qtpb';
import type { GuardUser } from '../lib/stateGuard';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type FlowMain = { users: GuardUser[]; qtpb: QtpbData; cards: any[]; tasks: any[] };
export async function loadFlowMain(db: D1Database): Promise<FlowMain> {
  const row = await db.prepare("SELECT data FROM hub_state WHERE id = 'main'").first<{ data: string }>();
  const d = row ? (JSON.parse(await unpack(row.data)) as Record<string, any>) : {};
  return { users: d.users ?? [], qtpb: d.qtpb ?? {}, cards: d.cards ?? [], tasks: d.tasks ?? [] };
}
export const hubOf = (m: FlowMain, crm: string) => m.users.find((u) => u?.crm === crm && u.active !== false);
export const crmsOf = (m: FlowMain, hubIds: string[]) => hubIds.map((id) => m.users.find((u) => u?.id === id)?.crm).filter((x): x is string => !!x);
export const stepName = (m: FlowMain, s: FlowStep | undefined) => (!s ? '' : s.ai === 'lead' ? 'Lead phòng' : String(m.users.find((u) => u?.id === s.ai.slice(2))?.name ?? 'Lead phòng'));

export type GateRow = { table: 'ns_don' | 'dd_mua' | 'dd_mau'; fid: 'nghi' | 'mua' | 'mau'; id: string; pb: string | null; owner: string; wfi: string | null; start: string };
export type Gate = { act: boolean; pre: boolean; steps: FlowStep[]; w: Wfi; m: FlowMain };

/**
 * Người đang bấm có phải người duyệt của bước hiện tại không (theo các bước Lead đặt).
 * act = true thì route cho duyệt dù người đó không phải Lead; pre = còn bước sau trong các bước Lead đặt (chỉ chuyển tiếp).
 */
export async function flowGate(db: D1Database, row: GateRow, actorCrm: string): Promise<Gate> {
  const m = await loadFlowMain(db);
  const steps = row.pb ? stepsFor(m.qtpb, row.pb, row.fid) : [{ ai: 'lead', han: 0 }];
  const w = curStep(row.wfi, steps, row.start);
  const me = hubOf(m, actorCrm);
  const act = !!row.pb && hasCustomSteps(steps) && !!me && actorCrm !== row.owner && approvers(steps[w.i], m.users, row.pb, m.qtpb).includes(String(me.id));
  return { act, pre: w.i < steps.length - 1, steps, w, m };
}

/** Chuyển sang bước sau trong các bước Lead đặt, báo người duyệt bước sau. */
export async function flowAdvance(db: D1Database, row: GateRow, g: Gate, actorCrm: string, label: string): Promise<number> {
  const me = hubOf(g.m, actorCrm);
  const at = nowIso();
  const w: Wfi = { k: g.w.k ?? '', i: g.w.i + 1, at, log: [...(g.w.log ?? []), { by: String(me?.id ?? ''), name: String(me?.name ?? ''), at }] };
  await db.prepare(`UPDATE ${row.table} SET wfi = ?, updated_at = ? WHERE id = ? AND st = 'lead'`).bind(JSON.stringify(w), at, row.id).run();
  const next = approvers(g.steps[w.i], g.m.users, row.pb ?? '', g.m.qtpb);
  await bellTo(db, crmsOf(g.m, next), `${String(me?.name ?? '')} đã duyệt bước ${g.w.i + 1}, chuyển bạn duyệt: ${label}`, 'page:qw_cho');
  return w.i;
}

/* ---------------- Nhắc việc (cron 15 phút) ---------------- */
type Item = { kind: string; id: string; dept: string; fid: string; ten: string; wfi: unknown; start: string; k: string };

async function once(db: D1Database, key: string): Promise<boolean> {
  const r = await db.prepare('INSERT OR IGNORE INTO qtpb_flow_rem (key, at) VALUES (?, ?)').bind(key, nowIso()).run();
  return !!r.meta.changes;
}

/** Bước mới giao cho nhân viên (không phải Lead) thì báo người đó; quá hạn bước thì nhắc / báo Lead / báo CEO theo cài đặt. */
export async function flowCron(db: D1Database): Promise<{ moi: number; quaHan: number }> {
  const m = await loadFlowMain(db);
  const depts = Object.keys(m.qtpb.dept ?? {});
  if (!depts.length) return { moi: 0, quaHan: 0 };
  const userDept = (id: unknown) => String(m.users.find((u) => u?.id === id)?.phongBan ?? '');
  const items: Item[] = [];
  const since = Date.now() - 30 * 864e5;
  for (const c of m.cards) {
    if (c?.step !== 'dvd' && c?.step !== 'dkb') continue;
    const fid = c.step === 'dvd' ? 'video' : 'kb';
    const owner = c.step === 'dvd' ? c.nguoiEdit || c.nguoi : c.nguoiKB || c.nguoi;
    const h = (c.history ?? []).filter((x: any) => x?.to === c.step).pop();
    const start = h ? String(h.t) : '';
    items.push({ kind: 'card', id: String(c.id), dept: userDept(owner), fid, ten: `${fid === 'video' ? 'Video' : 'Kịch bản'} ${c.id}`, wfi: c.wfi, start, k: start });
  }
  for (const t of m.tasks) {
    if (t?.st !== 'review' || t.vong === 2) continue;
    const start = String(t.nopAt || t.stAt || '');
    items.push({ kind: 'task', id: String(t.id), dept: userDept(t.nguoi), fid: 'task', ten: `Việc "${String(t.ten ?? '').slice(0, 60)}"`, wfi: t.wfi, start, k: start });
  }
  const d1 = async (table: string, fid: string, ten: (r: any) => string, startCol = 'created_at') => {
    const { results } = await db.prepare(`SELECT * FROM ${table} WHERE st = 'lead' LIMIT 500`).all<any>();
    for (const r of results ?? []) items.push({ kind: table, id: r.id, dept: String(r.pb ?? ''), fid, ten: ten(r), wfi: r.wfi, start: String(r[startCol] ?? ''), k: '' });
  };
  await d1('ns_don', 'nghi', (r) => `Đơn nghỉ / tăng ca của ${String(m.users.find((u) => u?.crm === r.user_id)?.name ?? '')}`);
  await d1('dd_mua', 'mua', (r) => `Đề nghị mua ${r.ten} (${r.id})`, 'updated_at');
  await d1('dd_mau', 'mau', (r) => `Xin hàng mẫu ${r.id}`);
  const { results: ci } = await db.prepare("SELECT * FROM qtpb_flow_items WHERE st = 'cho' LIMIT 500").all<any>();
  for (const r of ci ?? []) items.push({ kind: 'item', id: r.id, dept: r.dept, fid: r.flow_id, ten: `${r.flow_ten}: ${r.tieu_de}`, wfi: r.wfi, start: r.created_at, k: '' });

  const bells = new Map<string, Set<string>>();
  const add = (text: string, hubIds: string[]) => {
    const s = bells.get(text) ?? new Set<string>();
    crmsOf(m, hubIds).forEach((x) => s.add(x));
    bells.set(text, s);
  };
  let moi = 0;
  let quaHan = 0;
  const admins = m.users.filter((u) => u?.role === 'admin' && u.active !== false).map((u) => String(u.id));
  for (const it of items) {
    if (!it.dept || !m.qtpb.dept?.[it.dept]) continue;
    const steps = stepsFor(m.qtpb, it.dept, it.fid);
    const w = curStep(it.wfi, steps, it.start, it.k);
    const t0 = parseTime(w.at);
    if (!t0 || t0 < since) continue;
    const step = steps[w.i];
    const who = approvers(step, m.users, it.dept, m.qtpb);
    const base = `${it.kind}|${it.id}|${w.k ?? ''}|${w.i}`;
    if (step && step.ai !== 'lead' && (await once(db, 'n|' + base))) {
      moi++;
      add(`Bạn có việc cần duyệt (bước ${w.i + 1}/${steps.length}): ${it.ten}`, who);
    }
    if (step?.han && Date.now() - t0 > step.han * 3_600_000 && (await once(db, 'o|' + base))) {
      quaHan++;
      const qh = qhFor(m.qtpb, it.dept, it.fid);
      const txt = `Quá hạn duyệt ${step.han} giờ: ${it.ten} (đang chờ ${stepName(m, step)})`;
      add(txt, qh === 'ceo' ? [...who, ...admins] : qh === 'lead' ? [...who, ...leadIds(m.users, it.dept, m.qtpb)] : who);
    }
  }
  for (const [text, crms] of bells) if (crms.size) await bellTo(db, [...crms], text, 'page:qw_cho');
  return { moi, quaHan };
}
