/* =====================================================================
   TỒN KHO DÙNG CHUNG HAI WEB (chuẩn hóa 27/10/2026). Định nghĩa chỉ số: đầu file khocalc.js.
   Một nguồn số: /api/hub/kho/ton (máy chủ, src/server/services/khoTon.ts). Các trang chỉ đọc từ đây:
   - Vận hành: Kho vật tư (kho_ton), Kho thành phẩm (sx_kho, qua sxStock), Tổng quan (execStock), Trung tâm điều hành.
   - Quản trị: Tổng quan công ty (execStock), Tồn kho & giá trị (kho_gtri), Đối chiếu tồn kho (kho_dc, trang mới).
   Trước đây Tổng quan công ty đếm "Sắp hết / âm kho" từ ngăn Sản xuất (lô, thùng/khay) còn Kho vật tư đếm từ sổ kho:
   hai nguồn khác nhau nên một bên báo 34 mã âm, một bên báo 0. Nay mọi trang đếm từ sổ kho.
   Trang này chỉ ĐỌC: không sửa số tồn, không sửa phiếu.
   ===================================================================== */
const KTON={rows:null,by:new Map(),today:null,at:0,busy:false,err:"",dc:null,dcKey:"",f:{nhom:"",loc:"am",q:""}};
function ktonLoad(force){
  if(KTON.busy||(!force&&KTON.rows&&Date.now()-KTON.at<20000))return;KTON.busy=true;
  const t=typeof kToday==="function"?kToday():new Date().toISOString().slice(0,10);
  Promise.all([svApi("/api/hub/kho/ton"),svApi(`/api/hub/kho/nxt?from=${t}&to=${t}`).catch(()=>[])]).then(([r,n])=>{
    KTON.rows=r.rows||[];KTON.by=new Map(KTON.rows.map(x=>[x.code,x]));KTON.today=new Map((n||[]).map(x=>[x.code,x]));KTON.at=Date.now();KTON.err=""})
   .catch(e=>{KTON.err=e.message||"Không tải được tồn kho"}).finally(()=>{KTON.busy=false;if(typeof renderMain==="function"&&!document.querySelector("#drawer:not([hidden])"))renderMain()});
}
const ktonRow=c=>KTON.by.get(c)||null;
const KTON_SRC="Nguồn: sổ kho (phiếu kho còn hiệu lực + đơn Kênh phân phối đã xuất + hàng trả về + xuất sàn theo ngày). Đối chiếu từng phiếu ở quản trị › Tài chính – Kế toán › Tồn kho › Đối chiếu tồn kho.";
/* Ghi nguồn số dưới ô chỉ số: tìm ô .kpi theo nhãn và thêm một dòng nhỏ. */
function ktonTag(m,map){if(!m)return;m.querySelectorAll(".kpi").forEach(k=>{const l=(k.querySelector(".l")||{}).textContent||"";const t=map[l.trim()];if(t&&!k.querySelector(".ksrc")){const kb=k.querySelector(".kb")||k;kb.insertAdjacentHTML("beforeend",`<div class="ksrc hint" style="font-size:11px;line-height:1.3;margin-top:3px">${t}</div>`)}})}
function ktonFoot(m,txt){if(m&&!m.querySelector(".ktonfoot"))m.insertAdjacentHTML("beforeend",`<p class="hint pad ktonfoot">${txt||KTON_SRC}</p>`)}

