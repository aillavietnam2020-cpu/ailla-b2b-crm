/* =====================================================================
   TRANG TIKTOK BẢN MỚI (chị Hoa duyệt demo bản 6, 27/10/2026): hàm thuần cho cơ cấu doanh thu, cơ cấu chi phí,
   số theo tuần, cảnh báo & đề xuất (quản trị) và hiệu quả từng team MKT (vận hành). Không đổi công thức lãi lỗ của ttcalc.js:
   chỉ đọc số tháng đã lưu (P) và số theo ngày team tải (Key metrics, LIVE, Campaign overview, Transaction Analysis).
   Cảnh báo chỉ dựng từ số thật; thiếu số thì không cảnh báo, không đoán.
   ===================================================================== */
const TTBC_LANES=[["vInh","Video inhouse","#5b4bdb"],["koc","KOC (video + live)","#e0607e"],["the","Thẻ sản phẩm / tìm kiếm","#f0a020"],["lShop","LIVE của shop","#2a9d8f"]];
const ttbcPct=(a,b)=>b?a/b:0;

/* Cơ cấu doanh thu theo nguồn (GMV, TikTok chỉ chia nguồn theo GMV). km = tổng Key metrics của kỳ; hoaHong = hoa hồng KOC thật. */
function ttbcLanes(km,hoaHong,ads){
  const k=km||{},v={vInh:+k.vInh||0,koc:(+k.vKoc||0)+(+k.lKoc||0),the:+k.the||0,lShop:+k.lShop||0},tot=Object.values(v).reduce((a,b)=>a+b,0);
  const rows=TTBC_LANES.map(([key,n,c])=>({key,n,c,gmv:v[key],ty:ttbcPct(v[key],tot),cp:key==="koc"&&hoaHong?hoaHong:key==="the"?0:null}));
  rows.forEach(r=>{r.cp100=r.cp!=null&&r.gmv?r.cp/r.gmv:null});
  return {rows,tot,ads:+ads||0,ads100:tot?(+ads||0)/tot:null};
}

/* Số theo tuần trong tháng: khối 7 ngày từ ngày 01 (01–07, 08–14, …). days = {ngày: {km, ads}}. */
function ttbcWeeks(days,ky,vat){
  const last=new Date(+ky.slice(0,4),+ky.slice(5,7),0).getDate(),out=[];
  for(let a=1;a<=last;a+=7){const b=Math.min(last,a+6),w={a,b,gmv:0,ads:0,n:0,lShop:0,vInh:0};
    for(let d=a;d<=b;d++){const x=(days||{})[ky+"-"+String(d).padStart(2,"0")];if(!x)continue;
      if(x.km){w.gmv+=+x.km.gmv||0;w.vInh+=+x.km.vInh||0;w.lShop+=+x.km.lShop||0;w.n++}if(x.ads)w.ads+=(+x.ads.chi||0)*(1+(vat||0))}
    w.ads=Math.round(w.ads);w.roas=w.ads?w.gmv/w.ads:null;w.du=w.n===b-a+1;out.push(w)}
  return out;
}
/* Hai tuần đủ 7 ngày gần nhất có số (để so tuần này với tuần trước). */
function ttbcLast2(weeks){const W=(weeks||[]).filter(w=>w.du&&w.b-w.a===6&&w.gmv>0);return W.length>=2?[W[W.length-2],W[W.length-1]]:null}

