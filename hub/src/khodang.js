/* =====================================================================
   KHO VIDEO ĐĂNG ĐƯỢC · ĐỦ VIDEO CHƯA · KHO CẢNH · CALENDAR THEO KỲ
   - ⑤: chỉ video đã qua Oanh + chị duyệt mới vào kho đăng; người giữ kênh xếp ngày, dán link đăng.
     Mỗi video: link, SKU, ngày sản xuất, trạng thái, ngày đăng dự kiến / thực tế, link SP, view, CTR, GMV, đơn.
   - Nhịp đăng: so số video cần đăng (nhịp × số ngày) với số đã có sẵn + đang làm → báo thiếu.
   - Buổi quay: một link thư mục cảnh cho cả buổi, bấm "Lưu vào kho cảnh" (không kê từng cảnh).
   - Calendar: theo kỳ chọn (tuần này, tháng này, hoặc từ ngày đến ngày).
   ===================================================================== */
const KD_PIPE=["kb","dkb","quay","worker","edit","dvd","dceo"];
let KDV={k:"",s:"",t:""};
const kdLink=u=>u?(/^https?:/.test(u)?u:"https://"+u):"";
const kdSP=c=>c.linkSP||((D().settings.linkSP||{})[c.sku])||"";
const kdSX=c=>c.ngaySX||0;
const kdST=c=>{const t=D().settings.today;if(c.step==="xong")return ["Đã đăng","grn"];if(!c.day)return ["Chờ xếp ngày","amb"];if(c.day<t)return ["Quá ngày, chưa đăng","red"];return ["Đã lên lịch","blu"]};
/* ngày sản xuất = ngày chị duyệt xong (vào kho đăng) */
const _mvSX=moveCard;
moveCard=function(u,id,to,inp){const e=_mvSX(u,id,to,inp);if(!e&&to==="dang"){const c=D().cards.find(x=>x.id===id);if(c&&!c.ngaySX)DB.mutate(u.name,"ghi ngày sản xuất "+id,dt=>{const x=dt.cards.find(y=>y.id===id);if(x&&!x.ngaySX)x.ngaySX=dt.settings.today})}return e};

/* Đủ video chưa: từng kênh, từ hôm nay đến hết kỳ đang xem */
function kdDu(d,W){
  const today=d.settings.today,a=Math.max(today,W.tu),z=Math.max(a,W.den),n=z-a+1;
  return CHANNELS.map(ch=>{let can=0;for(let x=a;x<=z;x++)can+=nhipOf(ch.k,x);
    const ready=d.cards.filter(c=>c.kenh===ch.k&&c.step==="dang"&&(!c.day||c.day>=a)).length,
      doing=d.cards.filter(c=>c.kenh===ch.k&&KD_PIPE.includes(c.step)).length,thieu=Math.max(0,can-ready-doing);
    return {ch,a,z,n,can,ready,doing,thieu,thieuNgay:Math.max(0,can-ready)}});
}

