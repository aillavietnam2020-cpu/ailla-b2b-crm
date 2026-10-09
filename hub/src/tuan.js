/* =====================================================================
   XẾP VIỆC TUẦN theo cách team làm thật:
   ① Kế hoạch tuần: tuần này làm bao nhiêu video mỗi sản phẩm × kênh, cái nào làm trước
   ② Video tồn: dùng video cũ trước
   ③ Buổi quay & hook: mỗi buổi quay (1–2 ngày/tuần) có danh sách hook chuẩn bị trước,
      one shot chỉ cần hook (người duyệt cả danh sách), quay xong tick hook đã quay + ghi hook phát sinh
   ④ Edit · ⑤ Lịch đăng: nhịp đăng theo giai đoạn (trước sale đăng dày hơn), video duyệt xong
      tự xếp vào ô trống — sản phẩm đẩy chính được nhiều ô, sản phẩm ít video thì đăng cách ngày.
   Kế hoạch tháng chỉ là quỹ video (KPI + tuyến), không gắn ngày.
   ===================================================================== */
const cDay=c=>c.day||c.qday||0;
const WP_UU=[["","Chưa xếp"],["p1","P1"],["p2","P2"],["p3","P3"],["p4","P4"]];
const uuN=u=>({truoc:"p1",sale:"p1",thuong:"",sau:"p4"})[u]??(u||""); // đổi giá trị cũ sang P1–P4
const wpKey=(sku,kenh)=>sku+"|"+kenh;
const wpOf=(d,w)=>((d.weekPlan||{})[w])||{};
/* số ô đăng mỗi ngày: lấy theo Mục tiêu video của kênh (calCap); chỉ khi kênh chưa có mục tiêu mới dùng nhịp đăng cũ */
const nhipOf=(kenh,day)=>calCap(kenh,day);
const nhipOld=(kenh,day)=>{const R=(((D().settings||{}).nhip||{})[kenh]||[]).find(r=>day>=r.tu&&day<=r.den);return R?+R.sl:(slotsOf()[kenh]||0)};
/* số video / tuần của một sản phẩm ở một kênh: lấy kế hoạch tuần, chưa có thì lấy KPI tháng chia số tuần */
let perWeek=function(d,sku,kenh,day){const w=weekOf(day||d.settings.today)||1,e=wpOf(d,w)[wpKey(sku,kenh)];if(e&&+e.sl)return +e.sl;const p=d.products.find(x=>x.k===sku),k=p&&pKenhs(p).find(x=>x.kenh===kenh);return k&&+k.sl?+k.sl/(MONTH.ndays/7):3};
const uuRank=(d,c)=>{if((d.hot||[]).some(h=>h.sku===c.sku&&h.kenh===c.kenh&&d.settings.today<=h.den))return -1;const e=wpOf(d,weekOf(c.qday||d.settings.today)||1)[wpKey(c.sku,c.kenh)];return {p1:0,p2:1,"":2,p3:2,p4:3}[uuN(e&&e.uu)]};
/* Xếp ngày đăng cho video chưa có ngày (đã quay xong trở đi), theo nhịp đăng từng kênh */
function autoSlot(dt,ids){
  const today=dt.settings.today,el=dt.cards.filter(c=>!c.day&&["edit","worker","dvd","dceo","dang"].includes(c.step)&&(!ids||ids.includes(c.id)));
  el.sort((a,b)=>uuRank(dt,a)-uuRank(dt,b)||(b.step==="dang")-(a.step==="dang")||(a.qday||0)-(b.qday||0));
  let n=0;const on=(k,x)=>dt.cards.filter(c=>c.kenh===k&&c.day===x);
  el.forEach(c=>{const per=perWeek(dt,c.sku,c.kenh,c.qday),gap=per>=7?0:Math.max(0,Math.floor(7/Math.max(1,per))-1),maxDay=per>=7?Math.max(1,Math.round(per/7)):1;
    const st=Math.min(MONTH.ndays,Math.max(today,(c.qday||today)+(c.step==="dang"?0:1)));let pick=0;
    for(let x=st;x<=MONTH.ndays&&!pick;x++){const L=on(c.kenh,x);if(L.length>=nhipOf(c.kenh,x))continue;if(L.filter(y=>y.sku===c.sku).length>=maxDay)continue;
      if(gap&&dt.cards.some(y=>y!==c&&y.kenh===c.kenh&&y.sku===c.sku&&y.day&&Math.abs(y.day-x)<=gap))continue;pick=x}
    for(let x=st;x<=MONTH.ndays&&!pick;x++)if(on(c.kenh,x).length<nhipOf(c.kenh,x))pick=x;
    if(pick){c.day=pick;n++}});
  return n}
/* Ngày đăng do người giữ kênh tự xếp (không tự xếp hộ) */

/* ---------- ① Kế hoạch tuần: mỗi sản phẩm × kênh chia theo loại video, các bước sau bám theo số này ---------- */
const MIX=[["ton","Dùng video tồn","kho","đăng lại video cũ trong kho"],["oneshot","One shot","quay","viết hook, rồi quay"],["kichban","Review / voice off","quay","viết kịch bản, rồi quay"],["worker","Không quay · Worker","wk","order Worker, Worker tự làm"],["reup","Reup","wk","gửi link video gốc cho Worker"],["outsource","Order outsource","wk","gửi brief cho bên ngoài làm, nhận video về"],["nhanban","Nhân bản win","win","Hypit ra kịch bản, rồi quay (làm ở trang Video win)"]];
const VID_STEPS=["dvd","dceo","dang","xong"];
const mixOf=c=>{if(c.mix)return c.mix;const L=loaiOf(c);if(c.khoMa)return L==="kho"?"ton":"reup";if(L==="worker")return "worker";if(L==="nhanban")return "nhanban";if(L==="reup")return "reup";if(L==="kho")return "ton";return c.oneShot||c.phatSinh?"oneshot":"kichban"};
const wpMix=e=>e&&e.mix?e.mix:{};
const wpPlan=(x,M,e)=>M&&+x.sl?+x.sl:wpTot(e); // cả tháng: tổng kế hoạch lấy theo KPI kênh ở Bước 5
/* Chọn số cả tháng rồi không phải chia từng tuần: tự chia theo mục tiêu mỗi ngày (ngày sale nhiều video hơn), dư chia cho tuần có mục tiêu lớn nhất */
function wpSplit(total,wt){const s=wt.reduce((a,b)=>a+b,0)||1,raw=wt.map(x=>total*x/s),base=raw.map(Math.floor);let rest=total-base.reduce((a,b)=>a+b,0);raw.map((r,i)=>[r-Math.floor(r),i]).sort((a,b)=>b[0]-a[0]).forEach(([,i])=>{if(rest>0){base[i]++;rest--}});return base}
function wpAutoEntry(d,sku,kenh,sl,w){
  const W5=PB_W(),KP=knPlan(d,kenh),wt0=KP.map(m=>m[sku]||0),wt=wt0.some(n=>n>0)?wt0:W5.map(v=>v.den-v.tu+1),mm=wpMix((wpOf(d,"M")[wpKey(sku,kenh)])||{}),i=w-1;
  const has=Object.values(mm).some(n=>+n>0);
  if(has){const mix={};Object.keys(mm).forEach(tp=>{const n=+mm[tp]||0;if(n)mix[tp]=wpSplit(n,wt)[i]});return {mix,sl:Object.values(mix).reduce((a,b)=>a+b,0),auto:1}}
  return +sl?{sl:wpSplit(+sl,wt)[i],auto:1}:{}
}
const wpTot=e=>{const m=wpMix(e);const s=Object.values(m).reduce((a,b)=>a+(+b||0),0);return s||(+((e||{}).sl)||0)};
function wpWeekNo(d,W,days){return days.length<=7?weekOf(W.tu):weekOf(d.settings.today)||1}
let WP_OPEN=new Set();
const WP_EDIT=new Set();
const WPCH_CLOSED=new Set();
let OW_K="";const OW_OPEN=new Set(),OW_AUTO=new Set();
let WP_K="";
function xvTuan(b,o){
  const {d,W,days,give,team}=o,today=d.settings.today,w=wpWeekNo(d,W,days),WW=WEEKS.find(x=>x.w===w)||WEEKS[0],wp=wpOf(d,w),pairs=ptPairs(),free=xvKhoFree();
  const SC=d.settings.planScope||{},isM=k=>SC[k]==="thang",WM={w:"M",tu:1,den:MONTH.ndays},wpM=wpOf(d,"M");
  const inW=c=>{const x=cDay(c);return x>=WW.tu&&x<=WW.den};
  const pw=WEEKS.find(y=>y.w===w-1);
  const block=x=>{const M=isM(x.kenh),w2=M?"M":w,WW2=M?WM:WW,wp2=M?wpM:wp,inW2=c=>{if(M)return true;const y=cDay(c);return y>=WW2.tu&&y<=WW2.den};const k=wpKey(x.sku,x.kenh),e0=wp2[k]||{},e=!M&&!wpTot(e0)?Object.assign(wpAutoEntry(d,x.sku,x.kenh,x.sl,w2),e0.uu?{uu:e0.uu}:{}):e0,m=wpMix(e),C=d.cards.filter(c=>c.sku===x.sku&&c.kenh===x.kenh),CW=C.filter(inW2),tot=wpPlan(x,M,e),chia=wpTot(e),kho=free.filter(q=>q.sku===x.sku).length,prev=!M&&pw?C.filter(c=>{const z=cDay(c);return z>=pw.tu&&z<=pw.den}):[],op=WP_OPEN.has(k);
    const TKW=(d.tasks||[]).filter(z=>z.mix==="nhanban"&&z.sku===x.sku&&z.kenh===x.kenh&&(M||z.wk===w2)),gW=CW.length+sum(TKW,z=>z.sl||1),p=tot?Math.min(100,Math.round(gW/tot*100)):0,hien=((d.loaiHien||{})[k])||[],shownT=ty=>(+m[ty]||0)>0||hien.includes(ty)||CW.some(c=>mixOf(c)===ty)||(ty==="nhanban"&&TKW.length>0),hid=MIX.filter(z=>!shownT(z[0])),addRow=give&&hid.length?`<div class="wpadd"><select data-ltsel="${esc(k)}">${opt(hid.map(z=>[z[0],z[1]]),hid[0][0])}</select><button type="button" class="btn sm ghost" data-ltadd="${esc(k)}">+ Thêm loại video</button></div>`:"",typeChips=`<div class="tyrow dang"><b>Dạng nội dung</b><span class="hint">chọn số lượng</span>${MIX.filter(z=>shownT(z[0])).map(z=>{const n=+m[z[0]]||0,dn=CW.filter(c=>mixOf(c)===z[0]).length+(z[0]==="nhanban"?sum(TKW,y=>y.sl||1):0);const stc=n&&dn>=n?"full":dn>0?"part":"none",rowsN=C.filter(c=>mixOf(c)===z[0]).length;return `<span class="tchip dk num ${stc}">${esc(z[1])} ${give?`<input type="number" min="0" class="num dkn" data-dkn="${esc(k)}|${z[0]}" value="${n}" title="Số video cả tháng của dạng này">`:`<b>${n}</b>`}<small>${rowsN} dòng</small>${give?`<button type="button" class="tydel" data-ltdel="${esc(x.sku)}|${esc(x.kenh)}|${z[0]}|${w2}" title="Bỏ dạng này khỏi sản phẩm (nếu thêm nhầm)">✕</button>`:""}</span>`}).join("")||`<span class="hint">chưa chia dạng nội dung · thêm dạng ở nút bên cạnh</span>`}${(()=>{const T=MIX.reduce((s,z)=>s+(+m[z[0]]||0),0),kp=+x.sl||0;return kp?(T!==kp?` ${pill("các dạng cộng "+T+" · KPI "+kp+(T>kp?" · thừa "+(T-kp):" · thiếu "+(kp-T)),"amb")}${give&&M&&C.length?` <button type="button" class="btn sm ghost" data-dkfix="${esc(k)}" title="Đặt số chia từng dạng bằng đúng số video đang có của dạng đó">Lấy theo video đã có</button>`:""}`:` ${pill("khớp KPI "+kp,"grn")}`):""})()}${addRow}${give?`<button type="button" class="btn sm pri dkgo" data-pcgo="${esc(k)}">Điều phối →</button>`:""}</div>`;
    return `<div class="wpb${op?" open":""}"><div class="wph" data-wpo="${esc(k)}"><i class="ptar">${op?"▾":"▸"}</i>${swatch(x.sku)}<b>${esc(sk(x.sku).n)}</b>${pill(x.huong,x.huong==="Đẩy mạnh"?"pnk":"gry")}
      <span class="sp"></span>${give?`<select data-wpuu="${esc(k)}|${w2}" title="Mức ưu tiên tuần này">${opt(WP_UU,uuN(e.uu))}</select>`:pill((WP_UU.find(u=>u[0]===uuN(e.uu))||WP_UU[0])[1])}</div>
     <div class="wpi"><span>KPI tháng <b>${x.sl||"—"}</b></span><span title="Đã giao: số việc đã giao người (kể cả chưa làm), tính cả việc giao lúc lên kế hoạch theo tuần. Đã có video: đã có video duyệt xong trở lên. Đã đăng: đã đăng lên kênh.">${M?"cả tháng":"tuần này"}: đã giao <b class="${tot&&gW>tot?"t-red":""}">${gW}</b>${tot?`/${tot}`:""}${tot&&gW>tot?` <span class="gop" data-gop="thua|${esc(x.sku)}|${esc(x.kenh)}" title="Bấm để xem các dòng thừa ở Điều phối">${pill("giao thừa "+(gW-tot),"amb")}</span>`:""} · đã có video <b>${C.filter(c=>VID_STEPS.includes(c.step)).length}</b> · đã đăng <b>${C.filter(c=>c.step==="xong").length}</b>${x.sl&&x.sl>C.filter(c=>VID_STEPS.includes(c.step)).length?` · <span class="gop t-red" data-gop="thieu|${esc(x.sku)}|${esc(x.kenh)}" title="Bấm để tới chỗ cần làm thêm (Kho video tồn hoặc Điều phối)">còn thiếu ${x.sl-C.filter(c=>VID_STEPS.includes(c.step)).length} video</span>`:""}</span><span>video tồn chưa ai chọn <b>${kho}</b>${(+m.ton||0)+(+m.reup||0)?` (${M?"kế hoạch dùng":"tuần này dùng"} ${(+m.ton||0)+(+m.reup||0)}, đã chọn ${CW.filter(c=>c.khoMa).length})`:""}</span>${M?"":`<span>tuần trước <b>${prev.length}</b> video · ${sum(prev,c=>c.don||0)} đơn</span>`}</div>
     ${wpTuyRow(d,x,give)}
     ${typeChips}</div>`};
  const avail=CHANNELS.filter(ch=>pairs.some(x=>x.kenh===ch.k));if(!WP_K||!avail.some(c=>c.k===WP_K))WP_K=(avail[0]||{}).k||"";
  const tabs=avail.length?`<div class="seg ptk">${avail.map(ch=>`<button data-wpk="${esc(ch.k)}" class="${ch.k===WP_K?"on":""}">${esc(ch.short)} <span class="xbadge">${pairs.filter(x=>x.kenh===ch.k&&knShown(d,x)).length}</span></button>`).join("")}</div>`:"";
  const ptHd=ch=>{const M=isM(ch.k),pt=(d.kenhPT||{})[ch.k]||{};return `<div class="ptsum"><b>${esc(ch.short)}</b>${give?`<span class="wppt" title="Người giữ kênh (đăng bài) và người hỗ trợ"><label>Phụ trách <select data-ptk="${esc(ch.k)}|chinh">${opt([["","— chưa chọn"]].concat(team.map(u=>[u.id,u.name])),pt.chinh||"")}</select></label><label>Hỗ trợ <select data-ptk="${esc(ch.k)}|phu">${opt([["","—"]].concat(team.map(u=>[u.id,u.name])),pt.phu||"")}</select></label></span>`:`<span class="wppt">Phụ trách <b>${esc(userName(pt.chinh)||"chưa chọn")}</b>${pt.phu?` · hỗ trợ <b>${esc(userName(pt.phu))}</b>`:""}</span>`}${give?`<span class="seg sm wpsc"><button class="${M?"":"on"}" data-wpsc="${esc(ch.k)}|tuan">Theo tuần</button><button class="${M?"on":""}" data-wpsc="${esc(ch.k)}|thang">Cả tháng</button></span>`:""}</div>`};
  const chs=CHANNELS.map(ch=>{if(ch.k===WP_K&&!ch.needId&&pairs.some(x=>x.kenh===ch.k))return `<div class="wpch">${ptHd(ch)}</div>`+fpPlanHtml(d,give,ch);const P=pairs.filter(x=>x.kenh===ch.k&&knShown(d,x));if(!pairs.some(x=>x.kenh===ch.k)||ch.k!==WP_K)return "";const M=isM(ch.k),cap=sum(xvDays(M?WM:WW),x=>calCap(ch.k,x)),tot=sum(P,x=>wpPlan(x,M,(M?wpM:wp)[wpKey(x.sku,x.kenh)]));
    const cl=false;return `<div class="wpch"><div class="ptsum"><b>${esc(ch.short)}</b>${(()=>{const pt=(d.kenhPT||{})[ch.k]||{};return give?`<span class="wppt" title="Người giữ kênh (đăng video) và người hỗ trợ"><label>Phụ trách <select data-ptk="${esc(ch.k)}|chinh">${opt([["","— chưa chọn"]].concat(team.map(u=>[u.id,u.name])),pt.chinh||"")}</select></label><label>Hỗ trợ <select data-ptk="${esc(ch.k)}|phu">${opt([["","—"]].concat(team.map(u=>[u.id,u.name])),pt.phu||"")}</select></label></span>`:`<span class="wppt">Phụ trách <b>${esc(userName(pt.chinh)||"chưa chọn")}</b>${pt.phu?` · hỗ trợ <b>${esc(userName(pt.phu))}</b>`:""}</span>`})()}${give?`<span class="seg sm wpsc"><button class="${M?"":"on"}" data-wpsc="${esc(ch.k)}|tuan">Theo tuần</button><button class="${M?"on":""}" data-wpsc="${esc(ch.k)}|thang">Cả tháng</button></span>`:` · ${M?"lên kế hoạch cả tháng":"theo tuần"}`} · kế hoạch <b>${tot}</b> video · <span title="Số ô đăng = số video mỗi ngày (cài ở ⑤ Kho video & lịch đăng › Nhịp đăng từng kênh) × số ngày. Kế hoạch nhiều hơn số ô đăng thì phần dư không có ngày để đăng, cần tăng nhịp đăng hoặc giảm kế hoạch.">lịch đăng có <b>${cap}</b> ô (${M?"cả tháng":"tuần này"}, khoảng ${Math.round(cap/Math.max(1,xvDays(M?WM:WW).length)*10)/10} video/ngày)</span>${M?"":` <small class="hint">(tuần ${dd(WW.tu)}–${dd(Math.min(WW.den,MONTH.ndays))})</small>`} ${tot>cap?pill("dư "+(tot-cap)+" video không có ô đăng","amb"):tot&&tot<cap?pill("còn "+(cap-tot)+" ô đăng trống","gry"):""}</div>${cl?`<p class="hint wpchn">${P.length} sản phẩm · bấm tên kênh để mở</p>`:kpiNgayHtml(d,give,ch.k)+(P.length?`<h3 class="wppsp">Phân bổ theo từng sản phẩm:</h3>`:"")+P.map(block).join("")}</div>`}).join("");
  b.innerHTML=`<datalist id="dl-ty">${goiy("tuyen").map(z=>`<option value="${esc(z)}">`).join("")}</datalist>${pbBanner(d)}<section class="card"><div class="card-h"><h2>Kế hoạch triển khai</h2><span class="hint">chọn kênh · đặt mục tiêu và KPI từng sản phẩm · pillar · mở sản phẩm để chia loại video và giao người${days.length>7?" · đang xem cả tháng nên hiện tuần hiện tại":""}</span></div>
   ${tabs}${chs||`<p class="empty">Chưa có sản phẩm nào trong kế hoạch tháng (Kế hoạch tháng › bước 5).</p>`}
   <p class="hint">Ưu tiên P1 → P4: P1 cao nhất. Người giữ kênh nhìn mức ưu tiên này khi tự xếp ngày đăng, sản phẩm P1 lên trước.</p></section>`;
  b.querySelectorAll("[data-wpk]").forEach(x=>x.onclick=()=>{WP_K=x.dataset.wpk;renderMain()});
  fpBind(b);
  b.querySelectorAll("[data-wpchx]").forEach(h=>h.onclick=e=>{if(e.target.closest("button,select,input"))return;const k=h.dataset.wpchx;WPCH_CLOSED.has(k)?WPCH_CLOSED.delete(k):WPCH_CLOSED.add(k);renderMain()});
  b.querySelectorAll("[data-wpo]").forEach(h=>h.onclick=e=>{if(e.target.closest("input,select,button"))return;const k=h.dataset.wpo;WP_OPEN.has(k)?WP_OPEN.delete(k):WP_OPEN.add(k);renderMain()});
  b.querySelectorAll("[data-wpuu]").forEach(x=>x.onchange=()=>{const pp=x.dataset.wpuu.split("|"),wx=pp.pop(),k=pp.join("|");DB.mutate(ME.name,"ưu tiên "+(wx==="M"?"cả tháng":"tuần "+wx),dt=>{dt.weekPlan=dt.weekPlan||{};dt.weekPlan[wx]=dt.weekPlan[wx]||{};(dt.weekPlan[wx][k]=dt.weekPlan[wx][k]||{}).uu=x.value});toast("Đã lưu")});
  b.querySelectorAll("[data-wpsc]").forEach(x=>x.onclick=e=>{e.stopPropagation();const [kk,v]=x.dataset.wpsc.split("|");DB.mutate(ME.name,`${kk}: lên kế hoạch ${v==="thang"?"cả tháng":"theo tuần"}`,dt=>{dt.settings.planScope=dt.settings.planScope||{};dt.settings.planScope[kk]=v});renderMain()});
  b.querySelectorAll("[data-wpm]").forEach(x=>x.onchange=()=>{const [sku,kenh,t,wx]=x.dataset.wpm.split("|"),k=wpKey(sku,kenh);DB.mutate(ME.name,"kế hoạch "+(wx==="M"?"cả tháng":"tuần "+wx)+" "+sk(sku).n,dt=>{dt.weekPlan=dt.weekPlan||{};dt.weekPlan[wx]=dt.weekPlan[wx]||{};const e=dt.weekPlan[wx][k]=dt.weekPlan[wx][k]||{};if(wx!=="M"&&!wpTot(e)){const px=ptPairs().find(y=>y.sku===sku&&y.kenh===kenh),au=wpAutoEntry(dt,sku,kenh,px?px.sl:0,+wx);if(au.mix)e.mix=Object.assign({},au.mix)}e.mix=e.mix||{};e.mix[t]=Math.max(0,+x.value||0);e.sl=Object.values(e.mix).reduce((a,b)=>a+(+b||0),0)});toast("Đã lưu");renderMain()});
  b.querySelectorAll("[data-wpgo]").forEach(x=>x.onclick=()=>{const [s2,k2,t2]=x.dataset.wpgo.split("|");wpGo(s2,k2,t2)});
  const wpDo=x=>{const v=x.dataset.wpa,[sku,kenh,t,wx]=v.split("|"),box=x.closest(".wpas"),L=[...box.querySelectorAll("[data-wpu]")].map(i=>[i.dataset.wpu,Math.max(0,+i.value||0)]).filter(z=>z[1]);if(!L.length){toast("Điền số video cho ít nhất một người");return}const bd=+box.querySelector("[data-wpbd]").value,hn=+box.querySelector("[data-wphan]").value;if(hn<bd){toast("Hạn xong phải sau ngày bắt đầu");return}{const left=+((box.querySelector("small")||{}).textContent||"").replace(/\D+/g," ").trim().split(" ")[0]||0,ask=L.reduce((a2,z)=>a2+z[1],0);if(left&&ask>left){toast(`Chỉ còn ${left} video chưa giao theo kế hoạch, đang giao ${ask}. Sửa lại số cho từng người.`);return}}const note=(box.querySelector("[data-wpnote]")||{}).value||"",out=L.map(([u,n])=>{wpAssign(sku,kenh,t,u,n,wx,bd,hn,note);return userName(u)+" "+n});toast("Đã giao: "+out.join(", "));renderMain();return true};b.querySelectorAll("[data-wpa]").forEach(x=>x.onclick=()=>wpDo(x));
  b.querySelectorAll("[data-ltadd]").forEach(x=>x.onclick=()=>{const k=x.dataset.ltadd,sel=[...b.querySelectorAll("[data-ltsel]")].find(s=>s.dataset.ltsel===k),ty=sel&&sel.value;if(!ty)return;DB.mutate(ME.name,"thêm loại video "+ty+" cho "+k,dt=>{dt.loaiHien=dt.loaiHien||{};dt.loaiHien[k]=(dt.loaiHien[k]||[]).filter(z=>z!==ty).concat([ty])});WP_OPEN.add(k);renderMain()});
  b.querySelectorAll("[data-dkfix]").forEach(x=>x.onclick=()=>{const k=x.dataset.dkfix,[sku,kenh]=k.split("|");
    DB.mutate(ME.name,"đặt số chia dạng theo video đã có "+k,dt=>{dt.weekPlan=dt.weekPlan||{};dt.weekPlan.M=dt.weekPlan.M||{};const e=dt.weekPlan.M[k]=dt.weekPlan.M[k]||{},old=e.mix||{},mx={};
      MIX.forEach(z=>{const ty=z[0];if(ty==="ton"){if(+old.ton)mx.ton=+old.ton;return}const n=dt.cards.filter(c=>c.sku===sku&&c.kenh===kenh&&mixOf(c)===ty).length;if(n||+old[ty]||(dt.loaiHien||{})[k]&&(dt.loaiHien[k]||[]).includes(ty))mx[ty]=n});
      e.mix=mx;e.sl=Object.values(mx).reduce((a,b)=>a+(+b||0),0)});toast("Đã đặt số chia theo video đang có");renderMain()});
  /* ✕ bỏ một dạng nội dung: người được chỉnh kế hoạch bấm thì số kế hoạch dạng đó về 0 và các dòng chưa bắt đầu ở Điều phối tự bị xóa theo. Video đã nhập, đã có hook / link thì giữ lại. */
  b.querySelectorAll("[data-ltdel]").forEach(x=>x.onclick=()=>{const p=x.dataset.ltdel.split("|"),w3=p.pop(),ty=p.pop(),sku=p[0],kenh=p[1],k=sku+"|"+kenh,lb=(MIX.find(z=>z[0]===ty)||[])[1]||ty,d0=D();
    if(!xvGive()){toast("Chỉ người chỉnh kế hoạch mới bỏ được dạng này");return}
    const rows=d0.cards.filter(c=>c.sku===sku&&c.kenh===kenh&&mixOf(c)===ty),fr=rows.filter(bvFreeTay),keep=rows.length-fr.length,tk=ty==="nhanban"?(d0.tasks||[]).filter(z=>z.mix==="nhanban"&&z.sku===sku&&z.kenh===kenh&&z.st==="todo"):[],plan=+((wpMix(((wpOf(d0,w3))[k])||{})[ty]))||0;
    const msg="Bỏ dạng "+lb+" khỏi sản phẩm này?\n"+(plan?"• Số kế hoạch "+plan+" video của dạng này về 0.\n":"")+(fr.length?"• Xóa "+fr.length+" dòng chưa bắt đầu ở Điều phối.\n":"")+(tk.length?"• Xóa "+tk.length+" việc nhân bản chưa làm.\n":"")+(keep?"• Giữ lại "+keep+" video đã làm / đã nhập (không xóa).\n":"");
    if((plan||fr.length||tk.length)&&!confirm(msg))return;
    const ids=new Set(fr.map(c=>c.id)),tids=new Set(tk.map(z=>z.id));
    DB.mutate(ME.name,"bỏ dạng video "+lb+" khỏi "+k,dt=>{dt.cards=dt.cards.filter(c=>!ids.has(c.id));if(tids.size)dt.tasks=(dt.tasks||[]).filter(z=>!tids.has(z.id));dt.weekPlan=dt.weekPlan||{};dt.weekPlan[w3]=dt.weekPlan[w3]||{};const e=dt.weekPlan[w3][k]=dt.weekPlan[w3][k]||{};if(w3!=="M"&&!wpTot(e)){const au=wpAutoEntry(dt,sku,kenh,((ptPairs().find(y=>y.sku===sku&&y.kenh===kenh))||{}).sl||0,+w3);if(au.mix)e.mix=Object.assign({},au.mix)}e.mix=e.mix||{};e.mix[ty]=0;e.sl=Object.values(e.mix).reduce((a2,b2)=>a2+(+b2||0),0);dt.loaiHien=dt.loaiHien||{};dt.loaiHien[k]=(dt.loaiHien[k]||[]).filter(z=>z!==ty)});
    toast("Đã bỏ dạng "+lb+(fr.length?", xóa "+fr.length+" dòng ở Điều phối":"")+(keep?", giữ "+keep+" video đã làm":""));renderMain()});
  b.querySelectorAll("[data-wpopen]").forEach(x=>x.onclick=()=>{const [sku,kenh,t2,w3,left]=x.dataset.wpopen.split("|"),k2=sku+"|"+kenh,WX=w3==="M"?WM:WW,lb=(MIX.find(z=>z[0]===t2)||[])[1]||"",dd0=D(),dys=Array.from({length:MONTH.ndays},(_,i)=>[i+1,dd(i+1)]);
    const ov=document.createElement("div");ov.className="wpmodal";
    ov.innerHTML='<div class="wpmbox"><div class="wpmh"><b>Giao việc · '+esc(sk(sku).n)+' · '+esc(chOf(kenh).short)+' · '+esc(lb)+'</b><button type="button" class="lnk" data-wpmx>✕ Đóng</button></div><div class="wpas" data-wpas="'+esc(k2+"|"+t2+"|"+w3)+'"><small>Giao cho (còn '+left+'):</small><div class="wpus">'+team.map(u=>'<label class="wpu"><span>'+esc(u.name)+'</span><input type="number" min="0" class="num" data-wpu="'+u.id+'" placeholder="0"></label>').join("")+'</div><div class="wpdt"><label>Bắt đầu<select data-wpbd>'+opt(dys,today)+'</select></label><label>Hạn xong<select data-wphan>'+opt(dys,defHan(dd0,WX,t2))+'</select></label></div><textarea data-wpnote rows="3" placeholder="Note từ leader (không bắt buộc): yêu cầu, lưu ý, video mẫu…"></textarea><div class="acts"><button type="button" class="btn ghost" data-wpmx>Hủy</button><button type="button" class="btn pri" data-wpa="'+esc(k2+"|"+t2+"|"+w3)+'">Giao</button></div></div></div>';
    const close=()=>ov.remove();ov.onclick=e=>{if(e.target===ov)close()};ov.querySelectorAll("[data-wpmx]").forEach(y=>y.onclick=close);
    ov.querySelector("[data-wpa]").onclick=e=>{if(wpDo(e.currentTarget))close()};document.body.appendChild(ov);const f=ov.querySelector("input");if(f)f.focus()});

  const pgRow=tr=>{const sku=tr.dataset.sku,kenh=tr.dataset.kenh,t=tr.dataset.t,cw=+tr.dataset.cw,n=Math.floor(+tr.querySelector("[data-pn]").value||0),u=tr.querySelector("[data-pu]").value,hn=+tr.querySelector("[data-ph]").value,td=D().settings.today,rem=(+String(tr.dataset.cum).split(",")[4]||0)-(+tr.dataset.given||0);
    if(!u){toast("Chọn người làm cho "+sk(sku).n+" · "+(MIX.find(z=>z[0]===t)||[])[1]);return null}if(n<1){toast("Số video phải lớn hơn 0 ("+sk(sku).n+")");return null}if(n>rem){toast("Chỉ còn "+rem+" video cả tháng ("+sk(sku).n+")");return null}if(hn<td){toast("Hạn phải từ hôm nay trở đi");return null}
    wpAssign(sku,kenh,t,u,n,cw,td,hn,"");
    return userName(u)+" "+n+" "+sk(sku).n};
  b.querySelectorAll("[data-pg1]").forEach(x=>x.onclick=()=>{const r=pgRow(x.closest("tr"));if(r){toast("Đã giao: "+r);renderMain()}});
  b.querySelectorAll("[data-pgall]").forEach(x=>x.onclick=()=>{const rows=[...b.querySelectorAll("tr[data-prow]")].filter(tr=>tr.querySelector("[data-pck]").checked);if(!rows.length){toast("Chưa tích dòng nào");return}const out=[];for(const tr of rows){const r=pgRow(tr);if(!r)return;out.push(r)}toast("Đã giao "+out.length+" dòng: "+out.join(", "));renderMain()});
  b.querySelectorAll("[data-phor]").forEach(s=>s.onchange=()=>{const tr=s.closest("tr"),cum=String(tr.dataset.cum).split(",").map(Number),h=+s.value,n=Math.max(0,(cum[h-1]||0)-(+tr.dataset.given||0));tr.querySelector("[data-pn]").value=n;const hs=tr.querySelector("[data-ph]");hs.value=wpHorHan(D(),tr.dataset.t,h)});
  b.querySelectorAll("[data-pu]").forEach(s=>s.onchange=()=>{const tr=s.closest("tr");tr.querySelector("[data-pck]").checked=!!s.value});
  b.querySelectorAll("[data-psug]").forEach(x=>x.onclick=()=>{const tr=x.closest("tr"),s=tr.querySelector("[data-pu]");s.value=x.dataset.psug;tr.querySelector("[data-pck]").checked=true});
  b.querySelectorAll("[data-pvtog]").forEach(x=>x.onclick=()=>{PV_OPEN=!PV_OPEN;renderMain()});
  b.querySelectorAll("[data-pv]").forEach(i=>i.onchange=()=>{const p=i.dataset.pv.split("|"),uid=p[0],f=p[1],t=p[2],v=Math.max(0,Math.floor(+i.value||0)),u=(D().users||[]).find(x=>x.id===uid);if(!u)return;
    DB.mutate(ME.name,"sửa phân vai "+u.name,dt=>{dt.phanVai2=dt.phanVai2||{};const cur=pvOf(dt,dt.users.find(x=>x.id===uid)||u);const s=dt.phanVai2[uid]=Object.assign({},dt.phanVai2[uid]||{},{cap:Object.assign({},cur.cap),nghi:cur.nghi});if(f==="cap")s.cap[t]=v;else s[f]=v});renderMain()});
  b.querySelectorAll("[data-pvq]").forEach(i=>i.onchange=()=>{const v=Math.max(0,Math.floor(+i.value||0));DB.mutate(ME.name,"đặt mỗi buổi quay chiếm "+v+" video công suất",dt=>{dt.pvQuay=v});renderMain()});
  b.querySelectorAll("[data-pvreset]").forEach(x=>x.onclick=()=>{const kenh=x.dataset.pvreset,d0=D(),isTask=z=>z.mix==="nhanban"&&z.st==="todo"&&!(z.phoi||[]).length&&!z.kq;
    const cards=d0.cards.filter(c=>(!kenh||c.kenh===kenh)&&c.mix&&["cg","kb"].includes(c.step)&&!c.hookText&&!c.noiDung&&!c.linkVideo&&!c.linkFinal&&!c.buoiQuay&&!c.phatSinh&&!c.khoMa&&!c.wt),tasks=(d0.tasks||[]).filter(z=>(!kenh||z.kenh===kenh)&&isTask(z));
    if(!cards.length&&!tasks.length){toast("Không có việc nào đã giao mà chưa bắt đầu");return}
    if(!confirm("Hủy "+cards.length+" video và "+tasks.length+" việc nhân bản đã giao nhưng chưa ai bắt đầu"+(kenh?" ở kênh "+chOf(kenh).short:"")+"? Các việc đã có hook, kịch bản hay video thì giữ nguyên. Sau đó web đề xuất giao lại từ đầu."))return;
    const ids=new Set(cards.map(c=>c.id)),tk=new Set(tasks.map(z=>z.id));
    DB.mutate(ME.name,"chia lại từ đầu: hủy "+cards.length+" video, "+tasks.length+" việc chưa bắt đầu",dt=>{dt.cards=dt.cards.filter(c=>!ids.has(c.id));dt.tasks=(dt.tasks||[]).filter(z=>!tk.has(z.id))});toast("Đã hủy "+(cards.length+tasks.length)+" việc, web đề xuất giao lại ở khung Giao việc");renderMain()});
  b.querySelectorAll("[data-dkn]").forEach(i=>i.onchange=()=>{const p=i.dataset.dkn.split("|"),ty=p.pop();lvSetPlan(p[0],p[1],ty,i.value);renderMain()});
  b.querySelectorAll("[data-pcgo]").forEach(x=>x.onclick=()=>{const p=x.dataset.pcgo.split("|");bvGo(p[1],p[0],"")});
  b.querySelectorAll("[data-gogv]").forEach(x=>x.onclick=()=>{MOD="mkt";PAGE="gv_nhanh";render();scrollTo(0,0)});
  if(typeof ptBind==="function")ptBind(b);
  const tyAdd=(sku,kenh,raw)=>{const names=String(raw).split(/[,;\n]/).map(s=>s.trim()).filter(Boolean);if(!names.length)return false;
    DB.mutate(ME.name,"thêm tuyến "+names.join(", ")+" · "+sk(sku).n,dt=>{ptEnsure(dt,sku,kenh);names.forEach(tu=>{if(dt.tuyen.some(z=>z.kenh===kenh&&z.sku===sku&&z.tuyen.toLowerCase()===tu.toLowerCase()))return;goiyAdd(dt,sku==="TH"?"tuyenTH":"tuyen",tu);const n=dt.tuyen.filter(z=>z.sku===sku).length+1;let ma="T"+MONTH.mon+"-"+sku+"-"+String(n).padStart(2,"0");while(dt.tuyen.some(z=>z.ma===ma))ma+="b";dt.tuyen.push({ma,kenh,sku,tuyen:tu,vaiTro:"",kh:0,dangVideo:"",nguoi:"",kiemChung:"Giả thuyết",maInsight:"",ghiChu:""})})});toast("Đã thêm tuyến");renderMain();return true};
  b.querySelectorAll("[data-tymodal]").forEach(x=>x.onclick=()=>{const [sku,kenh]=x.dataset.tymodal.split("|"),ov=document.createElement("div");ov.className="wpmodal";
    ov.innerHTML='<div class="wpmbox"><div class="wpmh"><b>Thêm tuyến · '+esc(sk(sku).n)+' · '+esc(chOf(kenh).short)+'</b><button type="button" class="lnk" data-wpmx>✕ Đóng</button></div><p class="hint">Gõ tên tuyến, nhiều tuyến cách nhau bằng dấu phẩy. Chọn từ gợi ý hoặc tự viết.</p><input type="text" class="tymin" list="dl-ty" placeholder="Ví dụ: Giải đáp thắc mắc, Demo sản phẩm"><div class="acts"><button type="button" class="btn ghost" data-wpmx>Hủy</button><button type="button" class="btn pri" data-tyok>Thêm</button></div></div>';
    const close=()=>ov.remove(),inp=ov.querySelector(".tymin"),go=()=>{if(tyAdd(sku,kenh,inp.value))close();else toast("Gõ tên tuyến trước")};
    ov.onclick=e=>{if(e.target===ov)close()};ov.querySelectorAll("[data-wpmx]").forEach(y=>y.onclick=close);ov.querySelector("[data-tyok]").onclick=go;inp.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();go()}if(e.key==="Escape")close()};document.body.appendChild(ov);inp.focus()});
  b.querySelectorAll("[data-tydel]").forEach(x=>x.onclick=()=>{const ma=x.dataset.tydel;if(D().cards.some(c=>c.maTuyen===ma)){toast("Tuyến này đã có video, không xóa được");return}DB.mutate(ME.name,"xóa tuyến "+ma,dt=>{dt.tuyen=dt.tuyen.filter(z=>z.ma!==ma)});renderMain()});
  b.querySelectorAll("[data-kkh]").forEach(i=>i.onchange=()=>{const [kenh,sku]=i.dataset.kkh.split("|");DB.mutate(ME.name,"đổi hướng "+sk(sku).n+" · "+kenh,dt=>{const p=dt.products.find(y=>y.k===sku);if(p)p.kenhs=pKenhs(p).map(e=>e.kenh===kenh?Object.assign({},e,{huong:i.value}):e)});renderMain()});
  b.querySelectorAll("[data-gonq]").forEach(x=>x.onclick=()=>{XV.tab="quay";renderMain();scrollTo(0,0)});
  b.querySelectorAll("[data-kk]").forEach(i=>i.onchange=()=>{const [kenh,f]=i.dataset.kk.split("|"),raw=i.type==="date"?String(i.value?+String(i.value).slice(8,10):0):String(i.value).trim();DB.mutate(ME.name,"mục tiêu video "+kenh,dt=>{dt.kpiNgay=dt.kpiNgay||{};const o=dt.kpiNgay[kenh]=Object.assign({},dt.kpiNgay[kenh]||{});if(f==="saleDay"){o.saleDay=Math.max(0,Math.min(MONTH.ndays,Math.floor(+raw||0)));delete o.tuanSale}else if(f==="tu"){o.tuanSale={tu:Math.max(1,Math.min(MONTH.ndays,Math.floor(+raw||1)))}}else if(f==="tb"&&raw!==""&&+raw>=0)o.tb=+raw;else if(raw===""||!(+raw>0))delete o[f];else o[f]=+raw});renderMain()});
  b.querySelectorAll("[data-kkt]").forEach(i=>i.onchange=()=>{const [kenh,sku]=i.dataset.kkt.split("|");DB.mutate(ME.name,"tồn dùng được "+sk(sku).n+" · "+kenh,dt=>{const p=dt.products.find(y=>y.k===sku);if(!p)return;p.kenhs=pKenhs(p).map(e=>e.kenh===kenh?Object.assign({},e,{ton:Math.max(0,Math.floor(+i.value||0))}):e)});renderMain()});
  b.querySelectorAll("[data-kkp]").forEach(i=>i.onchange=()=>{const [kenh,sku]=i.dataset.kkp.split("|");DB.mutate(ME.name,"đặt KPI số video "+sk(sku).n+" · "+kenh,dt=>{const p=dt.products.find(y=>y.k===sku);if(!p)return;p.kenhs=pKenhs(p).map(e=>e.kenh===kenh?Object.assign({},e,{sl:Math.max(0,Math.floor(+i.value||0))}):e)});toast("Đã lưu KPI");renderMain()});
  b.querySelectorAll("[data-kkadd]").forEach(x=>x.onclick=()=>{const kenh=x.dataset.kkadd,sel=b.querySelector('[data-kksel="'+kenh+'"]'),sku=sel&&sel.value;if(!sku)return;DB.mutate(ME.name,"thêm sản phẩm "+sk(sku).n+" vào kế hoạch "+kenh,dt=>{const p=dt.products.find(y=>y.k===sku);if(!p)return;if(!pKenhs(p).some(e=>e.kenh===kenh))p.kenhs=pKenhs(p).concat([{kenh,huong:p.huong||"Test",gmv:0,sl:0}]);dt.kpiNgay=dt.kpiNgay||{};const o=dt.kpiNgay[kenh]=Object.assign({},dt.kpiNgay[kenh]||{});o.sp=(o.sp||[]).filter(s=>s!==sku).concat([sku])});renderMain()});
  b.querySelectorAll("[data-kkw]").forEach(i=>i.onchange=()=>{const [kenh,sku,w]=i.dataset.kkw.split("|"),raw=String(i.value).trim();DB.mutate(ME.name,"chỉnh số tuần "+w+" "+sk(sku).n,dt=>{dt.kpiNgay=dt.kpiNgay||{};const o=dt.kpiNgay[kenh]=Object.assign({},dt.kpiNgay[kenh]||{});o.tuanSL=Object.assign({},o.tuanSL||{});const m=Object.assign({},o.tuanSL[sku]||{});if(raw==="")delete m[w];else m[w]=Math.max(0,Math.floor(+raw||0));if(Object.keys(m).length)o.tuanSL[sku]=m;else delete o.tuanSL[sku]});renderMain()});
  b.querySelectorAll("[data-kkwr]").forEach(x=>x.onclick=()=>{const [kenh,sku]=x.dataset.kkwr.split("|");DB.mutate(ME.name,"chia đều lại "+sk(sku).n,dt=>{const o=(dt.kpiNgay||{})[kenh];if(o&&o.tuanSL)delete o.tuanSL[sku]});renderMain()});
  b.querySelectorAll("[data-kkdel]").forEach(x=>x.onclick=()=>{const [kenh,sku]=x.dataset.kkdel.split("|"),pr=ptPairs().find(y=>y.kenh===kenh&&y.sku===sku);if(pr&&+pr.sl>0&&!confirm("Bỏ "+sk(sku).n+" khỏi kế hoạch kênh này? KPI "+pr.sl+" video sẽ về 0."))return;DB.mutate(ME.name,"bỏ sản phẩm "+sk(sku).n+" khỏi kế hoạch "+kenh,dt=>{const p=dt.products.find(y=>y.k===sku);if(p)p.kenhs=pKenhs(p).map(e=>e.kenh===kenh?Object.assign({},e,{sl:0}):e);const o=dt.kpiNgay&&dt.kpiNgay[kenh];if(o&&o.sp)dt.kpiNgay[kenh]=Object.assign({},o,{sp:o.sp.filter(s=>s!==sku)})});renderMain()});
  b.querySelectorAll("[data-kkrest]").forEach(x=>x.onclick=()=>{const kenh=x.dataset.kkrest,d0=D(),K=kn(d0,kenh),rest=K.T-K.sum0,sp0=(((d0.kpiNgay||{})[kenh]||{}).sp)||[],zero=ptPairs().filter(y=>y.kenh===kenh&&!(+y.sl>0)&&sp0.includes(y.sku));if(rest<=0||!zero.length)return;const a=wpSplit(rest,zero.map(()=>1)),add={};zero.forEach((y,i)=>add[y.sku]=a[i]);
    DB.mutate(ME.name,"chia nốt số video còn lại · "+kenh,dt=>{dt.products.forEach(p=>{if(add[p.k]!=null)p.kenhs=pKenhs(p).map(e=>e.kenh===kenh?Object.assign({},e,{sl:add[p.k]}):e)})});toast("Đã chia nốt "+rest+" video");renderMain()});
  b.querySelectorAll("[data-pbtog]").forEach(h=>h.onclick=e=>{if(e.target.closest("input,button,select"))return;const k=h.dataset.pbtog;PB_OPEN.has(k)?PB_OPEN.delete(k):PB_OPEN.add(k);renderMain()});
  b.querySelectorAll("[data-pbi]").forEach(i=>i.onchange=()=>{const [kenh,w,sku]=i.dataset.pbi.split("|"),kpi=+i.dataset.kpi||0;DB.mutate(ME.name,"phân bổ tuần "+w+" "+sk(sku).n,dt=>{dt.phanBo=dt.phanBo||{};const o2=dt.phanBo[kenh]=dt.phanBo[kenh]||{};const arr=(Array.isArray(o2[sku])&&o2[sku].length===5?o2[sku]:pbDef(kpi)).slice();arr[+w-1]=Math.max(0,Math.floor(+i.value||0));o2[sku]=arr});renderMain()});
  b.querySelectorAll("[data-pbreset]").forEach(x=>x.onclick=()=>{const [kenh,sku]=x.dataset.pbreset.split("|");DB.mutate(ME.name,"chia lại phân bổ tuần theo ngày",dt=>{if(dt.phanBo&&dt.phanBo[kenh])delete dt.phanBo[kenh][sku]});renderMain()});
  b.querySelectorAll("[data-ptk]").forEach(x=>{x.onclick=e=>e.stopPropagation();x.onchange=()=>{const [k,f]=x.dataset.ptk.split("|");DB.mutate(ME.name,"đổi phụ trách kênh "+k,dt=>{dt.kenhPT=dt.kenhPT||{};dt.kenhPT[k]=dt.kenhPT[k]||{chinh:"",phu:""};dt.kenhPT[k][f]=x.value});toast("Đã lưu")}});
  b.querySelectorAll("[data-wpe]").forEach(x=>x.onclick=()=>{WP_EDIT.add(x.dataset.wpe);renderMain()});
  b.querySelectorAll("[data-wpec]").forEach(x=>x.onclick=()=>{WP_EDIT.delete(x.dataset.wpec);renderMain()});
  b.querySelectorAll("[data-wpebox] input,[data-wpebox] select").forEach(i=>i.oninput=i.onchange=()=>{const bt=i.closest(".wpe").querySelector("[data-wpes]");delete bt.dataset.ok;bt.textContent="Lưu";i.closest(".wpe").querySelector(".wpeprev").textContent=""});
  b.querySelectorAll("[data-wpes]").forEach(x=>x.onclick=()=>{const id=x.dataset.wpes,box=x.closest(".wpe"),tg={};let bad="";
    box.querySelectorAll("[data-wpeu]").forEach(i=>{const v=Math.max(0,Math.floor(+i.value||0));if(v<(+i.min||0))bad=`${userName(i.dataset.wpeu)||"Người này"} đã xong ${i.min} việc, không bớt dưới ${i.min} được`;tg[i.dataset.wpeu]=v});
    if(bad){toast(bad);return}const hs={};box.querySelectorAll("[data-wpeh]").forEach(i=>{if(i.value&&i.value!==i.dataset.orig&&(tg[i.dataset.wpeh]||0)>0)hs[i.dataset.wpeh]=+i.value});const nt=box.querySelector("[data-wpenote]"),P=wpEditCalc(D(),id,tg,hs),txt=wpEditText(P);if(nt&&nt.value.trim()!==nt.dataset.orig){P.note=nt.value.trim();txt.push("sửa note từ leader")}if(!txt.length){WP_EDIT.delete(id);renderMain();return}
    if(!x.dataset.ok){box.querySelector(".wpeprev").innerHTML="Sẽ: "+txt.map(esc).join(" · ");x.dataset.ok=1;x.textContent="Đồng ý, lưu";return}
    wpEditApply(id,P);WP_EDIT.delete(id);toast("Đã sửa: "+txt.join(", "));renderMain()});
}
/* Sang đúng bước, chọn sẵn sản phẩm × kênh và loại video */
function wpGo(sku,kenh,t){const mx=MIX.find(x=>x[0]===t);if(t==="nhanban"){PAGE="win";render();scrollTo(0,0);return}if(mx[2]==="kho")XV.ks="ton";XV.sku=sku;XV.kenh=kenh;XV.mix=t;XV.tab=mx[2];XV.sel.clear();renderMain();scrollTo(0,0)}
/* Dải "Tuần này cần làm" ở các bước: lấy từ kế hoạch tuần */
function wpStrip(d,W,days,types){
  const w=wpWeekNo(d,W,days),WW=WEEKS.find(x=>x.w===w)||WEEKS[0],wp=wpOf(d,w),inW=c=>{const x=cDay(c);return x>=WW.tu&&x<=WW.den};
  const SCs=d.settings.planScope||{},wpMm=wpOf(d,"M"),items=ptPairs().map(x=>{const M=SCs[x.kenh]==="thang",m=wpMix((M?wpMm:wp)[wpKey(x.sku,x.kenh)]),parts=types.filter(t=>+m[t]).map(t=>{const n=+m[t],dn=d.cards.filter(c=>c.sku===x.sku&&c.kenh===x.kenh&&(M||inW(c))&&mixOf(c)===t).length;return {t,n,dn,M}});return {x,parts}}).filter(i=>i.parts.length);
  if(!items.length)return `<div class="wpstrip"><span class="hint">Tuần ${w} chưa chia số video cho bước này. Đặt ở ① Kế hoạch.</span></div>`;
  return `<div class="wpstrip"><b>Tuần ${w} cần làm:</b>${items.map(({x,parts})=>{const on=XV.sku===x.sku&&XV.kenh===x.kenh;return `<button type="button" class="wpq${on?" on":""}" data-wpq="${esc(x.sku)}|${esc(x.kenh)}|${parts[0].t}">${swatch(x.sku)}${esc(sk(x.sku).n)} · ${esc(chOf(x.kenh).short)}: ${parts.map(p=>`${(MIX.find(z=>z[0]===p.t)||[])[1]}${p.M?" (cả tháng)":""} <b class="${p.dn>=p.n?"t-grn":""}">${p.dn}/${p.n}</b>`).join(" · ")}</button>`}).join("")}${XV.sku?`<button type="button" class="chipx" data-wpq="">Bỏ chọn ${esc(sk(XV.sku).n)} ✕</button>`:""}</div>`;
}

/* Link source (file quay gốc trên Drive) của buổi quay */
function srcHtml(s,can2){
  const L=s.srcLinks||[];
  return `<div class="field full srcbox"><span>Link source buổi quay (file gốc đã quay, dán link Drive)</span>
   ${L.length?`<ul class="srcl">${L.map((x,i)=>`<li><a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.n||x.u)}</a><small>${esc(x.by||"")}</small>${can2?`<button type="button" class="lnk" data-srcdel="${s.id}|${i}">xóa</button>`:""}</li>`).join("")}</ul>`:`<p class="hint">Chưa có link source nào.</p>`}
   ${can2?`<div class="srcadd"><input type="url" placeholder="Dán link Drive của file quay (https://…)" data-srcu="${s.id}"><input type="text" placeholder="Tên (không bắt buộc)" data-srcn="${s.id}"><button type="button" class="btn" data-srcadd="${s.id}">+ Thêm link</button></div>`:""}</div>`
}
/* ---------- ③ Buổi quay & hook ---------- */
function xvQuay2(b,o){
  const {d,W,days,team,give}=o,dv=can(ME,"viec.duyet")||ME.role==="admin",sh=(d.shoots||[]).filter(s=>(s.day>=W.tu&&s.day<=W.den)||!["Đã quay","Đã hủy"].includes(s.trangThai)).sort((a,c)=>a.day-c.day||(a.gio||"").localeCompare(c.gio||""));
  const qDef=team.find(u=>/quỳnh/i.test(u.name)),w=weekOf(W.tu)||1,wp=wpOf(d,w);
  const tOpts=()=>{const g=xvGroupBy(d.tuyen.slice(),t=>sk(t.sku).n+" · "+chOf(t.kenh).short);return g.map(([n,L])=>`<optgroup label="${esc(n)}">${L.map(t=>`<option value="${esc(t.ma)}">${esc(t.tuyen)}${t.vaiTro?" · "+esc(t.vaiTro):""}</option>`).join("")}</optgroup>`).join("")};
  const wait=d.cards.filter(c=>c.step==="quay"&&!c.buoiQuay);
  const sess=s=>{const I=d.cards.filter(c=>c.buoiQuay===s.id),chua=I.filter(c=>c.step==="dkb"),kb=I.filter(c=>c.step==="kb"),ok=I.filter(c=>c.step==="quay"),done=I.filter(c=>!["dkb","kb","quay","cg"].includes(c.step)),ps=I.filter(c=>c.phatSinh).length;
    const bySku=xvGroupBy(I,c=>c.sku+"|"+c.kenh);
    return `<div class="sqitem xses2"><div class="card-h"><h2>🎬 ${dayLbl(s.day)} · ${esc(s.buoi||"")}${s.gio?" "+esc(s.gio):""}</h2><span class="hint">${esc(s.diaDiem||"")} · quay: ${esc(s.nguoi.map(userName).join(", ")||"chưa có người")}</span><span class="sp"></span>${pill(SQ_LB[SQ_ST(s)][0],SQ_LB[SQ_ST(s)][1])}</div>
     ${sqBox(s,give,dv)}<div class="xsum">${I.length} hook / kịch bản xếp vào buổi quay · <b class="${ok.length?"t-grn":""}">${ok.length} đã duyệt, sẵn sàng quay</b>${chua.length?` · <b class="t-amb">${chua.length} chờ duyệt</b>`:""}${kb.length?` · <b class="t-red">${kb.length} cần sửa</b>`:""} · ${done.length} đã quay${ps?` (${ps} phát sinh)`:""}${bySku.length?`<span class="sqsk">${bySku.map(([k,L])=>`${swatch(k.split("|")[0])} ${esc(sk(k.split("|")[0]).n)} (${esc(chOf(k.split("|")[1]).short)}): ${L.length}`).join(" · ")}</span>`:""}</div>
     ${SQ_ST(s)!=="xong"&&SQ_ST(s)!=="huy"&&I.length&&(chua.length||kb.length)&&s.day-D().settings.today<=1?`<p class="sqwarn">⚠ Sắp tới buổi quay mà còn ${chua.length+kb.length} hook / kịch bản chưa được duyệt.</p>`:""}
     ${(()=>{const H=I.filter(c=>mixOf(c)==="oneshot"),K=I.filter(c=>mixOf(c)==="kichban");return [H.length?"":"Chưa có hook nào: <button class=\"lnk\" data-gohk=\"hook\">Viết hook →</button>",K.length?"":"Chưa có kịch bản nào: <button class=\"lnk\" data-gohk=\"kb\">Viết kịch bản →</button>"].filter(Boolean).map(x=>`<p class="hint">${x} (ở bảng Hook & kịch bản theo kênh bên dưới, duyệt xong chọn buổi quay này)</p>`).join("")})()}
     
     <label class="field full">Ghi chú buổi quay<textarea rows="2" data-sqnote="${s.id}" ${give?"":"disabled"} placeholder="Đạo cụ, người mẫu, địa điểm, lưu ý…">${esc(s.ghiChu||"")}</textarea></label>
     <label class="field full">Cảnh trám / review cần quay (đủ dùng cho các video trong tuần)<textarea rows="2" data-tram="${s.id}" ${give?"":"disabled"} placeholder="Ví dụ: cảnh trám ngâm áo, cận bột tan, review cầm sản phẩm — đủ cho 12 video bột tẩy tuần này">${esc(s.tram||"")}</textarea></label>
     ${srcHtml(s,give||(Array.isArray(s.nguoi)?s.nguoi.includes(ME.name):String(s.nguoi||"").includes(ME.name)))}
     <div class="acts">${dv&&chua.length?`<button class="btn pri" data-hkok="${s.id}">✓ Duyệt danh sách hook (${chua.length})</button>`:""}
      ${give&&ok.length?`<button class="btn" data-hkdone="${s.id}">Chốt buổi quay: ${ok.length} hook / kịch bản → Kho video</button>`:""}
      ${give&&s.trangThai==="Đã quay"||give&&ok.length?`<span class="hkps"><select data-pst="${s.id}">${tOpts()}</select><input data-psh="${s.id}" placeholder="Hook phát sinh"><button class="btn sm" data-psadd="${s.id}">+ Hook phát sinh</button></span>`:""}</div></div>`};
  const showAdd=give&&(SQ_ADD===null?!sh.length:SQ_ADD);
  b.innerHTML=`<div class="card-h"><h2>Lịch quay</h2><span class="hint">các buổi quay đã lên lịch · gập / mở từng buổi · mục tiêu do lead tự viết</span><span class="sp"></span>${give?`<button class="btn sm pri" id="sq-addtog">${showAdd?"Đóng form":"+ Thêm buổi quay"}</button>`:""}</div>
   ${showAdd?`<form class="sqform" id="xq-add"><label class="field">Ngày<select id="xs-d">${opt(Array.from({length:MONTH.ndays},(_,i)=>[i+1,dayLbl(i+1)]),Math.max(d.settings.today,W.tu))}</select></label><label class="field">Buổi<select id="xs-b">${opt(["Sáng","Chiều","Cả ngày"],"Sáng")}</select></label><label class="field">Giờ (nếu cần)<input id="xs-g" placeholder="vd 8:30"></label><label class="field">Địa điểm<input id="xs-p" value="Văn phòng Ailla"></label><div class="field"><span>Người quay (tích nhiều người)</span><div class="chk" id="xs-ns">${team.map(u=>`<label><input type="checkbox" name="xs-n" value="${u.id}" ${qDef&&qDef.id===u.id?"checked":""}> ${esc(u.name)}</label>`).join("")}</div></div><label class="field">Ghi chú<input id="xs-gc" placeholder="Đạo cụ, lưu ý…"></label><button class="btn pri">+ Thêm buổi quay</button></form>`:""}
   ${quayNeedHtml(d,give)}
   ${wait.length?`<div class="note">${wait.length} hook đã duyệt từ buổi trước chưa quay. ${give?`<button class="btn sm" id="hk-move">Chuyển vào buổi quay gần nhất</button>`:""}</div>`:""}
   ${sh.map(sess).join("")||`<p class="empty">Chưa có buổi quay nào. Bấm "+ Thêm buổi quay".</p>`}`;
  if($("#sq-addtog"))$("#sq-addtog").onclick=()=>{SQ_ADD=!showAdd;renderMain()};
  const S=id=>(D().shoots||[]).find(x=>x.id===id);
  b.querySelectorAll("[data-hkadd]").forEach(x=>x.onclick=()=>{const s=S(x.dataset.hkadd),f=x.closest(".hkadd"),t=d.tuyen.find(y=>y.ma===f.querySelector(".ht").value),one=f.querySelector(".hl").value==="1",L=f.querySelector(".hh").value.split("\n").map(v=>v.trim()).filter(Boolean);
    if(!t){toast("Chưa có tuyến nào, lập tuyến ở Kế hoạch tháng › bước 5");return}if(!L.length){toast("Gõ ít nhất một hook");f.querySelector(".hh").focus();return}
    DB.mutate(ME.name,`thêm ${L.length} hook buổi quay ${dd(s.day)}`,dt=>L.forEach(h=>{const by=s.nguoi[0]||"";dt.cards.push(newCard(dt,{sku:t.sku,kenh:t.kenh,maTuyen:t.ma,hookText:h,day:0,qday:s.day,buoiQuay:s.id,nguon:"Quay mới",loai:"moi",oneShot:one,dangVideo:t.dangVideo||(one?"One shot":undefined),step:one?"dkb":"kb",nguoi:by,nguoiKB:by}))}));
    toast(`Đã thêm ${L.length} hook`+(one?", chờ duyệt":", người được giao viết kịch bản rồi gửi duyệt"));renderMain()});
  sqBind(b,d);
  b.querySelectorAll(".xses2").forEach(sec=>{
    const h=sec.querySelector(".card-h"),m=sec.querySelector("[data-sqmt]");if(!h||!m)return;const sid=m.dataset.sqmt,s=(d.shoots||[]).find(x=>x.id===sid);if(!s)return;
    const body=document.createElement("div");body.className="sqbody";[...sec.children].forEach(ch=>{if(ch!==h)body.appendChild(ch)});sec.appendChild(body);
    const open=SQ_TOG.has(sid)?SQ_TOG.get(sid):SQ_ST(s)==="tre";body.hidden=!open;
    h.classList.add("clk");h.insertAdjacentHTML("afterbegin",'<i class="ptar">'+(open?"▾":"▸")+"</i> ");
    if(!open&&s.mucTieu)h.querySelector("h2").insertAdjacentHTML("afterend",'<span class="hint sqsum">'+esc(s.mucTieu.length>80?s.mucTieu.slice(0,80)+"…":s.mucTieu)+"</span>");
    h.onclick=e=>{if(e.target.closest("button,a,input,select,textarea"))return;SQ_TOG.set(sid,!open);renderMain()}});
  b.querySelectorAll("[data-gohk]").forEach(x=>x.onclick=()=>{const l=document.querySelector("#xh-l");if(l)l.scrollIntoView({behavior:"smooth",block:"start"})});
  b.querySelectorAll("[data-hkx]").forEach(x=>x.onclick=()=>{DB.mutate(ME.name,"bỏ hook "+x.dataset.hkx,dt=>{dt.cards=dt.cards.filter(c=>c.id!==x.dataset.hkx)});renderMain()});
  b.querySelectorAll("[data-hkok]").forEach(x=>x.onclick=()=>{const id=x.dataset.hkok;let n=0;DB.mutate(ME.name,"duyệt danh sách hook buổi quay",dt=>dt.cards.forEach(c=>{if(c.buoiQuay===id&&c.step==="dkb"){c.step="quay";n++}}));toast(`Đã duyệt ${n} hook, sẵn sàng quay`);renderMain()});
  b.querySelectorAll("[data-hkq]").forEach(x=>x.onchange=()=>DB.mutate(ME.name,"đánh dấu đã quay "+x.dataset.hkq,dt=>{const c=dt.cards.find(y=>y.id===x.dataset.hkq);if(c)c.daQuay=x.checked}));
  b.querySelectorAll("[data-hkdone]").forEach(x=>x.onclick=()=>{const id=x.dataset.hkdone;const nq=(D().cards||[]).filter(c=>c.buoiQuay===id&&c.step==="quay").length;if(!confirm("Chốt buổi quay: "+nq+" hook / kịch bản sẽ chuyển sang ④ Kho video › Video sản xuất trong tháng. Hook nào chưa quay thì bỏ khỏi buổi quay ở bảng hook trước. Chốt luôn?"))return;let a=0,r=0;DB.mutate(ME.name,"chốt buổi quay",dt=>{const s=dt.shoots.find(y=>y.id===id);if(s)s.trangThai="Đã quay";dt.cards.forEach(c=>{if(c.buoiQuay!==id||c.step!=="quay")return;if(true){c.daQuay=true;const o=c.nguoiKB||c.nguoi||c.giao||"";c.step="edit";c.nguoi=o;c.nguoiEdit=o;a++}else{c.buoiQuay="";r++}})});toast(`${a} video chuyển sang ④ Kho video › Video sản xuất trong tháng${r?`, ${r} hook chưa quay chuyển sang buổi sau`:""}`);XV.tab="kho";XV.ks="new";renderMain()});
  b.querySelectorAll("[data-psadd]").forEach(x=>x.onclick=()=>{const id=x.dataset.psadd,s=S(id),t=d.tuyen.find(y=>y.ma===b.querySelector(`[data-pst="${id}"]`).value),h=b.querySelector(`[data-psh="${id}"]`).value.trim();if(!t||!h){toast("Chọn tuyến và gõ hook phát sinh");return}
    DB.mutate(ME.name,"hook phát sinh buổi quay "+dd(s.day),dt=>dt.cards.push(newCard(dt,{sku:t.sku,kenh:t.kenh,maTuyen:t.ma,hookText:h,day:0,qday:s.day,buoiQuay:id,nguon:"Quay mới",loai:"moi",oneShot:true,phatSinh:true,dangVideo:t.dangVideo||"One shot",step:"edit",nguoi:"",nguoiEdit:""})));toast("Đã ghi hook phát sinh, giao người edit ở ④");renderMain()});
  b.querySelectorAll("[data-srcadd]").forEach(x=>x.onclick=()=>{const id=x.dataset.srcadd,u=(b.querySelector('[data-srcu="'+id+'"]').value||"").trim(),n=(b.querySelector('[data-srcn="'+id+'"]').value||"").trim();if(!/^https?:\/\//i.test(u)){toast("Link phải bắt đầu bằng https://");return}DB.mutate(ME.name,"thêm link source buổi quay",dt=>{const s=dt.shoots.find(y=>y.id===id);if(s){s.srcLinks=s.srcLinks||[];s.srcLinks.push({u,n,by:ME.name})}});toast("Đã thêm link source");renderMain()});
  b.querySelectorAll("[data-srcdel]").forEach(x=>x.onclick=()=>{const [id,i]=x.dataset.srcdel.split("|");DB.mutate(ME.name,"xóa link source buổi quay",dt=>{const s=dt.shoots.find(y=>y.id===id);if(s&&s.srcLinks)s.srcLinks.splice(+i,1)});renderMain()});
  b.querySelectorAll("[data-sqnote]").forEach(x=>x.onchange=()=>DB.mutate(ME.name,"ghi chú buổi quay",dt=>{const s=dt.shoots.find(y=>y.id===x.dataset.sqnote);if(s)s.ghiChu=x.value}));
  b.querySelectorAll("[data-tram]").forEach(x=>x.onchange=()=>DB.mutate(ME.name,"ghi cảnh trám buổi quay",dt=>{const s=dt.shoots.find(y=>y.id===x.dataset.tram);if(s)s.tram=x.value}));
  if($("#hk-move"))$("#hk-move").onclick=()=>{const nx=(D().shoots||[]).filter(s=>!["Đã quay","Đã hủy"].includes(s.trangThai)&&s.day>=D().settings.today).sort((a,c)=>a.day-c.day)[0];if(!nx){toast("Chưa có buổi quay sắp tới, thêm buổi quay trước");return}DB.mutate(ME.name,"chuyển hook chưa quay sang buổi "+dd(nx.day),dt=>dt.cards.forEach(c=>{if(c.step==="quay"&&!c.buoiQuay){c.buoiQuay=nx.id;c.qday=nx.day}}));renderMain()};
  if($("#xq-add"))$("#xq-add").onsubmit=e=>{e.preventDefault();DB.mutate(ME.name,"lên lịch quay",dt=>{dt.shoots=dt.shoots||[];dt.shoots.push({id:uid("sq"),day:+$("#xs-d").value,buoi:$("#xs-b").value,gio:$("#xs-g").value,diaDiem:$("#xs-p").value,nguoi:[...document.querySelectorAll('#xs-ns input:checked')].map(i=>i.value),ghiChu:$("#xs-gc").value,tram:"",trangThai:"Đã lên lịch"})});toast("Đã thêm buổi quay");SQ_ADD=false;renderMain()};
}

/* ---------- ⑤ Lịch đăng: nhịp đăng + tự xếp ---------- */
function xvDang2(b,o){
  const {d,W,give}=o,today=d.settings.today,un=d.cards.filter(c=>!c.day&&["edit","worker","dvd","dceo","dang"].includes(c.step)),N=d.settings.nhip||{};
  const D7=[];for(let x=Math.max(today,W.tu);x<=Math.min(MONTH.ndays,Math.max(today,W.tu)+6);x++)D7.push(x);
  b.innerHTML=`<section class="card"><div class="card-h"><h2>Nhịp đăng từng kênh</h2><span class="hint">số video mỗi ngày theo giai đoạn · ví dụ trước sale 10/10 đăng dày, sau đó giảm · ngày không thuộc giai đoạn nào thì dùng số mặc định</span></div>
   <div class="nhg">${CHANNELS.map(ch=>`<div class="nhk"><b>${esc(ch.short)}</b><small>mặc định ${slotsOf()[ch.k]||0}/ngày</small>${(N[ch.k]||[]).map((r,i)=>`<div class="nhr">${dd(r.tu)} → ${dd(r.den)}: <b>${r.sl}</b>/ngày${give?` <button class="lnk danger" data-nhx="${esc(ch.k)}|${i}">✕</button>`:""}</div>`).join("")}
    ${give?`<div class="nhadd" data-nhk="${esc(ch.k)}"><select class="a">${opt(Array.from({length:MONTH.ndays},(_,i)=>[i+1,dd(i+1)]),today)}</select>→<select class="z">${opt(Array.from({length:MONTH.ndays},(_,i)=>[i+1,dd(i+1)]),Math.min(MONTH.ndays,today+5))}</select><input type="number" min="0" class="n num" placeholder="video/ngày"><button class="btn sm" data-nhadd="${esc(ch.k)}">+ Giai đoạn</button></div>`:""}</div>`).join("")}</div></section>
  <section class="card"><div class="card-h"><h2>Video chưa có ngày đăng</h2><span class="hint">người giữ kênh tự xếp</span>${give?`<button class="btn sm" id="hot-open">🔥 Đẩy sản phẩm đang lên xu hướng</button>`:""}<span class="hint">${un.length} video đã quay xong trở đi</span><span class="sp"></span></div>
   <div class="xlist">${un.slice(0,60).map(c=>{const may=give||chanOwner(c.kenh)===ME.id;return `<div class="xmini">${swatch(c.sku)}<span class="xmt clk" data-card="${c.id}">${esc(c.hookText||c.yTuong||c.tuyen||c.id)}</span><span class="xms">${esc(chOf(c.kenh).short)} · ${esc(stepName(c.step))} · giữ kênh: ${esc(userName(chanOwner(c.kenh))||"chưa đặt")}</span>${may?`<select data-setday="${c.id}">${opt([["","Chọn ngày đăng"]].concat(Array.from({length:MONTH.ndays-today+1},(_,i)=>today+i).map(x=>[x,dayLbl(x)+" · "+d.cards.filter(y=>y.kenh===c.kenh&&y.day===x).length+"/"+nhipOf(c.kenh,x)])),"")}</select>`:""}</div>`}).join("")||`<p class="hint">Không có video nào đang chờ xếp ngày.</p>`}</div>
   <p class="hint">Người giữ kênh tự chọn ngày đăng cho từng video. Số cạnh mỗi ngày là đã xếp / nhịp đăng của kênh, để cân: sản phẩm đẩy chính đăng dày hơn, sản phẩm ít video thì đăng cách ngày, sản phẩm P1 xếp sớm. Đổi ngày sau này ở thẻ video hoặc Calendar.</p></section>
  <section class="card flush"><div class="card-h pad"><h2>7 ngày tới</h2><span class="hint">đã xếp / nhịp đăng</span></div><div class="tbl"><table><thead><tr><th>Kênh</th>${D7.map(x=>`<th class="n">${dayLbl(x)}</th>`).join("")}</tr></thead><tbody>${CHANNELS.map(ch=>`<tr><td><b>${esc(ch.short)}</b><small>giữ kênh: ${esc(userName(chanOwner(ch.k))||"chưa đặt")}</small></td>${D7.map(x=>{const L=d.cards.filter(c=>c.kenh===ch.k&&c.day===x),cap=calCap(ch.k,x);return `<td class="n"><b class="${L.length>cap?"t-red":L.length===cap&&cap?"t-grn":""}">${L.length}</b>/${cap}<small>${esc(xvGroupBy(L,c=>c.sku).map(([k,l])=>sk(k).n.split(" ")[0]+" "+l.length).join(", "))}</small></td>`}).join("")}</tr>`).join("")}</tbody></table></div></section>`;
  b.querySelectorAll("[data-nhadd]").forEach(x=>x.onclick=()=>{const k=x.dataset.nhadd,f=x.closest(".nhadd"),a=+f.querySelector(".a").value,z=+f.querySelector(".z").value,n=+f.querySelector(".n").value;if(!n&&n!==0||f.querySelector(".n").value===""){toast("Gõ số video/ngày");return}DB.mutate(ME.name,"nhịp đăng "+k,dt=>{dt.settings.nhip=dt.settings.nhip||{};dt.settings.nhip[k]=(dt.settings.nhip[k]||[]).concat({tu:Math.min(a,z),den:Math.max(a,z),sl:n}).sort((p,q)=>p.tu-q.tu)});renderMain()});
  b.querySelectorAll("[data-nhx]").forEach(x=>x.onclick=()=>{const [k,i]=x.dataset.nhx.split("|");DB.mutate(ME.name,"bỏ giai đoạn nhịp đăng",dt=>dt.settings.nhip[k].splice(+i,1));renderMain()});
  if($("#hot-open"))$("#hot-open").onclick=()=>openHot();
  b.querySelectorAll("[data-setday]").forEach(x=>x.onchange=()=>{if(!x.value)return;DB.mutate(ME.name,"xếp ngày đăng "+x.dataset.setday+" → "+dd(+x.value),dt=>{const c=dt.cards.find(y=>y.id===x.dataset.setday);if(c)c.day=+x.value});toast("Đã xếp ngày đăng "+dd(+x.value));renderMain()});
}

/* ---------- ④ Kho video › Video sản xuất trong tháng: thêm video tự edit, gửi và duyệt video đã làm xong ---------- */
function xvVideoMade(b,o){
  b.innerHTML=`<div id="vm-e"></div>`;
  xvEdit2(b.querySelector("#vm-e"),o);
}
/* ---------- ④ Kho video & Calendar: video tồn tháng trước, video sản xuất trong tháng, rồi đẩy sang Calendar ---------- */
/* ---------- Phân bổ video theo tuần (chốt ở ① Kế hoạch, ⑤ Calendar đọc để cảnh báo thiếu) ---------- */
const PB_OPEN=new Set();
const PB_W=()=>WEEKS.map(x=>({w:x.w,tu:x.tu,den:Math.min(x.den,MONTH.ndays)}));
/* chia mặc định theo số ngày của từng tuần, tổng luôn đúng KPI tháng */
function pbDef(k){const W5=PB_W(),dys=W5.map(x=>x.den-x.tu+1),tot=dys.reduce((a,b)=>a+b,0),raw=dys.map(n=>k*n/tot),base=raw.map(Math.floor);let rest=k-base.reduce((a,b)=>a+b,0);raw.map((r,i)=>[r-Math.floor(r),i]).sort((a,b)=>b[0]-a[0]).forEach(([,i])=>{if(rest>0){base[i]++;rest--}});return base}
const pbArr=(d,kenh,sku,k)=>{const e=((d.phanBo||{})[kenh]||{})[sku];return Array.isArray(e)&&e.length===5?e.map(n=>+n||0):pbDef(+k||0)};
function pbHtml(d,ch,P,give){
  if(!P.length)return "";
  const kenh=ch.k,W5=PB_W(),A=P.map(x=>({x,a:pbArr(d,kenh,x.sku,x.sl)})),tot=sum(P,x=>+x.sl||0),open=PB_OPEN.has(kenh);
  const bad=A.filter(({x,a})=>a.reduce((s,n)=>s+n,0)!==(+x.sl||0));
  const wk=W5.map((w,i)=>{const items=A.filter(({a})=>a[i]>0),wt=A.reduce((s,{a})=>s+a[i],0),key=kenh+"|"+w.w,wo=PB_OPEN.has(key);
    return `<div class="pbw"><div class="pbwh clk" data-pbtog="${esc(key)}"><i class="ptar">${wo?"▾":"▸"}</i><b>Tuần ${w.w}</b> · ngày ${dd(w.tu)}–${dd(w.den)}: <b>${wt} video</b><span class="hint">${items.map(({x,a})=>a[i]+" "+esc(sk(x.sku).n)).join(" · ")}</span></div>
     ${wo?`<div class="pbl">${A.map(({x,a})=>`<div class="pbp">${swatch(x.sku)}<b>${esc(sk(x.sku).n)}</b>${give?`<input type="number" min="0" class="num" data-pbi="${esc(kenh)}|${w.w}|${x.sku}" data-kpi="${+x.sl||0}" value="${a[i]}">`:`<b>${a[i]}</b>`} video<small>(cả tháng ${+x.sl||0})</small></div>`).join("")}</div>`:""}</div>`}).join("");
  return `<section class="pbbox"><div class="pbh clk" data-pbtog="${esc(kenh)}"><i class="ptar">${open?"▾":"▸"}</i><b>Phân bổ theo tuần</b> · tổng video trong tháng: <b>${tot}</b>${bad.length?` ${pill("lệch KPI "+bad.length+" sản phẩm","amb")}`:""}</div>
   ${open?`${wk}${bad.length?`<p class="t-amb pbn">${bad.map(({x,a})=>`${esc(sk(x.sku).n)}: các tuần cộng ${a.reduce((s,n)=>s+n,0)}, KPI tháng ${+x.sl||0}${give?` <button class="lnk" data-pbreset="${esc(kenh)}|${x.sku}">chia lại theo ngày</button>`:""}`).join(" · ")}</p>`:`<p class="hint pbn">Các tuần cộng đúng KPI tháng. Mặc định chia theo số ngày của từng tuần, sửa số từng tuần ở trên.</p>`}`:""}</section>`
}
/* Ghi chú + một dòng "Tuyến" của sản phẩm: chị gõ tên tuyến cần có, không số lượng, không định dạng */
function wpTuyRow(d,x,give){
  const key=x.sku+"|"+x.kenh,pl=ptPil(d,x.sku,x.kenh)||{},T=d.tuyen.filter(z=>z.kenh===x.kenh&&z.sku===x.sku);
  const note=give?`<textarea class="ptnote" rows="1" data-pi="${esc(key)}" data-f="ghiChu" placeholder="Ghi chú cho sản phẩm này… (Enter để xuống dòng)">${esc(pl.ghiChu||"")}</textarea>`:(pl.ghiChu?`<span class="ptnote ro">${esc(pl.ghiChu)}</span>`:"");
  const chips=T.map(z=>{const n=d.cards.filter(c=>c.maTuyen===z.ma).length;return `<span class="tchip">${esc(z.tuyen)}${give&&!n?`<button type="button" class="lnk" data-tydel="${esc(z.ma)}" title="Bỏ tuyến này">✕</button>`:""}</span>`}).join("");
  return `<div class="ptnrow">${note}<div class="tyrow"><b>Tuyến</b>${chips||`<span class="hint">chưa có tuyến</span>`}${give?`<button type="button" class="btn sm ghost tyadd" data-tymodal="${esc(key)}">+ Thêm tuyến</button>`:""}</div></div>`
}
/* ---------- Giao việc tuần này: web đề xuất sẵn người và hạn, chị sửa dòng nào chưa đúng rồi bấm Giao ---------- */
/* người làm mặc định của một dạng video: người chị chọn lần trước, chưa có thì người đã làm dạng đó nhiều nhất */
/* người còn làm việc ở thời điểm hôm nay (chưa tới ngày nghỉ) */
function pvAvailUid(uid,hn){const d=D(),u=(d.users||[]).find(x=>x.id===uid);if(!u)return true;const n=pvOf(d,u).nghi;return !(n>0&&Math.max(d.settings.today,+hn||0)>=n)}
function wpDefPerson(d,t,team){const hn=defHan(d,null,t);team=team.filter(u=>pvAvailUid(u.id,hn));
  const m=(d.macDinh||{})[t];if(m&&team.some(u=>u.id===m))return m;
  const cnt={};d.cards.forEach(c=>{if(mixOf(c)===t){const u=c.giao||c.nguoiKB||c.nguoi;if(u)cnt[u]=(cnt[u]||0)+1}});
  (d.tasks||[]).filter(z=>z.mix===t).forEach(z=>{cnt[z.nguoi]=(cnt[z.nguoi]||0)+(z.sl||1)});
  const best=Object.entries(cnt).filter(([u])=>team.some(x=>x.id===u)).sort((a,b)=>b[1]-a[1])[0];
  return best?best[0]:((team[0]||{}).id||"")
}
/* việc còn phải giao: kế hoạch cộng dồn tới hết tuần hiện tại trừ số đã giao tới nay (không phụ thuộc đang chia theo tuần hay cả tháng) */
function wpProposals(d,kenh){
  const cw=weekOf(d.settings.today)||1,out=[];
  ptPairs().filter(x=>x.kenh===kenh&&knShown(d,x)).forEach(x=>{
    const key=wpKey(x.sku,x.kenh),per={};
    for(let i=1;i<=5;i++){const e0=wpOf(d,i)[key]||{},e=wpTot(e0)?e0:wpAutoEntry(d,x.sku,x.kenh,x.sl,i),m=wpMix(e);Object.keys(m).forEach(t=>{(per[t]=per[t]||[0,0,0,0,0])[i-1]=+m[t]||0})}
    MIX.forEach(([t,lb])=>{const a=per[t];if(!a)return;let s=0;const cum=a.map(n=>(s+=n));if(!cum[4])return;
      const given=d.cards.filter(c=>c.sku===x.sku&&c.kenh===x.kenh&&mixOf(c)===t).length+(t==="nhanban"?(d.tasks||[]).filter(z=>z.mix==="nhanban"&&z.sku===x.sku&&z.kenh===x.kenh).reduce((s2,z)=>s2+(z.sl||1),0):0);
      const rem=cum[4]-given;if(rem<=0)return;
      const h0=t==="oneshot"?5:Math.min(5,cw+1);
      out.push({sku:x.sku,kenh:x.kenh,t,lb,a,cum,given,rem,h0,left:Math.max(0,cum[h0-1]-given),cw})})});
  return out
}
/* hạn mặc định theo thời điểm cần: việc cho tuần sau thì làm xong trong tuần này; One shot, Review thì trước buổi quay 1 ngày */
function wpHorHan(d,t,h){
  const td=d.settings.today,nd=MONTH.ndays,cw=weekOf(td)||1,we=Math.min(nd,(WEEKS.find(x=>x.w===cw)||WEEKS[0]).den);
  if(["oneshot","kichban"].includes(t)){const s=(d.shoots||[]).filter(x=>!["Đã quay","Đã hủy"].includes(x.trangThai)&&x.day>td).sort((a,b)=>a.day-b.day)[0];if(s)return Math.max(td,s.day-1)}
  if(t==="ton")return Math.min(nd,td+2);
  return h>cw?Math.max(td,we):Math.min(nd,td+2)
}
/* ---------- Bảng phân vai & công suất: mỗi ô là số video mỗi tuần người đó làm được ở dạng đó (0 = không làm) ---------- */
const PV_T=[["oneshot","One shot"],["kichban","Review"],["worker","Worker"],["reup","Reup / xào"],["nhanban","Nhân bản win"],["outsource","Outsource"]];
let PV_OPEN=false;
/* mặc định theo cách chị đang phân việc; chị sửa ô nào là lưu lại cho người đó */
function pvDefault(u){
  const n=foldName(u.name),z={oneshot:0,kichban:0,worker:0,reup:0,nhanban:0,outsource:0};
  if(/quynh/.test(n))return {cap:Object.assign(z,{oneshot:40,kichban:15,worker:40,outsource:10}),nghi:0};
  if(/(^|\s)may(\s|$)/.test(n))return {cap:Object.assign(z,{worker:30,reup:30,nhanban:20}),nghi:0};
  if(/oanh/.test(n))return {cap:z,nghi:7};
  if(u.role==="admin"||/hoa/.test(n))return {cap:Object.assign(z,{oneshot:20,kichban:5}),nghi:0};
  return {cap:Object.assign(z,{oneshot:15,reup:20}),nghi:0}
}
function pvOf(d,u){const s=((d.phanVai2||{})[u.id])||null,df=pvDefault(u);return s?{cap:Object.assign({},df.cap,s.cap||{}),nghi:s.nghi!=null?+s.nghi:df.nghi}:df}
const pvQuayW=d=>d.pvQuay!=null?+d.pvQuay:10; // mỗi buổi quay chiếm bao nhiêu video công suất của người đi quay (quay, làm mẫu)
/* việc đã giao trong tuần này của một người ở một dạng; buổi quay trong tuần cũng là việc, tính vào tải */
function pvLoadT(d,uid,t,cw){return d.cards.filter(c=>(c.giao===uid||c.nguoiKB===uid||c.nguoiEdit===uid||c.nguoi===uid)&&mixOf(c)===t&&String(c.wk)===String(cw)).length+(d.tasks||[]).filter(z=>z.nguoi===uid&&z.mix===t&&String(z.wk)===String(cw)).reduce((s,z)=>s+(z.sl||1),0)}
function pvQuayN(d,uid,cw){const W=WEEKS.find(x=>x.w===cw)||WEEKS[0];return (d.shoots||[]).filter(s=>s.day>=W.tu&&s.day<=W.den&&!["Đã hủy"].includes(s.trangThai)&&(s.nguoi||[]).includes(uid)).length}
/* việc đang cầm (chưa xong), chỉ để chị tham khảo */
function pvLoad(d,uid){return d.cards.filter(c=>(c.giao===uid||c.nguoiKB===uid||c.nguoiEdit===uid||c.nguoi===uid)&&!["cg","dang","xong"].includes(c.step)).length+(d.tasks||[]).filter(z=>z.nguoi===uid&&z.st!=="done").reduce((s,z)=>s+(z.sl||1),0)}
/* chia từng video cho người đang "trống" nhất ở dạng đó: tải (việc đã giao + buổi quay) chia công suất của dạng thấp nhất thì nhận */
function pvAlloc(d,P,team){
  const td=d.settings.today,cw=P[0]?P[0].cw:(weekOf(td)||1),info={},load={},qn={};
  team.forEach(u=>{info[u.id]=pvOf(d,u);load[u.id]={};PV_T.forEach(([t])=>{load[u.id][t]=pvLoadT(d,u.id,t,cw)});qn[u.id]=pvQuayN(d,u.id,cw)*pvQuayW(d)});
  const out=[];
  P.forEach(p=>{
    const cand=p.t==="ton"?[]:team.filter(u=>{const i=info[u.id];return (i.cap[p.t]||0)>0&&!(i.nghi>0&&Math.max(td,defHan(d,null,p.t))>=i.nghi)});
    if(!cand.length){const ow=p.t==="ton"?chanOwner(p.kenh):"";out.push(Object.assign({},p,{n:p.left,u:(ow&&pvAvailUid(ow,defHan(d,null,p.t))&&team.some(x=>x.id===ow))?ow:wpDefPerson(d,p.t,team),tai:""}));return}
    const got={};for(let k=0;k<p.left;k++){let best=null,bs=1e9;cand.forEach(u=>{const sc=(load[u.id][p.t]+qn[u.id]+1)/info[u.id].cap[p.t];if(sc<bs){bs=sc;best=u}});got[best.id]=(got[best.id]||0)+1;load[best.id][p.t]++}
    Object.entries(got).forEach(([uid,n])=>{const used=load[uid][p.t]+qn[uid],cap=info[uid].cap[p.t];out.push(Object.assign({},p,{n,u:uid,over:used>cap,tai:"tải "+used+"/"+cap+(qn[uid]?" (gồm quay)":"")}))})});
  return out
}
function pvCard(d,give,team,kenh){
  if(!give)return "";const cw=weekOf(d.settings.today)||1;
  return `<section class="card pvcard"><div class="card-h"><h2>Phân vai & công suất</h2><span class="hint">mỗi ô là số video mỗi tuần người đó làm được ở dạng đó, 0 là không làm · web chia việc theo bảng này</span><span class="sp"></span><button type="button" class="btn sm ghost" data-pvtog="1">${PV_OPEN?"Thu gọn":"Mở bảng"}</button></div>
   ${PV_OPEN?`<div class="tbl"><table><thead><tr><th>Người</th>${PV_T.map(z=>`<th class="n">${z[1]}</th>`).join("")}<th class="n">Nghỉ từ ngày<small>0 = không nghỉ</small></th><th class="n">Quay tuần này<small>số buổi</small></th><th class="n">Đang cầm<small>việc chưa xong</small></th></tr></thead><tbody>
   ${team.map(u=>{const p=pvOf(d,u);return `<tr><td><b>${esc(u.name)}</b></td>${PV_T.map(z=>`<td class="n"><input type="number" min="0" class="num" data-pv="${esc(u.id)}|cap|${z[0]}" value="${p.cap[z[0]]||0}"></td>`).join("")}<td class="n"><input type="number" min="0" max="${MONTH.ndays}" class="num" data-pv="${esc(u.id)}|nghi" value="${p.nghi}"></td><td class="n">${pvQuayN(d,u.id,cw)}</td><td class="n">${pvLoad(d,u.id)}</td></tr>`}).join("")}</tbody></table></div>
   <div class="acts pvfoot"><label class="field">Mỗi buổi quay (quay, làm mẫu) chiếm <input type="number" min="0" class="num" data-pvq="1" value="${pvQuayW(d)}"> video công suất của người đi quay</label><span class="sp"></span><button type="button" class="btn sm ghost danger" data-pvreset="${esc(kenh||"")}" title="Hủy các việc đã giao nhưng chưa ai bắt đầu để chia lại từ đầu">Chia lại từ đầu</button></div>`:""}</section>`
}
function wpGivePanel(d,kenh,team,give){
  if(!give)return "";const P=wpProposals(d,kenh);if(!P.length)return pvCard(d,give,team,kenh);
  const cw=P[0].cw,days=Array.from({length:MONTH.ndays},(_,i)=>[i+1,dd(i+1)]),wkOpts=Array.from({length:5-cw+1},(_,i)=>[cw+i,"hết tuần "+(cw+i)]);
  const pOpts=[["","— chọn người —"]].concat(team.map(u=>{const n=pvOf(d,u).nghi;return [u.id,u.name+(n>0?" (nghỉ từ "+dd(n)+")":"")]}));
  return pvCard(d,give,team,kenh)+`<section class="card wpgive"><div class="card-h"><h2>Việc cần giao · tuần ${cw}</h2><span class="hint">web tổng hợp số lượng, chị chọn người và hạn · việc cho tuần sau thì giao trong tuần này, One shot quay cả tháng một lượt</span><span class="sp"></span><button type="button" class="btn pri" data-pgall="${esc(kenh)}">Giao các dòng đã tích</button></div>
   <div class="tbl"><table><thead><tr><th></th><th>Sản phẩm</th><th>Dạng</th><th>Cần đăng theo tuần</th><th class="n">Đã giao</th><th>Giao tới</th><th class="n">Số video</th><th>Người làm</th><th>Hạn</th><th></th></tr></thead><tbody>
   ${P.map((p,i)=>{const sg=p.left>0?pvAlloc(d,[Object.assign({},p,{left:p.left})],team)[0]:null,sgN=sg&&sg.u?userName(sg.u):"";
     return `<tr data-prow="${i}" data-sku="${p.sku}" data-kenh="${esc(p.kenh)}" data-t="${p.t}" data-cw="${p.cw}" data-cum="${p.cum.join(",")}" data-given="${p.given}"><td><input type="checkbox" data-pck></td><td>${swatch(p.sku)}<b>${esc(sk(p.sku).n)}</b></td><td>${esc(p.lb)}</td>
      <td class="pwk">${p.a.map((n,j)=>n?`<span class="${j+1===cw?"now":""}">T${j+1}: <b>${n}</b></span>`:"").join("")}</td><td class="n">${p.given}</td>
      <td><select data-phor>${opt(wkOpts,p.h0)}</select></td><td class="n"><input type="number" min="0" class="num" value="${p.left}" data-pn></td>
      <td><select data-pu>${opt(pOpts,"")}</select>${sgN?`<small class="psug">gợi ý: <button type="button" class="lnk" data-psug="${sg.u}">${esc(sgN)}</button> <span>${esc(sg.tai||"")}</span></small>`:""}</td>
      <td><select data-ph>${opt(days,wpHorHan(d,p.t,p.h0))}</select></td><td><button type="button" class="btn sm pri" data-pg1>Giao</button></td></tr>`}).join("")}
   </tbody></table></div></section>`
}
/* hạn mặc định: One shot và Review trước buổi quay gần nhất 1 ngày; Worker, Reup, Outsource, video tồn sau 2 ngày; còn lại cuối tuần */
function defHan(d,WW,t){
  const td=d.settings.today,nd=MONTH.ndays,wk=WEEKS.find(x=>td>=x.tu&&td<=x.den)||WEEKS[WEEKS.length-1],we=Math.min(nd,WW&&WW.w!=="M"&&WW.den?WW.den:wk.den);
  if(["oneshot","kichban"].includes(t)){const s=(d.shoots||[]).filter(x=>!["Đã quay","Đã hủy"].includes(x.trangThai)&&x.day>td).sort((a,b)=>a.day-b.day)[0];return s?Math.max(td,s.day-1):Math.max(td,we)}
  if(["worker","reup","outsource","ton"].includes(t))return Math.min(nd,td+2);
  return Math.max(td,we)
}
/* ---------- Mục tiêu video của từng kênh: trung bình mỗi ngày → tổng tháng → chia cho từng sản phẩm (KPI) → chia theo tuần ---------- */
const knLbl=k=>sk(k).n;
const knSw=k=>swatch(k);
const fx1=n=>Math.round(n*10)/10;
/* ngày sale đôi = ngày trùng tháng (10/10, 11/11, 12/12); tuần sale mặc định từ 7 ngày trước đến hết ngày sale đôi */
/* sản phẩm đang có trong kế hoạch của kênh: có KPI tháng hoặc chị vừa thêm vào */
const knShown=(d,x)=>+x.sl>0||((((d.kpiNgay||{})[x.kenh]||{}).sp)||[]).includes(x.sku);
function knSaleDay(){return MONTH.mon<=MONTH.ndays?MONTH.mon:0}
const knPairs=(d,kenh)=>ptPairs().filter(x=>x.kenh===kenh&&+x.sl>0);
/* chị nhập: trung bình video/ngày (cả tháng), video/ngày trong tuần sale; các ngày còn lại web tự dàn ra cho đủ tổng tháng.
   Chưa nhập trung bình thì lấy tổng KPI của các sản phẩm làm tổng tháng. */
function kn(d,kenh){
  const own=((d.kpiNgay||{})[kenh])||{},sd=own.saleDay!=null?Math.max(0,Math.min(MONTH.ndays,+own.saleDay||0)):knSaleDay(),nd=MONTH.ndays,sum0=sum(knPairs(d,kenh),x=>+x.sl);
  const tu=sd?(own.tuanSale&&own.tuanSale.tu!=null?Math.min(sd,Math.max(1,+own.tuanSale.tu||1)):Math.max(1,sd-7)):0,den=sd;
  const tbSet=own.tb!=null&&own.tb!==""&&+own.tb>=0,tb=tbSet?+own.tb:fx1(sum0/nd),T=tbSet?Math.round(tb*nd):sum0;
  const nS=tu>0?Math.max(0,Math.min(den,nd)-tu+1):0,nN=nd-nS,saleSet=nS>0&&own.sale!=null&&own.sale!==""&&+own.sale>0;
  const rS=saleSet?+own.sale:(nd?T/nd:0),rN=saleSet?(nN?Math.max(0,(T-rS*nS)/nN):0):(nd?T/nd:0);
  return {tb,T,tbSet,tu,den,sd,nS,nN,rS,rN,saleSet,sum0}
}
const knIsSale=(K,day)=>K.nS>0&&day>=K.tu&&day<=K.den;
/* kế hoạch của một kênh theo tuần: tổng video của kênh, và số video từng sản phẩm (KPI chia theo trọng số ngày) */
function knPlan(d,kenh){
  const K=kn(d,kenh),W5=PB_W(),pairs=knPairs(d,kenh),ks=pairs.map(x=>x.sku).filter((s,i,a)=>a.indexOf(s)===i);
  const wts=W5.map(w=>{let s=0,ns=0;for(let day=w.tu;day<=w.den;day++){s+=knIsSale(K,day)?K.rS:K.rN;if(knIsSale(K,day))ns++}return {s,ns,nd:w.den-w.tu+1}});
  const wt=wts.map(x=>x.s>0?x.s:x.nd),tong=wpSplit(K.T,wt);
  const P=W5.map((w,i)=>{const m={tong:tong[i],sale:wts[i].ns,thuong:wts[i].nd-wts[i].ns};ks.forEach(k=>m[k]=0);return m});
  const ownP=((d.kpiNgay||{})[kenh])||{};
  pairs.forEach(x=>{const ov=((ownP.tuanSL||{})[x.sku])||{},fixed=W5.map(w=>ov[w.w]!=null&&ov[w.w]!==""?Math.max(0,Math.floor(+ov[w.w]||0)):null),idx=fixed.map((v,i)=>v==null?i:-1).filter(i=>i>=0),used=sum(fixed.filter(v=>v!=null),v=>v),a2=idx.length?wpSplit(Math.max(0,+x.sl-used),idx.map(i=>wt[i])):[];let j=0;P.forEach((m,i)=>{m[x.sku]+=fixed[i]!=null?fixed[i]:(a2[j++]||0)})});
  P.ks=ks;P.K=K;return P
}
/* tổng các kênh */
function knPlanAll(d){
  const chs=CHANNELS.filter(ch=>knPairs(d,ch.k).length),A=PB_W().map(()=>({tong:0})),ks=[];
  chs.forEach(ch=>{const P=knPlan(d,ch.k);P.ks.forEach(k=>{if(!ks.includes(k))ks.push(k)});P.forEach((m,i)=>{A[i].tong+=m.tong;P.ks.forEach(k=>{A[i][k]=(A[i][k]||0)+m[k]})})});
  ks.forEach(k=>A.forEach(m=>{m[k]=m[k]||0}));A.ks=ks;return A
}
function kpiNgayHtml(d,give,kenh){
  const K=kn(d,kenh),P=knPlan(d,kenh),W5=PB_W(),ch=chOf(kenh),U=ch.needId?"video":"bài",all=ptPairs().filter(x=>x.kenh===kenh),rest=K.T-K.sum0,own=((d.kpiNgay||{})[kenh])||{},sp=Array.isArray(own.sp)?own.sp:[],shown=all.filter(x=>+x.sl>0||sp.includes(x.sku)),zero=shown.filter(x=>!(+x.sl>0)),addable=d.products.filter(p=>!shown.some(x=>x.sku===p.k));
  const p2=n=>String(n).padStart(2,"0"),inD=(f,day)=>`<input type="date" class="dt" ${give?"":"disabled"} data-kk="${esc(kenh)}|${f}" min="${MONTH.year}-${p2(MONTH.mon)}-01" max="${MONTH.year}-${p2(MONTH.mon)}-${p2(MONTH.ndays)}" value="${day?MONTH.year+"-"+p2(MONTH.mon)+"-"+p2(day):""}">`,inp=(f,v,ph)=>`<input type="number" min="0" step="0.1" class="num" ${give?"":"disabled"} data-kk="${esc(kenh)}|${f}" value="${v===""||v==null?"":v}" placeholder="${ph==null?"":ph}">`;
  const state=K.sum0===K.T?pill("khớp tổng tháng","grn"):K.sum0<K.T?pill("còn "+rest+" "+U+" chưa chia cho sản phẩm","amb"):pill("KPI các sản phẩm vượt "+(-rest)+" "+U,"amb");
  return `<section class="pbbox kn"><div class="pbh"><b>Mục tiêu ${U} · ${esc(ch.short)}</b> · tổng tháng: <b>${K.T}</b> ${U} </div>
   <div class="knr"><label>Trung bình <b>${U}/ngày</b> ${inp("tb",K.tbSet?K.tb:"",K.tb)}</label><span class="hint">= ${K.T} ${U} cả tháng${K.tbSet?(K.T===0?" (kênh này tháng này không chạy)":" (xóa ô này để lấy lại theo tổng KPI các sản phẩm)"):" (đang lấy theo tổng KPI các sản phẩm, nhập số vào để đổi, nhập 0 nếu tháng này không chạy)"}</span></div>
   <div class="knr"><b>Sale đôi</b><label>ngày sale đôi ${inD("saleDay",K.sd)}</label><label>tuần sale từ ngày ${inD("tu",K.tu)}</label><span class="hint">đến hết ${K.den?dd(K.den):"—"}</span><label>${U}/ngày trong tuần sale ${inp("sale",K.saleSet?K.rS:"",fx1(K.rS))}</label><span class="hint">${K.nS?K.nS+" ngày sale"+(K.saleSet?` × ${fx1(K.rS)} = ${Math.round(K.rS*K.nS)} ${U}, ${K.nN} ngày còn lại dàn ra khoảng ${fx1(K.rN)} ${U}/ngày`:""):"kênh này không chạy sale"}</span></div>
   <div class="tbl"><table><thead><tr><th>Sản phẩm</th><th class="n">Sản phẩm đẩy<small>KPI tháng</small></th><th class="n">Tồn dùng được<small>trong kho còn</small></th><th class="n">Sản xuất mới<small>đẩy trừ tồn</small></th>${W5.map(w=>`<th class="n">Tuần ${w.w}<small>${dd(w.tu)}–${dd(w.den)}</small></th>`).join("")}<th></th></tr></thead><tbody>
   ${shown.map(x=>{const a=+x.sl>0?P.map(m=>m[x.sku]||0):W5.map(()=>0);return `<tr><td>${swatch(x.sku)}<b>${esc(sk(x.sku).n)}</b> ${give?`<select class="hsel" data-kkh="${esc(kenh)}|${x.sku}">${opt(["Đẩy mạnh","Đẩy nhẹ","Giữ","Giữ nhẹ","Test"],x.huong||"Test")}</select>`:pill(x.huong||"Test",x.huong==="Đẩy mạnh"?"pnk":x.huong==="Test"||x.huong==="Đẩy nhẹ"?"amb":"gry")}</td><td class="n">${give?`<input type="number" min="0" class="num" data-kkp="${esc(kenh)}|${x.sku}" value="${x.sl||""}" placeholder="0">`:`<b>${x.sl||0}</b>`}</td><td class="n">${give?`<input type="number" min="0" class="num" data-kkt="${esc(kenh)}|${x.sku}" value="${x.ton||""}" placeholder="0">`:`<b>${x.ton||0}</b>`}<small class="${(+x.ton||0)>xvKhoFree().filter(q=>q.sku===x.sku).length?"t-red":""}">kho còn ${xvKhoFree().filter(q=>q.sku===x.sku).length}</small></td><td class="n"><b>${Math.max(0,(+x.sl||0)-(+x.ton||0))}</b></td>${a.map((n,wi)=>{const ovw=((((own.tuanSL||{})[x.sku])||{})[W5[wi].w]);const has=ovw!=null&&ovw!=="";return +x.sl>0&&give?`<td class="n"><input type="number" min="0" class="num wkin${has?" set":""}" data-kkw="${esc(kenh)}|${x.sku}|${W5[wi].w}" value="${n}" title="${has?"Số chị tự chỉnh":"Web chia đều, nhập số để tự chỉnh"}"></td>`:`<td class="n">${n||"—"}</td>`}).join("")}<td class="n">${give?`${(own.tuanSL||{})[x.sku]&&Object.keys(own.tuanSL[x.sku]).length?`<button type="button" class="lnk" data-kkwr="${esc(kenh)}|${x.sku}" title="Bỏ số đã chỉnh, chia đều lại">↺</button> `:""}<button type="button" class="lnk" data-kkdel="${esc(kenh)}|${x.sku}" title="Bỏ sản phẩm này khỏi kế hoạch kênh">✕</button>`:""}</td></tr>`}).join("")}${shown.length?"":`<tr><td colspan="10" class="empty">Chưa chọn sản phẩm nào cho kênh này.</td></tr>`}
   <tr class="knt"><td><b>Cộng sản phẩm</b></td><td class="n"><b>${K.sum0}</b></td><td class="n"><b>${sum(shown,x=>+x.ton||0)}</b></td><td class="n"><b>${sum(shown,x=>Math.max(0,(+x.sl||0)-(+x.ton||0)))}</b></td>${P.map(m=>`<td class="n"><b>${sum(P.ks,k=>m[k]||0)}</b></td>`).join("")}<td></td></tr>
   <tr class="knt"><td><b>Mục tiêu kênh</b><small>${K.nS?K.nS+" ngày sale · ":""}${K.nN} ngày thường</small></td><td class="n"><b>${K.T}</b></td><td></td><td></td>${P.map(m=>`<td class="n"><b>${m.tong}</b><small>${m.sale?m.sale+"n sale":""}</small></td>`).join("")}<td></td></tr></tbody></table></div>
   ${give&&addable.length?`<div class="knadd"><select data-kksel="${esc(kenh)}">${opt(addable.map(p=>[p.k,sk(p.k).n]),addable[0].k)}</select><button type="button" class="btn sm ghost" data-kkadd="${esc(kenh)}">+ Thêm sản phẩm</button></div>`:""}
   ${(()=>{const bad=shown.filter(x=>+x.sl>0).map(x=>({x,s:sum(P,m=>m[x.sku]||0)})).filter(z=>z.s!==+z.x.sl),tw=sum(P,m=>sum(P.ks,k=>m[k]||0));return `<p class="knchk ${bad.length?"bad":"ok"}">${bad.length?bad.map(z=>`${esc(sk(z.x.sku).n)}: các tuần cộng <b>${z.s}</b>, KPI <b>${z.x.sl}</b> → <b>${z.s>z.x.sl?"thừa "+(z.s-z.x.sl):"thiếu "+(z.x.sl-z.s)}</b> ${U}`).join(" · "):`Các tuần cộng <b>${tw}</b> ${U}, khớp KPI các sản phẩm ✓`}${tw!==K.T?` · Mục tiêu cả kênh ${K.T}: ${tw>K.T?"tuần đang <b>thừa "+(tw-K.T)+"</b>":"tuần đang <b>thiếu "+(K.T-tw)+"</b>"}`:""}</p>`})()}
   <p class="knoth">${state}${give&&rest>0&&zero.length?` <button type="button" class="btn sm ghost" data-kkrest="${esc(kenh)}">Chia nốt ${rest} ${U} đều cho ${zero.length} sản phẩm đang để 0 (${zero.map(x=>esc(sk(x.sku).n)).join(", ")})</button>`:""}</p></section>`
}
/* cần sản xuất thêm bao nhiêu video (cộng mọi kênh): kế hoạch ngày trừ video tồn và video đã có / đang làm */
function pbNeed(d){
  const W5=PB_W(),P=knPlanAll(d),pairs=ptPairs(),wM=wpOf(d,"M"),ks=P.ks,bySku={},free=xvKhoFree();
  const ton={};ks.forEach(k=>ton[k]=0);pairs.forEach(x=>{if(ks.includes(x.sku))ton[x.sku]+=(+x.ton>0?+x.ton:(+((((wM[wpKey(x.sku,x.kenh)]||{}).mix)||{}).ton)||0))});
  ks.forEach(k=>{const r=bySku[k]={need:[0,0,0,0,0]},tp=sum(P,m=>m[k]||0);
    P.forEach((m,i)=>{const t=tp?Math.round(ton[k]*(m[k]||0)/tp):0;r.need[i]=Math.max(0,(m[k]||0)-t)});
    r.ton=ton[k];r.kho=free.filter(q=>q.sku===k).length;
    r.have=d.cards.filter(c=>c.sku===k&&c.mix!=="ton"&&loaiOf(c)!=="kho"&&c.nguon!=="Order Digital"&&(["dang","xong"].includes(c.step)||(KV_PIPE.includes(c.step)&&(c.step!=="kb"||c.hookText||c.noiDung)))).length});
  return {bySku,W5,ks,P}
}
/* quay một lần có thể đủ cho cả tháng nên đối chiếu theo cả tháng: kế hoạch tháng - video tồn - video đã có / đang làm */
function pbRows(d){
  const {bySku,ks,P}=pbNeed(d);
  const all=ks.map(k=>{const r=bySku[k],plan=sum(P,m=>m[k]||0),after=sum(r.need,n=>n),tot=Math.max(0,after-r.have);return {sku:k,plan,ton:r.ton,kho:r.kho,have:r.have,tot,quaTon:r.ton>r.kho}}).filter(x=>x.plan>0);
  return {rows:all.filter(x=>x.tot>0),all,tonBad:all.filter(x=>x.quaTon)}
}
function pbBanner(d){
  const {rows,tonBad}=pbRows(d);if(!rows.length&&!tonBad.length)return "";
  return `<div class="note pbneed">${rows.length?`<b>Còn cần sản xuất cho cả tháng (cộng các kênh):</b> ${rows.map(x=>x.tot+" "+esc(knLbl(x.sku))).join(", ")}. `:""}${tonBad.length?`<b>⚠ Dùng video tồn nhiều hơn kho đang có:</b> ${tonBad.map(x=>esc(knLbl(x.sku))+" kế hoạch dùng "+x.ton+", kho còn "+x.kho).join("; ")}. `:""}<button class="lnk" data-gonq="1">Xem ở ② Lịch quay →</button></div>`
}
function quayNeedHtml(d,give){
  const {rows,all,tonBad}=pbRows(d);
  if(!rows.length&&!tonBad.length)return `<div class="note pbok2">Đủ video cho cả tháng theo mục tiêu mỗi ngày ở ① Kế hoạch. ✓</div>`;
  return `<div class="qneed"><div class="qnh"><b>Cần quay, sản xuất thêm cho cả tháng</b><small>mục tiêu mỗi ngày của các kênh ở ① Kế hoạch nhân lên cả tháng, trừ video tồn và video đã có / đang làm. Quay đủ số này một lần hay chia nhiều buổi đều được.</small></div>
   <table><thead><tr><th>Sản phẩm</th><th class="n">Kế hoạch tháng</th><th class="n">Dùng video tồn</th><th class="n">Kho tồn hiện có</th><th class="n">Đã có / đang làm</th><th class="n">Còn cần làm</th></tr></thead><tbody>${all.map(x=>`<tr><td>${knSw(x.sku)}<b>${esc(knLbl(x.sku))}</b></td><td class="n">${x.plan}</td><td class="n">${x.ton}</td><td class="n ${x.quaTon?"t-red":""}">${x.kho}${x.quaTon?`<small>thiếu ${x.ton-x.kho} so với kế hoạch dùng tồn</small>`:""}</td><td class="n">${x.have}</td><td class="n">${x.tot?`<b class="t-red">${x.tot}</b>`:'<b class="t-grn">đủ ✓</b>'}</td></tr>`).join("")}</tbody></table></div>`
}
function quayNeedText(d){
  const {rows}=pbRows(d);if(!rows.length)return "";
  return `Cần quay thêm cho cả tháng: ${rows.map(x=>x.tot+" "+knLbl(x.sku)).join(", ")}.`
}
/* Calendar: video đã xếp lịch đăng / mục tiêu từng tuần của từng kênh */
function calWeekPlan(o){
  const d=o.d,today=d.settings.today,W5=PB_W();
  const chs=CHANNELS.filter(ch=>knPairs(d,ch.k).length);
  const rows=chs.map(ch=>{const P=knPlan(d,ch.k);
    const cells=W5.map((w,i)=>{const plan=P[i].tong,u=d.cards.filter(c=>c.kenh===ch.k&&c.day>=w.tu&&c.day<=w.den).length,th=Math.max(0,plan-u),st=today>=w.tu;
      return `<td class="n ${th?(st?"pbbad":"pbwarn"):"pbok"}"><b>${u}</b>/${plan}${th?` <small>−${th}</small>`:""}</td>`}).join("");
    return `<tr><td><b>${esc(ch.short)}</b></td>${cells}</tr>`}).join("");
  return `<section class="card flush"><div class="card-h pad"><h2>Mục tiêu đăng theo tuần</h2><span class="hint">đã xếp / mục tiêu · đỏ là tuần đã bắt đầu mà còn thiếu</span></div><div class="tbl"><table class="calwp"><thead><tr><th>Kênh</th>${W5.map(w=>`<th class="n">Tuần ${w.w}<small>${dd(w.tu)}–${dd(w.den)}</small></th>`).join("")}</tr></thead><tbody>${rows||`<tr><td colspan="6" class="empty">Chưa có kế hoạch kênh.</td></tr>`}</tbody></table></div></section>`
}
/* ---------- ④ Kho video: tổng quan số lượng, video đợi duyệt, video cần phân bổ (tồn tháng trước + sản xuất trong tháng) · ⑤ Calendar tách riêng ---------- */
const KV_PIPE=["kb","dkb","quay","edit","worker","dvd","dceo"];
function khoSummary(o){
  const d=o.d,pairs=ptPairs();
  const rows=CHANNELS.map(ch=>{const P=pairs.filter(x=>x.kenh===ch.k);if(!P.length)return "";
    const need=sum(P,x=>x.sl),C=d.cards.filter(c=>c.kenh===ch.k&&c.nguon!=="Order Digital");
    const ready=C.filter(c=>["dang","xong"].includes(c.step)).length,wip=C.filter(c=>KV_PIPE.includes(c.step)&&(c.step!=="kb"||c.hookText||c.noiDung)).length,thieu=Math.max(0,need-ready),own=userName(chanOwner(ch.k));
    const spRows=[...new Set(P.map(x=>x.sku).concat(C.map(c=>c.sku)))].map(s=>{const pl=sum(P.filter(x=>x.sku===s),x=>+x.sl||0),cs=C.filter(c=>c.sku===s),dd2=cs.filter(c=>c.step==="xong").length,cho=cs.filter(c=>c.step==="dang").length,lam=cs.filter(c=>KV_PIPE.includes(c.step)&&(c.step!=="kb"||c.hookText||c.noiDung)).length,th=Math.max(0,pl-dd2-cho);if(!pl&&!cs.length)return "";
      return `<tr><td class="l">${swatch(s)}${esc(sk(s).n)}</td><td>${pl}</td><td>${dd2}</td><td>${cho}</td><td>${lam}</td><td class="${th?"t-red":"t-grn"}"><b>${th}</b></td></tr>`}).join("");
    const spT=spRows?`<table class="khosp"><thead><tr><th class="l">Sản phẩm</th><th title="Kế hoạch cả tháng">Kế hoạch</th><th>Đã đăng</th><th title="Đã duyệt, chờ đăng">Chờ đăng</th><th title="Đang viết hook, quay, dựng, chờ duyệt">Đang làm</th><th title="Kế hoạch trừ đã đăng và chờ đăng">Thiếu</th></tr></thead><tbody>${spRows}</tbody></table>`:"";
    return `<div class="khoc${thieu?" bad":""}"><div class="khoh"><b>${esc(ch.short)}</b><small>${own?"giữ kênh: "+esc(own):""}</small></div><div class="khon"><div><span title="Tổng video cả tháng">Tổng tháng</span><b>${need}</b></div><div><span title="Đã duyệt, sẵn đăng">Đã duyệt</span><b>${ready}</b></div><div><span>Đang làm</span><b>${wip}</b></div><div><span>Thiếu</span><b class="${thieu?"t-red":"t-grn"}">${thieu}</b></div></div>${thieu?`<p class="t-red">⚠ Còn thiếu ${thieu} video${wip?` · đang làm ${wip} video`:""}</p>`:`<p class="t-grn">Đủ video cho cả tháng.</p>`}</div>`}).join("");
  return `<section class="card"><div class="card-h"><h2>Tổng quan kho video</h2><span class="hint">cả tháng · theo kế hoạch từng kênh · kho tồn còn ${xvKhoFree().length} video dùng được</span></div><div class="khos">${rows||`<p class="hint">Chưa có kế hoạch kênh nào.</p>`}</div></section>`
}
/* tìm video trong Kho video: dán link Drive / link TikTok / mã / chữ trong hook, caption, tên file. Tìm ở cả video sản xuất, video đợi duyệt và kho tồn. */
function ksFind(qRaw){
  const d=D(),q=String(qRaw||"").trim();if(!q)return [];
  const isLink=/^https?:|drive\.google|tiktok\.com|\/d\/|[0-9]{19}/i.test(q),key=isLink?linkKey(q):null,fq=bkFold(q),out=[],seenK=new Set();
  const hitText=(...a)=>a.some(x=>x&&bkFold(x).includes(fq));
  d.cards.forEach(c=>{
    const hit=isLink?[c.linkVideo,c.linkFinal,c.linkDang].some(u=>u&&linkKey(u)===key)||(key&&key.startsWith("tt:")&&c.tiktokId&&"tt:"+c.tiktokId===key):hitText(c.id,c.hookText,c.yTuong,c.caption,c.khoMa,sk(c.sku).n);
    if(hit){out.push({kind:"card",c});if(c.khoMa)seenK.add(c.khoMa)}});
  (d.kho||[]).forEach(k=>{if(seenK.has(k.ma))return;
    const hit=isLink?(k.link&&linkKey(k.link)===key)||(k.linkBai&&linkKey(k.linkBai)===key):hitText(k.ma,k.ten,k.tuyen,k.caption,k.skuText,sk(k.sku).n);
    if(hit)out.push({kind:"kho",k})});
  return out
}
function ksSearchHtml(q){
  const R=ksFind(q),d=D();
  const row=r=>{if(r.kind==="kho"){const k=r.k,s=ktState(k),c=k.maDang&&d.cards.find(y=>y.id===k.maDang);
      return `<tr class="ktr clk" data-ksr="kho|${esc(k.ma)}"><td class="mono">${esc(k.ma)}</td><td>${swatch(k.sku)}${esc(sk(k.sku).n)}</td><td>Kho video tồn</td><td>${s==="free"?pill("Chưa phân bổ","gry"):s==="cho"?pill("Chờ đăng","blu"):pill("Đã đăng","grn")}</td><td>${c?esc(chOf(c.kenh).short):"—"}</td><td class="kstn">${esc(((k.tuyen||"")+" "+(k.ten||"")).trim())}</td><td>${k.link?`<a href="${esc(khoLink(k))}" target="_blank" rel="noopener">▶</a>`:"—"}</td></tr>`}
    const c=r.c,inKho=!!c.khoMa,st=c.step==="xong"?pill("Đã đăng","grn"):c.step==="dang"?pill("Chờ đăng","blu"):pill(stepName(c.step),"gry"),where=inKho?"Kho video tồn":c.step==="xong"||c.step==="dang"?"Video sản xuất trong tháng":"Đang làm / đợi duyệt",lk=c.linkFinal||c.linkVideo;
    return `<tr class="ktr clk" data-ksr="${inKho?"kho|"+esc(c.khoMa):"card|"+esc(c.id)}"><td class="mono">${esc(inKho?c.khoMa:c.id)}</td><td>${swatch(c.sku)}${esc(sk(c.sku).n)}</td><td>${where}</td><td>${st}</td><td>${esc(chOf(c.kenh).short)}</td><td class="kstn">${esc(c.hookText||c.yTuong||"")}</td><td>${lk?`<a href="${esc(/^https?:/.test(lk)?lk:"https://"+lk)}" target="_blank" rel="noopener">▶</a>`:"—"}</td></tr>`};
  return `<section class="card flush"><div class="card-h pad"><h2>Kết quả tìm kiếm</h2><span class="hint">${R.length?R.length+" video khớp với “"+esc(q.length>60?q.slice(0,60)+"…":q)+"”":"Không có video nào khớp. Link này chưa có trong hệ thống."}</span><span class="sp"></span><button type="button" class="btn sm" data-ksx="1">✕ Xóa tìm kiếm</button></div>
   ${R.length?`<div class="tbl"><table class="kstab"><thead><tr><th>Mã</th><th>Sản phẩm</th><th>Đang nằm ở</th><th>Trạng thái</th><th>Kênh</th><th>Tên / hook</th><th>Video</th></tr></thead><tbody>${R.slice(0,100).map(row).join("")}</tbody></table></div>`:""}</section>`
}
function xvKhoAll(b,o){
  if(!["wait","can","sx"].includes(XV.ks))XV.ks="wait";
  const pend=o.d.cards.filter(c=>["edit","dvd","dceo"].includes(c.step)&&!c.wt).length,n=xvKhoFree().length;
  const ndn=o.d.cards.filter(c=>c.step==="xong").length,nsx=o.d.cards.filter(c=>["dang","xong"].includes(c.step)&&((loaiOf(c)!=="kho"&&c.mix!=="ton")||c.repostOf)).length,TB=[["wait","① Video đợi duyệt"+(pend?` (${pend})`:"")],["sx","② Video sản xuất trong tháng ("+nsx+")"],["can","③ Kho video tồn ("+n+")"]];
  b.innerHTML=`${khoSummary(o)}<div class="ntrow ktool"><div class="seg ptk">${TB.map(([k,t])=>`<button data-xks="${k}" class="${XV.ks===k?"on":""}">${t}</button>`).join("")}</div><div class="ktool2"><input type="search" class="ksearch" id="xk-q" value="${esc(XV.q||"")}" placeholder="🔍 Tìm video: dán link Drive, mã, hook…" title="Dán link Drive hoặc gõ mã, hook, caption rồi bấm Enter"><button type="button" class="btn sm pri" data-xadd="1" title="Thêm một video chưa có trong hệ thống">+ Thêm video</button><button type="button" class="btn sm" data-xadd="1" title="Tải file Excel có nhiều link video một lúc (có file mẫu)">⬆ Tải hàng loạt</button><button type="button" class="btn sm" data-xexp="1" title="Xuất danh sách đang xem ra Excel">⬇ Xuất danh sách</button></div></div><div id="xk-b"></div>`;ntBind(b);
  b.querySelectorAll("[data-xadd]").forEach(x=>x.onclick=openThemVideo);
  b.querySelectorAll("[data-xexp]").forEach(x=>x.onclick=()=>{if(XV.exp)xlsExport(XV.exp.file,XV.exp.sheet,XV.exp.head,XV.exp.rows);else toast("Tab này chưa có danh sách để xuất")});
  b.querySelectorAll("[data-xks]").forEach(x=>x.onclick=()=>{XV.ks=x.dataset.xks;renderMain()});
  const qi=b.querySelector("#xk-q");if(qi){const go=()=>{const v=qi.value.trim();if(v===(XV.q||""))return;XV.q=v;renderMain()};qi.onkeydown=e=>{if(e.key==="Enter")go()};qi.onchange=go;qi.onpaste=()=>setTimeout(go,60)}
  const c=b.querySelector("#xk-b");
  if(XV.q){c.innerHTML=ksSearchHtml(XV.q);c.querySelectorAll("[data-ksx]").forEach(x=>x.onclick=()=>{XV.q="";renderMain()});c.querySelectorAll("[data-ksr]").forEach(r=>r.onclick=e=>{if(e.target.closest("a"))return;const [k,id]=r.dataset.ksr.split("|");if(k==="kho")ktModal(id);else{const cc=D().cards.find(y=>y.id===id);if(cc&&["dang","xong"].includes(cc.step))scModal(id);else openCard(id)}});return}
  if(XV.ks==="wait")xvVideoMade(c,o);else{XV.kind=XV.ks==="sx"?"sx":"ton";xvVideoCan(c,o)}
}
/* Kho video: tồn tháng trước + sản xuất trong tháng, lọc theo sản phẩm */
function xvVideoCan(b,o){
  const d=o.d;
  const sx=d.cards.filter(c=>["dang","xong"].includes(c.step)&&((loaiOf(c)!=="kho"&&c.mix!=="ton")||c.repostOf)),free=xvKhoFree(),cnt={};
  (XV.kind==="ton"?free:sx).forEach(k=>{cnt[k.sku]=(cnt[k.sku]||0)+1});
  
  if(XV.kind!=="ton"){b.innerHTML=`<div id="vc-t"></div>`;xvSanXuat(b.querySelector("#vc-t"),o,sx);return}
  b.innerHTML=`<section class="card"><div class="xkho"><button class="pchip${XV.khoSku?"":" on"}" data-khosku="">Mọi sản phẩm</button>${Object.entries(cnt).sort((a,c)=>c[1]-a[1]).map(([k,n])=>`<button class="pchip${XV.khoSku===k?" on":""}" data-khosku="${esc(k)}">${swatch(k)}${esc(sk(k).n)} <b>${n}</b></button>`).join("")}</div></section><div id="vc-t"></div>`;
  b.querySelectorAll("[data-xkind]").forEach(x=>x.onclick=()=>{XV.kind=x.dataset.xkind;XV.khoSku="";renderMain()});
  b.querySelectorAll("[data-khosku]").forEach(x=>x.onclick=()=>{XV.khoSku=x.dataset.khosku;renderMain()});
  const w=b.querySelector("#vc-t");
  if(XV.kind==="ton"){xvKhoTon(w,o);return}
  xvSanXuat(w,o,sx)
}
/* Video đã đăng = lịch đăng thực tế: mô phỏng sheet "Video Đã Đăng". Nhân sự điền ngày, link bài, ID; báo cáo TikTok tải lên thì số view, đơn, GMV tự nhảy vào đây. */
function vidRate(c){
  const v=+c.view||0,n=+c.don||0;
  if(!v&&!n)return ["","—"];
  if(n>200)return ["grn","Xuất sắc"];if(n>=100)return ["grn","Win"];if(n>=50)return ["blu","Tốt"];if(n>=20)return ["amb","Khá"];if(n>=10)return ["gry","Trung bình"];return ["red","Chuyển đổi thấp"]
}
function xvDaDang(b,o){
  const d=o.d,give=xvGive();if(!XV.dnK)XV.dnK="";if(!XV.dnS)XV.dnS="";
  const all=d.cards.filter(c=>c.step==="xong"),base=all.filter(c=>(!XV.dnK||c.kenh===XV.dnK)&&(!XV.dnS||c.sku===XV.dnS)).sort((p,q)=>((+q.ngayDang||+q.day||0)-(+p.ngayDang||+p.day||0))||String(p.id).localeCompare(String(q.id)));
  const skus=[...new Set(all.map(c=>c.sku))],p2=n=>String(n).padStart(2,"0"),dv=n=>n?MONTH.year+"-"+p2(MONTH.mon)+"-"+p2(n):"",lk=u=>/^https?:/.test(u||"")?u:(u?"https://"+u:"");
  const may=c=>give||c.nguoi===ME.id||chanOwner(c.kenh)===ME.id,dis=c=>may(c)?"":"disabled";
  const tiktokUrl=c=>c.linkDang||(c.tiktokId?"https://www.tiktok.com/@aillavietnamstore/video/"+c.tiktokId:"");
  const ctr=c=>c.view?((+c.click||0)/c.view*100).toFixed(1)+"%":"—";
  b.innerHTML=xvChuaKhop()+`<section class="card flush"><div class="card-h pad"><h2>Lịch đăng thực tế · video đã đăng</h2><span class="hint">${base.length} video · nhân sự dán link bài, ID tự nhảy; tải báo cáo video TikTok ở Nhập báo cáo thì View, CTR, GMV, đơn, đánh giá tự cập nhật</span></div>
   <div class="pad sxfil"><select data-dnk="1" aria-label="Kênh">${opt([["","Mọi kênh"]].concat(CHANNELS.map(c=>[c.k,c.short+" ("+all.filter(v=>v.kenh===c.k).length+")"])),XV.dnK)}</select><select data-dns="1" aria-label="Sản phẩm">${opt([["","Mọi sản phẩm"]].concat(skus.map(s=>[s,sk(s).n+" ("+all.filter(v=>v.sku===s).length+")"])),XV.dnS)}</select><span class="hint">Tổng: ${nf(sum(base,c=>+c.view||0))} view · ${nf(sum(base,c=>+c.don||0))} đơn · ${money(sum(base,c=>+c.gmv||0))} · Đánh giá theo đơn: Xuất sắc &gt;200 · Win 100–200 · Tốt 50–99 · Khá 20–49 · Trung bình 10–19 · Chuyển đổi thấp &lt;10</span></div>
   <div class="tbl bvscroll"><table class="bvtab dntab pn23"><thead><tr><th>STT</th><th>Mã</th><th>Sản phẩm</th><th>Nguồn</th><th>Người dựng</th><th>Link video (Drive)</th><th>Kênh</th><th>Dự kiến</th><th>Thực tế</th><th>Link bài đăng</th><th>ID video</th><th class="n">View</th><th class="n">CTR</th><th class="n">GMV</th><th class="n">Đơn</th><th>Đánh giá</th><th></th></tr></thead><tbody>
   ${base.slice(0,300).map((c,i)=>{const rt=vidRate(c);return `<tr><td class="bvstt">${i+1}</td><td class="mono clk" data-card="${esc(c.id)}">${esc(c.id)}</td><td>${swatch(c.sku)}${esc(sk(c.sku).n)}<small class="fpmt">${esc(c.hookText||"")}</small></td><td>${esc(c.nguon||"")}</td><td>${esc(userName(c.nguoiEdit||c.nguoiKB||c.nguoi)||"—")}</td>
    <td class="bvlk"><input class="bvhook" data-dnc="${esc(c.id)}|linkVideo" value="${esc(c.linkFinal||c.linkVideo||"")}" placeholder="Dán link Drive…" ${dis(c)}>${(c.linkFinal||c.linkVideo)?`<a href="${esc(lk(c.linkFinal||c.linkVideo))}" target="_blank" rel="noopener" title="Mở video">↗</a>`:""}</td>
    <td><select data-dnc="${esc(c.id)}|kenh" ${dis(c)}>${opt(CHANNELS.map(x=>[x.k,x.short]),c.kenh)}</select></td>
    <td><input type="date" class="bvhook" data-dnc="${esc(c.id)}|day" value="${dv(+c.day||0)}" min="${dv(1)}" max="${dv(MONTH.ndays)}" ${dis(c)}></td>
    <td><input type="date" class="bvhook" data-dnc="${esc(c.id)}|ngayDang" value="${dv(+c.ngayDang||0)}" min="${dv(1)}" max="${dv(MONTH.ndays)}" ${dis(c)}></td>
    <td class="bvlk"><input class="bvhook" data-dnc="${esc(c.id)}|linkDang" value="${esc(c.linkDang||"")}" placeholder="Dán link bài…" ${dis(c)}>${tiktokUrl(c)?`<a href="${esc(tiktokUrl(c))}" target="_blank" rel="noopener" title="Mở bài trên kênh">↗</a>`:""}</td>
    <td class="mono">${esc(c.tiktokId||"—")}</td>
    <td class="n">${c.view?nf(c.view):"—"}</td><td class="n">${ctr(c)}</td><td class="n">${c.gmv?money(c.gmv):"—"}</td><td class="n">${c.don?nf(c.don):"—"}</td><td>${rt[0]?pill(rt[1],rt[0]):"—"}</td>
    <td></td></tr>`}).join("")||`<tr><td colspan="17" class="empty">Chưa có video đã đăng.</td></tr>`}</tbody></table></div>${base.length>300?`<p class="hint pad">Chỉ hiện 300 dòng đầu, lọc theo kênh hoặc sản phẩm để xem tiếp.</p>`:""}</section>`;
  b.querySelectorAll("[data-ckm]").forEach(x=>x.onclick=()=>{const id=x.dataset.ckm,sel=b.querySelector('[data-cks="'+id+'"]'),cid=sel&&sel.value;if(!cid){toast("Chọn video chờ đăng để khớp");return}ckMatch(id,cid)});
  b.querySelectorAll("[data-ckx]").forEach(x=>x.onclick=()=>{const id=x.dataset.ckx;DB.mutate(ME.name,"bỏ qua video TikTok chưa khớp "+id,dt=>{dt.ttChua=(dt.ttChua||[]).filter(r=>r.id!==id)});renderMain()});
  b.querySelectorAll("[data-dnk]").forEach(x=>x.onchange=()=>{XV.dnK=x.value;renderMain()});
  b.querySelectorAll("[data-dns]").forEach(x=>x.onchange=()=>{XV.dnS=x.value;renderMain()});
  b.querySelectorAll("[data-dnc]").forEach(i=>i.onchange=()=>{const [id,f]=i.dataset.dnc.split("|"),v=i.value.trim();
    DB.mutate(ME.name,"sửa video đã đăng "+id,dt=>{const c=dt.cards.find(y=>y.id===id);if(!c)return;
      if(f==="ngayDang")c.ngayDang=v?+v.slice(8,10):0;
      else if(f==="day")c.day=v?+v.slice(8,10):0;
      else if(f==="kenh")c.kenh=v;
      else if(f==="linkVideo"){c.linkVideo=v;if(c.linkFinal)c.linkFinal=v}
      else{c.linkDang=v;const m=v.match(/[0-9]{19}/);if(m)c.tiktokId=m[0]}});renderMain()});
  b.querySelectorAll("[data-dnrp]").forEach(x=>x.onclick=()=>{const id=x.dataset.dnrp,c=D().cards.find(y=>y.id===id);if(!c)return;
    const root=c.repostOf||c.id,fam=D().cards.filter(y=>y.id===root||y.repostOf===root),free=CHANNELS.filter(k=>!fam.some(y=>y.kenh===k.k));
    if(!free.length){toast("Video này đã có ở mọi kênh");return}
    const ov=document.createElement("div");ov.className="wpmodal";
    ov.innerHTML='<div class="wpmbox"><div class="wpmh"><b>Đăng thêm '+esc(c.id)+' lên kênh khác</b><button type="button" class="lnk" data-rx="1">✕ Đóng</button></div><p class="hint">Tạo một thẻ mới cho kênh được chọn, vào thẳng "Chờ đăng" để người đăng dán link bài, caption riêng. Thẻ này vẫn giữ nguyên là đã đăng.</p><div class="bvqr two"><label>Kênh<select id="rp2-k">'+opt(free.map(k=>[k.k,k.short]),free[0].k)+'</select></label><label>Ngày đăng<input id="rp2-d" type="date" value="'+dv(Math.min(MONTH.ndays,D().settings.today+1))+'" min="'+dv(1)+'" max="'+dv(MONTH.ndays)+'"></label></div><label class="field">Người đăng<select id="rp2-n">'+opt(userOpts(),c.nguoi)+'</select></label><div class="acts"><button type="button" class="btn ghost" data-rx="1">Hủy</button><button type="button" class="btn pri" id="rp2-go">Tạo thẻ</button></div></div>';
    document.body.appendChild(ov);ov.querySelectorAll("[data-rx]").forEach(y=>y.onclick=()=>ov.remove());
    ov.querySelector("#rp2-go").onclick=()=>{const dv2=ov.querySelector("#rp2-d").value,r=repostCard(ME,id,ov.querySelector("#rp2-k").value,dv2?+dv2.slice(8,10):0,ov.querySelector("#rp2-n").value);if(!r||String(r).startsWith("Video")||String(r).startsWith("Không")){toast(r||"Chưa tạo được");return}ov.remove();toast("Đã tạo thẻ "+r+" ở kênh mới, vào tab ③ để dán link bài khi đăng");renderMain()}});
  bindCommon(b)
}
/* Gợi ý khớp: video TikTok có trong báo cáo nhưng chưa gắn thẻ nào, so với các video đang chờ đăng (cùng sản phẩm, tên gần giống, cùng kênh, ngày gần nhau) */
const ckTok=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>=3);
function ckScore(r,c){
  let s=0;const sku=(typeof guessSku==="function"&&(guessSku(r.sp)||guessSku(r.ten)))||"";if(sku&&sku===c.sku)s+=3;
  if(r.kenh&&r.kenh===c.kenh)s+=2;
  const A=new Set(ckTok(r.ten)),B=ckTok((c.hookText||"")+" "+(c.noiDung||"")+" "+(c.yTuong||""));let ov=0;B.forEach(x=>{if(A.has(x))ov++});s+=Math.min(5,ov);
  const dd0=+String(r.tm||"").slice(8,10);if(dd0&&c.day&&Math.abs(dd0-c.day)<=2)s+=1;return s
}
function xvChuaKhop(){
  const d=D(),U=(d.ttChua||[]).filter(r=>!d.cards.some(c=>c.tiktokId===r.id));if(!U.length)return "";
  const cho=d.cards.filter(c=>c.step==="dang"&&c.mix!=="ton");
  return `<section class="card flush"><div class="card-h pad"><h2>Video TikTok mới chưa khớp thẻ (${U.length})</h2><span class="hint">có trong báo cáo TikTok nhưng chưa gắn video nào · web gợi ý khớp với video chờ đăng, chị chọn đúng rồi bấm Khớp</span></div>
   <div class="tbl"><table><thead><tr><th>Video trên TikTok</th><th>Ngày</th><th class="n">View</th><th class="n">Đơn</th><th>Khớp với video chờ đăng</th><th></th></tr></thead><tbody>${U.slice(0,30).map(r=>{const L=cho.map(c=>({c,s:ckScore(r,c)})).sort((p,q)=>q.s-p.s).slice(0,8);const best=L[0]&&L[0].s>=4?L[0].c.id:"";
    return `<tr><td><b>${esc((r.ten||"").slice(0,70))}</b><small class="fpmt">${esc(r.sp||"")}${r.kenh?" · "+esc(chOf(r.kenh).short):""}</small></td><td>${esc(r.tm||"")}</td><td class="n">${nf(r.view)}</td><td class="n">${nf(r.don)}</td>
     <td><select data-cks="${esc(r.id)}">${opt([["","— chọn video chờ đăng —"]].concat(L.map(x=>[x.c.id,x.c.id+" · "+(x.c.hookText||"").slice(0,30)+" · "+sk(x.c.sku).n+" · "+chOf(x.c.kenh).short+(x.s>=4?" · gợi ý":"")])),best)}</select></td>
     <td><button class="btn sm pri" data-ckm="${esc(r.id)}">Khớp</button> <button class="lnk" data-ckx="${esc(r.id)}" title="Bỏ qua video này">Bỏ qua</button></td></tr>`}).join("")}</tbody></table></div></section>`
}
function ckMatch(rid,cid){
  const d=D(),r=(d.ttChua||[]).find(x=>x.id===rid),c=d.cards.find(x=>x.id===cid);if(!r||!c){toast("Không tìm thấy");return}
  const url="https://www.tiktok.com/@aillavietnamstore/video/"+r.id,dayN=+String(r.tm||"").slice(8,10)||D().settings.today;
  const e=moveCard(ME,cid,"xong",{linkDang:c.linkDang||url,tiktokId:r.id,ngayDang:dayN});if(e){toast(e);return}
  DB.mutate(ME.name,"khớp video TikTok "+rid+" với "+cid,dt=>{const k=dt.cards.find(y=>y.id===cid);if(k){k.view=r.view;k.click=r.click;k.don=r.don;k.gmv=r.gmv;k.giuChan=r.xh;k.ngayDang=dayN;if(!k.day)k.day=dayN}dt.ttChua=(dt.ttChua||[]).filter(y=>y.id!==rid)});
  toast("Đã khớp, video sang Lịch đăng thực tế ở ④ Calendar");renderMain()
}
/* Video sản xuất trong tháng: danh sách gọn kiểu Notion. Mỗi ngày nhân sự tích chọn video đăng (theo số video/ngày của kế hoạch),
   đăng xong dán link TikTok rồi bấm Đã đăng, video tự sang Lịch đăng thực tế ở Calendar. Bấm ▸ để xem đủ cột: link Drive, caption, chỉ số. */
function xvSanXuat(w,o,sx){
  const d=o.d,give=xvGive(),td=d.settings.today,p2=n=>String(n).padStart(2,"0"),dv=n=>n?MONTH.year+"-"+p2(MONTH.mon)+"-"+p2(n):"",lk=u=>/^https?:/.test(u||"")?u:(u?"https://"+u:"");
  if(!XV.sxSel)XV.sxSel=new Set();if(!XV.sxDay)XV.sxDay=td;if(!XV.sxK)XV.sxK="";if(!["","cho","chua","xong"].includes(XV.sxSt))XV.sxSt="";
  const day=XV.sxDay,sxS=c=>c.step==="xong"?"xong":(c.choDang||c.day)?"cho":"chua";
  const base=sx.filter(c=>(!XV.khoSku||c.sku===XV.khoSku)&&(!XV.sxK||c.kenh===XV.sxK)),nS={cho:0,chua:0,xong:0};base.forEach(c=>nS[sxS(c)]++);
  const L=base.filter(c=>!XV.sxSt||sxS(c)===XV.sxSt).sort((p,q)=>({chua:0,cho:1,xong:2}[sxS(p)]-{chua:0,cho:1,xong:2}[sxS(q)])||((p.day||99)-(q.day||99))||String(p.id).localeCompare(String(q.id)));
  const may=c=>give||c.nguoi===ME.id||c.nguoiEdit===ME.id||chanOwner(c.kenh)===ME.id;
  /* chọn một kênh thì hiện cần đăng bao nhiêu video MỖI SẢN PHẨM trong ngày (chia theo kế hoạch tuần của sản phẩm); không chọn kênh thì hiện tổng từng kênh */
  const quotaOf=ch=>{const cap=calCap(ch.k,day),mine=d.cards.filter(c=>c.kenh===ch.k&&["dang","xong"].includes(c.step)&&(c.day===day||(c.step==="xong"&&+c.ngayDang===day))),n=mine.length;if(!cap&&!n)return "";
    let prod="";if(XV.sxK&&cap){try{const P=knPlan(d,ch.k),w=weekOf(day)||1,pw=P[w-1]||{},ks=(P.ks||[]).filter(s=>(pw[s]||0)>0),sp=ks.length?wpSplit(cap,ks.map(s=>pw[s])):[];prod=ks.map((s,i)=>({s,need:sp[i]||0})).filter(x=>x.need>0||mine.some(c=>c.sku===s)).map(x=>{const got=mine.filter(c=>c.sku===x.s).length;return `<span class="lws ${got>=x.need?"ok":"lack"}">${esc(skS(x.s))} <b>${got}/${x.need}</b></span>`}).join("")}catch(e){}}
    return `<span class="lws ${n>=cap?"ok":"lack"}">${esc(ch.short)} <b>${n}/${cap}</b></span>${prod}`};
  const quota=(XV.sxK?CHANNELS.filter(c=>c.k===XV.sxK):CHANNELS).map(quotaOf).join("");
  /* tiến độ tháng của kênh đang chọn: cuối tháng đủ KPI từng sản phẩm là được, ngày nào lệch thì ngày sau bù. Không chia cứng từng ngày. */
  const dayMap=(()=>{if(!XV.sxK)return `<div class="pad"><span class="hint">Chọn một kênh ở trên để xem tiến độ tháng của kênh đó: mỗi sản phẩm cần bao nhiêu, đã đăng, đang chờ đăng, còn thiếu.</span></div>`;
    const k=XV.sxK,tdy=d.settings.today,left=Math.max(1,MONTH.ndays-tdy+1),P=ptPairs().filter(x=>x.kenh===k&&+x.sl>0),C=d.cards.filter(c=>c.kenh===k&&c.nguon!=="Order Digital"),
      rows=P.map(x=>{const cs=C.filter(c=>c.sku===x.sku),xong=cs.filter(c=>c.step==="xong").length,cho=cs.filter(c=>c.step==="dang").length,kpi=+x.sl||0,th=Math.max(0,kpi-xong-cho),con=Math.max(0,kpi-xong);return {s:x.sku,kpi,xong,cho,th,con,pd:Math.ceil(con/left*10)/10}}),
      T=rows.reduce((o,r)=>{["kpi","xong","cho","th","con"].forEach(q=>o[q]+=r[q]);return o},{kpi:0,xong:0,cho:0,th:0,con:0}),capToday=calCap(k,tdy),doneToday=C.filter(c=>c.step==="xong"&&+c.ngayDang===tdy).length;
    return `<div class="pad dmap"><div class="dmtop"><b>Tiến độ tháng · ${esc(chOf(k).short)}</b><span class="hint">cuối tháng đủ KPI từng sản phẩm là được, ngày nào lệch thì ngày sau đăng bù · hôm nay đã đăng ${doneToday}/${capToday} ô · còn ${left} ngày</span></div>
     <div class="tbl"><table class="kstab tqk"><thead><tr><th class="l">Sản phẩm</th><th>KPI tháng</th><th>Đã đăng</th><th title="Video đã duyệt, đang chờ người đăng chọn">Chờ đăng</th><th title="KPI trừ đã đăng và chờ đăng: còn phải làm thêm">Còn thiếu</th><th title="Còn phải đăng bao nhiêu video, chia cho số ngày còn lại">Cần đăng / ngày</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="l">${swatch(r.s)}${esc(sk(r.s).n)}</td><td>${r.kpi}</td><td class="grn">${r.xong}</td><td class="blu">${r.cho}</td><td class="${r.th?"t-red":"t-grn"}"><b>${r.th}</b></td><td>${r.con?r.pd:"—"}</td></tr>`).join("")||'<tr><td colspan="6" class="empty">Kênh này chưa có kế hoạch.</td></tr>'}<tr class="tqt"><td class="l"><b>Tổng</b></td><td><b>${T.kpi}</b></td><td><b>${T.xong}</b></td><td><b>${T.cho}</b></td><td class="${T.th?"t-red":"t-grn"}"><b>${T.th}</b></td><td>${T.con?Math.ceil(T.con/left*10)/10:"—"}</td></tr></tbody></table></div></div>`})();
  const skuS=[...new Set(sx.map(c=>c.sku))],statS=skuS.map(s=>{const A=sx.filter(c=>c.sku===s),kk=CHANNELS.filter(ch=>A.some(c=>c.kenh===ch.k)).map(ch=>esc(ch.short)+" "+A.filter(c=>c.kenh===ch.k).length).join(" · ");return `<span class="lws">${swatch(s)}${esc(skS(s))} · làm <b>${A.length}</b> · chờ đăng <b>${A.filter(c=>c.step!=="xong").length}</b> · đã đăng <b>${A.filter(c=>c.step==="xong").length}</b>${kk?" · "+kk:""}</span>`}).join("");
  const stP=c=>{const s=sxS(c);return s==="xong"?pill("Đã đăng","grn"):s==="cho"?pill("Chờ đăng","blu"):pill("Chưa phân bổ","amb")};
  const row=c=>{const s=sxS(c),mk=may(c),rt=vidRate(c),lb=c.linkDang||(c.tiktokId?"https://www.tiktok.com/@aillavietnamstore/video/"+c.tiktokId:"");
    return `<tr class="ktr clk" data-sxr="${esc(c.id)}"><td class="sxck">${s!=="xong"&&mk?`<input type="checkbox" data-sxck="${esc(c.id)}" ${XV.sxSel.has(c.id)?"checked":""} title="Tích rồi bấm nút Chuyển sang chờ đăng">`:""}</td><td class="mono">${esc(c.id)}</td><td>${swatch(c.sku)}${esc(skS(c.sku))}</td><td class="kstn" title="${esc(c.hookText||c.yTuong||"")}">${esc(c.hookText||c.yTuong||"")}${c.caption?" 💬":""}</td><td>${esc(userName(c.nguoiEdit||c.nguoiKB||c.nguoi)||"—")}</td><td>${(c.linkFinal||c.linkVideo)?`<a href="${esc(lk(c.linkFinal||c.linkVideo))}" target="_blank" rel="noopener" title="Mở video">▶</a>`:"—"}</td><td>${stP(c)}${s==="cho"&&mk?` <button type="button" class="lnk danger" data-sxun="${esc(c.id)}" title="Bỏ chọn, trả về chưa phân bổ">Bỏ chọn</button>`:""}</td><td>${kenhCell(c,mk)}</td><td>${mk?`<input type="date" class="bvhook sxdt" data-sxdt="${esc(c.id)}|day" value="${dv(+c.day||0)}" min="${dv(1)}" max="${dv(MONTH.ndays)}">`:ktDay(c.day)}</td><td>${mk?`<input type="date" class="bvhook sxdt" data-sxdt="${esc(c.id)}|ngayDang" value="${dv(+c.ngayDang||0)}" min="${dv(1)}" max="${dv(MONTH.ndays)}">`:ktDay(c.ngayDang)}</td><td class="sxlbc">${s==="chua"?"":(mk?`<input class="bvhook sxlk" data-sxlb="${esc(c.id)}" value="${esc(c.linkDang||"")}" placeholder="Dán link TikTok…">${s==="cho"?`<button type="button" class="btn sm pri" data-sxdone="${esc(c.id)}">Đã đăng</button>`:""}`:(c.linkDang?`<a href="${esc(lk(c.linkDang))}" target="_blank" rel="noopener">↗</a>`:"—"))}</td></tr>`};
  XV.exp={file:"video-san-xuat",sheet:"Video sản xuất",head:["Mã","Sản phẩm","Hook","Người dựng","Link video","Trạng thái","Kênh","Ngày dự kiến","Ngày thực tế","Link bài đăng","Caption","View","Đơn","GMV"],rows:L.map(c=>[c.id,sk(c.sku).n,c.hookText||c.yTuong||"",userName(c.nguoiEdit||c.nguoiKB||c.nguoi)||"",c.linkFinal||c.linkVideo||"",sxS(c)==="xong"?"Đã đăng":sxS(c)==="cho"?"Chờ đăng":"Chưa phân bổ",chOf(c.kenh).short,xlD(c.day),xlD(c.ngayDang),c.linkDang||"",c.caption||"",c.view||"",c.don||"",c.gmv||""])};
  w.innerHTML=`<section class="card flush"><div class="card-h pad"><h2>Video sản xuất trong tháng</h2><span class="hint">${base.length} video · bấm vào một dòng để nhập caption, kênh đăng, ngày, link bài · đăng xong sang Lịch đăng thực tế ở ④ Calendar</span></div>
   <div class="pad sxfil"><div class="seg">${[["","Tất cả ("+base.length+")"],["chua","Chưa phân bổ ("+nS.chua+")"],["cho","Chờ đăng ("+nS.cho+")"],["xong","Đã đăng ("+nS.xong+")"]].map(([k,l])=>`<button data-sxst="${k}" class="${XV.sxSt===k?"on":""}">${l}</button>`).join("")}</div><select data-sxk="1" aria-label="Kênh">${opt([["","Mọi kênh"]].concat(CHANNELS.map(c=>[c.k,c.short+" ("+sx.filter(v=>(!XV.khoSku||v.sku===XV.khoSku)&&v.kenh===c.k).length+")"])),XV.sxK)}</select></div>
   ${dayMap}
   <div class="pad sxday"><b>Đăng ngày</b><input type="date" class="bvhook" data-sxd="1" value="${dv(day)}" min="${dv(1)}" max="${dv(MONTH.ndays)}"><button type="button" class="btn sm" data-sxtd="1">Hôm nay</button><span class="hint">Chọn ngày khác hôm nay rồi bấm Chuyển sang chờ đăng để xếp lịch cho ngày đó</span><select data-sxsku="1" aria-label="Sản phẩm">${opt([["","Mọi sản phẩm"]].concat(skuS.map(s=>[s,sk(s).n+" ("+sx.filter(v=>v.sku===s&&(!XV.sxK||v.kenh===XV.sxK)).length+")"])),XV.khoSku)}</select></div>
   <div class="pad sxq"><span class="hint">Đã chọn / cần đăng theo kế hoạch${XV.sxK?" (từng sản phẩm)":""}:</span>${quota||'<span class="hint">Chưa có kế hoạch</span>'}<span class="sp"></span><button type="button" class="btn sm sxspread" data-sxspread="1" title="Chia đều các video đã tích từ ngày đang chọn tới hết tháng" ${XV.sxSel.size?"":"disabled"}>Chia đều các ngày${XV.sxSel.size?" ("+XV.sxSel.size+")":""}</button><button type="button" class="btn pri sm sxmove" data-sxmove="1" ${XV.sxSel.size?"":"disabled"}>Chuyển sang chờ đăng${XV.sxDay!==td?" · ngày "+dd(XV.sxDay):""}${XV.sxSel.size?" ("+XV.sxSel.size+")":""}</button></div>
   <div class="tbl"><table class="kstab pn23"><thead><tr><th><input type="checkbox" data-sxall="1" title="Tích hoặc bỏ tích tất cả video đang hiện"></th><th>Mã</th><th>Sản phẩm</th><th>Hook / nội dung</th><th>Người dựng</th><th>Video</th><th>Trạng thái</th><th>Kênh</th><th>Dự kiến</th><th>Thực tế</th><th>Link bài đăng</th></tr></thead><tbody>${L.slice(0,300).map(row).join("")||'<tr><td colspan="11" class="empty">Không có video nào.</td></tr>'}</tbody></table></div>${L.length>300?'<p class="hint pad">Chỉ hiện 300 dòng đầu, lọc theo kênh hoặc sản phẩm để xem tiếp.</p>':""}</section>`;
  w.querySelectorAll("[data-sxst]").forEach(x=>x.onclick=()=>{XV.sxSt=x.dataset.sxst;renderMain()});
  w.querySelectorAll("[data-sxk]").forEach(x=>x.onchange=()=>{XV.sxK=x.value;renderMain()});
  w.querySelectorAll("[data-sxsku]").forEach(x=>x.onchange=()=>{XV.khoSku=x.value;renderMain()});
  w.querySelectorAll("[data-sxd]").forEach(x=>x.onchange=()=>{if(x.value){XV.sxDay=+x.value.slice(8,10);renderMain()}});
  w.querySelectorAll("[data-dmd]").forEach(x=>x.onclick=()=>{XV.sxDay=+x.dataset.dmd;renderMain()});
  w.querySelectorAll("[data-sxtd]").forEach(x=>x.onclick=()=>{XV.sxDay=D().settings.today;renderMain()});
  w.querySelectorAll("[data-sxck]").forEach(x=>{x.onclick=e=>e.stopPropagation();x.onchange=()=>{const id=x.dataset.sxck;x.checked?XV.sxSel.add(id):XV.sxSel.delete(id);const sp0=w.querySelector("[data-sxspread]");if(sp0){sp0.disabled=!XV.sxSel.size;sp0.textContent="Chia đều các ngày"+(XV.sxSel.size?" ("+XV.sxSel.size+")":"")}const b=w.querySelector("[data-sxmove]");if(b){b.disabled=!XV.sxSel.size;b.textContent="Chuyển sang chờ đăng"+(XV.sxDay!==D().settings.today?" · ngày "+dd(XV.sxDay):"")+(XV.sxSel.size?" ("+XV.sxSel.size+")":"")}}});
  w.querySelectorAll("[data-sxall]").forEach(x=>x.onchange=()=>{const ids=[...w.querySelectorAll("[data-sxck]")].map(i=>i.dataset.sxck);if(x.checked)ids.forEach(i=>XV.sxSel.add(i));else ids.forEach(i=>XV.sxSel.delete(i));renderMain()});
  /* chia đều: mỗi sản phẩm được rải đều từ ngày đang chọn tới hết tháng, ngày nào cũng gần bằng nhau */
  w.querySelectorAll("[data-sxspread]").forEach(b=>b.onclick=()=>{const D0=D(),ids=[...XV.sxSel].filter(id=>{const c=D0.cards.find(y=>y.id===id);return c&&c.step!=="xong"});if(!ids.length)return;
    const st=Math.max(XV.sxDay||D0.settings.today,D0.settings.today),en=MONTH.ndays,span=en-st+1;if(span<1){toast("Hết tháng rồi, không còn ngày để chia");return}
    const bySku={};ids.forEach(id=>{const c=D0.cards.find(y=>y.id===id);(bySku[c.sku]=bySku[c.sku]||[]).push(id)});
    const plan={};Object.values(bySku).forEach(L=>L.forEach((id,i)=>{plan[id]=st+Math.floor(i*span/L.length)}));
    const per=Object.entries(bySku).map(([s,L])=>sk(s).n+" "+L.length+" video (khoảng "+(Math.round(L.length/span*10)/10)+" video/ngày)").join("; ");
    if(!confirm("Chia đều "+ids.length+" video từ ngày "+dd(st)+" tới "+dd(en)+" ("+span+" ngày):\n"+per+"\n\nVideo vào Chờ đăng và có ngày dự kiến. Chị vẫn chỉnh từng video được. Tiếp tục?"))return;
    DB.mutate(ME.name,"chia đều "+ids.length+" video từ ngày "+st,dt=>{dt.cards.forEach(c=>{if(plan[c.id]){c.choDang=true;c.day=plan[c.id]}})});XV.sxSel=new Set();toast("Đã chia đều "+ids.length+" video từ ngày "+dd(st)+" tới "+dd(en));renderMain()});
  w.querySelectorAll("[data-sxmove]").forEach(b=>b.onclick=()=>{const ids=[...XV.sxSel];if(!ids.length)return;const dy=XV.sxDay!==D().settings.today?XV.sxDay:0;DB.mutate(ME.name,"chuyển "+ids.length+" video sang chờ đăng"+(dy?" ngày "+dy:""),dt=>{dt.cards.forEach(c=>{if(ids.includes(c.id)&&c.step!=="xong"){c.choDang=true;if(dy)c.day=dy}})});XV.sxSel=new Set();toast("Đã chuyển "+ids.length+" video sang chờ đăng"+(dy?", xếp vào ngày "+dd(dy):""));renderMain()});
  w.querySelectorAll("[data-sxlb]").forEach(i=>{i.onclick=e=>e.stopPropagation();i.onchange=()=>{if(scSet(i.dataset.sxlb,"linkDang",i.value.trim())===false){renderMain();return}renderMain()}});
  w.querySelectorAll("[data-sxdone]").forEach(b=>{b.onclick=e=>{e.stopPropagation();const id=b.dataset.sxdone,inp=w.querySelector('[data-sxlb="'+id+'"]'),l=(inp?inp.value:"").trim(),c2=D().cards.find(y=>y.id===id);if(!c2)return;if(!l){toast("Dán link TikTok đã đăng trước");return}const fb=!chOf(c2.kenh).needId,m2=l.match(/[0-9]{19}/);if(!fb&&!m2){toast("Link TikTok phải có dãy 19 số sau /video/");return}if(dupAlert(l,[id]))return;const e2=moveCard(ME,id,"xong",fb?{linkDang:l,ngayDang:D().settings.today}:{linkDang:l,tiktokId:m2[0],ngayDang:D().settings.today});if(e2){toast(e2);return}toast("Đã đăng, video sang Lịch đăng thực tế ở ④ Calendar");renderMain()}});
  w.querySelectorAll("[data-sxdt]").forEach(i=>{i.onclick=e=>e.stopPropagation();i.onchange=()=>{const [id,f]=i.dataset.sxdt.split("|");scSet(id,f,i.value);renderMain()}});
  w.querySelectorAll("[data-sxun]").forEach(b=>{b.onclick=e=>{e.stopPropagation();const id=b.dataset.sxun;DB.mutate(ME.name,"bỏ chọn đăng "+id,dt=>{const c=dt.cards.find(y=>y.id===id);if(c&&c.step!=="xong"){c.day=0;c.choDang=false}});toast("Đã bỏ chọn, video về chưa phân bổ");renderMain()}});
  w.querySelectorAll("[data-kcell]").forEach(b=>b.onclick=e=>{e.stopPropagation();kenhPop(b,{cid:b.dataset.kcell})});
  w.querySelectorAll("[data-sxr]").forEach(r=>r.onclick=e=>{if(e.target.closest("a,input,button,select"))return;scModal(r.dataset.sxr)});
  bindCommon(w)
}
/* khung chi tiết video sản xuất: nhập hết ở đây (caption, kênh, ngày, link) */
function scSet(id,f,v){if((f==="linkVideo"||f==="linkDang")&&v&&dupAlert(v,f==="linkVideo"?famIds(id):[id]))return false;DB.mutate(ME.name,"sửa video "+id,dt=>{const c=dt.cards.find(y=>y.id===id);if(!c)return;const n=/^\d{4}-\d{2}-\d{2}$/.test(v)?+v.slice(8,10):0;
  if(f==="day")c.day=n;else if(f==="ngayDang")c.ngayDang=n;else if(f==="kenh")c.kenh=v;else if(f==="linkVideo"){c.linkVideo=v;if(c.linkFinal)c.linkFinal=v}else if(f==="linkDang"){c.linkDang=v;const m2=v.match(/[0-9]{19}/);if(m2)c.tiktokId=m2[0]}else c[f]=v})}
function scModal(id){
  const d=D(),c=d.cards.find(y=>y.id===id);if(!c)return;
  const give=xvGive(),mk=give||c.nguoi===ME.id||c.nguoiEdit===ME.id||chanOwner(c.kenh)===ME.id,dis=mk?"":"disabled",s=c.step==="xong"?"xong":(c.choDang||c.day)?"cho":"chua";
  const p2=n=>String(n).padStart(2,"0"),dv=n=>n?MONTH.year+"-"+p2(MONTH.mon)+"-"+p2(n):"",lk=u=>/^https?:/.test(u||"")?u:(u?"https://"+u:""),rt=vidRate(c);
  const stP=s==="xong"?pill("Đã đăng","grn"):s==="cho"?pill("Chờ đăng","blu"):pill("Chưa phân bổ","amb");
  const k2h=kenh2Html(c,dis);
  openDrawerHTML(`<h2 class="dtitle">${esc(c.id)} · ${esc(c.hookText||c.yTuong||"")}</h2><p class="hint">${swatch(c.sku)}${esc(sk(c.sku).n)} · người dựng: ${esc(userName(c.nguoiEdit||c.nguoiKB||c.nguoi)||"—")} · ${stP}${s==="xong"&&rt[0]?" · "+pill(rt[1],rt[0]):""}</p>
   <div class="frm kfrm">
    <label class="field full">Link video (Drive)<span class="sxl"><input id="sc-lv" value="${esc(c.linkFinal||c.linkVideo||"")}" placeholder="Dán link Drive…" ${dis}>${(c.linkFinal||c.linkVideo)?`<a href="${esc(lk(c.linkFinal||c.linkVideo))}" target="_blank" rel="noopener">↗</a>`:""}</span></label>
    <label class="field">Kênh đăng<select id="sc-k" ${s==="xong"?"disabled":dis}>${CHANNELS.map(x=>`<option value="${esc(x.k)}" ${c.kenh===x.k?"selected":""}>${esc(x.short)}</option>`).join("")}</select></label>
    <label class="field">Ngày đăng dự kiến<input type="date" id="sc-day" value="${dv(+c.day||0)}" min="${dv(1)}" max="${dv(MONTH.ndays)}" ${dis}></label>
    <label class="field full">Caption 1 (${esc(chOf(c.kenh).short)})<textarea id="sc-cap" rows="4" placeholder="Viết caption cho video này…" ${dis}>${esc(c.caption||"")}</textarea></label>
    <label class="field full">Cmt cần trả lời / seeding khi đăng<textarea id="sc-cmt" rows="2" placeholder="Cmt cần tag, câu cần trả lời khi đăng video…" ${dis}>${esc(c.cmt||"")}</textarea></label>
    <label class="field">Ngày đăng thực tế<input type="date" id="sc-tt" value="${dv(+c.ngayDang||0)}" min="${dv(1)}" max="${dv(MONTH.ndays)}" ${dis}></label>
    <label class="field">ID video TikTok<span class="mono">${esc(c.tiktokId||"—")}</span></label>
    <label class="field full">Link bài đăng (TikTok)<input id="sc-lb" value="${esc(c.linkDang||"")}" placeholder="Dán link TikTok sau khi đăng…" ${dis}></label>
    ${s==="xong"?`<p class="hint">View ${c.view?nf(c.view):"—"} · Đơn ${c.don?nf(c.don):"—"} · GMV ${c.gmv?money(c.gmv):"—"} (tự cập nhật khi tải báo cáo TikTok)</p>`:""}
   </div>${k2h}<div class="acts">${s!=="xong"&&mk?'<button class="btn pri" id="sc-done">Đã đăng</button>':""}${c.linkDang?`<a class="btn" href="${esc(lk(c.linkDang))}" target="_blank" rel="noopener">Mở bài trên kênh</a>`:""}<button class="btn ghost" id="sc-x">Đóng</button></div>`);
  const q=i=>document.querySelector("#drawerIn "+i),on=(i,f)=>{const e=q(i);if(e)e.onchange=()=>f(e.value)};
  on("#sc-lv",v=>{if(scSet(id,"linkVideo",v.trim())===false){scModal(id);return}renderMain()});on("#sc-k",v=>{scSet(id,"kenh",v);renderMain()});on("#sc-day",v=>{scSet(id,"day",v);renderMain()});on("#sc-cap",v=>{scSet(id,"caption",v.trim());renderMain()});on("#sc-cmt",v=>{scSet(id,"cmt",v.trim());renderMain()});
  on("#sc-tt",v=>{scSet(id,"ngayDang",v);renderMain()});on("#sc-lb",v=>{if(scSet(id,"linkDang",v.trim())===false){scModal(id);return}renderMain()});
  kenh2Bind(id,()=>scModal(id));
  const x=q("#sc-x");if(x)x.onclick=closeDrawer;
  const dn=q("#sc-done");if(dn)dn.onclick=()=>{const l=(q("#sc-lb").value||"").trim(),c2=D().cards.find(y=>y.id===id);if(!l){toast("Dán link TikTok đã đăng trước");return}if(dupAlert(l,[id]))return;const fb=!chOf(c2.kenh).needId,m2=l.match(/[0-9]{19}/);if(!fb&&!m2){toast("Link TikTok phải có dãy 19 số sau /video/");return}
    const e2=moveCard(ME,id,"xong",fb?{linkDang:l,ngayDang:D().settings.today}:{linkDang:l,tiktokId:m2[0],ngayDang:D().settings.today});if(e2){toast(e2);return}toast("Đã đăng, video sang Lịch đăng thực tế ở ④ Calendar");renderMain();scModal(id)}
}
/* Kho video tồn: MỘT bảng chung, luôn hiện đủ video (kể cả đã đăng). Mỗi dòng một hàng gọn; bấm vào dòng mở khung chi tiết bên phải: nhập caption, kênh đăng, ngày dự kiến, ngày thực tế, link bài. Dữ liệu lưu ngay trên video kho, nên viết caption được cả khi chưa chọn kênh. Chọn kênh = Chờ đăng, ghi link bài + Đã đăng = sang Lịch đăng thực tế ở Calendar. */
/* ô Kênh: bấm vào để chọn nhiều kênh cùng lúc (kênh 2 là bản đăng riêng của cùng video) */
function kenhCell(c,mk){
  const kids=D().cards.filter(x=>x.repostOf===c.id),lbl=[c.kenh].concat(kids.map(k=>k.kenh)).map(k=>chOf(k).short).join(" + ");
  if(c.repostOf)return `<span title="Bản đăng thêm của video ${esc(c.repostOf)} sang kênh thứ hai">↳ ${esc(chOf(c.kenh).short)} <small class="hint">kênh 2</small></span>`;
  return mk?`<button type="button" class="kcell" data-kcell="${esc(c.id)}" title="Bấm để chọn kênh (chọn được nhiều kênh)">${esc(lbl)} ▾</button>`:esc(lbl)
}
function kenhPop(anchor,opt){
  document.querySelectorAll(".kpop").forEach(x=>x.remove());
  const d=D(),c=opt.cid?d.cards.find(x=>x.id===opt.cid):null,kids=c?d.cards.filter(x=>x.repostOf===c.id):[],sel=c?[c.kenh].concat(kids.map(k=>k.kenh)):[],list=opt.list||CHANNELS.map(x=>x.k);
  const pop=document.createElement("div");pop.className="kpop";
  pop.innerHTML='<div class="kph"><b>Kênh đăng</b><small>chọn nhiều kênh</small><button type="button" class="lnk" data-kx="1">✕</button></div>'+list.map(k=>'<label class="kpl"><input type="checkbox" data-kp="'+esc(k)+'" '+(sel.includes(k)?"checked":"")+'> '+esc(chOf(k).short)+'</label>').join("");
  document.body.appendChild(pop);
  const r=anchor.getBoundingClientRect();pop.style.left=Math.max(8,Math.min(r.left,innerWidth-pop.offsetWidth-8))+"px";pop.style.top=Math.min(r.bottom+4,innerHeight-pop.offsetHeight-8)+"px";
  const close=()=>{pop.remove();document.removeEventListener("mousedown",off,true)},off=e=>{if(!pop.contains(e.target)&&e.target!==anchor)close()};setTimeout(()=>document.addEventListener("mousedown",off,true),0);
  pop.querySelector("[data-kx]").onclick=close;
  pop.querySelectorAll("[data-kp]").forEach(x=>x.onchange=()=>{const k=x.dataset.kp;
    if(x.checked){
      if(!c){if(opt.pick&&opt.pick(k)){close();renderMain()}else x.checked=false;return}
      const r2=repostCard(ME,c.id,k,+c.day||0,c.nguoi);if(!r2||String(r2).startsWith("Video")||String(r2).startsWith("Không")){toast(r2||"Chưa tạo được");x.checked=false;return}
      toast("Đã thêm kênh "+chOf(k).short+" cho video này");close();renderMain();return}
    if(!c){x.checked=true;return}
    const done=y=>y.step==="xong"||y.linkDang,kidK=kids.filter(y=>y.kenh===k&&!done(y));
    /* bỏ một kênh: ưu tiên bỏ bản đăng thêm của kênh đó; nếu là kênh đầu thì kênh thêm đầu tiên lên làm kênh chính; còn một kênh duy nhất thì bỏ chọn video */
    if(kidK.length){const kid=kidK[kidK.length-1];DB.mutate(ME.name,"bỏ kênh "+k+" của "+c.id,dt=>{dt.cards=dt.cards.filter(y=>y.id!==kid.id)});toast("Đã bỏ kênh "+chOf(k).short);close();renderMain();return}
    if(k===c.kenh){
      if(done(c)){toast("Kênh "+chOf(k).short+" đã đăng hoặc có link bài, không bỏ được");x.checked=true;return}
      const nk=kids.find(y=>!done(y));
      if(nk){DB.mutate(ME.name,"bỏ kênh "+k+" của "+c.id,dt=>{const m=dt.cards.find(y=>y.id===c.id);if(m)m.kenh=nk.kenh;dt.cards=dt.cards.filter(y=>y.id!==nk.id)});toast("Đã bỏ kênh "+chOf(k).short);close();renderMain();return}
      if(c.khoMa&&typeof ktBo==="function"){close();ktBo(c.khoMa);return}
      toast("Video cần ít nhất một kênh. Muốn đổi kênh thì tích kênh mới rồi bỏ kênh cũ.");x.checked=true;return}
    toast("Kênh "+chOf(k).short+" đã đăng hoặc có link bài, không bỏ được");x.checked=true})
}
/* kiểm tra trùng link: cùng file Drive hoặc cùng bài TikTok (ID 19 số) thì không cho nhập, báo video đang giữ link đó */
function linkKey(u){u=String(u||"").trim();if(!u)return null;const m=u.match(/[/]d[/]([A-Za-z0-9_-]{10,})/);if(m)return "drive:"+m[1];const t2=u.match(/[0-9]{19}/);if(t2)return "tt:"+t2[0];return "url:"+u.toLowerCase().replace(/[?#].*$/,"").replace(/[/]+$/,"")}
function dupFind(link,selfIds,selfKho){
  const key=linkKey(link);if(!key)return null;const d=D(),skip=new Set(selfIds||[]);
  for(const c of d.cards){if(skip.has(c.id))continue;
    for(const f of [c.linkVideo,c.linkFinal,c.linkDang]){if(f&&linkKey(f)===key)return {id:c.id,ten:c.hookText||c.yTuong||"",kenh:c.kenh,st:c.step==="xong"?"đã đăng":"chờ đăng / đang làm"}}
    if(key.startsWith("tt:")&&c.tiktokId&&"tt:"+c.tiktokId===key)return {id:c.id,ten:c.hookText||c.yTuong||"",kenh:c.kenh,st:"đã đăng"}}
  for(const k of d.kho||[]){if(k.ma===selfKho||(k.maDang&&skip.has(k.maDang)))continue;if(k.link&&linkKey(k.link)===key)return {id:k.ma,ten:(k.tuyen||"")+" "+(k.ten||""),kenh:"",st:"kho video tồn"}}
  return null
}
function dupAlert(link,selfIds,selfKho){const f=dupFind(link,selfIds,selfKho);if(!f)return false;const msg="LINK TRÙNG: link này đã có ở video "+f.id+(f.ten?" ("+String(f.ten).trim().slice(0,50)+")":"")+(f.kenh?" · "+chOf(f.kenh).short:"")+" · "+f.st+". Web không cho nhập trùng.";toast("Link trùng với "+f.id);alert(msg);return true}
function famIds(id){const d=D(),c=d.cards.find(x=>x.id===id);if(!c)return [id];const root=c.repostOf||c.id;return d.cards.filter(x=>x.id===root||x.repostOf===root).map(x=>x.id)}
/* nhập hàng loạt video từ Excel: cột bắt buộc Link video và Sản phẩm; tùy chọn Kênh, Hook / tên video, Caption. Link trùng thì bỏ qua và báo. */
const bkFold=s=>String(s==null?"":s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase().trim();
function bkSku(txt){const d=D(),s=bkFold(txt);if(!s)return "";
  let p=d.products.find(x=>bkFold(x.k)===s||bkFold(x.n)===s)||(d.catalog||[]).find(x=>bkFold(x.k)===s||bkFold(x.n)===s);if(p)return p.k;
  p=d.products.find(x=>bkFold(x.n).includes(s)||s.includes(bkFold(x.n)))||(d.catalog||[]).find(x=>bkFold(x.n).includes(s)||s.includes(bkFold(x.n)));if(p)return p.k;
  const A=[[/tinh dau/,"TD"],[/bot tay|tay van nang/,"BT"],[/muoi/,"XM"],[/ruoi/,"XR"],[/sap thom|\bsap\b/,"SAP"],[/tay long/,"TL"],[/lau san chuyen dung/,"LSCD"],[/lau san/,"LS"],[/nuoc giat/,"NG"],[/arila/,"AR"],[/thuong hieu/,"TH"]];
  const a=A.find(([r])=>r.test(s));return a?a[1]:""}
/* file mẫu: có kẻ bảng, tô màu và ô bấm chọn (Sản phẩm, Thuộc kho nào, Trạng thái, Kênh) */
const BK_B64="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";
function bkTemplate(){try{const bin=atob(BK_B64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);const bl=new Blob([u],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),a=document.createElement("a");a.href=URL.createObjectURL(bl);a.download="mau-nhap-video-hang-loat.xlsx";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}catch(e){toast("Chưa tạo được file mẫu: "+(e&&e.message||e))}}
function bkImport(file,kenh0){
  if(typeof XLSX==="undefined"){toast("Cần mạng để đọc file Excel");return}
  const fr=new FileReader();fr.onload=()=>{try{
    const wb=XLSX.read(fr.result,{type:"array"}),A=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:""}),
      hi=A.findIndex(r=>r.some(c=>/link/.test(bkFold(c)))&&r.some(c=>/san pham/.test(bkFold(c))));
    if(hi<0){toast("Không thấy dòng tiêu đề có cột Link video và Sản phẩm. Tải file mẫu để xem.");return}
    const H=A[hi].map(bkFold),ix=rx=>H.findIndex(h=>rx.test(h)),iL=ix(/link/),iS=ix(/san pham/),iK=ix(/^kenh/),iH=ix(/hook|ten video/),iC=ix(/caption/),iW=ix(/^thuoc kho|^kho/),iT=ix(/trang thai/);
    const d=D(),seen=new Set(),ok=[],dup=[],bad=[];
    A.slice(hi+1).forEach((r,i)=>{const lv=String(r[iL]||"").trim(),sp=String(r[iS]||"").trim(),n=hi+2+i;
      if(!lv&&!sp)return;if(/xxxxxxxx/.test(lv))return;
      if(!lv){bad.push("dòng "+n+": thiếu link");return}const sku=bkSku(sp);if(!sku){bad.push("dòng "+n+": chưa chọn / không nhận ra sản phẩm \""+sp+"\"");return}
      const key=linkKey(lv),f=dupFind(lv,[]);if(f||seen.has(key)){dup.push("dòng "+n+(f?" trùng "+f.id:" trùng trong file"));return}seen.add(key);
      const kk=iK>=0?(CHANNELS.find(c=>bkFold(c.short)===bkFold(r[iK])||bkFold(c.k)===bkFold(r[iK]))||{}).k:"",
        ton=iW>=0&&/ton/.test(bkFold(r[iW])),xong=iT>=0&&/da dang/.test(bkFold(r[iT]));
      ok.push({lv,sku,kenh:kk||kenh0,hook:iH>=0?String(r[iH]||"").trim():"",cap:iC>=0?String(r[iC]||"").trim():"",ton,xong})});
    if(!ok.length){alert("Không có video nào để thêm.\n"+(dup.length?"Trùng: "+dup.length+" video ("+dup.slice(0,6).join("; ")+")\n":"")+(bad.length?"Lỗi: "+bad.slice(0,6).join("; "):""));return}
    const nT=ok.filter(v=>v.ton).length,nX=ok.filter(v=>v.xong).length;
    const msg="Thêm "+ok.length+" video mới: "+nT+" vào Kho video tồn, "+(ok.length-nT)+" vào Video sản xuất trong tháng; "+nX+" video đã đăng, "+(ok.length-nX)+" chưa đăng\n"+(dup.length?"BỎ QUA "+dup.length+" video trùng link: "+dup.slice(0,8).join("; ")+(dup.length>8?"…":"")+"\n":"")+(bad.length?"Bỏ qua "+bad.length+" dòng lỗi: "+bad.slice(0,5).join("; ")+(bad.length>5?"…":"")+"\n":"")+"\nTiếp tục?";
    DB.mutate(ME.name,"thêm "+ok.length+" video từ Excel hàng loạt",dt=>{let seq=0;ok.forEach(v=>{
      const c=newCard(dt,{sku:v.sku,kenh:v.kenh,day:0}),hook=v.hook||"Video "+sk(v.sku).n+" nhập từ Excel",td=dt.settings.today;
      Object.assign(c,{linkVideo:v.lv,linkFinal:v.lv,caption:v.cap,hookText:hook,nguoi:ME.id,nguoiEdit:ME.id,nguoiKB:ME.id,giao:ME.id,duyet:"Đã duyệt",ceo:"PASS",nhapTay:true,tuan:1,batDau:td,dangVideo:"One shot",step:v.xong?"xong":"dang",day:v.xong?td:0,ngayDang:v.xong?td:""});
      if(v.ton){seq++;let ma;do{ma="KHO-NH-"+v.sku+"-"+String(Date.now()%100000+seq).padStart(5,"0")}while(dt.kho.some(k=>k.ma===ma));
        Object.assign(c,{mix:"ton",loai:"kho",nguon:"Footage cũ",khoMa:ma,oneShot:false});
        dt.kho.push({ma,skuText:sk(v.sku).n,sku:v.sku,nguoi:ME.name,tuyen:"",duyet:"Đã Duyệt",link:v.lv,ten:hook,kenhDeXuat:v.kenh,lyDo:"Nhập Excel hàng loạt",ghiChu:"",quyen:"Chưa kiểm",canSua:"Đăng nguyên",trangThai:v.xong?"Đã lên lịch":"Chưa dùng",maDang:v.xong?c.id:"",nguonFile:"Nhập Excel hàng loạt",caption:v.cap});
        if(!v.xong)return}
      else Object.assign(c,{mix:"oneshot",loai:"moi",oneShot:true,nguon:"Nhập Excel hàng loạt"});
      dt.cards.push(c)})});
    closeDrawer();XV.q="";XV.ks=ok.every(v=>v.ton)?"can":"sx";renderMain();
    toast("Đã thêm "+ok.length+" video"+(dup.length?", bỏ qua "+dup.length+" video trùng":""));
    alert("XONG nhập Excel\n• Đã thêm: "+ok.length+" video"+(nT?" ("+nT+" vào Kho video tồn, "+(ok.length-nT)+" vào Video sản xuất trong tháng)":" vào Video sản xuất trong tháng")+"\n• Bỏ qua vì TRÙNG LINK: "+dup.length+" video")
  }catch(e){toast("Không đọc được file: "+(e&&e.message||e))}};fr.readAsArrayBuffer(file)
}
/* thêm một video nhập tay (video chưa có trong hệ thống) */
function openThemVideo(){
  const d=D(),give=xvGive(),sel=(arr,v)=>opt(arr,v),p2=n=>String(n).padStart(2,"0"),dv=n=>MONTH.year+"-"+p2(MONTH.mon)+"-"+p2(n);
  const prods=d.products.map(p=>[p.k,p.n]),team=d.users.filter(u=>u.active!==false&&["lead","content","nhanvien","digital","truongphong"].includes(u.role)).map(u=>[u.id,u.name]);
  openDrawerHTML(`<h2 class="dtitle">Thêm video (nhập tay)</h2><p class="hint">Dùng cho video làm ngoài hệ thống mà chưa có trong danh sách. Web kiểm tra trùng link trước khi lưu.</p>
   <div class="k2box" style="border-top:0;margin-top:0"><b>Nhiều video một lúc</b><p class="hint">Video làm ngoài sẽ được đưa vào <b>Video sản xuất trong tháng</b> (link trùng web bỏ qua và báo số lượng). File Excel mẫu có sẵn ô bấm chọn: <b>Link video</b>, <b>Sản phẩm</b>, <b>Thuộc kho nào</b> (Video tồn / Video sản xuất trong tháng), <b>Trạng thái</b> (Chưa đăng / Đã đăng), thêm Hook, Caption, Kênh nếu có. Link trùng web tự bỏ qua và báo.</p><label class="field"><span>Kênh mặc định (khi file không có cột Kênh)</span><select id="tv-bk">${sel(CHANNELS.map(x=>[x.k,x.short]),CHANNELS[0].k)}</select></label><div class="acts" style="margin-top:6px"><label class="btn pri sm" for="tv-bf">⬆ Chọn file Excel</label><input type="file" id="tv-bf" accept=".xlsx,.xls,.csv" hidden><button type="button" class="btn sm" id="tv-bt">⬇ Tải file mẫu</button></div></div><b class="sxh" style="margin-top:12px">Hoặc thêm từng video</b>
   <div class="frm kfrm">
    <label class="field">Sản phẩm<select id="tv-sp">${sel(prods,prods[0]&&prods[0][0])}</select></label>
    <label class="field">Kênh đăng<select id="tv-k">${sel(CHANNELS.map(x=>[x.k,x.short]),CHANNELS[0].k)}</select></label>
    <label class="field full">Hook / tên video<input id="tv-h" placeholder="Ví dụ: Một lọ, tất cả…"></label>
    <label class="field full">Link video (Drive)<input id="tv-lv" placeholder="Dán link Drive…"></label>
    <label class="field">Người dựng<select id="tv-n">${sel([["","—"]].concat(team),ME.id)}</select></label>
    <label class="field">Ngày đăng dự kiến<input type="date" id="tv-d" min="${dv(1)}" max="${dv(MONTH.ndays)}"></label>
    <label class="field full">Caption<textarea id="tv-c" rows="3" placeholder="Viết caption cho video này…"></textarea></label>
    <label class="field full">Link bài đã đăng (chỉ điền nếu video đã đăng rồi)<input id="tv-lb" placeholder="Dán link TikTok…"></label>
   </div><div class="acts"><button class="btn pri" id="tv-ok">Lưu video</button><button class="btn ghost" id="tv-x">Hủy</button></div>`);
  const q=i=>document.querySelector("#drawerIn "+i);q("#tv-x").onclick=closeDrawer;
  const bf=q("#tv-bf");if(bf)bf.onchange=()=>{const f=bf.files[0];bf.value="";if(f)bkImport(f,q("#tv-bk").value)};const bt=q("#tv-bt");if(bt)bt.onclick=bkTemplate;
  q("#tv-ok").onclick=()=>{
    const sku=q("#tv-sp").value,kenh=q("#tv-k").value,hook=q("#tv-h").value.trim(),lv=q("#tv-lv").value.trim(),lb=q("#tv-lb").value.trim(),cap=q("#tv-c").value.trim(),nd=q("#tv-n").value,dy=q("#tv-d").value,day=dy?+dy.slice(8,10):0;
    if(!hook&&!lv){toast("Điền hook hoặc link video");return}
    if(lv&&dupAlert(lv,[]))return;
    if(lb&&dupAlert(lb,[]))return;
    const fb=!chOf(kenh).needId,m2=lb.match(/[0-9]{19}/);if(lb&&!fb&&!m2){toast("Link TikTok phải có dãy 19 số sau /video/");return}
    DB.mutate(ME.name,"thêm video nhập tay "+(hook||lv).slice(0,40),dt=>{const c=newCard(dt,{sku,kenh,day});Object.assign(c,{mix:"oneshot",loai:"moi",oneShot:true,nguon:"Nhập tay",dangVideo:"One shot",hookText:hook||"Video "+sk(sku).n+" nhập tay",linkVideo:lv,linkFinal:lv,caption:cap,nguoi:nd,nguoiEdit:nd,nguoiKB:nd,giao:nd,duyet:"Đã duyệt",ceo:"PASS",step:lb?"xong":"dang",choDang:true,linkDang:lb,tiktokId:m2?m2[0]:"",ngayDang:lb?(day||dt.settings.today):"",day:day||(lb?dt.settings.today:0),nhapTay:true,tuan:weekOf(day||dt.settings.today)||1,batDau:dt.settings.today});dt.cards.push(c)});
    toast(lb?"Đã thêm video, trạng thái Đã đăng":"Đã thêm video, trạng thái Chờ đăng");closeDrawer();XV.ks="sx";renderMain()}
}
/* xuất danh sách ra Excel */
function xlsExport(file,sheet,head,rows){if(typeof XLSX==="undefined"){toast("Cần mạng để xuất Excel");return}if(!rows.length){toast("Không có dòng nào để xuất");return}const ws=XLSX.utils.aoa_to_sheet([head].concat(rows)),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,String(sheet).slice(0,30));XLSX.writeFile(wb,file+"-T"+MONTH.mon+".xlsx")}
const xlD=n=>+n?String(+n).padStart(2,"0")+"/"+String(MONTH.mon).padStart(2,"0")+"/"+MONTH.year:"";
/* đăng cùng một video lên 2 kênh: kênh 2 là một bản đăng riêng (caption, ngày, link riêng) gắn với video gốc */
function kenh2Html(c,dis){
  const d=D(),root=c.repostOf||c.id,kids=d.cards.filter(x=>x.repostOf===root&&x.id!==c.id),p2=n=>String(n).padStart(2,"0"),dv=n=>n?MONTH.year+"-"+p2(MONTH.mon)+"-"+p2(n):"";
  if(c.repostOf)return `<p class="hint">Đây là bản đăng thêm của <b>${esc(root)}</b> ở kênh ${esc(chOf(c.kenh).short)}.</p>`;
  const used=new Set([c.kenh].concat(kids.map(k=>k.kenh))),free=CHANNELS.filter(x=>!used.has(x.k));
  const box=(k,i)=>`<div class="k2box"><b>Kênh ${i+2}: ${esc(chOf(k.kenh).short)}</b> ${k.step==="xong"?pill("Đã đăng","grn"):pill("Chờ đăng","blu")}${k.step==="xong"||dis?"":` <button type="button" class="lnk danger" data-k2del="${esc(k.id)}">Bỏ kênh này</button>`}
    <label class="field full">Caption ${i+2}<textarea data-k2c="${esc(k.id)}" rows="3" placeholder="Caption riêng cho ${esc(chOf(k.kenh).short)}…" ${dis}>${esc(k.caption||"")}</textarea></label>
    <label class="field">Ngày đăng dự kiến (${esc(chOf(k.kenh).short)})<input type="date" data-k2d="${esc(k.id)}" value="${dv(+k.day||0)}" min="${dv(1)}" max="${dv(MONTH.ndays)}" ${dis}></label>
    <label class="field">Link bài đăng (${esc(chOf(k.kenh).short)})<input data-k2l="${esc(k.id)}" value="${esc(k.linkDang||"")}" placeholder="Dán link sau khi đăng…" ${dis}></label>
    ${k.step==="xong"?"":'<button type="button" class="btn sm pri" data-k2x="'+esc(k.id)+'" '+dis+'>Đã đăng ('+esc(chOf(k.kenh).short)+')</button>'}</div>`;
  return kids.map(box).join("")+(free.length&&!dis?`<div class="k2box"><label class="field">Đăng thêm kênh<select id="k2-add"><option value="">— chọn kênh —</option>${free.map(x=>`<option value="${esc(x.k)}">${esc(x.short)}</option>`).join("")}</select></label><small class="hint">Chọn xong web tạo bản đăng cho kênh đó, có caption, ngày và link riêng. Thêm được bao nhiêu kênh cũng được.</small></div>`:"")
}
function kenh2Bind(cid,re){
  const q=i=>document.querySelector("#drawerIn "+i),qa=i=>document.querySelectorAll("#drawerIn "+i),d=D(),c=d.cards.find(x=>x.id===cid);if(!c)return;
  const set=(id,f,v)=>{DB.mutate(ME.name,"sửa kênh thêm "+id,dt=>{const y=dt.cards.find(z=>z.id===id);if(!y)return;if(f==="day")y.day=v?+v.slice(8,10):0;else if(f==="linkDang"){y.linkDang=v;const m2=v.match(/[0-9]{19}/);if(m2)y.tiktokId=m2[0]}else y[f]=v});renderMain()};
  const ad=q("#k2-add");if(ad)ad.onchange=()=>{if(!ad.value)return;const r=repostCard(ME,cid,ad.value,+c.day||0,c.nguoi);if(!r||String(r).startsWith("Video")||String(r).startsWith("Không")){toast(r||"Chưa tạo được");return}toast("Đã tạo bản đăng cho "+chOf(ad.value).short+", viết caption riêng ở dưới");renderMain();re()};
  qa("[data-k2c]").forEach(x=>x.onchange=()=>set(x.dataset.k2c,"caption",x.value.trim()));
  qa("[data-k2d]").forEach(x=>x.onchange=()=>set(x.dataset.k2d,"day",x.value));
  qa("[data-k2l]").forEach(x=>x.onchange=()=>set(x.dataset.k2l,"linkDang",x.value.trim()));
  qa("[data-k2del]").forEach(x=>x.onclick=()=>{const id=x.dataset.k2del;DB.mutate(ME.name,"bỏ kênh thêm "+id,dt=>{dt.cards=dt.cards.filter(y=>y.id!==id)});toast("Đã bỏ kênh này");renderMain();re()});
  qa("[data-k2x]").forEach(x=>x.onclick=()=>{const id=x.dataset.k2x,k=D().cards.find(y=>y.id===id),inp=q('[data-k2l="'+id+'"]'),l=(inp?inp.value:"").trim();if(!k)return;if(!l){toast("Dán link bài đăng trước");return}const fb=!chOf(k.kenh).needId,m2=l.match(/[0-9]{19}/);if(!fb&&!m2){toast("Link TikTok phải có dãy 19 số sau /video/");return}if(dupAlert(l,[id]))return;const e2=moveCard(ME,id,"xong",fb?{linkDang:l,ngayDang:D().settings.today}:{linkDang:l,tiktokId:m2[0],ngayDang:D().settings.today});if(e2){toast(e2);return}toast("Đã đăng, sang Lịch đăng thực tế ở ④ Calendar");renderMain();re()})
}
/* tên sản phẩm rút gọn 2 từ; nếu có sản phẩm khác cùng 2 từ đầu (Tẩy lồng AiBio / Tẩy lồng Ailla) thì ghi đủ tên */
function skS(s){const n=sk(s).n,w=n.split(" ").slice(0,2).join(" ");const all=prods().concat(DB.data&&D().catalog?D().catalog:[]);return all.some(x=>x.k!==s&&String(x.n).split(" ").slice(0,2).join(" ")===w)?n:w}
const ktDay=n=>n?dd(+n):"—";
function ktState(k){const c=k.maDang&&D().cards.find(y=>y.id===k.maDang);return c?(c.step==="xong"?"done":"cho"):(k.maDang?"done":"free")}
function ktMirror(dt,k,c){if(!c)return;if(k.caption&&!c.caption)c.caption=k.caption;if(k.ngayDuKien&&!c.day)c.day=+k.ngayDuKien;if(k.ngayThucTe&&!c.ngayDang)c.ngayDang=+k.ngayThucTe;if(k.linkBai&&!c.linkDang){c.linkDang=k.linkBai;const m2=String(k.linkBai).match(/[0-9]{19}/);if(m2)c.tiktokId=m2[0]}}
function ktSet(ma,f,v){
  if(f==="linkBai"&&v){const k0=(D().kho||[]).find(x=>x.ma===ma);if(dupAlert(v,k0&&k0.maDang?famIds(k0.maDang):[],ma))return false}
  DB.mutate(ME.name,"sửa video kho "+ma,dt=>{const k=dt.kho.find(x=>x.ma===ma);if(!k)return;const c=k.maDang&&dt.cards.find(y=>y.id===k.maDang),n=/^\d{4}-\d{2}-\d{2}$/.test(v)?+v.slice(8,10):0;
    if(f==="caption"){k.caption=v;if(c)c.caption=v}
    else if(f==="day"){k.ngayDuKien=n;if(c)c.day=n}
    else if(f==="ngayDang"){k.ngayThucTe=n;if(c)c.ngayDang=n}
    else if(f==="linkBai"){k.linkBai=v;if(c){c.linkDang=v;const m2=v.match(/[0-9]{19}/);if(m2)c.tiktokId=m2[0]}}})
}
/* video kho đã đăng từ trước nhưng chưa gắn kênh: tạo thẻ đã đăng ở kênh được chọn để web tính vào số của kênh */
function ktGan(ma,kenh){
  DB.mutate(ME.name,"gắn video đã đăng "+ma+" vào kênh "+kenh,dt=>{const kk=dt.kho.find(x=>x.ma===ma);if(!kk)return;const td=dt.settings.today,cc=newCard(dt,{sku:kk.sku,kenh,day:td});Object.assign(cc,{mix:"ton",loai:"kho",nguon:"Footage cũ",khoMa:ma,oneShot:false,hookText:kk.ten||kk.tuyen||"Video "+sk(kk.sku).n,linkVideo:kk.link||"",linkFinal:kk.link||"",caption:kk.caption||"",nguoi:ME.id,nguoiEdit:ME.id,nguoiKB:ME.id,giao:ME.id,duyet:"Đã duyệt",ceo:"PASS",step:"xong",ngayDang:td,nhapTay:true,tuan:weekOf(td)||1,batDau:td});dt.cards.push(cc);kk.maDang=cc.id;kk.trangThai="Đã lên lịch"});
  toast("Đã gắn "+ma+" vào "+chOf(kenh).short)
}
function ktPick(ma,kenh){
  const k0=(D().kho||[]).find(y=>y.ma===ma);if(!k0||!kenh)return false;
  if(k0.maDang&&!D().cards.find(y=>y.id===k0.maDang)){ktGan(ma,kenh);return true}
  if(!ksPick(k0.sku,kenh,ma))return false;
  DB.mutate(ME.name,"áp thông tin video kho "+ma,dt=>{const k=dt.kho.find(x=>x.ma===ma),c=k&&dt.cards.find(y=>y.id===k.maDang);ktMirror(dt,k,c)});return true
}
/* bỏ chọn một video kho đang chờ đăng: trả về Chưa phân bổ để chọn lại kênh, ngày */
function ktBo(ma){
  const k0=(D().kho||[]).find(x=>x.ma===ma),c0=k0&&k0.maDang&&D().cards.find(y=>y.id===k0.maDang);if(!c0||c0.step==="xong"||c0.linkDang){toast("Video này đã đăng, không bỏ chọn được");return}
  DB.mutate(ME.name,"bỏ chọn video tồn "+c0.id,dt=>{const cc=dt.cards.find(y=>y.id===c0.id);if(!cc)return;const kk=dt.kho.find(y=>y.ma===cc.khoMa);if(kk){kk.maDang="";kk.trangThai="Chưa dùng";kk.ngayDuKien=0}cc.khoMa="";cc.step="kb";cc.loai="";cc.nguon="Footage cũ";cc.nguoi=cc.giao||cc.nguoi;cc.day=0;cc.linkVideo=""});
  toast("Đã bỏ chọn "+ma+", chọn lại kênh và ngày được");renderMain()
}
function ktModal(ma){
  const d=D(),k=(d.kho||[]).find(x=>x.ma===ma);if(!k)return;
  const c=k.maDang&&d.cards.find(y=>y.id===k.maDang),s=ktState(k),give=xvGive(),mk=!c||give||c.giao===ME.id||c.nguoi===ME.id||chanOwner(c.kenh)===ME.id,dis=mk?"":"disabled";
  const p2=n=>String(n).padStart(2,"0"),dv=n=>n?MONTH.year+"-"+p2(MONTH.mon)+"-"+p2(n):"",lkf=u=>/^https?:/.test(u||"")?u:(u?"https://"+u:"");
  const cap=(c&&c.caption)||k.caption||"",dk=c?(+c.day||+k.ngayDuKien||0):(+k.ngayDuKien||0),tt=c?(+c.ngayDang||+k.ngayThucTe||0):(+k.ngayThucTe||0),lb=(c&&c.linkDang)||k.linkBai||"";
  const tuyen=(k.tuyen||"")+(k.ten?(k.tuyen?" · ":"")+k.ten:"")||k.skuText||"",p=d.products.find(x=>x.k===k.sku),ko=(p?pKenhs(p).map(e=>e.kenh):CHANNELS.map(x=>x.k));
  const stP=s==="free"?pill("Chưa phân bổ","gry"):s==="cho"?pill("Chờ đăng","blu"):pill("Đã đăng","grn");
  const k2h=c?kenh2Html(c,dis):"";
  openDrawerHTML(`<h2 class="dtitle">${esc(k.ma)}</h2><p class="hint">${swatch(k.sku)}${esc(sk(k.sku).n)} · ${esc(tuyen)} · ${stP}</p>
   <div class="frm kfrm">
    <label class="field">Link video (Drive)<span>${k.link?`<a href="${esc(khoLink(k))}" target="_blank" rel="noopener">▶ Mở video</a>`:"—"}</span></label>
    <label class="field">Kênh đăng<select id="kt-k" ${s==="done"?"disabled":dis}><option value="">— chưa chọn —</option>${(c?CHANNELS.map(x=>x.k):ko).map(x=>`<option value="${esc(x)}" ${c&&c.kenh===x?"selected":""}>${esc(chOf(x).short)}</option>`).join("")}</select></label>
    <label class="field full">Caption 1 / chú thích<textarea id="kt-cap" rows="4" placeholder="Viết caption cho video này (giữ lại nếu video đẩy sang tháng sau)…" ${dis}>${esc(cap)}</textarea></label>
    <label class="field">Ngày đăng dự kiến<input type="date" id="kt-day" value="${dv(dk)}" min="${dv(1)}" max="${dv(MONTH.ndays)}" ${dis}></label>
    <label class="field">Ngày đăng thực tế<input type="date" id="kt-tt" value="${dv(tt)}" min="${dv(1)}" max="${dv(MONTH.ndays)}" ${dis}></label>
    <label class="field full">Link bài đăng (TikTok)<input id="kt-lb" value="${esc(lb)}" placeholder="Dán link TikTok sau khi đăng…" ${dis}></label>
   </div>${k2h}${s==="done"&&!c&&mk?`<div class="k2box"><b>Video này đã đăng nhưng chưa gắn vào kênh nào</b><p class="hint">Chọn kênh đã đăng để web tính vào số của kênh đó.</p><div class="acts"><select id="kt-gk">${CHANNELS.map(x=>`<option value="${esc(x.k)}" ${x.k==="TikTok Via 1"?"selected":""}>${esc(x.short)}</option>`).join("")}</select><button type="button" class="btn sm pri" id="kt-gb">Gắn vào kênh</button></div></div>`:""}<div class="acts">${s==="cho"&&mk?'<button class="btn pri" id="kt-done">Đã đăng</button><button class="btn" id="kt-un">Bỏ chọn (trả về kho)</button>':""}${lb&&s!=="free"?`<a class="btn" href="${esc(lkf(lb))}" target="_blank" rel="noopener">Mở bài trên kênh</a>`:""}<button class="btn ghost" id="kt-x">Đóng</button></div>`);
  const q=i=>document.querySelector("#drawerIn "+i),on=(i,f)=>{const e=q(i);if(e)e.onchange=()=>f(e.value)};
  on("#kt-cap",v=>{ktSet(ma,"caption",v.trim());renderMain()});
  on("#kt-day",v=>{ktSet(ma,"day",v);renderMain()});
  on("#kt-tt",v=>{ktSet(ma,"ngayDang",v);renderMain()});
  on("#kt-lb",v=>{if(ktSet(ma,"linkBai",v.trim())===false){ktModal(ma);return}renderMain()});
  on("#kt-k",v=>{if(!v)return;if(!c){if(ktPick(ma,v)){toast("Đã chọn "+ma+" cho "+chOf(v).short+": Chờ đăng");renderMain();ktModal(ma)}}else{DB.mutate(ME.name,"đổi kênh đăng "+c.id,dt=>{const x=dt.cards.find(y=>y.id===c.id);if(x)x.kenh=v});renderMain();ktModal(ma)}});
  if(c)kenh2Bind(c.id,()=>ktModal(ma));
  const gb=q("#kt-gb");if(gb)gb.onclick=()=>{ktGan(ma,q("#kt-gk").value);renderMain();ktModal(ma)};
  const x=q("#kt-x");if(x)x.onclick=closeDrawer;
  const u=q("#kt-un");if(u)u.onclick=()=>{DB.mutate(ME.name,"bỏ chọn video tồn "+c.id,dt=>{const cc=dt.cards.find(y=>y.id===c.id);if(!cc)return;const kk=dt.kho.find(y=>y.ma===cc.khoMa);if(kk){kk.maDang="";kk.trangThai="Chưa dùng"}cc.khoMa="";cc.step="kb";cc.loai="";cc.nguon="Footage cũ";cc.nguoi=cc.giao||cc.nguoi;cc.day=0;cc.linkVideo=""});toast("Đã trả video về kho");closeDrawer();renderMain()};
  const dn=q("#kt-done");if(dn)dn.onclick=()=>{const l=(q("#kt-lb").value||"").trim();if(!l){toast("Dán link TikTok đã đăng trước");return}const fb=!chOf(c.kenh).needId,m2=l.match(/[0-9]{19}/);if(!fb&&!m2){toast("Link TikTok phải có dãy 19 số sau /video/");return}
    if(ktSet(ma,"linkBai",l)===false)return;const e2=moveCard(ME,c.id,"xong",fb?{linkDang:l,ngayDang:D().settings.today}:{linkDang:l,tiktokId:m2[0],ngayDang:D().settings.today});if(e2){toast(e2);return}toast("Đã đăng, video sang Lịch đăng thực tế ở ④ Calendar");renderMain();ktModal(ma)}
}
function xvKhoTon(w,o){
  const d=o.d;if(!XV.ktK)XV.ktK="";if(!["","free","cho","done"].includes(XV.khoSt))XV.khoSt="";
  const cardOf=k=>k.maDang&&d.cards.find(y=>y.id===k.maDang),kho=(d.kho||[]).filter(k=>khoOk(k)||k.maDang);
  /* thống kê gọn: mỗi sản phẩm một dòng nhỏ */
  const cnt={};kho.forEach(k=>{const c=cardOf(k);if(c){const q=k.sku+"|"+c.kenh;cnt[q]=(cnt[q]||0)+1}});
  const skuAll=[...new Set(kho.map(k=>k.sku))],stat=skuAll.map(s=>{const lay=CHANNELS.filter(c=>cnt[s+"|"+c.k]).map(c=>esc(c.short)+" "+cnt[s+"|"+c.k]).join(" · ");return `<span class="lws">${swatch(s)}${esc(skS(s))} · còn <b>${kho.filter(k=>k.sku===s&&ktState(k)==="free").length}</b>${lay?" · đã lấy: "+lay:""}</span>`}).join("");
  /* chọn một kênh: hiện các sản phẩm kênh đó cần dùng video tồn (theo kế hoạch) kèm số đã chọn, và toàn bộ video chưa phân bổ của các sản phẩm đó để bấm chọn */
  const need={};if(XV.ktK){ptPairs().filter(x=>x.kenh===XV.ktK).forEach(x=>{const nn=(+x.ton||0)||(bvPlanN(d,x.sku,XV.ktK,"ton")+bvPlanN(d,x.sku,XV.ktK,"reup"));if(nn>0)need[x.sku]=nn});kho.forEach(k=>{const c=cardOf(k);if(c&&c.kenh===XV.ktK&&!(k.sku in need))need[k.sku]=0})}
  const ALL=kho.filter(k=>(!XV.khoSku||k.sku===XV.khoSku)&&(!XV.ktK||(cardOf(k)||{}).kenh===XV.ktK||(ktState(k)==="free"&&k.sku in need))),n={free:0,cho:0,done:0};ALL.forEach(k=>n[ktState(k)]++);
  const L=ALL.filter(k=>!XV.khoSt||ktState(k)===XV.khoSt).sort((p,q)=>["free","cho","done"].indexOf(ktState(p))-["free","cho","done"].indexOf(ktState(q))),shown=L.slice(0,120);
  const stP=s=>s==="free"?pill("Chưa phân bổ","gry"):s==="cho"?pill("Chờ đăng","blu"):pill("Đã đăng","grn");
  const row=k=>{const s=ktState(k),c=cardOf(k),tuyen=(k.tuyen||"")+(k.ten?(k.tuyen?" · ":"")+k.ten:"")||k.skuText||"",cap=(c&&c.caption)||k.caption,dk=c?(+c.day||+k.ngayDuKien):+k.ngayDuKien,tt=c?(+c.ngayDang||+k.ngayThucTe):+k.ngayThucTe,lb=(c&&c.linkDang)||k.linkBai;
    return `<tr class="ktr clk" data-ktr="${esc(k.ma)}"><td class="mono">${esc(k.ma)}</td><td>${swatch(k.sku)}${esc(skS(k.sku))}</td><td class="kstn" title="${esc(tuyen)}">${esc(tuyen)}${cap?" 💬":""}</td><td>${esc(khoEditor(k)||"—")}</td><td>${k.link?`<a href="${esc(khoLink(k))}" target="_blank" rel="noopener" title="Mở video">▶</a>`:"—"}</td><td>${stP(s)}</td><td>${c?kenhCell(c,true):XV.ktK?`<button type="button" class="kcell kpick" data-kpick="${esc(k.ma)}" title="Chọn video này cho ${esc(chOf(XV.ktK).short)}">+ Chọn cho ${esc(chOf(XV.ktK).short)}</button>`:`<button type="button" class="kcell" data-kfree="${esc(k.ma)}" title="Bấm để chọn kênh đăng">— chọn kênh ▾</button>`}</td><td><input type="date" class="bvhook sxdt" data-ktdt="${esc(k.ma)}|day" value="${(+dk)?MONTH.year+"-"+String(MONTH.mon).padStart(2,"0")+"-"+String(+dk).padStart(2,"0"):""}"></td><td><input type="date" class="bvhook sxdt" data-ktdt="${esc(k.ma)}|ngayDang" value="${(+tt)?MONTH.year+"-"+String(MONTH.mon).padStart(2,"0")+"-"+String(+tt).padStart(2,"0"):""}"></td><td class="sxlbc">${s==="free"?"":`<input class="bvhook sxlk" data-ktlb="${esc(k.ma)}" value="${esc(lb||"")}" placeholder="Dán link TikTok…">${s==="cho"?`<button type="button" class="btn sm pri" data-ktdn="${esc(k.ma)}">Đã đăng</button>`:""}`}</td><td class="ktxc">${s==="cho"?`<button type="button" class="ktx" data-ktbo="${esc(k.ma)}" title="Bỏ chọn, trả về Chưa phân bổ để chọn lại">✕</button>`:""}</td></tr>`};
  XV.exp={file:"kho-video-ton",sheet:"Kho video tồn",head:["Mã","Sản phẩm","Tuyến / nội dung","Người dựng","Link video","Trạng thái","Kênh","Ngày dự kiến","Ngày thực tế","Link bài đăng","Caption"],rows:L.map(k=>{const s=ktState(k),c=cardOf(k);return [k.ma,sk(k.sku).n,(k.tuyen||"")+(k.ten?(k.tuyen?" · ":"")+k.ten:"")||k.skuText||"",khoEditor(k)||"",k.link||"",s==="free"?"Chưa phân bổ":s==="cho"?"Chờ đăng":"Đã đăng",c?chOf(c.kenh).short:"",xlD(c?(+c.day||+k.ngayDuKien):+k.ngayDuKien),xlD(c?(+c.ngayDang||+k.ngayThucTe):+k.ngayThucTe),(c&&c.linkDang)||k.linkBai||"",(c&&c.caption)||k.caption||""]})};
  w.innerHTML=`<section class="card flush"><div class="card-h pad"><h2>Kho video tồn</h2><span class="hint">${ALL.length} video · bấm vào một dòng để nhập caption, kênh đăng, ngày, link bài · đăng xong sang Lịch đăng thực tế ở ④ Calendar</span></div>
   <div class="pad lwstat" style="margin:0">${XV.ktK?(Object.keys(need).map(s=>{const got=d.cards.filter(c=>c.sku===s&&c.kenh===XV.ktK&&["dang","xong"].includes(c.step)&&!c.repostOf).length,left=kho.filter(k=>k.sku===s&&ktState(k)==="free").length,nd=need[s];return `<span class="lws" title="Kế hoạch ${esc(chOf(XV.ktK).short)} dùng ${nd} video tồn; đã có ${got} (chọn từ kho và video đăng riêng, chờ đăng hoặc đã đăng); kho còn ${left} chưa phân bổ">${swatch(s)}${esc(skS(s))}: <b>${nd}</b> · đã có <b>${got}</b>${nd>got?` · cần thêm <b class="t-red">${nd-got}</b>`:got>nd?` · đủ, thừa <b>${got-nd}</b>`:" · đủ"} · kho còn <b>${left}</b></span>`}).join("")||`<span class="hint">${esc(chOf(XV.ktK).short)} chưa có sản phẩm nào dùng video tồn trong kế hoạch</span>`):stat}</div>
   <div class="pad sxfil"><div class="seg kst">${[["","Tất cả ("+ALL.length+")"],["free","Chưa phân bổ ("+n.free+")"],["cho","Chờ đăng ("+n.cho+")"],["done","Đã đăng ("+n.done+")"]].map(([k,l])=>`<button data-ksst="${k}" class="${(XV.khoSt||"")===k?"on":""}">${l}</button>`).join("")}</div><select data-ktfk="1" aria-label="Kênh">${opt([["","Mọi kênh"]].concat(CHANNELS.map(c=>[c.k,c.short])),XV.ktK)}</select></div>
   <div class="tbl"><table class="kstab pn12"><thead><tr><th>Mã</th><th>Sản phẩm</th><th>Tuyến / nội dung</th><th>Người dựng</th><th>Video</th><th>Trạng thái</th><th>Kênh</th><th>Dự kiến</th><th>Thực tế</th><th>Link bài đăng</th><th></th></tr></thead><tbody>${shown.map(row).join("")||'<tr><td colspan="11" class="empty">Không có video nào.</td></tr>'}</tbody></table></div>${L.length>shown.length?`<p class="hint pad">Hiện ${shown.length}/${L.length} video đầu, bấm sản phẩm ở trên để lọc.</p>`:""}</section>`;
  w.querySelectorAll("[data-ksst]").forEach(x=>x.onclick=()=>{XV.khoSt=x.dataset.ksst;renderMain()});
  w.querySelectorAll("[data-ktlb]").forEach(i=>{i.onclick=e=>e.stopPropagation();i.onchange=()=>{if(ktSet(i.dataset.ktlb,"linkBai",i.value.trim())===false){renderMain();return}renderMain()}});
  w.querySelectorAll("[data-ktdn]").forEach(b=>{b.onclick=e=>{e.stopPropagation();const ma=b.dataset.ktdn,inp=w.querySelector('[data-ktlb="'+ma+'"]'),l=(inp?inp.value:"").trim(),k0=(D().kho||[]).find(y=>y.ma===ma),c2=k0&&D().cards.find(y=>y.id===k0.maDang);if(!c2)return;if(!l){toast("Dán link TikTok đã đăng trước");return}const fb=!chOf(c2.kenh).needId,m2=l.match(/[0-9]{19}/);if(!fb&&!m2){toast("Link TikTok phải có dãy 19 số sau /video/");return}if(ktSet(ma,"linkBai",l)===false)return;const e2=moveCard(ME,c2.id,"xong",fb?{linkDang:l,ngayDang:D().settings.today}:{linkDang:l,tiktokId:m2[0],ngayDang:D().settings.today});if(e2){toast(e2);return}toast("Đã đăng, video sang Lịch đăng thực tế ở ④ Calendar");renderMain()}});
  w.querySelectorAll("[data-kpick]").forEach(b=>b.onclick=e=>{e.stopPropagation();const ma=b.dataset.kpick;if(ktPick(ma,XV.ktK)){toast("Đã chọn "+ma+" cho "+chOf(XV.ktK).short);renderMain()}});
  w.querySelectorAll("[data-ktbo]").forEach(b=>b.onclick=e=>{e.stopPropagation();ktBo(b.dataset.ktbo)});
  w.querySelectorAll("[data-ktdt]").forEach(i=>{i.onclick=e=>e.stopPropagation();i.onchange=()=>{const [ma,f]=i.dataset.ktdt.split("|");ktSet(ma,f,i.value);renderMain()}});
  w.querySelectorAll("[data-ktfk]").forEach(x=>x.onchange=()=>{XV.ktK=x.value;renderMain()});
  w.querySelectorAll("[data-kcell]").forEach(b=>b.onclick=e=>{e.stopPropagation();kenhPop(b,{cid:b.dataset.kcell})});
  w.querySelectorAll("[data-kfree]").forEach(b=>b.onclick=e=>{e.stopPropagation();const ma=b.dataset.kfree,k0=(D().kho||[]).find(y=>y.ma===ma);if(!k0)return;const p=D().products.find(x=>x.k===k0.sku),L=(p?pKenhs(p).map(x=>x.kenh):CHANNELS.map(x=>x.k)).filter(x=>xvGive()||chanOwner(x)===ME.id);kenhPop(b,{list:L.length?L:CHANNELS.map(x=>x.k),pick:k=>ktPick(ma,k)})});
  w.querySelectorAll("[data-ktr]").forEach(r=>r.onclick=e=>{if(e.target.closest("a,input,button,select"))return;ktModal(r.dataset.ktr)});
  bindCommon(w)
}
/* ⑤ Calendar: nhịp đăng, video chờ xếp ngày, lịch cả tháng */
function xvCalendar(b,o){
  b.innerHTML='<div class="xexp"><button type="button" class="btn sm" data-xlich="1">⬇ Xuất lịch đăng</button><button type="button" class="btn sm" data-xdang="1">⬇ Xuất video đã đăng</button></div><div id="cl-w"></div><div id="cl-d"></div>';
  b.querySelectorAll("[data-xlich]").forEach(x=>x.onclick=()=>{const cs=o.d.cards.filter(c=>+c.day>0).sort((p,q)=>(+p.day)-(+q.day)||String(p.kenh).localeCompare(String(q.kenh)));xlsExport("lich-dang","Lịch đăng",["Ngày","Kênh","Mã","Sản phẩm","Hook","Trạng thái","Link video","Link bài đăng"],cs.map(c=>[xlD(c.day),chOf(c.kenh).short,c.id,sk(c.sku).n,c.hookText||c.yTuong||"",c.step==="xong"?"Đã đăng":"Chờ đăng",c.linkFinal||c.linkVideo||"",c.linkDang||""]))});
  b.querySelectorAll("[data-xdang]").forEach(x=>x.onclick=()=>{const cs=o.d.cards.filter(c=>c.step==="xong").sort((p,q)=>(+q.ngayDang||+q.day||0)-(+p.ngayDang||+p.day||0));xlsExport("video-da-dang","Video đã đăng",["Mã","Sản phẩm","Hook","Kênh","Ngày dự kiến","Ngày đăng thực tế","Link video","Link bài đăng","ID video","Caption","View","Đơn","GMV"],cs.map(c=>[c.id,sk(c.sku).n,c.hookText||c.yTuong||"",chOf(c.kenh).short,xlD(c.day),xlD(c.ngayDang),c.linkFinal||c.linkVideo||"",c.linkDang||"",c.tiktokId||"",c.caption||"",c.view||"",c.don||"",c.gmv||""]))});
  b.querySelector("#cl-w").innerHTML=calWeekPlan(o);
  xvDaDang(b.querySelector("#cl-d"),o)
}
/* ---------- ② Hook & kịch bản theo kênh · chỉ tiêu từng buổi quay · người duyệt ---------- */
const SQ_TOG=new Map();
let SQ_ADD=null;
let HK_K="";const HK_OPEN=new Set();
const hkOpenShoots=d=>(d.shoots||[]).filter(s=>!["Đã quay","Đã hủy"].includes(s.trangThai)).sort((a,c)=>a.day-c.day);
const hkIsHook=c=>mixOf(c)==="oneshot";
const hkSt=c=>(c.daQuay||["edit","worker","dvd","dceo","dang","xong"].includes(c.step))?"dq":c.step==="quay"?"dd":c.step==="dkb"?"cd":"cv";
const HK_LB={cv:["Chưa viết","gry"],cd:["Chờ duyệt","amb"],dd:["Đã duyệt","grn"],dq:["Đã quay","blu"]};
const hkAll=d=>d.cards.filter(c=>["oneshot","kichban"].includes(mixOf(c))&&c.nguon!=="Footage cũ"&&c.nguon!=="Đăng lại");
const hkCount=L=>{const n={cv:0,cd:0,dd:0,dq:0};L.forEach(c=>n[hkSt(c)]++);return n};
const hkSum=(L,lb)=>{const n=hkCount(L);return `<b>${lb} ${L.length}</b>: chưa viết ${n.cv} · chờ duyệt ${n.cd} · đã duyệt ${n.dd} · đã quay ${n.dq}`};
function hkSetShoot(ids,sid){DB.mutate(ME.name,"xếp hook / kịch bản vào buổi quay",dt=>{const s=(dt.shoots||[]).find(x=>x.id===sid);ids.forEach(id=>{const c=dt.cards.find(y=>y.id===id);if(!c)return;c.buoiQuay=sid||"";if(s){c.qday=s.day;if(["kb","dkb"].includes(c.step))c.han=Math.max(1,s.day-1)}})})}
function hkMine(c){return xvGive()||c.nguoi===ME.id||c.giao===ME.id}
/* Buổi quay: mục tiêu lead tự viết, link file hook & kịch bản trên Drive, trạng thái, trễ hạn */
const SQ_ST=s=>{const x=s.trangThai;if(x==="Đã quay")return "xong";if(x==="Đã hủy")return "huy";if(s.day<D().settings.today)return "tre";return x==="Đang quay"?"dang":"chua"};
const SQ_LB={chua:["Chưa làm","gry"],dang:["Đang làm","blu"],tre:["Trễ hạn","red"],xong:["Đã quay","grn"],huy:["Đã hủy","gry"]};
function sqBox(s,give,dv){
  const st=SQ_ST(s),may=give||(s.nguoi||[]).includes(ME.id),lnk=v=>/^https?:/.test(v)?v:"https://"+v,today=D().settings.today;
  const days=Array.from({length:MONTH.ndays-today+1},(_,i)=>today+i);
  const tre=st==="tre"?`<div class="sqtre"><b class="t-red">Buổi quay trễ so với lịch (${dd(s.day)})</b>${s.treLyDo?` · Lý do: ${esc(s.treLyDo)} <small>(${esc(s.treBy||"")})</small>`:may?`<div class="xrow"><input class="hkin" data-sqtre="${s.id}" placeholder="Điền lý do trễ…"><button class="btn sm pri" data-sqtres="${s.id}">Gửi lý do</button></div>`:" · chưa có lý do"}${dv?`<div class="xrow"><label>Dời sang ngày<select data-sqnew="${s.id}">${opt(days.map(x=>[x,dayLbl(x)]),today)}</select></label><button class="btn sm" data-sqmove="${s.id}">Dời lịch quay</button><button class="btn sm danger" data-sqcancel="${s.id}">Hủy buổi quay</button></div>`:""}</div>`:"";
  const act=st==="chua"&&may?`<button class="btn sm" data-sqstart="${s.id}">Bắt đầu quay</button>`:"";
  return `<div class="sqbox"><div class="sqtop"><label class="field full">Mục tiêu buổi quay (lead tự viết)<textarea rows="2" data-sqmt="${s.id}" ${dv||give?"":"disabled"} placeholder="Ví dụ: 5/10 quay 50 video tinh dầu · 6/10 quay thêm cảnh trám tinh dầu và 20 video bột tẩy">${esc(s.mucTieu||"")}</textarea>${dv||give?`<small><button type="button" class="lnk" data-qfill="${s.id}">↳ điền gợi ý "cần quay thêm" từ phân bổ tuần vào mục tiêu</button></small>`:""}</label>${sqEditHtml(s,dv||give)}</div>
   ${act}${tre}</div>`}
function sqEditHtml(s,can){
  if(!can||["Đã quay","Đã hủy"].includes(s.trangThai))return "";
  const team=xvTeam(),has=u=>(s.nguoi||[]).includes(u.id);
  return `<details class="sqedit"><summary>✎ Sửa lịch</summary><div class="frm row7"><label class="field">Ngày<select data-sqe="day">${opt(Array.from({length:MONTH.ndays},(_,i)=>[i+1,dayLbl(i+1)]),s.day)}</select></label><label class="field">Buổi<select data-sqe="buoi">${opt(["Sáng","Chiều","Cả ngày"],s.buoi||"Sáng")}</select></label><label class="field">Giờ<input data-sqe="gio" value="${esc(s.gio||"")}" placeholder="vd 8:30"></label><label class="field">Địa điểm<input data-sqe="diaDiem" value="${esc(s.diaDiem||"")}"></label><div class="field"><span>Người quay (tích nhiều người)</span><div class="chk">${team.map(u=>`<label><input type="checkbox" data-sqen="${u.id}" ${has(u)?"checked":""}> ${esc(u.name)}</label>`).join("")}</div></div><button class="btn sm pri" data-sqesave="${s.id}">Lưu</button></div></details>`
}
function sqBind(b,d){
  const mut=(id,msg,fn)=>DB.mutate(ME.name,msg,dt=>{const s=(dt.shoots||[]).find(y=>y.id===id);if(s)fn(s,dt)});
  b.querySelectorAll("[data-sqmt]").forEach(x=>x.onchange=()=>mut(x.dataset.sqmt,"mục tiêu buổi quay",s=>{s.mucTieu=x.value}));
  b.querySelectorAll("[data-sqesave]").forEach(x=>x.onclick=()=>{const id=x.dataset.sqesave,box=x.closest(".sqedit"),v=k=>box.querySelector(`[data-sqe="${k}"]`).value,ng=[...box.querySelectorAll("[data-sqen]")].filter(i=>i.checked).map(i=>i.dataset.sqen);
    if(!ng.length){toast("Chọn ít nhất một người quay");return}
    mut(id,"sửa buổi quay",(s,dt)=>{const od=s.day,on=s.nguoi||[];if(+v("day")!==od)s.lichSu=(s.lichSu||[]).concat({tu:od,lyDo:"Sửa lịch",by:ME.name});
      s.day=+v("day");s.buoi=v("buoi");s.gio=v("gio").trim();s.diaDiem=v("diaDiem").trim();s.nguoi=ng;if(s.day>=dt.settings.today)s.treLyDo="";
      dt.cards.filter(c=>c.buoiQuay===id).forEach(c=>{c.qday=s.day});
      const nw=ng.filter(u=>!on.includes(u));if(nw.length)notifyU(dt,nw,`Bạn được thêm vào buổi quay ${dd(s.day)} ${s.buoi||""}`,"");if(od!==s.day)notifyU(dt,ng,`Buổi quay dời sang ${dd(s.day)} ${s.buoi||""}`,"")});
    toast("Đã sửa buổi quay");renderMain()});
  b.querySelectorAll("[data-qfill]").forEach(x=>x.onclick=()=>{const id=x.dataset.qfill,tx=quayNeedText(D());if(!tx){toast("Đủ video cho các tuần tới, chưa cần quay thêm");return}mut(id,"gợi ý mục tiêu buổi quay",s=>{s.mucTieu=(s.mucTieu?s.mucTieu.trim()+"\n":"")+tx});toast("Đã điền gợi ý vào mục tiêu");renderMain()});
  b.querySelectorAll("[data-sqstart]").forEach(x=>x.onclick=()=>{mut(x.dataset.sqstart,"bắt đầu quay",s=>{s.trangThai="Đang quay"});renderMain()});
  b.querySelectorAll("[data-sqtres]").forEach(x=>x.onclick=()=>{const id=x.dataset.sqtres,v=(b.querySelector(`[data-sqtre="${id}"]`).value||"").trim();if(!v){toast("Điền lý do trễ trước");return}
    mut(id,"lý do trễ buổi quay",(s,dt)=>{s.treLyDo=v;s.treBy=ME.name;notifyU(dt,approvers(),`Buổi quay ${dd(s.day)} trễ: ${v} (${ME.name}). Lead Content & Media dời lịch hoặc hủy.`,"")});toast("Đã gửi lý do cho Lead Content & Media");renderMain()});
  b.querySelectorAll("[data-sqmove]").forEach(x=>x.onclick=()=>{const id=x.dataset.sqmove,nd=+b.querySelector(`[data-sqnew="${id}"]`).value;
    mut(id,"dời lịch quay",(s,dt)=>{s.lichSu=(s.lichSu||[]).concat({tu:s.day,lyDo:s.treLyDo||"",by:ME.name});s.day=nd;s.trangThai="Đã lên lịch";s.treLyDo="";dt.cards.filter(c=>c.buoiQuay===id).forEach(c=>{c.qday=nd});notifyU(dt,s.nguoi,`Buổi quay được dời sang ${dd(nd)}`,"")});toast("Đã dời lịch quay");renderMain()});
  b.querySelectorAll("[data-sqcancel]").forEach(x=>x.onclick=()=>{const id=x.dataset.sqcancel;if(!confirm("Hủy buổi quay này? Hook và kịch bản đang gắn sẽ trả về chưa xếp buổi."))return;
    mut(id,"hủy buổi quay",(s,dt)=>{s.trangThai="Đã hủy";dt.cards.filter(c=>c.buoiQuay===id&&["kb","dkb","quay"].includes(c.step)).forEach(c=>{c.buoiQuay=""});notifyU(dt,s.nguoi,`Buổi quay ${dd(s.day)} đã hủy`,"")});toast("Đã hủy buổi quay");renderMain()});
}
/* Xuất hook / kịch bản lên Google Drive (qua máy Worker ở văn phòng): chọn Excel hoặc Word, nhận link, gắn vào buổi quay */
const HK_COLS=["STT","Sản phẩm","Kênh","Tuyến","Loại","Nhân sự","Hook","Kịch bản / nội dung","Cảnh quay","Đạo cụ / bối cảnh","Trạng thái","Buổi quay","Hạn nộp"];
function hkRows(d,sku,kenh,onlyMine){
  return hkAll(d).filter(c=>c.sku===sku&&c.kenh===kenh&&hkSt(c)!=="dq"&&(c.step!=="kb"||c.hookText||c.noiDung)&&(!onlyMine||c.nguoi===ME.id||c.giao===ME.id)).sort((a,c)=>(a.han||99)-(c.han||99)||(a.qday||99)-(c.qday||99)||String(a.id).localeCompare(String(c.id)))
    .map((c,i)=>{const tu=d.tuyen.find(x=>x.ma===c.maTuyen),sh=(d.shoots||[]).find(s=>s.id===c.buoiQuay);return [i+1,sk(c.sku).n,chOf(c.kenh).short,tu?tu.tuyen:"",hkIsHook(c)?"Hook":"Kịch bản",userName(c.nguoi||c.giao)||"",c.hookText||"",c.noiDung||c.yTuong||"",c.canhQuay||"",c.daoCu||"",HK_LB[hkSt(c)][0],sh?dd(sh.day)+(sh.buoi?" "+sh.buoi:""):"",c.han?dd(c.han):""]})
}
async function hkExportDrive(sku,kenh,fmt,btn){
  const d=D(),onlyMine=!xvGive(),rows=hkRows(d,sku,kenh,onlyMine);
  if(!rows.length){toast("Chưa có hook / kịch bản nào để xuất");return}
  const idle="⬆ Xuất lên Drive";btn.disabled=true;btn.textContent="Đang gửi cho Worker…";
  const day=new Date().toISOString().slice(0,10),name=sk(sku).n+" - "+chOf(kenh).short+" - "+(onlyMine?ME.name+" - ":"")+day;
  let tid;try{tid=(await svApi("/api/hub/worker-tasks",{method:"POST",body:JSON.stringify({kind:"card_export",ref:"HK-"+Date.now(),payload:{format:fmt,title:"Hook và kịch bản · "+name,filename:name,folder:"Tháng "+MONTH.mon+" · "+sk(sku).n,columns:HK_COLS,rows,by:ME.name}})})).id}catch(e){toast("Chưa gửi được: "+((e&&e.message)||e));btn.disabled=false;btn.textContent=idle;return}
  for(let i=0;i<50;i++){
    await new Promise(r=>setTimeout(r,4000));let tk;try{tk=((await svApi("/api/hub/worker-tasks?kind=card"))||[]).find(x=>x.id===tid)}catch(e){continue}
    if(tk&&tk.status==="done"&&tk.result&&tk.result.link){DB.mutate(ME.name,"xuất hook lên Drive",dt=>{dt.hkFiles=dt.hkFiles||[];dt.hkFiles.unshift({id:tid,name:tk.result.name,link:tk.result.link,by:ME.name,at:Date.now(),sku,kenh,n:rows.length})});toast("Đã lưu lên Drive, gắn link vào buổi quay ở mục File đã xuất");renderMain();return}
    if(tk&&tk.status==="error"){toast("Không xuất được: "+(tk.detail||"lỗi"));break}
    if(btn.isConnected&&tk&&tk.detail)btn.textContent=tk.detail
  }
  if(btn.isConnected){btn.disabled=false;btn.textContent=idle}
  toast("Chưa có link sau vài phút. Kiểm tra máy Worker ở văn phòng có đang bật không.")
}
function hkFilesHtml(d){
  const FL=(d.hkFiles||[]).slice(0,8);if(!FL.length)return "";
  const up=(d.shoots||[]).filter(s=>!["Đã quay","Đã hủy"].includes(s.trangThai)).sort((a,c)=>a.day-c.day);
  return `<section class="card"><div class="card-h"><h2>File hook & kịch bản đã xuất lên Drive</h2><span class="hint">mở file trên Drive rồi in đem đi quay</span></div>${FL.map(f=>`<div class="hkfile"><a href="${esc(f.link)}" target="_blank" rel="noopener">▶ ${esc(f.name)}</a><small>${esc(f.by)} · ${f.n} dòng</small><a class="btn sm" href="${esc(f.link)}" target="_blank" rel="noopener">Mở để in</a><button class="btn sm" data-hkfc="${f.id}">Chép link</button></div>`).join("")}</section>`
}
/* Bảng hook / kịch bản: bấm kênh, thấy từng sản phẩm cần bao nhiêu, nhân sự tự viết theo số thứ tự */
const HK_AUTO=new Set();let HK_FOCUS="";
/* Viết hook / kịch bản: viết bao nhiêu thêm bấy nhiêu. Viết xong tự sang "Chờ duyệt", ưu tiên điền vào ô kế hoạch còn trống, hết ô thì tự thêm. */
function hkAddItem(sku,kenh,type,hook,script,tuyenMa){
  const h=(hook||"").trim(),sc=(script||"").trim();
  if(type==="hook"&&!h){toast("Gõ hook trước");return false}
  if(type==="kb"&&!sc&&!h){toast("Viết kịch bản trước");return false}
  const d=D(),tus=d.tuyen.filter(x=>x.sku===sku&&x.kenh===kenh);
  if(tus.length&&!tuyenMa){toast("Chọn tuyến nội dung cho video này trước");return false}
  DB.mutate(ME.name,"viết "+(type==="hook"?"hook ":"kịch bản ")+sk(sku).n,dt=>{
    const mx=type==="hook"?"oneshot":"kichban",empty=x=>x.sku===sku&&x.kenh===kenh&&mixOf(x)===mx&&x.step==="kb"&&!x.hookText&&!x.noiDung&&x.nguon!=="Footage cũ";
    let c=dt.cards.find(x=>empty(x)&&(x.nguoi===ME.id||x.giao===ME.id))||dt.cards.find(x=>empty(x)&&!x.nguoi&&!x.giao);
    if(!c){c=newCard(dt,{sku,kenh,day:0,qday:0,nguon:"Quay mới",loai:"moi",oneShot:type==="hook",mix:mx,dangVideo:type==="hook"?"One shot":undefined,phatSinh:true,step:"kb"});dt.cards.push(c)}
    c.hookText=h;if(sc)c.noiDung=sc;c.nguoi=ME.id;c.nguoiKB=ME.id;if(!c.giao)c.giao=ME.id;
    if(tuyenMa&&!c.maTuyen){c.maTuyen=tuyenMa;const tu=dt.tuyen.find(y=>y.ma===tuyenMa);if(tu)c.tuyen=tu.tuyen}
    c.step="dkb";notifyU(dt,approvers(),`${ME.name} gửi ${type==="hook"?"hook":"kịch bản"} chờ duyệt: ${sk(sku).n} (${c.id})`,c.id)});
  return true
}
function xvHookList(b,o){
  const d=o.d,dv=can(ME,"viec.duyet")||ME.role==="admin",all=hkAll(d),chs=CHANNELS.filter(ch=>all.some(c=>c.kenh===ch.k));
  if(!HK_K||!chs.some(c=>c.k===HK_K))HK_K=(chs[0]||{}).k||"";
  const tabs=chs.length?`<div class="seg ptk">${chs.map(ch=>`<button data-hkk="${esc(ch.k)}" class="${ch.k===HK_K?"on":""}">${esc(ch.short)} <span class="xbadge">${all.filter(c=>c.kenh===ch.k&&["cv","cd"].includes(hkSt(c))).length}</span></button>`).join("")}</div>`:"";
  const K=all.filter(c=>c.kenh===HK_K),bySku=xvGroupBy(K,c=>c.sku);
  if(!HK_AUTO.has(HK_K)&&bySku[0]){HK_AUTO.add(HK_K);HK_OPEN.add(bySku[0][0]+"|"+HK_K)} // mở sẵn sản phẩm đầu tiên một lần, sau đó bấm để gập / mở tùy ý
  const blk=([sku,G])=>{const key=sku+"|"+HK_K,op=HK_OPEN.has(key),H=G.filter(hkIsHook),S=G.filter(c=>!hkIsHook(c)),tus=d.tuyen.filter(x=>x.sku===sku&&x.kenh===HK_K);
    const written=G.filter(c=>hkSt(c)!=="dq"&&(c.step!=="kb"||c.hookText||c.noiDung)).sort((a,c)=>(a.han||99)-(c.han||99)||(a.qday||99)-(c.qday||99)||String(a.id).localeCompare(String(c.id)));
    const rows=written.map((c,i)=>{
      const st=hkSt(c),sh=(d.shoots||[]).find(s=>s.id===c.buoiQuay),mine=hkMine(c),isH=hkIsHook(c),tu=d.tuyen.find(x=>x.ma===c.maTuyen),gy=(c.gopy||[]).slice(-1)[0];
      const cell=mine&&["kb","dkb"].includes(c.step)?`<input class="hkin" data-hkv="${c.id}" value="${esc(c.hookText||"")}" placeholder="${isH?"Hook…":"Hook mở đầu…"}">${isH?"":`<button class="btn sm" data-card="${c.id}">${c.noiDung?"Sửa kịch bản":"Viết kịch bản"}</button>`}`:`${esc(c.hookText||"")}${c.noiDung?` <small class="t-grn">đã có kịch bản</small>`:""}`;
      const gyHtml=c.step==="kb"&&gy?`<div class="gopyln">💬 <b>${esc(gy.who)}</b> góp ý: ${esc(gy.note)}${gy.t?` <small>(${esc(gy.t)})</small>`:""}</div>`:"";
      const pl=c.step==="kb"?pill("Cần sửa","red"):pill(HK_LB[st][0],HK_LB[st][1]);
      const act=c.step==="kb"&&mine?`<button class="btn sm pri" data-hkrs="${c.id}">Gửi duyệt lại</button>`:c.step==="dkb"&&dv?`<button class="btn sm pri" data-hkdy="${c.id}">Duyệt</button><button class="btn sm" data-hktl="${c.id}">Trả lại</button>`:"";
      return `<tr><td class="n">${i+1}</td><td>${isH?"Hook":"Kịch bản"}${tu?`<small>${esc(tu.tuyen)}</small>`:""}</td><td>${esc(userName(c.nguoi||c.giao)||"chưa giao")}</td><td class="wide">${cell}${gyHtml}</td><td>${pl}</td><td>${mine||dv?`<select data-hksq="${c.id}">${opt([["","—"]].concat(hkOpenShoots(d).map(s2=>[s2.id,dd(s2.day)+(s2.buoi?" "+s2.buoi:"")])),c.buoiQuay||"")}</select>`:(sh?dd(sh.day)+(sh.buoi?" "+esc(sh.buoi):""):"—")}</td><td>${c.han?dd(c.han):"—"}</td><td class="nowrap">${act}</td></tr>`}).join("");
    const add=`<div class="hkaddbar"><select data-hkat>${opt([["","— tuyến nội dung"]].concat(tus.map(t=>[t.ma,t.tuyen])),"")}</select><input class="hkin" data-hkah="${esc(key)}" placeholder="Viết hook rồi nhấn Enter (viết bao nhiêu thêm bấy nhiêu)…"><button class="btn sm pri" data-hkaddh="${esc(key)}">+ Thêm hook</button></div>
     <div class="hkaddbar"><textarea class="hkin" data-hkas="${esc(key)}" rows="2" placeholder="Viết kịch bản (Review, voice off)…"></textarea><button class="btn sm pri" data-hkaddk="${esc(key)}">+ Thêm kịch bản</button></div>`;
    return `<div class="wpb${op?" open":""}"><div class="wph" data-hko="${esc(key)}"><i class="ptar">${op?"▾":"▸"}</i>${swatch(sku)}<b>${esc(sk(sku).n)}</b><span class="hkc">${hkSum(H,"Hook")}</span><span class="hkc">${hkSum(S,"Kịch bản")}</span></div>
     ${op?`<div class="hkexp"><div class="hkg2"><b>Xuất để in</b><select data-hkfmt><option value="xlsx">Excel (.xlsx)</option><option value="doc">Word (.doc)</option></select><button class="btn sm pri" data-hkexp="${esc(key)}">⬆ Xuất lên Drive</button></div><div class="hkg2"><b>Xếp vào buổi quay</b><select data-hkbs>${opt([["","Chọn buổi quay…"]].concat(hkOpenShoots(d).map(s2=>[s2.id,dd(s2.day)+(s2.buoi?" "+s2.buoi:"")])),"")}</select><button class="btn sm" data-hkbulk="${esc(key)}">Xếp các dòng đã duyệt</button></div></div>
     ${add}<div class="tbl"><table class="wktab"><thead><tr><th>#</th><th>Loại</th><th>Nhân sự</th><th>Nội dung</th><th>Trạng thái</th><th>Buổi quay</th><th>Hạn nộp</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="8" class="empty">Chưa có hook / kịch bản nào được viết. Viết ở ô phía trên, viết xong tự gửi duyệt.</td></tr>`}</tbody></table></div>`:""}</div>`};
  b.innerHTML=`<section class="card"><div class="card-h"><h2>Hook & kịch bản theo kênh</h2><span class="hint">bấm kênh, bấm sản phẩm để gập / mở · viết bao nhiêu thêm bấy nhiêu, viết xong tự chuyển Chờ duyệt · người duyệt xong thì sẵn sàng quay</span></div>${tabs}${bySku.map(blk).join("")||`<p class="empty">Chưa có sản phẩm nào có hook / kịch bản. Giao ở ① Kế hoạch › One shot, Review.</p>`}</section>${hkFilesHtml(d)}`;
  if(HK_FOCUS){const i=b.querySelector(`[data-hkah="${HK_FOCUS}"]`);if(i)i.focus();HK_FOCUS=""}
  b.querySelectorAll("[data-hkk]").forEach(x=>x.onclick=()=>{HK_K=x.dataset.hkk;renderMain()});
  b.querySelectorAll("[data-hko]").forEach(h=>h.onclick=e=>{if(e.target.closest("input,button,select"))return;const k=h.dataset.hko;HK_OPEN.has(k)?HK_OPEN.delete(k):HK_OPEN.add(k);renderMain()});
  const addH=key=>{const [sku,kenh]=key.split("|"),w=b.querySelector(`[data-hkah="${key}"]`).closest(".wpb"),ok=hkAddItem(sku,kenh,"hook",w.querySelector(`[data-hkah="${key}"]`).value,"",w.querySelector("[data-hkat]").value);if(ok){HK_FOCUS=key;toast("Đã thêm hook, chờ duyệt");renderMain()}};
  b.querySelectorAll("[data-hkaddh]").forEach(x=>x.onclick=()=>addH(x.dataset.hkaddh));
  b.querySelectorAll("[data-hkah]").forEach(i=>i.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();addH(i.dataset.hkah)}});
  b.querySelectorAll("[data-hkaddk]").forEach(x=>x.onclick=()=>{const key=x.dataset.hkaddk,[sku,kenh]=key.split("|"),w=x.closest(".wpb"),ok=hkAddItem(sku,kenh,"kb","",w.querySelector(`[data-hkas="${key}"]`).value,w.querySelector("[data-hkat]").value);if(ok){toast("Đã thêm kịch bản, chờ duyệt");renderMain()}});
  b.querySelectorAll("[data-hkv]").forEach(i=>i.onchange=()=>{const id=i.dataset.hkv,v=i.value.trim();if(!v)return;DB.mutate(ME.name,"sửa hook "+id,dt=>{const c=dt.cards.find(y=>y.id===id);if(c)c.hookText=v});toast("Đã lưu, bấm Gửi duyệt lại khi sửa xong")});
  b.querySelectorAll("[data-hkrs]").forEach(x=>x.onclick=()=>{const id=x.dataset.hkrs,i=b.querySelector(`[data-hkv="${id}"]`),v=i?i.value.trim():"";DB.mutate(ME.name,"gửi duyệt lại hook "+id,dt=>{const c=dt.cards.find(y=>y.id===id);if(!c)return;if(v)c.hookText=v;c.step="dkb";notifyU(dt,approvers(),`${ME.name} gửi lại hook chờ duyệt: ${sk(c.sku).n} (${c.id})`,c.id)});toast("Đã gửi duyệt lại");renderMain()});
  b.querySelectorAll("[data-hksq]").forEach(x=>x.onchange=()=>{hkSetShoot([x.dataset.hksq],x.value);toast(x.value?"Đã xếp vào buổi quay":"Đã bỏ khỏi buổi quay");renderMain()});
  b.querySelectorAll("[data-hkbulk]").forEach(x=>x.onclick=()=>{const [sku,kenh]=x.dataset.hkbulk.split("|"),sid=x.closest(".hkexp").querySelector("[data-hkbs]").value;if(!sid){toast("Chọn buổi quay trước");return}
    const ids=hkAll(D()).filter(c=>c.sku===sku&&c.kenh===kenh&&hkSt(c)==="dd"&&!c.buoiQuay&&hkMine(c)).map(c=>c.id);if(!ids.length){toast("Không có dòng đã duyệt nào chưa xếp buổi quay");return}
    hkSetShoot(ids,sid);toast("Đã xếp "+ids.length+" dòng vào buổi quay");renderMain()});
  b.querySelectorAll("[data-hkexp]").forEach(x=>x.onclick=()=>{const [sku,kenh]=x.dataset.hkexp.split("|"),f=x.closest(".hkexp").querySelector("[data-hkfmt]").value;hkExportDrive(sku,kenh,f,x)});
  b.querySelectorAll("[data-hkfc]").forEach(x=>x.onclick=()=>{const f=(D().hkFiles||[]).find(y=>y.id===x.dataset.hkfc);if(!f)return;try{navigator.clipboard.writeText(f.link);toast("Đã chép link")}catch(e){toast(f.link)}});
  b.querySelectorAll("[data-hkdy]").forEach(x=>x.onclick=()=>{const e=moveCard(ME,x.dataset.hkdy,"quay");toast(e||"Đã duyệt");renderMain()});
  b.querySelectorAll("[data-hktl]").forEach(x=>x.onclick=()=>{const n=prompt("Cần sửa gì? (ghi ngắn cho nhân sự)");if(n===null)return;sendBack(ME,x.dataset.hktl,n.trim()||"cần sửa");toast("Đã trả lại nhân sự");renderMain()});
}
/* ---------- ② Hook & kịch bản, quay, edit ---------- */
function xvHook(b,o){
  b.innerHTML='<div id="xh-l"></div><section class="card lichquay" id="xh-q"></section><div id="xh-k"></div>';
  xvHookList(b.querySelector("#xh-l"),o);
  xvQuay2(b.querySelector("#xh-q"),o);
  if(o.kbPool.length){const k=b.querySelector("#xh-k");k.innerHTML='<details class="card"><summary><b>Video quay mới chưa có người viết ('+o.kbPool.length+')</b></summary><div id="xh-kb"></div></details>';xvKB(k.querySelector("#xh-kb"),o)}
}
/* ---------- Trang Xếp việc tuần (thay bản cũ) ---------- */
function pXepViec2(m){
  const d=D(),W=xvWeek(),days=xvDays(W),WC=d.cards.filter(c=>xvIn(c,W)),team=xvTeam(),give=xvGive(),free=xvKhoFree();
  const slots=WC.filter(isPH);
  const kbPool=d.cards.filter(c=>["moi","worker"].includes(loaiOf(c))&&!isPH(c)&&(c.step==="cg"||(c.step==="kb"&&!c.nguoi)));
  const ePool=d.cards.filter(c=>c.step==="edit"&&!c.nguoiEdit&&!c.wt);
  const hkWait=d.cards.filter(c=>c.buoiQuay&&c.step==="dkb").length,un=d.cards.filter(c=>!c.day&&c.step==="dang").length;
  if(["kb","win","edit","quay","wk"].includes(XV.tab))XV.tab="pc";if(XV.tab==="dang"){XV.tab="kho";XV.ks="wait"}if(XV.tab==="kho"&&XV.ks==="cal")XV.tab="cal";
  const nHook=hkAll(d).filter(c=>["cv","cd"].includes(hkSt(c))).length;
  const nOrder=d.cards.filter(c=>(loaiOf(c)==="worker"&&["kb","dkb"].includes(c.step))||(c.mix==="outsource"&&c.step==="worker")||(c.mix==="reup"&&c.step==="kb")).length;
  const nPC=d.cards.filter(c=>["cg","kb"].includes(c.step)&&!c.nguoiKB).length,tabs=[["tuan","① Kế hoạch",0],["pc","② Điều phối",nPC+hkWait+nOrder],["kho","③ Kho video",slots.length+d.cards.filter(c=>["edit","dvd","dceo"].includes(c.step)&&!c.wt).length],["cal","④ Calendar",un]];
  if(!tabs.some(t=>t[0]===XV.tab))XV.tab="tuan";
  m.innerHTML=H("Xếp việc tuần",`${xvLbl(W)} · làm lần lượt từ ① đến ④, bước nào có số là còn việc`)+`<div class="lwtool"><div class="seg xvtabs">${tabs.map(([k,t,n])=>`<button data-xvt="${k}" class="${XV.tab===k?"on":""}">${t}${n?` <span class="xbadge">${n}</span>`:""}</button>`).join("")}</div></div><div id="xvb"></div>`;
  m.querySelectorAll("[data-xvt]").forEach(b=>b.onclick=()=>{XV.tab=b.dataset.xvt;XV.sel.clear();renderMain()});
  const b=$("#xvb"),o={d,W,days,WC,team,give,slots,free,kbPool,qPool:[],ePool,post:WC.filter(c=>c.step==="dang")};
  ({tuan:xvTuan,kho:xvKhoAll,cal:xvCalendar,quay:xvHook,wk:xvWorker2,pc:(bb,oo)=>{pBangVideo(bb);if(oo.d.cards.some(c=>c.wt&&!c.wDone)){const w=document.createElement("div");w.id="xh-w";bb.appendChild(w);xvWorker2(w,Object.assign({},oo,{onlyWt:true}))}const q=document.createElement("section");q.className="card lichquay";q.id="xh-q";bb.appendChild(q);xvQuay2(q,oo)}})[XV.tab](b,o);
  wpWorkList(b,XV.tab);
  /* nối với ① Kế hoạch tuần: dải "cần làm" + chọn sẵn sản phẩm đang làm */
  const ST=null;
  if(ST){const ks=XV.tab==="kho"&&b.querySelector("#khosum");if(ks)ks.insertAdjacentHTML("afterend",wpStrip(d,W,days,ST));else b.insertAdjacentHTML("afterbegin",wpStrip(d,W,days,ST));
    b.querySelectorAll("[data-wpq]").forEach(x=>x.onclick=()=>{const v=x.dataset.wpq;if(!v){XV.sku="";XV.kenh="";XV.mix=""}else{const [s2,k2,t2]=v.split("|");XV.sku=s2;XV.kenh=k2;XV.mix=t2;if(XV.tab==="kho"){const kk=s2+"|"+k2;KS_OPEN.has(kk)?KS_OPEN.delete(kk):KS_OPEN.add(kk)}}renderMain()});
    if(XV.sku){const tu=d.tuyen.find(t=>t.sku===XV.sku&&(!XV.kenh||t.kenh===XV.kenh));
      if(XV.tab==="quay"){b.querySelectorAll(".hkadd .ht").forEach(s2=>{if(tu)s2.value=tu.ma});b.querySelectorAll(".hkadd .hl").forEach(s2=>s2.value=XV.mix==="kichban"?"0":"1")}
      if(XV.tab==="wk"&&tu&&$("#wk-t"))$("#wk-t").value=tu.ma;
      if(XV.tab==="kho"){const v=$("#xa-v");if(v){const o2=[...v.options].find(op=>(xvKhoFree().find(q=>q.ma===op.value)||{}).sku===XV.sku);if(o2)v.value=o2.value}if($("#xa-k")&&XV.kenh)$("#xa-k").value=XV.kenh;if($("#xa-m"))$("#xa-m").value=XV.mix==="reup"?"hook":"nguyen"}
      if(!tu&&["quay","wk"].includes(XV.tab))b.insertAdjacentHTML("afterbegin",`<div class="note">${esc(sk(XV.sku).n)} ở ${esc(chOf(XV.kenh||"").short)} chưa có tuyến nào. Lập tuyến ở Kế hoạch tháng › bước 5 trước.</div>`)}}
  b.querySelectorAll("[data-xsel]").forEach(x=>{x.onclick=e=>e.stopPropagation();x.onchange=()=>{x.checked?XV.sel.add(x.dataset.xsel):XV.sel.delete(x.dataset.xsel);renderMain()}});
  bindCommon(b);
}
PAGES.xepviec=pXepViec2;
if(XV.tab==="kho")XV.tab="tuan";

/* ---------- Đẩy gấp sản phẩm đang lên xu hướng ----------
   1) Xếp lại lịch đăng kênh từ hôm nay: video sản phẩm đó lên trước
   2) Báo người giữ kênh (giao việc "điều chỉnh lịch")
   3) Thiếu video thì cộng thêm vào kế hoạch tuần (làm trước) + giao việc quay gấp */
function openHot(sku0,kenh0){
  const d=D(),pairs=ptPairs(),today=d.settings.today;
  $("#drawerIn").innerHTML=`<div class="dh"><h2>🔥 Đẩy sản phẩm đang lên xu hướng</h2><button class="btn sm" id="dx">Đóng</button></div>
   <form class="frm" id="hotf"><label class="field">Sản phẩm · kênh<select id="hot-p">${opt(pairs.map(x=>[x.sku+"|"+x.kenh,sk(x.sku).n+" · "+chOf(x.kenh).short]),(sku0&&kenh0)?sku0+"|"+kenh0:"")}</select></label>
   <label class="field">Đăng mỗi ngày bao nhiêu video sản phẩm này<input id="hot-n" type="number" min="1" value="3"></label>
   <label class="field">Trong bao nhiêu ngày tới<input id="hot-d" type="number" min="1" value="5"></label></form><div id="hot-info"></div>
   <div class="acts"><button class="btn pri" id="hot-go">Giao việc đẩy sản phẩm</button></div>`;
  $("#drawer").hidden=false;$("#dx").onclick=closeDrawer;
  const info=()=>{const [sku,kenh]=$("#hot-p").value.split("|"),need=(+$("#hot-n").value||0)*(+$("#hot-d").value||0),ready=d.cards.filter(c=>c.sku===sku&&c.kenh===kenh&&["edit","worker","dvd","dceo","dang"].includes(c.step)&&(!c.day||c.day>=today)).length,kho=xvKhoFree().filter(k=>k.sku===sku).length,thieu=Math.max(0,need-ready-kho);
    $("#hot-info").innerHTML=`<dl class="kv"><dt>Cần đăng</dt><dd><b>${need}</b> video trong ${$("#hot-d").value} ngày tới</dd><dt>Đã có sẵn</dt><dd><b>${ready}</b> video đang edit / chờ duyệt / chờ đăng</dd><dt>Video tồn</dt><dd><b>${kho}</b> video trong kho (xếp ở Kế hoạch tháng › 5. Kế hoạch triển khai › ② Video tồn)</dd><dt>Còn thiếu</dt><dd>${thieu?`<b class="t-red">${thieu}</b> video → cộng vào kế hoạch tuần (làm trước) và giao việc quay gấp`:`<b class="t-grn">đủ</b>`}</dd></dl>
     <p class="hint">Bấm "Đẩy lên ngay": người giữ kênh ${esc(chOf(kenh).short)} (${esc(userName(chanOwner(kenh))||"chưa đặt")}) nhận việc tự xếp lại lịch đăng, đưa sản phẩm này lên trước${thieu?"; Lead Content & Media nhận việc lên hook quay gấp":""}.</p>`;return {sku,kenh,need,ready,kho,thieu}};
  ["#hot-p","#hot-n","#hot-d"].forEach(s=>$(s).oninput=$(s).onchange=info);info();
  $("#hot-go").onclick=()=>{const r=info(),per=+$("#hot-n").value||1,nd=+$("#hot-d").value||1,w=weekOf(today)||1,lead=(d.users.find(u=>u.role==="lead"&&u.active)||{}).id||ME.id,own=chanOwner(r.kenh);
    DB.mutate(ME.name,`đẩy gấp ${sk(r.sku).n} ở ${r.kenh}`,dt=>{
      dt.weekPlan=dt.weekPlan||{};dt.weekPlan[w]=dt.weekPlan[w]||{};const e=dt.weekPlan[w][wpKey(r.sku,r.kenh)]=dt.weekPlan[w][wpKey(r.sku,r.kenh)]||{};e.uu="p1";e.sl=Math.max(+e.sl||0,per*7);if(r.thieu)e.sl=(+e.sl||0)+0;
      dt.hot=(dt.hot||[]).filter(h=>!(h.sku===r.sku&&h.kenh===r.kenh)).concat({sku:r.sku,kenh:r.kenh,tu:today,den:Math.min(MONTH.ndays,today+nd-1),sl:per,at:new Date().toLocaleString("vi-VN"),by:ME.name});
      const t=(ten,nguoi,mo)=>dt.tasks.push({id:uid("tk"),ten,loai:"Điều chỉnh do xu hướng",nguoi,han:Math.min(MONTH.ndays,today+1),moTa:mo,team:"content",da:"",phoi:[],uu:"Cao",st:"todo",checklist:[],tao:ME.id,kq:""});
      if(own)t(`Điều chỉnh lịch ${chOf(r.kenh).short}: đẩy ${sk(r.sku).n} lên`,own,`${sk(r.sku).n} đang lên xu hướng. Tự xếp lại lịch đăng ${r.kenh} từ ${dd(today)}: mỗi ngày ${per} video ${sk(r.sku).n} trong ${nd} ngày, đưa video sản phẩm này lên trước (dùng cả video tồn nếu có). Xếp ở Kế hoạch tháng › 5. Kế hoạch triển khai › ⑤ Lịch đăng hoặc Calendar.`);
      if(r.thieu)t(`Quay gấp ${r.thieu} video ${sk(r.sku).n}`,lead,`Thiếu ${r.thieu} video ${sk(r.sku).n} cho ${r.kenh} để đẩy xu hướng. Lên danh sách hook ở Kế hoạch tháng › 5. Kế hoạch triển khai › ③ Buổi quay & hook (đã cộng vào kế hoạch tuần, ưu tiên làm trước).`)});
    closeDrawer();toast(`Đã giao việc điều chỉnh lịch cho người giữ kênh${r.thieu?`, giao việc quay gấp ${r.thieu} video`:""}`);renderMain()};
}
/* Hệ số ưu tiên cho sản phẩm đang đẩy gấp trong khoảng ngày */
const _perWeek0=perWeek;
perWeek=function(d,sku,kenh,day){const h=(d.hot||[]).find(x=>x.sku===sku&&x.kenh===kenh&&(day||d.settings.today)<=x.den);return h?Math.max(_perWeek0(d,sku,kenh,day),h.sl*7):_perWeek0(d,sku,kenh,day)};

/* ---------- Video không quay: cảnh cũ trong kho cảnh + Worker dựng, tạo voice ----------
   cách A: Worker tự viết kịch bản + voice → người duyệt video → CEO duyệt → đăng
   cách B: nhân sự viết kịch bản → người duyệt kịch bản → Worker dựng + voice → duyệt video → đăng */
LOAI_V.worker="Không quay · Worker dựng";
const _nextActTuan=nextAct;
nextAct=function(c){if(loaiOf(c)==="worker"){if(c.step==="kb")return ["Gửi duyệt kịch bản","dkb"];if(c.step==="dkb")return ["Duyệt kịch bản, gửi Worker dựng","worker"]}return _nextActTuan(c)};
function xvWorker(b,o){
  const {d,W,team,give}=o,today=d.settings.today,L=d.cards.filter(c=>loaiOf(c)==="worker"&&xvIn(c,W));
  const tOpts=xvGroupBy(d.tuyen.slice(),t=>sk(t.sku).n+" · "+chOf(t.kenh).short).map(([n,T])=>`<optgroup label="${esc(n)}">${T.map(t=>`<option value="${esc(t.ma)}">${esc(t.tuyen)}${t.vaiTro?" · "+esc(t.vaiTro):""}</option>`).join("")}</optgroup>`).join("");
  const G=[["Nhân sự đang viết kịch bản",c=>c.step==="kb"],["Chờ duyệt kịch bản",c=>c.step==="dkb"],["Worker đang dựng",c=>c.step==="worker"],["Chờ duyệt video",c=>["dvd","dceo"].includes(c.step)],["Chờ đăng / đã đăng",c=>["dang","xong"].includes(c.step)]];
  b.innerHTML=`<section class="card"><div class="card-h"><h2>Video không quay</h2><span class="hint">dùng cảnh cũ trong kho cảnh, Worker dựng và tạo voice · không cần buổi quay</span></div>
   ${give?`<form class="frm row7" id="wk-add"><label class="field">Tuyến (sản phẩm · kênh)<select id="wk-t">${tOpts}</select></label><label class="field">Số video<input id="wk-n" type="number" min="1" value="3"></label>
    <label class="field">Cách làm<select id="wk-m">${opt([["A","Worker viết kịch bản + voice"],["B","Nhân sự viết kịch bản, Worker dựng + voice"]],"A")}</select></label>
    <label class="field">Người phụ trách triển khai<select id="wk-p">${opt([["","—"]].concat(team.map(u=>[u.id,u.name])),"")}</select></label>
    <label class="field">Ghi chú cho Worker (cảnh dùng, giọng…)<input id="wk-g" placeholder="vd: cảnh ngâm áo kho tháng 9, giọng nữ miền Bắc"></label><button class="btn pri">+ Tạo video</button></form>`:""}
   <p class="hint">Mỗi video đều giao cho một người phụ trách triển khai. Cách A: người phụ trách chọn cảnh trong kho cảnh, cho Worker viết kịch bản + voice và dựng, kiểm tra rồi gửi duyệt video, sau đó CEO duyệt. Cách B: người phụ trách viết kịch bản, người duyệt kịch bản, Worker dựng + tạo voice, người phụ trách kiểm tra rồi gửi duyệt video.</p></section>
  <section class="card"><div class="card-h"><h2>Trong kỳ</h2><span class="hint">${L.length} video</span></div>${G.map(([t,f])=>{const I=L.filter(f);return I.length?`<div class="xgrp">${t} · ${I.length}</div><div class="xlist">${I.map(c=>xvMini(c,`<span class="xms">${esc(sk(c.sku).n.split(" ")[0])} · ${c.wkMode==="B"?"NS viết":"Worker viết"} · ${esc(userName(c.nguoi)||"chưa giao")}</span>`)).join("")}</div>`:""}).join("")||`<p class="empty">Chưa có video nào.</p>`}</section>`;
  if($("#wk-add"))$("#wk-add").onsubmit=e=>{e.preventDefault();const t=d.tuyen.find(y=>y.ma===$("#wk-t").value),n=Math.max(1,+$("#wk-n").value||1),mo=$("#wk-m").value,p=$("#wk-p").value,g=$("#wk-g").value;
    if(!t){toast("Chưa có tuyến nào, lập tuyến ở Kế hoạch tháng › bước 5");return}if(!p){toast("Chọn người phụ trách triển khai");$("#wk-p").focus();return}
    const ids=[];DB.mutate(ME.name,`tạo ${n} video không quay (Worker) ${sk(t.sku).n}`,dt=>{for(let i=0;i<n;i++){const c=newCard(dt,{sku:t.sku,kenh:t.kenh,maTuyen:t.ma,day:0,qday:Math.max(today,W.tu),nguon:"Kho cảnh + Worker",loai:"worker",wkMode:mo,dangVideo:"Giọng đọc (Adam/AI)",nguoiDung:"Worker",ghiChuWorker:g,step:mo==="A"?"worker":"kb",nguoi:p,nguoiKB:mo==="B"?p:"",nguoiEdit:p});dt.cards.push(c);ids.push(c.id)}});
    if(mo==="A"&&typeof simulateWorker==="function")ids.forEach(simulateWorker);
    toast(`Đã tạo ${n} video, giao ${userName(p)}`+(mo==="A"?" theo dõi Worker dựng":" viết kịch bản"));renderMain()};
}


/* ---------- Giao việc theo loại video từ Kế hoạch tuần ----------
   one shot: người được giao viết hook → người duyệt → xếp buổi quay → quay → giao edit → Lead Content & Media → chị
   review / voice off: viết kịch bản → người duyệt → quay → giao edit → Lead Content & Media → chị
   reup: dán link video gốc (Drive) → gửi Worker → Worker dựng → Lead Content & Media → chị
   video tồn: chọn video trong kho (② Video tồn) · Worker: theo dõi Worker dựng · nhân bản win: việc ở Video win */
/* ---------- Sửa / chia lại việc đã giao trong một ô (sản phẩm × kênh × loại video) ---------- */
const WPE_RANK={cg:0,kb:0,quay:1,worker:1,edit:2,dvd:3,dceo:4,dang:5,xong:9};
const wpOwn=c=>c.giao||c.nguoiKB||c.nguoi||"";
function wpEditCells(dt,id){const [sku,kenh,t,w2]=id.split("|"),WW=w2==="M"?{tu:1,den:MONTH.ndays}:WEEKS.find(x=>x.w===+w2)||WEEKS[0];
  if(t==="nhanban")return {sku,kenh,t,w2,TK:(dt.tasks||[]).filter(x=>x.mix==="nhanban"&&x.sku===sku&&x.kenh===kenh&&(w2==="M"||String(x.wk)===String(w2)))};
  return {sku,kenh,t,w2,G:dt.cards.filter(c=>c.sku===sku&&c.kenh===kenh&&mixOf(c)===t&&cDay(c)>=WW.tu&&cDay(c)<=WW.den)}}
function wpEditBox(id,n,G,TK,team){
  const cnt={},lock={},han={};G.forEach(c=>{const u=wpOwn(c);cnt[u]=(cnt[u]||0)+1;if(c.step==="xong")lock[u]=(lock[u]||0)+1;else if(+c.han)han[u]=Math.max(han[u]||0,+c.han)});
  TK.forEach(x=>{cnt[x.nguoi]=(cnt[x.nguoi]||0)+(x.sl||1);if(x.st==="done")lock[x.nguoi]=(lock[x.nguoi]||0)+(x.sl||1);else if(+x.han)han[x.nguoi]=Math.max(han[x.nguoi]||0,+x.han)});const dOpts=Array.from({length:MONTH.ndays},(_,i)=>[i+1,dd(i+1)]);
  const ids=[...new Set([...Object.keys(cnt),...team.map(u=>u.id)])];
  return `<div class="wpas wpe" data-wpebox="${esc(id)}"><small>Sửa số việc từng người (kế hoạch ${n}). Bớt người này, thêm người kia là <b>chuyển việc</b>, phần đã làm giữ nguyên. Bớt mà không ai nhận thì <b>bỏ việc thừa</b>: bỏ việc chưa làm trước, video tồn đã chọn trả lại kho. Việc đã đăng không bớt được. Ô <b>hạn</b> đổi hạn xong cho mọi việc chưa xong của người đó.</small>
    ${ids.map(u=>`<label class="wpu"><span>${esc(userName(u)||"chưa có người")}${lock[u]?` <small>(${lock[u]} đã xong)</small>`:""}</span><input type="number" min="${lock[u]||0}" class="num" data-wpeu="${esc(u)}" value="${cnt[u]||0}"><select data-wpeh="${esc(u)}" data-orig="${han[u]||""}" title="Hạn xong việc của người này">${opt([["","hạn —"]].concat(dOpts.map(([v,l])=>[v,"hạn "+l])),han[u]||"")}</select></label>`).join("")}
    <textarea data-wpenote rows="2" data-orig="${esc(((G.find(c=>c.noteLead)||TK.find(x=>x.noteLead)||{}).noteLead)||"")}" placeholder="Note từ leader cho việc trong ô này">${esc(((G.find(c=>c.noteLead)||TK.find(x=>x.noteLead)||{}).noteLead)||"")}</textarea><div class="wpeprev hint"></div><button class="btn sm pri" data-wpes="${esc(id)}">Lưu</button><button class="btn sm ghost" data-wpec="${esc(id)}">Thôi</button></div>`}
/* Tính trước sẽ làm gì: chuyển việc nào, bỏ việc nào, giao thêm bao nhiêu */
function wpEditCalc(dt,id,tg,hs){const X=wpEditCells(dt,id),P={moves:[],dels:[],adds:[],tk:[],started:0,hans:Object.entries(hs||{})};
  if(X.t==="nhanban"){const have={};X.TK.forEach(x=>{have[x.nguoi]=(have[x.nguoi]||0)+(x.sl||1)});
    Object.keys({...have,...tg}).forEach(u=>{const h=have[u]||0,g=tg[u]??h;if(g!==h)P.tk.push([u,g-h])});return P}
  const by={};X.G.forEach(c=>{(by[wpOwn(c)]=by[wpOwn(c)]||[]).push(c)});const pool=[];
  Object.keys(by).forEach(u=>{const g=tg[u]??by[u].length,L=by[u].filter(c=>c.step!=="xong").sort((a,b)=>(WPE_RANK[a.step]??1)-(WPE_RANK[b.step]??1));
    for(let i=0;i<by[u].length-g&&i<L.length;i++)pool.push([L[i],u])});
  Object.keys(tg).forEach(u=>{let need=tg[u]-(by[u]||[]).length;while(need>0&&pool.length){const [c,f]=pool.pop();P.moves.push([c.id,f,u]);need--}if(need>0)P.adds.push([u,need])});
  pool.forEach(([c])=>{P.dels.push(c.id);if((WPE_RANK[c.step]??1)>0)P.started++});return P}
function wpEditText(P){const nm=u=>userName(u)||"chưa có người",o=[];
  const mv=xvGroupBy(P.moves,m=>m[1]+">"+m[2]);mv.forEach(([k,L])=>{const [f,t]=k.split(">");o.push(`chuyển ${L.length} việc từ ${nm(f)} sang ${nm(t)}`)});
  if(P.dels.length)o.push(`bỏ ${P.dels.length} việc thừa${P.started?` (trong đó ${P.started} việc đã bắt đầu làm)`:""}`);
  P.adds.forEach(([u,n])=>o.push(`giao thêm ${nm(u)} ${n} việc`));
  P.hans.forEach(([u,h])=>o.push(`đổi hạn ${nm(u)} sang ${dd(h)}`));P.tk.forEach(([u,n])=>o.push(n>0?`giao thêm ${nm(u)} ${n} video nhân bản`:`bớt ${nm(u)} ${-n} video nhân bản`));return o}
function wpEditApply(id,P){const [sku,kenh,t,w2]=id.split("|");
  DB.mutate(ME.name,"sửa giao việc "+sk(sku).n+" "+kenh,dt=>{
    P.moves.forEach(([cid,f,u])=>{const c=dt.cards.find(x=>x.id===cid);if(!c)return;c.giao=u;["nguoi","nguoiKB","nguoiEdit","goiy"].forEach(k=>{if(c[k]===f)c[k]=u})});
    const del=new Set(P.dels);dt.cards.filter(c=>del.has(c.id)&&c.khoMa).forEach(c=>{const k=(dt.kho||[]).find(y=>y.ma===c.khoMa&&y.maDang===c.id);if(k){k.maDang="";k.trangThai="Chưa dùng"}});
    dt.cards=dt.cards.filter(c=>!del.has(c.id));
    if(t==="nhanban"){const X=wpEditCells(dt,id),ref=X.TK[0]||{};P.tk.forEach(([u,n])=>{let left=n;
      if(left<0){X.TK.filter(x=>x.nguoi===u&&x.st!=="done").reverse().forEach(x=>{if(!left)return;const r=Math.min(x.sl||1,-left);x.sl=(x.sl||1)-r;left+=r});dt.tasks=dt.tasks.filter(x=>!(x.mix==="nhanban"&&x.sl<=0))}
      else{const o=X.TK.find(x=>x.nguoi===u&&x.st!=="done");if(o){o.sl=(o.sl||1)+left;left=0}else dt.tasks.push({...ref,id:uid("tk"),nguoi:u,sl:left,st:"todo",kq:"",checklist:[],tao:ME.id})}});
      dt.tasks.filter(x=>x.mix==="nhanban"&&x.sku===sku&&x.kenh===kenh).forEach(x=>{x.ten=(x.ten||"").replace(/Nhân bản \d+/,"Nhân bản "+x.sl);x.moTa=(x.moTa||"").replace(/nhân bản \d+/,"nhân bản "+x.sl)})}
    if(P.note!==undefined){const X=wpEditCells(dt,id);(X.G||[]).forEach(c=>{if(c.step!=="xong")c.noteLead=P.note});(X.TK||[]).forEach(x=>{if(x.st!=="done"){x.noteLead=P.note;x.moTa=(x.moTa||"").replace(/\n\nNote từ leader:[\s\S]*$/,"")+(P.note?"\n\nNote từ leader: "+P.note:"")}})}
    if(P.hans.length){const X=wpEditCells(dt,id);P.hans.forEach(([u,h])=>{(X.G||[]).forEach(c=>{if(wpOwn(c)===u&&c.step!=="xong")c.han=h});(X.TK||[]).forEach(x=>{if(x.nguoi===u&&x.st!=="done")x.han=h})})}});
  if(t!=="nhanban")P.adds.forEach(([u,n])=>{const h=(P.hans.find(z=>z[0]===u)||[])[1];wpAssign(sku,kenh,t,u,n,w2==="M"?"M":+w2,undefined,h)})}
function wpAssign(sku,kenh,t,u,n,w,bd,hn,note){note=(note||"").trim();if(t==="ton"){const ow=chanOwner(kenh);if(ow&&pvAvailUid(ow,hn||defHan(D(),null,t)))u=ow}
  const d=D(),WW=w==="M"?{w:"M",tu:1,den:MONTH.ndays}:WEEKS.find(x=>x.w===w)||WEEKS[0],qd=Math.min(MONTH.ndays,Math.max(d.settings.today,WW.tu)),T=d.tuyen.filter(x=>x.sku===sku&&x.kenh===kenh);
  const one=T.length===1?T[0].ma:"",pickT=re=>(T.find(x=>re.test(x.tuyen||""))||T.find(x=>!/kho|tồn|reup|nhân bản/i.test(x.tuyen||""))||T[0]||{}).ma||"";
  const nm=userName(u),sp=sk(sku).n;
  if(t==="nhanban"){DB.mutate(ME.name,`giao ${nm} nhân bản ${n} video win ${sp}`,dt=>dt.tasks.push({id:uid("tk"),ten:`Nhân bản ${n} video win ${sp} (${chOf(kenh).short})`,loai:"Nhân bản video win",nguoi:u,han:hn||Math.min(MONTH.ndays,WW.den),batDau:bd||d.settings.today,moTa:`${w==="M"?"Kế hoạch cả tháng":"Kế hoạch tuần "+w}: nhân bản ${n} video win ${sp} cho ${kenh}. Làm ở Marketing › Video win (Hypit nhân bản), xong trình người duyệt rồi CEO duyệt.${note?`

Note từ leader: ${note}`:""}`,noteLead:note,team:"content",da:"",phoi:[],uu:"Cao",st:"todo",checklist:[{t:"Tìm video win (shop mình, KOC hoặc đối thủ), lưu vào Video win",x:winAll(sku).length>0},{t:"Gửi Hypit phân tích video win",x:false},{t:`Nhân bản đủ ${n} video, trình người duyệt`,x:false}],tao:ME.id,kq:"",mix:"nhanban",sku,kenh,wk:w,sl:n}));return `Đã giao ${nm} nhân bản ${n} video win`}
  const base={sku,kenh,day:0,qday:qd,mix:t,giao:u,wk:w,batDau:bd||d.settings.today,han:hn||defHan(d,WW,t),...(note?{noteLead:note}:{})};
  const mk=dt=>{if(t==="ton")return {...base,maTuyen:pickT(/kho|tồn/i),nguon:"Footage cũ",yTuong:"Chọn video tồn trong kho để đăng",step:"kb",nguoi:u};
    if(t==="reup")return {...base,maTuyen:pickT(/reup|đổi hook|footage/i),nguon:"Reup có sửa",loai:"reup",yTuong:"Tìm video reup, dán link video gốc (Drive) rồi gửi Worker",step:"kb",nguoi:u,nguoiKB:u};
    if(t==="oneshot")return {...base,maTuyen:one,nguon:"Quay mới",loai:"moi",oneShot:true,yTuong:"Viết hook one shot",dangVideo:"One shot",step:"kb",nguoi:u,nguoiKB:u};
    if(t==="kichban")return {...base,maTuyen:one,nguon:"Quay mới",loai:"moi",yTuong:"Viết kịch bản review / voice off",step:"kb",nguoi:u,nguoiKB:u};
    if(t==="outsource")return {...base,maTuyen:one,nguon:"Order outsource",loai:"outsource",wkBat:true,dangVideo:"Video outsource",yTuong:"Gửi brief cho bên outsource, nhận video về rồi dán link",step:"worker",nguoi:u,nguoiEdit:u};
    if(t==="worker")return {...base,maTuyen:one,nguon:"Kho cảnh + Worker",loai:"worker",wkMode:"A",nguoiDung:"Worker",dangVideo:"Giọng đọc (Adam/AI)",yTuong:"Chọn cảnh trong kho cảnh, cho Worker dựng + voice",step:"worker",nguoi:u,nguoiEdit:u}};
  DB.mutate(ME.name,`giao ${nm} ${n} video ${(MIX.find(z=>z[0]===t)||[])[1]} ${sp}`,dt=>{for(let i=0;i<n;i++)dt.cards.push(newCard(dt,mk(dt)))});
  return `Đã giao ${nm} ${n} video ${(MIX.find(z=>z[0]===t)||[])[1]} · ${sp}`}
/* bước tiếp theo theo loại */
const _nextActMix=nextAct;
nextAct=function(c){if(c.mix==="ton"&&c.step==="kb")return null;if(c.mix==="reup"&&c.step==="kb")return ["Đã có link video gốc, gửi Worker","worker"];if(c.oneShot&&c.step==="kb")return ["Gửi duyệt hook","dkb"];if(c.oneShot&&c.step==="dkb")return ["Duyệt hook","quay"];return _nextActMix(c)};
const _checkMoveMix=checkMove;
checkMove=function(c,to,inp){const v=k=>((inp||{})[k]!==undefined?inp[k]:c[k])||"";if(c.mix==="reup"&&to==="worker"&&!String(v("linkVideo")).trim())return "Dán link video gốc (Google Drive) trước khi gửi Worker.";if(c.oneShot&&to==="dkb"&&!String(v("hookText")).trim())return "Viết hook trước khi gửi duyệt.";if(c.step==="kb"&&["dkb","quay","worker"].includes(to)&&!String(v("maTuyen")).trim()&&D().tuyen.some(t=>t.sku===c.sku&&t.kenh===c.kenh))return "Chọn tuyến nội dung cho video này (ô Tuyến nội dung) trước khi gửi duyệt.";return _checkMoveMix(c,to,inp||{})};
/* Chỗ nhân sự làm ngay: hook cần viết (③), video reup cần dán link (②), video tồn cần chọn (②) */
function wpWorkList(b,tab){
  const d=D(),mine=c=>xvGive()||c.nguoi===ME.id;
  if(false&&tab==="quay"){const L=d.cards.filter(c=>c.oneShot&&c.step==="kb"&&!c.buoiQuay);const A=d.cards.filter(c=>c.oneShot&&c.step==="dkb"&&!c.buoiQuay);
    const S=d.cards.filter(c=>mixOf(c)==="kichban"&&c.step==="kb");
    if(S.length)b.insertAdjacentHTML("afterbegin",`<section class="card"><div class="card-h"><h2>Kịch bản cần viết</h2><span class="hint">${S.length} video Review / voice off · người được giao mở thẻ, viết hook và kịch bản rồi bấm Chốt (Lead Content & Media và chị chỉ duyệt video)</span></div><div class="xlist">${S.map(c=>`<div class="xmini">${swatch(c.sku)}<span class="xms">${esc(skS(c.sku))} · ${esc(chOf(c.kenh).short)} · ${esc(userName(c.nguoi)||"—")}</span>${hanTag(c)}${c.hookText||c.noiDung?`<span class="xmt">đã có nội dung</span>`:""}${mine(c)?`<button class="btn sm pri" data-card="${c.id}">Viết kịch bản</button>`:""}</div>`).join("")}</div></section>`);
    if(!L.length&&!A.length)return;
    b.insertAdjacentHTML("afterbegin",`<section class="card"><div class="card-h"><h2>Hook cần viết</h2><span class="hint">${L.length} hook · người được giao gõ hook rồi bấm Chốt hook (Lead Content & Media và chị chỉ duyệt video)</span>${A.length&&(can(ME,"viec.duyet")||ME.role==="admin")?`<span class="sp"></span><button class="btn pri sm" id="hk-okall">✓ Duyệt ${A.length} hook đang chờ</button>`:A.length?`<span class="hint">· ${A.length} hook chờ duyệt</span>`:""}</div>
     <div class="xlist">${L.map(c=>`<div class="xmini">${swatch(c.sku)}<span class="xms">${esc(skS(c.sku))} · ${esc(userName(c.nguoi)||"—")}</span>${hanTag(c)}${mine(c)?`<input class="hkin" data-hkin="${c.id}" placeholder="Gõ hook…">${isLate(c)?`<input class="hkin tre" data-tre="${c.id}" placeholder="Trễ hạn: lý do trễ…">`:""}<button class="btn sm pri" data-hksend="${c.id}">Chốt hook</button>`:`<span class="xmt">chưa viết</span>`}</div>`).join("")}</div>
     ${A.length?`<div class="xgrp">Chờ duyệt</div><div class="xlist">${A.map(c=>xvMini(c,`<span class="xms">${esc(userName(c.nguoi)||"")}</span>`)).join("")}</div>`:""}
     <p class="hint">Hook đã duyệt hiện ở trên cùng ("hook đã duyệt chưa quay"), bấm chuyển vào buổi quay.</p></section>`);
    b.querySelectorAll("[data-hksend]").forEach(x=>x.onclick=()=>{const id=x.dataset.hksend,h=b.querySelector(`[data-hkin="${id}"]`).value.trim();if(!h){toast("Gõ hook trước");return}const tr=b.querySelector(`[data-tre="${id}"]`),e=moveCard(ME,id,"quay",{hookText:h,lyDoTre:tr?tr.value.trim():undefined});toast(e||"Đã chốt hook, sẵn sàng quay");renderMain()});
    if($("#hk-okall"))$("#hk-okall").onclick=()=>{let n=0;A.forEach(c=>{if(!moveCard(ME,c.id,"quay"))n++});toast(`Đã duyệt ${n} hook, xếp vào buổi quay ở dưới`);renderMain()}}
  if(tab==="wk"){const R=d.cards.filter(c=>c.mix==="reup"&&c.step==="kb"&&(!OW_K||c.kenh===OW_K)),TN=[];
    if(!R.length&&!TN.length)return;
    b.insertAdjacentHTML("afterbegin",`${R.length?`<section class="card"><div class="card-h"><h2>Video reup cần link</h2><span class="hint">${R.length} video · người được giao dán link video gốc (Google Drive) rồi gửi Worker dựng</span></div>
     <div class="xlist">${R.map(c=>`<div class="xmini">${swatch(c.sku)}<span class="xms">${esc(skS(c.sku))} · ${esc(chOf(c.kenh).short)} · ${esc(userName(c.nguoi)||"—")}</span>${hanTag(c)}${mine(c)?`<input class="hkin" data-rpin="${c.id}" placeholder="Dán link video gốc (Drive)…" value="${esc(c.linkVideo||"")}">${isLate(c)?`<input class="hkin tre" data-tre="${c.id}" placeholder="Trễ hạn: lý do trễ…">`:""}<button class="btn sm" data-rpsend="${c.id}">Đã có link, gửi duyệt sau</button><button class="btn sm pri" data-wsend="${c.id}">Gửi Worker dựng</button>`:`<span class="xmt">chưa có link</span>`}</div>`).join("")}</div></section>`:""}
     ${TN.length?`<section class="card"><div class="card-h"><h2>Video tồn cần chọn</h2><span class="hint">${TN.length} ô · người được giao chọn video ở bảng "Ô lịch dành cho video tồn" bên dưới</span></div><div class="xlist">${TN.map(c=>xvMini(c,`<span class="xms">${esc(chOf(c.kenh).short)} · ${esc(userName(c.nguoi)||"—")}</span>`)).join("")}</div></section>`:""}`);
    b.querySelectorAll("[data-rpsend]").forEach(x=>x.onclick=()=>{const id=x.dataset.rpsend,l=b.querySelector(`[data-rpin="${id}"]`).value.trim();const tr=b.querySelector(`[data-tre="${id}"]`),e=moveCard(ME,id,"worker",{linkVideo:l,lyDoTre:tr?tr.value.trim():undefined});toast(e||"Đã gửi Worker dựng");renderMain()})}
}

/* ---------- Thẻ "dùng video tồn": cửa sổ gọn ----------
   chọn video trong kho → xem tuyến → chọn kênh → chọn ngày đăng; đã xếp rồi thì chỉ còn đăng và dán ID / link */
function openKhoCard(c){
  const d=D(),today=d.settings.today,k=c.khoMa&&(d.kho||[]).find(x=>x.ma===c.khoMa),ed=xvGive()||c.nguoi===ME.id||chanOwner(c.kenh)===ME.id,fb=!chOf(c.kenh).needId;
  const free=xvKhoFree().filter(x=>x.sku===c.sku),others=xvKhoFree().filter(x=>x.sku!==c.sku);
  const T=d.tuyen.filter(t=>t.sku===c.sku);
  const dayOpts=kenh=>[["","Chọn ngày đăng"]].concat(Array.from({length:MONTH.ndays-today+1},(_,i)=>today+i).map(x=>[x,dayLbl(x)+" · đã xếp "+d.cards.filter(y=>y.kenh===kenh&&y.day===x&&y.id!==c.id).length+"/"+nhipOf(kenh,x)]));
  OPENED=c.id;
  $("#drawerIn").innerHTML=`<div class="dh"><div><span class="mono">${c.id}</span> ${pill(k?(c.step==="xong"?"Đã đăng":"Chờ đăng"):"Chưa chọn video","gry")}</div><button class="btn sm" id="dx">Đóng</button></div>
   <h2 class="dtitle">${k?"Video tồn "+esc(k.ma):"Chọn video tồn để đăng"}</h2>
   <p class="hint">${swatch(c.sku)}${esc(sk(c.sku).n)} · người làm: ${esc(userName(c.giao||c.nguoi)||"—")}</p>
   <div class="frm kfrm">
    ${k?`<div class="kinfo"><b>${esc(k.ma)}</b> · ${esc((k.tuyen||"")+(k.ten?(k.tuyen?" · ":"")+k.ten:"")||k.skuText||"")}${k.link?` · <a href="${esc(/^https?:/.test(k.link)?k.link:"https://"+k.link)}" target="_blank" rel="noopener">Xem video</a>`:""}</div>`
      :`<label class="field full">Video tồn trong kho<select id="kc-v" ${ed?"":"disabled"}>${opt([["","— chọn video —"]].concat(free.map(x=>[x.ma,x.ma+" · "+(x.tuyen||x.skuText||"")])).concat(others.length?[["__sep","── sản phẩm khác ──"]].concat(others.map(x=>[x.ma,sk(x.sku).n+" · "+x.ma+" · "+(x.tuyen||"")])):[]),"")}</select><small>${free.length?free.length+" video "+esc(sk(c.sku).n)+" còn dùng được":`<span class="t-amb">Kho không còn video ${esc(sk(c.sku).n)}</span>`}</small></label>`}
    <label class="field">Tuyến<select id="kc-t" ${ed?"":"disabled"}>${opt([["","—"]].concat(T.map(t=>[t.ma,t.tuyen+" · "+chOf(t.kenh).short])),c.maTuyen||"")}</select></label>
    <label class="field">Kênh<select id="kc-k" ${ed?"":"disabled"}>${opt(CHANNELS.map(x=>[x.k,x.short]),c.kenh)}</select></label>
    <label class="field">Ngày đăng<select id="kc-d" ${ed?"":"disabled"}>${opt(dayOpts(c.kenh),c.day||"")}</select></label>
    ${k?`<label class="field">${fb?"Link bài đã đăng":"ID video TikTok (19 số)"}<input id="kc-id" value="${esc(fb?c.linkDang||"":c.tiktokId||"")}" ${ed?"":"disabled"}></label>`:""}
    <label class="field full">Caption đăng<textarea id="kc-cap" rows="4" placeholder="Viết caption cho video này…" ${ed?"":"disabled"}>${esc(c.caption||"")}</textarea></label>
   </div>
   <div class="acts">${ed?(k?`<button class="btn pri" id="kc-save">Lưu</button>${c.step!=="xong"?`<button class="btn" id="kc-post">Đã đăng</button>`:""}`:`<button class="btn pri" id="kc-save">Đưa vào lịch đăng</button>`):""}<button class="lnk" id="kc-full">Mở thẻ đầy đủ</button>${xvGive()&&!k?`<button class="lnk danger" id="kc-del">Xóa ô này</button>`:""}</div>`;
  $("#drawer").hidden=false;$("#dx").onclick=closeDrawer;
  if($("#kc-k"))$("#kc-k").onchange=()=>{$("#kc-d").innerHTML=opt(dayOpts($("#kc-k").value),$("#kc-d").value)};
  if($("#kc-v"))$("#kc-v").onchange=()=>{const v=(d.kho||[]).find(x=>x.ma===$("#kc-v").value);if(!v)return;const m=T.find(t=>(v.tuyen||"").toLowerCase().includes((t.tuyen||"").toLowerCase().split(" ")[0]));if(m&&$("#kc-t"))$("#kc-t").value=m.ma};
  $("#kc-full").onclick=()=>_openCardKho(c.id,{full:true});
  if($("#kc-del"))$("#kc-del").onclick=()=>{DB.mutate(ME.name,"xóa ô video tồn "+c.id,dt=>{dt.cards=dt.cards.filter(y=>y.id!==c.id)});closeDrawer();renderMain()};
  if($("#kc-save"))$("#kc-save").onclick=()=>{const kenh=$("#kc-k").value,day=+$("#kc-d").value||0,tu=$("#kc-t").value;
    if(!k){const ma=$("#kc-v").value;if(!ma||ma==="__sep"){toast("Chọn video tồn");return}const cap0=$("#kc-cap")?$("#kc-cap").value.trim():"";allocKho(ma,kenh,day,"nguyen",chanOwner(kenh)||c.nguoi,c.id)}
    DB.mutate(ME.name,"xếp video tồn "+c.id,dt=>{const x=dt.cards.find(y=>y.id===c.id);if(!x)return;x.kenh=kenh;x.day=day;if(tu){x.maTuyen=tu;const t=dt.tuyen.find(y=>y.ma===tu);if(t)x.tuyen=t.tuyen}if(!k){x.step="dang";x.loai="kho";x.ceo="PASS";x.nguoi=((dt.kenhPT||{})[kenh]||{}).chinh||x.nguoi}
      if($("#kc-cap"))x.caption=$("#kc-cap").value.trim();
      if(k&&$("#kc-id")){const v=$("#kc-id").value.trim();if(fb)x.linkDang=v;else x.tiktokId=v}});
    toast(k?"Đã lưu":"Đã đưa vào lịch"+(day?" ngày "+dd(day):", người giữ kênh chọn ngày đăng"));renderMain();openKhoCard(D().cards.find(y=>y.id===c.id))};
  if($("#kc-post"))$("#kc-post").onclick=()=>{const v=$("#kc-id").value.trim();const e=moveCard(ME,c.id,"xong",Object.assign(fb?{linkDang:v}:{tiktokId:v},$("#kc-cap")?{caption:$("#kc-cap").value.trim()}:{}));if(e){toast(e);return}toast("Đã đăng");closeDrawer();renderMain()};
}
const _openCardKho=openCard;
openCard=function(id,o={}){const c=D().cards.find(x=>x.id===id);if(c&&!o.full&&(c.mix==="ton"||(c.khoMa&&loaiOf(c)==="kho")))return openKhoCard(c);return _openCardKho(id,o)};


/* ---------- Ngày bắt đầu / hạn xong của việc được giao, trễ hạn phải có lý do và người duyệt ---------- */
/* hạn mặc định: viết hook / kịch bản xong trước buổi quay gần nhất 1 ngày; việc khác 2 ngày */
const hanTag=c=>xvGive()?`${c.batDau?`<span class="xms">giao ${dd(c.batDau)}</span>`:""}<select class="hansel${isLate(c)?" late":""}" data-sethan="${c.id}" title="Hạn xong">${opt([["","Chưa có hạn"]].concat(Array.from({length:MONTH.ndays},(_,i)=>[i+1,"hạn "+dd(i+1)])),c.han||"")}</select>`:(c.han?`<span class="xms ${isLate(c)?"t-red":""}">${c.batDau?dd(c.batDau)+" → ":""}hạn ${dd(c.han)}${isLate(c)?" · trễ":""}</span>`:"");
document.addEventListener("change",e=>{const x=e.target;if(!x.matches||!x.matches("select[data-sethan]"))return;const id=x.dataset.sethan,v=+x.value||0;DB.mutate(ME.name,"đặt hạn "+id+" → "+(v?dd(v):"không"),dt=>{const c=dt.cards.find(y=>y.id===id);if(c){c.han=v;if(v&&!c.batDau)c.batDau=dt.settings.today}});toast(v?"Đã đặt hạn "+dd(v):"Đã bỏ hạn");renderMain()});
const _mvTre=moveCard;
moveCard=function(u,id,to,inp={}){const c=D().cards.find(x=>x.id===id);inp=Object.assign({},inp);let lt=inp.lyDoTre;delete inp.lyDoTre;
  const late=c&&c.han&&WORK_STEPS.includes(c.step)&&c.han<D().settings.today&&to!==c.step;
  if(late&&!lt&&!(c.tre&&c.tre.lyDo&&c.tre.buoc===stepName(c.step))){const r=typeof prompt==="function"?prompt(`Việc ${id} trễ hạn (hạn ${dd(c.han)}). Điền lý do trễ để gửi duyệt:`):"";if(!r||!r.trim())return "Việc trễ hạn: cần điền lý do trễ.";lt=r.trim()}
  const from=c?c.step:"",e=_mvTre(u,id,to,inp);
  if(!e&&c&&from!==to)DB.mutate(u.name,late?`nộp trễ ${id}: ${lt}`:"đổi bước "+id,dt=>{const x=dt.cards.find(y=>y.id===id);if(!x)return;if(late)x.tre={han:x.han,lyDo:lt,by:u.name,at:new Date().toLocaleString("vi-VN"),st:"cho",buoc:c.oneShot&&from==="kb"?"Viết hook":c.mix==="reup"&&from==="kb"?"Dán link reup":stepName(from),ngay:dt.settings.today};if(WORK_STEPS.includes(from)){x.hanCu=(x.hanCu||[]).concat({buoc:stepName(from),han:x.han,xong:dt.settings.today});x.han=0;x.batDau=0}});
  return e};
/* người duyệt lý do trễ (hiện ở Tổng quan Content) */
function treBox(){const d=D(),L=d.cards.filter(c=>c.tre&&c.tre.st==="cho"),dv=can(ME,"viec.duyet")||ME.role==="admin";if(!L.length)return "";
  return `<section class="card"><div class="card-h"><h2>Trễ hạn chờ duyệt</h2><span class="hint">${L.length} việc nộp trễ có lý do</span></div><div class="xlist">${L.map(c=>`<div class="xmini">${swatch(c.sku)}<span class="xmt clk" data-card="${c.id}"><b>${esc(c.tre.by)}</b> · ${esc(c.tre.buoc)} · hạn ${dd(c.tre.han)}, nộp ${dd(c.tre.ngay)} — ${esc(c.tre.lyDo)}</span>${dv?`<button class="btn sm" data-treok="${c.id}">Duyệt</button><button class="btn sm" data-treno="${c.id}">Không duyệt</button>`:""}</div>`).join("")}</div></section>`}
function bindTre(m){m.querySelectorAll("[data-treok],[data-treno]").forEach(x=>x.onclick=()=>{const id=x.dataset.treok||x.dataset.treno,ok=!!x.dataset.treok;DB.mutate(ME.name,(ok?"duyệt":"không duyệt")+" lý do trễ "+id,dt=>{const c=dt.cards.find(y=>y.id===id);if(c&&c.tre){c.tre.st=ok?"ok":"khong";c.tre.duyet=ME.name}});toast(ok?"Đã duyệt lý do trễ":"Đã ghi không duyệt (tính trễ)");renderMain()})}
const _pMktTqTre=PAGES.mkt_tq;
PAGES.mkt_tq=function(m){_pMktTqTre(m);const r=m.querySelector(".xr2");if(r){r.insertAdjacentHTML("afterend",treBox());bindTre(m);bindCommon(m)}};



/* Tổng quan Marketing: tình trạng video theo kênh. Bấm chọn kênh, mỗi sản phẩm một hàng, các trạng thái xếp hàng ngang */
let TQ_K="";
function tqKenhHtml(){
  const d=D(),pairs=ptPairs(),chs=CHANNELS.filter(ch=>ch.needId&&pairs.some(x=>x.kenh===ch.k&&+x.sl>0));if(!chs.length)return "";
  if(!TQ_K||!chs.some(c=>c.k===TQ_K))TQ_K=chs[0].k;
  const ch=chOf(TQ_K),P=pairs.filter(x=>x.kenh===TQ_K),C=d.cards.filter(c=>c.kenh===TQ_K&&c.nguon!=="Order Digital"),skus=[...new Set(P.filter(x=>+x.sl>0).map(x=>x.sku).concat(C.map(c=>c.sku)))];
  const rowOf=s=>{const pl=sum(P.filter(x=>x.sku===s),x=>+x.sl||0),cs=C.filter(c=>c.sku===s),cb=cs.filter(c=>["cg","kb"].includes(c.step)&&!c.hookText&&!c.noiDung).length,lam=cs.filter(c=>KV_PIPE.includes(c.step)||(c.step==="kb"&&(c.hookText||c.noiDung))).length,cho=cs.filter(c=>c.step==="dang").length,xong=cs.filter(c=>c.step==="xong").length;return {s,pl,cb,lam,cho,xong,th:Math.max(0,pl-cho-xong)}};
  const R=skus.map(rowOf).filter(r=>r.pl||r.cb||r.lam||r.cho||r.xong),T=R.reduce((a,r)=>{["pl","cb","lam","cho","xong","th"].forEach(k=>a[k]+=r[k]);return a},{pl:0,cb:0,lam:0,cho:0,xong:0,th:0});
  const cell=(n,c)=>`<td class="${c||""}">${n||"·"}</td>`;
  return `<section class="card flush"><div class="card-h pad"><h2>Tình trạng video theo kênh</h2><span class="hint">bấm chọn kênh · mỗi sản phẩm một hàng · giữ kênh: ${esc(userName(chanOwner(TQ_K))||"chưa đặt")}</span></div>
   <div class="pad"><div class="seg ptk">${chs.map(c=>`<button data-tqk="${esc(c.k)}" class="${c.k===TQ_K?"on":""}">${esc(c.short)}</button>`).join("")}</div></div>
   <div class="tbl"><table class="tqk"><thead><tr><th class="l">Sản phẩm</th><th>Kế hoạch</th><th title="Chưa viết hook, chưa ai bắt đầu">Chưa làm</th><th title="Đang viết hook, quay, dựng, chờ duyệt">Đang làm</th><th title="Đã duyệt, chờ đăng">Chờ đăng</th><th>Đã đăng</th><th title="Kế hoạch trừ chờ đăng và đã đăng">Thiếu</th></tr></thead><tbody>${R.map(r=>`<tr><td class="l">${swatch(r.s)}${esc(sk(r.s).n)}</td>${cell(r.pl)}${cell(r.cb)}${cell(r.lam)}${cell(r.cho,"blu")}${cell(r.xong,"grn")}<td class="${r.th?"t-red gop":"t-grn"}" ${r.th?`data-gop="thieu|${esc(r.s)}|${esc(TQ_K)}" title="Bấm để tới chỗ cần làm thêm"`:""}><b>${r.th}</b></td></tr>`).join("")||'<tr><td colspan="7" class="empty">Kênh này chưa có kế hoạch.</td></tr>'}
   <tr class="tqt"><td class="l"><b>Tổng ${esc(ch.short)}</b></td><td><b>${T.pl}</b></td><td><b>${T.cb}</b></td><td><b>${T.lam}</b></td><td><b>${T.cho}</b></td><td><b>${T.xong}</b></td><td class="${T.th?"t-red":"t-grn"}"><b>${T.th}</b></td></tr></tbody></table></div></section>`
}
const _pMktTq2=PAGES.mkt_tq;
PAGES.mkt_tq=function(m){_pMktTq2(m);const h=tqKenhHtml();if(!h)return;const r=m.querySelector(".xr2");if(r)r.insertAdjacentHTML("beforebegin",h);else m.insertAdjacentHTML("afterbegin",h);m.querySelectorAll("[data-tqk]").forEach(b=>b.onclick=()=>{TQ_K=b.dataset.tqk;renderMain()})};


/* bấm vào chữ đỏ thừa / thiếu thì sang đúng chỗ đang có vấn đề */
function gopGo(kind,sku,kenh){
  const d=D();
  if(kind==="thua"){bvGo(kenh,sku,"");return}
  const pr=ptPairs().find(x=>x.sku===sku&&x.kenh===kenh),ton=pr?(+pr.ton||0):0;
  if(kind==="thieuk"||ton>0){MOD="mkt";PAGE="kehoach";STEP=7;XV.tab="kho";XV.ks="can";XV.ktK=kenh;XV.khoSt="free";XV.khoSku=sku||"";render();scrollTo(0,0);return}
  bvGo(kenh,sku,"")
}
if(!window._gopOn){window._gopOn=1;document.addEventListener("click",e=>{const g=e.target.closest&&e.target.closest("[data-gop]");if(!g)return;e.preventDefault();e.stopPropagation();const [k,s,c]=g.dataset.gop.split("|");gopGo(k,s,c)},true)}

/* ---------- ② Video tồn (làm lại): kho → tuần này cần làm → mở từng sản phẩm, chọn video → lịch đăng video tồn ---------- */
let KS_OPEN=new Set();
const khoEditor=k=>{if(!k||!k.nguoi)return "";const u=D().users.find(x=>x.id===k.nguoi||(x.name||"").toLowerCase()===String(k.nguoi).toLowerCase());return u?u.name:k.nguoi};
const khoLink=k=>/^https?:/.test(k.link||"")?k.link:"https://"+k.link;
/* Chọn một video trong kho cho một kênh: điền vào ô "Dùng video tồn" còn trống, hết ô thì tự thêm */
function ksPick(sku,kenh,ma){
  const k=(D().kho||[]).find(y=>y.ma===ma);if(!k||k.maDang){toast("Video này đã được chọn rồi");return false}
  const slot=D().cards.find(c=>c.mix==="ton"&&!c.khoMa&&["kb","cg"].includes(c.step)&&c.sku===sku&&c.kenh===kenh),own=chanOwner(kenh);
  if(slot){allocKho(ma,kenh,0,"nguyen",own||slot.nguoi,slot.id);DB.mutate(ME.name,"chọn video tồn "+ma,dt=>{const c=dt.cards.find(y=>y.id===slot.id);if(!c)return;c.step="dang";c.loai="kho";c.ceo="PASS";c.day=0;c.nguoi=own||c.nguoi;c.nguoiEditTen=khoEditor(k);c.hookText=c.hookText||k.tuyen||"";c.han=0})}
  else{const id=allocKho(ma,kenh,0,"nguyen",own||ME.id,"");DB.mutate(ME.name,"chọn video tồn "+ma+" (ngoài kế hoạch)",dt=>{const c=dt.cards.find(y=>y.id===id);if(!c)return;c.mix="ton";c.giao=own||ME.id;c.nguoiEditTen=khoEditor(k);c.hookText=c.hookText||k.tuyen||"";c.han=0;c.phatSinh=true})}
  return true
}
function xvKho2(b,o){
  const {d,W,give}=o,today=d.settings.today,free=xvKhoFree(),bySku=xvGroupBy(free,k=>k.sku).sort((a,c)=>c[1].length-a[1].length);
  const slots=d.cards.filter(c=>c.mix==="ton"&&!c.khoMa&&["kb","cg"].includes(c.step));
  const pairs=xvGroupBy(slots.filter(c=>!XV.khoSku||c.sku===XV.khoSku),c=>c.sku+"|"+c.kenh);
  const chosen=d.cards.filter(c=>c.khoMa&&loaiOf(c)==="kho"&&(!XV.khoSku||c.sku===XV.khoSku)&&(c.step!=="xong"||xvIn(c,W))).sort((a,c)=>(a.step==="xong")-(c.step==="xong")||(a.day||99)-(c.day||99)); // video tồn đã chọn: hiện hết video chưa đăng, ngày nào cũng hiện
  const may=c=>give||c.giao===ME.id||c.nguoi===ME.id||chanOwner(c.kenh)===ME.id;
  const block=([key,S])=>{const [sku,kenh]=key.split("|"),V=free.filter(k=>k.sku===sku),op=KS_OPEN.has(key),who=[...new Set(S.map(c=>userName(c.giao||c.nguoi)).filter(Boolean))].join(", ");
    return `<div class="ksb${op?" open":""}"><div class="ksh" data-kso="${esc(key)}"><i class="ptar">${op?"▾":"▸"}</i>${swatch(sku)}<b>${esc(sk(sku).n)}</b><span class="hint">${esc(chOf(kenh).short)} · cần chọn <b>${S.length}</b> video · giao ${esc(who||"—")} · kho có ${V.length} video</span></div>
     ${op?(V.length?`<div class="tbl"><table class="kstab"><thead><tr><th>Mã</th><th>Tuyến / nội dung</th><th>Người edit</th><th>Video</th><th></th></tr></thead><tbody>${V.map(k=>`<tr><td class="mono">${esc(k.ma)}</td><td class="kstn" title="${esc((k.tuyen||"")+(k.ten?(k.tuyen?" · ":"")+k.ten:"")||k.skuText||"")}">${esc((k.tuyen||"")+(k.ten?(k.tuyen?" · ":"")+k.ten:"")||k.skuText||"")}</td><td>${esc(khoEditor(k)||"—")}</td><td>${k.link?`<a href="${esc(khoLink(k))}" target="_blank" rel="noopener" title="Mở video">▶ Mở</a>`:`<span class="hint">—</span>`}</td><td>${S.some(may)?`<button class="btn sm pri" data-kspick="${esc(key)}|${esc(k.ma)}">Chọn</button>`:""}</td></tr>`).join("")}</tbody></table></div>`:`<p class="t-amb pad">Kho không còn video ${esc(sk(sku).n)}. Đổi số video này sang loại khác ở ① Kế hoạch tuần.</p>`):""}</div>`};
  const stOf=k=>{if(!k.maDang)return "free";const c=d.cards.find(y=>y.id===k.maDang);return c&&c.step==="xong"?"done":"wait"},cardOf=k=>k.maDang&&d.cards.find(y=>y.id===k.maDang);
  const ALLK=(d.kho||[]).filter(k=>(khoOk(k)||k.maDang)&&stOf(k)!=="done"&&(!XV.khoSku||k.sku===XV.khoSku)),nSt={free:0,wait:0,done:0};ALLK.forEach(k=>nSt[stOf(k)]++);
  if(!["","free","wait"].includes(XV.khoSt))XV.khoSt="";
  const FV=ALLK.filter(k=>!XV.khoSt||stOf(k)===XV.khoSt).sort((p,q)=>["free","wait","done"].indexOf(stOf(p))-["free","wait","done"].indexOf(stOf(q))),shown=FV.slice(0,60);
  const stBar=`<div class="seg kst">${[["","Tất cả ("+ALLK.length+")"],["free","Chưa phân bổ ("+nSt.free+")"],["wait","Chờ đăng ("+nSt.wait+")"]].map(([k,l])=>`<button data-ksst="${k}" class="${(XV.khoSt||"")===k?"on":""}">${l}</button>`).join("")}</div>`;
  const kOpts=sku=>{const p=d.products.find(x=>x.k===sku),L=p?pKenhs(p).map(e=>e.kenh):CHANNELS.map(c=>c.k);return L.filter(k=>give||chanOwner(k)===ME.id)};
  const browse=`<section class="card flush"><div class="card-h pad"><h2>Chọn video từ kho</h2><span class="hint">${FV.length} video${FV.length>shown.length?` (hiện ${shown.length} video đầu, bấm sản phẩm ở trên để lọc)`:""} · chọn kênh rồi bấm Chọn, video chọn xong vẫn nằm trong danh sách này, trạng thái "Chờ đăng", xếp ngày ở ④ Calendar · bấm "Bỏ chọn" để trả về kho</span></div><div class="pad">${stBar}</div>
   <div class="tbl"><table class="kstab"><thead><tr><th>Mã</th><th>Sản phẩm</th><th>Tuyến / nội dung</th><th>Người edit</th><th>Video</th><th>Trạng thái</th><th>Chọn cho kênh / đã chọn cho</th></tr></thead><tbody>${shown.map(k=>{const ko=kOpts(k.sku);return `<tr><td class="mono">${esc(k.ma)}</td><td>${swatch(k.sku)}${esc(sk(k.sku).n)}</td><td>${esc((k.tuyen||"")+(k.ten?(k.tuyen?" · ":"")+k.ten:"")||k.skuText||"")}</td><td>${esc(khoEditor(k)||"—")}</td><td>${k.link?`<a href="${esc(khoLink(k))}" target="_blank" rel="noopener" title="Mở video">▶ Mở</a>`:`<span class="hint">—</span>`}</td><td>${(()=>{const s=stOf(k),c=cardOf(k);return s==="free"?pill("Chưa phân bổ","gry"):s==="wait"?pill("Chờ đăng","blu"):pill("Đã đăng","grn")})()}</td><td>${(()=>{const s=stOf(k),c=cardOf(k);if(s!=="free"&&c)return `<b>${esc(chOf(c.kenh).short)}</b> · ${c.day?"ngày "+dd(c.day):"chưa xếp ngày"} <span class="mono clk" data-card="${esc(c.id)}">${esc(c.id)}</span>${s==="wait"&&(give||may(c))?` <button class="lnk danger" data-ksun="${esc(c.id)}" title="Trả video về kho, chọn lại">Bỏ chọn</button>`:""}`;return ko.length?`<select data-kbk="${esc(k.ma)}">${opt(ko.map(x=>[x,chOf(x).short]),ko[0])}</select><button class="btn sm pri" data-kbpick="${esc(k.ma)}|${esc(k.sku)}">Chọn</button>`:`<span class="hint">người phụ trách kênh chọn</span>`})()}</td></tr>`}).join("")||`<tr><td colspan="7" class="empty">Không có video nào.</td></tr>`}</tbody></table></div></section>`;
  b.innerHTML=`${browse}
  <section class="card"><div class="card-h"><h2>Chọn video tồn</h2><span class="hint">${slots.length?`${slots.length} video cần chọn · bấm từng sản phẩm để mở danh sách video trong kho, xem rồi bấm Chọn`:"không còn video nào cần chọn"}</span></div>
   ${pairs.map(block).join("")||`<p class="hint">Giao "Dùng video tồn" ở ① Kế hoạch thì sản phẩm sẽ hiện ở đây.</p>`}</section>
  <section class="card flush"><div class="card-h pad"><h2>Lịch đăng video tồn</h2><span class="hint">${chosen.filter(c=>c.step!=="xong").length} video chờ đăng · người đăng tự chọn ngày đăng · video đã có ngày vẫn ở đây đến khi đăng xong</span></div>
   <div class="tbl"><table><thead><tr><th>Video</th><th>Sản phẩm · tuyến</th><th>Kênh</th><th>Người edit</th><th>Người đăng</th><th>Ngày đăng</th><th></th></tr></thead><tbody>
   ${chosen.map(c=>{const k=(d.kho||[]).find(x=>x.ma===c.khoMa)||{},own=chanOwner(c.kenh),canDay=give||own===ME.id;return `<tr><td><span class="mono clk" data-card="${c.id}">${esc(c.khoMa)}</span>${k.link?` · <a href="${esc(khoLink(k))}" target="_blank" rel="noopener">xem</a>`:""}</td><td>${swatch(c.sku)}${esc(sk(c.sku).n)}<small>${esc(k.tuyen||c.tuyen||"")}</small></td><td>${esc(chOf(c.kenh).short)}</td><td>${esc(c.nguoiEditTen||khoEditor(k)||"—")}</td><td>${esc(userName(own)||"chưa đặt")}</td>
     <td>${canDay?`<select data-setday="${c.id}">${opt([["","Chọn ngày"]].concat(Array.from({length:MONTH.ndays-today+1},(_,i)=>today+i).map(x=>[x,dayLbl(x)+" · "+d.cards.filter(y=>y.kenh===c.kenh&&y.day===x&&y.id!==c.id).length+"/"+nhipOf(c.kenh,x)])),c.day||"")}</select>`:(c.day?dayLbl(c.day):"chưa xếp")}</td>
     <td>${c.step==="xong"?pill("Đã đăng","grn"):""}${may(c)&&c.mix==="ton"&&c.step!=="xong"?`<button class="lnk danger" data-ksun="${c.id}" title="Trả video về kho, chọn lại">Bỏ chọn</button>`:""}</td></tr>`}).join("")||`<tr><td colspan="7" class="empty">Chưa chọn video nào.</td></tr>`}</tbody></table></div></section>`;
  b.querySelectorAll("[data-khosku]").forEach(x=>x.onclick=()=>{XV.khoSku=x.dataset.khosku;renderMain()});
  b.querySelectorAll("[data-ksst]").forEach(x=>x.onclick=()=>{XV.khoSt=x.dataset.ksst;renderMain()});
  b.querySelectorAll("[data-kbpick]").forEach(x=>x.onclick=()=>{const [ma,sku]=x.dataset.kbpick.split("|"),kenh=b.querySelector(`[data-kbk="${ma}"]`).value;if(ksPick(sku,kenh,ma)){toast(`Đã chọn ${ma} cho ${chOf(kenh).short}`);renderMain()}});
  b.querySelectorAll("[data-kso]").forEach(h=>h.onclick=()=>{const k=h.dataset.kso;KS_OPEN.has(k)?KS_OPEN.delete(k):KS_OPEN.add(k);renderMain()});
  b.querySelectorAll("[data-kspick]").forEach(x=>x.onclick=()=>{const [sku,kenh,ma]=x.dataset.kspick.split("|"),slot=D().cards.find(c=>c.mix==="ton"&&!c.khoMa&&["kb","cg"].includes(c.step)&&c.sku===sku&&c.kenh===kenh&&may(c));if(!slot){toast("Không còn ô cần chọn");return}
    const k=(D().kho||[]).find(y=>y.ma===ma),own=chanOwner(kenh);allocKho(ma,kenh,0,"nguyen",own||slot.nguoi,slot.id);
    DB.mutate(ME.name,"chọn video tồn "+ma,dt=>{const c=dt.cards.find(y=>y.id===slot.id);if(!c)return;c.step="dang";c.loai="kho";c.ceo="PASS";c.day=0;c.nguoi=own||c.nguoi;c.nguoiEditTen=khoEditor(k);c.hookText=c.hookText||(k&&k.tuyen)||"";c.han=0});
    const left=D().cards.filter(c=>c.mix==="ton"&&!c.khoMa&&["kb","cg"].includes(c.step)&&c.sku===sku&&c.kenh===kenh).length;if(!left)KS_OPEN.delete(sku+"|"+kenh);
    toast(`Đã chọn ${ma}`+(left?`, còn ${left} video cần chọn`:", đã chọn đủ"));renderMain()});
  b.querySelectorAll("[data-ksun]").forEach(x=>x.onclick=()=>{const id=x.dataset.ksun;DB.mutate(ME.name,"bỏ chọn video tồn "+id,dt=>{const c=dt.cards.find(y=>y.id===id);if(!c)return;const k=dt.kho.find(y=>y.ma===c.khoMa);if(k){k.maDang="";k.trangThai="Chưa dùng"}c.khoMa="";c.step="kb";c.loai="";c.nguon="Footage cũ";c.nguoi=c.giao||c.nguoi;c.day=0;c.linkVideo=""});toast("Đã trả video về kho");renderMain()});
  b.querySelectorAll("[data-setday]").forEach(x=>x.onchange=()=>{if(!x.value)return;DB.mutate(ME.name,"xếp ngày đăng "+x.dataset.setday+" → "+dd(+x.value),dt=>{const c=dt.cards.find(y=>y.id===x.dataset.setday);if(c)c.day=+x.value});toast("Đã xếp ngày đăng "+dd(+x.value));renderMain()});
}


/* ---------- Video không quay (Worker): bảng tiến độ thay cho khung tạo video ----------
   Việc được tạo khi giao ở ① Kế hoạch. Worker chưa nối với thẻ nên người phụ trách tự chạy Worker rồi dán link.
   Chưa làm → Đang làm → Đã gửi duyệt → Xong (được duyệt) */
const wkSt=c=>{if(["dang","xong"].includes(c.step))return "xong";if(["dkb","dvd","dceo"].includes(c.step))return "duyet";if(c.step==="worker"&&(c.wkBat||c.wt))return "lam";if(c.step==="kb"&&String(c.noiDung||"").trim())return "lam";return "chua"};
const WK_G=[["chua","Chưa làm"],["lam","Đang làm"],["duyet","Đã gửi duyệt"],["xong","Xong (được duyệt)"]];
function xvWorker2(b,o){
  const {d,W,give}=o,L=d.cards.filter(c=>o.onlyWt?(c.wt&&!c.wDone):(loaiOf(c)==="worker"||c.wt||c.mix==="outsource")&&(xvIn(c,W)||!c.day||c.wt&&!c.wDone)).sort((a,c)=>(a.han||99)-(c.han||99));
  const mine=c=>give||c.nguoi===ME.id||c.giao===ME.id;
  const lnk=v=>/^https?:/.test(v)?v:"https://"+v;
  const row=c=>{const st=wkSt(c),t=d.tuyen.find(x=>x.ma===c.maTuyen),late=isLate(c);
    const dv=can(ME,"viec.duyet")||ME.role==="admin",draft=c.wt&&c.step==="worker"&&c.wStatus==="review"&&c.wStage==="video";const act=draft?(mine(c)?`<a class="btn sm" href="/api/hub/worker-tasks/preview/${esc(c.wJob)}" target="_blank" rel="noopener">▶ Xem bản nháp</a><button class="btn sm pri" data-wkself="${c.id}">Duyệt, gửi Lead Content & Media</button><button class="btn sm" data-wkfix="${c.id}">Góp ý sửa</button><button class="btn sm" data-wkredo="${c.id}" title="Giữ kịch bản và giọng đọc, Worker chọn lại cảnh + chữ mới">Làm lại</button>`:`<span class="hint">chờ ${esc(userName(c.nguoi)||"người phụ trách")} kiểm tra bản nháp</span>`):c.wt&&c.wJob&&!c.wDone&&(c.wStatus==="error"||["dvd","dceo"].includes(c.step))&&(mine(c)||dv)?`${c.wStatus==="error"?`<span class="t-red">${esc(c.wDetail||"Worker báo lỗi")}</span>`:""}<button class="btn sm" data-wkredo="${c.id}" title="Giữ kịch bản và giọng đọc, Worker chọn lại cảnh + chữ mới">Làm lại</button>`:c.wt&&c.wStage==="script"&&c.wStatus==="review"?(`<button class="btn sm pri" onclick="bvScrOpen('${c.id}')">Xem kịch bản</button>`):!mine(c)?"":c.wt?"":st==="chua"&&c.step==="worker"?`<button class="btn sm pri" data-wsend="${c.id}">Gửi Worker dựng</button><button class="lnk" data-wkgo="${c.id}">Tự chạy Worker, dán link sau</button>`
      :st==="chua"&&c.step==="kb"?`<button class="btn sm" data-card="${c.id}">Viết kịch bản</button>`
      :c.step==="worker"&&!c.wt?`<input class="hkin" data-wkl="${c.id}" placeholder="${c.mix==="outsource"?"Dán link video bên outsource giao…":"Dán link video Worker dựng xong…"}" value="${esc(c.linkFinal||"")}">${late?`<input class="hkin tre" data-tre="${c.id}" placeholder="Trễ hạn: lý do trễ…">`:""}<button class="btn sm pri" data-wksend="${c.id}">Gửi duyệt</button>`
      :c.step==="kb"?`<button class="btn sm" data-card="${c.id}">Mở kịch bản</button>`:"";
    return `<tr><td>${swatch(c.sku)}<b>${esc(sk(c.sku).n)}</b><small>${esc(t?t.tuyen:c.tuyen||"")} · ${c.mix==="outsource"?"order outsource (bên ngoài làm)":loaiOf(c)==="worker"?(c.wkMode==="B"?"nhân sự viết kịch bản":"Worker viết kịch bản + voice"):({oneshot:"one shot",voice:"giọng AI đọc kịch bản",text:"đổi hook, chèn chữ",rebrand:"sửa / đổi thương hiệu"}[c.wMode]||LOAI_V[loaiOf(c)])}</small></td>
     <td>${esc(userName(c.giao||c.nguoi)||"—")}</td><td class="nowrap">${c.batDau?dd(c.batDau):"—"}</td><td>${hanTag(c)||"—"}</td>
     <td>${pill((WK_G.find(g=>g[0]===st)||[])[1],{chua:"gry",lam:"blu",duyet:"amb",xong:"grn"}[st])}${c.wt&&c.step==="worker"&&c.wStatus==="review"&&c.wStage==="video"?`<small class="t-amb">bản nháp chờ người phụ trách kiểm tra</small>`:c.step==="dceo"?`<small>chờ CEO duyệt</small>`:c.step==="dvd"?`<small>chờ duyệt</small>`:c.step==="dkb"?`<small>kịch bản chờ duyệt</small>`:""}</td>
     <td>${wkLine(c)||(c.linkFinal?`<a href="${esc(c.linkFinal.startsWith("/")?c.linkFinal:lnk(c.linkFinal))}" target="_blank" rel="noopener">▶ Xem video</a>`:`<span class="hint">chưa có</span>`)}</td><td class="wkact">${act}</td></tr>`};
  const OWC=CHANNELS.filter(ch=>L.some(c=>c.kenh===ch.k)||d.cards.some(c=>c.mix==="reup"&&c.step==="kb"&&c.kenh===ch.k));
  if(!OW_K||!OWC.some(c=>c.k===OW_K))OW_K=(OWC[0]||{}).k||"";
  const LK=L.filter(c=>c.kenh===OW_K),ORD=WK_G.map(g=>g[0]);
  const owTabs=OWC.length?`<div class="seg ptk">${OWC.map(ch=>`<button data-owk="${esc(ch.k)}" class="${ch.k===OW_K?"on":""}">${esc(ch.short)} <span class="xbadge">${L.filter(c=>c.kenh===ch.k&&wkSt(c)!=="xong").length}</span></button>`).join("")}</div>`:"";
  const OWG=xvGroupBy(LK,c=>c.sku);
  if(!OW_AUTO.has(OW_K)&&OWG[0]){OW_AUTO.add(OW_K);OW_OPEN.add(OWG[0][0]+"|"+OW_K)} // mở sẵn sản phẩm đầu tiên một lần, sau đó bấm tên sản phẩm để gập / mở
  b.innerHTML=`${owTabs}<section class="card"><div class="card-h"><h2>${o.onlyWt?"Worker đang dựng":"Order Worker"}${OW_K?" · "+esc(chOf(OW_K).short):""}</h2><span class="hint">${LK.length} video · chọn kênh ở trên, trong kênh chia theo sản phẩm · Worker dựng xong thì người phụ trách xem bản nháp, bấm "Duyệt, gửi Lead Content & Media" hoặc "Góp ý sửa"</span></div>
   <div class="wksum">${WK_G.map(([k,t])=>`<span class="xqi${LK.filter(c=>wkSt(c)===k).length&&k!=="xong"?" hot":""}"><b class="numeric">${LK.filter(c=>wkSt(c)===k).length}</b><span>${t}</span></span>`).join("")}</div></section>
  ${OWG.map(([sku,G])=>{const owk=sku+"|"+OW_K,owop=OW_OPEN.has(owk);G.sort((a,c)=>ORD.indexOf(wkSt(a))-ORD.indexOf(wkSt(c))||(a.han||99)-(c.han||99));return `<section class="card flush"><div class="card-h pad clk" data-owo="${esc(owk)}"><i class="ptar">${owop?"▾":"▸"}</i>${swatch(sku)}<h2>${esc(sk(sku).n)}</h2><span class="hint">${G.length} video · ${WK_G.filter(g=>G.some(c=>wkSt(c)===g[0])).map(g=>G.filter(c=>wkSt(c)===g[0]).length+" "+g[1].toLowerCase()).join(" · ")}</span></div>${owop?`<div class="tbl"><table class="wktab"><thead><tr><th>Tuyến · cách làm</th><th>Phụ trách</th><th>Ngày giao</th><th>Hạn</th><th>Tiến độ</th><th>Link video</th><th></th></tr></thead><tbody>${G.map(row).join("")}</tbody></table></div>`:""}</section>`}).join("")||`<section class="card"><p class="empty">Kênh này chưa có video Worker trong kỳ. Giao ở ① Kế hoạch › Không quay · Worker.</p></section>`}`;
  b.querySelectorAll("[data-owo]").forEach(h=>h.onclick=e=>{if(e.target.closest("button,a,input,select"))return;const k=h.dataset.owo;OW_OPEN.has(k)?OW_OPEN.delete(k):OW_OPEN.add(k);renderMain()});
  b.querySelectorAll("[data-owk]").forEach(x=>x.onclick=()=>{OW_K=x.dataset.owk;renderMain()});

  b.querySelectorAll("[data-wkself]").forEach(x=>x.onclick=()=>{const c=D().cards.find(y=>y.id===x.dataset.wkself);const e=moveCard(ME,c.id,"dvd",{linkFinal:"/api/hub/worker-tasks/preview/"+c.wJob});toast(e||"Đã gửi duyệt");renderMain()});
  b.querySelectorAll("[data-wkfix]").forEach(x=>x.onclick=async()=>{const n=prompt("Cần Worker sửa gì? (vd: đổi hook mạnh hơn, thay cảnh đầu)");if(!n||!n.trim())return;const c=D().cards.find(y=>y.id===x.dataset.wkfix);const er=await wkTask("card_fix",c,{note:n.trim()});if(er){toast("Chưa gửi được: "+er);return}DB.mutate(ME.name,`góp ý Worker sửa ${c.id}: ${n.trim()}`,dt=>{const y=dt.cards.find(z=>z.id===c.id);if(!y)return;y.wStage="";y.wStatus="running";y.wDetail="Worker đang dựng lại theo góp ý";y.wFixAt=new Date().toISOString();y.linkFinal="";y.gopy=(y.gopy||[]).concat({t:new Date().toLocaleString("vi-VN"),who:ME.name,note:n.trim()})});toast("Đã gửi góp ý, Worker dựng lại");renderMain()});
  b.querySelectorAll("[data-wkredo]").forEach(x=>x.onclick=()=>wkRedo(x.dataset.wkredo,x));
  b.querySelectorAll("[data-wkscok]").forEach(x=>x.onclick=async()=>{const c=D().cards.find(y=>y.id===x.dataset.wkscok);const er=await wkTask("card_script_ok",c);toast(er||"Đã duyệt kịch bản, Worker tạo giọng và ghép cảnh");DB.mutate(ME.name,"duyệt kịch bản Worker "+c.id,dt=>{const y=dt.cards.find(z=>z.id===c.id);if(y){y.wStage="";y.wStatus="running";y.wDetail="Kịch bản đã duyệt, Worker đang tạo giọng + ghép cảnh";y.wFixAt=new Date().toISOString()}});renderMain()});
  b.querySelectorAll("[data-wkscfix]").forEach(x=>x.onclick=async()=>{const n=prompt("Cần sửa kịch bản thế nào?");if(!n||!n.trim())return;const c=D().cards.find(y=>y.id===x.dataset.wkscfix);const er=await wkTask("card_script_fix",c,{note:n.trim()});toast(er||"Đã gửi góp ý, Worker viết lại kịch bản");DB.mutate(ME.name,"sửa kịch bản Worker "+c.id,dt=>{const y=dt.cards.find(z=>z.id===c.id);if(y){y.wStage="";y.wStatus="running";y.wDetail="Worker đang viết lại kịch bản theo góp ý";y.wFixAt=new Date().toISOString()}});renderMain()});
  b.querySelectorAll("[data-wkgo]").forEach(x=>x.onclick=()=>{DB.mutate(ME.name,"bắt đầu chạy Worker "+x.dataset.wkgo,dt=>{const c=dt.cards.find(y=>y.id===x.dataset.wkgo);if(c)c.wkBat=dt.settings.today});toast("Đã chuyển sang Đang làm");renderMain()});
  b.querySelectorAll("[data-wksend]").forEach(x=>x.onclick=()=>{const id=x.dataset.wksend,l=b.querySelector(`[data-wkl="${id}"]`).value.trim(),tr=b.querySelector(`[data-tre="${id}"]`);if(!l){toast("Dán link video Worker dựng xong trước");return}const e=moveCard(ME,id,"dvd",{linkFinal:l,lyDoTre:tr?tr.value.trim():undefined});toast(e||"Đã gửi duyệt");renderMain()});
}


/* ---------- Nối Worker (máy dựng ở văn phòng) cho thẻ video ----------
   One shot / review sau khi quay (④ Edit): chọn người edit hoặc Gửi Worker (giữ tiếng quay, hoặc giọng AI đọc kịch bản)
   Reup: Gửi Worker đổi hook, chèn chữ hoặc sửa / đổi thương hiệu · Không quay: giọng đọc từ kho cảnh (Worker viết hoặc kịch bản có sẵn)
   Worker có bản nháp → thẻ sang người duyệt video (xem bản nháp ngay trên web) → CEO duyệt → Worker lưu Drive, link về thẻ.
   Góp ý sửa ở web → Worker dựng lại. Worker tự hỏi web 15 giây/lần nên máy văn phòng phải bật. */
const W_SKU={BT:"tay-van-nang",TD:"tinh-dau-giat-say",XM:"xit-muoi",XR:"xit-ruoi",SAP:"sap-thom"};
const W_PACK={BT:[["hu-450g","Hũ 450g"],["chai-250g","Chai 250g"]]};
const W_CH={"TikTok chính":"tiktok_main","TikTok Via 1":"tiktok_via_1","TikTok Via 2":"tiktok_via_2","Fanpage chính":"facebook_page"};
const W_VOICE=[["adam","Adam"],["anh-thu","Anh Thư"],["an-nhien","An Nhiên"],["cam-hong","Cẩm Hồng"],["tham","Thắm"],["ngan","Ngân"],["my","My"]];
const wkKind=c=>{const L=loaiOf(c);if(L==="worker")return "voice";if(c.mix==="reup"||L==="reup")return "reup";if(["edit","quay"].includes(c.step)&&L==="moi")return c.oneShot?"oneshot":"review";return ""};
const wkCan=c=>!!wkKind(c)&&!c.wt&&["edit","kb","worker"].includes(c.step)&&(xvGive()||c.nguoi===ME.id||c.giao===ME.id);
function openWorkerSend(id){
  const c=D().cards.find(x=>x.id===id);if(!c)return;const k=wkKind(c),t=D().tuyen.find(x=>x.ma===c.maTuyen),pl=t&&(D().pillars||[]).find(p=>p.sku===c.sku&&p.kenh===c.kenh);
  const modes=k==="oneshot"?[["oneshot","Dựng one shot (cắt vấp, tăng tốc, chỉnh màu, cảnh trám, hook, chữ)"]]
    :k==="review"?[["oneshot","Giữ tiếng trong video quay, Worker cắt và chèn chữ"],["voice","Giọng AI đọc kịch bản, ghép cảnh vừa quay"]]
    :k==="reup"?[["text","Đổi hook, chèn chữ (giữ nguyên hình và tiếng)"],["rebrand","Sửa / đổi thương hiệu (cắt đoạn có tên thương hiệu cũ)"]]
    :[["voice","Giọng đọc từ kho cảnh"]];
  const needScript=k==="voice"&&c.wkMode==="B";
  $("#drawerIn").innerHTML=`<div class="dh"><h2>Gửi Worker dựng</h2><button class="btn sm" id="dx">Đóng</button></div>
   <p class="hint"><span class="mono">${c.id}</span> · ${esc(sk(c.sku).n)} · ${esc(chOf(c.kenh).short)}${t?" · tuyến "+esc(t.tuyen):""}</p>
   ${W_SKU[c.sku]?"":`<div class="warn">Worker chưa có sản phẩm ${esc(sk(c.sku).n)} trong kho cảnh. ${k==="reup"?"Chỉ dùng được kiểu đổi hook, chèn chữ.":"Chưa gửi được, giao người edit."}</div>`}
   <div class="frm kfrm">
    <label class="field full">Worker làm<select id="ws-m">${opt(modes,modes[0][0])}</select></label>
    <label class="field full" id="ws-lk">Link Google Drive <small id="ws-lkh"></small><input id="ws-l" value="${esc(c.linkVideo||"")}" placeholder="Dán link video (hoặc thư mục) trên Drive"></label>
    ${W_PACK[c.sku]?`<label class="field">Bao bì<select id="ws-p">${opt(W_PACK[c.sku],W_PACK[c.sku][0][0])}</select></label>`:""}
    <label class="field" id="ws-vw">Giọng đọc<select id="ws-v">${opt(W_VOICE,"adam")}</select></label>
    <label class="field full">Hook (0–3 giây đầu)<input id="ws-h" value="${esc(c.hookText||"")}" placeholder="Để trống thì Worker tự chọn"></label>
    <label class="field full" id="ws-sw">Kịch bản${needScript?" (bắt buộc)":" (có thì Worker đọc đúng kịch bản, trống thì Worker tự viết)"}<textarea id="ws-s" rows="5">${esc(c.noiDung||"")}</textarea></label>
    <label class="field full" id="ws-bw">Tên thương hiệu cũ cần bỏ (cách nhau dấu phẩy)<input id="ws-bn"><span><input type="checkbox" id="ws-own" style="width:auto"> Video thuộc Ailla / được phép dùng lại</span></label>
    <label class="field full">Ghi chú cho Worker<input id="ws-n" placeholder="vd: nhịp nhanh, nhấn mạnh an toàn cho bé"></label>
   </div><div class="acts"><button class="btn pri" id="ws-go">Gửi Worker</button></div>`;
  $("#drawer").hidden=false;$("#dx").onclick=closeDrawer;
  const sync=()=>{const m=$("#ws-m").value;$("#ws-vw").hidden=m!=="voice";$("#ws-sw").hidden=m!=="voice";$("#ws-bw").hidden=m!=="rebrand";$("#ws-lkh").textContent=m==="voice"?"(thư mục cảnh, để trống thì Worker lấy trong kho cảnh)":"(video gốc / video vừa quay)"};$("#ws-m").onchange=sync;sync();
  $("#ws-go").onclick=async()=>{const m=$("#ws-m").value,link=$("#ws-l").value.trim(),script=$("#ws-s").value.trim();
    if(m!=="text"&&!W_SKU[c.sku]){toast("Worker chưa có sản phẩm này");return}
    if(m!=="voice"&&!/drive\.google\.com/.test(link)){toast("Dán link video trên Google Drive");$("#ws-l").focus();return}
    if(m==="voice"&&link&&!/drive\.google\.com\/drive\/(u\/\d+\/)?folders\//.test(link)){toast("Giọng đọc: link phải là THƯ MỤC cảnh trên Drive (hoặc để trống)");return}
    if(needScript&&!script){toast("Cách làm này cần kịch bản nhân sự viết");return}
    const brief=[t&&("Tuyến: "+t.tuyen),t&&t.vaiTro&&("Vai trò: "+t.vaiTro),pl&&pl.idea&&("Big idea: "+pl.idea),c.yTuong&&!/^(Viết|Chọn|Tìm)/.test(c.yTuong)&&("Ý tưởng: "+c.yTuong)].filter(Boolean).join("\n");
    const order={mode:m,sku:W_SKU[c.sku]||"",packaging:($("#ws-p")||{}).value||"",link,hook:$("#ws-h").value.trim(),note:$("#ws-n").value.trim(),
      video_type:k==="reup"?"reup":"new_shoot",publish_channel:W_CH[c.kenh]||"other"};
    if(m==="voice"){order.voice=$("#ws-v").value;order.script=script;order.brief=brief||("Video "+sk(c.sku).n);}
    if(m==="rebrand"){order.ban_names=$("#ws-bn").value;order.owned=$("#ws-own").checked}
    try{const r=await svApi("/api/hub/worker-tasks",{method:"POST",body:JSON.stringify({kind:"card_build",ref:c.id,payload:{order,card:c.id,by:ME.name,tg:ME.role==="admin"?"chi":ME.name,owner:userName(chanOwner(c.kenh))||"",label:`${sk(c.sku).n}${t?" · "+t.tuyen:""} · ${c.id}`}})});
      DB.mutate(ME.name,"gửi Worker dựng "+c.id,dt=>{const x=dt.cards.find(y=>y.id===c.id);if(!x)return;x.wt=r.id;x.wMode=m;x.wStatus="queued";x.wDetail="Chờ máy văn phòng nhận việc";x.wDone=false;x.step="worker";x.nguoiDung="Worker";if(link&&!x.linkVideo)x.linkVideo=link;if(order.hook)x.hookText=x.hookText||order.hook;if(script)x.noiDung=script;if(!x.han)x.han=Math.min(MONTH.ndays,dt.settings.today+1)});
      closeDrawer();toast("Đã gửi Worker. Máy văn phòng nhận việc trong khoảng 15 giây");renderMain()}catch(e){toast("Chưa gửi được: "+e.message)}};
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-wsend]");if(!b)return;e.preventDefault();e.stopPropagation();openWorkerSend(b.dataset.wsend)},true);
/* gửi lệnh duyệt / sửa sang Worker */
async function wkTask(kind,c,extra){try{await svApi("/api/hub/worker-tasks",{method:"POST",body:JSON.stringify({kind,ref:c.wt,payload:Object.assign({worker_job:c.wJob,by:ME.name,video_type:loaiOf(c)==="reup"?"reup":"new_shoot",channel:W_CH[c.kenh]||"other"},extra||{})})});return ""}catch(e){return e.message}}
/* CEO duyệt xong (sang Chờ đăng) → Worker lưu thành phẩm lên Drive */
const _mvWk=moveCard;
moveCard=function(u,id,to,inp){const c=D().cards.find(x=>x.id===id),from=c&&c.step;const e=_mvWk(u,id,to,inp);
  if(!e&&c&&from==="dvd"&&to==="dceo"){const t=D().tuyen.find(x=>x.ma===c.maTuyen);svApi("/api/hub/worker-tasks",{method:"POST",body:JSON.stringify({kind:"card_notify",ref:c.id,payload:{to:["chi"],text:`🎬 Video chờ CEO duyệt: ${sk(c.sku).n}${t?" · "+t.tuyen:""} · ${chOf(c.kenh).short} (${c.id}). ${u.name} đã duyệt.`}})}).catch(()=>{})}
  if(!e&&c&&c.wJob&&!c.wDone&&from==="dceo"&&to==="dang"){wkTask("card_ok",c).then(er=>{if(er)toast("Chưa báo được Worker lưu Drive: "+er)});DB.mutate(u.name,"Worker lưu Drive "+id,dt=>{const x=dt.cards.find(y=>y.id===id);if(x){x.wDetail="Đã duyệt, Worker đang lưu thành phẩm lên Drive"}})}
  return e};
/* Góp ý sửa video Worker dựng → Worker dựng lại */
const _sbWk=sendBack;
sendBack=function(u,id,note){const c=D().cards.find(x=>x.id===id);if(c&&c.wJob&&["dvd","dceo"].includes(c.step)){wkTask("card_fix",c,{note:note||"Cần sửa"}).then(er=>{if(er)toast("Chưa gửi được góp ý cho Worker: "+er)});
  DB.mutate(u.name,`góp ý Worker sửa ${id}: ${note||""}`,dt=>{const x=dt.cards.find(y=>y.id===id);if(!x)return;x.step="worker";x.wStatus="running";x.wDetail="Worker đang dựng lại theo góp ý";x.wFixAt=new Date().toISOString();x.gopy=(x.gopy||[]).concat({t:new Date().toLocaleString("vi-VN"),who:u.name,note:note||"Cần sửa"})});return}
  return _sbWk(u,id,note)};
/* Đồng bộ tiến độ Worker về thẻ (mở trang là cập nhật, tối đa 20 giây/lần) */
let WT_AT=0,WT_BUSY=false;
async function wtSync(){if(WT_BUSY||Date.now()-WT_AT<20000||!DB.data)return;const C=D().cards.filter(c=>c.wt&&!c.wDone);if(!C.length)return;WT_BUSY=true;WT_AT=Date.now();
  try{const L=await svApi("/api/hub/worker-tasks?kind=card"),by={};(L||[]).forEach(t=>by[t.id]=t);const ch=[];
    C.forEach(c=>{const t=by[c.wt];if(!t)return;const r=t.result||{},u={wStatus:t.status,wProg:t.progress||0,wDetail:t.detail||"",wJob:t.worker_job||c.wJob||"",wStage:r.stage||"",wScript:r.script||"",wHadScr:c.wHadScr||!!r.script};
      const fresh=!c.wFixAt||String(t.updated_at||"")>c.wFixAt;if(!fresh){u.wStatus="running";u.wDetail=c.wDetail;u.wStage=""}
      if(fresh&&t.status==="running"&&["dvd","dceo"].includes(c.step)){u.step="worker";u.linkFinal=""} // dựng lại từ Telegram / trang Worker: về Đang làm
      if(fresh&&t.status==="review"&&r.stage==="video"&&c.step==="worker"){u.linkFinal="/api/hub/worker-tasks/preview/"+u.wJob} // bản nháp: người phụ trách xem, bấm Duyệt thì mới sang Lead Content & Media
      if(t.status==="done"&&r.drive_url){u.linkFinal=r.drive_url;u.wDone=true}
      if(Object.keys(u).some(k=>String(c[k]??"")!==String(u[k]??"")))ch.push([c.id,u])});
    if(ch.length){DB.mutate("Worker","cập nhật tiến độ Worker",dt=>ch.forEach(([id,u])=>{const x=dt.cards.find(y=>y.id===id);if(!x)return;const was=x.wStatus==="review"&&x.wStage;Object.assign(x,u);if(!was&&x.wStatus==="review"&&x.wStage&&typeof notifyU==="function")notifyU(dt,[x.nguoi||x.giao],(x.wStage==="script"?"Worker viết xong kịch bản, chờ duyệt: ":"Worker dựng xong bản nháp, vào xem và bấm Duyệt, gửi Lead Content & Media: ")+cardLbl(x),x.id)}));if(!(typeof svTyping==="function"&&svTyping()))renderMain()}}
  catch(e){}finally{WT_BUSY=false}}
setInterval(()=>{if(typeof ME!=="undefined"&&ME&&typeof PAGE!=="undefined"&&["kehoach","mkt_tq","xepviec","dieuphoi","lich"].includes(PAGE))wtSync()},20000);
/* dòng tiến độ Worker trên thẻ / danh sách */
const wkLine=c=>!c.wt?"":`<span class="wkln ${c.wStatus==="error"?"t-red":""}">🤖 ${c.wDone?"Đã lưu Drive":esc(c.wDetail||"Đã gửi Worker")}${c.wStatus==="running"&&c.wProg?` · ${c.wProg}%`:""}${c.wJob&&!c.wDone&&["dvd","dceo"].includes(c.step)?` · <a href="/api/hub/worker-tasks/preview/${esc(c.wJob)}" target="_blank" rel="noopener">▶ bản nháp</a>`:""}${c.wDone&&c.linkFinal?` · <a href="${esc(c.linkFinal)}" target="_blank" rel="noopener">▶ thành phẩm</a>`:""}</span>`;


/* "Làm lại": Worker edit lại chính order đó (giữ kịch bản đã duyệt + giọng đọc, chọn lại cảnh + chữ mới, không dùng lại cảnh cũ).
   Gửi card_redo theo ref = việc card_build gốc; chờ Worker trả lời để báo người bấm (order đang dựng dở / đã duyệt thì Worker từ chối kèm lý do). */
async function wkRedo(id,btn){
  const c=D().cards.find(x=>x.id===id);if(!c||!c.wt||!c.wJob){toast("Thẻ này chưa có order Worker");return}
  if(btn){btn.disabled=true;btn.textContent="Đang gửi…"}
  let tid;try{tid=(await svApi("/api/hub/worker-tasks",{method:"POST",body:JSON.stringify({kind:"card_redo",ref:c.wt,payload:{worker_job:c.wJob,by:ME.name}})})).id}catch(e){toast("Chưa gửi được: "+e.message);renderMain();return}
  toast("Đã gửi Worker làm lại "+c.wJob+", chờ máy văn phòng nhận (khoảng 15 giây)…");
  for(let i=0;i<16;i++){await new Promise(r=>setTimeout(r,5000));let t;try{t=((await svApi("/api/hub/worker-tasks?kind=card"))||[]).find(x=>x.id===tid)}catch(e){continue}
    if(!t)continue;
    if(t.status==="error"){toast("Worker không làm lại được: "+(t.detail||"không rõ lý do"));renderMain();return}
    if(t.status==="done"){DB.mutate(ME.name,"Worker làm lại "+c.wJob,dt=>{const y=dt.cards.find(z=>z.id===id);if(!y)return;y.step="worker";y.wStatus="running";y.wStage="";y.linkFinal="";y.wDetail=t.detail||"Worker đang làm lại từ đầu";y.wFixAt=new Date().toISOString()});toast(t.detail||"Worker đang làm lại");WT_AT=0;renderMain();return}}
  toast("Máy văn phòng chưa nhận việc làm lại. Kiểm tra máy có bật không, việc vẫn nằm chờ và sẽ chạy khi máy bật.");renderMain()}


/* ---------- ④ Edit (làm lại): Lead Content & Media giao theo SỐ LƯỢNG, ai edit xong video nào thì dán link video đó và gửi duyệt ----------
   Video quay xong nằm chung một chỗ; Lead Content & Media điền mỗi người bao nhiêu video rồi bấm Giao (chia lần lượt theo ngày quay).
   Người edit: mỗi video có ô dán link + Gửi duyệt (Lead Content & Media → chị). Lead Content & Media tự edit thì gửi thẳng CEO duyệt. */
const isApprover=u=>!!u&&u.role==="lead"&&(u.perms||[]).includes("viec.duyet");
const _mvEdit=moveCard;
moveCard=function(u,id,to,inp){const c=D().cards.find(x=>x.id===id),from=c&&c.step,e=_mvEdit(u,id,to,inp);
  if(!e&&from==="edit"&&to==="dvd"&&isApprover(u)){const e2=moveCard(u,id,"dceo",{});if(!e2)toast("Video Lead Content & Media tự edit: đã gửi thẳng CEO duyệt")}return e};
function xvEdit2(b,o){
  const {d,W,team,give}=o,today=d.settings.today;
  const pool=d.cards.filter(c=>c.step==="edit"&&!c.nguoiEdit&&!c.wt).sort((a,c)=>(a.qday||a.day||99)-(c.qday||c.day||99));
  const ed=d.cards.filter(c=>c.nguoiEdit&&!c.wt&&["edit","dvd","dceo"].includes(c.step));
  const doneW=u=>d.cards.filter(c=>c.nguoiEdit===u&&["dang","xong"].includes(c.step)&&xvIn(c,W)).length;
  const may=c=>give||c.nguoiEdit===ME.id;
  const prodG=xvGroupBy(pool,c=>c.sku);
  const row=c=>{const t=d.tuyen.find(x=>x.ma===c.maTuyen),late=isLate(c);return `<div class="edr${late?" late":""}">${swatch(c.sku)}<span class="xmt clk" data-card="${c.id}"><b>${esc(c.hookText||c.yTuong||c.id)}</b><small>${esc(sk(c.sku).n)}${t?" · "+esc(t.tuyen):""} · ${esc(chOf(c.kenh).short)}${c.oneShot?" · one shot":""}</small></span>${hanTag(c)}
    ${c.step==="edit"?(may(c)?`<input class="hkin" data-edl="${c.id}" placeholder="Dán link video đã edit (Drive)…" value="${esc(c.linkFinal||"")}">${late?`<input class="hkin tre" data-tre="${c.id}" placeholder="Trễ hạn: lý do trễ…">`:""}<button class="btn sm pri" data-edsend="${c.id}">Gửi duyệt</button>${typeof wkCan==="function"&&wkCan(c)?`<button class="btn sm" data-wsend="${c.id}">Gửi Worker</button>`:""}`:`<span class="hint">đang edit</span>`)
     :`${pill(c.step==="dvd"?"chờ duyệt":"chờ CEO duyệt","amb")}${(c.step==="dvd"&&can(ME,"viec.duyet")||c.step==="dceo"&&ME.role==="admin")?`<button class="btn sm pri" data-eddy="${c.id}">Duyệt</button><button class="btn sm" data-edtl="${c.id}">Trả lại</button>`:""}${c.linkFinal?`<a href="${esc(/^https?:/.test(c.linkFinal)?c.linkFinal:"https://"+c.linkFinal)}" target="_blank" rel="noopener">xem</a>`:""}`}
    ${give&&c.step==="edit"?`<select class="edmv" data-edmv="${c.id}" title="Chuyển cho người khác">${opt([["","Chuyển…"]].concat(team.filter(u=>u.id!==c.nguoiEdit).map(u=>[u.id,u.name])).concat([["__pool","Trả về chưa giao"]]),"")}</select>`:""}</div>`};
  b.innerHTML=`<section class="card"><div class="card-h"><h2>Video đã quay, chờ gửi và duyệt</h2><span class="hint">quay xong, tự order Worker qua Telegram (Review, One shot) hoặc tự edit · dán link video đã edit rồi bấm Gửi duyệt · người duyệt, CEO duyệt, video vào danh sách chờ đăng bên dưới</span></div>${pool.length&&give?`<p class="hint"><b>${pool.length}</b> video quay xong chưa có người phụ trách.</p><button class="btn pri" id="ed-auto">Giao về người viết hook</button>`:""}</section>
  <div class="edcols">${ed.length?"":"<p class=\"hint\">Chưa có video nào cần gửi.</p>"}${team.concat(D().users.filter(u=>!team.some(t2=>t2.id===u.id)&&ed.some(c=>c.nguoiEdit===u.id))).filter(u=>ed.some(c=>c.nguoiEdit===u.id)).map(u=>{const L=ed.filter(c=>c.nguoiEdit===u.id),e1=L.filter(c=>c.step==="edit"),wait=L.filter(c=>c.step!=="edit"),late=e1.filter(isLate).length;
    return `<section class="card edcol"><div class="card-h"><h2>${esc(u.name)}</h2><span class="hint">đang edit <b>${e1.length}</b>${late?` · <b class="t-red">${late} trễ</b>`:""} · chờ duyệt <b>${wait.length}</b> · đã duyệt tuần này <b>${doneW(u.id)}</b>${isApprover(u)?" · gửi thẳng CEO duyệt":""}</span></div>
     ${L.length?`<div class="edl">${e1.map(row).join("")}${wait.map(row).join("")}</div>`:`<p class="hint">Chưa có video edit.</p>`}</section>`}).join("")}</div>`;
  if($("#ed-auto"))$("#ed-auto").onclick=()=>{let n=0;DB.mutate(ME.name,"giao video quay xong về người viết hook",dt=>dt.cards.forEach(x=>{if(x.step==="edit"&&!x.nguoiEdit&&!x.wt){const o=x.nguoiKB||x.nguoi||x.giao;if(o){x.nguoiEdit=o;x.nguoi=o;n++}}}));toast("Đã giao "+n+" video về người viết hook");renderMain()};
  if($("#ed-go"))$("#ed-go").onclick=()=>{const sku=$("#ed-sku").value,han=+$("#ed-han").value,ask=[...b.querySelectorAll("[data-edn]")].map(i=>[i.dataset.edn,Math.max(0,+i.value||0)]).filter(z=>z[1]);if(!ask.length){toast("Điền số video cho ít nhất một người");return}
    const P=pool.filter(c=>!sku||c.sku===sku).map(c=>c.id),need=ask.reduce((a,z)=>a+z[1],0);if(need>P.length){toast(`Chỉ còn ${P.length} video chờ chia edit${sku?" của sản phẩm này":""}`);return}
    let i=0;const plan=ask.map(([u,n])=>[u,P.slice(i,i+=n)]);
    DB.mutate(ME.name,"chia edit: "+plan.map(([u,L])=>userName(u)+" "+L.length).join(", "),dt=>{plan.forEach(([u,L])=>L.forEach(id=>{const x=dt.cards.find(y=>y.id===id);if(!x)return;x.nguoiEdit=u;x.nguoi=u;x.batDau=dt.settings.today;x.han=han;x.tre=null}));if(typeof notifyU==="function")plan.forEach(([u,L])=>notifyU(dt,[u],`${ME.name} giao bạn edit ${L.length} video, hạn ${dd(han)}`,L[0]))});
    toast("Đã giao: "+plan.map(([u,L])=>userName(u)+" "+L.length).join(", "));renderMain()};
  b.querySelectorAll("[data-eddy]").forEach(x=>x.onclick=()=>{const c=D().cards.find(y=>y.id===x.dataset.eddy),nx=c&&nextAct(c);if(!nx)return;const e=moveCard(ME,c.id,nx[1]);toast(e||"Đã duyệt");renderMain()});
  b.querySelectorAll("[data-edtl]").forEach(x=>x.onclick=()=>{const n=prompt("Cần sửa gì? (ghi ngắn cho người làm)");if(n===null)return;sendBack(ME,x.dataset.edtl,n.trim()||"cần sửa");toast("Đã trả lại");renderMain()});
  b.querySelectorAll("[data-edsend]").forEach(x=>x.onclick=()=>{const id=x.dataset.edsend,l=b.querySelector(`[data-edl="${id}"]`).value.trim(),tr=b.querySelector(`[data-tre="${id}"]`);if(!l){toast("Dán link video đã edit trước");return}const e=moveCard(ME,id,"dvd",{linkFinal:l,lyDoTre:tr?tr.value.trim():undefined});if(e){toast(e);return}toast("Đã gửi duyệt");renderMain()});
  b.querySelectorAll("[data-edmv]").forEach(x=>x.onchange=()=>{const v=x.value,id=x.dataset.edmv;if(!v)return;DB.mutate(ME.name,v==="__pool"?"trả video về chưa giao edit "+id:"chuyển edit "+id+" cho "+userName(v),dt=>{const c=dt.cards.find(y=>y.id===id);if(!c)return;if(v==="__pool"){c.nguoiEdit="";c.nguoi="";c.han=0}else{c.nguoiEdit=v;c.nguoi=v;if(typeof notifyU==="function")notifyU(dt,[v],`${ME.name} chuyển cho bạn edit: ${c.hookText||c.id}`,id)}});renderMain()});
}

