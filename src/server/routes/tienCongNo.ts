import { Hono } from 'hono';
import { vnDate } from '@shared/datetime';
import type { AppEnv, AuthContext } from '../env';
import { badRequest, forbidden, ok } from '../lib/http';
import { debtAging } from '../services/debts';
import { chungTuKhach, chungTuNcc, doiChieuKhach, doiChieuNcc, dongTien, nccCongNo } from '../services/tienCongNo';

/**
 * Tiền & công nợ (quản trị và vận hành cùng số): chỉ ĐỌC. Gắn dưới /api/hub/dieuhanh/tien.
 * Chỉ CEO và tài khoản xem được công nợ toàn bộ khách (kế toán).
 */
export const tienCongNoRoutes = new Hono<AppEnv>();
const canMoney = (a: AuthContext) => a.user.role === 'CEO' || a.permissions.includes('debt.read.all');
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
tienCongNoRoutes.use('*', async (c, next) => {
  if (!canMoney(c.get('auth'))) throw forbidden('Chỉ CEO hoặc kế toán xem tiền và công nợ');
  await next();
});

/** Phải thu khách (theo kênh, tuổi nợ, DSO) + phải trả nhà cung cấp (tuổi nợ). */
tienCongNoRoutes.get('/tong-hop', async (c) => {
  const asOf = vnDate();
  const [khach, ncc] = await Promise.all([debtAging(c.env.DB, '1=1', [], asOf), nccCongNo(c.env.DB, asOf)]);
  return ok(c, { as_of: asOf, khach, ncc });
});

/** Đối chiếu trong khoảng ngày: từng khách, từng nhà cung cấp; chứng từ tiền theo tài khoản. */
tienCongNoRoutes.get('/doi-chieu', async (c) => {
  const from = c.req.query('from') ?? '';
  const to = c.req.query('to') ?? '';
  const tienFrom = c.req.query('tien_from') || from;
  if (!isDay(from) || !isDay(to) || !isDay(tienFrom) || from > to) throw badRequest('BAD_RANGE', 'Chọn khoảng ngày hợp lệ');
  const [khach, ncc, tien] = await Promise.all([
    doiChieuKhach(c.env.DB, from, to),
    doiChieuNcc(c.env.DB, from, to, vnDate()),
    dongTien(c.env.DB, tienFrom < from ? tienFrom : from, to),
  ]);
  return ok(c, { from, to, khach, ncc, tien });
});

/** Chứng từ tiền trên web trong khoảng ngày (để tính chi bình quân, số dư tính). */
tienCongNoRoutes.get('/dong-tien', async (c) => {
  const from = c.req.query('from') ?? '';
  const to = c.req.query('to') ?? '';
  if (!isDay(from) || !isDay(to) || from > to) throw badRequest('BAD_RANGE', 'Chọn khoảng ngày hợp lệ');
  return ok(c, await dongTien(c.env.DB, from, to));
});

/** Từng chứng từ của một khách / một nhà cung cấp. */
tienCongNoRoutes.get('/chung-tu', async (c) => {
  const kind = c.req.query('kind');
  const id = c.req.query('id') ?? '';
  if (!id) throw badRequest('MISSING', 'Thiếu mã');
  if (kind === 'kh') return ok(c, await chungTuKhach(c.env.DB, id));
  if (kind === 'ncc') return ok(c, await chungTuNcc(c.env.DB, id));
  throw badRequest('BAD_KIND', 'Loại không hợp lệ');
});