/* ---------- Tổng quan (hai web): tồn từ sổ kho, không từ ngăn Sản xuất ---------- */
if(typeof execStock==="function"){execStock=function(){
  ktonLoad();if(!KTON.rows)return null;const T=KTON.today||new Map();
  return KTON.rows.filter(r=>r.active||r.trang_thai==="AM").map(r=>{const d=T.get(r.code)||{},st=r.trang_thai!=="DU"?KHO_TT[r.trang_thai]:r.dang_sx>0?["Đang sản xuất","blu"]:KHO_TT.DU;
    return {code:r.code,ten:r.name,ton:r.ton,nhap:+d.qty_in||0,xuat:+d.qty_out||0,st}}).filter(r=>r.ton||r.nhap||r.xuat)
   .sort((a,b)=>(b.st[1]==="red")-(a.st[1]==="red")||(b.nhap+b.xuat)-(a.nhap+a.xuat)||b.ton-a.ton)}}
{const _ex=PAGES.exec;if(_ex)PAGES.exec=function(m){const r=_ex.apply(this,arguments);try{if(KTON.rows){const n=KTON.rows.filter(x=>x.trang_thai==="AM").length,s=KTON.rows.filter(x=>x.trang_thai==="SAP_HET"&&x.active).length;
  m.querySelectorAll(".xblk").forEach(b=>{const h=b.querySelector("h2");if(h&&/Sản xuất & kho/.test(h.textContent)&&!b.querySelector(".ksrc"))b.insertAdjacentHTML("beforeend",`<div class="ksrc hint" style="font-size:11px;padding:0 14px 10px">Sắp hết / âm kho = ${nf(s)} sắp hết + ${nf(n)} âm, đếm từ sổ kho (cùng số Kho vật tư bên vận hành).</div>`)})}}catch(e){}return r}}

/* ---------- Sản xuất › Kho thành phẩm, Trung tâm điều hành: "sẵn sàng bán" = tồn thực tế theo sổ kho ---------- */
if(typeof sxStock==="function"){const _ss=sxStock;sxStock=function(){
  const L=_ss();ktonLoad();if(!KTON.rows)return L;const seen=new Set();
  L.forEach(o=>{const r=ktonRow(o.sp);seen.add(o.sp);o.lo=o.san;o.san=r?r.ton:0;o.xuatB2B=0;if(r)o.kton=r});
  KTON.rows.filter(r=>r.nhom==="TP"&&!seen.has(r.code)&&(r.ton||r.dang_sx)).forEach(r=>L.push({sp:r.code,san:r.ton,thung:0,khay:0,cho:0,loi:0,choNhap:0,dangLam:0,canLam:0,kton:r}));
  return L.sort((a,b)=>a.san-b.san)}}
{const _sk=PAGES.sx_kho;if(_sk)PAGES.sx_kho=function(m){const r=_sk.apply(this,arguments);try{const n=m.querySelector(".note");if(n&&!m.querySelector(".ktonfoot"))n.insertAdjacentHTML("afterend",`<p class="hint ktonfoot"><b>Sẵn sàng bán</b> = tồn thực tế theo sổ kho (cùng số Kho vật tư, Tồn kho & giá trị). Cột thùng / khay là số lô bàn giao ban đầu ở Sản xuất, chỉ để tra vị trí.</p>`)}catch(e){}return r}}

/* ---------- Kho vật tư (vận hành) và Tồn kho & giá trị (quản trị): ghi nguồn dưới ô ---------- */
{const _kt=PAGES.kho_ton;if(_kt)PAGES.kho_ton=function(m){ktonLoad();const r=_kt.apply(this,arguments);
  ktonTag(m,{"Mã đang có tồn":"tồn thực tế khác 0, mã đang dùng","Dưới mức tối thiểu":"sắp hết: tồn khả dụng dưới định mức an toàn","Tồn âm (cần kiểm tra)":"tồn thực tế < 0 theo sổ kho"});ktonFoot(m);return r}}
{const _kg=PAGES.kho_gtri;if(_kg)PAGES.kho_gtri=function(m){ktonLoad();const r=_kg.apply(this,arguments);
  ktonTag(m,{"Tổng giá trị tồn kho":"phần tồn dương × giá bình quân gia quyền"});
  if(KTON.rows&&m.querySelector(".grid.kpis")&&!m.querySelector(".ktonam")){const n=KTON.rows.filter(x=>x.trang_thai==="AM").length;if(n)m.querySelector(".grid.kpis").insertAdjacentHTML("beforeend",`<div class="ktonam" style="display:contents">${kpi("Mã âm kho",nf(n),"không tính vào giá trị · xem Đối chiếu tồn kho","#b42318")}</div>`)}
  ktonFoot(m);return r}}

/* ---------- Trang mới (quản trị): ĐỐI CHIẾU TỒN KHO ---------- */
const kdcOk=()=>typeof mhManage==="function"&&mhManage();
function kdcLoad(P){const key=P.from+"|"+P.to;if(KTON.dcKey===key&&KTON.dc)return;KTON.dcKey=key;KTON.dc={busy:true};
  svApi(`/api/hub/kho/doi-chieu?from=${P.from}&to=${P.to}`).then(r=>{if(KTON.dcKey===key)KTON.dc=r}).catch(e=>{KTON.dc={err:e.message}}).finally(()=>{if(PAGE==="kho_dc")renderMain()})}
