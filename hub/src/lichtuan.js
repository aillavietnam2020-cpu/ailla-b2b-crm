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
  const sum=[["Kế hoạch tuần",inW.length,""],["Đang làm",cnt("doing")+cnt("new"),"s-blu"],["Chờ duyệt",cnt("wait"),"s-amb"],["Chờ đăng",cnt("post"),"s-gry"],["Đã đăng",cnt("done"),"s-grn"],["Trễ hạn",cnt("late"),"s-red"]];
  b.innerHTML=`<div class="lwbar"><div class="seg"><button data-lww="-1" ${LW.w<=1?"disabled":""}>‹</button><button class="on">Tuần ${W.w} · ${dd(W.tu)} – ${dd(Math.min(W.den,MONTH.ndays))}</button><button data-lww="1" ${LW.w>=WEEKS.length?"disabled":""}>›</button></div>
   <div class="seg">${[["","Tất cả kênh"]].concat(CHANNELS.map(c=>[c.k,c.short])).map(([k,t])=>`<button class="${LW.kenh===k?"on":""}" data-lwk="${esc(k)}">${esc(t)}</button>`).join("")}</div>
   <div class="lwleg"><span><i class="lwd lw-new"></i>Chưa giao</span><span><i class="lwd lw-doing"></i>Đang làm</span><span><i class="lwd lw-wait"></i>Chờ duyệt</span><span><i class="lwd lw-post"></i>Chờ đăng</span><span><i class="lwd lw-done"></i>Đã đăng</span><span><i class="lwd lw-late"></i>Trễ</span></div></div>
  <section class="xkstrip lwsum">${sum.map(([l,v,dot])=>`<div class="xk ro${v?"":" mut"}"><span class="xkh">${dot?`<i class="sdot ${dot}"></i>`:""}<span class="xkl">${l}</span></span><span class="xkv numeric">${v}</span></div>`).join("")}</section>
  <section class="card flush lwgrid"><div class="lwg" style="grid-template-columns:150px repeat(${days.length},minmax(0,1fr))">
   <div class="lwh"></div>${days.map(x=>`<div class="lwh${x===today?" now":""}"><b>${THU[wd(x)]}</b> ${dd(x)}</div>`).join("")}
   ${chs.map(ch=>{const I=inW.filter(c=>c.kenh===ch.k),done=I.filter(c=>c.step==="xong").length;return `<div class="lwk"><b>${esc(ch.short)}</b><small>${esc(userName(chanOwner(ch.k))||"chưa đặt người giữ")}</small><span class="lwp"><i style="width:${I.length?done/I.length*100:0}%"></i></span><small class="numeric">${done}/${I.length} đã đăng</small></div>${days.map(x=>{const L=I.filter(c=>c.day===x);return `<div class="lwcell${x===today?" now":""}">${L.map(lwChip).join("")}${!L.length?`<span class="lwe">—</span>`:""}</div>`}).join("")}`}).join("")}
  </div></section>`;
  b.querySelectorAll("[data-lww]").forEach(x=>x.onclick=()=>{LW.w=Math.max(1,Math.min(WEEKS.length,LW.w+ +x.dataset.lww));renderMain()});
  b.querySelectorAll("[data-lwk]").forEach(x=>x.onclick=()=>{LW.kenh=x.dataset.lwk;renderMain()});
}
/* Trang Lịch content: Tuần (mặc định) · Tháng · Pillar & tuyến. Bỏ các bảng từng kênh kéo ngang như Sheet. */
const _pLichOld=pLich;
pLich=function(m){
  const tab=SUB.lich&&["week","cal","pillar"].includes(SUB.lich)?SUB.lich:"week";SUB.lich=tab;
  if(tab!=="week"){_pLichOld(m);const t=m.querySelector(".tabs");if(t)t.outerHTML=lwTabs(tab);m.querySelectorAll(".tabs [data-sub]").forEach(b=>b.onclick=()=>{SUB.lich=b.dataset.sub;renderMain()});return}
  m.innerHTML=H("Lịch content","bấm một video để xem chi tiết và làm bước tiếp theo")+lwTabs(tab)+`<div class="filters"><select id="lf-s">${opt([["","Mọi sản phẩm"]].concat(skOpts()),LF.sku)}</select><select id="lf-n">${opt([["","Mọi người"]].concat(workers().map(u=>[u.id,u.name])),LF.nguoi)}</select>${can(ME,"lich.sua_tat_ca")?`<span class="sp"></span><select id="lw-ak">${opt(CHANNELS.map(c=>[c.k,c.k]),LW.kenh||"TikTok chính")}</select><button class="btn pri" id="addc">+ Thêm nội dung</button>`:""}</div><div id="lb"></div>`;
  m.querySelectorAll(".tabs [data-sub]").forEach(b=>b.onclick=()=>{SUB.lich=b.dataset.sub;renderMain()});
  $("#lf-s").onchange=e=>{LF.sku=e.target.value;renderMain()};$("#lf-n").onchange=e=>{LF.nguoi=e.target.value;renderMain()};
  if($("#addc"))$("#addc").onclick=()=>{let id;const k=$("#lw-ak").value;DB.mutate(ME.name,"thêm nội dung "+k,dt=>{const c=newCard(dt,{sku:"BT",kenh:k,day:Math.max(dt.settings.today,(WEEKS.find(w=>w.w===LW.w)||{tu:dt.settings.today}).tu)});dt.cards.push(c);id=c.id});renderMain();openCard(id)};
  const C=D().cards.filter(c=>(!LF.sku||c.sku===LF.sku)&&(!LF.nguoi||c.nguoi===LF.nguoi));
  lichTuan($("#lb"),C);
};
const lwTabs=tab=>`<div class="tabs">${[["week","Theo tuần"],["cal","Cả tháng"],["pillar","Pillar & tuyến"]].map(([k,t])=>`<button data-sub="${k}" class="${k===tab?"on":""}">${t}</button>`).join("")}</div>`;
PAGES.lich=pLich;
