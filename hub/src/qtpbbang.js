/* =====================================================================
   QUẢN TRỊ PHÒNG BAN — đợt 3 (CEO duyệt demo 14/11/2026): BẢNG DỮ LIỆU
   Bảng biểu Lead tự tạo ngay trên web (kho ý tưởng hook, booking KOC, hàng mẫu, lịch livestream…):
   tự đặt cột, web tự tính chỉ số (đếm, tổng, trung bình, tỉ lệ), xem dạng bảng hoặc thẻ kéo thả.
   KHÔNG phải chỗ để file: file vẫn ở Thư mục làm việc (Drive), trong bảng chỉ gắn link.
   Bảng không lấy số nào của hệ thống (giá vốn, lợi nhuận, lương vẫn khóa cứng: chỉ CEO và Kế toán).
   - Lead (hoặc CEO): tạo / xóa bảng, sửa cột + chỉ số, đặt ai xem (cả phòng / chỉ Lead / mời phòng khác) và ai sửa
     (chỉ Lead / Lead + người phụ trách / cả phòng). Mỗi thay đổi cấu trúc ghi Nhật ký, CEO và Quản lý hoàn tác được.
   - Nhân sự phòng: xem, thêm, sửa dòng theo quyền Lead đặt.
   Dữ liệu ở bảng riêng trên máy chủ (/api/hub/qtpb/bang, src/server/routes/qtpbBang.ts), không nằm trong bản chung.
   Tên toàn cục trong file bắt đầu bằng "qb".
   ===================================================================== */
const QB={list:null,me:null,busy:false,cur:"",data:null,dbusy:false,view:"grid",q:"",fv:""};
const QB_TY=[["text","Chữ"],["num","Số"],["date","Ngày"],["sel","Chọn"],["user","Người"],["link","Link"],["check","Tích"]];
const QB_MK=[["dem","Đếm dòng"],["tong","Tổng"],["tb","Trung bình"],["tile","Tỉ lệ %"]];
const QB_SUA=[["lead","Chỉ Lead"],["phutrach","Lead + người phụ trách"],["phong","Cả phòng"]];
const qbTyN=t=>(QB_TY.find(x=>x[0]===t)||[,""])[1];
const qbKey=()=>"c"+Math.random().toString(36).slice(2,9);
const QB_SP=["Bột tẩy vạn năng","Tinh dầu giặt sấy","Tẩy lồng","Nước giặt"];
/* Mẫu bảng gợi ý (bấm là có bảng với cột dựng sẵn, Lead sửa tiếp). */
const QB_TPL=[
 ["hook","Kho ý tưởng hook",[["Ý tưởng","text"],["Sản phẩm","sel",QB_SP],["Người phụ trách","user"],["Trạng thái","sel",["Ý tưởng","Đang viết","Đã quay","Bỏ"]],["Link Drive","link"],["Lượt xem","num"]],
  [["Đã quay","dem",null,3,"Đã quay"],["Tỉ lệ ý tưởng đã quay","tile",null,3,"Đã quay"],["Tổng lượt xem","tong",5]],3],
 ["koc","Booking KOC",[["Tên KOC","text"],["Kênh","sel",["TikTok","Facebook","Instagram","YouTube"]],["Link kênh","link"],["Sản phẩm","sel",QB_SP],["Người phụ trách","user"],["Ngày lên video","date"],["Trạng thái","sel",["Liên hệ","Đã gửi mẫu","Đã lên video","Hủy"]],["Lượt xem","num"]],
  [["Đã lên video","dem",null,6,"Đã lên video"],["Tổng lượt xem","tong",7]],6],
 ["mau","Theo dõi hàng mẫu",[["Người nhận","text"],["Sản phẩm","sel",QB_SP],["Số lượng","num"],["Ngày gửi","date"],["Mã vận đơn","text"],["Người phụ trách","user"],["Trạng thái","sel",["Chuẩn bị","Đã gửi","Đã nhận","Đã có video"]]],
  [["Đã gửi","dem",null,6,"Đã gửi"],["Tổng số lượng","tong",2]],6],
 ["live","Lịch livestream",[["Ngày","date"],["Giờ","text"],["Chủ đề","text"],["Người live","user"],["Sản phẩm chính","sel",QB_SP],["Đã chuẩn bị đồ","check"],["Trạng thái","sel",["Lên lịch","Đã live","Hoãn"]]],
  [["Đã live","dem",null,6,"Đã live"]],6],
 ["ads","Ý tưởng quảng cáo",[["Ý tưởng","text"],["Sản phẩm","sel",QB_SP],["Người phụ trách","user"],["Trạng thái","sel",["Ý tưởng","Đang làm","Đang chạy","Dừng"]],["Link","link"]],
  [["Đang chạy","dem",null,3,"Đang chạy"]],3],
 ["trong","Bảng trống",[["Tên","text"],["Người phụ trách","user"],["Trạng thái","sel",["Mới","Đang làm","Xong"]],["Ghi chú","text"]],[],2]];
