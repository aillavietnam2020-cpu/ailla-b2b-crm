/**
 * QUẢN TRỊ PHÒNG BAN (CEO duyệt demo 14/11/2026, đợt 1): Lead từng phòng tự quản nhân sự của phòng mình.
 *  - Lead = người có vai trò Trưởng nhóm / Trưởng phòng, đang làm, ở một phòng CEO đã mở (mặc định chỉ Content & Media).
 *  - Lead đổi được quyền của người cùng phòng (không phải Lead khác, không phải chính mình), CHỈ trong những quyền
 *    chính Lead đang có, trừ nhóm khóa cứng (tiền, giá vốn, lợi nhuận, lương, kho, cài đặt, phân quyền toàn công ty).
 *  - Lead khóa được người nghỉ (khóa đăng nhập); mở lại vẫn chỉ CEO.
 *  - Lead bật tắt trang trong menu cho nhân sự phòng mình (data.qtpb.dept[mã phòng].hide) và giữ mẫu quyền theo chức vụ (tpl).
 *  - Cấu hình phòng nào được mở (data.qtpb.cfg) chỉ CEO đổi.
 * Hàm trong file này là hàm thuần để kiểm thử; hub.ts gọi khi lưu bản chung.
 */
import type { GuardUser } from './stateGuard';

export const DEFAULT_DEPTS = ['CM'];
export const LEAD_ROLES = ['lead', 'truongphong'];
/** Vai trò người mới HCNS được đặt khi thêm (người thường; Lead set quyền sau). */
export const NEWCOMER_ROLES = ['nhanvien', 'content', 'digital'];

/** Quyền khóa cứng: Lead không bao giờ cấp, không gỡ, không thấy trong mẫu. */
export const HARD_PERMS = new Set([
  'gia.xem_von',
  'chiphi.xem',
  'chiphi.nhap',
  'pl.xem',
  'ketqua.xem_tat_ca',
  'luong.quanly',
  'nhansu.quanly',
  'nhansu.duyet',
  'caidat.quanly',
  'thietlap.quanly',
  'sanpham.quanly',
  'quychuan.sua',
  'kehoach.duyet',
  'sx.kiemke',
  'sx.congthuc',
  'qtpb.hoantac',
]);
const HARD_RE = /(luong|chiphi|^gia\.|giavon|loinhuan|^pl\.|^kho\.hoan|^sx\.kiemke|debt|congno|caidat|khoaso)/i;
export const isHardPerm = (p: string) => HARD_PERMS.has(p) || HARD_RE.test(p);

export type QtpbDept = { hide?: string[]; tpl?: Record<string, string[]> };
export type QtpbData = { cfg?: { depts?: string[] }; dept?: Record<string, QtpbDept> };

export function enabledDepts(q: unknown): string[] {
  const cfg = (q as QtpbData | undefined)?.cfg;
  return Array.isArray(cfg?.depts) ? cfg!.depts!.filter((x) => typeof x === 'string') : DEFAULT_DEPTS;
}

export type LeadCtx = { hubId: string; crm: string; dept: string; perms: Set<string> };

/** Người đang ghi có phải Lead của một phòng đã mở không (dựa trên bản đang lưu trên máy chủ, không tin trình duyệt). */
export function leadOf(users: GuardUser[] | undefined, crmId: string, qtpb: unknown): LeadCtx | null {
  const me = (users ?? []).find((u) => u?.crm === crmId);
  if (!me || me.active === false || !LEAD_ROLES.includes(me.role ?? '') || !me.phongBan) return null;
  if (!enabledDepts(qtpb).includes(me.phongBan)) return null;
  return { hubId: String(me.id ?? ''), crm: crmId, dept: me.phongBan, perms: new Set(me.perms ?? []) };
}

/** Lead được cấp / gỡ quyền này cho người trong phòng không. */
export const grantable = (lead: LeadCtx, p: string) => lead.perms.has(p) && !isHardPerm(p);

