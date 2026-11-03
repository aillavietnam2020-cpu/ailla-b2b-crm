/* =====================================================================
   TỔNG QUAN CONTENT (dashboard, chị Hoa duyệt demo 02/11/2026)
   Chỉ số và kết quả của cả team Content cho CEO và Lead: làm ra bao nhiêu video, đang ở bước nào, tiến độ từng kênh,
   từng sản phẩm, năng suất nhân sự, top video win. Việc cụ thể từng người (trễ, chờ duyệt, tải việc) nằm ở
   Công việc › Tổng quan việc (tqviec.js). Theo ô chọn tháng trên cùng (tqcMonth trong tongquancontent.js).
   ===================================================================== */
const DQ_CSS=`<style>
.dq .dqk{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:10px;margin-bottom:14px}
.dq .dqk>div{background:var(--surface,#fff);border-radius:14px;padding:12px 14px;border-top:4px solid #4f46e5}
.dq .dqk small{display:block;color:#6b7280;font-size:12px}.dq .dqk b{display:block;font-size:24px;line-height:1.25}.dq .dqk i{font-style:normal;font-size:11.5px;color:#6b7280}
.dq .dqk .g{border-color:#16a34a}.dq .dqk .r{border-color:#dc2626}.dq .dqk .a{border-color:#d97706}.dq .dqk .b{border-color:#2563eb}.dq .dqk .p{border-color:#7c3aed}
.dq .dqal{background:#fef2f2;border:1px solid #fecaca;border-radius:14px;padding:10px 14px;margin-bottom:14px;display:flex;gap:18px;flex-wrap:wrap;font-size:13px}.dq .dqal b{color:#b91c1c}
.dq .dqal.ok{background:#f0fdf4;border-color:#bbf7d0}.dq .dqal.ok b{color:#166534}
.dq h2.dqh{font-size:15px;margin:4px 0 10px;display:flex;align-items:baseline;gap:8px}.dq h2.dqh small{color:#6b7280;font-weight:400;font-size:12px}
.dq .dqch{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}
.dq .dqch>div{background:var(--surface,#fff);border-radius:14px;padding:12px 14px}.dq .dqch .hd{display:flex;justify-content:space-between;gap:6px;font-weight:600}.dq .dqch .hd span{font-weight:400;color:#6b7280;font-size:12px;white-space:nowrap}
.dq .dqch .big{font-size:22px;font-weight:700;margin-top:4px}.dq .dqch .big span{font-size:14px;font-weight:400;color:#6b7280}
.dq .dqbar{height:9px;background:#eef0f7;border-radius:6px;overflow:hidden;display:flex;margin:8px 0 6px}.dq .dqbar i{display:block;height:100%}
.dq .dqleg{display:flex;gap:10px;font-size:11.5px;color:#6b7280;flex-wrap:wrap}.dq .dqleg em{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px}
.dq .dqg2{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px;margin-bottom:14px}
.dq .card.dqc{padding:16px 18px;margin:0}
.dq table.dqt{width:100%;border-collapse:collapse;font-size:13px}.dq .dqt th{color:#6b7280;font-weight:500;text-align:right;padding:6px 8px;border-bottom:1px solid #eceef5;font-size:12px}.dq .dqt td{padding:7px 8px;border-bottom:1px solid #eceef5;text-align:right}.dq .dqt th:first-child,.dq .dqt td:first-child{text-align:left}.dq .dqt tr.tot td{font-weight:700}
.dq .pc{display:inline-block;min-width:44px;padding:2px 6px;border-radius:6px;font-weight:600;font-size:12px;text-align:center}.dq .pc.g{background:#dcfce7;color:#166534}.dq .pc.a{background:#fef3c7;color:#92400e}.dq .pc.r{background:#fee2e2;color:#991b1b}
.dq .dqfun{display:flex;flex-direction:column;gap:7px}.dq .dqfr{display:grid;grid-template-columns:110px minmax(0,1fr) 44px;align-items:center;gap:8px;font-size:13px}.dq .dqfr .b{height:20px;border-radius:6px;min-width:3px}
.dq .red{color:#dc2626;font-weight:600}.dq .mut{color:#6b7280}.dq .mono{font-family:ui-monospace,monospace;font-size:12px;color:#6b7280}
.dq .empty{color:#6b7280;padding:14px 0;text-align:center}
.dq .dqtabs{margin-bottom:14px}
.dq .dqdd{position:relative;font-size:13px;font-weight:400}.dq .dqddb{border:1px solid #c7d2fe;background:#fff;color:#4338ca;border-radius:8px;padding:6px 12px;cursor:pointer}.dq .dqddb.on{background:#eef2ff}.dq .dqddb b{font-weight:600}
.dq .dqddm{position:absolute;right:0;top:calc(100% + 4px);z-index:50;min-width:210px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 10px 28px rgba(0,0,0,.14);padding:6px}.dq .dqddm[hidden]{display:none}.dq .dqddh{font-size:11.5px;color:#6b7280;padding:4px 10px 6px}
.dq .dqddm button{display:block;width:100%;text-align:left;border:0;background:none;padding:8px 10px;border-radius:7px;cursor:pointer;color:#111827}.dq .dqddm button:hover{background:#f3f4f6}.dq .dqddm button.on{color:#4338ca;font-weight:600}
@media(max-width:1100px){.dq .dqk{grid-template-columns:repeat(4,minmax(0,1fr))}.dq .dqch{grid-template-columns:repeat(2,minmax(0,1fr))}.dq .dqg2{grid-template-columns:1fr}}
@media(max-width:640px){.dq .dqk{grid-template-columns:repeat(2,minmax(0,1fr))}.dq .dqch{grid-template-columns:1fr}}
</style>`;
/* bước của một thẻ video theo nhóm dashboard */
function dqStep(c){
  const s=c.step;if(s==="xong")return "dang";if(s==="dang")return "cho";if(s==="dkb")return "dkb";if(s==="dvd"||s==="dceo")return "dvd";
  if((c.gopy||[]).length&&["kb","edit","worker","quay"].includes(s))return "sua";if(s==="cg"||!c.nguoi)return "cg";
  if(s==="kb"&&!c.hookText&&!c.noiDung&&!c.nguoiKB)return "chua";return "lam"}