function qbTplDef(t){const cols=t[2].map(([n,ty,o])=>{const c={k:qbKey(),t:n,ty};if(ty==="sel")c.opts=(o||[]).slice();return c});
  const metrics=t[3].map(([n,kind,col,fc,fv])=>{const m={t:n,kind};if(col!=null)m.col=cols[col].k;if(fc!=null){m.fc=cols[fc].k;m.fv=fv}return m});
  return {cols,metrics,xem:{mode:"phong",them:[]},sua:"phutrach",kan:t[4]!=null?cols[t[4]].k:""}}

/* ---------- Tải dữ liệu ---------- */
function qbLoad(force){if(QB.busy||(!force&&QB.list))return;QB.busy=true;
  svApi("/api/hub/qtpb/bang").then(r=>{QB.list=r.tables||[];QB.me=r.me||null}).catch(e=>{QB.list=QB.list||[];toast("Chưa tải được bảng dữ liệu: "+e.message)}).finally(()=>{QB.busy=false;if(PAGE==="qp_bang")renderMain()})}
function qbOpen(id,force){if(QB.dbusy)return;if(!force&&QB.data&&QB.data.table.id===id)return;QB.dbusy=true;
  svApi("/api/hub/qtpb/bang/"+encodeURIComponent(id)).then(r=>{QB.data=r}).catch(e=>{toast("Chưa mở được bảng: "+e.message);QB.cur="";QB.data=null;QB.list=null}).finally(()=>{QB.dbusy=false;if(PAGE==="qp_bang")renderMain()})}
const qbT=()=>QB.data&&QB.data.table;
const qbUsers=dept=>(D().users||[]).filter(u=>u.active!==false&&u.phongBan===dept);
const qbUName=id=>((D().users||[]).find(u=>u.id===id)||{name:""}).name;

/* ---------- Tính chỉ số ---------- */
function qbMatch(r,def,fc,fv){if(!fc)return true;const c=def.cols.find(x=>x.k===fc);if(!c)return true;return c.ty==="check"?(!!r.data[fc])===(fv==="1"):r.data[fc]===fv}
function qbMetric(m,def,rows){const rs=rows.filter(r=>qbMatch(r,def,m.fc,m.fv));const nf=v=>Number(v||0).toLocaleString("vi-VN",{maximumFractionDigits:1});
  if(m.kind==="dem")return nf(rs.length);if(m.kind==="tile")return rows.length?Math.round(rs.length/rows.length*100)+"%":"0%";
  const sum=rs.reduce((a,r)=>a+(Number(r.data[m.col])||0),0);return m.kind==="tong"?nf(sum):nf(rs.length?sum/rs.length:0)}
function qbMetricSub(m,def){const cn=k=>esc((def.cols.find(c=>c.k===k)||{t:"?"}).t);const fc=def.cols.find(c=>c.k===m.fc);
  return esc((QB_MK.find(x=>x[0]===m.kind)||[,""])[1])+(m.col?" · "+cn(m.col):"")+(fc?" · "+esc(fc.t)+" = "+(fc.ty==="check"?(m.fv==="1"?"đã tích":"chưa tích"):esc(m.fv||"")):"")}

/* ---------- Hiện ô ---------- */
function qbCell(c,v){if(v===undefined||v===null||v==="")return `<span class="hint">—</span>`;
  if(c.ty==="num")return Number(v).toLocaleString("vi-VN");
  if(c.ty==="date"){const s=String(v);return esc(s.slice(8,10)+"/"+s.slice(5,7)+"/"+s.slice(0,4))}
  if(c.ty==="check")return v?"✓":"";
  if(c.ty==="sel")return pill(String(v),"blu");
  if(c.ty==="user")return esc(qbUName(v)||"(đã rời phòng)");
  if(c.ty==="link")return `<a href="${esc(v)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">Mở link</a>`;
  const s=String(v);return esc(s.length>90?s.slice(0,90)+"…":s)}
function qbInput(c,v,dept,id){const a=`id="${id}" data-qbf="${c.k}" aria-label="${esc(c.t)}"`;v=v===undefined||v===null?"":v;
  if(c.ty==="num")return `<input type="number" step="any" ${a} value="${esc(v)}">`;
  if(c.ty==="date")return `<input type="date" ${a} value="${esc(v)}">`;
  if(c.ty==="check")return `<input type="checkbox" ${a} ${v?"checked":""}>`;
  if(c.ty==="sel")return `<select ${a}>${opt([["","—"]].concat((c.opts||[]).map(o=>[o,o])),v)}</select>`;
  if(c.ty==="user"){const us=qbUsers(dept);const L=[["","—"]].concat(us.map(u=>[u.id,u.name]));if(v&&!us.some(u=>u.id===v))L.push([v,qbUName(v)||"(đã rời phòng)"]);return `<select ${a}>${opt(L,v)}</select>`}
  if(c.ty==="link")return `<input type="url" ${a} value="${esc(v)}" placeholder="https://drive.google.com/…">`;
  return `<textarea rows="2" ${a}>${esc(v)}</textarea>`}
function qbRead(root,def){const o={};def.cols.forEach(c=>{const el=root.querySelector(`[data-qbf="${c.k}"]`);if(!el)return;o[c.k]=c.ty==="check"?el.checked:c.ty==="num"?(el.value===""?null:Number(el.value)):el.value.trim()});return o}

