/* =====================================================================
   PHIẾU THU (sổ thu chi): chị Thảo ghi nhanh chọn "Phiếu thu" hoặc "Phiếu chi", chị Huệ xác nhận, vào Sổ thu.
   - Phiếu thu chờ xác nhận: D().thuCho. Xác nhận xong: D().thuTay (nguồn của Sổ thu).
   - Tiền NPP / đại lý: chị Thảo đã xác nhận ở đơn B2C trên trang vận hành (ghi nợ, thu nợ), KHÔNG ghi lại ở đây để khỏi trùng.
   - Tiền sàn trả về tài khoản: kế toán đối soát ở "Đối soát tiền về".
   - Phiếu thu ở đây dành cho khoản thu ngoài hai luồng trên (khách lẻ chuyển khoản, khách gia công, hoàn tiền nhà cung cấp, thu khác).
   ===================================================================== */
const CPT_NGUON=[["gc","Khách gia công"],["le","Khách lẻ chuyển khoản"],["hoan","Nhà cung cấp hoàn tiền"],["sanrut","Tiền sàn rút về (chưa đối soát)"],["khac","Thu khác"],["npp","NPP / đại lý (đã xác nhận ở B2C, ghi lại chỉ khi chị Thảo chưa làm)"]];
const cptNg=k=>(CPT_NGUON.find(x=>x[0]===k)||["","Thu khác"])[1];
function cptQuick(){
  const today=mhToday();
  openDrawerHTML(`<h2>Ghi phiếu thu</h2><div class="mhpm"><label class="chk"><input type="radio" name="cq-t" value="chi"> Phiếu chi</label><label class="chk"><input type="radio" name="cq-t" value="thu" checked> Phiếu thu</label></div>
  <div class="note amb">Tiền <b>NPP, đại lý</b> chị Thảo đã xác nhận ở đơn B2C trên trang vận hành, không ghi lại ở đây. Tiền sàn về tài khoản: kế toán ghi ở Đối soát tiền về.</div>
  <form class="frm" id="cqt">
   <label class="field">Thu của ai, thu việc gì<input id="cqt-n" required placeholder="Ví dụ: Khách gia công ABC chuyển cọc đợt 1"></label>
   <div class="row4"><label class="field">Số tiền (đ)<input id="cqt-t" type="number" min="1" required></label><label class="field">Ngày thu<input id="cqt-d" type="date" value="${today}" required></label></div>
   <label class="field">Nguồn thu<select id="cqt-g">${opt(CPT_NGUON,"khac")}</select></label>
   <label class="field">Tiền về tài khoản<select id="cqt-a"><option value="">Đang tải tài khoản…</option></select></label>
   <label class="field">Ảnh bill, ảnh sao kê (nếu có)<input type="file" id="cqt-f" multiple accept="image/*,application/pdf"></label>
   <div id="cqt-e"></div><button class="btn pri">Gửi chị Huệ xác nhận</button></form>`);
  document.querySelectorAll('input[name="cq-t"]').forEach(x=>x.onchange=()=>{if(x.value==="chi"&&x.checked)cpQuick()});
  mhAccts().then(A=>{const s=$("#cqt-a");if(!s)return;s.innerHTML=A.map(a=>`<option>${esc(mhAcctLabel(a))}</option>`).join("")+`<option>Tiền mặt tại công ty</option>`}).catch(()=>{const s=$("#cqt-a");if(s)s.innerHTML=`<option>Tiền mặt tại công ty</option>`});
  $("#cqt").onsubmit=async e=>{e.preventDefault();const tien=+$("#cqt-t").value;if(!(tien>0)){$("#cqt-e").innerHTML=`<div class="note red">Nhập số tiền.</div>`;return}
    const btn=e.submitter||document.querySelector("#cqt button.pri");if(btn)btn.disabled=true;
    const id=uid("th"),ngay=$("#cqt-d").value,note=$("#cqt-n").value.trim(),nguon=$("#cqt-g").value,acct=$("#cqt-a").value;
    DB.mutate(ME.name,"ghi phiếu thu chờ xác nhận",dt=>{if(!dt.thuCho)dt.thuCho=[];dt.thuCho.push({id,ngay,thang:ngay.slice(0,7),tien,note,nguon,acct,by:ME.name,at:Date.now()})});
    let up=0;for(const f of [...$("#cqt-f").files]){try{const x=await mhPrepFile(f);await kApi("/mh/costs/"+id+"/files",{method:"POST",body:JSON.stringify(x)});up++}catch(er){toast(er.message)}}
    closeDrawer();toast("Đã gửi chị Huệ xác nhận phiếu thu"+(up?", đính kèm "+up+" ảnh":""));if(["cp_duyet","cp_thu"].includes(PAGE))renderMain()}}
