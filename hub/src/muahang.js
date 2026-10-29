/* =====================================================================
   Mua hàng nguyên vật liệu.
   Bên vận hành (không có giá): Thảo lập phiếu mua, kho báo thực nhận từng lần giao (tự sinh phiếu nhập kho).
   Trang quản trị: nhập giá lúc giao, hóa đơn (VAT, vận chuyển, bốc vác), phiếu chi, công nợ nhà cung cấp (có đầu kỳ),
   giá nguyên vật liệu từng tháng (bình quân gia quyền, có tồn đầu).
   ===================================================================== */
const MH={orders:null,sup:null,busy:false,err:"",at:0,view:"open",debts:null,inv:null,pay:null,prices:null,pmonth:"",onlyNoPrice:true};
const MH_ST={DAT:["Đã đặt","amb"],DANG_GIAO:["Đang giao","blu"],DU:["Đủ hàng","grn"],HUY:["Đã hủy","gry"]};
const mhPerm=n=>typeof SV!=="undefined"&&SV.perms&&SV.perms.includes(n);
const mhManage=()=>!!ME&&(ME.role==="admin"||mhPerm("order.approve.normal")||mhPerm("order.accounting.confirm"));
const mhReceive=()=>mhManage()||mhPerm("sx.kiemke")||mhPerm("order.kho.process");
const mhToday=()=>{const t=new Date(),p=n=>String(n).padStart(2,"0");return t.getFullYear()+"-"+p(t.getMonth()+1)+"-"+p(t.getDate())};
const mhN=n=>nf(Math.round(n*1000)/1000);
const mhName=c=>((typeof KHO!=="undefined"&&KHO.items&&KHO.items.get(c))||{}).name||c;

async function mhLoad(force){
  if(MH.busy||(!force&&MH.orders&&Date.now()-MH.at<15000))return;
  MH.busy=true;
  try{
    if(typeof khoLoad==="function")await khoLoad();
    const [o,s]=await Promise.all([kApi("/mh/orders"),kApi("/mh/suppliers")]);
    MH.orders=o;MH.sup=s;MH.err="";MH.at=Date.now()}
  catch(e){MH.err=e.message||"Không tải được phiếu mua hàng"}
  MH.busy=false;
  if(/^mh_|^sx_mh$|^exec$|^(so_cp|ngan_sach|tien_lich)$/.test(PAGE))renderMain();
}
/* Sau khi hủy / sửa / ghi: xóa số cũ, chờ lần tải đang chạy xong (nếu có), tải lại rồi VẼ LẠI ngay, để công nợ hiện đúng số mới (trước đây gặp lần tải đang chạy thì bỏ qua, màn hình giữ số cũ). */
const mhReload=async()=>{MH.at=0;MH.debts=MH.inv=MH.pay=MH.prices=null;for(let i=0;i<50&&MH.busy;i++)await new Promise(r=>setTimeout(r,100));await mhLoad(true);if(/^mh_|^sx_mh$/.test(PAGE))renderMain()};
const mhSupOpts=(sel)=>opt([["","— Chọn nhà cung cấp —"]].concat((MH.sup||[]).filter(s=>s.active).map(s=>[s.id,s.name])),sel||"");

/* Ô chọn nhà cung cấp gõ tìm được (chị Hoa 28/10): gõ một phần tên là lọc danh sách, chỉ còn một thì tự chọn;
   chưa có thì bấm "＋ Thêm … làm nhà cung cấp mới" để tạo ngay, không rời form. Danh sách chưa tải xong thì chờ tải. */
async function mhSupPick(sel){
  const s=$(sel);if(!s||s.dataset.pick)return;s.dataset.pick="1";
  const w=document.createElement("div");w.className="mhpick";w.style.cssText="display:flex;flex-direction:column;gap:4px;margin-bottom:4px";
  w.innerHTML=`<input type="search" placeholder="Gõ tên nhà cung cấp để tìm…" autocomplete="off"><div hidden></div>`;
  s.parentNode.insertBefore(w,s);
  const q=w.querySelector("input"),add=w.querySelector("div"),pick=id=>{s.value=id;s.dispatchEvent(new Event("change"))};
  const fill=()=>{const v=s.value,t=q.value.trim(),k=kfold(t),L=(MH.sup||[]).filter(x=>x.active&&(!k||kfold(x.name).includes(k)));
    s.innerHTML=opt([["",!MH.sup?"Đang tải danh sách nhà cung cấp…":L.length?"— Chọn nhà cung cấp —":"— Chưa có, bấm Thêm ở trên —"]].concat(L.map(x=>[x.id,x.name])),v);
    if(k&&L.length===1&&s.value!==L[0].id)pick(L[0].id);
    add.hidden=!k||!MH.sup||(MH.sup||[]).some(x=>kfold(x.name)===k);
    add.innerHTML=`<button type="button" class="btn sm">＋ Thêm “${esc(t)}” làm nhà cung cấp mới</button>`;
    add.querySelector("button").onclick=async e=>{const b=e.currentTarget;b.disabled=true;
      try{const r=await kApi("/mh/suppliers",{method:"POST",body:JSON.stringify({name:t})});toast("Đã thêm nhà cung cấp "+t);await mhReload();q.value="";fill();pick(r.id)}
      catch(err){toast(err.message||"Chưa thêm được");b.disabled=false}}};
  q.oninput=fill;fill();
  for(let i=0;i<80&&!MH.sup;i++){if(!MH.busy)await mhLoad(true);await new Promise(r=>setTimeout(r,150))}
  fill()}
/* ---------- Thêm nhà cung cấp (dùng chung) ---------- */
function mhNewSupplier(done,opt){
  opt=opt||{};const withDebt=!!opt.debt&&mhManage();
  openDrawerHTML(`<h2>Thêm nhà cung cấp</h2><form class="frm" id="mhs"><label class="field">Tên nhà cung cấp<input id="mhs-n" required maxlength="120"></label><label class="field">Điện thoại<input id="mhs-p" maxlength="40"></label>
   <label class="field">Điều khoản thanh toán<select id="mhs-t"><option value="">— Chưa ghi —</option><option value="TRUOC">Chuyển khoản trước khi giao</option><option value="SAU_NHAN">Chuyển khoản sau khi nhận hàng</option><option value="CONG_NO">Công nợ (trả sau N ngày)</option></select></label><label class="field" id="mhs-dw" hidden>Số ngày công nợ<input id="mhs-dd" type="number" min="0" value="30"></label>
   ${withDebt?`<h3>Công nợ đầu kỳ</h3><p class="hint">Số tiền mình đang nợ nhà cung cấp này tại ngày bắt đầu dùng web. Chưa nợ thì để 0.</p><div class="row4"><label class="field">Đang nợ (đ)<input id="mhs-a" type="number" value="0"></label><label class="field">Tính đến ngày<input id="mhs-d" type="date" value="${mhToday()}"></label></div>`:""}
   <div id="mhs-e"></div><button class="btn pri">Lưu</button></form>`);
  $("#mhs-n").focus();
  $("#mhs-t").onchange=()=>{$("#mhs-dw").hidden=$("#mhs-t").value!=="CONG_NO"};
  $("#mhs").onsubmit=async e=>{e.preventDefault();try{const body={name:$("#mhs-n").value,phone:$("#mhs-p").value,pay_terms:$("#mhs-t").value,pay_days:+$("#mhs-dd").value||0};if(withDebt){body.opening_debt=+$("#mhs-a").value||0;body.opening_date=$("#mhs-d").value}
    const r=await kApi("/mh/suppliers",{method:"POST",body:JSON.stringify(body)});closeDrawer();toast("Đã thêm nhà cung cấp");await mhReload();if(done)done(r.id)}catch(err){$("#mhs-e").innerHTML=`<div class="note red">${esc(err.message)}</div>`}};
}
/* ---------- Bên vận hành: phiếu mua + nhận hàng (không giá) ---------- */
function mhSummary(po,k){return po.lines.map(l=>esc(mhName(l.item))+" × "+mhN(k==="got"?l.received:l.qty)).join(", ")}
/* Phiếu mua quá ngày giao dự kiến mà chưa đủ hàng: số ngày trễ (0 = không trễ). */
function mhLateDays(p){
  if(!(p.status==="DAT"||p.status==="DANG_GIAO")||!p.expected_date)return 0;
  const t=mhToday();if(p.expected_date>=t)return 0;
  return Math.round((new Date(t)-new Date(p.expected_date))/864e5)}
/* Nguyên vật liệu dưới mức tối thiểu (hoặc âm kho) cần mua. Mức tối thiểu đặt ở Kho vật tư. */
function mhNeedBuy(){
  const A=(typeof KHO!=="undefined"&&KHO.alerts)||{low:[],negative:[]},ok=c=>["NVL","CCDC","HH"].includes(((KHO.items&&KHO.items.get(c))||{}).cls);
  return [...(A.negative||[]),...(A.low||[])].filter(r=>ok(r.code)).map(r=>({code:r.code,name:r.name,unit:r.unit,qty:+r.qty,min:+r.min_stock||0,need:Math.max(0,Math.round(((+r.min_stock||0)-(+r.qty))*1000)/1000)}))}
/* Tiến trình của một phiếu mua hàng: đặt → hẹn giao → nhận hàng (xác nhận bên vận hành) → chứng từ → thanh toán.
   Hai bước tiền (chứng từ, thanh toán) chỉ hiện ở trang quản trị cho CEO, quản lý, kế toán. */
const mhDM=d=>d?d.slice(8,10)+"/"+d.slice(5,7):"";
function mhPoMoney(p){
  const rv=r=>r.lines.reduce((t,l)=>t+(l.unit_price!=null?l.qty*l.unit_price:0),0),allR=(MH.orders||[]).flatMap(o=>o.receipts),inv=[];let invTotal=0,invPaid=0;
  (MH.inv||[]).filter(v=>v.status==="OK").forEach(v=>{const ids=v.receipt_ids||[],mine=p.receipts.filter(r=>ids.includes(r.id));if(!mine.length)return;
    const all=allR.filter(r=>ids.includes(r.id)),A=all.reduce((t,r)=>t+rv(r),0),B=mine.reduce((t,r)=>t+rv(r),0),k=A>0?B/A:mine.length/Math.max(1,all.length);
    inv.push({...v,share:k});invTotal+=v.total*k;invPaid+=v.paid*k});
  const invIds=new Set(inv.map(v=>v.id)),inInv=x=>!!x.invoice_id&&invIds.has(x.invoice_id),pays=(MH.pay||[]).filter(x=>x.status==="OK"&&(x.po_id===p.id||inInv(x))),direct=pays.filter(x=>!inInv(x));
  const paid=invPaid+direct.reduce((t,x)=>t+(+x.amount||0),0);
  return {inv,pays,invTotal:Math.round(invTotal),paid:Math.round(paid),deposit:direct.filter(x=>x.kind==="COC").reduce((t,x)=>t+(+x.amount||0),0)}}
function mhSteps(p){
  /* Bốn bước nối nhau: ① Đặt hàng → ② Hàng về → ③ Thanh toán → ④ Hóa đơn (tùy chọn, chỉ khi nhà cung cấp gửi hóa đơn khác giá đặt). */
  if(p.status==="HUY")return `<span class="mhs n">Đã hủy</span>`;
  const late=mhLateDays(p),got=p.status==="DU",part=p.status==="DANG_GIAO",st=[];
  st.push(["d","① Đặt hàng "+mhDM(p.order_date)+(p.expected_date?" · hẹn giao "+mhDM(p.expected_date):"")]);
  st.push(got?["d","② Hàng về: đủ"]:part?["c","② Hàng về: một phần"]:late?["l","② Chưa nhận, trễ "+late+" ngày"]:["n","② Chưa nhận hàng"]);
  if(mhManage()){
    const M=mhPoMoney(p),val=mhValue(p)||0,owe=M.invTotal||val;
    st.push(owe>0&&M.paid>=owe?["d","③ Đã trả đủ "+nf(Math.round(M.paid))]:M.paid>0?["c","③ Đã trả "+nf(Math.round(M.paid))+(owe?"/"+nf(Math.round(owe)):"")]:["n","③ Chưa trả tiền"]);
    st.push(M.invTotal>0?["d","④ Hóa đơn "+nf(Math.round(M.invTotal))]:["n","④ Hóa đơn: chưa có (không bắt buộc)"])}
  return `<div class="mhsteps">${st.map(([c,t])=>`<span class="mhs ${c}">${esc(t)}</span>`).join("")}</div>`}
