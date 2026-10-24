# Hướng dẫn cho chị Thảo: các phần mới trên web vận hành (cập nhật 24/10/2026)

Chị bấm Ctrl+F5 một lần để tải bản mới. Vào vanhanh.ailla.vn.

## 1. Việc của tôi: xử lý tiền khách và đơn chờ ghi nợ (kế toán)
Vào **Việc của tôi**, mục **Kế toán** có 3 việc:
- **Tiền đã ghi nhưng chưa trừ vào đơn nào**: bấm **Xem trước** để xem máy sẽ chia tiền thế nào (chưa ghi gì). Thấy đúng thì bấm **Chia ... khoản vào đơn**. Tiền chia vào đơn cũ nhất trước. Khoản nào đã gắn bill vào một đơn hoặc ghi mã đơn trong ghi chú thì trừ đúng đơn đó trước.
- **Xác nhận tiền khách đã chuyển**: bấm **Xem và xác nhận**. Mỗi dòng có ảnh bill nhỏ (bấm để xem lớn), mã giao dịch, đơn gắn, giờ và người nhập. Đối chiếu bill rồi bấm **Xác nhận** từng dòng.
  - Nhập sai ngày (ví dụ 05/10 gõ thành 10/05): bấm **Sửa ngày**, nhập ngày đúng và lý do.
  - Khoản ghi nhầm: bấm **Xóa**, ghi lý do. Chỉ xóa được khoản chưa xác nhận và chưa trừ vào đơn.
- **Đơn đã xuất kho, chờ xác nhận ghi nợ**: bấm **Xem và xác nhận**, kiểm từng đơn rồi xác nhận.

Lưu ý: đừng bấm "xác nhận cả danh sách" khi chưa kiểm hết bill.

## 2. Phiếu chi thưởng NPP (thưởng bằng tiền)
Vào **Thưởng & xếp hạng NPP**, chọn xem **theo Tháng**.
- Cột **Còn phải chi** = thưởng đạt được − đã trừ thẳng vào đơn − đã chi.
- Khách còn phải chi sẽ có nút **Chi thưởng**: bấm, nhập số tiền (không vượt số còn phải chi) và ghi chú.
- Phiếu hiện ở khung **Phiếu chi thưởng bằng tiền tháng ...** ở dưới, trạng thái chờ duyệt. Người lập không tự duyệt. Chị Thảo (quản lý điều phối) hoặc chị Hoa bấm **Duyệt chi** thì thành "đã chi". Hủy phiếu phải ghi lý do.

### 2b. Trừ thưởng thẳng vào đơn (thay cho chi tiền)
Khi khách đã đạt thưởng bằng tiền mà muốn trừ luôn vào tiền hàng của đơn sau:
1. Tạo hoặc sửa đơn của khách đó, ở phần tiền kéo xuống ô **Trừ thưởng tháng (đ)**, nhập số tiền thưởng muốn trừ.
2. Tổng phải thu của đơn **giảm đúng bằng số đó** (tiền hàng − chiết khấu − trừ thưởng + phí vận chuyển). Phiếu in cho khách hiện dòng trừ thưởng.
3. Khi đơn đã duyệt, số này tự cộng vào cột **"đã ứng"** của khách ở trang **Thưởng & xếp hạng NPP**, và **Còn phải chi** giảm theo. Không cần lập phiếu chi thưởng cho phần đã trừ.
4. Muốn biết còn phải chi bao nhiêu thì nhìn cột **Còn phải chi** (đã trừ phần ứng và phần đã chi).
5. Có thể kết hợp: trừ một phần vào đơn, phần còn lại lập **Phiếu chi thưởng** bằng tiền. Số trừ vào đơn và số chi không được vượt quá thưởng đạt được.
6. Nếu trừ nhầm: sửa đơn (đơn nháp sửa tự do, đơn đã duyệt sửa kèm lý do) để đưa ô này về đúng số. Số **"đã ứng"** âm nghĩa là đã trừ nhiều hơn thưởng đạt được, cần xem lại.

