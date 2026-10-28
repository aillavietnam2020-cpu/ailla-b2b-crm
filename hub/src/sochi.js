/* =====================================================================
   SỔ CHI PHÍ (trang quản trị › Tiền & chi phí › Sổ chi phí), dựng theo file "AILLA_Phan_bo_chi_phi_T09-2026" chị Hoa duyệt 26/10.
   Một khoản chi = một dòng nhật ký. Mọi tab khác chỉ là phép cộng từ nhật ký:
     Tổng quan · Nhật ký chi · Phân bổ theo kênh · Cần rà soát · Danh mục chi phí.
   Lưu ở ngăn tài chính riêng D().fin (chỉ CEO và kế toán đọc/ghi):
     fin.nkc     dòng nhật ký {id,d,ct,lct,dg,tk,t,g,k,st,gc,dn,bp,nn,ht,src,by,duyet}
     fin.cpdm    danh mục nhóm chi phí G01…G24 {g,n,tk,lo,cd,gc} (chị Huệ sửa được)
     fin.cpDT    doanh thu thực từng kênh theo tháng, để chia chi chung
     fin.cpRule  cách đã bổ của từng diễn giải, lần nạp sau web tự bổ giống
   Phiếu chị Thảo ghi nằm ở D().pcCho (chờ duyệt, chưa vào sổ); chị Huệ duyệt thì chuyển sang fin.nkc.
   Nạp số: file sổ cái TK 642 xuất từ MISA, hoặc file Google Sheet có tab NHẬT KÝ CHI.
   ===================================================================== */
const SC_DM0=[["G01","Quảng cáo Facebook (tiền nạp)","6421","A - Trực tiếp kênh",0,"Ghi theo lúc nạp tiền vào tài khoản QC, chưa phải số đã tiêu"],["G02","Quảng cáo TikTok (tiền nạp)","6421","A - Trực tiếp kênh",0,"Gồm nạp tay trong tháng và bút toán nạp cuối tháng"],["G03","Quảng cáo Shopee (tiền nạp)","6421","A - Trực tiếp kênh",0,"Shopee Mall và Shopee thường nạp 5,4 triệu/lần"],["G04","Phí sàn (TikTok, Shopee)","6421","A - Trực tiếp kênh",0,"Phí sàn đã nằm trong báo cáo sàn; đối chiếu kẻo trùng"],["G05","Vận chuyển đơn hàng (SPX, Best, J&T)","6421","A - Trực tiếp kênh",0,"Cần xác định gửi cho kênh nào"],["G06","Hoa hồng vận hành TikTok","6421","A - Trực tiếp kênh",0,"Trả bên vận hành TikTok"],["G07","Lương - thưởng","CHIA","B - Phòng ban",1,"Chia lương xưởng/sale/văn phòng theo bảng lương"],["G08","Bảo hiểm","CHIA","B - Phòng ban",1,"Chia theo người thuộc phòng nào"],["G09","Cước xe giao hàng NPP","6421","A - Trực tiếp kênh",0,"Cước xe là của NPP"],["G10","Đóng gói bán lẻ (băng dính, chống sốc)","6421","A - Trực tiếp kênh",0,"Đóng đơn B2C lẻ"],["G11","Công cụ Marketing (CapCut)","6421","B - Phòng ban",1,"Team MKT"],["G12","Điện thoại sale + tổng đài (hỗ trợ ads FB)","6421","A - Trực tiếp kênh",0,"Hỗ trợ ads Facebook"],["G13","Điện, mạng, VPS văn phòng","6422","C - Chi chung",1,"Chia theo doanh thu thực"],["G14","Phân bổ CCDC (gồm thuê VP/xưởng)","CHIA","C - Chi chung",1,"TK 242 phân bổ hàng tháng; chia xưởng/văn phòng"],["G15","Thiết bị xưởng/kho (nồi, quạt, máy tít đơn)","CHIA","B - Phòng ban",0,"Đúng ra vào CCDC (TK 242) rồi phân bổ dần"],["G16","Vật tư, sửa chữa, đồ dùng xưởng","154","B - Phòng ban",0,"Chi phí chung của xưởng, tính vào giá thành"],["G17","Cước vật tư đầu vào (hóa chất AOS, HDSD)","152","Giá vốn",0,"Là chi phí mua hàng, cộng vào giá vốn nguyên vật liệu"],["G18","Dịch vụ chuyên môn (kế toán thuế, tuyển dụng)","6422","C - Chi chung",1,"Chia theo doanh thu thực"],["G19","Hoàn/bù khách (đơn thiếu, vỡ, rách)","6421","A - Trực tiếp kênh",0,"Cần ghi rõ đơn của kênh nào"],["G20","Chuyển nhầm / thu nhầm (không phải chi phí)","138","Không tính",0,"Phải thu hồi hoặc trả lại, không được vào chi phí"],["G21","Văn phòng, lễ, phúc lợi, đối ngoại","6422","C - Chi chung",1,"Kiểm tra hóa đơn đầu vào"],["G22","Tiền VAT trả theo số hóa đơn","6422","C - Chi chung",0,"Cần rà bản chất"],["G23","Ghi chung chung \"Chi phí\"","6422","Chờ xác định",0,"Chưa biết chi cho việc gì"],["G24","Mẫu thử, nghiên cứu sản phẩm","6422","C - Chi chung",0,"Chi phí phát triển sản phẩm"],["G25","Chi phí sản xuất thành phẩm","154.1","Giá vốn",0,"TK 154.1 Giá thành thành phẩm: vào giá thành, không chia kênh"],["G26","Chi phí sản xuất bán thành phẩm","154.2","Giá vốn",0,"TK 154.2 Giá thành bán thành phẩm: vào giá thành, không chia kênh"],["G27","Khấu hao tài sản cố định","CHIA","B - Phòng ban",1,"Web tự cộng hằng tháng từ trang Tài sản cố định (Có TK 2141); phần xưởng vào 154.1 / 154.2"],["G28","Mua tài sản cố định / công cụ dụng cụ","211","Không tính",0,"Tiền mua tài sản, công cụ: không vào chi phí tháng, chỉ phần khấu hao / phân bổ từng tháng mới vào"]].map(r=>({g:r[0],n:r[1],tk:r[2],lo:r[3],cd:r[4],gc:r[5]}));
const SC_KENH=["TikTok","Shopee Mall","Shopee thường","Facebook","NPP","Gia công"],SC_COLS=SC_KENH.concat(["Sản xuất","Chung","Chờ xác định","Không tính"]);
/* Công ty hạch toán theo Thông tư 133 (chị Huệ 27/10): không có TK 641, 627; chi phí bán hàng là 6421, quản lý là 6422, sản xuất chung vào 154.
   Danh mục cũ đã lưu còn mã 641/642/627 thì tự đổi khi đọc. */
const SC_TK133={"641":"6421","642":"6422","627":"154"};
const SC_TKN={"6421":"Chi phí bán hàng (TK 6421): quảng cáo, phí sàn, vận chuyển đơn, hoa hồng, hỗ trợ sale","6422":"Chi phí quản lý doanh nghiệp (TK 6422): điện, mạng, kế toán, văn phòng, VAT lẻ, chi chung","CHIA":"Phải chia 6421 / 6422 / 154 theo bộ phận: lương, bảo hiểm, phân bổ CCDC, thiết bị","154":"Chi phí sản xuất (TK 154) chưa tách thành phẩm / bán thành phẩm: chọn 154.1 hoặc 154.2","154.1":"Giá thành thành phẩm (TK 154.1): chi phí sản xuất ra thành phẩm, vào giá thành","154.2":"Giá thành bán thành phẩm (TK 154.2): chi phí sản xuất bán thành phẩm, vào giá thành","152":"Cước vật tư đầu vào: cộng vào giá vốn nguyên vật liệu","138":"Không phải chi phí: tiền chuyển nhầm, phải thu hồi"};
const SC={tab:"nk",g:"",k:"",st:"",q:""};
const scFin=()=>(D().fin||{});
const scSecret=()=>!!ME&&(ME.role==="admin"||mhPerm("order.accounting.confirm")||can(ME,"chiphi.xem"));
const scCanGhi=()=>!!ME&&(ME.role==="admin"||mhManage()||can(ME,"chiphi.nhap"));
const scCanDuyet=()=>!!ME&&(ME.role==="admin"||mhPerm("order.accounting.confirm"));
let SC_DMC=null;
const scDM=()=>{const L=scFin().cpdm;if(!(L&&L.length))return SC_DM0;if(SC_DMC&&SC_DMC.src===L)return SC_DMC.v;
  const v=L.map(x=>SC_TK133[x.tk]?{...x,tk:SC_TK133[x.tk]}:x).concat(SC_DM0.filter(z=>!L.some(x=>x.g===z.g)));SC_DMC={src:L,v};return v};
const scG=g=>scDM().find(x=>x.g===g)||{g,n:g||"Chưa chọn nhóm",tk:"",lo:"",cd:0,gc:""};
const scNf=v=>Math.round(+v||0).toLocaleString("vi-VN"),scPc=(a,b)=>b?(a/b*100).toFixed(1).replace(".",",")+"%":"—",scDd=s=>String(s||"").slice(8,10)+"/"+String(s||"").slice(5,7);
const scS=a=>a.reduce((t,x)=>t+(+x.t||0),0);
const scLoP=lo=>{const k=String(lo||"")[0];return `<span class="scp ${k==="A"?"p-a":k==="B"?"p-b":"p-c"}">${esc(lo||"—")}</span>`};
const scStP=s=>`<span class="scp ${s==="Ổn"?"p-ok":s==="Chờ duyệt"||s==="Chờ CEO duyệt"?"p-a":"p-ra"}">${esc(s||"—")}</span>`;
const scInP=r=>r.d>=PERIOD.from&&r.d<=PERIOD.to;
/* Một nguồn khấu hao / phân bổ mỗi tháng (điều phối 28/10): tháng trang Tài sản đã chạy khấu hao (tsChiPhiThang(ym).chay)
   thì dòng PBCC / khấu hao TSCĐ-CCDC nạp từ MISA của tháng đó chỉ để đối chiếu, không tính; số chuẩn là dòng tự cộng từ Tài sản. */
