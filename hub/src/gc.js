/* =====================================================================
   Gia công: khách đặt sản xuất theo yêu cầu, dùng BẢNG GIÁ RIÊNG của khách (không có cấp giá).
   Giao diện dựng chung cho Trang quản trị (kèm lãi lỗ) và bên vận hành (không giá vốn, chi phí).
   Khách được tính là gia công khi: chỉ dùng bảng giá riêng và không có cấp giá. Ô đánh dấu "kênh" rõ ràng cho từng khách làm sau.
   ===================================================================== */
const GC={cust:null,orders:null,busy:false,err:"",at:0,st:""};
const gcIs=c=>c&&c.price_mode==="CUSTOM"&&!c.tier_id;
const gcAdmin=()=>typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin";
async function gcLoad(force){
  if(GC.busy||(!force&&GC.cust&&Date.now()-GC.at<20000))return;
  GC.busy=true;
  try{
    const all=await svApi("/api/customers?page_size=200&page=1");
    GC.cust=(all||[]).filter(gcIs);
    const ids=new Set(GC.cust.map(c=>c.id)),o=await svApi("/api/orders?limit=500");
    GC.orders=(o||[]).filter(x=>ids.has(x.customer_id));GC.err="";GC.at=Date.now()}
  catch(e){GC.err=e.message||"Không tải được dữ liệu gia công"}
  GC.busy=false;
  if(/^gc_/.test(PAGE))renderMain();
}
/* Mở trang chi tiết của khách / đơn ngay trong khung (dùng lại trang CRM sẵn có). */
function gcOpen(key,path){if(typeof CRM_SRC!=="undefined")CRM_SRC[key]=path;PAGE=key;MOD="";render();scrollTo(0,0)}
const gcGo=k=>{PAGE=k;MOD="";render();scrollTo(0,0)};
const gcLoading=(m,T,S)=>{m.innerHTML=H(T,S)+(GC.err?`<div class="note red">${esc(GC.err)}</div>`:`<p class="hint pad">Đang tải…</p>`)};
const gcOrderState=o=>o.approval_status==="PENDING_APPROVAL"?["Chờ duyệt","amb"]:o.approval_status==="DRAFT"?["Nháp","gry"]:o.approval_status==="REJECTED"||o.approval_status==="CANCELLED"?["Đã hủy","gry"]:o.delivery_status==="DA_GIAO"?(o.payment_status==="DA_THU_DU"?["Hoàn tất","grn"]:["Đã giao, chờ thu","blu"]):o.delivery_status==="DA_XUAT_KHO"?["Đã xuất kho","blu"]:["Đang chuẩn bị","amb"];
const gcFlow=(n)=>`<section class="card"><div class="card-h"><h2>Luồng gia công</h2><span class="hint">việc đang chờ ở từng bước</span></div><div class="gcflow">${[
  ["1","Nhận yêu cầu & báo giá","Lập bảng giá riêng cho khách",n.price,null],
  ["2","Lập đơn gia công","Đơn dùng bảng giá riêng của khách",n.wait,"đơn chờ duyệt"],
  ["3","Sản xuất","Phiếu sản xuất theo đơn, kho xuất nguyên vật liệu",n.make,"đơn đang chuẩn bị"],
  ["4","Giao hàng","Xuất kho, giao cho khách",n.ship,"đơn đã xuất, chờ giao"],
  ["5","Thu tiền & công nợ","Ghi tiền về, theo dõi công nợ",n.debt,"đơn chưa thu đủ"]].map(([i,t,s,c,u])=>`<div class="gcstep"><b>${i}</b><div><strong>${t}</strong><small>${s}</small>${c==null?"":`<span class="pill p-${c?"amb":"grn"}">${nf(c)} ${u}</span>`}</div></div>`).join("")}</div></section>`;
function gcCounts(){
  const O=GC.orders||[],act=O.filter(o=>o.approval_status==="APPROVED");
  return {wait:O.filter(o=>o.approval_status==="PENDING_APPROVAL").length,
    make:act.filter(o=>o.delivery_status==="CHUA_XUAT").length,
    ship:act.filter(o=>o.delivery_status==="DA_XUAT_KHO").length,
    debt:act.filter(o=>o.delivery_status==="DA_GIAO"&&o.payment_status!=="DA_THU_DU").length,price:null}}
const gcEmpty=()=>`<section class="card"><div class="card-h"><h2>Chưa có khách gia công</h2></div><p class="pad">Khách tự hiện ở đây khi được lập <b>bảng giá riêng</b> và không dùng cấp giá. Cách thêm:</p><ol class="lessons"><li>Tạo khách ở <b>Danh sách khách hàng</b> (nếu chưa có).</li><li>${gcAdmin()?`Vào <b>Gia công › Bảng giá riêng</b>`:"Nhờ quản lý lập bảng giá riêng cho khách ở Trang quản trị"}, chọn khách và nhập giá từng mã.</li><li>Khách chuyển sang chế độ bảng giá riêng và xuất hiện ở các trang Gia công.</li></ol><div class="acts"><button class="btn" data-gcgo="cr_kh">Mở danh sách khách hàng</button>${gcAdmin()?`<button class="btn pri" data-gcgo="cr_giagc">Lập bảng giá riêng</button>`:""}</div></section>`;
const gcBind=m=>m.querySelectorAll("[data-gcgo]").forEach(b=>b.onclick=()=>gcGo(b.dataset.gcgo));