/* Chọn phiếu thu / phiếu chi ngay trong form ghi chi phí */
{const _q=cpQuick;cpQuick=function(){_q.apply(this,arguments);try{const h=document.querySelector("#cqf");if(!h)return;
  h.insertAdjacentHTML("beforebegin",`<div class="mhpm"><label class="chk"><input type="radio" name="cq-t" value="chi" checked> Phiếu chi</label><label class="chk"><input type="radio" name="cq-t" value="thu"> Phiếu thu</label></div>`);
  document.querySelectorAll('input[name="cq-t"]').forEach(x=>x.onchange=()=>{if(x.value==="thu"&&x.checked)cptQuick()})}catch(e){}};spForm=cpQuick}
/* Chị Huệ xác nhận một phiếu thu: chuyển từ Chờ xác nhận sang Sổ thu (dùng ở Chờ phân bổ và trang Phê duyệt). */
function cptXacNhan(id,ng){if(!cpCan())return;
  DB.mutate(ME.name,"xác nhận phiếu thu",dt=>{const i=(dt.thuCho||[]).findIndex(x=>x.id===id);if(i<0)return;const p=dt.thuCho.splice(i,1)[0];if(!dt.thuTay)dt.thuTay=[];dt.thuTay.push({...p,nguon:ng||p.nguon||"khac",duyet:ME.name,duyetAt:Date.now()})});toast("Đã xác nhận phiếu thu");renderMain()}
/* Chờ phân bổ: thêm bảng phiếu thu chờ xác nhận */
{const _d=PAGES.cp_duyet;PAGES.cp_duyet=function(m){_d.apply(this,arguments);
  try{const d=D(),L=(d.thuCho||[]).slice().sort((a,b)=>String(a.ngay).localeCompare(String(b.ngay))),can2=cpCan();if(!L.length)return;
    const files=SOCP.files||{};
    m.insertAdjacentHTML("beforeend",`<section class="card flush"><div class="card-h pad"><h2>Phiếu thu chờ xác nhận</h2><span class="hint">${L.length} phiếu · ${nf(Math.round(L.reduce((t,x)=>t+x.tien,0)))} đ</span></div>
    ${tbl(["Ngày","Nội dung","Số tiền","Nguồn thu","Tiền về","Ảnh",""],L.map(x=>`<tr data-th="${x.id}"><td>${esc(kDd(x.ngay))}</td><td><b>${esc(x.note)}</b><div class="hint">${esc(x.by||"")}</div></td><td class="n"><b>${nf(Math.round(x.tien))}</b></td><td>${can2?`<select data-tn>${opt(CPT_NGUON,x.nguon||"khac")}</select>`:esc(cptNg(x.nguon))}</td><td>${esc(x.acct||"—")}</td><td>${files[x.id]?pill(files[x.id]+" ảnh","blu"):`<span class="hint">chưa có</span>`} <button class="btn sm" data-tfi="${x.id}">Ảnh</button></td><td class="nowrap">${can2?`<button class="btn sm pri" data-tok="${x.id}">Xác nhận</button> <button class="btn sm danger" data-tdel="${x.id}">Xóa</button>`:""}</td></tr>`))}</section>`);
    m.querySelectorAll("[data-tok]").forEach(b=>b.onclick=()=>{const id=b.dataset.tok,sel=m.querySelector(`tr[data-th="${id}"] [data-tn]`);cptXacNhan(id,sel?sel.value:"khac")});
    m.querySelectorAll("[data-tdel]").forEach(b=>b.onclick=()=>{const x=L.find(y=>y.id===b.dataset.tdel);if(!confirm("Xóa phiếu thu \""+x.note+"\" ("+nf(Math.round(x.tien))+" đ)?"))return;DB.mutate(ME.name,"xóa phiếu thu chờ",dt=>{dt.thuCho=(dt.thuCho||[]).filter(y=>y.id!==x.id)});renderMain()});
    m.querySelectorAll("[data-tfi]").forEach(b=>b.onclick=()=>{const x=L.find(y=>y.id===b.dataset.tfi);spFiles(x.id,x.note)})}catch(e){}}}
