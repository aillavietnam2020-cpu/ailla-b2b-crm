/* =====================================================================
   PHIẾU LƯƠNG MẪU — theo tab PhieuLuong của AILLA HR MASTER v4
   Nguồn số: bảng lương trong file (hr.blFile) nếu kỳ đó có; không có thì web tự tính (calcRow).
   Chấm công, phụ cấp, thưởng KPI lấy thêm từ hr.cc / hr.pc / hr.kpiTT để ghi chi tiết.
   ===================================================================== */
const PL_SO=["không","một","hai","ba","bốn","năm","sáu","bảy","tám","chín"];
function plDoc3(n,full){const t=Math.floor(n/100),c=Math.floor(n%100/10),d=n%10,o=[];if(full||t)o.push(PL_SO[t]+" trăm");if(c===0){if(d&&(full||t))o.push("lẻ")}else if(c===1)o.push("mười");else o.push(PL_SO[c]+" mươi");if(d){if(d===5&&c)o.push("lăm");else if(d===1&&c>1)o.push("mốt");else if(d===4&&c>1)o.push("tư");else o.push(PL_SO[d])}return o.join(" ")}
function plChu(n){n=Math.round(Math.abs(n||0));if(!n)return "Không đồng";const u=["","nghìn","triệu","tỷ"],p=[];let i=0;while(n>0){p.unshift([n%1000,i]);n=Math.floor(n/1000);i++}
  const s=p.map(([v,k],j)=>v?plDoc3(v,j>0)+(u[k]?" "+u[k]:""):"").filter(Boolean).join(" ").replace(/\s+/g," ").trim();return s.charAt(0).toUpperCase()+s.slice(1)+" đồng"}
