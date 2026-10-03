/* =====================================================================
   KẾ HOẠCH THÁNG › BƯỚC 5 › ② PILLAR & TUYẾN
   Mỗi sản phẩm ở mỗi kênh (chọn ở ①) là một pillar. Trong pillar là các dòng tuyến:
   tuyến nội dung (demo, so sánh, đóng gói, HDSD, giải đáp, combat, khuyến mại…) · vai trò
   (giáo dục khách, phá rào cản, kêu gọi vào live…) · số lượng kế hoạch · định dạng.
   Video phát sinh khi đi quay được ghi thêm vào tuyến; mỗi tuyến hiện thừa / thiếu so với kế hoạch.
   ===================================================================== */
const TUYEN_GOIY=["Demo sản phẩm","So sánh sản phẩm","Quy trình đóng gói","Hướng dẫn sử dụng","Giải đáp thắc mắc","Combat","Khuyến mại","Trước/sau","Review / feedback khách","Pain/Insight","Bí quyết chuyên gia","Chọn mùi/Lifestyle","Nhân bản winner","Đăng lại video kho","Đổi hook video tồn"];
const VAITRO_GOIY=["Giáo dục khách hàng","Phá rào cản mua hàng","Kêu gọi mua ngay","Kêu gọi vào live","Tăng niềm tin","Giữ chân khách cũ","Test góc mới"];
/* Pillar "Thương hiệu Ailla" (branding) có bộ tuyến và vai trò riêng */
const TUYEN_TH=["Câu chuyện thương hiệu","Nhà máy & quy trình sản xuất","Đội ngũ Ailla","Giá trị Sạch & Lành","Mẹo hay gia đình","Khách hàng nói về Ailla","Chứng nhận & giải thưởng","Hoạt động cộng đồng","Sự kiện, ngày lễ","Hậu trường"];
const VAITRO_TH=["Tăng nhận diện thương hiệu","Tăng niềm tin","Gắn kết cộng đồng","Kéo người theo dõi page","Chăm sóc khách cũ","Tuyển đại lý / đối tác"];
let PT_K="";
const ptPairs=()=>{const o=[];prods().forEach(p=>pKenhs(p).forEach(e=>o.push({sku:p.k,kenh:e.kenh,huong:e.huong})));return o};
const ptPil=(d,sku,kenh)=>(d.pillars||[]).find(x=>x.sku===sku&&x.kenh===kenh);
function ptEnsure(dt,sku,kenh){let p=ptPil(dt,sku,kenh);if(!p){p={ma:"PIL-"+MONTH.key.slice(2).replace("-","")+"-"+String(dt.pillars.length+1).padStart(2,"0"),sku,kenh,vaiTro:"",mucTieu:"",kh:0,dinhDang:"",idea:"",nguoi:"",ghiChu:""};dt.pillars.push(p)}return p}
const ptFmt=kenh=>chOf(kenh).needId?LISTS.dangVideo.filter(x=>!["Bài ảnh","Carousel"].includes(x)):LISTS.fbFormat;
function ptHtml(d,ed){
  const pairs=ptPairs(),chs=CHANNELS.filter(ch=>pairs.some(x=>x.kenh===ch.k));
  if(!PT_K||!chs.some(c=>c.k===PT_K))PT_K=(chs[0]||{}).k||"";
  const P=pairs.filter(x=>x.kenh===PT_K);
  const block=x=>{const pl=ptPil(d,x.sku,x.kenh)||{},T=d.tuyen.map((t,i)=>[t,i]).filter(([t])=>t.kenh===x.kenh&&t.sku===x.sku),key=x.sku+"|"+x.kenh;
    const C=d.cards.filter(c=>c.kenh===x.kenh&&c.sku===x.sku),kh=sum(T,([t])=>t.kh),xong=C.filter(c=>c.step==="xong").length;
    const rows=T.map(([t,i])=>{const cs=C.filter(c=>c.maTuyen===t.ma),dn=cs.filter(c=>c.step==="xong").length,ps=cs.filter(c=>c.phatSinh).length,diff=cs.length-t.kh;
      const chenh=diff>0?pill("+"+diff+" phát sinh","vio"):diff<0&&d.plan.published?pill("thiếu "+(-diff)+" thẻ","amb"):"";
      return `<tr><td>${ed?`<input list="${x.sku==="TH"?"dl-tuyen-th":"dl-tuyen"}" data-tu2="${i}" data-f="tuyen" value="${esc(t.tuyen)}">`:esc(t.tuyen)}<small class="mono">${esc(t.ma)}</small></td>
       <td>${ed?`<input list="${x.sku==="TH"?"dl-vaitro-th":"dl-vaitro"}" data-tu2="${i}" data-f="vaiTro" value="${esc(t.vaiTro||"")}">`:esc(t.vaiTro||"")}</td>
       <td class="n">${ed?`<input class="num" type="number" min="0" data-tu2="${i}" data-f="kh" value="${t.kh}">`:t.kh}</td>
       <td>${ed?`<select data-tu2="${i}" data-f="dangVideo">${opt([["","—"]].concat(ptFmt(x.kenh)),t.dangVideo||"")}</select>`:esc(t.dangVideo||"—")}</td>
       <td class="n"><button type="button" class="lnk" data-gotuyen="${esc(t.ma)}">${cs.length} thẻ</button><small>${dn} đã đăng${ps?` · ${ps} phát sinh`:""}</small></td>
       <td>${chenh}</td>
       <td class="nowrap">${ed?`<button class="btn sm" data-tps="${i}" title="Ghi thêm 1 video ngoài kế hoạch cho tuyến này">+ Phát sinh</button> ${cs.length?"":`<button class="lnk danger" data-tdel2="${i}">Xóa</button>`}`:""}</td></tr>`}).join("");
    return `<div class="ptb"><div class="pth">${swatch(x.sku)}<b>${esc(sk(x.sku).n)}</b>${x.sku==="TH"?pill("Branding","vio"):""}${pill(x.huong,x.huong==="Đẩy mạnh"?"pnk":x.huong==="Test"||x.huong==="Đẩy nhẹ"?"amb":"gry")}<span class="sp"></span><span class="hint">kế hoạch <b>${kh}</b> · có thẻ <b>${C.length}</b> · đã đăng <b>${xong}</b>${C.length>kh&&kh?` · <b class="t-vio">phát sinh +${C.length-kh}</b>`:""}</span></div>
     <div class="pti"><label>Big idea${ed?`<input data-pi="${esc(key)}" data-f="idea" value="${esc(pl.idea||"")}" placeholder="${x.sku==="TH"?"Ý lớn xuyên suốt, ví dụ: Ailla, Sạch & Lành cho cả nhà":"Ý lớn xuyên suốt pillar, ví dụ: bí quyết tiệm giặt về tận nhà"}">`:`<b>${esc(pl.idea||"—")}</b>`}</label><label>Ghi chú${ed?`<input data-pi="${esc(key)}" data-f="ghiChu" value="${esc(pl.ghiChu||"")}">`:`<span>${esc(pl.ghiChu||"")}</span>`}</label></div>
     <div class="tbl"><table class="pttab"><thead><tr><th>Tuyến nội dung</th><th>Vai trò</th><th class="n">Số lượng KH</th><th>Định dạng</th><th class="n">Thẻ</th><th>Thừa / thiếu</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="7" class="empty">Chưa có tuyến. Thêm ở dòng dưới.</td></tr>`}</tbody></table></div>
     ${ed?`<div class="ptadd" data-nf="${esc(key)}"><input list="${x.sku==="TH"?"dl-tuyen-th":"dl-tuyen"}" class="nt" placeholder="${x.sku==="TH"?"Tuyến thương hiệu (gõ hoặc chọn)":"Tuyến nội dung (gõ hoặc chọn)"}"><input list="${x.sku==="TH"?"dl-vaitro-th":"dl-vaitro"}" class="nv" placeholder="Vai trò"><input type="number" min="1" class="nn" value="4" title="Số lượng kế hoạch"><select class="nd">${opt([["","Định dạng"]].concat(ptFmt(x.kenh)),"")}</select><button class="btn sm pri" data-tnew="${esc(key)}">+ Thêm tuyến</button></div>`:""}</div>`};
  return `<section class="card" id="ptsec"><div class="card-h"><h2>② Pillar & tuyến</h2><span class="hint">mỗi sản phẩm ở mỗi kênh (chọn ở ①) là một pillar · trong pillar ghi các tuyến: nội dung gì, vai trò gì, bao nhiêu video, định dạng nào</span></div>
   ${chs.length?`<div class="seg ptk">${chs.map(ch=>`<button data-ptk="${esc(ch.k)}" class="${ch.k===PT_K?"on":""}">${esc(ch.short)} <span class="xbadge">${pairs.filter(x=>x.kenh===ch.k).length}</span></button>`).join("")}</div>`:""}
   ${P.map(block).join("")||`<p class="empty">Chưa có sản phẩm nào ở ①. Thêm sản phẩm vào kênh trước, pillar sẽ tự hiện ở đây.</p>`}
   <datalist id="dl-tuyen">${TUYEN_GOIY.map(x=>`<option value="${esc(x)}">`).join("")}</datalist><datalist id="dl-vaitro">${VAITRO_GOIY.map(x=>`<option value="${esc(x)}">`).join("")}</datalist><datalist id="dl-tuyen-th">${TUYEN_TH.map(x=>`<option value="${esc(x)}">`).join("")}</datalist><datalist id="dl-vaitro-th">${VAITRO_TH.map(x=>`<option value="${esc(x)}">`).join("")}</datalist>
   ${ed?`<div class="acts"><button class="btn pri" id="pt-pub">Phát hành thẻ còn thiếu</button><span class="hint">Video phát sinh khi đi quay: bấm "+ Phát sinh" ở đúng tuyến, hoặc ghi ngay ở buổi quay (Xếp việc tuần › ③ Quay). Số kế hoạch giữ nguyên, phần thêm hiện là "phát sinh".</span></div>`:""}</section>`;
}
function ptBind(b){
  b.querySelectorAll("[data-ptk]").forEach(x=>x.onclick=()=>{PT_K=x.dataset.ptk;renderMain()});
  b.querySelectorAll("[data-pi]").forEach(x=>x.onchange=()=>{const [sku,kenh]=x.dataset.pi.split("|");DB.mutate(ME.name,"sửa pillar "+sk(sku).n,dt=>{ptEnsure(dt,sku,kenh)[x.dataset.f]=x.value});toast("Đã lưu")});
  b.querySelectorAll("[data-tu2]").forEach(x=>x.onchange=()=>{DB.mutate(ME.name,"sửa tuyến",dt=>{const t=dt.tuyen[+x.dataset.tu2];t[x.dataset.f]=x.dataset.f==="kh"?Math.max(0,+x.value||0):x.value});toast("Đã lưu");renderMain()});
  b.querySelectorAll("[data-tnew]").forEach(x=>x.onclick=()=>{const [sku,kenh]=x.dataset.tnew.split("|"),f=x.closest(".ptadd"),tu=f.querySelector(".nt").value.trim();if(!tu){toast("Gõ hoặc chọn tuyến nội dung");f.querySelector(".nt").focus();return}
    DB.mutate(ME.name,"thêm tuyến "+tu,dt=>{ptEnsure(dt,sku,kenh);const n=dt.tuyen.filter(t=>t.sku===sku).length+1;let ma=`T${MONTH.mon}-${sku}-${String(n).padStart(2,"0")}`;while(dt.tuyen.some(t=>t.ma===ma))ma+="b";dt.tuyen.push({ma,kenh,sku,tuyen:tu,vaiTro:f.querySelector(".nv").value.trim(),kh:Math.max(1,+f.querySelector(".nn").value||1),dangVideo:f.querySelector(".nd").value,nguoi:"",kiemChung:"Giả thuyết",maInsight:"",ghiChu:""})});toast("Đã thêm tuyến "+tu);renderMain()});
  b.querySelectorAll("[data-tps]").forEach(x=>x.onclick=()=>{const t=D().tuyen[+x.dataset.tps];let id;DB.mutate(ME.name,"video phát sinh tuyến "+t.ma,dt=>{const c=newCard(dt,{sku:t.sku,kenh:t.kenh,maTuyen:t.ma,day:dt.settings.today,nguon:"Quay mới",loai:"moi",dangVideo:t.dangVideo||undefined,phatSinh:true});dt.cards.push(c);id=c.id});toast("Đã ghi 1 video phát sinh ("+id+"), giao người làm ở Xếp việc tuần");renderMain()});
  b.querySelectorAll("[data-tdel2]").forEach(x=>x.onclick=()=>{if(x.dataset.ok){DB.mutate(ME.name,"xóa tuyến",dt=>dt.tuyen.splice(+x.dataset.tdel2,1));renderMain()}else{x.dataset.ok=1;x.textContent="Bấm lần nữa để xóa"}});
  if($("#pt-pub"))$("#pt-pub").onclick=()=>{let n=0;DB.mutate(ME.name,"phát hành thẻ",dt=>{n=publishPlan(dt)});toast(n?`Đã sinh ${n} thẻ vào bước Chưa giao`:"Đủ thẻ theo kế hoạch");renderMain()};
}
/* Thay bảng Pillar và bảng Tuyến cũ bằng khối Pillar & tuyến theo kênh (giữ ① Sản phẩm của hàm cũ) */
const _lichPillarOld=lichPillar;
lichPillar=function(b){_lichPillarOld(b);[...b.querySelectorAll("section.card")].slice(1).forEach(s=>s.remove());const ed=can(ME,"kehoach.sua");b.insertAdjacentHTML("beforeend",ptHtml(D(),ed));ptBind(b);bindCommon(b)};
