/* Biểu đồ đơn giản dùng chung cho các trang quản trị mới (thanh ngang, cột đứng). Chỉ dùng HTML + CSS, không cần thư viện. */
/* rows: [{l: nhãn, v: số, t: chữ hiện bên phải (tùy chọn), c: màu "g|y|r|b|x" (tùy chọn), s: chữ nhỏ dưới nhãn (tùy chọn)}] */
function qtBars(rows,o){
  o=o||{};const mx=Math.max(...rows.map(r=>Math.abs(+r.v||0)),o.max||0,1);
  if(!rows.length)return `<p class="hint">Chưa có số liệu.</p>`;
  return `<div class="qb">${rows.map(r=>`<div class="qbr"><span class="qbl">${esc(r.l)}${r.s?`<small>${esc(r.s)}</small>`:""}</span><span class="qbt"><i class="qc-${r.c||"b"}" style="width:${r.p!=null?Math.min(100,Math.max(0,r.p)):(+r.v||0)>0?Math.max(2,Math.round(Math.abs(r.v)/mx*100)):0}%"></i></span><b class="qbv">${r.t!=null?esc(String(r.t)):nf(Math.round(+r.v||0))}</b></div>`).join("")}</div>`}
/* cột đứng: rows [{l, v, t, c}] */
function qtCols(rows,o){
  o=o||{};const mx=Math.max(...rows.map(r=>Math.abs(+r.v||0)),1);
  return `<div class="qcol">${rows.map(r=>`<div class="qcc"><b class="qcv">${r.t!=null?esc(String(r.t)):(+r.v?nf(Math.round(+r.v)):"—")}</b><span class="qct"><i class="qc-${r.c||"b"}" style="height:${(+r.v||0)>0?Math.max(3,Math.round(Math.abs(r.v)/mx*100)):0}%"></i></span><span class="qcl">${esc(r.l)}${r.s?`<small>${esc(r.s)}</small>`:""}</span></div>`).join("")}</div>`}
