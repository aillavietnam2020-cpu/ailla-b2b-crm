/* =====================================================================
   DIGITAL MARKETING (team Ads): thư viện video quảng cáo, tổng quan, Livestream (chưa làm)
   Nguồn video trong thư viện:
   - Content sx: video content đã qua bước duyệt cuối (Chờ đăng trở đi) tự sang, ads thấy hết
   - KOC: video KOC có trong báo cáo tự sang
   - Digital sx: team ads tự thêm, không cần ai giao việc
   Tín hiệu theo số đơn trong báo cáo TikTok: từ 20 đơn là xanh, từ 100 đơn là Win.
   ===================================================================== */
const DG={q:"",sku:"",nguon:"",tt:"",tin:"",ns:""};
const DG_TT=["Đang test","Scale","Đã dừng","Chưa dùng"];
const DG_ST=[["","—"],["Đang test","Đang test"],["Scale","Scale"],["Đã dừng","Đã dừng"]];
/* mỗi creative có trạng thái RIÊNG cho từng người ads (st[mã người] = Đang test / Scale / Đã dừng); trạng thái chung lấy theo ưu tiên Scale > Đang test > Đã dừng */
const dgLegacy={"Test":"Đang test","Đang chạy":"Scale","Đã dừng":"Đã dừng"};
function dgSt(m,tt0){if(m.st)return m.st;const o={};(m.dung||[]).forEach(u=>{o[u]=dgLegacy[m.tt||tt0||"Test"]||"Đang test"});return o}
function dgAll(st){const v=Object.values(st||{}).filter(Boolean);return v.includes("Scale")?"Scale":v.includes("Đang test")?"Đang test":v.includes("Đã dừng")?"Đã dừng":"Chưa dùng"}
const dgTin=n=>(+n||0)>=100?"win":(+n||0)>=20?"xanh":"";
const dgAds=()=>(D().users||[]).filter(u=>u.active!==false&&u.role==="digital"&&u.id!=="u_digital");
/* gom mọi video thành một danh sách thống nhất */
function dgRows(){
  const d=D(),M=d.adsMeta||{},out=[],lk=u=>u?(/^https?:/.test(u)?u:"https://"+u):"";
  d.cards.forEach(c=>{
    if(c.repostOf||!["dang","xong"].includes(c.step))return;
    const key=c.id,m=M[key]||{};
    out.push({key,ma:c.id,sku:c.sku,nguon:"Content sx",order:c.order||"",hook:c.hookText||c.yTuong||"",link:lk(c.linkFinal||c.linkVideo),post:lk(c.linkDang||(c.tiktokId?"https://www.tiktok.com/video/"+c.tiktokId:"")),sx:userName(c.nguoiEdit||c.nguoiKB||c.nguoi)||"",ngay:c.step==="xong"?(+c.ngayDang||0):0,cho:c.step==="dang",don:+c.don||0,gmv:+c.gmv||0,st:dgSt(m),tt:dgAll(dgSt(m)),winAds:!!m.winAds,fb:m.fb||[],ghi:m.ghi||""})});
  (d.adsLib||[]).forEach(a=>{const key=a.id,m=M[key]||{};
    out.push({key,ma:a.id,sku:a.sku,nguon:a.nguon||"Digital sx",order:"",hook:a.hook||"",link:lk(a.link),post:lk(a.post),sx:userName(a.nguoi)||a.nguoi||"",ngay:+a.ngay||0,cho:false,don:+a.don||0,gmv:+a.gmv||0,st:dgSt(m,a.tt),tt:dgAll(dgSt(m,a.tt)),winAds:!!m.winAds,fb:m.fb||[],ghi:m.ghi||a.ghi||""})});
  (d.kocVideos||[]).forEach(v=>{const key="koc:"+v.id,m=M[key]||{};
    out.push({key,ma:"KOC-"+String(v.id).slice(-6),sku:v.sku||"",nguon:"KOC",order:"",hook:v.ten||"",link:"",post:v.acc?"https://www.tiktok.com/@"+v.acc+"/video/"+v.id:"",sx:v.acc?"@"+v.acc:"",ngay:0,cho:false,don:+v.don||0,gmv:+v.gmv||0,st:dgSt(m),tt:dgAll(dgSt(m)),winAds:!!m.winAds,fb:m.fb||[],ghi:m.ghi||""})});
  return out
}
function dgSet(key,patch){DB.mutate(ME.name,"cập nhật thư viện video ads "+key,dt=>{dt.adsMeta=dt.adsMeta||{};dt.adsMeta[key]=Object.assign(dt.adsMeta[key]||{},patch)})}
function pDgLib(m){
  const d=D(),all=dgRows(),ads=dgAds(),lead=ME.role==="admin"||ME.role==="lead"||ME.role==="digital"||can(ME,"order.sua");
  const fq=bkFold(DG.q),skus=[...new Set(all.map(r=>r.sku))].filter(Boolean);
  const L=all.filter(r=>(!DG.sku||r.sku===DG.sku)&&(!DG.nguon||r.nguon===DG.nguon)&&(!DG.tt||r.tt===DG.tt)&&(!DG.tin||dgTin(r.don)===DG.tin)&&(!DG.ns||r.st[DG.ns]||r.fb.some(f=>f.nguoi===DG.ns)||r.sx===((ads.find(u=>u.id===DG.ns)||{}).name))&&(!fq||[r.ma,r.hook,r.sx,r.ghi,r.link,r.post,sk(r.sku).n].some(x=>x&&bkFold(x).includes(fq)))).sort((a,b)=>(b.don-a.don)||String(b.ma).localeCompare(String(a.ma)));
  const cnt=t=>all.filter(r=>r.tt===t).length,nW=all.filter(r=>dgTin(r.don)==="win").length,nX=all.filter(r=>dgTin(r.don)==="xanh").length;
  const tinP=r=>{const t=dgTin(r.don);return t==="win"?pill("Win","pnk"):t==="xanh"?pill("Tín hiệu xanh","grn"):"—"};
  const row=r=>`<tr data-dgr="${esc(r.key)}"><td class="mono">${esc(r.ma)}${r.order?`<small class="fpmt">${esc(r.order)}</small>`:""}</td><td>${swatch(r.sku)}${esc(sk(r.sku).n)}</td><td>${esc(r.nguon)}</td>
    <td>${r.link?`<a href="${esc(r.link)}" target="_blank" rel="noopener" title="Video gốc">▶</a>`:"—"}${r.post?` <a href="${esc(r.post)}" target="_blank" rel="noopener" title="Bài đăng">↗</a>`:""}</td>
    <td>${esc(r.sx||"—")}</td>
    <td>${tinP(r)}</td>
    <td><button type="button" class="btn sm${r.fb.length?"":" ghost"}" data-dgfb="${esc(r.key)}">${r.fb.length?"Đã đăng "+r.fb.length+" trang":"+ Link bài đăng"}</button></td>
    ${ads.map(u=>`<td><select class="dgst dgst-${({"Đang test":"t","Scale":"s","Đã dừng":"d"})[r.st[u.id]]||"n"}" data-dgs="${esc(r.key)}|${esc(u.id)}" ${lead?"":"disabled"}>${opt(DG_ST,r.st[u.id]||"")}</select></td>`).join("")}
    <td><input class="bvhook" data-dgg="${esc(r.key)}" value="${esc(r.ghi)}" placeholder="Ghi chú…" ${lead?"":"disabled"}></td></tr>`;
  m.innerHTML=H("Thư viện video quảng cáo","Video content được duyệt tự sang đây · video KOC có báo cáo tự sang · team Ads tự thêm video làm riêng")+
   `<div class="grid kpis">${kpi("Tổng video",all.length)}${kpi("Đang test",cnt("Đang test"))}${kpi("Scale",cnt("Scale"),"","var(--green)")}${kpi("Đã dừng",cnt("Đã dừng"))}${kpi("Tín hiệu xanh · TikTok (≥20 đơn)",nX,"","var(--green)")}${kpi("Win · TikTok (≥100 đơn)",nW,"","var(--pink,#d6336c)")}</div>
   <section class="card flush"><div class="pad sxfil dgbar"><input type="search" class="ksearch" id="dg-q" value="${esc(DG.q)}" placeholder="🔍 Tìm: mã, hook, người làm, link…"><select data-dgf="sku">${opt([["","Mọi sản phẩm"]].concat(skus.map(s=>[s,sk(s).n])),DG.sku)}</select><select data-dgf="nguon">${opt([["","Mọi nguồn"],["Content sx","Content sx"],["Digital sx","Digital sx"],["KOC","KOC"]],DG.nguon)}</select><select data-dgf="tt">${opt([["","Mọi trạng thái"]].concat(DG_TT.map(x=>[x,x])),DG.tt)}</select><select data-dgf="ns">${opt([["","Mọi nhân sự Ads"]].concat(ads.map(u=>[u.id,u.name])),DG.ns)}</select><select data-dgf="tin">${opt([["","Mọi tín hiệu"],["win","Win"],["xanh","Tín hiệu xanh"]],DG.tin)}</select><span class="hint">${L.length} video</span><span class="sp"></span><button type="button" class="btn sm pri" id="dg-add">+ Thêm video</button><button type="button" class="btn sm" id="dg-x">⬇ Xuất Excel</button></div>
   <div class="tbl bvscroll"><table class="kstab dgtab pn12"><thead><tr><th>Mã</th><th>Sản phẩm</th><th>Nguồn</th><th>Video</th><th>Người làm</th><th>Tín hiệu TikTok</th><th>Bài đăng Facebook</th>${ads.map(u=>`<th class="dgph" title="Trạng thái creative của ${esc(u.name)}">${esc(u.name.split(" ").pop())}</th>`).join("")}<th>Ghi chú</th></tr></thead><tbody>${L.slice(0,300).map(row).join("")||'<tr><td colspan="11" class="empty">Chưa có video nào khớp.</td></tr>'}</tbody></table></div>${L.length>300?`<p class="hint pad">Hiện 300/${L.length} video đầu, lọc để xem tiếp.</p>`:""}</section>`;
  const qi=m.querySelector("#dg-q");if(qi){const go=()=>{if(qi.value.trim()===DG.q)return;DG.q=qi.value.trim();renderMain()};qi.onkeydown=e=>{if(e.key==="Enter")go()};qi.onchange=go}
  m.querySelectorAll("[data-dgf]").forEach(s=>s.onchange=()=>{DG[s.dataset.dgf]=s.value;renderMain()});
  m.querySelectorAll("[data-dgs]").forEach(s=>s.onchange=()=>{const [key,uid]=s.dataset.dgs.split("|"),r=dgRows().find(x=>x.key===key),st=Object.assign({},r?r.st:{});if(s.value)st[uid]=s.value;else delete st[uid];dgSet(key,{st});renderMain()});
  m.querySelectorAll("[data-dgfb]").forEach(b=>b.onclick=()=>dgFb(b.dataset.dgfb));
  m.querySelectorAll("[data-dgw]").forEach(i=>i.onchange=()=>{dgSet(i.dataset.dgw,{winAds:i.checked});renderMain()});
  m.querySelectorAll("[data-dgg]").forEach(i=>i.onchange=()=>dgSet(i.dataset.dgg,{ghi:i.value.trim()}));
  m.querySelectorAll("[data-dgd]").forEach(i=>i.onchange=()=>{const [key,uid]=i.dataset.dgd.split("|"),cur=((D().adsMeta||{})[key]||{}).dung||[],nx=i.checked?cur.concat([uid]).filter((x,k,a)=>a.indexOf(x)===k):cur.filter(x=>x!==uid);dgSet(key,{dung:nx})});
  const ex=m.querySelector("#dg-x");if(ex)ex.onclick=()=>xlsExport("thu-vien-video-ads","Thư viện video ads",["Mã","Sản phẩm","Nguồn","Hook / tên","Link video","Link bài đăng","Người làm","Ngày đăng"].concat(ads.map(u=>u.name)).concat(["Bài đăng Facebook","Trạng thái chung","Tín hiệu TikTok","Ghi chú"]),L.map(r=>[r.ma,sk(r.sku).n,r.nguon,r.hook,r.link,r.post,r.sx,r.cho?"Chờ đăng":xlD(r.ngay)].concat(ads.map(u=>r.st[u.id]||"")).concat([r.fb.map(f=>(f.trang||f.nguoi)+": "+f.link).join(" | "),r.tt,dgTin(r.don)==="win"?"Win":dgTin(r.don)==="xanh"?"Xanh":"",r.ghi])));
  const ad=m.querySelector("#dg-add");if(ad)ad.onclick=dgAdd;
  bindCommon(m)
}
/* team Ads tự thêm video làm riêng, không cần ai giao việc */
function dgAdd(){
  const d=D(),prods=d.products.map(p=>[p.k,p.n]),ads=dgAds();
  const ov=document.createElement("div");ov.className="wpmodal";
  ov.innerHTML=`<div class="wpmbox"><div class="wpmh"><b>Thêm video</b><button type="button" class="lnk" data-rx="1">✕ Đóng</button></div><p class="hint">Video team Ads tự làm hoặc tự lấy về từ KOC. Dán link Drive, mỗi dòng một link nếu thêm nhiều video cùng sản phẩm. Link trùng web bỏ qua và báo số lượng.</p>
   <label class="field">Nguồn<select id="dga-g">${opt([["Digital sx","Digital tự làm"],["KOC","KOC (Digital tự lấy về)"]],"Digital sx")}</select></label>
   <label class="field">Sản phẩm<select id="dga-s">${opt(prods,prods[0]&&prods[0][0])}</select></label>
   <label class="field">Người làm<select id="dga-n">${opt(ads.map(u=>[u.id,u.name]),(ads.find(u=>u.id===ME.id)||ads[0]||{}).id)}</select></label>
   <label class="field">Hook / tên video (nếu thêm một video)<input id="dga-h" placeholder="Ví dụ: Một lọ, tất cả…"></label>
   <label class="field">Link video Drive (một hoặc nhiều dòng)<textarea id="dga-l" rows="6" placeholder="https://drive.google.com/…"></textarea></label>
   <div class="acts"><button type="button" class="btn ghost" data-rx="1">Hủy</button><button type="button" class="btn pri" id="dga-ok">Thêm vào thư viện</button></div></div>`;
  document.body.appendChild(ov);ov.querySelectorAll("[data-rx]").forEach(x=>x.onclick=()=>ov.remove());
  ov.querySelector("#dga-ok").onclick=()=>{
    const nguon=ov.querySelector("#dga-g").value,sku=ov.querySelector("#dga-s").value,nguoi=ov.querySelector("#dga-n").value,hook=ov.querySelector("#dga-h").value.trim(),links=(ov.querySelector("#dga-l").value.match(/https?:\/\/\S+/g)||[]).map(x=>x.replace(/[),.;]+$/,""));
    if(!links.length){toast("Dán link video Drive");return}
    const seen=new Set(),ok=[];let dup=0;
    links.forEach(l=>{const key=linkKey(l);if(seen.has(key)||dupFind(l,[])||(D().adsLib||[]).some(a=>a.link&&linkKey(a.link)===key)){dup++;return}seen.add(key);ok.push(l)});
    if(!ok.length){ov.remove();alert("Không có video nào để thêm.\nBỏ qua vì TRÙNG LINK: "+dup+" video");return}
    DB.mutate(ME.name,"thêm "+ok.length+" video vào thư viện ads",dt=>{dt.adsLib=dt.adsLib||[];ok.forEach(l=>{const n=dt.adsLib.length+1;dt.adsLib.push({nguon,id:"AD-"+String(n).padStart(4,"0")+(dt.adsLib.some(a=>a.id==="AD-"+String(n).padStart(4,"0"))?"-"+Date.now()%1000:""),sku,link:l,hook:ok.length===1?hook:"",nguoi,ngay:dt.settings.today,tt:"Test"})})});
    ov.remove();renderMain();toast("Đã thêm "+ok.length+" video"+(dup?", bỏ qua "+dup+" video trùng":""));
    if(dup)alert("Đã thêm "+ok.length+" video.\nBỏ qua vì TRÙNG LINK: "+dup+" video")}
}
/* mỗi người ads đăng video lên trang Facebook riêng của mình: gắn link bài đăng vào đúng video, không thêm video mới */
function dgFb(key){
  const ads=dgAds(),lead=ME.role==="admin"||ME.role==="lead"||can(ME,"order.sua");
  const ov=document.createElement("div");ov.className="wpmodal";document.body.appendChild(ov);
  const draw=()=>{
    const r=dgRows().find(x=>x.key===key);if(!r){ov.remove();return}
    ov.innerHTML=`<div class="wpmbox"><div class="wpmh"><b>Bài đăng Facebook · ${esc(r.ma)}</b><button type="button" class="lnk" data-rx="1">✕ Đóng</button></div><p class="hint">${esc(r.hook||"")} Mỗi người đăng video này lên trang của mình rồi dán link bài đăng vào đây.</p>
     <div class="tbl"><table class="kstab"><thead><tr><th>Người đăng</th><th>Link bài</th><th>Ngày</th><th></th></tr></thead><tbody>${r.fb.map((f,i)=>`<tr><td>${esc(userName(f.nguoi)||f.nguoi||"—")}</td><td><a href="${esc(f.link)}" target="_blank" rel="noopener">Mở bài ↗</a></td><td>${+f.ngay?xlD(f.ngay):"—"}</td><td>${lead||f.nguoi===ME.id?`<button type="button" class="lnk" data-fbx="${i}">Xóa</button>`:""}</td></tr>`).join("")||'<tr><td colspan="4" class="empty">Chưa ai đăng.</td></tr>'}</tbody></table></div>
     <label class="field">Người đăng<select id="fb-n">${opt(ads.map(u=>[u.id,u.name]),(ads.find(u=>u.id===ME.id)||ads[0]||{}).id)}</select></label>
     <label class="field">Link bài đăng<input id="fb-l" placeholder="https://www.facebook.com/…"></label>
     <div class="acts"><button type="button" class="btn ghost" data-rx="1">Đóng</button><button type="button" class="btn pri" id="fb-ok">Lưu link bài đăng</button></div></div>`;
    ov.querySelectorAll("[data-rx]").forEach(x=>x.onclick=()=>{ov.remove();renderMain()});
    ov.querySelectorAll("[data-fbx]").forEach(x=>x.onclick=()=>{const i=+x.dataset.fbx;DB.mutate(ME.name,"xóa link bài đăng FB "+key,dt=>{const m=(dt.adsMeta=dt.adsMeta||{})[key]=dt.adsMeta[key]||{};m.fb=(m.fb||[]).filter((_,k)=>k!==i)});draw()});
    ov.querySelector("#fb-ok").onclick=()=>{
      const nguoi=ov.querySelector("#fb-n").value,trang="",link=(ov.querySelector("#fb-l").value.match(/https?:\/\/\S+/)||[""])[0].replace(/[),.;]+$/,"");
      if(!link){toast("Dán link bài đăng");return}
      const k=linkKey(link),dup=dgRows().some(x=>x.fb.some(f=>linkKey(f.link)===k));
      if(dup||dupFind(link,[])){alert("Link này đã có trong web, không lưu lại lần nữa.");return}
      DB.mutate(ME.name,"thêm link bài đăng FB "+key,dt=>{const m=(dt.adsMeta=dt.adsMeta||{})[key]=dt.adsMeta[key]||{};m.fb=(m.fb||[]).concat([{nguoi,trang,link,ngay:dt.settings.today}])});
      toast("Đã lưu link bài đăng");draw()}
  };
  draw()
}
PAGES.dg_lib=pDgLib;
/* tổng quan Digital (demo) */
function pDgTq(m){
  const d=D(),all=dgRows(),ads=dgAds(),O=d.orders||[],td=d.settings.today;
  const per=u=>all.filter(r=>r.st&&r.st[u.id]);
  m.innerHTML=H("Tổng quan Digital","Bản demo · số liệu chi phí, đơn theo creative sẽ gắn khi nối báo cáo Ads (API Facebook)")+
   `<div class="grid kpis">${kpi("Video trong thư viện",all.length)}${kpi("Scale",all.filter(r=>r.tt==="Scale").length,"","var(--green)")}${kpi("Win TikTok",all.filter(r=>dgTin(r.don)==="win").length)}${kpi("Order đang chờ Content",O.filter(o=>o.trangThai!=="Xong").length,"",O.some(o=>o.trangThai!=="Xong"&&o.han<td)?"var(--red)":"")}</div>
   <section class="card flush"><div class="card-h pad"><h2>Creative của từng người</h2><span class="hint">chọn trạng thái của người đó ở Thư viện video quảng cáo là tính cho người đó</span></div><div class="tbl"><table class="kstab"><thead><tr><th>Người</th><th class="n">Creative đang dùng</th><th class="n">Scale</th><th class="n">Đang test</th><th class="n">Đã dừng</th></tr></thead><tbody>${ads.map(u=>{const p=per(u);return `<tr><td><b>${esc(u.name)}</b></td><td class="n">${p.length}</td><td class="n">${p.filter(r=>r.st[u.id]==="Scale").length}</td><td class="n">${p.filter(r=>r.st[u.id]==="Đang test").length}</td><td class="n">${p.filter(r=>r.st[u.id]==="Đã dừng").length}</td></tr>`}).join("")||'<tr><td colspan="5" class="empty">Chưa có nhân sự Ads.</td></tr>'}</tbody></table></div></section>
   <div class="acts" style="padding:0 4px"><button class="btn pri" data-go="dg_lib">Mở Thư viện video quảng cáo</button><button class="btn" data-go="order">Order cho Content</button></div>`;
  bindCommon(m)
}
PAGES.dg_tq=pDgTq;
/* Livestream: chưa làm, chừa chỗ trên menu */
PAGES.live=function(m){m.innerHTML=H("Livestream","Đang xây · chưa có chức năng")+`<section class="card"><p>Khu Livestream sẽ có lịch live, kịch bản, kết quả từng buổi. Hiện đang chờ CEO chốt cách làm, chưa có gì để dùng.</p></section>`};

