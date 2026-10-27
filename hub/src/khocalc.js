/* =====================================================================
   LUẬT TỒN KHO — MỘT CÁCH TÍNH cho mọi trang hai web (chuẩn hóa 27/10/2026). Hàm thuần, có test (tests/unit/khocalc.test.ts).
   Máy chủ tính số gốc ở src/server/services/khoTon.ts (cùng luật âm / sắp hết / nhóm); khoton.js nạp số và vẽ các trang.

   ĐỊNH NGHĨA (một mã MISA, đến hết ngày xem):
   - Tồn thực tế : tổng sổ kho = phiếu kho còn hiệu lực (tồn đầu kỳ, nhập NVL, pha chế, kiểm kê đóng gói, xuất khác, nhập hàng hoàn)
                   + đơn Kênh phân phối đã xuất kho (từ ngày bắt đầu trừ, quy đổi theo Đồng bộ mã Kênh phân phối) + hàng trả lại đã nhận
                   + xuất bán lẻ các sàn theo ngày (từ ngày bắt đầu trừ online).
   - Đã giữ      : số trên đơn Kênh phân phối đã duyệt, kho đã nhận lệnh, chưa xuất.
   - Tồn khả dụng: tồn thực tế − đã giữ.
   - Đang sản xuất: phiếu sản xuất đang làm (phần chưa ra lô) + lô đã làm chưa nhập kho. Chỉ để xem, không cộng vào tồn.
   - Giá trị tồn : phần tồn thực tế dương × giá bình quân gia quyền (Mua hàng › Giá nguyên vật liệu). Thành phẩm chưa có giá.
   - Âm kho      : tồn thực tế < 0 (kể cả mã đã ngừng dùng).
   - Sắp hết     : có định mức an toàn > 0, không âm, tồn khả dụng < định mức.
   - Nhóm        : Vỏ can, chai · Nguyên vật liệu · Bán thành phẩm · Thành phẩm (gồm hàng hóa, combo).
   ===================================================================== */
const KHO_NHOM=[["NVL","Nguyên vật liệu"],["VO","Vỏ can, chai"],["BTP","Bán thành phẩm"],["TP","Thành phẩm"]];
const KHO_TT={AM:["Âm kho","red"],SAP_HET:["Sắp hết","amb"],DU:["Đủ hàng","grn"]};
const KHO_DN=[
  ["Tồn thực tế","Cộng mọi dòng trong sổ kho đến hết ngày xem: tồn đầu kỳ, phiếu nhập, pha chế, kiểm kê đóng gói, xuất khác, nhập hàng hoàn, đơn Kênh phân phối đã xuất kho, hàng trả lại đã nhận, xuất bán lẻ các sàn theo ngày. Phiếu đã hủy không tính."],
  ["Đã giữ cho đơn","Số trên đơn Kênh phân phối đã duyệt, kho đã nhận lệnh xuất nhưng chưa xuất (quy đổi theo Đồng bộ mã Kênh phân phối)."],
  ["Tồn khả dụng","Tồn thực tế trừ hàng đã giữ cho đơn."],
  ["Đang sản xuất","Phiếu sản xuất đang làm (phần chưa ra lô) cộng lô đã làm xong chưa nhập kho. Chỉ để xem, chưa cộng vào tồn."],
  ["Giá trị tồn","Phần tồn thực tế dương nhân giá bình quân gia quyền của tháng (Mua hàng › Giá nguyên vật liệu). Thành phẩm chưa có giá nên chưa tính."],
  ["Âm kho","Tồn thực tế nhỏ hơn 0: sổ ghi xuất nhiều hơn nhập. Tính cả mã đã ngừng dùng."],
  ["Sắp hết","Mã có định mức an toàn (tồn tối thiểu) lớn hơn 0, không âm, và tồn khả dụng thấp hơn định mức."]];
const kc6=n=>Math.round((+n||0)*1e6)/1e6;
function khoNhom(cls,grp,isVo){if(isVo||/^vỏ can/i.test(grp||""))return "VO";if(cls==="NVL"||cls==="CCDC")return "NVL";if(cls==="BTP")return "BTP";return "TP"}
function khoTrangThai(ton,kd,min){if(kc6(ton)<0)return "AM";if(+min>0&&kc6(kd)<+min)return "SAP_HET";return "DU"}
/* Giá trị một dòng: null = chưa có giá (hoặc không có tồn dương thì 0). */
function khoGiaTri(ton,price){if(!(kc6(ton)>0))return 0;return +price>0?ton*price:null}
/* Tổng theo nhóm. rows: [{nhom,ton,kha_dung,dang_sx,trang_thai,active}], price: code → giá bình quân (có thể bỏ trống). */
function khoTongHop(rows,price){
  const z=()=>({ma:0,coTon:0,am:0,sapHet:0,dangSx:0,giaTri:0,chuaGia:0}),by={},all=z();KHO_NHOM.forEach(([k])=>by[k]=z());
  (rows||[]).forEach(r=>{const o=by[r.nhom]||(by[r.nhom]=z());[o,all].forEach(t=>{
    if(r.active!==0)t.ma++;if(kc6(r.ton)>0)t.coTon++;if(r.trang_thai==="AM")t.am++;if(r.trang_thai==="SAP_HET"&&r.active!==0)t.sapHet++;if(+r.dang_sx>0)t.dangSx+=+r.dang_sx;
    if(price){const v=khoGiaTri(r.ton,price(r.code));if(v==null)t.chuaGia++;else t.giaTri+=v}})});
  return {by,all};
}
/* Đối chiếu một mã: tồn đầu + nhập − xuất phải bằng tồn cuối; nguyên nhân âm đọc từ chứng từ. */
const khoDcKhop=r=>Math.abs(kc6((+r.dau||0)+(+r.nhap||0)-(+r.xuat||0))-kc6(r.cuoi))<1e-6;
function khoDcLyDo(r,ngay){
  if(!(kc6(r.cuoi)<0))return "";
  const tu=r.am_phieu?` Âm từ ngày ${ngay?ngay(r.am_tu):r.am_tu}, phiếu ${r.am_phieu}.`:"";
  if(!(+r.nhap_truoc>0))return `Chưa có tồn đầu kỳ và chưa có phiếu nhập nào, sổ chỉ có phiếu xuất.${tu}`;
  if(!(+r.td>0))return `Chưa có tồn đầu kỳ; phiếu nhập ít hơn số đã xuất.${tu}`;
  return `Xuất nhiều hơn tồn đầu kỳ + nhập: thiếu phiếu nhập (hoặc nhập sai mã).${tu}`;
}
