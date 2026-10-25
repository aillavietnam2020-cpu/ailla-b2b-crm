# Đăng bài Fanpage tự động: cách agent nối với web

Viết 25/10/2026. Web ABOS là nơi quản lý (lịch kiểu Postiz ở Marketing › Fanpage). Agent Fanpage trên VPS giữ mã các page và là bên đăng thật. Web KHÔNG giữ mã truy cập page nào.

## Luồng
1. Soạn bài trên lịch (hoặc agent viết, như luồng `fp_write` cũ) → Gửi duyệt → chị Hoa (sau này lead) bấm **Duyệt & lên lịch**. Chỉ bài ở trạng thái "Đã lên lịch" (step = `dang`) mới được đăng.
2. Công tắc chung (trên đầu lịch): **Tắt** (mặc định) / **Chỉ page thử** / **Bật**. Nút **DỪNG KHẨN** = về Tắt ngay.
3. Agent gọi `POST /api/fp/due` mỗi 5 đến 15 phút (giờ đăng đặt theo 15 phút: 9:00, 9:15, 9:30, 9:45); web trả các bài tới giờ (đúng ngày đầy đủ `pdate`, giờ đã qua, trễ không quá 6 giờ, tối đa 5 bài/lần) và đánh dấu "đang gửi" ngay, nên gọi lại không bị đăng đôi.
4. Agent đăng lên Facebook bằng mã page của nó, rồi gọi `POST /api/fp/done`.

## API (header `X-Fp-Key: <FP_KEY>`, cùng khóa với việc `fp_write`)
- `POST /api/fp/due` → `{ mode, posts: [{ card_id, page_id, page_name, kind, ... }] }`
  - `kind = "feed"`: có `message`, tùy chọn `link` → `POST /{page_id}/feed`
  - `kind = "photos"`: có `url`, `caption` → `POST /{page_id}/photos`
  - `kind = "videos"`: có `file_url`, `description` → `POST /{page_id}/videos`
- `POST /api/fp/done` với `{ card_id, ok: true, fb_post_id }` hoặc `{ card_id, ok: false, error }`.
  Lỗi thì bài hiện "Lỗi" trên lịch, KHÔNG tự đăng lại; chị kiểm tra trên page rồi mở lại.
- Bài kẹt "đang gửi" (agent chết giữa chừng) cũng không tự đăng lại: kiểm tra page rồi bấm Mở lại.

## Khai báo page
Trên lịch, cột Kênh › "+ Thêm page": mã page (dãy số) + tên + đánh dấu page thử. Tên/mã phải khớp page trong `facebook-pages.json` của agent. Làm page thử trước, thử xong mới thêm page thật.

## Ghi chú
- Giờ đăng theo bước 15 phút. Cron của web (đăng thẳng khi có mã page) chạy mỗi 15 phút; các việc khác của cron vẫn chạy mỗi giờ như cũ.
- Lịch xem được nhiều tháng; mỗi bài có ngày đầy đủ `pdate` (YYYY-MM-DD).
- Ảnh/video phải là link tải trực tiếp (link Drive được đổi sang dạng tải trực tiếp; video lớn trên Drive có thể bị Facebook từ chối).
- Nếu sau này muốn web tự đăng thẳng (không qua agent), dán mã page khi thêm page (API `POST /api/hub/fp-publish/pages` có tham số `token`); mã được mã hóa. Lúc đó cron web đăng, agent không nhận bài của page đó.
