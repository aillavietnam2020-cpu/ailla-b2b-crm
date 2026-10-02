/* =====================================================================
   SẢN XUẤT — Nhu cầu → Xưởng làm → Kế toán kiểm kê, tạo lô → Phân bổ thùng/khay → Tem QR → Nhập kho/bàn giao
   Theo bản bàn giao "Module sản xuất & tạo tem AILLA" (01/10/2026). Telegram làm sau; web là nơi lưu chính.
   Quy tắc cứng: chưa kiểm kê thì không có tem · Tổng kiểm = Đạt + Lỗi + Chờ · Tổng phân bổ = Đạt ·
   không xóa lô đã xác nhận (chỉ hủy, có lịch sử) · in lại phải có lý do · lỗi/chờ không tính vào hàng bán được.
   ===================================================================== */
const SX_REQ_ST={CAN_LAM:["Cần làm","pnk"],DANG_LAM:["Đang làm","blu"],CHO_KIEM:["Chờ kế toán kiểm","amb"],HOAN_TAT:["Hoàn tất","grn"],HUY:["Đã hủy","gry"]};
const SX_LOT_ST={CHO_KIEM:["Chờ kiểm kê","amb"],DA_KIEM:["Đã kiểm · chờ phân bổ","blu"],TEM_SAN:["Đã tạo tem · chờ in","vio"],DA_IN:["Đã in tem","teal"],SAN_SANG:["Đã nhập kho / bàn giao","grn"],HUY:["Đã hủy","gry"]};
const SX_NGUON=["Thiếu hàng","Đơn B2C","Đơn B2B","Gia công","Bổ sung tồn","Khác"];
const SX_LOAI_VC=["Thùng","Khay","Kệ","Khác"];
const SX_TABS=[["sx_tq","Tổng quan"],["sx_nc","Nhu cầu sản xuất"],["sx_td","Tiến độ xưởng"],["sx_lo","Kiểm kê – Lô & Tem"],["sx_nvl","Nguyên vật liệu"],["sx_mh","Mua hàng / Đặt ngoài"],["sx_kho","Kho thành phẩm"],["sx_bc","Báo cáo"]];
const sxPad=(n,w=2)=>String(n).padStart(w,"0");
const sxToday=()=>{const t=new Date();return `${t.getFullYear()}-${sxPad(t.getMonth()+1)}-${sxPad(t.getDate())}`};
const sxNow=()=>{const t=new Date();return sxToday()+" "+sxPad(t.getHours())+":"+sxPad(t.getMinutes())};
const sxDd=s=>s?s.slice(8,10)+"/"+s.slice(5,7)+"/"+s.slice(0,4):"—";
const SX=()=>D().sx;
const sxP=ma=>(SX().products.find(p=>p.ma===ma)||{ma,ten:ma||"—"});
const sxCan=k=>can(ME,k)||ME.role==="admin";

/* ---------- Dữ liệu gốc ---------- */
const SX_GIACONG=/azzen|metis|camila|della|mesy/i;
function sxPrefix(ten){const w=String(ten).normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/gi,"d").toUpperCase().split(/[^A-Z0-9]+/).filter(x=>x&&!/^(AILLA|NUOC|SX|ML|KG|G|LIT|L)$/.test(x)&&!/^\d/.test(x));return (w.slice(0,2).map(x=>x[0]).join("")||"SP")}
function sxShape(d){
  if(!d.sx)d.sx={products:[],people:[],requests:[],batches:[],norms:[],usage:[],purchases:[],moves:[],log:[],cfg:{labelW:100,labelH:70,nvlTol:5,boxDefault:50},demo:false,seeded:false};
  const s=d.sx;if(!s.maps)s.maps=[];if(!s.cfg.b2bFrom)s.cfg.b2bFrom=sxToday();
  if(!s.products.length&&(d.skus||[]).length)s.products=d.skus.map(k=>({ma:k.ma,ten:k.ten,dvt:"sp",loai:SX_GIACONG.test(k.ten)?"Gia công":"Tự sản xuất",prefix:sxPrefix(k.ten),thung:0,toiThieu:0,active:true}));
  if(!s.people.length&&(d.staff||[]).length)s.people=d.staff.filter(x=>x.khoi==="Sản xuất & Kho"&&x.tt!=="Đã nghỉ").map(x=>({ten:x.ten.split(" ").pop(),hoTen:x.ten,viTri:x.viTri}));
  if(!s.seeded&&s.products.length){s.seeded=true;sxSeedDemo(s)}
  return d;
}
/* Dữ liệu mẫu để chạy thử luồng (đánh dấu demo, xóa được ở Tổng quan). Lô mẫu đúng ví dụ trong bàn giao. */
function sxSeedDemo(s){
  const find=re=>(s.products.find(p=>re.test(p.ten))||s.products[0]).ma,t=sxToday(),y=(n)=>{const x=new Date();x.setDate(x.getDate()-n);return `${x.getFullYear()}-${sxPad(x.getMonth()+1)}-${sxPad(x.getDate())}`};
  const TL=find(/tẩy lồng máy giặt ailla mới/i),LS=find(/lau sàn ailla 3[.,]6kg sả/i),TD=find(/tinh dầu giặt sấy 80ml ?luxury/i),XM=find(/^xịt muỗi ailla$/i),RC=find(/rửa chén ailla 800 chanh/i),BT=find(/tẩy vạn năng/i);
  const R=(ma,sp,sl,nguon,uu,st,ghi,ngay)=>({id:ma,sp,sl,nguon,uu,han:"",ghiChu:ghi,st,tao:"Thảo",taoLuc:ngay||t,batDau:st==="DANG_LAM"||st==="CHO_KIEM"?t:"",lots:[],hist:[{at:ngay||t,by:"Thảo",act:"Tạo nhu cầu"}]});
  s.requests=[R("YC-"+t.replace(/-/g,"")+"-001",TL,null,"Thiếu hàng","Gấp","CAN_LAM","Kho còn ít, làm trước",t),R("YC-"+t.replace(/-/g,"")+"-002",LS,300,"Đơn B2B","Bình thường","CAN_LAM","Đơn NPP Hà Nội",t),R("YC-"+y(1).replace(/-/g,"")+"-001",TD,400,"Bổ sung tồn","Bình thường","DANG_LAM","",y(1)),R("YC-"+y(1).replace(/-/g,"")+"-002",XM,200,"Đơn B2C","Gấp","DANG_LAM","Đang chạy Ads",y(1)),R("YC-"+y(2).replace(/-/g,"")+"-001",RC,500,"Bổ sung tồn","Bình thường","CHO_KIEM","",y(2)),R("YC-"+y(2).replace(/-/g,"")+"-002",BT,null,"Thiếu hàng","Gấp","CHO_KIEM","Sản phẩm đẩy mạnh T10",y(2))];
  const B=(id,req,sp,ngay,nguoi,bao)=>({id,ma:"",req,sp,ngay,nguoi,baoSL:bao,baoLuc:ngay,baoBy:"Hà",tong:0,dat:0,loi:0,cho:0,ghiChu:"",lechLyDo:"",kiemBy:"",kiemLuc:"",st:"CHO_KIEM",ver:1,containers:[],hist:[{at:ngay,by:"Hà",act:"Xưởng báo hoàn thành "+bao}],nvlTru:false,phatSinh:!req});
  s.batches=[B("B-"+Date.now().toString(36)+"a",s.requests[4].id,RC,y(1),["Nhi","Duyên"],320),B("B-"+Date.now().toString(36)+"b",s.requests[5].id,BT,t,["Thanh","Việt"],240)];
  s.requests[4].lots=[s.batches[0].id];s.requests[5].lots=[s.batches[1].id];
  // Lô mẫu đúng ví dụ bàn giao: 500 = 486 đạt + 7 lỗi + 7 chờ; 8 thùng × 50 + khay A03 × 86.
  const demo={id:"B-demo-tl",ma:"",req:"",sp:TL,ngay:"2026-10-01",nguoi:["Nhi","Vinh"],baoSL:500,baoLuc:"2026-10-01",baoBy:"Hà",tong:500,dat:486,loi:7,cho:7,ghiChu:"7 sản phẩm méo nắp chờ thay nắp",lechLyDo:"",kiemBy:"Huệ",kiemLuc:"2026-10-01 16:40",st:"TEM_SAN",ver:1,containers:[],hist:[],nvlTru:false,phatSinh:true};
  demo.ma=sxLotCode(s,TL,"2026-10-01");
  for(let i=1;i<=8;i++)demo.containers.push({c:"c"+sxPad(i),loai:"Thùng",sl:50,viTri:"Kho A",st:"OK",in:[]});
  demo.containers.push({c:"c09",loai:"Khay",sl:86,viTri:"A03 · khu đóng đơn",st:"OK",in:[]});
  demo.hist=[{at:"2026-10-01 16:20",by:"Hà",act:"Xưởng báo hoàn thành 500"},{at:"2026-10-01 16:40",by:"Huệ",act:"Kiểm kê 500 = 486 đạt + 7 lỗi + 7 chờ, tạo lô "+demo.ma},{at:"2026-10-01 16:42",by:"Huệ",act:"Phân bổ 8 thùng × 50 + Khay A03 × 86, tạo 9 tem"}];
  s.batches.push(demo);
  s.norms=[{sp:TL,vl:"Bột tẩy lồng (oxy hoạt tính)",dm:0.28,dvt:"kg"},{sp:TL,vl:"Túi zip 300g",dm:1,dvt:"cái"},{sp:TD,vl:"Tinh dầu hương Luxury",dm:0.012,dvt:"lít"},{sp:TD,vl:"Chai 80ml",dm:1,dvt:"cái"}];
  s.purchases=[{id:"MH-001",loai:"Nguyên vật liệu",ten:"Chai 80ml tinh dầu",sl:2000,dvt:"cái",ncc:"",ngayDat:t,ngayVe:"",st:"Đề nghị",nguoi:"Thảo",ghiChu:"Đủ dùng ~1 tuần"},{id:"MH-002",loai:"Hàng đặt ngoài",ten:"Hộp quà tinh dầu 20/10",sl:300,dvt:"hộp",ncc:"",ngayDat:y(3),ngayVe:y(-3),st:"Đã đặt",nguoi:"Thảo",ghiChu:""}];
  s.demo=true;
}
function sxLotCode(s,sp,ngay){const pre=(sxPFrom(s,sp).prefix||"SP").toUpperCase(),base=pre+"-"+ngay.replace(/-/g,"")+"-";let n=1;while(s.batches.some(b=>b.ma===base+sxPad(n)))n++;return base+sxPad(n)}
const sxPFrom=(s,ma)=>s.products.find(p=>p.ma===ma)||{prefix:"SP"};
function sxReqCode(s){const t=sxToday().replace(/-/g,""),base="YC-"+t+"-";let n=1;while(s.requests.some(r=>r.id===base+sxPad(n,3)))n++;return base+sxPad(n,3)}
const sxLog=(s,act)=>{s.log.unshift({at:sxNow(),by:ME.name,act});s.log=s.log.slice(0,300)};
const sxMut=(msg,fn)=>DB.mutate(ME.name,"Sản xuất · "+msg,d=>{sxShape(d);fn(d.sx);sxLog(d.sx,msg)});