const dqPct=(a,b)=>b?Math.round(a/b*100):0;
const dqPc=p=>`<span class="pc ${p>=60?"g":p>=35?"a":"r"}">${p}%</span>`;
function dqCount(C){const n={cg:0,chua:0,lam:0,dkb:0,dvd:0,sua:0,cho:0,dang:0};C.forEach(c=>{n[dqStep(c)]++});n.doi=n.dkb+n.dvd;n.duyet=n.cho+n.dang;return n}
/* mục tiêu số video: kế hoạch từng sản phẩm × kênh (Fanpage: tuyến bài) */
function dqPlanOf(kenh,sku){
  const d=D(),ch=chOf(kenh);
  if(kenh&&!ch.needId&&!sku)return sum(d.fpPlan||[],r=>+r.sl||0);
  return sum(ptPairs().filter(x=>(!kenh||x.kenh===kenh)&&(!sku||x.sku===sku)),x=>+x.sl||0)}
function pDqContent(m){
  const M=tqcMonth(),d=M.d,C=(d.cards||[]).filter(c=>c.nguon!=="Order Digital"),N=dqCount(C),past=M.past;
  const plan=past?C.length:(sum(CHANNELS,ch=>dqPlanOf(ch.k))||C.length),today=M.today,need=past?plan:Math.min(plan,Math.round(plan*Math.min(today,M.nd)/M.nd));
  const posted=C.filter(c=>c.step==="xong"),gmv=sum(posted,c=>+c.gmv||0),don=sum(posted,c=>+c.don||0);
  const set=D().settings||{},wOrd=+set.winnerOrders||100,W=(typeof winners==="function"?winners():[]).filter(w=>w.loai==="Winner"),winNew=W.filter(w=>w.cardId).length,winGoal=+(D().kpiTargets||{}).winMoi||0;
  /* ---- 8 ô số ---- */
  const k=(cl,ic,lb,v,sub)=>`<div class="${cl}"><small>${ic} ${lb}</small><b>${v}</b><i>${sub}</i></div>`;
  const kpis=`<div class="dqk">${k("","🎯","Mục tiêu tháng",nf(plan),past?"video tháng "+M.mon:CHANNELS.filter(ch=>dqPlanOf(ch.k)).length+" kênh có kế hoạch")}
   ${k("b","🎬","Đã sản xuất",nf(N.duyet),"đã duyệt · "+dqPct(N.duyet,plan)+"%")}
   ${k("g","✅","Đã đăng",nf(N.dang),past?"cả tháng":`nhịp cần ${nf(need)}${N.dang<need?` · <span class="red">−${need-N.dang}</span>`:""}`)}
   ${k("a","✂️","Đang làm",nf(N.lam),"kịch bản, quay, dựng")}
   ${k("p","⏳","Chờ duyệt",nf(N.doi),"kịch bản "+N.dkb+" · video "+N.dvd)}
   ${k("r","🔧","Cần sửa",nf(N.sua),"bị trả lại")}
   ${k("","📋","Chưa giao",nf(N.cg+N.chua),"chưa ai nhận")}
   ${k("b","📤","Chờ đăng",nf(N.cho),"duyệt xong, chưa đăng")}</div>`;
  /* ---- tiến độ từng kênh ---- */
  const chRows=CHANNELS.map(ch=>{const cs=C.filter(c=>c.kenh===ch.k),n=dqCount(cs),pl=past?cs.length:(dqPlanOf(ch.k)||cs.length),nd=past?pl:Math.min(pl,Math.round(pl*Math.min(today,M.nd)/M.nd));return {ch,n,pl,nd,cham:Math.max(0,nd-n.dang)}});
  const al=[];
  chRows.forEach(r=>{if(!past&&r.pl&&r.cham>=3)al.push(`${esc(r.ch.short)} chậm <b>${r.cham} ${r.ch.needId?"video":"bài"}</b> so với nhịp`)});
  /* ---- tình trạng từng sản phẩm ---- */
  const skus=[...new Set((past?[]:ptPairs().filter(x=>x.sl>0).map(x=>x.sku)).concat(C.map(c=>c.sku)))];
  const pr=skus.map(s=>{const cs=C.filter(c=>c.sku===s),n=dqCount(cs),pl=past?cs.length:(dqPlanOf("",s)||cs.length);return {s,n,pl,p:dqPct(n.dang,pl)}}).sort((a,b)=>b.pl-a.pl);
  if(!past&&today>=10)pr.filter(r=>r.pl>=10&&r.p<dqPct(today,M.nd)/2).forEach(r=>al.push(`${esc(sk(r.s).n)} mới đạt <b>${r.p}%</b> kế hoạch`));
  if(N.sua)al.push(`<b>${N.sua}</b> video bị trả lại đang chờ sửa`);
  if(!past&&winGoal&&winNew<winGoal)al.push(`Video win mới: <b>${winNew}/${winGoal}</b>`);
  const alert=al.length?`<div class="dqal"><span>⚠️ <b>Cần chú ý:</b></span>${al.slice(0,6).map(x=>`<span>${x}</span>`).join("")}</div>`:(C.length?`<div class="dqal ok"><span>✅ <b>Đúng nhịp:</b></span><span>không kênh nào chậm, không video nào chờ sửa.</span></div>`:"");
  const seg=(n,tot)=>{const T=Math.max(tot,1),w=v=>(v/T*100).toFixed(1)+"%";return `<div class="dqbar"><i style="width:${w(n.dang)};background:#16a34a"></i><i style="width:${w(n.cho)};background:#2563eb"></i><i style="width:${w(n.lam+n.sua)};background:#d97706"></i><i style="width:${w(n.doi)};background:#7c3aed"></i></div>`};
  const chHtml=`<h2 class="dqh">📡 Tiến độ theo kênh <small>${past?"tháng "+M.mon:"kế hoạch tháng · thanh màu = trạng thái từng video"}</small></h2><div class="dqch">${chRows.map(r=>`<div class="clk" data-dqch="${esc(r.ch.k)}" title="Bấm để xem chi tiết kênh"><div class="hd">${esc(r.ch.short)}<span>giữ kênh: ${esc(userName(chanOwner(r.ch.k))||"chưa đặt")}</span></div>
   <div class="big">${nf(r.n.dang)} <span>/ ${nf(r.pl)} đã đăng</span></div>${seg(r.n,r.pl)}
   <div class="dqleg"><span><em style="background:#16a34a"></em>Đăng ${r.n.dang}</span><span><em style="background:#2563eb"></em>Chờ đăng ${r.n.cho}</span><span><em style="background:#d97706"></em>Đang làm ${r.n.lam+r.n.sua}</span>${r.n.doi?`<span><em style="background:#7c3aed"></em>Chờ duyệt ${r.n.doi}</span>`:""}${!past&&r.cham&&r.pl?`<span class="red">chậm ${r.cham}</span>`:""}${!r.pl?`<span>chưa có kế hoạch</span>`:""}</div></div>`).join("")}</div>`;
  const prHtml=`<div class="card dqc"><h2 class="dqh">📦 Tình trạng theo sản phẩm <small>bấm một dòng để mở Điều phối đúng sản phẩm</small></h2>${pr.length?`<table class="dqt"><tr><th>Sản phẩm</th><th>Mục tiêu</th><th>Chưa làm</th><th>Đang làm</th><th>Chờ duyệt</th><th>Cần sửa</th><th>Đã duyệt</th><th>Đã đăng</th><th>% đạt</th></tr>
   ${pr.map(r=>`<tr class="clk" data-dqsku="${esc(r.s)}"><td>${swatch(r.s)}${esc(sk(r.s).n)}</td><td>${nf(r.pl)}</td><td>${r.n.cg+r.n.chua}</td><td>${r.n.lam}</td><td>${r.n.doi}</td><td>${r.n.sua}</td><td>${r.n.duyet}</td><td>${r.n.dang}</td><td>${dqPc(r.p)}</td></tr>`).join("")}
   <tr class="tot"><td>Tổng</td><td>${nf(sum(pr,r=>r.pl))}</td><td>${N.cg+N.chua}</td><td>${N.lam}</td><td>${N.doi}</td><td>${N.sua}</td><td>${N.duyet}</td><td>${N.dang}</td><td>${dqPc(dqPct(N.dang,sum(pr,r=>r.pl)))}</td></tr></table>`:`<p class="empty">Chưa có sản phẩm nào trong kế hoạch tháng. Thêm ở Kế hoạch tháng › ① Kế hoạch.</p>`}</div>`;
  /* ---- biểu đồ cộng dồn: chị Hoa 02/11 bỏ khỏi trang, giữ phần tính để dùng lại nếu cần ---- */
  let acc=0;const act=[];for(let x=1;x<=today;x++){acc+=posted.filter(c=>(+c.ngayDang||+c.day)===x).length;act.push(acc)}
  const Wd=520,Hh=170,mx=Math.max(1,plan,acc),px=x=>30+(x-1)/(Math.max(2,M.nd)-1)*(Wd-40),py=v=>Hh-10-(v/mx)*(Hh-30);
  const ticks=[1,8,15,22,M.nd],lbl=x=>String(x).padStart(2,"0")+"/"+String(M.mon).padStart(2,"0");
  const chart=`<div class="card dqc"><h2 class="dqh">📈 Video đăng cộng dồn <small>thực tế so với nhịp kế hoạch</small></h2><svg viewBox="0 0 ${Wd} ${Hh+24}" width="100%" style="display:block">
   <g stroke="#eceef5"><line x1="30" y1="${py(mx)}" x2="${Wd-10}" y2="${py(mx)}"/><line x1="30" y1="${py(mx/2)}" x2="${Wd-10}" y2="${py(mx/2)}"/><line x1="30" y1="${py(0)}" x2="${Wd-10}" y2="${py(0)}"/></g>
   <g style="font-size:11px;fill:#6b7280"><text x="0" y="${py(mx)+4}">${nf(mx)}</text><text x="0" y="${py(0)+4}">0</text>${ticks.map(x=>`<text x="${px(x)-14}" y="${Hh+16}">${lbl(x)}</text>`).join("")}</g>
   ${plan?`<polyline fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 5" points="${px(1)},${py(0)} ${px(M.nd)},${py(plan)}"/>`:""}
   ${act.length?`<polyline fill="none" stroke="#4f46e5" stroke-width="3" points="${act.map((v,i)=>px(i+1).toFixed(1)+","+py(v).toFixed(1)).join(" ")}"/><circle cx="${px(act.length)}" cy="${py(acc)}" r="4.5" fill="#4f46e5"/>`:""}</svg>
   <div class="dqleg"><span><em style="background:#4f46e5"></em>Thực tế ${nf(acc)}</span><span><em style="background:#94a3b8"></em>Nhịp kế hoạch (${nf(plan)})</span></div></div>`;
  /* ---- năng suất nhân sự ---- */
  const who=c=>c.nguoiEdit||c.nguoi||c.nguoiKB||"";
  const ids=[...new Set(C.flatMap(c=>[c.nguoi,c.nguoiKB,c.nguoiEdit]).filter(Boolean))];
  const ppl=ids.map(id=>{const mine=C.filter(c=>[c.nguoi,c.nguoiKB,c.nguoiEdit].includes(id)),own=C.filter(c=>who(c)===id),hc=mine.flatMap(c=>(c.hanCu||[]).filter(h=>h.han&&h.xong)),ontime=hc.length?dqPct(hc.filter(h=>+h.xong<=+h.han).length,hc.length):null;
    const ps=own.filter(c=>c.step==="xong"),g=sum(ps,c=>+c.gmv||0);return {id,giao:mine.length,duyet:own.filter(c=>["dang","xong"].includes(c.step)).length,dang:ps.length,ontime,win:ps.filter(c=>(+c.don||0)>=wOrd).length,gmv:g,gpv:ps.length?g/ps.length:0}}).filter(r=>r.giao).sort((a,b)=>b.dang-a.dang||b.giao-a.giao);
  const pplHtml=`<div class="card dqc"><h2 class="dqh">🏅 Năng suất nhân sự <small>${past?"tháng "+M.mon:"tháng này"}</small></h2>${ppl.length?`<table class="dqt"><tr><th>Nhân sự</th><th>Được giao</th><th>Đã duyệt</th><th>Đã đăng</th><th>Đúng hạn</th><th>Video win</th><th>GMV</th><th>GMV / video</th></tr>
   ${ppl.map(r=>`<tr><td>${esc(userName(r.id)||r.id)}</td><td>${r.giao}</td><td>${r.duyet}</td><td>${r.dang}</td><td>${r.ontime===null?`<span class="mut">—</span>`:dqPc(r.ontime)}</td><td>${r.win}</td><td>${money(r.gmv)}</td><td>${money(r.gpv)}</td></tr>`).join("")}</table>`:`<p class="empty">Chưa giao video nào trong tháng.</p>`}</div>`;
  /* ---- video đang ở bước nào ---- */
  const F=[["Chưa giao",N.cg+N.chua,"#cbd5e1"],["Đang làm",N.lam,"#f59e0b"],["Chờ duyệt kịch bản",N.dkb,"#a78bfa"],["Chờ duyệt video",N.dvd,"#8b5cf6"],["Cần sửa",N.sua,"#ef4444"],["Chờ đăng",N.cho,"#3b82f6"],["Đã đăng",N.dang,"#22c55e"]],fm=Math.max(1,...F.map(f=>f[1]));
  const fun=`<div class="card dqc"><h2 class="dqh">🎞️ Video đang ở bước nào <small>toàn team</small></h2><div class="dqfun">${F.map(f=>`<div class="dqfr"><span>${f[0]}</span><div class="b" style="width:${(f[1]/fm*100).toFixed(1)}%;background:${f[2]}"></div><b>${f[1]}</b></div>`).join("")}</div></div>`;
  /* ---- top video win ---- */
  const win=dqWinTop(set);
  /* 2 tab (chị Hoa 02/11): Hiệu quả kênh = kết quả bán hàng; Tiến độ sản xuất = khối lượng việc của team */
  let tab="sx";try{tab=localStorage.getItem("ailla_dqtab")||"sx"}catch(e){}if(!["hq","sx"].includes(tab))tab="sx";
  const tabs=`<div class="seg ptk dqtabs">${[["sx","🎬 Tiến độ sản xuất"],["hq","💹 Hiệu quả kênh"]].map(([k2,t])=>`<button type="button" data-dqtab="${k2}" class="${tab===k2?"on":""}">${t}</button>`).join("")}</div>`;
  const body=tab==="hq"?dqHieuQua(C,past,M,set)+win:kpis+alert+chHtml+prHtml+`<div class="dqg2">${pplHtml}${fun}</div>`;
  m.innerHTML=DQ_CSS+H("Tổng quan Content",past?"Tháng "+M.mon:"Tháng "+M.mon+" · cập nhật theo dữ liệu trên web")+`<div class="dq">${tabs}${body}</div>`;
  dqDropBind(m);
  m.querySelectorAll("[data-dqwin]").forEach(r=>r.onclick=e=>{if(e.target.closest("a"))return;dqWinGo(r.dataset.dqwin)});
  m.querySelectorAll("[data-dqtab]").forEach(b=>b.onclick=()=>{try{localStorage.setItem("ailla_dqtab",b.dataset.dqtab)}catch(e){}renderMain()});
  m.querySelectorAll("[data-dqsku]").forEach(r=>r.onclick=()=>{if(typeof bvGo==="function"){const s=r.dataset.dqsku,kn=(C.find(c=>c.sku===s)||{}).kenh||(ptPairs().find(x=>x.sku===s)||{}).kenh||"TikTok chính";bvGo(kn,s,"")}});
  m.querySelectorAll("[data-dqch]").forEach(e=>e.onclick=()=>{const r=chRows.find(x=>x.ch.k===e.dataset.dqch);if(r)dqChOpen(r,C.filter(c=>c.kenh===r.ch.k),past,M)});
  if(typeof bindCommon==="function")bindCommon(m);
}
/* Bộ lọc sổ xuống (chị Hoa 02/11, kiểu "Thêm bộ lọc"): nút ghi lựa chọn đang xem, bấm sổ danh sách, chọn xong lưu theo máy rồi vẽ lại */
function dqDrop(key,lb,opts,cur){const o=opts.find(x=>x[0]===cur)||opts[0];
  return `<span class="dqdd"><button type="button" class="dqddb${o[0]!==opts[0][0]?" on":""}" data-dqdd="1">${esc(lb)}: <b>${esc(o[1])}</b> ▾</button><div class="dqddm" hidden><div class="dqddh">${esc(lb)}</div>${opts.map(([v,t])=>`<button type="button" data-dqddk="${esc(key)}" data-dqddv="${esc(v)}" class="${v===o[0]?"on":""}">${v===o[0]?"✓ ":""}${esc(t)}</button>`).join("")}</div></span>`}
function dqDropBind(m){
  m.querySelectorAll("[data-dqdd]").forEach(b=>b.onclick=e=>{e.stopPropagation();const mm=b.nextElementSibling,op=mm.hidden;m.querySelectorAll(".dqddm").forEach(x=>x.hidden=true);mm.hidden=!op;
    if(op){const off=ev=>{if(!mm.contains(ev.target)){mm.hidden=true;document.removeEventListener("mousedown",off,true)}};setTimeout(()=>document.addEventListener("mousedown",off,true),0)}});
  m.querySelectorAll("[data-dqddv]").forEach(b=>b.onclick=()=>{try{localStorage.setItem(b.dataset.dqddk,b.dataset.dqddv)}catch(e){}renderMain()})}
/* Top video win (chị Hoa 02/11): gộp video win inhouse (video shop, từ báo cáo TikTok) và video win KOC, lọc Tất cả / Inhouse / KOC.
   Bấm một dòng: mở trang Video win đúng tab và mở luôn khung nhân bản của video đó. */
function dqWinTop(set){
  const d=D(),wOrd=+set.winnerOrders||100,pot=+set.potential||30;let f="all";try{f=localStorage.getItem("ailla_dqwf")||"all"}catch(e){}if(!["all","in","koc"].includes(f))f="all";
  const nb=ref=>typeof winVars==="function"?winVars(ref).length:0,lo=n=>n>=wOrd?"Winner":"Tiềm năng";
  const IN=(typeof winners==="function"?winners():[]).filter(w=>w.loai!=="Có đơn").map(w=>({g:"in",go:"in|TT-"+w.key,ten:w.ten,id:w.key,sku:w.sku,kenh:chOf(w.kenh).short,who:userName(w.nguoi)||"—",view:+w.view||0,don:+w.don||0,gmv:+w.gmv||0,loai:w.loai,ref:"TT-"+w.key}));
  const KO=(d.kocVideos||[]).filter(v=>(+v.don||0)>=pot).map(v=>{const r=(d.winResearch||[]).find(x=>x.kocId===v.id);return {g:"koc",go:"koc|"+(r?r.id:""),ten:v.ten,id:v.id,sku:v.sku,kenh:"KOC @"+(v.acc||""),who:"—",view:+v.view||0,don:+v.don||0,gmv:+v.gmv||0,loai:lo(+v.don||0),ref:r?r.id:"",duyet:!!r}});
  const all=(f==="in"?IN:f==="koc"?KO:IN.concat(KO)).sort((a,b)=>b.don-a.don||b.gmv-a.gmv).slice(0,12),medal=["🥇","🥈","🥉"];
  const chip=(k,t,n)=>`<button type="button" data-dqwf="${k}" class="${f===k?"on":""}">${t} <span class="mut">${n}</span></button>`;
  const st=x=>x.loai!=="Winner"?`<span class="mut">tiềm năng</span>`:x.g==="koc"&&!x.duyet?`<span class="mut">chưa vào kho win</span>`:(()=>{const n=nb(x.ref);return n?n+" bản":`<span class="red">chưa nhân bản</span>`})();
  return `<div class="card dqc" style="margin-top:14px"><h2 class="dqh" style="flex-wrap:wrap">🏆 Top video win <small>≥${wOrd} đơn là Win, ≥${pot} đơn là tiềm năng · bấm một dòng để xem chi tiết và nhân bản</small><span style="flex:1"></span>${dqDrop("ailla_dqwf","Nguồn",[["all","Tất cả ("+(IN.length+KO.length)+")"],["in","Video win inhouse ("+IN.length+")"],["koc","Video win KOC ("+KO.length+")"]],f)}</h2>
   ${all.length?`<table class="dqt"><tr><th>#</th><th>Tên video</th><th>ID video</th><th>Nguồn</th><th>Sản phẩm</th><th>Kênh</th><th>Người làm</th><th>View</th><th>Đơn</th><th>GMV</th><th>Đã nhân bản</th></tr>
   ${all.map((x,i)=>`<tr class="clk" data-dqwin="${esc(x.go)}"><td>${medal[i]||i+1}</td><td style="text-align:left;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(x.ten||"")}">${esc(x.ten||"—")}</td><td class="mono" style="white-space:nowrap">${esc(x.id)}</td><td>${x.g==="koc"?"KOC":"Inhouse"}</td><td>${esc(sk(x.sku).n)}</td><td>${esc(x.kenh)}</td><td>${esc(x.who)}</td><td>${nf(x.view)}</td><td>${nf(x.don)}</td><td>${money(x.gmv)}</td><td>${st(x)}</td></tr>`).join("")}</table>`:`<p class="empty">Chưa có video nào đạt mức tiềm năng.</p>`}</div>`}
function dqWinGo(go){const [g,ref]=String(go).split("|");PAGE="win";if(typeof modGroups==="function"&&typeof curMod==="function"&&!modGroups(curMod()).some(x=>x[1].some(i=>i[0]==="win")))MOD="";SUB.win=g==="koc"?"koc":"rank";render();scrollTo(0,0);
  if(ref&&typeof hyWin==="function")setTimeout(()=>hyWin(ref),150);else if(g==="koc")toast("Video KOC này chưa duyệt vào kho win: vào KOC / Affiliate bấm “✓ Vào kho win” để nhân bản")}
/* Hiệu quả kênh (chị Hoa duyệt 02/11): bán được gì, video có được xem không, xem rồi có mua không, video win.
   Số view / click / đơn / GMV của từng video lấy từ báo cáo TikTok nhập hằng tuần; video chưa có báo cáo không tính vào view. */
function dqHieuQua(C,past,M,set){
  const d=D(),wOrd=+set.winnerOrders||100,pot=+set.potential||30,chs=CHANNELS.filter(ch=>ch.needId);
  const yr=M.mon>MONTH.mon?MONTH.year-1:MONTH.year,ym=yr+"-"+String(M.mon).padStart(2,"0");
  const gTarget=k=>sum(d.products||[],p=>sum(pKenhs(p).filter(e=>!k||e.kenh===k),e=>+e.gmv||0));
  const st=cs=>{const ps=cs.filter(c=>c.step==="xong"),rp=ps.filter(c=>c.hist||+c.view>0),view=sum(rp,c=>+c.view||0),click=sum(rp,c=>+c.click||0),don=sum(ps,c=>+c.don||0),gmv=sum(ps,c=>+c.gmv||0);
    return {dang:ps.length,rp:rp.length,view,click,don,gmv,gpv:ps.length?gmv/ps.length:0,vtb:rp.length?view/rp.length:0,dead:rp.filter(c=>(+c.view||0)<1000).length,ctr:view?click/view*100:0,chot:click?don/click*100:0,
      win:ps.filter(c=>(+c.don||0)>=wOrd).length,tn:ps.filter(c=>(+c.don||0)>=pot&&(+c.don||0)<wOrd).length,top:ps.filter(c=>+c.gmv>0).sort((a,b)=>b.gmv-a.gmv).slice(0,5)}};
  const R=chs.map(ch=>({ch,s:st(C.filter(c=>c.kenh===ch.k)),gt:gTarget(ch.k)})).filter(r=>r.s.dang||r.gt||dqPlanOf(r.ch.k)),T=st(C.filter(c=>chOf(c.kenh).needId)),gtT=gTarget("");
  const p1=v=>v?v.toFixed(1).replace(".",",")+"%":"—",gcell=(g,t)=>`${money(g)}${t?`<div class="mut" style="font-size:11px">${dqPct(g,t)}% mục tiêu ${money(t)}</div>`:""}`;
  const row=(lb,s,gt,cls)=>`<tr class="${cls||""}"><td>${lb}</td><td>${nf(s.dang)}</td><td>${gcell(s.gmv,gt)}</td><td>${nf(s.don)}</td><td>${money(s.gpv)}</td><td>${nf(s.view)}</td><td>${nf(Math.round(s.vtb))}</td><td>${s.rp?(s.dead?`<span class="red">${s.dead}</span>`:"0"):"—"}</td><td>${p1(s.ctr)}</td><td>${p1(s.chot)}</td><td>${nf(s.win)}</td><td>${nf(s.tn)}</td><td>${s.dang?dqPc(dqPct(s.win,s.dang)):"—"}</td></tr>`;
  const imp=(d.imports||[]).find(i=>i.loai==="TikTok"),noRp=T.dang-T.rp;
  const tbl=`<div class="card dqc" style="margin-bottom:14px"><h2 class="dqh">💹 Hiệu quả kênh <small>${imp?"báo cáo TikTok nhập gần nhất: "+esc(imp.range||imp.at||""):"chưa nhập báo cáo TikTok"}${noRp>0?` · ${noRp} video đã đăng chưa có số view`:""}</small></h2>
   <div style="overflow-x:auto"><table class="dqt"><tr><th>Kênh</th><th>Đã đăng</th><th>GMV</th><th>Đơn</th><th>GMV / video</th><th>View</th><th>View TB / video</th><th title="Video đã có báo cáo mà dưới 1.000 view">Video &lt;1k view</th><th title="Click vào sản phẩm / view">Tỷ lệ bấm</th><th title="Đơn / click">Tỷ lệ chốt</th><th>Win (≥${wOrd} đơn)</th><th>Tiềm năng</th><th>Tỷ lệ win</th></tr>
   ${R.map(r=>row(esc(r.ch.short),r.s,r.gt)).join("")||`<tr><td colspan="13" class="empty">Chưa có video đăng ở kênh TikTok nào.</td></tr>`}${R.length>1?row("Tất cả kênh",T,gtT,"tot"):""}</table></div></div>`;
  /* video win: nội bộ, KOC, đã nhân bản */
  const inM=v=>{const H=v.hist||[];return H.length?H.some(h=>String(h.f||"").startsWith(ym)||String(h.t||"").startsWith(ym)):!past};
  const koc=(d.kocVideos||[]).filter(inM),kW=koc.filter(v=>(+v.don||0)>=wOrd),kT=koc.filter(v=>(+v.don||0)>=pot&&(+v.don||0)<wOrd);
  const W=(typeof winners==="function"?winners():[]).filter(w=>w.loai==="Winner"),nbN=w=>typeof winVars==="function"?winVars("TT-"+w.key).length:0,daNb=W.filter(w=>nbN(w)>0).length;
  const k=(cl,ic,lb,v,sub)=>`<div class="${cl}"><small>${ic} ${lb}</small><b>${v}</b><i>${sub}</i></div>`;
  const wins=`<div class="dqk" style="grid-template-columns:repeat(4,minmax(0,1fr))">${k("b","✨","Tiềm năng nội bộ",nf(T.tn),"≥"+pot+" đơn")}${k("g","🤝","Win KOC",nf(kW.length),kT.length+" video KOC tiềm năng")}${k("a","🧬","Win đã nhân bản",nf(daNb),"trên "+W.length+" video win")}${k("r","⏳","Win chưa nhân bản",nf(W.length-daNb),"nên giao nhân bản")}</div>`;
  /* top 5 video theo GMV từng kênh */
  const tops=R.filter(r=>r.s.top.length);
  const topHtml=tops.length?`<h2 class="dqh">🔝 Top 5 video theo GMV từng kênh</h2><div class="dqch">${tops.map(r=>`<div><div class="hd">${esc(r.ch.short)}</div><table class="dqt"><tr><th>Video</th><th>View</th><th>Đơn</th><th>GMV</th></tr>${r.s.top.map(c=>`<tr class="clk" data-card="${esc(c.id)}"><td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(c.hookText||c.yTuong||"")}">${esc(String(c.hookText||c.yTuong||c.id).slice(0,40))}</td><td>${nf(c.view)}</td><td>${nf(c.don)}</td><td>${money(c.gmv)}</td></tr>`).join("")}</table></div>`).join("")}</div>`:"";
  const kk=(cl,ic,lb,v,sub)=>`<div class="${cl}"><small>${ic} ${lb}</small><b>${v}</b><i>${sub}</i></div>`;
  const head=`<div class="dqk">${kk("g","💰","GMV từ video",money(T.gmv),gtT?dqPct(T.gmv,gtT)+"% mục tiêu "+money(gtT):"chưa đặt mục tiêu GMV")}${kk("b","🛒","Đơn",nf(T.don),"từ "+nf(T.dang)+" video đã đăng")}${kk("","💵","GMV / video",money(T.gpv),"trung bình mỗi video")}${kk("p","👁️","View",nf(T.view),"TB "+nf(Math.round(T.vtb))+" / video")}${kk("a","👆","Tỷ lệ bấm",p1(T.ctr),"click / view")}${kk("g","✅","Tỷ lệ chốt",p1(T.chot),"đơn / click")}${kk("r","💤","Video <1k view",nf(T.dead),T.rp?"trên "+nf(T.rp)+" video có số":"chưa có báo cáo")}${kk("p","🏆","Video win",nf(T.win),"≥"+wOrd+" đơn · tỷ lệ "+(T.dang?dqPct(T.win,T.dang):0)+"%")}</div>`;
  /* top sản phẩm bán chạy: GMV từ video đã đăng trong tháng, cộng các kênh */
  let spk="";try{spk=localStorage.getItem("ailla_dqspk")||""}catch(e){}if(spk&&!chs.some(ch=>ch.k===spk))spk="";
  const ps=C.filter(c=>c.step==="xong"&&chOf(c.kenh).needId&&(!spk||c.kenh===spk)),sp=[...new Set(ps.map(c=>c.sku))].map(s2=>{const L=ps.filter(c=>c.sku===s2);return {s:s2,n:L.length,g:sum(L,c=>+c.gmv||0),dn:sum(L,c=>+c.don||0),v:sum(L,c=>+c.view||0),ch:[...new Set(L.map(c=>chOf(c.kenh).short))].join(", ")}}).filter(x=>x.g>0||x.dn>0).sort((a,b)=>b.g-a.g).slice(0,10);
  const spHtml=`<div class="card dqc" style="margin-bottom:14px"><h2 class="dqh" style="flex-wrap:wrap">🛍️ Top sản phẩm bán chạy <small>GMV từ video đã đăng trong tháng${spk?" · "+esc(chOf(spk).short):", cộng các kênh"}</small><span style="flex:1"></span>${dqDrop("ailla_dqspk","Kênh",[["","Tất cả kênh"]].concat(chs.map(ch=>[ch.k,ch.short])),spk)}</h2>${sp.length?`<table class="dqt"><tr><th>#</th><th>Sản phẩm</th><th>Kênh</th><th>Video</th><th>View</th><th>Đơn</th><th>GMV</th><th>GMV / video</th></tr>${sp.map((x,i)=>`<tr><td>${i+1}</td><td>${swatch(x.s)}${esc(sk(x.s).n)}</td><td>${esc(x.ch)}</td><td>${x.n}</td><td>${nf(x.v)}</td><td>${nf(x.dn)}</td><td>${money(x.g)}</td><td>${money(x.n?x.g/x.n:0)}</td></tr>`).join("")}</table>`:`<p class="empty">Chưa có số bán từ video tháng này. Số lên sau khi nhập báo cáo TikTok.</p>`}</div>`;
  return head+tbl+spHtml+topHtml}
/* Bấm thẻ kênh (chị Hoa 02/11): cửa sổ chi tiết — số tổng, theo sản phẩm, theo người, danh sách video chưa đăng (bấm mở thẻ Điều phối) */
const DQ_ST=[["chua","Chưa làm"],["lam","Đang làm"],["sua","Cần sửa"],["dkb","Chờ duyệt kịch bản"],["dvd","Chờ duyệt video"],["cho","Duyệt xong, chờ đăng"],["dang","Đã đăng"]];
function dqChOpen(r,cs,past,M){const ch=r.ch,u=ch.needId?"video":"bài",late=c=>typeof isLate==="function"&&c.step!=="xong"&&isLate(c);
  const skus=[...new Set(cs.map(c=>c.sku).concat(past?[]:ptPairs().filter(x=>x.kenh===ch.k&&x.sl>0).map(x=>x.sku)))];
  const byS=skus.map(k=>{const L=cs.filter(c=>c.sku===k),n=dqCount(L),pl=past?L.length:(dqPlanOf(ch.k,k)||L.length);return {k,n,pl}}).sort((a,b)=>b.pl-a.pl);
  const holder=c=>typeof pjHolder==="function"?pjHolder(c):c.nguoi;
  const ppl={};cs.filter(c=>c.step!=="xong").forEach(c=>{const h=holder(c)||"";const o=ppl[h]=ppl[h]||{n:0,tre:0};o.n++;if(late(c))o.tre++});
  const open=cs.filter(c=>c.step!=="xong").sort((a,b)=>DQ_ST.findIndex(x=>x[0]===dqStep(a))-DQ_ST.findIndex(x=>x[0]===dqStep(b))||(a.han||99)-(b.han||99));
  const stN=c=>(DQ_ST.find(x=>x[0]===dqStep(c))||["",""])[1],who=c=>typeof pjHolderLbl==="function"?pjHolderLbl(c):userName(c.nguoi)||"—";
  const box=(l,v,cl)=>`<div class="dqmb${cl?" "+cl:""}"><small>${l}</small><b>${v}</b></div>`;
  openDrawerHTML(DQ_CSS+`<div class="dq dqm"><h2>${esc(ch.short||ch.k)}</h2><p class="hint">Giữ kênh: ${esc(userName(chanOwner(ch.k))||"chưa đặt")} · ${past?"tháng "+M.mon:"kế hoạch tháng "+M.mon}</p>
   <div class="dqmk">${box("Mục tiêu",nf(r.pl)+" "+u)}${box("Đã đăng",nf(r.n.dang),"g")}${past?"":box("Cần đạt đến hôm nay",nf(r.nd))}${!past&&r.pl?box(r.cham?"Chậm so với nhịp":"Tiến độ",r.cham?nf(r.cham)+" "+u:"Đúng nhịp",r.cham?"r":"g"):""}${box("Chờ đăng",nf(r.n.cho))}${box("Chờ duyệt",nf(r.n.doi),r.n.doi?"a":"")}${box("Cần sửa",nf(r.n.sua),r.n.sua?"r":"")}</div>
   <h3>Theo sản phẩm</h3>${byS.length?`<table class="dqt"><tr><th>Sản phẩm</th><th>Mục tiêu</th><th>Đang làm</th><th>Chờ duyệt</th><th>Chờ đăng</th><th>Đã đăng</th><th>% đạt</th></tr>${byS.map(x=>`<tr><td style="text-align:left">${esc(sk(x.k).n)}</td><td>${nf(x.pl)}</td><td>${x.n.lam+x.n.sua}</td><td>${x.n.doi}</td><td>${x.n.cho}</td><td>${x.n.dang}</td><td>${dqPc(dqPct(x.n.dang,x.pl))}</td></tr>`).join("")}</table>`:`<p class="hint">Chưa có kế hoạch sản phẩm cho kênh này.</p>`}
   <h3>Ai đang giữ video</h3>${Object.keys(ppl).length?`<div class="dqmp">${Object.entries(ppl).sort((a,b)=>b[1].n-a[1].n).map(([id,o])=>`<span>${id?esc(userName(id)||id):"Đang chờ duyệt / chưa giao"} <b>${o.n}</b>${o.tre?` <em>${o.tre} trễ</em>`:""}</span>`).join("")}</div>`:`<p class="hint">Không còn video nào đang làm.</p>`}
   <h3>Video chưa đăng <small class="hint">${open.length} · bấm để mở thẻ</small></h3>${open.length?`<table class="dqt">${open.slice(0,80).map(c=>`<tr class="clk" data-dqc="${esc(c.id)}"><td style="text-align:left"><b>${esc(String(c.hookText||c.yTuong||c.tuyen||c.id).slice(0,60))}</b><div class="mono">${esc(c.id)} · ${esc(sk(c.sku).n)}</div></td><td>${esc(stN(c))}</td><td>${esc(who(c))}</td><td class="${late(c)?"red":""}">${c.han?dd(c.han):"—"}${late(c)?" · trễ":""}</td></tr>`).join("")}</table>${open.length>80?`<p class="hint">Đang hiện 80/${open.length} video.</p>`:""}`:`<p class="hint">Đã đăng hết.</p>`}
   <div class="acts" style="margin-top:12px"><button type="button" class="btn pri" id="dq-go">Mở Điều phối kênh này</button></div></div>`);
  $("#drawerIn").querySelectorAll("[data-dqc]").forEach(e=>e.onclick=()=>openCard(e.dataset.dqc));
  const g=$("#dq-go");if(g)g.onclick=()=>{closeDrawer();if(typeof bvGo==="function")bvGo(ch.k,"","")}}
PAGES.mkt_tq=function(m){try{pDqContent(m)}catch(e){console.error("Tổng quan Content lỗi",e);m.innerHTML=`<div class="note red"><b>Trang chưa hiện được.</b> Chụp dòng này gửi người quản trị web: ${esc(String(e&&e.message||e))}</div>`}};
