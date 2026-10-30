---
name: nap-bao-cao-tiktok
description: Kéo báo cáo TikTok Shop (đơn hàng, quyết toán income, quảng cáo GMV Max, file team) và Shopee 2 shop (đơn, Doanh thu, quảng cáo) THẲNG VỀ VPS (không lưu xuống máy chị Hoa) và nạp số lãi lỗ tháng lên web ABOS. Sáng thứ Hai hằng tuần + 7h sáng ngày 10 chốt sổ. CHỈ agent Kế toán trưởng dùng.
---

# nap-bao-cao-tiktok — kéo báo cáo TikTok Shop và nạp lên web ABOS

Chị Hoa giao cho **Agent · Kế toán trưởng** (duyệt 25/10, sửa 28/10/2026). Agent khác không dùng; web cũng từ chối nếu agent chưa được tick phạm vi "Báo cáo sàn".

Cách đi chuột trên Seller Center (menu nào, nút nào, bẫy lịch) xem thêm skill **ailla-tai-bao-cao-tiktok** của chị. Riêng **chỗ lưu file thì làm theo skill này**: không lưu xuống máy chị, không cất ổ F.

## Lịch chạy (chị chốt 27/10)
- **Sáng thứ Hai 7h** — bản **giữa tháng (dự kiến)**:
  - Tháng đang chạy: đơn + quảng cáo từ 01 đến **Chủ nhật hôm qua**; income từ 01 đến Chủ nhật hôm qua.
  - Nếu hôm nay là ngày 01–09: làm thêm **tháng trước** (đơn + quảng cáo trọn tháng, income từ 01 tháng trước đến hôm qua). Tháng trước vẫn là bản giữa tháng tới ngày 10.
  - Thứ Hai đầu tháng mà tháng đang chạy mới được 0 ngày đủ (ví dụ thứ Hai 01) thì bỏ qua tháng đang chạy.
- **7h sáng ngày 10** — bản **đủ tháng để chốt sổ** của tháng trước: đơn trọn tháng (theo ngày tạo đơn), quảng cáo trọn tháng, **income từ 01 tháng trước đến hết ngày 09 tháng này** (lọc theo ngày quyết toán / ngày báo cáo). Không kéo income sang ngày 10.
- Chốt sổ (khoá) là việc của kế toán trên web, từ ngày 10. Agent **không khoá sổ**.

## Lấy file KHÔNG lưu xuống máy chị (bắt buộc)
Chrome máy chị đang bật "hỏi chỗ lưu", nếu bấm tải bình thường sẽ bật hộp **Save As** trên màn hình chị và kẹt. Luôn làm 3 bước:
1. Mở trang bằng `openclaw browser --browser-profile chrome open <url>` (ghi lại tab, ví dụ `t5`), đặt bộ lọc ngày.
2. **Gài bẫy tải** trước khi bấm: `bash bat-tai.sh t5`
3. Bấm nút tải bằng `openclaw browser --browser-profile chrome click <ref> --target-id t5`, rồi lấy file về VPS:
   `bash lay-file.sh t5 /root/bao-cao-san/<YYYY-MM>/<tên file>`
   Script đọc đường link file trang vừa tạo; link ký sẵn (quảng cáo) thì VPS tải thẳng, link cần đăng nhập (quyết toán, đơn) thì trang tự tải bằng phiên Chrome rồi chuyển từng phần về VPS (vài phút với file 10MB, cứ để chạy). Báo "Chưa bắt được link" thì gài bẫy lại rồi bấm lại. Không bao giờ bấm tải khi chưa gài bẫy.

Gợi ý URL:
- **Quảng cáo GMV Max**: `https://seller-vn.tiktok.com/ads-creation/dashboard?mpa=1&type=product&list_start_date=<ms>&list_end_date=<ms>` (ms = 00:00 giờ VN của ngày đầu / ngày cuối, ví dụ 01/10/2026 = 1790787600000, 25/10/2026 = 1792861200000). Nút tải là nút ngay sau ô ngày (biểu tượng ⬇).
- **Đơn hàng**: `https://seller-vn.tiktok.com/order` → Bộ lọc → *Thời gian đã tạo* → Áp dụng → **Xuất** → *Đơn hàng đã lọc* + **CSV** → đợi ở *Lịch sử xuất* → gài bẫy → **Tải xuống**.
- **Quyết toán (income)**: `https://seller-vn.tiktok.com/finance/bills` → tab Báo cáo → Xem theo đơn hàng → chọn ngày báo cáo → **Xuất** → popup "Chọn phạm vi ngày để xuất" **trống, phải bấm vào ô và chọn lại đúng 2 ngày rồi bấm OK** → **Xuất** → đợi 1–5 phút (Lịch sử xuất dữ liệu báo "Đã xuất") → gài bẫy → **Tải xuống**.

