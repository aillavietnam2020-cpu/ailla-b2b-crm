/* =====================================================================
   QUY TẮC VẬN HÀNH & LUỒNG VIỆC (trang quản trị › Cấu hình › Theo dõi).
   Mỗi nghiệp vụ là một luồng bước: ai làm, ai duyệt hoặc phải biết, hạn bao nhiêu ngày, quá hạn thì ai quyết.
   Hộp "Việc chờ tôi" ở Tổng quan đọc bảng này để ghi "người làm" và tính hạn, nên sửa ở đây là hiện ra ngay.
   Lưu: D().rules[khóa] = {lam, duyet} · D().fin.sla = số ngày hạn. Chị Hoa, chị Thảo, chị Huệ sửa thẳng.
   Đây là QUY TẮC để cả nhà cùng theo; QUYỀN thật (ai bấm được nút gì) chỉnh ở Cấu hình › Tài khoản & phân quyền.
   ===================================================================== */
const QT_FLOWS=[
 {nv:"Mua hàng",ic:"cart",steps:["Lập đơn mua","Chuyển khoản trước (nếu nhà cung cấp yêu cầu)","Kho nhận hàng","Ghi chứng từ + nhập giá","Trả tiền"]},
 {nv:"Sản xuất",ic:"fac",steps:["Tạo phiếu sản xuất","Pha chế (nếu cần kỹ thuật)","Đóng gói","Kiểm kê, in tem"]},
 {nv:"Chi phí & tiền",ic:"fin",steps:["Ghi chi phí kèm ảnh bill","Cập nhật số dư mỗi thứ Hai","Theo dõi ngân sách"]},
 {nv:"Thu nợ khách",ic:"users",steps:["Kế toán xác nhận tiền về","Sale nhắc nợ","Nợ quá 90 ngày: chị Hoa quyết"]}];
/* khóa: [nghiệp vụ, bước, người làm mặc định, người duyệt / phải biết mặc định, khóa hạn (số ngày) hoặc ""] */
const QT_RULES={
 mua:["Mua hàng","Mua nguyên vật liệu dưới mức tối thiểu","Chị Thảo","Chị Hoa biết",""],
 tr:["Mua hàng","Chuyển khoản trước cho nhà cung cấp","Chị Thảo hoặc chị Huệ","Chị Hoa","tr"],
 hang:["Mua hàng","Hỏi hàng trễ","Chị Thảo","—",""],
 ct:["Mua hàng","Ghi chứng từ nhà cung cấp","Chị Thảo hoặc chị Huệ","Chị Hoa","ct"],
 gia:["Mua hàng","Nhập giá cho phiếu mua","Chị Thảo","Chị Hoa","gia"],
 no:["Mua hàng","Trả tiền nhà cung cấp","Chị Huệ hoặc chị Thảo","Chị Hoa","sau"],
 sx:["Sản xuất","Phiếu sản xuất đến hạn","Chị Thảo tạo; kỹ thuật hoặc công nhân làm","Chị Thảo","" ],
 kk:["Sản xuất","Kiểm kê lô đã đóng gói","Kế toán kho (Chúc)","Chị Thảo","" ],
 anh:["Chi phí & tiền","Bổ sung ảnh bill khoản chi","Người ghi khoản chi","Chị Huệ","" ],
 dn:["Thu nợ khách","Khách nợ quá 90 ngày","Sale phụ trách khách","Chị Hoa quyết","" ]};
