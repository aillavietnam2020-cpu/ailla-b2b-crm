/* =====================================================================
   TRAO ĐỔI NỘI BỘ + THÔNG BÁO TỪNG NGƯỜI + GIỮ TRANG KHI F5
   - Chat chung: khung bên phải mở từ thanh trên cùng (💬), có nhóm Chung / Content & Media / Digital, gọi tên @Lead Content & Media.
   - Trao đổi trong từng thẻ video: ở cuối cửa sổ thẻ, báo cho người làm thẻ và người được gọi tên.
   - Chuông 🔔: thông báo của riêng mình (việc mới giao, video chờ duyệt, bị trả về sửa, Worker xong bản nháp…),
     bấm vào mở đúng thẻ. Máy đang mở web thì hiện thông báo của trình duyệt khi có tin mới.
   - F5: tab đang mở giữ nguyên trang đang làm (mở web mới / đăng nhập lại thì vẫn vào trang chủ).
   Dữ liệu nằm trong dữ liệu chung của web (5 giây đồng bộ một lần): d.notifs, d.chat, d.chatRead.
   ===================================================================== */
const CH_ROOMS=[["chung","Chung"],["content","Content & Media"],["digital","Digital"]];
/* Nhắn riêng: phòng "dm:<id>~<id>" (2 mã người xếp theo thứ tự) */
const dmKey=u=>"dm:"+[ME.id,u].sort().join("~");
const dmOther=k=>k.startsWith("dm:")?k.slice(3).split("~").find(x=>x!==ME.id):"";
const chPeople=()=>ME&&DB.data?D().users.filter(u=>u.active&&u.id!==ME.id&&u.name):[];
const chRooms=()=>CH_ROOMS.concat(chPeople().map(u=>[dmKey(u.id),u.name]));
const roomName=k=>k.startsWith("dm:")?"nhắn riêng với "+(userName(dmOther(k))||""):"nhóm "+((CH_ROOMS.find(r=>r[0]===k)||[])[1]||k);
const CH_KEEP=300,NT_KEEP=600;
const nowISO=()=>new Date().toISOString();
const agoTxt=t=>{const s=(Date.now()-new Date(t).getTime())/1000;return s<60?"vừa xong":s<3600?Math.floor(s/60)+" phút trước":s<86400?Math.floor(s/3600)+" giờ trước":new Date(t).toLocaleDateString("vi-VN").slice(0,5)};

/* ---------- Thông báo ---------- */
function notifyU(dt,ids,text,ref){const me=ME&&ME.id;dt.notifs=dt.notifs||[];[...new Set([].concat(ids).filter(Boolean))].forEach(to=>{if(to===me)return;dt.notifs.push({id:uid("nt"),to,text,at:nowISO(),ref:ref||"",by:me||"",read:false})});if(dt.notifs.length>NT_KEEP)dt.notifs=dt.notifs.slice(-NT_KEEP)}
const myNotifs=()=>(D()&&D().notifs||[]).filter(n=>ME&&n.to===ME.id).slice().reverse();
const myUnread=()=>myNotifs().filter(n=>!n.read).length;
const approvers=()=>{const r=D().users.filter(u=>u.active&&(u.perms||[]).includes("viec.duyet")&&u.role==="lead").map(u=>u.id);return r.length?r:D().users.filter(u=>u.active&&u.role==="admin").map(u=>u.id)};
const admins=()=>D().users.filter(u=>u.active&&u.role==="admin").map(u=>u.id);
const cardLbl=c=>{const t=D().tuyen.find(x=>x.ma===c.maTuyen);return `${sk(c.sku).n}${t?" · "+t.tuyen:""} (${c.id})`};
/* Sự kiện của thẻ video → báo đúng người */
const _mvNt=moveCard;
moveCard=function(u,id,to,inp){const c=D().cards.find(x=>x.id===id),from=c&&c.step,e=_mvNt(u,id,to,inp);
  if(!e&&c&&from!==to){const L=cardLbl(c),who=u.name;DB.mutate(who,"thông báo "+id,dt=>{const x=dt.cards.find(y=>y.id===id)||c;
    if(to==="dkb"||to==="dvd"){x.duyet="Chưa duyệt";x.ceo="CẦN KIỂM TRA"}else if(to==="dceo"){x.ceo="CẦN KIỂM TRA"}
    if(to==="dkb")notifyU(dt,approvers(),`${who} gửi ${x.oneShot?"hook":"kịch bản"} chờ duyệt: ${L}`,id);
    else if(to==="dvd"&&!(typeof isApprover==="function"&&isApprover(u)))notifyU(dt,approvers(),`Video mới ${who} vừa làm xong, cần duyệt: ${L}`,id);
    else if(to==="dceo")notifyU(dt,admins(),`Video chờ CEO duyệt: ${L} (${who} đã duyệt)`,id);
    else if(to==="dang"){const o=((dt.kenhPT||{})[x.kenh]||{}).chinh;notifyU(dt,[o],`Video đã duyệt xong, chờ bạn đăng: ${L}`,id)}
    else if(from==="dkb"&&to==="quay")notifyU(dt,[x.nguoiKB||x.nguoi],`${x.oneShot?"Hook":"Kịch bản"} đã được duyệt: ${L}`,id);
    if(x.tre&&x.tre.st==="cho"&&x.tre.by===who)notifyU(dt,approvers(),`${who} nộp trễ hạn (${x.tre.buoc}): ${x.tre.lyDo} · ${L}`,id)})}
  return e};
