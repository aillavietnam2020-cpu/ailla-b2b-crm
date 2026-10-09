/* =====================================================================
   KHO VIDEO ĐĂNG ĐƯỢC · ĐỦ VIDEO CHƯA · KHO CẢNH · CALENDAR THEO KỲ
   - ⑤: chỉ video đã qua Lead Content & Media + CEO duyệt mới vào kho đăng; người giữ kênh xếp ngày, dán link đăng.
     Mỗi video: link, SKU, ngày sản xuất, trạng thái, ngày đăng dự kiến / thực tế, link SP, view, CTR, GMV, đơn.
   - Nhịp đăng: so số video cần đăng (nhịp × số ngày) với số đã có sẵn + đang làm → báo thiếu.
   - Buổi quay: một link thư mục cảnh cho cả buổi, bấm "Lưu vào kho cảnh" (không kê từng cảnh).
   - Calendar: theo kỳ chọn (tuần này, tháng này, hoặc từ ngày đến ngày).
   ===================================================================== */
const KD_PIPE=["kb","dkb","quay","worker","edit","dvd","dceo"];
let KDV={k:"",s:"",t:"",q:""};
const kdFold=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/gi,"d").toLowerCase();
const kdLink=u=>u?(/^https?:/.test(u)?u:"https://"+u):"";
const kdSP=c=>c.linkSP||((D().settings.linkSP||{})[c.sku])||"";
const kdSX=c=>c.ngaySX||0;
const kdST=c=>{const t=D().settings.today;if(c.step==="xong")return ["Đã đăng","grn"];if(!c.day)return ["Chờ xếp ngày","amb"];if(c.day<t)return ["Quá ngày, chưa đăng","red"];return ["Đã lên lịch","blu"]};
/* ngày sản xuất = ngày CEO duyệt xong (vào kho đăng) */
const _mvSX=moveCard;
moveCard=function(u,id,to,inp){const e=_mvSX(u,id,to,inp);if(!e&&to==="dang"){const c=D().cards.find(x=>x.id===id);if(c&&!c.ngaySX)DB.mutate(u.name,"ghi ngày sản xuất "+id,dt=>{const x=dt.cards.find(y=>y.id===id);if(x&&!x.ngaySX)x.ngaySX=dt.settings.today})}return e};

/* Đủ video chưa: từng kênh, từ hôm nay đến hết kỳ đang xem */
function kdDu(d,W){
  const today=d.settings.today,a=Math.max(today,W.tu),z=Math.max(a,W.den),n=z-a+1;
  return CHANNELS.map(ch=>{let can=0;for(let x=a;x<=z;x++)can+=nhipOf(ch.k,x);
    const ready=d.cards.filter(c=>c.kenh===ch.k&&c.step==="dang"&&(!c.day||c.day>=a)).length,
      DL=d.cards.filter(c=>c.kenh===ch.k&&KD_PIPE.includes(c.step)),doing=DL.length,thieu=Math.max(0,can-ready),
      KD_ST={kb:"đang viết kịch bản",dkb:"chờ duyệt kịch bản",quay:"chờ quay",worker:"Worker đang dựng",edit:"đang edit",dvd:"chờ duyệt",dceo:"chờ CEO duyệt"},
      tach=Object.keys(KD_ST).map(k=>[KD_ST[k],DL.filter(c=>c.step===k).length]).filter(x=>x[1]).map(x=>x[1]+" "+x[0]).join(", ");
    return {ch,a,z,n,can,ready,doing,thieu,tach,conThieu:Math.max(0,thieu-doing)}});
}