const QT_TAGKEY={"Chờ CK trước":"tr","Quá hạn":"no","Chưa trả":"no","Công nợ":"no","Chờ chứng từ":"ct","Chờ nhập giá":"gia","Trễ hàng":"hang","Cần mua":"mua","Sản xuất":"sx","Chờ kiểm kê":"kk","Thiếu ảnh":"anh","Đòi nợ":"dn"};
const qtRule=k=>{const d=QT_RULES[k]||["","","","",""],o=((D().rules||{})[k])||{};return {nv:d[0],buoc:d[1],lam:o.lam!=null&&o.lam!==""?o.lam:d[2],duyet:o.duyet!=null&&o.duyet!==""?o.duyet:d[3],han:d[4]}};
const QT_SLA_TXT={tr:"từ ngày lập phiếu mua",ct:"từ ngày hàng nhập kho",gia:"từ ngày hàng nhập kho",sau:"từ ngày hàng nhập kho (nhà cung cấp chuyển khoản sau)"};
const QT={edit:false};
function pQuyTac(m){
  const T="Quy tắc vận hành & luồng việc",S="Ai làm bước nào, ai duyệt, hạn bao lâu, quá hạn thì ai quyết";
  const ed=mhManage(),SL=typeof vcSla==="function"?vcSla():{ct:3,gia:2,tr:2,sau:3,leo:2};
  const nvs=[...new Set(Object.values(QT_RULES).map(r=>r[0]))];
  const flow=f=>`<div class="qtf"><b>${esc(f.nv)}</b><div class="qts">${f.steps.map((s,i)=>`<span class="qtc">${i+1}. ${esc(s)}</span>`).join('<i class="qta">›</i>')}</div></div>`;
  const cell=(k,f,v,ph)=>QT.edit?`<input class="qti" data-qk="${k}" data-qf="${f}" value="${esc(v)}" placeholder="${esc(ph)}">`:esc(v);
  m.innerHTML=H(T,S)+`<div class="card pad"><div class="tlh"><b>Luồng làm việc</b></div>${QT_FLOWS.map(flow).join("")}<p class="hint">Mỗi bước kẹt quá hạn sẽ hiện ở hộp “Việc chờ tôi” ở Tổng quan, kèm tên người làm trong bảng bên dưới.</p></div>
  <div class="card pad"><div class="tlh"><b>Ai làm, ai duyệt, hạn bao lâu</b>${ed?(QT.edit?`<span><button class="btn sm" id="qt-cancel">Hủy</button> <button class="btn pri sm" id="qt-save">Lưu quy tắc</button></span>`:`<button class="btn pri sm" id="qt-edit">Sửa quy tắc</button>`):""}</div>
  <div class="nsw"><table class="tbl"><thead><tr><th>Nghiệp vụ</th><th>Bước</th><th>Người làm</th><th>Duyệt / phải biết</th><th class="n">Hạn xử lý</th></tr></thead><tbody>${Object.keys(QT_RULES).map(k=>{const r=qtRule(k),d=QT_RULES[k];
    const han=r.han?(QT.edit?`<input class="qti qtn" type="number" min="0" data-qs="${r.han}" value="${SL[r.han]}"> ngày`:SL[r.han]+" ngày"+`<div class="hint">${esc(QT_SLA_TXT[r.han]||"")}</div>`):`<span class="hint">theo ngày hẹn trên phiếu</span>`;
    return `<tr><td><b>${esc(r.nv)}</b></td><td>${esc(r.buoc)}</td><td>${cell(k,"lam",r.lam,d[2])}</td><td>${cell(k,"duyet",r.duyet,d[3])}</td><td class="n">${han}</td></tr>`}).join("")}</tbody></table></div>
  <div class="qtesc"><b>Quá hạn thì sao?</b> Quá hạn ${QT.edit?`<input class="qti qtn" type="number" min="0" data-qs="leo" value="${SL.leo}">`:`<b>${SL.leo}</b>`} ngày, việc đó được đánh dấu <span class="vcleo">Cần chị Hoa quyết</span> và đưa lên đầu hộp Việc chờ tôi. Hiện hệ thống chỉ hiện đỏ trên web, chưa tự nhắn cho ai.</div>
  <p class="hint">Bảng này ghi quy tắc để cả nhà cùng theo. Quyền thật (ai bấm được nút nào) chỉnh ở Cấu hình › Tài khoản & phân quyền; việc cấp quyền do chị Hoa quyết.</p></div>`;
  const on=(id,f)=>{const b=m.querySelector(id);if(b)b.onclick=f};
  on("#qt-edit",()=>{QT.edit=true;renderMain()});on("#qt-cancel",()=>{QT.edit=false;renderMain()});
  on("#qt-save",()=>{const R={},S2={};m.querySelectorAll("[data-qk]").forEach(i=>{const k=i.dataset.qk;(R[k]=R[k]||{})[i.dataset.qf]=i.value.trim()});
    m.querySelectorAll("[data-qs]").forEach(i=>{S2[i.dataset.qs]=Math.max(0,Math.round(+i.value||0))});
    DB.mutate(ME.name,"sửa quy tắc vận hành",dt=>{dt.rules=R;dt.fin=dt.fin||{};dt.fin.sla={...(dt.fin.sla||{}),...S2}});
    QT.edit=false;toast("Đã lưu quy tắc");renderMain()});
}
PAGES.quytac=pQuyTac;
