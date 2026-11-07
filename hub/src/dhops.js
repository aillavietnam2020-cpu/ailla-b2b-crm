/* ---------- Điều hành agent: sơ đồ tổ chức + bộ não phòng ban (CEO duyệt bản D + H ngày 07/11/2026) ----------
   Chỉ CEO thấy. Nhân viên được cấp quyền vẫn thấy màn thẻ agent cũ để nhắn tin.
   Dữ liệu: /api/agent-ops (trạng thái máy chủ agent gửi lên mỗi 5 phút, phòng ban, ghi chú phòng, nhật ký, skill).
   Tab: Sơ đồ tổ chức · Bộ não phòng ban · Năng lực agent · Quyền nhắn agent. Bấm agent mở hồ sơ; nút Nhắn mở khung chat cũ. */
const AOP={tab:"org",dept:"mk",data:null,at:0,busy:false,err:"",dtab:"now"};
const AOP_ST={work:["p-grn","Đang làm","#16a34a"],wait:["p-amb","Đang chờ","#d97706"],stuck:["p-red","Đang kẹt","#ea580c"],err:["p-red","Bị lỗi","#dc2626"],idle:["p-blu","Rảnh","#3b82f6"],off:["p-gry","Đang tắt","#cbd5e1"],unk:["p-gry","Chưa rõ","#d0d5dd"]};
const AOP_CSS=`<style id="aop-css">
.aoc-banner{margin-bottom:12px}
.aoc-kp{grid-template-columns:repeat(4,minmax(0,1fr))!important}
.aoc-av{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-size:16px;flex:none;border:2px solid var(--c);background:color-mix(in srgb,var(--c) 12%,#fff)}
.og-wrap{position:relative;display:flex;flex-direction:column;gap:46px;padding:24px 20px;overflow-x:auto;overflow-y:hidden}
.og-row{display:flex;justify-content:center;gap:18px;position:relative;z-index:2}
.og-depts{display:grid;grid-template-columns:repeat(var(--n,3),minmax(260px,1fr));gap:14px;position:relative;z-index:2;min-width:860px}
.og-dept{background:#f8f9fc;border:1px solid var(--line);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:10px}
.og-dh{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;white-space:nowrap;border:0;background:none;padding:2px 4px;cursor:pointer;text-align:left;font-weight:700;font-size:15px;color:inherit}
.og-dh .og-open{margin-left:auto;font-size:12.5px;font-weight:600;color:#4b54d1}.og-dh:hover .og-open{text-decoration:underline}
.og-cols{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:12px}
.og-col{display:flex;flex-direction:column;gap:10px}.og-subs{display:flex;flex-direction:column;gap:8px;padding-left:22px}
.og-n{background:#fff;border:2px solid var(--s,#e6e8f0);border-radius:12px;padding:8px 10px;display:flex;gap:9px;align-items:flex-start;cursor:pointer;box-shadow:0 1px 3px rgba(30,35,80,.06);text-align:left;font:inherit;color:inherit;width:100%}
.og-row .og-n{width:270px}.og-n.big{border-width:2.5px}
.og-n b{font-size:13.5px}.og-n .pill{font-size:11px;padding:1px 7px}.og-n small{display:block;font-size:12px;color:var(--muted);line-height:1.35;margin-top:2px}
.og-n em{display:block;font-style:normal;font-size:11.5px;color:var(--orange);font-weight:600;margin-top:2px}
.og-n.off{opacity:.5}.og-n.err{background:var(--red-soft)}.og-n.stuck{background:var(--orange-soft)}
.og-ceo{border:2px solid #e7357b;background:var(--pink-soft);width:240px!important;align-items:center;cursor:default}
.og-p{border:2px dashed #c4b5fd;background:#faf9ff;cursor:default;align-items:center}
#ogsvg{position:absolute;left:0;top:0;pointer-events:none;z-index:1;overflow:visible}#ogsvg path{fill:none}#ogsvg path.fl{stroke-dasharray:7 5;animation:dhflow 1s linear infinite}
@keyframes dhflow{to{stroke-dashoffset:-12}}@media(prefers-reduced-motion:reduce){#ogsvg path.fl{animation:none}}
.og-leg{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;margin:-6px 0 16px}.og-leg i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:middle}
.aov{display:grid;grid-template-columns:240px minmax(0,1fr) 280px;background:#fff;border:1px solid var(--line);border-radius:var(--r);overflow:hidden;box-shadow:var(--shadow);min-height:640px}
.aov-t{background:#262630;color:#d4d4d8;padding:10px 6px;font-size:13.5px}
.aov-th{color:#a1a1aa;font-size:11px;text-transform:uppercase;letter-spacing:.06em;padding:6px 10px}
.aov-ti{padding:5px 10px;border-radius:7px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;gap:7px;align-items:center;border:0;background:none;color:inherit;font:inherit;width:100%;text-align:left}
.aov-ti:hover{background:#34343f}.aov-ti.on{background:#4c3a8c;color:#fff}.aov-tsub{padding-left:14px}.aov-ti.aov-tag{padding-left:26px;font-size:13px;color:#c4c4cc}.aov-ti i{width:7px;height:7px;border-radius:50%;flex:none}
.aov-tmeta{padding:0 10px 6px 30px;font-size:12px;color:#8b8b95}.aov-ti.add{color:#a78bfa;margin-top:6px}
.aov-n{padding:22px 30px;min-width:0}.aov-n h1{font-size:26px;margin:2px 0 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.aov-n h2{font-size:17px;margin:22px 0 8px;padding-bottom:5px;border-bottom:1px solid var(--line);display:flex;gap:8px;align-items:center;flex-wrap:wrap}.aov-h2{font-size:12.5px;font-weight:400;color:var(--muted)}
.aov-n ul{margin:6px 0;padding-left:20px}.aov-n li{margin:5px 0}.aov-s{font-size:13px}
.aov-props{display:grid;grid-template-columns:150px 1fr;gap:6px 12px;font-size:14px;background:#fafbfd;border:1px solid var(--line);border-radius:10px;padding:10px 14px}.aov-props>span{color:var(--muted)}
.aov-wl{color:#6d28d9;font-weight:600;cursor:pointer;background:#f5f3ff;border-radius:5px;padding:0 4px;text-decoration:none;border:0;font:inherit;font-weight:600}
.aov-wl:before{content:"[[";color:#c4b5fd;font-weight:400}.aov-wl:after{content:"]]";color:#c4b5fd;font-weight:400}
.aov-note{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:6px 0;background:#fff}.aov-note p{margin:3px 0 0;font-size:13px;color:var(--muted);white-space:pre-wrap}
.aov-note .act{float:right;display:flex;gap:4px}.aov-note .act button{border:0;background:none;color:var(--muted);cursor:pointer;font-size:12.5px}.aov-note .act button:hover{color:var(--blue)}
.aov-add{display:grid;gap:6px;margin-top:8px}.aov-add[hidden]{display:none}
.aov-r{border-left:1px solid var(--line);padding:14px;background:#fcfcfe;min-width:0}.aov-r h3{font-size:14px;margin:14px 0 8px}.aov-r h3:first-child{margin-top:0}
.aov-g{width:100%;background:#1e1e24;border-radius:12px;display:block}.aov-g text{fill:#e4e4e7;font-size:10px}
.aov-bk{font-size:13px;border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin-bottom:6px;background:#fff}.aov-bk b{display:block;font-size:12.5px;color:#6d28d9}
.aoc-mx th.aoc-vt{writing-mode:vertical-rl;transform:rotate(180deg);height:150px;text-transform:none;letter-spacing:0;font-weight:500;font-size:12px;padding:8px 4px;white-space:nowrap}
.aoc-mx td.aoc-y{background:var(--green-soft);color:var(--green);text-align:center;font-weight:700;padding:6px}.aoc-mx td.aoc-n{text-align:center;color:#d0d5df;padding:6px}
.aoc-mx tr[data-dh]{cursor:pointer}
.aoc-kv{display:grid;grid-template-columns:130px 1fr;gap:8px 12px;font-size:14px}.aoc-kv>span{color:var(--muted)}
.aoc-sk{border:1px solid var(--line);border-radius:12px;padding:9px 12px;margin-bottom:8px;display:flex;flex-direction:column;gap:2px}.aoc-sk span{color:var(--muted);font-size:13px}
.aoc-steps{display:flex;flex-wrap:wrap;gap:4px;align-items:center;color:#c3c8d6;margin-top:4px}.aoc-steps i{font-style:normal;background:var(--gray-soft);color:var(--ink);border-radius:8px;padding:2px 8px;font-size:12.5px}
.aoc-log{display:flex;gap:10px;padding:6px 0;border-bottom:1px dashed var(--line);font-size:13.5px}.aoc-log time{color:var(--muted);width:46px;flex:none;font-variant-numeric:tabular-nums}
.aoc-dtabs{display:flex;gap:2px;border-bottom:1px solid var(--line);margin:4px 0 10px;overflow-x:auto}.aoc-dtabs button{border:0;background:none;padding:8px 10px;font-weight:600;color:var(--muted);cursor:pointer;border-bottom:3px solid transparent;white-space:nowrap}.aoc-dtabs button.on{color:var(--ink);border-bottom-color:var(--pink)}
.aoc-form{display:grid;gap:10px}.aoc-form label{display:grid;gap:4px;font-size:13px;color:var(--muted)}
.aoc-doc{width:100%;text-align:left;background:#fff;cursor:pointer;font:inherit;color:inherit}.aoc-doc:hover{border-color:#a5b4fc;background:#fafaff}.aoc-doc code{font-size:11.5px;color:var(--muted);word-break:break-all}.aoc-doc em{font-style:normal;font-size:12px;color:#4b54d1;font-weight:600}
.aoc-md{font-size:14px;line-height:1.6;min-width:0}.aoc-md h2,.aoc-md h3,.aoc-md h4{margin:14px 0 6px}.aoc-md p{margin:6px 0}.aoc-md code{background:var(--gray-soft);border-radius:4px;padding:0 4px;font-size:13px}.aoc-pre{background:#1e1e24;color:#e4e4e7;border-radius:10px;padding:10px 12px;overflow-x:auto;font-size:12.5px;white-space:pre}
@media(max-width:1100px){.aov{grid-template-columns:1fr}.aov-r{border-left:0;border-top:1px solid var(--line)}.aoc-kp{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
</style>`;
const aopA=id=>(AOP.data&&AOP.data.agents||[]).find(a=>a.id===id);
/* Đổi chữ kỹ thuật máy chủ gửi lên thành lời dễ hiểu (giữ nguyên bản gốc trong title để kỹ thuật tra). */
const AOP_JOB=[[/skill-collection-review-[a-z0-9-]+/gi,"Tự ôn lại skill"]];
const AOP_ERR=[
 [/timed? ?out/i,"Chạy quá giờ, lượt bị dừng giữa chừng"],
 [/superseded|plugin generation/i,"Lượt bị huỷ vì máy chủ vừa nạp lại cấu hình (không sao)"],
 [/429|rate.?limit|quota|hết hạn mức/i,"Gói AI hết hạn mức"],
 [/run failed|model[: ]/i,"Gói AI không trả lời"],
 [/no callable tools/i,"Agent thiếu công cụ để chạy việc này"],
 [/unauthori[sz]ed|401|403/i,"Bị từ chối quyền"],
 [/ECONN|network|fetch failed|socket/i,"Mất kết nối mạng"]];