xvDang2=function(b,o){
  const {d,W,give}=o,today=d.settings.today,N=d.settings.nhip||{},R=kdDu(d,W);
  const days=Array.from({length:MONTH.ndays},(_,i)=>[i+1,dd(i+1)]);
  const D7=[];for(let x=Math.max(today,W.tu);x<=Math.min(MONTH.ndays,Math.max(today,W.tu)+6);x++)D7.push(x);
  /* ---- 1. nhịp đăng + đủ video chưa ---- */
  const nhCard=`<section class="card"><div class="card-h"><h2>Nhịp đăng & đủ video chưa</h2><span class="hint">nhịp = số video <b>đăng mỗi ngày</b> trên kênh · tính từ hôm nay ${dd(today)} đến ${dd(R[0].z)} (theo kỳ chọn ở trên)</span></div>
   <div class="kdu">${R.map(r=>{const gd=(N[r.ch.k]||[]);return `<div class="kduk${r.thieu?" bad":" ok"}">
     <div class="kduh"><b>${esc(r.ch.short)}</b><small>giữ kênh: ${esc(userName(chanOwner(r.ch.k))||"chưa đặt")}</small></div>
     <div class="kdun"><span><small title="Cần đăng">Cần đăng</small><b>${r.can}</b></span><span><small title="Đã duyệt, sẵn đăng">Đã duyệt</small><b>${r.ready}</b></span><span><small title="Đang làm, chưa duyệt">Đang làm</small><b>${r.doing}</b></span><span><small>Thiếu</small><b class="${r.thieu?"t-red":"t-grn"}">${r.thieu}</b></span></div>
     <div class="kdumsg">${!r.thieu?"✓ Đủ video đã duyệt để đăng.":r.conThieu?`⚠ Thiếu ${r.thieu} video đã duyệt. Kể cả ${r.doing} video đang làm xong hết vẫn còn thiếu ${r.conThieu}: cần lên thêm lịch sản xuất (buổi quay, Worker, reup).`:`⚠ Thiếu ${r.thieu} video đã duyệt. Có ${r.doing} video đang làm: phải làm xong và duyệt kịp trước ngày đăng mới đủ.`}</div>
     ${r.doing?`<small class="hint">Đang làm gồm: ${esc(r.tach)}</small>`:""}
     <div class="kdug"><small>Mặc định ${slotsOf()[r.ch.k]||0} video/ngày</small>${gd.map((g,i)=>`<div class="nhr">${dd(g.tu)} → ${dd(g.den)}: <b>${g.sl}</b> video/ngày × ${g.den-g.tu+1} ngày = <b>${g.sl*(g.den-g.tu+1)}</b> video${give?` <button class="lnk danger" data-nhx="${esc(r.ch.k)}|${i}" title="Bỏ giai đoạn">✕</button>`:""}</div>`).join("")}</div>
     ${give?`<details class="nhadd" data-nhk="${esc(r.ch.k)}"><summary>+ Thêm giai đoạn đăng dày / thưa</summary><div class="nhaddf">Từ <select class="a">${opt(days,today)}</select> đến <select class="z">${opt(days,Math.min(MONTH.ndays,today+5))}</select> mỗi ngày <input type="number" min="0" class="n num" placeholder="số"> video <button class="btn sm" data-nhadd="${esc(r.ch.k)}">Lưu</button></div><small class="hint">Ví dụ trước sale 10/10 đăng 6 video/ngày, sau đó về 3.</small></details>`:""}
   </div>`}).join("")}</div></section>`;
  /* ---- 2. kho video đăng được ---- */
  const a=Math.max(1,W.tu),z=W.den;
  let L=d.cards.filter(c=>c.step==="dang"||(c.step==="xong"&&(c.ngayDang||c.day)>=a&&(c.ngayDang||c.day)<=z));
  const tot={cho:L.filter(c=>c.step==="dang"&&!c.day).length,lich:L.filter(c=>c.step==="dang"&&c.day).length,da:L.filter(c=>c.step==="xong").length};
  L=L.filter(c=>(!KDV.k||c.kenh===KDV.k)&&(!KDV.s||c.sku===KDV.s)&&(!KDV.t||kdST(c)[0]===KDV.t)).sort((p,q)=>(p.step==="xong")-(q.step==="xong")||(p.day||99)-(q.day||99)||(kdSX(q)-kdSX(p)));
  const mayK=c=>give||chanOwner(c.kenh)===ME.id;
  const dayOpts=c=>[["","Chọn ngày"]].concat(Array.from({length:MONTH.ndays-today+1},(_,i)=>today+i).map(x=>[x,dayLbl(x)+" · "+d.cards.filter(y=>y.kenh===c.kenh&&y.day===x).length+"/"+nhipOf(c.kenh,x)]));
  const win=d.settings.winnerOrders||100;
  const row=c=>{const s=kdST(c),lk=c.linkFinal||c.linkVideo,sp=kdSP(c),ctr=c.view?(c.click||0)/c.view*100:0,m=mayK(c);
    return `<tr class="${s[1]==="red"?"late":""}"><td class="wide"><span class="clk" data-card="${c.id}"><b>${esc(c.hookText||c.yTuong||c.tuyen||"(chưa có tên)")}</b></span><small class="mono">${c.id} · ${esc(chOf(c.kenh).short)}${c.nguoiEdit?" · edit: "+esc(userName(c.nguoiEdit)):""}</small></td>
     <td>${lk?`<a href="${esc(kdLink(lk))}" target="_blank" rel="noopener">xem video</a>`:`<span class="hint">—</span>`}</td>
     <td>${swatch(c.sku)}${esc(sk(c.sku).n)}</td>
     <td class="n">${kdSX(c)?dd(kdSX(c)):"—"}</td>
     <td>${pill(s[0],s[1])}</td>
     <td>${c.step==="dang"&&m?`<select data-kdday="${c.id}">${opt(dayOpts(c),c.day||"")}</select>`:(c.day?dayLbl(c.day):"—")}</td>
     <td>${c.step==="xong"?`${dd(c.ngayDang)}${c.linkDang?` · <a href="${esc(kdLink(c.linkDang))}" target="_blank" rel="noopener">bài đăng</a>`:""}`:m?`<span class="kdpost"><input data-kdl="${c.id}" placeholder="${chOf(c.kenh).needId?"Dán link TikTok đã đăng":"Dán link bài đã đăng"}"><button class="btn sm pri" data-kdp="${c.id}">Đã đăng</button></span>`:"—"}</td>
     <td class="kdsp">${c.spTT?`<span title="${esc(c.spTT)}">${esc(c.spTT.slice(0,40))}${c.spTT.length>40?"…":""}</span>`:`<span class="hint">—</span>`}</td>
     <td class="n">${c.view?nf(c.view):"—"}</td><td class="n">${c.view?ctr.toFixed(1)+"%":"—"}</td><td class="n">${c.gmv?money(c.gmv):"—"}</td><td class="n">${c.don?`<b class="${c.don>=win?"t-grn":""}">${nf(c.don)}</b>${c.don>=win?" 🏆":""}`:"—"}</td></tr>`};
  const kho=`<section class="card flush"><div class="card-h pad"><h2>Đã lên lịch & đã đăng</h2><span class="hint">video đã duyệt · ${tot.cho} chờ xếp ngày · ${tot.lich} đã lên lịch · ${tot.da} đã đăng trong kỳ</span>${give?`<span class="sp"></span><button class="btn sm" id="hot-open">🔥 Đẩy sản phẩm đang lên xu hướng</button>`:""}</div>
   <div class="filters pad"><div class="seg">${[["","Tất cả kênh"]].concat(CHANNELS.map(c=>[c.k,c.short])).map(([k,t])=>`<button class="${KDV.k===k?"on":""}" data-kdk="${esc(k)}">${esc(t)}</button>`).join("")}</div>
    <select id="kd-s">${opt([["","Mọi sản phẩm"]].concat(skOpts()),KDV.s)}</select><select id="kd-t">${opt([["","Mọi trạng thái"],"Chờ xếp ngày","Đã lên lịch","Quá ngày, chưa đăng","Đã đăng"],KDV.t)}</select></div>

   ${L.length?`<div class="tbl"><table class="kdt"><thead><tr><th>Video</th><th>Link video</th><th>SKU</th><th class="n">Ngày sản xuất</th><th>Trạng thái</th><th>Ngày đăng dự kiến</th><th>Ngày đăng thực tế</th><th>SP gắn giỏ</th><th class="n">View</th><th class="n">CTR</th><th class="n">GMV</th><th class="n">Đơn/tháng</th></tr></thead><tbody>${L.slice(0,200).map(row).join("")}</tbody></table></div>`:`<p class="empty pad">Chưa có video nào được duyệt xong. Video edit xong → người duyệt → CEO duyệt thì mới vào kho này.</p>`}
   <p class="hint pad">Người giữ kênh tự chọn ngày đăng (số cạnh ngày là đã xếp / nhịp đăng). Đăng xong dán link vào ô "Ngày đăng thực tế" và bấm Đã đăng. Sản phẩm gắn giỏ, view, CTR, GMV, đơn tự nhảy khi nhập báo cáo TikTok (Đo lường › Nhập báo cáo, file Video Performance List), không phải điền tay. CTR = lượt nhấp sản phẩm / view. 🏆 = từ ${win} đơn trở lên (video win).</p></section>`;
  const t7=`<section class="card flush"><div class="card-h pad"><h2>7 ngày tới</h2><span class="hint">đã xếp / nhịp đăng</span></div><div class="tbl"><table><thead><tr><th>Kênh</th>${D7.map(x=>`<th class="n">${dayLbl(x)}</th>`).join("")}</tr></thead><tbody>${CHANNELS.map(ch=>`<tr><td><b>${esc(ch.short)}</b></td>${D7.map(x=>{const I=d.cards.filter(c=>c.kenh===ch.k&&c.day===x),cap=nhipOf(ch.k,x);return `<td class="n"><b class="${I.length<cap?"t-red":I.length===cap&&cap?"t-grn":""}">${I.length}</b>/${cap}<small>${esc(xvGroupBy(I,c=>c.sku).map(([k,l])=>sk(k).n.split(" ")[0]+" "+l.length).join(", "))}</small></td>`}).join("")}</tr>`).join("")}</tbody></table></div></section>`;
  b.innerHTML=kdPick(d,give)+kho+t7;kdPickBind(b);
  b.querySelectorAll("[data-nhadd]").forEach(x=>x.onclick=()=>{const k=x.dataset.nhadd,f=x.closest(".nhadd"),a2=+f.querySelector(".a").value,z2=+f.querySelector(".z").value,ni=f.querySelector(".n");if(ni.value===""){toast("Gõ số video mỗi ngày");return}const n=+ni.value;DB.mutate(ME.name,"nhịp đăng "+k,dt=>{dt.settings.nhip=dt.settings.nhip||{};dt.settings.nhip[k]=(dt.settings.nhip[k]||[]).concat({tu:Math.min(a2,z2),den:Math.max(a2,z2),sl:n}).sort((p,q)=>p.tu-q.tu)});renderMain()});
  b.querySelectorAll("[data-nhx]").forEach(x=>x.onclick=()=>{const [k,i]=x.dataset.nhx.split("|");DB.mutate(ME.name,"bỏ giai đoạn nhịp đăng",dt=>dt.settings.nhip[k].splice(+i,1));renderMain()});
  if($("#hot-open"))$("#hot-open").onclick=()=>openHot();
  b.querySelectorAll("[data-kdk]").forEach(x=>x.onclick=()=>{KDV.k=x.dataset.kdk;renderMain()});
  $("#kd-s").onchange=e=>{KDV.s=e.target.value;renderMain()};
  b.querySelectorAll("[data-kdday]").forEach(x=>x.onchange=()=>{const v=+x.value||0;DB.mutate(ME.name,"xếp ngày đăng "+x.dataset.kdday+" → "+(v?dd(v):"bỏ ngày"),dt=>{const c=dt.cards.find(y=>y.id===x.dataset.kdday);if(c)c.day=v});toast(v?"Đã xếp ngày đăng "+dd(v):"Đã bỏ ngày đăng");renderMain()});
  b.querySelectorAll("[data-kdp]").forEach(x=>x.onclick=()=>{const id=x.dataset.kdp,c=d.cards.find(y=>y.id===id),l=b.querySelector(`[data-kdl="${id}"]`).value.trim();if(!l){toast("Dán link bài đã đăng trước");return}
    const inp={linkDang:l,ngayDang:today};if(chOf(c.kenh).needId){const m2=l.match(/\d{19}/);if(!m2){toast("Link TikTok phải có dãy 19 số sau /video/");return}inp.tiktokId=m2[0]}
    const e=moveCard(ME,id,"xong",inp);if(e){toast(e);return}toast("Đã ghi là đã đăng");renderMain()});
  bindCommon(b);
};

