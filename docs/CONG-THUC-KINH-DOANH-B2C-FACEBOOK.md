# Công thức trang Kinh doanh B2C · Facebook

Tài liệu cho chị Hoa, lead Sale và team Digital. Viết bằng lời thường. Mỗi mục nói rõ **tính thế nào**, **số lấy từ đâu**, và **ví dụ số thật** để ai cũng tự kiểm lại được.

Cập nhật: 23/10/2026. Trang: web vận hành (vanhanh.ailla.vn) và trang quản trị (quantri.ailla.vn), menu Kinh doanh B2C, Facebook.

---

## 1. Ai xem trang nào, thấy gì

| Trang | Ai xem | Thấy gì |
|---|---|---|
| **Vận hành** (vanhanh.ailla.vn) | team Digital, Sale | doanh thu chốt, phễu đơn, tỷ lệ hủy và hoàn, chi phí quảng cáo, chi phí vận chuyển, cảnh báo. **Không có** giá vốn, lãi, chi phí khác |
| **Quản trị** (quantri.ailla.vn) | chị Hoa, kế toán | Lãi lỗ (P&L) đầy đủ, cơ cấu chi phí, hiệu quả theo sản phẩm, nhập chi phí vận hành. Có thêm tab "Bán hàng" (phần của Sale, Digital) |

---

## 2. Số liệu lấy từ đâu

| Nguồn | Lấy gì | Cập nhật |
|---|---|---|
| **Pancake (API)** | đơn tạo, đơn hủy, đơn giao, đơn hoàn, doanh thu theo ngày và theo người | máy chủ tự kéo mỗi sáng 7 giờ |
| **Sheet Pancake** (AILLA_Pancake_v5) | giá vốn và phí vận chuyển **thật từng đơn**, giá vốn từng sản phẩm | nạp vào web (hiện làm tay khi chị cần), có đến ngày gần nhất |
| **Facebook BM** | chi tiêu quảng cáo từng ngày; giao dịch tiền Facebook đã trừ | máy chủ tự kéo mỗi sáng |
| **File Digital** | chi phí quảng cáo tháng 8, 9 (tháng cũ chưa có số BM) | số đã chốt trước đó |

---

## 3. Định nghĩa các loại đơn

- **Đơn tạo**: mọi đơn phát sinh trong ngày, kể cả đơn mới chưa gọi xác nhận.
- **Đơn hủy**: đơn bị hủy trước khi giao.
- **Đơn chốt (đã xác nhận)** = đơn tạo − đơn hủy.
- **Đơn giao thành công**: khách đã nhận hàng.
- **Đơn hoàn**: đã giao đi rồi bị trả lại (mất phí ship hai chiều).
- **Đơn đang giao / chưa giao xong**: đã chốt nhưng chưa có kết quả cuối.

Ví dụ tháng 10 (01/10–21/10): 6.639 đơn tạo, 1.272 đơn hủy, **5.367 đơn chốt**, 3.271 đơn giao thành công, 367 đơn hoàn.

---

## 4. Ba cách tính doanh thu (quan trọng, đừng nhầm)

Giá trị một đơn = **Tổng tiền − Giảm giá** (cột "DOANH THU THỰC" của Sheet).

| Dùng cho | Doanh thu = | Có tính đơn hoàn? |
|---|---|---|
| **Digital** đo hiệu quả quảng cáo theo ngày (tạm) | tổng giá trị **đơn đã xác nhận** (đơn chốt) | **Có** |
| **Sale, chị Hoa** | tổng giá trị đơn đã xác nhận, **bỏ đơn hoàn**, bỏ đơn hủy | **Không** |
| **P&L cuối tháng** | tổng giá trị **đơn giao thành công** | **Không** |

Lý do: Digital cần số sớm trong ngày để biết quảng cáo có ra đơn không, lúc đó chưa biết đơn nào hoàn. Sale và P&L cần số thật nên bỏ đơn hoàn.

Ví dụ tháng 10: doanh thu chốt (cách của Digital) 788,4 triệu; doanh thu đơn giao thành công (cách của P&L) 548,8 triệu. Chênh vì còn nhiều đơn đang giao và đơn hoàn.