const SC_TSC={};
const scTsThang=ym=>{try{if(typeof tsChiPhiThang!=="function")return null;const c=SC_TSC[ym];if(c&&Date.now()-c.at<3000)return c.r;const r=tsChiPhiThang(ym);SC_TSC[ym]={r,at:Date.now()};return r}catch(e){return null}};
const scLaKhauHaoMisa=x=>x.src!=="phieu"&&(/^(PBCC|KHTS|KHCC|PBTT)/i.test(String(x.ct||""))||/ph[aâ]n b[oổ] chi ph[ií]|kh[aấ]u hao/i.test(String(x.dg||"")))&&!x.tach;
const scChiDoiChieu=x=>{if(!scLaKhauHaoMisa(x))return false;const r=scTsThang(String(x.d||"").slice(0,7));return !!(r&&r.chay)};
const scRows=()=>((scFin().nkc)||[]).filter(scInP).filter(x=>!scChiDoiChieu(x));
const scCho=()=>(D().pcCho||[]);
const scKey=t=>kfold(t).replace(/[0-9.\/,]+/g," ").replace(/\s+/g," ").trim().slice(0,60);
/* Đề xuất nhóm + nơi chịu cho một diễn giải: ưu tiên cách đã bổ trước đây, rồi theo từ khóa. */
function scDeXuat(dg){
  const r=(scFin().cpRule||{})[scKey(dg)];if(r&&r.g)return {g:r.g,k:r.k,st:r.st||"Ổn"};
  const t=" "+kfold(dg)+" ",raw=" "+String(dg).toLowerCase()+" ",h=re=>re.test(t);
  const R=[[/quang cao|nap qc|nap tien qc/,()=>h(/tiktok|tikotk/)?["G02","TikTok"]:h(/shopee ?mall|shopemall/)?["G03","Shopee Mall"]:h(/shopee/)?["G03","Shopee thường"]:["G01","Facebook"]],
   [/phi tiktok/,()=>["G04","TikTok"]],[/cp shopee ?mall|shopeemall thang|cp shopemall/,()=>["G04","Shopee Mall"]],[/cp shopee thuong|shopee thuong thang/,()=>["G04","Shopee thường"]],[/rut tien/,()=>["G04","Chờ xác định"]],
   [/spx|best|j&t|cp gui hang|cp don gui|gui hang ra|lay hang mang/,()=>["G05","Chờ xác định"]],
   [/hoa hong/,()=>["G06","TikTok"]],[/luong|thuong/,()=>["G07","Chờ xác định"]],[/bao hiem/,()=>["G08","Chung"]],[/cuoc xe/,()=>["G09","NPP"]],
   [/bang dinh|chong soc/,()=>["G10","Facebook"]],[/capcut|veo 3|chatgpt|canva/,()=>["G11","Chung"]],[/dien thoai sale|tong dai|\bity\b/,()=>["G12","Facebook"]],
   [/tien dien thoai|the dien thoai/,()=>["G12","Facebook"]],[/do le|trung thu|thap huong/,()=>["G21","Chung"]],[/mang duoi xuong/,()=>["G16","Sản xuất"]],
   [/tien mang|mang ben|tien dien|vps|internet/,()=>["G13","Chung"]],[/ccdc|phan bo chi phi/,()=>["G14","Chung"]],
   [/\bnoi\b|\bquat\b|may tit|may dan|\bmay\b/,()=>["G15","Sản xuất"]],[/mua do|do duoi xuong|do cho xuong|bang keo|sua chua|sua may/,()=>["G16","Sản xuất"]],
   [/ship hoa chat|hdsd|nhan mau|cuoc vat tu/,()=>["G17","Sản xuất"]],[/ke toan thue|tuyen dung/,()=>["G18","Chung"]],
   [/hoan tien|bu don|tui giat|thieu choi|\bbu\b/,()=>["G19","Chờ xác định"]],[/ck nham|chuyen nham|thu nham/,()=>["G20","Không tính"]],
   [/do le|trung thu|thap huong|gui thu|nuoc uong|choi|dien thoai/,()=>["G21","Chung"]],[/mau thu|mau sap|\btest\b/,()=>["G24","Chung"]]];
  if(/[^a-zà-ỹ]vat[^a-zà-ỹ]/.test(raw))return {g:"G22",k:"Chung",st:"Cần rà"};
  for(const [re,f] of R)if(re.test(t)){const [g,k]=f();return {g,k,st:k==="Chờ xác định"?"Cần rà":"Ổn"}}
  return {g:"G23",k:"Chờ xác định",st:"Cần rà"};
}
/* ---------- Đọc file: sổ cái MISA (TK 642) hoặc Google Sheet có tab NHẬT KÝ CHI ---------- */
function scParse(S){
  const iso=v=>{if(v instanceof Date){const z=new Date(Math.round((v.getTime()-v.getTimezoneOffset()*6e4)/864e5)*864e5);return z.getUTCFullYear()+"-"+String(z.getUTCMonth()+1).padStart(2,"0")+"-"+String(z.getUTCDate()).padStart(2,"0")}const m=String(v||"").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(m)return m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0");const m2=String(v||"").match(/^(\d{4})-(\d{2})-(\d{2})/);return m2?m2[0]:""};
  const num=v=>typeof v==="number"?v:+String(v||"").replace(/\./g,"").replace(/,/g,".")||0;
  const nk=Object.keys(S).find(n=>/nh[aậ]t k[yý] chi/i.test(n));
  if(nk){/* file phân bổ: STT | Ngày | Số CT | Loại CT | Diễn giải | TK đối ứng | Số tiền | Mã nhóm | Nhóm | TK đề xuất | Loại | Kênh | Tình trạng | Ghi chú | Người đề nghị | Chứng từ | Người duyệt */
    const A=S[nk],hi=A.findIndex(r=>r&&r.some(c=>/^Số chứng từ$/i.test(String(c||"").trim())));if(hi<0)return {err:"Tab NHẬT KÝ CHI không có cột Số chứng từ."};
    const H=A[hi].map(c=>String(c||"").trim()),ix=n=>H.findIndex(h=>h.toLowerCase().startsWith(n.toLowerCase()));
    const c={d:ix("Ngày"),ct:ix("Số chứng từ"),lct:ix("Loại CT"),dg:ix("Diễn giải"),tk:ix("TK đối ứng"),t:ix("Số tiền"),g:ix("Mã nhóm"),k:ix("Kênh"),st:ix("Tình trạng"),gc:ix("Ghi chú"),dn:ix("Người đề nghị"),dy:ix("Người duyệt")};
    const rows=[];A.slice(hi+1).forEach(r=>{if(!r)return;const d=iso(r[c.d]),t=num(r[c.t]);if(!d||!t)return;rows.push({d,ct:String(r[c.ct]||""),lct:String(r[c.lct]||""),dg:String(r[c.dg]||""),tk:String(r[c.tk]||"").replace(/\.0$/,""),t,g:String(r[c.g]||""),k:String(r[c.k]||"Chờ xác định"),st:String(r[c.st]||"Ổn"),gc:c.gc>=0?String(r[c.gc]||""):"",dn:c.dn>=0?String(r[c.dn]||""):"",src:"sheet"})});
    return {rows,kind:"file phân bổ (tab "+nk+")"}}
  /* sổ cái MISA: Ngày ghi sổ | Số hiệu | Ngày CT | Diễn giải | ... | TK đối ứng | Nợ | Có */
  const rows=[];Object.values(S).forEach(A=>A.forEach(r=>{if(!r)return;const cells=r.map(x=>x==null?"":x);const d=iso(cells[0]);if(!d)return;
    const ct=String(cells.find((x,i)=>i>0&&/^(BN|BC|NVK|PC|PT|PBCC|UNC)\w*\d/i.test(String(x)))||"");if(!ct)return;
    const ci=cells.findIndex(x=>String(x)===ct),txt=cells.slice(ci+1).map(String).filter(x=>x&&!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(x)&&!/^[\d.,]+$/.test(x)&&!(x instanceof Date));
    const dg=txt.sort((a,b)=>b.length-a.length)[0]||"";const nums=cells.slice(ci+1).filter(x=>typeof x==="number"||/^[\d.,]+$/.test(String(x))).map(num);
    if(!dg||/kết chuyển/i.test(dg))return;const tk=String(nums.find(n=>n>=100&&n<10000)||"");const amt=nums.filter(n=>n!==+tk);const t=amt.find(n=>n>0)||0;if(!t)return;
    const de=scDeXuat(dg);rows.push({d,ct,lct:/^BN|^UNC/i.test(ct)?"Chi ngân hàng":/^PC/i.test(ct)?"Phiếu chi":/^PBCC/i.test(ct)?"Phân bổ CCDC":"Nghiệp vụ khác",dg,tk,t,g:de.g,k:de.k,st:de.st,gc:"",src:"misa"})}));
  return rows.length?{rows,kind:"sổ cái MISA"}:{err:"Không đọc được dòng chi nào. Chị chọn file sổ cái TK 642 xuất từ MISA (.xls/.xlsx) hoặc file phân bổ có tab NHẬT KÝ CHI."};
}
function scImport(){
  openDrawerHTML(`<h2>Nạp sổ chi từ file</h2><p class="hint">Chọn một trong hai loại file:<br>• Sổ cái TK 642 xuất từ MISA (.xls, .xlsx): web tự xếp nhóm chi phí và nơi chịu, dòng chưa chắc ghi "Cần rà".<br>• File phân bổ trên Google Sheet (tải về .xlsx) có tab NHẬT KÝ CHI: lấy đúng nhóm, kênh, tình trạng đã ghi trong file.<br>Dòng đã có (trùng ngày, số chứng từ, số tiền) tự bỏ qua.</p>
   <label class="field">File<input type="file" id="sci-f" accept=".xls,.xlsx"></label><div id="sci-r"></div><button class="btn pri" id="sci-ok" hidden>Nạp vào sổ</button>`);
  let P=null;
  $("#sci-f").onchange=async e=>{const f=e.target.files[0];if(!f)return;$("#sci-r").innerHTML=`<p class="hint">Đang đọc…</p>`;let S;try{S=await wbSheets(f)}catch(er){$("#sci-r").innerHTML=`<div class="note red">Không đọc được file.</div>`;return}
    const r=scParse(S);if(r.err){$("#sci-r").innerHTML=`<div class="note red">${esc(r.err)}</div>`;return}
    const gom={};((scFin().nkc)||[]).forEach(x=>{const k=x.tach||x.tachGoc?x.d+"|"+x.ct:"#"+x.id;if(!gom[k])gom[k]={d:x.d,ct:x.ct,t:0};gom[k].t+=+x.t||0});const have=new Set(Object.values(gom).map(x=>[x.d,x.ct,Math.round(x.t)].join("|")));const moi=r.rows.filter(x=>!have.has([x.d,x.ct,Math.round(x.t)].join("|")));
    const th=[...new Set(moi.map(x=>x.d.slice(0,7)))].sort();P=moi;
    $("#sci-r").innerHTML=`<div class="note">Đọc được <b>${r.rows.length}</b> dòng từ ${esc(r.kind)} · tổng ${scNf(scS(r.rows))} đ.<br><b>${moi.length}</b> dòng mới sẽ nạp${th.length?" (tháng "+th.map(x=>x.slice(5)+"/"+x.slice(0,4)).join(", ")+")":""}, ${r.rows.length-moi.length} dòng đã có. ${moi.filter(x=>x.st!=="Ổn").length} dòng ghi "Cần rà".</div>`;
    $("#sci-ok").hidden=!moi.length};
  $("#sci-ok").onclick=()=>{if(!P||!P.length)return;const n=P.length;DB.mutate(ME.name,"nạp sổ chi "+n+" dòng",dt=>{dt.fin=dt.fin||{};dt.fin.nkc=dt.fin.nkc||[];dt.fin.cpRule=dt.fin.cpRule||{};
      P.forEach(x=>{dt.fin.nkc.push({id:uid("nk"),...x,by:ME.name,at:Date.now()});if(x.src==="sheet"&&x.g)dt.fin.cpRule[scKey(x.dg)]={g:x.g,k:x.k,st:x.st}})});
    closeDrawer();toast("Đã nạp "+n+" dòng vào sổ chi");const m=P.map(x=>x.d).sort();if(m.length&&(m[0]>PERIOD.to||m[m.length-1]<PERIOD.from))toast("Các dòng vừa nạp thuộc tháng "+m[0].slice(5,7)+": chọn tháng đó ở ô thời gian để xem");renderMain()};
}
/* ---------- Phiếu chi: chị Thảo ghi, chị Huệ duyệt ---------- */
function scSoPhieu(ngay){const ym=ngay.slice(0,7),n=((scFin().nkc)||[]).concat(scCho()).filter(x=>String(x.ct||"").startsWith("PC-"+ym)).length+1;return "PC-"+ym+"-"+String(n).padStart(4,"0")}
function scForm(){
  const today=mhToday(),dm=scDM(),bps=(D().departments||[]).map(p=>p.n);
  openDrawerHTML(`<h2>Ghi phiếu chi</h2><p class="hint">Một khoản chi = một phiếu. Chị Thảo ghi, chị Huệ duyệt rồi mới vào sổ và nhập MISA. <button type="button" class="lnk" id="scf-thu">Ghi phiếu thu thay vì phiếu chi</button></p>
  <form class="frm" id="scf"><div class="row4"><label class="field">Số phiếu<input id="scf-so" value="${scSoPhieu(today)}" readonly></label><label class="field">Ngày chi<input type="date" id="scf-d" value="${today}" required></label></div>
   <div class="row4"><label class="field">Người đề nghị<input id="scf-dn" placeholder="Họ tên" required></label><label class="field">Bộ phận<select id="scf-bp">${opt(bps.map(x=>[x,x]),"")}</select></label></div>
   <div class="row4"><label class="field">Người nhận tiền<input id="scf-nn" placeholder="Tên người / đơn vị nhận"></label><label class="field">Hình thức<select id="scf-ht">${opt([["Chuyển khoản","Chuyển khoản"],["Tiền mặt","Tiền mặt"]],"Chuyển khoản")}</select></label></div>
   <div id="scf-ck" class="row4"><label class="field">Chi từ tài khoản công ty<select id="scf-from"><option value="">Đang tải…</option></select></label><label class="field">Chuyển đến (ngân hàng · số tài khoản)<input id="scf-to" placeholder="Ví dụ: MB · 0929927999"></label></div>
   <label class="field" id="scf-fxw" hidden>Tài khoản chi khác<input id="scf-fx" placeholder="Ngân hàng · số tài khoản · tên chủ tài khoản"></label>
   <label class="field">Nội dung chi (ghi rõ chi cho việc gì)<input id="scf-dg" required placeholder="Ví dụ: Cước xe giao hàng NPP Hải Dương"></label>
   <div class="row4"><label class="field">Nhóm chi phí<select id="scf-g">${opt(dm.map(x=>[x.g,x.g+" · "+x.n]),"")}</select></label><label class="field">Bổ vào (kênh / nơi chịu)<select id="scf-k">${opt(SC_COLS.slice(0,8).map(x=>[x,x]),"Chung")}</select></label></div>
   <div class="row4"><label class="field">Số tiền (đ)<input type="number" id="scf-t" min="1" required></label><label class="field">Chứng từ kèm (hóa đơn, ảnh chuyển khoản)<input type="file" id="scf-f" multiple accept="image/*,application/pdf"></label></div>
   <label class="field">Ghi chú<input id="scf-gc"></label><div id="scf-e"></div>
   <button class="btn pri">${scCanDuyet()?"Ghi vào sổ":"Gửi chị Huệ duyệt"}</button></form>
  <div class="note"><b>Quy ước:</b> không có phiếu thì không chi · nội dung không ghi chung chung "Chi phí" · phải chọn nơi chịu · đính kèm hóa đơn hoặc ảnh chuyển khoản. Trả tiền nhà cung cấp hàng, nguyên vật liệu: ghi ở Mua hàng (đi vào giá vốn).</div>`);
  /* Tiền đi từ tài khoản nào: chọn trong danh sách tài khoản công ty (Cấu hình) hoặc ghi tài khoản khác; chỉ hiện khi chuyển khoản. */
  const ckSw=()=>{const ck=$("#scf-ht").value==="Chuyển khoản";$("#scf-ck").hidden=!ck;if(!ck)$("#scf-fxw").hidden=true;else $("#scf-fxw").hidden=$("#scf-from").value!=="__x"};
  mhAccts().then(A=>{const sel=$("#scf-from");if(!sel)return;sel.innerHTML=`<option value="">— Chọn tài khoản chi tiền —</option>`+A.map(a=>`<option>${esc(mhAcctLabel(a))}</option>`).join("")+`<option value="__x">Tài khoản khác…</option>`;sel.onchange=ckSw;ckSw()});
  $("#scf-ht").onchange=ckSw;ckSw();
  const sug=()=>{const v=$("#scf-dg").value;if(v.length<3)return;const de=scDeXuat(v);$("#scf-g").value=de.g;if(SC_COLS.slice(0,8).includes(de.k))$("#scf-k").value=de.k};
  $("#scf-dg").onchange=sug;$("#scf-d").onchange=e=>{$("#scf-so").value=scSoPhieu(e.target.value)};
  $("#scf-thu").onclick=()=>{if(typeof cptQuick==="function")cptQuick()};
  $("#scf").onsubmit=async e=>{e.preventDefault();const t=+$("#scf-t").value,dg=$("#scf-dg").value.trim();
    if(!(t>0)||!dg){$("#scf-e").innerHTML=`<div class="note red">Nhập nội dung chi và số tiền.</div>`;return}
    if(/^chi ph[ií]$/i.test(dg)){$("#scf-e").innerHTML=`<div class="note red">Ghi rõ chi cho việc gì, không ghi mỗi chữ "Chi phí".</div>`;return}
    const ckOn=$("#scf-ht").value==="Chuyển khoản",fromAcc=ckOn?($("#scf-from").value==="__x"?$("#scf-fx").value.trim():$("#scf-from").value):"";
    if(ckOn&&!fromAcc){$("#scf-e").innerHTML=`<div class="note red">Chuyển khoản: chọn tài khoản công ty chi tiền (hoặc ghi tài khoản khác).</div>`;return}
    const btn=e.submitter;if(btn)btn.disabled=true;
    const ngay=$("#scf-d").value,row={id:uid("pc"),tkc:fromAcc,tkn:ckOn?$("#scf-to").value.trim():"",d:ngay,ct:scSoPhieu(ngay),lct:"Phiếu chi",dg,tk:$("#scf-ht").value==="Tiền mặt"?"1111":"1121",t,g:$("#scf-g").value,k:$("#scf-k").value,gc:$("#scf-gc").value.trim(),dn:$("#scf-dn").value.trim(),bp:$("#scf-bp").value,nn:$("#scf-nn").value.trim(),ht:$("#scf-ht").value,src:"phieu",by:ME.name,at:Date.now()};
    /* Từ ngưỡng chi (mặc định 5 triệu, chị Hoa chốt 27/10/2026): kế toán ghi cũng phải chờ chị Hoa duyệt mới vào sổ. */
    const lenCeo=scCanDuyet()&&scCanCeo(row.t);
    if(lenCeo)DB.mutate(ME.name,"ghi phiếu chi chờ CEO "+row.ct,dt=>{(dt.pcCho=dt.pcCho||[]).push({...row,st:"Chờ CEO duyệt",ceoCho:1,ktDuyet:ME.name,ktAt:Date.now()})});
    else if(scCanDuyet())DB.mutate(ME.name,"ghi phiếu chi "+row.ct,dt=>{dt.fin=dt.fin||{};(dt.fin.nkc=dt.fin.nkc||[]).push({...row,st:"Ổn",duyet:ME.name});(dt.fin.cpRule=dt.fin.cpRule||{})[scKey(dg)]={g:row.g,k:row.k,st:"Ổn"}});
    else DB.mutate(ME.name,"ghi phiếu chi chờ duyệt "+row.ct,dt=>{(dt.pcCho=dt.pcCho||[]).push({...row,st:"Chờ duyệt"})});
    let up=0;for(const f of [...$("#scf-f").files]){try{const x=await mhPrepFile(f);await kApi("/mh/costs/"+row.id+"/files",{method:"POST",body:JSON.stringify(x)});up++}catch(er){toast(er.message)}}
    closeDrawer();toast((lenCeo?"Khoản từ ngưỡng chi: đã gửi chị Hoa duyệt "+row.ct:scCanDuyet()?"Đã ghi "+row.ct+" vào sổ":"Đã gửi chị Huệ duyệt "+row.ct)+(up?", kèm "+up+" ảnh":""));SOCP.files=null;renderMain()}}
/* Khoản từ ngưỡng chi mà người duyệt không phải CEO: chị Huệ duyệt xong chuyển chị Hoa (nhãn "Chờ CEO duyệt"), chị Hoa duyệt mới vào sổ. */
const scIsCeo=()=>typeof crmRole==="function"&&crmRole()==="CEO";
const scCanCeo=t=>typeof pdNeedCeo==="function"&&pdNeedCeo(+t||0,typeof pdTh==="function"?pdTh():5e6,scIsCeo());
function scDuyet(id){const p=scCho().find(x=>x.id===id);if(!p)return;
  if(p.ceoCho&&!scIsCeo()){toast("Phiếu này đang chờ chị Hoa duyệt");return}
  if(!p.ceoCho&&scCanCeo(p.t)){DB.mutate(ME.name,"duyệt phiếu chi, chuyển CEO "+p.ct,dt=>{const r=(dt.pcCho||[]).find(x=>x.id===id);if(!r)return;r.ceoCho=1;r.ktDuyet=ME.name;r.ktAt=Date.now();r.st="Chờ CEO duyệt"});
    toast("Đã duyệt "+p.ct+". Khoản từ ngưỡng chi nên chuyển chị Hoa duyệt");closeDrawer();renderMain();return}
  DB.mutate(ME.name,"duyệt phiếu chi "+p.ct,dt=>{const i=(dt.pcCho||[]).findIndex(x=>x.id===id);if(i<0)return;const r=dt.pcCho.splice(i,1)[0];dt.fin=dt.fin||{};(dt.fin.nkc=dt.fin.nkc||[]).push({...r,st:"Ổn",duyet:ME.name,duyetAt:Date.now()});(dt.fin.cpRule=dt.fin.cpRule||{})[scKey(r.dg)]={g:r.g,k:r.k,st:"Ổn"}});
  toast("Đã duyệt "+p.ct);closeDrawer();renderMain()}
function scTuChoi(id){const p=scCho().find(x=>x.id===id);if(!p)return;if(p.ceoCho&&!scIsCeo()){toast("Phiếu này đang chờ chị Hoa duyệt");return}DB.mutate(ME.name,"trả lại phiếu chi "+p.ct,dt=>{dt.pcCho=(dt.pcCho||[]).filter(x=>x.id!==id)});toast("Đã trả lại "+p.ct);closeDrawer();renderMain()}
function scPhieu(x,cho){
  spLoadFiles();const nf=(SOCP.files||{})[x.id]||0,ed=scCanDuyet()&&!cho;
  openDrawerHTML(`<h2>Phiếu chi ${esc(x.ct||"")}</h2><p class="hint">${esc(scDd(x.d))}/${esc(String(x.d).slice(0,4))} · ${esc(x.lct||"")}${x.by?" · ghi bởi "+esc(x.by):""}${x.duyet?" · duyệt: "+esc(x.duyet):""}</p>
   <div class="tbl"><table><tbody><tr><td class="hint">Nội dung chi</td><td><b>${esc(x.dg)}</b></td></tr><tr><td class="hint">Số tiền</td><td><b>${scNf(x.t)} đ</b></td></tr>
   <tr><td class="hint">Nhóm chi phí</td><td>${ed?`<select id="scp-g">${opt(scDM().map(y=>[y.g,y.g+" · "+y.n]),x.g)}</select>`:esc(x.g+" · "+scG(x.g).n)}</td></tr>
   <tr><td class="hint">Bổ vào</td><td>${ed?`<select id="scp-k">${opt(SC_COLS.map(y=>[y,y]),x.k)}</select>`:esc(x.k)}</td></tr>
   <tr><td class="hint">TK đề xuất / đối ứng</td><td>${esc(scG(x.g).tk)} / ${esc(x.tk||"—")}</td></tr><tr><td class="hint">Loại</td><td>${scLoP(scG(x.g).lo)}</td></tr>
   <tr><td class="hint">Tình trạng</td><td>${ed?`<select id="scp-st">${opt([["Ổn","Ổn"],["Cần rà","Cần rà"]],x.st)}</select>`:scStP(x.st)}</td></tr>
   <tr><td class="hint">Ghi chú rà soát</td><td>${ed?`<input id="scp-gc" value="${esc(x.gc||"")}" style="width:100%">`:esc(x.gc||"—")}</td></tr>
   <tr><td class="hint">Người đề nghị · bộ phận</td><td>${esc([x.dn,x.bp].filter(Boolean).join(" · ")||"—")}</td></tr><tr><td class="hint">Người nhận · hình thức</td><td>${esc([x.nn,x.ht].filter(Boolean).join(" · ")||"—")}</td></tr>${x.tkc||x.tkn?`<tr><td class="hint">Tiền đi từ tài khoản</td><td>${esc(x.tkc||"—")}${x.tkn?`<br><small class="hint">Chuyển đến: ${esc(x.tkn)}</small>`:""}</td></tr>`:""}
   <tr><td class="hint">Chứng từ</td><td>${nf?nf+" ảnh":"chưa có"} <button type="button" class="btn sm" id="scp-f">Xem / thêm ảnh</button></td></tr></tbody></table></div>
   <p class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${ed?`<button class="btn pri" id="scp-luu">Lưu</button><button class="btn" id="scp-tach">Tách khoản</button>${x.g==="G28"&&typeof tsGhiTangTuPhieu==="function"?`<button class="btn" id="scp-ts">Ghi tăng tài sản / công cụ</button>`:""}<button class="btn danger" id="scp-xoa">Xóa dòng</button>`:""}${cho&&scCanDuyet()?`<button class="btn pri" id="scp-ok">Duyệt vào sổ</button><button class="btn danger" id="scp-tl">Trả lại</button>`:""}</p><div id="scp-cf"></div>`);
  $("#scp-f").onclick=()=>spFiles(x.id,x.dg);
  if($("#scp-tach"))$("#scp-tach").onclick=()=>scTach(x);
  if($("#scp-ts"))$("#scp-ts").onclick=()=>{closeDrawer();tsGhiTangTuPhieu(x.id)};
  if($("#scp-ok"))$("#scp-ok").onclick=()=>scDuyet(x.id);if($("#scp-tl"))$("#scp-tl").onclick=()=>scTuChoi(x.id);
  if($("#scp-luu"))$("#scp-luu").onclick=()=>{const v={g:$("#scp-g").value,k:$("#scp-k").value,st:$("#scp-st").value,gc:$("#scp-gc").value.trim()};
    DB.mutate(ME.name,"sửa dòng sổ chi "+(x.ct||""),dt=>{const r=((dt.fin||{}).nkc||[]).find(y=>y.id===x.id);if(r){if(r.k0==null&&r.k!==v.k)r.k0=r.k;Object.assign(r,v)}(dt.fin.cpRule=dt.fin.cpRule||{})[scKey(x.dg)]={g:v.g,k:v.k,st:v.st}});toast("Đã lưu");closeDrawer();renderMain()};
  if($("#scp-xoa"))$("#scp-xoa").onclick=()=>{$("#scp-cf").innerHTML=`<div class="note red">Xóa dòng ${esc(x.ct||"")} (${scNf(x.t)} đ) khỏi sổ? <button class="btn sm danger" id="scp-xoa2">Xóa</button></div>`;
    $("#scp-xoa2").onclick=()=>{DB.mutate(ME.name,"xóa dòng sổ chi "+(x.ct||""),dt=>{dt.fin.nkc=(dt.fin.nkc||[]).filter(y=>y.id!==x.id)});toast("Đã xóa");closeDrawer();renderMain()}};
}
/* ---------- Các tab ---------- */
/* Việc cần xử lý trước khi chốt tháng: web tự tính từ nhật ký, giống mục 5 của file phân bổ. */
function scViec(all){
  const S=scS,L=[],tr=v=>(v/1e6).toLocaleString("vi-VN",{maximumFractionDigits:2})+" triệu",so=all.filter(x=>x.src!=="phieu");
  const t641=S(so.filter(x=>scG(x.g).tk==="6421")),q642=S(so.filter(x=>scG(x.g).tk==="6422"));
  if(t641)L.push([`Ghi quảng cáo, phí sàn, vận chuyển đơn, hoa hồng vào tiểu khoản 6421 (chi phí bán hàng, ${tr(t641)}). Để chung một chỗ nên chi phí quản lý (6422) nhìn như ${tr(S(so))}, thực ra chỉ khoảng ${tr(q642)}.`,t641,{}]);
  const g23=all.filter(x=>x.g==="G23"),g20=all.filter(x=>x.g==="G20");
  if(g23.length||g20.length)L.push([`Hỏi người chi ${g23.length?g23.length+` dòng ghi mỗi chữ "Chi phí" (${tr(S(g23))})`:""}${g23.length&&g20.length?" và ":""}${g20.length?g20.length+` dòng chuyển nhầm (${tr(S(g20))})`:""} để ghi đúng chỗ.`,S(g23)+S(g20),{g:g23.length?"G23":"G20"}]);
  const vat=all.filter(x=>x.g==="G22");if(vat.length)L.push([`Rà ${vat.length} dòng "Tiền VAT" (${tr(S(vat))}): bản chất, chứng từ, hóa đơn tháng trước ghi vào tháng này. VAT đầu vào hợp lệ vào TK 133, không vào chi phí.`,S(vat),{g:"G22"}]);
  const tt=all.filter(x=>/\b([2-9]|\d{2,})\s*th[aá]ng\b|c[oọ]c\b/i.test(x.dg)&&!/th[aá]ng\s*\d{1,2}[.\/]\d{4}/i.test(x.dg));if(tt.length)L.push([`Các khoản trả trước ghi hết một lần: ${tt.slice(0,4).map(x=>x.dg).join("; ")}. Chuyển sang phân bổ (TK 242) hoặc trả trước.`,S(tt),{q:""}]);
  const lg=all.filter(x=>["G07","G08"].includes(x.g)&&["Chờ xác định","Chung"].includes(x.k));if(lg.length)L.push([`Chia lương, thưởng, bảo hiểm (${tr(S(lg))}) theo bộ phận và kênh thay vì dồn hết vào quản lý.`,S(lg),{g:"G07"}]);
  const kp=all.filter(x=>x.src!=="phieu");if(kp.length)L.push([`${kp.length} khoản chưa có phiếu chi (người đề nghị, kênh, chứng từ, người duyệt). Từ nay mọi khoản chi ghi bằng nút "＋ Ghi phiếu chi".`,S(kp),{}]);
  return L}
function scViecHtml(all,title){const L=scViec(all);if(!L.length)return "";const mark="①②③④⑤⑥⑦⑧";
  return `<section class="card pad"><h2>${title}</h2>${L.map(([t,v,f],i)=>`<div class="scviec${i%2?"":" od"}"><span>${mark[i]||i+1}</span><span>${esc(t)}</span>${f.g?`<button class="btn sm" data-go-g="${esc(f.g)}">Xem dòng</button>`:"<span></span>"}</div>`).join("")}</section>`}
/* Nhật ký chi đủ MỌI khoản tiền chi ra (chị Hoa 27/10): ngoài phiếu chi của sổ còn hiện chung một bảng
   các khoản đã nhập ở chỗ khác (spRows ở socp.js): chi phí nhập ở trang chi phí cũ, trả nhà cung cấp, phiếu chi vận chuyển,
   quảng cáo từng kênh (một dòng mỗi kênh, bấm ra chi tiết theo ngày), lương theo bảng lương.
   Quảng cáo, lương, vận chuyển còn được tính vào Tổng quan và Phân bổ theo kênh (scAuto); trả nhà cung cấp vào giá vốn nên không tính.
   Lương chỉ hiện khi kỳ lương đã chốt (bảng nháp chưa phải tiền đã chi, chị Hoa 27/10). */
const SC_NGUON={tay:"Chi phí đã nhập",ncc:"Mua hàng (giá vốn)",vc:"Phiếu chi vận chuyển",ads:"Báo cáo quảng cáo",luong:"Bảng lương"};
/* Quảng cáo TikTok chỉ lấy từ báo cáo TikTok đã tải (TSB.sum từng tháng), không lấy số tạm tính từ Poscake:
   tiền quảng cáo trong sổ chi phải là tiền thật. Tháng chưa tải báo cáo thì báo thiếu ở Nhật ký chi. */
function scTTAds(){const R={v:0,L:[]};
  try{const S=(typeof TSB!=="undefined"&&TSB.sum)||{};
    tqMonths(PERIOD.from,PERIOD.to).forEach(k=>{const s=S[k],mEnd=k+"-"+String(ttKyDays(k)).padStart(2,"0"),a=PERIOD.from>k+"-01"?PERIOD.from:k+"-01",b=PERIOD.to<mEnd?PERIOD.to:mEnd;
      if(!s||!s.dt||!(+s.ads)){R.L.push({k,v:null});return}
      const cov=s.den||mEnd;let r=1;
      if(!(a===k+"-01"&&b>=cov)){if(s.days){let x=0;Object.entries(s.days).forEach(([d,y])=>{if(d>=a&&d<=b&&d<=cov)x+=+y[0]||0});r=x/s.dt}else{const nd=Math.max(0,(pdate(b<cov?b:cov)-pdate(a))/864e5+1);r=nd/+cov.slice(8,10)}}
      const v=(+s.ads)*r;R.v+=v;R.L.push({k,v,den:s.den||""})})}catch(e){}
  return R}
function scExt(){
  const R=[];let L=[];try{L=spRows()}catch(e){}
  L.forEach(x=>{const kenh=x.src==="ncc"?"Giá vốn":x.kenh||(x.src==="vc"?"—":"Chung");
    R.push({id:"x-"+x.src+"-"+x.id,ext:x,d:x.ngay,ky:!!(x.kyOnly||x.thangOnly),ct:x.src==="ncc"?"Mua hàng":x.src==="vc"?(String(x.sub).match(/PCVC[\w-]*/)||[""])[0]:"",dg:x.src==="tay"?(x.sub||x.txt):x.txt,sub:x.src==="tay"?(x.sub?x.txt:""):x.sub,t:x.tien,nhom:x.src==="tay"?x.txt:x.nhom,k:kenh,st:"Ổn",nguon:SC_NGUON[x.src]||"Khác"})});
  /* Khoản không chi tiền mà trừ vào tiền sàn về (chị Huệ 28/10): phí sàn TikTok theo báo cáo TikTok đã tải, chỉ tháng nằm trọn trong kỳ. */
  try{const S=(typeof TSB!=="undefined"&&TSB.sum)||{};Object.keys(S).sort().forEach(ym=>{const s=S[ym],[y,m]=ym.split("-").map(Number),cuoi=ym+"-"+String(new Date(y,m,0).getDate()).padStart(2,"0");
    if(!s||!s.fees||ym+"-01"<PERIOD.from||cuoi>PERIOD.to)return;
    s.fees.forEach(([n,v],i)=>{v=Math.abs(+v||0);if(!v)return;R.push({id:"x-san-tt-"+ym+"-"+i,ext:{src:"san",id:"san-tt"},d:cuoi,ky:true,ct:"",dg:"Phí sàn TikTok · "+n,sub:"trừ vào tiền sàn về, không chi tiền · báo cáo TikTok tháng "+ym.slice(5)+"/"+ym.slice(0,4),t:v,nhom:"Phí sàn",k:"TikTok",st:"Ổn",nguon:"Báo cáo sàn (trừ ví)"})})})}catch(e){}
  try{let ym=PERIOD.from.slice(0,7);const het=PERIOD.to.slice(0,7);for(let i=0;i<36&&ym<=het;i++){const r=scTsThang(ym);if(r&&r.chay)(r.dong||[]).forEach((z,j)=>{if(!z.t||z.d<PERIOD.from||z.d>PERIOD.to)return;
      R.push({id:"x-ts-"+ym+"-"+j,ext:{src:"ts",id:"ts-"+ym,g:z.g,k:z.k},d:z.d,ky:false,ct:z.ct||"",dg:z.dg||("Khấu hao / phân bổ · "+(z.ten||z.ma||"")),sub:[z.ma,z.ten,"Nợ "+(z.tk||"")+" / Có "+(z.tkc||"")].filter(Boolean).join(" · "),t:+z.t,nhom:scG(z.g).n,k:z.k,st:"Ổn",nguon:"Khấu hao / phân bổ"})});
    const [y,m]=ym.split("-").map(Number);ym=m===12?(y+1)+"-01":y+"-"+String(m+1).padStart(2,"0")}}catch(e){}
  try{const C=execNums(PERIOD.from,PERIOD.to).C||{};if(C.adsSPE>0)R.push({id:"x-ads-spe",ext:{src:"ads",id:"ads-spe"},d:PERIOD.to,ky:true,ct:"",dg:"Quảng cáo Shopee",sub:"từ báo cáo lãi lỗ Shopee của tháng",t:C.adsSPE,nhom:"Marketing",k:"Shopee Mall",st:"Ổn",nguon:SC_NGUON.ads})}catch(e){}
  return R}
/* Chỉ số có nhưng chưa tải báo cáo hoặc chưa nhập số thì ghi "chưa có số", không đoán, không để 0 (chị Hoa 27/10). */
function scThieu(){const L=[],nk=scRows(),has=g=>nk.some(x=>x.g===g),th=m=>m.slice(5)+"/"+m.slice(0,4);
  if(!has("G02")){const m=scTTAds().L.filter(x=>x.v==null).map(x=>th(x.k));if(m.length)L.push({g:"G02",k:"TikTok",why:"Quảng cáo TikTok tháng "+m.join(", ")+": chưa tải báo cáo TikTok (Doanh thu › TikTok Shop › Tải file tháng)."})}
  if(!has("G03")){let c=0;try{c=+(execNums(PERIOD.from,PERIOD.to).C||{}).adsSPE||0}catch(e){}if(!c)L.push({g:"G03",k:"Shopee Mall",why:"Quảng cáo Shopee: web chưa có số từ báo cáo Shopee. Ghi phiếu chi hoặc nạp sổ nhóm G03."})}
  if(!has("G07")){let lg=null;try{lg=cpLuongAuto()}catch(e){}if(!(lg&&lg.chot))L.push({g:"G07",k:"Chung",why:"Lương: bảng lương tháng chưa chốt (Nhân sự › Bảng lương), hoặc ghi phiếu chi nhóm G07."})}
  return L}
const scThieuHtml=()=>{const L=scThieu();return L.length?`<div class="note" style="margin:0 16px 10px"><b>Chưa có số:</b><ul style="margin:4px 0 0 18px;padding:0">${L.map(x=>`<li>${esc(x.why)}</li>`).join("")}</ul></div>`:""};
/* Khoản nhập ở mục khác được tính vào Tổng quan và Phân bổ theo kênh, gắn đúng nhóm chi phí:
   quảng cáo → G01/G02/G03 theo kênh, lương đã chốt → G07 theo kênh của bảng lương, phiếu chi vận chuyển → G09 (cước xe NPP).
   Sổ đã có dòng quảng cáo (tiền nạp) hoặc lương của nhóm đó trong kỳ thì không cộng thêm, tránh tính hai lần. */
function scAuto(){
  const nk=scRows(),has=g=>nk.some(x=>x.g===g),R=[];
  scExt().forEach(x=>{const s=x.ext.src;let g="",k=x.k;
    if(s==="ads"){g={"ads-fb":"G01","ads-tt":"G02","ads-spe":"G03"}[x.ext.id];if(has(g))return}
    else if(s==="luong"){g="G07";if(has(g))return;k=scKenhChuan(k)||"Chung"}
    else if(s==="vc"){g="G09";k="NPP";if(has(g))return}
    else if(s==="san"){g="G04";if(has(g))return}
    else if(s==="ts"){g=x.ext.g;k=SC_COLS.includes(x.ext.k)?x.ext.k:"Chung"}
    if(!g)return;R.push({...x,g,k,tk:scG(g).tk,nhom:scG(g).n,auto:1})});
  return R}
const scPBRows=()=>scRows().concat(scAuto());
/* Chi tiết một dòng quảng cáo: tiền chạy theo ngày (Facebook chia theo người chạy). */
function scAdsDetail(id){
  const inP=k=>k>=PERIOD.from&&k<=PERIOD.to,days={},who={};let ten="",ghi="";
  if(id==="ads-fb"){ten="Quảng cáo Facebook";ghi="Tiền chạy theo chiến dịch Facebook, đã cộng 10% thuế, gộp theo người chạy.";
    for(const nv in DAYD.ads||{})for(const k in DAYD.ads[nv])if(inP(k)){const v=(+DAYD.ads[nv][k][0]||0)*(1+FB_ADS_TAX);if(!v)continue;(days[k]=days[k]||{})[nv]=v;who[nv]=(who[nv]||0)+v}}
  else if(id==="ads-tt"){const T=scTTAds();openDrawerHTML(`<h2>Quảng cáo TikTok GMV Max</h2><p class="hint">${pLabel()} · lấy từ báo cáo TikTok đã tải (theo tháng), đã gồm thuế.</p><div class="tbl"><table><thead><tr><th>Tháng</th><th class="n">Tiền quảng cáo</th></tr></thead><tbody>${T.L.map(x=>`<tr><td>${x.k.slice(5)}/${x.k.slice(0,4)}${x.den?` <span class="hint">· báo cáo đến ${scDd(x.den)}</span>`:""}</td><td class="n">${x.v==null?'<span class="hint">chưa tải báo cáo</span>':scNf(x.v)}</td></tr>`).join("")}<tr class="tot"><td>Cộng</td><td class="n">${scNf(T.v)}</td></tr></tbody></table></div>`);return}
  else{openDrawerHTML(`<h2>Quảng cáo Shopee</h2><p class="hint">Shopee chỉ có số cả tháng trong báo cáo lãi lỗ Shopee, chưa có số theo ngày.</p>`);return}
  const ks=Object.keys(days).sort(),ws=Object.keys(who).sort((a,b)=>who[b]-who[a]),many=ws.length>1,dsum=k=>Object.values(days[k]).reduce((a,b)=>a+b,0),tot=ks.reduce((t,k)=>t+dsum(k),0);
  openDrawerHTML(`<h2>${ten}</h2><p class="hint">${pLabel()} · ${ghi}</p>
   ${many?`<div class="tbl"><table><thead><tr><th>Người chạy</th><th class="n">Tiền chạy</th></tr></thead><tbody>${ws.map(w=>`<tr><td>${esc(w)}</td><td class="n">${scNf(who[w])}</td></tr>`).join("")}</tbody></table></div>`:""}
   ${ks.length?`<div class="tbl"><table><thead><tr><th>Ngày</th>${many?ws.map(w=>`<th class="n">${esc(w)}</th>`).join(""):""}<th class="n">Cộng</th></tr></thead><tbody>${ks.map(k=>`<tr><td>${scDd(k)}</td>${many?ws.map(w=>`<td class="n">${days[k][w]?scNf(days[k][w]):""}</td>`).join(""):""}<td class="n"><b>${scNf(dsum(k))}</b></td></tr>`).join("")}
   <tr class="tot"><td>Cộng ${ks.length} ngày</td>${many?ws.map(w=>`<td class="n">${scNf(who[w])}</td>`).join(""):""}<td class="n">${scNf(tot)}</td></tr></tbody></table></div>`:`<p class="empty">Chưa có số theo ngày trong kỳ này.</p>`}`)}
function scExtOpen(r){const x=r.ext||{};
  if(x.src==="ads")return scAdsDetail(x.id);
  if(x.src==="luong"){PAGE="cp_luong";try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}render();scrollTo(0,0);return}
  if(typeof x.open==="function")return x.open();
  openDrawerHTML(`<h2>${esc(r.dg)}</h2><div class="tbl"><table><tbody>${[["Ngày",r.ky?"cả kỳ":scDd(r.d)],["Số tiền",scNf(r.t)+" đ"],["Nhóm",r.nhom],["Kênh / nơi chịu",r.k],["Ghi chú",r.sub],["Nguồn",r.nguon+(x.ht?" · "+x.ht:"")+(x.acc?" · "+x.acc:"")]].filter(z=>z[1]).map(([a,b])=>`<tr><td class="hint">${a}</td><td>${esc(b)}</td></tr>`).join("")}</tbody></table></div>`)}