/* ---------- Kho cảnh: mỗi buổi quay một thư mục Drive; bấm "Lưu vào kho cảnh" = Worker quét thư mục (như /quet trên Telegram) ---------- */
const KC_FOLDER=/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/[\w-]{20,}/;
const kcSt=k=>!k.wt?"":k.wStatus==="done"?`<span class="t-grn">✅ Worker quét xong${k.n?": "+k.n+" cảnh dùng được":""}</span>${k.wSum?`<small class="kcsum">${esc(k.wSum)}</small>`:""}`:k.wStatus==="error"?`<span class="t-red">❌ Quét lỗi: ${esc(k.wDetail||"")}</span>`:`<span class="t-amb">⏳ Worker đang quét${k.wDetail?" · "+esc(k.wDetail):""}</span>`;
async function kcSend(k,by){const sku=k.skus.length===1&&W_SKU[k.skus[0]]?W_SKU[k.skus[0]]:"";
  try{const r=await svApi("/api/hub/worker-tasks",{method:"POST",body:JSON.stringify({kind:"card_scan",ref:k.id,payload:{link:k.link,sku,by,tg:by,label:(k.day?dd(k.day)+" ":"")+(k.skus.map(x=>sk(x).n).join(", "))}})});return r&&r.id}catch(e){toast("Chưa gửi được Worker: "+e.message);return ""}}
let KC_AT=0;
async function kcSync(){if(!DB.data||Date.now()-KC_AT<20000)return;const P=(D().khoCanh||[]).filter(k=>k.wt&&!["done","error"].includes(k.wStatus));if(!P.length)return;KC_AT=Date.now();
  try{const L=await svApi("/api/hub/worker-tasks?kind=card"),by={};(L||[]).forEach(t=>by[t.id]=t);const ch=P.filter(k=>{const t=by[k.wt];return t&&(t.status!==k.wStatus||t.detail!==k.wDetail)});if(!ch.length)return;
    DB.mutate("Worker","cập nhật quét kho cảnh",dt=>ch.forEach(k0=>{const k=(dt.khoCanh||[]).find(x=>x.id===k0.id),t=by[k0.wt];if(!k||!t)return;const r=t.result||{};k.wStatus=["queued","taken","running","building","review"].includes(t.status)?"running":t.status;k.wDetail=t.detail||"";if(t.status==="done"){k.wSum=r.summary||"";k.n=r.approved||r.scanned||k.n||0}}));if(PAGE==="kehoach")renderMain()}catch(e){}}