Lưu ý: chỉ tính các đơn đã duyệt trong kỳ của tháng đó. Thưởng của tháng nào thì trừ vào đơn thuộc tháng đó để báo cáo khớp.

## 3. Tạo đơn: cùng một sản phẩm vừa bán vừa tặng
Khi tạo đơn, thêm mã đã có dòng bán một lần nữa sẽ ra **dòng tặng kèm** (0 đồng). Kho chỉ thấy một mã với tổng số lượng. Tiền và thưởng chỉ tính phần bán.

## 4. Phiếu in
- **Phiếu xuất kho**: ô "Ngày xuất hàng" để trống nếu đơn chưa xuất kho. Đơn đã xuất rồi in lại thì hiện ngày xuất thật.

## 5. Hàng trả lại
- Hàng khách trả về kho: tạo phiếu như cũ, kho xác nhận nhận hàng, kế toán xác nhận giảm công nợ.
- **Hàng lỗi, khách không gửi trả về mà công ty bù cho khách**: khi tạo phiếu tích ô **"Hàng lỗi, khách không gửi trả về"**. Bắt buộc ghi lý do rõ ràng. Phiếu bỏ qua bước kho, kế toán xác nhận thẳng (trừ công nợ hoặc hoàn tiền). Tồn kho không đổi.
- Đơn có hàng tặng: hàng tặng trả lại **không được hoàn tiền**, chỉ hàng bán được hoàn.

## 6. Kho: Xuất B2B, sửa phiếu xuất (kho gửi, Thảo duyệt)
- Trong **Xuất kho > Xuất B2B**, đơn đã xuất có nút **Sửa phiếu xuất**: sửa số thực xuất từng mã, ngày xuất, người xuất. **Bắt buộc ghi lý do.**
- Kế toán kho (Chúc) bấm **Gửi yêu cầu sửa**: phiếu chưa đổi gì. Yêu cầu hiện ở đầu trang trong **Yêu cầu sửa phiếu xuất chờ duyệt** và trong **Việc của tôi** của Thảo, kèm "từ bao nhiêu thành bao nhiêu" và lý do.
- **Thảo bấm Duyệt** thì mới sửa thật. Từ chối thì ghi lý do. Thảo tự sửa thì áp ngay.
- Khi duyệt xong, máy tự: đổi tồn kho, đổi số lượng và tiền đơn, tính lại tình trạng thu tiền; đơn đã chốt tiền quay lại bước chốt tiền; đơn kế toán đã xác nhận thì mở lại để xác nhận lần nữa. Sale phụ trách, kế toán và Chúc đều nhận việc báo.
- Đổi riêng ngày xuất: tồn kho tính lại theo ngày mới, không đổi tiền.

## 7. Kho: xem phiếu nhập xuất tồn
- **Nhập – xuất – tồn**: bấm vào một mã để xem từng phiếu trong kỳ (ngày, số phiếu, loại, nhập, xuất, tồn sau). Bấm số phiếu để mở xem và in. Số xuất bán đơn B2B mở phiếu xuất kho của đơn.
- **Xuất B2C**: bảng **Bán theo ngày**, bấm một ngày để xem và in **phiếu xuất bán lẻ** của ngày đó theo từng kênh (TikTok, Shopee, Facebook). Phiếu B2C tự sinh từ Poscake nên không sửa tay.
- Có ô **Từ ngày / Đến ngày** (và nút 7 ngày, 30 ngày) để lọc, nút **Tải báo cáo xuất theo ngày** ra file Excel (tổng hợp từng ngày và chi tiết từng phiếu).

## Gặp lỗi thì làm gì
Chụp cả màn hình (có thanh địa chỉ) gửi chị Hoa để báo lại. Đừng thử lại nhiều lần với các nút xác nhận hoặc chia tiền.