function aopJob(t){let x=String(t||"");for(const [r,v] of AOP_JOB)x=x.replace(r,v);return x}
function aopErr(t){const x=String(t||"");if(!x)return "";const job=x.includes(":")?aopJob(x.slice(0,x.indexOf(":"))).trim():"";const hit=AOP_ERR.find(([r])=>r.test(x));const msg=hit?hit[1]:"Lỗi kỹ thuật";return job&&job.length<80?job+": "+msg:msg}
const aopSt=a=>{if(!a)return"unk";const s=a.status;if(s)return s.state||"idle";return a.pending>0?"work":"unk"}; /* số cũ vẫn hiện trạng thái lần gần nhất, kèm giờ */
const aopPill=s=>`<span class="pill ${AOP_ST[s][0]}">${AOP_ST[s][1]}</span>`;
const aopAv=a=>`<span class="aoc-av" style="--c:${esc(a.color||"#64748b")}">${esc(a.emoji||"🤖")}</span>`;
const aopTask=a=>{const s=a.status;if(s&&s.task)return s.task;if(a.pending>0)return `Đang trả lời ${a.pending} tin nhắn trên web`;if(!s)return "Chưa có tin từ máy chủ";if(s.state==="off")return "Đang tắt";if(s.state==="err")return s.last_error?aopErr(s.last_error):"Lượt chạy gần nhất bị lỗi";return s.next_run?"Rảnh · lượt tới "+aopJob(s.next_run):"Không có việc"};
const aopName=x=>{const a=aopA(x);return a?a.name:x};
const aopDepts=()=>(AOP.data.depts||[]).slice().sort((a,b)=>(a.sort||0)-(b.sort||0));
const aopMembers=d=>(AOP.data.agents||[]).filter(a=>a.dept===d).sort((a,b)=>a.sort-b.sort);
const aopNotes=(d,k)=>(AOP.data.notes||[]).filter(n=>n.dept===d&&n.kind===k);
const aopTime=s=>{try{return new Date(s).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}catch(e){return""}};
const aopToday=s=>{try{return new Date(s).toDateString()===new Date().toDateString()}catch(e){return false}};
const aopId=id=>"o-"+String(id).replace(/[^a-z0-9]/gi,"_");

