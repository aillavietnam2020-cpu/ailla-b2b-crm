/* =====================================================================
   DỰ ÁN KÊNH (chị Hoa 03/11/2026): giao kênh cho ai (Người giữ kênh, d.kenhPT[kênh].chinh) thì kênh đó là một dự án người đó phụ trách.
   - Người giữ kênh: lên lịch đăng (ngày đăng = c.day của thẻ video), đăng video hằng ngày (thẻ bước "dang" → đã đăng),
     nhận việc trong "Việc của tôi": đăng video hôm nay, hôm nay chưa có video lên lịch, thiếu video cho 3 ngày tới,
     video duyệt xong mà chưa xếp ngày đăng; thông báo góc dưới mỗi ngày một lần.
   - Trong dự án kênh: tiến độ theo giai đoạn, ai đang làm bao nhiêu video (gom theo người), Lead chia video chưa giao cho
     nhiều người (mỗi người một phần, giao bằng xvAssign nên thông báo gộp "giao bạn N việc").
   - Không lưu gì riêng: đọc thẳng thẻ video ở Điều phối và kế hoạch tháng (dqPlanOf).
   ===================================================================== */
const KDA={chia:""};
const kdOwner=k=>((D().kenhPT||{})[k]||{}).chinh||"";
/* CEO, Lead, trưởng phòng thấy mọi dự án kênh (chị Hoa 03/11) */
const kdBoss=()=>!!ME&&(ME.role==="admin"||ME.role==="lead"||ME.role==="truongphong");
const kdMine=()=>!ME?[]:CHANNELS.filter(ch=>kdOwner(ch.k)===ME.id);
const kdSee=()=>!ME?[]:(ME.role==="admin"||ME.role==="lead"||ME.role==="truongphong")?CHANNELS:CHANNELS.filter(ch=>kdOwner(ch.k)===ME.id||chanHelp(ch.k).includes(ME.id));
/* tên kênh hiện ra giống các trang khác (tenhien.js: TikTok Via 1 → Gia dụng AiBio…) */
const kdNm=ch=>{let n=ch.k;if(typeof RL_MAP!=="undefined")RL_MAP.forEach(([a,b])=>{n=n.replace(a,b)});return n===ch.k?(ch.short||ch.k):n};
const kdCards=k=>(D().cards||[]).filter(c=>c.kenh===k&&c.step!=="huy");
/* số video cần đăng mỗi ngày: kế hoạch tháng của kênh chia đều số ngày (ít nhất 1 khi có kế hoạch) */
const kdPerDay=k=>{let T=0;try{T=typeof dqPlanOf==="function"?dqPlanOf(k):0}catch(e){}return T?Math.max(1,Math.round(T/MONTH.ndays)):0};
function kdStat(ch){const td=D().settings.today,nd=MONTH.ndays,C=kdCards(ch.k),per=kdPerDay(ch.k);
  const sched=x=>C.filter(c=>c.step!=="xong"&&+c.day===x),posted=x=>C.filter(c=>c.step==="xong"&&(+c.ngayDang||+c.day)===x);
  const next=[1,2,3].map(i=>td+i).filter(x=>x<=nd).map(x=>({x,n:sched(x).length,ready:sched(x).filter(c=>c.step==="dang").length}));
  const today=sched(td),todayReady=today.filter(c=>c.step==="dang");
  return {ch,C,per,td,today,todayReady,todayPosted:posted(td),next,miss:per?next.filter(o=>o.n<per):[],
    noDay:C.filter(c=>c.step==="dang"&&(!+c.day||+c.day<td)),cg:C.filter(c=>c.step==="cg"||!c.nguoi)}}
const kdDay=x=>{const d=new Date(MONTH.year,MONTH.mon-1,x);return ["CN","T2","T3","T4","T5","T6","T7"][d.getDay()]+" "+dd(x)};

