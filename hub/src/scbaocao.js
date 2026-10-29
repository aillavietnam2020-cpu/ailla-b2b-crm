/* =====================================================================
   BÁO CÁO CHI PHÍ trong Sổ chi phí (chị Hoa duyệt bản demo 27/10; góp ý Kế toán trưởng + khung báo cáo chị Huệ).
   Tab: Tổng quan · Theo chức năng · Theo kênh · Phân bổ (chỉ xem kết quả) · Quy tắc phân bổ · Chờ xử lý · Nhật ký chi.
   - Mỗi khoản có nhiều chiều độc lập: chức năng (theo nhóm chi phí), kênh / nơi chịu, cách xử lý, cố định / biến đổi, tình trạng.
   - Cách xử lý: kênh → Ghi thẳng; Chi chung → Phân bổ hoặc Không chia (theo Quy tắc phân bổ); Sản xuất → Vào giá thành;
     Chờ xác định → Chờ; Không tính, cọc nhà cung cấp → Chặn (không phải chi phí, không đem chia); mua hàng → Vào giá vốn.
   - Theo kênh dùng khung nhóm của báo cáo kế toán: giá vốn, phí sàn, vận chuyển, affiliate, hoàn hàng, quảng cáo, lương,
     quản lý & khác. Giá vốn, phí sàn lấy từ báo cáo kênh (trang Doanh thu, dtShownMonth; TikTok tách phí theo báo cáo TikTok);
     phí sàn trong sổ (G04) không cộng thêm khi báo cáo kênh đã có (tránh trùng). Không có số thì ghi "chưa có số", không đoán.
   - So sánh: "Kỳ này" là kỳ đang chọn, "Kỳ trước" là tháng liền trước (tháng đang chạy thì cùng số ngày, xem scKyTruoc).
   ===================================================================== */
const SC_FN=[["mkt","Marketing",["G01","G02","G03","G11"]],["ban","Bán hàng và chi phí kênh",["G04","G06","G12","G19"]],["kho","Kho và giao hàng",["G05","G09","G10"]],["sx","Sản xuất",["G15","G16","G17","G25","G26"]],["lg","Lương, thưởng, bảo hiểm",["G07","G08"]],["ql","Quản lý chung",["G13","G14","G18","G21","G24"]],["tc","Tài chính, thuế và khác",["G22"]],["cho","Chờ xác minh",["G20","G23"]]];
const scFnOf=g=>{const d=scG(g);if(d.fn&&SC_FN.some(x=>x[0]===d.fn))return d.fn;const f=SC_FN.find(x=>x[2].includes(g));return f?f[0]:"ql"};
const scFnTen=k=>(SC_FN.find(x=>x[0]===k)||[k,k])[1];
const scFnRow=x=>x.g==="G28"?"Mua tài sản / công cụ":x.ext&&x.ext.src==="ncc"?"Chi phí NVL":scFnTen(scFnOf(x.g));
const scLaCoc=x=>!!(x.ext&&x.ext.src==="ncc"&&/^cọc/i.test(String(x.dg||"")));
/* Cách xử lý của một dòng (Nhật ký chi, Phân bổ). */
function scXL(x,qt){
  if(x.trung)return x.trungLy||"Trùng sổ, không tính";
  if(x.g==="G28")return "Ghi tăng tài sản";
  if(x.ext&&x.ext.src==="ncc")return scLaCoc(x)?"Chặn":"Vào giá thành theo định mức";
  if(x.st==="Chờ duyệt"||x.st==="Chờ CEO duyệt")return "Chờ duyệt";
  if(x.k==="Không tính")return "Chặn";
  if(x.k==="Chờ xác định"||x.st==="Cần rà")return "Chờ";
  if(x.k==="Sản xuất")return "Vào giá thành";
  if(x.k==="Chung"){const r=scQTof(qt||scQT(PERIOD.from.slice(0,7)).qt,x.g);return !r||r.cach==="giu"||!scLaChung(x.g)?"Không chia":"Phân bổ"}
  return SC_KENH.includes(x.k)?"Ghi thẳng":"Chờ"}
const SC_XLC={"Trùng sổ, không tính":"p-c","Ghi tăng tài sản":"p-c","Ghi thẳng":"p-ok","Phân bổ":"p-a","Không chia":"p-c","Vào giá thành":"p-c","Vào giá thành theo định mức":"p-c","Chờ":"p-ra","Chờ duyệt":"p-a","Chặn":"p-do"};
const scXLP=t=>`<span class="scp ${SC_XLC[t]||"p-c"}">${esc(t)}</span>`;
const scKpi=(l,v,h,cls)=>`<div class="sckpi${cls?" "+cls:""}"><div class="l">${l}</div><div class="v${v==null?" na":""}">${v==null?"chưa có số":v}</div><div class="h">${h||""}</div></div>`;
const SC_CS='<span class="scna">chưa có số</span>';
const scDl=(t,p)=>{if(p==null||t==null)return '<span class="hint">—</span>';if(!p)return t?'<span class="hint">mới</span>':'<span class="hint">—</span>';const r=(t-p)/p;return `<span class="${r>0.2?"scup":r<-0.2?"scdn":"hint"}">${r>0?"▲":"▼"} ${scPc(Math.abs(t-p),p)}</span>`};
const scKyNhan=PV=>PV?esc(PV.nhan):"";
/* Phân loại một dòng cho thẻ tổng quan (không chồng nhau). */
const scLoaiTQ=x=>{const xl=scXL(x);return xl==="Chặn"||xl==="Chờ"||xl==="Chờ duyệt"?"cho":xl==="Ghi thẳng"?"kenh":xl==="Vào giá thành"?"sx":"chung"};
/* ---------- Cảnh báo dùng chung (Tổng quan, Theo chức năng) ---------- */
function scCanhBao(rows,PV){
  const W=[],qm=scQcMax(),{DT}=scDtThang(),A=scAgg(rows),TH=scThieu();
  SC_KENH.forEach(k=>{const qc=["G01","G02","G03"].reduce((s,g)=>s+((A[k]||{})[g]||0),0),dt=DT[k];
    if(dt&&qc&&qc/dt>qm)W.push({m:"do",fn:"mkt",k,t:`${SC_TEN(k)}: quảng cáo bằng ${scPc(qc,dt)} doanh thu thực, vượt ngưỡng ${scPc(qm,1)}.`,d:`Giảm ngân sách nhóm chiến dịch lỗ; về ngưỡng thì quảng cáo khoảng ${scNf(dt*qm)} đ (đang ${scNf(qc)} đ).`})});
  if(PV&&!PV.chuaSo){const by=L=>{const o={};L.forEach(x=>{const f=scFnOf(x.g);o[f]=(o[f]||0)+(+x.t||0)});return o},a=by(rows),b=by(PV.rows);
    SC_FN.forEach(([f,n])=>{const t=a[f]||0,p=b[f]||0;if(p&&t>p*1.2&&t-p>5e6)W.push({m:"vang",fn:f,t:`${n} tăng ${scPc(t-p,p)} so ${PV.nhan} (+${scNf(t-p)} đ).`,d:"Mở tab Theo chức năng để xem nhóm nào làm tăng."})})}
  const cho=rows.filter(x=>scLoaiTQ(x)==="cho"),cxd=cho.filter(x=>x.k==="Chờ xác định");
  if(cho.length)W.push({m:"do",fn:"cho",t:`${scNf(scS(cho))} đ chưa đủ căn cứ (${cho.length} khoản): không được đem phân bổ.`,d:"Xử lý ở tab Chờ xử lý trước khi chốt tháng."});
  if(cxd.length)W.push({m:"vang",fn:"kho",t:`${scNf(scS(cxd))} đ chưa biết bổ cho kênh nào.`,d:`Chọn "Bổ vào" ở Nhật ký chi để ghi thẳng cho kênh.`});
  TH.forEach(x=>W.push({m:"thieu",fn:x.g==="G07"?"lg":"mkt",t:x.why,d:""}));
  const o={do:0,vang:1,thieu:2};return W.sort((a,b)=>o[a.m]-o[b.m])}
