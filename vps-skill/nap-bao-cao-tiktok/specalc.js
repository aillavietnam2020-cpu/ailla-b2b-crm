/* =====================================================================
   BÁO CÁO SHOPEE (2 shop): đọc file xuất từ Shopee và tính số tháng của từng shop (chỉ hàm thuần, không đụng giao diện).
   Quy tắc theo skill ailla-baocao-quantri-shopee (cùng cách với TikTok, chị Hoa chốt 25–27/10/2026):
   - Một đơn thuộc tháng nó được ĐẶT. Doanh thu = Giá gốc − Người bán trợ giá − Mã ưu đãi người bán chịu
     (mã ưu đãi là giảm trừ doanh thu, không phải phí sàn).
   - Đơn hủy, đơn hoàn (file đơn báo hủy/hoàn, hoặc file Tài chính có Giá sản phẩm + Số tiền hoàn lại = 0): doanh thu 0.
   - Phí sàn 7 nhóm lấy từ file Tài chính (Doanh thu), chia về dòng sản phẩm theo tỷ trọng doanh thu trong đơn;
     đơn chưa quyết toán dùng tỷ lệ phí bình quân. File Tài chính từ 01 tới trước hết ngày 09 tháng sau = báo cáo "đến ngày X" (chốt sổ sáng ngày 10).
   - Shopee Ads không có trong file Tài chính: lấy từ file Lịch sử giao dịch Dịch vụ Hiển thị (bỏ dòng nạp tiền).
   - File đơn chỉ đọc ở trình duyệt: ra khỏi đây chỉ còn số tiền, tên sản phẩm, ngày.
   Dùng chung hàm đọc số, ngày, CSV, tìm tiêu đề của ttcalc.js.
   ===================================================================== */
const SPE_FEE_GROUPS=[
 ["Hoa hồng cố định",["Phí cố định"],"Hoa hồng Shopee thu trên từng đơn"],
 ["Phí dịch vụ sàn",["Phí Dịch Vụ","Phí dịch vụ PiShip","Phí dịch vụ hiển thị NTTD (từ doanh thu đơn hàng)"],"Freeship Xtra, Voucher Xtra và các chương trình sàn"],
 ["Phí xử lý giao dịch",["Phí xử lý giao dịch"],"Phí xử lý thanh toán"],
 ["Hoa hồng affiliate",["Phí hoa hồng Tiếp thị liên kết"],"Hoa hồng Tiếp thị liên kết trả cho KOC/đối tác"],
 ["Phí vận chuyển ròng",["Phí vận chuyển Người mua trả","Phí vận chuyển thực tế","Phí vận chuyển được trợ giá từ Shopee","Phí vận chuyển trả hàng (đơn Trả hàng/hoàn tiền)","Phí vận chuyển được hoàn bởi PiShip","Phí vận chuyển trả hàng (đơn giao không thành công)"],"Phí ship thực tế trừ phần Shopee trợ giá và khách trả"],
 ["Thuế sàn khấu trừ",["Thuế GTGT","Thuế TNCN"],"Thuế GTGT và TNCN Shopee khấu trừ hộ"],
 ["Khoản khác",["Đền bù đơn mất hàng","Phí lắp đặt người mua trả","Phí lắp đặt thực tế","Trade-in Bonus by Seller","Sản phẩm được trợ giá từ Shopee"],"Đền bù, phí lắp đặt và các khoản lẻ"]];
const SPE_NG=SPE_FEE_GROUPS.length;
const SPE_VOUCHER=["Mã ưu đãi do Người Bán chịu","Mã ưu đãi Đồng Tài Trợ do Người Bán chịu","Mã hoàn xu do Người Bán chịu","Mã hoàn xu Đồng Tài Trợ do Người Bán chịu"];
const SPE_ORDER_COLS=["Mã đơn hàng","Ngày đặt hàng","Trạng Thái Đơn Hàng","Tên sản phẩm","Giá gốc","Người bán trợ giá","Số lượng"];
const speKey=(pn,vr)=>`${ttCell(pn)||"nan"}|||${ttCell(vr)||"nan"}`.replace(/\s+/g," ").trim();

/* Nhận diện loại file Shopee theo nội dung. sheets: {tên tab: mảng dòng} hoặc {csv: mảng dòng}. */
function speKind(sheets){
  if(sheets.csv){const t=(sheets.csv[0]||[]).map(ttCell).join(" ");return /Dịch vụ Hiển thị/i.test(t)?"ads":""}
  if(sheets["Doanh thu"]&&ttHead(sheets["Doanh thu"],["Đơn hàng / Sản phẩm","Mã đơn hàng"]))return "fin";
  for(const n in sheets)if(ttHead(sheets[n],SPE_ORDER_COLS,5))return "orders";
  return "";
}
const SPE_KIND_NAME={orders:"Đơn hàng",fin:"Tài chính (Doanh thu)",ads:"Quảng cáo (Dịch vụ Hiển thị)"};

