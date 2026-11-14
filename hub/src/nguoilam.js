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
  if(typeof mixOf==="function"&&mixOf(c)==="ton"){const k=nlKhoNew(c);return k?(k.nguoiId||uidByName(k.nguoi)):""} // video tồn đăng lại: không tính là làm mới cho người đăng
  return c.nguoiKB||c.giao||nlUp(c)||(["dang","xong"].includes(c.step)?"":c.nguoi)||""}
/* người đã dán link / nộp video (theo lịch sử thẻ), dùng khi dòng không ghi ai làm */
function nlUp(c){const h=(c.history||[]).filter(x=>/Dán link|Nhập nhanh|gửi Lead duyệt/i.test(x.txt||"")||x.to==="dvd").pop();return h?uidByName(h.by||h.who):""}
const NL_NOP=["dvd","dceo","dang","xong"],NL_OK=["dang","xong"];
function nlSt(c){if(c.step==="xong")return ["Đã đăng","grn"];if(c.step==="dang")return ["Chờ đăng","blu"];if(["dvd","dceo"].includes(c.step))return ["Chờ duyệt","vio"];
  if(c.step==="edit"&&(c.duyet==="Cần sửa"||(c.gopy||[]).length&&(c.linkVideo||c.linkFinal)))return ["Cần sửa","red"];return ["Đang làm","amb"]}
/* video kho làm MỚI trong tháng (nhập nhanh vào Kho rồi mới gắn kênh dạng video tồn) vẫn là video làm mới, không phải video cũ đăng lại (14/11) */
function nlKhoNew(c){if(!c.khoMa)return null;const k=(D().kho||[]).find(x=>x.ma===c.khoMa);if(!k||String(k.ngaySX||"").slice(0,7)!==MONTH.key||k.agency||/agency/i.test(k.nguonFile||""))return null;return k}
const nlMade=c=>BV_RT.includes(mixOf(c))||(mixOf(c)==="ton"&&(!!c.nguoiLam||!!nlKhoNew(c)));
const nlKey=()=>MONTH.key;
const nlPlan=(d,kenh,sku)=>sum(BV_RT,t=>bvPlanN(d,sku,kenh,t));
function nlCt(d,kenh,sku){const o=((d.ctNguoi||{})[nlKey()]||{})[kenh];return o&&o[sku]?o[sku]:null}
/* chỉ tiêu của một người ở một kênh × sản phẩm */
function nlTarget(d,uid,kenh,sku){const o=nlCt(d,kenh,sku);if(o)return +o[uid]||0;return d.cards.filter(c=>c.kenh===kenh&&c.sku===sku&&nlMade(c)&&nlAsg(c)===uid).length}
/* người được giao dòng (chỉ tiêu mặc định giữ cho người được giao, kể cả khi người khác làm hộ) */
const nlAsg=c=>c.giao||c.nguoiKB||c.nguoiEdit||(c.nguoiLam&&!c.giao?c.nguoiLam:"")||(["dang","xong"].includes(c.step)?"":c.nguoi)||"";
/* ---------- 14/11 (chị Hoa): nhân sự luôn kiểm soát được video mình làm, không phải đi tìm ----------
   Mỗi video của một người có đúng 1 trạng thái:
   chua = được giao, chưa làm · sua = cần sửa · cho = chờ duyệt (V1/V2, kho chờ duyệt) · ok = đã duyệt, chờ đăng (kể cả kho đã duyệt chưa phân bổ) · dang = đã đăng.
   Đã làm = cho + ok + dang. Còn thiếu = KPI − Đã làm. Lọc bấm chọn theo trạng thái, sản phẩm, kênh. */
const NL_ST=[["chua","Được giao, chưa làm","amb"],["sua","Cần sửa","red"],["cho","Chờ duyệt","vio"],["ok","Đã duyệt, chờ đăng","blu"],["dang","Đã đăng","grn"]];
const NL_KHO="Kho chưa phân bổ";
function nlCardSt(c){if(c.step==="xong")return "dang";if(c.step==="dang")return "ok";if(["dvd","dceo"].includes(c.step))return "cho";
  if(c.duyet==="Cần sửa"||(c.gopy||[]).length&&(c.linkVideo||c.linkFinal))return "sua";return "chua"}
