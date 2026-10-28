/* =====================================================================
   TRANG SHOPEE BẢN MỚI — hàm tính thuần (chị Hoa duyệt demo 28/10/2026, theo khung trang TikTok).
   Đầu vào là số tháng đã lưu của từng shop (speSummary + speRowsPack ở specalc.js), không đọc lại file.
   - speBcMonth: gộp các shop đang xem: tổng tháng, phí sàn theo nhóm, so sánh shop, sản phẩm gộp theo tên.
   - speBcWeeks: doanh thu / đơn / quảng cáo theo khối 7 ngày (1–7, 8–14…) từng shop, để so tuần.
   - speBcAlerts: cảnh báo & đề xuất tuần / tháng. speBcPri: mức ưu tiên quảng cáo cho trang vận hành.
   ===================================================================== */
const SPE_BC_KENH={aillavn:"Shopee Mall",aillavn1:"Shopee thường"};/* tên kênh ở Sổ chi phí */
const speBcPct=(a,b)=>b?a/b:0;
const speBcF=v=>(Math.round(v*1000)/10).toString().replace(".",",")+"%";
/* Tên sản phẩm gọn để gộp: bỏ nhãn [..] đầu tên, emoji, ký tự trang trí. */
const speBcName=pn=>String(pn||"").replace(/^(\s*\[[^\]]*\]\s*)+/,"").replace(/[\u{1F000}-\u{1FFFF}☀-➿️]/gu,"").replace(/^[\s|\-–:]+/,"").replace(/\s+/g," ").trim();
const speBcKey=pn=>speBcName(pn).toLowerCase().slice(0,48);

/* Mức ưu tiên quảng cáo theo biên lãi sau phí sàn (giống priOf của TikTok). ng2 = quảng cáo/doanh thu + 10 điểm. */
function speBcPri(p,ng2,dtAll){const b=p.dt?p.lg/p.dt:0;
  if(p.lg<0)return "Dừng quảng cáo";if(b<ng2)return "Giảm";if(dtAll&&p.dt/dtAll<0.02)return "Thử thêm";if(b<ng2+0.1)return "Giữ mức";return "Đẩy mạnh"}
/* Đánh giá sản phẩm bên quản trị. */
function speBcDg(p,ng2){if(p.lg<0)return "Lỗ trước ads";const b=p.dt?p.lg/p.dt:0;if(b<ng2)return "Biên mỏng";if(b<ng2+0.03)return "Sát ngưỡng";return "Gánh được ads"}