function scNK(){
  try{mhLoad();mhLoadPay();spLoadShip()}catch(e){}
  try{if(typeof adfLoad==="function"&&!ADF.raw&&!SC.adf){SC.adf=1;adfLoad().then(()=>{try{adfMergeDays()}catch(e){}if(PAGE==="so_cp")renderMain()})}}catch(e){}
  const q=kfold(SC.q||""),QT=scQT(PERIOD.from.slice(0,7)).qt,cho=scCho().filter(scInP),AU=new Map(scAuto().map(x=>[x.id,x])),ext=scExt().filter(x=>x.ext.src!=="ncc").map(x=>AU.get(x.id)||x),all=SC.nkv==="mh"?scExt().filter(x=>x.ext.src==="ncc"):scRows().concat(cho,ext),R=all.filter(x=>(!SC.g||x.g===SC.g)&&(!SC.k||x.k===SC.k)&&(!SC.st||x.st===SC.st)&&(!SC.fn||scFnRow(x)===SC.fn)&&(!SC.xl||scXL(x,QT)===SC.xl)&&(!q||kfold(x.dg+" "+x.ct+" "+(x.sub||"")+" "+(x.nhom||"")).includes(q))).sort((a,b)=>String(a.d).localeCompare(String(b.d))||((a.ky?1:0)-(b.ky?1:0))||String(a.ct).localeCompare(String(b.ct)));
  const ed=scCanDuyet(),gs=scDM().map(x=>x.g),RE=R.filter(x=>x.ext&&!x.auto),sE=scS(RE);
  const row=x=>{if(x.ext)return `<tr class="clk" data-x="${esc(x.id)}"><td>${x.ky?'<span class="hint">cả kỳ</span>':scDd(x.d)}</td><td class="mono">${esc(x.ct||"")}</td><td>${esc(x.dg)}${x.sub?`<div class="hint">${esc(x.sub)}</div>`:""}</td><td class="n"><b>${scNf(x.t)}</b></td><td>${esc(x.nhom||"")}</td><td>${esc(x.tk||"")}</td><td><span class="scp p-c">${esc(x.nguon)}</span></td><td>${esc(SC_TEN(x.k))}</td><td>${esc(scFnRow(x))}</td><td>${scXLP(scXL(x,QT))}</td><td>${scStP(x.st)}</td></tr>`;
    const d=scG(x.g),isCho=x.st==="Chờ duyệt";return `<tr class="clk" data-id="${x.id}"${isCho?' data-cho="1"':""}><td>${scDd(x.d)}</td><td class="mono">${esc(x.ct||"")}</td><td>${esc(x.dg)}${x.gc?`<div class="hint">${esc(x.gc)}</div>`:""}</td><td class="n"><b>${scNf(x.t)}</b></td><td>${esc(d.n)}</td><td>${esc(d.tk)}</td><td>${scLoP(d.lo)}</td><td>${ed&&!isCho?`<select class="scbv${x.k0&&x.k0!==x.k?" doi":""}" data-bv="${x.id}" aria-label="Bổ khoản chi vào">${SC_COLS.map(k=>`<option value="${k}"${x.k===k?" selected":""}>${esc(SC_TEN(k))}</option>`).join("")}</select>${x.k0&&x.k0!==x.k?`<div class="hint">đã đổi từ ${esc(x.k0)}</div>`:""}`:esc(SC_TEN(x.k))}</td><td>${esc(scFnRow(x))}</td><td>${scXLP(scXL(x,QT))}</td><td>${scStP(x.st)}</td></tr>`};
  return `<section class="card flush"><div class="sch pad"><h2>Nhật ký chi</h2><span class="scseg" role="group"><button type="button" data-nkv="cp" class="${SC.nkv==="mh"?"":"on"}">Chi phí</button><button type="button" data-nkv="mh" class="${SC.nkv==="mh"?"on":""}">Chi phí NVL</button></span><span class="hint">mọi khoản tiền chi ra trong kỳ · bấm dòng để xem chi tiết · nhãn xám = khoản nhập ở mục khác, tự hiện</span><span class="sp"></span>
   <select id="scf-fg"><option value="">Tất cả nhóm chi phí</option>${gs.map(g=>`<option value="${g}"${SC.g===g?" selected":""}>${g} · ${esc(scG(g).n)}</option>`).join("")}</select>
   <select id="scf-fk"><option value="">Tất cả nơi chịu</option>${SC_COLS.map(k=>`<option value="${k}"${SC.k===k?" selected":""}>${esc(SC_TEN(k))}</option>`).join("")}</select>
   <select id="scf-fn"><option value="">Tất cả chức năng</option>${SC_FN.map(f=>f[1]).map(n=>`<option${SC.fn===n?" selected":""}>${n}</option>`).join("")}</select>
   <select id="scf-fx"><option value="">Mọi cách xử lý</option>${Object.keys(SC_XLC).map(n=>`<option${SC.xl===n?" selected":""}>${n}</option>`).join("")}</select>
   <select id="scf-fs"><option value="">Mọi tình trạng</option>${["Ổn","Cần rà","Chờ duyệt"].map(s=>`<option${SC.st===s?" selected":""}>${s}</option>`).join("")}</select>
   <input id="scf-fq" placeholder="Tìm diễn giải, số chứng từ…" value="${esc(SC.q||"")}"></div>
  ${!MH.pay||!SOCP.ship?`<p class="hint pad">Đang tải các khoản chi ở Mua hàng và Vận chuyển…</p>`:""}
  ${scThieuHtml()}
  ${R.length?`<div class="tbl"><table><thead><tr><th>Ngày</th><th>Số CT</th><th>Diễn giải</th><th class="n">Số tiền</th><th>Nhóm chi phí</th><th>TK</th><th>Loại / nguồn</th><th>Bổ vào (kênh / nơi chịu)</th><th>Chức năng</th><th>Cách xử lý</th><th>Tình trạng</th></tr></thead><tbody>
  ${R.map(row).join("")}
  <tr class="tot"><td colspan="3">Cộng ${R.length} khoản${R.length<all.length?" (đang lọc)":""}</td><td class="n">${scNf(scS(R))}</td><td colspan="7"></td></tr>
  ${RE.length?`<tr><td colspan="3" class="hint">trong đó tính vào Phân bổ theo kênh (phiếu chi, quảng cáo, lương đã chốt, vận chuyển)</td><td class="n">${scNf(scS(R)-sE)}</td><td colspan="7"></td></tr><tr><td colspan="3" class="hint">trong đó chi phí NVL trả nhà cung cấp (vào giá thành theo định mức, không phân bổ)</td><td class="n">${scNf(sE)}</td><td colspan="7"></td></tr>`:""}</tbody></table></div>`:`<p class="empty pad">${all.length?"Không có khoản nào khớp bộ lọc.":"Chưa có khoản chi nào trong kỳ này."}</p>`}</section>`}
