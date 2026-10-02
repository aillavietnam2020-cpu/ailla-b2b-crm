/* =====================================================================
   PHÂN BỔ LỊCH ĐĂNG — xếp video cũ (kho) + video mới đã duyệt vào ô ngày × kênh
   ===================================================================== */
const SLOT0={"TikTok chính":3,"TikTok Via 1":1,"TikTok Via 2":1,"Fanpage chính":1};
const AUTO_CH={BT:"TikTok chính",TD:"TikTok chính",XM:"TikTok chính",SAP:"TikTok chính",TL:"TikTok Via 1",NG:"TikTok Via 1",AR:"TikTok Via 2"};
let PB={tu:0,den:0,tab:"kho",sel:new Set(),sku:"",q:"",kenh:"auto",mode:"hook",nguoi:"u_may",onlyFree:true};
const slotsOf=()=>Object.assign({},SLOT0,D().settings.slots||{});
const khoOk=k=>(k.duyet||"").toLowerCase()==="đã duyệt";
const canPB=()=>can(ME,"viec.giao")||can(ME,"kho.gan");
function cellCards(day,k){return D().cards.filter(c=>c.kenh===k&&c.day===day)}
const isPH=c=>c.nguon==="Footage cũ"&&!c.khoMa&&(c.step==="cg"||c.step==="kb");
function phIn(kenh,from,to,day){return D().cards.filter(c=>c.kenh===kenh&&isPH(c)&&(day?c.day===day:c.day>=from&&c.day<=to)).sort((a,b)=>a.day-b.day)[0]}
function freeDay(kenh,sku,from,to,skip){const S=slotsOf();for(let x=from;x<=to;x++){const cs=cellCards(x,kenh).filter(c=>c.id!==skip);if(cs.length<(S[kenh]||0)&&!cs.some(c=>c.sku===sku))return x}for(let x=from;x<=to;x++){if(cellCards(x,kenh).filter(c=>c.id!==skip).length<(S[kenh]||0))return x}return 0}
function allocKho(ma,kenh,day,mode,nguoi,phId){let cid;DB.mutate(ME.name,`xếp video cũ ${ma} vào ${kenh} ngày ${day}`,d=>{const k=d.kho.find(x=>x.ma===ma);if(!k||k.maDang)return;
  const ph=phId?d.cards.find(x=>x.id===phId):null;
  if(ph){Object.assign(ph,{khoMa:k.ma,sku:k.sku,linkVideo:k.link,yTuong:"Video cũ "+k.ma+(k.tuyen?" · "+k.tuyen:""),nguoi:ph.nguoi||nguoi,goiy:ph.goiy||nguoi,step:ph.step==="cg"||ph.step==="kb"?(mode==="hook"?"kb":"dvd"):ph.step});cid=ph.id}else{
  const c=newCard(d,{sku:k.sku,kenh,day,nguon:"Footage cũ",tuyen:"Đổi hook video tồn",yTuong:"Video cũ "+k.ma+(k.tuyen?" · "+k.tuyen:""),linkVideo:k.link,nguoi,goiy:nguoi,step:mode==="hook"?"kb":"dvd",ceo:"CẦN KIỂM TRA",khoMa:k.ma});
  d.cards.push(c);cid=c.id}Object.assign(k,{kenhDeXuat:kenh,lyDo:k.lyDo||"Phân bổ lịch đăng",canSua:mode==="hook"?"Đổi hook, chèn chữ mới":"Đăng nguyên, chờ duyệt claim",trangThai:"Đã lên lịch",maDang:cid})});return cid}
