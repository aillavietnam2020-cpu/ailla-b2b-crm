/* ---------- Huấn luyện agent ----------
   Chị dạy agent Sale và CSKH trực page: kịch bản, bảng giá, câu khách hay hỏi, ảnh/video, luật cấm.
   Agent chỉ đọc bản chị ĐÃ DUYỆT; chỗ nào chị sửa thì tự về "nháp" tới khi chị duyệt lại.
   Agent học từ hội thoại chỉ ĐỀ XUẤT, chị duyệt hoặc từ chối. Chạy thử: agent trả lời lại câu khách cũ để chị chấm.
   Nút tắt khẩn và chế độ "chỉ thử với tài khoản của chị" nằm ở tab đầu. Không có chế độ gửi cho khách thật.
   Chỉ CEO thấy. API: /api/agent-train (src/server/routes/agentTrain.ts). */
const TR={tab:"ctl",set:"",items:[],sug:[],evals:[],log:[],ov:null,ctl:null,edit:null,q:""};
const TR_ACT={"item.create":"Thêm mục","item.edit":"Sửa mục","item.approve":"Duyệt mục","item.archive":"Bỏ mục","suggestion.approve":"Duyệt đề xuất","suggestion.reject":"Từ chối đề xuất","control.kill":"BẬT tắt khẩn","control.unkill":"Gỡ tắt khẩn","control.save":"Lưu thiết lập"};
const TR_KINDS={
  script:{k:"SCRIPT",n:"Kịch bản",hint:"Câu mẫu đã duyệt theo mã (vd BT_GT1). Agent chỉ được chọn mã, không tự viết lại.",code:"Mã câu mẫu",grp:"Nhóm (vd: bột tẩy vạn năng)",title:"Khi nào dùng",body:"Nguyên văn câu mẫu",extra:"Ghi chú / mã ảnh đi kèm"},
  price:{k:"PRICE",n:"Bảng giá",hint:"Giá, combo, quà chuẩn. Giá trong câu agent trả lời mà không có ở đây sẽ bị đánh dấu lỗi.",code:"Mã",grp:"Nhóm sản phẩm",title:"Sản phẩm / combo",body:"Giá và quà (vd: 149K; combo 369K tặng...)",extra:"Điều kiện"},
  faq:{k:"FAQ",n:"Câu khách hỏi",hint:"Câu khách hay hỏi và câu trả lời chuẩn. Chưa có ở đây thì agent dừng và báo chị.",code:"Mã",grp:"Chủ đề",title:"Câu khách hỏi",body:"Câu trả lời chuẩn",extra:"Ghi chú"},
  media:{k:"MEDIA",n:"Ảnh / video",hint:"Ảnh, video đã duyệt theo nhóm vết bẩn. Dán link ảnh vào ô ghi chú.",code:"Mã ảnh/video",grp:"Nhóm vết bẩn",title:"Tên ảnh / video",body:"Dùng khi nào",extra:"Link ảnh / video"},
  rule:{k:"RULE",n:"Luật cấm",hint:"Mỗi dòng một câu/cụm từ agent KHÔNG được nói (vd câu về oxygen hoạt tính). Bắt gặp là bị đánh dấu lỗi.",code:"Mã",grp:"Nhóm",title:"Tên luật",body:"Các câu cấm (mỗi dòng một câu)",extra:"Lý do"}};