/* Doanh thu thực tự lấy để chia chi chung: dùng hàm doanh thu chung của web (dtShownMonth, chat Doanh thu 27/10),
   chưa có hàm đó thì lấy execNums như trước. Shopee là số chung 2 shop nên Mall / thường vẫn nhập tay. */
function scAutoDT(ym){const o={};
  /* Chỉ lấy số thật: kênh còn tạm tính hoặc báo cáo chưa phủ đủ tháng thì để trống cho chị nhập (chị Hoa 27/10). */
  try{if(typeof dtShownMonth==="function"){const r=dtShownMonth(ym),v=x=>x&&x.dt!=null&&+x.dt>0&&!x.tam&&!x.thieu?+x.dt:0;o["TikTok"]=v(r.tts);o["Facebook"]=v(r.fb);o["NPP"]=v(r.b2b);o["Gia công"]=v(r.gc)}}catch(e){}
  return o}
/* =====================================================================
   PHÂN BỔ THEO KÊNH dạng bảng điều hành (chị Hoa 27/10): mỗi kênh có chi phí gì, cơ cấu ra sao, so cùng kỳ tháng trước,
   cảnh báo và đề xuất. Chỉ dùng số thật: chỉ số chưa có báo cáo / chưa nhập thì ghi "chưa có số", không đoán.
   - So sánh: kỳ là một tháng thì so với tháng trước; tháng đang chạy thì so cùng số ngày (1–27/10 với 1–27/9).
     Tổng so sánh chỉ cộng các nhóm tháng này đã có số, để nhóm "chưa có số" không làm chi phí trông như giảm.
   - Cảnh báo: quảng cáo trên doanh thu thực vượt ngưỡng (Ngưỡng cảnh báo, mặc định 38%); chi phí kênh tăng trên 20% và
     trên 5 triệu so cùng kỳ (chỉ ra nhóm làm tăng); thiếu số; tiền chưa biết bổ cho kênh nào.
   ===================================================================== */