async function aopLoad(force){
  if(AOP.busy)return AOP.busy;if(!force&&AOP.data&&Date.now()-AOP.at<30000)return;
  AOP.busy=svApi("/api/agent-ops").then(d=>{AOP.data=d;AOP.at=Date.now();AOP.err=""},e=>{AOP.err=e.message||"lỗi";AOP.at=Date.now()}).finally(()=>{AOP.busy=null});
  return AOP.busy;
}
/* Gọi từ acGrid (trang Điều hành agent, chưa mở khung chat). */
function aopRender(auto){
  const R=acRoot();if(!R)return;
  if(!document.getElementById("aop-css"))document.head.insertAdjacentHTML("beforeend",AOP_CSS);
  if(!AOP.data){if(AOP.err){R.innerHTML=`<div class="err box">Chưa tải được sơ đồ agent: ${esc(AOP.err)} <button class="btn sm" id="aop-retry">Thử lại</button></div>`;$("#aop-retry").onclick=()=>{AOP.err="";aopRender(false)};return}
    R.innerHTML='<div class="hint">Đang tải sơ đồ agent…</div>';aopLoad(true).then(()=>setTimeout(()=>{if(!AC.cur&&PAGE==="agentchat"&&acRoot())aopRender(true)},0));return}
  if(auto&&R.querySelector(".aov-add:not([hidden])"))return; // đang gõ ghi chú thì không vẽ lại
  const tabs=[["org","Sơ đồ tổ chức"],["brain","Bộ não phòng ban"],["cap","Năng lực agent"],["perm","Quyền nhắn agent"]];
  const d=AOP.data;
  R.innerHTML=`${AOP.err?`<div class="err box">Chưa tải được: ${esc(AOP.err)}</div>`:""}${d.status_fresh?"":`<div class="warn aoc-banner">${d.status_at?`Máy chủ agent gửi trạng thái lần cuối lúc ${esc(aopTime(d.status_at))} (${esc(acAgo(d.status_at))}). Trang đang hiện số của lần đó; máy chủ gửi lại thì tự cập nhật.`:"Máy chủ agent chưa gửi trạng thái lần nào. Sơ đồ, phòng ban và skill vẫn xem được."}</div>`}
   <div class="tabs">${tabs.map(t=>`<button data-dht="${t[0]}" class="${AOP.tab===t[0]?"on":""}">${t[1]}</button>`).join("")}<span style="flex:1"></span><button class="btn sm" id="dh-reload">↻ Cập nhật</button></div>
   <div id="dh-body">${AOP.tab==="org"?aopOrg():AOP.tab==="brain"?aopBrain():AOP.tab==="cap"?aopCap():'<div id="ac-access"></div>'}</div>`;
  R.querySelectorAll("[data-dht]").forEach(b=>b.onclick=()=>{AOP.tab=b.dataset.dht;aopRender()});
  $("#dh-reload").onclick=()=>aopLoad(true).then(()=>aopRender());
  R.querySelectorAll("[data-dha]").forEach(b=>b.onclick=e=>{e.stopPropagation();aopOpen(b.dataset.dha)});
  R.querySelectorAll("[data-dhd]").forEach(b=>b.onclick=()=>{AOP.dept=b.dataset.dhd;AOP.tab="brain";aopRender();scrollTo(0,0)});
  if(AOP.tab==="org")requestAnimationFrame(aopWires);
  if(AOP.tab==="brain")aopBindBrain();
  if(AOP.tab==="perm")acAccess();
  aopLoad(false); // làm mới ngầm; lần vẽ sau dùng số mới
}
function aopKpi(){const L=AOP.data.agents,n=s=>L.filter(a=>aopSt(a)===s).length,tok=L.reduce((s,a)=>s+(a.status&&a.status.tokens_today||0),0);
  return `<div class="grid kpis aoc-kp">${[["Đang làm",n("work"),"lượt đang chạy","t-grn"],["Chờ · kẹt · lỗi",n("wait")+n("stuck")+n("err"),"cần để ý","t-red"],["Rảnh · tắt",n("idle")+n("off"),n("off")+" agent đang tắt",""],["Token hôm nay",tok?Math.round(tok/1000)+"k":"—",AOP.data.status_fresh?"theo máy chủ agent":"chưa có số",""]].map(([l,v,h,c])=>`<div class="kpi"><div class="l">${l}</div><div class="v ${c}">${v}</div><div class="h">${h}</div></div>`).join("")}</div>`}
function aopNode(a,big){
  if(a==="ceo")return `<div class="og-n og-ceo" id="${aopId("ceo")}"><span class="aoc-av" style="--c:#e7357b">👩‍💼</span><div><b>CEO</b><small>Giao việc, duyệt, chốt quyết định</small></div></div>`;
  if(typeof a==="string")return `<div class="og-n og-p" id="${aopId("p:"+a)}"><span class="aoc-av" style="--c:#c4b5fd">👤</span><div><b>${esc(a)}</b><small>người thật</small></div></div>`;
  const s=aopSt(a),w=a.status&&AOP.data.status_fresh?a.status.wait_for:"";
  return `<button class="og-n ${s}${big?" big":""}" id="${aopId(a.id)}" data-dha="${esc(a.id)}" style="--s:${AOP_ST[s][2]}">${aopAv(a)}<div style="min-width:0"><b>${esc(a.name)}</b> ${aopPill(s)}<small>${esc(aopTask(a))}</small>${!AOP.data.status_fresh&&a.status&&a.status.updated_at?`<small>số lúc ${esc(aopTime(a.status.updated_at))}</small>`:""}${w?`<em>⏳ chờ ${esc(aopName(w))}${a.status.since?" · từ "+esc(a.status.since):""}</em>`:""}</div></button>`;
}
function aopTree(d){const M=aopMembers(d),top=M.filter(a=>!a.parent||!M.some(x=>x.id===a.parent));
  return top.map(t=>`<div class="og-col">${aopNode(t,1)}<div class="og-subs">${M.filter(a=>a.parent===t.id).map(a=>aopNode(a)).join("")}</div></div>`).join("")}
