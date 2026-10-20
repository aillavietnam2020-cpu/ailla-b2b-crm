/* =====================================================================
   CALENDAR DẠNG Ô VUÔNG TỪNG NGÀY (như lịch marketing hay dùng)
   Gắn vào tab ④ Calendar của Kế hoạch tháng, đặt ngay trên danh sách "Lịch đăng thực tế".
   Mỗi ô ngày: bài đã đăng, chờ đăng, chờ duyệt (màu theo trạng thái), kèm số đã đăng / số ô theo mục tiêu.
   Phía trên: 4 ô số + bộ lọc (kênh, trạng thái, sản phẩm). Bên phải: theo tuyến nội dung + bài sắp đăng.
   ===================================================================== */
const CG={k:"",st:"",sku:""};
const CG_COL={"TikTok chính":"#2563eb","TikTok Via 1":"#0d9488","TikTok Via 2":"#d97706","Fanpage chính":"#7c3aed"};
/* Trạng thái hiển thị trên lịch: gom các bước của thẻ video về 3 nhóm */
const CG_ST={xong:{t:"Đã đăng",ic:"✓",bg:"#e8f7ee",fg:"#067647"},dang:{t:"Chờ đăng",ic:"⏳",bg:"#e0ecff",fg:"#1d4ed8"},duyet:{t:"Chờ duyệt",ic:"●",bg:"#fff4d6",fg:"#b54708"}};
const CG_ORD=["xong","dang","duyet"];
const cgSt=c=>c.step==="xong"?"xong":c.step==="dang"?"dang":(c.step==="dvd"||c.step==="dceo")?"duyet":"";
const cgDay=c=>c.step==="xong"?(+c.ngayDang||+c.day||0):(+c.day||0);
function cgAll(d){
  return d.cards.map(c=>({c,st:cgSt(c),day:cgDay(c)})).filter(x=>x.st&&x.day>0&&x.day<=MONTH.ndays)
}
function cgRange(){let r=null;try{r=calRange()}catch(e){}return r&&r.tu?{tu:Math.max(1,r.tu),den:Math.min(MONTH.ndays,r.den)}:{tu:1,den:MONTH.ndays}}
function cgPosts(all,R){
  const out={};
  all.forEach(x=>{
    if(x.day<R.tu||x.day>R.den)return;
    if(CG.k&&x.c.kenh!==CG.k)return;
    if(CG.sku&&x.c.sku!==CG.sku)return;
    if(CG.st&&x.st!==CG.st)return;
    (out[x.day]=out[x.day]||[]).push(x)
  });
  return out
}
function cgGrid(el,o){
  const d=o.d,td=d.settings.today,R=cgRange(),all=cgAll(d),P=cgPosts(all,R),first=(new Date(MONTH.year,MONTH.mon-1,R.tu).getDay()+6)%7,cells=[];
  for(let i=0;i<first;i++)cells.push(0);for(let i=R.tu;i<=R.den;i++)cells.push(i);while(cells.length%7)cells.push(0);
  const cap=day=>CHANNELS.filter(ch=>!CG.k||ch.k===CG.k).reduce((a,ch)=>{let n=0;try{n=calCap(ch.k,day)}catch(e){}return a+(n||0)},0);
  const flat=Object.values(P).flat();
  const cnt=st=>flat.filter(x=>x.st===st).length;
  let thieu=0;for(let dy=Math.max(td,R.tu);dy<=R.den;dy++){const cp=cap(dy),n=(P[dy]||[]).length;if(cp>n)thieu+=cp-n}
  const chip=x=>{const c=x.c,s=CG_ST[x.st],col=CG_COL[c.kenh]||"#64748b";
    return `<span class="cgp" data-cgc="${esc(c.id)}" style="border-left:4px solid ${col};background:${s.bg};color:${s.fg}" title="${esc(s.t+" · "+(c.hookText||c.yTuong||c.tuyen||"")+" · "+chOf(c.kenh).short)}">${s.ic} ${esc(chOf(c.kenh).short)} · ${esc(sk(c.sku).n)}</span>`};
  const tile=(n,l,col,sub)=>`<div class="cgk"><i style="background:${col}"></i><div><b>${n}</b><span>${l}</span>${sub?`<em>${sub}</em>`:""}</div></div>`;
  const css=`.cgw{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:14px;align-items:start}@media(max-width:1000px){.cgw{grid-template-columns:minmax(0,1fr)}}.cgks{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:6px 0 10px}@media(max-width:700px){.cgks{grid-template-columns:repeat(2,minmax(0,1fr))}}.cgk{display:flex;gap:10px;align-items:center;background:#fff;border:1px solid #e3ddf7;border-radius:12px;padding:7px 12px}.cgk i{width:6px;align-self:stretch;border-radius:4px}.cgk b{display:inline-block;font-size:20px;line-height:1.1;margin-right:6px}.cgk span{font-size:12px;color:#6b7280}.cgk em{display:block;font-style:normal;font-size:11px;color:#b42318}.cgg{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.cgh{font-weight:700;color:#6b7280;text-align:center;font-size:13px}.cgc{min-width:0;min-height:96px;background:#fff;border:1px solid #e6e9f2;border-radius:10px;padding:6px;font-size:12px}.cgc.off{background:transparent;border:none}.cgc.td{border:2px solid #4f46e5}.cgc.past{background:#f8fafc}.cgd{display:flex;justify-content:space-between;color:#6b7280;margin-bottom:3px}.cgd b{color:#111827}.cgd i{font-style:normal;font-size:11px}.cgd i.lack{color:#b42318;font-weight:700}.cgp{display:block;border-radius:6px;padding:2px 6px;margin-top:3px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}.cgm{color:#4f46e5;cursor:pointer;font-size:11px;margin-top:2px;display:block}.cgf{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}.cgf button{border:1px solid #e6e9f2;background:#fff;border-radius:99px;padding:4px 12px;cursor:pointer;font-size:13px}.cgf button.on{background:#4f46e5;color:#fff;border-color:#4f46e5}.cgf i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px}.cgf select{width:auto;min-width:150px;max-width:220px;border:1px solid #e6e9f2;border-radius:8px;padding:4px 8px;font-size:13px;background:#fff}.cgs section{margin-bottom:12px}.cgs h3{margin:0 0 8px;font-size:14px}.cgb{display:flex;align-items:center;gap:6px;font-size:12px;margin:4px 0}.cgb span{flex:0 0 40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cgb u{flex:1;height:8px;background:#eef1f7;border-radius:4px;overflow:hidden;text-decoration:none}.cgb u s{display:block;height:100%;background:#4f46e5}.cgb em{font-style:normal;color:#6b7280;width:22px;text-align:right}.cgu{display:flex;gap:8px;align-items:center;padding:6px 0;border-top:1px solid #eef1f7;font-size:12px;cursor:pointer}.cgu b{flex:0 0 38px;color:#4f46e5}.cgu span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`;
  const cell=dy=>{
    if(!dy)return `<div class="cgc off"></div>`;
    const L=(P[dy]||[]).slice().sort((a,b)=>CG_ORD.indexOf(a.st)-CG_ORD.indexOf(b.st)),dn=L.filter(x=>x.st==="xong").length,cp=cap(dy),lack=dy>=td&&cp>0&&L.length<cp;
    return `<div class="cgc${dy===td?" td":dy<td?" past":""}"><div class="cgd"><b>${dy}</b><i class="${lack?"lack":""}" title="Đã đăng / số ô theo mục tiêu${lack?" · còn thiếu "+(cp-L.length)+" bài chưa lên lịch":""}">${dn}${cp?"/"+cp:""}${lack?" ⚠":""}</i></div>${L.slice(0,4).map(chip).join("")}${L.length>4?`<span class="cgm" data-cgmore="${dy}">+${L.length-4} bài nữa</span>`:""}</div>`
  };
  const byTuyen={};flat.forEach(x=>{const t=x.c.tuyen||x.c.mucTieu||x.c.nguon||"Chưa gắn tuyến";byTuyen[t]=(byTuyen[t]||0)+1});
  const tl=Object.entries(byTuyen).sort((a,b)=>b[1]-a[1]).slice(0,6),tmax=tl.length?tl[0][1]:1;
  const up=flat.filter(x=>x.st!=="xong").sort((a,b)=>a.day-b.day).slice(0,8);
  const skus=[...new Set(all.map(x=>x.c.sku))];
  el.innerHTML=`<style>${css}</style><section class="card pad"><div class="card-h"><h2>${R.tu===1&&R.den===MONTH.ndays?`Lịch đăng tháng ${MONTH.mon}/${MONTH.year}`:`Lịch đăng ${dd(R.tu)} – ${dd(R.den)}`}</h2><span class="hint">Số cạnh ngày = đã đăng / số ô theo mục tiêu · bấm bài để mở thẻ</span></div>
   <div class="cgks">${tile(cnt("xong"),"Đã đăng","#12b76a")}${tile(cnt("dang"),"Chờ đăng","#2563eb")}${tile(cnt("duyet"),"Chờ duyệt","#f79009")}${tile(thieu,"Ô còn thiếu (từ hôm nay)","#ef4444",thieu?"chưa có bài lên lịch":"")}</div>
   <div class="cgf"><button data-cgk="" class="${CG.k?"":"on"}">Tất cả kênh</button>${CHANNELS.map(ch=>`<button data-cgk="${esc(ch.k)}" class="${CG.k===ch.k?"on":""}"><i style="background:${CG_COL[ch.k]||"#64748b"}"></i>${esc(ch.short)}</button>`).join("")}
    <select data-cgst><option value="">Mọi trạng thái</option>${CG_ORD.map(k=>`<option value="${k}"${CG.st===k?" selected":""}>${CG_ST[k].t}</option>`).join("")}</select>
    <select data-cgsku><option value="">Mọi sản phẩm</option>${skus.map(k=>`<option value="${esc(k)}"${CG.sku===k?" selected":""}>${esc(sk(k).n)}</option>`).join("")}</select></div>
   <div class="cgw"><div class="cgg">${["T2","T3","T4","T5","T6","T7","CN"].map(t=>`<div class="cgh">${t}</div>`).join("")}${cells.map(cell).join("")}</div>
    <aside class="cgs"><section><h3>Theo tuyến / nguồn video</h3>${tl.length?tl.map(([t,n])=>`<div class="cgb"><span title="${esc(t)}">${esc(t)}</span><u><s style="width:${Math.round(n/tmax*100)}%"></s></u><em>${n}</em></div>`).join(""):`<p class="hint">Chưa có bài trong kỳ này.</p>`}</section>
    <section><h3>Chờ đăng / chờ duyệt</h3>${up.length?up.map(x=>`<div class="cgu" data-cgc="${esc(x.c.id)}"><b${x.day<td?` style="color:#b42318" title="Quá hạn, chưa đăng"`:""}>${dd(x.day)}</b><span>${esc(chOf(x.c.kenh).short)} · ${esc(sk(x.c.sku).n)}</span><em style="font-style:normal;color:${CG_ST[x.st].fg}">${CG_ST[x.st].t}</em></div>`).join(""):`<p class="hint">Không có bài nào đang chờ.</p>`}</section></aside></div></section>`;
  el.querySelectorAll("[data-cgk]").forEach(b=>b.onclick=()=>{CG.k=b.dataset.cgk;renderMain()});
  const fs=el.querySelector("[data-cgst]");if(fs)fs.onchange=()=>{CG.st=fs.value;renderMain()};
  const fk=el.querySelector("[data-cgsku]");if(fk)fk.onchange=()=>{CG.sku=fk.value;renderMain()};
  el.querySelectorAll("[data-cgc]").forEach(x=>x.onclick=()=>openCard(x.dataset.cgc));
  el.querySelectorAll("[data-cgmore]").forEach(x=>x.onclick=()=>{
    const dy=+x.dataset.cgmore,L=(P[dy]||[]);
    openDrawerHTML(`<h2>Bài đăng ngày ${dd(dy)}</h2><div class="xlist">${L.map(({c,st})=>`<div class="xmini"><span class="xmt"><b class="mono">${esc(c.id)}</b> ${esc(chOf(c.kenh).short)} · ${esc(sk(c.sku).n)}</span>${pill(CG_ST[st].t,st==="xong"?"grn":"gry")}<button type="button" class="btn sm" data-opc="${esc(c.id)}">Mở</button></div>`).join("")}</div>`);
    document.querySelectorAll("[data-opc]").forEach(b=>b.onclick=()=>{closeDrawer();openCard(b.dataset.opc)})
  })
}
{
  const _cal0=xvCalendar;
  xvCalendar=function(b,o){
    _cal0(b,o);
    const g=document.createElement("div");g.id="cl-g";
    const lst=b.querySelector("#cl-d");if(lst)lst.insertAdjacentElement("beforebegin",g);else b.appendChild(g);
    try{cgGrid(g,o)}catch(e){console.warn("calendar ô vuông lỗi",e)}
  }
}
/* Trang Calendar ở menu: tab Tháng dùng đúng lịch ô vuông ở trên (mặc định mở tab Tháng). */
{
  const _pLich1=pLich;
  pLich=function(m){
    _pLich1(m);
    {
      const lb=m.querySelector("#lb"),ks=m.querySelector(".lwks");
      if(ks)ks.remove();
      if(lb){lb.innerHTML="";try{cgGrid(lb,{d:D()})}catch(e){console.warn("calendar ô vuông lỗi",e)}}
    }
  };
  PAGES.lich=pLich;
}
