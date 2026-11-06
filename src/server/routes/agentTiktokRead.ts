/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Context } from 'hono';
import { AGENT_SCOPE_PREFIX } from '@shared/agent';
import type { AppEnv } from '../env';
import { badRequest, forbidden, ok } from '../lib/http';
import { DAY_SRC, RANGE_KIND } from './tiktok';

/**
 * Đường CHỈ ĐỌC số TikTok đã được Kế toán trưởng nạp (chị Hoa 06/11/2026): Lead Content, Lead Digital, Đăng, Lead Sale
 * đọc lại từ web thay vì tự mở TikTok Seller Center. Cần phạm vi 'doc_tiktok' (tách khỏi 'baocao_san' là quyền nạp).
 * Chỉ trả số tổng hợp theo ngày / video / KOC như web hiển thị (đã lọc lúc nạp): không tên, SĐT, địa chỉ khách.
 * Luật gộp khoảng ngày giống hub/src/ttsync.js (ttsRanges, ttsMerge) để agent thấy đúng số web đang hiển thị.
 */
export const READ_SCOPE = AGENT_SCOPE_PREFIX + 'doc_tiktok';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ['days', ...RANGE_KIND, 'all'] as const;
const MAX_SPAN = 400;

type Row = { kind: string; from: string; to: string; at: string; data: Record<string, any> };
const len = (r: Row) => Date.parse(r.to) - Date.parse(r.from);

/** Khoảng dài chọn trước, khoảng chồng lên khoảng đã chọn thì bỏ; các khoảng rời nhau thì cộng. Ưu tiên khoảng nằm trọn trong kỳ. */
export function pickRanges(all: Row[], from: string, to: string): Row[] {
  const A = all.filter((r) => r.from <= to && r.to >= from);
  const IN = A.filter((r) => r.from >= from && r.to <= to);
  const sorted = (IN.length ? IN : A).slice().sort((a, b) => len(b) - len(a) || b.to.localeCompare(a.to) || (b.at || '').localeCompare(a.at || ''));
  const out: Row[] = [];
  for (const r of sorted) if (!out.some((x) => x.from <= r.to && x.to >= r.from)) out.push(r);
  return out.sort((a, b) => a.from.localeCompare(b.from));
}

export function mergeRanges(kind: string, R: Row[]): Record<string, any> {
  if (kind === 'koc') {
    const M: Record<string, number> = {};
    for (const r of R) for (const [k, v] of Object.entries(r.data || {})) if (typeof v === 'number') M[k] = (M[k] || 0) + v;
    return M;
  }
  if (kind === 'creators') {
    const U = new Map<string, any>();
    let n = 0, nCo = 0, gmv = 0;
    for (const r of R) {
      const x = r.data || {};
      n = Math.max(n, +x.n || 0);
      nCo += +x.nCo || 0;
      gmv += +x.gmv || 0;
      for (const t of x.top || []) {
        const o = U.get(t.u) || { u: t.u };
        for (const [k, v] of Object.entries(t)) if (typeof v === 'number') o[k] = k === 'fl' ? Math.max(o[k] || 0, v) : (o[k] || 0) + v;
        U.set(t.u, o);
      }
    }
    return { n, nCo: Math.min(nCo, n || nCo), gmv, top: [...U.values()].sort((a, b) => (b.gmv || 0) - (a.gmv || 0)) };
  }
  const V = new Map<string, any>();
  const S: Record<string, any> = {};
  for (const r of R) {
    const x = r.data || {};
    for (const [k, v] of Object.entries(x)) if (typeof v === 'number') S[k] = (S[k] || 0) + v;
    for (const v of x.top || []) {
      const o = V.get(v.id) || { id: v.id, t: v.t, post: v.post, sp: v.sp, u: v.u || '' };
      for (const [k, val] of Object.entries(v)) if (typeof val === 'number' && k !== 'xh') o[k] = (o[k] || 0) + val;
      if (!o.u && v.u) o.u = v.u;
      V.set(v.id, o);
    }
  }
  const top = [...V.values()].sort((a, b) => (b.gmv || 0) - (a.gmv || 0));
  const full = R.every((r) => ((r.data || {}).top || []).length >= (+(r.data || {}).n || 0));
  if (full || R.length === 1) {
    S.n = R.length === 1 ? +(R[0].data || {}).n || top.length : top.length;
    S.nCoDon = R.length === 1 ? +(R[0].data || {}).nCoDon || top.filter((v) => v.don > 0).length : top.filter((v) => (v.don || 0) > 0).length;
  }
  return Object.assign(S, { top });
}

