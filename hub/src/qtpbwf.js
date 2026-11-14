/* =====================================================================
   QUẢN TRỊ PHÒNG BAN — WORK FLOW NHƯ DEMO (CEO duyệt 14/11/2026)
   - Work Flow (Lead, CEO làm thay): chọn luồng bên trái; bên phải sửa các bước duyệt của phòng:
     người duyệt từng bước là Lead phòng HOẶC một nhân viên trong phòng, hạn từng bước (giờ), thêm / bỏ bước,
     quá hạn thì nhắc lại người duyệt / báo Lead / báo CEO. Bước của công ty (Quản lý mua hàng, Kế toán kho, HCNS, CEO)
     giữ nguyên, có khóa. Tạo Work Flow mới từ mẫu (đề xuất: duyệt bài Fanpage, xin booking KOC…).
   - Các luồng chạy theo bước đã đặt:
       video final, kịch bản, việc giao (bản chung): ở trình duyệt (canMove, tkAppr qua qwTaskAppr);
       nghỉ phép, mua đồ dùng, hàng mẫu, đề xuất mới: máy chủ chặn / chuyển bước (services/flowGate.ts).
     Bước giữa: người duyệt bấm ở "Chờ tôi duyệt" (Task giao việc) để chuyển tiếp; bước cuối làm đúng việc "Lead duyệt" cũ.
     Lead và CEO luôn duyệt thay được. Máy chủ báo người duyệt bước mới và nhắc khi quá hạn (cron mỗi giờ).
   - Quy định cho nhân viên (KPI nhân sự › Chỉ tiêu & quy định): việc nào báo xong cần Lead duyệt.
   Lưu ở d.qtpb.dept[phòng].flow / cflows / qd; máy chủ kiểm (src/server/lib/qtpb.ts). Tên toàn cục bắt đầu bằng "qw".
   ===================================================================== */
const QW={sel:"video",draft:null,cho:null,busy:false,tab:"cho"};
const QW_QH=[["nhac","Nhắc lại người duyệt"],["lead","Báo Lead phòng"],["ceo","Báo CEO"]];
const QW_TPL=["Duyệt bài đăng Fanpage","Đề xuất ý tưởng chiến dịch","Xin booking KOC","Báo cáo tuần của nhân sự","Đề xuất khác"];
const qwFlowCfg=(dept,fid)=>{const d=qpDeptCfg(dept);return (d.flow||{})[fid]||(d.cflows||[]).find(x=>x.id===fid)||null};
const qwSteps=(dept,fid)=>{const f=qwFlowCfg(dept,fid);if(f&&Array.isArray(f.steps)&&f.steps.length)return f.steps;return [{ai:"lead",han:((qpDeptCfg(dept).wf||{})[fid]||{}).han||0}]};
const qwCustom=s=>s.length>1||(s[0]&&s[0].ai!=="lead");
const qwLeads=dept=>D().users.filter(u=>u.active!==false&&u.phongBan===dept&&qpDeptLead(u)).map(u=>u.id);
const qwAppr=(st,dept)=>{if(!st)return [];if(st.ai==="lead")return qwLeads(dept);const id=st.ai.slice(2),u=userBy(id);return u&&u.active!==false?[id]:qwLeads(dept)};
const qwStepName=st=>!st?"":st.ai==="lead"?"Lead phòng":((userBy(st.ai.slice(2))||{}).name||"Lead phòng");
const qwNow=()=>new Date().toISOString();

/* ---------- Thẻ video / kịch bản, việc giao: đang ở bước nào ---------- */
function qwCard(c){if(!c||(c.step!=="dvd"&&c.step!=="dkb"))return null;const fid=c.step==="dvd"?"video":"kb",owner=c.step==="dvd"?(c.nguoiEdit||c.nguoi):(c.nguoiKB||c.nguoi);
  const dept=(userBy(owner)||{}).phongBan||"",h=(c.history||[]).filter(x=>x.to===c.step).pop(),k=h?String(h.t):"",steps=qwSteps(dept,fid);
  const w=c.wfi&&c.wfi.k===k&&c.wfi.i<steps.length?c.wfi:{k,i:0,at:k,log:[]};return {kind:"card",fid,dept,steps,w,owner,id:c.id}}
