/* =====================================================================
   VIDEO KOC RA SỐ (từ báo cáo TikTok Video Performance List)
   - Nhập báo cáo: video không phải của tài khoản shop = video KOC → lưu vào d.kocVideos (cập nhật số mỗi lần nhập).
   - Video KOC có đơn từ ngưỡng "tiềm năng" trở lên → báo Oanh + chị: check, cái nào ok đưa vào kho video win.
   - Trang KOC / Affiliate: bảng video KOC ra số; Oanh / chị bấm "Đưa vào kho video win" → vào Video win
     (nguồn KOC) để Hypit phân tích và nhân bản.
   ===================================================================== */
const KOC_KEEP=400;
const ownAccs=()=>{const s=D().settings.ownAccs;return (s&&s.length?s:CHANNELS.map(c=>c.acc).filter(a=>a&&!a.startsWith("("))).map(a=>String(a).replace(/^@/,"").toLowerCase())};
const kocLvl=v=>{const S=D().settings;return v.don>=(S.winnerOrders||100)?["Win","grn"]:v.don>=(S.potential||30)?["Tiềm năng","amb"]:v.don>0?["Có đơn","blu"]:["Chưa có đơn","gry"]};
const kocCan=()=>ME.role==="admin"||(ME.role==="lead"&&(ME.perms||[]).includes("viec.duyet"));
const kocLink=v=>v.acc?`https://www.tiktok.com/@${v.acc}/video/${v.id}`:`https://www.tiktok.com/video/${v.id}`;

/* Tách video KOC từ một file báo cáo (file KOC riêng, hoặc lẫn trong file của shop) */
function kocImport(u,res,quiet){
  const own=ownAccs(),isOwn=a=>{const x=String(a||"").replace(/^@/,"").toLowerCase();return own.includes(x)||/ailla/.test(x)},shopIds=new Set(D().cards.map(c=>c.tiktokId).filter(Boolean));
  const all=res.recs.filter(r=>r.id&&r.acc&&!isOwn(r.acc)&&!shopIds.has(r.id)),recs=all.filter(r=>r.don>0||r.view>=5000);
  if(!all.length){if(!quiet)toast("File này không có video KOC nào (toàn video của tài khoản shop)");return {n:0,moi:0}}
  const S=D().settings,pot=S.potential||30,old=new Map((D().kocVideos||[]).map(v=>[v.id,v]));
  const moi=recs.filter(r=>r.don>=pot&&(!old.has(r.id)||(old.get(r.id).don||0)<pot)&&!(old.get(r.id)||{}).st);
  DB.mutate(u.name,`video KOC từ báo cáo "${res.name}": ${all.length} video`,dt=>{
    dt.kocVideos=dt.kocVideos||[];
    recs.forEach(r=>{const acc=String(r.acc).replace(/^@/,""),v=dt.kocVideos.find(x=>x.id===r.id),o={acc,ten:String(r.ten||"").slice(0,140),sp:String(r.sp||"").replace(/\(\d{10,}\)/g,"").slice(0,90),sku:guessSku(r.sp)||guessSku(r.ten)||"KHAC",tm:String(r.tm||"").slice(0,10),view:r.view,click:r.click,don:r.don,gmv:r.gmv,xh:r.xh,ky:res.range||res.name,at:dt.settings.today};
      if(v)Object.assign(v,o);else dt.kocVideos.push(Object.assign({id:r.id,st:""},o))});
    dt.kocVideos.sort((a,b)=>(b.don||0)-(a.don||0)||(b.gmv||0)-(a.gmv||0));
    if(dt.kocVideos.length>KOC_KEEP)dt.kocVideos=dt.kocVideos.filter((v,i)=>i<KOC_KEEP||v.st);
    dt.kocImports=(dt.kocImports||[]).concat({at:new Date().toLocaleString("vi-VN"),by:u.name,file:res.name,range:res.range,n:all.length,koc:new Set(all.map(r=>r.acc)).size,don:sum(all,r=>r.don),gmv:sum(all,r=>r.gmv)}).slice(-20);
    if(moi.length&&typeof notifyU==="function"){const win=moi.filter(r=>r.don>=(S.winnerOrders||100)).length;
      notifyU(dt,approvers().concat(admins()),`🏆 Báo cáo TikTok có ${moi.length} video KOC ra số${win?` (${win} video win)`:""}: check video win KOC, cái nào ok đưa vào kho video win để phân tích và nhân bản`,"page:bc_koc")}
  });
  if(moi.length){const ap=typeof hyApprover==="function"&&hyApprover();svApi("/api/hub/worker-tasks",{method:"POST",body:JSON.stringify({kind:"card_notify",ref:"koc",payload:{to:["chi"].concat(ap?[ap.name]:[]),text:`🏆 Báo cáo video KOC ${res.range||""}: ${moi.length} video KOC ra số (nhiều nhất ${nf(Math.max(...moi.map(r=>r.don)))} đơn). Check video win KOC ở Marketing › KOC / Affiliate, cái nào ok đưa vào kho video win để phân tích và nhân bản.`}})}).catch(()=>{})}
  toast(`Đã nhập ${all.length} video KOC${moi.length?` · ${moi.length} video ra số mới, đã báo Oanh và chị`:""}`);
  return {n:all.length,moi:moi.length};
}
const _applyTikTokKoc=applyTikTok;
applyTikTok=function(u,res,kenh){const cl=_applyTikTokKoc(u,res,kenh);kocImport(u,res,true);return cl};