**File team (đo hiệu quả từng team, chị Hoa giao thêm 28/10) — kéo cùng lượt, cùng khoảng ngày, cùng cách gài bẫy:**
- **Key metrics** (video inhouse, KOC, live, thẻ SP theo ngày): `https://seller-vn.tiktok.com/compass/data-overview` → khối Số liệu chính → ô ngày → *Tùy chỉnh* → chọn ngày → biểu tượng ⬇ cạnh ô ngày.
- **Live Performance**: `https://seller-vn.tiktok.com/compass/live-analysis` → ô **"Tất cả tài khoản"** (góc phải khối Số liệu chính) → **BỎ tick "Tài khoản liên kết"**, chỉ giữ *Tài khoản chính thức* + *Tài khoản marketing* (chị Hoa chốt 30/10: file này là số của **team Live của shop**; để cả tài khoản liên kết thì cộng thêm ~800 buổi live của KOC, gần như không ra đơn, làm sai cảnh báo team Live. Live KOC đã nằm trong file KOC) → ô ngày → *Tùy chỉnh* → chọn ngày → **Xuất** → mở biểu tượng lịch sử xuất cạnh nút Xuất, tải dòng mới nhất. Kiểm: số buổi trong file phải cỡ 1 buổi/ngày; ra hàng trăm buổi là quên bỏ tài khoản liên kết, xuất lại.
- **Video › Hiệu suất**: `https://seller-vn.tiktok.com/compass/video-analytics` → ô ngày → *Tùy chỉnh* → biểu tượng ⬇.
- **Video › Chi tiết** (từng video inhouse): `https://seller-vn.tiktok.com/compass/video-analytics/video-details` → ô ngày góc trên phải → **Xuất** (bấm 2 lần như Live).
- **Transaction Analysis** và **Creator List** (KOC): `https://affiliate.tiktok.com/insights/transaction-analysis` — trang rất nặng, chụp màn hình hay bị treo; dùng `snapshot` để tìm nút. Không lấy được thì bỏ qua 2 file này và báo, không chờ mãi.

Tên file trên VPS (mỗi tháng một thư mục `/root/bao-cao-san/<YYYY-MM>/`):
`01_OrderSKUList_<từ>-<đến>.csv`, `02_income_<từ>-<đến>.xlsx`, `03_CampaignOverview_<từ>-<đến>.xlsx` (ngày dạng YYYYMMDD).
File team: `04_KeyMetrics_…xlsx`, `05_LivePerformance_…xlsx`, `06_VideoPerformance_…xlsx`, `07_VideoList_…xlsx`, `08_TransactionAnalysis_…xlsx`, `09_CreatorList_…xlsx`. Tên file KOC phải giữ khoảng ngày `YYYYMMDD-YYYYMMDD` (công cụ đọc khoảng ngày từ tên).

## Nạp lên web
Trong thư mục skill này:
1. Chạy thử, đọc số: `node nap-tiktok.mjs --as ke-toan-truong-ailla /root/bao-cao-san/<YYYY-MM>/* --ky YYYY-MM --thu` (đưa hết file vào một lệnh; công cụ tự nhận loại file; chỉ có file team cũng chạy được)
2. Kiểm: kỳ income in ra đúng khoảng đã chọn; số đơn hợp lý; doanh thu không lệch quá 30% so với tuần trước (cùng tháng). Lệch bất thường thì **dừng, báo chị Thảo**, không nạp.
3. Nạp thật: chạy lại không có `--thu`.
4. **Xoá thư mục file** sau khi nạp xong (file đơn có tên, số điện thoại, địa chỉ khách): `rm -rf /root/bao-cao-san/<YYYY-MM>`.
5. Nhắn chị Thảo 2–3 dòng: tháng nào, số đến ngày nào (hoặc "đủ tháng, chờ khoá sổ"), doanh thu thực, lãi kênh.

