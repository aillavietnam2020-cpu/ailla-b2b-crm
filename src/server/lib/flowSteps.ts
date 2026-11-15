/**
 * WORK FLOW CỦA PHÒNG (như demo CEO duyệt 14/11/2026): logic thuần dùng chung cho máy chủ.
 * Mỗi luồng có các bước Lead đặt (trước các bước khóa của công ty: Quản lý mua hàng, Kế toán, HCNS, CEO).
 * Bước: ai = 'lead' (Lead phòng) hoặc 'u:<hub user id>' (một nhân viên trong phòng), han = số giờ (0 = không đặt).
 * Bước cuối trong các bước Lead đặt làm đúng việc "Lead duyệt" cũ (đẩy đơn sang bước sau của công ty);
 * các bước trước đó chỉ chuyển tiếp. Lead và CEO luôn duyệt thay được ở bất kỳ bước nào.
 */
import { isDeptLead, type FlowStep, type QtpbData } from './qtpb';
import type { GuardUser } from './stateGuard';

export type Wfi = { k?: string; i: number; at: string; log?: { by: string; name: string; at: string }[] };

/** Các bước Lead đặt của luồng; phòng chưa đặt thì là một bước "Lead phòng" (như trước). */
export function stepsFor(q: unknown, dept: string, fid: string): FlowStep[] {
  const d = ((q as QtpbData | undefined)?.dept ?? {})[dept] ?? {};
  const f = d.flow?.[fid] ?? d.cflows?.find((c) => c.id === fid);
  if (f && Array.isArray(f.steps) && f.steps.length) return f.steps;
  const han = Number((d.wf ?? {})[fid]?.han) || 0;
  return [{ ai: 'lead', han }];
}
export function qhFor(q: unknown, dept: string, fid: string): 'nhac' | 'lead' | 'ceo' {
  const d = ((q as QtpbData | undefined)?.dept ?? {})[dept] ?? {};
  const f = d.flow?.[fid] ?? d.cflows?.find((c) => c.id === fid);
  return f?.qh ?? 'nhac';
}
/** Phòng có đặt thêm bước (khác mặc định một bước Lead) không. */
export const hasCustomSteps = (steps: FlowStep[]) => steps.length > 1 || steps[0]?.ai !== 'lead';

export function parseWfi(raw: unknown): Wfi | null {
  if (!raw) return null;
  try {
    const o = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Wfi;
    return o && typeof o.i === 'number' ? o : null;
  } catch {
    return null;
  }
}
/** Bước đang ở: wfi đã lưu (cùng lần gửi k) hoặc bước đầu, bắt đầu lúc start. */
export function curStep(raw: unknown, steps: FlowStep[], start: string, k = ''): Wfi {
  const w = parseWfi(raw);
  if (w && (w.k ?? '') === k && w.i < steps.length) return w;
  return { k, i: 0, at: start, log: [] };
}

export function leadIds(users: GuardUser[], dept: string, q: unknown): string[] {
  return users.filter((u) => u?.active !== false && u.phongBan === dept && isDeptLead(u, q)).map((u) => String(u.id));
}
/** Người duyệt (hub user id) của một bước. */
export function approvers(step: FlowStep | undefined, users: GuardUser[], dept: string, q: unknown): string[] {
  if (!step) return [];
  if (step.ai === 'lead') return leadIds(users, dept, q);
  const id = step.ai.slice(2);
  const u = users.find((x) => x?.id === id && x.active !== false);
  return u ? [id] : leadIds(users, dept, q); // người được chọn đã nghỉ thì về Lead
}

/** Giờ dạng ISO hoặc "8:52:31 14/11/2026" (vi-VN) → mili giây; không đọc được thì 0. */
export function parseTime(s: unknown): number {
  if (!s) return 0;
  const t = String(s);
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) return Date.parse(t) || 0;
  const d = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!d) return Date.parse(t) || 0;
  const h = t.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  // giờ Việt Nam (UTC+7)
  return Date.UTC(+d[3]!, +d[2]! - 1, +d[1]!, h ? +h[1]! - 7 : -7, h ? +h[2]! : 0, h && h[3] ? +h[3] : 0);
}
