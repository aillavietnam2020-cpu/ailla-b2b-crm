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
const WP_UU=[["","Chưa xếp"],["p1","P1"],["p2","P2"],["p3","P3"],["p4","P4"]];
const uuN=u=>({truoc:"p1",sale:"p1",thuong:"",sau:"p4"})[u]??(u||""); // đổi giá trị cũ sang P1–P4
const wpKey=(sku,kenh)=>sku+"|"+kenh;
const wpOf=(d,w)=>((d.weekPlan||{})[w])||{};
const nhipOf=(kenh,day)=>{const R=(((D().settings||{}).nhip||{})[kenh]||[]).find(r=>day>=r.tu&&day<=r.den);return R?+R.sl:(slotsOf()[kenh]||0)};
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
const MIX=[["ton","Dùng video tồn","kho","đăng lại video cũ trong kho"],["oneshot","One shot","quay","quay, chỉ cần hook"],["kichban","Review / voice off","quay","quay, có kịch bản"],["worker","Không quay · Worker","wk","cảnh cũ + Worker dựng"],["reup","Reup","kho","video cũ đổi hook / edit lại"],["nhanban","Nhân bản win","win","Hypit nhân bản video win"]];
const VID_STEPS=["dvd","dceo","dang","xong"];
const mixOf=c=>{if(c.mix)return c.mix;const L=loaiOf(c);if(c.khoMa)return L==="kho"?"ton":"reup";if(L==="worker")return "worker";if(L==="nhanban")return "nhanban";if(L==="reup")return "reup";if(L==="kho")return "ton";return c.oneShot||c.phatSinh?"oneshot":"kichban"};
const wpMix=e=>e&&e.mix?e.mix:{};
const wpTot=e=>{const m=wpMix(e);const s=Object.values(m).reduce((a,b)=>a+(+b||0),0);return s||(+((e||{}).sl)||0)};
function wpWeekNo(d,W,days){return days.length<=7?weekOf(W.tu):weekOf(d.settings.today)||1}
let WP_OPEN=new Set();
function xvTuan(b,o){
  const {d,W,days,give,team}=o,today=d.settings.today,w=wpWeekNo(d,W,days),WW=WEEKS.find(x=>x.w===w)||WEEKS[0],wp=wpOf(d,w),pairs=ptPairs(),free=xvKhoFree();
  const inW=c=>{const x=cDay(c);return x>=WW.tu&&x<=WW.den};
  const pw=WEEKS.find(y=>y.w===w-1);
  const block=x=>{const k=wpKey(x.sku,x.kenh),e=wp[k]||{},m=wpMix(e),C=d.cards.filter(c=>c.sku===x.sku&&c.kenh===x.kenh),CW=C.filter(inW),tot=wpTot(e),kho=free.filter(q=>q.sku===x.sku).length,prev=pw?C.filter(c=>{const z=cDay(c);return z>=pw.tu&&z<=pw.den}):[],op=WP_OPEN.has(k);
    const p=tot?Math.min(100,Math.round(CW.length/tot*100)):0;
    return `<div class="wpb${op?" open":""}"><div class="wph" data-wpo="${esc(k)}"><i class="ptar">${op?"▾":"▸"}</i>${swatch(x.sku)}<b>${esc(sk(x.sku).n)}</b>${pill(x.huong,x.huong==="Đẩy mạnh"?"pnk":"gry")}
      <span class="wpt">tuần này <b>${tot||0}</b> video · đã làm <b>${CW.length}</b></span><span class="xlbar wpbar"><i style="width:${p}%;background:${p>=100?"#2f9e44":"#4b54d1"}"></i></span>
      <span class="sp"></span>${give?`<select data-wpuu="${esc(k)}" title="Mức ưu tiên tuần này">${opt(WP_UU,uuN(e.uu))}</select>`:pill((WP_UU.find(u=>u[0]===uuN(e.uu))||WP_UU[0])[1])}</div>
     ${op?`<div class="wpi"><span>KPI tháng <b>${x.sl||"—"}</b></span><span>đã làm cả tháng <b>${C.length}</b>${x.sl&&x.sl>C.length?` · còn ${x.sl-C.length}`:""}</span><span>video tồn trong kho <b>${kho}</b>${(+m.ton||0)+(+m.reup||0)?` (tuần này dùng ${(+m.ton||0)+(+m.reup||0)})`:""}</span><span>sản xuất mới <b>${["oneshot","kichban","worker","nhanban"].reduce((a,t)=>a+(+m[t]||0),0)}</b></span><span>tuần trước <b>${prev.length}</b> video · ${sum(prev,c=>c.don||0)} đơn</span></div>
     ${[["Dùng video cũ",["ton","reup"]],["Sản xuất mới",["oneshot","kichban","worker","nhanban"]]].map(([gt,ts])=>`<div class="wpgh">${gt} <b>${ts.reduce((a,t)=>a+(+m[t]||0),0)}</b> video · đã làm ${CW.filter(c=>ts.includes(mixOf(c))).length}</div><div class="wpm">${MIX.filter(z=>ts.includes(z[0])).map(([t,lb,tab,hint])=>{const n=+m[t]||0,G=CW.filter(c=>mixOf(c)===t),TK=t==="nhanban"?(d.tasks||[]).filter(x=>x.mix==="nhanban"&&x.sku===x.sku&&x.sku===(k.split("|")[0])&&x.kenh===k.split("|")[1]&&x.wk===w):[],dn=G.length+sum(TK,x=>x.sl||1),vid=G.filter(c=>VID_STEPS.includes(c.step)).length+sum(TK.filter(x=>x.st==="done"),x=>x.sl||1),who=xvGroupBy(G,c=>c.giao||c.nguoiKB||c.nguoi||"").concat(TK.map(x=>[x.nguoi,Array(x.sl||1).fill(0)]));return `<div class="wpc${n&&vid>=n?" ok":""}"><div class="wpcl"><b>${lb}</b><small>${hint}</small></div>
       ${give?`<input type="number" min="0" class="num" data-wpm="${esc(k)}|${t}" value="${n||""}" placeholder="0">`:`<b>${n||"—"}</b>`}<span class="wpcd">đã giao <b class="${n&&dn<n?"t-amb":""}">${dn}</b>${n?`/${n}`:""} · có video <b>${vid}</b></span>${who.length?`<span class="wpwho">${who.map(([u,L])=>`${esc(userName(u)||"chưa có người")} ${L.length}`).join(" · ")}</span>`:""}
       ${give&&n&&dn<n?`<div class="wpas" data-wpas="${esc(k)}|${t}"><small>Giao cho (còn ${n-dn}):</small>${team.map(u=>`<label class="wpu"><span>${esc(u.name)}</span><input type="number" min="0" class="num" data-wpu="${u.id}" placeholder="0"></label>`).join("")}<div class="wpdt"><label>Bắt đầu<select data-wpbd>${opt(Array.from({length:MONTH.ndays},(_,i)=>[i+1,dd(i+1)]),today)}</select></label><label>Hạn xong<select data-wphan>${opt(Array.from({length:MONTH.ndays},(_,i)=>[i+1,dd(i+1)]),defHan(d,WW,t))}</select></label></div><button class="btn sm pri" data-wpa="${esc(k)}|${t}">Giao</button></div>`:""}
       <button class="btn sm ghost" data-wpgo="${esc(k)}|${t}" title="Sang bước làm loại video này, chọn sẵn sản phẩm">${{ton:"Xem ② Video tồn →",reup:"Xem video reup →",oneshot:"Xem ③ Buổi quay & hook →",kichban:"Xem kịch bản →",worker:"Xem video Worker →",nhanban:"Sang Video win →"}[t]}</button>${n&&vid>=n?`<small class="t-grn">đủ video tuần này</small>`:""}</div>`}).join("")}</div>`).join("")}`:`<div class="ptmini">${MIX.filter(([t])=>+m[t]).map(([t,lb])=>`${lb} ${CW.filter(c=>mixOf(c)===t).length}/${m[t]}`).join(" · ")||(e.sl?`${e.sl} video, chưa chia loại`:"chưa đặt")} · <span class="lnk">bấm để chia theo loại</span></div>`}</div>`};
  const chs=CHANNELS.map(ch=>{const P=pairs.filter(x=>x.kenh===ch.k);if(!P.length)return "";const cap=sum(xvDays(WW),x=>nhipOf(ch.k,x)),tot=sum(P,x=>wpTot(wp[wpKey(x.sku,x.kenh)]));
    return `<div class="wpch"><div class="ptsum"><b>${esc(ch.short)}</b> · tuần này kế hoạch <b>${tot}</b> video · nhịp đăng cả tuần chứa được <b>${cap}</b> ${tot>cap?pill("vượt nhịp đăng "+(tot-cap),"amb"):tot&&tot<cap?pill("còn "+(cap-tot)+" ô đăng trống","gry"):""}</div>${P.map(block).join("")}</div>`}).join("");
  b.innerHTML=`<section class="card"><div class="card-h"><h2>Kế hoạch tuần ${w} · ${dd(WW.tu)}–${dd(Math.min(WW.den,MONTH.ndays))}</h2><span class="hint">mở từng sản phẩm, chia số video tuần này theo loại rồi giao cho nhân sự ngay trong từng ô${days.length>7?" · đang xem cả tháng nên hiện tuần hiện tại":""}</span></div>
   ${chs||`<p class="empty">Chưa có sản phẩm nào trong kế hoạch tháng (Kế hoạch tháng › bước 5).</p>`}
   <p class="hint">Ưu tiên P1 → P4: P1 cao nhất. Người giữ kênh nhìn mức ưu tiên này khi tự xếp ngày đăng, sản phẩm P1 lên trước.</p></section>`;
  b.querySelectorAll("[data-wpo]").forEach(h=>h.onclick=e=>{if(e.target.closest("input,select,button"))return;const k=h.dataset.wpo;WP_OPEN.has(k)?WP_OPEN.delete(k):WP_OPEN.add(k);renderMain()});
  b.querySelectorAll("[data-wpuu]").forEach(x=>x.onchange=()=>{const k=x.dataset.wpuu;DB.mutate(ME.name,"ưu tiên tuần "+w,dt=>{dt.weekPlan=dt.weekPlan||{};dt.weekPlan[w]=dt.weekPlan[w]||{};(dt.weekPlan[w][k]=dt.weekPlan[w][k]||{}).uu=x.value});toast("Đã lưu")});
  b.querySelectorAll("[data-wpm]").forEach(x=>x.onchange=()=>{const [sku,kenh,t]=x.dataset.wpm.split("|"),k=wpKey(sku,kenh);DB.mutate(ME.name,"kế hoạch tuần "+w+" "+sk(sku).n,dt=>{dt.weekPlan=dt.weekPlan||{};dt.weekPlan[w]=dt.weekPlan[w]||{};const e=dt.weekPlan[w][k]=dt.weekPlan[w][k]||{};e.mix=e.mix||{};e.mix[t]=Math.max(0,+x.value||0);e.sl=Object.values(e.mix).reduce((a,b)=>a+(+b||0),0)});toast("Đã lưu");renderMain()});
  b.querySelectorAll("[data-wpgo]").forEach(x=>x.onclick=()=>{const [s2,k2,t2]=x.dataset.wpgo.split("|");if(t2==="kichban"){XV.sku=s2;XV.kenh=k2;XV.mix=t2;XV.tab="kb";renderMain();scrollTo(0,0)}else wpGo(s2,k2,t2)});
  b.querySelectorAll("[data-wpa]").forEach(x=>x.onclick=()=>{const v=x.dataset.wpa,[sku,kenh,t]=v.split("|"),box=x.closest(".wpas"),L=[...box.querySelectorAll("[data-wpu]")].map(i=>[i.dataset.wpu,Math.max(0,+i.value||0)]).filter(z=>z[1]);if(!L.length){toast("Điền số video cho ít nhất một người");return}const bd=+box.querySelector("[data-wpbd]").value,hn=+box.querySelector("[data-wphan]").value;if(hn<bd){toast("Hạn xong phải sau ngày bắt đầu");return}const out=L.map(([u,n])=>{wpAssign(sku,kenh,t,u,n,w,bd,hn);return userName(u)+" "+n});toast("Đã giao: "+out.join(", "));renderMain()});
}
/* Sang đúng bước, chọn sẵn sản phẩm × kênh và loại video */
function wpGo(sku,kenh,t){const mx=MIX.find(x=>x[0]===t);XV.sku=sku;XV.kenh=kenh;XV.mix=t;if(mx[2]==="win"){MOD="mkt";PAGE="win";render();scrollTo(0,0);return}XV.tab=mx[2];XV.sel.clear();renderMain();scrollTo(0,0)}
/* Dải "Tuần này cần làm" ở các bước: lấy từ kế hoạch tuần */
function wpStrip(d,W,days,types){
  const w=wpWeekNo(d,W,days),WW=WEEKS.find(x=>x.w===w)||WEEKS[0],wp=wpOf(d,w),inW=c=>{const x=cDay(c);return x>=WW.tu&&x<=WW.den};
  const items=ptPairs().map(x=>{const m=wpMix(wp[wpKey(x.sku,x.kenh)]),parts=types.filter(t=>+m[t]).map(t=>{const n=+m[t],dn=d.cards.filter(c=>c.sku===x.sku&&c.kenh===x.kenh&&inW(c)&&mixOf(c)===t).length;return {t,n,dn}});return {x,parts}}).filter(i=>i.parts.length);
  if(!items.length)return `<div class="wpstrip"><span class="hint">Tuần ${w} chưa chia số video cho bước này. Đặt ở ① Kế hoạch tuần.</span></div>`;
  return `<div class="wpstrip"><b>Tuần ${w} cần làm:</b>${items.map(({x,parts})=>{const on=XV.sku===x.sku&&XV.kenh===x.kenh;return `<button type="button" class="wpq${on?" on":""}" data-wpq="${esc(x.sku)}|${esc(x.kenh)}|${parts[0].t}">${swatch(x.sku)}${esc(sk(x.sku).n)} · ${esc(chOf(x.kenh).short)}: ${parts.map(p=>`${(MIX.find(z=>z[0]===p.t)||[])[1]} <b class="${p.dn>=p.n?"t-grn":""}">${p.dn}/${p.n}</b>`).join(" · ")}</button>`}).join("")}${XV.sku?`<button type="button" class="chipx" data-wpq="">Bỏ chọn ${esc(sk(XV.sku).n)} ✕</button>`:""}</div>`;
}

