/* =====================================================================
   KHÔNG GIAN PHÒNG (chị Hoa 02/11/2026, học Lark): mỗi phòng ban một trang gom đủ chỗ làm việc của phòng, không nhảy sang trang khác.
   - Việc của phòng (Task giao việc + thẻ video nếu là Content): bấm "Xem tất cả" / "việc chưa giao" mở ngay tại đây.
   - Dự án của phòng (gồm dự án liên phòng mà phòng tham gia: p.teams), chat: nhóm phòng, nhóm từng dự án, nhắn riêng từng người (tinnhan.js).
   - Thư mục Drive: tệp mới sửa; "Mở thư mục" mở trang Thư mục chỉ gồm tư liệu chung + thư mục phòng + thư mục dự án (thumuc.js, TM.scope).
   - Mẫu & SOP của phòng: tài liệu team ở Thư viện Đào tạo (daotao.js, Lead soạn, CEO duyệt) — SOP / biểu mẫu; thêm mẫu việc giao nhanh.
   - Phòng = mã phòng ban của nhân sự (D().departments, giống thư mục Drive). Nhân sự xem phòng mình; CEO, Ban điều hành chọn phòng khác.
   ===================================================================== */
const KPB={dirs:{},teams:null,pb:"",msgs:{},files:{},more:false,cg:false,chat:"",doc:"sop"};
/* mã phòng ban → nhóm việc (TEAMS) và nhóm chat */
const KPB_TEAM={CM:"content",ADS:"digital",KOC:"koc",KT:"ketoan",KV:"kho",SX:"sx",HCNS:"hcns",B2B:"sale",B2C:"sale"};
const KPB_ORD=["CM","ADS","KOC","B2C","B2B","CSKH","KT","SX","KV","HCNS"];
const kpbDepts=()=>((D().departments||[]).filter(p=>p&&p.k&&p.k!=="BDH").sort((a,b)=>(KPB_ORD.indexOf(a.k)+99)%109-(KPB_ORD.indexOf(b.k)+99)%109));
const kpbName=pb=>((kpbDepts().find(p=>p.k===pb)||{}).n)||TEAMS[KPB_TEAM[pb]]||pb;
const kpbTeam=pb=>KPB_TEAM[pb]||String(pb).toLowerCase().replace(/[^a-z0-9_-]/g,"");
const kpbAll=()=>!!ME&&(ME.role==="admin"||ME.phongBan==="BDH");
const kpbMembers=pb=>D().users.filter(u=>u.active&&u.name&&(u.phongBan===pb||(!u.phongBan&&teamOf(u)===kpbTeam(pb))));
const kpbPrj=T=>(D().projects||[]).filter(p=>p.team===T||(p.teams||[]).includes(T));
function kpbItems(pb){const T=kpbTeam(pb),ids=new Set(kpbMembers(pb).map(u=>u.id));
  return cvItems().filter(x=>x.team===T||(x.src==="task"&&ids.has(x.nguoi))).filter(x=>!CV_TEST.includes(x.nguoi))}
/* SOP hay biểu mẫu: theo tên tài liệu (Mẫu…, Biểu mẫu…, Template…) */
const kpbIsMau=d=>/^\s*(mẫu|biểu mẫu|template|form)\b/i.test(d.title||"");
function kpbLoadMsgs(room){if(room in KPB.msgs)return;KPB.msgs[room]=null;
  svApi("/api/hub/chat/msgs?room="+encodeURIComponent(room)).then(r=>{KPB.msgs[room]=r||[];if(PAGE==="cv_pb")renderMain()}).catch(()=>{KPB.msgs[room]=[]})}
function kpbLoad(pb,room){kpbLoadMsgs(room);
  if(!KPB.files[pb])svApi("/api/drive/find?pb="+encodeURIComponent(pb)).then(r=>{KPB.files[pb]=r||{};if(PAGE==="cv_pb")renderMain()}).catch(e=>{KPB.files[pb]={err:e.message||"Chưa mở được"};if(PAGE==="cv_pb")renderMain()});
  if(!KPB.dirs[pb]){KPB.dirs[pb]={loading:true};svApi("/api/drive/list?pb="+encodeURIComponent(pb)).then(r=>{KPB.dirs[pb]=r||{}}).catch(e=>{KPB.dirs[pb]={err:e.message||""}}).then(()=>{if(PAGE==="cv_pb")renderMain()})}
  if(!KPB.teams){KPB.teams={loading:true};svApi("/api/drive/teams").then(r=>{KPB.teams=r||{}}).catch(()=>{KPB.teams={teams:[]}}).then(()=>{if(PAGE==="cv_pb")renderMain()})}
  if(typeof dtLoad==="function"&&!(typeof DT!=="undefined"&&DT.docs))dtLoad().then(()=>{if(PAGE==="cv_pb")renderMain()}).catch(()=>{})}
