# Bối cảnh: Agent sale trực page Facebook của AILLA

Tài liệu mô tả hiện trạng và các quyết định đã có, để ai tiếp cận hệ thống cũng nắm được bối cảnh. Không chứa khóa hay mật khẩu. Cập nhật 21/10/2026.

## 1. Mong muốn của chị Hoa

- Có agent tự trả lời, tư vấn, chốt, lên đơn, bám đuổi khách trên các page của chị. Page thử nghiệm đầu tiên là **Ailla Việt Nam Store (id 105017945992971)**.
- Giai đoạn đầu dùng **kịch bản Pancake có sẵn**. Về sau chị muốn agent đọc hội thoại để học cách sale làm, hiểu khách hay hỏi gì, rồi **đề xuất** kịch bản mới để tối ưu chốt và bám đuổi. Chị là người duyệt đề xuất.
- Cần gửi được **ảnh và video**. Cách trình bày giống sale đang nhắn: tin ngắn (khoảng 200 chữ mỗi tin), chia ý, dùng bộ icon sale hay dùng: ✅ liệt kê, 👉 mời hành động, 🎁 ưu đãi, 🌸 chào, ⚠️ cảnh báo.
- Chị muốn câu trả lời **khôn, không cứng**, đồng thời không bịa giá, combo, công dụng.
- Chị đã yêu cầu bỏ câu "Bột dùng oxygen hoạt tính kết hợp enzyme sinh học, phát huy tốt khi pha đúng với nước nóng." khỏi kịch bản.
- Về ảnh và video: chị cho dùng mặc định các ảnh đang có (ảnh mẫu Pancake), chỗ nào sai chị sẽ gửi ảnh mới sau. Ảnh lọ hiện là ảnh cũ ghi Ailla Nature.
- Việc mở cho khách thật chị sẽ duyệt riêng. Hiện chỉ có tài khoản thử của chị được trả lời.

## 2. Nguồn dữ liệu hiện có

| Nội dung | Vị trí |
|---|---|
| Bảng giá chị cung cấp | Google Sheet "BẢNG GIÁ SP FACEBOOK", id `1_zy-0gb9Auu0iCvdk4qRo99tH4SzkIFGuObBrz7Vqkk` |
| Kịch bản bột tẩy vạn năng V5 (54 mã `/BT_*`) | VPS `/root/.openclaw/workspace/pancake/BOT-TAY-VAN-NANG-AILLA-KICH-BAN-PANCAKE-V5.md` (bản sao `/root/fb-ailla-tester/kich-ban-v5.md`) |
| 100 mẫu trả lời nhanh Pancake, có link ảnh | VPS `/tmp/pancake_quick_replies*.json` (bản sao `/root/fb-ailla-tester/pancake-quick-replies.txt`) |
| Báo cáo của agent Lead Sale về kiến thức, media, rollout | VPS `/root/.openclaw/workspace-lead-sale-ailla/deliverables/ai-truc-chat-pancake-2026-10-20/` |

Giá theo bảng chị đưa: bột tẩy vạn năng 149K / 369K / 599K; combo tẩy lồng + tẩy mốc gioăng 145K / 205K / 269K / 269K (quà theo bảng); tẩy lồng Aibio dạng gói 99K / 149K (5 gói tặng 2) / 229K (10 gói tặng 4) là dòng riêng. Trong Pancake có nhiều bảng giá tẩy lồng cũ khác nhau, các bảng đó không khớp bảng Google Sheet. Khi khách nói "tẩy lồng aibio" thì thuộc dòng gói Aibio, khác bột tẩy vạn năng.

## 3. Hiện trạng hệ thống

**ABOS (Cloudflare Workers + D1 + Hono, kho mã này)**
- Trang "Điều hành agent" trên vanhanh.ailla.vn: chat với 12 agent, gửi ảnh, copy và trả lời tin, ô "Thử như khách (theo kịch bản V5)" cho Lead Sale. Mã: `hub/src/dieuhanhagent.js`, `src/server/routes/agentChat.ts`.
- Cầu nối web và agent: `vps-relay/abos-relay.py`, chạy thành service `abos-relay` trên VPS.