function nlItems(d,uid){
  const cards=d.cards.filter(c=>nlMade(c)&&mkOf(c)===uid);
  const used=new Set(d.cards.map(c=>c.khoMa).filter(Boolean)),mk=MONTH.key;
  const kho=(d.kho||[]).filter(k=>k.link&&!used.has(k.ma)&&!/agency/i.test(k.agency||"")&&(k.nguoiId===uid||(!k.nguoiId&&uidByName(k.nguoi)===uid))&&String(k.ngaySX||"").slice(0,7)===mk);
  const I=cards.map(c=>({id:c.id,sku:c.sku,kn:chOf(c.kenh).short,kenh:c.kenh,st:nlCardSt(c),sub:c.step==="dvd"?"Chờ duyệt V1":c.step==="dceo"?"Chờ duyệt V2":"",link:c.linkFinal||c.linkVideo||"",note:c.giao&&c.giao!==uid&&(c.nguoiLam||"")===uid?"Làm hộ dòng giao cho "+userName(c.giao):"",card:1}))
    .concat(kho.map(k=>{const ok=/đã duyệt/i.test(k.duyet||"");return {id:k.ma,sku:k.sku||"",kn:NL_KHO,kenh:"",st:ok?"ok":"cho",sub:ok?"Đã duyệt, chưa phân bổ kênh":/ceo/i.test(k.duyet||"")?"Chờ CEO duyệt":"Chờ Lead duyệt",link:k.link,note:""}}));
  return {I,cards,kho}}
/* KPI của người ở một sản phẩm (kênh "" = mọi kênh) */
function nlKpi(d,uid,sku,kenh){return sum(ptPairs().filter(x=>knShown(d,x)&&x.sku===sku&&(!kenh||chOf(x.kenh).short===kenh)),x=>nlTarget(d,uid,x.kenh,x.sku))}
function nlSum(I,ct){const n=k=>I.filter(x=>x.st===k).length,lam=n("cho")+n("ok")+n("dang");return {chua:n("chua"),sua:n("sua"),cho:n("cho"),ok:n("ok"),dang:n("dang"),lam,tong:I.length,ct,thieu:ct?Math.max(0,ct-lam):0}}
/* thống kê của một người theo sản phẩm (dùng cho Năng suất nhân sự) */
function nlStats(d,uid){const {I,cards,kho}=nlItems(d,uid),skus=new Set(I.map(x=>x.sku));
  ptPairs().filter(x=>knShown(d,x)).forEach(x=>{if(nlTarget(d,uid,x.kenh,x.sku))skus.add(x.sku)});
  const R=[...skus].map(s=>{const L=I.filter(x=>x.sku===s),S=nlSum(L,nlKpi(d,uid,s,"")),ws={};L.filter(x=>x.st!=="chua").forEach(x=>ws[x.kn]=(ws[x.kn]||0)+1);
    return Object.assign(S,{sku:s,nop:S.lam,duyet:S.ok+S.dang,ctLead:ptPairs().some(x=>x.sku===s&&nlCt(d,x.kenh,s)),where:Object.entries(ws).map(([k,n])=>k+" "+n).join(" · ")})}).sort((a,b)=>b.ct-a.ct||b.lam-a.lam);
  const T=Object.assign(nlSum(I,sum(R,r=>r.ct)),{thieu:sum(R,r=>r.thieu),lead:R.some(r=>r.ctLead),win:cards.filter(c=>c.step==="xong"&&(+c.don||0)>=(+d.settings.winnerOrders||0)&&(+c.don||0)>0).length,gmv:sum(cards.filter(c=>c.step==="xong"),c=>+c.gmv||0)});
  T.nop=T.lam;T.duyet=T.ok+T.dang;return {R,kho,T,cards,I}}