/* ---------- Sổ thu ---------- */
function pCpThu(m){
  const d=D(),inP=c=>c.ngay?spInP(c.ngay):spMonthIn(c.thang),L=(d.thuTay||[]).filter(inP).sort((a,b)=>String(b.ngay).localeCompare(String(a.ngay))),tot=L.reduce((t,x)=>t+x.tien,0),cho=(d.thuCho||[]).length;
  spLoadFiles();const files=SOCP.files||{},by={};L.forEach(x=>{by[x.nguon||"khac"]=(by[x.nguon||"khac"]||0)+x.tien});
  m.innerHTML=H("Sổ thu","Các khoản thu ghi tay đã xác nhận · "+pLabel())+
  `<div class="filters"><button class="btn pri" id="ct-new">＋ Ghi phiếu thu</button><span class="sp"></span>${cho?`<button class="btn" id="ct-cho">${cho} phiếu thu chờ xác nhận</button>`:""}</div>
  <div class="note">Sổ này chỉ có phiếu thu ghi tay. Tiền <b>NPP, đại lý</b> xem ở Phải thu & tuổi nợ (chị Thảo xác nhận ở đơn B2C). Tiền <b>sàn về</b> xem ở Đối soát tiền về.</div>
  <div class="grid kpis">${kpi("Tổng thu trong kỳ",nf(Math.round(tot)),L.length+" phiếu")}${Object.entries(by).map(([k,v])=>kpi(cptNg(k).split(" (")[0],nf(Math.round(v)),"")).join("")}</div>
  <section class="card flush">${L.length?tbl(["Ngày","Nội dung","Nguồn thu","Tiền về","Số tiền","Ảnh",""],L.map(x=>`<tr><td>${esc(kDd(x.ngay))}</td><td><b>${esc(x.note)}</b><div class="hint">${esc(x.by||"")} · xác nhận: ${esc(x.duyet||"")}</div></td><td>${esc(cptNg(x.nguon).split(" (")[0])}</td><td>${esc(x.acct||"—")}</td><td class="n"><b>${nf(Math.round(x.tien))}</b></td><td>${files[x.id]?pill(files[x.id]+" ảnh","blu"):`<span class="hint">chưa có</span>`} <button class="btn sm" data-tf="${x.id}">Ảnh</button></td><td>${cpCan()?`<button class="btn sm danger" data-td="${x.id}">Xóa</button>`:""}</td></tr>`)):`<p class="empty pad">Chưa có phiếu thu nào trong kỳ này.</p>`}</section>`;
  $("#ct-new").onclick=()=>cptQuick();
  if($("#ct-cho"))$("#ct-cho").onclick=()=>cpGoCho();
  m.querySelectorAll("[data-tf]").forEach(b=>b.onclick=()=>{const x=L.find(y=>y.id===b.dataset.tf);spFiles(x.id,x.note)});
  m.querySelectorAll("[data-td]").forEach(b=>b.onclick=()=>{const x=L.find(y=>y.id===b.dataset.td);if(!confirm("Xóa phiếu thu \""+x.note+"\" ("+nf(Math.round(x.tien))+" đ)?"))return;DB.mutate(ME.name,"xóa phiếu thu",dt=>{dt.thuTay=(dt.thuTay||[]).filter(y=>y.id!==x.id)});renderMain()});
}
PAGES.cp_thu=pCpThu;