/** Người này Lead được quản: cùng phòng, không phải quản trị, không phải Lead khác, không phải chính Lead. */
export function leadManages(lead: LeadCtx, u: GuardUser | undefined): boolean {
  return !!u && u.phongBan === lead.dept && u.role !== 'admin' && !LEAD_ROLES.includes(u.role ?? '') && u.id !== lead.hubId;
}

/** Quyền mới = quyền cũ ngoài phạm vi Lead giữ nguyên + quyền trong phạm vi lấy theo bản Lead gửi. */
export function mergePerms(lead: LeadCtx, oldPerms: string[] | undefined, incPerms: unknown): string[] {
  const inc = Array.isArray(incPerms) ? incPerms.filter((x): x is string => typeof x === 'string') : [];
  const keep = (oldPerms ?? []).filter((p) => !grantable(lead, p));
  const add = inc.filter((p) => grantable(lead, p));
  return [...new Set([...keep, ...add])];
}

/**
 * Áp phần Lead được sửa lên kết quả protectUsers (đã giữ nguyên mọi trường bảo vệ):
 * quyền trong phạm vi + khóa người nghỉ, chỉ với người Lead quản.
 */
export function applyLeadEdits(out: GuardUser[], incoming: GuardUser[], existing: GuardUser[], lead: LeadCtx): GuardUser[] {
  const inBy = new Map(incoming.map((u) => [u?.id, u]));
  const oldBy = new Map(existing.map((u) => [u?.id, u]));
  return out.map((o) => {
    const old = oldBy.get(o?.id);
    const inc = inBy.get(o?.id);
    if (!old || !inc || !leadManages(lead, old)) return o;
    const r: GuardUser = { ...o, perms: mergePerms(lead, old.perms, inc.perms) };
    if (old.active !== false && inc.active === false) {
      r.active = false;
      r.tt = '';
    }
    return r;
  });
}

/** Mẫu quyền / menu của phòng: CEO sửa tự do; Lead chỉ sửa phòng mình (mẫu chỉ giữ quyền Lead được cấp); người khác giữ nguyên. */
export function protectQtpb(incoming: unknown, existing: unknown, isCeo: boolean, lead: LeadCtx | null): unknown {
  if (isCeo) return incoming;
  const old = (existing && typeof existing === 'object' ? existing : {}) as QtpbData;
  if (!lead) return existing === undefined ? undefined : old;
  const inc = (incoming && typeof incoming === 'object' ? incoming : {}) as QtpbData;
  const mine = inc.dept?.[lead.dept];
  const out: QtpbData = { ...old, dept: { ...(old.dept ?? {}) } };
  if (mine && typeof mine === 'object') {
    const hide = Array.isArray(mine.hide) ? [...new Set(mine.hide.filter((x) => typeof x === 'string'))] : [];
    const tpl: Record<string, string[]> = {};
    const oldTpl = old.dept?.[lead.dept]?.tpl ?? {};
    for (const [t, ps] of Object.entries(mine.tpl ?? {})) {
      if (!Array.isArray(ps)) continue;
      const keep = (oldTpl[t] ?? []).filter((p) => !grantable(lead, p));
      tpl[t] = [...new Set([...keep, ...ps.filter((p) => typeof p === 'string' && grantable(lead, p))])];
    }
    out.dept![lead.dept] = { hide, tpl };
  }
  return out;
}

export type QtpbLogRow = {
  dept: string;
  action: 'perms' | 'lock' | 'menu' | 'tpl' | 'add';
  target: string;
  target_name: string;
  before: unknown;
  after: unknown;
  summary: string;
};

const nm = (u: GuardUser | undefined) => String(u?.name ?? u?.id ?? '');