const nlBar=(a,b)=>`<span class="nlbar"><i style="width:${b?Math.min(100,a/b*100).toFixed(0):0}%"></i></span>`;
const NL_CSS=`<style>.nlbar{display:inline-block;width:80px;height:8px;border-radius:99px;background:#e6e9f2;overflow:hidden;vertical-align:middle}.nlbar i{display:block;height:100%;background:#2f9e5b}.nlk{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px;margin:8px 0}.nlk>button{font:inherit;text-align:left;cursor:pointer;border:1px solid var(--line,#e6e9f2);background:var(--card,#fff);color:inherit;border-radius:12px;padding:8px 10px}.nlk>button.on{border-color:#4b54d1;box-shadow:0 0 0 2px #c7cbff}.nlk>.hl{background:#eef0ff;border-color:#c7cbff}.nlk span{display:block;font-size:12px;color:#6b7280}.nlk b{font-size:20px}.nlchips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.nlchips b{font-size:12px;color:#6b7280;margin-right:2px;align-self:center}.nlchips button{font:inherit;font-size:13px;border:1px solid var(--line,#e6e9f2);background:var(--card,#fff);color:inherit;border-radius:999px;padding:3px 10px;cursor:pointer}.nlchips button.on{background:#4b54d1;border-color:#4b54d1;color:#fff}.nltb{width:100%;border-collapse:collapse;font-size:13px}.nltb th{font-weight:500;color:#6b7280;text-align:right;padding:6px 8px;border-bottom:1px solid #eceef5;font-size:12px}.nltb td{padding:6px 8px;border-bottom:1px solid #eceef5;text-align:right}.nltb th:first-child,.nltb td:first-child{text-align:left}.nltb td.clk{cursor:pointer;color:#4b54d1}.nltb td.clk:hover{text-decoration:underline}.nltb tr.tot td{font-weight:700}.nltb input{width:58px;text-align:right}</style>`;
let NLV={st:"",sp:"",kn:"",uid:""};
/* khối "Video của tôi" ở Công việc › Việc của tôi (Lead/CEO chọn xem của từng người) */
function nlVideoToi(uid0){const d=D(),boss=xvGive(),team=xvTeam();if(boss&&NLV.uid&&!team.some(u=>u.id===NLV.uid))NLV.uid="";const uid=boss&&NLV.uid?NLV.uid:uid0;
  const {I}=nlItems(d,uid),hasKpi=ptPairs().some(x=>knShown(d,x)&&nlTarget(d,uid,x.kenh,x.sku));
  if(!boss&&!I.length&&!hasKpi)return "";
  const fK=x=>!NLV.kn||x.kn===NLV.kn,fS=x=>!NLV.sp||x.sku===NLV.sp,fT=x=>!NLV.st||x.st===NLV.st;
  const skus=[...new Set(I.map(x=>x.sku).concat(ptPairs().filter(x=>knShown(d,x)&&nlTarget(d,uid,x.kenh,x.sku)).map(x=>x.sku)))];
  const kns=[...new Set(I.map(x=>x.kn).concat(ptPairs().filter(x=>knShown(d,x)&&nlTarget(d,uid,x.kenh,x.sku)).map(x=>chOf(x.kenh).short)))];
  const ctOf=s=>NLV.kn===NL_KHO?0:nlKpi(d,uid,s,NLV.kn);
  /* số tổng theo bộ lọc sản phẩm + kênh (bấm ô trạng thái để lọc danh sách) */
  const base=I.filter(fK).filter(fS),S=nlSum(base,sum(NLV.sp?[NLV.sp]:skus,ctOf));
  const chip=(k,v,l,n)=>`<button type="button" data-nlf="${k}|${esc(v)}" class="${NLV[k]===v?"on":""}">${l}${n!=null?" · "+n:""}</button>`;
  const rows=skus.map(s=>{const L=I.filter(fK).filter(x=>x.sku===s);return Object.assign(nlSum(L,ctOf(s)),{sku:s})}).filter(r=>r.tong||r.ct).sort((a,b)=>b.ct-a.ct||b.tong-a.tong);
  const T=nlSum(I.filter(fK),sum(rows,r=>r.ct));T.thieu=sum(rows,r=>r.thieu);
  const cell=(s,k,n)=>`<td class="${n?"clk":""}" ${n?`data-nlcell="${esc(s)}|${k}"`:""}>${n}</td>`;
  const F=I.filter(fK).filter(fS).filter(fT),ord={sua:0,chua:1,cho:2,ok:3,dang:4};F.sort((a,b)=>ord[a.st]-ord[b.st]||String(b.id).localeCompare(String(a.id)));
  const lead=ptPairs().some(x=>knShown(d,x)&&nlCt(d,x.kenh,x.sku));
  return NL_CSS+`<section class="card" id="nl-toi" style="margin-bottom:12px"><div class="card-h"><h2>🎬 Video ${boss&&uid!==ME.id?"của "+esc(userName(uid)):"của tôi"} · tháng ${MONTH.mon}</h2>${boss?`<select id="nl-who" style="margin-left:auto">${opt([[ "","Của tôi"]].concat(team.filter(u=>u.id!==ME.id).map(u=>[u.id,u.name])),NLV.uid)}</select>`:""}</div>
  <div class="nlk"><div class="hl" style="border:1px solid #c7cbff;border-radius:12px;padding:8px 10px"><span>KPI tháng</span><b>${S.ct||"—"}</b></div><div class="hl" style="border:1px solid #c7cbff;border-radius:12px;padding:8px 10px"><span>Đã làm</span><b>${S.lam}</b>${S.ct?` <small class="hint">còn thiếu <b style="font-size:14px;color:${S.thieu?"#d92d20":"#2f9e5b"}">${S.thieu}</b></small>`:""}</div>
   ${NL_ST.map(([k,l])=>`<button type="button" data-nlf="st|${k}" class="${NLV.st===k?"on":""}"><span>${l}</span><b>${S[k]}</b></button>`).join("")}</div>
  <p class="hint" style="margin:0 0 6px">${S.ct?(lead?"KPI do Lead chia ở ② Điều phối.":"Lead chưa chia KPI theo người: KPI đang tạm lấy số dòng video giao cho "+(uid===ME.id?"bạn":"người này")+"."):"Chưa có KPI theo người."} Đã làm = chờ duyệt + đã duyệt + đã đăng. Bấm một ô để lọc danh sách bên dưới.</p>
  <div class="nlchips"><b>Sản phẩm</b>${chip("sp","","Tất cả")}${skus.map(s=>chip("sp",s,esc(sk(s).n),I.filter(fK).filter(x=>x.sku===s).length)).join("")}</div>
  <div class="nlchips"><b>Kênh</b>${chip("kn","","Tất cả")}${kns.map(k=>chip("kn",k,esc(k),I.filter(fS).filter(x=>x.kn===k).length)).join("")}</div>
  <div class="bvscroll" style="overflow-x:auto;margin-top:6px"><table class="nltb"><tr><th>Sản phẩm</th><th>KPI</th><th>Đã làm</th><th>Còn thiếu</th>${NL_ST.map(([k,l])=>`<th>${l}</th>`).join("")}<th>Tổng video</th><th>Tiến độ</th></tr>
  ${rows.map(r=>`<tr><td><b>${swatch(r.sku)}${esc(sk(r.sku).n)}</b></td><td>${r.ct||"—"}</td><td>${r.lam}</td><td>${r.ct?r.thieu:"—"}</td>${NL_ST.map(([k])=>cell(r.sku,k,r[k])).join("")}<td>${r.tong}</td><td>${r.ct?nlBar(r.lam,r.ct):""}</td></tr>`).join("")}
  <tr class="tot"><td>Tổng</td><td>${T.ct||"—"}</td><td>${T.lam}</td><td>${T.ct?T.thieu:"—"}</td>${NL_ST.map(([k])=>`<td>${T[k]}</td>`).join("")}<td>${T.tong}</td><td>${T.ct?nlBar(T.lam,T.ct):""}</td></tr></table></div>
  <div class="row7" style="margin:12px 0 6px;align-items:center"><b>Danh sách video</b><span class="hint">${F.length} video${NLV.st||NLV.sp||NLV.kn?` theo bộ lọc · <a class="lnk" href="javascript:void 0" id="nl-clr">Bỏ lọc</a>`:""}</span></div>
  <div class="bvscroll" style="overflow-x:auto;max-height:520px;overflow-y:auto"><table class="nltb"><tr><th>Mã</th><th>Sản phẩm</th><th>Kênh</th><th>Trạng thái</th><th>Video</th><th>Ghi chú</th></tr>
  ${F.slice(0,400).map(x=>{const s=NL_ST.find(z=>z[0]===x.st);return `<tr><td>${x.card?`<a class="lnk" href="javascript:void 0" data-card="${esc(x.id)}">${esc(x.id)}</a>`:esc(x.id)}</td><td>${esc(sk(x.sku).n)}</td><td>${esc(x.kn)}</td><td>${pill(x.sub||s[1],s[2])}</td><td>${x.link?`<a class="lnk" href="${esc(/^https?:/.test(x.link)?x.link:"https://"+x.link)}" target="_blank" rel="noopener">Mở ↗</a>`:""}</td><td class="hint">${esc(x.note)}</td></tr>`}).join("")||`<tr><td colspan="6" class="empty">Không có video.</td></tr>`}</table></div></section>`}
function nlVideoToiBind(m){
  m.querySelectorAll("#nl-toi [data-nlf]").forEach(b=>b.onclick=()=>{const [k,v]=b.dataset.nlf.split("|");NLV[k]=NLV[k]===v?"":v;renderMain()});
  m.querySelectorAll("#nl-toi [data-nlcell]").forEach(td=>td.onclick=()=>{const [s,k]=td.dataset.nlcell.split("|");NLV.sp=s;NLV.st=k;renderMain();setTimeout(()=>{const x=document.querySelector("#nl-toi .row7");if(x)x.scrollIntoView({block:"start",behavior:"smooth"})},50)});
  const c=m.querySelector("#nl-clr");if(c)c.onclick=()=>{NLV.st=NLV.sp=NLV.kn="";renderMain()};
  const w=m.querySelector("#nl-who");if(w)w.onchange=()=>{NLV.uid=w.value;NLV.st=NLV.sp=NLV.kn="";renderMain()};
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
    const grp={};mine.forEach(c=>{(grp[c.sku]=grp[c.sku]||{sku:c.sku,ct:0,L:[]}).L.push(c)});
    const R=S?S.R:Object.values(grp).map(r=>Object.assign(r,{where:"",cho:r.L.filter(c=>["dvd","dceo"].includes(c.step)).length,nop:r.L.filter(c=>NL_NOP.includes(c.step)).length,duyet:r.L.filter(c=>NL_OK.includes(c.step)).length,dang:r.L.filter(c=>c.step==="xong").length}));
    const own=CHANNELS.filter(k=>chanOwner(k.k)===id);
    return {id,R,ct:S?S.T.ct:0,thieu:S?S.T.thieu:0,cho:S?S.T.cho:sum(R,r=>r.cho),nop:S?S.T.nop:sum(R,r=>r.nop),duyet:S?S.T.duyet:sum(R,r=>r.duyet),dang:ps.length,ontime:hc.length?hc.filter(h=>+h.xong<=+h.han).length/hc.length:null,
      win:ps.filter(c=>(+c.don||0)>=wOrd&&(+c.don||0)>0).length,gmv:g,own:own.map(k=>k.short),posted:C.filter(c=>own.some(k=>k.k===c.kenh)&&c.step==="xong").length}})
   .filter(r=>r.ct||r.nop||r.R.length).sort((a,b)=>b.duyet-a.duyet||b.ct-a.ct)}
