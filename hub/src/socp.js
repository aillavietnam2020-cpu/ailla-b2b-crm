/* =====================================================================
   SỔ CHI PHÍ (trang quản trị › Chi phí & Tiền): MỘT chỗ thấy mọi khoản tiền công ty chi ra.
   Gom 5 nguồn, ghi rõ nguồn từng dòng:
   - nhập tay: khoản chi ghi ở đây (thuê, lương, agency, tiếp khách…), có hình thức chi, tài khoản đi / đến, ảnh bill
   - phiếu chi nhà cung cấp (Mua hàng) · phiếu chi vận chuyển · quảng cáo Facebook · quảng cáo TikTok (tự cộng từ báo cáo)
   Chị Hoa, chị Thảo, chị Huệ ghi thẳng, không chờ duyệt. Khoản nhập tay xóa được, các nguồn khác sửa ở trang gốc của nó.
   Lương, ngân sách theo nhóm sẽ nối sau.
   ===================================================================== */
const SOCP={ship:null,shipKey:"",busy:false,files:null,src:"",q:"",nhom:"",loai:"",kenh:"",pb:""};
const SP_LOAI={A:"A · trực tiếp kênh",B:"B · của phòng ban",C:"C · chi chung",H:"Mua hàng (giá vốn)",V:"Vận chuyển",Q:"Quảng cáo tự cộng"};
const spInP=d=>d>=PERIOD.from&&d<=PERIOD.to;
const spMonthIn=t=>t&&t+"-01"<=PERIOD.to&&t+"-31">=PERIOD.from;
const spHT=x=>x.method==="CHUYEN_KHOAN"||x.method==="CK"?"Chuyển khoản":x.method==="TIEN_MAT"?"Tiền mặt":"";
const SOCP_SRC={tay:["Nhập tay","amb"],ncc:["Phiếu chi nhà cung cấp","blu"],vc:["Phiếu chi vận chuyển","blu"],ads:["Tự động từ báo cáo","gry"]};
async function spLoadShip(){const k=PERIOD.from+"|"+PERIOD.to;if(SOCP.shipKey===k||SOCP.busy)return;SOCP.busy=true;SOCP.shipKey=k;
  try{SOCP.ship=await svApi("/api/shipping-vouchers?from="+PERIOD.from+"&to="+PERIOD.to)}catch(e){SOCP.ship=[]}SOCP.busy=false;if(["so_cp","ngan_sach","tien_lich"].includes(PAGE))renderMain()}
async function spLoadFiles(){if(SOCP.files)return;try{SOCP.files=await kApi("/mh/costs/file-counts")}catch(e){SOCP.files={}}if(PAGE==="so_cp"||PAGE==="exec"||PAGE==="cp_duyet")renderMain()}
function spRows(){
  const d=D(),cat=k=>d.costCats.find(c=>c.k===k)||{n:k,nhom:"Khác"},R=[];
  (d.costs||[]).forEach(c=>{const ngay=c.ngay||"",ok=ngay?spInP(ngay):spMonthIn(c.thang);if(!ok)return;
    R.push({id:c.id,ngay:ngay||c.thang+"-01",thangOnly:!ngay,txt:cat(c.cat).n,sub:c.note||"",nhom:cat(c.cat).nhom,src:"tay",loai:(typeof cpLoai==="function"?cpLoai(c.cat,c.kenh):"C"),tien:+c.tien||0,pb:(d.departments.find(p=>p.k===c.pb)||{}).n||"",kenh:c.kenh||"",ht:spHT(c),acc:c.method==="CHUYEN_KHOAN"?"từ "+(c.from_account||"?"):c.method==="TIEN_MAT"&&c.receiver?"nhận: "+c.receiver:"",files:(SOCP.files||{})[c.id]||0,del:true})});
  (MH.pay||[]).filter(x=>x.status==="OK"&&spInP(x.pay_date)).forEach(x=>R.push({id:x.id,ngay:x.pay_date,txt:(x.kind==="COC"?"Cọc nhà cung cấp · ":"Trả nhà cung cấp · ")+x.supplier_name,sub:x.invoice_no?"chứng từ "+x.invoice_no:x.po_no?"phiếu mua "+x.po_no:"",nhom:"Mua hàng",src:"ncc",loai:"H",tien:+x.amount||0,pb:"Mua hàng",kenh:"",ht:spHT(x),acc:x.account||"",files:x.file_count||0,open:()=>mhPayDetail(x.id)}));
  (SOCP.ship||[]).filter(v=>v.status==="OK").forEach(v=>R.push({id:v.id,ngay:v.voucher_date,txt:"Cước vận chuyển · "+v.carrier,sub:[v.destination,v.voucher_no].filter(Boolean).join(" · "),nhom:"Logistics",src:"vc",loai:"V",tien:+v.amount||0,pb:"Kho vận",kenh:"",ht:spHT({method:v.method==="CHUYEN_KHOAN"?"CHUYEN_KHOAN":v.method}),acc:v.from_account?"từ "+v.from_account:"",files:v.file_count||0,open:()=>{PAGE="cr_vc";try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}render();scrollTo(0,0)}}));
  try{const N=execNums(PERIOD.from,PERIOD.to),C=N.C||{};
    if(C.adsFB>0)R.push({id:"ads-fb",ngay:PERIOD.to,txt:"Quảng cáo Facebook",sub:"tự cộng từ báo cáo Ads, đã gồm VAT",nhom:"Marketing",src:"ads",loai:"Q",kyOnly:true,tien:C.adsFB,pb:"Ads / Digital",kenh:"Facebook",ht:"",acc:"",files:0});
    if(C.adsTT>0)R.push({id:"ads-tt",ngay:PERIOD.to,txt:"Quảng cáo TikTok GMV Max",sub:"từ báo cáo TikTok đã tải, đã gồm VAT",nhom:"Marketing",src:"ads",loai:"Q",kyOnly:true,tien:C.adsTT,pb:"Ads / Digital",kenh:"TikTok",ht:"",acc:"",files:0})}catch(e){}
  return R.sort((a,b)=>String(b.ngay).localeCompare(String(a.ngay)))}
