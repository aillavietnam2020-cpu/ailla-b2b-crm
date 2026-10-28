/* =====================================================================
   TÀI SẢN CỐ ĐỊNH & CÔNG CỤ DỤNG CỤ (quản trị › Tài chính – Kế toán › Tài sản & CCDC), chị Hoa duyệt 28/10.
   Ba trang: Tài sản cố định (ts_so) · Công cụ dụng cụ (ts_cc) · Khấu hao & phân bổ tháng (ts_kh). Luật tính ở tscalc.js.
   Lưu trong ngăn tài chính riêng D().fin (chỉ CEO, kế toán đọc / ghi, như Sổ chi phí):
     fin.ts.a    danh sách tài sản và công cụ (xem đầu tscalc.js)
     fin.ts.tu   tháng web bắt đầu làm chuẩn (khai báo đầu kỳ tính hao mòn đến hết tháng trước)
     fin.ts.run  {tháng: {at,by,t,n}} các tháng đã ghi vào Sổ chi phí
     fin.ts.sl   {tháng: lít} sản lượng bán thành phẩm nhập tay (không có thì lấy từ phiếu pha chế ở kho)
   Ghi sổ tháng: mỗi tài sản × bộ phận chịu thành một dòng fin.nkc {src:"ts", ct:"TS-yyyy-mm"}; ghi lại thì xóa dòng cũ của tháng đó.
   Nhóm: TSCĐ G25 (mới), CCDC G14 (có sẵn); phiếu chi mua tài sản G26 "Không tính" nên không vào P&L.
   ===================================================================== */
const TSV={tab:{ts_so:"so",ts_cc:"so"},ym:{},kh:"bang",nap:null,sl:{},gg:{},dc:{}};
TS_DM_MOI.forEach(x=>{if(!SC_DM0.some(y=>y.g===x.g))SC_DM0.push({...x})});
const tsHom=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const tsThangNay=()=>tsHom().slice(0,7);
const tsFin=()=>scFin().ts||{};
const tsAll=()=>tsFin().a||[];
const tsDs=kind=>tsAll().filter(x=>x.kind===kind);
const tsTu=()=>tsFin().tu||"2026-11";
const tsN=v=>Math.round(+v||0).toLocaleString("vi-VN"),tsYm=ym=>ym?ym.slice(5)+"/"+ym.slice(0,4):"",tsDmy=d=>d?String(d).slice(0,10).split("-").reverse().join("/"):"—";
const tsCanXem=()=>scSecret(),tsCanGhi=()=>scCanDuyet();
const tsTen=kind=>kind==="TS"?"tài sản":"công cụ";
/* Dòng nạp đầu kỳ đủ số: có tên, giá trị, chia đủ 100%, còn tháng để tính hoặc đã hết giá trị. */
const tsNapOk=a=>!!a.ten&&a.gk>0&&tsBpOk(a.bp)&&(+a.dk.con>0||+a.dk.lk>=a.gk);
/* Danh mục chi phí đã lưu riêng (fin.cpdm) thì thêm hai nhóm mới G25, G26 nếu thiếu. */
function tsDmEnsure(dt){const L=dt.fin.cpdm;if(L&&L.length)TS_DM_MOI.forEach(x=>{if(!L.some(y=>y.g===x.g))L.push({...x})})}
function tsMut(msg,fn){DB.mutate(ME.name,msg,dt=>{dt.fin=dt.fin||{};const T=dt.fin.ts=dt.fin.ts||{};T.a=T.a||[];T.run=T.run||{};tsDmEnsure(dt);fn(T,dt)})}
const tsBpTxt=bp=>(bp||[]).map(x=>`${esc((TS_DT[x.o]||[x.o])[0])} ${x.p}%`).join("<br>")||`<span class="hint">chưa chia</span>`;
const tsSc=(c,t)=>`<span class="scp ${c}">${t}</span>`;
const TS_TT={DUNG:["p-ok","Đang dùng"],HET:["p-c","Đã hết"],GIAM:["p-ra","Đã ghi giảm"],CHUA:["p-a","Chưa bắt đầu"],KKH:["p-c","Không khấu hao"]};
/* Các tháng để chọn: từ tháng bắt đầu sớm nhất (tối đa 24 tháng trước) tới tháng sau tháng này. */
function tsThangDs(){const now=tsThangNay(),o=[];let ym=tsYmAdd(now,-24);const s=tsAll().map(a=>(a.s||a.d||tsDoan(a).s||"").slice(0,7)).filter(Boolean).sort()[0];if(s&&s>ym)ym=s;
  for(;ym<=tsYmAdd(now,1);ym=tsYmAdd(ym,1))o.push(ym);return o.reverse()}
const tsYmSel=(id,v)=>`<label class="field" style="margin:0;flex-direction:row;align-items:center;gap:8px;white-space:nowrap">Tháng<select id="${id}">${tsThangDs().map(x=>`<option value="${x}"${x===v?" selected":""}>${tsYm(x)}</option>`).join("")}</select></label>`;
function tsCss(){if(!document.getElementById("sc-css")){const s=document.createElement("style");s.id="sc-css";s.textContent=SC_CSS;document.head.appendChild(s)}}
const tsTabs=(cur,L)=>`<div class="sctabs">${L.map(([k,t])=>`<button class="${cur===k?"on":""}" data-tst="${k}">${t}</button>`).join("")}</div>`;
const tsBpOpt=v=>opt(Object.entries(TS_DT).map(([k,x])=>[k,x[0]+" · "+x[2]]),v);
/* Ô chia bộ phận dùng chung cho ghi tăng và điều chuyển. */
const tsBpRows=bp=>(bp&&bp.length?bp:[{o:"sx",p:100}]).map(x=>`<tr><td><select data-bpo>${tsBpOpt(x.o)}</select></td><td class="n"><input type="number" data-bpp value="${x.p}" min="0" max="100" step="any" style="width:80px"> %</td><td><button type="button" class="lnk" data-bpx>Bỏ</button></td></tr>`).join("");
function tsBpWire(root){const tb=root.querySelector("[data-bpbody]");if(!tb)return;
  const wire=()=>tb.querySelectorAll("[data-bpx]").forEach(b=>b.onclick=()=>{if(tb.rows.length>1)b.closest("tr").remove()});wire();
  const add=root.querySelector("[data-bpadd]");if(add)add.onclick=()=>{tb.insertAdjacentHTML("beforeend",tsBpRows([{o:"ql",p:0}]));wire()}}
const tsBpRead=root=>[...root.querySelectorAll("[data-bpbody] tr")].map(r=>({o:r.querySelector("[data-bpo]").value,p:+r.querySelector("[data-bpp]").value||0})).filter(x=>x.p>0);

