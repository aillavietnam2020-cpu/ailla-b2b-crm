# Kế hoạch nối 12 agent với web ABOS

Dùng hệ thống agent có sẵn ở thư mục chính (chưa lưu/chưa lên web): khoá `agt_...`, quyền `agent.read` / `agent.propose`, cổng `/api/agent/*`, đề xuất chờ duyệt (proposals), dòng sự kiện (events).

## Đã có sẵn trong code (thư mục chính)
- Đọc: `/me`, `/orders`, `/orders/:id`, `/customers/:id` (kèm công nợ), `/shortages`, `/kho/alerts`, `/kho/stock`, `/events`.
- Ghi duy nhất: `POST /proposals` → người có quyền bấm Chấp nhận/Từ chối. Mọi thứ khác mặc định là "chỉ đề xuất".
- CEO tạo/đổi khoá/khoá agent ở `/api/admin/agents`. Khoá chỉ hiện một lần, web giữ bản băm.

## Còn thiếu (cần làm trên web trước khi nối đủ)
1. Quyền theo vai: hiện mọi agent có `agent.read` thì thấy như nhau. Kế toán kho không nên thấy công nợ; ads không cần thấy đơn. → thêm phạm vi theo từng agent (đơn / công nợ / kho / việc).
2. Chưa có: danh sách công nợ toàn công ty, việc quá hạn, cảnh báo hệ thống (chỉ có công nợ theo từng khách).
3. Nhật ký "agent nào đọc gì" ở lệnh đọc (hiện chỉ ghi lúc đề xuất).

## Phạm vi đề xuất theo agent
| Agent | Đọc | Đề xuất |
|---|---|---|
| main (AILLA Center), zalo-tro-ly-hoa | tất cả | có |
| lead-sale-ailla | đơn, khách, công nợ, việc | nhắc việc, theo dõi tiền |
| ke-toan-truong-ailla | đơn, công nợ, tiền về | theo dõi tiền/bill, lệch |
| ke-toan-kho-ailla, ky-thuat-san-xuat-ailla | kho, hàng thiếu | cảnh báo tồn, đề xuất sản xuất |
| lead-content, lead-digital, media, 3 agent ads | việc, cảnh báo | không (giai đoạn 1) |

## Các bước (mỗi bước chị duyệt)
1. Chị quyết: lưu/đưa phần agent đang dở ở thư mục chính lên web (cần xử lý chung với các sửa dở khác, vì deploy từ đó).
2. Bổ sung 3 điểm "còn thiếu" ở trên.
3. Chị vào trang quản lý agent tạo 12 tài khoản agent, copy từng khoá.
4. Chị tự dán khoá vào cấu hình OpenClaw từng agent (biến `ABOS_AGENT_KEY`, cùng chỗ token Telegram). Em không lưu khoá.
5. Chép skill `abos-web` (thư mục này) vào `workspace/skills` của từng agent trên VPS; thử `abos me` rồi `abos kho-alerts`.
6. Chạy thử 1 agent (Kế toán kho) 2-3 ngày, xem nhật ký; rồi mở dần các agent khác.

## 9router / OpenClaw
Không cần đổi gì: agent gọi web qua skill, 9router chỉ lo model. Giữ phản hồi gọn (lọc theo mã/khách, dùng `events --after`) để không tốn token như lần trước.
