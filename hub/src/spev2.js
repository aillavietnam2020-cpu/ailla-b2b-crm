/* =====================================================================
   TRANG SHOPEE BẢN MỚI (chị Hoa duyệt demo 28/10/2026, cùng khung trang TikTok bản mới tiktokv2.js).
   Đè lên PAGES.bc_shopee của shopee.js; giữ nguyên cách tải file / lưu (speUpCard, speSumCard ở trang con "Tải file").
   - Quản trị: chọn Cả 2 shop / từng shop; 6 ô số; so sánh 2 shop; cơ cấu doanh thu (theo shop, tiếp thị liên kết);
     cơ cấu chi phí (bấm phí sàn / chi riêng / chi chung để xổ); top sản phẩm gộp 2 shop; cột phải cảnh báo & đề xuất tuần / tháng.
   - Vận hành: doanh thu, đơn, món, quảng cáo, ROI, hủy/hoàn; việc tuần này; 4 thẻ (Quảng cáo, Tiếp thị liên kết,
     Đơn hàng & CSKH, Doanh thu theo tuần); top sản phẩm kèm mức ưu tiên quảng cáo, không có lãi (số từ /api/hub/shopee/ops).
   Hàm tính ở spebc.js. Chi riêng / chi chung đọc từ Sổ chi phí (kênh "Shopee Mall", "Shopee thường"), không sửa ở đây.
   Dùng chung CSS tb-* của tiktokv2.js.
   ===================================================================== */
const SPB={shop:"all",al:"tuan",ky:"",rows:{},busy:{},ops:{},opsBusy:{}};
const spbShops=()=>SPB.shop==="all"?speShopsAll():[SPB.shop];
const spbAdsMax=()=>typeof scQcMax==="function"?scQcMax():0.38;
const spbChips=()=>`<button class="chip${SPB.shop==="all"?" on":""}" data-spbshop="all">Cả ${speShopsAll().length} shop</button>${speShopsAll().map(s=>`<button class="chip${SPB.shop===s?" on":""}" data-spbshop="${esc(s)}">${esc(speShopL(s))}</button>`).join("")}`;

async function spbLoadRows(ky,shop){const k=ky+"|"+shop;if(SPB.rows[k]!==undefined||SPB.busy[k])return;SPB.busy[k]=1;
  try{const r=await speApi(`/month/${ky}/${encodeURIComponent(shop)}`);SPB.rows[k]=r&&r.data?r.data.rows||[]:null}catch(e){SPB.rows[k]=null}
  SPB.busy[k]=0;if(PAGE==="bc_shopee")renderMain()}

/* Chi riêng khác (bổ thẳng cho kênh Shopee, trừ quảng cáo / phí sàn / vận chuyển đã có trong báo cáo sàn) và chi chung đã chia. */
function spbSoCP(ky,shops){return bcSoCP(ky,shops.map(s=>SPE_BC_KENH[s]).filter(Boolean),"Shopee")}
/* Dùng chung cho trang kênh (Shopee, Facebook): K = tên kênh ở Sổ chi phí, ten = tên hiện trong câu báo thiếu số. */
function bcSoCP(ky,K,ten){
  const out={rieng:null,chung:null,whyR:"",whyC:""};
  if(typeof scPBRows!=="function"){out.whyR=out.whyC="Sổ chi phí chưa nạp";return out}
  const keep={from:PERIOD.from,to:PERIOD.to};
  try{PERIOD.from=ky+"-01";PERIOD.to=tbKyEnd(ky);if(typeof scNap==="function")scNap();
    const rows=scPBRows(),by=(L,f)=>{const o={};L.forEach(x=>{const n=f(x);o[n]=(o[n]||0)+(+x.t||0)});return Object.entries(o).filter(e=>Math.round(e[1])).map(([n,t])=>({n,t})).sort((a,b)=>b.t-a.t)};
    const tru=typeof SC_PL_TRU!=="undefined"?SC_PL_TRU:[];
    out.rieng=by(rows.filter(x=>K.includes(x.k)&&x.st!=="Chờ duyệt"&&!tru.includes(x.g)&&!/^H/.test(String(scG(x.g).lo||""))),x=>scG(x.g).n);
    if(!out.rieng.length){out.rieng=null;out.whyR="Sổ chi phí tháng này chưa ghi khoản nào cho "+ten}
    if(typeof scChiaPB==="function"){const CH=scChiaPB(rows);
      if(CH.loi&&CH.loi.length)out.whyC="Chi chung chưa chia: "+CH.loi.join("; ");
      else{const o={};K.forEach(k=>Object.entries((CH.kenh||{})[k]||{}).forEach(([g,t])=>{o[g]=(o[g]||0)+t}));
        out.chung=Object.entries(o).map(([g,t])=>({n:scG(g).n,t})).filter(x=>Math.round(x.t)).sort((a,b)=>b.t-a.t);
        if(!out.chung.length){out.chung=null;out.whyC="Sổ chi phí tháng này chưa có chi chung chia cho "+ten}}}
    else out.whyC="Chưa có quy tắc chia chi chung";
  }catch(e){out.rieng=null;out.chung=null;out.whyR=out.whyC="Không đọc được Sổ chi phí"}
  finally{PERIOD.from=keep.from;PERIOD.to=keep.to}
  return out;
}

