/* =====================================================================
   LUẬT TIỀN & CÔNG NỢ — MỘT CÁCH TÍNH cho mọi trang hai web (chuẩn hóa 27/10/2026). Hàm thuần, có test (tests/unit/tiencalc.test.ts).
   Máy chủ tính công nợ ở src/server/services/debts.ts (debtAging) + tienCongNo.ts; tiencn.js nạp số, cộng phần sổ trong ngăn tài chính và vẽ trang.

   ĐỊNH NGHĨA
   - Tiền thu đã xác nhận (kỳ): tiền khách Kênh phân phối / Kênh OEM kế toán đã xác nhận (theo ngày tiền về, trừ bút toán đảo;
       KHÔNG gồm "bù trừ cước khách trả hộ" vì tiền không về) + phiếu thu ở Sổ thu đã được chị Huệ xác nhận.
       Tiền sàn (TikTok, Shopee) và COD Facebook về tài khoản: CHƯA có trên web (kế toán chưa ghi chứng từ) → chưa cộng.
   - Tiền chi đã duyệt (kỳ): phiếu chi nhà cung cấp (cả cọc) + phiếu chi vận chuyển (trừ loại "khách trả hộ") + phiếu chi thưởng NPP đã chi
       + dòng tiền thật (TK 111/112) trong Sổ chi phí. Khoản từ 5 triệu "chờ CEO duyệt" VẪN tính là đã chi nếu phiếu đã lập (tiền đã ra), có ghi nhãn.
       Phiếu chi Thảo ghi còn chờ chị Huệ duyệt: chưa tính.
   - Dòng tiền thuần (kỳ): tiền thu đã xác nhận − tiền chi đã duyệt.
   - Số dư tính (từng tài khoản): số dư kế toán nhập gần nhất trước kỳ (mốc) + thu − chi từ sau ngày mốc tới hết kỳ.
   - Số dư thật: số kế toán nhập ở Tiền & lịch chi (mới nhất trong kỳ, từng tài khoản). Chênh lệch = số dư thật − số dư tính.
   - Tiền đang có: cộng số dư thật mới nhất của mọi tài khoản (ngân hàng, tiền mặt, ví sàn chưa rút).
   - Chi bình quân mỗi ngày: số nhập tay ở Tổng quan › Thiết lập nếu có; không thì tiền chi đã duyệt của tháng trước ÷ số ngày tháng trước.
   - Tiền đủ dùng (ngày): tiền đang có ÷ chi bình quân mỗi ngày.
   - Phải thu khách: cộng công nợ chính thức (kế toán đã xác nhận) của các khách còn nợ, tách Kênh phân phối / Kênh OEM.
       Khách trả thừa (nợ âm) để riêng, không trừ vào phải thu. Đơn chờ ghi nợ, tiền chờ xác nhận: chỉ hiện, không cộng.
   - Tuổi nợ: tiền khách trả trừ vào đơn cũ nhất trước, phần còn nợ nằm ở các đơn mới nhất; tuổi tính từ NGÀY ĐƠN (ngày phát sinh).
       Chưa có hạn nợ cho khách (chị Hoa chưa chốt số ngày được nợ) nên chưa có "quá hạn", chỉ có tuổi.
       "Nợ đầu kỳ" = phần nợ cũ nạp lúc bắt đầu dùng web, chưa biết ngày → xếp vào nợ trên 90 ngày.
   - DSO (số ngày thu tiền): phải thu ÷ doanh thu đơn đã xác nhận 90 ngày gần nhất × 90 (từng kênh và chung).
   - Phải trả nhà cung cấp: công nợ đầu kỳ + hóa đơn / chứng từ + phiếu mua chưa có chứng từ (theo giá đặt) − đã chi (cả cọc),
       tính sau ngày chốt đầu kỳ (cùng Mua hàng). Nhà cung cấp mình trả trước (âm) để riêng. Tuổi nợ: như khách, từ ngày chứng từ.
   - Khoản chi sắp đến hạn: phần còn phải trả từng phiếu mua, xếp theo hạn trả (công nợ N ngày; chuyển khoản sau nhận = trả ngay;
       chuyển khoản trước = ngày hẹn giao), 4 tuần tới + quá hạn. Chưa gồm lương, thuê, quảng cáo.
   - Đối chiếu khách / nhà cung cấp: nợ đầu + phát sinh − đã trả − hàng trả lại = nợ cuối; nợ cuối phải bằng số các trang đang hiện.
   ===================================================================== */