function moveSlot(id,kenh,day){DB.mutate(ME.name,`đổi lịch ${id} → ${kenh} ngày ${day}`,d=>{const c=d.cards.find(x=>x.id===id);c.kenh=kenh;c.day=day})}
function pPhanBo(m){
  const d=D(),td=d.settings.today,S=slotsOf(),ed=canPB();
  if(!PB.tu){PB.tu=td;PB.den=Math.min(MONTH.ndays,td+13)}
  const days=[];for(let x=PB.tu;x<=PB.den;x++)days.push(x);
  const khoFree=d.kho.filter(k=>khoOk(k)&&!k.maDang),waitNew=d.cards.filter(c=>c.step==="dang"||c.step==="dvd");
  const emptyBy=k=>sum(days,x=>Math.max(0,(S[k]||0)-cellCards(x,k).length));
  const pool=PB.tab==="kho"?d.kho.filter(k=>(PB.onlyFree?khoOk(k)&&!k.maDang:true)&&(!PB.sku||k.sku===PB.sku)&&(!PB.q||(k.ma+" "+k.tuyen+" "+k.skuText).toLowerCase().includes(PB.q.toLowerCase())))
    :waitNew.filter(c=>(!PB.sku||c.sku===PB.sku)&&(!PB.q||(c.id+" "+(c.hookText||c.yTuong)).toLowerCase().includes(PB.q.toLowerCase())));
  const skus=PB.tab==="kho"?[...new Set(d.kho.map(k=>k.sku))]:[...new Set(waitNew.map(c=>c.sku))];
  m.innerHTML=H("Phân bổ lịch đăng",`${dd(PB.tu)} – ${dd(PB.den)}`)+`<div class="grid kpis">${CHANNELS.map(ch=>kpi(ch.short+" · ô trống",emptyBy(ch.k),`${S[ch.k]||0} bài / ngày`,emptyBy(ch.k)?"var(--orange)":"var(--green)")).join("")}${kpi("Ô chờ video cũ",d.cards.filter(isPH).length,"kế hoạch đã có, chưa chọn video","var(--orange)")}${kpi("Video cũ chưa dùng",khoFree.length,"đã duyệt trong kho")}${kpi("Video mới chờ đăng",waitNew.length,"đã dựng, chờ duyệt / chờ đăng")}</div>
  <div class="pb">
   <section class="card pb-grid"><div class="card-h"><h2>Lịch theo ngày × kênh</h2><span class="sp"></span><label class="inl">Từ <input type="number" id="pb-tu" min="1" max="31" value="${PB.tu}"></label><label class="inl">đến <input type="number" id="pb-den" min="1" max="31" value="${PB.den}"></label></div>
    ${ed?`<div class="inlrow">Số bài / ngày: ${CHANNELS.map(ch=>`<label class="inl">${ch.short}<input type="number" min="0" max="10" data-cap="${ch.k}" value="${S[ch.k]||0}"></label>`).join("")}</div>`:""}
    <div class="tbl pbt"><table><thead><tr><th>Ngày</th>${CHANNELS.map(ch=>`<th>${ch.short}</th>`).join("")}</tr></thead><tbody>
    ${days.map(x=>`<tr class="${x===td?"today":""}${dow(x)>4?" we":""}"><td class="nowrap"><b>${dd(x)}</b><small>${["Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7","CN"][dow(x)]}</small></td>${CHANNELS.map(ch=>{const cs=cellCards(x,ch.k),cap=S[ch.k]||0,free=Math.max(0,cap-cs.length);return `<td class="cell${cs.length>cap?" over":""}" data-drop="${x}|${esc(ch.k)}">${cs.map(c=>`<div class="chip st-${c.step}" data-card="${c.id}" ${ed&&c.step!=="xong"?`draggable="true" data-mv="${c.id}"`:""} style="border-left-color:${sk(c.sku).c}"><b>${isPH(c)?"⬚ Chờ chọn video cũ":esc((c.hookText||c.yTuong).slice(0,34))}</b><small>${c.id} · ${esc(c.nguon==="Footage cũ"?"video cũ":c.nguon==="Đăng lại"?"đăng lại":"mới")} · ${esc(userName(c.nguoi)||"chưa giao")} · ${stepName(c.step).toLowerCase()}</small></div>`).join("")}${Array.from({length:free}).map(()=>`<div class="slot">trống</div>`).join("")}</td>`}).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="hint">Kéo video từ danh sách bên phải thả vào ô. Kéo thẻ đang có sang ô khác để đổi ngày hoặc đổi kênh. Ô viền đỏ là quá số bài/ngày.</p></section>
   <section class="card pb-pool"><div class="tabs">${[["kho",`Video cũ (${khoFree.length})`],["moi",`Video mới chờ đăng (${waitNew.length})`]].map(([k,t])=>`<button data-pbt="${k}" class="${k===PB.tab?"on":""}">${t}</button>`).join("")}</div>
    <div class="filters"><select id="pb-s">${opt([["","Mọi sản phẩm"]].concat(skus.map(k=>[k,sk(k).n])),PB.sku)}</select><input id="pb-q" placeholder="Tìm mã, tuyến…" value="${esc(PB.q)}">${PB.tab==="kho"?`<label class="inl"><input type="checkbox" id="pb-of" ${PB.onlyFree?"checked":""}> chỉ video chưa dùng</label>`:""}</div>
    ${ed?`<div class="bulk"><div><b>${PB.sel.size}</b> video đã chọn · <button class="lnk" id="pb-all">chọn ${Math.min(pool.length,60)} video đang lọc</button> · <button class="lnk" id="pb-none">bỏ chọn</button></div>
     <div class="row4"><label class="field">Kênh<select id="pb-k">${opt([["auto",PB.tab==="kho"?"Tự động (Via theo sản phẩm, còn lại Via 2)":"Giữ kênh hiện tại"]].concat(CHANNELS.map(c=>[c.k,c.k])),PB.kenh)}</select></label>${PB.tab==="kho"?`<label class="field">Cách làm<select id="pb-m">${opt([["hook","Đổi hook, Worker chèn chữ"],["nguyen","Đăng nguyên, chỉ duyệt claim"]],PB.mode)}</select></label><label class="field">Người phụ trách<select id="pb-n">${opt(userOpts(),PB.nguoi)}</select></label>`:""}<button class="btn pri" id="pb-go">Xếp vào ô trống</button></div></div>`:""}
    <div class="poollist">${pool.slice(0,150).map(x=>PB.tab==="kho"?`<label class="pi" draggable="${ed}" data-pool="kho:${x.ma}"><input type="checkbox" data-sel="kho:${x.ma}" ${PB.sel.has("kho:"+x.ma)?"checked":""} ${x.maDang||!ed?"disabled":""}>${swatch(x.sku)}<span><b>${x.ma}</b> · ${esc(x.skuText)}<small>${esc(x.tuyen||"")} · ${esc(x.nguoi)} · ${esc(x.duyet)}${x.maDang?" · đã xếp "+x.maDang:""}</small></span>${x.link?`<a href="${esc(x.link)}" target="_blank" rel="noopener">xem</a>`:""}</label>`
      :`<label class="pi" draggable="${ed}" data-pool="card:${x.id}"><input type="checkbox" data-sel="card:${x.id}" ${PB.sel.has("card:"+x.id)?"checked":""} ${ed?"":"disabled"}>${swatch(x.sku)}<span><b>${x.id}</b> · ${esc((x.hookText||x.yTuong).slice(0,50))}<small>${esc(chOf(x.kenh).short)} · ${dd(x.day)} · ${stepName(x.step)} · ${esc(userName(x.nguoi))}</small></span><button type="button" class="lnk" data-card="${x.id}">mở</button></label>`).join("")||`<p class="empty">Không có video.</p>`}${pool.length>150?`<p class="hint">Đang hiện 150/${pool.length}, lọc thêm để thấy hết.</p>`:""}</div>
    <p class="hint">${PB.tab==="kho"?"Xếp video cũ: app điền vào ô \"Chờ chọn video cũ\" của kế hoạch trước, hết ô mới tạo thẻ mới ở ô trống. \"Đổi hook\" vào bước Lên kịch bản của người phụ trách rồi qua Worker; \"Đăng nguyên\" vào bước Chờ duyệt video để kiểm claim trước khi đăng.":"Video mới đã duyệt: kéo vào ô để đổi ngày / kênh. Muốn đăng thêm kênh khác, mở thẻ → Đăng trên các kênh."}</p></section></div>`;
  $("#pb-tu").onchange=e=>{PB.tu=Math.max(1,Math.min(31,+e.target.value||1));if(PB.den<PB.tu)PB.den=PB.tu;renderMain()};
  $("#pb-den").onchange=e=>{PB.den=Math.max(PB.tu,Math.min(31,+e.target.value||PB.tu));renderMain()};
  m.querySelectorAll("[data-cap]").forEach(i=>i.onchange=()=>{DB.mutate(ME.name,"đổi số bài/ngày "+i.dataset.cap,dt=>{dt.settings.slots=Object.assign({},SLOT0,dt.settings.slots||{});dt.settings.slots[i.dataset.cap]=Math.max(0,+i.value||0)});renderMain()});
  m.querySelectorAll("[data-pbt]").forEach(b=>b.onclick=()=>{PB.tab=b.dataset.pbt;PB.sel.clear();PB.sku="";PB.kenh="auto";renderMain()});
  $("#pb-s").onchange=e=>{PB.sku=e.target.value;renderMain()};$("#pb-q").onchange=e=>{PB.q=e.target.value;renderMain()};
  if($("#pb-of"))$("#pb-of").onchange=e=>{PB.onlyFree=e.target.checked;renderMain()};
  m.querySelectorAll("[data-sel]").forEach(c=>c.onchange=()=>{c.checked?PB.sel.add(c.dataset.sel):PB.sel.delete(c.dataset.sel);const b=m.querySelector(".bulk b");if(b)b.textContent=PB.sel.size});
  if($("#pb-all"))$("#pb-all").onclick=()=>{pool.slice(0,60).forEach(x=>{if(PB.tab==="kho"){if(!x.maDang)PB.sel.add("kho:"+x.ma)}else PB.sel.add("card:"+x.id)});renderMain()};
  if($("#pb-none"))$("#pb-none").onclick=()=>{PB.sel.clear();renderMain()};
  ["#pb-k","#pb-m","#pb-n"].forEach(s=>{if($(s))$(s).onchange=e=>{PB[{"#pb-k":"kenh","#pb-m":"mode","#pb-n":"nguoi"}[s]]=e.target.value}});
  if($("#pb-go"))$("#pb-go").onclick=()=>{if(!PB.sel.size){toast("Chọn ít nhất 1 video");return}let ok=0,fail=0;const from=Math.max(PB.tu,td);
    [...PB.sel].forEach(key=>{const [t,id]=key.split(":");
      if(t==="kho"){const k=D().kho.find(x=>x.ma===id);if(!k||k.maDang)return;const kenh=PB.kenh==="auto"?(AUTO_CH[k.sku]==="TikTok Via 1"?"TikTok Via 1":"TikTok Via 2"):PB.kenh;const ph=phIn(kenh,from,PB.den);if(ph){allocKho(id,kenh,ph.day,PB.mode,PB.nguoi,ph.id);ok++;return}const day=freeDay(kenh,k.sku,from,PB.den);if(!day){fail++;return}allocKho(id,kenh,day,PB.mode,PB.nguoi);ok++}
      else{const c=D().cards.find(x=>x.id===id);if(!c)return;const kenh=PB.kenh==="auto"?c.kenh:PB.kenh;const day=freeDay(kenh,c.sku,from,PB.den,c.id);if(!day){fail++;return}moveSlot(id,kenh,day);ok++}});
    PB.sel.clear();toast(`Đã xếp ${ok} video${fail?`, ${fail} video không còn ô trống trong khoảng ngày — nới khoảng ngày hoặc tăng số bài/ngày`:""}`);renderMain()};
  /* kéo thả */
  m.querySelectorAll("[data-pool]").forEach(e=>e.ondragstart=ev=>ev.dataTransfer.setData("text/plain",e.dataset.pool));
  m.querySelectorAll("[data-mv]").forEach(e=>e.ondragstart=ev=>{ev.stopPropagation();ev.dataTransfer.setData("text/plain","card:"+e.dataset.mv)});
  m.querySelectorAll("[data-drop]").forEach(td2=>{td2.ondragover=e=>{if(!ed)return;e.preventDefault();td2.classList.add("drop")};td2.ondragleave=()=>td2.classList.remove("drop");
    td2.ondrop=e=>{e.preventDefault();td2.classList.remove("drop");if(!ed)return;const [day,kenh]=td2.dataset.drop.split("|"),v=e.dataTransfer.getData("text/plain");const [t,id]=v.split(":");
      if(t==="kho"){const ph=phIn(kenh,0,0,+day);const cid=allocKho(id,kenh,+day,PB.mode,PB.nguoi,ph&&ph.id);if(cid)toast(`Đã xếp ${id} → ${chOf(kenh).short} ${dd(+day)} (${cid})`)}else if(t==="card"){moveSlot(id,kenh,+day);toast(`Đã đổi lịch ${id} → ${chOf(kenh).short} ${dd(+day)}`)}PB.sel.delete(v);renderMain()}});
}