/* ---------- Sổ tài sản / Sổ công cụ ---------- */
function pTsSo(m,kind){
  tsCss();const pg=kind==="TS"?"ts_so":"ts_cc";
  if(!tsCanXem()){m.innerHTML=H(kind==="TS"?"Tài sản cố định":"Công cụ dụng cụ")+`<p class="hint">Chỉ CEO và kế toán xem được trang này.</p>`;return}
  const ghi=tsCanGhi(),tab=TSV.tab[pg]||"so",ym=TSV.ym[pg]||tsThangNay(),L=tsDs(kind);
  let body="";
  if(tab==="so"){
    const ng=L.reduce((t,a)=>t+(+(a.gk??a.ng)||0),0),con=L.reduce((t,a)=>t+(tsTrangThai(a,ym)==="GIAM"?0:tsConLai(a,ym)),0),th=L.reduce((t,a)=>t+tsThang(a,ym),0),dung=L.filter(a=>tsTrangThai(a,ym)==="DUNG").length;
    const cho=tsChoGan();
    body=(cho.length&&ghi?`<div class="hint" style="background:#fff8e1;border:1px solid #f5d77a;border-radius:10px;padding:8px 12px;margin:0 0 12px;color:#7a5600">Có <b>${cho.length}</b> phiếu chi nhóm "Mua tài sản / công cụ" chưa ghi tăng (${cho.slice(0,3).map(x=>esc(x.ct||"")+" · "+tsN(x.t)+" đ").join("; ")}${cho.length>3?"…":""}). Bấm ＋ Ghi tăng rồi chọn phiếu ở mục "Mua từ phiếu chi".</div>`:"")+
    `<div class="kpis">${kpi(kind==="TS"?"Nguyên giá":"Giá trị công cụ",money(ng),L.length+" "+tsTen(kind)+" · "+dung+" đang dùng")}${kpi(kind==="TS"?"Giá trị còn lại":"Còn chờ phân bổ (TK 242)",money(con),"cuối tháng "+tsYm(ym))}${kpi((kind==="TS"?"Khấu hao":"Phân bổ")+" tháng "+tsYm(ym),tsN(th)+" đ")}</div>
    <section class="card flush"><div class="card-h pad"><h2>${kind==="TS"?"Sổ tài sản cố định":"Sổ công cụ dụng cụ"}</h2><span class="sp"></span>${tsYmSel("ts-ym",ym)}</div>
    ${L.length?`<div class="tbl"><table><thead><tr><th>Ngày ghi tăng</th><th>Mã</th><th>Tên</th><th>Loại</th><th>Bộ phận chịu</th><th class="n">${kind==="TS"?"Nguyên giá":"Giá trị"}</th><th class="n">Số tháng</th><th class="n">Tháng này</th><th class="n">${kind==="TS"?"Hao mòn lũy kế":"Đã phân bổ"}</th><th class="n">Còn lại</th><th>Trạng thái</th></tr></thead><tbody>
    ${L.slice().sort((a,b)=>(a.d||"").localeCompare(b.d||"")||a.ma.localeCompare(b.ma)).map(a=>{const st=TS_TT[tsTrangThai(a,ym)],lk=tsLuyKe(a,ym);
      return `<tr data-tsid="${esc(a.id)}" style="cursor:pointer"><td>${tsDmy(a.d)}</td><td class="mono">${esc(a.ma)}</td><td><b>${esc(a.ten)}</b>${a.dk?` <small class="hint">đầu kỳ</small>`:""}</td><td>${esc(a.loai||"")}</td><td>${tsBpTxt(tsBpTai(a,ym))}</td><td class="n">${tsN(a.gk??a.ng)}</td><td class="n">${a.kkh?"—":tsN(a.n)}</td><td class="n">${tsN(tsThang(a,ym))}</td><td class="n">${tsN(lk)}</td><td class="n">${tsN(Math.max(0,(+(a.gk??a.ng)||0)-lk))}</td><td>${tsSc(st[0],st[1])}</td></tr>`}).join("")}
    <tr class="tot"><td colspan="5">Cộng</td><td class="n">${tsN(ng)}</td><td></td><td class="n">${tsN(th)}</td><td class="n">${tsN(L.reduce((t,a)=>t+tsLuyKe(a,ym),0))}</td><td class="n">${tsN(L.reduce((t,a)=>t+tsConLai(a,ym),0))}</td><td></td></tr></tbody></table></div>
    <p class="hint pad" style="margin:0">Bấm vào một dòng để xem lịch ${kind==="TS"?"khấu hao":"phân bổ"} từng tháng và sửa.</p>`
    :`<p class="hint pad">Chưa có ${tsTen(kind)} nào. ${ghi?`Vào tab <b>Khai báo đầu kỳ</b> để nạp file xuất từ MISA, hoặc bấm <b>＋ Ghi tăng</b>.`:""}</p>`}</section>`}
  else if(tab==="gg")body=tsGgTab(kind,ghi);
  else if(tab==="dk")body=tsDkTab(kind,ghi);
  else body=tsLuatTab();
  m.innerHTML=`<div class="sochi">${H(kind==="TS"?"Tài sản cố định":"Công cụ dụng cụ",kind==="TS"?"Tài sản dùng trên 1 năm, giá từ 30 triệu · khấu hao đường thẳng tính theo ngày · hạch toán Thông tư 133":"Đồ dùng chưa đủ là tài sản cố định và các khoản trả trước · chia dần vào chi phí (TK 242), tính theo ngày")}
   <div class="filters" style="justify-content:flex-end">${ghi?`<button class="btn pri" id="ts-new">＋ Ghi tăng ${tsTen(kind)}</button>`:""}<button class="btn" data-go="ts_kh">${kind==="TS"?"Khấu hao":"Phân bổ"} tháng</button>${L.length?`<button class="btn" id="ts-xl">Tải Excel</button>`:""}</div>
   ${tsTabs(tab,[["so",kind==="TS"?"Sổ tài sản":"Sổ công cụ"],["gg","Ghi giảm & điều chuyển"],["dk","Khai báo đầu kỳ"]].concat(kind==="CC"?[["luat","Cách chia"]]:[]))}${body}</div>`;
  const $m=s=>m.querySelector(s);
  m.querySelectorAll("[data-tst]").forEach(b=>b.onclick=()=>{TSV.tab[pg]=b.dataset.tst;renderMain()});
  m.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{PAGE=b.dataset.go;render();scrollTo(0,0)});
  if($m("#ts-ym"))$m("#ts-ym").onchange=e=>{TSV.ym[pg]=e.target.value;renderMain()};
  if($m("#ts-new"))$m("#ts-new").onclick=()=>tsForm(kind);
  if($m("#ts-xl"))$m("#ts-xl").onclick=()=>tsXuat(kind,ym);
  m.querySelectorAll("tr[data-tsid]").forEach(r=>r.onclick=()=>tsForm(kind,tsAll().find(a=>a.id===r.dataset.tsid)));
  if(tab==="gg")tsGgWire(m,kind);if(tab==="dk")tsDkWire(m,kind);
}
function tsLuatTab(){return `<section class="card flush"><div class="card-h pad"><h2>Cách web chia công cụ dụng cụ</h2></div><div class="tbl"><table><thead><tr><th>Kiểu</th><th>Khi nào</th><th>Web làm gì</th></tr></thead><tbody>
  <tr><td>${tsSc("p-a","Phân bổ 1 lần")}</td><td>Dưới 2 triệu, dùng ngắn</td><td>Đặt số tháng = 1: vào chi phí ngay tháng mua, vẫn ghi sổ để biết đồ đang ở bộ phận nào</td></tr>
  <tr><td>${tsSc("p-ok","Nhiều kỳ")}</td><td>Từ 2 triệu đến dưới 30 triệu</td><td>Mặc định 12 tháng (sửa được từng món), tháng đầu tính theo ngày</td></tr>
  <tr><td>${tsSc("p-b","Trả trước")}</td><td>Tiền thuê văn phòng, xưởng, phần mềm trả nhiều tháng</td><td>Chia đều đúng số tháng đã trả</td></tr>
  <tr><td>${tsSc("p-ra","Thành tài sản cố định")}</td><td>Từ 30 triệu và dùng trên 1 năm</td><td>Ghi ở trang Tài sản cố định</td></tr></tbody></table></div></section>`}
