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
let PT_K="",PT_ED=false;
/* Ô chọn có dòng cuối "＋ Thêm mới…": bấm vào mở cửa sổ nhỏ để thêm (và bỏ) mục trong danh sách gợi ý */
const GY_TEN={tuyen:"tuyến nội dung",vaitro:"vai trò",tuyenTH:"tuyến thương hiệu",vaitroTH:"vai trò thương hiệu",dd:"định dạng video",ddFB:"định dạng bài Fanpage"};
const gsel=(k,attrs,val,ph)=>{const L=goiy(k);return `<select ${attrs} data-gk="${k}">${opt([["",ph]].concat(L.map(v=>[v,v])).concat(val&&!L.includes(val)?[[val,val]]:[]).concat([["__add","＋ Thêm mới…"]]),val||"")}</select>`};
function gyModal(sel){const k=sel.dataset.gk,prev=sel.dataset.prev||"";sel.value=prev;
  const w=document.createElement("div");w.className="gymod";
  const draw=()=>{w.innerHTML=`<div class="gybox" role="dialog" aria-label="Thêm ${GY_TEN[k]}"><div class="gyhd"><b>Thêm ${GY_TEN[k]}</b><button class="btn sm" data-gyx0="1">✕</button></div>
    <div class="ptadd"><input id="gy-in" placeholder="Gõ ${GY_TEN[k]} mới"><button class="btn pri" id="gy-ok">Thêm</button></div>
    <div class="hint">Đang có trong danh sách (bấm ✕ để bỏ, không ảnh hưởng tuyến đã lập):</div>
    <div class="chips2">${goiy(k).map((v,i)=>`<span class="pchip">${esc(v)}<button class="lnk danger" data-gyrm="${i}">✕</button></span>`).join("")}</div></div>`;
    const inp=w.querySelector("#gy-in");inp.focus();
    const save=()=>{const v=inp.value.trim();if(!v){inp.focus();return}let ok=false;DB.mutate(ME.name,"thêm gợi ý "+v,dt=>{ok=goiyAdd(dt,k,v)});
      document.querySelectorAll(`select[data-gk="${k}"]`).forEach(s2=>{if(![...s2.options].some(o=>o.value===v)){const o=new Option(v,v);s2.add(o,s2.options[s2.options.length-1])}});
      sel.value=v;sel.dataset.prev=v;w.remove();toast(ok?"Đã thêm "+v:"Đã chọn "+v);if(sel.dataset.tu2!==undefined)sel.onchange()};
    w.querySelector("#gy-ok").onclick=save;inp.onkeydown=e=>{if(e.key==="Enter")save();if(e.key==="Escape")w.remove()};
    w.querySelector("[data-gyx0]").onclick=()=>w.remove();
    w.querySelectorAll("[data-gyrm]").forEach(x=>x.onclick=()=>{const i=+x.dataset.gyrm,v=goiy(k)[i];DB.mutate(ME.name,"bỏ gợi ý "+v,dt=>{dt.settings.goiy=dt.settings.goiy||{};const L=(Array.isArray(dt.settings.goiy[k])?dt.settings.goiy[k]:GOIY_DEF[k]).slice();L.splice(i,1);dt.settings.goiy[k]=L});draw()})};
  w.onclick=e=>{if(e.target===w)w.remove()};document.body.appendChild(w);draw()}
