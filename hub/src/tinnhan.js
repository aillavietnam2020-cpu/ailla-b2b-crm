/* =====================================================================
   TIN NHẮN KIỂU LARK (chị Hoa 02/11/2026) — trang "tinnhan", mở từ nút 💬 trên thanh trên cùng
   - Bên trái: nhóm Chung + nhóm từng phòng + nhắn riêng, có tin cuối, giờ, số chưa đọc; ô tìm để mở nhóm / nhắn riêng với ai đó.
   - Bên phải: tin nhắn dạng bong bóng, chia theo ngày; gõ @ để gọi tên.
   - Giao việc ngay trong chat: mở khung Giao việc điền sẵn, giao xong thì hiện thẻ việc trong cuộc trò chuyện (bấm mở được).
   - Nhắc việc: nhắc mình hoặc nhắc người khác theo giờ; đến giờ hiện thông báo góc dưới (thongbao.js ntPush).
   - Dữ liệu ở máy chủ /api/hub/chat (src/server/routes/chat.ts): tin nhắn riêng chỉ hai người đọc được, không nằm trong dữ liệu chung.
   - Tin cũ của khung trao đổi trước (d.chat trong dữ liệu chung) vẫn xem được ở đầu nhóm / cuộc nhắn riêng tương ứng.
   ===================================================================== */
const TN={groups:null,pend:{},files:{},rems:null,info:null,room:"",rooms:[],msgs:{},more:{},q:"",draft:{},seen:{},sumAt:0,loading:false,mob:false};
/* máy chủ dùng mã đăng nhập (u.crm), trang dùng mã người trong dữ liệu chung (u.id): phòng, người gửi, người được nhắc đều theo mã đăng nhập */
const tnMe=()=>(typeof SV!=="undefined"&&SV.me&&SV.me.id)||ME.crm||ME.id;
const tnU=id=>id?D().users.find(x=>x.crm===id)||D().users.find(x=>x.id===id):null;
const tnUN=id=>(tnU(id)||{}).name||"";
const tnGroups=()=>[["chung","Chung toàn công ty"]].concat(Object.entries(TEAMS).filter(([k])=>k!=="chung"));
const tnMyTeam=()=>{const t=ME.phongBan&&typeof KPB_TEAM!=="undefined"&&KPB_TEAM[ME.phongBan]?KPB_TEAM[ME.phongBan]:String(teamOf(ME)||"").toLowerCase();return TEAMS[t]&&t!=="chung"?t:""};
const tnDm=id=>"dm:"+[tnMe(),id].sort().join("~");
const tnOther=r=>r.startsWith("dm:")?r.slice(3).split("~").find(x=>x!==tnMe())||tnMe():"";
const tnPrj=r=>(D().projects||[]).find(p=>"p:"+p.id===r);
/* dự án tôi được vào nhóm chat: phụ trách, thành viên, hoặc phòng tôi tham gia dự án (khớp quyền máy chủ chat.ts) */
const tnMyPrj=()=>(D().projects||[]).filter(p=>ME.role==="admin"||p.owner===ME.id||(p.tv||[]).includes(ME.id)||[p.team].concat(p.teams||[]).includes(tnMyTeam()));
const tnGrp=r=>(TN.groups||[]).find(g=>"n:"+g.id===r);
const tnBoss=()=>!!ME&&(ME.role==="admin"||ME.role==="lead"||ME.role==="truongphong");
const tnName=r=>r.startsWith("n:")?((tnGrp(r)||{}).name||"Nhóm"):r.startsWith("p:")?((tnPrj(r)||{}).ten||"Dự án "+r.slice(2)):r.startsWith("g:")?(r==="g:chung"?"Chung toàn công ty":TEAMS[r.slice(2)]||r.slice(2)):tnUN(tnOther(r))||"Nhắn riêng";
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
      /* mọi tin nhắn mới đều báo (chị Hoa 03/11), nhóm thì ghi tên nhóm, được gọi tên thì ghi rõ */
      const dm=x.room.startsWith("dm:");
      ntPush({key:"tn:"+x.last.id,type:"tin",text:(dm?"":(tnMentionsMe(x.last.body)?"Gọi bạn trong ":"")+tnName(x.room)+": ")+(x.last.kind==="task"?"📋 Giao việc: ":"")+x.last.body,by:tnUN(x.last.user_id),at:x.last.created_at,go:()=>openChat(x.room)})});
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
  if(q){const G=tnGroups().filter(([k,n])=>(k==="chung"||k===tnMyTeam()||ME.role==="admin")&&n.toLowerCase().includes(q)).map(([k])=>"g:"+k).concat((TN.groups||[]).filter(g=>g.name.toLowerCase().includes(q)).map(g=>"n:"+g.id)),P=tnPeople().filter(u=>u.name.toLowerCase().includes(q)).map(u=>tnDm(u.crm));const J=(ME.role==="admin"?(D().projects||[]):tnMyPrj()).filter(p=>p.ten.toLowerCase().includes(q)).map(p=>"p:"+p.id);return G.concat(J,P).map(r=>by.get(r)||{room:r,last:null,unread:0})}
  const base=["g:chung"].concat(tnMyTeam()?["g:"+tnMyTeam()]:[],tnMyPrj().map(p=>"p:"+p.id),(TN.groups||[]).map(g=>"n:"+g.id)),R=TN.rooms.slice();base.forEach(r=>{if(!by.has(r))R.push({room:r,last:null,unread:0})});
  return R.filter(r=>r.room.startsWith("dm:")||(r.room.startsWith("n:")?!!tnGrp(r.room):r.room.startsWith("p:")?!!tnPrj(r.room):TEAMS[r.room.slice(2)])).sort((a,b)=>(b.last?b.last.id:0)-(a.last?a.last.id:0))}
