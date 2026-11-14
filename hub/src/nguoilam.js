/* ================= NGƯỜI LÀM VIDEO & CHỈ TIÊU THEO NGƯỜI (chị Hoa duyệt demo 13/11/2026) =================
   Mỗi video có 2 vai tách riêng:
   - Người làm: tính KPI làm video (đã nộp, đã duyệt, đã đăng). Ô c.nguoiLam; chưa ghi thì suy ra từ người dựng / người viết hook / người được giao.
   - Người phụ trách kênh: lên lịch và đăng (c.nguoi khi video ở Chờ đăng / Đã đăng). Không mặc nhiên là người làm.
   Chỉ tiêu tháng theo người: d.ctNguoi[MONTH.key][kenh][sku] = {uid: số video}. Lead chia ở ② Điều phối;
   kênh × sản phẩm nào chưa chia thì chỉ tiêu mỗi người = số dòng video đang giao cho người đó (làm hộ không trừ chỉ tiêu người được giao).
   Thưởng video win / KPI ra đơn bên Nhân sự CHƯA đổi (chị Hoa 13/11: chờ trao đổi với Lead Content). */
const nlFold=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase().trim();
function uidByName(n){if(!n)return "";const x=nlFold(n),L=(D().users||[]);const u=L.find(v=>nlFold(v.name)===x)||L.find(v=>nlFold(v.name).endsWith(" "+x));return u?u.id:""}
/* người làm của một video */
function mkOf(c){if(!c||c.agency)return "";if(c.nguoiLam)return c.nguoiLam;
  if(c.nguoiEdit)return c.nguoiEdit;const t=uidByName(c.nguoiEditTen);if(t)return t;
  if(typeof mixOf==="function"&&mixOf(c)==="ton")return ""; // video tồn đăng lại: không tính là làm mới cho người đăng
  return c.nguoiKB||c.giao||(["dang","xong"].includes(c.step)?"":c.nguoi)||""}
const NL_NOP=["dvd","dceo","dang","xong"],NL_OK=["dang","xong"];
function nlSt(c){if(c.step==="xong")return ["Đã đăng","grn"];if(c.step==="dang")return ["Chờ đăng","blu"];if(["dvd","dceo"].includes(c.step))return ["Chờ duyệt","vio"];
  if(c.step==="edit"&&(c.duyet==="Cần sửa"||(c.gopy||[]).length&&(c.linkVideo||c.linkFinal)))return ["Cần sửa","red"];return ["Đang làm","amb"]}
const nlMade=c=>BV_RT.includes(mixOf(c))||(mixOf(c)==="ton"&&!!c.nguoiLam);
const nlKey=()=>MONTH.key;
const nlPlan=(d,kenh,sku)=>sum(BV_RT,t=>bvPlanN(d,sku,kenh,t));
function nlCt(d,kenh,sku){const o=((d.ctNguoi||{})[nlKey()]||{})[kenh];return o&&o[sku]?o[sku]:null}
/* chỉ tiêu của một người ở một kênh × sản phẩm */
function nlTarget(d,uid,kenh,sku){const o=nlCt(d,kenh,sku);if(o)return +o[uid]||0;return d.cards.filter(c=>c.kenh===kenh&&c.sku===sku&&nlMade(c)&&nlAsg(c)===uid).length}
/* người được giao dòng (chỉ tiêu mặc định giữ cho người được giao, kể cả khi người khác làm hộ) */
const nlAsg=c=>c.giao||c.nguoiKB||c.nguoiEdit||(c.nguoiLam&&!c.giao?c.nguoiLam:"")||(["dang","xong"].includes(c.step)?"":c.nguoi)||"";
/* thống kê của một người: dòng theo kênh × sản phẩm + video kho chưa phân bổ */
function nlStats(d,uid){
  const cards=d.cards.filter(c=>nlMade(c)&&mkOf(c)===uid),pairs={};
  ptPairs().filter(x=>knShown(d,x)).forEach(x=>{const ct=nlTarget(d,uid,x.kenh,x.sku);if(ct)pairs[x.kenh+"|"+x.sku]={kenh:x.kenh,sku:x.sku,ct,L:[]}});
  cards.forEach(c=>{const k=c.kenh+"|"+c.sku;(pairs[k]=pairs[k]||{kenh:c.kenh,sku:c.sku,ct:0,L:[]}).L.push(c)});
  const used=new Set(d.cards.map(c=>c.khoMa).filter(Boolean)),mk=MONTH.key;
  const kho=(d.kho||[]).filter(k=>k.link&&!used.has(k.ma)&&!/agency/i.test(k.agency||"")&&(k.nguoiId===uid||(!k.nguoiId&&uidByName(k.nguoi)===uid))&&String(k.ngaySX||"").slice(0,7)===mk);
  const R=Object.values(pairs).map(r=>Object.assign(r,{nop:r.L.filter(c=>NL_NOP.includes(c.step)).length,duyet:r.L.filter(c=>NL_OK.includes(c.step)).length,dang:r.L.filter(c=>c.step==="xong").length}))
    .sort((a,b)=>b.ct-a.ct||String(a.kenh).localeCompare(String(b.kenh)));
  const kOk=kho.filter(k=>/đã duyệt/i.test(k.duyet||"")).length;
  const T={ct:sum(R,r=>r.ct),nop:sum(R,r=>r.nop)+kho.length,duyet:sum(R,r=>r.duyet)+kOk,dang:sum(R,r=>r.dang),win:cards.filter(c=>c.step==="xong"&&(+c.don||0)>=(+d.settings.winnerOrders||0)&&(+c.don||0)>0).length,gmv:sum(cards.filter(c=>c.step==="xong"),c=>+c.gmv||0)};
  return {R,kho,kOk,T,cards}}
