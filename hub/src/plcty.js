/* =====================================================================
   LÃI LỖ P&L CÔNG TY (trang quản trị) — giao diện mới chị Hoa duyệt 29/10/2026 (bản xem thử demo-pl-cong-ty.html).
   CHỈ ĐỔI TRÌNH BÀY. Mọi con số lấy từ cùng hàm với Tổng quan / So sánh kênh / Sổ chi phí:
   plMonth (tqgop.js: doanh thu thực, giá vốn, lãi đóng góp, chi chung, Sản xuất, lợi nhuận hoạt động), mtGet (kế hoạch),
   dtSoCp (doanhthu.js: chi phí Sổ chi phí theo kênh / Sản xuất, theo nhóm), cách lọc chi chung giống spChungTheoThang (socp.js).
   Tháng theo ô thời gian trên cùng (plYmNow). Chi tiết mở bằng openPop (cửa sổ nổi giữa màn hình).
   ===================================================================== */
const PLC={k:"",cmp:"prev",open:{}};
const PLC_K=[["tts","TikTok Shop","#111","T"],["fb","Facebook","#1877f2","f"],["spe","Shopee","#ee4d2d","S"],["b2b","Kênh phân phối","#e07b2a","P"],["gc","Kênh OEM","#6b7590","O"]];
const PLC_L={dt:"Doanh thu thực",gv:"Giá vốn hàng bán",ngv:"Hàng chưa có giá vốn",lg:"Lãi gộp",phi:"Phí sàn, vận chuyển, thuế",ads:"Quảng cáo",cpk:"Chi phí trực tiếp kênh",luong:"Lương làm riêng cho kênh",lai:"Lãi đóng góp",chung:"Chi phí chung",sx:"Chi phí Sản xuất"};
const plcM=(v,d=1)=>v==null||!isFinite(v)?"—":(v<0?"−":"")+(Math.abs(v)/1e6).toLocaleString("vi-VN",{minimumFractionDigits:d,maximumFractionDigits:d});
const plcTr=v=>v==null?"—":plcM(v)+"tr";
const plcPc=(a,b,d=1)=>a==null||!b||!isFinite(a/b)?"—":(a/b*100).toLocaleString("vi-VN",{minimumFractionDigits:d,maximumFractionDigits:d})+"%";
const plcNum=v=>v==null?`<span class="hint">—</span>`:`<span class="${v<0?"t-red":""}">${plcM(v)}</span>`;
const plcChg=(a,b,lower)=>{if(a==null||b==null||!b)return `<span class="hint">—</span>`;const d=(a-b)/Math.abs(b),g=lower?d<0:d>0;return `<span class="${g?"plc-up":"plc-dn"}">${d>=0?"▲":"▼"} ${plcPc(Math.abs(d),1)}</span>`};
const plcVn=ym=>"T"+ym.slice(5,7)+"/"+ym.slice(0,4);
/* Một tháng → cột tổng (cả công ty hoặc một kênh). Chi chung, Sản xuất, lợi nhuận hoạt động chỉ có ở cấp công ty. */
function plcTot(A,kk){if(!A)return null;
  if(kk){const c=A.cols[kk];if(!c)return null;return {...c,lg:c.gv==null?null:c.lg,lai:c.lai,chung:null,sx:null,ln:null,thieu:[],chuaTinh:c.gv==null?c.dt:(c.ngv||0),cp:c.gv==null?null:(c.gv||0)+(c.phi||0)+(c.ads||0)+(c.cpk||0)+(c.luong||0)}}
  const T=A.tot;if(!T)return null;
  const chuaTinh=(T.ngv||0)+PLK.reduce((a,[k])=>a+(A.cols[k]&&A.cols[k].gv==null?A.cols[k].dt:0),0);
  return {...T,chung:A.chung,sx:A.sx||0,ln:A.ln,thieu:A.thieu,chuaTinh,cp:A.chung==null?null:(T.gv||0)+(T.phi||0)+(T.ads||0)+(T.cpk||0)+(T.luong||0)+A.chung+(A.sx||0)}}
/* Chi chung theo nhóm: cùng nguồn và cùng điều kiện lọc với spChungTheoThang (Sổ chi phí) + lương chung (dtPB). Lệch (nếu có) ghi "Khác" để tổng luôn khớp dòng Chi phí chung. */
function plcChungNhom(ym,A){const o={},d=D(),add=(k,v)=>{if(v)o[k]=(o[k]||0)+v};
  try{const lo=g=>typeof scG==="function"?scG(g).lo:"",ok=x=>String(x.d||"").slice(0,7)===ym&&x.k==="Chung"&&!(typeof SC_PL_TRU!=="undefined"&&SC_PL_TRU.includes(x.g))&&/^[BC] - /.test(String(lo(x.g)||""))&&x.st!=="Chờ duyệt";
    ((d.fin||{}).nkc||[]).filter(x=>!(typeof scChiDoiChieu==="function"&&scChiDoiChieu(x))).filter(ok).forEach(x=>add(x.g,+x.t||0));
    const r=typeof scTsThang==="function"?scTsThang(ym):null;if(r&&r.chay)(r.dong||[]).map(z=>({d:z.d,g:z.g,k:z.k,t:z.t,st:"Ổn"})).filter(ok).forEach(x=>add(x.g,+x.t||0));
    const cat=k=>(d.costCats||[]).find(c=>c.k===k)||{nhom:"Khác"};(d.costs||[]).filter(c=>(c.ngay?c.ngay.slice(0,7):c.thang)===ym&&!c.kenh&&cat(c.cat).nhom!=="Marketing").forEach(c=>add("tay",+c.tien||0))}catch(e){}
  if(A.pb&&+A.pb.luongChung)add("luong",+A.pb.luongChung);
  const diff=(A.chung||0)-Object.values(o).reduce((a,b)=>a+b,0);if(Math.abs(diff)>=1000)add("khac",diff);return o}