/* Thư mục sổ ngay trong trang phòng (chị Hoa 02/11): thư mục con của phòng, tư liệu chung, thư mục dự án; nhiều thì hiện bớt, bấm xem thêm */
function kpbDirHtml(pb,T){const Dd=KPB.dirs[pb]||{},chung=((KPB.teams||{}).teams||[]).filter(t=>/^chung/.test(t.pb)),pj=kpbPrj(T).filter(p=>p.drive),fd=Dd.folders||[];
  const grp=(k,title,items,lim)=>{const all=KPB.dmore===k,sh=all?items:items.slice(0,lim);return `<div class="kgdh">${title}</div>${items.length?`<div class="kgdir">${sh.join("")}${items.length>lim?`<button type="button" class="kgdx" data-kgdmore="${k}">${all?"Thu gọn":"+"+(items.length-lim)+" thư mục"}</button>`:""}</div>`:`<p class="hint">${k==="pj"?"Chưa có dự án nào gắn thư mục.":Dd.loading?"Đang tải…":Dd.err&&k==="team"?esc(Dd.err):"Chưa có thư mục."}</p>`}`};
  const btn=(p2,f,name)=>`<button type="button" data-kgdir="${esc(p2)}|${esc(f||"")}" title="${esc(name)}">📁 <span>${esc(name)}</span></button>`;
  return grp("team","Thư mục phòng",fd.map(f=>btn(pb,f.id,f.name)),6)+grp("chung","Tư liệu chung",chung.map(t=>btn(t.pb,"",t.name)),4)+grp("pj","Thư mục dự án",pj.map(p=>`<a href="${esc(p.drive)}" target="_blank" rel="noopener" title="Mở trên Google Drive">📁 <span>${esc(p.ten)}</span></a>`),4)}
