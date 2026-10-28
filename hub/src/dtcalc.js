/* =====================================================================
   LUẬT DOANH THU THỰC (chị Hoa chốt 25–26/10/2026), phần tính thuần, không đụng trang (có test: tests/unit/dtcalc.test.ts).
   - Doanh thu = doanh thu THỰC: TikTok doanh thu thuần theo quyết toán, Facebook đơn giao thành công (Pancake),
     Kênh phân phối / Kênh OEM đơn đã duyệt trên CRM. GMV, doanh thu chốt đơn chỉ là chỉ số hiệu suất.
   - Đơn xác nhận tháng nào tính doanh thu tháng đó. Số tháng trước chốt vào NGÀY 10 THÁNG SAU:
     trước ngày 10 là "chưa chốt – dự kiến", từ ngày 10 là "đã chốt" và số đã chốt không đổi nữa.
   - Dự kiến = số thật đến lúc đó + đơn đang giao × (1 − tỷ lệ hoàn dự kiến).
   ===================================================================== */
const DT_KENH=[["tts","TikTok Shop"],["spe","Shopee"],["fb","Facebook"],["cskh","CSKH cũ"],["b2b","Kênh phân phối"],["gc","Kênh OEM"]];
let DT_HOAN_FB=0.08;/* tỷ lệ hoàn dự kiến đơn Facebook đang giao; từ 28/10/2026 trang Facebook (fbv2.js) đổi theo tỷ lệ hoàn thật tháng gần nhất đã chốt (chị Hoa duyệt), 8% chỉ khi chưa đủ số */
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
/* Sổ chi phí (fin.nkc) bổ thẳng về một kênh hoặc Sản xuất → trừ ở P&L kênh đó (dòng "Chung" đi qua spChungTheoThang, không lấy ở đây).
   Bỏ loại P&L kênh đã tự trừ (lấy nữa là trừ hai lần): quảng cáo G01–G03, phí sàn G04, hoa hồng TikTok G06 (như chicalc.js);
   vận chuyển đơn G05 chỉ bỏ ở TikTok, Shopee, Facebook (phí kênh đã gồm ship). Kênh phân phối, Kênh OEM chưa trừ ship nên G05, G09 vào.
   Chỉ lấy loại A/B/C (bỏ Giá vốn, Không tính, Chờ xác định) và bỏ dòng chờ duyệt. */
const DT_NKC_K={"TikTok":"tts","Shopee Mall":"spe","Shopee thường":"spe","Facebook":"fb","NPP":"b2b","Gia công":"gc","Sản xuất":"sx"};
const DT_NKC_TRU=["G01","G02","G03","G04","G06"],DT_NKC_SHIP=["tts","spe","fb"];
function dtNkcKenh(nkc,from,to,loOf){const v={tts:0,spe:0,fb:0,b2b:0,gc:0,sx:0},n={tts:0,spe:0,fb:0,b2b:0,gc:0,sx:0},gd={};
  (nkc||[]).forEach(x=>{const d=String(x.d||"").slice(0,10),ch=DT_NKC_K[x.k];
    if(!ch||d<from||d>to||x.st==="Chờ duyệt"||DT_NKC_TRU.includes(x.g)||(x.g==="G05"&&DT_NKC_SHIP.includes(ch)))return;
    if(!/^[ABC] - /.test(String(loOf(x.g)||"")))return;v[ch]+=+x.t||0;n[ch]++;const G=gd[ch]||(gd[ch]={});G[x.g]=(G[x.g]||0)+(+x.t||0)});
  return {v,n,gd}}
