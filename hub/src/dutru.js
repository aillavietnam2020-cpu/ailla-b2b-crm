/* =====================================================================
   DỰ TRÙ GIÁ BÁN (Quản trị › Lãi lỗ › Dự trù giá bán): tính giá bán, lãi và ngưỡng quảng cáo cho combo trên TikTok / Facebook,
   so chương trình khuyến mại bằng cách nhân đôi dòng. Theo Google Sheet mẫu chị Hoa ("AILLA - Dự trù giá bán TikTok & Facebook").
   Hàm tính: dutrucalc.js (test: tests/unit/dutrucalc.test.ts). Giá vốn lấy từ Sản phẩm & combo + Giá vốn SKU + giá nhập kho (spcombo.js),
   mã nào chưa có giá vốn thì ghi rõ "chưa có giá vốn", không ước số. Giả định chi phí và các dòng phương án lưu ở D().dutru (hub_state), không cần bảng mới.
   Chỉ CEO / kế toán xem (cùng quyền xem giá vốn): tài khoản vận hành không thấy lãi.
   ===================================================================== */
const DZB={kenh:"tiktok",file:()=>{const d=typeof D==="function"?D():null;return d&&d.dutru&&d.dutru.gvFile||null},rows:null,A:null,pr:null,pp:{},showA:false,pk:null,ptab:"combo",pq:""};
const dzSee=()=>typeof spcSeeCost==="function"&&spcSeeCost();
const dzId=()=>"dz"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
/* Nhập số kiểu Việt: "55.000" = 55000; "5,5" = 5,5. Phần trăm cho phép "5.5". */
function dzParse(s,money){
  let t=String(s==null?"":s).replace(/\s|đ|%/g,"");if(t==="")return null;
  if(money)t=t.replace(/[.,]/g,"");else if(t.includes(","))t=t.replace(/\./g,"").replace(",",".");
  const v=parseFloat(t);return isFinite(v)?v:null;
}
const dzIn=v=>v==null?"":String(v).replace(".",",");
const dzMoney=v=>v==null||v===""?"":nf(v);
function dzInit(){
  if(DZB.rows)return;
  const d=typeof D==="function"?D():null,s=d&&d.dutru;
  DZB.rows=s&&Array.isArray(s.rows)?JSON.parse(JSON.stringify(s.rows)):[];
  DZB.A=dzAssume(s&&s.A);
  /* Dòng cũ chưa điền gì ở 3 ô Affiliate / Booking / CPQC thì điền sẵn số mặc định của kênh. */
  DZB.rows.forEach(r=>(r.parts||[]).forEach(p=>{if(p.kind==="gift"&&p.gia==null)p.gia=0}));
  DZB.rows.forEach(r=>{if(!r.aff&&!r.booking&&!r.cpqc){r.aff=dzDef(r.kenh,"aff");r.booking=dzDef(r.kenh,"booking");r.cpqc=dzDef(r.kenh,"cpqc")}});
  if(!DZB.rows.length)DZB.rows.push(dzBlank());
}
const dzRowsK=()=>DZB.rows.filter(r=>r.kenh===DZB.kenh);
const dzDef=(k,f)=>DZB.A&&DZB.A[k]&&+DZB.A[k][f]||0;
const dzBlank=(o)=>Object.assign({id:dzId(),ten:"",kenh:DZB.kenh,gia:null,giam:0,giamK:"%",gvSp:null,gvQua:null,aff:dzDef(DZB.kenh,"aff"),booking:dzDef(DZB.kenh,"booking"),cpqc:dzDef(DZB.kenh,"cpqc"),parts:null,mSp:false,mQua:false},o||{});
function dzSave(){
  const snap=JSON.parse(JSON.stringify({A:DZB.A,rows:DZB.rows,gvFile:DZB.file()}));
  try{DB.mutate(ME&&ME.name||"",  "dự trù giá bán",d=>{d.dutru=snap})}catch(e){}
}
/* Bảng giá vốn hiện hành (mã chữ thường → {u,src}). */
function dzCostMap(){
  if(typeof SPCB==="undefined"||!SPCB.rows)return null;
  const skus=(typeof D==="function"&&D()&&D().skus)||[],ky=spcKy(),file=DZB.file();
  const gSku=spcGvMap(skus,[],ky),gKho=spcGvMap([],SPCB.cost||[],ky);
  /* Thứ tự ưu tiên: Giá vốn SKU kế toán nhập > Giá thành MISA đã nạp > giá nhập kho bình quân. */
  return Object.assign({},gKho,file&&file.rows?dzMergeGiaThanh({},file,gSku):{},gSku);
}
/* Combo gồm nhiều món (r.parts): món có giá bán > 0 là món tính tiền, giá bán 0đ là quà tặng, "pack" là bao bì (chỉ tính vốn nếu có giá).
   Giá bán combo = tổng SL × giá bán từng món; giá vốn SP = vốn các món tính tiền; giá vốn quà = vốn các món 0đ. */
