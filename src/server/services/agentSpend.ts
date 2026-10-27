import { AGENT_PHIEU_CHI } from '@shared/agent';
import { vnDate } from '@shared/datetime';
import type { AuthContext } from '../env';
import { AppError, forbidden } from '../lib/http';
import { loadExtraPermissions } from '../middleware/auth';

/**
 * Agent Kế toán trưởng tự lập phiếu chi khi người được chỉ định ra lệnh (chị Hoa đồng ý 27/10/2026: "chị Thảo bảo làm là nó được làm").
 * Agent đi CHUNG đường với phiếu do người ghi (phiếu chi vận chuyển, phiếu chi nhà cung cấp, phiếu Chi phí khác của Sổ chi phí);
 * hàm này chỉ thêm các rào riêng cho lần ghi do agent làm:
 *  - công tắc 'agent.phieuchi' của tài khoản agent (Cấu hình › Quyền agent),
 *  - người ra lệnh phải là người làm kế toán / điều phối (giấy ủy quyền đã bảo đảm người đó được chỉ định cho agent),
 *  - chặn phiếu trùng (cùng người nhận, cùng số tiền, cùng ngày) → trả lỗi PHIEU_TRUNG kèm số phiếu cũ,
 *  - trả về dòng nguồn "Agent ... lập theo lệnh ..., lúc ..." để ghi vào phiếu.
 * Agent không bao giờ tự duyệt: xem agentNotCeo (khoản từ ngưỡng vẫn chờ CEO như phiếu thường).
 */
export { AGENT_PHIEU_CHI };

export type SpendKind = 'VC' | 'NCC' | 'CP';
export const SPEND_KIND_LABEL: Record<SpendKind, string> = { VC: 'phiếu chi vận chuyển', NCC: 'phiếu chi nhà cung cấp', CP: 'phiếu chi (Chi phí khác)' };

/** Một phiếu đã có, dùng để so trùng. */
export interface SpendRow {
  no: string;
  date: string;
  amount: number;
  payees: string[];
}

/** So tên người nhận: bỏ dấu, bỏ hoa thường, bỏ khoảng trắng và dấu câu ("Vũ Thanh Tâm" = "vu thanh  tam"). */
export function normPayee(s: string | null | undefined): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Phiếu trùng: cùng ngày, cùng số tiền, có ít nhất một tên/số tài khoản người nhận khớp nhau. */
export function findDuplicate(rows: SpendRow[], cand: { date: string; amount: number; payees: string[] }): SpendRow | null {
  const want = new Set(cand.payees.map(normPayee).filter(Boolean));
  if (!want.size) return null;
  return rows.find((r) => r.date === cand.date && Math.round(r.amount) === Math.round(cand.amount) && r.payees.some((p) => want.has(normPayee(p)))) ?? null;
}

/** Lần ghi này do agent làm thay người (có giấy ủy quyền). */
export const isAgentAct = (auth: AuthContext) => !!auth.delegation;

/** Có phải CEO tự lập không (để bỏ bước chờ CEO duyệt). Agent làm thay thì luôn là KHÔNG, kể cả khi người ra lệnh là CEO. */
export const realCeo = (auth: AuthContext) => auth.user.role === 'CEO' && !auth.delegation;

const agentLabel = (auth: AuthContext) => (auth.delegation?.agentName ?? 'Agent').replace(/^Agent\s*·\s*/, '');

/** Giờ Việt Nam dạng "HH:mm DD/MM/YYYY". */
function vnStamp(at = new Date()): string {
  const d = vnDate(at);
  const t = new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(11, 16);
  return `${t} ${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

/**
 * Rào cho lần agent lập phiếu chi. Người tự ghi thì trả null, không đụng gì.
 * Agent ghi: kiểm công tắc, vai người ra lệnh, trùng; trả dòng nguồn để chép vào phiếu.
 */
export async function agentSpendGuard(
  db: D1Database,
  auth: AuthContext,
  kind: SpendKind,
  cand: { date: string; amount: number; payees: string[] },
  existing: () => Promise<SpendRow[]>,
): Promise<{ source: string; agent: string; by: string; at: string } | null> {
  if (!auth.delegation) return null;
  const own = await loadExtraPermissions(db, auth.delegation.agentId);
  if (!own.includes(AGENT_PHIEU_CHI)) {
    throw new AppError(403, 'AGENT_PHIEU_CHI_OFF', 'Agent này đang tắt quyền lập phiếu chi (Cấu hình › Quyền agent). Báo người ra lệnh tự ghi phiếu.');
  }
  const p = auth.permissions;
  if (!(p.includes('order.accounting.confirm') || p.includes('order.approve.normal'))) {
    throw forbidden('Chỉ lập phiếu chi theo lệnh của kế toán hoặc quản lý điều phối (chị Thảo).');
  }
  if (!cand.payees.some((x) => normPayee(x))) {
    throw new AppError(422, 'NEED_PAYEE', 'Agent lập phiếu chi phải ghi rõ người nhận tiền (để chống tạo trùng).', { payee: 'Bắt buộc' });
  }
  const dup = findDuplicate(await existing(), cand);
  if (dup) {
    throw new AppError(
      409,
      'PHIEU_TRUNG',
      `Đã có ${SPEND_KIND_LABEL[kind]} ${dup.no} cùng người nhận, cùng số tiền ${dup.amount.toLocaleString('vi-VN')}đ, cùng ngày ${dup.date}. Không tạo thêm; hỏi lại người ra lệnh.`,
      { trung_voi: dup.no },
    );
  }
  const agent = agentLabel(auth);
  const at = vnStamp();
  return { source: `[Agent ${agent} lập theo lệnh ${auth.user.display_name}, lúc ${at}]`, agent, by: auth.user.display_name, at };
}

/** Ghép dòng nguồn vào đầu ghi chú, cắt cho vừa độ dài cột. */
export const withSource = (note: string, source: string | undefined, max = 600) => (source ? `${source} ${note}`.trim() : note).slice(0, max);