/* Kỳ trước chưa nạp sổ (chỉ có khoản tự cộng) mà kỳ này đã có sổ thì không so tổng, tránh báo tăng ảo. */
const scPrevSo=rows=>{const P=scPrev();if(P&&rows.some(x=>!x.ext)&&!P.rows.some(x=>!x.ext))P.chuaSo=true;return P};
const SC_MW={do:["p-do","Vượt ngưỡng"],vang:["p-ra","Cần xem"],thieu:["p-c","Thiếu số"]};
const scWHtml=W=>W.length?W.map(x=>`<div class="scw"><span class="scp ${SC_MW[x.m][0]}">${x.m==="do"&&x.fn==="cho"?"Phải xử lý":SC_MW[x.m][1]}</span><div><div>${esc(x.t)}</div>${x.d?`<div class="hint">→ ${esc(x.d)}</div>`:""}</div></div>`).join(""):'<p class="hint">Không có gì bất thường trong kỳ này.</p>';
/* ---------- 1. Tổng quan ---------- */
function scTQ2(){
  scNap();
  const rows=scPBRows();if(!rows.length&&!scThieu().length)return scEmpty();
  const ym=PERIOD.from.slice(0,7),one=PERIOD.to.slice(0,7)===ym,T=scS(rows),PV=scPrevSo(rows),CH=scChiaPB(rows),by={kenh:0,chung:0,cho:0,sx:0};
  rows.forEach(x=>by[scLoaiTQ(x)]+=+x.t||0);
  const da=Object.values(CH.kenh).reduce((a,o)=>a+scSum(o),0),con=CH.con.reduce((a,x)=>a+x.t,0);
  const bud=one?scSum(((scFin().budgets||{})[ym])||{}):0,pT=PV&&!PV.chuaSo?scS(PV.rows):null;
  const kp=`<div class="sck4">
   ${scKpi("Tổng chi phí trong sổ",scNf(T),"Nợ TK 642 và khoản tự cộng · chưa phải tiền đã chi")}
   ${scKpi("Chi phí phân bổ theo kênh",scNf(by.kenh),scPc(by.kenh,T)+" · ghi thẳng, không chia lại")}
   ${scKpi("Chi chung, chờ phân bổ",scNf(by.chung),"chia theo Quy tắc phân bổ")}
   ${scKpi("Chờ xác minh",scNf(by.cho),"chưa đủ căn cứ · không được chia",by.cho?"warn":"")}
   ${scKpi("Đã phân bổ",one&&da?scNf(da):null,CH.chot?"đã chốt bản "+CH.chot.v:one?"chưa chốt, theo quy tắc hiện tại":"chọn một tháng")}
   ${scKpi("Còn chưa phân bổ",scNf(con),CH.loi.length?"chưa chia được: "+esc(CH.loi[0]):"để ở chi chung công ty")}
   ${scKpi("So với ngân sách",bud?scPc(T,bud):null,bud?"ngân sách "+scNf(bud):"chưa đặt ngân sách tháng này")}
   ${scKpi("So với kỳ trước",pT?scDl(T,pT):null,PV?(pT?scNf(pT)+" · "+scKyNhan(PV):"sổ "+scKyNhan(PV)+" chưa nạp"):"chọn một tháng")}</div>`;
  const F=SC_FN.map(([f,n])=>[f,n,scS(rows.filter(x=>scFnOf(x.g)===f))]).filter(x=>x[2]),mx=Math.max(1,...F.map(x=>x[2]));
  const cn=`<div class="scch"><div class="scchh"><b>Chi phí theo chức năng</b><span class="hint">bấm để xem các khoản</span></div>${F.map(([f,n,v])=>`<div class="scsb" data-fn="${f}"><span class="n">${esc(n)}</span><span class="b"><i style="width:${v/mx*100}%;background:${f==="cho"?"#b8c7dd":"#2a78d6"}"></i></span><span class="v"><b>${scNf(v)}</b> <span class="hint">${scPc(v,T)}</span></span></div>`).join("")||'<p class="hint">Chưa có khoản chi.</p>'}</div>`;
  const wb=`<div class="scch"><div class="scchh"><b>Đánh giá &amp; cảnh báo</b></div>${scWHtml(scCanhBao(rows,PV))}</div>`;
  return scBCcss()+`<section class="card pad"><div class="sch"><h2>Tổng quan chi phí</h2><span class="hint">${esc(pLabel())}${PV?" · so "+scKyNhan(PV):""}</span></div>${kp}<div class="sctwo sc-tq">${cn}${wb}</div></section>
  <section class="card pad"><h2>Quy trình xử lý chi phí</h2><div class="scflow"><div><b>1. Ghi thẳng</b>Chứng từ rõ kênh, đơn, vận đơn, chiến dịch, phòng ban thì ghi cho đúng nơi đó (ô "Bổ vào" ở Nhật ký chi). Không chia lại theo doanh thu.</div><div><b>2. Phân bổ khoản dùng chung</b>Chỉ chia khoản thật sự dùng chung, theo Quy tắc phân bổ chị Huệ đặt; chốt tháng để giữ số.</div><div><b>3. Giữ riêng khoản chưa đủ căn cứ</b>VAT chưa rõ, cọc, chuyển nhầm, diễn giải thiếu, chưa rõ kênh: xử lý ở Chờ xử lý, không đưa vào phân bổ.</div></div></section>`}