const nlBar=(a,b)=>`<span class="nlbar"><i style="width:${b?Math.min(100,a/b*100).toFixed(0):0}%"></i></span>`;
const NL_CSS=`<style>.nlbar{display:inline-block;width:90px;height:8px;border-radius:99px;background:#e6e9f2;overflow:hidden;vertical-align:middle}.nlbar i{display:block;height:100%;background:#2f9e5b}.nlk{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:8px 0}.nlk>div{border:1px solid var(--line,#e6e9f2);border-radius:12px;padding:8px 10px}.nlk>div.hl{border-color:#4b54d1;background:#eef0ff}.nlk span{display:block;font-size:12px;color:#6b7280}.nlk b{font-size:20px}.nltb{width:100%;border-collapse:collapse;font-size:13px}.nltb th{font-weight:500;color:#6b7280;text-align:right;padding:6px 8px;border-bottom:1px solid #eceef5;font-size:12px}.nltb td{padding:6px 8px;border-bottom:1px solid #eceef5;text-align:right}.nltb th:first-child,.nltb td:first-child{text-align:left}.nltb input{width:58px;text-align:right}@media(max-width:700px){.nlk{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>`;
let NLV={st:""};
/* khối "Video của tôi" ở Công việc › Việc của tôi */
function nlVideoToi(uid){const d=D(),S=nlStats(d,uid);if(!S.T.ct&&!S.cards.length&&!S.kho.length)return "";
  const own=CHANNELS.filter(k=>chanOwner(k.k)===uid),posted=d.cards.filter(c=>own.some(k=>k.k===c.kenh)&&c.step==="xong").length;
  const L=S.cards.map(c=>({id:c.id,sp:sk(c.sku).n,kn:chOf(c.kenh).short,st:nlSt(c),note:c.giao&&c.giao!==uid&&(c.nguoiLam||"")===uid?"Làm hộ dòng giao cho "+userName(c.giao):"",card:1}))
    .concat(S.kho.map(k=>({id:k.ma,sp:k.skuText||sk(k.sku).n,kn:"Kho video · chưa phân bổ",st:/đã duyệt/i.test(k.duyet||"")?["Đã duyệt","grn"]:["Chờ duyệt","vio"],note:""})));
  const F=L.filter(x=>!NLV.st||x.st[0]===NLV.st),con=Math.max(0,S.T.ct-S.T.duyet);
  return NL_CSS+`<section class="card" id="nl-toi" style="margin-bottom:12px"><div class="card-h"><h2>🎬 Video của tôi · tháng ${MONTH.mon}</h2><span class="hint">đếm theo người làm video, kể cả video làm cho kênh người khác phụ trách</span></div>
  <div class="nlk"><div class="hl"><span>Chỉ tiêu tháng</span><b>${S.T.ct}</b></div><div><span>Đã nộp</span><b>${S.T.nop}</b></div><div><span>Đã duyệt</span><b>${S.T.duyet}</b></div><div><span>Đã đăng</span><b>${S.T.dang}</b></div><div class="hl"><span>Còn cần làm</span><b style="color:${con?"#d92d20":"#2f9e5b"}">${con}</b></div></div>
  ${own.length?`<p class="hint">Kênh bạn phụ trách đăng: ${own.map(k=>esc(k.short)).join(", ")} · đã đăng ${posted} video (việc đăng, tính riêng với việc làm video).</p>`:""}
  <details ${NLV.open?"open":""} id="nl-det"><summary><b>Theo sản phẩm và danh sách video</b> <span class="hint">${L.length} video</span></summary>
  <div class="bvscroll" style="overflow-x:auto;margin-top:8px"><table class="nltb"><tr><th>Sản phẩm · kênh</th><th>Chỉ tiêu</th><th>Đã nộp</th><th>Đã duyệt</th><th>Đã đăng</th><th>Còn cần</th><th>Tiến độ</th></tr>
  ${S.R.map(r=>`<tr><td><b>${esc(sk(r.sku).n)}</b><br><small class="hint">${esc(chOf(r.kenh).short)}${chanOwner(r.kenh)&&chanOwner(r.kenh)!==uid?" · phụ trách: "+esc(userName(chanOwner(r.kenh))):""}</small></td><td>${r.ct}</td><td>${r.nop}</td><td>${r.duyet}</td><td>${r.dang}</td><td>${Math.max(0,r.ct-r.duyet)}</td><td>${nlBar(r.duyet,r.ct)}</td></tr>`).join("")}
  ${S.kho.length?`<tr><td><b>Kho video · chưa phân bổ kênh</b></td><td>—</td><td>${S.kho.length}</td><td>${S.kOk}</td><td>—</td><td>—</td><td></td></tr>`:""}</table></div>
  <div class="row7" style="margin:10px 0 6px;align-items:center"><select id="nl-st">${opt([["","Mọi trạng thái"],["Đang làm","Đang làm"],["Chờ duyệt","Chờ duyệt"],["Cần sửa","Cần sửa"],["Chờ đăng","Chờ đăng"],["Đã đăng","Đã đăng"],["Đã duyệt","Đã duyệt (kho)"]],NLV.st)}</select><span class="hint">${F.length} video</span></div>
  <div class="bvscroll" style="overflow-x:auto"><table class="nltb"><tr><th>Mã</th><th>Sản phẩm</th><th>Kênh</th><th>Trạng thái</th><th>Ghi chú</th></tr>
  ${F.slice(0,300).map(x=>`<tr><td>${x.card?`<a class="lnk" href="javascript:void 0" data-card="${esc(x.id)}">${esc(x.id)}</a>`:esc(x.id)}</td><td>${esc(x.sp||"")}</td><td>${esc(x.kn||"")}</td><td>${pill(x.st[0],x.st[1])}</td><td class="hint">${esc(x.note)}</td></tr>`).join("")||`<tr><td colspan="5" class="empty">Không có video.</td></tr>`}</table></div></details></section>`}