function tnRowHtml(r){const g=/^(g|p|n):/.test(r.room),n=tnName(r.room),l=r.last,un=r.room===TN.room?0:r.unread;
  const pv=l?(l.kind==="task"?"📋 "+l.body:l.kind==="remind"?"⏰ "+l.body:(g&&l.user_id!==tnMe()?(tnUN(l.user_id)||"")+": ":l.user_id===tnMe()?"Bạn: ":"")+l.body):r.room.startsWith("n:")?"Nhóm phối hợp · chưa có tin":r.room.startsWith("p:")?"Nhóm dự án · chưa có tin":g?"Nhóm phòng · chưa có tin":"Bắt đầu nhắn riêng";
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
  const body=m.kind==="task"?tnTaskCard(m):m.kind==="file"?tnFileHtml(m):`<div class="tnbub">${tnLink(m.body)}</div>${tnDriveCard(m.body)}`;
  return `<div class="tnm${me?" me":""}${cont?" cont":""}" data-mid="${m.id||""}">${me||cont?`<i class="tnav sp"></i>`:tnAv(m.user_id,tnUN(m.user_id))}<div class="tnmb">${cont?"":`<div class="tnmh">${me?"":`<b>${esc(tnUN(m.user_id)||"")}</b>`}<small>${new Date(m.created_at).toTimeString().slice(0,5)}</small></div>`}${body}</div>${m.old||m.kind==="task"||m.kind==="file"?"":`<span class="tnma"><button title="Giao việc từ tin này" data-tnact="task">📋</button><button title="Nhắc tôi việc này" data-tnact="rem">⏰</button></span>`}</div>`}
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
  const room=TN.room,pj=room.startsWith("p:"),ng=room.startsWith("n:"),g=room.startsWith("g:")||pj||ng,n=tnName(room),dm=!g&&tnOther(room);
  m.innerHTML=`<div class="tn${TN.mob?" open":""}${tnInfoOn()?" wi":""}">
   <aside class="tnside"><div class="tnsh"><b>Tin nhắn</b><span>${tnBoss()?`<button class="btn sm" id="tnnew" title="Tạo nhóm phối hợp nhiều phòng, ví dụ Team Content – Digital">＋ Nhóm</button> `:""}<button class="btn sm" id="tnrem" title="Nhắc việc sắp tới">⏰ Nhắc việc</button></span></div>
    <input class="tnq" id="tnq" placeholder="Tìm nhóm phòng hoặc người để nhắn…" value="${esc(TN.q)}"><div class="tnlist" id="tnlist"></div></aside>
   <section class="tnmain"><header class="tnhd"><button class="tnback" id="tnback" aria-label="Quay lại">‹</button>${tnAv(g?room:dm,n,g)}<div class="tnhn"><b>${esc(n)}</b><small>${ng?`🔒 Nhóm phối hợp · ${((tnGrp(room)||{}).members||[]).length} thành viên${(tnGrp(room)||{}).created_by===tnMe()||ME.role==="admin"?` · <button type="button" class="lnk" id="tngedit">sửa thành viên</button>`:""}`:pj?"🔒 Nhóm dự án · chỉ người trong dự án":g?(room==="g:chung"?"Mọi người trong công ty":"🔒 Nhóm phòng · chỉ nhân sự phòng này"):"🔒 Nhắn riêng · chỉ hai người thấy"}</small></div>
     <span class="tnhb"><button class="btn sm" id="tngiao">📋 Giao việc</button><button class="btn sm" id="tnnhac">⏰ Nhắc</button><button class="btn sm${tnInfoOn()?" on":""}" id="tninfo" title="Ảnh, tệp, link, nhắc hẹn của cuộc trò chuyện">ⓘ</button></span></header>
    <div class="tnmsgs" id="tnmsgs"></div>
    <div class="tnpend" id="tnpend" hidden></div><form class="tnf" id="tnf"><div class="tnsug" id="tnsug" hidden></div><button type="button" class="tnatt" id="tnimg" title="Gửi ảnh" aria-label="Gửi ảnh"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5-5 4 4 3-3 4 4"/></svg></button><button type="button" class="tnatt" id="tnfile" title="Gửi tệp Word, Excel, PDF…" aria-label="Gửi tệp"><svg viewBox="0 0 24 24"><path d="M20.5 11.5 12 20a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.7a1.7 1.7 0 0 1-2.4-2.4L15 7.6"/></svg></button><input type="file" id="tnfi" hidden multiple><textarea id="tnin" rows="1" placeholder="Nhắn ${g?"cho nhóm "+esc(n):"riêng cho "+esc(n)}… (Enter gửi, Shift+Enter xuống dòng, @ gọi tên)">${esc(TN.draft[room]||"")}</textarea><button class="btn pri" id="tnsend">Gửi</button></form></section>${tnInfoOn()?tnInfoHtml(room):""}</div>`;
  tnDrawList();tnDrawMsgs();tnBindAtt(room);tnBindInfo(room);if(!TN.files[room])tnLoadFiles(room);
  if(!TN.msgs[room])tnLoad(room).then(()=>{if(TN.room===room&&PAGE==="tinnhan"){tnDrawMsgs();tnRead(room)}});else tnRead(room);
  if(!TN.sumAt)tnSummary();if(TN.groups===null)tnLoadGroups();
  if($("#tnnew"))$("#tnnew").onclick=()=>tnGroupForm(null);if($("#tngedit"))$("#tngedit").onclick=()=>tnGroupForm(tnGrp(room));
  const q=$("#tnq");q.oninput=()=>{TN.q=q.value;tnDrawList()};
  $("#tnback").onclick=()=>{TN.mob=false;$(".tn").classList.remove("open")};
  $("#tngiao").onclick=()=>tnGiao("");$("#tnnhac").onclick=()=>tnRemind("",dm||tnMe());$("#tnrem").onclick=()=>tnRemind("",tnMe());
  const inp=$("#tnin"),sug=$("#tnsug"),fit=()=>{inp.style.height="auto";inp.style.height=Math.min(inp.scrollHeight,140)+"px"};fit();
  const send=async()=>{const v=inp.value.trim(),P=(TN.pend[room]||[]).slice();if(!v&&!P.length)return;inp.value="";TN.draft[room]="";fit();sug.hidden=true;
    if(P.length){TN.pend[room]=[];tnDrawPend(room);await tnUpload(room,P)}
    if(v)try{await tnSend(room,v);tnDrawMsgs();tnDrawList()}catch(e){inp.value=v;TN.draft[room]=v;toast(e.message||"Chưa gửi được")}};
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
  if(room.startsWith("dm:"))f("#t-ng",(tnU(tnOther(room))||{}).id);else if(room.startsWith("p:")){const p=tnPrj(room);if(p){f("#t-da",p.id);f("#t-team",p.team)}}else f("#t-team",room.slice(2));
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
openChat=function(room){if(room){room=/^(dm|g|p):/.test(room)?room:"g:"+room;if(room.startsWith("dm:")&&!room.includes(tnMe())){const o=room.slice(3).split("~").map(tnU).find(u=>u&&u.id!==ME.id);room=o&&o.crm?tnDm(o.crm):""}}
  if(room)TN.room=room;TN.mob=!!room;if(PAGE==="tinnhan"&&room)tnOpen(room);else ntPage("tinnhan")};
