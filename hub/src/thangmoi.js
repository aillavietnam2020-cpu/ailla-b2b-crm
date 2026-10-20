/* =====================================================================
   THÁNG MỚI + KHO LƯU TRỮ VIDEO TỔNG
   - Tự chuyển sang tháng mới ngay khi có người mở web sau 0 giờ ngày 1 (tháng thật lớn hơn tháng đang chạy).
   - Video đã đăng, order xong, việc xong của tháng cũ được cất vào d.luuTru (xem ở "Kho lưu trữ video").
   - Việc CHƯA XONG sang tháng mới vẫn giữ nguyên hạn cũ, nên hiện là trễ hạn (ngày hạn lùi về số âm / 0 so với ngày 1 tháng mới).
   - Kế hoạch KPI sản phẩm, kế hoạch tuần, phân bổ, báo cáo tuần về trắng để chị nhập mới; báo cáo cũ được cất vào luuTru.baoCao[tháng].
   ===================================================================== */
const TM_DEFAULT="2026-10";
function tmInfo(key){
  const [y,m]=key.split("-").map(Number);
  return {key,mon:m,year:y,ndays:new Date(y,m,0).getDate(),first:(new Date(y,m-1,1).getDay()+6)%7}
}
function tmWeeks(key,info){
  if(key==="2026-10")return [{w:1,tu:1,den:4},{w:2,tu:5,den:11},{w:3,tu:12,den:18},{w:4,tu:19,den:25},{w:5,tu:26,den:31}];
  const nd=info.ndays;
  return [[1,7],[8,14],[15,21],[22,28],[29,nd]].map(([tu,den],i)=>({w:i+1,tu,den}))
}
function tmApply(key){
  const info=tmInfo(key);
  Object.assign(MONTH,info);
  WEEKS.splice(0,WEEKS.length,...tmWeeks(key,info));
  CPM=key
}
const tmRealKey=()=>{const t=new Date();return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")};

/* chuyển dữ liệu dùng chung sang tháng mới (hàm sửa dữ liệu, chạy lại an toàn nếu bị gọi 2 lần) */
function tmRoll(dt,newKey){
  const oldKey=dt.month||TM_DEFAULT;
  if(oldKey>=newKey)return;
  const oi=tmInfo(oldKey),ni=tmInfo(newKey);
  const off=Math.round((new Date(ni.year,ni.mon-1,1)-new Date(oi.year,oi.mon-1,1))/86400000);
  const sh=v=>(+v>0?+v-off:v);
  const L=dt.luuTru=dt.luuTru||{};
  L.cards=L.cards||[];L.orders=L.orders||[];L.tasks=L.tasks||[];L.shoots=L.shoots||[];L.baoCao=L.baoCao||{};
  const keepC=[];
  (dt.cards||[]).forEach(c=>{
    c.thang=c.thang||oldKey;
    if(c.step==="xong")L.cards.push(c);
    else{c.thangGoc=c.thangGoc||oldKey;c.day=sh(c.day);c.han=sh(c.han);c.qday=sh(c.qday);c.tuan=0;keepC.push(c)}
  });
  dt.cards=keepC;
  const keepO=[];
  (dt.orders||[]).forEach(o=>{if(o.trangThai==="Xong"){o.thang=o.thang||oldKey;L.orders.push(o)}else{o.han=sh(o.han);keepO.push(o)}});
  dt.orders=keepO;
  const keepT=[];
  (dt.tasks||[]).forEach(t=>{if(t.st==="done"){t.thang=t.thang||oldKey;L.tasks.push(t)}else{t.han=sh(t.han);if(t.batDau)t.batDau=sh(t.batDau);keepT.push(t)}});
  dt.tasks=keepT;
  L.shoots=L.shoots.concat((dt.shoots||[]).map(s=>Object.assign({thang:oldKey},s)));
  dt.shoots=[];
  /* cất báo cáo và kế hoạch của tháng cũ, rồi để trống cho tháng mới */
  L.baoCao[oldKey]={imports:dt.imports||[],ttWeeks:dt.ttWeeks||[],weekly:dt.weekly||[],adsRows:dt.adsRows||[],weekNotes:dt.weekNotes||{},adjusts:dt.adjusts||[],planBase:dt.planBase||null,weekPlan:dt.weekPlan||{},phanBo:dt.phanBo||{},kpiNgay:dt.kpiNgay||{},kpiSanPham:(dt.products||[]).map(p=>({k:p.k,kenhs:JSON.parse(JSON.stringify(p.kenhs||[]))})),goals:dt.goals||{}};
  dt.imports=[];dt.ttWeeks=[];dt.weekly=[{w:1,cu:0,tutao:0,ads:0,adsDon:0,adsGmv:0}];dt.adsRows=[];
  dt.weekNotes={};dt.adjusts=[];dt.planBase={at:"",day:0,by:"",items:[]};dt.weekPlan={};dt.phanBo={};dt.kpiNgay={};
  (dt.products||[]).forEach(p=>(p.kenhs||[]).forEach(k=>{k.sl=0}));
  Object.values(dt.goals||{}).forEach(g=>{if(g&&typeof g==="object")g.gmv=0});
  (dt.tuyen||[]).forEach(t=>{t.kh=0});
  dt.month=newKey;
  if(dt.settings)dt.settings.today=1;
  dt.notifs=dt.notifs||[];
  (dt.users||[]).filter(u=>u.active!==false&&u.role==="admin").forEach(u=>dt.notifs.push({id:"nt-"+Date.now().toString(36)+u.id,to:u.id,text:"Web đã chuyển sang tháng "+ni.mon+"/"+ni.year+": việc chưa xong giữ hạn cũ (hiện trễ hạn), kế hoạch KPI để trống chờ chị nhập mới.",at:new Date().toISOString(),ref:"",by:"",read:false}))
}

/* kiểm tra khi mở web và mỗi phút: tháng thật đã qua tháng đang chạy thì tự chuyển */
function tmCheck(silent){
  if(typeof DB==="undefined"||!DB.data||typeof ME==="undefined"||!ME)return;
  const d=DB.data,cur=d.month||TM_DEFAULT,real=tmRealKey();
  let changed=false;
  if(MONTH.key!==cur){tmApply(cur);changed=true}
  if(real>cur){
    DB.mutate("Hệ thống","tự chuyển sang tháng "+real,dt=>tmRoll(dt,real));
    tmApply(real);changed=true
  }
  if(changed&&!silent&&typeof render==="function")render()
}
{
  const _load=DB.load;
  DB.load=async function(){
    const r=await _load.apply(this,arguments);
    try{tmCheck(true)}catch(e){console.warn("chuyển tháng lỗi",e)}
    return r
  }
}
setInterval(()=>{try{tmCheck(false)}catch(e){console.warn("chuyển tháng lỗi",e)}},60000);

/* =====================================================================
   KHO LƯU TRỮ VIDEO TỔNG: mọi video của mọi tháng; lọc theo tháng, sản phẩm, người làm, trạng thái
   ===================================================================== */
const KL={thang:"",sku:"",ng:"",st:"",q:"",nguon:"",open:false};
function klRows(){
  const d=D(),out=[],L=d.luuTru||{};
  const mk=(c,nguon)=>({thang:c.thang||c.thangGoc||(d.month||MONTH.key),goc:c.thangGoc||"",ma:c.id,sku:c.sku||"",kenh:chOf(c.kenh).short,ten:c.hookText||c.yTuong||c.tuyen||"",
    nguoi:userName(c.nguoiEdit||c.nguoiKB||c.nguoi)||"",st:c.step==="xong"?"Đã đăng":["dang"].includes(c.step)?"Chờ đăng":"Đang làm",
    link:c.linkFinal||c.linkVideo||"",post:c.linkDang||"",don:+c.don||0,gmv:+c.gmv||0,nguon});
  (L.cards||[]).forEach(c=>out.push(mk(c,"Đã lưu trữ")));
  (d.cards||[]).forEach(c=>{if(c.repostOf)return;out.push(mk(c,c.thangGoc?"Tồn từ tháng trước":"Tháng này"))});
  (d.kho||[]).forEach(k=>{
    if(k.maDang)return;
    out.push({thang:"Kho tồn",goc:"",ma:k.ma,sku:k.sku||"",kenh:k.kenhDeXuat?chOf(k.kenhDeXuat).short:"",ten:k.ten||k.tuyen||"",nguoi:k.nguoi||"",st:"Chờ đăng",link:k.link||"",post:"",don:0,gmv:0,nguon:"Kho tồn"})});
  return out
}
function pKhoLuuTru(m){
  const all=klRows(),thangs=[...new Set(all.map(r=>r.thang))].sort().reverse();
  const skus=[...new Set(all.map(r=>r.sku).filter(Boolean))],ngs=[...new Set(all.map(r=>r.nguoi).filter(Boolean))].sort();
  const fq=typeof bkFold==="function"?bkFold(KL.q):String(KL.q).toLowerCase();
  const fold=x=>typeof bkFold==="function"?bkFold(x):String(x||"").toLowerCase();
  const L=all.filter(r=>(!KL.thang||r.thang===KL.thang)&&(!KL.sku||r.sku===KL.sku)&&(!KL.ng||r.nguoi===KL.ng)&&(!KL.st||r.st===KL.st)&&(!KL.nguon||r.nguon===KL.nguon)&&(!fq||[r.ma,r.ten,r.nguoi,r.link,r.post].some(x=>x&&fold(x).includes(fq))));
  const done=L.filter(r=>r.st==="Đã đăng").length,ton=L.filter(r=>r.st!=="Đã đăng").length;
  const chips=[["ng",KL.ng&&"Người làm: "+KL.ng],["st",KL.st&&"Trạng thái: "+KL.st],["nguon",KL.nguon&&"Nguồn: "+KL.nguon]].filter(c=>c[1]),nAct=chips.length;
  m.innerHTML=H("Kho lưu trữ video","Mọi video đã làm của mọi tháng, kể cả video tồn chưa dùng · lọc theo tháng, sản phẩm, người làm")
   +`<div class="grid kpis">${kpi("Tổng video",all.length)}${kpi("Đã đăng",all.filter(r=>r.st==="Đã đăng").length,"","var(--green)")}${kpi("Tồn chưa đăng",all.filter(r=>r.st!=="Đã đăng").length,"gồm kho tồn và video các tháng trước")}${kpi("Đang lọc",L.length,done+" đã đăng · "+ton+" chưa đăng")}</div>
   <section class="card flush"><div class="pad sxfil"><input type="search" class="ksearch" id="kl-q" value="${esc(KL.q)}" placeholder="🔍 Tìm mã, hook, người làm, link…">
    <select data-kl="thang">${opt([["","Mọi tháng"]].concat(thangs.map(t=>[t,/^\d{4}-\d{2}$/.test(t)?"Tháng "+t.slice(5)+"/"+t.slice(0,4):t])),KL.thang)}</select>
    <select data-kl="sku">${opt([["","Mọi sản phẩm"]].concat(skus.map(s=>[s,sk(s).n])),KL.sku)}</select>
    <button type="button" class="btn sm${nAct?" klf":""}" id="kl-f">Bộ lọc${nAct?` <b class="klb">${nAct}</b>`:""}</button><span class="sp"></span><button type="button" class="btn sm" id="kl-x">⬇ Xuất Excel</button></div>
   ${KL.open?`<div class="pad klpanel"><label>Người làm<select data-kl="ng">${opt([["","Mọi người làm"]].concat(ngs.map(n=>[n,n])),KL.ng)}</select></label><label>Trạng thái<select data-kl="st">${opt([["","Mọi trạng thái"],["Đã đăng","Đã đăng"],["Chờ đăng","Chờ đăng / tồn"],["Đang làm","Đang làm"]],KL.st)}</select></label><label>Nguồn<select data-kl="nguon">${opt([["","Mọi nguồn"],["Tháng này","Tháng này"],["Tồn từ tháng trước","Tồn từ tháng trước"],["Đã lưu trữ","Đã lưu trữ"],["Kho tồn","Kho tồn"]],KL.nguon)}</select></label></div>`:""}
   <div class="pad klchips"><span class="hint">${L.length} video</span>${chips.map(([f,l])=>`<span class="klchip">${esc(l)} <button type="button" data-klx="${f}" aria-label="Bỏ lọc">✕</button></span>`).join("")}${chips.length?`<button type="button" class="lnk" id="kl-clr">Xóa hết</button>`:""}</div>
   <div class="tbl bvscroll"><table class="kstab"><thead><tr><th>Tháng</th><th>Mã</th><th>Sản phẩm</th><th>Kênh</th><th>Hook / tên</th><th>Người làm</th><th>Trạng thái</th><th>Video</th><th>Bài đăng</th><th class="n">Đơn</th><th class="n">GMV</th></tr></thead><tbody>
   ${L.slice(0,400).map(r=>`<tr${r.nguon==="Tháng này"||r.nguon==="Tồn từ tháng trước"?` data-card="${esc(r.ma)}" class="clk"`:""}><td>${esc(/^\d{4}-\d{2}$/.test(r.thang)?r.thang.slice(5)+"/"+r.thang.slice(0,4):r.thang)}${r.goc&&r.goc!==r.thang?` <small class="hint">từ ${esc(r.goc.slice(5))}/${esc(r.goc.slice(0,4))}</small>`:""}</td><td class="mono">${esc(r.ma)}</td><td>${r.sku?swatch(r.sku)+esc(sk(r.sku).n):"—"}</td><td>${esc(r.kenh||"—")}</td><td class="kstn" title="${esc(r.ten)}">${esc(r.ten||"—")}</td><td>${esc(r.nguoi||"—")}</td><td>${pill(r.st,r.st==="Đã đăng"?"grn":r.st==="Chờ đăng"?"blu":"gry")}</td><td>${r.link?`<a href="${esc(/^https?:/i.test(r.link)?r.link:"https://"+r.link)}" target="_blank" rel="noopener">▶</a>`:"—"}</td><td>${r.post?`<a href="${esc(/^https?:/i.test(r.post)?r.post:"https://"+r.post)}" target="_blank" rel="noopener">↗</a>`:"—"}</td><td class="n">${r.don?nf(r.don):"—"}</td><td class="n">${r.gmv?money(r.gmv):"—"}</td></tr>`).join("")||'<tr><td colspan="11" class="empty">Không có video nào khớp.</td></tr>'}
   </tbody></table></div>${L.length>400?`<p class="hint pad">Hiện 400/${L.length} video đầu, lọc thêm để xem tiếp.</p>`:""}</section>`;
  const qi=m.querySelector("#kl-q");if(qi){const go=()=>{if(qi.value.trim()===KL.q)return;KL.q=qi.value.trim();renderMain()};qi.onkeydown=e=>{if(e.key==="Enter")go()};qi.onchange=go}
  m.querySelectorAll("[data-kl]").forEach(s=>s.onchange=()=>{KL[s.dataset.kl]=s.value;renderMain()});
  const kf=m.querySelector("#kl-f");if(kf)kf.onclick=()=>{KL.open=!KL.open;renderMain()};
  m.querySelectorAll("[data-klx]").forEach(b=>b.onclick=()=>{KL[b.dataset.klx]="";renderMain()});
  const kc=m.querySelector("#kl-clr");if(kc)kc.onclick=()=>{KL.ng=KL.st=KL.nguon="";renderMain()};
  const x=m.querySelector("#kl-x");if(x)x.onclick=()=>xlsExport("kho-luu-tru-video","Kho luu tru",["Tháng","Mã","Sản phẩm","Kênh","Hook / tên","Người làm","Trạng thái","Link video","Link bài đăng","Đơn","GMV","Nguồn"],L.map(r=>[r.thang,r.ma,r.sku?sk(r.sku).n:"",r.kenh,r.ten,r.nguoi,r.st,r.link,r.post,r.don||"",r.gmv||"",r.nguon]));
  if(typeof bindCommon==="function")bindCommon(m)
}
PAGES.kho_luutru=pKhoLuuTru;