## Shopee (2 shop: aillavn1 thường, aillavn Mall) — cùng lịch, cùng lượt chạy (chị Hoa giao 28/10)
Làm SAU TikTok, cùng khoảng ngày (đơn + quảng cáo: 01 → ngày cuối; Doanh thu (Tài chính): 01 → ngày cuối, ngày chốt sổ thì tới hết ngày 09 tháng này).
**Shopee tạo file ngay trong trình duyệt (blob), nên dùng bộ gài bẫy riêng:** `bash bat-tai-blob.sh <tab>` trước mỗi lần bấm tải, rồi `bash lay-blob.sh <tab> <file>`. Không dùng bat-tai.sh / lay-file.sh của TikTok cho Shopee.
Thứ tự: shop **aillavn1** trước, rồi **aillavn (Mall)**. Chuyển shop: `https://banhang.shopee.vn/portal/shop` → bấm **Chi tiết** ở dòng shop cần (không đăng xuất).
Mỗi shop 3 file:
- **Đơn hàng**: `https://banhang.shopee.vn/portal/sale/order` → **Xuất** → chọn 2 ngày → **Xuất** → đợi ô *Báo cáo gần nhất* hết "Đang được xử lý" (1–2 phút) → gài bẫy → **Tải về**.
- **Quảng cáo**: `https://banhang.shopee.vn/portal/marketing/pas/wallet?tab=ads_credit_bill_label` → ô *Ngày giao dịch* chọn 2 ngày → gài bẫy → **Tải dữ liệu** (ra file CSV).
- **Doanh thu**: `https://banhang.shopee.vn/portal/finance/income?type=2&dateRange=<YYYYMMDD từ><YYYYMMDD đến>` (vd `dateRange=2026100120261025`) → **Xuất** → đợi *Báo cáo gần nhất* xong → gài bẫy → **Tải về** (file .zip, lay-blob.sh tự giải nén lấy file Income).

**Đi chậm như người (chị Hoa chốt 29/10 — bấm nhanh bằng lệnh là Shopee bật hộp kiểm tra chống máy):**
- Bấm bằng `snapshot` → `click <ref>` (chuột thật). **Không bấm nút Shopee bằng `evaluate`** (`.click()` trong JS).
- Đợi 3–5 giây sau mỗi lần mở trang / bấm. Mỗi shop chỉ chuyển một lần, làm xong cả 3 file rồi mới sang shop kia.
- Trước khi chuyển shop, đọc tên shop trên thanh trên cùng: đang đúng shop rồi thì **không** vào trang chọn shop.

**Hộp kiểm tra chống máy** (trang đổi sang `shopee.vn/verify/captcha` hoặc `verify/traffic`, chữ "Kéo qua để hoàn thiện bức hình" / "Xác nhận để tiếp tục"):
1. **Không tự kéo, không tải lại trang, không thử cách khác.** Chạy: `bash nhan-chi.sh "Chị ơi, em đang tải file <file> tháng <tháng> của Shopee <shop> thì Shopee hiện hộp kiểm tra kéo mảnh hình.
Chị mở Chrome, vào tab Shopee, kéo mảnh hình vào chỗ trống giúp em.
Chị kéo xong em tự làm tiếp, em chờ đến <giờ:phút>."`
2. Chạy `bash cho-chi.sh <tab> 10` và **đợi lệnh chạy xong** (nó tự kiểm mỗi phút). Chỉ chạy một lệnh chờ một lúc. In `MAT_TAB` thì chạy `openclaw browser --browser-profile chrome tabs`, dùng đúng tab Shopee đang mở (hoặc mở lại trang). In `HET_HOP` thì làm tiếp từ bước đang dở; in `VAN_CON_HOP` thì chạy lại, tổng cộng tối đa 3 lần.
3. Chờ tối đa **30 phút**, quá thì xử lý như thiếu mật khẩu ở dưới (giữ file đã có, báo shop nào chưa nạp).

