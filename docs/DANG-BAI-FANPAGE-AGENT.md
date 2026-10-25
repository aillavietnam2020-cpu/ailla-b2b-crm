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

## Việc "giao cho agent" (fp_plan) và tự lên bài vào lịch
Chị gõ yêu cầu ở ô **Giao việc cho agent** trên trang Lịch đăng Fanpage. Web tạo một việc loại `fp_plan` (agent lấy bằng `POST /api/fp/pull`, như việc `fp_write`). Trong `payload` có: `yeuCau` (lời chị), `khungXem` (từ ngày nào đến ngày nào), `pages` (page được chọn: `page_id`, `ten`, `laPageThu`), `brief`, `tuyen`, `sanPham`, `khoVideo` (video trong kho: `id`, `ten`, `link`), `daCoTrenLich` (bài đã có, để không trùng), `quyTac`.

Agent làm xong thì tạo bài vào lịch bằng **`POST /api/fp/draft`**:
```
{ "task_id": "<id việc>", "posts": [ {
  "page_id": "...", "date": "2026-10-27", "time": "09:30",
  "text": "nội dung bài", "format": "text|photo|video",
  "media_url": "https://... (ảnh hoặc video, tùy chọn)", "video_card_id": "<id video kho, tùy chọn>",
  "link": "https://... (link trang bán, tùy chọn)",
  "comment": "bình luận đầu, thường kèm link bán hàng (tùy chọn)",
  "comment_image": "https://... ảnh trong bình luận (tùy chọn)" } ] }
```
- Tối đa 60 bài/lần. Giờ làm tròn xuống bước 15 phút. Ngày phải từ hôm nay đến 180 ngày tới. `page_id` phải là page đã khai báo trên web.
- Bài luôn vào **Chờ duyệt**. Agent không duyệt được; chị duyệt rồi mới đăng.
- Gửi lại cùng bài thì web bỏ qua (không nhân đôi). Trả về `{ created, skipped: [{index, reason}] }`: bài nào bị bỏ có lý do, sửa rồi gửi lại.
- Xong thì báo việc: `POST /api/fp/push` `{ id: <id việc>, status: "done", detail: "tạo 8 bài", result: { created: 8 } }` (lỗi thì `status: "error"`, `detail: lý do`). Trên web chị thấy "Xong: tạo 8 bài" ngay dưới ô giao việc.

## Bình luận đầu
Bài có `comment` thì `POST /api/fp/due` trả thêm `comment` và `comment_image`. Agent đăng bài, rồi đăng bình luận đầu (kèm ảnh nếu có) dưới bài vừa đăng, rồi mới gọi `/done`. Nếu bình luận lỗi mà bài đã lên thì vẫn báo `ok: true` (bài đã đăng) và nhắn chị rằng bình luận lỗi; tuyệt đối không đăng lại bài.

## Khai báo page
Trên lịch, cột Kênh › "+ Thêm page": mã page (dãy số) + tên + đánh dấu page thử. Tên/mã phải khớp page trong `facebook-pages.json` của agent. Làm page thử trước, thử xong mới thêm page thật.

## Ghi chú
- Giờ đăng theo bước 15 phút. Cron của web (đăng thẳng khi có mã page) chạy mỗi 15 phút; các việc khác của cron vẫn chạy mỗi giờ như cũ.
- Lịch xem được nhiều tháng; mỗi bài có ngày đầy đủ `pdate` (YYYY-MM-DD).
- Ảnh/video phải là link tải trực tiếp (link Drive được đổi sang dạng tải trực tiếp; video lớn trên Drive có thể bị Facebook từ chối).
- Nếu sau này muốn web tự đăng thẳng (không qua agent), dán mã page khi thêm page (API `POST /api/hub/fp-publish/pages` có tham số `token`); mã được mã hóa. Lúc đó cron web đăng, agent không nhận bài của page đó.
