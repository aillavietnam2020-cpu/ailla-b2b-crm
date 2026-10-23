/* Máy soát số liệu: đối chiếu các chỗ nối giữa tiền, kho, hàng hoàn; chỉ hiện chỗ lệch. Chỉ đọc, không sửa dữ liệu. */
const SOAT={data:null,busy:false,err:""};
const SOAT_GRP={TIEN:"Tiền",KHO:"Kho",HOAN:"Hàng hoàn"};
const soatNum=v=>typeof v==="number"?v.toLocaleString("vi-VN"):esc(v);
async function soatLoad(){
  SOAT.busy=true;SOAT.err="";
  try{SOAT.data=await svApi("/api/hub/soat")}catch(e){SOAT.err=e.message||"Không tải được";SOAT.data=null}
  SOAT.busy=false;if(PAGE==="soat_sl")renderMain();
}
function soatCard(f){
  const red=f.severity==="DO";
  const head=f.columns.map(c=>c[1]);
  const rows=f.rows.map(r=>`<tr>${f.columns.map(c=>`<td${typeof r[c[0]]==="number"?' class="n"':""}>${soatNum(r[c[0]])}</td>`).join("")}</tr>`);
  return `<section class="card flush"><div class="card-h pad"><h2>${esc(f.title)} <span class="tag ${red?"red":"amb"}">${f.count}${f.capped?"+":""} điểm</span></h2><span class="hint">${esc(SOAT_GRP[f.group]||"")} · ${red?"cần xử lý":"cần chú ý"}</span></div>
    <p class="hint pad">${esc(f.hint)}</p>
    <div style="overflow:auto">${tbl(head,rows)}</div>
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
  const b=m.querySelector("#soat-re");if(b)b.onclick=()=>{SOAT.data=null;SOAT.err="";renderMain()};
}
PAGES.soat_sl=pSoat;