---

## 5. Các tỷ lệ

| Chỉ số | Công thức | Ngưỡng cảnh báo |
|---|---|---|
| **Tỷ lệ chốt** | đơn chốt ÷ đơn tạo | |
| **Tỷ lệ hủy** | đơn hủy ÷ **đơn tạo** (không phải đơn đã kết thúc) | trên **20%** thì báo đỏ |
| **Tỷ lệ hoàn** | đơn hoàn ÷ (đơn giao thành công + đơn hoàn) | trên **9%** thì báo đỏ |
| **Giá trị TB mỗi đơn** | doanh thu chốt ÷ đơn chốt | |
| **CPO** (chi phí mỗi đơn) | chi phí quảng cáo gồm thuế ÷ đơn chốt | |
| **ROAS** | doanh thu chốt ÷ chi phí quảng cáo. Hiển thị cả gồm thuế và chưa thuế | **hòa vốn 1,8** (chưa thuế); dưới 1,8 báo đỏ |
| **Chi phí QC ÷ doanh thu** | chi phí quảng cáo gồm thuế ÷ doanh thu chốt | trên **35%** thì cảnh báo |
| **Phí vận chuyển ÷ doanh thu** | phí vận chuyển ÷ doanh thu đơn giao thành công | trên **10%** thì cảnh báo |
| **Biên lợi nhuận mục tiêu** | | **18,5%** |

Mỗi cảnh báo trên trang kèm việc cần làm và quy ra tiền (ví dụ "kéo tỷ lệ hủy về 20% cứu được khoảng N đơn ≈ X triệu").

---

## 6. Chi phí quảng cáo

| Giai đoạn | Cách lấy | Gồm thuế? |
|---|---|---|
| **Trong tháng** (ví dụ tháng 10) | số Facebook chi tiêu từng ngày, cộng **10%** thuế. Cùng nguồn với trang "Giao dịch thanh toán Facebook" của vận hành. Chiến dịch "chưa rõ người" **vẫn tính** | nhân 1,1 |
| **Tháng đã kết thúc** (từ tháng 11) | **tổng tiền Facebook thật đã trừ** trong nhật ký giao dịch (cột "Giao dịch thực tế trong BM"), không nhân 1,1 | đã gồm thuế |
| **Tháng 9** | báo cáo Digital × 1,1 | nhân 1,1 |
| **Tháng 8** | báo cáo Digital × 1,1. Số này chưa đối chiếu được, đang để nguyên | nhân 1,1 |

Ghi chú: nhật ký giao dịch thật máy chủ mới ghi từ 14/10/2026 nên tháng 10 chưa dùng số thật được.

---

## 7. Giá vốn, vận chuyển

- **Giá vốn hàng bán**: lấy từ Sheet, giá vốn thật của từng đơn đã giao thành công (theo bảng quy đổi combo ra sản phẩm và giá vốn từng sản phẩm).
- **Phí vận chuyển**: phí ship thật của từng đơn đã giao thành công.
- **Ship đơn hoàn hai chiều** = **2 lần** phí ship của các đơn hoàn (đi và về).

---

## 8. Bảng Lãi lỗ (P&L), trang quản trị

| Dòng | Cách tính |
|---|---|
| **Tổng doanh thu** | doanh thu đơn giao thành công |
| **Lãi gộp** | doanh thu − giá vốn − phí vận chuyển − ship đơn hoàn hai chiều |
| **Lãi đóng góp kênh** | lãi gộp − chi phí quảng cáo (gồm thuế) |
| **Chi phí vận hành** | số chị nhập ở tab "Nhập chi phí" (lương, kho, mặt bằng, quản lý) × % phân bổ cho Facebook × (số ngày của kỳ ÷ số ngày của tháng) |
| **Lợi nhuận** | lãi đóng góp kênh − chi phí vận hành đã phân bổ |
| **Tổng chi phí** | giá vốn + vận chuyển + ship hoàn + chi phí quảng cáo + chi phí vận hành |
| **Biên lợi nhuận** | lợi nhuận ÷ tổng doanh thu |

