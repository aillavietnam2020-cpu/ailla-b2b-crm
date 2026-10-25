/* =====================================================================
   THANH BÊN TRANG QUẢN TRỊ: 8 mục theo nhóm chỉ số quản trị (chị Hoa duyệt 25/10/2026).
   Điều hành: Tổng quan · Doanh thu & KPI · Lãi lỗ & Giá thành · Chi phí & Tiền
   Nghiệp vụ: Đơn hàng · Mua hàng · Sản xuất & Kho
   Hệ thống:  Cấu hình
   Mỗi mục lớn một dòng ở thanh bên, các trang con là tab trong trang. Mỗi trang chỉ nằm MỘT chỗ.
   Không tạo trang mới ngoài Sổ chi phí (socp.js): chỉ gom các trang đã có về đúng nhóm, giữ nguyên quyền của từng trang.
   Nút "+ Ghi nhanh" luôn ở đầu thanh bên: ghi chi phí, phiếu chi, đơn mua, chứng từ mà không phải đi tìm trang.
   ===================================================================== */
if(typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin"){
  /* Bỏ các nhóm trang cũ của trang quản trị (Doanh thu, Chi phí, Mua hàng… gom thành tab riêng). */
  for(let i=PAGE_SETS.length-1;i>=0;i--)if(PAGE_SETS[i].adm)PAGE_SETS.splice(i,1);
  const OLD=MODULES.filter(m=>m.adm);
  for(let i=MODULES.length-1;i>=0;i--)if(MODULES[i].adm)MODULES.splice(i,1);
  const pool=()=>{const o={};
    OLD.forEach(m=>{try{m.groups().forEach(([,its])=>its.forEach(i=>{if(!o[i[0]])o[i[0]]=i}))}catch(e){}});
    const mg=()=>mhManage();
    if(!o.mh_hd)o.mh_hd=MI("mh_hd","Chứng từ nhà cung cấp",mg);
    if(!o.mh_chi)o.mh_chi=MI("mh_chi","Phiếu chi nhà cung cấp",mg);
    o.muctieu=MI("muctieu","Kế hoạch doanh thu",u=>can(u,"pl.xem")||mg());
    o.tien_lich=MI("tien_lich","Tiền & lịch chi",u=>can(u,"chiphi.xem")||mg());
    o.ngan_sach=MI("ngan_sach","Ngân sách chi phí",u=>can(u,"chiphi.xem")||mg());
    o.so_cp=MI("so_cp","Sổ chi phí",u=>can(u,"chiphi.xem")||mg());
    return o};
  const pick=(P,keys,names)=>keys.map((id,i)=>{const it=P[id];return it?[it[0],(names&&names[i])||it[1],it[2],it[3]]:null}).filter(Boolean);
  const tabMod=(k,ic,n,zone,keys,names)=>({k,adm:true,zone,ic,n,sub:"",tabs:true,groups:()=>[["",pick(pool(),keys,names)]]});
  MODULES.push(
    {k:"q_tq",adm:true,zone:"Điều hành",ic:"home",n:"Tổng quan",sub:"",groups:()=>[["",pick(pool(),["exec"],["Tổng quan"])]]},
    tabMod("q_dt","bag","Doanh thu & KPI","",["muctieu","bc_tiktok","bc_shopee","bc_fb","bc_b2b","bc_gc","cskh_cu"],["Kế hoạch doanh thu","TikTok Shop","Shopee","Facebook","B2B / Đại lý","Gia công","CSKH cũ"]),
    tabMod("q_ll","spark","Lãi lỗ & Giá thành","",["pl","bc_tong","kho_boc","kho_cl","sku"],["P&L công ty","So sánh kênh","Định mức & giá thành","Chênh lệch định mức","Giá vốn SKU"]),
    tabMod("q_cp","fin","Chi phí & Tiền","",["so_cp","ngan_sach","tien_lich","cr_vc","mh_no","cr_cn","doisoat","cr_bill"],["Sổ chi phí","Ngân sách","Tiền & lịch chi","Phiếu chi vận chuyển","Phải trả nhà cung cấp","Phải thu khách (NPP)","Đối soát tiền về","Kho bill giao dịch"]),
    tabMod("q_dh","box","Đơn hàng","Nghiệp vụ",["cr_dn","gc_don","kho_qd","cr_kh","cr_gia","cr_dc","cr_thuong"],["Đơn B2B & duyệt","Đơn gia công","Đơn sàn & quy đổi mã","Khách & đại lý","Bảng giá","Giá điều chỉnh / khuyến mại","Thưởng & xếp hạng NPP"]),
    tabMod("q_mh","cart","Mua hàng","",["mh_po","mh_hd","mh_chi","mh_gianvl"],["Đơn mua hàng","Chứng từ nhà cung cấp","Phiếu chi nhà cung cấp","Giá nguyên vật liệu theo tháng"]),
    tabMod("q_sx","fac","Sản xuất & Kho","",["kho_gtri","kho_nxt","kho_vo","kho_map","kho_dm"],["Tồn kho & giá trị","Nhập – xuất – tồn","Vỏ can, chai & thùng","Đồng bộ mã B2B","Định mức theo sản phẩm"]),
    {k:"q_cfg",adm:true,zone:"Hệ thống",ic:"gear",n:"Cấu hình",sub:"",groups:()=>{const P=pool(),g=(n,ids,names)=>[n,pick(P,ids,names)];
      return [g("Tài khoản",["nhansu","phongban"],["Tài khoản & phân quyền","Phòng ban"]),
        g("Danh mục",["sanpham","kenhban","chiphidm","cr_rcv","gc_kh","cr_giagc"],["Sản phẩm","Kênh bán & phí","Danh mục chi phí","Tài khoản nhận tiền","Khách gia công","Bảng giá riêng gia công"]),
        g("Dữ liệu & AI",["cr_import","caidat","bots","agentchat","agents","quychuan"],["Dữ liệu","Sao lưu dữ liệu","Trợ lý AI","Điều hành agent","Agent AI","Quy chuẩn"]),
        g("Theo dõi",["soat_sl","cr_audit"],["Máy soát số liệu","Nhật ký"])].filter(x=>x[1].length)}});

  /* ---------- Nút "+ Ghi nhanh" ở đầu thanh bên ---------- */
  const gnGo=p=>{PAGE=p;try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}render();scrollTo(0,0)};
  const gnReady=async()=>{try{await mhLoad()}catch(e){}for(let i=0;i<40&&!MH.sup;i++)await new Promise(r=>setTimeout(r,150))};
  const gnItems=()=>{const mg=mhManage(),ed=mg||can(ME,"chiphi.nhap");return [
    ["Ghi chi phí","Thuê, lương, agency, tiếp khách… kèm ảnh bill",ed,()=>spForm()],
    ["Phiếu chi nhà cung cấp","Trả tiền hoặc cọc cho nhà cung cấp",mg,async()=>{await gnReady();mhLoadInv();mhLoadPay();mhPayForm()}],
    ["Phiếu chi vận chuyển","Cước xe, đơn vị vận chuyển",mg,()=>gnGo("cr_vc")],
    ["Lập đơn mua hàng","Nguyên vật liệu, vỏ, bao bì",mg,async()=>{await gnReady();mhForm(null)}],
    ["Ghi chứng từ nhà cung cấp","Phiếu giao, bill, hóa đơn đỏ",mg,async()=>{await gnReady();await mhLoadInv();mhDocForm()}]].filter(x=>x[2])};
  function gnInject(){
    const nav=document.querySelector(".side nav");if(!nav||document.getElementById("gn"))return;
    const L=gnItems();if(!L.length)return;
    const w=document.createElement("div");w.id="gn";w.className="gnbox";
    w.innerHTML=`<button type="button" class="gnbtn" id="gnb"><span>＋ Ghi nhanh</span><span>▾</span></button><div class="gnpop" id="gnp" hidden>${L.map((x,i)=>`<button type="button" data-gi="${i}"><b>${esc(x[0])}</b><small>${esc(x[1])}</small></button>`).join("")}</div>`;
    nav.before(w);
    const pop=w.querySelector("#gnp");
    w.querySelector("#gnb").onclick=e=>{e.stopPropagation();pop.hidden=!pop.hidden};
    pop.querySelectorAll("[data-gi]").forEach(b=>b.onclick=e=>{e.stopPropagation();pop.hidden=true;document.body.classList.remove("menu-open");try{L[+b.dataset.gi][3]()}catch(err){toast(err.message||"Chưa mở được")}});
    document.addEventListener("click",()=>{pop.hidden=true},{once:true,capture:true});
  }
  {const _r=render;render=function(){const r=_r.apply(this,arguments);try{gnInject()}catch(e){}return r}}
}