/* Tổng chi phí chung theo tháng (lương, kho vận, thuê, agency…): dùng cho dòng "Chi phí chung" của P&L công ty.
   Chỉ tính khoản nhập tay thuộc nhóm không gắn riêng với một kênh bán. */
function spChungTheoThang(ym){const d=D(),cat=k=>d.costCats.find(c=>c.k===k)||{nhom:"Khác"};
  return (d.costs||[]).filter(c=>(c.ngay?c.ngay.slice(0,7):c.thang)===ym&&!c.kenh&&cat(c.cat).nhom!=="Marketing").reduce((t,c)=>t+(+c.tien||0),0)}
function pSoCP(m){
  const ed=mhManage()||can(ME,"chiphi.nhap");
  mhLoad();mhLoadPay();spLoadShip();spLoadFiles();
  if(!MH.pay){m.innerHTML=H("Sổ chi phí","Mọi khoản tiền công ty chi ra, một chỗ")+`<p class="hint pad">Đang tải…</p>`;return}
  const all=spRows(),q=kfold(SOCP.q||"").trim(),R=all.filter(x=>(!SOCP.src||x.src===SOCP.src)&&(!SOCP.nhom||(x.nhom||"Khác")===SOCP.nhom)&&(!SOCP.loai||x.loai===SOCP.loai)&&(!SOCP.kenh||(SOCP.kenh==="__chung"?!x.kenh:x.kenh===SOCP.kenh))&&(!SOCP.pb||x.pb===SOCP.pb)&&(!q||kfold(x.txt+" "+x.sub+" "+x.pb+" "+x.kenh).includes(q)));
  const sum=f=>R.filter(f).reduce((t,x)=>t+x.tien,0),tot=sum(()=>true),n=f=>R.filter(f).length,uniq=f=>[...new Set(all.map(f).filter(Boolean))].sort(),locOn=SOCP.src||SOCP.nhom||SOCP.loai||SOCP.kenh||SOCP.pb||SOCP.q;
  m.innerHTML=H("Sổ chi phí","Mọi khoản tiền công ty chi ra, một chỗ · "+pLabel())+
  `<div class="filters">${ed?`<button class="btn pri" id="sp-new">＋ Ghi chi phí</button><button class="btn" id="sp-ncc">＋ Phiếu chi nhà cung cấp</button><button class="btn" id="sp-vc">＋ Phiếu chi vận chuyển</button>`:""}<span class="sp"></span><select id="sp-nhom"><option value="">Mọi nhóm chi phí</option>${opt(uniq(x=>x.nhom||"Khác").map(v=>[v,v]),SOCP.nhom)}</select><select id="sp-loai"><option value="">Mọi loại</option>${opt(Object.entries(SP_LOAI).filter(([k])=>all.some(x=>x.loai===k)),SOCP.loai)}</select><select id="sp-kenh"><option value="">Mọi kênh</option><option value="__chung"${SOCP.kenh==="__chung"?" selected":""}>Chi chung (chưa gắn kênh)</option>${opt(uniq(x=>x.kenh).map(v=>[v,v]),SOCP.kenh)}</select><select id="sp-pb"><option value="">Mọi phòng ban</option>${opt(uniq(x=>x.pb).map(v=>[v,v]),SOCP.pb)}</select><select id="sp-src">${opt([["","Tất cả nguồn"],["tay","Nhập tay"],["ncc","Phiếu chi nhà cung cấp"],["vc","Phiếu chi vận chuyển"],["ads","Quảng cáo tự cộng"]],SOCP.src)}</select><input id="sp-q" class="mhq" placeholder="Tìm khoản chi…" value="${esc(SOCP.q||"")}"></div>
  <div class="grid kpis">${kpi(locOn?"Tổng chi (đang lọc)":"Tổng chi",nf(Math.round(tot)),R.length===all.length?all.length+" khoản":R.length+"/"+all.length+" khoản")}${kpi("Marketing, quảng cáo",nf(Math.round(sum(x=>x.nhom==="Marketing"))),"tự cộng và nhập tay")}${kpi("Mua hàng (nhà cung cấp)",nf(Math.round(sum(x=>x.src==="ncc"))),n(x=>x.src==="ncc")+" phiếu chi")}${kpi("Vận chuyển",nf(Math.round(sum(x=>x.src==="vc"))),n(x=>x.src==="vc")+" phiếu chi")}${kpi("Nhập tay",nf(Math.round(sum(x=>x.src==="tay"))),n(x=>x.src==="tay")+" khoản · "+n(x=>x.src==="tay"&&!x.files)+" chưa có ảnh")}</div>

  <section class="card flush">${tbl(["Ngày","Khoản chi","Nhóm · loại","Phòng ban / Kênh","Nguồn · hình thức","Số tiền","Ảnh",""],R.map((x,i)=>{const s=SOCP_SRC[x.src];return `<tr class="${x.open||x.src==="tay"?"clk":""}" data-ri="${i}"><td>${x.kyOnly?"Cả kỳ":x.thangOnly?"T"+x.ngay.slice(5,7):esc(kDd(x.ngay))}</td><td><b>${esc(x.txt)}</b>${x.sub?`<div class="hint">${esc(x.sub)}</div>`:""}</td><td>${esc(x.nhom||"Khác")}<div class="hint">${esc(SP_LOAI[x.loai]||"")}</div></td><td>${esc([x.pb,x.kenh].filter(Boolean).join(" · ")||"—")}</td><td>${pill(s[0],s[1])}<div class="hint">${esc(x.ht||"")}</div>${x.acc?`<div class="hint">${esc(x.acc)}</div>`:""}</td><td class="n"><b>${nf(Math.round(x.tien))}</b></td><td>${x.src==="ads"?"":x.files?pill(x.files+" ảnh","blu"):`<span class="hint">chưa có</span>`}</td><td class="nowrap">${x.src==="tay"&&ed?`<button class="btn sm" data-sf="${i}">Ảnh</button> <button class="btn sm danger" data-sx="${i}">Xóa</button>`:""}</td></tr>`}).concat(R.length?[`<tr class="tot"><td colspan="5"><b>Tổng ${R.length===all.length?"":"(đang lọc)"}</b></td><td class="n"><b>${nf(Math.round(R.reduce((t,x)=>t+x.tien,0)))}</b></td><td colspan="2"></td></tr>`]:[]))}</section>
  ${tot>0?`<div class="qtwo"><section class="card pad"><b>Chi theo nhóm chi phí</b>${qtBars(Object.entries(R.reduce((o,x)=>{o[x.nhom||"Khác"]=(o[x.nhom||"Khác"]||0)+x.tien;return o},{})).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>({l:k,v,t:nf(Math.round(v))+" · "+Math.round(v/tot*100)+"%",c:k==="Marketing"?"x":"b"})))}</section><section class="card pad"><b>Chi theo nguồn</b>${qtBars(["tay","ncc","vc","ads"].map(k=>({l:SOCP_SRC[k][0],v:sum(x=>x.src===k),t:nf(Math.round(sum(x=>x.src===k)))+" · "+Math.round(sum(x=>x.src===k)/tot*100)+"%",c:k==="ads"?"x":"b"})).filter(r=>r.v>0))}</section><section class="card pad"><b>Chi theo kênh · chi chung</b>${qtBars(Object.entries(R.reduce((o,x)=>{const k=x.kenh||"Chi chung, chưa gắn kênh";o[k]=(o[k]||0)+x.tien;return o},{})).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>({l:k,v,t:nf(Math.round(v))+" · "+Math.round(v/tot*100)+"%",c:k.startsWith("Chi chung")?"x":"b"})))}</section><section class="card pad"><b>Chi theo loại</b>${qtBars(Object.entries(R.reduce((o,x)=>{o[x.loai||"C"]=(o[x.loai||"C"]||0)+x.tien;return o},{})).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({l:SP_LOAI[k]||k,v,t:nf(Math.round(v))+" · "+Math.round(v/tot*100)+"%",c:"b"})))}</section></div>`:""}
  <p class="hint">Dòng "Tự động" đã nằm trong P&L, không nhập lại. Phiếu chi nhà cung cấp và vận chuyển lập ở trang riêng (hoặc nút "＋ Ghi nhanh"), tự hiện ở đây. Khoản nhập tay có tháng ghi nhận riêng để vào đúng tháng của P&L.</p>`;
  $("#sp-src").onchange=e=>{SOCP.src=e.target.value;renderMain()};
  [["nhom","#sp-nhom"],["loai","#sp-loai"],["kenh","#sp-kenh"],["pb","#sp-pb"]].forEach(([k,id])=>{$(id).onchange=e=>{SOCP[k]=e.target.value;renderMain()}});
  $("#sp-q").onchange=e=>{SOCP.q=e.target.value;renderMain()};
  if($("#sp-new"))$("#sp-new").onclick=()=>spForm();
  if($("#sp-ncc"))$("#sp-ncc").onclick=async()=>{await mhLoad();mhLoadInv();mhPayForm()};
  if($("#sp-vc"))$("#sp-vc").onclick=()=>{PAGE="cr_vc";try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}render();scrollTo(0,0)};
  m.querySelectorAll("tr[data-ri]").forEach(tr=>tr.onclick=e=>{if(e.target.closest("button"))return;const x=R[+tr.dataset.ri];if(x&&x.open)x.open();else if(x&&x.src==="tay")spFiles(x.id,x.txt)});
  m.querySelectorAll("[data-sf]").forEach(b=>b.onclick=e=>{e.stopPropagation();const x=R[+b.dataset.sf];spFiles(x.id,x.txt)});
  m.querySelectorAll("[data-sx]").forEach(b=>b.onclick=e=>{e.stopPropagation();const x=R[+b.dataset.sx];if(!confirm("Xóa khoản chi \""+x.txt+"\" ("+nf(Math.round(x.tien))+" đ)?"))return;DB.mutate(ME.name,"xóa khoản chi",dt=>{dt.costs=dt.costs.filter(c=>c.id!==x.id)});toast("Đã xóa khoản chi");renderMain()});
}
PAGES.so_cp=pSoCP;
/* Ảnh bill của một khoản chi nhập tay: xem, thêm, xóa. */
async function spFiles(id,title){
  let files=[];try{files=await kApi("/mh/costs/"+id+"/files")}catch(e){toast(e.message)}
  const url=f=>"/api/hub/kho/mh/costs/"+id+"/files/"+f;
  openDrawerHTML(`<h2>Ảnh bill · ${esc(title||"khoản chi")}</h2><div class="mhfiles">${files.length?files.map(f=>f.mime==="application/pdf"?`<div class="mhfile"><a href="${url(f.id)}" target="_blank" rel="noopener">📄 ${esc(f.name||"file.pdf")}</a><button type="button" class="lnk" data-cfd="${f.id}">Xóa</button></div>`:`<div class="mhfile"><a href="${url(f.id)}" target="_blank" rel="noopener"><img src="${url(f.id)}" alt="${esc(f.name)}"></a><button type="button" class="lnk" data-cfd="${f.id}">Xóa</button></div>`).join(""):`<p class="hint">Chưa có ảnh nào.</p>`}</div>
   <label class="field">Thêm ảnh bill chuyển khoản / phiếu chi tiền mặt có chữ ký<input type="file" id="cf-f" multiple accept="image/*,application/pdf"></label><button class="btn" id="cf-up">Tải lên</button>`);
  document.querySelectorAll("[data-cfd]").forEach(b=>b.onclick=async()=>{if(!confirm("Xóa ảnh này?"))return;try{await kApi("/mh/costs/"+id+"/files/"+b.dataset.cfd,{method:"DELETE"});SOCP.files=null;spLoadFiles();spFiles(id,title)}catch(e){toast(e.message)}});
  $("#cf-up").onclick=async()=>{const fs=[...$("#cf-f").files];if(!fs.length)return;$("#cf-up").disabled=true;let n=0;for(const f of fs){try{const d=await mhPrepFile(f);await kApi("/mh/costs/"+id+"/files",{method:"POST",body:JSON.stringify(d)});n++}catch(e){toast(e.message)}}if(n)toast("Đã tải lên "+n+" ảnh");SOCP.files=null;spLoadFiles();spFiles(id,title)}}