function aopOrg(){
  const D=aopDepts(),top=D[0],rest=D.slice(1),lost=AOP.data.agents.filter(a=>!a.dept);
  return `${aopKpi()}<section class="card og-wrap" id="og"><div class="og-row">${aopNode("ceo")}</div>
   ${top?`<div class="og-row" id="${aopId("d-"+top.id)}">${aopMembers(top.id).map(a=>aopNode(a,1)).join("")}</div>`:""}
   <div class="og-depts" style="grid-template-columns:${rest.map(d=>{const M=aopMembers(d.id);return Math.max(1,M.filter(x=>!x.parent||!M.some(y=>y.id===x.parent)).length)+"fr"}).join(" ")};min-width:${Math.max(860,rest.reduce((t,d)=>{const M=aopMembers(d.id);return t+250*Math.max(1,M.filter(x=>!x.parent||!M.some(y=>y.id===x.parent)).length)},0))}px">${rest.map(d=>{const M=aopMembers(d.id),bad=M.filter(a=>["err","stuck","wait"].includes(aopSt(a))).length,P=aopNotes(d.id,"person");
     return `<div class="og-dept" id="${aopId("d-"+d.id)}"><button class="og-dh" data-dhd="${esc(d.id)}"><span>${esc(d.icon||"📁")} Phòng ${esc(d.name)}</span>${bad?`<span class="pill p-amb">${bad} cần để ý</span>`:`<span class="pill p-grn">ổn</span>`}<span class="og-open">Mở bộ não ›</span></button>
      <div class="og-cols">${aopTree(d.id)||'<div class="hint">Chưa có agent.</div>'}</div>${P.length?`<div class="og-subs" style="padding-left:0">${P.map(p=>aopNode(p.title)).join("")}</div>`:""}</div>`}).join("")}</div>
   ${lost.length?`<div class="hint" style="position:relative;z-index:2">Chưa xếp phòng: ${lost.map(a=>`<a class="lnk" data-dha="${esc(a.id)}">${esc(a.name)}</a>`).join(", ")}</div>`:""}
   <svg id="ogsvg"></svg></section>
   <div class="og-leg"><span><i style="background:#7c3aed"></i>Đang giao việc</span><span><i style="background:#d97706"></i>Đang chờ</span><span><i style="background:#cbd2e0"></i>Cấp trên – cấp dưới</span><span class="hint">Bấm agent để xem hồ sơ · bấm tên phòng để mở bộ não của phòng</span></div>`;
}
function aopWires(){
  const box=$("#og"),svg=$("#ogsvg");if(!box||!svg)return;const R=box.getBoundingClientRect();svg.setAttribute("width",R.width);svg.setAttribute("height",R.height);
  const b=id=>{const e=document.getElementById(aopId(id));if(!e)return null;const r=e.getBoundingClientRect();return{x:r.left+r.width/2-R.left,t:r.top-R.top,bt:r.bottom-R.top,l:r.left-R.left,y:r.top+r.height/2-R.top}};
  const down=(P,Q,c,w,fl)=>`<path d="M${P.x},${P.bt} C${P.x},${(P.bt+Q.t)/2} ${Q.x},${(P.bt+Q.t)/2} ${Q.x},${Q.t}" stroke="${c}" stroke-width="${w}"${fl?' class="fl"':""}/>`;
  const side=(P,Q,c,fl)=>`<path d="M${P.l},${P.y} C${P.l-26},${P.y} ${Q.l-26},${Q.y} ${Q.l},${Q.y}" stroke="${c}" stroke-width="${fl?2.5:2}"${fl?' class="fl"':""}/>`;
  const up=(P,Q,c)=>`<path d="M${P.x},${P.t} C${P.x},${P.t-50} ${Q.x},${Q.bt+50} ${Q.x},${Q.bt}" stroke="${c}" stroke-width="2.5" class="fl"/>`;
  const D=aopDepts();let h="";const C=b("ceo"),T=D[0]&&b("d-"+D[0].id);
  if(C&&T)h+=down(C,T,"#cbd2e0",2);
  D.slice(1).forEach(d=>{const Q=b("d-"+d.id);if(T&&Q)h+=down(T,Q,"#cbd2e0",2)});
  AOP.data.agents.forEach(a=>{if(!a.parent)return;const P=b(a.parent),Q=b(a.id);if(P&&Q)h+=side(P,Q,"#dfe3ec")});
  const live=(f,t,c)=>{const P=b(f),Q=b(t);if(!P||!Q||f===t)return;if(Math.abs(P.l-Q.l)<40)h+=side(P,Q,c,1);else if(Q.t>P.bt)h+=down(P,Q,c,2.5,1);else h+=up(P,Q,c)};
  const fresh=AOP.data.status_fresh,people=new Set((AOP.data.notes||[]).filter(n=>n.kind==="person").map(n=>n.title));
  const tgt=x=>aopA(x)?x:/^ceo$/i.test(x)?"ceo":people.has(x)?"p:"+x:null;
  (AOP.data.logs||[]).filter(l=>l.kind==="giao"&&l.to_agent&&aopToday(l.at)).slice(0,30).forEach(l=>{const t=tgt(l.to_agent);if(t)live(l.agent,t,"#7c3aed")});
  if(fresh)AOP.data.agents.forEach(a=>{const w=a.status&&a.status.wait_for;const t=w&&tgt(w);if(t)live(a.id,t,"#d97706")});
  svg.innerHTML=h;
}
window.addEventListener("resize",()=>{if(typeof PAGE!=="undefined"&&PAGE==="agentchat"&&AOP.tab==="org")aopWires()});

