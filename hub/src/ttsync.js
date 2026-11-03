/* =====================================================================
   SỐ TIKTOK AGENT NẠP → CÁC TRANG MARKETING (chị Hoa 03/11: "phải hiển thị đồng bộ")
   Agent Kế toán trưởng nạp mỗi sáng vào tts_day / tts_range (đọc qua TSB.all ở tiktok.js).
   Trang Marketing trước chỉ đọc báo cáo nhập tay (d.imports, d.kocVideos); giờ đọc thêm:
   - videos   (Video › Chi tiết): số tổng + video GMV cao nhất, ghép thẻ đã đăng theo ID video
   - koc      (Transaction Analysis): số tổng KOC
   - creators (Creator List): nhà sáng tạo bán tốt nhất
   Dữ liệu nhập tay cũ vẫn giữ; có số agent cho kỳ đang xem thì ưu tiên số agent.
   ===================================================================== */
let TTS_KICK=false;
function ttsEnsure(){
  if(typeof TSB==="undefined"||TSB.all||TSB.allBusy||TTS_KICK||typeof tsbLoadAll!=="function")return;
  TTS_KICK=true;tsbLoadAll().then(()=>{if(typeof renderMain==="function"&&(MOD==="mkt"||["win","bc_koc","kehoach","tq_content"].includes(PAGE)))renderMain()}).catch(()=>{})}
const ttsVn=s=>s?s.slice(8,10)+"/"+s.slice(5,7):"";
/* các khoảng của một loại nằm trong [from,to]; khoảng chồng nhau thì giữ khoảng mới nhất, rộng nhất */
function ttsRanges(kind,from,to){
  const A=(typeof TSB!=="undefined"&&TSB.all&&TSB.all.ranges)||[];
  const R=A.filter(r=>r.kind===kind&&r.from<=to&&r.to>=from).sort((a,b)=>b.to.localeCompare(a.to)||a.from.localeCompare(b.from)),out=[];
  R.forEach(r=>{if(!out.some(x=>x.from<=r.to&&x.to>=r.from))out.push(r)});
  return out.sort((a,b)=>a.from.localeCompare(b.from))}