/* ---------- File đơn hàng (Đơn hàng › Xuất) ---------- */
function speOrderSheet(sheets){for(const n in sheets)if(ttHead(sheets[n],SPE_ORDER_COLS,5))return sheets[n];return null}
function speReadOrders(aoa,ky){
  const H=ttHead(aoa,SPE_ORDER_COLS,5);if(!H)return {err:"Không thấy các cột của file đơn Shopee (Mã đơn hàng, Ngày đặt hàng, Giá gốc…)."};
  const I=H.ix,g=(a,k)=>k in I?a[I[k]]:null,lines=[];let outside=0;
  for(let r=H.at+1;r<aoa.length;r++){const a=aoa[r];if(!a)continue;const o=ttCell(g(a,"Mã đơn hàng"));if(!o)continue;
    const d=ttIsoDay(ttCell(g(a,"Ngày đặt hàng")));if(!d)continue;if(ky&&d.slice(0,7)!==ky){outside++;continue}
    const q=ttNum(g(a,"Số lượng")),rq=ttNum(g(a,"Số lượng sản phẩm được hoàn trả"));
    lines.push({o,d,huy:ttCell(g(a,"Trạng Thái Đơn Hàng"))==="Đã hủy"||rq>0,pn:ttCell(g(a,"Tên sản phẩm")),vr:ttCell(g(a,"Tên phân loại hàng")),
      sv:ttCell(g(a,"SKU phân loại hàng")),sp:ttCell(g(a,"SKU sản phẩm")),q,dt:ttNum(g(a,"Giá gốc"))-ttNum(g(a,"Người bán trợ giá"))})}
  if(!lines.length)return {err:ky?`File đơn không có đơn nào đặt trong tháng ${ky.slice(5)}/${ky.slice(0,4)}.`:"File đơn không có dòng nào đọc được."};
  return {lines,outside};
}
/* Tháng có nhiều dòng nhất trong file đơn. */
function speGuessKy(aoa){const H=ttHead(aoa,SPE_ORDER_COLS,5);if(!H)return "";const c={};for(let r=H.at+1;r<aoa.length;r++){const d=ttIsoDay(ttCell((aoa[r]||[])[H.ix["Ngày đặt hàng"]]));if(d){const k=d.slice(0,7);c[k]=(c[k]||0)+1}}const b=Object.entries(c).sort((a,x)=>x[1]-a[1])[0];return b?b[0]:""}

/* ---------- File Tài chính (Tài chính › Doanh thu › Xuất) ---------- */
function speFinMeta(sheets){
  let shop="",from="",to="";
  for(const n of Object.keys(sheets)){const A=sheets[n]||[];for(let r=0;r<Math.min(A.length,12);r++){const c=(A[r]||[]).map(ttCell);
    const i=c.indexOf("Người Bán");if(i>=0&&!shop&&c[i+1])shop=c[i+1];
    const f=c.indexOf("Từ"),t=c.indexOf("Đến");if(f>=0&&t>f&&!from){from=ttIsoDay(c[f+1]);to=ttIsoDay(c[t+1])}}
    if(shop&&from)break}
  return {shop,range:from&&to?{from,to}:null};
}
function speReadFin(sheets,ky){
  const meta=speFinMeta(sheets),g=meta.range,vn=s=>s.split("-").reverse().join("/");
  if(!g)return {err:"Không đọc được khoảng ngày (dòng Từ … Đến …) trong file Tài chính Shopee.",...meta};
  if(ky){const start=ky+"-01";
    if(g.from>start)return {err:`File Tài chính bắt đầu từ ${vn(g.from)}, phải từ ${vn(start)}. Chị xuất lại từ ngày 01.`,...meta};
    if(g.to<start)return {err:`File Tài chính chỉ tới ${vn(g.to)}, chưa vào tháng ${ky.slice(5)}/${ky.slice(0,4)}.`,...meta}}
  const aoa=sheets["Doanh thu"],H=aoa&&ttHead(aoa,["Đơn hàng / Sản phẩm","Mã đơn hàng","Giá sản phẩm","Số tiền hoàn lại"]);
  if(!H)return {err:"Không thấy tab \"Doanh thu\" đúng mẫu trong file Tài chính Shopee.",...meta};
  const I=H.ix,gc=SPE_FEE_GROUPS.map(x=>x[1].filter(c=>c in I).map(c=>I[c])),vc=SPE_VOUCHER.filter(c=>c in I).map(c=>I[c]),ac=I["Phí hoa hồng Tiếp thị liên kết"];
  const ord={};
  for(let r=H.at+1;r<aoa.length;r++){const a=aoa[r];if(!a||ttCell(a[I["Đơn hàng / Sản phẩm"]])!=="Order")continue;
    const id=ttCell(a[I["Mã đơn hàng"]]);if(!id)continue;
    const x=ord[id]||(ord[id]={d:ttIsoDay(ttCell(a[I["Ngày đặt hàng"]])),gross:0,hoan:0,vou:0,f:new Array(SPE_NG).fill(0),aff:false});
    x.gross+=ttNum(a[I["Giá sản phẩm"]]);x.hoan+=ttNum(a[I["Số tiền hoàn lại"]]);x.vou+=vc.reduce((s,c)=>s+ttNum(a[c]),0);
    gc.forEach((cs,k)=>{x.f[k]+=cs.reduce((s,c)=>s+ttNum(a[c]),0)});if(ac!=null&&ttNum(a[ac])!==0)x.aff=true}
  return {...meta,partial:!!ky&&g.to<ttKyNext(ky)+"-09",ord};
}

