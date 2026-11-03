/* =====================================================================
   THẺ / TÀI KHOẢN THANH TOÁN QUẢNG CÁO (Marketing › Digital › Giao dịch thanh toán › tab "Thẻ thanh toán")
   CEO duyệt 03/11/2026, thay file "Dòng tiền thẻ 9943" của team Digital:
   - Mỗi thẻ/tài khoản ngân hàng: dư đầu kỳ (tại một ngày), ngày bắt đầu/ngừng dùng (team hay đổi thẻ).
   - Gắn tài khoản quảng cáo (TKQC) vào thẻ theo khoảng ngày: tiền Facebook trừ TKQC đó trong khoảng ngày tính vào thẻ.
   - Nạp tiền: ngày, số tiền, bill. Trừ tiền: tự lấy từ nhật ký thanh toán Facebook (adsday.js, gồm VAT) + khoản ghi tay.
   - Kiểm số dư: nhập số dư thật trên ngân hàng một ngày bất kỳ, web so với số dư tính ra → khớp / lệch.
   Dữ liệu: D().adsPay {cards, gan, naps, trus, kt}. Bill lưu ở máy chủ /api/hub/task-files (tkUpload ở congviec.js).
   ===================================================================== */
const APY={tab:"gd",card:"",mo:"",modal:null};
const apyToday=()=>iso(new Date());
const apyStore=()=>{const p=D().adsPay||{};return {cards:p.cards||[],gan:p.gan||[],naps:p.naps||[],trus:p.trus||[],kt:p.kt||[]}};
const apyMoney=v=>Math.round(+String(v==null?"":v).replace(/[^\d-]/g,""))||0;
const apyVN=d=>d?d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(0,4):"";
const apyOn=c=>(!c.tu||c.tu<=apyToday())&&(!c.den||c.den>=apyToday());
const apyCanEdit=()=>{try{return ME.role==="admin"||ME.role==="digital"||(typeof userTeam==="function"&&userTeam(ME)==="ads")||(typeof can==="function"&&can(ME,"chiphi.nhap"))}catch(e){return false}};
function apyEdit(msg,fn){DB.mutate(ME.name,msg,d=>{const p=d.adsPay=d.adsPay||{};["cards","gan","naps","trus","kt"].forEach(k=>{if(!Array.isArray(p[k]))p[k]=[]});fn(p)});toast("Đã lưu");renderMain()}
/* TKQC biết được từ nhật ký Facebook */
function apyAccs(){const R=(typeof ADF!=="undefined"&&ADF.raw)||{},m={};(R.billing||[]).forEach(b=>{if(b.account)m[b.account]=b.name||m[b.account]||b.account});(R.acc_info||[]).forEach(i=>{if(i.account)m[i.account]=i.name||m[i.account]||i.account});apyStore().gan.forEach(g=>{if(g.acc&&!m[g.acc])m[g.acc]=g.accName||g.acc});return m}
const apyCardOf=(acc,day)=>{const g=apyStore().gan.find(x=>x.acc===acc&&(!x.tu||x.tu<=day)&&(!x.den||x.den>=day));return g?g.card:""};
/* Mọi khoản trừ của một thẻ: Facebook tự động + ghi tay */
function apyTru(cardId){
  const R=(typeof ADF!=="undefined"&&ADF.raw)||{},names=apyAccs(),out=[];
  (R.billing||[]).forEach(b=>{if(b.kind!=="tru")return;const day=adfDt(b.time);if(apyCardOf(b.account,day)!==cardId)return;out.push({ngay:day,gio:adfDtm(b.time),acc:b.account,ten:names[b.account]||b.account,tien:vatAmt(b),nguon:"Facebook",tx:b.tx||""})});
  apyStore().trus.filter(t=>t.card===cardId).forEach(t=>out.push({id:t.id,ngay:t.ngay,gio:t.ngay,acc:t.acc||"",ten:t.ten||t.acc||"Khoản khác",tien:t.tien||0,nguon:"Ghi tay",ghi:t.ghi||"",by:t.by||""}));
  return out.sort((a,b)=>String(a.gio).localeCompare(String(b.gio)))}
