# Đối chiếu tiêu chí nghiệm thu AC-01 → AC-15

Cập nhật: 16/08/2026 · Chạy lại bằng `npm test` (79 test, thời gian ~3 giây).

| Mã | Kịch bản | Kết quả | Bằng chứng |
|---|---|---|---|
| AC-01 | Employee vào khu quản trị | **PASS** | `tests/e2e/acceptance.test.ts` › "AC-01" - `/api/dashboards/manager`, `/api/dashboards/ceo`, `/api/imports`, `/api/approvals` đều trả 403 |
| AC-02 | Thảo gọi API khách của Huyền | **PASS** | `tests/e2e/acceptance.test.ts` › "AC-02" - trả 404, phản hồi không chứa tên khách |
| AC-03 | Preview file nguồn: 134 SKU, 11 mã thiếu giá | **PASS** | "AC-03" - `totals.products = 134`, đúng 11 cảnh báo `MISSING_PRICE`, preview không ghi dữ liệu (bảng `products` vẫn rỗng) |
| AC-04 | Commit khách: 62 khách, Thảo 48 / Huyền 14, phone TEXT | **PASS** | "AC-04" - kiểm tra số lượng theo owner, `typeof phone_text === 'string'`, số 0 đầu được khôi phục, 2 khách cấp "Khác" giữ `tier_id = NULL` |
| AC-05 | Commit đơn: 35 đơn / 206 dòng, 34 đơn quản lý, 1 cảnh báo | **PASS** | "AC-05" - `orders = 35`, `order_items = 205` (dòng thiếu mã đơn không tạo đơn giả mà vào `import_errors`) |
| AC-06 | Đối soát ba tổng công nợ | **PASS** | "AC-06" - khớp 180.073.600đ / 1.256.920.982đ / 1.168.465.995đ / 1.397.046.765đ → batch `RECONCILED`; trường hợp lệch → `COMMITTED` + cảnh báo `IMPORT_RECONCILIATION_FAILED` |
| AC-07 | Chọn SKU/cấp có giá NULL | **PASS** | "AC-07" - trả 422 `ORDER_LINE_BLOCKED` kèm đúng mã SKU; khách chưa map cấp trả `TIER_UNKNOWN`. Đã kiểm tra thêm trên giao diện: dòng hiện lỗi "Mã DEV-TOILET chưa có giá ở cấp giá của khách" |
| AC-08 | Sale sửa đơn giá | **PASS** | "AC-08" - lưu cả `base_price` và `applied_price`, sinh approval `PRICE_OVERRIDE`; lệch 20% > ngưỡng nên Quản lý duyệt bị 403, CEO duyệt được |
| AC-09 | Đơn làm vượt hạn mức | **PASS** | "AC-09" - sinh approval `DEBT_LIMIT_EXCEEDED` với `required_role = CEO`, đơn ở `PENDING_APPROVAL` |
| AC-10 | Lưu chăm sóc thiếu lịch tiếp | **PASS** | "AC-10" - trả 400 kèm `fields.next_date`; đóng khách có `reason_code` thì lưu được và chuyển `stage = LOST` |
| AC-11 | Import trả nợ chung | **PASS** | "AC-11" - 26 payment, 16 khoản vào `payment_allocations_pending`, 0 khoản tự trừ vào đơn, ≥19 phiếu `NEEDS_REVIEW` |
| AC-12 | Quản lý đổi owner | **PASS** | "AC-12" - audit có actor, before/after, reason, request_id, created_at |
| AC-13 | Gửi tạo đơn/import hai lần | **PASS** | "AC-13" - cùng `Idempotency-Key` chỉ tạo 1 đơn/1 khách; key trùng nội dung khác → 409; import lại cùng file không nhân đôi payment/khách |
| AC-14 | Mở `/sales` ở 360px | **PASS (kiểm tra trên trình duyệt)** | Ở viewport 375px: sidebar ẩn, thanh điều hướng dưới hiện, KPI về 1 cột, `document.documentElement.scrollWidth` không vượt viewport; bảng rộng cuộn ngang trong khung riêng. Nên xem lại lần cuối trên điện thoại thật trước go-live |
| AC-15 | Push `main` → CI đạt và Cloudflare tự deploy | **CHƯA XÁC MINH ĐƯỢC** | Workflow đã có tại `.github/workflows/ci.yml` (lint → typecheck → test → build → chặn commit file Excel/secrets), nhưng cần tài khoản GitHub + Cloudflare thật để chạy. Xem `docs/TRIEN-KHAI-CLOUDFLARE.md` |

## Những điểm cần biết khi nghiệm thu

1. **Test e2e chạy ở tầng API**, không phải trình duyệt tự động: cùng code Hono, cùng file
   migration, cùng RBAC như production, chạy trên SQLite của Node. Phần giao diện đã được kiểm tra
   thủ công trên trình duyệt (đăng nhập, việc hôm nay, bảng giá, chặn giá NULL, dashboard quản lý,
   responsive).
2. **File Excel dùng để test là dữ liệu giả lập** (`tests/fixtures/workbook.ts`) được dựng đúng
   các mốc của tài liệu. Khi có file `01-CRM-B2B-AILLA.xlsx` thật, chạy:
   ```bash
   npm run import:preview -- "đường-dẫn/01-CRM-B2B-AILLA.xlsx"
   ```
   Công cụ sẽ in bảng đối soát và danh sách lỗi/cảnh báo mà không ghi vào database. Nếu tên cột
   trong file thật khác với các bí danh đã hỗ trợ, bổ sung bí danh trong
   `src/server/services/import/parser.ts` rồi chạy lại.
3. **Chưa nghiệm thu được trên Cloudflare thật** (AC-15) vì chưa có tài khoản/bindings. Ngoài ra
   `wrangler dev` không khởi động được trên máy Windows đang dùng (workerd báo access violation),
   nên dự án có thêm `npm run dev:node` chạy đúng code Worker trên Node để lập trình và kiểm thử.
   Trên máy/CI khác, `npm run dev:worker` vẫn là đường chạy chuẩn.
