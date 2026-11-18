/* =====================================================================
   KIỂM KÊ TỒN (chị Hoa duyệt 18/11/2026: nghiệp vụ + bố cục). Trang Kho – Sản xuất › Kiểm kê & đối chiếu › Kiểm kê tồn.
   - Trên cùng: 4 bước chốt kho của kỳ (tồn đầu kỳ → kiểm kê → xử lý chênh lệch → dòng treo).
   - Một thẻ 4 tab: Phiếu kiểm tồn · Phiếu điều chỉnh · Dòng treo · Tồn đầu kỳ.
   - Phiếu kiểm tồn (KK) chỉ ghi số đếm + đơn giá, không đổi sổ. Mở phiếu: bảng chênh lệch, Kế toán lập Phiếu điều chỉnh (DC):
     thừa nhập, thiếu xuất, chưa rõ nguyên nhân thì treo (kho theo số đếm, tiền chưa hạch toán chi phí).
   - Tồn đầu kỳ: Kế toán lập, CEO duyệt. Phiếu tồn cũ sau mốc: CEO đổi thành phiếu kiểm tồn.
   Nạp SAU kho.js, kho2.js, khoton.js.
   ===================================================================== */
Object.assign(KHO_TYPES,{
  KK:{page:"kho_kk",name:"Phiếu kiểm tồn",who:["sx.kiemke","order.approve.normal","order.accounting.confirm"],hint:"Số đếm thực tế từng mã và đơn giá. Sổ kho không đổi; mở phiếu để xem chênh lệch và lập phiếu điều chỉnh."},
  DC:{page:"kho_kk",name:"Phiếu điều chỉnh kiểm kê",who:[],hint:"Lập từ bảng chênh lệch của phiếu kiểm tồn."}});
KHO_TYPES.TB.hint="Đếm thực tế rồi ghi số đếm và đơn giá từng mã, ngày phiếu = ngày đếm. Phiếu kiểm tồn không đổi sổ: mở phiếu để xem chênh lệch với sổ, Kế toán lập phiếu điều chỉnh (thừa nhập, thiếu xuất, chưa rõ nguyên nhân thì treo).";
const KKX={ov:null,treo:null,td:null,busy:false,tab:"kk",tf:"TREO",q:""};
const kkKeToan=()=>!!ME&&(ME.role==="admin"||can(ME,"order.accounting.confirm"));
const kkCanLap=()=>!!ME&&(ME.role==="admin"||kCan("KK"));
const kkEx=d=>{try{return JSON.parse(d.extra||"{}")}catch(e){return {}}};
const kkMoney=v=>v==null?"—":(v>0?"+":"")+nf(Math.round(v));
function kkCss(){if(document.getElementById("kk-css"))return;const s=document.createElement("style");s.id="kk-css";s.textContent=`
.kk-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}
.kk-step{background:#fff;border:1px solid #e6e9f2;border-radius:12px;padding:12px 14px}
.kk-step .kn{width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;margin-right:6px;background:#eef0f5;color:#6b7285}
.kk-step.done .kn{background:#e3f4ea;color:#16804a}.kk-step.now{border-color:#e7357b;box-shadow:0 0 0 3px #fff0f6}.kk-step.now .kn{background:#e7357b;color:#fff}
.kk-step .ks{color:#6b7285;font-size:12.5px;margin-top:4px;min-height:18px}.kk-step .kv{font-size:20px;font-weight:700;margin-top:4px}.kk-step.now .kv{color:#e7357b}
.kk-card{background:#fff;border:1px solid #e6e9f2;border-radius:14px;overflow:hidden;margin-bottom:12px}
.kk-tabs{display:flex;gap:2px;border-bottom:1px solid #e6e9f2;padding:0 10px;background:#fbfbfe;flex-wrap:wrap}
.kk-tabs button{border:0;background:none;padding:12px 14px;font:inherit;color:#6b7285;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
.kk-tabs button.on{color:#e7357b;border-bottom-color:#e7357b;font-weight:600}
.kk-c{display:inline-block;min-width:20px;padding:0 6px;border-radius:10px;background:#eef0f5;color:#6b7285;font-size:12px;margin-left:4px;text-align:center}.kk-c.w{background:#fff4e0;color:#b7791f}
.kk-bar{display:flex;align-items:center;gap:8px;padding:12px 14px;flex-wrap:wrap}.kk-bar .sp{flex:1}
.kk-bar input.kk-q{border:1px solid #d9deea;border-radius:9px;padding:7px 11px;font:inherit;min-width:220px}
.kk-seg{display:inline-flex;border:1px solid #d9deea;border-radius:9px;overflow:hidden}.kk-seg button{border:0;background:#fff;padding:6px 11px;font:inherit;cursor:pointer}.kk-seg button.on{background:#2b3a8c;color:#fff}
.kk-empty{padding:26px;text-align:center;color:#6b7285}
.kk-kp{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:10px 0}.kk-kp div{background:#fafbfe;border:1px solid #e6e9f2;border-radius:10px;padding:10px}.kk-kp b{display:block;font-size:18px}.kk-kp span{color:#6b7285;font-size:12px}
.kk-foot{position:sticky;bottom:0;background:#fff;border-top:1px solid #e6e9f2;padding:12px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px}
input.kk-ly{width:100%;border:1px solid #d9deea;border-radius:7px;padding:5px 7px;font:inherit}
.kk-sub{display:block;color:#6b7285;font-size:12px}
@media(max-width:760px){.kk-steps,.kk-kp{grid-template-columns:1fr 1fr}}`;document.head.appendChild(s)}
async function kkLoadAll(){if(KKX.busy)return;KKX.busy=true;
  try{const [o,t,td]=await Promise.all([kApi("/kk-overview"),kApi("/treo"),kApi("/docs?type=TD")]);KKX.ov=o;KKX.treo=t;KKX.td=td}
  catch(e){KKX.ov=KKX.ov||{kk:[],dc:[]};KKX.treo=KKX.treo||[];KKX.td=KKX.td||[];toast(e.message)}
  KKX.busy=false;if(PAGE==="kho_kk")renderMain()}
