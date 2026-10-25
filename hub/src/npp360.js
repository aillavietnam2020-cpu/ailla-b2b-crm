/* =====================================================================
   HỒ SƠ NPP / ĐẠI LÝ MỘT TRANG (trang quản trị › Đơn hàng › Hồ sơ NPP).
   Chọn một khách là thấy hết: nợ, hạn mức, tuổi nợ, doanh số theo tháng, đơn gần đây, sổ giao dịch công nợ, chăm sóc, cảnh báo.
   Chỉ đọc, lấy từ CRM (đơn đã duyệt, công nợ kế toán xác nhận). Không ghi gì.
   ===================================================================== */
const N3={q:"",list:null,id:"",d:null,led:null,busy:false,err:""};
async function n3Search(){
  try{N3.list=await svApi("/api/customers?page_size=15&sort=name&q="+encodeURIComponent(N3.q||""))}catch(e){N3.list=[];N3.err=e.message||""}
  if(PAGE==="npp360")renderMain()}
async function n3Open(id){
  N3.id=id;N3.d=null;N3.led=null;N3.err="";renderMain();
  try{const [d,l]=await Promise.all([svApi("/api/customers/"+id),svApi("/api/customers/"+id+"/ledger").catch(()=>[])]);N3.d=d;N3.led=l}catch(e){N3.err=e.message||"Không tải được hồ sơ"}
  if(PAGE==="npp360")renderMain()}