const _sbNt=sendBack;
sendBack=function(u,id,note){const c=D().cards.find(x=>x.id===id);const r=_sbNt(u,id,note);if(c)DB.mutate(u.name,"thông báo trả về "+id,dt=>notifyU(dt,[c.nguoiEdit,c.nguoiKB,c.nguoi,c.giao],`${u.name} trả về sửa: ${note||"cần sửa"} · ${cardLbl(c)}`,id));return r};
const _wpaNt=wpAssign;
wpAssign=function(sku,kenh,t,u,n,w,bd,hn,note){if(t==="ton"){const ow=chanOwner(kenh);if(ow&&pvAvailUid(ow,hn||defHan(D(),null,t)))u=ow}const before=new Set(D().cards.map(c=>c.id)),r=_wpaNt(sku,kenh,t,u,n,w,bd,hn,note);const nw=D().cards.filter(c=>!before.has(c.id));const lb=(MIX.find(z=>z[0]===t)||[])[1]||"";
  DB.mutate(ME.name,"thông báo giao việc",dt=>notifyU(dt,[u],`${ME.name} giao bạn ${n} video ${lb} · ${sk(sku).n} · ${chOf(kenh).short}${hn?" · hạn "+dd(hn):""}${note&&note.trim()?" · Note: "+note.trim():""}`,nw[0]?nw[0].id:""));return r};
const _xvaNt=xvAssign;
xvAssign=function(ids,to,kind){_xvaNt(ids,to,kind);DB.mutate(ME.name,"thông báo giao việc",dt=>notifyU(dt,[to],`${ME.name} giao bạn ${ids.length} việc ${kind}`,ids[0]))};

/* Chuông: bảng thông báo */
function openNotifs(){
  let p=$("#ntp");if(p){p.remove();return}
  p=document.createElement("div");p.id="ntp";p.className="ntp";document.body.appendChild(p);
  const draw=()=>{const L=myNotifs().slice(0,60),al=APP_MODE==="admin"&&typeof execAlerts==="function"?execAlerts().length:0;
    p.innerHTML=`<div class="ntph"><b>Thông báo</b>${myUnread()?`<button class="lnk" id="nt-all">Đánh dấu đã đọc hết</button>`:""}<button class="lnk" id="nt-x">Đóng</button></div>
    ${al?`<button class="ntal" id="nt-exec">⚠️ ${al} cảnh báo điều hành →</button>`:""}
    ${"Notification" in window&&Notification.permission==="default"?`<button class="ntal" id="nt-perm">🔔 Bật thông báo trên máy tính này</button>`:""}
    <div class="ntl">${L.map(n=>`<button class="nti${n.read?"":" un"}" data-nt="${n.id}"><span>${esc(n.text)}</span><small>${agoTxt(n.at)}</small></button>`).join("")||`<p class="hint" style="padding:12px">Chưa có thông báo.</p>`}</div>`;
    $("#nt-x").onclick=()=>p.remove();
    if($("#nt-exec"))$("#nt-exec").onclick=()=>{p.remove();MOD="exec";PAGE="exec";render()};
    if($("#nt-perm"))$("#nt-perm").onclick=()=>Notification.requestPermission().then(()=>draw());
    if($("#nt-all"))$("#nt-all").onclick=()=>{DB.mutate(ME.name,"đọc thông báo",dt=>(dt.notifs||[]).forEach(n=>{if(n.to===ME.id)n.read=true}));draw();bellBadge()};
    p.querySelectorAll("[data-nt]").forEach(b=>b.onclick=()=>{const n=myNotifs().find(x=>x.id===b.dataset.nt);p.remove();ntGo(n)})};
  draw();
}
function bellBadge(){const b=document.querySelector(".bell");if(!b)return;const al=APP_MODE==="admin"&&typeof execAlerts==="function"?execAlerts().length:0,n=myUnread()+al;let s=b.querySelector("b");if(n){if(!s){s=document.createElement("b");b.appendChild(s)}s.textContent=n}else if(s)s.remove();
  const c=$("#chatbtn");if(c){const u=chUnreadAll();let t=c.querySelector("b");if(u){if(!t){t=document.createElement("b");c.appendChild(t)}t.textContent=u}else if(t)t.remove()}}

