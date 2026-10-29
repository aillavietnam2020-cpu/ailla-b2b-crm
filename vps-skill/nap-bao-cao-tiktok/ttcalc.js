/* =====================================================================
   BÁO CÁO TIKTOK SHOP: đọc file xuất từ TikTok và tính lãi lỗ tháng (chỉ hàm thuần, không đụng giao diện).
   Quy tắc theo skill ailla-baocao-quantri-tiktok (chị Hoa duyệt 24/10/2026):
   - Một đơn thuộc tháng nó được TẠO. Doanh thu = Tổng phụ trước giảm giá − Giảm giá của người bán.
   - Đơn hủy/hoàn: doanh thu 0, giá vốn 0, chỉ dùng tính tỷ lệ hủy/hoàn.
   - Phí sàn lấy số quyết toán (file income 01/tháng → hết ngày 09 tháng sau; chị Hoa chốt sổ sáng ngày 10), chia về dòng SKU theo tỷ trọng
     doanh thu trong đơn; đơn chưa quyết toán thì ước tính theo tỷ lệ phí bình quân. "Phí khác" hứng phần dư
     để tổng khớp cột "Tổng phí" của TikTok.
   - Quảng cáo GMV Max vào lãi lỗ theo KỲ CHI TIÊU (file Campaign overview) cộng VAT 10%. Số trừ ví trong
     file income chỉ để tham chiếu dòng tiền. Quảng cáo không chia về SKU.
   - File đơn chỉ đọc ở trình duyệt: ra khỏi đây chỉ còn số tiền, mã sản phẩm, trạng thái, ngày.
   ===================================================================== */
const TT_ADS_VAT=0.1;
const TT_FEE_GROUPS=[
 ["Hoa hồng sàn",["Phí hoa hồng của TikTok Shop"],"Hoa hồng TikTok Shop thu trên từng đơn"],
 ["Phí giao dịch",["Phí giao dịch"],"Phí xử lý thanh toán"],
 ["Phí dịch vụ sàn",["Phí dịch vụ Voucher Xtra","Phí xử lý đơn hàng","Phí dịch vụ SFP","Phí dịch vụ hoàn tiền thưởng","Phí dịch vụ Ưu đãi đặc biệt trên LIVE","Phí dịch vụ Chương trình EAMS","Phí dịch vụ Flash Sale","Phí dịch vụ SFR","Phí chương trình TikTok PayLater","Phí nguồn lực chiến dịch","Gói dịch vụ được quản lý (phí mỗi đơn hàng)"],"Voucher Xtra, phí xử lý đơn và các chương trình sàn"],
 ["Hoa hồng affiliate/KOC",["Hoa hồng liên kết","Hoa hồng liên kết Quảng cáo cửa hàng","Hoa hồng của đối tác liên kết","Hoa hồng quảng cáo cửa hàng của Đối tác liên kết","Tiền cọc hoa hồng liên kết","Hoàn hoa hồng liên kết"],"Hoa hồng trả cho nhà sáng tạo và đối tác liên kết"],
 ["Phí vận chuyển ròng",["Phí vận chuyển thực tế","Chiết khấu phí vận chuyển của nền tảng","Chi phí vận chuyển của khách hàng","Phí vận chuyển trả hàng thực tế","Phí vận chuyển của khách hàng được hoàn lại","Hoàn phí SFR","Trợ cấp giao hàng không thành công","Trợ giá vận chuyển"],"Phí ship thực tế trừ phần sàn trợ giá và khách trả"],
 ["Thuế sàn khấu trừ",["Thuế GTGT do TikTok Shop khấu trừ","Thuế TNCN do TikTok Shop khấu trừ","Gói dịch vụ được quản lý (thuế bán hàng)"],"Thuế GTGT và TNCN TikTok khấu trừ hộ"],
 ["Phí khác",[],"Phần chênh còn lại để khớp đúng cột Tổng phí của TikTok"]];
const TT_NG=TT_FEE_GROUPS.length;
/* 5 làn doanh thu (cột trong file Shop Analytics › Key metrics) */
const TT_LANES=[["vInh","Video inhouse","GMV nhờ video của tài khoản kết nối"],["vKoc","Video KOC","GMV đến từ video liên kết"],["the","Thẻ sản phẩm","GMV thẻ sản phẩm"],["lShop","LIVE người bán","GMV nhờ buổi LIVE của tài khoản kết nối"],["lKoc","LIVE KOC","GMV nhờ buổi LIVE của nhà sáng tạo"]];