/* ---------- Quảng cáo Shopee (Lịch sử giao dịch Dịch vụ Hiển thị, CSV) ---------- */
function speReadAds(rows){
  let shop="",at=-1;
  for(let r=0;r<Math.min(rows.length,15);r++){const c=(rows[r]||[]).map(ttCell);if(c[0]==="Tên đăng nhập:")shop=c[1]||"";if(c.includes("Thời gian")&&c.includes("Số tiền")){at=r;break}}
  if(at<0)return {err:"Không thấy bảng (Thời gian, Mô tả, Số tiền) của file quảng cáo Shopee."};
  const h=rows[at].map(ttCell),iT=h.indexOf("Thời gian"),iM=h.indexOf("Mô tả"),iS=h.indexOf("Số tiền"),days={};let nap=0;
  for(let r=at+1;r<rows.length;r++){const a=rows[r];if(!a)continue;const d=ttIsoDay(ttCell(a[iT]));if(!d)continue;const v=ttNum(a[iS]),m=ttCell(a[iM]);
    if(/nạp/i.test(m)||v>0){nap+=v;continue}/* nạp ví là dòng tiền, không phải chi phí */
    days[d]=(days[d]||0)-v}
  return {shop,days,nap};
}

/* Giá vốn theo hàng xuất kho (chị Hoa chốt 29/10/2026): ghép đơn trong file Shopee với đơn Poscake đã xuất kho cùng mã đơn
   để biết mỗi sản phẩm/phân loại Shopee là mã Poscake nào (sku + phân loại), rồi quy đổi ra hàng kho như trang Kho.
   pos: [{o: mã đơn, sku, vr: phân loại}] (channel_order_lines). Trả {speKey: {sku, vr}} theo số đơn khớp nhiều nhất. */
function speLearnPos(lines,pos){
  const nz=s=>String(s||"").toLowerCase().replace(/[^\p{L}\p{N}]/gu,""),P={},E={},vote={};
  (pos||[]).forEach(p=>{if(!p||!p.o||!p.sku)return;const a=P[p.o]||(P[p.o]={});a[p.sku+"|"+(p.vr||"")]={sku:String(p.sku),vr:p.vr||""}});
  (lines||[]).forEach(l=>{if(!P[l.o])return;const a=E[l.o]||(E[l.o]={});a[speKey(l.pn,l.vr)]=l.vr});
  const add=(k,p)=>{const v=vote[k]||(vote[k]={}),id=p.sku+"|"+p.vr;(v[id]=v[id]||{p,n:0}).n++};
  Object.entries(E).forEach(([o,ex])=>{const ps=Object.values(P[o]),ks=Object.keys(ex);
    if(ks.length===1&&new Set(ps.map(p=>p.sku+"|"+p.vr)).size===1){add(ks[0],ps[0]);return}
    ks.forEach(k=>{const m=ps.filter(p=>nz(p.vr)&&nz(p.vr)===nz(ex[k]));if(new Set(m.map(p=>p.sku+"|"+p.vr)).size===1)add(k,m[0])})});
  const out={};Object.entries(vote).forEach(([k,v])=>{const b=Object.values(v).sort((a,c)=>c.n-a.n)[0];out[k]={sku:b.p.sku,vr:b.p.vr}});
  return out;
}