/* Bấm một thông báo: đánh dấu đã đọc, mở đúng chỗ (thẻ video, phòng chat, trang) */
function ntGo(n){if(!n)return;if(n.id)DB.mutate(ME.name,"đọc thông báo",dt=>{const x=(dt.notifs||[]).find(y=>y.id===n.id);if(x)x.read=true});bellBadge();
  if(n.ref&&D().cards.some(c=>c.id===n.ref))openCard(n.ref);else if(n.ref&&n.ref.startsWith("room:"))openChat(n.ref.slice(5));
  else if(n.ref&&n.ref.startsWith("task:")&&typeof openTask==="function")openTask(n.ref.slice(5));
  else if(n.ref&&n.ref.startsWith("page:")){PAGE=n.ref.slice(5);if(APP_MODE==="admin"&&typeof modGroups==="function"&&!modGroups(curMod()).some(g=>g[1].some(i=>i[0]===PAGE)))MOD="";render()}}
/* Thông báo bật lên ở góc dưới màn hình (tự ẩn sau 12 giây, bấm vào để mở) */
function ntPop(n){let w=$("#ntpop");if(!w){w=document.createElement("div");w.id="ntpop";w.className="ntpop";document.body.appendChild(w)}
  const e=document.createElement("div");e.className="ntpc";e.innerHTML=`<button class="ntpx" aria-label="Đóng">✕</button><b>🔔 Thông báo</b><span>${esc(n.text)}</span><small>bấm để mở</small>`;
  e.onclick=ev=>{e.remove();if(ev.target.closest(".ntpx"))return;ntGo(n)};w.appendChild(e);while(w.children.length>4)w.firstChild.remove();setTimeout(()=>e.remove(),12000)}