/* ---------- Trang ---------- */
function pQpBang(m){
  qbLoad();
  if(QB.cur){if(!QB.data||QB.data.table.id!==QB.cur){qbOpen(QB.cur);m.innerHTML=H("Bảng dữ liệu","")+`<section class="card"><p class="hint">Đang mở bảng…</p></section>`;return}return qbPageTable(m)}
  qbPageList(m);
}
const QB_NOTE=`<section class="card"><p style="margin:0"><b>Dùng để làm gì:</b> những thứ phòng đang theo dõi bằng Sheet ngoài, ví dụ kho ý tưởng hook, booking KOC, hàng mẫu đã gửi, lịch livestream.</p>
 <p class="hint" style="margin:6px 0 0"><b>Không phải chỗ để file.</b> File Word, ảnh, video vẫn để ở Thư mục làm việc (Drive); trong bảng chỉ gắn link tới file. Bảng không lấy số giá vốn, lợi nhuận, lương của hệ thống.</p></section>`;
function qbPageList(m){
  const L=QB.list,me=QB.me||{};
  m.innerHTML=H("Bảng dữ liệu","Bảng biểu phòng tự tạo ngay trên web: tự đặt cột, web tự tính chỉ số, xem dạng bảng hoặc thẻ kéo thả.")+QB_NOTE+
   (me.create?`<div class="acts" style="margin:0 0 12px"><button class="btn pri" id="qb-new">+ Tạo bảng</button></div>`:"")+
   (!L?`<section class="card"><p class="hint">Đang tải…</p></section>`:!L.length?`<section class="card"><p class="hint">${me.create?"Phòng chưa có bảng nào. Bấm \"+ Tạo bảng\" và chọn một mẫu để bắt đầu.":"Chưa có bảng nào mở cho bạn xem."}</p></section>`:
   [...new Set(L.map(t=>t.dept))].map(dp=>`<section class="card"><h2 style="margin:0 0 10px">${esc(qpPb(dp))}</h2><div class="qb-grid">${L.filter(t=>t.dept===dp).map(t=>`<button class="qb-tile" data-qbo="${esc(t.id)}"><b>${esc(t.name)}</b><span class="hint">${t.rows||0} dòng · ${t.def.cols.length} cột${t.def.xem.mode==="lead"?" · chỉ Lead xem":""}</span><span class="hint">Sửa: ${esc((QB_SUA.find(x=>x[0]===t.def.sua)||[,""])[1])}</span></button>`).join("")}</div></section>`).join(""));
  m.querySelectorAll("[data-qbo]").forEach(b=>b.onclick=()=>{QB.cur=b.dataset.qbo;QB.data=null;QB.q="";QB.fv="";QB.view="grid";renderMain();scrollTo(0,0)});
  const nb=$("#qb-new");if(nb)nb.onclick=qbNewDrawer;
}
function qbNewDrawer(){const me=QB.me||{};const depts=me.ceo?(me.depts||[]):[me.leadDept];
  openDrawerHTML(`<h2>Tạo bảng</h2><p class="hint">Chọn một mẫu để có sẵn cột, sau đó thêm bớt cột tùy ý.</p>
   <div class="qb-grid" id="qb-tpls">${QB_TPL.map((t,i)=>`<button class="qb-tile${i===0?" on":""}" data-qbt="${i}"><b>${esc(t[1])}</b><span class="hint">${t[2].map(x=>esc(x[0])).join(" · ")}</span></button>`).join("")}</div>
   <label class="field"><span>Tên bảng</span><input id="qb-nn" maxlength="80" value="${esc(QB_TPL[0][1])}"></label>
   ${depts.length>1?`<label class="field"><span>Của phòng</span><select id="qb-nd">${opt(depts.map(k=>[k,qpPb(k)]),me.leadDept||depts[0])}</select></label>`:""}
   <div class="acts"><button class="btn pri" id="qb-nok">Tạo bảng</button></div>`);
  let sel=0;document.querySelectorAll("[data-qbt]").forEach(b=>b.onclick=()=>{sel=+b.dataset.qbt;document.querySelectorAll("[data-qbt]").forEach(x=>x.classList.toggle("on",x===b));$("#qb-nn").value=QB_TPL[sel][1]});
  $("#qb-nok").onclick=e=>qpBusy(e.target,async()=>{const name=$("#qb-nn").value.trim();if(!name){toast("Đặt tên bảng");return}
    const r=await svApi("/api/hub/qtpb/bang",{method:"POST",body:JSON.stringify({name,def:qbTplDef(QB_TPL[sel]),dept:($("#qb-nd")||{}).value||undefined})});
    closeDrawer();toast("Đã tạo bảng "+name);QB.list=null;QB.cur=r.table.id;QB.data=null;qbLoad(true);renderMain()});
}