const TCN_KENH=[["B2B","Kênh phân phối"],["GIA_CONG","Kênh OEM"]];
const TCN_TUOI=[["b30","0–30 ngày"],["b60","31–60 ngày"],["b90","61–90 ngày"],["b90p","Trên 90 ngày"],["old","Nợ đầu kỳ (chưa rõ ngày)"]];
const TCN_DN=[
  ["Tiền thu đã xác nhận","Tiền khách Kênh phân phối / Kênh OEM kế toán đã xác nhận (theo ngày tiền về, trừ bút toán đảo; không gồm bù trừ cước khách trả hộ) + phiếu thu Sổ thu đã xác nhận. Tiền sàn, COD Facebook về tài khoản chưa có chứng từ trên web nên chưa cộng."],
  ["Tiền chi đã duyệt","Phiếu chi nhà cung cấp (cả cọc) + phiếu chi vận chuyển (trừ khách trả hộ) + phiếu chi thưởng NPP đã chi + dòng tiền thật (TK 111/112) trong Sổ chi phí. Khoản chờ CEO duyệt vẫn tính vì phiếu đã lập (tiền đã ra). Phiếu chờ kế toán duyệt chưa tính."],
  ["Dòng tiền thuần","Tiền thu đã xác nhận trừ tiền chi đã duyệt trong kỳ."],
  ["Số dư tính","Số dư kế toán nhập gần nhất trước kỳ + thu − chi từ sau ngày đó tới hết kỳ, từng tài khoản."],
  ["Số dư thật","Số kế toán nhập ở Tiền & lịch chi (mới nhất trong kỳ). Chênh lệch = số dư thật − số dư tính."],
  ["Tiền đủ dùng","Tiền đang có (số dư thật mới nhất mọi tài khoản) ÷ chi bình quân mỗi ngày (nhập tay ở Thiết lập, không thì tiền chi đã duyệt tháng trước ÷ số ngày)."],
  ["Phải thu khách","Công nợ chính thức (kế toán đã xác nhận) của các khách còn nợ, tách Kênh phân phối / Kênh OEM. Khách trả thừa để riêng. Đơn chờ ghi nợ, tiền chờ xác nhận chưa cộng."],
  ["Tuổi nợ","Tiền trả trừ vào đơn cũ nhất trước; tuổi tính từ ngày đơn (ngày phát sinh). Chưa có hạn nợ cho khách nên chưa tính quá hạn. Nợ đầu kỳ chưa rõ ngày xếp vào nợ lâu."],
  ["DSO","Phải thu ÷ doanh thu đơn đã xác nhận 90 ngày gần nhất × 90."],
  ["Phải trả nhà cung cấp","Đầu kỳ + hóa đơn + phiếu mua chưa có chứng từ (giá đặt) − đã chi (cả cọc), sau ngày chốt đầu kỳ (cùng Mua hàng). Nhà cung cấp mình trả trước để riêng."],
  ["Khoản chi sắp đến hạn","Phần còn phải trả từng phiếu mua theo hạn trả, 4 tuần tới + quá hạn. Chưa gồm lương, thuê, quảng cáo."]];
const tcnR=n=>Math.round(+n||0);
/* Số dư thật của một tài khoản tại ngày: dòng kế toán nhập mới nhất có ngày ≤ ngay (cùng ngày lấy dòng nhập sau). */
function tcnSoDu(balances,acct,ngay){let o=null;(balances||[]).forEach(b=>{if(b.acct!==acct||(ngay&&b.ngay>ngay))return;if(!o||b.ngay>o.ngay||(b.ngay===o.ngay&&String(b.id)>String(o.id)))o=b});return o}
/* Số dư tính của một tài khoản: mốc (số kế toán nhập trước kỳ) + chứng từ sau ngày mốc tới hết ngày to. docs: [{date,amount(+ vào, − ra)}]. */
function tcnSoDuTinh(moc,docs,to){const tu=moc?moc.ngay:"";let thu=0,chi=0;(docs||[]).forEach(d=>{if(d.date>tu&&d.date<=to){if(d.amount>0)thu+=d.amount;else chi-=d.amount}});
  return {dau:moc?+moc.tien||0:null,mocNgay:tu,thu,chi,tinh:moc?(+moc.tien||0)+thu-chi:null}}
/* Chi bình quân mỗi ngày (một luật cho mọi trang). */
function tcnChiNgay(nhapTay,chiThangTruoc,ym){if(+nhapTay>0)return {v:+nhapTay,src:"nhập tay ở Tổng quan › Thiết lập"};
  if(!(+chiThangTruoc>0)||!ym)return {v:0,src:""};const n=new Date(+ym.slice(0,4),+ym.slice(5,7),0).getDate();return {v:chiThangTruoc/n,src:`tiền chi đã duyệt tháng ${ym.slice(5,7)}/${ym.slice(0,4)} ÷ ${n} ngày`}}
/* Tiền đủ dùng: ngay = tiền đang có ÷ chi/ngày; ngay2 tính cả phải thu sắp về và phải trả nhà cung cấp. */
function tcnRunway(co,chiNgay,thu,tra){co=+co||0;return {co,ngay:chiNgay>0?Math.floor(co/chiNgay):null,ngay2:chiNgay>0?Math.floor((co+(+thu||0)-(+tra||0))/chiNgay):null}}
/* Tài khoản từ chữ ghi trên phiếu ("MB · 0123456789 · CTY"): khớp số tài khoản (giống máy chủ acctOf). */
function tcnAcctOf(text,accts,tk){const t=String(text||"").replace(/\s+/g,"");const a=t?(accts||[]).find(x=>x.account_no&&t.includes(x.account_no)):null;if(a)return a.id;
  if(/tiền mặt/i.test(text||"")||/^111/.test(String(tk||"")))return "TIEN_MAT";return ""}
/* Một dòng đối chiếu khách / nhà cung cấp: công thức khép kín và khớp số đang hiện. */
const tcnCuoi=r=>(+r.dau||0)+(+r.phat_sinh||0)-(+r.da_tra||0)-(+r.tra_lai||0);
const tcnKhop=r=>Math.abs(tcnCuoi(r)-(+r.cuoi||0))<1&&Math.abs((+r.cuoi||0)-(+r.hien||0))<1;
/* Tổng phải thu / phải trả: chỉ cộng số dương; số âm (trả thừa / trả trước) để riêng. */
function tcnTong(rows,k){let duong=0,am=0;(rows||[]).forEach(r=>{const v=+r[k]||0;if(v>0)duong+=v;else am-=v});return {duong,am,rong:duong-am}}
