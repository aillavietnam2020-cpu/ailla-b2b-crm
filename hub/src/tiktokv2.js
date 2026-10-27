/* =====================================================================
   TRANG TIKTOK BẢN MỚI (chị Hoa duyệt demo bản 6, 27/10/2026). Đè lên PAGES.bc_tiktok của tiktok.js, giữ nguyên
   cách tải file, lưu, khoá sổ, các trang con (Sản phẩm & SKU, Kiểm dữ liệu, Các tháng, Tải file).
   - Quản trị: 6 ô số (doanh thu thực, giá vốn, phí sàn, quảng cáo, lãi đóng góp, lợi nhuận ròng kênh), cơ cấu doanh thu,
     cơ cấu chi phí (bấm phí sàn / chi riêng / chi chung để xổ từng khoản), top sản phẩm; cột phải: cảnh báo & đề xuất tuần / tháng.
   - Vận hành: doanh thu thực, đơn, món, chi phí quảng cáo, ROI, hủy/hoàn; việc tuần này; hiệu quả 4 team (Content, Ads,
     Booking KOC, Live) có cảnh báo, đề xuất trong từng thẻ; top sản phẩm (mức ưu tiên quảng cáo, không có lãi).
   Hàm tính ở ttbc.js. Chi phí riêng khác và chi chung phân bổ đọc từ Sổ chi phí (sochi.js, scphanbo.js), không sửa ở đây.
   ===================================================================== */
(function(){if(typeof document==="undefined"||document.getElementById("ttbc-css"))return;const s=document.createElement("style");s.id="ttbc-css";s.textContent=`
.tb-lay{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:14px;align-items:start}@media(max-width:1000px){.tb-lay{grid-template-columns:1fr}}
.tb-side{position:sticky;top:12px}.tb-acts{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:-4px 0 12px}
.tb-cnt{background:#fdeceb;color:#c0392b;border-radius:10px;padding:0 6px;font-size:11px;font-weight:700;margin-left:4px}
.tb-donut{width:150px;height:150px;border-radius:50%;position:relative;flex:none}.tb-donut:after{content:"";position:absolute;inset:28px;background:var(--card,#fff);border-radius:50%}
.tb-donut .ct{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1;font-size:12px;color:var(--muted,#6b6880)}.tb-donut .ct b{font-size:17px;color:inherit}
.tb-leg{flex:1;min-width:260px}.tb-leg .it{display:grid;grid-template-columns:14px 1fr auto auto;gap:8px;align-items:center;padding:6px 0;border-bottom:1px dashed var(--line,#e8e6f3);font-size:13px}.tb-leg .it:last-child{border-bottom:0}
.tb-dot{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.tb-bar{display:flex;height:34px;border-radius:9px;overflow:hidden;margin:6px 0 10px}.tb-bar div{display:flex;align-items:center;justify-content:center;color:#fff;font-size:11.5px;font-weight:600;white-space:nowrap;overflow:hidden}
.tb-tg{cursor:pointer}.tb-tg td:first-child b{color:var(--accent,#5b4bdb)}.tb-car{display:inline-block;width:14px;color:var(--accent,#5b4bdb)}
.tb-sub td{color:var(--muted,#6b6880)}.tb-sub td:first-child{padding-left:30px}.tb-sum td{font-weight:700;background:rgba(23,128,74,.06)}
.tb-al{padding:8px 10px;border-radius:10px;margin-bottom:7px;font-size:12.5px;line-height:1.45}.tb-al b{display:block;font-size:13px}.tb-al i{font-style:normal;opacity:.75}
.tb-r{background:#fdeceb}.tb-a{background:#fff4dc}.tb-g{background:#e6f6ed}.tb-b{background:#e8f0fd}
.tb-side h4{font-size:11.5px;text-transform:uppercase;letter-spacing:.4px;opacity:.65;margin:10px 0 6px}
.tb-teams{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin-bottom:12px}
.tb-team{border:1px solid var(--line,#e8e6f3);border-radius:14px;padding:12px 14px;background:var(--card,#fff)}.tb-team h3{margin:0 0 8px;font-size:15px;display:flex;align-items:center;gap:8px}
.tb-team .row{display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px dashed var(--line,#e8e6f3);font-size:13px}.tb-team .row:last-of-type{border-bottom:0}
.tb-ico{width:28px;height:28px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:15px}
.tb-todo{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px}
.tb-rk{display:inline-flex;width:22px;height:22px;border-radius:50%;background:rgba(91,75,219,.12);color:#5b4bdb;font-size:12px;font-weight:700;align-items:center;justify-content:center}`;document.head.appendChild(s)})();