xvDang2=function(b,o){
  const {d,W,give}=o,today=d.settings.today,N=d.settings.nhip||{},R=kdDu(d,W);
  const days=Array.from({length:MONTH.ndays},(_,i)=>[i+1,dd(i+1)]);
  const D7=[];for(let x=Math.max(today,W.tu);x<=Math.min(MONTH.ndays,Math.max(today,W.tu)+6);x++)D7.push(x);
  /* ---- 1. nhịp đăng + đủ video chưa ---- */
  const nhCard=`<section class="card"><div class="card-h"><h2>Nhịp đăng & đủ video chưa</h2><span class="hint">nhịp = số video <b>đăng mỗi ngày</b> trên kênh · tính từ hôm nay ${dd(today)} đến ${dd(R[0].z)} (theo kỳ chọn ở trên)</span></div>
   <div class="kdu">${R.map(r=>{const gd=(N[r.ch.k]||[]);return `<div class="kduk${r.thieu?" bad":r.thieuNgay?" mid":" ok"}">
     <div class="kduh"><b>${esc(r.ch.short)}</b><small>giữ kênh: ${esc(userName(chanOwner(r.ch.k))||"chưa đặt")}</small></div>
     <div class="kdun"><span><small>Cần đăng</small><b>${r.can}</b></span><span><small>Đã có sẵn</small><b>${r.ready}</b></span><span><small>Đang làm</small><b>${r.doing}</b></span><span><small>Thiếu</small><b class="${r.thieu?"t-red":"t-grn"}">${r.thieu}</b></span></div>
     <div class="kdumsg">${r.thieu?`⚠ Thiếu ${r.thieu} video: cần lên thêm lịch sản xuất (buổi quay, Worker, reup) cho kênh này.`:r.thieuNgay?`Đủ nếu ${r.thieuNgay} video đang làm xong kịp và được duyệt.`:"✓ Đủ video sẵn để đăng."}</div>
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
     <td>${sp?`<a href="${esc(kdLink(sp))}" target="_blank" rel="noopener">mở</a> `:""}${m?`<button class="lnk" data-kdsp="${c.id}" title="Dán link sản phẩm (giỏ hàng)">${sp?"sửa":"+ dán"}</button>`:""}</td>
     <td class="n">${c.view?nf(c.view):"—"}</td><td class="n">${c.view?ctr.toFixed(1)+"%":"—"}</td><td class="n">${c.gmv?money(c.gmv):"—"}</td><td class="n">${c.don?`<b class="${c.don>=win?"t-grn":""}">${nf(c.don)}</b>${c.don>=win?" 🏆":""}`:"—"}</td></tr>`};
  const kho=`<section class="card flush"><div class="card-h pad"><h2>Kho video đăng được</h2><span class="hint">chỉ video Oanh và chị đã duyệt · ${tot.cho} chờ xếp ngày · ${tot.lich} đã lên lịch · ${tot.da} đã đăng trong kỳ</span>${give?`<span class="sp"></span><button class="btn sm" id="hot-open">🔥 Đẩy sản phẩm đang lên xu hướng</button>`:""}</div>
   <div class="filters pad"><div class="seg">${[["","Tất cả kênh"]].concat(CHANNELS.map(c=>[c.k,c.short])).map(([k,t])=>`<button class="${KDV.k===k?"on":""}" data-kdk="${esc(k)}">${esc(t)}</button>`).join("")}</div>
    <select id="kd-s">${opt([["","Mọi sản phẩm"]].concat(skOpts()),KDV.s)}</select><select id="kd-t">${opt([["","Mọi trạng thái"],"Chờ xếp ngày","Đã lên lịch","Quá ngày, chưa đăng","Đã đăng"],KDV.t)}</select></div>
   ${L.length?`<div class="tbl"><table class="kdt"><thead><tr><th>Video</th><th>Link video</th><th>SKU</th><th class="n">Ngày sản xuất</th><th>Trạng thái</th><th>Ngày đăng dự kiến</th><th>Ngày đăng thực tế</th><th>Link SP</th><th class="n">View</th><th class="n">CTR</th><th class="n">GMV</th><th class="n">Đơn/tháng</th></tr></thead><tbody>${L.slice(0,200).map(row).join("")}</tbody></table></div>`:`<p class="empty pad">Chưa có video nào được duyệt xong. Video edit xong → Oanh duyệt → chị duyệt thì mới vào kho này.</p>`}
   <p class="hint pad">Người giữ kênh tự chọn ngày đăng (số cạnh ngày là đã xếp / nhịp đăng). Đăng xong dán link vào ô "Ngày đăng thực tế" và bấm Đã đăng. View, CTR, GMV, đơn tự cập nhật khi nhập báo cáo TikTok (Video Performance List). CTR = lượt nhấp sản phẩm / view. 🏆 = từ ${win} đơn trở lên (video win).</p></section>`;
  const t7=`<section class="card flush"><div class="card-h pad"><h2>7 ngày tới</h2><span class="hint">đã xếp / nhịp đăng</span></div><div class="tbl"><table><thead><tr><th>Kênh</th>${D7.map(x=>`<th class="n">${dayLbl(x)}</th>`).join("")}</tr></thead><tbody>${CHANNELS.map(ch=>`<tr><td><b>${esc(ch.short)}</b></td>${D7.map(x=>{const I=d.cards.filter(c=>c.kenh===ch.k&&c.day===x),cap=nhipOf(ch.k,x);return `<td class="n"><b class="${I.length<cap?"t-red":I.length===cap&&cap?"t-grn":""}">${I.length}</b>/${cap}<small>${esc(xvGroupBy(I,c=>c.sku).map(([k,l])=>sk(k).n.split(" ")[0]+" "+l.length).join(", "))}</small></td>`}).join("")}</tr>`).join("")}</tbody></table></div></section>`;
  b.innerHTML=nhCard+kho+t7;
  b.querySelectorAll("[data-nhadd]").forEach(x=>x.onclick=()=>{const k=x.dataset.nhadd,f=x.closest(".nhadd"),a2=+f.querySelector(".a").value,z2=+f.querySelector(".z").value,ni=f.querySelector(".n");if(ni.value===""){toast("Gõ số video mỗi ngày");return}const n=+ni.value;DB.mutate(ME.name,"nhịp đăng "+k,dt=>{dt.settings.nhip=dt.settings.nhip||{};dt.settings.nhip[k]=(dt.settings.nhip[k]||[]).concat({tu:Math.min(a2,z2),den:Math.max(a2,z2),sl:n}).sort((p,q)=>p.tu-q.tu)});renderMain()});
  b.querySelectorAll("[data-nhx]").forEach(x=>x.onclick=()=>{const [k,i]=x.dataset.nhx.split("|");DB.mutate(ME.name,"bỏ giai đoạn nhịp đăng",dt=>dt.settings.nhip[k].splice(+i,1));renderMain()});
  if($("#hot-open"))$("#hot-open").onclick=()=>openHot();
  b.querySelectorAll("[data-kdk]").forEach(x=>x.onclick=()=>{KDV.k=x.dataset.kdk;renderMain()});
  $("#kd-s").onchange=e=>{KDV.s=e.target.value;renderMain()};$("#kd-t").onchange=e=>{KDV.t=e.target.value;renderMain()};
  b.querySelectorAll("[data-kdday]").forEach(x=>x.onchange=()=>{const v=+x.value||0;DB.mutate(ME.name,"xếp ngày đăng "+x.dataset.kdday+" → "+(v?dd(v):"bỏ ngày"),dt=>{const c=dt.cards.find(y=>y.id===x.dataset.kdday);if(c)c.day=v});toast(v?"Đã xếp ngày đăng "+dd(v):"Đã bỏ ngày đăng");renderMain()});
  b.querySelectorAll("[data-kdp]").forEach(x=>x.onclick=()=>{const id=x.dataset.kdp,c=d.cards.find(y=>y.id===id),l=b.querySelector(`[data-kdl="${id}"]`).value.trim();if(!l){toast("Dán link bài đã đăng trước");return}
    const inp={linkDang:l,ngayDang:today};if(chOf(c.kenh).needId){const m2=l.match(/\d{19}/);if(!m2){toast("Link TikTok phải có dãy 19 số sau /video/");return}inp.tiktokId=m2[0]}
    const e=moveCard(ME,id,"xong",inp);if(e){toast(e);return}toast("Đã ghi là đã đăng");renderMain()});
  b.querySelectorAll("[data-kdsp]").forEach(x=>x.onclick=()=>{const id=x.dataset.kdsp,c=d.cards.find(y=>y.id===id),v=prompt("Link sản phẩm (giỏ hàng) cho video này:",kdSP(c));if(v===null)return;const l=v.trim();
    DB.mutate(ME.name,"link sản phẩm "+id,dt=>{const y=dt.cards.find(q=>q.id===id);if(y)y.linkSP=l;dt.settings.linkSP=dt.settings.linkSP||{};if(l&&!dt.settings.linkSP[y.sku])dt.settings.linkSP[y.sku]=l});renderMain()});
  bindCommon(b);
};

/* ---------- Kho cảnh: mỗi buổi quay lưu một thư mục cảnh ---------- */
function kcBlock(d,s,give){
  const K=(d.khoCanh||[]).filter(k=>k.shoot===s.id),skus=[...new Set(d.cards.filter(c=>c.buoiQuay===s.id).map(c=>c.sku))];
  const may=give||(s.nguoi||[]).includes(ME.id);
  return `<div class="kcb">${K.map(k=>`<div class="kcr">📁 <b>Kho cảnh</b> · ${k.n?k.n+" cảnh · ":""}${esc(k.skus.map(x=>sk(x).n).join(", ")||"nhiều sản phẩm")} · lưu ${dd(k.at)} bởi ${esc(k.by)}${k.ghiChu?` · <span class="hint">${esc(k.ghiChu)}</span>`:""} <a href="${esc(kdLink(k.link))}" target="_blank" rel="noopener">mở thư mục</a>${may?` <button class="lnk danger" data-kcx="${k.id}" title="Bỏ">✕</button>`:""}</div>`).join("")}
   ${may&&(s.trangThai==="Đã quay"||d.cards.some(c=>c.buoiQuay===s.id&&c.daQuay))?`<div class="kcadd" data-kcs="${s.id}"><span class="hint">Tải cảnh quay lên một thư mục Drive rồi dán link thư mục (không cần dán từng cảnh):</span><input class="kl" placeholder="Link thư mục Drive chứa cảnh quay buổi này"><input class="kn num" type="number" min="0" placeholder="số cảnh"><input class="kg" placeholder="Ghi chú (vd cảnh trám ngâm áo, cận bột tan)"><button class="btn sm pri" data-kcsave="${s.id}" data-skus="${esc(skus.join(","))}">Lưu vào kho cảnh</button></div>`:""}</div>`;
}
const _xvQuayKC=xvQuay2;
xvQuay2=function(b,o){
  _xvQuayKC(b,o);const d=o.d;
  b.querySelectorAll("[data-sqnote]").forEach(t=>{const s=(d.shoots||[]).find(y=>y.id===t.dataset.sqnote);if(s)t.closest("label").insertAdjacentHTML("beforebegin",kcBlock(d,s,o.give))});
  const KC=(d.khoCanh||[]).slice().sort((p,q)=>q.at-p.at||q.day-p.day);
  if(KC.length)b.insertAdjacentHTML("beforeend",`<section class="card"><div class="card-h"><h2>📁 Kho cảnh</h2><span class="hint">${KC.length} thư mục · ${sum(KC,k=>k.n||0)} cảnh · dùng lại cho video không quay (Worker) và cảnh trám</span></div>
   <div class="tbl"><table><thead><tr><th>Ngày quay</th><th>Sản phẩm</th><th class="n">Số cảnh</th><th>Ghi chú</th><th>Người lưu</th><th></th></tr></thead><tbody>${KC.map(k=>`<tr><td>${k.day?dayLbl(k.day):"—"}</td><td>${k.skus.map(x=>swatch(x)+esc(sk(x).n)).join(", ")||"—"}</td><td class="n">${k.n||"—"}</td><td>${esc(k.ghiChu||"")}</td><td>${esc(k.by)}</td><td><a href="${esc(kdLink(k.link))}" target="_blank" rel="noopener">mở thư mục</a></td></tr>`).join("")}</tbody></table></div></section>`);
  b.querySelectorAll("[data-kcsave]").forEach(x=>x.onclick=()=>{const f=x.closest(".kcadd"),l=f.querySelector(".kl").value.trim();if(!/drive\.google|^https?:\/\//.test(l)){toast("Dán link thư mục Drive");return}
    const s=(d.shoots||[]).find(y=>y.id===x.dataset.kcsave),n=+f.querySelector(".kn").value||0,g=f.querySelector(".kg").value.trim(),skus=x.dataset.skus?x.dataset.skus.split(","):[];
    DB.mutate(ME.name,"lưu kho cảnh buổi quay "+dd(s.day),dt=>{dt.khoCanh=dt.khoCanh||[];const mx=dt.khoCanh.reduce((m,k)=>Math.max(m,+String(k.id).replace(/\D/g,"")||0),0);dt.khoCanh.push({id:"KC-"+String(mx+1).padStart(3,"0"),shoot:s.id,day:s.day,skus,link:l,n,ghiChu:g,by:ME.name,at:dt.settings.today})});toast("Đã lưu vào kho cảnh");renderMain()});
  b.querySelectorAll("[data-kcx]").forEach(x=>x.onclick=()=>{if(!confirm("Bỏ thư mục này khỏi kho cảnh? (File trên Drive vẫn còn)"))return;DB.mutate(ME.name,"bỏ kho cảnh "+x.dataset.kcx,dt=>{dt.khoCanh=(dt.khoCanh||[]).filter(k=>k.id!==x.dataset.kcx)});renderMain()});
};
/* Gửi Worker kiểu giọng đọc: chọn nhanh thư mục trong kho cảnh */
const _owsKC=openWorkerSend;
openWorkerSend=function(id){const r=_owsKC(id),c=D().cards.find(x=>x.id===id),inp=$("#ws-l");
  const K=c&&(D().khoCanh||[]).filter(k=>!k.skus.length||k.skus.includes(c.sku));
  if(inp&&K&&K.length)inp.insertAdjacentHTML("beforebegin",`<select id="ws-kc"><option value="">Chọn từ kho cảnh…</option>${K.map(k=>`<option value="${esc(k.link)}">${k.day?dd(k.day):""} · ${k.n||"?"} cảnh${k.ghiChu?" · "+esc(k.ghiChu.slice(0,40)):""}</option>`).join("")}</select>`),$("#ws-kc").onchange=e=>{if(e.target.value)inp.value=e.target.value};
  return r};

/* ---------- ④ Edit: nói rõ chỗ dán link khi chưa có video ---------- */
const _xvEditKD=xvEdit2;
xvEdit2=function(b,o){_xvEditKD(b,o);
  b.querySelectorAll(".edcol p.hint").forEach(p=>{if(p.textContent.startsWith("Chưa có video edit"))p.innerHTML="Chưa có video edit. Khi Oanh giao, mỗi video hiện ở đây kèm <b>ô dán link</b> và nút <b>Gửi duyệt</b> → Oanh duyệt → chị duyệt → vào <b>⑤ Kho video đăng được</b>."});
  const h=b.querySelector(".card .card-h .hint");if(h&&/^0 video/.test(h.textContent))h.textContent="0 video (đếm số video đã quay chờ edit, không phải số cảnh)";
};

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
  const d=D(),today=d.settings.today,chs=CHANNELS.filter(ch=>!LW.kenh||ch.k===LW.kenh).map(c=>c.k),I=C.filter(c=>c.day>=r.tu&&c.day<=r.den&&chs.includes(c.kenh));
  const cnt=k=>I.filter(c=>LW_ST(c)[0]===k).length;
  const sumL=[["Kế hoạch",I.length,""],["Chưa giao",cnt("new"),"new"],["Đang làm",cnt("doing"),"doing"],["Chờ duyệt",cnt("wait"),"wait"],["Chờ đăng",cnt("post"),"post"],["Đã đăng",cnt("done"),"done"],["Trễ",cnt("late"),"late"]];
  const cells=[];for(let i=0;i<dow(r.tu);i++)cells.push(0);for(let x=r.tu;x<=r.den;x++)cells.push(x);while(cells.length%7)cells.push(0);
  b.innerHTML=`<div class="lwsumline">${sumL.map(([l,v,k])=>`<span class="${v?"":"z"}">${k?`<i class="lwd lw-${k}"></i>`:""}${l} <b class="numeric">${v}</b></span>`).join("")}</div>
  <section class="card flush"><div class="calm">${["Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7","CN"].map(x=>`<div class="calh">${x}</div>`).join("")}
   ${cells.map(x=>{if(!x)return `<div class="calc out"></div>`;const L=I.filter(c=>c.day===x),cap=sum(chs,k=>nhipOf(k,x));return `<div class="calc${x===today?" now":""}${x<today?" past":""}"><div class="caln"><b>${dd(x)}</b><span class="${L.length<cap&&x>=today?"t-red":""}">${L.length}/${cap}</span></div>${L.slice(0,6).map(lwChip).join("")}${L.length>6?`<button class="lnk" data-calday="${x}">+${L.length-6} video nữa</button>`:""}</div>`}).join("")}
  </div></section><p class="hint">Số ở góc mỗi ngày: đã xếp / nhịp đăng (đỏ là còn thiếu). Bấm "+ video nữa" để xem riêng ngày đó.</p>`;
  b.querySelectorAll("[data-calday]").forEach(x=>x.onclick=()=>{const v=+x.dataset.calday,s=MONTH.key+"-"+String(v).padStart(2,"0");setPeriod({k:"d",from:s,to:s,label:"Ngày"})});
}
pLich=function(m){
  const d=D(),r=calRange();
  m.innerHTML=H("Calendar","Video nào lên kênh nào, ngày nào · bấm một video để mở thẻ")+`<div class="lwtool">${calBar()}
   <div class="seg">${[["","Tất cả"]].concat(CHANNELS.map(c=>[c.k,c.short])).map(([k,t])=>`<button class="${LW.kenh===k?"on":""}" data-lwk="${esc(k)}">${esc(t)}</button>`).join("")}</div>
   <select id="lf-s" aria-label="Sản phẩm">${opt([["","Sản phẩm"]].concat(skOpts()),LF.sku)}</select><select id="lf-n" aria-label="Người làm">${opt([["","Người làm"]].concat(workers().map(u=>[u.id,u.name])),LF.nguoi)}</select>
   ${can(ME,"lich.sua_tat_ca")?`<span class="sp"></span><button class="btn pri" id="addc">+ Thêm nội dung</button>`:""}</div>${r.out?`<div class="note">Kỳ chọn ở trên nằm ngoài tháng ${MONTH.mon}, đang hiện tuần này.</div>`:""}<div id="lb"></div>`;
  bindCalBar(m);
  m.querySelectorAll("[data-lwk]").forEach(x=>x.onclick=()=>{LW.kenh=x.dataset.lwk;renderMain()});
  $("#lf-s").onchange=e=>{LF.sku=e.target.value;renderMain()};$("#lf-n").onchange=e=>{LF.nguoi=e.target.value;renderMain()};
  if($("#addc"))$("#addc").onclick=()=>{let id;const k=LW.kenh||"TikTok chính";DB.mutate(ME.name,"thêm nội dung "+k,dt=>{const c=newCard(dt,{sku:"BT",kenh:k,day:Math.max(dt.settings.today,r.tu)});dt.cards.push(c);id=c.id});renderMain();openCard(id)};
  const C=d.cards.filter(c=>(!LF.sku||c.sku===LF.sku)&&(!LF.nguoi||c.nguoi===LF.nguoi));
  if(r.den-r.tu<=6){/* tuần trở xuống: hàng = kênh, cột = ngày */
    const w0=WEEKS.find(w=>w.tu<=r.tu&&w.den>=r.tu)||WEEKS[0],save={...w0};w0.tu=r.tu;w0.den=r.den;LW.w=w0.w;try{lichTuan($("#lb"),C)}finally{w0.tu=save.tu;w0.den=save.den}}
  else calMonth($("#lb"),C,r);
};
PAGES.lich=pLich;
