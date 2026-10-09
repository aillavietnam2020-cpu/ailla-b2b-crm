/* =====================================================================
   KHUNG PHÂN HỆ (web chung toàn công ty) + THIẾT LẬP DỮ LIỆU GỐC + DIGITAL + P&L (khung)
   ===================================================================== */
const DEPTS0=[
 {k:"BDH",n:"Ban điều hành",khoi:"Văn phòng",truong:"u_chi",moTa:"Điều hành chung, duyệt kế hoạch, xem P&L",phanHe:["bc","mkt","sale","kt","hr","setup"]},
 {k:"HCNS",n:"HCNS",khoi:"Văn phòng",truong:"",moTa:"Hồ sơ nhân sự, chấm công, lương thưởng, tuyển dụng",phanHe:["hr"]},
 {k:"KT",n:"Kế toán",khoi:"Văn phòng",truong:"",moTa:"Đối soát doanh thu, chi phí, công nợ; nhập chi phí tháng, giá thành",phanHe:["kt","bc"]},
 {k:"CM",n:"Content & Media",khoi:"Văn phòng",truong:"u_oanh",moTa:"Kế hoạch content, quay video, lịch đăng TikTok, Fanpage, live",phanHe:["mkt"]},
 {k:"ADS",n:"Ads/Digital",khoi:"Văn phòng",truong:"u_digital",moTa:"Quảng cáo Facebook, TikTok; order video; báo cáo Ads",phanHe:["mkt"]},
 {k:"KOC",n:"KOC",khoi:"Văn phòng",truong:"",moTa:"Booking KOC, affiliate TikTok Shop",phanHe:["mkt"]},
 {k:"B2B",n:"Sale B2B",khoi:"Văn phòng",truong:"",moTa:"Khách sỉ, đại lý, NPP — dùng CRM B2B (đang tuyển)",phanHe:["sale"]},
 {k:"B2C",n:"Sale B2C",khoi:"Văn phòng",truong:"",moTa:"Vận hành sàn TikTok, Shopee, bán online",phanHe:["sale"]},
 {k:"CSKH",n:"CSKH",khoi:"Văn phòng",truong:"",moTa:"Sale + chăm sóc khách hàng, xử lý đơn Pancake",phanHe:["sale"]},
 {k:"SX",n:"Sản xuất",khoi:"Sản xuất & Kho",truong:"",moTa:"2 nhà máy Thanh Oai: sản xuất, kỹ thuật, đóng sàn",phanHe:[]},
 {k:"KV",n:"Kho vận",khoi:"Sản xuất & Kho",truong:"",moTa:"Kho hàng, đóng gói, giao vận",phanHe:[]},
];
const KHOI=["Văn phòng","Sản xuất & Kho"];
const SALECH0=[
 {k:"TTS",n:"TikTok Shop",loai:"Sàn TMĐT",phiSan:28,phiTT:0,phiDV:0,affiliate:0,vc:0,note:"Tổng phí sàn thực tế T7/2026 = 28,0% doanh thu thuần (gộp hoa hồng, dịch vụ, giao dịch, affiliate, thuế, vận chuyển). Tách chi tiết khi có file quyết toán.",active:true},
 {k:"SPE",n:"Shopee",loai:"Sàn TMĐT",phiSan:13.1,phiTT:6.9,phiDV:10.4,affiliate:3.5,vc:0,note:"Thực tế T7/2026 (2 shop): tổng 33,8%. Phí dịch vụ đã gộp 1,7% thuế sàn khấu trừ. Đang thuê ngoài vận hành.",active:true},
 {k:"FB",n:"Facebook / Pancake",loai:"Mạng xã hội",phiSan:0,phiTT:0,phiDV:0,affiliate:0,vc:0,note:"Đơn chốt qua inbox",active:true},
 {k:"B2B",n:"B2B / Đại lý (CRM)",loai:"Bán sỉ",phiSan:0,phiTT:0,phiDV:0,affiliate:0,vc:0,note:"Số liệu lấy từ CRM B2B",active:true},
 {k:"WEB",n:"Website",loai:"Website",phiSan:0,phiTT:0,phiDV:0,affiliate:0,vc:0,note:"",active:false},
];
const COSTCAT0=[
 ["ADS-FB","Quảng cáo Facebook","Marketing","Biến đổi","Kênh","ADS","Tự lấy từ báo cáo Ads Facebook"],
 ["ADS-TT","Quảng cáo TikTok (GMV Max, Spark)","Marketing","Biến đổi","Kênh","ADS",""],
 ["KOC","Hoa hồng affiliate / KOC","Marketing","Biến đổi","Kênh","KOC",""],
 ["SX-CT","Sản xuất content (mẫu, đạo cụ, quay)","Marketing","Biến đổi","Phòng ban","CM",""],
 ["TOOL","Công cụ, phần mềm (AI, thiết kế…)","Marketing","Cố định","Phòng ban","CM",""],
 ["PHI-SAN","Phí sàn, phí thanh toán","Bán hàng","Biến đổi","Kênh","B2C","Tính tự động từ Kênh bán & phí"],
 ["VC","Vận chuyển","Logistics","Biến đổi","Kênh","KV",""],
 ["DG","Đóng gói","Logistics","Biến đổi","Sản phẩm","KV",""],
 ["LUONG","Lương cứng","Nhân sự","Cố định","Phòng ban","HCNS",""],
 ["THUONG","Thưởng, KPI, video winner","Nhân sự","Biến đổi","Phòng ban","HCNS",""],
 ["BH","Bảo hiểm, phúc lợi","Nhân sự","Cố định","Phòng ban","HCNS",""],
 ["THUE","Thuê nhà máy, kho, văn phòng","Vận hành","Cố định","Toàn công ty","BDH",""],
 ["DIEN","Điện, nước, internet","Vận hành","Cố định","Toàn công ty","BDH",""],
 ["VPP","Văn phòng phẩm, chi phí chung","Vận hành","Cố định","Toàn công ty","BDH",""],
 ["TC","Lãi vay, phí ngân hàng","Tài chính","Cố định","Toàn công ty","KT",""],
 ["KHAC","Chi phí khác","Khác","Biến đổi","Toàn công ty","BDH",""],
].map(r=>({k:r[0],n:r[1],nhom:r[2],loai:r[3],phanBo:r[4],pb:r[5],note:r[6]}));
const COST_GROUPS=["Marketing","Bán hàng","Logistics","Nhân sự","Vận hành","Tài chính","Khác"];
function ensureShape(d){
  if(!d.departments||!d.departments.some(p=>p.k==="CM"))d.departments=JSON.parse(JSON.stringify(DEPTS0));
  if(!d.saleChannels)d.saleChannels=JSON.parse(JSON.stringify(SALECH0));
  d.saleChannels.forEach(c=>{const z=SALECH0.find(x=>x.k===c.k);if(z&&!c.phiSan&&!c.phiTT&&!c.phiDV&&!c.affiliate)Object.assign(c,{phiSan:z.phiSan,phiTT:z.phiTT,phiDV:z.phiDV,affiliate:z.affiliate,note:z.note})});
  if(!d.costCats)d.costCats=JSON.parse(JSON.stringify(COSTCAT0));
  if(!d.costs)d.costs=[];
  if((!d.skus||!d.skus.length)&&SKUCOST.length)d.skus=SKUCOST.map(s=>({ma:s.ma,ten:s.ten,k:s.k,qc:s.qc,giaVon:{"2026-08":s.gv},giaBan:0,active:true}));
  if(!d.skus)d.skus=[];
  if((!d.staff||!d.staff.length)&&NHANSU0.length)d.staff=NHANSU0.map(x=>({...x,pb:(DEPTS0.find(p=>p.n===x.pb)||{k:""}).k}));
  if(!d.staff)d.staff=[];
  d.departments.forEach(p=>{p.phanHe=[...new Set((p.phanHe||[]).flatMap(x=>({dig:["mkt"],pl:["fin"],kt:["fin"],bc:["exec","b2c"],sale:p.k==="B2B"?["b2b"]:["b2c"],setup:["setup"]})[x]||[x]))]});
  crmSeed(d);
  gvSeed(d);cvSeed(d);hrShape(d);aiShape(d);dcShape(d);botShape(d);if(d.mode==="live")d.settings.today=realDay();if(!d.kenhPT)d.kenhPT={};if(!d.strategyExtra)d.strategyExtra=[];
  const pbOf={u_chi:"BDH",u_digital:"ADS"},nsOf={u_quynh:"NV012"};
  d.users.forEach(u=>{if(u.role==="digital"&&!u.phongBan)u.phongBan="ADS";if(u.phongBan===undefined||u.phongBan==="MKT"||u.phongBan==="DIG"||u.phongBan==="BGD")u.phongBan=pbOf[u.id]||(u.role==="content"||u.role==="lead"?"CM":u.role==="digital"?"ADS":"");if(u.maNS===undefined)u.maNS=nsOf[u.id]||"";if(u.role==="admin")u.perms=ALL_PERMS.slice()});
  if(typeof syncPillars==="function")syncPillars(d);return d;
}

