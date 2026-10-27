/* =====================================================================
   PHÊ DUYỆT (trang quản trị › Phê duyệt): một chỗ gom mọi việc đang chờ duyệt, duyệt / từ chối ngay trên dòng.
   - Gom và lọc quyền ở pdcalc.js (hàm thuần). Ở đây chỉ tải dữ liệu, vẽ bảng, gọi đúng nút duyệt đang có của từng loại:
       đơn / đổi giá / đổi cấp khách  POST /api/approvals/:id/decide       (giống bảng "Yêu cầu chờ duyệt" ở Đơn hàng & duyệt)
       sửa phiếu xuất kho             POST /api/orders/ship-edits/:id/decide (giống Kho › Xuất B2B)
       đề xuất agent                  POST /api/proposals/:id/decide
       phiếu quà / chi thưởng NPP     POST /api/bonus/{gifts|cash}/:id/approve, từ chối = hủy phiếu /cancel (giống trang Thưởng NPP)
       phiếu chi (Sổ chi phí)         scDuyet / scTuChoi của sochi.js
       chi phí chờ phân bổ (cũ)       cpApprove của cpduyet.js, chỉ dòng web đoán chắc; dòng khác mở trang gốc để chọn khoản chi
       phiếu thu chờ xác nhận         cptXacNhan của cpthu.js
       tiền về chờ xác nhận           POST /api/payments/:id/confirm (giống Việc của tôi / Kho bill)
       hàng trả lại chờ chốt giảm nợ  POST /api/returns/:id/confirm (chọn trừ công nợ / hoàn tiền như trang Hàng trả lại)
       khoản chi chờ CEO (vận chuyển, nhà cung cấp)  POST /api/ceo-spend/{ship|ncc}/:id/approve; từ chối = hủy phiếu ở nút hủy đang có
     Đơn nghỉ / OT / tạm ứng chưa có nút duyệt dùng chung: chỉ hiện dòng + nút mở trang gốc.
   - Ngưỡng chi phải CEO duyệt (mặc định 5 triệu): đọc /api/ceo-spend, chị Hoa đổi ở Cấu hình › Ngưỡng cảnh báo (ô thêm ở cuối file này).
   - Máy chủ vẫn kiểm quyền ở từng API như cũ; trang này không đổi quy tắc ai được duyệt.
   ===================================================================== */
const PD={sv:null,at:0,busy:false,err:"",k:"",doing:{},view:null,th:null};
/* Ngưỡng chi phải CEO duyệt; chưa tải được thì dùng mặc định 5 triệu (giống máy chủ). Sổ chi phí dùng hàm này. */
const pdTh=()=>PD.th==null?5e6:PD.th;
function pdThLoad(){if(PD.th!=null||PD.thBusy||typeof svApi!=="function")return;PD.thBusy=1;svApi("/api/ceo-spend").then(r=>{PD.th=+r.threshold}).catch(()=>{}).finally(()=>{PD.thBusy=0})}
const pdWho=()=>({role:typeof crmRole==="function"?crmRole():"",uid:(typeof SV!=="undefined"&&SV.me&&SV.me.id)||"",perms:(typeof SV!=="undefined"&&SV.perms)||[],
  admin:!!ME&&ME.role==="admin",ns:!!ME&&(can(ME,"nhansu.duyet")||can(ME,"nhansu.quanly"))});
