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
| 2 | So doanh thu thực giữa báo cáo Facebook, TikTok, Phòng điều hành, Sheet; ghi chỗ lệch | đọc trang quantri/vanhanh | chat "Tiếp tục quản trị 26/10" | XONG 26/10 (kết quả ở mục E); còn bc_fb tháng 10 chưa đọc |
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

## E. Đối soát doanh thu T9/T10 (26/10, chat Tiếp tục quản trị; chỉ đọc)

Web = trang Lãi lỗ P&L (plMonth); "Huệ" = bảng báo cáo các sàn T9 chị Huệ gửi.

| # | Kỳ · Kênh | Web | Nơi khác | Lệch | Nghi do | Việc tiếp |
|---|---|---|---|---|---|---|
| E1 | T9 TikTok (CHỊ HOA CHỐT 26/10: giữ số web; số chị Huệ chỉ tính báo cáo tải 1/10, đơn chưa giao xong nên không dùng) | 1.392,1tr (doanh thu thuần, file chốt sổ) | Huệ 1.098,2tr; GMV vanhanh 1.538,0tr | +293,9tr so Huệ | Hai định nghĩa doanh thu | CHỊ HOA chốt dùng định nghĩa nào (nguyên tắc 25/10: doanh thu thực); chat TikTok sửa theo |
| E2 | T9 Facebook | 996,6tr (giao thành công, Pancake) | Huệ 1.084,3tr; bộ đếm vanhanh 960,5tr | −87,6tr so Huệ; +36,1tr so vanhanh | Ngày tạo đơn vs ngày giao; quantri và vanhanh dùng nguồn/ngày khác nhau | Chat Facebook/Ads: thống nhất MỘT hàm tính cho cả hai trang |
| E3 | T9 Shopee | chưa có | Huệ 244,8tr | thiếu | Chưa tải báo cáo Shopee T9 | Chị Huệ/Thảo tải; T10 cũng chưa có |
| E4 | T9 B2B/NPP | 768,4tr | Huệ 780,1tr | −11,7tr | Ngày duyệt vs ngày hóa đơn | Chat CRM/Kho xem đơn chưa duyệt |
| E5 | T9 Gia công (CHỊ HOA: web 0 vì chị Huệ chưa đưa dữ liệu lên, không phải lỗi web; số đúng là của chị Huệ khi nhập) | 0 | Huệ 142,3tr | −142,3tr | Đơn gia công không có trong CRM hoặc gắn loại khác | Chat CRM/Kho tra |
| E6 | T10 TikTok/FB (đến 26/10) | 941,1tr tạm tính / 650,0tr | bộ đếm ngày vanhanh tháng 10 = 0 | không so được | Bộ đếm chưa có ngày T10 | Chat Facebook/Ads kiểm bộ đếm execNums |
| E7 | Sheet phân bổ T09 | — | ô doanh thu thực trống, dòng chia chung #ERROR | — | Chị Huệ chưa nhập | Chị Huệ |

E2 tra lại 26/10 (đọc code): GIẢ THUYẾT CŨ "hai trang hai nguồn" SAI. Trang quản trị (tqgop.js tqRevB2C) và trang vận hành (exec.js execNums) đều cộng cùng một cột: DAYD.fb[ngày][5] = doanh thu giao thành công theo NGÀY TẠO ĐƠN (Sheet Pancake; ngày thiếu thì Pancake API: doanh thu đã giao trừ hoàn ước tính, adsday.js). Vậy 996,6tr vs 960,5tr phải do khác kỳ/khác thời điểm tải (đơn đang giao cập nhật dần), chưa tái hiện được vì chưa đọc số thật. Lệch với chị Huệ (1.084tr) nhiều khả năng do khác cách tính: web theo ngày tạo đơn, chị Huệ nhiều khả năng theo ngày giao/tiền về. CẦN CHỊ HOA CHỐT: Facebook tính theo ngày tạo đơn hay ngày giao thành công.

## F. Quy tắc kỳ doanh thu (chị Hoa chốt 26/10)

