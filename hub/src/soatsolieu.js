/* Máy soát số liệu: đối chiếu các chỗ nối giữa tiền, kho, hàng hoàn; chỉ hiện chỗ lệch. Chỉ đọc, không sửa dữ liệu. */
const SOAT={data:null,busy:false,err:"",item:null};
const SOAT_DOC={PN:"Nhập kho",PC:"Pha chế",KS:"Kiểm kê",XB:"Xuất Kênh phân phối",XK:"Xuất kho",TL:"Nhập hàng hoàn",TD:"Điều chỉnh",B2B:"Xuất bán Kênh phân phối (đơn)",ONLINE:"Xuất bán các sàn",TRA_HANG:"Khách trả hàng Kênh phân phối"};
const soatDoc=t=>SOAT_DOC[t]||t;
const SOAT_GRP={TIEN:"Tiền",KHO:"Kho",HOAN:"Hàng hoàn"};
const soatNum=v=>typeof v==="number"?v.toLocaleString("vi-VN"):esc(v);
async function soatLoad(){
  SOAT.busy=true;SOAT.err="";
  try{SOAT.data=await svApi("/api/hub/soat")}catch(e){SOAT.err=e.message||"Không tải được";SOAT.data=null}
  SOAT.busy=false;if(PAGE==="soat_sl")renderMain();
}
async function soatOpen(code){
  SOAT.item={code,busy:true};renderMain();
  try{SOAT.item=await svApi("/api/hub/soat/item/"+encodeURIComponent(code))}catch(e){SOAT.item={code,err:e.message||"Không tải được"}}
  renderMain();setTimeout(()=>{const el=document.getElementById("soat-panel");if(el)el.scrollIntoView({block:"nearest",behavior:"smooth"})},50);
}
function soatItemPanel(){
  const I=SOAT.item;if(!I)return "";
  if(I.busy)return `<div id="soat-panel" class="pad"><p class="hint">Đang tải sổ kho của ${esc(I.code)}…</p></div>`;
  if(I.err)return `<div id="soat-panel" class="pad"><p class="hint">${esc(I.err)}</p></div>`;
  const pos=I.by_type.some(t=>t.qty>0);
  const msg=pos?"":`<p class="hint"><b>Chưa có phiếu nhập hay tồn đầu kỳ nào cho mã này</b>, sổ chỉ có phiếu xuất nên tồn âm. Cần nhập số kiểm kê đầu kỳ hoặc phiếu nhập còn thiếu.</p>`;
  return `<div id="soat-panel" class="pad" style="border-top:2px solid #e5e7eb"><h3 style="margin:8px 0">Sổ kho: ${esc(I.item.name)} <span class="hint">(${esc(I.item.code)}) · tồn theo sổ ${soatNum(I.balance)} ${esc(I.item.unit||"")} · ${I.lines} dòng</span> <button class="btn sm" id="soat-close">Đóng</button></h3>
    ${msg}
    ${tbl(["Loại phiếu","Số dòng","Cộng / trừ vào tồn"],I.by_type.map(t=>`<tr><td>${esc(soatDoc(t.type))}</td><td class="n">${soatNum(t.lines)}</td><td class="n"><b style="color:${t.qty<0?"#c2410c":"#2f9e44"}">${t.qty>0?"+":""}${soatNum(t.qty)}</b></td></tr>`))}
    <p class="hint">30 dòng gần nhất (mới nhất ở trên):</p>
    ${tbl(["Ngày","Loại phiếu","Số phiếu","Số lượng","Tồn sau dòng này"],I.recent.map(r=>`<tr><td>${esc(r.doc_date)}</td><td>${esc(soatDoc(r.doc_type))}</td><td class="mono">${esc(r.doc_no)}</td><td class="n">${r.qty>0?"+":""}${soatNum(r.qty)}</td><td class="n">${soatNum(r.balance)}</td></tr>`))}</div>`;
}
function soatCard(f){
  const red=f.severity==="DO";
  const head=f.columns.map(c=>c[1]);
  const k1=f.code==="K1";
  const rows=f.rows.map(r=>`<tr${k1?` class="clk" data-soat-item="${esc(r.item)}" style="cursor:pointer"`:""}>${f.columns.map(c=>`<td${typeof r[c[0]]==="number"?' class="n"':""}>${soatNum(r[c[0]])}</td>`).join("")}</tr>`);
  return `<section class="card flush"><div class="card-h pad"><h2>${esc(f.title)} <span class="tag ${red?"red":"amb"}">${f.count}${f.capped?"+":""} điểm</span></h2><span class="hint">${esc(SOAT_GRP[f.group]||"")} · ${red?"cần xử lý":"cần chú ý"}</span></div>
    <p class="hint pad">${esc(f.hint)}</p>
    <div style="overflow:auto">${tbl(head,rows)}</div>
    ${k1?soatItemPanel():""}
    ${f.count>f.rows.length?`<p class="hint pad">Chỉ hiện ${f.rows.length} dòng đầu${f.capped?"":" (còn "+(f.count-f.rows.length)+" dòng nữa)"}.</p>`:""}</section>`;
}
function pSoat(m){
  if(!SOAT.data&&!SOAT.busy&&!SOAT.err)soatLoad();
  const D=SOAT.data;
  const at=D?new Date(D.at).toLocaleString("vi-VN",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit",year:"numeric"}):"";
  let body="";
  if(SOAT.err)body=`<section class="card"><p class="hint">${esc(SOAT.err)}</p></section>`;
  else if(!D)body=`<section class="card"><p class="hint">Đang soát số liệu…</p></section>`;
  else{
    const s=D.summary;
    body=`<div class="grid kpis">${kpi("Cần xử lý",String(s.red),s.red?"điểm lệch nặng":"không có")}${kpi("Cần chú ý",String(s.yellow),s.yellow?"nên xem trong tuần":"không có")}${kpi("Đã soát, ổn",String(s.ok),"mục")}</div>
      ${!D.findings.length?`<section class="card"><p class="hint">Không có điểm lệch nào. Toàn bộ ${s.ok} mục đã soát đều ổn.</p></section>`:D.findings.map(soatCard).join("")}
      ${D.errors.length?`<section class="card"><div class="card-h"><h2>Mục soát bị lỗi</h2></div><p class="hint">Các mục sau máy không soát được (lỗi kỹ thuật), cần báo người làm web: ${D.errors.map(e=>esc(e.code+" "+e.title)).join("; ")}.</p></section>`:""}
      ${D.passed.length?`<details class="card"><summary><b>Các mục đã soát và ổn (${D.passed.length})</b></summary><ul>${D.passed.map(p=>`<li>${esc(SOAT_GRP[p.group]||"")}: ${esc(p.title)}</li>`).join("")}</ul></details>`:""}`;
  }
  m.innerHTML=H("Máy soát số liệu",D?"Soát lúc "+at+" · chỉ hiện chỗ lệch giữa tiền, kho, hàng hoàn":"Đối chiếu tiền, kho, hàng hoàn")+`<div class="filters"><button class="btn pri" id="soat-re">Soát lại</button></div>`+body;
  m.querySelectorAll("[data-soat-item]").forEach(r=>r.onclick=()=>soatOpen(r.dataset.soatItem));
  const cl=m.querySelector("#soat-close");if(cl)cl.onclick=()=>{SOAT.item=null;renderMain()};
  const b=m.querySelector("#soat-re");if(b)b.onclick=()=>{SOAT.data=null;SOAT.err="";renderMain()};
}
PAGES.soat_sl=pSoat;
