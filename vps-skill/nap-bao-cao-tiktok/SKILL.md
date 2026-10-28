---
name: nap-bao-cao-tiktok
description: Kéo báo cáo kế toán TikTok Shop (đơn hàng, quyết toán income, quảng cáo GMV Max) THẲNG VỀ VPS (không lưu xuống máy chị Hoa) và nạp số lãi lỗ tháng lên web ABOS. Sáng thứ Hai hằng tuần + 7h sáng ngày 10 chốt sổ. CHỈ agent Kế toán trưởng dùng.
---

# nap-bao-cao-tiktok — kéo báo cáo TikTok Shop và nạp lên web ABOS

Chị Hoa giao cho **Agent · Kế toán trưởng** (duyệt 25/10, sửa 28/10/2026). Agent khác không dùng; web cũng từ chối nếu agent chưa được tick phạm vi "Báo cáo sàn".

Cách đi chuột trên Seller Center (menu nào, nút nào, bẫy lịch) xem thêm skill **ailla-tai-bao-cao-tiktok** của chị. Riêng **chỗ lưu file thì làm theo skill này**: không lưu xuống máy chị, không cất ổ F.

## Lịch chạy (chị chốt 27/10)
- **Sáng thứ Hai 7h** — bản **giữa tháng (dự kiến)**:
  - Tháng đang chạy: đơn + quảng cáo từ 01 đến **Chủ nhật hôm qua**; income từ 01 đến Chủ nhật hôm qua.
  - Nếu hôm nay là ngày 01–09: làm thêm **tháng trước** (đơn + quảng cáo trọn tháng, income từ 01 tháng trước đến hôm qua). Tháng trước vẫn là bản giữa tháng tới ngày 10.
  - Thứ Hai đầu tháng mà tháng đang chạy mới được 0 ngày đủ (ví dụ thứ Hai 01) thì bỏ qua tháng đang chạy.
- **7h sáng ngày 10** — bản **đủ tháng để chốt sổ** của tháng trước: đơn trọn tháng (theo ngày tạo đơn), quảng cáo trọn tháng, **income từ 01 tháng trước đến hết ngày 09 tháng này** (lọc theo ngày quyết toán / ngày báo cáo). Không kéo income sang ngày 10.
- Chốt sổ (khoá) là việc của kế toán trên web, từ ngày 10. Agent **không khoá sổ**.

## Lấy file KHÔNG lưu xuống máy chị (bắt buộc)
Chrome máy chị đang bật "hỏi chỗ lưu", nếu bấm tải bình thường sẽ bật hộp **Save As** trên màn hình chị và kẹt. Luôn làm 3 bước:
1. Mở trang bằng `openclaw browser --browser-profile chrome open <url>` (ghi lại tab, ví dụ `t5`), đặt bộ lọc ngày.
2. **Gài bẫy tải** trước khi bấm: `bash bat-tai.sh t5`
3. Bấm nút tải bằng `openclaw browser --browser-profile chrome click <ref> --target-id t5`, rồi lấy file về VPS:
   `bash lay-file.sh t5 /root/bao-cao-san/<YYYY-MM>/<tên file>`
   Script đọc đường link file trang vừa tạo và VPS tự tải về. Báo "Chưa bắt được link" thì gài bẫy lại rồi bấm lại. Không bao giờ bấm tải khi chưa gài bẫy.

Gợi ý URL:
- **Quảng cáo GMV Max**: `https://seller-vn.tiktok.com/ads-creation/dashboard?mpa=1&type=product&list_start_date=<ms>&list_end_date=<ms>` (ms = 00:00 giờ VN của ngày đầu / ngày cuối, ví dụ 01/10/2026 = 1790787600000, 25/10/2026 = 1792861200000). Nút tải là nút ngay sau ô ngày (biểu tượng ⬇).
- **Đơn hàng**: `https://seller-vn.tiktok.com/order` → Bộ lọc → *Thời gian đã tạo* → Áp dụng → **Xuất** → *Đơn hàng đã lọc* + **CSV** → đợi ở *Lịch sử xuất* → gài bẫy → **Tải xuống**.
- **Quyết toán (income)**: `https://seller-vn.tiktok.com/finance/bills` → tab Báo cáo → Xem theo đơn hàng → chọn ngày báo cáo → Xuất (popup trống, chọn lại ngày) → đợi 2–5 phút → gài bẫy → **Tải xuống**.

Tên file trên VPS (mỗi tháng một thư mục `/root/bao-cao-san/<YYYY-MM>/`):
`01_OrderSKUList_<từ>-<đến>.csv`, `02_income_<từ>-<đến>.xlsx`, `03_CampaignOverview_<từ>-<đến>.xlsx` (ngày dạng YYYYMMDD).

## Nạp lên web
Trong thư mục skill này:
1. Chạy thử, đọc số: `node nap-tiktok.mjs --as ke-toan-truong-ailla <đơn> <income> <quảng cáo> --ky YYYY-MM --thu`
2. Kiểm: kỳ income in ra đúng khoảng đã chọn; số đơn hợp lý; doanh thu không lệch quá 30% so với tuần trước (cùng tháng). Lệch bất thường thì **dừng, báo chị Thảo**, không nạp.
3. Nạp thật: chạy lại không có `--thu`.
4. **Xoá thư mục file** sau khi nạp xong (file đơn có tên, số điện thoại, địa chỉ khách): `rm -rf /root/bao-cao-san/<YYYY-MM>`.
5. Nhắn chị Thảo 2–3 dòng: tháng nào, số đến ngày nào (hoặc "đủ tháng, chờ khoá sổ"), doanh thu thực, lãi kênh.

## Chống trùng số (web đã chặn, agent không cần cộng dồn)
- Mỗi tháng TikTok **chỉ có một bản** trên web. Nạp lại thì **bản mới thay bản cũ**, không cộng thêm.
- Web từ chối: tháng đã khoá sổ; tháng đã có bản đủ tháng mà mình nạp bản giữa tháng; bản mới có số đến ngày **cũ hơn** bản đang có. Gặp từ chối thì báo chị Thảo, **không tìm cách khác**.
- Web chỉ lấy đơn **tạo trong tháng** báo cáo (đơn tháng khác trong file tự bỏ), income phải bắt đầu từ ngày 01.
- Mỗi lần chạy chỉ một phiên; đang chạy mà lịch khác tới thì bỏ lượt đó.

## Gặp trở ngại
- Bị đẩy về trang đăng nhập / đòi mã xác minh: **dừng, nhắn chị Hoa tự đăng nhập**. Không tự nhập mật khẩu.
- Chrome máy chị tắt hoặc tiện ích OpenClaw mất kết nối (`tabs` không trả về): nhắn chị bật máy / mở Chrome, thử lại sau 30 phút, tối đa 3 lần.

## Cài lần đầu trên VPS
Trong thư mục này: `npm install` (thư viện đọc Excel `xlsx`). `ttcalc.js` là bản chép nguyên công thức của web; web đổi công thức thì chép lại từ `hub/src/ttcalc.js` (test trên web báo lệch nếu quên). Khoá agent: `/root/.config/abos/ke-toan-truong-ailla.key`, không in ra.
