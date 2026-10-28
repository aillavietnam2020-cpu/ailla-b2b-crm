# Đấu nối Sổ chi phí · Tài sản & CCDC · Mua hàng / Kho

Chị Hoa giao 28/10: MỘT chat giữ phần đấu nối này (chat "đấu nối"). Chat Sổ chi phí và chat Tài sản không sửa các điểm dưới đây; cần đổi thì nhắn chat đấu nối.

## 1. Một danh mục nhóm (chỉ ở Sổ chi phí, `SC_DM0` trong `hub/src/sochi.js`)

| Nhóm | Tên | TK | Loại |
|---|---|---|---|
| G25 | Chi phí sản xuất thành phẩm | 154.1 | Giá vốn |
| G26 | Chi phí sản xuất bán thành phẩm | 154.2 | Giá vốn |
| G27 | Khấu hao tài sản cố định (phần bán hàng, quản lý) | CHIA | B - Phòng ban |
| G28 | Mua tài sản cố định / công cụ dụng cụ | 211 | Không tính |

- Trang Tài sản không giữ danh mục riêng: `tsDtNap()` đọc `scDM()` để biết nhóm của 154.1 / 154.2 / khấu hao / mua. `TS_DM_MOI` trong `tscalc.js` chỉ là bản dự phòng khi danh mục chưa có.
- Phân bổ CCDC vào nhóm G14 (có sẵn). Phần xưởng của khấu hao / phân bổ vào G25 / G26 theo bộ phận chịu (154.1 / 154.2).

## 2. Phiếu chi nhóm G28 (và G15)

- Không vào chi phí tháng: `scPBRows`, `scCanPL`, Lãi lỗ bỏ G28.
- Form phiếu chi có nút **Ghi tăng tài sản / công cụ** → `tsGhiTangTuPhieu(id)`:
  1. Phiếu đã gắn tài sản (`a.nkc === id`) → mở tài sản đó (nút đổi thành "Xem tài sản / công cụ đã ghi tăng"). Không ghi tăng lần hai.
  2. Tìm đơn mua khớp (`tsTimDon`: số tiền, nhà cung cấp, ngày, tên hàng). Hàng của đơn đã được ghi tăng mà chưa gắn phiếu (`tsTrungDon`) → mở cái đó, Lưu là gắn phiếu.
  3. Còn lại → form ghi tăng điền sẵn mã / tên / NCC / nguyên giá / ngày. Mã lớp CCDC đã biết là tài sản hay công cụ (nhóm hàng "Tài sản cố định" → TSCĐ). Mã trùng thì để trống.
- Ô **Mã** không bắt buộc: để trống thì web tự đặt theo tên (`tsMaTuDong`).
- Tab **Ghi tăng** ở trang Tài sản: chọn phiếu ở ô "Mua từ phiếu chi" thì điền sẵn như trên (hoặc mở tài sản đã có của cùng đơn).
- Ghi tăng từ thẻ "Hàng mua đã nhận" tự gắn phiếu chi G28 trả cho đơn đó (`tsPhieuCuaDon`).
- Trang Tài sản chỉ ghi phía tài sản (`fin.ts`); nhóm của phiếu chi do Sổ chi phí giữ.

Lỗi 28/10: máy chiết rót PC-2026-10-0006 đã được ghi tăng (CC `MaychietEzpack`) từ thẻ Hàng mua đã nhận nhưng chưa gắn phiếu; bấm Ghi tăng ở phiếu chi lại mở bản mới cùng mã → "Mã ... đã có". Đã sửa theo mục 2.1–2.2.

## 3. Khấu hao / phân bổ tháng: một nguồn mỗi tháng

- Tháng trang Tài sản đã chạy "Khấu hao tháng" (`tsChiPhiThang(ym).chay`): số web là chuẩn. Dòng PBCC / KHTS / khấu hao nạp từ MISA tháng đó chỉ để đối chiếu (`scChiDoiChieu`, không vào `scRows`).
- Tháng chưa chạy: giữ dòng MISA.
- Trang Tài sản KHÔNG ghi `fin.nkc`. Nơi đọc số web, mỗi nơi đúng một lần:
  - Sổ chi phí: Nhật ký chi, Theo chức năng, Phân bổ (`scAuto`, `sochi.js`), tổng chi chung (`socp.js`).
  - Lãi lỗ theo kênh (`doanhthu.js`, chat Doanh thu).
  - Giá thành 154.1 / 154.2: ô "Chi phí SX chung / lít" ở trang Giá thành (bọc `kho_boc` trong `taisan.js`).

## 4. Quyền

- Ghi tăng: kế toán / CEO (`tsCanGhi`) và người ghi phiếu chi như Thảo (`scCanGhi`) → `tsCanGhiTang`.
- Người không có quyền ngăn tài chính (`debt.read.all`) ghi tăng thì vào `D().tsCho`, kế toán duyệt ở thẻ "Ghi tăng chờ duyệt".
- Chưa làm (chờ chị Hoa): báo cho chị Huệ khi có ghi tăng chờ duyệt.