/* Phiếu chi nhóm G26 chưa gắn với tài sản nào. */
function tsChoGan(){const gan=new Set(tsAll().map(a=>a.nkc).filter(Boolean));return ((scFin().nkc)||[]).filter(x=>x.g===TS_NHOM.MUA&&!gan.has(x.id))}
function tsXuat(kind,ym){if(typeof XLSX==="undefined"){toast("Cần mạng để tạo file Excel");return}
  const rows=[["Ngày ghi tăng","Mã","Tên","Loại","Bộ phận chịu","Giá trị","Số tháng","Tháng "+tsYm(ym),"Lũy kế","Còn lại","Trạng thái"]].concat(tsDs(kind).map(a=>[tsDmy(a.d),a.ma,a.ten,a.loai||"",tsBpTai(a,ym).map(x=>(TS_DT[x.o]||[x.o])[0]+" "+x.p+"%").join("; "),+(a.gk??a.ng)||0,a.n||0,tsThang(a,ym),tsLuyKe(a,ym),tsConLai(a,ym),TS_TT[tsTrangThai(a,ym)][1]]));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),kind==="TS"?"TSCD":"CCDC");XLSX.writeFile(wb,(kind==="TS"?"so-tai-san-":"so-cong-cu-")+ym+".xlsx")}

/* ---------- Ghi tăng / sửa (ngăn bên phải, như Ghi phiếu chi) ---------- */
function tsForm(kind,a){
  const ghi=tsCanGhi(),moi=!a,x=a||{kind,loai:TS_LOAI[kind][0],d:tsHom(),s:tsHom(),n:kind==="TS"?60:12,bp:[{o:"sx",p:100}]};
  const cho=tsChoGan().concat(a&&a.nkc?((scFin().nkc)||[]).filter(r=>r.id===a.nkc):[]);
  const goi=((scFin().nkc)||[]).filter(r=>r.src!=="ts"&&+r.t>=500000&&r.d>=tsAddD(tsHom(),-120)&&!cho.includes(r)&&!tsAll().some(z=>z.nkc===r.id)).sort((p,q)=>q.d.localeCompare(p.d)).slice(0,60);
  const pcOpt=[["","Không gắn (mua nợ nhà cung cấp, tài sản có sẵn…)"]].concat(cho.map(r=>[r.id,`${r.ct||""} · ${tsDmy(r.d)} · ${tsN(r.t)} đ · ${String(r.dg||"").slice(0,50)}`]),goi.map(r=>[r.id,`${r.ct||""} · ${tsDmy(r.d)} · ${tsN(r.t)} đ · ${String(r.dg||"").slice(0,50)} (khác nhóm)`]));
  const L=tsLich(x),ks=Object.keys(L),run=tsFin().run||{};
  const lich=moi?"":`<h3 style="margin:16px 0 6px">Lịch ${kind==="TS"?"khấu hao":"phân bổ"} (${ks.length} tháng)</h3><div class="tbl" style="max-height:260px;overflow:auto"><table><thead><tr><th>Tháng</th><th class="n">Số tiền</th><th class="n">Lũy kế</th><th>Sổ chi phí</th></tr></thead><tbody>${(()=>{let c=tsDoan(x).lk0;return ks.map(k=>{c+=L[k];return `<tr><td>${tsYm(k)}</td><td class="n">${tsN(L[k])}</td><td class="n">${tsN(c)}</td><td>${run[k]?tsSc("p-ok","đã ghi"):""}</td></tr>`}).join("")})()}</tbody></table></div>`;
  const ro=ghi?"":" disabled";
  openDrawerHTML(`<h2>${moi?"Ghi tăng "+(kind==="TS"?"tài sản cố định":"công cụ dụng cụ"):esc(x.ma)+" · "+esc(x.ten)}</h2>
  <p class="hint">${kind==="TS"?"Khấu hao":"Phân bổ"} đường thẳng, tháng đầu tính theo ngày bắt đầu. Khoản chi mua không tính vào chi phí tháng; chỉ phần ${kind==="TS"?"khấu hao":"phân bổ"} từng tháng mới vào Sổ chi phí.</p>
  <form class="frm" id="tsf" onsubmit="return false"><fieldset style="border:0;padding:0;margin:0"${ro}>
   <div class="row4"><label class="field">Mã<input id="tsf-ma" value="${esc(x.ma||"")}" placeholder="VD: MAYDONGNAP" required></label><label class="field grow">Tên<input id="tsf-ten" value="${esc(x.ten||"")}" required></label></div>
   <div class="row4"><label class="field">Loại<select id="tsf-loai">${opt(TS_LOAI[kind].map(v=>[v,v]).concat(TS_LOAI[kind].includes(x.loai)?[]:[[x.loai,x.loai]]),x.loai)}</select></label><label class="field">Ngày ghi tăng<input type="date" id="tsf-d" value="${esc(x.d||"")}"></label></div>
   <div class="row4"><label class="field">${kind==="TS"?"Nguyên giá":"Giá trị"} (đ)<input type="number" id="tsf-g" min="0" value="${+(x.gk??x.ng)||""}"></label><label class="field">Bắt đầu tính từ<input type="date" id="tsf-s" value="${esc(x.s||x.d||"")}"></label><label class="field">Số tháng<input type="number" id="tsf-n" min="1" step="1" value="${+x.n||""}"></label></div>
   ${x.dk?`<div class="row4"><label class="field">Hao mòn đến hết tháng ${tsYm(tsYmAdd(x.dk.tu,-1))} (đ)<input type="number" id="tsf-lk" value="${+x.dk.lk||0}"></label><label class="field">Số tháng còn lại từ ${tsYm(x.dk.tu)}<input type="number" id="tsf-con" value="${+x.dk.con||0}"></label></div>`:""}
   <p class="hint" id="tsf-o"></p>
   ${kind==="TS"?`<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="tsf-kkh" style="width:auto"${x.kkh?" checked":""}> Không tính khấu hao (đất, tài sản chờ thanh lý)</label>`:""}
   <h3 style="margin:14px 0 6px">Ai chịu chi phí</h3>
   <div class="tbl"><table><thead><tr><th>Đối tượng · TK</th><th class="n">Tỷ lệ</th><th></th></tr></thead><tbody data-bpbody>${tsBpRows(x.bp)}</tbody></table></div>
   <p class="hint">Sản xuất → 154, vào giá thành · Văn phòng → 6422 · Bán hàng chung → 6421, chia kênh theo Quy tắc phân bổ · Một kênh → ghi thẳng kênh đó. Tổng phải đủ 100%. <button type="button" class="lnk" data-bpadd>＋ Thêm dòng</button></p>
   <h3 style="margin:14px 0 6px">Nguồn gốc</h3>
   <div class="row4"><label class="field grow">Mua từ phiếu chi<select id="tsf-pc">${opt(pcOpt,x.nkc||"")}</select></label></div>
   <div class="row4"><label class="field">Nhà cung cấp<input id="tsf-ncc" value="${esc(x.ncc||"")}"></label><label class="field">Số hóa đơn / chứng từ<input id="tsf-ct" value="${esc(x.ct||"")}"></label></div>
   <label class="field">Ghi chú (bộ phận cấu thành, phụ tùng kèm theo, biên bản giao nhận, bảo hành)<textarea id="tsf-gc" rows="2">${esc(x.gc||"")}</textarea></label>
   ${x.gg?`<p class="hint">Đã ghi giảm ngày ${tsDmy(x.gg.d)} (${esc(x.gg.ly||"")}).</p>`:""}
   </fieldset>
   ${ghi?`<div class="filters" style="justify-content:flex-end;margin-top:12px">${!moi&&!Object.keys(run).some(k=>L[k])?`<button type="button" class="btn" id="tsf-del" style="color:#b42318">Xóa</button><span class="sp"></span>`:""}<button type="button" class="btn" id="tsf-x">Đóng</button><button type="button" class="btn pri" id="tsf-ok">${moi?"Ghi tăng":"Lưu"}</button></div>`:""}
  </form>${lich}`);
  const g=id=>document.getElementById(id),root=g("tsf");tsBpWire(root);
  const fo=()=>{const v=+g("tsf-g").value||0,n=+g("tsf-n").value||0,s=g("tsf-s").value;if(!v||!n||!s){g("tsf-o").textContent="";return}
    const L1=tsLich({kind,gk:v,n,s}),k=Object.keys(L1);g("tsf-o").innerHTML=`Mỗi tháng <b>${tsN(v/n)} đ</b>. Tháng đầu ${tsYm(k[0])}: <b>${tsN(L1[k[0]])} đ</b>; tháng cuối ${tsYm(k[k.length-1])}: <b>${tsN(L1[k[k.length-1]])} đ</b> (nhận phần lẻ).`};
  ["tsf-g","tsf-n","tsf-s"].forEach(i=>g(i).oninput=fo);fo();
  g("tsf-d").onchange=()=>{if(!g("tsf-s").value||moi)g("tsf-s").value=g("tsf-d").value;fo()};
  if(!ghi)return;
  g("tsf-x").onclick=closeDrawer;
  if(g("tsf-del"))g("tsf-del").onclick=()=>{const b=g("tsf-del");if(b.dataset.ok!=="1"){b.dataset.ok="1";b.textContent="Bấm lần nữa để xóa";return}
    tsMut("xóa "+tsTen(kind)+" "+x.ma,T=>{T.a=T.a.filter(z=>z.id!==x.id)});closeDrawer();toast("Đã xóa");renderMain()};
  g("tsf-ok").onclick=()=>{
    const v={ma:g("tsf-ma").value.trim(),ten:g("tsf-ten").value.trim(),loai:g("tsf-loai").value,d:g("tsf-d").value,s:g("tsf-s").value||g("tsf-d").value,gk:+g("tsf-g").value||0,n:Math.round(+g("tsf-n").value||0),
      kkh:!!(g("tsf-kkh")&&g("tsf-kkh").checked),bp:tsBpRead(root),nkc:g("tsf-pc").value||"",ncc:g("tsf-ncc").value.trim(),ct:g("tsf-ct").value.trim(),gc:g("tsf-gc").value.trim()};
    const loi=!v.ma||!v.ten?"Cần mã và tên":!(v.gk>0)?"Cần giá trị":!v.s?"Cần ngày bắt đầu tính":!v.kkh&&!(v.n>=1)?"Cần số tháng":!tsBpOk(v.bp)?"Bộ phận chịu chi phí phải cộng đủ 100%":tsAll().some(z=>z.kind===kind&&z.ma===v.ma&&z.id!==x.id)?"Mã "+v.ma+" đã có":"";
    if(loi){toast(loi);return}
    if(x.dk&&g("tsf-lk")){const lk=+g("tsf-lk").value||0,con=Math.round(+g("tsf-con").value||0);v.dk={...x.dk,lk,con,lich:!!x.dk.lich&&lk===+x.dk.lk&&con===+x.dk.con}}
    tsMut((moi?"ghi tăng ":"sửa ")+tsTen(kind)+" "+v.ma,(T,dt)=>{
      let r=T.a.find(z=>z.id===x.id);if(!r){r={id:uid("ts"),kind,by:ME.name,at:Date.now()};T.a.push(r)}
      const cu=r.nkc;Object.assign(r,v,{ng:v.gk,sua:Date.now()});
      const N=dt.fin.nkc||[];
      if(cu&&cu!==v.nkc){const p=N.find(z=>z.id===cu);if(p&&p.g0){p.g=p.g0;p.k=p.k0||p.k;delete p.g0;delete p.tsid}}
      if(v.nkc){const p=N.find(z=>z.id===v.nkc);if(p){if(p.g!==TS_NHOM.MUA){p.g0=p.g;if(p.k0==null)p.k0=p.k;p.g=TS_NHOM.MUA}p.k="Không tính";p.tsid=r.id}}});
    closeDrawer();toast(moi?"Đã ghi tăng":"Đã lưu");renderMain()};
}