/* ---------- Phân hệ ---------- */
const MI=(k,t,p,c)=>[k,t,p||(()=>true),c];
const tq=u=>can(u,"tongquan.xem");
/* Nhóm trang: một dòng ở thanh bên (hoặc một tab), bấm vào có hàng nút chuyển giữa các trang trong nhóm.
   Dòng ở thanh bên lấy tên nhóm và trỏ tới trang đầu tiên người đó được xem. */
const PAGE_SETS=[
  {n:"Bảng tiến độ",ids:["cv_kb","congviec"],labels:["Tất cả việc","Theo bước video"]},
  {n:"Lịch",ids:["cv_lich","giaoviec"],labels:["Lịch việc","Lịch quay"]},
  {n:"Hiệu quả",ids:["hieuqua","baocao"],labels:["Hiệu quả tháng","Nhập số liệu"]},
  {n:"Kế hoạch tháng",ids:["kehoach","research","dieuphoi"],labels:["Kế hoạch","Research & insight","Tất cả thẻ video"]},
  {n:"Quảng cáo",ids:["adshieuqua","adssp","fb_ads"],labels:["Hiệu quả Ads","Theo sản phẩm","Báo cáo theo ngày"]}];
const setOf=id=>PAGE_SETS.find(x=>x.ids.includes(id));
/* Gộp các trang cùng nhóm thành một dòng: giữ trang đầu tiên được xem, đổi tên thành tên nhóm, ẩn các trang còn lại. */
function collapseSets(items){const seen=new Set();return items.filter(i=>{const st=setOf(i[0]);if(!st)return true;if(seen.has(st))return false;seen.add(st);return true}).map(i=>{const st=setOf(i[0]);return st?[i[0],st.n,i[2],i[3],st]:i})}
const ADM_ITEM=(k,n)=>{const i=MENU_ADMIN.flatMap(g=>g[1]).find(x=>x[0]===k);return i?[i[0],n||i[1],i[2],i[3]]:null};
/* Nhóm theo team: mỗi người thuộc một team (content, koc, live, ads), chỉ thấy khu của team mình. Chưa đặt thì suy ra từ vai trò. */
const userTeam=u=>{if(!u)return "";if(u.team)return u.team;if(u.role==="admin")return "all";if(u.role==="digital")return "ads";if(u.role==="content"||u.role==="lead")return "content";return ""};
const dgOk=u=>u.role==="digital"||u.role==="admin"||userTeam(u)==="ads"||tq(u);
const ordCnt=()=>{try{return D().orders.filter(o=>o.trangThai!=="Xong").length||""}catch(e){return ""}};
/* Marketing gồm 4 khu: Content & Media, Booking KOC, Livestream, Digital Marketing. Mỗi người chỉ thấy khu của team mình (chưa đặt team thì thấy hết). */
const tm=(t,p)=>u=>{const T=userTeam(u);return (!T||T==="all"||T===t)&&(!p||p(u))};
const MKT_G=()=>[
 ["Content & Media",[MI("mkt_tq","Tổng quan",tm("content",u=>u.role!=="digital"),()=>{try{return rvQueue().length||""}catch(e){return ""}}),ADM_ITEM("kehoach"),ADM_ITEM("research"),
   MI("dieuphoi","Tất cả thẻ video",tm("content",u=>u.role!=="digital")),ADM_ITEM("win","Video win"),ADM_ITEM("hieuqua"),MI("nhaplieu","Nhập báo cáo",tm("content",u=>u.role==="admin"||can(u,"baocao.tiktok")||can(u,"baocao.ads")||u.role==="lead")),
   MI("order_c","Order từ Ads",tm("content",u=>can(u,"order.xem")||u.role==="content"||u.role==="lead"||u.role==="admin"),ordCnt),MI("hoc_kb","Học từ kịch bản",tm("content",()=>true))].filter(Boolean).map(i=>[i[0],i[1],(u=>{const T=userTeam(u);return (!T||T==="all"||T==="content")&&i[2](u)}),i[3]])],
 ["Booking KOC",[MI("bc_koc","KOC / Affiliate",u=>{const T=userTeam(u);return (!T||T==="all"||T==="koc")&&(tq(u)||u.role==="admin"||T==="koc")})]],
 ["Livestream",[MI("live","Livestream (đang xây)",()=>true)]],
 ["Digital Marketing",[MI("dg_tq","Tổng quan Digital",tm("ads",dgOk)),MI("dg_lib","Thư viện video ads",tm("ads",dgOk)),
   MI("adshieuqua","Hiệu quả Ads",tm("ads",u=>can(u,"baocao.ads")||dgOk(u))),MI("adssp","Ads theo sản phẩm",tm("ads",u=>can(u,"baocao.ads")||dgOk(u))),MI("fb_ads","Báo cáo Ads theo ngày",tm("ads",dgOk)),
   MI("order","Order cho Content",tm("ads",u=>dgOk(u)||can(u,"order.xem")),ordCnt),MI("nhaplieu","Nhập báo cáo Ads",u=>userTeam(u)==="ads"&&(can(u,"baocao.ads")||u.role==="digital"))].filter(Boolean)]];
