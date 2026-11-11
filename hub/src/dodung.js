/* =====================================================================
   ĐỒ DÙNG VĂN PHÒNG & NHÀ MÁY (chị Hoa duyệt demo 11/11/2026): thiết bị quay, công cụ dụng cụ, hàng mẫu, đồ tiêu hao. HCNS quản lý.
   - Máy chủ: /api/hub/dodung (src/server/routes/doDung.ts). Xem theo nơi: Văn phòng / Nhà máy (nút chọn trên đầu mỗi trang).
   - Lấy – trả đồ: ký mượn / trả bằng bấm trên web (HCNS giao, người lấy bấm "Đã nhận"; người lấy khai trả, HCNS nhận lại).
   - Hàng mẫu: Lead phòng duyệt → kho thành phẩm lập Phiếu xuất kho thật (XK, lý do "Hàng mẫu Marketing", số tham chiếu = mã yêu cầu)
     → HCNS nhận về. Hàng thừa để lại kệ văn phòng.
   - Đề nghị mua: Lead phòng → Quản lý mua hàng duyệt → mua về: nhập tồn + phiếu chi nháp ở Sổ chi phí (D().pcCho, kế toán xác nhận,
     từ ngưỡng CEO duyệt như mọi phiếu chi). Thiết bị / công cụ từ 2 triệu một cái: nhóm G28 để kế toán ghi tăng ở Tài sản & CCDC.
   - Đồ tiêu hao không ghi từng lần lấy: HCNS kiểm kê, chênh lệch là đã dùng.
   Tên toàn cục bắt đầu bằng "dd".
   ===================================================================== */
const ddApi=(p,o)=>svApi("/api/hub/dodung"+p,o);
const ddPost=(p,b)=>ddApi(p,{method:"POST",body:JSON.stringify(b||{})});
const DD_LOAI={tb:"Thiết bị quay",cc:"Công cụ dụng cụ",mau:"Hàng mẫu",th:"Đồ tiêu hao"};
const DD_NOI={vp:"Văn phòng",nm:"Nhà máy"};
const DDS={d:null,at:0,busy:null,err:"",cho:null,choAt:0,loai:"",q:"",tab:{lay:"dang",mau:"cho",mua:"cho"}};
try{DDS.noi=localStorage.getItem("dd_noi")||"vp"}catch(e){DDS.noi="vp"}
if(typeof PERMS!=="undefined"&&!PERMS.some(g=>g[0]==="Đồ dùng văn phòng"))PERMS.push(["Đồ dùng văn phòng",[["dodung.quanly","Quản lý đồ dùng, thiết bị, hàng mẫu (như HCNS), ví dụ người giữ kho đồ ở nhà máy"]]]);

const ddToday=()=>new Date(Date.now()+7*3600e3).toISOString().slice(0,10);
const ddN=v=>(Math.round((+v||0)*1000)/1000).toLocaleString("vi-VN");
const ddDmy=s=>s?String(s).slice(0,10).split("-").reverse().join("/"):"";
const ddHan=s=>s?ddDmy(s)+(String(s).length>10?" "+String(s).slice(11,16):""):"—";
const ddMe=()=>(DDS.d&&DDS.d.me)||{};
const ddHrU=u=>!!u&&(u.role==="admin"||u.phongBan==="HCNS"||can(u,"nhansu.quanly")||can(u,"dodung.quanly"));
function ddRerender(){if(typeof svTyping==="function"&&svTyping())return;if(document.querySelector("#drawer:not([hidden])"))return;if(typeof renderMain==="function")renderMain()}
function ddLoad(force){
  if(!force&&DDS.d&&Date.now()-DDS.at<45000)return Promise.resolve(DDS.d);
  if(DDS.busy&&!force)return DDS.busy;
  DDS.busy=ddApi("/all").then(d=>{DDS.d=d;DDS.at=Date.now();DDS.err="";DDS.busy=null;return d}).catch(e=>{DDS.busy=null;DDS.err=e.message;throw e});
  return DDS.busy;
}
function ddCho(){if(Date.now()-DDS.choAt<180000)return DDS.cho;DDS.choAt=Date.now();ddApi("/cho").then(x=>{DDS.cho=x}).catch(()=>{});return DDS.cho}
const ddRe=async(t)=>{await ddLoad(true).catch(()=>{});DDS.choAt=0;ddCho();if(t)toast(t);renderMain()};
const ddErr=e=>{toast(e&&e.message||"Có lỗi");};
const ddIt=id=>(DDS.d&&DDS.d.items.find(i=>i.id===id))||{ten:"(đã xóa)",dvt:"",loai:"",ton:{vp:0,nm:0}};
const ddMuonTra=l=>l==="tb"||l==="cc";
const ddMuon=(id,noi)=>((DDS.d&&DDS.d.lay)||[]).filter(p=>p.noi===noi&&["dang","tra_cho"].includes(p.st)).flatMap(p=>p.lines.filter(l=>l.item_id===id).map(l=>({sl:l.sl,p})));
const ddDangMuon=(id,noi)=>ddMuon(id,noi).reduce((t,x)=>t+x.sl,0);
const ddSt=(i,noi)=>{const ton=i.ton[noi]||0,min=i["min_"+noi]||0;
  if(ddMuonTra(i.loai)){const m=ddDangMuon(i.id,noi);return m?(ton<=0?pill("Đang mượn hết","amb"):pill(m+" đang mượn","blu")):ton>0?pill("Sẵn","grn"):pill("Không có","gry")}
  return ton<=0?pill("Hết","red"):min&&ton<min?pill("Sắp hết","amb"):pill("Đủ","grn")};
const ddShootTxt=s=>`${typeof dayLbl==="function"?dayLbl(s.day):"Ngày "+s.day}${s.gio?" · "+s.gio:""}${s.diaDiem?" · "+s.diaDiem:""}`;
function ddShoots(){const t=(D().settings||{}).today||0;
  return (D().shoots||[]).filter(s=>s.trangThai!=="Đã hủy"&&s.day>=t-1).sort((a,b)=>a.day-b.day||(a.gio||"").localeCompare(b.gio||""))
    .map(s=>({id:s.id,txt:ddShootTxt(s)+((s.nguoi||[]).length?" · "+(s.nguoi||[]).map(id=>(D().users.find(u=>u.id===id)||{}).name||"").filter(Boolean).join(", "):""),mine:(s.nguoi||[]).includes(ME.id)}))
    .sort((a,b)=>(b.mine?1:0)-(a.mine?1:0))}
const ddCrm=()=>D().users.filter(u=>u.active!==false&&u.crm).map(u=>[u.crm,u.name]);

/* ---------- khung chung ---------- */
function ddFrame(m,title,sub,body){
  if(!DDS.d){m.innerHTML=H(title,sub)+(DDS.err?`<div class="note red">${esc(DDS.err)}</div>`:`<p class="hint">Đang tải…</p>`);ddLoad().then(ddRerender).catch(()=>ddRerender());return false}
  m.innerHTML=H(title,sub)+`<div class="filters" style="gap:6px;margin-bottom:12px">${Object.entries(DD_NOI).map(([k,t])=>`<button class="btn sm${DDS.noi===k?" pri":""}" data-ddnoi="${k}">${t}</button>`).join("")}<span class="hint" style="margin:0 0 0 6px">Đang xem đồ ở ${DD_NOI[DDS.noi]}</span></div>`+body();
  m.querySelectorAll("[data-ddnoi]").forEach(b=>b.onclick=()=>{DDS.noi=b.dataset.ddnoi;try{localStorage.setItem("dd_noi",DDS.noi)}catch(e){}renderMain()});
  m.querySelectorAll("[data-ddtab]").forEach(b=>b.onclick=()=>{const[k,v]=b.dataset.ddtab.split(":");DDS.tab[k]=v;renderMain()});
  m.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{PAGE=b.dataset.go;render();scrollTo(0,0)});
  if(!document.getElementById("dd-css")){const s=document.createElement("style");s.id="dd-css";s.textContent=DD_CSS;document.head.appendChild(s)}
  return true;
}
const DD_CSS=`.ddrow{display:flex;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--line,#ece9f7)}.ddrow>div{flex:1;font-size:13.5px}
@media(max-width:760px){table.ddt{min-width:0!important;width:100%}table.ddt thead{display:none}table.ddt tr{display:block;border-bottom:1px solid #ece9f7;padding:10px 12px}table.ddt td{display:inline-block;border:0!important;padding:2px 8px 2px 0!important;text-align:left!important;font-size:13px;vertical-align:top}table.ddt td:first-child{display:block;font-weight:700}table.ddt td.ddact{display:block;padding-top:6px!important}}`;
const ddTabs=(k,L)=>L.map(([v,t,n])=>`<button class="btn sm${DDS.tab[k]===v?" pri":""}" data-ddtab="${k}:${v}">${t}${n?` <b>${n}</b>`:""}</button>`).join("");
const ddOpen=html=>{$("#drawerIn").innerHTML=html;$("#drawer").hidden=false};
const ddBtns=L=>L.map(([t,a,cls])=>`<button class="btn sm${cls?" "+cls:""}" data-dda="${a}">${t}</button>`).join(" ");
function ddWireActs(m,fn){m.querySelectorAll("[data-dda]").forEach(b=>b.onclick=e=>{e.stopPropagation();fn(b.dataset.dda,b)})}

