/* =====================================================================
   Sản xuất & kho › Xuất kho: ĐƠN NPP CHỜ XUẤT + ĐÃ XUẤT
   Đơn đã duyệt hiện ở đây cho kế toán kho: ngày hẹn xuất (nếu có), In phiếu xuất kho (không giá),
   ghi số thực xuất từng mã rồi bấm xác nhận. Kho trừ tồn theo số thực xuất.
   Bên dưới là các đơn đã xuất trong kỳ (chọn ở thanh trên cùng) để xem lại và in lại phiếu.
   ===================================================================== */
const XP={rows:null,done:null,doneKey:"",busy:false,err:"",at:0,edits:null};
const xpApprover=()=>ME&&(ME.role==="admin"||can(ME,"order.approve.normal"));
async function xpLoad(){
  if(XP.busy)return;XP.busy=true;
  try{
    const P=kPer();
    const [a,b,ed]=await Promise.all([kApi("/b2b-pending"),kApi("/b2b-shipped?from="+P.from+"&to="+P.to),svApi("/api/orders/ship-edits").catch(()=>[])]);
    XP.rows=a;XP.done=b;XP.edits=ed;XP.doneKey=P.from+"|"+P.to;XP.err="";XP.at=Date.now()}
  catch(e){XP.err=e.message||"Không tải được"}
  XP.busy=false;if(PAGE==="kho_xuat_b2b")renderMain()}
const xpDate=s=>s?s.slice(8,10)+"/"+s.slice(5,7):"";
const xpToday=()=>new Date(Date.now()+7*3600e3).toISOString().slice(0,10);
function xpPending(){
  const R=XP.rows;
  const head=`<div class="card-h pad"><h2>Đơn NPP chờ xuất kho</h2><span class="hint">${R?R.length+" đơn":""} · <button class="lnk" id="xp-re">Tải lại</button></span></div>`;
  if(XP.err)return `<section class="card flush" id="xp-sec">${head}<div class="note red">${esc(XP.err)}</div></section>`;
  if(!R)return `<section class="card flush" id="xp-sec">${head}<p class="hint pad">Đang tải…</p></section>`;
  if(!R.length)return `<section class="card flush" id="xp-sec">${head}<p class="hint pad">Không có đơn nào đang chờ xuất. Đơn nào được duyệt xong sẽ hiện ở đây.</p></section>`;
  const today=xpToday();
  const rows=R.map(o=>{
    const due=o.ship_date||o.need_date||"",late=due&&due<today,soon=due&&due===today;
    return `<tr><td><b>${esc(o.order_no)}</b></td><td>${esc(o.customer_name)}</td>
      <td>${due?`<span class="pill p-${late?"red":soon?"amb":"gry"}">${late?"Quá hẹn ":soon?"Hôm nay ":""}${xpDate(due)}</span>`:`<span class="hint">Không hẹn</span>`}</td>
      <td class="n">${o.lines.length} mã</td><td>${esc(o.owner_name||"")}</td>
      <td class="nowrap"><button class="btn sm" data-xp-print="${o.id}">In phiếu xuất kho</button> <button class="btn sm pri" data-xp-open="${o.id}">Ghi thực xuất</button></td></tr>`}).join("");
  return `<section class="card flush" id="xp-sec">${head}${tbl(["Mã đơn","Khách","Ngày hẹn xuất","Số mã","Sale",""],[rows])}</section>`}