function qbPageTable(m){
  const T=qbT(),def=T.def,rows=QB.data.rows||[];
  const kanCol=def.cols.find(c=>c.k===def.kan&&c.ty==="sel");if(QB.view==="kan"&&!kanCol)QB.view="grid";
  const q=QB.q.trim().toLowerCase();
  const fcol=kanCol||def.cols.find(c=>c.ty==="sel");
  const shown=rows.filter(r=>(!q||def.cols.some(c=>{const v=r.data[c.k];return v!=null&&String(c.ty==="user"?qbUName(v):v).toLowerCase().includes(q)}))&&(!QB.fv||!fcol||r.data[fcol.k]===QB.fv));
  m.innerHTML=`<div id="qb-root"><button class="btn sm" id="qb-back">← Tất cả bảng</button>`+H(esc(T.name),esc(qpPb(T.dept))+" · "+rows.length+" dòng · Ai xem: "+(def.xem.mode==="lead"?"chỉ Lead":"cả phòng"+(def.xem.them.length?" + "+def.xem.them.map(qpPb).join(", "):""))+" · Ai sửa: "+esc((QB_SUA.find(x=>x[0]===def.sua)||[,""])[1]))+
   (T.design?`<div class="acts" style="margin:0 0 12px"><button class="btn sm" id="qb-cols">Cột & chỉ số</button><button class="btn sm" id="qb-perm">Ai xem / ai sửa</button><button class="btn sm" id="qb-ren">Đổi tên</button><button class="btn sm" id="qb-del">Xóa bảng</button></div>`:"")+
   (def.metrics.length?`<div class="qb-mets">${def.metrics.map(mt=>`<div class="qb-met"><span class="hint">${esc(mt.t)}</span><b>${qbMetric(mt,def,rows)}</b><span class="hint">${qbMetricSub(mt,def)}</span></div>`).join("")}</div>`:(T.design?`<p class="hint">Chưa có chỉ số tự tính. Bấm "Cột & chỉ số" để thêm (đếm dòng, tổng, trung bình, tỉ lệ).</p>`:""))+
   `<div class="filters"><input id="qb-q" placeholder="Tìm trong bảng" value="${esc(QB.q)}" aria-label="Tìm trong bảng">${fcol?`<select id="qb-fv" aria-label="Lọc theo ${esc(fcol.t)}">${opt([["",fcol.t+": tất cả"]].concat((fcol.opts||[]).map(o=>[o,o])),QB.fv)}</select>`:""}
    <span class="hint">${shown.length} dòng</span><span style="margin-left:auto"></span>${kanCol?`<button class="btn sm${QB.view==="grid"?" pri":""}" id="qb-vg">Bảng</button><button class="btn sm${QB.view==="kan"?" pri":""}" id="qb-vk">Thẻ kéo thả</button>`:""}
    ${T.add?`<button class="btn sm pri" id="qb-add">+ Thêm dòng</button>`:""}</div>`+
   (QB.view==="kan"?qbKanban(def,kanCol,shown):qbGrid(def,shown,T))+`</div>`;
  $("#qb-back").onclick=()=>{QB.cur="";QB.data=null;QB.list=null;renderMain();scrollTo(0,0)};
  const qi=$("#qb-q");let tm;qi.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>{QB.q=qi.value;const p=qi.selectionStart;renderMain();const n=$("#qb-q");if(n){n.focus();try{n.setSelectionRange(p,p)}catch(e){}}},250)};
  const fv=$("#qb-fv");if(fv)fv.onchange=()=>{QB.fv=fv.value;renderMain()};
  const vg=$("#qb-vg");if(vg)vg.onclick=()=>{QB.view="grid";renderMain()};const vk=$("#qb-vk");if(vk)vk.onclick=()=>{QB.view="kan";renderMain()};
  const ad=$("#qb-add");if(ad)ad.onclick=()=>qbRowDrawer(null);
  m.querySelectorAll("[data-qbr]").forEach(tr=>tr.onclick=e=>{if(e.target.closest("[data-qbq]"))return;qbRowDrawer(rows.find(r=>r.id===tr.dataset.qbr))});
  /* Đổi nhanh ô kiểu Chọn ngay trên bảng. */
  m.querySelectorAll("[data-qbq]").forEach(s=>s.onchange=()=>qbPatch(s.dataset.qbq,{[s.dataset.k]:s.value},s));
  if(T.design){$("#qb-cols").onclick=qbColsDrawer;$("#qb-perm").onclick=qbPermDrawer;
    $("#qb-ren").onclick=()=>{const n=prompt("Tên mới của bảng",T.name);if(n&&n.trim()&&n.trim()!==T.name)qbSaveDef({name:n.trim()})};
    $("#qb-del").onclick=e=>{if(!confirm(`Xóa bảng "${T.name}"?\n\nCEO và Quản lý khôi phục được từ Nhật ký nếu xóa nhầm.`))return;qpBusy(e.target,async()=>{await svApi("/api/hub/qtpb/bang/"+T.id,{method:"DELETE"});toast("Đã xóa bảng");QB.cur="";QB.data=null;QB.list=null;renderMain()})}}
  /* Kéo thẻ sang cột khác để đổi trạng thái. */
  m.querySelectorAll("[data-qbk]").forEach(c=>c.addEventListener("dragstart",e=>{e.dataTransfer.setData("text/plain",c.dataset.qbk)}));
  m.querySelectorAll("[data-qbcol]").forEach(col=>{col.addEventListener("dragover",e=>{e.preventDefault();col.classList.add("over")});col.addEventListener("dragleave",()=>col.classList.remove("over"));
    col.addEventListener("drop",e=>{e.preventDefault();col.classList.remove("over");const id=e.dataTransfer.getData("text/plain");const r=rows.find(x=>x.id===id);if(!r||!r.edit)return;const v=col.dataset.qbcol;if((r.data[kanCol.k]||"")===v)return;qbPatch(id,{[kanCol.k]:v})})});
  m.querySelectorAll("[data-qbk]").forEach(c=>c.onclick=()=>qbRowDrawer(rows.find(r=>r.id===c.dataset.qbk)));
}
function qbGrid(def,rows,T){
  const head=def.cols.map(c=>esc(c.t)+` <span class="hint">${qbTyN(c.ty)}</span>`);
  return `<section class="card flush">`+tbl(head,rows.map(r=>`<tr data-qbr="${esc(r.id)}" class="qb-tr">${def.cols.map(c=>`<td>${c.ty==="sel"&&r.edit?`<select data-qbq="${esc(r.id)}" data-k="${c.k}" aria-label="${esc(c.t)}">${opt([["","—"]].concat((c.opts||[]).map(o=>[o,o])),r.data[c.k]||"")}</select>`:qbCell(c,r.data[c.k])}</td>`).join("")}</tr>`))+
   (rows.length?"":(T.add?`<p class="hint pad">Bấm "+ Thêm dòng" để nhập dòng đầu tiên.</p>`:""))+`</section>`;
}
function qbKanban(def,kc,rows){
  const cols=(kc.opts||[]).concat([""]);const t0=def.cols.find(c=>c.ty==="text")||def.cols[0];const sub=def.cols.filter(c=>c!==t0&&c!==kc&&["sel","user","date"].includes(c.ty)).slice(0,2);
  return `<section class="card"><div class="qb-kan">${cols.map(v=>{const rs=rows.filter(r=>(r.data[kc.k]||"")===v);if(v===""&&!rs.length)return "";
    return `<div class="qb-kcol" data-qbcol="${esc(v)}"><h5>${esc(v||"Chưa chọn")} · ${rs.length}</h5>${rs.map(r=>`<div class="qb-kc" ${r.edit?'draggable="true"':""} data-qbk="${esc(r.id)}"><b>${qbCell(t0,r.data[t0.k])}</b>${sub.map(c=>r.data[c.k]?`<div class="hint">${c.ty==="sel"?esc(r.data[c.k]):qbCell(c,r.data[c.k])}</div>`:"").join("")}</div>`).join("")}</div>`}).join("")}</div>
   <p class="hint">Kéo thẻ sang cột khác để đổi ${esc(kc.t.toLowerCase())}. Bấm vào thẻ để xem, sửa.</p></section>`;
}