function kkReload(){KKX.ov=null;KKX.treo=null;KKX.td=null;kkLoadAll()}

function pKkPage(m){
  kkCss();if(!KKX.ov&&!KKX.busy)kkLoadAll();
  if(typeof KTON!=="undefined"&&!KTON.moc&&typeof ktonLoad==="function")ktonLoad();
  const P=kPer(),O=KKX.ov,T=KKX.treo||[],TD=(KKX.td||[]).filter(d=>d.status!=="HUY"),kt=kkKeToan();
  const moc=typeof KTON!=="undefined"&&KTON.moc?KTON.moc.moc:null,mocDoc=TD.find(d=>d.doc_date===moc&&d.status==="OK"),cho=TD.filter(d=>d.status==="CHO");
  const inP=d=>d.doc_date>=P.from&&d.doc_date<=P.to;
  const KK=O?O.kk.filter(d=>d.status==="OK"):[],kkP=KK.filter(inP),lastKk=kkP[0]||null;
  const chuaDc=kkP.filter(d=>!d.dc&&d.lech>0),nLech=chuaDc.reduce((s,d)=>s+d.lech,0),nTreo=T.filter(x=>x.st==="TREO").length;
  const st=[mocDoc?"done":cho.length?"now":"now",lastKk?"done":mocDoc?"now":"",nLech?"now":lastKk?"done":"",nTreo?"now":"done"];
  const cur=st.indexOf("now");st.forEach((s,i)=>{if(s==="now"&&i!==cur)st[i]=""});
  const step=(i,t,s,v)=>`<div class="kk-step ${st[i]}"><span class="kn">${st[i]==="done"?"✓":i+1}</span><b>${t}</b><div class="ks">${s}</div><div class="kv">${v}</div></div>`;
  const steps=`<div class="kk-steps">
    ${step(0,"Tồn đầu kỳ",mocDoc?`${esc(mocDoc.no)} · ${kDd(mocDoc.doc_date)} · CEO đã duyệt`:cho.length?`${esc(cho[0].no)} chờ CEO duyệt`:"Chưa có phiếu tồn đầu kỳ",mocDoc?nf(mocDoc.n_lines)+" mã":cho.length?"Chờ duyệt":"—")}
    ${step(1,"Kiểm kê trong kỳ",lastKk?`${esc(lastKk.no)} · đếm ngày ${kDd(lastKk.doc_date)}`:`Chưa có phiếu kiểm tồn ${kPerLabel(P)}`,lastKk?nf(kkP.reduce((s,d)=>s+d.n,0))+" mã đã đếm":"—")}
    ${step(2,"Xử lý chênh lệch",chuaDc.length?`${chuaDc.length} phiếu chờ Kế toán lập phiếu điều chỉnh`:lastKk?"Đã xử lý hết":"Sau khi kiểm kê",chuaDc.length?nf(nLech)+" mã lệch":lastKk?"Xong":"—")}
    ${step(3,"Dòng treo","Gỡ treo khi tìm ra, hạch toán cuối năm",nf(nTreo)+" dòng")}</div>`;
  const tabs=[["kk","Phiếu kiểm tồn",KK.length,""],["dc","Phiếu điều chỉnh",O?O.dc.filter(d=>d.status==="OK").length:0,""],["treo","Dòng treo",nTreo,nTreo?"w":""],["td","Tồn đầu kỳ",TD.length,cho.length?"w":""]];
  const q=kfold(KKX.q||""),hit=s=>!q||kfold(s).includes(q);
  let body="";
  if(!O)body=`<p class="kk-empty">Đang tải…</p>`;
  else if(KKX.tab==="kk"){const L=O.kk.filter(d=>hit(d.no+" "+(d.tu_td||"")));
    body=`<div class="kk-bar"><input class="kk-q" id="kk-q" placeholder="Tìm số phiếu…" value="${esc(KKX.q)}"><span class="sp"></span>${kkCanLap()?`<button class="btn" id="kk-tpl">⬇ File mẫu</button><button class="btn" id="kk-up">⬆ Tải từ Excel</button><button class="btn pri" id="kk-new">+ Lập phiếu kiểm tồn</button>`:""}</div>
     ${L.length?tbl(["Phiếu","Ngày đếm","Số mã đếm","Mã lệch","Giá trị chênh","Người lập","Tình trạng"],L.map(d=>`<tr class="clk" data-kk="${d.id}"><td class="mono"><b>${esc(d.no)}</b>${d.tu_td?`<span class="kk-sub">từ phiếu tồn ${esc(d.tu_td)}</span>`:""}</td><td>${kDd(d.doc_date)}</td><td class="n">${nf(d.n)}</td><td class="n"><b>${nf(d.lech)}</b></td><td class="n">${d.lech?kkMoney(d.gia_tri):"—"}</td><td>${esc(d.created_by_name||"—")}</td><td>${d.status!=="OK"?pill("Đã hủy","gry"):d.dc?pill("Đã điều chỉnh "+d.dc.no,"grn"):d.lech?pill("Chờ điều chỉnh","amb"):pill("Khớp sổ","grn")}</td></tr>`)):`<p class="kk-empty">Chưa có phiếu kiểm tồn. Bấm "+ Lập phiếu kiểm tồn" hoặc tải file Excel.</p>`}`}
  else if(KKX.tab==="dc"){const L=O.dc.filter(d=>hit(d.no+" "+d.kk));
    body=`<div class="kk-bar"><span class="hint">Lập từ bảng chênh lệch của phiếu kiểm tồn: thừa thì nhập, thiếu thì xuất. Muốn làm lại thì hủy phiếu rồi lập lại.</span></div>
     ${L.length?tbl(["Phiếu","Ngày","Theo phiếu kiểm","Dòng thừa","Dòng thiếu","Dòng treo","Giá trị","Người lập","Tình trạng"],L.map(d=>`<tr class="clk" data-dd="${d.id}"><td class="mono"><b>${esc(d.no)}</b></td><td>${kDd(d.doc_date)}</td><td class="mono">${esc(d.kk||"")}</td><td class="n">${nf(d.thua)}</td><td class="n">${nf(d.thieu)}</td><td class="n">${nf(d.treo)}</td><td class="n">${kkMoney(d.gia_tri)}</td><td>${esc(d.created_by_name||"—")}</td><td>${d.status==="OK"?pill("Hiệu lực","grn"):pill("Đã hủy","gry")}</td></tr>`)):`<p class="kk-empty">Chưa có phiếu điều chỉnh.</p>`}`}
  else if(KKX.tab==="treo"){const cnt=s=>T.filter(x=>x.st===s).length,L=T.filter(x=>x.st===KKX.tf);
    body=`<div class="kk-bar"><div class="kk-seg">${[["TREO","Đang treo"],["DA_GO","Đã gỡ"],["DA_HT","Đã hạch toán"]].map(([k,t])=>`<button data-tf="${k}" class="${KKX.tf===k?"on":""}">${t} (${cnt(k)})</button>`).join("")}</div><span class="sp"></span><span class="hint">Kho đã theo số đếm, tiền chưa vào chi phí</span></div>
     ${L.length?tbl(["Mã","Tên","Số lượng","Giá trị","Lý do","Phiếu",""],L.map(x=>{const it=KHO.items.get(x.item),i=T.indexOf(x);return `<tr><td class="mono">${esc(x.item)}</td><td>${esc(it?it.name:"")}</td><td class="n">${knum(x.qty)}</td><td class="n">${x.gia!=null?kkMoney(x.qty*x.gia):"—"}</td><td>${esc(x.ly_do||"")}${x.ghi_chu?`<span class="kk-sub">${esc(x.ghi_chu)}${x.by?" · "+esc(x.by):""}</span>`:""}</td><td class="mono"><a href="#" class="lnk" data-dd2="${x.doc_id}">${esc(x.no)}</a><span class="kk-sub">${kDd(x.doc_date)}</span></td><td style="white-space:nowrap">${kt&&x.st==="TREO"?`<button class="btn sm" data-tg="${i}" data-a="go">Gỡ treo</button> <button class="btn sm" data-tg="${i}" data-a="ht">Hạch toán</button>`:""}</td></tr>`})):`<p class="kk-empty">Không có dòng nào.</p>`}`}
  else {const L=TD;
    body=`<div class="kk-bar"><span class="hint">Chỉ cần một lần khi bắt đầu sổ (mốc đầu). Kế toán lập, CEO duyệt. Phiếu tồn sau mốc: mở phiếu, CEO bấm "Đổi thành phiếu kiểm tồn".</span><span class="sp"></span>${kt?`<button class="btn" id="kk-tdtpl">⬇ File mẫu</button><button class="btn pri" id="kk-td">+ Lập phiếu tồn đầu kỳ</button>`:""}</div>
     ${L.length?tbl(["Phiếu","Ngày tồn","Số mã","Người lập","Tình trạng"],L.map(d=>`<tr class="clk" data-dd="${d.id}"><td class="mono"><b>${esc(d.no)}</b>${d.doc_date===moc&&d.status==="OK"?`<span class="kk-sub">Mốc đầu của sổ</span>`:moc&&d.doc_date>moc&&d.status==="OK"?`<span class="kk-sub">Sau mốc: nên đổi thành phiếu kiểm tồn</span>`:""}</td><td>${kDd(d.doc_date)}</td><td class="n">${nf(d.n_lines)}</td><td>${esc(d.created_by_name||"—")}</td><td>${d.status==="CHO"?pill("Chờ CEO duyệt","amb"):pill("CEO đã duyệt","grn")}</td></tr>`)):`<p class="kk-empty">Chưa có phiếu tồn đầu kỳ.</p>`}`}
  khoFrame(m,"kho_kk","Kiểm kê tồn",`Kỳ ${kPerLabel(P)} · mốc đầu của sổ ${moc?kDd(moc):"chưa có"}. Đếm thực tế ghi vào phiếu kiểm tồn; chênh lệch với sổ xử lý bằng phiếu điều chỉnh.`,
    steps+`<div class="kk-card"><div class="kk-tabs">${tabs.map(([k,t,n,w])=>`<button data-kt="${k}" class="${KKX.tab===k?"on":""}">${t}<span class="kk-c ${w}">${n}</span></button>`).join("")}</div>${body}</div>`);
  m.querySelectorAll("[data-kt]").forEach(b=>b.onclick=()=>{KKX.tab=b.dataset.kt;KKX.q="";renderMain()});
  m.querySelectorAll("[data-tf]").forEach(b=>b.onclick=()=>{KKX.tf=b.dataset.tf;renderMain()});
  m.querySelectorAll("[data-kk]").forEach(tr=>tr.onclick=()=>kkOpen(+tr.dataset.kk));
  m.querySelectorAll("[data-dd]").forEach(tr=>tr.onclick=()=>khoOpenDoc(+tr.dataset.dd));
  m.querySelectorAll("[data-dd2]").forEach(a=>a.onclick=e=>{e.preventDefault();khoOpenDoc(+a.dataset.dd2)});
  const qi=m.querySelector("#kk-q");if(qi)qi.oninput=()=>{KKX.q=qi.value;clearTimeout(KKX.qt);KKX.qt=setTimeout(()=>{renderMain();const x=document.getElementById("kk-q");if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length)}},250)};
  m.querySelectorAll("[data-tg]").forEach(b=>b.onclick=async()=>{const x=T[+b.dataset.tg],go=b.dataset.a==="go";
    const g=prompt(go?"Gỡ treo "+x.item+": ghi nguyên nhân đã tìm ra / phiếu đã lập":"Hạch toán dòng treo "+x.item+" vào chi phí: ghi chú");if(g===null)return;
    try{await kApi("/dc/"+x.doc_id+"/treo",{method:"POST",body:JSON.stringify({item:x.item,action:go?"go":"ht",ghi_chu:g})});toast(go?"Đã gỡ treo":"Đã hạch toán");kkReload()}catch(e){toast(e.message)}});
  const on=(id,f)=>{const b=m.querySelector("#"+id);if(b)b.onclick=f};
  on("kk-new",()=>khoForm("TB"));on("kk-up",kkUpload);on("kk-td",()=>khoTdImport());
  on("kk-tpl",async()=>{try{await kkTemplate()}catch(e){toast(e.message)}});
  on("kk-tdtpl",async()=>{try{await khoTdTemplate()}catch(e){toast(e.message)}});
}

