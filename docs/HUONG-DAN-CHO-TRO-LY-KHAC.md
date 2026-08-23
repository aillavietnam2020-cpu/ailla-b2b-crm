# AILLA B2B CRM — Hướng dẫn bàn giao cho trợ lý AI khác

Tài liệu này viết cho một trợ lý AI (ChatGPT hoặc bất kỳ) sẽ tiếp tục làm việc trên
phần mềm CRM B2B của Công ty CP TM & XNK AILLA Việt Nam. Đọc hết trước khi sửa bất
cứ dòng code nào. Người dùng là CEO, không phải dân kỹ thuật — mọi giải thích phải
bằng ngôn ngữ đời thường, mô tả thứ nhìn thấy trên màn hình, không dùng thuật ngữ.

---

## 1. Phần mềm này là gì

CRM nội bộ cho mảng bán buôn (B2B) của AILLA: quản lý khách hàng đại lý, bảng giá
8 cấp, đơn hàng, duyệt giá, công nợ, thu tiền, cảnh báo tái mua, dashboard kinh doanh.

- **Đang chạy thật tại:** https://ailla-b2b-crm.aillavietnam2020.workers.dev
- **Mã nguồn:** GitHub riêng tư `aillavietnam2020-cpu/ailla-b2b-crm`, nhánh `main`
- **Thư mục trên máy CEO:** `G:\CODE\CRM\ailla-b2b-crm`
- **Dữ liệu:** đã nạp dữ liệu thật của công ty (134 sản phẩm, 1072 dòng giá, 62 khách
  hàng, 35 đơn, 206 dòng đơn, 25 phiếu thu) và đã đối chiếu khớp file Excel gốc.

Nguồn chân lý về nghiệp vụ là file đặc tả `AILLA_B2B_CRM_Dac_ta_ChatGPT_Code.docx`
(18 mục, kèm tiêu chí nghiệm thu AC-01..AC-15) nằm ở `G:\CODE\CRM`. Khi nghiệp vụ
trong code khác đặc tả, phải hỏi CEO chứ không tự quyết.

---

## 2. Công nghệ

| Thành phần | Dùng gì |
|---|---|
| Máy chủ | Cloudflare Worker + Hono |
| Cơ sở dữ liệu | Cloudflare D1 (SQLite) — `ailla_crm_prod`, `ailla_crm_demo`, `ailla_crm_dev` |
| Giao diện | React 18 + TypeScript + Vite, react-router-dom |
| Đăng nhập | Mật khẩu, băm PBKDF2-SHA256, cookie phiên HttpOnly SameSite=Lax |
| Kiểm thử | Vitest — hiện 112 bài, phải luôn xanh |
| Triển khai | `npx wrangler deploy --env production` |

Cấu hình ở `wrangler.jsonc`. Tên Worker: `ailla-b2b-crm`. Có cron mỗi giờ chạy lại
bộ cảnh báo.

### Lệnh hay dùng

```bash
npm test
npx tsc --noEmit -p tsconfig.json
npm run build
npx wrangler deploy --env production
npx wrangler d1 execute ailla_crm_prod --env production --remote --command "SELECT 1"
npm run db:migrate:prod
```

---

## 3. Bản đồ mã nguồn

```
migrations/           0001..0007, chạy tăng dần, KHÔNG sửa migration đã chạy
src/shared/           dùng chung server + client: enums, schemas (zod), permissions,
                      types, money, datetime
src/server/
  routes/             core, auth, catalog, customers, orders, payments, imports...
  services/           logic nghiệp vụ: orders, debts, pricing, approvals, payments,
                      customers, reports, dashboards, alerts, import/
  middleware/         auth.ts (phiên + quyền + phạm vi dữ liệu), rbac.ts
  lib/                http, audit, settings, sql
src/client/
  components/         AppShell, AuthProvider, ui.tsx, charts.tsx
  pages/              CustomersPage, OrdersPage, PricesPage, DebtsPage, admin/, sales/
  lib/                api.ts, hooks.ts, dragScroll.ts
  styles.css          toàn bộ CSS, không dùng thư viện ngoài
tests/                unit, integration, e2e (acceptance theo AC-01..AC-15)
docs/                 tài liệu vận hành, gồm HIEN-TRANG-TRIEN-KHAI.md
```

---

## 4. Luồng vận hành thật của công ty (CEO chốt, code phải theo)

1. Sale tạo đơn rồi gửi duyệt.
2. Quản lý (chị Thảo) duyệt, rồi tích **Đã xuất kho** → **Đã giao**.
3. Sale tích **Tiền về** khi khách chuyển tiền.
4. Kế toán (chị Huệ) bấm **KT xác nhận** thì tiền mới trừ công nợ chính thức.

Trong danh sách đơn chỉ hiện **một** nhãn trạng thái — bước xa nhất đơn đã đi tới
(hàm `orderStage` trong `src/client/components/ui.tsx`). Không trải cả dải nhãn.

Chị Thảo vừa là sale vừa là quản lý nên **được phép tự duyệt** đơn mình gửi; hệ thống
ghi thêm "(tự duyệt)" vào nhật ký. Cấu hình `allowSelfApproval`, mặc định bật.