/* Menu: 8 mục lớn. "hide" = không hiện ở thanh bên (Trợ lý AI ở nút trên cùng, mục Của tôi ở chỗ bấm vào tên).
   "tabs" = các trang con hiện thành thanh tab trong trang, thanh bên chỉ còn một dòng. */
const MODULES=[
 {k:"exec",zone:"",ic:"home",n:"Tổng quan",sub:"",groups:()=>[["",[MI("exec","Tổng quan điều hành",tq)]]]},
 {k:"cv",zone:"",ic:"task",n:"Task giao việc",sub:"",tabs:true,groups:()=>[["",[MI("cv_tq","Tổng quan"),MI("cv_nv","Task",null,()=>cvFilter(cvItems()).filter(x=>x.late).length||""),ADM_ITEM("cv","Cần duyệt"),MI("cv_kb","Bảng tiến độ"),ADM_ITEM("congviec"),MI("cv_lich","Lịch"),ADM_ITEM("giaoviec"),MI("cv_mt","Mục tiêu"),MI("cv_da","Dự án")].filter(Boolean)]]},
 {k:"aiq",zone:"",ic:"spark",n:"Trợ lý AI",sub:"",hide:true,groups:()=>[["",[MI("ai","Trợ lý AI",u=>can(u,"kehoach.xem"),()=>{try{return aiTop(9).length||""}catch(e){return ""}})]]]},
 {k:"me",zone:"",ic:"ppl",n:"Của tôi",sub:"",hide:true,groups:()=>[["",[MI("hr_me","Nghỉ phép, OT, tạm ứng"),MI("hr_kpime","KPI của tôi"),MI("ketquatoi","Kết quả video của tôi",u=>u.role==="content"),MI("matkhau","Đổi mật khẩu")]]]},
 {k:"b2c",zone:"Bán hàng",ic:"bag",n:"Bán hàng B2C",sub:"TikTok · Shopee · Facebook",groups:()=>[
   ["Báo cáo kênh",[MI("bc_tong","Tổng quan kênh",tq),MI("bc_tiktok","TikTok Shop",tq),MI("bc_shopee","Shopee",tq),MI("bc_fb","Facebook",tq)]],
   ["Facebook",[MI("fb_sale","Sale B2C",tq),MI("fb_cskh","Chăm sóc khách hàng",tq)]]]},
 {k:"b2b",zone:"Bán hàng",ic:"box",n:"Kinh doanh B2B",sub:"Đại lý · NPP · CRM",groups:()=>[
   ["Bán hàng",[MI("b2b_today","Việc hôm nay"),MI("b2b_kh","Khách hàng"),MI("b2b_don","Đơn hàng & duyệt",null,()=>(D().b2b?D().b2b.orders.flatMap(o=>o.approvals||[]).filter(a=>a.status==="PENDING").length:"")||""),MI("b2b_gia","Bảng giá 8 cấp"),MI("b2b_cn","Công nợ"),MI("b2b_perf","Kết quả cá nhân")]],
   ["Quản lý",[MI("b2b_team","Điều hành đội ngũ"),MI("b2b_ceo","Bàn điều hành CEO",u=>u.role==="admin")]]]},
 {k:"mkt",zone:"Vận hành",ic:"mega",n:"Marketing",sub:"Content · Digital · KOC · Live",groups:MKT_G},
 {k:"sx",zone:"Vận hành",ic:"fac",n:"Sản xuất & kho",sub:"",tabs:true,groups:()=>[["",SX_TABS.concat(KHO_SUB.filter(([k])=>k!=="kho_ton")).map(([k,t])=>MI(k,t))]]},
 {k:"fin",zone:"Quản trị",ic:"fin",n:"Tài chính",sub:"",groups:()=>[["",[MI("pl","Báo cáo P&L",u=>can(u,"pl.xem")),MI("chiphi","Chi phí theo tháng",u=>can(u,"chiphi.xem")),MI("doisoat","Đối soát tiền về",u=>can(u,"chiphi.xem")),MI("sku","Giá vốn SKU",u=>can(u,"gia.xem_von"))]]]},
 {k:"hr",zone:"Quản trị",ic:"ppl",n:"Nhân sự",sub:"",groups:()=>[
   ["Hồ sơ",[MI("hr_tq","Tổng quan nhân sự",u=>can(u,"nhansu.quanly")),MI("hoso","Hồ sơ nhân sự",u=>can(u,"nhansu.quanly")),MI("hr_hd","Hợp đồng & thử việc",u=>can(u,"nhansu.quanly"))]],
   ["Chấm công & hiệu suất",[MI("hr_cc","Chấm công",u=>can(u,"nhansu.quanly")),MI("hr_nghi","Đơn từ: nghỉ, OT, tạm ứng",u=>can(u,"nhansu.quanly")||can(u,"nhansu.duyet"),()=>(D().hr?D().hr.don.filter(x=>x.tt==="cho").length+D().hr.tu.filter(x=>x.tt==="cho").length:"")||""),MI("hr_kpi","KPI",u=>can(u,"nhansu.quanly")||can(u,"nhansu.duyet")),MI("hr_xb","Xét bậc & đánh giá",u=>can(u,"nhansu.quanly"))]],
   ["Lương",[MI("hr_bl","Bảng lương",u=>can(u,"luong.quanly")),MI("hr_pl","Phiếu lương",u=>can(u,"luong.quanly")),MI("hr_cdl","Cài đặt lương",u=>can(u,"luong.quanly"))]],
   ["Tuyển dụng",[MI("hr_td","Tuyển dụng & đào tạo",u=>can(u,"nhansu.quanly"))]],
   ["Dữ liệu",[MI("hr_nap","Nạp file HR MASTER",u=>can(u,"nhansu.quanly"))]]]},
 {k:"setup",zone:"Quản trị",ic:"gear",n:"Cài đặt",sub:"",groups:()=>[
   ["Tổ chức",[MI("nhansu","Tài khoản & phân quyền",u=>can(u,"nhansu.quanly")),MI("phongban","Phòng ban",u=>can(u,"thietlap.quanly"))]],
   ["Danh mục",[MI("sanpham","Sản phẩm",u=>can(u,"sanpham.quanly")),MI("kenhban","Kênh bán & phí",u=>can(u,"thietlap.quanly")),MI("chiphidm","Danh mục chi phí",u=>can(u,"thietlap.quanly"))]],
   ["Hệ thống",[MI("bots","Bot AI phòng ban",u=>can(u,"caidat.quanly")),MI("quychuan","Quy chuẩn"),MI("caidat","Sao lưu dữ liệu",u=>can(u,"caidat.quanly"))]]]},
];
let MOD="";
const modGroups=mo=>mo.groups().map(([g,items])=>[g,items.filter(i=>i[2](ME))]).filter(g=>g[1].length);
const visibleMods=()=>MODULES.filter(mo=>modGroups(mo).length);
/* Thanh tab trong trang cho phân hệ dạng tab (Sản xuất có thanh riêng). */
function modTabs(m){if(APP_MODE!=="admin")return;const mo=curMod();if(!mo)return;const all=modGroups(mo).flatMap(g=>g[1]),ph=m.querySelector(".ph"),put=el=>{const t=m.querySelector(":scope > nav.sxtabs");if(t)t.after(el);else if(ph)ph.after(el);else m.prepend(el)};
  if(mo.tabs&&mo.k!=="sx"){const its=collapseSets(all);if(its.length>1){const nav=document.createElement("nav");nav.className="sxtabs";nav.innerHTML=its.map(([id,t,,cnt,st])=>{const n=cnt?cnt():"",on=id===PAGE||(st&&st.ids.includes(PAGE));return `<button class="${on?"on":""}" data-mt="${id}">${t}${n!==""&&n!==0?` <b class="cnt">${n}</b>`:""}</button>`}).join("");put(nav)}}
  const st=setOf(PAGE);if(st){const ok=st.ids.filter(id=>all.some(i=>i[0]===id));if(ok.length>1){const nav=document.createElement("nav");nav.className="settabs";nav.innerHTML=ok.map(id=>`<button class="${id===PAGE?"on":""}" data-mt="${id}">${st.labels[st.ids.indexOf(id)]}</button>`).join("");put(nav)}}
  m.querySelectorAll("[data-mt]").forEach(b=>b.onclick=()=>{PAGE=b.dataset.mt;try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}renderMain();scrollTo(0,0)})}