/* Mở phiếu kiểm tồn: bảng chênh lệch + lập phiếu điều chỉnh. */
async function kkOpen(id){
  kkCss();let r;try{r=await kApi("/kk/"+id)}catch(e){toast(e.message);return}
  const kt=kkKeToan(),lech=r.rows.filter(x=>x.cl!==0),val=x=>x.gia!=null?x.cl*x.gia:null;
  const thua=lech.filter(x=>x.cl>0),thieu=lech.filter(x=>x.cl<0),sv=a=>a.reduce((s,x)=>s+(val(x)||0),0);
  const edit=!r.dc&&kt&&r.doc.status==="OK";
  const row=x=>{const it=KHO.items.get(x.item)||{name:"",unit:""};return `<tr class="kk-r" data-l="${x.cl?1:0}" data-s="${esc(kfold(x.item+" "+it.name))}"${x.cl?"":" hidden"}><td class="mono">${esc(x.item)}</td><td>${esc(it.name)}<span class="kk-sub">${esc(it.unit)}</span></td><td class="n">${knum(x.so)}</td><td class="n"><b>${knum(x.dem)}</b></td><td class="n">${x.cl===0?pill("Khớp","grn"):x.cl>0?pill("+"+knum(x.cl),"blu"):pill(knum(x.cl),"red")}</td><td class="n">${x.cl&&val(x)!=null?kkMoney(val(x)):""}</td>
    <td>${x.cl&&edit?`<input type="checkbox" class="kk-tr" data-i="${esc(x.item)}">`:""}</td><td>${x.cl&&edit?`<input class="kk-ly" data-i="${esc(x.item)}" placeholder="Lý do">`:esc(x.note||"")}</td></tr>`};
  openDrawerHTML(`<h2>${esc(r.doc.no)} · Phiếu kiểm tồn ngày ${kDd(r.doc.doc_date)} ${r.doc.status!=="OK"?pill("Đã hủy","gry"):r.dc?pill("Đã điều chỉnh","grn"):lech.length?pill("Chờ điều chỉnh","amb"):pill("Khớp sổ","grn")}</h2>
   <div class="kk-kp"><div><b>${nf(r.rows.length)}</b><span>mã đã đếm</span></div><div><b>${nf(r.rows.length-lech.length)}</b><span>khớp sổ</span></div><div><b style="color:#4f46e5">${nf(thua.length)}</b><span>thừa · ${kkMoney(sv(thua))}</span></div><div><b style="color:#c62f3a">${nf(thieu.length)}</b><span>thiếu · ${kkMoney(sv(thieu))}</span></div></div>
   ${r.dc?`<div class="note">Đã điều chỉnh bằng phiếu <a href="#" class="lnk" id="kk-dc">${esc(r.dc.no)}</a>. Số sổ dưới đây là trước điều chỉnh. Muốn làm lại thì hủy phiếu điều chỉnh rồi lập lại.</div>`:""}
   <div class="kk-bar" style="padding:6px 0"><div class="kk-seg"><button class="on" data-v="l">Chỉ mã lệch (${lech.length})</button><button data-v="a">Tất cả (${r.rows.length})</button></div><span class="sp"></span><input class="kk-q" id="kk-dq" placeholder="Tìm mã hoặc tên…"></div>
   <div class="tbl"><table><thead><tr><th>Mã</th><th>Tên</th><th class="n">Sổ</th><th class="n">Đếm</th><th class="n">Chênh</th><th class="n">Giá trị</th><th>Treo</th><th style="width:26%">Lý do</th></tr></thead><tbody>${r.rows.map(row).join("")}</tbody></table></div>
   ${lech.length?"":`<p class="kk-empty">Số đếm khớp sổ, không cần điều chỉnh.</p>`}
   <div class="kk-foot"><span class="hint">${edit&&lech.length?`${lech.length} dòng sẽ điều chỉnh. Tích Treo: vẫn vào kho theo số đếm, tiền chưa hạch toán chi phí.`:"Số sổ = tồn trên web đến hết ngày đếm."}</span><span style="flex:1"></span><button class="btn" id="kk-base">Phiếu gốc / in / hủy</button>${edit&&lech.length?`<button class="btn pri" id="kk-go">Lập phiếu điều chỉnh</button>`:""}</div>`);
  let mode="l";const flt=()=>{const q=kfold(($("#kk-dq")||{}).value||"");document.querySelectorAll("#drawer .kk-r").forEach(tr=>tr.hidden=(mode==="l"&&tr.dataset.l!=="1")||(q&&!tr.dataset.s.includes(q)))};
  document.querySelectorAll("#drawer [data-v]").forEach(b=>b.onclick=()=>{mode=b.dataset.v;document.querySelectorAll("#drawer [data-v]").forEach(x=>x.classList.toggle("on",x===b));flt()});
  $("#kk-dq").oninput=flt;
  if($("#kk-dc"))$("#kk-dc").onclick=e=>{e.preventDefault();khoOpenDoc(r.dc.id)};
  $("#kk-base").onclick=()=>kkOrig(id);
  if($("#kk-go"))$("#kk-go").onclick=async()=>{
    const treo={},ly={};document.querySelectorAll("#drawer .kk-ly").forEach(i=>{if(i.value.trim())ly[i.dataset.i]=i.value.trim()});
    document.querySelectorAll("#drawer .kk-tr").forEach(c=>{if(c.checked)treo[c.dataset.i]=ly[c.dataset.i]||""});
    if(!confirm(`Lập phiếu điều chỉnh ${lech.length} dòng${Object.keys(treo).length?" ("+Object.keys(treo).length+" dòng treo)":""}? Tồn ngày ${kDd(r.doc.doc_date)} sẽ theo số đếm.`))return;
    $("#kk-go").disabled=true;
    try{const x=await kApi("/kk/"+id+"/dieu-chinh",{method:"POST",body:JSON.stringify({treo,ly_do:ly})});toast("Đã lập phiếu "+x.no);KHO.at=0;KHO.nxt=null;await khoLoad(true);kkReload();kkOpen(id)}
    catch(e){$("#kk-go").disabled=false;toast(e.message)}};
}
/* File mẫu kiểm tồn: mọi mã đang dùng, điền số đếm + đơn giá vào ô vàng; mã không đếm thì để trống. */
async function kkTemplate(){
  await khoLoadExcelJS();
  const wb=new ExcelJS.Workbook(),thin={style:"thin",color:{argb:"FFB8C0CC"}},bd={top:thin,left:thin,bottom:thin,right:thin},solid=h=>({type:"pattern",pattern:"solid",fgColor:{argb:"FF"+h}});
  const ORD=["NVL","BTP","TP","HH","CCDC"];
  const A=[...KHO.items.values()].filter(i=>i.active&&ORD.includes(i.cls)).sort((a,b)=>ORD.indexOf(a.cls)-ORD.indexOf(b.cls)||String(a.grp||"").localeCompare(String(b.grp||""),"vi")||a.name.localeCompare(b.name,"vi"));
  const ws=wb.addWorksheet("KIEM_TON",{views:[{state:"frozen",ySplit:4}]});
  ws.columns=[{width:22},{width:50},{width:9},{width:24},{width:18},{width:16},{width:30}];
  ws.mergeCells("A1:G1");const t=ws.getCell("A1");t.value="PHIẾU KIỂM TỒN";t.font={name:"Arial",size:16,bold:true,color:{argb:"FFFFFFFF"}};t.fill=solid("1B2A49");t.alignment={vertical:"middle",horizontal:"center"};ws.getRow(1).height=30;
  ws.mergeCells("A2:G2");const h=ws.getCell("A2");h.value="Điền SỐ LƯỢNG ĐẾM và ĐƠN GIÁ vào các ô màu vàng. Mã không đếm thì để trống (không ghi 0). Đếm được 0 thì ghi 0. Không sửa cột Mã. Ngày đếm chọn trên web khi tải lên.";h.font={name:"Arial",size:10,italic:true,color:{argb:"FF4A5568"}};h.alignment={wrapText:true,vertical:"middle"};ws.getRow(2).height=34;
  const head=ws.getRow(4);["Mã","Tên","ĐVT","Nhóm","Số lượng đếm","Đơn giá","Ghi chú"].forEach((x,i)=>{const c=head.getCell(i+1);c.value=x;c.font={name:"Arial",bold:true,color:{argb:"FFFFFFFF"}};c.fill=solid("1B2A49");c.border=bd;c.alignment={horizontal:"center",vertical:"middle"}});head.height=24;
  A.forEach((it,k)=>{const row=ws.getRow(5+k);row.getCell(1).value=it.code;row.getCell(2).value=it.name;row.getCell(3).value=it.unit;row.getCell(4).value=(KHO_CLS[it.cls]||it.cls)+(it.grp?" · "+it.grp:"");
    for(let c=1;c<=7;c++){const x=row.getCell(c);x.border=bd;x.font={name:"Arial",size:10};x.fill=solid(c===5||c===6?"FFF59D":k%2?"F4F6FA":"FFFFFF")}
    row.getCell(1).font={name:"Consolas",size:10};row.getCell(5).numFmt="#,##0.###";row.getCell(6).numFmt="#,##0"});
  const buf=await wb.xlsx.writeBuffer(),a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));a.download="Mau_kiem_ton.xlsx";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