function qwTask(t){if(!t||t.st!=="review"||t.vong===2)return null;const doer=userBy(t.nguoi);const dept=(doer||{}).phongBan||"";if(!dept)return null;
  const k=String(t.nopAt||t.stAt||""),steps=qwSteps(dept,"task");const w=t.wfi&&t.wfi.k===k&&t.wfi.i<steps.length?t.wfi:{k,i:0,at:k,log:[]};return {kind:"task",fid:"task",dept,steps,w,owner:t.nguoi,id:t.id}}
/* Gọi từ tkAppr (congviec.js): việc vốn do Lead phòng của người làm duyệt thì theo các bước Lead đặt. */
function qwTaskAppr(t,base){try{const I=qwTask(t);if(!I||!qwCustom(I.steps))return null;const L=qwLeads(I.dept);if(!(base||[]).some(id=>L.includes(id)))return null;return qwAppr(I.steps[I.w.i],I.dept)}catch(e){return null}}
/* Duyệt video, kịch bản: bước giữa chỉ chuyển tiếp ở "Chờ tôi duyệt"; bước cuối người được đặt bấm Duyệt như Lead; Lead, CEO luôn duyệt thay được. */
{const _cm=canMove;canMove=function(u,c,to){const base=_cm.apply(this,arguments);try{const I=qwCard(c);if(!I||!qwCustom(I.steps)||!u||u.role==="admin")return base;
  if(qpDeptLead(u)&&u.phongBan===I.dept)return base||true;const last=I.w.i===I.steps.length-1,ap=qwAppr(I.steps[I.w.i],I.dept).includes(u.id)&&u.id!==I.owner;
  if(ap)return last;return base&&last&&I.steps[I.w.i].ai==="lead"}catch(e){return base}}}
/* Quy định cho nhân viên: việc Viết kịch bản / Viết hook báo xong không cần Lead duyệt nếu Lead tắt. */
{const _de=tkDoneErr;tkDoneErr=function(t){const r=_de.apply(this,arguments);try{if(!r||!t)return r;const dept=(userBy(t.nguoi)||{}).phongBan||"";const q=(qpDeptCfg(dept).qd||{}).duyet||{};
  const k=t.loai==="Viết kịch bản"?"kb":t.loai==="Viết hook"?"hook":"";if(k&&q[k]===false)return "";return r}catch(e){return r}}}

/* Việc đang chờ chính mình duyệt (trình duyệt tự tính): thẻ, việc giao. */
function qwMineLocal(){if(!ME)return [];const o=[];
  (D().cards||[]).forEach(c=>{const I=qwCard(c);if(!I||!qwCustom(I.steps)||I.owner===ME.id)return;if(!qwAppr(I.steps[I.w.i],I.dept).includes(ME.id))return;
    o.push({kind:"card",id:c.id,ten:(I.fid==="video"?"Video final ":"Kịch bản ")+c.id+((c.hookText||c.tieuDe||c.ten||c.sku)?" · "+(c.hookText||c.tieuDe||c.ten||c.sku):""),nguoi:userName(I.owner),buoc:I.w.i+1,so_buoc:I.steps.length,at:I.w.at,han:I.steps[I.w.i].han,last:I.w.i===I.steps.length-1,I})});
  (D().tasks||[]).forEach(t=>{const I=qwTask(t);if(!I||!qwCustom(I.steps)||I.owner===ME.id)return;const L=qwLeads(I.dept);let base=[];try{base=(t.order||t.tuThem||tkCeoGiao(t))?[]:L}catch(e){}if(!base.length)return;
    if(!qwAppr(I.steps[I.w.i],I.dept).includes(ME.id))return;o.push({kind:"task",id:t.id,ten:"Việc: "+t.ten,nguoi:userName(I.owner),buoc:I.w.i+1,so_buoc:I.steps.length,at:I.w.at,han:I.steps[I.w.i].han,last:I.w.i===I.steps.length-1,I})});
  return o}