/* ---------- Thêm / sửa dòng ---------- */
function qbRowDrawer(r){const T=qbT(),def=T.def,ed=r?r.edit:T.add;
  openDrawerHTML(`<h2>${r?(ed?"Sửa dòng":"Xem dòng"):"Thêm dòng"}</h2><p class="hint">${esc(T.name)}${r&&r.by_name?" · thêm bởi "+esc(r.by_name):""}${r&&r.updated_name?" · sửa gần nhất: "+esc(r.updated_name)+" "+esc(qpDate(r.updated_at)):""}</p>
   <div id="qb-form">${def.cols.map((c,i)=>ed?(c.ty==="check"?`<label class="field" style="flex-direction:row;gap:8px;align-items:center">${qbInput(c,r&&r.data[c.k],T.dept,"qbi"+i)}<span>${esc(c.t)}</span></label>`:`<label class="field"><span>${esc(c.t)}</span>${qbInput(c,r&&r.data[c.k],T.dept,"qbi"+i)}</label>`):
     `<div class="field"><span class="hint">${esc(c.t)}</span><div>${c.ty==="text"&&r.data[c.k]?esc(r.data[c.k]).replace(/\n/g,"<br>"):qbCell(c,r.data[c.k])}</div></div>`).join("")}</div>
   ${ed?`<div class="acts"><button class="btn pri" id="qb-rs">${r?"Lưu":"Thêm dòng"}</button>${r?`<button class="btn" id="qb-rd">Xóa dòng</button>`:""}</div>`:`<p class="hint">Bạn chỉ xem được dòng này. Ai sửa: ${esc((QB_SUA.find(x=>x[0]===def.sua)||[,""])[1])}.</p>`}`);
  if(!ed)return;
  /* Thêm dòng mới: người phụ trách mặc định là người đang nhập. */
  if(!r){const uc=def.cols.find(c=>c.ty==="user");const el=uc&&document.querySelector(`#qb-form [data-qbf="${uc.k}"]`);if(el&&ME&&qbUsers(T.dept).some(u=>u.id===ME.id))el.value=ME.id}
  $("#qb-rs").onclick=e=>qpBusy(e.target,async()=>{const data=qbRead($("#qb-form"),def);
    if(r){const x=await svApi(`/api/hub/qtpb/bang/${T.id}/rows/${r.id}`,{method:"PUT",body:JSON.stringify({data})});QB.data.rows=QB.data.rows.map(y=>y.id===r.id?x.row:y)}
    else{const x=await svApi(`/api/hub/qtpb/bang/${T.id}/rows`,{method:"POST",body:JSON.stringify({data})});QB.data.rows.push(x.row)}
    closeDrawer();toast(r?"Đã lưu":"Đã thêm dòng");renderMain()});
  const dl=$("#qb-rd");if(dl)dl.onclick=e=>{if(!confirm("Xóa dòng này?"))return;qpBusy(e.target,async()=>{await svApi(`/api/hub/qtpb/bang/${T.id}/rows/${r.id}`,{method:"DELETE"});QB.data.rows=QB.data.rows.filter(y=>y.id!==r.id);closeDrawer();toast("Đã xóa dòng");renderMain()})};
}
async function qbPatch(id,data,el){const T=qbT();if(el)el.disabled=true;
  try{const x=await svApi(`/api/hub/qtpb/bang/${T.id}/rows/${id}`,{method:"PUT",body:JSON.stringify({data})});QB.data.rows=QB.data.rows.map(y=>y.id===id?x.row:y)}
  catch(e){toast("Chưa lưu được: "+e.message)}finally{if(el)el.disabled=false;renderMain()}}
