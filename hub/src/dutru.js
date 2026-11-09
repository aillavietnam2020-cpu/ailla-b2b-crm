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
  if(!DZB.rows.length)DZB.rows.push(dzBlank());
}
const dzRowsK=()=>DZB.rows.filter(r=>r.kenh===DZB.kenh);
const dzBlank=(o)=>Object.assign({id:dzId(),ten:"",kenh:DZB.kenh,gia:null,giam:0,giamK:"%",gvSp:null,gvQua:null,aff:0,booking:0,cpqc:0,parts:null,mSp:false,mQua:false},o||{});
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

/* Giá khách thực trả sau giảm (giảm nhập "10%" hoặc "5000"). Mọi kiểu khuyến mại quy về hai thứ: giá khách trả và quà tặng thêm. */
const dzEffGia=r=>{const g=dzN(r.gia),v=dzN(r.giam);return Math.max(0,r.giamK==="%"?g*(1-v/100):g-v)};
const dzEff=r=>Object.assign({},r,{gia:dzEffGia(r)},r.kenh==="facebook"?{aff:0}:{});
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
  if(m.kho)return `<small class="dz-s dz-hl" style="color:var(--red)">Chi phí tỷ lệ quá cao, không giá nào đạt biên mục tiêu: giảm Booking / CPQC (và Affiliate nếu có).</small>`;
  const lab=r.kenh==="facebook"?"Booking + CPQC":"Affiliate + Booking + CPQC",mk=x.aff+x.bk+dzN(r.cpqc),mkMax=Math.max(0,mk+x.bien-A.bienMT);
  const g=dzN(r.gia)?Math.max(0,(dzN(r.gia)-m.pmin)/dzN(r.gia)*100):0;
  if(x.bien<A.bienMT)return `<small class="dz-s dz-hl" style="color:var(--orange)">Chưa đạt biên ${dzFmtPct(A.bienMT)}: cần khách trả từ ${nf(m.pmin)}đ, hoặc cắt ${lab} từ ${dzFmtPct(mk)} xuống ${dzFmtPct(mkMax)}.</small>`;
  return `<small class="dz-s dz-hl" style="color:var(--green)">Còn đạt biên ${dzFmtPct(A.bienMT)} nếu: giảm tối đa ${dzFmtPct(g)} (khách trả ≥ ${nf(m.pmin)}đ) · tặng thêm quà ≤ ${nf(m.quaMax)}đ · ${lab} ≤ ${dzFmtPct(mkMax)}.</small>`;
}
function dzRowHTML(r,i,A,g){
  const miss=dzAuto(r,g),O=dzOutCells(r,A),x=dzCalc(dzEff(r),A),tone=dzTone(x);
  const pc=f=>`<td><input class="dz-in n s" data-id="${r.id}" data-f="${f}" value="${dzIn(r[f])}" inputmode="decimal"></td>`;
  return `<tr class="dz-r dz-${tone}" data-rid="${r.id}"><td class="dz-no">${i+1}</td>
   <td><div class="dz-nm"><input class="dz-in" data-id="${r.id}" data-f="ten" value="${esc(r.ten||"")}" placeholder="Tên combo / chương trình"><button class="btn sm ghost" data-pick="${r.id}" title="Chọn sản phẩm hoặc combo từ danh mục để tự điền giá vốn">Chọn</button></div>
     <div class="dz-hn">${miss.length?`<small class="dz-s" style="color:var(--red)">Chưa có giá vốn: ${esc(miss.join(", "))}</small>`:dzHint(r,A)}</div></td>
   <td><input class="dz-in n" data-id="${r.id}" data-f="gia" data-m="1" value="${r.gia==null?"":dzMoney(r.gia)}" placeholder="0" inputmode="numeric"></td>
   <td><input class="dz-in n s" data-id="${r.id}" data-f="giam" value="${dzGiamTxt(r)}" placeholder="10% hay 5000" title="Giảm giá cho khách: gõ 10% hoặc số tiền 5000"></td>
   <td class="n dzo">${O[0]}</td>
   <td><input class="dz-in n" data-id="${r.id}" data-f="gvSp" data-m="1" value="${r.gvSp==null?"":dzMoney(r.gvSp)}" placeholder="${r.parts?"chưa có giá vốn":"0"}" inputmode="numeric"></td>
   <td><input class="dz-in n" data-id="${r.id}" data-f="gvQua" data-m="1" value="${r.gvQua==null?"":dzMoney(r.gvQua)}" placeholder="0" inputmode="numeric" title="Giá vốn quà tặng kèm (không tính giá lẻ)">
     <div class="dz-gf">${(r.parts||[]).map((p,k)=>p.kind==="gift"?`<span class="pill p-vio">🎁 ${esc(p.code)} ×<input class="dz-gq" data-gid="${r.id}" data-gk="${k}" value="${p.qty}" inputmode="numeric"><a data-gx="${r.id}.${k}" title="Bỏ quà này">✕</a></span>`:"").join("")}<button class="btn sm ghost" data-gift="${r.id}" title="Chọn quà từ danh mục, giá vốn quà tự nhảy">+ Chọn quà</button></div></td>
   ${r.kenh==="facebook"?"":pc("aff")}${pc("booking")}${pc("cpqc")}
   ${O.slice(1).map(h=>`<td class="n dzo">${h}</td>`).join("")}
   <td class="dz-act"><button class="btn sm ghost" data-dup="${r.id}" title="Nhân đôi dòng để thử một chương trình khác">Nhân đôi</button><button class="btn sm ghost" data-del="${r.id}" title="Xóa dòng">✕</button></td></tr>`;
}
/* Cập nhật tại chỗ ô kết quả của một dòng (không vẽ lại cả bảng để không mất con trỏ khi Tab). */
function dzRefreshRow(r){
  const tr=document.querySelector(`tr[data-rid="${r.id}"]`);if(!tr)return;
  const g=dzCostMap(),miss=dzAuto(r,g),x=dzCalc(dzEff(r),DZB.A);
  tr.className="dz-r dz-"+dzTone(x);
  const O=dzOutCells(r,DZB.A);tr.querySelectorAll(".dzo").forEach((td,i)=>td.innerHTML=O[i]);
  ["gvSp","gvQua"].forEach(f=>{const el=tr.querySelector(`[data-f="${f}"]`);if(el&&document.activeElement!==el)el.value=r[f]==null?"":dzMoney(r[f])});
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
/* Bảng giả định chi phí của kênh đang chọn (sửa được, lưu lại). */
function dzAssumeHTML(){
  const k=DZB.kenh,fb=k==="facebook",A=DZB.A,cell=f=>`<td><input class="dz-in n s" data-a="${k}.${f}" value="${dzIn(A[k][f])}" inputmode="decimal"></td>`;
  const lab={phiSan:fb?"Phí nền tảng (chi phí video)":"Phí sàn (gộp tất cả phí sàn)",thue:"Thuế",nhanSu:"Nhân sự & quản lý"};
  const note=fb?{phiSan:"CPVC 9,2",thue:"Thuế 1,5%",nhanSu:"Lương 8,1 + quản lý 1,3"}:{phiSan:"Phí sàn 17 + voucher/Xtra 4,7 + CPVC 1,1",thue:"Thuế 1,5%",nhanSu:"Lương 2,5 (20tr÷800tr) + agency cố định 1,5 (12tr÷800tr) + hoa hồng agency 2"};
  return `<div class="card"><div class="card-h"><b>Chi phí tự tính của ${fb?"Facebook":"TikTok Shop"} (% giá bán)</b><span class="hint">Sửa được, tự lưu. Nguồn: bảng kế toán T7/2026.</span>
   <button class="btn sm ghost" id="dz-areset" style="margin-left:auto">Khôi phục số kế toán</button></div>
   <div class="tbl"><table class="dz-at"><thead><tr><th>Khoản</th><th class="n">${fb?"Facebook":"TikTok"}</th><th>Gồm có</th></tr></thead><tbody>
   ${DZ_PCT.map(([f])=>`<tr><td>${lab[f]}</td>${cell(f)}<td class="hint">${note[f]}</td></tr>`).join("")}
   ${fb?"":`<tr><td>Phí xử lý đơn (đồng mỗi đơn)</td>${cell("xuLy")}<td class="hint">Cố định đồng mỗi đơn, không phải %</td></tr>`}
   <tr class="dz-tot"><td><b>Tổng % cố định</b> (chưa gồm ${fb?"":"Affiliate, "}Booking, CPQC)</td><td class="n"><b>${dzFmtPct(dzFixedPct(A[k]))}</b></td><td></td></tr>
   <tr><td>Biên lãi mục tiêu (chung hai kênh)</td><td><input class="dz-in n s" data-a="bienMT" value="${dzIn(A.bienMT)}" inputmode="decimal"> %</td><td class="hint">Dưới mức này thì tô cảnh báo; dùng để tính CPQC trần, ROAS cần đạt và mức giảm giá tối đa</td></tr>
   </tbody></table></div></div>`;
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
  DZB.pk=id;DZB.pm=mode||"";DZB.ptab=mode==="gift"?"sp":(DZB.ptab||"combo");DZB.pq="";
  openDrawerHTML(`<h2 class="dtitle">${mode==="gift"?"Chọn quà tặng":"Chọn từ danh mục"}</h2>${mode==="gift"?`<p class="hint">Chọn quà từ danh mục: giá vốn quà tự nhảy vào ô “Giá vốn quà tặng” (giá vốn, không phải giá lẻ).</p>`:""}<p class="hint">Chọn combo hoặc sản phẩm để tự điền giá vốn sản phẩm chính và giá vốn quà. Mã chưa có giá vốn sẽ báo rõ, không tự ước.</p>
   <nav class="settabs" id="dz-ptabs"></nav><input id="dz-pq" class="dz-in" placeholder="Gõ tên hoặc mã để tìm…" style="width:100%;margin:8px 0"><div id="dz-plist"></div>`);
  const q=document.getElementById("dz-pq");q.oninput=()=>{DZB.pq=q.value;dzPickDraw()};dzPickDraw();setTimeout(()=>q.focus(),50);
}
function dzPickDraw(){
  const g=dzCostMap(),P=dzPickItems(g),fold=typeof kfold==="function"?kfold:dzLow,w=fold(DZB.pq||"").trim().split(/\s+/).filter(Boolean);
  if(DZB.pm==="gift")DZB.ptab="sp";
  document.getElementById("dz-ptabs").innerHTML=DZB.pm==="gift"?"":[["combo","Combo ("+P.combos.length+")"],["sp","Sản phẩm ("+P.prods.length+")"]].map(([k,t])=>`<button class="${DZB.ptab===k?"on":""}" data-pt="${k}">${t}</button>`).join("");
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
    if(DZB.pm==="gift"){
      if(!r.parts){r.parts=[];r.mSp=true}/* dòng gõ tay giá vốn SP: giữ nguyên số đã gõ */
      const o=r.parts.find(p=>p.kind==="gift"&&dzLow(p.code)===dzLow(x.code));if(o)o.qty=(+o.qty||1)+1;else r.parts.push({code:x.code,qty:1,kind:"gift"});
      r.mQua=false;dzSave();closeDrawer();renderMain();
      if(x.cs.gvSp==null)toast("Quà này chưa có giá vốn: nhập ở Sản phẩm & combo hoặc Giá vốn SKU");return}
    r.parts=x.parts;r.mSp=false;r.mQua=false;if(!r.ten)r.ten=x.name;
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
   +tabs+`<div class="grid kpis" id="dz-kpi">${dzKpiHTML()}</div>
   <div class="card flush"><div class="card-h" style="padding:14px 16px 0"><b>So sánh phương án</b><span class="hint">Mỗi dòng là một chương trình: nhập giá gốc, giảm giá (10% hoặc 5000), quà tặng, ${fb?"":"Affiliate, "}Booking, CPQC. Muốn thử chương trình khác thì bấm “Nhân đôi” rồi sửa, các dòng nằm cạnh nhau để so.</span>
    <span style="margin-left:auto;display:flex;gap:8px"><button class="btn sm ghost" id="dz-ass">${DZB.showA?"Ẩn":"Xem / sửa"} giả định chi phí</button><button class="btn sm pri" id="dz-add">+ Thêm dòng</button></span></div>
    <div class="tbl dz-wrap"><table class="dz-t"><thead><tr><th>#</th><th>Combo / chương trình</th><th class="n">Giá bán gốc</th><th class="n" title="Giảm cho khách: gõ 10% hoặc 5000">Giảm giá</th><th class="n">Khách trả</th><th class="n">Giá vốn SP</th><th class="n">Giá vốn quà tặng</th>${fb?"":`<th class="n">Affiliate %</th>`}<th class="n">Booking %</th><th class="n">CPQC %</th>
    <th class="n">Lãi / đơn</th><th class="n">Biên lãi</th><th class="n" title="CPQC tối đa mà biên vẫn đạt mục tiêu">CPQC trần %</th><th class="n" title="ROAS tối thiểu cần đạt = 1 ÷ CPQC trần">ROAS cần đạt</th><th></th></tr></thead><tbody>${body}</tbody></table></div></div>
   ${dzFileHTML()}
   ${DZB.showA?dzAssumeHTML():""}
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
      if(f==="gvSp"||f==="gvQua"){r[f]=v;const flag=f==="gvSp"?"mSp":"mQua";r[flag]=v!=null}
      else r[f]=v==null?(f==="gia"?null:0):v;
      if(f==="aff"||f==="cpqc"||f==="booking")el.value=dzIn(r[f]);else if(el.dataset.m)el.value=r[f]==null?"":dzMoney(r[f])}
    dzSave();dzRefreshRow(r)});
  m.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>dzPicker(b.dataset.pick));
  m.querySelectorAll("[data-gift]").forEach(b=>b.onclick=()=>dzPicker(b.dataset.gift,"gift"));
  m.querySelectorAll("[data-gx]").forEach(a=>a.onclick=()=>{const [id,k]=a.dataset.gx.split("."),r=DZB.rows.find(x=>x.id===id);if(!r)return;r.parts.splice(+k,1);r.mQua=false;dzSave();renderMain()});
  m.querySelectorAll("[data-gid]").forEach(el=>el.onchange=()=>{const r=DZB.rows.find(x=>x.id===el.dataset.gid),p=r&&r.parts[+el.dataset.gk];if(!p)return;const v=dzParse(el.value,true);p.qty=v>0?v:1;r.mQua=false;dzSave();renderMain()});
  m.querySelectorAll("[data-dup]").forEach(b=>b.onclick=()=>{
    if(dzRowsK().length>=DZ_MAX_ROWS){toast("Tối đa "+DZ_MAX_ROWS+" dòng mỗi kênh");return}
    const i=DZB.rows.findIndex(x=>x.id===b.dataset.dup),r=DZB.rows[i];DZB.rows.splice(i+1,0,Object.assign({},r,{id:dzId(),ten:(r.ten||"")+" (bản sao)",parts:r.parts?r.parts.slice():null}));dzSave();renderMain()});
  m.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{
    if(DZB.rows.length>1&&!confirm("Xóa dòng này?"))return;
    DZB.rows=DZB.rows.filter(x=>x.id!==b.dataset.del);if(!dzRowsK().length)DZB.rows.push(dzBlank());if(DZB.pr&&!DZB.rows.some(x=>x.id===DZB.pr))DZB.pr=null;dzSave();renderMain()});
  const add=m.querySelector("#dz-add");if(add)add.onclick=()=>{if(dzRowsK().length>=DZ_MAX_ROWS){toast("Tối đa "+DZ_MAX_ROWS+" dòng mỗi kênh");return}DZB.rows.push(dzBlank());dzSave();renderMain()};
  const as=m.querySelector("#dz-ass");if(as)as.onclick=()=>{DZB.showA=!DZB.showA;renderMain()};
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
.dz-wrap{overflow-x:auto}.dz-t{min-width:1300px}.dz-hn{max-width:340px}.dz-gf{margin-top:4px;display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end}.dz-gq{width:26px;border:0;background:transparent;font:inherit;font-weight:600;color:inherit;text-align:center;padding:0}.dz-gf a{cursor:pointer;margin-left:4px;opacity:.7}.dz-hl{text-align:left!important;line-height:1.35}.dz-t th,.dz-t td{padding:7px 8px;vertical-align:middle}.dz-t td.n,.dz-t th.n{text-align:right;white-space:nowrap}
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