function pKhoDc(m){
  const T="Đối chiếu tồn kho",S="Từng mã: tồn đầu kỳ + nhập − xuất = tồn cuối · bấm một dòng xem từng phiếu tạo nên số · lọc mã âm, mã lệch";
  if(!kdcOk()){m.innerHTML=H(T,"")+`<div class="note">Trang này chỉ dành cho CEO, chị Thảo và kế toán.</div>`;return}
  if(typeof khoLoad==="function")khoLoad();ktonLoad();if(typeof kgLoad==="function")kgLoad();
  const P=kPer();kdcLoad(P);const D0=KTON.dc;
  if(KTON.err||(D0&&D0.err)){m.innerHTML=H(T,S)+`<div class="note red">${esc(KTON.err||D0.err)}</div>`;return}
  if(!KTON.rows||!D0||D0.busy||!KHO.items||!KHO.items.size){m.innerHTML=H(T,S)+`<p class="hint pad">Đang tải…</p>`;return}
  /* Giá bình quân tải riêng (kgLoad chỉ tự vẽ lại trang Tồn kho & giá trị): chưa có giá thì chờ rồi vẽ lại, không hiện giá trị 0. */
  if(typeof KG!=="undefined"&&!KG.prices&&!KG.err){m.innerHTML=H(T,S)+`<p class="hint pad">Đang tải giá bình quân…</p>`;setTimeout(()=>{if(PAGE==="kho_dc")renderMain()},800);return}
  const F=KTON.f,cfg=D0.cfg||{},pr=c=>{const p=typeof KG!=="undefined"&&KG.prices&&KG.prices.get(c);return p&&p.avg_price>0?p.avg_price:null};
  const TH=khoTongHop(KTON.rows,pr),giu=KTON.rows.reduce((t,r)=>t+(+r.giu||0),0);
  const dc=new Map((D0.rows||[]).map(r=>[r.code,r])),fold=typeof kfold==="function"?kfold:(x=>String(x).toLowerCase()),q=fold(F.q||"").trim();
  const all=KTON.rows.map(t=>{const r=dc.get(t.code)||{code:t.code,dau:0,nhap:0,xuat:0,cuoi:0,td:0,nhap_truoc:0,am_tu:null,am_phieu:null,lech:0};return {...r,t}})
    .filter(x=>x.dau||x.nhap||x.xuat||x.cuoi||x.t.ton||x.lech);
  const isAm=x=>kc6(x.cuoi)<0,isLech=x=>x.lech>0||!khoDcKhop(x),noTd=x=>!(+x.td>0)&&(x.xuat>0||isAm(x));
  const L=all.filter(x=>(!F.nhom||x.t.nhom===F.nhom)&&(F.loc==="all"||(F.loc==="am"&&isAm(x))||(F.loc==="lech"&&isLech(x))||(F.loc==="td"&&noTd(x)))&&(!q||q.split(/\s+/).every(w=>fold(x.code+" "+x.t.name).includes(w))))
    .sort((a,b)=>(F.loc==="am"?a.cuoi-b.cuoi:a.code.localeCompare(b.code)));
  const am=all.filter(isAm),amNoIn=am.filter(x=>!(+x.nhap_truoc>0)),amNoTd=am.filter(x=>!(+x.td>0)),nhomAm={};am.forEach(x=>{const k=x.t.nhom;nhomAm[k]=(nhomAm[k]||0)+1});
  const nmN=k=>(KHO_NHOM.find(x=>x[0]===k)||[k,k])[1],dd=typeof kDd==="function"?kDd:(x=>x);
  const sumCard=`<section class="card flush"><div class="card-h pad"><h2>Tồn hiện tại theo nhóm</h2><span class="hint">đến hôm nay · cùng số mọi trang hai web</span></div>${tbl(["Nhóm","Mã đang dùng","Có tồn","Âm kho","Sắp hết","Đang sản xuất","Giá trị tồn (đ)"],
    KHO_NHOM.map(([k,n])=>{const o=TH.by[k];return `<tr><td><b>${n}</b></td><td class="n">${nf(o.ma)}</td><td class="n">${nf(o.coTon)}</td><td class="n">${o.am?`<b class="t-red">${nf(o.am)}</b>`:"0"}</td><td class="n">${nf(o.sapHet)}</td><td class="n">${o.dangSx?nf(kc6(o.dangSx)):"—"}</td><td class="n">${o.giaTri?nf(Math.round(o.giaTri)):"—"}${o.chuaGia?`<br><small class="hint">${nf(o.chuaGia)} mã chưa có giá</small>`:""}</td></tr>`})
    .concat([`<tr class="tot"><td><b>Cộng</b></td><td class="n">${nf(TH.all.ma)}</td><td class="n">${nf(TH.all.coTon)}</td><td class="n"><b>${nf(TH.all.am)}</b></td><td class="n">${nf(TH.all.sapHet)}</td><td class="n">${TH.all.dangSx?nf(kc6(TH.all.dangSx)):"—"}</td><td class="n"><b>${nf(Math.round(TH.all.giaTri))}</b></td></tr>`]))}
    <p class="hint pad">Đã giữ cho đơn Kênh phân phối chưa xuất: ${nf(kc6(giu))} (đơn vị kho). Mã có định mức an toàn: ${nf(KTON.rows.filter(r=>r.min_stock>0).length)}. ${KTON.rows.some(r=>r.min_stock>0)?"":"<b>Chưa mã nào đặt định mức an toàn nên chưa có mã \"sắp hết\".</b>"}</p></section>`;
  const why=am.length?`<div class="note red"><b>${nf(am.length)} mã âm kho</b> (${Object.entries(nhomAm).map(([k,n])=>nmN(k)+" "+n).join(", ")}). ${amNoIn.length===am.length?`<b>Cả ${nf(am.length)} mã đều chưa có tồn đầu kỳ và chưa có một phiếu nhập nào</b>: sổ chỉ có phiếu xuất`:`${nf(amNoIn.length)} mã chưa từng có phiếu nhập, ${nf(amNoTd.length)} mã chưa có tồn đầu kỳ`}. Sổ bắt đầu trừ đơn Kênh phân phối từ ${cfg.b2b_from?dd(cfg.b2b_from):"(chưa đặt)"}, ${cfg.online_from?"trừ bán lẻ sàn từ "+dd(cfg.online_from):"chưa trừ bán lẻ các sàn (chưa đặt ngày bắt đầu)"}. Âm vì thiếu số tồn đầu kỳ / phiếu nhập thành phẩm, không phải do cách tính. Cần chị quyết: nhập số kiểm kê tồn đầu kỳ tại ngày ${cfg.b2b_from?dd(cfg.b2b_from):"bắt đầu"} cho các mã này (Kho vật tư › Nhập tồn đầu kỳ, chỉ CEO).</div>`:`<div class="note">Không có mã âm kho.</div>`;
  const opts=[["am","Chỉ mã âm"],["lech","Chỉ mã lệch"],["td","Chưa có tồn đầu kỳ"],["all","Mọi mã có phát sinh"]];
  m.innerHTML=H(T,S)+`${why}${sumCard}
  <section class="card flush"><div class="card-h pad"><div class="filters"><b>Kỳ: ${kPerLabel(P)}</b><select id="kdc-l">${opt(opts,F.loc)}</select><select id="kdc-n">${opt([["","Mọi nhóm"]].concat(KHO_NHOM),F.nhom)}</select><input id="kdc-q" placeholder="Tìm mã, tên…" value="${esc(F.q||"")}" style="max-width:220px"><span class="hint">${nf(L.length)} mã</span></div><button class="btn" id="kdc-x">Tải Excel</button></div>
   ${L.length?tbl(["Mã","Tên","Nhóm","Tồn đầu kỳ","Nhập","Xuất","Tồn cuối","Đầu + nhập − xuất","Trạng thái","Vì sao / do phiếu nào"],L.slice(0,500).map(x=>{const ok=khoDcKhop(x),st=x.t.trang_thai;
     return `<tr class="clk" data-kdc="${esc(x.code)}"><td class="mono">${esc(x.code)}</td><td>${esc(x.t.name)}${x.t.active?"":` <small class="hint">(ngừng dùng)</small>`}</td><td>${esc(nmN(x.t.nhom))}</td><td class="n">${knum(x.dau)}</td><td class="n">${knum(x.nhap)}</td><td class="n">${knum(x.xuat)}</td><td class="n"><b class="${isAm(x)?"t-red":""}">${knum(x.cuoi)}</b></td>
       <td class="n">${ok?`<span class="t-grn">khớp</span>`:`<b class="t-red">${knum(kc6(x.dau+x.nhap-x.xuat))}</b>`}</td><td>${pill(KHO_TT[st][0],KHO_TT[st][1])}${x.lech?`<br><small class="t-red">${nf(x.lech)} chứng từ lệch</small>`:""}</td><td><small>${esc(khoDcLyDo(x,dd)||(x.lech?"Đơn xuất thực khác số trên đơn, hoặc kiểm kê khác số phiếu sản xuất.":""))}</small></td></tr>`})):`<p class="hint pad">Không có mã nào theo bộ lọc này.</p>`}
   ${L.length>500?`<p class="hint pad">Đang hiện 500 / ${nf(L.length)} mã. Gõ vào ô tìm để thu hẹp.</p>`:""}
   <p class="hint pad">Tồn đầu kỳ = mọi dòng sổ trước ngày ${dd(P.from)}. Cột "Đầu + nhập − xuất" phải bằng Tồn cuối (khớp). Mã lệch = có chứng từ trong kỳ ghi số khác nhau: đơn Kênh phân phối xuất thực khác số trên đơn, hoặc phiếu kiểm kê đóng gói khác số phiếu sản xuất. Bấm một dòng để xem từng phiếu, bấm số phiếu để mở phiếu. Trang chỉ xem, không sửa số.</p></section>
  <section class="card"><div class="card-h"><h2>Định nghĩa chỉ số tồn kho (một cách tính cho mọi trang)</h2></div><ul class="lessons">${KHO_DN.map(([a,b])=>`<li><b>${a}:</b> ${b}</li>`).join("")}<li><b>Nhóm:</b> Vỏ can, chai (một hệ mã MISA, nhóm "Vỏ can, chai, túi") · Nguyên vật liệu (hóa chất, tem nhãn, thùng hộp, công cụ) · Bán thành phẩm · Thành phẩm (gồm hàng hóa, combo).</li></ul></section>`;
  const re=()=>{F.loc=$("#kdc-l").value;F.nhom=$("#kdc-n").value;F.q=$("#kdc-q").value;const p=$("#kdc-q").selectionStart;renderMain();const i=$("#kdc-q");if(i){i.focus();i.setSelectionRange(p,p)}};
  $("#kdc-l").onchange=re;$("#kdc-n").onchange=re;$("#kdc-q").oninput=re;
  m.querySelectorAll("[data-kdc]").forEach(tr=>tr.onclick=()=>khoNxtDetail(tr.dataset.kdc));
  $("#kdc-x").onclick=()=>{if(typeof XLSX==="undefined"){toast("Chưa tải được thư viện Excel");return}
    const ws=XLSX.utils.aoa_to_sheet([["Mã","Tên","Nhóm","Tồn đầu kỳ","Nhập","Xuất","Tồn cuối","Trạng thái","Đã giữ","Khả dụng","Đang sản xuất","Âm từ ngày","Phiếu gây âm","Chứng từ lệch","Vì sao"],...L.map(x=>[x.code,x.t.name,nmN(x.t.nhom),x.dau,x.nhap,x.xuat,x.cuoi,KHO_TT[x.t.trang_thai][0],x.t.giu,x.t.kha_dung,x.t.dang_sx,x.am_tu||"",x.am_phieu||"",x.lech,khoDcLyDo(x)])]),wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Doi chieu");XLSX.writeFile(wb,`DoiChieuTonKho_${P.from}_${P.to}.xlsx`)};
}
PAGES.kho_dc=pKhoDc;
/* Đưa trang vào kho trang để menubang.js xếp vào Tài chính – Kế toán › Tồn kho. */
MODULES.push({k:"q_kdc",adm:true,zone:"Quản trị",ic:"box",n:"Đối chiếu tồn kho",sub:"",groups:()=>[["",[MI("kho_dc","Đối chiếu tồn kho",()=>kdcOk())]]]});
