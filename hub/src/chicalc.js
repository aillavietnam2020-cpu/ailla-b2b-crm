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
/* =====================================================================
   QUY TẮC PHÂN BỔ CHI CHUNG (chị Huệ đặt ở Sổ chi phí › Quy tắc phân bổ, lưu fin.pbqt; tháng đã chốt dùng bản chốt fin.pbchot[tháng]).
   Mỗi quy tắc: {g: mã nhóm hoặc "*" (mặc định), cach: "giu" để ở chi chung | "dt" theo doanh thu thực các kênh ks | "tl" tỷ lệ tay tl{kênh:%}}.
   Kiểm soát (Kế toán trưởng 27/10): tổng sau chia = tổng trước chia; khoản chưa "Ổn" (cần rà, chờ duyệt) không đem chia;
   tỷ lệ cộng quá 100% thì không chia; tỷ lệ dưới 100% thì phần còn lại để ở chi chung; thiếu doanh thu kênh nào thì không chia theo doanh thu.
   ===================================================================== */
const SC_KCOT=["TikTok","Shopee Mall","Shopee thường","Facebook","NPP","Gia công","Sản xuất","Chung","Chờ xác định","Không tính"];
const SC_KMAP=[[/tiktok/i,"TikTok"],[/aillavn1|shopee th/i,"Shopee thường"],[/shopee|aillavn/i,"Shopee Mall"],[/facebook|pancake/i,"Facebook"],[/b2b|đại lý|npp|phân phối/i,"NPP"],[/gia công|oem/i,"Gia công"]];
/* Tên kênh ở bảng lương / Kênh bán & phí ("TikTok Shop", "Facebook / Pancake"…) → cột kênh của Sổ chi phí; không nhận ra thì "". */
function scKenhChuan(k){const s=String(k||"");if(SC_KCOT.includes(s))return s;const m=SC_KMAP.find(x=>x[0].test(s));return m?m[1]:""}
function scChiaChung(rows,rules,DT){
  const out={kenh:{},con:[],truoc:0,sau:0,loi:[]},R=(rules||[]).filter(z=>z&&z.on!==false),dt=DT||{};
  const add=(k,g,v)=>{if(!v)return;const o=out.kenh[k]||(out.kenh[k]={});o[g]=(o[g]||0)+v};
  const by={};(rows||[]).forEach(x=>{const t=+x.t||0;out.truoc+=t;if(x.st&&x.st!=="Ổn"){out.con.push({g:x.g,t,why:"chưa đủ căn cứ ("+x.st+")"});return}by[x.g]=(by[x.g]||0)+t});
  Object.keys(by).sort().forEach(g=>{const t=by[g],r=R.find(z=>z.g===g)||R.find(z=>z.g==="*");
    if(!r||!r.cach||r.cach==="giu"){out.con.push({g,t,why:"giữ ở chi chung"});return}
    const w={};
    if(r.cach==="tl"){const E=Object.entries(r.tl||{}).filter(e=>+e[1]>0),s=E.reduce((a,e)=>a+ +e[1],0);
      if(s>100.0001){out.loi.push(g+": tỷ lệ cộng "+s+"%, quá 100%");out.con.push({g,t,why:"tỷ lệ cộng quá 100%"});return}
      if(!E.length){out.con.push({g,t,why:"chưa đặt tỷ lệ"});return}E.forEach(([k,p])=>w[k]=+p/100)}
    else if(r.cach==="dt"){const ks=r.ks||[],miss=ks.filter(k=>dt[k]==null),s=ks.reduce((a,k)=>a+(+dt[k]||0),0);
      if(!ks.length||miss.length||!s){out.loi.push(g+": chưa có doanh thu thực "+(miss.join(", ")||"các kênh nhận"));out.con.push({g,t,why:"thiếu doanh thu "+(miss.join(", ")||"")});return}
      ks.forEach(k=>{if(+dt[k]>0)w[k]=+dt[k]/s})}
    else{out.con.push({g,t,why:"cách chia không rõ"});return}
    const ks=Object.keys(w),sw=ks.reduce((a,k)=>a+w[k],0);let used=0;
    ks.forEach(k=>{const v=Math.round(t*w[k]);add(k,g,v);used+=v});
    const du=t-used;
    if(Math.abs(sw-1)<1e-9){if(du){const big=ks.slice().sort((a,b)=>w[b]-w[a])[0];add(big,g,du)}}
    else if(du)out.con.push({g,t:du,why:"phần để lại chi chung"})});
  out.sau=Object.values(out.kenh).reduce((a,o)=>a+Object.values(o).reduce((b,v)=>b+v,0),0)+out.con.reduce((a,x)=>a+x.t,0);
  return out}
