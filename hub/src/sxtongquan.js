/* =====================================================================
   TỔNG QUAN SẢN XUẤT (chị Hoa duyệt demo 05/11, kiểu Power BI).
   Trả lời 5 câu hỏi buổi sáng: xưởng làm gì · thiếu vật tư gì · thành phẩm đủ bán không · việc chờ ai · hao hụt.
   Số lấy từ sổ kho (/kho/ton, KTON), số bán + đơn mua + việc chờ (/kho/tq-sx), lệnh sản xuất (ngăn Sản xuất).
   Chỉ đọc, không ghi gì. Thay trang sx_tq cũ (đếm theo lô, toàn số 0 khi xưởng chưa ghi lệnh trên web).
   ===================================================================== */
const TQX={d:null,busy:false,at:0,err:"",role:""};
const TQX_SER=[["TIKTOK","TikTok","#2a78d6"],["FACEBOOK","Facebook","#eb6834"],["SHOPEE","Shopee","#1baf7a"],["B2B","Kênh phân phối","#eda100"]];
const TQX_ST={crit:["#d03b3b","!"],warn:["#fab219","◷"],good:["#0ca30c","✓"],neu:["#c3c7d4","–"]};
function tqxLoad(force){if(TQX.busy||(!force&&TQX.d&&Date.now()-TQX.at<60000))return;TQX.busy=true;
  svApi("/api/hub/kho/tq-sx").then(d=>{TQX.d=d;TQX.at=Date.now();TQX.err=""}).catch(e=>{TQX.err=e.message||"Không tải được số"}).finally(()=>{TQX.busy=false;if(PAGE==="sx_tq")renderMain()})}
const tqxF=n=>Number(Math.round(n)).toLocaleString("vi-VN");
const tqxDd=s=>s?s.slice(8,10)+"/"+s.slice(5,7):"";
const tqxGo=p=>{if(!PAGES[p]){toast("Trang này chưa mở cho tài khoản của bạn");return}PAGE=p;renderMain();scrollTo(0,0)};
const tqxPill=(k,t)=>`<span class="tqst ${k}"><i>${TQX_ST[k][1]}</i>${t}</span>`;
function tqxRoleDefault(){if(ME.role==="admin"||(typeof mhManage==="function"&&mhManage()))return "ceo";if(can(ME,"sx.kiemke"))return "kt";return "xg"}

/* Gom số từ sổ kho + gói số máy chủ */
function tqxCalc(){
  const D=TQX.d,R=KTON.rows||[],cls=c=>(KHO.items&&KHO.items.get(c)||{}).cls;
  const days=[];{const t=new Date(D.from14+"T00:00:00Z");for(let i=0;i<14;i++){days.push(new Date(t.getTime()+i*864e5).toISOString().slice(0,10))}}
  const S={};TQX_SER.forEach(([k])=>S[k]=days.map(()=>0));
  D.days.forEach(x=>{const i=days.indexOf(x.day);if(i<0)return;const k=S[x.channel]?x.channel:"TIKTOK";S[k][i]+=+x.qty||0});
  D.b2b.forEach(x=>{const i=days.indexOf(x.day);if(i>=0)S.B2B[i]+=+x.qty||0});
  const tot=days.map((_,i)=>TQX_SER.reduce((t,[k])=>t+S[k][i],0)),wk=tot.slice(7).reduce((a,b)=>a+b,0),pw=tot.slice(0,7).reduce((a,b)=>a+b,0);
  const ban=new Map(D.ban7.map(x=>[x.item,(+x.qty||0)/7]));
  const TP=R.filter(r=>r.active!==0&&(cls(r.code)==="TP"||cls(r.code)==="HH"));
  const stOf=r=>{const b=ban.get(r.code)||0;if(r.ton<0)return "crit";if(b>0)return r.ton/b<7?"warn":"good";return r.ton>0?"neu":""};
  const cnt={crit:0,warn:0,good:0,neu:0};TP.forEach(r=>{const s=stOf(r);if(s)cnt[s]++});
  const cover=TP.filter(r=>ban.get(r.code)>0).sort((a,b)=>ban.get(b.code)-ban.get(a.code)).slice(0,10).map(r=>({r,b:ban.get(r.code),st:stOf(r)}));
  const poCodes=new Set();(D.po||[]).forEach(p=>String(p.codes||"").split(",").forEach(c=>c&&poCodes.add(c)));
  const NV=R.filter(r=>r.nhom!=="TP"&&r.ton<0).sort((a,b)=>a.ton-b.ton);
  const chuaKiem=R.filter(r=>r.trang_thai==="AM"&&!r.da_kiem).length,am=R.filter(r=>r.trang_thai==="AM").length;
  const sx=typeof SX==="function"?SX():{requests:[],batches:[]},run=(sx.requests||[]).filter(r=>r.st==="CAN_LAM"||r.st==="DANG_LAM"),choKiem=(sx.batches||[]).filter(b=>b.st==="CHO_KIEM");
  const vari=(KHO.alerts&&KHO.alerts.variance)||[];
  const TPS=TP.map(r=>({r,st:stOf(r),b:ban.get(r.code)||0})).filter(x=>x.st);
  return {TPS,R,days,S,tot,wk,pw,cnt,cover,NV,poCodes,chuaKiem,am,amTP:cnt.crit,amNV:NV.length,run,choKiem,vari,D,ban};
}

