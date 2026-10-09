/* =====================================================================
   KHO VẬT TƯ (phần 3): trang "Kiểm kê đóng gói" = lô & tem (kế toán kho đếm, phân bổ thùng, in tem)
   + các phiếu kiểm kê đã ghi vào kho. Nạp SAU sanxuat.js, kho.js, kho2.js.
   ===================================================================== */
const khoLoOrig=PAGES.sx_lo;
PAGES.sx_lo=m=>{
  khoLoOrig(m);khoLoad();
  // Hàng trên: tô sáng "Kho vật tư"; hàng phụ của kho nằm ngay dưới
  const top=m.querySelector(":scope > nav.sxtabs");
  if(top){
    const b=top.querySelector('[data-sxt="kho_ton"]');if(b)b.classList.add("on");
    const sub=document.createElement("nav");sub.className="settabs";
    sub.innerHTML=KHO_SUB.map(([k,t])=>`<button class="${k===PAGE?"on":""}" data-ksub="${k}">${t}</button>`).join("");
    top.after(sub);
    sub.querySelectorAll("[data-ksub]").forEach(x=>x.onclick=()=>{PAGE=x.dataset.ksub;renderMain();scrollTo(0,0)});
  }
  const L=KHO.list.KS||(KHO.list.KS={rows:null,busy:false});
  if(!L.rows&&!L.busy)khoLoadList("KS");
  const rows=L.rows,can_=kCan("KS");
  const card=document.createElement("section");card.className="card flush";
  card.innerHTML=`<div class="card-h pad"><h2>Phiếu kiểm kê đã ghi vào kho</h2><span class="hint">Lô kiểm kê xong tự sinh phiếu ở đây (trừ bán thành phẩm, vỏ, tem theo định mức). Bấm số phiếu để xem, in hoặc hủy.</span>${can_?`<button class="btn" id="ks-new">+ Lập phiếu kiểm kê thủ công</button>`:""}</div>`+
    (rows?khoRows(["Số phiếu","Ngày","Lô / phiếu sản xuất","Số dòng","Người lập","Trạng thái"],rows.map(r=>`<tr class="clk" data-doc="${r.id}"><td><b>${esc(r.no)}</b></td><td>${kDd(r.doc_date)}</td><td>${esc(r.ref_no||"")}</td><td class="n">${r.n_lines}</td><td>${esc(r.created_by_name||"—")}</td><td>${r.status==="OK"?pill("Hiệu lực","grn"):pill("Đã hủy","gry")}</td></tr>`)):`<p class="hint pad">Đang tải…</p>`);
  m.appendChild(card);
  card.querySelectorAll("[data-doc]").forEach(r=>r.onclick=()=>khoOpenDoc(+r.dataset.doc));
  if($("#ks-new"))$("#ks-new").onclick=()=>khoForm("KS");
};
PAGES.kho_ks=PAGES.sx_lo;