/* ---------- Bộ não phòng ban (học theo kho ghi chú Obsidian) ---------- */
function aopBrain(){
  const D=aopDepts();if(!D.some(d=>d.id===AOP.dept)&&D[0])AOP.dept=D[0].id;
  const d=D.find(x=>x.id===AOP.dept);if(!d)return '<div class="hint">Chưa có phòng ban.</div>';
  const M=aopMembers(d.id),ids=new Set(M.map(a=>a.id)),busy=M.filter(a=>aopSt(a)==="work").length,prob=M.filter(a=>["err","stuck","wait"].includes(aopSt(a))).length;
  const wl=(t,id)=>id?`<button class="aov-wl" data-dha="${esc(id)}">${esc(t)}</button>`:`<span class="aov-wl">${esc(t)}</span>`;
  const tree=D.map(v=>{const L=aopMembers(v.id);return `<button class="aov-ti${v.id===d.id?" on":""}" data-dhb="${esc(v.id)}">📁 Phòng ${esc(v.name)}</button>${v.id===d.id?`<div class="aov-tsub"><div class="aov-ti">🤖 Agent (${L.length})</div>${L.map(a=>`<button class="aov-ti aov-tag" data-dha="${esc(a.id)}"><i style="background:${AOP_ST[aopSt(a)][2]}"></i>${esc(a.name)}</button>`).join("")}<div class="aov-ti">📜 Quy trình</div><div class="aov-ti">📚 Kiến thức chung (${aopNotes(v.id,"kn").length})</div><div class="aov-ti">🗓 Nhật ký ngày</div><div class="aov-ti">✅ Quyết định đã chốt (${aopNotes(v.id,"decision").length})</div></div>`:`<div class="aov-tmeta">${L.length} agent · ${aopNotes(v.id,"kn").length} tài liệu</div>`}`}).join("");
  const crons=M.flatMap(a=>(a.crons||[]).map(c=>({...c,a})));
  const logs=(AOP.data.logs||[]).filter(l=>ids.has(l.agent)&&aopToday(l.at));
  const back=(AOP.data.logs||[]).filter(l=>!ids.has(l.agent)&&l.to_agent&&ids.has(l.to_agent)).slice(0,6);
  const note=n=>`<div class="aov-note"><span class="act"><button data-dhe="${n.id}">Sửa</button><button data-dhx="${n.id}">Xoá</button></span><span class="aov-wl">${esc(n.title)}</span>${n.body?`<p>${esc(n.body)}</p>`:""}</div>`;
  const addForm=k=>`<button class="btn sm" data-dhadd="${k}">+ Thêm</button><div class="aov-add" id="dh-add-${k}" hidden><input id="dh-t-${k}" placeholder="Tiêu đề" maxlength="200"><textarea id="dh-b-${k}" rows="3" placeholder="Nội dung (không bắt buộc)"></textarea><div style="display:flex;gap:6px"><button class="btn sm pri" data-dhsave="${k}">Lưu</button><button class="btn sm" data-dhcancel="${k}">Huỷ</button></div></div>`;
  return `<div class="aov"><div class="aov-t"><div class="aov-th">Bộ não AILLA</div>${tree}<button class="aov-ti add" data-dhnew="1">+ Thêm phòng ban</button></div>
   <div class="aov-n"><div class="hint">Bộ não AILLA / Phòng ${esc(d.name)}</div><h1>${esc(d.icon||"📁")} Phòng ${esc(d.name)} <button class="btn sm" data-dhedit="${esc(d.id)}">Sửa phòng</button></h1>
    <div class="aov-props"><span>Trưởng phòng</span><b>${esc(d.lead_role||"—")}</b><span>Agent trưởng</span><div>${d.agent_lead&&aopA(d.agent_lead)?wl(aopName(d.agent_lead),d.agent_lead):"—"}</div><span>Mục tiêu</span><div>${esc(d.goal||"—")}</div><span>Lúc này</span><div>${busy} agent đang làm${prob?` · <b class="t-amb">${prob} cần để ý</b>`:""}</div></div>
    <h2>🤖 Thành viên</h2><ul>${M.map(a=>`<li>${wl(a.name,a.id)} ${aopPill(aopSt(a))} <span class="aov-s">${esc(aopTask(a))}</span></li>`).join("")||'<li class="hint">Chưa có agent.</li>'}</ul>
    ${aopNotes(d.id,"person").length?`<p class="aov-s hint">Người thật trong phòng: ${aopNotes(d.id,"person").map(p=>esc(p.title)).join(", ")}</p>`:""}
    <h2>📜 Quy trình của phòng <span class="aov-h2">lịch chạy của các agent trong phòng</span></h2>${crons.length?`<ul>${crons.map(c=>`<li><span class="aov-wl">${esc(aopJob(c.name))}</span> <span class="aov-s hint">· ${esc(c.a.name)}${c.when?" · "+esc(c.when):""}${c.next?" · lượt tới "+esc(c.next):""}</span>${c.steps&&c.steps.length?`<div class="aoc-steps">${c.steps.map(s=>`<i>${esc(s)}</i>`).join("›")}</div>`:""}</li>`).join("")}</ul>`:'<p class="hint">Máy chủ agent chưa gửi lịch chạy.</p>'}
    <h2>📚 Kiến thức chung <span class="aov-h2">agent nào trong phòng cũng đọc · agent mới vào phòng tự có</span></h2>${aopNotes(d.id,"kn").map(note).join("")||'<p class="hint">Chưa có tài liệu.</p>'}${addForm("kn")}
    <h2>🗓 Nhật ký hôm nay <span class="aov-h2">agent tự ghi</span></h2>${logs.length?logs.map(l=>`<div class="aoc-log"><time>${aopTime(l.at)}</time><span>${wl(aopName(l.agent),l.agent)} ${esc(l.kind==="loi"?aopErr(l.text):aopJob(l.text))}</span></div>`).join(""):'<p class="hint">Hôm nay chưa có ghi chép.</p>'}
    <h2>✅ Quyết định đã chốt <span class="aov-h2">agent trong phòng phải theo</span></h2>${aopNotes(d.id,"decision").map(note).join("")||'<p class="hint">Chưa có quyết định.</p>'}${addForm("decision")}</div>
   <div class="aov-r"><h3>Sơ đồ phòng</h3>${aopGraph(d,M)}
    <h3>Được nhắc tới ở (${back.length})</h3>${back.map(l=>`<div class="aov-bk"><b>${esc(aopName(l.agent))}</b>${esc(l.kind==="loi"?aopErr(l.text):aopJob(l.text))}</div>`).join("")||'<p class="hint">Chưa có.</p>'}
    <h3>Phòng khác</h3>${D.filter(x=>x.id!==d.id).map(x=>`<div style="margin:5px 0"><button class="aov-wl" data-dhb="${esc(x.id)}">Phòng ${esc(x.name)}</button></div>`).join("")}</div></div>`;
}
function aopGraph(d,M){
  const W=260,H=230,cx=W/2,cy=H/2-6,kn=aopNotes(d.id,"kn");let s=`<svg viewBox="0 0 ${W} ${H}" class="aov-g" role="img" aria-label="Sơ đồ phòng ${esc(d.name)}">`;
  const pa=M.map((a,i)=>{const t=i/Math.max(1,M.length)*6.283-1.57;return[cx+Math.cos(t)*62,cy+Math.sin(t)*56]});
  const pk=kn.map((k,i)=>{const t=i/Math.max(1,kn.length)*6.283-1.2;return[cx+Math.cos(t)*108,cy+Math.sin(t)*92]});
  pa.forEach(p=>s+=`<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="#55556a"/>`);
  pk.forEach(p=>pa.forEach(q=>s+=`<line x1="${q[0]}" y1="${q[1]}" x2="${p[0]}" y2="${p[1]}" stroke="#34343f"/>`));
  s+=`<circle cx="${cx}" cy="${cy}" r="13" fill="#a78bfa"/>`;pk.forEach(p=>s+=`<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="#34d399"/>`);
  pa.forEach((p,i)=>s+=`<circle cx="${p[0]}" cy="${p[1]}" r="8" fill="${AOP_ST[aopSt(M[i])][2]}"/><text x="${p[0]}" y="${p[1]+(p[1]<cy?-12:20)}" text-anchor="middle">${esc(M[i].name)}</text>`);
  return s+`</svg><div class="hint" style="font-size:12px">● tím: phòng · ● màu: agent theo trạng thái · ● xanh lá: kiến thức</div>`;
}
function aopBindBrain(){
  const R=acRoot();
  R.querySelectorAll("[data-dhb]").forEach(b=>b.onclick=()=>{AOP.dept=b.dataset.dhb;aopRender()});
  R.querySelectorAll("[data-dhadd]").forEach(b=>b.onclick=()=>{const f=$("#dh-add-"+b.dataset.dhadd);f.hidden=false;b.hidden=true;$("#dh-t-"+b.dataset.dhadd).focus()});
  R.querySelectorAll("[data-dhcancel]").forEach(b=>b.onclick=()=>{$("#dh-add-"+b.dataset.dhcancel).hidden=true;aopRender()});
  R.querySelectorAll("[data-dhsave]").forEach(b=>b.onclick=async()=>{const k=b.dataset.dhsave,t=$("#dh-t-"+k).value.trim();if(!t){toast("Nhập tiêu đề trước");return}
    b.disabled=true;try{await svApi("/api/agent-ops/note",{method:"POST",body:JSON.stringify({dept:AOP.dept,kind:k,title:t,body:$("#dh-b-"+k).value})});$("#dh-add-"+k).hidden=true;toast("Đã lưu");await aopLoad(true);aopRender()}catch(e){toast(e.message);b.disabled=false}});
  R.querySelectorAll("[data-dhx]").forEach(b=>b.onclick=async()=>{if(b.dataset.ok!=="1"){b.dataset.ok="1";b.textContent="Bấm lần nữa để xoá";return}
    try{await svApi("/api/agent-ops/note/"+b.dataset.dhx,{method:"DELETE"});toast("Đã xoá");await aopLoad(true);aopRender()}catch(e){toast(e.message)}});
  R.querySelectorAll("[data-dhe]").forEach(b=>b.onclick=()=>{const n=(AOP.data.notes||[]).find(x=>String(x.id)===b.dataset.dhe);if(!n)return;
    openDrawerHTML(`<h2>Sửa ghi chú</h2><div class="aoc-form"><label>Tiêu đề<input id="dh-et" value="${esc(n.title)}" maxlength="200"></label><label>Nội dung<textarea id="dh-eb" rows="8">${esc(n.body||"")}</textarea></label><button class="btn pri" id="dh-es">Lưu</button></div>`);
    $("#dh-es").onclick=async()=>{try{await svApi("/api/agent-ops/note/"+n.id,{method:"PUT",body:JSON.stringify({title:$("#dh-et").value,body:$("#dh-eb").value})});closeDrawer();toast("Đã lưu");await aopLoad(true);aopRender()}catch(e){toast(e.message)}}});
  R.querySelectorAll("[data-dhedit],[data-dhnew]").forEach(b=>b.onclick=()=>aopDeptForm(b.dataset.dhedit||""));
}
function aopDeptForm(id){
  const d=(AOP.data.depts||[]).find(x=>x.id===id)||{id:"",name:"",icon:"📁",lead_role:"",agent_lead:"",goal:""};
  openDrawerHTML(`<h2>${id?"Sửa phòng "+esc(d.name):"Thêm phòng ban"}</h2><div class="aoc-form">
   <label>Tên phòng<input id="dh-dn" value="${esc(d.name)}" maxlength="60"></label><label>Biểu tượng<input id="dh-di" value="${esc(d.icon||"")}" maxlength="4"></label>
   <label>Trưởng phòng (vai người)<input id="dh-dl" value="${esc(d.lead_role||"")}" maxlength="60" placeholder="Ví dụ: Lead Sale"></label>
   <label>Agent trưởng<select id="dh-da"><option value="">—</option>${AOP.data.agents.map(a=>`<option value="${esc(a.id)}"${a.id===d.agent_lead?" selected":""}>${esc(a.name)}</option>`).join("")}</select></label>
   <label>Mục tiêu<input id="dh-dg" value="${esc(d.goal||"")}" maxlength="200"></label><button class="btn pri" id="dh-ds">Lưu</button></div>`);
  $("#dh-ds").onclick=async()=>{const name=$("#dh-dn").value.trim();if(!name){toast("Nhập tên phòng");return}
    const nid=id||("p"+Date.now().toString(36));
    try{await svApi("/api/agent-ops/dept/"+nid,{method:"PUT",body:JSON.stringify({name,icon:$("#dh-di").value,lead_role:$("#dh-dl").value,agent_lead:$("#dh-da").value,goal:$("#dh-dg").value,sort:id?d.sort:99})});closeDrawer();toast("Đã lưu");AOP.dept=nid;await aopLoad(true);aopRender()}catch(e){toast(e.message)}};
}

