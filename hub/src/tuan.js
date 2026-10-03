/* =====================================================================
   XẾP VIỆC TUẦN theo cách team làm thật:
   ① Kế hoạch tuần: tuần này làm bao nhiêu video mỗi sản phẩm × kênh, cái nào làm trước
   ② Video tồn: dùng video cũ trước
   ③ Buổi quay & hook: mỗi buổi quay (1–2 ngày/tuần) có danh sách hook chuẩn bị trước,
      one shot chỉ cần hook (Oanh duyệt cả danh sách), quay xong tick hook đã quay + ghi hook phát sinh
   ④ Edit · ⑤ Lịch đăng: nhịp đăng theo giai đoạn (trước sale đăng dày hơn), video duyệt xong
      tự xếp vào ô trống — sản phẩm đẩy chính được nhiều ô, sản phẩm ít video thì đăng cách ngày.
   Kế hoạch tháng chỉ là quỹ video (KPI + tuyến), không gắn ngày.
   ===================================================================== */
const cDay=c=>c.day||c.qday||0;
const WP_UU=[["truoc","Làm trước"],["sale","Đẩy cho sale"],["thuong","Bình thường"],["sau","Làm sau (còn video cũ)"]];
const wpKey=(sku,kenh)=>sku+"|"+kenh;
const wpOf=(d,w)=>((d.weekPlan||{})[w])||{};
const nhipOf=(kenh,day)=>{const R=(((D().settings||{}).nhip||{})[kenh]||[]).find(r=>day>=r.tu&&day<=r.den);return R?+R.sl:(slotsOf()[kenh]||0)};
/* số video / tuần của một sản phẩm ở một kênh: lấy kế hoạch tuần, chưa có thì lấy KPI tháng chia số tuần */
let perWeek=function(d,sku,kenh,day){const w=weekOf(day||d.settings.today)||1,e=wpOf(d,w)[wpKey(sku,kenh)];if(e&&+e.sl)return +e.sl;const p=d.products.find(x=>x.k===sku),k=p&&pKenhs(p).find(x=>x.kenh===kenh);return k&&+k.sl?+k.sl/(MONTH.ndays/7):3};
const uuRank=(d,c)=>{if((d.hot||[]).some(h=>h.sku===c.sku&&h.kenh===c.kenh&&d.settings.today<=h.den))return -1;const e=wpOf(d,weekOf(c.qday||d.settings.today)||1)[wpKey(c.sku,c.kenh)];return {sale:0,truoc:0,thuong:1,sau:2}[(e&&e.uu)||"thuong"]};
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