async function qbSaveDef(p){const T=qbT();try{const x=await svApi("/api/hub/qtpb/bang/"+T.id,{method:"PUT",body:JSON.stringify(p)});QB.data.table=x.table;QB.list=null;toast("Đã lưu. Thay đổi ghi vào Nhật ký phòng.");return true}catch(e){toast("Chưa lưu được: "+e.message);return false}finally{renderMain()}}

/* ---------- Lead: cột & chỉ số ---------- */
function qbColsDrawer(){const T=qbT();const W=JSON.parse(JSON.stringify(T.def));const old=new Set(T.def.cols.map(c=>c.k));
  const draw=()=>{
    openDrawerHTML(`<h2>Cột & chỉ số</h2><p class="hint">Bỏ cột thì dữ liệu cột đó vẫn giữ; CEO và Quản lý khôi phục được từ Nhật ký. Kiểu của cột đã có không đổi được (để không hỏng dữ liệu cũ).</p>
     <h3>Cột</h3><div id="qb-cl">${W.cols.map((c,i)=>`<div class="qb-crow"><div class="qb-cmv"><button class="btn sm" data-qbu="${i}" ${i?"":"disabled"} aria-label="Lên">↑</button><button class="btn sm" data-qbd="${i}" ${i<W.cols.length-1?"":"disabled"} aria-label="Xuống">↓</button></div>
       <input data-qbn="${i}" value="${esc(c.t)}" maxlength="60" aria-label="Tên cột">
       ${old.has(c.k)?`<span class="pill p-gry">${qbTyN(c.ty)}</span>`:`<select data-qby="${i}" aria-label="Kiểu cột">${opt(QB_TY,c.ty)}</select>`}
       <button class="btn sm" data-qbx="${i}" aria-label="Bỏ cột ${esc(c.t)}" ${W.cols.length>1?"":"disabled"}>×</button>
       ${c.ty==="sel"?`<label class="field qb-opts"><span class="hint">Các lựa chọn, cách nhau dấu phẩy</span><input data-qbo2="${i}" value="${esc((c.opts||[]).join(", "))}"></label>`:""}</div>`).join("")}</div>
     <div class="acts"><button class="btn sm" id="qb-ca">+ Thêm cột</button></div>
     <label class="field"><span>Chia thẻ kéo thả theo cột</span><select id="qb-kan">${opt([["","Không dùng thẻ kéo thả"]].concat(W.cols.filter(c=>c.ty==="sel").map(c=>[c.k,c.t])),W.kan||"")}</select></label>
     <h3>Chỉ số tự tính</h3><div id="qb-ml">${W.metrics.map((mt,i)=>`<div class="qb-crow"><input data-qbmt="${i}" value="${esc(mt.t)}" maxlength="60" aria-label="Tên chỉ số">
       <select data-qbmk="${i}" aria-label="Cách tính">${opt(QB_MK,mt.kind)}</select>
       ${mt.kind==="tong"||mt.kind==="tb"?`<select data-qbmc="${i}" aria-label="Cột số">${opt(W.cols.filter(c=>c.ty==="num").map(c=>[c.k,c.t]).concat(W.cols.some(c=>c.ty==="num")?[]:[["","Chưa có cột kiểu Số"]]),mt.col||"")}</select>`:""}
       <select data-qbmf="${i}" aria-label="Chỉ tính dòng có">${opt([["",mt.kind==="tile"?"Chọn điều kiện":"Mọi dòng"]].concat(W.cols.filter(c=>c.ty==="sel"||c.ty==="check").map(c=>[c.k,"Chỉ dòng có "+c.t])),mt.fc||"")}</select>
       ${(()=>{const fc=W.cols.find(c=>c.k===mt.fc);if(!fc)return "";return `<select data-qbmv="${i}" aria-label="Giá trị">${opt(fc.ty==="check"?[["1","đã tích"],["0","chưa tích"]]:(fc.opts||[]).map(o=>[o,o]),mt.fv||"")}</select>`})()}
       <button class="btn sm" data-qbmx="${i}" aria-label="Bỏ chỉ số">×</button></div>`).join("")||`<p class="hint">Chưa có chỉ số.</p>`}</div>
     <div class="acts"><button class="btn sm" id="qb-ma">+ Thêm chỉ số</button></div>
     <div class="acts"><button class="btn pri" id="qb-cs">Lưu cột & chỉ số</button></div>`);
    const dr=$("#drawerIn");
    const pull=()=>{dr.querySelectorAll("[data-qbn]").forEach(x=>{W.cols[+x.dataset.qbn].t=x.value});dr.querySelectorAll("[data-qby]").forEach(x=>{const c=W.cols[+x.dataset.qby];c.ty=x.value;if(c.ty==="sel"&&!c.opts)c.opts=["Mới","Đang làm","Xong"]});
      dr.querySelectorAll("[data-qbo2]").forEach(x=>{W.cols[+x.dataset.qbo2].opts=[...new Set(x.value.split(",").map(s=>s.trim()).filter(Boolean))]});W.kan=$("#qb-kan").value;
      dr.querySelectorAll("[data-qbmt]").forEach(x=>{W.metrics[+x.dataset.qbmt].t=x.value});dr.querySelectorAll("[data-qbmk]").forEach(x=>{W.metrics[+x.dataset.qbmk].kind=x.value});
      dr.querySelectorAll("[data-qbmc]").forEach(x=>{W.metrics[+x.dataset.qbmc].col=x.value});dr.querySelectorAll("[data-qbmf]").forEach(x=>{const mt=W.metrics[+x.dataset.qbmf];if(mt.fc!==x.value){mt.fc=x.value;mt.fv=""}});
      dr.querySelectorAll("[data-qbmv]").forEach(x=>{W.metrics[+x.dataset.qbmv].fv=x.value})};
    dr.querySelectorAll("[data-qby],[data-qbmk],[data-qbmf]").forEach(x=>x.onchange=()=>{pull();draw()});
    dr.querySelectorAll("[data-qbu]").forEach(b=>b.onclick=()=>{pull();const i=+b.dataset.qbu;[W.cols[i-1],W.cols[i]]=[W.cols[i],W.cols[i-1]];draw()});
    dr.querySelectorAll("[data-qbd]").forEach(b=>b.onclick=()=>{pull();const i=+b.dataset.qbd;[W.cols[i+1],W.cols[i]]=[W.cols[i],W.cols[i+1]];draw()});
    dr.querySelectorAll("[data-qbx]").forEach(b=>b.onclick=()=>{pull();const c=W.cols[+b.dataset.qbx];if(old.has(c.k)&&!confirm(`Bỏ cột "${c.t}"? Dữ liệu cột này vẫn giữ, khôi phục được từ Nhật ký.`))return;W.cols.splice(+b.dataset.qbx,1);
      W.metrics=W.metrics.filter(mt=>mt.col!==c.k&&mt.fc!==c.k);if(W.kan===c.k)W.kan="";draw()});
    dr.querySelectorAll("[data-qbmx]").forEach(b=>b.onclick=()=>{pull();W.metrics.splice(+b.dataset.qbmx,1);draw()});
    $("#qb-ca").onclick=()=>{pull();if(W.cols.length>=30){toast("Tối đa 30 cột");return}W.cols.push({k:qbKey(),t:"Cột mới",ty:"text"});draw();const ns=dr.querySelectorAll("[data-qbn]");const n=ns[ns.length-1];if(n){n.focus();n.select()}};
    $("#qb-ma").onclick=()=>{pull();if(W.metrics.length>=12){toast("Tối đa 12 chỉ số");return}W.metrics.push({t:"Số dòng",kind:"dem"});draw()};
    $("#qb-cs").onclick=e=>{pull();
      for(const c of W.cols){c.t=c.t.trim();if(!c.t){toast("Có cột chưa đặt tên");return}if(c.ty==="sel"&&!(c.opts||[]).length){toast(`Cột "${c.t}" cần ít nhất một lựa chọn`);return}}
      for(const mt of W.metrics){if((mt.kind==="tong"||mt.kind==="tb")&&!mt.col){toast(`Chỉ số "${mt.t}" cần một cột kiểu Số`);return}if(mt.kind==="tile"&&(!mt.fc||mt.fv==="")){toast(`Chỉ số "${mt.t}" cần chọn điều kiện để tính tỉ lệ`);return}
        if(mt.fc&&mt.fv===""){const fc=W.cols.find(c=>c.k===mt.fc);mt.fv=fc&&fc.ty==="check"?"1":((fc&&fc.opts)||[""])[0]}}
      qpBusy(e.target,async()=>{if(await qbSaveDef({def:W}))closeDrawer()})};
  };draw();
}