/* ---------- Chat chung ---------- */
let CH_ROOM="chung";
const chMsgs=k=>((D()&&D().chat||{})[k]||[]);
const chReadAt=k=>(((D()&&D().chatRead||{})[ME&&ME.id]||{})[k])||"";
const chUnread=k=>chMsgs(k).filter(m=>m.by!==(ME&&ME.id)&&m.t>chReadAt(k)).length;
const chUnreadAll=()=>ME?chRooms().reduce((a,[k])=>a+chUnread(k),0):0;
const mentions=text=>D().users.filter(u=>u.active&&u.name&&new RegExp("@"+u.name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(?![\\p{L}\\d])","iu").test(text)).map(u=>u.id);
const linkify=t=>esc(t).replace(/https?:\/\/[^\s<]+/g,m=>`<a href="${m}" target="_blank" rel="noopener">${m.length>48?m.slice(0,48)+"…":m}</a>`).replace(/@([\p{L}\d ]{1,20}?)(?=[\s,.!?:]|$)/gu,(m,n)=>D().users.some(u=>u.name&&u.name.toLowerCase()===n.toLowerCase())?`<b class="chm">${m}</b>`:m);
function openChat(room){
  if(room)CH_ROOM=room;let p=$("#chp");if(!p){p=document.createElement("div");p.id="chp";p.className="chp";document.body.appendChild(p)}
  const draw=()=>{const M=chMsgs(CH_ROOM).slice(-120);
    p.innerHTML=`<div class="chph"><b>Trao đổi nội bộ</b><button class="lnk" id="ch-x">Đóng</button></div>
     <div class="seg chtabs">${CH_ROOMS.map(([k,n])=>`<button class="${k===CH_ROOM?"on":""}" data-chr="${k}">${n}${k!==CH_ROOM&&chUnread(k)?` <span class="xbadge">${chUnread(k)}</span>`:""}</button>`).join("")}</div>
     <div class="chdm"><small>Nhắn riêng:</small>${chPeople().map(u=>{const k=dmKey(u.id),n=chUnread(k);return `<button type="button" class="chdmb${k===CH_ROOM?" on":""}" data-chr="${k}" title="Nhắn riêng với ${esc(u.name)}"><i>${esc((u.name.split(" ").pop()||"?")[0])}</i>${esc(u.name)}${k!==CH_ROOM&&n?` <span class="xbadge">${n}</span>`:""}</button>`}).join("")}</div>
     ${CH_ROOM.startsWith("dm:")?`<div class="chdmh">Nhắn riêng với <b>${esc(userName(dmOther(CH_ROOM)))}</b> · chỉ hiện cho hai người</div>`:""}
     <div class="chl" id="chl">${M.map(m=>`<div class="chmsg${m.by===ME.id?" me":""}"><div class="chw"><b>${esc(userName(m.by)||m.who||"")}</b><small>${agoTxt(m.t)}</small></div><div class="chtx">${linkify(m.text)}</div></div>`).join("")||`<p class="hint" style="padding:16px">Chưa có tin nhắn. Gõ @tên để gọi người, người đó sẽ nhận thông báo.</p>`}</div>
     <form class="chf" id="chf"><textarea id="ch-in" rows="2" placeholder="${CH_ROOM.startsWith("dm:")?"Nhắn riêng cho "+esc(userName(dmOther(CH_ROOM)))+"… Enter để gửi":"Nhắn cho nhóm… gõ @Lead Content & Media để gọi tên · Enter để gửi, Shift+Enter xuống dòng"}"></textarea><button class="btn pri">Gửi</button></form>
     ${CH_ROOM.startsWith("dm:")?"":`<div class="chwho">${D().users.filter(u=>u.active&&u.id!==ME.id&&u.name).slice(0,14).map(u=>`<button type="button" class="chip" data-at="${esc(u.name)}">@${esc(u.name)}</button>`).join("")}</div>`}`;
    const l=$("#chl");l.scrollTop=l.scrollHeight;
    $("#ch-x").onclick=()=>p.remove();
    p.querySelectorAll("[data-chr]").forEach(b=>b.onclick=()=>{CH_ROOM=b.dataset.chr;markRead();draw()});
    p.querySelectorAll("[data-at]").forEach(b=>b.onclick=()=>{const i=$("#ch-in");i.value+=(i.value&&!/\s$/.test(i.value)?" ":"")+"@"+b.dataset.at+" ";i.focus()});
    const send=()=>{const v=$("#ch-in").value.trim();if(!v)return;const room=CH_ROOM,rn=(CH_ROOMS.find(r=>r[0]===room)||[])[1],dm=dmOther(room);
      DB.mutate(ME.name,dm?"nhắn riêng":"nhắn nhóm "+rn,dt=>{dt.chat=dt.chat||{};const L=dt.chat[room]=dt.chat[room]||[];L.push({id:uid("cm"),by:ME.id,who:ME.name,t:nowISO(),text:v});if(L.length>CH_KEEP)dt.chat[room]=L.slice(-CH_KEEP);
        dt.chatRead=dt.chatRead||{};(dt.chatRead[ME.id]=dt.chatRead[ME.id]||{})[room]=nowISO();
        if(dm)notifyU(dt,[dm],`💬 ${ME.name} nhắn riêng: ${v.slice(0,120)}`,"room:"+room);else notifyU(dt,mentions(v),`${ME.name} gọi bạn trong nhóm ${rn}: ${v.slice(0,120)}`,"room:"+room)});draw();bellBadge()};
    $("#chf").onsubmit=e=>{e.preventDefault();send()};
    $("#ch-in").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}};
    $("#ch-in").focus()};
  const markRead=()=>{if(!chUnread(CH_ROOM))return;DB.mutate(ME.name,"đọc tin nhắn",dt=>{dt.chatRead=dt.chatRead||{};(dt.chatRead[ME.id]=dt.chatRead[ME.id]||{})[CH_ROOM]=nowISO()})};
  markRead();draw();bellBadge();p._draw=draw;
}