/* Yêu cầu sửa phiếu xuất đang chờ duyệt: kho gửi kèm lý do, quản lý điều phối / CEO duyệt hoặc từ chối. */
function xpEdits(){
  const E=XP.edits;if(!E||!E.length)return "";const ap=xpApprover();
  const diff=r=>{const cur=new Map((r.current||[]).map(x=>[x.product_id,x]));
    const parts=(r.lines||[]).map(l=>{const c=cur.get(l.product_id)||{sku:l.product_id,qty:"?"};return `${esc(c.sku)}: ${c.qty} → <b>${l.shipped_qty}</b>`});
    if(r.ship_day)parts.push(`Ngày xuất → <b>${xpDate(r.ship_day)}</b>`);if(r.shipped_by_name)parts.push(`Người xuất → <b>${esc(r.shipped_by_name)}</b>`);return parts.join("<br>")};
  const rows=E.map(r=>`<tr><td><b>${esc(r.order_no)}</b></td><td>${esc(r.customer_name)}</td><td>${diff(r)}</td><td>${esc(r.reason)}<br><small class="hint">${esc(r.requested_by_name||"")} · ${String(r.requested_at||"").slice(0,16).replace("T"," ")}</small></td>
    <td class="nowrap">${ap?`<button class="btn sm pri" data-xp-dec="${r.id}" data-d="APPROVED">Duyệt</button> <button class="btn sm" data-xp-dec="${r.id}" data-d="REJECTED">Từ chối</button>`:`<span class="pill p-amb">Chờ duyệt</span>`}</td></tr>`).join("");
  return `<section class="card flush" id="xp-edits"><div class="card-h pad"><h2>Yêu cầu sửa phiếu xuất chờ duyệt</h2><span class="hint">${E.length} yêu cầu</span></div>${tbl(["Mã đơn","Khách","Sửa gì","Lý do / người gửi",""],[rows])}</section>`}
function xpShipped(){
  const D=XP.done;if(!D)return "";
  const P=kPer();
  const rows=D.map(o=>`<tr><td><b>${esc(o.order_no)}</b></td><td>${esc(o.customer_name)}</td><td><b>${xpDate(o.shipped_day)}</b></td><td>${o.shipped_by_name?esc(o.shipped_by_name):`<span class="pill p-amb">Chưa ghi</span>`}</td><td class="n">${o.lines.length} mã</td>
    <td class="nowrap"><button class="btn sm pri" data-xp-edit="${o.id}">Sửa phiếu xuất</button> <button class="btn sm" data-xp-print="${o.id}">In lại phiếu</button> <button class="btn sm" data-xp-view="${o.id}">Xem</button></td></tr>`).join("");
  return `<section class="card flush" id="xp-done"><div class="card-h pad"><h2>Đơn NPP đã xuất kho trong kỳ ${kPerLabel(P)}</h2><span class="hint">${D.length} đơn</span></div>
   ${D.length?tbl(["Mã đơn","Khách","Ngày xuất kho","Người xuất kho","Số mã",""],[rows]):`<p class="hint pad">Chưa có đơn nào xuất trong kỳ này.</p>`}</section>`}
function xpBind(sec){
  if($("#xp-re"))$("#xp-re").onclick=()=>xpLoad();
  sec.querySelectorAll("[data-xp-print]").forEach(b=>b.onclick=()=>window.open("/print/orders/"+b.dataset.xpPrint+"?type=ship","_blank"));
  sec.querySelectorAll("[data-xp-open]").forEach(b=>b.onclick=()=>xpOpen(b.dataset.xpOpen));
  sec.querySelectorAll("[data-xp-view]").forEach(b=>b.onclick=()=>xpView(b.dataset.xpView));
  sec.querySelectorAll("[data-xp-edit]").forEach(b=>b.onclick=()=>xpEdit(b.dataset.xpEdit));
  sec.querySelectorAll("[data-xp-dec]").forEach(b=>b.onclick=async()=>{
    const rej=b.dataset.d==="REJECTED";let note=null;
    if(rej){note=prompt("Lý do từ chối (bắt buộc):");if(!note||note.trim().length<3)return}
    else if(!confirm("Duyệt sửa phiếu xuất? Tồn kho và đơn sẽ đổi theo."))return;
    b.disabled=true;
    try{await svApi("/api/orders/ship-edits/"+b.dataset.xpDec+"/decide",{method:"POST",body:JSON.stringify({decision:b.dataset.d,note})});
      toast(rej?"Đã từ chối":"Đã duyệt và sửa phiếu xuất");KHO.at=0;if(typeof khoLoad==="function")khoLoad(true);await xpLoad()}
    catch(e){toast(e.message||"Chưa xử lý được");b.disabled=false}})}