const TB={al:"tuan",ops:{},opsBusy:{}};
const tbF=v=>v==null?"—":nf(Math.round(v));
const tbP=(a,b)=>b?(a/b*100).toFixed(1).replace(".",",")+"%":"—";
const tbX=v=>v==null?"—":(Math.round(v*100)/100).toFixed(2).replace(".",",");
const tbKyEnd=ky=>ky+"-"+String(ttKyDays(ky)).padStart(2,"0");
const tbAl=x=>`<div class="tb-al tb-${x.lv}"><b>${x.lv==="g"?"✓ ":""}${esc(x.t)}</b>${esc(x.d||"")}${x.ai?` <i>· ${esc(x.ai)}</i>`:""}</div>`;
const tbPill=s=>pill(s,/Kém|Dừng/.test(s)?"red":/Theo dõi|Giảm|Giữ/.test(s)?"amb":/Thử/.test(s)?"blu":"grn");

/* Chi phí riêng khác (bổ thẳng cho TikTok, trừ quảng cáo / phí sàn / vận chuyển / hoa hồng đã có trong báo cáo sàn) và chi chung đã chia,
   đọc từ Sổ chi phí của tháng. Thiếu số thì trả lý do. */
function tbSoCP(ky){
  const out={rieng:null,chung:null,why:""};
  if(typeof scPBRows!=="function"){out.why="Sổ chi phí chưa nạp";return out}
  const keep={from:PERIOD.from,to:PERIOD.to};
  try{PERIOD.from=ky+"-01";PERIOD.to=tbKyEnd(ky);if(typeof scNap==="function")scNap();
    const rows=scPBRows(),by=(L,f)=>{const o={};L.forEach(x=>{const n=f(x);o[n]=(o[n]||0)+(+x.t||0)});return Object.entries(o).filter(e=>Math.round(e[1])).map(([n,t])=>({n,t})).sort((a,b)=>b.t-a.t)};
    const tru=typeof SC_PL_TRU!=="undefined"?SC_PL_TRU:[];
    out.rieng=by(rows.filter(x=>x.k==="TikTok"&&x.st!=="Chờ duyệt"&&!tru.includes(x.g)&&!/^H/.test(String(scG(x.g).lo||""))),x=>scG(x.g).n);
    if(!out.rieng.length){out.rieng=null;out.why="Sổ chi phí tháng này chưa ghi khoản nào cho TikTok"}
    if(typeof scChiaPB==="function"){const CH=scChiaPB(rows);
      if(CH.loi&&CH.loi.length)out.why="Chi chung chưa chia: "+CH.loi.join("; ");
      else{const o=(CH.kenh||{}).TikTok||{};out.chung=Object.entries(o).map(([g,t])=>({n:scG(g).n,t})).filter(x=>Math.round(x.t)).sort((a,b)=>b.t-a.t);if(!out.chung.length&&!CH.truoc){out.chung=null;out.why="Sổ chi phí tháng này chưa có chi chung"}}}
    else out.why="Chưa có quy tắc chia chi chung";
  }catch(e){out.why="Không đọc được Sổ chi phí";out.rieng=null;out.chung=null}
  finally{PERIOD.from=keep.from;PERIOD.to=keep.to}
  return out;
}