const mhValue=p=>p.lines.some(l=>l.unit_price!=null)?p.lines.reduce((t,l)=>t+(l.unit_price!=null?l.qty*l.unit_price:0),0):null;
/* Khung đơn giản cho trang quản trị (bên vận hành dùng khung Sản xuất & kho sxFrame). */
function mhFrame(m,key,title,sub,body,actions){m.innerHTML=H(MH.admin?"Phiếu mua hàng":title,sub)+(actions?`<div class="filters"><span class="sp"></span>${actions}</div>`:"")+body}
function pMuaHang(m){
  mhLoad();if(mhManage()){mhLoadInv();mhLoadPay()}
  /* Bên vận hành chỉ ghi nhận hàng về (phiếu nhập kho của kho); lập phiếu mua và giá là việc của trang quản trị (Mua hàng → Đơn mua hàng) */
  const ed=false,rc=mhReceive(),O=MH.orders||[],shown=O.filter(p=>MH.view==="all"?true:p.status==="DAT"||p.status==="DANG_GIAO"),need=ed&&MH.orders?mhNeedBuy():[];
  const needCard=!ed||!MH.orders||!need.length?"":`<section class="card flush"><div class="card-h pad"><h2>Cần mua</h2><span class="hint">${need.length} nguyên vật liệu dưới mức tối thiểu</span><button class="btn sm pri" id="mh-buyall">Lập phiếu mua cho tất cả</button></div>${tbl(["Mã","Tên","Tồn hiện tại","Mức tối thiểu","Nên mua thêm",""],need.map(r=>`<tr><td class="mono">${esc(r.code)}</td><td>${esc(r.name)}</td><td class="n">${r.qty<0?`<b style="color:#b42318">${mhN(r.qty)}</b>`:mhN(r.qty)} ${esc(r.unit||"")}</td><td class="n">${r.min?mhN(r.min):"—"}</td><td class="n"><b>${mhN(r.need)}</b></td><td><button class="btn sm" data-mhb="${esc(r.code)}">Lập phiếu mua</button></td></tr>`))}</section>`;
  const body=MH.err?`<div class="note red">${esc(MH.err)}</div>`:!MH.orders?`<p class="hint pad">Đang tải…</p>`:needCard+
  `<div class="filters"><select id="mh-v">${opt([["open","Phiếu đang mở"],["all","Tất cả phiếu"]],MH.view)}</select><span class="hint">${shown.length} phiếu</span>${MH.admin&&ed?`<span class="sp"></span><button class="btn pri" id="mh-new">+ Lập phiếu mua hàng</button>`:""}</div>
   <section class="card flush">${tbl(["Số phiếu","Nhà cung cấp","Hàng đặt","Tiến trình"].concat(ed?["Giá trị đặt"]:[]).concat([""]),shown.map(p=>{const open=p.status==="DAT"||p.status==="DANG_GIAO",val=ed?mhValue(p):null;return `<tr class="clk" data-mhd="${p.id}"><td class="mono"><b>${esc(p.no)}</b><div class="hint">đặt ${esc(kDd(p.order_date))}</div></td><td>${esc(p.supplier_name)}</td><td>${mhSummary(p,"qty")}</td><td>${mhSteps(p)}</td>${ed?`<td class="n">${val==null?"—":nf(Math.round(val))}</td>`:""}<td class="nowrap">${rc&&open?`<button class="btn sm pri" data-mhr="${p.id}">Nhận hàng</button> `:""}${ed&&open&&!p.receipts.some(r=>r.status==="OK")?`<button class="btn sm" data-mhe="${p.id}">Sửa</button> <button class="btn sm danger" data-mhx="${p.id}">Hủy phiếu</button>`:""}</td></tr>`}))}</section>`;
  (MH.admin?mhFrame:sxFrame)(m,"sx_mh","Mua hàng","Theo dõi đơn mua nguyên vật liệu; kho ghi số thực nhận khi hàng về",`<details class="mhguide"><summary>Cách dùng</summary><div class="note">① Phiếu mua (đặt hàng, giá) do Thảo và kế toán lập ở <b>Trang quản trị → Mua hàng → Đơn mua hàng</b>; ở đây chỉ thấy các phiếu đang chờ hàng, không có giá. ② Hàng về, kho lập <b>phiếu nhập kho</b> ở <b>Kho vật tư → Nhập kho → Nhập nguyên vật liệu</b> và chọn ô <b>Thuộc phiếu mua</b>: phiếu mua ở đây tự chuyển sang "Đã nhận một phần" hoặc "Đủ hàng". ③ Quá ngày giao dự kiến mà chưa đủ hàng thì báo <b>Trễ</b> và nhảy cảnh báo ở Tổng quan.</div></details>`+body,ed&&!MH.admin?`<button class="btn pri" id="mh-new">+ Lập phiếu mua hàng</button>`:"");
  if(MH.err||!MH.orders)return;
  $("#mh-v").onchange=e=>{MH.view=e.target.value;renderMain()};
  if($("#mh-new"))$("#mh-new").onclick=()=>mhForm(null);
  if($("#mh-buyall"))$("#mh-buyall").onclick=()=>mhForm(null,{L:need.map(r=>({item:r.code,qty:r.need||"",note:"",price:""}))});
  m.querySelectorAll("[data-mhb]").forEach(b=>b.onclick=()=>{const r=need.find(x=>x.code===b.dataset.mhb);if(r)mhForm(null,{L:[{item:r.code,qty:r.need||"",note:"",price:""}]})});
  m.querySelectorAll("[data-mhr]").forEach(b=>b.onclick=e=>{e.stopPropagation();mhReceiveForm(b.dataset.mhr)});
  m.querySelectorAll("[data-mhe]").forEach(b=>b.onclick=e=>{e.stopPropagation();mhForm(b.dataset.mhe)});
  m.querySelectorAll("[data-mhx]").forEach(b=>b.onclick=async e=>{e.stopPropagation();const p=O.find(x=>x.id===b.dataset.mhx);if(!p||!confirm("Hủy phiếu mua "+p.no+"?"))return;
    try{await kApi("/mh/orders/"+p.id+"/cancel",{method:"POST",body:"{}"});toast("Đã hủy phiếu "+p.no);await mhReload()}catch(err){toast(err.message)}});
  m.querySelectorAll("[data-mhd]").forEach(r=>r.onclick=()=>mhDetail(r.dataset.mhd));
}
function mhDetail(id){
  const p=(MH.orders||[]).find(x=>x.id===id);if(!p)return;const st=MH_ST[p.status]||["",""],money=false;
  openDrawerHTML(`<h2>${esc(p.no)} · ${esc(p.supplier_name)}</h2><p class="hint">Ngày đặt ${esc(kDd(p.order_date))}${p.expected_date?" · giao dự kiến "+esc(kDd(p.expected_date)):""} · ${pill(st[0],st[1])}${mhLateDays(p)?" "+pill("Trễ "+mhLateDays(p)+" ngày","red"):""}${p.note?" · "+esc(p.note):""}</p>
   <h3>Tiến trình</h3>${mhSteps(p)}${(mhManage())?(()=>{const M=mhPoMoney(p);return M.inv.length||M.pays.length?`<h3>Chứng từ và thanh toán</h3>${tbl(["Ngày","Nội dung","Số tiền"],[...M.inv.map(v=>`<tr><td>${esc(mhD(v.invoice_date))}</td><td>${v.doc_type==="PG"?"Phiếu giao / bill":"Hóa đơn"} ${esc(v.invoice_no||"")}</td><td class="n">${nf(v.total)}</td></tr>`),...M.inv.filter(v=>v.paid>0).map(v=>`<tr><td></td><td>Đã chi cho ${esc(v.invoice_no||"chứng từ")}</td><td class="n">−${nf(v.paid)}</td></tr>`),...M.pays.map(x=>`<tr><td>${esc(mhD(x.pay_date))}</td><td>${x.kind==="COC"?"Tiền cọc":"Đã chi"}</td><td class="n">−${nf(x.amount)}</td></tr>`)])}`:""})():""}
   <h3>Hàng đặt</h3>${tbl(["Mã","Tên","Đặt","Đã nhận","Còn thiếu"],p.lines.map(l=>`<tr><td class="mono">${esc(l.item)}</td><td>${esc(l.name)}</td><td class="n">${mhN(l.qty)} ${esc(l.unit||"")}</td><td class="n">${mhN(l.received)}</td><td class="n">${l.qty-l.received>1e-9?`<b style="color:#b42318">${mhN(l.qty-l.received)}</b>`:"—"}</td></tr>`))}
   <h3>Các lần nhận hàng</h3>${p.receipts.length?tbl(["Ngày nhận","Hàng nhận","Ghi chú","Trạng thái",""],p.receipts.map(r=>`<tr><td>${esc(kDd(r.receipt_date))}</td><td>${r.lines.map(l=>esc(l.name)+" × "+mhN(l.qty)+(money&&l.unit_price!=null?" @ "+nf(l.unit_price):"")).join("<br>")}</td><td>${esc(r.note||"")}</td><td>${r.status!=="OK"?pill("Đã hủy","gry"):r.lines.length&&r.lines.every(l=>(KHO.items&&KHO.items.get(l.item)||{}).cls==="CCDC")?pill("Vào sổ tài sản / công cụ","grn"):pill("Đã nhập kho","grn")}</td><td>${mhManage()&&r.status==="OK"?`<button class="btn sm danger" data-mhcr="${r.id}">Hủy lần nhận</button>`:""}</td></tr>`)):`<p class="hint">Chưa có lần nhận nào.</p>`}`);
  document.querySelectorAll("[data-mhcr]").forEach(b=>b.onclick=async()=>{if(!confirm("Hủy lần nhận hàng này? Phiếu nhập kho tương ứng cũng bị hủy."))return;
    try{await kApi("/mh/receipts/"+b.dataset.mhcr+"/cancel",{method:"POST",body:JSON.stringify({reason:"Hủy lần nhận hàng"})});closeDrawer();toast("Đã hủy lần nhận hàng");await mhReload()}catch(err){toast(err.message)}});
}
/* Form lập / sửa phiếu mua */
function mhForm(id,draft){
  const p=id?(MH.orders||[]).find(x=>x.id===id):null;
  /* Đơn mua tài sản / công cụ (Ghi nhanh, chị Hoa 28/10): chỉ chọn mã lớp CCDC; nhận hàng không vào tồn kho, chờ ghi tăng ở trang Tài sản & CCDC (taisan.js). */
  /* Chị Hoa 28/10: đơn mua thường cũng tích được "tài sản / công cụ dụng cụ"; sửa đơn toàn hàng CCDC thì mặc định đang tích. */
  const TSM=draft&&draft.ts!=null?!!draft.ts:!!p&&typeof tsDonTaiSan==="function"&&tsDonTaiSan(p.id);
  const L=draft&&draft.L?draft.L:p?p.lines.map(l=>({item:l.item,qty:l.qty,note:l.note||"",price:l.unit_price==null?"":l.unit_price})):[{item:"",qty:"",note:"",price:""}];
  openDrawerHTML(`<h2>${p?"Sửa phiếu mua "+esc(p.no):TSM?"Lập đơn mua tài sản / công cụ":"Lập phiếu mua hàng"}</h2>${TSM?`<p class="hint">Chọn mã tài sản / công cụ (hoặc bấm + Tài sản / công cụ mới). Kho nhận hàng xong, hàng không vào tồn kho mà hiện ở trang Tài sản cố định / Công cụ dụng cụ để ghi tăng. Tiền trả nhà cung cấp hiện ở Nhật ký chi, không tính vào chi phí tháng.</p>`:""}<form class="frm" id="mhf"><label class="chk" style="margin:0 0 10px"><input type="checkbox" id="mhf-ts"${TSM?" checked":""}><span>Đơn mua <b>tài sản / công cụ dụng cụ</b> (máy móc, dụng cụ): vẫn hiện ở Mua hàng, nhận hàng không vào tồn kho mà vào sổ Tài sản / Công cụ</span></label><div class="row4"><label class="field grow">Nhà cung cấp<select id="mhf-s">${mhSupOpts(draft&&draft.sup?draft.sup:p?p.supplier_id:"")}</select></label><button type="button" class="btn sm" id="mhf-ns" style="align-self:end">+ Nhà cung cấp mới</button></div>
   <div class="row4"><label class="field">Ngày đặt hàng<input id="mhf-d" type="date" value="${esc(draft&&draft.date?draft.date:p?p.order_date:mhToday())}" required></label><label class="field">Ngày giao dự kiến<input id="mhf-e" type="date" value="${esc(draft&&draft.exp!=null?draft.exp:p?(p.expected_date||""):"")}"></label></div>
   <div class="tbl edit"><table><thead><tr><th>Mã hàng</th><th>Tên</th><th>Số lượng đặt</th><th>Giá đặt (đ)</th><th>Ghi chú</th><th></th></tr></thead><tbody id="mhf-b"></tbody></table></div>
   <div class="row7"><button type="button" class="btn" id="mhf-add">+ Thêm dòng</button>${TSM&&khoCanMisa()&&typeof tsMaMoi==="function"?`<button type="button" class="btn" id="mhf-newts">+ Tài sản / công cụ mới</button>`:""}${!TSM&&khoCanMisa()?`<button type="button" class="btn" id="mhf-newitem" title="Hàng chưa có trong danh mục (đồ gia dụng, quà tặng khách...)">+ Mã hàng mới (gia dụng, quà tặng…)</button>`:""}<span id="mhf-tot" class="hint"></span></div>
   <label class="field">Ghi chú phiếu<input id="mhf-n" value="${esc(draft&&draft.note!=null?draft.note:p?p.note:"")}"></label><div id="mhf-e2"></div><button class="btn pri">${p?"Lưu phiếu":"Lập phiếu"}</button></form>`);
  const tot=()=>{const v=L.reduce((t,l)=>t+(+l.qty||0)*(+l.price||0),0);$("#mhf-tot").textContent=v?"Giá trị đặt: "+nf(Math.round(v))+" đ":""};
  const draw=()=>{$("#mhf-b").innerHTML=L.map((l,i)=>`<tr><td><input class="mh-i" data-i="${i}" value="${esc(l.item)}" placeholder="Gõ mã hoặc tên" autocomplete="off"></td><td class="mh-nm">${esc(l.item?mhName(l.item):"")}</td><td><input class="mh-q n" data-i="${i}" type="number" min="0" step="any" value="${l.qty}"></td><td><input class="mh-p n" data-i="${i}" type="number" min="0" step="any" value="${l.price==null?"":l.price}" placeholder="Giá"></td><td><input class="mh-o" data-i="${i}" value="${esc(l.note)}"></td><td><button type="button" class="lnk" data-rm="${i}">✕</button></td></tr>`).join("");
    document.querySelectorAll(".mh-i").forEach(x=>khoPick(x,TSM?["CCDC"]:["NVL","CCDC","HH"],it=>{const i=+x.dataset.i;L[i].item=it.code;x.value=it.code;x.closest("tr").querySelector(".mh-nm").textContent=it.name}));
    document.querySelectorAll(".mh-q").forEach(x=>x.oninput=()=>{L[+x.dataset.i].qty=x.value;tot()});document.querySelectorAll(".mh-p").forEach(x=>x.oninput=()=>{L[+x.dataset.i].price=x.value;tot()});
    document.querySelectorAll(".mh-o").forEach(x=>x.oninput=()=>L[+x.dataset.i].note=x.value);
    document.querySelectorAll("[data-rm]").forEach(x=>x.onclick=()=>{L.splice(+x.dataset.rm,1);if(!L.length)L.push({item:"",qty:"",note:"",price:""});draw()});tot()};
  draw();
  $("#mhf-add").onclick=()=>{L.push({item:"",qty:"",note:"",price:""});draw()};
  if($("#mhf-newitem"))$("#mhf-newitem").onclick=()=>{
    const keep={L,sup:$("#mhf-s").value,date:$("#mhf-d").value,exp:$("#mhf-e").value,note:$("#mhf-n").value};
    khoNewItem({cls:"HH",askProduct:true,hint:"Đồ gia dụng, quà tặng khách hoặc hàng chưa có trong danh mục. Đặt mã ngắn, không dấu, không trùng (ví dụ QUA-NOIKIM, GD-CHOIBAT). Thêm xong mã tự điền vào dòng đang trống của phiếu mua.",
      onDone:async code=>{const e=keep.L.find(l=>!l.item);if(e)e.item=code;else keep.L.push({item:code,qty:"",note:"",price:""});mhForm(id,keep)}})};
  if($("#mhf-newts"))$("#mhf-newts").onclick=()=>{const keep={L,sup:$("#mhf-s").value,date:$("#mhf-d").value,exp:$("#mhf-e").value,note:$("#mhf-n").value,ts:true};
    tsMaMoi(code=>{const e=keep.L.find(l=>!l.item);if(e)e.item=code;else keep.L.push({item:code,qty:"",note:"",price:""});mhForm(id,keep)},()=>mhForm(id,keep))};
  mhSupPick("#mhf-s");
  $("#mhf-ts").onchange=()=>mhForm(id,{L,sup:$("#mhf-s").value,date:$("#mhf-d").value,exp:$("#mhf-e").value,note:$("#mhf-n").value,ts:$("#mhf-ts").checked});
  $("#mhf-ns").onclick=()=>{const keep={L,sup:$("#mhf-s").value,date:$("#mhf-d").value,exp:$("#mhf-e").value,note:$("#mhf-n").value,ts:TSM};mhNewSupplier(sid=>mhForm(id,{...keep,sup:sid}))};
  $("#mhf").onsubmit=async e=>{e.preventDefault();
    const sai=TSM?L.filter(l=>l.item&&(KHO.items&&KHO.items.get(l.item)||{}).cls!=="CCDC").map(l=>l.item):[];
    if(sai.length){$("#mhf-e2").innerHTML=`<div class="note red">Đơn tài sản / công cụ chỉ gồm mã tài sản / công cụ. ${esc(sai.join(", "))} là hàng vào kho: bỏ dòng đó hoặc bỏ tích ở đầu form.</div>`;return}
    const body={supplier_id:$("#mhf-s").value,order_date:$("#mhf-d").value,expected_date:$("#mhf-e").value||null,note:$("#mhf-n").value,lines:L.filter(l=>l.item).map(l=>({item:l.item,qty:+l.qty,note:l.note,unit_price:l.price===""||l.price==null?null:+l.price}))};
    try{const r=await kApi(p?"/mh/orders/"+p.id:"/mh/orders",{method:p?"PUT":"POST",body:JSON.stringify(body)});closeDrawer();toast(p?"Đã lưu phiếu":"Đã lập phiếu "+r.no);await mhReload()}catch(err){$("#mhf-e2").innerHTML=`<div class="note red">${esc(err.message)}</div>`}};
}
/* Form kho báo thực nhận */
function mhReceiveForm(id){
  const p=(MH.orders||[]).find(x=>x.id===id);if(!p)return;
  const L=p.lines.map(l=>({po_line_id:l.id,item:l.item,name:l.name,unit:l.unit,qty:l.qty,received:l.received,now:Math.max(0,Math.round((l.qty-l.received)*1e6)/1e6)})),X=[];
  openDrawerHTML(`<h2>Nhận hàng · ${esc(p.no)}</h2><p class="hint">${esc(p.supplier_name)} · ghi số THỰC NHẬN của lần giao này (có thể khác số đặt). Hệ thống tự lập phiếu nhập kho.</p><form class="frm" id="mhr"><label class="field">Ngày nhận<input id="mhr-d" type="date" value="${mhToday()}" required></label>
   <div class="tbl edit"><table><thead><tr><th>Hàng</th><th>Đặt</th><th>Đã nhận</th><th>Nhận lần này</th></tr></thead><tbody>${L.map((l,i)=>`<tr><td><b>${esc(l.name)}</b><br><small class="mono">${esc(l.item)}</small></td><td class="n">${mhN(l.qty)} ${esc(l.unit||"")}</td><td class="n">${mhN(l.received)}</td><td><input class="mhr-q n" data-i="${i}" type="number" min="0" step="any" value="${l.now}"></td></tr>`).join("")}</tbody></table></div>
   <h3>Hàng giao thêm ngoài phiếu đặt</h3><div class="tbl edit"><table><tbody id="mhr-x"></tbody></table></div><div class="row7"><button type="button" class="btn sm" id="mhr-add">+ Thêm hàng giao thêm</button></div>
   <label class="field">Ghi chú (ví dụ: giao thiếu, hàng lỗi)<input id="mhr-n"></label><div id="mhr-e"></div><button class="btn pri">Ghi nhận hàng về kho</button></form>`);
  document.querySelectorAll(".mhr-q").forEach(x=>x.oninput=()=>L[+x.dataset.i].now=x.value);
  const drawX=()=>{$("#mhr-x").innerHTML=X.map((l,i)=>`<tr><td><input class="mhx-i" data-i="${i}" value="${esc(l.item)}" placeholder="Gõ mã hoặc tên" autocomplete="off"></td><td class="mh-nm">${esc(l.item?mhName(l.item):"")}</td><td><input class="mhx-q n" data-i="${i}" type="number" min="0" step="any" value="${l.qty}" placeholder="Số lượng"></td><td><button type="button" class="lnk" data-xr="${i}">✕</button></td></tr>`).join("");
    document.querySelectorAll(".mhx-i").forEach(x=>khoPick(x,["NVL","CCDC","HH"],it=>{const i=+x.dataset.i;X[i].item=it.code;x.value=it.code;x.closest("tr").querySelector(".mh-nm").textContent=it.name}));
    document.querySelectorAll(".mhx-q").forEach(x=>x.oninput=()=>X[+x.dataset.i].qty=x.value);
    document.querySelectorAll("[data-xr]").forEach(x=>x.onclick=()=>{X.splice(+x.dataset.xr,1);drawX()})};
  $("#mhr-add").onclick=()=>{X.push({item:"",qty:""});drawX()};
  $("#mhr").onsubmit=async e=>{e.preventDefault();
    const lines=L.filter(l=>+l.now>0).map(l=>({po_line_id:l.po_line_id,item:l.item,qty:+l.now})).concat(X.filter(x=>x.item&&+x.qty>0).map(x=>({item:x.item,qty:+x.qty})));
    if(!lines.length){$("#mhr-e").innerHTML=`<div class="note red">Chưa có dòng nào có số lượng nhận.</div>`;return}
    try{const r=await kApi("/mh/orders/"+p.id+"/receipts",{method:"POST",body:JSON.stringify({receipt_date:$("#mhr-d").value,note:$("#mhr-n").value,lines})});closeDrawer();toast("Đã nhập kho, phiếu "+r.kho_doc_no);await mhReload();if(typeof khoLoad==="function")khoLoad(true)}catch(err){$("#mhr-e").innerHTML=`<div class="note red">${esc(err.message)}</div>`}};
}
/* Tab "Đặt ngoài" giữ trang cũ (hàng AILLA đặt bên ngoài thay vì tự sản xuất) */
{const i=SX_TABS.findIndex(t=>t[0]==="sx_mh");if(i>=0)SX_TABS[i][1]="Mua hàng"}
{const old=PAGES.sx_mh;PAGES.sx_dn=function(m){old.apply(this,arguments);m.querySelectorAll(".sxtabs button").forEach(b=>b.classList.toggle("on",b.dataset.sxt==="sx_dn"))}}
PAGES.sx_mh=sxInit(pMuaHang);
/* Người có quyền mua hàng (Thảo, kế toán, CEO) dùng mục "Mua hàng" riêng ở thanh bên: tab Mua hàng trong Sản xuất & kho chỉ còn cho kho ghi nhận hàng về. Link cũ vào tab này thì chuyển sang mục mới. */
{const _sx=PAGES.sx_mh;PAGES.sx_mh=function(m){if(mhManage()){PAGE="mh_po";renderMain();return}return _sx.apply(this,arguments)}}

/* =====================================================================
   Trang quản trị: Mua hàng & công nợ (có giá)
   ===================================================================== */
