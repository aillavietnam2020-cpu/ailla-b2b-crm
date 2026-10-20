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
function pGiaoNhanh0(m){
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
/* thêm 2 mục cho lead: việc đứng tên người đã nghỉ + việc đã giao nhưng chưa có hạn (xử lý theo nhóm, một lần bấm) */
const GV_WORK=["kb","quay","edit","worker"];
function gvLoose(d){
  const act=id=>{const u=(d.users||[]).find(x=>x.id===id);return !!u&&u.active!==false},A=[],B=[],mA={},mB={};
  d.cards.forEach(c=>{if(!GV_WORK.includes(c.step)||!c.nguoi)return;
    if(!act(c.nguoi)){const k=[c.nguoi,c.sku,c.step].join("|");(mA[k]=mA[k]||(A.push(mA[k]={k,nguoi:c.nguoi,sku:c.sku,step:c.step,ids:[]}),mA[k])).ids.push(c.id)}
    else if(!c.han&&!c.day){const k=[c.nguoi,c.sku,c.step].join("|");(mB[k]=mB[k]||(B.push(mB[k]={k,nguoi:c.nguoi,sku:c.sku,step:c.step,ids:[]}),mB[k])).ids.push(c.id)}});
  return {A,B}
}
function pGiaoNhanh(m){
  pGiaoNhanh0(m);
  try{
    const d=D(),give=xvGive();if(!give)return;const {A,B}=gvLoose(d);if(!A.length&&!B.length)return;
    const team=xvTeam(),td=d.settings.today,days=Array.from({length:MONTH.ndays},(_,i)=>[i+1,dd(i+1)]),hn0=Math.min(MONTH.ndays,td+5);
    const rowA=g=>`<tr data-la="${esc(g.k)}"><td><b>${esc(userName(g.nguoi)||"?")}</b> <small class="t-red">đã nghỉ</small></td><td>${swatch(g.sku)}${esc(sk(g.sku).n)}</td><td>${esc(stepName(g.step))}</td><td class="n">${g.ids.length}</td><td><select data-ln>${opt([["","— chọn người nhận"]].concat(team.map(u=>[u.id,u.name])),"")}</select></td><td><select data-lh>${opt(days,hn0)}</select></td><td><button type="button" class="btn sm pri" data-lgo="a">Chuyển</button></td></tr>`;
    const rowB=g=>`<tr data-lb="${esc(g.k)}"><td><b>${esc(userName(g.nguoi))}</b></td><td>${swatch(g.sku)}${esc(sk(g.sku).n)}</td><td>${esc(stepName(g.step))}</td><td class="n">${g.ids.length}</td><td><select data-lh>${opt(days,hn0)}</select></td><td><button type="button" class="btn sm pri" data-lgo="b">Đặt hạn</button></td></tr>`;
    m.insertAdjacentHTML("beforeend",(A.length?`<section class="card flush"><div class="card-h pad"><h2>Việc đang đứng tên người đã nghỉ</h2><span class="hint">${sum(A,g=>g.ids.length)} thẻ · chọn người nhận và hạn rồi bấm Chuyển</span></div><div class="tbl"><table><thead><tr><th>Người cũ</th><th>Sản phẩm</th><th>Bước</th><th class="n">Số thẻ</th><th>Người nhận</th><th>Hạn</th><th></th></tr></thead><tbody>${A.map(rowA).join("")}</tbody></table></div></section>`:"")+(B.length?`<section class="card flush"><div class="card-h pad"><h2>Việc đã giao nhưng chưa có hạn</h2><span class="hint">${sum(B,g=>g.ids.length)} thẻ · chọn hạn chung cho cả nhóm rồi bấm Đặt hạn</span></div><div class="tbl"><table><thead><tr><th>Người làm</th><th>Sản phẩm</th><th>Bước</th><th class="n">Số thẻ</th><th>Hạn</th><th></th></tr></thead><tbody>${B.map(rowB).join("")}</tbody></table></div></section>`:""));
    m.querySelectorAll("[data-lgo]").forEach(b=>b.onclick=()=>{
      const tr=b.closest("tr"),isA=b.dataset.lgo==="a",g=(isA?A:B).find(x=>x.k===(tr.dataset.la||tr.dataset.lb));if(!g)return;
      const hn=+tr.querySelector("[data-lh]").value,nu=isA?tr.querySelector("[data-ln]").value:"";
      if(isA&&!nu){toast("Chọn người nhận trước");return}
      DB.mutate(ME.name,(isA?"chuyển "+g.ids.length+" thẻ từ "+userName(g.nguoi)+" sang "+userName(nu):"đặt hạn "+dd(hn)+" cho "+g.ids.length+" thẻ của "+userName(g.nguoi)),dt=>{
        dt.cards.forEach(c=>{if(!g.ids.includes(c.id))return;c.han=hn;if(isA){c.nguoi=nu;c.giao=nu;if(!c.nguoiKB||c.nguoiKB===g.nguoi)c.nguoiKB=nu;if(c.nguoiEdit===g.nguoi)c.nguoiEdit=nu}})});
      toast(isA?"Đã chuyển "+g.ids.length+" thẻ cho "+userName(nu):"Đã đặt hạn "+dd(hn)+" cho "+g.ids.length+" thẻ");renderMain()})
  }catch(e){console.warn("mục việc lỏng lẻo lỗi",e)}
}
PAGES.gv_nhanh=pGiaoNhanh;
/* ở Kế hoạch triển khai chỉ còn một dòng nhắc, việc giao nằm ở trang Giao việc */
function wpGiveLink(d,give){if(!give)return "";const n=gvCount(d);return n?`<div class="note gvlink">Còn <b>${n}</b> dòng việc cần giao. <button type="button" class="btn sm pri" data-gogv="1">Mở trang Giao việc →</button></div>`:""}


/* Điều phối sản xuất: "Giao việc nhanh" là một khối ở cột phải (vài dòng gấp nhất, bấm tên người là giao ngay); "Xem tất cả" mở khung đầy đủ */
(function(){
  const dp=PAGES.dieuphoi;if(!dp||dp._gv)return;
  let open=false,sc=0;
  const wrap=function(m){
    dp(m);
    const d=D(),give=typeof xvGive==="function"&&xvGive();if(!give)return;
    const rows=gvRows(d),team=xvTeam(),td=d.settings.today,lbl=t=>(MIX.find(z=>z[0]===t)||[])[1]||t,side=m.querySelector(".dpside");
    if(side){
      const card=document.createElement("section");card.className="card gvside";
      card.innerHTML=`<div class="card-h"><h2>Giao việc nhanh${rows.length?` <span class="cnt">${rows.length}</span>`:""}</h2>${rows.length>4?`<button type="button" class="lnk" id="gv-all">Xem tất cả →</button>`:""}</div>`+
      (rows.slice(0,4).map((p,i)=>{const cand=team.filter(u=>gvOf(d,u).can[p.t]&&gvAvail(d,u,p.han));
        return `<div class="gvs-r"><div class="gvs-t"><b>${esc(sk(p.sku).n)}</b><span>${esc(lbl(p.t))}</span><em>${p.left} video · ${dd(p.han)}</em></div><div class="gvs-c">${cand.length?cand.map(u=>`<button type="button" class="gvchip" data-gsi="${i}" data-gu="${esc(u.id)}" title="${esc(u.name)}">${esc(u.name.length>9?u.name.split(" ").pop():u.name)}</button>`).join(""):`<em>chưa ai làm được dạng này</em>`}</div></div>`}).join("")||`<p class="empty">Không còn việc nào cần giao. ✓</p>`);
      side.prepend(card);
      card.querySelectorAll("[data-gu]").forEach(b=>b.onclick=()=>{const p=rows[+b.dataset.gsi],uid=b.dataset.gu;if(!p)return;
        wpAssign(p.sku,p.kenh,p.t,uid,p.left,p.cw,td,p.han,"");toast("Đã giao "+userName(uid)+" "+p.left+" "+sk(p.sku).n+" · "+lbl(p.t));renderMain()});
      const all=card.querySelector("#gv-all");if(all)all.onclick=()=>{open=true;show()};
    }
    function show(){
      m.querySelector("#gv-pop")?.remove();if(!open)return;
      const p=document.createElement("div");p.id="gv-pop";p.className="gvpop";
      p.innerHTML=`<div class="gvpop-bg"></div><aside class="gvpop-box"><div class="gvpop-h"><b>Giao việc nhanh</b><span>chỉnh số video, hạn rồi bấm tên người để giao</span><button type="button" class="btn sm" id="gv-x">Đóng</button></div><div class="gvpop-b" id="gvbody"></div></aside>`;
      m.appendChild(p);
      const b=p.querySelector("#gvbody");pGiaoNhanh(b);const ph=b.querySelector(".ph");if(ph)ph.remove();
      b.scrollTop=sc;b.addEventListener("scroll",()=>{sc=b.scrollTop});
      const close=()=>{open=false;sc=0;p.remove()};
      p.querySelector("#gv-x").onclick=close;p.querySelector(".gvpop-bg").onclick=close;
    }
    if(open)show();
  };
  wrap._gv=1;PAGES.dieuphoi=wrap;
  window.dpOpenGv=()=>{open=true};
})();

/* Tổng quan Content = gộp "Tổng quan" cũ và "Hiệu quả tháng": số lớn + đề xuất AI, tình trạng video theo kênh, rồi nhịp tuần / KPI / sản phẩm / nhân sự */
(function(){
  const tq0=PAGES.mkt_tq,hq0=PAGES.hieuqua;if(!tq0||!hq0||tq0._gop)return;
  const gop=function(m){
    m.innerHTML='<div id="gopA"></div><div id="gopB"></div>';
    const A=m.querySelector("#gopA"),B=m.querySelector("#gopB");
    hq0(A);tq0(B);
    A.querySelectorAll("section.card").forEach(x=>{const h=x.querySelector(".card-h h2");if(h&&/^Tiến độ sản xuất/.test(h.textContent.trim()))x.remove()});
    const ph=A.querySelector(":scope > .ph");if(ph)ph.remove();
    const grid=A.querySelector(".hqgrid"),head=B.querySelector(":scope > .ph");
    const top=document.createElement("div");top.innerHTML=tqcTop();
    const frag=document.createDocumentFragment();
    if(head)frag.appendChild(head);
    [...A.children].forEach(x=>{if(x===grid)x.remove();else if(x.classList.contains("demoband"))frag.appendChild(x)});
    while(top.firstChild)frag.appendChild(top.firstChild);
    [...B.children].forEach(x=>frag.appendChild(x));
    [...A.children].forEach(x=>frag.appendChild(x));
    m.innerHTML="";m.appendChild(frag);
    m.querySelectorAll("[data-tqm]").forEach(x=>x.onclick=()=>{TQC_M=x.dataset.tqm;renderMain()});
    if(typeof bindCommon==="function")bindCommon(m);
  };
  gop._gop=1;PAGES.mkt_tq=gop;
})();