function qwAdvanceLocal(x){const I=x.I,list=x.kind==="card"?"cards":"tasks",nx=I.w.i+1;
  DB.mutate(ME.name,`duyệt bước ${I.w.i+1} (Work Flow) ${x.ten}`,d=>{const y=(d[list]||[]).find(z=>z.id===x.id);if(!y)return;y.wfi={k:I.w.k,i:nx,at:qwNow(),log:(I.w.log||[]).concat([{by:ME.id,name:ME.name,at:qwNow()}])};
    if(typeof notifyU==="function")notifyU(d,qwAppr(I.steps[nx],I.dept),`${ME.name} đã duyệt bước ${I.w.i+1}, chuyển bạn duyệt: ${x.ten}`,"page:qw_cho")})}
const qwAgo=at=>{const t=typeof qkTime==="function"&&!/T/.test(String(at))?qkTime(at):Date.parse(at);if(!t)return "—";const h=Math.floor((Date.now()-t)/3600000);return h<1?"dưới 1 giờ":h<48?h+" giờ":Math.floor(h/24)+" ngày"};
const qwLate=(at,han)=>{if(!han)return false;const t=typeof qkTime==="function"&&!/T/.test(String(at))?qkTime(at):Date.parse(at);return !!t&&Date.now()-t>han*3600000};

/* ---------- Trang: Chờ tôi duyệt + Gửi đề xuất ---------- */
function qwLoad(force){if(QW.busy||(!force&&QW.cho))return;QW.busy=true;svApi("/api/hub/qtpb/flow/cho").then(r=>{QW.cho=r}).catch(e=>{QW.cho=QW.cho||{d1:[],items:[],mine:[],flows:[]};toast("Chưa tải được: "+e.message)}).finally(()=>{QW.busy=false;if(PAGE==="qw_cho")renderMain()})}
const QW_KIND={card:"Video, kịch bản",task:"Việc giao",nghi:"Nghỉ phép, tăng ca",mua:"Mua đồ dùng",mau:"Hàng mẫu",item:"Đề xuất"};
function pQwCho(m){
  qwLoad();const R=QW.cho||{d1:[],items:[],mine:[],flows:[]};
  const rows=qwMineLocal().concat((R.d1||[]).map(x=>Object.assign({},x)),(R.items||[]).map(x=>({kind:"item",id:x.id,ten:x.flow_ten+": "+x.tieu_de,nguoi:x.by_name,buoc:x.buoc,so_buoc:x.so_buoc,at:x.at,han:x.han,last:x.buoc===x.so_buoc,x})));
  const tabs=[["cho","Chờ tôi duyệt",rows.length],["gui","Gửi đề xuất",0],["cua","Đề xuất của tôi",(R.mine||[]).filter(x=>x.st==="tl").length]];
  m.innerHTML=H("Duyệt theo Work Flow","Việc Lead phòng đặt bạn duyệt, và đề xuất bạn gửi theo Work Flow của phòng.")+
   `<div class="cwtabs" role="tablist">${tabs.map(([k,n,c])=>`<button role="tab" aria-selected="${QW.tab===k}" class="${QW.tab===k?"on":""}" data-qwt="${k}">${n}${c?` <span class="n r">${c}</span>`:""}</button>`).join("")}</div><div id="qw-sub"></div>`;
  m.querySelectorAll("[data-qwt]").forEach(b=>b.onclick=()=>{QW.tab=b.dataset.qwt;renderMain()});
  const s=$("#qw-sub");
  if(QW.tab==="gui"){qwGui(s,R);return}
  if(QW.tab==="cua"){qwCua(s,R);return}
  s.innerHTML=!QW.cho&&!rows.length?`<p class="hint">Đang tải…</p>`:rows.length?`<section class="card flush">${tbl(["Loại","Việc","Người gửi","Bước","Đã chờ",""],rows.map((x,i)=>`<tr><td>${esc(QW_KIND[x.kind]||"")}</td><td>${esc(x.ten)}${x.kind==="item"&&x.x.noi_dung?`<div class="hint">${esc(String(x.x.noi_dung).slice(0,160))}</div>`:""}${x.kind==="item"&&x.x.link?`<div><a href="${esc(x.x.link)}" target="_blank" rel="noopener noreferrer">Mở link</a></div>`:""}</td><td>${esc(x.nguoi||"")}</td><td>${x.buoc}/${x.so_buoc}${x.last?"":` <span class="hint">(chuyển tiếp)</span>`}</td>
     <td>${qwAgo(x.at)}${qwLate(x.at,x.han)?" "+pill("Quá hạn "+x.han+" giờ","red"):""}</td><td class="nowrap"><button class="btn sm pri" data-qwok="${i}">Duyệt</button> <button class="btn sm" data-qwno="${i}">Trả lại</button>${x.kind==="card"||x.kind==="task"?` <button class="btn sm" data-qwop="${i}">Mở</button>`:""}</td></tr>`))}</section>`
   :`<section class="card"><p class="hint">Không có việc nào đang chờ bạn duyệt.</p></section>`;
  s.querySelectorAll("[data-qwop]").forEach(b=>b.onclick=()=>{const x=rows[+b.dataset.qwop];if(x.kind==="card"&&typeof openCard==="function")openCard(x.id);else if(typeof openTask==="function")openTask(x.id)});
  s.querySelectorAll("[data-qwok]").forEach(b=>b.onclick=()=>{const x=rows[+b.dataset.qwok];qpBusy(b,async()=>{await qwDecide(x,true,"");toast("Đã duyệt"+(x.last?"":", chuyển bước sau"));QW.cho=null;qwLoad(true);renderMain()})});
  s.querySelectorAll("[data-qwno]").forEach(b=>b.onclick=()=>{const x=rows[+b.dataset.qwno];const why=prompt("Cần sửa gì? (người gửi sẽ thấy)","");if(!why)return;qpBusy(b,async()=>{await qwDecide(x,false,why);toast("Đã trả lại");QW.cho=null;qwLoad(true);renderMain()})});
}
async function qwDecide(x,okk,why){
  if(x.kind==="card"){if(!okk){sendBack(ME,x.id,why);return}if(!x.last){qwAdvanceLocal(x);return}const c=D().cards.find(y=>y.id===x.id);const to=nextAct(c)[1];const e=moveCard(ME,x.id,to);if(e&&typeof e==="string")throw new Error(e);return}
  if(x.kind==="task"){if(!okk){tkReturn(x.id,why);return}if(!x.last){qwAdvanceLocal(x);return}tkApprove(x.id);return}
  const P={nghi:`/api/hub/nghiphep/don/${x.id}/duyet`,mua:`/api/hub/dodung/mua/${x.id}/duyet`,mau:`/api/hub/dodung/mau/${x.id}/duyet`,item:`/api/hub/qtpb/flow/items/${x.id}/duyet`}[x.kind];
  const body=x.kind==="nghi"?{ok:okk,note:why}:{ok:okk,ly_do:why};await svApi(P,{method:"POST",body:JSON.stringify(body)});if(typeof svPoll==="function")svPoll()}