const mhD=v=>v?kDd(v):"";
/* Hướng dẫn ngắn ở đầu mỗi trang: trang này làm gì, ai làm, khi nào. */
const MH_GUIDE={
  mh_po:"<b>Phiếu mua hàng</b> do Thảo lập khi đặt hàng nhà cung cấp: ngày đặt, ngày giao dự kiến, hàng, số lượng, giá đặt. Trang này theo dõi từng phiếu: đã đặt, đang giao, đủ hàng, trễ bao nhiêu ngày.",
  mh_cho:"<b>Làm khi nào:</b> kho đã ghi hàng về (bên vận hành) mà chưa có chứng từ giá. Khi nhà cung cấp gửi <b>phiếu giao hàng, bill hoặc hóa đơn đỏ</b> thì bấm <b>Ghi chứng từ</b>: nhập giá từng dòng, VAT, vận chuyển, bốc vác và <b>đính kèm ảnh hoặc PDF</b>. Ghi xong hàng biến mất khỏi danh sách này và công nợ nhà cung cấp tăng đúng số tiền.",
  mh_hd:"<b>Chứng từ</b> là phiếu giao hàng, bill hoặc hóa đơn đỏ nhà cung cấp gửi. <b>Khi nào ghi:</b> hàng đã về kho (kho đã ghi nhận) và nhà cung cấp gửi chứng từ. Bấm <b>Ghi chứng từ</b> ở khối đầu trang (hoặc nút <b>+ Ghi chứng từ nhà cung cấp</b>): nhập giá từng dòng, VAT, vận chuyển, bốc vác, đính kèm ảnh hoặc PDF. Ghi xong, hàng biến mất khỏi khối chờ và công nợ nhà cung cấp tăng đúng số tiền. Bấm vào một chứng từ đã ghi để xem hoặc thêm ảnh; ghi nhầm thì Hủy chứng từ rồi ghi lại.",
  mh_chi:"<b>Khi nào ghi:</b> Thảo báo đã thanh toán hoặc đã cọc cho nhà cung cấp thì kế toán bấm <b>+ Ghi phiếu chi</b>: nhà cung cấp, số tiền, ngày, tài khoản. Trả một phần, trả khi chưa có hóa đơn, hay trả trước (cọc) đều được; công nợ nhà cung cấp tự trừ.",
  mh_no:"<b>Kết quả.</b> Mình còn nợ từng nhà cung cấp bao nhiêu = công nợ đầu kỳ + chứng từ − tiền đã chi (gồm cả cọc). <b>Lần đầu:</b> bấm <b>+ Thêm nhà cung cấp</b> và nhập số nợ cũ ngay trong form đó. Về sau sửa số nợ đầu kỳ bằng nút <b>Đặt đầu kỳ</b> ở dòng nhà cung cấp.",
  mh_gianvl:"<b>Kết quả.</b> Giá trung bình của từng nguyên vật liệu trong tháng (có tính cả hàng còn tồn đầu tháng). Số này dùng để tính giá thành sản phẩm."};
const mhGuide=k=>`<details class="mhguide"><summary>Cách dùng</summary><div class="note">${MH_GUIDE[k]}</div></details>`;
function mhNeedAdmin(m,title,sub){
  if(!mhManage()){m.innerHTML=H(title,sub)+`<section class="card"><p>Chỉ CEO, quản lý và kế toán xem được phần này.</p></section>`;return true}
  return false;
}
/* --- Chờ ghi chứng từ: hàng đã về kho nhưng chưa có phiếu giao / hóa đơn của nhà cung cấp --- */
async function mhLoadInv(){if(MH.inv)return;try{MH.inv=await kApi("/mh/invoices")}catch(e){MH.inv=[];toast(e.message)}if(/^mh_|^(so_cp|ngan_sach|tien_lich)$/.test(PAGE))renderMain()}
const MH_DOC={HD:"Hóa đơn VAT (hóa đơn đỏ)",PG:"Phiếu giao hàng / bill"};
function mhPendingReceipts(){
  const used=new Set((MH.inv||[]).filter(v=>v.status==="OK").flatMap(v=>v.receipt_ids||[])),out=[];
  (MH.orders||[]).filter(p=>p.status!=="HUY").forEach(p=>p.receipts.filter(r=>r.status==="OK"&&!used.has(r.id)).forEach(r=>out.push({p,r})));return out}
function pMhCho(m){
  mhLoad();mhLoadInv();const T="Chờ ghi chứng từ",S="Hàng đã về kho, chưa có phiếu giao hoặc hóa đơn của nhà cung cấp";
  if(mhNeedAdmin(m,T,S))return;
  if(MH.err||!MH.orders||!MH.inv){m.innerHTML=H(T,S)+(MH.err?`<div class="note red">${esc(MH.err)}</div>`:`<p class="hint pad">Đang tải…</p>`);return}
  const L=mhPendingReceipts();
  m.innerHTML=H(T,S)+mhGuide("mh_cho")+`<div class="filters"><span class="hint">${L.length?L.length+" lần nhận hàng đang chờ chứng từ":""}</span><span class="sp"></span><button class="btn pri" id="mhw-new">+ Ghi chứng từ nhà cung cấp</button></div>
  ${L.length?`<section class="card flush">${tbl(["Ngày nhận","Phiếu mua","Nhà cung cấp","Hàng đã nhận","Giá đặt dự kiến",""],L.map(({p,r})=>{const plan=r.lines.reduce((t,l)=>{const pl=p.lines.find(x=>x.id===l.po_line_id);return t+(pl&&pl.unit_price!=null?l.qty*pl.unit_price:NaN)},0);return `<tr><td>${esc(mhD(r.receipt_date))}</td><td class="mono">${esc(p.no)}</td><td>${esc(p.supplier_name)}</td><td>${r.lines.map(l=>esc(l.name)+" × "+mhN(l.qty)).join("<br>")}</td><td class="n">${isNaN(plan)?"—":nf(Math.round(plan))}</td><td><button class="btn sm pri" data-wr="${r.id}" data-ws="${p.supplier_id}">Ghi chứng từ</button></td></tr>`}))}</section>`:`<section class="card"><p class="pad">Không có hàng nào đang chờ chứng từ. Khi kho ghi nhận hàng về (ở bên vận hành), hàng hiện ở đây để kế toán ghi phiếu giao, bill hoặc hóa đơn của nhà cung cấp. Có chứng từ mà chưa thấy hàng về thì bấm <b>+ Ghi chứng từ nhà cung cấp</b> và nhập tiền hàng tay.</p></section>`}`;
  $("#mhw-new").onclick=()=>mhDocForm();
  m.querySelectorAll("[data-wr]").forEach(b=>b.onclick=()=>mhDocForm({sup:b.dataset.ws,rids:[b.dataset.wr]}));
}
/* --- Chứng từ nhà cung cấp đã ghi --- */
/* Khối "hàng đã về kho, chờ ghi chứng từ": nằm ngay đầu trang Chứng từ nhà cung cấp. */
function mhPendingCard(){
  const L=mhPendingReceipts();
  return `<section class="card flush"><div class="card-h pad"><h2>Hàng đã về kho, chưa có chứng từ</h2><span class="hint">${L.length?L.length+" lần nhận hàng đang chờ":"không có hàng nào đang chờ"}</span></div>${L.length?tbl(["Ngày nhận","Phiếu mua","Nhà cung cấp","Hàng đã nhận","Giá đặt dự kiến",""],L.map(({p,r})=>{const plan=r.lines.reduce((t,l)=>{const pl=p.lines.find(x=>x.id===l.po_line_id);return t+(pl&&pl.unit_price!=null?l.qty*pl.unit_price:NaN)},0);return `<tr><td>${esc(mhD(r.receipt_date))}</td><td class="mono">${esc(p.no)}</td><td>${esc(p.supplier_name)}</td><td>${r.lines.map(l=>esc(l.name)+" × "+mhN(l.qty)).join("<br>")}</td><td class="n">${isNaN(plan)?"—":nf(Math.round(plan))}</td><td><button class="btn sm pri" data-wr="${r.id}" data-ws="${p.supplier_id}">Ghi chứng từ</button></td></tr>`})):`<p class="hint pad">Khi kho ghi nhận hàng về (bên vận hành), hàng hiện ở đây để kế toán ghi chứng từ. Có chứng từ mà chưa thấy hàng về thì bấm <b>+ Ghi chứng từ nhà cung cấp</b> và nhập tiền hàng tay.</p>`}</section>`}
function pMhHd(m){
  mhLoad();mhLoadInv();const T="Chứng từ nhà cung cấp",S="Phiếu giao hàng, bill, hóa đơn đỏ của nhà cung cấp";
  if(mhNeedAdmin(m,T,S))return;
  if(!MH.inv||!MH.orders){m.innerHTML=H(T,S)+`<p class="hint pad">Đang tải…</p>`;return}
  m.innerHTML=H(T,S)+mhGuide("mh_hd")+mhPendingCard()+`<div class="filters"><span class="hint">Chứng từ đã ghi</span><span class="sp"></span><button class="btn pri" id="mhh-new">+ Ghi chứng từ nhà cung cấp</button></div>
  <section class="card flush">${gdTbl(["Ngày","Loại","Số chứng từ","Nhà cung cấp","Tiền hàng","VAT","Vận chuyển","Bốc vác + khác","Tổng phải trả","Đã chi","Còn lại","Ảnh / PDF","Trạng thái","Liên quan",""],gdCat(MH.inv,MH.pgHd||(MH.pgHd={co:gdCoNho("mhhd",100),trang:1})).map(v=>`<tr class="clk ${v.status==="OK"?"":"mut"}" data-hv="${v.id}"><td>${esc(mhD(v.invoice_date))}</td><td>${v.doc_type==="PG"?"Phiếu giao / bill":"Hóa đơn VAT"}</td><td>${esc(v.invoice_no||"—")}</td><td>${esc(v.supplier_name)}</td><td class="n">${nf(v.goods_amount)}</td><td class="n">${nf(v.vat_amount)}${v.vat_in_cost?" <small>(vào giá vốn)</small>":""}</td><td class="n">${nf(v.freight)}</td><td class="n">${nf(v.handling+v.other)}</td><td class="n"><b>${nf(v.total)}</b></td><td class="n">${nf(v.paid)}</td><td class="n">${v.status==="OK"?nf(v.total-v.paid):"—"}</td><td>${v.file_count?pill(v.file_count+" file","blu"):"<span class=\"hint\">chưa có</span>"}</td><td>${v.status==="OK"?pill(v.paid>=v.total?"Đã chi đủ":v.paid>0?"Chi một phần":"Chưa chi",v.paid>=v.total?"grn":v.paid>0?"blu":"amb"):pill("Đã hủy","gry")}</td><td class="gdd">${[...(MH.orders||[]).filter(p=>(p.receipts||[]).some(r=>(v.receipt_ids||[]).includes(r.id))).map(mhLqPo),...(MH.pay||[]).filter(x=>x.status==="OK"&&x.invoice_id===v.id).map(mhLqPv)].join(" ")||`<span class="hint">—</span>`}</td><td>${v.status==="OK"?`<button class="btn sm danger" data-hx="${v.id}">Hủy chứng từ</button>`:""}</td></tr>`))}${(()=>{const L=MH.inv.filter(v=>v.status==="OK"),t=k=>L.reduce((s,v)=>s+(+v[k]||0),0);
    return gdChan(`<span>Cộng <b>${MH.inv.length}</b> chứng từ: phải trả <b>${nf(t("total"))}</b> đ</span><span class="hint">đã chi <b>${nf(t("paid"))}</b> · còn lại <b>${nf(t("total")-t("paid"))}</b></span>`,MH.inv.length,MH.pgHd,"mhhd")})()}</section>`;
  gdCss();mhLqBind(m);gdChanBind(m,"mhhd",MH.pgHd,renderMain);
  $("#mhh-new").onclick=()=>mhDocForm();
  m.querySelectorAll("[data-wr]").forEach(b=>b.onclick=()=>mhDocForm({sup:b.dataset.ws,rids:[b.dataset.wr]}));
  m.querySelectorAll("[data-hv]").forEach(r=>r.onclick=()=>mhDocDetail(r.dataset.hv));
  m.querySelectorAll("[data-hx]").forEach(b=>b.onclick=async e=>{e.stopPropagation();if(!confirm("Hủy chứng từ này? Giá vốn nhập quay về giá chưa cộng phí."))return;
    try{await kApi("/mh/invoices/"+b.dataset.hx+"/cancel",{method:"POST",body:"{}"});toast("Đã hủy chứng từ");await mhReload();await mhLoadInv()}catch(err){toast(err.message)}});
}
/* Nén ảnh bill về tối đa 1600 điểm (vẫn đọc rõ chữ); PDF giữ nguyên nhưng không quá ~900 KB. */
function mhPrepFile(file){
  return new Promise((res,rej)=>{
    if(file.type==="application/pdf"){if(file.size>900000){rej(new Error(file.name+": PDF quá lớn (tối đa khoảng 900 KB)"));return}
      const fr=new FileReader();fr.onload=()=>res({name:file.name,mime:"application/pdf",data:String(fr.result).split(",")[1]});fr.onerror=()=>rej(new Error("Không đọc được "+file.name));fr.readAsDataURL(file);return}
    if(!file.type.startsWith("image/")){rej(new Error(file.name+": chỉ nhận ảnh hoặc PDF"));return}
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{const k=Math.min(1,1600/Math.max(img.width,img.height)),cv=document.createElement("canvas");cv.width=Math.round(img.width*k);cv.height=Math.round(img.height*k);const cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(img,0,0,cv.width,cv.height);URL.revokeObjectURL(url);
      let q=.8,d=cv.toDataURL("image/jpeg",q);while(d.length>1300000&&q>.4){q-=.1;d=cv.toDataURL("image/jpeg",q)}
      res({name:file.name.replace(/\.[^.]+$/,"")+".jpg",mime:"image/jpeg",data:d.split(",")[1]})};
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error("Không đọc được ảnh "+file.name))};img.src=url})}
async function mhUploadFiles(invId,files){
  let okn=0;
  for(const f of files){try{const x=await mhPrepFile(f);await kApi("/mh/invoices/"+invId+"/files",{method:"POST",body:JSON.stringify(x)});okn++}catch(e){toast(e.message)}}
  return okn}