const plcGTen=g=>({tay:"Chi phí nhập tay (chi chung)",luong:"Lương chung",khac:"Khác",TCD:"Thưởng cấp đơn"})[g]||(typeof scG==="function"?scG(g).n:g)||g;
/* Chi phí Sổ chi phí bổ về kênh / Sản xuất theo nhóm (dtSoCp); phần còn lại của chi phí trực tiếp kênh là thưởng cấp đơn (Kênh phân phối). */
function plcSoCp(A){try{return typeof dtSoCp==="function"?dtSoCp(A.R.from,A.R.to):null}catch(e){return null}}
function plcCpkNhom(A,S,k){const o={...((S&&S.gd&&S.gd[k])||{})},c=A.cols[k];if(!c)return o;const r=(c.cpk||0)-Object.values(o).reduce((a,b)=>a+b,0);if(Math.abs(r)>=1000)o.TCD=(o.TCD||0)+r;return o}
function plcGTable(o,title,note,go){const rows=Object.entries(o||{}).filter(([,v])=>v).sort((a,b)=>b[1]-a[1]),t=rows.reduce((a,[,v])=>a+v,0);
  return `<section class="card plc-pc"><h2>${esc(title)}</h2>${note?`<p class="hint">${note}</p>`:""}<table class="plc-t"><tbody>${rows.map(([g,v])=>`<tr><td>${esc(plcGTen(g))}${/^G\d/.test(g)?` <span class="hint">${g}</span>`:""}</td><td class="n">${plcTr(v)}</td><td class="n hint">${plcPc(v,t)}</td></tr>`).join("")||`<tr><td class="hint" colspan="3">Chưa có khoản nào.</td></tr>`}
   <tr class="plc-tot"><td>Tổng</td><td class="n">${plcTr(t)}</td><td></td></tr></tbody></table>${go?`<p><button type="button" class="btn sm" data-plcgo="${go}">Mở ${go==="so_cp"?"Sổ chi phí":"trang kênh"} để xem từng khoản</button></p>`:""}</section>`}
function plcPop(html){openPop(`<div class="plc plc-popw">${html}</div>`);const p=document.getElementById("popIn");if(!p)return;
  p.querySelectorAll("[data-plcgo]").forEach(b=>b.onclick=()=>{closePop(true);PAGE=b.dataset.plcgo;render()});
  p.querySelectorAll("[data-plck]").forEach(b=>b.onclick=()=>plcKenhPop(b.dataset.plck));
  p.querySelectorAll("[data-plcl]").forEach(b=>b.onclick=()=>plcLinePop(b.dataset.plcl))}
let PLC_A=null;
/* Các tháng cũ (xu hướng, lũy kế) nhớ 60 giây để trang không tính lại mỗi lần vẽ (plMonth nặng). */
const PLC_OLD={};
function plcOld(ym){const c=PLC_OLD[ym];if(c&&Date.now()-c.t<60000)return c.v;const v=plMonth(ym);if(!v.loading)PLC_OLD[ym]={t:Date.now(),v};return v}
function plcKenhPop(k){const A=PLC_A,c=A.cols[k],r=A.by[k],n=(PLC_K.find(x=>x[0]===k)||[])[1]||k;
  if(!c)return plcPop(`<section class="card plc-pc"><h2>${esc(n)} · ${plcVn(A.ym)}</h2><p class="hint">${esc(r?r.src||"":"chờ số")}</p>${r&&r.go?`<p><button type="button" class="btn sm" data-plcgo="${r.go}">Mở trang kênh</button></p>`:""}</section>`);
  plcPop(`<section class="card plc-pc"><h2>${esc(n)} · ${plcVn(A.ym)}</h2><p class="hint">${esc(c.src||"")}${r&&r.dang?` · đang giao chưa tính ${nf(r.dang)} đơn (${tr(r.dangDt)})`:""}</p><table class="plc-t"><tbody>
   <tr class="plc-key"><td>Doanh thu thực</td><td class="n">${plcTr(c.dt)}</td><td class="n hint">${c.don?nf(c.don)+" đơn":""}</td></tr>
   ${["gv","ngv","phi","ads","cpk","luong"].map(x=>`<tr><td>− ${PLC_L[x]}</td><td class="n">${c[x]==null?"chưa có":plcTr(c[x])}</td><td class="n hint">${plcPc(c[x],c.dt)}</td></tr>`).join("")}
   <tr class="plc-tot"><td>= Lãi đóng góp</td><td class="n">${c.lai==null?"chưa tính":plcTr(c.lai)}</td><td class="n hint">${plcPc(c.lai,c.dt)}</td></tr></tbody></table>
   ${r&&r.go?`<p><button type="button" class="btn sm" data-plcgo="${r.go}">Mở trang kênh ${esc(n)}</button></p>`:""}</section>`)}
function plcLinePop(f){const A=PLC_A,vn=plcVn(A.ym);
  if(f==="chung")return plcPop(plcGTable(plcChungNhom(A.ym,A),"Chi phí chung · "+vn,"Sổ chi phí, khoản không gắn kênh (gồm khấu hao, phân bổ công cụ dụng cụ)"+(A.tot&&A.tot.chia?` · trong đó đã chia cho kênh theo Quy tắc phân bổ ${plcTr(A.tot.chia)}`:"")+".","so_cp"));
  const S=plcSoCp(A);
  if(f==="sx")return plcPop(plcGTable((S&&S.gd&&S.gd.sx)||{},"Chi phí Sản xuất · "+vn,"Khoản Sổ chi phí gắn Sản xuất.","so_cp"));
  if(f==="cpk"){const o={};PLK.forEach(([k])=>Object.entries(plcCpkNhom(A,S,k)).forEach(([g,v])=>o[g]=(o[g]||0)+v));return plcPop(plcGTable(o,"Chi phí trực tiếp kênh · "+vn,"Khoản Sổ chi phí bổ thẳng về kênh và thưởng cấp đơn.","so_cp"))}
  plcPop(`<section class="card plc-pc"><h2>${esc(PLC_L[f]||f)} · ${vn}</h2><table class="plc-t"><tbody>${PLC_K.filter(([k])=>A.cols[k]).map(([k,n])=>{const c=A.cols[k],v=f==="lg"?(c.gv==null?null:c.lg):c[f];
    return `<tr class="clk" data-plck="${k}"><td>${esc(n)}</td><td class="n">${v==null?"chưa có":plcTr(v)}</td><td class="n hint">${plcPc(v,c.dt)} doanh thu kênh</td></tr>`}).join("")}</tbody></table><p class="hint">Bấm từng kênh để xem chi tiết.</p></section>`)}

