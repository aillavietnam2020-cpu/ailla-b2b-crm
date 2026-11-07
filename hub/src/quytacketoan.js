/* =====================================================================
   QUY TẮC KẾ TOÁN (chị Hoa giao 07/11): quản trị › Cấu hình › Quy tắc kế toán.
   Một chỗ đặt luật kế toán, kiểu phần "Thiết lập" của các phần mềm bán hàng (KiotViet, Sapo, MISA eShop, Haravan):
   mỗi dòng một quy tắc, đang làm gì nói bằng chữ thường, bật / tắt hoặc đặt số ngay tại dòng.
   - Lưu ở máy chủ (/api/acc-rules, app_settings 'acc.rules'); chỉ CEO và Kế toán sửa; mỗi lần đổi ghi nhật ký.
   - Quy tắc đã có chỗ đặt riêng (ngưỡng chi CEO duyệt, ngưỡng quảng cáo) thì hiện số đang dùng và trỏ tới đúng trang đó, không đặt lần hai.
   ===================================================================== */
const QTK={d:null,busy:false,err:""};
function qtkLoad(force){if(QTK.busy||(QTK.d&&!force))return;QTK.busy=true;
  Promise.all([svApi("/api/acc-rules"),svApi("/api/ceo-spend").catch(()=>null)]).then(([r,cs])=>{QTK.d=r;QTK.th=cs?+cs.threshold:null;QTK.err="";if(typeof KHO!=="undefined")KHO.rules=r.rules})
   .catch(e=>{QTK.err=e.message||"Chưa tải được"}).finally(()=>{QTK.busy=false;if(PAGE==="qt_kt")renderMain()})}