/* ---------- Đọc số, ngày, CSV ---------- */
function ttNum(v){
  if(v==null||v==="")return 0;if(typeof v==="number")return Number.isFinite(v)?v:0;
  let s=String(v).replace(/[\t\s₫đ]/g,"").replace(/VND$/i,"");if(!s||s==="-"||s==="--")return 0;
  const pct=s.endsWith("%");if(pct)s=s.slice(0,-1);
  if(/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s))s=s.replace(/\./g,"").replace(",",".");
  else if(/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s))s=s.replace(/,/g,"");
  else s=s.replace(",",".");
  const n=Number(s);return Number.isFinite(n)?(pct?n/100:n):0;
}
/* Làm tròn kiểu ngân hàng (0,5 về số chẵn), giống Python. */
const ttRound=v=>{const f=Math.floor(v),d=v-f;if(Math.abs(d-0.5)<1e-9)return f%2===0?f:f+1;return Math.round(v)};
const ttP2=n=>String(n).padStart(2,"0");
/* Ngày về dạng yyyy-mm-dd. Nhận "30/09/2026 23:47:21", "2026/10/08", "2026-09-01 00:00:00", Date, số ngày kiểu Excel. */
function ttIsoDay(v){
  if(v==null||v==="")return "";
  if(v instanceof Date)return isNaN(v)?"":`${v.getFullYear()}-${ttP2(v.getMonth()+1)}-${ttP2(v.getDate())}`;
  if(typeof v==="number"){if(v<20000||v>80000)return "";const d=new Date(Math.round((v-25569)*864e5));return `${d.getUTCFullYear()}-${ttP2(d.getUTCMonth()+1)}-${ttP2(d.getUTCDate())}`}
  const s=String(v).trim();let m=s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);if(m)return `${m[1]}-${ttP2(m[2])}-${ttP2(m[3])}`;
  m=s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);if(m)return `${m[3]}-${ttP2(m[2])}-${ttP2(m[1])}`;
  return "";
}
const ttKyNext=ky=>{const [y,m]=ky.split("-").map(Number);return m===12?`${y+1}-01`:`${y}-${ttP2(m+1)}`};
const ttKyDays=ky=>{const [y,m]=ky.split("-").map(Number);return new Date(y,m,0).getDate()};
const ttCell=v=>v==null?"":String(v).replace(/\t/g,"").trim();
/* CSV của TikTok: có ngoặc kép, xuống dòng trong ô, mã đơn kèm dấu tab. Trả về mảng dòng. */
function ttCsv(text){
  const out=[];let row=[],f="",q=false,i=0;const n=text.length;if(text.charCodeAt(0)===0xfeff)i=1;
  for(;i<n;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++}else q=false}else f+=c;continue}
    if(c==='"')q=true;else if(c===","){row.push(f);f=""}else if(c==="\n"){row.push(f);out.push(row);row=[];f=""}else if(c!=="\r")f+=c}
  if(f!==""||row.length){row.push(f);out.push(row)}
  return out;
}
/* Đọc mọi tab của file Excel thành mảng dòng. File TikTok hay ghi sai kích thước bảng (chỉ khai 2 dòng),
   nên đo lại vùng có dữ liệu từ chính các ô trước khi đọc. */
