/* =====================================================================
   TIN NHẮN KIỂU LARK (chị Hoa 02/11/2026) — trang "tinnhan", mở từ nút 💬 trên thanh trên cùng
   - Bên trái: nhóm Chung + nhóm từng phòng + nhắn riêng, có tin cuối, giờ, số chưa đọc; ô tìm để mở nhóm / nhắn riêng với ai đó.
   - Bên phải: tin nhắn dạng bong bóng, chia theo ngày; gõ @ để gọi tên.
   - Giao việc ngay trong chat: mở khung Giao việc điền sẵn, giao xong thì hiện thẻ việc trong cuộc trò chuyện (bấm mở được).
   - Nhắc việc: nhắc mình hoặc nhắc người khác theo giờ; đến giờ hiện thông báo góc dưới (thongbao.js ntPush).
   - Dữ liệu ở máy chủ /api/hub/chat (src/server/routes/chat.ts): tin nhắn riêng chỉ hai người đọc được, không nằm trong dữ liệu chung.
   - Tin cũ của khung trao đổi trước (d.chat trong dữ liệu chung) vẫn xem được ở đầu nhóm / cuộc nhắn riêng tương ứng.
   ===================================================================== */
const TN={room:"",rooms:[],msgs:{},more:{},q:"",draft:{},seen:{},sumAt:0,loading:false,mob:false};
/* máy chủ dùng mã đăng nhập (u.crm), trang dùng mã người trong dữ liệu chung (u.id): phòng, người gửi, người được nhắc đều theo mã đăng nhập */
const tnMe=()=>(typeof SV!=="undefined"&&SV.me&&SV.me.id)||ME.crm||ME.id;
const tnU=id=>id?D().users.find(x=>x.crm===id)||D().users.find(x=>x.id===id):null;
const tnUN=id=>(tnU(id)||{}).name||"";
const tnGroups=()=>[["chung","Chung toàn công ty"]].concat(Object.entries(TEAMS).filter(([k])=>k!=="chung"));
const tnMyTeam=()=>{const t=ME.phongBan&&typeof KG_TEAM!=="undefined"&&KG_TEAM[ME.phongBan]?KG_TEAM[ME.phongBan]:String(teamOf(ME)||"").toLowerCase();return TEAMS[t]&&t!=="chung"?t:""};
const tnDm=id=>"dm:"+[tnMe(),id].sort().join("~");
const tnOther=r=>r.startsWith("dm:")?r.slice(3).split("~").find(x=>x!==tnMe())||tnMe():"";
const tnName=r=>r.startsWith("g:")?(r==="g:chung"?"Chung toàn công ty":TEAMS[r.slice(2)]||r.slice(2)):tnUN(tnOther(r))||"Nhắn riêng";
const tnTime=t=>{const d=new Date(t),n=new Date();return d.toDateString()===n.toDateString()?d.toTimeString().slice(0,5):d.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"})};
const tnDay=t=>{const d=new Date(t),n=new Date(),y=new Date(n-864e5);return d.toDateString()===n.toDateString()?"Hôm nay":d.toDateString()===y.toDateString()?"Hôm qua":d.toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit"})};
const tnInit=n=>{const w=String(n||"?").trim().split(/\s+/);return (w.length>1?w[w.length-2][0]+w[w.length-1][0]:w[0].slice(0,2)).toUpperCase()};
const tnAv=(id,name,grp)=>{const c=avC(id);return `<i class="tnav${grp?" g":""}" style="background:${c[0]};color:${c[1]}">${grp?"#":esc(tnInit(name))}</i>`};
const tnPeople=()=>D().users.filter(u=>u.active&&u.name&&u.crm&&u.crm!==tnMe());
const tnTotal=()=>TN.rooms.reduce((a,r)=>a+(r.room===TN.room&&PAGE==="tinnhan"?0:r.unread||0),0);
const tnLink=t=>esc(t).replace(/https?:\/\/[^\s<]+/g,m=>`<a href="${m}" target="_blank" rel="noopener">${m.length>56?m.slice(0,56)+"…":m}</a>`)
  .replace(/@([\p{L}\d][\p{L}\d ]{0,30}?)(?=[\s,.!?:]|$)/gu,(m,n)=>tnPeople().concat([ME]).some(u=>u.name.toLowerCase()===n.toLowerCase())?`<b class="tnat">${m}</b>`:m).replace(/\n/g,"<br>");
const tnMentionsMe=b=>!!ME&&new RegExp("@"+ME.name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(?![\\p{L}\\d])","iu").test(b||"");
/* tin của khung trao đổi cũ (dữ liệu chung) */
const tnOld=r=>{let k=r.startsWith("g:")?r.slice(2):"";if(r.startsWith("dm:")){const o=tnU(tnOther(r));if(!o)return [];k="dm:"+[ME.id,o.id].sort().join("~")}
  return ((D().chat||{})[k]||[]).slice(-80).map(m=>({id:0,old:true,user_id:(tnU(m.by)||{}).crm||m.by,body:m.text,kind:"",created_at:m.t}))};

/* ---------- máy chủ ---------- */
async function tnSummary(){if(!ME||typeof svApi!=="function")return;
  try{const r=await svApi("/api/hub/chat/summary");const old=new Map(TN.rooms.map(x=>[x.room,x.last&&x.last.id]));TN.rooms=r.rooms||[];
    if(TN.sumAt)TN.rooms.forEach(x=>{if(!x.last||x.last.user_id===tnMe()||!x.unread||old.get(x.room)===x.last.id)return;if(TN.room===x.room&&PAGE==="tinnhan"&&!document.hidden)return;
      const dm=x.room.startsWith("dm:");if(!dm&&!tnMentionsMe(x.last.body))return;
      ntPush({key:"tn:"+x.last.id,type:"tin",text:(dm?"":"Gọi bạn trong nhóm "+tnName(x.room)+": ")+(x.last.kind==="task"?"📋 Giao việc: ":"")+x.last.body,by:tnUN(x.last.user_id),at:x.last.created_at,go:()=>openChat(x.room)})});
    TN.sumAt=Date.now();bellBadge();if(PAGE==="tinnhan")tnDrawList()}catch(e){}}
async function tnLoad(room,older){const L=TN.msgs[room]||[];
  try{if(older){const r=await svApi(`/api/hub/chat/msgs?room=${encodeURIComponent(room)}&before=${L[0]?L[0].id:0}`);TN.more[room]=r.length>=60;TN.msgs[room]=r.concat(L)}
    else if(L.length){const r=await svApi(`/api/hub/chat/msgs?room=${encodeURIComponent(room)}&after=${L[L.length-1].id}`);if(!r.length)return false;TN.msgs[room]=L.concat(r)}
    else{const r=await svApi(`/api/hub/chat/msgs?room=${encodeURIComponent(room)}`);TN.more[room]=r.length>=60;TN.msgs[room]=r}
    return true}catch(e){if(!older&&!L.length)TN.msgs[room]=[];return false}}
async function tnRead(room){const L=TN.msgs[room]||[],last=L.length?L[L.length-1].id:0,x=TN.rooms.find(r=>r.room===room);
  if(!last||TN.seen[room]===last)return;TN.seen[room]=last;if(x)x.unread=0;bellBadge();
  try{await svApi("/api/hub/chat/read",{method:"POST",body:JSON.stringify({room,last_id:last})})}catch(e){}}
async function tnSend(room,body,kind,ref){
  const m=await svApi("/api/hub/chat/msgs",{method:"POST",body:JSON.stringify({room,body,kind:kind||"",ref:ref||""})});
  (TN.msgs[room]=TN.msgs[room]||[]).push(m);TN.seen[room]=m.id;
  const x=TN.rooms.find(r=>r.room===room);if(x)x.last=m;else TN.rooms.push({room,last:m,unread:0});return m}

/* ---------- vẽ ---------- */
function tnListRows(){const q=TN.q.trim().toLowerCase(),by=new Map(TN.rooms.map(r=>[r.room,r]));
  if(q){const G=tnGroups().filter(([k,n])=>n.toLowerCase().includes(q)).map(([k])=>"g:"+k),P=tnPeople().filter(u=>u.name.toLowerCase().includes(q)).map(u=>tnDm(u.crm));return G.concat(P).map(r=>by.get(r)||{room:r,last:null,unread:0})}
  const base=["g:chung"].concat(tnMyTeam()?["g:"+tnMyTeam()]:[]),R=TN.rooms.slice();base.forEach(r=>{if(!by.has(r))R.push({room:r,last:null,unread:0})});
  return R.filter(r=>r.room.startsWith("dm:")||TEAMS[r.room.slice(2)]).sort((a,b)=>(b.last?b.last.id:0)-(a.last?a.last.id:0))}
function tnRowHtml(r){const g=r.room.startsWith("g:"),n=tnName(r.room),l=r.last,un=r.room===TN.room?0:r.unread;
  const pv=l?(l.kind==="task"?"📋 "+l.body:l.kind==="remind"?"⏰ "+l.body:(g&&l.user_id!==tnMe()?(tnUN(l.user_id)||"")+": ":l.user_id===tnMe()?"Bạn: ":"")+l.body):g?"Nhóm phòng · chưa có tin":"Bắt đầu nhắn riêng";
  return `<button class="tnrow${r.room===TN.room?" on":""}${un?" un":""}" data-tnr="${esc(r.room)}">${tnAv(g?r.room:tnOther(r.room),n,g)}<span class="tnrb"><span class="tnr1"><b>${esc(n)}</b>${l?`<small>${tnTime(l.created_at)}</small>`:""}</span><span class="tnr2"><span>${esc(String(pv).replace(/\s+/g," ").slice(0,70))}</span>${un?`<em>${un>99?"99+":un}</em>`:""}</span></span></button>`}
function tnDrawList(){const el=$("#tnlist");if(!el)return;const R=tnListRows();
  el.innerHTML=R.map(tnRowHtml).join("")||`<p class="hint" style="padding:14px">Không thấy nhóm hay người nào.</p>`;
  el.querySelectorAll("[data-tnr]").forEach(b=>b.onclick=()=>tnOpen(b.dataset.tnr))}
function tnTaskCard(m){const id=String(m.ref||"").replace(/^task:/,""),t=(D().tasks||[]).find(x=>x.id===id);
  if(!t)return `<div class="tntask gone">📋 ${esc(m.body)} <small>(việc đã xóa)</small></div>`;
  const st=t.st||"todo",cls=st==="done"?"p-grn":st==="review"?"p-amb":"p-blu";
  return `<div class="tntask"><div class="tntk1"><b>📋 ${esc(t.ten)}</b><span class="pill ${cls}">${esc(cvStN(st))}</span></div><div class="tntk2">Người làm: <b>${esc(userName(t.nguoi)||"chưa giao")}</b>${t.han?` · hạn ${dd(t.han)}`:""}</div><button class="btn sm" data-tntask="${esc(t.id)}">Mở việc</button></div>`}
function tnMsgHtml(m,prev){const me=m.user_id===tnMe(),cont=prev&&prev.user_id===m.user_id&&new Date(m.created_at)-new Date(prev.created_at)<5*60e3&&!prev.old===!m.old;
  if(m.kind==="remind")return `<div class="tnsys">⏰ ${esc(tnUN(m.user_id)||"")} ${esc(m.body)}</div>`;
  const body=m.kind==="task"?tnTaskCard(m):`<div class="tnbub">${tnLink(m.body)}</div>`;
  return `<div class="tnm${me?" me":""}${cont?" cont":""}" data-mid="${m.id||""}">${me||cont?`<i class="tnav sp"></i>`:tnAv(m.user_id,tnUN(m.user_id))}<div class="tnmb">${cont?"":`<div class="tnmh">${me?"":`<b>${esc(tnUN(m.user_id)||"")}</b>`}<small>${new Date(m.created_at).toTimeString().slice(0,5)}</small></div>`}${body}</div>${m.old||m.kind==="task"?"":`<span class="tnma"><button title="Giao việc từ tin này" data-tnact="task">📋</button><button title="Nhắc tôi việc này" data-tnact="rem">⏰</button></span>`}</div>`}
function tnMsgsHtml(room){const old=tnOld(room),L=TN.msgs[room];
  if(!L)return `<p class="hint tnempty">Đang tải…</p>`;
  let h="",day="",prev=null;const add=m=>{const d=tnDay(m.created_at);if(d!==day){day=d;h+=`<div class="tnday"><span>${d}</span></div>`;prev=null}h+=tnMsgHtml(m,prev);prev=m};
  if(TN.more[room])h+=`<div class="tnday"><button class="lnk" id="tnmore">Xem tin cũ hơn</button></div>`;
  if(old.length&&!TN.more[room]){h+=`<div class="tnday old"><span>Tin của khung trao đổi trước</span></div>`;old.forEach(add);day=""}
  L.forEach(add);
  return h||`<div class="tnempty"><b>${room.startsWith("dm:")?"Bắt đầu cuộc trò chuyện":"Chưa có tin nhắn trong nhóm"}</b><p class="hint">Gõ @ để gọi tên · 📋 giao việc · ⏰ nhắc việc ngay tại đây.</p></div>`}
function tnDrawMsgs(keepPos){const el=$("#tnmsgs");if(!el)return;const atEnd=el.scrollHeight-el.scrollTop-el.clientHeight<80,h0=el.scrollHeight,t0=el.scrollTop;
  el.innerHTML=tnMsgsHtml(TN.room);
  if(keepPos==="top")el.scrollTop=el.scrollHeight-h0+t0;else if(atEnd||!keepPos)el.scrollTop=el.scrollHeight;
  if($("#tnmore"))$("#tnmore").onclick=async()=>{await tnLoad(TN.room,true);tnDrawMsgs("top")};
  el.querySelectorAll("[data-tntask]").forEach(b=>b.onclick=()=>openTask(b.dataset.tntask));
  el.querySelectorAll("[data-tnact]").forEach(b=>b.onclick=()=>{const mid=+b.closest("[data-mid]").dataset.mid,m=(TN.msgs[TN.room]||[]).find(x=>x.id===mid);if(!m)return;
    if(b.dataset.tnact==="task")tnGiao(m.body);else tnRemind(m.body,tnMe())})}
async function tnOpen(room){TN.room=room;TN.mob=true;try{localStorage.setItem("tn_room_"+tnMe(),room)}catch(e){}
  if(PAGE!=="tinnhan"){ntPage("tinnhan");return}
  renderMain();if(!TN.msgs[room]){await tnLoad(room);if(TN.room===room){tnDrawMsgs();tnRead(room)}}else{tnRead(room);if(await tnLoad(room)&&TN.room===room){tnDrawMsgs(true);tnRead(room)}}}

/* ---------- trang ---------- */
PAGES.tinnhan=m=>{
  if(!TN.room){let r="";try{r=localStorage.getItem("tn_room_"+tnMe())||""}catch(e){}TN.room=r&&(r.startsWith("g:")||r.includes(tnMe()))?r:"g:chung"}
  const room=TN.room,g=room.startsWith("g:"),n=tnName(room),dm=!g&&tnOther(room);
  m.innerHTML=`<div class="tn${TN.mob?" open":""}">
   <aside class="tnside"><div class="tnsh"><b>Tin nhắn</b><button class="btn sm" id="tnrem" title="Nhắc việc sắp tới">⏰ Nhắc việc</button></div>
    <input class="tnq" id="tnq" placeholder="Tìm nhóm phòng hoặc người để nhắn…" value="${esc(TN.q)}"><div class="tnlist" id="tnlist"></div></aside>
   <section class="tnmain"><header class="tnhd"><button class="tnback" id="tnback" aria-label="Quay lại">‹</button>${tnAv(g?room:dm,n,g)}<div class="tnhn"><b>${esc(n)}</b><small>${g?(room==="g:chung"?"Mọi người trong công ty":"Nhóm phòng · ai trong công ty cũng xem được"):"🔒 Nhắn riêng · chỉ hai người thấy"}</small></div>
     <span class="tnhb"><button class="btn sm" id="tngiao">📋 Giao việc</button><button class="btn sm" id="tnnhac">⏰ Nhắc</button></span></header>
    <div class="tnmsgs" id="tnmsgs"></div>
    <form class="tnf" id="tnf"><div class="tnsug" id="tnsug" hidden></div><textarea id="tnin" rows="1" placeholder="Nhắn ${g?"cho nhóm "+esc(n):"riêng cho "+esc(n)}… (Enter gửi, Shift+Enter xuống dòng, @ gọi tên)">${esc(TN.draft[room]||"")}</textarea><button class="btn pri" id="tnsend">Gửi</button></form></section></div>`;
  tnDrawList();tnDrawMsgs();
  if(!TN.msgs[room])tnLoad(room).then(()=>{if(TN.room===room&&PAGE==="tinnhan"){tnDrawMsgs();tnRead(room)}});else tnRead(room);
  if(!TN.sumAt)tnSummary();
  const q=$("#tnq");q.oninput=()=>{TN.q=q.value;tnDrawList()};
  $("#tnback").onclick=()=>{TN.mob=false;$(".tn").classList.remove("open")};
  $("#tngiao").onclick=()=>tnGiao("");$("#tnnhac").onclick=()=>tnRemind("",dm||tnMe());$("#tnrem").onclick=()=>tnRemind("",tnMe());
  const inp=$("#tnin"),sug=$("#tnsug"),fit=()=>{inp.style.height="auto";inp.style.height=Math.min(inp.scrollHeight,140)+"px"};fit();
  const send=async()=>{const v=inp.value.trim();if(!v)return;inp.value="";TN.draft[room]="";fit();sug.hidden=true;
    try{await tnSend(room,v);tnDrawMsgs();tnDrawList()}catch(e){inp.value=v;TN.draft[room]=v;toast(e.message||"Chưa gửi được")}};
  const atQ=()=>{const s=inp.value.slice(0,inp.selectionStart),mm=s.match(/@([\p{L}\d ]{0,20})$/u);return mm?mm[1]:null};
  const drawSug=()=>{const a=atQ();if(a===null){sug.hidden=true;return}const L=tnPeople().filter(u=>u.name.toLowerCase().includes(a.toLowerCase())).slice(0,6);
    if(!L.length){sug.hidden=true;return}sug.hidden=false;sug.innerHTML=L.map(u=>`<button type="button" data-at="${esc(u.name)}">${tnAv(u.crm,u.name)}${esc(u.name)}<small>${esc(TEAMS[teamOf(u)]||"")}</small></button>`).join("");
    sug.querySelectorAll("[data-at]").forEach(b=>b.onmousedown=e=>{e.preventDefault();const p=inp.selectionStart,s=inp.value.slice(0,p).replace(/@([\p{L}\d ]{0,20})$/u,"@"+b.dataset.at+" ");inp.value=s+inp.value.slice(p);inp.setSelectionRange(s.length,s.length);TN.draft[room]=inp.value;sug.hidden=true;inp.focus()})};
  inp.oninput=()=>{TN.draft[room]=inp.value;fit();drawSug()};
  inp.onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();const b=sug.hidden?null:sug.querySelector("[data-at]");if(b)b.onmousedown(e);else send()}else if(e.key==="Escape")sug.hidden=true};
  inp.onblur=()=>setTimeout(()=>sug.hidden=true,150);
  $("#tnf").onsubmit=e=>{e.preventDefault();send()};
  if(matchMedia("(min-width:761px)").matches)setTimeout(()=>{if(document.activeElement===document.body||!document.activeElement)inp.focus()},0);
};

/* ---------- giao việc trong chat ---------- */
function tnGiao(text){const room=TN.room;openTask(null);
  const t=String(text||"").trim(),f=(s,v)=>{const e=$(s);if(e&&v&&!e.disabled&&[...(e.options||[{value:v}])].some(o=>o.value===v))e.value=v};
  if(t&&$("#t-ten")){$("#t-ten").value=t.split("\n")[0].slice(0,120);if($("#t-mo")&&(t.length>120||t.includes("\n")))$("#t-mo").value=t}
  if(room.startsWith("dm:"))f("#t-ng",(tnU(tnOther(room))||{}).id);else f("#t-team",room.slice(2));
  TK_AFTER_NEW=id=>{const x=(D().tasks||[]).find(y=>y.id===id);if(!x)return;tnSend(room,x.ten,"task","task:"+id).then(()=>{if(PAGE==="tinnhan"&&TN.room===room){tnDrawMsgs();tnDrawList()}}).catch(e=>toast(e.message||"Chưa gửi được thẻ việc vào tin nhắn"))}}

/* ---------- nhắc việc ---------- */
const tnLocal=d=>{const z=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`};
const tnAt=d=>new Date(d).toLocaleString("vi-VN",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"});
async function tnRemind(text,who){const room=TN.room,now=new Date(),at=(h,m,add)=>{const d=new Date();d.setDate(d.getDate()+(add||0));d.setHours(h,m||0,0,0);return d};
  const Q=[["30 phút",new Date(+now+30*60e3)],["1 giờ",new Date(+now+60*60e3)],["16h chiều nay",at(16)],["8h sáng mai",at(8,0,1)],["8h thứ Hai",at(8,0,((8-now.getDay())%7)||7)]].filter(([,d])=>d>now);
  openDrawerHTML(`<h2>⏰ Nhắc việc</h2><form class="frm" id="tnrf"><label class="field">Nhắc ai<select id="tnr-who">${opt([[tnMe(),"Tôi"]].concat(tnPeople().map(u=>[u.crm,u.name])),who||tnMe())}</select></label>
   <label class="field">Việc gì<textarea id="tnr-tx" rows="2" required placeholder="Ví dụ: gửi bản dựng video tinh dầu cho Lead Content duyệt">${esc(text||"")}</textarea></label>
   <div class="field">Khi nào<div class="tnrq">${Q.map(([l,d],i)=>`<button type="button" class="chip" data-tq="${i}">${l}</button>`).join("")}</div><input type="datetime-local" id="tnr-at" required value="${tnLocal(Q[0]?Q[0][1]:new Date(+now+30*60e3))}"></div>
   <p class="hint">Đến giờ, người được nhắc thấy thông báo ở góc dưới màn hình (đang mở web).${room?" Nhắc người khác thì cuộc trò chuyện này có một dòng ghi lại.":""}</p>
   <div class="acts"><button class="btn pri">Đặt nhắc</button></div></form><h3 style="margin-top:18px">Nhắc sắp tới</h3><div id="tnr-list"><p class="hint">Đang tải…</p></div>`);
  $("#drawerIn").querySelectorAll("[data-tq]").forEach(b=>b.onclick=()=>{$("#tnr-at").value=tnLocal(Q[+b.dataset.tq][1])});
  const list=async()=>{const el=$("#tnr-list");if(!el)return;let L=[];try{L=await svApi("/api/hub/chat/reminders")}catch(e){}
    el.innerHTML=L.length?L.map(r=>`<div class="tnrl"><span><b>${tnAt(r.due_at)}</b> · ${r.user_id===tnMe()?"nhắc tôi":"nhắc "+esc(tnUN(r.user_id)||"")}${r.by_id!==tnMe()?` <small>(${esc(tnUN(r.by_id)||"")} đặt)</small>`:""}<br>${esc(r.text)}</span><button class="lnk" data-tnrdel="${r.id}">Bỏ</button></div>`).join(""):`<p class="hint">Chưa có nhắc nào.</p>`;
    el.querySelectorAll("[data-tnrdel]").forEach(b=>b.onclick=async()=>{try{await svApi("/api/hub/chat/reminders/"+b.dataset.tnrdel,{method:"DELETE"});list()}catch(e){toast(e.message||"Chưa bỏ được")}})};list();
  $("#tnrf").onsubmit=async e=>{e.preventDefault();const u=$("#tnr-who").value,tx=$("#tnr-tx").value.trim(),d=new Date($("#tnr-at").value);
    if(!tx||isNaN(d)){toast("Ghi việc và chọn giờ nhắc");return}if(d<new Date(Date.now()-60e3)){toast("Giờ nhắc đã qua");return}
    try{await svApi("/api/hub/chat/reminders",{method:"POST",body:JSON.stringify({user_id:u,due_at:d.toISOString(),text:tx,room:room||undefined})});
      if(u!==tnMe()&&room&&(room.startsWith("g:")||tnOther(room)===u)){await tnSend(room,`đặt nhắc ${tnUN(u)} lúc ${tnAt(d)}: ${tx}`,"remind");if(PAGE==="tinnhan"){tnDrawMsgs();tnDrawList()}}
      toast("Đã đặt nhắc "+(u===tnMe()?"bạn":tnUN(u))+" lúc "+tnAt(d));$("#tnr-tx").value="";list()}catch(er){toast(er.message||"Chưa đặt được")}}}
async function tnDue(){if(!ME||typeof svApi!=="function")return;try{const L=await svApi("/api/hub/chat/reminders/due");
  L.forEach(r=>ntPush({key:"tnr:"+r.id,type:"giao",text:"⏰ Nhắc việc: "+r.text,by:r.by_id!==tnMe()?tnUN(r.by_id):"",at:r.due_at,go:()=>r.task_id?openTask(r.task_id):r.room?openChat(r.room):ntPage("tinnhan")}))}catch(e){}}

/* ---------- nút 💬, số chưa đọc, hỏi tin mới ---------- */
NAV_AN_MO.add("tinnhan");
openChat=function(room){if(room){room=room.startsWith("dm:")||room.startsWith("g:")?room:"g:"+room;if(room.startsWith("dm:")&&!room.includes(tnMe())){const o=room.slice(3).split("~").map(tnU).find(u=>u&&u.id!==ME.id);room=o&&o.crm?tnDm(o.crm):""}}
  if(room)TN.room=room;TN.mob=!!room;if(PAGE==="tinnhan"&&room)tnOpen(room);else ntPage("tinnhan")};
const _bbTn=bellBadge;
bellBadge=function(){_bbTn();const c=$("#chatbtn");if(!c)return;c.title="Tin nhắn";const u=tnTotal();let t=c.querySelector("b");if(u){if(!t){t=document.createElement("b");c.appendChild(t)}t.textContent=u>99?"99+":u}else if(t)t.remove()};
setInterval(()=>{if(!ME||document.hidden)return;
  if(PAGE==="tinnhan"&&TN.room&&TN.msgs[TN.room]){const r=TN.room;tnLoad(r).then(ch=>{if(ch&&TN.room===r&&PAGE==="tinnhan"){tnDrawMsgs(true);tnRead(r)}})}
  if(Date.now()-TN.sumAt>(PAGE==="tinnhan"?8e3:25e3))tnSummary()},4000);
setInterval(tnDue,45e3);setTimeout(tnDue,8e3);
