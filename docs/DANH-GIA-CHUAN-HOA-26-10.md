# Đánh giá chuẩn hóa web ABOS (26/10/2026)

Nguồn: cuộc chat ChatGPT "Đề xuất phân hệ web nội bộ" của chị Hoa (đọc qua Chrome) + rà soát code ngày 26/10.

## ChatGPT nói đúng
1. Vấn đề số 1 là SỐ LIỆU KHÔNG THỐNG NHẤT, chưa phải thiếu chức năng (ví dụ lãi đóng góp 449,1tr vs 445,5tr; tồn kho vận hành báo 34 mã âm, quản trị báo không có; Facebook T9 lệch 36tr — chưa kiểm số thật).
2. Mỗi màn hình trả lời một câu hỏi quản trị; quản trị theo ngoại lệ.
3. Mỗi việc một người chịu trách nhiệm chính (không "Thảo hoặc Huệ"), có hạn, có điều kiện xong.
4. Luồng chứng từ nối nhau (đơn → xuất kho → giao vận → công nợ → thu tiền).
5. Dòng tiền 13 tuần có giá trị cao, nhưng cần số dư tài khoản (kế toán chưa nhập).

## ChatGPT chưa biết / chưa đúng
- Hai web là MỘT mã nguồn, MỘT cơ sở dữ liệu (cờ HOST_MODE="admin" chỉ đổi menu/quyền). Nên không cần SSO, đồng bộ API hay "hợp nhất hai hệ": giữ hai tên miền, đổi ranh giới nghiệp vụ.
- Nó chưa bấm vào bên trong; nhiều thứ nó đề xuất đã có (Task giao việc, Phải thu, Ngân sách, Tiền & lịch chi, Máy soát số liệu 12 mục).
- Con số nó đọc là ảnh chụp lúc truy cập, chưa đối soát.

## Nguyên nhân gốc (từ code)
- Không có "một chỗ tính số chuẩn". Mỗi trang tự cộng; trang quản trị còn đè lên hàm của trang vận hành lúc chạy (tqgop.js bọc lại execNums, execOrders) nên cùng chỉ tiêu có thể ra hai số.
- Dữ liệu quan trọng nằm trong các khối JSON (hub_blobs: kd, skucost, fin…) thay vì bảng theo kỳ; chưa có khái niệm "kỳ đã chốt, không đổi".
- Mã giao diện: 105 file, ~3,1 MB JS dùng chung biến toàn cục, 117 trang.

## Đề xuất chuẩn hóa (theo thứ tự)
P0-1. Sổ chỉ tiêu chuẩn: mỗi chỉ tiêu (doanh thu từng kênh, lãi đóng góp, tồn kho, công nợ, chi phí ads) có MỘT hàm tính, ghi rõ nguồn, kỳ, thời điểm tính. Mọi trang chỉ gọi hàm đó, không tự cộng.
P0-2. Chốt kỳ ngày 10 (quy tắc chị Hoa 26/10): tháng chưa chốt hiện "dự kiến", đã chốt thì lưu đóng băng và không đổi.
P0-3. Máy soát chạy hằng ngày, thêm mục: cùng chỉ tiêu hai chỗ khác nhau, tồn kho âm, doanh thu từng kênh so với số chốt.
P1. Ranh giới hai web: vận hành = nhập và làm; quản trị = xem, duyệt, phân tích; dọn các menu trùng (Mua hàng, Kho, Tổng quan).
P1. Việc/Task gắn nghiệp vụ thật (kho thiếu NVL → việc mua hàng), mỗi việc một chủ.
P2. Liên kết chứng từ từ đơn; dòng tiền 13 tuần khi có số dư tiền.
Chưa làm: dashboard mới, gắn thêm agent — đợi số chuẩn xong.
