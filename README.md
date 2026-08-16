# AILLA B2B CRM

Ứng dụng CRM nội bộ cho Công ty CP TM & XNK AILLA Việt Nam, xây theo tài liệu
`AILLA_B2B_CRM_Dac_ta_ChatGPT_Code.docx` (phiên bản 2.0). Hai file `admin.html` và `user.html` là
tham chiếu giao diện; DOCX là nguồn sự thật về dữ liệu, quyền, quy trình, API và nghiệm thu.

**Một database dùng chung, hai không gian giao diện:**

| Đường dẫn | Dành cho | Nội dung chính |
|---|---|---|
| `/sales` | Nhân viên Sale | Việc hôm nay, khách của tôi, tạo đơn, bảng giá, công nợ, kết quả cá nhân |
| `/admin` | Quản lý và CEO | Điều hành đội ngũ, bàn điều hành CEO, duyệt ngoại lệ, import, công nợ, audit |

## 1. Kiến trúc

| Thành phần | Công nghệ |
|---|---|
| Frontend | React 18 + TypeScript + Vite (SPA) |
| Backend | Hono trên Cloudflare Workers (TypeScript) |
| Database | Cloudflare D1 (SQLite) - migration trong `migrations/` |
| File | Cloudflare R2 (file import, bản lỗi) |
| Đăng nhập | Cloudflare Access (verify JWT) + bảng `users` để phân vai trò |
| Tác vụ nền | Cron Trigger mỗi giờ: sinh cảnh báo quá hạn/tái nhập/công nợ |

Không dùng `localStorage` làm nguồn dữ liệu; mọi thay đổi đi qua API và ghi audit trong cùng
transaction với dữ liệu nghiệp vụ.

```
src/
  client/    React SPA: routes /sales và /admin, dùng chung component + design AILLA
  server/    Hono: middleware auth/RBAC, routes, services, import Excel
  shared/    Logic dùng chung: giá, công thức đơn, công nợ, cảnh báo, quyền, schema zod
migrations/  SQL cho D1 (không sửa migration đã chạy production)
seed/        Dữ liệu dev đã ẩn danh
scripts/     CLI kiểm tra file import, reset DB local
tests/       unit · integration · e2e (AC-01 → AC-15)
```

## 2. Chạy ở máy lập trình

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:reset:local     # tạo D1 local + nạp dữ liệu dev đã ẩn danh
```

Mở hai cửa sổ terminal:

```bash
npm run dev:worker
```

```bash
npm run dev
```

> **Máy Windows không chạy được `wrangler dev`?** Một số máy báo lỗi workerd
> (`access violation`). Khi đó dùng dev server dự phòng chạy đúng code Worker trên Node + SQLite:
>
> ```bash
> npm run dev:node          # API tại http://127.0.0.1:8787 (thêm --fresh để tạo lại dữ liệu)
> ```
>
> Dữ liệu nằm ở `.dev-data/crm.sqlite`. Cách này chỉ dùng để lập trình/kiểm thử; bản deploy luôn
> chạy trên Cloudflare Workers + D1.

Vào `http://localhost:5173`. Ở local không có Cloudflare Access nên màn hình đăng nhập cho chọn
tài khoản mẫu (`thao@ailla.vn`, `huyen@ailla.vn`, `quanly@ailla.vn`, `ceo@ailla.vn`). Cơ chế này
chỉ bật khi `ENVIRONMENT=development`; ở staging/production Worker bắt buộc verify JWT của Access.

## 3. Lệnh thường dùng

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy giao diện (proxy `/api` sang Worker) |
| `npm run dev:worker` | Chạy Worker + D1 local (chuẩn Cloudflare) |
| `npm run dev:node` | Dev server dự phòng khi wrangler không chạy được |
| `npm test` | Chạy toàn bộ test |
| `npm run lint` / `npm run typecheck` | Kiểm tra chất lượng mã |
| `npm run build` | Build SPA vào `dist/client` |
| `npm run db:migrate:local` | Áp migration cho D1 local |
| `npm run db:reset:local` | Xoá và tạo lại D1 local (chỉ local, chặn trên CI) |
| `npm run import:preview -- <file.xlsx>` | Kiểm tra file Excel offline trước khi import |
| `npm run deploy:staging` / `npm run deploy:prod` | Deploy thủ công khi cần |

## 4. Import file CRM Excel (bắt buộc 2 bước)

1. **Preview** (`POST /api/imports/preview`): đọc file, chuẩn hoá, phát hiện lỗi theo dòng, tính
   tổng và đối soát. **Không ghi dữ liệu nghiệp vụ.**
2. **Commit** (`POST /api/imports/commit`): chỉ chạy với batch đã preview và file có checksum khớp.

Mốc đối soát lần đầu (mục 12.2 của đặc tả) được lưu trong `app_settings.reconciliation.baseline`:

| Chỉ tiêu | Mốc |
|---|---|
| SKU | 134 |
| Khách hàng | 62 |
| Đơn nguồn / dòng sản phẩm | 35 / 206 |
| Đơn ở sheet quản lý | 34 |
| Giao dịch thanh toán | 26 = 180.073.600đ |
| Dư nợ cũ | 1.256.920.982đ |
| Công nợ chính thức | 1.168.465.995đ |
| Công nợ dự kiến | 1.397.046.765đ |