const pdAny=()=>{if(!ME)return false;const w=pdWho(),P=n=>w.perms.includes(n);return w.role==="CEO"||w.admin||w.ns||P("order.approve.normal")||P("order.approve.exception")||P("order.accounting.confirm")};
const pdYm=back=>{const d=new Date(Date.now()+7*3600e3);d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-back);return d.toISOString().slice(0,7)};
async function pdLoad(force){
  if(PD.busy||!ME||typeof svApi!=="function")return;if(!force&&PD.at&&Date.now()-PD.at<60000)return;
  PD.busy=true;const w=pdWho(),P=n=>w.perms.includes(n),ceo=w.role==="CEO",get=p=>svApi(p).catch(()=>[]);
  try{
    const ap=P("order.approve.normal")||P("order.approve.exception"),th=ceo||P("order.approve.normal");
    const months=[0,1,2].map(pdYm);
    const kt=P("order.accounting.confirm");
    const [cs,ceoSpend,payConfirm,returns,approvals,shipEdits,proposals,...bon]=await Promise.all([svApi("/api/ceo-spend").catch(()=>null),ceo?get("/api/ceo-spend/pending"):[],
      ceo||kt?get("/api/work/queue/pay_confirm"):[],kt?get("/api/returns?status=DA_NHAN_KHO"):[],
      ap?get("/api/approvals?status=PENDING"):[],th?get("/api/orders/ship-edits"):[],get("/api/proposals?status=PENDING"),
      ...months.flatMap(m=>th?[get("/api/bonus/gifts?month="+m),get("/api/bonus/cash?month="+m)]:[])]);
    if(cs&&cs.threshold!=null)PD.th=+cs.threshold;
    PD.sv={ceoSpend,payConfirm,returns,approvals,shipEdits,proposals,gifts:bon.filter((x,i)=>i%2===0).flat(),cash:bon.filter((x,i)=>i%2===1).flat()};PD.err=""}
  catch(e){PD.err=e.message||"Không tải được"}
  PD.at=Date.now();PD.busy=false;if(PAGE==="pheduyet")renderMain();pdBadge()}
/* Dữ liệu máy chủ (tải ở trên) + phiếu đang chờ trong dữ liệu chung của web (đọc ngay, luôn mới). */
function pdRows(){
  const d=(typeof D==="function"&&D())||{},h=d.hr||{};
  return pdBuild({...(PD.sv||{}),th:pdTh(),pcCho:d.pcCho||[],costsCho:d.costsCho||[],thuCho:d.thuCho||[],hrDon:h.don||[],hrTu:h.tu||[],
    staffName:ma=>{try{return staffBy(ma).ten}catch(e){return ma}}},pdWho());
}
const pdCnt=()=>{if(!PD.sv)return "";try{return pdRows().length||""}catch(e){return ""}};
/* Mục Phê duyệt chỉ có một trang nên thanh bên không có dòng con: gắn số chờ vào nút mục. */
function pdBadge(){const b=document.querySelector('.top[data-mod="q_pd"]');if(!b)return;const old=b.querySelector("b.pdn");if(old)old.remove();const n=pdCnt();if(n)b.querySelector("span").insertAdjacentHTML("afterend",`<b class="pdn">${n}</b>`)}
function pdOpen(r){
  if(r.src==="pcCho"){const x=((D().pcCho)||[]).find(y=>y.id===r.ref);if(x&&typeof scPhieu==="function"){scPhieu(x,true);return}}
  /* Trang gốc (đơn hàng, khách, nhân sự…) nhiều trang không nằm trong menu quản trị: mở ngay trong trang này, có nút quay lại. */
  PD.view={...(r.open||{}),t:r.loai+" · "+r.nd};renderMain();scrollTo(0,0)}
function pdView(m){const v=PD.view;
  m.innerHTML=`<p><button type="button" class="lnk" id="pd-back">← Về Phê duyệt</button> <span class="hint">${esc(v.t||"")}</span></p><div id="pd-src"></div>`;
  $("#pd-back").onclick=()=>{PD.view=null;PD.at=0;renderMain()};
  const s=m.querySelector("#pd-src");
  if(v.path)s.innerHTML='<div class="crmembed"><iframe id="crmfr" src="'+esc(v.path)+'" title="Chứng từ gốc"></iframe></div>';
  else if(PAGES[v.page])PAGES[v.page](s);else s.innerHTML='<p class="empty pad">Không mở được trang gốc.</p>'}
