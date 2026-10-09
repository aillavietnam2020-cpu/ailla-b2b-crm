/* =====================================================================
   PAGE THƯƠNG HIỆU AILLA: calendar tháng + bộ quy tắc + quy trình lên nội dung
   Dữ liệu: d.pageTH = { cal:{ "2026-11":[bài…] }, rules:{ khóa: nội dung }, flow:{ "2026-11":{ steps, cond } } }
   Bài: { id, ngay:"2026-11-03", gio:"20:00", dang:TH|GD|SP|KM|SI|LE, tep:Lẻ|Sỉ|Chung, sp, chuDe, y, cta, st }
   Agent (Telegram / OpenClaw) đọc quy tắc và calendar từ đây; web là nơi duy nhất giữ dữ liệu.
   ===================================================================== */
const PTH={m:"2026-11",tab:"cal"};
const PTH_DANG=[["TH","Thương hiệu","#7c3aed"],["GD","Giáo dục / tương tác","#0891b2"],["SP","Sản phẩm","#16804f"],["KM","Khuyến mại","#e7357b"],["SI","B2B / Sỉ","#d97706"],["LE","Lễ / sự kiện","#2563eb"]];
const PTH_TARGET={TH:20,GD:20,SP:15,KM:15,SI:30,LE:0};
const PTH_TEP=["Lẻ","Sỉ","Chung"];
const PTH_ST=["Nháp","Đã duyệt tuyến","Chờ duyệt bài","Chờ đăng","Đã đăng"];
const PTH_MONTHS=["2026-10","2026-11","2026-12"];
const pthDangN=k=>(PTH_DANG.find(x=>x[0]===k)||[k,k,"#64748b"]);
const pthData=()=>D().pageTH||{};
const pthCal=m=>((pthData().cal||{})[m])||null;
function pthMut(label,fn){DB.mutate(ME.name,label,dt=>{dt.pageTH=dt.pageTH||{};dt.pageTH.cal=dt.pageTH.cal||{};dt.pageTH.rules=dt.pageTH.rules||{};dt.pageTH.flow=dt.pageTH.flow||{};fn(dt.pageTH)})}
const pthDate=(m,d)=>m+"-"+String(d).padStart(2,"0");

