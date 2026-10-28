/* =====================================================================
   SẮP MENU HAI WEB THEO BẢNG PHÂN VÙNG (chị Hoa duyệt 26/10/2026, docs/PHAN-VUNG-HAI-WEB.html, "Hai menu bản 3").
   Chạy sau cùng: gom mọi trang đang có trong menu (sau khi các file khác đã thêm/sửa) rồi xếp lại thành:
     Quản trị: Điều hành CEO · Tài chính – Kế toán · Ngân sách & chi phí · Phê duyệt (pheduyet.js) · Cấu hình
     Vận hành: Tổng quan vận hành · Kinh doanh · Marketing · Kho – Sản xuất · Nhân sự · Công việc · AI Agent (+ Của tôi ở chỗ bấm tên)
   Chỉ đổi chỗ và đổi tên hiện trên menu; không làm trang mới. Quyền xem của từng trang giữ nguyên (lấy đúng điều kiện cũ).
   Trang nào trong các mục nguồn mà bảng không nhắc tới thì không bỏ: tự nối vào cuối mục mới tương ứng (nhóm "Khác").
   ===================================================================== */
{
  const SRC=MODULES.slice();
  const ADMH=typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin";
  let C=null;
  /* Kho trang: id → [id, tên, điều kiện xem, số đếm]. Web nào ưu tiên điều kiện của menu web đó (giống trước khi sắp). */
  const pool=()=>{if(C)return C;const o={},src={};
    const L=ADMH?SRC.filter(m=>m.adm).concat(SRC.filter(m=>!m.adm)):SRC.filter(m=>!m.adm).concat(SRC.filter(m=>m.adm));
    L.forEach(m=>{try{m.groups().forEach(([,its])=>its.forEach(i=>{if(!i)return;if(!o[i[0]])o[i[0]]=i;(src[m.k]=src[m.k]||[]).push(i[0])}))}catch(e){}});
    if(!o.quytac&&typeof PAGES!=="undefined"&&PAGES.quytac)o.quytac=MI("quytac","Quy tắc vận hành & luồng việc",()=>typeof mhManage==="function"&&mhManage());
    C={o,src};Promise.resolve().then(()=>{C=null});return C};
  const it=(P,x)=>{const[id,nm]=Array.isArray(x)?x:[x];const i=P[id];return i?[i[0],nm||i[1],i[2],i[3]]:null};
  /* spec: [[tên nhóm, [id | [id, tên mới]]]]; from: mục cũ để vét trang bảng chưa nhắc; drop: trang cố ý chuyển sang web kia. */
  const mod=(k,ic,n,zone,spec,from,drop,extra)=>Object.assign({k,ic,n,zone,sub:"",adm:ADMH||undefined,groups:()=>{const{o,src}=pool();
    const G=spec.map(([g,ids])=>[g,ids.map(x=>it(o,x)).filter(Boolean)]);
    const used=new Set(USED),left=[];(from||[]).forEach(f=>(src[f]||[]).forEach(id=>{if(!used.has(id)&&!(drop||[]).includes(id)&&!left.some(i=>i[0]===id)&&o[id])left.push(o[id])}));
    if(left.length)G.push(["Khác",left]);
    return G.filter(g=>g[1].length)}},extra||{});
  const ids=spec=>spec.flatMap(([,L])=>L.map(x=>Array.isArray(x)?x[0]:x));
  const keep=k=>SRC.find(m=>m.k===k);
  let USED=[],NEW=[];

  if(ADMH){
    const S={
      tq:[["",[["exec","Tổng quan công ty"]]],
        ["Kênh bán hàng",[["bc_tiktok","TikTok Shop"],["bc_shopee","Shopee"],["bc_fb","Facebook"],["cskh_cu","CSKH cũ"],["bc_b2b","Kênh phân phối"],["bc_gc","Kênh OEM"],["bc_tong","So sánh kênh"],["dt_dc","Đối chiếu doanh thu"]]],
        ["Kế hoạch & KPI",[["muctieu","Kế hoạch doanh thu"]]],
        ["Cảnh báo",[["soat_sl","Máy soát số liệu"],["nguong","Ngưỡng cảnh báo & chỉ số"]]]],
      tc:[["Lãi lỗ",[["pl","P&L công ty"]]],
        ["Thu chi",[["cp_thu","Sổ thu"],["so_cp","Sổ chi phí"],["cr_bill","Kho bill giao dịch"],["cr_s_bill","Kho bill giao dịch"],["doisoat","Đối soát tiền về"],["cr_vc","Phiếu chi vận chuyển"],["cr_s_vc","Phiếu chi vận chuyển"]]],
        ["Dòng tiền",[["tien_lich","Tiền & lịch chi"]]],
        ["Công nợ",[["phai_thu","Công nợ khách hàng"],["mh_no","Công nợ nhà cung cấp"],["tcn_dc","Đối chiếu công nợ & tiền"]]],
        ["Giá thành",[["sku","Giá vốn SKU"],["kho_boc","Định mức & giá thành"],["kho_cl","Chênh lệch định mức"],["mh_gianvl","Giá nguyên vật liệu"]]],
        /* Quy đổi mã các sàn đã chuyển sang Cấu hình › Sản phẩm & combo (28/10). Đồng bộ mã Kênh phân phối: bảng xếp vào Kho › Danh mục bên vận hành, nhưng web vận hành đang che hai trang này (opsview.js) nên tạm giữ ở đây. */
        ["Tồn kho",[["kho_gtri","Tồn kho & giá trị"],["kho_dc","Đối chiếu tồn kho"],["kho_map","Đồng bộ mã Kênh phân phối"]]]],
      ns:[["",[["ngan_sach","Ngân sách"]]]],
      pd:[["",[["pheduyet","Phê duyệt"]]]],
      cfg:[["Tài khoản",[["nhansu","Tài khoản & phân quyền"],["phongban","Phòng ban"]]],
        ["Danh mục",[["spcombo","Sản phẩm & combo"],["sanpham","Sản phẩm"],["kenhban","Kênh bán & phí"],["chiphidm","Danh mục chi phí"],["cr_rcv","Tài khoản nhận tiền"]]],
        ["Chính sách bán hàng",[["cr_gia","Bảng giá"],["cr_dc","Giá điều chỉnh / khuyến mại"],["cr_thuong","Thưởng & xếp hạng NPP"],["cr_giagc","Bảng giá Kênh OEM"]]],
        ["Dữ liệu & sao lưu",[["cr_import","Nhập dữ liệu CRM"],["caidat","Sao lưu dữ liệu"],["cr_audit","Nhật ký"],["agents","Quyền agent"]]]]};
    /* Chuyển hẳn sang web vận hành (đã có ở đó): mua hàng, sản xuất, kho, quy chuẩn, agent điều hành, bot. */
    const DROP=["mh_po","sx_nc","kho_nxt","kho_vo","kho_dm","quychuan","quytac","bots","agentchat","kho_qd"]; // kho_qd: nay là Cấu hình › Sản phẩm & combo
    const Q=SRC.filter(m=>m.adm).map(m=>m.k);
    USED=Object.values(S).flatMap(ids);
    NEW=[mod("q_tq","home","Điều hành CEO","",S.tq,[],DROP),
      mod("q_tc","fin","Tài chính – Kế toán","",S.tc,[],DROP),
      mod("q_ns","chart","Ngân sách & chi phí","",S.ns,[],DROP),
      mod("q_pd","check","Phê duyệt","",S.pd,[],DROP),
      mod("q_cfg","gear","Cấu hình","Hệ thống",S.cfg,Q,DROP)];
    /* Bảng tách Giá thành thành từng trang riêng, nên bỏ nhóm gộp "Giá thành & định mức". */
    for(let i=PAGE_SETS.length-1;i>=0;i--)if(PAGE_SETS[i].adm)PAGE_SETS.splice(i,1);
  }else{
    const S={
      exec:[["",[["exec","Tổng quan vận hành"]]]],
      kd:[["Kênh bán lẻ",[["bc_tiktok","TikTok Shop"],"bc_shopee","bc_fb","fb_sale","fb_cskh"]],
        ["Kênh phân phối",[["cr_rp","Dashboard kênh phân phối"],"cr_kh","cr_dn","cr_cn","cr_ret",["cr_gia","Bảng giá"],"cr_bill","cr_vc",["cr_im","Nhập dữ liệu CRM"],
          "cr_s_hn","cr_s_kh","cr_s_dn",["cr_s_gia","Bảng giá"],"cr_s_cn","cr_s_ret","cr_s_kq","cr_s_bill","cr_s_vc"]],
        ["Kênh OEM",[["gc_tq","Tổng quan Kênh OEM"],["gc_kh","Khách hàng OEM"],["gc_don","Đơn OEM"],["gc_sx","Sản xuất OEM"],["gc_cn","Công nợ OEM"]]]],
      sx:[["",["sx_tq"]],
        ["Mua nguyên liệu",[["mh_po","Đơn mua hàng"],["sx_mh","Đơn mua hàng"],"mh_hd"]],
        ["Nhập kho",["kho_nhap","kho_ton"]],
        ["Sản xuất",["sx_nc","sx_td","kho_pc","sx_lo","sx_bc"]],
        ["Thành phẩm & xuất",["kho_nhap_tp","sx_kho","kho_xuat_b2b","kho_online","kho_xuat","kho_hoan","kho_nxt","kho_cl"]],
        ["Danh mục",["kho_dm","kho_vo","kho_map","kho_combo"]]],
      cv:[["",["cv_v","cv_da","cv_mt","hq","quychuan","quytac"]]],
      agt:[["",["agentchat","hoithoaiagent","huanluyenagent",["ai","Trợ lý AI"],["bots","Bot phòng ban"]]]]};
    /* Chuyển sang web quản trị (kế toán, chính sách): đã có sẵn ở đó.
       Kho bill, Phiếu chi vận chuyển ở CẢ hai web (chị Hoa chốt 26/10): sale nhập bill, chị Thảo lập phiếu chi bên vận hành;
       kế toán xác nhận, xem ở quản trị › Thu chi. Web quản trị chỉ mở cho CEO và tài khoản có quyền kế toán (serve.ts). */
    const DROP=["bc_tong","cr_thuong","mh_no","mh_gianvl","kho_qd"];
    USED=Object.values(S).flatMap(ids);
    const mkt=keep("mkt"),hr=keep("hr"),aiq=keep("aiq"),me=keep("me");
    if(mkt)mkt.zone="";if(hr)hr.zone="";
    NEW=[mod("exec","home","Tổng quan vận hành","",S.exec,["exec"],DROP),
      mod("kd","bag","Kinh doanh","",S.kd,["b2c","b2blink","gc"],DROP),
      mkt,
      mod("sx","fac","Kho – Sản xuất","",S.sx,["sx","mhop"],DROP),
      hr,
      mod("cv","task","Công việc","",S.cv,["cv","hq"],DROP,{tabs:true}),
      mod("agt","spark","AI Agent","",S.agt,["agt"],DROP),
      aiq,me].filter(Boolean);
    /* Hai nhóm "Kho vật tư", "Sản xuất" đang gộp nhiều trang thành một dòng; bảng muốn thấy từng trang theo đường đi của hàng. */
    for(let i=PAGE_SETS.length-1;i>=0;i--)if(!PAGE_SETS[i].adm&&(PAGE_SETS[i].n==="Kho vật tư"||PAGE_SETS[i].n==="Sản xuất"))PAGE_SETS.splice(i,1);
  }
  /* Giữ lại (không hiện) các mục của web kia để chỗ khác còn tìm theo tên: modGroups tự ẩn mục không thuộc web đang mở. */
  MODULES.splice(0,MODULES.length,...NEW,...SRC.filter(m=>ADMH?!m.adm:m.adm));
}