/* Form ghi một khoản chi: ngày, tháng ghi nhận (vào P&L), phòng ban, kênh, chuyển khoản hay tiền mặt, tài khoản đi và đến, ảnh bill. */
function spForm(){
  const d=D(),today=mhToday(),cats=d.costCats||[];
  openDrawerHTML(`<h2>Ghi chi phí</h2><p class="hint">Chị Hoa, chị Thảo, chị Huệ ghi thẳng, không chờ duyệt.</p><form class="frm" id="spf">
   <label class="field">Khoản chi<select id="spf-c">${opt(cats.map(c=>[c.k,c.n+" · "+c.nhom]),"")}</select></label>
   <div class="row4"><label class="field">Số tiền (đ)<input id="spf-t" type="number" min="1" required></label><label class="field">Ngày chi<input id="spf-d" type="date" value="${today}" required></label><label class="field">Tháng ghi nhận (vào lãi lỗ)<input id="spf-m" type="month" value="${today.slice(0,7)}" required></label></div>
   <div class="row4"><label class="field">Phòng ban<select id="spf-p">${opt([["","—"]].concat((d.departments||[]).map(p=>[p.k,p.n])),"")}</select></label><label class="field">Kênh (nếu chi riêng cho một kênh)<select id="spf-k">${opt([["","— chi chung —"]].concat((d.saleChannels||[]).map(c=>[c.n,c.n])),"")}</select></label></div>
   ${mhPayMethodHtml("spf")}
   <label class="field">Ghi chú<input id="spf-n"></label><div id="spf-e"></div><button class="btn pri">Lưu</button></form>`);
  mhPayMethodBind("spf","");
  $("#spf-d").onchange=e=>{if(e.target.value)$("#spf-m").value=e.target.value.slice(0,7)};
  $("#spf").onsubmit=async e=>{e.preventDefault();const pm=mhPayMethodRead("spf"),err=t=>{$("#spf-e").innerHTML=`<div class="note red">${esc(t)}</div>`};
    if(pm.method==="CHUYEN_KHOAN"&&(!pm.from_account||!pm.to_account_no))return err("Chuyển khoản: chọn tài khoản công ty chi tiền và ghi số tài khoản nhận.");
    const tien=+$("#spf-t").value;if(!(tien>0))return err("Nhập số tiền.");
    const btn=e.submitter||document.querySelector("#spf button.pri");if(btn)btn.disabled=true;
    const id=uid("cp"),ngay=$("#spf-d").value,thang=$("#spf-m").value||ngay.slice(0,7);
    DB.mutate(ME.name,"nhập chi phí",dt=>dt.costs.push({id,thang,ngay,cat:$("#spf-c").value,tien,pb:$("#spf-p").value,kenh:$("#spf-k").value,sku:"",note:$("#spf-n").value,by:ME.name,...pm}));
    let up=0;for(const f of [...$("#spf-f").files]){try{const x=await mhPrepFile(f);await kApi("/mh/costs/"+id+"/files",{method:"POST",body:JSON.stringify(x)});up++}catch(er){toast(er.message)}}
    closeDrawer();toast("Đã ghi chi phí"+(up?", đính kèm "+up+" ảnh":""));SOCP.files=null;if(PAGE==="so_cp")renderMain()}}