function ttSheets(X,wb){
  const out={};wb.SheetNames.forEach(n=>{const ws=wb.Sheets[n];let r1=0,c1=0;
    for(const k in ws){if(k[0]==="!")continue;const a=X.utils.decode_cell(k);if(a.r>r1)r1=a.r;if(a.c>c1)c1=a.c}
    ws["!ref"]=X.utils.encode_range({s:{r:0,c:0},e:{r:r1,c:c1}});
    out[n]=X.utils.sheet_to_json(ws,{header:1,raw:true,defval:null})});
  return out;
}
/* Tìm dòng tiêu đề có đủ các cột cần; trả về {h: dòng tiêu đề, at: vị trí, ix: tên → cột}. */
function ttHead(aoa,need,maxScan=12){
  for(let r=0;r<Math.min(aoa.length,maxScan);r++){const h=(aoa[r]||[]).map(ttCell);if(need.every(k=>h.includes(k))){const ix={};h.forEach((k,i)=>{if(k&&!(k in ix))ix[k]=i});return {h,at:r,ix}}}
  return null;
}
const ttRangeOfName=name=>{const m=String(name||"").match(/(20\d{6})\s*-\s*(20\d{6})/);if(!m)return null;const f=s=>`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;return {from:f(m[1]),to:f(m[2])}};
const ttRangeOfText=s=>{const d=String(s||"").match(/(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})\s*(?:~|-|–|đến)\s*(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})/);if(!d)return null;const a=ttIsoDay(d[1]),b=ttIsoDay(d[2]);return a&&b?{from:a,to:b}:null};

/* ---------- File đơn hàng OrderSKUList (CSV hoặc Excel) ---------- */
const TT_ORDER_COLS=["Order ID","Order Status","SKU ID","Seller SKU","Product Name","Variation","Quantity","Sku Quantity of return","SKU Subtotal Before Discount","SKU Seller Discount","Created Time"];
function ttReadOrders(aoa,ky){
  const H=ttHead(aoa,TT_ORDER_COLS);if(!H)return {err:"Không thấy các cột của file OrderSKUList (Order ID, SKU ID, Created Time…). Chị kiểm tra lại đúng file đơn hàng TikTok."};
  const I=H.ix,lines=[];let outside=0,before=0,after=0;
  for(let r=H.at+1;r<aoa.length;r++){const a=aoa[r];if(!a)continue;const o=ttCell(a[I["Order ID"]]);if(!/^\d{6,}$/.test(o))continue;
    const d=ttIsoDay(ttCell(a[I["Created Time"]]));if(!d)continue;
    if(ky&&d.slice(0,7)!==ky){outside++;if(d.slice(0,7)<ky)before++;else after++;continue}
    const q=ttNum(a[I["Quantity"]]),rq=ttNum(a[I["Sku Quantity of return"]]),st=ttCell(a[I["Order Status"]]);
    lines.push({o,d,huy:st==="Đã hủy"||rq>0,hoan:rq>0&&st!=="Đã hủy",sku:ttCell(a[I["SKU ID"]]),ss:ttCell(a[I["Seller SKU"]]),pn:ttCell(a[I["Product Name"]]),vr:ttCell(a[I["Variation"]]),q,dt:ttNum(a[I["SKU Subtotal Before Discount"]])-ttNum(a[I["SKU Seller Discount"]])})}
  if(!lines.length)return {err:ky?`File đơn không có đơn nào tạo trong tháng ${ky.slice(5)}/${ky.slice(0,4)}.`:"File đơn không có dòng nào đọc được."};
  return {lines,outside,before,after};
}

/* ---------- File quyết toán income ---------- */
function ttIncomeRange(sheets){
  const b=sheets["Báo cáo"]||[];for(const r of b){const cells=(r||[]).map(ttCell);const i=cells.indexOf("Khoảng thời gian");if(i>=0){const v=cells.slice(i+1).find(x=>x);const g=v&&ttRangeOfText(v);if(g)return g}}
  return null;
}
/* Kiểm tra kỳ: phải bắt đầu từ ngày 01 của tháng báo cáo (hoặc sớm hơn).
   Tới hết ngày 09 tháng sau = báo cáo đầy đủ (chốt sổ sáng ngày 10, chị Hoa 27/10). Tới sớm hơn = báo cáo GIỮA THÁNG (đến ngày X):
   vẫn tính được doanh thu thực, phí sàn đơn đã quyết toán, đơn chưa quyết toán dùng phí ước tính (chị Hoa duyệt 25/10). */
function ttCheckIncomeRange(g,ky){
  if(!g)return "Không đọc được dòng \"Khoảng thời gian\" ở tab Báo cáo của file income.";
  const start=ky+"-01",vn=s=>s.split("-").reverse().join("/");
  if(g.from>start)return `File income bắt đầu từ ${vn(g.from)}, phải từ ${vn(start)}. Chị xuất lại file từ ngày 01.`;
  if(g.to<start)return `File income chỉ tới ${vn(g.to)}, chưa vào tháng ${ky.slice(5)}/${ky.slice(0,4)}. Chị xuất lại file.`;
  return "";
}
const ttIncomePartial=(g,ky)=>!!g&&g.to<ttKyNext(ky)+"-09";
function ttReadIncome(sheets,ky){
  const range=ttIncomeRange(sheets),bad=ttCheckIncomeRange(range,ky);if(bad)return {err:bad,range};
  const partial=ttIncomePartial(range,ky);
  const aoa=sheets["Chi tiết đơn hàng"];const H=aoa&&ttHead(aoa,["ID đơn hàng/điều chỉnh","Loại giao dịch","Thời gian tạo đơn hàng","Thời gian quyết toán đơn hàng","Tổng phí"]);
  if(!H)return {err:"Không thấy tab \"Chi tiết đơn hàng\" đúng mẫu trong file income.",range};
  const I=H.ix,gcols=TT_FEE_GROUPS.map(g=>g[1].filter(c=>c in I).map(c=>I[c])),amt=I["Số tiền điều chỉnh"]!=null?I["Số tiền điều chỉnh"]:I["Tổng số tiền quyết toán"];
  const fees={};let adsVi=0,adj=0,cut=0,nOrd=0;
  for(let r=H.at+1;r<aoa.length;r++){const a=aoa[r];if(!a)continue;const typ=ttCell(a[I["Loại giao dịch"]]);if(!typ)continue;
    if(typ==="Đơn hàng"){const tao=ttIsoDay(ttCell(a[I["Thời gian tạo đơn hàng"]]));if(tao.slice(0,7)!==ky)continue;
      const id=ttCell(a[I["ID đơn hàng/điều chỉnh"]]),f=fees[id]||(fees[id]=new Array(TT_NG+1).fill(0));if(!f.n){f.n=1;nOrd++}
      let s=0;gcols.forEach((cs,g)=>{const v=cs.reduce((x,c)=>x+ttNum(a[c]),0);f[g]+=v;s+=v});const tot=ttNum(a[I["Tổng phí"]]);f[TT_NG-1]+=tot-s;f[TT_NG]+=tot;continue}
    const qt=ttIsoDay(ttCell(a[I["Thời gian quyết toán đơn hàng"]])),v=ttNum(a[amt]);
    if(qt.slice(0,7)!==ky){cut+=v;continue}
    if(typ==="GMV thanh toán cho Quảng cáo TikTok")adsVi+=v;else adj+=v}
  return {partial,range,fees,nOrd,adsVi,adj,cut};
}

/* ---------- Quảng cáo GMV Max theo kỳ chi tiêu (Campaign overview) ---------- */
function ttReadCampaign(aoa){
  const H=ttHead(aoa,["Theo ngày","Chi phí"]);if(!H)return {err:"Không thấy cột \"Theo ngày\" và \"Chi phí\" của file Campaign overview."};
  const I=H.ix,days={},cDon=Object.keys(I).find(k=>/^Số lượng đơn hàng/.test(k)),cGmv=Object.keys(I).find(k=>/^Doanh thu gộp/.test(k));
  for(let r=H.at+1;r<aoa.length;r++){const a=aoa[r];if(!a)continue;const d=ttIsoDay(a[I["Theo ngày"]]);if(!d)continue;
    days[d]={chi:ttNum(a[I["Chi phí"]]),don:cDon?ttNum(a[I[cDon]]):0,gmv:cGmv?ttNum(a[I[cGmv]]):0}}
  if(!Object.keys(days).length)return {err:"File Campaign overview không có dòng ngày nào."};
  return {days};
}

/* ---------- File hiệu suất cho team TikTok ---------- */
function ttReadKeyMetrics(aoa){
  const H=ttHead(aoa,["Ngày","GMV","Đơn hàng"],60);if(!H)return {err:"Không thấy bảng \"Dữ liệu theo ngày\" của file Key metrics (Shop Analytics)."};
  const I=H.ix,g=(a,k)=>k in I?ttNum(a[I[k]]):0,days={};
  for(let r=H.at+1;r<aoa.length;r++){const a=aoa[r];if(!a)continue;const d=ttIsoDay(ttCell(a[I["Ngày"]]));if(!d)continue;
    const o={gmv:g(a,"GMV"),don:g(a,"Đơn hàng"),khach:g(a,"Khách hàng"),mon:g(a,"Số món bán ra"),hoan:g(a,"Hoàn tiền"),dtTong:g(a,"Tổng doanh thu"),xem:g(a,"Lượt xem trang"),truyCap:g(a,"Khách truy cập"),hienThi:g(a,"Lượt hiển thị sản phẩm"),nhap:g(a,"Lượt nhấp vào sản phẩm")};
    TT_LANES.forEach(([k,,c])=>o[k]=g(a,c));days[d]=o}
  if(!Object.keys(days).length)return {err:"File Key metrics không có dòng ngày nào."};
  return {days};
}
function ttReadLive(aoa){
  const H=ttHead(aoa,["Thời gian","GMV đến từ buổi LIVE (₫)"]);if(!H)return {err:"Không thấy bảng của file Live Performance Core Stats."};
  const I=H.ix,g=(a,k)=>k in I?ttNum(a[I[k]]):0,days={};
  for(let r=H.at+1;r<aoa.length;r++){const a=aoa[r];if(!a)continue;const d=ttIsoDay(ttCell(a[I["Thời gian"]]));if(!d)continue;
    days[d]={gmv:g(a,"GMV đến từ buổi LIVE (₫)"),gmvLive:g(a,"GMV LIVE (₫)"),gmvGT:g(a,"GMV gián tiếp của LIVE (₫)"),gpm:g(a,"Hiển thị GPM (₫)"),phien:g(a,"Buổi LIVE"),phienGmv:g(a,"Số buổi LIVE tạo ra GMV."),mon:g(a,"Số món bán ra ghi nhận vào buổi LIVE"),don:g(a,"Đơn hàng SKU đã ghi nhận"),xem:g(a,"Lượt xem phiên LIVE"),tgXem:g(a,"Thời lượng xem trung bình (Buổi LIVE)"),ctr:g(a,"Tỷ lệ nhấp (LIVE)")}}
  if(!Object.keys(days).length)return {err:"File LIVE không có dòng ngày nào."};
  return {days,range:ttRangeOfText(ttCell((aoa[0]||[])[0]))};
}
/* Transaction Analysis (KOC): một dòng tổng của cả khoảng ngày (khoảng ngày lấy từ tên file). */
function ttReadKoc(aoa,name){
  const H=ttHead(aoa,["GMV nhờ nhà sáng tạo"]);if(!H)return {err:"Không thấy cột \"GMV nhờ nhà sáng tạo\" của file Transaction Analysis."};
  const range=ttRangeOfName(name);if(!range)return {err:"Tên file Transaction Analysis không có khoảng ngày (dạng 20260901-20260930). Chị giữ nguyên tên file TikTok đặt."};
  const row=aoa.slice(H.at+1).find(a=>a&&/\d/.test(ttCell(a[H.ix["GMV nhờ nhà sáng tạo"]]))&&ttCell(a[H.ix["GMV nhờ nhà sáng tạo"]]).length<40);if(!row)return {err:"File Transaction Analysis không có dòng số."};
  const m={};H.h.forEach((k,i)=>{if(k)m[k]=ttNum(row[i])});return {range,m};
}
/* Danh sách nhà sáng tạo: giữ 300 người GMV cao nhất. */
function ttReadCreators(aoa,name,keep=300){
  const H=ttHead(aoa,["Tên người dùng của nhà sáng tạo","GMV liên kết"]);if(!H)return {err:"Không thấy cột của file Creator List."};
  const range=ttRangeOfName(name);if(!range)return {err:"Tên file Creator List không có khoảng ngày (dạng 20260901-20260930). Chị giữ nguyên tên file TikTok đặt."};
  const I=H.ix,g=(a,k)=>k in I?ttNum(a[I[k]]):0,all=[];let nCo=0,gmv=0;
  for(let r=H.at+1;r<aoa.length;r++){const a=aoa[r];if(!a)continue;const u=ttCell(a[I["Tên người dùng của nhà sáng tạo"]]);if(!u)continue;
    const x={u,gmv:g(a,"GMV liên kết"),live:g(a,"GMV LIVE của liên kết"),video:g(a,"GMV video link bán hàng của liên kết"),the:g(a,"GMV thẻ sản phẩm của liên kết"),mon:g(a,"Số món bán ra"),don:g(a,"Đơn hàng liên kết"),hh:g(a,"Hoa hồng ước tính"),nVideo:g(a,"Video link bán hàng của liên kết"),nLive:g(a,"Buổi LIVE liên kết"),hoan:g(a,"GMV đã hoàn tiền từ liên kết"),fl:g(a,"Người theo dõi của liên kết")};
    if(x.gmv>0){nCo++;gmv+=x.gmv}all.push(x)}
  all.sort((a,b)=>b.gmv-a.gmv);
  return {range,n:all.length,nCo,gmv,top:all.slice(0,keep).filter(x=>x.gmv>0)};
}

/* ---------- Video (Phân tích LIVE & video › Video) ----------
   Hiệu suất: số theo ngày của video tài khoản kết nối (video inhouse). Chi tiết: từng video, dòng đầu file ghi "[Phạm vi ngày]: a ~ b".
   Chỉ giữ số và tên video (không có thông tin khách). */
function ttReadVideoDays(aoa){
  const H=ttHead(aoa,["Thời gian","GMV đến từ video (₫)","VV"]);if(!H)return {err:"Không thấy bảng của file Video › Hiệu suất."};
  const I=H.ix,g=(a,k)=>k in I?ttNum(a[I[k]]):0,days={};
  for(let r=H.at+1;r<aoa.length;r++){const a=aoa[r];if(!a)continue;const d=ttIsoDay(ttCell(a[I["Thời gian"]]));if(!d)continue;
    days[d]={gmv:g(a,"GMV đến từ video (₫)"),gmvVideo:g(a,"GMV video (₫)"),vv:g(a,"VV"),don:g(a,"Đơn hàng SKU đã ghi nhận"),hienThi:g(a,"Lượt hiển thị sản phẩm"),nhap:g(a,"Lượt nhấp vào sản phẩm")}}
  if(!Object.keys(days).length)return {err:"File Video › Hiệu suất không có dòng ngày nào."};
  return {days,range:ttRangeOfText(ttCell((aoa[0]||[])[0]))};
}
function ttReadVideoList(aoa,keep=50){
  const H=ttHead(aoa,["ID video","Thời gian","VV","GMV đến từ video (₫)"]);if(!H)return {err:"Không thấy cột của file Video › Chi tiết (ID video, VV, GMV)."};
  const range=ttRangeOfText(ttCell((aoa[0]||[])[0]));if(!range)return {err:"Dòng đầu file Video › Chi tiết không có khoảng ngày (\"[Phạm vi ngày]: … ~ …\")."};
  const I=H.ix,g=(a,k)=>k in I?ttNum(a[I[k]]):0,all=[];const S={n:0,nDang:0,nCoDon:0,nDangCoDon:0,gmv:0,gmvDang:0,vv:0,don:0};
  for(let r=H.at+1;r<aoa.length;r++){const a=aoa[r];if(!a)continue;const id=ttCell(a[I["ID video"]]);if(!id)continue;
    const post=ttIsoDay(ttCell(a[I["Thời gian"]])),dang=!!post&&post>=range.from&&post<=range.to;
    const x={id,t:ttCell(a[I["Thông tin video"]]).slice(0,80),post,vv:g(a,"VV"),don:g(a,"Đơn hàng SKU đã ghi nhận"),gmv:g(a,"GMV đến từ video (₫)"),sp:ttCell(a[I["Sản phẩm"]]).slice(0,60)};
    S.n++;S.gmv+=x.gmv;S.vv+=x.vv;S.don+=x.don;if(x.don>0)S.nCoDon++;if(dang){S.nDang++;S.gmvDang+=x.gmv;if(x.don>0)S.nDangCoDon++}all.push(x)}
  if(!S.n)return {err:"File Video › Chi tiết không có video nào."};
  all.sort((a,b)=>b.gmv-a.gmv);
  return {range,...S,top:all.slice(0,keep)};
}

/* ---------- Gom tháng: đơn + income + quảng cáo → số đã chia phí theo SKU (chưa có giá vốn) ---------- */
function ttBuildMonth({ky,orders,income,camp}){
  /* Báo cáo giữa tháng: số tính đến ngày đơn mới nhất trong file đơn (den); quảng cáo cũng cắt đến ngày đó. */
  const den=income.partial?orders.lines.reduce((m,l)=>l.d>m?l.d:m,""):null;
  const L=orders.lines,F=income.fees,ordDt={},ordQ={};
  L.forEach(l=>{ordDt[l.o]=(ordDt[l.o]||0)+l.dt;ordQ[l.o]=(ordQ[l.o]||0)+l.q});
  L.forEach(l=>{const w=ordDt[l.o]?l.dt/ordDt[l.o]:(ordQ[l.o]?l.q/ordQ[l.o]:0);l.w=w;l.qt=!!F[l.o]});
  const base=L.filter(l=>l.qt&&!l.huy),baseDt=base.reduce((s,l)=>s+l.dt,0);
  if(!baseDt)return {err:"Không ghép được đơn nào giữa file đơn và file income. Chị kiểm tra hai file có cùng tháng không."};
  const rate=new Array(TT_NG).fill(0);base.forEach(l=>{const f=F[l.o];for(let g=0;g<TT_NG;g++)rate[g]+=f[g]*l.w});for(let g=0;g<TT_NG;g++)rate[g]/=baseDt;
  const sku={},days={},okOrd=new Set(),dayOrd={};let hh=0,dtUoc=0,nUoc=0,mon=0;
  /* Làm tròn phí từng dòng (giống file Excel cũ) rồi mới cộng, để tổng khớp từng đồng. */
  L.forEach(l=>{const f=(l.qt?F[l.o].slice(0,TT_NG).map(v=>v*l.w):rate.map(r=>r*l.dt)).map(ttRound);
    const s=sku[l.sku]||(sku[l.sku]={ss:l.ss,pn:l.pn,vr:l.vr,q:0,dt:0,f:new Array(TT_NG).fill(0),dtU:0,hq:0,hdt:0});
    if(l.huy){s.hq+=l.q;s.hdt+=l.dt;hh+=l.dt;return}
    s.q+=l.q;s.dt+=l.dt;for(let g=0;g<TT_NG;g++)s.f[g]+=f[g];mon+=l.q;
    if(!l.qt){s.dtU+=l.dt;dtUoc+=l.dt;nUoc++}
    okOrd.add(l.o);const dd=days[l.d]||(days[l.d]={dt:0,phi:0,mon:0,don:0,hh:0});dd.dt+=l.dt;dd.phi+=f.reduce((a,b)=>a+b,0);dd.mon+=l.q;
    const k=l.d+"|"+l.o;if(!dayOrd[k]){dayOrd[k]=1;dd.don++}});
  let hoanGiao=0;L.forEach(l=>{if(l.huy&&l.hoan)hoanGiao+=l.dt});
  L.forEach(l=>{if(l.huy){const dd=days[l.d]||(days[l.d]={dt:0,phi:0,mon:0,don:0,hh:0});dd.hh+=l.dt}});
  Object.values(sku).forEach(s=>{s.dt=Math.round(s.dt);s.hdt=Math.round(s.hdt);s.dtU=Math.round(s.dtU)});
  Object.values(days).forEach(d=>{d.dt=Math.round(d.dt);d.phi=Math.round(d.phi);d.hh=Math.round(d.hh)});
  let chi=0,nAds=0;const adsDays={};Object.entries(camp.days).forEach(([d,v])=>{if(d.slice(0,7)!==ky||(den&&d>den))return;chi+=v.chi;nAds++;adsDays[d]=v});
  return {ky,den,sku,days,don:okOrd.size,mon,hh:Math.round(hh),hoanGiao:Math.round(hoanGiao),dtUoc:Math.round(dtUoc),nUoc,
    ads:{chi,vat:Math.round(chi*(1+TT_ADS_VAT)-1e-6),vi:-income.adsVi,nDays:nAds,days:adsDays},adj:income.adj,cut:income.cut,
    inc:{from:income.range.from,to:income.range.to,nOrd:income.nOrd},n:{lines:L.length,outside:orders.outside,before:orders.before,after:orders.after,unmatched:L.filter(l=>!l.qt).length}};
}

/* ---------- Lãi lỗ: thêm giá vốn + chi phí riêng của kênh vào số tháng ----------
   costOf(skuId, sellerSku) trả {u: giá vốn 1 đơn vị bán, src, note} hoặc null khi chưa có giá vốn / chưa quy đổi.
   Mã thiếu giá vốn: KHÔNG ước (chị Hoa duyệt 28/10/2026): giá vốn để 0, đánh dấu uoc = "chưa tính giá vốn", không xếp biên / đánh giá;
   tổng giá vốn chỉ gồm mã đã có giá, dtUocGv = doanh thu chưa tính giá vốn (lãi chưa trừ giá vốn phần này), đưa vào việc của kế toán. */
function ttPL(M,costOf,extra){
  extra=extra||[];const rows=Object.entries(M.sku).map(([id,s])=>{const c=costOf(id,s.ss)||null;const phi=s.f.reduce((a,b)=>a+b,0);return {id,...s,phi,c,gv:c&&c.u!=null?Math.round(c.u*s.q):null}});
  const gvRate=null;
  rows.forEach(r=>{r.uoc=r.gv==null;if(r.uoc)r.gv=0;r.lg=r.dt+r.phi-r.gv;r.bien=r.uoc||!r.dt?null:r.lg/r.dt});
  rows.sort((a,b)=>b.dt-a.dt);
  const S=k=>rows.reduce((a,r)=>a+r[k],0),dt=S("dt"),gv=S("gv"),phi=S("phi"),lg=dt+phi-gv;
  const fees=TT_FEE_GROUPS.map((g,i)=>[g[0],rows.reduce((a,r)=>a+r.f[i],0),g[2]]);
  const extraT=extra.reduce((a,x)=>a+x.v,0),lai=lg-M.ads.vat+M.adj-extraT,adsRate=dt?M.ads.vat/dt:0,ng2=adsRate+0.10;
  /* Sản phẩm: lãi gộp và biên chỉ tính trên các SKU đã có giá vốn (dtK, lgK); SKU chưa có giá vốn ghi riêng ở p.uoc. */
  const sp={};rows.forEach(r=>{const p=sp[r.pn]||(sp[r.pn]={n:r.pn,nsku:0,q:0,dt:0,gv:0,phi:0,uoc:0,dtK:0,lgK:0});p.nsku++;p.q+=r.q;p.dt+=r.dt;p.gv+=r.gv;p.phi+=r.phi;if(r.uoc)p.uoc+=r.dt;else{p.dtK+=r.dt;p.lgK+=r.lg}});
  const spL=Object.values(sp).map(p=>({...p,lg:p.lgK,bien:p.dtK?p.lgK/p.dtK:null})).sort((a,b)=>b.dt-a.dt);
  const danhGia=(lgv,b)=>b==null?"Chưa tính giá vốn":lgv<0?"Lỗ ngay khi chưa tính ads":b<ng2?"Biên mỏng, sát ngưỡng ads":"Gánh được ads";
  rows.forEach(r=>r.dg=r.dt||r.lg?danhGia(r.lg,r.bien):"");spL.forEach(p=>p.dg=p.dt||p.lg?danhGia(p.lg,p.bien):"");
  const g1=rows.filter(r=>!r.uoc&&r.lg<0),g2=rows.filter(r=>!r.uoc&&r.lg>=0&&r.dt>0&&r.bien<ng2),g3=rows.filter(r=>r.uoc&&(r.q>0||r.hq>0));
  const dtUocGv=g3.reduce((a,r)=>a+r.dt,0);
  const allDays=M.den?+M.den.slice(8,10):ttKyDays(M.ky),feeOther=Math.abs(fees[TT_NG-1][1]);
  const checks=[
   ["Kỳ file quyết toán (income)",`${M.inc.from.split("-").reverse().join("/")} → ${M.inc.to.split("-").reverse().join("/")}${M.den?" · báo cáo giữa tháng, số đến "+M.den.split("-").reverse().join("/"):""}`,M.den?"Giữa tháng (dự kiến): đơn chưa quyết toán dùng phí ước tính; chốt sổ sáng ngày 10, file tới hết ngày 09 tháng sau":"Từ 01 tháng này tới hết ngày 09 tháng sau",true],
   ["Đơn ngoài tháng trong file đơn",M.n.outside?`${M.n.outside} dòng, đã bỏ ra`:"Không có","Chỉ lấy đơn tạo trong tháng",true],
   ["Doanh thu dùng phí ước tính (đơn chưa quyết toán)",dt?M.dtUoc/dt:0,"Dưới 1% là chốt sổ được",dt?M.dtUoc/dt<0.01:true],
   ["Phí sàn khớp cột Tổng phí của TikTok",phi?feeOther/Math.abs(phi):0,"\"Phí khác\" (phần chênh) dưới 0,5% tổng phí",phi?feeOther/Math.abs(phi)<0.005:true],
   ["Doanh thu của mã chưa có giá vốn / chưa quy đổi",dt?dtUocGv/dt:0,"Phải về 0% trước khi dùng để quyết định",dtUocGv===0],
   ["Quảng cáo GMV Max đủ ngày trong tháng",`${M.ads.nDays}/${allDays} ngày`,M.den?"File Campaign overview đủ các ngày đến ngày báo cáo":"File Campaign overview đủ cả tháng",M.ads.nDays>=allDays]];
  return {ky:M.ky,dt,gv,phi,lgTruoc:dt-gv,lg,ads:M.ads.vat,adsChi:M.ads.chi,adsVi:M.ads.vi,adj:M.adj,extra,extraT,lai,adsRate,ng2,
    don:M.don,mon:M.mon,aov:M.don?dt/M.don:0,hh:M.hh,hhRate:dt+M.hh?M.hh/(dt+M.hh):0,fees,rows,sp:spL,g1,g2,g3,gvRate,dtUocGv,checks,
    nSku:rows.filter(r=>r.q>0).length,den:M.den||null,dtUoc:M.dtUoc||0,hoanGiao:M.hoanGiao!=null?M.hoanGiao:null,days:Object.fromEntries(Object.entries(M.days||{}).map(([d,x])=>[d,[x.dt,x.don]]))};
}
/* Tóm tắt một tháng để lưu và đưa lên Tổng quan (không có dòng SKU). */
const ttSummary=P=>({ky:P.ky,den:P.den||null,days:P.days||null,dt:P.dt,gv:P.gv,phi:P.phi,lg:P.lg,ads:P.ads,adsChi:P.adsChi,adsVi:P.adsVi,adj:P.adj,extraT:P.extraT,lai:P.lai,don:P.don,mon:P.mon,hh:P.hh,hhRate:P.hhRate,dtUoc:P.dtUoc,hoanGiao:P.hoanGiao,dtUocGv:P.dtUocGv,n1:P.g1.length,n2:P.g2.length,n3:P.g3.length,fees:P.fees.map(f=>[f[0],f[1]])});

/* ---------- Giá vốn từ dữ liệu sẵn có trên web ----------
   mapRows: bảng Quy đổi mã các sàn kênh TikTok [{sku, variant, from_day, item_label, qty}] (sku là SKU ID hoặc Seller SKU).
   skus: Giá vốn SKU [{ma, giaVon:{"yyyy-mm": giá}}] (lấy tháng gần nhất không sau tháng báo cáo).
   khoCost: giá bình quân theo phiếu nhập kho {mã: giá} (dùng khi Giá vốn SKU chưa có mã đó).
   isPack(mã): hộp, thùng đóng gói. Bao bì chưa có giá thì chưa cộng vào giá vốn (bảng giá vốn cũ cũng không có),
   nhưng vẫn đưa vào việc của kế toán. Hàng hoá thiếu giá thì cả SKU bị coi là thiếu giá vốn (không tính bằng 0). */
function ttMakeCostOf({ky,mapRows,skus,khoCost,isPack,alias}){
  const end=ky+"-"+ttP2(ttKyDays(ky)),low=s=>String(s||"").trim().toLowerCase(),gv={};
  /* Nhãn quy đổi chỉ ghi tên (vd "Phao lọc cặn"): đọc mã như trang Kho — tên đã gán (channel_alias) trước, rồi phần "MÃ" trước " - " (29/10/2026). */
  const al={};(alias||[]).forEach(a=>{if(a&&a.label&&a.item)al[low(a.label)]=String(a.item)});
  const codeOf=lab=>{const c=String(lab||"").trim();return al[low(c)]||c.split(" - ")[0].trim()};
  (skus||[]).forEach(s=>{const g=s.giaVon||{},ms=Object.keys(g).filter(m=>+g[m]>0).sort();if(!ms.length)return;const pick=ms.filter(m=>m<=ky).pop()||ms[0];gv[low(s.ma)]={u:+g[pick],src:"Giá vốn SKU "+pick.slice(5)+"/"+pick.slice(0,4)}});
  const kc={};Object.entries(khoCost||{}).forEach(([k,v])=>{if(+v>0)kc[low(k)]=+v});
  const by={};(mapRows||[]).forEach(r=>{(by[low(r.sku)]=by[low(r.sku)]||[]).push(r)});
  return (id,ss,vr)=>{
    let rows=by[low(id)]||(ss?by[low(ss)]:null);if(!rows)return {u:null,why:"Chưa quy đổi mã",parts:[]};
    const vv=rows.filter(r=>r.variant&&low(r.variant)===low(vr));rows=vv.length?vv:rows.filter(r=>!r.variant);
    rows=rows.filter(r=>!r.from_day||r.from_day<=end);if(!rows.length)return {u:null,why:"Chưa quy đổi mã",parts:[]};
    const fd=rows.reduce((m,r)=>(r.from_day||"")>m?(r.from_day||""):m,"");rows=rows.filter(r=>(r.from_day||"")===fd);
    let u=0;const parts=[],miss=[],pack=[];
    rows.forEach(r=>{const code=codeOf(r.item_label);if(!code||/^bỏ qua$/i.test(code))return;const q=+r.qty||0;
      const c=gv[low(code)]||(kc[low(code)]?{u:kc[low(code)],src:"Giá nhập kho bình quân"}:null);
      if(c){u+=c.u*q;parts.push({code,q,u:c.u,src:c.src})}else if(isPack&&isPack(code))pack.push(code);else miss.push(code)});
    if(miss.length)return {u:null,why:"Thiếu giá vốn: "+miss.join(", "),miss,pack,parts};
    if(!parts.length&&!pack.length)return {u:null,why:"Quy đổi chưa có mã hàng",parts};
    return {u,parts,pack,src:[...new Set(parts.map(p=>p.src))].join(", ")};
  };
}
/* Việc của kế toán: mã chưa quy đổi, mã hàng thiếu giá vốn, bao bì chưa có giá. */
function ttTodo(P){
  const noMap=[],code={},pack={};
  P.rows.forEach(r=>{const c=r.c||{};if(r.uoc&&(!c.miss||!c.miss.length))noMap.push(r);(c.miss||[]).forEach(k=>{const o=code[k]||(code[k]={code:k,n:0,dt:0});o.n++;o.dt+=r.dt});(c.pack||[]).forEach(k=>{const o=pack[k]||(pack[k]={code:k,n:0,dt:0});o.n++;o.dt+=r.dt})});
  const s=o=>Object.values(o).sort((a,b)=>b.dt-a.dt);
  return {noMap:noMap.filter(r=>r.q>0||r.hq>0),miss:s(code),pack:s(pack)};
}
/* Một ngày của team TikTok → dòng DAYD.tts dùng chung (Tổng quan, khối "trong kỳ đã chọn"):
   0 GMV · 1 đơn · 2 số món · 3 hoàn tiền · 4 khách · 5 LIVE người bán · 6 LIVE KOC · 7 video KOC · 8 video inhouse · 9 thẻ SP · 10 quảng cáo đã VAT */
function ttDaydRow(x){const k=x.km||{},a=x.ads||{};return [k.gmv||0,k.don||0,k.mon||0,k.hoan||0,k.khach||0,k.lShop||0,k.lKoc||0,k.vKoc||0,k.vInh||0,k.the||0,Math.round((a.chi||0)*(1+TT_ADS_VAT))]}
/* Tháng có nhiều đơn nhất trong file đơn (để tự chọn kỳ báo cáo). */
function ttGuessKy(aoa){const H=ttHead(aoa,["Created Time"]);if(!H)return "";const c={};for(let r=H.at+1;r<aoa.length;r++){const d=ttIsoDay(ttCell((aoa[r]||[])[H.ix["Created Time"]]));if(d){const k=d.slice(0,7);c[k]=(c[k]||0)+1}}const b=Object.entries(c).sort((a,x)=>x[1]-a[1])[0];return b?b[0]:""}
/* Nhận diện loại file TikTok theo cột bên trong (không dựa vào tên file). */
function ttKind(sheets){const first=sheets[Object.keys(sheets)[0]]||[];
  if(sheets["Chi tiết đơn hàng"])return "income";
  if(ttHead(first,["Order ID","SKU ID"]))return "orders";
  if(ttHead(first,["Theo ngày","Chi phí"]))return "camp";
  if(ttHead(first,["ID video","VV"]))return "videos";
  if(ttHead(first,["Thời gian","GMV đến từ video (₫)"]))return "vdays";
  if(ttHead(first,["Ngày","GMV","Đơn hàng"],60))return "km";
  if(ttHead(first,["Thời gian","GMV đến từ buổi LIVE (₫)"]))return "live";
  if(ttHead(first,["GMV nhờ nhà sáng tạo"]))return "koc";
  if(ttHead(first,["Tên người dùng của nhà sáng tạo","GMV liên kết"]))return "creators";
  return ""}
const TT_KIND_NAME={orders:"Đơn hàng (OrderSKUList)",income:"Quyết toán (income)",camp:"Quảng cáo GMV Max (Campaign overview)",km:"Tổng quan shop (Key metrics)",live:"LIVE (Live Performance)",koc:"KOC (Transaction Analysis)",creators:"Nhà sáng tạo (Creator List)",vdays:"Video › Hiệu suất (theo ngày)",videos:"Video › Chi tiết (từng video)"};
/* Gói / mở số tháng để lưu: nhóm cảnh báo lưu bằng mã SKU, không lặp cả dòng. */
const ttPackPL=P=>({...P,g1:P.g1.map(r=>r.id),g2:P.g2.map(r=>r.id),g3:P.g3.map(r=>r.id)});
const ttUnpackPL=P=>{const by={};P.rows.forEach(r=>by[r.id]=r);const g=a=>(a||[]).map(id=>by[id]).filter(Boolean);return {...P,g1:g(P.g1),g2:g(P.g2),g3:g(P.g3)}};