/* ---------- Lead: ai xem / ai sửa ---------- */
function qbPermDrawer(){const T=qbT(),d=T.def;const others=(D().departments||[]).filter(p=>p.k!==T.dept);
  openDrawerHTML(`<h2>Ai xem / ai sửa</h2><p class="hint">${esc(T.name)}. Lead và CEO luôn xem, sửa được.</p>
   <fieldset class="field"><legend>Ai xem</legend>${[["phong","Cả phòng "+qpPb(T.dept)],["lead","Chỉ Lead"]].map(([k,n])=>`<label class="qb-rad"><input type="radio" name="qbx" value="${k}" ${d.xem.mode===k?"checked":""}> ${esc(n)}</label>`).join("")}</fieldset>
   <fieldset class="field" id="qb-them"><legend>Mời thêm phòng khác xem (chỉ xem, không sửa)</legend>${others.map(p=>`<label class="qb-rad"><input type="checkbox" data-qbth="${esc(p.k)}" ${d.xem.them.includes(p.k)?"checked":""}> ${esc(p.n)}</label>`).join("")}</fieldset>
   <fieldset class="field"><legend>Ai sửa</legend>${QB_SUA.map(([k,n])=>`<label class="qb-rad"><input type="radio" name="qbs" value="${k}" ${d.sua===k?"checked":""}> ${esc(n)}${k==="phutrach"?` <span class="hint">(người trong phòng sửa dòng mình thêm hoặc dòng có tên mình ở cột kiểu Người)</span>`:""}</label>`).join("")}</fieldset>
   <div class="acts"><button class="btn pri" id="qb-ps">Lưu</button></div>`);
  const sync=()=>{const lead=document.querySelector('[name="qbx"]:checked').value==="lead";$("#qb-them").style.opacity=lead?".5":"";$("#qb-them").querySelectorAll("input").forEach(x=>x.disabled=lead)};
  document.querySelectorAll('[name="qbx"]').forEach(x=>x.onchange=sync);sync();
  $("#qb-ps").onclick=e=>{const mode=document.querySelector('[name="qbx"]:checked').value;const them=mode==="lead"?[]:[...document.querySelectorAll("[data-qbth]:checked")].map(x=>x.dataset.qbth);
    const def=Object.assign({},d,{xem:{mode,them},sua:document.querySelector('[name="qbs"]:checked').value});qpBusy(e.target,async()=>{if(await qbSaveDef({def}))closeDrawer()})};
}