/* Số dư cuối ngày của thẻ, tính từ dư đầu kỳ (dư lúc đầu ngày "duDauNgay") */
function apyLedger(c){
  const s=apyStore(),from=c.duDauNgay||"",naps=s.naps.filter(n=>n.card===c.id&&(!from||n.ngay>=from)),trus=apyTru(c.id).filter(t=>!from||t.ngay>=from);
  const byDay={};const add=(d,k,v)=>{const x=byDay[d]||(byDay[d]={nap:0,tru:0,acc:{}});x[k]+=v;return x};
  naps.forEach(n=>add(n.ngay,"nap",n.tien||0));trus.forEach(t=>{const x=add(t.ngay,"tru",t.tien);x.acc[t.ten]=(x.acc[t.ten]||0)+t.tien});
  const bal=d=>{let b=c.duDau||0;Object.entries(byDay).forEach(([k,v])=>{if(k<=d)b+=v.nap-v.tru});return b};
  return {naps,trus,byDay,bal,nap:naps.reduce((a,n)=>a+(n.tien||0),0),tru:trus.reduce((a,t)=>a+t.tien,0)}}
const apyFirstFb=()=>{const B=((typeof ADF!=="undefined"&&ADF.raw)||{}).billing||[];return B.length?adfDt(B[B.length-1].time):""};

const APY_CSS=`.apy-ov{position:fixed;inset:0;background:rgba(15,20,40,.45);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:28px 12px;overflow:auto}.apy-md{background:var(--surface);color:var(--ink);border-radius:12px;padding:18px 20px;max-width:720px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.3)}.apy-md h3{margin:0 0 10px;display:flex;justify-content:space-between;align-items:center}.apy-g{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px}.apy-l{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--muted)}.apy-in{padding:6px 9px;font-size:13px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--ink);width:100%;box-sizing:border-box}.apy-bt{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.apy-sec{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-top:10px}.apy-tabs{display:flex;gap:6px;margin:0 0 12px}.apy-cards{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}.apy-card{border:1px solid var(--line);border-radius:10px;padding:10px 14px;background:var(--surface);cursor:pointer;min-width:200px;text-align:left;color:var(--ink)}.apy-card.on{border-color:var(--brand,#5b4bdb);box-shadow:0 0 0 2px var(--brand-soft,rgba(91,75,219,.18))}.apy-card small{display:block;color:var(--muted)}.apy-ok{color:var(--green)}.apy-bad{color:var(--red)}.apy-fl a{margin-right:6px}@media(max-width:640px){.apy-g{grid-template-columns:1fr}}`;

