/* =====================================================================
   KHÔNG GIAN PHÒNG (chị Hoa 02/11/2026, học Lark): mỗi phòng ban một trang gom đủ chỗ làm việc của phòng.
   - Việc của phòng (Task giao việc + thẻ video nếu là Content), dự án của phòng, nhóm chat phòng (tinnhan.js),
     thư mục Drive phòng (thumuc.js, chỉ xem), mẫu việc của phòng. Không có số liệu riêng: đọc lại đúng chỗ gốc.
   - Phòng = mã phòng ban của nhân sự (D().departments, giống thư mục Drive). Nhân sự xem phòng mình; CEO, Ban điều hành chọn phòng khác.
   ===================================================================== */
const KPB={pb:"",msgs:{},files:{}};
/* mã phòng ban → nhóm việc (TEAMS) và nhóm chat */
const KPB_TEAM={CM:"content",ADS:"digital",KOC:"koc",KT:"ketoan",KV:"kho",SX:"sx",HCNS:"hcns",B2B:"sale",B2C:"sale"};
const kpbDepts=()=>((D().departments||[]).filter(p=>p&&p.k&&p.k!=="BDH"));
const kpbName=pb=>((kpbDepts().find(p=>p.k===pb)||{}).n)||TEAMS[KPB_TEAM[pb]]||pb;
const kpbTeam=pb=>KPB_TEAM[pb]||String(pb).toLowerCase().replace(/[^a-z0-9_-]/g,"");
const kpbAll=()=>!!ME&&(ME.role==="admin"||ME.phongBan==="BDH");
const kpbMembers=pb=>D().users.filter(u=>u.active&&u.name&&(u.phongBan===pb||(!u.phongBan&&teamOf(u)===kpbTeam(pb))));
function kpbItems(pb){const T=kpbTeam(pb),ids=new Set(kpbMembers(pb).map(u=>u.id));
  return cvItems().filter(x=>x.team===T||(x.src==="task"&&ids.has(x.nguoi))).filter(x=>!CV_TEST.includes(x.nguoi))}
async function kpbLoad(pb){const room="g:"+kpbTeam(pb);
  if(!KPB.msgs[room])svApi("/api/hub/chat/msgs?room="+encodeURIComponent(room)).then(r=>{KPB.msgs[room]=r||[];if(PAGE==="cv_pb")renderMain()}).catch(()=>{KPB.msgs[room]=[]});
  if(!KPB.files[pb])svApi("/api/drive/find?pb="+encodeURIComponent(pb)).then(r=>{KPB.files[pb]=r||{};if(PAGE==="cv_pb")renderMain()}).catch(e=>{KPB.files[pb]={err:e.message||"Chưa mở được"};if(PAGE==="cv_pb")renderMain()})}