/* ---------- B2B: trừ tồn theo đơn CRM đã xuất kho (cùng máy chủ, gần như tức thì) ---------- */
const SXB2B={rows:[],prods:[],at:0,busy:false};
async function sxB2BRefresh(force){
  if(typeof svApi!=="function"||SXB2B.busy||(!force&&Date.now()-SXB2B.at<15000))return;SXB2B.busy=true;
  try{const from=(SX()&&SX().cfg.b2bFrom)||sxToday();const [rows,prods]=await Promise.all([svApi("/api/hub/b2b-out?from="+from),SXB2B.prods.length?SXB2B.prods:svApi("/api/hub/b2b-products").catch(()=>[])]);
    const changed=JSON.stringify(rows)!==JSON.stringify(SXB2B.rows)||!SXB2B.at;SXB2B.rows=rows||[];SXB2B.prods=prods||[];SXB2B.at=Date.now();
    if(changed&&/^sx/.test(PAGE)&&!svTyping())renderMain()}catch(e){}finally{SXB2B.busy=false}
}
// Đang mở trang Sản xuất thì 15 giây tải lại đơn B2B một lần (đơn CRM không làm đổi dữ liệu Hub nên phải hỏi riêng).
setInterval(()=>{if(ME&&/^sx/.test(PAGE)&&!document.hidden)sxB2BRefresh()},15000);
const sxMap=ma=>(SX().maps||[]).find(m=>m.nguon==="B2B"&&m.ma===ma);
function sxB2BOut(){const s=SX();if(!s)return [];return SXB2B.rows.filter(r=>String(r.delivered_at||"").slice(0,10)>=s.cfg.b2bFrom).map(r=>{const m=sxMap(r.sku);return m&&m.sp?{sp:m.sp,sl:r.qty*(m.heSo||1),r}:null}).filter(Boolean)}
const sxB2BUnmapped=()=>[...new Set(SXB2B.rows.filter(r=>String(r.delivered_at||"").slice(0,10)>=SX().cfg.b2bFrom&&!(sxMap(r.sku)||{}).sp).map(r=>r.sku))];
/* Gợi ý quy đổi theo tên: mã lẻ (-C, -G…) = 1 sản phẩm; mã thùng = số sản phẩm/thùng (kế toán điền). */
const sxFold=t=>String(t).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/gi,"d").toLowerCase().replace(/[^a-z0-9.]+/g," ").trim();
function sxGuess(name,sku){
  // 1) Mã CRM (bỏ đuôi lẻ -C/-G) trùng mã sản xuất thì lấy luôn.
  const base=String(sku||"").replace(/-(c|g)$/i,"").toLowerCase(),ex=SX().products.find(p=>p.ma.toLowerCase()===base);if(ex)return ex;
  // 2) So tên, dung tích (800ml, 3.6kg, 300g…) phải trùng nhau.
  const norm=t=>sxFold(t).replace(/(\d),(\d)/g,"$1.$2"),size=t=>(norm(t).match(/\d+(\.\d+)?(?= ?(ml|l|lit|kg|g|gam)\b)/g)||[]).map(Number),sz=size(name);
  // Chỉ gợi ý khi MỌI chữ quan trọng của tên CRM (bỏ màu trong ngoặc) đều có trong tên sản xuất và cùng dung tích; không chắc thì để kế toán tự chọn.
  const w=norm(String(name).replace(/\(.*?\)/g," ")).split(" ").filter(x=>x.length>1&&!/^\d/.test(x)&&!["ailla","aill","huong","nuoc","nature","xa","ml","kg","lit","gam","chuyen","dung"].includes(x));if(!w.length)return null;const hits=[];
  SX().products.forEach(p=>{if(SX_GIACONG.test(p.ten)&&!SX_GIACONG.test(name))return;const ps=size(p.ten);if(sz.length&&!(ps.length&&sz.some(v=>ps.includes(v))))return;const pw=" "+norm(p.ten)+" ";if(w.every(x=>pw.includes(" "+x+" ")))hits.push(p)});
  return hits.length===1?hits[0]:null}

/* ---------- Khung trang: thanh tab giống mẫu ---------- */
function sxFrame(m,key,title,sub,body,actions=""){
  sxShape(D());
  m.innerHTML=`<div class="sxhead"><div><h1>${title}</h1><div class="ph-sub">${sub}</div></div><div class="sxact">${actions}</div></div><nav class="sxtabs">${SX_TABS.map(([k,t])=>`<button class="${k===key?"on":""}" data-sxt="${k}">${t}</button>`).join("")}</nav>${SX().demo?`<div class="note sxdemo">Đang có <b>dữ liệu mẫu</b> để chạy thử luồng (lô ${esc((SX().batches.find(b=>b.id==="B-demo-tl")||{}).ma||"")}, các nhu cầu mẫu). ${ME.role==="admin"?`<button class="lnk" id="sx-cleardemo">Xóa dữ liệu mẫu</button>`:""}</div>`:""}${body}`;
  m.querySelectorAll("[data-sxt]").forEach(b=>b.onclick=()=>{PAGE=b.dataset.sxt;renderMain();scrollTo(0,0)});
  if($("#sx-cleardemo"))$("#sx-cleardemo").onclick=()=>{if(!confirm("Xóa toàn bộ nhu cầu, lô, tem, mua hàng mẫu? Danh mục sản phẩm và nhân sự giữ nguyên."))return;sxMut("xóa dữ liệu mẫu",s=>{s.requests=[];s.batches=[];s.usage=[];s.purchases=[];s.moves=[];s.norms=[];s.demo=false});toast("Đã xóa dữ liệu mẫu");renderMain()};
}
const sxCard=(t,link,h)=>`<section class="card"><div class="card-h"><h2>${t}</h2>${link?`<button class="lnk" data-sxt="${link}">Xem tất cả ›</button>`:""}</div>${h}</section>`;
const sxStPill=(map,st)=>pill((map[st]||[st])[0],(map[st]||[0,"gry"])[1]);
const sxNames=b=>(b.nguoi||[]).join(", ")||"—";

/* ---------- Số liệu dùng chung ---------- */
function sxStock(){
  const s=SX(),by={};const g=k=>by[k]=by[k]||{sp:k,san:0,thung:0,khay:0,cho:0,loi:0,choNhap:0,dangLam:0,canLam:0};
  s.batches.filter(b=>b.st!=="HUY").forEach(b=>{const o=g(b.sp);if(b.st==="CHO_KIEM"){o.choNhap+=b.baoSL||0;return}o.cho+=b.cho||0;o.loi+=b.loi||0;const ok=b.containers.filter(c=>c.st==="OK");if(b.st==="SAN_SANG")ok.forEach(c=>{o.san+=c.sl;if(c.loai==="Thùng")o.thung+=c.sl;else o.khay+=c.sl});else o.choNhap+=b.dat||0});
  s.moves.forEach(mv=>{const o=g(mv.sp);if(mv.loai==="Xuất / điều chỉnh")o.san-=mv.sl;if(mv.loai==="Tồn đầu kỳ / điều chỉnh tăng")o.san+=mv.sl});
  // Đơn B2B đã xuất kho trên CRM (từ ngày bắt đầu trừ) → trừ ngay theo bảng quy đổi mã.
  sxB2BOut().forEach(x=>{const o=g(x.sp);o.xuatB2B=(o.xuatB2B||0)+x.sl;o.san-=x.sl});
  s.requests.filter(r=>r.st==="CAN_LAM"||r.st==="DANG_LAM").forEach(r=>{const o=g(r.sp);if(r.st==="DANG_LAM")o.dangLam++;else o.canLam++});
  return Object.values(by).sort((a,b)=>a.san-b.san);
}
function sxAlerts(){
  const s=SX(),A=[],today=sxToday();
  s.requests.filter(r=>r.uu==="Gấp"&&r.st==="CAN_LAM").forEach(r=>A.push(["red","alert",`${sxP(r.sp).ten}: nhu cầu gấp chưa bắt đầu`,`${r.id} · ${r.nguon}${r.sl?" · "+nf(r.sl)+" sp":" · chưa chốt SL"}`,"sx_td","Xem"]));
  s.batches.filter(b=>b.st==="CHO_KIEM").forEach(b=>A.push(["amb","clock",`${sxP(b.sp).ten} chờ kế toán kiểm`,`Xưởng báo ${nf(b.baoSL)} · ${sxDd(b.ngay)} · ${sxNames(b)}`,"sx_lo","Kiểm kê"]));
  s.batches.filter(b=>b.st==="DA_KIEM").forEach(b=>A.push(["amb","task",`Lô ${b.ma} đã kiểm, chưa phân bổ thùng/khay`,`${nf(b.dat)} đạt cần chia vật chứa`,"sx_lo","Phân bổ"]));
  s.batches.filter(b=>b.st==="TEM_SAN").forEach(b=>A.push(["blu","task",`Lô ${b.ma} đã tạo ${b.containers.filter(c=>c.st==="OK").length} tem, chưa in`,sxP(b.sp).ten,"sx_lo","In tem"]));
  s.batches.filter(b=>["DA_KIEM","TEM_SAN","DA_IN","SAN_SANG"].includes(b.st)&&s.norms.some(n=>n.sp===b.sp)&&!s.usage.some(u=>u.lot===b.id)).forEach(b=>A.push(["amb","alert",`Kỹ thuật chưa báo nguyên vật liệu lô ${b.ma}`,sxP(b.sp).ten,"sx_nvl","Nhắc"]));
  s.purchases.filter(p=>p.st==="Đã đặt"&&p.ngayVe&&p.ngayVe<today).forEach(p=>A.push(["red","cart",`${p.ten} về chậm`,`dự kiến ${sxDd(p.ngayVe)}${p.ncc?" · "+p.ncc:""}`,"sx_mh","Xem"]));
  {const um=sxB2BUnmapped();if(um.length)A.push(["amb","box",`${um.length} mã hàng B2B chưa quy đổi`,`đơn đã xuất kho nhưng chưa trừ tồn: ${um.slice(0,4).join(", ")}${um.length>4?"…":""}`,"sx_kho","Quy đổi"])}
  sxStock().filter(o=>{const p=sxP(o.sp);return p.toiThieu&&o.san<p.toiThieu}).forEach(o=>A.push(["red","box",`${sxP(o.sp).ten} dưới mức tối thiểu`,`sẵn sàng ${nf(o.san)} / tối thiểu ${nf(sxP(o.sp).toiThieu)}`,"sx_kho","Xem kho"]));
  return A;
}