function apyModal(){const M=APY.modal;if(!M)return "";const d=M.d,s=apyStore();
  const fld=(l,f,ty,ph)=>`<label class="apy-l"><span>${l}</span><input class="apy-in" data-apm="${f}"${ty?` type="${ty}"`:""} value="${esc(d[f]==null?"":d[f])}"${ph?` placeholder="${esc(ph)}"`:""}></label>`;
  const head=t=>`<h3><span>${t}</span><button class="btn" data-apy="close" aria-label="Đóng">×</button></h3>`;
  const cardSel=`<label class="apy-l"><span>Thẻ / tài khoản</span><select class="apy-in" data-apm="card">${s.cards.map(c=>`<option value="${esc(c.id)}"${d.card===c.id?" selected":""}>${esc(c.ten)}${c.so4?" · "+esc(c.so4):""}</option>`).join("")}</select></label>`;
  const files=`<div class="apy-sec"><b>Bill / ảnh chụp đối chiếu</b><div class="apy-fl" style="margin:6px 0">${(d.files||[]).map((f,i)=>`<a href="${tkFileUrl(f.id)}" target="_blank" rel="noopener">${esc(f.name)}</a><button type="button" class="lnk" data-apy="fdel" data-i="${i}" aria-label="Bỏ file">✕</button>`).join(" ")||'<span class="hint">Chưa có bill.</span>'}</div><input type="file" id="apy-f" multiple accept="image/*,application/pdf"><div class="hint">Ảnh tự thu nhỏ, mỗi file tối đa 1,5 MB.</div></div>`;
  const save=`<div class="apy-bt"><button class="btn pri" data-apy="save">Lưu</button>${M.id?`<button class="btn" data-apy="del">Xóa</button>`:""}<button class="btn" data-apy="close">Hủy</button></div>`;
  if(M.t==="card"){const accs=apyAccs(),G=d.gan||[];
    return `<div class="apy-md">${head(M.id?"Sửa thẻ / tài khoản thanh toán":"Thêm thẻ / tài khoản thanh toán")}
    <div class="apy-g">${fld("Tên gợi nhớ","ten","","ví dụ: Thẻ 9943")}${fld("Ngân hàng","nh","","ví dụ: Techcombank")}${fld("4 số cuối","so4","","9943")}${fld("Chủ thẻ","chu","","")}${fld("Bắt đầu dùng từ ngày","tu","date")}${fld("Ngừng dùng từ ngày (để trống = đang dùng)","den","date")}</div>
    <div class="apy-sec"><b>Dư đầu kỳ</b><div class="apy-g" style="margin-top:6px">${fld("Số dư (đồng)","duDau","","0")}${fld("Là số dư lúc đầu ngày","duDauNgay","date")}</div><p class="hint" style="margin:6px 0 0">Mọi khoản nạp/trừ từ ngày này trở đi được cộng trừ vào số dư. Chỉ ghi 4 số cuối thẻ, không ghi số thẻ đầy đủ.</p></div>
    <div class="apy-sec"><b>Tài khoản quảng cáo trả bằng thẻ này</b><p class="hint" style="margin:4px 0 6px">Đổi thẻ cho một TKQC: ghi "đến ngày" ở thẻ cũ, rồi gắn TKQC đó vào thẻ mới "từ ngày" hôm sau.</p>
    ${G.map((g,i)=>`<div class="apy-g" style="grid-template-columns:2fr 1fr 1fr auto;align-items:end;margin-bottom:6px"><label class="apy-l"><span>TKQC</span><select class="apy-in" data-apg="acc" data-i="${i}"><option value="">— chọn —</option>${Object.entries(accs).map(([a,n])=>`<option value="${esc(a)}"${g.acc===a?" selected":""}>${esc(n)} · ${esc(a)}</option>`).join("")}</select></label><label class="apy-l"><span>Từ ngày</span><input class="apy-in" type="date" data-apg="tu" data-i="${i}" value="${esc(g.tu||"")}"></label><label class="apy-l"><span>Đến ngày</span><input class="apy-in" type="date" data-apg="den" data-i="${i}" value="${esc(g.den||"")}"></label><button class="btn" data-apy="gdel" data-i="${i}">Bỏ</button></div>`).join("")||'<div class="hint">Chưa gắn TKQC nào.</div>'}
    <div class="apy-bt" style="margin-top:6px"><button class="btn" data-apy="gadd">+ Gắn TKQC</button></div></div>${fld("Ghi chú","ghi")}${save}</div>`}
  if(M.t==="nap")return `<div class="apy-md">${head(M.id?"Sửa lần nạp tiền":"Nạp tiền vào thẻ")}<div class="apy-g">${cardSel}${fld("Ngày nạp","ngay","date")}${fld("Số tiền nạp (đồng)","tien","","0")}${fld("Người nạp / chuyển","nguoi")}</div>${fld("Ghi chú","ghi")}${files}${save}</div>`;
  if(M.t==="tru")return `<div class="apy-md">${head(M.id?"Sửa khoản trừ ghi tay":"Ghi tay một khoản trừ tiền")}<p class="hint" style="margin:0 0 6px">Tiền Facebook trừ TKQC đã gắn thẻ thì web tự lấy, không cần ghi. Chỉ ghi tay khoản Facebook chưa ghi lại được (trước ngày ${apyVN(apyFirstFb())||"máy bắt đầu ghi"}) hoặc khoản khác (phí ngân hàng, rút ra...).</p><div class="apy-g">${cardSel}${fld("Ngày trừ","ngay","date")}${fld("Số tiền (đồng)","tien","","0")}${fld("Trừ cho (TKQC / nội dung)","ten")}</div>${fld("Ghi chú","ghi")}${save}</div>`;
  if(M.t==="kt")return `<div class="apy-md">${head(M.id?"Sửa lần kiểm số dư":"Kiểm số dư thật trên ngân hàng")}<div class="apy-g">${cardSel}${fld("Ngày kiểm","ngay","date")}${fld("Số dư thật cuối ngày (đồng)","soDu","","0")}</div>${fld("Ghi chú","ghi")}${files}${save}</div>`;
  return ""}