setInterval(kcSync,10000);
function kcBlock(d,s,give){
  const K=(d.khoCanh||[]).filter(k=>k.shoot===s.id),skus=[...new Set(d.cards.filter(c=>c.buoiQuay===s.id).map(c=>c.sku))];
  const may=give||(s.nguoi||[]).includes(ME.id);
  return `<div class="kcb">${K.map(k=>`<div class="kcr">📁 <b>Kho cảnh</b> · ${esc(k.skus.map(x=>sk(x).n).join(", ")||"máy tự nhận sản phẩm")} · gửi ${dd(k.at)} bởi ${esc(k.by)}${k.ghiChu?` · <span class="hint">${esc(k.ghiChu)}</span>`:""} · <a href="${esc(kdLink(k.link))}" target="_blank" rel="noopener">mở thư mục</a> ${kcSt(k)}${may&&k.wStatus==="error"?` <button class="btn sm" data-kcre="${k.id}">Gửi quét lại</button>`:""}${may&&k.wStatus!=="running"?` <button class="lnk danger" data-kcx="${k.id}" title="Bỏ dòng này (file trên Drive và cảnh đã vào kho Worker vẫn còn)">✕</button>`:""}</div>`).join("")}
   ${may?`<div class="kcadd"><span class="hint">Tải cảnh quay buổi này lên <b>một thư mục Drive</b>, dán link thư mục rồi bấm Lưu: Worker tự quét, AI gán sản phẩm, loại cảnh, dùng được hay loại (như gửi /quet cho bot Telegram).</span><input class="kl" placeholder="Link thư mục Drive (…/drive/folders/…)"><input class="kg" placeholder="Ghi chú (vd cảnh trám ngâm áo, cận bột tan)"><button class="btn sm pri" data-kcsave="${s.id}" data-skus="${esc(skus.join(","))}">Lưu vào kho cảnh</button></div>`:""}</div>`;
}
const _xvQuayKC=xvQuay2;
xvQuay2=function(b,o){_xvQuayKC(b,o)};
/* Gửi Worker kiểu giọng đọc: chọn nhanh thư mục trong kho cảnh */
const _owsKC=openWorkerSend;
openWorkerSend=function(id){const r=_owsKC(id),c=D().cards.find(x=>x.id===id),inp=$("#ws-l");
  const K=c&&(D().khoCanh||[]).filter(k=>k.wStatus!=="error"&&(!k.skus.length||k.skus.includes(c.sku)));
  if(inp&&K&&K.length)inp.insertAdjacentHTML("beforebegin",`<select id="ws-kc"><option value="">Chọn từ kho cảnh…</option>${K.map(k=>`<option value="${esc(k.link)}">${k.day?dd(k.day):""} · ${k.n||"?"} cảnh${k.ghiChu?" · "+esc(k.ghiChu.slice(0,40)):""}</option>`).join("")}</select>`),$("#ws-kc").onchange=e=>{if(e.target.value)inp.value=e.target.value};
  return r};

/* ---------- ④ Edit: nói rõ chỗ dán link khi chưa có video ---------- */


/* ---------- Calendar theo kỳ chọn: tuần, tháng hay từ ngày đến ngày ---------- */
function calRange(){const r=xvRange();if(r)return r;const t=D().settings.today,W=WEEKS.find(w=>t>=w.tu&&t<=w.den)||WEEKS[0];return {tu:W.tu,den:Math.min(W.den,MONTH.ndays),out:true}}
function calBar(){const r=calRange(),mk=(a,z)=>({from:MONTH.key+"-"+String(a).padStart(2,"0"),to:MONTH.key+"-"+String(z).padStart(2,"0")}),t=D().settings.today,W=WEEKS.find(w=>t>=w.tu&&t<=w.den)||WEEKS[0];
  const isWk=r.tu===W.tu&&r.den===Math.min(W.den,MONTH.ndays),isMo=r.tu===1&&r.den===MONTH.ndays;
  return `<div class="seg"><button data-calp="wk" class="${isWk?"on":""}">Tuần này</button><button data-calp="mo" class="${isMo?"on":""}">Cả tháng ${MONTH.mon}</button></div>
   <span class="calr">Từ <select id="cal-a">${opt(Array.from({length:MONTH.ndays},(_,i)=>[i+1,dd(i+1)]),r.tu)}</select> đến <select id="cal-z">${opt(Array.from({length:MONTH.ndays},(_,i)=>[i+1,dd(i+1)]),r.den)}</select></span>`}
function bindCalBar(m){const t=D().settings.today,W=WEEKS.find(w=>t>=w.tu&&t<=w.den)||WEEKS[0],mk=(a,z,l)=>({k:"c",from:MONTH.key+"-"+String(a).padStart(2,"0"),to:MONTH.key+"-"+String(z).padStart(2,"0"),label:l});
  m.querySelectorAll("[data-calp]").forEach(x=>x.onclick=()=>setPeriod(x.dataset.calp==="wk"?mk(W.tu,Math.min(W.den,MONTH.ndays),"Tuần này"):mk(1,MONTH.ndays,"Tháng "+MONTH.mon)));
  const ch=()=>{let a=+$("#cal-a").value,z=+$("#cal-z").value;if(a>z)[a,z]=[z,a];setPeriod(mk(a,z,a===z?"Ngày":"Tùy chọn"))};$("#cal-a").onchange=ch;$("#cal-z").onchange=ch}
