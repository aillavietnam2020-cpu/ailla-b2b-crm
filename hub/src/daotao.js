/* =====================================================================
   ĐÀO TẠO & ONBOARDING (web vận hành › Đào tạo). Chị Hoa duyệt demo 02/11/2026 (Downloads\demo-dao-tao-onboarding.html).
   - Đào tạo của tôi: lộ trình Ngày 1 / Tuần 1 / Tháng 1, tài liệu bắt buộc chưa đọc, bấm "Tôi đã đọc và hiểu".
   - Thư viện: Chung (nội quy, quy chế) · Sổ tay web vận hành · Tài liệu team (chỉ team đó + quản lý + CEO/nhân sự).
   - Theo dõi nhân viên mới (quản lý thấy phòng mình, CEO/nhân sự thấy hết) · Soạn tài liệu · Ai xem được gì.
   Máy chủ: src/server/routes/daoTao.ts (quyền xem/soạn kiểm ở máy chủ, services/daoTao.ts). Trang chỉ vẽ.
   Nội dung tài liệu viết kiểu chữ thường có vài dấu: "# " tiêu đề, "## " tiêu đề nhỏ, "- " gạch đầu dòng, "1. " bước,
   "> " lưu ý, "**chữ đậm**", "[chữ](https://…)", "![mô tả](mã ảnh)". dtMd() đổi sang HTML (đã thoát ký tự trước).
   ===================================================================== */
const DT={me:null,docs:null,acks:[],at:0,busy:false,err:"",cur:null,doc:{},road:"d1",f:"",q:"",edit:null,track:null,eds:null,ans:{}};
const DT_API="/api/hub/daotao";
const DT_NHOM={chung:"Chung — mọi nhân viên",web:"Sổ tay web vận hành",team:"Tài liệu team"};
const DT_BB={moi:"Bắt buộc với nhân viên mới",tat_ca:"Bắt buộc với mọi người",khong:"Không bắt buộc"};
const DT_LT={d1:"Ngày 1",w1:"Tuần 1",m1:"Tháng 1"};
const dtDep=k=>((DT.me&&DT.me.deps)||[]).find(d=>d.k===k)?.n||k;
const dtTeams=d=>(d.teams||[]).map(dtDep).join(", ");
const dtDay=s=>s?String(s).slice(0,10).split("-").reverse().join("/"):"";
const dtAck=id=>DT.acks.find(a=>a.doc_id===id);
/* Đã đọc bản hiện tại chưa; đã đọc bản cũ = phải đọc lại. */
const dtDone=d=>{const a=dtAck(d.id);return !!a&&a.version>=d.version};
const dtOld=d=>{const a=dtAck(d.id);return !!a&&a.version<d.version};
const dtNewbie=()=>!!(DT.me&&DT.me.newbie&&!DT.me.newbie.done_at);
const dtReq=d=>d.status==="dang"&&(d.bat_buoc==="tat_ca"||(d.bat_buoc==="moi"&&dtNewbie()));
const dtPub=()=>(DT.docs||[]).filter(d=>d.status==="dang");

async function dtLoad(force){
  if(DT.busy||!ME||typeof svApi!=="function")return;if(!force&&DT.at&&Date.now()-DT.at<60000)return;
  DT.busy=true;
  try{const [me,L]=await Promise.all([svApi(DT_API+"/me"),svApi(DT_API+"/docs")]);DT.me=me;DT.docs=L.docs||[];DT.acks=L.acks||[];DT.err=""}
  catch(e){DT.err=e.message||"Không tải được";if(!DT.docs)DT.docs=[]}
  DT.busy=false;DT.at=Date.now();if(String(PAGE).startsWith("dt_"))renderMain()}
async function dtOpen(id){DT.cur=id;if(!String(PAGE).startsWith("dt_")||PAGE==="dt_soan"||PAGE==="dt_theo"||PAGE==="dt_quyen"){PAGE="dt_lib";MOD="dt"}render();scrollTo(0,0);
  try{DT.doc[id]=await svApi(DT_API+"/docs/"+id)}catch(e){DT.doc[id]={err:e.message||"Không mở được tài liệu"}}renderMain()}
function dtGo(p){DT.cur=null;PAGE=p;MOD="dt";render();scrollTo(0,0)}

/* ---------- chữ → HTML (thoát ký tự trước, chỉ cho vài dấu đơn giản) ---------- */
function dtInline(s){
  return esc(s).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(m,t,u)=>`<a href="${u}" target="_blank" rel="noopener">${t}</a>`)}