/* ---------- Quản trị ---------- */
function spbCost(M,so){
  const dt=M.dt,sum=a=>(a||[]).reduce((s,x)=>s+(+x.t||0),0),R=so.rieng?sum(so.rieng):null,C=so.chung?sum(so.chung):null,ln=R!=null&&C!=null?M.lai-R-C:null;
  const bar=[["Giá vốn",M.gv,"#8a8799"],["Phí sàn",M.phi,"#e07a3f"],["Quảng cáo",M.ads,"#e2494a"]].concat(R?[["Chi riêng",R,"#b06ab3"]]:[]).concat(C?[["Chi chung",C,"#5d6d8e"]]:[]).concat([[ln!=null?"Lợi nhuận ròng":"Lãi đóng góp",ln!=null?ln:M.lai,"#17804a"]]);
  const row=(k,c,n,t,h,sub)=>{const has=sub&&sub.length;
    return `<tr class="${has?"tb-tg":""}" ${has?`data-tbtg="${k}"`:""}><td>${has?`<span class="tb-car" data-car="${k}">▸</span>`:`<span class="tb-car"></span>`}<span class="tb-dot" style="background:${c}"></span>${has?`<b>${esc(n)}</b>`:esc(n)}</td><td class="n">${t==null?`<span class="hint">chưa có số</span>`:tbF(t)}</td><td class="n">${t==null?"":tbP(t,dt)}</td><td class="hint">${esc(h||"")}</td></tr>`
     +(has?sub.map(x=>`<tr class="tb-sub" data-tbs="${k}" style="display:none"><td>${esc(x.n)}</td><td class="n">${tbF(x.t)}</td><td class="n">${tbP(x.t,dt)}</td><td></td></tr>`).join(""):"")};
  const sh=M.shops.length>1?" · "+M.shops.map(s=>speShopL(s.shop)+" "+tr(s.ads)).join(" · "):"";
  return {ln,html:`<section class="card"><div class="card-h"><h2>Cơ cấu chi phí</h2><span class="hint">mọi khoản chi của kênh trên doanh thu thực ${tbF(dt)} đ</span></div>
   <div class="tb-bar">${bar.filter(b=>b[1]>0).map(([n,t,c])=>{const ty=dt?t/dt:0;return `<div style="width:${(ty*100).toFixed(2)}%;background:${c}" title="${esc(n)} ${tbF(t)}">${ty>=0.06?esc(n)+" "+tbP(t,dt):tbP(t,dt)}</div>`}).join("")}</div>
   ${tbl(["Khoản","Số tiền (đ)","% doanh thu","Ghi chú"],[
     row("gv","#8a8799","Giá vốn hàng bán",M.gv,M.dtUocGv?tbP(M.dtUocGv,dt)+" doanh thu đang ước giá vốn (chưa khai Quy đổi mã kênh Shopee)":"theo Quy đổi mã các sàn và Giá vốn SKU"),
     row("phi","#e07a3f","Phí sàn Shopee",M.phi,"bấm để xem từng loại phí",M.fees),
     row("ads","#e2494a","Quảng cáo Shopee (Dịch vụ Hiển thị)",M.ads,"đã bỏ tiền nạp ví"+sh),
     `<tr class="tb-sum"><td>Lãi đóng góp kênh</td><td class="n">${tbF(M.lai)}</td><td class="n">${tbP(M.lai,dt)}</td><td class="hint">trước chi riêng khác và chi chung</td></tr>`,
     row("rieng","#b06ab3","Chi phí riêng khác của kênh",R,so.rieng?"bấm để xem từng khoản · Sổ chi phí":so.whyR,so.rieng),
     row("chung","#5d6d8e","Chi phí chung phân bổ",C,so.chung?"bấm để xem · theo Quy tắc phân bổ ở Sổ chi phí":so.whyC,so.chung),
     `<tr class="tb-sum"><td>Lợi nhuận ròng kênh</td><td class="n">${ln==null?`<span class="hint">chưa có số</span>`:tbF(ln)}</td><td class="n">${ln==null?"":tbP(ln,dt)}</td><td class="hint">sau khi gánh hết chi phí riêng và chi chung</td></tr>`])}</section>`};
}

