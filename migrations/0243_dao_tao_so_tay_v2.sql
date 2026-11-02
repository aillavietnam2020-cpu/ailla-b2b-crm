-- Đào tạo: sổ tay web bản 2 (02/11/2026, chị Hoa duyệt mẫu): sơ đồ luồng việc + ảnh chụp màn hình đánh số (public/daotao/*.jpg, dữ liệu mẫu).
-- Chỉ ghi đè trang chưa ai sửa trên web (updated_by = he-thong); lên bản 2 để người đã đọc được nhắc đọc lại. Sau này sửa trên web, KHÔNG sửa file này.
UPDATE dt_doc SET title = 'Bắt đầu: đăng nhập, màn hình và mục Của tôi', summary = 'Đăng nhập, đọc màn hình chính, gửi đơn nghỉ phép', body = '# Đăng nhập
Mở Chrome trên máy tính hoặc điện thoại, gõ **vanhanh.ailla.vn**.
![Màn hình đăng nhập](/daotao/bd-1-dang-nhap.jpg)
1. Ô **Email**: email công ty được cấp.
2. Ô **Mật khẩu**.
3. Bấm **Đăng nhập**. Lần đầu web bắt đổi mật khẩu: đặt mật khẩu mới chỉ mình bạn biết.
> Báo "Tài khoản … chưa được gắn với nhân sự nào": nhờ quản lý báo chị Hoa gắn tài khoản.

# Màn hình chính gồm những gì
![Màn hình chính sau khi đăng nhập](/daotao/bd-2-man-hinh.jpg)
1. **Menu bên trái**: các mục lớn (Công việc, Kinh doanh, Marketing, Kho – Sản xuất, Đào tạo…). Mỗi người chỉ thấy mục của phòng mình. Bấm mục có dấu › để mở các trang bên trong.
2. **Tab trên cùng**: các trang của mục đang mở.
3. **Ô thời gian**: chọn Hôm nay, 7 ngày qua, Tháng này… — số liệu trên trang đổi theo.
4. **Chuông**: thông báo việc mới, việc cần duyệt.
5. **Tên bạn**: bấm để mở mục **Của tôi**.

# Mục Của tôi
![Bấm vào tên bạn ở góc trên](/daotao/bd-3-cua-toi.jpg)
1. Gồm: **Nghỉ phép, OT, tạm ứng** · **KPI của tôi** · **Cài đặt thông báo** (bấm Bật thông báo để nhận tin trên máy) · **Đổi mật khẩu** · **Đăng xuất** (máy dùng chung nhớ đăng xuất).

# Luồng xin nghỉ phép
=> Nhân viên | Gửi đơn trên web | Của tôi › Nghỉ phép, OT, tạm ứng
=> Quản lý | Duyệt hoặc từ chối | Nhân sự › Đơn từ
=> HCNS | Cập nhật bảng công, phép năm | Nhân sự › Chấm công
=> Nhân viên | Thấy trạng thái đơn đổi | Đơn của tôi

![Trang Nghỉ phép, OT, tạm ứng](/daotao/bd-4-nghi-phep.jpg)
1. Chọn **Loại đơn** (nghỉ phép năm, OT, tạm ứng…).
2. Chọn **Từ ngày**, **Đến ngày**.
3. Ghi **Lý do**.
4. Bấm **Gửi đơn**.
5. Bảng **Đơn của tôi**: xem đơn đã duyệt chưa.
> Nghỉ 1 ngày báo trước ít nhất 1 ngày làm việc; chỉ nghỉ khi đơn đã được duyệt (xem Nội quy).', version = version + 1, updated_at = '2026-11-02T08:00:00.000Z', updated_by = 'he-thong-v2' WHERE id = 'dt-web-bat-dau' AND updated_by = 'he-thong';
UPDATE dt_doc SET title = 'Công việc: luồng giao việc – nhận việc – báo xong', summary = 'Trang Việc là nơi nhận, làm và báo cáo mọi việc được giao', body = '# Luồng một việc
=> Quản lý | Giao việc: tên, người làm, hạn | Công việc › + Giao việc
=> Người làm | Bấm Đã nhận việc | Việc › Của tôi
=> Người làm | Làm, tích việc nhỏ, dán link kết quả | Mở việc
=> Người làm | Chuyển Chờ duyệt / Hoàn thành | Trạng thái
=> Quản lý | Duyệt hoàn thành hoặc Trả lại | Mở việc

> Không kịp hạn: mở việc bấm **Gửi quản lý** để xin dời hạn, ghi lý do. Đừng để việc quá hạn mà im lặng — web tự báo đỏ cho quản lý và chị Hoa.

# Trang Việc
Menu trái → **Công việc**. Mở web lên là vào thẳng trang này.
![Trang Việc](/daotao/cv-1-viec.jpg)
1. **Của tôi** = việc giao cho bạn · **Tôi giao** = việc bạn giao người khác · **Cả team**.
2. Đổi cách xem: **Danh sách**, **Bảng**, **Lịch**, **Gantt**.
3. **+ Giao việc**: tạo việc mới.
4. **Mở**: xem chi tiết, đổi trạng thái, báo xong.

# Giao việc / cập nhật việc
![Cửa sổ Giao việc](/daotao/cv-2-giao-viec.jpg)
1. **Tên việc** ngắn gọn, rõ việc gì. Ghi **Mô tả** nếu cần.
2. Chọn **Người làm** và **Hạn**.
3. **Trạng thái**: bấm để đổi — Cần làm → Đã nhận việc → Đang làm → Chờ duyệt → Hoàn thành.
4. **Việc nhỏ cần tích**: chia việc thành các bước nhỏ, làm xong bước nào tích bước đó.
> Nhân viên chỉ tạo việc cho chính mình; muốn giao cho người khác thì nhờ quản lý giao.', version = version + 1, updated_at = '2026-11-02T08:00:00.000Z', updated_by = 'he-thong-v2' WHERE id = 'dt-web-cong-viec' AND updated_by = 'he-thong';
UPDATE dt_doc SET title = 'Đào tạo: đọc tài liệu và xác nhận đã hiểu', summary = 'Lộ trình nhân viên mới, đọc tài liệu, kiểm tra, hỏi người soạn', body = '# Luồng đào tạo nhân viên mới
=> HCNS / Quản lý | Ghi nhân viên mới, người kèm | Đào tạo › Theo dõi nhân viên mới
=> Nhân viên mới | Đọc tài liệu Ngày 1 → Tuần 1 → Tháng 1 | Đào tạo của tôi
=> Nhân viên mới | Làm kiểm tra, bấm Tôi đã đọc và hiểu | Cuối mỗi tài liệu
=> Quản lý | Xem ai đọc đủ, ai trễ, nhắc | Theo dõi nhân viên mới

# Đào tạo của tôi
Menu trái → **Đào tạo** → **Đào tạo của tôi**. Số đỏ trên menu = số tài liệu bắt buộc bạn chưa đọc.
![Trang Đào tạo của tôi](/daotao/dt-1-cua-toi.jpg)
1. Lộ trình chia **Ngày 1 / Tuần 1 / Tháng 1** — đọc lần lượt.
2. Bấm vào tên tài liệu để mở (hiện cửa sổ đọc, đọc xong bấm ✕ để đóng). Ô tròn chuyển ✓ xanh khi đã xác nhận.
3. **Cần đọc**: tài liệu bắt buộc chưa xác nhận.

# Kiểm tra và xác nhận
![Cuối mỗi tài liệu](/daotao/dt-2-xac-nhan.jpg)
1. Trả lời câu **Kiểm tra nhanh** (đúng 80% là đạt), rồi bấm **Tôi đã đọc và hiểu**. Web ghi lại ngày giờ.
2. Chỗ nào chưa rõ: gõ vào **Hỏi người soạn** → **Gửi câu hỏi**. Câu trả lời hiện ngay dưới tài liệu đó.
> Tài liệu sửa sang bản mới thì web hiện "Có bản mới, đọc lại" — bạn đọc lại và xác nhận lần nữa.

# Dành cho người soạn tài liệu
- **Soạn tài liệu** → **＋ Tài liệu mới**. Chọn soạn **ngay trên web** hoặc **dán link file Google Docs** (web tự chép nội dung và tự cập nhật khi file được sửa).
- Chọn team được xem, bắt buộc với ai, xếp vào Ngày 1 / Tuần 1 / Tháng 1, rồi **Đăng tài liệu**. Tài liệu Chung (nội quy, quy chế) phải chị Hoa duyệt mới hiện.
- Thư viện chỉ để tài liệu chuẩn đã duyệt; file làm việc hằng ngày để ở **Thư mục làm việc** của team.', version = version + 1, updated_at = '2026-11-02T08:00:00.000Z', updated_by = 'he-thong-v2' WHERE id = 'dt-web-dao-tao' AND updated_by = 'he-thong';
UPDATE dt_doc SET title = 'Kinh doanh › Kênh phân phối: luồng một đơn hàng', summary = 'Ai làm bước nào, bấm nút nào — từ lúc sale lên đơn đến khi tiền về', body = '# Luồng một đơn hàng đi từ đầu đến cuối
=> Sale | Tạo đơn, bấm Gửi duyệt | Kinh doanh › Đơn hàng
=> Quản lý / CEO | Duyệt đơn | Đơn hàng & duyệt
=> Kho | In phiếu, soạn hàng, Xác nhận đã xuất | Kho – Sản xuất › Xuất Kênh phân phối
=> Sale | Khách chuyển tiền: Tiền về + gửi bill | Mở lại đơn
=> Kế toán | Xác nhận tiền về, công nợ giảm | Quản trị › Phê duyệt

> Nhìn chấm màu dưới mã đơn để biết đơn đang ở bước nào: **Nháp** → **Chờ duyệt** → **Chờ xuất kho** → **Đã xuất kho** → **Đã ghi nợ** / đã thu đủ.

# Bước 1 · Sale tạo đơn
Menu trái → **Kinh doanh** → **Đơn hàng** → bấm **Tạo đơn hàng**.
![Màn hình Tạo đơn hàng (dữ liệu mẫu)](/daotao/kpp-1-tao-don.jpg)
1. Ô **Khách hàng**: gõ vài chữ tên khách rồi chọn trong danh sách hiện ra. Bên phải hiện cấp giá, công nợ, hạn mức của khách.
2. Ô **Gõ mã SKU hoặc tên sản phẩm**: gõ rồi bấm vào sản phẩm để thêm. Giá tự lấy theo cấp giá của khách.
3. Sửa **Số lượng** từng dòng. Có hàng tặng thì tích ô **Hàng tặng**.

Kéo xuống cuối trang, bấm **Lưu đơn**.
![Nút Lưu đơn ở cuối trang](/daotao/kpp-2-luu-don.jpg)

# Bước 2 · Sale bấm Gửi duyệt
Lưu xong, đơn mới chỉ là **Nháp** — quản lý chưa thấy. Phải bấm **Gửi duyệt**.
![Đơn vừa lưu đang ở trạng thái Nháp](/daotao/kpp-3-gui-duyet.jpg)
1. Bấm **Gửi duyệt**.
2. Chấm **Nháp** đổi thành **Chờ duyệt**.
> Hay quên nhất: lưu đơn xong mà không bấm Gửi duyệt, đơn nằm im ở Nháp, kho không bao giờ thấy.

# Bước 3 · Quản lý / CEO duyệt
Menu trái → **Kinh doanh** → **Đơn hàng & duyệt**. Đơn cần duyệt nằm ở bảng **Yêu cầu chờ duyệt** trên cùng.
![Bảng Yêu cầu chờ duyệt](/daotao/kpp-4-duyet.jpg)
1. Đọc cột **Lý do** (ví dụ: vượt hạn mức công nợ, giá sửa tay).
2. Bấm **Duyệt** → ghi chú nếu cần → **Xác nhận**. Không đồng ý thì bấm **Từ chối** và ghi lý do để sale sửa.
> Đơn vượt hạn mức công nợ phải CEO duyệt (cột Cấp duyệt ghi "CEO duyệt").

# Bước 4 · Kho xuất hàng
Menu trái → **Kho – Sản xuất** → **Xuất Kênh phân phối**. Đơn đã duyệt hiện ở bảng **Đơn NPP chờ xuất kho**.
![Đơn NPP chờ xuất kho](/daotao/kpp-5-kho-xuat.jpg)
1. Bảng đơn chờ xuất.
2. Bấm **In phiếu xuất kho** để soạn hàng theo phiếu.
3. Soạn xong bấm **Ghi thực xuất**.

![Cửa sổ Ghi thực xuất](/daotao/kpp-6-thuc-xuat.jpg)
1. Cột **Thực xuất**: web điền sẵn bằng số đặt; xuất thiếu thì sửa số.
2. Chọn **Ngày xuất kho**, ghi **Người xuất kho**.
3. Bấm **Xác nhận đã xuất**. Kho tự trừ tồn, đơn chuyển sang **Đã xuất kho**.

# Bước 5 · Khách trả tiền
Khách chuyển khoản: sale mở lại đơn (Kinh doanh › Đơn hàng › bấm mã đơn).
![Nút Tiền về + gửi bill trên đơn](/daotao/kpp-7-tien-ve.jpg)
1. Các chấm trạng thái: đơn đã duyệt chưa, đã xuất chưa, đã thu chưa, kế toán xác nhận chưa.
2. Bấm **Tiền về + gửi bill**, ghi số tiền và chụp ảnh bill gửi lên.

Kế toán xác nhận tiền về trong mục **Phê duyệt** của trang quản trị; công nợ của khách tự giảm.

# Khi có việc khác thường
- Đơn đã duyệt muốn sửa: mở đơn bấm **Sửa đơn** (gửi duyệt lại), không tạo đơn mới chồng lên.
- Khách trả lại hàng: **Hàng trả lại** → **+ Tạo phiếu trả hàng**.
- Hủy đơn: mở đơn bấm **Huỷ đơn**, ghi lý do.', version = version + 1, updated_at = '2026-11-02T08:00:00.000Z', updated_by = 'he-thong-v2' WHERE id = 'dt-web-kenh-phan-phoi' AND updated_by = 'he-thong';
UPDATE dt_doc SET title = 'Kho – Sản xuất: luồng nhập hàng, sản xuất, xuất hàng, hàng hoàn', summary = 'Dành cho kho, xưởng, kỹ thuật, kế toán kho', body = '# Đường đi của hàng
Menu trái → **Kho – Sản xuất**. Các nhóm trong menu xếp đúng theo đường đi của hàng:
=> Mua hàng | Lập đơn mua nguyên liệu | Mua nguyên liệu › Đơn mua hàng
=> Kho | Nhận hàng, lập phiếu nhập | Nhập kho › Nhập nguyên vật liệu
=> Xưởng | Sản xuất theo phiếu | Sản xuất › Phiếu sản xuất
=> Kế toán kho | Kiểm kê, in tem, nhập kho thành phẩm | Sản xuất › Kiểm kê đóng gói
=> Kho | Xuất hàng cho đơn | Thành phẩm & xuất › Xuất …

# 1 · Nhập nguyên vật liệu
![Trang Nhập nguyên vật liệu](/daotao/kho-1-nhap.jpg)
1. Bấm **+ Lập phiếu nhập**.
2. Các loại nhập: **Nhập nguyên vật liệu**, **Nhập thành phẩm**, **Hàng hoàn**.

![Phiếu nhập kho](/daotao/kho-2-phieu-nhap.jpg)
1. Chọn **Ngày**, **Thuộc phiếu mua** (hàng về theo đơn mua nào; không có thì web tự tạo), **Nhà cung cấp**.
2. Mỗi dòng: gõ mã hoặc tên hàng rồi chọn, ghi **Số lượng** thực nhận, **Đơn giá**.
3. Nhiều mặt hàng thì bấm **+ Thêm dòng**.
4. Bấm **Ghi phiếu**. Cần bản giấy cho người giao ký thì bấm **In bản điền tay**.
> Ghi theo số **thực nhận**, không ghi theo số đặt. Xem tồn ở **Nhập kho › Kho vật tư**: dòng đỏ là dưới mức tối thiểu hoặc tồn âm.

# 2 · Sản xuất
=> Điều phối | Tạo phiếu sản xuất | Phiếu sản xuất
=> Xưởng | Bắt đầu → Báo hoàn thành | Tiến độ xưởng
=> Kỹ thuật | Ghi nguyên liệu thực xuất | Pha chế
=> Kế toán kho | Kiểm kê → Phân bổ → In tem → Nhập kho | Kiểm kê đóng gói

![Trang Phiếu sản xuất](/daotao/kho-3-phieu-sx.jpg)
1. Các bước sản xuất theo thứ tự: **Phiếu sản xuất → Pha chế → Đóng gói → Kiểm kê, in tem**.
2. Người điều phối bấm **+ Tạo phiếu sản xuất**. Tổ xưởng mở phiếu bấm **Bắt đầu**, làm xong bấm **Báo hoàn thành** (ngày, số lượng, người làm).

![Kiểm kê đóng gói · Lô & Tem](/daotao/kho-4-kiem-ke.jpg)
1. Số lô đang ở mỗi bước: Chờ kiểm kê → Chờ phân bổ → Đã tạo tem, chờ in → Đã in, chờ nhập kho.
2. Lọc nhanh theo bước. Mỗi lô bấm lần lượt **Kiểm kê** (tổng đếm, đạt, lỗi, chờ xử lý) → **Phân bổ** → **In tem** → **Nhập kho**.
3. Hàng làm thêm ngoài phiếu: **+ Kiểm kê phát sinh**.

# 3 · Xuất hàng
- **Xuất Kênh phân phối**: xem trang sổ tay "Kênh phân phối: luồng một đơn hàng" (bước 4).
- **Xuất Kênh bán lẻ**: số bán sàn kéo từ Poscake — bấm **Kéo ngày này** hoặc **Kéo 3 ngày gần nhất**, xử lý các dòng ở **Cần xử lý**.
- **Xuất khác** (hàng mẫu, hủy hỏng, gia công…): **+ Lập phiếu xuất**.
- Không nhớ combo gồm gì: **Danh mục › Combo soạn hàng**, gõ mã trên phiếu (ví dụ 2TL).

# 4 · Hàng hoàn các sàn
=> Kho | Quét mã vận đơn từng gói | Hàng hoàn › Quét hàng hoàn
=> Kho | Gói lỗi / thiếu: bấm Báo lỗi | Ngay dòng gói đó
=> Kế toán kho | Cuối ngày lập phiếu nhập hoàn | Phiếu đã nhập

![Trang Hàng hoàn các sàn](/daotao/kho-5-hang-hoan.jpg)
1. Đặt con trỏ vào ô rồi quét mã vận đơn (nhớ tắt Unikey). Web tự nhận gói thuộc TikTok, Shopee hay Facebook.
2. Các tab: **Chưa tra ra đơn**, **Đối soát**, **Khiếu nại**, **Phiếu đã nhập**.
3. Số gói đã quét trong ngày theo từng sàn.', version = version + 1, updated_at = '2026-11-02T08:00:00.000Z', updated_by = 'he-thong-v2' WHERE id = 'dt-web-kho-san-xuat' AND updated_by = 'he-thong';
UPDATE dt_doc SET title = 'Marketing: luồng làm video, đăng bài, order từ Ads', summary = 'Dành cho team Content & Media, Digital, KOC', body = '# Luồng một video
=> Trưởng nhóm | Lên kế hoạch tháng | Content › Kế hoạch tháng
=> Trưởng nhóm | Giao việc, xếp buổi quay | Điều phối sản xuất
=> Content | Viết kịch bản → quay → edit | Việc › Của tôi
=> Người duyệt / CEO | Duyệt kịch bản, duyệt video | Điều phối sản xuất
=> Content | Đăng, lưu link / ID | Kho lưu trữ video

![Điều phối sản xuất video](/daotao/mkt-1-dieu-phoi.jpg)
1. Số thẻ video ở từng bước (Chưa giao, Viết kịch bản, Duyệt kịch bản, Chờ quay, Đang edit, Duyệt video, CEO duyệt, Chờ đăng, Đã đăng). Bấm vào một ô để lọc.
2. Xem **Theo bước** hoặc **Theo tuyến** nội dung.
3. Tích chọn thẻ → chọn **Giao cho…** → bấm **Giao việc**.
4. **Lịch quay**: bấm **+ Tạo buổi quay** để xếp lịch quay.

# Luồng một bài Fanpage
=> Content | Tạo bài, Gửi duyệt | Lịch đăng Fanpage › + Tạo bài
=> Người duyệt | Duyệt & lên lịch | Lịch đăng Fanpage
=> Web / người đăng | Đăng đúng giờ, Đánh dấu đã đăng | Lịch đăng Fanpage

![Lịch đăng Fanpage](/daotao/mkt-2-lich-dang.jpg)
1. Xem lịch theo **Tuần** hoặc **Tháng**.
2. **+ Tạo bài**: viết nội dung, chọn giờ, rồi **Lưu nháp** hoặc **Gửi duyệt**.
3. **DỪNG KHẨN**: dừng ngay mọi bài đăng tự động khi có sự cố.

# Luồng order video từ Ads
=> Digital | Gửi order: sản phẩm, số video, deadline, brief | Digital Marketing › Order cho Content
=> Content | Nhận order, làm video | Content › Order từ Ads
=> Content | Bàn giao công việc | Order từ Ads
=> Digital | Đưa video vào chạy thử | Thư viện video ads

![Order cho Content](/daotao/mkt-3-order.jpg)
1. Bảng các order đã gửi: ngày, người order, kênh chạy, sản phẩm, mục đích, số video. Vạch đỏ bên trái là order trễ hạn.
2. **Gửi order mới**: chọn sản phẩm, kênh chạy, số video, deadline, ghi mục đích / brief rồi bấm **Gửi order**.

> Số liệu Ads hằng ngày xem ở **Digital Marketing › Báo cáo theo ngày**; chi Ads vượt ngưỡng so với doanh thu thực sẽ hiện ở **Cảnh báo và việc cần làm**.', version = version + 1, updated_at = '2026-11-02T08:00:00.000Z', updated_by = 'he-thong-v2' WHERE id = 'dt-web-marketing' AND updated_by = 'he-thong';
UPDATE dt_doc SET title = 'Dùng web trên điện thoại', summary = 'Thanh nút dưới đáy, nút + tạo đơn, cài web như một ứng dụng', body = '# Màn hình điện thoại
Mở Chrome (Android) hoặc Safari (iPhone), vào **vanhanh.ailla.vn**, đăng nhập như trên máy tính.
![Web trên điện thoại](/daotao/dd-1-dien-thoai.jpg)
1. **Thanh nút dưới đáy**: Trang chủ · Đơn hàng (hoặc Khách) · Kho (hoặc Việc) — hiện theo quyền của bạn.
2. Nút tròn **+**: tạo đơn nhanh.
3. **Menu**: mở đủ các mục như trên máy tính.

# Cài như một ứng dụng
1. Mở web trên điện thoại.
2. Android: bấm ⋮ góc trên → **Thêm vào màn hình chính**. iPhone: bấm nút Chia sẻ → **Thêm vào MH chính**.
3. Từ giờ bấm biểu tượng AILLA trên màn hình điện thoại là vào thẳng web.
> Nhận thông báo việc mới trên điện thoại: bấm tên bạn → **Cài đặt thông báo** → **Bật thông báo**.', version = version + 1, updated_at = '2026-11-02T08:00:00.000Z', updated_by = 'he-thong-v2' WHERE id = 'dt-web-dien-thoai' AND updated_by = 'he-thong';
