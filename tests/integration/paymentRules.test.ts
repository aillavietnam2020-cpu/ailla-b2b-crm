import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, seedBusinessData, seedUsers, USERS, type TestContext } from '../helpers/app';

let ctx: TestContext;

beforeEach(async () => {
  ctx = createTestContext();
  await seedUsers(ctx.db);
  await seedBusinessData(ctx.db);
});

/** Đơn đã duyệt: 10 can × 125.000 = 1.250.000đ. */
async function approvedOrder(): Promise<string> {
  const created = await ctx.request('/api/orders', {
    as: USERS.thao,
    body: { customer_id: 'cus-thao-1', order_date: '2026-08-16', items: [{ product_id: 'prod-full', qty: 10 }] },
  });
  const id = created.body.data.id as string;
  await ctx.request(`/api/orders/${id}/submit`, { as: USERS.thao, body: {} });
  const approvals = await ctx.request('/api/approvals?status=PENDING', { as: USERS.manager });
  for (const a of approvals.body.data) {
    await ctx.request(`/api/approvals/${a.id}/decide`, { as: USERS.manager, body: { decision: 'APPROVED' } });
  }
  return id;
}

async function addAccount(): Promise<string> {
  const res = await ctx.request('/api/receiving-accounts', {
    as: USERS.ceo,
    body: { bank: 'MB', account_no: '8433 336 888', account_name: 'CTY CP TM VA XNK AILLA VIET NAM' },
  });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

const pay = (as: string, body: Record<string, unknown>) => ctx.request('/api/payments', { as, body });

function billForm(fields: Record<string, string>) {
  const fd = new FormData();
  fd.set('file', new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' }), 'bill.png');
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe('Tài khoản nhận tiền hợp lệ', () => {
  it('CEO thêm tài khoản; số tài khoản được chuẩn hoá; sale chỉ xem; trùng bị chặn', async () => {
    await addAccount();
    const list = await ctx.request('/api/receiving-accounts', { as: USERS.thao });
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].account_no).toBe('8433336888');

    const sale = await ctx.request('/api/receiving-accounts', {
      as: USERS.thao,
      body: { bank: 'BIDV', account_no: '123456789', account_name: 'Khac' },
    });
    expect(sale.status).toBe(403);
    const dup = await ctx.request('/api/receiving-accounts', {
      as: USERS.ceo,
      body: { bank: 'MB', account_no: '8433336888', account_name: 'Lap' },
    });
    expect(dup.status).toBe(422);
  });
});

describe('Quy tắc ghi tiền về', () => {
  it('trả đúng đơn bằng chuyển khoản vào tài khoản hợp lệ: không cần giải trình, không bị gắn cờ', async () => {
    const orderId = await approvedOrder();
    const acc = await addAccount();
    const res = await pay(USERS.thao, {
      customer_id: 'cus-thao-1',
      amount: 1_250_000,
      method: 'Chuyển khoản',
      bank_ref: 'FT123456',
      receiving_account_id: acc,
      allocations: [{ order_id: orderId, amount: 1_250_000 }],
    });
    expect(res.status).toBe(200);
    const row = await ctx.db
      .prepare('SELECT review_status, purpose, bank_ref, receiving_account_id FROM payments WHERE id = ?')
      .bind(res.body.data.id)
      .first<{ review_status: string; purpose: string; bank_ref: string; receiving_account_id: string }>();
    expect(row?.review_status).toBe('OK');
    expect(row?.purpose).toBe('ORDER');
    expect(row?.bank_ref).toBe('FT123456');
  });

  it('chuyển khoản vào tài khoản ngoài danh sách: ghi được nhưng gắn cờ cho kế toán kiểm tra', async () => {
    const orderId = await approvedOrder();
    const res = await pay(USERS.thao, {
      customer_id: 'cus-thao-1',
      amount: 1_250_000,
      method: 'Chuyển khoản',
      bank_ref: 'FT999',
      allocations: [{ order_id: orderId, amount: 1_250_000 }],
    });
    expect(res.status).toBe(200);
    const row = await ctx.db
      .prepare('SELECT review_status, review_reason FROM payments WHERE id = ?')
      .bind(res.body.data.id)
      .first<{ review_status: string; review_reason: string }>();
    expect(row?.review_status).toBe('NEEDS_REVIEW');
    expect(row?.review_reason).toContain('Tài khoản nhận');
  });

  it('một bill (số tham chiếu) không ghi hai lần', async () => {
    const orderId = await approvedOrder();
    const body = {
      customer_id: 'cus-thao-1',
      amount: 500_000,
      method: 'Chuyển khoản',
      bank_ref: 'FT-DUP-1',
      explanation: 'Khách trả trước một phần',
      allocations: [{ order_id: orderId, amount: 500_000 }],
    };
    expect((await pay(USERS.thao, body)).status).toBe(200);
    const again = await pay(USERS.thao, body);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('DUPLICATE_BANK_REF');
  });

  it('trả từng phần không cần giải trình; tiền dư tự trừ đơn khác rồi thành số dư có', async () => {
    const orderId = await approvedOrder();
    // Khách chuyển 1 triệu trước (một trong nhiều lần chuyển): ghi được, phần thiếu vẫn là công nợ.
    const part = await pay(USERS.thao, {
      customer_id: 'cus-thao-1',
      amount: 1_000_000,
      method: 'Chuyển khoản',
      allocations: [{ order_id: orderId, amount: 1_000_000 }],
    });
    expect(part.status).toBe(200);
    const detail = await ctx.request(`/api/orders/${orderId}`, { as: USERS.thao });
    expect(detail.body.data.remaining_amount).toBe(250_000);
    expect(detail.body.data.payment_status).toBe('THU_MOT_PHAN');
    // Lần sau chuyển dư (500k cho đơn còn 250k): không cần giải trình, đơn đủ tiền, phần thừa thành số dư có của khách (chưa có nợ cũ).
    const over = await pay(USERS.thao, {
      customer_id: 'cus-thao-1',
      amount: 500_000,
      method: 'Chuyển khoản',
      allocations: [{ order_id: orderId, amount: 250_000 }],
    });
    expect(over.status).toBe(200);
    const after = await ctx.request(`/api/orders/${orderId}`, { as: USERS.thao });
    expect(after.body.data.payment_status).toBe('DA_THU_DU');
    const credit = await ctx.db.prepare('SELECT amount FROM customer_credit_balances WHERE customer_id = ?').bind('cus-thao-1').first<{ amount: number }>();
    expect(credit?.amount).toBe(250_000);
  });

  it('trả công nợ cũ không cần giải trình; đặt cọc phải có giải trình và không gắn đơn', async () => {
    const orderId = await approvedOrder();
    const debtNoWhy = await pay(USERS.thao, {
      customer_id: 'cus-thao-1',
      amount: 1_250_000,
      purpose: 'DEBT',
      method: 'Chuyển khoản',
      allocations: [{ order_id: orderId, amount: 1_250_000 }],
    });
    // Trả nợ cũ không còn bắt giải trình: tiền tự trừ đơn đặt trước.
    expect(debtNoWhy.status).toBe(200);

    const deposit = await pay(USERS.thao, {
      customer_id: 'cus-thao-1',
      amount: 3_000_000,
      purpose: 'DEPOSIT',
      method: 'Chuyển khoản',
      explanation: 'Cọc cho đơn dự kiến tuần sau',
    });
    expect(deposit.status).toBe(200);
    const row = await ctx.db
      .prepare('SELECT purpose, is_general_repayment FROM payments WHERE id = ?')
      .bind(deposit.body.data.id)
      .first<{ purpose: string; is_general_repayment: number }>();
    expect(row?.purpose).toBe('DEPOSIT');
    expect(row?.is_general_repayment).toBe(0);

    const badDeposit = await pay(USERS.thao, {
      customer_id: 'cus-thao-1',
      amount: 100_000,
      purpose: 'DEPOSIT',
      explanation: 'Cọc nhưng lại gắn đơn',
      allocations: [{ order_id: orderId, amount: 100_000 }],
    });
    expect(badDeposit.status).toBe(422);
  });

  it('tiền mặt: bắt buộc ghi người nhận; kế toán chỉ xác nhận khi đã có ảnh phiếu thu ký tên', async () => {
    const orderId = await approvedOrder();
    const noReceiver = await pay(USERS.thao, {
      customer_id: 'cus-thao-1',
      amount: 1_250_000,
      method: 'Tiền mặt',
      allocations: [{ order_id: orderId, amount: 1_250_000 }],
    });
    expect(noReceiver.status).toBe(422);
    expect(noReceiver.body.error.code).toBe('RECEIVER_REQUIRED');

    const cash = await pay(USERS.thao, {
      customer_id: 'cus-thao-1',
      amount: 1_250_000,
      method: 'Tiền mặt',
      receiver_name: 'Nguyễn Thu Thảo',
      allocations: [{ order_id: orderId, amount: 1_250_000 }],
    });
    expect(cash.status).toBe(200);
    const pid = cash.body.data.id as string;

    // Chưa có ảnh phiếu thu: kế toán không xác nhận được.
    const early = await ctx.request(`/api/payments/${pid}/confirm`, { as: USERS.manager, body: { confirmed: true } });
    expect(early.status).toBe(400);
    expect(early.body.error.code).toBe('RECEIPT_REQUIRED');

    // Ảnh bill thường không thay được phiếu thu.
    await ctx.request('/api/bills', {
      as: USERS.thao,
      formData: billForm({ customer_id: 'cus-thao-1', order_id: orderId, payment_id: pid, kind: 'BILL' }),
    });
    const stillNo = await ctx.request(`/api/payments/${pid}/confirm`, { as: USERS.manager, body: { confirmed: true } });
    expect(stillNo.status).toBe(400);

    const up = await ctx.request('/api/bills', {
      as: USERS.thao,
      formData: billForm({ customer_id: 'cus-thao-1', order_id: orderId, payment_id: pid, kind: 'PHIEU_THU' }),
    });
    expect(up.status).toBe(200);
    const ok = await ctx.request(`/api/payments/${pid}/confirm`, { as: USERS.manager, body: { confirmed: true } });
    expect(ok.status).toBe(200);
  });

  it('báo cáo tháng: tổng, theo khách, theo hình thức, tách đã xác nhận / chờ xác nhận', async () => {
    const orderId = await approvedOrder();
    const a = await pay(USERS.thao, {
      customer_id: 'cus-thao-1',
      amount: 500_000,
      method: 'Chuyển khoản',
      paid_at: '2026-08-20',
      explanation: 'Trả trước một phần',
      allocations: [{ order_id: orderId, amount: 500_000 }],
    });
    await pay(USERS.thao, {
      customer_id: 'cus-thao-1',
      amount: 200_000,
      method: 'Tiền mặt',
      receiver_name: 'Thảo',
      paid_at: '2026-08-21',
      explanation: 'Trả thêm',
      allocations: [{ order_id: orderId, amount: 200_000 }],
    });
    await pay(USERS.thao, {
      customer_id: 'cus-thao-1',
      amount: 100_000,
      method: 'Chuyển khoản',
      paid_at: '2026-09-02',
      explanation: 'Thanh toán tháng sau',
      allocations: [{ order_id: orderId, amount: 100_000 }],
    });
    await ctx.request(`/api/payments/${a.body.data.id}/confirm`, { as: USERS.manager, body: { confirmed: true } });

    const rep = await ctx.request('/api/bills/report?month=2026-08', { as: USERS.thao });
    expect(rep.status).toBe(200);
    expect(rep.body.data.totals.count).toBe(2);
    expect(rep.body.data.totals.amount).toBe(700_000);
    expect(rep.body.data.totals.confirmed).toBe(500_000);
    expect(rep.body.data.totals.pending).toBe(200_000);
    expect(rep.body.data.by_customer[0].customer_name).toBe('Cửa hàng Test A');
    expect(rep.body.data.by_method.map((m: { key: string }) => m.key).sort()).toEqual(['Chuyển khoản', 'Tiền mặt']);

    // Sale khác không thấy khách của người khác.
    const other = await ctx.request('/api/bills/report?month=2026-08', { as: USERS.huyen });
    expect(other.body.data.totals.count).toBe(0);
  });
});

describe('Đọc bill bằng AI', () => {
  it('chưa nối AI thì báo không đọc được để nhập tay, không lỗi', async () => {
    const res = await ctx.request('/api/bills/read', {
      as: USERS.thao,
      formData: billForm({}),
    });
    expect(res.status).toBe(200);
    expect(res.body.data.readable).toBe(false);
    expect(res.body.data.reason).toBeTruthy();
  });

  it('chuẩn hoá kết quả AI: số tiền, ngày, tài khoản, số tham chiếu', async () => {
    const { normalizeBillJson } = await import('../../src/server/lib/billReader');
    const r = normalizeBillJson({
      is_bank_transfer: true,
      amount: '40,290,000 VND',
      paid_at: '12/10/2026 09:48:58',
      ref: '0200970488101209485720266z1p294845',
      to_account: '8433 336 888',
      to_name: 'CONG TY CO PHAN THUONG MAI VA XNK AILLA VIET NAM',
      content: 'Van Quyen Truong chuyen khoan nhanh qua Zalo',
    });
    expect(r.readable).toBe(true);
    expect(r.amount).toBe(40_290_000);
    expect(r.paid_date).toBe('2026-10-12');
    expect(r.paid_time).toBe('09:48:58');
    expect(r.to_account).toBe('8433336888');
    expect(r.bank_ref).toBe('0200970488101209485720266z1p294845');

    const not = normalizeBillJson({ is_bank_transfer: false });
    expect(not.readable).toBe(false);
  });
});

describe('Gợi ý đơn cho khoản tiền chưa gắn + xác nhận một lần', () => {
  it('khoản đặt cọc đúng bằng số còn phải thu của đúng một đơn: có gợi ý, bấm một lần là xác nhận và gắn đơn', async () => {
    const orderId = await approvedOrder();
    const dep = await pay(USERS.thao, {
      customer_id: 'cus-thao-1',
      amount: 1_250_000,
      method: 'Chuyển khoản',
      bank_ref: 'FT-SUG-1',
      purpose: 'DEPOSIT',
      explanation: 'Khách chuyển trước khi đơn được duyệt',
    });
    expect(dep.status).toBe(200);
    const hist = await ctx.request('/api/bills/history', { as: USERS.manager });
    const row = hist.body.data.find((h: { id: string }) => h.id === dep.body.data.id);
    expect(row.suggest.order_id).toBe(orderId);
    const done = await ctx.request(`/api/payments/${dep.body.data.id}/confirm-attach`, { as: USERS.manager, body: { order_id: orderId } });
    expect(done.status).toBe(200);
    const o = await ctx.db.prepare('SELECT payment_status FROM orders WHERE id = ?').bind(orderId).first<{ payment_status: string }>();
    expect(o?.payment_status).toBe('DA_THU_DU');
    const p = await ctx.db.prepare('SELECT accounting_status FROM payments WHERE id = ?').bind(dep.body.data.id).first<{ accounting_status: string }>();
    expect(p?.accounting_status).toBe('DA_XAC_NHAN');
    // Sale thường không làm được việc kế toán này.
    const dep2 = await pay(USERS.thao, { customer_id: 'cus-thao-1', amount: 100_000, method: 'Chuyển khoản', bank_ref: 'FT-SUG-2', purpose: 'DEPOSIT', explanation: 'Khách cọc thêm cho đơn tuần sau' });
    expect(dep2.status).toBe(200);
    const denied = await ctx.request(`/api/payments/${dep2.body.data.id}/confirm-attach`, { as: USERS.thao, body: { order_id: orderId } });
    expect(denied.status).toBe(403);
  });
  it('phiếu chi hoàn tiền: kế toán lập, cần bill + lý do, không quá số đã trả, không cần CEO duyệt', async () => {
    const orderId = await approvedOrder();
    const dep = await pay(USERS.manager, { customer_id: 'cus-thao-1', amount: 1_250_000, method: 'Chuyển khoản', bank_ref: 'FT-REF-1', allocations: [{ order_id: orderId, amount: 1_250_000 }], accounting_confirmed: true });
    expect(dep.status).toBe(200);
    const refund = (as: string, b: Record<string, unknown>) => ctx.request('/api/payments/refund', { as, body: { order_id: orderId, ...b } });
    expect((await refund(USERS.manager, { amount: 300_000, bill_ref: '', reason: 'Kho xuất thiếu 3 thùng' })).status).toBe(422);
    expect((await refund(USERS.manager, { amount: 300_000, bill_ref: 'FT-RF-9', reason: 'x' })).status).toBe(422);
    expect((await refund(USERS.manager, { amount: 2_000_000, bill_ref: 'FT-RF-9', reason: 'Kho xuất thiếu 3 thùng' })).status).toBe(422);
    expect((await refund(USERS.thao, { amount: 300_000, bill_ref: 'FT-RF-9', reason: 'Kho xuất thiếu 3 thùng' })).status).toBe(403);
    const ok = await refund(USERS.manager, { amount: 300_000, bill_ref: 'FT-RF-9', reason: 'Kho xuất thiếu 3 thùng' });
    expect(ok.status).toBe(200);
    const o = await ctx.db.prepare('SELECT payment_status FROM orders WHERE id = ?').bind(orderId).first<{ payment_status: string }>();
    expect(o?.payment_status).not.toBe('DA_THU_DU');
  });
  it('gửi bill kèm đơn và số tiền: tự ghi khoản tiền về chờ kế toán xác nhận, đơn hết "chưa thu"', async () => {
    const orderId = await approvedOrder();
    const up = await ctx.request('/api/bills', {
      as: USERS.thao,
      formData: billForm({ customer_id: 'cus-thao-1', order_id: orderId, amount: '1250000', paid_at: '2026-08-16', method: 'Chuyển khoản', kind: 'BILL' }),
    });
    expect(up.status).toBe(200);
    expect(up.body.data.payment_id).toBeTruthy();
    const p = await ctx.db.prepare('SELECT accounting_status, amount FROM payments WHERE id = ?').bind(up.body.data.payment_id).first<{ accounting_status: string; amount: number }>();
    expect(p?.accounting_status).toBe('CHUA_XAC_NHAN');
    expect(p?.amount).toBe(1_250_000);
    const o = await ctx.db.prepare('SELECT payment_status FROM orders WHERE id = ?').bind(orderId).first<{ payment_status: string }>();
    expect(o?.payment_status).toBe('DA_THU_DU');
    // Kế toán xác nhận được ngay trên khoản tiền đó.
    const ok = await ctx.request(`/api/payments/${up.body.data.payment_id}/confirm`, { as: USERS.manager, body: { confirmed: true } });
    expect(ok.status).toBe(200);
  });

  it('bill cũ đã lưu mà chưa thành tiền về: bấm ghi nhận từ bill là có khoản tiền chờ xác nhận', async () => {
    const orderId = await approvedOrder();
    // Bill tiền mặt không tự ghi (cần người nhận), nên còn "mồ côi".
    const up = await ctx.request('/api/bills', {
      as: USERS.thao,
      formData: billForm({ customer_id: 'cus-thao-1', order_id: orderId, amount: '500000', paid_at: '2026-08-16', method: 'Tiền mặt', kind: 'BILL' }),
    });
    expect(up.status).toBe(200);
    expect(up.body.data.payment_id).toBeNull();
    // Đổi sang chuyển khoản như bill gửi trước đây rồi ghi nhận từ bill.
    await ctx.db.prepare("UPDATE bills SET method = 'Chuyển khoản' WHERE id = ?").bind(up.body.data.id).run();
    const rec = await ctx.request(`/api/bills/${up.body.data.id}/record-payment`, { as: USERS.thao, body: {} });
    expect(rec.status).toBe(200);
    expect(rec.body.data.payment_id).toBeTruthy();
    const again = await ctx.request(`/api/bills/${up.body.data.id}/record-payment`, { as: USERS.thao, body: {} });
    expect(again.status).toBe(200);
    expect(again.body.data.payment_id).toBe(rec.body.data.payment_id);
  });
  it('ghi tiền ở công nợ (không chọn đơn): tự trừ đơn đặt trước, thừa trừ nợ cũ, hết nợ cũ mới thành số dư có', async () => {
    const orderA = await approvedOrder();
    const orderB = await approvedOrder();
    await ctx.db.prepare("UPDATE orders SET order_date = '2026-08-10' WHERE id = ?").bind(orderA).run();
    await ctx.db.prepare("UPDATE orders SET order_date = '2026-08-12' WHERE id = ?").bind(orderB).run();
    await ctx.db.prepare("UPDATE customers SET opening_debt = 100000 WHERE id = 'cus-thao-1'").run();
    // 1.500.000: đơn A (đặt trước) 1.250.000 đủ, đơn B nhận 250.000.
    const r1 = await pay(USERS.thao, { customer_id: 'cus-thao-1', amount: 1_500_000, method: 'Chuyển khoản' });
    expect(r1.status).toBe(200);
    const a = await ctx.db.prepare('SELECT payment_status FROM orders WHERE id = ?').bind(orderA).first<{ payment_status: string }>();
    const b = await ctx.db.prepare('SELECT payment_status FROM orders WHERE id = ?').bind(orderB).first<{ payment_status: string }>();
    expect(a?.payment_status).toBe('DA_THU_DU');
    expect(b?.payment_status).toBe('THU_MOT_PHAN');
    // 1.350.000: đơn B còn 1.000.000 đủ, còn 350.000: trừ nợ cũ 100.000, thừa 250.000 thành số dư có.
    const r2 = await pay(USERS.thao, { customer_id: 'cus-thao-1', amount: 1_350_000, method: 'Chuyển khoản' });
    expect(r2.status).toBe(200);
    const b2 = await ctx.db.prepare('SELECT payment_status FROM orders WHERE id = ?').bind(orderB).first<{ payment_status: string }>();
    expect(b2?.payment_status).toBe('DA_THU_DU');
    const credit = await ctx.db.prepare('SELECT amount FROM customer_credit_balances WHERE customer_id = ?').bind('cus-thao-1').first<{ amount: number }>();
    expect(credit?.amount).toBe(250_000);
    // Không còn khoản "chờ phân bổ".
    const pend = await ctx.db.prepare("SELECT COUNT(*) AS n FROM payment_allocations_pending WHERE status = 'PENDING'").first<{ n: number }>();
    expect(pend?.n).toBe(0);
  });
  it('bảng đối chiếu công nợ: khách nợ 2 đơn, đặt thêm 1 đơn, trả 2 đơn cũ, đơn mới còn nợ — mỗi khoản tiền ghi rõ đã trừ vào đâu', async () => {
    const o1 = await approvedOrder();
    const o2 = await approvedOrder();
    const o3 = await approvedOrder();
    await ctx.db.prepare("UPDATE orders SET order_date = '2026-08-01' WHERE id = ?").bind(o1).run();
    await ctx.db.prepare("UPDATE orders SET order_date = '2026-08-05' WHERE id = ?").bind(o2).run();
    await ctx.db.prepare("UPDATE orders SET order_date = '2026-08-16' WHERE id = ?").bind(o3).run();
    // Trả đúng 2 đơn cũ (mỗi đơn 1.250.000): đơn mới o3 còn nợ nguyên.
    const r = await pay(USERS.thao, { customer_id: 'cus-thao-1', amount: 2_500_000, method: 'Chuyển khoản' });
    expect(r.status).toBe(200);
    const st = await ctx.request('/api/customers/cus-thao-1/statement', { as: USERS.thao });
    expect(st.status).toBe(200);
    const d = st.body.data;
    expect(d.orders_remaining).toBe(1_250_000);
    expect(d.owed_total).toBe(1_250_000);
    expect(d.payments).toHaveLength(1);
    expect(d.payments[0].allocations).toHaveLength(2);
    const moi = d.orders.find((o: { id: string }) => o.id === o3);
    expect(moi.remaining).toBe(1_250_000);
  });
  it('"Việc của tôi": kế toán thấy tiền chờ xác nhận và số ngày tồn, sale chỉ thấy việc của mình', async () => {
    const orderId = await approvedOrder();
    const dep = await pay(USERS.thao, { customer_id: 'cus-thao-1', amount: 1_250_000, method: 'Chuyển khoản', allocations: [{ order_id: orderId, amount: 1_250_000 }] });
    expect(dep.status).toBe(200);
    await ctx.db.prepare("UPDATE payments SET paid_at = '2026-08-10' WHERE id = ?").bind(dep.body.data.id).run();
    const acc = await ctx.request('/api/work/mine', { as: USERS.manager });
    expect(acc.status).toBe(200);
    const it = acc.body.data.find((x: { key: string }) => x.key === 'pay_confirm');
    expect(it.count).toBeGreaterThanOrEqual(1);
    expect(it.age_days).toBeGreaterThan(30);
    const sale = await ctx.request('/api/work/mine', { as: USERS.thao });
    expect(sale.status).toBe(200);
    expect(sale.body.data.some((x: { key: string }) => x.key === 'pay_confirm')).toBe(false);
  });
  it('"Toàn cảnh" cho CEO: thấy việc kế toán, kho, bán hàng cả công ty; sale thường không xem được', async () => {
    const orderId = await approvedOrder();
    await pay(USERS.thao, { customer_id: 'cus-thao-1', amount: 1_250_000, method: 'Chuyển khoản', allocations: [{ order_id: orderId, amount: 1_250_000 }] });
    const ceo = await ctx.request('/api/work/overview', { as: USERS.ceo });
    expect(ceo.status).toBe(200);
    const keys = (ceo.body.data.items as Array<{ key: string }>).map((x) => x.key);
    expect(keys).toContain('pay_confirm');
    expect(keys).not.toContain('draft');
    expect(typeof ceo.body.data.sale.count).toBe('number');
    expect(typeof ceo.body.data.cskh.age_days).toBe('number');
    const sale = await ctx.request('/api/work/overview', { as: USERS.thao });
    expect(sale.status).toBe(403);
  });
  it('khoản tiền ghi từ trước chưa trừ đơn: kế toán bấm "tự chia" thì chia vào đơn đặt trước, thừa thành số dư có', async () => {
    const o1 = await approvedOrder();
    const o2 = await approvedOrder();
    await ctx.db.prepare("UPDATE orders SET order_date = '2026-08-01' WHERE id = ?").bind(o1).run();
    await ctx.db.prepare("UPDATE orders SET order_date = '2026-08-09' WHERE id = ?").bind(o2).run();
    const r = await pay(USERS.thao, { customer_id: 'cus-thao-1', amount: 3_000_000, method: 'Chuyển khoản' });
    expect(r.status).toBe(200);
    // Giả lập khoản ghi từ trước: chưa chia vào đơn nào.
    await ctx.db.prepare('DELETE FROM payment_allocations WHERE payment_id = ?').bind(r.body.data.id).run();
    await ctx.db.prepare("UPDATE orders SET payment_status = 'CHUA_THU'").run();
    await ctx.db.prepare('DELETE FROM customer_credit_balances').run();
    await ctx.db.prepare("DELETE FROM audit_logs WHERE action = 'PAYMENT_LEFTOVER_SETTLED'").run();
    const denied = await ctx.request(`/api/payments/${r.body.data.id}/auto-allocate`, { as: USERS.thao, body: {} });
    expect(denied.status).toBe(403);
    const ok = await ctx.request(`/api/payments/${r.body.data.id}/auto-allocate`, { as: USERS.manager, body: {} });
    expect(ok.status).toBe(200);
    expect(ok.body.data.allocated).toBe(2_500_000);
    expect(ok.body.data.to_credit).toBe(500_000);
    const a = await ctx.db.prepare('SELECT payment_status FROM orders WHERE id = ?').bind(o1).first<{ payment_status: string }>();
    expect(a?.payment_status).toBe('DA_THU_DU');
  });
  const creditOf = async () => (await ctx.db.prepare("SELECT amount FROM customer_credit_balances WHERE customer_id = 'cus-thao-1'").first<{ amount: number }>())?.amount ?? 0;
  const unallocatedItem = async () => {
    const r = await ctx.request('/api/work/mine', { as: USERS.manager });
    return (r.body.data as Array<{ key: string; count: number }>).find((x) => x.key === 'pay_unallocated');
  };
  it('tiền thừa chỉ xử lý một lần: ghi xong là hết khỏi danh sách việc; bấm tự chia nhiều lần không cộng số dư có thêm', async () => {
    const orderId = await approvedOrder();
    const r = await pay(USERS.thao, { customer_id: 'cus-thao-1', amount: 1_500_000, method: 'Chuyển khoản' });
    expect(r.status).toBe(200);
    expect(await creditOf()).toBe(250_000);
    expect(await unallocatedItem()).toBeUndefined();
    for (let i = 0; i < 3; i++) {
      const all = await ctx.request('/api/payments/auto-allocate-all', { as: USERS.manager, body: {} });
      expect(all.status).toBe(200);
      expect(all.body.data.processed).toBe(0);
      const one = await ctx.request(`/api/payments/${r.body.data.id}/auto-allocate`, { as: USERS.manager, body: {} });
      expect(one.status).toBe(200);
    }
    expect(await creditOf()).toBe(250_000);
    const st = await ctx.db.prepare('SELECT payment_status FROM orders WHERE id = ?').bind(orderId).first<{ payment_status: string }>();
    expect(st?.payment_status).toBe('DA_THU_DU');
  });
  it('khoản ghi từ trước (chưa có dấu) mà khách hết đơn: "Xem trước" không ghi gì, tự chia không đụng, bấm "đã kiểm" chỉ bỏ khỏi danh sách', async () => {
    await approvedOrder();
    const r = await pay(USERS.thao, { customer_id: 'cus-thao-1', amount: 1_500_000, method: 'Chuyển khoản' });
    expect(r.status).toBe(200);
    // Giả lập khoản cũ: xoá dấu "đã xử lý phần thừa".
    await ctx.db.prepare("DELETE FROM audit_logs WHERE action = 'PAYMENT_LEFTOVER_SETTLED'").run();
    expect((await unallocatedItem())?.count).toBe(1);
    const auditBefore = (await ctx.db.prepare('SELECT COUNT(*) AS n FROM audit_logs').first<{ n: number }>())?.n;
    const pv = await ctx.request('/api/payments/auto-allocate-preview', { as: USERS.manager });
    expect(pv.status).toBe(200);
    expect(pv.body.data.with_orders.n).toBe(0);
    expect(pv.body.data.leftover_only.n).toBe(1);
    expect(pv.body.data.leftover_only.customers[0].credit_now).toBe(250_000);
    expect((await ctx.db.prepare('SELECT COUNT(*) AS n FROM audit_logs').first<{ n: number }>())?.n).toBe(auditBefore);
    const denied = await ctx.request('/api/payments/auto-allocate-preview', { as: USERS.thao });
    expect(denied.status).toBe(403);
    const all = await ctx.request('/api/payments/auto-allocate-all', { as: USERS.manager, body: {} });
    expect(all.body.data.processed).toBe(0);
    expect(await creditOf()).toBe(250_000);
    const mark = await ctx.request('/api/payments/leftover-reviewed', { as: USERS.manager, body: {} });
    expect(mark.status).toBe(200);
    expect(mark.body.data.marked).toBe(1);
    expect(await creditOf()).toBe(250_000);
    expect(await unallocatedItem()).toBeUndefined();
  });
  it('khoản cũ còn đơn thiếu tiền: xem trước đúng số, tự chia cộng số dư có đúng một lần dù bấm lại', async () => {
    const o1 = await approvedOrder();
    const o2 = await approvedOrder();
    await ctx.db.prepare("UPDATE orders SET order_date = '2026-08-01' WHERE id = ?").bind(o1).run();
    await ctx.db.prepare("UPDATE orders SET order_date = '2026-08-09' WHERE id = ?").bind(o2).run();
    const r = await pay(USERS.thao, { customer_id: 'cus-thao-1', amount: 3_000_000, method: 'Chuyển khoản' });
    await ctx.db.prepare('DELETE FROM payment_allocations WHERE payment_id = ?').bind(r.body.data.id).run();
    await ctx.db.prepare("UPDATE orders SET payment_status = 'CHUA_THU'").run();
    await ctx.db.prepare('DELETE FROM customer_credit_balances').run();
    await ctx.db.prepare("DELETE FROM audit_logs WHERE action = 'PAYMENT_LEFTOVER_SETTLED'").run();
    const pv = await ctx.request('/api/payments/auto-allocate-preview', { as: USERS.manager });
    expect(pv.body.data.with_orders).toMatchObject({ n: 1, to_orders: 2_500_000, to_credit: 500_000 });
    expect(pv.body.data.leftover_only.n).toBe(0);
    for (let i = 0; i < 3; i++) {
      const all = await ctx.request('/api/payments/auto-allocate-all', { as: USERS.manager, body: {} });
      expect(all.status).toBe(200);
    }
    expect(await creditOf()).toBe(500_000);
    expect(await unallocatedItem()).toBeUndefined();
  });
  it('khách đặt cọc thật: đơn xuất kho thì tự trừ cọc vào đơn, cọc còn dư vẫn là của khách; có nút trừ tay', async () => {
    const dep = await pay(USERS.thao, { customer_id: 'cus-thao-1', amount: 3_000_000, purpose: 'DEPOSIT', method: 'Chuyển khoản', explanation: 'Cọc cho đơn tuần này' });
    expect(dep.status).toBe(200);
    const o1 = await approvedOrder();
    const shipped = await ctx.request(`/api/orders/${o1}/delivery`, { as: USERS.manager, body: { delivery_status: 'DA_XUAT_KHO', ship_day: '2026-08-16', shipped_by_name: 'Kho A' } });
    expect(shipped.status).toBe(200);
    const a = await ctx.db.prepare('SELECT payment_status FROM orders WHERE id = ?').bind(o1).first<{ payment_status: string }>();
    expect(a?.payment_status).toBe('DA_THU_DU');
    const alloc = await ctx.db.prepare('SELECT SUM(amount) AS n FROM payment_allocations WHERE payment_id = ?').bind(dep.body.data.id).first<{ n: number }>();
    expect(alloc?.n).toBe(1_250_000);
    // Đơn thứ hai: duyệt xong là đã tự trừ cọc; nút trừ tay không trừ thêm lần nữa.
    const o2 = await approvedOrder();
    const d2 = await ctx.request(`/api/orders/${o2}`, { as: USERS.thao });
    expect(d2.body.data.deposit_applied).toBe(1_250_000);
    const manual = await ctx.request(`/api/orders/${o2}/apply-deposit`, { as: USERS.manager, body: {} });
    expect(manual.status).toBe(200);
    expect(manual.body.data.applied).toBe(0);
    const denied = await ctx.request(`/api/orders/${o2}/apply-deposit`, { as: USERS.thao, body: {} });
    expect(denied.status).toBe(403);
    // Cọc còn dư 500.000 là của khách (số dư có), không bị tính hai lần.
    const st = await ctx.request('/api/customers/cus-thao-1/statement', { as: USERS.thao });
    expect(st.body.data.credit).toBe(500_000);
  });
  it('khách đã đặt cọc: đơn vừa được duyệt là hiện luôn tiền cọc đã trừ; nạp bill phần còn lại thì ghi tiền, phần thiếu vẫn là công nợ', async () => {
    const dep = await pay(USERS.thao, { customer_id: 'cus-thao-1', amount: 500_000, purpose: 'DEPOSIT', method: 'Chuyển khoản', explanation: 'Cọc đơn tuần này' });
    expect(dep.status).toBe(200);
    const orderId = await approvedOrder();
    const d = await ctx.request(`/api/orders/${orderId}`, { as: USERS.thao });
    expect(d.body.data.deposit_applied).toBe(500_000);
    expect(d.body.data.remaining_amount).toBe(750_000);
    // Khách chuyển thêm 600.000 (còn thiếu 150.000): ghi tiền bình thường, phần thiếu còn lại trên đơn.
    const r = await pay(USERS.thao, { customer_id: 'cus-thao-1', amount: 600_000, method: 'Chuyển khoản', allocations: [{ order_id: orderId, amount: 600_000 }] });
    expect(r.status).toBe(200);
    const after = await ctx.request(`/api/orders/${orderId}`, { as: USERS.thao });
    expect(after.body.data.remaining_amount).toBe(150_000);
    expect(after.body.data.payment_status).toBe('THU_MOT_PHAN');
  });
  it('khoản tiền nêu rõ mã đơn trong ghi chú: trừ đúng đơn đó trước, không theo đơn cũ nhất; xem trước khớp', async () => {
    const o1 = await approvedOrder();
    const o2 = await approvedOrder();
    await ctx.db.prepare("UPDATE orders SET order_date = '2026-08-01' WHERE id = ?").bind(o1).run();
    await ctx.db.prepare("UPDATE orders SET order_date = '2026-08-09' WHERE id = ?").bind(o2).run();
    const no2 = (await ctx.db.prepare('SELECT order_no FROM orders WHERE id = ?').bind(o2).first<{ order_no: string }>())!.order_no;
    const r = await pay(USERS.thao, { customer_id: 'cus-thao-1', amount: 1_000_000, method: 'Chuyển khoản' });
    expect(r.status).toBe(200);
    await ctx.db.prepare('DELETE FROM payment_allocations WHERE payment_id = ?').bind(r.body.data.id).run();
    await ctx.db.prepare("UPDATE orders SET payment_status = 'CHUA_THU'").run();
    await ctx.db.prepare('DELETE FROM customer_credit_balances').run();
    await ctx.db.prepare("DELETE FROM audit_logs WHERE action = 'PAYMENT_LEFTOVER_SETTLED'").run();
    await ctx.db.prepare('UPDATE payments SET note = ? WHERE id = ?').bind(`Khach CK don ${no2}`, r.body.data.id).run();
    const pv = await ctx.request('/api/payments/auto-allocate-preview', { as: USERS.manager });
    expect(pv.body.data.named_n).toBe(1);
    const ok = await ctx.request(`/api/payments/${r.body.data.id}/auto-allocate`, { as: USERS.manager, body: {} });
    expect(ok.status).toBe(200);
    const rows = await ctx.db.prepare('SELECT order_id, amount FROM payment_allocations WHERE payment_id = ?').bind(r.body.data.id).all<{ order_id: string; amount: number }>();
    expect(rows.results?.map((x) => x.order_id)).toEqual([o2]);
  });
  it('sửa ngày khoản tiền nhập nhầm ngày/tháng (có lý do) và xóa an toàn khoản chưa xác nhận', async () => {
    await approvedOrder();
    const r = await pay(USERS.thao, { customer_id: 'cus-thao-1', amount: 500_000, method: 'Chuyển khoản' });
    const id = r.body.data.id as string;
    const bad = await ctx.request(`/api/payments/${id}/fix-date`, { as: USERS.manager, body: { paid_at: '2026-10-05' } });
    expect(bad.status).toBe(400);
    const fx = await ctx.request(`/api/payments/${id}/fix-date`, { as: USERS.manager, body: { paid_at: '2026-01-05', reason: 'Nhập nhầm ngày/tháng' } });
    expect(fx.status).toBe(200);
    const row = await ctx.db.prepare('SELECT paid_at FROM payments WHERE id = ?').bind(id).first<{ paid_at: string }>();
    expect(row?.paid_at).toBe('2026-01-05');
    const noWhy = await ctx.request(`/api/payments/${id}/void`, { as: USERS.manager, body: { reason: '' } });
    expect(noWhy.status).toBe(400);
  });
  it('bill đã gắn đơn nhưng khoản tiền ghi lúc đơn chưa duyệt (chưa trừ đơn, đã thành số dư có): đơn duyệt xong thì tự trừ đúng đơn và trả lại số dư có', async () => {
    const orderId = await approvedOrder();
    const r = await pay(USERS.thao, { customer_id: 'cus-thao-1', amount: 1_000_000, method: 'Chuyển khoản' });
    expect(r.status).toBe(200);
    const pid = r.body.data.id as string;
    // Giả lập: lúc ghi đơn chưa duyệt nên không trừ đơn, phần tiền bị tính thành số dư có.
    await ctx.db.prepare('DELETE FROM payment_allocations WHERE payment_id = ?').bind(pid).run();
    await ctx.db.prepare("UPDATE orders SET payment_status = 'CHUA_THU'").run();
    await ctx.db.prepare('DELETE FROM customer_credit_balances').run();
    await ctx.db.prepare("INSERT INTO customer_credit_balances (id, customer_id, amount, updated_at) VALUES ('cb-x', 'cus-thao-1', 1000000, '2026-01-01')").run();
    await ctx.db.prepare("DELETE FROM audit_logs WHERE action = 'PAYMENT_LEFTOVER_SETTLED'").run();
    await ctx.db
      .prepare("INSERT INTO audit_logs (id, action, entity_type, entity_id, after_json, created_at) VALUES ('al-x', 'PAYMENT_LEFTOVER_SETTLED', 'PAYMENT', ?, ?, '2026-01-01')")
      .bind(pid, JSON.stringify({ to_old_debt: 0, to_credit: 1_000_000 }))
      .run();
    await ctx.db
      .prepare("INSERT INTO bills (id, customer_id, order_id, payment_id, amount, name, mime, size, data, created_at) VALUES ('bill-x', 'cus-thao-1', ?, ?, 1000000, 'b.png', 'image/png', 1, x'00', '2026-01-01')")
      .bind(orderId, pid)
      .run();
    const ok = await ctx.request(`/api/orders/${orderId}/apply-deposit`, { as: USERS.manager, body: {} });
    expect(ok.status).toBe(200);
    const rows = await ctx.db.prepare('SELECT order_id, amount FROM payment_allocations WHERE payment_id = ?').bind(pid).all<{ order_id: string; amount: number }>();
    expect(rows.results?.map((x) => x.order_id)).toEqual([orderId]);
    expect(await creditOf()).toBe(0);
  });
});
