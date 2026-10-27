/* =====================================================================
   LUẬT DOANH THU THỰC (chị Hoa chốt 25–26/10/2026), phần tính thuần, không đụng trang (có test: tests/unit/dtcalc.test.ts).
   - Doanh thu = doanh thu THỰC: TikTok doanh thu thuần theo quyết toán, Facebook đơn giao thành công (Pancake),
     Kênh phân phối / Kênh OEM đơn đã duyệt trên CRM. GMV, doanh thu chốt đơn chỉ là chỉ số hiệu suất.
   - Đơn xác nhận tháng nào tính doanh thu tháng đó. Số tháng trước chốt vào NGÀY 10 THÁNG SAU:
     trước ngày 10 là "chưa chốt – dự kiến", từ ngày 10 là "đã chốt" và số đã chốt không đổi nữa.
   - Dự kiến = số thật đến lúc đó + đơn đang giao × (1 − tỷ lệ hoàn dự kiến).
   ===================================================================== */
const DT_KENH=[["tts","TikTok Shop"],["spe","Shopee"],["fb","Facebook"],["cskh","CSKH cũ"],["b2b","Kênh phân phối"],["gc","Kênh OEM"]];
const DT_HOAN_FB=0.08;/* tỷ lệ hoàn dự kiến đơn Facebook đang giao (chị Hoa thường dùng, giống thẻ dự kiến ở trang Facebook) */
const DT_TU="2026-09";/* luật chốt ngày 10 áp từ tháng 9/2026 */
/* Ngày chốt số của tháng ym = ngày 10 tháng sau. */
function dtNgayChot(ym){const y=+ym.slice(0,4),m=+ym.slice(5,7),ny=m===12?y+1:y,nm=m===12?1:m+1;return ny+"-"+String(nm).padStart(2,"0")+"-10"}
/* "chot" khi hôm nay đã tới ngày chốt, ngược lại "chua". today dạng yyyy-mm-dd (giờ Việt Nam). */
const dtTrangThai=(ym,today)=>today>=dtNgayChot(ym)?"chot":"chua";
const dtVN=d=>d.slice(8,10)+"/"+d.slice(5,7);
function dtNhan(ym,today){return dtTrangThai(ym,today)==="chot"?"đã chốt "+dtVN(dtNgayChot(ym)):"chưa chốt – dự kiến (chốt ngày "+dtVN(dtNgayChot(ym))+")"}
const dtDuKien=(that,dang,hoan)=>(+that||0)+Math.max(0,+dang||0)*(1-(hoan==null?DT_HOAN_FB:hoan));
/* Một ngày Facebook từ Pancake (blob fb_sale_days: mỗi dòng một sale). dtGiao = giao thành công (đã trừ hoàn),
   dt = doanh thu đơn chốt (chưa hủy), phần còn lại dt − giao − hoàn là đơn đang giao. */
function dtFbNgay(L){const o={tao:0,huy:0,giao:0,hoan:0,dt:0,dtGiao:0,hoanDt:0};(L||[]).forEach(r=>{for(const k in o)o[k]+=+r[k]||0});o.dang=Math.max(0,o.dt-o.dtGiao-o.hoanDt);return o}
/* Tháng ym có cần lưu số chốt không: đã tới ngày chốt, chưa có số chốt, từ tháng áp luật, và có số (không chốt số trống / 0). */
const dtCanChot=(ym,today,snap,dt)=>ym>=DT_TU&&dtTrangThai(ym,today)==="chot"&&!snap&&dt!=null&&+dt>0;
/* Số hiện trên trang: tháng đã chốt và có số chốt thì lấy số chốt (đóng băng), còn lại lấy số đang tính. */
const dtChon=(live,snap,ym,today)=>dtTrangThai(ym,today)==="chot"&&snap?{...snap,frozen:true}:{...live,frozen:false};
const dtLech=(a,b)=>a==null||b==null?null:a-b;