**Tải bù file còn thiếu:** lượt trước thiếu file nào (vì mật khẩu / hộp kiểm tra) thì file đã tải vẫn nằm trong `/root/bao-cao-san/<YYYY-MM>/spe/`. Lượt sau (hoặc khi chị nhắn "kéo lại"):
- Cùng ngày cuối với file đã có → chỉ tải file còn thiếu, cùng khoảng ngày như tên file cũ.
- Lượt mới có ngày cuối mới hơn → tải lại cả 3 file của shop đó và xoá file cũ của shop đó.
- Chỉ nạp shop đủ 3 file. Nạp xong shop nào thì xoá file shop đó.

**Shopee đòi nhập mật khẩu ở trang Doanh thu (mỗi shop một lần)** — hộp "Để đảm bảo tài khoản của bạn luôn an toàn, vui lòng nhập mật khẩu":
1. **Không tự nhập mật khẩu, không bấm Hủy.** Chạy: `bash nhan-chi.sh "Chị ơi, em đang tải file Doanh thu tháng <tháng> của Shopee <shop> thì Shopee đòi nhập mật khẩu.
Chị mở Chrome, vào tab Kênh Người bán, nhập mật khẩu Shopee giúp em.
Chị nhập xong em tự làm tiếp, em chờ đến <giờ:phút>."` (tin đi Telegram và hiện trong khung chat Kế toán trưởng trên web).
2. Chạy `bash cho-chi.sh <tab> 10` và **đợi lệnh chạy xong**. Chỉ chạy một lệnh chờ một lúc. In `MAT_TAB` thì chạy `openclaw browser --browser-profile chrome tabs`, dùng đúng tab Shopee đang mở (hoặc mở lại trang). In `HET_HOP` thì làm tiếp; in `VAN_CON_HOP` thì chạy lại, tổng cộng tối đa 3 lần.
3. Chờ tối đa **30 phút**. Quá 30 phút: vẫn nạp TikTok bình thường, bỏ Doanh thu shop đó (KHÔNG nạp shop đó vì thiếu file), giữ file đơn + quảng cáo trong thư mục, nhắn `nhan-chi.sh "Chưa nhập mật khẩu Shopee nên em chưa nạp shop <shop>. Chị nhập xong nhắn em kéo lại."` và ghi vào báo cáo cuối.
Tên file: `/root/bao-cao-san/<YYYY-MM>/spe/01_DonHang_<shop>_…xlsx`, `02_DoanhThu_<shop>_…xlsx`, `03_QuangCao_<shop>_…csv`.
Nạp: `node nap-shopee.mjs --as ke-toan-truong-ailla /root/bao-cao-san/<YYYY-MM>/spe/* --thu` → đọc số từng shop → chạy lại không `--thu`. Công cụ tự ghép file theo shop. Web chặn bản cũ hơn / bản giữa tháng đè bản đủ tháng giống TikTok.

**Quan trọng khi chờ chị:** không được trả lời "em đang chờ, sẽ tự làm tiếp" rồi kết thúc lượt — kết thúc lượt là không còn ai chờ, chị nhập xong cũng không có gì chạy tiếp. Phải chờ bằng `cho-chi.sh` ngay trong lượt.

## Cách nhắn chị (chị Hoa chốt 29/10: rõ ràng, đủ câu, vào việc)
Viết câu đầy đủ, lễ phép, nhưng chỉ nói việc. Mỗi tin trả lời đủ 3 ý: **đang làm gì** (kênh/shop, file, tháng) → **kẹt ở đâu / kết quả** → **chị cần làm gì, hoặc em làm gì tiếp, lúc mấy giờ**.
Không kể đã đọc skill, không lặp lại tin vừa gửi, không gửi 2 tin cùng ý. Chị trả lời "làm lại đi" thì kiểm lại ngay; vẫn kẹt cùng lỗi thì nói rõ lỗi đó **không** do việc chị vừa làm và chỉ đúng việc cần làm (như mẫu mất kết nối ở trên).
- Kẹt: dùng đúng mẫu nhan-chi.sh ở các mục trên.
- Xong: "Chị ơi, em đã nạp Shopee <shop> tháng <tháng> (số đến ngày <ngày>) lên web: doanh thu thực <x> triệu, <n> đơn, lãi kênh <y> triệu." Mỗi shop / kênh một câu.
- Bỏ: "Shopee <shop> tháng <tháng> em chưa nạp vì <lý do>. Chị <việc cần làm> rồi nhắn em kéo lại."
Cả tin không quá 5 dòng.