/* ---- Tổng quan gia công ---- */
function pGcTq(m){
  gcLoad();const T="Gia công",S="Khách đặt sản xuất theo yêu cầu · dùng bảng giá riêng của từng khách";
  if(!GC.cust){gcLoading(m,T,S);return}
  const C=GC.cust,n=gcCounts();
  const rev=sum(C,c=>+c.revenue_month||0),debt=sum(C,c=>+c.official_debt||0);
  m.innerHTML=H(T,S)+`<div class="grid kpis">${kpi("Khách gia công",nf(C.length),C.length?"đang dùng bảng giá riêng":"chưa có khách")}${kpi("Doanh thu tháng này",C.length?tr(rev):"—",C.length?"đơn đã duyệt":"")}${kpi("Đơn đang làm",nf(n.wait+n.make+n.ship),n.wait+" chờ duyệt · "+n.make+" chuẩn bị · "+n.ship+" chờ giao")}${kpi("Công nợ chính thức",C.length?tr(debt):"—","kế toán đã xác nhận")}</div>
  ${gcFlow(n)}${C.length?"":gcEmpty()}
  ${gcAdmin()?`<section class="card"><div class="card-h"><h2>Hiệu quả gia công</h2></div><p class="pad">Doanh thu, giá vốn, chi phí phân bổ và lãi của kênh gia công xem ở <button class="lnk" data-gcgo="bc_gc">Tài chính › Doanh thu › Gia công</button>.</p></section>`:""}`;
  gcBind(m);
}
/* ---- Khách gia công ---- */
function pGcKh(m){
  gcLoad();const T="Khách gia công",S="Khách chỉ dùng bảng giá riêng";
  if(!GC.cust){gcLoading(m,T,S);return}
  const C=GC.cust.slice().sort((a,b)=>(+b.revenue_total||0)-(+a.revenue_total||0));
  m.innerHTML=H(T,S+" · "+C.length+" khách")+`<div class="filters"><span class="sp"></span><button class="btn" data-gcgo="cr_kh">Danh sách khách hàng</button>${gcAdmin()?`<button class="btn pri" data-gcgo="cr_giagc">+ Bảng giá riêng cho khách</button>`:""}</div>
  ${C.length?`<section class="card flush">${tbl(["Khách hàng","Phụ trách","Doanh thu tháng này","Tổng doanh thu","Số đơn","Lần đặt gần nhất","Còn nợ"],C.map(c=>`<tr class="clk" data-gck="${c.id}"><td><b>${esc(c.name)}</b>${c.province?`<div class="hint">${esc(c.province)}</div>`:""}</td><td>${esc(c.owner_short||c.owner_name||"—")}</td><td class="n">${tr(+c.revenue_month||0)}</td><td class="n">${tr(+c.revenue_total||0)}</td><td class="n">${nf(c.orders_total||0)}</td><td>${esc(c.last_order_date?kDd(String(c.last_order_date).slice(0,10)):"—")}</td><td class="n">${(+c.official_debt)>0?`<b style="color:#b42318">${tr(+c.official_debt)}</b>`:"—"}</td></tr>`))}</section>`:gcEmpty()}`;
  gcBind(m);m.querySelectorAll("[data-gck]").forEach(r=>r.onclick=()=>gcOpen("cr_kh","/admin/customers/"+r.dataset.gck));
}
/* ---- Đơn gia công ---- */
function pGcDon(m){
  gcLoad();const T="Đơn gia công",S="Đơn của khách gia công";
  if(!GC.cust){gcLoading(m,T,S);return}
  const O=(GC.orders||[]).filter(o=>!GC.st||gcOrderState(o)[0]===GC.st).sort((a,b)=>String(b.order_date).localeCompare(String(a.order_date)));
  const states=[...new Set((GC.orders||[]).map(o=>gcOrderState(o)[0]))];
  m.innerHTML=H(T,S+" · "+(GC.orders||[]).length+" đơn")+`<div class="filters"><select id="gcd-s">${opt([["","Mọi trạng thái"]].concat(states.map(x=>[x,x])),GC.st)}</select><span class="sp"></span><button class="btn pri" data-gcgo="cr_dn">+ Tạo đơn gia công</button></div>
  ${(GC.orders||[]).length?`<section class="card flush">${tbl(["Mã đơn","Khách hàng","Ngày","Tổng phải thu","Còn phải thu","Trạng thái"],O.map(o=>{const st=gcOrderState(o);return `<tr class="clk" data-gco="${o.id}"><td class="mono"><b>${esc(o.order_no)}</b></td><td>${esc(o.customer_name)}</td><td>${esc(kDd(String(o.order_date).slice(0,10)))}</td><td class="n">${nf(+o.total_amount||0)}</td><td class="n">${(+o.remaining_amount)>0?`<b>${nf(+o.remaining_amount)}</b>`:"—"}</td><td>${pill(st[0],st[1])}</td></tr>`}))}</section>`:`<section class="card"><p class="pad">Chưa có đơn gia công nào. Đơn xuất hiện khi khách gia công có đơn trong CRM. Bấm "Tạo đơn gia công" rồi chọn khách gia công.</p></section>`}`;
  gcBind(m);$("#gcd-s").onchange=e=>{GC.st=e.target.value;renderMain()};
  m.querySelectorAll("[data-gco]").forEach(r=>r.onclick=()=>gcOpen("cr_dn","/admin/orders/"+r.dataset.gco));
}
/* ---- Sản xuất gia công (bên vận hành) ---- */
function pGcSx(m){
  gcLoad();const T="Sản xuất gia công",S="Đơn gia công cần chuẩn bị hàng";
  if(!GC.cust){gcLoading(m,T,S);return}
  const O=(GC.orders||[]).filter(o=>o.approval_status==="APPROVED"&&o.delivery_status==="CHUA_XUAT");
  m.innerHTML=H(T,S)+`<div class="note">Đơn gia công đã duyệt nhưng chưa xuất kho nằm ở đây. Sản xuất làm phiếu sản xuất theo đơn ở <button class="lnk" data-gcgo="sx_nc">Sản xuất & kho › Sản xuất</button>, kho ghi nhận thành phẩm rồi xuất cho khách.</div>
  <section class="card flush">${tbl(["Mã đơn","Khách hàng","Ngày đặt","Cần hàng ngày","Tổng đơn"],O.map(o=>`<tr class="clk" data-gco="${o.id}"><td class="mono"><b>${esc(o.order_no)}</b></td><td>${esc(o.customer_name)}</td><td>${esc(kDd(String(o.order_date).slice(0,10)))}</td><td>${o.need_date?esc(kDd(String(o.need_date).slice(0,10))):"—"}</td><td class="n">${nf(+o.total_amount||0)}</td></tr>`))}</section>`;
  gcBind(m);m.querySelectorAll("[data-gco]").forEach(r=>r.onclick=()=>gcOpen("cr_dn","/admin/orders/"+r.dataset.gco));
}
/* ---- Công nợ gia công ---- */
function pGcCn(m){
  gcLoad();const T="Công nợ gia công",S="Công nợ của khách gia công";
  if(!GC.cust){gcLoading(m,T,S);return}
  const C=GC.cust.slice().sort((a,b)=>(+b.official_debt||0)-(+a.official_debt||0)),tot=k=>sum(C,c=>+c[k]||0);
  m.innerHTML=H(T,S)+`<div class="grid kpis">${kpi("Công nợ chính thức",tr(tot("official_debt")),"kế toán đã xác nhận")}${kpi("Công nợ dự kiến",tr(tot("projected_debt")),"gồm đơn chờ thu")}${kpi("Khách còn nợ",nf(C.filter(c=>(+c.official_debt)>0).length),"trên "+C.length+" khách gia công")}</div>
  <section class="card flush">${C.length?tbl(["Khách hàng","Công nợ chính thức","Công nợ dự kiến","Hạn mức nợ","Vượt hạn mức"],C.map(c=>{const over=(+c.debt_limit>0)&&(+c.projected_debt>+c.debt_limit);return `<tr class="clk" data-gck="${c.id}"><td><b>${esc(c.name)}</b></td><td class="n">${nf(+c.official_debt||0)}</td><td class="n">${nf(+c.projected_debt||0)}</td><td class="n">${+c.debt_limit>0?nf(+c.debt_limit):"—"}</td><td>${over?pill("Vượt hạn mức","red"):"—"}</td></tr>`})):`<p class="pad">Chưa có khách gia công.</p>`}</section>
  <div class="acts"><button class="btn" data-gcgo="cr_cn">Công nợ toàn bộ khách hàng</button></div>`;
  gcBind(m);m.querySelectorAll("[data-gck]").forEach(r=>r.onclick=()=>gcOpen("cr_kh","/admin/customers/"+r.dataset.gck));
}
Object.assign(PAGES,{gc_tq:pGcTq,gc_kh:pGcKh,gc_don:pGcDon,gc_sx:pGcSx,gc_cn:pGcCn});

/* ---- Menu bên vận hành: mục Gia công (bán hàng) ---- */
{const i=MODULES.findIndex(m=>m.k==="b2blink");
 MODULES.splice(i>=0?i+1:3,0,{k:"gc",zone:"Bán hàng",ic:"fac",n:"Gia công",sub:"Khách · Đơn · Sản xuất",groups:()=>{
  const a=typeof svAllowedMods==="function"?svAllowedMods():null;if(a&&!a.has("b2blink")&&!a.has("b2b"))return [];
  const ok=()=>typeof SV!=="undefined"&&SV.perms&&SV.perms.includes("price.read");
  return [["",[MI("gc_tq","Tổng quan gia công",ok),MI("gc_kh","Khách gia công",ok),MI("gc_don","Đơn gia công",ok),MI("gc_sx","Sản xuất gia công",ok),MI("gc_cn","Công nợ gia công",ok)]]]}})}
