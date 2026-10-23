# Quy tắc làm việc khi nhiều chat cùng sửa web ABOS

Viết ngày 23/10/2026 sau lần ghép các nhánh (main = 8927e71). Chị Hoa (CEO) chạy nhiều chat song song trên cùng một máy và cùng một kho code. Quy tắc này để các chat không đè lên nhau, không đưa việc dở lên web, và không trùng số cập nhật dữ liệu. Đọc hết trước khi sửa code.

## 1. Mỗi chat một nhánh riêng, một thư mục riêng

- KHÔNG sửa code trực tiếp trong thư mục chung `G:\CODE\CRM\ailla-b2b-crm`. Thư mục chung chỉ là bản gốc để tạo nhánh.
- Mỗi chat làm trong một worktree riêng, ví dụ `G:\CODE\CRM\ailla-b2b-crm\.claude\worktrees\<tên>` với nhánh `claude/<tên>`. Cần `node_modules`: tạo junction trỏ về `G:\CODE\CRM\ailla-b2b-crm\node_modules`.
- Bắt đầu mỗi phiên: `git fetch origin` rồi `git merge origin/main` vào nhánh của mình (trong thư mục riêng) trước khi làm tiếp.
- Cấm trong thư mục chung (khi chưa hỏi chị Hoa): `git pull`, `merge`, `rebase`, `reset`, `checkout`, `stash`.

## 2. Lưu từng việc nhỏ, đúng file của mình

- Commit thường xuyên, mỗi commit một việc, tin commit nói rõ làm gì (ví dụ "Hàng hoàn: phiếu nhập theo ngày").
- Chỉ `git add <đường dẫn cụ thể>`. KHÔNG dùng `git add -A` hoặc `git add .` (lần trước commit của chat Ads đã chép nhầm 5 file agent của chat khác vì vậy).
- Trước khi commit: `npx tsc --noEmit` và `npx vitest run` đều phải qua. Sửa `hub/src/*` thì chạy `node hub/build.mjs`.
- Lưu nhánh riêng lên GitHub (`git push origin claude/<tên>`) khi tới điểm dừng, để không mất nếu máy hỏng.

## 3. Một cổng ghép và đưa web lên

- Chat nào làm xong việc thì báo chị Hoa và chat điều phối; KHÔNG tự ghi vào `main` và KHÔNG tự đưa lên web khi việc của mình chưa qua kiểm tra.
- Ghép vào `main` làm trong một worktree sạch riêng từ `origin/main`, ghép từng nhánh, chạy toàn bộ kiểm tra, rồi mới đưa lên web, sau đó mới ghi `main`. Chỗ trùng thì xử lý từng chỗ, giữ cả hai phần, không lấy nguyên một bản.
- BẮT BUỘC trước khi đưa lên web: so thư mục chung `G:\CODE\CRMilla-b2b-crm` (file sửa dở và file mới chưa theo dõi) với bản vừa ghép, từng file bằng `git hash-object`. File nào có trong thư mục chung mà không có trong bản ghép thì tìm chủ chat trước (tra bằng nội dung file, ngày sửa, lịch sử các chat). Lý do: ngày 23/10 bản ghép đã đưa lên web làm mất tạm thời Task giao việc (Tổng quan 7 phòng), trang Quy đổi mã các sàn và màu giao diện sáng, vì các phần đó đã chạy trên web từ trước nhưng chưa bao giờ được lưu vào git. Đã vá cùng ngày (main 6d03dbc).
- Mỗi lần đưa một phần lên web từ thư mục chung (trước đây hay làm), phải lưu (commit) đúng phần đó vào nhánh của chat ngay sau đó, không để "đang chạy trên web mà chưa lưu".
- KHÔNG đưa web lên từ nhánh riêng của chat mình. Nhánh riêng không có phần của chat khác, nên đưa lên sẽ làm MẤT tính năng đang chạy của họ (đã xảy ra 23/10). Chỉ đưa web lên từ bản đã `git merge origin/main` mới nhất, đã chạy tsc + vitest, và đã được chị Hoa đồng ý; xong thì ghi bản đó vào `main` ngay.
- Đưa lên web = `npm run deploy:prod`; cập nhật dữ liệu = `npm run db:migrate:prod` (chạy từ worktree đã ghép). Cần chị Hoa đồng ý trong chat. Máy có thể chặn; khi bị chặn thì dừng, báo chị, không vòng qua.

