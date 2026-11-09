/* =====================================================================
   DỰ TRÙ GIÁ BÁN TikTok & Facebook (Quản trị › Lãi lỗ › Dự trù giá bán): hàm thuần, không gọi máy chủ, không vẽ.
   Công thức theo Google Sheet mẫu chị Hoa đưa ("AILLA - Dự trù giá bán TikTok & Facebook", tab DU_TRU_GIA).
   Trang dutru.js tải dữ liệu rồi đưa vào đây. Test: tests/unit/dutrucalc.test.ts.
     Dòng (r): {ten, kenh:"tiktok"|"facebook", gia, gvSp, gvQua, aff, cpqc}   (gia = giá bán thực thu; aff, cpqc tính %)
     gvSp / gvQua = null nghĩa là CHƯA CÓ GIÁ VỐN → không tính lãi, không ước số.
     Giả định (A): {bienMT, tiktok:{cpvc,phiSan,voucher,thue,hhAgency,luong,agency,ql,xuLy}, facebook:{…}}  (% trừ xuLy là đồng/đơn)
   ===================================================================== */
const DZ_MAX_ROWS=30;
const DZ_KENH=[["tiktok","TikTok Shop"],["facebook","Facebook"]];
/* Các khoản tỷ lệ % theo kênh (cộng vào Tổng CP tỷ lệ). */
const DZ_PCT=[["cpvc","CP video (CPVC)"],["phiSan","Phí sàn / app"],["voucher","Voucher / Xtra"],["thue","Thuế"],["hhAgency","Hoa hồng agency"],["luong","Lương in-house"],["agency","Agency cố định"],["ql","CP quản lý"]];
/* Nguồn: bảng kế toán T7/2026. Lương TikTok = 20tr ÷ doanh thu dự kiến 800tr = 2,5%; agency cố định = 12tr ÷ 800tr = 1,5%. */
const DZ_DEF={
  bienMT:18.5,
  tiktok:{cpvc:1.1,phiSan:17,voucher:4.7,thue:1.5,hhAgency:2,luong:2.5,agency:1.5,ql:0,xuLy:3000},
  facebook:{cpvc:9.2,phiSan:0,voucher:0,thue:1.5,hhAgency:0,luong:8.1,agency:0,ql:1.3,xuLy:0}};
const dzN=v=>{const x=+v;return isFinite(x)?x:0};
const dzLow=s=>String(s||"").trim().toLowerCase();
/* Giả định đầy đủ: chỗ nào thiếu thì lấy mặc định. */
function dzAssume(A){
  const o={bienMT:A&&A.bienMT!=null&&A.bienMT!==""?dzN(A.bienMT):DZ_DEF.bienMT};
  DZ_KENH.forEach(([k])=>{o[k]=Object.assign({},DZ_DEF[k]);const s=(A&&A[k])||{};Object.keys(o[k]).forEach(f=>{if(s[f]!=null&&s[f]!==""&&isFinite(+s[f]))o[k][f]=+s[f]})});
  return o;
}
/* Tổng % cố định của kênh (chưa gồm AFF và CPQC). */
const dzFixedPct=(c)=>DZ_PCT.reduce((s,[f])=>s+dzN(c&&c[f]),0);

/* Tính một dòng. */
function dzCalc(r,A0){
  const A=dzAssume(A0),c=A[r.kenh]||A.tiktok,gia=dzN(r.gia),aff=dzN(r.aff),cpqc=dzN(r.cpqc);
  const miss=[];if(r.gvSp==null||r.gvSp==="")miss.push("sp");
  if(gia<=0)return {ok:false,why:"Nhập giá bán",miss};
  if(miss.length)return {ok:false,why:"Chưa có giá vốn",miss};
  const gvSp=dzN(r.gvSp),gvQua=r.gvQua==null||r.gvQua===""?0:dzN(r.gvQua);
  const pct=dzFixedPct(c)+aff+cpqc,pctD=pct/100*gia,xuLy=dzN(c.xuLy);
  const tong=pctD+gvSp+gvQua+xuLy,ln=gia-tong,bien=ln/gia*100;
  const hoaVon=cpqc+bien,tran=hoaVon-A.bienMT;
  const roas=x=>x>0?100/x:null;
  const tt=ln<0?"lo":bien<A.bienMT?"thap":"dat";
  return {ok:true,gia,gvSp,gvQua,xuLy,pct,pctD,tong,ln,bien,hoaVon,tran,roasHV:roas(hoaVon),roasTran:roas(tran),tt,bienMT:A.bienMT};
}
/* Mức giá / quà còn đạt biên mục tiêu (giữ nguyên các % và CPQC của dòng). */
function dzMax(r,A0){
  const A=dzAssume(A0),c=A[r.kenh]||A.tiktok,x=dzCalc(r,A0);if(!x.ok)return null;
  const den=1-(dzFixedPct(c)+dzN(r.aff)+dzN(r.cpqc))/100-A.bienMT/100,fixed=x.gvSp+x.gvQua+x.xuLy;
  if(den<=0)return {kho:true,why:"Tổng % chi phí đã quá cao: không mức giá nào đạt biên mục tiêu, cần giảm CPQC/AFF"};
  const pmin=fixed/den,giamD=Math.max(0,x.gia-pmin);
  return {kho:false,pmin,giamD,giamPct:giamD/x.gia*100,quaMax:Math.max(0,x.gia*den-fixed),daDat:x.bien>=A.bienMT};
}
/* Kiểu khuyến mại → dòng sau khuyến mại (giá thực thu mới, giá vốn quà mới). */
const DZ_PROMO=[
  ["pct","Giảm %","% giảm trên giá bán","%"],
  ["tien","Giảm tiền","Số tiền giảm mỗi đơn","đ"],
  ["voucher","Voucher shop","% voucher (tối đa …đ)","%"],
  ["qua","Mua X tặng quà","Giá vốn quà tặng thêm","đ"],
  ["flash","Flash sale","Giá flash sale (thực thu)","đ"]];