/* ---------- Ghi giảm, thanh lý, điều chuyển ---------- */
function tsGgTab(kind,ghi){
  const L=tsDs(kind),dung=L.filter(a=>!a.gg),S=TSV.gg[kind]||(TSV.gg[kind]={id:(dung[0]||{}).id,d:tsHom(),ly:"Thanh lý, bán",thu:0}),a=L.find(z=>z.id===S.id)||dung[0];
  const da=L.filter(z=>z.gg);
  if(!L.length)return `<p class="hint">Chưa có ${tsTen(kind)} nào.</p>`;
  const tl=a&&!a.gg?tsThanhLy(a,S.d,S.thu):null;
  const D=TSV.dc[kind]||(TSV.dc[kind]={id:(dung[0]||{}).id,tu:tsYmAdd(tsThangNay(),1)}),b=L.find(z=>z.id===D.id)||dung[0];
  return `${ghi&&a?`<section class="card"><div class="card-h"><h2>Ghi giảm, thanh lý</h2></div><form class="frm" onsubmit="return false"><div class="row4">
    <label class="field">${kind==="TS"?"Tài sản":"Công cụ"}<select id="tsg-a">${opt(dung.map(z=>[z.id,z.ma+" · "+z.ten]),a.id)}</select></label><label class="field">Ngày ghi giảm<input type="date" id="tsg-d" value="${S.d}"></label>
    <label class="field">Lý do<select id="tsg-ly">${opt(["Thanh lý, bán","Hỏng, không dùng được","Mất","Chuyển thành công cụ / tài sản khác"].map(v=>[v,v]),S.ly)}</select></label><label class="field">Tiền thu về (đ)<input type="number" id="tsg-t" min="0" value="${S.thu}"></label></div></form>
    ${tl?`<p>Tính đến hết ngày trước ngày ghi giảm: ${kind==="TS"?"hao mòn":"đã phân bổ"} <b>${tsN(tl.lk)} đ</b>, còn lại <b>${tsN(tl.con)} đ</b>.</p>
    <p class="hint">Phần còn lại là chi phí khác (TK 811), tiền thu là thu nhập khác (TK 711): ${tl.lai>=0?pill("lãi "+tsN(tl.lai)+" đ","grn"):pill("lỗ "+tsN(-tl.lai)+" đ","red")}. Hai khoản này kế toán ghi ở MISA; web dừng ${kind==="TS"?"khấu hao":"phân bổ"} từ ngày ghi giảm.</p>`:""}
    <div class="filters" style="justify-content:flex-end"><button class="btn pri" id="tsg-ok">Ghi giảm</button></div></section>`:""}
   ${ghi&&b?`<section class="card"><div class="card-h"><h2>Điều chuyển bộ phận</h2></div><form class="frm" id="tsdc" onsubmit="return false"><div class="row4">
    <label class="field">${kind==="TS"?"Tài sản":"Công cụ"}<select id="tsd-a">${opt(dung.map(z=>[z.id,z.ma+" · "+z.ten]),b.id)}</select></label><label class="field">Từ tháng<input type="month" id="tsd-tu" value="${D.tu}"></label></div>
    <p class="hint">Đang chịu: ${tsBpTxt(tsBpTai(b,D.tu)).replace(/<br>/g," · ")}</p>
    <div class="tbl"><table><thead><tr><th>Chuyển thành</th><th class="n">Tỷ lệ</th><th></th></tr></thead><tbody data-bpbody>${tsBpRows(tsBpTai(b,D.tu))}</tbody></table></div>
    <p class="hint">Từ tháng điều chuyển, chi phí chia theo tỷ lệ mới; các tháng trước giữ nguyên. <button type="button" class="lnk" data-bpadd>＋ Thêm dòng</button></p></form>
    ${(b.dc||[]).length?`<p class="hint">Đã điều chuyển: ${(b.dc||[]).map(v=>"từ "+tsYm(v.tu)+": "+tsBpTxt(v.bp).replace(/<br>/g,", ")).join(" · ")}</p>`:""}
    <div class="filters" style="justify-content:flex-end"><button class="btn pri" id="tsd-ok">Lưu điều chuyển</button></div></section>`:""}
   <section class="card flush"><div class="card-h pad"><h2>Đã ghi giảm</h2></div>${da.length?`<div class="tbl"><table><thead><tr><th>Ngày</th><th>Mã</th><th>Tên</th><th>Lý do</th><th class="n">Còn lại khi ghi giảm</th><th class="n">Tiền thu</th><th></th></tr></thead><tbody>${da.map(z=>{const t=tsThanhLy({...z,gg:null},z.gg.d,z.gg.thu);
     return `<tr><td>${tsDmy(z.gg.d)}</td><td class="mono">${esc(z.ma)}</td><td>${esc(z.ten)}</td><td>${esc(z.gg.ly||"")}</td><td class="n">${tsN(t.con)}</td><td class="n">${tsN(z.gg.thu)}</td><td>${ghi&&!tsKhoa(z.gg.d.slice(0,7),tsHom())?`<button class="btn sm" data-tsbo="${esc(z.id)}">Bỏ ghi giảm</button>`:""}</td></tr>`}).join("")}</tbody></table></div>`:`<p class="hint pad">Chưa có.</p>`}</section>
   <section class="card"><div class="card-h"><h2>Kiểm kê cuối năm</h2></div><p class="hint">Bấm <b>Tải Excel</b> ở trên để có danh sách theo bộ phận, đánh dấu còn / hỏng / mất, rồi ghi giảm ở đây.</p></section>`}
