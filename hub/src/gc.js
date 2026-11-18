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
    GC.orders=(o||[]).filter(x=>ids.has(x.customer_id));
    // Công nợ đủ cột như NPP và phiếu phải thu: không có quyền xem thì bỏ qua, trang vẫn chạy.
    const [d,p]=await Promise.all([svApi("/api/debts").catch(()=>null),svApi("/api/customers/receivables/list").catch(()=>null)]);
    GC.debts=d||null;GC.ppt=(p||[]).filter(x=>ids.has(x.customer_id));GC.err="";GC.at=Date.now()}
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
  gcLoad();const T="Kênh OEM",S="Khách đặt sản xuất theo yêu cầu · dùng bảng giá riêng của từng khách";
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
  /* Phiếu phải thu của khách gia công hiện cùng danh sách, ghi rõ loại (chị Hoa 18/11/2026). */
  const PP=(GC.ppt||[]).filter(()=>!GC.st||GC.st==="Phiếu phải thu");
  const states=[...new Set((GC.orders||[]).map(o=>gcOrderState(o)[0]))].concat((GC.ppt||[]).length?["Phiếu phải thu"]:[]);
  m.innerHTML=H(T,S+" · "+(GC.orders||[]).length+" đơn")+`<div class="filters"><select id="gcd-s">${opt([["","Mọi trạng thái"]].concat(states.map(x=>[x,x])),GC.st)}</select><span class="sp"></span>${gcCanDk()?`<button class="btn" id="gcd-ppt">+ Phiếu phải thu</button>`:""}<button class="btn pri" data-gcgo="cr_dn">+ Tạo đơn gia công</button></div>
  ${(GC.orders||[]).length?`<section class="card flush">${tbl(["Mã đơn","Khách hàng","Ngày","Tổng phải thu","Còn phải thu","Trạng thái"],O.map(o=>{const st=gcOrderState(o);return `<tr class="clk" data-gco="${o.id}"><td class="mono"><b>${esc(o.order_no)}</b></td><td>${esc(o.customer_name)}</td><td>${esc(kDd(String(o.order_date).slice(0,10)))}</td><td class="n">${nf(+o.total_amount||0)}</td><td class="n">${(+o.remaining_amount)>0?`<b>${nf(+o.remaining_amount)}</b>`:"—"}</td><td>${pill(st[0],st[1])}</td></tr>`}).concat(PP.map(p=>`<tr class="clk" data-gcp="${p.id}"><td class="mono"><b>${esc(p.voucher_no||"")}</b></td><td>${esc(p.customer_name)}</td><td>${esc(kDd(String(p.charge_date).slice(0,10)))}</td><td class="n">${nf(+p.amount||0)}</td><td class="hint">${esc(p.description)}</td><td>${pill("Phiếu phải thu","vio")}</td></tr>`)))}</section>`:`<section class="card"><p class="pad">Chưa có đơn gia công nào. Đơn xuất hiện khi khách gia công có đơn trong CRM. Bấm "Tạo đơn gia công" rồi chọn khách gia công.</p></section>`}`;
  gcBind(m);$("#gcd-s").onchange=e=>{GC.st=e.target.value;renderMain()};
  m.querySelectorAll("[data-gco]").forEach(r=>r.onclick=()=>gcOpen("cr_dn","/admin/orders/"+r.dataset.gco));
  m.querySelectorAll("[data-gcp]").forEach(r=>r.onclick=()=>gcPptView((GC.ppt||[]).find(p=>p.id===r.dataset.gcp)));
  const np=$("#gcd-ppt");if(np)np.onclick=()=>gcPptNew();
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
  /* Trình bày như Công nợ khách hàng NPP (chị Hoa 18/11/2026). Đã ghi nợ = đơn đã xuất kho đã chốt + phiếu phải thu. */
  const D=new Map((GC.debts||[]).map(d=>[d.customer_id,d])),g=(c,k)=>+((D.get(c.id)||{})[k]??c[k]??0)||0;
  const C=GC.cust.slice().sort((a,b)=>g(b,"official_debt")-g(a,"official_debt")),tot=k=>sum(C,c=>g(c,k));
  const can=gcCanDk();
  m.innerHTML=H(T,S)+`<div class="grid kpis">${kpi("Phải thu Kênh OEM",tr(sum(C,c=>Math.max(0,g(c,"official_debt")))),"công nợ chính thức của khách còn nợ"+(C.some(c=>g(c,"official_debt")<0)?" · khách trả thừa "+tr(sum(C,c=>Math.max(0,-g(c,"official_debt"))))+" để riêng":"")+" · cùng số Phải thu, Đối chiếu công nợ")}${kpi("Công nợ dự kiến",tr(tot("projected_debt")),"gồm đơn chờ thu")}${kpi("Khách còn nợ",nf(C.filter(c=>g(c,"official_debt")>0).length),"trên "+C.length+" khách gia công")}</div>
  ${can?`<div class="filters"><span class="sp"></span><button class="btn" id="gc-dk">Nhập nợ đầu kỳ</button><button class="btn pri" id="gc-ppt">+ Phiếu phải thu</button></div>`:""}
  <section class="card flush">${C.length?tbl(["Khách hàng","Dư nợ đầu kỳ","Đã ghi nợ","Đã thanh toán","Chính thức","Chờ ghi nợ","Chờ tiền về","Dự kiến","Hạn mức"],C.map(c=>{const over=(+c.debt_limit>0)&&(g(c,"projected_debt")>+c.debt_limit);return `<tr class="clk" data-gck="${c.id}"><td><b>${esc(c.name)}</b></td><td class="n">${nf(g(c,"opening_debt"))}</td><td class="n">${nf(g(c,"posted_charges"))}</td><td class="n">${nf(g(c,"confirmed_payments"))}</td><td class="n"><b>${nf(g(c,"official_debt"))}</b></td><td class="n">${nf(g(c,"pending_charges"))}</td><td class="n">${nf(g(c,"pending_cash"))}</td><td class="n">${nf(g(c,"projected_debt"))}${over?" "+pill("Vượt hạn mức","red"):""}</td><td class="n">${+c.debt_limit>0?nf(+c.debt_limit):"—"}</td></tr>`})):`<p class="pad">Chưa có khách gia công.</p>`}</section>
  <p class="hint">Đã ghi nợ gồm đơn đã xuất kho đã chốt tiền và phiếu phải thu (tiền VAT khách lấy hóa đơn...). Phiếu phải thu xem ở <button class="lnk" data-gcgo="gc_don">Đơn gia công</button>.</p>
  <div class="acts"><button class="btn" data-gcgo="cr_cn">Công nợ toàn bộ khách hàng</button></div>`;
  gcBind(m);m.querySelectorAll("[data-gck]").forEach(r=>r.onclick=()=>gcOpen("cr_kh","/admin/customers/"+r.dataset.gck));
  const a=$("#gc-dk");if(a)a.onclick=()=>gcDk();const b=$("#gc-ppt");if(b)b.onclick=()=>gcPptNew();
}
const gcCanDk=()=>typeof SV!=="undefined"&&SV.perms&&SV.perms.includes("order.accounting.confirm");
const gcCustOpt=sel=>`<option value="">Chọn khách gia công</option>`+GC.cust.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<option value="${c.id}"${c.id===sel?" selected":""}>${esc(c.name)}</option>`).join("");
const gcReload=async()=>{closeDrawer();GC.at=0;await gcLoad(true);renderMain()};
/* Nợ đầu kỳ (chị Hoa 18/11/2026): kế toán / CEO nhập số dư nợ đầu kỳ theo sổ MISA, có ghi chú nguồn số. */
function gcDk(){
  const D=new Map((GC.debts||[]).map(d=>[d.customer_id,d]));
  openDrawerHTML(`<h2>Nhập nợ đầu kỳ</h2><p class="hint">Số dư khách còn nợ trước đơn đầu tiên trên web (lấy theo sổ công nợ MISA). Khách trả thừa thì ghi số âm.</p>
   <div class="filters"><label class="inl">Khách <select id="gcdk-c">${gcCustOpt("")}</select></label><label class="inl">Nợ đầu kỳ (đ) <input id="gcdk-a" type="number" step="1" style="width:170px"></label></div>
   <div class="filters"><label class="inl" style="width:100%">Số này lấy từ đâu, tính đến ngày nào <input id="gcdk-n" placeholder="Ví dụ: Số dư đầu kỳ MISA tháng 10/2026" style="width:100%"></label></div>
   <div class="acts"><button class="btn pri" id="gcdk-ok">Lưu</button></div>`);
  $("#gcdk-c").onchange=e=>{const d=D.get(e.target.value);$("#gcdk-a").value=d?d.opening_debt:0};
  $("#gcdk-ok").onclick=async()=>{const id=$("#gcdk-c").value,a=Math.round(+$("#gcdk-a").value||0),n=$("#gcdk-n").value.trim();if(!id){toast("Chọn khách");return}if(n.length<5){toast("Ghi rõ số này lấy từ đâu");return}
    try{await svApi("/api/customers/"+id+"/opening-debt",{method:"PUT",body:JSON.stringify({amount:a,note:n})});toast("Đã lưu nợ đầu kỳ "+nf(a)+"đ");await gcReload()}catch(e){toast(e.message)}}}
/* Phiếu phải thu (chị Hoa 18/11/2026): kế toán tạo phiếu phải thu riêng của khách cho khoản ngoài tiền hàng (VAT khách lấy hóa đơn...),
   ghi rõ khoản gì; web đánh số PPT<yymm>-<stt>, cộng vào công nợ, không tính doanh thu bán hàng. */
function gcPptNew(){const today=new Date(Date.now()+7*36e5).toISOString().slice(0,10);
  openDrawerHTML(`<h2>Phiếu phải thu</h2><p class="hint">Khoản khách phải trả ngoài tiền hàng, ví dụ tiền thuế VAT khi khách lấy hóa đơn. Cộng vào công nợ của khách, không tính vào doanh thu bán hàng. Số phiếu web tự đánh.</p>
   <div class="filters"><label class="inl">Khách <select id="ppt-c">${gcCustOpt("")}</select></label><label class="inl">Ngày <input id="ppt-d" type="date" max="${today}" value="${today}"></label></div>
   <div class="filters"><label class="inl">Số tiền (đ) <input id="ppt-a" type="number" step="1" style="width:170px"></label><label class="inl">Số chứng từ MISA <input id="ppt-no" placeholder="VD: NVK1728" style="width:150px"></label></div>
   <div class="filters"><label class="inl" style="width:100%">Khoản gì <input id="ppt-t" placeholder="VD: Tiền thuế VAT hóa đơn số 94 ngày 18/10/2026" style="width:100%"></label></div>
   <div class="acts"><button class="btn pri" id="ppt-ok">Tạo phiếu và ghi vào công nợ</button></div>`);
  $("#ppt-ok").onclick=async()=>{const id=$("#ppt-c").value,a=Math.round(+$("#ppt-a").value||0),t=$("#ppt-t").value.trim();if(!id){toast("Chọn khách");return}if(!a){toast("Nhập số tiền");return}if(t.length<5){toast("Ghi rõ đây là khoản gì");return}
    try{const r=await svApi("/api/customers/"+id+"/other-charges",{method:"POST",body:JSON.stringify({charge_date:$("#ppt-d").value,amount:a,description:t,doc_no:$("#ppt-no").value.trim()})});toast("Đã tạo phiếu "+(r&&r.voucher_no||"")+", ghi "+nf(a)+"đ vào công nợ");await gcReload()}catch(e){toast(e.message)}}}
function gcPptView(p){if(!p)return;const can=gcCanDk();
  openDrawerHTML(`<h2>Phiếu phải thu ${esc(p.voucher_no||"")}</h2>
   <table class="tbl"><tbody><tr><td>Khách hàng</td><td><b>${esc(p.customer_name)}</b></td></tr><tr><td>Ngày</td><td>${esc(kDd(p.charge_date))}</td></tr><tr><td>Khoản gì</td><td>${esc(p.description)}</td></tr><tr><td>Số chứng từ MISA</td><td>${esc(p.doc_no||"—")}</td></tr><tr><td>Số tiền</td><td><b>${nf(+p.amount||0)}</b> đ</td></tr></tbody></table>
   <p class="hint">Đã cộng vào công nợ của khách. Không tính vào doanh thu bán hàng.</p>
   ${can?`<div class="acts"><button class="btn" id="ppt-del">Xóa phiếu</button></div>`:""}`);
  const d=$("#ppt-del");if(d)d.onclick=async()=>{const r=prompt("Lý do xóa phiếu "+(p.voucher_no||"")+"?");if(!r||r.trim().length<5){toast("Cần ghi lý do (từ 5 ký tự)");return}
    try{await svApi("/api/customers/"+p.customer_id+"/other-charges/"+p.id+"/delete",{method:"POST",body:JSON.stringify({reason:r.trim()})});toast("Đã xóa phiếu");await gcReload()}catch(e){toast(e.message)}}}
Object.assign(PAGES,{gc_tq:pGcTq,gc_kh:pGcKh,gc_don:pGcDon,gc_sx:pGcSx,gc_cn:pGcCn});

/* ---- Menu bên vận hành: mục Gia công (bán hàng) ---- */
{const i=MODULES.findIndex(m=>m.k==="b2blink");
 MODULES.splice(i>=0?i+1:3,0,{k:"gc",zone:"Bán hàng",ic:"fac",n:"Kênh OEM",sub:"Khách · Đơn · Sản xuất",groups:()=>{
  const a=typeof svAllowedMods==="function"?svAllowedMods():null;if(a&&!a.has("b2blink")&&!a.has("b2b"))return [];
  const ok=()=>typeof SV!=="undefined"&&SV.perms&&SV.perms.includes("price.read");
  return [["",[MI("gc_tq","Tổng quan gia công",ok),MI("gc_kh","Khách gia công",ok),MI("gc_don","Đơn gia công",ok),MI("gc_sx","Sản xuất gia công",ok),MI("gc_cn","Công nợ gia công",ok)]]]}})}
