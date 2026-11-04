/* =====================================================================
   PHÊ DUYỆT (trang quản trị › Phê duyệt): một chỗ gom mọi việc đang chờ duyệt, duyệt / từ chối ngay trên dòng.
   - Gom và lọc quyền ở pdcalc.js (hàm thuần). Ở đây chỉ tải dữ liệu, vẽ bảng, gọi đúng nút duyệt đang có của từng loại:
       đơn / đổi giá / đổi cấp khách  POST /api/approvals/:id/decide       (giống bảng "Yêu cầu chờ duyệt" ở Đơn hàng & duyệt)
       sửa phiếu xuất kho             POST /api/orders/ship-edits/:id/decide (giống Kho › Xuất Kênh phân phối)
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
    const combo=ceo||kt||w.admin?await get("/api/hub/sanpham/unmapped"):[];
    PD.sv={combo,ceoSpend,payConfirm,returns,approvals,shipEdits,proposals,gifts:bon.filter((x,i)=>i%2===0).flat(),cash:bon.filter((x,i)=>i%2===1).flat()};PD.err=""}
  catch(e){PD.err=e.message||"Không tải được"}
  PD.at=Date.now();PD.busy=false;if(PAGE==="pheduyet")renderMain();pdBadge()}
/* Dữ liệu máy chủ (tải ở trên) + phiếu đang chờ trong dữ liệu chung của web (đọc ngay, luôn mới). */
function pdRows(){
  const d=(typeof D==="function"&&D())||{},h=d.hr||{};
  return pdBuild({...(PD.sv||{}),th:pdTh(),pcCho:d.pcCho||[],costsCho:d.costsCho||[],thuCho:d.thuCho||[],hrDon:h.don||[],hrTu:h.tu||[],...(typeof spcPdSrc==="function"?spcPdSrc(d):{}),
    staffName:ma=>{try{return staffBy(ma).ten}catch(e){return ma}}},pdWho());
}
/* CEO chỉ thấy việc của mình trong danh sách duyệt (chị Hoa 03/11); đề xuất agent đã gửi Kho / Sale / Kế toán là việc của phòng đó,
   gom ở mục "Đang chờ ở các phòng" để biết bộ phận nào, ai đang nghẽn. */
