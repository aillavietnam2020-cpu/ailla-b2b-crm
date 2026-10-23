---
name: dieu-hanh-agent
description: Danh bạ và cách phối hợp 12 agent của AILLA, và trang web "Điều hành agent" nơi chị Hoa nhắn từng agent. Đọc khi chị Hoa hỏi về các agent khác, về hệ thống Điều hành agent, hoặc khi cần biết nhờ agent nào làm việc gì.
---

# Hệ thống "Điều hành agent" của AILLA

## Web Điều hành agent là gì
Trang trên web vận hành (vanhanh.ailla.vn → mục **Điều hành agent**). Mỗi agent là một "nhân sự AI" có thẻ riêng (ảnh, tên, chức danh, trạng thái). Chị Hoa bấm vào từng bạn để nhắn trực tiếp, cũng như nhắn bạn ấy trên Telegram; hai nơi là **cùng một cuộc trò chuyện** (cùng trí nhớ). Tin Telegram của chị Hoa cũng hiện trên trang đó. Bạn (Thảo, AILLA Center) cũng có thẻ trên trang này, là trợ lý tổng quản.

## Danh bạ 12 agent (mã dùng trong lệnh)
| Mã | Tên hiển thị | Việc chính | Đọc được trên web ABOS |
|---|---|---|---|
| `main` | AILLA Center (Thảo) | Trợ lý tổng quản của chị Hoa | Toàn bộ: đơn, công nợ, kho, Marketing, Công xưởng |
| `lead-sale-ailla` | Lead Sale | Trưởng nhóm Kinh doanh | Đơn hàng, khách và công nợ |
| `ke-toan-truong-ailla` | Kế toán trưởng | Công nợ, thanh toán, đối soát | Đơn hàng, khách và công nợ |
| `ke-toan-kho-ailla` | Kế toán kho | Kho, đơn chờ kho | Kho, đơn đang chờ kho |
| `ky-thuat-san-xuat-ailla` | Kỹ thuật sản xuất | Pha chế, hóa chất | Kho, hóa chất, phiếu pha chế |
| `lead-content-ailla` | Lead Content | Trưởng nhóm Content | Thẻ video team Content, Công xưởng SX video |
| `lead-digital-ailla` | Lead Digital | Trưởng nhóm Digital | Order Digital, số quảng cáo |
| `media-ailla-agent` | Media | Ảnh, video, thiết kế | Thẻ video Content, Công xưởng |
| `duan-ads-agent` / `thaodinh-ads-agent` / `viet-anh-ads-agent` | Ads Duẩn / Thảo Đinh / Việt Anh | Chuyên viên quảng cáo | Order Digital, số quảng cáo |
| `zalo-tro-ly-hoa` | Zalo trợ lý | Trợ lý Zalo của chị Hoa | Tạm chưa |

## Cách phối hợp
- **Xem số liệu thật trên web:** kỹ năng `abos-web` (lệnh `abos --as main ...`).
- **Hỏi một agent khác:** kỹ năng `hoi-agent` (lệnh `hoi-agent --as main <mã> "<câu hỏi>"`). Hiện chỉ được hỏi **Kế toán trưởng** (`ke-toan-truong-ailla`). Các agent khác chưa mở; nếu cần thì nói với chị Hoa để chị mở quyền.
- Đừng cố gọi agent khác bằng cách nào khác ngoài `hoi-agent`.
- Khi chị Hoa hỏi "agent X đang làm gì / ai phụ trách việc này", trả lời theo bảng trên, nói rõ bạn biết gì từ danh bạ và gì chưa kiểm chứng.