function plData(ma,ky){
  const h=HRD(),f=((h.blFile||{})[ky]||{})[ma],st=staffBy(ma),n=nvNs(ma),cc=((h.cc||{})[ky]||{})[ma]||{},pc=((h.pc||{})[ky]||{})[ma],kp=((h.kpiTT||{})[ky]||{})[ma];
  if(f){const g=k=>+f[k]||0;return {nguon:"file",st,n,cc,pc,kp,hinhThuc:f["Hình thức tính lương"]||n.hinhThuc||"",congChuan:g("Công chuẩn")||26,congHL:g("Công/Giờ hưởng lương"),congTV:g("Công TV"),congCT:g("Công CT"),gio:g("Giờ làm"),otPhut:g("Tổng phút OT"),
    luong:g("Lương chính thức")||n.luong||0,lTV:g("Lương TV theo công"),lCT:g("Lương CT theo công"),lCong:g("Lương theo công/HĐ"),phuCap:g("Phụ cấp"),thuong:g("Thưởng/KPI")||(kp?kp.tong:0),ot:g("Tiền OT"),tong:g("TỔNG THU NHẬP"),
    nenBH:g("Nền BHXH"),bh:g("BHXH NLĐ đóng"),thue:g("Thuế TNCN"),tu:g("Tạm ứng khấu trừ (nhập tay)"),muon:g("Trừ muộn/về sớm"),khac:g("Khấu trừ khác (nhập tay)"),thucLinh:g("THỰC LĨNH"),bhDN:g("BHXH DN đóng"),trangThai:f["Trạng thái"]||""}}
  const r=calcRow(ma,ky);return {nguon:"web",st,n,cc,pc,kp,hinhThuc:n.hinhThuc||"Theo tháng",congChuan:r.congChuan,congHL:r.cong,congTV:cc.congTV||0,congCT:cc.congCT||0,gio:cc.gio||0,otPhut:(cc.ot||0)*60,luong:r.luong,lTV:0,lCT:0,lCong:r.lCong,phuCap:pc?pc.tong:r.pcT,thuong:r.kpi+r.khac+r.wb,ot:r.ot,tong:r.tong,nenBH:r.nenBH,bh:r.bh,thue:r.thue,tu:r.tu,muon:cc.tienTru||0,khac:0,thucLinh:r.thucLinh,bhDN:0,trangThai:r.tamTinh?"Tạm tính (chưa có công)":"Web tự tính"};
}
function plHTML(ma,ky){
  const p=plData(ma,ky),s=p.st,n=p.n,hs=n.hs||{},c=p.cc,v=x=>nf(x),row=(l,x,cls)=>`<tr${cls?` class="${cls}"`:""}><td>${l}</td><td class="n">${x}</td></tr>`,thang=ky.slice(5)+"/"+ky.slice(0,4);
  const pcL=p.pc?[["PC trách nhiệm",p.pc.tn],["PC chuyên cần",p.pc.cc],["PC ăn trưa",p.pc.an],["PC xăng xe",p.pc.xang],["PC điện thoại",p.pc.dt],["PC độc hại",p.pc.dh]].filter(x=>x[1]):[];
  const kpL=p.kp?[["Thưởng doanh số",p.kp.thDS],["Thưởng chi phí quảng cáo",p.kp.thCP],["Thưởng video winner",p.kp.thV]].filter(x=>x[1]):[];
  const tru=p.bh+p.thue+p.tu+p.muon+p.khac;
  return `<div class="pl-sheet"><div class="pl-head"><img src="data:image/png;base64,${LOGO}" alt="Ailla"><div><b>CÔNG TY AILLA VIỆT NAM</b><small>Phiếu lương nội bộ — vui lòng không chia sẻ</small></div><div class="pl-ky">Kỳ lương<b>${thang}</b></div></div>
  <h2>PHIẾU LƯƠNG THÁNG ${thang}</h2>
  <table class="pl-info"><tr><td>Mã nhân viên</td><td><b>${esc(s.ma)}</b></td><td>Phòng ban</td><td><b>${esc(pbName(s.pb))}</b></td></tr><tr><td>Họ và tên</td><td><b>${esc(s.ten)}</b></td><td>Vị trí</td><td>${esc(s.viTri||"")}</td></tr><tr><td>Hình thức lương</td><td>${esc(p.hinhThuc)}</td><td>Bậc lương</td><td>${esc(n.bac||"—")}</td></tr><tr><td>Tài khoản nhận</td><td colspan="3">${esc(hs.stk||"—")}${hs.nh?" · "+esc(hs.nh):""}</td></tr></table>
  <div class="pl-2"><div><h3>Chấm công</h3><table>${row("Công chuẩn",p.congChuan)}${row("Công hưởng lương",p.congHL)}${p.congTV?row("Trong đó: công thử việc",p.congTV):""}${p.congCT&&p.congTV?row("Trong đó: công chính thức",p.congCT):""}${c.le?row("Công ngày lễ",c.le):""}${c.phep?row("Phép hưởng lương",c.phep):""}${p.gio?row("Giờ làm",Math.round(p.gio*10)/10):""}${row("Tăng ca (giờ)",Math.round(p.otPhut/6)/10)}${row("Đi muộn / về sớm",(c.muon||0)+" lần · "+((c.phutMuon||0)+(c.phutSom||0))+" phút")}${row("Tỷ lệ công",p.congChuan?Math.round(p.congHL/p.congChuan*1000)/10+"%":"—")}${c.chuyenCan?row("Đủ chuyên cần",c.chuyenCan):""}</table></div>
   <div><h3>Thu nhập</h3><table>${row("Lương cứng (theo hợp đồng)",v(p.luong),"mut")}${p.lTV?row("Lương thử việc theo công",v(p.lTV)):""}${p.lCT?row("Lương chính thức theo công",v(p.lCT)):""}${row("Lương theo công",v(p.lCong))}${row("Phụ cấp",v(p.phuCap))}${pcL.map(x=>row("&nbsp;&nbsp;· "+x[0],v(x[1]),"sub")).join("")}${row("Thưởng / KPI",v(p.thuong))}${kpL.map(x=>row("&nbsp;&nbsp;· "+x[0],v(x[1]),"sub")).join("")}${row("Tiền tăng ca",v(p.ot))}${row("TỔNG THU NHẬP",v(p.tong),"tot")}</table>
   <h3>Khấu trừ</h3><table>${row("BHXH, BHYT, BHTN (10,5%)",v(p.bh))}${row("Thuế TNCN",v(p.thue))}${row("Tạm ứng",v(p.tu))}${row("Trừ đi muộn / về sớm",v(p.muon))}${row("Khấu trừ khác",v(p.khac))}${row("TỔNG KHẤU TRỪ",v(tru),"tot")}</table></div></div>
  <div class="pl-net"><span>THỰC LĨNH</span><b>${v(p.thucLinh)} đ</b><i>Bằng chữ: ${plChu(p.thucLinh)}</i></div>
  <p class="pl-note">Mức đóng BHXH: ${v(p.nenBH)} đ${p.bhDN?` · Công ty đóng thêm: ${v(p.bhDN)} đ`:""} · Nguồn số: ${p.nguon==="file"?"bảng lương HR MASTER":"web tự tính"}${p.trangThai?" · "+esc(p.trangThai):""}. Có thắc mắc về phiếu lương, báo phòng Hành chính nhân sự trong 3 ngày kể từ ngày nhận.</p>
  <div class="pl-ky3"><div>Người lập phiếu<small>(HCNS)</small></div><div>Kế toán</div><div>Người nhận<small>(ký, ghi rõ họ tên)</small></div></div></div>`;
}
const PL_CSS=`.pl-sheet{background:#fff;color:#14213d;font-family:"Be Vietnam Pro",Arial,sans-serif;font-size:13px;max-width:780px;margin:0 auto 18px;padding:26px 30px;border:1px solid #dfe5ef;border-radius:12px}
.pl-head{display:flex;align-items:center;gap:14px;border-bottom:3px solid #14213d;padding-bottom:10px}.pl-head img{height:44px}.pl-head b{display:block;font-size:15px}.pl-head small{color:#667;font-size:11.5px}.pl-ky{margin-left:auto;text-align:right;font-size:11.5px;color:#667}.pl-ky b{display:block;font-size:18px;color:#e7357b}
.pl-sheet h2{text-align:center;font-size:19px;margin:16px 0 12px;letter-spacing:.03em}.pl-sheet h3{font-size:12.5px;text-transform:uppercase;color:#fff;background:#14213d;margin:12px 0 0;padding:6px 10px;border-radius:6px 6px 0 0}
.pl-sheet table{width:100%;border-collapse:collapse}.pl-sheet td{padding:5px 10px;border-bottom:1px solid #e8ecf3}.pl-sheet td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.pl-info td{border:1px solid #e8ecf3}.pl-info td:nth-child(odd){color:#667;width:18%;background:#f7f9fc}
.pl-2{display:grid;grid-template-columns:1fr 1.25fr;gap:16px}.pl-sheet tr.tot td{font-weight:800;background:#eef3fb}.pl-sheet tr.sub td{color:#667;font-size:12px}.pl-sheet tr.mut td{color:#667}
.pl-net{margin:16px 0 8px;border:2px solid #e7357b;border-radius:10px;padding:12px 16px;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:4px 16px}.pl-net span{font-weight:800;font-size:15px}.pl-net b{font-size:24px;color:#e7357b;text-align:right}.pl-net i{grid-column:1/-1;color:#445;font-size:12.5px}
.pl-note{font-size:11.5px;color:#667;margin:6px 0 18px}.pl-ky3{display:grid;grid-template-columns:repeat(3,1fr);text-align:center;font-weight:700;min-height:90px}.pl-ky3 small{display:block;font-weight:400;color:#667;font-size:11px}
@media (max-width:700px){.pl-2{grid-template-columns:1fr}.pl-sheet{padding:16px}}`;
let PLF={ky:"",ma:""};
function pHrPhieuMau(m){
  if(!hrOk()){m.innerHTML=H("Phiếu lương")+`<section class="card"><p>Trang này chỉ CEO, kế toán và phòng Hành chính nhân sự xem được.</p></section>`;return}
  const h=HRD(),ks=[...new Set(Object.keys(h.blFile||{}).concat(Object.keys(h.cc||{})).concat(Object.keys(h.payroll||{})))].filter(k=>/^\d{4}-\d{2}$/.test(k)).sort().reverse();if(!ks.length)ks.push(HRM);if(!ks.includes(PLF.ky))PLF.ky=ks[0];
  const inKy=new Set(Object.keys((h.blFile||{})[PLF.ky]||{}).concat(Object.keys((h.cc||{})[PLF.ky]||{}))),L=D().staff.filter(x=>inKy.size?inKy.has(x.ma):x.tt!=="Đã nghỉ");if(!L.some(x=>x.ma===PLF.ma))PLF.ma=(L[0]||{}).ma||"";
  m.innerHTML=H("Phiếu lương",`Mẫu phiếu theo tab PhieuLuong của HR MASTER · kỳ ${PLF.ky.slice(5)}/${PLF.ky.slice(0,4)}`)+`<style>${PL_CSS}</style>
  <div class="filters"><label class="inl">Kỳ lương <select id="pl-k">${opt(ks.map(k=>[k,k.slice(5)+"/"+k.slice(0,4)]),PLF.ky)}</select></label><label class="inl">Nhân viên <select id="pl-m">${opt(L.map(x=>[x.ma,x.ma+" · "+x.ten]),PLF.ma)}</select></label><span class="sp"></span><button class="btn" id="pl-in">In / lưu PDF phiếu này</button><button class="btn pri" id="pl-all">In cả kỳ (${L.length} phiếu)</button></div>
  ${(h.blFile||{})[PLF.ky]?"":`<div class="note">Kỳ này chưa có bảng lương trong file HR MASTER nên số trên phiếu do web <b>tự tính tạm</b> theo chính sách ở Cài đặt lương (thuế, giảm trừ còn chờ kế toán xác nhận).</div>`}
  ${PLF.ma?plHTML(PLF.ma,PLF.ky):`<section class="card"><p>Chưa có nhân viên nào trong kỳ này. Nạp file HR MASTER ở Nhân sự › Nạp file HR MASTER.</p></section>`}`;
  $("#pl-k").onchange=e=>{PLF.ky=e.target.value;renderMain()};$("#pl-m").onchange=e=>{PLF.ma=e.target.value;renderMain()};
  const pr=(title,html)=>{const w=window.open("","_blank");if(!w){toast("Trình duyệt chặn cửa sổ in");return}w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;700;800&display=swap"><style>body{margin:0;padding:12px;background:#fff}${PL_CSS}.pl-sheet{border:0;page-break-after:always;max-width:none}@page{size:A4;margin:10mm}</style>${html}<script>onload=()=>setTimeout(()=>print(),400)<\/script>`);w.document.close()};
  $("#pl-in").onclick=()=>{if(PLF.ma)pr(`Phieu luong ${PLF.ma} ${PLF.ky}`,plHTML(PLF.ma,PLF.ky))};
  $("#pl-all").onclick=()=>pr(`Phieu luong ky ${PLF.ky}`,L.map(x=>plHTML(x.ma,PLF.ky)).join(""));
}
PAGES.hr_pl=pHrPhieuMau;