function qwGui(s,R){const F=R.flows||[];
  if(!F.length){s.innerHTML=`<section class="card"><p class="hint">Phòng chưa có Work Flow đề xuất nào. Lead tạo ở Nhân sự › Quản trị phòng › Work Flow › "Tạo Work Flow mới từ mẫu".</p></section>`;return}
  s.innerHTML=`<section class="card"><form class="frm" id="qw-f"><label class="field">Loại đề xuất<select id="qw-fl">${opt(F.map(f=>[f.id,f.ten+" ("+f.so_buoc+" bước duyệt)"]),F[0].id)}</select></label>
   <label class="field">Tiêu đề<input id="qw-td" required maxlength="200" autocomplete="off"></label><label class="field">Nội dung<textarea id="qw-nd" rows="4" maxlength="3000"></textarea></label>
   <label class="field">Link (Drive, bài nháp…)<input id="qw-lk" type="url" placeholder="https://"></label><div class="acts"><button class="btn pri" id="qw-go">Gửi duyệt</button></div></form></section>`;
  $("#qw-f").onsubmit=e=>{e.preventDefault();qpBusy($("#qw-go"),async()=>{await svApi("/api/hub/qtpb/flow/items",{method:"POST",body:JSON.stringify({flow_id:$("#qw-fl").value,tieu_de:$("#qw-td").value.trim(),noi_dung:$("#qw-nd").value.trim(),link:$("#qw-lk").value.trim()})});toast("Đã gửi duyệt");QW.tab="cua";QW.cho=null;qwLoad(true);renderMain()})}}
