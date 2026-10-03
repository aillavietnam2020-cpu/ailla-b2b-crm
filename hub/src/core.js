/* =====================================================================
   AILLA MKT HUB v2 — LÕI DÙNG CHUNG (admin.html + user.html)
   Bám cấu trúc file "HỆ THỐNG QUẢN TRỊ CONTENT AILLA - THEO KÊNH":
   PILLAR_THANG · TUYEN_THANG · TIKTOK · TIKTOK_VIA 1/2 · FANPAGE_CHINH · LICH_NOI_DUNG_CHUNG
   KHO_RESEARCH · INSIGHT_CO_HOI · VIDEO_WIN · DATA_HOOK_WINNER · KE_HOACH_NHAN_BAN
   ORDER_DIGITAL · KHO_VIDEO_CU · Data TikTok · QUY_CHUAN_THIET_LAP · DASHBOARD
   Dữ liệu: đối tượng DB (localStorage) + FILES (IndexedDB cho file đính kèm).
   Bản thật: thay DB/FILES bằng API + R2 (xem file đặc tả).
   ===================================================================== */
const APP_VERSION="2.3.1";
const STORE_KEY="ailla_mkt_hub_v2";
const MONTH={key:"2026-10",mon:10,year:2026,ndays:31,first:3}; // 1/10/2026 là Thứ 5 (0 = Thứ 2)
const DEMO_PASSWORD="ailla2026";

/* ---------- Danh mục ---------- */
const PRODUCTS0=[
 {k:"BT",n:"Bột Tẩy Vạn Năng",c:"#16804f",gia:69000,huong:"Đẩy mạnh",kenh:"TikTok chính",mo:"Bột tẩy vạn năng Ailla Nature: oxy hoạt tính + enzyme, tẩy ố, mốc quần áo trắng và màu, cam kết 3 KHÔNG (không hóa chất độc hại, không hại da tay, không bay màu). Quy cách 250g và 450g",pain:"áo trắng ố vàng, quần áo mốc khi trời nồm ẩm",claim:"Quy cách đúng 250g và 450g. Không nói tẩy mọi loại vết bẩn/vật liệu"},
 {k:"TD",n:"Tinh dầu giặt sấy",c:"#175cd3",gia:51000,huong:"Đẩy mạnh",kenh:"TikTok chính",mo:"Tinh dầu giặt sấy Ailla, 5 mùi hương, nhỏ vào nước xả hoặc dùng khi sấy",pain:"quần áo phơi lâu khô bị ám mùi, mùi thơm không giữ được lâu",claim:"Biên pha đã xác nhận 1,5–4L/chai. Không nhỏ vào bàn là hơi nước"},
 {k:"XM",n:"Xịt muỗi AiBio",c:"#e7357b",gia:49000,huong:"Giữ",kenh:"TikTok chính",mo:"Xịt muỗi sinh học AiBio, thành phần thảo mộc (quế, sả chanh, bạch đàn, long não), an toàn cho người lớn, trẻ nhỏ, vật nuôi, một lần xịt hiệu quả 7 ngày",pain:"muỗi nhiều cuối mùa mưa, sợ xịt hóa chất khi nhà có trẻ nhỏ",claim:"Không dùng cảnh chai xanh xịt ruồi cho video xịt muỗi"},
 {k:"XR",n:"Xịt ruồi AiBio",c:"#16a34a",gia:49000,huong:"Giữ",kenh:"TikTok chính",mo:"Xịt ruồi sinh học AiBio, cùng công thức xịt muỗi, diệt và xua đuổi ruồi, muỗi, kiến, gián; an toàn cho người và vật nuôi",pain:"ruồi nhặng trong bếp, quán ăn; sợ hóa chất độc",claim:"Không nói diệt 100%"},
 {k:"LSCD",n:"Lau sàn chuyên dụng",c:"#0891b2",gia:209000,huong:"Đẩy nhẹ",kenh:"TikTok chính",mo:"Nước lau sàn chuyên dụng Ailla can 5kg, hương hoa hồng / sả chanh, diệt khuẩn, không cần lau lại",pain:"sàn nhà nhiều người qua lại nhanh bẩn, mùi hôi; nhà hàng, cửa hàng",claim:""},
 {k:"SAP",n:"Sáp thơm phòng",c:"#6b4fd1",gia:45000,huong:"Đẩy nhẹ",kenh:"TikTok chính",mo:"Sáp thơm phòng Ailla 160g, lưu hương 1,5–2 tháng, 3 mùi Đào, Dứa, Nhài",pain:"phòng, tủ quần áo ẩm mùi; sáp rẻ bay mùi sau 2 tuần",claim:""},
 {k:"TL",n:"Tẩy lồng AiBio",c:"#b54708",gia:39000,huong:"Đẩy nhẹ",kenh:"TikTok Via 1",mo:"Tẩy lồng máy giặt AiBio, không acid, không ăn mòn lồng, oxy phân tử diệt khuẩn khử mùi",pain:"máy giặt có mùi hôi, cặn bẩn bám ngược ra quần áo",claim:""},
 {k:"NG",n:"Nước giặt AiBio",c:"#0e7c86",gia:89000,huong:"Đẩy nhẹ",kenh:"TikTok Via 1",mo:"[mô tả nước giặt AiBio — bổ sung ở Cài đặt]",pain:"[vấn đề chính của khách — bổ sung]",claim:""},
 {k:"AR",n:"Arila",c:"#c2410c",gia:79000,huong:"Đẩy nhẹ",kenh:"TikTok Via 2",mo:"[mô tả sản phẩm Arila — bổ sung ở Cài đặt]",pain:"[vấn đề chính của khách — bổ sung]",claim:""},
];
/* Danh mục sản phẩm đầy đủ (trang Danh mục sản phẩm); kế hoạch tháng chọn một phần trong đây */
const CATALOG_EXTRA=[
 {k:"NGX",n:"Nước giặt xả kháng khuẩn Ailla",nhom:"Giặt — xả",c:"#db2777",gia:0,mo:"Nguyên liệu Đức, gốc thực vật, lưu hương 3 tầng, pH trung tính an toàn cho trẻ sơ sinh, kháng khuẩn Nano bạc",pain:"quần áo nhanh mất mùi, lo hóa chất với da bé",claim:""},
 {k:"LS",n:"Lau sàn Ailla",nhom:"Vệ sinh nhà cửa",c:"#0891b2",gia:0,mo:"3 mùi Ly, Quế, Sả Chanh; 1kg / 2kg / 3,6kg; diệt khuẩn, không cần lau lại bằng nước",pain:"sàn nhanh bẩn, mùi hắc",claim:""},
 {k:"LSBV",n:"Nước lau sàn bệnh viện",nhom:"Vệ sinh nhà cửa",c:"#0e7490",gia:0,mo:"Mùi Hoa Hồng / Chanh Sả",pain:"",claim:""},
 {k:"TTL",n:"Tẩy toilet Ailla",nhom:"Vệ sinh nhà cửa",c:"#4f46e5",gia:0,mo:"Không gây bỏng da, sát khuẩn 99,9%, đa năng toilet, nhà tắm, sàn, 1L đậm đặc",pain:"toilet ố vàng, mùi hôi",claim:""},
 {k:"CTB",n:"Cốc thả bồn cầu Ailla",nhom:"Vệ sinh nhà cửa",c:"#7c3aed",gia:0,mo:"Đậm đặc gấp 5 lần, hiệu quả tới 2.130 lần xả, hương Sả Chanh",pain:"",claim:""},
 {k:"XCL",n:"Tẩy đa năng XClean",nhom:"Vệ sinh nhà cửa",c:"#65a30d",gia:0,mo:"Hữu cơ an toàn, làm sạch dầu mỡ, cặn canxi trên bếp, kính, xoong nồi",pain:"",claim:""},
 {k:"XK",n:"Xịt kính Ailla",nhom:"Vệ sinh nhà cửa",c:"#0284c7",gia:0,mo:"Không để lại vệt, hạn chế bám bụi, khử mùi",pain:"",claim:""},
 {k:"BIO",n:"Siêu tẩy dầu mỡ Bio Clean 500ml",nhom:"Vệ sinh nhà cửa",c:"#ca8a04",gia:0,mo:"Gốc thực vật, không mùi, không khí độc, không ăn mòn thiết bị",pain:"",claim:""},
 {k:"TTC",n:"Bột thông tắc cống Ailla",nhom:"Vệ sinh nhà cửa",c:"#57534e",gia:0,mo:"Công nghệ thủy phân Đức, dạng bột, dùng nhiều vị trí",pain:"",claim:""},
 {k:"TMG",n:"Tẩy mốc gioăng cao su",nhom:"Vệ sinh nhà cửa",c:"#475569",gia:0,mo:"Cho silicon, nhựa, cao su (viền kính, tủ lạnh, máy giặt), hiệu quả sau 15–30 phút",pain:"",claim:""},
 {k:"XR",n:"Xịt ruồi AiBio",nhom:"Kiểm soát côn trùng — AiBio",c:"#16a34a",gia:0,mo:"Cùng công thức xịt muỗi, diệt và xua ruồi, muỗi, kiến, gián",pain:"",claim:"Chai xanh xịt ruồi không dùng cho video xịt muỗi"},
 {k:"SER",n:"Serum khử mùi Secret",nhom:"Chăm sóc cá nhân",c:"#be185d",gia:0,mo:"Trầu Không, Cúc La Mã, Yến Mạch; khử mùi tới 72h",pain:"",claim:""},
 {k:"BM",n:"Body Mist Ailla",nhom:"Chăm sóc cá nhân",c:"#c026d3",gia:0,mo:"Lưu hương 16–24h, nha đam + vitamin E",pain:"",claim:""},
 {k:"NRC",n:"Nước rửa chén Ailla",nhom:"Bếp",c:"#ea580c",gia:0,mo:"Tinh dầu tự nhiên, gốc thực vật, không khô da, pH trung tính",pain:"",claim:""},
];
const NHOM_OF={BT:"Giặt — xả",TD:"Giặt — xả",TL:"Giặt — xả",NG:"Giặt — xả",AR:"Khác",XM:"Kiểm soát côn trùng — AiBio",SAP:"Chăm sóc không gian"};
const NHOMS=["Giặt — xả","Vệ sinh nhà cửa","Kiểm soát côn trùng — AiBio","Chăm sóc không gian","Chăm sóc cá nhân","Bếp","Khác"];
function catalog0(){const pk=PRODUCTS0.map(p=>p.k);return PRODUCTS0.map(p=>({k:p.k,n:p.n,nhom:NHOM_OF[p.k]||"Khác",c:p.c,gia:p.gia,mo:p.mo,pain:p.pain,claim:p.claim,kenh:p.kenh,active:true})).concat(CATALOG_EXTRA.filter(p=>!pk.includes(p.k)).map(p=>({...p,kenh:"TikTok chính",active:true})))}
const OTHER_PRODUCTS=[{k:"LS",n:"Lau sàn",c:"#7a8399"},{k:"XR",n:"Xịt ruồi AiBio",c:"#7a8399"},{k:"KHAC",n:"Khác",c:"#7a8399"}];
const CHANNELS=[
 {k:"TikTok chính",short:"TT chính",needId:true,acc:"aillavietnamstore",tab:"TIKTOK"},
 {k:"TikTok Via 1",short:"Via 1",needId:true,acc:"(Via 1 — 2 video/ngày: edit footage có sẵn + đăng lại video kho)",tab:"TIKTOK_VIA 1"},
 {k:"TikTok Via 2",short:"Via 2",needId:true,acc:"(Via phụ — reup 1 video/ngày)",tab:"TIKTOK_VIA 2"},
 {k:"Fanpage chính",short:"Fanpage",needId:false,acc:"Fanpage Ailla",tab:"FANPAGE_CHINH"},
];
const chOf=k=>CHANNELS.find(c=>c.k===k)||CHANNELS[0];
const LISTS={
  duyet:["Chưa duyệt","Cần sửa","Đã duyệt"],ceo:["CẦN KIỂM TRA","PASS","KHÔNG DÙNG"],dang:["Chưa đăng","Đã lên lịch","Đã đăng"],
  nguon:["Quay mới","Footage cũ","Nhân bản winner","Order Digital","Đăng lại"],fbFormat:["Bài ảnh","Carousel","Video/Reel"],uutien:["Cao","Trung bình","Thấp"],
  tuyen:["Pain/Insight","How-to","Trước/sau","Demo/Proof","Review/Proof","Chọn mùi/Lifestyle","Sale/20.10","Nhân bản winner","Đăng lại video kho","Đổi hook video tồn","Thương hiệu"],
  dangVideo:["One shot","Giọng đọc (Adam/AI)","Chèn chữ","Ảnh cuộn","Bài ảnh","Carousel","Video/Reel"],
  nhanh:{nc:"Nhu cầu tìm kiếm",kh:"Tiếng nói khách hàng",dt:"Nội dung đối thủ",ads:"Quảng cáo & Offer",nb:"Dữ liệu nội bộ"},
  tinCay:["Cao","Trung bình","Thấp"],rsStatus:["Mới","Chờ kiểm tra","Đã kiểm","Đã duyệt","Loại"],quyetDinh:["Làm ngay","Test","Để sau","Bỏ"],
};
/* ---------- Trạng thái thẻ (luồng) ---------- */
const STEPS=[
 {id:"cg",t:"Chưa giao",who:"Oanh giao"},
 {id:"kb",t:"Viết kịch bản",who:"Người được giao"},
 {id:"dkb",t:"Oanh duyệt kịch bản",who:"Oanh"},
 {id:"quay",t:"Chờ quay",who:"Theo buổi quay tuần"},
 {id:"edit",t:"Đang edit",who:"Người edit · dán link"},
 {id:"worker",t:"Worker đang dựng",who:"Máy tự làm",auto:true},
 {id:"dvd",t:"Oanh duyệt video",who:"Oanh"},
 {id:"dceo",t:"Chị duyệt video",who:"Chị Hoa"},
 {id:"dang",t:"Chờ đăng",who:"Người giữ kênh · dán ID / link"},
 {id:"xong",t:"Đã đăng",who:"Số về theo báo cáo tuần"},
];
/* Loại video: quay mới (đủ bước) · reup có sửa (edit → duyệt) · lấy từ kho đăng lại (đăng thẳng) · nhân bản win */
const LOAI_V={moi:"Quay mới",reup:"Reup có sửa",kho:"Video có sẵn trong kho",nhanban:"Nhân bản win"};
function loaiOf(c){if(c.loai)return c.loai;if(c.nguon==="Nhân bản winner")return "nhanban";if(c.nguon==="Đăng lại")return "kho";if(c.nguon==="Footage cũ")return c.khoMa&&!/hook/i.test(c.tuyen||"")&&c.step==="dang"?"kho":"reup";return "moi"}
/* Người giữ kênh (đăng bài): Phụ trách chính của kênh ở Kế hoạch tháng */
const chanOwner=k=>((D().kenhPT||{})[k]||{}).chinh||"";
const stepName=id=>(STEPS.find(s=>s.id===id)||{t:id}).t;
const stepIdx=id=>STEPS.findIndex(s=>s.id===id);
/* Cột trạng thái kiểu sheet (suy ra từ bước) */
const sheetDuyet=c=>stepIdx(c.step)>=stepIdx("dang")?"Đã duyệt":(c.gopy||[]).length?"Cần sửa":"Chưa duyệt";
const sheetDang=c=>c.step==="xong"?"Đã đăng":c.step==="dang"?"Đã lên lịch":"Chưa đăng";

