/* =====================================================================
   NẠP FILE AILLA HR MASTER v4 (tab NhanSu, HopDong, NghiPhep, ChamCong, CCDuLieu, PhuCap, KPI, BangLuong)
   Gộp vào dữ liệu đang có: ô trống trong file không xóa số đã sửa tay trên web.
   ===================================================================== */
// SheetJS đọc ngày lệch vài giây về ngày hôm trước (múi giờ cũ năm 1899): cộng nửa ngày rồi mới lấy ngày.
const v4d=v=>v instanceof Date?iso(new Date(v.getTime()+432e5)):dstr(v);
const v4Ky=v=>{const s=v4d(v);return /^\d{4}-\d{2}/.test(s)?s.slice(0,7):""};
const v4Hm=v=>{if(v instanceof Date){const t=Math.round((v.getHours()*3600+v.getMinutes()*60+v.getSeconds())/60);return String(Math.floor(t/60)%24).padStart(2,"0")+":"+String(t%60).padStart(2,"0")}if(typeof v==="number"&&v<1){const t=Math.round(v*1440);return String(Math.floor(t/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0")}return v==null?"":String(v).trim()};
const v4s=v=>v==null?"":String(v).trim();
const v4n=v=>{if(typeof v==="number")return isFinite(v)?v:0;const s=v4s(v);if(!s||s[0]==="#"||s==="-")return 0;const n=+s.replace(/[^\d.-]/g,"");return isFinite(n)?n:0};
function importV4(S){
  const T=k=>tableOf(S[k]||[]).filter(r=>/^NV\d/.test(v4s(r["Mã NS"])));
  const o={staff:{},ns:{},phep:{},cc:{},ccd:{},ccLoi:[],pc:{},kpiTT:{},thuong:{},blFile:{},dem:{}};
  T("NhanSu").forEach(r=>{const ma=v4s(r["Mã NS"]);o.staff[ma]={ma,ten:v4s(r["Họ và tên"]),khoi:v4s(r["Khối"]),pbTen:v4s(r["Phòng ban"]),viTri:v4s(r["Vị trí"]),nghe:v4s(r["Nhóm nghề"]),ql:v4s(r["Quản lý trực tiếp"]),ngayVao:v4d(r["Ngày vào làm"]),tt:v4s(r["Tình trạng làm việc"]),lamViec:v4s(r["Hình thức làm việc"])};
    o.ns[ma]={bac:v4s(r["Bậc hiện tại"]),ngayBac:v4d(r["Ngày vào bậc"]),npt:v4n(r["Người phụ thuộc"]),hetTV:v4d(r["Ngày hết thử việc"]),hs:{sdt:v4s(r["SĐT"]),email:v4s(r["Email"]),cccd:v4s(r["CCCD"]),stk:v4s(r["Tài khoản ngân hàng"]),diaChi:v4s(r["Địa chỉ thường trú"]),ngaySinh:v4d(r["Ngày sinh"]),gioi:v4s(r["Giới tính"]),ngayNghi:v4d(r["Ngày nghỉ việc"])}}});
  T("HopDong").forEach(r=>{const ma=v4s(r["Mã NS"]),n=o.ns[ma]=o.ns[ma]||{hs:{}};n.hd={loai:v4s(r["Loại HĐ"]),so:v4s(r["Số HĐ"]),lanKy:v4s(r["Lần ký HĐ"]),ky:v4d(r["Ngày ký"]),hieuLuc:v4d(r["Ngày hiệu lực"]),het:v4d(r["Ngày hết hạn"]),hetTV:v4d(r["Ngày hết thử việc"])||n.hetTV||"",luongTV:v4n(r["Lương thử việc"]),luongCT:v4n(r["Lương cứng"]),giay:v4s(r["Đã ký bản giấy"])};n.luong=v4n(r["Lương cứng"]);n.luongTV=v4n(r["Lương thử việc"]);n.luongGio=v4n(r["Lương theo giờ"]);n.nenBH=v4n(r["Nền BHXH"]);n.hinhThuc=v4s(r["Hình thức trả lương"])});
  T("NghiPhep").forEach(r=>{const ma=v4s(r["Mã NS"]),k=Object.keys(r);o.phep[ma]={chuan:v4n(r["Phép năm tiêu chuẩn"]),huong:v4n(r[k.find(x=>/^Phép được hưởng/.test(x))]),da:v4n(r["Đã nghỉ phép"]),ton:v4n(r["Phép tồn"]),kl:v4n(r["Nghỉ không lương"]),om:v4n(r["Nghỉ ốm"]),ts:v4n(r["Thai sản"]),canhBao:v4s(r["Cảnh báo"])}});
  T("ChamCong").forEach(r=>{const th=v4Ky(r["Kỳ"]);if(!th)return;(o.cc[th]=o.cc[th]||{})[v4s(r["Mã NS"])]={cong:v4n(r["Công thực tế"]),congChuan:v4n(r["Công chuẩn"]),le:v4n(r["Công ngày lễ"]),phep:v4n(r["Phép hưởng lương"]),congHL:v4n(r["Công hưởng lương"]),congTV:v4n(r["Công TV"]),congCT:v4n(r["Công CT"]),gio:v4n(r["Giờ làm"]),ot:Math.round(v4n(r["Tổng phút OT"])/6)/10,otCN:0,kl:v4n(r["Nghỉ không lương"]),om:v4n(r["Nghỉ ốm"]),muon:v4n(r["Đi muộn (lần)"]),phutMuon:v4n(r["Phút đi muộn"]),phutSom:v4n(r["Phút về sớm"]),tienTru:v4n(r["TIỀN TRỪ muộn/sớm"]),chuyenCan:v4s(r["Đủ chuyên cần?"]),doiChieu:v4s(r["Đã đối chiếu?"]),hinhThuc:v4s(r["Hình thức tính lương"])}});
  tableOf(S["CCDuLieu"]||[]).forEach(r=>{const th=v4Ky(r["Kỳ"]),ma=v4s(r["Mã NS"]);if(!th||!r["Ngày"])return;const kt=v4s(r["Cần kiểm tra?"]);if(!/^NV\d/.test(ma)){o.ccLoi.push([th,v4s(r["Họ và tên"]),v4d(r["Ngày"]),kt||"Chưa có mã NS"]);return}
    const kh=r["Ký hiệu"]!==undefined?r["Ký hiệu"]:r["Ký hiệu "];
    ((o.ccd[th]=o.ccd[th]||{})[ma]=o.ccd[th][ma]||[]).push([v4d(r["Ngày"]),v4s(r["Thứ"]),v4Hm(r["Vào"]),v4Hm(r["Ra"]),v4n(r["Công"]),v4n(r["Giờ làm"]),v4n(r["Trễ (phút)"]),v4n(r["Sớm (phút)"]),v4n(r["OT (giờ)"]),kh instanceof Date?"":v4s(kh),v4s(r["Nguồn"]),kt,v4s(r["Lỗi / ngoại lệ dữ liệu"])])});
  T("PhuCap").forEach(r=>{const th=v4Ky(r["Kỳ"]);if(!th)return;(o.pc[th]=o.pc[th]||{})[v4s(r["Mã NS"])]={tn:v4n(r["PC trách nhiệm"]),cc:v4n(r["PC chuyên cần"]),an:v4n(r["PC ăn trưa"]),xang:v4n(r["PC xăng xe"]),dt:v4n(r["PC điện thoại"]),dh:v4n(r["PC độc hại"]),tong:v4n(r["TỔNG PHỤ CẤP"])}});
  T("KPI").forEach(r=>{const th=v4Ky(r["Tháng"]);if(!th)return;const ma=v4s(r["Mã NS"]),tong=v4n(r["TỔNG THƯỞNG"]),cp=r["% CPQC"]!==undefined?r["% CPQC"]:r["% CPQC "];(o.kpiTT[th]=o.kpiTT[th]||{})[ma]={nhom:v4s(r["Nhóm KPI"]),mt:v4n(r["Mục tiêu DS tối thiểu"]),ds:v4n(r["Doanh số thực tế"]),pct:v4n(r["% đạt KPI"]),thDS:v4n(r["Thưởng doanh số"]),cpqc:v4n(cp),thCP:v4n(r["Thưởng CPQC"]),vw:v4n(r["Video Winner"]),thV:v4n(r["Thưởng Video"]),tong,lead:v4s(r["Lead xác nhận"])};(o.thuong[th]=o.thuong[th]||{})[ma]={kpi:tong,khac:0}});
  T("BangLuong").forEach(r=>{const th=v4Ky(r["Kỳ"]);if(!th)return;const x={};Object.entries(r).forEach(([k,v])=>{if(!["Kỳ","Mã NS","Họ và tên"].includes(k))x[k]=typeof v==="number"?v:v4s(v)});(o.blFile[th]=o.blFile[th]||{})[v4s(r["Mã NS"])]=x});
  const cnt=x=>Object.values(x).reduce((a,v)=>a+Object.keys(v).length,0);
  o.dem={ns:Object.keys(o.staff).length,hd:Object.values(o.ns).filter(n=>n.hd).length,phep:Object.keys(o.phep).length,cc:cnt(o.cc),ccd:Object.values(o.ccd).reduce((a,v)=>a+Object.values(v).reduce((b,L)=>b+L.length,0),0),ccLoi:o.ccLoi.length,pc:cnt(o.pc),kpi:cnt(o.kpiTT),bl:cnt(o.blFile)};
  return o;
}
function applyV4(dt,o,file){
  const h=dt.hr,fold=s=>foldName(s),pbK=t=>{if(!t)return "";const p=dt.departments.find(p=>fold(p.n)===fold(t)||p.k===t)||dt.departments.find(p=>fold(p.n).includes(fold(t))||fold(t).includes(fold(p.n)));return p?p.k:""};
  const put=(tgt,src)=>{Object.entries(src).forEach(([k,v])=>{if(v===""||v==null)return;tgt[k]=v})};let moi=0,sua=0;
  Object.values(o.staff).forEach(s=>{let r=dt.staff.find(x=>x.ma===s.ma);if(!r){r={ma:s.ma,ten:s.ten,khoi:"",pb:"",viTri:"",ql:"",ngayVao:"",tt:"Thử việc",hd:"",nghe:"",bac:""};dt.staff.push(r);moi++}else sua++;
    put(r,{ten:s.ten,khoi:s.khoi,pb:pbK(s.pbTen)||r.pb,viTri:s.viTri,nghe:s.nghe,ql:s.ql,ngayVao:s.ngayVao,tt:s.tt,lamViec:s.lamViec})});
  Object.entries(o.ns).forEach(([ma,src])=>{const n=h.ns[ma]=h.ns[ma]||{};const {hs,hd,hetTV,...rest}=src;Object.entries(rest).forEach(([k,v])=>{if(v===""||v==null||(typeof v==="number"&&!v&&n[k]))return;n[k]=v});if(hs){n.hs=n.hs||{};put(n.hs,hs)}if(hd){n.hd=n.hd||{};put(n.hd,hd)}else if(hetTV){n.hd=n.hd||{};n.hd.hetTV=n.hd.hetTV||hetTV}
    if((n.npts||[]).length)n.npt=n.npts.filter(p=>p.tt!=="Thôi").length;nvLog(dt,ma,"Cập nhật từ file "+file)});
  Object.assign(h.phep,o.phep);
  ["cc","ccd","pc","kpiTT","thuong","blFile"].forEach(k=>{h[k]=h[k]||{};Object.entries(o[k]).forEach(([th,v])=>{h[k][th]=Object.assign(h[k][th]||{},v)})});
  h.ccLoi=o.ccLoi;h.loaded=true;h.file=file;h.at=new Date().toLocaleString("vi-VN");h.nap=Object.assign({},o.dem,{moi,sua,by:ME.name});
}
pHrNap=function(m){
  const h=HRD(),d=h.nap;
  m.innerHTML=H("Nạp file HR MASTER","Dữ liệu cất ở ngăn riêng trên máy chủ: chỉ CEO, kế toán và HCNS xem được")+`<section class="card"><ol class="lessons"><li>Mở Google Sheet <b>AILLA HR MASTER</b> → <b>Tệp › Tải xuống › Microsoft Excel (.xlsx)</b>.</li><li>Kéo file vừa tải vào ô dưới (bản v4: các tab NhanSu, HopDong, NghiPhep, ChamCong, CCDuLieu, PhuCap, KPI, BangLuong).</li><li>Nạp lại bao nhiêu lần cũng được: người đã có thì cập nhật, người mới thì thêm; ô trống trong file không xóa số đã sửa trên web.</li></ol>${dropZone("hr")}
  ${h.loaded?`<div class="note">Lần nạp gần nhất: <b>${esc(h.file||"")}</b> lúc ${esc(h.at||"")}${d?` · ${esc(d.by||"")}`:""}</div>`:""}
  ${d?`<div class="grid kpis">${kpi("Nhân viên",d.ns,`${d.moi} người mới · ${d.sua} cập nhật`)}${kpi("Hợp đồng & lương",d.hd)}${kpi("Phép năm",d.phep)}${kpi("Chấm công tổng hợp",d.cc,"người × kỳ")}${kpi("Dòng máy chấm công",d.ccd,d.ccLoi?d.ccLoi+" dòng chưa có mã NS":"")}${kpi("Phụ cấp",d.pc)}${kpi("Thưởng KPI",d.kpi)}${kpi("Bảng lương trong file",d.bl,"để đối chiếu")}</div>`:""}
  ${(h.ccLoi||[]).length?`<section class="card"><div class="card-h"><h2>Dòng chấm công chưa gắn được người</h2><span class="hint">gán Mã NS trong tab CCDuLieu rồi nạp lại</span></div>${tbl(["Kỳ","Tên trên máy / bảng","Ngày","Ghi chú"],[...new Map(h.ccLoi.map(x=>[x[0]+x[1],x])).values()].slice(0,60).map(x=>`<tr><td>${esc(x[0])}</td><td>${esc(x[1])}</td><td>${vndate(x[2])}</td><td>${esc(x[3])}</td></tr>`))}</section>`:""}</section>`;
  bindDrop("hr",async f=>{let S;try{S=await wbSheets(f)}catch(e){return}
    if(S["NhanSu"]){const o=importV4(S);if(!o.dem.ns){toast("Tab NhanSu không có dòng nào bắt đầu bằng NV");return}DB.mutate(ME.name,"nạp file HR MASTER "+f.name,dt=>applyV4(dt,o,f.name));toast(`Đã nạp ${o.dem.ns} nhân viên, ${o.dem.ccd} dòng chấm công`);renderMain();return}
    if(S["01_NhanSu"]){const {out,n}=importHR(S);DB.mutate(ME.name,"nạp file HR MASTER",dt=>{Object.assign(dt.hr,out,{loaded:true,file:f.name,at:new Date().toLocaleString("vi-VN"),thangLuong:out.thangLuong||dt.hr.thangLuong})});toast(`Đã nạp ${n} nhân sự (bản file cũ)`);renderMain();return}
    toast("File không có tab NhanSu")});
};
PAGES.hr_nap=pHrNap;
/* Hồ sơ: thêm mục "Chấm công" — giờ vào/ra từng ngày từ máy chấm công, theo kỳ. */
let NVCC="";
{const _h=nvHoSo;nvHoSo=function(ma,ed){let s=_h(ma,ed);s=s.replace(`<button data-nvt="ls"`,`<button data-nvt="cc" class="${NVF.tab==="cc"?"on":""}">Chấm công</button><button data-nvt="ls"`);if(NVF.tab!=="cc")return s;
  const h=HRD(),ks=Object.keys(h.ccd||{}).filter(k=>(h.ccd[k]||{})[ma]).sort().reverse();if(!ks.includes(NVCC))NVCC=ks[0]||"";const L=NVCC?(h.ccd[NVCC][ma]||[]).slice().sort((a,b)=>a[0]<b[0]?-1:1):[],c=((h.cc||{})[NVCC]||{})[ma];
  const body=ks.length?`<div class="filters"><label class="inl">Kỳ <select id="nvcc-k">${opt(ks.map(k=>[k,k.slice(5)+"/"+k.slice(0,4)]),NVCC)}</select></label></div>${c?`<div class="grid kpis">${kpi("Công thực tế",`${c.cong} / ${c.congChuan||26}`)}${kpi("Phép hưởng lương",c.phep)}${kpi("Đi muộn",c.muon+" lần",c.phutMuon+" phút")}${kpi("OT",c.ot+" giờ")}${kpi("Chuyên cần",c.chuyenCan||"—")}</div>`:""}
    ${tbl(["Ngày","Thứ","Vào","Ra","Công","Giờ làm","Trễ (phút)","Sớm (phút)","OT (giờ)","Ký hiệu","Ghi chú"],L.map(r=>`<tr${r[11]?' class="warn"':""}><td>${vndate(r[0])}</td><td>${esc(r[1])}</td><td class="mono">${esc(r[2])}</td><td class="mono">${esc(r[3])}</td><td class="n">${r[4]}</td><td class="n">${Math.round(r[5]*10)/10}</td><td class="n">${r[6]||""}</td><td class="n">${r[7]||""}</td><td class="n">${r[8]||""}</td><td>${esc(r[9])}</td><td>${esc([r[11],r[12]].filter(Boolean).join(" · "))}</td></tr>`))}`:`<p class="hint">Chưa có dữ liệu máy chấm công của người này. Nạp file HR MASTER (tab CCDuLieu) ở Nhân sự › Nạp file HR MASTER.</p>`;
  return s.replace(/<div class="nv-body">[\s\S]*<\/div><\/div><\/section>$/,`<div class="nv-body">${body}</div></div></section>`)}}
{const _b=nvBind;nvBind=function(ma,ed){_b(ma,ed);if($("#nvcc-k"))$("#nvcc-k").onchange=e=>{NVCC=e.target.value;renderMain()}}}
/* Tổng quan nhân sự = trang một màn (ô số + danh sách + hồ sơ), giống mẫu chị chọn. Mục "Nhân viên" gộp vào đây. */
{const _p=pHrNV;pHrNV=function(m){_p(m);if(!hrOk())return;const h=HRD(),w=m.querySelector(".nv-w");if(!w)return;
  const cho=(h.don||[]).filter(x=>x.tt==="cho").length+(h.tu||[]).filter(x=>x.tt==="cho").length,kc=(h.kpi||[]).filter(k=>k.st==="cho").length,tv=D().staff.filter(x=>x.tt==="Thử việc"&&((nvNs(x.ma).hd||{}).hetTV)&&daysTo(nvNs(x.ma).hd.hetTV)<=15).length,loi=(h.ccLoi||[]).length;
  const add=[["amb",cho,"đơn nghỉ / OT / tạm ứng chờ duyệt","hr_nghi"],["amb",kc,"phiếu KPI chờ duyệt","hr_kpi"],["amb",tv,"người sắp hết thử việc (≤ 15 ngày)","hr_hd"],["amb",loi,"dòng chấm công chưa gắn mã NV","hr_nap"]].filter(a=>a[1]);
  w.insertAdjacentHTML("beforeend",add.map(a=>`<div class="nv-wr nv-go" data-go="${a[3]}"><i class="dot d-${a[0]}"></i><b>${a[1]}</b> ${a[2]}</div>`).join(""));
  const t=m.querySelector(".ph h1");if(t)t.textContent="Tổng quan nhân sự"}}
PAGES.hr_tq=pHrNV;PAGES.hr=pHrNV;PAGES.hr_nv=pHrNV;
{const hr=MODULES.find(m=>m.k==="hr");if(hr){const g0=hr.groups;hr.groups=()=>g0().map(([g,its])=>[g,its.filter(i=>i[0]!=="hr_nv")])}}