function tsGgWire(m,kind){const g=id=>m.querySelector("#"+id),S=TSV.gg[kind],D=TSV.dc[kind];
  if(g("tsg-a")){[["tsg-a","id"],["tsg-d","d"],["tsg-ly","ly"],["tsg-t","thu"]].forEach(([i,k])=>g(i).onchange=e=>{S[k]=k==="thu"?+e.target.value||0:e.target.value;renderMain()});
    g("tsg-ok").onclick=()=>{const a=tsAll().find(z=>z.id===S.id)||tsDs(kind).find(z=>!z.gg);if(!a||!S.d){toast("Chọn "+tsTen(kind)+" và ngày");return}
      if(tsKhoa(S.d.slice(0,7),tsHom())){toast("Tháng "+tsYm(S.d.slice(0,7))+" đã chốt, chọn ngày sau");return}
      const b=g("tsg-ok");if(b.dataset.ok!=="1"){b.dataset.ok="1";b.textContent="Bấm lần nữa để ghi giảm "+a.ma;return}
      tsMut("ghi giảm "+a.ma,T=>{const r=T.a.find(z=>z.id===a.id);if(r)r.gg={d:S.d,ly:S.ly,thu:+S.thu||0,by:ME.name,at:Date.now()}});TSV.gg[kind]=null;toast("Đã ghi giảm "+a.ma);renderMain()}}
  if(g("tsd-a")){tsBpWire(g("tsdc"));g("tsd-a").onchange=e=>{D.id=e.target.value;renderMain()};g("tsd-tu").onchange=e=>{D.tu=e.target.value;renderMain()};
    g("tsd-ok").onclick=()=>{const bp=tsBpRead(g("tsdc"));if(!tsBpOk(bp)){toast("Tỷ lệ phải cộng đủ 100%");return}if(!D.tu){toast("Chọn tháng");return}
      if(tsKhoa(D.tu,tsHom())){toast("Tháng "+tsYm(D.tu)+" đã chốt");return}
      tsMut("điều chuyển "+D.id,T=>{const r=T.a.find(z=>z.id===D.id);if(!r)return;r.dc=(r.dc||[]).filter(v=>v.tu!==D.tu).concat([{tu:D.tu,bp,by:ME.name}])});toast("Đã lưu điều chuyển");renderMain()}}
  m.querySelectorAll("[data-tsbo]").forEach(b=>b.onclick=()=>{tsMut("bỏ ghi giảm",T=>{const r=T.a.find(z=>z.id===b.dataset.tsbo);if(r)delete r.gg});renderMain()});
}

/* ---------- Khai báo đầu kỳ: nạp file MISA ---------- */
function tsDkTab(kind,ghi){
  const tu=tsTu(),P=TSV.nap&&TSV.nap.kind===kind?TSV.nap:null,da=tsDs(kind).filter(a=>a.dk);
  const sel=`<label class="field" style="margin:0;flex-direction:row;align-items:center;gap:8px;white-space:nowrap">Web làm chuẩn từ tháng<input type="month" id="tsk-tu" value="${tu}"${ghi?"":" disabled"}></label>`;
  let pv="";
  if(P){const ok=P.items.filter(tsNapOk);
    pv=`<section class="card flush"><div class="card-h pad"><h2>Kiểm tra trước khi ghi: ${P.items.length} ${tsTen(kind)} từ file ${esc(P.file)}</h2></div>
    <p class="hint pad" style="margin:0">Ô vàng là web tự tính theo ngày bắt đầu và số tháng (web là số chuẩn). Cột MISA đã ghi để đối chiếu: số đỏ là MISA lệch web trên 1.000 đ, thường do MISA chưa chạy khấu hao / phân bổ các tháng gần đây. Mã đã có trên web thì ghi đè số đầu kỳ.${P.bo.length?` Bỏ ${P.bo.length} dòng: ${P.bo.slice(0,4).map(x=>"dòng "+x.dong+" ("+esc(x.why)+")").join(", ")}.`:""}</p>
    <div class="tbl"><table><thead><tr><th>Mã</th><th>Tên</th><th>Ngày ghi tăng</th><th class="n">${kind==="TS"?"Nguyên giá":"Giá trị"}</th><th class="n">Số tháng</th><th class="n">${kind==="TS"?"Hao mòn":"Đã phân bổ"} đến hết ${tsYm(tsYmAdd(tu,-1))} (web tính)</th><th class="n">MISA đã ghi</th><th class="n">Tháng còn lại</th><th>Bộ phận chịu</th></tr></thead><tbody>
    ${P.items.map((a,i)=>`<tr><td class="mono">${esc(a.ma)}</td><td>${esc(a.ten)}</td><td>${tsDmy(a.d)}</td><td class="n">${tsN(a.gk)}</td><td class="n"><input type="number" data-pn="${i}" data-f="n" value="${a.n||""}" style="width:70px;text-align:right"></td>
      <td class="n"><input type="number" data-pn="${i}" data-f="lk" value="${a.dk.lk??""}" style="width:130px;text-align:right${a.dk.lkTu?";background:#fff8e1":""}"></td><td class="n">${a.misa&&a.misa.lk!=null?`<span style="color:${Math.abs(a.misa.lk-(+a.dk.lk||0))>1000?"#b42318":"inherit"}">${tsN(a.misa.lk)}</span>`:"—"}</td><td class="n"><input type="number" data-pn="${i}" data-f="con" value="${a.dk.con??""}" style="width:70px;text-align:right${a.dk.conTu?";background:#fff8e1":""}"></td>
      <td><select data-pn="${i}" data-f="bp">${tsBpOpt(a.bp[0].o)}</select></td></tr>`).join("")}</tbody></table></div>
    <div class="filters pad" style="justify-content:flex-end"><span class="hint">${ok.length}/${P.items.length} dòng đủ số</span><button class="btn" id="tsk-huy">Bỏ</button><button class="btn pri" id="tsk-ok"${ok.length?"":" disabled"}>Ghi đầu kỳ ${ok.length} ${tsTen(kind)}</button></div></section>`}
  return `<section class="card"><div class="card-h"><h2>Nạp ${kind==="TS"?"Sổ tài sản cố định":"Sổ theo dõi công cụ dụng cụ"} từ MISA</h2><span class="sp"></span>${sel}</div>
   <p class="hint">Làm một lần khi bắt đầu dùng web. Trong MISA vào ${kind==="TS"?"<b>Tài sản cố định › Sổ tài sản cố định</b>":"<b>Công cụ dụng cụ › Sổ theo dõi công cụ dụng cụ</b>"}, chọn tới hết tháng ${tsYm(tsYmAdd(tu,-1))}, xuất Excel rồi chọn file ở đây. Web đọc cột mã, tên, ngày ghi tăng, ${kind==="TS"?"nguyên giá, thời gian sử dụng, hao mòn lũy kế":"giá trị, số kỳ phân bổ, giá trị đã phân bổ"}, giá trị còn lại.</p>
   ${ghi?`<div class="filters"><input type="file" id="tsk-f" accept=".xlsx,.xls,.csv" style="max-width:340px"></div>`:""}</section>${pv}
   <section class="card flush"><div class="card-h pad"><h2>Đã khai báo đầu kỳ (${da.length})</h2></div>${da.length?`<div class="tbl"><table><thead><tr><th>Mã</th><th>Tên</th><th class="n">Giá trị</th><th class="n">Lũy kế đến hết ${tsYm(tsYmAdd(tu,-1))}</th><th class="n">Còn lại</th><th class="n">Tháng còn lại</th></tr></thead><tbody>${da.map(a=>`<tr data-tsid="${esc(a.id)}" style="cursor:pointer"><td class="mono">${esc(a.ma)}</td><td>${esc(a.ten)}</td><td class="n">${tsN(a.gk)}</td><td class="n">${tsN(a.dk.lk)}</td><td class="n">${tsN((+a.gk||0)-(+a.dk.lk||0))}</td><td class="n">${tsN(a.dk.con)}</td></tr>`).join("")}</tbody></table></div>`:`<p class="hint pad">Chưa có.</p>`}</section>`}
