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
  const plan=past?C.length:(sum(CHANNELS,ch=>dqPlanOf(ch.k))||C.length),today=M.today,need=past?plan:Math.round(plan*today/M.nd);
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
   ${k("g","💰","GMV từ video",money(gmv),nf(don)+" đơn")}
   ${k("p","🏆","Video win",nf(winNew),"≥"+wOrd+" đơn"+(winGoal?" · mục tiêu "+winGoal:""))}</div>`;
  /* ---- tiến độ từng kênh ---- */
  const chRows=CHANNELS.map(ch=>{const cs=C.filter(c=>c.kenh===ch.k),n=dqCount(cs),pl=past?cs.length:(dqPlanOf(ch.k)||cs.length),nd=past?pl:Math.round(pl*today/M.nd);return {ch,n,pl,nd,cham:Math.max(0,nd-n.dang)}});
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
  const chHtml=`<h2 class="dqh">📡 Tiến độ theo kênh <small>${past?"tháng "+M.mon:"kế hoạch tháng · thanh màu = trạng thái từng video"}</small></h2><div class="dqch">${chRows.map(r=>`<div><div class="hd">${esc(r.ch.short)}<span>giữ kênh: ${esc(userName(chanOwner(r.ch.k))||"chưa đặt")}</span></div>
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
  const T=(typeof winners==="function"?winners():[]).filter(w=>w.loai!=="Có đơn").slice(0,8),medal=["🥇","🥈","🥉"];
  const nb=w=>typeof winVars==="function"?winVars("TT-"+w.key).length:0;
  const win=`<div class="card dqc" style="margin-top:14px"><h2 class="dqh">🏆 Top video win <small>≥${wOrd} đơn là Win, ≥${+set.potential||30} đơn là tiềm năng · số từ báo cáo TikTok</small></h2>${T.length?`<table class="dqt"><tr><th>#</th><th>Video</th><th>Sản phẩm</th><th>Kênh</th><th>Người làm</th><th>View</th><th>Đơn</th><th>GMV</th><th>Đã nhân bản</th></tr>
   ${T.map((w,i)=>{const n=nb(w);return `<tr><td>${medal[i]||i+1}</td><td style="text-align:left;max-width:340px">${esc(String(w.ten||"").slice(0,70))}<div class="mono">${esc(w.key)}</div></td><td>${esc(sk(w.sku).n)}</td><td>${esc(chOf(w.kenh).short)}</td><td>${esc(userName(w.nguoi)||"—")}</td><td>${nf(w.view)}</td><td>${nf(w.don)}</td><td>${money(w.gmv)}</td><td>${w.loai==="Winner"?(n?n+" bản":`<span class="red">chưa nhân bản</span>`):`<span class="mut">tiềm năng</span>`}</td></tr>`}).join("")}</table>`:`<p class="empty">Chưa có video nào đạt mức tiềm năng.</p>`}</div>`;
  m.innerHTML=DQ_CSS+`<div class="dq">${kpis}${alert}${chHtml}${prHtml}<div class="dqg2">${pplHtml}${fun}</div>${win}</div>`;
  m.querySelectorAll("[data-dqsku]").forEach(r=>r.onclick=()=>{if(typeof bvGo==="function"){const s=r.dataset.dqsku,kn=(C.find(c=>c.sku===s)||{}).kenh||(ptPairs().find(x=>x.sku===s)||{}).kenh||"TikTok chính";bvGo(kn,s,"")}});
  if(typeof bindCommon==="function")bindCommon(m);
}
PAGES.mkt_tq=function(m){try{pDqContent(m)}catch(e){console.error("Tổng quan Content lỗi",e);m.innerHTML=`<div class="note red"><b>Trang chưa hiện được.</b> Chị chụp dòng này gửi em: ${esc(String(e&&e.message||e))}</div>`}};