/* ---------- Quản trị ---------- */
function tbCostTbl(C,dt,soWhy){
  const row=(k,c,n,t,h,sub,sample)=>{const has=sub&&sub.length;
    return `<tr class="${has?"tb-tg":""}" ${has?`data-tbtg="${k}"`:""}><td>${has?`<span class="tb-car" data-car="${k}">▸</span>`:`<span class="tb-car"></span>`}<span class="tb-dot" style="background:${c}"></span>${has?`<b>${esc(n)}</b>`:esc(n)}</td><td class="n">${t==null?`<span class="hint">chưa có số</span>`:tbF(t)}</td><td class="n">${t==null?"":tbP(t,dt)}</td><td class="hint">${esc(h||"")}</td></tr>`
     +(has?sub.map(x=>`<tr class="tb-sub" data-tbs="${k}" style="display:none"><td>${esc(x.n)}</td><td class="n">${tbF(x.t)}</td><td class="n">${tbP(x.t,dt)}</td><td></td></tr>`).join(""):"")};
  const L=C.lines;
  return tbl(["Khoản","Số tiền (đ)","% doanh thu","Ghi chú"],[
    row("gv",L[0].c,L[0].n,L[0].t,"theo Quy đổi mã các sàn và Giá vốn SKU"),
    row("phi",L[1].c,L[1].n,L[1].t,"bấm để xem từng loại phí",L[1].sub),
    row("ads",L[2].c,L[2].n,L[2].t,"theo kỳ chi tiêu, đã cộng VAT 10%"),
    `<tr class="tb-sum"><td>Lãi đóng góp kênh</td><td class="n">${tbF(C.lai)}</td><td class="n">${tbP(C.lai,dt)}</td><td class="hint">trước chi riêng khác và chi chung</td></tr>`,
    row("rieng","#b06ab3","Chi phí riêng khác của kênh",C.rieng?C.rieng.t:null,C.rieng?(C.rieng.sub.length?"bấm để xem từng khoản · Sổ chi phí":"Sổ chi phí chưa ghi khoản nào cho TikTok"):soWhy,C.rieng&&C.rieng.sub),
    row("chung","#5d6d8e","Chi phí chung phân bổ",C.chung?C.chung.t:null,C.chung?"bấm để xem · theo Quy tắc phân bổ ở Sổ chi phí":soWhy,C.chung&&C.chung.sub),
    `<tr class="tb-sum"><td>Lợi nhuận ròng kênh</td><td class="n">${C.ln==null?`<span class="hint">chưa có số</span>`:tbF(C.ln)}</td><td class="n">${C.ln==null?"":tbP(C.ln,dt)}</td><td class="hint">sau khi gánh hết chi phí riêng và chi chung</td></tr>`])}

