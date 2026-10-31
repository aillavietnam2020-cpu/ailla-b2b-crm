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
   - Số dư thật: số kế toán nhập ở Dòng tiền › Số dư tài khoản (mới nhất trong kỳ, từng tài khoản). Chênh lệch = số dư thật − số dư tính.
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
  ["Số dư thật","Số kế toán nhập ở Dòng tiền › Số dư tài khoản (mới nhất trong kỳ). Chênh lệch = số dư thật − số dư tính."],
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

/* =====================================================================
   DÒNG TIỀN (trang tien_lich, chị Hoa duyệt 31/10): lưu chuyển tiền tệ phương pháp trực tiếp + dự báo 4 tuần.
   Tiền ở đây = ngân hàng + tiền mặt (KHÔNG gồm ví sàn chưa rút: tiền ví rút về tài khoản mới là tiền vào).
   Dòng nào web chưa có chỗ ghi thì hiện "chưa có", không ước số (nguyên tắc chị Hoa: không ước lượng).
   ===================================================================== */
/* [mã, nhóm I KD / II DT / III TC, "thu"|"chi", tên dòng, lấy số ở đâu, web đã có chỗ ghi (1) hay chưa (0)] */
const TCN_LC=[
  ["kpp","KD","thu","Kênh phân phối: khách trả tiền","Tiền khách kế toán đã xác nhận, cùng nguồn Kho bill giao dịch (+ Sổ thu nguồn NPP)",1],
  ["oem","KD","thu","Kênh OEM: khách trả tiền","Tiền khách kế toán đã xác nhận, cùng nguồn Kho bill giao dịch (+ Sổ thu nguồn khách gia công)",1],
  ["tts","KD","thu","TikTok Shop: tiền rút về tài khoản","Chưa có chứng từ tách riêng sàn",0],
  ["spe","KD","thu","Shopee: tiền rút về tài khoản","Chưa có chứng từ tách riêng sàn",0],
  ["fbcod","KD","thu","Facebook: tiền COD về tài khoản","Chưa có chứng từ trên web",0],
  ["sanrut","KD","thu","Tiền sàn rút về (chưa tách theo sàn)","Sổ thu, nguồn \"Tiền sàn rút về\"",1],
  ["thukhac","KD","thu","Thu khác","Sổ thu (khách lẻ, nhà cung cấp hoàn tiền, thu khác)",1],
  ["ncc","KD","chi","Trả nhà cung cấp (nguyên liệu, bao bì)","Mua hàng › phiếu chi nhà cung cấp (cả cọc)",1],
  ["qc","KD","chi","Quảng cáo (nạp tiền)","Sổ chi phí G01–G03, dòng tiền thật",1],
  ["vc","KD","chi","Vận chuyển","Phiếu chi vận chuyển + Sổ chi phí G05, G09",1],
  ["luong","KD","chi","Lương, bảo hiểm","Sổ chi phí G07, G08, dòng tiền thật",1],
  ["thue","KD","chi","Thuế đã nộp","Sổ chi phí chưa có nhóm thuế riêng",0],
  ["khac","KD","chi","Chi vận hành khác","Sổ chi phí các nhóm còn lại, dòng tiền thật",1],
  ["hoan","KD","chi","Hoàn tiền khách, bút toán đảo","Tiền khách kế toán đã xác nhận (ghi âm)",1],
  ["thuong","KD","chi","Thưởng NPP đã chi","Phiếu chi thưởng NPP",1],
  ["mua_ts","DT","chi","Mua tài sản cố định, công cụ dụng cụ","Sổ chi phí G28 (Mua TSCĐ / CCDC)",1],
  ["thanh_ly","DT","thu","Thanh lý tài sản","Tài sản & CCDC › ghi giảm có thu tiền",1],
  ["vay","TC","thu","Vay ngân hàng, vay cá nhân","Chưa có chỗ ghi trên web",0],
  ["tra_vay","TC","chi","Trả nợ vay","Chưa có chỗ ghi trên web",0],
  ["von","TC","thu","Chủ sở hữu góp / rút vốn","Chưa có chỗ ghi trên web",0]];