/* ---------- ① Kế hoạch tuần ---------- */
function xvTuan(b,o){
  const {d,W,days,give}=o,today=d.settings.today,w=days.length<=7?weekOf(W.tu):weekOf(today)||1,WW=WEEKS.find(x=>x.w===w)||WEEKS[0],wp=wpOf(d,w),pairs=ptPairs(),free=xvKhoFree();
  const inW=c=>{const x=cDay(c);return x>=WW.tu&&x<=WW.den};
  const rows=CHANNELS.map(ch=>{const P=pairs.filter(x=>x.kenh===ch.k);if(!P.length)return "";
    const cap=sum(xvDays(WW),x=>nhipOf(ch.k,x)),tot=sum(P,x=>+(wp[wpKey(x.sku,x.kenh)]||{}).sl||0);
    return `<tr class="grp"><td colspan="8"><b>${esc(ch.short)}</b> <span class="hint">· tuần này kế hoạch <b>${tot}</b> video · nhịp đăng cả tuần chứa được <b>${cap}</b> video ${tot>cap?pill("vượt nhịp đăng "+(tot-cap),"amb"):tot&&tot<cap?pill("còn "+(cap-tot)+" ô đăng trống","gry"):""}</span></td></tr>`+
    P.map(x=>{const k=wpKey(x.sku,x.kenh),e=wp[k]||{},C=d.cards.filter(c=>c.sku===x.sku&&c.kenh===x.kenh),made=C.length,left=Math.max(0,(x.sl||0)-made),kho=free.filter(q=>q.sku===x.sku).length,lam=C.filter(inW).length,prev=d.cards.filter(c=>c.sku===x.sku&&c.kenh===x.kenh&&(()=>{const pw=WEEKS.find(y=>y.w===w-1);const z=cDay(c);return pw&&z>=pw.tu&&z<=pw.den})()),don=sum(prev,c=>c.don||0);
      return `<tr><td>${swatch(x.sku)}<b>${esc(sk(x.sku).n)}</b>${pill(x.huong,x.huong==="Đẩy mạnh"?"pnk":"gry")}</td><td class="n">${x.sl||"—"}</td><td class="n">${made}${left?`<small>còn ${left}</small>`:""}</td><td class="n">${kho||"—"}</td><td class="n">${prev.length?`${prev.length} video<small>${don} đơn</small>`:"—"}</td>
       <td>${give?`<input type="number" min="0" class="num" data-wpsl="${esc(k)}" value="${e.sl||""}" placeholder="0">`:(e.sl||"—")}</td>
       <td>${give?`<select data-wpuu="${esc(k)}">${opt(WP_UU,e.uu||"thuong")}</select>`:esc((WP_UU.find(u=>u[0]===e.uu)||WP_UU[2])[1])}</td>
       <td class="n">${e.sl?`<b class="${lam>=e.sl?"t-grn":""}">${lam}/${e.sl}</b>`:lam||"—"}</td></tr>`}).join("")}).join("");
  b.innerHTML=`<section class="card flush"><div class="card-h pad"><h2>Kế hoạch tuần ${w} · ${dd(WW.tu)}–${dd(Math.min(WW.den,MONTH.ndays))}</h2><span class="hint">tuần này làm bao nhiêu video mỗi sản phẩm, cái nào làm trước · ${days.length>7?"đang xem cả tháng nên hiện tuần hiện tại, muốn đặt tuần khác thì chọn tuần ở ô thời gian trên cùng":""}</span></div>
   <div class="tbl"><table class="wptab"><thead><tr><th>Sản phẩm</th><th class="n">KPI tháng</th><th class="n">Đã làm</th><th class="n">Video tồn</th><th class="n">Tuần trước</th><th>Tuần này làm</th><th>Ưu tiên</th><th class="n">Đã lên hook / quay</th></tr></thead><tbody>${rows||`<tr><td colspan="8" class="empty">Chưa có sản phẩm nào trong kế hoạch tháng (Kế hoạch tháng › bước 5).</td></tr>`}</tbody></table></div>
   <p class="hint pad">Sản phẩm còn nhiều video cũ thì để "Làm sau" và dùng video tồn ở bước ②. Sản phẩm đang ra số tốt hoặc cần cho dịp sale thì để "Làm trước" / "Đẩy cho sale": khi xếp lịch đăng, các video này được xếp trước. Số "Tuần này làm" cũng quyết định sản phẩm được đăng dày hay cách ngày.</p></section>`;
  b.querySelectorAll("[data-wpsl],[data-wpuu]").forEach(x=>x.onchange=()=>{const k=x.dataset.wpsl||x.dataset.wpuu;DB.mutate(ME.name,"kế hoạch tuần "+w,dt=>{dt.weekPlan=dt.weekPlan||{};dt.weekPlan[w]=dt.weekPlan[w]||{};const e=dt.weekPlan[w][k]=dt.weekPlan[w][k]||{};if(x.dataset.wpsl)e.sl=Math.max(0,+x.value||0);else e.uu=x.value});toast("Đã lưu");renderMain()});
}