Chưa nhập chi phí vận hành thì lợi nhuận ghi "tạm tính, chưa trừ vận hành".

Ví dụ tháng 9 (kỳ đã đóng, số thật): doanh thu 1,21 tỷ; giá vốn 186 triệu; vận chuyển 115,1 triệu; ship hoàn 26,4 triệu; **lãi gộp 882,5 triệu**; chi phí quảng cáo 542,2 triệu; **lãi đóng góp kênh 340,3 triệu (28,1%)**.

---

## 9. So sánh, mục tiêu, dự kiến

- **So cùng kỳ tháng trước**: kỳ này so với cùng các ngày của tháng trước (ví dụ 01/10–22/10 so với 01/09–22/09). Mũi tên xanh là tốt: chi phí giảm, doanh thu và lợi nhuận tăng.
- **Mục tiêu tháng**: so doanh thu đơn chốt với mục tiêu chị đặt (tab "Nhập chi phí"). **Dự báo cuối tháng** = doanh thu chốt ÷ số ngày đã có số × số ngày của tháng.
- **Dự kiến khi đơn đang giao có kết quả** (chỉ hiện với kỳ còn đơn mới, trong 14 ngày gần nhất): doanh thu dự kiến = đơn đã giao thành công + (đơn đang giao và chưa giao) × (1 − **8%** hoàn dự kiến). Giá vốn tính theo giá vốn thật từng đơn đang giao, chi phí quảng cáo giữ nguyên. Tháng đã đóng không có ô này vì số thật đã là số chuẩn.

---

## 10. Bảng xếp hạng team Sale

**Tính KPI**: Mai Hương, Huyền Phạm, Linh Ha.
**Không tính sale** (hiện riêng để đủ tổng): chị Hoa, chị Thảo quản lý ("Nguyễn Thanh Thảo"), Thảo Đĩnh (Thảo ads, được xác nhận đơn nhưng không tính doanh thu như sale), tài khoản "Việt Nam" (đơn tự động từ trang bán hàng, máy chủ gọi API_CONNECTION), đơn chưa gán người.

Doanh thu mỗi người theo **cách của Sale** ở mục 4: đơn đã xác nhận, bỏ đơn hoàn, bỏ đơn hủy, xếp theo **ngày tạo đơn**, để cùng cách đếm đơn của Sheet. Máy chủ kéo từ Pancake theo ngày tạo đơn (tham số success_record = inserted_at), rồi trừ doanh thu đơn hoàn. Cảnh báo "hủy cao" khi tỷ lệ hủy của người đó trên 20%.

---

## 11. Chỗ số trên web và Google Sheet có thể lệch

Em đã so ngày 22/10: tổng đơn tạo lệch 0,1%, đơn hủy 0,4%, doanh thu 0,9% trên 75 ngày. Từng ngày lệch nhẹ vì:
- Pancake API (máy chủ) xếp doanh thu vào **ngày xác nhận**, Sheet xếp vào **ngày tạo đơn**.
- Sheet cộng cả đơn "Mới" chưa xác nhận, Pancake thì không.

Khi hai số khác nhau, xem **số đơn trước** (đếm cùng ngày tạo), sau đó mới so doanh thu.

---

## 12. Việc chưa làm hoặc đang để tạm

- Phí vận chuyển và giá vốn nạp từ Sheet bằng tay đến ngày gần nhất. Khi chị nhập chi phí thật trên web thì thay.
- Chi phí vận hành, mục tiêu doanh số Facebook: chị nhập ở tab "Nhập chi phí".
- Tháng 8 chưa đối chiếu được chi phí quảng cáo.
- Doanh thu theo người đã chuyển sang cách của Sale (mục 10) từ 23/10/2026. Người tính KPI chính (Huyền Phạm, Mai Hương) lệch Sheet khoảng 3 đến 4%; các tài khoản Linh Ha, Thảo Đĩnh và đơn tự động còn lệch nhiều hơn vì Sheet và Pancake gán đơn cho người khác nhau.