const scQcMax=()=>{try{return +dhGet().nguong.qcMax||0.38}catch(e){return 0.38}};
function scKyTruoc(){
  const f=PERIOD.from,t=PERIOD.to,ym=f.slice(0,7);if(t.slice(0,7)!==ym||f.slice(8)!=="01")return null;
  const [y,m]=ym.split("-").map(Number),pym=iso(new Date(y,m-2,1)).slice(0,7),last=new Date(y,m-1,0).getDate(),today=mhToday(),full=t<today;
  const dd=full?last:Math.min(+today.slice(8,10),last);
  return {from:pym+"-01",to:pym+"-"+String(dd).padStart(2,"0"),ym:pym,full,nhan:full?"tháng "+pym.slice(5)+"/"+pym.slice(0,4):`cùng kỳ 01–${String(dd).padStart(2,"0")}/${pym.slice(5)}`}}
/* Số của kỳ trước: tạm đổi kỳ để dùng lại đúng cách tính, rồi trả kỳ về như cũ. Phiếu chi vận chuyển kỳ trước tải riêng. */
function scPrev(){
  const K=scKyTruoc();if(!K)return null;const key=K.from+"|"+K.to;
  if(!SC.pvShip||SC.pvShip.key!==key){const o={key,data:null};SC.pvShip=o;
    svApi("/api/shipping-vouchers?from="+K.from+"&to="+K.to).then(d=>{o.data=Array.isArray(d)?d:[]}).catch(()=>{o.data=[]}).finally(()=>{if(PAGE==="so_cp"&&["tq","cn","kenh","pb"].includes(SC.tab))renderMain()})}
  const o={f:PERIOD.from,t:PERIOD.to,s:SOCP.ship};let R=null;
  try{PERIOD.from=K.from;PERIOD.to=K.to;SOCP.ship=SC.pvShip.data||[];const rows=scPBRows();R={...K,rows,chia:scChiaPB(rows),dang:!SC.pvShip.data}}catch(e){}
  finally{PERIOD.from=o.f;PERIOD.to=o.t;SOCP.ship=o.s}
  return R}