function dtImgSrc(s){s=String(s||"").trim();if(/^[0-9a-f-]{36}$/i.test(s))return DT_API+"/img/"+s;if(/^https:\/\/[^\s"'<>]+$/.test(s))return s;return ""}
function dtMd(text){
  const out=[],L=String(text||"").replace(/\r/g,"").split("\n");let ul=false,para=[],h=0;
  const flush=()=>{if(para.length){out.push(`<p>${para.map(dtInline).join("<br>")}</p>`);para=[]}if(ul){out.push("</ul>");ul=false}};
  for(const raw of L){const t=raw.trim();let m;
    if(!t){flush();continue}
    if((m=t.match(/^!\[([^\]]*)\]\(([^)]+)\)$/))){flush();const src=dtImgSrc(m[2]);out.push(src?`<figure class="dt-fig"><img src="${esc(src)}" alt="${esc(m[1])}" loading="lazy">${m[1]?`<figcaption>${esc(m[1])}</figcaption>`:""}</figure>`:"");continue}
    if((m=t.match(/^(#{1,2})\s+(.+)$/))){flush();const tag=m[1].length===1?"h2":"h3";out.push(`<${tag} id="dth${h++}">${dtInline(m[2])}</${tag}>`);continue}
    if(t==="---"){flush();out.push("<hr>");continue}
    if((m=t.match(/^>\s?(.*)$/))){flush();out.push(`<div class="dt-tip">💡 ${dtInline(m[1])}</div>`);continue}
    if((m=t.match(/^(\d+)[.)]\s+(.+)$/))){flush();out.push(`<p class="dt-step"><span class="dt-num">${m[1]}</span><span>${dtInline(m[2])}</span></p>`);continue}
    if((m=t.match(/^[-*•]\s+(.+)$/))){if(para.length){out.push(`<p>${para.map(dtInline).join("<br>")}</p>`);para=[]}if(!ul){out.push("<ul>");ul=true}out.push(`<li>${dtInline(m[1])}</li>`);continue}
    if(ul){out.push("</ul>");ul=false}para.push(t)}
  flush();return out.join("")}
const dtToc=text=>String(text||"").split("\n").map(x=>x.trim().match(/^(#{1,2})\s+(.+)$/)).filter(Boolean).map((m,i)=>`<a href="#dth${i}" class="${m[1].length===2?"sub":""}">${esc(m[2].replace(/\*\*/g,""))}</a>`).join("");

/* Câu kiểm tra soạn bằng chữ: "? câu hỏi" rồi các dòng "* đáp án đúng" / "- đáp án sai". */
function dtQuizParse(t){const Q=[];let cur=null;
  for(const raw of String(t||"").split("\n")){const s=raw.trim();if(!s)continue;
    if(s.startsWith("?")){cur={q:s.slice(1).trim(),o:[],a:-1};Q.push(cur);continue}
    if(!cur)return {err:"Mỗi câu bắt đầu bằng dấu ? ở đầu dòng"};
    if(s.startsWith("*")){cur.a=cur.o.length;cur.o.push(s.slice(1).trim())}else if(s.startsWith("-"))cur.o.push(s.slice(1).trim());else return {err:"Đáp án bắt đầu bằng * (đúng) hoặc - (sai): "+s}}
  for(const q of Q){if(q.o.length<2)return {err:"Câu \""+q.q+"\" cần ít nhất 2 đáp án"};if(q.a<0)return {err:"Câu \""+q.q+"\" chưa đánh dấu * đáp án đúng"}}
  return {quiz:Q}}
const dtQuizText=Q=>(Q||[]).map(q=>"? "+q.q+"\n"+q.o.map((o,i)=>(i===q.a?"* ":"- ")+o).join("\n")).join("\n\n");

/* ---------- khung chung ---------- */
const DT_CSS=`<style>
.dt-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px}
.dt-bar{height:8px;background:var(--gray-soft,#f2f4f7);border-radius:99px;overflow:hidden;margin-top:6px}.dt-bar i{display:block;height:100%;background:#4b54d1;border-radius:99px}.dt-bar.red i{background:var(--red,#b42318)}
.dt-item{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line);cursor:pointer}.dt-item:last-child{border-bottom:0}.dt-item:hover b{color:#4b54d1}
.dt-item .t{flex:1;min-width:0}.dt-item .t small{display:block;color:var(--muted);font-size:13px}.dt-ck{width:22px;height:22px;border-radius:50%;border:2px solid #c5cad8;flex:none;margin-top:1px;display:grid;place-items:center;font-size:13px;color:#fff}.dt-ck.on{background:var(--green,#087a55);border-color:var(--green,#087a55)}
.dt-doc{max-width:860px;font-size:15px;line-height:1.65}.dt-doc h2{font-size:18px;margin:22px 0 6px}.dt-doc h3{font-size:16px;margin:16px 0 4px}.dt-doc ul{padding-left:22px;margin:6px 0}.dt-doc p{margin:8px 0}
.dt-doc code{background:var(--gray-soft,#f2f4f7);padding:1px 6px;border-radius:6px;font-size:13.5px}
.dt-step{display:flex;gap:10px;align-items:flex-start}.dt-num{display:inline-grid;place-items:center;min-width:24px;height:24px;border-radius:50%;background:var(--pink,#e7357b);color:#fff;font-size:12.5px;font-weight:700;margin-top:1px}
.dt-tip{background:var(--blue-soft,#eef4ff);color:#1b3d8a;border-radius:12px;padding:10px 14px;margin:10px 0}
.dt-fig{margin:12px 0}.dt-fig img{max-width:100%;border:1px solid var(--line);border-radius:10px}.dt-fig figcaption{font-size:13px;color:var(--muted)}
.dt-read{display:grid;grid-template-columns:220px minmax(0,1fr);gap:16px;align-items:start}.dt-toc{position:sticky;top:76px}.dt-toc a{display:block;color:var(--ink);text-decoration:none;padding:4px 8px;border-radius:8px;font-size:13.5px}.dt-toc a.sub{padding-left:20px;color:var(--muted)}.dt-toc a:hover{background:var(--gray-soft,#f2f4f7)}
.dt-ok{background:var(--green-soft,#e8f8f0);border:1px solid #9ee0c2;border-radius:12px;padding:14px 16px;margin-top:18px}
.dt-quiz label{display:block;padding:6px 10px;border:1px solid var(--line);border-radius:10px;margin:5px 0;cursor:pointer;font-size:14px}.dt-quiz label input{width:auto;margin-right:8px}
.dt-chips{display:flex;gap:6px;flex-wrap:wrap}
.dt-ed textarea{font-family:var(--fm,monospace);font-size:13.5px;line-height:1.5}.dt-tb{display:flex;gap:4px;flex-wrap:wrap;margin:6px 0}
.dt-cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.dt-cols>.card{margin:0}
@media(max-width:900px){.dt-read,.dt-cols{grid-template-columns:1fr}.dt-toc{position:static}}
</style>`;
const dtCk=on=>`<span class="dt-ck${on?" on":""}">${on?"✓":""}</span>`;
function dtItem(d,sub){const done=dtDone(d),old=dtOld(d);
  const tag=d.status!=="dang"?pill(d.status==="cho_duyet"?"Chờ CEO duyệt":"Nháp","amb"):done?pill("Đã hiểu","grn"):old?pill("Có bản mới, đọc lại","amb"):dtReq(d)?pill("Bắt buộc","red"):"";
  return `<div class="dt-item" data-dtopen="${esc(d.id)}">${dtCk(done)}<div class="t"><b>${esc(d.title)}</b><small>${esc(sub!=null?sub:(d.summary||DT_NHOM[d.nhom]||""))}</small></div>${tag}</div>`}
function dtWire(m){
  m.querySelectorAll("[data-dtopen]").forEach(b=>b.onclick=()=>dtOpen(b.dataset.dtopen));
  m.querySelectorAll("[data-dtgo]").forEach(b=>b.onclick=()=>dtGo(b.dataset.dtgo))}
function dtWait(m,t){m.innerHTML=H(t,"Đang tải…");dtLoad()}

/* ---------- Đào tạo của tôi ---------- */
function pDtHome(m){
  if(DT.cur)return pDtRead(m);
  if(!DT.docs)return dtWait(m,"Đào tạo của tôi");dtLoad();
  const P=dtPub(),road=P.filter(d=>d.lo_trinh),req=P.filter(dtReq),todo=req.filter(d=>!dtDone(d)),old=P.filter(dtOld),me=DT.me||{},nb=me.newbie;
  const pct=road.length?Math.round(road.filter(dtDone).length/road.length*100):0;
  const pend=(DT.docs||[]).filter(d=>d.status==="cho_duyet");
  const lt=road.filter(d=>d.lo_trinh===DT.road);
  m.innerHTML=DT_CSS+H("Đào tạo của tôi",nb?`Vào làm ${dtDay(nb.start_date)}${nb.done_at?" · đã xong onboarding":" · đang trong lộ trình nhân viên mới"}`:"Tài liệu công ty, sổ tay dùng web và tài liệu của team bạn")+
  (DT.err?`<div class="note red">${esc(DT.err)}</div>`:"")+
  (me.ceo&&pend.length?`<div class="warn">Có <b>${pend.length}</b> tài liệu Chung đang chờ chị duyệt: ${pend.map(d=>`<a href="#" data-dtopen="${esc(d.id)}">${esc(d.title)}</a>`).join(", ")}</div>`:"")+
  `<div class="dt-kpis">
    <div class="kpi"><div class="l">Lộ trình onboarding</div><div class="v">${pct}%</div><div class="dt-bar"><i style="width:${pct}%"></i></div></div>
    <div class="kpi"><div class="l">Bắt buộc chưa đọc</div><div class="v${todo.length?" t-red":""}">${todo.length}</div><div class="h">trên ${req.length} tài liệu bắt buộc</div></div>
    <div class="kpi"><div class="l">Đã xác nhận hiểu</div><div class="v">${P.filter(dtDone).length}</div><div class="h">tài liệu</div></div>
    <div class="kpi"><div class="l">Có bản mới cần đọc lại</div><div class="v${old.length?" t-amb":""}">${old.length}</div><div class="h">${old.length?esc(old.map(d=>d.title).join(", ")):"không có"}</div></div></div>
  <div class="grid cols2">
    <section class="card"><div class="card-h"><h2>Lộ trình nhân viên mới</h2></div>
      <div class="dt-chips" style="margin-bottom:6px">${Object.entries(DT_LT).map(([k,n])=>`<button class="btn sm${DT.road===k?" pri":""}" data-dtroad="${k}">${n} <b>${road.filter(d=>d.lo_trinh===k&&dtDone(d)).length}/${road.filter(d=>d.lo_trinh===k).length}</b></button>`).join("")}</div>
      ${lt.length?lt.map(d=>dtItem(d)).join(""):`<p class="empty">Chưa có tài liệu nào xếp vào ${DT_LT[DT.road]}.</p>`}</section>
    <div><section class="card"><div class="card-h"><h2>Cần đọc</h2><span class="hint">bắt buộc và chưa xác nhận, hạn gần nhất ở trên</span></div>
      ${todo.concat(old.filter(d=>!todo.includes(d))).map(d=>dtItem(d,(d.summary||DT_NHOM[d.nhom])+(dtNewbie()&&nb&&d.bat_buoc==="moi"?" · hạn "+dtDay(dtDue(nb.start_date,d.han_ngay)):""))).join("")||`<p class="empty">Bạn đã đọc hết tài liệu bắt buộc. 👏</p>`}</section>
      <section class="card"><h2>Có thắc mắc?</h2><p class="hint" style="margin:6px 0 0">Mở tài liệu, kéo xuống cuối bấm <b>Hỏi người soạn</b>. Câu trả lời hiện ngay dưới tài liệu đó.${nb&&nb.mentor_id?` Người kèm của bạn: <b>${esc(nb.mentor_id)}</b>.`:""}</p>
      <div class="acts" style="margin-top:10px"><button class="btn" data-dtgo="dt_lib">Mở thư viện tài liệu</button></div></section></div></div>`;
  m.querySelectorAll("[data-dtroad]").forEach(b=>b.onclick=()=>{DT.road=b.dataset.dtroad;renderMain()});
  dtWire(m);m.querySelectorAll("a[data-dtopen]").forEach(a=>a.addEventListener("click",e=>e.preventDefault()))}
const dtDue=(start,days)=>{const t=new Date(start+"T00:00:00");t.setDate(t.getDate()+(+days||7));return t.toISOString().slice(0,10)};

/* ---------- Thư viện ---------- */
function pDtLib(m){
  if(DT.cur)return pDtRead(m);
  if(!DT.docs)return dtWait(m,"Thư viện tài liệu");dtLoad();
  const q=DT.q.toLowerCase(),f=DT.f;
  const L=dtPub().filter(d=>(!q||(d.title+" "+d.summary).toLowerCase().includes(q))&&(!f||(f==="req"?dtReq(d):d.nhom===f)));
  const box=(t,arr,empty)=>`<section class="card"><div class="card-h"><h2>${t}</h2><span class="hint">${arr.length}</span></div>${arr.map(d=>dtItem(d)).join("")||`<p class="empty">${empty}</p>`}</section>`;
  const team=L.filter(d=>d.nhom==="team"),byT={};team.forEach(d=>(d.teams.length?d.teams:["?"]).forEach(t=>(byT[t]=byT[t]||[]).push(d)));
  m.innerHTML=DT_CSS+H("Thư viện tài liệu","Chỉ hiện tài liệu bạn được xem. Tài liệu team chỉ người trong team đó, quản lý và CEO thấy.")+
  `<div class="filters"><input id="dt-q" placeholder="Tìm tài liệu…" value="${esc(DT.q)}" style="max-width:300px">
   ${[["","Tất cả"],["chung","Chung"],["web","Sổ tay web"],["team","Team"],["req","Bắt buộc"]].map(([k,n])=>`<button class="btn sm${f===k?" pri":""}" data-dtf="${k}">${n}</button>`).join(" ")}
   <span class="sp"></span>${DT.me&&DT.me.editor?`<button class="btn sm" data-dtgo="dt_soan">✎ Soạn tài liệu</button>`:""}</div>
  <div class="dt-cols">${box("🏢 Chung — mọi nhân viên",L.filter(d=>d.nhom==="chung"),"Chưa có tài liệu chung.")}
   ${box("🧭 Sổ tay web vận hành",L.filter(d=>d.nhom==="web"),"Chưa có trang sổ tay nào.")}
   <section class="card"><div class="card-h"><h2>👥 Tài liệu theo team</h2><span class="hint">${team.length}</span></div>
     ${Object.keys(byT).length?Object.entries(byT).map(([t,arr])=>`<h3 style="margin:10px 0 2px">${esc(dtDep(t))}</h3>`+arr.map(d=>dtItem(d)).join("")).join(""):`<p class="empty">Team của bạn chưa có tài liệu riêng.</p>`}</section></div>`;
  const qi=m.querySelector("#dt-q");qi.onkeydown=e=>{if(e.key==="Enter"){DT.q=qi.value.trim();renderMain()}};qi.onchange=()=>{DT.q=qi.value.trim();renderMain()};
  m.querySelectorAll("[data-dtf]").forEach(b=>b.onclick=()=>{DT.f=b.dataset.dtf;renderMain()});dtWire(m)}

/* ---------- Đọc một tài liệu ---------- */
function pDtRead(m){
  const id=DT.cur,d=DT.doc[id];
  const back=`<button class="btn sm" id="dt-back">← Quay lại</button>`;
  if(!d){m.innerHTML=DT_CSS+back+H("Đang mở tài liệu…","");m.querySelector("#dt-back").onclick=()=>{DT.cur=null;renderMain()};return}
  if(d.err){m.innerHTML=DT_CSS+back+`<div class="note red" style="margin-top:12px">${esc(d.err)}</div>`;m.querySelector("#dt-back").onclick=()=>{DT.cur=null;renderMain()};return}
  const done=d.ack&&d.ack.version>=d.version,old=d.ack&&d.ack.version<d.version,ceo=DT.me&&DT.me.ceo;
  const A=DT.ans[id]||(DT.ans[id]=[]);
  const quiz=d.quiz&&d.quiz.length&&!done?`<div class="card dt-quiz" style="box-shadow:none;margin-top:18px"><b>Kiểm tra nhanh (${d.quiz.length} câu, đúng 80% là đạt)</b>
    ${d.quiz.map((q,i)=>`<div style="margin-top:10px"><b style="font-size:14px">${i+1}. ${esc(q.q)}</b>${q.o.map((o,j)=>`<label><input type="radio" name="dtq${i}" value="${j}" data-dtq="${i}"${A[i]===j?" checked":""}>${esc(o)}</label>`).join("")}</div>`).join("")}</div>`:"";
  const ackBox=d.status!=="dang"?`<div class="warn" style="margin-top:18px">${d.status==="cho_duyet"?"Tài liệu đang chờ CEO duyệt, chưa hiện cho mọi người.":"Bản nháp — chưa hiện cho ai ngoài người soạn."}${ceo&&d.status==="cho_duyet"?` <button class="btn pri sm" id="dt-appr">Duyệt, cho hiện</button>`:""}</div>`
    :done?`<div class="dt-ok"><b>✓ Bạn đã xác nhận đọc và hiểu</b> — ${new Date(d.ack.at).toLocaleString("vi-VN")}${d.ack.score!=null?` · đúng ${d.ack.score}/${d.quiz.length} câu`:""}</div>`
    :`<div class="dt-ok"><b>${old?"Tài liệu có bản mới — bạn đọc lại giúp nhé.":"Bạn đã đọc hết?"}</b><p class="hint" style="margin:4px 0 10px">Bấm xác nhận để web ghi lại ngày giờ. Khi tài liệu sửa sang bản mới, web sẽ nhờ bạn đọc lại.</p>
      <button class="btn pri" id="dt-ack">${d.nhom==="web"?"Tôi đã đọc và làm thử được":"Tôi đã đọc và hiểu"}</button> <span class="hint" id="dt-ackm"></span></div>`;
  const hoi=`<section class="card" style="box-shadow:none;margin-top:18px"><h3>Hỏi người soạn</h3>
    ${(d.hoi||[]).map(h=>`<div style="padding:8px 0;border-bottom:1px solid var(--line)"><div>❓ ${esc(h.text)} <span class="hint">· ${dtDay(h.created_at)}</span></div>
      ${h.answer?`<div style="margin-top:4px">💬 ${esc(h.answer)}</div>`:d.can_edit?`<div class="acts" style="margin-top:6px"><input placeholder="Trả lời…" data-dthoi-in="${esc(h.id)}"><button class="btn sm" data-dthoi="${esc(h.id)}">Gửi</button></div>`:`<div class="hint">Đang chờ trả lời</div>`}</div>`).join("")}
    <div class="acts" style="margin-top:8px"><input id="dt-ask" placeholder="Chỗ nào chưa rõ, gõ vào đây…"><button class="btn sm" id="dt-askb">Gửi câu hỏi</button></div></section>`;
  const toc=dtToc(d.body);
  m.innerHTML=DT_CSS+`<div class="acts" style="margin-bottom:10px">${back}${d.can_edit?` <button class="btn sm" id="dt-edit">✎ Sửa tài liệu</button>`:""}</div>
  <div class="${toc?"dt-read":""}">${toc?`<nav class="card dt-toc"><b class="hint">MỤC LỤC</b>${toc}</nav>`:""}
  <article class="card"><div class="dt-chips" style="margin-bottom:8px">${pill(DT_NHOM[d.nhom]+(d.nhom==="team"?": "+dtTeams(d):""),"vio")}${d.bat_buoc!=="khong"?pill(DT_BB[d.bat_buoc],"red"):""}${d.lo_trinh?pill("Lộ trình "+DT_LT[d.lo_trinh],"blu"):""}${pill("Bản "+d.version+" · sửa "+dtDay(d.updated_at),"gry")}</div>
   <div class="dt-doc"><h1 style="font-size:24px;margin:0 0 6px">${esc(d.title)}</h1>${d.summary?`<p class="hint" style="font-size:14.5px">${esc(d.summary)}</p>`:""}${dtMd(d.body)}</div>
   ${quiz}${ackBox}${d.status==="dang"?hoi:""}</article></div>`;
  m.querySelector("#dt-back").onclick=()=>{DT.cur=null;renderMain();scrollTo(0,0)};
  const ed=m.querySelector("#dt-edit");if(ed)ed.onclick=()=>dtEditOpen(d);
  m.querySelectorAll(".dt-toc a").forEach(a=>a.onclick=e=>{e.preventDefault();const t=m.querySelector(a.getAttribute("href"));if(t)t.scrollIntoView({behavior:"smooth",block:"start"})});
  m.querySelectorAll("[data-dtq]").forEach(r=>r.onchange=()=>{A[+r.dataset.dtq]=+r.value});
  const ap=m.querySelector("#dt-appr");if(ap)ap.onclick=async()=>{if(!confirm("Duyệt và cho mọi người thấy tài liệu \""+d.title+"\"?"))return;try{await svApi(DT_API+"/docs/"+id+"/approve",{method:"POST",body:"{}"});toast("Đã duyệt");delete DT.doc[id];await dtLoad(true);dtOpen(id)}catch(e){toast(e.message)}};
  const ak=m.querySelector("#dt-ack");if(ak)ak.onclick=async()=>{
    if(d.quiz&&d.quiz.length&&d.quiz.some((q,i)=>A[i]==null)){m.querySelector("#dt-ackm").textContent="Trả lời hết câu kiểm tra ở trên trước nhé.";return}
    ak.disabled=true;try{const r=await svApi(DT_API+"/docs/"+id+"/ack",{method:"POST",body:JSON.stringify({answers:A})});
      if(!r.pass){m.querySelector("#dt-ackm").textContent=`Đúng ${r.right}/${r.total} câu, chưa đạt. Đọc lại phần trên rồi thử lại nhé.`;ak.disabled=false;return}
      toast("Đã xác nhận");delete DT.ans[id];await dtLoad(true);dtOpen(id)}catch(e){m.querySelector("#dt-ackm").textContent=e.message;ak.disabled=false}};
  const ab=m.querySelector("#dt-askb");if(ab)ab.onclick=async()=>{const t=m.querySelector("#dt-ask").value.trim();if(t.length<3){toast("Gõ câu hỏi giúp em");return}
    try{await svApi(DT_API+"/docs/"+id+"/hoi",{method:"POST",body:JSON.stringify({text:t})});toast("Đã gửi câu hỏi cho người soạn");dtOpen(id)}catch(e){toast(e.message)}};
  m.querySelectorAll("[data-dthoi]").forEach(b=>b.onclick=async()=>{const v=m.querySelector(`[data-dthoi-in="${b.dataset.dthoi}"]`).value.trim();if(!v)return;
    try{await svApi(DT_API+"/hoi/"+b.dataset.dthoi+"/tra-loi",{method:"POST",body:JSON.stringify({answer:v})});toast("Đã trả lời");dtOpen(id)}catch(e){toast(e.message)}})}

/* ---------- Soạn tài liệu ---------- */
function dtScopes(){const me=DT.me||{};if(me.ceo||me.hr)return {chung:1,web:1,teams:null};
  const t=(me.scopes||[]).filter(s=>s.startsWith("team:")).map(s=>s.slice(5));if(me.manager&&me.pb)t.push(me.pb);
  return {chung:(me.scopes||[]).includes("chung"),web:(me.scopes||[]).includes("web"),teams:[...new Set(t)]}}
async function dtEditOpen(d){
  if(d&&d.id&&d.body==null){try{d=await svApi(DT_API+"/docs/"+d.id)}catch(e){toast(e.message);return}}
  const S=dtScopes();
  DT.edit=d?{...d,quizText:dtQuizText(d.quiz),major:false}:{id:null,nhom:S.chung?"chung":S.web?"web":"team",teams:S.teams&&S.teams.length===1?[S.teams[0]]:[],title:"",summary:"",body:"",bat_buoc:"moi",lo_trinh:"w1",han_ngay:7,sort:100,quizText:"",major:false};
  DT.cur=null;PAGE="dt_soan";MOD="dt";render();scrollTo(0,0)}
function pDtSoan(m){
  if(!DT.docs)return dtWait(m,"Soạn tài liệu");dtLoad();
  const me=DT.me||{};if(!me.editor){m.innerHTML=H("Soạn tài liệu","")+`<p class="empty">Bạn chưa được giao quyền soạn tài liệu.</p>`;return}
  if(DT.edit)return dtEditor(m);
  const mine=(DT.docs||[]).filter(d=>d.can_edit),st=d=>d.status==="dang"?pill("Đang hiện","grn"):d.status==="cho_duyet"?pill("Chờ CEO duyệt","amb"):pill("Nháp","gry");
  m.innerHTML=DT_CSS+H("Soạn tài liệu",me.ceo?"Chị soạn và duyệt được mọi tài liệu":me.hr?"Bạn soạn được tài liệu Chung (cần CEO duyệt), Sổ tay web và tài liệu các team":"Bạn soạn được tài liệu của team mình")+
  `<div class="filters"><button class="btn pri" id="dt-new">＋ Tài liệu mới</button></div>
  <section class="card flush">${tbl(["Tài liệu","Nhóm","Bắt buộc","Lộ trình","Trạng thái","Sửa lần cuối",""],mine.map(d=>`<tr><td><b>${esc(d.title)}</b>${d.quiz_n?`<small>${d.quiz_n} câu kiểm tra</small>`:""}</td><td>${esc(d.nhom==="team"?dtTeams(d):DT_NHOM[d.nhom])}</td><td>${esc(DT_BB[d.bat_buoc])}</td><td>${esc(DT_LT[d.lo_trinh]||"—")}</td><td>${st(d)}</td><td class="nowrap">${dtDay(d.updated_at)} · bản ${d.version}</td>
    <td class="nowrap"><button class="btn sm" data-dtopen="${esc(d.id)}">Xem</button> <button class="btn sm" data-dted="${esc(d.id)}">Sửa</button> <button class="btn sm danger" data-dtdel="${esc(d.id)}">Gỡ</button></td></tr>`))}</section>
  <p class="hint">Tài liệu Chung (nội quy, quy chế) do người khác soạn phải chị Hoa duyệt mới hiện. Sổ tay web và tài liệu team đăng là hiện ngay.</p>`;
  m.querySelector("#dt-new").onclick=()=>dtEditOpen(null);
  m.querySelectorAll("[data-dted]").forEach(b=>b.onclick=()=>dtEditOpen(DT.docs.find(x=>x.id===b.dataset.dted)));
  m.querySelectorAll("[data-dtdel]").forEach(b=>b.onclick=async()=>{const d=DT.docs.find(x=>x.id===b.dataset.dtdel);if(!confirm("Gỡ tài liệu \""+d.title+"\"? Mọi người sẽ không thấy nữa."))return;
    try{await svApi(DT_API+"/docs/"+d.id,{method:"DELETE"});toast("Đã gỡ");dtLoad(true)}catch(e){toast(e.message)}});dtWire(m)}
function dtEditor(m){
  const e=DT.edit,S=dtScopes(),deps=(DT.me&&DT.me.deps)||[],teamOk=S.teams===null?deps:deps.filter(x=>S.teams.includes(x.k));
  const nh=[["chung","Chung — mọi nhân viên",S.chung],["web","Sổ tay web vận hành",S.web],["team","Tài liệu team",S.teams===null||S.teams.length]].filter(x=>x[2]);
  m.innerHTML=DT_CSS+H(e.id?"Sửa tài liệu":"Tài liệu mới",e.id?"Bản "+e.version:"")+
  `<div class="grid" style="grid-template-columns:minmax(0,1fr) 300px;align-items:start">
   <section class="card dt-ed"><label class="field">Tên tài liệu<input id="dte-title" value="${esc(e.title)}" maxlength="160"></label>
    <label class="field">Một dòng giới thiệu (hiện ở thư viện)<input id="dte-sum" value="${esc(e.summary)}" maxlength="300"></label>
    <label class="field" style="margin-bottom:0">Nội dung</label>
    <div class="dt-tb">${[["# ","Tiêu đề"],["## ","Tiêu đề nhỏ"],["- ","• Gạch đầu dòng"],["1. ","1. Bước"],["> ","💡 Lưu ý"],["**","B Đậm"]].map(([k,n])=>`<button type="button" class="btn sm" data-dtins="${esc(k)}">${n}</button>`).join("")}
     <label class="btn sm" style="cursor:pointer">🖼 Chèn ảnh<input type="file" accept="image/*" id="dte-img" hidden></label><span class="sp"></span><button type="button" class="btn sm" id="dte-pv">Xem trước</button></div>
    <textarea id="dte-body" rows="22">${esc(e.body)}</textarea><div id="dte-prev" class="dt-doc card" style="box-shadow:none" hidden></div>
    <p class="hint">Gõ như viết tin nhắn. Dòng bắt đầu "# " là tiêu đề mục (hiện ở mục lục), "- " gạch đầu dòng, "1. " các bước, "> " ô lưu ý. Ảnh chụp màn hình: bấm Chèn ảnh (tối đa 1,5 MB).</p>
    <label class="field">Câu hỏi kiểm tra (không bắt buộc)<textarea id="dte-quiz" rows="6" placeholder="? Đi muộn quá 15 phút thì phải làm gì?&#10;- Không cần báo&#10;* Báo quản lý trước giờ vào làm&#10;- Báo sau khi tới công ty">${esc(e.quizText)}</textarea><small class="hint">Mỗi câu: dòng "? câu hỏi", rồi các đáp án — "*" là đáp án đúng, "-" là sai. Người đọc phải đúng 80% mới xác nhận được.</small></label>
   </section>
   <section class="card"><label class="field">Thuộc nhóm<select id="dte-nhom">${nh.map(([k,n])=>`<option value="${k}"${e.nhom===k?" selected":""}>${n}</option>`).join("")}</select></label>
    <div id="dte-teams"${e.nhom==="team"?"":" hidden"}><label class="field" style="margin-bottom:4px">Team được xem</label><div class="dt-chips">${teamOk.map(x=>`<label class="btn sm"><input type="checkbox" value="${esc(x.k)}"${(e.teams||[]).includes(x.k)?" checked":""} style="width:auto;margin-right:4px">${esc(x.n)}</label>`).join("")||'<span class="hint">Chưa có phòng ban nào</span>'}</div><small class="hint">Quản lý các team này và CEO luôn xem được.</small></div>
    <label class="field">Bắt buộc với<select id="dte-bb">${Object.entries(DT_BB).map(([k,n])=>`<option value="${k}"${e.bat_buoc===k?" selected":""}>${n}</option>`).join("")}</select></label>
    <label class="field">Đưa vào lộ trình<select id="dte-lt"><option value="">Không</option>${Object.entries(DT_LT).map(([k,n])=>`<option value="${k}"${e.lo_trinh===k?" selected":""}>${n}</option>`).join("")}</select></label>
    <label class="field">Phải đọc xong trong (ngày)<input type="number" id="dte-han" min="1" max="120" value="${+e.han_ngay||7}"><small class="hint">Nhân viên mới: tính từ ngày vào làm. Mọi người: từ ngày đăng.</small></label>
    <label class="field">Thứ tự hiện<input type="number" id="dte-sort" min="0" max="9999" value="${+e.sort||100}"><small class="hint">Số nhỏ hiện trước.</small></label>
    ${e.id&&e.status==="dang"?`<label class="field"><span><input type="checkbox" id="dte-major" style="width:auto;margin-right:6px">Sửa lớn — lên bản mới, mọi người phải đọc lại</span></label>`:""}
    <div class="acts" style="margin-top:14px;flex-wrap:wrap"><button class="btn pri" id="dte-pub">Đăng tài liệu</button><button class="btn" id="dte-draft">Lưu nháp</button><button class="btn" id="dte-x">Thôi</button></div>
    <p class="hint" id="dte-msg"></p></section></div>`;
  const $m=s=>m.querySelector(s),ta=$m("#dte-body");
  const keep=()=>{Object.assign(e,{title:$m("#dte-title").value,summary:$m("#dte-sum").value,body:ta.value,nhom:$m("#dte-nhom").value,bat_buoc:$m("#dte-bb").value,lo_trinh:$m("#dte-lt").value,
    han_ngay:+$m("#dte-han").value||7,sort:+$m("#dte-sort").value||100,quizText:$m("#dte-quiz").value,teams:[...m.querySelectorAll("#dte-teams input:checked")].map(x=>x.value),major:!!($m("#dte-major")&&$m("#dte-major").checked)})};
  const ins=(pre,post="")=>{const a=ta.selectionStart,b=ta.selectionEnd,v=ta.value;let ls=v.lastIndexOf("\n",a-1)+1;
    if(post){ta.value=v.slice(0,a)+pre+v.slice(a,b)+post+v.slice(b);ta.selectionStart=a+pre.length;ta.selectionEnd=b+pre.length}else{ta.value=v.slice(0,ls)+pre+v.slice(ls);ta.selectionStart=ta.selectionEnd=b+pre.length}ta.focus()};
  m.querySelectorAll("[data-dtins]").forEach(b=>b.onclick=()=>{const k=b.dataset.dtins;k==="**"?ins("**","**"):ins(k)});
  $m("#dte-nhom").onchange=()=>{$m("#dte-teams").hidden=$m("#dte-nhom").value!=="team"};
  $m("#dte-pv").onclick=()=>{const p=$m("#dte-prev"),on=p.hidden;p.hidden=!on;ta.hidden=on;if(on)p.innerHTML=dtMd(ta.value)||'<p class="hint">Chưa có nội dung.</p>';$m("#dte-pv").textContent=on?"Sửa tiếp":"Xem trước"};
  $m("#dte-img").onchange=async ev=>{const f=ev.target.files[0];if(!f)return;if(f.size>1.5e6){toast("Ảnh quá 1,5 MB, thu nhỏ hoặc chụp lại giúp em");return}
    const fd=new FormData();fd.append("file",f);toast("Đang tải ảnh…");
    try{const r=await fetch(DT_API+"/img",{method:"POST",body:fd,credentials:"same-origin"}),j=await r.json();if(!r.ok)throw new Error((j.error&&j.error.message)||"Chưa tải được ảnh");
      const alt=prompt("Mô tả ngắn cho ảnh (hiện dưới ảnh):","Màn hình "+($m("#dte-title").value||""))||"";ins("\n![" + alt.replace(/[\[\]]/g,"") + "](" + j.data.id + ")\n");toast("Đã chèn ảnh")}catch(er){toast(er.message)}ev.target.value=""};
  $m("#dte-x").onclick=()=>{if(!confirm("Bỏ các thay đổi chưa lưu?"))return;DT.edit=null;renderMain()};
  const save=async action=>{keep();const q=dtQuizParse(e.quizText);if(q.err){$m("#dte-msg").textContent=q.err;return}
    if(e.title.trim().length<3){$m("#dte-msg").textContent="Ghi tên tài liệu";return}
    if(e.nhom==="team"&&!e.teams.length){$m("#dte-msg").textContent="Chọn ít nhất một team được xem";return}
    const body={nhom:e.nhom,teams:e.teams,title:e.title.trim(),summary:e.summary.trim(),body:e.body,bat_buoc:e.bat_buoc,lo_trinh:e.lo_trinh,han_ngay:e.han_ngay,sort:e.sort,quiz:q.quiz,action,major:e.major};
    m.querySelectorAll("#dte-pub,#dte-draft").forEach(b=>b.disabled=true);
    try{const r=await svApi(DT_API+"/docs"+(e.id?"/"+e.id:""),{method:e.id?"PUT":"POST",body:JSON.stringify(body)});
      toast(r.status==="cho_duyet"?"Đã gửi, chờ chị Hoa duyệt":r.status==="dang"?"Đã đăng":"Đã lưu nháp");if(r.id)delete DT.doc[r.id];DT.edit=null;await dtLoad(true)}
    catch(er){$m("#dte-msg").textContent=er.message;m.querySelectorAll("#dte-pub,#dte-draft").forEach(b=>b.disabled=false)}};
  $m("#dte-pub").onclick=()=>save("dang");$m("#dte-draft").onclick=()=>save("nhap")}

/* ---------- Theo dõi nhân viên mới ---------- */
async function dtTrackLoad(){try{DT.track=await svApi(DT_API+"/theo-doi")}catch(e){DT.track={err:e.message}}renderMain()}
function pDtTheo(m){
  if(!DT.docs)return dtWait(m,"Theo dõi nhân viên mới");
  if(!DT.track){m.innerHTML=H("Theo dõi nhân viên mới","Đang tải…");dtTrackLoad();return}
  const T=DT.track;if(T.err){m.innerHTML=H("Theo dõi nhân viên mới","")+`<div class="note red">${esc(T.err)}</div>`;return}
  const me=DT.me||{},P=T.people.slice().sort((a,b)=>(b.newbie&&!b.newbie.done_at)-(a.newbie&&!a.newbie.done_at)||b.late-a.late||a.name.localeCompare(b.name));
  const nbs=P.filter(p=>p.newbie&&!p.newbie.done_at),late=P.filter(p=>p.late);
  m.innerHTML=DT_CSS+H("Theo dõi nhân viên mới",me.ceo||me.hr?"Toàn công ty":"Người trong phòng "+esc(dtDep(me.pb)))+
  `<div class="dt-kpis"><div class="kpi"><div class="l">Đang onboarding</div><div class="v">${nbs.length}</div></div>
   <div class="kpi"><div class="l">Trễ hạn đọc</div><div class="v${late.length?" t-red":""}">${late.length}</div><div class="h">người quá hạn tài liệu bắt buộc</div></div>
   <div class="kpi"><div class="l">Câu hỏi chưa trả lời</div><div class="v">${T.hoi.length}</div></div>
   <div class="kpi"><div class="l">Người theo dõi</div><div class="v">${P.length}</div></div></div>
  <div class="filters"><button class="btn pri sm" id="dt-nb">＋ Ghi nhân viên mới</button><span class="sp"></span><button class="btn sm" id="dt-tre">Tải lại</button></div>
  <section class="card flush">${tbl(["Nhân viên","Phòng","Ngày vào · người kèm","Tiến độ bắt buộc","Còn thiếu",""],P.map(p=>{const pc=p.required?Math.round(p.done/p.required*100):100;
    return `<tr><td><b>${esc(p.name)}</b>${p.newbie&&!p.newbie.done_at?`<small>${pill("Nhân viên mới","vio")}</small>`:""}</td><td>${esc(dtDep(p.pb))}</td>
    <td>${p.newbie?`${dtDay(p.newbie.start_date)}${p.newbie.mentor_id?`<small>kèm: ${esc(p.newbie.mentor_id)}</small>`:""}${p.newbie.done_at?`<small>xong onboarding ${dtDay(p.newbie.done_at)}</small>`:""}`:'<span class="hint">—</span>'}</td>
    <td style="min-width:150px">${p.done}/${p.required}<div class="dt-bar${p.late?" red":""}"><i style="width:${pc}%"></i></div>${p.late?`<small class="t-red">trễ ${p.late}</small>`:""}</td>
    <td>${p.missing.length?p.missing.map(x=>`<span class="${x.late?"t-red":""}">${esc(x.title)}${x.old?" (bản mới)":""}</span>`).join(", "):'<span class="t-grn">Đủ</span>'}</td>
    <td class="nowrap"><button class="btn sm" data-dtnb="${esc(p.id)}">${p.newbie?"Sửa":"Đặt nhân viên mới"}</button></td></tr>`}))}</section>
  <section class="card"><div class="card-h"><h2>Ai đã xác nhận từng tài liệu</h2><span class="hint">trong những người bạn theo dõi</span></div>
   ${tbl(["Tài liệu","Đã xác nhận","Chưa xác nhận"],T.perDoc.map(d=>`<tr><td><b>${esc(d.title)}</b><small>bản ${d.version}</small></td><td class="n">${d.ok}/${d.total}</td><td>${d.notYet.length?esc(d.notYet.slice(0,12).join(", "))+(d.notYet.length>12?" … +"+(d.notYet.length-12):""):'<span class="t-grn">Đủ</span>'}</td></tr>`))}</section>
  ${T.hoi.length?`<section class="card"><h2>Câu hỏi chưa trả lời</h2>${T.hoi.map(h=>`<div class="dt-item" data-dtopen="${esc(h.doc_id)}"><div class="t"><b>${esc(h.text)}</b><small>${esc(h.name)} · ${esc(h.title)} · ${dtDay(h.created_at)}</small></div></div>`).join("")}</section>`:""}`;
  m.querySelector("#dt-tre").onclick=()=>{DT.track=null;renderMain()};
  m.querySelector("#dt-nb").onclick=()=>dtNbForm(null);
  m.querySelectorAll("[data-dtnb]").forEach(b=>b.onclick=()=>dtNbForm(b.dataset.dtnb));dtWire(m)}
function dtNbForm(uid){
  const T=DT.track,p=uid?T.people.find(x=>x.id===uid):null,nb=p&&p.newbie,opts=T.people.map(x=>`<option value="${esc(x.id)}"${x.id===uid?" selected":""}>${esc(x.name)} · ${esc(dtDep(x.pb))}</option>`).join("");
  openDrawerHTML(`<h2>Nhân viên mới</h2><p class="hint">Người được đặt là nhân viên mới sẽ thấy lộ trình và tài liệu "bắt buộc với nhân viên mới", hạn tính từ ngày vào làm.</p>
   <label class="field">Nhân viên<select id="nb-u"${uid?" disabled":""}>${opts}</select></label>
   <label class="field">Ngày vào làm<input type="date" id="nb-d" value="${esc(nb?nb.start_date:new Date(Date.now()+7*3600e3).toISOString().slice(0,10))}"></label>
   <label class="field">Người kèm<input id="nb-m" value="${esc(nb?nb.mentor_id:"")}" placeholder="Tên người kèm"></label>
   ${nb?`<label class="field"><span><input type="checkbox" id="nb-x" style="width:auto;margin-right:6px"${nb.done_at?" checked":""}>Đã xong onboarding (thôi tính là nhân viên mới)</span></label>`:""}
   <div class="acts" style="margin-top:12px"><button class="btn pri" id="nb-ok">Lưu</button>${nb?`<button class="btn danger" id="nb-del">Bỏ khỏi danh sách nhân viên mới</button>`:""}<span class="hint" id="nb-msg"></span></div>`);
  const put=async b=>{const u=uid||$("#nb-u").value;try{await svApi(DT_API+"/newbie/"+encodeURIComponent(u),{method:"PUT",body:JSON.stringify(b)});closeDrawer();toast("Đã lưu");DT.track=null;renderMain()}catch(e){$("#nb-msg").textContent=e.message}};
  $("#nb-ok").onclick=()=>put({start_date:$("#nb-d").value,mentor_id:$("#nb-m").value.trim(),done:!!($("#nb-x")&&$("#nb-x").checked)});
  const del=$("#nb-del");if(del)del.onclick=()=>{if(confirm("Bỏ người này khỏi danh sách nhân viên mới?"))put({remove:true})}}

/* ---------- Ai xem được gì ---------- */
async function dtEdsLoad(){try{DT.eds=await svApi(DT_API+"/editors")}catch(e){DT.eds={err:e.message}}renderMain()}
function pDtQuyen(m){
  if(!DT.docs)return dtWait(m,"Ai xem được gì");
  if(!DT.eds){m.innerHTML=H("Ai xem được gì","Đang tải…");dtEdsLoad();return}
  const E=DT.eds,me=DT.me||{};if(E.err){m.innerHTML=H("Ai xem được gì","")+`<div class="note red">${esc(E.err)}</div>`;return}
  const sc=s=>s==="chung"?"Chung":s==="web"?"Sổ tay web":"Team "+dtDep(s.slice(5));
  const auto=E.auto.map(u=>`<tr><td><b>${esc(u.name)}</b></td><td>${esc(dtDep(u.pb)||"—")}</td><td>${u.role==="admin"?pill("Tất cả + duyệt tài liệu Chung","vio"):u.hr?pill("Chung (chờ CEO duyệt)","vio")+" "+pill("Sổ tay web","vio")+" "+pill("Mọi team","vio"):pill("Tài liệu team "+dtDep(u.pb),"vio")}</td><td class="hint">tự có theo vai trò</td></tr>`);
  const gr=E.granted.map(g=>`<tr><td><b>${esc(g.name||g.user_id)}</b></td><td></td><td>${g.scopes.map(s=>pill(sc(s),"blu")).join(" ")}</td><td>${me.ceo?`<button class="btn sm" data-dtgr="${esc(g.user_id)}">Sửa</button>`:'<span class="hint">CEO giao</span>'}</td></tr>`);
  m.innerHTML=DT_CSS+H("Ai xem được gì","Dùng phòng ban và vai trò đang có ở Nhân sự / Tài khoản & phân quyền — không phải tạo tài khoản mới")+
  `<section class="card"><h2>Quy tắc xem</h2>${tbl(["Nhóm tài liệu","Nhân viên team đó","Nhân viên team khác","Quản lý team đó","CEO · nhân sự"],[
    `<tr><td><b>Chung</b> (nội quy, quy chế)</td><td class="t-grn">Xem</td><td class="t-grn">Xem</td><td class="t-grn">Xem</td><td class="t-grn">Xem</td></tr>`,
    `<tr><td><b>Sổ tay web vận hành</b></td><td class="t-grn">Xem</td><td class="t-grn">Xem</td><td class="t-grn">Xem</td><td class="t-grn">Xem</td></tr>`,
    `<tr><td><b>Tài liệu team</b></td><td class="t-grn">Xem</td><td class="hint">Không thấy</td><td class="t-grn">Xem, soạn, theo dõi ai đã đọc</td><td class="t-grn">Xem tất cả</td></tr>`])}
   <p class="hint">Quản lý = tài khoản vai trò Trưởng phòng / Trưởng nhóm có ghi phòng ban. Phòng ban của từng người sửa ở Tài khoản & phân quyền; web cập nhật khi chị Hoa hoặc người làm nhân sự lưu.</p></section>
  <section class="card"><div class="card-h"><h2>Người được soạn / sửa</h2>${me.ceo?`<span class="sp"></span><button class="btn pri sm" id="dt-grn">＋ Giao quyền soạn cho người khác</button>`:""}</div>
   ${tbl(["Người","Phòng","Được soạn",""],auto.concat(gr))}
   <p class="hint">Tài liệu Chung do người không phải CEO soạn hoặc sửa phải chị Hoa bấm duyệt mới hiện cho mọi người.</p></section>`;
  const nb=m.querySelector("#dt-grn");if(nb)nb.onclick=()=>dtGrantForm(null);
  m.querySelectorAll("[data-dtgr]").forEach(b=>b.onclick=()=>dtGrantForm(b.dataset.dtgr))}
function dtGrantForm(uid){
  const E=DT.eds,g=uid?E.granted.find(x=>x.user_id===uid):null,cur=new Set(g?g.scopes:[]),deps=(DT.me&&DT.me.deps)||[];
  const ck=(v,n)=>`<label class="btn sm"><input type="checkbox" value="${esc(v)}"${cur.has(v)?" checked":""} style="width:auto;margin-right:4px">${esc(n)}</label>`;
  openDrawerHTML(`<h2>Giao quyền soạn tài liệu</h2>
   <label class="field">Người<select id="gr-u"${uid?" disabled":""}>${E.users.map(u=>`<option value="${esc(u.id)}"${u.id===uid?" selected":""}>${esc(u.name)} · ${esc(dtDep(u.pb))}</option>`).join("")}</select></label>
   <label class="field" style="margin-bottom:4px">Được soạn</label><div class="dt-chips" id="gr-s">${ck("chung","Chung (chờ CEO duyệt)")}${ck("web","Sổ tay web")}${deps.map(d=>ck("team:"+d.k,"Team "+d.n)).join("")}</div>
   <p class="hint">Bỏ hết ô là thu lại quyền. Người được soạn tài liệu team nào thì cũng xem được tài liệu team đó.</p>
   <div class="acts" style="margin-top:12px"><button class="btn pri" id="gr-ok">Lưu</button><span class="hint" id="gr-msg"></span></div>`);
  $("#gr-ok").onclick=async()=>{const u=uid||$("#gr-u").value,scopes=[...document.querySelectorAll("#gr-s input:checked")].map(x=>x.value);
    try{await svApi(DT_API+"/editors/"+encodeURIComponent(u),{method:"PUT",body:JSON.stringify({scopes})});closeDrawer();toast("Đã lưu");DT.eds=null;renderMain()}catch(e){$("#gr-msg").textContent=e.message}}}

PAGES.dt_home=pDtHome;PAGES.dt_lib=pDtLib;PAGES.dt_soan=pDtSoan;PAGES.dt_theo=pDtTheo;PAGES.dt_quyen=pDtQuyen;
NAV_SUB.push(["dt",()=>DT.cur,v=>{DT.cur=v||null}]);
/* Mục "Đào tạo" ở web vận hành (menubang.js xếp sau Nhân sự). Mục quản lý chỉ hiện khi máy chủ báo có quyền. */
if(typeof ICONS!=="undefined"&&!ICONS.book)ICONS.book='<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7M8 11h5"/>';
{const dtCnt=()=>{if(!DT.docs)return "";const n=dtPub().filter(d=>dtReq(d)&&!dtDone(d)).length;return n||""};
 const meOk=k=>()=>!!(DT.me&&DT.me[k]);
 MODULES.push({k:"dt",ic:"book",n:"Đào tạo",zone:"",sub:"",groups:()=>[["",[MI("dt_home","Đào tạo của tôi",null,dtCnt),MI("dt_lib","Thư viện tài liệu")]],
   ["Dành cho quản lý",[MI("dt_theo","Theo dõi nhân viên mới",meOk("tracker")),MI("dt_soan","Soạn tài liệu",meOk("editor")),MI("dt_quyen","Ai xem được gì",()=>!!(DT.me&&(DT.me.ceo||DT.me.hr)))]]]})}
{const _r=render;render=function(){const r=_r.apply(this,arguments);try{if(ME&&!(typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin")&&!DT.at&&!DT.busy)dtLoad().then(()=>{if(DT.me&&(DT.me.tracker||DT.me.editor))render()})}catch(e){}return r}}