/* ---------- Vẽ ---------- */
function tqxSpark(v){const w=96,h=28,mx=Math.max(1,...v);return `<svg width="${w}" height="${h}" aria-hidden="true"><polyline fill="none" stroke="#2a78d6" stroke-width="2" stroke-linejoin="round" points="${v.map((x,i)=>`${(i*(w-4)/(v.length-1)+2).toFixed(1)},${(h-3-(x/mx)*(h-6)).toFixed(1)}`).join(" ")}"/></svg>`}
function tqxSales(el,C){const W=el.clientWidth||700,H=230,P={l:46,r:8,t:8,b:26},iw=W-P.l-P.r,ih=H-P.t-P.b;
  const step=Math.max(500,Math.ceil(Math.max(1,...C.tot)/4/500)*500),mx=step*4,y=v=>P.t+ih-v/mx*ih,bw=iw/C.days.length,gw=Math.max(8,bw*.58);
  let s=`<svg width="${W}" height="${H}" role="img" aria-label="Hàng bán ra theo ngày theo kênh">`;
  for(let g=0;g<=mx;g+=step)s+=`<line x1="${P.l}" x2="${W-P.r}" y1="${y(g)}" y2="${y(g)}" stroke="#eef0f5"/><text x="${P.l-6}" y="${y(g)+4}" text-anchor="end">${tqxF(g)}</text>`;
  C.days.forEach((d,i)=>{let base=0;const x=P.l+i*bw+(bw-gw)/2,segs=TQX_SER.filter(([k])=>C.S[k][i]>0);
    segs.forEach(([k,,c],si)=>{const v=C.S[k][i],y1=y(base+v),h=Math.max(0,y(base)-y1-(base?2:0)),top=si===segs.length-1;
      s+=top&&h>4?`<path d="M${x},${y1+h} V${y1+4} Q${x},${y1} ${x+4},${y1} H${x+gw-4} Q${x+gw},${y1} ${x+gw},${y1+4} V${y1+h} Z" fill="${c}"/>`:`<rect x="${x}" y="${y1}" width="${gw}" height="${h}" fill="${c}"/>`;base+=v});
    s+=`<rect x="${P.l+i*bw}" y="${P.t}" width="${bw}" height="${ih}" fill="transparent" data-ti="${i}"/>`;
    if(i%2===1||i===C.days.length-1)s+=`<text x="${x+gw/2}" y="${H-8}" text-anchor="middle">${tqxDd(d)}</text>`});
  el.innerHTML=s+"</svg>";
  el.querySelectorAll("[data-ti]").forEach(r=>{r.onmousemove=e=>{const i=+r.dataset.ti;tqxTip(e,`<b>${tqxDd(C.days[i])}</b>${TQX_SER.map(([k,n,c])=>`<div><span><i class="tqdot" style="background:${c}"></i>${n}</span><span>${tqxF(C.S[k][i])}</span></div>`).join("")}<div class="tqtot"><span>Tổng</span><b>${tqxF(C.tot[i])}</b></div>`)};r.onmouseleave=tqxTipOff})}
