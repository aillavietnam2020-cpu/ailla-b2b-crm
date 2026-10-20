/* =====================================================================
   Cài đặt › Sản phẩm: danh sách sản phẩm đang bán thật (mã bán, dung tích / trọng lượng, giá lẻ, tồn kho).
   Danh mục kế hoạch marketing (dùng cho research, kịch bản) vẫn giữ, chuyển sang tab thứ hai.
   ===================================================================== */
const SPS={canEdit:()=>typeof SV!=="undefined"&&SV.perms&&SV.perms.includes("product.manage"),view:"sku",pick:new Set(),nhom:"",q:"",only:"",data:null,map:null,busy:false,err:"",at:0};
async function spsLoad(){
  if(SPS.busy)return;SPS.busy=true;
  try{
    if(typeof khoLoad==="function")khoLoad();
    const [pr,mp]=await Promise.all([svApi("/api/prices?limit=1000"),kApi("/map").catch(()=>({map:[]}))]);
    SPS.data=pr.products||[];SPS.tiers=pr.tiers||[];try{SPS.photos=new Map((await svApi("/api/products/photos")).map(r=>[r.product_id,r.v]))}catch(e){SPS.photos=SPS.photos||new Map()}try{SPS.groups=await svApi("/api/product-groups")}catch(e){SPS.groups=SPS.groups||[]}SPS.map=new Map((mp.map||[]).map(r=>[String(r.crm_sku).toLowerCase(),r]));SPS.err=""}
  catch(e){SPS.err=e.message||"Không tải được"}
  SPS.busy=false;SPS.at=Date.now();if(PAGE==="sanpham")renderMain()}
/* Dung tích / trọng lượng đọc từ tên sản phẩm (ví dụ "Lau sàn bệnh viện 1 lít" → 1 lít, "Tẩy lồng 300g" → 300 g). */
function spsSpec(name){
  const m=String(name||"").match(/(\d+(?:[.,]\d+)?)\s*(ml|lít|lit|l|kg|gam|gr|g)(?![a-zà-ỹ])/i);if(!m)return "";
  const u=m[2].toLowerCase(),unit=u==="ml"?"ml":/^l/.test(u)?"lít":u==="kg"?"kg":"g";
  return m[1].replace(".",",")+" "+unit}
function spsStock(p){
  if(typeof KHO==="undefined"||!KHO.cat||!KHO.stock)return null;
  const k=String(p.sku).toLowerCase(),mp=SPS.map&&SPS.map.get(k);
  if(mp){const f=+mp.factor||1;return Math.floor(khoStock(mp.misa_code)/f)}
  const it=[...KHO.items.values()].find(i=>String(i.code).toLowerCase()===k);
  return it?khoStock(it.code):null}