function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

export async function readTiktok(c: Context<AppEnv>) {
  if (!c.get('auth').permissions.includes(READ_SCOPE)) throw forbidden('Agent này chưa được phép đọc số TikTok trên web');
  const from = c.req.query('from') ?? '';
  const to = c.req.query('to') ?? '';
  const kind = c.req.query('kind') ?? 'all';
  if (!DAY.test(from) || !DAY.test(to) || from > to) throw badRequest('BAD_RANGE', 'Khoảng ngày không hợp lệ (from, to dạng YYYY-MM-DD)');
  if (!(KINDS as readonly string[]).includes(kind)) throw badRequest('BAD_KIND', `kind phải là một trong: ${KINDS.join(', ')}`);
  const span = eachDay(from, to);
  if (span.length > MAX_SPAN) throw badRequest('TOO_LONG', `Tối đa ${MAX_SPAN} ngày mỗi lần đọc`);
  const top = Math.min(500, Math.max(0, Number(c.req.query('top') ?? 50) || 0));
  const out: Record<string, unknown> = { from, to, kind };

  if (kind === 'days' || kind === 'all') {
    const d = await c.env.DB.prepare('SELECT day, src, data, updated_at FROM tts_day WHERE day BETWEEN ? AND ? ORDER BY day').bind(from, to).all<{ day: string; src: string; data: string; updated_at: string }>();
    const days: Record<string, Record<string, unknown>> = {};
    const updatedAt: Record<string, string | null> = Object.fromEntries(DAY_SRC.map((s) => [s, null]));
    for (const x of d.results ?? []) {
      (days[x.day] ??= {})[x.src] = JSON.parse(x.data);
      if (!updatedAt[x.src] || x.updated_at > (updatedAt[x.src] as string)) updatedAt[x.src] = x.updated_at;
    }
    const missing = Object.fromEntries(DAY_SRC.map((s) => [s, span.filter((day) => !days[day]?.[s])]));
    const last = await c.env.DB.prepare('SELECT src, MAX(day) AS day FROM tts_day GROUP BY src').all<{ src: string; day: string }>();
    out.days = days;
    out.missing = missing;
    out.updatedAt = updatedAt;
    out.lastDay = Object.fromEntries((last.results ?? []).map((x) => [x.src, x.day]));
  }

  const kinds: string[] = kind === 'all' ? [...RANGE_KIND] : (RANGE_KIND as readonly string[]).includes(kind) ? [kind] : [];
  if (kinds.length) {
    const r = await c.env.DB.prepare('SELECT kind, d_from, d_to, data, updated_at FROM tts_range WHERE d_from <= ? AND d_to >= ? ORDER BY d_from').bind(to, from).all<{ kind: string; d_from: string; d_to: string; data: string; updated_at: string }>();
    const rows: Row[] = (r.results ?? []).map((x) => ({ kind: x.kind, from: x.d_from, to: x.d_to, at: x.updated_at, data: JSON.parse(x.data) }));
    const ranges: Record<string, unknown> = {};
    for (const k of kinds) {
      const R = pickRanges(rows.filter((x) => x.kind === k), from, to);
      if (!R.length) {
        ranges[k] = null;
        continue;
      }
      const data = mergeRanges(k, R);
      if (Array.isArray(data.top)) {
        data.nTop = data.top.length;
        data.top = data.top.slice(0, top);
      }
      ranges[k] = { parts: R.map((x) => ({ from: x.from, to: x.to, at: x.at })), updatedAt: R.map((x) => x.at).sort().pop(), data };
    }
    out.ranges = ranges;
  }
  return ok(c, out);
}