/* ---------- 1. Tổng quan ---------- */
function pDdTq(m){
  ddFrame(m,"Tổng quan đồ dùng","Thiết bị quay, công cụ dụng cụ, hàng mẫu, đồ tiêu hao · HCNS quản lý",()=>{
    const d=DDS.d,n=DDS.noi,I=d.items.filter(i=>i.active),dang=d.lay.filter(p=>p.noi===n&&["dang","tra_cho"].includes(p.st)),tre=dang.filter(p=>p.qua_han);
    const sap=I.filter(i=>!ddMuonTra(i.loai)&&i["min_"+n]&&i.ton[n]<i["min_"+n]),cho=d.lay.filter(p=>p.noi===n&&p.st==="cho");
    const mau=d.mau.filter(x=>x.noi===n&&["lead","kho"].includes(x.st)),mua=d.mua.filter(x=>x.noi===n&&["lead","ql","mua"].includes(x.st));
    const gtri=I.filter(i=>ddMuonTra(i.loai)).reduce((t,i)=>t+((i.ton[n]||0)+ddDangMuon(i.id,n))*(i.gia||0),0);
    const todo=[...cho.map(p=>[`<b>${p.id}</b> ${esc(p.user_name)} xin lấy đồ${p.shoot_txt?" · "+esc(p.shoot_txt):""}`,"vp_lay","Giao đồ"]),
      ...dang.filter(p=>p.st==="tra_cho").map(p=>[`<b>${p.id}</b> ${esc(p.user_name)} đã khai trả, chờ nhận lại`,"vp_lay","Nhận lại"]),
      ...mau.filter(x=>x.st==="kho"&&x.xk).map(x=>[`<b>${x.id}</b> kho đã xuất ${ddN(x.xk.sl)} ${esc(x.kho_ten)}, chưa nhận về`,"vp_mau","Nhận hàng"]),
      ...mua.filter(x=>x.st==="mua").map(x=>[`<b>${x.id}</b> ${esc(x.ten)} đã duyệt, chờ mua`,"vp_mua","Ghi mua về"]),
      ...sap.map(i=>[`<b>${esc(i.ten)}</b> còn ${ddN(i.ton[n])} ${esc(i.dvt)} (mức tối thiểu ${ddN(i["min_"+n])})`,"vp_mua","Đề nghị mua"]),
      ...tre.map(p=>[`<b>${p.id}</b> quá hạn trả · ${esc(p.user_name)}`,"vp_lay","Xem"])];
    return `<div class="grid kpis">${kpi("Đồ đang cho mượn",dang.reduce((t,p)=>t+p.lines.filter(l=>ddMuonTra(ddIt(l.item_id).loai)).reduce((a,l)=>a+l.sl,0),0),dang.length+" phiếu chưa trả")}${kpi("Quá hạn trả",tre.length,tre.map(p=>p.id).join(", ")||"không có",tre.length?"var(--red)":"")}${kpi("Đồ sắp hết",sap.length,sap.map(i=>i.ten).slice(0,3).join(", ")||"đủ cả",sap.length?"var(--orange)":"")}${kpi("Yêu cầu hàng mẫu đang chạy",mau.length,mau.filter(x=>x.st==="kho").length+" ở bước kho")}${kpi("Đề nghị mua đang chạy",mua.length,mua.filter(x=>x.st!=="mua").length+" chờ duyệt")}${kpi("Giá trị thiết bị & CCDC",ddN(gtri)+" đ","theo giá mua")}</div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">
    <section class="card"><div class="card-h"><h2>Cần làm</h2></div>${todo.map(([t,g,b])=>`<div class="ddrow"><div>${t}</div><button class="btn sm" data-go="${g}">${b}</button></div>`).join("")||'<p class="hint">Không có việc gì.</p>'}</section>
    <section class="card"><div class="card-h"><h2>Đang mượn</h2><span class="sp"></span><button class="lnk" data-go="vp_lay">Xem hết</button></div>
    ${dang.map(p=>`<div class="ddrow"><div><b>${p.id}</b> ${p.qua_han?pill("Quá hạn","red"):pill("Hạn "+ddHan(p.han),"blu")}<div class="hint" style="margin:2px 0">${esc(p.user_name)}${p.shoot_txt?" · "+esc(p.shoot_txt):p.muc_dich?" · "+esc(p.muc_dich):""}</div>${p.lines.map(l=>ddN(l.sl)+" "+esc(ddIt(l.item_id).ten)).join(" · ")}</div></div>`).join("")||'<p class="hint">Không có đồ nào đang mượn.</p>'}</section></div>`});
}