const mhFileUrl=(inv,f)=>"/api/hub/kho/mh/invoices/"+inv+"/files/"+f;
/* Xem chi tiết một chứng từ: số tiền, hàng, ảnh / PDF đính kèm (thêm, xóa được). */
async function mhDocDetail(id){
  const v=(MH.inv||[]).find(x=>x.id===id);if(!v)return;
  let files=[];try{files=await kApi("/mh/invoices/"+id+"/files")}catch(e){toast(e.message)}
  let ml=[];try{ml=await kApi("/mh/invoices/"+id+"/lines")}catch(e){}
  const rcs=[];(MH.orders||[]).forEach(p=>p.receipts.forEach(r=>{if((v.receipt_ids||[]).includes(r.id))rcs.push({p,r})}));
  openDrawerHTML(`<h2>${v.doc_type==="PG"?"Phiếu giao / bill":"Hóa đơn"} ${esc(v.invoice_no||"")} · ${esc(v.supplier_name)}</h2><p class="hint">Ngày ${esc(mhD(v.invoice_date))} · tiền hàng ${nf(v.goods_amount)} + VAT ${nf(v.vat_amount)} + vận chuyển ${nf(v.freight)} + bốc vác ${nf(v.handling)} + khác ${nf(v.other)} = <b>${nf(v.total)}</b>${v.note?" · "+esc(v.note):""}</p>
   ${rcs.length?`<h3>Hàng thuộc chứng từ</h3>${tbl(["Ngày nhận","Phiếu mua","Hàng","Số nhận","Giá lúc giao","Thành tiền"],rcs.flatMap(({p,r})=>r.lines.map(l=>`<tr><td>${esc(mhD(r.receipt_date))}</td><td class="mono">${esc(p.no)}</td><td>${esc(l.name)}</td><td class="n">${mhN(l.qty)} ${esc(l.unit||"")}</td><td class="n">${l.unit_price!=null?nf(l.unit_price):"—"}</td><td class="n">${l.unit_price!=null?nf(Math.round(l.qty*l.unit_price)):"—"}</td></tr>`)))}`:(ml.length?"":`<p class="hint">Chứng từ chỉ có tổng tiền hàng, không có dòng hàng.</p>`)}${ml.length?`<h3>Dòng hàng nhập trên chứng từ</h3>${tbl(["Hàng","Số lượng","Đơn giá","Thành tiền"],ml.map(l=>`<tr><td>${esc(l.name)}<br><small class="mono">${esc(l.item)}</small></td><td class="n">${mhN(l.qty)} ${esc(l.unit||"")}</td><td class="n">${nf(l.unit_price)}</td><td class="n">${nf(Math.round(l.qty*l.unit_price))}</td></tr>`))}`:""}
   <h3>Ảnh / PDF đính kèm</h3><div class="mhfiles">${files.length?files.map(f=>f.mime==="application/pdf"?`<div class="mhfile"><a href="${mhFileUrl(id,f.id)}" target="_blank" rel="noopener">📄 ${esc(f.name||"hóa đơn.pdf")}</a><button type="button" class="lnk" data-fd="${f.id}">Xóa</button></div>`:`<div class="mhfile"><a href="${mhFileUrl(id,f.id)}" target="_blank" rel="noopener"><img src="${mhFileUrl(id,f.id)}" alt="${esc(f.name)}"></a><button type="button" class="lnk" data-fd="${f.id}">Xóa</button></div>`).join(""):`<p class="hint">Chưa có ảnh hoặc PDF nào.</p>`}</div>
   <label class="field">Thêm ảnh bill, hóa đơn đỏ (ảnh hoặc PDF)<input type="file" id="mhd-f" multiple accept="image/*,application/pdf"></label><button class="btn" id="mhd-up">Tải lên</button>`);
  document.querySelectorAll("[data-fd]").forEach(b=>b.onclick=async()=>{if(!confirm("Xóa file này?"))return;try{await kApi("/mh/invoices/"+id+"/files/"+b.dataset.fd,{method:"DELETE"});MH.inv=null;await mhLoadInv();mhDocDetail(id)}catch(e){toast(e.message)}});
  $("#mhd-up").onclick=async()=>{const fs=[...$("#mhd-f").files];if(!fs.length)return;$("#mhd-up").disabled=true;const n=await mhUploadFiles(id,fs);if(n)toast("Đã tải lên "+n+" file");MH.inv=null;await mhLoadInv();mhDocDetail(id)};
}
/* Form ghi chứng từ: chọn nhà cung cấp → hàng kho đã nhận (nhập giá từng dòng) + thêm dòng hàng khác → chi phí → đính kèm ảnh / PDF. */
function mhDocForm(pre){
  pre=pre||{};
  const pend=mhPendingReceipts(),M=[{item:"",qty:"",price:""}];
  openDrawerHTML(`<h2>Ghi chứng từ nhà cung cấp</h2><form class="frm mhdoc" id="mhi">
   <div class="row4"><label class="field grow">Nhà cung cấp<select id="mhi-s">${mhSupOpts(pre.sup||"")}</select></label><label class="field">Loại chứng từ<select id="mhi-t"><option value="PG">${MH_DOC.PG}</option><option value="HD">${MH_DOC.HD}</option></select></label></div>
   <div class="row4"><label class="field grow">Số chứng từ<input id="mhi-no" placeholder="Số phiếu giao hoặc số hóa đơn"></label><label class="field">Ngày chứng từ<input id="mhi-d" type="date" value="${mhToday()}" required></label></div>
   <h3 class="mhstep"><span>1</span>Hàng và giá</h3>
   <div id="mhi-r"></div>
   <div id="mhi-mwrap"><div class="hint" id="mhi-mh"></div><div class="tbl edit"><table class="mhlines"><thead><tr><th>Mã hàng</th><th class="n">Số lượng</th><th class="n">Đơn giá (đ)</th><th class="n">Thành tiền</th><th></th></tr></thead><tbody id="mhi-m"></tbody></table></div><button type="button" class="btn sm" id="mhi-add">+ Thêm dòng hàng</button></div>
   <h3 class="mhstep"><span>2</span>Chi phí trên chứng từ</h3>
   <div class="row4"><label class="field">VAT (đ)<input id="mhi-vat" type="number" min="0" value="0"></label><label class="field">Vận chuyển (đ)<input id="mhi-fr" type="number" min="0" value="0"></label><label class="field">Bốc vác (đ)<input id="mhi-hd" type="number" min="0" value="0"></label><label class="field">Khác (đ)<input id="mhi-ot" type="number" min="0" value="0"></label></div>
   <label class="chk"><input type="checkbox" id="mhi-vc"> Tính VAT vào giá vốn (khi VAT không được khấu trừ)</label>
   <div id="mhi-sum" class="note mhtot"></div>
   <h3 class="mhstep"><span>3</span>Ảnh bill, hóa đơn đỏ</h3>
   <input type="file" id="mhi-f" multiple accept="image/*,application/pdf"><div id="mhi-fl" class="hint"></div>
   <h3 class="mhstep"><span>4</span>Tiền chi</h3>
   <div class="mhpm"><label class="chk"><input type="radio" name="mhi-tt" value="no" checked> Chưa trả: ghi công nợ nhà cung cấp</label><label class="chk"><input type="radio" name="mhi-tt" value="tra"> Đã trả / trả ngay</label></div>
   <div id="mhi-tw" hidden><div class="row4"><label class="field">Ngày chi<input id="mhi-pd" type="date" value="${mhToday()}"></label><label class="field">Số tiền chi (đ)<input id="mhi-pa" type="number" min="1" placeholder="Mặc định = tổng phải trả"></label></div>${mhPayMethodHtml("mhq")}</div>
   <label class="field">Ghi chú<input id="mhi-n"></label><div id="mhi-e"></div><button class="btn pri">Ghi chứng từ</button></form>`);
  /* Chị Hoa 28/10: ghi chứng từ thì chọn luôn tiền chi, có nguồn chi (tiền mặt / tài khoản ngân hàng nào). Trả ngay = phiếu chi gắn chứng từ này (hiện ở Nhật ký chi, trừ công nợ). */
  const ttOn=()=>document.querySelector('input[name="mhi-tt"]:checked').value==="tra";
  document.querySelectorAll('input[name="mhi-tt"]').forEach(x=>x.onchange=()=>{$("#mhi-tw").hidden=!ttOn()});
  mhPayMethodBind("mhq",pre.sup||"");
  const sel=()=>[...document.querySelectorAll(".mhi-c:checked")].map(x=>x.value);
  const manualSum=()=>M.reduce((t,l)=>t+(+l.qty||0)*(+l.price||0),0);
  const rcSum=()=>{let g=0;document.querySelectorAll(".mhi-c:checked").forEach(c=>{document.querySelectorAll('.mhi-pr[data-r="'+c.value+'"]').forEach(i=>{g+=(+i.dataset.q)*(+i.value||0)})});return g};
  const sum=()=>{const g=n=>+($(n).value)||0,goods=rcSum()+manualSum(),tot=goods+g("#mhi-vat")+g("#mhi-fr")+g("#mhi-hd")+g("#mhi-ot");
    $("#mhi-sum").innerHTML=`Tiền hàng <b>${nf(Math.round(goods))}</b> + VAT ${nf(g("#mhi-vat"))} + vận chuyển ${nf(g("#mhi-fr"))} + bốc vác ${nf(g("#mhi-hd"))} + khác ${nf(g("#mhi-ot"))} = <b>Tổng phải trả ${nf(Math.round(tot))}</b>`;
    document.querySelectorAll(".mhi-lt").forEach(td=>{const i=+td.dataset.i;td.textContent=(+M[i].qty&&+M[i].price)?nf(Math.round(M[i].qty*M[i].price)):"—"});
    document.querySelectorAll(".mhi-rt").forEach(td=>{const i=document.querySelector('.mhi-pr[data-l="'+td.dataset.l+'"]');td.textContent=i&&+i.value?nf(Math.round(+i.dataset.q*+i.value)):"—"})};
  const drawM=()=>{$("#mhi-m").innerHTML=M.map((l,i)=>`<tr><td><input class="mhm-i" data-i="${i}" value="${esc(l.item)}" placeholder="Gõ mã hoặc tên hàng" autocomplete="off">${l.item?`<small class="mh-nm">${esc(mhName(l.item))}</small>`:""}</td><td><input class="mhm-q n" data-i="${i}" type="number" min="0" step="any" value="${l.qty}"></td><td><input class="mhm-p n" data-i="${i}" type="number" min="0" step="any" value="${l.price}"></td><td class="n mhi-lt" data-i="${i}">—</td><td><button type="button" class="lnk" data-mx="${i}">✕</button></td></tr>`).join("");
    document.querySelectorAll(".mhm-i").forEach(x=>khoPick(x,["NVL","CCDC","HH"],it=>{const i=+x.dataset.i;M[i].item=it.code;x.value=it.code;let sm=x.parentNode.querySelector("small");if(!sm){sm=document.createElement("small");sm.className="mh-nm";x.parentNode.appendChild(sm)}sm.textContent=it.name}));
    document.querySelectorAll(".mhm-q").forEach(x=>x.oninput=()=>{M[+x.dataset.i].qty=x.value;sum()});document.querySelectorAll(".mhm-p").forEach(x=>x.oninput=()=>{M[+x.dataset.i].price=x.value;sum()});
    document.querySelectorAll("[data-mx]").forEach(x=>x.onclick=()=>{M.splice(+x.dataset.mx,1);if(!M.length)M.push({item:"",qty:"",price:""});drawM()});sum()};
  const drawR=()=>{const sid=$("#mhi-s").value,L=pend.filter(x=>x.p.supplier_id===sid);
    $("#mhi-r").innerHTML=L.length?`<p class="hint">Hàng kho đã nhận của nhà cung cấp này, chưa có chứng từ. Tick lần nhận thuộc chứng từ và <b>điền đơn giá từng dòng</b>:</p>`+L.map(({p,r})=>`<div class="mhrc"><label class="chk"><input type="checkbox" class="mhi-c" value="${r.id}" ${(pre.rids||L.map(x=>x.r.id)).includes(r.id)?"checked":""}> <b>${esc(mhD(r.receipt_date))}</b> · phiếu mua hàng ${esc(p.no)}</label><table class="mhlines"><thead><tr><th>Hàng</th><th class="n">Số nhận</th><th class="n">Đơn giá (đ)</th><th class="n">Thành tiền</th></tr></thead><tbody>${r.lines.map(l=>{const pl=p.lines.find(x=>x.id===l.po_line_id),def=l.unit_price!=null?l.unit_price:(pl&&pl.unit_price!=null?pl.unit_price:"");return `<tr><td>${esc(l.name)}</td><td class="n">${mhN(l.qty)} ${esc(l.unit||"")}</td><td><input class="mhi-pr n" data-r="${r.id}" data-l="${l.id}" data-q="${l.qty}" type="number" min="0" step="any" value="${def}" placeholder="Giá"></td><td class="n mhi-rt" data-l="${l.id}">—</td></tr>`}).join("")}</tbody></table></div>`).join(""):"";
    $("#mhi-mh").textContent=L.length?"Hàng có trên hóa đơn nhưng chưa nhận ở trên (nếu có):":"Nhập từng dòng hàng ghi trên chứng từ: mã hàng, số lượng, đơn giá.";
    document.querySelectorAll(".mhi-c").forEach(x=>x.onchange=sum);document.querySelectorAll(".mhi-pr").forEach(x=>x.oninput=sum);sum()};
  $("#mhi-s").onchange=()=>{drawR();mhPayFillTo("mhq",$("#mhi-s").value)};mhSupPick("#mhi-s");["#mhi-vat","#mhi-fr","#mhi-hd","#mhi-ot"].forEach(i=>$(i).oninput=sum);
  $("#mhi-add").onclick=()=>{M.push({item:"",qty:"",price:""});drawM();const r=document.querySelectorAll(".mhm-i");if(r.length)r[r.length-1].focus()};
  $("#mhi-f").onchange=()=>{$("#mhi-fl").textContent=[...$("#mhi-f").files].map(f=>f.name).join(", ")};
  drawR();drawM();
  $("#mhi").onsubmit=async e=>{e.preventDefault();const g=n=>+($(n).value)||0,ids=sel(),prices={};
    if(!ids.length){$("#mhi-e").innerHTML=`<div class="note red">Hóa đơn phải gắn vào lần nhận hàng của một phiếu mua: tích ít nhất một lần nhận hàng ở bước 1. Chưa nhận hàng thì nhận hàng vào kho trước (nút Nhận hàng trong phiếu mua).</div>`;return}
    ids.forEach(rid=>document.querySelectorAll('.mhi-pr[data-r="'+rid+'"]').forEach(i=>{prices[i.dataset.l]=i.value===""?null:+i.value}));
    const ml=M.filter(l=>l.item||+l.qty||+l.price);
    if(ml.some(l=>!l.item||!(+l.qty>0)||l.price===""||!(+l.price>=0))){$("#mhi-e").innerHTML=`<div class="note red">Mỗi dòng hàng nhập thêm cần đủ mã hàng, số lượng và đơn giá (hoặc xóa dòng trống).</div>`;return}
    const tra=ttOn(),pm=tra?mhPayMethodRead("mhq"):null;
    if(tra&&pm.method==="CHUYEN_KHOAN"&&!pm.from_account){$("#mhi-e").innerHTML=`<div class="note red">Mục 4: chọn tài khoản công ty chi tiền (hoặc chọn Tiền mặt).</div>`;return}
    const btn=e.submitter||document.querySelector("#mhi button.pri");if(btn)btn.disabled=true;
    try{const r=await kApi("/mh/invoices",{method:"POST",body:JSON.stringify({supplier_id:$("#mhi-s").value,doc_type:$("#mhi-t").value,invoice_no:$("#mhi-no").value,invoice_date:$("#mhi-d").value,receipt_ids:ids,prices,manual_lines:ml.map(l=>({item:l.item,qty:+l.qty,unit_price:+l.price})),vat_amount:g("#mhi-vat"),freight:g("#mhi-fr"),handling:g("#mhi-hd"),other:g("#mhi-ot"),vat_in_cost:$("#mhi-vc").checked,note:$("#mhi-n").value})});
      const fs=[...$("#mhi-f").files];let up=0;if(fs.length)up=await mhUploadFiles(r.id,fs);
      let chi="";if(tra){try{const rc=(MH.orders||[]).flatMap(p=>p.receipts.map(x=>({p,x}))).find(z=>ids.includes(z.x.id)),tot=(r.total!=null?+r.total:null);
        const amt=+$("#mhi-pa").value||tot||Math.round(rcSum()+manualSum()+g("#mhi-vat")+g("#mhi-fr")+g("#mhi-hd")+g("#mhi-ot"));
        const pr=await kApi("/mh/payments",{method:"POST",body:JSON.stringify(Object.assign({supplier_id:$("#mhi-s").value,kind:"CHI",invoice_id:r.id,po_id:rc?rc.p.id:null,pay_date:$("#mhi-pd").value||$("#mhi-d").value,amount:amt,note:"Trả theo chứng từ "+($("#mhi-no").value||"")},pm))});
        for(const f of [...$("#mhq-f").files]){try{const x=await mhPrepFile(f);await kApi("/mh/payments/"+pr.id+"/files",{method:"POST",body:JSON.stringify(x)})}catch(er){}}
        chi=", đã ghi phiếu chi "+nf(amt)+" đ"+(pr.ceo_status==="CHO"?" (chờ chị Hoa duyệt)":"")}catch(er){chi=". Chưa ghi được phiếu chi: "+er.message+" (ghi ở nút Ghi chi / cọc)"}}
      MH.pay=null;MH.debts=null;closeDrawer();toast("Đã ghi chứng từ"+(up?", đính kèm "+up+" file":"")+chi);await mhReload();await mhLoadInv()}
    catch(err){$("#mhi-e").innerHTML=`<div class="note red">${esc(err.message)}</div>`;if(btn)btn.disabled=false}};
}
/* --- Phiếu chi --- */
async function mhLoadPay(){if(MH.pay)return;try{MH.pay=await kApi("/mh/payments")}catch(e){MH.pay=[];toast(e.message)}if(/^mh_|^(so_cp|ngan_sach|tien_lich)$/.test(PAGE))renderMain()}
function pMhChi(m){
  mhLoad();mhLoadPay();mhLoadInv();const T="Phiếu chi thanh toán",S="Thảo báo đã thanh toán, kế toán ghi phiếu chi";
  if(mhNeedAdmin(m,T,S))return;
  if(!MH.pay||!MH.sup){m.innerHTML=H(T,S)+`<p class="hint pad">Đang tải…</p>`;return}
  m.innerHTML=H(T,S)+mhGuide("mh_chi")+`<div class="filters"><span class="sp"></span><button class="btn pri" id="mhc-new">+ Ghi phiếu chi</button></div>
  <section class="card flush">${gdTbl(["Ngày chi","Loại","Nhà cung cấp","Liên quan","Số tiền","Tài khoản / hình thức","Ghi chú","Trạng thái",""],gdCat(MH.pay,MH.pgChi||(MH.pgChi={co:gdCoNho("mhchi",100),trang:1})).map(p=>`<tr class="clk ${p.status==="OK"?"":"mut"}" data-pv="${p.id}"><td>${esc(mhD(p.pay_date))}</td><td>${p.kind==="COC"?pill("Cọc","amb"):"Trả tiền"}</td><td class="gdd">${esc(p.supplier_name)}</td><td class="gdd">${[...(typeof scDonCuaPay==="function"?scDonCuaPay(p):(MH.orders||[]).filter(o=>o.id===p.po_id)).map(mhLqPo),...(MH.inv||[]).filter(v=>v.id===p.invoice_id).map(mhLqHv)].join(" ")||`<span class="hint">${esc(p.invoice_no||p.po_no||"—")}</span>`}</td><td class="n"><b>${nf(p.amount)}</b></td><td class="gdd" title="${esc(p.account||"")}">${esc(p.account||"")}${p.file_count?" "+pill(p.file_count+" ảnh","blu"):""}</td><td class="gdd" title="${esc(p.note||"")}">${esc(p.note||"")}</td><td>${p.status==="OK"?(p.ceo_status==="CHO"?pill("Chờ CEO duyệt","amb"):pill("Đã ghi","grn")):pill("Đã hủy","gry")}</td><td>${p.status==="OK"?`<button class="btn sm danger" data-px="${p.id}">Hủy phiếu chi</button>`:""}</td></tr>`))}${gdChan(`<span>Cộng <b>${MH.pay.length}</b> phiếu chi: <b>${nf(MH.pay.filter(x=>x.status==="OK").reduce((s,x)=>s+(+x.amount||0),0))}</b> đ</span>`,MH.pay.length,MH.pgChi,"mhchi")}</section>`;
  gdCss();mhLqBind(m);gdChanBind(m,"mhchi",MH.pgChi,renderMain);
  $("#mhc-new").onclick=()=>mhPayForm();
  m.querySelectorAll("[data-pv]").forEach(r=>r.onclick=e=>{if(e.target.closest("button"))return;mhPayDetail(r.dataset.pv)});
  m.querySelectorAll("[data-px]").forEach(b=>b.onclick=async()=>{if(!confirm("Hủy phiếu chi này? Công nợ nhà cung cấp tăng lại đúng số tiền."))return;
    try{await kApi("/mh/payments/"+b.dataset.px+"/cancel",{method:"POST",body:"{}"});toast("Đã hủy phiếu chi");MH.pay=null;MH.inv=null;MH.debts=null;await mhLoadPay();await mhLoadInv()}catch(err){toast(err.message)}});
}
/* Hình thức chi: chuyển khoản (chi từ tài khoản công ty nào, đến ngân hàng / số tài khoản / tên chủ tài khoản nào) hoặc tiền mặt (ai nhận).
   Tài khoản công ty lấy từ danh sách tài khoản của công ty (Cấu hình). Dùng chung cho phiếu chi nhà cung cấp. */
async function mhAccts(){if(MH.accts)return MH.accts;try{MH.accts=(await svApi("/api/receiving-accounts")).filter(a=>a.active)}catch(e){MH.accts=[]}return MH.accts}
const mhAcctLabel=a=>[a.bank,a.account_no,a.account_name].filter(Boolean).join(" · ");
function mhPayMethodHtml(k){return `<h3>Hình thức chi</h3><div class="mhpm" id="${k}-mw"><label class="chk"><input type="radio" name="${k}-m" value="CHUYEN_KHOAN" checked> Chuyển khoản</label><label class="chk"><input type="radio" name="${k}-m" value="TIEN_MAT"> Tiền mặt</label></div>
   <div id="${k}-ck"><label class="field">Chi từ tài khoản công ty<select id="${k}-from"><option value="">Đang tải tài khoản…</option></select></label><label class="field" id="${k}-fxw" hidden>Ghi tài khoản chi<input id="${k}-fx" placeholder="Ngân hàng · số tài khoản"></label>
    <div class="row4"><label class="field">Ngân hàng nhận<input id="${k}-tb" placeholder="Ví dụ: ACB"></label><label class="field">Số tài khoản nhận<input id="${k}-tn"></label><label class="field grow">Tên chủ tài khoản nhận<input id="${k}-ta"></label></div></div>
   <div id="${k}-tm" hidden><label class="field">Người nhận tiền mặt<input id="${k}-rc" placeholder="Họ tên người nhận"></label></div>
   <label class="field">Ảnh bill chuyển khoản / ảnh phiếu chi tiền mặt có chữ ký<input type="file" id="${k}-f" multiple accept="image/*,application/pdf"></label>`}