/* ---------- Trao đổi trong từng thẻ video ---------- */
function threadHtml(c){const M=(c.chat||[]).slice(-50);return `<div class="fgrp cthr"><h3>Trao đổi</h3><div class="chl small">${M.map(m=>`<div class="chmsg${m.by===ME.id?" me":""}"><div class="chw"><b>${esc(userName(m.by)||m.who||"")}</b><small>${agoTxt(m.t)}</small></div><div class="chtx">${linkify(m.text)}</div></div>`).join("")||`<p class="hint">Chưa có trao đổi. Hỏi đáp, góp ý về video này ghi ở đây, người làm thẻ sẽ nhận thông báo.</p>`}</div>
  <form class="chf" id="cth-f"><textarea id="cth-in" rows="2" placeholder="Nhắn về video này… @tên để gọi người"></textarea><button class="btn sm pri">Gửi</button></form></div>`}
function bindThread(c){const f=$("#cth-f");if(!f)return;const send=()=>{const v=$("#cth-in").value.trim();if(!v)return;
  DB.mutate(ME.name,"trao đổi thẻ "+c.id,dt=>{const x=dt.cards.find(y=>y.id===c.id);if(!x)return;x.chat=(x.chat||[]).concat({id:uid("cm"),by:ME.id,who:ME.name,t:nowISO(),text:v}).slice(-100);
    const ppl=[x.nguoi,x.giao,x.nguoiKB,x.nguoiEdit,...(x.chat||[]).map(m=>m.by),...mentions(v)];notifyU(dt,ppl,`${ME.name} nhắn về ${cardLbl(x)}: ${v.slice(0,120)}`,x.id)});
  openCard(c.id)};f.onsubmit=e=>{e.preventDefault();send()};$("#cth-in").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}}
const _ocChat=openCard;
openCard=function(id,o){_ocChat(id,o);const c=D().cards.find(x=>x.id===id),di=$("#drawerIn");if(!c||!di||$("#cth-f"))return;di.insertAdjacentHTML("beforeend",threadHtml(c));bindThread(c);const l=di.querySelector(".cthr .chl");if(l)l.scrollTop=l.scrollHeight};

/* ---------- Có tin mới (từ máy chủ) → báo trên màn hình + thông báo trình duyệt ---------- */
const _swNt=svWatch;
svWatch=function(){const r=_swNt();if(ME&&D()){r.nt=myNotifs().filter(n=>!n.read).map(n=>n.id);r.ch=chRooms().map(([k])=>k+":"+chMsgs(k).length)}return r};
const _snNt=svNotify;
svNotify=function(a,b){_snNt(a,b);if(!ME||!b||!b.nt)return;const neu=(b.nt||[]).filter(x=>!(a.nt||[]).includes(x)),L=myNotifs().filter(n=>neu.includes(n.id));
  const chNew=CH_ROOMS.filter(([k])=>chUnread(k)&&!(a.ch||[]).includes(k+":"+chMsgs(k).length));
  const msg=L.map(n=>n.text).concat(chNew.length?["Tin nhắn mới trong nhóm "+chNew.map(r=>r[1]).join(", ")]:[]);
  if(msg.length){L.forEach(n=>ntPop(n));chNew.forEach(([k,nm])=>{const m=chMsgs(k).slice(-1)[0];if(m&&!L.some(n=>n.ref==="room:"+k))ntPop({id:"",text:`💬 ${userName(m.by)||m.who} (nhóm ${nm}): ${String(m.text).slice(0,120)}`,ref:"room:"+k,at:m.t})});try{if(document.hidden&&"Notification" in window&&Notification.permission==="granted")new Notification("Trang quản trị Ailla",{body:msg.join("\n")})}catch(e){}}
  bellBadge();const p=$("#chp");if(p&&p._draw&&!(document.activeElement&&document.activeElement.id==="ch-in"&&document.activeElement.value))p._draw()};