function apyMdDraw(){let el=document.getElementById("apy-ov");if(!APY.modal){if(el)el.remove();return}
  if(!el){el=document.createElement("div");el.id="apy-ov";el.className="apy-ov";document.body.appendChild(el)}el.innerHTML=apyModal()}

function apyHtml(){
  const s=apyStore(),ed=apyCanEdit(),td=apyToday();
  const head=`<style>${APY_CSS}</style>`;
  if(!s.cards.length)return head+`<section class="card"><div class="card-h"><h2>Thẻ / tài khoản thanh toán quảng cáo</h2></div><p class="empty">Chưa có thẻ nào. ${ed?"Bấm <b>+ Thêm thẻ</b>, ghi dư đầu kỳ và gắn các tài khoản quảng cáo đang trả bằng thẻ đó.":"Team Digital thêm thẻ ở đây."}</p>${ed?`<div class="acts"><button class="btn pri" data-apy="cadd">+ Thêm thẻ</button></div>`:""}</section>`;
  if(!s.cards.some(c=>c.id===APY.card))APY.card=(s.cards.find(apyOn)||s.cards[0]).id;
  const c=s.cards.find(x=>x.id===APY.card),L=apyLedger(c),now=L.bal(td),first=apyFirstFb();
  const kts=s.kt.filter(k=>k.card===c.id).sort((a,b)=>b.ngay.localeCompare(a.ngay)),lk=kts[0],diff=lk?lk.soDu-L.bal(lk.ngay):null,okd=v=>Math.abs(v)<1000;
  const noBill=L.naps.filter(n=>!(n.files||[]).length).length;
  /* TKQC có tiền bị trừ mà chưa gắn thẻ nào */
  const R=(typeof ADF!=="undefined"&&ADF.raw)||{},names=apyAccs(),loose={};(R.billing||[]).forEach(b=>{if(b.kind==="tru"&&!apyCardOf(b.account,adfDt(b.time))){const k=b.account;loose[k]=(loose[k]||0)+vatAmt(b)}});
  const cardsBar=`<div class="apy-cards">${s.cards.map(x=>{const on=apyOn(x),b=apyLedger(x).bal(td);return `<button type="button" class="apy-card${x.id===c.id?" on":""}" data-apy="pick" data-id="${esc(x.id)}"><b>${esc(x.ten)}</b>${x.so4?` · ${esc(x.so4)}`:""} ${pill(on?"Đang chạy":"Ngừng",on?"grn":"gry")}<small>${esc(x.nh||"")}${x.chu?" · "+esc(x.chu):""}</small><small>Dư tính ra: <b style="color:${b<0?"var(--red)":"var(--ink)"}">${nf(b)}đ</b></small><small>${x.tu?"dùng từ "+apyVN(x.tu):""}${x.den?" đến "+apyVN(x.den):""}</small></button>`}).join("")}${ed?`<button type="button" class="apy-card" data-apy="cadd" style="display:flex;align-items:center;justify-content:center"><b>+ Thêm thẻ</b></button>`:""}</div>`;
  const acts=ed?`<div class="acts" style="margin:0 0 12px"><button class="btn pri" data-apy="nadd">+ Nạp tiền</button><button class="btn" data-apy="kadd">Kiểm số dư ngân hàng</button><button class="btn" data-apy="tadd">Ghi tay khoản trừ</button><button class="btn" data-apy="cedit" data-id="${esc(c.id)}">Sửa thẻ, gắn TKQC</button></div>`:"";
  const warn=[c.duDauNgay?"":"Chưa ghi ngày của dư đầu kỳ: bấm Sửa thẻ để điền.",c.duDauNgay&&first&&c.duDauNgay<first?`Facebook chỉ ghi lại tiền trừ từ ${apyVN(first)}; các khoản trừ từ ${apyVN(c.duDauNgay)} đến trước ngày đó cần ghi tay, hoặc đổi dư đầu kỳ sang ngày ${apyVN(first)}.`:"",!s.gan.some(g=>g.card===c.id)?"Thẻ chưa gắn tài khoản quảng cáo nào nên chưa tự lấy được tiền trừ.":"",noBill?`${noBill} lần nạp chưa có bill.`:"",Object.keys(loose).length?`Có ${Object.keys(loose).length} TKQC bị Facebook trừ tiền nhưng chưa gắn vào thẻ nào: ${Object.entries(loose).map(([a,v])=>esc(names[a]||a)+" ("+nf(v)+"đ)").join(", ")}.`:""].filter(Boolean);
  const kpis=`<div class="grid kpis">${kpi("Dư đầu kỳ",nf(c.duDau||0)+"đ",c.duDauNgay?"đầu ngày "+apyVN(c.duDauNgay):"chưa có ngày")}${kpi("Đã nạp",nf(L.nap)+"đ",L.naps.length+" lần")}${kpi("Đã trừ",nf(L.tru)+"đ",L.trus.length+" lần · gồm VAT")}${kpi("Dư hiện tại (tính ra)",nf(now)+"đ","= đầu kỳ + nạp − trừ",now<0?"var(--red)":"")}${kpi("Đối chiếu ngân hàng",lk?(okd(diff)?"Khớp":"Lệch "+nf(diff)+"đ"):"Chưa kiểm",lk?"kiểm ngày "+apyVN(lk.ngay)+": thật "+nf(lk.soDu)+"đ":"bấm Kiểm số dư ngân hàng",lk?(okd(diff)?"var(--green)":"var(--red)"):"")}</div>`;
  /* Bảng theo ngày của tháng đang xem (giống file Sheet: ngày | nạp | trừ từng TKQC | số dư) */
  const mo=APY.mo||td.slice(0,7),[y,m]=mo.split("-").map(Number),nd=new Date(y,m,0).getDate(),days=[];for(let i=1;i<=nd;i++){const d=mo+"-"+String(i).padStart(2,"0");if(d>td)break;if(c.duDauNgay&&d<c.duDauNgay)continue;days.push(d)}
  const accCols=[...new Set(days.flatMap(d=>Object.keys((L.byDay[d]||{}).acc||{})))],ktBy={};kts.forEach(k=>{ktBy[k.ngay]=k});
  const mos=[...new Set([td.slice(0,7)].concat(Object.keys(L.byDay).map(k=>k.slice(0,7))))].sort().reverse();
  const dayTbl=`<section class="card flush"><div class="card-h pad"><h2>Dòng tiền theo ngày</h2><select id="apy-mo" style="margin-left:auto">${opt(mos.map(x=>[x,"Tháng "+x.slice(5)+"/"+x.slice(0,4)]),mo)}</select></div><div class="tbl"><table><thead><tr><th>Ngày</th><th class="n">Nạp vào</th>${accCols.map(a=>`<th class="n">Trừ · ${esc(a)}</th>`).join("")}<th class="n">Tổng trừ</th><th class="n">Số dư tính ra</th><th class="n">Số dư thật</th><th>Đối chiếu</th></tr></thead><tbody>${days.length?days.map(d=>{const x=L.byDay[d]||{nap:0,tru:0,acc:{}},b=L.bal(d),k=ktBy[d],df=k?k.soDu-b:null;if(!x.nap&&!x.tru&&!k)return "";return `<tr><td>${apyVN(d)}</td><td class="n">${x.nap?nf(x.nap):""}</td>${accCols.map(a=>`<td class="n">${x.acc[a]?nf(x.acc[a]):""}</td>`).join("")}<td class="n">${x.tru?nf(x.tru):""}</td><td class="n"><b>${nf(b)}</b></td><td class="n">${k?nf(k.soDu):""}</td><td>${k?(okd(df)?'<span class="apy-ok">Khớp</span>':`<span class="apy-bad">Lệch ${nf(df)}</span>`):""}</td></tr>`}).join("")||`<tr><td colspan="${accCols.length+6}" class="empty">Tháng này chưa có nạp, trừ hay kiểm số dư.</td></tr>`:`<tr><td colspan="${accCols.length+6}" class="empty">Chưa tới ngày dư đầu kỳ.</td></tr>`}</tbody></table></div></section>`;
  const fl=L2=>(L2||[]).map(f=>`<a href="${tkFileUrl(f.id)}" target="_blank" rel="noopener">${esc(f.name)}</a>`).join(" ");
  const napTbl=`<section class="card flush"><div class="card-h pad"><h2>Lịch sử nạp tiền</h2><span class="hint">${L.naps.length} lần · ${nf(L.nap)}đ</span></div><div class="tbl"><table><thead><tr><th>Ngày</th><th class="n">Số tiền</th><th>Người nạp</th><th>Bill đối chiếu</th><th>Ghi chú</th>${ed?"<th></th>":""}</tr></thead><tbody>${L.naps.slice().sort((a,b)=>b.ngay.localeCompare(a.ngay)).map(n=>`<tr><td>${apyVN(n.ngay)}</td><td class="n"><b>${nf(n.tien||0)}</b></td><td>${esc(n.nguoi||"")}</td><td class="apy-fl">${fl(n.files)||'<span class="apy-bad">chưa có bill</span>'}</td><td>${esc(n.ghi||"")}</td>${ed?`<td><button class="btn" data-apy="nedit" data-id="${esc(n.id)}">Sửa</button></td>`:""}</tr>`).join("")||`<tr><td colspan="${ed?6:5}" class="empty">Chưa có lần nạp nào.</td></tr>`}</tbody></table></div></section>`;
  const truTbl=`<section class="card flush"><div class="card-h pad"><h2>Lịch sử trừ tiền từ tài khoản quảng cáo</h2><span class="hint">${L.trus.length} lần · ${nf(L.tru)}đ · Facebook tự ghi từ ${apyVN(first)||"—"}</span></div><div class="tbl"><table><thead><tr><th>Ngày giờ (VN)</th><th>Trừ cho</th><th class="n">Số tiền (gồm VAT)</th><th>Nguồn</th><th>Mã giao dịch / ghi chú</th>${ed?"<th></th>":""}</tr></thead><tbody>${L.trus.slice().reverse().slice(0,400).map(t=>`<tr><td>${t.nguon==="Facebook"?esc(t.gio):apyVN(t.ngay)}</td><td>${esc(t.ten)}</td><td class="n">${nf(t.tien)}</td><td>${t.nguon==="Facebook"?pill("Facebook","blu"):pill("Ghi tay","amb")}</td><td class="mono">${esc(t.tx||t.ghi||"")}</td>${ed?`<td>${t.id?`<button class="btn" data-apy="tedit" data-id="${esc(t.id)}">Sửa</button>`:""}</td>`:""}</tr>`).join("")||`<tr><td colspan="${ed?6:5}" class="empty">Chưa có khoản trừ nào.</td></tr>`}</tbody></table></div></section>`;
  const ktTbl=kts.length?`<section class="card flush"><div class="card-h pad"><h2>Các lần kiểm số dư ngân hàng</h2></div><div class="tbl"><table><thead><tr><th>Ngày</th><th class="n">Số dư thật</th><th class="n">Số dư tính ra</th><th class="n">Lệch</th><th>Ảnh sao kê</th><th>Ghi chú</th>${ed?"<th></th>":""}</tr></thead><tbody>${kts.map(k=>{const b=L.bal(k.ngay),df=k.soDu-b;return `<tr><td>${apyVN(k.ngay)}</td><td class="n">${nf(k.soDu)}</td><td class="n">${nf(b)}</td><td class="n">${okd(df)?'<span class="apy-ok">Khớp</span>':`<span class="apy-bad">${nf(df)}</span>`}</td><td class="apy-fl">${fl(k.files)}</td><td>${esc(k.ghi||"")}</td>${ed?`<td><button class="btn" data-apy="kedit" data-id="${esc(k.id)}">Sửa</button></td>`:""}</tr>`}).join("")}</tbody></table></div><p class="hint pad">Lệch dương: ngân hàng nhiều hơn web tính (thiếu ghi một khoản trừ, hoặc ghi thừa nạp). Lệch âm: ngân hàng ít hơn (còn khoản trừ chưa ghi: phí, TKQC chưa gắn thẻ...).</p></section>`:"";
  return head+cardsBar+acts+(warn.length?`<div class="note">${warn.map(w=>"• "+w).join("<br>")}</div>`:"")+kpis+dayTbl+napTbl+truTbl+ktTbl;
}

