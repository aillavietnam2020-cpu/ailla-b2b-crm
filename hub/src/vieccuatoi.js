/* =====================================================================
   VIỆC CỦA TÔI (đầu mục Task giao việc)
   Việc tự tìm đến từng người theo QUYỀN của họ, gom cả B2B, B2C, kho, kế toán, kèm việc đã tồn nhiều ngày.
   Số liệu tính thẳng từ dữ liệu thật (máy chủ /api/work/mine): làm xong là tự mất, không phải ai nhập tay.
   ===================================================================== */
const WK={items:null,at:0,busy:false,err:""};
async function wkLoad(force){
  if(WK.busy||typeof ME==="undefined"||!ME)return;
  if(!force&&WK.at&&Date.now()-WK.at<30000)return;
  WK.busy=true;
  try{
    const before=WK.items?wkCount():null;
    WK.items=await svApi("/api/work/mine");WK.err="";WK.at=Date.now();
    if(before!==null&&wkCount()!==before&&!/^cv_v$/.test(PAGE)){const ae=document.activeElement,typing=ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);if(!typing&&!document.querySelector(".modal,.mdl,[role=dialog],#drawer:not([hidden])"))try{render()}catch(x){}}}
  catch(e){WK.err=e.message||"Không tải được"}
  WK.busy=false;
  if(PAGE==="cv_v"&&CVV.view==="list"&&CVV.scope==="mine")renderMain();
}
/* Chị (CEO): việc của kế toán, kho đã có người phụ trách, xem ở "Toàn cảnh". Ở đây chỉ việc chính chị phải quyết hoặc làm. */
const wkCeo=()=>!!ME&&ME.role==="admin";
const wkMine=()=>{const srv=(WK.items||[]).filter(x=>!(wkCeo()&&["Kế toán","Kho"].includes(x.group)));const my=typeof cvMyItems==="function"?cvMyItems():[];const order=["Đến lượt tôi làm","Cần tôi duyệt","Tôi cần giao, đốc","Đang chờ người trước"];return my.sort((a,b)=>order.indexOf(a.group)-order.indexOf(b.group)||b.age_days-a.age_days).concat(srv)};
const wkCount=()=>wkMine().reduce((n,x)=>n+x.count,0);
function wkPage(k){
  const emp=typeof crmRole==="function"&&crmRole()==="EMPLOYEE";
  return {bill:emp?"cr_s_bill":"cr_bill",don:emp?"cr_s_dn":"cr_dn",ret:emp?"cr_s_ret":"cr_ret",xuat:"kho_xuat_b2b",hn:emp?"cr_s_hn":"cr_kh"}[k]||"cr_dn";
}
const wkDd=s=>s?String(s).slice(8,10)+"/"+String(s).slice(5,7):"";
PAGES.cv_vt=m=>{CVV.view="list";CVV.scope="mine";cvWhoSet("mine");PAGE="cv_v";pCvV(m)};
/* Phần "Của tôi" trong trang Việc: chia nhóm theo mức gấp (chờ duyệt, quá hạn, hôm nay, tuần này, sau này), việc kế toán, kho... theo quyền */
const WKO={};
const WK_FIRST=["Chờ tôi duyệt","Quá hạn","Hôm nay","Tuần này","Sau này","Đang chờ người trước"];
function wkSec(x){
  const td=D().settings.today,W=WEEKS.find(w=>td>=w.tu&&td<=w.den)||WEEKS[0],g=x.group;
  if(g==="Cần tôi duyệt"||g==="Duyệt")return "Chờ tôi duyệt";
  if(g==="Đang chờ người trước")return g;
  if(g==="Tôi cần giao, đốc")return "Quá hạn";
  if(g==="Đến lượt tôi làm"){const h=x.han;return h&&h<td?"Quá hạn":h===td?"Hôm nay":(h&&h<=W.den)?"Tuần này":"Sau này"}
  return g;
}
function wkBodyHtml(){
  const items=wkMine(),tone=a=>a>=3?"red":a>=1?"amb":"gry",secs={};
  items.forEach(x=>{(secs[wkSec(x)]=secs[wkSec(x)]||[]).push(x)});
  const keys=WK_FIRST.filter(k=>secs[k]).concat(Object.keys(secs).filter(k=>!WK_FIRST.includes(k)));
  const row=x=>`<div class="sxal"><span style="flex:1;min-width:0"><b>${esc(x.title)}</b>${x.chip?` <span class="pill p-gry">${esc(x.chip)}</span>`:""}${x.count>1?` <span class="pill p-${tone(x.age_days)}">${x.count} việc</span>`:""}${x.han!==undefined&&x.age_days>0?` <span class="pill p-red">trễ ${x.age_days} ngày</span>`:""}${x.amount?` <span class="pill p-gry">${nf(x.amount)} đ</span>`:""}<br><small>${esc(x.detail)}${x.oldest?` · cũ nhất ${wkDd(x.oldest)}${x.age_days>0?`, tồn <b>${x.age_days} ngày</b>`:" (hôm nay)"}`:""}</small></span>${x.key==="pay_unallocated"?`<button class="btn sm pri" data-wkbulk="1" title="Chỉ xem trước, chưa ghi gì">Xem trước</button>`:""}${x.key==="pay_confirm"||x.key==="order_confirm"?`<button class="btn sm pri" data-wkq="${x.key}" title="Xem từng khoản, bấm xác nhận ngay tại đây">Xem và xác nhận</button>`:""}${x.act&&x.cdId?`<button class="btn sm pri" data-wkcd="${x.taskId}|${x.cdId}">Xong</button>`:""}${x.taskId?`<button class="btn sm" data-wktask="${x.taskId}">Mở</button>`:`<button class="btn sm${x.age_days>=2?" pri":""}" data-wkgo="${x.go||wkPage(x.page)}"${x.st!==undefined?` data-wkst="${x.st}"`:""}${x.who?` data-wkwho="${x.who}"`:""}${x.mod?` data-wkmod="${x.mod}"`:""}>Mở</button>`}</div>`;
  return keys.map(k=>{const L=secs[k],n=L.reduce((z,x)=>z+x.count,0),open=(k in WKO)?WKO[k]:!["Tuần này","Sau này","Đang chờ người trước"].includes(k);
    return `<details class="cvgrp wksec" data-sk="${esc(k)}"${open?" open":""}><summary><b>${esc(k)}</b><span class="cvgc">${n}</span></summary><div class="sxalerts">${L.map(row).join("")}</div></details>`}).join("");
}
function wkBind(m){
  m.querySelectorAll("details.wksec").forEach(g=>g.addEventListener("toggle",()=>{WKO[g.dataset.sk]=g.open}));
  m.querySelectorAll("[data-wkbulk]").forEach(b=>b.onclick=()=>wkPreview());
  m.querySelectorAll("[data-wkq]").forEach(b=>b.onclick=()=>wkQueue(b.dataset.wkq));
  m.querySelectorAll("[data-wktask]").forEach(b=>b.onclick=()=>openTask(b.dataset.wktask));
  m.querySelectorAll("[data-wkcd]").forEach(b=>b.onclick=()=>{const p=b.dataset.wkcd.split("|");tkCdAct(p[0],p[1],"xong");toast("Đã xong công đoạn");renderMain()});
  m.querySelectorAll("[data-wkgo]").forEach(b=>b.onclick=()=>{if(b.dataset.wkst!==undefined)CVF.st=b.dataset.wkst;if(b.dataset.wkwho)cvWhoSet(b.dataset.wkwho);if(b.dataset.wkmod)MOD=b.dataset.wkmod;PAGE=b.dataset.wkgo;renderMain();scrollTo(0,0)});
}
function wkEmbed(m){
  if(!WK.at||typeof _rLast=="undefined"||_rLast!==PAGE)wkLoad(true);
  const body=WK.items?wkBodyHtml():"";
  m.innerHTML=(WK.err?`<div class="note red">${esc(WK.err)}</div>`:"")+(!WK.items?`<p class="hint pad">Đang tải…</p>`:body||`<section class="card"><p class="empty pad">Hiện không có việc nào đang chờ ${wkCeo()?"chị":"bạn"}. Cảm ơn!</p></section>`);
  wkBind(m);
}
/* Xem từng khoản chờ kế toán xác nhận, bấm xác nhận từng dòng hoặc cả danh sách (kế toán tự đối chiếu bill rồi mới bấm) */
/* Mỗi khoản tiền hiện ảnh bill (bấm xem lớn) + giờ nhập, người nhập, mã giao dịch, đơn đã gắn: để phân biệt các khoản cùng ngày cùng số tiền */
function wkPayInfo(r){
  const t=r.entered_at?String(r.entered_at).replace("T"," ").slice(11,16)+" "+wkDd(r.entered_at):"";
  const img=r.bill_id?`<a href="/api/bills/${esc(r.bill_id)}/file" target="_blank" rel="noopener" title="Bấm xem bill lớn"><img src="/api/bills/${esc(r.bill_id)}/file" alt="bill" style="width:72px;height:72px;object-fit:cover;border-radius:6px;border:1px solid #ddd;float:left;margin-right:8px"></a>`:`<span class="hint" style="float:left;margin-right:8px;width:72px">Chưa có ảnh bill</span>`;
  const l=[r.note?esc(r.note):"",r.bank_ref?"Mã GD: <b>"+esc(r.bank_ref)+"</b>":"",r.receipt_no?"Phiếu: "+esc(r.receipt_no):"",r.bill_order_no?"Bill gắn đơn: <b>"+esc(r.bill_order_no)+"</b>":"",r.method?esc(r.method):"",t?"Nhập lúc "+t+(r.entered_by?" bởi "+esc(r.entered_by):""):""].filter(Boolean);
  return `<div style="overflow:hidden;min-width:200px">${img}<small>${l.join("<br>")}</small></div>`;
}
async function wkQueue(key){
  const pay=key==="pay_confirm";
  let rows;
  try{rows=await svApi("/api/work/queue/"+key)}catch(e){toast(e.message||"Chưa tải được danh sách");return}
  const url=id=>pay?`/api/payments/${id}/confirm`:`/api/orders/${id}/accounting`;
  const body=pay?JSON.stringify({confirmed:true}):JSON.stringify({accounting_status:"DA_XAC_NHAN"});
  const fd=d=>d?String(d).slice(8,10)+"/"+String(d).slice(5,7)+"/"+String(d).slice(0,4):"";
  const tr=r=>`<tr data-id="${esc(r.id)}"><td>${esc(r.customer_name)}</td><td>${fd(r.day)}${r.swap?`<br><small class="red">Có thể là ${fd(r.swap)}?</small>`:""}</td><td>${pay?wkPayInfo(r):esc(r.note||"")}</td><td class="n">${nf(r.amount)}</td><td style="white-space:nowrap"><button class="btn sm pri" data-wkok="${esc(r.id)}">Xác nhận</button>${pay?` <button class="btn sm" data-wkdate="${esc(r.id)}" data-day="${esc(r.day||"")}" data-swap="${esc(r.swap||"")}">Sửa ngày</button> <button class="btn sm" data-wkdel="${esc(r.id)}">Xóa</button>`:""}</td></tr>`;
  openDrawerHTML(`<h2>${pay?"Xác nhận tiền khách đã chuyển":"Xác nhận ghi nợ đơn đã xuất kho"}</h2><p class="hint">${pay?"Đối chiếu bill rồi bấm Xác nhận để khoản tiền được trừ công nợ.":"Bấm Xác nhận để đơn vào công nợ chính thức."} Hiện ${rows.length} khoản${rows.length>=200?" (đang hiện 200 khoản đầu)":""}.</p>
   ${rows.length?`<div class="tbl"><table><thead><tr><th>Khách</th><th>Ngày</th><th>${pay?"Bill và chi tiết":"Mã đơn"}</th><th class="n">Số tiền</th><th></th></tr></thead><tbody>${rows.map(tr).join("")}</tbody></table></div><div class="acts"><button class="btn" id="wq-all">Đã kiểm hết, xác nhận cả ${rows.length} khoản</button></div>`:`<p class="empty">Không còn khoản nào.</p>`}`);
  const one=async(id)=>{await svApi(url(id),{method:"POST",body});const t=document.querySelector(`tr[data-id="${id}"]`);if(t)t.remove()};
  document.querySelectorAll("[data-wkok]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{await one(b.dataset.wkok);toast("Đã xác nhận");wkLoad(true)}catch(e){toast(e.message||"Chưa xác nhận được");b.disabled=false}});
  document.querySelectorAll("[data-wkdate]").forEach(b=>b.onclick=async()=>{
    const cur=fd(b.dataset.swap||b.dataset.day);const v=prompt("Ngày tiền về đúng là ngày nào? (ngày/tháng/năm)",cur);if(!v)return;
    const m=/^\s*(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\s*$/.exec(v);if(!m){toast("Gõ ngày dạng 05/10/2026");return}
    const iso=m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0");
    const why=prompt("Lý do sửa ngày?","Nhập nhầm ngày/tháng");if(!why)return;
    try{await svApi(`/api/payments/${b.dataset.wkdate}/fix-date`,{method:"POST",body:JSON.stringify({paid_at:iso,reason:why})});toast("Đã sửa ngày");wkQueue(key);wkLoad(true)}catch(e){toast(e.message||"Chưa sửa được")}});
  document.querySelectorAll("[data-wkdel]").forEach(b=>b.onclick=async()=>{
    const why=prompt("Xóa khoản tiền ghi nhầm này. Lý do xóa?");if(!why)return;
    if(!confirm("Xóa khoản này? Hệ thống giữ lại bản ghi cũ trong nhật ký."))return;
    try{await svApi(`/api/payments/${b.dataset.wkdel}/void`,{method:"POST",body:JSON.stringify({reason:why})});toast("Đã xóa khoản");wkQueue(key);wkLoad(true)}catch(e){toast(e.message||"Chưa xóa được")}});
  const all=document.getElementById("wq-all");
  if(all)all.onclick=async()=>{if(!confirm("Xác nhận "+rows.length+" khoản này? Chị đã đối chiếu bill/đơn rồi chứ?"))return;all.disabled=true;let ok=0,bad=0,last="";
    for(const r of rows){try{await one(r.id);ok++}catch(e){bad++;last=e.message||""}}
    toast("Đã xác nhận "+ok+" khoản"+(bad?", "+bad+" khoản chưa được: "+last:""));wkLoad(true);if(!bad)closeDrawer();else all.disabled=false};
}
/* Xem trước việc chia tiền: không ghi gì; chị Thảo/chị Huệ xem rồi mới bấm làm thật */
async function wkPreview(){
  let pv;
  try{pv=await svApi("/api/payments/auto-allocate-preview")}catch(e){toast(e.message||"Chưa xem trước được");return}
  const A=pv.with_orders,B=pv.leftover_only;
  const tbl=(rows,cols)=>rows.length?`<div class="tbl"><table><thead><tr><th>Khách</th>${cols.map(c=>`<th class="n">${c[0]}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.customer_name)}</td>${cols.map(c=>`<td class="n">${c[1](r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`:"";
  openDrawerHTML(`<h2>Xem trước chia tiền</h2><p class="hint">Chưa ghi gì. Đây là cách hệ thống sẽ xử lý nếu bấm làm thật.${pv.named_n?` Có <b>${pv.named_n}</b> khoản đã nêu rõ đơn (bill gắn đơn hoặc ghi mã đơn): trừ đúng đơn đó trước, phần dư mới chia theo đơn cũ nhất.`:""}</p>
   <section class="card pad"><h3>1. Còn đơn thiếu tiền: ${A.n} khoản</h3>${A.n?`<p>Chia vào đơn <b>${nf(A.to_orders)} đ</b>. Phần còn thừa: trừ nợ cũ <b>${nf(A.to_old_debt)} đ</b>, thành số dư có <b>${nf(A.to_credit)} đ</b>.</p>${tbl(A.customers,[["Vào đơn",r=>nf(r.to_orders)],["Trừ nợ cũ",r=>nf(r.to_old_debt)],["Thành số dư có",r=>nf(r.to_credit)],["Số dư có hiện tại",r=>nf(r.credit_now)]])}<div class="acts"><button class="btn pri" id="pv-go">Chia ${A.n} khoản vào đơn</button></div>`:`<p class="hint">Không có khoản nào cần chia vào đơn.</p>`}</section>
   <section class="card pad"><h3>2. Khách không còn đơn nào thiếu: ${B.n} khoản</h3>${B.n?`<p>Tổng <b>${nf(B.amount)} đ</b>, chỉ còn tiền thừa (thường đã tính vào nợ cũ hoặc số dư có từ lúc ghi). Bấm bên dưới là <b>giữ nguyên số tiền</b>, chỉ bỏ khỏi danh sách việc, không đổi đơn nào, không đổi số dư có.</p>${tbl(B.customers,[["Số tiền",r=>nf(r.to_old_debt)],["Số dư có hiện tại",r=>nf(r.credit_now)]])}<div class="acts"><button class="btn" id="pv-keep">Đã kiểm, bỏ ${B.n} khoản khỏi danh sách</button></div>`:`<p class="hint">Không có khoản nào.</p>`}</section>`);
  const go=document.getElementById("pv-go"),keep=document.getElementById("pv-keep");
  if(keep)keep.onclick=async()=>{if(!confirm("Giữ nguyên số tiền của "+B.n+" khoản, chỉ bỏ khỏi danh sách việc. Làm luôn?"))return;keep.disabled=true;
    try{const r=await svApi("/api/payments/leftover-reviewed",{method:"POST",body:"{}"});toast("Đã bỏ "+r.marked+" khoản khỏi danh sách");closeDrawer();wkLoad(true)}catch(e){toast(e.message||"Chưa làm được");keep.disabled=false}};
  if(go)go.onclick=async()=>{
    if(!confirm("Chia "+A.n+" khoản vào đơn: "+nf(A.to_orders)+" đ vào đơn, "+nf(A.to_credit)+" đ thành số dư có của khách. Việc này đổi trạng thái thu tiền của nhiều đơn. Làm luôn?"))return;
    go.disabled=true;let done=0,alloc=0,credit=0,guard=0;
    try{for(;;){const r=await svApi("/api/payments/auto-allocate-all",{method:"POST",body:"{}"});done+=r.processed;alloc+=r.allocated;credit+=r.to_credit;toast("Đã chia "+done+" khoản, còn "+r.remaining+"…");if(!r.remaining||!r.processed||++guard>20)break}
      toast("Xong: chia "+done+" khoản, "+nf(alloc)+" đ vào đơn"+(credit?", "+nf(credit)+" đ giữ làm số dư có của khách":""));closeDrawer()}
    catch(e){toast(e.message||"Chưa chia được");go.disabled=false}
    wkLoad(true)};
}

{
  setInterval(()=>{try{if(ME&&document.visibilityState==="visible")wkLoad(true)}catch(e){}},120000);
  setTimeout(()=>{try{if(ME)wkLoad(true)}catch(e){}},3500);
}