/* L = [{s: summary, rows: dòng sản phẩm hoặc null}] của các shop đang xem, cùng một tháng. */
function speBcMonth(L){
  const S=(L||[]).filter(x=>x&&x.s),sum=k=>S.reduce((a,x)=>a+(+x.s[k]||0),0);
  const dt=sum("dt"),gv=sum("gv"),phi=-sum("phi"),ads=sum("ads"),lg=sum("lg"),don=sum("don"),mon=sum("mon"),hh=sum("hh"),koc=sum("koc"),vou=-sum("vou"),dtUocGv=sum("dtUocGv");
  const fm={};S.forEach(x=>(x.s.fees||[]).forEach(([n,v])=>{fm[n]=(fm[n]||0)-(+v||0)}));
  const fees=Object.entries(fm).filter(e=>Math.round(e[1])).map(([n,t])=>({n,t})).sort((a,b)=>b.t-a.t);
  const hhAff=fm["Hoa hồng affiliate"]||0,lai=lg-ads,ng2=speBcPct(ads,dt)+0.1;
  const shops=S.map(x=>{const s=x.s,d=+s.dt||0,a=+s.ads||0,h=+s.hh||0;return {shop:s.shop,den:s.den||null,dt:d,don:+s.don||0,phi:-(+s.phi||0),ads:a,roi:a?d/a:null,hh:h,hhRate:speBcPct(h,d+h),lai:(+s.lg||0)-a,koc:+s.koc||0,gvUoc:+s.dtUocGv||0,
    aff:-((s.fees||[]).find(f=>/affiliate/i.test(f[0]))||[0,0])[1]||0}});
  const g={};S.forEach(x=>(x.rows||[]).forEach(r=>{const k=speBcKey(r.pn),p=g[k]||(g[k]={n:speBcName(r.pn),q:0,dt:0,lg:0,uoc:0,by:{}});
    p.q+=+r.q||0;p.dt+=+r.dt||0;p.lg+=+r.lg||0;if(r.uoc)p.uoc+=+r.dt||0;p.by[x.s.shop]=(p.by[x.s.shop]||0)+(+r.dt||0)}));
  const sp=Object.values(g).filter(p=>Math.round(p.dt)||Math.round(p.lg)).sort((a,b)=>b.dt-a.dt).map(p=>({...p,bien:p.dt?p.lg/p.dt:0,dg:speBcDg(p,ng2),pri:speBcPri(p,ng2,dt)}));
  return {dt,gv,phi,ads,lg,lai,don,mon,hh,hhRate:speBcPct(hh,dt+hh),koc,hhAff,vou,dtUocGv,fees,ng2,aov:don?dt/don:0,roi:ads?dt/ads:null,shops,sp,
    den:S.reduce((m,x)=>x.s.den&&(!m||x.s.den<m)?x.s.den:m,null),hasRows:S.some(x=>x.rows)};
}

/* Khối 7 ngày của tháng ky từ số theo ngày [doanh thu, phí sàn, giá vốn, lãi gộp, đơn, quảng cáo] từng shop.
   du = mọi shop có số tới hết khối (theo "đến ngày" của shop). */
function speBcWeeks(sums,ky){
  const S=(sums||[]).filter(s=>s&&s.ky===ky),last=new Date(+ky.slice(0,4),+ky.slice(5,7),0).getDate(),out=[];
  for(let a=1;a<=last;a+=7){const b=Math.min(last,a+6),w={a,b,dt:0,don:0,ads:0,by:{},du:S.length>0};
    S.forEach(s=>{let d0=0;for(let d=a;d<=b;d++){const x=(s.days||{})[ky+"-"+String(d).padStart(2,"0")];if(!x)continue;d0+=+x[0]||0;w.don+=+x[4]||0;w.ads+=+x[5]||0}
      w.dt+=d0;w.by[s.shop]=d0;const den=s.den||ky+"-"+String(last).padStart(2,"0");if(den<ky+"-"+String(b).padStart(2,"0"))w.du=false});
    out.push(w)}
  return out;
}
const speBcLast2=W=>{const F=(W||[]).filter(w=>w.du&&w.b-w.a===6&&w.dt>0);return F.length>=2?[F[F.length-2],F[F.length-1]]:null};

