/* =====================================================================
   MARKETING › TỔNG QUAN (trang Oanh mở mỗi sáng) + XẾP VIỆC TUẦN (sáng thứ Hai)
   + DUYỆT LẦN LƯỢT (popup duyệt kịch bản / video từng cái một)
   Tổng quan: kênh nào đủ nhịp · việc chờ duyệt · video tồn · ai đang làm gì từng ngày · tắc ở bước nào.
   Xếp việc tuần: ① lấp video tồn → ② giao kịch bản → ③ xếp buổi quay → ④ giao edit → ⑤ lên kênh.
   ===================================================================== */
let XV={w:0,tab:"kho",sel:new Set()};
const xvTeam=()=>D().users.filter(u=>u.active&&["lead","content","truongphong","nhanvien"].includes(u.role)&&(u.phongBan==="CM"||u.role==="lead"));
/* Kỳ xem lấy từ ô chọn thời gian trên cùng (tuần, tháng, khoảng tùy chọn); thẻ video chỉ có trong tháng kế hoạch */
const xvRange=()=>{const mf=MONTH.key+"-01",mt=MONTH.key+"-"+String(MONTH.ndays).padStart(2,"0");if(typeof PERIOD==="undefined"||!PERIOD||PERIOD.to<mf||PERIOD.from>mt)return null;return {tu:PERIOD.from<mf?1:+PERIOD.from.slice(8),den:PERIOD.to>mt?MONTH.ndays:+PERIOD.to.slice(8)}};
const xvWeek=()=>{const r=xvRange();if(r)return {w:weekOf(r.tu),tu:r.tu,den:r.den,out:false};const t=D().settings.today,W=WEEKS.find(w=>t>=w.tu&&t<=w.den)||WEEKS[0];return Object.assign({},W,{out:true})};
const xvLbl=W=>W.out?`tuần này ${dd(W.tu)}–${dd(Math.min(W.den,MONTH.ndays))} <span class="t-amb">(kỳ chọn ở trên nằm ngoài tháng ${MONTH.mon}, chọn "Tháng này" hoặc tuần cần xem)</span>`:(W.tu===1&&W.den===MONTH.ndays?`cả tháng ${MONTH.mon}`:`${dd(W.tu)} – ${dd(W.den)}`);
const xvDays=W=>{const a=[];for(let x=W.tu;x<=Math.min(W.den,MONTH.ndays);x++)a.push(x);return a};
const xvIn=(c,W)=>{const x=c.day||c.qday||0;return x>=W.tu&&x<=W.den};
const xvOpen=uid2=>D().cards.filter(c=>c.nguoi===uid2&&!["xong","cg"].includes(c.step));
const xvGive=()=>can(ME,"viec.giao")||ME.role==="admin";
const xvKhoFree=()=>(D().kho||[]).filter(k=>khoOk(k)&&!k.maDang);
const xvMini=(c,extra="")=>`<div class="xmini clk" data-card="${c.id}">${swatch(c.sku)}<span class="xmt">${esc(c.hookText||c.yTuong||c.tuyen||c.id)}</span>${extra}<span class="xmd${isLate(c)?" t-red":""}">${dd(c.day)}</span></div>`;
const xvWeekNav=W=>`<div class="seg"><button data-xvw="-1" ${XV.w<=1?"disabled":""} aria-label="Tuần trước">‹</button><button class="on">Tuần ${W.w} · ${dd(W.tu)}–${dd(Math.min(W.den,MONTH.ndays))}</button><button data-xvw="1" ${XV.w>=WEEKS.length?"disabled":""} aria-label="Tuần sau">›</button></div>`;
const xvBindWeek=m=>m.querySelectorAll("[data-xvw]").forEach(b=>b.onclick=()=>{XV.w=Math.max(1,Math.min(WEEKS.length,XV.w+ +b.dataset.xvw));XV.sel.clear();renderMain()});
function xvLoadCol(u,list,cap){const n=xvOpen(u.id).length,late=xvOpen(u.id).filter(isLate).length,p=Math.min(100,Math.round(n/cap*100));
  return `<div class="xcol"><div class="xct"><b>${esc(u.name)}</b><small class="${late?"t-red":""}">${n} việc${late?` · ${late} trễ`:""}</small></div><div class="xlbar"><i style="width:${p}%;background:${late>=2||p>=100?"#d6336c":p>=70?"#2f6fde":"#2f9e44"}"></i></div>${xvGive()&&XV.sel.size?`<button class="btn sm pri" data-xto="${u.id}">Giao ${XV.sel.size} thẻ cho ${esc(u.name.split(" ").pop())}</button>`:""}${list.map(c=>xvMini(c,`<span class="xms">${esc(c.step==="dkb"||c.step==="dvd"?"chờ duyệt":(c.gopy||[]).length&&["kb","edit"].includes(c.step)?"bị trả về":stepName(c.step))}</span>`)).join("")||`<p class="hint">Chưa có việc ở bước này</p>`}</div>`}
function xvPool(groups,empty){return groups.length?groups.map(([t,L])=>`<div class="xgrp">${t} · ${L.length}</div>${L.map(c=>`<label class="xvc${XV.sel.has(c.id)?" sel":""}">${xvGive()?`<input type="checkbox" data-xsel="${c.id}" ${XV.sel.has(c.id)?"checked":""}>`:""}${swatch(c.sku)}<span class="xvt"><b>${esc(c.hookText||c.yTuong||"(chưa có ý tưởng)")}</b><small>${esc(chOf(c.kenh).short)} · lên kênh ${dayLbl(c.day)}${c.nguoi?" · "+esc(userName(c.nguoi)):""}</small></span><button type="button" class="lnk" data-card="${c.id}">Mở</button></label>`).join("")}`).join(""):`<p class="empty">${empty}</p>`}
const xvGroupBy=(L,f)=>{const g=new Map();L.forEach(c=>{const k=f(c);if(!g.has(k))g.set(k,[]);g.get(k).push(c)});return [...g.entries()]};
const xvTuyenName=c=>{const t=D().tuyen.find(x=>x.ma===c.maTuyen);return `${sk(c.sku).n} · ${t?t.tuyen:c.tuyen||"ngoài kế hoạch"}`};