function mhPayFillTo(k,sid){const s=(MH.sup||[]).find(x=>x.id===sid);if(!s)return;$("#"+k+"-tb").value=s.bank||"";$("#"+k+"-tn").value=s.bank_account_no||"";$("#"+k+"-ta").value=s.bank_account_name||s.name||""}
function mhPayMethodBind(k,sid){
  const sw=()=>{const ck=document.querySelector(`input[name="${k}-m"]:checked`).value==="CHUYEN_KHOAN";$("#"+k+"-ck").hidden=!ck;$("#"+k+"-tm").hidden=ck};
  document.querySelectorAll(`input[name="${k}-m"]`).forEach(x=>x.onchange=sw);sw();
  mhAccts().then(A=>{const sel=$("#"+k+"-from");if(!sel)return;sel.innerHTML=(A.length?"":`<option value="">— Chưa có tài khoản công ty nào (thêm ở Cấu hình) —</option>`)+A.map(a=>`<option>${esc(mhAcctLabel(a))}</option>`).join("")+`<option value="__x">Tài khoản khác…</option>`;
    sel.onchange=()=>{$("#"+k+"-fxw").hidden=sel.value!=="__x"}});
  if(sid)mhPayFillTo(k,sid)}
function mhPayMethodRead(k){const m=document.querySelector(`input[name="${k}-m"]:checked`).value,v=id=>($("#"+k+"-"+id).value||"").trim();
  return m==="TIEN_MAT"?{method:m,receiver:v("rc")}:{method:m,from_account:v("from")==="__x"?v("fx"):v("from"),to_bank:v("tb"),to_account_no:v("tn"),to_account_name:v("ta")}}
const mhPayFileUrl=(pid,f)=>"/api/hub/kho/mh/payments/"+pid+"/files/"+f;
/* Mở một đơn mua ở trang Mua hàng (từ Nhật ký chi, phiếu chi, thẻ tài sản). */
function mhMoDon(id){closeDrawer();PAGE="mh_po";MH.open=id;MH.st="";try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}render();scrollTo(0,0)}
/* Ô "Đơn mua" tóm tắt: số đơn, NCC, hàng × số lượng, bấm để mở đơn. */
const mhDonTomTat=L=>L.length?`<div class="note"><b>Đơn mua:</b> ${L.map(p=>`<button type="button" class="lnk" data-mhgo="${esc(p.id)}">${esc(p.no)} · ${esc(p.supplier_name||"")}</button>${(p.lines||[]).length?` <span class="hint">(${p.lines.map(l=>esc(l.name||l.item)+" × "+nf(+l.qty||0)).join(", ")})</span>`:""}`).join("<br>")}</div>`:"";
const mhDonWire=()=>document.querySelectorAll("[data-mhgo]").forEach(b=>b.onclick=()=>mhMoDon(b.dataset.mhgo));
/* Xem một phiếu chi: hình thức, tài khoản, ảnh bill (thêm, xóa được). */
async function mhPayDetail(id){
  const x=(MH.pay||[]).find(p=>p.id===id);if(!x)return;let files=[];try{files=await kApi("/mh/payments/"+id+"/files")}catch(e){toast(e.message)}
  const ck=x.method==="CHUYEN_KHOAN",tm=x.method==="TIEN_MAT";
  openDrawerHTML(`<h2>Phiếu chi ${nf(x.amount)} đ · ${esc(x.supplier_name)}</h2><p class="hint">Ngày ${esc(mhD(x.pay_date))} · ${x.kind==="COC"?"Tiền cọc":"Trả tiền"}${x.invoice_no?" · chứng từ "+esc(x.invoice_no):""}${x.po_no?" · phiếu mua "+esc(x.po_no):""}${x.status!=="OK"?" · "+pill("Đã hủy","gry"):""}</p>
   ${mhDonTomTat(typeof scDonCuaPay==="function"?scDonCuaPay(x):(MH.orders||[]).filter(p=>p.id===x.po_id))}
   <div class="mhinfo mhpay"><div><span>Hình thức</span><b>${ck?"Chuyển khoản":tm?"Tiền mặt":"—"}</b></div>${ck?`<div><span>Chi từ tài khoản</span><b>${esc(x.from_account)}</b></div><div><span>Chuyển đến</span><b>${esc([x.to_bank,x.to_account_no].filter(Boolean).join(" · "))}</b><small>${esc(x.to_account_name||"")}</small></div>`:tm?`<div><span>Người nhận</span><b>${esc(x.receiver||"—")}</b></div>`:`<div><span>Ghi chú cũ</span><b>${esc(x.account||"—")}</b></div>`}</div>
   ${x.note?`<p>Ghi chú: ${esc(x.note)}</p>`:""}
   <h3>Ảnh bill / phiếu chi</h3><div class="mhfiles">${files.length?files.map(f=>f.mime==="application/pdf"?`<div class="mhfile"><a href="${mhPayFileUrl(id,f.id)}" target="_blank" rel="noopener">📄 ${esc(f.name||"file.pdf")}</a><button type="button" class="lnk" data-pfd="${f.id}">Xóa</button></div>`:`<div class="mhfile"><a href="${mhPayFileUrl(id,f.id)}" target="_blank" rel="noopener"><img src="${mhPayFileUrl(id,f.id)}" alt="${esc(f.name)}"></a><button type="button" class="lnk" data-pfd="${f.id}">Xóa</button></div>`).join(""):`<p class="hint">Chưa có ảnh nào.</p>`}</div>
   <label class="field">Thêm ảnh bill chuyển khoản / phiếu chi tiền mặt<input type="file" id="mhpd-f" multiple accept="image/*,application/pdf"></label><button class="btn" id="mhpd-up">Tải lên</button>`);
  mhDonWire();
  document.querySelectorAll("[data-pfd]").forEach(b=>b.onclick=async()=>{if(!confirm("Xóa ảnh này?"))return;try{await kApi("/mh/payments/"+id+"/files/"+b.dataset.pfd,{method:"DELETE"});MH.pay=null;await mhLoadPay();mhPayDetail(id)}catch(e){toast(e.message)}});
  $("#mhpd-up").onclick=async()=>{const fs=[...$("#mhpd-f").files];if(!fs.length)return;$("#mhpd-up").disabled=true;let n=0;for(const f of fs){try{const d=await mhPrepFile(f);await kApi("/mh/payments/"+id+"/files",{method:"POST",body:JSON.stringify(d)});n++}catch(e){toast(e.message)}}if(n)toast("Đã tải lên "+n+" ảnh");MH.pay=null;await mhLoadPay();mhPayDetail(id)};
}
/* Tất cả phiếu chi của một nhà cung cấp (kể cả phiếu không gắn được vào phiếu mua nào): xem, sửa, hủy. */
async function mhSupPays(sid){
  await mhLoadPay();await mhLoadInv();
  const S=(MH.sup||[]).find(x=>x.id===sid)||{name:""},ALLP=(MH.pay||[]).filter(x=>x.supplier_id===sid),L=ALLP.filter(x=>x.po_id||x.status!=="OK"),LOOSE=ALLP.filter(x=>!x.po_id&&x.status==="OK"),ALLV=(MH.inv||[]).filter(x=>x.supplier_id===sid&&x.status==="OK"),V=ALLV.filter(v=>(v.receipt_ids||[]).length),VLOOSE=ALLV.filter(v=>!(v.receipt_ids||[]).length);
  const looseHtml=(LOOSE.length||VLOOSE.length)?`<div class="note amb" style="margin-top:14px"><b>Chưa gắn phiếu mua</b> (${LOOSE.length+VLOOSE.length} khoản): vẫn tính vào công nợ nhưng chưa thuộc phiếu mua nào. Phiếu chi thì bấm <b>Sửa</b> để gắn vào đúng phiếu mua (hoặc để "trả nợ chung" nếu là nợ cũ). Hóa đơn lạc thì bấm Hủy.${LOOSE.length?tbl(["Ngày chi","Loại","Số tiền","Ghi chú",""],LOOSE.map(x=>`<tr><td>${esc(mhD(x.pay_date))}</td><td>${x.kind==="COC"?pill("Cọc","amb"):"Trả tiền"}</td><td class="n"><b>${nf(x.amount)}</b></td><td>${esc(x.note||"")}</td><td class="nowrap"><button class="btn sm" data-spe="${x.id}">Gắn / sửa</button> <button class="btn sm danger" data-spx="${x.id}">Hủy</button></td></tr>`)):""}${VLOOSE.length?tbl(["Ngày","Chứng từ","Tổng",""],VLOOSE.map(v=>`<tr><td>${esc(mhD(v.invoice_date))}</td><td>${v.doc_type==="PG"?"Phiếu giao / bill":"Hóa đơn"} ${esc(v.invoice_no||"(không số)")}</td><td class="n"><b>${nf(v.total)}</b></td><td class="nowrap"><button class="btn sm danger" data-sxv="${v.id}">Hủy chứng từ</button></td></tr>`)):""}</div>`:"";
  const invHtml=`<h3 style="margin-top:14px">Chứng từ (hóa đơn, phiếu giao) đang tính vào công nợ</h3>${V.length?tbl(["Ngày","Chứng từ","Tổng","Đã chi",""],V.map(v=>`<tr><td>${esc(mhD(v.invoice_date))}</td><td>${v.doc_type==="PG"?"Phiếu giao / bill":"Hóa đơn"} ${esc(v.invoice_no||"(không số)")}</td><td class="n"><b>${nf(v.total)}</b></td><td class="n">${nf(v.paid||0)}</td><td class="nowrap"><button class="btn sm danger" data-sxv="${v.id}">Hủy chứng từ</button></td></tr>`)):`<p class="hint">Không có chứng từ nào.</p>`}<p class="hint">Hủy chứng từ thì công nợ giảm đúng số tiền của chứng từ đó. Chứng từ đã có phiếu chi gắn vào thì phải hủy hoặc sửa phiếu chi trước.</p>`;
  openDrawerHTML(`<h2>Phiếu chi và chứng từ · ${esc(S.name)}</h2><p class="hint">Phiếu đã hủy không tính vào công nợ. Ghi nhầm thì bấm Sửa, hoặc Hủy rồi ghi lại.</p>
   <h3>Phiếu chi</h3>${L.length?tbl(["Ngày chi","Loại","Số tiền","Gắn với","Ghi chú","Trạng thái",""],L.map(x=>`<tr class="${x.status==="OK"?"":"mut"}"><td>${esc(mhD(x.pay_date))}</td><td>${x.kind==="COC"?pill("Cọc","amb"):"Trả tiền"}</td><td class="n"><b>${nf(x.amount)}</b></td><td>${esc([x.po_no,x.invoice_no].filter(Boolean).join(" · ")||"—")}</td><td>${esc(x.note||"")}</td><td>${x.status==="OK"?pill("Đang tính","grn"):pill("Đã hủy","gry")}</td><td class="nowrap">${x.status==="OK"?`<button class="btn sm" data-spe="${x.id}">Sửa</button> <button class="btn sm danger" data-spx="${x.id}">Hủy</button>`:""}</td></tr>`)):`<p class="hint">Chưa có phiếu chi nào.</p>`}${invHtml}${looseHtml}`);
  document.querySelectorAll("[data-sxv]").forEach(b=>b.onclick=async()=>{if(!confirm("Hủy chứng từ này? Công nợ nhà cung cấp giảm lại đúng số tiền của chứng từ."))return;
    try{await kApi("/mh/invoices/"+b.dataset.sxv+"/cancel",{method:"POST",body:"{}"});toast("Đã hủy chứng từ");await mhReload();await mhLoadPay();await mhLoadInv();mhSupPays(sid)}catch(err){toast(err.message)}});
  document.querySelectorAll("[data-spe]").forEach(b=>b.onclick=()=>mhPayEdit(b.dataset.spe));
  document.querySelectorAll("[data-spx]").forEach(b=>b.onclick=async()=>{if(!confirm("Hủy phiếu chi này? Công nợ nhà cung cấp tăng lại đúng số tiền."))return;
    try{await kApi("/mh/payments/"+b.dataset.spx+"/cancel",{method:"POST",body:"{}"});toast("Đã hủy phiếu chi");await mhReload();await mhLoadPay();mhSupPays(sid)}catch(err){toast(err.message)}});
}
/* Tổng tiền và số còn phải trả của một phiếu mua, bỏ phần phiếu chi x đang sửa (nếu x đang gắn vào phiếu đó). */
function mhPeOpt(p,x){
  const M=mhPoMoney(p),tot=M.invTotal||mhValue(p)||0;
  const mine=x.po_id===p.id?(+x.amount||0):0,due=Math.max(0,tot-(M.paid-mine));
  return {tot,due,match:tot>0&&Math.abs(due-(+x.amount||0))<1?1:0}}
/* Sửa phiếu chi: ngày, số tiền, loại (cọc / trả tiền), ghi chú, phiếu mua gắn kèm. Không phải hủy rồi ghi lại, nên không bị tính hai lần. */
function mhPayEdit(id){
  const x=(MH.pay||[]).find(p=>p.id===id);if(!x)return;
  // Mỗi phiếu mua hiện tổng tiền và số còn phải trả (không tính chính phiếu chi đang sửa), phiếu khớp số tiền xếp lên đầu.
  const pos=(MH.orders||[]).filter(p=>p.supplier_id===x.supplier_id&&p.status!=="HUY")
    .sort((a,b)=>(mhPeOpt(b,x).match-mhPeOpt(a,x).match)||String(b.order_date||"").localeCompare(String(a.order_date||"")));
  openDrawerHTML(`<h2>Sửa phiếu chi · ${esc(x.supplier_name)}</h2><p class="hint">Sửa trực tiếp, công nợ tự tính lại đúng số mới. Lịch sử sửa được ghi lại.</p><form class="frm" id="mhpe"><div class="row4"><label class="field">Loại<select id="mhpe-k"><option value="CHI">Trả tiền (thanh toán)</option><option value="COC">Cọc / trả trước khi đặt hàng</option></select></label><label class="field">Ngày chi<input id="mhpe-d" type="date" value="${esc(x.pay_date)}" required></label><label class="field">Số tiền (đ)<input id="mhpe-a" type="number" min="1" value="${x.amount}" required></label></div>
   <label class="field">Gắn vào phiếu mua<select id="mhpe-o"><option value="">— Không gắn: trả nợ chung / nợ cũ —</option>${pos.map(p=>{const o=mhPeOpt(p,x);return `<option value="${p.id}">${o.match?"✓ ":""}${esc(p.no)} · ${esc(mhD(p.order_date))} · tổng ${o.tot?nf(Math.round(o.tot)):"chưa có giá"} · còn phải trả ${nf(Math.round(o.due))}${o.match?" (khớp số tiền)":""}</option>`}).join("")}</select></label><p class="hint">Dấu ✓ là phiếu mua có số còn phải trả đúng bằng số tiền phiếu chi này.</p><label class="field">Ghi chú<input id="mhpe-n" value="${esc(x.note||"")}"></label><div id="mhpe-e"></div><button class="btn pri">Lưu</button></form>`);
  $("#mhpe-k").value=x.kind==="COC"?"COC":"CHI";$("#mhpe-o").value=x.po_id||"";
  $("#mhpe").onsubmit=async e=>{e.preventDefault();try{await kApi("/mh/payments/"+id,{method:"PUT",body:JSON.stringify({kind:$("#mhpe-k").value,pay_date:$("#mhpe-d").value,amount:+$("#mhpe-a").value,po_id:$("#mhpe-o").value||null,note:$("#mhpe-n").value})});closeDrawer();toast("Đã sửa phiếu chi");MH.pay=null;MH.inv=null;MH.debts=null;await mhReload()}catch(err){$("#mhpe-e").innerHTML=`<div class="note red">${esc(err.message)}</div>`}}}