/* bản nháp tháng 11/2026 (em đề xuất, chưa lưu vào dữ liệu cho tới khi chị bấm "Dùng bản nháp này") */
function pthDraft(m){
  if(m!=="2026-11")return [];
  const P=(d,g,dang,tep,sp,chuDe,y,cta)=>({id:"pth-"+m+"-"+d,ngay:pthDate(m,d),gio:g,dang,tep,sp,chuDe,y,cta,st:"Nháp"});
  return [
   P(2,"20:00","TH","Chung","TH","Mở đầu tháng 11: Ailla và chữ LÀNH trong từng mẻ giặt","Giới thiệu triết lý sạch dịu, an toàn cho da tay và cho nhà có trẻ nhỏ","Theo dõi page để xem tuyến nội dung mới"),
   P(3,"09:30","SI","Sỉ","BT","Làm sao để shop online bán hàng giặt tẩy đều quanh năm","Lý do hàng gia dụng giặt tẩy bán đều, vì sao Ailla dễ bán lại; hướng tới người kinh doanh online, tổng kho","Nhắn page nhận bảng giá sỉ"),
   P(4,"20:00","GD","Lẻ","BT","Áo trắng ố vàng khi trời nồm: 3 cách xử lý","Mẹo xử lý đồ trắng ngày nồm ẩm, lồng ghép Bột tẩy vạn năng (quy cách 250g và 450g)","Xem sản phẩm ở phần giới thiệu"),
   P(5,"20:00","SP","Lẻ","TD","Tinh dầu giặt sấy: 5 mùi hương, nhỏ vào nước xả hoặc khi sấy","Giới thiệu 5 mùi hương và cách dùng cơ bản","Chọn mùi hợp gu nhà bạn"),
   P(6,"09:30","SI","Sỉ","BT","Chân dung nhà bán hàng đồng hành cùng Ailla","Kể về một đối tác bán hàng thật (cần chọn đối tác và xin phép, KHÔNG viết số liệu khi chưa có)","Nhắn page để trở thành đối tác"),
   P(7,"20:00","TH","Chung","TH","Hậu trường: một chai nước giặt Ailla được làm ra thế nào","Ảnh và video xưởng, người làm, quy trình kiểm; tạo niềm tin","Theo dõi để xem thêm hậu trường"),
   P(8,"20:00","GD","Lẻ","NG","Chủ nhật dọn nhà: checklist giặt giũ trong 15 phút","Checklist dễ lưu, lồng nước giặt vào bước giặt chính","Lưu bài để dùng cuối tuần"),
   P(9,"20:00","KM","Lẻ","BT","Đếm ngược sale đôi 11/11: gợi ý giỏ hàng nhà sạch","Teaser, gợi ý 3 sản phẩm đẩy tháng (Bột tẩy vạn năng, Nước giặt, Tinh dầu giặt sấy). CHỜ chị chốt chương trình khuyến mại","Bấm nhắc lịch sale 11/11"),
   P(10,"12:00","KM","Lẻ","TD","Mai sale đôi: 3 combo gợi ý cho nhà bạn","Gợi ý combo; ảnh bộ ba sản phẩm. CHỜ chị chốt chương trình khuyến mại","Chuẩn bị giỏ hàng từ tối nay"),
   P(11,"10:00","KM","Chung","TH","11/11 sale đôi: ưu đãi hôm nay","Bài chính ngày sale. CHỜ chị chốt chương trình khuyến mại và link mua","Mua ngay ở link bên dưới"),
   P(12,"09:30","SI","Sỉ","BT","Sale đôi cho đại lý: ưu đãi nhập sỉ","Chương trình nhập sỉ trong dịp sale. CHỜ chị chốt chiết khấu và điều kiện","Nhắn page nhận ưu đãi sỉ"),
   P(13,"20:00","GD","Lẻ","TD","Dùng tinh dầu giặt sấy đúng cách","Lượng pha 1,5 đến 4L mỗi chai; KHÔNG nhỏ vào bàn là hơi nước","Lưu lại cách dùng"),
   P(14,"20:00","TH","Chung","TH","Vì sao Ailla chọn chữ LÀNH","Câu chuyện thương hiệu: sạch mà dịu, không đánh đổi sức khỏe gia đình","Chia sẻ nếu bạn cũng chọn LÀNH"),
   P(15,"20:00","GD","Lẻ","NG","Hỏi nhanh: nhà bạn giặt tay hay giặt máy?","Bài tương tác, mời bình luận để nhận mẹo giặt phù hợp","Bình luận cách giặt của nhà bạn"),
   P(16,"09:30","SI","Sỉ","BT","Khung tính giá vốn và lợi nhuận khi bán Ailla trên TikTok Shop, Shopee","Chỉ nêu cách tính, KHÔNG nêu con số khi chưa có số liệu thật","Nhắn page nhận bảng giá và tài liệu bán hàng"),
   P(17,"20:00","SP","Lẻ","BT","Bột tẩy vạn năng: quy cách 250g và 450g","Giới thiệu hai quy cách, cách dùng cho đồ trắng và đồ màu; KHÔNG nói tẩy mọi loại vết bẩn","Chọn quy cách hợp nhà bạn"),
   P(18,"20:00","GD","Lẻ","NG","Mẹo giặt đồ mùa lạnh: đồ len, chăn gối","Mẹo giặt và phơi đồ dày ngày lạnh, ít nắng","Lưu bài cho mùa lạnh"),
   P(19,"09:30","SI","Sỉ","TH","Người chạy quảng cáo: video nào của Ailla đang ra đơn","Chia sẻ cách chọn video chạy quảng cáo, dựa trên dữ liệu thật của shop; cần lấy số từ web","Nhắn page nhận thư viện video"),
   P(20,"20:00","LE","Lẻ","BT","20/11 tri ân thầy cô: mẹo giữ áo dài, sơ mi trắng luôn sạch","Mừng ngày Nhà giáo Việt Nam, lồng mẹo giặt đồ trắng","Gửi lời chúc cho thầy cô của bạn"),
   P(21,"09:30","SI","Sỉ","TH","Hợp tác tổng kho, đại lý: quy trình đặt hàng và giao hàng","Giải thích quy trình rõ ràng, thời gian, hỗ trợ ảnh và video bán hàng","Nhắn page để được tư vấn"),
   P(23,"09:30","SI","Sỉ","TD","Chương trình đại lý và cộng tác viên cuối năm","Thông tin chương trình cuối năm. CHỜ chị chốt chương trình","Nhắn page đăng ký"),
   P(24,"20:00","GD","Lẻ","NG","3 thói quen giặt giũ giúp quần áo bền màu","Mẹo ngắn dễ nhớ, có ảnh minh họa","Lưu bài"),
   P(25,"12:00","KM","Lẻ","TD","Sắp đến sale cuối năm: ưu đãi nào đang chờ bạn","Teaser sale cuối năm và Black Friday 27/11. CHỜ chị chốt chương trình","Bấm nhắc lịch"),
   P(26,"20:00","SP","Lẻ","NG","Nước giặt Ailla: sạch mà dịu với da","Giới thiệu nước giặt; cần chọn đúng loại nước giặt sẽ đẩy tháng này","Chọn nước giặt cho gia đình bạn"),
   P(27,"10:00","KM","Chung","TH","Black Friday 27/11: ưu đãi cuối năm","Bài chính Black Friday. CHỜ chị chốt chương trình và link mua","Mua ngay ở link bên dưới"),
   P(28,"20:00","GD","Lẻ","TD","Bình chọn mùi hương tinh dầu giặt sấy bạn thích nhất","Bài tương tác, 5 mùi hương, mời bình luận","Bình luận mùi bạn chọn"),
   P(29,"09:30","SI","Sỉ","BT","Bảng giá sỉ và điều kiện hợp tác cuối năm","Tổng hợp bảng giá và điều kiện. CHỜ chị chốt","Nhắn page nhận bảng giá"),
   P(30,"20:00","TH","Chung","TH","Tổng kết tháng 11 và lời cảm ơn","Điểm lại tháng, cảm ơn khách và đối tác","Hẹn gặp lại tháng 12")
  ]
}
/* bộ quy tắc mặc định (chị sửa trực tiếp, agent đọc từ đây) */
const PTH_RULES=[
 ["dinhvi","1 · Định vị và giọng văn","Ailla: sạch mà LÀNH, thơm dịu, an toàn cho gia đình.\nGiọng gần gũi, đời thường, tử tế, không dọa khách, không hoa mỹ. Xưng \"Ailla\" hoặc \"mình\", gọi khách là \"bạn\".\nMỗi bài nói MỘT ý chính, câu ngắn."],
 ["tru","2 · Trụ cột nội dung và tỉ lệ (tháng 11)","Thương hiệu 20% · Giáo dục và tương tác 20% · Sản phẩm 15% · Khuyến mại 15% · B2B và sỉ 30% (theo mục tiêu tháng: 30% nguồn lực cho khách B2B).\nMục tiêu tháng 11: tăng nhận diện thương hiệu và tương tác.\nSản phẩm đẩy: Bột tẩy vạn năng, Nước giặt, Tinh dầu giặt sấy. Mốc: sale đôi 11/11, sale cuối năm."],
 ["khung","3 · Khung từng dạng bài","Thương hiệu: câu chuyện, hậu trường, giá trị; ảnh thật, caption 3 đến 5 câu.\nGiáo dục và tương tác: mẹo ngắn dễ lưu, có câu hỏi mời bình luận.\nSản phẩm: một lợi ích một bài, nêu cách dùng, ảnh sản phẩm thật.\nKhuyến mại: nêu rõ ưu đãi, hạn, cách mua; chỉ đăng khi chương trình đã chốt.\nB2B và sỉ: giọng chuyên nghiệp, nêu lợi ích cho người bán, điều kiện hợp tác, cách liên hệ.\nHashtag tối đa 5. Mỗi bài có một lời kêu gọi duy nhất."],
 ["cam","4 · Điều không được nói","Bột tẩy vạn năng: quy cách đúng 250g và 450g; không nói tẩy mọi loại vết bẩn hay mọi vật liệu.\nTinh dầu giặt sấy: biên pha 1,5 đến 4L mỗi chai; không nhỏ vào bàn là hơi nước.\nXịt ruồi: không nói diệt 100%. Xịt muỗi: không dùng cảnh chai xanh của xịt ruồi.\nChung: không bịa số liệu, không bịa khách hàng hay đánh giá; không so sánh nêu tên đối thủ; không hứa hiệu quả y tế."],
 ["tep","5 · Khách lẻ và khách sỉ","Khách lẻ: gia đình 25 đến 45 tuổi, mẹ có con nhỏ; nói về sạch, thơm, an toàn, tiện.\nKhách sỉ: người kinh doanh online, tổng kho, nhà bán hàng TikTok Shop và Shopee, người chạy quảng cáo. Nói về dễ bán, biên lợi nhuận, vận hành, hỗ trợ video và ảnh, điều kiện nhập sỉ.\nBài sỉ đăng giờ hành chính và luôn có cách liên hệ rõ ràng."],
 ["gio","6 · Giờ đăng và nhịp","Khoảng 28 bài mỗi tháng, tối đa 1 bài mỗi ngày.\nBài lẻ 20:00. Bài sỉ 09:30. Bài khuyến mại 10:00 hoặc 12:00 (theo giờ sale).\nNghỉ tối đa 2 Chủ nhật mỗi tháng."],
 ["media","7 · Ảnh và video","Video lấy từ Kho video, đúng sản phẩm, đã duyệt. Ảnh tạo theo bộ nhận diện Ailla (màu xanh lá, nền sạch).\nẢnh vuông hoặc 4:5; chữ trên ảnh ngắn, đọc được trên điện thoại."],
 ["cmt","8 · Bình luận sau khi đăng","Bot bình luận 1 lần ngay sau khi đăng, kèm ảnh hoặc link sản phẩm.\nTrả lời bình luận của khách trong 24 giờ."],
 ["duyet","9 · Quy trình duyệt","Chị (hoặc lead) duyệt calendar cả tháng trước. Sau đó duyệt từng bài trước giờ đăng ít nhất 24 giờ.\nBài chưa được duyệt thì không được tự đăng."],
 ["chiso","10 · Chỉ số theo dõi","Tiếp cận, tương tác, lượt bấm, bình luận, đơn từ page (nếu theo dõi được).\nNgưỡng cảnh báo: chưa đặt. Chị chốt sau khi có số của tháng đầu."]
];
const PTH_FLOW=[
 ["gom","0 · Gom đầu vào","Ngày lễ, lịch sale, số bán TikTok và Shopee, chỉ số page tháng trước, sản phẩm đẩy, mục tiêu"],
 ["nc","1 · Nghiên cứu khách và đối thủ","Chỉ chạy khi có điều kiện bên dưới. Nguồn: thư viện quảng cáo Meta, bài chị dán link, tài khoản phụ (nếu có)"],
 ["tuyen","2 · Trụ cột và tuyến nội dung","Chị duyệt lần 1"],
 ["cal","3 · Calendar cả tháng","Chị duyệt lần 2"],
 ["soan","4 · Soạn từng bài","Caption, chọn video trong kho, tạo ảnh bằng CLI, gửi duyệt"],
 ["dang","5 · Đăng đúng lịch và bình luận","Bot Telegram đăng, báo kết quả về web"],
 ["so","6 · Chỉ số sau đăng và tổng kết","Kéo chỉ số, tổng kết tháng, nuôi lần lên kế hoạch sau"]
];
const PTH_FST=["Chưa làm","Đang làm","Chờ duyệt","Xong"];
const PTH_COND=[["moi","Có sản phẩm mới ra mắt"],["tep","Đổi hoặc thêm tệp khách mục tiêu"],["tut","Chỉ số tháng trước tụt mạnh"],["yc","Chị yêu cầu nghiên cứu"]];