Nếu bất kỳ tổng nào lệch, batch **không** được đánh dấu `RECONCILED`; hệ thống hiển thị dòng lệch
và sinh cảnh báo `IMPORT_RECONCILIATION_FAILED`.

Quy tắc dữ liệu được giữ đúng như đặc tả:

- Điện thoại luôn lưu TEXT, khôi phục số 0 đầu khi Excel lưu dạng số; khách thiếu số vào
  `NEEDS_REVIEW`, không bịa dữ liệu.
- Ô giá trống giữ `NULL` và bị chặn bán; giá 0 thật thì giữ 0 kèm cảnh báo.
- Dòng chưa khai báo mã đơn không bị bỏ - vào `import_errors` như hàng chờ xử lý.
- Phiếu thu thiếu mã vẫn import nhưng `review_status = NEEDS_REVIEW`; khoản trả nợ chung vào
  `payment_allocations_pending`, chưa trừ vào từng đơn.
- Sheet `CANH_BAO` không import (chứa công thức `#REF!`); cảnh báo được tính lại bằng truy vấn.

**Rollback:** `POST /api/imports/:id/rollback` xoá dữ liệu của batch. Lưu ý rollback cũng xoá
activity/task gắn với khách của batch, nên chỉ dùng ngay sau khi commit và trước khi đội sale bắt
đầu nhập liệu trên bộ dữ liệu đó.

## 5. Quy tắc nghiệp vụ cài trong backend

- **Bảng giá 8 cấp**: GĐKD, TPP, NPP, Tổng đại lý, Đại lý cấp 1, Đại lý cấp 2, Đại sứ, Bán lẻ.
  Giá lưu chuẩn hoá theo `product_prices(product_id, tier_id, amount, valid_from, valid_to)`.
- **Tạo đơn**: giá lấy theo cấp khách tại ngày đơn; giá `NULL` hoặc khách chưa map cấp thì **chặn**.
  Giá sửa tay giữ cả `base_price` và `applied_price`, sinh yêu cầu duyệt (Quản lý trong ngưỡng,
  CEO khi vượt ngưỡng cấu hình).
- **Công thức**: `tổng phải thu = tiền hàng − chiết khấu − trừ thưởng + phí vận chuyển`;
  `còn phải thu = tổng phải thu − COD/đặt cọc − đã phân bổ`.
- **Công nợ tách 3 khái niệm**: chính thức, chờ ghi nợ/chờ tiền về, dự kiến. Thu thừa thành
  `credit_balance`, không dùng số âm.
- **Chăm sóc**: khách chưa đóng bắt buộc có bước tiếp theo và ngày chăm sóc tiếp; kết quả
  Từ chối/Mất khách bắt buộc mã lý do. Activity là append-only.
- **Idempotency**: mọi POST quan trọng nhận header `Idempotency-Key`; gửi lại cùng nội dung trả về
  kết quả cũ, khác nội dung thì trả 409.

## 6. Phân quyền

Kiểm tra ở backend cho từng endpoint (ẩn menu chỉ là UX):

| | Nhân viên | Quản lý | CEO |
|---|---|---|---|
| Khách hàng | chỉ khách được giao | toàn đội | toàn công ty (chỉ đọc) |
| Tạo đơn | khách của mình | toàn đội | không |
| Duyệt | không | trong ngưỡng | ngoại lệ lớn |
| Import | không | có | chỉ xem |
| Audit | thao tác của mình | toàn đội | toàn bộ |

Nhân viên sửa URL để mở khách của người khác sẽ nhận 404 - không lộ tên hay sự tồn tại của hồ sơ.

## 7. Kiểm thử

```bash
npm test                  # 79 test: unit + integration + e2e
npm run test:unit         # quy tắc giá, công nợ, đơn hàng, cảnh báo, vòng đời khách
npm run test:integration  # API thật + RBAC + audit + phân bổ thanh toán
npm run test:e2e          # kịch bản AC-01 → AC-13 (xem docs/NGHIEM-THU-AC.md)
```

Test chạy trên SQLite của Node với **đúng file migration production**, nên lỗi SQL sẽ lộ ngay ở CI.

## 8. Triển khai Cloudflare

Xem `docs/TRIEN-KHAI-CLOUDFLARE.md` để làm theo từng bước (tạo D1/R2, Access, secrets, domain).
Tóm tắt:

```bash
npx wrangler d1 create ailla_crm_prod        # chép database_id vào wrangler.jsonc
npx wrangler r2 bucket create ailla-crm-files-prod
npm run db:migrate:prod
npm run deploy:prod
```

Cloudflare Builds nối GitHub: push nhánh `main` → CI chạy lint/typecheck/test/build → deploy.

**Rollback deploy:** `npx wrangler rollback --env production` hoặc chọn bản build trước trong
Dashboard → Workers → Deployments.

## 9. Bảo mật

- Repo GitHub để **Private**; không commit file Excel production, `.dev.vars`, `.env` (CI có bước
  kiểm tra chặn).
- Secrets đặt bằng `npx wrangler secret put <TÊN>` hoặc trong Dashboard.
- Worker đặt CSP, secure headers, không trả stack trace ra ngoài.
- Thời gian lưu UTC, hiển thị theo giờ Việt Nam (Asia/Ho_Chi_Minh).