---

## 5. Ba khái niệm công nợ (mục 9.1 đặc tả) và quyết định của CEO

- **Công nợ chính thức** = nợ đầu kỳ + đơn đã ghi nhận − tiền kế toán đã xác nhận.
- **Chờ ghi nợ**: đơn đã giao nhưng kế toán chưa xác nhận.
- **Chờ tiền về**: tiền sale đã báo nhưng kế toán chưa xác nhận.
- **Công nợ dự kiến** = chính thức + chờ ghi nợ − chờ tiền về − số dư có.

**Quyết định ngày 17/8/2026:** đặc tả gốc chỉ trừ công nợ phần tiền đã phân bổ vào
từng đơn, nhưng thực tế công ty làm trên Excel là kế toán xác nhận thì trừ thẳng, kể
cả khoản "trả nợ chung" chưa gán đơn. CEO chốt làm theo Excel. Đã sửa trong
`src/server/services/debts.ts`. Kết quả khớp đúng file gốc:

```
1.256.920.982 + 91.618.613 − 180.073.600 = 1.168.465.995đ
```

**Không được đổi lại công thức này** nếu CEO không yêu cầu.

---

## 6. Phân quyền

Ba vai trò gốc: `CEO`, `MANAGER`, `EMPLOYEE`, khai trong `src/shared/permissions.ts`.

- **CEO có TẤT CẢ quyền** (`const CEO: Permission[] = [...PERMISSIONS]`). Không bao
  giờ cắt bớt quyền của CEO.
- Kế toán không phải vai trò riêng mà là **gói quyền cấp thêm** cho một người dùng,
  lưu ở bảng `user_permissions` (hằng `ACCOUNTANT_PERMISSIONS`).
- Phạm vi dữ liệu (OWN / TEAM / ALL) tính trong `middleware/auth.ts`, hàm `scopeFor`,
  có xét cả quyền cấp thêm chứ không chỉ vai trò.
- `/api/me` phải trả `auth.permissions` (quyền hiệu lực), không trả quyền theo vai
  trò, nếu không giao diện sẽ ẩn mất nút mà backend thực tế cho phép.

Mọi kiểm tra quyền và phạm vi dữ liệu **bắt buộc ở backend**. Giao diện chỉ ẩn nút
cho gọn, không được coi là hàng rào.

---

## 7. Những cái bẫy đã dính, đừng dính lại

1. **PBKDF2 tối đa 100.000 vòng** trên Cloudflare Workers. Đặt 210.000 là lỗi 500 khi
   đăng nhập. Giữ `ITERATIONS = 100_000`.
2. **D1 chỉ nhận khoảng 100 tham số buộc mỗi câu lệnh.** Bảng giá 134 mã từng gây lỗi
   500 — phải chia lô (đang chia 90 mã một lô trong `pricing.ts`).
3. **Worker có giới hạn CPU** (lỗi 1102). Nhập Excel phải chia pha
   (`catalog → customers → orders → payments → finalize`), ghi tiến độ vào
   `import_batches.progress_json`, không đọc cả workbook một lần.
4. **D1 không cho dựng lại bảng** khi có khoá ngoại trỏ tới. Migration 0004 phải viết
   lại thành `ALTER TABLE ... ADD COLUMN`. Số tiền phiếu thu luôn **dương**, dấu âm
   mang bởi cờ `is_adjustment = 1` (bút toán đảo).
5. **Mã SKU trong file Excel không đồng nhất hoa thường** (`TOILET1l` và `Toilet1l`).
   Mọi tra cứu SKU phải `.trim().toLowerCase()`.
6. **PowerShell `Set-Content` làm hỏng tiếng Việt UTF-8** trong file .ts. Sửa file
   bằng công cụ sửa file của trợ lý, hoặc ghi UTF-8 tường minh.
7. **Đừng xoá bảng `sessions`** trên D1 thật: CEO đang đăng nhập sẽ bị văng ra và màn
   hình hiện đầy ô "Chưa đăng nhập".
8. **Hai trợ lý cùng sửa một kho code là thảm hoạ.** Việc này ĐÃ xảy ra: một trợ lý
   khác sửa file và deploy đè lên cùng Worker, code trên mạng khác code trên máy.
   Trước khi sửa phải `git pull`. Sau khi sửa: chạy test, build, deploy, commit, push.
   Nếu thấy file bị sửa mà mình không sửa, dừng lại và báo CEO.

---

## 8. Quy tắc bắt buộc khi làm việc

- **Bí mật:** không commit `.dev.vars`, token, mật khẩu, file Excel dữ liệu thật (đã
  có trong `.gitignore`). Không hỏi xin mật khẩu Cloudflare/GitHub/OTP của CEO. Không
  tự đăng nhập thay CEO — đưa hướng dẫn để CEO tự làm.
- **Đặt mật khẩu nhân viên:** chạy `DAT-MAT-KHAU.bat`, script băm ngay trên máy và
  không in mật khẩu ra màn hình. Tài khoản mới luôn đặt `must_change_password = 1`.