function pSanPhamSku(m){
  const can_=typeof SV!=="undefined"&&SV.perms&&(SV.perms.includes("price.read")||ME.role==="admin");
  if(!SPS.data&&!SPS.busy&&Date.now()-SPS.at>3000)spsLoad();
  const tabs=`<nav class="settabs"><button class="${SPS.view==="sku"?"on":""}" data-spv="sku">Sản phẩm đang bán</button><button class="${SPS.view==="grp"?"on":""}" data-spv="grp">Nhóm sản phẩm</button><button class="${SPS.view==="plan"?"on":""}" data-spv="plan">Danh mục kế hoạch marketing</button></nav>`;
  if(SPS.view==="grp"){spsGroupView(m,tabs);return}
  if(SPS.view==="plan"){PAGES.__sanphamPlan(m);m.insertAdjacentHTML("afterbegin",tabs);m.querySelectorAll("[data-spv]").forEach(b=>b.onclick=()=>{SPS.view=b.dataset.spv;renderMain()});return}
  const P=(SPS.data||[]).filter(p=>p.active&&p.price_scope!=="CUSTOM");
  const groups=[...new Set(P.map(p=>p.group_name||"Chưa có nhóm"))].sort((a,b)=>a.localeCompare(b,"vi"));
  const fold=t=>String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/gi,"d").toLowerCase();
  const needle=fold(SPS.q.trim());
  let L=P.filter(p=>(!SPS.nhom||(p.group_name||"Chưa có nhóm")===SPS.nhom)&&(!needle||needle.split(/\s+/).every(w=>fold(p.sku+" "+p.name).includes(w))));
  const rows=L.map(p=>({p,tk:spsStock(p)}));
  if(SPS.only==="has")rows.splice(0,rows.length,...rows.filter(r=>r.tk>0));
  if(SPS.only==="out")rows.splice(0,rows.length,...rows.filter(r=>r.tk!==null&&r.tk<=0));
  const shown=rows.slice(0,200);
  m.innerHTML=H("Sản phẩm",`${P.length} sản phẩm đang bán`)+tabs+
  `<div class="filters"><select id="sps-n">${opt([["","Mọi nhóm"]].concat(groups.map(g=>[g,g])),SPS.nhom)}</select><input id="sps-q" placeholder="Tìm mã, tên…" value="${esc(SPS.q)}" style="max-width:260px"><select id="sps-o">${opt([["","Mọi tình trạng kho"],["has","Còn hàng"],["out","Hết hoặc âm"]],SPS.only)}</select><span class="hint">${rows.length} sản phẩm</span><span class="sp"></span>${SPS.canEdit()?`<button class="btn pri" id="sps-add">+ Thêm sản phẩm</button>`:""}</div>
   <div id="spk-bar" class="spk-bar" hidden></div>
   <section class="card flush">${!can_?`<p class="hint pad">Bạn chưa có quyền xem bảng giá nên chưa hiện được danh sách này.</p>`:SPS.err?`<div class="note red">${esc(SPS.err)}</div>`:!SPS.data?`<p class="hint pad">Đang tải…</p>`:tbl([...(SPS.canEdit()?[`<input type="checkbox" id="spk-all" title="Chọn cả danh sách đang hiện" aria-label="Chọn tất cả">`]:[]),"Ảnh","Mã","Tên sản phẩm","Nhóm","Dung tích / trọng lượng","Giá lẻ (đ)","Tồn kho","ĐVT"].concat(SPS.canEdit()?[""]:[]),[shown.map(({p,tk})=>{const bl=p.prices&&p.prices.BAN_LE;return `<tr>${SPS.canEdit()?`<td class="spk-c"><input type="checkbox" class="spk" data-id="${p.id}"${SPS.pick.has(p.id)?" checked":""} aria-label="Chọn ${esc(p.sku)}"></td>`:""}<td>${spsImg(p,false)}</td><td class="mono">${esc(p.sku)}</td><td><b>${esc(p.name)}</b></td><td>${esc(p.group_name||"—")}</td><td>${esc(spsSpec(p.name))||"—"}</td><td class="n">${bl?nf(bl):"—"}</td><td class="n">${tk===null?`<span class="hint">chưa gắn kho</span>`:tk<=0?`<b style="color:#b42318">${nf(tk)}</b>`:nf(tk)}</td><td>${esc(p.unit||"")}</td>${SPS.canEdit()?`<td class="nowrap"><button class="btn sm" data-sps-ed="${p.id}">Sửa</button> <button class="btn sm" data-sps-more="${p.id}" title="Ngừng bán, xóa" aria-label="Thêm thao tác">⋯</button></td>`:""}</tr>`}).join("")])}${rows.length>200?`<p class="hint pad">Hiện 200 sản phẩm đầu. Gõ mã hoặc tên để thu hẹp.</p>`:""}</section>`;
  m.querySelectorAll("[data-spv]").forEach(b=>b.onclick=()=>{SPS.view=b.dataset.spv;renderMain()});
  $("#sps-n").onchange=e=>{SPS.nhom=e.target.value;renderMain()};
  $("#sps-o").onchange=e=>{SPS.only=e.target.value;renderMain()};
  if($("#sps-add"))$("#sps-add").onclick=()=>spsForm(null);
  m.querySelectorAll("[data-sps-img]").forEach(i=>i.onclick=()=>{const p=SPS.data.find(x=>x.id===i.dataset.spsImg);if(p)openDrawerHTML(`<h2>${esc(p.name)}</h2><p class="hint mono">${esc(p.sku)}</p><img src="${spsPhotoSrc(p,false)}" alt="${esc(p.name)}" style="width:100%;max-height:70vh;object-fit:contain;background:#f6f7f9;border-radius:10px">`)});
  m.querySelectorAll("[data-sps-ed]").forEach(b=>b.onclick=()=>spsForm(b.dataset.spsEd));
  const spsOff=async id=>{const p=SPS.data.find(x=>x.id===id);if(!p||!confirm("Ngừng bán "+p.sku+"? Sản phẩm không còn hiện khi lập đơn, đơn cũ giữ nguyên. Bật lại ở Bảng giá B2B."))return;
    try{await svApi("/api/products/"+p.id,{method:"PATCH",body:JSON.stringify({active:false})});toast("Đã ngừng bán "+p.sku);SPS.data=null;await spsLoad()}catch(e){toast(e.message)}};
  const spsDel=async id=>{const p=SPS.data.find(x=>x.id===id);if(!p||!confirm("Xóa sản phẩm "+p.sku+" · "+p.name+"? Sản phẩm biến mất khỏi danh sách và khi lập đơn. Lịch sử đơn cũ giữ nguyên."))return;
    try{await svApi("/api/products/"+p.id,{method:"DELETE"});toast("Đã xóa "+p.sku);SPS.data=null;await spsLoad()}catch(e){toast(e.message)}};
  /* Nút ⋯ ở mỗi dòng: gom Ngừng bán và Xóa vào một menu nhỏ cho bảng gọn. */
  const rmClose=()=>{const o=document.querySelector(".rmpop");if(o)o.remove()};rmClose();
  m.querySelectorAll("[data-sps-more]").forEach(b=>b.onclick=e=>{e.stopPropagation();const had=document.querySelector(".rmpop");rmClose();if(had&&had.dataset.id===b.dataset.spsMore)return;
    const r=b.getBoundingClientRect(),pop=document.createElement("div");pop.className="rmpop";pop.dataset.id=b.dataset.spsMore;
    pop.style.top=Math.min(r.bottom+4,innerHeight-100)+"px";pop.style.right=Math.max(8,innerWidth-r.right)+"px";
    pop.innerHTML='<button type="button" data-a="off">Ngừng bán</button><button type="button" data-a="del" class="dg">Xóa sản phẩm</button>';
    pop.onclick=ev=>{const a=ev.target.dataset&&ev.target.dataset.a;if(!a)return;rmClose();if(a==="off")spsOff(b.dataset.spsMore);else spsDel(b.dataset.spsMore)};
    document.body.appendChild(pop)});
  if(!window.__rmBound){window.__rmBound=1;document.addEventListener("click",()=>{const o=document.querySelector(".rmpop");if(o)o.remove()});window.addEventListener("scroll",()=>{const o=document.querySelector(".rmpop");if(o)o.remove()},true)}
  /* Chọn nhiều sản phẩm rồi chuyển vào một nhóm: tick chỉ đổi thanh thao tác, không vẽ lại bảng nên không nhảy vị trí cuộn. */
  const spkBar=()=>{const el=$("#spk-bar");if(!el)return;const n=SPS.pick.size;el.hidden=!n;if(!n){el.innerHTML="";return}
    el.innerHTML=`<b>Đã chọn ${n} sản phẩm</b><span>Chuyển vào nhóm</span><select id="spk-g">${opt([["","— Chưa có nhóm —"]].concat((SPS.groups||[]).map(g=>[g.id,g.name])),"")}</select><button type="button" class="btn sm pri" id="spk-go">Chuyển</button><button type="button" class="lnk" id="spk-clr">Bỏ chọn</button>`;
    $("#spk-clr").onclick=()=>{SPS.pick.clear();m.querySelectorAll(".spk").forEach(x=>x.checked=false);const a=$("#spk-all");if(a)a.checked=false;spkBar()};
    $("#spk-go").onclick=async e=>{const gid=$("#spk-g").value,gn=gid?(SPS.groups.find(g=>g.id===gid)||{}).name:"Chưa có nhóm";const b=e.currentTarget;b.disabled=true;
      try{const r=await svApi("/api/products/bulk-group",{method:"POST",body:JSON.stringify({ids:[...SPS.pick],group_id:gid||null})});toast("Đã chuyển "+r.count+" sản phẩm vào "+gn);SPS.pick.clear();SPS.data=null;await spsLoad()}catch(err){toast(err.message);b.disabled=false}}};
  m.querySelectorAll(".spk").forEach(x=>x.onchange=()=>{if(x.checked)SPS.pick.add(x.dataset.id);else SPS.pick.delete(x.dataset.id);const a=$("#spk-all");if(a){const all=[...m.querySelectorAll(".spk")];a.checked=all.length>0&&all.every(c=>c.checked)}spkBar()});
  if($("#spk-all"))$("#spk-all").onchange=e=>{m.querySelectorAll(".spk").forEach(x=>{x.checked=e.target.checked;if(e.target.checked)SPS.pick.add(x.dataset.id);else SPS.pick.delete(x.dataset.id)});spkBar()};
  spkBar();
  $("#sps-q").oninput=()=>{SPS.q=$("#sps-q").value;const p=$("#sps-q").selectionStart;renderMain();const q=$("#sps-q");q.focus();q.setSelectionRange(p,p)}}
