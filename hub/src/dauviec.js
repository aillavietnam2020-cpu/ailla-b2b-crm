/* =====================================================================
   ĐẦU VIỆC: luồng từ mục tiêu → sản phẩm đẩy → trừ tồn → sản xuất mới → đầu việc theo đợt → thẻ video → đã đăng.
   Mỗi đầu việc là một "đợt": làm gì, cho sản phẩm nào, bao nhiêu video, ai làm (một hay nhiều người), từ ngày nào đến ngày nào,
   làm sau đầu việc nào. Thẻ video và Giao việc từng video vẫn chạy như cũ bên dưới.
   ===================================================================== */
const DV_L=[["hook","Làm hook"],["quay","Quay một ngày"],["kichban","Viết kịch bản"],["nhanban","Nhân bản video win"],["loc","Lọc video tồn"],["worker","Order Worker"],["edit","Edit"],["khac","Việc khác"]];
const DV_ST=[["chua","Chưa làm"],["dang","Đang làm"],["xong","Xong"]];
const dvLbl=k=>(DV_L.find(z=>z[0]===k)||[])[1]||k;
const dvList=d=>(d.dauViec||[]).slice().sort((a,b)=>(+a.bd||99)-(+b.bd||99)||(+a.kt||99)-(+b.kt||99));
const dvOpenN=d=>(d.dauViec||[]).filter(v=>v.st!=="xong").length;
/* bảng luồng: mỗi kênh một hàng, mỗi giai đoạn một cột (mục tiêu → đẩy → tồn → mới → đã giao → có video → đã đăng) */
function dvFlow(d){
  const rows=CHANNELS.map(ch=>{
    const pr=ptPairs().filter(x=>x.kenh===ch.k&&knShown(d,x));if(!pr.length)return null;
    const K=kn(d,ch.k),day=sum(pr,x=>+x.sl||0),ton=sum(pr,x=>Math.min(+x.ton||0,+x.sl||0)),moi=sum(pr,x=>Math.max(0,(+x.sl||0)-(+x.ton||0)));
    const C=d.cards.filter(c=>c.kenh===ch.k&&c.mix!=="ton"),giao=C.length,co=C.filter(c=>VID_STEPS.includes(c.step)).length,dang=C.filter(c=>c.step==="xong").length;
    const pc=n=>moi?Math.round(n/moi*100)+"%":"";
    return {ch,cells:[K.T,day,ton,moi,giao,co,dang],pct:["","","","",pc(giao),pc(co),pc(dang)]}}).filter(Boolean);
  if(!rows.length)return "";
  const H=["Mục tiêu kênh","Sản phẩm đẩy","Tồn dùng được","Sản xuất mới","Đã giao thẻ","Đã có video","Đã đăng"];
  const tot=H.map((_,i)=>sum(rows,r=>r.cells[i]));
  return `<div class="tbl"><table class="dvft"><thead><tr><th>Kênh</th>${H.map((h,i)=>`<th class="n${i===3?" key":""}">${h}</th>`).join("")}</tr></thead><tbody>
   ${rows.map(r=>`<tr><td><b>${esc(r.ch.short)}</b></td>${r.cells.map((n,i)=>`<td class="n${i===3?" key":""}"><b>${n}</b>${r.pct[i]?`<small>${r.pct[i]}</small>`:""}</td>`).join("")}</tr>`).join("")}
   <tr class="knt"><td><b>Cộng</b></td>${tot.map((n,i)=>`<td class="n${i===3?" key":""}"><b>${n}</b></td>`).join("")}</tr></tbody></table></div>`
}
/* Đủ video đăng không: mỗi ngày mỗi kênh cần bao nhiêu video (theo nhịp mục tiêu) so với số video đã xếp lịch, báo ngày trống và ngày thiếu */
function dvCover(d,span){
  const td=d.settings.today,end=Math.min(MONTH.ndays,td+span-1),dayArr=[];for(let x=td;x<=end;x++)dayArr.push(x);
  const out=[];
  CHANNELS.forEach(ch=>{const pr=knPairs(d,ch.k);if(!pr.length)return;const K=kn(d,ch.k);if(!(K.T>0))return;
    const req=x=>Math.max(1,Math.round(knIsSale(K,x)?K.rS:K.rN)),cells=dayArr.map(x=>{const sch=d.cards.filter(c=>c.kenh===ch.k&&c.day===x).length,r=req(x);return {x,sch,r,cls:sch===0?"e0":sch<r?"lo":"ok"}});
    const empty=cells.filter(c=>c.cls==="e0").length,gap=sum(cells,c=>Math.max(0,c.r-c.sch));
    const C=d.cards.filter(c=>c.kenh===ch.k&&!c.day),dangRe=C.filter(c=>c.step==="dang").length,lamDo=C.filter(c=>["edit","worker","dvd","dceo"].includes(c.step)).length;
    out.push({ch,cells,empty,gap,dangRe,lamDo})});
  return out
}
function dvCoverHtml(d,span){
  const R=dvCover(d,span);if(!R.length)return "";
  return `<section class="card dvcover"><div class="card-h"><h2>Đủ video đăng không? · ${span} ngày tới</h2><span class="hint">ô = số video đã xếp lịch / số cần mỗi ngày · đỏ là ngày trống, cam là ngày thiếu</span></div>
   ${R.map(r=>{const fix=r.dangRe>=r.gap;return `<div class="dvcv"><div class="dvcvh"><b>${esc(r.ch.short)}</b>${r.gap?(`<span class="${r.empty?"t-red":"t-amb"}">⚠ ${r.empty?r.empty+" ngày chưa có video nào · ":""}thiếu ${r.gap} video`)+`</span><small>${r.dangRe} video đã duyệt chưa xếp lịch${fix?" (xếp lịch ngay là đủ)":" (chưa đủ, cần làm thêm "+(r.gap-r.dangRe)+" video, đang làm dở "+r.lamDo+")"}</small>`:`<span class="t-grn">✓ đủ video ${span} ngày tới</span>`}</div>
     <div class="dvcells">${r.cells.map(c=>`<span class="dvcell ${c.cls}" title="${dd(c.x)}: đã xếp ${c.sch}, cần ${c.r}"><i>${dd(c.x).slice(0,5)}</i><b>${c.sch}/${c.r}</b></span>`).join("")}</div></div>`}).join("")}</section>`
}
function dvWarn(d,v,L){
  const td=d.settings.today,w=[];
  if(+v.bd&&+v.kt&&+v.kt<+v.bd)w.push("Ngày kết thúc trước ngày bắt đầu");
  if(v.st!=="xong"&&+v.kt&&+v.kt<td)w.push("Trễ hạn từ "+dd(+v.kt));
  const nguoi=v.nguoi||[];if(!nguoi.length&&v.st!=="xong")w.push("Chưa có người làm");
  if(v.sau){const x=L.find(z=>z.id===v.sau);if(x&&x.st!=="xong"&&+v.bd&&+x.kt&&+v.bd<=+x.kt)w.push("Bắt đầu "+dd(+v.bd)+" khi \""+x.ten+"\" chưa xong (kết thúc "+dd(+x.kt)+")")}
  nguoi.forEach(uid=>{const u=(d.users||[]).find(y=>y.id===uid);if(u&&typeof gvOf==="function"){const n=gvOf(d,u).nghi;if(n>0&&+v.kt>=n)w.push(u.name+" nghỉ từ "+dd(n)+", trước ngày kết thúc")}});
  return w
}
/* Trang Đầu việc kiểu Notion: một bảng gọn, bấm vào dòng nào thì mở trang chi tiết bên phải (nội dung, kịch bản, việc con) */
let DV_F={sp:"",ng:"",st:""},DV_ID=null;
const dvIni=n=>String(n||"").trim().split(/\s+/).slice(-1)[0]||"";
const dvDays=()=>[[0,"—"]].concat(Array.from({length:MONTH.ndays},(_,i)=>[i+1,dd(i+1)]));
function pDauViec(m){
  const d=D(),give=xvGive(),team=xvTeam(),all=dvList(d),td=d.settings.today;
  const L=all.filter(v=>(!DV_F.sp||v.sku===DV_F.sp)&&(!DV_F.st||(v.st||"chua")===DV_F.st)&&(!DV_F.ng||(v.nguoi||[]).includes(DV_F.ng)));
  const late=all.filter(v=>v.st!=="xong"&&+v.kt&&+v.kt<td).length,noP=all.filter(v=>v.st!=="xong"&&!(v.nguoi||[]).length).length;
  const stp={chua:"p-gry",dang:"p-blu",xong:"p-grn"};
  m.innerHTML=`<div class="ph"><h1>Đầu việc</h1></div>
  ${dvCoverHtml(d,14)}
  <section class="card"><div class="card-h"><h2>Luồng tháng ${MONTH.mon}</h2><span class="hint">sản xuất mới = sản phẩm đẩy trừ tồn dùng được</span></div>${dvFlow(d)||`<p class="empty pad">Chưa có kênh nào có KPI.</p>`}</section>
  <section class="card flush dvdb"><div class="dvbar"><b>Tất cả đầu việc</b><span class="hint">${all.length} việc${late?` · <span class="t-red">${late} trễ hạn</span>`:""}${noP?` · <span class="t-amb">${noP} chưa có người</span>`:""}</span><span class="sp"></span>
   <select data-dvfl="sp">${opt([["","Mọi sản phẩm"]].concat(d.products.map(p=>[p.k,sk(p.k).n])),DV_F.sp)}</select><select data-dvfl="ng">${opt([["","Mọi người"]].concat(team.map(u=>[u.id,u.name])),DV_F.ng)}</select><select data-dvfl="st">${opt([["","Mọi trạng thái"]].concat(DV_ST),DV_F.st)}</select></div>
   <table class="dvtab"><thead><tr><th></th><th>Tên</th><th>Sản phẩm</th><th>Người làm</th><th>Thời gian</th><th class="n">Video</th><th>Việc con</th></tr></thead><tbody>
   ${L.map(v=>{const W=dvWarn(d,v,all),vc=v.vc||[],ps=v.nguoi||[];
     return `<tr class="dvrow${v.st==="xong"?" done":""}" data-dvopen="${esc(v.id)}"><td><span class="pill ${stp[v.st||"chua"]}">${esc((DV_ST.find(z=>z[0]===(v.st||"chua"))||[])[1])}</span></td>
      <td class="dvn"><b>${esc(v.ten||"Chưa đặt tên")}</b><small>${esc(dvLbl(v.loai))}</small>${W.length?`<span class="dvwi" title="${esc(W.join(" · "))}">⚠</span>`:""}</td>
      <td>${v.sku?swatch(v.sku)+esc(sk(v.sku).n):'<span class="hint">chung</span>'}${v.kenh?`<small>${esc(chOf(v.kenh).short)}</small>`:""}</td>
      <td>${ps.length?ps.map(u=>`<span class="dvav">${esc(dvIni(userName(u)))}</span>`).join(""):'<span class="hint">chưa có</span>'}</td>
      <td class="nowrap">${+v.bd?dd(+v.bd):"—"}${+v.kt&&+v.kt!==+v.bd?" → "+dd(+v.kt):""}</td><td class="n">${+v.n||""}</td><td>${vc.length?vc.filter(x=>x.x).length+"/"+vc.length:""}</td></tr>`}).join("")||`<tr><td colspan="7" class="empty">${all.length?"Không có đầu việc nào khớp bộ lọc.":"Chưa có đầu việc nào. Thêm ở dòng bên dưới."}</td></tr>`}
   </tbody></table>
   ${give?`<div class="dvnew">${DV_L.map(z=>`<button type="button" class="dvnb" data-dvadd="${z[0]}">+ ${z[1]}</button>`).join("")}</div>`:""}</section>`;
  m.querySelectorAll("[data-dvfl]").forEach(s=>s.onchange=()=>{DV_F[s.dataset.dvfl]=s.value;renderMain()});
  m.querySelectorAll("[data-dvopen]").forEach(r=>r.onclick=()=>dvPeek(r.dataset.dvopen));
  m.querySelectorAll("[data-dvadd]").forEach(b=>b.onclick=()=>{const l=b.dataset.dvadd,id=uid("dv");DB.mutate(ME.name,"thêm đầu việc "+dvLbl(l),dt=>{dt.dauViec=dt.dauViec||[];dt.dauViec.push({id,loai:l,ten:dvLbl(l),sku:"",kenh:"",n:0,nguoi:[],bd:dt.settings.today,kt:dt.settings.today,sau:"",chiTiet:"",ghiChu:"",vc:[],st:"chua"})});renderMain();dvPeek(id)});
  if(DV_ID&&!$("#drawer").hidden)dvPeek(DV_ID)
}
/* trang chi tiết một đầu việc, mở ở khung bên phải */
function dvPeek(id){
  const d=D(),v=(d.dauViec||[]).find(x=>x.id===id);if(!v)return;DV_ID=id;
  const give=xvGive(),team=xvTeam(),all=dvList(d),ps=v.nguoi||[],vc=v.vc||[],W=dvWarn(d,v,all),dis=give?"":"disabled";
  const C=d.cards.filter(c=>(!v.sku||c.sku===v.sku)&&(!v.kenh||c.kenh===v.kenh)),by={};C.forEach(c=>{by[c.step]=(by[c.step]||0)+1});
  const prop=(l,h)=>`<div class="dvpr"><span>${l}</span><div>${h}</div></div>`;
  $("#drawerIn").innerHTML=`<div class="dh"><button class="btn sm" id="dx">Đóng</button><span class="sp"></span>${give?`<button type="button" class="lnk danger" data-dvdel="1">Xóa đầu việc</button>`:""}</div>
  <input class="dvtitle" data-dvf="ten" value="${esc(v.ten||"")}" placeholder="Tên đầu việc" ${dis}>
  <div class="dvprops">
   ${prop("Trạng thái",`<select data-dvf="st" ${dis}>${opt(DV_ST,v.st||"chua")}</select>`)}
   ${prop("Loại",`<select data-dvf="loai" ${dis}>${opt(DV_L,v.loai||"khac")}</select>`)}
   ${prop("Sản phẩm",`<select data-dvf="sku" ${dis}>${opt([["","Chung (nhiều sản phẩm)"]].concat(d.products.map(p=>[p.k,sk(p.k).n])),v.sku||"")}</select>`)}
   ${prop("Kênh",`<select data-dvf="kenh" ${dis}>${opt([["","Mọi kênh"]].concat(CHANNELS.map(c=>[c.k,c.short])),v.kenh||"")}</select>`)}
   ${prop("Số video",`<input type="number" min="0" class="num" data-dvf="n" value="${+v.n||0}" ${dis}>`)}
   ${prop("Giao cho",`<div class="dvpp">${team.map(u=>`<button type="button" class="gvchip${ps.includes(u.id)?" on":""}" data-dvp="${esc(u.id)}" ${dis}>${esc(u.name)}</button>`).join("")}<small>${ps.length?ps.length+" người":"chưa chọn"}</small></div>`)}
   ${prop("Thời gian",`<select data-dvf="bd" ${dis}>${opt(dvDays(),+v.bd||0)}</select> → <select data-dvf="kt" ${dis}>${opt(dvDays(),+v.kt||0)}</select>`)}
   ${prop("Làm sau việc",`<select data-dvf="sau" ${dis}>${opt([["","— không —"]].concat(all.filter(x=>x.id!==v.id).map(x=>[x.id,(x.bd?dd(+x.bd)+" · ":"")+x.ten])),v.sau||"")}</select>`)}
  </div>
  ${W.length?`<div class="dvw">${W.map(x=>`<span>⚠ ${esc(x)}</span>`).join("")}</div>`:""}
  <h3 class="dvh3">Nội dung</h3><textarea class="dvdoc" data-dvf="chiTiet" placeholder="Viết kịch bản, danh sách hook, hướng dẫn, link… ở đây như một trang Notion" ${dis}>${esc(v.chiTiet||"")}</textarea>
  <h3 class="dvh3">Việc con${vc.length?` <small>${vc.filter(x=>x.x).length}/${vc.length}</small>`:""}</h3>
  <div class="dvck">${vc.map((x,i)=>`<label class="${x.x?"x":""}"><input type="checkbox" data-vct="${i}" ${x.x?"checked":""} ${dis}><span>${esc(x.t)}</span>${give?`<button type="button" class="lnk" data-vcd="${i}">✕</button>`:""}</label>`).join("")}${give?`<input class="dvck-in" data-vca="1" placeholder="+ Thêm việc con rồi Enter">`:""}</div>
  <h3 class="dvh3">Chú thích</h3><textarea class="dvnote" data-dvf="ghiChu" rows="2" placeholder="Chú thích" ${dis}>${esc(v.ghiChu||"")}</textarea>
  <h3 class="dvh3">Video liên quan <small>${C.length}</small></h3>
  <p class="hint">${C.length?STEPS.filter(s=>by[s.id]).map(s=>s.t+" "+by[s.id]).join(" · "):"Chưa có video nào cho sản phẩm và kênh này."}</p>
  ${C.length?`<button type="button" class="btn sm ghost" data-dvgo="1">Mở danh sách video</button>`:""}`;
  $("#drawer").hidden=false;
  const drw=$("#drawerIn"),redo=()=>{renderMain();dvPeek(id)},mut=(fn,msg)=>DB.mutate(ME.name,msg||"sửa đầu việc",dt=>{const x=(dt.dauViec||[]).find(y=>y.id===id);if(x)fn(x,dt)});
  const fit=x=>{x.style.height="auto";x.style.height=Math.max(x.classList.contains("dvdoc")?220:56,x.scrollHeight+2)+"px"};drw.querySelectorAll("textarea").forEach(x=>{fit(x);x.addEventListener("input",()=>fit(x))});
  $("#dx").onclick=()=>{DV_ID=null;closeDrawer()};
  drw.querySelectorAll("[data-dvf]").forEach(i=>i.onchange=()=>{const f=i.dataset.dvf;mut(x=>{if(["n","bd","kt"].includes(f))x[f]=Math.max(0,Math.floor(+i.value||0));else x[f]=i.value;if(f==="bd"&&+x.kt&&+x.kt<+x.bd)x.kt=x.bd});redo()});
  drw.querySelectorAll("[data-dvp]").forEach(b=>b.onclick=()=>{const u=b.dataset.dvp;mut(x=>{x.nguoi=x.nguoi||[];x.nguoi=x.nguoi.includes(u)?x.nguoi.filter(z=>z!==u):x.nguoi.concat([u])},"đổi người làm đầu việc");redo()});
  drw.querySelectorAll("[data-vct]").forEach(i=>i.onchange=()=>{const k=+i.dataset.vct;mut(x=>{if(x.vc&&x.vc[k])x.vc[k].x=i.checked});redo()});
  drw.querySelectorAll("[data-vcd]").forEach(b=>b.onclick=()=>{const k=+b.dataset.vcd;mut(x=>{x.vc=(x.vc||[]).filter((_,j)=>j!==k)});redo()});
  const va=drw.querySelector("[data-vca]");if(va)va.onkeydown=e=>{if(e.key!=="Enter")return;e.preventDefault();const t=va.value.trim();if(!t)return;mut(x=>{x.vc=(x.vc||[]).concat([{t,x:false}])});redo();const n=drw.querySelector("[data-vca]");if(n)n.focus()};
  const del=drw.querySelector("[data-dvdel]");if(del)del.onclick=()=>{if(!confirm("Xóa đầu việc này?"))return;DB.mutate(ME.name,"xóa đầu việc",dt=>{dt.dauViec=(dt.dauViec||[]).filter(x=>x.id!==id)});DV_ID=null;closeDrawer();renderMain()};
  const go=drw.querySelector("[data-dvgo]");if(go)go.onclick=()=>{DV_ID=null;closeDrawer();if(v.kenh)DP.kenh=v.kenh;if(v.sku)DP.sku=v.sku;DP.tuyen="";DP.step="";DP.view="buoc";DP.sel.clear();MOD="mkt";PAGE="dieuphoi";render();scrollTo(0,0)}
}
PAGES.dau_viec=pDauViec;