/* Cơ cấu chi phí: P = số tháng (ttPL), rieng / chung = [{n, t}] từ Sổ chi phí (null = chưa có số). */
function ttbcCost(P,rieng,chung){
  const sum=a=>(a||[]).reduce((s,x)=>s+(+x.t||0),0),dt=P.dt||0;
  const lines=[{k:"gv",n:"Giá vốn hàng bán",t:P.gv,c:"#8a8799"},{k:"phi",n:"Phí sàn TikTok",t:-P.phi,c:"#e07a3f",sub:P.fees.filter(f=>Math.round(f[1])).map(f=>({n:f[0],t:-f[1]}))},{k:"ads",n:"Quảng cáo GMV Max (đã VAT)",t:P.ads,c:"#e2494a"}];
  const R=rieng?sum(rieng):null,C=chung?sum(chung):null,lai=P.lai,ln=R!=null&&C!=null?lai-R-C:null;
  return {dt,lines,lai,rieng:rieng?{t:R,sub:rieng}:null,chung:chung?{t:C,sub:chung}:null,ln,
    bar:[["Giá vốn",P.gv,"#8a8799"],["Phí sàn",-P.phi,"#e07a3f"],["Quảng cáo",P.ads,"#e2494a"]].concat(R?[["Chi riêng khác",R,"#b06ab3"]]:[]).concat(C?[["Chi chung",C,"#5d6d8e"]]:[]).concat([[ln!=null?"Lợi nhuận ròng":"Lãi đóng góp",ln!=null?ln:lai,"#17804a"]]).map(([n,t,c])=>({n,t,c,ty:ttbcPct(t,dt)}))};
}

/* Mức ưu tiên quảng cáo của sản phẩm (cho team, không lộ số lãi). */
function ttbcPri(p,ng2,dtAll){if(p.lg<0)return "Dừng quảng cáo";if(p.bien<ng2)return "Giảm";if(ttbcPct(p.dt,dtAll)<0.02)return "Thử thêm";if(p.bien<ng2+0.1)return "Giữ mức";return "Đẩy mạnh"}

/* Cảnh báo & đề xuất trang quản trị. I = {P, lanes, last2, live:{phien, phienGmv, gmv}, adsMax}. Mỗi dòng {lv: r|a|g, t, d, ai}. */
function ttbcAlerts(I){
  const P=I.P,canh=[],de=[],fmt=v=>(Math.round(v*1000)/10).toString().replace(".",",")+"%";
  if(P&&P.dt){
    const top=(P.sp||[])[0];if(top&&ttbcPct(top.dt,P.dt)>0.5)canh.push({lv:"r",t:`${top.n.slice(0,40)} = ${fmt(top.dt/P.dt)} doanh thu`,d:"Phụ thuộc một sản phẩm: hết hàng hoặc bị hạ giá là kênh tụt mạnh.",ai:"Kinh doanh + Sản xuất"});
    const ar=ttbcPct(P.ads,P.dt);if(I.adsMax&&ar>I.adsMax)canh.push({lv:"r",t:`Quảng cáo ${fmt(ar)} doanh thu, vượt ngưỡng ${fmt(I.adsMax)}`,d:"Giảm ngân sách nhóm chiến dịch lỗ.",ai:"Team Ads"});
    (P.g1||[]).slice(0,2).forEach(r=>canh.push({lv:"r",t:`${String(r.pn||r.n).slice(0,40)}: lỗ ngay khi chưa tính quảng cáo`,d:"Kiểm lại giá vốn / giá bán trước khi chạy tiếp.",ai:"Kinh doanh"}));
    const g2=(P.g2||[]).slice().sort((a,b)=>b.dt-a.dt)[0];if(g2&&g2.dt>=1e6)canh.push({lv:"a",t:`${String(g2.pn).slice(0,40)}: biên ${fmt(g2.bien)}, thấp hơn ngưỡng ${fmt(P.ng2)}`,d:"Đẩy quảng cáo mức trung bình là lỗ.",ai:"Team Ads"});
    if(P.dtUocGv>0)canh.push({lv:"a",t:`${(P.g3||[]).length} mã chưa có giá vốn (${fmt(P.dtUocGv/P.dt)} doanh thu)`,d:"Lãi theo sản phẩm chưa dùng để cắt / đẩy được.",ai:"Kế toán"});
  }
  const L=I.live;if(L&&L.phien>=10&&ttbcPct(L.phienGmv,L.phien)<0.1){canh.push({lv:"r",t:`LIVE ${L.phien} buổi, chỉ ${L.phienGmv} buổi có đơn`,d:"Đông buổi nhưng ít ra đơn.",ai:"Team Live"});de.push({lv:"b",t:"Cắt bớt LIVE hoặc đổi kịch bản",d:"Chỉ giữ khung giờ có đơn, đo lại sau 2 tuần."})}
  const W=I.last2;if(W&&W[0].ads&&W[1].ads){const gA=W[1].ads/W[0].ads-1,gG=W[1].gmv/W[0].gmv-1;
    if(gA-gG>0.05){canh.push({lv:"a",t:`Quảng cáo ${gA>0?"+":""}${fmt(gA)}, GMV ${gG>0?"+":""}${fmt(gG)} (tuần ${W[1].a}–${W[1].b})`,d:`GMV / quảng cáo ${W[0].roas.toFixed(2).replace(".",",")} → ${W[1].roas.toFixed(2).replace(".",",")}.`,ai:"Team Ads"});
      de.push({lv:"b",t:"Giữ ngân sách quảng cáo, không tăng thêm",d:"Hiệu quả tuần gần nhất đang giảm."})}}
  if(P&&P.sp){const best=P.sp.slice(0,6).filter(p=>p.lg>0&&p.bien>=P.ng2+0.1).sort((a,b)=>b.bien-a.bien).slice(0,2);if(best.length)de.push({lv:"b",t:"Dồn ngân sách cho "+best.map(p=>p.n.slice(0,28)).join(", "),d:"Biên lãi sau phí sàn "+best.map(p=>fmt(p.bien)).join(" / ")+"."})}
  const Ln=I.lanes;if(Ln&&Ln.ads100!=null){const k=Ln.rows.find(r=>r.key==="koc");if(k&&k.cp100!=null&&k.cp100<Ln.ads100)de.push({lv:"b",t:"Mở thêm KOC, gửi thêm hàng mẫu",d:`KOC tốn ${fmt(k.cp100)} GMV, quảng cáo tốn ${fmt(Ln.ads100)}.`})}
  if(P&&P.dt&&I.adsMax&&ttbcPct(P.ads,P.dt)<=I.adsMax)canh.push({lv:"g",t:`Quảng cáo ${fmt(P.ads/P.dt)} doanh thu, dưới ngưỡng ${fmt(I.adsMax)}`,d:"",ai:""});
  const ord={r:0,a:1,g:2};canh.sort((a,b)=>ord[a.lv]-ord[b.lv]);
  return {canh,de};
}