## Chống trùng số (web đã chặn, agent không cần cộng dồn)
- Mỗi tháng TikTok **chỉ có một bản** trên web. Nạp lại thì **bản mới thay bản cũ**, không cộng thêm.
- Web từ chối: tháng đã khoá sổ; tháng đã có bản đủ tháng mà mình nạp bản giữa tháng; bản mới có số đến ngày **cũ hơn** bản đang có. Gặp từ chối thì báo chị Thảo, **không tìm cách khác**.
- Web chỉ lấy đơn **tạo trong tháng** báo cáo (đơn tháng khác trong file tự bỏ), income phải bắt đầu từ ngày 01.
- Mỗi lần chạy chỉ một phiên; đang chạy mà lịch khác tới thì bỏ lượt đó.

## Đánh thức Chrome trước khi làm (bước 0 mỗi lượt)
Máy chị bật lại thì tiện ích OpenClaw chỉ nối khi VPS hỏi Chrome lần đầu (biểu tượng con cua có dấu "!" đỏ tới lúc đó). Đầu lượt:
1. `openclaw browser --browser-profile chrome status`, chờ 45 giây, rồi `openclaw browser --browser-profile chrome tabs`.
2. Vẫn "No tabs" thì chờ thêm 60 giây, thử `tabs` lại 3 lần. Hết 3 lần mới coi là mất kết nối (mục Gặp trở ngại).

## Khi Chrome rớt nối giữa chừng (đường nối tự nối lại trong 1–5 phút)
Dấu hiệu: `tab not found` (id tab cũ như t4, t6 không còn), `Target page, context or browser has been closed`, `Execution context was destroyed`, `node invoke timed out`, `extension relay command timed out`, `connectOverCDP: Timeout`.
1. **Không bỏ việc, không nhắn chị ngay.** Chờ 60 giây rồi gọi `openclaw browser --browser-profile chrome tabs`. Thử tối đa 5 lần (khoảng 10 phút).
2. **Không dùng lại id tab cũ** sau khi rớt. Tìm lại tab theo đầu URL của bước đang làm (`seller-vn.tiktok.com/...`, `banhang.shopee.vn/...`) trong danh sách `tabs`; không còn thì `open` lại đúng URL của bước đó và đặt lại bộ lọc ngày. `cho-chi.sh` in `MAT_TAB` cũng xử lý y như vậy.
3. **Làm tiếp từ bước dở:** file nào đã nằm trong `/root/bao-cao-san/<YYYY-MM>/` (hoặc `spe/`) thì không tải lại; chỉ tải file còn thiếu. Gài bẫy lại (`bat-tai.sh` / `bat-tai-blob.sh`) trên tab mới trước khi bấm tải.
4. Mở lại trang Shopee mà gặp hộp mật khẩu / kéo hình / Điều khoản: làm theo đúng các mục Shopee ở trên (`nhan-chi.sh` + `cho-chi.sh`).
5. Sau 5 lần vẫn rớt mới nhắn chị theo mẫu mất kết nối ở dưới.

## Gặp trở ngại
- Bị đẩy về trang đăng nhập / đòi mã xác minh: **dừng, nhắn chị Hoa tự đăng nhập**. Không tự nhập mật khẩu.
- Chrome máy chị tắt hoặc tiện ích OpenClaw mất kết nối (đã làm bước đánh thức và 5 lần thử ở trên mà `tabs` vẫn báo "No tabs"): `bash nhan-chi.sh "Chị ơi, em đang <việc đang làm> thì mất kết nối tới Chrome máy chị. Lỗi này nằm ở đường nối, chị mở lại Shopee cũng không hết.
Chị nhắn Claude trên máy: \"nối lại OpenClaw Chrome cho agent\".
Nối xong em tự làm tiếp, em thử lại lúc <giờ:phút>."`, thử lại sau 30 phút, tối đa 3 lần.

## Cài lần đầu trên VPS
Trong thư mục này: `npm install` (thư viện đọc Excel `xlsx`). `ttcalc.js` là bản chép nguyên công thức của web; web đổi công thức thì chép lại từ `hub/src/ttcalc.js` (test trên web báo lệch nếu quên). Khoá agent: `/root/.config/abos/ke-toan-truong-ailla.key`, không in ra.