/* Trang Giao dịch thanh toán: thêm hàng tab trên cùng, tab cũ giữ nguyên */
if(typeof PAGES.fb_gd==="function"&&!window.__apyWrap){window.__apyWrap=1;const _gd0=PAGES.fb_gd;
  PAGES.fb_gd=function(m){
    const bar=`<div class="apy-tabs"><button type="button" class="btn sm${APY.tab==="gd"?" pri":""}" data-apy="tab" data-id="gd">Giao dịch Facebook</button><button type="button" class="btn sm${APY.tab==="the"?" pri":""}" data-apy="tab" data-id="the">Thẻ thanh toán</button></div>`;
    if(APY.tab!=="the"){_gd0(m);const ph=m.querySelector(".ph");if(ph)ph.insertAdjacentHTML("afterend",bar);else m.insertAdjacentHTML("afterbegin",bar);return}
    if(typeof adfLoad==="function")adfLoad();
    m.innerHTML=H("Thẻ thanh toán quảng cáo","Dư đầu kỳ, nạp tiền, tiền Facebook trừ, đối chiếu số dư ngân hàng")+bar+apyHtml();
    const mo=m.querySelector("#apy-mo");if(mo)mo.onchange=e=>{APY.mo=e.target.value;renderMain()};
    apyMdDraw()}}