/* ---------- P&L (khung) ---------- */
function pPL(m){
  const d=D(),ms=monthStats(),adsChi=sum(d.weekly,w=>w.ads),costM=d.costs.filter(c=>c.thang===MONTH.key),costBy=g=>sum(costM.filter(c=>(d.costCats.find(x=>x.k===c.cat)||{}).nhom===g),c=>c.tien);
  const L=[["Doanh thu TikTok Shop (video)",ms.all,"Báo cáo TikTok tuần (Marketing › Nhập báo cáo)","Có","grn"],["Doanh thu Shopee","—","Báo cáo Shopee tháng (thuê ngoài gửi)","Cần thêm ô nhập","amb"],["Doanh thu Facebook / Pancake","—","Xuất từ Pancake","Cần thêm ô nhập","amb"],["Doanh thu B2B / Đại lý","—","CRM B2B (đơn đã kế toán xác nhận)","Nối khi gộp CRM","amb"],["− Phí sàn, phí thanh toán","—","Doanh thu × % phí ở Thiết lập › Kênh bán & phí","Cần điền % phí","amb"],["− Giá vốn hàng bán","—","Số lượng bán × giá vốn SKU (Thiết lập › SKU & giá vốn)","Có giá vốn T8 · cần số lượng theo SKU","amb"],["= Lợi nhuận gộp","—","Tự tính","",""],["− Chi phí Marketing (Ads, KOC, content)",adsChi+costBy("Marketing"),"Báo cáo Ads + Chi phí theo tháng","Có một phần","grn"],["− Chi phí Logistics",costBy("Logistics"),"Chi phí theo tháng","Kế toán nhập","amb"],["− Chi phí Nhân sự",costBy("Nhân sự"),"Chi phí theo tháng (sau: phân hệ Nhân sự)","Kế toán nhập","amb"],["− Chi phí Vận hành, Tài chính, Khác",costBy("Vận hành")+costBy("Tài chính")+costBy("Khác"),"Chi phí theo tháng","Kế toán nhập","amb"],["= Lợi nhuận ròng","—","Tự tính","",""]];
  m.innerHTML=H("Báo cáo P&L","Khung báo cáo · đang xây (giai đoạn 2, sau Digital)")+`<div class="note">P&L tự cộng từ các phân hệ, không nhập tay lại: doanh thu từ báo cáo kênh, giá vốn từ SKU, phí sàn từ Kênh bán, chi phí từ Chi phí theo tháng. Bảng dưới cho thấy từng dòng lấy số ở đâu và đã sẵn sàng chưa.</div>
  <section class="card">${tbl(["Dòng P&L","Tháng "+MONTH.mon+" (đến hiện tại)","Lấy số từ","Dữ liệu"],L.map(r=>`<tr class="${r[0].startsWith("=")?"tot":""}"><td><b>${r[0]}</b></td><td class="n">${typeof r[1]==="number"?money(r[1]):r[1]}</td><td>${r[2]}</td><td>${r[3]?pill(r[3],r[4]):""}</td></tr>`))}</section>
  <section class="card"><div class="card-h"><h2>Sẽ có khi xong giai đoạn P&L</h2></div><ol class="lessons"><li>P&L theo tháng, theo kênh, theo sản phẩm, so với kế hoạch và tháng trước.</li><li>Biên lợi nhuận gộp từng SKU (giá bán − giá vốn − phí sàn).</li><li>Chi phí Marketing trên doanh thu theo kênh; ROAS thật sau giá vốn.</li><li>Nhập báo cáo Shopee, Pancake, xuất MISA; lấy doanh thu B2B từ CRM.</li></ol></section>`;
}
function pHR(m){m.innerHTML=H("Nhân sự","Làm sau Digital và P&L")+`<section class="card"><p>Phân hệ Nhân sự sẽ dùng chung danh sách người và phòng ban ở <b>Thiết lập</b>. Dự kiến: hồ sơ nhân sự, chấm công, KPI và lương thưởng (gồm thưởng video winner tự lấy từ Marketing), tuyển dụng.</p><div class="acts"><button class="btn" data-go="hoso">Danh sách nhân sự</button><button class="btn" data-go="nhansu">Tài khoản & phân quyền</button><button class="btn" data-go="phongban">Phòng ban</button></div></section>`}
function pCRM(m){m.innerHTML=H("Sale B2B — CRM","Đang chạy riêng, sẽ gộp vào khung chung")+`<section class="card"><p>CRM B2B (khách sỉ, đại lý, đơn hàng, công nợ, bảng giá 8 cấp) đang chạy ở địa chỉ riêng. Khi dựng bản thật, CRM trở thành phân hệ này: dùng chung đăng nhập, nhân sự, phòng ban và danh mục sản phẩm.</p><div class="acts"><a class="btn pri" href="https://ailla-b2b-crm-demo.aillavietnam2020.workers.dev/sales/performance" target="_blank" rel="noopener">Mở CRM B2B (bản demo)</a></div></section>`}