function pXepViec(m){
  const d=D(),W=xvWeek(),days=xvDays(W),WC=d.cards.filter(c=>xvIn(c,W)),team=xvTeam(),give=xvGive();
  const slots=WC.filter(isPH),free=xvKhoFree();
  const kbPool=WC.filter(c=>loaiOf(c)==="moi"&&!isPH(c)&&(c.step==="cg"||(c.step==="kb"&&!c.nguoi)));
  const qPool=d.cards.filter(c=>["dkb","quay"].includes(c.step)&&!c.buoiQuay&&loaiOf(c)==="moi").sort((a,b)=>a.day-b.day);
  const ePool=d.cards.filter(c=>(c.step==="edit"&&!c.nguoiEdit)||(c.step==="cg"&&["reup","nhanban"].includes(loaiOf(c))&&!isPH(c))).sort((a,b)=>a.day-b.day);
  const post=WC.filter(c=>c.step==="dang");
  const tabs=[["kho","① Video tồn",slots.length],["kb","② Kịch bản",kbPool.length],["quay","③ Quay",qPool.length],["edit","④ Edit",ePool.length],["dang","⑤ Lên kênh",post.length]];
  m.innerHTML=H("Xếp việc tuần",`${xvLbl(W)} · ${WC.length} video lên kênh trong kỳ · làm lần lượt từ ① đến ⑤, bước nào có số là còn việc cần xếp`)+`
  <div class="lwtool"><div class="seg xvtabs">${tabs.map(([k,t,n])=>`<button data-xvt="${k}" class="${XV.tab===k?"on":""}">${t}${n?` <span class="xbadge">${n}</span>`:""}</button>`).join("")}</div></div><div id="xvb"></div>`;
  xvBindWeek(m);
  m.querySelectorAll("[data-xvt]").forEach(b=>b.onclick=()=>{XV.tab=b.dataset.xvt;XV.sel.clear();renderMain()});
  const b=$("#xvb");
  ({kho:xvKho,kb:xvKB,quay:xvQuay,edit:xvEdit,dang:xvDang})[XV.tab](b,{d,W,days,WC,team,give,slots,free,kbPool,qPool,ePool,post});
  b.querySelectorAll("[data-xsel]").forEach(x=>{x.onclick=e=>e.stopPropagation();x.onchange=()=>{x.checked?XV.sel.add(x.dataset.xsel):XV.sel.delete(x.dataset.xsel);renderMain()}});
}

/* ① Video tồn: ô lịch dành cho video tồn (tuyến "Đăng lại video kho" / "Đổi hook video tồn") → chọn video trong kho */
function xvAlloc(ma,ph,mode,editor){const d=D(),c=ph?d.cards.find(x=>x.id===ph):null;
  const id=allocKho(ma,c?c.kenh:XV.addK,c?c.day:XV.addD,mode,mode==="hook"?editor:chanOwner(c?c.kenh:XV.addK),ph||undefined);
  if(id)DB.mutate(ME.name,"xếp video tồn "+ma,dt=>{const x=dt.cards.find(y=>y.id===id);if(!x)return;if(mode==="hook"){x.nguoi=editor||x.nguoi;x.nguoiEdit=x.nguoi;x.ceo="CẦN KIỂM TRA"}else{x.nguoi=((dt.kenhPT||{})[x.kenh]||{}).chinh||x.nguoi;x.ceo="PASS";x.step="dang";x.loai="kho"}});
  return id}