if(!window.__apyBound){window.__apyBound=1;
  const cap=()=>{const M=APY.modal,root=document.getElementById("apy-ov");if(!M||!root)return;root.querySelectorAll("[data-apm]").forEach(i=>{M.d[i.dataset.apm]=i.value});if(M.t==="card")root.querySelectorAll("[data-apg]").forEach(i=>{const g=(M.d.gan||[])[+i.dataset.i];if(g)g[i.dataset.apg]=i.value})};
  document.addEventListener("change",async e=>{const t=e.target;if(!t||t.id!=="apy-f"||!APY.modal)return;cap();const up=await tkUpload(t.files,"adspay");APY.modal.d.files=(APY.modal.d.files||[]).concat(up);apyMdDraw()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&APY.modal){APY.modal=null;apyMdDraw()}});
  document.addEventListener("click",e=>{const b=e.target&&e.target.closest?e.target.closest("[data-apy]"):null;if(!b)return;const a=b.dataset.apy,id=b.dataset.id,s=apyStore(),td=apyToday();
    if(a==="tab"){APY.tab=id;renderMain();return}
    if(a==="pick"){APY.card=id;APY.mo="";renderMain();return}
    if(a==="close"){APY.modal=null;apyMdDraw();return}
    if(!apyCanEdit())return;
    const cl=o=>JSON.parse(JSON.stringify(o));
    if(a==="cadd"){APY.modal={t:"card",id:"",d:{ten:"",nh:"",so4:"",chu:"",tu:td,den:"",duDau:0,duDauNgay:td,ghi:"",gan:[]}};apyMdDraw()}
    else if(a==="cedit"){const c=s.cards.find(x=>x.id===id);if(c){APY.modal={t:"card",id,d:Object.assign(cl(c),{gan:cl(s.gan.filter(g=>g.card===id))})};apyMdDraw()}}
    else if(a==="gadd"){cap();APY.modal.d.gan=(APY.modal.d.gan||[]).concat([{id:"g"+Date.now(),acc:"",tu:APY.modal.d.tu||td,den:""}]);apyMdDraw()}
    else if(a==="gdel"){cap();APY.modal.d.gan=APY.modal.d.gan.filter((x,i)=>i!==+b.dataset.i);apyMdDraw()}
    else if(a==="nadd"){APY.modal={t:"nap",id:"",d:{card:APY.card,ngay:td,tien:"",nguoi:ME.name||"",ghi:"",files:[]}};apyMdDraw()}
    else if(a==="tadd"){APY.modal={t:"tru",id:"",d:{card:APY.card,ngay:td,tien:"",ten:"",ghi:""}};apyMdDraw()}
    else if(a==="kadd"){APY.modal={t:"kt",id:"",d:{card:APY.card,ngay:td,soDu:"",ghi:"",files:[]}};apyMdDraw()}
    else if(a==="nedit"||a==="tedit"||a==="kedit"){const t={nedit:"nap",tedit:"tru",kedit:"kt"}[a],k={nap:"naps",tru:"trus",kt:"kt"}[t],x=s[k].find(y=>y.id===id);if(x){APY.modal={t,id,d:cl(x)};apyMdDraw()}}
    else if(a==="fdel"){cap();APY.modal.d.files=(APY.modal.d.files||[]).filter((x,i)=>i!==+b.dataset.i);apyMdDraw()}
    else if(a==="del"){const M=APY.modal;if(!M||!M.id||!confirm("Xóa dòng này?"))return;const k={card:"cards",nap:"naps",tru:"trus",kt:"kt"}[M.t];
      if(M.t==="card"&&(s.naps.some(n=>n.card===M.id)||s.trus.some(n=>n.card===M.id)||s.kt.some(n=>n.card===M.id))){toast("Thẻ đã có nạp/trừ/kiểm số dư: ghi ngày ngừng dùng thay vì xóa");return}
      apyEdit("xóa "+M.t+" thẻ thanh toán",p=>{p[k]=p[k].filter(x=>x.id!==M.id);if(M.t==="card")p.gan=p.gan.filter(g=>g.card!==M.id)});APY.modal=null;apyMdDraw()}
    else if(a==="save"){cap();const M=APY.modal,d=M.d;
      if(M.t==="card"){if(!String(d.ten||"").trim()){toast("Nhập tên gợi nhớ của thẻ");return}if(!d.duDauNgay){toast("Chọn ngày của dư đầu kỳ");return}
        d.so4=String(d.so4||"").replace(/\D/g,"").slice(-4);d.duDau=apyMoney(d.duDau);const gan=(d.gan||[]).filter(g=>g.acc);
        if(gan.some(g=>g.den&&g.tu&&g.den<g.tu)){toast("Đến ngày của TKQC phải sau từ ngày");return}
        const cid=M.id||"c"+Date.now(),accs=apyAccs();
        /* một TKQC không được trả bằng hai thẻ trong cùng khoảng ngày */
        const lap=gan.find(g=>s.gan.some(o=>o.card!==cid&&o.acc===g.acc&&(!o.den||!g.tu||o.den>=g.tu)&&(!g.den||!o.tu||g.den>=o.tu)));
        if(lap){const o=s.gan.find(x=>x.card!==cid&&x.acc===lap.acc),oc=s.cards.find(c=>c.id===(o&&o.card));toast((accs[lap.acc]||lap.acc)+" đang gắn ở "+(oc?oc.ten:"thẻ khác")+" cùng khoảng ngày: ghi đến ngày ở thẻ cũ trước");return}
        const card=Object.assign({},d,{id:cid});delete card.gan;
        apyEdit((M.id?"sửa":"thêm")+" thẻ thanh toán "+d.ten,p=>{const i=p.cards.findIndex(x=>x.id===cid);if(i>=0)p.cards[i]=card;else p.cards.push(card);p.gan=p.gan.filter(g=>g.card!==cid).concat(gan.map(g=>({id:g.id||"g"+Date.now()+Math.random().toString(36).slice(2,6),card:cid,acc:g.acc,accName:accs[g.acc]||g.acc,tu:g.tu||"",den:g.den||""})))});APY.card=cid}
      else{const k={nap:"naps",tru:"trus",kt:"kt"}[M.t];if(!d.card){toast("Chọn thẻ");return}if(!d.ngay){toast("Chọn ngày");return}
        if(M.t==="kt")d.soDu=apyMoney(d.soDu);else{d.tien=apyMoney(d.tien);if(!d.tien){toast("Nhập số tiền");return}}
        if(M.t==="tru"&&!String(d.ten||"").trim()){toast("Ghi khoản trừ này cho TKQC hay nội dung gì");return}
        const row=Object.assign({},d,{id:M.id||M.t+Date.now(),by:d.by||ME.name});
        apyEdit((M.id?"sửa ":"thêm ")+{nap:"lần nạp",tru:"khoản trừ ghi tay",kt:"lần kiểm số dư"}[M.t]+" thẻ thanh toán",p=>{const i=p[k].findIndex(x=>x.id===row.id);if(i>=0)p[k][i]=row;else p[k].push(row)})}
      APY.modal=null;apyMdDraw()}})}
