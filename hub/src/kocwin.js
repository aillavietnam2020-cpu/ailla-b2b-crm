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
  const mR=String(res.range||"").match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/),RG={f:mR?mR[1]:"",t:mR?mR[2]:""};
  DB.mutate(u.name,`video KOC từ báo cáo "${res.name}": ${all.length} video`,dt=>{
    dt.kocVideos=dt.kocVideos||[];
    recs.forEach(r=>{const acc=String(r.acc).replace(/^@/,""),v=dt.kocVideos.find(x=>x.id===r.id),o={acc,ten:String(r.ten||"").slice(0,140),sp:String(r.sp||"").replace(/\(\d{10,}\)/g,"").slice(0,90),sku:guessSku(r.sp)||guessSku(r.ten)||"KHAC",tm:String(r.tm||"").slice(0,10),view:r.view,click:r.click,don:r.don,gmv:r.gmv,xh:r.xh,ky:res.range||res.name,at:dt.settings.today};
      const h={f:RG.f,t:RG.t,d:r.don,g:r.gmv,v:r.view,c:r.click};
      if(v){Object.assign(v,o);v.hist=(v.hist||[]).filter(x=>!(x.f===h.f&&x.t===h.t));if(h.f)v.hist.push(h)}else dt.kocVideos.push(Object.assign({id:r.id,st:"",hist:h.f?[h]:[]},o))});
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

let KOCF=(()=>{const t=new Date(),y=t.getFullYear(),m=t.getMonth(),z=n=>String(n).padStart(2,"0");return {st:"pot",sku:"",top:10,k:"mo",f:`${y}-${z(m+1)}-01`,t:`${y}-${z(m+1)}-${z(new Date(y,m+1,0).getDate())}`}})();
/* Số của một video trong khoảng ngày chọn: cộng các lần nhập báo cáo nằm trọn trong khoảng (bỏ báo cáo chồng ngày) */
const kocHist=v=>{if(v.hist&&v.hist.length)return v.hist;const m=String(v.ky||"").match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);return m?[{f:m[1],t:m[2],d:v.don,g:v.gmv,v:v.view,c:v.click}]:[]};
function kocIn(v,f,t){const H=kocHist(v).filter(h=>h.f>=f&&h.t<=t).sort((a,b)=>(b.t>b.f?1:0)-(a.t>a.f?1:0)||b.t.localeCompare(a.t)),pick=[];
  H.sort((a,b)=>(Date.parse(b.t)-Date.parse(b.f))-(Date.parse(a.t)-Date.parse(a.f))).forEach(h=>{if(!pick.some(p=>!(h.t<p.f||h.f>p.t)))pick.push(h)});
  return pick.length?{don:sum(pick,h=>h.d||0),gmv:sum(pick,h=>h.g||0),view:sum(pick,h=>h.v||0),click:sum(pick,h=>h.c||0),ky:pick.length}:null}
const KOC_ST=[["pot","Chờ check"],["win","Đã duyệt vào kho win"],["bo","Bỏ qua"],["all","Tất cả"]];
const kocUpBtn=()=>{const last=(D().kocImports||[]).slice(-1)[0];return `<button class="btn sm" id="koc-up" title="${last?esc("Lần nhập gần nhất: "+(last.range||last.file)+" · "+nf(last.n)+" video, "+nf(last.koc)+" KOC · "+last.at):"Chưa nhập báo cáo KOC"}">⬆ Tải báo cáo KOC</button><input type="file" id="koc-fi" accept=".xlsx,.xls,.csv" hidden>`};
function kocSection(){
  const d=D(),S=d.settings,all=d.kocVideos||[],can=kocCan(),pot=S.potential||30,F=KOCF;
  const R=all.map(v=>{const x=kocIn(v,F.f,F.t);return x?Object.assign({},v,x):null}).filter(Boolean);
  const stOk=v=>F.st==="all"||(F.st==="pot"?v.don>=pot&&!v.st:v.st===F.st);
  const L=R.filter(v=>stOk(v)&&(!F.sku||v.sku===F.sku)).sort((a,b)=>b.don-a.don||b.gmv-a.gmv).slice(0,Math.max(1,+F.top||10));
  const cho=all.filter(v=>v.don>=pot&&!v.st).length,last=(d.kocImports||[]).slice(-1)[0];
  return `<section class="card flush" id="kocv"><div class="card-h pad"><h2>🏆 TOP KOC</h2><span class="hint">${cho?`<b class="t-amb">${cho} video chờ check</b> · `:""}tiềm năng từ ${pot} đơn, win từ ${S.winnerOrders||100} đơn</span></div>
   <div class="filters pad kocflt"><label>Top<select id="koc-top">${opt([5,10,20,50,100].map(n=>[n,"Top "+n]).concat([5,10,20,50,100].includes(+F.top)?[]:[[F.top,"Top "+F.top]]).concat([["__","Số khác…"]]),F.top)}</select></label>
    <label>Thời gian<select id="koc-k">${opt([["mo","Tháng này"],["lmo","Tháng trước"],["c","Tùy chọn ngày"]],F.k)}</select></label>${F.k==="c"?`<label>Từ<input type="date" id="koc-f" value="${F.f}"></label><label>Đến<input type="date" id="koc-t" value="${F.t}"></label>`:""}
    <label>Trạng thái<select id="koc-st">${opt(KOC_ST,F.st)}</select></label><label>Sản phẩm<select id="koc-s">${opt([["","Mọi sản phẩm"]].concat(skOpts()),F.sku)}</select></label>
    ${ME.role==="admin"?`<button class="lnk" id="koc-own" title="Video của các tài khoản này không tính là KOC">Tài khoản shop · sửa</button>`:""}</div>
   ${L.length?`<div class="tbl"><table class="koct"><thead><tr><th class="n">#</th><th>Video</th><th>KOC</th><th>Sản phẩm</th><th>Ngày đăng</th><th class="n">View</th><th class="n">CTR</th><th class="n">Đơn</th><th class="n">GMV</th><th>Mức</th><th></th></tr></thead><tbody>${L.map((v,i)=>{const lv=kocLvl(v);return `<tr><td class="n">${i+1}</td><td class="kocvid"><a href="${esc(kocLink(v))}" target="_blank" rel="noopener" title="${esc(v.ten||"")}">▶ ${esc(v.ten||"Xem video")}</a></td><td>@${esc(v.acc)}</td><td>${swatch(v.sku)}${esc(sk(v.sku).n)}</td><td>${esc((v.tm||"").replace(/\//g,"-").split("-").reverse().join("/"))}</td><td class="n">${nf(v.view||0)}</td><td class="n">${v.view?((v.click||0)/v.view*100).toFixed(1)+"%":"—"}</td><td class="n"><b>${nf(v.don||0)}</b></td><td class="n">${money(v.gmv||0)}</td><td>${pill(lv[0],lv[1])}</td>
     <td class="nowrap">${v.st==="win"?`${pill("Đã vào kho win","grn")}`:v.st==="bo"?`${pill("Bỏ qua","gry")}${can?` <button class="lnk" data-kocu="${v.id}">hoàn tác</button>`:""}`:can?`<button class="btn sm pri" data-kocw="${v.id}">✓ Vào kho win</button> <button class="lnk" data-kocb="${v.id}">Bỏ qua</button>`:`<span class="hint">chờ Oanh check</span>`}</td></tr>`}).join("")}</tbody></table></div>`:`<p class="empty pad">${all.length?"Không có video nào khớp bộ lọc (thử chọn Tất cả hoặc đổi thời gian).":"Chưa có video KOC. Bấm ⬆ Tải báo cáo KOC ở góc trên."}</p>`}
   <p class="hint pad">Số view, đơn, GMV tính theo các báo cáo KOC đã tải nằm trong khoảng thời gian chọn. "Vào kho win": video vào Video win (nguồn KOC) để Hypit phân tích rồi nhân bản.</p></section>`;
}
function kocBind(m){
  const fi=$("#koc-fi");if(fi){$("#koc-up").onclick=()=>fi.click();fi.onchange=async()=>{const f=fi.files[0];if(!f)return;const rows=await readXlsx(f);const res=parseTikTok(rows,f.name);if(res.err){toast(res.err);return}
    const mR=String(res.range||"").match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);if(mR&&(mR[1]<KOCF.f||mR[2]>KOCF.t)){KOCF.k="c";KOCF.f=mR[1];KOCF.t=mR[2]}KOCF.st="pot";kocImport(ME,res,false);renderMain()}}
  const mo=off=>{const t=new Date(),y=t.getFullYear(),mm=t.getMonth()+off,a=new Date(y,mm,1),b=new Date(y,mm+1,0),z=n=>String(n).padStart(2,"0");return [`${a.getFullYear()}-${z(a.getMonth()+1)}-01`,`${b.getFullYear()}-${z(b.getMonth()+1)}-${z(b.getDate())}`]};
  $("#koc-top").onchange=e=>{let v=e.target.value;if(v==="__"){v=prompt("Hiện top bao nhiêu video?","15");if(!v||!(+v>0)){renderMain();return}}KOCF.top=Math.round(+v);renderMain()};
  $("#koc-k").onchange=e=>{KOCF.k=e.target.value;if(KOCF.k!=="c")[KOCF.f,KOCF.t]=mo(KOCF.k==="mo"?0:-1);renderMain()};
  if($("#koc-f")){const ch=()=>{let f=$("#koc-f").value,t=$("#koc-t").value;if(!f||!t)return;if(f>t)[f,t]=[t,f];KOCF.f=f;KOCF.t=t;renderMain()};$("#koc-f").onchange=ch;$("#koc-t").onchange=ch}
  $("#koc-st").onchange=e=>{KOCF.st=e.target.value;renderMain()};$("#koc-s").onchange=e=>{KOCF.sku=e.target.value;renderMain()};
  if($("#koc-own"))$("#koc-own").onclick=()=>{const v=prompt("Tên tài khoản TikTok của shop (cách nhau dấu phẩy). Video của các tài khoản này không tính là KOC:",ownAccs().join(", "));if(v===null)return;DB.mutate(ME.name,"tài khoản shop TikTok",dt=>{dt.settings.ownAccs=v.split(",").map(s=>s.trim().replace(/^@/,"")).filter(Boolean)});renderMain()};
  m.querySelectorAll("[data-kocw]").forEach(x=>x.onclick=()=>{const v=(D().kocVideos||[]).find(y=>y.id===x.dataset.kocw);if(!v)return;
    DB.mutate(ME.name,"đưa video KOC @"+v.acc+" vào kho video win",dt=>{const y=dt.kocVideos.find(q=>q.id===v.id);if(y){y.st="win";y.by=ME.name}dt.winResearch=dt.winResearch||[];if(!dt.winResearch.some(r=>r.kocId===v.id)){const t=new Date();
      dt.winResearch.push({id:"VW-"+Date.now().toString(36).toUpperCase(),kocId:v.id,link:kocLink(v),ten:v.ten||"Video KOC @"+v.acc,nguon:"KOC @"+v.acc,sp:v.sku,soLieu:`${nf(v.view||0)} view · ${nf(v.don||0)} đơn · ${money(v.gmv||0)} (${v.ky||""})`,lyDo:"Video KOC ra số, Oanh check ok",by:ME.id,byName:ME.name,at:`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`})}});
    toast("Đã đưa vào kho video win · vào Video win › Video win nghiên cứu bấm Phân tích Hypit");renderMain()});
  m.querySelectorAll("[data-kocb]").forEach(x=>x.onclick=()=>{DB.mutate(ME.name,"bỏ qua video KOC",dt=>{const y=(dt.kocVideos||[]).find(q=>q.id===x.dataset.kocb);if(y){y.st="bo";y.by=ME.name}});renderMain()});
  m.querySelectorAll("[data-kocu]").forEach(x=>x.onclick=()=>{DB.mutate(ME.name,"hoàn tác bỏ qua video KOC",dt=>{const y=(dt.kocVideos||[]).find(q=>q.id===x.dataset.kocu);if(y)y.st=""});renderMain()});
}
const _pBcKocV=PAGES.bc_koc;
PAGES.bc_koc=function(m){_pBcKocV(m);const h=m.querySelector(".ph"),k=m.querySelector(".grid.kpis"),html=kocSection();
  if(k)k.insertAdjacentHTML("afterend",html);else if(h)h.insertAdjacentHTML("afterend",html);else m.insertAdjacentHTML("afterbegin",html);
  if(h){h.classList.add("phkoc");h.insertAdjacentHTML("beforeend",`<span class="phact">${kocUpBtn()}</span>`)}else m.querySelector("#kocv .card-h").insertAdjacentHTML("beforeend",kocUpBtn());kocBind(m)};

/* Bước Video win & nhân bản: nhắc video KOC chờ check */
const _xvWinKoc=xvWin;
xvWin=function(b,o){_xvWinKoc(b,o);const pot=D().settings.potential||30,n=(D().kocVideos||[]).filter(v=>v.don>=pot&&!v.st).length;
  if(n)b.insertAdjacentHTML("afterbegin",`<div class="note">🏆 Có <b>${n} video KOC ra số</b> chờ check. <button class="btn sm" data-go="bc_koc">Xem video KOC →</button></div>`);bindCommon(b)};