function xvKhoLink(k,id){return k&&/^https?:\/\//.test(k.link||"")?`<small data-xkl="${id}"><a href="${esc(k.link)}" target="_blank" rel="noopener">▶ xem video</a></small>`:`<small data-xkl="${id}" class="hint">chưa có link</small>`}
function xvKho(b,o){
  const {d,W,days,team,give,slots,free}=o,used=o.WC.filter(c=>c.khoMa),bySku=xvGroupBy(free,k=>k.sku).sort((a,b2)=>b2[1].length-a[1].length);
  const defMode=c=>/hook|edit|footage|reup/i.test(c.tuyen||"")?"hook":"nguyen";
  const pick=new Set();const sug=c=>{const k=free.find(x=>x.sku===c.sku&&!pick.has(x.ma));if(k)pick.add(k.ma);return k};
  b.innerHTML=`<section class="card"><div class="card-h"><h2>Kho video tồn</h2><span class="hint">${free.length} video còn dùng được · tuần này đã xếp ${used.length}</span><span class="sp"></span><button class="lnk" data-go="kho">Mở kho video</button></div>
   <div class="xkho">${bySku.map(([k,L])=>`<span class="pchip">${swatch(k)}${esc(sk(k).n)} <b>${L.length}</b></span>`).join("")||`<span class="hint">Kho đang trống. Thêm video tồn ở Kho video.</span>`}</div></section>
  <section class="card flush"><div class="card-h pad"><h2>Ô lịch dành cho video tồn <span class="hint">${slots.length} ô chưa có video</span></h2>${give&&slots.length?`<button class="btn pri sm" id="xk-auto">Lấp tự động</button>`:""}</div>
   <div class="tbl"><table><thead><tr><th>Ngày lên kênh</th><th>Kênh</th><th>Sản phẩm · tuyến</th><th>Video tồn</th><th>Cách dùng</th><th>Người edit</th><th></th></tr></thead><tbody>
   ${slots.map(c=>{const k=sug(c),L=free.filter(x=>x.sku===c.sku);return `<tr><td><b>${c.day?dayLbl(c.day):`<span class="hint">chưa xếp ngày</span>`}</b></td><td>${esc(chOf(c.kenh).short)}<small>giữ kênh: ${esc(userName(chanOwner(c.kenh))||"chưa đặt")}</small></td><td>${swatch(c.sku)}${esc(xvTuyenName(c))}</td>
    <td>${L.length?`<select data-xkv="${c.id}">${opt(L.map(x=>[x.ma,x.ma+" · "+(x.tuyen||x.skuText||"")]),k?k.ma:"")}</select>${xvKhoLink(k||L[0],c.id)}`:`<span class="t-amb">Kho hết video ${esc(sk(c.sku).n)}</span>`}</td>
    <td>${L.length?`<select data-xkm="${c.id}">${opt([["nguyen","Đăng nguyên bản (không cần duyệt)"],["hook","Đổi hook / edit lại (cần duyệt)"]],defMode(c))}</select>`:""}</td>
    <td>${L.length?`<select data-xke="${c.id}">${opt([["","—"]].concat(team.map(u=>[u.id,u.name])),"")}</select>`:""}</td>
    <td>${give?(L.length?`<button class="btn sm pri" data-xkok="${c.id}">Nhận</button>`:`<button class="btn sm" data-xknew="${c.id}">Chuyển thành quay mới</button>`):""}</td></tr>`}).join("")||`<tr><td colspan="7" class="empty">Kỳ này không có ô nào dành cho video tồn. Muốn có ô cố định, ở Kế hoạch tháng › bước 5 thêm tuyến "Đăng lại video kho" hoặc "Đổi hook video tồn" rồi bấm Phát hành. Hoặc thêm thẳng ở dưới.</td></tr>`}</tbody></table></div>
   <p class="hint pad">Đăng nguyên bản: thẻ đi thẳng tới người giữ kênh, đăng xong dán link. Đổi hook / edit lại: thẻ sang người edit, Oanh duyệt rồi chị duyệt mới lên kênh. Kho hết video thì bấm "Chuyển thành quay mới", thẻ sang bước ② Kịch bản.</p></section>
  ${give?`<section class="card"><div class="card-h"><h2>Thêm video tồn vào lịch</h2><span class="hint">không cần có ô trong kế hoạch</span></div>
   <form class="frm row7" id="xk-add"><label class="field">Video tồn<select id="xa-v">${opt(free.map(x=>[x.ma,x.ma+" · "+sk(x.sku).n+(x.tuyen?" · "+x.tuyen:"")]),"")}</select></label><label class="field">Kênh<select id="xa-k">${opt(CHANNELS.map(c=>[c.k,c.short]),"TikTok Via 2")}</select></label><label class="field">Ngày lên kênh<select id="xa-d">${opt([[0,"Người giữ kênh tự xếp sau"]].concat(days.map(x=>[x,dayLbl(x)])),0||Math.max(d.settings.today,W.tu)<=W.den?Math.max(d.settings.today,W.tu):W.tu)}</select></label><label class="field">Cách dùng<select id="xa-m">${opt([["nguyen","Đăng nguyên bản"],["hook","Đổi hook / edit lại"]],"nguyen")}</select></label><label class="field">Người edit<select id="xa-e">${opt([["","—"]].concat(team.map(u=>[u.id,u.name])),"")}</select></label><button class="btn pri" ${free.length?"":"disabled"}>Thêm vào lịch</button></form></section>`:""}
  ${used.length?`<section class="card"><div class="card-h"><h2>Video tồn đã xếp trong kỳ</h2><span class="hint">${used.length}</span></div><div class="xlist">${used.map(c=>xvMini(c,`<span class="xms">${esc(chOf(c.kenh).short)} · ${esc(stepName(c.step))}</span>`)).join("")}</div></section>`:""}`;
  const val=(a,id)=>{const e=b.querySelector(`[${a}="${id}"]`);return e?e.value:""};
  b.querySelectorAll("[data-xkv]").forEach(x=>x.onchange=()=>{const s=b.querySelector(`[data-xkl="${x.dataset.xkv}"]`);if(s)s.outerHTML=xvKhoLink(D().kho.find(y=>y.ma===x.value),x.dataset.xkv)});
  b.querySelectorAll("[data-xkok]").forEach(x=>x.onclick=()=>{const id=x.dataset.xkok,mode=val("data-xkm",id),ed=val("data-xke",id);if(mode==="hook"&&!ed){toast("Chọn người edit cho video đổi hook");return}xvAlloc(val("data-xkv",id),id,mode,ed);toast("Đã xếp video tồn vào lịch");renderMain()});
  b.querySelectorAll("[data-xknew]").forEach(x=>x.onclick=()=>{DB.mutate(ME.name,"chuyển ô video tồn thành quay mới "+x.dataset.xknew,dt=>{const c=dt.cards.find(y=>y.id===x.dataset.xknew);c.nguon="Quay mới";c.loai="moi";c.step="cg";c.nguoi=""});toast("Đã chuyển, giao kịch bản ở bước ②");renderMain()});
  if($("#xk-auto"))$("#xk-auto").onclick=()=>{let n=0,skip=0;slots.forEach(c=>{const v=val("data-xkv",c.id),mode=val("data-xkm",c.id),ed=val("data-xke",c.id);if(!v){skip++;return}if(mode==="hook"&&!ed){skip++;return}if(xvAlloc(v,c.id,mode,ed))n++});toast(`Đã lấp ${n} ô`+(skip?` · ${skip} ô cần chọn người edit hoặc kho hết video`:""));renderMain()};
  if($("#xk-add"))$("#xk-add").onsubmit=e=>{e.preventDefault();const v=$("#xa-v").value,mode=$("#xa-m").value,ed=$("#xa-e").value;if(!v){toast("Kho trống");return}if(mode==="hook"&&!ed){toast("Chọn người edit");return}XV.addK=$("#xa-k").value;XV.addD=+$("#xa-d").value;xvAlloc(v,null,mode,ed);toast("Đã thêm video tồn vào lịch");renderMain()};
}

/* ② Kịch bản: thẻ quay mới của tuần chưa có người → giao người viết */
function xvAssign(ids,to,kind){DB.mutate(ME.name,`giao ${kind} ${ids.length} thẻ cho ${userName(to)}`,dt=>ids.forEach(id=>{const x=dt.cards.find(y=>y.id===id);if(!x)return;x.nguoi=to;if(kind==="kịch bản"){x.nguoiKB=to;if(x.step==="cg")x.step="kb"}else{x.nguoiEdit=to;if(x.step==="cg")x.step="edit"}}))}
function xvAuto(ids,people,kind){const load=new Map(people.map(u=>[u.id,xvOpen(u.id).length]));const plan=new Map();ids.forEach(id=>{const u=[...load.entries()].sort((a,b)=>a[1]-b[1])[0];if(!u)return;load.set(u[0],u[1]+1);if(!plan.has(u[0]))plan.set(u[0],[]);plan.get(u[0]).push(id)});plan.forEach((L,u)=>xvAssign(L,u,kind));return plan}
function xvKB(b,o){
  const {d,W,days,team,give,kbPool}=o,inKB=d.cards.filter(c=>["kb","dkb"].includes(c.step)&&xvIn(c,W));const cap=Math.max(8,...team.map(u=>xvOpen(u.id).length));
  b.innerHTML=`${give&&XV.sel.size?`<div class="xbulk">Đã chọn ${XV.sel.size} thẻ · bấm tên người ở cột bên phải để giao viết kịch bản <span class="sp"></span><button class="btn sm" id="xb-clr">Bỏ chọn</button></div>`:""}
  <div class="xv2"><section class="card"><div class="card-h"><h2>Video quay mới chưa có người viết</h2><span class="hint">${kbPool.length}</span>${give?`<span class="sp"></span>${kbPool.length?`<button class="btn sm" id="xb-all">Chọn tất cả</button><button class="btn sm pri" id="xb-auto" title="Chia đều cho người đang ít việc, trừ trưởng nhóm">Chia tự động</button>`:""}`:""}</div>
   ${xvPool(xvGroupBy(kbPool,xvTuyenName),"Kỳ này không còn video quay mới chưa giao.")}
   ${give?`<form class="frm row7 xadd" id="xb-add"><label class="field">Thêm video quay mới · sản phẩm<select id="xn-s">${opt((D().catalog||[]).filter(c=>c.active).map(c=>[c.k,c.n]),"")}</select></label><label class="field">Kênh<select id="xn-k">${opt(CHANNELS.map(c=>[c.k,c.short]),"TikTok chính")}</select></label><label class="field">Ngày lên kênh<select id="xn-d">${opt(days.map(x=>[x,dayLbl(x)]),W.tu)}</select></label><button class="btn">+ Thêm</button></form>`:""}</section>
   <div class="xcols">${team.map(u=>xvLoadCol(u,inKB.filter(c=>c.nguoi===u.id),cap)).join("")}</div></div>`;
  xvBindPeople(b,"kịch bản",kbPool,team);
  if($("#xb-add"))$("#xb-add").onsubmit=e=>{e.preventDefault();let id;DB.mutate(ME.name,"thêm video quay mới",dt=>{const c=newCard(dt,{sku:$("#xn-s").value,kenh:$("#xn-k").value,day:+$("#xn-d").value,nguon:"Quay mới",loai:"moi"});dt.cards.push(c);id=c.id});XV.sel.add(id);toast("Đã thêm, chọn người viết kịch bản ở cột bên phải");renderMain()};
}
function xvBindPeople(b,kind,pool,team){
  b.querySelectorAll("[data-xto]").forEach(x=>x.onclick=()=>{const ids=[...XV.sel];xvAssign(ids,x.dataset.xto,kind);XV.sel.clear();toast(`Đã giao ${ids.length} thẻ ${kind} cho ${userName(x.dataset.xto)}`);renderMain()});
  if($("#xb-clr"))$("#xb-clr").onclick=()=>{XV.sel.clear();renderMain()};
  if($("#xb-all"))$("#xb-all").onclick=()=>{pool.forEach(c=>XV.sel.add(c.id));renderMain()};
  if($("#xb-auto"))$("#xb-auto").onclick=()=>{const ids=XV.sel.size?[...XV.sel]:pool.map(c=>c.id);const ppl=team.filter(u=>u.role!=="lead");const plan=xvAuto(ids,ppl.length?ppl:team,kind);XV.sel.clear();toast("Đã chia: "+[...plan.entries()].map(([u,L])=>userName(u)+" "+L.length).join(", ")+". Muốn đổi người thì mở thẻ hoặc giao lại.");renderMain()};
}

/* ③ Quay: kịch bản đã duyệt / đang chờ duyệt → xếp vào buổi quay của tuần; quay xong cả buổi sang edit */
function xvQuay(b,o){
  const {d,W,days,team,give,qPool}=o,sh=(d.shoots||[]).filter(s=>s.day>=W.tu&&s.day<=W.den).sort((a,b2)=>a.day-b2.day||(a.gio||"").localeCompare(b2.gio||""));
  const qDef=team.find(u=>/quỳnh/i.test(u.name));
  b.innerHTML=`<div class="xv2"><section class="card"><div class="card-h"><h2>Kịch bản chờ quay</h2><span class="hint">${qPool.length} · chưa xếp buổi</span>${give&&qPool.length?`<span class="sp"></span><button class="btn sm" id="xb-all">Chọn tất cả</button>`:""}</div>
   ${give&&XV.sel.size?`<div class="xbulk">Đã chọn ${XV.sel.size} · <select id="xq-to">${opt([["","Chọn buổi quay…"]].concat(sh.map(s=>[s.id,dayLbl(s.day)+" "+(s.gio||"")+" · "+(s.diaDiem||"")])),"")}</select><button class="btn sm pri" id="xq-go">Xếp vào buổi</button></div>`:""}
   ${xvPool(xvGroupBy(qPool,c=>c.step==="dkb"?"Kịch bản đang chờ Oanh duyệt":"Kịch bản đã duyệt"),"Chưa có kịch bản nào chờ quay. Kịch bản được duyệt ở bước ② sẽ hiện ở đây.")}</section>
  <div><section class="card"><div class="card-h"><h2>Buổi quay trong kỳ</h2><span class="hint">${sh.length} buổi</span></div>
   ${sh.map(s=>{const I=d.cards.filter(c=>c.buoiQuay===s.id),wait=I.filter(c=>c.step==="dkb").length,ready=I.filter(c=>c.step==="quay").length;return `<div class="xses"><div class="xct"><b>🎬 ${dayLbl(s.day)} ${esc(s.gio||"")}</b><small>${esc(s.diaDiem||"")} · ${esc(s.nguoi.map(userName).join(", ")||"chưa có người")}</small>${pill(s.trangThai||"Đã lên lịch",s.trangThai==="Đã quay"?"grn":"blu")}</div>
    <div class="xlist">${I.map(c=>xvMini(c,`<span class="xms">${esc(stepName(c.step))}</span>`)).join("")||`<p class="hint">Chưa xếp kịch bản nào</p>`}</div>
    ${wait?`<p class="hint t-amb">${wait} kịch bản trong buổi còn chờ Oanh duyệt</p>`:""}${give&&ready?`<button class="btn sm pri" data-xqd="${s.id}">Đã quay xong ${ready} video → sang edit</button>`:""}${give?`<div class="ptadd"><select data-psqt="${s.id}">${opt(d.tuyen.map(t=>[t.ma,sk(t.sku).n+" · "+chOf(t.kenh).short+" · "+t.tuyen]),"")}</select><button class="btn sm" data-psq="${s.id}" title="Quay thêm video ngoài kế hoạch: ghi vào tuyến, thẻ đi thẳng sang bước Edit">+ Video phát sinh</button></div>`:""}</div>`}).join("")||`<p class="empty">Tuần này chưa có buổi quay.</p>`}
   ${give?`<form class="frm row7" id="xq-add"><label class="field">Ngày<select id="xs-d">${opt(days.map(x=>[x,dayLbl(x)]),Math.max(d.settings.today,W.tu)<=W.den?Math.max(d.settings.today,W.tu):W.tu)}</select></label><label class="field">Giờ<input id="xs-g" value="8:30"></label><label class="field">Địa điểm<input id="xs-p" value="Văn phòng Ailla"></label><label class="field">Người quay<select id="xs-n">${opt(team.map(u=>[u.id,u.name]),qDef?qDef.id:"")}</select></label><button class="btn">+ Thêm buổi quay</button></form>`:""}</section></div></div>`;
  if($("#xb-all"))$("#xb-all").onclick=()=>{qPool.forEach(c=>XV.sel.add(c.id));renderMain()};
  if($("#xq-go"))$("#xq-go").onclick=()=>{const q=$("#xq-to").value;if(!q){toast("Chọn buổi quay (chưa có thì thêm buổi ở cột phải)");return}const ids=[...XV.sel];DB.mutate(ME.name,`xếp ${ids.length} kịch bản vào buổi quay`,dt=>ids.forEach(id=>{const x=dt.cards.find(y=>y.id===id);if(x)x.buoiQuay=q}));XV.sel.clear();toast("Đã xếp vào buổi quay");renderMain()};
  if($("#xq-add"))$("#xq-add").onsubmit=e=>{e.preventDefault();DB.mutate(ME.name,"lên lịch quay",dt=>{dt.shoots=dt.shoots||[];dt.shoots.push({id:uid("sq"),day:+$("#xs-d").value,gio:$("#xs-g").value,diaDiem:$("#xs-p").value,nguoi:[$("#xs-n").value].filter(Boolean),ghiChu:"",trangThai:"Đã lên lịch"})});toast("Đã thêm buổi quay");renderMain()};
  b.querySelectorAll("[data-psq]").forEach(x=>x.onclick=()=>{const q=x.dataset.psq,ma=b.querySelector(`[data-psqt="${q}"]`).value,t=D().tuyen.find(y=>y.ma===ma);if(!t){toast("Chưa có tuyến nào, lập tuyến ở Kế hoạch tháng › bước 5");return}const sh=(D().shoots||[]).find(y=>y.id===q);let id;DB.mutate(ME.name,"video phát sinh buổi quay "+q,dt=>{const c=newCard(dt,{sku:t.sku,kenh:t.kenh,maTuyen:t.ma,day:Math.min(MONTH.ndays,(sh?sh.day:dt.settings.today)+2),nguon:"Quay mới",loai:"moi",buoiQuay:q,phatSinh:true,step:"edit",dangVideo:t.dangVideo||undefined});dt.cards.push(c);id=c.id});toast("Đã ghi video phát sinh "+id+" vào tuyến "+t.tuyen+", giao người edit ở bước ④");renderMain()});
  b.querySelectorAll("[data-xqd]").forEach(x=>x.onclick=()=>{const q=x.dataset.xqd;DB.mutate(ME.name,"quay xong buổi "+q,dt=>{const s=(dt.shoots||[]).find(y=>y.id===q);if(s)s.trangThai="Đã quay";dt.cards.filter(c=>c.buoiQuay===q&&c.step==="quay").forEach(c=>{c.step="edit";c.nguoiEdit="";c.nguoi=""})});XV.tab="edit";toast("Đã chuyển sang bước ④ Edit, giao người edit");renderMain()});
}

/* ④ Edit: video đã quay / video reup chưa có người edit → giao người edit */
function xvEdit(b,o){
  const {d,team,give,ePool}=o,inE=d.cards.filter(c=>["edit","worker","dvd"].includes(c.step)&&c.nguoiEdit);const cap=Math.max(8,...team.map(u=>xvOpen(u.id).length));
  b.innerHTML=`${give&&XV.sel.size?`<div class="xbulk">Đã chọn ${XV.sel.size} thẻ · bấm tên người ở cột bên phải để giao edit <span class="sp"></span><button class="btn sm" id="xb-clr">Bỏ chọn</button></div>`:""}
  <div class="xv2"><section class="card"><div class="card-h"><h2>Video chờ giao edit</h2><span class="hint">${ePool.length}</span>${give&&ePool.length?`<span class="sp"></span><button class="btn sm" id="xb-all">Chọn tất cả</button><button class="btn sm pri" id="xb-auto">Chia tự động</button>`:""}</div>
   ${xvPool(xvGroupBy(ePool,c=>c.step==="edit"?"Đã quay xong":LOAI_V[loaiOf(c)]),"Không còn video nào chờ giao edit.")}</section>
   <div class="xcols">${team.map(u=>xvLoadCol(u,inE.filter(c=>c.nguoiEdit===u.id),cap)).join("")}</div></div>`;
  xvBindPeople(b,"edit",ePool,team);
}

/* ⑤ Lên kênh: video đã duyệt chờ người giữ kênh đăng */
function xvDang(b,o){
  const {d,W,WC}=o;
  b.innerHTML=`<div class="xchan">${CHANNELS.map(ch=>{const I=WC.filter(c=>c.kenh===ch.k),P=I.filter(c=>c.step==="dang"),done=I.filter(c=>c.step==="xong").length;return `<section class="card"><div class="card-h"><h2>${esc(ch.short)}</h2><span class="hint">giữ kênh: ${esc(userName(chanOwner(ch.k))||"chưa đặt")}</span><span class="sp"></span><b class="numeric">${done}/${I.length}</b><span class="hint">đã lên tuần này</span></div>
   <div class="xlist">${P.map(c=>xvMini(c,`<span class="xms">${isLate(c)?"trễ":"chờ đăng"}</span>`)).join("")||`<p class="hint">Không có video chờ đăng</p>`}</div></section>`}).join("")}</div>
  <p class="hint">Người giữ kênh mở thẻ, đăng lên kênh rồi dán ID video TikTok (hoặc link bài Fanpage) là thẻ sang Đã đăng. Đổi người giữ kênh ở Kế hoạch tháng › bước 5.</p>`;
}
PAGES.xepviec=pXepViec;

/* ---------------- DUYỆT LẦN LƯỢT ---------------- */
let RVQ={i:0,skip:new Set()};
function rvQueue(){const d=D(),dv=can(ME,"viec.duyet")||ME.role==="admin";return d.cards.filter(c=>((c.step==="dkb"||c.step==="dvd")&&dv)||(c.step==="dceo"&&ME.role==="admin")).sort((a,b)=>({dkb:0,dvd:1,dceo:2}[a.step]-{dkb:0,dvd:1,dceo:2}[b.step])||a.day-b.day)}
function openReview(){RVQ={i:0,skip:new Set()};rvShow()}
function rvShow(){
  const Q=rvQueue().filter(c=>!RVQ.skip.has(c.id)),c=Q[0],all=rvQueue().length;
  const close=()=>{closeDrawer();renderMain()};
  if(!c){$("#drawerIn").innerHTML=`<div class="dh"><h2>Duyệt lần lượt</h2><button class="btn sm" id="dx">Đóng</button></div><div class="empty" style="padding:40px 0">${all?`Đã xem hết. Còn ${all} cái bấm "Bỏ qua", mở lại để duyệt tiếp.`:"Không còn kịch bản hay video nào chờ duyệt."}</div>`;$("#drawer").hidden=false;$("#dx").onclick=close;return}
  const isKB=c.step==="dkb",link=c.linkFinal||c.linkVideo,lbl={dkb:"Duyệt kịch bản",dvd:"Duyệt video (Oanh)",dceo:"Duyệt video (chị)"}[c.step];
  $("#drawerIn").innerHTML=`<div class="dh"><div><b>${lbl}</b> <span class="hint">còn ${Q.length} cái · ${RVQ.skip.size?RVQ.skip.size+" đã bỏ qua":""}</span></div><button class="btn sm" id="dx">Đóng</button></div>
   <h2 class="dtitle">${esc(c.hookText||c.yTuong||c.id)}</h2>
   <p class="hint"><span class="mono">${c.id}</span> · ${esc(sk(c.sku).n)} · ${esc(chOf(c.kenh).short)} · lên kênh ${dayLbl(c.day)} · ${isKB?"người viết":"người edit"}: <b>${esc(userName(isKB?(c.nguoiKB||c.nguoi):(c.nguoiEdit||c.nguoi))||"—")}</b></p>
   ${typeof tuyenBox==="function"?tuyenBox(c):""}
   ${isKB?`<div class="rvkb"><dl class="kv"><dt>Hook</dt><dd>${esc(c.hookText||"—")}</dd><dt>Ý tưởng</dt><dd>${esc(c.yTuong||"—")}</dd><dt>Nội dung / lời</dt><dd style="white-space:pre-wrap">${esc(c.noiDung||"—")}</dd><dt>Cảnh quay</dt><dd style="white-space:pre-wrap">${esc(c.canhQuay||"—")}</dd><dt>Đạo cụ</dt><dd>${esc(c.daoCu||"—")}</dd></dl></div>`
     :`<div class="rvvid">${link?`<a class="btn pri" href="${esc(/^https?:/.test(link)?link:"https://"+link)}" target="_blank" rel="noopener">▶ Mở video để xem</a> <span class="hint">${esc(link.slice(0,70))}</span>`:`<span class="t-amb">Thẻ chưa có link video</span>`}${c.caption?`<p><b>Caption:</b> ${esc(c.caption)}</p>`:""}</div>`}
   ${(c.gopy||[]).length?`<div class="warn">${c.gopy.slice(-3).map(g=>`<div><b>${esc(g.who)}</b>: ${esc(g.note)}</div>`).join("")}</div>`:""}
   <label class="field full">Góp ý (bắt buộc khi trả về sửa)<textarea id="rv-n" rows="3" placeholder="VD: hook 3 giây đầu chưa nêu nỗi đau"></textarea></label>
   <div class="acts"><button class="btn pri" id="rv-ok">✓ ${isKB?"Duyệt kịch bản":c.step==="dvd"?"Duyệt, gửi chị":"Duyệt, cho lên kênh"}</button><button class="btn" id="rv-back">↩ Trả về sửa</button><button class="btn" id="rv-skip">Bỏ qua</button><button class="btn" id="rv-open">Mở thẻ đầy đủ</button></div>`;
  $("#drawer").hidden=false;$("#dx").onclick=close;
  $("#rv-ok").onclick=()=>{const nx=nextAct(c);const e=nx?moveCard(ME,c.id,nx[1]):"Không chuyển được";if(e){toast(e);return}toast("Đã duyệt "+c.id);rvShow()};
  $("#rv-back").onclick=()=>{const n=$("#rv-n").value.trim();if(!n){toast("Viết góp ý trước khi trả về");$("#rv-n").focus();return}sendBack(ME,c.id,n);toast("Đã trả về "+c.id);rvShow()};
  $("#rv-skip").onclick=()=>{RVQ.skip.add(c.id);rvShow()};
  $("#rv-open").onclick=()=>openCard(c.id);
}

/* ---------------- TỔNG QUAN CONTENT ---------------- */
let MQ={cell:null};
const MQ_K=[["kb","KB",c=>c.step==="kb","k-kb"],["wait","Chờ duyệt",c=>["dkb","dvd","dceo"].includes(c.step),"k-w"],["quay","Quay",c=>c.step==="quay","k-q"],["edit","Edit",c=>["edit","worker"].includes(c.step),"k-e"],["dang","Lên kênh",c=>c.step==="dang","k-d"],["xong","Đã lên",c=>c.step==="xong","k-ok"]];
function pMktTq(m){
  const d=D(),today=d.settings.today,W=xvWeek(),days=xvDays(W),team=xvTeam(),WC=d.cards.filter(c=>xvIn(c,W));
  const Q=rvQueue(),qn=s=>Q.filter(c=>c.step===s).length,free=xvKhoFree(),unas=WC.filter(c=>c.step==="cg"&&!isPH(c)),slots=WC.filter(isPH);
  const full=W.tu===1&&W.den===MONTH.ndays;const chCard=ch=>{const I=WC.filter(c=>c.kenh===ch.k),kh=Math.max(I.length,full?sum(d.tuyen.filter(t=>t.kenh===ch.k),t=>t.kh):0),done=I.filter(c=>c.step==="xong").length,exp=I.filter(c=>c.day<=today).length,T=d.cards.filter(c=>c.kenh===ch.k&&c.day===today),Td=T.filter(c=>c.step==="xong").length;
    const st=!kh?pill("Chưa có kế hoạch","gry"):done>=exp?pill("Đúng nhịp","grn"):exp-done>=3?pill("Hụt "+(exp-done)+" video","red"):pill("Chậm "+(exp-done)+" video","amb");
    return `<div class="card xch clk" data-xch="${esc(ch.k)}"><div class="xct"><b>${esc(ch.short)}</b><small>giữ kênh: ${esc(userName(chanOwner(ch.k))||"chưa đặt")}</small></div><div class="xbig">${done}<small> / ${kh} ${ch.needId?"video":"bài"} ${full?"tháng":"trong kỳ"}</small></div><div class="xprog"><i style="width:${kh?Math.min(100,done/kh*100):0}%"></i>${kh?`<u style="left:${Math.min(100,exp/kh*100)}%" title="Lẽ ra đạt ${exp} đến hôm nay"></u>`:""}</div><div class="xrow"><span>Hôm nay <b>${Td}/${T.length}</b> đã lên</span>${st}</div></div>`};
  const att=[];
  CHANNELS.forEach(ch=>{const I=WC.filter(c=>c.kenh===ch.k),kh=I.length,done=I.filter(c=>c.step==="xong").length,exp=I.filter(c=>c.day<=today).length;if(kh&&exp-done>=3)att.push(["red",`<b>${esc(ch.short)}</b> hụt ${exp-done} video so với nhịp kế hoạch.`])});
  team.forEach(u=>{const L=xvOpen(u.id),late=L.filter(isLate).length;if(late>=2)att.push(["red",`<b>${esc(u.name)}</b> có ${late} việc trễ hạn, đang giữ ${L.length} việc.`]);else if(L.length>=12)att.push(["amb",`<b>${esc(u.name)}</b> đang giữ ${L.length} việc, nên chia bớt.`])});
  if(unas.length)att.push(["amb",`Trong kỳ còn <b>${unas.length}</b> video chưa giao người làm.`]);
  if(slots.length)att.push(["amb",`Trong kỳ còn <b>${slots.length}</b> ô video tồn chưa chọn video.`]);
  const qWait=d.cards.filter(c=>c.step==="quay"&&!c.buoiQuay).length;if(qWait)att.push(["amb",`<b>${qWait}</b> kịch bản đã duyệt chưa xếp buổi quay.`]);
  if(!d.tuyen.length)att.push(["gry",`Chưa có kế hoạch tháng: vào <b>Kế hoạch tháng › bước 5</b> lập pillar và tuyến rồi bấm Phát hành.`]);
  const COLS=days.length<=7?days.map(x=>({l:dayLbl(x)+(x===today?" · nay":""),ds:[x],now:x===today})):WEEKS.filter(w=>w.den>=W.tu&&w.tu<=W.den).map(w=>{const a=Math.max(w.tu,W.tu),b=Math.min(w.den,W.den,MONTH.ndays),ds=[];for(let x=a;x<=b;x++)ds.push(x);return {l:`Tuần ${w.w} · ${dd(a)}–${dd(b)}`,ds,now:ds.includes(today)}});
  const cellCards=(u,ci)=>d.cards.filter(c=>c.nguoi===u.id&&COLS[ci].ds.includes(c.day)&&c.step!=="cg");
  const cell=(u,ci)=>{const L=cellCards(u,ci),x=COLS[ci];if(!L.length)return `<div class="xpc${x.now?" now":""}"></div>`;const late=L.filter(isLate).length;
    return `<div class="xpc clk${x.now?" now":""}" data-xpc="${u.id}|${ci}">${MQ_K.map(([k,t,f,cls])=>{const n=L.filter(f).length;return n?`<span class="chip ${cls}">${t} ${n}</span>`:""}).join("")}${late?`<span class="chip k-late">trễ ${late}</span>`:""}</div>`};
  const cap=Math.max(8,...team.map(u=>xvOpen(u.id).length));
  const pipe=CHANNELS.map(ch=>{const I=WC.filter(c=>c.kenh===ch.k);return `<tr><td><b>${esc(ch.short)}</b></td>${DP_STEPS.map(s=>{const L=I.filter(c=>c.step===s||(s==="edit"&&c.step==="worker")),late=L.filter(isLate).length;return `<td class="n"><button type="button" class="xcell${!L.length?" z":late?" jam":["dkb","dvd","dceo"].includes(s)?" w":s==="xong"?" ok":""}" data-xpipe="${esc(ch.k)}|${s}">${L.length}${late?` · trễ ${late}`:""}</button></td>`}).join("")}</tr>`}).join("");
  m.innerHTML=H("Tổng quan Content",`${xvLbl(W)} · hôm nay ${dayLbl(today)} · đổi kỳ xem ở ô chọn thời gian trên cùng`)+`
  <div class="lwtool"><span class="sp"></span>${xvGive()?`<button class="btn" id="mq-hot">🔥 Đẩy sản phẩm đang lên xu hướng</button><button class="btn" data-go="kehoach" data-step7="1">6. Làm hằng ngày</button>`:""}<button class="btn" data-go="lich">Calendar</button></div>
  <div class="xchs">${CHANNELS.map(chCard).join("")}</div>
  <div class="xr2">
   <section class="card"><div class="card-h"><h2>Việc đang chờ duyệt</h2><span class="hint">xử lý xong là hết số</span><span class="sp"></span>${Q.length?`<button class="btn pri" id="mq-rv">Duyệt lần lượt (${Q.length}) →</button>`:""}</div>
    <div class="xq">${[["Kịch bản chờ duyệt",qn("dkb")],["Video chờ Oanh duyệt",qn("dvd")]].concat(ME.role==="admin"?[["Video chờ chị duyệt",qn("dceo")]]:[]).map(([t,n])=>`<div class="xqi${n?" hot":""}"><b class="numeric">${n}</b><span>${t}</span></div>`).join("")}<div class="xqi${unas.length?" hot":""} clk" data-go="kehoach" data-step7="1"><b class="numeric">${unas.length}</b><span>Video trong kỳ chưa giao</span></div></div>
    <div class="xkhoq clk" data-xkho="1"><b class="numeric">${free.length}</b><span><b>Video tồn còn dùng được</b> <small>${xvGroupBy(free,k=>k.sku).sort((a,b)=>b[1].length-a[1].length).slice(0,4).map(([k,L])=>esc(sk(k).n)+" "+L.length).join(" · ")||"kho trống"} · trong kỳ đã xếp ${WC.filter(c=>c.khoMa).length}</small></span><span class="btn sm">Xếp vào lịch →</span></div></section>
   <section class="card"><div class="card-h"><h2>Cần chú ý</h2><span class="hint">web tự phát hiện</span></div>
    <ul class="xatt">${att.map(([t,h])=>`<li><i class="xdot x-${t}"></i><span>${h}</span></li>`).join("")||`<li><i class="xdot x-grn"></i><span>Mọi thứ đang đúng nhịp.</span></li>`}</ul></section>
  </div>
  <section class="card flush"><div class="card-h pad"><h2>Ai đang làm gì</h2><span class="hint">${days.length<=7?"theo ngày":"theo tuần"} video lên kênh · bấm ô để xem thẻ</span><span class="sp"></span><span class="xleg">${MQ_K.map(([k,t,f,cls])=>`<span class="chip ${cls}">${t}</span>`).join("")}<span class="chip k-late">trễ</span></span></div>
   <div class="tbl"><div class="xpg" style="grid-template-columns:150px repeat(${COLS.length},minmax(110px,1fr)) 130px"><div class="xph">Người</div>${COLS.map(x=>`<div class="xph${x.now?" now":""}">${x.l}</div>`).join("")}<div class="xph">Đang giữ</div>
   ${team.map(u=>{const L=xvOpen(u.id),late=L.filter(isLate).length,p=Math.min(100,Math.round(L.length/cap*100));return `<div class="xpw"><b>${esc(u.name)}</b><small>${esc(CHANNELS.filter(ch=>chanOwner(ch.k)===u.id).map(ch=>ch.short).join(" · ")||(u.role==="lead"?"trưởng nhóm":"content"))}</small></div>${COLS.map((x,ci)=>cell(u,ci)).join("")}<div class="xpl"><span><b>${L.length}</b> việc${late?` · <b class="t-red">${late} trễ</b>`:""}</span><span class="xlbar"><i style="width:${p}%;background:${late>=2?"#d6336c":p>=70?"#2f6fde":"#2f9e44"}"></i></span></div>`}).join("")}</div></div></section>
  <section class="card"><div class="card-h"><h2>Dây chuyền theo kênh</h2><span class="hint">số thẻ trong kỳ đang nằm ở mỗi bước · ô đỏ là có thẻ trễ · bấm số để xem thẻ</span></div>
   <div class="tbl"><table class="xpipe"><thead><tr><th>Kênh</th>${DP_STEPS.map(s=>`<th class="n">${esc(stepName(s))}</th>`).join("")}</tr></thead><tbody>${pipe}</tbody></table></div></section>`;
  xvBindWeek(m);
  if($("#mq-rv"))$("#mq-rv").onclick=openReview;
  if($("#mq-hot"))$("#mq-hot").onclick=()=>openHot();
  m.querySelectorAll("[data-xkho]").forEach(x=>x.onclick=()=>{XV.tab="kho";PAGE="kehoach";STEP=7;renderMain();scrollTo(0,0)});
  m.querySelectorAll("[data-xch]").forEach(x=>x.onclick=()=>{LW.kenh=x.dataset.xch;LW.w=W.w||1;PAGE="lich";SUB.lich="week";renderMain();scrollTo(0,0)});
  m.querySelectorAll("[data-xpipe]").forEach(x=>x.onclick=()=>{const [k,s]=x.dataset.xpipe.split("|");Object.assign(DP,{kenh:k,step:s,tuyen:"",nguoi:"",sku:"",loai:"",view:"buoc"});DP.sel.clear();PAGE="dieuphoi";renderMain();scrollTo(0,0)});
  m.querySelectorAll("[data-xpc]").forEach(x=>x.onclick=()=>{const [u,ci]=x.dataset.xpc.split("|");const L=cellCards({id:u},+ci);
    $("#drawerIn").innerHTML=`<div class="dh"><h2>${esc(userName(u))} · ${esc(COLS[+ci].l)}</h2><button class="btn sm" id="dx">Đóng</button></div><p class="hint">Các video lên kênh trong khoảng này mà ${esc(userName(u))} đang giữ. Bấm để mở thẻ.</p><div class="xlist">${L.map(c=>xvMini(c,`<span class="xms">${esc(chOf(c.kenh).short)} · ${esc(stepName(c.step))}</span>`)).join("")}</div>`;
    $("#drawer").hidden=false;$("#dx").onclick=closeDrawer;bindCommon($("#drawerIn"))});
}
PAGES.mkt_tq=pMktTq;