function pKhongGian(m){
  const D0=kpbDepts();if(!KPB.pb)KPB.pb=(ME.phongBan&&ME.phongBan!=="BDH"&&D0.some(p=>p.k===ME.phongBan)?ME.phongBan:(D0[0]||{}).k)||"CM";
  if(!kpbAll()&&ME.phongBan&&ME.phongBan!=="BDH")KPB.pb=ME.phongBan;
  const pb=KPB.pb,T=kpbTeam(pb),td=D().settings.today,P=kpbPrj(T);
  const rooms=[["g:"+T,"Nhóm phòng"]].concat(P.map(p=>["p:"+p.id,"▣ "+p.ten]));if(!rooms.some(r=>r[0]===KPB.chat))KPB.chat=rooms[0][0];
  const room=KPB.chat;kpbLoad(pb,room);
  const mem=kpbMembers(pb),L=kpbItems(pb),open=L.filter(x=>x.st!=="done"),late=open.filter(x=>x.late),rv=open.filter(x=>x.st==="review");
  const G=typeof cvGroup==="function"?cvGroup(open):open,srt=(a,b)=>(b.late-a.late)||(a.han||99)-(b.han||99);
  const given=G.filter(x=>x.st!=="cg"&&x.nguoi).sort(srt),cgL=G.filter(x=>x.st==="cg"||!x.nguoi).sort(srt),cgN=open.filter(x=>x.st==="cg"||!x.nguoi).length;
  const rows=KPB.more?given:given.slice(0,10);
  const row=x=>`<button type="button" class="kgr" data-kgo="${esc(x.src)}|${esc(x.ids?x.ids[0]:x.id)}">${avatar(x.nguoi)}<span class="kgrt"><b>${esc(cvShort(String(x.ten||""),70))}${x.n>1?` <small>× ${x.n}</small>`:""}</b><small>${esc(userName(x.nguoi)||"Chưa giao")} · ${esc(cvStN(x.st))}</small></span><span class="kgrh${x.late?" r":""}">${x.late?"trễ "+x.lateD+" ngày":x.han?(x.han===td?"hạn hôm nay":"hạn "+dd(x.han)):"—"}</span></button>`;
  const tpl=tkTpls().filter(p=>p.team===T);
  const M=(KPB.msgs[room]||[]).slice(-8),F=KPB.files[pb];
  const docs=(typeof DT!=="undefined"&&DT.docs||[]).filter(d=>d.nhom==="team"&&(d.teams||[]).includes(pb)),sop=docs.filter(d=>!kpbIsMau(d)),mau=docs.filter(kpbIsMau);
  const canDoc=typeof DT!=="undefined"&&DT.me&&DT.me.editor;
  const load=mem.map(u=>({u,n:open.filter(x=>x.nguoi===u.id).length,t:late.filter(x=>x.nguoi===u.id).length})).sort((a,b)=>b.n-a.n);
  const chips=kpbAll()?`<div class="kgsel">${D0.map(p=>`<button type="button" class="${p.k===pb?"on":""}" data-kgpb="${esc(p.k)}">${esc(p.n)}</button>`).join("")}</div>`:"";
  const docRow=d=>`<div><span><b>${esc(d.title)}</b><small>${esc(d.summary||"")}${d.status!=="dang"?" · chờ CEO duyệt":""}</small></span><button type="button" class="btn sm" data-kgdoc="${esc(d.id)}">Mở</button></div>`;
  const docTab=(k,l,n)=>`<button type="button" class="${KPB.doc===k?"on":""}" data-kgdt="${k}">${l}${n?` <b>${n}</b>`:""}</button>`;
  const docBody=KPB.doc==="tpl"?(tpl.length?tpl.map(p=>`<div><span><b>${esc(p.ten)}</b><small>${p.lap?esc(tkLapLbl(p)):"dùng khi cần"}${p.nguoi?" · "+esc(userName(p.nguoi)||""):""}</small></span><button type="button" class="btn sm" data-kgtpl="${esc(p.id)}">Giao từ mẫu</button></div>`).join(""):`<p class="hint">Chưa có mẫu việc. Khi giao việc, tích "Lưu làm mẫu việc" để dùng lại.</p>`)
    :(()=>{const X=KPB.doc==="mau"?mau:sop;return typeof DT==="undefined"||!DT.docs?`<p class="hint">Đang tải…</p>`:X.length?X.map(docRow).join(""):`<p class="hint">${KPB.doc==="mau"?"Chưa có biểu mẫu (ví dụ: Mẫu báo cáo tháng, Mẫu phân tích đối thủ, Mẫu chân dung khách hàng tiềm năng).":"Chưa có SOP / quy trình của phòng."}${canDoc?"":" Lead của phòng thêm."}</p>`})();
  m.innerHTML=`${chips}<div class="kghd"><div><h2>${esc(kpbName(pb))}</h2><span class="kgmem">${mem.slice(0,12).map(u=>avatar(u.id)).join("")} <small>${mem.length} người</small></span></div>
    <div class="kgk"><span><b>${open.length}</b>việc đang mở</span><span class="${late.length?"r":""}"><b>${late.length}</b>trễ hạn</span><span class="${rv.length?"a":""}"><b>${rv.length}</b>chờ duyệt</span><span><b>${P.length}</b>dự án</span></div></div>
   <div class="kgg">
    <div class="kgc">
     <section class="card kgs"><div class="kgsh"><h3>📋 Việc của phòng</h3><span class="sp"></span><button type="button" class="btn sm pri" id="kg-new">＋ Giao việc</button>${given.length>10?`<button type="button" class="btn sm" id="kg-all">${KPB.more?"Thu gọn":"Xem tất cả "+given.length}</button>`:""}</div>
      ${rows.length?`<div class="kgl">${rows.map(row).join("")}</div>`:`<p class="hint">${cgN?"Chưa có việc nào đã giao người làm.":"Phòng chưa có việc đang mở."}</p>`}
      ${cgN?`<p class="hint kgcg">${cgN} việc chưa giao người làm · <button type="button" class="lnk" id="kg-cg">${KPB.cg?"ẩn bớt":"xem để giao"}</button></p>${KPB.cg?`<div class="kgl">${cgL.slice(0,40).map(row).join("")}</div><p class="hint">Bấm một dòng để mở thẻ và chọn người làm.</p>`:""}`:""}</section>
     <section class="card kgs"><div class="kgsh"><h3>👥 Từng người</h3></div>${load.length?`<div class="kgp">${load.map(o=>`<span>${avatar(o.u.id)}<b>${esc(o.u.name)}</b> ${o.n} việc${o.t?` · <em>${o.t} trễ</em>`:""}</span>`).join("")}</div>`:`<p class="hint">Chưa có nhân sự nào thuộc phòng này.</p>`}</section>
     <section class="card kgs"><div class="kgsh"><h3>▣ Dự án của phòng</h3><span class="sp"></span><button type="button" class="btn sm" id="kg-da">Mở Dự án</button></div>${T==="content"&&typeof kdStat==="function"?CHANNELS.filter(ch=>kdOwner(ch.k)||kdCards(ch.k).length).map(ch=>{const k=kdStat(ch),N=k.C.length,dn=k.C.filter(c=>c.step==="xong").length,pc=N?Math.round(dn/N*100):0,bad=k.miss.length||(!k.today.length&&!k.todayPosted.length&&k.per);return `<div class="kgda"><div><b>📡 Vận hành kênh ${esc(kdNm(ch))}</b><small>${esc(userName(kdOwner(ch.k))||"chưa giao kênh")} · ${dn}/${N} video đã đăng${k.cg.length?` · ${k.cg.length} chưa giao`:""}${bad?` · <em>thiếu lịch đăng</em>`:""}</small></div><div class="progress"><i style="width:${pc}%"></i></div><b>${pc}%</b></div>`}).join(""):""}${P.length?P.map(p=>{const s=prjStats(p),cross=[p.team].concat(p.teams||[]).filter((v,i,a)=>v&&a.indexOf(v)===i);return `<div class="kgda"><div><b>${esc(p.ten)}</b><small>${esc(userName(p.owner)||"")} · hạn ${dd(p.han)} · ${s.done}/${s.L.length} việc xong${s.late?` · <em>${s.late} trễ</em>`:""}${cross.length>1?` · liên phòng: ${esc(cross.map(k=>TEAMS[k]||k).join(", "))}`:""}</small></div><div class="progress"><i style="width:${s.pc2}%"></i></div><b>${s.pc2}%</b></div>`}).join(""):(T==="content"?"":`<p class="hint">Chưa có dự án nào của phòng.</p>`)}</section>
     <section class="card kgs"><div class="kgsh"><h3>🧩 Mẫu & SOP của phòng</h3><span class="sp"></span>${canDoc&&KPB.doc!=="tpl"?`<button type="button" class="btn sm" id="kg-adddoc">＋ Thêm ${KPB.doc==="mau"?"biểu mẫu":"SOP"}</button>`:""}</div>
      <div class="kgtab">${docTab("sop","SOP / quy trình",sop.length)}${docTab("mau","Biểu mẫu",mau.length)}${docTab("tpl","Mẫu việc giao nhanh",tpl.length)}</div><div class="kgt">${docBody}</div></section>
    </div>
    <div class="kgc">
     <section class="card kgs"><div class="kgsh"><h3>💬 Trao đổi</h3><span class="sp"></span><button type="button" class="btn sm" id="kg-chat">Mở Tin nhắn</button></div>
      <div class="kgtab">${rooms.map(([k,l])=>`<button type="button" class="${k===room?"on":""}" data-kgch="${esc(k)}">${esc(cvShort(l,26))}</button>`).join("")}</div>
      <div class="kgm">${KPB.msgs[room]?(M.length?M.map(x=>`<div class="kgmm"><b>${esc((typeof tnUN==="function"?tnUN(x.user_id):"")||"")}</b> <small>${typeof tnTime==="function"?tnTime(x.created_at):""}</small><div>${x.kind==="task"?"📋 ":x.kind==="remind"?"⏰ ":""}${esc(String(x.body).slice(0,160))}</div></div>`).join(""):`<p class="hint">Chưa có tin nhắn.</p>`):`<p class="hint">Đang tải…</p>`}</div>
      <form class="kgf" id="kg-f"><input id="kg-in" placeholder="${room.startsWith("p:")?"Nhắn cho nhóm dự án…":"Nhắn cho cả phòng…"}"><button class="btn sm pri">Gửi</button></form>
      ${mem.filter(u=>u.id!==ME.id&&u.crm).length?`<div class="kgdm"><small>Nhắn riêng:</small>${mem.filter(u=>u.id!==ME.id&&u.crm).map(u=>`<button type="button" data-kgdm="${esc(u.crm)}" title="Nhắn riêng với ${esc(u.name)}">${avatar(u.id)}${esc(u.name.split(" ").pop())}</button>`).join("")}</div>`:""}</section>
     <section class="card kgs"><div class="kgsh"><h3>📁 Thư mục Drive</h3><span class="sp"></span><button type="button" class="btn sm" id="kg-drive">Mở thư mục</button></div>
      ${kpbDirHtml(pb,T)}<div class="kgdh">Tệp mới sửa</div>
      ${!F?`<p class="hint">Đang tải…</p>`:F.err?`<p class="hint">${esc(F.err)}</p>`:(F.files||[]).length?`<div class="kgdf">${F.files.slice(0,4).map(f=>`<a href="${esc(f.link)}" target="_blank" rel="noopener">${typeof tmIc==="function"?tmIc(f.kind):""}<span><b>${esc(f.name)}</b><small>${esc(f.by||"")} · ${typeof tmTime==="function"?tmTime(f.modified):""}</small></span></a>`).join("")}</div>`:`<p class="hint">Chưa có tệp nào, hoặc phòng chưa được gán thư mục.</p>`}</section>
    </div></div>`;
  m.querySelectorAll("[data-kgpb]").forEach(b=>b.onclick=()=>{KPB.pb=b.dataset.kgpb;KPB.more=KPB.cg=false;KPB.chat="";renderMain()});
  m.querySelectorAll("[data-kgo]").forEach(b=>b.onclick=()=>{const [s,id]=b.dataset.kgo.split("|");if(s==="task")openTask(id);else if(s==="card")openCard(id)});
  const team=()=>{const e=$("#t-team");if(e&&!e.disabled&&[...e.options].some(o=>o.value===T))e.value=T};
  $("#kg-new").onclick=()=>{openTask(null);team()};
  if($("#kg-all"))$("#kg-all").onclick=()=>{KPB.more=!KPB.more;renderMain()};
  if($("#kg-cg"))$("#kg-cg").onclick=()=>{KPB.cg=!KPB.cg;renderMain()};
  $("#kg-da").onclick=()=>{PAGE="cv_da";render()};
  $("#kg-chat").onclick=()=>openChat(room);
  m.querySelectorAll("[data-kgch]").forEach(b=>b.onclick=()=>{KPB.chat=b.dataset.kgch;renderMain()});
  m.querySelectorAll("[data-kgdm]").forEach(b=>b.onclick=()=>openChat(tnDm(b.dataset.kgdm)));
  m.querySelectorAll("[data-kgdir]").forEach(b=>b.onclick=()=>{const [p2,f]=b.dataset.kgdir.split("|");if(typeof TM!=="undefined"){TM.scope=pb;TM.pb=p2;TM.folder=f||"";TM.list=null;TM.listKey="";TM.q=""}ntPage("thumuc")});
  m.querySelectorAll("[data-kgdmore]").forEach(b=>b.onclick=()=>{KPB.dmore=KPB.dmore===b.dataset.kgdmore?"":b.dataset.kgdmore;renderMain()});
  $("#kg-drive").onclick=()=>{if(typeof TM!=="undefined"){TM.scope=pb;TM.pb=pb;TM.folder="";TM.list=null;TM.listKey="";TM.q=""}ntPage("thumuc")};
  m.querySelectorAll("[data-kgtpl]").forEach(b=>b.onclick=()=>{openTask(null);const s=$("#t-tpl");if(s){s.value=b.dataset.kgtpl;s.onchange&&s.onchange()}});
  m.querySelectorAll("[data-kgdt]").forEach(b=>b.onclick=()=>{KPB.doc=b.dataset.kgdt;renderMain()});
  m.querySelectorAll("[data-kgdoc]").forEach(b=>b.onclick=()=>dtOpen(b.dataset.kgdoc));
  if($("#kg-adddoc"))$("#kg-adddoc").onclick=async()=>{const mau=KPB.doc==="mau";await dtEditOpen(null);
    if(DT.edit){Object.assign(DT.edit,{nhom:"team",teams:[pb],title:mau?"Mẫu ":"SOP ",bat_buoc:"khong"});renderMain()}};
  $("#kg-f").onsubmit=async e=>{e.preventDefault();const v=$("#kg-in").value.trim();if(!v)return;
    try{const x=await tnSend(room,v);(KPB.msgs[room]=KPB.msgs[room]||[]).push(x);renderMain()}catch(er){toast(er.message||"Chưa gửi được")}};
}
if(typeof NAV_AN_MO!=="undefined")NAV_AN_MO.add("thumuc");
PAGES.cv_pb=m=>{try{pKhongGian(m)}catch(e){console.error("Không gian phòng lỗi",e);m.innerHTML=`<div class="note red"><b>Trang chưa hiện được.</b> ${esc(String(e&&e.message||e))}</div>`}};