PAGES.__sanphamPlan=PAGES.sanpham;
PAGES.sanpham=pSanPhamSku;

/* Tab "Nhóm sản phẩm": thêm, đổi tên, xóa nhóm; bấm số sản phẩm để xem các sản phẩm trong nhóm. Đưa sản phẩm vào nhóm: tick ở danh sách hoặc chọn nhóm trong form Sửa. */
function spsGroupView(m,tabs){
  const G=(SPS.groups||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,"vi")),ed=SPS.canEdit(),all=(SPS.data||[]).filter(p=>p.active&&p.price_scope!=="CUSTOM");
  const cnt=id=>all.filter(p=>p.group_id===id).length,none=all.filter(p=>!p.group_id).length;
  m.innerHTML=H("Sản phẩm",`${G.length} nhóm`)+tabs+`<section class="card flush">
   ${ed?`<form class="spg-add" id="spg-f0"><input id="spg-n" placeholder="Tên nhóm mới, ví dụ: Nước giặt rẻ" maxlength="120" required><button class="btn pri">+ Thêm nhóm</button></form>`:""}
   ${tbl(["Tên nhóm","Mã nhóm","Sản phẩm đang bán"].concat(ed?[""]:[]),G.map(g=>`<tr><td><b>${esc(g.name)}</b></td><td class="mono">${esc(g.code||"")}</td><td class="n"><button class="lnk" data-spg-view="${esc(g.name)}">${nf(cnt(g.id))} sản phẩm</button></td>${ed?`<td class="nowrap"><button class="btn sm" data-spg-ren="${g.id}">Đổi tên</button> <button class="btn sm danger" data-spg-del="${g.id}">Xóa</button></td>`:""}</tr>`).concat([`<tr class="mut"><td><b>Chưa có nhóm</b></td><td></td><td class="n"><button class="lnk" data-spg-view="Chưa có nhóm">${nf(none)} sản phẩm</button></td>${ed?"<td></td>":""}</tr>`]))}
   <p class="hint pad">Xóa nhóm không xóa sản phẩm: các sản phẩm trong nhóm chuyển về "Chưa có nhóm". Muốn đưa sản phẩm vào nhóm: tick chọn ở tab Sản phẩm đang bán rồi bấm Chuyển, hoặc chọn nhóm trong form Sửa.</p></section>`;
  m.querySelectorAll("[data-spv]").forEach(b=>b.onclick=()=>{SPS.view=b.dataset.spv;renderMain()});
  const reload=async()=>{SPS.data=null;await spsLoad()};
  m.querySelectorAll("[data-spg-view]").forEach(b=>b.onclick=()=>{SPS.nhom=b.dataset.spgView;SPS.view="sku";renderMain()});
  if($("#spg-f0"))$("#spg-f0").onsubmit=async e=>{e.preventDefault();const n=$("#spg-n").value.trim();if(!n)return;
    try{await svApi("/api/product-groups",{method:"POST",body:JSON.stringify({name:n})});toast("Đã thêm nhóm "+n);await reload()}catch(err){toast(err.message)}};
  m.querySelectorAll("[data-spg-ren]").forEach(b=>b.onclick=()=>{const g=G.find(x=>x.id===b.dataset.spgRen);if(!g)return;
    openDrawerHTML(`<h2>Đổi tên nhóm</h2><form class="frm" id="spg-f"><label class="field">Tên nhóm<input id="spg-fn" value="${esc(g.name)}" required maxlength="120"></label><div id="spg-e"></div><button class="btn pri">Lưu</button></form>`);
    $("#spg-fn").select();
    $("#spg-f").onsubmit=async e=>{e.preventDefault();try{await svApi("/api/product-groups/"+g.id,{method:"PATCH",body:JSON.stringify({name:$("#spg-fn").value})});closeDrawer();toast("Đã đổi tên nhóm");await reload()}catch(err){$("#spg-e").innerHTML=`<div class="note red">${esc(err.message)}</div>`}}});
  m.querySelectorAll("[data-spg-del]").forEach(b=>b.onclick=async()=>{const g=G.find(x=>x.id===b.dataset.spgDel);if(!g)return;const n=cnt(g.id);
    if(!confirm("Xóa nhóm "+g.name+"?"+(n?"\n\n"+n+" sản phẩm trong nhóm sẽ chuyển về \"Chưa có nhóm\". Sản phẩm không bị xóa.":"")))return;
    try{const r=await svApi("/api/product-groups/"+g.id,{method:"DELETE"});toast("Đã xóa nhóm "+g.name+(r.moved?", "+r.moved+" sản phẩm về Chưa có nhóm":""));if(SPS.nhom===g.name)SPS.nhom="";await reload()}catch(err){toast(err.message)}});
}