function calMonth(b,C,r){
  if(LW.kenh===""&&!LW._auto){LW._auto=1;const mine=CHANNELS.find(ch=>chanOwner(ch.k)===ME.id);if(mine){LW.kenh=mine.k;renderMain();return}}
  const d=D(),today=d.settings.today,chs=CHANNELS.filter(ch=>!LW.kenh||ch.k===LW.kenh).map(c=>c.k),I=C.filter(c=>c.day>=r.tu&&c.day<=r.den&&chs.includes(c.kenh));
  const cnt=k=>I.filter(c=>LW_ST(c)[0]===k).length;
  const sumL=[["Kế hoạch",I.length,""],["Chưa giao",cnt("new"),"new"],["Đang làm",cnt("doing"),"doing"],["Chờ duyệt",cnt("wait"),"wait"],["Chờ đăng",cnt("post"),"post"],["Đã đăng",cnt("done"),"done"],["Trễ",cnt("late"),"late"]];
  const cells=[];for(let i=0;i<dow(r.tu);i++)cells.push(0);for(let x=r.tu;x<=r.den;x++)cells.push(x);while(cells.length%7)cells.push(0);
  b.innerHTML=`<div class="lwsumline">${sumL.map(([l,v,k])=>`<span class="${v?"":"z"}">${k?`<i class="lwd lw-${k}"></i>`:""}${l} <b class="numeric">${v}</b></span>`).join("")}</div>
  <section class="card flush"><div class="calm">${["Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7","CN"].map(x=>`<div class="calh">${x}</div>`).join("")}
   ${cells.map(x=>{if(!x)return `<div class="calc out"></div>`;const L=I.filter(c=>c.day===x),cap=sum(chs,k=>nhipOf(k,x));return `<div class="calc${x===today?" now":""}${x<today?" past":""}"><div class="caln"><b>${dd(x)}</b><span class="${L.length<cap&&x>=today?"t-red":""}">${L.length}/${cap}</span></div>${L.slice(0,6).map(lwChip).join("")}${L.length>6?`<button class="lnk" data-calday="${x}">+${L.length-6} video nữa</button>`:""}${LW.kenh?slotEmpty(LW.kenh,x,L.length):""}</div>`}).join("")}
  </div></section><p class="hint">Số ở góc mỗi ngày: đã xếp / nhịp đăng (đỏ là còn thiếu). Bấm "+ video nữa" để xem riêng ngày đó. Chọn một kênh ở trên để hiện ô trống, bấm ô trống để chọn video (tích nhiều video là xếp được cả tháng một lần).</p>`;
  b.querySelectorAll("[data-calday]").forEach(x=>x.onclick=()=>{const v=+x.dataset.calday,s=MONTH.key+"-"+String(v).padStart(2,"0");setPeriod({k:"d",from:s,to:s,label:"Ngày"})});
}
pLich=function(m){
  const d=D(),r=calRange();if(!LW.kenh||!CHANNELS.some(c=>c.k===LW.kenh)){const mine=CHANNELS.find(ch=>chanOwner(ch.k)===ME.id);LW.kenh=(mine||CHANNELS[0]).k}
  m.innerHTML=H("Calendar","Video nào lên kênh nào, ngày nào · bấm ô trống để chọn video, bấm một video để mở thẻ")+`<div class="lwtool">${calBar()}</div>${r.out?`<div class="note">Kỳ chọn ở trên nằm ngoài tháng ${MONTH.mon}, đang hiện tuần này.</div>`:""}<div class="seg lwks">${CHANNELS.map(c=>`<button class="${LW.kenh===c.k?"on":""}" data-lwk="${esc(c.k)}">${esc(c.short)}</button>`).join("")}</div><div id="lb"></div>`;
  bindCalBar(m);
  m.querySelectorAll("[data-lwk]").forEach(x=>x.onclick=()=>{LW.kenh=x.dataset.lwk;renderMain()});
  const C=d.cards,lb=$("#lb");
  /* mỗi tuần một lưới kênh x ngày, cả tháng thì xếp nhiều tuần liền nhau */
  const Ws=WEEKS.filter(w=>w.den>=r.tu&&w.tu<=r.den);
  lb.innerHTML=Ws.map(w=>`<div class="lwmw" id="lwm${w.w}"></div>`).join("");
  Ws.forEach(w=>{const w0=WEEKS.find(z=>z.w===w.w),save={tu:w0.tu,den:w0.den};w0.tu=Math.max(w.tu,r.tu);w0.den=Math.min(w.den,r.den,MONTH.ndays);LW.w=w0.w;try{lichTuan($("#lwm"+w.w),C,w.w,Ws.length>1)}finally{w0.tu=save.tu;w0.den=save.den}});
};
PAGES.lich=pLich;

/* ---------- Video win & nhân bản ngay trong Làm hằng ngày (nối với ① Kế hoạch tuần: loại "Nhân bản win") ---------- */
function xvWin(b,o){
  PAGES.win(b);const ph=b.querySelector(".ph");if(ph)ph.remove();
  /* tab con (Video win shop / nghiên cứu / Hypit) nằm trong trang Kế hoạch: đổi SUB.win chứ không phải SUB của trang Kế hoạch */
  b.addEventListener("click",e=>{const t=e.target.closest("[data-sub]");if(!t||!b.contains(t))return;e.stopPropagation();e.preventDefault();SUB.win=t.dataset.sub;renderMain()},true);
  const d=o.d,W=winners().filter(w=>!XV.sku||w.sku===XV.sku).slice(0,5);
  if(XV.sku&&W.length)b.insertAdjacentHTML("afterbegin",`<div class="note">Video win của <b>${esc(sk(XV.sku).n)}</b>: ${W.map(w=>`${esc((w.ten||"").slice(0,50))} (${nf(w.don)} đơn)`).join(" · ")}. Bấm <b>Phân tích Hypit</b> ở video muốn nhân bản trong bảng dưới.</div>`);
}
/* Video win của một sản phẩm: shop mình (có đơn) trước, rồi KOC / đối thủ đã lưu */
const winAll=sku=>winners().filter(w=>w.sku===sku&&w.don>0).map(w=>({ten:w.ten,so:nf(w.don)+" đơn"})).concat((D().winResearch||[]).filter(r=>r.sp===sku).map(r=>({ten:(r.kocId?"KOC · ":"Đối thủ · ")+(r.ten||r.link||""),so:r.soLieu||""})));
/* ① Kế hoạch tuần: ô "Nhân bản win" hiện luôn video win của sản phẩm đó để Lead Content & Media biết nhân bản cái nào */
const _xvTuanWin=xvTuan;
xvTuan=function(b,o){_xvTuanWin(b,o)};

