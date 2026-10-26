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
const SC_DM0=[["G01","Quảng cáo Facebook (tiền nạp)","641","A - Trực tiếp kênh",0,"Ghi theo lúc nạp tiền vào tài khoản QC, chưa phải số đã tiêu"],["G02","Quảng cáo TikTok (tiền nạp)","641","A - Trực tiếp kênh",0,"Gồm nạp tay trong tháng và bút toán nạp cuối tháng"],["G03","Quảng cáo Shopee (tiền nạp)","641","A - Trực tiếp kênh",0,"Shopee Mall và Shopee thường nạp 5,4 triệu/lần"],["G04","Phí sàn (TikTok, Shopee)","641","A - Trực tiếp kênh",0,"Phí sàn đã nằm trong báo cáo sàn; đối chiếu kẻo trùng"],["G05","Vận chuyển đơn hàng (SPX, Best, J&T)","641","A - Trực tiếp kênh",0,"Cần xác định gửi cho kênh nào"],["G06","Hoa hồng vận hành TikTok","641","A - Trực tiếp kênh",0,"Trả bên vận hành TikTok"],["G07","Lương - thưởng","CHIA","B - Phòng ban",1,"Chia lương xưởng/sale/văn phòng theo bảng lương"],["G08","Bảo hiểm","CHIA","B - Phòng ban",1,"Chia theo người thuộc phòng nào"],["G09","Cước xe giao hàng NPP","641","A - Trực tiếp kênh",0,"Cước xe là của NPP"],["G10","Đóng gói bán lẻ (băng dính, chống sốc)","641","A - Trực tiếp kênh",0,"Đóng đơn B2C lẻ"],["G11","Công cụ Marketing (CapCut)","641","B - Phòng ban",1,"Team MKT"],["G12","Điện thoại sale + tổng đài (hỗ trợ ads FB)","641","A - Trực tiếp kênh",0,"Hỗ trợ ads Facebook"],["G13","Điện, mạng, VPS văn phòng","642","C - Chi chung",1,"Chia theo doanh thu thực"],["G14","Phân bổ CCDC (gồm thuê VP/xưởng)","CHIA","C - Chi chung",1,"TK 242 phân bổ hàng tháng; chia xưởng/văn phòng"],["G15","Thiết bị xưởng/kho (nồi, quạt, máy tít đơn)","CHIA","B - Phòng ban",0,"Đúng ra vào CCDC (TK 242) rồi phân bổ dần"],["G16","Vật tư, sửa chữa, đồ dùng xưởng","627","B - Phòng ban",0,"Chi phí chung của xưởng, tính vào giá thành"],["G17","Cước vật tư đầu vào (hóa chất AOS, HDSD)","152","Giá vốn",0,"Là chi phí mua hàng, cộng vào giá vốn nguyên vật liệu"],["G18","Dịch vụ chuyên môn (kế toán thuế, tuyển dụng)","642","C - Chi chung",1,"Chia theo doanh thu thực"],["G19","Hoàn/bù khách (đơn thiếu, vỡ, rách)","641","A - Trực tiếp kênh",0,"Cần ghi rõ đơn của kênh nào"],["G20","Chuyển nhầm / thu nhầm (không phải chi phí)","138","Không tính",0,"Phải thu hồi hoặc trả lại, không được vào chi phí"],["G21","Văn phòng, lễ, phúc lợi, đối ngoại","642","C - Chi chung",1,"Kiểm tra hóa đơn đầu vào"],["G22","Tiền VAT trả theo số hóa đơn","642","C - Chi chung",0,"Cần rà bản chất"],["G23","Ghi chung chung \"Chi phí\"","642","Chờ xác định",0,"Chưa biết chi cho việc gì"],["G24","Mẫu thử, nghiên cứu sản phẩm","642","C - Chi chung",0,"Chi phí phát triển sản phẩm"]].map(r=>({g:r[0],n:r[1],tk:r[2],lo:r[3],cd:r[4],gc:r[5]}));
const SC_KENH=["TikTok","Shopee Mall","Shopee thường","Facebook","NPP","Gia công"],SC_COLS=SC_KENH.concat(["Sản xuất","Chung","Chờ xác định","Không tính"]);
const SC_TKN={"641":"Chi phí bán hàng: quảng cáo, phí sàn, vận chuyển đơn, hoa hồng, hỗ trợ sale","642":"Chi phí quản lý doanh nghiệp: điện, mạng, kế toán, văn phòng, VAT lẻ, chi chung","CHIA":"Phải chia theo bộ phận: lương, bảo hiểm, phân bổ CCDC, thiết bị","627":"Chi phí sản xuất chung: vật tư, sửa chữa, đồ dùng xưởng (vào giá thành)","152":"Cước vật tư đầu vào: cộng vào giá vốn nguyên vật liệu","138":"Không phải chi phí: tiền chuyển nhầm, phải thu hồi"};
const SC={tab:"tq",g:"",k:"",st:"",q:""};
const scFin=()=>(D().fin||{});
const scSecret=()=>!!ME&&(ME.role==="admin"||mhPerm("order.accounting.confirm")||can(ME,"chiphi.xem"));
const scCanGhi=()=>!!ME&&(ME.role==="admin"||mhManage()||can(ME,"chiphi.nhap"));
const scCanDuyet=()=>!!ME&&(ME.role==="admin"||mhPerm("order.accounting.confirm"));
const scDM=()=>{const L=scFin().cpdm;return L&&L.length?L:SC_DM0};
const scG=g=>scDM().find(x=>x.g===g)||{g,n:g||"Chưa chọn nhóm",tk:"",lo:"",cd:0,gc:""};
const scNf=v=>Math.round(+v||0).toLocaleString("vi-VN"),scPc=(a,b)=>b?(a/b*100).toFixed(1).replace(".",",")+"%":"—",scDd=s=>String(s||"").slice(8,10)+"/"+String(s||"").slice(5,7);
const scS=a=>a.reduce((t,x)=>t+(+x.t||0),0);
const scLoP=lo=>{const k=String(lo||"")[0];return `<span class="scp ${k==="A"?"p-a":k==="B"?"p-b":"p-c"}">${esc(lo||"—")}</span>`};
const scStP=s=>`<span class="scp ${s==="Ổn"?"p-ok":s==="Chờ duyệt"?"p-a":"p-ra"}">${esc(s||"—")}</span>`;
const scInP=r=>r.d>=PERIOD.from&&r.d<=PERIOD.to;
const scRows=()=>((scFin().nkc)||[]).filter(scInP);
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
    const have=new Set(((scFin().nkc)||[]).map(x=>[x.d,x.ct,Math.round(x.t)].join("|")));const moi=r.rows.filter(x=>!have.has([x.d,x.ct,Math.round(x.t)].join("|")));
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
    if(scCanDuyet())DB.mutate(ME.name,"ghi phiếu chi "+row.ct,dt=>{dt.fin=dt.fin||{};(dt.fin.nkc=dt.fin.nkc||[]).push({...row,st:"Ổn",duyet:ME.name});(dt.fin.cpRule=dt.fin.cpRule||{})[scKey(dg)]={g:row.g,k:row.k,st:"Ổn"}});
    else DB.mutate(ME.name,"ghi phiếu chi chờ duyệt "+row.ct,dt=>{(dt.pcCho=dt.pcCho||[]).push({...row,st:"Chờ duyệt"})});
    let up=0;for(const f of [...$("#scf-f").files]){try{const x=await mhPrepFile(f);await kApi("/mh/costs/"+row.id+"/files",{method:"POST",body:JSON.stringify(x)});up++}catch(er){toast(er.message)}}
    closeDrawer();toast((scCanDuyet()?"Đã ghi "+row.ct+" vào sổ":"Đã gửi chị Huệ duyệt "+row.ct)+(up?", kèm "+up+" ảnh":""));SOCP.files=null;renderMain()}}
