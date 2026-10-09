/* =====================================================================
   TỔNG QUAN ĐIỀU HÀNH (trang đầu của CEO) — chỉ dùng số thật đã có, chỗ nào chưa có ghi rõ
   ===================================================================== */
const ICONS={spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',money:'<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.6-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2.1 0 2.8 6 1.4 6 4.1 0 1.2-1.3 2.3-3 2.3-1.4 0-2.6-.6-3.1-1.6M12 6.5v11"/>',trend:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',wallet:'<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M16 13h2M3 10h18M6 6V4h10"/>',cart:'<path d="M3 4h2l2.4 11h10.2L20 8H7"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',pct:'<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',alert:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',check:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',chart:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',bag:'<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',box:'<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',fac:'<path d="M3 21V10l6 4V10l6 4V6l6 4v11z"/>',mega:'<path d="M3 10v4h4l6 4V6L7 10z"/><path d="M17 9a4 4 0 0 1 0 6"/>',fin:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',ppl:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',task:'<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 9l2 2 4-4M8 15h8"/>'};
const ico=k=>`<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]||""}</svg>`;

function execAlerts(){
  const d=D(),A=[],late=d.cards.filter(isLate);try{aiTop(2).forEach(i=>A.push([i.lv==="hot"?"amb":"red","Trợ lý AI: "+i.title,"bấm để xem đề xuất","ai"]))}catch(err){}
  if(late.length)A.push(["red",`${late.length} thẻ video trễ hạn`,"Marketing · Content","cv"]);
  const ms=(KDX.fbSale||[]).filter(s=>s.tao&&s.huy/s.tao>.2);ms.forEach(s=>A.push(["red",`${s.n}: tỷ lệ hủy ${(s.huy/s.tao*100).toFixed(1)}%`,"Facebook › Hoạt động Sale B2C · vượt ngưỡng 20%","fb_sale"]));
  if(KDX.fbDash&&KDX.fbDash.dt&&!KDX.fbDash.tienVe)A.push(["amb",`${tr(KDX.fbDash.treo)} tiền Facebook chưa ghi nhận về`,"Kế toán · kiểm mã đối soát","doisoat"]);
  if(KDX.tts){const lo=KDX.tts.sp.filter(s=>s.lai<0);if(lo.length)A.push(["amb",`${lo.length} sản phẩm TikTok lỗ sau quảng cáo`,"TikTok · tháng 7","bc_tiktok"]);const nt=(KDX.tts.booking.find(r=>/nghiệm thu/.test(r[0]))||[])[1];if(nt===0)A.push(["amb","36 KOC đã book, chưa nghiệm thu video nào","KOC · tháng 8","bc_koc"])}
  if(KDX.spe)A.push(["amb","40% doanh thu Shopee chưa chốt giá vốn","Kế toán · 95 SKU cần xác nhận","bc_shopee"]);
  if(d.b2b){const over=d.b2b.customers.filter(c=>{const x=custDebt(c);return x.limit&&x.chinh>x.limit}).length;if(over)A.push(["red",`${over} khách B2B vượt hạn mức công nợ`,"B2B · dữ liệu mẫu","b2b_cn"])}
  return A;
}
function execApprovals(){
  const d=D(),L=[];const st=d.plan.steps||{};Object.entries(st).filter(([n,v])=>v&&v.s==="review").forEach(([n])=>L.push([`Kế hoạch tháng ${MONTH.mon} · bước ${n}`,"Marketing · Lead Content & Media gửi","kehoach"]));
  const kb=d.cards.filter(c=>c.step==="dkb").length,vd=d.cards.filter(c=>c.step==="dvd").length;if(kb)L.push([`${kb} kịch bản chờ duyệt`,"Marketing · Content","cv"]);if(vd)L.push([`${vd} video chờ duyệt`,"Marketing · Content","cv"]);const vc=d.cards.filter(c=>c.step==="dceo").length;if(vc)L.push([`${vc} video chờ CEO duyệt`,"Marketing · Lead Content & Media đã duyệt","cv"]);
  const dcp=(d.adjusts||[]).filter(a=>a.st==="pending").length;if(dcp)L.push([`${dcp} phiếu điều chỉnh kế hoạch chờ duyệt`,"Marketing · Lead Content & Media / trợ lý AI đề xuất","dieuchinh"]);
  const rs=d.research.filter(r=>r.status==="Chờ kiểm tra").length;if(rs)L.push([`${rs} research chờ kiểm tra`,"Marketing","research"]);
  if(d.b2b){const p=d.b2b.orders.filter(o=>o.approval==="PENDING_APPROVAL");if(p.length)L.push([`${p.length} đơn B2B chờ duyệt · ${tr(sum(p,ordTot))}`,"Kinh doanh B2B","b2b_don"])}
  return L;
}
function chanRows(){
  const tt=pSum("tts",0),sp=pSum("spe",0),fb=pSum("fb",6),fbt=pSum("fb",0),A=adsSum(),ad=sum(Object.values(A),a=>a.dt),ac=sum(Object.values(A),a=>a.chi);
  return [["bag","TikTok Shop","GMV cả shop",tt.v,"",covTxt("tts"),"bc_tiktok"],["bag","Shopee 2 shop","doanh thu, đã trừ hủy/hoàn",sp.v,pSum("spe",3).v,covTxt("spe"),"bc_shopee"],["bag","Facebook (Pancake)","doanh thu chốt · "+nf(pSum("fb",1).v)+" đơn chốt",fb.v,pSum("fb",5).v-pSum("fb",7).v,covTxt("fb"),"bc_fb"],["mega","Ads Facebook","đơn chốt · chi "+tr(ac),ad,"",covTxt("ads"),"adshieuqua"],["box","Kinh doanh B2B","CRM","","","chờ nối CRM thật","b2b_today"],["fac","Sản xuất","2 nhà máy","","","chưa có số","sx"]];
}
/* ---------- Trung tâm điều hành: mỗi nhóm chỉ số một khối ---------- */
function rSum(src,idx,from,to){const D0=DAYD[src]||{};let v=0,n=0;for(const k in D0)if(k>=from&&k<=to){v+=+D0[k][idx]||0;n++}return {v,n}}
function rAds(idx,from,to){let v=0;for(const nv in DAYD.ads||{})for(const k in DAYD.ads[nv])if(k>=from&&k<=to)v+=+DAYD.ads[nv][k][idx]||0;return v}
const fullMonth=(ym,from,to)=>{const [y,m]=ym.split("-").map(Number);return from<=`${ym}-01`&&to>=iso(new Date(y,m,0))};
function prevRange(){const f=pdate(PERIOD.from),t=pdate(PERIOD.to),n=Math.round((t-f)/864e5)+1;return {from:iso(addD(f,-n)),to:iso(addD(f,-1)),n}}
function execNums(from,to){
  const tt=rSum("tts",0,from,to).v,spDT=rSum("spe",0,from,to).v,fbDT=rSum("fb",6,from,to).v,fbGiao=rSum("fb",5,from,to).v,adsDT=rAds(3,from,to);
  const tFull=KDX.tts&&fullMonth("2026-07",from,to),sFull=KDX.spe&&fullMonth("2026-07",from,to);
  const C={adsFB:rAds(0,from,to)*(1+FB_ADS_TAX),adsTT:rSum("tts",10,from,to).v,adsSPE:sFull?-plv(KDX.spe.pl,/Ads/):0,gvFB:rSum("fb",7,from,to).v,gvSPE:rSum("spe",2,from,to).v,gvTT:tFull?-plv(KDX.tts.pl,/Giá vốn/):0,phiSPE:-rSum("spe",1,from,to).v,phiTT:tFull?-plv(KDX.tts.pl,/Phí sàn/):0,khacTT:tFull?-(plv(KDX.tts.pl,/agency/)+plv(KDX.tts.pl,/KOC/)+plv(KDX.tts.pl,/Livestream/)):0};
  const L={fb:fbGiao?fbGiao-C.gvFB-C.adsFB:null,spe:spDT?rSum("spe",3,from,to).v-C.adsSPE:null,tts:tFull?plv(KDX.tts.pl,/^LÃI ĐÓNG GÓP/):null};
  const ndA=(()=>{const s=new Set();for(const nv in DAYD.ads||{})for(const k in DAYD.ads[nv])if(k>=from&&k<=to)s.add(k);return s.size})();
  return {tt,spDT,fbDT,fbGiao,adsDT,tong:tt+spDT+fbDT,C,L,tFull,sFull,n:{tts:rSum("tts",0,from,to).n,spe:rSum("spe",0,from,to).n,fb:rSum("fb",0,from,to).n,ads:ndA}};
}
function execTargets(){const d=D();if(!d.targets)d.targets={tong:0,tts:1.4e9,spe:0,fb:0,ads:sum(KDX.adsPeople||[],p=>p.kpi)};return d.targets}
const chg=(a,b,na,nb)=>!b||(na!=null&&nb<na*0.8)?"":`<span class="chg ${a>=b?"up":"dn"}">${a>=b?"▲":"▼"} ${Math.abs((a-b)/b*100).toFixed(1)}%</span>`;
const symOK=(N,P,s)=>{const a=N.n[s]||0,b=P.n[s]||0;return a>0&&b>0&&b>=a*.8&&a>=b*.8};
const allOK=(N,P)=>["tts","spe","fb"].every(s=>!(N.n[s]||P.n[s])||symOK(N,P,s))&&["tts","spe","fb"].some(s=>symOK(N,P,s));
/* ---------- Trung tâm điều hành (Navy Executive): dải KPI · doanh số theo kênh + việc cần xử lý · hai bảng ---------- */
function execCost(N){const C=N.C;return [["Quảng cáo",[["Ads Facebook (sau thuế)",C.adsFB],["Ads TikTok (gồm thuế)",C.adsTT],["Shopee Ads",C.adsSPE]]],["Giá vốn",[["Facebook (đơn giao TC)",C.gvFB],["Shopee",C.gvSPE],["TikTok",C.gvTT]]],["Phí sàn",[["Shopee",C.phiSPE],["TikTok",C.phiTT]]],["Khác",[["TikTok: agency, KOC, live",C.khacTT]]]].map(([g,L])=>[g,L.filter(x=>x[1])]).filter(g=>g[1].length)}
function execOrders(from,to){return {tts:rSum("tts",1,from,to).v,spe:rSum("spe",4,from,to).v,fb:rSum("fb",1,from,to).v}}
/* Biểu đồ đường dùng chung trên nền navy: lưới mảnh, trục dịu, chú thích bật/tắt, di chuột xem số. */
let EXCH={tab:"all",off:{}};
function lineChart(series,keys,fmt=money,lbl=k=>k){
  const S=series.filter(s=>!EXCH.off[s.n]),W=720,Hh=180,pl=44,pb=24,pt=10,iw=W-pl-8,ih=Hh-pt-pb;
  const mx=Math.max(1,...S.flatMap(s=>keys.map(k=>s.get(k)||0))),nice=(()=>{const p=Math.pow(10,Math.floor(Math.log10(mx)));return Math.ceil(mx/p)*p})();
  const x=i=>pl+(keys.length<2?iw/2:i*iw/(keys.length-1)),y=v=>pt+ih-v/nice*ih;
  const grid=[0,.25,.5,.75,1].map(t=>`<line x1="${pl}" x2="${W-8}" y1="${y(nice*t)}" y2="${y(nice*t)}" stroke="#e8ebf3"/><text x="${pl-6}" y="${y(nice*t)+4}" text-anchor="end" font-size="11" fill="#8a94a8">${fmt(nice*t)}</text>`).join("");
  const step=Math.max(1,Math.ceil(keys.length/8)),xl=keys.map((k,i)=>i%step===0||i===keys.length-1?`<text x="${x(i)}" y="${Hh-6}" text-anchor="middle" font-size="11" fill="#8a94a8">${lbl(k)}</text>`:"").join("");
  const lines=S.map(s=>`<polyline fill="none" stroke="${s.c}" stroke-width="${s.main?2.4:1.8}" stroke-linejoin="round" stroke-linecap="round" points="${keys.map((k,i)=>x(i)+","+y(s.get(k)||0)).join(" ")}"/>`).join("");
  return `<div class="lc"><svg viewBox="0 0 ${W} ${Hh}" class="lcsvg" role="img" aria-label="Biểu đồ doanh số theo ngày">${grid}${xl}${lines}<line class="lcx" x1="0" x2="0" y1="${pt}" y2="${pt+ih}" stroke="#c3cad6" visibility="hidden"/><rect x="${pl}" y="${pt}" width="${iw}" height="${ih}" fill="transparent" class="lchit"/></svg><div class="lctip" hidden></div></div>
  <div class="lcleg">${series.map(s=>`<button type="button" class="${EXCH.off[s.n]?"off":""}" data-lcs="${esc(s.n)}" aria-pressed="${!EXCH.off[s.n]}"><i style="background:${s.c}"></i>${esc(s.n)}</button>`).join("")}</div>`;
}
function bindLineChart(m,series,keys,fmt,lbl){
  const svg=m.querySelector(".lcsvg"),hit=m.querySelector(".lchit"),tip=m.querySelector(".lctip"),ln=m.querySelector(".lcx");if(!svg||!keys.length)return;
  const S=series.filter(s=>!EXCH.off[s.n]);
  hit.onmousemove=e=>{const r=svg.getBoundingClientRect(),vx=(e.clientX-r.left)/r.width*720,i=Math.max(0,Math.min(keys.length-1,Math.round((vx-44)/((720-52)/Math.max(1,keys.length-1)))));const px=44+(keys.length<2?(720-52)/2:i*(720-52)/(keys.length-1));
    ln.setAttribute("x1",px);ln.setAttribute("x2",px);ln.setAttribute("visibility","visible");tip.hidden=false;tip.innerHTML=`<b>${lbl(keys[i])}</b>${S.map(s=>`<div><i style="background:${s.c}"></i>${esc(s.n)}<span class="numeric">${fmt(s.get(keys[i])||0)}</span></div>`).join("")}`;
    const tx=px/720*r.width;tip.style.left=Math.min(r.width-tip.offsetWidth-4,Math.max(4,tx+12))+"px"};
  hit.onmouseleave=()=>{tip.hidden=true;ln.setAttribute("visibility","hidden")};
  m.querySelectorAll("[data-lcs]").forEach(b=>b.onclick=()=>{EXCH.off[b.dataset.lcs]=!EXCH.off[b.dataset.lcs];renderMain()});
}
function execTodo(){
  const d=D(),today=d.settings.today,dep=id=>{const u=d.users.find(x=>x.id===id);return u?((d.departments||[]).find(p=>p.k===u.phongBan)||{}).n:""};
  const L=(typeof cvItems==="function"?cvGroup(cvItems()):[]).filter(x=>x.st!=="done");
  return {all:L,doing:L.filter(x=>x.st==="doing").length,late:L.filter(x=>x.late).length,top:L.slice().sort((a,b)=>(b.late-a.late)||(a.han-b.han)).slice(0,5).map(x=>({...x,lq:x.src==="card"?"Marketing":x.src==="order"?"Marketing · Digital":(dep(x.nguoi)||TEAMS[x.team]||"Chung"),hanTxt:x.han===today?"Hôm nay":x.han<today?`Trễ ${today-x.han} ngày`:`${String(x.han).padStart(2,"0")}/${String(MONTH.mon).padStart(2,"0")}`}))};
}
const EX_ST={late:["Quá hạn","red"],doing:["Đang làm","blu"],nhan:["Đã nhận việc","blu"],review:["Chờ duyệt","amb"],todo:["Cần làm","gry"],cg:["Chưa giao","gry"]};
function execStock(){
  if(typeof SX!=="function"||!SX()||typeof sxStock!=="function")return null;
  const s=SX(),td=sxToday(),inT=["Nhập kho","Bàn giao khu đóng đơn","Tồn đầu kỳ / điều chỉnh tăng"],nhap={},xuat={};
  s.moves.filter(mv=>String(mv.at||"").startsWith(td)).forEach(mv=>{if(inT.includes(mv.loai))nhap[mv.sp]=(nhap[mv.sp]||0)+mv.sl;else if(mv.loai==="Xuất / điều chỉnh")xuat[mv.sp]=(xuat[mv.sp]||0)+mv.sl});
  sxB2BOut().filter(x=>String(x.r.delivered_at||"").slice(0,10)===td).forEach(x=>{xuat[x.sp]=(xuat[x.sp]||0)+x.sl});
  return Object.values(sxStock()).map(o=>{const p=sxP(o.sp),min=+p.toiThieu||0,st=o.san<0?["Âm kho","red"]:min&&o.san<min?["Sắp hết","amb"]:o.dangLam||o.canLam?["Đang sản xuất","blu"]:["Đủ hàng","grn"];return {ten:p.ten,ton:o.san,nhap:nhap[o.sp]||0,xuat:xuat[o.sp]||0,st}})
    .filter(r=>r.ton||r.nhap||r.xuat).sort((a,b)=>(b.nhap+b.xuat)-(a.nhap+a.xuat)||b.ton-a.ton);
}
const exDot=c=>`<i class="sdot s-${c}" aria-hidden="true"></i>`;
const exChg=(a,b,inv)=>!b?`<span class="kchg">chưa có kỳ trước</span>`:`<span class="kchg ${(a>=b)!==!!inv?"up":"dn"}">${a>=b?"▲":"▼"} ${Math.abs((a-b)/b*100).toFixed(1).replace(".",",")}%</span>`;
function pExec(m){
  const N=execNums(PERIOD.from,PERIOD.to),pr=prevRange(),P=execNums(pr.from,pr.to),T=execTargets(),days=pDays().length,k=days/30,ok=allOK(N,P);
  const cl=execCost(N),cTot=sum(cl.flatMap(g=>g[1]),x=>x[1]),cTotP=sum(execCost(P).flatMap(g=>g[1]),x=>x[1]);
  const lr=[["Facebook",N.L.fb,N.fbGiao],["Shopee",N.L.spe,N.spDT],["TikTok Shop",N.L.tts,N.tt]],lTot=sum(lr.filter(x=>x[1]!=null),x=>x[1]),lTotP=sum([P.L.fb,P.L.spe,P.L.tts].filter(x=>x!=null),x=>x);
  const cOK=Object.keys(N.C).every(k=>!N.C[k]||P.C[k]),lOK=["fb","spe","tts"].every(k=>N.L[k]==null||P.L[k]!=null);
  const O=execOrders(PERIOD.from,PERIOD.to),OP=execOrders(pr.from,pr.to),oTot=O.tts+O.spe+O.fb,oTotP=OP.tts+OP.spe+OP.fb,TD=execTodo();
  const upd=D().updatedAt?new Date(D().updatedAt):new Date(),updS=upd.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric"})+" "+upd.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"});
  const K=[["money","Doanh số",tr(N.tong),ok?exChg(N.tong,P.tong):`<span class="kchg">so với kỳ trước: chưa đủ số</span>`,"bc_tong",""],["wallet","Chi phí",tr(cTot),ok&&cOK?exChg(cTot,cTotP,true):`<span class="kchg">${N.tong?pc(cTot,N.tong)+" doanh số":""}</span>`,"","cost"],["trend","Lợi nhuận",tr(lTot),ok&&lOK&&lTotP?exChg(lTot,lTotP):`<span class="kchg">biên ${pc(lTot,sum(lr.filter(x=>x[1]!=null),x=>x[2]))}</span>`,"pl",""],["cart","Đơn hàng",oTot?nf(oTot):"—",ok&&oTotP?exChg(oTot,oTotP):`<span class="kchg">TikTok · Shopee · Facebook</span>`,"bc_tong",""],["task","Việc đang làm",nf(TD.doing),`<span class="kchg">${nf(TD.all.length)} việc chưa xong</span>`,"cv_nv",""],["alert","Việc quá hạn",nf(TD.late),`<span class="kchg ${TD.late?"dn":""}">${TD.late?"cần xử lý ngay":"không có việc trễ"}</span>`,"cv_nv",""]];
  const CH=[{n:"Facebook",c:"#2f6fde",main:true,get:getD("fb",6),t:"fb"},{n:"TikTok Shop",c:"#e7357b",get:getD("tts",0),t:"tts"},{n:"Shopee",c:"#f59f00",get:getD("spe",0),t:"spe"},{n:"B2B / Đại lý",c:"#868e96",get:()=>0,t:"b2b"}];
  const shown=EXCH.tab==="all"?CH:CH.filter(s=>s.t===EXCH.tab),keys=pDays(),byM=keys.length>62;
  const ks=byM?[...new Set(keys.map(x=>x.slice(0,7)))]:keys,ser=shown.map(s=>({...s,get:byM?(mk=>sum(keys.filter(x=>x.startsWith(mk)),s.get)):s.get})),lbl=byM?(x=>x.slice(5)+"/"+x.slice(0,4)):(x=>x.slice(8)+"/"+x.slice(5,7));
  let lastI=-1;ks.forEach((x,i)=>{if(ser.some(s=>s.get(x)))lastI=i});const ksD=ks.slice(0,lastI+1),hasData=lastI>=0;
  const rowsCh=[["fb","Facebook",N.fbDT,P.fbDT,O.fb,C=>C.gvFB+C.adsFB,N.L.fb,"bc_fb"],["tts","TikTok Shop",N.tt,P.tt,O.tts,C=>C.adsTT+C.gvTT+C.phiTT+C.khacTT,N.L.tts,"bc_tiktok"],["spe","Shopee",N.spDT,P.spDT,O.spe,C=>C.adsSPE+C.gvSPE+C.phiSPE,N.L.spe,"bc_shopee"],["b2b","B2B / Đại lý",0,0,0,()=>0,null,"b2b_today"]];
  const ST=execStock(),al=execAlerts(),ap=execApprovals();
  const goals=[["Tổng doanh số",N.tong,T.tong],["TikTok Shop",N.tt,T.tts],["Shopee",N.spDT,T.spe],["Facebook (giao TC)",N.fbDT,T.fb],["Ads Facebook",N.adsDT,T.ads]];
  m.innerHTML=`<div class="xhead"><div class="xht"><h1>Trung tâm điều hành</h1><span>${esc(pLabel())}</span><span class="sep" aria-hidden="true"></span><span>so với ${vnd(pr.from)} – ${vnd(pr.to)}</span></div><div class="xupd">${ico("clock")} Cập nhật cuối: <span class="numeric">${updS}</span></div></div>
  <section class="kstrip" aria-label="Chỉ số chính">${K.map(([ic,l,v,h,go,act])=>`<button type="button" class="kcell" ${go?`data-go="${go}"`:""} ${act?`data-kact="${act}"`:""}><span class="kic k-${ic}">${ico(ic)}</span><span class="kl">${l}</span><span class="kv numeric">${v}</span>${h}</button>`).join("")}</section>
  <div class="xmain">
   <section class="card xchart"><div class="card-h"><h2>Doanh số theo kênh</h2><span class="hint">${byM?"theo tháng":"theo ngày"} · đơn vị: đồng</span></div>
    <div class="tabs xtabs" role="tablist">${[["all","Tất cả"],["fb","Facebook"],["tts","TikTok Shop"],["spe","Shopee"],["b2b","B2B / Đại lý"]].map(([k2,t])=>`<button role="tab" aria-selected="${EXCH.tab===k2}" class="${EXCH.tab===k2?"on":""}" data-xt="${k2}">${t}</button>`).join("")}</div>
    ${EXCH.tab==="b2b"?`<p class="empty xempty">Doanh số B2B chưa đưa vào biểu đồ: đơn đại lý đang nằm trong CRM B2B. <button class="lnk" data-go="b2b_today">Mở CRM B2B →</button></p>`:hasData?lineChart(ser,ksD,tr,lbl):`<p class="empty xempty">Kỳ đã chọn chưa có số doanh thu. Thử chọn tháng 7, 8 hoặc 9/2026 ở ô chọn kỳ phía trên.</p>`}</section>
   <section class="card xtodo"><div class="card-h"><h2>Việc cần xử lý</h2><button class="lnk" data-go="cv_nv">Xem tất cả →</button></div>
    ${TD.top.length?`<div class="tbl"><table><thead><tr><th>Nội dung công việc</th><th>Hạn</th><th>Trạng thái</th></tr></thead><tbody>${TD.top.map(x=>{const s=x.late?EX_ST.late:(EX_ST[x.st]||[x.st,"gry"]);return `<tr><td><div class="xtn">${exDot(s[1])}<div class="xtc"><span>${esc(x.ten||"")}</span><small>${esc(x.sub||x.lq)}</small></div></div></td><td class="${x.late?"t-red":""} xst">${x.hanTxt}</td><td class="xst">${pill(s[0],s[1])}</td></tr>`}).join("")}</tbody></table></div>`:`<p class="empty">Không có việc đang mở.</p>`}</section>
  </div>
  <div class="xbot">
   <section class="card"><div class="card-h"><h2>Hiệu quả theo kênh</h2><span class="hint">lợi nhuận chưa trừ lương, kho, chi phí chung</span></div>
    <div class="tbl"><table><thead><tr><th>Kênh</th><th class="n">Doanh số</th><th class="n">Đơn hàng</th><th class="n">Chi phí</th><th class="n">Lợi nhuận</th><th class="n">Tỷ lệ LN</th><th class="n">So kỳ trước</th></tr></thead><tbody>
    ${rowsCh.map(([t,n,v,pv,o,cf,l,go])=>{const c=cf(N.C);return `<tr class="clk" data-go="${go}"><td><b>${n}</b></td><td class="n">${v?tr(v):"—"}</td><td class="n">${o?nf(o):"—"}</td><td class="n">${c?tr(c):"—"}</td><td class="n ${l<0?"t-red":""}">${l==null?"—":tr(l)}</td><td class="n">${l!=null&&v?pc(l,v):"—"}</td><td class="n">${v&&symOK(N,P,t)?exChg(v,pv):"—"}</td></tr>`}).join("")}
    <tr class="tot"><td>Tổng cộng</td><td class="n">${tr(N.tong)}</td><td class="n">${oTot?nf(oTot):"—"}</td><td class="n">${tr(cTot)}</td><td class="n">${tr(lTot)}</td><td class="n">${N.tong?pc(lTot,N.tong):"—"}</td><td class="n">${ok?exChg(N.tong,P.tong):"—"}</td></tr></tbody></table></div></section>
   <section class="card"><div class="card-h"><h2>Sản xuất & kho (hôm nay)</h2><button class="lnk" data-go="sx_kho">Xem tất cả →</button></div>
    ${ST&&ST.length?`<div class="tbl"><table><thead><tr><th>Sản phẩm</th><th class="n">Tồn kho</th><th class="n">Nhập</th><th class="n">Xuất</th><th>Trạng thái</th></tr></thead><tbody>${ST.slice(0,6).map(r=>`<tr><td>${esc(r.ten)}</td><td class="n ${r.ton<0?"t-red":""}">${nf(r.ton)}</td><td class="n">${nf(r.nhap)}</td><td class="n">${nf(r.xuat)}</td><td class="xst">${exDot(r.st[1])}${r.st[0]}</td></tr>`).join("")}</tbody></table></div>`:`<p class="empty">Chưa có số tồn kho thành phẩm. Kế toán nhập tồn đầu kỳ ở Sản xuất & kho.</p>`}</section>
  </div>
  <div class="xgrid3">
   <section class="card"><div class="card-h"><h2>% Đạt mục tiêu</h2><button class="lnk" id="tg-ed">Sửa mục tiêu</button></div><p class="hint">Mục tiêu tháng quy theo ${days} ngày đã chọn</p>
    <div class="gl">${goals.map(([n,v,t])=>{const tg=t*k,p=tg?v/tg*100:0;return `<div class="gi"><div class="gt"><b>${n}</b><span class="numeric">${t?`${tr(v)} / ${tr(tg)}`:"chưa đặt mục tiêu"}</span></div>${t?`<div class="gb"><i style="width:${Math.min(100,p)}%;background:${p>=100?"#2f9e44":p>=80?"#f59f00":"#e03131"}"></i></div><b class="gp numeric ${p>=100?"t-grn":p<80?"t-red":""}">${Math.round(p)}%</b>`:""}</div>`}).join("")}</div></section>
   <section class="card"><div class="card-h"><h2>Cảnh báo điều hành</h2>${pill(al.length,"red")}</div><div class="xal">${al.map(a=>`<button class="xa ${a[0]}" data-go="${a[3]}"><b>${esc(a[1])}</b><span>${esc(a[2])} ${typeof botChip==="function"?botChip(PAGE_PB[a[3]]||"BDH"):""}</span></button>`).join("")||`<p class="empty">Không có cảnh báo.</p>`}</div></section>
   <section class="card"><div class="card-h"><h2>Việc chờ CEO duyệt</h2>${pill(ap.length,"amb")}</div><div class="xap">${ap.map(a=>`<div><div><b>${esc(a[0])}</b><span>${esc(a[1])}</span></div><button class="btn sm pri" data-go="${a[2]}">Xem & duyệt</button></div>`).join("")||`<p class="empty">Không có việc chờ duyệt.</p>`}</div></section>
  </div>`;
  m.querySelectorAll("[data-xt]").forEach(b=>b.onclick=()=>{EXCH.tab=b.dataset.xt;renderMain()});
  if(m.querySelector(".lcsvg"))bindLineChart(m,ser,ksD,tr,lbl);
  const cb=m.querySelector('[data-kact="cost"]');if(cb)cb.onclick=()=>openDrawerHTML(`<h2>Chi phí trong kỳ</h2><p class="hint">${esc(pLabel())} · tổng ${tr(cTot)}${N.tong?" · "+pc(cTot,N.tong)+" doanh số":""}</p>${cl.map(([g,L])=>`<h3>${g}</h3>${tbl(["Khoản","Số tiền","% doanh số"],L.map(x=>`<tr><td>${x[0]}</td><td class="n">${tr(x[1])}</td><td class="n">${pc(x[1],N.tong)}</td></tr>`))}`).join("")||`<p class="empty">Chưa có chi phí trong kỳ.</p>`}${!N.tFull&&N.tt?`<p class="hint">Giá vốn, phí sàn TikTok chỉ có theo tháng: chọn cả tháng để thấy đủ.</p>`:""}`);
  $("#tg-ed").onclick=()=>{const t=execTargets();openDrawerHTML(`<h2>Mục tiêu doanh số theo tháng</h2><form class="frm" id="tgf">${[["tong","Tổng doanh số"],["tts","TikTok Shop (GMV)"],["spe","Shopee"],["fb","Facebook (giao thành công)"],["ads","Ads Facebook (KPI doanh số đơn chốt)"]].map(([k2,l])=>`<label class="field">${l} (đ/tháng)<input type="number" min="0" id="tg-${k2}" value="${t[k2]||0}"></label>`).join("")}<p class="hint">Để 0 nếu chưa đặt.</p><button class="btn pri">Lưu</button></form>`);$("#tgf").onsubmit=e=>{e.preventDefault();DB.mutate(ME.name,"sửa mục tiêu doanh số",dt=>{execTargets();["tong","tts","spe","fb","ads"].forEach(k2=>dt.targets[k2]=+$("#tg-"+k2).value||0)});closeDrawer();renderMain()}};
}
const d_late=()=>D().cards.filter(isLate).length;
function pSX(m){m.innerHTML=H("Sản xuất","2 nhà máy Thanh Oai · 9 nhân sự")+needFile("Sản xuất & kho","Cần file kế hoạch sản xuất, tồn kho và giá thành theo tháng (kế toán đang có file giá thành tháng 8). Trang này sẽ cho thấy tiến độ sản xuất theo đơn, tồn kho từng mã, và cảnh báo hết hàng cho kênh bán.")}
function quickSearch(q){q=q.toLowerCase().trim();if(!q)return [];const out=[];visibleMods().forEach(mo=>modGroups(mo).forEach(([g,its])=>its.forEach(i=>{if((i[1]+" "+g+" "+mo.n).toLowerCase().includes(q))out.push([i[0],i[1],mo.n+" › "+g])})));const d=D();d.cards.filter(c=>(c.id+" "+(c.hookText||"")+" "+(c.yTuong||"")).toLowerCase().includes(q)).slice(0,5).forEach(c=>out.push(["#card:"+c.id,c.id+" · "+(c.hookText||c.yTuong||""),"Thẻ video"]));if(d.b2b)d.b2b.customers.filter(c=>c.ten.toLowerCase().includes(q)).slice(0,5).forEach(c=>out.push(["#kh:"+c.id,c.ten,"Khách B2B"]));return out.slice(0,12)}
Object.assign(PAGES,{exec:pExec,sx:pSX});