/* ---------- Calendar: ô trống theo nhịp đăng, bấm để chọn video (đã duyệt hoặc video tồn trong kho) ---------- */
const slotMay=k=>can(ME,"viec.giao")||can(ME,"kho.gan")||chanOwner(k)===ME.id;
/* số video cần đăng trong một ngày theo mục tiêu ở ①: ngày sale theo số video/ngày tuần sale, ngày thường theo trung bình video/ngày; chưa có kế hoạch thì dùng nhịp đăng */
function calCap(k,x){try{const d=D(),K=kn(d,k);if(!(K.T>0||K.tbSet))return nhipOld(k,x);if(K.T===0)return 0;
  /* ngày sale: đúng số video/ngày tuần sale; các ngày còn lại chia đều phần còn lại cho đủ tổng tháng (ngày nhiều hơn 1 ô được rải đều) */
  const rs=Math.round(K.rS),sl=K.saleSet;if(sl&&knIsSale(K,x))return rs;
  const nN=Math.max(1,MONTH.ndays-(sl?K.nS:0)),tot=Math.max(0,K.T-(sl?rs*K.nS:0));let i=0;for(let y=1;y<x;y++)if(!(sl&&knIsSale(K,y)))i++;
  const base=Math.floor(tot/nN),ex=tot-base*nN;return base+(Math.floor((i+1)*ex/nN)>Math.floor(i*ex/nN)?1:0)}catch(e){return nhipOf(k,x)}}
