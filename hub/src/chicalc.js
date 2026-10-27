/* =====================================================================
   CHI PHÍ CHUNG CHO P&L CÔNG TY từ Sổ chi phí (fin.nkc), luật thuần để test được (tests/unit/chicalc.test.ts).
   Lấy: dòng của tháng, bổ vào "Chung", nhóm loại B (phòng ban) hoặc C (chi chung).
   Không lấy (P&L đã trừ ở lãi đóng góp từng kênh, lấy nữa là trừ hai lần): quảng cáo G01–G03, phí sàn G04,
   vận chuyển đơn G05, hoa hồng TikTok G06, cước xe NPP G09; dòng tự động ở Nhật ký chi (quảng cáo, lương nháp, vận chuyển) không nằm trong fin.nkc.
   Lương ghi thật trong sổ (G07, bổ "Chung") thì lấy: P&L không trừ lương ở chỗ nào khác.
   ===================================================================== */
const SC_PL_TRU=["G01","G02","G03","G04","G05","G06","G09"];
function scChungNkc(nkc,ym,loOf){
  return (nkc||[]).filter(x=>String(x.d||"").slice(0,7)===ym&&x.k==="Chung"&&!SC_PL_TRU.includes(x.g)&&/^[BC] - /.test(String(loOf(x.g)||""))&&x.st!=="Chờ duyệt")
    .reduce((t,x)=>t+(+x.t||0),0)}