/* ---------- Gom tháng của MỘT shop ----------
   costOf(line) → {u: giá vốn 1 đơn vị bán, why} ; u = null khi chưa có giá vốn / chưa quy đổi.
   Trả: số tháng có dòng sản phẩm, số theo ngày [doanh thu, phí sàn (âm), giá vốn, lãi gộp, đơn, quảng cáo]. */
function speBuildMonth({ky,shop,orders,fin,ads,costOf,pos}){
  const L=orders.lines,F=fin.ord,den=fin.partial?L.reduce((m,l)=>l.d>m?l.d:m,""):null;
  /* Shopee là nguồn sự thật về hoàn tiền: tổng hàng hoá về 0 = hoàn toàn bộ. */
  const hoan=new Set(Object.keys(F).filter(id=>F[id].gross>0&&Math.abs(F[id].gross+F[id].hoan)<1));
  let lech=0;L.forEach(l=>{if(hoan.has(l.o)&&!l.huy){l.huy=true;lech++}});
  const ordDt={},ordQ={};L.forEach(l=>{ordDt[l.o]=(ordDt[l.o]||0)+l.dt;ordQ[l.o]=(ordQ[l.o]||0)+l.q});
  L.forEach(l=>{l.w=ordDt[l.o]?l.dt/ordDt[l.o]:(ordQ[l.o]?l.q/ordQ[l.o]:0);l.qt=!!F[l.o]});
  const base=L.filter(l=>l.qt&&!l.huy),baseDt=base.reduce((s,l)=>s+l.dt,0);
  if(!baseDt)return {err:`Shop ${shop||"?"}: không ghép được đơn nào giữa file đơn và file Tài chính. Chị kiểm tra hai file cùng shop, cùng tháng.`};
  const rate=new Array(SPE_NG).fill(0);let rateV=0;
  base.forEach(l=>{const x=F[l.o];for(let g=0;g<SPE_NG;g++)rate[g]+=x.f[g]*l.w;rateV+=x.vou*l.w});
  for(let g=0;g<SPE_NG;g++)rate[g]/=baseDt;rateV/=baseDt;
  const sku={},days={},dayOrd={},okOrd=new Set();let hh=0,dtUoc=0,mon=0,koc=0;
  L.forEach(l=>{
    if(l.huy){hh+=l.dt;return}
    const x=F[l.o],f=(l.qt?x.f.map(v=>v*l.w):rate.map(r=>r*l.dt)).map(ttRound),vou=ttRound(l.qt?x.vou*l.w:rateV*l.dt),dt=l.dt+vou;
    const k=speKey(l.pn,l.vr),s=sku[k]||(sku[k]={pn:l.pn,vr:l.vr,sv:l.sv,sp:l.sp,q:0,dt:0,vou:0,f:new Array(SPE_NG).fill(0),dtU:0});
    s.q+=l.q;s.dt+=dt;s.vou+=vou;for(let g=0;g<SPE_NG;g++)s.f[g]+=f[g];mon+=l.q;if(!l.qt){s.dtU+=dt;dtUoc+=dt}
    if(x&&x.aff)koc+=dt;okOrd.add(l.o);
    const dd=days[l.d]||(days[l.d]={dt:0,phi:0,gv:0,don:0,sk:{}});dd.dt+=dt;dd.phi+=f.reduce((a,b)=>a+b,0);dd.sk[k]=(dd.sk[k]||0)+l.q;
    if(!dayOrd[l.d+"|"+l.o]){dayOrd[l.d+"|"+l.o]=1;dd.don++}});
  /* Giá vốn: mã chưa có giá vốn KHÔNG ước (chị Hoa duyệt 28/10/2026): để 0, đánh dấu uoc = "chưa tính giá vốn"; dtUocGv = doanh thu chưa tính giá vốn. */
  const learn=pos?speLearnPos(L,pos):{};
  const rows=Object.entries(sku).map(([k,s])=>{if(learn[k])s.ps=learn[k];const c=(costOf&&costOf(s))||{u:null,why:"Chưa quy đổi mã"};return {k,...s,phi:s.f.reduce((a,b)=>a+b,0),c,u:c.u}});
  const gvRate=null;
  rows.forEach(r=>{r.uoc=r.u==null;r.gv=r.uoc?0:Math.round(r.u*r.q);r.dt=Math.round(r.dt);r.lg=r.dt+r.phi-r.gv});
  const byK={};rows.forEach(r=>byK[r.k]=r);
  Object.values(days).forEach(d=>{let gv=0;for(const k in d.sk){const r=byK[k];gv+=r.q?r.gv*d.sk[k]/r.q:0}d.gv=Math.round(gv);d.dt=Math.round(d.dt);d.phi=Math.round(d.phi);delete d.sk});
  const adsDays={};let adsT=0;Object.entries((ads&&ads.days)||{}).forEach(([d,v])=>{if(d.slice(0,7)!==ky||(den&&d>den))return;adsDays[d]=Math.round(v);adsT+=v});
  rows.sort((a,b)=>b.dt-a.dt);
  const S=k=>rows.reduce((a,r)=>a+r[k],0),dt=S("dt"),gv=S("gv"),phi=S("phi");
  return {ky,shop,den,dt,gv,phi,lg:dt+phi-gv,ads:Math.round(adsT),hasAds:!!ads,don:okOrd.size,mon,hh:Math.round(hh),koc:Math.round(koc),
    vou:Math.round(S("vou")),dtUoc:Math.round(dtUoc),dtUocGv:rows.filter(r=>r.uoc).reduce((a,r)=>a+r.dt,0),gvRate,lech,
    fees:SPE_FEE_GROUPS.map((g,i)=>[g[0],rows.reduce((a,r)=>a+r.f[i],0)]),rows,days,adsDays,
    inc:{...fin.range},n:{lines:L.length,outside:orders.outside,unmatched:L.filter(l=>!l.qt&&!l.huy).length}};
}
/* Tóm tắt để lưu: số theo ngày [doanh thu, phí sàn (âm), giá vốn, lãi gộp, đơn, quảng cáo]. */
function speSummary(M){
  const days={};const ks=new Set([...Object.keys(M.days),...Object.keys(M.adsDays)]);
  ks.forEach(d=>{const x=M.days[d]||{dt:0,phi:0,gv:0,don:0};days[d]=[x.dt,x.phi,x.gv,x.dt+x.phi-x.gv,x.don,M.adsDays[d]||0]});
  return {ky:M.ky,shop:M.shop,den:M.den,dt:M.dt,gv:M.gv,phi:M.phi,lg:M.lg,ads:M.ads,hasAds:M.hasAds,don:M.don,mon:M.mon,hh:M.hh,koc:M.koc,vou:M.vou,
    dtUoc:M.dtUoc,dtUocGv:M.dtUocGv,fees:M.fees,inc:M.inc,days};
}
/* Dòng sản phẩm gọn để lưu (không có mã đơn, không có thông tin khách). */
const speRowsPack=M=>M.rows.map(r=>({pn:r.pn,vr:r.vr,q:r.q,dt:r.dt,phi:r.phi,gv:r.gv,lg:r.lg,uoc:r.uoc,why:r.uoc?(r.c&&r.c.why)||"":""}));