function nlVideoToiBind(m){const s=m.querySelector("#nl-st");if(s)s.onchange=()=>{NLV.st=s.value;NLV.open=1;renderMain()};const dt=m.querySelector("#nl-det");if(dt)dt.ontoggle=()=>{NLV.open=dt.open?1:0};
  m.querySelectorAll("#nl-toi [data-card]").forEach(a=>a.onclick=e=>{e.preventDefault();openCard(a.dataset.card)})}
/* bảng chia chỉ tiêu theo người ở ② Điều phối (một kênh) */
function nlCtHtml(d,kenh,team){const prs=ptPairs().filter(x=>x.kenh===kenh&&knShown(d,x)&&nlPlan(d,kenh,x.sku)>0);if(!prs.length)return "";
  const lead=xvGive(),ow=chanOwner(kenh);
  const ppl=team.filter(u=>prs.some(x=>nlTarget(d,u.id,kenh,x.sku))||d.cards.some(c=>c.kenh===kenh&&nlMade(c)&&mkOf(c)===u.id)||u.id===ow);
  const P=(BV.ctAll?team:ppl.length?ppl:team);
  return NL_CSS+`<details class="card" id="nl-ct" ${BV.ctOpen?"open":""} style="padding:10px 14px;margin-bottom:12px"><summary><b>Chỉ tiêu theo người · ${esc(chOf(kenh).short)}</b> <span class="hint">số video mỗi người làm trong tháng ${MONTH.mon}; chưa chia thì lấy theo số dòng đang giao</span></summary>
  <div class="bvscroll" style="overflow-x:auto;margin-top:8px"><table class="nltb"><tr><th>Sản phẩm</th><th>Kế hoạch kênh</th>${P.map(u=>`<th>${esc(u.name)}${u.id===ow?' <span class="pill p-blu">phụ trách</span>':""}</th>`).join("")}<th>Đã chia</th><th></th></tr>
  ${prs.map(x=>{const pl=nlPlan(d,kenh,x.sku),set=!!nlCt(d,kenh,x.sku),s=sum(team,u=>nlTarget(d,u.id,kenh,x.sku));
    return `<tr><td><b>${swatch(x.sku)}${esc(sk(x.sku).n)}</b>${set?"":'<br><small class="hint">đang theo dòng đã giao</small>'}</td><td>${pl}</td>${P.map(u=>`<td>${lead?`<input type="number" min="0" data-nlct="${esc(x.sku)}|${esc(u.id)}" value="${nlTarget(d,u.id,kenh,x.sku)}">`:nlTarget(d,u.id,kenh,x.sku)}</td>`).join("")}<td>${s}</td><td>${s===pl?pill("Khớp","grn"):s<pl?pill("Thiếu "+(pl-s),"amb"):pill("Thừa "+(s-pl),"red")}</td></tr>`}).join("")}</table></div>
  ${lead&&!BV.ctAll&&P.length<team.length?`<button type="button" class="btn sm ghost" id="nl-ctall" style="margin-top:6px">+ Hiện thêm nhân sự</button>`:""}</details>`}