/* ---------- Năng lực ---------- */
function aopCap(){
  const L=AOP.data.agents,all=[...new Set(L.flatMap(a=>a.skills||[]))];
  const grp=s=>/^(facebook|meta|caption-ads)/.test(s)?"Facebook":/^tiktok/.test(s)?"TikTok":/^(bao-cao|ke-khai|lap-|nap-|phan-tich|quan-ly|tinh-luong)/.test(s)?"Kế toán":"Chung";
  const G=["Chung","Facebook","TikTok","Kế toán"].map(g=>[g,all.filter(s=>grp(s)===g).sort()]).filter(g=>g[1].length),flat=G.flatMap(g=>g[1]);
  const poor=L.filter(a=>(a.skills||[]).length<=1);
  return `${poor.length?`<div class="warn">${poor.length} agent mới có tối đa 1 skill, gần như chưa được dạy việc: ${poor.map(a=>esc(a.name)).join(", ")}.</div>`:""}
  <section class="card flush"><div class="card-h pad"><h2>Ai có skill gì</h2><span class="hint">theo máy chủ agent · bấm tên agent để xem chi tiết</span></div><div class="tbl"><table class="aoc-mx"><thead><tr><th>Agent</th>${G.map(g=>`<th colspan="${g[1].length}" style="text-align:center">${g[0]}</th>`).join("")}<th class="n">Tổng</th></tr><tr><th></th>${flat.map(s=>`<th class="aoc-vt">${esc(s)}</th>`).join("")}<th></th></tr></thead>
  <tbody>${L.map(a=>`<tr data-dha="${esc(a.id)}"><td class="nowrap">${esc(a.emoji)} <b>${esc(a.name)}</b></td>${flat.map(s=>(a.skills||[]).includes(s)?'<td class="aoc-y">✓</td>':'<td class="aoc-n">·</td>').join("")}<td class="n"><b>${(a.skills||[]).length}</b></td></tr>`).join("")}</tbody></table></div></section>`;
}