/* Gộp các shop thành DAYD.spe: {ngày: [doanh thu, phí sàn (âm), giá vốn, lãi gộp, đơn]} (đúng dạng các trang đang đọc). */
function speDayd(sums){
  const out={};(sums||[]).forEach(s=>Object.entries(s.days||{}).forEach(([d,x])=>{const o=out[d]||(out[d]=[0,0,0,0,0]);for(let i=0;i<5;i++)o[i]+=+x[i]||0}));
  return out;
}
/* Khoảng ngày [from,to] (cắt tới hôm nay) đã có báo cáo của mọi shop chưa. shops: các shop phải có.
   Trả {den: ngày cuối mà mọi shop đều có số, miss: [{shop, from, to}] còn thiếu}. */
function speCoverage(sums,shops,from,to,today){
  const end=to<today?to:today,miss=[];let den=end;
  for(let ym=from.slice(0,7);ym<=end.slice(0,7);ym=ttKyNext(ym)){
    const a=ym+"-01"<from?from:ym+"-01",me=ym+"-"+ttP2(ttKyDays(ym)),b=me<end?me:end;
    shops.forEach(sh=>{const s=(sums||[]).find(x=>x.ky===ym&&x.shop===sh),cov=s?(s.den||me):"";
      if(!cov||cov<a){miss.push({shop:sh,from:a,to:b});if(speDayBefore(a)<den)den=speDayBefore(a);return}
      if(cov<b){miss.push({shop:sh,from:speDayAfter(cov),to:b});if(cov<den)den=cov}})}
  return {den:den<from?"":den,miss};
}
const speDayShift=(d,n)=>{const x=new Date(d+"T00:00:00Z");x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
const speDayAfter=d=>speDayShift(d,1),speDayBefore=d=>speDayShift(d,-1);