/* ---------- 2. Danh mục & tồn ---------- */
function pDdTon(m){
  const ok=ddFrame(m,"Đồ dùng & thiết bị","Còn bao nhiêu, để ở đâu, ai đang giữ",()=>{
    const d=DDS.d,n=DDS.noi,q=foldName(DDS.q),hr=ddMe().hr;
    const L=d.items.filter(i=>i.active&&(!DDS.loai||i.loai===DDS.loai)&&(!q||foldName(i.ten+" "+i.ma).includes(q))&&(i.ton[n]||ddDangMuon(i.id,n)||i["min_"+n]||i["cho_"+n]||DDS.q||DDS.all));
    return `<div class="filters" style="gap:6px"><button class="btn sm${!DDS.loai?" pri":""}" data-ddloai="">Tất cả</button>${Object.entries(DD_LOAI).map(([k,t])=>`<button class="btn sm${DDS.loai===k?" pri":""}" data-ddloai="${k}">${t}</button>`).join("")}
     <input id="dd-q" placeholder="Tìm tên, mã" value="${esc(DDS.q)}" style="max-width:200px;margin-left:auto"><label class="inl"><input type="checkbox" id="dd-all"${DDS.all?" checked":""}> Cả đồ chưa có ở ${DD_NOI[n]}</label>${hr?`<button class="btn pri" id="dd-them">＋ Thêm đồ</button><button class="btn" id="dd-kk">Kiểm kê</button>`:""}</div>
    <section class="card flush"><div class="tbl"><table class="ddt"><thead><tr><th>Mã</th><th>Tên</th><th>Loại</th><th class="n">Trên kệ</th><th class="n">Đang mượn</th><th>Ai đang giữ</th><th>Để ở đâu</th><th class="n">Mức tối thiểu</th><th>Trạng thái</th></tr></thead><tbody>
    ${L.map(i=>{const mu=ddMuon(i.id,n);return `<tr data-ddi="${i.id}" style="cursor:pointer"><td class="mono">${esc(i.ma)}</td><td><b>${esc(i.ten)}</b>${i.ts_ma?`<div class="hint" style="margin:0">Sổ CCDC kế toán: ${esc(i.ts_ma)}</div>`:""}${i.loai==="mau"?`<div class="hint" style="margin:0">Mã kho thành phẩm ${esc(i.kho_code||"")}</div>`:""}</td><td>${DD_LOAI[i.loai]}</td><td class="n">${ddN(i.ton[n])} ${esc(i.dvt)}</td><td class="n">${ddMuonTra(i.loai)?ddN(ddDangMuon(i.id,n)):"—"}</td><td>${mu.map(x=>`${esc(x.p.user_name)} ${ddN(x.sl)}`).join(", ")||'<span class="hint">—</span>'}</td><td>${esc(i["cho_"+n]||"")}</td><td class="n">${i["min_"+n]?ddN(i["min_"+n]):"—"}</td><td>${ddSt(i,n)}</td></tr>`}).join("")||`<tr><td colspan="9" class="hint">Chưa có đồ nào ở ${DD_NOI[n]}.${hr?" Bấm ＋ Thêm đồ để khai báo.":""}</td></tr>`}</tbody></table></div></section>
    <p class="hint">Đồ tiêu hao (giấy ăn, giấy in, nước…) không ghi từng lần lấy: HCNS kiểm kê, số chênh coi là đã dùng. Hàng mẫu lấy từ kho thành phẩm qua Yêu cầu hàng mẫu.</p>`});
  if(!ok)return;
  m.querySelectorAll("[data-ddloai]").forEach(b=>b.onclick=()=>{DDS.loai=b.dataset.ddloai;renderMain()});
  const q=$("#dd-q");if(q)q.oninput=()=>{DDS.q=q.value;const p=q.selectionStart;renderMain();const x=$("#dd-q");if(x){x.focus();x.setSelectionRange(p,p)}};
  $("#dd-all").onchange=e=>{DDS.all=e.target.checked;renderMain()};
  m.querySelectorAll("[data-ddi]").forEach(r=>r.onclick=()=>ddThe(r.dataset.ddi));
  if($("#dd-them"))$("#dd-them").onclick=()=>ddFormItem();
  if($("#dd-kk"))$("#dd-kk").onclick=()=>ddKiemKe();
}
function ddFormItem(it){if(typeof khoLoad==="function"&&!(KHO.items&&KHO.items.size)&&!DDS.khoTry){DDS.khoTry=1;khoLoad().catch(()=>{})}
  const n=DDS.noi,e=!!it;it=it||{loai:DDS.loai||"tb",dvt:"cái",gia:0,min_vp:0,min_nm:0,cho_vp:"",cho_nm:""};
  ddOpen(`<h2>${e?"Sửa "+esc(it.ten):"Thêm đồ vào danh mục"}</h2><form class="frm" id="ddf" onsubmit="return false">
   <div class="row4"><label class="field">Loại<select id="ddf-loai"${e?" disabled":""}>${opt(Object.entries(DD_LOAI),it.loai)}</select></label>
   <label class="field" style="grid-column:span 2" id="ddf-tenw">Tên<input id="ddf-ten" value="${esc(it.ten||"")}" placeholder="VD: Đèn LED 60W"></label>
   <label class="field" id="ddf-khow" hidden>Mã kho thành phẩm<input id="ddf-kho" list="ddf-khol" placeholder="Gõ mã hoặc tên"><datalist id="ddf-khol">${typeof KHO!=="undefined"&&KHO.items?[...KHO.items.values()].filter(x=>["TP","HH","COMBO"].includes(x.cls)&&x.active!==0).map(x=>`<option value="${esc(x.code)}">${esc(x.name)}</option>`).join(""):""}</datalist></label>
   <label class="field">Đơn vị<input id="ddf-dvt" value="${esc(it.dvt)}"></label></div>
   <div class="row4"><label class="field">Giá mua 1 cái (đ)<input id="ddf-gia" type="number" value="${it.gia||0}"></label><label class="field">Mã ở Sổ CCDC kế toán (nếu có)<input id="ddf-ts" value="${esc(it.ts_ma||"")}"></label></div>
   ${Object.entries(DD_NOI).map(([k,t])=>`<div class="row4"><label class="field">${e?"":"Đang có ở "+t}${e?`<span>${t}</span>`:`<input id="ddf-ton-${k}" type="number" value="0">`}</label><label class="field">Mức tối thiểu (${t})<input id="ddf-min-${k}" type="number" value="${it["min_"+k]||0}"></label><label class="field" style="grid-column:span 2">Để ở đâu (${t})<input id="ddf-cho-${k}" value="${esc(it["cho_"+k]||"")}" placeholder="VD: Tủ thiết bị P.Marketing"></label></div>`).join("")}
   <p class="hint">Mức tối thiểu chỉ dùng cho hàng mẫu và đồ tiêu hao: dưới mức thì Tổng quan nhắc lập đề nghị mua. Đồ mua qua Đề nghị mua thì web tự thêm vào danh mục.</p>
   <div id="ddf-e"></div><div class="filters" style="justify-content:flex-end">${e?`<button class="btn danger" id="ddf-an">Ngừng theo dõi</button>`:""}<button class="btn" onclick="closeDrawer()">Đóng</button><button class="btn pri" id="ddf-ok">Lưu</button></div></form>`);
  const sw=()=>{const mau=$("#ddf-loai").value==="mau"&&!e;$("#ddf-khow").hidden=!mau;$("#ddf-tenw").hidden=mau};$("#ddf-loai").onchange=sw;sw();
  if($("#ddf-an"))$("#ddf-an").onclick=async()=>{try{await ddApi("/item/"+it.id,{method:"PATCH",body:JSON.stringify({active:false})});closeDrawer();ddRe("Đã ngừng theo dõi "+it.ten)}catch(er){ddErr(er)}};
  $("#ddf-ok").onclick=async()=>{const b={ten:$("#ddf-ten").value,dvt:$("#ddf-dvt").value,gia:+$("#ddf-gia").value||0,ts_ma:$("#ddf-ts").value,min_vp:+$("#ddf-min-vp").value||0,min_nm:+$("#ddf-min-nm").value||0,cho_vp:$("#ddf-cho-vp").value,cho_nm:$("#ddf-cho-nm").value};
    try{if(e)await ddApi("/item/"+it.id,{method:"PATCH",body:JSON.stringify(b)});
      else await ddPost("/item",{...b,loai:$("#ddf-loai").value,kho_code:$("#ddf-kho").value.trim(),ton_vp:+$("#ddf-ton-vp").value||0,ton_nm:+$("#ddf-ton-nm").value||0});
      closeDrawer();ddRe("Đã lưu")}catch(er){$("#ddf-e").innerHTML=`<div class="note red">${esc(er.message)}</div>`}};
}
function ddKiemKe(){const n=DDS.noi,L=DDS.d.items.filter(i=>i.active&&(i.ton[n]||i["min_"+n]||i["cho_"+n]));
  ddOpen(`<h2>Kiểm kê đồ dùng · ${DD_NOI[n]}</h2><p class="hint">Đếm thực tế trên kệ (không tính đồ đang cho mượn). Đồ tiêu hao: số chênh coi là đã dùng. Thiết bị thiếu thì ghi lý do.</p>
   <label class="field" style="max-width:200px">Ngày kiểm<input type="date" id="ddk-d" value="${ddToday()}" max="${ddToday()}"></label>
   <div class="tbl"><table><thead><tr><th>Đồ</th><th class="n">Sổ</th><th class="n">Đếm được</th><th class="n">Chênh</th><th>Ghi chú</th></tr></thead><tbody>${L.map(i=>`<tr data-kid="${i.id}"><td>${esc(i.ten)}<div class="hint" style="margin:0">${DD_LOAI[i.loai]}</div></td><td class="n">${ddN(i.ton[n])}</td><td class="n"><input type="number" class="ddk-dem" value="${i.ton[n]}" data-so="${i.ton[n]}" style="width:76px;text-align:right"></td><td class="n ddk-c">0</td><td><input class="ddk-n" placeholder="${ddMuonTra(i.loai)?"VD: hỏng 1":""}"></td></tr>`).join("")}</tbody></table></div>
   <div id="ddk-e"></div><div class="filters" style="justify-content:flex-end;margin-top:12px"><button class="btn" onclick="closeDrawer()">Đóng</button><button class="btn pri" id="ddk-ok">Lưu kiểm kê</button></div>`);
  $$("#drawerIn .ddk-dem").forEach(x=>x.oninput=()=>{x.closest("tr").querySelector(".ddk-c").textContent=ddN(+x.value-+x.dataset.so)});
  $("#ddk-ok").onclick=async()=>{const lines=$$("#drawerIn tr[data-kid]").map(r=>({item_id:r.dataset.kid,dem:+r.querySelector(".ddk-dem").value,note:r.querySelector(".ddk-n").value}));
    try{const r=await ddPost("/kk",{noi:n,ngay:$("#ddk-d").value,lines});closeDrawer();ddRe(r.chenh?`Đã lưu, ${r.chenh} món có chênh lệch`:"Đã lưu, khớp sổ")}catch(er){$("#ddk-e").innerHTML=`<div class="note red">${esc(er.message)}</div>`}};
}
async function ddThe(id){const i=ddIt(id),n=DDS.noi,hr=ddMe().hr,mu=ddMuon(id,n);
  const K={dau:"Khai báo",kk:"Kiểm kê",giao:"Giao đi",tra:"Trả lại",hong:"Hỏng / mất",mau:"Kho xuất mẫu về",mua:"Mua về"};
  const draw=ls=>ddOpen(`<h2>${esc(i.ten)}</h2><p class="hint">${esc(i.ma)} · ${DD_LOAI[i.loai]}${i["cho_"+n]?" · để ở "+esc(i["cho_"+n]):""}</p>
   <div class="grid kpis">${Object.entries(DD_NOI).map(([k,t])=>kpi("Trên kệ "+t,ddN(i.ton[k])+" "+esc(i.dvt),ddMuonTra(i.loai)?ddN(ddDangMuon(id,k))+" đang mượn":"")).join("")}${i.gia?kpi("Giá mua",ddN(i.gia)+" đ"):""}</div>
   ${mu.length?`<p><b>Ai đang giữ:</b> ${mu.map(x=>`${esc(x.p.user_name)} ${ddN(x.sl)} (${x.p.id}, hạn ${ddHan(x.p.han)})`).join("; ")}</p>`:""}
   ${i.ts_ma?`<p class="hint">Có trong Sổ công cụ dụng cụ của kế toán (${esc(i.ts_ma)}): giá trị và phân bổ tính ở đó; ở đây theo dõi ai giữ, để đâu.</p>`:""}
   <h3>Lịch sử</h3><div class="tbl"><table><tbody>${ls?ls.map(r=>`<tr><td>${ddDmy(r.ngay)}</td><td>${DD_NOI[r.noi]}</td><td>${K[r.kind]||r.kind}${r.ref?" · "+esc(r.ref):""}<div class="hint" style="margin:0">${esc(r.note||"")} · ${esc(r.by_name||"")}</div></td><td class="n">${r.qty>0?"+":""}${ddN(r.qty)}</td></tr>`).join("")||'<tr><td class="hint">Chưa có</td></tr>':'<tr><td class="hint">Đang tải…</td></tr>'}</tbody></table></div>
   ${hr?`<div id="ddh" hidden><div class="row4"><label class="field">Số lượng<input type="number" id="ddh-sl" value="1"></label><label class="field" style="grid-column:span 3">Lý do<input id="ddh-ly" placeholder="Hỏng gì / mất ở đâu"></label></div><div id="ddh-e"></div><p><button class="btn pri" id="ddh-ok">Ghi hỏng / mất (${DD_NOI[n]})</button></p></div>`:""}
   <div class="filters" style="justify-content:flex-end;margin-top:12px">${hr?`<button class="btn" id="ddt-h">Báo hỏng / mất</button><button class="btn" id="ddt-s">Sửa</button>`:""}<button class="btn" onclick="closeDrawer()">Đóng</button></div>`);
  const wire=()=>{if(!hr)return;$("#ddt-s").onclick=()=>ddFormItem(i);$("#ddt-h").onclick=()=>{$("#ddh").hidden=false};
    $("#ddh-ok").onclick=async()=>{try{await ddPost("/hong",{item_id:id,noi:n,sl:+$("#ddh-sl").value,ly_do:$("#ddh-ly").value});closeDrawer();ddRe("Đã ghi")}catch(er){$("#ddh-e").innerHTML=`<div class="note red">${esc(er.message)}</div>`}}};
  draw(null);wire();try{const ls=await ddApi("/item/"+id);if(!$("#drawer").hidden){draw(ls);wire()}}catch(e){}
}

