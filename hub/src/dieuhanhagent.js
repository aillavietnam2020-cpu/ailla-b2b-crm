/* ---------- Điều hành agent ----------
   Chị nhắn thẳng cho agent OpenClaw ngay trên web. Tin vào hàng đợi (/api/agent-chat); cầu nối trên VPS lấy tin,
   nhờ đúng agent trả lời rồi gửi lên lại. Telegram vẫn dùng song song; ô "gửi cả sang Telegram" để đi ngoài vẫn nhận kết quả.
   Chỉ CEO thấy. Web chỉ chuyển lời: việc agent làm với dữ liệu thật vẫn qua cổng /api/agent (đọc + đề xuất chờ duyệt). */
const AC={agents:null,relay:false,cur:"",msgs:[],last:0,busy:false,tg:false,drafts:{}};
const AC_CSS=`<style id="ac-css">
.ac-wrap{display:grid;grid-template-columns:230px minmax(0,1fr);gap:16px;align-items:start}
.ac-list{display:flex;flex-direction:column;gap:6px}
.ac-list button{border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:9px 12px;text-align:left;cursor:pointer;font-weight:600;color:var(--ink);display:flex;justify-content:space-between;gap:8px;align-items:center}
.ac-list button.on{background:var(--navy);color:#fff;border-color:transparent}
.ac-list .ac-n{background:var(--orange);color:#fff;border-radius:999px;font-size:12px;padding:1px 8px}
.ac-box{background:var(--surface);border:1px solid var(--line);border-radius:14px;display:flex;flex-direction:column;min-height:420px}
.ac-head{padding:12px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}
.ac-msgs{padding:14px 16px;overflow-y:auto;max-height:58vh;min-height:300px;display:flex;flex-direction:column;gap:10px}
.ac-m{max-width:82%;padding:9px 12px;border-radius:12px;white-space:pre-wrap;word-break:break-word;line-height:1.5}
.ac-m small{display:block;color:var(--muted);font-size:11.5px;margin-top:4px}
.ac-m.u{align-self:flex-end;background:var(--navy);color:#fff}.ac-m.u small{color:#cfd6e6}
.ac-m.a{align-self:flex-start;background:var(--gray-soft)}
.ac-m.s{align-self:center;background:var(--red-soft);color:var(--red);font-size:13px}
.ac-send{border-top:1px solid var(--line);padding:12px 16px;display:flex;flex-direction:column;gap:8px}
.ac-send textarea{width:100%;box-sizing:border-box;min-height:64px;border:1px solid var(--line);border-radius:10px;padding:8px 10px;font:inherit}
.ac-row input[type=checkbox]{width:auto;min-width:0;margin:0 6px 0 0;vertical-align:middle}.ac-row label{display:inline-flex;align-items:center;cursor:pointer}
.ac-row{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}
@media(max-width:760px){.ac-wrap{grid-template-columns:1fr}.ac-list{flex-direction:row;flex-wrap:wrap}.ac-m{max-width:94%}}
</style>`;
/* Agent trả lời kiểu markdown (**đậm**, gạch đầu dòng): đổi sang chữ đậm và dấu chấm, không hiện ký tự thô. */
const acFmt=t=>esc(t).replace(/\*\*([^*\n]+)\*\*/g,"<b>$1</b>").replace(/`([^`\n]+)`/g,"<code>$1</code>").replace(/^(\s*)[-*] /gm,"$1• ").replace(/^#{1,6} +/gm,"");
const acHour=s=>{try{return new Date(s).toLocaleString("vi-VN",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"})}catch(e){return ""}};
async function acLoadAgents(){
  try{const r=await svApi("/api/agent-chat/agents");AC.agents=r.agents;AC.relay=r.relay_online;AC.err=""}catch(e){AC.err=e.message;AC.agents=AC.agents||[]}
}
function acDraw(){
  const l=$("#ac-list"),st=$("#ac-relay");if(!l)return;
  l.innerHTML=(AC.agents||[]).map(a=>`<button data-ac="${esc(a.id)}" class="${AC.cur===a.id?"on":""}"><span>${esc(a.name)}</span>${a.pending?`<span class="ac-n">${a.pending}</span>`:""}</button>`).join("");
  l.querySelectorAll("[data-ac]").forEach(b=>b.onclick=()=>acPick(b.dataset.ac));
  if(st)st.innerHTML=AC.relay?`<span class="pill grn">Cầu nối VPS đang chạy</span>`:`<span class="pill red">Cầu nối VPS chưa chạy · tin sẽ chờ tới khi bật</span>`;
}
function acDrawMsgs(stick){
  const box=$("#ac-msgs");if(!box)return;
  const near=box.scrollHeight-box.scrollTop-box.clientHeight<60;
  box.innerHTML=AC.msgs.length?AC.msgs.map(m=>{
    const k=m.role==="USER"?"u":m.role==="AGENT"?"a":"s";
    const st=m.role==="USER"?(m.status==="queued"?" · đang chờ":m.status==="taken"?" · agent đang làm…":m.status==="error"?" · lỗi":""):"";
    return `<div class="ac-m ${k}">${m.role==="AGENT"?acFmt(m.body):esc(m.body)}<small>${acHour(m.created_at)}${st}${m.role==="USER"&&m.tg?" · gửi cả Telegram":""}</small></div>`}).join(""):`<div class="hint">Chưa có tin nào. Gõ bên dưới để nhắn agent.</div>`;
  if(stick||near)box.scrollTop=box.scrollHeight;
}
async function acPick(id){
  const ta=$("#ac-text");if(ta&&AC.cur)AC.drafts[AC.cur]=ta.value;
  AC.cur=id;AC.msgs=[];AC.last=0;acDraw();
  const a=(AC.agents||[]).find(x=>x.id===id);
  if($("#ac-title"))$("#ac-title").textContent=a?a.name:"";
  if($("#ac-send"))$("#ac-send").hidden=false;
  if($("#ac-text"))$("#ac-text").value=AC.drafts[id]||"";
  await acPoll(true);
}
async function acPoll(first){
  if(!AC.cur||AC.busy)return;AC.busy=true;const cur=AC.cur;
  try{
    const r=await svApi("/api/agent-chat?agent="+encodeURIComponent(cur)+(first?"":"&after="+AC.last));
    if(cur!==AC.cur)return;
    if(first)AC.msgs=r;else AC.msgs=AC.msgs.concat(r);
    if(r.length)AC.last=Math.max(AC.last,r[r.length-1].id);
    // trạng thái các tin chị đã gửi (chờ → đang làm → xong) đổi theo thời gian
    const s=await svApi("/api/agent-chat/status?agent="+encodeURIComponent(cur));
    const m=new Map(s.map(x=>[x.id,x.status]));AC.msgs.forEach(x=>{if(x.role==="USER"&&m.has(x.id))x.status=m.get(x.id)});
    acDrawMsgs(first);
  }catch(e){}finally{AC.busy=false}
}
async function acSend(){
  const ta=$("#ac-text"),t=ta.value.trim();if(!t||!AC.cur)return;
  const btn=$("#ac-go");btn.disabled=true;
  try{await svApi("/api/agent-chat",{method:"POST",body:JSON.stringify({agent:AC.cur,body:t,tg:$("#ac-tg").checked})});
    ta.value="";AC.drafts[AC.cur]="";AC.tg=$("#ac-tg").checked;await acPoll(false);acDrawMsgs(true)}
  catch(e){toast("Chưa gửi được: "+e.message)}finally{btn.disabled=false;ta.focus()}
}
PAGES.agentchat=m=>{
  m.innerHTML=H("Điều hành agent","Nhắn thẳng cho agent ngay trên web · vẫn nhắn được bằng Telegram như cũ")+AC_CSS+
  `<div class="note">Tin gõ ở đây được chuyển cho agent trên VPS. Muốn nhận kết quả cả trên điện thoại khi ngồi ngoài, tích ô <b>Gửi cả bản trả lời sang Telegram</b>. Agent chỉ đọc và đề xuất; việc đổi dữ liệu thật vẫn do chị duyệt.</div>
  <div class="ac-wrap"><div><div id="ac-relay" style="margin-bottom:8px"></div><div class="ac-list" id="ac-list"><span class="hint">Đang tải…</span></div></div>
  <div class="ac-box"><div class="ac-head"><b id="ac-title">Chọn một agent bên trái</b></div><div class="ac-msgs" id="ac-msgs"><div class="hint">Chọn agent để xem cuộc trò chuyện.</div></div>
  <div class="ac-send" id="ac-send" hidden><textarea id="ac-text" placeholder="Gõ việc cần agent làm… (Ctrl+Enter để gửi)"></textarea>
  <div class="ac-row"><label><input type="checkbox" id="ac-tg"> Gửi cả bản trả lời sang Telegram</label><button class="btn pri" id="ac-go">Gửi</button></div></div></div></div>`;
  $("#ac-tg").checked=AC.tg;
  $("#ac-go").onclick=acSend;
  $("#ac-text").onkeydown=e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();acSend()}};
  if(AC.agents)acDraw();
  acLoadAgents().then(()=>{if(PAGE!=="agentchat")return;acDraw();if(AC.err)toast("Chưa tải được: "+AC.err);if(!AC.cur&&AC.agents.length)acPick(AC.agents[0].id);else if(AC.cur){acPick(AC.cur)}});
};
/* Tự cập nhật: 4 giây/lần khi đang mở trang (không vẽ lại ô gõ nên không mất chữ đang gõ) */
setInterval(()=>{if(typeof ME==="undefined"||!ME||typeof PAGE==="undefined"||PAGE!=="agentchat"||!document.getElementById("ac-msgs"))return;
  acPoll(false);if(Date.now()-(AC.at||0)>12000){AC.at=Date.now();acLoadAgents().then(acDraw)}},4000);
{const s=MODULES.find(m=>m.k==="setup");if(s){const g0=s.groups;s.groups=()=>{const G=g0();const hs=G.find(g=>g[0]==="Hệ thống");if(hs)hs[1].push(MI("agentchat","Điều hành agent",u=>u.role==="admin"));return G}}}
/* Trang vận hành (vanhanh.ailla.vn): mục riêng ngay trên menu để dễ vào. Hiện chỉ chủ doanh nghiệp (vai trò Quản trị) thấy;
   mở cho nhân sự sau khi chốt ai được nhắn agent nào. */
{const i=MODULES.findIndex(m=>m.k==="cv");const mod={k:"agt",zone:"",ic:"spark",n:"Điều hành agent",sub:"",groups:()=>[["",[MI("agentchat","Điều hành agent",u=>u.role==="admin")]]]};
 if(i>=0)MODULES.splice(i+1,0,mod);else MODULES.push(mod)}