- **Dữ liệu thật chỉ nằm ở `ailla_crm_prod`.** Bản demo không được nạp dữ liệu khách
  hàng thật.
- **Quy trình mỗi lần sửa:** `npx tsc --noEmit` → `npm test` (đủ 112 bài xanh) →
  `npm run build` → `npx wrangler deploy --env production` → commit → push.
- **Nhật ký thao tác (audit log)** ghi trong cùng `DB.batch()` với thay đổi nghiệp vụ,
  không ghi tách rời.
- **Thông báo lỗi cho người dùng viết bằng tiếng Việt**, nói rõ phải làm gì.
- Không thêm thư viện chạy trên trình duyệt qua CDN — CSP chặn script ngoài. Biểu đồ
  đang vẽ tay bằng SVG trong `src/client/components/charts.tsx`.

---

## 9. Quy ước giao diện đã chốt sau nhiều lần CEO phản hồi

- **Bảng rộng phải kéo được bằng chuột.** Mỗi bảng nằm trong `.table-wrap`, cao tối đa
  bằng màn hình, tiêu đề cột dính, cột đầu dính, thanh cuộn dày và luôn hiện. Kéo chuột
  trên mặt bảng để trượt ngang (`src/client/lib/dragScroll.ts`), lăn chuột cũng trượt
  ngang. Giữ nguyên cơ chế này khi thêm bảng mới.
- **Màn tạo đơn:** thông tin khách và tổng tiền nằm chung một khung ngang phía trên,
  bảng dòng hàng chiếm hết chiều rộng bên dưới. Không chia hai cột hẹp.
- **Đơn vị tính:** đơn vị nhỏ nhất hiển thị là "chai" kể cả khi bảng giá ghi ĐVT là
  "Thùng". Mỗi dòng chọn lẻ hoặc thùng; lưu xuống cơ sở dữ liệu luôn quy về đơn vị lẻ
  (cả số lượng lẫn đơn giá) để doanh số và thưởng tính nhất quán.
- **Giá tự nhảy theo cấp bậc của khách** ngay khi thêm sản phẩm. Mã nào cấp đó chưa có
  giá thì chặn, không cho tự áp giá.
- **Khuyến mại:** tặng quà là tích ô "Hàng tặng" ở dòng hàng (về 0đ, cột `is_gift`);
  giảm giá tiền là ô "Chiết khấu"; kèm mã và nội dung chương trình.
- **Dashboard** trình bày theo sheet DASHBOARD_SALE, kiểu báo cáo Power BI: thẻ số liệu,
  cột ngang theo sale, biểu đồ tròn theo nhóm hàng, phễu.
- **Không làm màn tính thưởng nhân viên.** CEO đã bác: công ty thưởng đại lý theo bậc
  doanh số, không thưởng nhân viên theo doanh số. Dashboard sale là đủ.

---

## 10. Tài khoản đang có

| Người | Email | Vai trò |
|---|---|---|
| CEO | tài khoản của chị | CEO, toàn quyền |
| Thảo | tài khoản quản lý | MANAGER, vừa sale vừa quản lý, được tự duyệt |
| Huệ | huethai@gmail.com | EMPLOYEE + gói quyền Kế toán |
| Huyền | huyen@ailla.vn | chưa đặt mật khẩu |
| Quản lý | quanly@ailla.vn | chưa đặt mật khẩu |

Mật khẩu không ghi trong tài liệu và không gửi qua chat.

---

## 11. Việc còn tồn

1. Đặt mật khẩu cho `huyen@ailla.vn` và `quanly@ailla.vn` (chạy `DAT-MAT-KHAU.bat`).
2. Mua tên miền, thêm vào Cloudflare, gắn `crm.<tenmien>`, bật Cloudflare Access, rồi
   mở lại mục `routes` trong `wrangler.jsonc`. Hiện đang dùng địa chỉ workers.dev và
   đăng nhập bằng mật khẩu.
3. Bật R2 và mở lại `r2_buckets` cho env production (không bắt buộc, nhập Excel vẫn
   chạy được khi chưa có R2).
4. Sản phẩm chưa có cột quy cách (một thùng mấy chai) vì file Excel gốc không có. Hiện
   sale nhập tay tại dòng đơn, mặc định 12. Khi CEO gửi quy cách chuẩn thì nạp một lần
   vào cột `products.pack_size`.

---

## 12. Cách nói chuyện với CEO

- Không dùng thuật ngữ kỹ thuật. Mô tả theo thứ nhìn thấy trên màn hình: "khung bên
  phải", "nút màu hồng", "dòng chữ đỏ ở giữa".
- Khi sai thì nhận ngắn gọn rồi sửa, không dài dòng phân trần.
- Đừng chờ CEO duyệt từng bước mới làm — CEO đã nói rõ "làm hết đi đừng có đợi tôi
  duyệt mới làm". Chỉ hỏi khi việc đó chỉ CEO mới quyết được: nghiệp vụ, tiền, tài khoản.
- Trước khi khẳng định "đã sửa xong" phải chạy thử thật và đưa bằng chứng (số liệu truy
  vấn được, kết quả kiểm thử), không đoán.