async function pdAct(r,ok){
  const post=(p,b)=>svApi(p,{method:"POST",body:JSON.stringify(b||{})});
  const ask=(need)=>{const t=prompt(need?"Lý do từ chối (bắt buộc):":"Lý do từ chối (có thể bỏ trống):");if(t===null)return null;if(need&&t.trim().length<3){toast("Ghi lý do ít nhất vài chữ");return null}return t.trim()};
  if(r.act==="fn"){
    if(r.src==="pcCho"){if(ok){if(confirm("Duyệt phiếu chi \""+r.nd+"\" vào sổ?"))scDuyet(r.ref)}else if(confirm("Trả lại phiếu chi \""+r.nd+"\"?"))scTuChoi(r.ref);return}
    if(r.src==="costsCho"&&ok){if(confirm("Duyệt khoản \""+r.nd+"\" theo đề xuất của web ("+r.sub+")?"))cpApprove([r.ref]);return}
    if(r.src==="thuCho"&&ok&&typeof cptXacNhan==="function"){if(confirm("Xác nhận phiếu thu \""+r.nd+"\" ("+nf(r.tien)+" đ) vào Sổ thu?"))cptXacNhan(r.ref);return}
    return}
  if(r.src==="return"&&ok)return pdReturn(r);
  let note=null;
  if(ok&&r.src==="payment"){if(!confirm("Xác nhận đã nhận "+nf(r.tien)+" đ của "+r.nd+"?"))return}
  else if(ok){if(!confirm("Duyệt: "+r.loai+" · "+r.nd+"?"+(r.src==="gift"?" Web tạo phiếu xuất kho quà như ở trang Thưởng NPP.":"")))return}
  else{note=ask(r.src==="shipEdit"||r.src==="gift"||r.src==="cash"||r.src==="ceo_ship");if(note===null)return}
  PD.doing[r.id]=1;renderMain();
  try{
    if(r.src==="approval")await post("/api/approvals/"+r.ref+"/decide",{decision:ok?"APPROVED":"REJECTED",note:note||null});
    else if(r.src==="shipEdit")await post("/api/orders/ship-edits/"+r.ref+"/decide",{decision:ok?"APPROVED":"REJECTED",note});
    else if(r.src==="proposal")await post("/api/proposals/"+r.ref+"/decide",{decision:ok?"ACCEPTED":"REJECTED",note:note||null});
    else if(r.src==="gift"||r.src==="cash"){const x=await post("/api/bonus/"+(r.src==="gift"?"gifts":"cash")+"/"+r.ref+(ok?"/approve":"/cancel"),ok?{}:{reason:note});
      if(ok&&x&&x.ceo_status==="CHO"){toast("Đã duyệt. Khoản từ ngưỡng chi nên chuyển chị Hoa duyệt");delete PD.doing[r.id];await pdLoad(true);return}}
    else if(r.src==="payment")await post("/api/payments/"+r.ref+"/confirm",{confirmed:true});
    else if(r.src==="ceo_ship")await post(ok?"/api/ceo-spend/ship/"+r.ref+"/approve":"/api/shipping-vouchers/"+r.ref+"/cancel",ok?{}:{reason:note});
    else if(r.src==="ceo_ncc")await post(ok?"/api/ceo-spend/ncc/"+r.ref+"/approve":"/api/hub/kho/mh/payments/"+r.ref+"/cancel",{});
    toast(ok?(r.ok?"Đã xác nhận":"Đã duyệt"):"Đã từ chối");if(r.src==="shipEdit"&&typeof KHO!=="undefined")KHO.at=0}
  catch(e){toast(e.message||"Chưa xử lý được")}
  delete PD.doing[r.id];await pdLoad(true)}
