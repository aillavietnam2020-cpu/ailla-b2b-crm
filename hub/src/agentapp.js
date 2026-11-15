/* =====================================================================
   AILLA AGENT (chị Hoa duyệt demo 15/11/2026) — nhắn agent toàn màn hình kiểu Zalo, mở ở TAB RIÊNG (/agent/).
   - Máy chủ trả cùng trang web nhưng gắn window.AGENT_APP=1 (src/server/hub/serve.ts), giống cách Ailla Chat dùng /chat/.
   - Dùng lại nguyên khung nhắn agent đang chạy (dieuhanhagent.js: gửi tin, đính kèm, ghi âm, trích dẫn, /stop, /new),
     chỉ đổi bố cục: trái danh sách agent (ảnh, chấm trạng thái, tin cuối, chưa đọc) · giữa khung chat rộng · phải thông tin gập được.
   - Ở trang Điều hành agent: bấm "Nhắn agent" hoặc bấm một agent là mở tab Ailla Agent (aaOpen).
   - Điện thoại: mở ra là danh sách; bấm agent thì khung chat toàn màn hình, nút ← về danh sách.
   ===================================================================== */
const AA={q:"",f:"all",info:true,seen:{}};
try{AA.seen=JSON.parse(localStorage.getItem("aa_seen")||"{}")||{};AA.info=localStorage.getItem("aa_info")!=="0"}catch(e){}
/* Mở Ailla Agent ở tab riêng (dùng chung một tab tên "ailla-agent": bấm agent khác thì tab đó chuyển sang agent đó). */
function aaOpen(id){const u="/agent/"+(id?"#a="+encodeURIComponent(id):"");const w=window.open(u,"ailla-agent");if(!w)location.href=u;else try{w.focus()}catch(e){}}
const AA_CSS=`<style id="aa-css">
.aaapp,.aaapp body{background:#fff}
.aaapp #main>.ph{display:none}
.aaapp #ntpop{display:none!important} /* ô thông báo chung của web không đè lên khung chat; tin agent đã báo "mới" ở danh sách */
.aaapp #ac-root{height:100vh;height:100dvh}
.aaapp .ac-stripwrap{display:none!important}
.aaapp .ac-chat{display:grid;grid-template-columns:320px minmax(0,1fr) 300px;gap:0;height:100vh;height:100dvh;align-items:stretch}
.aaapp.aa-noinfo .ac-chat{grid-template-columns:320px minmax(0,1fr) 0}.aaapp.aa-noinfo .ac-right{display:none}
.aaapp .ac-box{border:0;border-radius:0;height:100%!important;min-height:0;background:#f3f5fb}
.aaapp .ac-head{background:#fff;padding:8px 16px}
.aaapp .ac-prof{margin:0}.aaapp .ac-prof h2{font-size:16px}
.aaapp .ac-tabs{display:none}
.aaapp .ac-msgs{padding:16px 5%}
.aaapp .ac-m{max-width:78%;border-radius:14px;box-shadow:0 1px 1.5px rgba(30,35,80,.08)}
.aaapp .ac-m.a{background:#fff}.aaapp .ac-m.u{background:#e5efff}
.aaapp .ac-send{background:#fff;padding:8px 14px 10px}
.aaapp .ac-send textarea{min-height:44px;font-size:15px;max-height:180px}
.aaapp .ac-right{max-height:none!important;height:100%;overflow-y:auto;border-left:1px solid var(--line);background:#fff;padding:12px}
.aaapp .ac-right .card{box-shadow:none;border:0;border-bottom:1px solid var(--line);border-radius:0;padding:10px 4px;margin:0}
.aa-ls{background:#fff;border-right:1px solid var(--line);display:flex;flex-direction:column;min-height:0;height:100%}
.aa-lh{display:flex;align-items:center;gap:10px;padding:12px 14px 8px}
.aa-lh img{height:30px;width:auto}.aa-lh b{font-size:17px;display:block;line-height:1.15}.aa-lh small{font-size:12px;color:var(--muted)}
.aa-lh a{margin-left:auto;font-size:12.5px;color:var(--muted);text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:3px 10px;white-space:nowrap}
.aa-lh a:hover{color:#4b54d1;border-color:#4b54d1}
.aa-q{margin:2px 14px 8px}.aa-q input{border:0;background:#f1f2f7;border-radius:10px;padding:8px 12px}
.aa-f{display:flex;gap:6px;padding:0 14px 8px;border-bottom:1px solid var(--line)}
.aa-f button{border:0;background:none;padding:4px 10px;border-radius:999px;font-size:13px;cursor:pointer;color:var(--muted);font-weight:600}
.aa-f button.on{background:#eef0ff;color:#4b54d1}
.aa-l{flex:1;overflow-y:auto}
.aa-it{display:flex;gap:11px;align-items:center;padding:9px 14px;cursor:pointer;border:0;background:none;width:100%;text-align:left;font:inherit;color:inherit}
.aa-it:hover{background:#f6f7fb}.aa-it.on{background:#eef0ff}
.aa-av{position:relative;flex:none}.aa-av .ac-photo,.aa-av .ac-av{width:46px;height:46px;font-size:22px;border-width:2px}
.aa-dot{position:absolute;right:1px;bottom:1px;width:12px;height:12px;border-radius:50%;border:2px solid #fff;background:#16a34a}
.aa-dot.busy{background:#d97706}.aa-dot.off{background:#cbd2e0}
.aa-tx{flex:1;min-width:0}.aa-r1{display:flex;gap:6px;align-items:baseline}.aa-r1 b{flex:1;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.aa-r1 time{font-size:11.5px;color:var(--muted);flex:none}
.aa-r2{display:flex;gap:6px;align-items:center}.aa-r2 span{flex:1;font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.aa-it.unread .aa-r2 span{color:var(--ink);font-weight:600}.aa-r2 .wk{color:#4b54d1;font-style:italic}
.aa-n{background:#dc2626;color:#fff;border-radius:999px;font-size:11px;font-weight:700;min-width:18px;height:18px;display:grid;place-items:center;padding:0 5px;font-style:normal}
.aa-hb{display:flex;gap:2px;margin-left:auto}
.aa-ib{border:0;background:none;width:38px;height:38px;border-radius:10px;cursor:pointer;font-size:17px;color:var(--muted);display:grid;place-items:center}
.aa-ib:hover{background:#f1f2f7}.aa-ib.on{background:#eef0ff;color:#4b54d1}
.aa-back{display:none}
.aaapp .ac-head .ac-prof{display:flex;align-items:center}
@media(max-width:820px){
 .aaapp .ac-chat,.aaapp.aa-noinfo .ac-chat{grid-template-columns:minmax(0,1fr)}
 .aaapp .ac-box,.aaapp .ac-right{display:none}
 .aaapp.aa-open .aa-ls{display:none}.aaapp.aa-open .ac-box{display:flex}
 .aaapp.aa-open.aa-minfo .ac-box{display:none}.aaapp.aa-open.aa-minfo .ac-right{display:block}
 .aa-back{display:grid}.aaapp .ac-msgs{padding:12px 10px}.aaapp .ac-m{max-width:88%}
 .aa-hide-m{display:none}
}
</style>`;
/* nút ← trên cột thông tin (điện thoại); cột này vẽ lại mỗi lần có ảnh/link mới nên gắn lại sau mỗi lần vẽ */
function aaRBack(){const rt=document.getElementById("ac-right");if(rt&&!rt.querySelector("#aa-rback")){rt.insertAdjacentHTML("afterbegin",`<button class="aa-ib aa-back" id="aa-rback" title="Về khung chat">←</button>`);$("#aa-rback").onclick=()=>document.documentElement.classList.remove("aa-minfo")}}
function aaUnread(a){return a.last_id>(AA.seen[a.id]||0)&&a.last_role&&a.last_role!=="USER"&&a.id!==AC.cur}
function aaSeen(){const a=acA(AC.cur);if(!a)return;if((AA.seen[a.id]||0)<a.last_id){AA.seen[a.id]=a.last_id;try{localStorage.setItem("aa_seen",JSON.stringify(AA.seen))}catch(e){}}}
function aaTime(s){if(!s)return"";const d=new Date(s),n=new Date();if(d.toDateString()===n.toDateString())return d.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"});const y=new Date(n);y.setDate(n.getDate()-1);if(d.toDateString()===y.toDateString())return "Hôm qua";return d.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"})}
function aaPrev(a){if(a.pending)return `<span class="wk">đang soạn trả lời…</span>`;if(!a.last_body)return `<span>${esc(a.title||"")}</span>`;let b=String(a.last_body).replace(/^\[KHÁCH\] /,"").replace(/^↩ «[\s\S]*?»\n/,"").replace(/\*\*/g,"").replace(/\s+/g," ");return `<span>${a.last_role==="USER"?"Bạn: ":a.last_role==="SYSTEM"?"⚠ ":""}${esc(b)}</span>`}
function aaList(){
  const box=document.getElementById("aa-l");if(!box)return;const q=AA.q.trim().toLowerCase();
  const L=(AC.agents||[]).slice().sort((x,y)=>String(y.last_at||"").localeCompare(String(x.last_at||"")))
    .filter(a=>(!q||(a.name+" "+(a.title||"")).toLowerCase().includes(q))&&(AA.f==="all"||(AA.f==="unread"&&aaUnread(a))||(AA.f==="busy"&&a.pending>0)));
  box.innerHTML=L.map(a=>{const[sc]=acStatus(a),u=aaUnread(a);return `<button class="aa-it${a.id===AC.cur?" on":""}${u?" unread":""}" data-aa="${esc(a.id)}"><span class="aa-av">${acAv(a)}<i class="aa-dot ${sc}"></i></span><span class="aa-tx"><span class="aa-r1"><b>${esc(a.name)}</b><time>${aaTime(a.last_at)}</time></span><span class="aa-r2">${aaPrev(a)}${u?`<i class="aa-n">mới</i>`:""}</span></span></button>`}).join("")||'<div class="hint" style="padding:14px">Không có agent nào.</div>';
  box.querySelectorAll("[data-aa]").forEach(b=>b.onclick=()=>{document.documentElement.classList.add("aa-open");document.documentElement.classList.remove("aa-minfo");if(b.dataset.aa!==AC.cur){try{history.replaceState(null,"","/agent/#a="+encodeURIComponent(b.dataset.aa))}catch(e){}acPick(b.dataset.aa)}});
  const n=(AC.agents||[]).filter(aaUnread).length;document.title=(n?"("+n+") ":"")+"Ailla Agent";
}
/* Bọc khung chat: thêm cột danh sách trái + nút ở đầu khung (về danh sách, thông tin, về web) */
function aaDress(){
  const R=acRoot(),c=R&&R.querySelector(".ac-chat");if(!c)return;
  if(!document.getElementById("aa-css"))document.head.insertAdjacentHTML("beforeend",AA_CSS);
  if(!c.querySelector(".aa-ls"))c.insertAdjacentHTML("afterbegin",`<aside class="aa-ls"><div class="aa-lh"><img src="data:image/png;base64,${LOGO}" alt="Ailla"><span><b>Ailla Agent</b><small>${(AC.agents||[]).length} agent</small></span><a href="/hub/#go=agentchat" title="Về trang Điều hành agent">Về web</a></div>
    <div class="aa-q"><input id="aa-q" placeholder="🔍 Tìm agent" value="${esc(AA.q)}"></div>
    <div class="aa-f">${[["all","Tất cả"],["unread","Chưa đọc"],["busy","Đang xử lý"]].map(([k,t])=>`<button data-aaf="${k}" class="${AA.f===k?"on":""}">${t}</button>`).join("")}</div><div class="aa-l" id="aa-l"></div></aside>`);
  const head=R.querySelector(".ac-prof");
  if(head&&!head.querySelector(".aa-hb")){
    head.insertAdjacentHTML("afterbegin",`<button class="aa-ib aa-back" id="aa-back" title="Danh sách agent">←</button>`);
    head.insertAdjacentHTML("beforeend",`<span class="aa-hb"><a class="aa-ib aa-hide-m" href="/hub/#go=agentchat" target="_blank" rel="noopener" title="Mở Điều hành agent (sơ đồ, skill)">🗂</a><button class="aa-ib${AA.info?" on":""}" id="aa-info" title="Thông tin, ảnh, file">ⓘ</button></span>`);
    $("#aa-back").onclick=()=>document.documentElement.classList.remove("aa-open","aa-minfo");
    $("#aa-info").onclick=()=>{if(matchMedia("(max-width:820px)").matches){document.documentElement.classList.add("aa-minfo");return}AA.info=!AA.info;try{localStorage.setItem("aa_info",AA.info?"1":"0")}catch(e){}document.documentElement.classList.toggle("aa-noinfo",!AA.info);$("#aa-info").classList.toggle("on",AA.info)};
  }
  aaRBack();
  const q=$("#aa-q");if(q)q.oninput=()=>{AA.q=q.value;aaList()};
  R.querySelectorAll("[data-aaf]").forEach(b=>b.onclick=()=>{AA.f=b.dataset.aaf;R.querySelectorAll("[data-aaf]").forEach(x=>x.classList.toggle("on",x===b));aaList()});
  document.documentElement.classList.toggle("aa-noinfo",!AA.info);
  aaSeen();aaList();
}
if(typeof window!=="undefined"&&window.AGENT_APP){
  document.documentElement.classList.add("chatapp","aaapp");
  try{if(typeof VIEW_KEY!=="undefined")sessionStorage.removeItem(VIEW_KEY)}catch(e){}
  if(typeof saveView==="function")saveView=function(){};
  let started=false;
  const _r=render;render=function(){
    if(typeof ME!=="undefined"&&ME&&PAGE!=="agentchat"){
      /* đang ở Ailla Agent mà mở trang khác (thông báo, thẻ việc…): sang web vận hành đúng trang đó */
      if(started&&PAGE){const p=PAGE;PAGE="agentchat";location.href="/hub/#go="+encodeURIComponent(p);return}
      PAGE="agentchat";MOD="";
    }
    started=!!(typeof ME!=="undefined"&&ME);return _r.apply(this,arguments)};
  /* chọn agent theo địa chỉ #a=<mã> (bấm từ trang Điều hành agent) */
  const want=()=>{const m=/^#a=([a-z0-9-]+)/.exec(location.hash);return m?decodeURIComponent(m[1]):""};
  {const w=want();if(w){AC.cur=w;AC.restored=1;document.documentElement.classList.add("aa-open")}}
  /* bấm thông báo "agent trả lời" khi Ailla Agent đang mở: chuyển sang đúng agent */
  try{navigator.serviceWorker&&navigator.serviceWorker.addEventListener("message",e=>{const u=e.data&&e.data.agUrl;if(u){const h=new URL(u,location.href).hash;if(h&&h!==location.hash)location.hash=h}})}catch(e){}
  window.addEventListener("hashchange",()=>{const w=want();if(w&&acA(w)){document.documentElement.classList.add("aa-open");if(w!==AC.cur)acPick(w)}});
  /* không có màn thẻ: chưa chọn agent thì mở agent nhắn gần nhất (điện thoại vẫn thấy danh sách trước) */
  acGrid=function(){const L=(AC.agents||[]).slice().sort((x,y)=>String(y.last_at||"").localeCompare(String(x.last_at||"")));const a=acA(AC.cur)||L[0];if(!a){const R=acRoot();if(R)R.innerHTML='<div class="hint" style="padding:30px">Bạn chưa được cấp quyền nhắn agent nào. Nhờ CEO cấp quyền.</div>';return}acPick(a.id)};
  const _chat=acChat;acChat=function(){const r=_chat.apply(this,arguments);try{aaDress()}catch(e){}return r};
  const _send=acSend;acSend=async function(){const r=await _send.apply(this,arguments);try{acLoadAgents().then(()=>{aaSeen();aaList()})}catch(e){}return r};
  const _dr=acDrawRight;acDrawRight=function(){const r=_dr.apply(this,arguments);try{aaRBack()}catch(e){}return r};
  acFit=function(){const b=document.querySelector(".aaapp .ac-box");if(b)b.style.height="";const c=document.querySelector(".ac-chat");if(c)c.style.removeProperty("--ach")};
  /* danh sách trái tự cập nhật (tin cuối, chưa đọc, đang xử lý) */
  setInterval(()=>{if(!document.getElementById("aa-l")||document.hidden)return;acLoadAgents().then(()=>{aaSeen();aaList()})},15000);
}
