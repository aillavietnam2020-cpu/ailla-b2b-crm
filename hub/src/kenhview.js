/* =====================================================================
   TỔNG QUAN › LÃI THEO KÊNH: trình bày lại cho dễ đọc (theo cách báo cáo lãi lỗ theo bộ phận / kênh vẫn làm):
   1) hàng số lớn: doanh thu thực, lãi đóng góp và biên, chi phí trực tiếp, quảng cáo trên doanh thu;
   2) hai biểu đồ thanh: doanh thu theo kênh (tỷ trọng) và lãi đóng góp theo kênh (màu theo biên so với ngưỡng);
   3) bảng gọn: mỗi kênh một dòng, chỉ số và tối đa hai nhãn cảnh báo ngắn; ghi chú nguồn số gom xuống mục "Nguồn số từng kênh".
   Số liệu vẫn lấy từ tqKenhRows() / tqTot() của tqgop.js, không đổi cách tính.
   ===================================================================== */
tqTabKenh=function(){
  const rows=tqKenhRows(),T=tqTot(rows),ng=dhGet().nguong,has=rows.filter(r=>r.dt>0);
  const pc=(a,b)=>b?dhPct(a/b):"—";
  const bien=r=>r.dt&&r.lai!=null?r.lai/r.dt:null;
  const adsAll=rows.reduce((a,r)=>a+(+r.ads||0),0),cpAll=T.cp,retail=rows.filter(r=>r.mang==="Bán lẻ"&&r.dt>0).reduce((a,r)=>a+r.dt,0);
  const kpis=`<div class="grid kpis">${kpi("Doanh thu thực",T.dt?tr(T.dt):"—",nf(T.don)+" đơn · "+has.length+" kênh có số"+(T.tam?" · có phần tạm tính":""))}${kpi("Lãi đóng góp",tr(T.lai),T.dt?pc(T.lai,T.dt)+" doanh thu · chưa trừ lương, chi phí chung":"",T.lai<0?"var(--red)":"var(--green)")}${kpi("Chi phí trực tiếp",tr(cpAll),T.dt?pc(cpAll,T.dt)+" doanh thu (giá vốn, phí sàn, quảng cáo)":"")}${kpi("Quảng cáo / doanh thu bán lẻ",retail?pc(adsAll,retail):"—",tr(adsAll)+" trên "+tr(retail)+" · ngưỡng báo "+dhPct(ng.qcMax),retail&&adsAll/retail>ng.qcMax?"var(--red)":"")}</div>`;
  const chRev=qtBars(has.slice().sort((a,b)=>b.dt-a.dt).map(r=>({l:r.n.replace(" (NPP, đại lý)",""),v:r.dt,t:tr(r.dt)+" · "+pc(r.dt,T.dt),c:"b"})));
  const withLai=rows.filter(r=>r.dt>0&&r.lai!=null).sort((a,b)=>b.lai-a.lai);
  const chLai=withLai.length?qtBars(withLai.map(r=>{const b=bien(r);return {l:r.n.replace(" (NPP, đại lý)",""),v:Math.max(0,r.lai),t:tr(r.lai)+" · biên "+dhPct(b),c:b<0?"r":b<ng.bienKenh?"y":"g"}}))+`<p class="hint">Xanh: biên đạt mục tiêu ${dhPct(ng.bienKenh)} · vàng: dưới mục tiêu · đỏ: lỗ.</p>`:`<p class="hint">Chưa có kênh nào tính được lãi.</p>`;
  const chips=r=>{const w=[];
    if(r.dt&&r.ads/r.dt>ng.qcMax)w.push(pill("QC "+dhPct(r.ads/r.dt)+" doanh thu","red"));
    if(r.dt&&r.lai!=null&&r.lai/r.dt<ng.bienKenh&&!(r.ads/r.dt>ng.qcMax))w.push(pill("biên thấp","amb"));
    if(r.tam)w.push(pill("tạm tính","blu"));
    if(r.dt==null)w.push(pill("chờ báo cáo","gry"));
    return w.length?`<div class="kvchips">${w.join(" ")}</div>`:""};
  const row=r=>{const b=bien(r);return `<tr class="clk" data-go="${r.go}"><td class="kvn"><b>${r.n.replace(" (NPP, đại lý)","")}</b>${chips(r)}</td><td class="n">${r.dt==null?"—":r.dt===0?"0":tr(r.dt)}</td><td class="n">${r.don?nf(r.don):"—"}</td><td class="n">${r.gv?tr(r.gv):"—"}</td><td class="n">${r.phi?tr(r.phi):"—"}</td><td class="n">${r.ads?tr(r.ads):"—"}</td><td class="n"><b class="${r.lai<0?"t-red":""}">${r.lai==null?"—":tr(r.lai)}</b></td><td class="n kvb ${b==null?"":b<0?"kr":b<ng.bienKenh?"ka":"kg"}">${b==null?"—":dhPct(b)}</td></tr>`};
  const sub=m=>{const R=rows.filter(r=>r.mang===m),t=tqTot(R);return `<tr class="tot"><td>Cộng ${m.toLowerCase()}</td><td class="n">${tr(t.dt)}</td><td class="n">${t.don?nf(t.don):"—"}</td><td></td><td></td><td></td><td class="n">${tr(t.lai)}</td><td class="n">${t.dt?dhPct(t.lai/t.dt):"—"}</td></tr>`};
  const notes=rows.map(r=>`<li><b>${esc(r.n)}:</b> ${esc(r.src||"")}${r.dang?` · đang giao, chưa tính: ${nf(r.dang)} đơn (${tr(r.dangDt)})`:""}</li>`).join("");
  return kpis+`<div class="qtwo"><section class="card pad"><b>Doanh thu theo kênh</b>${chRev}</section><section class="card pad"><b>Lãi đóng góp theo kênh</b>${chLai}</section></div>
   <section class="card flush"><div class="card-h pad"><h2>Bảng theo kênh</h2><span class="hint">${esc(pLabel())} · bấm một dòng để xem chi tiết kênh</span></div>
   <div class="tbl"><table class="kvt"><thead><tr><th>Kênh</th><th class="n">Doanh thu thực</th><th class="n">Đơn</th><th class="n">Giá vốn</th><th class="n">Phí sàn, ship, thuế</th><th class="n">Quảng cáo</th><th class="n">Lãi đóng góp</th><th class="n">Biên</th></tr></thead><tbody>
   ${rows.filter(r=>r.mang==="Bán lẻ").map(row).join("")}${sub("Bán lẻ")}${rows.filter(r=>r.mang!=="Bán lẻ").map(row).join("")}
   <tr class="tot"><td><b>Tổng công ty</b>${T.thieu.length?`<div class="kvchips">${pill("chờ báo cáo: "+T.thieu.join(", "),"gry")}</div>`:""}</td><td class="n"><b>${tr(T.dt)}</b></td><td class="n">${nf(T.don)}</td><td></td><td></td><td></td><td class="n"><b>${tr(T.lai)}</b></td><td class="n">${T.dt?dhPct(T.lai/T.dt):"—"}</td></tr></tbody></table></div>
   <details class="kvsrc"><summary>Nguồn số từng kênh và cách tính</summary><ul>${notes}</ul><p class="hint">Doanh thu thực: TikTok là doanh thu thuần theo quyết toán (tháng chưa chốt thì tạm tính từ đơn xuất kho, không dùng GMV); Facebook là đơn giao thành công (đơn đang giao chưa tính); Shopee theo báo cáo đã tải; Kênh phân phối, Kênh OEM là đơn đã duyệt. Lãi đóng góp = doanh thu thực trừ giá vốn, phí sàn, ship, thuế và quảng cáo của riêng kênh; chưa trừ lương và chi phí chung.</p></details></section>`+dhTabBaTang();
};