function qwCua(s,R){const L=R.mine||[];const st=x=>x.st==="cho"?pill(`Chờ ${x.cho} · bước ${x.buoc}/${x.so_buoc}`,"amb"):x.st==="xong"?pill("Đã duyệt","grn"):x.st==="tl"?pill("Trả lại","red"):pill("Đã hủy","gry");
  s.innerHTML=L.length?`<section class="card flush">${tbl(["Đề xuất","Gửi lúc","Trạng thái",""],L.map(x=>`<tr><td><b>${esc(x.flow_ten)}</b>: ${esc(x.tieu_de)}${x.ly_do&&x.st==="tl"?`<div class="hint">Cần sửa: ${esc(x.ly_do)}</div>`:""}</td><td>${esc(qpDate(x.created_at))}</td><td>${st(x)}</td><td>${x.st==="cho"||x.st==="tl"?`<button class="btn sm" data-qwh="${x.id}">Hủy</button>`:""}</td></tr>`))}</section>`:`<section class="card"><p class="hint">Bạn chưa gửi đề xuất nào.</p></section>`;
  s.querySelectorAll("[data-qwh]").forEach(b=>b.onclick=()=>{if(!confirm("Hủy đề xuất này?"))return;qpBusy(b,async()=>{await svApi(`/api/hub/qtpb/flow/items/${b.dataset.qwh}/huy`,{method:"POST"});QW.cho=null;qwLoad(true)})})}

/* ---------- Trang Work Flow (Lead / CEO làm thay) như demo ---------- */
function qwFlows(dept){const B=QK_WF.map(f=>({id:f.id,ten:f.ten,co:f.co,tien:!!f.tien,lead:f.lead,lock:f.steps().filter(([,k])=>k!=="lead").map(([n,k])=>({n,k}))}));
  return B.concat((qpDeptCfg(dept).cflows||[]).map(f=>({id:f.id,ten:f.ten,co:"Duyệt theo Work Flow (Task giao việc)",custom:true,lead:true,lock:[]})))}