const TR_ST={DRAFT:["Nháp","amb"],APPROVED:["Đã duyệt","grn"],ARCHIVED:["Đã bỏ","gry"]};
const TR_SETS={SALE:"Sale",CSKH:"CSKH",BOTH:"Sale + CSKH"};
const TR_CSS=`<style id="tr-css">
.tr-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}
.tr-tabs button{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:7px 14px;cursor:pointer;font-weight:600;color:var(--ink)}
.tr-tabs button.on{background:var(--navy);color:#fff;border-color:transparent}
.tr-tabs .tr-n{background:var(--orange);color:#fff;border-radius:999px;font-size:12px;padding:1px 7px;margin-left:6px}
.tr-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:12px}
.tr-card h3{margin:0 0 6px;font-size:15px}
.tr-kill{border:2px solid var(--red);background:var(--red-soft)}
.tr-kill.live{border-color:var(--line);background:var(--surface)}
.tr-it{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:8px;background:var(--surface)}
.tr-it .t{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;font-weight:600}
.tr-it .b{white-space:pre-wrap;word-break:break-word;margin:6px 0;line-height:1.5}
.tr-it .x{color:var(--muted);font-size:12.5px;white-space:pre-wrap;word-break:break-all}
.tr-act{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.tr-form{display:grid;gap:8px}
.tr-form input,.tr-form textarea,.tr-form select{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;padding:8px 10px;font:inherit}
.tr-form textarea{min-height:90px}
.tr-flag{color:var(--red);font-size:13px}
.tr-cmp{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.tr-cmp>div{background:var(--gray-soft);border-radius:10px;padding:8px 10px;white-space:pre-wrap;word-break:break-word}
.tr-cmp small{display:block;color:var(--muted);font-weight:600;margin-bottom:4px}
.tr-stars button{border:1px solid var(--line);background:var(--surface);border-radius:8px;padding:3px 9px;cursor:pointer}
.tr-stars button.on{background:var(--orange);color:#fff;border-color:transparent}
@media(max-width:760px){.tr-cmp{grid-template-columns:1fr}}
</style>`;
const trApi=(p,o)=>svApi("/api/agent-train"+p,o);
const trNote=(t)=>`<div class="note">${t}</div>`;
async function trLoadOv(){try{TR.ov=await trApi("/overview");TR.ctl=TR.ov.control}catch(e){toast("Chưa tải được: "+e.message)}}
const trCount=(kind,st)=>((TR.ov&&TR.ov.items)||[]).filter(r=>r.kind===kind&&(!st||r.status===st)).reduce((a,r)=>a+r.n,0);
function trTabs(){
  const pend=TR.ov?TR.ov.pending_suggestions:0;
  const tabs=[["ctl","Điều khiển"],["script","Kịch bản"],["price","Bảng giá"],["faq","Câu khách hỏi"],["media","Ảnh / video"],["rule","Luật cấm"],["sug","Đề xuất"+(pend?`<span class="tr-n">${pend}</span>`:"")],["eval","Chạy thử"],["log","Lịch sử"]];
  return `<div class="tr-tabs">${tabs.map(t=>`<button data-trt="${t[0]}" class="${TR.tab===t[0]?"on":""}">${t[1]}</button>`).join("")}</div>`;
}
async function trShow(){
  const box=$("#tr-body");if(!box)return;
  $("#tr-tabs").innerHTML=trTabs();
  $("#tr-tabs").querySelectorAll("[data-trt]").forEach(b=>b.onclick=()=>{TR.tab=b.dataset.trt;TR.edit=null;trShow()});
  const t=TR.tab;
  try{
    if(t==="ctl"){await trLoadOv();trDrawCtl(box)}
    else if(TR_KINDS[t]){TR.items=await trApi("/items?kind="+TR_KINDS[t].k);trDrawItems(box,t)}
    else if(t==="sug"){TR.sug=await trApi("/suggestions");trDrawSug(box)}
    else if(t==="eval"){TR.evals=await trApi("/evals");trDrawEval(box)}
    else if(t==="log"){TR.log=await trApi("/log");trDrawLog(box)}
  }catch(e){box.innerHTML=`<div class="hint">Chưa tải được: ${esc(e.message)}</div>`}
}
/* ---- Điều khiển: nút tắt khẩn + chế độ thử ---- */
function trDrawCtl(box){
  const c=TR.ctl||{mode:"off",kill:false,testers:""};
  const sum=Object.entries(TR_KINDS).map(([k,v])=>`<tr><td>${v.n}</td><td>${trCount(v.k,"APPROVED")}</td><td>${trCount(v.k,"DRAFT")}</td></tr>`).join("");
  box.innerHTML=`<div class="tr-card tr-kill ${c.kill?"":"live"}"><h3>${c.kill?"⛔ ĐANG TẮT KHẨN: agent không trả lời ai":"Nút tắt khẩn"}</h3>
  <div class="hint">Bật là agent ngừng ngay: gói kiến thức trả về trống nên không còn câu nào để gửi. Tắt khẩn thắng mọi chế độ khác.</div>
  <div class="tr-act"><button class="btn ${c.kill?"pri":"danger"}" id="tr-kill">${c.kill?"Gỡ tắt khẩn":"TẮT KHẨN agent"}</button></div></div>
  <div class="tr-card"><h3>Chế độ</h3>
  <div class="hint">Hiện chỉ có 2 chế độ: <b>Tắt</b> hoặc <b>Chỉ thử với tài khoản của chị</b>. Gửi cho khách thật chưa có trong trang này — chị duyệt riêng rồi mới mở.</div>
  <div class="tr-form" style="margin-top:8px"><select id="tr-mode"><option value="off" ${c.mode==="off"?"selected":""}>Tắt (agent chưa trả lời ai)</option><option value="tester" ${c.mode==="tester"?"selected":""}>Chỉ thử với tài khoản của chị</option></select>
  <input id="tr-testers" placeholder="Tài khoản thử được phép (tên hoặc mã Facebook, cách nhau dấu phẩy)" value="${esc(c.testers||"")}">
  <label>Nhân viên nhắn tay thì agent im trong (phút) <input id="tr-silent" type="number" min="1" max="1440" value="${c.silent_minutes||30}"></label>
  <label>Khung giờ agent được trả lời (để trống = cả ngày) <span style="display:flex;gap:8px"><input id="tr-hf" type="time" value="${esc(c.hours_from||"")}"><input id="tr-ht" type="time" value="${esc(c.hours_to||"")}"></span></label>
  <div class="hint">Câu khách hỏi ngoài kịch bản đã duyệt: agent <b>dừng và báo chị</b>, không dùng kiến thức chung để đoán.</div>
  <div><button class="btn pri" id="tr-save">Lưu chế độ</button></div></div></div>
  <div class="tr-card"><h3>Kho kiến thức hiện có</h3><table class="tbl"><thead><tr><th>Mục</th><th>Đã duyệt</th><th>Nháp</th></tr></thead><tbody>${sum}</tbody></table>
  <div class="hint" style="margin-top:6px">Agent chỉ thấy các mục <b>Đã duyệt</b>. Sửa một mục đã duyệt thì mục đó về Nháp tới khi chị duyệt lại.</div></div>`;
  $("#tr-kill").onclick=async()=>{
    if(!c.kill&&!confirm("Tắt khẩn: agent ngừng trả lời ngay. Chắc chắn?"))return;
    try{TR.ctl=await trApi("/control",{method:"PUT",body:JSON.stringify({kill:!c.kill})});toast(TR.ctl.kill?"Đã tắt khẩn":"Đã gỡ tắt khẩn");trDrawCtl(box)}catch(e){toast("Chưa lưu được: "+e.message)}};
  $("#tr-save").onclick=async()=>{
    try{TR.ctl=await trApi("/control",{method:"PUT",body:JSON.stringify({mode:$("#tr-mode").value,testers:$("#tr-testers").value,silent_minutes:+$("#tr-silent").value,hours_from:$("#tr-hf").value,hours_to:$("#tr-ht").value})});toast("Đã lưu");trDrawCtl(box)}catch(e){toast("Chưa lưu được: "+e.message)}};
}
/* ---- Danh sách mục (kịch bản, giá, câu hỏi, ảnh/video, luật cấm) ---- */
function trForm(t,it){
  const K=TR_KINDS[t],v=it||{agent_set:TR.set||"SALE",grp:"",code:"",title:"",body:"",extra:""};
  return `<div class="tr-card"><h3>${it&&it.id?"Sửa mục":"Thêm mục mới"} · ${K.n}</h3><div class="tr-form">
  <select id="tf-set">${Object.entries(TR_SETS).map(([k,n])=>`<option value="${k}" ${v.agent_set===k?"selected":""}>Cho agent: ${n}</option>`).join("")}</select>
  <input id="tf-grp" placeholder="${esc(K.grp)}" value="${esc(v.grp)}"><input id="tf-code" placeholder="${esc(K.code)}" value="${esc(v.code)}">
  <input id="tf-title" placeholder="${esc(K.title)}" value="${esc(v.title)}">
  <textarea id="tf-body" placeholder="${esc(K.body)}">${esc(v.body)}</textarea>
  <textarea id="tf-extra" style="min-height:50px" placeholder="${esc(K.extra)}">${esc(v.extra)}</textarea>
  <div class="tr-act"><button class="btn pri" id="tf-ok">Lưu (thành nháp)</button><button class="btn" id="tf-no">Bỏ</button></div></div></div>`;
}
function trDrawItems(box,t){
  const K=TR_KINDS[t],q=TR.q.toLowerCase(),sf=TR.set;
  const rows=TR.items.filter(i=>(!sf||i.agent_set===sf||i.agent_set==="BOTH")&&(!q||(i.title+i.body+i.code+i.grp).toLowerCase().includes(q)));
  const nd=rows.filter(i=>i.status==="DRAFT").length;
  let last="";
  box.innerHTML=trNote(esc(K.hint))+
   `<div class="tr-act" style="margin:0 0 10px;align-items:center"><button class="btn pri" id="tr-add">+ Thêm</button>
    <select id="tr-sf"><option value="">Tất cả agent</option><option value="SALE" ${sf==="SALE"?"selected":""}>Sale</option><option value="CSKH" ${sf==="CSKH"?"selected":""}>CSKH</option></select>
    <input id="tr-q" placeholder="Tìm…" value="${esc(TR.q)}" style="border:1px solid var(--line);border-radius:10px;padding:7px 10px">
    ${nd?`<button class="btn" id="tr-all">Duyệt hết ${nd} mục nháp</button>`:""}</div>`+
   (TR.edit?trForm(t,TR.edit):"")+
   (rows.length?rows.map(i=>{
     const g=i.grp!==last?`<h4 style="margin:14px 0 6px">${esc(i.grp||"(chưa có nhóm)")}</h4>`:"";last=i.grp;
     const st=TR_ST[i.status]||["",""];
     return g+`<div class="tr-it"><div class="t"><span>${i.code?`<code>${esc(i.code)}</code> `:""}${esc(i.title)}</span><span><span class="pill p-${st[1]}">${st[0]}</span> <span class="pill p-gry">${TR_SETS[i.agent_set]}</span>${i.source==="AGENT"?` <span class="pill p-gry">agent đề xuất</span>`:""}</span></div>
      ${i.body?`<div class="b">${esc(i.body)}</div>`:""}${i.extra?`<div class="x">${esc(i.extra)}</div>`:""}
      <div class="tr-act">${i.status!=="APPROVED"?`<button class="btn pri" data-ok="${i.id}">Duyệt</button>`:""}<button class="btn" data-ed="${i.id}">Sửa</button><button class="btn" data-ar="${i.id}">Bỏ</button></div></div>`}).join(""):`<div class="hint">Chưa có mục nào${q||sf?" khớp bộ lọc":""}. Bấm “+ Thêm”.</div>`);
  $("#tr-add").onclick=()=>{TR.edit={};trDrawItems(box,t)};
  $("#tr-sf").onchange=e=>{TR.set=e.target.value;trDrawItems(box,t)};
  $("#tr-q").oninput=e=>{TR.q=e.target.value;clearTimeout(trDrawItems.h);trDrawItems.h=setTimeout(()=>{trDrawItems(box,t);const i=$("#tr-q");if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},250)};
  if($("#tr-all"))$("#tr-all").onclick=async()=>{if(!confirm(`Duyệt ${nd} mục nháp đang hiện? Agent sẽ dùng nguyên văn các mục này.`))return;
    try{for(const i of rows.filter(x=>x.status==="DRAFT"))await trApi("/items/"+i.id+"/approve",{method:"POST"});toast("Đã duyệt");trShow()}catch(e){toast(e.message)}};
  box.querySelectorAll("[data-ok]").forEach(b=>b.onclick=async()=>{try{await trApi("/items/"+b.dataset.ok+"/approve",{method:"POST"});trShow()}catch(e){toast(e.message)}});
  box.querySelectorAll("[data-ar]").forEach(b=>b.onclick=async()=>{if(!confirm("Bỏ mục này? Agent sẽ không dùng nữa."))return;try{await trApi("/items/"+b.dataset.ar+"/archive",{method:"POST"});trShow()}catch(e){toast(e.message)}});
  box.querySelectorAll("[data-ed]").forEach(b=>b.onclick=()=>{TR.edit=TR.items.find(x=>x.id==b.dataset.ed);trDrawItems(box,t);scrollTo(0,0)});
  if(TR.edit){
    $("#tf-no").onclick=()=>{TR.edit=null;trDrawItems(box,t)};
    $("#tf-ok").onclick=async()=>{
      const body={kind:K.k,agent_set:$("#tf-set").value,grp:$("#tf-grp").value,code:$("#tf-code").value,title:$("#tf-title").value,body:$("#tf-body").value,extra:$("#tf-extra").value};
      try{if(TR.edit.id)await trApi("/items/"+TR.edit.id,{method:"PATCH",body:JSON.stringify(body)});else await trApi("/items",{method:"POST",body:JSON.stringify(body)});
        TR.edit=null;toast("Đã lưu thành nháp. Bấm Duyệt để agent dùng.");trShow()}catch(e){toast("Chưa lưu được: "+e.message)}};
  }
}
/* ---- Đề xuất của agent ---- */
function trDrawSug(box){
  box.innerHTML=trNote("Agent học từ hội thoại rồi <b>đề xuất</b> ở đây. Agent không tự áp dụng: chị duyệt thì mới thành mục đã duyệt; từ chối thì bỏ.")+
  (TR.sug.length?TR.sug.map(s=>`<div class="tr-it"><div class="t"><span>${esc(s.title)}</span><span><span class="pill p-gry">${(TR_KINDS[Object.keys(TR_KINDS).find(k=>TR_KINDS[k].k===s.kind)]||{n:s.kind}).n}</span> <span class="pill p-gry">${TR_SETS[s.agent_set]}</span></span></div>
   <textarea class="tr-sb" data-id="${s.id}" style="width:100%;box-sizing:border-box;min-height:80px;margin:6px 0;border:1px solid var(--line);border-radius:10px;padding:8px 10px;font:inherit">${esc(s.body)}</textarea>
   ${s.reason?`<div class="x"><b>Vì sao:</b> ${esc(s.reason)}</div>`:""}${s.evidence?`<div class="x"><b>Hội thoại mẫu (đã che thông tin cá nhân):</b> ${esc(s.evidence)}</div>`:""}
   <div class="tr-act"><button class="btn pri" data-sa="${s.id}">Duyệt (dùng nội dung ở trên)</button><button class="btn" data-sr="${s.id}">Từ chối</button></div></div>`).join(""):`<div class="hint">Chưa có đề xuất nào đang chờ.</div>`);
  box.querySelectorAll("[data-sa]").forEach(b=>b.onclick=async()=>{const ta=box.querySelector(`.tr-sb[data-id="${b.dataset.sa}"]`);
    try{await trApi("/suggestions/"+b.dataset.sa+"/approve",{method:"POST",body:JSON.stringify({body:ta.value})});toast("Đã duyệt, thêm vào kho");trShow()}catch(e){toast(e.message)}});
  box.querySelectorAll("[data-sr]").forEach(b=>b.onclick=async()=>{const n=prompt("Lý do từ chối (không bắt buộc):")||"";
    try{await trApi("/suggestions/"+b.dataset.sr+"/reject",{method:"POST",body:JSON.stringify({note:n})});trShow()}catch(e){toast(e.message)}});
}
/* ---- Chạy thử / chấm điểm ---- */
function trDrawEval(box){
  const E=TR.evals,done=E.filter(e=>e.ceo_score),avg=done.length?(done.reduce((a,e)=>a+e.ceo_score,0)/done.length).toFixed(1):"–";
  const bad=E.filter(e=>e.flags.length).length;
  box.innerHTML=trNote("Dán các hội thoại cũ (câu khách + câu sale đã nhắn). Hệ thống tự che số điện thoại, email, link. Agent trả lời lại, chị so với câu sale và chấm 1–5. <b>Chỉ đọc, không gửi cho ai.</b>")+
  `<div class="tr-card"><h3>Thêm câu để thử</h3><div class="tr-form">
   <select id="te-set"><option value="SALE">Agent Sale</option><option value="CSKH">Agent CSKH</option></select>
   <textarea id="te-paste" placeholder="Mỗi câu một khối, cách nhau một dòng trống. Dòng đầu: KHÁCH: ...   Dòng sau: SALE: ..."></textarea>
   <div><button class="btn pri" id="te-add">Thêm vào hàng chờ</button></div></div></div>
   <div class="hint" style="margin:0 0 10px">${E.length} câu · đã chấm ${done.length} · điểm trung bình ${avg} · ${bad} câu bị tự đánh dấu lỗi · ${E.filter(e=>e.agent_reply===null).length} đang chờ agent trả lời</div>`+
  E.map(e=>`<div class="tr-it"><div class="t"><span>${TR_SETS[e.agent_set]} · khách hỏi</span><button class="btn" data-ed="${e.id}">Xoá</button></div>
   <div class="b">${esc(e.customer_msg)}</div>
   <div class="tr-cmp"><div><small>Sale đã nhắn</small>${esc(e.sale_reply||"(không có)")}</div><div><small>Agent trả lời lại</small>${e.agent_reply===null?"Đang chờ agent…":esc(e.agent_reply)}</div></div>
   ${e.flags.map(f=>`<div class="tr-flag">⚠️ ${esc(f.msg)}</div>`).join("")}
   ${e.agent_reply!==null?`<div class="tr-act tr-stars">Chị chấm: ${[1,2,3,4,5].map(n=>`<button data-sc="${e.id}:${n}" class="${e.ceo_score===n?"on":""}">${n}</button>`).join("")}</div>`:""}</div>`).join("");
  $("#te-add").onclick=async()=>{
    const cases=$("#te-paste").value.split(/\n\s*\n/).map(b=>{const k=b.match(/^\s*KH[ÁA]CH\s*:\s*([\s\S]*?)(?:\n\s*SALE\s*:\s*([\s\S]*))?$/i);return k?{customer_msg:k[1],sale_reply:k[2]||""}:{customer_msg:b,sale_reply:""}}).filter(x=>x.customer_msg.trim());
    if(!cases.length){toast("Chưa có câu nào");return}
    try{const r=await trApi("/evals",{method:"POST",body:JSON.stringify({agent_set:$("#te-set").value,cases})});toast("Đã thêm "+r.added+" câu");trShow()}catch(e){toast(e.message)}};
  box.querySelectorAll("[data-ed]").forEach(b=>b.onclick=async()=>{if(!confirm("Xoá câu thử này?"))return;try{await trApi("/evals/"+b.dataset.ed,{method:"DELETE"});trShow()}catch(e){toast(e.message)}});
  box.querySelectorAll("[data-sc]").forEach(b=>b.onclick=async()=>{const [id,n]=b.dataset.sc.split(":");try{await trApi("/evals/"+id+"/score",{method:"POST",body:JSON.stringify({score:+n})});trShow()}catch(e){toast(e.message)}});
}
function trDrawLog(box){
  const fm=s=>{try{return new Date(s).toLocaleString("vi-VN",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"})}catch(e){return s}};
  box.innerHTML=trNote("Ai sửa, duyệt, tắt khẩn gì và lúc nào, để lần lại khi agent nói sai.")+(TR.log.length?`<table class="tbl"><thead><tr><th>Lúc</th><th>Ai</th><th>Việc</th><th>Chi tiết</th></tr></thead><tbody>${TR.log.map(l=>`<tr><td>${fm(l.at)}</td><td>${esc(l.by_name||"")}</td><td>${esc(TR_ACT[l.action]||l.action)}${l.ref&&l.ref!=="control"?` #${esc(l.ref)}`:""}</td><td>${esc(l.detail)}</td></tr>`).join("")}</tbody></table>`:`<div class="hint">Chưa có thay đổi nào.</div>`);
}
PAGES.huanluyenagent=m=>{
  m.innerHTML=H("Huấn luyện agent","Dạy agent Sale và CSKH trực page · agent chỉ dùng bản chị đã duyệt")+TR_CSS+`<div id="tr-tabs"></div><div id="tr-body"><div class="hint">Đang tải…</div></div>`;
  trLoadOv().then(trShow);
};
{const s=MODULES.find(m=>m.k==="setup");if(s){const g0=s.groups;s.groups=()=>{const G=g0();const hs=G.find(g=>g[0]==="Hệ thống");if(hs)hs[1].push(MI("huanluyenagent","Huấn luyện agent",u=>u.role==="admin"));return G}}}
{const i=MODULES.findIndex(m=>m.k==="agt");const mod=MODULES[i];
 if(mod){const g0=mod.groups;mod.groups=()=>{const G=g0();G[0][1].push(MI("huanluyenagent","Huấn luyện agent",u=>u.role==="admin"));return G}}}