function tqxDonut(el,C){const L=[["crit","Âm kho"],["warn","Dưới 7 ngày bán"],["good","Đủ bán trên 7 ngày"],["neu","Có tồn, 7 ngày chưa bán"]].map(([k,n])=>[k,n,C.cnt[k]]),T=Math.max(1,L.reduce((t,x)=>t+x[2],0)),R=62,r=42,cx=70,cy=70;
  let a=-Math.PI/2,s=`<svg width="140" height="140" role="img" aria-label="Tình trạng tồn thành phẩm">`;
  L.forEach(([k,,v],i)=>{if(!v)return;const a2=a+v/T*Math.PI*2,g=.02,p=(an,rr)=>[cx+rr*Math.cos(an),cy+rr*Math.sin(an)],A=a+g,B=Math.max(A+.001,a2-g),lg=B-A>Math.PI?1:0,[x1,y1]=p(A,R),[x2,y2]=p(B,R),[x3,y3]=p(B,r),[x4,y4]=p(A,r);
    s+=`<path d="M${x1},${y1} A${R},${R} 0 ${lg} 1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${lg} 0 ${x4},${y4} Z" fill="${TQX_ST[k][0]}" data-td="${i}"/>`;a=a2});
  s+=`<text x="${cx}" y="${cy-2}" text-anchor="middle" style="font-size:22px;font-weight:700;fill:#1d2240">${L.reduce((t,x)=>t+x[2],0)}</text><text x="${cx}" y="${cy+15}" text-anchor="middle">mã</text></svg>`;
  el.querySelector(".tqdn").innerHTML=s;
  el.querySelector(".tqdl").innerHTML=L.map(([k,n,v])=>`<div>${tqxPill(k,n)}<b>${v}</b></div>`).join("");
  el.querySelectorAll("[data-td]").forEach(p=>{p.onmousemove=e=>{const d=L[+p.dataset.td];tqxTip(e,`<b>${d[1]}</b><div><span>Số mã</span><span>${d[2]}</span></div><div><span>Tỷ lệ</span><span>${Math.round(d[2]/T*100)}%</span></div>`)};p.onmouseleave=tqxTipOff})}
function tqxNvl(el,C){const L=C.NV.slice(0,8);if(!L.length){el.innerHTML=`<p class="tqempty">Không có vật tư âm kho.</p>`;return}
  const W=el.clientWidth||420,rh=22,H=L.length*rh+4,lw=Math.min(190,W*.42),mx=Math.max(...L.map(x=>-x.ton)),iw=W-lw-56;
  let s=`<svg width="${W}" height="${H}" role="img" aria-label="Vật tư âm kho">`;
  L.forEach((r,i)=>{const y=i*rh+2,w=Math.max(3,-r.ton/mx*iw),nm=(r.name||r.code).length>28?(r.name||r.code).slice(0,27)+"…":(r.name||r.code);
    s+=`<text x="0" y="${y+14}" style="fill:#5b6180;font-size:12px">${esc(nm)}</text><path d="M${lw},${y+4} H${lw+w-4} Q${lw+w},${y+4} ${lw+w},${y+8} V${y+12} Q${lw+w},${y+16} ${lw+w-4},${y+16} H${lw} Z" fill="#d03b3b" data-tn="${i}"/><text x="${lw+w+6}" y="${y+14}" style="fill:#1d2240;font-size:12px">${tqxF(r.ton)}</text>`});
  el.innerHTML=s+"</svg>"+(C.NV.length>8?`<p class="tqhint">+ ${C.NV.length-8} mã nữa ở Tồn kho nguyên vật liệu.</p>`:"");
  el.querySelectorAll("[data-tn]").forEach(p=>{p.onmousemove=e=>{const r=L[+p.dataset.tn];tqxTip(e,`<b>${esc(r.name||r.code)}</b><div><span>Mã</span><span>${esc(r.code)}</span></div><div><span>Tồn</span><span style="color:#d03b3b">${tqxF(r.ton)}</span></div><div><span>Đơn mua</span><span>${C.poCodes.has(r.code)?"đang chờ về":"chưa có"}</span></div>`)};p.onmouseleave=tqxTipOff})}