- Đơn xác nhận tháng nào tính doanh thu tháng đó (vẫn là doanh thu thực: giao thành công, trừ hoàn/hủy).
- Chốt số tháng trước vào NGÀY 10 THÁNG SAU. Trước ngày 10: trang quản trị phải ghi rõ "doanh thu dự kiến / chưa chốt" (số thật đến lúc đó + đơn đang giao × (1 − hoàn dự kiến); fbpl.js đã có thẻ dự kiến cho Facebook).
- Chị Huệ chốt báo cáo cùng thời điểm (ngày 10). Vì vậy lệch Facebook T9 (E2) có thể chỉ do đọc ở hai thời điểm; sau ngày 10 phải so lại.
- Việc F1 (chat Facebook/Ads, khi mở lại): mọi trang doanh thu hiện nhãn "chưa chốt – dự kiến" cho tháng chưa qua ngày 10, "đã chốt" sau đó, và số đã chốt không đổi nữa. Việc F2 (TikTok, Shopee, B2B): áp cùng quy tắc.

## G. Chuẩn hóa web: thứ tự chị Hoa chốt 26/10

1. Bước 0: bảng phân vùng hai web (docs/PHAN-VUNG-HAI-WEB.html, trang xem: https://claude.ai/artifact/9was5HbzuzabTGjKtfeuwY) — CHỊ ĐÃ DUYỆT 26/10 (bản 5: Kênh phân phối, Kênh OEM, giữ CSKH cũ).
2. Sắp xếp lại menu hai web theo bảng — GIAO chat "Sắp xếp lại menu hai web ABOS" (local_4ea79cf9, nhánh claude/sap-xep-menu): XONG 26/10, main c08af27, đã lên web (điều phối kiểm menu thật hai web khớp). Chị chốt 26/10: Kho bill = sale nhập bên vận hành, kế toán xác nhận bên quản trị; Phiếu chi vận chuyển = Thảo nhập (đã giao lại chat sap-xep-menu); 3 trang Đồng bộ mã/Quy đổi mã/Chênh lệch định mức vẫn ở quản trị (vận hành đang che); Sổ chi phí đã về Tài chính – Kế toán › Thu chi (main 45aa532); Marketing giữ 5 khu; mục Của tôi nằm ở menu bấm vào tên người dùng như trước (không mất). Chat khác không sửa setup.js/admnav2.js/admmenu.js trong lúc này.
3. Từng mảng: Doanh thu → Kho → Tiền & công nợ → Mua hàng → Task: định nghĩa chỉ số, nạp số thật, trang xem số nguồn để đối chiếu.
4. Giao diện mới áp dần theo mảng.

## H. Đang chạy (27/10)

| Việc | Chat | Nhánh | Vùng file | Khối migration |
|---|---|---|---|---|
| Trang Phê duyệt (quản trị) — XONG 27/10, main 3c0d555, đã lên web. Chị chốt: đơn mua hàng KHÔNG cần duyệt. Còn chờ chị: có gom xác nhận tiền về / hàng trả lại không; ngưỡng chi lên CEO | Trang Phê duyệt trên web quản trị (local_4826d81b) | claude/phe-duyet | trang mới + 1 dòng menubang.js | 0150–0154 |
| Chuẩn hóa mảng Doanh thu + Đối chiếu doanh thu + nhãn chốt ngày 10 + tra lệch FB T9 | Chuẩn hóa mảng Doanh thu web ABOS (local_cbc8a779) | claude/doanh-thu | tqgop.js, exec.js, fbdash.js, fbpl.js, dieuhanh.js, b2bpl.js + 1 dòng menubang.js | 0140–0149 |

Chat "Tiếp tục quản trị 26/10" đã được báo không sửa các file doanh thu trên trong lúc này.

### Cập nhật 27/10 sáng
- Doanh thu: XONG, main b8b28f6 đã lên web (migration 0140 chạy). T9 đã chốt: TikTok 1.392,1tr; Facebook 1.209,6tr (Pancake, trước lệch vì Sheet kd chỉ tới 29/9 và tải ~26/9); Kênh phân phối 768,4tr; OEM chờ chị Huệ; Shopee chưa tải. Chị Huệ FB 1.084,3tr còn lệch −125,3tr. Trang Đối chiếu: quản trị › Điều hành CEO › Kênh bán hàng.
- CẢNH BÁO: origin/main 2a37ee8 (08:55) đã có code Phê duyệt ngưỡng 5tr (08a9704) cần migration 0150, prod CHƯA chạy 0150 (file .bat dừng bước 1). Web đang chạy bản b8b28f6. KHÔNG deploy main tới khi 0150 chạy. Đã báo chat Phê duyệt, Doanh thu, Quản trị.
- Còn: Tổng quan vận hành còn tên cũ (giao chat Doanh thu, chỉ nhánh); 421030f chưa deploy.