/* ---------- 2. Theo chức năng ---------- */
const SC_FND={mkt:"Đối chiếu tiền nạp quảng cáo với tiền chạy thật; giảm nhóm chiến dịch lỗ ở kênh vượt ngưỡng.",ban:"So doanh thu tăng thêm nhờ voucher, chương trình sàn với phí phải trả; không bù được thì tắt bớt.",kho:"Ghi mã vận đơn hoặc kênh vào phiếu chi vận chuyển để ghi thẳng cho kênh.",sx:"Đây chỉ là phần lọt vào sổ 642; chi phí sản xuất thật hạch toán TK 154, nằm trong giá vốn.",lg:"Chốt bảng lương và đặt cách chia lương từng người để lương vào đúng kênh.",ql:"Kiểm tra khoản trả trước (thuê, thiết bị, CCDC) đã chia đúng số tháng, không dồn vào một tháng.",tc:"Rà bản chất: VAT đầu vào hợp lệ vào TK 133, không vào chi phí.",cho:"Xử lý ở tab Chờ xử lý trước khi chốt tháng; chưa xong thì không được phân bổ."};
function scCN(){
  scNap();
  const rows=scPBRows();if(!rows.length)return scEmpty();
  const T=scS(rows),PV=scPrevSo(rows),W=scCanhBao(rows,PV),open=SC.cnOpen||(SC.cnOpen={}),pr=PV&&!PV.chuaSo?PV.rows:null;
  const sumF=(L,f)=>scS(L.filter(x=>scFnOf(x.g)===f)),sumG=(L,g)=>scS(L.filter(x=>x.g===g));
  const st=f=>{const L=W.filter(x=>x.fn===f);return L.some(x=>x.m==="do")?`<span class="scp p-do">${f==="cho"?"Phải xử lý":"Vượt ngưỡng"}</span>`:L.some(x=>x.m==="vang")?'<span class="scp p-ra">Cần xem</span>':L.length?'<span class="scp p-c">Thiếu số</span>':'<span class="scp p-ok">Ổn</span>'};
  const body=SC_FN.map(([f,n])=>{const v=sumF(rows,f),p=pr?sumF(pr,f):null;if(!v&&!p)return "";
    const gs=[...new Set(rows.concat(pr||[]).filter(x=>scFnOf(x.g)===f).map(x=>x.g))].sort((a,b)=>sumG(rows,b)-sumG(rows,a));
    return `<tr class="scgrp" data-cnf="${f}"><td>${open[f]?"▾":"▸"} ${esc(n)}</td><td></td><td></td><td></td><td></td><td class="n">${scNf(v)}</td><td class="n">${scPc(v,T)}</td><td class="n">${p==null?SC_CS:scNf(p)}</td><td class="n">${scDl(v,p)}</td><td>${st(f)}</td></tr>`+
     (open[f]?gs.map(g=>{const L=rows.filter(x=>x.g===g),d=scG(g),ks=[...new Set(L.map(x=>SC_TEN(x.k)))],xs=[...new Set(L.map(x=>scXL(x)))],gv=scS(L),gp=pr?sumG(pr,g):null,bad=L.some(x=>scLoaiTQ(x)==="cho");
      return `<tr class="scsub clk" data-go-g="${esc(g)}"><td><span class="mono">${esc(g)}</span> ${esc(d.n)}</td><td>${esc(d.tk||"")}</td><td>${esc(ks.join(", ")||"—")}</td><td>${xs.map(scXLP).join(" ")}</td><td>${d.cd?"Cố định":"Biến đổi"}</td><td class="n">${gv?scNf(gv):"—"}</td><td class="n">${scPc(gv,T)}</td><td class="n">${gp==null?SC_CS:scNf(gp)}</td><td class="n">${scDl(gv,gp)}</td><td>${bad?'<span class="scp p-ra">Chờ xác minh</span>':'<span class="scp p-ok">Đủ căn cứ</span>'}</td></tr>`}).join(""):"")}).join("");
  const ev=SC_FN.map(([f,n])=>{const v=sumF(rows,f);if(!v)return "";const p=pr?sumF(pr,f):null,L=W.filter(x=>x.fn===f),m=L.some(x=>x.m==="do")?"do":L.some(x=>x.m==="vang")?"vang":f==="sx"?"g":"ok";
    const lab={do:["p-do",f==="cho"?"Phải xử lý":"Vượt ngưỡng"],vang:["p-ra","Cần xem"],g:["p-c","Ghi chú"],ok:["p-ok","Ổn"]}[m];
    return `<div class="scw"><span class="scp ${lab[0]}">${lab[1]}</span><div><div><b>${esc(n)} ${scNf(v)} đ · ${scPc(v,T)} tổng chi phí</b>${p?` · ${scDl(v,p)} so ${scKyNhan(PV)}`:""}</div>${L.map(x=>`<div>${esc(x.t)}</div>`).join("")}<div class="hint">→ ${esc(L.find(x=>x.d)?L.find(x=>x.d).d:SC_FND[f])}</div></div></div>`}).join("");
  return scBCcss()+`<section class="card flush"><div class="sch pad"><h2>Chi phí theo chức năng</h2><span class="hint">mỗi khoản có nhiều chiều: chức năng, kênh, cách xử lý, cố định / biến đổi, tình trạng · bấm dòng chức năng để mở, bấm nhóm để xem từng khoản</span></div>
  <div class="tbl"><table><thead><tr><th>Chức năng / nhóm chi phí</th><th>TK</th><th>Kênh / nơi chịu</th><th>Cách xử lý</th><th>Cố định / biến đổi</th><th class="n">Kỳ này<div class="hint">${esc(pLabel())}</div></th><th class="n">% tổng</th><th class="n">Kỳ trước<div class="hint">${PV?scKyNhan(PV):"chọn một tháng"}</div></th><th class="n">Tăng / giảm</th><th>Tình trạng</th></tr></thead><tbody>
  ${body}<tr class="tot"><td>Tổng</td><td colspan="4"></td><td class="n">${scNf(T)}</td><td class="n">100%</td><td class="n">${pr?scNf(scS(pr)):SC_CS}</td><td class="n">${pr?scDl(T,scS(pr)):""}</td><td></td></tr></tbody></table></div>
  <p class="hint pad">Kỳ này là kỳ chọn ở ô thời gian; kỳ trước là tháng liền trước (tháng đang chạy thì so cùng số ngày). Web báo khi một chức năng tăng trên 20% và trên 5 triệu. Sản xuất ở đây chỉ là phần lọt vào sổ 642; chi phí sản xuất thật (nguyên vật liệu, lương xưởng, điện xưởng) hạch toán TK 154 rồi vào giá vốn.</p></section>
  <section class="card pad"><h2>Đánh giá &amp; đề xuất theo chức năng</h2>${ev||'<p class="hint">Chưa có khoản chi.</p>'}</section>`}
/* ---------- 3. Theo kênh ---------- */
const SC_KDT={"TikTok":"tts","Facebook":"fb","NPP":"b2b","Gia công":"gc"};
const SC_KG={"TikTok":["gv","san","vc","aff","hoan","qc","lg","khac"],"Shopee Mall":["gv","san","vc","aff","hoan","qc","lg","khac"],"Shopee thường":["gv","san","vc","aff","hoan","qc","lg","khac"],"Facebook":["gv","vc","hoan","qc","lg","khac"],"NPP":["gv","vc","lg","khac"],"Gia công":["gv","vc","khac"]};
const SC_KGN={gv:"Giá vốn",san:"Phí sàn",vc:"Vận chuyển",aff:"Hoa hồng affiliate / KOC",hoan:"Hoàn hàng, mã giảm giá",qc:"Quảng cáo",lg:"Lương, vận hành",khac:"Chi phí quản lý & khác",chia:"Chi chung được chia"};
const SC_KGNO=["gv","lg"],SC_KGMAP={G01:"qc",G02:"qc",G03:"qc",G04:"san",G05:"vc",G09:"vc",G06:"lg",G07:"lg",G08:"lg",G19:"hoan"};
/* Các nhóm chi phí của một kênh trong một kỳ: [{k:nhóm, v:số|null, it:[[tên,số,nguồn]]}]; null = chưa có số. */
function scKenhNhom(k,ym,rows,CH,sau,full){
  const G={},add=(g,n,v,src)=>{if(!v)return;(G[g]=G[g]||[]).push([n,v,src])};let dtR=null;
  try{const key=SC_KDT[k];if(key&&full&&typeof dtShownMonth==="function"){const r=dtShownMonth(ym)[key];if(r&&r.dt!=null&&!r.tam&&!r.thieu)dtR=r}}catch(e){}
  const tsb=k==="TikTok"&&full&&typeof TSB!=="undefined"&&TSB.sum?TSB.sum[ym]:null,coPhi=!!(tsb&&tsb.fees)||!!(dtR&&dtR.phi);
  if(dtR&&dtR.gv!=null)add("gv","Giá vốn hàng đã bán",+dtR.gv,"báo cáo kênh");
  if(tsb&&tsb.fees){tsb.fees.forEach(([n,v])=>{v=Math.abs(+v||0);if(!v)return;add(/affiliate|KOC/i.test(n)?"aff":/vận chuyển/i.test(n)?"vc":"san",n,v,"báo cáo TikTok")})}
  else if(dtR&&dtR.phi)add(SC_KG[k].includes("san")?"san":"vc","Phí sàn, vận chuyển theo báo cáo kênh",Math.abs(+dtR.phi),"báo cáo kênh");
  const bo=[];rows.filter(x=>x.k===k&&!(coPhi&&x.ext&&x.ext.src==="san")).forEach(x=>{const g=SC_KGMAP[x.g]||"khac";if(g==="san"&&coPhi){bo.push(x);return}add(g,x.ext?x.dg:scG(x.g).n,+x.t||0,x.ext?x.nguon:"sổ chi phí")});
  if(sau)Object.entries((CH.kenh||{})[k]||{}).forEach(([g,v])=>add("chia",scG(g).n,v,"phân bổ"));
  const keys=SC_KG[k]||["khac"],L=keys.concat(sau&&G.chia?["chia"]:[]).map(g=>{const it=G[g]||[];const merged={};it.forEach(([n,v,s])=>{const o=merged[n]||(merged[n]={n,v:0,s});o.v+=v});
    const items=Object.values(merged).sort((a,b)=>b.v-a.v),v=items.reduce((a,x)=>a+x.v,0);
    const na=!items.length&&(g==="gv"||g==="san"||g==="aff"||g==="hoan"||g==="lg"||(g==="qc"&&k!=="NPP"&&k!=="Gia công"));
    return {k:g,v:na?null:v,it:items}});
  return {L,bo:scS(bo)}}