const ttsLbl=R=>R.map(r=>ttsVn(r.from)+"–"+ttsVn(r.to)).join(", ");
const ttsAt=R=>{const t=R.map(r=>r.at||"").sort().pop();return t?new Date(t).toLocaleString("vi-VN",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"}):""};
/* thẻ đã đăng theo ID video (thẻ tháng này + video win cũ) */
function ttsCardMap(){const m=new Map(),d=D();(d.cards||[]).forEach(c=>{const id=c.tiktokId||((String(c.linkDang||"").match(/[0-9]{19}/)||[])[0]);if(id&&!m.has(id))m.set(id,c)});return m}
/* Video › Chi tiết gộp các khoảng: số tổng + từng video (cộng số nếu có ở nhiều khoảng) */
function ttsVideos(from,to){
  const R=ttsRanges("videos",from,to);if(!R.length)return null;
  const T={n:0,nDang:0,gmv:0,vv:0,don:0},V=new Map(),cm=ttsCardMap();
  R.forEach(r=>{const x=r.data||{};["n","nDang","gmv","vv","don"].forEach(k=>T[k]+=+x[k]||0);
    (x.top||[]).forEach(v=>{const o=V.get(v.id)||{id:v.id,t:v.t,post:v.post,sp:v.sp,u:v.u||"",vv:0,don:0,gmv:0};o.vv+=+v.vv||0;o.don+=+v.don||0;o.gmv+=+v.gmv||0;V.set(v.id,o)})});
  const rows=[...V.values()].map(v=>{const c=cm.get(v.id)||null,sku=c?c.sku:(typeof bkSku==="function"?bkSku(v.sp||v.t||""):""),ch=c?c.kenh:ttsChOfAcc(v.u);return {...v,card:c,sku,kenh:ch}}).sort((a,b)=>b.gmv-a.gmv);
  return {T,rows,R,lbl:ttsLbl(R),at:ttsAt(R)}}
function ttsChOfAcc(u){u=String(u||"").replace(/^@/,"").toLowerCase();if(!u)return "";const c=CHANNELS.find(x=>String(x.acc||"").replace(/^@/,"").toLowerCase()===u);return c?c.k:""}
/* số của thẻ đã đăng: ưu tiên số agent (cùng kỳ) */
function ttsCardNums(c,V){const r=V&&V.rows.find(x=>x.card&&x.card.id===c.id);return r?{view:r.vv,don:r.don,gmv:r.gmv,src:"agent"}:{view:+c.view||0,don:+c.don||0,gmv:+c.gmv||0,click:+c.click||0,src:c.hist||+c.view>0?"tay":""}}
/* KOC: số tổng (Transaction Analysis) + nhà sáng tạo (Creator List) */
function ttsKoc(from,to){
  const K=ttsRanges("koc",from,to),C=ttsRanges("creators",from,to);if(!K.length&&!C.length)return null;
  const M={};K.forEach(r=>Object.entries(r.data||{}).forEach(([k,v])=>{if(typeof v==="number")M[k]=(M[k]||0)+v}));
  const U=new Map();let n=0,nCo=0,gmv=0;C.forEach(r=>{const x=r.data||{};n=Math.max(n,+x.n||0);nCo+=+x.nCo||0;gmv+=+x.gmv||0;(x.top||[]).forEach(t=>{const o=U.get(t.u)||{u:t.u,gmv:0,video:0,live:0,the:0,don:0,hh:0,hoan:0,nVideo:0,fl:0};["gmv","video","live","the","don","hh","hoan","nVideo"].forEach(k=>o[k]+=+t[k]||0);o.fl=Math.max(o.fl,+t.fl||0);U.set(t.u,o)})});
  return {M,K,C,n,nCo,gmv,top:[...U.values()].sort((a,b)=>b.gmv-a.gmv),lbl:ttsLbl(K.length?K:C),lblC:ttsLbl(C),at:ttsAt(K.concat(C))}}
/* bảng nhà sáng tạo bán tốt nhất (dùng ở trang KOC / Affiliate) */
function ttsKocHtml(from,to,note){
  const X=ttsKoc(from,to);if(!X)return "";const M=X.M,fm=v=>v?tr(v):"—";
  return `<section class="card"><div class="card-h"><h2>Số TikTok agent nạp</h2><span class="hint">${note?`<b class="t-amb">${esc(note)}</b> · `:""}${X.K.length?"KOC "+esc(X.lbl):""}${X.C.length?(X.K.length?" · ":"")+"nhà sáng tạo "+esc(X.lblC):""}${X.at?" · cập nhật "+esc(X.at):""}</span></div>
   ${X.K.length?`<div class="grid kpis">${kpi("GMV nhờ nhà sáng tạo",fm(M["GMV nhờ nhà sáng tạo"]),nf(M["Số món bán ra nhờ nhà sáng tạo"]||0)+" món")}${kpi("Nhà sáng tạo có doanh số",nf(M["Nhà sáng tạo có doanh số"]||0),nf(M["Nhà sáng tạo đã đăng nội dung"]||0)+" người đã đăng nội dung")}${kpi("Video KOC có doanh số",nf(M["Video có doanh số"]||0),"trên "+nf(M["Video"]||0)+" video")}${kpi("Hoa hồng ước tính",fm(M["Hoa hồng ước tính"]),"số thật theo quyết toán")}</div>`:""}
   ${X.top.length?`<h3>Nhà sáng tạo bán tốt nhất</h3><p class="hint">${nf(X.nCo)} người có doanh số · tổng GMV liên kết ${tr(X.gmv)}</p>${tbl(["#","Nhà sáng tạo","GMV","GMV video","GMV LIVE","Đơn","Số video","Hoa hồng ước tính","Người theo dõi"],X.top.slice(0,20).map((x,i)=>`<tr><td>${i+1}</td><td><b>@${esc(x.u)}</b></td><td class="n">${nf(Math.round(x.gmv))}</td><td class="n">${nf(Math.round(x.video))}</td><td class="n">${nf(Math.round(x.live))}</td><td class="n">${nf(x.don)}</td><td class="n">${nf(x.nVideo)}</td><td class="n">${nf(Math.round(x.hh))}</td><td class="n">${nf(x.fl)}</td></tr>`))}`:""}</section>`}
(function(){
  /* video win: thêm video có đơn trong số agent (gộp mọi khoảng đã nạp) mà chưa có trong danh sách */
  if(typeof winners==="function"){const _w=winners;winners=function(){const L=_w.apply(this,arguments);
    try{ttsEnsure();const V=ttsVideos("2000-01-01","2999-12-31");if(!V)return L;const set=D().settings,by=new Map(L.map(w=>[String(w.key),w]));
      V.rows.filter(v=>v.don>0).forEach(v=>{const w=by.get(String(v.id))||(v.card?by.get(String(v.card.tiktokId||v.card.id)):null);
        if(w){if(v.don>(+w.don||0)){w.don=v.don;w.gmv=v.gmv;w.view=v.vv;w.nguon=(w.nguon||"")+" · số TikTok "+V.lbl}}
        else{const nw={key:v.id,ten:v.t,sku:v.sku,kenh:v.kenh,nguoi:v.card?v.card.nguoi:"",view:v.vv,don:v.don,gmv:v.gmv,nguon:"Số TikTok "+V.lbl+(v.post?" · đăng "+ttsVn(v.post)+"/"+v.post.slice(0,4):""),tm:v.post?ttsVn(v.post):""};if(v.card)nw.cardId=v.card.id;L.push(nw);by.set(String(v.id),nw)}});
      return L.sort((x,y)=>y.don-x.don||y.gmv-x.gmv).map((w,i)=>({...w,hang:i+1,loai:w.don>=set.winnerOrders?"Winner":w.don>=set.potential?"Tiềm năng":"Có đơn"}))}catch(e){return L}}}
  /* trang KOC / Affiliate: thêm số agent của kỳ đang chọn */
  if(typeof PAGES!=="undefined"&&PAGES.bc_koc){const _k=PAGES.bc_koc;PAGES.bc_koc=function(m){const r=_k.apply(this,arguments);try{ttsEnsure();const F=typeof KOCF!=="undefined"&&KOCF.f?KOCF:{f:PERIOD.from,t:PERIOD.to};let h=ttsKocHtml(F.f,F.t);if(!h&&TSB.all){const L=(TSB.all.ranges||[]).filter(r=>r.kind==="koc"||r.kind==="creators").sort((a,b)=>b.to.localeCompare(a.to))[0];if(L)h=ttsKocHtml(L.from,L.to,"Kỳ đang chọn chưa có số KOC, đang hiện kỳ gần nhất")}
    if(h){const k=m.querySelector(".kockpi")||m.querySelector(".ph");if(k)k.insertAdjacentHTML("afterend",h);else m.insertAdjacentHTML("afterbegin",h)}}catch(e){}return r}}
})();