/* Theo dõi nhân bản: mỗi video win đã nhân bản thành bao nhiêu biến thể, hiệu quả thế nào */
const winVars=ref=>(D().cards||[]).filter(c=>!c.repostOf&&c.winSrc&&(c.winSrc===ref||"TT-"+c.winSrc===ref||c.winSrc===String(ref).replace(/^TT-/,"")));
function winVarCell(ref,old){
  const V=winVars(ref);if(!V.length)return old?String(old):"—";
  const dd2=V.filter(c=>c.step==="xong").length;
  return `<button type="button" class="lnk" data-wvar="${esc(ref)}" title="Xem các biến thể và hiệu quả"><b>${V.length}</b> biến thể · ${dd2} đã đăng</button>`
}
function winVarOpen(ref){
  const src=(typeof winSources==="function"?winSources():[]).find(x=>x.ref===ref)||{},V=winVars(ref),T=V.filter(c=>c.step==="xong"),thr=(D().settings||{}).potential||20;
  const sumD=T.reduce((a,c)=>a+(+c.don||0),0),sumG=T.reduce((a,c)=>a+(+c.gmv||0),0),sumV=T.reduce((a,c)=>a+(+c.view||0),0),ok20=T.filter(c=>(+c.don||0)>=20).length,ok100=T.filter(c=>(+c.don||0)>=100).length;
  const kl=T.length<3?"Chưa đủ dữ liệu: cần ít nhất 3 biến thể đã đăng và đã có số từ báo cáo TikTok.":ok20*2>=T.length?"Nhân bản hiệu quả: từ một nửa số biến thể đã đăng đạt từ 20 đơn. Nên nhân bản thêm.":"Nhân bản chưa hiệu quả: dưới một nửa số biến thể đạt 20 đơn. Cân nhắc đổi cách nhân bản.";
  openDrawerHTML(`<h2 class="dtitle">Nhân bản video win</h2><p class="hint"><b>${esc(src.ten||ref)}</b><br>${src.don?"Video gốc: "+nf(src.don)+" đơn · "+(src.gmv?money(src.gmv)+" GMV · ":"")+nf(src.view||0)+" view":"Chưa có số của video gốc"}</p>
   <div class="grid kpis" style="margin:10px 0">${kpi("Biến thể",V.length)}${kpi("Đã đăng",T.length,"","var(--green)")}${kpi("Tổng đơn",nf(sumD),money(sumG))}${kpi("TB đơn / biến thể",T.length?Math.round(sumD/T.length):"—")}${kpi("Từ 20 đơn",T.length?ok20+"/"+T.length:"—","","var(--green)")}${kpi("Từ 100 đơn (Win)",T.length?ok100+"/"+T.length:"—")}</div>
   <div class="rule"><b>Kết luận</b>${esc(kl)}</div>
   <div class="tbl"><table class="kstab"><thead><tr><th>Mã</th><th>Trạng thái</th><th>Kênh</th><th>Ngày đăng</th><th class="n">View</th><th class="n">Đơn</th><th class="n">GMV</th><th>Đánh giá</th></tr></thead><tbody>${V.map(c=>{const rt=typeof vidRate==="function"?vidRate(c):[];return `<tr class="clk" data-card="${esc(c.id)}"><td class="mono">${esc(c.id)}</td><td>${esc(stepName(c.step))}</td><td>${esc(chOf(c.kenh).short)}</td><td>${c.step==="xong"&&+c.ngayDang?xlD(c.ngayDang):"—"}</td><td class="n">${c.view?nf(c.view):"—"}</td><td class="n">${c.don?nf(c.don):"—"}</td><td class="n">${c.gmv?money(c.gmv):"—"}</td><td>${rt&&rt[0]?pill(rt[1],rt[0]):"—"}</td></tr>`}).join("")||'<tr><td colspan="8" class="empty">Chưa có biến thể nào. Content chọn video này ở dòng Nhân bản win trong tab ② Điều phối.</td></tr>'}</tbody></table></div><div class="acts"><button class="btn ghost" id="wv-x">Đóng</button></div>`);
  const x=document.querySelector("#drawerIn #wv-x");if(x)x.onclick=closeDrawer;bindCommon(document.querySelector("#drawerIn"))
}
if(!window._wvOn){window._wvOn=1;document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-wvar]");if(!b)return;e.preventDefault();e.stopPropagation();winVarOpen(b.dataset.wvar)},true)}