const dzHasItems=r=>!!(r.parts&&r.parts.length);
const dzItems=r=>(r.parts||[]).map(p=>p.kind==="pack"||p.kind==="skip"?p:Object.assign({},p,{kind:p.gia===0?"gift":"sp"}));
const dzNameOf=code=>{const p=typeof SPCB!=="undefined"&&(SPCB.prods||[]).find(x=>dzLow(x.code)===dzLow(code));return p&&p.name?p.name:code};
const dzItemName=p=>p.name||dzNameOf(p.code);
function dzAuto(r,g){
  if(!dzHasItems(r))return [];
  const pay=r.parts.filter(p=>p.kind!=="pack"&&p.kind!=="skip");
  if(pay.length)r.gia=pay.every(p=>p.gia!=null)?pay.reduce((s,p)=>s+(+p.qty||1)*p.gia,0):null;
  if(!g)return [];
  const c=dzCostParts(dzItems(r),g);
  r.gvSp=c.gvSp;r.gvQua=c.gvQua;return c.miss;
}
const dzGvTotal=r=>r.gvSp==null?null:r.gvSp+(r.gvQua==null?0:r.gvQua);
const dzGvCell=r=>{const t=dzGvTotal(r);return t==null?`<span class="dz-ms">chưa có giá vốn</span>`:nf(t)};
const dzGiaCell=r=>r.gia==null?`<span class="dz-ms">nhập giá từng món</span>`:nf(r.gia);
const dzItemTT=p=>p.kind==="pack"||p.kind==="skip"?"—":p.gia==null?"—":p.gia===0?dzTag("Tặng 0đ","vio"):nf((+p.qty||1)*p.gia);
const dzItemCost=(p,g)=>{const c=g&&g[dzLow(p.code)];return c?nf(c.u*(+p.qty||1)):(p.kind==="pack"||p.kind==="skip"?"—":dzTag("chưa có giá vốn","red"))};
const dzName=n=>n&&n.length>46?n.slice(0,45)+"…":n;
const dzTag=(t,c)=>`<span class="pill p-${c}">${t}</span>`;