function tbAdmTong(ky,P){
  const from=ky+"-01",to=tbKyEnd(ky),S=tsbOpsAgg(from,to),K=S.km,dt=P.dt;
  const hoaHong=-((P.fees.find(f=>/affiliate|KOC/i.test(f[0]))||[0,0])[1]);
  const lanes=S.nKm?ttbcLanes(K,hoaHong,P.ads):null,W=ttbcWeeks((TSB.all||{}).days,ky,TT_ADS_VAT),last2=ttbcLast2(W);
  const so=tbSoCP(ky),C=ttbcCost(P,so.rieng,so.chung),adsMax=typeof scQcMax==="function"?scQcMax():0.38;
  const alM=ttbcAlerts({P,lanes,last2:null,live:S.nLive?S.live:null,adsMax});
  let alW={canh:[],de:[]};if(last2){const Sw=tsbOpsAgg(ky+"-"+String(last2[1].a).padStart(2,"0"),ky+"-"+String(last2[1].b).padStart(2,"0"));alW=ttbcAlerts({P:null,lanes,last2,live:Sw.nLive?Sw.live:null,adsMax:0})}
  const AL=TB.al==="tuan"?alW:alM;
  const kp=`<div class="grid kpis">${kpi("Doanh thu thực",tr(dt),nf(P.don)+" đơn · TB "+tr(P.aov)+"/đơn")}${kpi("Giá vốn",tr(P.gv),tbP(P.gv,dt)+" doanh thu"+(P.dtUocGv?" · "+tbP(P.dtUocGv,dt)+" đang ước":""))}${kpi("Phí sàn",tr(-P.phi),tbP(-P.phi,dt)+" doanh thu")}${kpi("Quảng cáo (đã VAT)",tr(P.ads),tbP(P.ads,dt)+" · ngưỡng "+tbP(adsMax,1))}${kpi("Lãi đóng góp kênh",tr(P.lai),tbP(P.lai,dt)+" · trước chi chung","var(--green)")}${kpi("Lợi nhuận ròng kênh",C.ln==null?"—":tr(C.ln),C.ln==null?"chờ Sổ chi phí đủ số":tbP(C.ln,dt)+" · sau phân bổ chi chung","var(--green)")}</div>`;
  const co=lanes?(()=>{let acc=0;const cg=lanes.rows.map(r=>{const a=acc;acc+=r.ty*100;return `${r.c} ${a}% ${acc}%`}).join(",");
    return `<section class="card"><div class="card-h"><h2>Cơ cấu doanh thu</h2><span class="hint">nguồn nào mang doanh số và tốn bao nhiêu · tỷ trọng theo GMV (TikTok chỉ chia nguồn theo GMV, trước hủy/hoàn) · bấm nguồn để xem trang vận hành</span></div>
     <div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap"><div class="tb-donut" style="background:conic-gradient(${cg})"><div class="ct">GMV<b>${tr(lanes.tot)}</b></div></div>
     <div class="tb-leg"><div class="it hint"><span></span><span>Nguồn</span><span class="n">Tỷ trọng</span><span class="n">Chi phí riêng</span></div>
     ${lanes.rows.map(r=>`<div class="it"><span class="tb-dot" style="background:${r.c}"></span><span><a href="#" data-go="bc_tiktok_ops">${esc(r.n)}</a> <small class="hint">${tr(r.gmv)}</small></span><span class="n"><b>${tbP(r.ty,1)}</b></span><span class="n">${r.cp==null?`<span class="hint">${r.key==="vInh"?"lương content: xem Chi phí riêng":"chi phí live: xem Chi phí riêng"}</span>`:r.cp?tr(r.cp)+" hoa hồng · "+tbP(r.cp100,1):"0"}</span></div>`).join("")}
     <div class="it"><span></span><span>Quảng cáo GMV Max (đẩy cả shop)</span><span></span><span class="n t-red">${tr(lanes.ads)} · ${tbP(lanes.ads100,1)}</span></div></div></div></section>`})():`<section class="card"><div class="card-h"><h2>Cơ cấu doanh thu</h2></div><p class="empty">Tháng này team chưa tải file Key metrics nên chưa chia được doanh thu theo nguồn.</p></section>`;
  const cost=`<section class="card"><div class="card-h"><h2>Cơ cấu chi phí</h2><span class="hint">mọi khoản chi của kênh trên doanh thu thực ${tbF(dt)} đ</span></div>
    <div class="tb-bar">${C.bar.filter(b=>b.t>0).map(b=>`<div style="width:${(b.ty*100).toFixed(2)}%;background:${b.c}" title="${esc(b.n)} ${tbF(b.t)}">${b.ty>=0.06?esc(b.n)+" "+tbP(b.t,dt):tbP(b.t,dt)}</div>`).join("")}</div>${tbCostTbl(C,dt,so.why)}</section>`;
  const ng2=P.ng2,flag=new Set((P.g1||[]).map(r=>r.pn).concat((P.g2||[]).map(r=>r.pn)));
  const top=`<section class="card"><div class="card-h"><h2>Top sản phẩm theo doanh thu thực</h2><span class="hint">ngưỡng biên = quảng cáo ${tbP(P.ads,dt)} + 10 điểm = ${tbP(ng2,1)}</span></div>
    ${tbl(["#","Sản phẩm","SL","Doanh thu","% kênh","Lãi gộp sau phí sàn","Biên","Đánh giá"],P.sp.slice(0,6).map((p,i)=>`<tr><td><span class="tb-rk">${i+1}</span></td><td>${esc(p.n.slice(0,60))}</td><td class="n">${nf(p.q)}</td><td class="n">${tr(p.dt)}</td><td class="n">${tbP(p.dt,dt)}</td><td class="n">${tsbRed(p.lg)}</td><td class="n">${tbP(p.lg,p.dt)}</td><td>${tsbDg(p.dg)}</td></tr>`)
      .concat((P.g1||[]).concat((P.g2||[]).slice().sort((a,b)=>b.dt-a.dt)).slice(0,3).map(r=>`<tr style="background:rgba(240,160,32,.08)"><td></td><td>${esc(String(r.pn).slice(0,60))}<br><small class="hint">${esc(r.vr||r.ss||"")}</small></td><td class="n">${nf(r.q)}</td><td class="n">${tr(r.dt)}</td><td class="n">${tbP(r.dt,dt)}</td><td class="n">${tsbRed(r.lg)}</td><td class="n">${tbP(r.lg,r.dt)}</td><td>${tsbDg(r.dg)}</td></tr>`)))}
    <div class="acts" style="justify-content:flex-end"><button class="btn sm" data-tbv="sp">Xem tất cả sản phẩm & SKU →</button></div></section>`;
  const side=`<aside class="tb-side"><section class="card"><div class="card-h"><h2>⚠️ Cảnh báo & đề xuất</h2></div>
    <div class="chips" style="margin:0 0 8px"><button class="chip${TB.al==="tuan"?" on":""}" data-tbal="tuan">${last2?`Tuần ${last2[1].a}–${last2[1].b}/${ky.slice(5)}`:"Tuần"}</button><button class="chip${TB.al==="thang"?" on":""}" data-tbal="thang">Tháng ${ky.slice(5)}</button></div>
    ${AL.canh.length?`<h4>Cảnh báo</h4>${AL.canh.map(tbAl).join("")}`:`<p class="hint">${TB.al==="tuan"&&!last2?"Chưa đủ 2 tuần số theo ngày để so.":"Không có cảnh báo."}</p>`}
    ${AL.de.length?`<h4>Đề xuất</h4>${AL.de.map(tbAl).join("")}`:""}</section></aside>`;
  return kp+`<div class="tb-lay"><div>${co}${cost}${top}</div>${side}</div>`;
}