function tsDkWire(m,kind){const g=id=>m.querySelector("#"+id);
  if(g("tsk-tu"))g("tsk-tu").onchange=e=>{const v=e.target.value;if(!v)return;tsMut("đổi tháng web làm chuẩn tài sản "+v,T=>{T.tu=v;(T.a||[]).forEach(a=>{if(!a.dk)return;a.dk.tu=v;if(a.dk.lich)a.dk=tsDienDauKy({...a,dk:{tu:v,lk:null,con:null,lich:true}}).dk})});if(TSV.nap)TSV.nap.items=TSV.nap.items.map(a=>tsDienDauKy({...a,dk:{...a.dk,tu:v,lk:a.dk.lkTu?null:a.dk.lk,con:a.dk.conTu?null:a.dk.con}}));renderMain()};
  if(g("tsk-f"))g("tsk-f").onchange=e=>{const f=e.target.files[0];if(!f)return;if(typeof XLSX==="undefined"){toast("Cần mạng để đọc Excel");return}
    const r=new FileReader();r.onload=()=>{try{const wb=XLSX.read(r.result,{type:"array"});let res=null;
      for(const n of wb.SheetNames){const x=tsDocBang(XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:""}),kind,tsTu());if(!x.err){res=x;break}res=res||x}
      if(res.err){toast(res.err);return}if(!res.items.length){toast("File không có dòng "+tsTen(kind)+" nào có giá trị");return}
      TSV.nap={kind,file:f.name,items:res.items.map(tsDienDauKy),bo:res.bo};renderMain()}catch(err){toast("Không đọc được file: "+err.message)}};r.readAsArrayBuffer(f)};
  m.querySelectorAll("[data-pn]").forEach(el=>el.onchange=()=>{const a=TSV.nap.items[+el.dataset.pn],f=el.dataset.f,v=el.value;
    if(f==="bp")a.bp=[{o:v,p:100}];else if(f==="n"){a.n=Math.round(+v||0);if(a.dk.conTu)a.dk.con=null;if(a.dk.lkTu)a.dk.lk=null;Object.assign(a,tsDienDauKy(a))}else{a.dk[f]=v===""?null:+v;a.dk[f+"Tu"]=false;a.dk.lich=false}renderMain()});
  if(g("tsk-huy"))g("tsk-huy").onclick=()=>{TSV.nap=null;renderMain()};
  if(g("tsk-ok"))g("tsk-ok").onclick=()=>{const P=TSV.nap,ok=P.items.filter(tsNapOk);
    tsMut("khai báo đầu kỳ "+ok.length+" "+tsTen(kind)+" từ "+P.file,T=>{T.tu=T.tu||tsTu();ok.forEach(a=>{const dk={tu:T.tu,lk:+a.dk.lk||0,con:Math.round(+a.dk.con),lich:!!a.dk.lich};
      const r=T.a.find(z=>z.kind===kind&&z.ma===a.ma);if(r)Object.assign(r,{ten:a.ten,loai:a.loai,d:a.d,s:a.s,ng:a.ng,gk:a.gk,n:a.n,bp:a.bp,dk,misa:a.misa,sua:Date.now()});
      else T.a.push({id:uid("ts"),kind,ma:a.ma,ten:a.ten,loai:a.loai,d:a.d,s:a.s,ng:a.ng,gk:a.gk,n:a.n,bp:a.bp,dk,misa:a.misa,src:"misa",by:ME.name,at:Date.now()})})});
    TSV.nap=null;toast("Đã ghi đầu kỳ "+ok.length+" "+tsTen(kind));renderMain()};
  m.querySelectorAll("tr[data-tsid]").forEach(r=>r.onclick=()=>tsForm(kind,tsAll().find(a=>a.id===r.dataset.tsid)));
}

/* ---------- Khấu hao & phân bổ tháng ---------- */
/* Lít bán thành phẩm nhập kho trong tháng (phiếu pha chế), để chia chi phí sản xuất chung. null = đang tải. */
function tsLitKho(ym){if(TSV.sl[ym]!==undefined)return TSV.sl[ym];TSV.sl[ym]=null;
  const[y,mo]=ym.split("-").map(Number),to=ym+"-"+String(tsDim(y,mo)).padStart(2,"0");
  (async()=>{try{if(typeof khoLoad==="function"&&!(KHO.items&&KHO.items.size))await khoLoad();
    const r=await svApi(`/api/hub/kho/nxt?from=${ym}-01&to=${to}`);TSV.sl[ym]=(r||[]).filter(x=>(KHO.items.get(x.code)||{}).cls==="BTP").reduce((t,x)=>t+(+x.qty_in||0),0)}
    catch(e){TSV.sl[ym]=0}if(PAGE==="ts_kh"||PAGE==="kho_boc")renderMain()})();return null}
/* Chi phí sản xuất chung tháng ym: phần khấu hao / phân bổ vào Sản xuất + các dòng khác ở Sổ chi phí ghi cho Sản xuất. */
function tsSxc(ym){const r=tsDongThang(tsAll(),ym),sxTs=r.dong.filter(x=>x.k==="Sản xuất").reduce((t,x)=>t+x.t,0);
  const khac=((scFin().nkc)||[]).filter(x=>x.src!=="ts"&&x.k==="Sản xuất"&&String(x.d||"").slice(0,7)===ym&&x.st!=="Chờ duyệt").reduce((t,x)=>t+(+x.t||0),0);
  const tay=(tsFin().sl||{})[ym],kho=tsLitKho(ym),lit=tay>0?tay:kho;return {sxTs,khac,tong:sxTs+khac,lit,tay:tay>0,dl:lit>0?(sxTs+khac)/lit:null}}