/* Doanh thu dự kiến của tháng chưa đủ số (báo cáo giữa tháng): phần đơn chưa quyết toán trừ theo tỷ lệ hoàn sau giao
   bình quân của các tháng TikTok đã đủ số (chị Hoa duyệt 27/10; không dùng 8% của Facebook vì đơn hủy trước giao đã trừ sẵn).
   cur = {dt, dtUoc, den}; closed = [{dt, hoanGiao, den}]. Trả {rate, dk, n} — rate null khi chưa có tháng đủ số để tính. */
function ttbcDuKien(cur,closed){
  const C=(closed||[]).filter(s=>s&&!s.den&&s.hoanGiao!=null&&+s.dt>0),a=C.reduce((x,s)=>x+(+s.hoanGiao||0),0),b=C.reduce((x,s)=>x+(+s.dt||0)+(+s.hoanGiao||0),0);
  const rate=b?a/b:null;if(!cur||!cur.den)return {rate,dk:cur?+cur.dt||0:null,n:C.length};
  return {rate,dk:rate==null?null:Math.round((+cur.dt||0)-(+cur.dtUoc||0)*rate),n:C.length};
}

/* Hiệu quả từng team MKT (trang vận hành). I = {km, ads:{chi, don}, adsV, live, koc (Transaction Analysis), dt, lgRate, hoaHong, last2}. */
function ttbcTeams(I){
  const km=I.km||{},gmv=+km.gmv||0,L=I.live||{},K=I.koc||null,W=I.last2,fmt=v=>(Math.round(v*1000)/10).toString().replace(".",",")+"%";
  const st=al=>al.some(x=>x.lv==="r")?"Kém":al.some(x=>x.lv==="a")?"Theo dõi":"Tốt";
  const content={al:[]};content.gmv=+km.vInh||0;content.ty=ttbcPct(content.gmv,gmv);
  if(W&&W[0].vInh){const g=W[1].vInh/W[0].vInh-1;if(g<=-0.15)content.al.push({lv:"a",t:`GMV video shop tuần ${W[1].a}–${W[1].b} giảm ${fmt(-g)}`,d:"Rút mẫu video thắng tuần trước để làm lại."});else if(g>=0.15)content.al.push({lv:"g",t:`GMV video shop tuần ${W[1].a}–${W[1].b} tăng ${fmt(g)}`,d:"Giữ nhịp đăng, nhân bản mẫu video thắng."})}
  const ads={al:[],chi:I.adsV||0,don:+((I.ads||{}).don)||0};ads.roi=ads.chi&&I.dt?I.dt/ads.chi:null;ads.roas=ads.chi?gmv/ads.chi:null;ads.hoaVon=I.lgRate>0?1/I.lgRate:null;ads.cpo=ads.don?(+I.ads.chi||0)/ads.don:null;
  if(ads.roi!=null&&ads.hoaVon&&ads.roi<ads.hoaVon*1.2)ads.al.push({lv:"r",t:`ROI ${ads.roi.toFixed(2).replace(".",",")} sát mức hòa vốn ${ads.hoaVon.toFixed(2).replace(".",",")}`,d:"Tắt nhóm chiến dịch ROAS thấp, không mở rộng ngân sách."});
  if(W&&W[0].roas&&W[1].roas&&W[1].roas<W[0].roas*0.97)ads.al.push({lv:"a",t:`ROAS tuần ${W[1].a}–${W[1].b} giảm ${W[0].roas.toFixed(2).replace(".",",")} → ${W[1].roas.toFixed(2).replace(".",",")}`,d:"Không tăng ngân sách; dồn cho sản phẩm biên cao."});
  const koc={al:[]};if(K){koc.nguoi=+K["Nhà sáng tạo đã đăng nội dung"]||0;koc.video=+K["Video"]||0;koc.videoDon=+K["Video có doanh số"]||0;koc.gmv=(+km.vKoc||0)+(+km.lKoc||0);koc.gmvFile=+K["GMV nhờ nhà sáng tạo"]||0;koc.mau=+K["Hàng mẫu đã vận chuyển"]||0;
    koc.hh=I.hoaHong!=null?I.hoaHong:+K["Hoa hồng ước tính"]||0;koc.hhNguon=I.hoaHong!=null?"quyết toán":"ước tính";koc.roi=koc.hh?koc.gmv/koc.hh:null;
    if(koc.video&&ttbcPct(koc.videoDon,koc.video)<0.4)koc.al.push({lv:"a",t:`${koc.video-koc.videoDon}/${koc.video} video KOC chưa ra đơn`,d:"Ưu tiên KOC đã ra đơn, gửi mẫu sản phẩm biên cao."})}
  const live={al:[],phien:+L.phien||0,phienGmv:+L.phienGmv||0,gmv:+L.gmv||0,don:+L.don||0,xem:+L.xem||0};live.gmv1000=live.xem?live.gmv/live.xem*1000:null;
  if(live.phien>=10&&ttbcPct(live.phienGmv,live.phien)<0.1)live.al.push({lv:"r",t:`Chỉ ${fmt(live.phienGmv/live.phien)} buổi live có đơn`,d:"Đổi sản phẩm lên live, thêm ưu đãi chỉ trong live, bỏ khung giờ không ra đơn."});
  [content,ads,koc,live].forEach(x=>x.st=st(x.al));
  const todo=[["Live",live],["Ads",ads],["Booking",koc],["Content",content]].flatMap(([n,x])=>x.al.filter(a=>a.lv!=="g").map(a=>({...a,team:n}))).sort((a,b)=>(a.lv==="r"?0:1)-(b.lv==="r"?0:1)).slice(0,3);
  return {content,ads,koc,live,todo,has:{koc:!!K,live:!!(I.live&&live.phien)}};
}