function slotEmpty(k,x,n){if(!slotMay(k))return "";const left=Math.max(0,calCap(k,x)-n),SH=Math.min(left,10);return `<div class="lwslots">${Array.from({length:SH},()=>`<button type="button" class="lwslot lwmini" data-slot="${esc(k)}|${x}" title="Ô trống theo nhịp: bấm để chọn video">ô trống</button>`).join("")}${left>SH?`<small class="lwleft">+${left-SH} ô nữa</small>`:""}<button type="button" class="lwslot lwplus" data-slot="${esc(k)}|${x}" title="Thêm video ngoài nhịp (đẩy thêm)">＋ thêm</button></div>`}
let SLOTF={sku:"",tab:"new"};
/* các ô trống của kênh từ ngày x đến hết tháng (mỗi phần tử là một ngày, lặp theo số ô trống) */
function slotFree(k,x){const d=D(),out=[];for(let y=Math.max(x,d.settings.today);y<=MONTH.ndays;y++){const e=Math.max(0,calCap(k,y)-d.cards.filter(c=>c.kenh===k&&c.day===y).length);for(let i=0;i<e;i++)out.push(y)}return out}
/* tóm tắt gọn trước khi chọn: KPI cả tháng, tuần của ngày đang chọn */
function slotSum(d,k,x){
  try{const K=kn(d,k),P=knPlan(d,k),w=weekOf(x)||1,W=WEEKS.find(z=>z.w===w)||WEEKS[0],pw=P[w-1]||{tong:0},C=d.cards.filter(c=>c.kenh===k&&+c.day>0),mo=C.length,inW=C.filter(c=>c.day>=W.tu&&c.day<=W.den),tm=K.T,tw=pw.tong;
    const ch=(l,a,b)=>'<span class="'+(a<b?"lack":"ok")+'">'+l+' <b>'+a+'/'+b+'</b>'+(a<b?' <i>thiếu '+(b-a)+'</i>':'')+'</span>';
    const prod=(P.ks||[]).filter(s=>(pw[s]||0)>0||inW.some(c=>c.sku===s)).map(s=>ch(esc(sk(s).n.split(" ").slice(0,3).join(" ")),inW.filter(c=>c.sku===s).length,pw[s]||0)).join("");
    return '<div class="slsum"><b class="slh">Tuần '+w+' ('+dd(W.tu)+'–'+dd(Math.min(W.den,MONTH.ndays))+')</b>'+ch("Cả tuần",inW.length,tw)+prod+'</div><div class="slsum">'+ch("Cả tháng",mo,tm)+'<span>Trung bình <b>'+K.tb+'</b>/ngày</span></div>'}catch(e){return ""}
}
function openSlot(k,x){
  const d=D(),ready=d.cards.filter(c=>c.step==="dang"&&!c.day&&c.kenh===k).sort((a,b)=>(a.kenh===k?0:1)-(b.kenh===k?0:1)),kho=xvKhoFree();
  const skus=[...new Set((SLOTF.tab==="new"?ready:kho).map(c=>c.sku))];
  const L=(SLOTF.tab==="new"?ready:kho).filter(v=>!SLOTF.sku||v.sku===SLOTF.sku).slice(0,80);
  openDrawerHTML(`<h2>Chọn video cho ${esc(chOf(k).short)} · ${dayLbl(x)}</h2><p class="hint">Ngày này đã xếp ${d.cards.filter(c=>c.kenh===k&&c.day===x).length}/${nhipOf(k,x)} video</p>${slotSum(d,k,x)}
   <div class="seg"><button class="${SLOTF.tab==="kho"?"on":""}" data-stab="kho">Video tồn tháng trước (${kho.length})</button><button class="${SLOTF.tab==="new"?"on":""}" data-stab="new">Video sản xuất trong tháng (${ready.length})</button></div>
   <div class="filters"><select id="sl-s">${opt([["","Mọi sản phẩm"]].concat(skus.map(s2=>[s2,sk(s2).n])),SLOTF.sku)}</select><label class="ck sm"><input type="checkbox" id="sl-all"> Chọn hết danh sách</label></div>
   <div class="slotbulk"><b>Xếp nhiều video một lần:</b> tích các video rồi bấm, web rải lần lượt vào các ô trống của ${esc(chOf(k).short)} từ ${dd(x)} đến hết tháng (đúng nhịp đăng từng ngày).${SLOTF.tab==="kho"?` <select id="sl-mode">${opt([["nguyen","Đăng nguyên"],["hook","Đổi hook (tạo việc edit)"]],"nguyen")}</select>`:""} <button class="btn sm pri" id="sl-bulk">Xếp các video đã tích</button> <span class="hint" id="sl-cnt">0 video · còn ${slotFree(k,x).length} ô trống</span></div>
   <div class="slotl">${L.map(v=>SLOTF.tab==="new"?`<div class="slotr"><input type="checkbox" data-selc="${v.id}">${swatch(v.sku)}<span><b>${esc(v.hookText||v.yTuong||v.id)}</b><small>${esc(sk(v.sku).n)} · ${esc(chOf(v.kenh).short)}${v.kenh!==k?" (sẽ chuyển sang "+esc(chOf(k).short)+")":""}${v.linkFinal||v.linkVideo?` · <a href="${esc(kdLink(v.linkFinal||v.linkVideo))}" target="_blank" rel="noopener">xem</a>`:""}</small></span><button class="btn sm pri" data-pickc="${v.id}">Chọn</button></div>`
     :`<div class="slotr"><input type="checkbox" data-selk="${esc(v.ma)}">${swatch(v.sku)}<span><b>${esc((v.tuyen||"")+(v.ten?(v.tuyen?" · ":"")+v.ten:"")||v.ma)}</b><small>${esc(v.ma)} · ${esc(sk(v.sku).n)}${v.nguoi?" · edit: "+esc(v.nguoi):""} · <a href="${esc(v.link)}" target="_blank" rel="noopener">xem</a></small></span><button class="btn sm pri" data-pickk="${esc(v.ma)}" data-mode="nguyen">Đăng nguyên</button><button class="btn sm" data-pickk="${esc(v.ma)}" data-mode="hook" title="Tạo việc edit đổi hook, chèn chữ">Đổi hook</button></div>`).join("")||`<p class="empty">${SLOTF.tab==="new"?"Chưa có video nào đã duyệt mà chưa có ngày đăng.":"Kho không còn video tồn dùng được."}</p>`}</div>`);
  const di=$("#drawerIn");
  const cnt=()=>{const n=di.querySelectorAll("[data-selc]:checked,[data-selk]:checked").length;$("#sl-cnt").textContent=`${n} video · còn ${slotFree(k,x).length} ô trống`};
  di.querySelectorAll("[data-selc],[data-selk]").forEach(c=>c.onchange=cnt);
  $("#sl-all").onchange=e=>{di.querySelectorAll("[data-selc],[data-selk]").forEach(c=>c.checked=e.target.checked);cnt()};
  $("#sl-bulk").onclick=()=>{const C=[...di.querySelectorAll("[data-selc]:checked")].map(c=>c.dataset.selc),K=[...di.querySelectorAll("[data-selk]:checked")].map(c=>c.dataset.selk),free=slotFree(k,x);
    if(!C.length&&!K.length){toast("Tích ít nhất một video");return}const n=Math.min(free.length,C.length+K.length);if(!n){toast("Không còn ô trống từ ngày này đến hết tháng");return}
    let i=0;if(C.length)DB.mutate(ME.name,`xếp ${Math.min(C.length,n)} video vào ${k}`,dt=>{C.forEach(id=>{if(i>=n)return;const c=dt.cards.find(y=>y.id===id);if(c){c.day=free[i++];c.kenh=k}})});
    const mode=$("#sl-mode")?$("#sl-mode").value:"nguyen";K.forEach(ma=>{if(i>=n)return;if(allocKho(ma,k,free[i],mode,chanOwner(k)||ME.id))i++});
    toast(`Đã xếp ${i} video vào ${chOf(k).short} (${dd(free[0])} → ${dd(free[i-1]||free[0])})${C.length+K.length>i?` · ${C.length+K.length-i} video chưa xếp vì hết ô`:""}`);closeDrawer();renderMain()};
  di.querySelectorAll("[data-stab]").forEach(b=>b.onclick=()=>{SLOTF.tab=b.dataset.stab;SLOTF.sku="";openSlot(k,x)});
  $("#sl-s").onchange=e=>{SLOTF.sku=e.target.value;openSlot(k,x)};
  di.querySelectorAll("[data-pickc]").forEach(b=>b.onclick=()=>{const id=b.dataset.pickc;DB.mutate(ME.name,`xếp ${id} vào ${k} ngày ${dd(x)}`,dt=>{const c=dt.cards.find(y=>y.id===id);if(c){c.day=x;c.kenh=k}});toast("Đã xếp vào "+chOf(k).short+" "+dd(x));closeDrawer();renderMain()});
  di.querySelectorAll("[data-pickk]").forEach(b=>b.onclick=()=>{const cid=allocKho(b.dataset.pickk,k,x,b.dataset.mode==="hook"?"hook":"nguyen",chanOwner(k)||ME.id);toast(cid?(b.dataset.mode==="hook"?"Đã tạo việc đổi hook "+cid:"Đã xếp video tồn vào "+dd(x)):"Video này đã được dùng");closeDrawer();renderMain()});
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-slot]");if(!b)return;e.preventDefault();e.stopPropagation();const [k,x]=b.dataset.slot.split("|");SLOTF.sku="";openSlot(k,+x)},true);

/* ---------- Kho video để chọn đăng: video tồn còn dùng được + video mới đã duyệt chưa có ngày ---------- */
let KDP={sku:"",q:"",src:""};
function kdPool(d){const ready=d.cards.filter(c=>c.step==="dang"&&!c.day).map(c=>({key:"c:"+c.id,src:"new",sku:c.sku,ten:c.hookText||c.yTuong||c.tuyen||c.id,sub:c.id+" · "+chOf(c.kenh).short+(c.nguoiEdit?" · edit: "+userName(c.nguoiEdit):""),link:c.linkFinal||c.linkVideo,kenh:c.kenh,find:[c.hookText,c.yTuong,c.tuyen,c.id].join(" ")}));
  const kho=xvKhoFree().map(k=>({key:"k:"+k.ma,src:"kho",sku:k.sku,ten:(k.tuyen||"")+(k.ten?(k.tuyen?" · ":"")+k.ten:"")||k.ma,sub:k.ma+(k.nguoi?" · edit: "+k.nguoi:""),link:k.link,kenh:"",find:[k.tuyen,k.ten,k.ma,k.skuText].join(" ")}));return ready.concat(kho)}