function dzPromoRow(r,p){
  const gia=dzN(r.gia),v=dzN(p.v);let gia2=gia,q2=r.gvQua==null?0:dzN(r.gvQua),giam=0;
  if(p.k==="pct")giam=gia*v/100;
  else if(p.k==="tien")giam=v;
  else if(p.k==="voucher"){giam=gia*v/100;const m=dzN(p.max);if(m>0&&giam>m)giam=m}
  else if(p.k==="qua")q2+=v;
  else if(p.k==="flash")giam=gia-v;
  giam=Math.max(0,Math.min(giam,gia));
  gia2=gia-giam;
  return Object.assign({},r,{gia:gia2,gvQua:q2,_giam:giam});
}
/* So sánh trước / sau khuyến mại: {truoc, sau, giam, dBien (điểm %), dLn, canhBao}. */
function dzPromoCmp(r,p,A){
  const truoc=dzCalc(r,A),r2=dzPromoRow(r,p),sau=dzCalc(r2,A);
  const o={truoc,sau,giam:r2._giam,r2};
  if(truoc.ok&&sau.ok){o.dBien=sau.bien-truoc.bien;o.dLn=sau.ln-truoc.ln;o.canhBao=sau.tt==="lo"?"Lỗ "+Math.round(-sau.ln).toLocaleString("vi-VN")+"đ mỗi đơn":sau.tt==="thap"?"Biên dưới mục tiêu":""}
  return o;
}
/* Giá vốn một dòng từ các món (parts: [{code, qty, kind}]) theo bảng giá g (mã chữ thường → {u}). Món chưa có giá → null + danh sách mã thiếu. */
function dzCostParts(parts,g){
  let sp=0,qua=0;const miss=[];let spBad=false,quaBad=false;
  (parts||[]).forEach(p=>{if(p.kind==="skip")return;const c=g&&g[dzLow(p.code)],q=dzN(p.qty)||1;
    if(p.kind==="gift"){if(c)qua+=c.u*q;else{quaBad=true;miss.push(p.code)}}
    else if(c)sp+=c.u*q;else if(p.kind!=="pack"){spBad=true;miss.push(p.code)}});
  return {gvSp:spBad?null:sp,gvQua:quaBad?null:qua,miss};
}
/* Màu cảnh báo cho một kết quả. */
const dzTone=x=>!x||!x.ok?"gry":x.tt==="lo"?"red":x.tt==="thap"?"amb":"grn";
const dzFmtPct=v=>v==null||!isFinite(v)?"—":((Math.round(v*10)/10)||0).toLocaleString("vi-VN")+"%";
const dzFmtRoas=v=>v==null||!isFinite(v)?"—":(Math.round(v*100)/100).toLocaleString("vi-VN");

/* Đọc bảng "BẢNG TÍNH GIÁ THÀNH" xuất từ MISA (mảng 2 chiều của dòng Excel): cột "Mã thành phẩm" … cột cuối "Giá thành đơn vị".
   Trả {ky:"2026-09"|"", rows:[{code,name,dv,sl}]}. Bỏ dòng tổng và dòng không có giá thành đơn vị. */
function dzParseGiaThanh(aoa){
  const rows=[];let ky="",hi=-1;
  (aoa||[]).forEach((r,i)=>{
    const t=String((r&&r[0])||"");const m=/tháng\s*(\d{1,2})[./-](\d{4})/i.exec(t);if(m&&!ky)ky=m[2]+"-"+m[1].padStart(2,"0");
    if(hi<0&&dzLow(t)==="mã thành phẩm")hi=i});
  if(hi<0)return {ky,rows,err:"Không thấy dòng tiêu đề “Mã thành phẩm”"};
  const h=aoa[hi],ci=h.map(x=>dzLow(x)).lastIndexOf("giá thành đơn vị");
  if(ci<0)return {ky,rows,err:"Không thấy cột “Giá thành đơn vị”"};
  aoa.slice(hi+1).forEach(r=>{const code=String(r[0]||"").trim(),v=+r[ci];
    if(!code||/^số dòng/i.test(code)||!isFinite(v)||v<=0||typeof r[ci]!=="number")return;
    rows.push({code,name:String(r[1]||"").trim(),dv:v,sl:dzN(r[ci-1])})});
  return {ky,rows};
}
/* Đưa bảng giá thành vào bảng giá vốn g (mã chữ thường → {u,src}); mã đã có giá từ nguồn khác (SKU kế toán) thì giữ nguồn đó. */
function dzMergeGiaThanh(g,file,keepKeys){
  const o=Object.assign({},g),lab="Giá thành MISA "+((file&&file.ky)||"").slice(5)+"/"+((file&&file.ky)||"").slice(0,4);
  ((file&&file.rows)||[]).forEach(x=>{const k=dzLow(x.code);if(keepKeys&&keepKeys[k])return;o[k]={u:Math.round(x.dv),src:lab}});
  return o;
}
