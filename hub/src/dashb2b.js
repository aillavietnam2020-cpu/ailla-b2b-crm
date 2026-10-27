/* =====================================================================
   DASHBOARD B2B VÀ GIA CÔNG (trang quản trị): thêm vào hai trang lãi lỗ sẵn có (b2bpl.js) một khối
   cảnh báo + đề xuất, biểu đồ doanh thu và biên gộp theo nhóm sản phẩm, doanh thu theo tháng.
   Cảnh báo và đề xuất tính bằng quy tắc từ số thật (không đoán): thiếu giá vốn, nhóm biên gộp dưới mức tối thiểu
   (ngưỡng ở Cấu hình › Ngưỡng cảnh báo), lãi ròng âm, chưa nhập chi phí, khách nợ quá 90 ngày.
   ===================================================================== */
function dbbBlock(ch){
  const S=b2bChannel(ch);if(!S||!S.has)return "";
  const nm=B2B_CH[ch],ng=(typeof dhGet==="function"&&D().fin)?dhGet().nguong:{bienTier:.25,bienGC:.15};
  const minB=ch==="GIA_CONG"?ng.bienGC:ng.bienTier;
  const A=[],X=[];
  const grp=[...S.grp.values()].map(g=>{const ec=g.cov?g.cost+(g.rev-g.cov)*(g.cost/g.cov):0;return {...g,lg:g.cov?g.rev-ec:null,bien:g.cov&&g.rev?(g.rev-ec)/g.rev:null}}).sort((a,b)=>b.rev-a.rev);
  /* cảnh báo */
  if(S.lai<0)A.push(["red","Lãi ròng "+nm+" đang âm "+tr(S.lai),"Xem lại giá bán và chi phí phân bổ ở bảng lãi lỗ bên dưới."]);
  const low=grp.filter(g=>g.bien!=null&&g.bien<minB);
  if(low.length)A.push([low.some(g=>g.bien<0)?"red":"amb",low.length+" nhóm sản phẩm biên gộp dưới mức tối thiểu "+Math.round(minB*100)+"%",low.slice(0,4).map(g=>g.n+" "+Math.round(g.bien*100)+"%").join(", ")]);
  if(S.cover<.8&&S.uncovRev>0)A.push(["amb","Mới có giá vốn cho "+Math.round(S.cover*100)+"% doanh thu","Phần còn lại đang ước tính theo tỷ lệ phần đã có, nên lãi chưa chính xác."]);
  if(!S.cpRows.length)A.push(["blu","Chưa có chi phí phân bổ cho "+nm+" trong kỳ","Lãi ròng chưa trừ chi phí chung. Ghi chi phí ở Chi phí & Tiền › Sổ chi phí."]);
  if(ch==="B2B"&&typeof PT!=="undefined"&&PT.d&&PT.d.rows){const late=PT.d.rows.filter(r=>r.b90p+r.old>0);if(late.length)A.push(["red",late.length+" khách Kênh phân phối nợ quá 90 ngày, tổng "+nf(Math.round(late.reduce((t,r)=>t+r.b90p+r.old,0)))+" đ","Mở Chi phí & Tiền › Phải thu & tuổi nợ để xem từng khách."])}
  /* đề xuất */
  const best=grp.filter(g=>g.bien!=null&&g.rev>0).sort((a,b)=>b.bien-a.bien)[0],big=grp[0];
  if(big&&S.revLines&&big.rev/S.revLines>.5)X.push("Nhóm “"+big.n+"” chiếm "+Math.round(big.rev/S.revLines*100)+"% doanh thu "+nm+": phụ thuộc nhiều vào một nhóm, nên đẩy thêm nhóm khác.");
  if(best&&best.n!==(big&&big.n)&&best.bien>.4)X.push("Nhóm “"+best.n+"” có biên gộp cao nhất ("+Math.round(best.bien*100)+"%) nhưng chưa phải nhóm bán nhiều nhất: nên ưu tiên chào nhóm này.");
  if(low.length)X.push("Với nhóm biên thấp ("+low.slice(0,3).map(g=>g.n).join(", ")+"): xem lại bảng giá, giảm chiết khấu hoặc kiểm tra lại giá vốn.");
  const top=[...S.miss.values()].sort((a,b)=>b.rev-a.rev).slice(0,3);
  if(top.length)X.push("Nhập giá vốn cho "+top.map(x=>x.sku).join(", ")+" trước, đây là các mã thiếu giá vốn có doanh thu lớn nhất.");
  const mrow=[...S.byMonth.values()].sort((a,b)=>a.m.localeCompare(b.m));
  const ico2={red:"🔴",amb:"🟡",blu:"🔵"};
  return `<div class="qtwo dbb"><section class="card pad"><b>Cảnh báo</b>${A.length?`<div class="dbl">${A.map(a=>`<div class="dbi ${a[0]}"><b>${esc(a[1])}</b><small>${esc(a[2])}</small></div>`).join("")}</div>`:`<p class="hint">Không có cảnh báo nào trong kỳ.</p>`}</section>
  <section class="card pad"><b>Đề xuất</b>${X.length?`<ul class="dbx">${X.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:`<p class="hint">Chưa đủ số liệu để đề xuất.</p>`}</section></div>
  <div class="qtwo dbb"><section class="card pad"><b>Doanh thu theo nhóm sản phẩm</b>${qtBars(grp.slice(0,8).map(g=>({l:g.n,v:g.rev,t:tr(g.rev)+" · "+Math.round(g.rev/S.revLines*100)+"%"})))}</section>
  <section class="card pad"><b>Biên gộp theo nhóm sản phẩm</b>${qtBars(grp.filter(g=>g.bien!=null).slice(0,8).map(g=>({l:g.n,v:Math.max(0,g.bien*100),p:Math.max(0,g.bien*100)*2,t:Math.round(g.bien*100)+"%",c:g.bien<0?"r":g.bien<minB?"y":"g"})))}<p class="hint">Vạch đỏ: lỗ · vàng: dưới mức tối thiểu ${Math.round(minB*100)}% · xanh: đạt.</p></section></div>
  ${mrow.length>1?`<section class="card pad"><b>Doanh thu theo tháng</b>${qtCols(mrow.map(r=>({l:r.m,v:r.rev,t:tr(r.rev),c:"b"})))}</section>`:""}`;
}
[["bc_b2b","B2B"],["bc_gc","GIA_CONG"]].forEach(([pg,ch])=>{
  const _p=PAGES[pg];
  PAGES[pg]=function(m){_p.apply(this,arguments);
    if(typeof HOST_MODE==="undefined"||HOST_MODE!=="admin")return;
    try{if(ch==="B2B"&&typeof ptLoad==="function")ptLoad();
      const k=m.querySelector(".grid.kpis");if(k)k.insertAdjacentHTML("afterend",dbbBlock(ch))}catch(e){}}});