/* ---------- 1. TỔNG QUAN ---------- */
function pSxTq(m){
  sxShape(D());const s=SX(),t=sxToday(),R=s.requests,B=s.batches;
  const homNay=B.filter(b=>(b.kiemLuc||"").startsWith(t)||(b.st!=="CHO_KIEM"&&b.ngay===t));
  const datHN=sum(homNay,b=>b.dat||0),loiHN=sum(homNay,b=>(b.loi||0)+(b.cho||0));
  const box=(ic,l,v,h,go,c)=>`<button class="sxk t-${c}" data-sxt="${go}"><i>${ico(ic)}</i><span><small>${l}</small><b>${v}</b>${h?`<em>${h}</em>`:""}</span><u>›</u></button>`;
  const col=(t2,c,items)=>`<div class="sxcol c-${c}"><h3>${t2} (${items.length})</h3>${items.slice(0,4).map(x=>x).join("")||`<p class="empty">—</p>`}</div>`;
  const rq=r=>`<div class="sxmini" data-sxr="${r.id}"><b>${esc(sxP(r.sp).ten)}</b><div>${pill(r.nguon,"gry")} ${r.uu==="Gấp"?pill("Gấp","red"):""}</div><small>Phụ trách: ${esc(r.tao)} · SL: ${r.sl?nf(r.sl):"chưa chốt"}</small></div>`;
  const bt=b=>`<div class="sxmini" data-sxb="${b.id}"><b>${esc(sxP(b.sp).ten)}</b><small>${b.ma?`Lô ${esc(b.ma)}`:"Xưởng báo "+nf(b.baoSL)} · ${esc(sxNames(b))}</small>${b.st==="CHO_KIEM"&&sxCan("sx.kiemke")?`<button class="btn sm pri" data-kk="${b.id}">Kiểm kê</button>`:""}</div>`;
  const A=sxAlerts(),stock=sxStock().slice(0,6),lastLot=B.filter(b=>b.ma&&b.st!=="HUY").sort((a,b)=>(b.kiemLuc||"").localeCompare(a.kiemLuc||""))[0];
  sxFrame(m,"sx_tq","Tổng quan Sản xuất","Nhu cầu, tiến độ xưởng, kiểm kê – tem, nguyên vật liệu và tồn thành phẩm",`
  <div class="sxkpis">${box("task","Cần sản xuất",R.filter(r=>r.st==="CAN_LAM").length+" việc",R.filter(r=>r.st==="CAN_LAM"&&r.uu==="Gấp").length+" gấp","sx_nc","pnk")}${box("gear","Đang sản xuất",R.filter(r=>r.st==="DANG_LAM").length+" việc","","sx_td","grn")}${box("clock","Chờ kế toán kiểm",B.filter(b=>b.st==="CHO_KIEM").length+" lô","","sx_lo","org")}${box("check","Đã kiểm, chưa in tem",B.filter(b=>b.st==="DA_KIEM"||b.st==="TEM_SAN").length+" lô","","sx_lo","vio")}${box("chart","Đạt hôm nay",nf(datHN),"lỗi/chờ "+nf(loiHN),"sx_bc","blu")}${box("alert","Cần xử lý",A.length,"cảnh báo","sx_tq","red")}</div>
  <div class="sxflowbar">${["Cần làm","Đang sản xuất","Chờ kế toán kiểm","Đã kiểm & tạo lô","Đã in tem","Nhập kho / bàn giao"].map(x=>`<span>${x}</span>`).join("<i>→</i>")}</div>
  <div class="sxgrid2"><section class="card"><div class="card-h"><h2>Luồng sản xuất</h2><button class="lnk" data-sxt="sx_td">Xem tất cả ›</button></div><div class="sxcols">${col("Cần làm","pnk",R.filter(r=>r.st==="CAN_LAM").map(rq))}${col("Đang sản xuất","grn",R.filter(r=>r.st==="DANG_LAM").map(rq))}${col("Chờ kế toán kiểm","org",B.filter(b=>b.st==="CHO_KIEM").map(bt))}${col("Đã kiểm & tạo tem","blu",B.filter(b=>["DA_KIEM","TEM_SAN","DA_IN"].includes(b.st)).map(bt))}</div></section>
  ${sxCard("Cần xử lý","",A.length?`<div class="sxalerts">${A.slice(0,7).map(([c,ic,t2,h,go,btn])=>`<div class="sxal a-${c}"><i>${ico(ic)}</i><span><b>${esc(t2)}</b><small>${esc(h)}</small></span><button class="btn sm" data-sxt="${go}">${btn}</button></div>`).join("")}</div>`:`<p class="empty">Không có việc tồn.</p>`)}</div>
  <div class="sxgrid3">${sxCard("Tồn thành phẩm cần chú ý","sx_kho",tbl(["Sản phẩm","Sẵn sàng","Chờ nhập","Đang làm","Trạng thái"],stock.map(o=>{const p=sxP(o.sp),low=p.toiThieu&&o.san<p.toiThieu;return `<tr><td>${esc(p.ten)}</td><td class="n">${nf(o.san)}</td><td class="n">${nf(o.choNhap)}</td><td class="n">${o.dangLam?o.dangLam+" việc":"—"}</td><td>${low?pill("Dưới mức tối thiểu","red"):p.toiThieu?pill("Đủ hàng","grn"):pill("Chưa đặt mức","gry")}</td></tr>`})))}
  ${sxCard("Nguyên vật liệu & Mua hàng","sx_mh",`<div class="sxalerts">${s.purchases.filter(p=>p.st!=="Đã về"&&p.st!=="Hủy").slice(0,4).map(p=>`<div class="sxal a-${p.st==="Đề nghị"?"amb":"blu"}"><i>${ico(p.loai==="Hàng đặt ngoài"?"box":"cart")}</i><span><b>${esc(p.ten)}</b><small>${nf(p.sl)} ${esc(p.dvt)} · ${esc(p.st)}${p.ngayVe?" · về "+sxDd(p.ngayVe):""}</small></span></div>`).join("")||`<p class="empty">Không có đề nghị mua đang mở.</p>`}${B.filter(b=>["DA_KIEM","TEM_SAN","DA_IN","SAN_SANG"].includes(b.st)&&s.norms.some(n=>n.sp===b.sp)&&!s.usage.some(u=>u.lot===b.id)).length?`<p class="hint">${B.filter(b=>["DA_KIEM","TEM_SAN","DA_IN","SAN_SANG"].includes(b.st)&&s.norms.some(n=>n.sp===b.sp)&&!s.usage.some(u=>u.lot===b.id)).length} lô chưa có báo cáo nguyên vật liệu.</p>`:""}</div>`)}
  ${sxCard("Kiểm kê & Tem","sx_lo",lastLot?`<p>Lô gần nhất: <b>${esc(lastLot.ma)}</b> ${sxStPill(SX_LOT_ST,lastLot.st)}</p><p class="hint">Đạt <b class="ok">${nf(lastLot.dat)}</b> · Lỗi <b class="bad">${nf(lastLot.loi)}</b> · Chờ xử lý <b class="warn">${nf(lastLot.cho)}</b></p>${lastLot.containers.length?`<div class="sxlblmini">${sxLabel(lastLot,lastLot.containers.find(c=>c.st==="OK")||lastLot.containers[0],true)}</div>`:""}<div class="acts"><button class="btn" data-sxb="${lastLot.id}">Xem lô & tem</button></div>`:`<p class="empty">Chưa có lô nào.</p>`)}</div>
  ${sxCard("Hoạt động gần đây","",`<div class="sxlog">${s.log.slice(0,8).map(l=>`<div><b>${esc(l.by)}</b> ${esc(l.act)}<small>${esc(l.at)}</small></div>`).join("")||`<p class="empty">Chưa có hoạt động.</p>`}</div>`)}`,
  sxCan("sx.dieuphoi")?`<button class="btn pri" id="sx-new">+ Ghi nhận nhu cầu</button>`:"");
  sxBindCommon(m);if($("#sx-new"))$("#sx-new").onclick=()=>sxReqForm();
}
function sxBindCommon(m){
  m.querySelectorAll("[data-sxt]").forEach(b=>b.onclick=()=>{PAGE=b.dataset.sxt;renderMain();scrollTo(0,0)});
  m.querySelectorAll("[data-sxr]").forEach(e=>e.onclick=ev=>{if(ev.target.closest("button,select,input"))return;sxReqDetail(e.dataset.sxr)});
  m.querySelectorAll("[data-sxb]").forEach(e=>e.onclick=ev=>{if(ev.target.closest("button:not([data-sxb]),select,input"))return;sxLotDetail(e.dataset.sxb)});
  m.querySelectorAll("[data-kk]").forEach(b=>b.onclick=()=>sxInspect(b.dataset.kk));
}

/* ---------- 2. NHU CẦU SẢN XUẤT ---------- */
let SXF={st:"",q:""};
function pSxNc(m){
  sxShape(D());const s=SX(),L=s.requests.filter(r=>(!SXF.st||r.st===SXF.st)&&(!SXF.q||(r.id+" "+sxP(r.sp).ten).toLowerCase().includes(SXF.q.toLowerCase()))).slice().reverse();
  sxFrame(m,"sx_nc","Nhu cầu sản xuất","Thảo ghi việc cần làm cho xưởng · số lượng có thể để trống · một nhu cầu có thể gắn nhiều lô",`
  <div class="filters"><select id="nc-st">${opt([["","Mọi trạng thái"]].concat(Object.entries(SX_REQ_ST).map(([k,v])=>[k,v[0]])),SXF.st)}</select><input id="nc-q" placeholder="Tìm mã, sản phẩm…" value="${esc(SXF.q)}"></div>
  <section class="card flush">${tbl(["Mã","Sản phẩm","SL đề nghị","Nguồn","Ưu tiên","Hạn cần","Người tạo","Lô đã làm","Trạng thái",""],L.map(r=>`<tr data-sxr="${r.id}" class="clk"><td class="mono">${r.id}</td><td><b>${esc(sxP(r.sp).ten)}</b>${r.ghiChu?`<small>${esc(r.ghiChu)}</small>`:""}</td><td class="n">${r.sl?nf(r.sl):"<i class='muted'>chưa chốt</i>"}</td><td>${esc(r.nguon)}</td><td>${r.uu==="Gấp"?pill("Gấp","red"):esc(r.uu)}</td><td>${sxDd(r.han)}</td><td>${esc(r.tao)}</td><td class="n">${r.lots.length}</td><td>${sxStPill(SX_REQ_ST,r.st)}</td><td>${sxReqBtns(r)}</td></tr>`))}</section>`,
  sxCan("sx.dieuphoi")?`<button class="btn pri" id="sx-new">+ Ghi nhận nhu cầu</button>`:"");
  sxBindCommon(m);sxBindReqBtns(m);
  $("#nc-st").onchange=e=>{SXF.st=e.target.value;renderMain()};$("#nc-q").onchange=e=>{SXF.q=e.target.value;renderMain()};
  if($("#sx-new"))$("#sx-new").onclick=()=>sxReqForm();
}
function sxReqBtns(r){const x=[];if(r.st==="CAN_LAM"&&(sxCan("sx.xuong")||sxCan("sx.dieuphoi")))x.push(`<button class="btn sm" data-rs="${r.id}">Bắt đầu</button>`);if((r.st==="DANG_LAM"||r.st==="CAN_LAM")&&(sxCan("sx.xuong")||sxCan("sx.dieuphoi")))x.push(`<button class="btn sm pri" data-rd="${r.id}">Báo hoàn thành</button>`);return x.join(" ")}
function sxBindReqBtns(m){
  m.querySelectorAll("[data-rs]").forEach(b=>b.onclick=()=>{const id=b.dataset.rs;sxMut(`bắt đầu ${id}`,s=>{const r=s.requests.find(x=>x.id===id);r.st="DANG_LAM";r.batDau=sxNow();r.hist.push({at:sxNow(),by:ME.name,act:"Xưởng bắt đầu làm"})});toast("Đã chuyển sang Đang làm");renderMain()});
  m.querySelectorAll("[data-rd]").forEach(b=>b.onclick=()=>sxDoneForm(b.dataset.rd));
}
function sxProdOpts(v){return opt([["","— chọn sản phẩm"]].concat(SX().products.filter(p=>p.active!==false).map(p=>[p.ma,p.ten])),v)}
function sxReqForm(id){
  const s=SX(),r=id?s.requests.find(x=>x.id===id):null;
  openDrawerHTML(`<h2>${r?"Sửa nhu cầu "+r.id:"Ghi nhận nhu cầu sản xuất"}</h2><form class="frm" id="ncf"><label class="field">Sản phẩm<select id="nc-sp" required>${sxProdOpts(r?r.sp:"")}</select></label><div class="row4"><label class="field">Số lượng đề nghị<input id="nc-sl" type="number" min="1" placeholder="để trống nếu chưa chốt" value="${r&&r.sl?r.sl:""}"></label><label class="field">Ưu tiên<select id="nc-uu">${opt(["Bình thường","Gấp"],r?r.uu:"Bình thường")}</select></label></div><div class="row4"><label class="field">Nguồn nhu cầu<select id="nc-ng">${opt(SX_NGUON,r?r.nguon:"Thiếu hàng")}</select></label><label class="field">Hạn cần hàng<input id="nc-han" type="date" value="${r?r.han:""}"></label></div><label class="field">Ghi chú cho xưởng<textarea id="nc-gc" rows="2">${esc(r?r.ghiChu:"")}</textarea></label><button class="btn pri big">${r?"Lưu":"Ghi nhận"}</button></form>`);
  $("#ncf").onsubmit=e=>{e.preventDefault();const v={sp:$("#nc-sp").value,sl:+$("#nc-sl").value||null,uu:$("#nc-uu").value,nguon:$("#nc-ng").value,han:$("#nc-han").value,ghiChu:$("#nc-gc").value.trim()};if(!v.sp){toast("Chọn sản phẩm");return}
    let code="";sxMut(r?`sửa nhu cầu ${r.id}`:`ghi nhận nhu cầu ${sxP(v.sp).ten}`,s2=>{if(r){Object.assign(s2.requests.find(x=>x.id===r.id),v);s2.requests.find(x=>x.id===r.id).hist.push({at:sxNow(),by:ME.name,act:"Sửa nhu cầu"});return}code=sxReqCode(s2);s2.requests.push({id:code,...v,st:"CAN_LAM",tao:ME.name,taoLuc:sxToday(),batDau:"",lots:[],hist:[{at:sxNow(),by:ME.name,act:"Tạo nhu cầu"}]})});closeDrawer();toast(r?"Đã lưu":"Đã ghi nhận "+code);renderMain()};
}
function sxReqDetail(id){
  const s=SX(),r=s.requests.find(x=>x.id===id);if(!r)return;const lots=s.batches.filter(b=>r.lots.includes(b.id));
  openDrawerHTML(`<h2>${esc(sxP(r.sp).ten)}</h2><p class="mono">${r.id} ${sxStPill(SX_REQ_ST,r.st)}</p>${tbl(["",""],[["SL đề nghị",r.sl?nf(r.sl):"chưa chốt"],["Nguồn",r.nguon],["Ưu tiên",r.uu],["Hạn cần",sxDd(r.han)],["Người tạo",r.tao+" · "+sxDd(r.taoLuc)],["Ghi chú",r.ghiChu||"—"]].map(([a,b])=>`<tr><td>${a}</td><td><b>${esc(String(b))}</b></td></tr>`))}<h3>Lô đã làm</h3>${lots.length?tbl(["Lô","Ngày","Xưởng báo","Đạt","Trạng thái"],lots.map(b=>`<tr><td class="mono">${esc(b.ma||"(chưa kiểm)")}</td><td>${sxDd(b.ngay)}</td><td class="n">${nf(b.baoSL)}</td><td class="n">${b.dat?nf(b.dat):"—"}</td><td>${sxStPill(SX_LOT_ST,b.st)}</td></tr>`)):`<p class="empty">Chưa có lô.</p>`}<h3>Lịch sử</h3><div class="sxlog">${r.hist.slice().reverse().map(h=>`<div><b>${esc(h.by)}</b> ${esc(h.act)}<small>${esc(h.at)}</small></div>`).join("")}</div><div class="acts">${sxReqBtns(r)}${sxCan("sx.dieuphoi")&&r.st!=="HOAN_TAT"&&r.st!=="HUY"?`<button class="btn" id="rq-ed">Sửa</button><button class="btn" id="rq-close">Đóng nhu cầu</button><button class="btn danger" id="rq-x">Hủy</button>`:""}</div>`);
  const dr=$("#drawerIn");dr.querySelectorAll("[data-rs]").forEach(b=>b.onclick=()=>{closeDrawer();sxMut(`bắt đầu ${id}`,s2=>{const x=s2.requests.find(y=>y.id===id);x.st="DANG_LAM";x.batDau=sxNow();x.hist.push({at:sxNow(),by:ME.name,act:"Xưởng bắt đầu làm"})});renderMain()});
  dr.querySelectorAll("[data-rd]").forEach(b=>b.onclick=()=>sxDoneForm(id));
  if($("#rq-ed"))$("#rq-ed").onclick=()=>sxReqForm(id);
  if($("#rq-close"))$("#rq-close").onclick=()=>{sxMut(`đóng nhu cầu ${id}`,s2=>{const x=s2.requests.find(y=>y.id===id);x.st="HOAN_TAT";x.hist.push({at:sxNow(),by:ME.name,act:"Đóng nhu cầu"})});closeDrawer();renderMain()};
  if($("#rq-x"))$("#rq-x").onclick=()=>{const ly=prompt("Lý do hủy nhu cầu?");if(!ly)return;sxMut(`hủy nhu cầu ${id}`,s2=>{const x=s2.requests.find(y=>y.id===id);x.st="HUY";x.hist.push({at:sxNow(),by:ME.name,act:"Hủy: "+ly})});closeDrawer();renderMain()};
}
/* Xưởng báo hoàn thành: số tổ tự báo chưa phải số nhập kho, chuyển sang Chờ kế toán kiểm. */
function sxPeoplePick(sel=[]){return `<div class="phc">${SX().people.map(p=>`<label class="ck sm"><input type="checkbox" name="sxng" value="${esc(p.ten)}" ${sel.includes(p.ten)?"checked":""}> ${esc(p.ten)}<small class="muted"> ${esc(p.viTri||"")}</small></label>`).join("")||`<span class="hint">Chưa có danh sách nhân sự xưởng (Cài đặt › Hồ sơ nhân sự).</span>`}</div>`}
function sxDoneForm(reqId){
  const s=SX(),r=reqId?s.requests.find(x=>x.id===reqId):null;
  openDrawerHTML(`<h2>Báo hoàn thành${r?" · "+esc(sxP(r.sp).ten):""}</h2><p class="hint">Số tổ tự báo chưa phải số nhập kho. Kế toán sẽ kiểm đếm lại.</p><form class="frm" id="sdf">${r?"":`<label class="field">Sản phẩm<select id="sd-sp" required>${sxProdOpts("")}</select></label>`}<div class="row4"><label class="field">Ngày sản xuất<input id="sd-ng" type="date" value="${sxToday()}" required></label><label class="field">Số lượng tổ báo<input id="sd-sl" type="number" min="1" required value="${r&&r.sl?r.sl:""}"></label></div><label class="field">Nhân sự thực hiện</label>${sxPeoplePick()}<label class="field">Ghi chú<input id="sd-gc"></label>${r?`<label class="ck"><input type="checkbox" id="sd-con"> Nhu cầu này còn làm tiếp (chưa xong hết)</label>`:""}<button class="btn pri big" id="sd-go">Báo hoàn thành</button></form>`);
  $("#sdf").onsubmit=e=>{e.preventDefault();const btn=$("#sd-go");if(btn.disabled)return;btn.disabled=true;const ng=[...$$("#sdf [name=sxng]:checked")].map(x=>x.value),sp=r?r.sp:$("#sd-sp").value,sl=+$("#sd-sl").value;if(!sp||!sl){toast("Thiếu sản phẩm hoặc số lượng");btn.disabled=false;return}
    const id="B-"+Date.now().toString(36)+Math.floor(Math.random()*99);const con=$("#sd-con")&&$("#sd-con").checked;
    sxMut(`xưởng báo hoàn thành ${sxP(sp).ten}: ${sl}`,s2=>{s2.batches.push({id,ma:"",req:r?r.id:"",sp,ngay:$("#sd-ng").value,nguoi:ng,baoSL:sl,baoLuc:sxNow(),baoBy:ME.name,tong:0,dat:0,loi:0,cho:0,ghiChu:$("#sd-gc").value.trim(),lechLyDo:"",kiemBy:"",kiemLuc:"",st:"CHO_KIEM",ver:1,containers:[],hist:[{at:sxNow(),by:ME.name,act:"Xưởng báo hoàn thành "+sl}],nvlTru:false,phatSinh:!r});if(r){const x=s2.requests.find(y=>y.id===r.id);x.lots.push(id);x.st=con?"DANG_LAM":"CHO_KIEM";x.hist.push({at:sxNow(),by:ME.name,act:`Báo hoàn thành ${sl}${con?" (còn làm tiếp)":""}`})}});
    closeDrawer();toast("Đã báo kế toán kiểm kê");renderMain()};
}

