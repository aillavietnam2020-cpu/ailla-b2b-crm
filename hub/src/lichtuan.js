/* =====================================================================
   LỊCH CONTENT (Marketing › Lịch đăng) — một màn hình, không kéo ngang
   Hàng = kênh (người giữ kênh), cột = 7 ngày của tuần; mỗi video là một thẻ nhỏ
   (màu sản phẩm + tình trạng). Bấm thẻ mở cửa sổ chi tiết (đủ cột như Google Sheet).
   ===================================================================== */
let LW={w:0,kenh:"",mode:"week"};
const LW_ST=c=>isLate(c)?["late","Trễ hạn"]:c.step==="xong"?["done","Đã đăng"]:c.step==="dang"?["post","Chờ đăng"]:["dkb","dvd","dceo"].includes(c.step)?["wait","Chờ duyệt"]:c.step==="cg"?["new","Chưa giao"]:["doing","Đang làm"];
function lwChip(c){const s=LW_ST(c);return `<button type="button" class="lwc lw-${s[0]}" data-card="${c.id}" title="${esc((c.hookText||c.yTuong||c.tuyen||"")+" · "+s[1]+" · "+stepName(c.step))}"><i style="background:${sk(c.sku).c}"></i><span class="lwt">${esc(c.hookText||c.yTuong||c.tuyen||c.id)}</span><small>${esc(sk(c.sku).n.split(" ").slice(0,2).join(" "))} · ${esc((userName(c.nguoi)||"chưa giao").split(" ").pop())}</small><span class="sr-only">${s[1]}</span></button>`}
function lichTuan(b,C){
  const d=D(),today=d.settings.today;if(!LW.w)LW.w=weekOf(today)||1;
  const W=WEEKS.find(w=>w.w===LW.w)||WEEKS[0],days=[];for(let x=W.tu;x<=Math.min(W.den,MONTH.ndays);x++)days.push(x);
  const chs=CHANNELS.filter(ch=>!LW.kenh||ch.k===LW.kenh),inW=C.filter(c=>c.day>=W.tu&&c.day<=W.den);
  const cnt=k=>inW.filter(c=>LW_ST(c)[0]===k).length;
  const sum=[["Kế hoạch",inW.length,""],["Chưa giao",cnt("new"),"new"],["Đang làm",cnt("doing"),"doing"],["Chờ duyệt",cnt("wait"),"wait"],["Chờ đăng",cnt("post"),"post"],["Đã đăng",cnt("done"),"done"],["Trễ",cnt("late"),"late"]];
  b.innerHTML=`<div class="lwsumline">${sum.map(([l,v,k])=>`<span class="${v?"":"z"}">${k?`<i class="lwd lw-${k}"></i>`:""}${l} <b class="numeric">${v}</b></span>`).join("")}</div>
  <section class="card flush lwgrid"><div class="lwg" style="grid-template-columns:150px repeat(${days.length},minmax(0,1fr))">
   <div class="lwh"></div>${days.map(x=>`<div class="lwh${x===today?" now":""}"><b>${THU[wd(x)]}</b> ${dd(x)}</div>`).join("")}
   ${chs.map(ch=>{const I=inW.filter(c=>c.kenh===ch.k),done=I.filter(c=>c.step==="xong").length;return `<div class="lwk"><b>${esc(ch.short)}</b><small>${esc(userName(chanOwner(ch.k))||"chưa đặt người giữ")}</small><span class="lwp"><i style="width:${I.length?done/I.length*100:0}%"></i></span><small class="numeric">${done}/${I.length} đã đăng</small></div>${days.map(x=>{const L=I.filter(c=>c.day===x),em=typeof slotEmpty==="function"?slotEmpty(ch.k,x,L.length):"";return `<div class="lwcell${x===today?" now":""}">${L.map(lwChip).join("")}${em}${!L.length&&!em?`<span class="lwe">—</span>`:""}</div>`}).join("")}`}).join("")}
  </div></section>`;
}
/* Trang Lịch content: Tuần (mặc định) · Tháng · Pillar & tuyến. Bỏ các bảng từng kênh kéo ngang như Sheet. */
const _pLichOld=pLich;
pLich=function(m){
  const tab=SUB.lich&&["week","cal"].includes(SUB.lich)?SUB.lich:"week";SUB.lich=tab;
  const bindTabs=()=>m.querySelectorAll("[data-lwv]").forEach(b=>b.onclick=()=>{SUB.lich=b.dataset.lwv;renderMain()});
  if(tab!=="week"){_pLichOld(m);const h1=m.querySelector(".ph h1");if(h1)h1.textContent="Calendar";const t=m.querySelector(".tabs");if(t)t.outerHTML=`<div class="lwtool">${lwTabs(tab)}</div>`;bindTabs();return}
  const d=D();if(!LW.w)LW.w=weekOf(d.settings.today)||1;const W=WEEKS.find(w=>w.w===LW.w)||WEEKS[0];
  m.innerHTML=H("Calendar","Video nào lên kênh nào, ngày nào · bấm một video để mở thẻ")+`<div class="lwtool">
   <div class="seg"><button data-lww="-1" ${LW.w<=1?"disabled":""} aria-label="Tuần trước">‹</button><button class="on">Tuần ${W.w} · ${dd(W.tu)}–${dd(Math.min(W.den,MONTH.ndays))}</button><button data-lww="1" ${LW.w>=WEEKS.length?"disabled":""} aria-label="Tuần sau">›</button></div>
   ${lwTabs(tab)}
   <div class="seg">${[["","Tất cả"]].concat(CHANNELS.map(c=>[c.k,c.short])).map(([k,t])=>`<button class="${LW.kenh===k?"on":""}" data-lwk="${esc(k)}">${esc(t)}</button>`).join("")}</div>
   <select id="lf-s" aria-label="Sản phẩm">${opt([["","Sản phẩm"]].concat(skOpts()),LF.sku)}</select><select id="lf-n" aria-label="Người làm">${opt([["","Người làm"]].concat(workers().map(u=>[u.id,u.name])),LF.nguoi)}</select>
   ${can(ME,"lich.sua_tat_ca")?`<span class="sp"></span><button class="btn pri" id="addc">+ Thêm nội dung</button>`:""}</div><div id="lb"></div>`;
  bindTabs();
  m.querySelectorAll("[data-lww]").forEach(x=>x.onclick=()=>{LW.w=Math.max(1,Math.min(WEEKS.length,LW.w+ +x.dataset.lww));renderMain()});
  m.querySelectorAll("[data-lwk]").forEach(x=>x.onclick=()=>{LW.kenh=x.dataset.lwk;renderMain()});
  $("#lf-s").onchange=e=>{LF.sku=e.target.value;renderMain()};$("#lf-n").onchange=e=>{LF.nguoi=e.target.value;renderMain()};
  if($("#addc"))$("#addc").onclick=()=>{let id;const k=LW.kenh||"TikTok chính";DB.mutate(ME.name,"thêm nội dung "+k,dt=>{const c=newCard(dt,{sku:"BT",kenh:k,day:Math.max(dt.settings.today,W.tu)});dt.cards.push(c);id=c.id});renderMain();openCard(id)};
  const C=d.cards.filter(c=>(!LF.sku||c.sku===LF.sku)&&(!LF.nguoi||c.nguoi===LF.nguoi));
  lichTuan($("#lb"),C);
};
const lwTabs=tab=>`<div class="seg">${[["week","Tuần"],["cal","Tháng"]].map(([k,t])=>`<button data-lwv="${k}" class="${k===tab?"on":""}">${t}</button>`).join("")}</div>`;
PAGES.lich=pLich;