function tqxTip(e,h){let t=document.getElementById("tqtip");if(!t){t=document.createElement("div");t.id="tqtip";t.className="tqtip";document.body.appendChild(t)}t.innerHTML=h;t.style.display="block";const w=t.offsetWidth;t.style.left=Math.min(e.clientX+14,innerWidth-w-8)+"px";t.style.top=(e.clientY+14)+"px"}
function tqxTipOff(){const t=document.getElementById("tqtip");if(t)t.style.display="none"}

function pSxTqx(m){
  if(typeof khoLoad==="function")khoLoad();if(typeof ktonLoad==="function")ktonLoad();tqxLoad();
  if(!TQX.role)TQX.role=tqxRoleDefault();
  const head=(b,act)=>sxFrame(m,"sx_tq","Tổng quan sản xuất","Xưởng làm gì · thiếu vật tư gì · thành phẩm đủ bán không · việc chờ ai · hao hụt",b,act||"");
  if(TQX.err){head(`<div class="note red">${esc(TQX.err)} <button class="lnk" id="tq-re">Thử lại</button></div>`);if($("#tq-re"))$("#tq-re").onclick=()=>tqxLoad(true);return}
  if(!TQX.d||!KTON.rows||!KHO.items||!KHO.items.size){head(`<p class="hint pad">Đang tải số…</p>`);return}
  const C=tqxCalc(),role=TQX.role;
  const RO={ceo:["CEO / Trưởng phòng",["ban","tp","nvl","cho","xuong"]],kt:["Kế toán kho",["cho","nvl","tp","ban"]],xg:["Tổ trưởng xưởng",["xuong","nvl","tp"]]};
  const dl=C.wk-C.pw,cmp=C.pw?(Math.abs(dl)/C.pw<.03?`bằng 7 ngày trước (${tqxF(C.pw)})`:`${dl>0?"tăng":"giảm"} ${Math.round(Math.abs(dl)/C.pw*100)}% so với 7 ngày trước`):"",sp=tqxSpark(C.tot.slice(7));
  const nvlNoPo=C.NV.filter(r=>!C.poCodes.has(r.code)).length,poN=(C.D.po||[]).length,gap=C.cnt.crit+C.cnt.warn;
  const tasks=[
    C.D.cho_xuat?["crit",`${C.D.cho_xuat} đơn Kênh phân phối chờ xuất kho`,"Kế toán kho","Xuất kho","kho_xuat_b2b",true,["kt","ceo"]]:null,
    C.chuaKiem?["crit",`${C.chuaKiem} mã đang âm mà chưa có số kiểm`,"Kế toán kho · đếm rồi lập Phiếu kiểm tồn","Kiểm kê tồn","kho_kk",false,["kt","ceo"]]:null,
    poN?["warn",`${poN} đơn mua chờ hàng về`,"Kế toán kho ghi phiếu nhập khi hàng tới","Phiếu nhập","kho_nhap",false,["kt","ceo"]]:null,
    nvlNoPo?["crit",`${nvlNoPo} vật tư âm kho chưa có đơn mua`,"Phụ trách mua hàng","Đơn mua hàng","mh_po",false,["ceo","xg"]]:null,
    C.D.lech.cho?["warn",`${C.D.lech.cho} dòng hàng về lệch đơn mua chờ chốt tiền`,"Phụ trách mua hàng","Phê duyệt","pheduyet",false,["ceo"]]:["good","Hàng về lệch đơn mua",`Mua hàng · 0 đang chờ, ${C.D.lech.xong} đã xử lý`,"","",false,["ceo"]],
    C.choKiem.length?["warn",`${C.choKiem.length} lô chờ kế toán kiểm`,"Kế toán kho","Đóng gói & kiểm kê","sx_lo",false,["kt","xg","ceo"]]:null].filter(t=>t&&t[6].includes(role));
  const KP={
    ceo:[["Hàng bán ra 7 ngày",tqxF(C.wk),cmp,"#2a78d6",sp,"ban"],["Thành phẩm âm kho",C.amTP,"mã · bán vượt số đang có","#d03b3b","","tpam"],["Sắp hết hàng bán",C.cnt.warn,"mã · còn dưới 7 ngày","#fab219","","saphet"],["Vật tư âm kho",C.amNV,`mã · ${nvlNoPo} mã chưa có đơn mua`,"#d03b3b","","nvlam"],["Việc đang chờ",tasks.filter(t=>t[0]!=="good").length,"việc · bấm để xem","#4b54d1","","cho"]],
    kt:[["Đơn chờ xuất kho",C.D.cho_xuat,"đơn Kênh phân phối","#d03b3b","","go:kho_xuat_b2b"],["Hàng mua chờ về",poN,poN&&C.D.po[0].expected_date?`đơn · sớm nhất hẹn ${tqxDd(C.D.po[0].expected_date)}`:"đơn","#fab219","","po"],["Mã chưa có số kiểm",C.chuaKiem,"mã đang âm","#d03b3b","","chuakiem"],["Mã âm cần kiểm lại",C.am,`${C.amTP} thành phẩm · ${C.amNV} vật tư`,"#d03b3b","","am"],["Hàng bán ra 7 ngày",tqxF(C.wk),"trừ kho tự động","#2a78d6",sp,"ban"]],
    xg:[["Lệnh đang chạy",C.run.length,C.run.length?"lệnh cần làm / đang làm":"chưa có lệnh trên web","#c3c7d4","","go:sx_nc"],["Lô chờ kiểm",C.choKiem.length,"lô","#c3c7d4","","go:sx_lo"],["Thành phẩm cần làm gấp",gap,`${C.cnt.crit} âm + ${C.cnt.warn} sắp hết`,"#d03b3b","","gap"],["Vật tư đang thiếu",C.amNV,"mã âm kho","#d03b3b","","nvlam"],["Hao hụt quá 5%",C.vari.length||"–",C.vari.length?"mẻ pha chế lệch định mức":"chưa có mẻ lệch","#c3c7d4","","go:kho_cl"]]}[role];
  const dim=k=>RO[role][1].includes(k)?"":" dim";
  const cover=C.cover.length?`<table class="tqt"><thead><tr><th>Thành phẩm</th><th class="n">Tồn</th><th style="width:34%">Bán trung bình / ngày</th><th>Còn bán được</th></tr></thead><tbody>${(()=>{const mx=Math.max(...C.cover.map(x=>x.b));return C.cover.map(({r,b,st})=>{const d=r.ton/b,lb=st==="crit"?"Âm kho":r.ton<=0?"Hết hàng":d<1?"Dưới 1 ngày":Math.round(d)+" ngày";
      return `<tr><td>${esc(r.name||r.code)}<small>${esc(r.code)}</small></td><td class="n${r.ton<0?" neg":""}">${tqxF(r.ton)}</td><td><div class="tqbar"><span style="width:calc(${b/mx*100}% - 46px)"></span><em>${b.toLocaleString("vi-VN",{maximumFractionDigits:1})}</em></div></td><td>${tqxPill(st,lb)}</td></tr>`}).join("")})()}</tbody></table>`:`<p class="tqempty">7 ngày qua chưa có thành phẩm nào bán ra.</p>`;
  const po=(C.D.po||[]).length?`<table class="tqt"><thead><tr><th>Đơn mua</th><th>Nhà cung cấp</th><th>Hàng</th><th>Hẹn về</th></tr></thead><tbody>${C.D.po.slice(0,5).map(p=>{const late=p.expected_date&&p.expected_date<C.D.today;return `<tr><td>${esc(p.no)}</td><td>${esc(p.supplier||"")}</td><td><span class="tqclip" title="${esc(p.items||"")}">${esc(p.items||"")}</span></td><td>${p.expected_date?tqxPill(late?"crit":"warn",(late?"Trễ · ":"")+tqxDd(p.expected_date)):tqxPill("neu","chưa hẹn")}</td></tr>`}).join("")}</tbody></table>`:`<p class="tqempty">Không có đơn mua nào đang chờ về.</p>`;
  const xuong=C.run.length?`<table class="tqt"><thead><tr><th>Thành phẩm</th><th class="n">Số lượng</th><th>Hạn</th><th>Đang ở</th></tr></thead><tbody>${C.run.slice(0,6).map(r=>`<tr><td>${esc((typeof sxP==="function"?sxP(r.sp).ten:"")||r.sp)}</td><td class="n">${r.sl?tqxF(r.sl):"—"}</td><td>${r.han?tqxDd(r.han):"—"}</td><td>${tqxPill(r.st==="DANG_LAM"?"good":"warn",r.st==="DANG_LAM"?"Đang làm":"Cần làm")}</td></tr>`).join("")}</tbody></table>`
    :`<div class="tqempty big"><div><b>Chưa có lệnh sản xuất nào ghi trên web.</b><br>Khi Phụ trách kế hoạch lập lệnh ở Phiếu sản xuất, ô này hiện lệnh đang chạy, đang ở bước nào và mẻ nào hao hụt quá 5% so với định mức.</div></div>`;
  const body=`<div class="tqx">
   <div class="tqbar0"><span class="tqmeta">Tồn kho tính đến hôm nay · số bán các kênh đến hết ${tqxDd(C.D.today)} (7 ngày từ ${tqxDd(C.D.from7)})</span><span class="tqsp"></span><div class="tqseg">${Object.entries(RO).map(([k,[t]])=>`<button class="${k===role?"on":""}" data-tqr="${k}">${t}</button>`).join("")}</div></div>
   <div class="tqkpis">${KP.map(([l,v,d,c,s,k])=>`<div class="tqc tqk" data-tqk="${k||""}" title="Bấm để xem chi tiết"><div class="l"><i class="tqdot" style="background:${c}"></i>${l}</div><div class="v">${v}</div><div class="f"><span>${d}</span>${s||""}</div></div>`).join("")}</div>
   <div class="tqg"><div class="tqc c8${dim("ban")}"><div class="tqh"><h3>Hàng bán ra theo ngày, theo kênh</h3><span>đơn vị kho · 14 ngày</span></div><div id="tq-sales"></div><div class="tqleg">${TQX_SER.map(([,n,c])=>`<span><i class="tqdot" style="background:${c}"></i>${n}</span>`).join("")}</div></div>
    <div class="tqc c4${dim("tp")}" id="tq-dn"><div class="tqh"><h3>Tình trạng tồn thành phẩm</h3><span>thành phẩm, hàng hóa đang dùng</span></div><div class="tqdw"><div class="tqdn"></div><div class="tqdl"></div></div></div></div>
   <div class="tqg"><div class="tqc c7${dim("tp")}"><div class="tqh"><h3>Thành phẩm bán chạy: còn bán được bao lâu</h3><a class="tql" data-tqg="kho_ton_tp">Tồn kho thành phẩm ›</a></div>${cover}</div>
    <div class="tqc c5${dim("nvl")}"><div class="tqh"><h3>Vật tư đang âm kho</h3><a class="tql" data-tqg="kho_ton">Tồn kho nguyên vật liệu ›</a></div><div id="tq-nvl"></div>
     <div class="tqh" style="margin-top:14px"><h3>Đơn mua đang chờ về</h3><a class="tql" data-tqg="mh_po">Đơn mua hàng ›</a></div>${po}</div></div>
   <div class="tqg"><div class="tqc c6${dim("cho")}"><div class="tqh"><h3>Việc đang chờ</h3><span>ai cần làm · bấm để tới đúng chỗ</span></div>${tasks.length?tasks.map(([k,t,who,btn,go,pri])=>`<div class="tqtask">${tqxPill(k,"")}<div class="t"><b>${t}</b><small>${who}</small></div>${btn?`<button class="btn sm${pri?" pri":""}" data-tqg="${go}">${btn}</button>`:tqxPill("good","Xong")}</div>`).join(""):`<p class="tqempty">Không có việc nào đang chờ.</p>`}</div>
    <div class="tqc c6${dim("xuong")}"><div class="tqh"><h3>Lệnh sản xuất & hao hụt</h3><a class="tql" data-tqg="sx_nc">Phiếu sản xuất ›</a></div>${xuong}${C.vari.length?`<p class="tqhint" style="margin-top:8px"><b style="color:#d03b3b">${C.vari.length} mẻ pha chế lệch định mức quá 5%</b> · xem ở Chênh lệch & cảnh báo.</p>`:""}</div></div>
  </div>`;
  head(body);
  m.querySelectorAll("[data-tqr]").forEach(b=>b.onclick=()=>{TQX.role=b.dataset.tqr;renderMain()});
  m.querySelectorAll("[data-tqk]").forEach(b=>b.onclick=()=>{const k=b.dataset.tqk;if(!k)return;if(k.startsWith("go:"))return tqxGo(k.slice(3));if(k==="cho"){const t=m.querySelector(".tqtask");if(t)t.closest(".tqc").scrollIntoView({behavior:"smooth",block:"center"});return}tqxDetail(k,C)});
  m.querySelectorAll("[data-tqg]").forEach(b=>b.onclick=e=>{e.preventDefault();tqxGo(b.dataset.tqg)});
  requestAnimationFrame(()=>{const a=$("#tq-sales"),d=$("#tq-dn"),n=$("#tq-nvl");if(a)tqxSales(a,C);if(d)tqxDonut(d,C);if(n)tqxNvl(n,C)});
}
/* Bấm ô chỉ số: ngăn bên hiện danh sách mã tạo nên con số; bấm một mã xem từng phiếu (Nhập – xuất – tồn). */
function tqxDetail(k,C){
  const nm=r=>`${esc(r.name||r.code)}<small>${esc(r.code)}</small>`,bq=b=>b?b.toLocaleString("vi-VN",{maximumFractionDigits:1}):"—";
  const tbl=(h,rows)=>rows.length?`<div class="tbl"><table class="tqt"><thead><tr>${h.map(x=>`<th${/Tồn|Bán|Còn|Tổng|TikTok|Facebook|Shopee|phân phối/.test(x)?' class="n"':""}>${x}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`:`<p class="tqempty">Không có mã nào.</p>`;
  const row=(x,extra)=>`<tr class="clk" data-tqc="${esc(x.r.code)}"><td>${nm(x.r)}</td><td class="n${x.r.ton<0?" neg":""}">${tqxF(x.r.ton)}</td><td class="n">${bq(x.b)}</td><td>${extra||""}</td></tr>`;
  let T="",H="",go="",gl="";
  if(k==="ban"){T="Hàng bán ra theo ngày";
    H=tbl(["Ngày",...TQX_SER.map(x=>x[1]),"Tổng"],C.days.map((d,i)=>`<tr><td>${tqxDd(d)}</td>${TQX_SER.map(([s])=>`<td class="n">${tqxF(C.S[s][i])}</td>`).join("")}<td class="n"><b>${tqxF(C.tot[i])}</b></td></tr>`).reverse())
     +`<h3 style="margin:16px 0 6px">Mã bán nhiều nhất 7 ngày</h3>`+tbl(["Mã","Tồn","Bán / ngày","Tình trạng"],[...C.ban].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([c,b])=>{const r=C.R.find(x=>x.code===c)||{code:c,name:c,ton:0};const x=C.TPS.find(y=>y.r.code===c);return row({r,b},x?tqxPill(x.st,{crit:"Âm kho",warn:"Sắp hết",good:"Đủ bán",neu:"—"}[x.st]):"")}))}
  else if(k==="tpam"||k==="saphet"||k==="gap"){const L=C.TPS.filter(x=>k==="tpam"?x.st==="crit":k==="saphet"?x.st==="warn":x.st==="crit"||x.st==="warn").sort((a,b)=>a.r.ton-b.r.ton);
    T=k==="tpam"?"Thành phẩm âm kho":k==="saphet"?"Sắp hết hàng bán (dưới 7 ngày)":"Thành phẩm cần làm gấp";go="kho_ton_tp";gl="Tồn kho thành phẩm";
    H=tbl(["Mã","Tồn","Bán / ngày","Ghi chú"],L.map(x=>row(x,x.st==="warn"?tqxPill("warn",x.r.ton<=0?"Hết hàng":x.r.ton/x.b<1?"Dưới 1 ngày":Math.round(x.r.ton/x.b)+" ngày"):x.r.da_kiem?tqxPill("crit","Âm sau kiểm"):tqxPill("neu","Chưa có số kiểm"))))}
  else if(k==="nvlam"){T="Vật tư âm kho";go="kho_ton";gl="Tồn kho nguyên vật liệu";
    H=tbl(["Mã","Tồn","Bán / ngày","Đơn mua"],C.NV.map(r=>row({r,b:C.ban.get(r.code)||0},C.poCodes.has(r.code)?tqxPill("warn","Đang chờ về"):tqxPill("crit","Chưa có"))))}
  else if(k==="chuakiem"||k==="am"){const L=C.R.filter(r=>r.trang_thai==="AM"&&(k==="am"||!r.da_kiem)).sort((a,b)=>a.ton-b.ton);
    T=k==="am"?"Mã âm cần kiểm lại":"Mã đang âm, chưa có số kiểm";go="kho_kk";gl="Kiểm kê tồn";
    H=tbl(["Mã","Tồn","Bán / ngày","Số kiểm"],L.map(r=>row({r,b:C.ban.get(r.code)||0},r.da_kiem?tqxPill("good","Đã kiểm "+tqxDd(r.moc||"")):tqxPill("neu","Chưa có"))))}
  else if(k==="po"){T="Đơn mua đang chờ về";go="kho_nhap";gl="Lập phiếu nhập";
    H=tbl(["Đơn mua","Nhà cung cấp","Hàng","Hẹn về"],(C.D.po||[]).map(p=>`<tr><td>${esc(p.no)}</td><td>${esc(p.supplier||"")}</td><td>${esc(p.items||"")}</td><td>${p.expected_date?tqxDd(p.expected_date):"chưa hẹn"}</td></tr>`))}
  openDrawerHTML(`<h2>${T}</h2><p class="hint">Bấm một mã để xem từng phiếu làm nên số tồn.${go?` <a href="#" class="lnk" id="tqd-go">Mở ${gl} ›</a>`:""}</p>${H}`);
  document.querySelectorAll("#drawer [data-tqc]").forEach(tr=>tr.onclick=()=>{if(typeof khoNxtDetail==="function")khoNxtDetail(tr.dataset.tqc)});
  const g=document.getElementById("tqd-go");if(g)g.onclick=e=>{e.preventDefault();closeDrawer();tqxGo(go)};
}
{const w=typeof sxInit==="function"?sxInit(pSxTqx):pSxTqx;PAGES.sx_tq=w;PAGES.sx=w}
addEventListener("resize",()=>{if(PAGE==="sx_tq"&&TQX.d){const a=$("#tq-sales"),n=$("#tq-nvl");if(a||n){const C=tqxCalc();if(a)tqxSales(a,C);if(n)tqxNvl(n,C)}}});