/* Hàng trả lại: chọn cách xử lý tiền như ở trang Hàng trả lại, giữ nguyên đơn giá kho đã nhận (muốn sửa giá từng dòng thì bấm Mở). */
function pdReturn(r){
  openDrawerHTML(`<h2>Chốt giảm nợ ${esc(r.nd)}</h2><p class="hint">Kho đã nhận hàng · giá trị ${nf(r.tien)} đ. Muốn sửa đơn giá / khấu trừ từng dòng thì đóng lại, bấm Mở.</p>
   <label class="field">Xử lý tiền cho khách<select id="pdr-r"><option value="TRU_CONG_NO">Trừ vào công nợ / bù vào đơn sau</option><option value="HOAN_TIEN">Hoàn tiền cho khách</option></select></label>
   <label class="field">Ghi chú của kế toán<input id="pdr-n"></label><div class="acts" style="margin-top:12px"><button class="btn pri" id="pdr-ok">Xác nhận giảm công nợ ${nf(r.tien)} đ</button><span id="pdr-m" class="hint"></span></div>`);
  $("#pdr-ok").onclick=async()=>{const b=$("#pdr-ok");b.disabled=true;
    try{await svApi("/api/returns/"+r.ref+"/confirm",{method:"POST",body:JSON.stringify({resolution:$("#pdr-r").value,note:$("#pdr-n").value.trim()||null})});closeDrawer();toast("Đã giảm công nợ "+nf(r.tien)+" đ");await pdLoad(true)}
    catch(e){$("#pdr-m").textContent=e.message||"Chưa xác nhận được";b.disabled=false}}}