const _bbTn=bellBadge;
bellBadge=function(){_bbTn();const c=$("#chatbtn");if(!c)return;c.title="Tin nhắn";const u=tnTotal();let t=c.querySelector("b");if(u){if(!t){t=document.createElement("b");c.appendChild(t)}t.textContent=u>99?"99+":u}else if(t)t.remove()};
setInterval(()=>{if(!ME||document.hidden)return;
  if(PAGE==="tinnhan"&&TN.room&&TN.msgs[TN.room]){const r=TN.room;tnLoad(r).then(ch=>{if(ch&&TN.room===r&&PAGE==="tinnhan"){tnDrawMsgs(true);tnRead(r)}})}
  if(Date.now()-TN.sumAt>(PAGE==="tinnhan"?8e3:25e3))tnSummary()},4000);
setInterval(tnDue,45e3);setTimeout(tnDue,8e3);

/* ---------- ảnh / tệp / link Drive + cột Thông tin hội thoại (chị Hoa 02/11: học Zalo) ---------- */
const TN_FMAX=1600000;
const tnInfoOn=()=>TN.info===null?matchMedia("(min-width:1280px)").matches:TN.info;
const tnFUrl=(id,dl)=>"/api/hub/chat/files/"+encodeURIComponent(id)+(dl?"?dl=1":"");
const tnFMeta=(room,id)=>(TN.files[room]||[]).find(f=>f.id===id);
const tnExt=n=>(String(n).split(".").pop()||"").toLowerCase();
const tnFIc=(mime,name)=>{const e=tnExt(name);const c=/pdf/.test(mime)||e==="pdf"?["PDF","#e03131"]:/sheet|excel|csv/.test(mime)||/^(xlsx?|csv)$/.test(e)?["XLS","#2f9e44"]:/word/.test(mime)||/^docx?$/.test(e)?["DOC","#1c4fb8"]:/presentation|powerpoint/.test(mime)||/^pptx?$/.test(e)?["PPT","#e8590c"]:["TXT","#667085"];return `<i class="tnfic" style="background:${c[1]}">${c[0]}</i>`};
const tnSize=n=>!n?"":n>=1e6?(n/1e6).toFixed(1)+" MB":Math.max(1,Math.round(n/1e3))+" KB";
function tnFileHtml(m){const id=String(m.ref||"").replace(/^f:/,""),f=tnFMeta(m.room||TN.room,id)||{name:m.body},img=f.mime?f.mime.startsWith("image/"):/\.(png|jpe?g|webp|gif)$/i.test(m.body||"");
  return img?`<a class="tnimg" href="${tnFUrl(id)}" data-tnlb="${esc(id)}"><img src="${tnFUrl(id)}" alt="${esc(m.body)}" loading="lazy"></a>`
    :`<div class="tnfile">${tnFIc(f.mime||"",f.name)}<span><b>${esc(f.name||m.body)}</b><small>${tnSize(f.size)}</small></span><a class="btn sm" href="${tnFUrl(id)}" target="_blank" rel="noopener">Mở</a><a class="btn sm" href="${tnFUrl(id,1)}">Tải</a></div>`}
