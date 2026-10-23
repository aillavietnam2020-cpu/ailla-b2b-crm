# AILLA ABOS (web vận hành, quản trị, CRM B2B)

Chạy thật tại vanhanh.ailla.vn, qt.ailla.vn, quantri.ailla.vn (Cloudflare Worker + D1). Người dùng là chị Hoa (CEO), không rành kỹ thuật: gọi là "chị", nói đời thường.

## Bắt buộc trước khi sửa code (nhiều chat cùng làm trên một kho)

Đọc `docs/QUY-TAC-NHIEU-CHAT.md`. Tóm tắt:

1. Mỗi chat làm trong worktree + nhánh riêng, KHÔNG sửa trong thư mục chung `G:\CODE\CRM\ailla-b2b-crm`; đầu phiên `git merge origin/main` vào nhánh mình.
2. Commit từng việc nhỏ, chỉ `git add <đường dẫn cụ thể>` (cấm `git add -A`), chạy `npx tsc --noEmit` + `npx vitest run` trước khi commit.
3. Không tự ghi `main` hay tự đưa lên web khi chưa qua cổng ghép và chưa được chị Hoa đồng ý; máy chặn thì dừng và báo chị.
4. Migration: mỗi chat chỉ dùng khối số của mình (xem bảng trong tài liệu trên); file đã chạy production thì không đổi tên/nội dung.

## Lệnh thường dùng

- Kiểm tra: `npx tsc --noEmit`, `npx vitest run`. Sửa `hub/src/*` thì `node hub/build.mjs`.
- Đưa lên web: `npm run deploy:prod`; cập nhật dữ liệu: `npm run db:migrate:prod`.
- Hướng dẫn nghiệp vụ và bàn giao cũ: `docs/HUONG-DAN-CHO-TRO-LY-KHAC.md`, `docs/HIEN-TRANG-TRIEN-KHAI.md`.