/* ---------- 3. TIẾN ĐỘ XƯỞNG (Kanban) ---------- */
function pSxTd(m){
  sxShape(D());const s=SX();
  const cards=[...s.requests.filter(r=>r.st==="CAN_LAM"||r.st==="DANG_LAM").map(r=>({k:r.st,html:`<div class="sxmini" data-sxr="${r.id}"><b>${esc(sxP(r.sp).ten)}</b><div>${pill(r.nguon,"gry")} ${r.uu==="Gấp"?pill("Gấp","red"):""}</div><small>${r.id} · SL ${r.sl?nf(r.sl):"chưa chốt"}${r.batDau?" · bắt đầu "+esc(r.batDau):""}</small><div class="acts">${sxReqBtns(r)}</div></div>`})),
   ...s.batches.filter(b=>b.st!=="HUY").map(b=>({k:b.st==="CHO_KIEM"?"CHO_KIEM":"XONG",html:`<div class="sxmini" data-sxb="${b.id}"><b>${esc(sxP(b.sp).ten)}</b><small>${b.ma?"Lô "+esc(b.ma)+" · ":""}${sxDd(b.ngay)} · ${esc(sxNames(b))}</small><div class="sxnums"><span>Xưởng báo <b>${nf(b.baoSL)}</b></span>${b.st!=="CHO_KIEM"?`<span>Kế toán kiểm <b>${nf(b.tong)}</b></span><span>Đạt <b class="ok">${nf(b.dat)}</b></span>`:""}</div>${b.st==="CHO_KIEM"&&sxCan("sx.kiemke")?`<button class="btn sm pri" data-kk="${b.id}">Kiểm kê</button>`:sxStPill(SX_LOT_ST,b.st)}</div>`}))];
  const colDef=[["CAN_LAM","Cần làm","pnk"],["DANG_LAM","Đang làm","grn"],["CHO_KIEM","Chờ kế toán kiểm","org"],["XONG","Đã kiểm","blu"]];
  sxFrame(m,"sx_td","Tiến độ xưởng","Cần làm → Đang làm → Chờ kế toán kiểm → Đã kiểm · tách rõ số xưởng tự báo và số kế toán xác nhận",`<div class="sxcols big">${colDef.map(([k,t,c])=>{const L=cards.filter(x=>x.k===k);return `<div class="sxcol c-${c}"><h3>${t} (${L.length})</h3>${L.map(x=>x.html).join("")||`<p class="empty">—</p>`}</div>`}).join("")}</div>`,
  (sxCan("sx.xuong")||sxCan("sx.dieuphoi")?`<button class="btn" id="sx-done0">Báo hoàn thành (không có nhu cầu)</button>`:"")+(sxCan("sx.dieuphoi")?`<button class="btn pri" id="sx-new">+ Ghi nhận nhu cầu</button>`:""));
  sxBindCommon(m);sxBindReqBtns(m);if($("#sx-new"))$("#sx-new").onclick=()=>sxReqForm();if($("#sx-done0"))$("#sx-done0").onclick=()=>sxDoneForm(null);
}