/* Thêm / sửa sản phẩm bán (và giá lẻ) */
function spsForm(id){
  const p=id?SPS.data.find(x=>x.id===id):null,groups=SPS.groups||[],tier=(SPS.tiers||[]).find(t=>t.code==="BAN_LE");
  const gOpts=[["","— chưa có nhóm —"]].concat(groups.map(g=>[g.id,g.name]));
  openDrawerHTML(`<h2>${p?"Sửa sản phẩm "+esc(p.sku):"Thêm sản phẩm"}</h2><form class="frm" id="spf2">
   <div class="row4"><label class="field">Mã sản phẩm (SKU)<input id="spf-sku" value="${esc(p?p.sku:"")}" ${p?"disabled":"required"} maxlength="60"></label><label class="field grow">Tên sản phẩm<input id="spf-name" value="${esc(p?p.name:"")}" required></label></div>
   <div class="row4"><label class="field">Nhóm<select id="spf-grp">${opt(gOpts,p?(p.group_id||""):"")}</select></label><label class="field">Đơn vị tính<input id="spf-unit" value="${esc(p?(p.unit||""):"")}" placeholder="Chai, Can, Thùng…"></label><label class="field">Quy cách<input id="spf-pack" value="${esc(p?(p.pack_size||""):"")}" placeholder="Ví dụ: 12 chai / thùng"></label></div>
   <div class="field"><label>Ảnh sản phẩm</label><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">${p&&SPS.photos&&SPS.photos.has(p.id)?`<img src="${spsPhotoSrc(p,true)}" style="width:72px;height:72px;object-fit:contain;background:#f6f7f9;border-radius:8px">`:""}<input id="spf-img" type="file" accept="image/*" style="max-width:260px">${p&&SPS.photos&&SPS.photos.has(p.id)?`<button type="button" class="btn sm" id="spf-imgdel">Xóa ảnh</button>`:""}</div></div>
   <h3 style="margin:12px 0 4px">Giá các cấp (đ)</h3><p class="hint">Cấp để trống là chưa có giá, bị chặn bán cho tới khi đặt giá. Giá mới có hiệu lực từ hôm nay.</p>
   <table class="spf-tbl"><thead><tr>${(SPS.tiers||[]).map(t=>`<th>${esc(t.name)}</th>`).join("")}</tr></thead><tbody><tr>${(SPS.tiers||[]).map(t=>`<td><input class="spf-tp" data-tid="${t.id}" data-code="${t.code}" type="number" min="0" step="100" placeholder="—" aria-label="Giá ${esc(t.name)}" value="${p&&p.prices&&p.prices[t.code]!=null?p.prices[t.code]:""}"></td>`).join("")}</tr></tbody></table>
   <p class="hint">Dung tích / trọng lượng tự đọc từ tên sản phẩm (ví dụ "1 lít", "5kg"), nên ghi rõ trong tên.</p>
   <div class="acts"><button class="btn pri" id="spf-ok">${p?"Lưu":"Thêm sản phẩm"}</button><span id="spf-msg" class="hint"></span></div></form>`);
  if($("#spf-imgdel"))$("#spf-imgdel").onclick=async()=>{if(!confirm("Xóa ảnh của "+p.sku+"?"))return;try{await svApi("/api/products/"+id+"/photo",{method:"DELETE"});closeDrawer();toast("Đã xóa ảnh");SPS.data=null;await spsLoad()}catch(e){toast(e.message)}};
  $("#spf2").onsubmit=async e=>{e.preventDefault();const ok=$("#spf-ok");ok.disabled=true;$("#spf-msg").textContent="Đang lưu…";
    const body={name:$("#spf-name").value.trim(),unit:$("#spf-unit").value.trim()||null,pack_size:$("#spf-pack").value.trim()||null,group_id:$("#spf-grp").value||null};
    try{
      let pid=id;
      if(p)await svApi("/api/products/"+id,{method:"PATCH",body:JSON.stringify(body)});
      else{const r=await svApi("/api/products",{method:"POST",body:JSON.stringify(Object.assign({sku:$("#spf-sku").value.trim()},body))});pid=r.id}
      for(const inp of document.querySelectorAll(".spf-tp")){
        const old=p&&p.prices&&p.prices[inp.dataset.code]!=null?p.prices[inp.dataset.code]:null,now=inp.value===""?null:Math.round(+inp.value);
        if(now===old)continue;
        await svApi("/api/prices",{method:"POST",body:JSON.stringify({product_id:pid,tier_id:inp.dataset.tid,amount:now,reason:p?"Sửa giá ở trang Sản phẩm":"Giá khi tạo sản phẩm mới"})})}
      const fi=$("#spf-img");
      if(fi&&fi.files&&fi.files[0]){const im=await spsShrink(fi.files[0]);await svApi("/api/products/"+pid+"/photo",{method:"PUT",body:JSON.stringify({image:im.image,thumb:im.thumb})})}
      closeDrawer();toast(p?"Đã lưu "+p.sku:"Đã thêm sản phẩm");SPS.data=null;await spsLoad()}
    catch(err){$("#spf-msg").textContent=err.message;ok.disabled=false}}}

