/* =====================================================================
   THANH BÊN TRANG QUẢN TRỊ (chị Hoa duyệt mẫu 26/10/2026).
   Điều hành: Tổng quan · Báo cáo (tài chính, tồn kho, công nợ, dòng tiền, hiệu quả SXKD) · Doanh thu · Chi phí
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
    ["fin","setup","b2blink","exec","b2c","mkt","sx","gc"].forEach(k=>{const mo=MODULES.find(x=>x.k===k);if(!mo)return;try{mo.groups().forEach(([,its])=>its.forEach(i=>{if(!o[i[0]])o[i[0]]=i}))}catch(e){}});
    const mg=()=>mhManage();
    if(!o.mh_hd)o.mh_hd=MI("mh_hd","Chứng từ nhà cung cấp",mg);
    if(!o.mh_chi)o.mh_chi=MI("mh_chi","Phiếu chi nhà cung cấp",mg);
    o.muctieu=MI("muctieu","Kế hoạch doanh thu",u=>can(u,"pl.xem")||mg());
    o.tien_lich=MI("tien_lich","Tiền & lịch chi",u=>can(u,"chiphi.xem")||mg());
    o.ngan_sach=MI("ngan_sach","Ngân sách chi phí",u=>can(u,"chiphi.xem")||mg());
    o.phai_thu=MI("phai_thu","Phải thu khách",u=>can(u,"chiphi.xem")||mg());
    o.nguong=MI("nguong","Ngưỡng cảnh báo & chỉ số",mg);
    o.npp360=MI("npp360","Hồ sơ NPP / đại lý",u=>can(u,"chiphi.xem")||mg());
    o.quytac=MI("quytac","Quy tắc vận hành & luồng việc",mg);
    o.cp_duyet=MI("cp_duyet","Chờ phân bổ",u=>can(u,"chiphi.xem")||can(u,"chiphi.nhap")||mg());
    o.cp_luong=MI("cp_luong","Lương theo phòng ban & kênh",u=>u.role==="admin"||can(u,"luong.quanly"));
    o.cp_thu=MI("cp_thu","Sổ thu",u=>can(u,"chiphi.xem")||can(u,"chiphi.nhap")||mg());
    o.so_cp=MI("so_cp","Sổ chi phí",u=>can(u,"chiphi.xem")||mg());
    return o};
  const pick=(P,keys,names)=>keys.map((id,i)=>{const it=P[id];return it?[it[0],(names&&names[i])||it[1],it[2],it[3]]:null}).filter(Boolean);
  /* Gom theo KÊNH BÁN: một kênh = một mục, bên trong có kết quả, khách, đơn, công nợ, bảng giá (không tách B2B, đại lý, NPP thành nhiều chỗ). */
  PAGE_SETS.push(
    {adm:true,n:"Giá thành & định mức",ids:["kho_boc","kho_cl","sku","kho_dm"],labels:["Định mức & giá thành","Chênh lệch định mức","Giá vốn SKU","Định mức theo sản phẩm"]});
  const tabMod=(k,ic,n,zone,keys,names)=>({k,adm:true,zone,ic,n,sub:"",groups:()=>[["",pick(pool(),keys,names)]]});
  MODULES.push(
    {k:"q_tq",adm:true,zone:"Điều hành",ic:"home",n:"Tổng quan",sub:"",groups:()=>[["",pick(pool(),["exec"],["Tổng quan"])]]},
    /* Điều hành theo câu hỏi của chủ doanh nghiệp (chị Hoa duyệt mẫu 26/10): Tổng quan · Báo cáo · Doanh thu · Chi phí. */
    {k:"q_bc",adm:true,zone:"",ic:"chart",n:"Báo cáo",sub:"",groups:()=>{const P=pool(),g=(n,ids,names)=>[n,pick(P,ids,names)];
      return [g("Báo cáo tài chính",["pl"],["Lãi lỗ công ty (P&L)"]),
        g("Báo cáo tồn kho",["kho_gtri","kho_nxt"],["Tồn kho & giá trị","Nhập – xuất – tồn"]),
        g("Báo cáo công nợ",["phai_thu","mh_no"],["Phải thu & tuổi nợ","Phải trả nhà cung cấp"]),
        g("Báo cáo dòng tiền",["tien_lich"],["Tiền & lịch chi"]),
        g("Hiệu quả sản xuất kinh doanh",["bc_tong","kho_boc","kho_cl","sku"],["Lãi theo kênh","Giá thành & định mức","Chênh lệch định mức","Giá vốn SKU"])].filter(x=>x[1].length)}},
    tabMod("q_kb","trend","Doanh thu","",["muctieu","bc_tiktok","bc_shopee","bc_fb","bc_b2b","bc_gc","cp_thu","doisoat"],["Kế hoạch doanh thu","TikTok Shop","Shopee","Facebook","B2B / Đại lý (NPP)","Gia công","Sổ thu","Đối soát tiền về"]),
    tabMod("q_cp","wallet","Chi phí","",["so_cp","ngan_sach","cr_bill"],["Sổ chi phí","Ngân sách","Kho bill, chứng từ"]),
    tabMod("q_mh","cart","Mua hàng","Nghiệp vụ",["mh_po","mh_hd","mh_chi","mh_gianvl"],["Đơn mua hàng","Chứng từ nhà cung cấp","Phiếu chi nhà cung cấp","Giá nguyên vật liệu theo tháng"]),
    tabMod("q_sx","fac","Sản xuất & Kho","",["sx_nc","kho_vo","kho_map","kho_qd","kho_dm"],["Phiếu sản xuất & tiến độ","Vỏ can, chai & thùng","Đồng bộ mã B2B","Đơn sàn & quy đổi mã","Định mức theo sản phẩm"]),
    {k:"q_cfg",adm:true,zone:"Hệ thống",ic:"gear",n:"Cấu hình",sub:"",groups:()=>{const P=pool(),g=(n,ids,names)=>[n,pick(P,ids,names)];
      return [g("Tài khoản",["nhansu","phongban"],["Tài khoản & phân quyền","Phòng ban"]),
        g("Danh mục",["sanpham","kenhban","chiphidm","cr_rcv"],["Sản phẩm","Kênh bán & phí","Danh mục chi phí","Tài khoản nhận tiền"]),
        g("Chính sách bán hàng",["cr_gia","cr_dc","cr_thuong","cr_giagc"],["Bảng giá","Giá điều chỉnh / khuyến mại","Cơ chế thưởng & xếp hạng NPP","Bảng giá riêng gia công"]),
        g("Dữ liệu & AI",["cr_import","caidat","bots","agentchat","agents","quychuan"],["Dữ liệu","Sao lưu dữ liệu","Trợ lý AI","Điều hành agent","Agent AI","Quy chuẩn"]),
        g("Theo dõi",["quytac","nguong","soat_sl","cr_audit"],["Quy tắc vận hành & luồng việc","Ngưỡng cảnh báo & chỉ số","Máy soát số liệu","Nhật ký"])].filter(x=>x[1].length)}});

  /* ---------- Nút "+ Ghi nhanh" ở đầu thanh bên ---------- */
  const gnGo=p=>{PAGE=p;try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}render();scrollTo(0,0)};
  const gnReady=async()=>{try{await mhLoad()}catch(e){}for(let i=0;i<40&&!MH.sup;i++)await new Promise(r=>setTimeout(r,150))};
  const gnItems=()=>{const mg=mhManage(),ed=mg||can(ME,"chiphi.nhap");return [
    ["Ghi phiếu thu / phiếu chi","Chọn thu hoặc chi, kèm ảnh bill",ed,()=>spForm()],
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