function tbAdmPage(m){
  const v=SUB.bc_tiktok;
  if(v&&v!=="tong"&&v!=="pl"){if(TB.pk)TSB.pk=PERIOD.from+"|"+PERIOD.to;tsbAdmPage(m);const tb=m.querySelector(".tabs");if(tb)tb.outerHTML=`<div class="tb-acts"><button class="btn sm" data-tbv="tong">← Tổng quan</button><b>${{sp:"Sản phẩm & SKU",cb:"Cảnh báo SKU",dl:"Kiểm dữ liệu",thang:"Các tháng",up:"Tải file tháng"}[v]||""}</b></div>`;tbBind(m);return}
  if(!(typeof SV!=="undefined"&&SV.acct)||!TSB.months){tsbAdmPage(m);return}
  {const pk=PERIOD.from+"|"+PERIOD.to;TSB.pk=pk;TSB.noRep="";if(TB.pk!==pk){TB.pk=pk;const pym=plYmNow(),has=TSB.months.some(x=>x.ky===pym);TSB.ky=has?pym:(TSB.months.length?TSB.months[TSB.months.length-1].ky:"");TB.noRep=has?"":pym}}
  if(TSB.prev){SUB.bc_tiktok="pl";tsbAdmPage(m);const tb=m.querySelector(".tabs");if(tb)tb.remove();tbBind(m);return}
  const ky=TSB.ky;if(ky)tsbLoadMonth(ky);if(!TSB.all)tsbLoadAll();
  const S=ky?TSB.data[ky]:null,P=S?S.pl:null,todo=S?(S.data.todo||ttTodo(S.pl)):null;
  const nViec=todo?todo.noMap.length+todo.miss.length+todo.pack.length:0,lock=S&&S.locked_at;
  const head=H("Kênh TikTok Shop",`Báo cáo quản trị${ky?" · "+tsbKyL(ky):""}${S&&S.data.M&&S.data.M.den?" · số đến "+tsbVn(S.data.M.den):""} · chốt sổ ngày 10 tháng sau`)
   +`<div class="tb-acts">${(TSB.months||[]).map(x=>`<button class="chip${x.ky===ky?" on":""}" data-tsbky="${x.ky}">${tsbKyL(x.ky)}${x.locked_at?" ✓":""}</button>`).join("")}<span style="flex:1"></span>
     <button class="btn sm" data-tbv="thang">Các tháng</button><button class="btn sm" data-tbv="dl">Kiểm dữ liệu${nViec?`<span class="tb-cnt">${nViec}</span>`:""}</button>
     ${S?(lock?(isCeo()?`<button class="btn sm" id="tsb-unlock">Mở khoá ${tsbKyL(ky)}</button>`:`<span class="hint">Đã khoá sổ</span>`):`<button class="btn sm" id="tsb-recalc">Tính lại giá vốn</button><button class="btn sm" id="tsb-lock">Khoá sổ ${tsbKyL(ky)}</button>`):""}
     <button class="btn sm pri" data-tbv="up">⬆ Tải file</button></div>`
   +(TB.noRep?`<div class="note">Tháng ${tsbKyL(TB.noRep)} chưa tải báo cáo TikTok${ky?`, đang xem ${tsbKyL(ky)} (tháng gần nhất có số)`:""}. Bấm <b>Tải file</b> để tải báo cáo tuần này.</div>`:"");
  let body;
  if(!ky)body=`<section class="card"><p class="empty">Chưa có tháng nào. Bấm <b>Tải file</b> để kế toán tải 3 file TikTok.</p></section>`;
  else if(!P)body=`<section class="card"><p class="hint">Đang tải ${tsbKyL(ky)}…</p></section>`;
  else body=tbAdmTong(ky,P);
  m.innerHTML=head+body+srcNote("Báo cáo quyết toán TikTok do kế toán tải (OrderSKUList, income, Campaign overview); nguồn doanh thu từ Key metrics team TikTok tải; chi riêng khác và chi chung từ Sổ chi phí. Quy tắc: skill ailla-baocao-quantri-tiktok.");
  tbBind(m);
  const on=(id,f)=>{const b=m.querySelector("#"+id);if(b)b.onclick=f};
  on("tsb-recalc",tsbRecalc);on("tsb-lock",()=>tsbLock(true));on("tsb-unlock",()=>tsbLock(false));
}
function tbBind(m){
  m.querySelectorAll("[data-tbv]").forEach(b=>b.onclick=()=>{SUB.bc_tiktok=b.dataset.tbv;if(b.dataset.tbv==="tong")TSB.prev=null;renderMain()});
  m.querySelectorAll("[data-tbal]").forEach(b=>b.onclick=()=>{TB.al=b.dataset.tbal;renderMain()});
  m.querySelectorAll("[data-tsbky]").forEach(b=>b.onclick=()=>{TSB.prev=null;TSB.ky=b.dataset.tsbky;TB.noRep="";SUB.bc_tiktok="tong";renderMain()});
  m.querySelectorAll("[data-tbtg]").forEach(tr=>tr.onclick=()=>{const k=tr.dataset.tbtg,L=m.querySelectorAll(`[data-tbs="${k}"]`),open=L.length&&L[0].style.display==="none";L.forEach(r=>r.style.display=open?"":"none");const c=m.querySelector(`[data-car="${k}"]`);if(c)c.textContent=open?"▾":"▸"});
  m.querySelectorAll('[data-go="bc_tiktok_ops"]').forEach(a=>a.onclick=e=>{e.preventDefault();if(typeof OPS_URL!=="undefined"&&OPS_URL)window.open(OPS_URL.replace(/\/$/,"")+"/hub/#bc_tiktok","_blank")});
}