## 5. Đơn mua tài sản / công cụ (chị Hoa duyệt 28/10)

- Ghi nhanh › "Lập đơn mua tài sản / công cụ" (`mhForm(null,{ts:true})`), chỉ mã lớp CCDC.
- Kho Nhận hàng: mã lớp CCDC → máy chủ thêm dòng xuất cùng phiếu nhập (`purchasing.ts`), không vào tồn kho. Trang Tài sản hiện thẻ "Hàng mua đã nhận, chưa ghi tăng".
- Hàng nhận TRƯỚC luật này vẫn nằm trong tồn kho. Ví dụ: `MaychietEzpack` tồn 1 (nhận 05/10, đơn PM2610-009). Cách gỡ đề xuất: một phiếu xuất dùng 1 cái, ngày 05/10, ghi chú "Ghi tăng CCDC", làm ở Kho. Không tự sửa tồn kho thật khi chị chưa đồng ý.

## 6. Bản web trên trình duyệt

- `/hub/` gửi `Cache-Control: private, no-cache` + ETag theo BUILD_ID: mỗi lần mở đều hỏi lại máy chủ, bản mới thì tải mới. `public/sw.js` không lưu đệm.
- Trang đang mở hỏi `/hub/build` mỗi 60 giây; khác BUILD_ID thì hiện "Có bản web mới · Tải lại ngay".

## 7. Mua hàng trong kế toán, Nhật ký chi một danh sách (chị Hoa 28/10 tối)

- Quản trị › Tài chính – Kế toán › Thu chi có **Mua hàng (đơn, nhận hàng, chứng từ)** = trang `mh_po` (bấm từng đơn: Nhận hàng, Ghi chứng từ, trả tiền NCC). `menubang.js` thôi bỏ `mh_po` ở web quản trị.
- Nhận hàng: nguyên vật liệu / hàng hóa vào tồn kho; mã lớp CCDC không vào kho, chờ ghi tăng (mục 5).
- Nhật ký chi (`scNK`) gộp mọi khoản chi một bảng theo ngày: phiếu chi, trả NCC, vận chuyển, quảng cáo, lương, khấu hao… Bỏ chế độ "Chi phí NVL" riêng (`SC.nkv`); thêm bộ lọc **Mọi nguồn** (`SC.ng`).
- Trả NCC: `scDonCuaPay(pay)` tìm đơn mua (po_id, hoặc receipt_ids của chứng từ). Đơn toàn hàng CCDC (`tsDonTaiSan`) → dòng là G28 "Mua tài sản / công cụ", không vào chi phí NVL, không vào chi phí tháng. Bấm dòng → phiếu trả kèm ô **Đơn mua** (bấm mở đơn, `mhMoDon`).
- Phiếu chi có ô **Thuộc đơn mua** (`row.po` = id đơn): chọn đơn tài sản / công cụ thì tự chuyển G28. Form phiếu hiện đơn mua (đã chọn, hoặc web đoán theo `tsTimDon`).
- Thẻ tài sản / công cụ hiện **Đơn mua** (`a.po` số PM…, hoặc đơn khớp phiếu `a.nkc`) và **chi phí mua kèm** = phiếu chi có `po` đúng đơn đó, trừ phiếu tiền hàng (`tsPhiDon`, nhiều tài sản cùng đơn thì chia theo giá trị). Ghi tăng mới tự cộng vào nguyên giá; tài sản đã có thì bấm "Cộng … vào nguyên giá". Phiếu đã cộng lưu ở `a.phi`.

## 8. Công cụ trong kho (chị Hoa chốt 28/10 tối)

- Mua tài sản / công cụ đi qua Mua hàng: form đơn mua có ô tích **Đơn mua tài sản / công cụ dụng cụ** (đơn toàn hàng CCDC thì mặc định đang tích). Đơn vẫn hiện ở Mua hàng; nhận hàng ghi "Vào sổ tài sản / công cụ", không vào tồn kho.
- Phiếu nhập kho gõ tay (`POST /api/hub/kho/docs` type PN) có mã lớp CCDC: máy chủ thêm dòng xuất dùng ngay cùng phiếu (như `purchasing.ts`) và cảnh báo ghi tăng ở trang Tài sản. Phiếu mua tự tạo từ phiếu nhập chỉ tính dòng IN.
- Công cụ tồn cũ: gỡ khỏi tồn kho bằng một phiếu xuất khác (XK) ngày 28/10, không xóa lịch sử.
- Ghi tăng chờ duyệt (`D().tsCho`) hiện ở **Việc chờ tôi** (vieccho.js) cho người duyệt được (kế toán / CEO), bấm mở trang Tài sản.