## 4. Số file cập nhật dữ liệu (migration) theo khối

File trong `migrations/` chạy theo số thứ tự tên file. Hai chat cùng tạo một số là hỏng. Từ 0063 trở đi, mỗi chat chỉ dùng khối của mình (tạm thời, chị Hoa có thể đổi):

| Chat | Khối số |
|---|---|
| Sản xuất / Kho / Hàng hoàn | 0070–0079 |
| Agent | 0080–0089 |
| Ads / Facebook | 0090–0099 |
| Marketing | 0100–0109 |
| Chat khác (điện thoại, nhân sự...) | xin khối mới ở chị Hoa, ghi vào bảng này |

- File đã chạy lên production thì KHÔNG đổi tên, KHÔNG sửa nội dung. Hiện cả hai file `0061_*` đều đã chạy.
- Chỉ thêm bảng/cột (không xóa, không đổi kiểu) trừ khi chị Hoa duyệt.
- Kiểm tra số đã chạy: `select name from d1_migrations` (qua `wrangler d1 execute ailla_crm_prod --remote --env production`; nếu báo lỗi tài khoản thì bỏ biến `CLOUDFLARE_API_TOKEN` rồi chạy lại).

## 5. Những chỗ nối giữa các phần (đụng vào thì báo chị Hoa và cập nhật bảng này)

| Chỗ nối | Các phần liên quan | File chung dễ vướng |
|---|---|---|
| Khung chung và danh sách trang | mọi trang trong `hub/src/*.js` | `hub/build.mjs` (danh sách file nạp), `hub/src/server.js`, `hub/src/setup.js`, `hub/src/style.css` |
| Khóa dữ liệu dùng chung | Ads, Facebook P&L, Kinh doanh | `src/server/routes/hub.ts` (BLOB_KEYS và danh sách bỏ nhật ký) |
| Số liệu quảng cáo tự động | Ads ↔ Facebook (trang Doanh thu, P&L) ↔ Digital | `hub/src/adsday.js` (hàm `adf*`, `adfMergeDays`) |
| Đơn hàng ↔ kho ↔ hàng hoàn ↔ MISA | CRM đơn, kho, hàng hoàn, chứng từ | `src/server/routes/kho*.ts`, `src/server/services/returnScan.ts`, `src/server/services/payments.ts` |
| Agent ↔ web | Agent Sale/CSKH, giấy ủy quyền, Huấn luyện agent | `src/server/routes/agent*.ts`, `src/shared/agent*.ts`, `hub/src/dieuhanhagent.js` |
| Thanh toán ↔ công nợ ↔ kế toán | thu tiền, phiếu thu, khoản kế toán | `src/server/services/payments.ts`, `src/server/routes/finance.ts` |

Khi sửa một file ở cột "file chung dễ vướng": sửa ít nhất có thể, đừng viết lại cả file, và `git merge origin/main` ngay trước khi commit để thấy thay đổi của chat khác.

## 6. Chat dành riêng cho việc dọn dẹp

- Việc dọn thư mục chung (đưa nó về giống `main`) chỉ làm khi tất cả chat đang rảnh và chị Hoa đã đồng ý.
- File lạ trong thư mục chung chưa rõ chủ: lưu vào một nhánh riêng trên GitHub rồi hỏi các chat; không xóa.

## 7. Cách báo chị Hoa

Chị Hoa không rành kỹ thuật: báo bằng lời đời thường, nói thứ nhìn thấy trên màn hình, nói rõ đã làm gì và còn việc gì chị cần quyết. Không dán khóa, mật khẩu hay mã bí mật vào chat.