/* ---------- Vận hành ---------- */
async function tbOpsLoad(from,to){const k=from+"|"+to;if(TB.ops[k]!==undefined||TB.opsBusy[k])return;TB.opsBusy[k]=1;
  try{TB.ops[k]=await tsbApi(`/ops?from=${from}&to=${to}`)}catch(e){TB.ops[k]=null}TB.opsBusy[k]=0;if(PAGE==="bc_tiktok")renderMain()}
function tbOpsPage(m){
  if(!TSB.all){tsbLoadAll();m.innerHTML=H("TikTok Shop · Hiệu quả Marketing","Đang tải số liệu…");return}
  const from=PERIOD.from,to=PERIOD.to,key=from+"|"+to;tbOpsLoad(from,to);
  const OM=TB.ops[key]||[],S=tsbOpsAgg(from,to),K=S.km,ky=to.slice(0,7),last=(TSB.all.last||[]).find(r=>r.src==="km");
  const sum=f=>OM.reduce((a,x)=>a+(+x[f]||0),0),dt=OM.length?sum("dt"):null,don=sum("don"),mon=sum("mon"),hh=sum("hh");
  const adsV=OM.length?sum("ads"):Math.round((S.ads.chi||0)*(1+TT_ADS_VAT)),lgRate=OM.length?OM.reduce((a,x)=>a+x.lgRate*x.dt,0)/(dt||1):0;
  const hoaHong=OM.length&&OM.every(x=>x.hoaHong!=null)?sum("hoaHong"):null,partial=OM.length&&(from.slice(8)!=="01"||to!==tbKyEnd(ky)||from.slice(0,7)!==ky);
  const R=(TSB.all.ranges||[]).filter(r=>r.from<=to&&r.to>=from),kc=R.filter(r=>r.kind==="koc").sort((a,b)=>b.to.localeCompare(a.to))[0];
  const W=ttbcWeeks(TSB.all.days,ky,TT_ADS_VAT),last2=ttbcLast2(W);
  const T=ttbcTeams({km:K,ads:S.ads,adsV,dt,lgRate,hoaHong,live:S.nLive?S.live:null,koc:kc?kc.data:null,last2});
  const kp=`<div class="grid kpis">${kpi("Doanh thu thực",dt==null?"—":tr(dt),dt==null?"chờ báo cáo quyết toán tháng":"sau hủy/hoàn, giảm giá shop"+(partial?" · số cả tháng":""))}${kpi("Số đơn hàng",dt==null?"—":nf(don),don?"TB "+tr(dt/don)+"/đơn":"")}${kpi("Số món bán ra",dt==null?"—":nf(mon),don?(mon/don).toFixed(1).replace(".",",")+" món/đơn":"")}${kpi("Chi phí quảng cáo",tr(adsV),dt?tbP(adsV,dt)+" doanh thu":"đã VAT")}${kpi("ROI quảng cáo",tbX(T.ads.roi),"doanh thu thực / chi quảng cáo")}${kpi("Hủy / hoàn",dt==null?"—":tbP(hh,dt+hh),dt==null?"":tr(hh)+" giá trị")}</div>`;
  const todo=`<section class="card" style="padding:10px 14px"><div class="tb-todo"><b>Việc cần làm (${T.todo.length}):</b>${T.todo.length?T.todo.map(x=>`<span class="pill ${x.lv==="r"?"red":"amb"}">${esc(x.team)}: ${esc(x.t)}</span>`).join(""):`<span class="hint">không có việc gấp</span>`}</div></section>`;
  const row=(l,v)=>`<div class="row"><span>${l}</span><b>${v}</b></div>`,als=x=>x.al.map(a=>`<div class="tb-al tb-${a.lv}" style="margin:8px 0 0"><b>${a.lv==="g"?"✓ ":""}${esc(a.t)}</b>${a.d?"Đề xuất: "+esc(a.d):""}</div>`).join("");
  const card=(ic,bg,n,x,rows)=>`<div class="tb-team"><h3><span class="tb-ico" style="background:${bg}">${ic}</span>${n}<span style="margin-left:auto">${tbPill(x.st)}</span></h3>${rows}${als(x)}</div>`;
  const teams=`<h3 style="margin:4px 0 8px">Hiệu quả từng team</h3><div class="tb-teams">
   ${card("🎬","rgba(91,75,219,.12)","Content (video shop)",T.content,row("GMV từ video shop",S.nKm?tr(T.content.gmv)+" · "+tbP(T.content.ty,1):"—")+row("Video đăng · video ra đơn",`<span class="hint">chưa nối dữ liệu video</span>`))}
   ${card("📣","rgba(224,49,49,.1)","Ads (GMV Max)",T.ads,row("Chi quảng cáo (đã VAT)",tr(T.ads.chi))+row("ROI (doanh thu thực / chi)",tbX(T.ads.roi))+row("ROAS (GMV / chi) · hòa vốn",tbX(T.ads.roas)+" · "+tbX(T.ads.hoaVon))+row("Chi / đơn",T.ads.cpo?nf(Math.round(T.ads.cpo))+"đ":"—"))}
   ${card("🤝","rgba(224,96,126,.12)","Booking KOC",T.koc,T.has.koc?row("KOC lên video trong tháng",nf(T.koc.nguoi)+" người")+row("Video KOC đăng trong tháng",nf(T.koc.video)+" video")+row("Video KOC ra đơn",nf(T.koc.videoDon)+" · "+tbP(T.koc.videoDon,T.koc.video))+row("GMV nhờ KOC",tr(T.koc.gmv))+row("Hoa hồng ("+T.koc.hhNguon+") · hàng mẫu",tr(T.koc.hh)+" · "+nf(T.koc.mau)+" mẫu")+row("ROI (GMV / hoa hồng)",tbX(T.koc.roi)):`<p class="hint">Chưa có file Transaction Analysis cho kỳ này.</p>`)}
   ${card("🔴","rgba(42,157,143,.14)","Live",T.live,T.has.live?row("Buổi live",nf(T.live.phien)+" · "+nf(T.live.phienGmv)+" có đơn")+row("GMV live",tr(T.live.gmv)+" · "+nf(T.live.don)+" đơn")+row("Lượt xem",nf(T.live.xem))+row("GMV / 1.000 lượt xem",T.live.gmv1000?nf(Math.round(T.live.gmv1000))+"đ":"—"):`<p class="hint">Chưa có file LIVE cho kỳ này.</p>`)}</div>`;
  const sp=OM.length?OM[OM.length-1].sp:[];
  const top=`<section class="card"><div class="card-h"><h2>Top sản phẩm bán chạy</h2><span class="hint">${OM.length?"tháng "+tsbKyL(OM[OM.length-1].ky)+" · ":""}"Ưu tiên quảng cáo" do web tính từ biên lãi bên quản trị</span></div>
   ${sp.length?tbl(["#","Sản phẩm","Số bán","Doanh thu","% kênh","Ưu tiên quảng cáo"],sp.slice(0,8).map((p,i)=>`<tr><td><span class="tb-rk">${i+1}</span></td><td>${esc(p.n.slice(0,60))}</td><td class="n">${nf(p.q)}</td><td class="n">${tr(p.dt)}</td><td class="n">${tbP(p.dt,OM[OM.length-1].dt)}</td><td>${tbPill(p.pri)}</td></tr>`)):`<p class="empty">Chờ kế toán tải báo cáo quyết toán tháng.</p>`}</section>`;
  m.innerHTML=H("TikTok Shop · Hiệu quả Marketing",last?"số theo ngày có tới "+tsbVn(last.day):"")+kp+todo+teams+top
   +`<details class="card"><summary><b>Số chi tiết: 5 làn GMV, quảng cáo theo ngày, video & LIVE, KOC, từng ngày</b></summary>${tsbOpsBody()}</details>`
   +(tsbCanUp()?tsbUpOpsCard():"")+srcNote("Doanh thu thực, đơn, món, top sản phẩm: báo cáo quyết toán kế toán tải. Hiệu suất: file team TikTok tải (Key metrics, LIVE, Transaction Analysis, Creator List, Campaign overview).");
  tsbOpsBind(m);
}
PAGES.bc_tiktok=m=>{if(tsbAdm())return tbAdmPage(m);_pb(tbOpsPage,"tts")(m)};