const TN_DRV=/https?:\/\/(?:drive|docs)\.google\.com\/[^\s<]+/i;
function tnDriveCard(t){const u=(String(t||"").match(TN_DRV)||[])[0];if(!u)return "";
  const k=/\/folders\//.test(u)?["Thư mục Google Drive","📁"]:/spreadsheets/.test(u)?["Google Sheets","📊"]:/document/.test(u)?["Google Docs","📄"]:/presentation/.test(u)?["Google Slides","📽"]:["Tệp trên Google Drive","🗂"];
  return `<a class="tndrv" href="${esc(u)}" target="_blank" rel="noopener"><i>${k[1]}</i><span><b>${k[0]}</b><small>${esc(u.length>60?u.slice(0,60)+"…":u)}</small></span></a>`}
async function tnLoadFiles(room){try{TN.files[room]=await svApi("/api/hub/chat/files?room="+encodeURIComponent(room))}catch(e){TN.files[room]=[]}
  if(PAGE==="tinnhan"&&TN.room===room){tnDrawMsgs(true);const i=$("#tninfo-box");if(i)i.outerHTML=tnInfoHtml(room),tnBindInfo(room)}}
async function tnUpload(room,list){for(const f0 of [...(list||[])]){
  const f=typeof tkShrink==="function"?await tkShrink(f0):f0;if(f.size>TN_FMAX){toast(f0.name+" quá 1,5 MB, hãy gửi link Google Drive");continue}
  try{const fd=new FormData();fd.set("room",room);fd.set("file",f,f.name||f0.name||"anh.png");const r=await fetch("/api/hub/chat/files",{method:"POST",body:fd,credentials:"same-origin"});const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error((j.error&&j.error.message)||"Chưa gửi được");
    (TN.files[room]=TN.files[room]||[]).unshift(j.data.file);(TN.msgs[room]=TN.msgs[room]||[]).push(j.data.msg);TN.seen[room]=j.data.msg.id;
    const x=TN.rooms.find(z=>z.room===room);if(x)x.last=j.data.msg;else TN.rooms.push({room,last:j.data.msg,unread:0})}
  catch(e){toast((f0.name||"Tệp")+": "+(e.message||"chưa gửi được"))}}
  if(PAGE==="tinnhan"&&TN.room===room){tnDrawMsgs();tnDrawList();const i=$("#tninfo-box");if(i){i.outerHTML=tnInfoHtml(room);tnBindInfo(room)}}}