/** So bản trước / sau để ghi nhật ký những gì Lead vừa đổi. */
export function diffForLog(prevUsers: GuardUser[], nextUsers: GuardUser[], prevQ: unknown, nextQ: unknown, dept: string): QtpbLogRow[] {
  const rows: QtpbLogRow[] = [];
  const before = new Map(prevUsers.map((u) => [u?.id, u]));
  for (const u of nextUsers) {
    const p = before.get(u?.id);
    if (!p || p.phongBan !== dept) continue;
    const a = [...(p.perms ?? [])].sort();
    const b = [...(u.perms ?? [])].sort();
    if (a.join('|') !== b.join('|')) {
      const add = b.filter((x) => !a.includes(x));
      const rm = a.filter((x) => !b.includes(x));
      rows.push({
        dept,
        action: 'perms',
        target: String(u.id),
        target_name: nm(u),
        before: p.perms ?? [],
        after: u.perms ?? [],
        summary: `Đổi quyền ${nm(u)}${add.length ? ` · bật ${add.join(', ')}` : ''}${rm.length ? ` · tắt ${rm.join(', ')}` : ''}`,
      });
    }
    if (p.active !== false && u.active === false) {
      rows.push({ dept, action: 'lock', target: String(u.id), target_name: nm(u), before: true, after: false, summary: `Khóa ${nm(u)} (nghỉ việc)` });
    }
  }
  const pq = ((prevQ as QtpbData | undefined)?.dept ?? {})[dept] ?? {};
  const nq = ((nextQ as QtpbData | undefined)?.dept ?? {})[dept] ?? {};
  const ph = [...(pq.hide ?? [])].sort().join('|');
  const nh = [...(nq.hide ?? [])].sort().join('|');
  if (ph !== nh) {
    const on = (pq.hide ?? []).filter((x) => !(nq.hide ?? []).includes(x));
    const off = (nq.hide ?? []).filter((x) => !(pq.hide ?? []).includes(x));
    rows.push({
      dept,
      action: 'menu',
      target: dept,
      target_name: '',
      before: pq.hide ?? [],
      after: nq.hide ?? [],
      summary: `Cài đặt menu phòng${off.length ? ` · ẩn ${off.join(', ')}` : ''}${on.length ? ` · hiện lại ${on.join(', ')}` : ''}`,
    });
  }
  const titles = new Set([...Object.keys(pq.tpl ?? {}), ...Object.keys(nq.tpl ?? {})]);
  for (const t of titles) {
    const a = [...((pq.tpl ?? {})[t] ?? [])].sort().join('|');
    const b = [...((nq.tpl ?? {})[t] ?? [])].sort().join('|');
    if (a !== b) {
      rows.push({ dept, action: 'tpl', target: t, target_name: t, before: (pq.tpl ?? {})[t] ?? null, after: (nq.tpl ?? {})[t] ?? null, summary: `Sửa mẫu quyền chức vụ ${t}` });
    }
  }
  return rows;
}

/** Đặt lại một dòng nhật ký lên bản chung (hoàn tác). Trả về false nếu không còn gì để trả. */
export function applyUndo(data: { users?: GuardUser[]; qtpb?: QtpbData }, row: { action: string; dept: string; target: string; before: unknown }): boolean {
  if (row.action === 'perms' || row.action === 'lock' || row.action === 'add') {
    const u = (data.users ?? []).find((x) => x?.id === row.target);
    if (!u) return false;
    if (row.action === 'perms') u.perms = Array.isArray(row.before) ? (row.before as string[]) : [];
    else if (row.action === 'lock') u.active = true;
    else u.active = false;
    return true;
  }
  if (row.action === 'menu' || row.action === 'tpl') {
    const q = (data.qtpb ??= {});
    const d = ((q.dept ??= {})[row.dept] ??= {});
    if (row.action === 'menu') d.hide = Array.isArray(row.before) ? (row.before as string[]) : [];
    else {
      d.tpl ??= {};
      if (Array.isArray(row.before)) d.tpl[row.target] = row.before as string[];
      else delete d.tpl[row.target];
    }
    return true;
  }
  return false;
}
