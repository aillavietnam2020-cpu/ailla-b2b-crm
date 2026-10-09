/* =====================================================================
   GIAO VIỆC NHANH (trang riêng, tách khỏi Kế hoạch tháng)
   Web tổng hợp việc còn phải giao; lead bấm tên người là giao ngay, không phải điền gì khác.
   Không có số công suất tự đặt: chỉ có tích "ai làm được dạng nào" và ngày nghỉ.
   ===================================================================== */
const GV_T=[["oneshot","One shot"],["kichban","Review"],["worker","Worker"],["reup","Reup / xào"],["nhanban","Nhân bản win"],["outsource","Outsource"],["ton","Video tồn"]];
let GV_OPEN=false;
/* tích mặc định theo cách chị đang phân việc, chị sửa trong bảng "Ai làm được gì" */
function gvDefault(u){
  const n=foldName(u.name),z={};
  if(/quynh/.test(n))return {can:{oneshot:1,kichban:1,worker:1,outsource:1,ton:1},nghi:0};
  if(/(^|\s)may(\s|$)/.test(n))return {can:{worker:1,reup:1,nhanban:1,ton:1},nghi:0};
  if(/oanh/.test(n))return {can:z,nghi:7};
  if(u.role==="admin"||/hoa/.test(n))return {can:{oneshot:1,kichban:1,ton:1},nghi:0};
  return {can:{oneshot:1,reup:1,ton:1},nghi:0}
}
function gvOf(d,u){const s=((d.phanVai3||{})[u.id])||null,df=gvDefault(u);return s?{can:Object.assign({},df.can,s.can||{}),nghi:s.nghi!=null?+s.nghi:df.nghi}:df}
/* người còn làm được việc có hạn hn (chưa nghỉ trước hạn) */
const gvAvail=(d,u,hn)=>{const n=gvOf(d,u).nghi;return !(n>0&&Math.max(d.settings.today,+hn||0)>=n)};
/* tất cả việc còn phải giao của mọi kênh, gấp nhất xếp trước */
function gvRows(d){
  const out=[];CHANNELS.forEach(ch=>{wpProposals(d,ch.k).forEach(p=>{if(p.left>0)out.push(Object.assign({},p,{han:wpHorHan(d,p.t,p.h0),short:ch.short}))})});
  return out.sort((a,b)=>a.han-b.han||a.t.localeCompare(b.t))
}
function gvCount(d){try{return gvRows(d).length}catch(e){return 0}}
function pGiaoNhanh(m){
  const d=D(),team=xvTeam(),td=d.settings.today,rows=gvRows(d),days=Array.from({length:MONTH.ndays},(_,i)=>[i+1,dd(i+1)]),give=xvGive();
  const late=d.cards.filter(isLate).length,leave=team.filter(u=>gvOf(d,u).nghi>0).map(u=>u.name+" nghỉ từ "+dd(gvOf(d,u).nghi));
  const lbl=t=>(MIX.find(z=>z[0]===t)||[])[1]||t;
  m.innerHTML=`<div class="ph"><h1>Giao việc</h1><p class="hint">Web tổng hợp việc còn phải giao. Bấm tên người ở dòng nào là giao ngay cho người đó (số video và hạn sửa được trước khi bấm).</p></div>
  <div class="gvstrip"><div><b>${rows.length}</b><span>dòng cần giao</span></div><div><b>${sum(rows,r=>r.left)}</b><span>video cần giao</span></div><div class="${late?"bad":""}"><b>${late}</b><span>video trễ hạn</span>${late?`<button type="button" class="lnk" data-go="dieuphoi">xem</button>`:""}</div>${leave.length?`<div class="warn"><b>${leave.length}</b><span>${esc(leave.join(", "))}</span></div>`:""}</div>
  ${give?"":`<div class="note">Bạn chỉ được xem. Giao việc cần quyền "Giao việc".</div>`}
  <section class="card flush"><div class="tbl"><table class="gvtab"><thead><tr><th>Sản phẩm</th><th>Dạng</th><th class="n">Số video</th><th>Hạn</th><th>Giao cho</th></tr></thead><tbody>
  ${rows.map((p,i)=>{const cand=team.filter(u=>gvOf(d,u).can[p.t]&&gvAvail(d,u,p.han));
    return `<tr data-gr="${i}" data-sku="${p.sku}" data-kenh="${esc(p.kenh)}" data-t="${p.t}" data-cw="${p.cw}" data-cum="${p.cum.join(",")}" data-given="${p.given}">
     <td>${swatch(p.sku)}<b>${esc(sk(p.sku).n)}</b><small>${esc(p.short)}</small></td><td>${esc(lbl(p.t))}</td>
     <td class="n"><input type="number" min="1" class="num" value="${p.left}" data-gn ${give?"":"disabled"}><small>cần ${p.left}</small></td>
     <td><select data-gh ${give?"":"disabled"}>${opt(days,p.han)}</select></td>
     <td class="gvp">${give?(cand.length?cand.map(u=>`<button type="button" class="gvchip" data-gu="${esc(u.id)}" title="Đang cầm ${pvLoad(d,u.id)} việc chưa xong">${esc(u.name)}<small>${pvLoad(d,u.id)}</small></button>`).join(""):`<span class="hint">chưa ai được tích làm dạng này · mở "Ai làm được gì" bên dưới</span>`):""}</td></tr>`}).join("")||`<tr><td colspan="5" class="empty">Không còn việc nào cần giao. ✓</td></tr>`}
  </tbody></table></div></section>
  ${give?`<section class="card"><div class="card-h"><h2>Ai làm được gì</h2><span class="hint">tích dạng việc mỗi người làm được, đặt ngày nghỉ · chỉ những người được tích mới hiện nút ở bảng trên</span><span class="sp"></span><button type="button" class="btn sm ghost" data-gvtog="1">${GV_OPEN?"Thu gọn":"Mở bảng"}</button></div>
  ${GV_OPEN?`<div class="tbl"><table><thead><tr><th>Người</th>${GV_T.map(z=>`<th class="n">${z[1]}</th>`).join("")}<th class="n">Nghỉ từ ngày<small>0 = không nghỉ</small></th></tr></thead><tbody>
  ${team.map(u=>{const p=gvOf(d,u);return `<tr><td><b>${esc(u.name)}</b></td>${GV_T.map(z=>`<td class="n"><input type="checkbox" data-gv="${esc(u.id)}|can|${z[0]}" ${p.can[z[0]]?"checked":""}></td>`).join("")}<td class="n"><input type="number" min="0" max="${MONTH.ndays}" class="num" data-gv="${esc(u.id)}|nghi" value="${p.nghi}"></td></tr>`}).join("")}</tbody></table></div>`:""}</section>`:""}`;
  m.querySelectorAll("[data-gu]").forEach(btn=>btn.onclick=()=>{
    const tr=btn.closest("tr"),sku=tr.dataset.sku,kenh=tr.dataset.kenh,t=tr.dataset.t,cw=+tr.dataset.cw,uid=btn.dataset.gu,n=Math.floor(+tr.querySelector("[data-gn]").value||0),hn=+tr.querySelector("[data-gh]").value,rem=(+String(tr.dataset.cum).split(",")[4]||0)-(+tr.dataset.given||0);
    if(n<1){toast("Số video phải lớn hơn 0");return}if(n>rem){toast("Chỉ còn "+rem+" video cả tháng");return}if(hn<td){toast("Hạn phải từ hôm nay trở đi");return}
    wpAssign(sku,kenh,t,uid,n,cw,td,hn,"");toast("Đã giao "+userName(uid)+" "+n+" "+sk(sku).n+" · "+lbl(t));renderMain()});
  m.querySelectorAll("[data-gvtog]").forEach(x=>x.onclick=()=>{GV_OPEN=!GV_OPEN;renderMain()});
  m.querySelectorAll("[data-gv]").forEach(i=>i.onchange=()=>{const p=i.dataset.gv.split("|"),uid=p[0],f=p[1],t=p[2],u=(D().users||[]).find(x=>x.id===uid);if(!u)return;
    DB.mutate(ME.name,"sửa ai làm được gì: "+u.name,dt=>{dt.phanVai3=dt.phanVai3||{};const cur=gvOf(dt,dt.users.find(x=>x.id===uid)||u),s=dt.phanVai3[uid]=Object.assign({},dt.phanVai3[uid]||{},{can:Object.assign({},cur.can),nghi:cur.nghi});if(f==="can")s.can[t]=i.checked?1:0;else s.nghi=Math.max(0,Math.floor(+i.value||0))});renderMain()});
}
PAGES.gv_nhanh=pGiaoNhanh;
/* ở Kế hoạch triển khai chỉ còn một dòng nhắc, việc giao nằm ở trang Giao việc */
function wpGiveLink(d,give){if(!give)return "";const n=gvCount(d);return n?`<div class="note gvlink">Còn <b>${n}</b> dòng việc cần giao. <button type="button" class="btn sm pri" data-gogv="1">Mở trang Giao việc →</button></div>`:""}
