# Đối chiếu báo cáo Ads tháng 11/2026: web ABOS ↔ Sheet "BÁO CÁO DIGITAL MKT 2026 FINAL"

Đọc ngày 09/11/2026 (chỉ đọc, không sửa gì). Số tháng 11 là **dự kiến, chưa chốt** (chốt sổ ngày 10 tháng sau).
Web: tính lại từ dữ liệu gốc `ads_fb` (Facebook + Pancake, cập nhật 09/11 08:08) bằng đúng quy tắc đọc tên chiến dịch của `hub/src/adsday.js` (`adfParse`, `ADF_ACC`), cho ngày 1–8/11 (ngày 9 mới chạy dở nên bỏ). Chưa mở trang thật để xem số hiển thị.
Sheet: tab "1. Báo cáo Tổng quan" và 3 tab Ads (sửa lần cuối 09/11 09:22).

## 1. Chi phí quảng cáo (1–8/11)
| Người | Sheet | Web (Facebook) | Chênh | % |
|---|---|---|---|---|
| Việt Anh | 52.048.266 | 49.472.247 | Sheet cao hơn 2.576.019 | +5,2% |
| Thảo | 49.788.768 | 51.709.731 | Sheet thấp hơn 1.920.963 | -3,7% |
| Duẩn | 34.382.866 | 34.341.315 | +41.551 | +0,1% |
| **Cộng 3 người** | **136.219.900** | **135.523.293** | +696.607 | +0,5% → **KHỚP** |
| Chưa rõ người (tài khoản "BI 3 PAGE", chiến dịch `MESS - … BI - ANH - MCS`) | không có | 10.733.627 | | **LỆCH** |
| **Tổng web** | | **146.256.920** | Sheet thấp hơn 10.037.020 | -6,9% |

So từng ngày: ngày 1–3 gần như trùng từng đồng (VA 6.659.547 / 6.589.919→web 6.605.552 / ...). Ngày 4–6 Sheet của Việt Anh cao hơn Facebook 0,45–0,65 triệu/ngày (nghi nhập tay/lấy lúc khác giờ). Chênh Thảo và Duẩn do ngày nhập chưa đủ (blob đọc Sheet lúc 08:00 mới có 5–6 ngày; Sheet có thể chưa đủ ngày 8).

## 2. Doanh số (1–8/11, theo đơn đặt, chưa trừ hủy/hoàn)
| Người | Sheet "mang về" | Web (Pancake, theo tên nguồn đơn) | Chênh |
|---|---|---|---|
| Việt Anh | 171.870.000 | 156.245.000 | Sheet cao hơn 15,6tr (+10%): sale nhập thêm doanh số inbox mà Pancake không gắn được người |
| Thảo | 122.224.000 | 120.156.000 | +1,7% |
| Duẩn | 61.796.000 | 61.329.000 | +0,8% |
| Cộng 3 người | 355.890.000 | 337.730.000 | +5,4% |
| Đơn không rõ người ("khác") | không có | 27.595.000 | |
| **Tổng Pancake** | | **365.325.000** (2.889 đơn, hủy 516) | Sheet thấp hơn 2,6% |

Số đơn: Sheet 2.310 so với Pancake 2.373 đơn chốt (trừ hủy): lệch 2,7%.
ROAS: Sheet 2,61 = 355,9 / 136,2. Web (Pancake/Facebook) ≈ 337,7 / 135,5 = 2,49 cho 3 người; tính cả phần chưa rõ người ≈ 365,3 / 146,3 = 2,50.

## 3. Kết luận
- **Khớp** về chi phí của 3 người (lệch 0,5%) và doanh số Thảo, Duẩn (lệch dưới 2%).
- **Lệch** ở 3 chỗ: (a) 10,7tr chi phí tài khoản "BI 3 PAGE" (chiến dịch MESS "BI - ANH") web có, Sheet không có, và web ghi "Chưa rõ người"; (b) doanh số Việt Anh Sheet cao hơn Pancake 15,6tr vì doanh số inbox nhập tay; (c) 27,6tr doanh số đơn không rõ người chỉ có ở web.
- Cả hai bên đều tính doanh số **theo đơn đặt**, chưa phải doanh thu thực giao thành công (đơn ngày 4–8/11 chưa giao nên chưa tính được). Cần chờ chốt ngày 10/12.
- Web đọc Sheet mỗi sáng 8h nên số "đọc từ Sheet" luôn chậm hơn Sheet 1 buổi; web chỉ dùng số Sheet khi Pancake chưa có.
- Nhãn cũ trong Sheet: tab `EXPORT_CP_ADS` còn ghi tháng 2026-08, `TONG_HOP_MA_HIENTAI` còn nhãn 08/2026, `TONG_HOP_MA` chưa gán sản phẩm cho tháng này (tỉ lệ khai báo 0%). Nên nhờ team Digital cập nhật.

## 4. Việc cần quyết
1. Tài khoản "BI 3 PAGE" (1056409566271847) là của ai? Nếu của Việt Anh thì thêm vào `ADF_ACC` trong `hub/src/adsday.js` (chưa sửa, chờ chị xác nhận).
2. Chưa phát hiện lỗi cộng trùng hay thiếu ngày trong code web.

## 5. Đã xử lý (09/11)
Chị Hoa xác nhận tài khoản "BI 3 PAGE" do Việt Anh và Duẩn cùng chạy, tên chiến dịch phân biệt người. Các chiến dịch tháng 11 dạng `MESS - … BI - ANH - …` gán cho Việt Anh (`adfParse` trong `hub/src/adsday.js`). Web: Việt Anh 1–8/11 ≈ 60,2tr (Sheet 52,0tr, thiếu ~8tr nghi do chưa nhập chiến dịch BI). Chiến dịch BI tháng 10 (`BITTN`) không ghi người, vẫn "chưa rõ người".

## 6. Page của Thảo (09/11)
Chị Hoa: page của Thảo là "AILLA VIỆT NAM" (111142935203280), khác "Ailla Việt Nam Store" (105017945992971, của Việt Anh). Đã thêm Thảo vào ADF_PAGE_OWNER và ADF_MESS (sản phẩm TLG, TLG125). Đơn page này 1-8/11 tổng 2,66tr, riêng TLG ~1,54tr; phần còn lại (xịt muỗi/ruồi, tẩy mốc...) chưa tính cho Thảo vì web chỉ cộng doanh số tin nhắn theo sản phẩm đang chạy.
