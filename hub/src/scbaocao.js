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
const SC_FN=[["mkt","Marketing",["G01","G02","G03","G11"]],["ban","Bán hàng và chi phí kênh",["G04","G06","G12","G19"]],["kho","Kho và giao hàng",["G05","G09","G10"]],["sx","Sản xuất",["G15","G16","G17"]],["lg","Lương, thưởng, bảo hiểm",["G07","G08"]],["ql","Quản lý chung",["G13","G14","G18","G21","G24"]],["tc","Tài chính, thuế và khác",["G22"]],["cho","Chờ xác minh",["G20","G23"]]];
const scFnOf=g=>{const d=scG(g);if(d.fn&&SC_FN.some(x=>x[0]===d.fn))return d.fn;const f=SC_FN.find(x=>x[2].includes(g));return f?f[0]:"ql"};
const scFnTen=k=>(SC_FN.find(x=>x[0]===k)||[k,k])[1];
const scFnRow=x=>x.ext&&x.ext.src==="ncc"?"Chi phí NVL":scFnTen(scFnOf(x.g));
const scLaCoc=x=>!!(x.ext&&x.ext.src==="ncc"&&/^cọc/i.test(String(x.dg||"")));
/* Cách xử lý của một dòng (Nhật ký chi, Phân bổ). */
function scXL(x,qt){
  if(x.ext&&x.ext.src==="ncc")return scLaCoc(x)?"Chặn":"Vào giá thành theo định mức";
  if(x.st==="Chờ duyệt"||x.st==="Chờ CEO duyệt")return "Chờ duyệt";
  if(x.k==="Không tính")return "Chặn";
  if(x.k==="Chờ xác định"||x.st==="Cần rà")return "Chờ";
  if(x.k==="Sản xuất")return "Vào giá thành";
  if(x.k==="Chung"){const r=scQTof(qt||scQT(PERIOD.from.slice(0,7)).qt,x.g);return !r||r.cach==="giu"||!scLaChung(x.g)?"Không chia":"Phân bổ"}
  return SC_KENH.includes(x.k)?"Ghi thẳng":"Chờ"}
const SC_XLC={"Ghi thẳng":"p-ok","Phân bổ":"p-a","Không chia":"p-c","Vào giá thành":"p-c","Vào giá thành theo định mức":"p-c","Chờ":"p-ra","Chờ duyệt":"p-a","Chặn":"p-do"};
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
  return scBCcss()+`<section class="card pad" id="scpk"><div class="sch"><h2>Chi phí theo kênh</h2><span class="hint">${esc(pLabel())}</span><span class="sp"></span>${scPBSeg(CH)}</div>${pills}${kp}<div class="sctwo">${co}${cw}</div>${bang}</section>
  <details class="card pad scpbd"><summary><b>Bảng nhóm chi phí × kênh (toàn bộ sổ) và chia chi chung</b></summary>${scPBBang()}</details>`}