function pQtKt(m){
  const T="Quy tắc kế toán",S="Các luật kế toán web đang áp dụng. Đổi ở đây là cả web vận hành và quản trị làm theo.";
  if(!QTK.d){qtkLoad();m.innerHTML=H(T,S)+`<div class="card pad">${QTK.err?`<div class="note red">${esc(QTK.err)}</div>`:`<p class="hint">Đang tải…</p>`}</div>`;return}
  const R=QTK.d.rules,ed=QTK.d.can_edit,nf0=n=>(+n||0).toLocaleString("vi-VN");
  const qc=typeof ngCfg==="function"&&ngCfg()?Math.round(ngCfg().nguong.qcMax*1000)/10:38;
  const sw=(id,on)=>`<label class="qtk-sw"><input type="checkbox" id="${id}" ${on?"checked":""} ${ed?"":"disabled"}><span>${on?"Đang bật":"Đang tắt"}</span></label>`;
  const go=(p,t)=>`<button type="button" class="lnk" data-qtkgo="${p}">${t} ›</button>`;
  const row=(nhom,ten,dang,dat)=>`<tr><td><small class="hint">${nhom}</small><br><b>${ten}</b></td><td>${dang}</td><td style="white-space:nowrap">${dat}</td></tr>`;
  const rows=[
    row("Kho","Cho phép xuất âm kho",R.allow_negative?"Phiếu xuất kho, pha chế, sản xuất trừ vật tư <b>vẫn ghi được</b> khi tồn không đủ; web hiện cảnh báo \"sẽ âm kho\" để kiểm lại.":"<b class=\"t-red\">Không cho ghi</b> phiếu xuất kho, pha chế, sản xuất trừ vật tư nếu làm tồn thành âm. Phải nhập kho hoặc kiểm tồn trước.",sw("qtk-neg",R.allow_negative)),
    row("Kho","Khóa sổ kho",R.lock_date?`Không ghi, sửa, hủy phiếu kho có ngày <b>từ ${esc(kDd(R.lock_date))} trở về trước</b>. Số đã chốt không bị đổi.`:"Chưa khóa: phiếu ngày nào cũng ghi, sửa, hủy được.",`<input type="date" id="qtk-lock" value="${esc(R.lock_date||"")}" ${ed?"":"disabled"}> ${ed&&R.lock_date?`<button type="button" class="lnk" id="qtk-unlock">Mở khóa</button>`:""}`),
    row("Kho","Duyệt phiếu nhập / xuất trước khi trừ tồn","Chưa có bước duyệt: phiếu ghi xong là cộng / trừ tồn ngay; ai lập, lúc nào đều lưu trên phiếu. Muốn có bước duyệt thì báo để làm thêm.","<small class=\"hint\">Chưa có</small>"),
    row("Giá vốn","Cách tính giá vốn","<b>Bình quân gia quyền</b> theo tháng: giá nguyên vật liệu = tổng tiền nhập (cả tồn đầu) chia tổng số lượng; giá vốn sản phẩm = định mức × giá đó.",go("mh_gianvl","Giá nguyên vật liệu")),
    row("Chi tiền","Ngưỡng chi phải CEO duyệt",QTK.th!=null?`Khoản chi từ <b>${nf0(QTK.th)} đ</b> trở lên chờ CEO duyệt ở trang Phê duyệt.`:"Khoản chi lớn chờ CEO duyệt ở trang Phê duyệt.",go("nguong","Đổi ở Ngưỡng cảnh báo")),
    row("Chi tiền","Nhóm chi phí trên phiếu chi","Phiếu chi ghi theo danh mục chi phí (khoản trực tiếp của kênh, chi phí chung, khoản chờ phân bổ) để vào đúng Sổ chi phí và lãi lỗ. Danh mục đặt ở trang Danh mục chi phí.",go("chiphidm","Danh mục chi phí")),
    row("Cảnh báo","Quảng cáo trên doanh thu thực",`Quảng cáo vượt <b>${qc}%</b> doanh thu thực của kênh thì báo đỏ.`,go("nguong","Đổi ở Ngưỡng cảnh báo"))];
  const log=(QTK.d.log||[]).map(x=>{let a={},b={};try{a=JSON.parse(x.after_json||"{}");b=JSON.parse(x.before_json||"{}")}catch(e){}
    const t=Object.keys(a).map(k=>k==="allow_negative"?`Xuất âm kho: ${b[k]?"bật":"tắt"} → <b>${a[k]?"bật":"tắt"}</b>`:k==="lock_date"?`Khóa sổ: ${b[k]?kDd(b[k]):"chưa khóa"} → <b>${a[k]?kDd(a[k]):"mở khóa"}</b>`:esc(k)).join("; ");
    return `<tr><td style="white-space:nowrap">${esc(new Date(x.created_at).toLocaleString("vi-VN"))}</td><td>${esc(x.who||"")}</td><td>${t}</td></tr>`});
  m.innerHTML=H(T,S)+`${ed?"":`<div class="note amb">Chỉ CEO và Kế toán sửa được quy tắc. Tài khoản này chỉ xem.</div>`}
   <section class="card flush" style="margin-bottom:12px">${tbl(["Quy tắc","Đang làm gì","Đặt"],rows)}</section>
   <section class="card flush"><div class="card-h pad"><h3>Nhật ký thay đổi</h3></div>${tbl(["Lúc","Người đổi","Đổi gì"],log)}</section>`;
  const save=async(body,msg)=>{try{const r=await svApi("/api/acc-rules",{method:"PUT",body:JSON.stringify(body)});toast(r.changed?msg:"Không có gì thay đổi");QTK.d=null;qtkLoad(true)}catch(e){toast(e.message);QTK.d=null;qtkLoad(true)}};
  const n=m.querySelector("#qtk-neg");if(n)n.onchange=()=>{const on=n.checked;if(!on&&!confirm("Tắt xuất âm kho: từ giờ phiếu nào làm tồn thành âm sẽ không ghi được. Tắt?")){n.checked=true;return}save({allow_negative:on},on?"Đã bật cho phép xuất âm kho":"Đã tắt xuất âm kho")};
  const l=m.querySelector("#qtk-lock");if(l)l.onchange=()=>{if(!l.value)return;if(!confirm("Khóa sổ kho đến hết ngày "+kDd(l.value)+"? Phiếu từ ngày này trở về trước sẽ không ghi, sửa, hủy được."))return;save({lock_date:l.value},"Đã khóa sổ đến hết "+kDd(l.value))};
  const u=m.querySelector("#qtk-unlock");if(u)u.onclick=()=>{if(confirm("Mở khóa sổ kho?"))save({lock_date:""},"Đã mở khóa sổ")};
  m.querySelectorAll("[data-qtkgo]").forEach(b=>b.onclick=()=>{PAGE=b.dataset.qtkgo;try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}render();scrollTo(0,0)});
}
PAGES.qt_kt=pQtKt;
/* Khung lập phiếu kho đọc quy tắc để báo đúng (vẫn ghi được / sẽ bị chặn). */
{const _kf=typeof khoForm==="function"?khoForm:null;if(_kf)khoForm=function(){if(typeof KHO!=="undefined"&&!KHO.rules&&!QTK.busy)svApi("/api/acc-rules").then(r=>{KHO.rules=r.rules}).catch(()=>{});return _kf.apply(this,arguments)}}