const scAgg=rows=>{const A={};SC_COLS.forEach(c=>A[c]={});rows.forEach(x=>{const c=SC_COLS.includes(x.k)?x.k:"Chờ xác định";A[c][x.g]=(A[c][x.g]||0)+(+x.t||0)});return A};
const scSum=o=>Object.values(o||{}).reduce((a,b)=>a+b,0);
function scDtThang(){const ym=PERIOD.from.slice(0,7),auto=scAutoDT(ym),saved=((scFin().cpDT||{})[ym])||{},DT={},thieu=[];
  SC_KENH.forEach(k=>{if(saved[k]!=null&&saved[k]!=="")DT[k]=+saved[k];else if(auto[k])DT[k]=auto[k];else{DT[k]=null;thieu.push(k)}});return {DT,thieu,auto,saved}}
const SC_TEN=k=>k==="Chung"?"Chi chung công ty":k==="Sản xuất"?"Sản xuất":k==="NPP"?"Kênh phân phối":k==="Gia công"?"Kênh OEM":k==="Shopee Mall"?"Shopee Aillavn":k==="Shopee thường"?"Shopee Aillavn1":k;
/* Mở thẳng tab Tổng quan / Phân bổ: tự tải mua hàng, vận chuyển, doanh thu thực (dtEnsure của trang Doanh thu) rồi vẽ lại khi có số. */
function scNap(){try{mhLoad();mhLoadPay();spLoadShip()}catch(e){}
  try{if(typeof dtEnsure==="function"){dtEnsure();if(typeof DTS!=="undefined"&&!DTS.rowsAt&&!SC.dtw){SC.dtw=1;let n=0;const w=()=>{if(DTS.rowsAt||++n>25){SC.dtw=0;if(PAGE==="so_cp")renderMain()}else setTimeout(w,800)};setTimeout(w,800)}}}catch(e){}
  /* doanh thu Kênh phân phối / OEM lấy từ CRM tải chậm hơn: vẽ lại thêm hai lần ở lần mở đầu */
  if(!SC.rr){SC.rr=1;[2500,7000].forEach(t=>setTimeout(()=>{if(PAGE==="so_cp"&&["tq","cn","kenh","pb"].includes(SC.tab)&&!(typeof svTyping==="function"&&svTyping()))renderMain()},t))}}