function kdPick(d,give){
  const P=kdPool(d),qf=kdFold(KDP.q),ok=v=>(!KDP.src||v.src===KDP.src)&&(!qf||kdFold(sk(v.sku).n+" "+v.find).includes(qf));
  const by=xvGroupBy(P.filter(v=>!KDP.src||v.src===KDP.src),v=>v.sku).map(([k,A])=>({k,n:A.length,nw:A.filter(v=>v.src==="new").length,kh:A.filter(v=>v.src==="kho").length})).sort((a,b)=>b.n-a.n);
  const L=P.filter(v=>ok(v)&&(!KDP.sku||v.sku===KDP.sku)),today=d.settings.today,mine=CHANNELS.find(c=>chanOwner(c.k)===ME.id),defK=KDV.k||(mine&&mine.k)||"TikTok chính";
  const may=give||CHANNELS.some(c=>chanOwner(c.k)===ME.id)||can(ME,"kho.gan");
  const dayO=k=>[["","Chọn ngày"]].concat(Array.from({length:MONTH.ndays-today+1},(_,i)=>today+i).map(x=>[x,dayLbl(x)+" · "+d.cards.filter(y=>y.kenh===k&&y.day===x).length+"/"+nhipOf(k,x)]));
  return `<section class="card flush" id="kdpick"><div class="card-h pad"><h2>Kho video để chọn đăng</h2><span class="hint">${P.length} video chọn được · ${P.filter(v=>v.src==="new").length} video mới đã duyệt · ${P.filter(v=>v.src==="kho").length} video tồn trong kho</span></div>
   <div class="filters pad"><input id="kp-q" class="kdq" placeholder="🔍 Tìm sản phẩm, tuyến, hook, mã video… (Enter)" value="${esc(KDP.q)}"><div class="seg">${[["","Tất cả"],["kho","Video tồn tháng trước"],["new","Video sản xuất trong tháng"]].map(([k,t])=>`<button class="${KDP.src===k?"on":""}" data-kpsrc="${k}">${t}</button>`).join("")}</div></div>
   <div class="kdsku pad">${by.map(x=>`<button type="button" class="kdsk${KDP.sku===x.k?" on":""}" data-kpsku="${esc(x.k)}">${swatch(x.k)}<b>${esc(sk(x.k).n)}</b><span class="kdn">${x.n}</span><small>${x.nw?`<i class="t-grn">${x.nw} mới</i>`:""}${x.kh?`<i>${x.kh} tồn</i>`:""}</small></button>`).join("")||`<span class="hint">Kho trống.</span>`}${KDP.sku||KDP.q||KDP.src?`<button type="button" class="lnk" data-kpsku="">Bỏ lọc ✕</button>`:""}</div>
   ${KDP.sku||KDP.q?(L.length?`<div class="kplist">${L.slice(0,80).map(v=>`<div class="slotr" data-kpk="${esc(v.key)}">${swatch(v.sku)}<span><b>${esc(v.ten)}</b><small>${v.src==="new"?`<i class="t-grn">Mới duyệt</i>`:`<i>Video tồn</i>`} · ${esc(sk(v.sku).n)} · ${esc(v.sub)}${v.link?` · <a href="${esc(kdLink(v.link))}" target="_blank" rel="noopener">xem</a>`:""}</small></span>
     ${may?`<select class="kp-k">${opt(CHANNELS.map(c=>[c.k,c.short]),v.kenh||defK)}</select><select class="kp-d">${opt(dayO(v.kenh||defK),"")}</select>${v.src==="kho"?`<select class="kp-m">${opt([["nguyen","Đăng nguyên"],["hook","Đổi hook"]],"nguyen")}</select>`:""}<button class="btn sm pri" data-kpgo>Xếp</button>`:""}</div>`).join("")}${L.length>80?`<p class="hint">Đang hiện 80/${L.length}, tìm hoặc lọc thêm.</p>`:""}</div>`:`<p class="empty pad">Không có video khớp.</p>`):`<p class="hint pad">Bấm một sản phẩm ở trên (hoặc tìm) để hiện các video chọn được, chọn kênh + ngày rồi bấm Xếp. Muốn xếp nhiều video một lúc cả tháng: dùng ô trống ở Calendar.</p>`}</section>`;
}
function kdPickBind(b){
  b.querySelectorAll("[data-kpsku]").forEach(x=>x.onclick=()=>{const v=x.dataset.kpsku;if(!v){KDP.sku="";KDP.q="";KDP.src=""}else KDP.sku=KDP.sku===v?"":v;renderMain()});
  b.querySelectorAll("[data-kpsrc]").forEach(x=>x.onclick=()=>{KDP.src=x.dataset.kpsrc;renderMain()});
  const q=$("#kp-q");if(q)q.onkeydown=e=>{if(e.key==="Enter"){KDP.q=q.value.trim();renderMain();setTimeout(()=>{const z=$("#kp-q");if(z){z.focus();z.setSelectionRange(z.value.length,z.value.length)}},30)}};
  b.querySelectorAll("[data-kpk]").forEach(r=>{const ks=r.querySelector(".kp-k"),ds=r.querySelector(".kp-d");if(!ks)return;
    ks.onchange=()=>{const d=D(),t=d.settings.today;ds.innerHTML=opt([["","Chọn ngày"]].concat(Array.from({length:MONTH.ndays-t+1},(_,i)=>t+i).map(x=>[x,dayLbl(x)+" · "+d.cards.filter(y=>y.kenh===ks.value&&y.day===x).length+"/"+nhipOf(ks.value,x)])),"")};
    r.querySelector("[data-kpgo]").onclick=()=>{const day=+ds.value,k=ks.value,key=r.dataset.kpk;if(!day){toast("Chọn ngày đăng");return}
      if(key.startsWith("c:")){const id=key.slice(2);DB.mutate(ME.name,`xếp ${id} vào ${k} ngày ${dd(day)}`,dt=>{const c=dt.cards.find(y=>y.id===id);if(c){c.day=day;c.kenh=k}});toast("Đã xếp "+id+" vào "+chOf(k).short+" "+dd(day))}
      else{const m=r.querySelector(".kp-m"),cid=allocKho(key.slice(2),k,day,m?m.value:"nguyen",chanOwner(k)||ME.id);toast(cid?"Đã xếp video tồn vào "+chOf(k).short+" "+dd(day):"Video này đã được dùng")}
      renderMain()}});
}