/* ---------- Giữ trang khi F5 (chỉ trong tab đang mở) ---------- */
const VIEW_KEY="ailla_view";
/* những biến chọn tab con / bộ lọc cần nhớ để tải lại trang vẫn về đúng chỗ */
const VW_GET=()=>{const g=f=>{try{return f()}catch(e){return undefined}};return {xv:g(()=>XV.tab),xks:g(()=>XV.ks),xst:g(()=>XV.khoSt),xkk:g(()=>XV.ktK),xksu:g(()=>XV.khoSku),xdk:g(()=>XV.dnK),xds:g(()=>XV.dnS),wpk:g(()=>WP_K),bvk:g(()=>BV.k),bvs:g(()=>BV.sku),bvt:g(()=>BV.t),tqk:g(()=>TQ_K),ptk:g(()=>PT_K),dg:g(()=>DG)}};
function saveView(){if(!ME)return;try{sessionStorage.setItem(VIEW_KEY,JSON.stringify(Object.assign({u:ME.id,MOD,PAGE,STEP:typeof STEP!=="undefined"?STEP:1,SUB:typeof SUB!=="undefined"?SUB:{}},VW_GET())))}catch(e){}}
let _scrY=null;
function restoreView(){try{const v=JSON.parse(sessionStorage.getItem(VIEW_KEY)||"null");if(!v||!ME||v.u!==ME.id||!v.PAGE||!PAGES[v.PAGE])return;MOD=v.MOD||"";PAGE=v.PAGE;if(v.STEP)STEP=v.STEP;if(v.SUB&&typeof SUB!=="undefined")Object.assign(SUB,v.SUB);
  const S=(c,x)=>{try{if(x!==undefined&&x!==null)c(x)}catch(e){}};
  S(x=>XV.tab=x,v.xv);S(x=>XV.ks=x,v.xks);S(x=>XV.khoSt=x,v.xst);S(x=>XV.ktK=x,v.xkk);S(x=>XV.khoSku=x,v.xksu);S(x=>XV.dnK=x,v.xdk);S(x=>XV.dnS=x,v.xds);S(x=>WP_K=x,v.wpk);S(x=>BV.k=x,v.bvk);S(x=>BV.sku=x,v.bvs);S(x=>BV.t=x,v.bvt);S(x=>TQ_K=x,v.tqk);S(x=>PT_K=x,v.ptk);S(x=>Object.assign(DG,x),v.dg);
  const sy=+sessionStorage.getItem(VIEW_KEY+"_y");if(sy>0)_scrY={y:sy,t:Date.now()}}catch(e){}}
/* nhớ vị trí cuộn; trong vài giây đầu sau khi mở lại thì chưa ghi đè để còn trả về đúng chỗ */
window.addEventListener("scroll",()=>{if(!ME||(_scrY&&Date.now()-_scrY.t<4500))return;try{sessionStorage.setItem(VIEW_KEY+"_y",String(Math.round(window.scrollY)))}catch(e){}},{passive:true});
["wheel","touchstart","keydown","mousedown"].forEach(ev=>window.addEventListener(ev,()=>{_scrY=null},{passive:true,capture:true}));
const _backScr=()=>{if(_scrY&&Date.now()-_scrY.t<4500){window.scrollTo(0,_scrY.y);setTimeout(()=>{if(_scrY)window.scrollTo(0,_scrY.y)},400)}};
const _renderView=render;
render=function(){_renderView();saveView();_backScr();if(ME){bellBadge();const b=document.querySelector(".bell");if(b)b.onclick=e=>{e.preventDefault();e.stopPropagation();openNotifs()};const c=$("#chatbtn");if(c)c.onclick=()=>{$("#chp")?$("#chp").remove():openChat()}}};
const _renderMainView=renderMain;
renderMain=function(){_renderMainView();saveView();_backScr()};

/* Mở web mà còn thông báo chưa đọc: bật lên một lần ở góc dưới */
let NT_FIRST=false;
setInterval(()=>{if(NT_FIRST||!ME||!DB.data)return;NT_FIRST=true;const L=myNotifs().filter(n=>!n.read);if(!L.length)return;
  if(L.length===1)ntPop(L[0]);else ntPop({id:"",text:`Bạn có ${L.length} thông báo chưa đọc. Mới nhất: ${L[0].text}`,ref:""})},1500);