/* ---------- 4. Phân bổ (chỉ xem kết quả) ---------- */
function scPBV(){
  scNap();
  const rows=scPBRows();if(!rows.length)return scEmpty();
  const ym=PERIOD.from.slice(0,7),one=PERIOD.to.slice(0,7)===ym,CH=scChiaPB(rows),Q=scQT(ym),ed=scCanDuyet(),R=[];
  const nguon=x=>x.ext?({ads:"Báo cáo quảng cáo",vc:"Phiếu chi vận chuyển",luong:"Bảng lương (cách chia lương từng người)"}[x.ext.src]||x.nguon):"Chứng từ ghi kênh";
  /* Sửa ngay tại tab (chị Hoa 28/10): mở dòng để đổi "Bổ vào" từng khoản (lưu vào sổ, Nhật ký chi đổi theo), sửa cách chia nhóm chi chung, chia lương. */
  const op=SC.pbOpen||"",go=(a,key)=>{if(!ed)return "";const b=[];if(a.lg)b.push(`<button class="btn sm" data-sct="qt">Chia lương</button>`);
    if(a.L.some(x=>!x.ext))b.push(`<button class="btn sm" data-pbo="${esc(key)}">${op===key?"Thu lại":"Xem từng khoản"}</button>`);
    if(a.xl==="Phân bổ"||a.xl==="Không chia")b.push(`<button class="btn sm" data-qte="${esc(a.g)}">Sửa cách chia</button>`);return b.join(" ")||'<span class="hint">tự cộng</span>'};
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
  <div class="note" style="margin:0 16px 10px">Sửa ngay ở đây: bấm <b>"Xem từng khoản"</b> để mở các chứng từ trong dòng, ghi sai kênh thì chọn lại kênh ngay ở đó (Nhật ký chi đổi theo), <b>"Sửa cách chia"</b> để đặt chia hay để chung cho nhóm chi chung, <b>"Chia lương"</b> để đặt lương ai tính cho kênh nào. Dòng "tự cộng" (quảng cáo, vận chuyển từ báo cáo) không sửa ở đây. Tháng đã chốt thì phải chốt bản điều chỉnh.</div>
  <div class="tbl"><table><thead><tr><th>Khoản chi phí</th><th class="n">Số tiền gốc</th><th>Cách xử lý</th><th>Tiêu thức</th><th>Kênh nhận</th><th class="n">Tỷ lệ</th><th class="n">Số nhận</th><th>Tình trạng</th><th>Sửa</th></tr></thead><tbody>
  ${R.map(r=>`<tr><td>${esc(r[0])}</td><td class="n">${scNf(r[1])}</td><td>${scXLP(r[2])}</td><td>${r[3]}</td><td>${r[4]}</td><td class="n">${r[5]}</td><td class="n">${r[6]==null?"—":scNf(r[6])}</td><td>${r[7]}</td><td>${r[8]}</td></tr>`+(r[9]&&op===r[9].key?r[9].L.slice().sort((a,b)=>(b.t||0)-(a.t||0)).map(x=>`<tr class="scsub"><td>${x.d?scDd(x.d):'<span class="hint">cả kỳ</span>'} <span class="mono">${esc(x.ct||"")}</span> ${esc(x.dg||"")}${x.gc?`<div class="hint">${esc(x.gc)}</div>`:""}</td><td class="n">${scNf(x.t)}</td><td colspan="3"></td><td colspan="3">${!x.ext?`<select class="scbv" data-bv="${esc(x.id)}" aria-label="Bổ khoản chi vào">${SC_COLS.map(k=>`<option value="${k}"${x.k===k?" selected":""}>${esc(SC_TEN(k))}</option>`).join("")}</select>`:esc(SC_TEN(x.k))+' <span class="hint">tự cộng</span>'}</td><td>${scStP(x.st)}</td></tr>`).join(""):"")).join("")}
  <tr class="tot"><td>Tổng</td><td class="n">${scNf(scS(rows))}</td><td colspan="7"></td></tr></tbody></table></div>
  <p class="hint pad">Kiểm tra trước khi chốt: chi chung trước chia ${scNf(CH.truoc)} đ ${ok1?"= sau chia ✓":"≠ sau chia ✗"} · ${ok2?"tỷ lệ, doanh thu đủ để chia ✓":"chưa chia được: "+esc(CH.loi.join("; "))} · khoản chờ xác minh không nằm trong bảng chia ✓ · không khoản nào vừa ghi thẳng vừa chia ✓</p></section>
  <section class="card pad"><h2>Lịch sử phiên bản</h2>${V.length?`<div class="tbl"><table><thead><tr><th>Bản</th><th>Người chốt</th><th>Lúc</th><th>Ghi chú</th></tr></thead><tbody>${V.slice().reverse().map(x=>`<tr><td>Bản ${x.v}</td><td>${esc(x.by||"")}</td><td>${new Date(x.at).toLocaleString("vi-VN")}</td><td>${esc(x.ghi||"")}</td></tr>`).join("")}</tbody></table></div>`:'<p class="hint">Chưa có bản chốt. Chốt xong thì sửa quy tắc không làm đổi số tháng này; muốn đổi phải chốt bản điều chỉnh, ghi lý do, bản cũ giữ nguyên.</p>'}</section>`}
/* Số việc ở tab Chờ xử lý. */
const scChoN=()=>{try{const r=scPBRows();return r.filter(x=>scLoaiTQ(x)==="cho").length+scCho().filter(scInP).length}catch(e){return 0}};
function scBCbind(m){
  m.querySelectorAll("[data-pbo]").forEach(b=>b.onclick=()=>{SC.pbOpen=SC.pbOpen===b.dataset.pbo?"":b.dataset.pbo;renderMain()});
  m.querySelectorAll("[data-nkv]").forEach(el=>el.onclick=()=>{SC.nkv=el.dataset.nkv;Object.assign(SC,{g:"",k:"",st:"",fn:"",xl:""});renderMain()});
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
