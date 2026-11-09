/* =====================================================================
   DỰ TRÙ GIÁ BÁN (Quản trị › Lãi lỗ › Dự trù giá bán): tính giá bán, lãi và ngưỡng quảng cáo cho combo trên TikTok / Facebook,
   thử chương trình khuyến mại. Theo Google Sheet mẫu chị Hoa ("AILLA - Dự trù giá bán TikTok & Facebook").
   Hàm tính: dutrucalc.js (test: tests/unit/dutrucalc.test.ts). Giá vốn lấy từ Sản phẩm & combo + Giá vốn SKU + giá nhập kho (spcombo.js),
   mã nào chưa có giá vốn thì ghi rõ "chưa có giá vốn", không ước số. Giả định chi phí và các dòng phương án lưu ở D().dutru (hub_state), không cần bảng mới.
   Chỉ CEO / kế toán xem (cùng quyền xem giá vốn): tài khoản vận hành không thấy lãi.
   ===================================================================== */
const DZB={rows:null,A:null,pr:null,pp:{},showA:false,pk:null,ptab:"combo",pq:""};
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
  if(!DZB.rows.length)DZB.rows.push(dzBlank());
}
const dzBlank=(o)=>Object.assign({id:dzId(),ten:"",kenh:"tiktok",gia:null,gvSp:null,gvQua:null,aff:0,cpqc:0,parts:null,mSp:false,mQua:false},o||{});
function dzSave(){
  const snap=JSON.parse(JSON.stringify({A:DZB.A,rows:DZB.rows}));
  try{DB.mutate(ME&&ME.name||"",  "dự trù giá bán",d=>{d.dutru=snap})}catch(e){}
}
/* Bảng giá vốn hiện hành (mã chữ thường → {u,src}). */
function dzCostMap(){
  if(typeof SPCB==="undefined"||!SPCB.rows)return null;
  return spcGvMap((typeof D==="function"&&D()&&D().skus)||[],SPCB.cost||[],spcKy());
}
/* Điền lại giá vốn tự động cho dòng đã gắn với danh mục (trừ ô đã gõ tay). Trả về danh sách mã thiếu. */
function dzAuto(r,g){
  if(!r.parts||!g)return [];
  const c=dzCostParts(r.parts,g);
  if(!r.mSp)r.gvSp=c.gvSp;
  if(!r.mQua)r.gvQua=c.gvQua;
  return c.miss;
}
const dzName=n=>n&&n.length>46?n.slice(0,45)+"…":n;
const dzTag=(t,c)=>`<span class="pill p-${c}">${t}</span>`;

