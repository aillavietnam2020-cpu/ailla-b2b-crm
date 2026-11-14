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
/* agent trong chat: mã người gửi "agent:<mã agent>" */
/* Trợ lý công việc: máy chủ nhắn riêng từng người mỗi sáng (taskReminders.ts), phòng "dm:<mã đăng nhập>~sys-congviec" */
const CW_TROLY={id:"sys-congviec",name:"Trợ lý công việc",emoji:"📋",color:"#4b54d1",title:"Nhắc việc mỗi sáng"};
const tnAg=id=>id===CW_TROLY.id?CW_TROLY:String(id||"").startsWith("agent:")?(TN.agents||[]).find(a=>"agent:"+a.id===id)||{id:String(id).slice(6),name:"Agent",emoji:"🤖",color:"#4f46e5"}:null;
const tnUN=id=>{const a=tnAg(id);return a?a.name:(tnU(id)||{}).name||""};
const tnGroups=()=>[["chung","Chung toàn công ty"]].concat(Object.entries(TEAMS).filter(([k])=>k!=="chung"));
const tnMyTeam=()=>{const t=ME.phongBan&&typeof KPB_TEAM!=="undefined"&&KPB_TEAM[ME.phongBan]?KPB_TEAM[ME.phongBan]:String(teamOf(ME)||"").toLowerCase();return TEAMS[t]&&t!=="chung"?t:""};
const tnDm=id=>"dm:"+[tnMe(),id].sort().join("~");
const tnOther=r=>r.startsWith("ag:")?"agent:"+r.slice(3):r.startsWith("dm:")?r.slice(3).split("~").find(x=>x!==tnMe())||tnMe():"";
const tnPrj=r=>(D().projects||[]).find(p=>"p:"+p.id===r);
/* dự án tôi được vào nhóm chat: phụ trách, thành viên, hoặc phòng tôi tham gia dự án (khớp quyền máy chủ chat.ts) */
const tnMyPrj=()=>(D().projects||[]).filter(p=>ME.role==="admin"||p.team==="chung"||p.owner===ME.id||(p.tv||[]).includes(ME.id)||[p.team].concat(p.teams||[]).includes(tnMyTeam()));
const tnGrp=r=>(TN.groups||[]).find(g=>"n:"+g.id===r);
const tnBoss=()=>!!ME&&(ME.role==="admin"||ME.role==="lead"||ME.role==="truongphong");
const tnName=r=>r.startsWith("ag:")?((tnAg("agent:"+r.slice(3))||{}).name||"Agent"):r.startsWith("n:")?((tnGrp(r)||{}).name||"Nhóm"):r.startsWith("p:")?((tnPrj(r)||{}).ten||"Dự án "+r.slice(2)):r.startsWith("g:")?(r==="g:chung"?"Chung toàn công ty":TEAMS[r.slice(2)]||r.slice(2)):tnUN(tnOther(r))||"Nhắn riêng";
const tnTime=t=>{const d=new Date(t),n=new Date();return d.toDateString()===n.toDateString()?d.toTimeString().slice(0,5):d.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"})};
const tnDay=t=>{const d=new Date(t),n=new Date(),y=new Date(n-864e5);return d.toDateString()===n.toDateString()?"Hôm nay":d.toDateString()===y.toDateString()?"Hôm qua":d.toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit"})};
const tnInit=n=>{const w=String(n||"?").trim().split(/\s+/);return (w.length>1?w[w.length-2][0]+w[w.length-1][0]:w[0].slice(0,2)).toUpperCase()};
const tnAv=(id,name,grp)=>{const ag=tnAg(id);if(ag)return `<i class="tnav tnavag" style="background:${ag.color}1a;border:1.5px solid ${ag.color}">${ag.emoji||"🤖"}</i>`;const c=avC(id);return `<i class="tnav${grp?" g":""}" style="background:${c[0]};color:${c[1]}">${grp?"#":esc(tnInit(name))}</i>`};
const tnPeople=()=>D().users.filter(u=>u.active&&u.name&&u.crm&&u.crm!==tnMe()&&!(typeof CV_TEST!=="undefined"&&CV_TEST.includes(u.id)));
const tnTotal=()=>TN.rooms.reduce((a,r)=>a+(r.room===TN.room&&PAGE==="tinnhan"?0:r.unread||0),0);
/* gọi tên @: bỏ dấu + không phân biệt hoa thường; tên có khoảng trắng ("Lead Content") khớp theo cụm dài nhất; @ phải đứng đầu dòng hoặc sau khoảng trắng (không bắt email) */
const tnNorm=t=>String(t||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/gi,"d").toLowerCase().trim();
const TN_ALLW=["all","tat ca","tatca"];
const tnAtNames=()=>tnPeople().concat(ME?[ME]:[]).concat(TN.agents||[]).map(u=>tnNorm(u.name)).filter(Boolean);
function tnAtFind(str){const names=new Set(tnAtNames()),out=[],re=/(^|[\s(])@([\p{L}\d][\p{L}\d ]{0,40})/gu;let m;
  while((m=re.exec(str))){re.lastIndex=m.index+m[1].length+1;const w=m[2].split(" ");for(let k=w.length;k>0;k--){const c=w.slice(0,k).join(" "),n=tnNorm(c);if(!n)continue;
    if(TN_ALLW.includes(n)||names.has(n)){out.push({i:m.index+m[1].length,len:1+c.length,all:TN_ALLW.includes(n),n});break}}}
  return out}
const tnLink=t=>{let h=esc(t);const F=tnAtFind(h);for(let k=F.length-1;k>=0;k--){const f=F[k];h=h.slice(0,f.i)+'<b class="tnat">'+h.slice(f.i,f.i+f.len)+'</b>'+h.slice(f.i+f.len)}
  return h.replace(/https?:\/\/[^\s<]+/g,m=>`<a href="${m}" target="_blank" rel="noopener">${m.length>56?m.slice(0,56)+"…":m}</a>`).replace(/\n/g,"<br>")};
const tnMentionsMe=b=>!!ME&&tnAtFind(b||"").some(f=>f.all||f.n===tnNorm(ME.name));
/* tin của khung trao đổi cũ (dữ liệu chung) */
const tnOld=r=>{let k=r.startsWith("g:")?r.slice(2):"";if(r.startsWith("dm:")){const o=tnU(tnOther(r));if(!o)return [];k="dm:"+[ME.id,o.id].sort().join("~")}
  return ((D().chat||{})[k]||[]).slice(-80).map(m=>({id:0,old:true,user_id:(tnU(m.by)||{}).crm||m.by,body:m.text,kind:"",created_at:m.t}))};

/* ---------- máy chủ ---------- */
async function tnSummary(){if(!ME||typeof svApi!=="function")return;
  try{const r=await svApi("/api/hub/chat/summary");const old=new Map(TN.rooms.map(x=>[x.room,x.last&&x.last.id]));TN.rooms=r.rooms||[];
    if(TN.sumAt)TN.rooms.forEach(x=>{if(!x.last||x.last.user_id===tnMe()||!x.unread||old.get(x.room)===x.last.id||["react","unsend"].includes(x.last.kind))return;if(TN.room===x.room&&(PAGE==="tinnhan"||TN.popRoom===x.room)&&!document.hidden)return;
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
  const pv=l?(l.kind==="unsend"||l.kind==="recall"?(l.user_id===tnMe()?"Bạn":tnUN(l.user_id)||"")+" đã thu hồi một tin":l.kind==="pin"?"📌 "+(l.body?"Đã ghim: "+l.body:"Bỏ ghim tin"):l.kind==="react"?(l.user_id===tnMe()?"Bạn":tnUN(l.user_id)||"")+(l.body?" đã thả "+l.body:" bỏ cảm xúc"):l.kind==="task"?"📋 "+l.body:l.kind==="remind"?"⏰ "+l.body:(g&&l.user_id!==tnMe()?(tnUN(l.user_id)||"")+": ":l.user_id===tnMe()?"Bạn: ":"")+l.body):r.room.startsWith("n:")?"Nhóm phối hợp · chưa có tin":r.room.startsWith("p:")?"Nhóm dự án · chưa có tin":g?"Nhóm phòng · chưa có tin":"Bắt đầu nhắn riêng";
  return `<button class="tnrow${r.room===TN.room?" on":""}${un?" un":""}" data-tnr="${esc(r.room)}">${tnAv(g?r.room:tnOther(r.room),n,g)}<span class="tnrb"><span class="tnr1"><b>${esc(n)}</b>${l?`<small>${tnTime(l.created_at)}</small>`:""}</span><span class="tnr2"><span>${esc(String(pv).replace(/\s+/g," ").slice(0,70))}</span>${un?`<em>${un>99?"99+":un}</em>`:""}</span></span></button>`}
function tnDrawList(){const el=$("#tnlist");if(!el)return;const R=tnListRows();
  el.innerHTML=(R.map(tnRowHtml).join("")||`<p class="hint" style="padding:14px">Không thấy nhóm hay người nào.</p>`)+tnAgentRows();
  el.querySelectorAll("[data-tnr]").forEach(b=>b.onclick=()=>TN.popOn&&PAGE!=="tinnhan"?tnPop(b.dataset.tnr):tnOpen(b.dataset.tnr));
  el.querySelectorAll("[data-tnag]").forEach(b=>b.onclick=()=>{const r="ag:"+b.dataset.tnag;TN.popOn&&PAGE!=="tinnhan"?tnPop(r):tnOpen(r)})}
function tnTaskCard(m){const id=String(m.ref||"").replace(/^task:/,""),t=(D().tasks||[]).find(x=>x.id===id);
  if(!t)return `<div class="tntask gone">📋 ${esc(m.body)} <small>(việc đã xóa)</small></div>`;
  const st=t.st||"todo",cls=st==="done"?"p-grn":st==="review"?"p-amb":"p-blu";
  return `<div class="tntask"><div class="tntk1"><b>📋 ${esc(t.ten)}</b><span class="pill ${cls}">${esc(cvStN(st))}</span></div><div class="tntk2">Người làm: <b>${esc(userName(t.nguoi)||"chưa giao")}</b>${t.han?` · hạn ${dd(t.han)}`:""}</div><button class="btn sm" data-tntask="${esc(t.id)}">Mở việc</button></div>`}
function tnMsgHtml(m,prev){const me=m.user_id===tnMe(),cont=prev&&prev.user_id===m.user_id&&new Date(m.created_at)-new Date(prev.created_at)<5*60e3&&!prev.old===!m.old;
  if(m.kind==="remind")return `<div class="tnsys">⏰ ${esc(tnUN(m.user_id)||"")} ${esc(m.body)}</div>`;
  const body=m.kind==="agent"?`<div class="tnbub tnagb">${tnLink(m.body)}</div>`:m.kind==="task"?tnTaskCard(m):m.kind==="file"?tnFileHtml(m):`<div class="tnbub">${tnLink(m.body)}</div>${tnDriveCard(m.body)}`;
  return `<div class="tnm${me?" me":""}${cont?" cont":""}" data-mid="${m.id||""}">${me||cont?`<i class="tnav sp"></i>`:tnAv(m.user_id,tnUN(m.user_id))}<div class="tnmb">${cont?"":`<div class="tnmh">${me?"":`<b>${esc(tnUN(m.user_id)||"")}</b>`}<small>${new Date(m.created_at).toTimeString().slice(0,5)}</small></div>`}${body}${m.old?"":tnReactHtml(m)}</div>${m.old?"":`<span class="tnma"><button title="Thả cảm xúc" data-tnact="emo">☺</button>${m.kind==="task"||m.kind==="file"?"":`<button title="Giao việc từ tin này" data-tnact="task">📋</button><button title="Nhắc tôi việc này" data-tnact="rem">⏰</button>`}</span>`}</div>`}
function tnMsgsHtml(room){const old=tnOld(room),L0=TN.msgs[room];
  if(!L0)return `<p class="hint tnempty">Đang tải…</p>`;tnReactBuild(L0);const L=L0.filter(m=>m.kind!=="react");
  let h="",day="",prev=null;const add=m=>{const d=tnDay(m.created_at);if(d!==day){day=d;h+=`<div class="tnday"><span>${d}</span></div>`;prev=null}h+=tnMsgHtml(m,prev);prev=m};
  if(TN.more[room])h+=`<div class="tnday"><button class="lnk" id="tnmore">Xem tin cũ hơn</button></div>`;
  if(old.length&&!TN.more[room]){h+=`<div class="tnday old"><span>Tin của khung trao đổi trước</span></div>`;old.forEach(add);day=""}
  L.forEach(add);h+=tnAgentWaitHtml(room,L);
  return h||`<div class="tnempty"><b>${room.startsWith("dm:")?"Bắt đầu cuộc trò chuyện":"Chưa có tin nhắn trong nhóm"}</b><p class="hint">Gõ @ để gọi tên · 📋 giao việc · ⏰ nhắc việc ngay tại đây.</p></div>`}
function tnDrawMsgs(keepPos){const el=$("#tnmsgs");if(!el)return;const atEnd=el.scrollHeight-el.scrollTop-el.clientHeight<80,h0=el.scrollHeight,t0=el.scrollTop;
  el.innerHTML=tnMsgsHtml(TN.room);
  if(keepPos==="top")el.scrollTop=el.scrollHeight-h0+t0;else if(atEnd||!keepPos)el.scrollTop=el.scrollHeight;
  if($("#tnmore"))$("#tnmore").onclick=async()=>{await tnLoad(TN.room,true);tnDrawMsgs("top")};
  el.querySelectorAll("[data-tntask]").forEach(b=>b.onclick=()=>openTask(b.dataset.tntask));
  el.querySelectorAll("[data-tnact]").forEach(b=>b.onclick=()=>{const mid=+b.closest("[data-mid]").dataset.mid,m=(TN.msgs[TN.room]||[]).find(x=>x.id===mid);if(!m)return;
    if(b.dataset.tnact==="emo"){tnReactPick(b,m);return}
    if(b.dataset.tnact==="task")tnGiao(m.body);else tnRemind(m.body,tnMe())});
  el.querySelectorAll("[data-tnrx]").forEach(b=>b.onclick=()=>{const [mid,e]=b.dataset.tnrx.split("|"),m=(TN.msgs[TN.room]||[]).find(x=>x.id===+mid);if(m)tnReact(m,e)})
  /* cột Thông tin hội thoại: link lấy từ tin vừa tải */
  const ib=$("#tninfo-box");if(ib&&typeof tnInfoHtml==="function"){ib.outerHTML=tnInfoHtml(TN.room);tnBindInfo(TN.room)}}
async function tnOpen(room){TN.room=room;TN.mob=true;try{localStorage.setItem("tn_room_"+tnMe(),room)}catch(e){}
  if(PAGE!=="tinnhan"){ntPage("tinnhan");return}
  renderMain();if(!TN.msgs[room]){await tnLoad(room);if(TN.room===room){tnDrawMsgs();tnRead(room)}}else{tnRead(room);if(await tnLoad(room)&&TN.room===room){tnDrawMsgs(true);tnRead(room)}}}

/* ---------- trang ---------- */
PAGES.tinnhan=m=>{if(TN.popOn)tnPopClose();
  if(!TN.room){let r="";try{r=localStorage.getItem("tn_room_"+tnMe())||""}catch(e){}TN.room=r&&(r.startsWith("g:")||r.includes(tnMe()))?r:"g:chung"}
  const room=TN.room,pj=room.startsWith("p:"),ng=room.startsWith("n:"),g=room.startsWith("g:")||pj||ng,n=tnName(room),dm=!g&&tnOther(room);
  m.innerHTML=`<div class="tn${TN.mob?" open":""}${tnInfoOn()?" wi":""}">
   <aside class="tnside"><div class="tnsh"><b>Tin nhắn</b><span>${tnBoss()?`<button class="btn sm" id="tnnew" title="Tạo nhóm phối hợp nhiều phòng, ví dụ Team Content – Digital">＋ Nhóm</button> `:""}<button class="btn sm" id="tnrem" title="Nhắc việc sắp tới">⏰ Nhắc việc</button></span></div>
    <input class="tnq" id="tnq" placeholder="Tìm nhóm phòng hoặc người để nhắn…" value="${esc(TN.q)}"><div class="tnlist" id="tnlist"></div></aside>
   <section class="tnmain"><header class="tnhd"><button class="tnback" id="tnback" aria-label="Quay lại">‹</button>${tnAv(g?room:dm,n,g)}<div class="tnhn"><b>${esc(n)}</b><small>${ng?`🔒 Nhóm phối hợp · ${((tnGrp(room)||{}).members||[]).length} thành viên${(tnGrp(room)||{}).created_by===tnMe()||ME.role==="admin"?` · <button type="button" class="lnk" id="tngedit">sửa thành viên</button>`:""}`:pj?"🔒 Nhóm dự án · chỉ người trong dự án":g?(room==="g:chung"?"Mọi người trong công ty":"🔒 Nhóm phòng · chỉ nhân sự phòng này"):dm===CW_TROLY.id?"Tin tự động nhắc việc mỗi sáng · không cần trả lời":"🔒 Nhắn riêng · chỉ hai người thấy"}</small></div>
     <span class="tnhb">${g&&tnBoss()?`<button class="btn sm" id="tnagbtn" title="Thêm agent vào nhóm này">🤖 Agent${tnRoomAgents(room).length?" "+tnRoomAgents(room).length:""}</button>`:""}<button class="btn sm" id="tngiao">📋 Giao việc</button><button class="btn sm" id="tnnhac">⏰ Nhắc</button><button class="btn sm${tnInfoOn()?" on":""}" id="tninfo" title="Ảnh, tệp, link, nhắc hẹn của cuộc trò chuyện">ⓘ</button></span></header>
    <div class="tnmsgs" id="tnmsgs"></div>
    <div class="tnpend" id="tnpend" hidden></div><form class="tnf" id="tnf"><div class="tnsug" id="tnsug" hidden></div><button type="button" class="tnatt" id="tnemo" title="Biểu tượng cảm xúc" aria-label="Biểu tượng cảm xúc"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/></svg></button><button type="button" class="tnatt" id="tnimg" title="Gửi ảnh" aria-label="Gửi ảnh"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5-5 4 4 3-3 4 4"/></svg></button><button type="button" class="tnatt" id="tnfile" title="Gửi tệp Word, Excel, PDF…" aria-label="Gửi tệp"><svg viewBox="0 0 24 24"><path d="M20.5 11.5 12 20a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.7a1.7 1.7 0 0 1-2.4-2.4L15 7.6"/></svg></button><button type="button" class="tnatt" id="tnmic" title="Ghi âm tin nhắn thoại" aria-label="Ghi âm"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg></button><input type="file" id="tnfi" hidden multiple><textarea id="tnin" rows="1" placeholder="Nhắn ${g?"cho nhóm "+esc(n):"riêng cho "+esc(n)}… (Enter gửi, Shift+Enter xuống dòng, @ gọi tên)">${esc(TN.draft[room]||"")}</textarea><button class="btn pri" id="tnsend">Gửi</button></form></section>${tnInfoOn()?tnInfoHtml(room):""}</div>`;
  tnDrawList();tnDrawMsgs();tnBindAtt(room);tnBindEmo();tnBindInfo(room);if(!TN.files[room])tnLoadFiles(room);
  if(!TN.msgs[room])tnLoad(room).then(()=>{if(TN.room===room&&PAGE==="tinnhan"){tnDrawMsgs();tnRead(room)}});else tnRead(room);
  if(!TN.sumAt)tnSummary();if(TN.groups===null)tnLoadGroups();if(!TN.agents)tnLoadAgents();
  if($("#tnagbtn"))$("#tnagbtn").onclick=()=>tnAgentForm(room);
  if($("#tnnew"))$("#tnnew").onclick=()=>tnGroupForm(null);if($("#tngedit"))$("#tngedit").onclick=()=>tnGroupForm(tnGrp(room));
  const q=$("#tnq");q.oninput=()=>{TN.q=q.value;tnDrawList()};
  $("#tnback").onclick=()=>{TN.mob=false;$(".tn").classList.remove("open")};
  $("#tngiao").onclick=()=>tnGiao("");$("#tnnhac").onclick=()=>tnRemind("",dm||tnMe());$("#tnrem").onclick=()=>tnRemind("",tnMe());
  const inp=$("#tnin"),sug=$("#tnsug"),fit=()=>{inp.style.height="auto";inp.style.height=Math.min(inp.scrollHeight,140)+"px"};fit();
  const send=async()=>{const v=inp.value.trim(),P=(TN.pend[room]||[]).slice();if(!v&&!P.length)return;tnAgentWait(room,v);inp.value="";TN.draft[room]="";fit();sug.hidden=true;
    if(P.length){TN.pend[room]=[];tnDrawPend(room);await tnUpload(room,P)}
    if(v)try{await tnSend(room,v);tnDrawMsgs();tnDrawList()}catch(e){inp.value=v;TN.draft[room]=v;toast(e.message||"Chưa gửi được")}};
  tnBindAt(inp,sug,room,g,send,fit);
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
  /* đang ở trang khác: mở cửa sổ chat nhỏ góc dưới phải, không rời trang (chị Hoa 03/11) */
  if(PAGE!=="tinnhan"){if(!room&&TN.popOn){tnPopClose();return}tnPop(room||"");return}
  if(room)TN.room=room;TN.mob=!!room;if(room)tnOpen(room);else ntPage("tinnhan")};
const _bbTn=bellBadge;
bellBadge=function(){_bbTn();const c=$("#chatbtn");if(!c)return;c.title="Tin nhắn";
  /* nút tin nhắn: biểu tượng nét xanh dương, viền xanh (chị Hoa 03/11) */
  if(!c.dataset.ic){c.dataset.ic="1";[...c.childNodes].forEach(n=>{if(n.nodeType===3)n.remove()});c.insertAdjacentHTML("afterbegin",'<svg class="chatic" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/></svg>')}const u=tnTotal();let t=c.querySelector("b");if(u){if(!t){t=document.createElement("b");c.appendChild(t)}t.textContent=u>99?"99+":u}else if(t)t.remove()};
setInterval(()=>{if(!ME)return;
  /* tab đang ẩn (chị đang ở Zalo, web khác): vẫn hỏi tin mới 30 giây một lần để có số trên nút, chuông ting và thông báo Windows (chị Hoa 04/11) */
  if(document.hidden){if(Date.now()-TN.sumAt>3e4)tnSummary();return}
  if((PAGE==="tinnhan"||TN.popRoom)&&TN.room&&TN.msgs[TN.room]){const r=TN.room;tnLoad(r).then(ch=>{if(ch&&TN.room===r&&(PAGE==="tinnhan"||TN.popRoom===r)){tnDrawMsgs(true);tnRead(r)}})}
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
  const aud=f.mime?f.mime.startsWith("audio/"):/^Ghi âm/.test(m.body||"");if(aud)return `<div class="tnaud"><audio controls preload="metadata" src="${tnFUrl(id)}"></audio></div>`;
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
function tnBindAtt(room){const fi=$("#tnfi");if(!fi)return;const mic=$("#tnmic");if(mic)mic.onclick=()=>tnRecToggle(room,mic);
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
  w.innerHTML=A.map((f,i)=>{const img=f.type.startsWith("image/");let u="";if(img){u=URL.createObjectURL(f);w._urls.push(u)}if(f.type.startsWith("audio/")){const au=URL.createObjectURL(f);w._urls.push(au);return `<span class="tnpi tnpa"><audio controls src="${au}"></audio><button type="button" data-tnpx="${i}" aria-label="Bỏ">✕</button></span>`}
    return `<span class="tnpi">${img?`<img src="${u}" alt="">`:tnFIc(f.type,f.name||"")}<small>${esc(f.name||"Ảnh dán")}</small><button type="button" data-tnpx="${i}" aria-label="Bỏ">✕</button></span>`}).join("")+(A.length?`<span class="hint">Bấm Gửi để gửi ${A.length} tệp</span>`:"");
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
function tnTing(){try{if(typeof ntLS==="function"&&ntLS("am")===false)return;if(!TN_AC)try{TN_AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}const ac=TN_AC;if(!ac)return;if(ac.state==="suspended")ac.resume();const t=ac.currentTime;
  [[1318.5,0],[1760,.12]].forEach(([f,d])=>{const o=ac.createOscillator(),g=ac.createGain();o.type="sine";o.frequency.value=f;g.gain.setValueAtTime(0,t+d);g.gain.linearRampToValueAtTime(.22,t+d+.01);g.gain.exponentialRampToValueAtTime(.001,t+d+.45);o.connect(g).connect(ac.destination);o.start(t+d);o.stop(t+d+.5)})}catch(e){}}
if(typeof ntFlush==="function"){const _ntFlushTn=ntFlush;ntFlush=function(){const n=NT.batch.length;_ntFlushTn();if(n)tnTing()}}
/* chưa bật thông báo Windows: nhắc lại mỗi ngày một lần (trước đây bấm ✕ một lần là không bao giờ hỏi lại) */
if(typeof ntAsk==="function"){const _ntAskTn=ntAsk;ntAsk=function(){try{const day=new Date().toDateString();if(ntLS("asked")&&ntLS("askedDay")!==day&&"Notification" in window&&Notification.permission==="default"){ntLS("asked",null);ntLS("askedDay",day)}}catch(e){}return _ntAskTn()};
  setTimeout(()=>{try{if(ME&&"Notification" in window&&Notification.permission==="default")ntAsk()}catch(e){}},6000)}

/* ---------- biểu tượng cảm xúc + thả cảm xúc vào tin (chị Hoa 03/11) ----------
   Thả cảm xúc lưu thành tin loại "react" (ref r:<mã tin>, body = biểu tượng, rỗng = bỏ); mỗi người giữ cái thả sau cùng. */
const TN_RX=["❤️","👍","😂","😮","😢","😡"];
const TN_EMO="😀 😁 😂 🤣 😊 😍 🥰 😘 😉 😎 🤩 🥳 🤗 🤔 😅 😆 🙂 😇 😴 😮 😯 😢 😭 😤 😡 🥺 😱 🤯 😬 🙄 👍 👎 👏 🙏 💪 👌 ✌️ 🤝 🙌 👀 ❤️ 💖 💯 🔥 ⭐ ✨ 🎉 🎁 ✅ ❌ ⚠️ ⏰ 📌 📎 📷 🎬 🛒 💰 📦 🚚".split(" ");
let TN_RMAP={};
function tnReactBuild(L){const per={};L.filter(m=>m.kind==="react").forEach(m=>{const id=String(m.ref||"").slice(2);(per[id]=per[id]||{})[m.user_id]=m.body});
  TN_RMAP={};Object.entries(per).forEach(([id,u])=>{const g={};Object.entries(u).forEach(([who,e])=>{if(e)(g[e]=g[e]||[]).push(who)});TN_RMAP[id]=g})}
function tnReactHtml(m){const g=TN_RMAP[String(m.id)];if(!g||!Object.keys(g).length)return "";
  return `<div class="tnrx">${Object.entries(g).map(([e,L])=>`<button type="button" class="${L.includes(tnMe())?"on":""}" data-tnrx="${m.id}|${e}" title="${esc(L.map(tnUN).join(", "))}">${e} <b>${L.length}</b></button>`).join("")}</div>`}
async function tnReact(m,e){const room=TN.room,mine=(TN_RMAP[String(m.id)]||{})[e]||[],off=mine.includes(tnMe());
  try{await tnSend(room,off?"":e,"react","r:"+m.id);tnDrawMsgs(true);tnDrawList()}catch(er){toast(er.message||"Chưa thả được")}}
function tnReactPick(btn,m){document.querySelectorAll(".tnrxp").forEach(x=>x.remove());const p=document.createElement("div");p.className="tnrxp";
  p.innerHTML=TN_RX.map(e=>`<button type="button" data-e="${e}">${e}</button>`).join("");btn.parentNode.appendChild(p);
  p.querySelectorAll("[data-e]").forEach(b=>b.onclick=ev=>{ev.stopPropagation();p.remove();tnReact(m,b.dataset.e)});
  setTimeout(()=>document.addEventListener("click",function f(ev){if(!p.contains(ev.target)){p.remove();document.removeEventListener("click",f)}}),0)}
function tnBindEmo(){const b=$("#tnemo"),inp=$("#tnin");if(!b||!inp)return;b.onclick=ev=>{ev.stopPropagation();let p=$("#tnemop");if(p){p.remove();return}
  p=document.createElement("div");p.id="tnemop";p.className="tnemop";p.innerHTML=TN_EMO.map(e=>`<button type="button">${e}</button>`).join("");$("#tnf").appendChild(p);
  p.querySelectorAll("button").forEach(x=>x.onmousedown=e=>{e.preventDefault();const s=inp.selectionStart??inp.value.length,v=inp.value;inp.value=v.slice(0,s)+x.textContent+v.slice(inp.selectionEnd??s);const c=s+x.textContent.length;inp.setSelectionRange(c,c);TN.draft[TN.room]=inp.value;inp.focus()});
  setTimeout(()=>document.addEventListener("click",function f(e){if(!p.contains(e.target)&&e.target!==b){p.remove();document.removeEventListener("click",f)}}),0)}}

/* gợi ý @tên / @all dưới ô soạn tin: dùng chung cho trang Tin nhắn và khung nổi; ↑↓ chọn, Enter/Tab chèn, bấm hoặc chạm cũng chèn */
function tnBindAt(inp,sug,room,g,send,fit){let act=0,items=[];
  const RE=/(^|[\s(])@([\p{L}\d ]{0,40})$/u;
  const atQ=()=>{const m=inp.value.slice(0,inp.selectionStart).match(RE);return m?m[2]:null};
  const pick=v=>{const p=inp.selectionStart,s=inp.value.slice(0,p).replace(RE,(m,a)=>a+"@"+v+" ");inp.value=s+inp.value.slice(p);inp.setSelectionRange(s.length,s.length);TN.draft[room]=inp.value;sug.hidden=true;if(fit)fit();inp.focus()};
  const mark=()=>[...sug.children].forEach((b,i)=>{b.classList.toggle("on",i===act);if(i===act)b.scrollIntoView({block:"nearest"})});
  const draw=()=>{const a=atQ();if(a===null){sug.hidden=true;items=[];return}const q=tnNorm(a);
    const rank=u=>{const n=tnNorm(u.name);return n.startsWith(q)||n.split(" ").some(w=>w.startsWith(q))?0:1};
    const L=tnPeople().filter(u=>tnNorm(u.name).includes(q)).sort((x,y)=>rank(x)-rank(y)).slice(0,8),
      all=g&&TN_ALLW.some(w=>w.startsWith(q)),AG=tnRoomAgents(room).filter(x=>tnNorm(x.name).includes(q));
    if(!L.length&&!all&&!AG.length){sug.hidden=true;items=[];return}sug.hidden=false;act=0;
    items=(all?[["all",`<i class="tnav g">@</i>all<small>gọi cả nhóm</small>`]]:[]).concat(AG.map(x=>[x.name,`${tnAv("agent:"+x.id,x.name)}${esc(x.name)}<small>agent</small>`]),L.map(u=>[u.name,`${tnAv(u.crm,u.name)}${esc(u.name)}<small>${esc(TEAMS[teamOf(u)]||"")}</small>`]));
    sug.innerHTML=items.map((it,i)=>`<button type="button" data-i="${i}">${it[1]}</button>`).join("");
    sug.querySelectorAll("button").forEach(b=>{b.onpointerdown=e=>{e.preventDefault();pick(items[+b.dataset.i][0])}});mark()};
  inp.oninput=()=>{TN.draft[room]=inp.value;if(fit)fit();draw()};
  inp.onclick=inp.onkeyup=e=>{if(e&&e.type==="keyup"&&["ArrowUp","ArrowDown","Enter","Tab","Escape"].includes(e.key))return;draw()};
  inp.onkeydown=e=>{const open=!sug.hidden&&items.length;
    if(open&&(e.key==="ArrowDown"||e.key==="ArrowUp")){e.preventDefault();act=(act+(e.key==="ArrowDown"?1:items.length-1))%items.length;mark()}
    else if(open&&(e.key==="Tab"||(e.key==="Enter"&&!e.shiftKey&&!e.isComposing))){e.preventDefault();pick(items[act][0])}
    else if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();send()}
    else if(e.key==="Escape")sug.hidden=true};
  inp.onblur=()=>setTimeout(()=>sug.hidden=true,150)}

/* ---------- cửa sổ chat nhỏ góc dưới phải (kiểu Messenger) ---------- */
function tnPopClose(){const p=$("#tnpop");if(p)p.remove();TN.popOn=false;TN.popRoom=""}
async function tnPop(room){let p=$("#tnpop");if(!p){p=document.createElement("div");p.id="tnpop";p.className="tnpop";document.body.appendChild(p)}TN.popOn=true;TN.popRoom=room||"";
  if(!TN.sumAt)tnSummary();if(TN.groups===null)tnLoadGroups();if(!TN.agents)tnLoadAgents();
  const full=`<button type="button" class="tnpx" id="tnp-big" title="${TN.popBig?"Thu nhỏ":"Phóng to"}">${TN.popBig?"🗕":"🗖"}</button><button type="button" class="tnpx" id="tnp-x" title="Đóng">✕</button>`;
  if(!room){p.innerHTML=`<div class="tnph"><b>Tin nhắn</b><span class="sp"></span>${full}</div><input class="tnq" id="tnq" placeholder="Tìm nhóm hoặc người…" value="${esc(TN.q||"")}"><div class="tnlist" id="tnlist"></div>`;
    tnDrawList();const q=$("#tnq");q.oninput=()=>{TN.q=q.value;tnDrawList()}}
  else{TN.room=room;const g=/^(g|p|n):/.test(room),n=tnName(room);
    p.innerHTML=`<div class="tnph"><button type="button" class="tnpx" id="tnp-back" title="Danh sách">‹</button>${tnAv(g?room:tnOther(room),n,g)}<b class="tnpn">${esc(n)}</b><span class="sp"></span>${full}</div>
     <div class="tnmain tnpm"><div class="tnmsgs" id="tnmsgs"><p class="hint tnempty">Đang tải…</p></div><div class="tnpend" id="tnpend" hidden></div>
     <form class="tnf" id="tnf"><div class="tnsug" id="tnsug" hidden></div><button type="button" class="tnatt" id="tnemo" title="Biểu tượng cảm xúc"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/></svg></button><button type="button" class="tnatt" id="tnimg" title="Gửi ảnh"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5-5 4 4 3-3 4 4"/></svg></button><button type="button" class="tnatt" id="tnfile" title="Gửi tệp"><svg viewBox="0 0 24 24"><path d="M20.5 11.5 12 20a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.7a1.7 1.7 0 0 1-2.4-2.4L15 7.6"/></svg></button><button type="button" class="tnatt" id="tnmic" title="Ghi âm tin nhắn thoại" aria-label="Ghi âm"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg></button><input type="file" id="tnfi" hidden multiple>
      <textarea id="tnin" rows="1" placeholder="Nhắn ${esc(n)}…${g?" (@ gọi tên)":""}">${esc(TN.draft[room]||"")}</textarea><button class="btn sm pri">Gửi</button></form></div>`;
    $("#tnp-back").onclick=()=>tnPop("");
    const inp=$("#tnin"),send=async()=>{const v=inp.value.trim(),P=(TN.pend[room]||[]).slice();if(!v&&!P.length)return;tnAgentWait(room,v);inp.value="";TN.draft[room]="";
      if(P.length){TN.pend[room]=[];tnDrawPend(room);await tnUpload(room,P)}
      if(v)try{await tnSend(room,v);tnDrawMsgs();tnDrawList()}catch(e){inp.value=v;toast(e.message||"Chưa gửi được")}};
    $("#tnf").onsubmit=e=>{e.preventDefault();send()};tnBindAt(inp,$("#tnsug"),room,g,send);
    tnBindAtt(room);tnBindEmo();setTimeout(()=>inp.focus(),0);
    if(!TN.files[room])tnLoadFiles(room);
    if(!TN.msgs[room])await tnLoad(room);else tnLoad(room);if(TN.popRoom===room){tnDrawMsgs();tnRead(room)}}
  p.classList.toggle("big",!!TN.popBig);$("#tnp-big").onclick=()=>{TN.popBig=!TN.popBig;tnPop(TN.popRoom)};
  $("#tnp-x").onclick=tnPopClose;tnPopGrip(p)}

/* ---------- ghi âm tin nhắn thoại (chị Hoa 03/11): bấm 🎤 nói, bấm lại để dừng → vào khay chờ, nghe thử rồi bấm Gửi ----------
   Ghi dạng opus 24 kbps (1 phút ≈ 180 KB), tối đa 5 phút. */
let TN_REC=null;
async function tnRecToggle(room,btn){
  if(TN_REC){TN_REC.stop();return}
  if(!navigator.mediaDevices||!window.MediaRecorder){toast("Trình duyệt này chưa ghi âm được");return}
  let st;try{st=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){toast("Chưa cho phép dùng micro. Bấm biểu tượng ổ khoá cạnh địa chỉ web › Micro › Cho phép");return}
  const type=["audio/webm;codecs=opus","audio/ogg;codecs=opus","audio/mp4"].find(t=>MediaRecorder.isTypeSupported(t))||"";
  const rec=new MediaRecorder(st,type?{mimeType:type,audioBitsPerSecond:24000}:{}),parts=[],t0=Date.now();
  rec.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};
  const tick=setInterval(()=>{const s=Math.floor((Date.now()-t0)/1000);btn.dataset.t=Math.floor(s/60)+":"+String(s%60).padStart(2,"0");if(s>=300)rec.stop()},500);
  rec.onstop=()=>{clearInterval(tick);st.getTracks().forEach(t=>t.stop());btn.classList.remove("rec");delete btn.dataset.t;TN_REC=null;
    const s=Math.max(1,Math.round((Date.now()-t0)/1000)),base=(rec.mimeType||type||"audio/webm").split(";")[0],ext=base.includes("ogg")?"ogg":base.includes("mp4")?"m4a":"webm";
    if(!parts.length||s<1)return;const f=new File(parts,`Ghi âm ${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}.${ext}`,{type:base});tnAddPend(room,[f])};
  rec.start(1000);TN_REC=rec;btn.classList.add("rec");btn.title="Bấm để dừng ghi âm";toast("Đang ghi âm… bấm lại nút 🎤 để dừng")}

/* ---------- agent trong nhóm chat (chị Hoa 03/11): CEO / Lead thêm agent vào nhóm; agent chỉ trả lời khi được gọi @tên ---------- */
async function tnLoadAgents(){TN.agents=TN.agents||[];try{TN.agents=await svApi("/api/hub/chat/agents")}catch(e){}
  try{TN.myAgents=(await svApi("/api/agent-chat/agents")||{}).agents||[]}catch(e){TN.myAgents=[]}if(PAGE==="tinnhan"||TN.popOn){tnDrawList();if(TN.msgs[TN.room])tnDrawMsgs(true)}}
const tnRoomAgents=room=>((D().chatAgents||{})[room]||[]).map(id=>(TN.agents||[]).find(a=>a.id===id)).filter(Boolean);
function tnAgentRows(){const L=(TN.myAgents||[]).map(a=>(TN.agents||[]).find(x=>x.id===(a.id||a.agent))||a).filter(a=>a&&a.id);if(!L.length||(TN.q||"").trim())return "";
  return `<div class="tnagh">🤖 Chat với agent</div>${L.map(a=>`<button class="tnrow" data-tnag="${esc(a.id)}">${tnAv("agent:"+a.id,a.name)}<span class="tnrb"><span class="tnr1"><b>${esc(a.name)}</b></span><span class="tnr2"><span>${esc(a.title||"Agent")}</span></span></span></button>`).join("")}`}
function tnAgentForm(room){const cur=new Set((D().chatAgents||{})[room]||[]);
  openDrawerHTML(`<h2>🤖 Agent trong nhóm ${esc(tnName(room))}</h2><p class="hint">Agent chỉ trả lời khi có người gọi @tên (ví dụ @Lead Content). Khi được gọi, agent đọc các tin gần đây của nhóm nên không cần kể lại việc đang làm.</p>
   <form class="frm" id="tnag-f"><div class="tnagl">${(TN.agents||[]).map(a=>`<label class="ck">${tnAv("agent:"+a.id,a.name)}<input type="checkbox" name="tnag" value="${esc(a.id)}" ${cur.has(a.id)?"checked":""}> <b>${esc(a.name)}</b> <small class="hint">${esc(a.title||"")}</small></label>`).join("")}</div>
   <div class="acts"><button class="btn pri">Lưu</button></div></form>`);
  $("#tnag-f").onsubmit=e=>{e.preventDefault();const ids=[...document.querySelectorAll("[name=tnag]:checked")].map(i=>i.value);
    DB.mutate(ME.name,"agent trong nhóm chat "+tnName(room),dt=>{dt.chatAgents=dt.chatAgents||{};if(ids.length)dt.chatAgents[room]=ids;else delete dt.chatAgents[room]});
    toast(ids.length?"Đã thêm "+ids.length+" agent vào nhóm":"Đã bỏ agent khỏi nhóm");closeDrawer();renderMain()}}
/* gửi tin có gọi @agent: hiện "đang trả lời…" tới khi agent trả lời (tối đa 15 phút) */
function tnAgentWait(room,v){const A=tnRoomAgents(room).filter(a=>tnNorm(v).includes("@"+tnNorm(a.name)));if(!A.length)return;
  TN.agWait=TN.agWait||{};TN.agWait[room]=(TN.agWait[room]||[]).concat(A.map(a=>({id:a.id,at:Date.now()})))}
function tnAgentWaitHtml(room,L){const W=((TN.agWait||{})[room]||[]).filter(w=>Date.now()-w.at<15*60e3&&!L.some(m=>m.user_id==="agent:"+w.id&&Date.parse(m.created_at)>=w.at-5e3));
  if(TN.agWait)TN.agWait[room]=W;return W.map(w=>{const a=(TN.agents||[]).find(x=>x.id===w.id)||{name:"Agent"};return `<div class="tnsys tnagwait">${esc(a.emoji||"🤖")} ${esc(a.name)} đang đọc nhóm và trả lời…</div>`}).join("")}

/* ---------- chat với agent ngay trong khung Tin nhắn (chị Hoa 03/11): phòng "ag:<mã agent>" dùng /api/agent-chat ----------
   Không nhảy sang Điều hành agent. Tin agent được gọi trong nhóm (có bối cảnh nhóm) không hiện ở đây. */
TN.agRaw={};
const TN_GRP_CTX="[Bạn đang được gọi trong nhóm chat";
function tnAgMap(room){const id=room.slice(3),L=TN.agRaw[room]||[],hide=new Set(L.filter(m=>m.role==="USER"&&String(m.body).startsWith(TN_GRP_CTX)).map(m=>m.id));
  TN.msgs[room]=L.filter(m=>!hide.has(m.id)&&!hide.has(m.reply_to)).map(m=>({id:m.id,room,user_id:m.role==="USER"?tnMe():"agent:"+id,body:m.body,kind:m.role==="AGENT"?"agent":m.role==="SYSTEM"?"remind":"",created_at:m.created_at,st:m.status}));
  const last=[...L].reverse().find(m=>m.role==="USER"&&!hide.has(m.id));TN.agWait=TN.agWait||{};TN.agWait[room]=last&&["queued","taken","working"].includes(last.status)?[{id,at:Date.parse(last.created_at)}]:[]}
const _tnLoadAg=tnLoad;
tnLoad=async function(room,older){if(!String(room).startsWith("ag:"))return _tnLoadAg(room,older);if(older)return false;
  const L=TN.agRaw[room]||[],after=L.length?L[L.length-1].id:0;
  try{const r=await svApi(`/api/agent-chat?agent=${encodeURIComponent(room.slice(3))}${after?"&after="+after:""}`)||[];
    const st=L.filter(m=>m.role==="USER"&&m.status!=="done").map(m=>m.id);
    if(after&&!r.length&&!st.length){tnAgMap(room);return false}
    if(after&&st.length){const all=await svApi(`/api/agent-chat?agent=${encodeURIComponent(room.slice(3))}`)||[];TN.agRaw[room]=all}else TN.agRaw[room]=after?L.concat(r):r;
    tnAgMap(room);return true}catch(e){if(!TN.msgs[room])TN.msgs[room]=[];toast(e.message||"Chưa mở được chat với agent");return false}};
const _tnSendAg=tnSend;
tnSend=async function(room,body,kind,ref){if(!String(room).startsWith("ag:"))return _tnSendAg(room,body,kind,ref);if(kind)return null;
  await svApi("/api/agent-chat",{method:"POST",body:JSON.stringify({agent:room.slice(3),body,tg:false,files:[],docs:[]})});await tnLoad(room);return (TN.msgs[room]||[]).slice(-1)[0]};
const _tnReadAg=tnRead;tnRead=function(room){if(String(room).startsWith("ag:"))return;return _tnReadAg(room)};
const _tnUploadAg=tnUpload;tnUpload=function(room,list){if(String(room).startsWith("ag:")){toast("Gửi ảnh, tệp cho agent ở trang Điều hành agent");return Promise.resolve()}return _tnUploadAg(room,list)};
const _tnLoadFilesAg=tnLoadFiles;tnLoadFiles=function(room){if(String(room).startsWith("ag:")){TN.files[room]=[];return Promise.resolve()}return _tnLoadFilesAg(room)};
/* kéo góc trên bên trái để đổi cỡ cửa sổ chat nổi */
function tnPopGrip(p){if(p.querySelector(".tnpgrip"))return;const g=document.createElement("i");g.className="tnpgrip";g.title="Kéo để đổi cỡ";p.appendChild(g);
  if(TN.popW)p.style.width=TN.popW+"px";if(TN.popH)p.style.height=TN.popH+"px";
  g.onmousedown=e=>{e.preventDefault();const x0=e.clientX,y0=e.clientY,w0=p.offsetWidth,h0=p.offsetHeight;
    const mv=ev=>{TN.popW=Math.max(300,Math.min(innerWidth-30,w0+(x0-ev.clientX)));TN.popH=Math.max(260,Math.min(innerHeight-30,h0+(y0-ev.clientY)));p.style.width=TN.popW+"px";p.style.height=TN.popH+"px"};
    const up=()=>{removeEventListener("mousemove",mv);removeEventListener("mouseup",up)};addEventListener("mousemove",mv);addEventListener("mouseup",up)}}