/* ---------- 4. KIỂM KÊ – LÔ & TEM ---------- */
let SXL={st:"",q:""};
function pSxLo(m){
  sxShape(D());const s=SX();
  const hash=location.hash.match(/^#lo=([^&]+)(?:&c=(\w+))?/);if(hash){const b=s.batches.find(x=>x.ma===decodeURIComponent(hash[1]));history.replaceState(null,"",location.pathname);if(b)setTimeout(()=>sxLotDetail(b.id,hash[2]),50)}
  const L=s.batches.filter(b=>(!SXL.st||b.st===SXL.st)&&(!SXL.q||((b.ma||"")+" "+sxP(b.sp).ten).toLowerCase().includes(SXL.q.toLowerCase()))).slice().reverse();
  const cnt=k=>s.batches.filter(b=>b.st===k).length;
  sxFrame(m,"sx_lo","Kiểm kê – Lô & Tem","Kế toán kiểm đếm thực tế, tạo mã lô, chia thùng/khay, in tem QR, nhập kho hoặc bàn giao khu đóng đơn",`
  <div class="sxkpis s4">${[["clock","Chờ kiểm kê",cnt("CHO_KIEM"),"org"],["task","Chờ phân bổ",cnt("DA_KIEM"),"blu"],["check","Đã tạo tem, chờ in",cnt("TEM_SAN"),"vio"],["box","Đã in, chờ nhập kho",cnt("DA_IN"),"grn"]].map(([ic,l,v,c])=>`<div class="sxk t-${c}"><i>${ico(ic)}</i><span><small>${l}</small><b>${v}</b></span></div>`).join("")}</div>
  <div class="filters"><div class="chips">${[["","Tất cả"]].concat(Object.entries(SX_LOT_ST).map(([k,v])=>[k,v[0]])).map(([k,t])=>`<button class="chip${SXL.st===k?" on":""}" data-lst="${k}">${t}${k?" ("+cnt(k)+")":" ("+s.batches.length+")"}</button>`).join("")}</div><input id="lo-q" placeholder="Tìm mã lô, sản phẩm…" value="${esc(SXL.q)}"></div>
  <section class="card flush">${tbl(["Mã lô","Ngày SX","Sản phẩm","Nhân sự","Xưởng báo","Kiểm / Đạt","Lỗi / Chờ","Vật chứa","Trạng thái",""],L.map(b=>{const ok=b.containers.filter(c=>c.st==="OK");return `<tr class="clk" data-sxb="${b.id}"><td class="mono">${esc(b.ma||"—")}${b.phatSinh?`<small>phát sinh</small>`:""}</td><td>${sxDd(b.ngay)}</td><td><b>${esc(sxP(b.sp).ten)}</b></td><td>${esc(sxNames(b))}</td><td class="n">${nf(b.baoSL)}</td><td class="n">${b.tong?nf(b.tong)+" / <b>"+nf(b.dat)+"</b>":"—"}</td><td class="n">${b.tong?`<span class="bad">${nf(b.loi)}</span> / <span class="warn">${nf(b.cho)}</span>`:"—"}</td><td>${ok.length?sxContSum(ok):"—"}</td><td>${sxStPill(SX_LOT_ST,b.st)}</td><td>${sxLotBtn(b)}</td></tr>`}))}</section>`,
  sxCan("sx.kiemke")?`<button class="btn pri" id="lo-new">+ Kiểm kê phát sinh</button>`:"");
  sxBindCommon(m);
  m.querySelectorAll("[data-lst]").forEach(b=>b.onclick=()=>{SXL.st=b.dataset.lst;renderMain()});$("#lo-q").onchange=e=>{SXL.q=e.target.value;renderMain()};
  m.querySelectorAll("[data-la]").forEach(b=>b.onclick=()=>sxAlloc(b.dataset.la));m.querySelectorAll("[data-lp]").forEach(b=>b.onclick=()=>sxLotDetail(b.dataset.lp));m.querySelectorAll("[data-ln]").forEach(b=>b.onclick=()=>sxStockIn(b.dataset.ln));
  if($("#lo-new"))$("#lo-new").onclick=()=>sxInspect(null);
}
const sxContSum=L=>{const g={};L.forEach(c=>{const k=c.loai;g[k]=g[k]||{n:0,sl:0};g[k].n++;g[k].sl+=c.sl});return Object.entries(g).map(([k,v])=>`${v.n} ${k.toLowerCase()} · ${nf(v.sl)}`).join(" + ")};
function sxLotBtn(b){if(!sxCan("sx.kiemke"))return "";return b.st==="CHO_KIEM"?`<button class="btn sm pri" data-kk="${b.id}">Kiểm kê</button>`:b.st==="DA_KIEM"?`<button class="btn sm pri" data-la="${b.id}">Phân bổ</button>`:b.st==="TEM_SAN"?`<button class="btn sm pri" data-lp="${b.id}">In tem</button>`:b.st==="DA_IN"?`<button class="btn sm pri" data-ln="${b.id}">Nhập kho</button>`:""}

/* Kế toán kiểm kê: bắt buộc Tổng = Đạt + Lỗi + Chờ; lệch với số xưởng báo thì phải ghi lý do. */
function sxInspect(id,reopen){
  const s=SX(),b=id?s.batches.find(x=>x.id===id):null;
  if(!sxCan("sx.kiemke")){toast("Chỉ kế toán kho (quyền Kiểm kê) mới xác nhận được");return}
  openDrawerHTML(`<h2>${reopen?"Điều chỉnh kiểm kê lô "+esc(b.ma):"Kiểm kê thành phẩm"}</h2>${b?`<p><b>${esc(sxP(b.sp).ten)}</b> · ${sxDd(b.ngay)} · ${esc(sxNames(b))}<br><span class="hint">Xưởng tự báo: <b>${nf(b.baoSL)}</b>${b.req?" · nhu cầu "+esc(b.req):""}</span></p>`:`<p class="hint">Hàng xưởng làm mà chưa có nhu cầu trước đó: lô được đánh dấu "phát sinh".</p>`}
  <form class="frm" id="kkf">${b?"":`<label class="field">Sản phẩm<select id="kk-sp" required>${sxProdOpts("")}</select></label><div class="row4"><label class="field">Ngày sản xuất<input id="kk-ng" type="date" value="${sxToday()}"></label><label class="field">Số tổ báo<input id="kk-bao" type="number" min="0"></label></div><label class="field">Nhân sự thực hiện</label>${sxPeoplePick()}`}
  <div class="row4"><label class="field">Tổng kiểm đếm<input id="kk-t" type="number" min="0" required value="${b&&b.tong?b.tong:""}"></label><label class="field">Đạt<input id="kk-d" type="number" min="0" required value="${b&&b.tong?b.dat:""}"></label><label class="field">Lỗi<input id="kk-l" type="number" min="0" required value="${b&&b.tong?b.loi:0}"></label><label class="field">Chờ xử lý<input id="kk-c" type="number" min="0" required value="${b&&b.tong?b.cho:0}"></label></div>
  <div id="kk-chk" class="sxchk"></div>
  <label class="field">Ghi chú lỗi / chờ xử lý<input id="kk-gc" value="${esc(b?b.ghiChu:"")}"></label><label class="field" id="kk-lyw" hidden>Lý do chênh lệch với số xưởng báo<input id="kk-ly" value="${esc(b?b.lechLyDo:"")}"></label>${reopen?`<label class="field">Lý do điều chỉnh (bắt buộc)<input id="kk-rl" required></label>`:""}
  <button class="btn pri big" id="kk-go">${reopen?"Lưu điều chỉnh":"Xác nhận kiểm kê & tạo mã lô"}</button></form>`);
  const v=i=>+($(i).value||0),chk=()=>{const T=v("#kk-t"),D_=v("#kk-d"),L=v("#kk-l"),C=v("#kk-c"),okEq=T===D_+L+C,bao=b?b.baoSL:v("#kk-bao"),lech=bao&&T!==bao;$("#kk-chk").innerHTML=`<span class="${okEq?"ok":"bad"}">${okEq?"✓":"✗"} Tổng ${nf(T)} ${okEq?"=":"≠"} Đạt ${nf(D_)} + Lỗi ${nf(L)} + Chờ ${nf(C)}</span>${lech?`<span class="warn">⚠ Lệch số xưởng báo ${nf(bao)}: ${T-bao>0?"+":""}${nf(T-bao)}</span>`:""}`;$("#kk-lyw").hidden=!lech;return {T,D_,L,C,okEq,lech}};
  ["#kk-t","#kk-d","#kk-l","#kk-c"].concat(b?[]:["#kk-bao"]).forEach(i=>$(i).oninput=chk);chk();
  $("#kkf").onsubmit=e=>{e.preventDefault();const btn=$("#kk-go");if(btn.disabled)return;const c=chk();if(!c.okEq){toast("Tổng kiểm đếm phải bằng Đạt + Lỗi + Chờ xử lý");return}if(c.lech&&!$("#kk-ly").value.trim()){toast("Ghi lý do chênh lệch với số xưởng báo");return}
    btn.disabled=true;let code="";const now=sxNow();
    sxMut(reopen?`điều chỉnh kiểm kê lô ${b.ma}`:"kiểm kê thành phẩm",s2=>{
      let x=b?s2.batches.find(y=>y.id===b.id):null;
      if(!x){const sp=$("#kk-sp").value;x={id:"B-"+Date.now().toString(36),ma:"",req:"",sp,ngay:$("#kk-ng").value,nguoi:[...$$("#kkf [name=sxng]:checked")].map(y=>y.value),baoSL:v("#kk-bao"),baoLuc:now,baoBy:"",tong:0,dat:0,loi:0,cho:0,ghiChu:"",lechLyDo:"",kiemBy:"",kiemLuc:"",st:"CHO_KIEM",ver:1,containers:[],hist:[],nvlTru:false,phatSinh:true};s2.batches.push(x)}
      if(x.st!=="CHO_KIEM"&&!reopen)return; // bấm hai lần: không xử lý lại
      Object.assign(x,{tong:c.T,dat:c.D_,loi:c.L,cho:c.C,ghiChu:$("#kk-gc").value.trim(),lechLyDo:c.lech?$("#kk-ly").value.trim():"",kiemBy:ME.name,kiemLuc:now});
      if(reopen){x.ver++;x.containers.forEach(cn=>{if(cn.st==="OK")cn.st="VOID"});x.st="DA_KIEM";x.hist.push({at:now,by:ME.name,act:`Điều chỉnh kiểm kê (bản ${x.ver}): ${c.T} = ${c.D_} + ${c.L} + ${c.C}. Lý do: ${$("#kk-rl").value.trim()}. Tem cũ hết hiệu lực.`});code=x.ma;return}
      if(!x.ma)x.ma=sxLotCode(s2,x.sp,x.ngay);code=x.ma;x.st="DA_KIEM";x.hist.push({at:now,by:ME.name,act:`Kiểm kê ${c.T} = ${c.D_} đạt + ${c.L} lỗi + ${c.C} chờ, tạo lô ${x.ma}${c.lech?" · lệch số xưởng báo: "+x.lechLyDo:""}`});
      if(x.req){const r=s2.requests.find(y=>y.id===x.req);if(r&&r.st==="CHO_KIEM"){r.st="HOAN_TAT";r.hist.push({at:now,by:ME.name,act:"Kế toán kiểm kê xong lô "+x.ma})}}
    });
    closeDrawer();toast((reopen?"Đã điều chỉnh lô ":"Đã tạo lô ")+code+". Tiếp: phân bổ thùng/khay");renderMain();const nb=SX().batches.find(y=>y.ma===code);if(nb)setTimeout(()=>sxAlloc(nb.id),200)};
}
/* Phân bổ hàng đạt vào thùng / khay / kệ: tổng phân bổ phải bằng số đạt. */
function sxAlloc(id){
  const s=SX(),b=s.batches.find(x=>x.id===id),p=sxP(b.sp),bx=p.thung||s.cfg.boxDefault||50;
  const nThung=Math.floor(b.dat/bx),du=b.dat-nThung*bx;
  openDrawerHTML(`<h2>Phân bổ lô ${esc(b.ma)}</h2><p><b>${esc(p.ten)}</b> · cần chia <b>${nf(b.dat)}</b> sản phẩm đạt</p><form class="frm" id="paf"><div id="pa-rows"></div><button type="button" class="btn sm" id="pa-add">+ Thêm dòng</button><div id="pa-chk" class="sxchk"></div><button class="btn pri big" id="pa-go">Lưu phân bổ & tạo tem</button></form><p class="hint">Mỗi dòng có thể là nhiều vật chứa giống nhau, ví dụ 8 thùng × 50. Khay hàng lẻ: tem ghi "Số lượng bàn giao ban đầu".</p>`);
  const rows=[{loai:"Thùng",n:nThung,sl:bx,viTri:"Kho A"}];if(du)rows.push({loai:"Khay",n:1,sl:du,viTri:""});
  const draw=()=>{$("#pa-rows").innerHTML=rows.map((r,i)=>`<div class="row7 parow"><label class="field">Loại<select data-pf="loai" data-pi="${i}">${opt(SX_LOAI_VC,r.loai)}</select></label><label class="field">Số vật chứa<input type="number" min="1" data-pf="n" data-pi="${i}" value="${r.n}"></label><label class="field">SL mỗi cái<input type="number" min="1" data-pf="sl" data-pi="${i}" value="${r.sl}"></label><label class="field grow">Vị trí / ghi chú<input data-pf="viTri" data-pi="${i}" value="${esc(r.viTri)}" placeholder="${r.loai==="Thùng"?"Kho A":"A03 · khu đóng đơn"}"></label><button type="button" class="btn sm danger" data-px="${i}">×</button></div>`).join("");
    $$("#pa-rows [data-pf]").forEach(x=>x.oninput=()=>{const r=rows[+x.dataset.pi],f=x.dataset.pf;r[f]=f==="n"||f==="sl"?+x.value||0:x.value;chk()});$$("#pa-rows [data-px]").forEach(x=>x.onclick=()=>{rows.splice(+x.dataset.px,1);draw()});chk()};
  const chk=()=>{const t=sum(rows,r=>r.n*r.sl),ok=t===b.dat;$("#pa-chk").innerHTML=`<span class="${ok?"ok":"bad"}">${ok?"✓":"✗"} Tổng phân bổ ${nf(t)} ${ok?"=":"≠"} số đạt ${nf(b.dat)}</span> <span class="hint">${sum(rows,r=>r.n)} vật chứa = ${sum(rows,r=>r.n)} tem</span>`;return ok};
  $("#pa-add").onclick=()=>{rows.push({loai:"Khay",n:1,sl:0,viTri:""});draw()};draw();
  $("#paf").onsubmit=e=>{e.preventDefault();const btn=$("#pa-go");if(btn.disabled)return;if(!chk()){toast("Tổng phân bổ phải bằng số đạt");return}if(rows.some(r=>r.n<1||r.sl<1)){toast("Số vật chứa và số lượng phải lớn hơn 0");return}btn.disabled=true;
    sxMut(`phân bổ lô ${b.ma}`,s2=>{const x=s2.batches.find(y=>y.id===id);if(x.st!=="DA_KIEM")return;const old=x.containers.length;let k=old;rows.forEach(r=>{for(let j=0;j<r.n;j++){k++;x.containers.push({c:"c"+sxPad(k),loai:r.loai,sl:r.sl,viTri:r.viTri,st:"OK",in:[]})}});x.st="TEM_SAN";x.hist.push({at:sxNow(),by:ME.name,act:`Phân bổ ${rows.map(r=>`${r.n} ${r.loai.toLowerCase()} × ${r.sl}${r.viTri?" ("+r.viTri+")":""}`).join(" + ")}, tạo ${k-old} tem`})});
    closeDrawer();toast("Đã tạo tem. Xem trước rồi bấm Xác nhận in");sxLotDetail(id)};
}
/* Tem: logo, sản phẩm, mã lô, NSX, nhân sự, "Đã kiểm kê", vật chứa x/y, số lượng, vị trí, QR dẫn về đúng lô + vật chứa. */
function sxQrUrl(b,c){return `${location.origin}/hub/#lo=${encodeURIComponent(b.ma)}&c=${c.c}`}
function sxQr(text,px){try{if(typeof qrcode!=="function")return `<div class="qrph">QR</div>`;const q=qrcode(0,"M");q.addData(text);q.make();return q.createSvgTag({cellSize:Math.max(2,Math.floor(px/(q.getModuleCount()+2))),margin:1,scalable:true})}catch(e){return `<div class="qrph">QR</div>`}}
function sxLabel(b,c,mini){
  const ok=b.containers.filter(x=>x.st==="OK"),idx=ok.indexOf(c)+1,tot=ok.length,khay=c.loai!=="Thùng",p=sxP(b.sp);
  return `<div class="lbl${mini?" mini":""}"><div class="lbl-l"><img src="data:image/png;base64,${LOGO}" alt="AILLA"><div class="lbl-st">THÀNH PHẨM ĐÃ KIỂM KÊ</div><div class="lbl-sp">${esc(p.ten)}</div><div class="lbl-row"><span>Mã lô</span><b>${esc(b.ma)}</b></div><div class="lbl-row"><span>Ngày SX</span><b>${sxDd(b.ngay)}</b></div><div class="lbl-row"><span>Nhân sự</span><b>${esc(sxNames(b))}</b></div><div class="lbl-big">${esc(c.loai)} ${sxPad(idx)}/${sxPad(tot)}</div><div class="lbl-row"><span>${khay?"Số lượng bàn giao ban đầu":"Số lượng trong "+c.loai.toLowerCase()}</span><b class="lbl-sl">${nf(c.sl)}</b></div>${c.viTri?`<div class="lbl-row"><span>Vị trí</span><b>${esc(c.viTri)}</b></div>`:""}</div><div class="lbl-r">${sxQr(sxQrUrl(b,c),mini?90:140)}<small>${esc(b.ma)} · ${c.c}</small>${b.ver>1?`<small>bản ${b.ver}</small>`:""}</div></div>`;
}
function sxLotDetail(id,focusC){
  const s=SX(),b=s.batches.find(x=>x.id===id);if(!b)return;const p=sxP(b.sp),ok=b.containers.filter(c=>c.st==="OK"),voided=b.containers.filter(c=>c.st==="VOID"),kk=sxCan("sx.kiemke");
  const prints=b.containers.flatMap(c=>c.in.map(x=>({...x,c:c.c}))).sort((a,b2)=>String(b2.at).localeCompare(String(a.at)));
  crmModal(`Lô ${esc(b.ma||"(chưa kiểm kê)")} ${sxStPill(SX_LOT_ST,b.st)}`,`<div class="sxlot"><div class="sxlot-l">${tbl(["",""],[["Sản phẩm",p.ten],["Ngày sản xuất",sxDd(b.ngay)],["Nhân sự",sxNames(b)],["Nhu cầu",b.req||(b.phatSinh?"Phát sinh, chưa có nhu cầu trước":"—")],["Xưởng tự báo",nf(b.baoSL)],["Kế toán kiểm",b.tong?`${nf(b.tong)} · ${b.kiemBy} · ${b.kiemLuc}`:"chưa kiểm"]].map(([a,c])=>`<tr><td>${a}</td><td><b>${esc(String(c))}</b></td></tr>`))}
  ${b.tong?`<div class="sxkpis s3"><div class="sxk t-grn"><span><small>Đạt</small><b>${nf(b.dat)}</b></span></div><div class="sxk t-red"><span><small>Lỗi</small><b>${nf(b.loi)}</b></span></div><div class="sxk t-org"><span><small>Chờ xử lý</small><b>${nf(b.cho)}</b></span></div></div>${b.ghiChu?`<p class="hint">Ghi chú: ${esc(b.ghiChu)}</p>`:""}${b.lechLyDo?`<p class="hint">Lệch số xưởng báo: ${esc(b.lechLyDo)}</p>`:""}`:""}
  ${ok.length?`<h3>Phân bổ</h3>${tbl(["Mã","Vật chứa","SL","Vị trí","Đã in"],ok.map((c,i)=>`<tr><td class="mono">${c.c}</td><td>${c.loai} ${sxPad(i+1)}/${sxPad(ok.length)}</td><td class="n">${nf(c.sl)}</td><td>${esc(c.viTri||"—")}</td><td class="n">${c.in.length?c.in.length+" lần":"—"}</td></tr>`))}`:""}
  ${voided.length?`<p class="hint">${voided.length} tem cũ đã hết hiệu lực do điều chỉnh.</p>`:""}
  <h3>Lịch sử</h3><div class="sxlog">${b.hist.slice().reverse().map(h=>`<div><b>${esc(h.by)}</b> ${esc(h.act)}<small>${esc(h.at)}</small></div>`).join("")}</div>
  ${prints.length?`<h3>Lịch sử in</h3><div class="sxlog">${prints.map(x=>`<div><b>${esc(x.by)}</b> in ${x.c}${x.lyDo?" · lý do: "+esc(x.lyDo):""}<small>${esc(x.at)}</small></div>`).join("")}</div>`:""}</div>
  <div class="sxlot-r">${ok.length?`<div class="lblgrid">${ok.map(c=>`<div class="${focusC===c.c?"lblfocus":""}">${sxLabel(b,c,true)}</div>`).join("")}</div>`:`<p class="empty">${b.st==="CHO_KIEM"?"Chưa kiểm kê nên chưa có tem.":"Chưa phân bổ thùng/khay."}</p>`}</div></div>
  <div class="acts">${kk&&b.st==="CHO_KIEM"?`<button class="btn pri" id="ld-kk">Kiểm kê</button>`:""}${kk&&b.st==="DA_KIEM"?`<button class="btn pri" id="ld-pa">Phân bổ & tạo tem</button>`:""}${kk&&ok.length&&b.st!=="HUY"?`<button class="btn ${b.st==="TEM_SAN"?"pri":""}" id="ld-in">${b.st==="TEM_SAN"?"Xác nhận in tem":"In lại tem"}</button>`:""}${kk&&b.st==="DA_IN"?`<button class="btn pri" id="ld-nk">Nhập kho / bàn giao</button>`:""}${kk&&b.tong&&b.st!=="HUY"?`<button class="btn" id="ld-dc">Điều chỉnh số</button>`:""}${kk&&b.st!=="HUY"&&b.st!=="SAN_SANG"?`<button class="btn danger" id="ld-x">Hủy lô</button>`:""}</div>`,true);
  const go=(sel,fn)=>{const e=$(sel);if(e)e.onclick=()=>{closeCM();fn()}};
  go("#ld-kk",()=>sxInspect(id));go("#ld-pa",()=>sxAlloc(id));go("#ld-nk",()=>sxStockIn(id));go("#ld-dc",()=>sxInspect(id,true));
  go("#ld-in",()=>sxPrint(id,b.st==="TEM_SAN"?"":null));
  go("#ld-x",()=>{const ly=prompt("Lý do hủy lô "+(b.ma||"")+"? (lô không bị xóa, chỉ đánh dấu hủy)");if(!ly)return;sxMut(`hủy lô ${b.ma}`,s2=>{const x=s2.batches.find(y=>y.id===id);x.st="HUY";x.containers.forEach(c=>c.st="VOID");x.hist.push({at:sxNow(),by:ME.name,act:"Hủy lô: "+ly})});renderMain()});
}
/* In tem: trình duyệt in đúng khổ tem cấu hình (Lưu thành PDF hoặc in thẳng). In lại bắt buộc có lý do. */
function sxPrint(id,lyDo){
  const s=SX(),b=s.batches.find(x=>x.id===id),ok=b.containers.filter(c=>c.st==="OK");
  if(lyDo===null){lyDo=prompt("Lý do in lại tem lô "+b.ma+"? (bắt buộc, ví dụ: tem rách, in mờ, dán nhầm)");if(!lyDo||!lyDo.trim()){toast("In lại phải có lý do");return}}
  const W=s.cfg.labelW||100,Hh=s.cfg.labelH||70;
  let st=$("#sxprintcss");if(!st){st=document.createElement("style");st.id="sxprintcss";document.head.appendChild(st)}
  st.textContent=`@media print{@page{size:${W}mm ${Hh}mm;margin:0}body.sxp>*:not(#sxprint){display:none!important}#sxprint{display:block!important}#sxprint .lbl{width:${W}mm;height:${Hh}mm;page-break-after:always;border:none;border-radius:0;margin:0}}`;
  let el=$("#sxprint");if(!el){el=document.createElement("div");el.id="sxprint";document.body.appendChild(el)}
  el.innerHTML=ok.map(c=>sxLabel(b,c,false)).join("");document.body.classList.add("sxp");
  const done=()=>{document.body.classList.remove("sxp");removeEventListener("afterprint",done)};addEventListener("afterprint",done);
  setTimeout(()=>{window.print();
    if(!confirm(`Đã in xong ${ok.length} tem lô ${b.ma}? Bấm OK để ghi nhận đã in.`))return;
    sxMut(`${lyDo?"in lại":"in"} ${ok.length} tem lô ${b.ma}`,s2=>{const x=s2.batches.find(y=>y.id===id);x.containers.filter(c=>c.st==="OK").forEach(c=>c.in.push({at:sxNow(),by:ME.name,lyDo:lyDo||""}));if(x.st==="TEM_SAN")x.st="DA_IN";x.hist.push({at:sxNow(),by:ME.name,act:`${lyDo?"In lại":"In"} ${ok.length} tem${lyDo?" · lý do: "+lyDo:""}`})});toast("Đã ghi nhận in tem");renderMain()},150);
}
/* Nhập kho / bàn giao: thùng vào kho, khay sang khu đóng đơn. Lỗi, chờ xử lý không cộng vào hàng bán được. */
function sxStockIn(id){
  const s=SX(),b=s.batches.find(x=>x.id===id),ok=b.containers.filter(c=>c.st==="OK"),th=ok.filter(c=>c.loai==="Thùng"),kh=ok.filter(c=>c.loai!=="Thùng");
  if(!confirm(`Lô ${b.ma}: nhập kho ${th.length} thùng (${nf(sum(th,c=>c.sl))} sp) và bàn giao khu đóng đơn ${kh.length} khay/kệ (${nf(sum(kh,c=>c.sl))} sp)?\nLỗi ${b.loi} và chờ xử lý ${b.cho} không tính vào hàng bán được.`))return;
  sxMut(`nhập kho / bàn giao lô ${b.ma}`,s2=>{const x=s2.batches.find(y=>y.id===id);if(x.st!=="DA_IN")return;x.st="SAN_SANG";const at=sxNow();x.containers.filter(c=>c.st==="OK").forEach(c=>s2.moves.push({at,by:ME.name,sp:x.sp,lot:x.ma,c:c.c,sl:c.sl,loai:c.loai==="Thùng"?"Nhập kho":"Bàn giao khu đóng đơn",den:c.viTri||""}));x.hist.push({at,by:ME.name,act:"Nhập kho thùng, bàn giao khay sang khu đóng đơn"})});
  toast("Đã nhập kho / bàn giao");renderMain();
}

/* ---------- 5. NGUYÊN VẬT LIỆU ---------- */
function pSxNvl(m){
  sxShape(D());const s=SX(),ed=sxCan("sx.kythuat")||sxCan("sx.kiemke"),tol=s.cfg.nvlTol||5;
  const lots=s.batches.filter(b=>b.ma&&b.st!=="HUY").slice().reverse();
  const rows=lots.map(b=>{const N=s.norms.filter(n=>n.sp===b.sp),U=s.usage.filter(u=>u.lot===b.id);return {b,N,U}});
  sxFrame(m,"sx_nvl","Nguyên vật liệu","Định mức theo sản phẩm · kỹ thuật nhập lượng dùng thực tế sau mẻ · chênh lệch không mặc định là sai phạm, chỉ cần ghi lý do",`
  <section class="card"><div class="card-h"><h2>Báo cáo nguyên vật liệu theo lô</h2><span class="hint">ngưỡng cảnh báo chênh lệch ±${tol}%</span></div>${tbl(["Lô","Sản phẩm","SL đạt","Vật liệu","Định mức × SL","Thực tế","Chênh lệch","Lý do","Kế toán trừ kho",""],rows.flatMap(({b,N,U})=>{if(!N.length&&!U.length)return [`<tr><td class="mono">${esc(b.ma)}</td><td>${esc(sxP(b.sp).ten)}</td><td class="n">${nf(b.dat)}</td><td colspan="6" class="muted">Chưa có định mức cho sản phẩm này</td><td>${ed?`<button class="btn sm" data-nu="${b.id}">Báo NVL</button>`:""}</td></tr>`];const mats=[...new Set(N.map(n=>n.vl).concat(U.map(u=>u.vl)))];return mats.map((vl,i)=>{const n=N.find(x=>x.vl===vl),u=U.find(x=>x.vl===vl),exp=n?n.dm*(b.tong||b.dat):null,act=u?u.tt:null,diff=exp&&act!=null?(act-exp)/exp*100:null;return `<tr><td class="mono">${i?"":esc(b.ma)}</td><td>${i?"":esc(sxP(b.sp).ten)}</td><td class="n">${i?"":nf(b.dat)}</td><td>${esc(vl)}</td><td class="n">${exp!=null?(+exp.toFixed(3))+" "+esc(n.dvt):"—"}</td><td class="n">${act!=null?act+" "+esc((n||u).dvt||""):`<span class="warn">chưa báo</span>`}</td><td class="n">${diff!=null?pill((diff>0?"+":"")+diff.toFixed(1)+"%",Math.abs(diff)>tol?"amb":"grn"):"—"}</td><td>${esc(u&&u.lyDo||"")}</td><td>${i?"":(b.nvlTru?pill("Đã trừ","grn"):sxCan("sx.kiemke")&&U.length?`<button class="btn sm" data-nt="${b.id}">Xác nhận trừ kho</button>`:"—")}</td><td>${i||!ed?"":`<button class="btn sm" data-nu="${b.id}">Báo NVL</button>`}</td></tr>`})}))}</section>
  <section class="card"><div class="card-h"><h2>Định mức theo sản phẩm</h2><span class="hint">nhập tay theo công thức hiện hành, chưa có định mức chuẩn chính thức</span></div>${tbl(["Sản phẩm","Vật liệu","Định mức / 1 sp","Đơn vị",""],s.norms.map((n,i)=>`<tr><td>${esc(sxP(n.sp).ten)}</td><td>${esc(n.vl)}</td><td class="n">${n.dm}</td><td>${esc(n.dvt)}</td><td>${ed?`<button class="btn sm danger" data-nx="${i}">Xóa</button>`:""}</td></tr>`))}
  ${ed?`<form class="frm row7" id="nmf"><label class="field">Sản phẩm<select id="nm-sp" required>${sxProdOpts("")}</select></label><label class="field grow">Vật liệu<input id="nm-vl" required></label><label class="field">Định mức / 1 sp<input id="nm-dm" type="number" step="any" required></label><label class="field">Đơn vị<input id="nm-dv" value="kg"></label><button class="btn pri">Thêm</button></form>`:""}</section>`);
  sxBindCommon(m);
  m.querySelectorAll("[data-nu]").forEach(b=>b.onclick=()=>sxUsageForm(b.dataset.nu));
  m.querySelectorAll("[data-nt]").forEach(b=>b.onclick=()=>{const id=b.dataset.nt;sxMut("xác nhận trừ kho NVL lô "+(s.batches.find(x=>x.id===id)||{}).ma,s2=>{const x=s2.batches.find(y=>y.id===id);x.nvlTru=true;x.hist.push({at:sxNow(),by:ME.name,act:"Kế toán xác nhận đã trừ kho nguyên vật liệu"})});renderMain()});
  m.querySelectorAll("[data-nx]").forEach(b=>b.onclick=()=>{sxMut("xóa định mức",s2=>s2.norms.splice(+b.dataset.nx,1));renderMain()});
  if($("#nmf"))$("#nmf").onsubmit=e=>{e.preventDefault();sxMut("thêm định mức "+$("#nm-vl").value,s2=>s2.norms.push({sp:$("#nm-sp").value,vl:$("#nm-vl").value.trim(),dm:+$("#nm-dm").value,dvt:$("#nm-dv").value.trim()}));renderMain()};
}
function sxUsageForm(id){
  const s=SX(),b=s.batches.find(x=>x.id===id),N=s.norms.filter(n=>n.sp===b.sp),U=s.usage.filter(u=>u.lot===id),mats=[...new Set(N.map(n=>n.vl).concat(U.map(u=>u.vl)))];
  openDrawerHTML(`<h2>Báo nguyên vật liệu · lô ${esc(b.ma)}</h2><p>${esc(sxP(b.sp).ten)} · kiểm ${nf(b.tong)} · đạt ${nf(b.dat)}</p><form class="frm" id="nuf">${mats.map((vl,i)=>{const n=N.find(x=>x.vl===vl),u=U.find(x=>x.vl===vl);return `<div class="row7"><label class="field grow">${esc(vl)}${n?` <small class="muted">định mức ${+(n.dm*(b.tong||b.dat)).toFixed(3)} ${esc(n.dvt)}</small>`:""}<input type="number" step="any" data-nv="${esc(vl)}" value="${u?u.tt:""}" placeholder="lượng dùng thực tế"></label><label class="field grow">Lý do chênh lệch<input data-nl="${esc(vl)}" value="${esc(u?u.lyDo:"")}"></label></div>`}).join("")}<div class="row7"><label class="field grow">Vật liệu khác<input id="nu-vl"></label><label class="field">Lượng<input id="nu-tt" type="number" step="any"></label><label class="field">Đơn vị<input id="nu-dv" value="kg"></label></div><label class="ck"><input type="checkbox" id="nu-ph" ${U.some(u=>u.phieu)?"checked":""}> Đã chụp / lưu phiếu giấy</label><button class="btn pri big">Lưu báo cáo</button></form>`);
  $("#nuf").onsubmit=e=>{e.preventDefault();const L=[...$$("#nuf [data-nv]")].filter(x=>x.value!=="").map(x=>({vl:x.dataset.nv,tt:+x.value,lyDo:($(`#nuf [data-nl="${CSS.escape(x.dataset.nv)}"]`)||{}).value||""}));if($("#nu-vl").value.trim()&&$("#nu-tt").value)L.push({vl:$("#nu-vl").value.trim(),tt:+$("#nu-tt").value,dvt:$("#nu-dv").value,lyDo:""});const ph=$("#nu-ph").checked;
    sxMut("báo NVL lô "+b.ma,s2=>{s2.usage=s2.usage.filter(u=>u.lot!==id).concat(L.map(u=>({...u,lot:id,by:ME.name,at:sxNow(),phieu:ph})))});closeDrawer();toast("Đã lưu");renderMain()};
}

/* ---------- 6. MUA HÀNG / ĐẶT NGOÀI ---------- */
const SX_MH_ST=["Đề nghị","Đã duyệt","Đã đặt","Đã về","Hủy"];
function pSxMh(m){
  sxShape(D());const s=SX(),ed=sxCan("sx.dieuphoi")||sxCan("sx.kiemke"),today=sxToday();
  sxFrame(m,"sx_mh","Mua hàng / Đặt ngoài","Nguyên vật liệu cần mua và hàng AILLA đặt bên ngoài thay vì tự sản xuất",`<section class="card flush">${tbl(["Mã","Loại","Mặt hàng","Số lượng","Nhà cung cấp","Ngày đặt","Dự kiến về","Người đề nghị","Trạng thái"],s.purchases.slice().reverse().map(p=>`<tr><td class="mono">${p.id}</td><td>${esc(p.loai)}</td><td><b>${esc(p.ten)}</b>${p.ghiChu?`<small>${esc(p.ghiChu)}</small>`:""}</td><td class="n">${nf(p.sl)} ${esc(p.dvt)}</td><td>${ed?`<input data-mf="ncc" data-mi="${p.id}" value="${esc(p.ncc)}" placeholder="—">`:esc(p.ncc||"—")}</td><td>${sxDd(p.ngayDat)}</td><td>${ed?`<input type="date" data-mf="ngayVe" data-mi="${p.id}" value="${p.ngayVe}">`:sxDd(p.ngayVe)}${p.st==="Đã đặt"&&p.ngayVe&&p.ngayVe<today?" "+pill("chậm","red"):""}</td><td>${esc(p.nguoi)}</td><td>${ed?`<select data-mf="st" data-mi="${p.id}">${opt(SX_MH_ST,p.st)}</select>`:esc(p.st)}</td></tr>`))}</section>
  ${ed?`<section class="card"><div class="card-h"><h2>Đề nghị mua / đặt ngoài</h2></div><form class="frm row7" id="mhf"><label class="field">Loại<select id="mh-l">${opt(["Nguyên vật liệu","Hàng đặt ngoài"],"Nguyên vật liệu")}</select></label><label class="field grow">Mặt hàng<input id="mh-t" required></label><label class="field">Số lượng<input id="mh-sl" type="number" required></label><label class="field">Đơn vị<input id="mh-dv" value="cái"></label><label class="field">Dự kiến về<input id="mh-ve" type="date"></label><label class="field grow">Ghi chú<input id="mh-gc"></label><button class="btn pri">Thêm</button></form><p class="hint">Giá mua không nhập ở đây (số tài chính do Kế toán quản lý).</p></section>`:""}`);
  sxBindCommon(m);
  m.querySelectorAll("[data-mf]").forEach(x=>x.onchange=()=>{const id=x.dataset.mi,f=x.dataset.mf;sxMut(`cập nhật ${id}: ${f==="st"?x.value:f}`,s2=>{const p=s2.purchases.find(y=>y.id===id);p[f]=x.value;if(f==="st"&&x.value==="Đã đặt"&&!p.ngayDat)p.ngayDat=sxToday()});toast("Đã lưu");if(f==="st")renderMain()});
  if($("#mhf"))$("#mhf").onsubmit=e=>{e.preventDefault();sxMut("đề nghị mua "+$("#mh-t").value,s2=>{s2.purchases.push({id:"MH-"+sxPad(s2.purchases.length+1,3),loai:$("#mh-l").value,ten:$("#mh-t").value.trim(),sl:+$("#mh-sl").value,dvt:$("#mh-dv").value,ncc:"",ngayDat:"",ngayVe:$("#mh-ve").value,st:"Đề nghị",nguoi:ME.name,ghiChu:$("#mh-gc").value.trim()})});renderMain()};
}

/* ---------- 7. KHO THÀNH PHẨM ---------- */
function pSxKho(m){
  sxShape(D());const s=SX(),st=sxStock(),ed=sxCan("sx.kiemke");
  const conts=s.batches.filter(b=>b.st==="SAN_SANG").flatMap(b=>b.containers.filter(c=>c.st==="OK").map(c=>({b,c})));
  const seen=[...new Set(SXB2B.rows.map(r=>r.sku))],showAll=SXF.mapAll,mapList=(showAll?SXB2B.prods:SXB2B.prods.filter(p=>seen.includes(p.sku)||sxMap(p.sku)));
  const outBy={};SXB2B.rows.filter(r=>String(r.delivered_at||"").slice(0,10)>=s.cfg.b2bFrom).forEach(r=>outBy[r.sku]=(outBy[r.sku]||0)+r.qty);
  const b2bSec=`<section class="card"><div class="card-h"><h2>Đơn B2B trừ tồn ngay khi bấm "Đã xuất kho" trên CRM</h2><span class="hint">${SXB2B.rows.length} dòng hàng đã xuất · cập nhật ${SXB2B.at?new Date(SXB2B.at).toLocaleTimeString("vi-VN"):"—"}</span></div>
   <div class="filters"><label class="inl">Bắt đầu trừ từ ngày ${ed?`<input type="date" id="b2b-from" value="${s.cfg.b2bFrom}">`:sxDd(s.cfg.b2bFrom)}</label><span class="hint">Đơn xuất trước ngày này coi như đã nằm trong số tồn lúc bắt đầu. Hôm bắt đầu, kế toán ghi phiếu <b>Tồn đầu kỳ</b> cho từng mã ở cuối trang.</span><label class="ck sm"><input type="checkbox" id="map-all" ${showAll?"checked":""}> Hiện đủ ${SXB2B.prods.length} mã CRM</label></div>
   ${mapList.length?tbl(["Mã CRM","Tên trên CRM","Đơn vị","Đã xuất từ ngày bắt đầu","Quy đổi sang mã sản xuất","1 đơn vị CRM = ? sản phẩm","Trạng thái"],mapList.map(p=>{const mp=sxMap(p.sku),g=!mp&&sxGuess(p.name,p.sku),le=/-(c|g)$/i.test(p.sku)||!/thùng/i.test(p.unit||"");return `<tr><td class="mono">${esc(p.sku)}</td><td>${esc(p.name)}</td><td>${esc(p.unit||"")}</td><td class="n">${outBy[p.sku]?nf(outBy[p.sku]):"—"}</td><td>${ed?`<select data-mp="${esc(p.sku)}">${opt([["","— chưa quy đổi"]].concat(SX().products.map(x=>[x.ma,x.ten])),mp?mp.sp:"")}</select>${g?` <button class="lnk" data-mg="${esc(p.sku)}" data-sp="${esc(g.ma)}" data-hs="${le?1:(g.thung||"")}">gợi ý: ${esc(g.ten)}</button>`:""}`:esc(mp?sxP(mp.sp).ten:"—")}</td><td class="n">${ed?`<input class="num" data-mh="${esc(p.sku)}" value="${mp?mp.heSo:""}" placeholder="${le?1:"SL/thùng"}" style="width:80px">`:mp?mp.heSo:"—"}</td><td>${mp&&mp.sp?pill("Đang trừ tồn","grn"):outBy[p.sku]?pill("Chưa trừ","red"):pill("Chưa quy đổi","gry")}</td></tr>`})):`<p class="empty">Chưa có đơn B2B nào xuất kho từ ngày bắt đầu. Tích "Hiện đủ mã CRM" để quy đổi trước.</p>`}</section>`;
  sxFrame(m,"sx_kho","Kho thành phẩm","Tồn theo sản phẩm, lô, thùng/khay và vị trí · tách hàng sẵn sàng bán, chờ xử lý, lỗi · đơn B2B trừ ngay khi xuất kho",`
  <div class="note">Số trên khay là <b>số lượng bàn giao ban đầu</b>. Khi chưa nối hệ thống đơn bán ra, web chưa trừ tự động: kế toán ghi xuất/điều chỉnh khi kiểm kê lại. Không suy tồn từ số đơn đi trong ngày vì đơn dùng cả hàng cũ lẫn hàng mới.</div>
  <section class="card flush">${tbl(["Sản phẩm","Sẵn sàng bán","· nhập trong thùng","· bàn giao trên khay","Đã xuất B2B","Chờ nhập kho","Chờ xử lý","Lỗi","Mức tối thiểu"],st.map(o=>{const p=sxP(o.sp);return `<tr><td><b>${esc(p.ten)}</b></td><td class="n"><b class="${o.san<0?"bad":""}">${nf(o.san)}</b>${o.san<0?`<small class="bad">thiếu tồn đầu kỳ</small>`:""}</td><td class="n">${nf(o.thung)}</td><td class="n">${nf(o.khay)}</td><td class="n">${o.xuatB2B?"−"+nf(o.xuatB2B):"—"}</td><td class="n">${nf(o.choNhap)}</td><td class="n warn">${nf(o.cho)}</td><td class="n bad">${nf(o.loi)}</td><td class="n">${ed?`<input class="num" data-tt="${esc(o.sp)}" value="${p.toiThieu||""}" placeholder="—" style="width:80px">`:p.toiThieu?nf(p.toiThieu):"—"}${p.toiThieu&&o.san<p.toiThieu?" "+pill("thiếu","red"):""}</td></tr>`}))}</section>
  ${b2bSec}
  ${sxCard("Theo lô, thùng / khay và vị trí","",tbl(["Lô","Sản phẩm","Vật chứa","Số lượng","Vị trí"],conts.map(({b,c})=>`<tr class="clk" data-sxb="${b.id}"><td class="mono">${esc(b.ma)}</td><td>${esc(sxP(b.sp).ten)}</td><td>${c.loai} · ${c.c}</td><td class="n">${nf(c.sl)}${c.loai!=="Thùng"?" <small>bàn giao ban đầu</small>":""}</td><td>${esc(c.viTri||"—")}</td></tr>`)))}
  ${sxCard("Lịch sử nhập, bàn giao, xuất, điều chỉnh","",tbl(["Lúc","Người","Loại","Sản phẩm","Lô / vật chứa","SL","Đến / lý do"],s.moves.slice().reverse().slice(0,60).map(v=>`<tr><td>${esc(v.at)}</td><td>${esc(v.by)}</td><td>${esc(v.loai)}</td><td>${esc(sxP(v.sp).ten)}</td><td class="mono">${esc(v.lot||"")} ${esc(v.c||"")}</td><td class="n">${nf(v.sl)}</td><td>${esc(v.den||v.lyDo||"")}</td></tr>`))+(ed?`<form class="frm row7" id="xkf"><label class="field">Loại<select id="xk-lo">${opt(["Tồn đầu kỳ / điều chỉnh tăng","Xuất / điều chỉnh"],"Xuất / điều chỉnh")}</select></label><label class="field">Sản phẩm<select id="xk-sp" required>${sxProdOpts("")}</select></label><label class="field">Số lượng<input id="xk-sl" type="number" min="1" required></label><label class="field grow">Lý do (tồn đầu kỳ khi bắt đầu dùng, kiểm kê lại, hỏng…)<input id="xk-ly" required></label><button class="btn">Ghi phiếu</button></form>`:""))}`);
  sxBindCommon(m);
  const setMap=(ma,f,v)=>sxMut(`quy đổi mã B2B ${ma}`,s2=>{let mp=s2.maps.find(y=>y.nguon==="B2B"&&y.ma===ma);if(!mp){mp={nguon:"B2B",ma,sp:"",heSo:1};s2.maps.push(mp)}mp[f]=v});
  m.querySelectorAll("[data-mp]").forEach(x=>x.onchange=()=>{setMap(x.dataset.mp,"sp",x.value);toast("Đã lưu quy đổi");renderMain()});
  m.querySelectorAll("[data-mh]").forEach(x=>x.onchange=()=>{setMap(x.dataset.mh,"heSo",+x.value||1);toast("Đã lưu");renderMain()});
  m.querySelectorAll("[data-mg]").forEach(b=>b.onclick=()=>{const ma=b.dataset.mg;sxMut(`quy đổi mã B2B ${ma} theo gợi ý`,s2=>{let mp=s2.maps.find(y=>y.nguon==="B2B"&&y.ma===ma);if(!mp){mp={nguon:"B2B",ma,sp:"",heSo:1};s2.maps.push(mp)}mp.sp=b.dataset.sp;mp.heSo=+b.dataset.hs||1});toast(+b.dataset.hs?"Đã quy đổi":"Đã chọn sản phẩm, điền số sản phẩm mỗi thùng");renderMain()});
  if($("#b2b-from"))$("#b2b-from").onchange=e=>{sxMut("đặt ngày bắt đầu trừ tồn B2B "+e.target.value,s2=>s2.cfg.b2bFrom=e.target.value);sxB2BRefresh(true);renderMain()};
  if($("#map-all"))$("#map-all").onchange=e=>{SXF.mapAll=e.target.checked;renderMain()};
  m.querySelectorAll("[data-tt]").forEach(x=>x.onchange=()=>{sxMut(`đặt mức tối thiểu ${sxP(x.dataset.tt).ten}: ${x.value||0}`,s2=>{const p=s2.products.find(y=>y.ma===x.dataset.tt);if(p)p.toiThieu=+x.value||0});toast("Đã lưu");renderMain()});
  if($("#xkf"))$("#xkf").onsubmit=e=>{e.preventDefault();const lo=$("#xk-lo").value;sxMut(lo.toLowerCase()+" "+sxP($("#xk-sp").value).ten,s2=>s2.moves.push({at:sxNow(),by:ME.name,sp:$("#xk-sp").value,sl:+$("#xk-sl").value,loai:lo,lyDo:$("#xk-ly").value.trim()}));renderMain()};
}

/* ---------- 8. BÁO CÁO ---------- */
let SXB={tu:"",den:""};
function pSxBc(m){
  sxShape(D());const s=SX(),t=sxToday();if(!SXB.tu){SXB.tu=t.slice(0,8)+"01";SXB.den=t}
  const L=s.batches.filter(b=>b.tong&&b.st!=="HUY"&&b.ngay>=SXB.tu&&b.ngay<=SXB.den),T={tong:sum(L,b=>b.tong),dat:sum(L,b=>b.dat),loi:sum(L,b=>b.loi),cho:sum(L,b=>b.cho),bao:sum(L,b=>b.baoSL)};
  const by=(f)=>{const g={};L.forEach(b=>f(b).forEach(([k,w])=>{const o=g[k]=g[k]||{k,n:0,tong:0,dat:0,loi:0,cho:0};o.n++;o.tong+=b.tong*w;o.dat+=b.dat*w;o.loi+=b.loi*w;o.cho+=b.cho*w}));return Object.values(g).sort((a,b)=>b.dat-a.dat)};
  const bySp=by(b=>[[sxP(b.sp).ten,1]]),byNg=by(b=>(b.nguoi.length?b.nguoi:["(chưa ghi)"]).map(n=>[n,1/b.nguoi.length||1])),byDay=by(b=>[[sxDd(b.ngay),1]]);
  const lech=L.filter(b=>b.baoSL&&b.baoSL!==b.tong);
  const lead=L.filter(b=>b.req).map(b=>{const r=s.requests.find(x=>x.id===b.req);if(!r||!r.taoLuc)return null;return (new Date(b.ngay)-new Date(r.taoLuc))/864e5}).filter(x=>x!=null&&x>=0);
  const r1=x=>x.toFixed(1).replace(".",",");
  const tb=(G,h)=>tbl([h,"Số lô","Kiểm","Đạt","Lỗi","Chờ","Tỷ lệ đạt"],G.map(o=>`<tr><td><b>${esc(o.k)}</b></td><td class="n">${o.n}</td><td class="n">${nf(Math.round(o.tong))}</td><td class="n">${nf(Math.round(o.dat))}</td><td class="n bad">${nf(Math.round(o.loi))}</td><td class="n warn">${nf(Math.round(o.cho))}</td><td class="n">${pc(o.dat,o.tong)}</td></tr>`));
  sxFrame(m,"sx_bc","Báo cáo sản xuất","Sản lượng, tỷ lệ đạt/lỗi, chênh lệch xưởng báo – kế toán kiểm, thời gian từ nhu cầu đến kiểm kê",`
  <div class="filters"><label class="inl">Từ <input type="date" id="bc-tu" value="${SXB.tu}"></label><label class="inl">đến <input type="date" id="bc-den" value="${SXB.den}"></label><span class="hint">${L.length} lô đã kiểm kê</span></div>
  <div class="grid kpis">${kpi("Sản lượng đạt",nf(T.dat),"trên "+nf(T.tong)+" kiểm đếm")}${kpi("Tỷ lệ đạt",pc(T.dat,T.tong))}${kpi("Lỗi",nf(T.loi),pc(T.loi,T.tong))}${kpi("Chờ xử lý",nf(T.cho),pc(T.cho,T.tong))}${kpi("Xưởng báo / kế toán kiểm",nf(T.bao)+" / "+nf(T.tong),lech.length+" lô lệch")}${kpi("Nhu cầu → kiểm kê",lead.length?r1(sum(lead,x=>x)/lead.length)+" ngày":"—","trung bình")}</div>
  <div class="sxgrid2">${sxCard("Theo sản phẩm","",tb(bySp,"Sản phẩm"))}${sxCard("Theo nhân sự","",tb(byNg,"Nhân sự")+`<p class="hint">Lô nhiều người làm thì chia đều sản lượng cho từng người.</p>`)}</div>
  <div class="sxgrid2">${sxCard("Theo ngày","",tb(byDay,"Ngày"))}${sxCard("Lô lệch số xưởng báo","",tbl(["Lô","Sản phẩm","Xưởng báo","Kế toán kiểm","Lệch","Lý do"],lech.map(b=>`<tr><td class="mono">${esc(b.ma)}</td><td>${esc(sxP(b.sp).ten)}</td><td class="n">${nf(b.baoSL)}</td><td class="n">${nf(b.tong)}</td><td class="n">${b.tong-b.baoSL>0?"+":""}${nf(b.tong-b.baoSL)}</td><td>${esc(b.lechLyDo)}</td></tr>`)))}</div>`);
  sxBindCommon(m);$("#bc-tu").onchange=e=>{SXB.tu=e.target.value;renderMain()};$("#bc-den").onchange=e=>{SXB.den=e.target.value;renderMain()};
}

/* Lần đầu mở: tạo dữ liệu Sản xuất trên máy chủ (danh mục từ SKU, nhân sự xưởng từ hồ sơ, dữ liệu mẫu). */
function sxInit(f){return m=>{sxB2BRefresh();const d=D();if(!d.sx||(!d.sx.seeded&&(d.skus||[]).length))DB.mutate("Hệ thống","Sản xuất · khởi tạo dữ liệu",dt=>sxShape(dt));else sxShape(d);f(m)}}
Object.assign(PAGES,{sx:sxInit(pSxTq),sx_tq:sxInit(pSxTq),sx_nc:sxInit(pSxNc),sx_td:sxInit(pSxTd),sx_lo:sxInit(pSxLo),sx_nvl:sxInit(pSxNvl),sx_mh:sxInit(pSxMh),sx_kho:sxInit(pSxKho),sx_bc:sxInit(pSxBc)});