function pQwWf(m){
  if(!qpAct()){m.innerHTML=qpDeptPick()+H("Work Flow","")+qpNo("Mục này dành cho Lead của phòng đã mở Quản trị phòng.");return}
  const dept=qpD(),FL=qwFlows(dept);if(!FL.some(f=>f.id===QW.sel)){QW.sel="video";QW.draft=null}
  const f=FL.find(x=>x.id===QW.sel),cfg=qwFlowCfg(dept,f.id);
  if(!QW.draft||QW.draft.dept!==dept||QW.draft.id!==f.id)QW.draft={dept,id:f.id,steps:JSON.parse(JSON.stringify(qwSteps(dept,f.id))),qh:(cfg&&cfg.qh)||"nhac",ten:f.ten};
  const W=typeof qkWaiting==="function"?qkWaiting():[],mem=D().users.filter(u=>u.active!==false&&u.phongBan===dept&&u.role!=="admin");
  const apOpts=[["lead","Lead phòng"]].concat(mem.filter(u=>!qpDeptLead(u)).map(u=>["u:"+u.id,u.name+(u.title?" · "+u.title:"")]));
  const S=QW.draft.steps;
  m.innerHTML=qpDeptPick()+H("Work Flow","Luồng duyệt của phòng "+esc(qpPb(dept))+". Chọn luồng, sửa số bước, người duyệt (Lead hoặc nhân viên trong phòng), hạn từng bước. Bước có khóa là quy định của công ty, Lead không sửa được.")+
  `<div class="qw-2"><section class="card qw-list" style="margin:0"><h2 style="margin:0 0 8px">Work Flow của phòng</h2>${FL.map(x=>{const n=W.filter(y=>y.wf===x.id).length,st=qwSteps(dept,x.id);return `<button class="qw-it${x.id===f.id?" on":""}" data-qwf="${esc(x.id)}"><b>${esc(x.ten)}</b><span class="hint">${x.lead?st.length:0}${x.lock.length?" + "+x.lock.length:""} bước${x.tien?" · có tiền":""}${n?" · "+n+" đang chờ":""}</span></button>`}).join("")}
    <label class="field" style="margin-top:12px">Tạo Work Flow mới từ mẫu<span class="row4" style="gap:6px"><select id="qw-new">${opt(QW_TPL,QW_TPL[0])}</select><button class="btn sm" id="qw-add">Tạo</button></span></label></section>
   <section class="card" style="margin:0;min-width:0"><div class="row4" style="align-items:center;gap:8px"><h2 style="margin:0">${esc(f.ten)}</h2>${f.tien?pill("Có tiền","gry"):""}<span style="flex:1"></span><span class="hint">Duyệt ở: ${esc(f.co)}</span></div>
    <p class="hint">Nhân viên gửi → lần lượt qua các bước dưới. Đủ bước thì việc tự hoàn thành; trả lại thì về người gửi kèm góp ý. Lead và CEO luôn duyệt thay được.</p>
    ${f.lead?S.map((st,i)=>`${i?'<div class="qw-arr">↓ duyệt xong chuyển tiếp</div>':""}<div class="qw-step"><span class="qw-n">${i+1}</span>
      <select data-qwa="${i}" aria-label="Người duyệt bước ${i+1}">${opt(apOpts.concat(st.ai!=="lead"&&!apOpts.some(o=>o[0]===st.ai)?[[st.ai,qwStepName(st)+" (đã rời phòng)"]]:[]),st.ai)}</select>
      <span class="hint">hạn</span><input type="number" min="0" max="720" data-qwh="${i}" value="${st.han||""}" placeholder="—" style="width:76px" aria-label="Hạn bước ${i+1}"><span class="hint">giờ</span>
      ${S.length>1?`<button class="btn sm" data-qwd="${i}" style="margin-left:auto">Bỏ bước</button>`:""}</div>`).join(""):`<p class="hint">Luồng này không có bước của Lead.</p>`}
    ${f.lock.map((l,i)=>`<div class="qw-arr">↓ duyệt xong chuyển tiếp</div><div class="qw-step lk"><span class="qw-n">${(f.lead?S.length:0)+i+1}</span><span>${esc(l.n)}</span>${f.id==="video"&&ME.role==="admin"&&/CEO/.test(l.n)?`<label class="row4" style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" id="qw-vc" ${qkVidCeo()?"checked":""}> Bật</label>`:""}<span style="flex:1"></span>${pill("🔒 "+l.k,"gry")}</div>`).join("")}
    ${f.lead?`<div class="row4" style="align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn sm" id="qw-st" ${S.length>=6?"disabled":""}>+ Thêm bước duyệt</button><label class="hint" for="qw-qh">Quá hạn thì</label><select id="qw-qh">${opt(QW_QH,QW.draft.qh)}</select></div>`:""}
    ${f.tien?`<div class="note" style="margin-top:10px">Luồng có tiền: Lead chỉ sửa các bước trước bước của công ty. Ngưỡng tiền và bước CEO do CEO đặt.</div>`:""}
    ${f.custom?`<label class="field" style="margin-top:10px">Tên Work Flow<input id="qw-ten" maxlength="60" value="${esc(f.ten)}"></label><p class="hint">Nhân viên gửi đề xuất ở Task giao việc › Duyệt theo Work Flow › Gửi đề xuất.</p>`:""}
    ${f.lead?`<div class="acts" style="margin-top:12px"><button class="btn pri" id="qw-sv">Lưu Work Flow</button><button class="btn" id="qw-rs">Bỏ thay đổi</button>${f.custom?`<button class="btn" id="qw-del">Xóa Work Flow này</button>`:""}</div>`:""}
   </section></div>`;
  m.querySelectorAll("[data-qwf]").forEach(b=>b.onclick=()=>{QW.sel=b.dataset.qwf;QW.draft=null;renderMain()});
  const pull=()=>{m.querySelectorAll("[data-qwa]").forEach(x=>{S[+x.dataset.qwa].ai=x.value});m.querySelectorAll("[data-qwh]").forEach(x=>{const v=Number(x.value);S[+x.dataset.qwh].han=v>0?Math.min(720,Math.round(v)):0});if($("#qw-qh"))QW.draft.qh=$("#qw-qh").value;if($("#qw-ten"))QW.draft.ten=$("#qw-ten").value};
  m.querySelectorAll("[data-qwd]").forEach(b=>b.onclick=()=>{pull();S.splice(+b.dataset.qwd,1);renderMain()});
  if($("#qw-st"))$("#qw-st").onclick=()=>{pull();S.push({ai:"lead",han:24});renderMain()};
  if($("#qw-rs"))$("#qw-rs").onclick=()=>{QW.draft=null;renderMain()};
  const vc=$("#qw-vc");if(vc)vc.onchange=()=>{const on=vc.checked;DB.mutate(ME.name,(on?"bật":"tắt")+" bước CEO duyệt video final",d=>{d.qtpb=d.qtpb||{};d.qtpb.cfg=Object.assign({},d.qtpb.cfg||{},{videoCeo:on})});toast(on?"Video final lại qua CEO duyệt":"Đã tắt bước CEO duyệt video final");renderMain()};
  const save=(fn,msg)=>DB.mutate(ME.name,msg,d=>{d.qtpb=d.qtpb||{};d.qtpb.dept=d.qtpb.dept||{};const c=d.qtpb.dept[dept]=d.qtpb.dept[dept]||{};c.flow=c.flow||{};c.cflows=c.cflows||[];fn(c)});
  if($("#qw-sv"))$("#qw-sv").onclick=()=>{pull();const steps=S.map(x=>({ai:x.ai,han:x.han||0})),qh=QW.draft.qh;
    if(f.custom){const ten=(QW.draft.ten||"").trim()||f.ten;save(c=>{c.cflows=c.cflows.map(x=>x.id===f.id?{id:x.id,ten,steps,qh}:x)},`sửa Work Flow "${ten}" phòng ${qpPb(dept)}`)}
    else save(c=>{c.flow[f.id]={steps,qh}},`sửa Work Flow "${f.ten}" phòng ${qpPb(dept)}`);
    QW.draft=null;toast("Đã lưu. Việc gửi từ giờ đi theo luồng này; thay đổi ghi vào nhật ký.");renderMain()};
  if($("#qw-del"))$("#qw-del").onclick=()=>{if(!confirm(`Xóa Work Flow "${f.ten}"? Đề xuất đang chờ vẫn giữ, Lead / CEO duyệt thay được.`))return;save(c=>{c.cflows=c.cflows.filter(x=>x.id!==f.id)},`xóa Work Flow "${f.ten}"`);QW.sel="video";QW.draft=null;renderMain()};
  $("#qw-add").onclick=()=>{const ten=$("#qw-new").value,id="n"+Math.random().toString(36).slice(2,10);save(c=>{c.cflows.push({id,ten,steps:[{ai:"lead",han:24}],qh:"nhac"})},`tạo Work Flow mới "${ten}" phòng ${qpPb(dept)}`);QW.sel=id;QW.draft=null;toast("Đã tạo Work Flow "+ten+". Sửa bước rồi bấm Lưu.");renderMain()};
}