function mhPayForm(supId,poId){
  openDrawerHTML(`<h2>Ghi phiếu chi thanh toán</h2><form class="frm" id="mhp"><div class="row4"><label class="field grow">Nhà cung cấp<select id="mhp-s">${mhSupOpts(supId||"")}</select></label><label class="field">Loại<select id="mhp-k"><option value="CHI">Trả tiền (thanh toán)</option><option value="COC">Cọc / trả trước khi đặt hàng</option></select></label></div>
   <div class="row4"><label class="field">Ngày chi<input id="mhp-d" type="date" value="${mhToday()}" required></label><label class="field">Số tiền (đ)<input id="mhp-a" type="number" min="1" required></label></div>
   <label class="field" id="mhp-iw"${poId?" hidden":""}>Gắn vào hóa đơn (không bắt buộc)<select id="mhp-i"><option value="">— Không gắn —</option></select></label>
   <label class="field" id="mhp-ow"${poId?" hidden":""}>Gắn vào phiếu mua<select id="mhp-o"><option value="">— Chọn phiếu mua —</option></select></label>
   <label class="chk" id="mhp-gw"${poId?" hidden":""}><input type="checkbox" id="mhp-g"> Trả nợ chung (khoản nợ cũ, không thuộc phiếu mua nào)</label>
   ${poId?`<p class="hint">Phiếu chi tự gắn vào phiếu mua này.</p>`:""}${mhPayMethodHtml("mhp")}<label class="field">Ghi chú<input id="mhp-n"></label><div id="mhp-e"></div><button class="btn pri">Ghi phiếu chi</button></form>`);
  const fill=()=>{const sid=$("#mhp-s").value;$("#mhp-i").innerHTML=`<option value="">— Không gắn, trừ vào công nợ chung —</option>`+(MH.inv||[]).filter(v=>v.status==="OK"&&v.supplier_id===sid&&v.total>v.paid).map(v=>`<option value="${v.id}">${esc(mhD(v.invoice_date))} · ${esc(v.invoice_no||"không số")} · còn ${nf(v.total-v.paid)}</option>`).join("");
    $("#mhp-o").innerHTML=`<option value="">— Chọn phiếu mua —</option>`+(MH.orders||[]).filter(p=>p.supplier_id===sid&&p.status!=="HUY").map(p=>`<option value="${p.id}">${esc(p.no)} · ${esc(mhD(p.order_date))}${p.status==="DU"?" · đã đủ hàng":""}</option>`).join("")};
  $("#mhp-s").onchange=()=>{fill();mhPayFillTo("mhp",$("#mhp-s").value)};fill();mhPayMethodBind("mhp",$("#mhp-s").value);mhSupPick("#mhp-s");
  if(poId){const p=(MH.orders||[]).find(x=>x.id===poId);$("#mhp-o").value=poId;if(p){const open=mhPoMoney(p).inv.filter(v=>v.total>v.paid);if(open.length===1){$("#mhp-i").value=open[0].id;$("#mhp-a").value=open[0].total-open[0].paid}else if(!open.length)$("#mhp-k").value="COC"}}
  $("#mhp").onsubmit=async e=>{e.preventDefault();
    const pm=mhPayMethodRead("mhp");if(pm.method==="CHUYEN_KHOAN"&&(!pm.from_account||!pm.to_account_no)){$("#mhp-e").innerHTML=`<div class="note red">Chuyển khoản: chọn tài khoản công ty chi tiền và ghi số tài khoản nhận.</div>`;return}
    if(!$("#mhp-o").value&&!$("#mhp-i").value&&!$("#mhp-g").checked){$("#mhp-e").innerHTML=`<div class="note red">Chọn phiếu mua cho khoản chi này, hoặc tích "Trả nợ chung" nếu là nợ cũ.</div>`;return}
    const dupP=(MH.pay||[]).find(p=>p.status==="OK"&&p.supplier_id===$("#mhp-s").value&&p.amount===+$("#mhp-a").value&&(p.po_id||"")===($("#mhp-o").value||""));
    if(dupP&&!confirm("Đã có phiếu chi "+nf(dupP.amount)+" đ cho nhà cung cấp này"+(dupP.po_no?" (phiếu mua "+dupP.po_no+")":"")+" ngày "+mhD(dupP.pay_date)+". Ghi thêm phiếu nữa thì công nợ tính cả hai. Nếu chỉ muốn sửa phiếu cũ thì bấm Hủy rồi bấm Sửa ở lịch sử thanh toán. Vẫn ghi thêm?"))return;
    const btn=e.submitter||document.querySelector("#mhp button.pri");if(btn)btn.disabled=true;
    try{const r=await kApi("/mh/payments",{method:"POST",body:JSON.stringify(Object.assign({supplier_id:$("#mhp-s").value,kind:$("#mhp-k").value,po_id:$("#mhp-o").value||null,invoice_id:$("#mhp-i").value||null,pay_date:$("#mhp-d").value,amount:+$("#mhp-a").value,note:$("#mhp-n").value,general:$("#mhp-g").checked},mhPayMethodRead("mhp")))});
      const fs=[...$("#mhp-f").files];let up=0;for(const f of fs){try{const x=await mhPrepFile(f);await kApi("/mh/payments/"+r.id+"/files",{method:"POST",body:JSON.stringify(x)});up++}catch(er){toast(er.message)}}
      closeDrawer();toast("Đã ghi phiếu chi"+(up?", đính kèm "+up+" ảnh":"")+(r.ceo_status==="CHO"?". Khoản từ ngưỡng chi: chờ chị Hoa duyệt":""));MH.pay=null;MH.inv=null;MH.debts=null;if(PAGE==="mh_chi"){mhLoadPay();mhLoadInv()}else renderMain()}catch(err){$("#mhp-e").innerHTML=`<div class="note red">${esc(err.message)}</div>`;if(btn)btn.disabled=false}};
}
/* Sửa nhà cung cấp: tên, điện thoại, điều khoản thanh toán, tài khoản ngân hàng nhận tiền (điền sẵn khi ghi phiếu chi). */
function mhSupEdit(id){
  const s=(MH.sup||[]).find(x=>x.id===id);if(!s)return;
  openDrawerHTML(`<h2>Sửa nhà cung cấp</h2><form class="frm" id="mhse"><label class="field">Tên<input id="mhse-n" value="${esc(s.name)}" required maxlength="120"></label><label class="field">Điện thoại<input id="mhse-p" value="${esc(s.phone||"")}" maxlength="40"></label>
   <label class="field">Điều khoản thanh toán<select id="mhse-t"><option value="">— Chưa ghi —</option><option value="TRUOC">Chuyển khoản trước khi giao</option><option value="SAU_NHAN">Chuyển khoản sau khi nhận hàng</option><option value="CONG_NO">Công nợ (trả sau N ngày)</option></select></label><label class="field" id="mhse-dw" hidden>Số ngày công nợ<input id="mhse-dd" type="number" min="0" value="${+s.pay_days||30}"></label>
   <h3>Tài khoản ngân hàng nhận tiền</h3><div class="row4"><label class="field">Ngân hàng<input id="mhse-b" value="${esc(s.bank||"")}"></label><label class="field">Số tài khoản<input id="mhse-a" value="${esc(s.bank_account_no||"")}"></label><label class="field grow">Tên chủ tài khoản<input id="mhse-o" value="${esc(s.bank_account_name||"")}"></label></div>
   <div id="mhse-e"></div><button class="btn pri">Lưu</button></form>`);
  $("#mhse-t").value=s.pay_terms||"";const sw=()=>{$("#mhse-dw").hidden=$("#mhse-t").value!=="CONG_NO"};sw();$("#mhse-t").onchange=sw;
  $("#mhse").onsubmit=async e=>{e.preventDefault();try{await kApi("/mh/suppliers/"+id,{method:"PUT",body:JSON.stringify({name:$("#mhse-n").value,phone:$("#mhse-p").value,pay_terms:$("#mhse-t").value,pay_days:+$("#mhse-dd").value||0,bank:$("#mhse-b").value,bank_account_no:$("#mhse-a").value,bank_account_name:$("#mhse-o").value})});closeDrawer();toast("Đã lưu nhà cung cấp");MH.debts=null;await mhReload()}catch(err){$("#mhse-e").innerHTML=`<div class="note red">${esc(err.message)}</div>`}};
}
/* --- Công nợ nhà cung cấp --- */
async function mhLoadDebt(){if(MH.debts)return;try{MH.debts=await kApi("/mh/debts")}catch(e){MH.debts=[];toast(e.message)}if(/^mh_(no|po)$/.test(PAGE))renderMain()}
function pMhNo(m){
  mhLoad();mhLoadDebt();const T="Công nợ nhà cung cấp",S="Đầu kỳ + hóa đơn + phiếu mua chưa có chứng từ − đã chi";
  if(mhNeedAdmin(m,T,S))return;
  if(!MH.debts){m.innerHTML=H(T,S)+`<p class="hint pad">Đang tải…</p>`;return}
  const D0=MH.debts,tot=k=>sum(D0,x=>x[k]);
  m.innerHTML=H(T,S)+mhGuide("mh_no")+`<div class="grid kpis">${kpi("Tổng còn nợ nhà cung cấp",tr(tot("balance")),D0.filter(x=>x.balance>0).length+" nhà cung cấp còn nợ")}${kpi("Công nợ đầu kỳ",tr(tot("opening_debt")),"")}${kpi("Hóa đơn phát sinh",tr(tot("invoiced")),"")}${kpi("Phiếu mua chưa có chứng từ",tr(tot("po_pending")),"tính theo giá đặt")}${kpi("Đã chi",tr(tot("paid")),"")}</div>
  <div class="filters"><span class="sp"></span><button class="btn" id="mhn-ct">+ Ghi chứng từ</button><button class="btn" id="mhn-pc">+ Ghi phiếu chi</button><button class="btn pri" id="mhn-ns">+ Thêm nhà cung cấp (kèm công nợ đầu kỳ)</button></div>
  <section class="card flush">${gdTbl(["Nhà cung cấp","Công nợ đầu kỳ","Ngày chốt","Hóa đơn phát sinh","Phiếu mua chưa có chứng từ","Đã chi","Còn nợ",""],D0.map(d=>`<tr><td class="gdd" title="${esc(mhTermTxt((MH.sup||[]).find(s=>s.id===d.id)||{}))}"><b>${esc(d.name)}</b></td><td class="n">${nf(d.opening_debt)}</td><td>${esc(mhD(d.opening_date)||"chưa đặt")}</td><td class="n">${nf(d.invoiced)}</td><td class="n">${nf(d.po_pending||0)}</td><td class="n">${nf(d.paid)}</td><td class="n"><b style="${d.balance>0?"color:#b42318":""}">${nf(d.balance)}</b></td><td class="nowrap"><button class="btn sm" data-pl="${d.id}">Phiếu chi & chứng từ</button> <button class="btn sm" data-ld="${d.id}">Sổ chi tiết</button> <button class="btn sm" data-od="${d.id}">Đặt đầu kỳ</button> <button class="btn sm" data-se="${d.id}">Sửa</button> <button class="btn sm" data-pd="${d.id}">Ghi chi</button></td></tr>`).concat(D0.length?[`<tr class="tot"><td><b>Tổng</b></td><td class="n">${nf(tot("opening_debt"))}</td><td></td><td class="n">${nf(tot("invoiced"))}</td><td class="n">${nf(tot("paid"))}</td><td class="n"><b>${nf(tot("balance"))}</b></td><td></td></tr>`]:[]))}
   <p class="hint pad">Chưa có nhà cung cấp nào thì bấm <b>+ Thêm nhà cung cấp</b>: nhập tên và số đang nợ tại ngày bắt đầu dùng web. Nhà cung cấp đã có thì bấm <b>Đặt đầu kỳ</b> ở cuối dòng để sửa. Chứng từ và phiếu chi từ sau ngày chốt mới được cộng trừ vào.</p></section>`;
  gdCss();
  m.querySelectorAll("[data-se]").forEach(b=>b.onclick=()=>mhSupEdit(b.dataset.se));
  m.querySelectorAll("[data-pl]").forEach(b=>b.onclick=()=>mhSupPays(b.dataset.pl));
  $("#mhn-ct").onclick=()=>{mhLoadInv();mhDocForm()};$("#mhn-pc").onclick=()=>{mhLoadInv();mhPayForm()};
  $("#mhn-ns").onclick=()=>mhNewSupplier(()=>{MH.debts=null;mhLoadDebt()},{debt:true});
  m.querySelectorAll("[data-pd]").forEach(b=>b.onclick=()=>{mhLoadInv();mhPayForm(b.dataset.pd)});
  m.querySelectorAll("[data-od]").forEach(b=>b.onclick=()=>{const d=D0.find(x=>x.id===b.dataset.od);if(!d)return;
    openDrawerHTML(`<h2>Công nợ đầu kỳ · ${esc(d.name)}</h2><form class="frm" id="mho"><label class="field">Số tiền đang nợ nhà cung cấp tại ngày chốt (đ)<input id="mho-a" type="number" value="${d.opening_debt}" required></label><label class="field">Ngày chốt<input id="mho-d" type="date" value="${d.opening_date||mhToday()}" required></label><div id="mho-e"></div><button class="btn pri">Lưu</button></form>`);
    $("#mho").onsubmit=async e=>{e.preventDefault();try{await kApi("/mh/suppliers/"+d.id+"/opening",{method:"PUT",body:JSON.stringify({opening_debt:+$("#mho-a").value,opening_date:$("#mho-d").value})});closeDrawer();toast("Đã lưu công nợ đầu kỳ");MH.debts=null;await mhLoadDebt()}catch(err){$("#mho-e").innerHTML=`<div class="note red">${esc(err.message)}</div>`}}});
  m.querySelectorAll("[data-ld]").forEach(b=>b.onclick=async()=>{try{const r=await kApi("/mh/suppliers/"+b.dataset.ld+"/ledger"),s=r.supplier;
    openDrawerHTML(`<h2>Sổ công nợ · ${esc(s.name)}</h2><p class="hint">Đầu kỳ ${nf(s.opening_debt)} ${s.opening_date?"(chốt "+esc(mhD(s.opening_date))+")":""}</p>${r.entries.length?tbl(["Ngày","Nội dung","Số / hình thức","Phát sinh","Còn nợ"],r.entries.map(e=>`<tr><td>${esc(mhD(e.date))}</td><td>${esc(e.kind)}</td><td>${esc(e.ref||"")}</td><td class="n">${e.delta<0?`−${nf(-e.delta)}`:"+"+nf(e.delta)}</td><td class="n"><b>${nf(e.balance)}</b></td></tr>`)):`<p class="hint">Chưa có phát sinh sau ngày chốt.</p>`}`)}catch(err){toast(err.message)}});
}
/* --- Giá nguyên vật liệu theo tháng --- */
async function mhLoadPrices(){const mo=MH.pmonth||MONTH.key;if(MH.prices&&MH.prices.month===mo)return;try{MH.prices=await kApi("/mh/material-prices?month="+mo)}catch(e){MH.prices={month:mo,rows:[]};toast(e.message)}if(PAGE==="mh_gianvl")renderMain()}
function pMhGiaNvl(m){
  mhLoadPrices();const T="Giá nguyên vật liệu theo tháng",S="Bình quân gia quyền, có tính tồn đầu tháng";mhLoad();
  if(mhNeedAdmin(m,T,S))return;
  const mo=MH.pmonth||MONTH.key;
  m.innerHTML=H(T,S)+mhGuide("mh_gianvl")+`<div class="filters"><label class="field" style="margin:0">Tháng <input type="month" id="mhv-m" value="${mo}"></label><span class="hint">Giá nhập đã gồm phí vận chuyển, bốc vác (và VAT nếu hóa đơn chọn tính vào giá vốn)</span></div>
  <section class="card flush">${!MH.prices||MH.prices.month!==mo?`<p class="hint pad">Đang tải…</p>`:MH.prices.rows.length?tbl(["Nguyên vật liệu","Tồn đầu tháng","Giá tồn đầu (đ)","Nhập trong tháng","Giá nhập tháng (đ)","Giá bình quân cuối tháng (đ)","Giá nhập gần nhất (đ)"],MH.prices.rows.map(r=>`<tr><td><b>${esc(r.name)}</b><br><small class="mono">${esc(r.item)}</small></td><td class="n">${mhN(r.open_qty)} ${esc(r.unit)}</td><td class="n">${r.open_qty?nf(Math.round(r.open_price)):"—"}</td><td class="n">${r.in_qty?mhN(r.in_qty)+" "+esc(r.unit):"—"}</td><td class="n">${r.in_qty?nf(Math.round(r.in_price)):"—"}</td><td class="n"><b>${nf(Math.round(r.avg_price))}</b></td><td class="n">${nf(Math.round(r.last_price))}</td></tr>`)):`<p class="hint pad">Tháng này chưa có nguyên vật liệu nào có giá nhập.</p>`}</section>`;
  $("#mhv-m").onchange=e=>{MH.pmonth=e.target.value;MH.prices=null;renderMain()};
}
/* Trạng thái gộp của một phiếu mua (trang quản trị). */
/* Phiếu còn dòng chưa có giá (thường là phiếu tự tạo khi kho nhận hàng không có phiếu đặt). */
const mhNoPrice=p=>p.status!=="HUY"&&p.lines.some(l=>"unit_price" in l&&l.unit_price==null);
/* Điều khoản thanh toán của nhà cung cấp: chuyển khoản TRƯỚC khi giao, SAU khi nhận hàng, hoặc công nợ N ngày. */
const mhTermOf=p=>(MH.sup||[]).find(s=>s.id===p.supplier_id)||{};
function mhTermTxt(s){const t=s.pay_terms;return t==="TRUOC"?"Chuyển khoản trước khi giao":t==="SAU_NHAN"?"Chuyển khoản sau khi nhận hàng":t==="CONG_NO"?"Công nợ "+(s.pay_days||0)+" ngày":"Chưa ghi"}
function mhDueOf(p){const s=mhTermOf(p);if(s.pay_terms!=="CONG_NO")return "";const rc=p.receipts.filter(r=>r.status==="OK").map(r=>r.receipt_date).sort().pop();if(!rc)return "";const d=pdate(rc);d.setDate(d.getDate()+(+s.pay_days||0));return iso(d)}
function mhStage(p,M){
  if(p.status==="HUY")return ["huy","Đã hủy","gry"];
  if(p.status!=="DU"&&mhTermOf(p).pay_terms==="TRUOC"&&!(M.paid>0))return ["tr","Chờ chuyển khoản trước","amb"];
  if(p.status!=="DU")return ["hang",p.status==="DANG_GIAO"?"Đã nhập kho một phần":mhLateDays(p)?"Trễ hàng":"Chờ hàng",mhLateDays(p)?"red":"amb"];
  if(mhNoPrice(p))return ["gia","Chờ nhập giá","amb"];
  {const T=mhTermOf(p).pay_terms,due=mhDueOf(p),full=M.invTotal>0&&M.paid>=M.invTotal-1;
   if(T==="CONG_NO"&&!full&&due)return ["no","Công nợ · hạn "+mhDM(due),due<mhToday()?"red":"amb"];
   if(T==="SAU_NHAN"&&!(M.paid>0))return ["no","Đã nhập kho · chờ chuyển khoản","red"]}
  /* Hàng đã về kho (phiếu nhập của kho gắn với phiếu mua): trạng thái theo tiền thanh toán */
  if(mhPendingReceipts().some(x=>x.p.id===p.id)||!M.invTotal)return ["ct",M.paid>0?"Đã nhập kho · đã trả "+nf(M.paid):"Đã nhập kho · chưa thanh toán","blu"];
  if(M.paid<M.invTotal-1)return ["no",M.paid>0?"Đã nhập kho · trả một phần":"Đã nhập kho · chưa thanh toán","red"];
  return ["xong","Đã nhập kho · đã thanh toán","grn"]}
/* Khoảng thời gian lọc theo ngày đặt: [từ, đến (không gồm)] */
function mhPeriod(){const t=mhToday(),y=+t.slice(0,4),mo=+t.slice(5,7),f=(Y,M)=>{while(M<1){M+=12;Y--}return Y+"-"+String(M).padStart(2,"0")+"-01"};
  return {m0:[f(y,mo),null],m1:[f(y,mo-1),f(y,mo)],m3:[f(y,mo-2),null],y:[y+"-01-01",null]}[MH.per]||[null,null]}
/* Phiếu chi vận chuyển gắn đơn mua (mã PM… trong order_refs): cước chỉ tính MỘT nơi (đấu nối 29/10, docs/DAU-NOI-SO-CHI-TAI-SAN-KHO.md mục 10).
   Trả null nếu không gắn đơn mua; "ts" = đơn toàn tài sản / công cụ: cộng vào nguyên giá (tsPhiDon), Sổ chi phí để G28 Không tính;
   "trung" = chứng từ của đơn đã ghi ô Vận chuyển đúng bằng số này (±1%): đã vào giá nhập qua chứng từ, Sổ chi phí không tính;
   "sx" = cước vật tư đầu vào, Sổ chi phí G17 Sản xuất. */
function mhVcXuLy(ma,tien){const O=(typeof MH!=="undefined"&&MH.orders)||[],P=(typeof gdMaDon==="function"?gdMaDon(ma):[]).map(t=>O.find(o=>o.no===t)).filter(Boolean);if(!P.length)return null;
  if(typeof tsDonTaiSan==="function"&&P.every(p=>tsDonTaiSan(p.id)))return "ts";
  let fr=0;try{P.forEach(p=>mhPoMoney(p).inv.forEach(v=>{fr+=(+v.freight||0)*(v.share??1)}))}catch(e){}
  return fr>0&&Math.abs(fr-(+tien||0))<=Math.max(1000,fr*0.01)?"trung":"sx"}
/* ---------- Cột "Liên quan" (kiểu bảng giao dịch chung gdbang.js, chị Hoa 29/10): đơn mua ↔ chứng từ ↔ phiếu chi ↔ tài sản ghi tăng ---------- */
const mhLqHv=v=>gdLink((v.doc_type==="HD"?"HĐ ":"CT ")+(v.invoice_no||mhDM(v.invoice_date)),`data-gdhv="${esc(v.id)}"`,"Chứng từ "+(v.invoice_no||"")+" · "+nf(v.total)+" đ");
const mhLqPv=x=>gdLink("Chi "+nf(x.amount),`data-gdpv="${esc(x.id)}"`,"Phiếu chi ngày "+mhD(x.pay_date)+" · "+(x.account||""));
const mhLqPo=p=>gdLink(p.no,`data-gdpo="${esc(p.id)}"`,"Đơn mua "+p.no+" · "+(p.supplier_name||""));
/* Tài sản / công cụ đã ghi tăng từ đơn p, và phiếu chi ở Sổ chi phí chọn "Thuộc đơn mua" p. */
const mhTsCuaDon=p=>typeof tsAll==="function"&&typeof tsDonCua==="function"?tsAll().filter(a=>tsDonCua(a)===p):[];
const mhPcCuaDon=p=>typeof scFin==="function"?((scFin().nkc)||[]).filter(r=>r.po===p.id):[];
function mhLienQuan(p,M){M=M||mhPoMoney(p);
  /* Chị Hoa 29/10: cột Liên quan hiện cả mã đơn mua đứng đầu, rồi chứng từ, phiếu chi, tài sản. */
  return [mhLqPo(p),...M.inv.map(mhLqHv),...M.pays.map(mhLqPv),...mhPcCuaDon(p).map(r=>gdLink(r.ct||"Phiếu chi",`data-gdpc="${esc(r.id)}"`,"Phiếu chi Sổ chi phí · "+nf(r.t)+" đ")),
    ...mhTsCuaDon(p).map(a=>gdLink(a.ma,`data-gdts="${esc(a.id)}"`,(a.kind==="TS"?"Tài sản ":"Công cụ ")+a.ten))].join(" ")||`<span class="hint">—</span>`}
/* Gắn bấm cho mọi link Liên quan trong vùng m. */
function mhLqBind(m){if(typeof gdBind==="function")gdBind(m);
  const st=f=>el=>el.onclick=ev=>{ev.stopPropagation();f(el)};
  m.querySelectorAll("[data-gdhv]").forEach(st(el=>mhDocDetail(el.dataset.gdhv)));
  m.querySelectorAll("[data-gdpv]").forEach(st(el=>mhPayDetail(el.dataset.gdpv)));
  m.querySelectorAll("[data-gdpc]").forEach(st(el=>{const r=((scFin().nkc)||[]).find(z=>z.id===el.dataset.gdpc);if(r&&typeof scPhieu==="function")scPhieu(r)}));
  m.querySelectorAll("[data-gdts]").forEach(st(el=>{const a=tsAll().find(z=>z.id===el.dataset.gdts);if(a)tsForm(a.kind,a)}))}
function pMhDon(m){
  mhLoad();mhLoadInv();mhLoadPay();mhLoadDebt();const T="Đơn mua hàng",S="Mỗi phiếu một dòng: đặt hàng → kho nhập hàng (phiếu nhập kho của kho) → chứng từ → trả tiền";
  if(mhNeedAdmin(m,T,S))return;
  if(MH.err){m.innerHTML=H(T,S)+`<div class="note red">${esc(MH.err)}</div>`;return}
  if(!MH.orders||!MH.inv||!MH.pay){m.innerHTML=H(T,S)+`<p class="hint pad">Đang tải…</p>`;return}
  /* Đơn mua mở trong cửa sổ nổi giữa màn hình đè lên danh sách (chị Hoa 29/10), không còn là trang riêng. */
  {const po=MH.open?MH.orders.find(x=>x.id===MH.open):null;if(MH.open&&!po)MH.open=null;
   if(po)setTimeout(()=>{if(MH.open!==po.id)return;openPop(`<div id="mh-detail"></div>`,()=>{MH.open=null;const hs=history.state;if(hs&&hs.sub&&hs.sub.mh){_navSkipPop++;history.back()}});mhPoDrawer(po.id,$("#mh-detail"))},0);
   else if(typeof closePop==="function")closePop(true)}
  const [from,to]=mhPeriod(),q=(MH.q||"").trim().toLowerCase(),need=mhNeedBuy();
  const rows=MH.orders.map(p=>{const M=mhPoMoney(p);return {p,M,st:mhStage(p,M),val:M.invTotal||mhValue(p)||0}})
    .filter(x=>(!from||x.p.order_date>=from)&&(!to||x.p.order_date<to)&&(!MH.sid||x.p.supplier_id===MH.sid)&&(!q||(x.p.no+" "+x.p.supplier_name+" "+x.p.lines.map(l=>l.item+" "+l.name).join(" ")).toLowerCase().includes(q)));
  const live=rows.filter(x=>x.st[0]!=="huy"),cnt=k=>rows.filter(x=>x.st[0]===k).length,F=MH.st||"";
  const shown=rows.filter(x=>F?x.st[0]===F:x.st[0]!=="huy");
  const tot=k=>live.reduce((t,x)=>t+x[k],0),owe=live.reduce((t,x)=>t+Math.max(0,(x.M.invTotal||x.val||0)-x.M.paid),0),paid=live.reduce((t,x)=>t+x.M.paid,0);
  const chips=[["","Tất cả",live.length],["hang","Chờ hàng",cnt("hang")],["tr","Chờ CK trước",cnt("tr")],["gia","Chờ nhập giá",cnt("gia")],["ct","Đã nhập, chờ chứng từ",cnt("ct")],["no","Đã nhập, chưa trả đủ",cnt("no")],["xong","Đã thanh toán",cnt("xong")],["huy","Đã hủy",cnt("huy")]];
  const items=p=>{const u=[...new Set(p.lines.map(l=>l.unit||""))],q=p.lines.reduce((t,l)=>t+(+l.qty||0),0);
    return `<b>${p.lines.length} mặt hàng</b>${u.length===1?` · ${mhN(q)} ${esc(u[0])}`:""}<div class="hint mhnames">${p.lines.map(l=>esc(l.name||mhName(l.item))).join(", ")}</div>`};
  const recv=p=>{const late=mhLateDays(p);return p.status==="HUY"?"—":p.status==="DU"?`<span class="ok">Đủ hàng</span>`:(p.status==="DANG_GIAO"?"Đã nhận một phần<br>":"")+(late?`<b style="color:#b42318">Trễ ${late} ngày</b>`:p.expected_date?`<span class="hint">hẹn ${esc(mhDM(p.expected_date))}</span>`:`<span class="hint">chưa hẹn ngày</span>`)};
  const act=x=>{const p=x.p,o=p.status==="DAT"||p.status==="DANG_GIAO";return o?"":x.st[0]==="ct"?`<button class="btn sm pri" data-mhw="${p.id}">Ghi chứng từ</button>`:x.st[0]==="no"?`<button class="btn sm pri" data-mhp="${p.id}">Ghi chi</button>`:""};
  m.innerHTML=H(T,S)+(need.length?`<div class="note mhneed">⚠ <b>${need.length} nguyên vật liệu</b> dưới mức tồn tối thiểu: ${need.slice(0,4).map(r=>esc(r.name)).join(", ")}${need.length>4?"…":""} <button class="btn sm" id="mh-buyall">Lập phiếu mua cho các mã này</button></div>`:"")+
  `<div class="grid kpis">${kpi("Số phiếu mua",nf(live.length),cnt("hang")?cnt("hang")+" phiếu đang chờ hàng":"")}${kpi("Tiền hàng",nf(Math.round(tot("val"))),"theo chứng từ, chưa có thì theo giá đặt")}${kpi("Đã trả",nf(paid),"")}${kpi("Còn phải trả",nf(Math.round(owe)),cnt("ct")?cnt("ct")+" phiếu chưa có chứng từ":"")}</div>
  <div class="filters"><select id="mh-per">${opt([["all","Tất cả thời gian"],["m0","Tháng này"],["m1","Tháng trước"],["m3","3 tháng gần đây"],["y","Năm nay"]],MH.per||"all")}</select><select id="mh-sid">${opt([["","Tất cả nhà cung cấp"]].concat((MH.sup||[]).map(x=>[x.id,x.name])),MH.sid||"")}</select><input id="mh-q" class="mhq" placeholder="Tìm số phiếu, hàng…" value="${esc(MH.q||"")}"><span class="sp"></span><button class="btn pri" id="mh-new">+ Lập phiếu mua hàng</button></div>
  <div class="ttchips mhchips">${chips.map(([k,t,n])=>`<button class="ttchip${F===k?" on":""}" data-mhst="${k}">${t} <b>${n}</b></button>`).join("")}</div>
   <section class="card flush">${gdTbl(["Ngày đặt","Mã phiếu","Nhà cung cấp","Hàng","Tổng tiền","Đã trả","Còn phải trả","Trạng thái","Liên quan"],gdCat(shown,MH.pgDon||(MH.pgDon={co:gdCoNho("mhdon",100),trang:1})).map(x=>{const p=x.p,M=x.M,late=mhLateDays(p),tot=M.invTotal||x.val||0,due=Math.max(0,tot-M.paid);
    const todo=p.status==="HUY"?"":x.st[0]==="tr"?`<span class="mhtodo red">Chuyển khoản trước</span>`:p.status!=="DU"?(late?`<span class="mhtodo red">Trễ ${late} ngày</span>`:`<span class="mhtodo">Chờ nhận hàng</span>`):x.st[0]==="gia"?`<span class="mhtodo red">Nhập giá</span>`:x.st[0]==="ct"?`<span class="mhtodo">Ghi chứng từ</span>`:x.st[0]==="no"?`<span class="mhtodo">Thanh toán</span>`:"";
    const ten=p.lines.map(l=>(l.name||mhName(l.item))+" × "+mhN(l.qty)).join(", "),ghi=["Người lập: "+(p.created_by_name||"—"),p.expected_date?"Hẹn giao "+kDd(p.expected_date):"",p.source==="KHO"?"kho tự tạo":""].filter(Boolean).join(" · ");
    return `<tr class="clk mhrow" data-mhd="${p.id}" title="${esc(ghi)}"><td>${esc(kDd(p.order_date))}</td><td><a class="mhno">${esc(p.no)}</a></td><td class="gdd" style="max-width:170px" title="${esc(p.supplier_name)}">${esc(p.supplier_name)}</td><td class="gdd" style="max-width:200px" title="${esc(ten)}">${esc(ten)}</td><td class="n">${tot?nf(Math.round(tot)):"—"}</td><td class="n">${M.paid?nf(M.paid):"0"}</td><td class="n">${due>1?`<b>${nf(Math.round(due))}</b>`:"0"}</td><td>${/class="mhtodo red"/.test(todo)?todo:pill(x.st[1],x.st[2])}</td><td class="gdd" style="max-width:240px">${mhLienQuan(p,M)}</td></tr>`}))}${(()=>{const t=k=>shown.reduce((s,x)=>s+(k==="tot"?(x.M.invTotal||x.val||0):k==="paid"?x.M.paid:Math.max(0,(x.M.invTotal||x.val||0)-x.M.paid)),0);
    return gdChan(`<span>Cộng <b>${shown.length}</b> đơn: tổng <b>${nf(Math.round(t("tot")))}</b> đ</span><span class="hint">đã trả <b>${nf(Math.round(t("paid")))}</b> · còn phải trả <b>${nf(Math.round(t("due")))}</b></span>`,shown.length,MH.pgDon,"mhdon")})()}</section>`;
  gdCss();mhLqBind(m);
  $("#mh-per").onchange=e=>{MH.per=e.target.value;renderMain()};$("#mh-sid").onchange=e=>{MH.sid=e.target.value;renderMain()};
  $("#mh-q").onchange=e=>{MH.q=e.target.value;renderMain()};
  m.querySelectorAll("[data-mhst]").forEach(b=>b.onclick=()=>{MH.st=b.dataset.mhst;renderMain()});
  $("#mh-new").onclick=()=>mhForm(null);
  if($("#mh-buyall"))$("#mh-buyall").onclick=()=>mhForm(null,{L:need.map(r=>({item:r.code,qty:r.need||"",note:"",price:""}))});
  m.querySelectorAll("[data-mhr]").forEach(b=>b.onclick=e=>{e.stopPropagation();mhReceiveForm(b.dataset.mhr)});
  m.querySelectorAll("[data-mhw]").forEach(b=>b.onclick=e=>{e.stopPropagation();mhPoDoc(b.dataset.mhw)});
  m.querySelectorAll("[data-mhp]").forEach(b=>b.onclick=e=>{e.stopPropagation();const p=MH.orders.find(x=>x.id===b.dataset.mhp);if(p)mhPayForm(p.supplier_id,p.id)});
  if(MH.pgDon)gdChanBind(m,"mhdon",MH.pgDon,renderMain);
  m.querySelectorAll("[data-mhd]").forEach(r=>r.onclick=()=>{MH.open=r.dataset.mhd;renderMain();window.scrollTo(0,0)});
}
/* Giá lần mua trước của cùng mặt hàng: ưu tiên cùng nhà cung cấp, không có thì nhà cung cấp khác. */
function mhLastPrice(p,item){
  const O=(MH.orders||[]).filter(o=>o.id!==p.id&&o.status!=="HUY").sort((a,b)=>String(b.order_date).localeCompare(String(a.order_date)));
  for(const same of [true,false])for(const o of O){if(same&&o.supplier_id!==p.supplier_id)continue;const l=o.lines.find(x=>x.item===item&&x.unit_price!=null);if(l)return {price:l.unit_price,no:o.no,date:o.order_date,sup:o.supplier_name,same}}
  return null}
/* Thảo nhập giá cho phiếu mua sau khi hàng đã về (điền sẵn giá lần mua trước để chỉ cần xem lại). */
function mhPriceForm(id){
  const p=(MH.orders||[]).find(x=>x.id===id);if(!p)return;
  const R=p.lines.map(l=>{const last=l.unit_price==null?mhLastPrice(p,l.item):null;return {l,last,v:l.unit_price!=null?l.unit_price:last?last.price:""}});
  openDrawerHTML(`<h2>Nhập giá · ${esc(p.no)}</h2><p class="hint">${esc(p.supplier_name)} · giá đã gồm vận chuyển, bốc vác như khi đặt hàng. Ô đã điền sẵn là <b>giá lần mua trước</b>, đúng thì giữ nguyên.</p><form class="frm" id="mhpf">
   <div class="tbl edit"><table><thead><tr><th>Hàng</th><th class="n">Số lượng</th><th class="n">Đơn giá (đ)</th><th class="n">Thành tiền</th></tr></thead><tbody>${R.map((r,i)=>`<tr><td>${esc(r.l.name)}<div class="hint mono">${esc(r.l.item)}</div>${r.last?`<div class="hint">giá lần trước ${nf(r.last.price)} · ${esc(r.last.no)} ${esc(kDd(r.last.date))}${r.last.same?"":" ("+esc(r.last.sup)+")"}</div>`:""}</td><td class="n">${mhN(r.l.received||r.l.qty)} ${esc(r.l.unit||"")}</td><td><input class="mhpf-v n" data-i="${i}" type="number" min="0" step="any" value="${r.v}" required></td><td class="n mhpf-t" data-i="${i}">—</td></tr>`).join("")}</tbody></table></div>
   <div class="note mhtot" id="mhpf-s"></div><div id="mhpf-e"></div><button class="btn pri">Lưu giá</button></form>`);
  const sum=()=>{let t=0;document.querySelectorAll(".mhpf-v").forEach(x=>{const r=R[+x.dataset.i],q=r.l.received||r.l.qty,v=+x.value||0;t+=q*v;const c=document.querySelector('.mhpf-t[data-i="'+x.dataset.i+'"]');if(c)c.textContent=x.value===""?"—":nf(Math.round(q*v))});$("#mhpf-s").innerHTML="Tổng tiền hàng: <b>"+nf(Math.round(t))+"</b> đ"};
  document.querySelectorAll(".mhpf-v").forEach(x=>x.oninput=sum);sum();
  $("#mhpf").onsubmit=async e=>{e.preventDefault();const prices={};document.querySelectorAll(".mhpf-v").forEach(x=>{prices[R[+x.dataset.i].l.id]=+x.value});
    try{await kApi("/mh/orders/"+id+"/prices",{method:"PUT",body:JSON.stringify({prices})});closeDrawer();toast("Đã lưu giá "+p.no);await mhReload()}catch(err){$("#mhpf-e").innerHTML=`<div class="note red">${esc(err.message)}</div>`}};
}
/* Ghi chứng từ cho đúng phiếu mua này (tick sẵn các lần nhận hàng chưa có chứng từ). */
function mhPoDoc(id){const p=(MH.orders||[]).find(x=>x.id===id);if(!p)return;mhDocForm({sup:p.supplier_id,rids:mhPendingReceipts().filter(x=>x.p.id===id).map(x=>x.r.id)})}
/* Cửa sổ phụ của một phiếu mua: toàn bộ từ đặt hàng tới trả tiền, cập nhật ngay tại đây. */
function mhPoDrawer(id,target){
  const p=(MH.orders||[]).find(x=>x.id===id);if(!p)return;const M=mhPoMoney(p),st=mhStage(p,M),o=p.status==="DAT"||p.status==="DANG_GIAO",pend=mhPendingReceipts().filter(x=>x.p.id===id),hasRc=p.receipts.some(r=>r.status==="OK");
  const val=mhValue(p);
  const debt=(MH.debts||[]).find(z=>z.id===p.supplier_id);
  const html=(`<h2 class="mhh">Phiếu mua hàng ${esc(p.no)} ${pill(st[1],st[2])}</h2>
   <div class="mhinfo"><div><span>Nhà cung cấp</span><b>${esc(p.supplier_name)}</b>${p.supplier_phone?`<small>${esc(p.supplier_phone)}</small>`:""}</div><div><span>Ngày đặt</span><b>${esc(kDd(p.order_date))}</b></div><div><span>Hẹn giao</span><b>${p.expected_date?esc(kDd(p.expected_date)):"chưa hẹn"}</b>${mhLateDays(p)?`<small style="color:#b42318">trễ ${mhLateDays(p)} ngày</small>`:""}</div><div><span>Người lập</span><b>${esc(p.created_by_name||"—")}</b></div><div><span>Điều khoản thanh toán</span><b>${esc(mhTermTxt(mhTermOf(p)))}</b>${mhDueOf(p)?`<small>hạn trả ${esc(kDd(mhDueOf(p)))}</small>`:""}</div><div><span>Công nợ NCC hiện tại</span><b>${!debt?"…":debt.balance<0?"NCC đang giữ "+nf(-debt.balance):nf(debt.balance)}</b><small>${debt&&debt.balance<0?"tiền cọc / trả trước, ":""}tất cả đơn của NCC này</small></div></div>
   ${p.note?`<p class="hint">Ghi chú: ${esc(p.note)}</p>`:""}
   <div class="mhacts">${o?`<button class="btn pri" data-a="rc">Nhận hàng</button>`:""}${p.status!=="HUY"?`<button class="btn${!o&&pend.length?" pri":""}" data-a="ct">Ghi chứng từ</button><button class="btn${st[0]==="no"?" pri":""}" data-a="chi">Ghi chi / cọc</button>`:""}${p.status!=="HUY"&&(mhNoPrice(p)||hasRc)?`<button class="btn${mhNoPrice(p)?" pri":""}" data-a="gia">${mhNoPrice(p)?"Nhập giá":"Sửa giá"}</button>`:""}${o&&!hasRc?`<button class="btn" data-a="sua">Sửa phiếu</button><button class="btn danger" data-a="huy">Hủy phiếu</button>`:""}</div>
   <div class="mhinfo mhmoney"><div><span>Giá đặt</span><b>${val!=null?nf(Math.round(val)):"chưa có giá"}</b></div><div><span>Theo hóa đơn</span><b>${M.invTotal?nf(M.invTotal):"chưa có"}</b></div><div><span>${M.deposit&&M.paid===M.deposit?"Đã cọc":"Đã trả"}</span><b>${nf(M.paid||0)}</b></div><div><span>Còn phải trả</span><b style="color:${(M.invTotal||val||0)-M.paid>0?"#b42318":"#067647"}">${nf(Math.max(0,Math.round((M.invTotal||val||0)-M.paid)))}</b></div></div>
   <h3>Tiến trình</h3>${mhSteps(p)}
   <h3>Đơn hàng</h3><div class="tbl mhorder"><table><thead><tr><th>STT</th><th>Tên hàng</th><th>ĐVT</th><th class="n">SL đặt</th><th class="n">Đơn giá</th><th class="n">Thành tiền</th><th class="n">Đã nhận</th></tr></thead><tbody>
    ${p.lines.map((l,i)=>`<tr><td>${i+1}</td><td>${esc(l.name)}<div class="hint mono">${esc(l.item)}</div></td><td>${esc(l.unit||"")}</td><td class="n">${mhN(l.qty)}</td><td class="n">${l.unit_price!=null?nf(l.unit_price):"—"}</td><td class="n">${l.unit_price!=null?nf(Math.round(l.qty*l.unit_price)):"—"}</td><td class="n">${l.received>0?mhN(l.received)+(l.qty-l.received>1e-9?`<div class="hint" style="color:#b42318">thiếu ${mhN(l.qty-l.received)}</div>`:""):"—"}</td></tr>`).join("")}</tbody>
    <tfoot><tr><td colspan="5">Cộng tiền hàng (theo giá đặt)</td><td class="n"><b>${val!=null?nf(Math.round(val)):"—"}</b></td><td></td></tr>
</tfoot></table></div>
   <h3>Các lần nhận hàng</h3>${p.receipts.length?gdTbl(["Ngày nhận","Hàng nhận","Ghi chú","Trạng thái",""],p.receipts.map(r=>`<tr class="${r.status==="OK"?"":"mut"}"><td>${esc(kDd(r.receipt_date))}</td><td>${r.lines.map(l=>esc(l.name)+" × "+mhN(l.qty)+(l.unit_price!=null?" @ "+nf(l.unit_price):"")).join("<br>")}</td><td>${esc(r.note||"")}</td><td>${r.status!=="OK"?pill("Đã hủy","gry"):pend.some(x=>x.r.id===r.id)?pill("Chờ chứng từ","blu"):pill("Đã có chứng từ","grn")}</td><td>${r.status==="OK"?`<button class="btn sm danger" data-mhcr="${r.id}">Hủy lần nhận</button>`:""}</td></tr>`)):`<p class="hint">Chưa nhận hàng lần nào.</p>`}
   <h3>Chứng từ</h3>${M.inv.length?gdTbl(["Ngày","Chứng từ","Tổng","Đã chi","Ảnh / PDF","Liên quan",""],M.inv.map(v=>`<tr class="clk" data-hv="${v.id}"><td>${esc(mhD(v.invoice_date))}</td><td>${v.doc_type==="PG"?"Phiếu giao / bill":"Hóa đơn VAT"} ${esc(v.invoice_no||"")}${v.share<.999?`<div class="hint">chung với phiếu khác, phần phiếu này ≈ ${nf(Math.round(v.total*v.share))}</div>`:""}</td><td class="n">${nf(v.total)}</td><td class="n">${nf(v.paid)}</td><td>${v.file_count?pill(v.file_count+" file","blu"):`<span class="hint">chưa có</span>`}</td><td>${(MH.pay||[]).filter(x=>x.status==="OK"&&x.invoice_id===v.id).map(mhLqPv).join(" ")||`<span class="hint">chưa chi</span>`}</td><td><button class="btn sm danger" data-hx="${v.id}">Hủy chứng từ</button></td></tr>`)):`<p class="hint">Chưa có chứng từ.${pend.length?" Hàng đã về, bấm <b>Ghi chứng từ</b> khi nhà cung cấp gửi bill hoặc hóa đơn.":""}</p>`}
   <h3>Lịch sử thanh toán</h3>${M.pays.length?gdTbl(["Ngày chi","Loại","Số tiền","Tài khoản","Ghi chú",""],M.pays.map(x=>`<tr class="clk" data-pv="${x.id}"><td>${esc(mhD(x.pay_date))}</td><td>${x.kind==="COC"?pill("Cọc","amb"):"Trả tiền"}${x.invoice_no?`<div class="hint">cho chứng từ ${esc(x.invoice_no)}</div>`:""}</td><td class="n"><b>${nf(x.amount)}</b></td><td>${esc(x.account||"")}${x.file_count?" "+pill(x.file_count+" ảnh","blu"):""}</td><td>${esc(x.note||"")}</td><td class="nowrap"><button class="btn sm" data-pe="${x.id}">Sửa</button> <button class="btn sm danger" data-px="${x.id}">Hủy phiếu chi</button></td></tr>`)):`<p class="hint">Chưa trả tiền.</p>`}
   ${(()=>{const T=mhTsCuaDon(p),C=mhPcCuaDon(p);return T.length||C.length?`<h3>Liên quan khác</h3>${gdTbl(["Loại","Số / mã","Nội dung","Số tiền"],[...C.map(r=>`<tr><td>Phiếu chi Sổ chi phí</td><td>${gdLink(r.ct||"Phiếu chi",`data-gdpc="${esc(r.id)}"`)}</td><td class="gdd" title="${esc(r.dg||"")}">${esc(r.dg||"")}</td><td class="n">${nf(r.t)}</td></tr>`),...T.map(a=>`<tr><td>${a.kind==="TS"?"Tài sản cố định":"Công cụ dụng cụ"} đã ghi tăng</td><td>${gdLink(a.ma,`data-gdts="${esc(a.id)}"`)}</td><td class="gdd" title="${esc(a.ten)}">${esc(a.ten)}</td><td class="n">${nf(+(a.gk??a.ng)||0)}</td></tr>`)])}`:""})()}`);
  if(target)target.innerHTML=html;else openDrawerHTML(html);
  gdCss();mhLqBind(target||document.getElementById("drawerIn")||document);
  const D=document.querySelector("#dx")||document,done=async(msg)=>{closeDrawer();if(msg)toast(msg);await mhReload()};
  document.querySelectorAll(".mhacts [data-a]").forEach(b=>b.onclick=async()=>{const a=b.dataset.a;
    if(a==="rc")mhReceiveForm(id);else if(a==="ct")mhPoDoc(id);else if(a==="chi")mhPayForm(p.supplier_id,id);else if(a==="sua")mhForm(id);else if(a==="gia")mhPriceForm(id);
    else if(a==="huy"){if(!confirm("Hủy phiếu mua "+p.no+"?"))return;try{await kApi("/mh/orders/"+id+"/cancel",{method:"POST",body:"{}"});await done("Đã hủy phiếu "+p.no)}catch(e){toast(e.message)}}});
  document.querySelectorAll("[data-mhcr]").forEach(b=>b.onclick=async()=>{if(!confirm("Hủy lần nhận hàng này? Phiếu nhập kho tương ứng cũng bị hủy."))return;
    try{await kApi("/mh/receipts/"+b.dataset.mhcr+"/cancel",{method:"POST",body:JSON.stringify({reason:"Hủy lần nhận hàng"})});await done("Đã hủy lần nhận hàng")}catch(e){toast(e.message)}});
  document.querySelectorAll("[data-pe]").forEach(b=>b.onclick=e=>{e.stopPropagation();mhPayEdit(b.dataset.pe)});
  document.querySelectorAll("[data-hv]").forEach(r=>r.onclick=e=>{if(e.target.closest("button"))return;mhDocDetail(r.dataset.hv)});
  document.querySelectorAll("[data-hx]").forEach(b=>b.onclick=async e=>{e.stopPropagation();if(!confirm("Hủy chứng từ này? Công nợ nhà cung cấp giảm lại đúng số tiền."))return;
    try{await kApi("/mh/invoices/"+b.dataset.hx+"/cancel",{method:"POST",body:"{}"});await done("Đã hủy chứng từ")}catch(err){toast(err.message)}});
  document.querySelectorAll("[data-px]").forEach(b=>b.onclick=async e=>{e.stopPropagation();if(!confirm("Hủy phiếu chi này? Công nợ nhà cung cấp tăng lại đúng số tiền."))return;
    try{await kApi("/mh/payments/"+b.dataset.px+"/cancel",{method:"POST",body:"{}"});await done("Đã hủy phiếu chi")}catch(err){toast(err.message)}});
  document.querySelectorAll("#dx [data-pv],#mh-detail [data-pv]").forEach(r=>r.onclick=e=>{if(e.target.closest("button"))return;mhPayDetail(r.dataset.pv)});
}
PAGES.mh_po=pMhDon;
Object.assign(PAGES,{mh_cho:pMhHd,mh_gia:pMhHd,mh_hd:pMhHd,mh_chi:pMhChi,mh_no:pMhNo,mh_gianvl:pMhGiaNvl});

/* =====================================================================
   Kho hàng (trang quản trị): Tồn kho & giá trị = số lượng tồn × giá bình quân (bình quân gia quyền, có tính xuất dùng).
   Số lượng tồn vẫn do kho làm bên vận hành; ở đây chỉ thêm phần giá trị.
   ===================================================================== */
const KG={q:"",cls:"",prices:null,busy:false,err:""};
async function kgLoad(){
  if(KG.busy||KG.prices)return;KG.busy=true;
  try{if(typeof khoLoad==="function")await khoLoad();const r=await kApi("/mh/material-prices?month="+MONTH.key);KG.prices=new Map(r.rows.map(x=>[x.item,x]));KG.err=""}catch(e){KG.err=e.message||"Không tải được giá"}
  KG.busy=false;if(PAGE==="kho_gtri")renderMain();
}
function pKhoGiaTri(m){
  kgLoad();const T="Tồn kho & giá trị",S="Số lượng tồn nhân giá bình quân nguyên vật liệu";
  if(mhNeedAdmin(m,T,S))return;
  if(KG.err){m.innerHTML=H(T,S)+`<div class="note red">${esc(KG.err)}</div>`;return}
  if(!KG.prices||typeof KHO==="undefined"||!KHO.items||!KHO.stock){m.innerHTML=H(T,S)+`<p class="hint pad">Đang tải…</p>`;return}
  const fold=t=>String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/gi,"d").toLowerCase(),needle=fold(KG.q.trim());
  const rows=[...KHO.items.values()].filter(i=>i.active).map(i=>{const q=+KHO.stock.get(i.code)||0,p=KG.prices.get(i.code),pr=p&&p.avg_price>0?p.avg_price:null;return {i,q,pr,v:pr!=null?q*pr:null}}).filter(r=>r.q!==0)
    .filter(r=>(!KG.cls||r.i.cls===KG.cls)&&(!needle||needle.split(/\s+/).every(w=>fold(r.i.code+" "+r.i.name).includes(w)))).sort((a,b)=>(b.v||0)-(a.v||0));
  const tot=sum(rows,r=>r.v||0),noPrice=rows.filter(r=>r.pr==null&&r.q>0);
  const byCls={};rows.forEach(r=>{const k=(typeof KHO_CLS!=="undefined"&&KHO_CLS[r.i.cls])||r.i.cls;byCls[k]=(byCls[k]||0)+(r.v||0)});
  m.innerHTML=H(T,S)+`<div class="grid kpis">${kpi("Tổng giá trị tồn kho",tr(tot),(()=>{/* Đếm theo chỗ tính tồn chung (khoton.js): âm tính cả mã ngừng dùng. */const K=typeof KTON!=="undefined"&&KTON.rows,c=K?K.filter(x=>x.ton>0).length:rows.filter(r=>r.q>0).length,a=K?K.filter(x=>x.trang_thai==="AM").length:rows.filter(r=>r.q<0).length;return nf(c)+" mã còn hàng"+(a?" · "+nf(a)+" mã âm":"")})())}${Object.entries(byCls).filter(([,v])=>v>0).slice(0,4).map(([k,v])=>kpi(k,tr(v),"")).join("")}${noPrice.length?kpi("Chưa có giá",nf(noPrice.length)+" mã","chưa tính được giá trị","var(--orange)"):""}</div>
  <div class="filters"><select id="kg-c">${opt([["","Mọi loại hàng"]].concat(Object.entries(typeof KHO_CLS!=="undefined"?KHO_CLS:{})),KG.cls)}</select><input id="kg-q" placeholder="Tìm mã, tên…" value="${esc(KG.q)}" style="max-width:260px"><span class="hint">${rows.length} mã</span></div>
  <section class="card flush">${tbl(["Mã","Tên","Loại","Tồn","Giá bình quân (đ)","Giá trị tồn (đ)"],rows.slice(0,400).map(r=>`<tr><td class="mono">${esc(r.i.code)}</td><td>${esc(r.i.name)}</td><td>${esc((typeof KHO_CLS!=="undefined"&&KHO_CLS[r.i.cls])||r.i.cls)}</td><td class="n">${r.q<0?`<b style="color:#b42318">${mhN(r.q)}</b>`:mhN(r.q)} ${esc(r.i.unit||"")}</td><td class="n">${r.pr!=null?nf(Math.round(r.pr)):`<span class="hint">chưa có giá</span>`}</td><td class="n">${r.v!=null?nf(Math.round(r.v)):"—"}</td></tr>`).concat(rows.length?[`<tr class="tot"><td colspan="5"><b>Tổng</b></td><td class="n"><b>${nf(Math.round(tot))}</b></td></tr>`]:[]))}
   <p class="hint pad">Giá bình quân lấy từ các phiếu nhập có giá (Mua hàng) và tồn đầu kỳ, có trừ phần đã xuất dùng. Thành phẩm chưa có giá nhập nên chưa tính giá trị; sẽ tính khi có giá thành sản phẩm theo tháng.</p></section>`;
  $("#kg-c").onchange=e=>{KG.cls=e.target.value;renderMain()};
  $("#kg-q").oninput=()=>{KG.q=$("#kg-q").value;const p=$("#kg-q").selectionStart;renderMain();const q=$("#kg-q");q.focus();q.setSelectionRange(p,p)};
}
PAGES.kho_gtri=pKhoGiaTri;


/* =====================================================================
   Cảnh báo mua hàng cho người phụ trách mua (Thảo), kế toán, CEO: hiện ở "Cảnh báo vận hành" của Tổng quan.
   - Nguyên vật liệu dưới mức tồn tối thiểu (Thảo thấy luôn, không cần kho báo).
   - Phiếu mua quá ngày giao dự kiến mà chưa đủ hàng.
   ===================================================================== */
{const _ea=execAlerts;execAlerts=function(){
  const A=_ea();
  try{
    if(!mhManage())return A;
    const page="mh_po";
    const need=mhNeedBuy();
    if(need.length)A.push(["amb",`${need.length} nguyên vật liệu dưới mức tồn tối thiểu`,need.slice(0,3).map(r=>r.name).join(", ")+(need.length>3?"…":"")+" · cần đặt thêm",page]);
    (MH.orders||[]).filter(p=>mhLateDays(p)>0).slice(0,5).forEach(p=>A.push(["red",`${p.no} trễ ${mhLateDays(p)} ngày giao`,`${p.supplier_name} · dự kiến ${kDd(p.expected_date)}`,page]));
  }catch(e){}
  return A;
}}
/* Trang Tổng quan: nạp dữ liệu mua hàng và kho cho người có quyền, xong tự vẽ lại để cảnh báo hiện ra. */
{const _ex=PAGES.exec;if(_ex)PAGES.exec=function(m){if(mhManage()){mhLoad()}return _ex.apply(this,arguments)}}


/* =====================================================================
   Mua hàng ngay trên web VẬN HÀNH: lập phiếu mua, hàng về, chứng từ nhà cung cấp, phiếu chi, công nợ, giá nguyên vật liệu.
   Chỉ người có quyền duyệt đơn (Thảo), kế toán và CEO thấy mục này và thấy giá/tiền (máy chủ cũng chỉ trả giá cho đúng nhóm này).
   Kho và nhân viên khác chỉ ghi nhận hàng về ở tab Mua hàng trong Sản xuất & kho (không giá).
   ===================================================================== */
if(typeof MODULES!=="undefined"&&(typeof HOST_MODE==="undefined"||HOST_MODE!=="admin")&&!MODULES.some(x=>x.k==="mhop")){
  const ok=()=>mhManage(),i=MODULES.findIndex(x=>x.k==="sx");
  const mo={k:"mhop",zone:"Vận hành",ic:"cart",n:"Mua hàng",sub:"Đặt hàng · hàng về · chứng từ · công nợ",tabs:true,
    groups:()=>[["",[MI("mh_po","Mua hàng",ok),MI("mh_no","Công nợ nhà cung cấp",ok),MI("mh_gianvl","Giá nguyên vật liệu",ok)]]]};
  MODULES.splice(i>=0?i+1:MODULES.length,0,mo);
}

/* Chứng từ, phiếu nhập kho, thanh toán đều nằm trong từng phiếu mua (bấm vào phiếu): không còn tab riêng. Link cũ vào hai trang này chuyển về Mua hàng. */
for(const k of ["mh_hd","mh_chi"]){const _o=PAGES[k];PAGES[k]=function(m){if(mhManage()){PAGE="mh_po";renderMain();return}return _o.apply(this,arguments)}}