/* ---------- Kiểu dáng riêng ---------- */
{const st=document.createElement("style");st.textContent=`
.qb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.qb-tile{display:flex;flex-direction:column;gap:4px;text-align:left;border:1px solid var(--line,#e7e9f0);border-radius:12px;padding:12px;background:var(--surface,#fff);cursor:pointer;font:inherit;color:inherit;min-width:0}
.qb-tile:hover,.qb-tile.on{border-color:var(--pri,#14213d);box-shadow:0 0 0 2px rgba(20,33,61,.08)}
.qb-mets{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin:0 0 12px}
.qb-met{display:flex;flex-direction:column;gap:2px;border:1px solid var(--line,#e7e9f0);border-radius:12px;padding:10px 12px;background:var(--surface,#fff);min-width:0}
.qb-met b{font-size:22px}
.qb-tr{cursor:pointer}.qb-tr:hover td{background:rgba(20,33,61,.03)}
.qb-kan{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px}
.qb-kcol{flex:0 0 230px;background:#f5f6fa;border-radius:12px;padding:8px;min-height:120px}.qb-kcol.over{outline:2px dashed var(--pri,#14213d)}
.qb-kcol h5{margin:2px 4px 8px;font-size:13px}
.qb-kc{background:#fff;border:1px solid var(--line,#e7e9f0);border-radius:9px;padding:8px;margin-bottom:6px;font-size:13px;cursor:pointer}.qb-kc[draggable=true]{cursor:grab}
.qb-crow{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line,#e7e9f0)}
.qb-crow input:not([type]),.qb-crow input[type=text]{flex:1 1 160px;min-width:0}.qb-cmv{display:flex;gap:2px}.qb-opts{flex:1 1 100%;margin:0}
.qb-rad{display:block;padding:4px 0}
@media (max-width:640px){.qb-kcol{flex-basis:78vw}}`;document.head.appendChild(st)}

Object.assign(PAGES,{qp_bang:pQpBang});
/* Menu: Task giao việc › Bảng dữ liệu cho mọi người của phòng đã mở Quản trị phòng, phòng được mời xem, CEO;
   Lead thấy thêm ở Nhân sự › Quản trị phòng. */
{const qbMenuOk=u=>!!u&&(u.role==="admin"||(!!u.phongBan&&(qpCfg().depts.includes(u.phongBan)||(((D()&&D().qtpb)||{}).bangXem||[]).includes(u.phongBan))));
  const cv=MODULES.find(x=>x.k==="cv");if(cv){const g0=cv.groups;cv.groups=function(){const G=g0.apply(this,arguments)||[];if(!G.length||G.some(g=>(g[1]||[]).some(i=>i&&i[0]==="qp_bang")))return G;
    let ok=false;try{ok=!ME||qbMenuOk(ME)}catch(e){}if(!ok)return G;const G2=G.slice();G2[0]=[G2[0][0],(G2[0][1]||[]).concat([MI("qp_bang","Bảng dữ liệu",qbMenuOk)])];return G2}}
  QP_ALWAYS.add("qp_bang");
}
