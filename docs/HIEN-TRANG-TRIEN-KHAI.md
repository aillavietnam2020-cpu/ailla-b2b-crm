# Hiện trạng triển khai trên Cloudflare

Cập nhật: 16/08/2026 · Tài khoản Cloudflare: `aillavietnam2020@gmail.com`
(account id `be5d086a049ed8399aaa562543e9d174`)

## Đang chạy

| Hạng mục | Giá trị |
|---|---|
| Bản DEMO công khai | https://ailla-b2b-crm-demo.aillavietnam2020.workers.dev |
| Worker demo | `ailla-b2b-crm-demo` (env `demo`) |
| D1 demo | `ailla_crm_demo` · `e3c9b807-e6ec-41af-b9fd-7d3c1e6439f9` (đã nạp dữ liệu mẫu ẩn danh) |
| Worker production | `ailla-b2b-crm` (env `production`) - đã upload, **chưa có địa chỉ truy cập** |
| D1 production | `ailla_crm_prod` · `5a9c1852-0693-4b22-a922-c30a3095dff0` (đã chạy migration, chưa có dữ liệu) |
| Tài khoản CEO trong D1 production | `aillavietnam2020@gmail.com` |

**Cảnh báo về bản demo:** đăng nhập không cần mật khẩu, ai có link đều vào được và tự chọn vai
trò. Chỉ dùng để xem giao diện. Không import file khách hàng thật vào database demo. Khi không cần
nữa, xoá bằng:

```bash
npx wrangler delete --name ailla-b2b-crm-demo
```

## Còn thiếu để dùng thật

1. **Đưa tên miền `ailla.vn` vào Cloudflare** (Dashboard → Domains → Add a domain, rồi đổi
   nameserver ở nơi mua tên miền). Đây là điều kiện bắt buộc để:
   - gắn địa chỉ `crm.ailla.vn`
   - bật Cloudflare Access (workers.dev **không** bảo vệ bằng Access được)
2. **Bật Zero Trust Access** cho `crm.ailla.vn`, chỉ cho phép email nhân sự đã duyệt. Sau đó lấy
   `Team domain` + `AUD tag` điền vào `wrangler.jsonc` (env `production`) và deploy lại.
3. **Mở lại route** trong `wrangler.jsonc`:
   ```jsonc
   ,"routes": [{ "pattern": "crm.ailla.vn", "custom_domain": true }]
   ```
4. **Bật R2** (Dashboard → R2 → Enable, cần thêm phương thức thanh toán dù có hạn mức miễn phí),
   tạo bucket `ailla-crm-files-prod` rồi bỏ chú thích phần `r2_buckets` trong env production.
   Chưa có R2 thì import vẫn chạy được, chỉ là khi commit phải tải lại đúng file đã preview.
5. **Tạo tài khoản nhân sự thật** trong D1 production (Thảo, Huyền, Quản lý), `legacy_name` phải
   trùng tên trong file Excel cũ để import map đúng người phụ trách.
6. **Import file `01-CRM-B2B-AILLA.xlsx` thật**: preview → đối soát → commit.

## Lệnh hay dùng

```bash
npx wrangler deploy --env demo          # cập nhật bản demo
npx wrangler deploy --env production    # cập nhật bản thật
npx wrangler d1 execute ailla_crm_prod --remote --env production --command "SELECT COUNT(*) FROM customers;"
npx wrangler rollback --env production  # quay lại bản deploy trước
```