/* Cảnh báo & đề xuất. M = speBcMonth (null khi chỉ xem tuần), last2 = 2 tuần đủ số, miss = shop chưa có báo cáo, adsMax = ngưỡng quảng cáo. */
function speBcAlerts({M,last2,miss,adsMax,label}){
  const canh=[],de=[],L=label||(s=>s);
  if(last2){const [p,c]=last2;
    Object.keys(c.by).forEach(sh=>{const a=p.by[sh]||0,b=c.by[sh]||0;if(a>0&&b<a*0.85)canh.push({lv:b<a*0.75?"r":"a",t:`${L(sh)}: doanh thu tuần ${c.a}–${c.b} giảm ${speBcF(1-b/a)}`,d:`${Math.round(a/1e5)/10}tr → ${Math.round(b/1e5)/10}tr so với tuần trước.`,ai:"Team Shopee"})});
    if(p.ads&&c.ads>p.ads*1.3&&c.dt<p.dt*1.1)canh.push({lv:"a",t:`Quảng cáo tuần ${c.a}–${c.b} tăng ${speBcF(c.ads/p.ads-1)}, doanh thu không tăng tương ứng`,ai:"Team Ads"});
    if(!canh.length)de.push({lv:"g",t:`Tuần ${c.a}–${c.b} không có shop nào giảm doanh thu quá 15%`})}
  if(M&&M.dt){
    M.shops.forEach(s=>{if(s.hhRate>0.15)canh.push({lv:"r",t:`${L(s.shop)} hủy/hoàn ${speBcF(s.hhRate)}`,d:`${Math.round(s.hh/1e5)/10}tr giá trị.`,ai:"CSKH + Kho"});else if(s.hhRate>0.12)canh.push({lv:"a",t:`${L(s.shop)} hủy/hoàn ${speBcF(s.hhRate)}`,ai:"CSKH"})});
    if(M.dtUocGv>M.dt*0.2)canh.push({lv:"a",t:`${speBcF(M.dtUocGv/M.dt)} doanh thu đang ước giá vốn`,d:"Biên từng sản phẩm chưa tin được.",ai:"Kế toán khai Quy đổi mã kênh Shopee"});
    const ads=speBcPct(M.ads,M.dt);
    if(adsMax&&ads>adsMax)canh.push({lv:"r",t:`Quảng cáo ${speBcF(ads)} doanh thu, vượt ngưỡng ${speBcF(adsMax)}`,ai:"Team Ads"});
    M.sp.filter(p=>p.dg==="Lỗ trước ads"&&p.dt>0).slice(0,2).forEach(p=>canh.push({lv:"r",t:`${p.n.slice(0,40)} lỗ trước quảng cáo`,ai:"Team Ads"}));
    M.sp.filter(p=>p.dg==="Biên mỏng"&&p.dt>=M.dt*0.03).slice(0,2).forEach(p=>canh.push({lv:"a",t:`${p.n.slice(0,40)} biên ${speBcF(p.bien)} < ngưỡng ${speBcF(M.ng2)}`,ai:"Team Ads"}));
    const day=M.sp.filter(p=>p.pri==="Đẩy mạnh").slice(0,2);
    if(M.roi&&M.roi>=4&&adsMax&&ads<adsMax-0.1)de.push({lv:"b",t:"Còn dư địa tăng quảng cáo",d:`ROI ${(Math.round(M.roi*100)/100).toString().replace(".",",")}, quảng cáo mới ${speBcF(ads)} doanh thu (ngưỡng ${speBcF(adsMax)})${day.length?". Dồn cho "+day.map(p=>p.n.slice(0,28)).join(", "):""}.`});
    const k=M.shops.filter(s=>s.koc>0),k0=M.shops.filter(s=>!s.koc&&s.dt>0);
    if(k.length&&M.hhAff){const kd=k.reduce((a,s)=>a+s.koc,0);de.push({lv:"b",t:k0.length?`Mở tiếp thị liên kết cho ${k0.map(s=>L(s.shop)).join(", ")}`:"Tăng tiếp thị liên kết (KOC)",d:`KOC mang ${speBcF(kd/M.dt)} doanh thu, hoa hồng ${speBcF(M.hhAff/kd)} so với quảng cáo ${speBcF(ads)}.`})}
    if(adsMax&&ads<=adsMax)de.push({lv:"g",t:`Quảng cáo ${speBcF(ads)} < ngưỡng ${speBcF(adsMax)}`})}
  (miss||[]).forEach(sh=>canh.push({lv:"a",t:`Chưa có báo cáo ${L(sh)} tháng này`,d:"Số trang này chưa gồm shop đó.",ai:"Kế toán / agent"}));
  return {canh,de};
}

/* Việc tuần này cho trang vận hành, rút từ cảnh báo. */
function speBcTodo(A){return (A.canh||[]).filter(x=>x.lv==="r"||x.lv==="a").slice(0,4).map(x=>({lv:x.lv,team:x.ai||"",t:x.t}))}
