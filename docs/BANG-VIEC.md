# Bảng việc chung ABOS

Do chat điều phối trưởng giữ. Một việc một chủ; chat chỉ nhận việc khác vùng file. Cập nhật lần đầu 26/10/2026 (main = 24e7dd0).

## Kết quả rà soát 26/10

- Kiểm tra kiểu dữ liệu (tsc): qua. Kiểm thử (vitest): 46 file, 488 bài, qua hết.
- Mọi nhánh chat đều không có commit nào mà main chưa có, trừ 4 nhánh ở bảng B.
- Chưa đọc được số thật trên production (máy chặn đọc DB từ chat này) — việc 1 dưới đây chờ chị Hoa cho phép hoặc chat khác chạy.

## A. Việc đang mở

| # | Việc | Vùng file | Chủ | Trạng thái |
|---|---|---|---|---|
| 1 | Chạy Máy soát số liệu (12 mục tiền, kho, hàng hoàn) trên số thật + đối chiếu `select name from d1_migrations` với thư mục migrations (0047 và 0061 có 2 file trùng số, đã chạy cả hai) | `src/server/services/dataChecks.ts` (chỉ đọc) | chờ chị Hoa cho phép đọc DB | chưa làm |
| 2 | So doanh thu thực giữa báo cáo Facebook, TikTok, Phòng điều hành, Sheet; ghi chỗ lệch | đọc trang quantri/vanhanh | chat "Tiếp tục quản trị 26/10" | giao |
| 3 | Rà bảo mật theo ghi chú 11/10 (mục 4,3,6,7–11 còn lại) | `src/server/*` auth, hub | chưa giao (việc lớn, giao sau khi xong 1–2) | chờ |
| 4 | Đưa phần "sửa phiếu chi trực tiếp" (3750295) vào main rồi lên web | `hub/src/muahang.js`, `purchasing.ts` | chat nhánh `ghep-23-10-thao-kho` | chờ chủ chat báo xong |
| 5 | Đọc từng trang chính trên web thật tìm lỗi hiển thị | web thật | điều phối trưởng, khi chị Hoa đăng nhập sẵn trình duyệt | chưa làm |

## B. Việc dở cần xác nhận chủ (không để mất)

| Nhánh / thư mục | Nội dung | Chủ nghi là | Cần |
|---|---|---|---|
| `viec-do-trong-thu-muc-chung-23-10` (9f5ba69) | ĐÃ ĐỐI CHIẾU XONG 26/10: cả 8 file (kho2.js, theme-sang.css, congDoan.test.ts, congviec.js, media-duyet/HUONG-DAN.txt, 3 file vps-skill) đều đã nằm trong main, giống hệt hoặc mới hơn. Không mất gì; 3 file dở trong worktree strange-poincare là bản cũ trùng | không cần chủ | có thể xóa nhánh + bỏ file dở khi dọn dẹp (mục C) |
| `sharp-noether-648089` (c34cb8e) | skill abos-web + kế hoạch nối agent; thư mục làm việc báo 366 file đổi (nhiều khả năng chỉ đổi kiểu xuống dòng) | chat "Nối web ABOS với agent" | kiểm tra 366 file có thật sự đổi nội dung không; ghép c34cb8e nếu cần |
| `ke-toan-bill-gan-don-moi` (31976a6) | một commit "Cập nhật theo main mới", không file | không ai | xóa nhánh được (cần chị Hoa đồng ý) |
| `fb-next-2310` | docs/PROMPT-DEMO-GIAO-DIEN-FACEBOOK.md chưa lưu | chat Facebook | tự commit |

## C. Dọn dẹp (chỉ khi mọi chat rảnh, chị Hoa đồng ý)

- 20+ nhánh `claude/*` đã nằm hết trong main, nhiều worktree cũ (gate-2310, ghep-23-10, zen-fermat…) dùng được xóa.
- `main` cục bộ ở thư mục chung chậm 212 commit so với GitHub (chỉ là bản gốc để tạo nhánh; không pull khi chưa hỏi).
- `.git/worktrees/fb-next-2310`, `gate-2310` báo "Permission denied" khi dọn — còn tiến trình giữ.

## D. Khối số migration (thực tế trong main)

0054–0062 Agent cũ; 0080–0083 Agent; 0100 Marketing; 0110–0112 đơn/ship; 0120–0121 phiếu chi/mua hàng; 0130 TikTok. Khối 0070–0079 (Kho), 0090–0099 (Ads) chưa có file nào trong main. Số kế tiếp: Quản trị/chi phí xin khối 0140–0149 (ghi tại đây).