function pPth(m){
  const lead=ME.role==="admin"||ME.role==="lead",ed=lead||ME.role==="content";
  const tabs=[["cal","Lịch tháng"],["rules","Quy tắc"],["flow","Quy trình"]];
  m.innerHTML=`<style>.pthg{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.pthh{font-weight:700;color:#6b7280;text-align:center;font-size:13px}.pthc{min-width:0;min-height:84px;background:#fff;border:1px solid #e6e9f2;border-radius:10px;padding:6px;font-size:12px}.pthc.off{background:transparent;border:none}.pthc b{display:block;color:#6b7280;margin-bottom:3px}.pthp{display:block;color:#fff;border-radius:6px;padding:2px 6px;margin-top:3px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pthbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0}.pthi{width:100%;min-width:90px}.pthtb td{vertical-align:top}.pthst{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}.pthst span{padding:6px 12px;border-radius:99px;background:#f1f5f9;font-size:13px}</style>`
   +H("Page thương hiệu Ailla","Lịch nội dung tháng · bộ quy tắc · quy trình lên bài. Agent đọc từ đây, chị duyệt ở đây")
   +`<div class="tabs">${tabs.map(([k,t])=>`<button data-pt="${k}" class="${PTH.tab===k?"on":""}">${t}</button>`).join("")}</div>`
   +`<div id="pth-b"></div>`;
  m.querySelectorAll("[data-pt]").forEach(b=>b.onclick=()=>{PTH.tab=b.dataset.pt;renderMain()});
  const b=m.querySelector("#pth-b");
  if(PTH.tab==="rules")pthRules(b,lead);else if(PTH.tab==="flow")pthFlow(b,lead);else pthCalTab(b,lead,ed)
}
function pthCalTab(b,lead,ed){
  const d=D(),saved=pthCal(PTH.m),L0=saved||pthDraft(PTH.m),isDraft=!saved&&L0.length>0;
  const L=L0.slice().sort((x,y)=>(x.ngay+x.gio).localeCompare(y.ngay+y.gio));
  const [Y,Mo]=PTH.m.split("-").map(Number),nd=new Date(Y,Mo,0).getDate(),first=(new Date(Y,Mo-1,1).getDay()+6)%7;
  const cnt={};L.forEach(p=>cnt[p.dang]=(cnt[p.dang]||0)+1);const tot=L.length||1;
  const pct=k=>Math.round((cnt[k]||0)/tot*100);
  const cells=[];for(let i=0;i<first;i++)cells.push(0);for(let i=1;i<=nd;i++)cells.push(i);while(cells.length%7)cells.push(0);
  const prods=[["","—"],["TH","Thương hiệu Ailla"]].concat((d.catalog||[]).filter(c=>c.active).map(c=>[c.k,c.n]));
  const pn=k=>(prods.find(x=>x[0]===k)||[k,k||"—"])[1];
  const row=p=>{const ex=saved&&ed;const f=(k,v,type)=>ex?`<input class="pthi" type="${type||"text"}" data-pf="${esc(p.id)}|${k}" value="${esc(v||"")}">`:esc(v||"—");
    const sel=(k,v,o)=>ex?`<select data-pf="${esc(p.id)}|${k}">${opt(o,v)}</select>`:esc(((o.find(x=>(x[0]||x)===v)||[])[1])||v||"—");
    return `<tr><td>${ex?`<input type="date" data-pf="${esc(p.id)}|ngay" value="${esc(p.ngay)}" min="${pthDate(PTH.m,1)}" max="${pthDate(PTH.m,nd)}">`:esc(p.ngay.slice(8)+"/"+p.ngay.slice(5,7))}</td><td>${f("gio",p.gio,"time")}</td><td>${sel("dang",p.dang,PTH_DANG.map(x=>[x[0],x[1]]))}</td><td>${sel("tep",p.tep,PTH_TEP.map(x=>[x,x]))}</td><td>${sel("sp",p.sp,prods)}</td><td>${f("chuDe",p.chuDe)}</td><td>${f("y",p.y)}</td><td>${f("cta",p.cta)}</td><td>${sel("st",p.st,PTH_ST.map(x=>[x,x]))}</td><td>${ex?`<button type="button" class="lnk danger" data-pdel="${esc(p.id)}">Xóa</button>`:""}</td></tr>`};
  b.innerHTML=`<div class="pthbar"><select id="pth-m">${opt(PTH_MONTHS.map(x=>[x,"Tháng "+x.slice(5)+"/"+x.slice(0,4)]),PTH.m)}</select><span class="hint">${L0.length} bài${isDraft?" · BẢN NHÁP CHƯA LƯU":""}</span><span style="flex:1"></span>
    ${isDraft&&ed?`<button type="button" class="btn pri" id="pth-use">Dùng bản nháp này</button>`:""}
    ${saved&&ed?`<button type="button" class="btn sm pri" id="pth-add">+ Thêm bài</button>`:""}${!saved&&!L0.length&&ed?`<button type="button" class="btn sm pri" id="pth-new">+ Bắt đầu lịch tháng này</button>`:""}
    ${saved&&lead?`<button type="button" class="btn sm" id="pth-ok">Duyệt cả tháng</button>`:""}${L0.length?`<button type="button" class="btn sm" id="pth-x">⬇ Xuất Excel</button>`:""}</div>
   ${isDraft?`<div class="card pad" style="background:#fff8e6"><b>Đây là bản nháp em đề xuất cho tháng ${Mo}.</b> Dựa trên mục tiêu: tăng nhận diện và tương tác, 30% nguồn lực cho khách B2B, sản phẩm đẩy Bột tẩy vạn năng, Nước giặt, Tinh dầu giặt sấy, mốc sale đôi 11/11 và sale cuối năm. Các bài khuyến mại ghi "CHỜ chị chốt chương trình". Chưa lưu vào web: bấm <b>Dùng bản nháp này</b> để lưu rồi chỉnh.</div>`:""}
   ${L0.length?`<div class="pthst"><span><b>${L0.length}</b> bài</span>${PTH_DANG.filter(x=>cnt[x[0]]||PTH_TARGET[x[0]]).map(x=>`<span style="border-left:4px solid ${x[2]}">${x[1]}: <b>${cnt[x[0]]||0}</b> (${pct(x[0])}%${PTH_TARGET[x[0]]?" / mục tiêu "+PTH_TARGET[x[0]]+"%":""})</span>`).join("")}</div>
   <section class="card pad"><div class="pthg">${["T2","T3","T4","T5","T6","T7","CN"].map(t=>`<div class="pthh">${t}</div>`).join("")}${cells.map(dy=>{if(!dy)return `<div class="pthc off"></div>`;const P=L.filter(p=>+p.ngay.slice(8)===dy);return `<div class="pthc"><b>${dy}</b>${P.map(p=>`<span class="pthp" style="background:${pthDangN(p.dang)[2]}" title="${esc(p.gio+" · "+p.chuDe)}">${esc(p.gio)} ${esc(p.chuDe)}</span>`).join("")}</div>`}).join("")}</div></section>
   <section class="card flush"><div class="tbl bvscroll"><table class="pthtb"><thead><tr><th>Ngày</th><th>Giờ</th><th>Dạng bài</th><th>Tệp</th><th>Sản phẩm</th><th>Chủ đề</th><th>Ý chính</th><th>Lời kêu gọi</th><th>Trạng thái</th><th></th></tr></thead><tbody>${L.map(row).join("")}</tbody></table></div></section>`:`<p class="empty">Chưa có lịch cho tháng này.</p>`}`;
  b.querySelector("#pth-m").onchange=e=>{PTH.m=e.target.value;renderMain()};
  const u=b.querySelector("#pth-use");if(u)u.onclick=()=>{pthMut("lưu bản nháp lịch page "+PTH.m,t=>{t.cal[PTH.m]=pthDraft(PTH.m)});toast("Đã lưu bản nháp, chị chỉnh sửa trực tiếp trong bảng");renderMain()};
  const nw=b.querySelector("#pth-new");if(nw)nw.onclick=()=>{pthMut("tạo lịch page "+PTH.m,t=>{t.cal[PTH.m]=[]});renderMain()};
  const ad=b.querySelector("#pth-add");if(ad)ad.onclick=()=>{pthMut("thêm bài lịch page",t=>{t.cal[PTH.m].push({id:"pth-"+PTH.m+"-"+Date.now().toString(36),ngay:pthDate(PTH.m,1),gio:"20:00",dang:"TH",tep:"Chung",sp:"TH",chuDe:"Bài mới",y:"",cta:"",st:"Nháp"})});renderMain()};
  const ok=b.querySelector("#pth-ok");if(ok)ok.onclick=()=>{if(!confirm("Duyệt cả tháng? Các bài đang là Nháp sẽ thành Đã duyệt tuyến."))return;pthMut("duyệt lịch page "+PTH.m,t=>{(t.cal[PTH.m]||[]).forEach(p=>{if(p.st==="Nháp")p.st="Đã duyệt tuyến"});const f=t.flow[PTH.m]=t.flow[PTH.m]||{steps:{},cond:{}};f.steps.cal="Xong"});toast("Đã duyệt lịch tháng");renderMain()};
  const x=b.querySelector("#pth-x");if(x)x.onclick=()=>xlsExport("lich-page-thuong-hieu-"+PTH.m,"Lich page",["Ngày","Giờ","Dạng bài","Tệp","Sản phẩm","Chủ đề","Ý chính","Lời kêu gọi","Trạng thái"],L.map(p=>[p.ngay,p.gio,pthDangN(p.dang)[1],p.tep,pn(p.sp),p.chuDe,p.y,p.cta,p.st]));
  b.querySelectorAll("[data-pf]").forEach(i=>i.onchange=()=>{const [id,k]=i.dataset.pf.split("|");pthMut("sửa bài lịch page",t=>{const p=(t.cal[PTH.m]||[]).find(z=>z.id===id);if(p)p[k]=i.value});if(k==="ngay"||k==="dang"||k==="gio"||k==="chuDe"||k==="st")renderMain()});
  b.querySelectorAll("[data-pdel]").forEach(i=>i.onclick=()=>{if(!confirm("Xóa bài này khỏi lịch?"))return;const id=i.dataset.pdel;pthMut("xóa bài lịch page",t=>{t.cal[PTH.m]=(t.cal[PTH.m]||[]).filter(z=>z.id!==id)});renderMain()})
}
function pthRules(b,lead){
  const R=pthData().rules||{};
  b.innerHTML=`<p class="hint">Bộ quy tắc này là nguồn duy nhất cho agent khi lên tuyến và soạn bài. ${lead?"Chị sửa trực tiếp, mỗi ô tự lưu.":"Chỉ lead và chị sửa được."}</p>`
   +PTH_RULES.map(([k,t,def])=>`<section class="card pad"><div class="card-h"><h2>${esc(t)}</h2>${R[k]!=null?`<span class="hint">đã chỉnh</span>`:""}</div><textarea rows="${Math.min(10,(R[k]!=null?R[k]:def).split("\n").length+1)}" style="width:100%" data-pr="${k}" ${lead?"":"disabled"}>${esc(R[k]!=null?R[k]:def)}</textarea></section>`).join("");
  b.querySelectorAll("[data-pr]").forEach(t=>t.onchange=()=>{const k=t.dataset.pr;pthMut("sửa quy tắc page: "+k,p=>{p.rules[k]=t.value});toast("Đã lưu")})
}
function pthFlow(b,lead){
  const F=((pthData().flow||{})[PTH.m])||{steps:{},cond:{}},steps=F.steps||{},cond=F.cond||{},needNc=PTH_COND.some(([k])=>cond[k]);
  b.innerHTML=`<div class="pthbar"><select id="pth-fm">${opt(PTH_MONTHS.map(x=>[x,"Tháng "+x.slice(5)+"/"+x.slice(0,4)]),PTH.m)}</select></div>
   <section class="card pad"><div class="card-h"><h2>Có cần nghiên cứu lại tháng này không?</h2></div>${PTH_COND.map(([k,t])=>`<label class="ck"><input type="checkbox" data-pc="${k}" ${cond[k]?"checked":""} ${lead?"":"disabled"}> ${esc(t)}</label>`).join("")}<p><b>${needNc?"Cần chạy bước 1 (nghiên cứu).":"Không cần nghiên cứu lại, dùng bản nghiên cứu cũ."}</b></p></section>
   <section class="card flush"><div class="tbl"><table><thead><tr><th>Bước</th><th>Nội dung</th><th>Trạng thái</th></tr></thead><tbody>${PTH_FLOW.map(([k,t,s])=>`<tr><td><b>${esc(t)}</b></td><td>${esc(k==="nc"&&!needNc?"Bỏ qua tháng này (không có điều kiện). ":"")}${esc(s)}</td><td><select data-ps="${k}" ${lead?"":"disabled"}>${opt(PTH_FST,steps[k]||"Chưa làm")}</select></td></tr>`).join("")}</tbody></table></div></section>
   <p class="hint">Hiện chị hoặc lead cập nhật trạng thái ở đây. Khi nối agent, từng kỹ năng sẽ tự ghi trạng thái khi làm xong, kỹ năng kế tiếp thấy là chạy.</p>`;
  b.querySelector("#pth-fm").onchange=e=>{PTH.m=e.target.value;renderMain()};
  b.querySelectorAll("[data-pc]").forEach(i=>i.onchange=()=>{pthMut("điều kiện nghiên cứu page",t=>{const f=t.flow[PTH.m]=t.flow[PTH.m]||{steps:{},cond:{}};f.cond=f.cond||{};f.cond[i.dataset.pc]=i.checked});renderMain()});
  b.querySelectorAll("[data-ps]").forEach(i=>i.onchange=()=>{pthMut("trạng thái quy trình page",t=>{const f=t.flow[PTH.m]=t.flow[PTH.m]||{steps:{},cond:{}};f.steps=f.steps||{};f.steps[i.dataset.ps]=i.value});toast("Đã cập nhật")})
}
PAGES.pth=pPth;
