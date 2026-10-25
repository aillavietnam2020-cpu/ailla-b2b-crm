/* =====================================================================
   NGƯỠNG CẢNH BÁO + TỪ ĐIỂN CHỈ SỐ (trang quản trị › Cấu hình).
   1) Ngưỡng cảnh báo: sửa MỘT chỗ, các trang dùng chung (cùng nguồn với Tổng quan › Thiết lập: D().fin.dh.nguong).
   2) Từ điển chỉ số: mỗi chỉ số một dòng, nói bằng lời thường: là gì, tính thế nào, lấy từ đâu, ai cập nhật, ngưỡng nào thì báo.
   Chị Hoa, chị Thảo, chị Huệ sửa ngưỡng thẳng.
   ===================================================================== */
const NG={q:""};
const NG_DICT=[
 ["Doanh thu","Doanh thu thực","Tiền bán hàng thật sự thu được: đã trừ đơn hủy, đơn hoàn, khuyến mại. Không tính GMV hay doanh thu chốt đơn chưa giao.","Từ báo cáo từng kênh đã nạp (TikTok, Shopee, Facebook giao thành công, B2B đã xác nhận, gia công)","Kế toán nạp báo cáo kênh","—"],
 ["Doanh thu","Tiến độ kế hoạch doanh thu","Doanh thu thực từ đầu tháng so với kế hoạch tháng đã đặt cho từng kênh.","Kế hoạch ở Doanh thu & KPI › Kế hoạch doanh thu","Chị Hoa đặt kế hoạch","—"],
 ["Lợi nhuận","Lãi đóng góp kênh","Doanh thu thực trừ giá vốn, phí sàn, ship, thuế và quảng cáo của riêng kênh đó. Dùng để so các kênh với nhau.","Lãi lỗ & Giá thành › So sánh kênh","Tự tính","Biên đóng góp kênh mục tiêu (bên dưới)"],
 ["Lợi nhuận","Lãi lỗ công ty (P&L)","Lãi đóng góp các kênh trừ chi phí chung (lương, thuê, kho vận, agency…).","Lãi lỗ & Giá thành › P&L công ty","Tự tính; chi phí chung từ Sổ chi phí","—"],
 ["Lợi nhuận","Giá vốn","Tiền nguyên vật liệu, vỏ, tem tính cho một sản phẩm theo định mức và giá nguyên liệu đang dùng.","Định mức & giá thành, giá nguyên vật liệu theo tháng","Kỹ thuật và kế toán","Nguyên liệu tăng từ …% thì báo"],
 ["Chi phí","Quảng cáo trên doanh thu","Tiền quảng cáo chia cho doanh thu thực của cùng kỳ (cùng kênh).","Báo cáo Ads Facebook, TikTok đã nạp","Digital","Trên 38% thì báo đỏ (đổi ở bên dưới)"],
 ["Chi phí","Sổ chi phí","Mọi khoản tiền công ty chi ra, một chỗ: nhập tay, phiếu chi nhà cung cấp, vận chuyển, quảng cáo tự cộng.","Chi phí & Tiền › Sổ chi phí","Chị Hoa, Thảo, Huệ ghi","—"],
 ["Chi phí","Ngân sách đã dùng","Số đã chi chia cho ngân sách đặt của nhóm chi phí × phòng ban trong tháng.","Chi phí & Tiền › Ngân sách","Chị Hoa, Thảo, Huệ đặt","Từ 85% báo vàng, quá 100% báo đỏ"],
 ["Tiền & công nợ","Tiền đang có","Số dư các tài khoản ngân hàng, tiền mặt và ví sàn chưa rút, theo lần cập nhật gần nhất.","Chi phí & Tiền › Tiền & lịch chi","Kế toán cập nhật mỗi thứ Hai","Quá 7 ngày chưa cập nhật thì nhắc"],
 ["Tiền & công nợ","Số ngày dự trữ tiền mặt","Tiền đang có chia cho mức chi trung bình mỗi ngày: tiền đủ chi tiêu bao nhiêu ngày nếu không thu thêm.","Tiền & lịch chi, Tổng quan › Tiền & cảnh báo","Tự tính","Dưới … ngày thì báo (đổi ở bên dưới)"],
 ["Tiền & công nợ","Phải thu khách (NPP)","Tiền khách B2B còn nợ, theo công nợ chính thức đã kế toán xác nhận.","Chi phí & Tiền › Phải thu & tuổi nợ","Kế toán xác nhận thu tiền","Nợ quá 90 ngày"],
 ["Tiền & công nợ","Tuổi nợ","Khoản nợ đã nằm bao lâu, tính từ ngày đơn. Tiền khách trả trừ vào đơn cũ nhất trước. Nợ đầu kỳ là nợ thật nạp từ lúc bắt đầu dùng web.","Phải thu & tuổi nợ","Tự tính","Trên 90 ngày báo đỏ"],
 ["Tiền & công nợ","DSO (số ngày thu tiền)","Tổng nợ khách chia cho doanh thu B2B 90 ngày gần nhất, nhân 90. Càng thấp càng nhanh thu tiền.","Phải thu & tuổi nợ","Tự tính","—"],
 ["Tiền & công nợ","Phải trả nhà cung cấp","Tiền còn nợ nhà cung cấp, xếp theo hạn: chuyển khoản trước, sau nhận hàng, hoặc công nợ N ngày.","Mua hàng, Tiền & lịch chi","Chị Thảo lập đơn mua","Quá hạn thì báo đỏ ở hộp Việc chờ tôi"],
 ["Chuỗi cung ứng","Tồn kho tối thiểu","Mức nguyên vật liệu, vỏ, tem thấp nhất cho phép trước khi phải mua thêm.","Tồn kho & giá trị","Kho đặt cho từng mã","Dưới mức tối thiểu thì báo cần mua"],
 ["Chuỗi cung ứng","Chênh lệch định mức","Nguyên liệu thực xuất so với định mức của lô sản xuất.","Lãi lỗ & Giá thành › Chênh lệch định mức","Kỹ thuật báo thực xuất","Lệch quá mức cho phép thì báo"],
 ["Chuỗi cung ứng","Giá nguyên vật liệu","Giá mua nguyên liệu theo tháng, lấy từ chứng từ nhà cung cấp.","Mua hàng › Giá nguyên vật liệu theo tháng","Chị Thảo ghi chứng từ","Tăng từ …% so với tháng trước thì báo"],
 ["Con người & tiến độ","Việc chờ tôi","Những việc đang chờ chị Hoa, Thảo, Huệ xử lý: chuyển khoản trước, trả nợ, ghi chứng từ, nhập giá, mua nguyên liệu.","Tổng quan","Tự gom","—"],
];
const ngCfg=()=>typeof dhCfg==="function"?dhCfg((D().fin||{}).dh):null;
function pNguong(m){
  const T="Ngưỡng cảnh báo & từ điển chỉ số",S="Mức nào thì hệ thống báo, và mỗi chỉ số trên web nghĩa là gì";
  const c=ngCfg(),ed=mhManage(),SL=typeof vcSla==="function"?vcSla():{ct:3,gia:2,tr:2,sau:3,leo:2};
  const q=kfold(NG.q||"").trim(),L=NG_DICT.filter(r=>!q||kfold(r.join(" ")).includes(q));
  const nhoms=[...new Set(L.map(r=>r[0]))];
  const f=(id,t,v,h,st)=>`<label class="field">${t}<input type="number" step="${st||1}" min="0" id="${id}" value="${v}" ${ed?"":"disabled"}><small class="hint">${h}</small></label>`;
  m.innerHTML=H(T,S)+(c&&ed?`<div class="card pad"><div class="tlh"><b>Ngưỡng cảnh báo</b></div>
   <form class="frm" id="ng-f"><div class="row4">${f("ng-qc","Quảng cáo tối đa trên doanh thu thực (%)",+(c.nguong.qcMax*100).toFixed(1),"Vượt mức này thì báo đỏ, mặc định 38%","0.1")}${f("ng-rw","Số ngày dự trữ tiền mặt tối thiểu",c.nguong.runway,"Dưới số ngày này thì báo đỏ")}${f("ng-nv","Giá nguyên liệu tăng từ (%)",+(c.nguong.nvlTang*100).toFixed(1),"Tăng bằng hoặc hơn mức này so với tháng trước thì báo","0.1")}</div>
   <div class="row4">${f("ng-bt","Biên tối thiểu bảng giá cấp (%)",+(c.nguong.bienTier*100).toFixed(1),"Giá bán thấp hơn mức này thì báo","0.1")}${f("ng-bg","Biên tối thiểu báo giá gia công (%)",+(c.nguong.bienGC*100).toFixed(1),"Báo giá gia công thấp hơn thì báo","0.1")}${f("ng-bk","Biên đóng góp kênh mục tiêu (%)",+(c.nguong.bienKenh*100).toFixed(1),"Kênh thấp hơn mức này thì báo","0.1")}</div>
   <button class="btn pri">Lưu ngưỡng</button></form><p class="hint">Cùng nguồn với Tổng quan › Thiết lập: sửa ở đâu cũng được, hai nơi luôn giống nhau. Ngân sách báo vàng từ 85% và đỏ từ 100% là cố định.</p></div>
   <div class="card pad"><div class="tlh"><b>Hạn xử lý việc chờ</b></div>
   <form class="frm" id="ng-sla"><div class="row4">${f("sl-ct","Ghi chứng từ nhà cung cấp: trong (ngày)",SL.ct,"Tính từ ngày hàng nhập kho")}${f("sl-gia","Nhập giá cho phiếu mua: trong (ngày)",SL.gia,"Tính từ ngày hàng nhập kho")}${f("sl-tr","Chuyển khoản trước: trong (ngày)",SL.tr,"Tính từ ngày lập phiếu mua")}</div>
   <div class="row4">${f("sl-sau","Trả nhà cung cấp sau khi nhận hàng: trong (ngày)",SL.sau,"Tính từ ngày hàng nhập kho")}${f("sl-leo","Quá hạn bao nhiêu ngày thì ghi “Cần chị Hoa quyết”",SL.leo,"Hộp Việc chờ tôi đẩy việc đó lên đầu")}</div>
   <button class="btn pri">Lưu hạn xử lý</button></form><p class="hint">Chưa tự gửi tin nhắn cho ai: quá hạn chỉ hiện đỏ trong hộp Việc chờ tôi ở Tổng quan.</p></div>`
   :`<div class="note">${ed?"Chưa tải được thiết lập ngưỡng.":"Chỉ chị Hoa, chị Thảo, chị Huệ đổi được ngưỡng."}</div>`)+
  `<div class="card pad"><div class="tlh"><b>Từ điển chỉ số</b><input id="ng-q" class="mhq" placeholder="Tìm chỉ số…" value="${esc(NG.q||"")}"></div>
   ${nhoms.length?nhoms.map(n=>`<h3 class="ngh">${esc(n)}</h3><div class="nsw"><table class="tbl ngt"><thead><tr><th>Chỉ số</th><th>Nghĩa là gì, tính thế nào</th><th>Xem ở đâu</th><th>Ai cập nhật</th><th>Khi nào báo</th></tr></thead><tbody>${L.filter(r=>r[0]===n).map(r=>`<tr><td><b>${esc(r[1])}</b></td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td><td>${esc(r[5])}</td></tr>`).join("")}</tbody></table></div>`).join(""):`<p class="empty">Không có chỉ số nào khớp.</p>`}</div>`;
  const qi=m.querySelector("#ng-q");qi.oninput=()=>{NG.q=qi.value;const p=qi.selectionStart;renderMain();const n=document.querySelector("#ng-q");if(n){n.focus();n.setSelectionRange(p,p)}};
  const fs=m.querySelector("#ng-sla");
  if(fs)fs.onsubmit=e=>{e.preventDefault();const g=id=>Math.max(0,Math.round(+m.querySelector(id).value||0));
    DB.mutate(ME.name,"sửa hạn xử lý việc chờ",dt=>{dt.fin=dt.fin||{};dt.fin.sla={ct:g("#sl-ct"),gia:g("#sl-gia"),tr:g("#sl-tr"),sau:g("#sl-sau"),leo:g("#sl-leo")}});
    toast("Đã lưu hạn xử lý");renderMain()};
  const fm=m.querySelector("#ng-f");
  if(fm)fm.onsubmit=e=>{e.preventDefault();const g=id=>+m.querySelector(id).value;
    DB.mutate(ME.name,"sửa ngưỡng cảnh báo",dt=>{dt.fin=dt.fin||{};const cc=dhCfg(dt.fin.dh);
      cc.nguong={...cc.nguong,qcMax:(g("#ng-qc")||38)/100,runway:g("#ng-rw")||30,nvlTang:g("#ng-nv")/100,bienTier:g("#ng-bt")/100,bienGC:g("#ng-bg")/100,bienKenh:g("#ng-bk")/100};dt.fin.dh=cc});
    toast("Đã lưu ngưỡng cảnh báo");renderMain()}}
PAGES.nguong=pNguong;
