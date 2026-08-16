# Checklist triển khai Cloudflare (mục 18 của đặc tả)

Làm theo đúng thứ tự. Mỗi bước có ô đánh dấu để đội kỹ thuật tick khi hoàn thành.

## 1. GitHub

- [ ] Tạo repository **Private** (ví dụ `ailla/ailla-b2b-crm`) và push toàn bộ mã nguồn.
- [ ] Bật branch protection cho `main`: bắt buộc pull request + CI xanh mới merge.
- [ ] Kiểm tra repo **không** chứa: file `.xlsx` dữ liệu thật, `.dev.vars`, `.env`, khoá API.
      (CI đã có bước tự kiểm tra và sẽ fail nếu phát hiện.)

## 2. Database D1

```bash
npx wrangler d1 create ailla_crm_dev
npx wrangler d1 create ailla_crm_staging
npx wrangler d1 create ailla_crm_prod
```

- [ ] Chép `database_id` của từng môi trường vào `wrangler.jsonc`
      (thay các chỗ `REPLACE_WITH_..._D1_ID`).
- [ ] Chạy migration:
      `npm run db:migrate:dev` · `npm run db:migrate:staging` · `npm run db:migrate:prod`

## 3. R2 (file import/export)

```bash
npx wrangler r2 bucket create ailla-crm-files-dev
npx wrangler r2 bucket create ailla-crm-files-staging
npx wrangler r2 bucket create ailla-crm-files-prod
```

- [ ] Đặt lifecycle/retention cho thư mục `imports/` (gợi ý: giữ 180 ngày).
- [ ] Không bật public access cho bucket.

## 4. Cloudflare Access

- [ ] Zero Trust → Access → Applications → thêm ứng dụng self-hosted cho `crm.ailla.vn`.
- [ ] Policy: chỉ cho phép danh sách email nhân sự đã duyệt (Thảo, Huyền, Quản lý, CEO).
- [ ] Lấy **Team domain** (dạng `ailla.cloudflareaccess.com`) và **Application Audience (AUD) Tag**.
- [ ] Điền vào `wrangler.jsonc` phần `env.staging.vars` và `env.production.vars`:
      `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`.
- [ ] Giữ `DEV_AUTH_ENABLED = "false"` ở staging/production (Worker cũng tự chặn ở hai môi trường này).

## 5. Tài khoản người dùng trong CRM

Access chỉ xác thực email; vai trò do bảng `users` quyết định.

```bash
npx wrangler d1 execute ailla_crm_prod --remote --command "
INSERT INTO users (id, email, display_name, role, status, legacy_name, created_at, updated_at) VALUES
 (lower(hex(randomblob(16))), 'thao@ailla.vn',  'Nguyễn Thu Thảo',  'EMPLOYEE', 'ACTIVE', 'Thảo',  datetime('now'), datetime('now')),
 (lower(hex(randomblob(16))), 'huyen@ailla.vn', 'Trần Thanh Huyền', 'EMPLOYEE', 'ACTIVE', 'Huyền', datetime('now'), datetime('now')),
 (lower(hex(randomblob(16))), 'quanly@ailla.vn','Quản lý kinh doanh','MANAGER',  'ACTIVE', NULL,    datetime('now'), datetime('now')),
 (lower(hex(randomblob(16))), 'ceo@ailla.vn',   'Nguyễn Quỳnh Hoa', 'CEO',      'ACTIVE', NULL,    datetime('now'), datetime('now'));"
```

- [ ] `legacy_name` phải trùng tên trong file Excel cũ (`Thảo`, `Huyền`) để import map đúng owner.

## 6. Secrets và biến

- [ ] Nếu cần thêm secret: `npx wrangler secret put TÊN_BIẾN --env production`.
- [ ] Không commit `.dev.vars`; file `.dev.vars.example` chỉ để tham khảo.

## 7. Kết nối Cloudflare Builds

- [ ] Workers & Pages → Create → **Import a repository** → chọn repo và nhánh `main`.
- [ ] Build command: `npm run build` · Deploy command: `npx wrangler deploy --env production`.
- [ ] Bật preview deployment cho pull request nếu cần.

## 8. Import dữ liệu thật

- [ ] Sao lưu file Excel gốc ra nơi an toàn (không đưa vào repo).
- [ ] Chạy `npm run import:preview -- "01-CRM-B2B-AILLA.xlsx"` để xem trước bảng đối soát.
- [ ] Vào `/admin/imports`, tải file → **Bước 1 Preview** → đối chiếu toàn bộ mốc ở mục 12.2.
- [ ] Chỉ bấm **Bước 2 Commit** khi đã đọc hết danh sách lỗi/cảnh báo.
- [ ] Nếu batch không đạt `RECONCILED`: xử lý dòng lệch rồi rollback + import lại.

## 9. Nghiệm thu trên staging

- [ ] Chạy `npm test` trên CI (AC-01 → AC-13 tự động).
- [ ] Kiểm tra thủ công AC-14 trên điện thoại thật (mở `/sales` ở 360px).
- [ ] Kiểm tra AC-15: push `main`, CI xanh, Cloudflare deploy thành công.
- [ ] Thử đăng nhập bằng 4 tài khoản pilot, xác nhận nhân viên không vào được `/admin`.

## 10. Lên production

- [ ] Gắn domain `crm.ailla.vn` (route custom domain đã khai trong `wrangler.jsonc`).
- [ ] Kiểm tra HTTPS, Access chặn người ngoài, log và cảnh báo build lỗi.
- [ ] Bật backup D1 (Time Travel) và lịch xuất snapshot sang R2.
- [ ] Diễn tập rollback: `npx wrangler rollback --env production`.
- [ ] Chạy pilot 1-2 tuần với Thảo, Huyền, Quản lý, CEO trước khi rollout toàn đội.

## Ghi chú môi trường Windows

Trên một số máy Windows, `wrangler dev` không khởi động được (workerd báo
`structured exception #0xc0000005: access violation`). Khi đó dùng:

```bash
npm run dev:node    # chạy đúng code Worker trên Node + SQLite, API tại cổng 8787
npm run dev         # giao diện tại cổng 5173
```

Cách này chỉ dành cho lập trình/kiểm thử. Bản deploy vẫn luôn chạy trên Cloudflare Workers + D1.