function scPBBang(){
  const rows=scPBRows();if(!rows.length)return scEmpty();
  const TH=scThieu(),thK=(g,c)=>TH.some(x=>x.g===g&&x.k===c),thC=c=>TH.some(x=>x.k===c),CS='<span class="hint">chưa có số</span>';
  const gs=[...new Set(rows.map(x=>x.g).concat(TH.map(x=>x.g)))].sort(),M={};gs.forEach(g=>{M[g]={};SC_COLS.forEach(c=>M[g][c]=0)});rows.forEach(x=>{const c=SC_COLS.includes(x.k)?x.k:"Chờ xác định";M[x.g][c]+=x.t});
  const colT=c=>gs.reduce((t,g)=>t+M[g][c],0),chung=colT("Chung"),ym=PERIOD.from.slice(0,7),oneM=PERIOD.to.slice(0,7)===ym;
  const auto=scAutoDT(ym),saved=((scFin().cpDT||{})[ym])||{},DT={};SC_KENH.forEach(k=>DT[k]=saved[k]!=null&&saved[k]!==""?+saved[k]:(auto[k]||0));
  const dts=SC_KENH.reduce((t,k)=>t+DT[k],0),f=v=>v?scNf(v):'<span class="hint">—</span>',ed=scCanDuyet()&&oneM;
  const DTthieu=SC_KENH.filter(k=>!(saved[k]!=null&&saved[k]!=="")&&!auto[k]),CH=scChiaPB(rows),shK=k=>Object.values(CH.kenh[k]||{}).reduce((a,b)=>a+b,0),conT=CH.con.reduce((a,x)=>a+x.t,0);
  return `<section class="card flush"><div class="sch pad"><h2>Phân bổ theo kênh</h2><span class="hint">hàng = nhóm chi phí · cột = kênh / nơi chịu · gồm cả quảng cáo, lương đã chốt, vận chuyển · đổi chỗ bổ ở tab Nhật ký chi</span></div><div class="tbl"><table class="scpbt"><colgroup><col class="c-n"><col class="c-tk">${SC_COLS.map(()=>`<col class="c-v">`).join("")}<col class="c-t"></colgroup><thead><tr><th>Nhóm chi phí</th><th>TK</th>${SC_COLS.map(c=>`<th class="n">${esc(SC_TEN(c))}</th>`).join("")}<th class="n">Tổng</th></tr></thead><tbody>
  ${gs.map(g=>`<tr><td><span class="mono">${esc(g)}</span> ${esc(scG(g).n)}</td><td>${esc(scG(g).tk)}</td>${SC_COLS.map(c=>`<td class="n">${!M[g][c]&&thK(g,c)?CS:f(M[g][c])}</td>`).join("")}<td class="n"><b>${(()=>{const v=SC_COLS.reduce((t,c)=>t+M[g][c],0);return !v&&TH.some(x=>x.g===g)?CS:scNf(v)})()}</b></td></tr>`).join("")}
  <tr class="tot"><td colspan="2">Tổng cộng</td>${SC_COLS.map(c=>`<td class="n">${f(colT(c))}${thC(c)?'<div class="hint">còn thiếu số</div>':""}</td>`).join("")}<td class="n">${scNf(scS(rows))}${TH.length?'<div class="hint">còn thiếu số</div>':""}</td></tr></tbody></table></div>${scThieuHtml()}</section>
  <section class="card pad"><div class="sch"><h2>Chia chi chung về kênh theo quy tắc phân bổ</h2><span class="hint">${CH.chot?"tháng đã chốt (bản "+CH.chot.v+")":"chưa chốt, đang dùng quy tắc hiện tại"}</span>${ed?`<span class="sp"></span><button class="btn sm" id="scdt-ed">Sửa doanh thu thực</button>`:""}</div><div class="tbl"><table><thead><tr><th>Kênh</th><th class="n">Doanh thu thực</th><th class="n">Chi ghi thẳng</th><th class="n">Chi chung được chia</th><th class="n">Tổng sau phân bổ</th><th class="n">% doanh thu</th></tr></thead><tbody>
  ${SC_KENH.map(k=>{const sh=shK(k),tt=colT(k)+sh;return `<tr><td><b>${esc(SC_TEN(k))}</b></td><td class="n">${DTthieu.includes(k)?CS:scNf(DT[k])}${saved[k]==null&&auto[k]?' <span class="hint">tự lấy</span>':""}</td><td class="n">${f(colT(k))}</td><td class="n">${f(sh)}</td><td class="n"><b>${f(tt)}</b></td><td class="n">${!DTthieu.includes(k)&&DT[k]?scPc(tt,DT[k]):CS}</td></tr>`}).join("")}
  <tr><td>Còn ở chi chung công ty</td><td></td><td></td><td class="n">${f(conT)}</td><td class="n">${f(conT)}</td><td></td></tr>
  <tr class="tot"><td>Tổng</td><td class="n">${DTthieu.length?'<span class="hint">chưa đủ</span>':scNf(dts)}</td><td class="n">${scNf(SC_KENH.reduce((t,k)=>t+colT(k),0))}</td><td class="n">${scNf(CH.truoc)}</td><td class="n">${scNf(SC_KENH.reduce((t,k)=>t+colT(k),0)+CH.truoc)}</td><td></td></tr></tbody></table></div>
  <p class="hint">Kiểm tra: chi chung trước chia ${scNf(CH.truoc)} đ, sau chia ${scNf(CH.sau)} đ ${Math.abs(CH.truoc-CH.sau)<1?"✓ khớp":"✗ lệch, báo kế toán"}. ${CH.loi.length?"Chưa chia được: "+esc(CH.loi.join("; "))+". ":""}Cách chia từng nhóm đặt ở tab "Quy tắc phân bổ". Shopee Aillavn, Aillavn1 chị Huệ nhập doanh thu thực (bấm "Sửa doanh thu thực"). Không chia: "Chờ xác định" ${scNf(colT("Chờ xác định"))} đ (phải rà), "Sản xuất" ${scNf(colT("Sản xuất"))} đ (vào giá thành), "Không tính" ${scNf(colT("Không tính"))} đ.</p></section>`}
function scRS(){
  const rows=scRows(),ra=rows.filter(x=>x.st!=="Ổn"),cxd=rows.filter(x=>x.k==="Chờ xác định"),cho=scCho().filter(scInP);
  const by={};ra.forEach(x=>{const o=by[x.g]||(by[x.g]={n:0,t:0,gc:new Set()});o.n++;o.t+=x.t;if(x.gc)o.gc.add(x.gc)});const G=Object.entries(by).sort((a,b)=>b[1].t-a[1].t);
  return `${scViecHtml(rows,"Việc cần xử lý trước khi chốt số tháng")}<section class="card pad"><h2>Chờ xử lý: các dòng chưa đủ căn cứ</h2><p class="hint">Tự gom từ Nhật ký chi: các dòng ghi "Cần rà", dòng chưa biết bổ vào đâu, phiếu chưa duyệt. Xếp theo số tiền.</p>
  ${cho.length?`<div class="scrs"><div><b>Phiếu chi chờ chị Huệ duyệt</b><div class="hint">${cho.map(x=>esc(x.ct+" "+x.dg)).slice(0,6).join(" · ")}${cho.length>6?" …":""}</div></div><div class="m">${scNf(scS(cho))} đ<div class="hint">${cho.length} phiếu</div><button class="btn sm" data-go-st="Chờ duyệt">Xem</button></div></div>`:""}
  ${cxd.length?`<div class="scrs"><div><b>Chưa biết bổ vào kênh nào ("Chờ xác định")</b><div class="hint">Chọn "Bổ vào" cho từng dòng ở Nhật ký chi để chia đúng kênh.</div></div><div class="m">${scNf(scS(cxd))} đ<div class="hint">${cxd.length} khoản</div><button class="btn sm" data-go-k="Chờ xác định">Xem</button></div></div>`:""}
  ${G.map(([g,o])=>`<div class="scrs"><div><b>${esc(g)} · ${esc(scG(g).n)}</b><div class="hint">${esc([...o.gc].slice(0,3).join(" · ")||scG(g).gc||"")}</div></div><div class="m">${scNf(o.t)} đ<div class="hint">${o.n} khoản</div><button class="btn sm" data-go-g="${esc(g)}">Xem</button></div></div>`).join("")}
  ${!G.length&&!cxd.length&&!cho.length?`<p class="empty">Không còn khoản nào cần rà soát trong kỳ này.</p>`:""}</section>`}
function scDMtab(){
  const ed=scCanDuyet(),all=scRows(),byTK={};all.forEach(x=>{const k=scG(x.g).tk||"?";byTK[k]=(byTK[k]||0)+x.t});const T=scS(all);
  return `<section class="card flush"><div class="sch pad"><h2>Danh mục chi phí</h2><span class="hint">${ed?"chị Huệ sửa ở đây thì mọi báo cáo đổi theo":"chỉ kế toán sửa"}</span></div><div class="tbl"><table><thead><tr><th>Mã</th><th>Nhóm chi phí</th><th>TK (Thông tư 133)</th><th>Loại</th><th>Phân bổ xuống kênh</th><th>Cố định / biến đổi</th><th>Cách hạch toán</th></tr></thead><tbody>
  ${scDM().map((x,i)=>`<tr><td class="mono">${esc(x.g)}</td><td>${ed?`<input data-dm="${i}" data-f="n" value="${esc(x.n)}" style="width:100%">`:`<b>${esc(x.n)}</b>`}</td><td>${ed?`<select data-dm="${i}" data-f="tk">${opt(["6421","6422","154.1","154.2","154","152","138","CHIA"].map(v=>[v,v]),x.tk)}</select>`:esc(x.tk)}</td><td>${ed?`<select data-dm="${i}" data-f="lo">${opt(["A - Trực tiếp kênh","B - Phòng ban","C - Chi chung","Giá vốn","Chờ xác định","Không tính"].map(v=>[v,v]),x.lo)}</select>`:scLoP(x.lo)}</td><td>${scDMpb(x,ed)}</td><td>${ed?`<select data-dm="${i}" data-f="cd">${opt([["1","Cố định"],["0","Biến đổi"]],x.cd?"1":"0")}</select>`:(x.cd?"Cố định":"Biến đổi")}</td><td>${ed?`<input data-dm="${i}" data-f="gc" value="${esc(x.gc||"")}" style="width:100%">`:`<span class="hint">${esc(x.gc||"")}</span>`}</td></tr>`).join("")}</tbody></table></div></section>
  <section class="card pad"><h2>Định nghĩa chi phí theo tài khoản</h2><p class="hint">Mỗi nhóm chi phí ở trên gắn một tài khoản. Bảng này cho biết từng tài khoản là loại chi phí gì${T?" và kỳ này có bao nhiêu":""}.</p><div class="tbl"><table><thead><tr><th>TK</th><th>Bản chất</th><th class="n">Kỳ này</th><th class="n">%</th></tr></thead><tbody>${Object.keys(SC_TKN).map(k=>`<tr><td><b>${k}</b></td><td>${SC_TKN[k]}</td><td class="n">${byTK[k]?scNf(byTK[k]):"—"}</td><td class="n">${byTK[k]?scPc(byTK[k],T):"—"}</td></tr>`).join("")}${T?`<tr class="tot"><td colspan="2">Tổng sổ</td><td class="n">${scNf(T)}</td><td class="n">100%</td></tr>`:""}</tbody></table></div></section>`}