/* ---------- Phân quyền ---------- */
const PERMS=[
 ["Theo dõi",[["tongquan.xem","Xem Hiệu quả tháng (toàn team)"],["cv.xem","Xem CV cần xử lý"],["ketqua.xem_tat_ca","Xem doanh thu của mọi người"]]],
 ["Kế hoạch",[["kehoach.xem","Xem kế hoạch tháng"],["kehoach.sua","Sửa kế hoạch, pillar, tuyến, phát hành"],["kehoach.duyet","Duyệt mục tiêu, chiến lược"]]],
 ["Research",[["research.xem","Xem kho research"],["research.sua","Thêm bản ghi, insight"],["research.duyet","Kiểm / duyệt research, insight"]]],
 ["Nội dung",[["lich.xem","Xem lịch content mọi kênh"],["lich.sua_cua_minh","Cập nhật thẻ được giao cho mình"],["lich.sua_tat_ca","Sửa mọi thẻ, thêm / xóa thẻ"],["viec.giao","Giao việc"],["viec.duyet","Duyệt kịch bản, duyệt video, CEO check"]]],
 ["Video win",[["win.xem","Xem video win"],["win.sua","Lập kế hoạch nhân bản, ghi kết luận"]]],
 ["Order Digital",[["order.xem","Xem order"],["order.tao","Gửi order"],["order.sua","Sửa order, nhập số Ads của order"]]],
 ["Kho video cũ",[["kho.xem","Xem kho video cũ"],["kho.gan","Gán video cũ sang kênh"]]],
 ["Báo cáo",[["baocao.tiktok","Nhập báo cáo TikTok"],["baocao.ads","Nhập báo cáo Ads Facebook"]]],
 ["Nhân sự & lương",[["nhansu.duyet","Duyệt nghỉ phép, OT, tạm ứng, KPI"],["luong.quanly","Xem và làm bảng lương, phiếu lương"]]],
 ["Thiết lập & Tài chính",[["thietlap.quanly","Sửa dữ liệu gốc: phòng ban, kênh bán, danh mục chi phí, SKU"],["gia.xem_von","Xem giá vốn SKU"],["chiphi.xem","Xem chi phí theo tháng"],["chiphi.nhap","Nhập chi phí"],["pl.xem","Xem báo cáo P&L"]]],
 ["Sản xuất",[["sx.dieuphoi","Tạo nhu cầu sản xuất, đề nghị mua hàng (điều phối)"],["sx.xuong","Bắt đầu việc, báo hoàn thành (tổ trưởng xưởng)"],["sx.kiemke","Kiểm kê, tạo lô, in tem, nhập kho (kế toán kho)"],["sx.kythuat","Báo nguyên vật liệu thực tế (kỹ thuật)"]]],
 ["Hệ thống",[["sanpham.quanly","Quản lý danh mục sản phẩm"],["nhansu.quanly","Quản lý nhân sự, mật khẩu, phân quyền"],["quychuan.sua","Sửa quy chuẩn"],["caidat.quanly","Cài đặt, sao lưu, xóa dữ liệu"]]],
];
const ALL_PERMS=PERMS.flatMap(g=>g[1].map(p=>p[0]));
const ROLE_PRESET={
 admin:ALL_PERMS,
 lead:ALL_PERMS.filter(p=>!["nhansu.quanly","caidat.quanly","kehoach.duyet","sanpham.quanly","thietlap.quanly","gia.xem_von","chiphi.xem","chiphi.nhap","pl.xem","luong.quanly"].includes(p)),
 content:["cv.xem","kehoach.xem","research.xem","research.sua","lich.xem","lich.sua_cua_minh","win.xem","order.xem","kho.xem"],
 digital:["cv.xem","research.xem","lich.xem","win.xem","order.xem","order.tao","order.sua","baocao.ads"],
 // Phòng ban khác (Sale, Sản xuất, Kế toán, HCNS...): thấy phân hệ của phòng mình + giao việc.
 truongphong:["cv.xem","viec.giao","viec.duyet","tongquan.xem","sx.xuong"],
 nhanvien:["cv.xem"],
};
const ROLES={admin:"Quản trị (CEO)",lead:"Trưởng nhóm",content:"Nhân viên content",digital:"Team Digital",truongphong:"Trưởng phòng",nhanvien:"Nhân viên"};

/* ---------- Tiện ích ---------- */
let _rs=20261015;const rnd=()=>{_rs|=0;_rs=_rs+0x6D2B79F5|0;let t=Math.imul(_rs^_rs>>>15,1|_rs);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const pick=a=>a[Math.floor(rnd()*a.length)];
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const money=n=>!n?"0":Math.abs(n)>=1e9?(n/1e9).toLocaleString("vi-VN",{maximumFractionDigits:2})+" tỷ":Math.abs(n)>=1e6?(n/1e6).toLocaleString("vi-VN",{maximumFractionDigits:1})+"tr":Math.abs(n)>=1e3?Math.round(n/1e3)+"k":String(Math.round(n));
const nf=n=>Math.round(n||0).toLocaleString("vi-VN");
const pct=(a,b)=>b?Math.round(a/b*100):0;
const sum=(a,f)=>a.reduce((x,c)=>x+(+f(c)||0),0);
const dow=d=>(d-1+MONTH.first)%7;
const dd=d=>d?(d<10?"0":"")+d+"/"+String(MONTH.mon).padStart(2,"0"):"—";
const weekOf=d=>!d?0:d<=4?1:d<=11?2:d<=18?3:d<=25?4:5;
const WEEKS=[{w:1,tu:1,den:4},{w:2,tu:5,den:11},{w:3,tu:12,den:18},{w:4,tu:19,den:25},{w:5,tu:26,den:31}];
const nowHM=()=>new Date().toTimeString().slice(0,5);
const today=()=>new Date().toLocaleDateString("vi-VN");
const uid=p=>p+Date.now().toString(36).slice(-5)+Math.floor(Math.random()*1e3).toString(36);
function toast(m){const t=$("#toast");if(!t)return;t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,2800)}
function guessSku(t){t=(t||"").toLowerCase();if(t.includes("vạn năng")||t.includes("bột tẩy")||/\bbtvn\b|\bbot\b/.test(t))return "BT";if(t.includes("tinh dầu")||/tinhdau|\btdn\b/.test(t))return "TD";if(t.includes("ruồi")||/\bruoi\b/.test(t))return "XR";if(t.includes("muỗi")||/\bmuoi\b|\bxm\b/.test(t))return "XM";if(t.includes("sáp")||/\bsap\b/.test(t))return "SAP";if(t.includes("arila"))return "AR";if(t.includes("lồng")||/tlai|\btlg\b/.test(t))return "TL";if(t.includes("nước giặt")||/nuocgiat/.test(t))return "NG";if(t.includes("lau sàn"))return "LS";return null}