const PD_ROUTE_N={KHO:"Kho",SALE:"Sale phụ trách khách",KE_TOAN:"Kế toán"};
const pdProp=r=>r&&r.src==="proposal"?(((PD.sv||{}).proposals||[]).find(p=>p.id===r.ref)||null):null;
/* Việc của kế toán (tiền về chờ xác nhận, combo mới chờ nhập, duyệt combo Digital, combo chờ mã MISA): CEO chỉ theo dõi (chị Hoa 04/11). */
const PD_KT_K=["tien","combo","cbdx"];
const pdOther=r=>{if(!(pdWho().role==="CEO"||pdWho().admin))return false;if(PD_KT_K.includes(r.k))return true;const p=pdProp(r);return !!p&&!!PD_ROUTE_N[p.route_to]};
const pdMine=rows=>rows.filter(r=>!pdOther(r));
const pdCnt=()=>{if(!PD.sv)return "";try{return pdMine(pdRows()).length||""}catch(e){return ""}};
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
    if(r.src==="cbPhieu"&&typeof spcDuyetPhieu==="function"){if(ok){if(confirm("Duyệt phiếu combo \""+r.nd+"\"? Combo mới vào danh sách chạy, combo dừng tự hết hạn."))spcDuyetPhieu(r.ref,true)}else{const t=ask(true);if(t!==null)spcDuyetPhieu(r.ref,false,t)}return}
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
      if(ok&&x&&x.ceo_status==="CHO"){toast("Đã duyệt. Khoản từ ngưỡng chi nên chuyển CEO duyệt");delete PD.doing[r.id];await pdLoad(true);return}}
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
  const all0=pdRows(),others=all0.filter(pdOther),all=pdMine(all0),c=pdCounts(all),L=pdFilter(all,PD.k),now=Date.now(),money=v=>v==null?`<span class="hint">—</span>`:nf(v)+" đ";
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
  ${pdOthersHtml(others,now)}${pdTeamsHtml()}
  <p class="hint">Mỗi người chỉ thấy việc mình được duyệt (đúng quy tắc của trang gốc). Đơn nghỉ phép, OT, tạm ứng duyệt ở trang gốc (bấm Mở). Khoản chi từ ${nf(pdTh())} đ trở lên phải CEO duyệt (đổi mức ở Cấu hình › Ngưỡng cảnh báo).</p>`;
  m.querySelectorAll(".pd-sub").forEach(x=>x.onclick=()=>x.classList.toggle("on"));
  m.querySelectorAll("[data-pdpp]").forEach(b=>b.onclick=()=>{const [t,u]=b.dataset.pdpp.split("|");pdPersonView(t,u)});
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
    m.querySelector(".ph").insertAdjacentHTML("afterend",`<div class="card pad"><div class="tlh"><b>Khoản chi phải CEO duyệt</b></div>
     <form class="frm" id="ng-ceo"><div class="row4"><label class="field">Khoản chi từ (đ) trở lên<input type="number" min="0" step="100000" id="ng-ceo-v" value="${v}" ${ceo?"":"disabled"}><small class="hint">Phiếu chi Sổ chi phí, phiếu chi vận chuyển, chi nhà cung cấp, phiếu chi thưởng NPP. Dưới mức này duyệt như cũ. Để 0 là tắt.</small></label></div>
     ${ceo?'<button class="btn pri">Lưu mức duyệt</button>':'<p class="hint">Chỉ CEO đổi được mức này.</p>'}</form></div>`);
    const fm=m.querySelector("#ng-ceo");if(ceo&&fm)fm.onsubmit=async e=>{e.preventDefault();const n=Math.max(0,Math.round(+m.querySelector("#ng-ceo-v").value||0));
      try{await svApi("/api/settings",{method:"PATCH",body:JSON.stringify({"spend.ceo_threshold_vnd":n})});PD.th=n;toast("Đã lưu: khoản chi từ "+nf(n)+" đ phải CEO duyệt");renderMain()}catch(er){toast(er.message||"Chưa lưu được")}}}catch(e){}}}

/* "Đang chờ ở các phòng" (CEO): bộ phận nào, ai đang giữ, chờ lâu nhất bao nhiêu ngày; chỉ xem, phòng đó tự xử lý */
function pdOthersHtml(L,now){if(!L.length)return "";const by={};
  L.forEach(r=>{const p=pdProp(r)||{route_to:"KE_TOAN"},dep=PD_ROUTE_N[p.route_to]||"Khác",u=p.owner_id?(D().users||[]).find(x=>x.crm===p.owner_id):null,who=p.route_to==="SALE"?(u&&u.name)||"Sale phụ trách":dep;
    const g=by[dep]=by[dep]||{n:0,old:0,ppl:{},rows:[]};g.n++;g.old=Math.max(g.old,r.at?now-r.at:0);g.ppl[who]=(g.ppl[who]||0)+1;g.rows.push({r,who})});
  const dd2=ms=>ms>=864e5?Math.floor(ms/864e5)+" ngày":Math.max(1,Math.floor(ms/36e5))+" giờ";
  return `<details class="card pdoth" open><summary><b>Đang chờ ở các phòng</b> <span class="pill p-gry">${L.length}</span> <span class="hint">việc phòng khác tự xử lý · xem để biết chỗ nào đang nghẽn</span></summary>
   <div class="pdog">${Object.entries(by).sort((a,b)=>b[1].old-a[1].old).map(([dep,g])=>`<div class="pdoc${g.old>3*864e5?" late":""}"><div class="pdoh"><b>${esc(dep)}</b><span>${g.n} việc · chờ lâu nhất <b>${dd2(g.old)}</b></span></div>
     <div class="pdop">${Object.entries(g.ppl).sort((a,b)=>b[1]-a[1]).map(([w,n])=>`<span>${esc(w)} <b>${n}</b></span>`).join("")}</div>
     ${g.rows.sort((a,b)=>(a.r.at||0)-(b.r.at||0)).slice(0,6).map(({r,who})=>`<div class="pdor"><span>${esc(pdProp(r)?r.nd:r.loai+": "+r.nd)}</span><small>${esc(who)} · ${r.at?dd2(now-r.at):""}</small></div>`).join("")}${g.rows.length>6?`<div class="hint">+${g.rows.length-6} việc nữa</div>`:""}</div>`).join("")}</div></details>`}
/* ---------- Việc từng phòng (chị Hoa 04/11): CEO xem các Lead và nhân sự chuyên trách đang làm thế nào ----------
   Số lấy từ hsCalc (cùng nguồn Công việc › Tổng quan). Chỉ để xem, không báo chuông, không vào danh sách duyệt phía trên. */
const pdViAt=s=>{const m=/(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(s||""));if(!m)return 0;const t=/(\d{1,2}):(\d{2})/.exec(String(s));return new Date(+m[3],+m[2]-1,+m[1],t?+t[1]:0,t?+t[2]:0).getTime()};
const pdAgeS=ms=>ms>=864e5?Math.floor(ms/864e5)+" ngày":Math.max(1,Math.floor(ms/36e5))+" giờ";
function pdTeamData(){const d=D(),td=d.settings.today,now=Date.now(),day=864e5,T=d.tasks||[],out=[];
  const N=k=>typeof cvTeamNorm==="function"?cvTeamNorm(k):k,G={};hsTeams().forEach(k=>(G[N(k)]=G[N(k)]||[]).push(k));
  Object.entries(G).forEach(([team,raw])=>{/* một phòng có thể ghi nhiều mã (KT / ketoan, CM / content): gộp, mỗi người tính một lần */
    const ppl=[],U=[],C=[],per={},own={};raw.forEach(k=>{const r=hsCalc(d,td,k,true),mine=r.ppl.filter(u=>N(teamOf(u))===team&&!per[u.id]);
      mine.forEach(u=>{ppl.push(u);per[u.id]=r.per[u.id]});const ok=new Set(mine.map(u=>u.id));
      r.U.forEach(x=>{if(ok.has(x.ng))U.push(x)});r.C.forEach(c=>{const o=r.cOwn(c);if(ok.has(o)&&!own[c.id]){own[c.id]=o;C.push(c)}})});
    if(!ppl.length)return;const cOwn=c=>own[c.id];
    const items=[];
    U.filter(x=>x.st!=="done").forEach(x=>{const t=T.find(y=>y.id===x.id)||{},rv=x.st==="review",late=x.han&&x.han<td?(td-x.han)*day:0,wait=rv?Math.max(0,now-(pdViAt(t.nopAt)||now)):0;
      items.push({ng:x.ng,ten:x.ten,rv,late,age:Math.max(late,wait),txt:rv?"chờ duyệt"+(wait?" "+pdAgeS(wait):""):late?"trễ "+pdAgeS(late):x.han?"hạn "+dd(x.han):"đang làm"})});
    C.filter(c=>!["dang","xong"].includes(c.step)).forEach(c=>{const rv=["dkb","dvd"].includes(c.step),h=(c.history||[]).slice(-1)[0],wait=rv&&h?Math.max(0,now-(pdViAt(h.t)||now)):0,lt=typeof isLate==="function"&&isLate(c)?Math.max(1,td-((c.han&&WORK_STEPS.includes(c.step))?c.han:c.day))*day:0;
      items.push({ng:cOwn(c),ten:(c.id+" · "+(c.hookText||c.yTuong||sk(c.sku).n)).slice(0,70),rv,late:lt,age:Math.max(lt,wait),txt:stepName(c.step)+(rv&&wait?" "+pdAgeS(wait):lt?" · trễ "+pdAgeS(lt):"")})});
    const kenh=Object.keys(d.kenhPT||{}),tag=u=>[tkLead(u)?"Lead":"",kenh.some(k=>chanOwner(k)===u.id)?"Giữ kênh":"",kenh.some(k=>chanHelp(k).includes(u.id))?"Hỗ trợ kênh":""].filter(Boolean);
    const ok=new Set(ppl.map(u=>u.id));for(let i=items.length-1;i>=0;i--)if(!ok.has(items[i].ng))items.splice(i,1);
    const P=ppl.map(u=>{const p=per[u.id],L=items.filter(i=>i.ng===u.id).sort((a,b)=>b.age-a.age);return {u,tags:tag(u),doing:p.doing,late:p.late,rv:p.rv,mo:p.mo,old:L[0]?L[0].age:0,L}})
      .sort((a,b)=>(b.tags.includes("Lead")-a.tags.includes("Lead"))||b.late-a.late||b.old-a.old);
    const lead=P.filter(p=>p.tags.includes("Lead")).map(p=>p.u.name),rvL=items.filter(i=>i.rv).sort((a,b)=>b.age-a.age),lateN=items.filter(i=>i.late).length;
    out.push({team,name:cvTeamName(team),lead,P,rvN:rvL.length,rvOld:rvL[0]?rvL[0].age:0,lateN,old:Math.max(0,...items.map(i=>i.age)),top:items.filter(i=>i.rv||i.late).sort((a,b)=>b.age-a.age).slice(0,3)})});
  return out.sort((a,b)=>b.old-a.old)}
function pdTeamsHtml(){if(ME.role!=="admin")return "";const R=pdTeamData();if(!R.length)return "";
  return `<div class="pdtm"><div class="pdtmh"><b>Việc từng phòng</b><span class="hint">Lead và từng nhân sự chuyên trách · cùng số với Công việc › Tổng quan · bấm tên để xem việc của người đó</span></div>
   <div class="pdog">${R.map(g=>`<div class="pdoc${g.old>3*864e5?" late":""}"><div class="pdoh"><b>${esc(g.name)}</b><span>${g.lead.length?"Lead: "+esc(g.lead.join(", ")):"chưa có Lead"}</span></div>
     <div class="pdts"><span>Chờ Lead duyệt <b>${g.rvN}</b>${g.rvOld?` · lâu nhất <b>${pdAgeS(g.rvOld)}</b>`:""}</span><span${g.lateN?' class="t-red"':""}>Trễ hạn <b>${g.lateN}</b></span></div>
     <table class="pdpt"><tr><th>Người</th><th title="Đang làm">Làm</th><th>Trễ</th><th title="Chờ duyệt">Chờ</th><th>Lâu nhất</th></tr>${g.P.map(p=>`<tr><td><button type="button" class="lnk" data-pdpp="${esc(g.team)}|${esc(p.u.id)}">${esc(p.u.name)}</button>${p.tags.map(t=>`<small class="pdtag">${t}</small>`).join("")}</td><td class="n">${p.doing||""}</td><td class="n">${p.late?`<span class="pill p-red">${p.late}</span>`:""}</td><td class="n">${p.rv?`<span class="pill p-amb">${p.rv}</span>`:""}</td><td class="n${p.old>3*864e5?" t-red":""}">${p.old?pdAgeS(p.old):""}</td></tr>`).join("")}</table>
     ${g.top.map(i=>`<div class="pdor"><span>${esc(i.ten)}</span><small>${esc(userName(i.ng)||"")} · ${esc(i.txt)}</small></div>`).join("")}</div>`).join("")}</div></div>`}
function pdPersonView(team,uid){const g=pdTeamData().find(x=>x.team===team),p=g&&g.P.find(x=>x.u.id===uid);if(!p)return;
  openDrawerHTML(`<h2>${esc(p.u.name)} <small class="hint">${esc(g.name)}${p.tags.length?" · "+p.tags.join(", "):""}</small></h2>
   <div class="pdts"><span>Đang mở <b>${p.L.length}</b></span><span>Đang làm <b>${p.doing}</b></span><span class="${p.late?"t-red":""}">Trễ <b>${p.late}</b></span><span>Chờ duyệt <b>${p.rv}</b></span></div>
   ${p.L.length?`<div class="pdpl">${p.L.map(i=>`<div class="pdor"><span>${esc(i.ten)}</span><small class="${i.late?"t-red":""}">${esc(i.txt)}</small></div>`).join("")}</div>`:`<p class="hint">Không có việc đang mở.</p>`}
   <p class="hint">Chỉ để xem. Muốn sửa việc thì vào Công việc.</p>`)}