function spbAdmBody(ky){
  const shops=spbShops(),sums=(SPE.sums||[]).filter(s=>s.ky===ky&&shops.includes(s.shop)),miss=shops.filter(s=>!sums.some(x=>x.shop===s));
  sums.forEach(s=>spbLoadRows(ky,s.shop));
  const M=speBcMonth(sums.map(s=>({s,rows:SPB.rows[ky+"|"+s.shop]||null}))),dt=M.dt,adsMax=spbAdsMax(),so=spbSoCP(ky,sums.map(s=>s.shop)),CO=spbCost(M,so);
  const W=speBcWeeks(sums,ky),last2=speBcLast2(W),L=speShopL;
  const AL=SPB.al==="tuan"?speBcAlerts({last2,label:L}):speBcAlerts({M,miss,adsMax,label:L});
  const kp=`<div class="grid kpis">${kpi("Doanh thu thực",tr(dt),nf(M.don)+" đơn · TB "+tr(M.aov)+"/đơn")}${kpi("Giá vốn",tr(M.gv),tbP(M.gv,dt)+" doanh thu"+(M.dtUocGv?" · "+tbP(M.dtUocGv,dt)+" đang ước":""))}${kpi("Phí sàn",tr(M.phi),tbP(M.phi,dt)+" doanh thu")}${kpi("Quảng cáo Shopee",tr(M.ads),tbP(M.ads,dt)+" · ngưỡng "+tbP(adsMax,1))}${kpi("Lãi đóng góp kênh",tr(M.lai),tbP(M.lai,dt)+" · trước chi chung","var(--green)")}${kpi("Lợi nhuận ròng kênh",CO.ln==null?"—":tr(CO.ln),CO.ln==null?"chờ Sổ chi phí đủ số":tbP(CO.ln,dt)+" · sau phân bổ chi chung","var(--green)")}</div>`;
  const ss=M.shops.length>1||miss.length?`<section class="card"><div class="card-h"><h2>So sánh ${shops.length} shop</h2><span class="hint">bấm tên shop ở trên để xem riêng từng shop</span></div>
   ${tbl(["Shop","Doanh thu thực","Đơn","Phí sàn","Quảng cáo","ROI quảng cáo","Hủy / hoàn","Lãi đóng góp"],M.shops.map(s=>`<tr><td><b>${esc(L(s.shop))}</b>${s.den?`<br><small class="hint">số đến ${speVn(s.den)}</small>`:""}</td><td class="n">${tr(s.dt)}</td><td class="n">${nf(s.don)}</td><td class="n">${tr(s.phi)} · ${tbP(s.phi,s.dt)}</td><td class="n">${tr(s.ads)} · ${tbP(s.ads,s.dt)}</td><td class="n">${tbX(s.roi)}</td><td class="n${s.hhRate>0.15?" t-red":""}">${tbP(s.hhRate,1)}</td><td class="n${s.lai<0?" t-red":""}">${tr(s.lai)} · ${tbP(s.lai,s.dt)}</td></tr>`)
     .concat(miss.map(s=>`<tr><td><b>${esc(L(s))}</b></td><td colspan="7" class="hint">Chưa có báo cáo tháng này. Bấm Tải file hoặc chờ agent nạp.</td></tr>`))
     .concat(M.shops.length>1?[`<tr class="tb-sum"><td>Cộng</td><td class="n">${tr(dt)}</td><td class="n">${nf(M.don)}</td><td class="n">${tr(M.phi)} · ${tbP(M.phi,dt)}</td><td class="n">${tr(M.ads)} · ${tbP(M.ads,dt)}</td><td class="n">${tbX(M.roi)}</td><td class="n">${tbP(M.hhRate,1)}</td><td class="n">${tr(M.lai)} · ${tbP(M.lai,dt)}</td></tr>`]:[]))}</section>`:"";
  const col=["#ee4d2d","#f6a04d","#c0392b","#ffb199"],seg=[];M.shops.forEach((s,i)=>{if(s.koc)seg.push({n:"Tiếp thị liên kết (KOC) · "+L(s.shop),v:s.koc,c:col[(i*2+1)%4],cp:s.aff?tr(s.aff)+" hoa hồng · "+tbP(s.aff,s.koc):"không có"});seg.push({n:(s.koc?"Quảng cáo + tự nhiên · ":"Cả shop · ")+L(s.shop),v:s.dt-s.koc,c:col[(i*2)%4],cp:tr(s.ads)+" quảng cáo"})});
  let acc=0;const cg=seg.map(x=>{const a=acc;acc+=dt?x.v/dt*100:0;return `${x.c} ${a}% ${acc}%`}).join(","),mx=Math.max(1,...seg.map(x=>x.v));
  const co=`<section class="card"><div class="card-h"><h2>Cơ cấu doanh thu</h2><span class="hint">Shopee không chia doanh thu theo video / live như TikTok: chia theo shop và tiếp thị liên kết (đơn có hoa hồng KOC)</span></div>
   <div class="tb-co"><div class="tb-donut" style="background:conic-gradient(${cg||"#eee 0 100%"})"><div class="ct">Doanh thu<b>${tr(dt)}</b></div></div>
   <table class="tb-src"><colgroup><col style="width:40%"><col style="width:15%"><col style="width:20%"><col style="width:25%"></colgroup>
   <thead><tr><th>Nguồn</th><th class="n">Doanh thu</th><th>Tỷ trọng</th><th>Chi phí riêng</th></tr></thead><tbody>
   ${seg.map(x=>`<tr><td><span class="tb-dot" style="background:${x.c}"></span><b>${esc(x.n)}</b></td><td class="n">${tr(x.v)}</td><td><div class="tb-mini"><i style="width:${(x.v/mx*100).toFixed(1)}%;background:${x.c}"></i></div><b>${tbP(x.v,dt)}</b></td><td>${x.cp}</td></tr>`).join("")}
   ${M.vou?`<tr class="tb-adsrow"><td colspan="3" class="hint">Mã giảm giá người bán chịu (đã trừ vào doanh thu)</td><td>${tr(M.vou)}</td></tr>`:""}</tbody></table></div></section>`;
  const top=M.hasRows?(()=>{const T=M.sp.slice(0,7),flag=M.sp.slice(7).filter(p=>p.dg!=="Gánh được ads"&&p.dg!=="Sát ngưỡng").slice(0,3),two=M.shops.length>1;
    const r=(p,i)=>`<tr${i==null?` style="background:rgba(240,160,32,.08)"`:""}><td>${i==null?"":`<span class="tb-rk">${i+1}</span>`}</td><td>${esc(p.n.slice(0,60))}${two?`<br><small class="hint">${Object.entries(p.by).map(([s,v])=>esc(L(s))+" "+tr(v)).join(" · ")}</small>`:""}</td><td class="n">${nf(p.q)}</td><td class="n">${tr(p.dt)}</td><td class="n">${tbP(p.dt,dt)}</td><td class="n">${tsbRed(Math.round(p.lg))}</td><td class="n">${p.dt>0?tbP(p.lg,p.dt):"—"}${p.uoc>p.dt*0.5?` <small class="hint">ước</small>`:""}</td><td>${tsbDg(p.dg)}</td></tr>`;
    return `<section class="card"><div class="card-h"><h2>Top sản phẩm theo doanh thu thực</h2><span class="hint">ngưỡng biên = quảng cáo ${tbP(M.ads,dt)} + 10 điểm = ${tbP(M.ng2,1)}${M.dtUocGv>dt*0.2?" · giá vốn đang ước nhiều nên biên chưa chắc":""}</span></div>
     ${tbl(["#","Sản phẩm","SL","Doanh thu","% kênh","Lãi gộp sau phí sàn","Biên","Đánh giá"],T.map((p,i)=>r(p,i)).concat(flag.map(p=>r(p,null))))}
     <div class="acts" style="justify-content:flex-end"><button class="btn sm" data-spbv="sp">Xem tất cả sản phẩm →</button></div></section>`})():`<section class="card"><p class="hint">Đang tải sản phẩm…</p></section>`;
  const side=`<aside class="tb-side"><section class="card"><div class="card-h"><h2>⚠️ Cảnh báo & đề xuất</h2></div>
    <div class="chips" style="margin:0 0 8px"><button class="chip${SPB.al==="tuan"?" on":""}" data-spbal="tuan">${last2?`Tuần ${last2[1].a}–${last2[1].b}/${ky.slice(5)}`:"Tuần"}</button><button class="chip${SPB.al==="thang"?" on":""}" data-spbal="thang">Tháng ${ky.slice(5)}</button></div>
    ${AL.canh.length?`<h4>Cảnh báo</h4>${AL.canh.map(tbAl).join("")}`:`<p class="hint">${SPB.al==="tuan"&&!last2?"Chưa đủ 2 tuần số theo ngày để so.":"Không có cảnh báo."}</p>`}
    ${AL.de.length?`<h4>Đề xuất</h4>${AL.de.map(tbAl).join("")}`:""}</section></aside>`;
  return kp+`<div class="tb-lay"><div>${ss}${co}${CO.html}${top}</div>${side}</div>`;
}