/* ---------- Quy định cho nhân viên (thêm vào KPI nhân sự › Chỉ tiêu & quy định) ---------- */
function qwQdHtml(){const dept=qpD(),q=qpDeptCfg(dept).qd||{},du=q.duyet||{};
  return `<section class="card"><h2 style="margin:0 0 6px">Việc báo xong có cần Lead duyệt không</h2><p class="hint">Tắt = nhân viên phòng ${esc(qpPb(dept))} bấm xong là hoàn thành luôn, không chờ duyệt. Video final đi theo Work Flow "Duyệt video final".</p>
   ${[["kb","Viết kịch bản"],["hook","Viết hook"]].map(([k,t])=>`<label class="row4" style="align-items:center;gap:10px;padding:6px 0"><input type="checkbox" data-qwqd="${k}" ${du[k]===false?"":"checked"}><span>${t}: cần Lead duyệt</span></label>`).join("")}
   <div class="acts"><button class="btn" id="qw-qds">Lưu quy định</button></div></section>`}
function qwQdBind(){const b=$("#qw-qds");if(!b)return;b.onclick=()=>{const dept=qpD(),du={};document.querySelectorAll("[data-qwqd]").forEach(x=>{du[x.dataset.qwqd]=x.checked});
  DB.mutate(ME.name,"sửa quy định cho nhân viên phòng "+qpPb(dept),d=>{d.qtpb=d.qtpb||{};d.qtpb.dept=d.qtpb.dept||{};const c=d.qtpb.dept[dept]=d.qtpb.dept[dept]||{};c.qd=Object.assign({},c.qd||{},{duyet:du})});toast("Đã lưu quy định");renderMain()}}
{const _k=PAGES.qp_kpi;if(_k)PAGES.qp_kpi=function(m){_k.apply(this,arguments);try{if(QK.tab==="ct"&&qpAct()&&qpCap("kpi")){m.insertAdjacentHTML("beforeend",qwQdHtml());qwQdBind()}}catch(e){console.error(e)}}}