/* Sửa phiếu xuất của đơn đã xuất (số thực xuất từng mã, ngày xuất, người xuất): bắt buộc có lý do.
   Kế toán kho gửi yêu cầu để quản lý điều phối / CEO duyệt; người có quyền duyệt sửa thì áp ngay. */
function xpEdit(id){
  const o=(XP.done||[]).find(x=>x.id===id);if(!o)return;const ap=xpApprover();
  const pend=(XP.edits||[]).some(e=>e.order_id===id);
  openDrawerHTML(`<h2>Sửa phiếu xuất · ${esc(o.order_no)}</h2><p class="hint">${esc(o.customer_name)} · hiện ghi ngày ${xpDate(o.shipped_day)}</p>
   <div class="note">${ap?"Bạn có quyền duyệt nên sửa xong là áp ngay, vẫn ghi lại lý do và người sửa.":"Phiếu chỉ đổi khi <b>quản lý điều phối hoặc CEO duyệt</b>. Ghi rõ lý do để người duyệt đối chiếu."}${pend?" <b>Phiếu này đang có một yêu cầu chờ duyệt, chờ duyệt xong mới gửi tiếp.</b>":""}</div>
   <div class="card flush"><table class="tbl"><thead><tr><th>Mã</th><th>Tên</th><th class="n">Số hiện tại</th><th class="n">Số đúng</th></tr></thead><tbody>
   ${o.lines.filter(l=>!l.is_gift||true).map(l=>`<tr><td>${esc(l.sku)}</td><td>${esc(l.name)}${l.is_gift?` <span class="pill p-gry">Tặng</span>`:""}</td><td class="n">${l.qty}</td><td><input class="xe-q n" type="number" min="0" step="1" data-p="${l.product_id}" data-cur="${l.qty}" value="${l.qty}" style="width:90px"></td></tr>`).join("")}</tbody></table></div>
   <div class="row4" style="margin-top:10px"><label class="field">Ngày xuất kho<input id="xe-d" type="date" max="${xpToday()}" value="${o.shipped_day||xpToday()}"></label>
   <label class="field">Người xuất kho<input id="xe-n" value="${esc(o.shipped_by_name||"")}" placeholder="Họ tên người xuất hàng"></label></div>
   <label class="field">Lý do sửa (bắt buộc)<input id="xe-r" placeholder="Ví dụ: nhập nhầm 20 thành 2, xuất ngày 18 chứ không phải 19"></label>
   <div class="acts" style="margin-top:12px"><button class="btn pri" id="xe-ok"${pend?" disabled":""}>${ap?"Lưu sửa":"Gửi yêu cầu sửa"}</button><span id="xe-msg" class="hint"></span></div>`);
  $("#xe-ok").onclick=async()=>{
    const d=$("#xe-d").value,n=$("#xe-n").value.trim(),why=$("#xe-r").value.trim();
    const lines=[...document.querySelectorAll(".xe-q")].filter(i=>Math.max(0,Math.floor(+i.value||0))!==+i.dataset.cur).map(i=>({product_id:i.dataset.p,shipped_qty:Math.max(0,Math.floor(+i.value||0))}));
    const body={reason:why};if(lines.length)body.lines=lines;if(d&&d!==o.shipped_day)body.ship_day=d;if(n&&n!==(o.shipped_by_name||""))body.shipped_by_name=n;
    if(!lines.length&&!body.ship_day&&!body.shipped_by_name){$("#xe-msg").textContent="Chưa đổi gì: sửa số lượng, ngày hoặc người xuất";return}
    if(why.length<5){$("#xe-msg").textContent="Ghi lý do sửa (ít nhất vài chữ)";$("#xe-r").focus();return}
    const b=$("#xe-ok");b.disabled=true;$("#xe-msg").textContent="Đang gửi…";
    try{const r=await svApi("/api/orders/"+o.id+"/ship-edits",{method:"POST",body:JSON.stringify(body)});
      closeDrawer();toast(r.applied?"Đã sửa phiếu xuất "+o.order_no:"Đã gửi yêu cầu sửa, chờ quản lý điều phối duyệt");KHO.at=0;if(typeof khoLoad==="function")khoLoad(true);await xpLoad()}
    catch(e){$("#xe-msg").textContent=e.message;b.disabled=false}}}