/* ---- Việc của tôi: việc của người giữ kênh ---- */
const _cvMyKd=cvMyItems;
cvMyItems=function(){const L=_cvMyKd();if(!ME||!D())return L;
  const add=o=>L.push(Object.assign({oldest:null,age_days:0,page:"",count:1,go:"cv_da",mod:"cv"},o));
  kdMine().forEach(ch=>{const s=kdStat(ch),nm=kdNm(ch);
    if(s.todayReady.length)add({key:"kd_post_"+ch.k,group:"Đến lượt tôi làm",title:`Đăng ${s.todayReady.length} video hôm nay · ${nm}`,detail:"Video đã duyệt, lịch đăng hôm nay",chip:"Đăng bài",chipC:"blu"});
    if(s.per&&!s.today.length&&!s.todayPosted.length)add({key:"kd_none_"+ch.k,group:"Đến lượt tôi làm",title:`Hôm nay chưa có video lên lịch · ${nm}`,detail:`Cần ${s.per} video/ngày theo kế hoạch tháng · xếp video vào lịch đăng hôm nay`,chip:"Thiếu lịch",chipC:"red",age_days:1});
    if(s.miss.length)add({key:"kd_miss_"+ch.k,group:"Cần phân công / theo dõi",title:`Thiếu video lên lịch 3 ngày tới · ${nm}`,detail:s.miss.map(o=>`${kdDay(o.x)}: ${o.n}/${s.per}`).join(" · "),chip:"Cảnh báo",chipC:"amb"});
    if(s.noDay.length)add({key:"kd_noday_"+ch.k,group:"Đến lượt tôi làm",title:`${s.noDay.length} video duyệt xong chưa xếp ngày đăng · ${nm}`,detail:"Chọn ngày đăng cho từng video",chip:"Xếp lịch",chipC:"amb"})});
  if(ME.role==="lead"||ME.role==="truongphong")CHANNELS.forEach(ch=>{const s=kdStat(ch);if(s.cg.length&&(teamOf(ME)==="content"||ME.phongBan==="CM"))add({key:"kd_cg_"+ch.k,group:"Cần phân công / theo dõi",title:`${s.cg.length} video chưa giao · ${kdNm(ch)}`,detail:`Người giữ kênh: ${userName(kdOwner(ch.k))||"chưa giao kênh"} · bấm Chia video ở dự án kênh`,chip:"Chia video",chipC:"amb"})});
  return L};
/* thông báo góc dưới: mỗi việc mỗi ngày một lần */
function kdNotify(){if(!ME||!D()||typeof ntPush!=="function")return;const day=MONTH.key+"-"+D().settings.today;
  kdMine().forEach(ch=>{const s=kdStat(ch),nm=kdNm(ch),go=()=>{MOD="cv";PAGE="cv_da";render()};
    if(s.todayReady.length)ntPush({key:`kd:${day}:${ch.k}:post`,type:"giao",text:`Hôm nay có ${s.todayReady.length} video cần đăng trên ${nm}`,go});
    if(s.per&&!s.today.length&&!s.todayPosted.length)ntPush({key:`kd:${day}:${ch.k}:none`,type:"giao",text:`${nm}: hôm nay chưa có video nào lên lịch đăng`,go});
    if(s.miss.length)ntPush({key:`kd:${day}:${ch.k}:miss`,type:"giao",text:`${nm}: thiếu video lên lịch ${s.miss.map(o=>kdDay(o.x)).join(", ")}`,go})})}
setInterval(kdNotify,60e3);setTimeout(kdNotify,12e3);