{const st=document.createElement("style");st.textContent=`
.qw-2{display:grid;grid-template-columns:minmax(220px,300px) 1fr;gap:12px;align-items:start}
@media (max-width:820px){.qw-2{grid-template-columns:1fr}}
.qw-it{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;border:1px solid var(--line,#e7e9f0);border-radius:10px;padding:8px 10px;margin-bottom:6px;background:var(--surface,#fff);cursor:pointer;font:inherit;color:inherit}
.qw-it.on,.qw-it:hover{border-color:var(--pri,#14213d);box-shadow:0 0 0 2px rgba(20,33,61,.08)}
.qw-step{display:flex;flex-wrap:wrap;align-items:center;gap:8px;border:1px solid var(--line,#e7e9f0);border-radius:10px;padding:8px 10px}
.qw-step.lk{background:#f6f7fa}.qw-step select{min-width:200px;max-width:100%}
.qw-n{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--pri,#14213d);color:#fff;font-size:12px;font-weight:700}
.qw-arr{font-size:12px;color:#8a90a2;margin:4px 0 4px 12px}`;document.head.appendChild(st)}

Object.assign(PAGES,{qp_wf:pQwWf,qw_cho:pQwCho});
/* Việc giao ở bước giữa: người được đặt duyệt bấm Duyệt (ở trang việc) thì chỉ chuyển bước sau. */
{const _ap=tkApprove;tkApprove=function(id){try{const t=D().tasks.find(x=>x.id===id),I=qwTask(t);
  if(I&&qwCustom(I.steps)&&ME.role!=="admin"&&!(qpDeptLead(ME)&&ME.phongBan===I.dept)&&I.w.i<I.steps.length-1&&qwAppr(I.steps[I.w.i],I.dept).includes(ME.id)){qwAdvanceLocal({kind:"task",id,ten:"Việc: "+t.ten,I});toast("Đã duyệt bước "+(I.w.i+1)+", chuyển bước sau");return false}}catch(e){}
  return _ap.apply(this,arguments)}}
/* Menu: Task giao việc › Duyệt theo Work Flow (mọi người của phòng đã mở Quản trị phòng, CEO). */
{const okM=u=>!!u&&(u.role==="admin"||(!!u.phongBan&&qpCfg().depts.includes(u.phongBan)));
  const cv=MODULES.find(x=>x.k==="cv");if(cv){const g0=cv.groups;cv.groups=function(){const G=g0.apply(this,arguments)||[];if(!G.length||G.some(g=>(g[1]||[]).some(i=>i&&i[0]==="qw_cho")))return G;
    let ok=false;try{ok=!ME||okM(ME)}catch(e){}if(!ok)return G;const G2=G.slice();G2[0]=[G2[0][0],(G2[0][1]||[]).concat([MI("qw_cho","Duyệt theo Work Flow",okM,()=>{try{return qwMineLocal().length+((QW.cho&&QW.cho.d1||[]).length)+((QW.cho&&QW.cho.items||[]).length)||""}catch(e){return ""}})])];return G2}}
  QP_ALWAYS.add("qw_cho");
}
