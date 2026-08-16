/**
 * Mảnh SQL dùng chung cho tiền thanh toán.
 *
 * Số tiền trong bảng payments LUÔN dương. Khoản bút toán đảo (is_adjustment = 1) mang ý nghĩa
 * TRỪ ĐI khoản đã ghi nhận trước đó, nên mọi phép cộng tiền phải nhân dấu theo cờ này.
 */

/** Số tiền có dấu của một phiếu thu, dùng khi bảng payments có bí danh `p`. */
export const SIGNED_PAYMENT = `CASE WHEN p.is_adjustment = 1 THEN -p.amount ELSE p.amount END`;

/**
 * Tổng tiền đã phân bổ theo từng ĐƠN, đã tính dấu bút toán đảo.
 * Dùng thay cho `SELECT order_id, SUM(amount) ... FROM payment_allocations`.
 */
export const RECEIVED_BY_ORDER = `
  SELECT pa.order_id AS order_id,
         SUM(CASE WHEN p.is_adjustment = 1 THEN -pa.amount ELSE pa.amount END) AS received
  FROM payment_allocations pa
  JOIN payments p ON p.id = pa.payment_id
  WHERE pa.reversed_at IS NULL
  GROUP BY pa.order_id`;

/** Tổng tiền đã phân bổ theo từng PHIẾU THU (dùng để biết phiếu còn dư bao nhiêu). */
export const ALLOCATED_BY_PAYMENT = `
  SELECT payment_id, SUM(amount) AS allocated
  FROM payment_allocations
  WHERE reversed_at IS NULL
  GROUP BY payment_id`;