/* ---------- Hồ sơ agent (ngăn bên phải) ---------- */
function aopOpen(id){AOP.dtab="now";aopDraw(id)}
function aopDraw(id){
  const a=aopA(id);if(!a)return;const s=a.status||{},fresh=AOP.data.status_fresh,st=aopSt(a);
  const tabs=[["now","Đang làm"],["sk",`Skill (${(a.skills||[]).length})`],["kn",`Kiến thức (${(a.knowledge||[]).length})`],["wf",`Workflow (${(a.crons||[]).length})`],["his","Nhật ký"],["dept","Phòng ban"]];
  let b="";
  if(AOP.dtab==="now")b=`<div class="aoc-kv"><span>Trạng thái</span><div>${aopPill(st)}${s.updated_at?` <span class="hint">cập nhật ${esc(acAgo(s.updated_at))}</span>`:""}</div><span>Việc đang làm</span><b>${esc(aopTask(a))}</b>
    <span>Ai giao</span><div>${esc(fresh&&s.by||"—")}</div><span>Đang chờ</span><div>${fresh&&s.wait_for?esc(aopName(s.wait_for))+(s.since?" · từ "+esc(s.since):""):"—"}</div>
    <span>Phối hợp với</span><div>${fresh&&s.with&&s.with.length?s.with.map(x=>esc(aopName(x))).join(", "):"—"}</div><span>Lượt tới</span><div>${esc(aopJob(s.next_run)||"—")}</div>
    <span>Token hôm nay</span><div>${s.tokens_today!=null?Math.round(s.tokens_today/1000)+"k":"—"}</div><span>Lỗi gần nhất</span><div class="${s.last_error?"t-red":""}" title="${esc(s.last_error||"")}">${esc(s.last_error?aopErr(s.last_error):"Không có")}</div>
    <span>Tin chờ trả lời</span><div>${a.pending||0}</div></div>`;
  if(AOP.dtab==="sk")b=`<p class="hint">Bấm một skill để mở xem nội dung. Đường dẫn là chỗ lưu trên máy chủ agent.</p>`+((a.skills||[]).map(x=>aopDocRow(a,"skill",x)).join("")||'<p class="hint">Chưa có skill.</p>');
  if(AOP.dtab==="kn"){const dn=a.dept?aopNotes(a.dept,"kn"):[];b=`<p class="hint">Bấm một file để mở xem nội dung.</p>`+((a.knowledge||[]).map(x=>aopDocRow(a,"kn",x)).join("")||'<p class="hint">Chưa có.</p>')+(dn.length?`<p class="hint">Cộng kiến thức chung của phòng (xem ở tab Bộ não phòng ban): ${dn.map(n=>esc(n.title)).join(", ")}</p>`:"")}
  if(AOP.dtab==="wf")b=(a.crons||[]).map(c=>`<div class="aoc-sk"><b>${esc(aopJob(c.name))}</b><span>⏰ ${esc(c.when||"")}${c.next?" · lượt tới "+esc(c.next):""}${c.last?" · lần trước "+esc(c.last):""}</span>${c.steps&&c.steps.length?`<div class="aoc-steps">${c.steps.map(x=>`<i>${esc(x)}</i>`).join("›")}</div>`:""}</div>`).join("")||'<p class="hint">Máy chủ chưa gửi lịch chạy, hoặc agent chỉ làm khi được nhắn.</p>';
  if(AOP.dtab==="his")b=(AOP.data.logs||[]).filter(l=>l.agent===a.id||l.to_agent===a.id).slice(0,40).map(l=>`<div class="aoc-log"><time>${aopTime(l.at)}</time><span>${l.agent===a.id?"":esc(aopName(l.agent))+" → "}${esc(l.kind==="loi"?aopErr(l.text):aopJob(l.text))}</span></div>`).join("")||'<p class="hint">Chưa có ghi chép trong 2 ngày qua.</p>';
  if(AOP.dtab==="dept"){const D=aopDepts(),M=a.dept?aopMembers(a.dept).filter(x=>x.id!==a.id):[];
    b=`<div class="aoc-form"><label>Phòng<select id="dh-md">${D.map(d=>`<option value="${esc(d.id)}"${d.id===a.dept?" selected":""}>${esc(d.name)}</option>`).join("")}</select></label>
     <label>Cấp trên<select id="dh-mp"><option value="">— đứng đầu phòng —</option>${M.map(x=>`<option value="${esc(x.id)}"${x.id===a.parent?" selected":""}>${esc(x.name)}</option>`).join("")}</select></label><button class="btn pri" id="dh-ms">Lưu</button></div>`}
  openDrawerHTML(`<div style="display:flex;gap:12px;align-items:center">${aopAv(a)}<div><h2 style="margin:0">${esc(a.name)}</h2><span class="hint">${esc(a.title||"")}</span></div></div>
   <div class="aoc-dtabs">${tabs.map(t=>`<button data-dhdt="${t[0]}" class="${AOP.dtab===t[0]?"on":""}">${t[1]}</button>`).join("")}</div><div>${b}</div>
   ${a.chat?`<div style="margin-top:auto"><button class="btn pri" id="dh-chat">💬 Nhắn ${esc(a.name)}</button></div>`:""}`);
  $$("[data-dhdt]").forEach(x=>x.onclick=()=>{AOP.dtab=x.dataset.dhdt;aopDraw(id)});
  $$("[data-aodoc]").forEach(x=>x.onclick=()=>aopDocView(a.id,x.dataset.aokind,x.dataset.aodoc));
  if($("#dh-chat"))$("#dh-chat").onclick=()=>{closeDrawer();acPick(a.id)};
  if($("#dh-ms"))$("#dh-ms").onclick=async()=>{try{await svApi("/api/agent-ops/member/"+a.id,{method:"PUT",body:JSON.stringify({dept:$("#dh-md").value,parent:$("#dh-mp").value,sort:a.sort})});toast("Đã xếp lại");closeDrawer();await aopLoad(true);aopRender()}catch(e){toast(e.message)}};
}