function scKenh(){
  scNap();
  const rows=scPBRows(),ym=PERIOD.from.slice(0,7),one=PERIOD.to.slice(0,7)===ym,full=one&&PERIOD.to>=iso(new Date(+ym.slice(0,4),+ym.slice(5),0)).slice(0,10);
  const CH=scChiaPB(rows),sau=SC.pbm==="sau",PV=scPrev(),{DT}=scDtThang(),qm=scQcMax();
  const NK={};SC_KENH.forEach(k=>NK[k]=scKenhNhom(k,ym,rows,CH,sau,full));
  const NP=PV?Object.fromEntries(SC_KENH.map(k=>[k,scKenhNhom(k,PV.ym,PV.rows,PV.chia||{kenh:{}},sau,PV.full)])):null;
  const tong=o=>o.L.reduce((a,g)=>a+(g.v||0),0);
  if(!SC_KENH.includes(SC.pbk))SC.pbk=SC_KENH.slice().sort((a,b)=>tong(NK[b])-tong(NK[a]))[0];
  const k=SC.pbk,o=NK[k],p=NP?NP[k]:null,dt=DT[k],cs=tong(o),miss=o.L.filter(g=>g.v==null).map(g=>SC_KGN[g.k]);
  const pv=g=>{if(!p||!tong(p))return null;const x=p.L.find(z=>z.k===g);return x?x.v:null};
  const csP=p&&tong(p)?o.L.filter(g=>g.v!=null&&pv(g.k)!=null).reduce((a,g)=>a+pv(g.k),0):null,csC=p?o.L.filter(g=>g.v!=null&&pv(g.k)!=null).reduce((a,g)=>a+g.v,0):0;
  const ght=scSum(scAgg(rows)[k]||{}),nhan=scSum((CH.kenh||{})[k]||{});
  const pills=`<div class="scpills" role="tablist">${SC_KENH.map(x=>`<button type="button" role="tab" aria-selected="${x===k}" class="${x===k?"on":""}" data-pbk="${esc(x)}">${esc(SC_TEN(x))} <span class="hint">${tong(NK[x])?scNf(tong(NK[x])):"—"}</span></button>`).join("")}</div>`;
  const kp=`<div class="sck4">${scKpi("Chi phí ghi nhận được",cs?scNf(cs):"—",miss.length?`đủ số ${o.L.length-miss.length}/${o.L.length} nhóm · còn thiếu ${miss.length} nhóm nên tổng thật sẽ cao hơn`:"đủ số các nhóm",miss.length?"warn":"")}
   ${scKpi("Chi phí / doanh thu thực",dt&&cs?scPc(cs,dt):null,dt?"doanh thu thực "+scNf(dt)+(miss.length?" · chưa gồm nhóm thiếu số":""):"chưa có doanh thu thực")}
   ${scKpi("So với kỳ trước",csP?scDl(csC,csP):null,PV?(csP?"các nhóm có số cả hai kỳ · "+scKyNhan(PV):scKyNhan(PV)+" chưa có số"):"chọn một tháng")}
   ${sau?scKpi("Nhận phân bổ chi chung",one?(nhan?scNf(nhan):"—"):null,CH.chot?"đã chốt bản "+CH.chot.v:"theo Quy tắc phân bổ"):scKpi("Ghi thẳng cho kênh",scNf(ght),"từ sổ, quảng cáo, vận chuyển, lương · chưa gồm chi chung")}</div>`;
  const gm=Math.max(1,...o.L.map(g=>g.v||0));
  const co=`<div class="scch"><div class="scchh"><b>Cơ cấu chi phí ${esc(SC_TEN(k))}</b><span class="hint">nhóm theo khung báo cáo kế toán · % trên doanh thu thực</span></div>${o.L.map(g=>`<div class="scsb nc"><span class="n">${SC_KGN[g.k]}</span><span class="b">${g.v?`<i style="width:${g.v/gm*100}%;background:#2a78d6"></i>`:""}</span><span class="v">${g.v==null?SC_CS:`<b>${scNf(g.v)}</b>${dt?` <span class="hint">${scPc(g.v,dt)}</span>`:""}`}</span></div>`).join("")}</div>`;
  const big=o.L.flatMap(g=>g.it.map(x=>[x.n,x.v,SC_KGN[g.k]])).sort((a,b)=>b[1]-a[1]).slice(0,3),qc=(o.L.find(g=>g.k==="qc")||{}).v;
  const cw=`<div class="scch"><div class="scchh"><b>Điểm cần chú ý</b></div>${big.length?'<div class="hint">Ba khoản lớn nhất</div>'+big.map((x,i)=>`<div class="scw"><span class="scp p-a">#${i+1}</span><div><b>${esc(x[0])}</b> · ${scNf(x[1])} đ<div class="hint">${esc(x[2])}${dt?" · "+scPc(x[1],dt)+" doanh thu":""}</div></div></div>`).join(""):""}
   ${dt&&qc&&qc/dt>qm?`<div class="scw"><span class="scp p-do">Vượt ngưỡng</span><div>Quảng cáo ${scPc(qc,dt)} doanh thu thực, ngưỡng ${scPc(qm,1)}.<div class="hint">→ Về ngưỡng thì quảng cáo khoảng ${scNf(dt*qm)} đ.</div></div></div>`:""}
   ${miss.length?`<div class="scw"><span class="scp p-c">Thiếu số</span><div>${esc(miss.join(", "))}<div class="hint">→ tải báo cáo kênh ở trang Doanh thu, chốt bảng lương, hoặc ghi phiếu chi để có số</div></div></div>`:""}
   ${o.bo?`<div class="scw"><span class="scp p-c">Ghi chú</span><div>Phí sàn ghi trong sổ ${scNf(o.bo)} đ không cộng thêm vì báo cáo kênh đã có phí sàn (tránh tính hai lần).</div></div>`:""}
   ${k.startsWith("Shopee")?`<div class="scw"><span class="scp p-c">Ghi chú</span><div>Báo cáo Shopee trên web đang gộp 2 shop nên chưa tách được giá vốn, phí sàn cho từng shop.</div></div>`:""}</div>`;
  const row=(l,v,vp,cls)=>`<tr class="${cls}"><td>${l}</td><td class="n">${v==null?SC_CS:scNf(v)}</td><td class="n">${v!=null&&dt?scPc(v,dt):""}</td><td class="n">${vp===undefined?"":vp==null?SC_CS:scNf(vp)}</td></tr>`;
  const bang=`<div class="scch"><div class="scchh"><b>Bảng chi phí ${esc(SC_TEN(k))}</b><span class="hint">nhóm → khoản · cùng khung báo cáo kế toán</span></div><div class="tbl"><table><thead><tr><th>Khoản</th><th class="n">Kỳ này<div class="hint">${esc(pLabel())}</div></th><th class="n">% doanh thu</th><th class="n">Kỳ trước<div class="hint">${PV?scKyNhan(PV):"—"}</div></th></tr></thead><tbody>
   <tr class="scres"><td>Doanh thu thực (để tính %)</td><td class="n">${dt==null?SC_CS:scNf(dt)}</td><td class="n">${dt?"100%":""}</td><td class="n"></td></tr>
   ${o.L.map((g,i)=>row((i+1)+". "+SC_KGN[g.k],g.v,pv(g.k),"scgrp")+g.it.map(x=>row(esc(x.n)+` <span class="hint">· ${esc(x.s)}</span>`,x.v,undefined,"scsub")).join("")).join("")}
   <tr class="tot"><td>Tổng chi phí ${sau?"sau phân bổ":"ghi nhận"}${miss.length?` (chưa đủ, thiếu ${miss.length} nhóm)`:""}</td><td class="n">${scNf(cs)}</td><td class="n">${dt?scPc(cs,dt):""}</td><td class="n">${csP?scNf(csP):""}</td></tr></tbody></table></div>
   ${!full&&one?`<p class="hint">Tháng đang chạy: giá vốn, phí sàn theo báo cáo kênh chỉ có khi tháng đã đủ số, nên đang ghi "chưa có số".</p>`:""}</div>`;
  return scBCcss()+`<section class="card pad" id="scpk"><div class="sch"><h2>Chi phí theo kênh</h2><span class="hint">${esc(pLabel())}</span><span class="sp"></span>${scPBSeg(CH)}</div>${pills}${kp}<div class="sctwo">${co}${cw}</div>${k==="TikTok"?scHDTTHtml(ym,full,rows):""}${bang}</section>
  <details class="card pad scpbd"><summary><b>Bảng nhóm chi phí × kênh (toàn bộ sổ) và chia chi chung</b></summary>${scPBBang()}</details>`}
/* ---------- 4. Phân bổ (chỉ xem kết quả) ---------- */
function scPBV(){
  scNap();
  const rows=scPBRows();if(!rows.length)return scEmpty();
  const ym=PERIOD.from.slice(0,7),one=PERIOD.to.slice(0,7)===ym,CH=scChiaPB(rows),Q=scQT(ym),ed=scCanDuyet(),R=[];
  const nguon=x=>x.ext?({ads:"Báo cáo quảng cáo",vc:"Phiếu chi vận chuyển",luong:"Bảng lương (cách chia lương từng người)"}[x.ext.src]||x.nguon):"Chứng từ ghi kênh";
  /* Sửa ngay tại tab (chị Hoa 28/10): mở dòng để đổi "Bổ vào" từng khoản (lưu vào sổ, Nhật ký chi đổi theo), sửa cách chia nhóm chi chung, chia lương. */
  const op=SC.pbOpen||"",go=(a,key)=>{if(!ed)return "";const b=[];if(a.lg)b.push(`<button class="btn sm" data-sct="qt">Chia lương</button>`);
    if(a.xl==="Phân bổ"||a.xl==="Không chia")b.push(`<button class="btn sm" data-qte="${esc(a.g)}">Sửa cách chia nhóm này</button>`);return b.join(" ")};
  const agg={};rows.forEach(x=>{const xl=scXL(x,CH.qt);const key=xl+"|"+x.g+"|"+x.k+"|"+(x.ext&&x.ext.src==="luong"?"lg":"");const a=agg[key]||(agg[key]={key,xl,g:x.g,k:x.k,t:0,L:[],lg:x.ext&&x.ext.src==="luong",src:nguon(x)});a.t+=+x.t||0;a.L.push(x)});
  const ord={"Ghi thẳng":0,"Phân bổ":1,"Không chia":2,"Vào giá thành":3,"Chờ":4,"Chờ duyệt":4,"Chặn":5};
  Object.values(agg).sort((a,b)=>ord[a.xl]-ord[b.xl]||b.t-a.t).forEach(a=>{const n=scG(a.g).n,A=a;
    if(a.xl==="Ghi thẳng")R.push([n,a.t,a.xl,a.src,SC_TEN(a.k),"100%",a.t,'<span class="scp p-ok">Đủ căn cứ</span>',go(a,a.key),a]);
    else if(a.xl==="Phân bổ"){const r=scQTof(CH.qt,a.g),nh=SC_KENH.map(k=>[k,((CH.kenh||{})[k]||{})[a.g]||0]).filter(z=>z[1]),got=nh.reduce((s,z)=>s+z[1],0),c=CH.con.filter(z=>z.g===a.g);
      R.push([n,a.t,a.xl,esc(scQTtxt(r)),nh.length?nh.map(z=>esc(SC_TEN(z[0]))).join(" · "):"—",nh.length?nh.map(z=>scPc(z[1],a.t)).join(" · "):"—",got||null,c.length?`<span class="scp p-ra">${esc(c[0].why)}</span>`:'<span class="scp p-ok">Đủ căn cứ</span>',go(a,a.key),a])}
    else if(a.xl==="Không chia")R.push([n,a.t,a.xl,"Để ở chi chung công ty","Chi chung công ty","—",null,'<span class="scp p-ok">Đủ căn cứ</span>',go(a,a.key),a]);
    else if(a.xl==="Vào giá thành")R.push([n,a.t,a.xl,"Chi phí sản xuất","Sản xuất (giá thành)","—",null,'<span class="scp p-c">Không chia</span>',go(a,a.key),a]);
    else R.push([n,a.t,a.xl,"—",esc(SC_TEN(a.k)),"—",null,`<span class="scp ${a.xl==="Chặn"?"p-do":"p-ra"}">${a.xl==="Chặn"?"Không phải chi phí":"Chờ xác minh"}</span>`,go(a,a.key),a])});
  const ok1=Math.abs(CH.truoc-CH.sau)<1,ok2=!CH.loi.length,V=Q.n?((scFin().pbchot||{})[ym]):[];
  return scBCcss()+`<section class="card flush"><div class="sch pad"><h2>Phân bổ chi phí ${one?"tháng "+ym.slice(5)+"/"+ym.slice(0,4):""}</h2>${Q.chot?`<span class="scp p-ok">Đã chốt bản ${Q.chot.v}</span>`:'<span class="scp p-ra">Chưa chốt</span>'}<span class="sp"></span>${ed&&one?`<button class="btn sm${Q.chot?"":" pri"}" id="scqt-chot">${Q.chot?"Chốt bản điều chỉnh":"Chốt phân bổ tháng này"}</button>`:""}</div>
  <div class="note" style="margin:0 16px 10px">Bấm vào một dòng để xem các khoản bên trong: ghi sai kênh thì chọn lại kênh ngay ở đó (Nhật ký chi đổi theo); nhóm chi chung có nút sửa cách chia, dòng lương có nút chia lương. Khoản "tự cộng" (quảng cáo, vận chuyển lấy từ báo cáo) chỉ xem. Tháng đã chốt thì phải chốt bản điều chỉnh.</div>
  <div class="tbl"><table><thead><tr><th>Khoản chi phí</th><th class="n">Số tiền gốc</th><th>Cách xử lý</th><th>Tiêu thức</th><th>Kênh nhận</th><th class="n">Tỷ lệ</th><th class="n">Số nhận</th><th>Tình trạng</th></tr></thead><tbody>
  ${R.map(r=>`<tr class="clk" data-pbo="${esc(r[9].key)}" title="Bấm để xem các khoản"><td>${op===r[9].key?"▾":"▸"} ${esc(r[0])}</td><td class="n">${scNf(r[1])}</td><td>${scXLP(r[2])}</td><td>${r[3]}</td><td>${r[4]}</td><td class="n">${r[5]}</td><td class="n">${r[6]==null?"—":scNf(r[6])}</td><td>${r[7]}</td></tr>`+(op===r[9].key&&r[8]?`<tr class="scsub"><td colspan="8">${r[8]}</td></tr>`:"")+(r[9]&&op===r[9].key?r[9].L.slice().sort((a,b)=>(b.t||0)-(a.t||0)).map(x=>`<tr class="scsub"><td>${x.d?scDd(x.d):'<span class="hint">cả kỳ</span>'} <span class="mono">${esc(x.ct||"")}</span> ${esc(x.dg||"")}${x.gc?`<div class="hint">${esc(x.gc)}</div>`:""}</td><td class="n">${scNf(x.t)}</td><td colspan="3"></td><td colspan="2">${!x.ext?`<select class="scbv" data-bv="${esc(x.id)}" aria-label="Bổ khoản chi vào">${SC_COLS.map(k=>`<option value="${k}"${x.k===k?" selected":""}>${esc(SC_TEN(k))}</option>`).join("")}</select> <button class="btn sm" data-tach="${esc(x.id)}">Tách</button>`:esc(SC_TEN(x.k))+' <span class="hint">tự cộng</span>'}</td><td>${scStP(x.st)}</td></tr>`).join(""):"")).join("")}
  <tr class="tot"><td>Tổng</td><td class="n">${scNf(scS(rows))}</td><td colspan="6"></td></tr></tbody></table></div>
  <p class="hint pad">Kiểm tra trước khi chốt: chi chung trước chia ${scNf(CH.truoc)} đ ${ok1?"= sau chia ✓":"≠ sau chia ✗"} · ${ok2?"tỷ lệ, doanh thu đủ để chia ✓":"chưa chia được: "+esc(CH.loi.join("; "))} · khoản chờ xác minh không nằm trong bảng chia ✓ · không khoản nào vừa ghi thẳng vừa chia ✓</p></section>
  <section class="card pad"><h2>Lịch sử phiên bản</h2>${V.length?`<div class="tbl"><table><thead><tr><th>Bản</th><th>Người chốt</th><th>Lúc</th><th>Ghi chú</th></tr></thead><tbody>${V.slice().reverse().map(x=>`<tr><td>Bản ${x.v}</td><td>${esc(x.by||"")}</td><td>${new Date(x.at).toLocaleString("vi-VN")}</td><td>${esc(x.ghi||"")}</td></tr>`).join("")}</tbody></table></div>`:'<p class="hint">Chưa có bản chốt. Chốt xong thì sửa quy tắc không làm đổi số tháng này; muốn đổi phải chốt bản điều chỉnh, ghi lý do, bản cũ giữ nguyên.</p>'}</section>`}
/* Số việc ở tab Chờ xử lý. */
const scChoN=()=>{try{const r=scPBRows();return r.filter(x=>scLoaiTQ(x)==="cho").length+scCho().filter(scInP).length}catch(e){return 0}};
function scBCbind(m){
  m.querySelectorAll("[data-lkpo]").forEach(el=>el.onclick=ev=>{ev.stopPropagation();const id=el.dataset.lkpo;Promise.resolve(typeof mhLoad==="function"?mhLoad():0).then(()=>mhDetail(id))});
  m.querySelectorAll("[data-lkx]").forEach(el=>el.onclick=ev=>{ev.stopPropagation();const r=scExt().find(y=>y.id===el.dataset.lkx);if(r)scExtOpen(r)});
  m.querySelectorAll("[data-tach]").forEach(el=>el.onclick=()=>{const x=((scFin().nkc)||[]).find(y=>y.id===el.dataset.tach);if(x)scTach(x)});
  m.querySelectorAll("[data-pbo]").forEach(b=>b.onclick=()=>{SC.pbOpen=SC.pbOpen===b.dataset.pbo?"":b.dataset.pbo;renderMain()});
  m.querySelectorAll("[data-fn]").forEach(el=>el.onclick=()=>{SC.tab="cn";(SC.cnOpen=SC.cnOpen||{})[el.dataset.fn]=1;renderMain();scrollTo(0,0)});
  m.querySelectorAll("[data-cnf]").forEach(el=>el.onclick=()=>{const o=SC.cnOpen=SC.cnOpen||{},f=el.dataset.cnf;o[f]=!o[f];renderMain()});
  m.querySelectorAll("[data-scgo-lg]").forEach(b=>b.onclick=()=>{PAGE="cp_luong";try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}render();scrollTo(0,0)});
  m.querySelectorAll("tr[data-go-g]").forEach(tr=>tr.onclick=()=>{Object.assign(SC,{tab:"nk",g:tr.dataset.goG,k:"",st:"",q:"",fn:"",xl:""});renderMain();scrollTo(0,0)})}
function scBCcss(){return `<style>.sochi .scup{color:#c9353d;font-weight:600}.sochi .scdn{color:#23824a;font-weight:600}.sochi .p-do{background:#fde8e8;color:#c9353d}.sochi .scna{color:#667085;font-style:italic}
.sochi .sck4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}.sochi .sck4 .sckpi .v{font-size:19px}.sochi .sckpi .v.na{font-size:15px;color:#667085;font-style:italic;font-weight:600}.sochi .sckpi.warn{border-color:#f1c48d;background:#fffaf3}
.sochi .scw{display:grid;grid-template-columns:96px 1fr;gap:10px;align-items:start;padding:8px 0;border-top:1px solid #eef0f4;font-size:13.5px}
.sochi .scch{border:1px solid #e3e6ee;border-radius:12px;padding:12px 14px;margin-bottom:12px;min-width:0}.sochi .scchh{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}
.sochi .scsb{display:grid;grid-template-columns:minmax(150px,1.1fr) 1.4fr minmax(120px,auto);gap:10px;align-items:center;padding:5px 4px;font-size:13px;border-radius:6px;cursor:pointer}.sochi .scsb.nc{cursor:default}.sochi .scsb:not(.nc):hover{background:#f7f8fb}.sochi .scsb .b{display:flex;height:12px;background:#eef0f5;border-radius:4px;overflow:hidden}.sochi .scsb .b i{display:block;height:12px;border-radius:0 4px 4px 0}.sochi .scsb .v{text-align:right;font-variant-numeric:tabular-nums}
.sochi .scpills{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 12px}.sochi .scpills button{border:1px solid #e3e6ee;background:#fff;border-radius:999px;padding:6px 12px;font:600 13px inherit;font-family:inherit;cursor:pointer;color:#344054}.sochi .scpills button.on{background:#5146c8;border-color:#5146c8;color:#fff}.sochi .scpills button.on .hint{color:#e0ddff}
.sochi tr.scgrp td{background:#f7f8fb;font-weight:700}.sochi tr.scgrp[data-cnf]{cursor:pointer}.sochi tr.scsub td:first-child{padding-left:26px;color:#475467}.sochi tr.scres td{font-weight:700;background:#f4f3ff}
.sochi .scflow{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px}.sochi .scflow div{border:1px solid #e3e6ee;border-radius:10px;padding:10px 12px;font-size:13px}.sochi .scflow b{display:block;margin-bottom:2px}
.sochi .sc-tq{grid-template-columns:1.2fr 1fr}
@media(max-width:900px){.sochi .sck4{grid-template-columns:repeat(2,1fr)}.sochi .scflow,.sochi .sc-tq{grid-template-columns:1fr}.sochi .scsb{grid-template-columns:1fr auto}.sochi .scsb .b{grid-column:1/3;grid-row:2}}
@media(max-width:420px){.sochi .sck4{grid-template-columns:1fr}}</style>`}
/* =====================================================================
   PHÂN LOẠI TRÊN WEB + ĐỐI CHIẾU MISA (chị Hoa 28/10: web là nơi làm chuẩn, MISA chỉ để đối chiếu).
   - Bảng phân loại (đầu tab Chờ xử lý): các dòng sổ chưa rõ nhóm / kênh / còn "Cần rà"; chị Huệ chọn nhóm, kênh từng dòng
     hoặc tích nhiều dòng rồi áp một lần. Cách bổ được nhớ theo diễn giải (fin.cpRule) để tháng sau nạp sổ tự xếp.
   - Đối chiếu MISA: tải sổ xuất từ MISA, so với sổ trên web theo (ngày, số chứng từ, số tiền): khớp, chỉ có ở MISA
     (có thể nạp thêm), chỉ có trên web (chưa hạch toán MISA), tổng hai bên. Không sửa gì khi chưa bấm nạp.
   ===================================================================== */
const scCanPL=x=>x.g!=="G28"&&(x.st!=="Ổn"||x.k==="Chờ xác định"||x.g==="G23"||!x.g);
function scPLTab(){
  const ed=scCanDuyet(),L=scRows().filter(scCanPL).sort((a,b)=>(b.t||0)-(a.t||0));
  if(!L.length)return `<section class="card pad"><h2>Phân loại chi phí</h2><p class="hint">Mọi khoản trong kỳ đã có nhóm và kênh.</p></section>`;
  const gOpt=g=>scDM().map(x=>`<option value="${x.g}"${x.g===g?" selected":""}>${x.g} · ${esc(x.n)}</option>`).join(""),kOpt=k=>SC_COLS.map(c=>`<option value="${c}"${c===k?" selected":""}>${esc(SC_TEN(c))}</option>`).join("");
  return `<section class="card flush"><div class="sch pad"><h2>Phân loại chi phí</h2><span class="hint">${L.length} khoản · ${scNf(scS(L))} đ chưa rõ nhóm, kênh hoặc còn "Cần rà" · chọn xong là lưu, web nhớ cách xếp cho tháng sau</span></div>
  ${ed?`<div class="sch pad" style="background:#f7f8fb;border-block:1px solid #e3e6ee;padding:10px 16px"><b id="scpl-n">Đã chọn 0 khoản</b><select id="scpl-g"><option value="">Giữ nhóm</option>${gOpt("")}</select><select id="scpl-k"><option value="">Giữ kênh</option>${kOpt("")}</select><button class="btn sm pri" id="scpl-ap">Áp cho các khoản đã chọn</button></div>`:""}
  <div class="tbl"><table><thead><tr>${ed?'<th><input type="checkbox" id="scpl-all" aria-label="Chọn tất cả" style="width:auto"></th>':""}<th>Ngày</th><th>Số CT</th><th>Diễn giải</th><th class="n">Số tiền</th><th>Nhóm chi phí</th><th>Kênh / nơi chịu</th><th>Tình trạng</th>${ed?"<th></th>":""}</tr></thead><tbody>
  ${L.map(x=>`<tr>${ed?`<td><input type="checkbox" class="scpl-c" value="${esc(x.id)}" style="width:auto"></td>`:""}<td>${scDd(x.d)}</td><td class="mono">${esc(x.ct||"")}</td><td>${esc(x.dg)}${x.gc?`<div class="hint">${esc(x.gc)}</div>`:""}</td><td class="n"><b>${scNf(x.t)}</b></td>
   <td>${ed?`<select data-bg="${esc(x.id)}" style="max-width:220px">${gOpt(x.g)}</select>`:esc(scG(x.g).n)}</td><td>${ed?`<select class="scbv" data-bv="${esc(x.id)}">${kOpt(x.k)}</select>`:esc(SC_TEN(x.k))}</td><td>${scStP(x.st)}</td>${ed?`<td><button class="btn sm" data-bok="${esc(x.id)}" title="Đã xem, nhóm và kênh đúng">✓ Đúng</button></td>`:""}</tr>`).join("")}</tbody></table></div></section>`}
function scPLbind(m){
  const fix=(dt,id,f)=>{const r=((dt.fin||{}).nkc||[]).find(y=>y.id===id);if(!r)return;f(r);(dt.fin.cpRule=dt.fin.cpRule||{})[scKey(r.dg)]={g:r.g,k:r.k,st:r.st}};
  m.querySelectorAll("select[data-bg]").forEach(s=>s.onchange=()=>{DB.mutate(ME.name,"đổi nhóm khoản chi",dt=>fix(dt,s.dataset.bg,r=>{r.g=s.value;if(r.k!=="Chờ xác định"&&r.g!=="G23"&&r.st==="Cần rà"&&!r.gc)r.st="Ổn"}));renderMain()});
  m.querySelectorAll("[data-bok]").forEach(b=>b.onclick=()=>{DB.mutate(ME.name,"xác nhận khoản chi",dt=>fix(dt,b.dataset.bok,r=>{r.st="Ổn"}));renderMain()});
  const cs=()=>[...m.querySelectorAll(".scpl-c")],cnt=()=>{const n=cs().filter(c=>c.checked).length,e=m.querySelector("#scpl-n");if(e)e.textContent="Đã chọn "+n+" khoản"};
  cs().forEach(c=>c.onchange=cnt);const all=m.querySelector("#scpl-all");if(all)all.onchange=()=>{cs().forEach(c=>c.checked=all.checked);cnt()};
  const ap=m.querySelector("#scpl-ap");if(ap)ap.onclick=()=>{const ids=cs().filter(c=>c.checked).map(c=>c.value),g=m.querySelector("#scpl-g").value,k=m.querySelector("#scpl-k").value;
    if(!ids.length){toast("Tích chọn ít nhất một khoản");return}if(!g&&!k){toast("Chọn nhóm hoặc kênh để áp");return}
    DB.mutate(ME.name,"phân loại "+ids.length+" khoản chi",dt=>ids.forEach(id=>fix(dt,id,r=>{if(g)r.g=g;if(k){if(r.k0==null)r.k0=r.k;r.k=k}if(r.k!=="Chờ xác định"&&r.g!=="G23")r.st="Ổn"})));toast("Đã phân loại "+ids.length+" khoản");renderMain()};
  const dc=document.getElementById("sc-dcmisa");if(dc)dc.onclick=scDoiChieu}
/* Đối chiếu sổ MISA với sổ trên web. */
function scDoiChieu(){
  openDrawerHTML(`<h2>Đối chiếu với sổ MISA</h2><p class="hint">Chọn file sổ cái TK 642 xuất từ MISA (.xls, .xlsx). Web so từng dòng theo ngày, số chứng từ, số tiền với sổ trên web của cùng các tháng. Chỉ xem, không sửa gì trừ khi chị bấm nạp các dòng còn thiếu.</p>
   <label class="field">File MISA<input type="file" id="scdc-f" accept=".xls,.xlsx"></label><div id="scdc-r"></div>`);
  $("#scdc-f").onchange=async e=>{const f=e.target.files[0];if(!f)return;$("#scdc-r").innerHTML=`<p class="hint">Đang đọc…</p>`;let S;try{S=await wbSheets(f)}catch(er){$("#scdc-r").innerHTML=`<div class="note red">Không đọc được file.</div>`;return}
    const r=scParse(S);if(r.err){$("#scdc-r").innerHTML=`<div class="note red">${esc(r.err)}</div>`;return}
    const key=x=>[x.d,String(x.ct||"").trim(),Math.round(+x.t||0)].join("|"),ms=[...new Set(r.rows.map(x=>x.d.slice(0,7)))].sort();
    const web0=((scFin().nkc)||[]).filter(x=>ms.includes(String(x.d||"").slice(0,7))),gom={};
    /* dòng tách trên web (cùng ngày, số chứng từ, có dấu tách) gộp lại trước khi so */
    web0.forEach(x=>{const k=x.tach||x.tachGoc?x.d+"|"+String(x.ct||"").trim():"#"+x.id;if(!gom[k])gom[k]={...x,t:0};gom[k].t+=+x.t||0});
    const web=Object.values(gom),W=new Map(web.map(x=>[key(x),x])),M=new Map(r.rows.map(x=>[key(x),x]));
    const chiMisa=r.rows.filter(x=>!W.has(key(x))),chiWeb=web.filter(x=>!M.has(key(x))),khop=r.rows.length-chiMisa.length;
    const lech=chiMisa.map(x=>{const w=chiWeb.find(y=>y.d===x.d&&String(y.ct||"").trim()===String(x.ct||"").trim());return w?{m:x,w}:null}).filter(Boolean);
    const tb=(L,cap)=>L.length?`<details${L.length<=20?" open":""}><summary><b>${cap} (${L.length} dòng · ${scNf(scS(L))} đ)</b></summary><div class="tbl"><table><thead><tr><th>Ngày</th><th>Số CT</th><th>Diễn giải</th><th class="n">Số tiền</th></tr></thead><tbody>${L.slice(0,200).map(x=>`<tr><td>${scDd(x.d)}</td><td class="mono">${esc(x.ct||"")}</td><td>${esc(x.dg||"")}</td><td class="n">${scNf(x.t)}</td></tr>`).join("")}</tbody></table></div></details>`:"";
    const okT=Math.abs(scS(r.rows)-scS(web))<1;
    $("#scdc-r").innerHTML=`<div class="note${okT&&!chiMisa.length&&!chiWeb.length?"":" amb"}">Tháng ${ms.map(x=>x.slice(5)+"/"+x.slice(0,4)).join(", ")}: MISA <b>${r.rows.length}</b> dòng · ${scNf(scS(r.rows))} đ; web <b>${web.length}</b> dòng · ${scNf(scS(web))} đ ${okT?"✓ tổng khớp":"✗ lệch "+scNf(scS(r.rows)-scS(web))+" đ"}.<br>Khớp từng dòng: <b>${khop}</b>. Chỉ có ở MISA: <b>${chiMisa.length}</b>. Chỉ có trên web: <b>${chiWeb.length}</b>${lech.length?` (trong đó ${lech.length} dòng cùng chứng từ nhưng khác số tiền)`:""}.</div>
     ${lech.length?`<details open><summary><b>Cùng chứng từ, khác số tiền (${lech.length})</b></summary><div class="tbl"><table><thead><tr><th>Ngày</th><th>Số CT</th><th class="n">MISA</th><th class="n">Web</th></tr></thead><tbody>${lech.map(z=>`<tr><td>${scDd(z.m.d)}</td><td class="mono">${esc(z.m.ct)}</td><td class="n">${scNf(z.m.t)}</td><td class="n">${scNf(z.w.t)}</td></tr>`).join("")}</tbody></table></div></details>`:""}
     ${tb(chiMisa,"Chỉ có ở MISA, web chưa có")}${tb(chiWeb,"Chỉ có trên web, MISA chưa hạch toán")}
     ${chiMisa.length&&scCanDuyet()?`<button class="btn pri" id="scdc-nap">Nạp ${chiMisa.length} dòng còn thiếu vào sổ web</button>`:""}`;
    const nb=$("#scdc-nap");if(nb)nb.onclick=()=>{if(!confirm("Nạp "+chiMisa.length+" dòng chỉ có ở MISA vào sổ trên web?"))return;
      DB.mutate(ME.name,"nạp "+chiMisa.length+" dòng còn thiếu từ đối chiếu MISA",dt=>{dt.fin=dt.fin||{};dt.fin.nkc=dt.fin.nkc||[];chiMisa.forEach(x=>dt.fin.nkc.push({id:uid("nk"),...x,by:ME.name,at:Date.now()}))});closeDrawer();toast("Đã nạp "+chiMisa.length+" dòng");renderMain()}}}
/* Thẻ phí vận hành TikTok theo hợp đồng ở Theo kênh › TikTok: tính từ báo cáo TikTok đã tải, so với số đã ghi sổ nhóm G06. */
function scHDTTHtml(ym,full,rows){
  const s=full&&typeof TSB!=="undefined"&&TSB.sum?TSB.sum[ym]:null,so=scS(rows.filter(x=>x.k==="TikTok"&&x.g==="G06"));
  const head=`<div class="scchh"><b>Phí vận hành TikTok (bên Nguyễn Thế Hoàng) theo hợp đồng</b><span class="hint">phí cố định 12,5 triệu/tháng; thưởng khi quảng cáo + affiliate dưới 30% doanh thu: 2% doanh thu nếu doanh thu 800 triệu – 2 tỷ, 3% nếu trên 2 tỷ</span></div>`;
  if(!s||!s.dt)return `<div class="scch">${head}<p class="hint">${full?"Chưa tải báo cáo TikTok tháng này nên chưa tính được.":"Chọn một tháng đã hết để tính theo doanh thu đối soát."} Đã ghi sổ (nhóm G06): ${so?scNf(so)+" đ":"chưa có"}.</p></div>`;
  const aff=Math.abs(+((s.fees||[]).find(f=>/affiliate|KOC/i.test(f[0]))||[0,0])[1]||0),r=scPhiVanHanhTT(+s.dt,+s.ads||0,aff),lech=so-r.tong;
  return `<div class="scch">${head}<div class="tbl"><table><tbody>
   <tr><td>Doanh thu đối soát (báo cáo TikTok)</td><td class="n">${scNf(r.dt)}</td></tr>
   <tr><td>Quảng cáo + hoa hồng affiliate</td><td class="n">${scNf((+s.ads||0)+aff)} <span class="hint">${scPc((+s.ads||0)+aff,r.dt)} doanh thu</span></td></tr>
   <tr><td>Phí cố định</td><td class="n">${scNf(r.phi)}</td></tr>
   <tr><td>Thưởng ${r.muc?Math.round(r.muc*100)+"%":""} <span class="hint">${r.duThuong?"đạt điều kiện":r.dt<800e6?"doanh thu dưới 800 triệu, không thưởng":"quảng cáo + affiliate từ 30% trở lên, không thưởng"}</span></td><td class="n">${r.thuong?scNf(r.thuong):"0"}</td></tr>
   <tr class="tot"><td>Phải trả theo hợp đồng</td><td class="n">${scNf(r.tong)}</td></tr>
   <tr><td>Đã ghi sổ tháng này (nhóm G06)</td><td class="n">${so?scNf(so):'<span class="scna">chưa có</span>'}</td></tr>
   ${so?`<tr><td>Chênh lệch sổ − hợp đồng</td><td class="n"><b class="${Math.abs(lech)<1?"":"scup"}">${Math.abs(lech)<1?"khớp":scNf(lech)}</b></td></tr>`:""}</tbody></table></div>
   ${ym<="2026-09"&&so&&Math.abs(lech)>=1?`<div class="note" style="margin-top:8px">Tháng 9 chi phí ghi nhận theo sổ (${scNf(so)} đ): chị Huệ tính thưởng trên doanh thu chốt đến ngày cuối tháng, còn web dùng doanh thu đối soát chốt hết ngày 9 tháng sau, nên lệch. Từ tháng 10 hai bên cùng chốt hết ngày 9 tháng sau, số sổ và số hợp đồng phải khớp.</div>`:`<p class="hint">Chi phí ghi nhận theo sổ; số hợp đồng để đối chiếu. Doanh thu tính thưởng là doanh thu đối soát chốt hết ngày 9 tháng sau (cùng kỳ với chị Huệ từ tháng 10).</p>`}</div>`}
/* Tách một dòng sổ thành hai phần (chị Hoa 28/10): ví dụ dòng phân bổ TK 242 có phí cố định vận hành TikTok 12,5 triệu.
   Phần tách giữ ngày, số chứng từ, tài khoản; đánh dấu để đối chiếu MISA vẫn cộng lại đúng số gốc. */
function scTach(x){
  if(!scCanDuyet())return;const gOpt=scDM().map(y=>`<option value="${y.g}"${y.g===x.g?" selected":""}>${y.g} · ${esc(y.n)}</option>`).join(""),kOpt=SC_COLS.map(c=>`<option value="${c}"${c===x.k?" selected":""}>${esc(SC_TEN(c))}</option>`).join("");
  openDrawerHTML(`<h2>Tách khoản ${esc(x.ct||"")}</h2><p class="hint">${esc(x.dg)} · ${scNf(x.t)} đ. Tách một phần ra thành dòng riêng (khác nhóm hoặc kênh); phần còn lại giữ ở dòng cũ. Đối chiếu MISA vẫn cộng hai dòng lại theo số chứng từ.</p>
   <form class="frm" id="sctf"><label class="field">Số tiền tách ra<input type="number" id="sct-t" min="1" max="${Math.round(x.t)-1}" required></label>
   <label class="field">Nội dung phần tách<input id="sct-dg" value="" placeholder="ví dụ: Phí cố định vận hành TikTok (bên Hoàng)" required></label>
   <label class="field">Nhóm chi phí<select id="sct-g">${gOpt}</select></label><label class="field">Bổ vào<select id="sct-k">${kOpt}</select></label>
   <div id="sct-e"></div><button class="btn pri">Tách</button></form>`);
  $("#sctf").onsubmit=e=>{e.preventDefault();const t=Math.round(+$("#sct-t").value||0),dg=$("#sct-dg").value.trim(),g=$("#sct-g").value,k=$("#sct-k").value;
    if(!(t>0&&t<Math.round(x.t))){$("#sct-e").innerHTML=`<div class="note red">Số tiền tách phải lớn hơn 0 và nhỏ hơn ${scNf(x.t)} đ.</div>`;return}
    DB.mutate(ME.name,"tách "+scNf(t)+" đ từ dòng sổ "+(x.ct||""),dt=>{const L=(dt.fin||{}).nkc||[],r=L.find(y=>y.id===x.id);if(!r)return;
      r.t=Math.round((+r.t||0)-t);r.tachGoc=1;L.push({...r,id:uid("nk"),t,dg,g,k,st:"Ổn",gc:"tách từ "+(r.ct||"")+" · "+r.dg,tach:r.id,tachGoc:undefined,by:ME.name,at:Date.now()})});
    closeDrawer();toast("Đã tách "+scNf(t)+" đ");renderMain()}}
