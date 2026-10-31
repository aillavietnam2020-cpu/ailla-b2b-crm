# AILLA ABOS (web vận hành, quản trị, CRM B2B)

Chạy thật tại vanhanh.ailla.vn, qt.ailla.vn, quantri.ailla.vn (Cloudflare Worker + D1). Người dùng là chị Hoa (CEO), không rành kỹ thuật: gọi là "chị", nói đời thường.

## Cách báo chị Hoa (quan trọng nhất, đọc trước)

Chị Hoa không rành kỹ thuật và rất phiền khi bị báo dài, nhiều chữ lạ rồi phải hỏi lại. Mỗi lần báo cáo xong việc:
- Tối đa 4 dòng ngắn, tiếng Việt đời thường. KHÔNG nhắc mã bản (hash), tên nhánh, tên lệnh, tên migration, "worktree", "merge", "commit", "deploy".
- Nói 3 điều: (1) đã làm gì và chị thấy gì trên màn hình, (2) đã lên web chưa, (3) chị có phải làm gì không. Không cần làm gì thì viết đúng câu "Chị không cần làm gì."
- Chỉ nhờ chị làm khi thật sự cần (bấm cửa sổ cập nhật, thử một thao tác, quyết một việc). Khi nhờ, nói từng bước nhìn thấy trên màn hình.
- Chi tiết kỹ thuật chỉ viết khi chị hỏi, hoặc đưa vào phần cuối tin dưới dòng "Chi tiết cho người làm web".
- KHÔNG nhắn tin tiến độ sang chat điều phối hay chat khác ("đang làm", "đã xong", "đã deploy"): chị đọc thấy hết và bị rối. Chỉ nhắn chat khác khi nó phải làm hoặc quyết một việc, và không nhắn lại để xác nhận đã nhận. Chi tiết: `docs/QUY-TAC-NHIEU-CHAT.md` mục 9.

## Được tự động (chị Hoa đã đồng ý ngày 23/10)

Chat được TỰ ghép vào `main` và TỰ đưa lên web, không cần hỏi chị, khi đủ cả 5 điều kiện: (1) đã `git merge origin/main`, (2) tsc và vitest đều qua, (3) chốt chặn `npm run deploy:prod` cho qua, (4) việc không xóa hay sửa đè dữ liệu thật (migration chỉ thêm bảng/cột, trong khối số của chat), (5) việc nằm đúng phạm vi chị đã nhờ. Thứ tự: ghi `main` trước (chỉ đẩy kiểu nối tiếp, bị từ chối thì merge lại rồi thử lại), rồi mới đưa lên web ngay sau đó. Thiếu một điều kiện thì dừng và nhờ chị bằng lời đời thường. Gặp việc xóa dữ liệu, đổi quyền, đụng tiền hoặc tồn kho thật: hỏi chị trước.

## Bắt buộc trước khi sửa code (nhiều chat cùng làm trên một kho)

Đọc `docs/QUY-TAC-NHIEU-CHAT.md`. Tóm tắt:

1. Mỗi chat làm trong worktree + nhánh riêng, KHÔNG sửa trong thư mục chung `G:\CODE\CRM\ailla-b2b-crm`; đầu phiên `git merge origin/main` vào nhánh mình.
2. Commit từng việc nhỏ, chỉ `git add <đường dẫn cụ thể>` (cấm `git add -A`), chạy `npx tsc --noEmit` + `npx vitest run` trước khi commit.
3. Không đưa web lên từ nhánh riêng (làm mất phần của chat khác): chỉ đưa từ bản đã merge origin/main mới nhất. Không tự ghi `main` hay tự đưa lên web khi chưa qua cổng ghép và chưa được chị Hoa đồng ý; máy chặn thì dừng và báo chị.
4. Migration: mỗi chat chỉ dùng khối số của mình (xem bảng trong tài liệu trên); file đã chạy production thì không đổi tên/nội dung.

## Lệnh thường dùng

- Kiểm tra: `npx tsc --noEmit`, `npx vitest run`. Sửa `hub/src/*` thì `node hub/build.mjs`.
- Đưa lên web: `npm run deploy:prod`; cập nhật dữ liệu: `npm run db:migrate:prod`.
- Hướng dẫn nghiệp vụ và bàn giao cũ: `docs/HUONG-DAN-CHO-TRO-LY-KHAC.md`, `docs/HIEN-TRANG-TRIEN-KHAI.md`.