/* ---------- Xem nội dung skill / file kiến thức ---------- */
/* Chỗ lưu trên máy chủ agent: máy chủ gửi kèm đường dẫn thật; chưa gửi thì đoán theo cách OpenClaw xếp thư mục. */
function aopDocPath(a,kind,name){
  const d=(a.docs||[]).find(x=>x.kind===kind&&x.name===name);if(d&&d.path)return d.path;
  const ws=a.id==="main"?"/root/.openclaw/workspace":"/root/.openclaw/workspace-"+a.id;
  if(kind==="skill")return ws+"/skills/"+name+"/SKILL.md";
  if(/^tiktok\//.test(name))return "/root/.openclaw/"+name;
  return ws+"/"+name;
}
function aopDocRow(a,kind,name){
  const d=(a.docs||[]).find(x=>x.kind===kind&&x.name===name)||{};
  return `<button class="aoc-sk aoc-doc" data-aodoc="${esc(name)}" data-aokind="${kind}"><b>${kind==="kn"?"📄 ":"🧩 "}${esc(name)}</b>${d.description?`<span>${esc(d.description)}</span>`:""}<code>${esc(aopDocPath(a,kind,name))}</code><em>${d.has_body?`Mở xem${d.file_at?" · sửa "+esc(String(d.file_at).slice(0,10)):""} ›`:"Máy chủ chưa gửi nội dung"}</em></button>`;
}
/* Hiện chữ markdown cho dễ đọc (mọi chữ đều được thoát ký tự, không chạy mã). */
function aopMd(t){
  const L=String(t||"").replace(/\r/g,"").split("\n");let h="",code=false,list=false;
  const inl=x=>esc(x).replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>");
  for(const l of L){
    if(/^```/.test(l)){if(list){h+="</ul>";list=false}h+=code?"</pre>":'<pre class="aoc-pre">';code=!code;continue}
    if(code){h+=esc(l)+"\n";continue}
    const m=/^(#{1,4})\s+(.*)/.exec(l);if(m){if(list){h+="</ul>";list=false}const n=Math.min(4,m[1].length+1);h+=`<h${n}>${inl(m[2])}</h${n}>`;continue}
    if(/^\s*[-*]\s+/.test(l)){if(!list){h+="<ul>";list=true}h+=`<li>${inl(l.replace(/^\s*[-*]\s+/,""))}</li>`;continue}
    if(list){h+="</ul>";list=false}
    if(l.trim())h+=`<p>${inl(l)}</p>`;
  }
  return h+(list?"</ul>":"")+(code?"</pre>":"");
}
async function aopDocView(agent,kind,name){
  const a=aopA(agent);if(!a)return;const path=aopDocPath(a,kind,name);
  openDrawerHTML(`<button class="btn sm" id="aop-docback" style="align-self:flex-start">← ${esc(a.name)}</button><h2 style="margin:6px 0 2px">${kind==="kn"?"📄":"🧩"} ${esc(name)}</h2><div class="hint">Lưu tại: <code>${esc(path)}</code> (máy chủ agent)</div><div id="aop-docbody" class="aoc-md"><p class="hint">Đang tải…</p></div>`);
  $("#aop-docback").onclick=()=>aopDraw(agent);
  try{
    const d=await svApi("/api/agent-ops/doc?agent="+encodeURIComponent(agent)+"&kind="+kind+"&name="+encodeURIComponent(name));
    const box=$("#aop-docbody");if(!box)return;
    box.innerHTML=`${d.description?`<p><b>${esc(d.description)}</b></p>`:""}<p class="hint">${d.file_at?"Sửa trên máy chủ: "+esc(String(d.file_at).replace("T"," ").slice(0,16))+" · ":""}cập nhật lên web ${esc(acAgo(d.updated_at))}</p><button class="btn sm" id="aop-copy">Chép nội dung</button>${aopMd(d.body)}`;
    $("#aop-copy").onclick=()=>{try{navigator.clipboard.writeText(d.body||"").then(()=>toast("Đã chép"),()=>toast("Không chép được"))}catch(e){toast("Không chép được")}};
  }catch(e){const box=$("#aop-docbody");if(box)box.innerHTML=`<div class="warn">${esc(e.message)}. Khi máy chủ agent gửi nội dung lên, bấm lại là xem được.</div>`}
}