/* Các ô kết quả của một dòng (8 cột). */
function dzOutCells(r,A){
  const x=dzCalc(r,A);
  if(!x.ok)return [`<span class="dz-ms">${esc(x.why)}</span>`,"—","—","—","—","—","—","—"];
  const tone=dzTone(x),col=tone==="red"?"var(--red)":tone==="amb"?"var(--orange)":"var(--green)";
  return [dzFmtPct(x.pct),nf(x.tong),`<b style="color:${col}">${nf(x.ln)}</b>`,`<b style="color:${col}">${dzFmtPct(x.bien)}</b>`,dzFmtPct(x.hoaVon),
    x.tran>0?dzFmtPct(x.tran):`<span style="color:var(--red)">${dzFmtPct(x.tran)}</span>`,dzFmtRoas(x.roasHV),x.roasTran==null?`<span style="color:var(--red)">không có</span>`:`<b>${dzFmtRoas(x.roasTran)}</b>`];
}
function dzRowHTML(r,i,A,g){
  const miss=dzAuto(r,g),x=dzCalc(r,A),tone=dzTone(x),O=dzOutCells(r,A);
  const gv=(f,flag,missing)=>`<td><input class="dz-in n" data-id="${r.id}" data-f="${f}" data-m="1" value="${r[f]==null?"":dzMoney(r[f])}" placeholder="${missing?"chưa có giá vốn":"0"}" inputmode="numeric">${r.parts&&!r[flag]?`<small class="dz-s">tự điền</small>`:r.parts&&r[flag]?`<small class="dz-s">gõ tay</small>`:""}</td>`;
  const sp=r.parts&&r.gvSp==null,qu=r.parts&&r.gvQua==null;
  return `<tr class="dz-r dz-${tone}" data-rid="${r.id}"><td class="dz-no">${i+1}</td>
   <td><div class="dz-nm"><input class="dz-in" data-id="${r.id}" data-f="ten" value="${esc(r.ten||"")}" placeholder="Tên combo / phương án"><button class="btn sm ghost" data-pick="${r.id}" title="Chọn sản phẩm hoặc combo từ danh mục để tự điền giá vốn">Chọn từ danh mục</button></div>
     ${miss.length?`<small class="dz-s" style="color:var(--red)">Chưa có giá vốn: ${esc(miss.join(", "))}</small>`:""}</td>
   <td><select class="dz-in" data-id="${r.id}" data-f="kenh">${opt(DZ_KENH,r.kenh)}</select></td>
   <td><input class="dz-in n" data-id="${r.id}" data-f="gia" data-m="1" value="${r.gia==null?"":dzMoney(r.gia)}" placeholder="0" inputmode="numeric"></td>
   ${gv("gvSp","mSp",sp)}${gv("gvQua","mQua",qu)}
   <td><input class="dz-in n s" data-id="${r.id}" data-f="aff" value="${dzIn(r.aff)}" inputmode="decimal"></td>
   <td><input class="dz-in n s" data-id="${r.id}" data-f="cpqc" value="${dzIn(r.cpqc)}" inputmode="decimal"></td>
   ${O.map((h,k)=>`<td class="n dto">${h}</td>`).join("")}
   <td class="dz-act"><button class="btn sm" data-km="${r.id}" title="Thử chương trình khuyến mại">Thử KM</button><button class="btn sm ghost" data-dup="${r.id}" title="Nhân đôi dòng">⧉</button><button class="btn sm ghost" data-del="${r.id}" title="Xóa dòng">✕</button></td></tr>`;
}
/* Cập nhật tại chỗ ô kết quả của một dòng (không vẽ lại cả bảng để không mất con trỏ khi Tab). */
function dzRefreshRow(r){
  const tr=document.querySelector(`tr[data-rid="${r.id}"]`);if(!tr)return;
  const g=dzCostMap(),miss=dzAuto(r,g),x=dzCalc(r,DZB.A);
  tr.className="dz-r dz-"+dzTone(x);
  const O=dzOutCells(r,DZB.A);tr.querySelectorAll(".dto").forEach((td,i)=>td.innerHTML=O[i]);
  ["gvSp","gvQua"].forEach(f=>{const el=tr.querySelector(`[data-f="${f}"]`);if(el&&document.activeElement!==el)el.value=r[f]==null?"":dzMoney(r[f])});
  dzRefreshKpi();if(DZB.pr===r.id)dzPromoDraw();
}
function dzRefreshKpi(){const k=document.getElementById("dz-kpi");if(k)k.innerHTML=dzKpiHTML()}
function dzKpiHTML(){
  const R=DZB.rows.map(r=>({r,x:dzCalc(r,DZB.A)})),ok=R.filter(o=>o.x.ok),lo=ok.filter(o=>o.x.tt==="lo").length,th=ok.filter(o=>o.x.tt==="thap").length;
  const best=ok.slice().sort((a,b)=>b.x.bien-a.x.bien)[0],nm=R.filter(o=>!o.x.ok&&o.x.why==="Chưa có giá vốn").length;
  return kpi("Phương án đang so",nf(DZB.rows.length),`tối đa ${DZ_MAX_ROWS} dòng · biên mục tiêu ${dzFmtPct(DZB.A.bienMT)}`)
   +kpi("Đạt biên mục tiêu",nf(ok.length-lo-th),`${nf(th)} dưới mục tiêu`,th?"#b54708":"")
   +kpi("Đang lỗ",nf(lo),"phương án bán mỗi đơn là lỗ",lo?"#b42318":"")
   +kpi("Biên cao nhất",best?dzFmtPct(best.x.bien):"—",best?esc(dzName(best.r.ten||"(chưa đặt tên)")):nm?nf(nm)+" dòng chưa có giá vốn":"nhập giá bán và giá vốn");
}
/* Bảng giả định chi phí (sửa được, lưu lại). */
function dzAssumeHTML(){
  const A=DZB.A,cell=(k,f)=>`<td><input class="dz-in n s" data-a="${k}.${f}" value="${dzIn(A[k][f])}" inputmode="decimal"></td>`;
  return `<div class="card"><div class="card-h"><b>Giả định chi phí tự lấy theo kênh</b><span class="hint">Sửa được, tự lưu. Nguồn: bảng kế toán T7/2026. Facebook không có phí sàn, voucher, xử lý đơn.</span>
   <button class="btn sm ghost" id="dz-areset" style="margin-left:auto">Khôi phục số kế toán</button></div>
   <div class="tbl"><table class="dz-at"><thead><tr><th>Khoản</th><th class="n">TikTok Shop (% giá bán)</th><th class="n">Facebook (% giá bán)</th><th>Ghi chú</th></tr></thead><tbody>
   ${DZ_PCT.map(([f,n])=>`<tr><td>${n}</td>${cell("tiktok",f)}${cell("facebook",f)}<td class="hint">${({luong:"TikTok = 20tr ÷ doanh thu dự kiến 800tr = 2,5%",agency:"TikTok = 12tr ÷ 800tr = 1,5%",cpvc:"Chi phí video / quảng cáo gắn video",hhAgency:"Hoa hồng agency TikTok"})[f]||""}</td></tr>`).join("")}
   <tr><td>Phí xử lý đơn (đồng mỗi đơn)</td>${cell("tiktok","xuLy")}${cell("facebook","xuLy")}<td class="hint">Cố định đồng mỗi đơn, không phải %</td></tr>
   <tr class="dz-tot"><td><b>Tổng % cố định</b> (chưa gồm AFF và CPQC)</td><td class="n"><b>${dzFmtPct(dzFixedPct(A.tiktok))}</b></td><td class="n"><b>${dzFmtPct(dzFixedPct(A.facebook))}</b></td><td></td></tr>
   <tr><td>Biên lợi nhuận mục tiêu</td><td colspan="2"><input class="dz-in n s" data-a="bienMT" value="${dzIn(A.bienMT)}" inputmode="decimal"> %</td><td class="hint">Dưới mức này thì tô cảnh báo; dùng để tính CPQC trần và ROAS trần</td></tr>
   </tbody></table></div></div>`;
}
/* ---------- Thử khuyến mại ---------- */
function dzPP(r){
  let p=DZB.pp[r.id];
  if(!p)p=DZB.pp[r.id]={pct:10,tien:5000,vc:10,vcmax:10000,qua:3000,flash:Math.round((+r.gia||0)*0.85/1000)*1000};
  return p;
}
function dzPromoHTML(r){
  const p=dzPP(r),A=DZB.A,m=dzMax(r,A),T=dzCalc(r,A);
  const sc=[{k:"pct",v:p.pct},{k:"tien",v:p.tien},{k:"voucher",v:p.vc,max:p.vcmax},{k:"qua",v:p.qua},{k:"flash",v:p.flash}];
  const C=sc.map(s=>dzPromoCmp(r,s,A));
  const head=`<th></th><th class="n">Chưa khuyến mại</th>`+DZ_PROMO.map(x=>`<th class="n">${x[1]}</th>`).join("");
  const inp=(f,u,mx)=>`<input class="dz-in n s" data-pp="${f}" value="${f==="vcmax"||f==="tien"||f==="qua"||f==="flash"?dzMoney(p[f]):dzIn(p[f])}" inputmode="decimal"> ${u}`;
  const inRow=`<tr class="dz-prin"><td>Mức thử</td><td class="n">—</td><td class="n">${inp("pct","%")}</td><td class="n">${inp("tien","đ")}</td><td class="n">${inp("vc","%")}<br><small class="hint">tối đa</small> ${inp("vcmax","đ")}</td><td class="n">${inp("qua","đ")}<br><small class="hint">giá vốn quà</small></td><td class="n">${inp("flash","đ")}</td></tr>`;
  const cell=(f,fmt)=>`<td class="n">${fmt(T)}</td>`+C.map(c=>`<td class="n">${c.sau.ok?fmt(c.sau,c):"—"}</td>`).join("");
  const col=x=>x.tt==="lo"?"var(--red)":x.tt==="thap"?"var(--orange)":"var(--green)";
  const rows=T.ok?[
    ["Giá bán thực thu",x=>nf(x.gia)],
    ["Khách được giảm",(x,c)=>c?nf(c.giam):"—"],
    ["Lợi nhuận mỗi đơn",x=>`<b style="color:${col(x)}">${nf(x.ln)}</b>`],
    ["Biên lợi nhuận",x=>`<b style="color:${col(x)}">${dzFmtPct(x.bien)}</b>`],
    ["CPQC trần",x=>x.tran>0?dzFmtPct(x.tran):`<span style="color:var(--red)">${dzFmtPct(x.tran)}</span>`],
    ["ROAS trần",x=>x.roasTran==null?`<span style="color:var(--red)">không có</span>`:dzFmtRoas(x.roasTran)]].map(([n,f])=>`<tr><td>${n}</td>${cell(0,f)}</tr>`).join("")
   +`<tr><td>Biên đổi so với trước</td><td class="n">—</td>${C.map(c=>`<td class="n">${c.sau.ok?(c.dBien>=0?"+":"")+(Math.round(c.dBien*10)/10).toLocaleString("vi-VN")+" điểm":"—"}</td>`).join("")}</tr>
    <tr><td>Cảnh báo</td><td class="n">${T.tt==="lo"?dzTag("Đang lỗ","red"):T.tt==="thap"?dzTag("Dưới mục tiêu","amb"):dzTag("Đạt","grn")}</td>${C.map(c=>`<td class="n">${!c.sau.ok?"":c.sau.tt==="lo"?dzTag("LỖ "+nf(-c.sau.ln)+"đ/đơn","red"):c.sau.tt==="thap"?dzTag("Dưới mục tiêu","amb"):dzTag("Đạt","grn")}</td>`).join("")}</tr>
    <tr><td></td><td></td>${C.map((c,i)=>`<td class="n"><button class="btn sm ghost" data-addp="${i}" title="Thêm phương án này thành một dòng trong bảng để so sánh">+ Thêm vào bảng</button></td>`).join("")}</tr>`
   :`<tr><td colspan="7" class="empty">${esc(T.why||"")}: nhập giá bán và giá vốn ở dòng này trước.</td></tr>`;
  let gy="";
  if(T.ok&&m){
    gy=m.kho?`<div class="note red">${esc(m.why)}.</div>`
     :m.daDat?`<div class="note grn">Gợi ý: còn đạt biên mục tiêu ${dzFmtPct(A.bienMT)} nếu <b>giảm tối đa ${dzFmtPct(m.giamPct)} (${nf(m.giamD)}đ)</b>, tức giá thực thu không dưới <b>${nf(m.pmin)}đ</b>. Hoặc tặng quà có giá vốn tối đa <b>${nf(m.quaMax)}đ</b>.</div>`
     :`<div class="note amb">Hiện biên ${dzFmtPct(T.bien)} đã dưới mục tiêu ${dzFmtPct(A.bienMT)}, chưa còn chỗ để khuyến mại. Muốn đạt mục tiêu cần giá thực thu từ <b>${nf(m.pmin)}đ</b> hoặc giảm CPQC / AFF.</div>`;
  }
  return `<div class="card" id="dz-promo"><div class="card-h"><b>Thử khuyến mại: ${esc(r.ten||"(chưa đặt tên)")}</b><span class="hint">Sửa mức thử, số bên dưới tự tính lại. Bấm “+ Thêm vào bảng” để đưa phương án vào so sánh.</span>
    <button class="btn sm ghost" id="dz-pclose" style="margin-left:auto">Đóng</button></div>${gy}
    <div class="tbl"><table class="dz-pt"><thead><tr>${head}</tr></thead><tbody>${inRow}${rows}</tbody></table></div></div>`;
}
function dzPromoDraw(){
  const w=document.getElementById("dz-promo-w");if(!w)return;
  const r=DZB.rows.find(x=>x.id===DZB.pr);if(!r){w.innerHTML="";return}
  const keep=document.activeElement&&document.activeElement.dataset&&document.activeElement.dataset.pp;
  w.innerHTML=dzPromoHTML(r);dzBindPromo(r);
  if(keep){const el=w.querySelector(`[data-pp="${keep}"]`);if(el)el.focus()}
}
function dzBindPromo(r){
  const w=document.getElementById("dz-promo-w");if(!w)return;
  const p=dzPP(r),money={tien:1,vcmax:1,qua:1,flash:1};
  w.querySelectorAll("[data-pp]").forEach(el=>el.onchange=()=>{const f=el.dataset.pp,v=dzParse(el.value,!!money[f]);p[f]=v==null?0:v;dzPromoDraw()});
  const c=w.querySelector("#dz-pclose");if(c)c.onclick=()=>{DZB.pr=null;dzPromoDraw()};
  w.querySelectorAll("[data-addp]").forEach(b=>b.onclick=()=>{
    if(DZB.rows.length>=DZ_MAX_ROWS){toast("Tối đa "+DZ_MAX_ROWS+" dòng");return}
    const i=+b.dataset.addp,s=[{k:"pct",v:p.pct},{k:"tien",v:p.tien},{k:"voucher",v:p.vc,max:p.vcmax},{k:"qua",v:p.qua},{k:"flash",v:p.flash}][i];
    const cmp=dzPromoCmp(r,s,DZB.A),lab=["giảm "+dzFmtPct(p.pct),"giảm "+nf(p.tien)+"đ","voucher "+dzFmtPct(p.vc),"tặng quà "+nf(p.qua)+"đ","flash sale "+nf(p.flash)+"đ"][i];
    const n=dzBlank({ten:(r.ten||"Phương án")+" · "+lab,kenh:r.kenh,gia:cmp.r2.gia,gvSp:r.gvSp,gvQua:cmp.r2.gvQua,aff:r.aff,cpqc:r.cpqc,parts:r.parts?r.parts.slice():null,mSp:r.mSp,mQua:true});
    DZB.rows.splice(DZB.rows.findIndex(x=>x.id===r.id)+1,0,n);dzSave();DZB.pr=null;renderMain();toast("Đã thêm phương án vào bảng")});
}
/* ---------- Chọn từ danh mục ---------- */
function dzPickItems(g){
  const C=typeof spcCtx==="function"?spcCtx():null;if(!C)return {combos:[],prods:[]};
  const combos=C.combos.filter(c=>c.active&&c.parts.some(p=>p.kind!=="skip")).map(c=>{
    const parts=c.parts.filter(p=>p.kind!=="skip").map(p=>({code:p.code,qty:p.qty,kind:p.kind})),cs=dzCostParts(parts,g);
    return {key:c.key,ch:c.ch,name:c.sku+(c.variant?" · "+c.variant:""),parts,cs,desc:parts.map(p=>(p.qty!=1?p.qty+"× ":"")+p.code+(p.kind==="gift"?" (quà)":"")).join(", "),orders:c.orders}});
  const prods=(SPCB.prods||[]).filter(p=>p.active).map(p=>{const parts=[{code:p.code,qty:1,kind:"sp"}];return {key:"p:"+p.code,name:p.name||p.code,code:p.code,parts,cs:dzCostParts(parts,g)}});
  return {combos,prods};
}
function dzPicker(id){
  DZB.pk=id;DZB.ptab=DZB.ptab||"combo";DZB.pq="";
  openDrawerHTML(`<h2 class="dtitle">Chọn từ danh mục</h2><p class="hint">Chọn combo hoặc sản phẩm để tự điền giá vốn sản phẩm chính và giá vốn quà. Mã chưa có giá vốn sẽ báo rõ, không tự ước.</p>
   <nav class="settabs" id="dz-ptabs"></nav><input id="dz-pq" class="dz-in" placeholder="Gõ tên hoặc mã để tìm…" style="width:100%;margin:8px 0"><div id="dz-plist"></div>`);
  const q=document.getElementById("dz-pq");q.oninput=()=>{DZB.pq=q.value;dzPickDraw()};dzPickDraw();setTimeout(()=>q.focus(),50);
}
function dzPickDraw(){
  const g=dzCostMap(),P=dzPickItems(g),fold=typeof kfold==="function"?kfold:dzLow,w=fold(DZB.pq||"").trim().split(/\s+/).filter(Boolean);
  document.getElementById("dz-ptabs").innerHTML=[["combo","Combo ("+P.combos.length+")"],["sp","Sản phẩm ("+P.prods.length+")"]].map(([k,t])=>`<button class="${DZB.ptab===k?"on":""}" data-pt="${k}">${t}</button>`).join("");
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
    r.parts=x.parts;r.mSp=false;r.mQua=false;if(!r.ten)r.ten=x.name;
    if(x.ch==="TIKTOK")r.kenh="tiktok";else if(x.ch==="FACEBOOK")r.kenh="facebook";
    dzSave();closeDrawer();renderMain();
    if(x.cs.gvSp==null)toast("Mã này chưa có giá vốn: nhập ở Sản phẩm & combo hoặc Giá vốn SKU")});
}
/* ---------- Trang ---------- */
function pDutru(m){
  const T="Dự trù giá bán",S="Tính giá bán, lãi mỗi đơn và mức quảng cáo chịu được cho combo trên TikTok / Facebook; thử chương trình khuyến mại";
  if(!dzSee()){m.innerHTML=H(T,S)+`<div class="note amb">Trang này có số lãi nên chỉ CEO và kế toán xem.</div>`;return}
  dzInit();
  if(typeof spcLoad==="function")spcLoad();
  const g=dzCostMap(),A=DZB.A,loading=!g;
  const body=DZB.rows.map((r,i)=>dzRowHTML(r,i,A,g)).join("");
  m.innerHTML=H(T,S)+(typeof SPCB!=="undefined"&&SPCB.err?`<div class="note red">${esc(SPCB.err)}</div>`:"")+(loading?`<p class="hint">Đang tải giá vốn…</p>`:"")
   +`<div class="grid kpis" id="dz-kpi">${dzKpiHTML()}</div>
   <div class="card flush"><div class="card-h" style="padding:14px 16px 0"><b>So sánh phương án</b><span class="hint">Nhập giá bán thực thu, AFF %, CPQC % cho từng dòng. Giá vốn tự điền khi chọn từ danh mục (không dùng giá lẻ của quà).</span>
    <span style="margin-left:auto;display:flex;gap:8px"><button class="btn sm ghost" id="dz-ass">${DZB.showA?"Ẩn":"Xem / sửa"} giả định chi phí</button><button class="btn sm pri" id="dz-add">+ Thêm dòng</button></span></div>
    <div class="tbl dz-wrap"><table class="dz-t"><thead><tr><th>#</th><th>Combo / phương án</th><th>Kênh</th><th class="n">Giá bán thực thu</th><th class="n">Giá vốn SP chính</th><th class="n">Giá vốn quà</th><th class="n">AFF %</th><th class="n">CPQC %</th>
    <th class="n">Tổng CP tỷ lệ %</th><th class="n">Tổng chi phí / đơn</th><th class="n">Lợi nhuận / đơn</th><th class="n">Biên LN</th><th class="n">CPQC hòa vốn</th><th class="n">CPQC trần</th><th class="n">ROAS hòa vốn</th><th class="n">ROAS trần</th><th></th></tr></thead><tbody>${body}</tbody></table></div></div>
   <div id="dz-promo-w"></div>
   ${DZB.showA?dzAssumeHTML():""}
   <p class="hint pad">CPQC hòa vốn = CPQC + biên lợi nhuận. CPQC trần = CPQC hòa vốn − biên mục tiêu (chạy quảng cáo quá mức này thì biên rớt dưới mục tiêu). ROAS = 1 ÷ CPQC. Màu đỏ: đang lỗ; màu cam: biên dưới mục tiêu.</p>`;
  dzBind(m);
  if(DZB.pr)dzPromoDraw();
}
function dzBind(m){
  m.querySelectorAll("input.dz-in[data-f],select.dz-in[data-f]").forEach(el=>el.onchange=()=>{
    const r=DZB.rows.find(x=>x.id===el.dataset.id);if(!r)return;const f=el.dataset.f;
    if(f==="ten")r.ten=el.value.trim();
    else if(f==="kenh")r.kenh=el.value;
    else{const v=dzParse(el.value,!!el.dataset.m);
      if(f==="gvSp"||f==="gvQua"){r[f]=v;const flag=f==="gvSp"?"mSp":"mQua";r[flag]=v!=null;if(v==null&&r.parts){/* để trống = quay về tự điền */}}
      else r[f]=v==null?(f==="gia"?null:0):v;
      if(f==="aff"||f==="cpqc")el.value=dzIn(r[f]);else if(el.dataset.m)el.value=r[f]==null?"":dzMoney(r[f])}
    dzSave();dzRefreshRow(r)});
  m.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>dzPicker(b.dataset.pick));
  m.querySelectorAll("[data-km]").forEach(b=>b.onclick=()=>{DZB.pr=DZB.pr===b.dataset.km?null:b.dataset.km;dzPromoDraw();if(DZB.pr){const w=document.getElementById("dz-promo-w");if(w)w.scrollIntoView({behavior:"smooth",block:"nearest"})}});
  m.querySelectorAll("[data-dup]").forEach(b=>b.onclick=()=>{
    if(DZB.rows.length>=DZ_MAX_ROWS){toast("Tối đa "+DZ_MAX_ROWS+" dòng");return}
    const i=DZB.rows.findIndex(x=>x.id===b.dataset.dup),r=DZB.rows[i];DZB.rows.splice(i+1,0,Object.assign({},r,{id:dzId(),ten:(r.ten||"")+" (bản sao)",parts:r.parts?r.parts.slice():null}));dzSave();renderMain()});
  m.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{
    if(DZB.rows.length>1&&!confirm("Xóa dòng này?"))return;
    DZB.rows=DZB.rows.filter(x=>x.id!==b.dataset.del);if(!DZB.rows.length)DZB.rows.push(dzBlank());if(DZB.pr&&!DZB.rows.some(x=>x.id===DZB.pr))DZB.pr=null;dzSave();renderMain()});
  const add=m.querySelector("#dz-add");if(add)add.onclick=()=>{if(DZB.rows.length>=DZ_MAX_ROWS){toast("Tối đa "+DZ_MAX_ROWS+" dòng");return}DZB.rows.push(dzBlank());dzSave();renderMain()};
  const as=m.querySelector("#dz-ass");if(as)as.onclick=()=>{DZB.showA=!DZB.showA;renderMain()};
  m.querySelectorAll("[data-a]").forEach(el=>el.onchange=()=>{
    const [k,f]=el.dataset.a.split("."),v=dzParse(el.value,false);
    if(f===undefined)DZB.A.bienMT=v==null?DZ_DEF.bienMT:v;else DZB.A[k][f]=v==null?0:v;
    dzSave();renderMain()});
  const rs=m.querySelector("#dz-areset");if(rs)rs.onclick=()=>{if(!confirm("Đặt lại các giả định về số kế toán T7/2026?"))return;DZB.A=dzAssume(null);dzSave();renderMain()};
}
PAGES.dutru=pDutru;
MODULES.push({k:"q_dutru",adm:true,zone:"Quản trị",ic:"spark",n:"Dự trù giá bán",sub:"",groups:()=>[["",[MI("dutru","Dự trù giá bán",()=>dzSee())]]]});

/* Kiểu hiển thị riêng của trang (tiền tố dz-). */
(function(){if(typeof document==="undefined"||document.getElementById("dz-css"))return;const s=document.createElement("style");s.id="dz-css";s.textContent=`
.dz-wrap{overflow-x:auto}.dz-t{min-width:1500px}.dz-t th,.dz-t td{padding:7px 8px;vertical-align:middle}.dz-t td.n,.dz-t th.n{text-align:right;white-space:nowrap}
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