/* Một chứng từ tiền (tiencn.js) thuộc dòng nào. */
function tcnLcKey(d){
  switch(d.loai){
    case "THU":return d.kenh==="GIA_CONG"?"oem":"kpp";
    case "HOAN":return "hoan";case "CHI_NCC":return "ncc";case "CHI_VC":return "vc";case "CHI_THUONG":return "thuong";case "TS_TL":return "thanh_ly";
    case "THU_SO":return d.nguon==="sanrut"?"sanrut":d.nguon==="gc"?"oem":d.nguon==="npp"?"kpp":"thukhac";
    case "CHI_SO":{const g=String(d.g||"");return /^G0[123]$/.test(g)?"qc":/^G0[59]$/.test(g)?"vc":/^G0[78]$/.test(g)?"luong":g==="G28"?"mua_ts":"khac"}}
  return d.amount>=0?"thukhac":"khac"}
/* Cộng chứng từ trong [from,to] theo dòng. Dòng web chưa có chỗ ghi để null (hiện "chưa có"). */
function tcnLctt(docs,from,to){
  const v={};TCN_LC.forEach(r=>v[r[0]]=r[5]?0:null);
  (docs||[]).forEach(d=>{if(d.date<from||d.date>to)return;const k=tcnLcKey(d);v[k]=(v[k]||0)+(+d.amount||0)});
  const g=(n,dir)=>TCN_LC.filter(r=>r[1]===n&&(!dir||r[2]===dir)).reduce((t,r)=>t+(v[r[0]]||0),0);
  const o={v,thu:g("KD","thu"),chiKd:g("KD","chi"),dt:g("DT"),tc:g("TC")};o.kd=o.thu+o.chiKd;o.net=o.kd+o.dt+o.tc;
  o.vao=TCN_LC.reduce((t,r)=>t+Math.max(0,v[r[0]]||0),0);o.ra=-TCN_LC.reduce((t,r)=>t+Math.min(0,v[r[0]]||0),0);return o}
/* Số dư thật cộng nhiều tài khoản tại một ngày. Thiếu tài khoản nào thì ghi vào thieu. */
function tcnSoDuCong(balances,accts,ngay){let t=0,co=0;const thieu=[];(accts||[]).forEach(a=>{const b=tcnSoDu(balances,a,ngay);if(b){t+=+b.tien||0;co++}else thieu.push(a)});return {tien:co?t:null,thieu,co}}
/* Bốn tuần tới tính từ ngày today: [{tu,den}] (khớp lịch trả nhà cung cấp: tuần = 7 ngày kể từ hôm nay). */
function tcnTuan(today){const o=[];for(let i=0;i<4;i++){const a=new Date(today+"T00:00:00Z");a.setUTCDate(a.getUTCDate()+i*7);const b=new Date(a);b.setUTCDate(b.getUTCDate()+6);o.push({tu:a.toISOString().slice(0,10),den:b.toISOString().slice(0,10)})}return o}
/* Ngân sách tháng chia theo ngày rồi cộng vào từng tuần. thang(ym) → số tiền tháng đó (0 nếu chưa đặt). */
function tcnChiaTuan(weeks,thang){return weeks.map(w=>{let t=0;for(let d=new Date(w.tu+"T00:00:00Z");d.toISOString().slice(0,10)<=w.den;d.setUTCDate(d.getUTCDate()+1)){const ym=d.toISOString().slice(0,7),n=new Date(Date.UTC(+ym.slice(0,4),+ym.slice(5,7),0)).getUTCDate();t+=(+thang(ym)||0)/n}return Math.round(t)})}
/* Tuần chứa ngày d (−1 nếu ngoài 4 tuần). */
const tcnTuanCua=(weeks,d)=>weeks.findIndex(w=>d>=w.tu&&d<=w.den);
/* Dự báo: tiền đầu tuần 1 = start; mỗi dòng thu/chi là mảng 4 số (null = chưa có, tính 0). min: mức tối thiểu cần giữ. */
function tcnDuBao(start,thu,chi,min){const open=[],close=[],ti=[0,0,0,0],ci=[0,0,0,0];let run=start==null?null:+start;
  for(let w=0;w<4;w++){(thu||[]).forEach(r=>{ti[w]+=+((r.v||[])[w])||0});(chi||[]).forEach(r=>{ci[w]+=+((r.v||[])[w])||0});
    open[w]=run;run=run==null?null:run+ti[w]-ci[w];close[w]=run}
  const st=close.map(v=>v==null||!(min>0)?"":v<min*0.9?"THIEU":v<min?"SAT":"DU");return {open,close,ti,ci,st}}