document.addEventListener("focusin",e=>{const s=e.target;if(s.matches&&s.matches("select[data-gk]")&&s.value!=="__add")s.dataset.prev=s.value});
document.addEventListener("change",e=>{const s=e.target;if(s.matches&&s.matches("select[data-gk]")){if(s.value==="__add")gyModal(s);else s.dataset.prev=s.value}},true);const PT_OPEN=new Set();
/* Danh sách gợi ý sửa được: lưu trong dữ liệu chung (settings.goiy), chưa sửa thì dùng danh sách mặc định */
const GOIY_DEF={tuyen:TUYEN_GOIY,vaitro:VAITRO_GOIY,tuyenTH:TUYEN_TH,vaitroTH:VAITRO_TH,dd:LISTS.dangVideo.filter(x=>!["Bài ảnh","Carousel"].includes(x)),ddFB:LISTS.fbFormat};
const goiy=k=>{const g=(D().settings||{}).goiy;return g&&Array.isArray(g[k])?g[k]:GOIY_DEF[k]};
function goiyAdd(dt,k,v){v=(v||"").trim();if(!v)return false;dt.settings.goiy=dt.settings.goiy||{};const L=Array.isArray(dt.settings.goiy[k])?dt.settings.goiy[k]:GOIY_DEF[k].slice();if(L.some(x=>x.toLowerCase()===v.toLowerCase()))return false;dt.settings.goiy[k]=L.concat(v);return true}
const ptPairs=()=>{const o=[];prods().forEach(p=>pKenhs(p).forEach(e=>o.push({sku:p.k,kenh:e.kenh,huong:e.huong,sl:+e.sl||0})));return o};
/* So tổng số video các tuyến với KPI số video của sản phẩm ở kênh */
const ptVs=(kpi,kh)=>!kpi?pill("Chưa đặt KPI","gry"):kh===kpi?pill("Đủ KPI","grn"):kh<kpi?pill("Còn thiếu "+(kpi-kh)+" video","amb"):pill("Vượt "+(kh-kpi)+" video","vio");
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
      const chenh=diff>0?pill("+"+diff+" phát sinh","vio"):diff<0?pill("còn "+(-diff)+" video","amb"):pill("đủ","grn");
      return `<tr><td>${ed?gsel(x.sku==="TH"?"tuyenTH":"tuyen",`data-tu2="${i}" data-f="tuyen"`,t.tuyen,"Chọn tuyến"):esc(t.tuyen)}<small class="mono">${esc(t.ma)}</small></td>
       <td>${ed?gsel(x.sku==="TH"?"vaitroTH":"vaitro",`data-tu2="${i}" data-f="vaiTro"`,t.vaiTro||"","Vai trò"):esc(t.vaiTro||"")}</td>
       
       <td>${ed?gsel(chOf(x.kenh).needId?"dd":"ddFB",`data-tu2="${i}" data-f="dangVideo"`,t.dangVideo||"","Định dạng"):esc(t.dangVideo||"—")}</td>
       <td class="n"><button type="button" class="lnk" data-gotuyen="${esc(t.ma)}">${cs.length} thẻ</button><small>${dn} đã đăng${ps?` · ${ps} phát sinh`:""}</small></td>
       
       <td class="nowrap">${ed?`<button class="btn sm" data-tps="${i}" title="Ghi thêm 1 video ngoài kế hoạch cho tuyến này">+ Phát sinh</button> ${cs.length?"":`<button class="lnk danger" data-tdel2="${i}">Xóa</button>`}`:""}</td></tr>`}).join("");
    const op=PT_OPEN.has(key);return `<div class="ptb${op?" open":""}"><div class="pth" data-ptopen="${esc(key)}"><i class="ptar">${op?"▾":"▸"}</i>${swatch(x.sku)}<b>${esc(sk(x.sku).n)}</b>${x.sku==="TH"?pill("Branding","vio"):""}${pill(x.huong,x.huong==="Đẩy mạnh"?"pnk":x.huong==="Test"||x.huong==="Đẩy nhẹ"?"amb":"gry")}<span class="ptkpi">KPI ${ed?`<input type="number" min="0" class="num" data-pkpi="${esc(key)}" value="${x.sl||""}" placeholder="—">`:`<b>${x.sl||"—"}</b>`} video · <b>${T.length}</b> tuyến</span><span class="sp"></span><span class="hint">đã giao <b>${C.length}</b> video · đã đăng <b>${xong}</b></span></div>
     ${op?`<div class="ptbody"><div class="pti"><label>Big idea${ed?`<input data-pi="${esc(key)}" data-f="idea" value="${esc(pl.idea||"")}" placeholder="${x.sku==="TH"?"Ý lớn xuyên suốt, ví dụ: Ailla, Sạch & Lành cho cả nhà":"Ý lớn xuyên suốt pillar, ví dụ: bí quyết tiệm giặt về tận nhà"}">`:`<b>${esc(pl.idea||"—")}</b>`}</label><label>Ghi chú${ed?`<input data-pi="${esc(key)}" data-f="ghiChu" value="${esc(pl.ghiChu||"")}">`:`<span>${esc(pl.ghiChu||"")}</span>`}</label></div>
     <div class="tbl"><table class="pttab"><thead><tr><th>Tuyến nội dung</th><th>Vai trò</th><th>Định dạng</th><th class="n">Thẻ</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="5" class="empty">Chưa có tuyến. Thêm ở dòng dưới.</td></tr>`}</tbody></table></div>
     ${ed?`<div class="ptadd" data-nf="${esc(key)}">${gsel(x.sku==="TH"?"tuyenTH":"tuyen",`class="nt"`,"",x.sku==="TH"?"Chọn tuyến thương hiệu":"Chọn tuyến nội dung")}${gsel(x.sku==="TH"?"vaitroTH":"vaitro",`class="nv"`,"","Vai trò")}${gsel(chOf(x.kenh).needId?"dd":"ddFB",`class="nd"`,"","Định dạng")}<button class="btn sm pri" data-tnew="${esc(key)}">+ Thêm tuyến</button></div>`:""}</div>`:`<div class="ptmini">${T.map(([t])=>esc(t.tuyen)).join(" · ")||"Chưa có tuyến"} · <span class="lnk">bấm để mở</span></div>`}</div>`};
  return `<section class="card" id="ptsec"><div class="card-h"><h2>② Pillar & tuyến</h2><span class="hint">mỗi sản phẩm ở mỗi kênh (chọn ở ①) là một pillar · trong pillar ghi đủ các tuyến: nội dung gì, vai trò gì, định dạng nào (không cần số video từng tuyến, người viết kịch bản chọn tuyến cho từng video)</span></div>
   
   ${chs.length?`<div class="seg ptk">${chs.map(ch=>`<button data-ptk="${esc(ch.k)}" class="${ch.k===PT_K?"on":""}">${esc(ch.short)} <span class="xbadge">${pairs.filter(x=>x.kenh===ch.k).length}</span></button>`).join("")}</div>`:""}
   ${P.length?(()=>{const K=sum(P,x=>x.sl);return `<div class="ptsum"><b>${esc(chOf(PT_K).short)}</b> · KPI cả kênh <b>${K||"—"}</b> video · <b>${d.tuyen.filter(t=>t.kenh===PT_K).length}</b> tuyến</div>`})():""}${P.map(block).join("")||`<p class="empty">Chưa có sản phẩm nào ở ①. Thêm sản phẩm vào kênh trước, pillar sẽ tự hiện ở đây.</p>`}
   <datalist id="dl-tuyen">${goiy("tuyen").map(x=>`<option value="${esc(x)}">`).join("")}</datalist><datalist id="dl-vaitro">${goiy("vaitro").map(x=>`<option value="${esc(x)}">`).join("")}</datalist><datalist id="dl-dd">${goiy("dd").map(x=>`<option value="${esc(x)}">`).join("")}</datalist><datalist id="dl-ddfb">${goiy("ddFB").map(x=>`<option value="${esc(x)}">`).join("")}</datalist><datalist id="dl-tuyen-th">${goiy("tuyenTH").map(x=>`<option value="${esc(x)}">`).join("")}</datalist><datalist id="dl-vaitro-th">${goiy("vaitroTH").map(x=>`<option value="${esc(x)}">`).join("")}</datalist>
   ${ed?`<div class="acts"><button class="btn pri" id="pt-pub">${d.plan.published?"Đã chốt kế hoạch gốc":"Chốt kế hoạch tháng"}</button><span class="hint">Kế hoạch tháng là quỹ video: KPI số video, không gắn ngày. Số video từng tuyến không cần đặt trước: người viết hook / kịch bản chọn tuyến cho từng video. Video được tạo khi lên danh sách hook ở Kế hoạch tháng › 6. Làm hằng ngày › ③ Buổi quay & hook, mỗi hook ghi vào một tuyến. Hook phát sinh khi quay hiện là "phát sinh" ở đúng tuyến.</span></div>`:""}</section>`;
}
function ptBind(b){
  b.querySelectorAll("[data-ptopen]").forEach(h=>h.onclick=e=>{if(e.target.closest("input,select,button,a,textarea"))return;const k=h.dataset.ptopen;PT_OPEN.has(k)?PT_OPEN.delete(k):PT_OPEN.add(k);renderMain()});
  b.querySelectorAll("[data-ptk]").forEach(x=>x.onclick=()=>{PT_K=x.dataset.ptk;renderMain()});
  b.querySelectorAll("[data-pi]").forEach(x=>x.onchange=()=>{const [sku,kenh]=x.dataset.pi.split("|");DB.mutate(ME.name,"sửa pillar "+sk(sku).n,dt=>{ptEnsure(dt,sku,kenh)[x.dataset.f]=x.value});toast("Đã lưu")});
  b.querySelectorAll("[data-tu2]").forEach(x=>x.onchange=()=>{if(x.value==="__add")return;DB.mutate(ME.name,"sửa tuyến",dt=>{const t=dt.tuyen[+x.dataset.tu2],f=x.dataset.f,th=t.sku==="TH";t[f]=f==="kh"?Math.max(0,+x.value||0):x.value;if(f==="tuyen")goiyAdd(dt,th?"tuyenTH":"tuyen",x.value);if(f==="vaiTro")goiyAdd(dt,th?"vaitroTH":"vaitro",x.value);if(f==="dangVideo")goiyAdd(dt,chOf(t.kenh).needId?"dd":"ddFB",x.value)});toast("Đã lưu");renderMain()});
  b.querySelectorAll("[data-tnew]").forEach(x=>x.onclick=()=>{const [sku,kenh]=x.dataset.tnew.split("|"),f=x.closest(".ptadd"),tu=f.querySelector(".nt").value.trim();if(!tu){toast("Chọn tuyến nội dung");f.querySelector(".nt").focus();return}
    DB.mutate(ME.name,"thêm tuyến "+tu,dt=>{ptEnsure(dt,sku,kenh);const th=sku==="TH";goiyAdd(dt,th?"tuyenTH":"tuyen",tu);goiyAdd(dt,th?"vaitroTH":"vaitro",f.querySelector(".nv").value);goiyAdd(dt,chOf(kenh).needId?"dd":"ddFB",f.querySelector(".nd").value);const n=dt.tuyen.filter(t=>t.sku===sku).length+1;let ma=`T${MONTH.mon}-${sku}-${String(n).padStart(2,"0")}`;while(dt.tuyen.some(t=>t.ma===ma))ma+="b";dt.tuyen.push({ma,kenh,sku,tuyen:tu,vaiTro:f.querySelector(".nv").value.trim(),kh:0,dangVideo:f.querySelector(".nd").value,nguoi:"",kiemChung:"Giả thuyết",maInsight:"",ghiChu:""})});PT_OPEN.add(x.dataset.tnew);toast("Đã thêm tuyến "+tu);renderMain()});
  b.querySelectorAll("[data-tps]").forEach(x=>x.onclick=()=>{const t=D().tuyen[+x.dataset.tps];let id;DB.mutate(ME.name,"video phát sinh tuyến "+t.ma,dt=>{const c=newCard(dt,{sku:t.sku,kenh:t.kenh,maTuyen:t.ma,day:dt.settings.today,nguon:"Quay mới",loai:"moi",dangVideo:t.dangVideo||undefined,phatSinh:true});dt.cards.push(c);id=c.id});toast("Đã ghi 1 video phát sinh ("+id+"), giao người làm ở Xếp việc tuần");renderMain()});
  b.querySelectorAll("[data-tdel2]").forEach(x=>x.onclick=()=>{if(x.dataset.ok){DB.mutate(ME.name,"xóa tuyến",dt=>dt.tuyen.splice(+x.dataset.tdel2,1));renderMain()}else{x.dataset.ok=1;x.textContent="Bấm lần nữa để xóa"}});
  b.querySelectorAll("[data-pkpi]").forEach(x=>x.onchange=()=>{const [sku,kenh]=x.dataset.pkpi.split("|");DB.mutate(ME.name,"đặt KPI số video "+sk(sku).n+" · "+kenh,dt=>{const p=dt.products.find(y=>y.k===sku);if(!p)return;p.kenhs=pKenhs(p).map(e=>e.kenh===kenh?Object.assign({},e,{sl:Math.max(0,+x.value||0)}):e)});toast("Đã lưu KPI");renderMain()});
  if($("#pt-ed"))$("#pt-ed").onclick=()=>{PT_ED=!PT_ED;renderMain()};
  b.querySelectorAll("[data-gyclose]").forEach(x=>x.onclick=()=>{PT_ED=false;renderMain();const s=$("#ptsec");if(s)s.scrollIntoView({block:"start"})});
  b.querySelectorAll("[data-gya]").forEach(x=>x.onclick=()=>{const k=x.dataset.gya,i=b.querySelector(`.gyi[data-gyk="${k}"]`),v=i.value.trim();if(!v){toast("Gõ mục mới trước");i.focus();return}let ok=false;DB.mutate(ME.name,"thêm gợi ý "+v,dt=>{ok=goiyAdd(dt,k,v)});toast(ok?"Đã thêm "+v:"Mục này đã có");renderMain()});
  b.querySelectorAll(".gyi").forEach(i=>i.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();b.querySelector(`[data-gya="${i.dataset.gyk}"]`).click()}});
  b.querySelectorAll("[data-gyx]").forEach(x=>x.onclick=()=>{const [k,i]=x.dataset.gyx.split("|");DB.mutate(ME.name,"bỏ gợi ý",dt=>{dt.settings.goiy=dt.settings.goiy||{};const L=(Array.isArray(dt.settings.goiy[k])?dt.settings.goiy[k]:GOIY_DEF[k]).slice();L.splice(+i,1);dt.settings.goiy[k]=L});renderMain()});
  if($("#pt-pub"))$("#pt-pub").onclick=()=>{let n=0;DB.mutate(ME.name,"phát hành thẻ",dt=>{n=publishPlan(dt)});toast("Đã chốt kế hoạch gốc tháng "+MONTH.mon+". Thay đổi giữa tháng làm ở Điều chỉnh kế hoạch.");renderMain()};
}
/* Thay bảng Pillar và bảng Tuyến cũ bằng khối Pillar & tuyến theo kênh (giữ ① Sản phẩm của hàm cũ) */
const _lichPillarOld=lichPillar;
lichPillar=function(b){_lichPillarOld(b);[...b.querySelectorAll("section.card")].slice(1).forEach(s=>s.remove());const ed=can(ME,"kehoach.sua");b.insertAdjacentHTML("beforeend",ptHtml(D(),ed));ptBind(b);bindCommon(b)};
