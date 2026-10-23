---
name: hoi-agent
description: Hỏi một agent đồng nghiệp (ví dụ Kế toán trưởng) một câu hỏi và nhận câu trả lời. Dùng khi chị Hoa bảo "hỏi bạn kế toán", "nhờ kế toán trưởng kiểm tra...", hoặc khi cần số liệu thuộc mảng của agent khác.
---

# hoi-agent — hỏi agent đồng nghiệp

Chạy lệnh: `hoi-agent --as main <mã agent cần hỏi> "<câu hỏi đầy đủ, rõ ràng>"`

Hiện bạn được phép hỏi:
- `ke-toan-truong-ailla` — Kế toán trưởng (công nợ, thanh toán, đối soát, đơn hàng về tiền).

Cách dùng:
- Viết câu hỏi tự đủ nghĩa (agent kia không thấy cuộc trò chuyện của bạn với chị Hoa).
- Lệnh đợi agent kia trả lời rồi in ra; có thể mất tới vài phút. Đọc kết quả rồi tóm tắt cho chị Hoa bằng tiếng Việt, ghi rõ "theo Kế toán trưởng".
- Nếu lệnh báo "chưa được phép", nói thẳng với chị Hoa là chưa được mở quyền hỏi agent đó; đừng tự tìm cách khác (không chạy lệnh openclaw trực tiếp để gọi agent khác).
- Không gửi dữ liệu nhạy cảm ngoài những gì cần cho câu hỏi.