function spbAllSp(ky){
  const shops=spbShops(),sums=(SPE.sums||[]).filter(s=>s.ky===ky&&shops.includes(s.shop));sums.forEach(s=>spbLoadRows(ky,s.shop));
  const M=speBcMonth(sums.map(s=>({s,rows:SPB.rows[ky+"|"+s.shop]||null})));
  return `<section class="card"><div class="card-h"><h2>Tất cả sản phẩm · ${tsbKyL(ky)}</h2><span class="hint">ngưỡng biên ${tbP(M.ng2,1)}</span></div>
   ${tbl(["#","Sản phẩm","Shop","SL","Doanh thu","Lãi gộp sau phí sàn","Biên","Đánh giá"],M.sp.map((p,i)=>`<tr><td>${i+1}</td><td>${esc(p.n.slice(0,80))}</td><td class="hint">${Object.keys(p.by).map(s=>esc(speShopL(s))).join(", ")}</td><td class="n">${nf(p.q)}</td><td class="n">${tr(p.dt)}</td><td class="n">${tsbRed(Math.round(p.lg))}</td><td class="n">${p.dt>0?tbP(p.lg,p.dt):"—"}</td><td>${tsbDg(p.dg)}</td></tr>`))}</section>`;
}

function spbAdmPage(m){
  if(!SPE.sums){speLoad();m.innerHTML=H("Kênh Shopee","Đang tải…");return}
  const v=SUB.bc_shopee||"tong";
  const kys=[...new Set(SPE.sums.map(s=>s.ky))].sort(),now=plYmNow();
  if(!SPB.ky||!kys.includes(SPB.ky))SPB.ky=kys.includes(now)?now:(kys[kys.length-1]||"");
  const ky=SPB.ky,S0=SPE.sums.filter(s=>s.ky===ky),den=S0.reduce((a,s)=>s.den&&(!a||s.den<a)?s.den:a,null);
  const head=H("Kênh Shopee",`Báo cáo quản trị${ky?" · "+tsbKyL(ky):""}${den?" · số đến "+speVn(den)+" · tạm tính":""} · chốt sổ sáng ngày 10 tháng sau`)
   +`<div class="tb-acts">${spbChips()}<span style="width:12px"></span>${kys.map(k=>`<button class="chip${k===ky?" on":""}" data-spbky="${k}">${tsbKyL(k)}</button>`).join("")}<span style="flex:1"></span>
     <button class="btn sm" data-spbv="up">Các tháng</button><button class="btn sm pri" data-spbv="up">⬆ Tải file</button></div>`;
  let body;
  if(v==="up"){m.innerHTML=H("Kênh Shopee","Tải báo cáo · các tháng đã lưu")+`<div class="tb-acts"><button class="btn sm" data-spbv="tong">← Tổng quan</button></div>`+speUpCard()+speSumCard();spbBind(m);
    tsbBindFiles("speup",speFiles);const sv=m.querySelector("#spe-save");if(sv)sv.onclick=speSave;const cl=m.querySelector("#spe-clr");if(cl)cl.onclick=()=>{SPE.prev=null;SPE.up={orders:[],fin:[],ads:[]};SPE.err="";renderMain()};return}
  if(!ky)body=`<section class="card"><p class="empty">Chưa có tháng nào. Bấm <b>Tải file</b> để kế toán tải file của từng shop.</p></section>`;
  else body=v==="sp"?`<div class="tb-acts"><button class="btn sm" data-spbv="tong">← Tổng quan</button></div>`+spbAllSp(ky):spbAdmBody(ky);
  m.innerHTML=head+body+srcNote("File Shopee của từng shop: đơn hàng, Tài chính › Doanh thu, lịch sử giao dịch Dịch vụ Hiển thị (kế toán hoặc agent tải). Chi riêng khác và chi chung từ Sổ chi phí. Quy tắc: skill ailla-baocao-quantri-shopee.");
  spbBind(m);
}
function spbBind(m){
  m.querySelectorAll("[data-spbv]").forEach(b=>b.onclick=()=>{SUB.bc_shopee=b.dataset.spbv;renderMain()});
  m.querySelectorAll("[data-spbal]").forEach(b=>b.onclick=()=>{SPB.al=b.dataset.spbal;renderMain()});
  m.querySelectorAll("[data-spbshop]").forEach(b=>b.onclick=()=>{SPB.shop=b.dataset.spbshop;renderMain()});
  m.querySelectorAll("[data-spbky]").forEach(b=>b.onclick=()=>{SPB.ky=b.dataset.spbky;SUB.bc_shopee="tong";renderMain()});
  m.querySelectorAll("[data-tbtg]").forEach(tr=>tr.onclick=()=>{const k=tr.dataset.tbtg,L=m.querySelectorAll(`[data-tbs="${k}"]`),open=L.length&&L[0].style.display==="none";L.forEach(r=>r.style.display=open?"":"none");const c=m.querySelector(`[data-car="${k}"]`);if(c)c.textContent=open?"▾":"▸"});
}