/* ---------- 3. Lấy – trả đồ ---------- */
const DD_LAY_ST={cho:["Chờ HCNS giao","amb"],dang:["Đang mượn","blu"],tra_cho:["Đã khai trả, chờ nhận lại","vio"],tra:["Đã trả","grn"],huy:["Đã hủy","gry"]};
function pDdLay(m){
  const ok=ddFrame(m,"Lấy – trả đồ","Ai lấy, buổi quay nào, trả lại khi nào · ký nhận và trả trên web",()=>{
    const d=DDS.d,n=DDS.noi,me=ddMe(),A=d.lay.filter(p=>p.noi===n&&(me.hr||p.user_id===me.id));
    const T={cho:A.filter(p=>p.st==="cho"),dang:A.filter(p=>["dang","tra_cho"].includes(p.st)),tra:A.filter(p=>["tra","huy"].includes(p.st))},L=T[DDS.tab.lay]||T.dang;
    return `<div class="filters" style="gap:6px">${ddTabs("lay",[["cho","Chờ giao",T.cho.length],["dang","Đang mượn",T.dang.length],["tra","Đã trả",T.tra.length]])}<span style="margin-left:auto"></span><button class="btn pri" id="dd-new">＋ Phiếu lấy đồ</button></div>
    <section class="card flush"><div class="tbl"><table class="ddt"><thead><tr><th>Phiếu</th><th>Người lấy</th><th>Buổi quay / việc</th><th>Đồ lấy</th><th>Hạn trả</th><th>Trạng thái</th><th></th></tr></thead><tbody>
    ${L.map(p=>{const chu=p.user_id===me.id,acts=[];
      if(p.st==="cho"){if(me.hr)acts.push(["Giao đồ","giao:"+p.id,"pri"]);if(me.hr||chu)acts.push(["Hủy","huy:"+p.id])}
      if(p.st==="dang"){if(chu&&!p.ky_nhan_at)acts.push(["Đã nhận đủ","ky:"+p.id,"pri"]);if(chu||me.hr)acts.push([me.hr?"Nhận lại đồ":"Trả đồ","tra:"+p.id,me.hr?"pri":""])}
      if(p.st==="tra_cho"&&me.hr)acts.push(["Nhận lại đồ","tra:"+p.id,"pri"]);
      acts.push(["In","in:"+p.id]);
      return `<tr><td class="mono">${p.id}</td><td>${esc(p.user_name)}</td><td>${esc(p.shoot_txt||p.muc_dich||"")}</td><td style="font-size:13px">${p.lines.map(l=>`${ddN(l.sl)} ${esc(ddIt(l.item_id).ten)}${l.tra!=null&&p.st==="tra"?` <span class="hint">(trả ${ddN(l.tra)}${l.dung?", dùng hết "+ddN(l.dung):""}${l.tinh&&l.tinh!=="Tốt"?", "+esc(l.tinh.toLowerCase()):""})</span>`:""}`).join("<br>")}</td><td>${ddHan(p.han)}</td><td>${p.qua_han?pill("Quá hạn","red"):pill(...DD_LAY_ST[p.st])}${p.giao_name?`<div class="hint" style="margin:0">Giao: ${esc(p.giao_name)} ${ddHan(p.giao_at&&new Date(new Date(p.giao_at).getTime()+7*3600e3).toISOString())}</div>`:""}${p.st!=="cho"&&p.st!=="huy"?`<div class="hint" style="margin:0">${p.ky_nhan_at?"Người lấy đã ký nhận":"Người lấy chưa ký nhận"}</div>`:""}</td><td class="ddact" style="white-space:nowrap">${ddBtns(acts)}</td></tr>`}).join("")||`<tr><td colspan="7" class="hint">Không có phiếu</td></tr>`}</tbody></table></div></section>
    <p class="hint">Thiết bị và công cụ: mượn rồi trả; trả thiếu ghi rõ hỏng hoặc mất. Hàng mẫu, đồ tiêu hao: phần không trả là đã dùng hết. Quá hạn trả, web nhắc người lấy và HCNS lúc 8 giờ sáng.</p>`});
  if(!ok)return;
  $("#dd-new").onclick=()=>ddPhieu();
  ddWireActs(m,async(a)=>{const[k,id]=a.split(":");const p=DDS.d.lay.find(x=>x.id===id);
    try{if(k==="giao"){await ddPost("/lay/"+id+"/giao");DDS.tab.lay="dang";ddRe("Đã giao, chờ người lấy ký nhận")}
      else if(k==="ky"){await ddPost("/lay/"+id+"/ky");ddRe("Đã ký nhận")}
      else if(k==="huy"){if(!confirm("Hủy phiếu "+id+"?"))return;await ddPost("/lay/"+id+"/huy",{ly_do:"Hủy"});ddRe("Đã hủy")}
      else if(k==="tra")ddTra(p);else if(k==="in")ddIn(p)}catch(er){ddErr(er)}});
}
function ddPhieu(){
  const n=DDS.noi,me=ddMe(),S=ddShoots(),I=DDS.d.items.filter(i=>i.active&&(i.ton[n]||0)>0);
  if(!I.length){toast("Chưa có đồ nào trên kệ "+DD_NOI[n]);return}
  const row=(id,sl)=>`<tr><td><select class="ddp-i">${opt(I.map(i=>[i.id,`${i.ten} (còn ${ddN(i.ton[n])} ${i.dvt})`]),id)}</select></td><td class="n"><input type="number" class="ddp-s" value="${sl}" min="1" style="width:64px;text-align:right"></td><td><button class="btn sm" type="button" onclick="this.closest('tr').remove()">✕</button></td></tr>`;
  const han=ddToday()+"T18:00";
  ddOpen(`<h2>Phiếu lấy đồ · ${DD_NOI[n]}</h2><form class="frm" onsubmit="return false">
   <div class="row4">${me.hr?`<label class="field">Người lấy<select id="ddp-u">${opt(ddCrm(),me.id)}</select></label>`:`<label class="field">Người lấy<input value="${esc(me.name)}" disabled></label>`}
   <label class="field" style="grid-column:span 2">Buổi quay (từ Lịch quay)<select id="ddp-sq">${opt([["","Không thuộc buổi quay"]].concat(S.map(s=>[s.id,s.txt])),S[0]&&S[0].mine?S[0].id:"")}</select></label>
   <label class="field">Hạn trả<input type="datetime-local" id="ddp-han" value="${han}"></label></div>
   <label class="field" id="ddp-mdw">Lấy để làm gì<input id="ddp-md" placeholder="VD: quay livestream, chụp ảnh sản phẩm"></label>
   <div class="tbl"><table><thead><tr><th>Đồ</th><th class="n">Số lượng</th><th></th></tr></thead><tbody id="ddp-rows">${row(I[0].id,1)}</tbody></table></div>
   <p><button class="btn sm" type="button" id="ddp-add">＋ Thêm dòng</button></p>
   ${me.hr?`<label class="inl"><input type="checkbox" id="ddp-giao" checked> HCNS giao luôn (trừ kệ ngay)</label>`:`<p class="hint">Gửi xong: HCNS bấm "Giao đồ" khi đưa đồ; người lấy bấm "Đã nhận đủ" để ký nhận.</p>`}
   <div id="ddp-e"></div><div class="filters" style="justify-content:flex-end"><button class="btn" type="button" onclick="closeDrawer()">Đóng</button><button class="btn pri" id="ddp-ok">Gửi phiếu</button></div></form>`);
  const md=()=>{$("#ddp-mdw").hidden=!!$("#ddp-sq").value};$("#ddp-sq").onchange=md;md();
  $("#ddp-add").onclick=()=>$("#ddp-rows").insertAdjacentHTML("beforeend",row(I[Math.min(I.length-1,$$("#ddp-rows tr").length)].id,1));
  $("#ddp-ok").onclick=async e=>{e.target.disabled=true;const sq=$("#ddp-sq").value,s=S.find(x=>x.id===sq);
    const b={noi:n,shoot_id:sq,shoot_txt:s?s.txt:"",muc_dich:$("#ddp-md").value,han:$("#ddp-han").value,lines:$$("#ddp-rows tr").map(r=>({item_id:r.querySelector(".ddp-i").value,sl:+r.querySelector(".ddp-s").value}))};
    if(me.hr){b.user_id=$("#ddp-u").value;b.giao=$("#ddp-giao").checked}
    try{const r=await ddPost("/lay",b);closeDrawer();DDS.tab.lay=r.st==="cho"?"cho":"dang";ddRe(r.st==="cho"?"Đã gửi, chờ HCNS giao":"Đã giao "+r.id)}catch(er){e.target.disabled=false;$("#ddp-e").innerHTML=`<div class="note red">${esc(er.message)}</div>`}};
}
function ddTra(p){const me=ddMe();
  ddOpen(`<h2>${me.hr?"Nhận lại đồ":"Trả đồ"} · ${p.id}</h2><p class="hint">${esc(p.user_name)} · ${esc(p.shoot_txt||p.muc_dich||"")}</p><div class="tbl"><table><thead><tr><th>Đồ</th><th class="n">Đã lấy</th><th class="n">Trả lại</th><th>Phần không trả</th><th>Ghi chú</th></tr></thead><tbody>
   ${p.lines.map(l=>{const i=ddIt(l.item_id),tb=ddMuonTra(i.loai),tra=l.tra!=null?l.tra:tb?l.sl:0;return `<tr data-lid="${l.id}" data-sl="${l.sl}" data-tb="${tb?1:0}"><td>${esc(i.ten)}</td><td class="n">${ddN(l.sl)}</td><td class="n"><input type="number" class="ddt-t" value="${tra}" min="0" max="${l.sl}" style="width:64px;text-align:right"></td><td>${tb?`<select class="ddt-s">${opt([["","—"],["Hỏng","Hỏng"],["Mất","Mất"]],l.tinh&&l.tinh!=="Tốt"?l.tinh:"")}</select>`:`<span class="hint ddt-d">dùng hết ${ddN(l.sl-tra)}</span>`}</td><td><input class="ddt-n" value="${esc(l.note||"")}"></td></tr>`}).join("")}</tbody></table></div>
   <p class="hint">${me.hr?"Bấm xác nhận = HCNS đã nhận lại đồ, đồ trả về kệ.":"Gửi xong, HCNS kiểm và bấm nhận lại."} Thiết bị trả thiếu phải chọn Hỏng hoặc Mất.</p>
   <div id="ddt-e"></div><div class="filters" style="justify-content:flex-end"><button class="btn" onclick="closeDrawer()">Đóng</button><button class="btn pri" id="ddt-ok">${me.hr?"Xác nhận đã nhận lại":"Gửi trả đồ"}</button></div>`);
  $$("#drawerIn .ddt-t").forEach(x=>x.oninput=()=>{const r=x.closest("tr"),d=r.querySelector(".ddt-d");if(d)d.textContent="dùng hết "+ddN(+r.dataset.sl-(+x.value||0))});
  $("#ddt-ok").onclick=async e=>{e.target.disabled=true;const lines=$$("#drawerIn tr[data-lid]").map(r=>({id:+r.dataset.lid,tra:+r.querySelector(".ddt-t").value||0,tinh:r.querySelector(".ddt-s")?r.querySelector(".ddt-s").value:"",note:r.querySelector(".ddt-n").value}));
    try{const r=await ddPost("/lay/"+p.id+"/tra",{lines});closeDrawer();DDS.tab.lay=r.st==="tra"?"tra":"dang";ddRe(r.st==="tra"?"Đã nhận lại đồ":"Đã gửi, chờ HCNS nhận lại")}catch(er){e.target.disabled=false;$("#ddt-e").innerHTML=`<div class="note red">${esc(er.message)}</div>`}};
}
/* Biên bản mượn – trả để in / lưu (ký trên web: giờ HCNS giao, giờ người lấy bấm nhận, giờ HCNS nhận lại). */
function ddIn(p){const t=s=>s?new Date(s).toLocaleString("vi-VN"):"—";
  const w=window.open("","_blank");if(!w){toast("Trình duyệt chặn cửa sổ in");return}
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${p.id}</title><style>body{font-family:Arial,sans-serif;padding:24px;font-size:14px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px}h2{margin:0 0 4px}</style>
   <h2>BIÊN BẢN MƯỢN – TRẢ ĐỒ ${p.id}</h2><p>Nơi: ${DD_NOI[p.noi]} · Người lấy: <b>${esc(p.user_name)}</b> · ${esc(p.shoot_txt||p.muc_dich||"")} · Hạn trả: ${ddHan(p.han)}</p>
   <table><tr><th>Đồ</th><th>Số lấy</th><th>Trả lại</th><th>Dùng hết / hỏng / mất</th><th>Ghi chú</th></tr>${p.lines.map(l=>`<tr><td>${esc(ddIt(l.item_id).ten)}</td><td>${ddN(l.sl)}</td><td>${l.tra!=null?ddN(l.tra):""}</td><td>${l.dung?"dùng hết "+ddN(l.dung):l.tinh&&l.tinh!=="Tốt"?esc(l.tinh):""}</td><td>${esc(l.note||"")}</td></tr>`).join("")}</table>
   <p>HCNS giao: ${esc(p.giao_name||"—")} lúc ${t(p.giao_at)} · Người lấy ký nhận trên web lúc ${t(p.ky_nhan_at)}</p><p>Người lấy khai trả lúc ${t(p.tra_khai_at)} · HCNS nhận lại: ${esc(p.tra_name||"—")} lúc ${t(p.tra_at)}</p><script>print()<\/script>`);w.document.close();
}

/* ---------- 4. Yêu cầu hàng mẫu từ xưởng ---------- */
const DD_MAU_ST={lead:["Chờ Lead phòng duyệt","amb"],kho:["Chờ kho xuất","blu"],nhan:["Kho đã xuất, chờ HCNS nhận","vio"],xong:["Đã về","grn"],tl:["Trả lại","red"],huy:["Đã hủy","gry"]};
const ddMauSt=x=>x.st==="kho"&&x.xk?"nhan":x.st;
function pDdMau(m){
  const ok=ddFrame(m,"Yêu cầu hàng mẫu","Xin mẫu → Lead phòng duyệt → kho thành phẩm xuất (phiếu xuất kho thật) → HCNS nhận về",()=>{
    const d=DDS.d,n=DDS.noi,me=ddMe();
    const mine=x=>me.hr||me.kho||x.user_id===me.id||(me.lead&&x.pb===me.pb)||me.ceo;
    const A=d.mau.filter(x=>x.noi===n&&mine(x)),T={cho:A.filter(x=>["lead","kho"].includes(x.st)),xong:A.filter(x=>["xong","tl","huy"].includes(x.st))},L=T[DDS.tab.mau]||T.cho;
    const acts=x=>{const s=ddMauSt(x),a=[];
      if(s==="lead"&&(me.ceo||(me.lead&&me.pb===x.pb&&x.user_id!==me.id)))a.push(["Duyệt","ok:"+x.id,"pri"],["Trả lại","tl:"+x.id]);
      if(s==="kho"&&me.kho)a.push(["Xuất kho","xk:"+x.id,"pri"]);
      if(s==="nhan"&&me.hr)a.push(["Đã nhận về","nh:"+x.id,"pri"]);
      if(["lead","kho"].includes(s)&&(x.user_id===me.id||me.hr))a.push(["Hủy","huy:"+x.id]);return a};
    return `<div class="filters" style="gap:6px">${ddTabs("mau",[["cho","Đang chạy",T.cho.length],["xong","Đã xong",T.xong.length]])}<span style="margin-left:auto"></span><button class="btn pri" id="dd-ym">＋ Yêu cầu hàng mẫu</button></div>
    <section class="card flush"><div class="tbl"><table class="ddt"><thead><tr><th>Mã</th><th>Người xin</th><th>Hàng mẫu</th><th class="n">Số lượng</th><th>Dùng cho</th><th>Cần trước</th><th>Trạng thái</th><th></th></tr></thead><tbody>
    ${L.map(x=>`<tr><td class="mono">${x.id}</td><td>${esc(x.user_name)}</td><td><b>${esc(x.kho_ten||x.kho_code)}</b><div class="hint" style="margin:0">${esc(x.kho_code)}${x.xk?" · phiếu xuất "+esc(x.xk.doc_no):""}</div></td><td class="n">${ddN(x.sl)} ${esc(x.kho_dvt)}${x.xk&&x.xk.sl!==x.sl?`<div class="hint" style="margin:0">kho xuất ${ddN(x.xk.sl)}</div>`:""}</td><td>${esc(x.shoot_txt||x.ghi_chu||"")}</td><td>${ddDmy(x.can_ngay)}</td><td>${pill(...DD_MAU_ST[ddMauSt(x)])}${x.lead_name&&x.st!=="lead"?`<div class="hint" style="margin:0">${x.st==="tl"?"Trả lại":"Duyệt"}: ${esc(x.lead_name)}</div>`:""}${x.ly_do?`<div class="hint" style="margin:0">${esc(x.ly_do)}</div>`:""}</td><td class="ddact" style="white-space:nowrap">${ddBtns(acts(x))}</td></tr>`).join("")||`<tr><td colspan="8" class="hint">Không có</td></tr>`}</tbody></table></div></section>
    <p class="hint">Kho bấm Xuất kho = web lập Phiếu xuất kho thành phẩm thật (lý do "Hàng mẫu Marketing"), trừ tồn kho thành phẩm, xem ở Kho thành phẩm › Phiếu xuất kho. Hàng về để ở kệ hàng mẫu, dùng còn thừa thì để lại cho lần sau.</p>`});
  if(!ok)return;
  $("#dd-ym").onclick=()=>ddFormMau();
  ddWireActs(m,async a=>{const[k,id]=a.split(":"),x=DDS.d.mau.find(y=>y.id===id);
    try{if(k==="ok"){await ddPost("/mau/"+id+"/duyet",{});ddRe("Đã duyệt, chuyển kho xuất")}
      else if(k==="tl"){const ly=prompt("Lý do trả lại?");if(!ly)return;await ddPost("/mau/"+id+"/duyet",{ok:false,ly_do:ly});ddRe("Đã trả lại")}
      else if(k==="huy"){const ly=prompt("Lý do hủy?");if(ly===null)return;await ddPost("/mau/"+id+"/huy",{ly_do:ly});ddRe("Đã hủy")}
      else if(k==="nh"){await ddPost("/mau/"+id+"/nhan");ddRe("Đã nhận về "+DD_NOI[x.noi])}
      else if(k==="xk")ddXuat(x)}catch(er){ddErr(er)}});
}
function ddFormMau(){const n=DDS.noi,S=ddShoots(),I=typeof KHO!=="undefined"&&KHO.items?[...KHO.items.values()].filter(x=>["TP","HH","COMBO"].includes(x.cls)&&x.active!==0):[];
  const coSan=DDS.d.items.filter(i=>i.loai==="mau"&&i.ton[n]>0);
  ddOpen(`<h2>Yêu cầu hàng mẫu từ xưởng · về ${DD_NOI[n]}</h2><form class="frm" onsubmit="return false">
   <label class="field">Sản phẩm (mã kho thành phẩm)<input id="ym-ma" list="ym-l" placeholder="Gõ mã hoặc tên sản phẩm"><datalist id="ym-l">${I.map(x=>`<option value="${esc(x.code)}">${esc(x.name)}</option>`).join("")}</datalist></label>
   <div class="row4"><label class="field">Số lượng<input id="ym-sl" type="number" value="1" min="1"></label><label class="field">Cần trước ngày<input type="date" id="ym-can" value="${ddToday()}"></label>
   <label class="field" style="grid-column:span 2">Dùng cho buổi quay<select id="ym-sq">${opt([["","Không thuộc buổi quay"]].concat(S.map(s=>[s.id,s.txt])),S[0]&&S[0].mine?S[0].id:"")}</select></label></div>
   <label class="field">Ghi chú / dùng làm gì<input id="ym-gc" placeholder="VD: lấy loại vỏ mới"></label>
   ${coSan.length?`<p class="hint">${DD_NOI[n]} đang còn: ${coSan.map(i=>`${esc(i.ten)} ${ddN(i.ton[n])}`).join(" · ")}. Còn đủ thì lấy ở kệ bằng Phiếu lấy đồ, không cần xin kho.</p>`:""}
   <div id="ym-e"></div><div class="filters" style="justify-content:flex-end"><button class="btn" type="button" onclick="closeDrawer()">Đóng</button><button class="btn pri" id="ym-ok">Gửi yêu cầu</button></div></form>`);
  if(typeof khoLoad==="function"&&!I.length&&!DDS.khoTry){DDS.khoTry=1;khoLoad().then(()=>{if(!$("#drawer").hidden&&$("#ym-l"))ddFormMau()}).catch(()=>{})}
  $("#ym-ok").onclick=async e=>{e.target.disabled=true;const sq=$("#ym-sq").value,s=S.find(x=>x.id===sq);
    try{const r=await ddPost("/mau",{noi:n,kho_code:$("#ym-ma").value.trim(),sl:+$("#ym-sl").value,can_ngay:$("#ym-can").value,shoot_id:sq,shoot_txt:s?s.txt:"",ghi_chu:$("#ym-gc").value});
      closeDrawer();DDS.tab.mau="cho";ddRe(r.st==="lead"?"Đã gửi, chờ Lead phòng duyệt":"Đã gửi kho xuất")}catch(er){e.target.disabled=false;$("#ym-e").innerHTML=`<div class="note red">${esc(er.message)}</div>`}};
}
function ddXuat(x){
  ddOpen(`<h2>Xuất kho hàng mẫu · ${x.id}</h2><p>Web lập <b>Phiếu xuất kho</b> ở Kho thành phẩm:</p><div class="tbl"><table><tbody><tr><td>Lý do</td><td><b>Hàng mẫu Marketing</b></td></tr><tr><td>Sản phẩm</td><td>${esc(x.kho_code)} · ${esc(x.kho_ten)}</td></tr>
   <tr><td>Số lượng</td><td><input type="number" id="xk-sl" value="${x.sl}" style="width:80px"> ${esc(x.kho_dvt)} <span class="hint">(xin ${ddN(x.sl)})</span></td></tr><tr><td>Ngày xuất</td><td><input type="date" id="xk-d" value="${ddToday()}"></td></tr><tr><td>Nơi nhận</td><td>HCNS · ${DD_NOI[x.noi]} (${esc(x.user_name)} xin)</td></tr></tbody></table></div>
   <label class="field">Ghi chú (xuất ít hơn số xin thì ghi lý do)<input id="xk-gc"></label>
   <p class="hint">Phiếu này giống mọi phiếu xuất kho khác: xem, hủy ở Kho thành phẩm › Phiếu xuất kho.</p>
   <div id="xk-e"></div><div class="filters" style="justify-content:flex-end"><button class="btn" onclick="closeDrawer()">Đóng</button><button class="btn pri" id="xk-ok">Xuất kho</button></div>`);
  $("#xk-ok").onclick=async e=>{const sl=+$("#xk-sl").value;if(!(sl>0)){$("#xk-e").innerHTML=`<div class="note red">Số lượng phải lớn hơn 0</div>`;return}
    if(sl<x.sl&&!$("#xk-gc").value.trim()){$("#xk-e").innerHTML=`<div class="note red">Xuất ít hơn số xin: ghi lý do</div>`;return}
    e.target.disabled=true;
    try{const r=await svApi("/api/hub/kho/docs",{method:"POST",body:JSON.stringify({type:"XK",date:$("#xk-d").value,partner:"HCNS · "+DD_NOI[x.noi],ref_no:x.id,kind:"Hàng mẫu Marketing",note:[x.id,x.user_name,x.shoot_txt||x.ghi_chu,$("#xk-gc").value.trim()].filter(Boolean).join(" · "),lines:[{item:x.kho_code,qty:sl}]})});
      closeDrawer();if(typeof KHO!=="undefined"&&KHO)KHO.at=0;ddRe("Đã lập phiếu xuất kho "+r.no+((r.warnings||[]).length?" · "+r.warnings.join(" "):""))}catch(er){e.target.disabled=false;$("#xk-e").innerHTML=`<div class="note red">${esc(er.message)}</div>`}};
}

/* ---------- 5. Đề nghị mua đồ dùng ---------- */
const DD_MUA_ST={lead:["Chờ Lead phòng duyệt","amb"],ql:["Chờ Quản lý mua hàng duyệt","amb"],mua:["Đã duyệt, chờ mua","blu"],xong:["Đã mua về","grn"],tl:["Cần sửa","red"],huy:["Đã hủy","gry"]};
function pDdMua(m){
  const ok=ddFrame(m,"Đề nghị mua đồ dùng","Gửi → Lead phòng duyệt → Quản lý mua hàng duyệt → mua về nhập tồn, phiếu chi vào Sổ chi phí",()=>{
    const d=DDS.d,n=DDS.noi,me=ddMe();
    const mine=x=>me.hr||me.ql||me.ceo||x.user_id===me.id||(me.lead&&x.pb===me.pb);
    const A=d.mua.filter(x=>x.noi===n&&mine(x)),T={cho:A.filter(x=>["lead","ql","mua","tl"].includes(x.st)),xong:A.filter(x=>["xong","huy"].includes(x.st))},L=T[DDS.tab.mua]||T.cho;
    const acts=x=>{const a=[];
      if(x.st==="lead"&&(me.ceo||(me.lead&&me.pb===x.pb&&x.user_id!==me.id)))a.push(["Duyệt","ok:"+x.id,"pri"],["Cần sửa","tl:"+x.id]);
      if(x.st==="ql"&&me.ql)a.push(["Duyệt","ok:"+x.id,"pri"],["Cần sửa","tl:"+x.id]);
      if(x.st==="mua"&&(me.hr||me.ql))a.push(["Đã mua về","nh:"+x.id,"pri"]);
      if(x.st==="tl"&&x.user_id===me.id)a.push(["Sửa, gửi lại","gl:"+x.id,"pri"]);
      if(["lead","ql","mua","tl"].includes(x.st)&&(x.user_id===me.id||me.hr))a.push(["Hủy","huy:"+x.id]);return a};
    return `<div class="filters" style="gap:6px">${ddTabs("mua",[["cho","Đang chạy",T.cho.length],["xong","Đã xong",T.xong.length]])}<span style="margin-left:auto"></span><button class="btn pri" id="dd-dm">＋ Đề nghị mua</button></div>
    <section class="card flush"><div class="tbl"><table class="ddt"><thead><tr><th>Mã</th><th>Người đề nghị</th><th>Đồ cần mua</th><th class="n">Số lượng</th><th class="n">Thành tiền</th><th>Lý do</th><th>Trạng thái</th><th></th></tr></thead><tbody>
    ${L.map(x=>`<tr><td class="mono">${x.id}</td><td>${esc(x.user_name)}</td><td><b>${esc(x.ten)}</b>${x.link?`<div class="hint" style="margin:0">${/^https?:\/\//.test(x.link)?`<a href="${esc(x.link)}" target="_blank" rel="noopener">Link / báo giá</a>`:esc(x.link)}</div>`:""}</td><td class="n">${ddN(x.st==="xong"?x.thuc_sl:x.sl)} ${esc(x.dvt)}</td><td class="n">${ddN(x.st==="xong"?x.thuc_tien:x.sl*x.gia)}</td><td>${esc(x.ly_do)}</td><td>${pill(...DD_MUA_ST[x.st])}${x.lead_name?`<div class="hint" style="margin:0">Lead: ${esc(x.lead_name)}</div>`:""}${x.ql_name?`<div class="hint" style="margin:0">Mua hàng: ${esc(x.ql_name)}</div>`:""}${x.ly_do_tl?`<div class="hint" style="margin:0">${esc(x.ly_do_tl)}</div>`:""}${x.pc_id?`<div class="hint" style="margin:0">Có phiếu chi ở Sổ chi phí</div>`:""}</td><td class="ddact" style="white-space:nowrap">${ddBtns(acts(x))}</td></tr>`).join("")||`<tr><td colspan="8" class="hint">Không có</td></tr>`}</tbody></table></div></section>
    <p class="hint">Mua về: tồn tăng, web lập phiếu chi chờ kế toán xác nhận ở Sổ chi phí (khoản từ ngưỡng chi CEO duyệt như mọi phiếu chi). Thiết bị, công cụ từ 2 triệu một cái: kế toán ghi tăng ở Tài sản & CCDC.</p>`});
  if(!ok)return;
  $("#dd-dm").onclick=()=>ddFormMua();
  ddWireActs(m,async a=>{const[k,id]=a.split(":"),x=DDS.d.mua.find(y=>y.id===id);
    try{if(k==="ok"){const r=await ddPost("/mua/"+id+"/duyet",{});ddRe(r.st==="ql"?"Đã duyệt, chuyển Quản lý mua hàng":"Đã duyệt, chờ mua")}
      else if(k==="tl"){const ly=prompt("Cần sửa gì?");if(!ly)return;await ddPost("/mua/"+id+"/duyet",{ok:false,ly_do:ly});ddRe("Đã trả lại")}
      else if(k==="huy"){const ly=prompt("Lý do hủy?");if(ly===null)return;await ddPost("/mua/"+id+"/huy",{ly_do:ly});ddRe("Đã hủy")}
      else if(k==="gl")ddFormMua(x);else if(k==="nh")ddMuaVe(x)}catch(er){ddErr(er)}});
}
function ddFormMua(x){const n=DDS.noi,I=DDS.d.items.filter(i=>i.active&&i.loai!=="mau");
  ddOpen(`<h2>${x?"Sửa, gửi lại "+x.id:"Đề nghị mua đồ dùng · "+DD_NOI[n]}</h2><form class="frm" onsubmit="return false">
   ${x?`<p><b>${esc(x.ten)}</b> · cần sửa: ${esc(x.ly_do_tl||"")}</p>`:`<div class="row4"><label class="field" style="grid-column:span 2">Đồ cần mua<select id="dm-i">${opt([["","Đồ mới (chưa có trong danh mục)"]].concat(I.map(i=>[i.id,i.ten+" (còn "+ddN(i.ton[n])+" "+i.dvt+")"])),"")}</select></label>
   <label class="field" id="dm-tw" style="grid-column:span 2">Tên đồ mới<input id="dm-ten" placeholder="VD: Micro không dây cài áo"></label></div>
   <div class="row4" id="dm-lw"><label class="field">Loại<select id="dm-loai">${opt(Object.entries(DD_LOAI).filter(([k])=>k!=="mau"),"th")}</select></label><label class="field">Đơn vị<input id="dm-dvt" value="cái"></label></div>`}
   <div class="row4"><label class="field">Số lượng<input id="dm-sl" type="number" value="${x?x.sl:1}" min="1"></label><label class="field">Đơn giá dự kiến (đ)<input id="dm-g" type="number" value="${x?x.gia:0}"></label></div>
   <label class="field">Lý do<input id="dm-ly" value="${esc(x?x.ly_do:"")}" placeholder="VD: quay 2 người cùng lúc thiếu micro"></label>${x?"":`<label class="field">Link / báo giá (nếu có)<input id="dm-link" placeholder="Dán link sản phẩm"></label>`}
   <p class="hint" id="dm-h"></p><div id="dm-e"></div>
   <div class="filters" style="justify-content:flex-end"><button class="btn" type="button" onclick="closeDrawer()">Đóng</button><button class="btn pri" id="dm-ok">${x?"Gửi lại":"Gửi đề nghị"}</button></div></form>`);
  const up=()=>{const t=(+$("#dm-sl").value||0)*(+$("#dm-g").value||0);$("#dm-h").innerHTML=`Thành tiền dự kiến <b>${ddN(t)} đ</b>. Lead phòng duyệt, rồi Quản lý mua hàng duyệt.`};
  ["#dm-sl","#dm-g"].forEach(s=>$(s).oninput=up);up();
  if(!x){const sw=()=>{const moi=!$("#dm-i").value;$("#dm-tw").hidden=!moi;$("#dm-lw").hidden=!moi};$("#dm-i").onchange=()=>{sw();const it=DDS.d.items.find(i=>i.id===$("#dm-i").value);if(it&&it.gia){$("#dm-g").value=it.gia;up()}};sw()}
  $("#dm-ok").onclick=async e=>{e.target.disabled=true;
    try{const r=x?await ddPost("/mua/"+x.id+"/gui-lai",{sl:+$("#dm-sl").value,gia:+$("#dm-g").value,ly_do:$("#dm-ly").value})
      :await ddPost("/mua",{noi:n,item_id:$("#dm-i").value,ten:$("#dm-ten").value,loai:$("#dm-loai").value,dvt:$("#dm-dvt").value,sl:+$("#dm-sl").value,gia:+$("#dm-g").value,ly_do:$("#dm-ly").value,link:$("#dm-link").value});
      closeDrawer();DDS.tab.mua="cho";ddRe({lead:"Đã gửi, chờ Lead phòng duyệt",ql:"Đã gửi, chờ Quản lý mua hàng duyệt",mua:"Đã gửi, chờ mua"}[r.st]||"Đã gửi")}catch(er){e.target.disabled=false;$("#dm-e").innerHTML=`<div class="note red">${esc(er.message)}</div>`}};
}
/* Nhóm chi phí cho phiếu chi nháp: nhà máy → G16 (vật tư, đồ dùng xưởng); thiết bị / công cụ từ 2 triệu một cái → G28 (kế toán ghi tăng CCDC);
   thiết bị quay → G11 (công cụ Marketing); còn lại → G21 (văn phòng). */
const ddNhomChi=(x,sl,tien)=>{const loai=x.item_id?ddIt(x.item_id).loai:x.loai,mot=sl>0?tien/sl:0;
  if(ddMuonTra(loai)&&mot>=2e6)return ["G28","Không tính"];if(x.noi==="nm")return ["G16","Sản xuất"];if(loai==="tb")return ["G11","Chung"];return ["G21","Chung"]};
function ddMuaVe(x){
  ddOpen(`<h2>Đã mua về · ${x.id}</h2><p><b>${esc(x.ten)}</b> · ${DD_NOI[x.noi]}</p><form class="frm" onsubmit="return false"><div class="row4"><label class="field">Số thực nhận<input type="number" id="mv-sl" value="${x.sl}"></label><label class="field">Tiền thực trả (đ)<input type="number" id="mv-t" value="${Math.round(x.sl*x.gia)}"></label><label class="field">Trả bằng<select id="mv-ht">${opt(["Chuyển khoản","Tiền mặt","Nhân viên ứng trước"],"Chuyển khoản")}</select></label><label class="field">Ngày mua<input type="date" id="mv-d" value="${ddToday()}" max="${ddToday()}"></label></div>
   <div class="row4"><label class="field" style="grid-column:span 2">Người nhận tiền / nơi mua<input id="mv-nn" placeholder="VD: Shopee, cửa hàng…"></label>${x.item_id?"":`<label class="field" style="grid-column:span 2">Để ở đâu<input id="mv-cho" placeholder="VD: Tủ hành chính"></label>`}</div>
   ${typeof mhManage==="function"&&mhManage()?`<label class="field">Ảnh hóa đơn<input type="file" id="mv-f" accept="image/*,application/pdf" multiple></label>`:`<p class="hint">Ảnh hóa đơn: gửi kế toán gắn vào phiếu chi.</p>`}
   <p class="hint" id="mv-h"></p><div id="mv-e"></div>
   <div class="filters" style="justify-content:flex-end"><button class="btn" onclick="closeDrawer()">Đóng</button><button class="btn pri" id="mv-ok">Lưu</button></div></form>`);
  const up=()=>{const sl=+$("#mv-sl").value||0,t=+$("#mv-t").value||0,[g]=ddNhomChi(x,sl,t),dm=(typeof scDM==="function"?scDM():[]).find(r=>r[0]===g);
    $("#mv-h").innerHTML=`Lưu xong: tồn tăng ${ddN(sl)} ${esc(x.dvt)} ở ${DD_NOI[x.noi]}; web lập phiếu chi ${ddN(t)} đ chờ kế toán xác nhận (nhóm ${g}${dm?" "+esc(dm[1]):""}).${g==="G28"?" Thiết bị từ 2 triệu: kế toán ghi tăng ở Tài sản & CCDC.":""}`};
  ["#mv-sl","#mv-t"].forEach(s=>$(s).oninput=up);up();
  $("#mv-ok").onclick=async e=>{const sl=+$("#mv-sl").value,t=+$("#mv-t").value,ngay=$("#mv-d").value,ht=$("#mv-ht").value;e.target.disabled=true;
    const pcId=t>0?uid("pc"):"";
    try{await ddPost("/mua/"+x.id+"/xong",{thuc_sl:sl,thuc_tien:t,tra_bang:ht,ngay_mua:ngay,pc_id:pcId,cho:$("#mv-cho")?$("#mv-cho").value:""});
      if(pcId){const[g,k]=ddNhomChi(x,sl,t);let ct="";try{ct=typeof scSoPhieu==="function"?scSoPhieu(ngay):""}catch(er){}
        const row={id:pcId,tkc:"",tkn:"",d:ngay,ct:ct||"PC-"+ngay.slice(0,7)+"-DD",lct:"Phiếu chi",dg:`Mua ${x.ten} (${x.id}, ${DD_NOI[x.noi]})`,tk:ht==="Tiền mặt"?"1111":"1121",t,g,k,gc:x.ly_do+(ht==="Nhân viên ứng trước"?" · hoàn ứng cho người mua":""),dn:"",bp:x.noi==="nm"?"Sản xuất":"Văn phòng",nn:$("#mv-nn").value.trim(),ht:ht==="Tiền mặt"?"Tiền mặt":"Chuyển khoản",src:"dodung",dd:x.id,by:ME.name,at:Date.now(),st:"Chờ duyệt"};
        DB.mutate(ME.name,"ghi phiếu chi mua đồ dùng "+x.id,dt=>{(dt.pcCho=dt.pcCho||[]).push(row)});
        for(const f of [...($("#mv-f")?$("#mv-f").files:[])]){try{const fx=await mhPrepFile(f);await svApi("/api/hub/kho/mh/costs/"+pcId+"/files",{method:"POST",body:JSON.stringify(fx)})}catch(er){toast("Ảnh hóa đơn chưa gửi được: "+er.message+". Gửi lại ở phiếu chi.")}}}
      closeDrawer();DDS.tab.mua="xong";ddRe(pcId?"Đã nhập tồn, phiếu chi chờ kế toán xác nhận":"Đã nhập tồn")}catch(er){e.target.disabled=false;$("#mv-e").innerHTML=`<div class="note red">${esc(er.message)}</div>`}};
}

/* ---------- 6. Của tôi ---------- */
function pDdToi(m){
  const ok=ddFrame(m,"Đồ tôi đang giữ","Đồ đang mượn, yêu cầu đã gửi, việc cần duyệt",()=>{
    const d=DDS.d,me=ddMe(),mine=d.lay.filter(p=>p.user_id===me.id&&["cho","dang","tra_cho"].includes(p.st));
    const ym=d.mau.filter(x=>x.user_id===me.id&&["lead","kho"].includes(x.st)),dm=d.mua.filter(x=>x.user_id===me.id&&["lead","ql","mua","tl"].includes(x.st));
    const duyet=[...d.mau.filter(x=>x.st==="lead"&&(me.ceo||(me.lead&&x.pb===me.pb&&x.user_id!==me.id))).map(x=>[`<b>${x.id}</b> ${esc(x.user_name)} xin ${ddN(x.sl)} ${esc(x.kho_ten)}`,"vp_mau"]),
      ...d.mau.filter(x=>x.st==="kho"&&!x.xk&&me.kho).map(x=>[`<b>${x.id}</b> chờ kho xuất ${ddN(x.sl)} ${esc(x.kho_ten)}`,"vp_mau"]),
      ...d.mua.filter(x=>(x.st==="lead"&&(me.ceo||(me.lead&&x.pb===me.pb&&x.user_id!==me.id)))||(x.st==="ql"&&me.ql)).map(x=>[`<b>${x.id}</b> ${esc(x.user_name)} đề nghị mua ${esc(x.ten)} · ${ddN(x.sl*x.gia)} đ`,"vp_mua"])];
    const it=p=>`<div class="ddrow"><div><b>${p.id}</b> · ${DD_NOI[p.noi]} · ${pill(...(p.qua_han?["Quá hạn","red"]:DD_LAY_ST[p.st]))} hạn ${ddHan(p.han)}<div style="font-size:13px">${p.lines.map(l=>ddN(l.sl)+" "+esc(ddIt(l.item_id).ten)).join(" · ")}</div></div>${p.st==="dang"&&!p.ky_nhan_at?`<button class="btn sm pri" data-dda="ky:${p.id}">Đã nhận đủ</button>`:""}${p.st==="dang"?`<button class="btn sm" data-dda="tra:${p.id}">Trả đồ</button>`:""}</div>`;
    return `<div class="grid kpis">${kpi("Phiếu đang giữ",mine.length,mine.filter(p=>p.qua_han).length?mine.filter(p=>p.qua_han).length+" quá hạn":"")}${kpi("Yêu cầu hàng mẫu",ym.length)}${kpi("Đề nghị mua",dm.length)}${duyet.length?kpi("Cần tôi duyệt / xuất",duyet.length,"","var(--orange)"):""}</div>
    ${duyet.length?`<section class="card"><div class="card-h"><h2>Cần duyệt / xuất</h2></div>${duyet.map(([t,g])=>`<div class="ddrow"><div>${t}</div><button class="btn sm pri" data-go="${g}">Mở</button></div>`).join("")}</section>`:""}
    <section class="card"><div class="card-h"><h2>Đang giữ</h2><span class="sp"></span><button class="btn sm pri" data-go="vp_lay">＋ Lấy đồ</button><button class="btn sm" data-go="vp_mau">＋ Xin hàng mẫu</button><button class="btn sm" data-go="vp_mua">＋ Đề nghị mua</button></div>${mine.map(it).join("")||'<p class="hint">Không giữ đồ nào.</p>'}</section>
    ${ym.length||dm.length?`<section class="card"><div class="card-h"><h2>Đã gửi</h2></div>${ym.map(x=>`<div class="ddrow"><div><b>${x.id}</b> ${ddN(x.sl)} ${esc(x.kho_ten)} · ${pill(...DD_MAU_ST[ddMauSt(x)])}</div></div>`).join("")}${dm.map(x=>`<div class="ddrow"><div><b>${x.id}</b> ${esc(x.ten)} · ${pill(...DD_MUA_ST[x.st])}</div></div>`).join("")}</section>`:""}`});
  if(!ok)return;
  ddWireActs(m,async a=>{const[k,id]=a.split(":");try{if(k==="ky"){await ddPost("/lay/"+id+"/ky");ddRe("Đã ký nhận")}else if(k==="tra")ddTra(DDS.d.lay.find(p=>p.id===id))}catch(er){ddErr(er)}});
}

/* ---------- Đăng ký trang + menu ---------- */
Object.assign(PAGES,{vp_tq:pDdTq,vp_ton:pDdTon,vp_lay:pDdLay,vp_mau:pDdMau,vp_mua:pDdMua,vp_toi:pDdToi});
{
  const n=k=>()=>{const c=ddCho();return c&&c[k]||""};
  const hr=MODULES.find(x=>x.k==="hr");
  if(hr){const g0=hr.groups;hr.groups=()=>{const G=g0();if(G.some(g=>g[0]==="Hành chính – đồ dùng"))return G;
    return G.concat([["Hành chính – đồ dùng",[MI("vp_tq","Tổng quan đồ dùng",ddHrU),MI("vp_ton","Đồ dùng & thiết bị",ddHrU),MI("vp_lay","Lấy – trả đồ",ddHrU,n("lay")),MI("vp_mau","Yêu cầu hàng mẫu",ddHrU,n("mau")),MI("vp_mua","Đề nghị mua đồ dùng",ddHrU,n("mua"))]]])}}
  const mk=MODULES.find(x=>x.k==="mkt");
  if(mk){const g0=mk.groups;mk.groups=function(){const r=g0.apply(this,arguments)||[];if(r.some(g=>g[0]==="Đồ đi quay"))return r;
    return r.concat([["Đồ đi quay",[MI("vp_lay","Lấy – trả đồ",()=>true),MI("vp_mau","Yêu cầu hàng mẫu",()=>true,n("mau")),MI("vp_ton","Đồ dùng & thiết bị",()=>true)]]])}}
  /* Kho thành phẩm: yêu cầu hàng mẫu chờ xuất (kế toán kho). */
  const sx=MODULES.find(x=>x.k==="sx");
  if(sx){const g0=sx.groups;sx.groups=function(){const r=g0.apply(this,arguments)||[];const g=r.find(x=>x[0]==="Kho thành phẩm");
    const it=MI("vp_mau","Hàng mẫu cho Marketing",u=>u.role==="admin"||can(u,"sx.kiemke"),n("mau"));if(g&&!g[1].some(i=>i[0]==="vp_mau"))g[1]=g[1].concat([it]);return r}}
  const me=MODULES.find(x=>x.k==="me");
  if(me){const g0=me.groups;me.groups=()=>{const G=g0();if(G[0]&&!G[0][1].some(i=>i[0]==="vp_toi"))G[0][1].push(MI("vp_toi","Đồ dùng của tôi",()=>true,n("toi")));return G}}
}