function pTsKh(m){
  tsCss();if(!tsCanXem()){m.innerHTML=H("Khấu hao & phân bổ tháng")+`<p class="hint">Chỉ CEO và kế toán xem được trang này.</p>`;return}
  const ghi=tsCanGhi(),hom=tsHom(),ym=TSV.ym.ts_kh||(+hom.slice(8)<=10?tsYmAdd(tsThangNay(),-1):tsThangNay()),tab=TSV.kh,R=tsDongThang(tsAll(),ym),run=(tsFin().run||{})[ym],khoa=tsKhoa(ym,hom),xong=ym<tsThangNay();
  const ts=R.dong.filter(x=>x.kind==="TS").reduce((t,x)=>t+x.t,0),cc=R.tong-ts,by={};R.dong.forEach(x=>{by[x.k]=(by[x.k]||0)+x.t});
  const misa=((scFin().nkc)||[]).filter(x=>x.src!=="ts"&&String(x.d||"").slice(0,7)===ym&&(/^PBCC/i.test(String(x.ct||""))||x.lct==="Phân bổ CCDC"));
  const misaCon=misa.filter(x=>x.k!=="Không tính"),tuChuan=ym>=tsTu();
  let body="";
  if(tab==="bang"){const S=tsSxc(ym);
    const rows=tsAll().map(a=>{const v=tsThang(a,ym);if(!v)return "";const muc=a.dk&&!a.dk.lich?((+a.gk||0)-(+a.dk.lk||0))/(+a.dk.con||1):(+a.gk||0)/(+a.n||1),ks=Object.keys(tsLich(a)),het=ks[ks.length-1]||"",con=tsConLai(a,ym);
      return `<tr data-tsid="${esc(a.id)}" style="cursor:pointer"><td>${a.kind==="TS"?tsSc("p-a","Tài sản"):tsSc("p-ok","Công cụ")}</td><td class="mono">${esc(a.ma)}</td><td><b>${esc(a.ten)}</b></td><td>${tsDmy(a.s||a.d)}</td><td class="n">${tsN(a.n)}</td><td class="n">${tsN(muc)}</td><td class="n"><b>${tsN(v)}</b></td><td class="n">${tsN(con)}</td><td>${tsYm(het)}${het===ym?" "+tsSc("p-ra","tháng cuối"):""}</td><td>${tsBpTxt(tsBpTai(a,ym))}</td></tr>`}).join("");
    body=`<div class="kpis">${kpi("Khấu hao tài sản",tsN(ts)+" đ")}${kpi("Phân bổ công cụ",tsN(cc)+" đ")}${kpi("Vào sản xuất (TK 154)",tsN(by["Sản xuất"]||0)+" đ","cộng vào giá thành")}${kpi("Vào chi phí bán hàng, quản lý",tsN(R.tong-(by["Sản xuất"]||0))+" đ","6421 chia kênh · 6422 chi chung")}</div>
    ${R.loi.length?`<p class="hint" style="color:#b42318">${R.loi.map(esc).join(" · ")}. Sửa ở sổ rồi mới ghi được.</p>`:""}
    <section class="card flush"><div class="card-h pad"><h2>Bảng tính tháng ${tsYm(ym)}</h2></div>${rows?`<div class="tbl"><table><thead><tr><th>Loại</th><th>Mã</th><th>Tên</th><th>Bắt đầu</th><th class="n">Số tháng</th><th class="n">Mức 1 tháng</th><th class="n">Tháng này</th><th class="n">Còn lại sau tháng này</th><th>Hết vào tháng</th><th>Chia cho</th></tr></thead><tbody>${rows}<tr class="tot"><td colspan="6">Cộng</td><td class="n">${tsN(R.tong)}</td><td colspan="3"></td></tr></tbody></table></div>
     <p class="hint pad" style="margin:0">Chỉ hiện món còn phải tính trong tháng; món đã hết hạn không có ở đây. Mức 1 tháng = giá trị ÷ số tháng; tháng đầu và tháng ghi giảm tính theo số ngày dùng thật, tháng cuối nhận phần lẻ. Tính lại được tới ngày chốt 10 tháng sau.</p>`:`<p class="hint pad">Tháng này không có khoản nào. Nạp tài sản, công cụ ở trang Tài sản cố định / Công cụ dụng cụ › Khai báo đầu kỳ.</p>`}</section>
    <section class="card"><div class="card-h"><h2>Chi phí sản xuất chung vào giá thành</h2></div>
     <div class="tbl"><table><tbody><tr><td>Khấu hao, phân bổ vào sản xuất</td><td class="n">${tsN(S.sxTs)} đ</td></tr><tr><td>Khoản khác ở Sổ chi phí ghi cho Sản xuất (lương xưởng, điện, vật tư…)</td><td class="n">${tsN(S.khac)} đ</td></tr>
     <tr><td>Bán thành phẩm pha chế nhập kho trong tháng (lít) ${S.tay?`<span class="hint">· nhập tay</span>`:`<span class="hint">· từ kho</span>`}</td><td class="n">${S.lit==null?"đang tải…":ghi?`<input type="number" id="tsk-lit" value="${Math.round(S.lit)||""}" placeholder="nhập số lít" style="width:120px;text-align:right">`:tsN(S.lit)}</td></tr>
     <tr class="tot"><td>Chi phí sản xuất chung / 1 lít</td><td class="n">${S.dl!=null?tsN(S.dl)+" đ":"—"}</td></tr></tbody></table></div>
     <p class="hint">Giá thành đầy đủ 1 sản phẩm = nguyên vật liệu (trang Định mức &amp; giá thành) + số lít bán thành phẩm trong định mức × ${S.dl!=null?tsN(S.dl):"…"} đ. ${S.lit===0?"Kho chưa có phiếu pha chế tháng này nên chị nhập số lít sản xuất thật vào ô trên.":""}</p></section>`}
  else if(tab==="bt"){const G={};R.dong.forEach(x=>{const k=x.tkn+"|"+x.tkc+"|"+x.k;G[k]=(G[k]||0)+x.t});
    body=`<section class="card flush"><div class="card-h pad"><h2>Bút toán tháng ${tsYm(ym)}</h2></div>${R.dong.length?`<div class="tbl"><table><thead><tr><th>Nợ</th><th>Có</th><th>Chịu chi phí</th><th class="n">Số tiền</th><th>Hiện ở</th></tr></thead><tbody>
     ${Object.entries(G).map(([k,v])=>{const[no,co,kk]=k.split("|");return `<tr><td>${no}</td><td>${co}</td><td>${esc(kk)}</td><td class="n">${tsN(v)}</td><td>${kk==="Sản xuất"?"Giá thành, P&L Sản xuất":kk==="Chung"?"Sổ chi phí · chi chung, chia theo Quy tắc phân bổ":"Sổ chi phí · kênh "+esc(kk)}</td></tr>`}).join("")}
     <tr class="tot"><td colspan="3">Cộng</td><td class="n">${tsN(R.tong)}</td><td></td></tr></tbody></table></div>`:`<p class="hint pad">Không có bút toán.</p>`}
     <p class="hint pad" style="margin:0">Khi bấm Ghi, mỗi tài sản thành một dòng ở Sổ chi phí, chứng từ <span class="mono">TS-${ym}</span>: tài sản cố định nhóm G25 "Khấu hao tài sản cố định", công cụ nhóm G14 "Phân bổ CCDC".</p></section>`}
  else body=`<section class="card flush"><div class="card-h pad"><h2>Đối chiếu MISA tháng ${tsYm(ym)}</h2></div><div class="tbl"><table><thead><tr><th>Khoản</th><th class="n">Web</th><th class="n">MISA (đã nạp vào Sổ chi phí)</th><th class="n">Lệch</th></tr></thead><tbody>
     <tr><td>Phân bổ công cụ dụng cụ (TK 242)</td><td class="n">${tsN(cc)}</td><td class="n">${misa.length?tsN(misa.reduce((t,x)=>t+(+x.t||0),0)):"chưa nạp"}</td><td class="n">${misa.length?tsN(cc-misa.reduce((t,x)=>t+(+x.t||0),0)):"—"}</td></tr>
     <tr><td>Khấu hao tài sản cố định (TK 2141)</td><td class="n">${tsN(ts)}</td><td class="n hint">xem sổ cái 2141 ở MISA</td><td class="n">—</td></tr></tbody></table></div>
     <p class="hint pad" style="margin:0">Web là số chuẩn, MISA để đối chiếu. Lệch thì xem lại số tháng hoặc ngày bắt đầu của từng món.</p></section>`;
  const nut=!ghi?"":ym<tsTu()?`<span class="hint">Trước tháng web làm chuẩn (${tsYm(tsTu())}): số này để xem, kế toán vẫn ghi ở MISA</span>`:!xong?`<span class="hint">Tháng chưa hết, chưa ghi được</span>`:khoa?`<span class="hint">Tháng đã chốt (qua ngày 10)</span>`:`<button class="btn pri" id="tsk-run"${R.loi.length||!R.dong.length&&!run?" disabled":""}>${run?"Ghi lại":"Ghi vào Sổ chi phí"} tháng ${tsYm(ym)}</button>`;
  m.innerHTML=`<div class="sochi">${H("Khấu hao & phân bổ tháng","Mỗi tháng bấm Ghi một lần trước ngày chốt 10 · số tự hiện ở Sổ chi phí và giá thành")}
   <div class="filters" style="justify-content:flex-end;align-items:center">${tsYmSel("tsk-ym",ym)}<span class="sp"></span>${run?pill("Đã ghi "+tsN(run.t)+" đ · "+esc(run.by||""),"grn"):""}${nut}</div>
   ${run&&run.t!==R.tong?`<p class="hint" style="color:#b42318">Số đã ghi (${tsN(run.t)} đ) khác số tính lại (${tsN(R.tong)} đ) vì tài sản vừa được sửa.${!khoa&&ghi?" Bấm Ghi lại để cập nhật Sổ chi phí.":""}</p>`:""}
   ${ghi&&xong&&!khoa&&tuChuan&&misaCon.length?`<label class="hint" style="display:flex;gap:6px;align-items:center;margin:0 0 10px"><input type="checkbox" id="tsk-misa" checked style="width:auto"> Khi ghi, chuyển ${misaCon.length} dòng phân bổ CCDC nạp từ MISA tháng này (${tsN(misaCon.reduce((t,x)=>t+(+x.t||0),0))} đ) sang "Không tính" để không cộng hai lần</label>`:""}
   ${tsTabs(tab,[["bang","Bảng tính"],["bt","Bút toán"],["dc","Đối chiếu MISA"]])}${body}</div>`;
  const $m=s=>m.querySelector(s);
  m.querySelectorAll("[data-tst]").forEach(b=>b.onclick=()=>{TSV.kh=b.dataset.tst;renderMain()});
  $m("#tsk-ym").onchange=e=>{TSV.ym.ts_kh=e.target.value;renderMain()};
  m.querySelectorAll("tr[data-tsid]").forEach(r=>r.onclick=()=>{const a=tsAll().find(z=>z.id===r.dataset.tsid);if(a)tsForm(a.kind,a)});
  if($m("#tsk-lit"))$m("#tsk-lit").onchange=e=>{const v=+e.target.value||0;tsMut("sản lượng pha chế "+ym,T=>{T.sl=T.sl||{};if(v>0)T.sl[ym]=v;else delete T.sl[ym]});renderMain()};
  if($m("#tsk-run"))$m("#tsk-run").onclick=()=>{const b=$m("#tsk-run"),bo=$m("#tsk-misa")&&$m("#tsk-misa").checked;
    if(b.dataset.ok!=="1"){b.dataset.ok="1";b.textContent=`Bấm lần nữa: ghi ${R.dong.length} dòng, ${tsN(R.tong)} đ`;return}
    const d=ym+"-"+String(tsDim(+ym.slice(0,4),+ym.slice(5))).padStart(2,"0"),ct="TS-"+ym;
    tsMut((run?"ghi lại ":"ghi ")+"khấu hao, phân bổ tháng "+tsYm(ym),(T,dt)=>{const N=dt.fin.nkc=(dt.fin.nkc||[]).filter(x=>!(x.src==="ts"&&x.ct===ct));
      R.dong.forEach(x=>N.push({id:uid("nk"),d,ct,lct:x.kind==="TS"?"Khấu hao TSCĐ":"Phân bổ CCDC",dg:(x.kind==="TS"?"Khấu hao ":"Phân bổ ")+x.ten+" tháng "+tsYm(ym)+(x.p<100?" ("+x.p+"%)":""),tk:x.tkc,t:x.t,g:x.g,k:x.k,st:"Ổn",gc:"Nợ "+x.tkn+" · "+x.on,bp:x.on,src:"ts",tsid:x.id,by:ME.name,duyet:ME.name,at:Date.now()}));
      if(bo)N.forEach(x=>{if(misaCon.some(z=>z.id===x.id)){if(x.k0==null)x.k0=x.k;x.k="Không tính";x.gc=((x.gc||"")+" · web đã tính phân bổ CCDC tháng này").replace(/^ · /,"")}});
      T.run[ym]={at:Date.now(),by:ME.name,t:R.tong,n:R.dong.length}});
    toast("Đã ghi "+R.dong.length+" dòng vào Sổ chi phí");renderMain()};
}

