/* =====================================================================
   LỊCH CONTENT (Marketing › Lịch đăng) — một màn hình, không kéo ngang
   Hàng = kênh (người giữ kênh), cột = 7 ngày của tuần; mỗi video là một thẻ nhỏ
   (màu sản phẩm + tình trạng). Bấm thẻ mở cửa sổ chi tiết (đủ cột như Google Sheet).
   ===================================================================== */
let LW={w:0,kenh:"",mode:"week"};
const LW_ST=c=>isLate(c)?["late","Trễ hạn"]:c.step==="xong"?["done","Đã đăng"]:c.step==="dang"?["post","Chờ đăng"]:["dkb","dvd","dceo"].includes(c.step)?["wait","Chờ duyệt"]:c.step==="cg"?["new","Chưa giao"]:["doing","Đang làm"];
function lwChip(c){const s=LW_ST(c);return `<button type="button" class="lwc lw-${s[0]}" data-card="${c.id}" title="${esc((c.hookText||c.yTuong||c.tuyen||"")+" · "+s[1]+" · "+stepName(c.step))}"><i style="background:${sk(c.sku).c}"></i><span class="lwt">${esc(c.hookText||c.yTuong||c.tuyen||c.id)}</span><small>${esc(skS(c.sku))} · ${esc((userName(c.nguoi)||"chưa giao").split(" ").pop())}</small><span class="sr-only">${s[1]}</span></button>`}
/* thống kê tuần: kế hoạch từng sản phẩm ở ① so với số video đã xếp vào tuần này, thừa hoặc thiếu */
function lwStat(d,ch,W){
  try{if(!ch)return "";const P=knPlan(d,ch.k),w=W.w,pw=P[w-1]||{tong:0},cs=d.cards.filter(c=>c.kenh===ch.k&&+c.day>=W.tu&&+c.day<=Math.min(W.den,MONTH.ndays)),skus=[...new Set((P.ks||[]).concat(cs.map(c=>c.sku)))];
    const chip=(l,a,b)=>{const df=a-b;return `<span class="lws ${df===0?"ok":df>0?"over":"lack"}">${l} <b>${a}/${b}</b> <i>${df===0?"đủ":df>0?"thừa "+df:"thiếu "+(-df)}</i></span>`};
    const rows=skus.map(s=>({s,a:cs.filter(c=>c.sku===s).length,b:pw[s]||0})).filter(x=>x.a||x.b);
    return `<div class="lwstat"><b>Kế hoạch ${esc(ch.short)} · tuần ${w}:</b>${chip("Cả tuần",cs.length,pw.tong||0)}${rows.map(x=>chip(esc(sk(x.s).n.split(" ").slice(0,3).join(" ")),x.a,x.b)).join("")}</div>`}catch(e){return ""}
}
function lichTuan(b,C,wNo,head){
  const d=D(),today=d.settings.today;if(!LW.w)LW.w=weekOf(today)||1;
  const W=WEEKS.find(w=>w.w===(wNo||LW.w))||WEEKS[0],days=[];for(let x=W.tu;x<=Math.min(W.den,MONTH.ndays);x++)days.push(x);
  if(!LW.kenh||!CHANNELS.some(c=>c.k===LW.kenh))LW.kenh=CHANNELS[0].k;const chs=CHANNELS.filter(ch=>ch.k===LW.kenh),inW=C.filter(c=>c.day>=W.tu&&c.day<=W.den);
  const cnt=k=>inW.filter(c=>LW_ST(c)[0]===k).length;
  const sum=[["Kế hoạch",inW.length,""],["Chưa giao",cnt("new"),"new"],["Đang làm",cnt("doing"),"doing"],["Chờ duyệt",cnt("wait"),"wait"],["Chờ đăng",cnt("post"),"post"],["Đã đăng",cnt("done"),"done"],["Trễ",cnt("late"),"late"]];
  b.innerHTML=`${head?`<h3 class="lwmh">Tuần ${W.w} · ${dd(W.tu)}–${dd(Math.min(W.den,MONTH.ndays))}</h3>`:""}<div class="lwsumline">${sum.map(([l,v,k])=>`<span class="${v?"":"z"}">${k?`<i class="lwd lw-${k}"></i>`:""}${l} <b class="numeric">${v}</b></span>`).join("")}</div>
  ${lwStat(d,chs[0],W)}
  <section class="card flush lwgrid"><div class="lwg" style="grid-template-columns:repeat(${days.length},minmax(0,1fr))">
   ${days.map(x=>`<div class="lwh${x===today?" now":""}"><b>${THU[wd(x)]}</b> ${dd(x)}</div>`).join("")}
   ${chs.map(ch=>{const I=inW.filter(c=>c.kenh===ch.k),done=I.filter(c=>c.step==="xong").length;return `${days.map(x=>{const L=I.filter(c=>c.day===x),em=typeof slotEmpty==="function"?slotEmpty(ch.k,x,L.length):"";return `<div class="lwcell${x===today?" now":""}">${L.map(lwChip).join("")}${em}${!L.length&&!em?`<span class="lwe">—</span>`:""}</div>`}).join("")}`}).join("")}
  </div></section>`;
}
/* Trang Lịch content: Tuần (mặc định) · Tháng · Pillar & tuyến. Bỏ các bảng từng kênh kéo ngang như Sheet. */
const _pLichOld=pLich;
pLich=function(m){
  const tab=SUB.lich&&["week","cal"].includes(SUB.lich)?SUB.lich:"week";SUB.lich=tab;
  const bindTabs=()=>m.querySelectorAll("[data-lwv]").forEach(b=>b.onclick=()=>{SUB.lich=b.dataset.lwv;renderMain()});
  const d=D();if(!LW.w)LW.w=weekOf(d.settings.today)||1;const W=WEEKS.find(w=>w.w===LW.w)||WEEKS[0];
  m.innerHTML=H("Calendar","Video nào lên kênh nào, ngày nào · bấm ô trống để chọn video, bấm một video để mở thẻ")+`<div class="lwtool">
   ${tab==="week"?`<div class="seg"><button data-lww="-1" ${LW.w<=1?"disabled":""} aria-label="Tuần trước">‹</button><button class="on">Tuần ${W.w} · ${dd(W.tu)}–${dd(Math.min(W.den,MONTH.ndays))}</button><button data-lww="1" ${LW.w>=WEEKS.length?"disabled":""} aria-label="Tuần sau">›</button></div>`:""}
   ${lwTabs(tab)}
   </div><div class="seg lwks">${CHANNELS.map(c=>[c.k,c.short]).map(([k,t])=>`<button class="${LW.kenh===k?"on":""}" data-lwk="${esc(k)}">${esc(t)}</button>`).join("")}</div><div id="lb"></div>`;
  bindTabs();
  m.querySelectorAll("[data-lww]").forEach(x=>x.onclick=()=>{LW.w=Math.max(1,Math.min(WEEKS.length,LW.w+ +x.dataset.lww));renderMain()});
  m.querySelectorAll("[data-lwk]").forEach(x=>x.onclick=()=>{LW.kenh=x.dataset.lwk;renderMain()});
  const C=d.cards.filter(c=>(!LF.sku||c.sku===LF.sku)&&(!LF.nguoi||c.nguoi===LF.nguoi));
  if(tab==="week")lichTuan($("#lb"),C);
  else{const lb=$("#lb");lb.innerHTML=WEEKS.map(w=>`<div class="lwmw" id="lwm${w.w}"></div>`).join("");WEEKS.forEach(w=>lichTuan($("#lwm"+w.w),C,w.w,true))}
};
const lwTabs=tab=>`<div class="seg">${[["week","Tuần"],["cal","Tháng"]].map(([k,t])=>`<button data-lwv="${k}" class="${k===tab?"on":""}">${t}</button>`).join("")}</div>`;
PAGES.lich=pLich;
