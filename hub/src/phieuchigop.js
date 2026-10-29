/* =====================================================================
   MỘT NÚT GHI PHIẾU CHI (chị Hoa 27/10/2026: "phiếu chi NCC và phiếu chi vận chuyển cũng là một loại phiếu chi").
   Sổ chi phí chỉ còn nút "＋ Ghi phiếu chi"; trong form chọn loại:
     Chi phí khác      → form sổ chi như cũ (chị Thảo ghi, chị Huệ duyệt)
     Trả nhà cung cấp  → form phiếu chi Mua hàng như cũ (trừ công nợ NCC, gắn phiếu mua / hóa đơn)
     Vận chuyển        → ghi thẳng vào sổ phiếu chi vận chuyển (/api/shipping-vouchers), giống trang Phiếu chi vận chuyển
   Mỗi loại vẫn lưu đúng chỗ cũ nên công nợ nhà cung cấp, sổ vận chuyển, Nhật ký chi không đổi cách tính.
   ===================================================================== */
const pcgVcOk=()=>!!ME&&(ME.role==="admin"||mhPerm("order.approve.normal")||mhPerm("order.accounting.confirm"));
function pcgBar(cur){
  const L=[["cp","Chi phí khác",true],["ncc","Trả nhà cung cấp",mhManage()],["vc","Vận chuyển",pcgVcOk()]].filter(x=>x[2]);
  if(L.length<2)return;
  const h=document.querySelector("#drawerIn h2");if(!h||document.getElementById("pcg"))return;
  h.insertAdjacentHTML("afterend",`<div class="mhpm" id="pcg"><b style="margin-right:6px">Loại phiếu chi:</b>${L.map(([k,t])=>`<label class="chk"><input type="radio" name="pcg" value="${k}"${k===cur?" checked":""}> ${t}</label>`).join("")}</div>`);
  document.querySelectorAll('input[name="pcg"]').forEach(x=>x.onchange=()=>{if(x.checked)pcgOpen(x.value)});
}
async function pcgOpen(k){
  if(k==="ncc"){await mhLoad();mhLoadInv();mhPayForm();pcgBar("ncc");return}
  if(k==="vc"){pcgVC();return}
  scForm();
}
function pcgVC(){
  openDrawerHTML(`<h2>Ghi phiếu chi</h2><form class="frm" id="pcv">
   <div class="row4"><label class="field">Ngày chi<input type="date" id="pcv-d" value="${mhToday()}" required></label><label class="field">Số tiền (đ)<input type="number" id="pcv-a" min="1" required></label></div>
   <div class="row4"><label class="field">Đơn vị vận chuyển / biển số xe<input id="pcv-c" required placeholder="Ví dụ: Xe anh Tuấn 29C-123.45"></label><label class="field">Chở đi đâu<input id="pcv-to" placeholder="Ví dụ: NPP Hải Dương"></label></div>
   <label class="field">Các đơn xe chở (chọn đơn bên dưới, hoặc gõ chữ nếu chở gộp không bổ được)<input id="pcv-o" placeholder="Ví dụ: DH202610-0040, PM2610-009, hàng sàn ngày 28/10"></label>
   <label class="field">Hình thức<select id="pcv-m"><option value="TIEN_MAT">Tiền mặt</option><option value="CHUYEN_KHOAN">Chuyển khoản</option><option value="KHAC">Khác</option></select></label>
   <div id="pcv-ck" class="row4" hidden><label class="field">Chi từ tài khoản công ty<select id="pcv-from"><option value="">Đang tải…</option></select></label><label class="field">Ngân hàng nhận<input id="pcv-bank"></label></div>
   <div id="pcv-ck2" class="row4" hidden><label class="field">Số tài khoản nhận<input id="pcv-no"></label><label class="field">Tên chủ tài khoản<input id="pcv-nm"></label></div>
   <label class="field" id="pcv-fxw" hidden>Tài khoản chi khác<input id="pcv-fx" placeholder="Ngân hàng · số tài khoản · tên chủ tài khoản"></label>
   <label class="field" id="pcv-rw">Người nhận tiền<input id="pcv-r"></label>
   <label class="field">Ảnh bill / phiếu chi có chữ ký<input type="file" id="pcv-f" multiple accept="image/*,application/pdf"></label>
   <label class="field">Ghi chú<input id="pcv-n"></label><div id="pcv-e"></div>
   <button class="btn pri">Ghi phiếu chi vận chuyển</button></form>
   <div class="note">Phiếu này vào sổ <b>Phiếu chi vận chuyển</b> (không qua bước duyệt, giống trang Phiếu chi vận chuyển); Nhật ký chi tự hiện để đối chiếu.</div>`);
  pcgBar("vc");gdCss();gdChonDon("pcv-o");
  const sw=()=>{const m=$("#pcv-m").value,ck=m==="CHUYEN_KHOAN";$("#pcv-ck").hidden=$("#pcv-ck2").hidden=!ck;$("#pcv-rw").hidden=m!=="TIEN_MAT";$("#pcv-fxw").hidden=!ck||$("#pcv-from").value!=="__x"};
  mhAccts().then(A=>{const s=$("#pcv-from");if(!s)return;s.innerHTML=`<option value="">— Chọn tài khoản chi tiền —</option>`+A.map(a=>`<option>${esc(mhAcctLabel(a))}</option>`).join("")+`<option value="__x">Tài khoản khác…</option>`;s.onchange=sw;sw()});
  $("#pcv-m").onchange=sw;sw();
  $("#pcv").onsubmit=async e=>{e.preventDefault();const m=$("#pcv-m").value,from=$("#pcv-from").value==="__x"?$("#pcv-fx").value.trim():$("#pcv-from").value;
    if(m==="CHUYEN_KHOAN"&&(!from||!$("#pcv-no").value.trim())){$("#pcv-e").innerHTML=`<div class="note red">Chuyển khoản: chọn tài khoản chi tiền và ghi số tài khoản nhận.</div>`;return}
    const body={voucher_date:$("#pcv-d").value,carrier:$("#pcv-c").value.trim(),destination:$("#pcv-to").value.trim(),amount:Math.round(+$("#pcv-a").value),method:m,order_refs:$("#pcv-o").value.trim(),note:$("#pcv-n").value.trim(),
      ...(m==="CHUYEN_KHOAN"?{from_account:from,to_bank:$("#pcv-bank").value.trim(),to_account_no:$("#pcv-no").value.trim(),to_account_name:$("#pcv-nm").value.trim()}:m==="TIEN_MAT"?{receiver:$("#pcv-r").value.trim()}:{})};
    const btn=e.submitter;if(btn)btn.disabled=true;
    let r;try{r=await svApi("/api/shipping-vouchers",{method:"POST",body:JSON.stringify(body)})}catch(er){$("#pcv-e").innerHTML=`<div class="note red">${esc(er.message)}</div>`;if(btn)btn.disabled=false;return}
    let up=0;for(const f of [...$("#pcv-f").files]){try{await svApi("/api/shipping-vouchers/"+r.id+"/files",{method:"POST",body:JSON.stringify(await mhPrepFile(f))});up++}catch(er){toast(er.message)}}
    closeDrawer();toast("Đã ghi phiếu chi vận chuyển "+(r.voucher_no||"")+(up?", kèm "+up+" ảnh":""));renderMain()};
}
{const _f=scForm;scForm=function(){const r=_f.apply(this,arguments);try{pcgBar("cp")}catch(e){}return r};spForm=scForm}
{const _p=PAGES.so_cp;PAGES.so_cp=function(m){const r=_p.apply(this,arguments);["sc-ncc","sc-vc"].forEach(id=>{const b=m.querySelector("#"+id);if(b)b.remove()});return r}}