let KOCF={lv:"pot",sku:""};
function kocSection(){
  const d=D(),S=d.settings,all=d.kocVideos||[],can=kocCan(),pot=S.potential||30;
  const L=all.filter(v=>(KOCF.lv==="all"||(KOCF.lv==="pot"?v.don>=pot&&!v.st:KOCF.lv==="win"?v.st==="win":v.st==="bo"))&&(!KOCF.sku||v.sku===KOCF.sku));
  const cho=all.filter(v=>v.don>=pot&&!v.st).length;
  return `<section class="card flush" id="kocv"><div class="card-h pad"><h2>🏆 Video KOC ra số</h2><span class="hint">tự tách từ báo cáo TikTok (video không phải tài khoản shop) · ${all.length} video · <b class="${cho?"t-amb":""}">${cho} chờ check</b> · tiềm năng từ ${pot} đơn, win từ ${S.winnerOrders||100} đơn</span></div>
   <div class="filters pad"><div class="seg">${[["pot",`Chờ check (${cho})`],["win","Đã vào kho win"],["bo","Đã bỏ qua"],["all","Tất cả"]].map(([k,t])=>`<button class="${KOCF.lv===k?"on":""}" data-kocf="${k}">${t}</button>`).join("")}</div><select id="koc-s">${opt([["","Mọi sản phẩm"]].concat(skOpts()),KOCF.sku)}</select>
    ${ME.role==="admin"?`<button class="lnk" id="koc-own" title="Video của các tài khoản này không tính là KOC">Tài khoản của shop: ${esc(ownAccs().join(", "))} · sửa</button>`:""}</div>
   <div class="kocup pad"><div><b>Tải báo cáo video KOC</b><small>TikTok Shop › Phân tích › Video › chọn video của <b>nhà sáng tạo liên kết (KOC)</b> › Xuất file "Video Performance List" rồi kéo vào đây. File video của shop vẫn nhập ở Đo lường › Nhập báo cáo.${(d.kocImports||[]).length?` · Lần nhập gần nhất: ${esc(d.kocImports[d.kocImports.length-1].range||d.kocImports[d.kocImports.length-1].file)} (${nf(d.kocImports[d.kocImports.length-1].n)} video, ${nf(d.kocImports[d.kocImports.length-1].koc)} KOC) lúc ${esc(d.kocImports[d.kocImports.length-1].at)}`:""}</small></div>${dropZone("koc")}</div>
   ${L.length?`<div class="tbl"><table><thead><tr><th>Video</th><th>KOC</th><th>Sản phẩm</th><th>Ngày đăng</th><th class="n">View</th><th class="n">CTR</th><th class="n">Đơn</th><th class="n">GMV</th><th>Mức</th><th></th></tr></thead><tbody>${L.slice(0,150).map(v=>{const lv=kocLvl(v);return `<tr><td class="wide"><a href="${esc(kocLink(v))}" target="_blank" rel="noopener">${esc((v.ten||"(không tên)").slice(0,80))}</a><small>${esc(v.ky||"")}</small></td><td>@${esc(v.acc)}</td><td>${swatch(v.sku)}${esc(sk(v.sku).n)}</td><td>${esc(v.tm||"")}</td><td class="n">${nf(v.view||0)}</td><td class="n">${v.view?((v.click||0)/v.view*100).toFixed(1)+"%":"—"}</td><td class="n"><b>${nf(v.don||0)}</b></td><td class="n">${money(v.gmv||0)}</td><td>${pill(lv[0],lv[1])}</td>
     <td>${v.st==="win"?`${pill("Đã vào kho win","grn")}${v.by?`<small>${esc(v.by)}</small>`:""}`:v.st==="bo"?`${pill("Bỏ qua","gry")}${can?` <button class="lnk" data-kocu="${v.id}">hoàn tác</button>`:""}`:can?`<button class="btn sm pri" data-kocw="${v.id}">✓ Đưa vào kho video win</button> <button class="lnk" data-kocb="${v.id}">Bỏ qua</button>`:`<span class="hint">chờ Oanh check</span>`}</td></tr>`}).join("")}</tbody></table></div>`:`<p class="empty pad">${all.length?"Không có video nào ở mục này.":"Chưa có video KOC. Nhập báo cáo video TikTok (Đo lường › Nhập báo cáo, file Video Performance List), video của KOC tự hiện ở đây."}</p>`}
   <p class="hint pad">Đưa vào kho video win: video vào Video win (nguồn KOC) để Hypit phân tích vì sao bán được rồi nhân bản. Mỗi lần nhập báo cáo, số view, đơn, GMV của video KOC tự cập nhật.</p></section>`;
}
function kocBind(m){
  if($("#dz-koc"))bindDrop("koc",async f=>{const rows=await readXlsx(f);const res=parseTikTok(rows,f.name);if(res.err){toast(res.err);return}KOCF.lv="pot";kocImport(ME,res,false);renderMain()});
  m.querySelectorAll("[data-kocf]").forEach(x=>x.onclick=()=>{KOCF.lv=x.dataset.kocf;renderMain()});
  if($("#koc-s"))$("#koc-s").onchange=e=>{KOCF.sku=e.target.value;renderMain()};
  if($("#koc-own"))$("#koc-own").onclick=()=>{const v=prompt("Tên tài khoản TikTok của shop (cách nhau dấu phẩy). Video của các tài khoản này không tính là KOC:",ownAccs().join(", "));if(v===null)return;DB.mutate(ME.name,"tài khoản shop TikTok",dt=>{dt.settings.ownAccs=v.split(",").map(s=>s.trim().replace(/^@/,"")).filter(Boolean)});renderMain()};
  m.querySelectorAll("[data-kocw]").forEach(x=>x.onclick=()=>{const v=(D().kocVideos||[]).find(y=>y.id===x.dataset.kocw);if(!v)return;
    DB.mutate(ME.name,"đưa video KOC @"+v.acc+" vào kho video win",dt=>{const y=dt.kocVideos.find(q=>q.id===v.id);if(y){y.st="win";y.by=ME.name}dt.winResearch=dt.winResearch||[];if(!dt.winResearch.some(r=>r.kocId===v.id)){const t=new Date();
      dt.winResearch.push({id:"VW-"+Date.now().toString(36).toUpperCase(),kocId:v.id,link:kocLink(v),ten:v.ten||"Video KOC @"+v.acc,nguon:"KOC @"+v.acc,sp:v.sku,soLieu:`${nf(v.view||0)} view · ${nf(v.don||0)} đơn · ${money(v.gmv||0)} (${v.ky||""})`,lyDo:"Video KOC ra số, Oanh check ok",by:ME.id,byName:ME.name,at:`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`})}});
    toast("Đã đưa vào kho video win · vào Video win › Video win nghiên cứu bấm Phân tích Hypit");renderMain()});
  m.querySelectorAll("[data-kocb]").forEach(x=>x.onclick=()=>{DB.mutate(ME.name,"bỏ qua video KOC",dt=>{const y=(dt.kocVideos||[]).find(q=>q.id===x.dataset.kocb);if(y){y.st="bo";y.by=ME.name}});renderMain()});
  m.querySelectorAll("[data-kocu]").forEach(x=>x.onclick=()=>{DB.mutate(ME.name,"hoàn tác bỏ qua video KOC",dt=>{const y=(dt.kocVideos||[]).find(q=>q.id===x.dataset.kocu);if(y)y.st=""});renderMain()});
}
const _pBcKocV=PAGES.bc_koc;
PAGES.bc_koc=function(m){_pBcKocV(m);const h=m.querySelector(".ph");const html=kocSection();if(h)h.insertAdjacentHTML("afterend",html);else m.insertAdjacentHTML("afterbegin",html);kocBind(m)};