const spsPhotoSrc=(p,t)=>"/api/products/"+encodeURIComponent(p.id)+"/photo?"+(t?"t=1&":"")+"v="+encodeURIComponent((SPS.photos&&SPS.photos.get(p.id))||"");
const spsImg=(p,big)=>SPS.photos&&SPS.photos.has(p.id)?`<img data-sps-img="${p.id}" src="${spsPhotoSrc(p,true)}" alt="${esc(p.name)}" loading="lazy" style="width:46px;height:46px;object-fit:contain;background:#f6f7f9;border-radius:8px;cursor:zoom-in">`:`<span style="display:inline-block;width:46px;height:46px;border-radius:8px;background:#f1f2f6"></span>`;
function spsShrink(file){
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file),img=new Image();
    const draw=(max,q)=>{const k=Math.min(1,max/Math.max(img.width,img.height)),cv=document.createElement("canvas");cv.width=Math.round(img.width*k);cv.height=Math.round(img.height*k);const cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(img,0,0,cv.width,cv.height);return cv.toDataURL("image/jpeg",q)};
    img.onload=()=>{const big=draw(720,0.8),thumb=draw(160,0.7);URL.revokeObjectURL(url);res({image:big,thumb})};
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error("Không đọc được ảnh"))};
    img.src=url})}