function xpView(id){
  const o=(XP.done||[]).find(x=>x.id===id);if(!o)return;
  openDrawerHTML(`<h2>${esc(o.order_no)} · ${esc(o.customer_name)}</h2>
   <p class="hint">Xuất kho ngày ${xpDate(o.shipped_day)} · Người xuất ${esc(o.shipped_by_name||"chưa ghi")} · Sale ${esc(o.owner_name||"—")}</p>
   <div class="card flush"><table class="tbl"><thead><tr><th>Mã</th><th>Tên</th><th>ĐVT</th><th class="n">Số lượng</th></tr></thead><tbody>
   ${o.lines.map(l=>`<tr><td>${esc(l.sku)}</td><td>${esc(l.name)}${l.is_gift?` <span class="pill p-gry">Tặng</span>`:""}</td><td>${esc(l.unit||"")}</td><td class="n">${l.qty}</td></tr>`).join("")}</tbody></table></div>
   <div class="acts" style="margin-top:12px"><button class="btn pri" id="xp-pr">In phiếu xuất kho</button></div>`);
  $("#xp-pr").onclick=()=>window.open("/print/orders/"+o.id+"?type=ship","_blank")}
function xpOpen(id){
  const o=(XP.rows||[]).find(x=>x.id===id);if(!o)return;
  const due=o.ship_date||o.need_date||"",flow=true;
  openDrawerHTML(`<h2>${esc(o.order_no)} · ${esc(o.customer_name)}</h2>
   <p class="hint">${due?`Hẹn xuất ${xpDate(due)} · `:""}Sale ${esc(o.owner_name||"—")}${o.kho_note?` · Ghi chú: ${esc(o.kho_note)}`:""}</p>
   <div class="note">${flow?"Xuất hàng rồi ghi <b>số thực xuất</b> từng mã ở cột bên phải (đã điền sẵn bằng số đặt, xuất khác thì sửa). Kho trừ tồn theo số này.":"Xuất đúng hàng theo phiếu rồi bấm xác nhận. Kho trừ tồn theo số lượng trên đơn (đơn này chạy luồng cũ nên chưa ghi được số xuất khác đơn: nếu xuất khác, báo sale sửa đơn trước)."} Phải tự chọn <b>ngày xuất</b> và ghi <b>tên người xuất</b> dưới đây; tồn kho trừ vào ngày đó.</div>
   <div class="card flush" style="max-height:none;overflow:visible"><table class="tbl"><thead><tr><th>Mã</th><th>Tên</th><th>ĐVT</th><th class="n">Đặt</th><th class="n">Thực xuất</th></tr></thead><tbody>
   ${o.lines.map(l=>`<tr><td>${esc(l.sku)}</td><td>${esc(l.name)}${l.is_gift?` <span class="pill p-gry">Tặng</span>`:""}</td><td>${esc(l.unit||"")}</td><td class="n">${l.qty}</td><td><input class="xp-q n" type="number" min="0" step="1" data-p="${l.product_id}" value="${l.qty}" style="width:90px"></td></tr>`).join("")}
   </tbody></table></div>
   <div class="row4" style="margin-top:10px"><label class="field">Ngày xuất kho<input id="xp-d" type="date" max="${xpToday()}" value=""></label>
   <label class="field">Người xuất kho (tự điền tên)<input id="xp-by" placeholder="Họ tên người xuất hàng"></label></div>
   ${flow?`<label class="field" style="margin-top:6px">Ghi chú<input id="xp-note" placeholder="Nếu xuất thiếu / khác đơn thì ghi lý do"></label>`:""}
   <div class="acts" style="margin-top:12px"><button class="btn" id="xp-pr">In phiếu xuất kho</button><button class="btn pri" id="xp-ok">Xác nhận đã xuất</button><span id="xp-msg" class="hint"></span></div>`);
  $("#xp-pr").onclick=()=>window.open("/print/orders/"+o.id+"?type=ship","_blank");
  $("#xp-ok").onclick=async()=>{
    const day=$("#xp-d").value,by=$("#xp-by").value.trim();
    if(!day){$("#xp-msg").textContent="Phải chọn ngày xuất kho (ngày hàng thực sự rời kho)";$("#xp-d").focus();return}
    if(by.length<2){$("#xp-msg").textContent="Người xuất kho phải tự ghi tên mình";$("#xp-by").focus();return}
    let lines=[];
    if(!flow){
      const bad=[...document.querySelectorAll(".xp-q")].filter(i=>{const l=o.lines.find(y=>y.product_id===i.dataset.p);return l&&l.qty!==Math.max(0,Math.floor(+i.value||0))});
      if(bad.length){$("#xp-msg").textContent="Có "+bad.length+" mã xuất khác số đặt. Đơn này chạy luồng cũ nên chưa ghi được: hãy báo sale sửa đơn cho đúng số thực xuất rồi xác nhận.";return}}
    if(flow){
      lines=[...document.querySelectorAll(".xp-q")].map(i=>({product_id:i.dataset.p,shipped_qty:Math.max(0,Math.floor(+i.value||0))}));
      const diff=lines.filter(x=>{const l=o.lines.find(y=>y.product_id===x.product_id);return l&&l.qty!==x.shipped_qty});
      if(diff.length&&!confirm("Có "+diff.length+" mã xuất khác số đặt. Vẫn xác nhận?"))return}
    const b=$("#xp-ok");b.disabled=true;$("#xp-msg").textContent="Đang ghi…";
    try{
      let msg="Đã ghi xuất kho "+o.order_no;
      if(flow){const r=await svApi("/api/orders/"+o.id+"/flow/ship",{method:"POST",body:JSON.stringify({lines,note:$("#xp-note").value||null,ship_day:day,shipped_by_name:by})});
        msg=r&&r.kho_status==="DA_CHOT_TIEN"?"Đã xuất "+o.order_no+" đúng đơn: tự vào công nợ":"Đã xuất "+o.order_no+" nhưng lệch "+((r.diff||[]).length)+" mã so với đơn, đã báo sale vào xử lý"}
      else await svApi("/api/orders/"+o.id+"/delivery",{method:"POST",body:JSON.stringify({delivery_status:"DA_XUAT_KHO",ship_day:day,shipped_by_name:by})});
      closeDrawer();toast(msg);KHO.at=0;if(typeof khoLoad==="function")khoLoad(true);await xpLoad()}
    catch(e){$("#xp-msg").textContent=e.message;b.disabled=false}}}
PAGES.kho_xuat_b2b=m=>{
  const P=kPer();if(!XP.rows||Date.now()-XP.at>20000||XP.doneKey!==P.from+"|"+P.to)xpLoad();
  khoFrame(m,"kho_xuat_b2b","Xuất B2B: đơn NPP, đại lý","Đơn đã duyệt hiện ở đây để in phiếu xuất kho, xuất hàng và xác nhận. Phải tự chọn ngày xuất và ghi tên người xuất.",xpEdits()+xpPending()+xpShipped());
  xpBind(m)};
