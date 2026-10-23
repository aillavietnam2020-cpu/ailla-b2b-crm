import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { forbidden, notFound, ok } from '../lib/http';
import { runChecks } from '../services/dataChecks';

/** Máy soát số liệu: chỉ CEO và kế toán xem; chỉ đọc, không sửa dữ liệu. */
export const soatRoutes = new Hono<AppEnv>();

function canSee(a: { user: { role: string }; permissions: string[] }) {
  return a.user.role === 'CEO' || a.permissions.includes('order.accounting.confirm') || a.permissions.includes('settings.manage');
}

soatRoutes.get('/', async (c) => {
  if (!canSee(c.get('auth'))) throw forbidden('Chỉ CEO hoặc kế toán');
  return ok(c, await runChecks(c.env.DB));
});

/**
 * Sổ của một mã hàng để biết tồn lệch từ đâu: tổng nhập / xuất theo loại phiếu, và 30 dòng gần nhất kèm tồn sau mỗi dòng.
 * Tồn tính cộng dồn theo ngày phiếu (cùng ngày thì theo số phiếu), nên chỉ là ước lượng thứ tự trong cùng một ngày.
 */
soatRoutes.get('/item/:code', async (c) => {
  if (!canSee(c.get('auth'))) throw forbidden('Chỉ CEO hoặc kế toán');
  const code = c.req.param('code');
  const item = await c.env.DB.prepare('SELECT code, name, unit, cls FROM kho_items WHERE code = ?')
    .bind(code)
    .first<{ code: string; name: string; unit: string; cls: string }>();
  if (!item) throw notFound('Không thấy mã hàng này');
  const rows =
    (
      await c.env.DB.prepare('SELECT doc_date, doc_type, doc_no, qty FROM kho_ledger WHERE item = ? ORDER BY doc_date, doc_no LIMIT 3000')
        .bind(code)
        .all<{ doc_date: string; doc_type: string; doc_no: string; qty: number }>()
    ).results ?? [];
  let bal = 0;
  const withBal = rows.map((r) => {
    bal += r.qty;
    return { ...r, balance: Math.round(bal * 100) / 100 };
  });
  const byType = new Map<string, { type: string; lines: number; qty: number }>();
  for (const r of rows) {
    const t = byType.get(r.doc_type) ?? { type: r.doc_type, lines: 0, qty: 0 };
    t.lines += 1;
    t.qty += r.qty;
    byType.set(r.doc_type, t);
  }
  return ok(c, {
    item,
    balance: Math.round(bal * 100) / 100,
    lines: rows.length,
    by_type: [...byType.values()].map((t) => ({ ...t, qty: Math.round(t.qty * 100) / 100 })).sort((a, b) => a.qty - b.qty),
    recent: withBal.slice(-30).reverse(),
  });
});