function scDuyet(id){const p=scCho().find(x=>x.id===id);if(!p)return;
  DB.mutate(ME.name,"duyệt phiếu chi "+p.ct,dt=>{const i=(dt.pcCho||[]).findIndex(x=>x.id===id);if(i<0)return;const r=dt.pcCho.splice(i,1)[0];dt.fin=dt.fin||{};(dt.fin.nkc=dt.fin.nkc||[]).push({...r,st:"Ổn",duyet:ME.name,duyetAt:Date.now()});(dt.fin.cpRule=dt.fin.cpRule||{})[scKey(r.dg)]={g:r.g,k:r.k,st:"Ổn"}});
  toast("Đã duyệt "+p.ct);closeDrawer();renderMain()}
function scTuChoi(id){const p=scCho().find(x=>x.id===id);if(!p)return;DB.mutate(ME.name,"trả lại phiếu chi "+p.ct,dt=>{dt.pcCho=(dt.pcCho||[]).filter(x=>x.id!==id)});toast("Đã trả lại "+p.ct);closeDrawer();renderMain()}
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
   <p class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${ed?`<button class="btn pri" id="scp-luu">Lưu</button><button class="btn danger" id="scp-xoa">Xóa dòng</button>`:""}${cho&&scCanDuyet()?`<button class="btn pri" id="scp-ok">Duyệt vào sổ</button><button class="btn danger" id="scp-tl">Trả lại</button>`:""}</p><div id="scp-cf"></div>`);
  $("#scp-f").onclick=()=>spFiles(x.id,x.dg);
  if($("#scp-ok"))$("#scp-ok").onclick=()=>scDuyet(x.id);if($("#scp-tl"))$("#scp-tl").onclick=()=>scTuChoi(x.id);
  if($("#scp-luu"))$("#scp-luu").onclick=()=>{const v={g:$("#scp-g").value,k:$("#scp-k").value,st:$("#scp-st").value,gc:$("#scp-gc").value.trim()};
    DB.mutate(ME.name,"sửa dòng sổ chi "+(x.ct||""),dt=>{const r=((dt.fin||{}).nkc||[]).find(y=>y.id===x.id);if(r){if(r.k0==null&&r.k!==v.k)r.k0=r.k;Object.assign(r,v)}(dt.fin.cpRule=dt.fin.cpRule||{})[scKey(x.dg)]={g:v.g,k:v.k,st:v.st}});toast("Đã lưu");closeDrawer();renderMain()};
  if($("#scp-xoa"))$("#scp-xoa").onclick=()=>{$("#scp-cf").innerHTML=`<div class="note red">Xóa dòng ${esc(x.ct||"")} (${scNf(x.t)} đ) khỏi sổ? <button class="btn sm danger" id="scp-xoa2">Xóa</button></div>`;
    $("#scp-xoa2").onclick=()=>{DB.mutate(ME.name,"xóa dòng sổ chi "+(x.ct||""),dt=>{dt.fin.nkc=(dt.fin.nkc||[]).filter(y=>y.id!==x.id)});toast("Đã xóa");closeDrawer();renderMain()}};
}
/* ---------- Các tab ---------- */
function scTQ(){
  const all=scRows();if(!all.length)return scEmpty();
  const CD=new Set(scDM().filter(x=>x.cd).map(x=>x.g)),cp=all.filter(x=>x.k!=="Không tính"),tot=scS(cp),cd=scS(cp.filter(x=>CD.has(x.g))),bd=tot-cd,T=scS(all);
  const byTK={};all.forEach(x=>{const k=scG(x.g).tk||"?";byTK[k]=(byTK[k]||0)+x.t});
  const byG={};all.forEach(x=>{byG[x.g]=(byG[x.g]||0)+x.t});const G=Object.entries(byG).sort((a,b)=>b[1]-a[1]),mx=G[0][1];
  const that=scS(all.filter(x=>/^111|^112/.test(String(x.tk)))),ra=all.filter(x=>x.st!=="Ổn");
  const days={};all.forEach(x=>{const o=days[x.d]||(days[x.d]={a:0,b:0});if(/^111|^112/.test(String(x.tk)))o.a+=x.t;else o.b+=x.t});const dk=Object.keys(days).sort(),dmx=Math.max(1,...dk.map(k=>days[k].a));
  const top=all.slice().sort((a,b)=>b.t-a.t).slice(0,10);
  return `<div class="sck3"><div class="sckpi"><div class="l">Tổng chi phí</div><div class="v">${scNf(tot)}</div><div class="h">${cp.length} khoản${T!==tot?` · tổng sổ ${scNf(T)} (gồm ${scNf(T-tot)} không tính)`:""}</div></div>
   <div class="sckpi"><div class="l">Chi phí cố định</div><div class="v">${scNf(cd)}</div><div class="h">${scPc(cd,tot)} tổng chi</div></div><div class="sckpi"><div class="l">Chi phí biến đổi</div><div class="v">${scNf(bd)}</div><div class="h">${scPc(bd,tot)} tổng chi</div></div></div>
  <div class="sck5"><div class="sckpi"><div class="l">Chi phí bán hàng (641)</div><div class="v">${scNf(byTK["641"])}</div><div class="h">${scPc(byTK["641"]||0,T)} tổng sổ</div></div><div class="sckpi"><div class="l">Quản lý thật (642)</div><div class="v">${scNf(byTK["642"])}</div><div class="h">${scPc(byTK["642"]||0,T)} tổng sổ</div></div><div class="sckpi"><div class="l">Phải chia theo bộ phận</div><div class="v">${scNf(byTK["CHIA"])}</div><div class="h">lương, BH, CCDC</div></div><div class="sckpi"><div class="l">Chi bằng tiền thật</div><div class="v">${scNf(that)}</div><div class="h">ra khỏi tài khoản, quỹ · còn lại là bút toán</div></div><div class="sckpi red"><div class="l">Cần rà soát</div><div class="v">${scNf(scS(ra))}</div><div class="h">${ra.length} khoản chưa đủ rõ</div></div></div>
  <section class="card pad"><div class="sch"><h2>1. Cơ cấu chi phí</h2><span class="hint">theo nhóm chi phí, từ lớn đến nhỏ · % trên tổng sổ ${scNf(T)} đ</span></div><div class="sccc">${G.map(([g,v])=>{const d=scG(g);return `<div class="scbar"><span><span class="mono">${esc(g)}</span> ${esc(d.n)} <span class="scp ${d.cd?"p-a":g==="G20"?"p-c":"p-b"}">${d.cd?"cố định":g==="G20"?"không tính":"biến đổi"}</span></span><span class="tr"><i style="width:${Math.max(1,v/mx*100)}%"></i></span><span class="t">${scNf(v)} · ${scPc(v,T)}</span></div>`}).join("")}</div></section>
  <div class="sctwo"><section class="card pad"><h2>2. Chi theo ngày</h2><div class="scdays">${dk.map(k=>`<div title="${scDd(k)}: tiền thật ${scNf(days[k].a)} · bút toán ${scNf(days[k].b)}"><i style="height:${days[k].a/dmx*130}px"></i></div>`).join("")}</div><div class="scdl">${dk.map((k,i)=>`<span>${i%3===0?k.slice(8):""}</span>`).join("")}</div><p class="hint">Cột tím: tiền thật ra khỏi tài khoản, quỹ. Bút toán (phí sàn, nạp TikTok cuối tháng, lương, CCDC…) ${scNf(dk.reduce((t,k)=>t+days[k].b,0))} đ không vẽ.</p></section>
   <section class="card pad"><h2>3. Mười khoản lớn nhất</h2><div class="tbl"><table><tbody>${top.map((x,i)=>`<tr class="clk" data-id="${x.id}"><td class="hint">${i+1}</td><td>${scDd(x.d)}</td><td>${esc(x.dg)}</td><td class="n">${scNf(x.t)}</td></tr>`).join("")}</tbody></table></div></section></div>
  ${scViecHtml(all,"4. Việc cần xử lý trước khi chốt số tháng")}`}
/* Việc cần xử lý trước khi chốt tháng: web tự tính từ nhật ký, giống mục 5 của file phân bổ. */
function scViec(all){
  const S=scS,L=[],tr=v=>(v/1e6).toLocaleString("vi-VN",{maximumFractionDigits:2})+" triệu",so=all.filter(x=>x.src!=="phieu");
  const t641=S(so.filter(x=>scG(x.g).tk==="641")),q642=S(so.filter(x=>scG(x.g).tk==="642"));
  if(t641)L.push([`Tách quảng cáo, phí sàn, vận chuyển đơn, hoa hồng sang TK 641 (${tr(t641)}). Đang ghi ở sổ 642 nên chi phí quản lý nhìn như ${tr(S(so))}, thực ra chỉ khoảng ${tr(q642)}.`,t641,{}]);
  const g23=all.filter(x=>x.g==="G23"),g20=all.filter(x=>x.g==="G20");
  if(g23.length||g20.length)L.push([`Hỏi người chi ${g23.length?g23.length+` dòng ghi mỗi chữ "Chi phí" (${tr(S(g23))})`:""}${g23.length&&g20.length?" và ":""}${g20.length?g20.length+` dòng chuyển nhầm (${tr(S(g20))})`:""} để ghi đúng chỗ.`,S(g23)+S(g20),{g:g23.length?"G23":"G20"}]);
  const vat=all.filter(x=>x.g==="G22");if(vat.length)L.push([`Rà ${vat.length} dòng "Tiền VAT" (${tr(S(vat))}): bản chất, chứng từ, hóa đơn tháng trước ghi vào tháng này. VAT đầu vào hợp lệ vào TK 133, không vào chi phí.`,S(vat),{g:"G22"}]);
  const tt=all.filter(x=>/\b([2-9]|\d{2,})\s*th[aá]ng\b|c[oọ]c\b/i.test(x.dg)&&!/th[aá]ng\s*\d{1,2}[.\/]\d{4}/i.test(x.dg));if(tt.length)L.push([`Các khoản trả trước ghi hết một lần: ${tt.slice(0,4).map(x=>x.dg).join("; ")}. Chuyển sang phân bổ (TK 242) hoặc trả trước.`,S(tt),{q:""}]);
  const lg=all.filter(x=>["G07","G08"].includes(x.g)&&["Chờ xác định","Chung"].includes(x.k));if(lg.length)L.push([`Chia lương, thưởng, bảo hiểm (${tr(S(lg))}) theo bộ phận và kênh thay vì dồn hết vào quản lý.`,S(lg),{g:"G07"}]);
  const kp=all.filter(x=>x.src!=="phieu");if(kp.length)L.push([`${kp.length} khoản chưa có phiếu chi (người đề nghị, kênh, chứng từ, người duyệt). Từ nay mọi khoản chi ghi bằng nút "＋ Ghi phiếu chi".`,S(kp),{}]);
  return L}
function scViecHtml(all,title){const L=scViec(all);if(!L.length)return "";const mark="①②③④⑤⑥⑦⑧";
  return `<section class="card pad"><h2>${title}</h2>${L.map(([t,v,f],i)=>`<div class="scviec${i%2?"":" od"}"><span>${mark[i]||i+1}</span><span>${esc(t)}</span>${f.g?`<button class="btn sm" data-go-g="${esc(f.g)}">Xem dòng</button>`:"<span></span>"}</div>`).join("")}</section>`}
/* Các khoản chi đã nhập ở mục riêng từ trước (trả tiền nhà cung cấp ở Mua hàng, Phiếu chi vận chuyển): hiện ở Nhật ký chi để sổ đủ mọi khoản tiền chi ra.
   Chỉ để xem và đối chiếu: không cộng vào phân bổ chi phí (tiền mua hàng đi vào giá vốn; cước vận chuyển đã có ở nhật ký nếu nạp từ MISA). */
function scExt(){
  const inP=d=>d>=PERIOD.from&&d<=PERIOD.to,R=[];
  (MH.pay||[]).filter(x=>x.status==="OK"&&inP(x.pay_date)).forEach(x=>R.push({id:"n"+x.id,d:x.pay_date,ct:"Mua hàng",dg:(x.kind==="COC"?"Cọc nhà cung cấp · ":"Trả nhà cung cấp · ")+x.supplier_name,sub:[x.po_no?"phiếu mua "+x.po_no:"",x.invoice_no?"chứng từ "+x.invoice_no:"",x.account||""].filter(Boolean).join(" · "),t:+x.amount||0,nguon:"Mua hàng (giá vốn)"}));
  (SOCP.ship||[]).filter(v=>v.status==="OK"&&inP(v.voucher_date)).forEach(v=>R.push({id:"v"+v.id,d:v.voucher_date,ct:v.voucher_no||"",dg:"Cước vận chuyển · "+v.carrier,sub:[v.destination,v.order_refs].filter(Boolean).join(" · "),t:+v.amount||0,nguon:"Phiếu chi vận chuyển"}));
  return R.sort((a,b)=>String(a.d).localeCompare(String(b.d)))}
function scExtHtml(){
  const R=scExt();if(!MH.pay&&!SOCP.ship)return `<p class="hint pad">Đang tải các khoản chi ở Mua hàng và Vận chuyển…</p>`;
  return `<section class="card flush"><div class="sch pad"><h2>Chi từ Mua hàng và Phiếu chi vận chuyển</h2><span class="hint">đã nhập ở mục riêng, hiện ở đây để sổ đủ mọi khoản chi · không cộng vào phân bổ chi phí ở trên</span></div>
  ${R.length?`<div class="tbl"><table><thead><tr><th>Ngày</th><th>Số CT</th><th>Diễn giải</th><th class="n">Số tiền</th><th>Nguồn</th></tr></thead><tbody>${R.map(x=>`<tr><td>${scDd(x.d)}</td><td class="mono">${esc(x.ct)}</td><td>${esc(x.dg)}${x.sub?`<div class="hint">${esc(x.sub)}</div>`:""}</td><td class="n"><b>${scNf(x.t)}</b></td><td><span class="scp p-ok">${esc(x.nguon)}</span></td></tr>`).join("")}
  <tr class="tot"><td colspan="3">Cộng ${R.length} khoản</td><td class="n">${scNf(R.reduce((t,x)=>t+x.t,0))}</td><td></td></tr></tbody></table></div>`:`<p class="empty pad">Chưa có khoản chi nào ở Mua hàng hoặc Vận chuyển trong kỳ này.</p>`}</section>`}
function scNK(){
  try{mhLoad();mhLoadPay();spLoadShip()}catch(e){}
  const q=kfold(SC.q||""),cho=scCho().filter(scInP),all=scRows().concat(cho),R=all.filter(x=>(!SC.g||x.g===SC.g)&&(!SC.k||x.k===SC.k)&&(!SC.st||x.st===SC.st)&&(!q||kfold(x.dg+" "+x.ct).includes(q))).sort((a,b)=>String(a.d).localeCompare(String(b.d))||String(a.ct).localeCompare(String(b.ct)));
  const ed=scCanDuyet(),gs=scDM().map(x=>x.g);
  return `<section class="card flush"><div class="sch pad"><h2>Nhật ký chi</h2><span class="hint">mỗi khoản một dòng · chọn "Bổ vào" để phân bổ · bấm dòng để xem phiếu</span><span class="sp"></span>
   <select id="scf-fg"><option value="">Tất cả nhóm chi phí</option>${gs.map(g=>`<option value="${g}"${SC.g===g?" selected":""}>${g} · ${esc(scG(g).n)}</option>`).join("")}</select>
   <select id="scf-fk"><option value="">Tất cả nơi chịu</option>${SC_COLS.map(k=>`<option${SC.k===k?" selected":""}>${k}</option>`).join("")}</select>
   <select id="scf-fs"><option value="">Mọi tình trạng</option>${["Ổn","Cần rà","Chờ duyệt"].map(s=>`<option${SC.st===s?" selected":""}>${s}</option>`).join("")}</select>
   <input id="scf-fq" placeholder="Tìm diễn giải, số chứng từ…" value="${esc(SC.q||"")}"></div>
  ${R.length?`<div class="tbl"><table><thead><tr><th>Ngày</th><th>Số CT</th><th>Diễn giải</th><th class="n">Số tiền</th><th>Nhóm chi phí</th><th>TK</th><th>Loại</th><th>Bổ vào (kênh / nơi chịu)</th><th>Tình trạng</th></tr></thead><tbody>
  ${R.map(x=>{const d=scG(x.g),isCho=x.st==="Chờ duyệt";return `<tr class="clk" data-id="${x.id}"${isCho?' data-cho="1"':""}><td>${scDd(x.d)}</td><td class="mono">${esc(x.ct||"")}</td><td>${esc(x.dg)}${x.gc?`<div class="hint">${esc(x.gc)}</div>`:""}</td><td class="n"><b>${scNf(x.t)}</b></td><td>${esc(d.n)}</td><td>${esc(d.tk)}</td><td>${scLoP(d.lo)}</td><td>${ed&&!isCho?`<select class="scbv${x.k0&&x.k0!==x.k?" doi":""}" data-bv="${x.id}" aria-label="Bổ khoản chi vào">${SC_COLS.map(k=>`<option${x.k===k?" selected":""}>${k}</option>`).join("")}</select>${x.k0&&x.k0!==x.k?`<div class="hint">đã đổi từ ${esc(x.k0)}</div>`:""}`:esc(x.k)}</td><td>${scStP(x.st)}</td></tr>`}).join("")}
  <tr class="tot"><td colspan="3">Cộng ${R.length} khoản${R.length<all.length?" (đang lọc)":""}</td><td class="n">${scNf(scS(R))}</td><td colspan="5"></td></tr></tbody></table></div>`:`<p class="empty pad">${all.length?"Không có khoản nào khớp bộ lọc.":"Chưa có khoản chi nào trong kỳ này."}</p>`}</section>`+scExtHtml()}
function scPB(){
  const rows=scRows();if(!rows.length)return scEmpty();
  const gs=[...new Set(rows.map(x=>x.g))].sort(),M={};gs.forEach(g=>{M[g]={};SC_COLS.forEach(c=>M[g][c]=0)});rows.forEach(x=>{const c=SC_COLS.includes(x.k)?x.k:"Chờ xác định";M[x.g][c]+=x.t});
  const colT=c=>gs.reduce((t,g)=>t+M[g][c],0),chung=colT("Chung"),ym=PERIOD.from.slice(0,7),oneM=PERIOD.to.slice(0,7)===ym;
  const N=execNums(PERIOD.from,PERIOD.to),auto={"TikTok":N.tt||0,"Facebook":N.fbGiao||0},saved=((scFin().cpDT||{})[ym])||{},DT={};SC_KENH.forEach(k=>DT[k]=saved[k]!=null&&saved[k]!==""?+saved[k]:(auto[k]||0));
  const dts=SC_KENH.reduce((t,k)=>t+DT[k],0),f=v=>v?scNf(v):'<span class="hint">—</span>',ed=scCanDuyet()&&oneM;
  return `<section class="card flush"><div class="sch pad"><h2>Phân bổ theo kênh</h2><span class="hint">hàng = nhóm chi phí · cột = kênh / nơi chịu · đổi chỗ bổ ở tab Nhật ký chi</span></div><div class="tbl"><table class="scpbt"><colgroup><col class="c-n"><col class="c-tk">${SC_COLS.map(()=>`<col class="c-v">`).join("")}<col class="c-t"></colgroup><thead><tr><th>Nhóm chi phí</th><th>TK</th>${SC_COLS.map(c=>`<th class="n">${c}</th>`).join("")}<th class="n">Tổng</th></tr></thead><tbody>
  ${gs.map(g=>`<tr><td><span class="mono">${esc(g)}</span> ${esc(scG(g).n)}</td><td>${esc(scG(g).tk)}</td>${SC_COLS.map(c=>`<td class="n">${f(M[g][c])}</td>`).join("")}<td class="n"><b>${scNf(SC_COLS.reduce((t,c)=>t+M[g][c],0))}</b></td></tr>`).join("")}
  <tr class="tot"><td colspan="2">Tổng cộng</td>${SC_COLS.map(c=>`<td class="n">${f(colT(c))}</td>`).join("")}<td class="n">${scNf(scS(rows))}</td></tr></tbody></table></div></section>
  <section class="card pad"><div class="sch"><h2>Chia chi chung về kênh theo doanh thu thực</h2>${ed?`<span class="sp"></span><button class="btn sm" id="scdt-ed">Sửa doanh thu thực</button>`:""}</div><div class="tbl"><table><thead><tr><th>Kênh</th><th class="n">Doanh thu thực</th><th class="n">Tỷ trọng</th><th class="n">Chi trực tiếp</th><th class="n">Chi chung được chia</th><th class="n">Tổng kênh gánh</th><th class="n">% doanh thu</th></tr></thead><tbody>
  ${SC_KENH.map(k=>{const sh=dts?chung*DT[k]/dts:0,tt=colT(k)+sh;return `<tr><td><b>${k}</b></td><td class="n">${DT[k]?scNf(DT[k]):'<span class="hint">chưa có</span>'}${saved[k]==null&&auto[k]?' <span class="hint">tự lấy</span>':""}</td><td class="n">${scPc(DT[k],dts)}</td><td class="n">${f(colT(k))}</td><td class="n">${f(sh)}</td><td class="n"><b>${f(tt)}</b></td><td class="n">${scPc(tt,DT[k])}</td></tr>`}).join("")}
  <tr class="tot"><td>Tổng</td><td class="n">${scNf(dts)}</td><td class="n">${dts?"100%":"—"}</td><td class="n">${scNf(SC_KENH.reduce((t,k)=>t+colT(k),0))}</td><td class="n">${scNf(dts?chung:0)}</td><td class="n">${scNf(SC_KENH.reduce((t,k)=>t+colT(k),0)+(dts?chung:0))}</td><td></td></tr></tbody></table></div>
  <p class="hint">TikTok, Facebook tự lấy doanh thu thực từ báo cáo; Shopee Mall, Shopee thường, NPP, Gia công chị Huệ nhập (bấm "Sửa doanh thu thực"). ${dts?"":"Chưa có doanh thu nên chi chung chưa chia. "}Chưa chia: "Chờ xác định" ${scNf(colT("Chờ xác định"))} đ (phải rà), "Sản xuất" ${scNf(colT("Sản xuất"))} đ (vào giá thành), "Không tính" ${scNf(colT("Không tính"))} đ.</p></section>`}
function scRS(){
  const rows=scRows(),ra=rows.filter(x=>x.st!=="Ổn"),cxd=rows.filter(x=>x.k==="Chờ xác định"),cho=scCho().filter(scInP);
  const by={};ra.forEach(x=>{const o=by[x.g]||(by[x.g]={n:0,t:0,gc:new Set()});o.n++;o.t+=x.t;if(x.gc)o.gc.add(x.gc)});const G=Object.entries(by).sort((a,b)=>b[1].t-a[1].t);
  return `${scViecHtml(rows,"Việc cần xử lý trước khi chốt số tháng")}<section class="card pad"><h2>Các dòng cần rà soát</h2><p class="hint">Tự gom từ Nhật ký chi: các dòng ghi "Cần rà", dòng chưa biết bổ vào đâu, phiếu chưa duyệt. Xếp theo số tiền.</p>
  ${cho.length?`<div class="scrs"><div><b>Phiếu chi chờ chị Huệ duyệt</b><div class="hint">${cho.map(x=>esc(x.ct+" "+x.dg)).slice(0,6).join(" · ")}${cho.length>6?" …":""}</div></div><div class="m">${scNf(scS(cho))} đ<div class="hint">${cho.length} phiếu</div><button class="btn sm" data-go-st="Chờ duyệt">Xem</button></div></div>`:""}
  ${cxd.length?`<div class="scrs"><div><b>Chưa biết bổ vào kênh nào ("Chờ xác định")</b><div class="hint">Chọn "Bổ vào" cho từng dòng ở Nhật ký chi để chia đúng kênh.</div></div><div class="m">${scNf(scS(cxd))} đ<div class="hint">${cxd.length} khoản</div><button class="btn sm" data-go-k="Chờ xác định">Xem</button></div></div>`:""}
  ${G.map(([g,o])=>`<div class="scrs"><div><b>${esc(g)} · ${esc(scG(g).n)}</b><div class="hint">${esc([...o.gc].slice(0,3).join(" · ")||scG(g).gc||"")}</div></div><div class="m">${scNf(o.t)} đ<div class="hint">${o.n} khoản</div><button class="btn sm" data-go-g="${esc(g)}">Xem</button></div></div>`).join("")}
  ${!G.length&&!cxd.length&&!cho.length?`<p class="empty">Không còn khoản nào cần rà soát trong kỳ này.</p>`:""}</section>`}
function scDMtab(){
  const ed=scCanDuyet(),all=scRows(),byTK={};all.forEach(x=>{const k=scG(x.g).tk||"?";byTK[k]=(byTK[k]||0)+x.t});const T=scS(all);
  return `<section class="card flush"><div class="sch pad"><h2>Danh mục chi phí</h2><span class="hint">${ed?"chị Huệ sửa ở đây thì mọi báo cáo đổi theo":"chỉ kế toán sửa"}</span></div><div class="tbl"><table><thead><tr><th>Mã</th><th>Nhóm chi phí</th><th>TK đề xuất</th><th>Loại</th><th>Cố định / biến đổi</th><th>Cách hạch toán</th></tr></thead><tbody>
  ${scDM().map((x,i)=>`<tr><td class="mono">${esc(x.g)}</td><td>${ed?`<input data-dm="${i}" data-f="n" value="${esc(x.n)}" style="width:100%">`:`<b>${esc(x.n)}</b>`}</td><td>${ed?`<select data-dm="${i}" data-f="tk">${opt(["641","642","627","152","138","CHIA"].map(v=>[v,v]),x.tk)}</select>`:esc(x.tk)}</td><td>${ed?`<select data-dm="${i}" data-f="lo">${opt(["A - Trực tiếp kênh","B - Phòng ban","C - Chi chung","Giá vốn","Chờ xác định","Không tính"].map(v=>[v,v]),x.lo)}</select>`:scLoP(x.lo)}</td><td>${ed?`<select data-dm="${i}" data-f="cd">${opt([["1","Cố định"],["0","Biến đổi"]],x.cd?"1":"0")}</select>`:(x.cd?"Cố định":"Biến đổi")}</td><td>${ed?`<input data-dm="${i}" data-f="gc" value="${esc(x.gc||"")}" style="width:100%">`:`<span class="hint">${esc(x.gc||"")}</span>`}</td></tr>`).join("")}</tbody></table></div></section>
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
  const TABS=sec?[["tq","Tổng quan"],["nk","Nhật ký chi"+(choN?" ("+choN+" chờ duyệt)":"")],["pb","Phân bổ theo kênh"],["rs","Cần rà soát"],["dm","Danh mục chi phí"]]:[["nk","Phiếu chi đã gửi"+(choN?" ("+choN+")":"")]];
  if(!TABS.some(t=>t[0]===SC.tab))SC.tab=TABS[0][0];
  const body=!sec?scMine():{tq:scTQ,nk:scNK,pb:scPB,rs:scRS,dm:scDMtab}[SC.tab]();
  m.innerHTML=`<div class="sochi">${H("Sổ chi phí",pLabel()+(sec?" · nguồn: sổ cái TK 642 (MISA) và phiếu chi":""))}
   <div class="filters">${ghi?`<button class="btn pri" id="sc-new">＋ Ghi phiếu chi</button>`:""}${duyet?`<button class="btn" id="sc-imp">Nạp sổ từ file</button>`:""}<button class="btn sm" id="sc-ncc">Phiếu chi nhà cung cấp</button><button class="btn sm" id="sc-vc">Phiếu chi vận chuyển</button></div>
   <div class="sctabs">${TABS.map(([k,t])=>`<button class="${SC.tab===k?"on":""}" data-sct="${k}">${t}</button>`).join("")}</div>${body}</div>`;
  m.querySelectorAll("[data-sct]").forEach(b=>b.onclick=()=>{SC.tab=b.dataset.sct;renderMain()});
  const on=(id,fn)=>{const e=document.getElementById(id);if(e)e.onclick=fn};
  on("sc-new",()=>scForm());on("sc-imp",()=>scImport());
  on("sc-ncc",async()=>{await mhLoad();mhLoadInv();mhPayForm()});on("sc-vc",()=>{PAGE="cr_vc";try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}render();scrollTo(0,0)});
  [["scf-fg","g"],["scf-fk","k"],["scf-fs","st"],["scf-fq","q"]].forEach(([id,k])=>{const e=document.getElementById(id);if(e)e.onchange=()=>{SC[k]=e.value;renderMain()}});
  const findR=id=>scRows().find(x=>x.id===id)||((scFin().nkc)||[]).find(x=>x.id===id);
  m.querySelectorAll("tr[data-id]").forEach(tr=>tr.onclick=e=>{if(e.target.closest("select,button,input"))return;const id=tr.dataset.id,c=scCho().find(x=>x.id===id);if(c)scPhieu(c,true);else{const r=findR(id);if(r)scPhieu(r,false)}});
  m.querySelectorAll("select[data-bv]").forEach(s=>s.onchange=()=>{const id=s.dataset.bv,v=s.value;DB.mutate(ME.name,"đổi nơi chịu khoản chi",dt=>{const r=((dt.fin||{}).nkc||[]).find(y=>y.id===id);if(!r)return;if(r.k0==null)r.k0=r.k;r.k=v;if(v!=="Chờ xác định"&&r.st==="Cần rà"&&!r.gc)r.st="Ổn";(dt.fin.cpRule=dt.fin.cpRule||{})[scKey(r.dg)]={g:r.g,k:v,st:r.st}});renderMain()});
  m.querySelectorAll("[data-dm]").forEach(el=>el.onchange=()=>{const i=+el.dataset.dm,f=el.dataset.f,v=f==="cd"?+el.value:el.value;DB.mutate(ME.name,"sửa danh mục chi phí",dt=>{dt.fin=dt.fin||{};if(!dt.fin.cpdm||!dt.fin.cpdm.length)dt.fin.cpdm=JSON.parse(JSON.stringify(SC_DM0));dt.fin.cpdm[i][f]=v});toast("Đã lưu danh mục");renderMain()});
  m.querySelectorAll("[data-go-st],[data-go-k],[data-go-g]").forEach(b=>b.onclick=()=>{Object.assign(SC,{tab:"nk",st:b.dataset.goSt||"",k:b.dataset.goK||"",g:b.dataset.goG||"",q:""});if(b.dataset.goG)SC.st="Cần rà";renderMain()});
  on("scdt-ed",()=>{const ym=PERIOD.from.slice(0,7),sv=((scFin().cpDT||{})[ym])||{},N=execNums(PERIOD.from,PERIOD.to),auto={"TikTok":N.tt||0,"Facebook":N.fbGiao||0};
    openDrawerHTML(`<h2>Doanh thu thực tháng ${ym.slice(5)}/${ym.slice(0,4)}</h2><p class="hint">Dùng để chia chi chung về kênh. Để trống thì web tự lấy (chỉ có TikTok, Facebook).</p><form class="frm" id="scdt">${SC_KENH.map(k=>`<label class="field">${k} (đ)${auto[k]?` <span class="hint">· web tự lấy ${scNf(auto[k])}</span>`:""}<input type="number" min="0" data-dtk="${k}" value="${sv[k]!=null?sv[k]:""}"></label>`).join("")}<button class="btn pri">Lưu</button></form>`);
    $("#scdt").onsubmit=e=>{e.preventDefault();const o={};document.querySelectorAll("[data-dtk]").forEach(i=>{if(i.value!=="")o[i.dataset.dtk]=+i.value});DB.mutate(ME.name,"nhập doanh thu thực "+ym,dt=>{dt.fin=dt.fin||{};(dt.fin.cpDT=dt.fin.cpDT||{})[ym]=o});closeDrawer();renderMain()}});
}
/* Người không xem được sổ (chị Thảo nếu không có quyền kế toán): chỉ thấy phiếu mình đã gửi chờ duyệt. */
function scMine(){const L=scCho().filter(x=>x.by===ME.name);return `<section class="card flush"><div class="sch pad"><h2>Phiếu chi đã gửi, chờ chị Huệ duyệt</h2></div>${L.length?`<div class="tbl"><table><thead><tr><th>Ngày</th><th>Số phiếu</th><th>Nội dung</th><th class="n">Số tiền</th><th>Nhóm</th><th>Bổ vào</th></tr></thead><tbody>${L.map(x=>`<tr><td>${scDd(x.d)}</td><td class="mono">${esc(x.ct)}</td><td>${esc(x.dg)}</td><td class="n">${scNf(x.t)}</td><td>${esc(scG(x.g).n)}</td><td>${esc(x.k)}</td></tr>`).join("")}</tbody></table></div>`:`<p class="empty pad">Không có phiếu nào đang chờ duyệt. Phiếu đã duyệt nằm trong sổ của kế toán.</p>`}</section>`}
PAGES.so_cp=pSoChi;
spForm=scForm;