/* ---------- Thiết lập: phòng ban ---------- */
const PHANHE_N={exec:"Tổng quan",b2c:"Bán hàng B2C",b2b:"KD B2B",sx:"Sản xuất & kho",mkt:"Marketing",fin:"Tài chính",hr:"Nhân sự",setup:"Cài đặt"};
function pPhongBan(m){
  const d=D(),ed=can(ME,"thietlap.quanly"),st=d.staff.filter(x=>x.tt!=="Đã nghỉ"),uOpts=[["","—"]].concat(d.users.filter(u=>u.active).map(u=>[u.id,u.name+" (tài khoản)"]));
  const byK=KHOI.map(kh=>[kh,st.filter(x=>x.khoi===kh).length]);
  m.innerHTML=H("Phòng ban",`${d.departments.length} phòng ban · ${st.length} nhân sự · theo file AILLA HR MASTER`)+`<div class="grid kpis">${kpi("Tổng nhân sự",st.length)}${byK.map(([k,n])=>kpi("Khối "+k,n)).join("")}${kpi("Theo giờ",st.filter(x=>x.tt==="Theo giờ").length)}${kpi("Có tài khoản web",d.users.filter(u=>u.active).length)}</div>
  ${KHOI.map(kh=>`<section class="card flush"><div class="card-h pad"><h2>Khối ${kh}</h2></div><div class="tbl edit"><table><thead><tr><th>Mã</th><th>Phòng ban</th><th>Trưởng bộ phận</th><th>Nhiệm vụ</th><th>Dùng phân hệ</th><th class="n">Số người</th><th>Vị trí</th></tr></thead><tbody>
  ${d.departments.map((p,i)=>[p,i]).filter(([p])=>(p.khoi||"Văn phòng")===kh).map(([p,i])=>{const mem=st.filter(x=>x.pb===p.k),vt={};mem.forEach(x=>{const v=x.viTri||"Chưa ghi";vt[v]=(vt[v]||0)+1});return `<tr><td class="mono">${p.k}</td><td>${ed?`<input data-pb="${i}" data-f="n" value="${esc(p.n)}">`:`<b>${esc(p.n)}</b>`}</td><td>${ed?`<select data-pb="${i}" data-f="truong">${opt(uOpts.concat(mem.map(x=>[x.ma,x.ten])),p.truong)}</select>`:esc(userName(p.truong)||(st.find(x=>x.ma===p.truong)||{}).ten||"—")}</td><td>${ed?`<textarea rows="2" data-pb="${i}" data-f="moTa">${esc(p.moTa)}</textarea>`:esc(p.moTa)}</td><td><div class="phc">${Object.entries(PHANHE_N).map(([k,n])=>ed?`<label class="ck sm"><input type="checkbox" data-ph="${i}" value="${k}" ${p.phanHe.includes(k)?"checked":""}> ${n}</label>`:p.phanHe.includes(k)?pill(n,"blu")+" ":"").join("")}</div></td><td class="n"><button class="lnk" data-hs="${p.k}">${mem.length}</button></td><td>${Object.entries(vt).map(([v,n])=>`${esc(v)}${n>1?" ×"+n:""}`).join(", ")||(p.k==="B2B"?pill("Đang tuyển","amb"):"—")}</td></tr>`}).join("")}</tbody></table></div></section>`).join("")}
  ${ed?`<section class="card"><div class="card-h"><h2>Thêm phòng ban</h2></div><form class="frm row7" id="pbf"><label class="field">Mã<input id="pb-k" required maxlength="6"></label><label class="field">Tên phòng ban<input id="pb-n" required></label><label class="field">Khối<select id="pb-kh">${opt(KHOI,"Văn phòng")}</select></label><button class="btn pri">Thêm</button></form></section>`:""}`;
  m.querySelectorAll("[data-pb]").forEach(x=>x.onchange=()=>{DB.mutate(ME.name,"sửa phòng ban",dt=>dt.departments[+x.dataset.pb][x.dataset.f]=x.value);toast("Đã lưu")});
  m.querySelectorAll("[data-ph]").forEach(x=>x.onchange=()=>{DB.mutate(ME.name,"sửa phân hệ phòng ban",dt=>{const p=dt.departments[+x.dataset.ph];p.phanHe=x.checked?[...new Set(p.phanHe.concat(x.value))]:p.phanHe.filter(v=>v!==x.value)});toast("Đã lưu")});
  m.querySelectorAll("[data-hs]").forEach(b=>b.onclick=()=>{HSF.pb=b.dataset.hs;PAGE="hoso";render()});
  if($("#pbf"))$("#pbf").onsubmit=e=>{e.preventDefault();const k=$("#pb-k").value.trim().toUpperCase();if(d.departments.some(p=>p.k===k)){toast("Mã đã có");return}DB.mutate(ME.name,"thêm phòng ban",dt=>dt.departments.push({k,n:$("#pb-n").value,khoi:$("#pb-kh").value,truong:"",moTa:"",phanHe:[]}));renderMain()};
}
/* ---------- Thiết lập: danh sách nhân sự (thông tin tổ chức; không gồm lương / CCCD / tài khoản NH) ---------- */
let HSF={pb:"",q:""};
function pHoSo(m){
  const d=D(),ed=can(ME,"nhansu.quanly"),pbN=k=>(d.departments.find(p=>p.k===k)||{n:k||"—"}).n;
  const L=d.staff.filter(x=>(!HSF.pb||x.pb===HSF.pb)&&(!HSF.q||(x.ma+" "+x.ten+" "+x.viTri).toLowerCase().includes(HSF.q.toLowerCase())));
  const acc=ma=>d.users.find(u=>u.maNS===ma);
  m.innerHTML=H("Danh sách nhân sự",`${d.staff.length} người · nguồn: AILLA HR MASTER (tab 01_NhanSu)`)+`<div class="filters"><select id="hs-pb">${opt([["","Mọi phòng ban"]].concat(d.departments.map(p=>[p.k,p.n])),HSF.pb)}</select><input id="hs-q" placeholder="Tìm mã, tên, vị trí…" value="${esc(HSF.q)}" style="max-width:240px"></div>
  <div class="note">Trang này chỉ giữ thông tin tổ chức (phòng ban, vị trí, ngày vào làm). Lương, CCCD, tài khoản ngân hàng sẽ nằm trong phân hệ Nhân sự, chỉ HCNS và CEO được xem.</div>
  <section class="card flush"><div class="tbl edit"><table><thead><tr><th>Mã NS</th><th>Họ tên</th><th>Khối</th><th>Phòng ban</th><th>Vị trí</th><th>Ngày vào làm</th><th>Tình trạng</th><th>Tài khoản web</th></tr></thead><tbody>
  ${L.map(x=>{const i=d.staff.indexOf(x),u=acc(x.ma);return `<tr><td class="mono">${x.ma}</td><td><b>${esc(x.ten)}</b></td><td>${esc(x.khoi)}</td><td>${ed?`<select data-hs="${i}" data-f="pb">${opt([["","—"]].concat(d.departments.map(p=>[p.k,p.n])),x.pb)}</select>`:esc(pbN(x.pb))}</td><td>${ed?`<input data-hs="${i}" data-f="viTri" value="${esc(x.viTri)}">`:esc(x.viTri)}</td><td>${x.ngayVao?x.ngayVao.split("-").reverse().join("/"):"—"}</td><td>${ed?`<select data-hs="${i}" data-f="tt">${opt(["Thử việc","Chính thức","Theo giờ","Tạm nghỉ","Đã nghỉ"],x.tt)}</select>`:pill(x.tt,x.tt==="Chính thức"?"grn":"gry")}</td><td>${u?pill(u.username,"blu"):ed?`<select data-lk="${x.ma}">${opt([["","Gắn tài khoản…"]].concat(d.users.filter(v=>!v.maNS).map(v=>[v.id,v.name+" ("+v.username+")"])),"")}</select>`:"—"}</td></tr>`}).join("")}</tbody></table></div></section>
  ${ed?`<section class="card"><div class="card-h"><h2>Thêm nhân sự</h2></div><form class="frm row7" id="hsf"><label class="field">Họ tên<input id="hs-n" required></label><label class="field">Phòng ban<select id="hs-p">${opt(d.departments.map(p=>[p.k,p.n]),HSF.pb||"CM")}</select></label><label class="field">Vị trí<input id="hs-v"></label><label class="field">Ngày vào làm<input id="hs-d" type="date"></label><button class="btn pri">Thêm</button></form><p class="hint">Muốn người này đăng nhập web: tạo tài khoản ở Tài khoản & phân quyền rồi gắn ở cột "Tài khoản web".</p></section>`:""}`;
  $("#hs-pb").onchange=e=>{HSF.pb=e.target.value;renderMain()};$("#hs-q").onchange=e=>{HSF.q=e.target.value;renderMain()};
  m.querySelectorAll("[data-hs]").forEach(x=>x.onchange=()=>{DB.mutate(ME.name,"sửa hồ sơ nhân sự",dt=>{const r=dt.staff[+x.dataset.hs];r[x.dataset.f]=x.value;if(x.dataset.f==="pb")r.khoi=(dt.departments.find(p=>p.k===x.value)||{}).khoi||r.khoi});toast("Đã lưu")});
  m.querySelectorAll("[data-lk]").forEach(x=>x.onchange=()=>{if(!x.value)return;DB.mutate(ME.name,"gắn tài khoản với "+x.dataset.lk,dt=>{const u=dt.users.find(v=>v.id===x.value),r=dt.staff.find(v=>v.ma===x.dataset.lk);u.maNS=r.ma;u.phongBan=r.pb});toast("Đã gắn");renderMain()});
  if($("#hsf"))$("#hsf").onsubmit=e=>{e.preventDefault();DB.mutate(ME.name,"thêm nhân sự "+$("#hs-n").value,dt=>{const n=Math.max(0,...dt.staff.map(x=>+String(x.ma).replace(/\D/g,"")||0))+1,pb=$("#hs-p").value;dt.staff.push({ma:"NV"+String(n).padStart(3,"0"),ten:$("#hs-n").value,khoi:(dt.departments.find(p=>p.k===pb)||{}).khoi||"Văn phòng",pb,viTri:$("#hs-v").value,ql:"",ngayVao:$("#hs-d").value,tt:"Thử việc",hd:"",nghe:"",bac:""})});renderMain()};
}
/* ---------- Thiết lập: SKU & giá vốn ---------- */
let SKF={k:"",q:"",thang:"2026-08"};
function pSku(m){
  const d=D(),ed=can(ME,"thietlap.quanly"),months=[...new Set(d.skus.flatMap(s=>Object.keys(s.giaVon||{})))].sort();if(!months.includes(SKF.thang))SKF.thang=months[months.length-1]||"2026-08";
  const list=d.skus.filter(s=>(!SKF.k||s.k===SKF.k)&&(!SKF.q||(s.ma+" "+s.ten).toLowerCase().includes(SKF.q.toLowerCase())));
  const catOpts=(d.catalog||[]).map(c=>[c.k,c.n]).concat([["KHAC","Chưa gán sản phẩm"]]);
  m.innerHTML=H("SKU & giá vốn",`${d.skus.length} SKU · giá vốn theo bảng giá thành từng tháng`)+`<div class="filters"><select id="sk-k">${opt([["","Mọi sản phẩm"]].concat(catOpts),SKF.k)}</select><input id="sk-q" placeholder="Tìm mã, tên SKU…" value="${esc(SKF.q)}" style="max-width:240px"><select id="sk-m">${opt(months.map(x=>[x,"Giá vốn tháng "+x.slice(5)+"/"+x.slice(0,4)]),SKF.thang)}</select></div>
  <section class="card flush"><div class="tbl edit"><table><thead><tr><th>Mã SKU</th><th>Tên thành phẩm</th><th>Thuộc sản phẩm</th><th>Quy cách</th>${months.map(x=>`<th class="n">Giá vốn ${x.slice(5)}/${x.slice(2,4)}</th>`).join("")}<th class="n">Giá bán lẻ</th><th class="n">Biên gộp</th><th>Đang bán</th></tr></thead><tbody>
  ${list.map(s=>{const i=d.skus.indexOf(s),gv=(s.giaVon||{})[SKF.thang]||0,bien=s.giaBan?Math.round((s.giaBan-gv)/s.giaBan*100):null;return `<tr><td class="mono">${esc(s.ma)}</td><td>${esc(s.ten)}</td><td>${ed?`<select data-sk="${i}" data-f="k">${opt(catOpts,s.k)}</select>`:esc(sk(s.k).n)}</td><td>${ed?`<input class="s2" data-sk="${i}" data-f="qc" value="${esc(s.qc)}">`:esc(s.qc)}</td>${months.map(x=>`<td class="n">${(s.giaVon||{})[x]?nf(s.giaVon[x]):"—"}</td>`).join("")}<td class="n">${ed?`<input class="num" data-sk="${i}" data-f="giaBan" value="${s.giaBan||""}" placeholder="đ">`:s.giaBan?nf(s.giaBan):"—"}</td><td class="n">${bien===null?"—":pill(bien+"%",bien>=50?"grn":bien>=30?"amb":"red")}</td><td>${ed?`<input type="checkbox" data-sk="${i}" data-f="active" ${s.active?"checked":""} style="width:auto">`:s.active?"Có":"Ngừng"}</td></tr>`}).join("")}</tbody></table></div></section>
  `;
  $("#sk-k").onchange=e=>{SKF.k=e.target.value;renderMain()};$("#sk-q").onchange=e=>{SKF.q=e.target.value;renderMain()};$("#sk-m").onchange=e=>{SKF.thang=e.target.value;renderMain()};
  m.querySelectorAll("[data-sk]").forEach(x=>x.onchange=()=>{const f=x.dataset.f,v=f==="active"?x.checked:f==="giaBan"?+x.value||0:x.value;DB.mutate(ME.name,"sửa SKU",dt=>dt.skus[+x.dataset.sk][f]=v);toast("Đã lưu");if(f==="giaBan")renderMain()});
  if($("#dz-gt"))bindDrop("gt",async f=>{const rows=await readXlsx(f);const hi=rows.findIndex(r=>r&&r.some(c=>String(c).trim()==="Mã thành phẩm"));if(hi<0){toast("File không có cột \"Mã thành phẩm\"");return}const H2=rows[hi].map(c=>String(c||"").trim()),cM=H2.indexOf("Mã thành phẩm"),cT=H2.indexOf("Tên thành phẩm"),cG=H2.indexOf("Giá thành đơn vị");const th=$("#gt-m").value;let n=0,nw=0;
    DB.mutate(ME.name,"nhập giá thành tháng "+th,dt=>{rows.slice(hi+1).forEach(r=>{if(!r||!r[cM])return;const g=numVN(r[cG]);if(!g)return;const ma=String(r[cM]).trim();let s=dt.skus.find(x=>x.ma===ma);if(!s){s={ma,ten:String(r[cT]||""),k:guessSku(String(r[cT]||""))||"KHAC",qc:"",giaVon:{},giaBan:0,active:true};dt.skus.push(s);nw++}s.giaVon[th]=Math.round(g);n++})});SKF.thang=th;toast(`Đã nhập ${n} SKU (${nw} SKU mới) cho tháng ${th}`);renderMain()});
}
/* ---------- Thiết lập: kênh bán & phí ---------- */
function pKenhBan(m){
  const d=D(),ed=can(ME,"thietlap.quanly"),F=["phiSan","phiTT","phiDV","affiliate"];
  m.innerHTML=H("Kênh bán & phí","Dùng để tính phí sàn trong P&L")+`<section class="card flush"><div class="tbl edit"><table><thead><tr><th>Kênh</th><th>Loại</th><th class="n">Phí cố định %</th><th class="n">Phí thanh toán %</th><th class="n">Phí dịch vụ / voucher %</th><th class="n">Hoa hồng affiliate %</th><th class="n">Vận chuyển TB / đơn (đ)</th><th class="n">Tổng phí %</th><th>Ghi chú</th><th>Đang bán</th></tr></thead><tbody>
  ${d.saleChannels.map((c,i)=>`<tr><td><b>${esc(c.n)}</b></td><td>${esc(c.loai)}</td>${F.map(f=>`<td class="n">${ed?`<input class="num s" data-sc="${i}" data-f="${f}" value="${c[f]}">`:c[f]+"%"}</td>`).join("")}<td class="n">${ed?`<input class="num" data-sc="${i}" data-f="vc" value="${c.vc}">`:nf(c.vc)}</td><td class="n"><b>${(F.reduce((a,f)=>a+(+c[f]||0),0)).toFixed(1)}%</b></td><td>${ed?`<input data-sc="${i}" data-f="note" value="${esc(c.note)}">`:esc(c.note)}</td><td>${ed?`<input type="checkbox" data-sc="${i}" data-f="active" ${c.active?"checked":""} style="width:auto">`:c.active?"Có":"Không"}</td></tr>`).join("")}</tbody></table></div></section>
  ${ed?`<section class="card"><form class="frm row7" id="scf"><label class="field">Thêm kênh bán<input id="sc-n" required placeholder="VD: Lazada"></label><label class="field">Loại<select id="sc-l">${opt(["Sàn TMĐT","Mạng xã hội","Bán sỉ","Website","Khác"],"Sàn TMĐT")}</select></label><button class="btn pri">Thêm</button></form></section>`:""}`;
  m.querySelectorAll("[data-sc]").forEach(x=>x.onchange=()=>{const f=x.dataset.f,v=f==="active"?x.checked:f==="note"?x.value:+x.value||0;DB.mutate(ME.name,"sửa kênh bán",dt=>dt.saleChannels[+x.dataset.sc][f]=v);toast("Đã lưu");renderMain()});
  if($("#scf"))$("#scf").onsubmit=e=>{e.preventDefault();DB.mutate(ME.name,"thêm kênh bán",dt=>dt.saleChannels.push({k:uid("ch"),n:$("#sc-n").value,loai:$("#sc-l").value,phiSan:0,phiTT:0,phiDV:0,affiliate:0,vc:0,note:"",active:true}));renderMain()};
}
/* ---------- Thiết lập: danh mục chi phí ---------- */
function pChiPhiDM(m){
  const d=D(),ed=can(ME,"thietlap.quanly"),pbOpts=d.departments.map(p=>[p.k,p.n]);
  m.innerHTML=H("Danh mục chi phí",`${d.costCats.length} khoản`)+`<section class="card flush"><div class="tbl edit"><table><thead><tr><th>Mã</th><th>Khoản chi</th><th>Nhóm P&L</th><th>Loại</th><th>Phân bổ theo</th><th>Phòng ban chịu</th><th>Ghi chú</th></tr></thead><tbody>
  ${d.costCats.map((c,i)=>`<tr><td class="mono">${c.k}</td><td>${ed?`<input data-cc="${i}" data-f="n" value="${esc(c.n)}">`:`<b>${esc(c.n)}</b>`}</td><td>${ed?`<select data-cc="${i}" data-f="nhom">${opt(COST_GROUPS,c.nhom)}</select>`:c.nhom}</td><td>${ed?`<select data-cc="${i}" data-f="loai">${opt(["Cố định","Biến đổi"],c.loai)}</select>`:c.loai}</td><td>${ed?`<select data-cc="${i}" data-f="phanBo">${opt(["Toàn công ty","Phòng ban","Kênh","Sản phẩm"],c.phanBo)}</select>`:c.phanBo}</td><td>${ed?`<select data-cc="${i}" data-f="pb">${opt(pbOpts,c.pb)}</select>`:esc((d.departments.find(p=>p.k===c.pb)||{}).n||"")}</td><td>${ed?`<input data-cc="${i}" data-f="note" value="${esc(c.note)}">`:esc(c.note)}</td></tr>`).join("")}</tbody></table></div></section>
  ${ed?`<section class="card"><form class="frm row7" id="ccf"><label class="field">Mã<input id="cc-k" required maxlength="8"></label><label class="field">Khoản chi<input id="cc-n" required></label><label class="field">Nhóm P&L<select id="cc-g">${opt(COST_GROUPS,"Vận hành")}</select></label><label class="field">Loại<select id="cc-l">${opt(["Cố định","Biến đổi"],"Cố định")}</select></label><button class="btn pri">Thêm khoản chi</button></form></section>`:""}`;
  m.querySelectorAll("[data-cc]").forEach(x=>x.onchange=()=>{DB.mutate(ME.name,"sửa danh mục chi phí",dt=>dt.costCats[+x.dataset.cc][x.dataset.f]=x.value);toast("Đã lưu")});
  if($("#ccf"))$("#ccf").onsubmit=e=>{e.preventDefault();const k=$("#cc-k").value.trim().toUpperCase();if(d.costCats.some(c=>c.k===k)){toast("Mã đã có");return}DB.mutate(ME.name,"thêm khoản chi",dt=>dt.costCats.push({k,n:$("#cc-n").value,nhom:$("#cc-g").value,loai:$("#cc-l").value,phanBo:"Toàn công ty",pb:"BDH",note:""}));renderMain()};
}
/* ---------- Chi phí theo tháng ---------- */
let CPM=MONTH.key;
function pChiPhi(m){
  const d=D(),ed=can(ME,"chiphi.nhap"),L=d.costs.filter(c=>c.thang===CPM),adsAuto=CPM===MONTH.key?sum(d.weekly,w=>w.ads):0;
  const cat=k=>d.costCats.find(c=>c.k===k)||{n:k,nhom:"Khác"};const byG=COST_GROUPS.map(g=>[g,sum(L.filter(c=>cat(c.cat).nhom===g),c=>c.tien)+(g==="Marketing"?adsAuto:0)]);
  const prev=(()=>{const [y,mo]=CPM.split("-").map(Number);const p=mo===1?`${y-1}-12`:`${y}-${String(mo-1).padStart(2,"0")}`;return p})();
  m.innerHTML=H("Chi phí theo tháng",`${L.length} khoản đã nhập`)+`<div class="filters"><label class="inl">Tháng <input type="month" id="cp-m" value="${CPM}"></label>${ed?`<button class="btn" id="cp-copy">Chép khoản cố định từ tháng ${prev.slice(5)}/${prev.slice(0,4)}</button>`:""}</div>
  <div class="grid kpis">${kpi("Tổng chi phí",money(sum(byG,x=>x[1])))}${byG.filter(x=>x[1]).map(([g,v])=>kpi(g,money(v))).join("")}</div>
  ${adsAuto?`<div class="note">Đã tự cộng ${money(adsAuto)} chi Ads Facebook từ báo cáo Ads vào nhóm Marketing, không cần nhập lại.</div>`:""}
  <section class="card">${tbl(["Khoản chi","Nhóm","Phòng ban","Kênh","Sản phẩm","Số tiền","Ghi chú","Người nhập",""],L.map(c=>`<tr><td><b>${esc(cat(c.cat).n)}</b></td><td>${esc(cat(c.cat).nhom)}</td><td>${esc((d.departments.find(p=>p.k===c.pb)||{}).n||"—")}</td><td>${esc(c.kenh||"—")}</td><td>${c.sku?esc(sk(c.sku).n):"—"}</td><td class="n">${nf(c.tien)}</td><td>${esc(c.note)}</td><td>${esc(c.by)}</td><td>${ed?`<button class="btn sm danger" data-cpx="${c.id}">Xóa</button>`:""}</td></tr>`))}</section>
  ${ed?`<section class="card"><div class="card-h"><h2>Nhập chi phí</h2></div><form class="frm" id="cpf"><div class="row4"><label class="field">Khoản chi<select id="cp-c">${opt(d.costCats.map(c=>[c.k,c.n+" · "+c.nhom]),"")}</select></label><label class="field">Số tiền (đ)<input id="cp-t" type="number" min="0" required></label><label class="field">Phòng ban<select id="cp-p">${opt([["","—"]].concat(d.departments.map(p=>[p.k,p.n])),"")}</select></label><label class="field">Kênh<select id="cp-k">${opt([["","—"]].concat(d.saleChannels.map(c=>[c.n,c.n])),"")}</select></label></div><div class="row4"><label class="field">Sản phẩm<select id="cp-s">${opt([["","—"]].concat((d.catalog||[]).map(c=>[c.k,c.n])),"")}</select></label><label class="field grow">Ghi chú<input id="cp-n"></label></div><button class="btn pri">Thêm</button></form>
   <h3>Hoặc kéo file Excel</h3><p class="hint">Cột: Tháng (yyyy-mm) · Mã khoản chi · Phòng ban · Kênh · Sản phẩm · Số tiền · Ghi chú. Sau này nối thẳng file xuất MISA.</p>${dropZone("cp")}</section>`:""}`;
  $("#cp-m").onchange=e=>{CPM=e.target.value||MONTH.key;renderMain()};
  m.querySelectorAll("[data-cpx]").forEach(b=>b.onclick=()=>{DB.mutate(ME.name,"xóa khoản chi",dt=>dt.costs=dt.costs.filter(c=>c.id!==b.dataset.cpx));renderMain()});
  if($("#cp-copy"))$("#cp-copy").onclick=()=>{const src=d.costs.filter(c=>c.thang===prev&&cat(c.cat).loai==="Cố định");if(!src.length){toast("Tháng trước chưa có khoản cố định nào");return}DB.mutate(ME.name,"chép chi phí cố định",dt=>src.forEach(c=>dt.costs.push({...c,id:uid("cp"),thang:CPM,by:ME.name})));toast(`Đã chép ${src.length} khoản`);renderMain()};
  if($("#cpf"))$("#cpf").onsubmit=e=>{e.preventDefault();DB.mutate(ME.name,"nhập chi phí",dt=>dt.costs.push({id:uid("cp"),thang:CPM,cat:$("#cp-c").value,tien:+$("#cp-t").value||0,pb:$("#cp-p").value,kenh:$("#cp-k").value,sku:$("#cp-s").value,note:$("#cp-n").value,by:ME.name}));toast("Đã thêm");renderMain()};
  if($("#dz-cp"))bindDrop("cp",async f=>{const rows=await readXlsx(f);let n=0;DB.mutate(ME.name,"nhập chi phí từ file "+f.name,dt=>{rows.slice(1).forEach(r=>{if(!r||!r[1]||!numVN(r[5]))return;dt.costs.push({id:uid("cp"),thang:String(r[0]||CPM).slice(0,7),cat:String(r[1]).trim().toUpperCase(),pb:String(r[2]||""),kenh:String(r[3]||""),sku:String(r[4]||""),tien:numVN(r[5]),note:String(r[6]||""),by:ME.name});n++})});toast("Đã nhập "+n+" khoản");renderMain()});
}