/* Bước Video win & nhân bản: nhắc video KOC chờ check */
const _xvWinKoc=xvWin;
xvWin=function(b,o){_xvWinKoc(b,o);const pot=D().settings.potential||30,n=(D().kocVideos||[]).filter(v=>v.don>=pot&&!v.st).length;
  if(n)b.insertAdjacentHTML("afterbegin",`<div class="note">🏆 Có <b>${n} video KOC ra số</b> chờ check. <button class="btn sm" data-go="bc_koc">Xem video KOC →</button></div>`);bindCommon(b)};

/* Bấm thông báo dạng "page:…" thì mở đúng trang */
const _openNotifsKoc=openNotifs;
openNotifs=function(){_openNotifsKoc();const p=$("#ntp");if(!p)return;
  p.addEventListener("click",e=>{const b=e.target.closest("[data-nt]");if(!b)return;const n=(D().notifs||[]).find(x=>x.id===b.dataset.nt);if(n&&n.ref&&n.ref.startsWith("page:")){PAGE=n.ref.slice(5);if(APP_MODE==="admin"&&!modGroups(curMod()).some(g=>g[1].some(i=>i[0]===PAGE)))MOD="";render()}},true)};

/* Nhập báo cáo › TikTok: nhắc chỗ tải file KOC */
const _pBaoCaoKoc=PAGES.baocao;
PAGES.baocao=function(m){_pBaoCaoKoc(m);const c=m.querySelector("#dz-tt");if(c)c.insertAdjacentHTML("afterend",`<p class="hint">File video của <b>KOC / affiliate</b> là báo cáo riêng: tải ở <button class="lnk" data-go="bc_koc">Marketing › KOC / Affiliate</button>. Ở đây chỉ nhập file video của shop (aillavietnamstore, aillavnstore2…).</p>`);bindCommon(m)};