/* ---------- ③ Buổi quay & hook ---------- */
function xvQuay2(b,o){
  const {d,W,days,team,give}=o,dv=can(ME,"viec.duyet")||ME.role==="admin",sh=(d.shoots||[]).filter(s=>s.day>=W.tu&&s.day<=W.den).sort((a,c)=>a.day-c.day||(a.gio||"").localeCompare(c.gio||""));
  const qDef=team.find(u=>/quỳnh/i.test(u.name)),w=weekOf(W.tu)||1,wp=wpOf(d,w);
  const tOpts=()=>{const g=xvGroupBy(d.tuyen.slice(),t=>sk(t.sku).n+" · "+chOf(t.kenh).short);return g.map(([n,L])=>`<optgroup label="${esc(n)}">${L.map(t=>`<option value="${esc(t.ma)}">${esc(t.tuyen)}${t.vaiTro?" · "+esc(t.vaiTro):""}</option>`).join("")}</optgroup>`).join("")};
  const wait=d.cards.filter(c=>c.step==="quay"&&!c.buoiQuay);
  const sess=s=>{const I=d.cards.filter(c=>c.buoiQuay===s.id),chua=I.filter(c=>c.step==="dkb"),kb=I.filter(c=>c.step==="kb"),ok=I.filter(c=>c.step==="quay"),done=I.filter(c=>!["dkb","kb","quay","cg"].includes(c.step)),ps=I.filter(c=>c.phatSinh).length;
    const bySku=xvGroupBy(I,c=>c.sku+"|"+c.kenh);
    return `<section class="card xses2"><div class="card-h"><h2>🎬 ${dayLbl(s.day)} ${esc(s.gio||"")}</h2><span class="hint">${esc(s.diaDiem||"")} · quay: ${esc(s.nguoi.map(userName).join(", ")||"chưa có người")}</span><span class="sp"></span>${pill(s.trangThai||"Đã lên lịch",s.trangThai==="Đã quay"?"grn":"blu")}</div>
     <div class="xsum">${I.length} hook · ${chua.length?`<b class="t-amb">${chua.length} chờ Oanh duyệt</b> · `:""}${kb.length?`${kb.length} đang viết kịch bản · `:""}${ok.length} sẵn sàng quay · ${done.length} đã quay${ps?` (${ps} phát sinh)`:""}</div>
     ${bySku.map(([k,L])=>{const [sku,kenh]=k.split("|"),e=wp[k]||{};return `<div class="hkg"><div class="hkh">${swatch(sku)}<b>${esc(sk(sku).n)}</b> <span class="hint">${esc(chOf(kenh).short)} · ${L.length} hook${e.sl?` · kế hoạch tuần ${e.sl}`:""}</span></div>
      ${L.map(c=>{const t=d.tuyen.find(x=>x.ma===c.maTuyen);return `<div class="hkr">${c.step==="quay"&&give?`<input type="checkbox" data-hkq="${c.id}" ${c.daQuay?"checked":""} title="Đã quay">`:`<span class="hkst">${c.step==="dkb"?"⏳":["kb"].includes(c.step)?"✍":c.step==="quay"?"○":"✓"}</span>`}<span class="hkt clk" data-card="${c.id}">${esc(c.hookText||"(chưa có hook)")}</span><small>${esc(t?t.tuyen:"")}${c.oneShot?" · one shot":" · có kịch bản"}${c.phatSinh?" · phát sinh":""}</small>${give&&["dkb","kb","quay"].includes(c.step)&&!c.daQuay?`<button class="lnk danger" data-hkx="${c.id}" title="Bỏ hook">✕</button>`:""}</div>`}).join("")}</div>`}).join("")||`<p class="hint">Chưa có hook nào. Thêm ở dưới: mỗi dòng một hook = một video.</p>`}
     ${give&&s.trangThai!=="Đã quay"?`<div class="hkadd" data-hka="${s.id}"><select class="ht">${tOpts()}</select><select class="hl">${opt([["1","One shot: chỉ cần hook, Oanh duyệt cả danh sách"],["0","Review, voice off…: viết kịch bản, duyệt từng cái"]],"1")}</select><textarea class="hh" rows="2" placeholder="Gõ hook, mỗi dòng một hook"></textarea><button class="btn sm pri" data-hkadd="${s.id}">+ Thêm hook</button></div>`:""}
     <label class="field full">Cảnh trám / review cần quay (đủ dùng cho các video trong tuần)<textarea rows="2" data-tram="${s.id}" ${give?"":"disabled"} placeholder="Ví dụ: cảnh trám ngâm áo, cận bột tan, review cầm sản phẩm — đủ cho 12 video bột tẩy tuần này">${esc(s.tram||"")}</textarea></label>
     <div class="acts">${dv&&chua.length?`<button class="btn pri" data-hkok="${s.id}">✓ Duyệt danh sách hook (${chua.length})</button>`:""}
      ${give&&ok.length?`<button class="btn" data-hkdone="${s.id}">Chốt buổi quay: ${ok.filter(c=>c.daQuay).length} đã quay → sang Edit</button>`:""}
      ${give&&s.trangThai==="Đã quay"||give&&ok.length?`<span class="hkps"><select data-pst="${s.id}">${tOpts()}</select><input data-psh="${s.id}" placeholder="Hook phát sinh"><button class="btn sm" data-psadd="${s.id}">+ Hook phát sinh</button></span>`:""}</div></section>`};
  b.innerHTML=`${wait.length?`<div class="note">${wait.length} hook đã duyệt từ buổi trước chưa quay. ${give?`<button class="btn sm" id="hk-move">Chuyển vào buổi quay gần nhất</button>`:""}</div>`:""}
   ${sh.map(sess).join("")||`<section class="card"><p class="empty">Kỳ này chưa có buổi quay. Thêm buổi quay ở dưới.</p></section>`}
   ${give?`<section class="card"><div class="card-h"><h2>Thêm buổi quay</h2></div><form class="frm row7" id="xq-add"><label class="field">Ngày<select id="xs-d">${opt(days.map(x=>[x,dayLbl(x)]),Math.max(d.settings.today,W.tu)<=W.den?Math.max(d.settings.today,W.tu):W.tu)}</select></label><label class="field">Giờ<input id="xs-g" value="8:30"></label><label class="field">Địa điểm<input id="xs-p" value="Văn phòng Ailla"></label><label class="field">Người quay<select id="xs-n">${opt(team.map(u=>[u.id,u.name]),qDef?qDef.id:"")}</select></label><button class="btn pri">+ Thêm buổi quay</button></form></section>`:""}`;
  const S=id=>(D().shoots||[]).find(x=>x.id===id);
  b.querySelectorAll("[data-hkadd]").forEach(x=>x.onclick=()=>{const s=S(x.dataset.hkadd),f=x.closest(".hkadd"),t=d.tuyen.find(y=>y.ma===f.querySelector(".ht").value),one=f.querySelector(".hl").value==="1",L=f.querySelector(".hh").value.split("\n").map(v=>v.trim()).filter(Boolean);
    if(!t){toast("Chưa có tuyến nào, lập tuyến ở Kế hoạch tháng › bước 5");return}if(!L.length){toast("Gõ ít nhất một hook");f.querySelector(".hh").focus();return}
    DB.mutate(ME.name,`thêm ${L.length} hook buổi quay ${dd(s.day)}`,dt=>L.forEach(h=>{const by=s.nguoi[0]||"";dt.cards.push(newCard(dt,{sku:t.sku,kenh:t.kenh,maTuyen:t.ma,hookText:h,day:0,qday:s.day,buoiQuay:s.id,nguon:"Quay mới",loai:"moi",oneShot:one,dangVideo:t.dangVideo||(one?"One shot":undefined),step:one?"dkb":"kb",nguoi:by,nguoiKB:by}))}));
    toast(`Đã thêm ${L.length} hook`+(one?", chờ Oanh duyệt danh sách":", người quay viết kịch bản rồi gửi duyệt"));renderMain()});
  b.querySelectorAll("[data-hkx]").forEach(x=>x.onclick=()=>{DB.mutate(ME.name,"bỏ hook "+x.dataset.hkx,dt=>{dt.cards=dt.cards.filter(c=>c.id!==x.dataset.hkx)});renderMain()});
  b.querySelectorAll("[data-hkok]").forEach(x=>x.onclick=()=>{const id=x.dataset.hkok;let n=0;DB.mutate(ME.name,"duyệt danh sách hook buổi quay",dt=>dt.cards.forEach(c=>{if(c.buoiQuay===id&&c.step==="dkb"){c.step="quay";n++}}));toast(`Đã duyệt ${n} hook, sẵn sàng quay`);renderMain()});
  b.querySelectorAll("[data-hkq]").forEach(x=>x.onchange=()=>DB.mutate(ME.name,"đánh dấu đã quay "+x.dataset.hkq,dt=>{const c=dt.cards.find(y=>y.id===x.dataset.hkq);if(c)c.daQuay=x.checked}));
  b.querySelectorAll("[data-hkdone]").forEach(x=>x.onclick=()=>{const id=x.dataset.hkdone;let a=0,r=0;DB.mutate(ME.name,"chốt buổi quay",dt=>{const s=dt.shoots.find(y=>y.id===id);if(s)s.trangThai="Đã quay";dt.cards.forEach(c=>{if(c.buoiQuay!==id||c.step!=="quay")return;if(c.daQuay){c.step="edit";c.nguoi="";c.nguoiEdit="";a++}else{c.buoiQuay="";r++}})});toast(`${a} video sang Edit${r?`, ${r} hook chưa quay chuyển sang buổi sau`:""}`);XV.tab="edit";renderMain()});
  b.querySelectorAll("[data-psadd]").forEach(x=>x.onclick=()=>{const id=x.dataset.psadd,s=S(id),t=d.tuyen.find(y=>y.ma===b.querySelector(`[data-pst="${id}"]`).value),h=b.querySelector(`[data-psh="${id}"]`).value.trim();if(!t||!h){toast("Chọn tuyến và gõ hook phát sinh");return}
    DB.mutate(ME.name,"hook phát sinh buổi quay "+dd(s.day),dt=>dt.cards.push(newCard(dt,{sku:t.sku,kenh:t.kenh,maTuyen:t.ma,hookText:h,day:0,qday:s.day,buoiQuay:id,nguon:"Quay mới",loai:"moi",oneShot:true,phatSinh:true,dangVideo:t.dangVideo||"One shot",step:"edit",nguoi:"",nguoiEdit:""})));toast("Đã ghi hook phát sinh, giao người edit ở ④");renderMain()});
  b.querySelectorAll("[data-tram]").forEach(x=>x.onchange=()=>DB.mutate(ME.name,"ghi cảnh trám buổi quay",dt=>{const s=dt.shoots.find(y=>y.id===x.dataset.tram);if(s)s.tram=x.value}));
  if($("#hk-move"))$("#hk-move").onclick=()=>{const nx=(D().shoots||[]).filter(s=>s.trangThai!=="Đã quay"&&s.day>=D().settings.today).sort((a,c)=>a.day-c.day)[0];if(!nx){toast("Chưa có buổi quay sắp tới, thêm buổi quay trước");return}DB.mutate(ME.name,"chuyển hook chưa quay sang buổi "+dd(nx.day),dt=>dt.cards.forEach(c=>{if(c.step==="quay"&&!c.buoiQuay){c.buoiQuay=nx.id;c.qday=nx.day}}));renderMain()};
  if($("#xq-add"))$("#xq-add").onsubmit=e=>{e.preventDefault();DB.mutate(ME.name,"lên lịch quay",dt=>{dt.shoots=dt.shoots||[];dt.shoots.push({id:uid("sq"),day:+$("#xs-d").value,gio:$("#xs-g").value,diaDiem:$("#xs-p").value,nguoi:[$("#xs-n").value].filter(Boolean),ghiChu:"",tram:"",trangThai:"Đã lên lịch"})});toast("Đã thêm buổi quay");renderMain()};
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
   <p class="hint">Người giữ kênh tự chọn ngày đăng cho từng video. Số cạnh mỗi ngày là đã xếp / nhịp đăng của kênh, để cân: sản phẩm đẩy chính đăng dày hơn, sản phẩm ít video thì đăng cách ngày, video "Làm trước" / "Đẩy cho sale" xếp sớm. Đổi ngày sau này ở thẻ video hoặc Calendar.</p></section>
  <section class="card flush"><div class="card-h pad"><h2>7 ngày tới</h2><span class="hint">đã xếp / nhịp đăng</span></div><div class="tbl"><table><thead><tr><th>Kênh</th>${D7.map(x=>`<th class="n">${dayLbl(x)}</th>`).join("")}</tr></thead><tbody>${CHANNELS.map(ch=>`<tr><td><b>${esc(ch.short)}</b><small>giữ kênh: ${esc(userName(chanOwner(ch.k))||"chưa đặt")}</small></td>${D7.map(x=>{const L=d.cards.filter(c=>c.kenh===ch.k&&c.day===x),cap=nhipOf(ch.k,x);return `<td class="n"><b class="${L.length>cap?"t-red":L.length===cap&&cap?"t-grn":""}">${L.length}</b>/${cap}<small>${esc(xvGroupBy(L,c=>c.sku).map(([k,l])=>sk(k).n.split(" ")[0]+" "+l.length).join(", "))}</small></td>`}).join("")}</tr>`).join("")}</tbody></table></div></section>`;
  b.querySelectorAll("[data-nhadd]").forEach(x=>x.onclick=()=>{const k=x.dataset.nhadd,f=x.closest(".nhadd"),a=+f.querySelector(".a").value,z=+f.querySelector(".z").value,n=+f.querySelector(".n").value;if(!n&&n!==0||f.querySelector(".n").value===""){toast("Gõ số video/ngày");return}DB.mutate(ME.name,"nhịp đăng "+k,dt=>{dt.settings.nhip=dt.settings.nhip||{};dt.settings.nhip[k]=(dt.settings.nhip[k]||[]).concat({tu:Math.min(a,z),den:Math.max(a,z),sl:n}).sort((p,q)=>p.tu-q.tu)});renderMain()});
  b.querySelectorAll("[data-nhx]").forEach(x=>x.onclick=()=>{const [k,i]=x.dataset.nhx.split("|");DB.mutate(ME.name,"bỏ giai đoạn nhịp đăng",dt=>dt.settings.nhip[k].splice(+i,1));renderMain()});
  if($("#hot-open"))$("#hot-open").onclick=()=>openHot();
  b.querySelectorAll("[data-setday]").forEach(x=>x.onchange=()=>{if(!x.value)return;DB.mutate(ME.name,"xếp ngày đăng "+x.dataset.setday+" → "+dd(+x.value),dt=>{const c=dt.cards.find(y=>y.id===x.dataset.setday);if(c)c.day=+x.value});toast("Đã xếp ngày đăng "+dd(+x.value));renderMain()});
}

/* ---------- Trang Xếp việc tuần (thay bản cũ) ---------- */
function pXepViec2(m){
  const d=D(),W=xvWeek(),days=xvDays(W),WC=d.cards.filter(c=>xvIn(c,W)),team=xvTeam(),give=xvGive(),free=xvKhoFree();
  const slots=WC.filter(isPH);
  const kbPool=d.cards.filter(c=>["moi","worker"].includes(loaiOf(c))&&!isPH(c)&&(c.step==="cg"||(c.step==="kb"&&!c.nguoi)));
  const ePool=d.cards.filter(c=>(c.step==="edit"&&!c.nguoiEdit)||(c.step==="cg"&&["reup","nhanban"].includes(loaiOf(c))&&!isPH(c))).sort((a,b)=>cDay(a)-cDay(b));
  const hkWait=d.cards.filter(c=>c.buoiQuay&&c.step==="dkb").length,un=d.cards.filter(c=>!c.day&&["edit","worker","dvd","dceo","dang"].includes(c.step)).length;
  const tabs=[["tuan","① Kế hoạch tuần",0],["kho","② Video tồn",slots.length],["quay","③ Buổi quay & hook",hkWait],["wk","Video không quay (Worker)",d.cards.filter(c=>loaiOf(c)==="worker"&&["kb","dkb"].includes(c.step)).length],["kb","Kịch bản (nếu có)",kbPool.length],["edit","④ Edit",ePool.length],["dang","⑤ Lịch đăng",un]];
  if(!tabs.some(t=>t[0]===XV.tab))XV.tab="tuan";
  m.innerHTML=H("Xếp việc tuần",`${xvLbl(W)} · làm lần lượt từ ① đến ⑤, bước nào có số là còn việc`)+`<div class="lwtool"><div class="seg xvtabs">${tabs.map(([k,t,n])=>`<button data-xvt="${k}" class="${XV.tab===k?"on":""}">${t}${n?` <span class="xbadge">${n}</span>`:""}</button>`).join("")}</div></div><div id="xvb"></div>`;
  m.querySelectorAll("[data-xvt]").forEach(b=>b.onclick=()=>{XV.tab=b.dataset.xvt;XV.sel.clear();renderMain()});
  const b=$("#xvb"),o={d,W,days,WC,team,give,slots,free,kbPool,qPool:[],ePool,post:WC.filter(c=>c.step==="dang")};
  ({tuan:xvTuan,kho:xvKho,quay:xvQuay2,wk:xvWorker,kb:xvKB,edit:xvEdit,dang:xvDang2})[XV.tab](b,o);
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
    $("#hot-info").innerHTML=`<dl class="kv"><dt>Cần đăng</dt><dd><b>${need}</b> video trong ${$("#hot-d").value} ngày tới</dd><dt>Đã có sẵn</dt><dd><b>${ready}</b> video đang edit / chờ duyệt / chờ đăng</dd><dt>Video tồn</dt><dd><b>${kho}</b> video trong kho (xếp ở Xếp việc tuần › ② Video tồn)</dd><dt>Còn thiếu</dt><dd>${thieu?`<b class="t-red">${thieu}</b> video → cộng vào kế hoạch tuần (làm trước) và giao việc quay gấp`:`<b class="t-grn">đủ</b>`}</dd></dl>
     <p class="hint">Bấm "Đẩy lên ngay": người giữ kênh ${esc(chOf(kenh).short)} (${esc(userName(chanOwner(kenh))||"chưa đặt")}) nhận việc tự xếp lại lịch đăng, đưa sản phẩm này lên trước${thieu?"; Oanh nhận việc lên hook quay gấp":""}.</p>`;return {sku,kenh,need,ready,kho,thieu}};
  ["#hot-p","#hot-n","#hot-d"].forEach(s=>$(s).oninput=$(s).onchange=info);info();
  $("#hot-go").onclick=()=>{const r=info(),per=+$("#hot-n").value||1,nd=+$("#hot-d").value||1,w=weekOf(today)||1,lead=(d.users.find(u=>u.role==="lead"&&u.active)||{}).id||ME.id,own=chanOwner(r.kenh);
    DB.mutate(ME.name,`đẩy gấp ${sk(r.sku).n} ở ${r.kenh}`,dt=>{
      dt.weekPlan=dt.weekPlan||{};dt.weekPlan[w]=dt.weekPlan[w]||{};const e=dt.weekPlan[w][wpKey(r.sku,r.kenh)]=dt.weekPlan[w][wpKey(r.sku,r.kenh)]||{};e.uu="sale";e.sl=Math.max(+e.sl||0,per*7);if(r.thieu)e.sl=(+e.sl||0)+0;
      dt.hot=(dt.hot||[]).filter(h=>!(h.sku===r.sku&&h.kenh===r.kenh)).concat({sku:r.sku,kenh:r.kenh,tu:today,den:Math.min(MONTH.ndays,today+nd-1),sl:per,at:new Date().toLocaleString("vi-VN"),by:ME.name});
      const t=(ten,nguoi,mo)=>dt.tasks.push({id:uid("tk"),ten,loai:"Điều chỉnh do xu hướng",nguoi,han:Math.min(MONTH.ndays,today+1),moTa:mo,team:"content",da:"",phoi:[],uu:"Cao",st:"todo",checklist:[],tao:ME.id,kq:""});
      if(own)t(`Điều chỉnh lịch ${chOf(r.kenh).short}: đẩy ${sk(r.sku).n} lên`,own,`${sk(r.sku).n} đang lên xu hướng. Tự xếp lại lịch đăng ${r.kenh} từ ${dd(today)}: mỗi ngày ${per} video ${sk(r.sku).n} trong ${nd} ngày, đưa video sản phẩm này lên trước (dùng cả video tồn nếu có). Xếp ở Xếp việc tuần › ⑤ Lịch đăng hoặc Calendar.`);
      if(r.thieu)t(`Quay gấp ${r.thieu} video ${sk(r.sku).n}`,lead,`Thiếu ${r.thieu} video ${sk(r.sku).n} cho ${r.kenh} để đẩy xu hướng. Lên danh sách hook ở Xếp việc tuần › ③ Buổi quay & hook (đã cộng vào kế hoạch tuần, ưu tiên làm trước).`)});
    closeDrawer();toast(`Đã giao việc điều chỉnh lịch cho người giữ kênh${r.thieu?`, giao việc quay gấp ${r.thieu} video`:""}`);renderMain()};
}
/* Hệ số ưu tiên cho sản phẩm đang đẩy gấp trong khoảng ngày */
const _perWeek0=perWeek;
perWeek=function(d,sku,kenh,day){const h=(d.hot||[]).find(x=>x.sku===sku&&x.kenh===kenh&&(day||d.settings.today)<=x.den);return h?Math.max(_perWeek0(d,sku,kenh,day),h.sl*7):_perWeek0(d,sku,kenh,day)};

/* ---------- Video không quay: cảnh cũ trong kho cảnh + Worker dựng, tạo voice ----------
   cách A: Worker tự viết kịch bản + voice → Oanh duyệt video → chị duyệt → đăng
   cách B: nhân sự viết kịch bản → Oanh duyệt kịch bản → Worker dựng + voice → duyệt video → đăng */
LOAI_V.worker="Không quay · Worker dựng";
const _nextActTuan=nextAct;
nextAct=function(c){if(loaiOf(c)==="worker"){if(c.step==="kb")return ["Gửi Oanh duyệt kịch bản","dkb"];if(c.step==="dkb")return ["Duyệt kịch bản, gửi Worker dựng","worker"]}return _nextActTuan(c)};
function xvWorker(b,o){
  const {d,W,team,give}=o,today=d.settings.today,L=d.cards.filter(c=>loaiOf(c)==="worker"&&xvIn(c,W));
  const tOpts=xvGroupBy(d.tuyen.slice(),t=>sk(t.sku).n+" · "+chOf(t.kenh).short).map(([n,T])=>`<optgroup label="${esc(n)}">${T.map(t=>`<option value="${esc(t.ma)}">${esc(t.tuyen)}${t.vaiTro?" · "+esc(t.vaiTro):""}</option>`).join("")}</optgroup>`).join("");
  const G=[["Nhân sự đang viết kịch bản",c=>c.step==="kb"],["Chờ Oanh duyệt kịch bản",c=>c.step==="dkb"],["Worker đang dựng",c=>c.step==="worker"],["Chờ duyệt video",c=>["dvd","dceo"].includes(c.step)],["Chờ đăng / đã đăng",c=>["dang","xong"].includes(c.step)]];
  b.innerHTML=`<section class="card"><div class="card-h"><h2>Video không quay</h2><span class="hint">dùng cảnh cũ trong kho cảnh, Worker dựng và tạo voice · không cần buổi quay</span></div>
   ${give?`<form class="frm row7" id="wk-add"><label class="field">Tuyến (sản phẩm · kênh)<select id="wk-t">${tOpts}</select></label><label class="field">Số video<input id="wk-n" type="number" min="1" value="3"></label>
    <label class="field">Cách làm<select id="wk-m">${opt([["A","Worker viết kịch bản + voice"],["B","Nhân sự viết kịch bản, Worker dựng + voice"]],"A")}</select></label>
    <label class="field">Người phụ trách triển khai<select id="wk-p">${opt([["","—"]].concat(team.map(u=>[u.id,u.name])),"")}</select></label>
    <label class="field">Ghi chú cho Worker (cảnh dùng, giọng…)<input id="wk-g" placeholder="vd: cảnh ngâm áo kho tháng 9, giọng nữ miền Bắc"></label><button class="btn pri">+ Tạo video</button></form>`:""}
   <p class="hint">Mỗi video đều giao cho một người phụ trách triển khai. Cách A: người phụ trách chọn cảnh trong kho cảnh, cho Worker viết kịch bản + voice và dựng, kiểm tra rồi gửi Oanh duyệt video, sau đó chị duyệt. Cách B: người phụ trách viết kịch bản, Oanh duyệt kịch bản, Worker dựng + tạo voice, người phụ trách kiểm tra rồi gửi duyệt video.</p></section>
  <section class="card"><div class="card-h"><h2>Trong kỳ</h2><span class="hint">${L.length} video</span></div>${G.map(([t,f])=>{const I=L.filter(f);return I.length?`<div class="xgrp">${t} · ${I.length}</div><div class="xlist">${I.map(c=>xvMini(c,`<span class="xms">${esc(sk(c.sku).n.split(" ")[0])} · ${c.wkMode==="B"?"NS viết":"Worker viết"} · ${esc(userName(c.nguoi)||"chưa giao")}</span>`)).join("")}</div>`:""}).join("")||`<p class="empty">Chưa có video nào.</p>`}</section>`;
  if($("#wk-add"))$("#wk-add").onsubmit=e=>{e.preventDefault();const t=d.tuyen.find(y=>y.ma===$("#wk-t").value),n=Math.max(1,+$("#wk-n").value||1),mo=$("#wk-m").value,p=$("#wk-p").value,g=$("#wk-g").value;
    if(!t){toast("Chưa có tuyến nào, lập tuyến ở Kế hoạch tháng › bước 5");return}if(!p){toast("Chọn người phụ trách triển khai");$("#wk-p").focus();return}
    const ids=[];DB.mutate(ME.name,`tạo ${n} video không quay (Worker) ${sk(t.sku).n}`,dt=>{for(let i=0;i<n;i++){const c=newCard(dt,{sku:t.sku,kenh:t.kenh,maTuyen:t.ma,day:0,qday:Math.max(today,W.tu),nguon:"Kho cảnh + Worker",loai:"worker",wkMode:mo,dangVideo:"Giọng đọc (Adam/AI)",nguoiDung:"Worker",ghiChuWorker:g,step:mo==="A"?"worker":"kb",nguoi:p,nguoiKB:mo==="B"?p:"",nguoiEdit:p});dt.cards.push(c);ids.push(c.id)}});
    if(mo==="A"&&typeof simulateWorker==="function")ids.forEach(simulateWorker);
    toast(`Đã tạo ${n} video, giao ${userName(p)}`+(mo==="A"?" theo dõi Worker dựng":" viết kịch bản"));renderMain()};
}