function nlCtBind(m,kenh){const dt=m.querySelector("#nl-ct");if(!dt)return;dt.ontoggle=()=>{BV.ctOpen=dt.open};
  const a=m.querySelector("#nl-ctall");if(a)a.onclick=()=>{BV.ctAll=true;BV.ctOpen=true;renderMain()};
  m.querySelectorAll("[data-nlct]").forEach(i=>i.onchange=()=>{const [sku,uid]=i.dataset.nlct.split("|"),v=Math.max(0,Math.floor(+i.value||0)),team=xvTeam();
    DB.mutate(ME.name,`chia chỉ tiêu ${sk(sku).n} · ${chOf(kenh).short}: ${userName(uid)} ${v} video`,dt2=>{const k=nlKey();dt2.ctNguoi=dt2.ctNguoi||{};dt2.ctNguoi[k]=dt2.ctNguoi[k]||{};const o=dt2.ctNguoi[k][kenh]=dt2.ctNguoi[k][kenh]||{};
      if(!o[sku]){const seed={};team.forEach(u=>{const n=nlTarget(dt2,u.id,kenh,sku);if(n)seed[u.id]=n});o[sku]=seed}o[sku][uid]=v});BV.ctOpen=true;renderMain()})}
/* Năng suất nhân sự (Tổng quan Content): mỗi video tính cho đúng một người làm; tháng đang chạy có chỉ tiêu theo người */
function nlPeople(d,C,past,wOrd){
  const ids=new Set(C.filter(nlMade).map(mkOf).filter(Boolean));if(!past)xvTeam().forEach(u=>{if(ptPairs().some(x=>knShown(d,x)&&nlTarget(d,u.id,x.kenh,x.sku)))ids.add(u.id)});
  return [...ids].map(id=>{const S=past?null:nlStats(d,id),mine=C.filter(c=>nlMade(c)&&mkOf(c)===id),hc=mine.flatMap(c=>(c.hanCu||[]).filter(h=>h.han&&h.xong)),ps=mine.filter(c=>c.step==="xong"),g=sum(ps,c=>+c.gmv||0);
    const grp={};mine.forEach(c=>{const k=c.kenh+"|"+c.sku;(grp[k]=grp[k]||{kenh:c.kenh,sku:c.sku,ct:0,L:[]}).L.push(c)});
    const R=S?S.R:Object.values(grp).map(r=>Object.assign(r,{nop:r.L.filter(c=>NL_NOP.includes(c.step)).length,duyet:r.L.filter(c=>NL_OK.includes(c.step)).length,dang:r.L.filter(c=>c.step==="xong").length}));
    const own=CHANNELS.filter(k=>chanOwner(k.k)===id);
    return {id,R,ct:S?S.T.ct:0,nop:S?S.T.nop:sum(R,r=>r.nop),duyet:S?S.T.duyet:sum(R,r=>r.duyet),dang:ps.length,ontime:hc.length?hc.filter(h=>+h.xong<=+h.han).length/hc.length:null,
      win:ps.filter(c=>(+c.don||0)>=wOrd&&(+c.don||0)>0).length,gmv:g,own:own.map(k=>k.short),posted:C.filter(c=>own.some(k=>k.k===c.kenh)&&c.step==="xong").length}})
   .filter(r=>r.ct||r.nop||r.R.length).sort((a,b)=>b.duyet-a.duyet||b.ct-a.ct)}
