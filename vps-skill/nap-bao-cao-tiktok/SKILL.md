---
name: nap-bao-cao-tiktok
description: Hằng tuần tải 3 file kế toán của TikTok Shop (đơn hàng, quyết toán, quảng cáo) và nạp số lãi lỗ tháng lên web ABOS. CHỈ agent Kế toán trưởng dùng (chị Hoa duyệt 25/10/2026).
---

# nap-bao-cao-tiktok — nạp báo cáo TikTok Shop lên web ABOS

Chị Hoa giao cho **Agent · Kế toán trưởng** làm hằng tuần (sáng thứ Hai). Agent khác không dùng; web cũng từ chối nếu agent chưa được chị tick phạm vi "Nạp báo cáo sàn TikTok".

## Việc mỗi tuần
1. Mở TikTok Shop Seller Center bằng tiện ích Chrome, tải 3 file của **tháng đang chạy**, từ ngày 01 đến hôm qua:
   - **Đơn hàng**: Đơn hàng › Xuất đơn (OrderSKUList), lọc theo ngày tạo đơn.
   - **Quyết toán (income)**: Tài chính › Quyết toán › Xuất, khoảng ngày bắt đầu từ ngày 01 của tháng.
   - **Quảng cáo**: Ads › Campaign overview data, theo ngày.
2. Chạy thử trước, đọc số:
   `node nap-tiktok.mjs --as AGENT_ID <file đơn> <file quyết toán> <file quảng cáo> --thu`
3. Số hợp lý thì chạy lại không có `--thu` để nạp. Lần nạp sau thay bản trước của cùng tháng (web ghi là "giữa tháng, đến ngày X").
4. **7h sáng ngày 10** hằng tháng: tải file của **tháng trước** (đơn từ ngày 01, quyết toán tới **hết ngày 09** tháng này) và nạp, đó là bản đủ tháng (chị Hoa chốt 27/10: chốt sổ ngày 10). Từ ngày 01 đến 09, file tháng trước nạp vào chỉ là bản giữa tháng (dự kiến). Kế toán xem và **khoá sổ trên web** từ ngày 10; agent không khoá sổ.
5. Nhắn chị Thảo 2–3 dòng: tháng nào, đến ngày nào, doanh thu thực, lãi kênh. Không dán bảng dài.

## Nguyên tắc cứng
- File đơn hàng có tên, số điện thoại, địa chỉ khách: chỉ đọc trên máy này, không gửi ai, không dán vào chat, xoá sau khi nạp xong. Công cụ chỉ gửi số đã tính lên web.
- Web từ chối khi: tháng đã khoá sổ, tháng đã có bản chốt đủ tháng (không thay bằng bản giữa tháng), hoặc bản mới cũ hơn bản đang có. Gặp từ chối thì báo chị Thảo, không tìm cách khác.
- Khoá agent đọc như lệnh `abos` (`/root/.config/abos/<AGENT_ID>.key`). Không in khoá ra.
- Shopee chưa làm: chờ chị Hoa gửi file mẫu.

## Cài lần đầu trên VPS
Trong thư mục này: `npm install` (cần thư viện đọc Excel `xlsx`). `ttcalc.js` là bản chép nguyên công thức của web; khi web đổi công thức thì chép lại bản mới từ `hub/src/ttcalc.js` (test trên web báo lệch nếu quên).