**VPS 103.57.223.91 (OpenClaw, agent `lead-sale-ailla`)**
- `vps-fb/fb-ailla-tester` và `vps-fb/kichban.py` (bản sao trong kho mã; bản chạy ở `/usr/local/bin/fb-ailla-tester` và `/usr/local/lib/kichban.py`). Công cụ thử chỉ trả lời tài khoản thử của chị; hỏi Graph API mỗi 8 giây; gom tin khách trong 6 giây; hiện "đang gõ"; báo lỗi qua Telegram. Cách làm: agent chọn mã câu mẫu, chương trình gửi đúng nguyên văn câu mẫu. Service này **đang tắt**.
- Cấu hình ở `/root/.config/openclaw/fb-ailla-tester.json` (chế độ off hoặc tester, không có chế độ live). Token page nằm ở `/root/.config/openclaw/facebook-pages.json`, không đưa vào kho mã.
- Mã truy cập hộp thư webhook Cloudflare (`ailla-fb-webhook`, `ailla-sale-webhook`) đã được đổi.

**Botcake (botcake.io, page 105017945992971)**
Các luồng đã dựng, chưa gắn trigger nào nên khách thật không nhận được: BT-01 mở đầu, BT-02 tư vấn nồi chảo, BT-03 báo giá và cam kết, BT-04 đắt quá, BT-05 chốt chọn combo, BT-06 xin thông tin nhận hàng, TL-02 hướng dẫn tẩy lồng cửa đứng. Chưa dựng: TL-01, TL-03 (cửa ngang), TL-04, TL-05. Luồng thử đầu tiên "AGENT-TEST BT_GT1" vẫn còn. Luồng cũ của chị "Gửi tin nhắn-copy" (id 1441216054) có khả năng đã bị bấm Lưu một lần trong lúc làm việc, chưa kiểm tra lại.

Botcake có các khối: JSON API (gọi hệ thống ngoài, lưu kết quả vào trường khách), Điều kiện, Smart Delay, AI, Từ khóa, Kịch bản chăm sóc (bám đuổi), Live chat, "Copy sang trang khác". Cú pháp xưng hô: `#GENDER{{Anh|Chị|Anh/Chị}}`. Các điểm chưa được kiểm chứng: JSON API có lấy được tin nhắn cuối của khách không, thời gian chờ tối đa, cách rẽ nhánh theo mã.

## 4. Những điều đã quan sát về Facebook và nền tảng

- Page chưa có app nào đăng ký nhận tin qua webhook (danh sách subscribed_apps rỗng). Hộp webhook trên Cloudflare không nhận tin mới từ 19/09.
- Pancake đang là bên quản lý page. Chưa rõ app khác đăng ký thêm có nhận được tin hay không nếu không chuyển quyền giữa các app.
- Theo các nguồn đã đọc, bot chỉ nhắn tự động trong 24 giờ sau tin cuối của khách; app Facebook cần ở chế độ Live và có quyền gửi tin cho khách thật. Các điểm này chưa đối chiếu với tài liệu chính thức của Meta.
- Khi để AI tự viết theo tài liệu (như agent lúc đầu, hoặc Botcake AI, Preny) đã quan sát thấy câu trả lời lôm côm và bịa. Kịch bản V5 chỉ có bột tẩy vạn năng; tẩy lồng chỉ có mẫu Pancake không giá; phần lớn mã ảnh/video MEDIA-* chưa có file duyệt (xem `media-duyet/HUONG-DAN.txt`).

## 5. Hướng kiến trúc đã được bàn

Facebook hoặc Botcake lo nhận và gửi tin. Ở giữa là bộ điều phối gồm: **Script** (khung bước theo V5), **AI** (hiểu ý khách, soạn câu), **Rules** (giá, combo, quà, câu cấm, kiểm tra câu trước khi gửi), **Media** (chọn ảnh và video theo quy tắc). Phía sau là Pancake POS (giá, tồn kho, khách, đơn hàng; đơn tạo ở trạng thái chờ xác nhận) và web ABOS để huấn luyện, duyệt, giám sát. Câu AI viết không khớp giá, combo hoặc có câu cấm thì không gửi mà báo cho chị.

## 6. Tiêu chí chị quan tâm

- Câu trả lời đúng giá, combo, quà theo bảng giá chị đưa.
- Câu ngoài kịch bản thì dừng và báo chị, không đoán.
- Nhân viên nhắn tay thì bot im; có nút tắt khẩn.
- Ảnh và video gửi đúng chỗ, đúng nhóm vết bẩn.
- Có thể kiểm tra chất lượng bằng cách cho AI trả lời lại các hội thoại cũ rồi so với câu sale đã nhắn (đã bàn, chưa làm).

## 7. Ràng buộc chị Hoa đã nêu

- Triển khai lên hệ thống thật khi nào chị đồng ý thì mới làm.
- Khóa và token do chị tự dán vào đúng chỗ, không đưa vào khung chat hay kho mã.
- Chỉ thử với tài khoản của chị, chưa gửi cho khách thật.
- Không sửa các luồng Botcake cũ của chị.