/* ---------- ③ Buổi quay & hook ---------- */
function xvQuay2(b,o){
  const {d,W,days,team,give}=o,dv=can(ME,"viec.duyet")||ME.role==="admin",sh=(d.shoots||[]).filter(s=>(s.day>=W.tu&&s.day<=W.den)||(s.day>=d.settings.today&&s.trangThai!=="Đã quay")).sort((a,c)=>a.day-c.day||(a.gio||"").localeCompare(c.gio||""));
  const qDef=team.find(u=>/quỳnh/i.test(u.name)),w=weekOf(W.tu)||1,wp=wpOf(d,w);
  const tOpts=()=>{const g=xvGroupBy(d.tuyen.slice(),t=>sk(t.sku).n+" · "+chOf(t.kenh).short);return g.map(([n,L])=>`<optgroup label="${esc(n)}">${L.map(t=>`<option value="${esc(t.ma)}">${esc(t.tuyen)}${t.vaiTro?" · "+esc(t.vaiTro):""}</option>`).join("")}</optgroup>`).join("")};
  const wait=d.cards.filter(c=>c.step==="quay"&&!c.buoiQuay);
  const sess=s=>{const I=d.cards.filter(c=>c.buoiQuay===s.id),chua=I.filter(c=>c.step==="dkb"),kb=I.filter(c=>c.step==="kb"),ok=I.filter(c=>c.step==="quay"),done=I.filter(c=>!["dkb","kb","quay","cg"].includes(c.step)),ps=I.filter(c=>c.phatSinh).length;
    const bySku=xvGroupBy(I,c=>c.sku+"|"+c.kenh);
    return `<section class="card xses2"><div class="card-h"><h2>🎬 ${dayLbl(s.day)} · ${esc(s.buoi||"")}${s.gio?" "+esc(s.gio):""}</h2><span class="hint">${esc(s.diaDiem||"")} · quay: ${esc(s.nguoi.map(userName).join(", ")||"chưa có người")}</span><span class="sp"></span>${pill(s.trangThai||"Đã lên lịch",s.trangThai==="Đã quay"?"grn":"blu")}</div>
     <div class="xsum">${I.length} hook · ${chua.length?`<b class="t-amb">${chua.length} chờ Oanh duyệt</b> · `:""}${kb.length?`${kb.length} đang viết kịch bản · `:""}${ok.length} sẵn sàng quay · ${done.length} đã quay${ps?` (${ps} phát sinh)`:""}</div>
     ${bySku.map(([k,L])=>{const [sku,kenh]=k.split("|"),e=wp[k]||{};return `<div class="hkg"><div class="hkh">${swatch(sku)}<b>${esc(sk(sku).n)}</b> <span class="hint">${esc(chOf(kenh).short)} · ${L.length} hook${e.sl?` · kế hoạch tuần ${e.sl}`:""}</span></div>
      ${L.map(c=>{const t=d.tuyen.find(x=>x.ma===c.maTuyen);return `<div class="hkr">${c.step==="quay"&&give?`<input type="checkbox" data-hkq="${c.id}" ${c.daQuay?"checked":""} title="Đã quay">`:`<span class="hkst">${c.step==="dkb"?"⏳":["kb"].includes(c.step)?"✍":c.step==="quay"?"○":"✓"}</span>`}<span class="hkt clk" data-card="${c.id}">${esc(c.hookText||"(chưa có hook)")}</span><small>${esc(t?t.tuyen:"")}${c.oneShot?" · one shot":" · có kịch bản"}${c.phatSinh?" · phát sinh":""}</small>${give&&["dkb","kb","quay"].includes(c.step)&&!c.daQuay?`<button class="lnk danger" data-hkx="${c.id}" title="Bỏ hook">✕</button>`:""}</div>`}).join("")}</div>`}).join("")||`<p class="hint">Chưa có hook nào. Thêm ở dưới: mỗi dòng một hook = một video.</p>`}
     ${give&&s.trangThai!=="Đã quay"?`<div class="hkadd" data-hka="${s.id}"><select class="ht">${tOpts()}</select><select class="hl">${opt([["1","One shot: chỉ cần hook, Oanh duyệt cả danh sách"],["0","Review, voice off…: viết kịch bản, duyệt từng cái"]],"1")}</select><textarea class="hh" rows="2" placeholder="Gõ hook, mỗi dòng một hook"></textarea><button class="btn sm pri" data-hkadd="${s.id}">+ Thêm hook</button></div>`:""}
     <label class="field full">Ghi chú buổi quay<textarea rows="2" data-sqnote="${s.id}" ${give?"":"disabled"} placeholder="Đạo cụ, người mẫu, địa điểm, lưu ý…">${esc(s.ghiChu||"")}</textarea></label>
     <label class="field full">Cảnh trám / review cần quay (đủ dùng cho các video trong tuần)<textarea rows="2" data-tram="${s.id}" ${give?"":"disabled"} placeholder="Ví dụ: cảnh trám ngâm áo, cận bột tan, review cầm sản phẩm — đủ cho 12 video bột tẩy tuần này">${esc(s.tram||"")}</textarea></label>
     <div class="acts">${dv&&chua.length?`<button class="btn pri" data-hkok="${s.id}">✓ Duyệt danh sách hook (${chua.length})</button>`:""}
      ${give&&ok.length?`<button class="btn" data-hkdone="${s.id}">Chốt buổi quay: ${ok.filter(c=>c.daQuay).length} đã quay → sang Edit</button>`:""}
      ${give&&s.trangThai==="Đã quay"||give&&ok.length?`<span class="hkps"><select data-pst="${s.id}">${tOpts()}</select><input data-psh="${s.id}" placeholder="Hook phát sinh"><button class="btn sm" data-psadd="${s.id}">+ Hook phát sinh</button></span>`:""}</div></section>`};
  b.innerHTML=`${wait.length?`<div class="note">${wait.length} hook đã duyệt từ buổi trước chưa quay. ${give?`<button class="btn sm" id="hk-move">Chuyển vào buổi quay gần nhất</button>`:""}</div>`:""}
   ${sh.map(sess).join("")||`<section class="card"><p class="empty">Kỳ này chưa có buổi quay. Thêm buổi quay ở dưới.</p></section>`}
   ${give?`<section class="card"><div class="card-h"><h2>Thêm buổi quay</h2></div><form class="frm row7" id="xq-add"><label class="field">Ngày<select id="xs-d">${opt(Array.from({length:MONTH.ndays},(_,i)=>[i+1,dayLbl(i+1)]),Math.max(d.settings.today,W.tu))}</select></label><label class="field">Buổi<select id="xs-b">${opt(["Sáng","Chiều","Cả ngày"],"Sáng")}</select></label><label class="field">Giờ (nếu cần)<input id="xs-g" placeholder="vd 8:30"></label><label class="field">Địa điểm<input id="xs-p" value="Văn phòng Ailla"></label><label class="field">Người quay<select id="xs-n">${opt(team.map(u=>[u.id,u.name]),qDef?qDef.id:"")}</select></label><label class="field">Ghi chú<input id="xs-gc" placeholder="Đạo cụ, lưu ý…"></label><button class="btn pri">+ Thêm buổi quay</button></form></section>`:""}`;
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
  b.querySelectorAll("[data-sqnote]").forEach(x=>x.onchange=()=>DB.mutate(ME.name,"ghi chú buổi quay",dt=>{const s=dt.shoots.find(y=>y.id===x.dataset.sqnote);if(s)s.ghiChu=x.value}));
  b.querySelectorAll("[data-tram]").forEach(x=>x.onchange=()=>DB.mutate(ME.name,"ghi cảnh trám buổi quay",dt=>{const s=dt.shoots.find(y=>y.id===x.dataset.tram);if(s)s.tram=x.value}));
  if($("#hk-move"))$("#hk-move").onclick=()=>{const nx=(D().shoots||[]).filter(s=>s.trangThai!=="Đã quay"&&s.day>=D().settings.today).sort((a,c)=>a.day-c.day)[0];if(!nx){toast("Chưa có buổi quay sắp tới, thêm buổi quay trước");return}DB.mutate(ME.name,"chuyển hook chưa quay sang buổi "+dd(nx.day),dt=>dt.cards.forEach(c=>{if(c.step==="quay"&&!c.buoiQuay){c.buoiQuay=nx.id;c.qday=nx.day}}));renderMain()};
  if($("#xq-add"))$("#xq-add").onsubmit=e=>{e.preventDefault();DB.mutate(ME.name,"lên lịch quay",dt=>{dt.shoots=dt.shoots||[];dt.shoots.push({id:uid("sq"),day:+$("#xs-d").value,buoi:$("#xs-b").value,gio:$("#xs-g").value,diaDiem:$("#xs-p").value,nguoi:[$("#xs-n").value].filter(Boolean),ghiChu:$("#xs-gc").value,tram:"",trangThai:"Đã lên lịch"})});toast("Đã thêm buổi quay");renderMain()};
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
  const ePool=d.cards.filter(c=>c.step==="edit"&&!c.nguoiEdit&&!c.wt);
  const hkWait=d.cards.filter(c=>c.buoiQuay&&c.step==="dkb").length,un=d.cards.filter(c=>!c.day&&c.step==="dang").length;
  const tabs=[["tuan","① Kế hoạch tuần",0],["kho","② Video tồn",slots.length],["quay","③ Buổi quay & hook",hkWait],["wk","Video Worker",d.cards.filter(c=>loaiOf(c)==="worker"&&["kb","dkb"].includes(c.step)).length],["kb","Kịch bản (nếu có)",kbPool.length],["edit","④ Edit",ePool.length],["dang","⑤ Kho video & lịch đăng",un]];
  if(!tabs.some(t=>t[0]===XV.tab))XV.tab="tuan";
  m.innerHTML=H("Xếp việc tuần",`${xvLbl(W)} · làm lần lượt từ ① đến ⑤, bước nào có số là còn việc`)+`<div class="lwtool"><div class="seg xvtabs">${tabs.map(([k,t,n])=>`<button data-xvt="${k}" class="${XV.tab===k?"on":""}">${t}${n?` <span class="xbadge">${n}</span>`:""}</button>`).join("")}</div></div><div id="xvb"></div>`;
  m.querySelectorAll("[data-xvt]").forEach(b=>b.onclick=()=>{XV.tab=b.dataset.xvt;XV.sel.clear();renderMain()});
  const b=$("#xvb"),o={d,W,days,WC,team,give,slots,free,kbPool,qPool:[],ePool,post:WC.filter(c=>c.step==="dang")};
  ({tuan:xvTuan,kho:xvKho2,quay:xvQuay2,wk:xvWorker2,kb:xvKB,edit:xvEdit2,dang:xvDang2})[XV.tab](b,o);
  wpWorkList(b,XV.tab);
  /* nối với ① Kế hoạch tuần: dải "cần làm" + chọn sẵn sản phẩm đang làm */
  const ST={kho:["ton","reup"],quay:["oneshot","kichban"],wk:["worker"]}[XV.tab];
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
    $("#hot-info").innerHTML=`<dl class="kv"><dt>Cần đăng</dt><dd><b>${need}</b> video trong ${$("#hot-d").value} ngày tới</dd><dt>Đã có sẵn</dt><dd><b>${ready}</b> video đang edit / chờ duyệt / chờ đăng</dd><dt>Video tồn</dt><dd><b>${kho}</b> video trong kho (xếp ở Kế hoạch tháng › 6. Làm hằng ngày › ② Video tồn)</dd><dt>Còn thiếu</dt><dd>${thieu?`<b class="t-red">${thieu}</b> video → cộng vào kế hoạch tuần (làm trước) và giao việc quay gấp`:`<b class="t-grn">đủ</b>`}</dd></dl>
     <p class="hint">Bấm "Đẩy lên ngay": người giữ kênh ${esc(chOf(kenh).short)} (${esc(userName(chanOwner(kenh))||"chưa đặt")}) nhận việc tự xếp lại lịch đăng, đưa sản phẩm này lên trước${thieu?"; Oanh nhận việc lên hook quay gấp":""}.</p>`;return {sku,kenh,need,ready,kho,thieu}};
  ["#hot-p","#hot-n","#hot-d"].forEach(s=>$(s).oninput=$(s).onchange=info);info();
  $("#hot-go").onclick=()=>{const r=info(),per=+$("#hot-n").value||1,nd=+$("#hot-d").value||1,w=weekOf(today)||1,lead=(d.users.find(u=>u.role==="lead"&&u.active)||{}).id||ME.id,own=chanOwner(r.kenh);
    DB.mutate(ME.name,`đẩy gấp ${sk(r.sku).n} ở ${r.kenh}`,dt=>{
      dt.weekPlan=dt.weekPlan||{};dt.weekPlan[w]=dt.weekPlan[w]||{};const e=dt.weekPlan[w][wpKey(r.sku,r.kenh)]=dt.weekPlan[w][wpKey(r.sku,r.kenh)]||{};e.uu="p1";e.sl=Math.max(+e.sl||0,per*7);if(r.thieu)e.sl=(+e.sl||0)+0;
      dt.hot=(dt.hot||[]).filter(h=>!(h.sku===r.sku&&h.kenh===r.kenh)).concat({sku:r.sku,kenh:r.kenh,tu:today,den:Math.min(MONTH.ndays,today+nd-1),sl:per,at:new Date().toLocaleString("vi-VN"),by:ME.name});
      const t=(ten,nguoi,mo)=>dt.tasks.push({id:uid("tk"),ten,loai:"Điều chỉnh do xu hướng",nguoi,han:Math.min(MONTH.ndays,today+1),moTa:mo,team:"content",da:"",phoi:[],uu:"Cao",st:"todo",checklist:[],tao:ME.id,kq:""});
      if(own)t(`Điều chỉnh lịch ${chOf(r.kenh).short}: đẩy ${sk(r.sku).n} lên`,own,`${sk(r.sku).n} đang lên xu hướng. Tự xếp lại lịch đăng ${r.kenh} từ ${dd(today)}: mỗi ngày ${per} video ${sk(r.sku).n} trong ${nd} ngày, đưa video sản phẩm này lên trước (dùng cả video tồn nếu có). Xếp ở Kế hoạch tháng › 6. Làm hằng ngày › ⑤ Lịch đăng hoặc Calendar.`);
      if(r.thieu)t(`Quay gấp ${r.thieu} video ${sk(r.sku).n}`,lead,`Thiếu ${r.thieu} video ${sk(r.sku).n} cho ${r.kenh} để đẩy xu hướng. Lên danh sách hook ở Kế hoạch tháng › 6. Làm hằng ngày › ③ Buổi quay & hook (đã cộng vào kế hoạch tuần, ưu tiên làm trước).`)});
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


/* ---------- Giao việc theo loại video từ Kế hoạch tuần ----------
   one shot: người được giao viết hook → Oanh duyệt → xếp buổi quay → quay → giao edit → Oanh → chị
   review / voice off: viết kịch bản → Oanh duyệt → quay → giao edit → Oanh → chị
   reup: dán link video gốc (Drive) → gửi Worker → Worker dựng → Oanh → chị
   video tồn: chọn video trong kho (② Video tồn) · Worker: theo dõi Worker dựng · nhân bản win: việc ở Video win */
function wpAssign(sku,kenh,t,u,n,w,bd,hn){
  const d=D(),WW=WEEKS.find(x=>x.w===w)||WEEKS[0],qd=Math.min(MONTH.ndays,Math.max(d.settings.today,WW.tu)),T=d.tuyen.filter(x=>x.sku===sku&&x.kenh===kenh);
  const pickT=re=>(T.find(x=>re.test(x.tuyen||""))||T.find(x=>!/kho|tồn|reup|nhân bản/i.test(x.tuyen||""))||T[0]||{}).ma||"";
  const nm=userName(u),sp=sk(sku).n;
  if(t==="nhanban"){DB.mutate(ME.name,`giao ${nm} nhân bản ${n} video win ${sp}`,dt=>dt.tasks.push({id:uid("tk"),ten:`Nhân bản ${n} video win ${sp} (${chOf(kenh).short})`,loai:"Nhân bản video win",nguoi:u,han:hn||Math.min(MONTH.ndays,WW.den),batDau:bd||d.settings.today,moTa:`Kế hoạch tuần ${w}: nhân bản ${n} video win ${sp} cho ${kenh}. Làm ở Marketing › Video win (Hypit nhân bản), xong trình Oanh duyệt rồi chị duyệt.`,team:"content",da:"",phoi:[],uu:"Cao",st:"todo",checklist:[],tao:ME.id,kq:"",mix:"nhanban",sku,kenh,wk:w,sl:n}));return `Đã giao ${nm} nhân bản ${n} video win`}
  const base={sku,kenh,day:0,qday:qd,mix:t,giao:u,wk:w,batDau:bd||d.settings.today,han:hn||defHan(d,WW,t)};
  const mk=dt=>{if(t==="ton")return {...base,maTuyen:pickT(/kho|tồn/i),nguon:"Footage cũ",yTuong:"Chọn video tồn trong kho để đăng",step:"kb",nguoi:u};
    if(t==="reup")return {...base,maTuyen:pickT(/reup|đổi hook|footage/i),nguon:"Reup có sửa",loai:"reup",yTuong:"Tìm video reup, dán link video gốc (Drive) rồi gửi Worker",step:"kb",nguoi:u,nguoiKB:u};
    if(t==="oneshot")return {...base,maTuyen:pickT(/./),nguon:"Quay mới",loai:"moi",oneShot:true,yTuong:"Viết hook one shot",dangVideo:"One shot",step:"kb",nguoi:u,nguoiKB:u};
    if(t==="kichban")return {...base,maTuyen:pickT(/review|voice|demo|so sánh/i),nguon:"Quay mới",loai:"moi",yTuong:"Viết kịch bản review / voice off",step:"kb",nguoi:u,nguoiKB:u};
    if(t==="worker")return {...base,maTuyen:pickT(/./),nguon:"Kho cảnh + Worker",loai:"worker",wkMode:"A",nguoiDung:"Worker",dangVideo:"Giọng đọc (Adam/AI)",yTuong:"Chọn cảnh trong kho cảnh, cho Worker dựng + voice",step:"worker",nguoi:u,nguoiEdit:u}};
  DB.mutate(ME.name,`giao ${nm} ${n} video ${(MIX.find(z=>z[0]===t)||[])[1]} ${sp}`,dt=>{for(let i=0;i<n;i++)dt.cards.push(newCard(dt,mk(dt)))});
  return `Đã giao ${nm} ${n} video ${(MIX.find(z=>z[0]===t)||[])[1]} · ${sp}`}
/* bước tiếp theo theo loại */
const _nextActMix=nextAct;
nextAct=function(c){if(c.mix==="ton"&&c.step==="kb")return null;if(c.mix==="reup"&&c.step==="kb")return ["Đã có link video gốc, gửi Worker","worker"];if(c.oneShot&&c.step==="kb")return ["Gửi Oanh duyệt hook","dkb"];if(c.oneShot&&c.step==="dkb")return ["Duyệt hook","quay"];return _nextActMix(c)};
const _checkMoveMix=checkMove;
checkMove=function(c,to,inp){const v=k=>((inp||{})[k]!==undefined?inp[k]:c[k])||"";if(c.mix==="reup"&&to==="worker"&&!String(v("linkVideo")).trim())return "Dán link video gốc (Google Drive) trước khi gửi Worker.";if(c.oneShot&&to==="dkb"&&!String(v("hookText")).trim())return "Viết hook trước khi gửi duyệt.";return _checkMoveMix(c,to,inp||{})};
/* Chỗ nhân sự làm ngay: hook cần viết (③), video reup cần dán link (②), video tồn cần chọn (②) */
function wpWorkList(b,tab){
  const d=D(),mine=c=>xvGive()||c.nguoi===ME.id;
  if(tab==="quay"){const L=d.cards.filter(c=>c.oneShot&&c.step==="kb"&&!c.buoiQuay);const A=d.cards.filter(c=>c.oneShot&&c.step==="dkb"&&!c.buoiQuay);
    if(!L.length&&!A.length)return;
    b.insertAdjacentHTML("afterbegin",`<section class="card"><div class="card-h"><h2>Hook cần viết</h2><span class="hint">${L.length} hook · người được giao gõ hook rồi bấm gửi Oanh duyệt</span>${A.length&&(can(ME,"viec.duyet")||ME.role==="admin")?`<span class="sp"></span><button class="btn pri sm" id="hk-okall">✓ Duyệt ${A.length} hook đang chờ</button>`:A.length?`<span class="hint">· ${A.length} hook chờ Oanh duyệt</span>`:""}</div>
     <div class="xlist">${L.map(c=>`<div class="xmini">${swatch(c.sku)}<span class="xms">${esc(sk(c.sku).n.split(" ").slice(0,2).join(" "))} · ${esc(userName(c.nguoi)||"—")}</span>${hanTag(c)}${mine(c)?`<input class="hkin" data-hkin="${c.id}" placeholder="Gõ hook…">${isLate(c)?`<input class="hkin tre" data-tre="${c.id}" placeholder="Trễ hạn: lý do trễ…">`:""}<button class="btn sm" data-hksend="${c.id}">Gửi duyệt</button>`:`<span class="xmt">chưa viết</span>`}</div>`).join("")}</div>
     ${A.length?`<div class="xgrp">Chờ Oanh duyệt</div><div class="xlist">${A.map(c=>xvMini(c,`<span class="xms">${esc(userName(c.nguoi)||"")}</span>`)).join("")}</div>`:""}
     <p class="hint">Hook đã duyệt hiện ở trên cùng ("hook đã duyệt chưa quay"), bấm chuyển vào buổi quay.</p></section>`);
    b.querySelectorAll("[data-hksend]").forEach(x=>x.onclick=()=>{const id=x.dataset.hksend,h=b.querySelector(`[data-hkin="${id}"]`).value.trim();if(!h){toast("Gõ hook trước");return}const tr=b.querySelector(`[data-tre="${id}"]`),e=moveCard(ME,id,"dkb",{hookText:h,lyDoTre:tr?tr.value.trim():undefined});toast(e||"Đã gửi Oanh duyệt hook");renderMain()});
    if($("#hk-okall"))$("#hk-okall").onclick=()=>{let n=0;A.forEach(c=>{if(!moveCard(ME,c.id,"quay"))n++});toast(`Đã duyệt ${n} hook, xếp vào buổi quay ở dưới`);renderMain()}}
  if(tab==="kho"){const R=d.cards.filter(c=>c.mix==="reup"&&c.step==="kb"),TN=[];
    if(!R.length&&!TN.length)return;
    b.insertAdjacentHTML("afterbegin",`${R.length?`<section class="card"><div class="card-h"><h2>Video reup cần link</h2><span class="hint">${R.length} video · người được giao dán link video gốc (Google Drive) rồi gửi Worker dựng</span></div>
     <div class="xlist">${R.map(c=>`<div class="xmini">${swatch(c.sku)}<span class="xms">${esc(sk(c.sku).n.split(" ").slice(0,2).join(" "))} · ${esc(chOf(c.kenh).short)} · ${esc(userName(c.nguoi)||"—")}</span>${hanTag(c)}${mine(c)?`<input class="hkin" data-rpin="${c.id}" placeholder="Dán link video gốc (Drive)…" value="${esc(c.linkVideo||"")}">${isLate(c)?`<input class="hkin tre" data-tre="${c.id}" placeholder="Trễ hạn: lý do trễ…">`:""}<button class="btn sm" data-rpsend="${c.id}">Đã có link, gửi duyệt sau</button><button class="btn sm pri" data-wsend="${c.id}">Gửi Worker dựng</button>`:`<span class="xmt">chưa có link</span>`}</div>`).join("")}</div></section>`:""}
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
    ${k?`<div class="kinfo"><b>${esc(k.ma)}</b> · ${esc(k.tuyen||k.skuText||"")}${k.link?` · <a href="${esc(/^https?:/.test(k.link)?k.link:"https://"+k.link)}" target="_blank" rel="noopener">Xem video</a>`:""}</div>`
      :`<label class="field full">Video tồn trong kho<select id="kc-v" ${ed?"":"disabled"}>${opt([["","— chọn video —"]].concat(free.map(x=>[x.ma,x.ma+" · "+(x.tuyen||x.skuText||"")])).concat(others.length?[["__sep","── sản phẩm khác ──"]].concat(others.map(x=>[x.ma,sk(x.sku).n+" · "+x.ma+" · "+(x.tuyen||"")])):[]),"")}</select><small>${free.length?free.length+" video "+esc(sk(c.sku).n)+" còn dùng được":`<span class="t-amb">Kho không còn video ${esc(sk(c.sku).n)}</span>`}</small></label>`}
    <label class="field">Tuyến<select id="kc-t" ${ed?"":"disabled"}>${opt([["","—"]].concat(T.map(t=>[t.ma,t.tuyen+" · "+chOf(t.kenh).short])),c.maTuyen||"")}</select></label>
    <label class="field">Kênh<select id="kc-k" ${ed?"":"disabled"}>${opt(CHANNELS.map(x=>[x.k,x.short]),c.kenh)}</select></label>
    <label class="field">Ngày đăng<select id="kc-d" ${ed?"":"disabled"}>${opt(dayOpts(c.kenh),c.day||"")}</select></label>
    ${k?`<label class="field">${fb?"Link bài đã đăng":"ID video TikTok (19 số)"}<input id="kc-id" value="${esc(fb?c.linkDang||"":c.tiktokId||"")}" ${ed?"":"disabled"}></label>`:""}
   </div>
   <div class="acts">${ed?(k?`<button class="btn pri" id="kc-save">Lưu</button>${c.step!=="xong"?`<button class="btn" id="kc-post">Đã đăng</button>`:""}`:`<button class="btn pri" id="kc-save">Đưa vào lịch đăng</button>`):""}<button class="lnk" id="kc-full">Mở thẻ đầy đủ</button>${xvGive()&&!k?`<button class="lnk danger" id="kc-del">Xóa ô này</button>`:""}</div>`;
  $("#drawer").hidden=false;$("#dx").onclick=closeDrawer;
  if($("#kc-k"))$("#kc-k").onchange=()=>{$("#kc-d").innerHTML=opt(dayOpts($("#kc-k").value),$("#kc-d").value)};
  if($("#kc-v"))$("#kc-v").onchange=()=>{const v=(d.kho||[]).find(x=>x.ma===$("#kc-v").value);if(!v)return;const m=T.find(t=>(v.tuyen||"").toLowerCase().includes((t.tuyen||"").toLowerCase().split(" ")[0]));if(m&&$("#kc-t"))$("#kc-t").value=m.ma};
  $("#kc-full").onclick=()=>_openCardKho(c.id,{full:true});
  if($("#kc-del"))$("#kc-del").onclick=()=>{DB.mutate(ME.name,"xóa ô video tồn "+c.id,dt=>{dt.cards=dt.cards.filter(y=>y.id!==c.id)});closeDrawer();renderMain()};
  if($("#kc-save"))$("#kc-save").onclick=()=>{const kenh=$("#kc-k").value,day=+$("#kc-d").value||0,tu=$("#kc-t").value;
    if(!k){const ma=$("#kc-v").value;if(!ma||ma==="__sep"){toast("Chọn video tồn");return}allocKho(ma,kenh,day,"nguyen",chanOwner(kenh)||c.nguoi,c.id)}
    DB.mutate(ME.name,"xếp video tồn "+c.id,dt=>{const x=dt.cards.find(y=>y.id===c.id);if(!x)return;x.kenh=kenh;x.day=day;if(tu){x.maTuyen=tu;const t=dt.tuyen.find(y=>y.ma===tu);if(t)x.tuyen=t.tuyen}if(!k){x.step="dang";x.loai="kho";x.ceo="PASS";x.nguoi=((dt.kenhPT||{})[kenh]||{}).chinh||x.nguoi}
      if(k&&$("#kc-id")){const v=$("#kc-id").value.trim();if(fb)x.linkDang=v;else x.tiktokId=v}});
    toast(k?"Đã lưu":"Đã đưa vào lịch"+(day?" ngày "+dd(day):", người giữ kênh chọn ngày đăng"));renderMain();openKhoCard(D().cards.find(y=>y.id===c.id))};
  if($("#kc-post"))$("#kc-post").onclick=()=>{const v=$("#kc-id").value.trim();const e=moveCard(ME,c.id,"xong",fb?{linkDang:v}:{tiktokId:v});if(e){toast(e);return}toast("Đã đăng");closeDrawer();renderMain()};
}
const _openCardKho=openCard;
openCard=function(id,o={}){const c=D().cards.find(x=>x.id===id);if(c&&!o.full&&(c.mix==="ton"||(c.khoMa&&loaiOf(c)==="kho")))return openKhoCard(c);return _openCardKho(id,o)};


/* ---------- Ngày bắt đầu / hạn xong của việc được giao, trễ hạn phải có lý do và Oanh duyệt ---------- */
/* hạn mặc định: viết hook / kịch bản xong trước buổi quay gần nhất 1 ngày; việc khác 2 ngày */
function defHan(d,WW,t){const td=d.settings.today;if(["oneshot","kichban"].includes(t)){const s=(d.shoots||[]).filter(x=>x.trangThai!=="Đã quay"&&x.day>td).sort((a,b)=>a.day-b.day)[0];if(s)return Math.max(td,s.day-1)}return Math.min(MONTH.ndays,td+2)}
const hanTag=c=>xvGive()?`${c.batDau?`<span class="xms">giao ${dd(c.batDau)}</span>`:""}<select class="hansel${isLate(c)?" late":""}" data-sethan="${c.id}" title="Hạn xong">${opt([["","Chưa có hạn"]].concat(Array.from({length:MONTH.ndays},(_,i)=>[i+1,"hạn "+dd(i+1)])),c.han||"")}</select>`:(c.han?`<span class="xms ${isLate(c)?"t-red":""}">${c.batDau?dd(c.batDau)+" → ":""}hạn ${dd(c.han)}${isLate(c)?" · trễ":""}</span>`:"");
document.addEventListener("change",e=>{const x=e.target;if(!x.matches||!x.matches("select[data-sethan]"))return;const id=x.dataset.sethan,v=+x.value||0;DB.mutate(ME.name,"đặt hạn "+id+" → "+(v?dd(v):"không"),dt=>{const c=dt.cards.find(y=>y.id===id);if(c){c.han=v;if(v&&!c.batDau)c.batDau=dt.settings.today}});toast(v?"Đã đặt hạn "+dd(v):"Đã bỏ hạn");renderMain()});
const _mvTre=moveCard;
moveCard=function(u,id,to,inp={}){const c=D().cards.find(x=>x.id===id);inp=Object.assign({},inp);let lt=inp.lyDoTre;delete inp.lyDoTre;
  const late=c&&c.han&&WORK_STEPS.includes(c.step)&&c.han<D().settings.today&&to!==c.step;
  if(late&&!lt&&!(c.tre&&c.tre.lyDo&&c.tre.buoc===stepName(c.step))){const r=typeof prompt==="function"?prompt(`Việc ${id} trễ hạn (hạn ${dd(c.han)}). Điền lý do trễ để gửi Oanh duyệt:`):"";if(!r||!r.trim())return "Việc trễ hạn: cần điền lý do trễ.";lt=r.trim()}
  const from=c?c.step:"",e=_mvTre(u,id,to,inp);
  if(!e&&c&&from!==to)DB.mutate(u.name,late?`nộp trễ ${id}: ${lt}`:"đổi bước "+id,dt=>{const x=dt.cards.find(y=>y.id===id);if(!x)return;if(late)x.tre={han:x.han,lyDo:lt,by:u.name,at:new Date().toLocaleString("vi-VN"),st:"cho",buoc:c.oneShot&&from==="kb"?"Viết hook":c.mix==="reup"&&from==="kb"?"Dán link reup":stepName(from),ngay:dt.settings.today};if(WORK_STEPS.includes(from)){x.hanCu=(x.hanCu||[]).concat({buoc:stepName(from),han:x.han,xong:dt.settings.today});x.han=0;x.batDau=0}});
  return e};
/* Oanh duyệt lý do trễ (hiện ở Tổng quan Content) */
function treBox(){const d=D(),L=d.cards.filter(c=>c.tre&&c.tre.st==="cho"),dv=can(ME,"viec.duyet")||ME.role==="admin";if(!L.length)return "";
  return `<section class="card"><div class="card-h"><h2>Trễ hạn chờ Oanh duyệt</h2><span class="hint">${L.length} việc nộp trễ có lý do</span></div><div class="xlist">${L.map(c=>`<div class="xmini">${swatch(c.sku)}<span class="xmt clk" data-card="${c.id}"><b>${esc(c.tre.by)}</b> · ${esc(c.tre.buoc)} · hạn ${dd(c.tre.han)}, nộp ${dd(c.tre.ngay)} — ${esc(c.tre.lyDo)}</span>${dv?`<button class="btn sm" data-treok="${c.id}">Duyệt</button><button class="btn sm" data-treno="${c.id}">Không duyệt</button>`:""}</div>`).join("")}</div></section>`}
function bindTre(m){m.querySelectorAll("[data-treok],[data-treno]").forEach(x=>x.onclick=()=>{const id=x.dataset.treok||x.dataset.treno,ok=!!x.dataset.treok;DB.mutate(ME.name,(ok?"duyệt":"không duyệt")+" lý do trễ "+id,dt=>{const c=dt.cards.find(y=>y.id===id);if(c&&c.tre){c.tre.st=ok?"ok":"khong";c.tre.duyet=ME.name}});toast(ok?"Đã duyệt lý do trễ":"Đã ghi không duyệt (tính trễ)");renderMain()})}
const _pMktTqTre=PAGES.mkt_tq;
PAGES.mkt_tq=function(m){_pMktTqTre(m);const r=m.querySelector(".xr2");if(r){r.insertAdjacentHTML("afterend",treBox());bindTre(m);bindCommon(m)}};


/* ---------- ② Video tồn (làm lại): kho → tuần này cần làm → mở từng sản phẩm, chọn video → lịch đăng video tồn ---------- */
let KS_OPEN=new Set();
const khoEditor=k=>{if(!k||!k.nguoi)return "";const u=D().users.find(x=>x.id===k.nguoi||(x.name||"").toLowerCase()===String(k.nguoi).toLowerCase());return u?u.name:k.nguoi};
const khoLink=k=>/^https?:/.test(k.link||"")?k.link:"https://"+k.link;
function xvKho2(b,o){
  const {d,W,give}=o,today=d.settings.today,free=xvKhoFree(),bySku=xvGroupBy(free,k=>k.sku).sort((a,c)=>c[1].length-a[1].length);
  const slots=d.cards.filter(c=>c.mix==="ton"&&!c.khoMa&&["kb","cg"].includes(c.step));
  const pairs=xvGroupBy(slots,c=>c.sku+"|"+c.kenh);
  const chosen=d.cards.filter(c=>c.khoMa&&loaiOf(c)==="kho"&&(c.step!=="xong"||xvIn(c,W))).sort((a,c)=>(a.step==="xong")-(c.step==="xong")||(a.day||99)-(c.day||99)); // video tồn đã chọn: hiện hết video chưa đăng, ngày nào cũng hiện
  const may=c=>give||c.giao===ME.id||c.nguoi===ME.id;
  const block=([key,S])=>{const [sku,kenh]=key.split("|"),V=free.filter(k=>k.sku===sku),op=KS_OPEN.has(key),who=[...new Set(S.map(c=>userName(c.giao||c.nguoi)).filter(Boolean))].join(", ");
    return `<div class="ksb${op?" open":""}"><div class="ksh" data-kso="${esc(key)}"><i class="ptar">${op?"▾":"▸"}</i>${swatch(sku)}<b>${esc(sk(sku).n)}</b><span class="hint">${esc(chOf(kenh).short)} · cần chọn <b>${S.length}</b> video · giao ${esc(who||"—")} · kho có ${V.length} video</span></div>
     ${op?(V.length?`<div class="tbl"><table class="kstab"><thead><tr><th>Mã</th><th>Tuyến / nội dung</th><th>Người edit</th><th>Video</th><th></th></tr></thead><tbody>${V.map(k=>`<tr><td class="mono">${esc(k.ma)}</td><td>${esc(k.tuyen||k.skuText||"")}</td><td>${esc(khoEditor(k)||"—")}</td><td>${k.link?`<a href="${esc(khoLink(k))}" target="_blank" rel="noopener">▶ Xem video</a>`:`<span class="hint">chưa có link</span>`}</td><td>${S.some(may)?`<button class="btn sm pri" data-kspick="${esc(key)}|${esc(k.ma)}">Chọn</button>`:""}</td></tr>`).join("")}</tbody></table></div>`:`<p class="t-amb pad">Kho không còn video ${esc(sk(sku).n)}. Đổi số video này sang loại khác ở ① Kế hoạch tuần.</p>`):""}</div>`};
  b.innerHTML=`<section class="card" id="khosum"><div class="card-h"><h2>Kho video tồn</h2><span class="hint">${free.length} video còn dùng được</span><span class="sp"></span><button class="lnk" data-go="kho">Mở kho video</button></div>
   <div class="xkho">${bySku.map(([k,L])=>`<span class="pchip">${swatch(k)}${esc(sk(k).n)} <b>${L.length}</b></span>`).join("")||`<span class="hint">Kho đang trống.</span>`}</div></section>
  <section class="card"><div class="card-h"><h2>Chọn video tồn</h2><span class="hint">${slots.length?`${slots.length} video cần chọn · bấm từng sản phẩm để mở danh sách video trong kho, xem rồi bấm Chọn`:"không còn video nào cần chọn"}</span></div>
   ${pairs.map(block).join("")||`<p class="hint">Giao "Dùng video tồn" ở ① Kế hoạch tuần thì sản phẩm sẽ hiện ở đây.</p>`}</section>
  <section class="card flush"><div class="card-h pad"><h2>Lịch đăng video tồn</h2><span class="hint">${chosen.filter(c=>c.step!=="xong").length} video chờ đăng · người đăng tự chọn ngày đăng · video đã có ngày vẫn ở đây đến khi đăng xong</span></div>
   <div class="tbl"><table><thead><tr><th>Video</th><th>Sản phẩm · tuyến</th><th>Kênh</th><th>Người edit</th><th>Người đăng</th><th>Ngày đăng</th><th></th></tr></thead><tbody>
   ${chosen.map(c=>{const k=(d.kho||[]).find(x=>x.ma===c.khoMa)||{},own=chanOwner(c.kenh),canDay=give||own===ME.id;return `<tr><td><span class="mono clk" data-card="${c.id}">${esc(c.khoMa)}</span>${k.link?` · <a href="${esc(khoLink(k))}" target="_blank" rel="noopener">xem</a>`:""}</td><td>${swatch(c.sku)}${esc(sk(c.sku).n)}<small>${esc(k.tuyen||c.tuyen||"")}</small></td><td>${esc(chOf(c.kenh).short)}</td><td>${esc(c.nguoiEditTen||khoEditor(k)||"—")}</td><td>${esc(userName(own)||"chưa đặt")}</td>
     <td>${canDay?`<select data-setday="${c.id}">${opt([["","Chọn ngày"]].concat(Array.from({length:MONTH.ndays-today+1},(_,i)=>today+i).map(x=>[x,dayLbl(x)+" · "+d.cards.filter(y=>y.kenh===c.kenh&&y.day===x&&y.id!==c.id).length+"/"+nhipOf(c.kenh,x)])),c.day||"")}</select>`:(c.day?dayLbl(c.day):"chưa xếp")}</td>
     <td>${c.step==="xong"?pill("Đã đăng","grn"):""}${may(c)&&c.mix==="ton"&&c.step!=="xong"?`<button class="lnk danger" data-ksun="${c.id}" title="Trả video về kho, chọn lại">Bỏ chọn</button>`:""}</td></tr>`}).join("")||`<tr><td colspan="7" class="empty">Chưa chọn video nào.</td></tr>`}</tbody></table></div></section>`;
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
   Việc được tạo khi giao ở ① Kế hoạch tuần. Worker chưa nối với thẻ nên người phụ trách tự chạy Worker rồi dán link.
   Chưa làm → Đang làm → Đã gửi duyệt → Xong (được duyệt) */
const wkSt=c=>{if(["dang","xong"].includes(c.step))return "xong";if(["dkb","dvd","dceo"].includes(c.step))return "duyet";if(c.step==="worker"&&(c.wkBat||c.wt))return "lam";if(c.step==="kb"&&String(c.noiDung||"").trim())return "lam";return "chua"};
const WK_G=[["chua","Chưa làm"],["lam","Đang làm"],["duyet","Đã gửi duyệt"],["xong","Xong (được duyệt)"]];
function xvWorker2(b,o){
  const {d,W,give}=o,L=d.cards.filter(c=>(loaiOf(c)==="worker"||c.wt)&&(xvIn(c,W)||!c.day||c.wt&&!c.wDone)).sort((a,c)=>(a.han||99)-(c.han||99));
  const mine=c=>give||c.nguoi===ME.id||c.giao===ME.id;
  const lnk=v=>/^https?:/.test(v)?v:"https://"+v;
  const row=c=>{const st=wkSt(c),t=d.tuyen.find(x=>x.ma===c.maTuyen),late=isLate(c);
    const dv=can(ME,"viec.duyet")||ME.role==="admin",draft=c.wt&&c.step==="worker"&&c.wStatus==="review"&&c.wStage==="video";const act=draft?(mine(c)?`<a class="btn sm" href="/api/hub/worker-tasks/preview/${esc(c.wJob)}" target="_blank" rel="noopener">▶ Xem bản nháp</a><button class="btn sm pri" data-wkself="${c.id}">Duyệt, gửi Oanh</button><button class="btn sm" data-wkfix="${c.id}">Góp ý sửa</button><button class="btn sm" data-wkredo="${c.id}" title="Giữ kịch bản và giọng đọc, Worker chọn lại cảnh + chữ mới">Làm lại</button>`:`<span class="hint">chờ ${esc(userName(c.nguoi)||"người phụ trách")} kiểm tra bản nháp</span>`):c.wt&&c.wJob&&!c.wDone&&(c.wStatus==="error"||["dvd","dceo"].includes(c.step))&&(mine(c)||dv)?`${c.wStatus==="error"?`<span class="t-red">${esc(c.wDetail||"Worker báo lỗi")}</span>`:""}<button class="btn sm" data-wkredo="${c.id}" title="Giữ kịch bản và giọng đọc, Worker chọn lại cảnh + chữ mới">Làm lại</button>`:c.wt&&c.wStage==="script"&&c.wStatus==="review"?(dv?`<div class="wkscr">${esc(c.wScript||"(Worker chưa gửi nội dung kịch bản)")}</div><button class="btn sm pri" data-wkscok="${c.id}">Duyệt kịch bản</button><button class="btn sm" data-wkscfix="${c.id}">Sửa kịch bản</button>`:`<span class="hint">kịch bản Worker viết chờ Oanh duyệt</span>`):!mine(c)?"":c.wt?"":st==="chua"&&c.step==="worker"?`<button class="btn sm pri" data-wsend="${c.id}">Gửi Worker dựng</button><button class="lnk" data-wkgo="${c.id}">Tự chạy Worker, dán link sau</button>`
      :st==="chua"&&c.step==="kb"?`<button class="btn sm" data-card="${c.id}">Viết kịch bản</button>`
      :c.step==="worker"&&!c.wt?`<input class="hkin" data-wkl="${c.id}" placeholder="Dán link video Worker dựng xong…" value="${esc(c.linkFinal||"")}">${late?`<input class="hkin tre" data-tre="${c.id}" placeholder="Trễ hạn: lý do trễ…">`:""}<button class="btn sm pri" data-wksend="${c.id}">Gửi Oanh duyệt</button>`
      :c.step==="kb"?`<button class="btn sm" data-card="${c.id}">Mở kịch bản</button>`:"";
    return `<tr><td>${swatch(c.sku)}<b>${esc(sk(c.sku).n)}</b><small>${esc(t?t.tuyen:c.tuyen||"")} · ${loaiOf(c)==="worker"?(c.wkMode==="B"?"nhân sự viết kịch bản":"Worker viết kịch bản + voice"):({oneshot:"one shot",voice:"giọng AI đọc kịch bản",text:"đổi hook, chèn chữ",rebrand:"sửa / đổi thương hiệu"}[c.wMode]||LOAI_V[loaiOf(c)])}</small></td>
     <td>${esc(userName(c.giao||c.nguoi)||"—")}</td><td class="nowrap">${c.batDau?dd(c.batDau):"—"}</td><td>${hanTag(c)||"—"}</td>
     <td>${pill((WK_G.find(g=>g[0]===st)||[])[1],{chua:"gry",lam:"blu",duyet:"amb",xong:"grn"}[st])}${c.wt&&c.step==="worker"&&c.wStatus==="review"&&c.wStage==="video"?`<small class="t-amb">bản nháp chờ người phụ trách kiểm tra</small>`:c.step==="dceo"?`<small>chờ chị duyệt</small>`:c.step==="dvd"?`<small>chờ Oanh duyệt</small>`:c.step==="dkb"?`<small>kịch bản chờ Oanh duyệt</small>`:""}</td>
     <td>${wkLine(c)||(c.linkFinal?`<a href="${esc(c.linkFinal.startsWith("/")?c.linkFinal:lnk(c.linkFinal))}" target="_blank" rel="noopener">▶ Xem video</a>`:`<span class="hint">chưa có</span>`)}</td><td class="wkact">${act}</td></tr>`};
  b.innerHTML=`<section class="card"><div class="card-h"><h2>Video Worker</h2><span class="hint">${L.length} video · video không quay và mọi video đã gửi Worker dựng · Worker dựng xong thì người phụ trách xem bản nháp, bấm "Duyệt, gửi Oanh" hoặc "Góp ý sửa"</span></div>
   <div class="wksum">${WK_G.map(([k,t])=>`<span class="xqi${L.filter(c=>wkSt(c)===k).length&&k!=="xong"?" hot":""}"><b class="numeric">${L.filter(c=>wkSt(c)===k).length}</b><span>${t}</span></span>`).join("")}</div></section>
  ${WK_G.map(([k,t])=>{const G=L.filter(c=>wkSt(c)===k);return G.length?`<section class="card flush"><div class="card-h pad"><h2>${t}</h2><span class="hint">${G.length}</span></div><div class="tbl"><table class="wktab"><thead><tr><th>Sản phẩm · tuyến</th><th>Phụ trách</th><th>Ngày giao</th><th>Hạn</th><th>Tiến độ</th><th>Link video</th><th></th></tr></thead><tbody>${G.map(row).join("")}</tbody></table></div></section>`:""}).join("")||`<section class="card"><p class="empty">Chưa có video Worker nào trong kỳ. Giao ở ① Kế hoạch tuần › Không quay · Worker.</p></section>`}`;
  b.querySelectorAll("[data-wkself]").forEach(x=>x.onclick=()=>{const c=D().cards.find(y=>y.id===x.dataset.wkself);const e=moveCard(ME,c.id,"dvd",{linkFinal:"/api/hub/worker-tasks/preview/"+c.wJob});toast(e||"Đã gửi Oanh duyệt");renderMain()});
  b.querySelectorAll("[data-wkfix]").forEach(x=>x.onclick=async()=>{const n=prompt("Cần Worker sửa gì? (vd: đổi hook mạnh hơn, thay cảnh đầu)");if(!n||!n.trim())return;const c=D().cards.find(y=>y.id===x.dataset.wkfix);const er=await wkTask("card_fix",c,{note:n.trim()});if(er){toast("Chưa gửi được: "+er);return}DB.mutate(ME.name,`góp ý Worker sửa ${c.id}: ${n.trim()}`,dt=>{const y=dt.cards.find(z=>z.id===c.id);if(!y)return;y.wStage="";y.wStatus="running";y.wDetail="Worker đang dựng lại theo góp ý";y.wFixAt=new Date().toISOString();y.linkFinal="";y.gopy=(y.gopy||[]).concat({t:new Date().toLocaleString("vi-VN"),who:ME.name,note:n.trim()})});toast("Đã gửi góp ý, Worker dựng lại");renderMain()});
  b.querySelectorAll("[data-wkredo]").forEach(x=>x.onclick=()=>wkRedo(x.dataset.wkredo,x));
  b.querySelectorAll("[data-wkscok]").forEach(x=>x.onclick=async()=>{const c=D().cards.find(y=>y.id===x.dataset.wkscok);const er=await wkTask("card_script_ok",c);toast(er||"Đã duyệt kịch bản, Worker tạo giọng và ghép cảnh");DB.mutate(ME.name,"duyệt kịch bản Worker "+c.id,dt=>{const y=dt.cards.find(z=>z.id===c.id);if(y){y.wStage="";y.wStatus="running";y.wDetail="Kịch bản đã duyệt, Worker đang tạo giọng + ghép cảnh";y.wFixAt=new Date().toISOString()}});renderMain()});
  b.querySelectorAll("[data-wkscfix]").forEach(x=>x.onclick=async()=>{const n=prompt("Cần sửa kịch bản thế nào?");if(!n||!n.trim())return;const c=D().cards.find(y=>y.id===x.dataset.wkscfix);const er=await wkTask("card_script_fix",c,{note:n.trim()});toast(er||"Đã gửi góp ý, Worker viết lại kịch bản");DB.mutate(ME.name,"sửa kịch bản Worker "+c.id,dt=>{const y=dt.cards.find(z=>z.id===c.id);if(y){y.wStage="";y.wStatus="running";y.wDetail="Worker đang viết lại kịch bản theo góp ý";y.wFixAt=new Date().toISOString()}});renderMain()});
  b.querySelectorAll("[data-wkgo]").forEach(x=>x.onclick=()=>{DB.mutate(ME.name,"bắt đầu chạy Worker "+x.dataset.wkgo,dt=>{const c=dt.cards.find(y=>y.id===x.dataset.wkgo);if(c)c.wkBat=dt.settings.today});toast("Đã chuyển sang Đang làm");renderMain()});
  b.querySelectorAll("[data-wksend]").forEach(x=>x.onclick=()=>{const id=x.dataset.wksend,l=b.querySelector(`[data-wkl="${id}"]`).value.trim(),tr=b.querySelector(`[data-tre="${id}"]`);if(!l){toast("Dán link video Worker dựng xong trước");return}const e=moveCard(ME,id,"dvd",{linkFinal:l,lyDoTre:tr?tr.value.trim():undefined});toast(e||"Đã gửi Oanh duyệt");renderMain()});
}


/* ---------- Nối Worker (máy dựng ở văn phòng) cho thẻ video ----------
   One shot / review sau khi quay (④ Edit): chọn người edit hoặc Gửi Worker (giữ tiếng quay, hoặc giọng AI đọc kịch bản)
   Reup: Gửi Worker đổi hook, chèn chữ hoặc sửa / đổi thương hiệu · Không quay: giọng đọc từ kho cảnh (Worker viết hoặc kịch bản có sẵn)
   Worker có bản nháp → thẻ sang Oanh duyệt video (xem bản nháp ngay trên web) → chị duyệt → Worker lưu Drive, link về thẻ.
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
/* Chị duyệt xong (sang Chờ đăng) → Worker lưu thành phẩm lên Drive */
const _mvWk=moveCard;
moveCard=function(u,id,to,inp){const c=D().cards.find(x=>x.id===id),from=c&&c.step;const e=_mvWk(u,id,to,inp);
  if(!e&&c&&from==="dvd"&&to==="dceo"){const t=D().tuyen.find(x=>x.ma===c.maTuyen);svApi("/api/hub/worker-tasks",{method:"POST",body:JSON.stringify({kind:"card_notify",ref:c.id,payload:{to:["chi"],text:`🎬 Video chờ chị duyệt: ${sk(c.sku).n}${t?" · "+t.tuyen:""} · ${chOf(c.kenh).short} (${c.id}). ${u.name} đã duyệt.`}})}).catch(()=>{})}
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
    C.forEach(c=>{const t=by[c.wt];if(!t)return;const r=t.result||{},u={wStatus:t.status,wProg:t.progress||0,wDetail:t.detail||"",wJob:t.worker_job||c.wJob||"",wStage:r.stage||"",wScript:r.script||""};
      const fresh=!c.wFixAt||String(t.updated_at||"")>c.wFixAt;if(!fresh){u.wStatus="running";u.wDetail=c.wDetail;u.wStage=""}
      if(fresh&&t.status==="running"&&["dvd","dceo"].includes(c.step)){u.step="worker";u.linkFinal=""} // dựng lại từ Telegram / trang Worker: về Đang làm
      if(fresh&&t.status==="review"&&r.stage==="video"&&c.step==="worker"){u.linkFinal="/api/hub/worker-tasks/preview/"+u.wJob} // bản nháp: người phụ trách xem, bấm Duyệt thì mới sang Oanh
      if(t.status==="done"&&r.drive_url){u.linkFinal=r.drive_url;u.wDone=true}
      if(Object.keys(u).some(k=>String(c[k]??"")!==String(u[k]??"")))ch.push([c.id,u])});
    if(ch.length){DB.mutate("Worker","cập nhật tiến độ Worker",dt=>ch.forEach(([id,u])=>{const x=dt.cards.find(y=>y.id===id);if(!x)return;const was=x.wStatus==="review"&&x.wStage;Object.assign(x,u);if(!was&&x.wStatus==="review"&&x.wStage&&typeof notifyU==="function")notifyU(dt,[x.nguoi||x.giao],(x.wStage==="script"?"Worker viết xong kịch bản, chờ Oanh duyệt: ":"Worker dựng xong bản nháp, vào xem và bấm Duyệt, gửi Oanh: ")+cardLbl(x),x.id)}));if(!(typeof svTyping==="function"&&svTyping()))renderMain()}}
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


/* ---------- ④ Edit (làm lại): Oanh giao theo SỐ LƯỢNG, ai edit xong video nào thì dán link video đó và gửi duyệt ----------
   Video quay xong nằm chung một chỗ; Oanh điền mỗi người bao nhiêu video rồi bấm Giao (chia lần lượt theo ngày quay).
   Người edit: mỗi video có ô dán link + Gửi duyệt (Oanh → chị). Oanh tự edit thì gửi thẳng chị duyệt. */
const isApprover=u=>!!u&&u.role==="lead"&&(u.perms||[]).includes("viec.duyet");
const _mvEdit=moveCard;
moveCard=function(u,id,to,inp){const c=D().cards.find(x=>x.id===id),from=c&&c.step,e=_mvEdit(u,id,to,inp);
  if(!e&&from==="edit"&&to==="dvd"&&isApprover(u)){const e2=moveCard(u,id,"dceo",{});if(!e2)toast("Video Oanh tự edit: đã gửi thẳng chị duyệt")}return e};
function xvEdit2(b,o){
  const {d,W,team,give}=o,today=d.settings.today;
  const pool=d.cards.filter(c=>c.step==="edit"&&!c.nguoiEdit&&!c.wt).sort((a,c)=>(a.qday||a.day||99)-(c.qday||c.day||99));
  const ed=d.cards.filter(c=>c.nguoiEdit&&!c.wt&&["edit","dvd","dceo"].includes(c.step));
  const doneW=u=>d.cards.filter(c=>c.nguoiEdit===u&&["dang","xong"].includes(c.step)&&xvIn(c,W)).length;
  const may=c=>give||c.nguoiEdit===ME.id;
  const prodG=xvGroupBy(pool,c=>c.sku);
  const row=c=>{const t=d.tuyen.find(x=>x.ma===c.maTuyen),late=isLate(c);return `<div class="edr${late?" late":""}">${swatch(c.sku)}<span class="xmt clk" data-card="${c.id}"><b>${esc(c.hookText||c.yTuong||c.id)}</b><small>${esc(sk(c.sku).n)}${t?" · "+esc(t.tuyen):""} · ${esc(chOf(c.kenh).short)}${c.oneShot?" · one shot":""}</small></span>${hanTag(c)}
    ${c.step==="edit"?(may(c)?`<input class="hkin" data-edl="${c.id}" placeholder="Dán link video đã edit (Drive)…" value="${esc(c.linkFinal||"")}">${late?`<input class="hkin tre" data-tre="${c.id}" placeholder="Trễ hạn: lý do trễ…">`:""}<button class="btn sm pri" data-edsend="${c.id}">Gửi duyệt</button>${typeof wkCan==="function"&&wkCan(c)?`<button class="btn sm" data-wsend="${c.id}">Gửi Worker</button>`:""}`:`<span class="hint">đang edit</span>`)
     :`${pill(c.step==="dvd"?"chờ Oanh duyệt":"chờ chị duyệt","amb")}${c.linkFinal?`<a href="${esc(/^https?:/.test(c.linkFinal)?c.linkFinal:"https://"+c.linkFinal)}" target="_blank" rel="noopener">xem</a>`:""}`}
    ${give&&c.step==="edit"?`<select class="edmv" data-edmv="${c.id}" title="Chuyển cho người khác">${opt([["","Chuyển…"]].concat(team.filter(u=>u.id!==c.nguoiEdit).map(u=>[u.id,u.name])).concat([["__pool","Trả về chưa giao"]]),"")}</select>`:""}</div>`};
  b.innerHTML=`<section class="card"><div class="card-h"><h2>Video đã quay, chờ chia edit</h2><span class="hint">${pool.length} video${prodG.length?" · "+prodG.map(([k,L])=>esc(sk(k).n)+" "+L.length).join(" · "):""}</span></div>
   ${give&&pool.length?`<div class="edas"><span class="hint">Giao theo số lượng (lấy lần lượt video quay trước):</span><label>Sản phẩm<select id="ed-sku">${opt([["","Tất cả"]].concat(prodG.map(([k,L])=>[k,sk(k).n+" ("+L.length+")"])),"")}</select></label>${team.map(u=>`<label class="wpu"><span>${esc(u.name)}</span><input type="number" min="0" class="num" data-edn="${u.id}" placeholder="0"></label>`).join("")}<label>Hạn xong<select id="ed-han">${opt(Array.from({length:MONTH.ndays},(_,i)=>[i+1,dd(i+1)]),Math.min(MONTH.ndays,today+2))}</select></label><button class="btn pri" id="ed-go">Giao</button></div>`:pool.length?"":`<p class="hint">Không còn video nào chờ chia edit. Video quay xong (③ Buổi quay › Chốt buổi quay) sẽ vào đây.</p>`}</section>
  <div class="edcols">${team.map(u=>{const L=ed.filter(c=>c.nguoiEdit===u.id),e1=L.filter(c=>c.step==="edit"),wait=L.filter(c=>c.step!=="edit"),late=e1.filter(isLate).length;
    return `<section class="card edcol"><div class="card-h"><h2>${esc(u.name)}</h2><span class="hint">đang edit <b>${e1.length}</b>${late?` · <b class="t-red">${late} trễ</b>`:""} · chờ duyệt <b>${wait.length}</b> · đã duyệt tuần này <b>${doneW(u.id)}</b>${isApprover(u)?" · gửi thẳng chị duyệt":""}</span></div>
     ${L.length?`<div class="edl">${e1.map(row).join("")}${wait.map(row).join("")}</div>`:`<p class="hint">Chưa có video edit.</p>`}</section>`}).join("")}</div>`;
  if($("#ed-go"))$("#ed-go").onclick=()=>{const sku=$("#ed-sku").value,han=+$("#ed-han").value,ask=[...b.querySelectorAll("[data-edn]")].map(i=>[i.dataset.edn,Math.max(0,+i.value||0)]).filter(z=>z[1]);if(!ask.length){toast("Điền số video cho ít nhất một người");return}
    const P=pool.filter(c=>!sku||c.sku===sku).map(c=>c.id),need=ask.reduce((a,z)=>a+z[1],0);if(need>P.length){toast(`Chỉ còn ${P.length} video chờ chia edit${sku?" của sản phẩm này":""}`);return}
    let i=0;const plan=ask.map(([u,n])=>[u,P.slice(i,i+=n)]);
    DB.mutate(ME.name,"chia edit: "+plan.map(([u,L])=>userName(u)+" "+L.length).join(", "),dt=>{plan.forEach(([u,L])=>L.forEach(id=>{const x=dt.cards.find(y=>y.id===id);if(!x)return;x.nguoiEdit=u;x.nguoi=u;x.batDau=dt.settings.today;x.han=han;x.tre=null}));if(typeof notifyU==="function")plan.forEach(([u,L])=>notifyU(dt,[u],`${ME.name} giao bạn edit ${L.length} video, hạn ${dd(han)}`,L[0]))});
    toast("Đã giao: "+plan.map(([u,L])=>userName(u)+" "+L.length).join(", "));renderMain()};
  b.querySelectorAll("[data-edsend]").forEach(x=>x.onclick=()=>{const id=x.dataset.edsend,l=b.querySelector(`[data-edl="${id}"]`).value.trim(),tr=b.querySelector(`[data-tre="${id}"]`);if(!l){toast("Dán link video đã edit trước");return}const e=moveCard(ME,id,"dvd",{linkFinal:l,lyDoTre:tr?tr.value.trim():undefined});if(e){toast(e);return}toast("Đã gửi duyệt");renderMain()});
  b.querySelectorAll("[data-edmv]").forEach(x=>x.onchange=()=>{const v=x.value,id=x.dataset.edmv;if(!v)return;DB.mutate(ME.name,v==="__pool"?"trả video về chưa giao edit "+id:"chuyển edit "+id+" cho "+userName(v),dt=>{const c=dt.cards.find(y=>y.id===id);if(!c)return;if(v==="__pool"){c.nguoiEdit="";c.nguoi="";c.han=0}else{c.nguoiEdit=v;c.nguoi=v;if(typeof notifyU==="function")notifyU(dt,[v],`${ME.name} chuyển cho bạn edit: ${c.hookText||c.id}`,id)}});renderMain()});
}