function scEmpty(){return `<section class="card pad"><h2>Chưa có số chi trong kỳ ${esc(pLabel())}</h2><p class="hint">${scCanDuyet()?`Bấm "Nạp sổ từ file" để đưa sổ cái TK 642 từ MISA (hoặc file phân bổ) vào, hoặc "＋ Ghi phiếu chi" để ghi từng khoản. Số tháng 9 có sẵn trong file "AILLA_Phan_bo_chi_phi_T09-2026".`:`Chị Thảo bấm "＋ Ghi phiếu chi" để ghi từng khoản; chị Huệ duyệt xong khoản chi hiện ở đây.`}</p></section>`}
const SC_CSS=`.sochi .sch{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}.sochi .sch h2{margin:0;white-space:nowrap}.sochi .sch.pad{padding:14px 16px 6px}.sochi .sp{flex:1}
.sochi .sctabs{display:flex;gap:4px;border-bottom:1px solid #e3e6ee;margin-bottom:14px;overflow-x:auto}.sochi .sctabs button{border:0;background:none;padding:9px 12px;color:#667085;font:600 14px inherit;font-family:inherit;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}.sochi .sctabs button.on{color:#5146c8;border-color:#5146c8}
.sochi .sck3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px}.sochi .sck5{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px}
.sochi .sckpi{background:#fff;border:1px solid #e3e6ee;border-radius:12px;padding:12px 14px;min-width:0}.sochi .sckpi .l{color:#667085;font-size:13px}.sochi .sckpi .v{font-size:24px;font-weight:700;margin:2px 0;font-variant-numeric:tabular-nums}.sochi .sck5 .sckpi .v{font-size:18px}.sochi .sckpi .h{font-size:12px;color:#667085}.sochi .sckpi.red .v{color:#c9353d}
.sochi .sctwo{display:grid;grid-template-columns:1fr 1fr;gap:14px}.sochi .sccc{display:grid;grid-template-columns:1fr 1fr;gap:0 32px}
.sochi .scbar{display:grid;grid-template-columns:minmax(210px,1.5fr) 1.4fr minmax(130px,auto);align-items:center;gap:10px;margin:6px 0;font-size:13px}.sochi .scbar .tr{background:#e9ebf3;border-radius:6px;height:10px}.sochi .scbar i{display:block;height:10px;border-radius:6px;background:#5146c8}.sochi .scbar .t{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.sochi .scp{display:inline-block;font-size:11.5px;border-radius:6px;padding:1px 7px;white-space:nowrap}.sochi .p-ok{background:#e5f5ea;color:#23824a}.sochi .p-ra{background:#fff1e3;color:#a95a10}.sochi .p-a{background:#eeecff;color:#5146c8}.sochi .p-b{background:#f4ecff;color:#8a3fd0}.sochi .p-c{background:#eef0f4;color:#667085}
.sochi .scdays{display:flex;align-items:flex-end;gap:3px;height:140px;padding-top:6px}.sochi .scdays div{flex:1;display:flex;flex-direction:column-reverse;min-width:4px}.sochi .scdays i{display:block;background:#5146c8}.sochi .scdl{display:flex;gap:3px;font-size:10px;color:#667085}.sochi .scdl span{flex:1;text-align:center}
.sochi .scrs{border:1px solid #e3e6ee;border-radius:12px;padding:12px 14px;margin-bottom:10px;display:grid;grid-template-columns:1fr 170px;gap:6px 16px}.sochi .scrs .m{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
.sochi table.scpbt{table-layout:fixed;min-width:1340px}.sochi .scpbt .c-n{width:230px}.sochi .scpbt .c-tk{width:52px}.sochi .scpbt .c-v{width:96px}.sochi .scpbt .c-t{width:112px}.sochi .scpbt th{white-space:normal;vertical-align:bottom;line-height:1.3}.sochi .scpbt td{white-space:nowrap}.sochi .scpbt td:first-child{white-space:normal}
.sochi .sch select,.sochi .sch input{width:auto!important;max-width:260px;flex:0 1 auto;margin:0}
.sochi .scviec{display:grid;grid-template-columns:22px 1fr auto;gap:10px;align-items:center;padding:10px 12px;border-radius:8px;font-size:13.5px}.sochi .scviec.od{background:#fff8e3}
.sochi select.scbv{padding:4px 8px;font-size:12.5px;min-width:130px}.sochi select.scbv.doi{border-color:#a95a10;background:#fff1e3}.sochi .mono{font-family:Consolas,monospace;font-size:12px;color:#667085}
@media(max-width:900px){.sochi .sck3,.sochi .sck5,.sochi .sctwo,.sochi .sccc{grid-template-columns:1fr}.sochi .scrs{grid-template-columns:1fr}.sochi .scrs .m{text-align:left}.sochi .scbar{grid-template-columns:1fr;gap:3px}.sochi .scbar .t{text-align:left}}`;
function pSoChi(m){
  if(!document.getElementById("sc-css")){const s=document.createElement("style");s.id="sc-css";s.textContent=SC_CSS;document.head.appendChild(s)}
  const sec=scSecret(),ghi=scCanGhi(),duyet=scCanDuyet(),choN=scCho().length;
  /* Chị Hoa 28/10: Nhật ký chi đứng đầu; Phân bổ, Quy tắc phân bổ, Danh mục chi phí gộp một tab "Phân bổ", bấm từng phần bên trong. */
  const rsN=sec?scChoN():0,PBG=["pb","qt","dm"],TABS=sec?[["nk","Nhật ký chi"+(choN?" ("+choN+" chờ duyệt)":"")],["tq","Tổng quan"],["cn","Theo chức năng"],["kenh","Theo kênh"],["pb","Phân bổ"],["rs","Chờ xử lý"+(rsN?" ("+rsN+")":"")]]:[["nk","Phiếu chi đã gửi"+(choN?" ("+choN+")":"")]];
  if(!TABS.some(t=>t[0]===SC.tab)&&!(sec&&PBG.includes(SC.tab)))SC.tab=TABS[0][0];
  const body=!sec?scMine():(PBG.includes(SC.tab)?scBCcss()+`<div class="scpills" role="tablist" style="margin:0 0 12px">${[["pb","Kết quả phân bổ"],["qt","Quy tắc phân bổ & chia lương"],["dm","Danh mục chi phí"]].map(([k,t])=>`<button type="button" role="tab" aria-selected="${SC.tab===k}" class="${SC.tab===k?"on":""}" data-sct="${k}">${t}</button>`).join("")}</div>`:"")+{tq:scTQ2,cn:scCN,kenh:scKenh,nk:scNK,pb:scPBV,qt:scQTtab,rs:()=>scPLTab()+scRS(),dm:scDMtab}[SC.tab]();
  m.innerHTML=`<div class="sochi">${H("Sổ chi phí",pLabel()+(sec?" · hạch toán theo Thông tư 133 · nguồn: sổ cái TK 642 (MISA), phiếu chi và các khoản tự cộng":""))}
   <div class="filters" style="justify-content:flex-end">${ghi?`<button class="btn pri" id="sc-new">＋ Ghi phiếu chi</button>`:""}${duyet?`<button class="btn" id="sc-imp">Nạp sổ từ file</button><button class="btn" id="sc-dcmisa">Đối chiếu với MISA</button>`:""}<button class="btn sm" id="sc-ncc">Phiếu chi nhà cung cấp</button><button class="btn sm" id="sc-vc">Phiếu chi vận chuyển</button></div>
   <div class="sctabs">${TABS.map(([k,t])=>`<button class="${SC.tab===k||(k==="pb"&&PBG.includes(SC.tab))?"on":""}" data-sct="${k}">${t}</button>`).join("")}</div>${body}</div>`;
  m.querySelectorAll("[data-sct]").forEach(b=>b.onclick=()=>{SC.tab=b.dataset.sct;renderMain()});
  const on=(id,fn)=>{const e=document.getElementById(id);if(e)e.onclick=fn};
  on("sc-new",()=>scForm());on("sc-imp",()=>scImport());
  on("sc-ncc",async()=>{await mhLoad();mhLoadInv();mhPayForm()});on("sc-vc",()=>{PAGE="cr_vc";try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}render();scrollTo(0,0)});
  [["scf-fg","g"],["scf-fk","k"],["scf-fs","st"],["scf-fq","q"],["scf-fn","fn"],["scf-fx","xl"]].forEach(([id,k])=>{const e=document.getElementById(id);if(e)e.onchange=()=>{SC[k]=e.value;renderMain()}});
  const findR=id=>scRows().find(x=>x.id===id)||((scFin().nkc)||[]).find(x=>x.id===id);
  m.querySelectorAll("tr[data-x]").forEach(tr=>tr.onclick=()=>{const r=scExt().find(x=>x.id===tr.dataset.x);if(r)scExtOpen(r)});
  m.querySelectorAll("tr[data-id]").forEach(tr=>tr.onclick=e=>{if(e.target.closest("select,button,input"))return;const id=tr.dataset.id,c=scCho().find(x=>x.id===id);if(c)scPhieu(c,true);else{const r=findR(id);if(r)scPhieu(r,false)}});
  m.querySelectorAll("select[data-bv]").forEach(s=>s.onchange=()=>{const id=s.dataset.bv,v=s.value;DB.mutate(ME.name,"đổi nơi chịu khoản chi",dt=>{const r=((dt.fin||{}).nkc||[]).find(y=>y.id===id);if(!r)return;if(r.k0==null)r.k0=r.k;r.k=v;if(v!=="Chờ xác định"&&r.st==="Cần rà"&&!r.gc)r.st="Ổn";(dt.fin.cpRule=dt.fin.cpRule||{})[scKey(r.dg)]={g:r.g,k:v,st:r.st}});renderMain()});
  m.querySelectorAll("[data-dm]").forEach(el=>el.onchange=()=>{const i=+el.dataset.dm,f=el.dataset.f,v=f==="cd"?+el.value:el.value;DB.mutate(ME.name,"sửa danh mục chi phí",dt=>{dt.fin=dt.fin||{};if(!dt.fin.cpdm||!dt.fin.cpdm.length||!dt.fin.cpdm[i])dt.fin.cpdm=JSON.parse(JSON.stringify(scDM()));dt.fin.cpdm[i][f]=v});toast("Đã lưu danh mục");renderMain()});
  m.querySelectorAll("[data-go-st],[data-go-k],[data-go-g]").forEach(b=>b.onclick=()=>{Object.assign(SC,{tab:"nk",st:b.dataset.goSt||"",k:b.dataset.goK||"",g:b.dataset.goG||"",q:"",fn:"",xl:""});if(b.dataset.goG)SC.st="Cần rà";renderMain()});
  scQTbind(m);scBCbind(m);scPLbind(m);
  on("scdt-ed2",()=>{const b=document.getElementById("scdt-ed");if(b)b.click()});
  m.querySelectorAll("[data-pbk]").forEach(el=>el.onclick=()=>{const go=!el.closest(".scpills");SC.pbk=el.dataset.pbk;renderMain();if(go){const c=document.getElementById("scpk");if(c)c.scrollIntoView({behavior:"smooth",block:"start"})}});
  on("scdt-ed",()=>{const ym=PERIOD.from.slice(0,7),sv=((scFin().cpDT||{})[ym])||{},auto=scAutoDT(ym);
    openDrawerHTML(`<h2>Doanh thu thực tháng ${ym.slice(5)}/${ym.slice(0,4)}</h2><p class="hint">Dùng để chia chi chung về kênh. Để trống thì web tự lấy số thật (không lấy số tạm tính) (TikTok, Facebook, NPP, Gia công).</p><form class="frm" id="scdt">${SC_KENH.map(k=>`<label class="field">${k} (đ)${auto[k]?` <span class="hint">· web tự lấy ${scNf(auto[k])}</span>`:""}<input type="number" min="0" data-dtk="${k}" value="${sv[k]!=null?sv[k]:""}"></label>`).join("")}<button class="btn pri">Lưu</button></form>`);
    $("#scdt").onsubmit=e=>{e.preventDefault();const o={};document.querySelectorAll("[data-dtk]").forEach(i=>{if(i.value!=="")o[i.dataset.dtk]=+i.value});DB.mutate(ME.name,"nhập doanh thu thực "+ym,dt=>{dt.fin=dt.fin||{};(dt.fin.cpDT=dt.fin.cpDT||{})[ym]=o});closeDrawer();renderMain()}});
}
/* Người không xem được sổ (chị Thảo nếu không có quyền kế toán): chỉ thấy phiếu mình đã gửi chờ duyệt. */
function scMine(){const L=scCho().filter(x=>x.by===ME.name);return `<section class="card flush"><div class="sch pad"><h2>Phiếu chi đã gửi, chờ chị Huệ duyệt</h2></div>${L.length?`<div class="tbl"><table><thead><tr><th>Ngày</th><th>Số phiếu</th><th>Nội dung</th><th class="n">Số tiền</th><th>Nhóm</th><th>Bổ vào</th></tr></thead><tbody>${L.map(x=>`<tr><td>${scDd(x.d)}</td><td class="mono">${esc(x.ct)}</td><td>${esc(x.dg)}</td><td class="n">${scNf(x.t)}</td><td>${esc(scG(x.g).n)}</td><td>${esc(x.k)}</td></tr>`).join("")}</tbody></table></div>`:`<p class="empty pad">Không có phiếu nào đang chờ duyệt. Phiếu đã duyệt nằm trong sổ của kế toán.</p>`}</section>`}
PAGES.so_cp=pSoChi;
spForm=scForm;