function pKhongGian(m){
  const D0=kpbDepts();if(!KPB.pb)KPB.pb=(ME.phongBan&&ME.phongBan!=="BDH"&&D0.some(p=>p.k===ME.phongBan)?ME.phongBan:(D0[0]||{}).k)||"CM";
  if(!kpbAll()&&ME.phongBan&&ME.phongBan!=="BDH")KPB.pb=ME.phongBan;
  const pb=KPB.pb,T=kpbTeam(pb),room="g:"+T,td=D().settings.today;kpbLoad(pb);
  const mem=kpbMembers(pb),L=kpbItems(pb),open=L.filter(x=>x.st!=="done"),late=open.filter(x=>x.late),rv=open.filter(x=>x.st==="review");
  const G=typeof cvGroup==="function"?cvGroup(open):open,rows=G.sort((a,b)=>(b.late-a.late)||(a.han||99)-(b.han||99)).slice(0,12);
  const P=(D().projects||[]).filter(p=>p.team===T);
  const tpl=tkTpls().filter(p=>p.team===T);
  const M=(KPB.msgs[room]||[]).slice(-8),F=KPB.files[pb];
  const load=mem.map(u=>({u,n:open.filter(x=>x.nguoi===u.id).length,t:late.filter(x=>x.nguoi===u.id).length})).sort((a,b)=>b.n-a.n);
  const chips=kpbAll()?`<div class="kgsel">${D0.map(p=>`<button type="button" class="${p.k===pb?"on":""}" data-kgpb="${esc(p.k)}">${esc(p.n)}</button>`).join("")}</div>`:"";
  m.innerHTML=`${chips}<div class="kghd"><div><h2>${esc(kpbName(pb))}</h2><span class="kgmem">${mem.slice(0,12).map(u=>avatar(u.id)).join("")} <small>${mem.length} người</small></span></div>
    <div class="kgk"><span><b>${open.length}</b>việc đang mở</span><span class="${late.length?"r":""}"><b>${late.length}</b>trễ hạn</span><span class="${rv.length?"a":""}"><b>${rv.length}</b>chờ duyệt</span><span><b>${P.length}</b>dự án</span></div></div>
   <div class="kgg">
    <div class="kgc">
     <section class="card kgs"><div class="kgsh"><h3>📋 Việc của phòng</h3><span class="sp"></span><button type="button" class="btn sm pri" id="kg-new">＋ Giao việc</button><button type="button" class="btn sm" id="kg-all">Xem tất cả</button></div>
      ${rows.length?`<div class="kgl">${rows.map(x=>`<button type="button" class="kgr" data-kgo="${esc(x.src)}|${esc(x.ids?x.ids[0]:x.id)}">${avatar(x.nguoi)}<span class="kgrt"><b>${esc(cvShort(String(x.ten||""),70))}${x.n>1?` <small>× ${x.n}</small>`:""}</b><small>${esc(userName(x.nguoi)||"Chưa giao")} · ${esc(cvStN(x.st))}</small></span><span class="kgrh${x.late?" r":""}">${x.late?"trễ "+x.lateD+" ngày":x.han?(x.han===td?"hạn hôm nay":"hạn "+dd(x.han)):"—"}</span></button>`).join("")}</div>`:`<p class="hint">Phòng chưa có việc đang mở.</p>`}</section>
     <section class="card kgs"><div class="kgsh"><h3>👥 Từng người</h3></div>${load.length?`<div class="kgp">${load.map(o=>`<span>${avatar(o.u.id)}<b>${esc(o.u.name)}</b> ${o.n} việc${o.t?` · <em>${o.t} trễ</em>`:""}</span>`).join("")}</div>`:`<p class="hint">Chưa có nhân sự nào thuộc phòng này.</p>`}</section>
     <section class="card kgs"><div class="kgsh"><h3>▣ Dự án của phòng</h3><span class="sp"></span><button type="button" class="btn sm" id="kg-da">Mở Dự án</button></div>${P.length?P.map(p=>{const s=prjStats(p);return `<div class="kgda"><div><b>${esc(p.ten)}</b><small>${esc(userName(p.owner)||"")} · hạn ${dd(p.han)} · ${s.done}/${s.L.length} việc xong${s.late?` · <em>${s.late} trễ</em>`:""}</small></div><div class="progress"><i style="width:${s.pc2}%"></i></div><b>${s.pc2}%</b></div>`}).join(""):`<p class="hint">Chưa có dự án nào của phòng.</p>`}</section>
    </div>
    <div class="kgc">
     <section class="card kgs"><div class="kgsh"><h3>💬 Nhóm chat phòng</h3><span class="sp"></span><button type="button" class="btn sm" id="kg-chat">Mở Tin nhắn</button></div>
      <div class="kgm">${KPB.msgs[room]?(M.length?M.map(x=>`<div class="kgmm"><b>${esc((typeof tnUN==="function"?tnUN(x.user_id):"")||"")}</b> <small>${typeof tnTime==="function"?tnTime(x.created_at):""}</small><div>${x.kind==="task"?"📋 ":x.kind==="remind"?"⏰ ":""}${esc(String(x.body).slice(0,160))}</div></div>`).join(""):`<p class="hint">Nhóm chưa có tin nhắn.</p>`):`<p class="hint">Đang tải…</p>`}</div>
      <form class="kgf" id="kg-f"><input id="kg-in" placeholder="Nhắn cho cả phòng…"><button class="btn sm pri">Gửi</button></form></section>
     <section class="card kgs"><div class="kgsh"><h3>📁 Thư mục Drive phòng</h3><span class="sp"></span><button type="button" class="btn sm" id="kg-drive">Mở thư mục</button></div>
      ${!F?`<p class="hint">Đang tải…</p>`:F.err?`<p class="hint">${esc(F.err)}</p>`:(F.files||[]).length?`<div class="kgdf">${F.files.slice(0,6).map(f=>`<a href="${esc(f.link)}" target="_blank" rel="noopener">${typeof tmIc==="function"?tmIc(f.kind):""}<span><b>${esc(f.name)}</b><small>${esc(f.by||"")} · ${typeof tmTime==="function"?tmTime(f.modified):""}</small></span></a>`).join("")}</div>`:`<p class="hint">Chưa có tệp nào, hoặc phòng chưa được gán thư mục.</p>`}</section>
     <section class="card kgs"><div class="kgsh"><h3>🧩 Mẫu việc của phòng</h3></div>${tpl.length?`<div class="kgt">${tpl.map(p=>`<div><span><b>${esc(p.ten)}</b><small>${p.lap?esc(tkLapLbl(p)):"dùng khi cần"}${p.nguoi?" · "+esc(userName(p.nguoi)||""):""}</small></span><button type="button" class="btn sm" data-kgtpl="${esc(p.id)}">Giao từ mẫu</button></div>`).join("")}</div>`:`<p class="hint">Chưa có mẫu việc. Khi giao việc, tích "Lưu làm mẫu việc" để dùng lại.</p>`}</section>
    </div></div>`;
  m.querySelectorAll("[data-kgpb]").forEach(b=>b.onclick=()=>{KPB.pb=b.dataset.kgpb;renderMain()});
  m.querySelectorAll("[data-kgo]").forEach(b=>b.onclick=()=>{const [s,id]=b.dataset.kgo.split("|");if(s==="task")openTask(id);else if(s==="card")openCard(id)});
  const team=()=>{const e=$("#t-team");if(e&&!e.disabled&&[...e.options].some(o=>o.value===T))e.value=T};
  $("#kg-new").onclick=()=>{openTask(null);team()};
  $("#kg-all").onclick=()=>{CVV.view="list";CVV.scope="team";cvWhoSet("all");CVF.st="";CVF.team=T;PAGE="cv_v";render()};
  $("#kg-da").onclick=()=>{PAGE="cv_da";render()};
  $("#kg-chat").onclick=()=>openChat(room);
  $("#kg-drive").onclick=()=>{if(typeof TM!=="undefined"){TM.pb=pb;TM.folder="";TM.list=null;TM.listKey=""}ntPage("thumuc")};
  m.querySelectorAll("[data-kgtpl]").forEach(b=>b.onclick=()=>{openTask(null);const s=$("#t-tpl");if(s){s.value=b.dataset.kgtpl;s.onchange&&s.onchange()}});
  $("#kg-f").onsubmit=async e=>{e.preventDefault();const v=$("#kg-in").value.trim();if(!v)return;
    try{const x=await tnSend(room,v);(KPB.msgs[room]=KPB.msgs[room]||[]).push(x);renderMain()}catch(er){toast(er.message||"Chưa gửi được")}};
}
PAGES.cv_pb=m=>{try{pKhongGian(m)}catch(e){console.error("Không gian phòng lỗi",e);m.innerHTML=`<div class="note red"><b>Trang chưa hiện được.</b> ${esc(String(e&&e.message||e))}</div>`}};