function pPLCty(m){
  if(!dhOk()){m.innerHTML=H("Lãi lỗ P&L","")+`<div class="note">Trang này chỉ dành cho CEO và kế toán.</div>`;return}
  dhLoad();const ym=plYmNow(),A=plMonth(ym),pym=plYmAdd(ym,-1),PA=plMonth(pym),KH=mtGet(ym),KK=PLC.k,full=!KK;PLC_A=A;
  const T=plcTot(A,KK),P=plcTot(PA,KK);
  if(!T){m.innerHTML=H("Báo cáo lãi lỗ (P&L)",plcVn(ym))+`<p class="hint pad">${A.loading?"Đang tải…":"Tháng này chưa có số kênh nào."}</p>`;return}
  const chot=ym<plYmAdd(iso(new Date()).slice(0,7),-1)||(ym===plYmAdd(iso(new Date()).slice(0,7),-1)&&+iso(new Date()).slice(8,10)>=10);
  const tag=chot?`<span class="plc-tag ok">Đã chốt</span>`:`<span class="plc-tag du">Dự kiến${A.R.partial?" · số đến "+A.R.to.slice(8,10)+"/"+A.R.to.slice(5,7):""} · chốt ngày 10/${plYmAdd(ym,1).slice(5,7)}</span>`;
  const sauP=P&&P.thieu&&P.thieu.length?` <span class="hint">· tháng trước thiếu ${esc(P.thieu.join(", "))}</span>`:"";
  const vs=(a,b,lower)=>PLC.cmp==="kh"?`<span class="hint">kế hoạch chỉ đặt doanh thu</span>`:b==null?`<span class="hint">tháng trước chưa đủ số</span>`:`${plcChg(a,b,lower)} <span class="hint">so ${A.R.partial?"cả tháng trước":"tháng trước"}</span>`;
  const khK=KH?(KK?KH[{tts:"tts",spe:"spe",fb:"fb",b2b:"b2b",gc:"gc"}[KK]]:KH.tong):null;
  const vsDt=PLC.cmp==="kh"?(khK?`đạt <b>${plcPc(T.dt,khK,0)}</b> kế hoạch (${plcTr(khK)})`:`<span class="hint">chưa đặt kế hoạch</span>`):vs(T.dt,P&&P.dt)+sauP;
  /* 6 ô. Chị Hoa 29/10: bỏ ô Lãi gộp ở đầu trang (còn dòng trong bảng chi tiết), thay bằng Tổng chi phí. */
  const k6=[["Doanh thu thực",plcTr(T.dt),vsDt,"đ","plc-i-b","dt"],
    ["Tổng chi phí",plcTr(T.cp),T.cp==null?`<span class="hint">chưa có chi phí chung</span>`:`${plcPc(T.cp,T.dt)} doanh thu · `+vs(T.cp,P&&P.cp,true),"₫","plc-i-o","cp"],
    ["Lãi đóng góp",plcTr(T.lai),`${plcPc(T.lai,T.dt)} · `+vs(T.lai,P&&P.lai),"%","plc-i-g","lai"],
    ["Lợi nhuận hoạt động",full?plcTr(T.ln):"—",full?(T.ln==null?`<span class="hint">chưa có chi phí chung</span>`:vs(T.ln,P&&P.ln)):`<span class="hint">chỉ tính cho cả công ty</span>`,"↗","plc-i-g","ln"],
    ["Lợi nhuận sau thuế","—",`<span class="hint">chưa có số thuế, thu chi khác</span>`,"◷","plc-i-x","lnst"],
    ["Biên lợi nhuận HĐ",full?plcPc(T.ln,T.dt):"—",full&&P&&P.ln!=null?`<span class="hint">tháng trước ${plcPc(P.ln,P.dt)}</span>`:`<span class="hint">—</span>`,"◔","plc-i-b","ln"]];
  const kpis=`<div class="plc-kpis">${k6.map(([l,v,s,ic,c,f])=>`<button type="button" class="plc-kpi" data-plcf="${f}"><span class="plc-ic ${c}">${ic}</span><span class="plc-kl">${l}</span><span class="plc-kv">${v}</span><span class="plc-km">${s}</span></button>`).join("")}</div>`;
  /* Bảng kênh: luôn đủ 5 kênh, tỷ trọng trên doanh thu cả công ty. */
  const CT=plcTot(A,""),CP=plcTot(PA,"");
  const kenh=`<div class="tbl"><table class="plc-t"><thead><tr><th>Kênh</th><th class="n">Doanh thu thực</th><th class="n">Lãi gộp</th><th class="n">Lãi đóng góp</th><th class="n">Biên</th><th class="n">So th. trước</th><th class="n">Tỷ trọng</th></tr></thead><tbody>${PLC_K.map(([k,n,cl,ic])=>{const c=A.cols[k],p=PA.cols[k];
      return `<tr class="clk" data-plck="${k}"><td><span class="plc-chn"><span class="plc-lg" style="background:${cl}">${ic}</span>${esc(n)}</span></td>${!c?`<td class="n hint" colspan="6" style="text-align:left">chờ số · ${esc((A.by[k]&&A.by[k].src)||"chờ tải báo cáo")}</td>`:
      `<td class="n">${plcNum(c.dt)}</td><td class="n">${c.gv==null?`<span class="hint">chưa có giá vốn</span>`:plcNum(c.lg)}</td><td class="n"><b>${c.lai==null?"—":plcNum(c.lai)}</b></td><td class="n">${plcPc(c.lai,c.dt)}</td><td class="n">${p?plcChg(c.dt,p.dt):`<span class="hint">—</span>`}</td><td class="n">${plcPc(c.dt,CT.dt)}<span class="plc-bar"><i style="width:${CT.dt?Math.max(0,c.dt/CT.dt*100):0}%;background:${cl}"></i></span></td>`}</tr>`}).join("")}
    <tr class="plc-tot"><td>Tổng cộng</td><td class="n">${plcNum(CT.dt)}</td><td class="n">${plcNum(CT.lg)}</td><td class="n">${plcNum(CT.lai)}</td><td class="n">${plcPc(CT.lai,CT.dt)}</td><td class="n">${CP?plcChg(CT.dt,CP.dt):"—"}</td><td class="n">100%</td></tr></tbody></table></div>`;
  /* Cầu nối lợi nhuận (thác nước). */
  const cpk2=(T.phi||0)+(T.ads||0)+(T.cpk||0)+(T.luong||0);
  const steps=[["Doanh\nthu thực",T.dt,"t","dt"],["Giá vốn",T.lg==null?null:-((T.gv||0)+(T.ngv||0)),"d","gv"],["Lãi gộp",T.lg,"t","lg"],["Chi phí\nkênh",T.lai==null?null:-cpk2,"d","cpk2"],["Lãi đóng\ngóp",T.lai,"t","lai"]].concat(full&&T.ln!=null?[["Chi phí\nchung, SX",-(T.chung+T.sx),"d","chung"],["Lợi nhuận\nhoạt động",T.ln,"t","ln"]]:[]);
  const wf=(()=>{const W=400,Hh=250,pl=30,pb=40,pt=18,mx=Math.max(T.dt,1)*1.05,y=v=>pt+(Hh-pt-pb)*(1-v/mx),bw=(W-pl-10)/steps.length;let run=0,s=`<svg viewBox="0 0 ${W} ${Hh}" width="100%" class="plc-svg">`;
    for(let i=0;i<=4;i++){const v=mx*i/4;s+=`<line x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="#eef1f6"/><text x="${pl-4}" y="${y(v)+3}" font-size="9" text-anchor="end" fill="#8a93a8">${Math.round(v/1e6).toLocaleString("vi-VN")}</text>`}
    steps.forEach(([l,v,t,f],i)=>{const x=pl+i*bw+bw*.17,w=bw*.66;l.split("\n").forEach((ln,j)=>s+=`<text x="${x+w/2}" y="${Hh-pb+14+j*11}" font-size="9.5" text-anchor="middle" fill="#56607a">${ln}</text>`);if(v==null)return;let a,b,col;
      if(t==="t"){a=Math.min(0,v);b=Math.max(0,v);run=v;col=i===0||f==="ln"?"#1d3266":"#22b07d";if(v<0)col="#d63c3c"}else{a=run+v;b=run;run=a;col="#f08c8c"}
      const top=y(Math.max(a,b)),h=Math.max(1,Math.abs(y(a)-y(b)));
      s+=`<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${col}" rx="2" class="plc-wfb" data-plcw="${f}"/><text x="${x+w/2}" y="${top-4}" font-size="11.5" font-weight="700" text-anchor="middle" fill="${t==="d"?"#d63c3c":"#16213a"}">${t==="d"?"−":""}${plcM(Math.abs(v),0)}</text>`});
    return s+`</svg>`})();
  /* Bảng P&L chi tiết. */
  const PM=PA,ytdMs=[];for(let i=-5;i<=0;i++){const k=plYmAdd(ym,i);if(k.slice(0,4)===ym.slice(0,4))ytdMs.push(k)}
  const MS=ytdMs.map(k=>({k,A:k===ym?A:k===pym?PA:plcOld(k)})).map(o=>({...o,T:plcTot(o.A,KK)}));
  const ytd=f=>{let s=0,ok=false;MS.forEach(o=>{if(o.T&&o.T[f]!=null){s+=o.T[f];ok=true}});return ok?s:null};
  const khC=`<span class="hint">${KH?"":"chưa đặt"}</span>`;
  const row=(f,l,cls,o={})=>{const v=o.v!==undefined?o.v:T[f],pv=P?(P[f]!==undefined?P[f]:null):null,sg=o.neg?-1:1,show=x=>x==null?null:sg*x,N=o.neg?(x=>x==null?`<span class="hint">—</span>`:plcM(x)):plcNum,yv=o.noYtd?null:ytd(f),dd=v==null||pv==null?null:(v-pv)*sg;
    const kh=f==="dt"&&khK?`${plcM(khK)} <span class="hint">· đạt ${plcPc(T.dt,khK,0)}</span>`:khC;
    return `<tr class="${cls||""}${o.g?" plc-tg"+(PLC.open[o.g]?" open":""):""}" ${o.g?`data-plcg="${o.g}"`:""}><td>${o.g?`<span class="plc-ar">▶</span>`:""}${l}</td>${o.na?`<td class="n"><span class="hint"><i>${o.na}</i></span></td><td></td><td class="n hint">—</td><td></td><td></td>`:
      `<td class="n${o.ck?" plc-ck":""}" ${o.ck?`data-plcl="${o.ck}"`:""}>${N(show(v))}</td><td class="n hint">${plcPc(v,T.dt)}</td><td class="n">${pv==null?`<span class="hint">—</span>`:N(show(pv))}</td><td class="n">${dd==null?`<span class="hint">—</span>`:`<span class="${dd>=0?"plc-up":"plc-dn"}">${dd>=0?"+":""}${plcM(dd)}</span>`}</td><td class="n">${yv==null?`<span class="hint">—</span>`:N(show(yv))}</td>`}<td class="n">${kh}</td></tr>`};
  const sub=(g,items)=>items.map(x=>`<tr class="plc-ex" data-plcp="${g}" ${PLC.open[g]?"":"hidden"}><td>${esc(x.n)}</td><td class="n">${x.v==null?`<span class="hint">chưa có</span>`:plcM(x.v)}</td><td class="n hint">${x.pd||""}</td><td class="n">${x.pv==null?`<span class="hint">—</span>`:plcM(x.pv)}</td><td></td><td></td><td></td></tr>`).join("");
  const per=f=>PLC_K.filter(([k])=>A.cols[k]&&(!KK||KK===k)).map(([k,n])=>{const c=A.cols[k],p=PM.cols[k];return {n,v:c[f],pv:p?p[f]:null,pd:plcPc(c[f],c.dt)+" DT kênh"}});
  const grp=(o,po)=>Object.entries(o||{}).filter(([,v])=>v).sort((a,b)=>b[1]-a[1]).map(([g,v])=>({n:plcGTen(g),v,pv:po&&po[g]!=null?po[g]:null,pd:plcPc(v,T.dt)}));
  const S=plcSoCp(A),SP=plcSoCp(PA);
  let rows=row("dt","Doanh thu thực","plc-key",{ck:"dt"})+row("gv","Giá vốn hàng bán","plc-sub",{neg:1,ck:"gv",g:"gv"})+sub("gv",per("gv"));
  if(T.ngv)rows+=row("ngv",`Hàng chưa có giá vốn <span class="hint">(không tính lãi)</span>`,"plc-sub",{neg:1,g:"ngv"})+sub("ngv",per("ngv").filter(x=>x.v));
  rows+=row("lg","Lãi gộp","plc-key",{ck:"lg"})
    +row("phi","Phí sàn, vận chuyển, thuế","plc-sub",{neg:1,g:"phi",ck:"phi"})+sub("phi",per("phi"))
    +row("ads","Quảng cáo","plc-sub",{neg:1,g:"ads",ck:"ads"})+sub("ads",per("ads"))
    +row("cpk","Chi phí trực tiếp kênh","plc-sub",{neg:1,g:"cpk",ck:"cpk"})+sub("cpk",per("cpk").filter(x=>x.v))
    +row("luong","Lương làm riêng cho kênh","plc-sub",T.luong?{neg:1,g:"luong"}:{na:"chưa chốt"})+(T.luong?sub("luong",per("luong").filter(x=>x.v)):"")
    +row("lai","Lãi đóng góp","plc-tot",{ck:"lai"});
  if(full)rows+=row("chung",`Chi phí chung <span class="hint">(gồm khấu hao)</span>`,"plc-sub",T.chung==null?{na:"chưa có số"}:{neg:1,g:"chung",ck:"chung"})+(T.chung==null?"":sub("chung",grp(plcChungNhom(ym,A),PA.chung!=null?plcChungNhom(pym,PA):null)))
    +row("sx","Chi phí Sản xuất","plc-sub",{neg:1,g:"sx",ck:"sx"})+sub("sx",grp(S&&S.gd&&S.gd.sx,SP&&SP.gd&&SP.gd.sx))
    +row("ln","Lợi nhuận hoạt động","plc-tot",T.ln==null?{na:"chưa có chi phí chung"}:{ck:"chung"})
    +row("khac","Thu nhập, chi phí khác","plc-sub",{na:"chưa có"})+row("lntt","Lợi nhuận trước thuế","plc-key",{na:"chưa có số"})
    +row("thue","Thuế TNDN","plc-sub",{na:"chưa có số"})+row("lnst","Lợi nhuận sau thuế","plc-tot",{na:"chưa có số"});
  else rows+=`<tr><td colspan="7" class="hint">Chi phí chung, Sản xuất và lợi nhuận hoạt động chỉ tính cho cả công ty (chưa chia cho kênh).</td></tr>`;
  const ytdTip=MS.filter(o=>o.T&&o.T.thieu&&o.T.thieu.length).map(o=>plcVn(o.k)+" thiếu "+o.T.thieu.join(", ")).join("; ");
  const pl=`<div class="tbl"><table class="plc-t plc-pl"><thead><tr><th>Chỉ tiêu</th><th class="n">${plcVn(ym)}</th><th class="n">% DT</th><th class="n">${plcVn(pym)}</th><th class="n">Chênh lệch</th><th class="n" title="${esc("Cộng "+MS.map(o=>plcVn(o.k)).join(", ")+(ytdTip?". "+ytdTip:""))}">Lũy kế năm*</th><th class="n">Kế hoạch</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  /* Xu hướng 6 tháng (bỏ các tháng đầu chưa có số). */
  const TR=[];for(let i=-5;i<=0;i++){const k=plYmAdd(ym,i),o=MS.find(x=>x.k===k),a=o?o.A:(k===pym?PA:plcOld(k));TR.push({k,A:a,T:o?o.T:plcTot(a,KK)})}
  while(TR.length>1&&!(TR[0].T&&TR[0].T.dt))TR.shift();
  const trend=(()=>{const W=460,Hh=200,pl=40,pb=34,pt=12,mx=Math.max(1,...TR.map(o=>o.T?o.T.dt:0))*1.1,n=TR.length,x=i=>n<2?W/2:pl+20+i*(W-pl-50)/(n-1),y=v=>pt+(Hh-pt-pb)*(1-v/mx);let s=`<svg viewBox="0 0 ${W} ${Hh}" width="100%" class="plc-svg">`;
    for(let i=0;i<=4;i++){const v=mx*i/4;s+=`<line x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="#eef1f6"/><text x="${pl-4}" y="${y(v)+3}" font-size="9" text-anchor="end" fill="#8a93a8">${Math.round(v/1e6).toLocaleString("vi-VN")}</text>`}
    const thieu=o=>(o.T&&o.T.thieu)||[];
    TR.forEach((o,i)=>{const th=thieu(o);s+=`<text x="${x(i)}" y="${Hh-pb+14}" font-size="10" text-anchor="middle" fill="#16213a">T${o.k.slice(5)}</text><text x="${x(i)}" y="${Hh-pb+26}" font-size="8.5" text-anchor="middle" fill="${th.length?"#c2810f":"#8a93a8"}">${th.length?"thiếu "+esc(th.map(z=>z.split(" ")[0]).join(", ")):o.k===ym&&!chot?"dự kiến":""}</text>`});
    [["dt","#1d3266"],["lai","#22b07d"],["ln","#3b6fd8"]].forEach(([f,c])=>{const pts=TR.map((o,i)=>o.T&&o.T[f]!=null?[x(i),y(o.T[f]),o]:null);
      for(let i=1;i<pts.length;i++)if(pts[i]&&pts[i-1])s+=`<line x1="${pts[i-1][0]}" y1="${pts[i-1][1]}" x2="${pts[i][0]}" y2="${pts[i][1]}" stroke="${c}" stroke-width="2" ${thieu(pts[i][2]).length||thieu(pts[i-1][2]).length?`stroke-dasharray="4 3"`:""}/>`;
      pts.forEach(p=>{if(p)s+=`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#fff" stroke="${c}" stroke-width="2"><title>${plcTr(p[2].T[f])}</title></circle>`})});
    return s+`</svg>`})();
  /* Cơ cấu chi phí và top chi phí. */
  const CC=[["Giá vốn",T.gv||0,"#3b6fd8","gv"],["Quảng cáo",T.ads||0,"#f29a2e","ads"],["Phí sàn, ship",T.phi||0,"#22b07d","phi"],["Chi phí chung",full?T.chung||0:0,"#9b7be0","chung"],["Chi phí khác",(T.cpk||0)+(T.luong||0)+(full?T.sx||0:0),"#b7bfcf","cpk"]],cpT=CC.reduce((a,c)=>a+Math.max(0,c[1]),0);
  const donut=(()=>{let a=-Math.PI/2,s=`<svg viewBox="0 0 120 120" width="104" style="flex:none">`;CC.forEach(([,v,c])=>{if(v<=0||!cpT)return;const b=a+v/cpT*Math.PI*2-1e-6,r=50,ri=34,p=(g,R)=>[60+R*Math.cos(g),60+R*Math.sin(g)],L=b-a>Math.PI?1:0,[x1,y1]=p(a,r),[x2,y2]=p(b,r),[x3,y3]=p(b,ri),[x4,y4]=p(a,ri);
    s+=`<path d="M${x1} ${y1}A${r} ${r} 0 ${L} 1 ${x2} ${y2}L${x3} ${y3}A${ri} ${ri} 0 ${L} 0 ${x4} ${y4}Z" fill="${c}"/>`;a=b});
    return s+`<text x="60" y="54" font-size="8" text-anchor="middle" fill="#6b7590">Tổng chi phí</text><text x="60" y="67" font-size="12" font-weight="800" text-anchor="middle" fill="#16213a">${plcM(cpT,0)}tr</text><text x="60" y="78" font-size="8" text-anchor="middle" fill="#6b7590">${plcPc(cpT,T.dt)} DT</text></svg>`})();
  const TP=[];PLC_K.forEach(([k,n])=>{const c=A.cols[k];if(!c||(KK&&KK!==k))return;[["ads","Quảng cáo","#f29a2e"],["phi","Phí sàn, ship","#22b07d"],["gv","Giá vốn","#3b6fd8"]].forEach(([f,l,cl])=>{if(c[f]>0)TP.push([`${l} ${n.replace("Kênh ","")}`,c[f],cl,`data-plck="${k}"`])})});
  if(full&&T.chung)Object.entries(plcChungNhom(ym,A)).forEach(([g,v])=>{if(v>0)TP.push([plcGTen(g),v,"#9b7be0",`data-plcl="chung"`])});
  TP.sort((a,b)=>b[1]-a[1]);const top=TP.slice(0,6),tmx=top[0]?top[0][1]:1;
  /* Cảnh báo & ghi chú. */
  const W=[];
  if(full&&T.thieu.length)W.push(["red",`${T.thieu.join(", ")} chưa có số`,"Chưa tải báo cáo nên doanh thu, chi phí kênh này chưa vào P&L.",`data-plck="${(PLC_K.find(x=>x[1]===T.thieu[0])||["tts"])[0]}"`]);
  if(!T.luong)W.push(["red","Chưa trừ lương nhân viên","Bảng lương tháng chưa chốt, lợi nhuận đang cao hơn thực tế.",""]);
  if(full&&T.chung!=null&&P&&P.chung&&T.chung<P.chung*.3)W.push(["amb",`Chi phí chung mới có ${plcTr(T.chung)}`,`Sổ chi phí tháng này chưa ghi đủ (tháng trước ${plcTr(P.chung)}).`,`data-plcl="chung"`]);
  if(full&&T.chung==null)W.push(["amb","Chưa có chi phí chung","Sổ chi phí tháng này chưa có khoản chi chung nên chưa ra lợi nhuận hoạt động.",""]);
  if(T.chuaTinh)W.push(["amb",`${plcTr(T.chuaTinh)} doanh thu chưa có giá vốn`,"Để riêng, không tính lãi. Cần kế toán điền giá vốn các mã này.",`data-plcl="ngvw"`]);
  const qcMax=(dhGet().nguong||{}).qcMax||.4;
  PLC_K.forEach(([k,n])=>{const c=A.cols[k];if(c&&c.dt&&c.ads/c.dt>qcMax&&(!KK||KK===k))W.push(["blu",`Quảng cáo ${n} ${plcPc(c.ads,c.dt,0)} doanh thu`,`Vượt ngưỡng ${Math.round(qcMax*100)}%. Lãi đóng góp kênh còn ${plcPc(c.lai,c.dt)}.`,`data-plck="${k}"`])});
  if(A.tot&&A.tot.tam)W.push(["blu","Có phần doanh thu tạm tính","Ngày chưa có báo cáo sàn, số sẽ chốt khi tải báo cáo tháng.",""]);
  const sel=(id,opts,v)=>`<select id="${id}">${opts.map(([k,t])=>`<option value="${k}" ${k===v?"selected":""}>${t}</option>`).join("")}</select>`;
  m.innerHTML=`<div class="plc">
   <div class="plc-head"><h1>Báo cáo lãi lỗ (P&L)</h1>${tag}<span class="hint">Doanh thu thực, không GMV · số quản trị nội bộ, sổ chính thức ở MISA</span></div>
   <div class="plc-filt"><div><label>Kỳ báo cáo</label><div class="plc-ky">Tháng ${ym.slice(5,7)}/${ym.slice(0,4)} <span class="hint">· đổi ở ô thời gian trên cùng</span></div></div>
    <div><label>So sánh với</label>${sel("plcCmp",[["prev","Tháng trước"],["kh","Kế hoạch"]],PLC.cmp)}</div>
    <div><label>Kênh bán</label>${sel("plcK",[["","Tất cả kênh"]].concat(PLC_K.map(([k,n])=>[k,n])),KK)}</div></div>
   ${kpis}
   <div class="plc-grid"><section class="card"><div class="plc-ch"><h2>Hiệu quả kinh doanh theo kênh</h2><span class="hint">bấm từng kênh để xem chi tiết</span></div>${kenh}</section>
    <section class="card"><div class="plc-ch"><h2>Cầu nối lợi nhuận</h2><span class="hint">triệu đồng</span></div>${wf}</section></div>
   <div class="plc-grid plc-g2"><section class="card"><div class="plc-ch"><h2>Bảng P&L chi tiết</h2><span class="hint">triệu đồng</span><a class="plc-all">${Object.values(PLC.open).some(Boolean)?"Thu gọn":"Mở hết"}</a></div>${pl}
     <p class="hint plc-foot">Lãi đóng góp = lãi gộp − phí sàn, vận chuyển, thuế − quảng cáo − chi phí Sổ chi phí bổ thẳng về kênh − lương làm riêng cho kênh. Lợi nhuận hoạt động = lãi đóng góp − chi phí chung − chi phí Sản xuất. Hàng chưa có giá vốn để riêng, không tính lãi.${A.pb&&A.pb.loi&&A.pb.loi.length?" Chưa chia được: "+esc(A.pb.loi.join("; "))+".":""}</p></section>
    <div class="plc-col">
     <section class="card"><div class="plc-ch"><h2>Xu hướng doanh thu và lợi nhuận</h2><span class="hint">triệu đồng</span></div><div class="plc-leg"><span><i style="background:#1d3266"></i>Doanh thu thực</span><span><i style="background:#22b07d"></i>Lãi đóng góp</span><span><i style="background:#3b6fd8"></i>Lợi nhuận hoạt động</span></div>${trend}<p class="hint plc-foot">Nét đứt: tháng còn thiếu kênh nên chưa so được.</p></section>
     <div class="plc-two"><section class="card"><div class="plc-ch"><h2>Cơ cấu chi phí</h2><span class="hint">% doanh thu</span></div><div class="plc-dn">${donut}<div class="plc-dl">${CC.map(([l,v,c,f])=>`<div data-plcl="${f}"><i style="background:${c}"></i>${l}<b>${plcPc(v,T.dt)}</b></div>`).join("")}</div></div></section>
      <section class="card"><div class="plc-ch"><h2>Top chi phí lớn nhất</h2></div>${top.map(([l,v,c,at])=>`<div class="plc-tb" ${at}><span>${esc(l)}</span><span class="t"><i style="width:${v/tmx*100}%;background:${c}"></i></span><b>${plcTr(v)}</b><span>${plcPc(v,T.dt,0)}</span></div>`).join("")||`<p class="hint">Chưa có số.</p>`}</section></div>
     <section class="card"><div class="plc-ch"><h2>Cảnh báo & ghi chú</h2></div><div class="plc-warns">${W.map(([c,b,s,at])=>`<div class="plc-w ${c}" ${at}><b>${c==="blu"?"ⓘ":"⚠"} ${esc(b)}</b><span>${esc(s)}</span>${at?`<u>Xem chi tiết ›</u>`:""}</div>`).join("")||`<span class="hint">Không có cảnh báo.</span>`}</div></section>
    </div></div></div>`;
  /* Gắn sự kiện */
  const $m=s=>m.querySelector(s);
  $m("#plcCmp").onchange=e=>{PLC.cmp=e.target.value;renderMain()};$m("#plcK").onchange=e=>{PLC.k=e.target.value;renderMain()};
  m.querySelectorAll("[data-plck]").forEach(e=>e.onclick=()=>plcKenhPop(e.dataset.plck));
  m.querySelectorAll("[data-plcl]").forEach(e=>e.onclick=()=>{const f=e.dataset.plcl;if(f==="ngvw")return plcPop(`<section class="card plc-pc"><h2>Doanh thu chưa có giá vốn · ${plcVn(ym)}</h2><table class="plc-t"><tbody>${PLC_K.filter(([k])=>A.cols[k]&&(A.cols[k].ngv||A.cols[k].gv==null)).map(([k,n])=>`<tr class="clk" data-plck="${k}"><td>${esc(n)}</td><td class="n">${plcTr(A.cols[k].gv==null?A.cols[k].dt:A.cols[k].ngv)}</td></tr>`).join("")}</tbody></table><p class="hint">Bấm từng kênh để xem nguồn số. Giá vốn điền ở Lãi lỗ › Giá thành & định mức.</p></section>`);plcLinePop(f)});
  m.querySelectorAll(".plc-kpi").forEach(e=>e.onclick=()=>{const f=e.dataset.plcf;
    if(f==="lnst")return plcPop(`<section class="card plc-pc"><h2>Lợi nhuận sau thuế</h2><p>Lợi nhuận sau thuế = lợi nhuận hoạt động + thu nhập khác − chi phí khác (bồi thường sàn, lãi vay…) − thuế thu nhập doanh nghiệp.</p><p class="hint">Web chưa có chỗ nhập thu nhập, chi phí khác và thuế TNDN nên chưa ra số. Khi có chỗ nhập thì ô này tự có số.</p></section>`);
    if(f==="cp")return plcPop(`<section class="card plc-pc"><h2>Tổng chi phí · ${plcVn(ym)}</h2><table class="plc-t"><tbody>${[["gv","Giá vốn hàng bán"],["ads","Quảng cáo"],["phi","Phí sàn, vận chuyển, thuế"],["cpk","Chi phí trực tiếp kênh"],["luong","Lương làm riêng cho kênh"]].concat(full?[["chung","Chi phí chung"],["sx","Chi phí Sản xuất"]]:[]).map(([k,l])=>[k,l,T[k]||0]).sort((a,b)=>b[2]-a[2]).map(([k,l,v])=>`<tr class="clk" data-plcl="${k}"><td>${l}</td><td class="n">${plcTr(v)}</td><td class="n hint">${plcPc(v,T.dt)} doanh thu</td></tr>`).join("")}<tr class="plc-tot"><td>Tổng</td><td class="n">${plcTr(T.cp)}</td><td class="n hint">${plcPc(T.cp,T.dt)}</td></tr></tbody></table><p class="hint">Bấm từng dòng để xem chi tiết.</p></section>`);
    plcLinePop(f==="ln"?"chung":f)});
  m.querySelectorAll(".plc-wfb").forEach(r=>r.onclick=()=>{const f=r.dataset.plcw;if(f==="cpk2")return plcPop(`<section class="card plc-pc"><h2>Chi phí kênh · ${plcVn(ym)}</h2><table class="plc-t"><tbody>${["phi","ads","cpk","luong"].map(x=>`<tr class="clk" data-plcl="${x}"><td>${PLC_L[x]}</td><td class="n">${plcTr(T[x]||0)}</td><td class="n hint">${plcPc(T[x]||0,T.dt)}</td></tr>`).join("")}</tbody></table></section>`);plcLinePop(f==="ln"?"chung":f)});
  m.querySelectorAll(".plc-ck").forEach(td=>td.onclick=e=>{e.stopPropagation();plcLinePop(td.dataset.plcl)});
  const tg=(g,on)=>{PLC.open[g]=on;const r=m.querySelector(`tr[data-plcg="${g}"]`);if(r)r.classList.toggle("open",on);m.querySelectorAll(`tr[data-plcp="${g}"]`).forEach(s=>s.hidden=!on)};
  m.querySelectorAll("tr.plc-tg").forEach(r=>r.querySelector("td").onclick=()=>tg(r.dataset.plcg,!PLC.open[r.dataset.plcg]));
  $m(".plc-all").onclick=e=>{const on=e.target.textContent==="Mở hết";m.querySelectorAll("tr.plc-tg").forEach(r=>tg(r.dataset.plcg,on));e.target.textContent=on?"Thu gọn":"Mở hết"};
}
(function(){if(typeof document==="undefined"||document.getElementById("plc-css"))return;const s=document.createElement("style");s.id="plc-css";s.textContent=`
.plc{font-size:12.5px}.plc .hint{font-size:11.5px}
.plc-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:2px 0 10px}.plc-head h1{font-size:19px;font-weight:800;margin:0;color:#1d3266;text-transform:uppercase;letter-spacing:.2px}
.plc-tag{font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600}.plc-tag.du{background:#fff3df;color:#c2810f}.plc-tag.ok{background:#e2f5ec;color:#17915f}
.plc-filt{display:grid;grid-template-columns:repeat(3,minmax(160px,230px));gap:10px;background:#fff;border:1px solid #e5e9f0;border-radius:10px;padding:8px 12px;margin-bottom:10px}
.plc-filt label{font-size:11.5px;color:#6b7590;display:block;margin-bottom:3px}.plc-filt select{width:100%;font:inherit;padding:5px 8px;border:1px solid #e5e9f0;border-radius:6px;background:#fff}.plc-ky{padding:5px 0;font-weight:600}
.plc-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:10px}
.plc-kpi{display:flex;flex-direction:column;align-items:flex-start;text-align:left;font:inherit;color:inherit;background:#fff;border:1px solid #e5e9f0;border-radius:10px;padding:10px 12px;position:relative;cursor:pointer}.plc-kpi:hover{border-color:#b8c5dd}
.plc-ic{position:absolute;right:10px;top:10px;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700}
.plc-i-b{background:#e6f0ff;color:#3b6fd8}.plc-i-g{background:#e3f6ee;color:#17915f}.plc-i-o{background:#fff1e3;color:#e0812a}.plc-i-x{background:#eef0f5;color:#6b7590}
.plc-kl{font-size:12px;font-weight:600}.plc-kv{font-size:19px;font-weight:800;margin:4px 0 2px}.plc-km{font-size:11.5px;color:#6b7590}
.plc-up{color:#17915f;font-weight:700}.plc-dn{color:#d63c3c;font-weight:700}
.plc-grid{display:grid;grid-template-columns:1.35fr 1fr;gap:10px;margin-bottom:10px;align-items:start}.plc-grid>*,.plc-two>*{min-width:0}.plc-grid .card,.plc-col .card{margin:0;padding:10px 12px}
.plc-col{display:flex;flex-direction:column;gap:10px;min-width:0}.plc-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:10px}
.plc-ch{display:flex;align-items:baseline;gap:8px;margin-bottom:8px}.plc-ch h2{font-size:13.5px;font-weight:700;margin:0}.plc-ch .hint{margin-left:auto}.plc-ch a{color:#3b6fd8;cursor:pointer;font-size:12px}
.plc-t{width:100%;border-collapse:collapse}.plc-t th,.plc-t td{padding:5px 6px;border-bottom:1px solid #e5e9f0;white-space:nowrap}.plc-t th{font-size:11.5px;color:#6b7590;font-weight:600;background:#f6f8fc}
.plc-t .n{text-align:right}.plc-pl td:first-child{min-width:200px}
.plc-t tr.plc-tot td{background:#eef3fc;font-weight:700}.plc-t tr.plc-key td{font-weight:700;background:#f8faff}.plc-t tr.plc-sub td{color:#4b5570}.plc-t tr.plc-sub td:first-child{padding-left:20px}
.plc-t tr.plc-ex td{color:#5a6480;font-size:11.5px;background:#fbfcfe}.plc-t tr.plc-ex td:first-child{padding-left:38px}
.plc-tg td:first-child{cursor:pointer}.plc-ar{display:inline-block;width:14px;color:#6b7590;font-size:9px;transition:transform .15s}.plc-tg.open .plc-ar{transform:rotate(90deg)}
.plc-ck{cursor:pointer}.plc-ck:hover{text-decoration:underline dotted;background:#f2f6fd}.plc-t tr.clk{cursor:pointer}.plc-t tr.clk:hover td{background:#f5f8fe}
.plc-chn{display:flex;align-items:center;gap:7px;font-weight:600}.plc-lg{width:20px;height:20px;border-radius:5px;display:grid;place-items:center;color:#fff;font-size:10px;font-weight:800;flex:none}
.plc-bar{display:inline-block;width:34px;height:7px;background:#edf0f6;border-radius:4px;vertical-align:middle;margin-left:6px;overflow:hidden}.plc-bar i{display:block;height:100%;border-radius:4px}
.plc-svg{max-height:250px;display:block;margin:0 auto}.plc-wfb{cursor:pointer}.plc-svg text{font-family:inherit}
.plc-leg{display:flex;gap:12px;justify-content:flex-end;font-size:11.5px;color:#6b7590}.plc-leg span{display:flex;align-items:center;gap:4px}.plc-leg i{width:14px;height:3px;border-radius:2px}
.plc-dn{display:flex;align-items:center;gap:10px}.plc-dl{flex:1;min-width:0}.plc-dl div{display:flex;align-items:center;gap:6px;margin:4px 0;cursor:pointer;white-space:nowrap}.plc-dl i{width:9px;height:9px;border-radius:50%;flex:none}.plc-dl b{margin-left:auto;font-weight:600}
.plc-tb{display:grid;grid-template-columns:minmax(0,150px) minmax(40px,1fr) 62px 32px;gap:6px;align-items:center;font-size:11.5px;margin:5px 0;cursor:pointer}.plc-tb>span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.plc-tb .t{height:9px;background:#edf0f6;border-radius:3px;overflow:hidden}.plc-tb .t i{display:block;height:100%;border-radius:3px}.plc-tb b{text-align:right;font-weight:600}.plc-tb span:last-child{text-align:right;color:#6b7590}
.plc-warns{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px}
.plc-w{border-radius:8px;padding:9px 10px;border:1px solid;display:flex;flex-direction:column;gap:3px}.plc-w[data-plck],.plc-w[data-plcl]{cursor:pointer}.plc-w b{font-size:12px}.plc-w span{font-size:11.5px;color:#56607a}.plc-w u{text-decoration:none;font-size:11.5px;font-weight:600}
.plc-w.red{background:#fff3f3;border-color:#f6caca}.plc-w.red b,.plc-w.red u{color:#d63c3c}.plc-w.amb{background:#fff8ea;border-color:#f3dcab}.plc-w.amb b,.plc-w.amb u{color:#c2810f}.plc-w.blu{background:#f1f5fe;border-color:#cfdbf7}.plc-w.blu b,.plc-w.blu u{color:#3b6fd8}
.plc-foot{margin:6px 2px 0}.plc-popw{max-width:640px;margin:0 auto}.plc-pc h2{font-size:14px;margin:0 0 4px}.plc-pc p{margin:6px 0}
@media(max-width:1300px){.plc-grid:not(.plc-g2){grid-template-columns:1.75fr 1fr}.plc-g2{grid-template-columns:1fr}.plc-col{display:grid;grid-template-columns:1fr 1fr}.plc-col>.card:first-child,.plc-col>.card:last-child{grid-column:1/-1}.plc-col>.plc-two{display:contents}}
@media(max-width:1100px){.plc-kpis{grid-template-columns:repeat(3,1fr)}}
@media(max-width:1000px){.plc-grid,.plc-grid:not(.plc-g2){grid-template-columns:1fr}}
@media(max-width:640px){.plc-kpis{grid-template-columns:repeat(2,1fr)}.plc-filt{grid-template-columns:1fr}.plc-col{display:flex}.plc-two{grid-template-columns:1fr}}
`;document.head.appendChild(s)})();