/* Tải phiếu kiểm tồn từ Excel (file mẫu hoặc bảng có cột Mã, Số lượng đếm, Đơn giá). */
function kkUpload(){
  openDrawerHTML(`<h2>Tải phiếu kiểm tồn từ Excel</h2><p class="hint">Dùng file mẫu kiểm tồn, hoặc bảng có cột Mã, Số lượng đếm, Đơn giá. Chỉ dòng có số đếm mới vào phiếu. Xem trước rồi mới ghi.</p>
   <div class="row7"><label class="field">Ngày đếm<input type="date" id="ku-d" value="${kToday()}"></label><label class="btn pri">Chọn file Excel<input type="file" id="ku-f" accept=".xlsx,.xls" hidden></label></div><div id="ku-out"></div>`);
  $("#ku-f").onchange=async e=>{const file=e.target.files[0];if(!file)return;const out=$("#ku-out");
    try{if(typeof XLSX==="undefined")throw new Error("Chưa tải được thư viện đọc Excel");
      const raw=khoParseTdFile(XLSX.read(await file.arrayBuffer(),{type:"array"}));
      const good=new Map(),bad=[],unknown=[],dup=[];
      raw.forEach(r=>{if(!Number.isFinite(r.qty)||r.qty<0){bad.push(r);return}const m=khoTdResolve(r.raw);if(!m.code){unknown.push(r);return}
        if(good.has(m.code)){dup.push(r);good.get(m.code).qty+=r.qty;return}good.set(m.code,{item:m.code,qty:r.qty,price:Number.isFinite(r.price)?r.price:undefined})});
      const L=[...good.values()],miss=a=>a.slice(0,15).map(r=>esc(r.raw)+" (dòng "+r.line+")").join(", ");
      out.innerHTML=`<div class="grid kpis">${kpi("Mã ghi được",L.length)}${kpi("Không ra mã",unknown.length)}${kpi("Số lỗi",bad.length)}${kpi("Mã lặp (đã cộng)",dup.length)}</div>
       ${unknown.length?`<div class="note amb">Không tìm ra mã: ${miss(unknown)}</div>`:""}${bad.length?`<div class="note amb">Số đếm không đọc được: ${miss(bad)}</div>`:""}
       ${L.length?tbl(["Mã","Tên","ĐVT","Số đếm","Đơn giá","Tồn sổ hiện tại"],L.slice(0,300).map(g=>{const it=KHO.items.get(g.item);return `<tr><td class="mono">${esc(g.item)}</td><td>${esc(it.name)}</td><td>${esc(it.unit)}</td><td class="n"><b>${knum(g.qty)}</b></td><td class="n">${g.price!=null?nf(g.price):"—"}</td><td class="n">${knum(khoStock(g.item))}</td></tr>`}))+`<div class="row7"><button class="btn pri" id="ku-ok">Ghi phiếu kiểm tồn (${L.length} mã)</button></div>`:`<p class="hint">Không có dòng nào có số đếm.</p>`}`;
      if($("#ku-ok"))$("#ku-ok").onclick=async()=>{const d=$("#ku-d").value;if(!d){toast("Chọn ngày đếm");return}$("#ku-ok").disabled=true;
        try{const r=await kApi("/docs",{method:"POST",body:JSON.stringify({type:"KK",date:d,note:"Tải từ file "+file.name,lines:L})});toast("Đã ghi phiếu "+r.no);kkReload();kkOpen(r.id)}catch(err){$("#ku-ok").disabled=false;toast(err.message)}};
    }catch(err){out.innerHTML=`<div class="note red">Chưa đọc được file: ${esc(err.message)}</div>`}finally{e.target.value=""}};
}
/* Phiếu gốc (xem / in / hủy) dùng màn chung; phiếu tồn chờ duyệt có nút CEO duyệt, phiếu tồn sau mốc có nút đổi thành phiếu kiểm tồn. */
const kkOrig=khoOpenDoc;
khoOpenDoc=async function(id,w){
  let d=null;try{d=(await kApi("/docs/"+id)).doc}catch(e){}
  if(d&&d.type==="KK"&&!w)return kkOpen(id);
  await kkOrig(id,w);if(PAGE==="kho_kk")kkReload();
  if(!d||d.type!=="TD"||ME.role!=="admin")return;
  const h=document.querySelector("#drawerIn h2");if(!h)return;
  const moc=typeof KTON!=="undefined"&&KTON.moc?KTON.moc.moc:null;
  if(d.status==="CHO")h.insertAdjacentHTML("afterend",`<div class="note amb">Phiếu tồn đầu kỳ do Kế toán lập, đang chờ CEO duyệt. Duyệt xong mới vào sổ${kkEx(d).moc?" và thành mốc đầu của sổ":""}. <button class="btn pri" id="kk-duyet">CEO duyệt</button></div>`);
  else if(d.status==="OK"&&moc&&d.doc_date>moc)h.insertAdjacentHTML("afterend",`<div class="note">Phiếu tồn sau mốc đầu đang ghi đè sổ các mã trong phiếu. <button class="btn" id="kk-tokk">Đổi thành phiếu kiểm tồn</button> (ra bảng chênh lệch để lập phiếu điều chỉnh)</div>`);
  if($("#kk-duyet"))$("#kk-duyet").onclick=async()=>{try{await kApi("/docs/"+id+"/duyet",{method:"POST",body:"{}"});toast("Đã duyệt");KHO.at=0;KHO.list={};if(typeof ktonLoad==="function")ktonLoad(true);await khoLoad(true);kkReload();khoOpenDoc(id)}catch(e){toast(e.message)}};
  if($("#kk-tokk"))$("#kk-tokk").onclick=async()=>{if(!confirm("Đổi phiếu "+d.no+" thành phiếu kiểm tồn? Sổ các mã trong phiếu sẽ tính liên tục, chênh lệch xử lý bằng phiếu điều chỉnh."))return;
    try{await kApi("/docs/"+id+"/to-kk",{method:"POST",body:"{}"});toast("Đã đổi");KHO.at=0;KHO.list={};await khoLoad(true);kkReload();kkOpen(id)}catch(e){toast(e.message)}};
};
PAGES.kho_kk=pKkPage;
