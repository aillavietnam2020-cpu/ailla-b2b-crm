/* Menu Trang quản trị (quantri.ailla.vn): 4 nhóm gọn thay cho "Tài chính" + "Cài đặt" nhồi nhiều tầng.
   Không tạo trang mới; chỉ gom các trang đã có (mỗi trang giữ nguyên quyền riêng) về đúng nhóm.
   Chỉ có tác dụng khi HOST_MODE==="admin"; web vận hành (vanhanh) giữ nguyên. */
PAGES.cskh_cu=m=>{m.innerHTML=H("CSKH cũ","Mảng chăm sóc khách cũ · chờ triển khai")+`<section class="card"><p>Mảng này chưa chạy nên chưa có số. Hiện Pancake coi như chưa có khách cũ, toàn bộ doanh thu Facebook tính vào <b>Facebook Ads</b>. Khi bắt đầu chăm sóc khách cũ, doanh thu và chi phí của mảng sẽ hiện ở đây.</p></section>`};
PAGES.cr_audit=m=>{m.innerHTML=H("Nhật ký","Ai đã sửa gì, lúc nào (giá, đơn, người dùng...)")+'<div class="crmembed"><iframe id="crmfr" src="/admin/audit" title="Nhật ký"></iframe></div>'};
{
  const pool=()=>{
    const out={};
    ["fin","setup","b2blink","exec","b2c","mkt","sx","gc"].forEach(k=>{const mo=MODULES.find(x=>x.k===k);if(!mo)return;mo.groups().forEach(([,its])=>its.forEach(i=>{if(!out[i[0]])out[i[0]]=i}))});
    const adm=u=>u.role==="admin"||can(u,"caidat.quanly");
    out.bc_b2b=MI("bc_b2b","Kênh phân phối",tq);
    out.cskh_cu=MI("cskh_cu","CSKH cũ",tq);
    out.bc_gc=MI("bc_gc","Kênh OEM",tq);
    out.kho_qd=MI("kho_qd","Quy đổi mã các sàn");
    out.kho_gtri=MI("kho_gtri","Tồn kho & giá trị",()=>mhManage());
    [["mh_po","Đơn mua hàng"],["mh_hd","Chứng từ nhà cung cấp"],["mh_chi","Phiếu chi"],["mh_no","Công nợ nhà cung cấp"],["mh_gianvl","Giá nguyên vật liệu theo tháng"]].forEach(([k,t])=>{out[k]=MI(k,t,()=>mhManage())});
    out.cr_audit=MI("cr_audit","Nhật ký",u=>adm(u)&&crmRole()!=="EMPLOYEE");
    out.soat_sl=MI("soat_sl","Máy soát số liệu",u=>adm(u)||can(u,"order.accounting.confirm"));
    return out};
  const pick=(P,keys,names)=>keys.map((k,i)=>{const it=P[k];return it?(names&&names[i]?[it[0],names[i],it[2],it[3]]:it):null}).filter(Boolean);
  const mk=(k,ic,n,spec)=>({k,adm:true,zone:"Quản trị",ic,n,sub:"",groups:()=>{const P=pool();return spec.map(([g,keys,names])=>[g,pick(P,keys,names)]).filter(g=>g[1].length)}});
  MODULES.push(
    mk("q_tq","home","Tổng quan công ty",[["",["exec"],["Tổng quan công ty"]]]),
    mk("q_fin","fin","Tài chính",[["",
      ["bc_tong","pl","bc_tiktok","bc_shopee","bc_fb","cskh_cu","bc_b2b","bc_gc","chiphi","chiphidm","cr_vc","doisoat","cr_bill","cr_rcv"],
      ["Báo cáo kết quả kinh doanh","Lãi lỗ (P&L)","TikTok Shop","Shopee","Facebook Ads","CSKH cũ","Kênh phân phối","Kênh OEM","Chi phí theo tháng","Danh mục & phân bổ chi phí","Phiếu chi vận chuyển","Đối soát tiền về","Kho bill giao dịch","Tài khoản nhận tiền"]]]),
    mk("q_mh","cart","Mua hàng",[["",["mh_po","mh_no","mh_gianvl"],["Đơn mua hàng","Công nợ nhà cung cấp","Giá nguyên vật liệu theo tháng"]]]),
    mk("q_sx","fac","Sản xuất",[["",["kho_dm","kho_boc","kho_cl","sku"],["Định mức theo sản phẩm","Định mức & giá thành","Chênh lệch so với định mức","Giá vốn SKU"]]]),
    mk("q_kho","box","Kho hàng",[["",["kho_gtri","kho_nxt","kho_vo","kho_map","kho_qd"],["Tồn kho & giá trị","Nhập – xuất – tồn","Vỏ can, chai & thùng","Đồng bộ mã Kênh phân phối","Quy đổi mã các sàn"]]]),
    mk("q_sp","bag","Sản phẩm",[
      ["",["sanpham"]],
      ["Bảng giá",["cr_gia","cr_dc"],["Bảng giá","Giá điều chỉnh / khuyến mại"]]]),
    mk("q_dl","users","Đại lý & khách hàng",[["",["cr_kh","cr_cn","cr_dn","cr_thuong"],["Danh sách khách hàng","Công nợ khách hàng","Đơn hàng B2B & duyệt","Thưởng & xếp hạng NPP"]]]),
    mk("q_gc","fac","Gia công",[["",["gc_tq","gc_kh","gc_don","gc_cn","cr_giagc"],["Tổng quan gia công","Khách gia công","Đơn gia công","Công nợ gia công","Bảng giá riêng"]]]),
    mk("q_cfg","gear","Cấu hình",[
      ["Tài khoản",["nhansu","phongban"],["Tài khoản & phòng ban","Phòng ban & phân hệ"]],
      ["Thiết lập",["kenhban","quychuan"]],
      ["Dữ liệu & AI",["cr_import","caidat","bots","agentchat","agents"],["Dữ liệu","Sao lưu dữ liệu","Trợ lý AI","Điều hành agent","Agent AI"]],
      ["Theo dõi",["soat_sl","cr_audit"],["Máy soát số liệu","Nhật ký"]]]));

}

/* Ô "Tìm chức năng" trên trang quản trị: chỉ tìm trang, không tìm thẻ video / khách hàng. */
if(HOST_MODE==="admin"){
  try{document.documentElement.classList.add("hostadm")}catch(e){}
  const _qs=quickSearch;quickSearch=function(q){return _qs(q).filter(x=>!String(x[0]).startsWith("#"))};
}