/* ---------- Mật khẩu (băm SHA-256, có dự phòng) ---------- */
async function hashPw(username,pw){const s="ailla-mkt|"+username.toLowerCase()+"|"+pw;try{if(crypto&&crypto.subtle){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}}catch(e){}let h=2166136261;for(const ch of s){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return "f"+(h>>>0).toString(16)}

/* ---------- Kho dữ liệu ---------- */
const DB={
  data:null,
  async load(){try{const s=localStorage.getItem(STORE_KEY);if(s){const d=JSON.parse(s);if(d&&d.version==="2.3.0"){(d.products||[]).forEach(p=>{if(p.k==="TD"&&p.huong==="Giữ")p.huong="Đẩy mạnh";if(p.k==="SAP"&&p.huong==="Giữ nhẹ")p.huong="Đẩy nhẹ"});d.version=APP_VERSION;this.data=ensureShape(d);this.save();return}if(d&&d.version==="2.1.0"){d.catalog=catalog0();d.products.forEach(p=>{const c=d.catalog.find(x=>x.k===p.k);if(c)Object.assign(c,{n:p.n,gia:p.gia,mo:p.mo,pain:p.pain,claim:p.claim})});d.version=APP_VERSION;this.data=ensureShape(d);this.save();return}if(d&&d.version===APP_VERSION){this.data=ensureShape(d);this.save();return}}}catch(e){}this.data=ensureShape(seedData());for(const u of this.data.users)u.pw=await hashPw(u.username,DEMO_PASSWORD);this.save()},
  save(){this.data.updatedAt=Date.now();try{localStorage.setItem(STORE_KEY,JSON.stringify(this.data))}catch(e){toast("Không lưu được trên trình duyệt này")}},
  mutate(who,msg,fn){fn(this.data);this.data.activity.unshift({t:nowHM(),d:today(),who,msg});this.data.activity=this.data.activity.slice(0,400);this.save()},
  async reset(){try{localStorage.removeItem(STORE_KEY)}catch(e){}this.data=null;await this.load()},
};
const D=()=>DB.data;
function syncToday(){const d=DB.data;if(d&&d.mode==="live")d.settings.today=realDay()}
const prods=()=>DB.data?D().products:PRODUCTS0;
const sk=k=>prods().concat(DB.data&&D().catalog?D().catalog:[],OTHER_PRODUCTS).find(s=>s.k===k)||OTHER_PRODUCTS[2];
const userBy=id=>D().users.find(u=>u.id===id);
const userName=id=>(userBy(id)||{name:""}).name;
const workers=()=>D().users.filter(u=>u.active&&(u.role==="content"||u.role==="lead"));
const can=(u,p)=>!!u&&(u.perms||[]).includes(p);
const isLate=c=>!["xong","cg"].includes(c.step)&&c.day&&c.day<D().settings.today;

/* ---------- File đính kèm (IndexedDB) ---------- */
const FILES={
  _db:null,
  open(){return new Promise((res,rej)=>{if(this._db)return res(this._db);try{const r=indexedDB.open("ailla_mkt_files",1);r.onupgradeneeded=()=>r.result.createObjectStore("f");r.onsuccess=()=>{this._db=r.result;res(this._db)};r.onerror=()=>rej(r.error)}catch(e){rej(e)}})},
  async put(file){const db=await this.open();const id=uid("f");await new Promise((res,rej)=>{const tx=db.transaction("f","readwrite");tx.objectStore("f").put(file,id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});return id},
  async get(id){const db=await this.open();return new Promise((res,rej)=>{const r=db.transaction("f").objectStore("f").get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})},
  async del(id){const db=await this.open();return new Promise(res=>{const tx=db.transaction("f","readwrite");tx.objectStore("f").delete(id);tx.oncomplete=res})},
};
const MAX_FILE=10*1024*1024;

/* ---------- Luồng thẻ ---------- */
function nextAct(c){
  const fb=!chOf(c.kenh).needId,L=loaiOf(c);
  return ({kb:L==="moi"?["Gửi Oanh duyệt kịch bản","dkb"]:["Bắt đầu edit","edit"],dkb:["Duyệt kịch bản","quay"],quay:["Đã quay, chuyển sang edit","edit"],edit:["Edit xong, gửi Oanh duyệt","dvd"],worker:["Dựng xong, gửi Oanh duyệt","dvd"],dvd:["Oanh duyệt, gửi chị","dceo"],dceo:["Chị duyệt, cho đăng","dang"],dang:fb?["Đã đăng, lưu link bài","xong"]:["Đã đăng, lưu ID","xong"]})[c.step]||null;
}
function canEditCard(u,c){if(!u)return false;if(can(u,"lich.sua_tat_ca"))return true;return can(u,"lich.sua_cua_minh")&&c.nguoi===u.id}
function canMove(u,c,to){
  if(c.step==="cg")return can(u,"viec.giao");
  if(["dkb","dvd"].includes(c.step))return can(u,"viec.duyet");
  if(c.step==="dceo")return u.role==="admin";
  if(c.step==="dang"&&chanOwner(c.kenh)===u.id)return true;
  if(c.step==="quay"&&can(u,"viec.giao"))return true;
  return canEditCard(u,c);
}
function checkMove(c,to,inp){
  const v=k=>(inp[k]!==undefined?inp[k]:c[k])||"";
  if(c.step==="cg"&&!c.nguoi)return "Thẻ chưa giao người làm.";
  if(to==="dkb"&&!String(v("hookText")).trim()&&!String(v("noiDung")).trim())return "Viết ít nhất Hook text hoặc Nội dung chi tiết trước khi gửi duyệt.";
  if(to==="dvd"&&!String(v("linkFinal")).trim()&&!String(v("linkVideo")).trim())return "Dán link video đã edit (Google Drive) trước khi gửi duyệt.";
  if(to==="xong"&&chOf(c.kenh).needId){const id=String(v("tiktokId")).trim();if(!/^\d{19}$/.test(id))return "ID video TikTok phải đủ 19 chữ số (dãy số sau /video/ trong link).";if(D().cards.some(x=>x.id!==c.id&&x.tiktokId===id))return "ID này đã gắn cho thẻ khác.";}
  if(to==="xong"&&!chOf(c.kenh).needId&&!String(v("linkDang")).trim())return "Dán Link bài đã đăng.";
  return "";
}
function moveCard(u,id,to,inp={}){
  const c=D().cards.find(x=>x.id===id);if(!c)return "Không tìm thấy thẻ.";
  if(!canMove(u,c,to))return "Bạn không có quyền chuyển thẻ này.";
  const err=checkMove(c,to,inp);if(err)return err;
  DB.mutate(u.name,`chuyển ${c.id} sang "${stepName(to)}"`,d=>{const x=d.cards.find(y=>y.id===id);Object.entries(inp).forEach(([k,v])=>{if(v!==undefined)x[k]=v});x.step=to;if(to==="kb"||to==="dkb")x.nguoiKB=x.nguoiKB||x.nguoi;if(to==="edit"&&x.nguoiEdit)x.nguoi=x.nguoiEdit;if(to==="edit")x.nguoiEdit=x.nguoi;if(to==="dang"){x.ceo="PASS";const o=((d.kenhPT||{})[x.kenh]||{}).chinh;if(o)x.nguoi=o}if(to==="xong"&&!x.ngayDang)x.ngayDang=d.settings.today;if(to==="xong"&&x.tiktokId&&!x.linkDang&&!chOf(x.kenh).acc.startsWith("("))x.linkDang="https://www.tiktok.com/@"+chOf(x.kenh).acc+"/video/"+x.tiktokId;x.history=(x.history||[]).concat({t:new Date().toLocaleString("vi-VN"),who:u.name,to})});
  if(to==="worker")simulateWorker(id);
  return "";
}
/* Đăng 1 video lên nhiều kênh: tạo thẻ con ở kênh mới, đi thẳng bước Chờ đăng (video đã duyệt) */
function repostCard(u,id,kenh,day,nguoi){
  const c=D().cards.find(x=>x.id===id);if(!c)return "Không tìm thấy thẻ.";
  if(stepIdx(c.step)<stepIdx("dang"))return "Video phải được duyệt xong mới đăng thêm kênh.";
  const root=c.repostOf||c.id;if(D().cards.some(x=>(x.id===root||x.repostOf===root)&&x.kenh===kenh))return "Video này đã có ở kênh "+kenh+".";
  let nid;DB.mutate(u.name,`đăng thêm ${id} sang ${kenh}`,d=>{const src=d.cards.find(x=>x.id===id);const fb=!chOf(kenh).needId;
    const n=newCard(d,{sku:src.sku,kenh,day:day||d.settings.today,nguon:"Đăng lại",repostOf:src.repostOf||src.id,ct:src.ct,tuyen:src.tuyen,mucTieu:src.mucTieu,dangVideo:fb?"Video/Reel":src.dangVideo,yTuong:src.yTuong,hookText:src.hookText,noiDung:src.noiDung,caption:src.caption,linkVideo:src.linkFinal||src.linkVideo,linkFinal:src.linkFinal,ceo:"PASS",nguoi:nguoi||src.nguoi,goiy:nguoi||src.nguoi,step:"dang"});
    d.cards.push(n);nid=n.id});
  return nid;
}
/* Sản phẩm của kế hoạch tháng (chọn từ danh mục). Một sản phẩm đẩy được nhiều kênh: p.kenhs=[{kenh,huong,gmv}], p.kenh/p.huong = kênh đầu tiên */
const pKenhs=p=>p.kenhs&&p.kenhs.length?p.kenhs:[{kenh:p.kenh||"TikTok chính",huong:p.huong||"Test",gmv:0}];
function addPlanProduct(u,k,huong,kenh,gmvTr){const c=D().catalog.find(x=>x.k===k);if(!c)return "Không có sản phẩm này trong danh mục.";
  const ex=D().products.find(p=>p.k===k);if(ex){if(pKenhs(ex).some(x=>x.kenh===kenh))return c.n+" đã có ở kênh "+chOf(kenh).short+".";
    DB.mutate(u.name,`thêm ${c.n} vào kênh ${kenh}`,d=>{const p=d.products.find(x=>x.k===k);p.kenhs=pKenhs(p).concat({kenh,huong,gmv:(+gmvTr||0)*1e6});d.goals[k]=d.goals[k]||{m9:0,gmv:0};d.goals[k].gmv+=(+gmvTr||0)*1e6});return ""}
  DB.mutate(u.name,`thêm ${c.n} vào kế hoạch tháng ${MONTH.mon}`,d=>{d.products.push({k:c.k,n:c.n,c:c.c,gia:c.gia,mo:c.mo,pain:c.pain,claim:c.claim,huong,kenh,kenhs:[{kenh,huong,gmv:(+gmvTr||0)*1e6}]});d.goals[k]={m9:(typeof T9_BASE!=="undefined"&&T9_BASE[k])||0,gmv:(+gmvTr||0)*1e6}});return ""}
function removePlanChannel(u,k,kenh){const p=D().products.find(x=>x.k===k);if(!p)return "";const L=pKenhs(p);if(L.length<=1)return removePlanProduct(u,k);
  if(D().tuyen.some(t=>t.sku===k&&t.kenh===kenh))return "Sản phẩm đã có tuyến ở kênh này, xóa tuyến trước.";
  DB.mutate(u.name,`bỏ ${sk(k).n} khỏi kênh ${kenh}`,d=>{const x=d.products.find(y=>y.k===k),e=pKenhs(x).find(y=>y.kenh===kenh);x.kenhs=pKenhs(x).filter(y=>y.kenh!==kenh);x.kenh=x.kenhs[0].kenh;x.huong=x.kenhs[0].huong;if(e&&d.goals[k])d.goals[k].gmv=Math.max(0,d.goals[k].gmv-(e.gmv||0))});return ""}
function removePlanProduct(u,k){const d=D();if(d.cards.some(c=>c.sku===k&&c.nguon!=="Footage cũ")||d.tuyen.some(t=>t.sku===k))return "Sản phẩm đã có tuyến hoặc thẻ việc trong tháng, xóa tuyến/thẻ trước.";DB.mutate(u.name,`bỏ ${sk(k).n} khỏi kế hoạch tháng`,dd2=>{dd2.products=dd2.products.filter(p=>p.k!==k);delete dd2.goals[k]});return ""}
function sendBack(u,id,note){DB.mutate(u.name,`trả lại ${id}: ${note||"cần sửa"}`,d=>{const x=d.cards.find(y=>y.id===id);if(["dvd","dceo"].includes(x.step)){x.step="edit";if(x.nguoiEdit)x.nguoi=x.nguoiEdit}else{x.step="kb";if(x.nguoiKB)x.nguoi=x.nguoiKB}x.gopy=(x.gopy||[]).concat({t:new Date().toLocaleString("vi-VN"),who:u.name,note:note||"Cần sửa"})})}
function assignCard(u,id,to){DB.mutate(u.name,`giao ${id} cho ${userName(to)}`,d=>{const x=d.cards.find(y=>y.id===id);x.nguoi=to;if(x.step==="cg"){const L=loaiOf(x);x.step=L==="moi"?"kb":L==="kho"?"dang":"edit"}if(x.step==="edit")x.nguoiEdit=to})}
function simulateWorker(id){setTimeout(()=>{const c=D().cards.find(x=>x.id===id);if(!c||c.step!=="worker")return;DB.mutate("Worker",`dựng xong ${id}, chờ duyệt`,d=>{const x=d.cards.find(y=>y.id===id);x.step="dvd";x.linkFinal="drive.google.com/…/Ailla-VIDEO-FINAL/"+id+".mp4"});if(typeof render==="function")render();toast("Worker dựng xong "+id)},6000)}

/* ---------- Sinh thẻ từ TUYẾN (Phát hành) ---------- */
const HOOK={
 XR:["Quán ăn sạch ruồi chỉ sau 1 lần xịt","Bếp nhà nhiều ruồi mùa nồm, xịt chỗ nào?","Ruồi bâu đồ ăn, mẹ xử lý thế này","Xịt ruồi có an toàn cho bé không?","1 chai xịt dùng được bao lâu?"],
 LSCD:["Sàn quán đông khách vẫn sạch thơm","Lau 1 lần không cần lau lại nước","Sàn nhà có mùi hôi, đổi nước lau này","Can 5kg dùng được bao lâu?","Hương hoa hồng hay sả chanh?"],
 BT:["Áo trắng ố vàng cổ, ngâm 15 phút trước/sau","Đồ mốc vì trời nồm, cứu được không?","Khăn trắng ngả vàng: 1 thìa bột","Áo đồng phục con bị ố, mẹ làm thế này","Giày vải trắng bẩn, ngâm thử","Quần áo bé lốm đốm mốc"],
 TD:["Một mẻ đồ, mình dùng tinh dầu thế này","Phơi 2 ngày vẫn hôi? Thử 3 giọt này","Mùa nồm đồ không khô, mùi khó chịu","Chọn mùi tinh dầu theo gu","Quà 20/10: chị em nào cũng mê đồ thơm","Bí quyết tiệm giặt khiến đồ thơm cả tuần"],
 XM:["Bé ngủ không bị muỗi đốt nhờ xịt trước 10 phút","Cuối mùa mưa muỗi nhiều, xịt góc nào?","Xịt muỗi có hắc không? Thử ngửi","7 ngày muỗi vẫn ngỏm"],
 SAP:["Tủ quần áo ẩm mùi, đặt 1 hộp sáp","Sáp 2 tuần bay mùi vs sáp 2 tháng"],
 TL:["Lồng giặt 6 tháng chưa vệ sinh trông thế này","Máy giặt hôi là do đâu?","Tẩy lồng xong nước trong veo"],
 NG:["Nước giặt AiBio: giặt mẻ đồ đi mưa","Nước giặt AiBio dùng thế nào"],AR:["Arila: dùng thử lần đầu","Arila: giới thiệu nhanh"],
};
let _seq=100;
function newCard(d,o){
  const ix=_seq++;const id="TT-"+String(_seq).padStart(4,"0");
  const sku=o.sku,kenh=o.kenh;const tu=d.tuyen.find(t=>t.ma===o.maTuyen);
  const tac=(d.tactics.find(t=>t.sku.includes(sku))||{k:"DT"}).k;
  const hk=HOOK[sku]?HOOK[sku][ix%HOOK[sku].length]:"";
  return Object.assign({id,thang:MONTH.key,day:1,sku,kenh,ct:tac,maTuyen:"",tuyen:tu?tu.tuyen:"",mucTieu:tu?tu.vaiTro:"",nguon:"Quay mới",uuTien:"Trung bình",dangVideo:chOf(kenh).needId?"One shot":"Bài ảnh",
    yTuong:hk,noiDung:"",canhQuay:"",hookText:"",daoCu:"",caption:"",nguoi:"",goiy:tu?tu.nguoi:"",host:"",nguoiDung:chOf(kenh).needId?"Worker":"",ngayQuay:"",linkVideo:"",linkFinal:"",ceo:"CẦN KIỂM TRA",ngayDang:"",linkDang:"",tiktokId:"",
    briefHinh:"",linkAnh:"",ketQua:"",order:"",winSrc:"",view:0,giuChan:0,click:0,don:0,gmv:0,step:"cg",gopy:[],history:[],files:[],createdAt:Date.now()},o,{id});
}
function publishPlan(d){
  let added=0;const st0=Math.max(1,Math.min(MONTH.ndays,(d.settings&&d.settings.today)||1)); // phát hành giữa tháng: rải từ hôm nay
  d.tuyen.forEach(t=>{const have=d.cards.filter(c=>c.maTuyen===t.ma).length;
    for(let i=have;i<t.kh;i++){d.cards.push(newCard(d,{sku:t.sku,kenh:t.kenh,maTuyen:t.ma,day:Math.min(MONTH.ndays,st0+Math.floor(i*(MONTH.ndays-st0+1)/Math.max(1,t.kh))+(t.ma.length%3)),nguon:["Đổi hook video tồn","Edit footage có sẵn","Đăng lại video kho","Reup video mới"].includes(t.tuyen)?"Footage cũ":t.tuyen==="Nhân bản winner"?"Nhân bản winner":"Quay mới",dangVideo:t.dangVideo||undefined}));added++}});
  d.plan.published={at:today(),cards:d.cards.length};
  return added;
}

/* ---------- Chuyển từ số mẫu sang dữ liệu thật ---------- */
function realDay(){const t=new Date(),ym=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}`;return ym===MONTH.key?t.getDate():ym<MONTH.key?1:MONTH.ndays}
function goLive(d){
  d.mode="live";d.settings.today=realDay();d.settings.cutoff=0;
  const keep=["id","thang","day","sku","kenh","ct","maTuyen","tuyen","mucTieu","nguon","uuTien","dangVideo","goiy","yTuong","order","winPlan","khoMa","dangKenh"];
  d.cards=d.cards.filter(c=>c.nguon!=="Order Digital"&&c.nguon!=="Đăng lại").map(c=>{const o={};keep.forEach(k=>{if(c[k]!==undefined)o[k]=c[k]});o.step="cg";o.nguoi="";o.gopy=[];o.files=[];o.view=0;o.click=0;o.don=0;o.gmv=0;return Object.assign({},newCardDefaults(),o)});
  d.orders=[];d.weekly=[];d.imports=[];d.adsRows=[];d.weekNotes={};d.shoots=[];d.tasks=[];
  (d.kho||[]).forEach(k=>{k.maDang="";if(k.trangThai!=="Chưa dùng")k.trangThai="Chưa dùng"});
  d.research=(d.research||[]).filter(x=>!/Dòng ví dụ/.test(x.ghiChu||""));
  d.adjusts=[];d.ttWeeks=[];if(d.ai)d.ai={state:{},log:[],tg:d.ai.tg};d.planBase=typeof snapPlan==="function"?snapPlan(d,"Chốt khi bắt đầu tháng"):null;
  d.activity=[{t:nowHM(),d:today(),who:"Hệ thống",msg:"Bắt đầu tháng "+MONTH.mon+" với dữ liệu thật · chốt kế hoạch gốc"}];
  return d;
}
function newCardDefaults(){return {hookText:"",noiDung:"",linkVideo:"",ceo:"",ngayDang:0,tiktokId:"",caption:"",linkDang:"",linkAnh:"",giuChan:0}}
/* ---------- Báo cáo TikTok "Video Performance List" ---------- */
function numVN(v){if(v==null||v==="")return 0;const s=String(v).replace(/[₫\s%]/g,"");if(/^-?\d{1,3}(\.\d{3})+$/.test(s))return +s.replace(/\./g,"");return +s.replace(/,/g,"")||0}
function sheetRows(wb){return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:false})}
function parseTikTok(rows,name){
  const hi=rows.findIndex(r=>r&&r.some(x=>String(x).trim()==="ID video"));
  if(hi<0)return {err:`File "${name}" không có cột "ID video". Hãy tải đúng file Video Performance List từ TikTok Shop.`};
  const H=rows[hi].map(x=>String(x||"").trim());const col=(...n)=>{for(const x of n){const i=H.indexOf(x);if(i>=0)return i}return -1};
  const c={id:col("ID video"),tm:col("Thời gian"),ten:col("Thông tin video"),sp:col("Sản phẩm"),view:col("VV"),click:col("Lượt nhấp sản phẩm"),don:col("Đơn hàng SKU đã ghi nhận","Đơn hàng SKU từ video"),gmv:col("GMV đến từ video (₫)","GMV video (₫)"),xh:col("Tỷ lệ xem hết video"),acc:col("Tên nhà sáng tạo")};
  const g=(r,i)=>i>=0?r[i]:"";
  const recs=rows.slice(hi+1).filter(r=>r&&r[c.id]).map(r=>({id:String(r[c.id]).replace(/\D/g,""),tm:String(g(r,c.tm)||"").slice(0,10),ten:String(g(r,c.ten)||""),sp:String(g(r,c.sp)||""),view:numVN(g(r,c.view)),click:numVN(g(r,c.click)),don:numVN(g(r,c.don)),gmv:numVN(g(r,c.gmv)),xh:numVN(g(r,c.xh)),acc:String(g(r,c.acc)||"")}));
  const rg=(rows.slice(0,hi).flat().map(x=>String(x||"")).find(x=>x.includes("Phạm vi"))||"").replace(/[\[\]]/g,"").trim();
  const m=rg.match(/(\d{4})-(\d{2})-(\d{2})\s*~\s*(\d{4})-(\d{2})-(\d{2})/);
  return {name,range:rg,tu:m?+m[3]:0,den:m?+m[6]:0,thang:m?+m[2]:0,recs};
}
function classifyTikTok(res,cards){
  const mm="/"+String(MONTH.mon).padStart(2,"0")+"/";const out={match:[],stray:[],auto:[],old:[]};
  res.recs.forEach(r=>{const c=cards.find(x=>x.tiktokId===r.id);if(c)out.match.push([r,c]);else if(r.tm.includes(mm)&&r.tm.startsWith(String(MONTH.year)))(/[#@]/.test(r.ten)?out.stray:out.auto).push(r);else out.old.push(r)});
  const S=a=>({n:a.length,don:sum(a,x=>x.don),gmv:sum(a,x=>x.gmv)});
  out.sum={match:S(out.match.map(x=>x[0])),stray:S(out.stray),auto:S(out.auto),old:S(out.old),all:S(res.recs)};return out;
}
function applyTikTok(u,res,kenh){
  const cl=classifyTikTok(res,D().cards);const wk=weekOf(res.den||D().settings.cutoff);
  DB.mutate(u.name,`nhập báo cáo TikTok "${res.name}" (${kenh}): ${cl.match.length} video khớp`,d=>{
    cl.match.forEach(([r])=>{const c=d.cards.find(x=>x.tiktokId===r.id);Object.assign(c,{view:r.view,click:r.click,don:r.don,gmv:r.gmv,giuChan:r.xh})});
    const ow=d.weekly.find(x=>x.w===wk)||(d.weekly.push({w:wk,cu:0,tutao:0,ads:0,adsDon:0,adsGmv:0}),d.weekly[d.weekly.length-1]);ow.cu=cl.sum.old.gmv;ow.tutao=cl.sum.auto.gmv;
    cl.old.sort((a,b)=>b.gmv-a.gmv).slice(0,10).forEach(r=>{const w=d.oldWins.find(x=>x.id===r.id);if(w)Object.assign(w,{don:r.don,gmv:r.gmv,view:r.view});else d.oldWins.push({id:r.id,ten:r.ten,tm:r.tm,sku:guessSku(r.sp)||guessSku(r.ten)||"KHAC",view:r.view,don:r.don,gmv:r.gmv,kenh})});
    if(!d.ttWeeks)d.ttWeeks=[];d.ttWeeks.push({key:uid("tw"),label:res.range||res.name,tu:"",den:"",recs:res.recs.map(r=>[r.id,guessSku(r.sp)||guessSku(r.ten)||"KHAC",r.gmv,r.don,r.view,r.tm,/[#@]/.test(r.ten)?1:0,r.ten.slice(0,80),r.acc||""])});d.ttWeeks=d.ttWeeks.slice(-8);
    d.imports.unshift({id:uid("i"),loai:"TikTok",kenh,at:new Date().toLocaleString("vi-VN"),by:u.name,file:res.name,range:res.range,tuan:wk,sum:cl.sum,stray:cl.stray.slice(0,40)});
    if(res.den&&res.thang===MONTH.mon)d.settings.cutoff=Math.max(d.settings.cutoff,res.den);
  });return cl;
}
/* ---------- Báo cáo Ads Facebook (Meta Ads Manager) ----------
   Đọc linh hoạt cột tiếng Việt / tiếng Anh. Tên chiến dịch theo quy ước NGƯỜI-MÃSP-CD/MESS-…
   [AVN] = page Ailla Việt Nam; "tt ailla vietnam" = tương tác; "Sỉ" = tuyển sỉ. */
const ADS_PEOPLE={va:"Việt Anh",thao:"Thảo",duan:"Duẩn"};
function decodeCampaign(n){const s=(n||"").toLowerCase();let nguoi="";for(const[k,v]of Object.entries(ADS_PEOPLE))if(s.includes(k))nguoi=v;
  const sku=guessSku(s)||(s.includes("tt ailla")?"TT":s.includes("sỉ")||s.includes(" si ")?"SI":"");const loai=/mess/.test(s)?"Tin nhắn":/\bcd\b|chuyen doi|chuyển đổi/.test(s)?"Chuyển đổi":s.includes("tt ailla")?"Tương tác":"Khác";return {nguoi,sku,loai}}
function parseAds(rows,name){
  const hi=rows.findIndex(r=>r&&r.some(x=>/tên chiến dịch|campaign name/i.test(String(x))));
  if(hi<0)return {err:`File "${name}" không có cột "Tên chiến dịch". Xuất báo cáo từ Trình quản lý quảng cáo ở cấp Chiến dịch.`};
  const H=rows[hi].map(x=>String(x||"").trim().toLowerCase());const col=(...re)=>H.findIndex(h=>re.some(r=>r.test(h)));
  const c={ten:col(/tên chiến dịch|campaign name/),tu:col(/bắt đầu báo cáo|reporting starts/),den:col(/kết thúc báo cáo|reporting ends/),chi:col(/số tiền đã chi tiêu|amount spent/),mua:col(/^lượt mua$|^purchases$|lượt mua trên trang web|website purchases/),gt:col(/giá trị chuyển đổi mua|purchases conversion value|giá trị chuyển đổi/),mess:col(/cuộc trò chuyện|messaging conversations/),kq:col(/^kết quả$|^results$/)};
  const recs=rows.slice(hi+1).filter(r=>r&&r[c.ten]&&!/tổng|total/i.test(String(r[c.ten]))).map(r=>{const ten=String(r[c.ten]);return {ten,...decodeCampaign(ten),tu:c.tu>=0?String(r[c.tu]||""):"",den:c.den>=0?String(r[c.den]||""):"",chi:numVN(r[c.chi]),mua:c.mua>=0?numVN(r[c.mua]):0,gt:c.gt>=0?numVN(r[c.gt]):0,mess:c.mess>=0?numVN(r[c.mess]):0,kq:c.kq>=0?numVN(r[c.kq]):0}});
  const dm=(recs.find(r=>r.den)||{}).den||"";const m=dm.match(/(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const den=m?(m[3]?+m[3]:+m[4]):0;
  return {name,recs,den,range:recs.length?(recs[0].tu+" → "+recs[0].den):""};
}
function applyAds(u,res,wk){
  const S={chi:sum(res.recs,r=>r.chi),mua:sum(res.recs,r=>r.mua),gt:sum(res.recs,r=>r.gt),mess:sum(res.recs,r=>r.mess)};
  DB.mutate(u.name,`nhập báo cáo Ads Facebook "${res.name}" tuần ${wk}`,d=>{
    d.adsRows=d.adsRows.filter(r=>r.tuan!==wk).concat(res.recs.map(r=>({...r,tuan:wk})));
    const ow=d.weekly.find(x=>x.w===wk)||(d.weekly.push({w:wk,cu:0,tutao:0,ads:0,adsDon:0,adsGmv:0}),d.weekly[d.weekly.length-1]);ow.ads=S.chi;ow.adsDon=S.mua;ow.adsGmv=S.gt;
    d.imports.unshift({id:uid("i"),loai:"Ads Facebook",kenh:"Meta Ads",at:new Date().toLocaleString("vi-VN"),by:u.name,file:res.name,range:res.range,tuan:wk,sum:S});
  });return S;
}

/* ---------- Dữ liệu khởi tạo (demo tháng 10) ---------- */
function seedData(){
  _rs=20261015;_seq=100;
  const mkUser=(id,username,name,role,title)=>({id,username,name,role,title,active:true,pw:"",perms:ROLE_PRESET[role].slice()});
  const d={version:APP_VERSION,month:MONTH.key,
    settings:{today:15,cutoff:11,workDays:26,winnerOrders:100,winnerBonus:200000,potential:30,adsBudget:[6e6,10e6,14e6,12e6,8e6]},
    users:[mkUser("u_chi","chihoa","Chị Hoa","admin","CEO"),mkUser("u_oanh","oanh","Oanh","lead","Lead Content & Media"),mkUser("u_quynh","quynh","Quỳnh","content","Content"),mkUser("u_may","may","May","content","Content + Research"),mkUser("u_trinh","trinh","Trinh","content","Content"),mkUser("u_hoa","hoa","Hòa","content","Content"),mkUser("u_digital","digital","Digital (tài khoản chung)","digital","Team Digital"),mkUser("u_va","vietanh","Việt Anh","digital","Ads Facebook"),mkUser("u_thao","thao","Ngọc Thảo","digital","Ads Facebook"),mkUser("u_duan","duan","Duẩn","digital","Ads Facebook"),mkUser("u_dat","dat","Đình Đạt","digital","Ads Facebook"),mkUser("u_huyen","huyen","Bích Huyền","digital","Ads TikTok")],
    products:JSON.parse(JSON.stringify(PRODUCTS0)),catalog:catalog0(),
    plan:{notes1:{nhanDinh:"Tốt: tinh dầu giữ doanh thu nhờ video đăng 30/05.\nChưa tốt: video tháng 9 gần như không ra đơn; bột tẩy chỉ 8 video; thiếu ngày, thiếu ID nên không đo được.",vanDe:"1. Giảm phụ thuộc 1 video cũ: nhân bản + tìm video win mới (tinh dầu đang tốt, làm 50).\n2. Đẩy Bột tẩy vạn năng lên 50 video mới.\n3. Via: 2 video/ngày (30 edit footage có sẵn + 30 đăng lại video kho); Via phụ reup 1 video/ngày.\n4. Fanpage chính 28 bài, agent tạo ảnh và đăng tự động.\n5. Sale đôi 10/10 và 20/10 trên TikTok + Fanpage.\n6. Bắt buộc nhập đủ ngày, link, ID.",nguonLuc:"Worker dựng tự động (giảm công dựng).\n2 tài khoản Via mới.\n193 video cũ đã duyệt trong kho."},steps:{1:{s:"done",by:"Oanh",at:"25/09"},2:{s:"done",by:"Chị Hoa",at:"26/09"},3:{s:"done",by:"Oanh",at:"26/09"},4:{s:"review",by:"May",at:"28/09",note:"Còn thiếu research Nước giặt AiBio, Arila"},5:{s:"done",by:"Chị Hoa",at:"29/09"},6:{s:"done",by:"Oanh",at:"30/09"}},published:null},
    goals:{},kpiTargets:{},questions:[],research:[],insights:[],strategy:{},tactics:[],pillars:[],tuyen:[],
    cards:[],orders:[],kho:[],winPlans:[],oldWins:[],imports:[],weekly:[],adsRows:[],weekNotes:{},channelNotes:{},quychuan:typeof QUYCHUAN!=="undefined"?JSON.parse(JSON.stringify(QUYCHUAN)):{rules:[],lists:[]},activity:[]};
  /* Mục tiêu: tổng ~1,4 tỷ doanh thu video TikTok (giữ mức tháng 9), bột tẩy ×1,5 */
  const base=typeof T9_BASE!=="undefined"?T9_BASE:{};const tot9=sum(Object.keys(base),k=>base[k])||1;
  PRODUCTS0.forEach(p=>{const b=base[p.k]||0;const share=b/tot9*1.4e9;d.goals[p.k]={m9:Math.round(b/1e6)*1e6,gmv:p.k==="BT"?Math.round(Math.max(share,7e6)*1.5/1e6)*1e6:["TL","NG","AR","LSCD"].includes(p.k)?5e6:Math.round(Math.max(share,3e6)/1e6)*1e6}});
  d.kpiTargets={gmvVideo:1.4e9,donVideo:27000,videoTT:253,baiFb:28,winMoi:6,raDon:40,adsChi:50e6,adsRoas:2.5,orderDungHan:90,coId:100};
  d.strategy={muc:"Giữ doanh thu video TikTok khoảng 1,4 tỷ như tháng 9; đẩy Bột tẩy vạn năng (50 video mới) và Tinh dầu (50 video, đang tốt); Via đều 2 video/ngày",khach:"Gia đình 25–45 tuổi, mẹ có con nhỏ, quan tâm đồ sạch, thơm, an toàn; thêm quán ăn, nhà hàng cho xịt ruồi và lau sàn chuyên dụng",sanpham:"Đẩy: Bột tẩy vạn năng 50, Tinh dầu 50. Duy trì: Xịt muỗi 20, Xịt ruồi 20. Lên: Sáp thơm 10, Lau sàn chuyên dụng 10. Via: Tẩy lồng AiBio, Nước giặt AiBio, Arila, video ruồi/muỗi trong kho",kenh:"TikTok chính 160 video · Via 2 video/ngày · Via phụ reup 1 video/ngày · Fanpage chính 28 bài (agent đăng tự động) · Page Via chị Hoa tự chạy",thongdiep:"Sạch & Lành: thấy sạch bằng mắt (bột tẩy, lau sàn), thơm như tiệm giặt (tinh dầu), an toàn cho bé (xịt muỗi, ruồi)",hoatdong:"Video TikTok one-shot · Nhân bản video win tinh dầu · Worker edit footage có sẵn cho Via · Sale đôi 10/10 và 20/10 (TikTok + Fanpage) · Ads Facebook đẩy Tinh dầu, Tẩy lồng AiBio, Bột tẩy vạn năng, XClean"};
  d.tactics=[
    {k:"CT1",n:"Bột tẩy vạn năng: 50 video mới, thấy sạch bằng mắt",sku:["BT"],f:["Bột tẩy thành sản phẩm chủ lực mới, có ít nhất 3 video win","Mẹ, nội trợ có đồ trắng ố, đồ mốc mùa nồm","One-shot trước/sau trong 3 giây đầu, mỗi video một món đồ thật","50 video quay mới trên TikTok chính","TikTok chính","Giỏ hàng, combo 250g + 450g","Đơn từ video bột tẩy, số video win"]},
    {k:"CT2",n:"Tinh dầu: đang tốt, đẩy 50 video + nhân bản win",sku:["TD"],f:["Giữ và tăng doanh thu tinh dầu","Khách đã quen sản phẩm + người mới mùa nồm","Nhân bản video win (đổi hook, cảnh mở, người nói), chọn mùi theo gu","50 video (20 bản nhân)","TikTok chính","Giỏ hàng","Doanh thu tinh dầu, số bản nhân ra đơn"]},
    {k:"CT3",n:"Via: 2 video/ngày + Via phụ reup 1 video/ngày",sku:["TL","NG","AR"],f:["Via đăng đều, tìm sản phẩm có tín hiệu","Người có máy giặt, khách quan tâm giặt giũ, côn trùng","Via: 30 video edit từ footage AiBio, Arila có sẵn + 30 video ruồi, muỗi đăng lại từ kho (Worker edit). Via phụ: reup video mới","62 video Via, 31 video Via phụ","TikTok Via 1, TikTok Via 2","Giỏ hàng","Đơn mỗi Via, số ngày đăng đủ"]},
    {k:"CT4",n:"Sale đôi 10/10 và 20/10",sku:["BT","TD"],f:["Kéo đơn 2 đợt sale","Khách đang cân nhắc, khách cũ","Video + bài báo trước 3 ngày, ngày sale đăng nhắc giờ vàng","8 video BT + 8 video TD + bài Fanpage","TikTok chính, Fanpage chính","Voucher shop, giỏ hàng","Đơn ngày 10/10 và 20/10 so với ngày thường"]},
    {k:"DT",n:"Duy trì: xịt muỗi, xịt ruồi, sáp thơm, lau sàn chuyên dụng",sku:["XM","XR","SAP","LSCD"],f:["Giữ nhịp, mở thêm sáp thơm và lau sàn chuyên dụng","Khách cũ; quán ăn, nhà hàng","Lịch đều, ưu tiên nhân bản video đang bán","Xịt muỗi 20, Xịt ruồi 20, Sáp thơm 10, Lau sàn CD 10","TikTok chính","Giỏ hàng","Đơn không tụt so với tháng 9"]},
  ];
  /* PILLAR_THANG + TUYEN_THANG — kế hoạch T10 chị chốt 01/10 */
  d.pillars=[
    {ma:"PIL-2610-BT",sku:"BT",kenh:"TikTok chính",vaiTro:"SKU chủ lực mới — đẩy mạnh",mucTieu:"50 video quay mới",kh:50,dinhDang:"Video",idea:"Thấy sạch bằng mắt: trước/sau + how-to",nguoi:"u_hoa",ghiChu:""},
    {ma:"PIL-2610-TD",sku:"TD",kenh:"TikTok chính",vaiTro:"Đang tốt — đẩy",mucTieu:"50 video; nhân bản win",kh:50,dinhDang:"Video",idea:"Thơm như tiệm giặt; gu hương",nguoi:"u_quynh",ghiChu:""},
    {ma:"PIL-2610-XM",sku:"XM",kenh:"TikTok chính",vaiTro:"Duy trì",mucTieu:"20 video",kh:20,dinhDang:"Video",idea:"Tình huống thật, an toàn cho bé",nguoi:"u_trinh",ghiChu:""},
    {ma:"PIL-2610-XR",sku:"XR",kenh:"TikTok chính",vaiTro:"Duy trì",mucTieu:"20 video",kh:20,dinhDang:"Video",idea:"Bếp nhà, quán ăn sạch ruồi",nguoi:"u_trinh",ghiChu:""},
    {ma:"PIL-2610-SAP",sku:"SAP",kenh:"TikTok chính",vaiTro:"Lên nhẹ",mucTieu:"10 video",kh:10,dinhDang:"Video",idea:"Lưu hương 2 tháng vs sáp chợ",nguoi:"u_may",ghiChu:""},
    {ma:"PIL-2610-LSCD",sku:"LSCD",kenh:"TikTok chính",vaiTro:"Lên nhẹ",mucTieu:"10 video",kh:10,dinhDang:"Video",idea:"Sàn sạch không cần lau lại, mùi dễ chịu",nguoi:"u_may",ghiChu:""},
    {ma:"PIL-2610-VIA1",sku:"TL",kenh:"TikTok Via 1",vaiTro:"2 video/ngày",mucTieu:"62 video: 30 edit footage có sẵn + 30 đăng lại video kho",kh:62,dinhDang:"Video (Worker edit)",idea:"Tẩy lồng AiBio reup, nước giặt AiBio, Arila; ruồi, muỗi trong kho",nguoi:"u_may",ghiChu:"Kho gồm cả video đã đăng trước đây (đăng lại)"},
    {ma:"PIL-2610-VIA2",sku:"TD",kenh:"TikTok Via 2",vaiTro:"Via phụ — reup",mucTieu:"31 video, 1 video/ngày",kh:31,dinhDang:"Video reup",idea:"Reup video mới của kênh chính",nguoi:"u_may",ghiChu:""},
    {ma:"PIL-2610-PAGE",sku:"TD",kenh:"Fanpage chính",vaiTro:"Thương hiệu + sale",mucTieu:"28 bài: mỗi tuần 3 video + 4 bài ảnh",kh:28,dinhDang:"Video/Reel + bài ảnh",idea:"Lịch tháng; agent tạo ảnh và đăng tự động; sale 10/10, 20/10",nguoi:"u_oanh",ghiChu:"Page Via chị Hoa tự chạy (3 video/ngày từ kho, tự động)"},
  ];
  const T=(ma,kenh,sku,tuyen,vaiTro,kh,nguoi,kc="Có bằng chứng",ins="")=>({ma,kenh,sku,tuyen,vaiTro,kh,nguoi,kiemChung:kc,maInsight:ins,ghiChu:""});
  d.tuyen=[
    T("T10-BT-TS","TikTok chính","BT","Trước/sau","Chứng minh",20,"u_hoa","Có bằng chứng","INS-01"),T("T10-BT-HOW","TikTok chính","BT","How-to","Hướng dẫn",14,"u_hoa","Giả thuyết"),T("T10-BT-PAIN","TikTok chính","BT","Pain/Insight","Khơi nhu cầu",8,"u_quynh","Giả thuyết"),T("T10-BT-SALE","TikTok chính","BT","Sale 10/10 & 20/10","Chuyển đổi",8,"u_hoa"),
    T("T10-TD-WIN","TikTok chính","TD","Nhân bản winner","Giữ doanh thu",20,"u_quynh","Có bằng chứng","INS-02"),T("T10-TD-PAIN","TikTok chính","TD","Pain/Insight","Khơi nhu cầu",10,"u_quynh"),T("T10-TD-MUI","TikTok chính","TD","Chọn mùi/Lifestyle","Cân nhắc",12,"u_oanh","Giả thuyết"),T("T10-TD-SALE","TikTok chính","TD","Sale 10/10 & 20/10","Chuyển đổi",8,"u_oanh"),
    T("T10-XM-PAIN","TikTok chính","XM","Pain/Insight","Khơi nhu cầu",7,"u_trinh"),T("T10-XM-DEMO","TikTok chính","XM","Demo/Proof","Chứng minh",7,"u_trinh"),T("T10-XM-REV","TikTok chính","XM","Review/Proof","Tin cậy",6,"u_trinh"),
    T("T10-XR-DEMO","TikTok chính","XR","Demo/Proof","Chứng minh",10,"u_trinh"),T("T10-XR-QUAN","TikTok chính","XR","Pain/Insight","Quán ăn, nhà hàng",10,"u_trinh","Giả thuyết"),
    T("T10-SAP-LIFE","TikTok chính","SAP","Chọn mùi/Lifestyle","Khơi nhu cầu",10,"u_may","Giả thuyết"),
    T("T10-LSCD-DEMO","TikTok chính","LSCD","Demo/Proof","Chứng minh",10,"u_may","Giả thuyết"),
    T("T10-VIA-TL","TikTok Via 1","TL","Edit footage có sẵn","Reup tẩy lồng AiBio",10,"u_may"),T("T10-VIA-NG","TikTok Via 1","NG","Edit footage có sẵn","Nước giặt AiBio",10,"u_may"),T("T10-VIA-AR","TikTok Via 1","AR","Edit footage có sẵn","Arila",10,"u_may"),
    T("T10-VIA-XR","TikTok Via 1","XR","Đăng lại video kho","Ruồi — video kho",16,"u_may"),T("T10-VIA-XM","TikTok Via 1","XM","Đăng lại video kho","Muỗi — video kho",16,"u_may"),
    T("T10-VIA2-REUP","TikTok Via 2","TD","Reup video mới","Via phụ 1 video/ngày",31,"u_may"),
    T("T10-PAGE-VID","Fanpage chính","TD","Video/Reel","3 video/tuần",12,"u_oanh"),T("T10-PAGE-ANH","Fanpage chính","BT","Bài ảnh (agent tự tạo)","4 bài ảnh/tuần",12,"u_oanh"),T("T10-PAGE-SALE","Fanpage chính","BT","Sale 10/10 & 20/10","Truyền thông sale",4,"u_oanh"),
  ];
  publishPlan(d);
  /* tiến độ mẫu tới 15/10 */
  const td=d.settings.today,cut=d.settings.cutoff;
  d.cards.forEach(c=>{const g=c.day-td;
    if(c.day>=22){c.step="cg";return}
    c.nguoi=c.goiy;c.hookText=c.yTuong;c.noiDung="Mở: "+c.yTuong+". Cảnh: thao tác thật với sản phẩm. Kết: gắn giỏ.";
    if(g<0)c.step="xong";else if(g===0)c.step=pick(["dang","dvd"]);else if(g===1)c.step=pick(["worker","dvd","quay"]);else if(g<=3)c.step=pick(["quay","dkb"]);else c.step=pick(["dkb","kb","kb"]);
    if(c.nguon==="Footage cũ"&&["quay","dkb"].includes(c.step))c.step="kb";
    if(c.kenh==="Fanpage chính"&&c.step==="worker")c.step="quay";
    if(g<0&&rnd()<.06)c.step=pick(["quay","dvd"]);
    if(c.step==="kb"){c.hookText="";c.noiDung=""}
    if(["worker","dvd","dang","xong"].includes(c.step))c.linkVideo="https://drive.google.com/drive/folders/"+c.id;
    if(["dang","xong"].includes(c.step))c.ceo="PASS";
    if(c.step==="xong"){c.ngayDang=c.day;if(chOf(c.kenh).needId){c.tiktokId="76"+String(Math.floor(rnd()*1e17)).padStart(17,"0");if(rnd()<.05)c.tiktokId=""}else c.linkDang="https://facebook.com/ailla/posts/"+c.id}
    if(c.step==="xong"&&c.day<=cut&&c.tiktokId){const base=c.kenh==="TikTok chính"?2500:500;c.view=Math.round(base*(.2+rnd()*2.4)/10)*10;c.click=Math.round(c.view*(.01+rnd()*.03));c.giuChan=Math.round((1+rnd()*4)*10)/10;const boost=c.sku==="BT"?1.4:c.nguon==="Nhân bản winner"?2.6:1;c.don=rnd()<.35?0:Math.round(c.click*(.05+rnd()*.2)*boost);c.gmv=c.don*sk(c.sku).gia}
  });
  d.cards.forEach((c,i)=>{if(c.kenh==="Fanpage chính"){c.dangVideo=["Bài ảnh","Carousel","Video/Reel"][i%3];if(c.step!=="cg"&&c.step!=="kb"){c.caption=c.yTuong+" 💗 Ailla — Cùng Mẹ chăm sóc cả gia đình";if(c.dangVideo==="Video/Reel")c.linkVideo="https://drive.google.com/file/d/"+c.id;else c.linkAnh="https://drive.google.com/drive/folders/anh-"+c.id}}
    else if(["dang","xong","dvd"].includes(c.step)){c.caption=c.hookText+" #ailla #"+({BT:"bottayvannang",TD:"tinhdaugiatsay",XM:"xitmuoi",XR:"xitruoi",SAP:"sapthom",LSCD:"lausan",TL:"taylong",NG:"nuocgiat",AR:"arila"}[c.sku]||"ailla")}
    if(c.step==="xong"&&c.tiktokId&&c.kenh==="TikTok chính")c.linkDang="https://www.tiktok.com/@aillavietnamstore/video/"+c.tiktokId});
  const w=d.cards.find(c=>c.maTuyen==="T10-TD-WIN"&&c.step==="xong"&&c.tiktokId);if(w)Object.assign(w,{yTuong:"Một mẻ đồ, mình dùng tinh dầu thế này (bản nhân 1 — đổi người nói)",hookText:"Một mẻ đồ, mình dùng tinh dầu thế này",view:28400,click:960,don:142,gmv:142*51000,winSrc:"7645521691203996949"});
  /* Video win cũ (số thật tuần 24–30/9) */
  d.oldWins=[{id:"7645521691203996949",ten:"Tinh dầu giặt sây Ailla- đậm đặc gấp 10 lần… (Một mẻ đồ, mình dùng tinh dầu giặt sấy thế này)",tm:"2026/05/30",sku:"TD",kenh:"TikTok chính",view:2388986,don:6121,gmv:312833319,note:"Số tuần 24–30/9, có chạy quảng cáo"},{id:"7618867699954765057",ten:"7 ngày muỗi vẫn ngỏm #aillavietnam",tm:"2026/03/20",sku:"XM",kenh:"TikTok chính",view:39580,don:189,gmv:9574631,note:"Số tuần 24–30/9, có chạy quảng cáo"},{id:"7683465037851249938",ten:"Bí quyết các tiệm giặt khiến quần áo thơm cả tuần",tm:"2026/09/09",sku:"TD",kenh:"TikTok chính",view:28397,don:173,gmv:6675343,note:"Số tuần 24–30/9"}];
  d.winPlans=[{id:"WP-01",src:"7645521691203996949",srcTen:"Một mẻ đồ, mình dùng tinh dầu giặt sấy thế này",sku:"TD",diemThang:"Cảnh thao tác thật (nhỏ tinh dầu vào mẻ đồ) ngay giây đầu, lời nói đời thường, có chạy quảng cáo",diemYeu:"Phụ thuộc 1 video, video đã 4 tháng",giu:"Cảnh thao tác + câu mở",doi:"Người nói, bối cảnh, mùi",soBan:8,kenh:"TikTok chính",nguoi:"u_quynh",deadline:20,ketLuan:"Bản nhân 1 ra 142 đơn tuần 2 → làm tiếp đủ 8 bản"}];
  d.cards.filter(c=>c.maTuyen==="T10-TD-WIN").forEach(c=>{c.winPlan="WP-01";c.winSrc="7645521691203996949"});
  /* Order Digital */
  d.orders=[
    {ma:"ORD-0003",ngay:"02/10",nguoiOrder:"u_digital",kenh:"Facebook Ads",sku:"BT",muc:"Test hook trước/sau cho bột tẩy",sl:3,han:6,brief:"3 hook: cổ áo ố / đồ mốc / giày trắng",linkMau:"",giao:"u_hoa",trangThai:"Xong",chi:4.2e6,donAds:96,dtAds:6.6e6,fb:"Video 2 tỷ lệ bấm tốt nhất, làm thêm kiểu này"},
    {ma:"ORD-0004",ngay:"09/10",nguoiOrder:"u_digital",kenh:"Facebook Ads",sku:"TD",muc:"Sale 20/10 — tinh dầu làm quà",sl:2,han:16,brief:"Hook quà tặng chị em ngày 20/10, nhắc voucher sale",linkMau:"",giao:"u_quynh",trangThai:"Đang làm",chi:0,donAds:0,dtAds:0,fb:""},
    {ma:"ORD-0005",ngay:"14/10",nguoiOrder:"u_digital",kenh:"Facebook Ads",sku:"BT",muc:"Đồ mốc mùa nồm",sl:2,han:20,brief:"Cận đồ mốc 3 giây đầu",linkMau:"",giao:"",trangThai:"Mới",chi:0,donAds:0,dtAds:0,fb:""},
  ];
  d.orders.forEach((o,oi)=>{for(let i=0;i<o.sl;i++){const c=newCard(d,{sku:o.sku,kenh:"TikTok chính",day:o.han,nguon:"Order Digital",order:o.ma,yTuong:"Order "+o.ma+": "+o.muc,tuyen:"Order Digital",goiy:o.giao||"u_hoa"});
    if(oi===0||(oi===1&&i===0)){Object.assign(c,{step:"xong",nguoi:c.goiy,hookText:c.yTuong,linkVideo:"https://drive.google.com/drive/folders/"+c.id,ceo:"PASS",ngayDang:o.han,tiktokId:"77"+String(Math.floor(rnd()*1e17)).padStart(17,"0")})}else if(oi===1){Object.assign(c,{step:"dvd",nguoi:c.goiy,hookText:c.yTuong,linkVideo:"https://drive.google.com/drive/folders/"+c.id})}
    d.cards.push(c)}});
  /* Kho video cũ (số thật) */
  d.kho=(typeof T9RAW!=="undefined"?T9RAW.kho:[]).map(k=>({ma:k.ma,skuText:k.sku,sku:guessSku(k.sku)||"KHAC",nguoi:k.nguoi,tuyen:k.tuyen,duyet:k.duyet,link:k.link,kenhDeXuat:"",lyDo:"",quyen:"Chưa kiểm",canSua:"",trangThai:"Chưa dùng",maDang:""}));
  /* Research + insight */
  d.questions=[{id:"Q-01",sku:"BT",q:"Khách lo gì nhất khi dùng bột tẩy cho đồ màu?",to:"u_may",status:"Đang làm"},{id:"Q-02",sku:"BT",q:"Đối thủ bột tẩy trên TikTok Shop bán giá nào, combo gì, hook gì?",to:"u_may",status:"Đang làm"},{id:"Q-03",sku:"TD",q:"Vì sao video \"Một mẻ đồ…\" vẫn bán? Giữ yếu tố nào khi nhân bản?",to:"u_quynh",status:"Xong"},{id:"Q-04",sku:"TL",q:"Khách tẩy lồng hỏi gì nhiều nhất trong comment?",to:"u_may",status:"Chưa làm"},{id:"Q-05",sku:"NG",q:"Nước giặt AiBio khác gì nước giặt thường, khách quan tâm điều gì?",to:"u_trinh",status:"Chưa làm"},{id:"Q-06",sku:"AR",q:"Arila bán cho ai, đối thủ nào?",to:"u_may",status:"Chưa làm"}];
  d.research=[
    {id:"RS-001",ngay:"26/09",sku:"TD",q:"Q-03",nhanh:"nb",nguon:"TikTok Shop (file Video Performance)",bangChung:"Video đăng 30/05 ra 6.121 đơn, 312,8 triệu trong tuần 24–30/9 = 87% doanh thu tuần của tài khoản",link:"TikTok Shop › Phân tích › Video",chiSo:"6.121 đơn / tuần",phanLoai:"Dữ liệu thô",tag:"Phụ thuộc 1 video",tin:"Cao",by:"u_quynh",status:"Đã duyệt",maInsight:"INS-02",ghiChu:"Số thật"},
    {id:"RS-002",ngay:"26/09",sku:"BT",q:"",nhanh:"nb",nguon:"Sheet tháng 9",bangChung:"Tháng 9 chỉ 8 video bột tẩy trên sheet, 0 video đăng",link:"Sheet HỆ THỐNG QUẢN TRỊ CONTENT",chiSo:"8 video",phanLoai:"Dữ liệu thô",tag:"Thiếu video",tin:"Cao",by:"u_oanh",status:"Đã duyệt",maInsight:"INS-01",ghiChu:"Số thật"},
    {id:"RS-003",ngay:"28/09",sku:"BT",q:"Q-01",nhanh:"kh",nguon:"Comment TikTok",bangChung:"VÍ DỤ CÁCH GHI — chép nguyên câu khách hỏi, ghi số lần gặp",link:"(link comment)",chiSo:"",phanLoai:"Dữ liệu thô",tag:"Lo phai màu",tin:"Trung bình",by:"u_may",status:"Chờ kiểm tra",maInsight:"",ghiChu:"Dòng ví dụ"},
  ];
  d.insights=[
    {ma:"INS-01",ngay:"28/09",sku:"BT",persona:"Mẹ có con đi học, đồ trắng nhiều",van:"Áo trắng ố cổ, đồ mốc mùa nồm",insight:"Khách tin khi tận mắt thấy trước/sau trên đồ thật của nhà mình",maRs:"RS-002",bangChung:"Nội bộ: thiếu video bột tẩy; video trước/sau tháng trước ra đơn tốt hơn video nói (chờ research ngoài)",coHoi:"Đẩy bột tẩy bằng chuỗi trước/sau",goc:"Thấy sạch bằng mắt",chungMinh:"Cảnh trước/sau rõ trong 3 giây đầu, đúng quy cách 250g/450g",format:"One shot",uuTien:"Cao",tin:"Trung bình",quyetDinh:"Làm ngay",deXuat:"u_oanh",duyet:"u_chi",maTuyen:"T10-BT-TS"},
    {ma:"INS-02",ngay:"28/09",sku:"TD",persona:"Khách mua tinh dầu",van:"Doanh thu treo vào 1 video cũ",insight:"Cảnh thao tác thật + lời nói đời thường bán được lâu",maRs:"RS-001",bangChung:"Video 30/05: 87% doanh thu tuần",coHoi:"Nhân bản video win",goc:"Bí quyết tiệm giặt, thao tác thật",chungMinh:"Giữ cảnh nhỏ tinh dầu vào mẻ đồ",format:"One shot",uuTien:"Cao",tin:"Cao",quyetDinh:"Làm ngay",deXuat:"u_oanh",duyet:"u_chi",maTuyen:"T10-TD-WIN"},
    {ma:"INS-03",ngay:"29/09",sku:"AR",persona:"Chưa rõ",van:"Chưa rõ",insight:"Chưa đủ dữ liệu",maRs:"",bangChung:"",coHoi:"Mở Via 2 cho Arila",goc:"",chungMinh:"",format:"",uuTien:"Trung bình",tin:"Thấp",quyetDinh:"Test",deXuat:"u_may",duyet:"",maTuyen:"T10-AR-HOW"},
  ];
  /* Tuần + Ads (mẫu) — tổng tới 11/10 khớp nhịp ~1,4 tỷ/tháng */
  d.weekly=[{w:1,cu:168e6,tutao:2.6e6,ads:5.4e6,adsDon:131,adsGmv:9.1e6},{w:2,cu:268e6,tutao:5.1e6,ads:9.6e6,adsDon:214,adsGmv:15.7e6}];
  const camp=[["VA-BTVN-CD-T10","BT"],["Thao-TINHDAU-CD-T10","TD"],["Duan-XM-MESS-T10","XM"],["VA-TLAi-CD","TL"],["[AVN] tt ailla vietnam","TT"]];
  d.adsRows=[1,2].flatMap(wk=>camp.map(([ten,s],i)=>{const dec=decodeCampaign(ten);const chi=Math.round((wk===1?5.4e6:9.6e6)*[.38,.3,.16,.1,.06][i]/1e3)*1e3;return {tuan:wk,ten,...dec,chi,mua:s==="TT"?0:Math.round(chi/42000),gt:s==="TT"?0:Math.round(chi/42000)*(sk(s).gia||50000)*1.2,mess:s==="XM"?Math.round(chi/9000):0}}));
  d.imports=[{id:"i1",loai:"TikTok",kenh:"TikTok chính",at:"13/10/2026 09:12",by:"Oanh",file:"Video Performance List_20261013.xlsx",range:"Phạm vi ngày: 2026-10-05 ~ 2026-10-11",tuan:2,sum:{match:{n:38,don:0,gmv:0},stray:{n:2,don:0,gmv:0},auto:{n:131,don:0,gmv:5.1e6},old:{n:540,don:0,gmv:268e6}},stray:[]},{id:"i2",loai:"Ads Facebook",kenh:"Meta Ads",at:"13/10/2026 09:20",by:"Digital",file:"Ailla-Campaigns-5-11-Oct.xlsx",range:"2026-10-05 → 2026-10-11",tuan:2,sum:{chi:9.6e6,mua:214,gt:15.7e6,mess:0}}];
  d.weekNotes={1:{lech:"Mới 4 ngày, video cũ vẫn kéo phần lớn doanh thu.",qd:"Giữ 3 video/ngày tài khoản chính."},2:{lech:"Bản nhân video win lần 1 ra 142 đơn. Bột tẩy trước/sau ra đơn tốt hơn video nói. 2 video Via chưa dán ID.",qd:"Thêm 3 bản nhân; bột tẩy chỉ làm trước/sau; nhắc dán ID trong ngày."}};
  d.channelNotes={"TikTok chính":["Tiếp tục ưu tiên","Kênh tạo đơn chính"],"TikTok Via 1":["Theo dõi","Tìm tín hiệu AiBio"],"TikTok Via 2":["Theo dõi","Tận dụng video tồn"],"Fanpage chính":["Duy trì","28 bài, agent đăng tự động; sale 10/10, 20/10"],"Ads Facebook":["Giữ có điều kiện","Chỉ đẩy video đã ra đơn tự nhiên"]};
  d.activity=[{t:"09:40",d:"15/10/2026",who:"Worker",msg:"dựng xong TT-0118, chờ duyệt"},{t:"09:31",d:"15/10/2026",who:"Quỳnh",msg:"gửi kịch bản TT-0121"},{t:"09:20",d:"13/10/2026",who:"Digital",msg:"nhập báo cáo Ads Facebook tuần 2"},{t:"09:12",d:"13/10/2026",who:"Oanh",msg:"nhập báo cáo TikTok tuần 2: 38 video khớp"}];
  return d;
}
/* Đồng bộ giữa các tab đang mở */
window.addEventListener("storage",e=>{if(e.key!==STORE_KEY||!e.newValue)return;try{DB.data=JSON.parse(e.newValue);if(typeof onRemoteChange==="function")onRemoteChange()}catch(err){}});