/* ---- thẻ dự án kênh (trang Dự án) ---- */
/* logo nền tảng của kênh: TikTok / Facebook */
const KD_LOGO={tt:"M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  fb:"M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"};
const kdLogo=ch=>`<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="${KD_LOGO[/tiktok/i.test(ch.k)?"tt":"fb"]}"/></svg>`;
if(!document.getElementById("kdlogo-css")){const st=document.createElement("style");st.id="kdlogo-css";st.textContent=".pjic.kdlogo{display:inline-flex;align-items:center;justify-content:center}.pjic.kdlogo.tt{background:#111827!important;color:#fff}.pjic.kdlogo.fb{background:#e7f0fe!important;color:#1877f2}";document.head.appendChild(st)}
function kdCardHtml(ch){const s=kdStat(ch),own=kdOwner(ch.k),nm=kdNm(ch),N=s.C.length;
  const holders={};s.C.filter(c=>c.step!=="xong"&&c.step!=="cg"&&c.nguoi).forEach(c=>{const h=c.step==="dang"?own:(typeof pjHolder==="function"?pjHolder(c):c.nguoi)||c.nguoi;if(!h)return;const o=holders[h]=holders[h]||{n:0,tre:0,st:{}};o.n++;if(isLate(c))o.tre++;const g=(PJ_GD.find(z=>z[2].includes(c.step))||["","?"])[1];o.st[g]=(o.st[g]||0)+1});
  const lead=ME.role==="admin"||ME.role==="lead"||ME.role==="truongphong";
  return `<section class="pj kdpj"><div class="pjh"><span class="pjic kdlogo${/tiktok/i.test(ch.k)?" tt":" fb"}">${kdLogo(ch)}</span><div class="pjt"><b>Vận hành kênh ${esc(nm)}</b><small>Dự án kênh · phụ trách ${esc(userName(own)||"chưa giao kênh")}</small></div>${s.miss.length||(!s.today.length&&!s.todayPosted.length&&s.per)?pill("Thiếu lịch đăng","red"):pill("Đủ lịch","grn")}</div>
   <div class="kdday"><div class="kdt"><small>Hôm nay</small><b>${s.todayPosted.length}</b><span>đã đăng · ${s.todayReady.length} chờ đăng${s.per?` · cần ${s.per}`:""}</span></div>${s.next.map(o=>`<div class="${s.per&&o.n<s.per?"miss":""}"><small>${kdDay(o.x)}</small><b>${o.n}</b><span>${s.per?"/"+s.per+" ":""}lên lịch</span></div>`).join("")}</div>
   ${s.noDay.length?`<p class="kdwarn">⚠️ ${s.noDay.length} video duyệt xong chưa xếp ngày đăng</p>`:""}
   ${N?`<div class="pjgd"><div class="pjgdh">Tiến độ video <small>· ${N} video</small></div>${PJ_GD.map(([k,t],i)=>{const here=s.C.filter(c=>PJ_GD.findIndex(g=>g[2].includes(c.step))===i&&c.step!=="xong"&&c.step!=="cg"),past=s.C.filter(c=>PJ_GD.findIndex(g=>g[2].includes(c.step))>i||c.step==="xong").length,pc=Math.round(past/N*100);return `<div class="pjs" style="cursor:default"><b class="pjs1">${t}</b><i class="pjsb"><i style="width:${pc}%"></i></i><span class="pjs2"><b>${past}</b>/${N}</span><span class="pjs3">${here.length?here.length+" đang làm":""}</span></div>`}).join("")}</div>`:`<p class="hint">Kênh chưa có video trong kế hoạch tháng.</p>`}
   <div class="pjgdh" style="margin-top:8px">Ai đang làm video của kênh</div>${Object.keys(holders).length?`<div class="kdppl">${Object.entries(holders).sort((a,b)=>b[1].n-a[1].n).map(([id,o])=>`<span>${avatar(id)}<b>${esc(userName(id)||"")}</b> ${o.n} video <small>${esc(Object.entries(o.st).map(([g,n])=>g+" "+n).join(" · "))}</small>${o.tre?` <em>${o.tre} trễ</em>`:""}</span>`).join("")}</div>`:`<p class="hint">Chưa giao video cho ai.</p>`}
   <div class="pjf"><span class="hint">${s.cg.length?s.cg.length+" video chưa giao":""}</span><span class="sp"></span>${lead&&s.cg.length?`<button type="button" class="btn sm pri" data-kdchia="${esc(ch.k)}">Chia video</button>`:""}<button type="button" class="btn sm" data-kdlich="${esc(ch.k)}">Lịch đăng</button><button type="button" class="btn sm" data-kddp="${esc(ch.k)}">Điều phối kênh</button></div></section>`}
function kdBind(m){
  m.querySelectorAll("[data-kdchia]").forEach(b=>b.onclick=()=>kdChia(b.dataset.kdchia));
  m.querySelectorAll("[data-kdlich]").forEach(b=>b.onclick=()=>{if(typeof CG!=="undefined")CG.k=b.dataset.kdlich;PAGE="lich";MOD="";render()});
  m.querySelectorAll("[data-kddp]").forEach(b=>b.onclick=()=>{if(typeof bvGo==="function")bvGo(b.dataset.kddp,"","")})}
/* Lead chia video chưa giao cho nhiều người: mỗi người một số lượng, video quay mới giao viết kịch bản, còn lại giao edit */
function kdChia(k){const ch=chOf(k),s=kdStat(CHANNELS.find(x=>x.k===k)||ch),C=s.cg.slice().sort((a,b)=>(+a.day||99)-(+b.day||99));
  const ppl=D().users.filter(u=>u.active&&u.name&&u.role!=="admin"&&(teamOf(u)==="content"||u.phongBan==="CM"));
  openDrawerHTML(`<h2>Chia video · ${esc(kdNm(chOf(k).k?chOf(k):{k,short:k}))}</h2><p class="hint">${C.length} video chưa giao, xếp theo ngày đăng. Nhập số video cho từng người, mỗi người nhận một thông báo gộp. Video quay mới giao viết kịch bản trước, video reup / có sẵn giao edit.</p>
   <form class="frm" id="kd-f"><div class="kdchia">${ppl.map(u=>`<label>${avatar(u.id)}<span>${esc(u.name)}<small>đang làm ${typeof xvOpen==="function"?xvOpen(u.id).length:0}</small></span><input type="number" min="0" max="${C.length}" data-kdu="${esc(u.id)}" value="0"></label>`).join("")}</div>
   <div class="acts"><button type="button" class="btn" id="kd-deu">Chia đều</button><span class="hint" id="kd-sum"></span><span class="sp"></span><button class="btn pri">Giao</button></div></form>`);
  const I=[...document.querySelectorAll("[data-kdu]")],sum=()=>{const n=I.reduce((z,i)=>z+(+i.value||0),0);$("#kd-sum").textContent=`${n}/${C.length} video`;$("#kd-sum").style.color=n>C.length?"#dc2626":""};I.forEach(i=>i.oninput=sum);sum();
  $("#kd-deu").onclick=()=>{const on=I.filter(i=>+i.value>0).length?I.filter(i=>+i.value>0):I,b=Math.floor(C.length/on.length);on.forEach((i,j)=>i.value=b+(j<C.length%on.length?1:0));sum()};
  $("#kd-f").onsubmit=e=>{e.preventDefault();let p=0,done=0;const n=I.reduce((z,i)=>z+(+i.value||0),0);if(!n){toast("Nhập số video cho ít nhất một người");return}if(n>C.length){toast("Tổng vượt số video chưa giao");return}
    I.forEach(i=>{const q=+i.value||0;if(!q)return;const part=C.slice(p,p+q);p+=q;const kb=part.filter(c=>loaiOf(c)==="moi").map(c=>c.id),ed=part.filter(c=>loaiOf(c)!=="moi").map(c=>c.id);
      if(kb.length)xvAssign(kb,i.dataset.kdu,"kịch bản");if(ed.length)xvAssign(ed,i.dataset.kdu,"edit");done+=q});
    toast(`Đã chia ${done} video`);closeDrawer();renderMain()}}
/* gắn vào trang Dự án: dự án kênh đứng đầu */
const _pCvDaKd=pCvDa;
pCvDa=function(m){_pCvDaKd(m);const L=kdSee();if(!L.length)return;const g=m.querySelector(".pjgrid");const h=`<div class="pjgrid kdgrid">${L.map(kdCardHtml).join("")}</div>`;
  if(g)g.insertAdjacentHTML("beforebegin",`<h3 class="kdh">📡 Dự án kênh</h3>${h}<h3 class="kdh">▣ Dự án khác</h3>`);else{const c=m.querySelector("section.card:last-of-type");(c||m).insertAdjacentHTML(c?"beforebegin":"beforeend",`<h3 class="kdh">📡 Dự án kênh</h3>${h}`)}kdBind(m)};
PAGES.cv_da=m=>pCvDa(m);
/* Công việc › Tổng quan: khung "Kênh tôi phụ trách" (chỉ người giữ kênh) */
const _pCvVKd=pCvV;
/* CEO / Lead xem dự án kênh ở Dự án, không hiện hàng này ở Công việc (chị Hoa 04/11: "bỏ cái này đi") — chỉ người giữ kênh thấy kênh mình */
pCvV=function(m){_pCvVKd(m);try{const boss=kdBoss(),L=boss?[]:kdMine();if(!L.length)return;const bar=m.querySelector(".cvvbar");if(!bar)return;
  /* một hàng gọn (chị Hoa 03/11: khung to đẩy "Việc của tôi" khuất xuống dưới) */
  bar.insertAdjacentHTML("beforebegin",`<div class="kdstrip"><b>📡 ${boss?"Dự án kênh":"Kênh tôi phụ trách"}</b>${L.map(ch=>{const s=kdStat(ch),bad=s.miss.length||(!s.today.length&&!s.todayPosted.length&&s.per);return `<button type="button" class="kdchip${bad?" bad":""}" data-kdgo="1" title="${esc(kdNm(ch))} · ${esc(userName(kdOwner(ch.k))||"chưa giao kênh")} · hôm nay ${s.todayPosted.length} đã đăng, ${s.todayReady.length} chờ đăng${s.miss.length?" · thiếu lịch "+s.miss.map(o=>kdDay(o.x)).join(", "):""}${s.cg.length?" · "+s.cg.length+" video chưa giao":""}">${esc(kdNm(ch))}${boss?` <small>${esc((userName(kdOwner(ch.k))||"").split(" ").pop())}</small>`:""} <i>${bad?"thiếu lịch":"đủ lịch"}</i></button>`}).join("")}</div>`);
  m.querySelectorAll("[data-kdgo]").forEach(e=>e.onclick=()=>{PAGE="cv_da";render()})}catch(e){console.error("dự án kênh",e)}};
PAGES.cv_v=m=>pCvV(m);