/* Giá thành: thêm ô chi phí sản xuất chung dưới trang Định mức & giá thành (chỉ người xem được Sổ chi phí). */
{const _b=PAGES.kho_boc;if(_b)PAGES.kho_boc=function(m){const r=_b.apply(this,arguments);try{if(tsCanXem()&&tsAll().length){const ym=tsYmAdd(tsThangNay(),-1),S=tsSxc(ym);
  m.insertAdjacentHTML("beforeend",`<div style="height:12px"></div><section class="card"><div class="card-h"><h2>Chi phí sản xuất chung tháng ${tsYm(ym)}</h2><span class="sp"></span><button class="btn sm" data-tsgo>Xem chi tiết</button></div>
   <p>Khấu hao, phân bổ vào sản xuất <b>${tsN(S.sxTs)} đ</b> + khoản khác của xưởng <b>${tsN(S.khac)} đ</b> ÷ ${S.lit?tsN(S.lit)+" lít bán thành phẩm":"(chưa có số lít)"} = <b>${S.dl!=null?tsN(S.dl)+" đ / lít":"—"}</b>.</p>
   <p class="hint">Giá thành đầy đủ 1 sản phẩm = giá nguyên vật liệu ở trên + số lít bán thành phẩm trong định mức × chi phí / lít.</p></section>`);
  const b=m.querySelector("[data-tsgo]");if(b)b.onclick=()=>{PAGE="ts_kh";TSV.ym.ts_kh=ym;render();scrollTo(0,0)}}}catch(e){}return r}}

Object.assign(PAGES,{ts_so:m=>pTsSo(m,"TS"),ts_cc:m=>pTsSo(m,"CC"),ts_kh:pTsKh});
{const xem=u=>!!u&&(u.role==="admin"||can(u,"chiphi.xem")||mhPerm("order.accounting.confirm"));
 MODULES.push({k:"ts_mod",ic:"fin",n:"Tài sản & CCDC",adm:true,hide:true,groups:()=>[["",[MI("ts_so","Tài sản cố định",xem),MI("ts_cc","Công cụ dụng cụ",xem),MI("ts_kh","Khấu hao & phân bổ tháng",xem)]]]})}
