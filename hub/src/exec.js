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
  const d=D(),L=[];const st=d.plan.steps||{};Object.entries(st).filter(([n,v])=>v&&v.s==="review").forEach(([n])=>L.push([`Kế hoạch tháng ${MONTH.mon} · bước ${n}`,"Marketing · Oanh gửi","kehoach"]));
  const kb=d.cards.filter(c=>c.step==="dkb").length,vd=d.cards.filter(c=>c.step==="dvd").length;if(kb)L.push([`${kb} kịch bản chờ duyệt`,"Marketing · Content","cv"]);if(vd)L.push([`${vd} video chờ duyệt (CEO check)`,"Marketing · Content","cv"]);
  const dcp=(d.adjusts||[]).filter(a=>a.st==="pending").length;if(dcp)L.push([`${dcp} phiếu điều chỉnh kế hoạch chờ duyệt`,"Marketing · Oanh / trợ lý AI đề xuất","dieuchinh"]);
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
function pExec(m){
  const N=execNums(PERIOD.from,PERIOD.to),pr=prevRange(),P=execNums(pr.from,pr.to),T=execTargets(),days=pDays().length,k=days/30;
  const ch=[["TikTok Shop","GMV cả shop",N.tt,P.tt,"#e7357b","bc_tiktok","tts"],["Shopee 2 shop","doanh thu, đã trừ hủy/hoàn",N.spDT,P.spDT,"#f59f00","bc_shopee","spe"],["Facebook","doanh thu chốt (Pancake)",N.fbDT,P.fbDT,"#3b5bdb","bc_fb","fb"],["B2B / Đại lý","CRM","","","#868e96","b2b_tq",""]];
  const C=N.C,cl=[["Quảng cáo",[["Ads Facebook (sau thuế)",C.adsFB],["Ads TikTok (gồm thuế)",C.adsTT],["Shopee Ads",C.adsSPE]]],["Giá vốn",[["Facebook (đơn giao TC)",C.gvFB],["Shopee",C.gvSPE],["TikTok",C.gvTT]]],["Phí sàn",[["Shopee",C.phiSPE],["TikTok",C.phiTT]]],["Khác",[["TikTok: agency, KOC, live",C.khacTT]]]].map(([g,L])=>[g,L.filter(x=>x[1])]).filter(g=>g[1].length);
  const cTot=sum(cl.flatMap(g=>g[1]),x=>x[1]);
  const lr=[["Facebook","đơn giao TC − giá vốn − Ads sau thuế, chưa trừ vận chuyển",N.L.fb,N.fbGiao],["Shopee","sau giá vốn, phí sàn"+(N.sFull?", Shopee Ads":""),N.L.spe,N.spDT],["TikTok Shop","lãi đóng góp kênh (chỉ có theo tháng)",N.L.tts,N.tt]];
  const lTot=sum(lr.filter(x=>x[2]!=null),x=>x[2]),lDT=sum(lr.filter(x=>x[2]!=null),x=>x[3]);
  const goals=[["Tổng doanh số",N.tong,T.tong],["TikTok Shop",N.tt,T.tts],["Shopee",N.spDT,T.spe],["Facebook (giao TC)",N.fbDT,T.fb],["Ads Facebook (KPI doanh số)",N.adsDT,T.ads]];
  const bar=(v,mx,c)=>`<i class="sbar"><b style="width:${mx?Math.min(100,v/mx*100):0}%;background:${c}"></b></i>`;
  const al=execAlerts(),ap=execApprovals();
  m.innerHTML=`<div class="ph"><h1>Trung tâm điều hành</h1><div class="ph-sub">${esc(pLabel())} · so với ${vnd(pr.from).slice(0,5)}–${vnd(pr.to)}</div></div>
  <div class="eb3">
   <section class="card eb t-pnk"><div class="ebh"><span class="ki">${ico("money")}</span><h2>Doanh số</h2><button class="lnk" data-go="bc_tong">Chi tiết →</button></div>
    <div class="big">${tr(N.tong)} ${allOK(N,P)?chg(N.tong,P.tong):""}</div><div class="hint">tổng các kênh đã có số trong kỳ</div>
    <div class="ebl">${ch.map(c=>`<button class="ebr" data-go="${c[5]}"><span class="dt" style="background:${c[4]}"></span><span class="nm"><b>${c[0]}</b><small>${c[1]}${c[6]?" · "+covTxt(c[6]):""}</small></span><span class="vl"><b>${c[2]===""?"—":tr(c[2])}</b>${c[2]!==""&&N.tong?`<small>${pc(c[2],N.tong)} · ${symOK(N,P,c[6])?chg(c[2],c[3]):"kỳ trước chưa đủ số"}</small>`:""}</span>${bar(c[2]||0,N.tong,c[4])}</button>`).join("")}
    <div class="ebr sub"><span class="dt"></span><span class="nm"><b>trong đó Ads Facebook mang về</b><small>đơn chốt, đã nằm trong Facebook</small></span><span class="vl"><b>${tr(N.adsDT)}</b></span></div></div></section>
   <section class="card eb t-org"><div class="ebh"><span class="ki">${ico("wallet")}</span><h2>Chi phí</h2></div><div class="big">${tr(cTot)}</div><div class="hint">${N.tong?pc(cTot,N.tong)+" doanh số":""}</div>
    <div class="ebl">${cl.map(([g,L])=>`<div class="ebg">${g}</div>${L.map(x=>`<div class="ebr"><span class="nm">${x[0]}</span><span class="vl"><b>${tr(x[1])}</b><small>${pc(x[1],N.tong)}</small></span></div>`).join("")}`).join("")||`<p class="empty">Chưa có chi phí trong kỳ.</p>`}</div>
    ${!N.tFull&&N.tt?`<p class="hint">Giá vốn, phí sàn TikTok chỉ có theo tháng: chọn cả tháng 7 để thấy đủ.</p>`:""}</section>
   <section class="card eb t-grn"><div class="ebh"><span class="ki">${ico("trend")}</span><h2>Lợi nhuận</h2><button class="lnk" data-go="pl">P&L →</button></div><div class="big">${tr(lTot)}</div><div class="hint">biên ${pc(lTot,lDT)} · mục tiêu 18,5%</div>
    <div class="ebl">${lr.map(x=>`<div class="ebr"><span class="nm"><b>${x[0]}</b><small>${x[1]}</small></span><span class="vl"><b class="${x[2]<0?"t-red":""}">${x[2]==null?"—":tr(x[2])}</b>${x[2]!=null?`<small>biên ${pc(x[2],x[3])}</small>`:""}</span></div>`).join("")}</div><p class="hint">Chưa trừ lương, kho, chi phí chung (xem P&L).</p></section>
  </div>
  <div class="eb2">
   <section class="card eb t-blu"><div class="ebh"><span class="ki">${ico("chart")}</span><h2>Xu hướng</h2><span class="hint">so với ${pr.n} ngày liền trước</span></div>
    <div class="trs">${[["Tổng doanh số",N.tong,P.tong,"all"],["TikTok",N.tt,P.tt,"tts"],["Shopee",N.spDT,P.spDT,"spe"],["Facebook",N.fbDT,P.fbDT,"fb"],["Ads FB doanh số",N.adsDT,P.adsDT,"ads"],["Chi Ads FB",C.adsFB,P.C.adsFB,"ads"]].map(x=>{const ok=x[3]==="all"?allOK(N,P):symOK(N,P,x[3]);return `<div><span>${x[0]}</span><b>${x[1]?tr(x[1]):"—"}</b>${ok&&x[2]?chg(x[1],x[2]):`<small class="hint">${x[1]?"kỳ trước chưa đủ số để so":"chưa có số"}</small>`}</div>`}).join("")}</div>
    ${seriesBars([{n:"TikTok GMV",c:"#e7357b",get:getD("tts",0)},{n:"Shopee",c:"#f59f00",get:getD("spe",0)},{n:"Facebook doanh thu chốt",c:"#3b5bdb",get:getD("fb",6)},{n:"Ads FB đơn chốt",c:"#14213d",get:getAds(3)}])}</section>
   <section class="card eb t-teal"><div class="ebh"><span class="ki">${ico("pct")}</span><h2>% Đạt mục tiêu</h2><button class="lnk" id="tg-ed">Sửa mục tiêu</button></div><p class="hint">Mục tiêu tháng quy theo ${days} ngày đã chọn</p>
    <div class="gl">${goals.map(([n,v,t])=>{const tg=t*k,p=tg?v/tg*100:0;return `<div class="gi"><div class="gt"><b>${n}</b><span>${t?`${tr(v)} / ${tr(tg)}`:"chưa đặt mục tiêu"}</span></div>${t?`<div class="gb"><i style="width:${Math.min(100,p)}%;background:${p>=100?"#2f9e44":p>=80?"#f59f00":"#e03131"}"></i></div><b class="gp ${p>=100?"t-grn":p<80?"t-red":""}">${Math.round(p)}%</b>`:""}</div>`}).join("")}</div></section>
  </div>
  <div class="xgrid3"><section class="card"><div class="card-h"><h2>Sức khỏe vận hành</h2></div><div class="xmini">${[["Tỷ lệ chốt đơn Facebook",pc(pSum("fb",1).v,pSum("fb",0).v),"ngưỡng tốt 80%"],["Tỷ lệ hủy Facebook",pc(pSum("fb",2).v,pSum("fb",0).v),"cảnh báo trên 20%"],["Chi QC sau thuế / doanh thu chốt FB",pc(C.adsFB,N.fbDT),"mục tiêu ≤ 35%"],["Công nợ B2B chính thức",tr(CRM_BASE.noChinhThuc),"mốc đối soát CRM"],["Việc trễ hạn",d_late(),"thẻ video Marketing"],["Việc chờ duyệt",ap.length,"đang chờ chị"]].map(x=>`<div><div class="l">${x[0]}</div><div class="v">${x[1]}</div><div class="h">${x[2]}</div></div>`).join("")}</div></section>
  <section class="card"><div class="card-h"><h2>Cảnh báo điều hành</h2>${pill(al.length,"red")}</div><div class="xal">${al.map(a=>`<button class="xa ${a[0]}" data-go="${a[3]}"><b>${esc(a[1])}</b><span>${esc(a[2])} ${typeof botChip==="function"?botChip(PAGE_PB[a[3]]||"BDH"):""}</span></button>`).join("")||`<p class="empty">Không có cảnh báo.</p>`}</div></section>
  <section class="card"><div class="card-h"><h2>Việc chờ chị duyệt</h2>${pill(ap.length,"amb")}</div><div class="xap">${ap.map(a=>`<div><div><b>${esc(a[0])}</b><span>${esc(a[1])}</span></div><button class="btn sm pri" data-go="${a[2]}">Xem & duyệt</button></div>`).join("")||`<p class="empty">Không có việc chờ duyệt.</p>`}</div></section></div>`;
  $("#tg-ed").onclick=()=>{const t=execTargets();openDrawerHTML(`<h2>Mục tiêu doanh số theo tháng</h2><form class="frm" id="tgf">${[["tong","Tổng doanh số"],["tts","TikTok Shop (GMV)"],["spe","Shopee"],["fb","Facebook (giao thành công)"],["ads","Ads Facebook (KPI doanh số đơn chốt)"]].map(([k2,l])=>`<label class="field">${l} (đ/tháng)<input type="number" min="0" id="tg-${k2}" value="${t[k2]||0}"></label>`).join("")}<p class="hint">Để 0 nếu chưa đặt. Ads Facebook đang lấy theo KPI giao 3 bạn (720 + 170 + 170 triệu).</p><button class="btn pri">Lưu</button></form>`);$("#tgf").onsubmit=e=>{e.preventDefault();DB.mutate(ME.name,"sửa mục tiêu doanh số",dt=>{execTargets();["tong","tts","spe","fb","ads"].forEach(k2=>dt.targets[k2]=+$("#tg-"+k2).value||0)});closeDrawer();renderMain()}};
}
const d_late=()=>D().cards.filter(isLate).length;
function pSX(m){m.innerHTML=H("Sản xuất","2 nhà máy Thanh Oai · 9 nhân sự")+needFile("Sản xuất & kho","Cần file kế hoạch sản xuất, tồn kho và giá thành theo tháng (kế toán đang có file giá thành tháng 8). Trang này sẽ cho thấy tiến độ sản xuất theo đơn, tồn kho từng mã, và cảnh báo hết hàng cho kênh bán.")}
function quickSearch(q){q=q.toLowerCase().trim();if(!q)return [];const out=[];visibleMods().forEach(mo=>modGroups(mo).forEach(([g,its])=>its.forEach(i=>{if((i[1]+" "+g+" "+mo.n).toLowerCase().includes(q))out.push([i[0],i[1],mo.n+" › "+g])})));const d=D();d.cards.filter(c=>(c.id+" "+(c.hookText||"")+" "+(c.yTuong||"")).toLowerCase().includes(q)).slice(0,5).forEach(c=>out.push(["#card:"+c.id,c.id+" · "+(c.hookText||c.yTuong||""),"Thẻ video"]));if(d.b2b)d.b2b.customers.filter(c=>c.ten.toLowerCase().includes(q)).slice(0,5).forEach(c=>out.push(["#kh:"+c.id,c.ten,"Khách B2B"]));return out.slice(0,12)}
Object.assign(PAGES,{exec:pExec,sx:pSX});