/* ---------- Vận hành ---------- */
async function spbOpsLoad(from,to){const k=from+"|"+to;if(SPB.ops[k]!==undefined||SPB.opsBusy[k])return;SPB.opsBusy[k]=1;
  try{SPB.ops[k]=await speApi(`/ops?from=${from}&to=${to}`)}catch(e){SPB.ops[k]=null}SPB.opsBusy[k]=0;if(PAGE==="bc_shopee")renderMain()}
function spbOpsPage(m){
  const from=PERIOD.from,to=PERIOD.to,key=from+"|"+to;spbOpsLoad(from,to);
  const R=SPB.ops[key];
  if(R===undefined){m.innerHTML=H("Shopee · Hiệu quả Marketing","Đang tải số liệu…");return}
  const shops=spbShops(),OM=((R&&R.months)||[]).filter(x=>shops.includes(x.shop)),ky=to.slice(0,7),L=speShopL;
  const sum=f=>OM.reduce((a,x)=>a+(+x[f]||0),0),dt=sum("dt"),don=sum("don"),mon=sum("mon"),hh=sum("hh"),ads=sum("ads"),koc=sum("koc"),hhAff=sum("hhAff"),vou=sum("vou");
  const byShop=shops.map(s=>{const X=OM.filter(x=>x.shop===s),f=k=>X.reduce((a,x)=>a+(+x[k]||0),0),d=f("dt"),h=f("hh"),a=f("ads");return {shop:s,has:X.length>0,dt:d,don:f("don"),hh:h,hhRate:d+h?h/(d+h):0,ads:a,roi:a?d/a:null,koc:f("koc"),aff:f("hhAff")}});
  const miss=byShop.filter(s=>!s.has).map(s=>s.shop),cur=OM.filter(x=>x.ky===ky);
  const W=speBcWeeks(cur.map(x=>({ky:x.ky,shop:x.shop,den:x.den,days:Object.fromEntries(Object.entries(x.days||{}).map(([d,v])=>[d,[v[0],0,0,0,v[1],v[2]]]))})),ky),last2=speBcLast2(W);
  const g={};OM.forEach(x=>(x.sp||[]).forEach(p=>{const k=speBcKey(p.n),o=g[k]||(g[k]={n:speBcName(p.n),q:0,dt:0,by:{},pri:p.pri,top:0});o.q+=p.q;o.dt+=p.dt;o.by[x.shop]=(o.by[x.shop]||0)+p.dt;if(p.dt>o.top){o.top=p.dt;o.pri=p.pri}}));
  const sp=Object.values(g).sort((a,b)=>b.dt-a.dt);
  const Mo={dt,ads,roi:ads?dt/ads:null,shops:byShop.filter(s=>s.has),sp,dtUocGv:0,hhAff,ng2:0};
  const AW=speBcAlerts({last2,label:L}),AM=speBcAlerts({M:Mo,miss,adsMax:spbAdsMax(),label:L}),todo=speBcTodo({canh:AW.canh.concat(AM.canh)});
  const kp=`<div class="grid kpis">${kpi("Doanh thu thực",OM.length?tr(dt):"—",OM.length?"sau hủy/hoàn, giảm giá shop":"chờ báo cáo tháng")}${kpi("Số đơn hàng",OM.length?nf(don):"—",don?"TB "+tr(dt/don)+"/đơn":"")}${kpi("Số món bán ra",OM.length?nf(mon):"—",don?(mon/don).toFixed(1).replace(".",",")+" món/đơn":"")}${kpi("Chi phí quảng cáo",tr(ads),dt?tbP(ads,dt)+" doanh thu · ngưỡng "+tbP(spbAdsMax(),1):"")}${kpi("ROI quảng cáo",tbX(Mo.roi),"doanh thu thực / chi quảng cáo")}${kpi("Hủy / hoàn",OM.length?tbP(hh,dt+hh):"—",OM.length?tr(hh)+" giá trị":"")}</div>`;
  const td=`<section class="card" style="padding:10px 14px"><div class="tb-todo"><b>Việc cần làm (${todo.length}):</b>${todo.length?todo.map(x=>`<span class="pill ${x.lv==="r"?"red":"amb"}">${x.team?esc(x.team)+": ":""}${esc(x.t)}</span>`).join(""):`<span class="hint">không có việc gấp</span>`}</div></section>`;
  const row=(l,v)=>`<div class="row"><span>${l}</span><b>${v}</b></div>`,al=(lv,t,d)=>`<div class="tb-al tb-${lv}" style="margin:8px 0 0"><b>${lv==="g"?"✓ ":""}${esc(t)}</b>${d?esc(d):""}</div>`;
  const card=(ic,bg,n,st,rows,als)=>`<div class="tb-team"><h3><span class="tb-ico" style="background:${bg}">${ic}</span>${n}<span style="margin-left:auto">${tbPill(st)}</span></h3>${rows}${als||""}</div>`;
  const has=byShop.filter(s=>s.has),lw=last2?last2[1]:null,pw=last2?last2[0]:null,hhMax=has.reduce((a,s)=>Math.max(a,s.hhRate),0),kd=has.filter(s=>s.koc>0);
  const day=sp.filter(p=>p.pri==="Đẩy mạnh").slice(0,2).map(p=>p.n.slice(0,28)).join(", ");
  const cards=`<h3 style="margin:4px 0 8px">Hiệu quả từng mảng</h3><div class="tb-teams">
   ${card("📣","rgba(224,49,49,.1)","Quảng cáo Shopee",Mo.roi==null?"Theo dõi":Mo.roi>=4?"Tốt":Mo.roi>=2.5?"Theo dõi":"Kém",
     row("Chi quảng cáo",tr(ads))+has.map(s=>row("ROI "+esc(L(s.shop)),tbX(s.roi))).join("")+row("Chi / đơn",don?nf(Math.round(ads/don))+"đ":"—")+(lw?row(`Tuần ${lw.a}–${lw.b}`,tr(lw.ads)+(lw.ads?" · ROI "+tbX(lw.dt/lw.ads):"")):""),
     Mo.roi>=4&&dt&&ads/dt<spbAdsMax()-0.1?al("b","Còn dư địa tăng quảng cáo",day?"Dồn cho "+day+".":""):Mo.roi!=null&&Mo.roi<2.5?al("r","ROI thấp","Rà lại sản phẩm đang chạy, cắt sản phẩm mức Giảm / Dừng."):"")}
   ${card("🤝","rgba(224,96,126,.12)","Tiếp thị liên kết (KOC)",koc?"Tốt":"Theo dõi",
     row("Doanh thu qua KOC",koc?tr(koc)+" · "+tbP(koc,dt):"—")+row("Hoa hồng KOC",hhAff?tr(hhAff)+" · "+tbP(hhAff,koc):"—")+row("ROI (doanh thu / hoa hồng)",hhAff?tbX(koc/hhAff):"—")+has.filter(s=>!s.koc).map(s=>row(esc(L(s.shop)),`<span class="hint">chưa có đơn KOC</span>`)).join(""),
     kd.length&&hhAff?al("b",has.length>kd.length?"Mở tiếp thị liên kết cho shop chưa có KOC":"Mở thêm KOC",`KOC tốn ${tbP(hhAff,koc)} doanh thu, quảng cáo tốn ${tbP(ads,dt)}.`):"")}
   ${card("📦","rgba(240,160,32,.14)","Đơn hàng & CSKH",hhMax>0.15?"Kém":hhMax>0.12?"Theo dõi":"Tốt",
     has.map(s=>row("Hủy / hoàn "+esc(L(s.shop)),`<span${s.hhRate>0.15?' class="t-red"':""}>${tbP(s.hhRate,1)} · ${tr(s.hh)}</span>`)).join("")+row("Mã giảm giá người bán chịu",vou?tr(vou):"—")+row("Món / đơn",don?(mon/don).toFixed(1).replace(".",","):"—"),
     hhMax>0.15?al("r","Hủy/hoàn cao","Gọi xác nhận đơn COD giá trị cao, xem lý do hoàn theo sản phẩm."):"")}
   ${card("📈","rgba(31,95,191,.1)","Doanh thu theo tuần",last2&&lw.dt<pw.dt*0.85?"Theo dõi":"Tốt",
     W.filter(w=>w.dt>0).map(w=>row(`${String(w.a).padStart(2,"0")}–${String(w.b).padStart(2,"0")}/${ky.slice(5)}${w.du?"":" (chưa đủ)"}`,tr(w.dt)+" · "+nf(w.don)+" đơn")).join("")||`<p class="hint">Chưa có số theo ngày tháng ${tsbKyL(ky)}.</p>`,
     AW.canh.slice(0,2).map(a=>al(a.lv,a.t,a.d)).join(""))}</div>`;
  const two=shops.length>1;
  const top=`<section class="card"><div class="card-h"><h2>Top sản phẩm bán chạy</h2><span class="hint">team thấy số bán, không thấy lãi · "Ưu tiên quảng cáo" do web tính từ biên lãi bên quản trị</span></div>
   ${sp.length?tbl(["#","Sản phẩm","Số bán","Doanh thu","% kênh","Ưu tiên quảng cáo"],sp.slice(0,8).map((p,i)=>`<tr><td><span class="tb-rk">${i+1}</span></td><td>${esc(p.n.slice(0,60))}${two?`<br><small class="hint">${Object.entries(p.by).map(([s,v])=>esc(L(s))+" "+tr(v)).join(" · ")}</small>`:""}</td><td class="n">${nf(p.q)}</td><td class="n">${tr(p.dt)}</td><td class="n">${tbP(p.dt,dt)}</td><td>${tbPill(p.pri)}</td></tr>`)):`<p class="empty">Chờ kế toán tải báo cáo Shopee.</p>`}</section>`;
  m.innerHTML=H("Shopee · Hiệu quả Marketing",(miss.length?"chưa có báo cáo "+miss.map(L).join(", ")+" · ":"")+(OM.length?"số đến "+speVn(OM.reduce((a,x)=>x.den&&(!a||x.den<a)?x.den:a,"")||to):""))
   +`<div class="tb-acts">${spbChips()}</div>`+kp+td+cards+top
   +srcNote("Doanh thu thực, đơn, hủy/hoàn, quảng cáo, KOC, top sản phẩm: báo cáo Shopee từng shop do kế toán / agent tải (đơn hàng, Tài chính › Doanh thu, lịch sử giao dịch Dịch vụ Hiển thị).");
  spbBind(m);
}
PAGES.bc_shopee=m=>{if(!speAcct()){m.innerHTML=H("Kênh Shopee","Cần đăng nhập tài khoản web để xem số Shopee.");return}if(tsbAdm())return spbAdmPage(m);spbOpsPage(m)};