/* Giá khách thực trả sau giảm (giảm nhập "10%" hoặc "5000"). Mọi kiểu khuyến mại quy về hai thứ: giá khách trả và quà tặng thêm. */
const dzEffGia=r=>{const g=dzN(r.gia),v=dzN(r.giam);return Math.max(0,r.giamK==="%"?g*(1-v/100):g-v)};
const dzEff=r=>Object.assign({},r,{gia:dzEffGia(r),aff:r.kenh==="facebook"?0:dzDef(r.kenh,"aff"),booking:dzDef(r.kenh,"booking"),cpqc:dzDef(r.kenh,"cpqc")});
const dzGiamTxt=r=>!dzN(r.giam)?"":r.giamK==="%"?dzIn(r.giam)+"%":nf(r.giam);
/* Các ô kết quả của một dòng (5 cột: khách trả, lãi, biên, CPQC trần, ROAS cần đạt). */
function dzOutCells(r,A){
  const e=dzEff(r),x=dzCalc(e,A),gk=dzN(r.giam)?`<b>${nf(e.gia)}</b>`:`<span style="color:var(--muted)">${nf(e.gia)}</span>`;
  if(!x.ok)return [r.gia==null?"—":gk,`<span class="dz-ms">${esc(x.why)}</span>`,"—","—","—"];
  const tone=dzTone(x),col=tone==="red"?"var(--red)":tone==="amb"?"var(--orange)":"var(--green)";
  return [gk,`<b style="color:${col}">${nf(x.ln)}</b>`,`<b style="color:${col}">${dzFmtPct(x.bien)}</b>`,
    x.tran>0?`<b>${dzFmtPct(x.tran)}</b>`:`<span style="color:var(--red)">${dzFmtPct(x.tran)}</span>`,x.roasTran==null?`<span style="color:var(--red)">không có</span>`:`<b>${dzFmtRoas(x.roasTran)}</b>`];
}
/* Dòng gợi ý dưới tên: giảm tối đa, quà tối đa, ngân sách marketing còn lại để giữ biên mục tiêu. */
function dzHint(r,A){
  const e=dzEff(r),x=dzCalc(e,A);if(!x.ok)return "";
  const m=dzMax(e,A);if(!m)return "";
  if(m.kho)return `<small class="dz-s dz-hl" style="color:var(--red)">Chi phí tỷ lệ quá cao, không giá nào đạt biên mục tiêu: giảm chi phí ở phần Chi phí phía trên.</small>`;
  const lab=r.kenh==="facebook"?"Booking + CPQC + CP khác":"Affiliate + Booking + CPQC + CP khác",mk=x.aff+x.bk+dzN(e.cpqc)+dzN(r.cpk),mkMax=Math.max(0,mk+x.bien-A.bienMT);
  const g=dzN(r.gia)?Math.max(0,(dzN(r.gia)-m.pmin)/dzN(r.gia)*100):0;
  if(x.bien<A.bienMT)return `<small class="dz-s dz-hl" style="color:var(--orange)">Chưa đạt biên ${dzFmtPct(A.bienMT)}: cần khách trả từ ${nf(m.pmin)}đ, hoặc cắt ${lab} từ ${dzFmtPct(mk)} xuống ${dzFmtPct(mkMax)}.</small>`;
  return `<small class="dz-s dz-hl" style="color:var(--green)">Còn đạt biên ${dzFmtPct(A.bienMT)} nếu: giảm tối đa ${dzFmtPct(g)} (khách trả ≥ ${nf(m.pmin)}đ) · tặng thêm quà ≤ ${nf(m.quaMax)}đ · ${lab} ≤ ${dzFmtPct(mkMax)}.</small>`;
}
function dzSubHTML(r,g,cols){
  const items=r.parts||[];
  const rows=items.map((p,k)=>{const pk=p.kind==="pack"||p.kind==="skip",id=r.id+"."+k;
    return `<tr><td>${esc(dzItemName(p))} <small class="hint">${esc(p.code)}</small>${pk?` <span class="pill p-gry">bao bì</span>`:""}</td>
     <td class="n"><input class="dz-in n s" data-it="${id}.q" value="${dzIn(p.qty)}" inputmode="decimal"></td>
     <td class="n">${pk?"—":`<input class="dz-in n" data-it="${id}.g" value="${p.gia==null?"":dzMoney(p.gia)}" placeholder="giá bán / món" inputmode="numeric">`}</td>
     <td class="n" data-itt="${id}">${dzItemTT(p)}</td><td class="n" data-itc="${id}">${dzItemCost(p,g)}</td>
     <td><a class="dz-x" data-itx="${id}" title="Bỏ món này">✕</a></td></tr>`}).join("");
  return `<tr class="dz-sub" data-sub="${r.id}"><td></td><td colspan="${cols-1}"><div class="dz-itw">
   ${items.length?`<table class="dz-itt"><thead><tr><th>Sản phẩm trong combo</th><th class="n">SL</th><th class="n">Giá bán / món (0đ = tặng)</th><th class="n">Thành tiền</th><th class="n">Giá vốn</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
   :`<small class="hint">Chưa có sản phẩm. Bấm “+ Thêm sản phẩm” để lập combo: món tính tiền ghi giá bán, món tặng ghi 0đ. Hoặc gõ thẳng giá bán và giá vốn ở dòng trên.</small>`}
   <div class="dz-ita"><button class="btn sm" data-additem="${r.id}">+ Thêm sản phẩm</button><button class="btn sm ghost" data-pick="${r.id}" title="Lấy sẵn các món của một combo đã có trong Sản phẩm & combo">Lấy combo có sẵn</button></div></div></td></tr>`;
}
function dzRowHTML(r,i,A,g){
  const miss=dzAuto(r,g),O=dzOutCells(r,A),x=dzCalc(dzEff(r),A),tone=dzTone(x),it=dzHasItems(r),cols=12;
  const tot=dzGvTotal(r);
  const gia=it?`<td class="n dz-ro" data-cell="gia">${dzGiaCell(r)}</td>`:`<td><input class="dz-in n" data-id="${r.id}" data-f="gia" data-m="1" value="${r.gia==null?"":dzMoney(r.gia)}" placeholder="0" inputmode="numeric"></td>`;
  const gv=it?`<td class="n dz-ro" data-cell="gv">${dzGvCell(r)}</td>`:`<td><input class="dz-in n" data-id="${r.id}" data-f="gv" data-m="1" value="${tot==null?"":dzMoney(tot)}" placeholder="0" inputmode="numeric"></td>`;
  return `<tr class="dz-r dz-${tone}" data-rid="${r.id}"><td class="dz-no">${i+1}</td>
   <td><input class="dz-in" data-id="${r.id}" data-f="ten" value="${esc(r.ten||"")}" placeholder="Tên combo / chương trình">
     <div class="dz-hn">${miss.length?`<small class="dz-s" style="color:var(--red)">Chưa có giá vốn: ${esc(miss.join(", "))}</small>`:dzHint(r,A)}</div></td>
   ${gia}
   <td><input class="dz-in n s" data-id="${r.id}" data-f="giam" value="${dzGiamTxt(r)}" placeholder="10% hay 5000" title="Giảm giá cho khách: gõ 10% hoặc số tiền 5000"></td>
   <td class="n dzo">${O[0]}</td>
   ${gv}
   <td><input class="dz-in n s" data-id="${r.id}" data-f="cpk" value="${dzIn(r.cpk||0)}" inputmode="decimal" title="Chi phí khác riêng của combo này (% giá bán), ví dụ hoa hồng thêm, voucher riêng"></td>
   ${O.slice(1).map(h=>`<td class="n dzo">${h}</td>`).join("")}
   <td class="dz-act"><button class="btn sm ghost" data-dup="${r.id}" title="Nhân đôi dòng để thử một chương trình khác">Nhân đôi</button><button class="btn sm ghost" data-del="${r.id}" title="Xóa dòng">✕</button></td></tr>${dzSubHTML(r,g,cols)}`;
}
/* Cập nhật tại chỗ ô kết quả của một dòng (không vẽ lại cả bảng để không mất con trỏ khi Tab). */
function dzRefreshRow(r){
  const tr=document.querySelector(`tr[data-rid="${r.id}"]`);if(!tr)return;
  const g=dzCostMap(),miss=dzAuto(r,g),x=dzCalc(dzEff(r),DZB.A);
  tr.className="dz-r dz-"+dzTone(x);
  const O=dzOutCells(r,DZB.A);tr.querySelectorAll(".dzo").forEach((td,i)=>td.innerHTML=O[i]);
  if(dzHasItems(r)){
    const set=(f,h)=>{const c=tr.querySelector(`[data-cell="${f}"]`);if(c)c.innerHTML=h};
    set("gia",dzGiaCell(r));set("gv",dzGvCell(r));
    r.parts.forEach((p,k)=>{const id=r.id+"."+k,a=document.querySelector(`[data-itt="${id}"]`),b=document.querySelector(`[data-itc="${id}"]`);if(a)a.innerHTML=dzItemTT(p);if(b)b.innerHTML=dzItemCost(p,g)});
  }else{const el=tr.querySelector('[data-f="gv"]'),t=dzGvTotal(r);if(el&&document.activeElement!==el)el.value=t==null?"":dzMoney(t)}
  const hn=tr.querySelector(".dz-hn");if(hn)hn.innerHTML=miss.length?`<small class="dz-s" style="color:var(--red)">Chưa có giá vốn: ${esc(miss.join(", "))}</small>`:dzHint(r,DZB.A);
  dzRefreshKpi();
}
function dzRefreshKpi(){const k=document.getElementById("dz-kpi");if(k)k.innerHTML=dzKpiHTML()}
function dzKpiHTML(){
  const R=dzRowsK().map(r=>({r,x:dzCalc(dzEff(r),DZB.A)})),ok=R.filter(o=>o.x.ok),lo=ok.filter(o=>o.x.tt==="lo").length,th=ok.filter(o=>o.x.tt==="thap").length;
  const best=ok.slice().sort((a,b)=>b.x.bien-a.x.bien)[0],nm=R.filter(o=>!o.x.ok&&o.x.why==="Chưa có giá vốn").length;
  return kpi("Phương án "+(DZB.kenh==="facebook"?"Facebook":"TikTok"),nf(dzRowsK().length),`tối đa ${DZ_MAX_ROWS} dòng · biên mục tiêu ${dzFmtPct(DZB.A.bienMT)}`)
   +kpi("Đạt biên mục tiêu",nf(ok.length-lo-th),`${nf(th)} dưới mục tiêu`,th?"#b54708":"")
   +kpi("Đang lỗ",nf(lo),"phương án bán mỗi đơn là lỗ",lo?"#b42318":"")
   +kpi("Biên cao nhất",best?dzFmtPct(best.x.bien):"—",best?esc(dzName(best.r.ten||"(chưa đặt tên)")):nm?nf(nm)+" dòng chưa có giá vốn":"nhập giá bán và giá vốn");
}
/* Khối "Chi phí của kênh" đặt trên cùng: mọi khoản chi phí và lợi nhuận mong muốn điền một lần ở đây, các combo bên dưới dùng chung. */
function dzCostHTML(){
  const k=DZB.kenh,fb=k==="facebook",A=DZB.A,c=A[k];
  const fld=(f,label,unit,tip)=>`<label class="dz-cf" title="${esc(tip||"")}"><span>${label}</span><span class="dz-cfi"><input class="dz-in n" data-a="${k}.${f}" value="${f==="xuLy"?dzMoney(c[f]):dzIn(c[f])}" inputmode="decimal"><em>${unit}</em></span></label>`;
  const tipPS=fb?"CPVC 9,2%":"Phí sàn 17 + voucher/Xtra 4,7 + CPVC 1,1",tipNS=fb?"Lương 8,1 + quản lý 1,3":"Lương 2,5 (20tr÷800tr) + agency cố định 1,5 (12tr÷800tr) + hoa hồng agency 2";
  const tot=dzFixedPct(c)+dzN(c.aff)+dzN(c.booking)+dzN(c.cpqc);
  return `<div class="card dz-cost"><div class="card-h"><b>Chi phí của ${fb?"Facebook":"TikTok Shop"}</b><span class="hint">Điền một lần ở đây, mọi combo bên dưới dùng chung. Tự lưu.</span>
    <button class="btn sm ghost" id="dz-areset" style="margin-left:auto" title="Đặt lại chi phí về số bảng kế toán T7/2026">Khôi phục số kế toán</button></div>
   <div class="dz-cg">
    ${fld("phiSan",fb?"Phí nền tảng":"Phí sàn (gộp)","% giá bán",tipPS)}${fld("thue","Thuế","% giá bán","Thuế 1,5%")}${fld("nhanSu","Nhân sự & quản lý","% giá bán",tipNS)}
    ${fb?"":fld("aff","Affiliate / KOC","% giá bán","TikTok thực tế 3,4% doanh thu")}${fld("booking","Booking KOC / KOL","% giá bán","Chi phí booking")}${fld("cpqc","Chạy quảng cáo (CPQC)",fb?"% giá bán":"% giá bán","TikTok thực tế: GMV Max 27,2% doanh thu, đã VAT")}
    ${fb?"":fld("xuLy","Phí xử lý đơn","đ / đơn","Cố định đồng mỗi đơn")}
    <label class="dz-cf dz-cfm" title="Dưới mức này thì tô cảnh báo; dùng để tính CPQC trần, ROAS cần đạt và mức giảm giá tối đa"><span><b>Lợi nhuận mong muốn</b></span><span class="dz-cfi"><input class="dz-in n" data-a="bienMT" value="${dzIn(A.bienMT)}" inputmode="decimal"><em>% giá bán</em></span></label>
   </div>
   <p class="hint" style="margin:8px 0 0">Tổng chi phí tỷ lệ <b>${dzFmtPct(tot)}</b> giá bán${fb?"":` (cộng thêm ${nf(c.xuLy)}đ phí xử lý mỗi đơn)`}. Phần còn lại ${dzFmtPct(100-tot)} dùng để trả giá vốn và để lại lợi nhuận. CP khác riêng của từng combo ghi ở bảng bên dưới.</p></div>`;
}
/* ---------- Chọn từ danh mục ---------- */
function dzPickItems(g){
  const C=typeof spcCtx==="function"?spcCtx():null;if(!C)return {combos:[],prods:[]};
  const chK=DZB.kenh==="facebook"?"FACEBOOK":"TIKTOK",combos=C.combos.filter(c=>c.ch===chK&&c.active&&c.parts.some(p=>p.kind!=="skip")).map(c=>{
    const parts=c.parts.filter(p=>p.kind!=="skip").map(p=>({code:p.code,qty:p.qty,kind:p.kind})),cs=dzCostParts(parts,g);
    return {key:c.key,ch:c.ch,name:c.sku+(c.variant?" · "+c.variant:""),parts,cs,desc:parts.map(p=>(p.qty!=1?p.qty+"× ":"")+p.code+(p.kind==="gift"?" (quà)":"")).join(", "),orders:c.orders}});
  const prods=(SPCB.prods||[]).filter(p=>p.active).map(p=>{const parts=[{code:p.code,qty:1,kind:"sp"}];return {key:"p:"+p.code,name:p.name||p.code,code:p.code,parts,cs:dzCostParts(parts,g)}});
  return {combos,prods};
}
function dzPicker(id,mode){
  if(typeof spcLoad==="function"&&(typeof SPCB==="undefined"||!SPCB.rows)){try{spcLoad(true)}catch(e){}let n=0;const w=setInterval(()=>{n++;if(!document.getElementById("dz-plist")||n>40){clearInterval(w);return}if(SPCB.rows){clearInterval(w);dzPickDraw()}},500)}
  DZB.pk=id;DZB.pm=mode||"";DZB.ptab=mode==="item"?"sp":(DZB.ptab||"combo");DZB.pq="";
  openDrawerHTML(`<h2 class="dtitle">${mode==="item"?"Thêm sản phẩm vào combo":"Chọn từ danh mục"}</h2>${mode==="item"?`<p class="hint">Chọn sản phẩm để thêm vào combo. Sau đó ghi giá bán của món đó: món tính tiền ghi giá, món tặng ghi 0đ (giá vốn tự điền).</p>`:""}<p class="hint">Chọn combo hoặc sản phẩm để tự điền giá vốn sản phẩm chính và giá vốn quà. Mã chưa có giá vốn sẽ báo rõ, không tự ước.</p>
   <nav class="settabs" id="dz-ptabs"></nav><input id="dz-pq" class="dz-in" placeholder="Gõ tên hoặc mã để tìm…" style="width:100%;margin:8px 0"><div id="dz-plist"></div>`);
  const q=document.getElementById("dz-pq");q.oninput=()=>{DZB.pq=q.value;dzPickDraw()};dzPickDraw();setTimeout(()=>q.focus(),50);
}
function dzPickDraw(){
  if(typeof SPCB==="undefined"||!SPCB.rows){const pl=document.getElementById("dz-plist");if(pl)pl.innerHTML=`<p class="hint pad">${typeof SPCB!=="undefined"&&SPCB.err?esc(SPCB.err):"Đang tải danh mục sản phẩm…"}</p>`;return}
  const g=dzCostMap(),P=dzPickItems(g),fold=typeof kfold==="function"?kfold:dzLow,w=fold(DZB.pq||"").trim().split(/\s+/).filter(Boolean);
  if(DZB.pm==="item")DZB.ptab="sp";
  document.getElementById("dz-ptabs").innerHTML=DZB.pm==="item"?"":[["combo","Combo ("+P.combos.length+")"],["sp","Sản phẩm ("+P.prods.length+")"]].map(([k,t])=>`<button class="${DZB.ptab===k?"on":""}" data-pt="${k}">${t}</button>`).join("");
  document.querySelectorAll("[data-pt]").forEach(b=>b.onclick=()=>{DZB.ptab=b.dataset.pt;dzPickDraw()});
  let L=DZB.ptab==="sp"?P.prods:P.combos;
  if(w.length)L=L.filter(x=>w.every(t=>fold(x.name+" "+(x.desc||"")+" "+(x.code||"")).includes(t)));
  L=L.slice(0,80);
  document.getElementById("dz-plist").innerHTML=L.length?L.map((x,i)=>{
    const gv=x.cs.gvSp==null?dzTag("chưa có giá vốn","red"):`<b>${nf(x.cs.gvSp)}đ</b>`+(x.cs.gvQua?` + quà ${nf(x.cs.gvQua)}đ`:x.cs.gvQua==null?" "+dzTag("quà chưa có giá vốn","amb"):"");
    return `<div class="dz-pi" data-pi="${i}"><div><b>${esc(x.name)}</b> ${x.ch?`<small class="pill p-gry">${esc(SPC_CHN(x.ch))}</small>`:""}<br><small class="hint">${esc(x.desc||x.code||"")}</small></div><div class="n">${gv}</div></div>`}).join("")
   :`<p class="hint pad">Không có mục nào khớp.</p>`;
  document.querySelectorAll("[data-pi]").forEach(el=>el.onclick=()=>{
    const x=L[+el.dataset.pi],r=DZB.rows.find(y=>y.id===DZB.pk);if(!r)return;
    if(DZB.pm==="item"){
      if(!r.parts)r.parts=[];
      const o=r.parts.find(p=>p.kind!=="pack"&&dzLow(p.code)===dzLow(x.code));if(o)o.qty=(+o.qty||1)+1;else r.parts.push({code:x.code,name:x.name,qty:1,gia:null,kind:"sp"});
      dzSave();closeDrawer();renderMain();
      if(x.cs.gvSp==null)toast("Sản phẩm này chưa có giá vốn: nhập ở Sản phẩm & combo hoặc Giá vốn SKU");return}
    r.parts=x.parts.map(p=>p.kind==="pack"||p.kind==="skip"?Object.assign({},p):{code:p.code,name:dzNameOf(p.code),qty:p.qty,gia:p.kind==="gift"?0:null,kind:p.kind});r.mSp=false;r.mQua=false;if(!r.ten)r.ten=x.name;
    dzSave();closeDrawer();renderMain();
    if(x.cs.gvSp==null)toast("Mã này chưa có giá vốn: nhập ở Sản phẩm & combo hoặc Giá vốn SKU")});
}
/* ---------- Trang ---------- */
function pDutru(m){
  const T="Dự trù giá bán",S="Chọn kênh trước, rồi tính giá bán, lãi mỗi đơn và mức chi phí chịu được cho combo / chương trình của kênh đó";
  if(!dzSee()){m.innerHTML=H(T,S)+`<div class="note amb">Trang này có số lãi nên chỉ CEO và kế toán xem.</div>`;return}
  dzInit();
  if(typeof spcLoad==="function")spcLoad();
  const g=dzCostMap(),A=DZB.A,loading=!g;
  if(!dzRowsK().length)DZB.rows.push(dzBlank());
  const fb=DZB.kenh==="facebook",nK=k=>DZB.rows.filter(r=>r.kenh===k).length;
  const tabs=`<nav class="settabs">${DZ_KENH.map(([k,n])=>`<button class="${DZB.kenh===k?"on":""}" data-dzk="${k}">${n} (${nK(k)})</button>`).join("")}</nav>`;
  const body=dzRowsK().map((r,i)=>dzRowHTML(r,i,A,g)).join("");
  m.innerHTML=H(T,S)+(typeof SPCB!=="undefined"&&SPCB.err?`<div class="note red">${esc(SPCB.err)}</div>`:"")+(loading?`<p class="hint">Đang tải giá vốn…</p>`:"")
   +tabs+dzCostHTML()+`<div class="grid kpis" id="dz-kpi">${dzKpiHTML()}</div>
   <div class="card flush"><div class="card-h" style="padding:14px 16px 0"><b>So sánh phương án</b><span class="hint">Mỗi dòng là một combo / chương trình: thêm sản phẩm (món tặng ghi 0đ), giảm giá, CP khác. Chi phí kênh đã điền ở trên. Muốn thử chương trình khác thì bấm “Nhân đôi” rồi sửa.</span>
    <span style="margin-left:auto;display:flex;gap:8px"><button class="btn sm pri" id="dz-add">+ Thêm dòng</button></span></div>
    <div class="tbl dz-wrap"><table class="dz-t"><thead><tr><th>#</th><th>Combo / chương trình</th><th class="n">Giá lẻ (giá bán gốc)</th><th class="n" title="Giảm cho khách: gõ 10% hoặc 5000">Giảm giá</th><th class="n">Khách trả</th><th class="n" title="Giá vốn các món trong combo (gồm cả quà tặng)">Giá vốn</th><th class="n" title="Chi phí khác riêng của combo này, % giá bán">CP khác %</th>
    <th class="n">Lãi / đơn</th><th class="n">Biên lãi</th><th class="n" title="CPQC tối đa mà biên vẫn đạt mục tiêu">CPQC trần %</th><th class="n" title="ROAS tối thiểu cần đạt = 1 ÷ CPQC trần">ROAS cần đạt</th><th></th></tr></thead><tbody>${body}</tbody></table></div></div>
   ${dzFileHTML()}
   <p class="hint pad">CPQC trần = mức quảng cáo tối đa trên doanh thu mà biên vẫn đạt mục tiêu; ROAS cần đạt = 1 ÷ CPQC trần. Màu đỏ: đang lỗ; màu cam: biên dưới mục tiêu. ${fb?"Facebook không có phí sàn, voucher, phí xử lý đơn.":"Phí sàn gộp một số, chỉ tách riêng Affiliate và Booking."}</p>`;
  m.querySelectorAll("[data-dzk]").forEach(b=>b.onclick=()=>{DZB.kenh=b.dataset.dzk;renderMain()});
  dzBind(m);
}
function dzBind(m){
  m.querySelectorAll("input.dz-in[data-f],select.dz-in[data-f]").forEach(el=>el.onchange=()=>{
    const r=DZB.rows.find(x=>x.id===el.dataset.id);if(!r)return;const f=el.dataset.f;
    if(f==="ten")r.ten=el.value.trim();
    else if(f==="giam"){const t=el.value,v=dzParse(t,!/%/.test(t));r.giamK=/%/.test(t)?"%":"d";r.giam=v==null?0:v;el.value=dzGiamTxt(r)}
    else if(f==="kenh")r.kenh=el.value;
    else{const v=dzParse(el.value,!!el.dataset.m);
      if(f==="gv"){r.gvSp=v;r.gvQua=0;r.mSp=true;r.mQua=true}
      else r[f]=v==null?(f==="gia"?null:0):v;
      if(f==="cpk")el.value=dzIn(r[f]);else if(f==="aff"||f==="cpqc"||f==="booking")el.value=dzIn(r[f]);else if(el.dataset.m)el.value=r[f]==null?"":dzMoney(r[f])}
    dzSave();dzRefreshRow(r)});
  m.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>dzPicker(b.dataset.pick));
  m.querySelectorAll("[data-additem]").forEach(b=>b.onclick=()=>dzPicker(b.dataset.additem,"item"));
  m.querySelectorAll("[data-itx]").forEach(a=>a.onclick=()=>{const [id,k]=a.dataset.itx.split("."),r=DZB.rows.find(x=>x.id===id);if(!r)return;r.parts.splice(+k,1);dzSave();renderMain()});
  m.querySelectorAll("input[data-it]").forEach(el=>el.onchange=()=>{const [id,k,f]=el.dataset.it.split("."),r=DZB.rows.find(x=>x.id===id),p=r&&r.parts[+k];if(!p)return;
    if(f==="q"){const v=dzParse(el.value,false);p.qty=v>0?v:1;el.value=dzIn(p.qty)}else{const v=dzParse(el.value,true);p.gia=v;el.value=v==null?"":dzMoney(v)}
    dzSave();dzRefreshRow(r)});
  m.querySelectorAll("[data-dup]").forEach(b=>b.onclick=()=>{
    if(dzRowsK().length>=DZ_MAX_ROWS){toast("Tối đa "+DZ_MAX_ROWS+" dòng mỗi kênh");return}
    const i=DZB.rows.findIndex(x=>x.id===b.dataset.dup),r=DZB.rows[i];DZB.rows.splice(i+1,0,Object.assign({},r,{id:dzId(),ten:(r.ten||"")+" (bản sao)",parts:r.parts?r.parts.map(p=>Object.assign({},p)):null}));dzSave();renderMain()});
  m.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{
    if(DZB.rows.length>1&&!confirm("Xóa dòng này?"))return;
    DZB.rows=DZB.rows.filter(x=>x.id!==b.dataset.del);if(!dzRowsK().length)DZB.rows.push(dzBlank());if(DZB.pr&&!DZB.rows.some(x=>x.id===DZB.pr))DZB.pr=null;dzSave();renderMain()});
  const add=m.querySelector("#dz-add");if(add)add.onclick=()=>{if(dzRowsK().length>=DZ_MAX_ROWS){toast("Tối đa "+DZ_MAX_ROWS+" dòng mỗi kênh");return}DZB.rows.push(dzBlank());dzSave();renderMain()};
  m.querySelectorAll("[data-a]").forEach(el=>el.onchange=()=>{
    const [k,f]=el.dataset.a.split("."),v=dzParse(el.value,false);
    if(f===undefined)DZB.A.bienMT=v==null?DZ_DEF.bienMT:v;else DZB.A[k][f]=v==null?0:v;
    dzSave();renderMain()});
  const fb=m.querySelector("#dz-fbtn"),fi=m.querySelector("#dz-file");if(fb&&fi){fb.onclick=()=>fi.click();fi.onchange=()=>{if(fi.files[0])dzImport(fi.files[0])}}
  const rs=m.querySelector("#dz-areset");if(rs)rs.onclick=()=>{if(!confirm("Đặt lại các giả định về số kế toán T7/2026?"))return;DZB.A=dzAssume(null);dzSave();renderMain()};
}
/* Đối chiếu bảng giá thành MISA với mã trên web: mã nào không khớp thì liệt kê cho chị, không tự gán. */
function dzMatch(){
  const f=DZB.file();if(!f||!f.rows||typeof SPCB==="undefined"||!SPCB.rows)return null;
  const web=new Set((SPCB.prods||[]).map(p=>dzLow(p.code)));
  const used=new Set();spcGroup(SPCB.rows,SPCB.sales,spcToday()).filter(c=>c.active).forEach(c=>c.parts.forEach(p=>{if(p.kind!=="skip")used.add(dzLow(p.code))}));
  const packOnly=new Set();spcGroup(SPCB.rows,SPCB.sales,spcToday()).forEach(c=>c.parts.forEach(p=>{if(p.kind==="pack")packOnly.add(dzLow(p.code))}));
  spcGroup(SPCB.rows,SPCB.sales,spcToday()).forEach(c=>c.parts.forEach(p=>{if(p.kind!=="pack"&&p.kind!=="skip")packOnly.delete(dzLow(p.code))}));
  packOnly.forEach(k=>used.delete(k));
  const inFile=new Set(f.rows.map(x=>dzLow(x.code)));
  const g=dzCostMap()||{};
  return {khongKhop:f.rows.filter(x=>!web.has(dzLow(x.code))&&!used.has(dzLow(x.code))),
    thieu:[...used].filter(k=>!g[k]).map(k=>{const p=(SPCB.prods||[]).find(x=>dzLow(x.code)===k);return {code:p?p.code:k,name:p?p.name:""}}),
    khop:f.rows.length-f.rows.filter(x=>!web.has(dzLow(x.code))&&!used.has(dzLow(x.code))).length,total:f.rows.length};
}
function dzFileHTML(){
  const f=DZB.file(),M=dzMatch();
  const head=f?`<b>Giá vốn thành phẩm: bảng giá thành MISA tháng ${esc((f.ky||"").slice(5)+"/"+(f.ky||"").slice(0,4))}</b> <span class="hint">${nf(f.rows.length)} mã${M?` · ${nf(M.khop)} khớp mã trên web, ${nf(M.khongKhop.length)} không khớp`:""}</span>`
   :`<b>Chưa nạp bảng giá thành thành phẩm</b> <span class="hint">Giá vốn đang lấy từ Giá vốn SKU và giá nhập kho bình quân.</span>`;
  const list=(t,L,c)=>L.length?`<details style="margin-top:8px"${DZB.showM?" open":""}><summary>${t} (${nf(L.length)})</summary>${tbl(["Mã","Tên"].concat(c?["Giá thành đơn vị"]:[]),L.map(x=>`<tr><td class="mono">${esc(x.code)}</td><td>${esc(x.name||"")}</td>${c?`<td class="n">${nf(x.dv)}đ</td>`:""}</tr>`))}</details>`:"";
  return `<div class="card"><div class="card-h">${head}<span style="margin-left:auto;display:flex;gap:8px"><input type="file" id="dz-file" accept=".xlsx,.xls" hidden><button class="btn sm" id="dz-fbtn">${f?"Nạp lại bảng giá thành (Excel)":"Nạp bảng giá thành (Excel)"}</button></span></div>
   <p class="hint" style="margin:0">Ghép theo mã thành phẩm (không phân biệt hoa thường) với mã kho trên web. Giá vốn SKU kế toán nhập tay vẫn được ưu tiên hơn bảng này.</p>
   ${M?list("Mã trong bảng giá thành KHÔNG khớp mã nào trên web (cần chị Huệ xem)",M.khongKhop,1)+list("Mã trong combo đang dùng nhưng CHƯA CÓ giá vốn",M.thieu,0):""}</div>`;
}
function dzImport(file){
  if(typeof XLSX==="undefined"){toast("Chưa tải được bộ đọc Excel, thử lại sau");return}
  const rd=new FileReader();rd.onload=()=>{try{
    const wb=XLSX.read(rd.result,{type:"array"}),aoa=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:""}),r=dzParseGiaThanh(aoa);
    if(r.err||!r.rows.length){toast(r.err||"Không đọc được dòng giá thành nào");return}
    const d=D();d.dutru=d.dutru||{};d.dutru.gvFile={ky:r.ky,rows:r.rows,by:ME&&ME.name||"",at:new Date().toLocaleString("vi-VN")};
    dzSave();toast("Đã nạp "+r.rows.length+" mã giá thành");renderMain()}catch(e){toast("Không đọc được file: "+e.message)}};
  rd.readAsArrayBuffer(file);
}
PAGES.dutru=pDutru;
MODULES.push({k:"q_dutru",adm:true,zone:"Quản trị",ic:"spark",n:"Dự trù giá bán",sub:"",groups:()=>[["",[MI("dutru","Dự trù giá bán",()=>dzSee())]]]});

/* Kiểu hiển thị riêng của trang (tiền tố dz-). */
(function(){if(typeof document==="undefined"||document.getElementById("dz-css"))return;const s=document.createElement("style");s.id="dz-css";s.textContent=`
.dz-wrap{overflow-x:auto}.dz-t{min-width:1050px}.dz-cg{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px 14px}.dz-cf{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--muted)}.dz-cfi{display:flex;align-items:center;gap:6px}.dz-cfi .dz-in{width:100px}.dz-cfi em{font-style:normal;font-size:12px}.dz-cfm{background:var(--green-soft);border-radius:10px;padding:8px 10px;color:inherit}.dz-hn{max-width:340px}.dz-ro{background:#f8fafc;font-weight:600}.dz-sub>td{background:#f8fafc;border-bottom:2px solid var(--line)}.dz-itw{padding:2px 0 6px}.dz-itt{border-collapse:collapse;min-width:640px}.dz-itt th{font-size:12px;color:var(--muted);font-weight:600;padding:4px 8px;text-align:left}.dz-itt th.n{text-align:right}.dz-itt td{padding:4px 8px;border-top:1px solid var(--line)}.dz-itt td.n{text-align:right;white-space:nowrap}.dz-ita{margin-top:6px;display:flex;gap:8px}.dz-x{cursor:pointer;opacity:.7}.dz-fx{color:var(--muted);background:#f8fafc}.dz-gf{margin-top:4px;display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end}.dz-gq{width:26px;border:0;background:transparent;font:inherit;font-weight:600;color:inherit;text-align:center;padding:0}.dz-gf a{cursor:pointer;margin-left:4px;opacity:.7}.dz-hl{text-align:left!important;line-height:1.35}.dz-t th,.dz-t td{padding:7px 8px;vertical-align:middle}.dz-t td.n,.dz-t th.n{text-align:right;white-space:nowrap}
.dz-in{border:1px solid var(--line);border-radius:8px;padding:6px 8px;font:inherit;font-size:13.5px;background:#fff;color:inherit;min-width:0;box-sizing:border-box}.dz-in.n{text-align:right;width:100%;min-width:92px}.dz-in.s{width:66px;min-width:66px}
.dz-t td:nth-child(2){min-width:290px}.dz-nm{display:flex;gap:6px;align-items:center}.dz-nm .dz-in{flex:1;min-width:140px}.dz-nm .btn{white-space:nowrap}
.dz-s{display:block;font-size:11.5px;color:var(--muted);margin-top:2px;text-align:right}.dz-no{color:var(--muted)}.dz-ms{color:var(--red);font-weight:600;font-size:12.5px}
.dz-act{white-space:nowrap}.dz-act .btn{margin-left:4px}
tr.dz-lo>td{background:#fff1f0}tr.dz-thap>td{background:#fff7e6}tr.dz-gry>td{background:#fff}
.dz-at td,.dz-pt td{padding:6px 10px}.dz-pt td.n,.dz-pt th.n{text-align:right}.dz-prin td{background:#f8fafc}
.dz-tot td{background:#f8fafc}
.dz-pi{display:flex;justify-content:space-between;gap:12px;padding:10px 8px;border-bottom:1px solid var(--line);cursor:pointer}.dz-pi:hover{background:#f2f6ff}.dz-pi .n{text-align:right;white-space:nowrap}
.note.grn{background:var(--green-soft);color:var(--green)}.note.amb{background:var(--orange-soft);color:var(--orange)}
`;document.head.appendChild(s)})();