const N3T={CHO_XUAT:"Chờ xuất kho",DA_XUAT_KHO:"Đã xuất kho",DA_GIAO:"Đã giao",CHUA_THU:"Chưa thu",THU_MOT_PHAN:"Thu một phần",DA_THU_DU:"Đã thu đủ",CHUA_XAC_NHAN:"Chờ kế toán",DA_XAC_NHAN:"Đã xác nhận"};
const n3t=v=>N3T[v]||String(v||"—").replace(/_/g," ").toLowerCase();
const n3Days=s=>{if(!s)return null;return Math.round((new Date(mhToday()+"T00:00:00")-new Date(String(s).slice(0,10)+"T00:00:00"))/864e5)};
function pNPP360(m){
  const T="Hồ sơ NPP / đại lý",S="Chọn một khách để xem hết một trang: nợ, hạn mức, doanh số, đơn gần đây, chăm sóc";
  if(typeof ptLoad==="function")ptLoad();
  if(!N3.list&&!N3.busy){N3.busy=true;n3Search().finally(()=>{N3.busy=false})}
  const lst=(N3.list||[]).map(c=>`<button class="n3c${c.id===N3.id?" on":""}" data-n3="${esc(c.id)}"><b>${esc(c.name)}</b><small>${esc([c.tier_name||c.legacy_tier_label||"",c.owner_name||"",c.official_debt>0?"nợ "+nf(Math.round(c.official_debt)):""].filter(Boolean).join(" · "))}</small></button>`).join("");
  let body=`<div class="card pad n3empty"><p class="hint">Gõ tên khách ở ô bên trái, bấm vào một khách để xem hồ sơ.</p></div>`;
  if(N3.id){
    if(N3.err)body=`<div class="note red">${esc(N3.err)}</div>`;
    else if(!N3.d)body=`<p class="hint pad">Đang tải hồ sơ…</p>`;
    else body=n3Body(N3.d,N3.led||[]);
  }
  m.innerHTML=H(T,S)+`<div class="n3w"><aside class="card pad n3l"><input id="n3-q" class="mhq" placeholder="Tìm tên khách, số điện thoại…" value="${esc(N3.q)}"><div class="n3list">${lst||`<p class="hint">${N3.list?"Không thấy khách nào.":"Đang tải…"}</p>`}</div></aside><div class="n3r">${body}</div></div>`;
  const qi=m.querySelector("#n3-q");let t;qi.oninput=()=>{N3.q=qi.value;clearTimeout(t);t=setTimeout(()=>{N3.list=null;n3Search()},300)};
  m.querySelectorAll("[data-n3]").forEach(b=>b.onclick=()=>n3Open(b.dataset.n3));
}
function n3Body(d,led){
  const debt=d.debt||{},limit=+debt.limit||+d.credit_limit||0,off=+debt.official_debt||0,use=limit?off/limit:null;
  const ag=(typeof PT!=="undefined"&&PT.d&&PT.d.rows)?PT.d.rows.find(r=>r.customer_id===d.id):null,late=ag?ag.b90p+ag.old:0;
  const orders=(d.orders||[]).filter(o=>o.approval_status==="APPROVED"),byM={};
  orders.forEach(o=>{const k=String(o.order_date||"").slice(0,7);if(k)byM[k]=(byM[k]||0)+(+o.total_amount||0)});
  const ms=Object.keys(byM).sort().slice(-6),since=n3Days(d.last_order_date),cyc=+d.reorder_cycle_days||0;
  const W=[];
  if(limit&&off>limit)W.push(["red","Nợ vượt hạn mức","Nợ chính thức "+nf(Math.round(off))+" / hạn mức "+nf(Math.round(limit))+". Cân nhắc dừng xuất hàng cho đến khi khách trả bớt."]);
  else if(use!=null&&use>.85)W.push(["amb","Nợ gần chạm hạn mức ("+Math.round(use*100)+"%)","Nhắc khách thanh toán trước khi lên đơn mới."]);
  if(late>0)W.push(["red","Nợ quá 90 ngày: "+nf(Math.round(late))+" đ","Gọi đòi nợ; tiền khách trả sẽ trừ vào đơn cũ nhất trước."]);
  if(cyc&&since!=null&&since>cyc)W.push(["amb","Đã "+since+" ngày chưa mua lại (chu kỳ thường "+cyc+" ngày)","Sale nên gọi chăm sóc, hỏi nhu cầu nhập thêm."]);
  if(d.stage==="LOST"||d.lost_reason)W.push(["blu","Khách đã ngừng mua"+(d.lost_reason?": "+d.lost_reason:""),"Xem có cách kéo lại không."]);
  const acts=(d.activities||[]).slice(0,5),tasks=(d.tasks||[]).filter(t=>t.status!=="DONE"&&t.status!=="DA_XONG").slice(0,5);
  const led10=led.slice(-12).reverse();
  return `<div class="card pad n3h"><div><b class="n3n">${esc(d.name)}</b><div class="hint">${esc([d.tier_name||d.legacy_tier_label||"Chưa có cấp giá",d.province||"",d.phone_text||"",d.contact_person?"liên hệ: "+d.contact_person:""].filter(Boolean).join(" · "))}</div></div><div class="hint">Phụ trách: <b>${esc(d.owner_name||"—")}</b></div></div>
  <div class="grid kpis">${kpi("Nợ chính thức",nf(Math.round(off)),"dự kiến "+nf(Math.round(+debt.projected_debt||0)),off>limit&&limit?"var(--red)":"")}${kpi("Hạn mức nợ",limit?nf(Math.round(limit)):"Chưa đặt",limit?"đã dùng "+Math.round(use*100)+"%":"")}${kpi("Nợ quá 90 ngày",late?nf(Math.round(late)):"0",ag?"đơn cũ nhất "+(ag.oldest_days||0)+" ngày":"không có",late?"var(--red)":"")}${kpi("Doanh số tháng này",nf(Math.round(+d.revenue_month||0)),"đơn đã duyệt")}${kpi("Đơn gần nhất",d.last_order_date?kDd(String(d.last_order_date).slice(0,10)):"—",since!=null?since+" ngày trước":"")}</div>
  <div class="qtwo"><section class="card pad"><b>Cảnh báo và đề xuất</b>${W.length?`<div class="dbl">${W.map(a=>`<div class="dbi ${a[0]}"><b>${esc(a[1])}</b><small>${esc(a[2])}</small></div>`).join("")}</div>`:`<p class="hint">Khách đang ổn: không vượt hạn mức, không nợ quá hạn.</p>`}</section>
  <section class="card pad"><b>Doanh số 6 tháng gần nhất</b>${ms.length?qtCols(ms.map(k=>({l:k.slice(5)+"/"+k.slice(2,4),v:byM[k],t:tr(byM[k]),c:"b"}))):`<p class="hint">Chưa có đơn đã duyệt.</p>`}</section></div>
  <section class="card flush"><div class="card-h pad"><h2>Đơn gần đây</h2></div>${orders.length?tbl(["Số đơn","Ngày","Giá trị","Giao hàng","Thu tiền","Kế toán"],orders.slice(0,10).map(o=>`<tr><td class="mono">${esc(o.order_no)}</td><td>${esc(kDd(String(o.order_date).slice(0,10)))}</td><td class="n"><b>${nf(Math.round(+o.total_amount||0))}</b></td><td>${esc(n3t(o.delivery_status))}</td><td>${esc(n3t(o.payment_status))}</td><td>${esc(n3t(o.accounting_status))}</td></tr>`)):`<p class="hint pad">Chưa có đơn.</p>`}</section>
  <section class="card flush"><div class="card-h pad"><h2>Sổ giao dịch công nợ</h2><span class="hint">12 dòng gần nhất</span></div>${led10.length?tbl(["Ngày","Nội dung","Số tiền","Dư nợ sau","Trạng thái"],led10.map(r=>`<tr><td>${r.date?esc(kDd(String(r.date).slice(0,10))):"đầu kỳ"}</td><td>${esc(({DAU_KY:"Dư nợ đầu kỳ",GHI_NO:"Ghi nợ đơn ",THANH_TOAN:"Thu tiền ",DIEU_CHINH:"Điều chỉnh ",TRA_HANG:"Trả hàng "})[r.kind]||"")}${esc(r.kind==="DAU_KY"?"":r.ref||"")}</td><td class="n ${r.amount<0?"t-grn":""}">${nf(Math.round(r.amount))}</td><td class="n">${nf(Math.round(r.balance))}</td><td>${r.confirmed?"Đã xác nhận":"Chờ kế toán"}</td></tr>`)):`<p class="hint pad">Chưa có giao dịch.</p>`}</section>
  <div class="qtwo"><section class="card pad"><b>Chăm sóc gần đây</b>${acts.length?`<div class="dbl">${acts.map(a=>`<div class="dbi"><b>${esc(a.channel||"")} · ${esc(a.result||"")}</b><small>${esc(kDd(String(a.created_at).slice(0,10)))} · ${esc(a.user_name||"")} · ${esc(String(a.content||"").slice(0,120))}</small></div>`).join("")}</div>`:`<p class="hint">Chưa có ghi chú chăm sóc.</p>`}</section>
  <section class="card pad"><b>Việc đang chờ với khách này</b>${tasks.length?`<div class="dbl">${tasks.map(t=>`<div class="dbi amb"><b>${esc(t.title||t.type||"")}</b><small>hạn ${esc(kDd(String(t.due_at||"").slice(0,10)))}</small></div>`).join("")}</div>`:`<p class="hint">Không có việc nào đang chờ.</p>`}</section></div>`;
}
PAGES.npp360=pNPP360;