function tnBindAtt(room){const fi=$("#tnfi");if(!fi)return;
  $("#tnimg").onclick=()=>{fi.accept="image/*";fi.click()};$("#tnfile").onclick=()=>{fi.accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt";fi.click()};
  fi.onchange=()=>{const L=[...fi.files];fi.value="";if(L.length)tnAddPend(room,L)};
  const inp=$("#tnin");inp.addEventListener("paste",e=>{const L=[...(e.clipboardData&&e.clipboardData.files||[])];if(L.length){e.preventDefault();tnAddPend(room,L)}});
  const box=$(".tnmain");box.ondragover=e=>{e.preventDefault();box.classList.add("drop")};box.ondragleave=()=>box.classList.remove("drop");
  box.ondrop=e=>{e.preventDefault();box.classList.remove("drop");const L=[...(e.dataTransfer&&e.dataTransfer.files||[])];if(L.length)tnAddPend(room,L)}
  tnDrawPend(room)}
function tnInfoHtml(room){const F=TN.files[room],img=(F||[]).filter(f=>f.mime.startsWith("image/")),doc=(F||[]).filter(f=>!f.mime.startsWith("image/")),ex=TN.infoAll||"";
  const links=[];(TN.msgs[room]||[]).slice().reverse().forEach(m=>{if(m.kind)return;(String(m.body).match(/https?:\/\/[^\s<]+/g)||[]).forEach(u=>{if(!links.some(l=>l.u===u))links.push({u,at:m.created_at})})});
  const R=(TN.rems||[]).filter(r=>r.room===room);
  const more=(k,n,lim)=>n>lim?`<button type="button" class="tnmore" data-tnex="${k}">${ex===k?"Thu gọn":"Xem tất cả ("+n+")"}</button>`:"";
  return `<aside class="tninfo" id="tninfo-box"><div class="tnih"><b>Thông tin hội thoại</b><button type="button" class="lnk" id="tninfo-x">Ẩn</button></div>
   <section><h4>⏰ Nhắc hẹn</h4>${TN.rems===null?`<p class="hint">Đang tải…</p>`:R.length?R.map(r=>`<div class="tnir"><b>${tnAt(r.due_at)}</b> · ${r.user_id===tnMe()?"nhắc tôi":"nhắc "+esc(tnUN(r.user_id))}<br><small>${esc(r.text)}</small></div>`).join(""):`<p class="hint">Chưa có nhắc hẹn.</p>`}</section>
   <section><h4>Ảnh</h4>${!F?`<p class="hint">Đang tải…</p>`:img.length?`<div class="tnig">${(ex==="img"?img:img.slice(0,6)).map(f=>`<a href="${tnFUrl(f.id)}" data-tnlb="${esc(f.id)}"><img src="${tnFUrl(f.id)}" alt="${esc(f.name)}" loading="lazy"></a>`).join("")}</div>${more("img",img.length,6)}`:`<p class="hint">Chưa có ảnh.</p>`}</section>
   <section><h4>Tệp</h4>${!F?"":doc.length?(ex==="doc"?doc:doc.slice(0,5)).map(f=>`<a class="tnif" href="${tnFUrl(f.id)}" target="_blank" rel="noopener">${tnFIc(f.mime,f.name)}<span><b>${esc(f.name)}</b><small>${tnSize(f.size)} · ${tnTime(f.created_at)}</small></span></a>`).join("")+more("doc",doc.length,5):`<p class="hint">Chưa có tệp.</p>`}</section>
   <section><h4>Link</h4>${links.length?(ex==="link"?links:links.slice(0,5)).map(l=>`<a class="tnil" href="${esc(l.u)}" target="_blank" rel="noopener"><i>${TN_DRV.test(l.u)?"📁":"🔗"}</i><span><b>${esc(l.u.replace(/^https?:\/\//,"").slice(0,48))}</b><small>${tnTime(l.at)}</small></span></a>`).join("")+more("link",links.length,5):`<p class="hint">Chưa có link.</p>`}</section></aside>`}
function tnBindInfo(room){const b=$("#tninfo");if(b)b.onclick=()=>{TN.info=!tnInfoOn();renderMain()};
  const x=$("#tninfo-x");if(x)x.onclick=()=>{TN.info=false;renderMain()};
  document.querySelectorAll("[data-tnex]").forEach(e=>e.onclick=()=>{TN.infoAll=TN.infoAll===e.dataset.tnex?"":e.dataset.tnex;const i=$("#tninfo-box");if(i){i.outerHTML=tnInfoHtml(room);tnBindInfo(room)}});
  if(TN.rems===null&&tnInfoOn()&&!TN.remBusy){TN.remBusy=true;svApi("/api/hub/chat/reminders").then(r=>{TN.rems=r||[]}).catch(()=>{TN.rems=[]}).then(()=>{TN.remBusy=false;const i=$("#tninfo-box");if(i&&TN.room===room){i.outerHTML=tnInfoHtml(room);tnBindInfo(room)}})}}

/* khay ảnh / tệp chờ gửi (chị Hoa 03/11: dán ảnh là gửi luôn là sai — phải bấm Gửi) */
function tnAddPend(room,L){const A=TN.pend[room]=TN.pend[room]||[];[...L].forEach(f=>{if(f.size>TN_FMAX&&!f.type.startsWith("image/")){toast((f.name||"Tệp")+" quá 1,5 MB, hãy gửi link Google Drive");return}A.push(f)});tnDrawPend(room);const i=$("#tnin");if(i)i.focus()}
function tnDrawPend(room){const w=$("#tnpend");if(!w)return;const A=TN.pend[room]||[];w.hidden=!A.length;(w._urls||[]).forEach(u=>URL.revokeObjectURL(u));w._urls=[];
  w.innerHTML=A.map((f,i)=>{const img=f.type.startsWith("image/");let u="";if(img){u=URL.createObjectURL(f);w._urls.push(u)}return `<span class="tnpi">${img?`<img src="${u}" alt="">`:tnFIc(f.type,f.name||"")}<small>${esc(f.name||"Ảnh dán")}</small><button type="button" data-tnpx="${i}" aria-label="Bỏ">✕</button></span>`}).join("")+(A.length?`<span class="hint">Bấm Gửi để gửi ${A.length} tệp</span>`:"");
  w.querySelectorAll("[data-tnpx]").forEach(b=>b.onclick=()=>{A.splice(+b.dataset.tnpx,1);tnDrawPend(room)})}
/* xem ảnh: khung nổi trên trang, ✕ / bấm ra ngoài / Esc để tắt, ‹ › xem ảnh khác trong cuộc trò chuyện */
function tnLightbox(id){const room=TN.room,L=(TN.files[room]||[]).filter(f=>f.mime&&f.mime.startsWith("image/")).map(f=>f.id);let i=Math.max(0,L.indexOf(id));if(!L.includes(id))L.unshift(id),i=0;
  let o=$("#tnlb");if(o)o.remove();o=document.createElement("div");o.id="tnlb";o.className="tnlb";document.body.appendChild(o);
  const draw=()=>{const f=(TN.files[room]||[]).find(x=>x.id===L[i])||{};o.innerHTML=`<div class="tnlbbar"><span>${esc(f.name||"")}</span><span class="sp"></span><a class="btn sm" href="${tnFUrl(L[i],1)}">Tải về</a><button type="button" class="tnlbx" aria-label="Đóng">✕</button></div>
    ${L.length>1?`<button type="button" class="tnlbn p" aria-label="Ảnh trước">‹</button><button type="button" class="tnlbn n" aria-label="Ảnh sau">›</button>`:""}<img src="${tnFUrl(L[i])}" alt="">`;
    o.querySelector(".tnlbx").onclick=close;const p=o.querySelector(".tnlbn.p"),n=o.querySelector(".tnlbn.n");if(p)p.onclick=e=>{e.stopPropagation();i=(i-1+L.length)%L.length;draw()};if(n)n.onclick=e=>{e.stopPropagation();i=(i+1)%L.length;draw()}};
  const close=()=>{o.remove();document.removeEventListener("keydown",key)},key=e=>{if(e.key==="Escape")close();else if(e.key==="ArrowLeft"&&L.length>1){i=(i-1+L.length)%L.length;draw()}else if(e.key==="ArrowRight"&&L.length>1){i=(i+1)%L.length;draw()}};
  o.onclick=e=>{if(e.target===o)close()};document.addEventListener("keydown",key);draw()}
document.addEventListener("click",e=>{const a=e.target.closest&&e.target.closest("[data-tnlb]");if(!a)return;e.preventDefault();tnLightbox(a.dataset.tnlb)});

/* ---------- nhóm phối hợp tự tạo (chị Hoa 03/11: ví dụ Team Content – Digital; chỉ thành viên thấy) ---------- */
async function tnLoadGroups(){TN.groups=TN.groups||[];try{TN.groups=await svApi("/api/hub/chat/groups")}catch(e){}if(PAGE==="tinnhan")tnDrawList()}
function tnGroupForm(g){const P=D().users.filter(u=>u.active&&u.name&&u.crm&&u.crm!==tnMe()),sel=new Set(g?g.members:[]);
  const byT={};P.forEach(u=>{const t=(typeof KPB_TEAM!=="undefined"&&KPB_TEAM[u.phongBan])||String(teamOf(u)||"").toLowerCase();(byT[t]=byT[t]||[]).push(u)});
  openDrawerHTML(`<h2>${g?"Sửa nhóm":"Tạo nhóm phối hợp"}</h2><p class="hint">Nhóm để các phòng phối hợp (ví dụ Team Content – Digital). Chỉ thành viên thấy và nhắn được.</p>
   <form class="frm" id="tng-f"><label class="field">Tên nhóm<input id="tng-n" required value="${esc(g?g.name:"")}" placeholder="Ví dụ: Team Content – Digital"></label>
   <div class="field">Thành viên${Object.entries(byT).map(([t,L])=>`<div class="tngt"><b>${esc(TEAMS[t]||t||"Khác")}</b> <button type="button" class="lnk" data-tngall="${esc(t)}">chọn cả phòng</button><div class="phc">${L.map(u=>`<label class="ck sm"><input type="checkbox" name="tng-m" value="${esc(u.crm)}" data-t="${esc(t)}" ${sel.has(u.crm)?"checked":""}> ${esc(u.name)}</label>`).join("")}</div></div>`).join("")}</div>
   <div class="acts"><button class="btn pri">${g?"Lưu":"Tạo nhóm"}</button>${g?`<button type="button" class="btn danger" id="tng-del">Xoá nhóm</button>`:""}</div></form>`);
  document.querySelectorAll("[data-tngall]").forEach(b=>b.onclick=()=>document.querySelectorAll(`[name=tng-m][data-t="${b.dataset.tngall}"]`).forEach(i=>i.checked=true));
  $("#tng-f").onsubmit=async e=>{e.preventDefault();const name=$("#tng-n").value.trim(),members=[...document.querySelectorAll("[name=tng-m]:checked")].map(i=>i.value);if(!members.length){toast("Chọn ít nhất một thành viên");return}
    try{const r=await svApi("/api/hub/chat/groups"+(g?"/"+g.id:""),{method:g?"PUT":"POST",body:JSON.stringify({name,members})});await tnLoadGroups();closeDrawer();toast(g?"Đã lưu nhóm":"Đã tạo nhóm");openChat("n:"+(g?g.id:r.id))}catch(er){toast(er.message||"Chưa lưu được")}};
  if($("#tng-del"))$("#tng-del").onclick=async()=>{if(!confirm("Xoá nhóm này? Tin nhắn cũ trong nhóm không còn ai mở được."))return;try{await svApi("/api/hub/chat/groups/"+g.id,{method:"DELETE"});await tnLoadGroups();closeDrawer();TN.room="g:chung";renderMain()}catch(er){toast(er.message||"Chưa xoá được")}}}

/* ---------- tiếng "ting" khi có thông báo mới + nhắc bật thông báo Windows (chị Hoa 03/11) ----------
   Đang làm ở Zalo / trang khác vẫn thấy: thông báo của Windows (thongbao.js ntOs) + tiếng ting. Tắt tiếng: localStorage ailla_nt_am_<người> = false.
   Trình duyệt chỉ cho phát tiếng sau khi người dùng đã bấm vào trang một lần, nên tạo bộ phát tiếng ở lần bấm đầu tiên. */
let TN_AC=null;
["pointerdown","keydown"].forEach(ev=>addEventListener(ev,()=>{if(!TN_AC)try{TN_AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}if(TN_AC&&TN_AC.state==="suspended")TN_AC.resume()},{capture:true,passive:true}));
function tnTing(){try{if(typeof ntLS==="function"&&ntLS("am")===false)return;const ac=TN_AC;if(!ac)return;if(ac.state==="suspended")ac.resume();const t=ac.currentTime;
  [[1318.5,0],[1760,.12]].forEach(([f,d])=>{const o=ac.createOscillator(),g=ac.createGain();o.type="sine";o.frequency.value=f;g.gain.setValueAtTime(0,t+d);g.gain.linearRampToValueAtTime(.22,t+d+.01);g.gain.exponentialRampToValueAtTime(.001,t+d+.45);o.connect(g).connect(ac.destination);o.start(t+d);o.stop(t+d+.5)})}catch(e){}}
if(typeof ntFlush==="function"){const _ntFlushTn=ntFlush;ntFlush=function(){const n=NT.batch.length;_ntFlushTn();if(n)tnTing()}}
/* chưa bật thông báo Windows: nhắc lại mỗi ngày một lần (trước đây bấm ✕ một lần là không bao giờ hỏi lại) */
if(typeof ntAsk==="function"){const _ntAskTn=ntAsk;ntAsk=function(){try{const day=new Date().toDateString();if(ntLS("asked")&&ntLS("askedDay")!==day&&"Notification" in window&&Notification.permission==="default"){ntLS("asked",null);ntLS("askedDay",day)}}catch(e){}return _ntAskTn()};
  setTimeout(()=>{try{if(ME&&"Notification" in window&&Notification.permission==="default")ntAsk()}catch(e){}},6000)}