function pPheDuyet(m){
  if(PD.view)return pdView(m);
  if(!PD.sv){m.innerHTML=H("Phê duyệt","Đang tải các việc chờ duyệt…");pdLoad();return}
  pdLoad();
  const all=pdRows(),c=pdCounts(all),L=pdFilter(all,PD.k),now=Date.now(),money=v=>v==null?`<span class="hint">—</span>`:nf(v)+" đ";
  const chips=[["","Tất cả",all.length]].concat(PD_KINDS.filter(([k])=>c[k]).map(([k,n])=>[k,n,c[k]]));
  m.innerHTML=H("Phê duyệt","Mọi việc đang chờ bạn duyệt · chờ lâu nhất ở trên · bấm Mở để xem chứng từ gốc")+
  (PD.err?`<div class="note red">${esc(PD.err)}</div>`:"")+
  `<div class="filters">${chips.map(([k,n,x])=>`<button class="btn sm${PD.k===k?" pri":""}" data-pdk="${k}">${esc(n)} <b>${x}</b></button>`).join(" ")}<span class="sp"></span><button class="btn sm" id="pd-re">Tải lại</button></div>
  <style>.pd-t td{font-size:12.5px;font-weight:400;vertical-align:top}.pd-t .pill{font-size:11px;font-weight:500}.pd-nd{font-weight:500;line-height:1.35}.pd-sub{font-size:11.5px;font-weight:400;line-height:1.4;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer}.pd-sub.on{display:block}.pd-t .btn.sm{font-size:12px}</style>
  <section class="card flush">${L.length?tbl(["Loại","Nội dung","Số tiền","Người đề xuất","Chờ",""],L.map((r,i)=>{const busy=PD.doing[r.id];
    const noRej=["costsCho","thuCho","payment","return"].includes(r.src);
    const btn=r.act?`<button class="btn sm pri" data-pdok="${i}"${busy?" disabled":""}>${esc(r.ok||"Duyệt")}</button>${noRej?"":` <button class="btn sm danger" data-pdno="${i}"${busy?" disabled":""}>Từ chối</button>`}`:`<span class="hint">duyệt ở trang gốc</span>`;
    const age=pdAge(r.at,now),old=r.at&&now-r.at>3*864e5;
    return `<tr><td>${pill(PD_KIND_N(r.k),"gry")}${r.ceoCho?" "+pill("chờ CEO","amb"):""}${r.loai!==PD_KIND_N(r.k)&&r.loai!=="Đề xuất agent"?`<div class="hint">${esc(r.loai)}</div>`:""}</td><td><div class="pd-nd">${esc(r.nd)}</div>${r.sub?`<div class="hint pd-sub" title="Bấm để xem đủ">${esc(r.sub)}</div>`:""}</td><td class="n">${money(r.tien)}</td><td>${esc(r.by||"—")}</td><td class="nowrap${old?" t-red":""}">${esc(age||"—")}</td>
    <td class="nowrap">${btn} <button class="btn sm" data-pdgo="${i}">Mở</button></td></tr>`}),"pd-t"):`<p class="empty pad">${all.length?"Không có việc nào thuộc loại này.":"Không có việc nào đang chờ bạn duyệt."}</p>`}</section>
  <p class="hint">Mỗi người chỉ thấy việc mình được duyệt (đúng quy tắc của trang gốc). Đơn nghỉ phép, OT, tạm ứng duyệt ở trang gốc (bấm Mở). Khoản chi từ ${nf(pdTh())} đ trở lên phải chị Hoa duyệt (đổi mức ở Cấu hình › Ngưỡng cảnh báo).</p>`;
  m.querySelectorAll(".pd-sub").forEach(x=>x.onclick=()=>x.classList.toggle("on"));
  m.querySelectorAll("[data-pdk]").forEach(b=>b.onclick=()=>{PD.k=b.dataset.pdk;renderMain()});
  $("#pd-re").onclick=()=>{PD.at=0;pdLoad(true)};
  m.querySelectorAll("[data-pdok]").forEach(b=>b.onclick=()=>pdAct(L[+b.dataset.pdok],true));
  m.querySelectorAll("[data-pdno]").forEach(b=>b.onclick=()=>pdAct(L[+b.dataset.pdno],false));
  m.querySelectorAll("[data-pdgo]").forEach(b=>b.onclick=()=>pdOpen(L[+b.dataset.pdgo]));
}
PAGES.pheduyet=pPheDuyet;
/* Chỉ trang quản trị: mục nguồn ẩn để menubang.js lấy trang vào mục "Phê duyệt" (giữa Ngân sách & chi phí và Cấu hình). */
MODULES.push({k:"pd_src",adm:true,hide:true,ic:"check",n:"Phê duyệt",zone:"",sub:"",groups:()=>[["",[MI("pheduyet","Phê duyệt",()=>pdAny(),pdCnt)]]]});
{const _r=render;render=function(){const r=_r.apply(this,arguments);try{if(ME)pdThLoad();if(typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin"&&ME){if(PAGE!=="pheduyet")PD.view=null;pdBadge();if(!PD.at)pdLoad()}}catch(e){}return r}}
/* Cấu hình › Ngưỡng cảnh báo: thêm ô "Khoản chi phải chị Hoa duyệt". Lưu ở máy chủ (app_settings) để máy chủ và web dùng chung một số; chỉ CEO sửa. */
{const _n=PAGES.nguong;if(_n)PAGES.nguong=function(m){_n.apply(this,arguments);
  try{const ceo=typeof crmRole==="function"&&crmRole()==="CEO",v=pdTh();
    m.querySelector(".ph").insertAdjacentHTML("afterend",`<div class="card pad"><div class="tlh"><b>Khoản chi phải chị Hoa duyệt</b></div>
     <form class="frm" id="ng-ceo"><div class="row4"><label class="field">Khoản chi từ (đ) trở lên<input type="number" min="0" step="100000" id="ng-ceo-v" value="${v}" ${ceo?"":"disabled"}><small class="hint">Phiếu chi Sổ chi phí, phiếu chi vận chuyển, chi nhà cung cấp, phiếu chi thưởng NPP. Dưới mức này duyệt như cũ. Để 0 là tắt.</small></label></div>
     ${ceo?'<button class="btn pri">Lưu mức duyệt</button>':'<p class="hint">Chỉ chị Hoa đổi được mức này.</p>'}</form></div>`);
    const fm=m.querySelector("#ng-ceo");if(ceo&&fm)fm.onsubmit=async e=>{e.preventDefault();const n=Math.max(0,Math.round(+m.querySelector("#ng-ceo-v").value||0));
      try{await svApi("/api/settings",{method:"PATCH",body:JSON.stringify({"spend.ceo_threshold_vnd":n})});PD.th=n;toast("Đã lưu: khoản chi từ "+nf(n)+" đ phải chị Hoa duyệt");renderMain()}catch(er){toast(er.message||"Chưa lưu được")}}}catch(e){}}}
