/* =====================================================================
   TỔNG QUAN CÔNG TY (trang quản trị) — bố cục gọn chị Hoa duyệt 29/10/2026 (bản xem thử demo-tong-quan-cong-ty.html bản 4).
   Một trang, đọc từ trên xuống: Sức khỏe công ty (6 ô) → 4 khối (Kênh bán lẻ, Kênh phân phối, Content & Media, Sản xuất & kho)
   → Việc chờ chị (gom theo loại, bấm để xổ) → Cảnh báo & đề xuất.
   Bỏ: tab Lãi theo kênh, Tháng chốt (đã có ở P&L), hàng 6 ô thứ hai, khung kế hoạch trống, Hoạt động mới nhất.
   Tab Giá thành & cảnh báo, Tiền & cảnh báo, Thiết lập vẫn mở được bằng nút ở đầu trang (giữ nguyên nội dung cũ).
   CHỈ ĐỌC, không tự tính số mới: lãi lỗ lấy plMonth / plcTot (cùng nguồn P&L công ty), tiền và ngân sách lấy skTiles (suckhoe.js),
   việc chờ lấy vcItems (vieccho.js), tái mua lấy kpCalc (kenhpp.js), công nợ lấy kpDebt, kho lấy execStock / SX / mhNeedBuy.
   Trang cũ vẫn chạy trước (để các phần tải dữ liệu của nó chạy như cũ), rồi trang này vẽ đè lên.
   ===================================================================== */
const TQ2={open:{}};
/* Bỏ tab Lãi theo kênh, Tháng chốt khỏi thanh tab của các tab cũ còn giữ; tab đầu đổi tên thành Tổng quan. */
try{for(let i=TQ_TABS.length-1;i>=0;i--){if(TQ_TABS[i][0]==="kenh"||TQ_TABS[i][0]==="thang")TQ_TABS.splice(i,1);else if(TQ_TABS[i][0]==="homnay")TQ_TABS[i]=["homnay","‹ Tổng quan"]}}catch(e){}
const tq2P=v=>(Math.round(v*1000)/10).toLocaleString("vi-VN");
const tq2Strip=s=>String(s==null?"":s).replace(/<[^>]+>/g,"");
const tq2Go=(pg,sub)=>{if(sub){SUB.exec=sub;PAGE="exec"}else PAGE=pg;try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}renderMain();scrollTo(0,0)};
/* Số của tháng đang xem (theo ô thời gian trên cùng), cùng nguồn với P&L công ty. */
function tq2Nums(){const ym=plYmNow(),A=plMonth(ym),PA=plMonth(plYmAdd(ym,-1)),T=plcTot(A,""),P=plcTot(PA,"");
  const ch=ks=>{const cs=ks.map(k=>A.cols[k]).filter(Boolean),s=f=>cs.reduce((a,c)=>a+(c[f]||0),0);if(!cs.length)return null;
    return {dt:s("dt"),cp:cs.reduce((a,c)=>a+(c.gv||0)+(c.phi||0)+(c.ads||0)+(c.cpk||0)+(c.luong||0),0),lai:cs.filter(c=>c.lai!=null).reduce((a,c)=>a+c.lai,0),ads:s("ads"),don:s("don"),thieu:ks.filter(k=>!A.cols[k])}};
  return {ym,A,PA,T,P,le:ch(["tts","fb","spe"]),pp:ch(["b2b"])}}
function tq2Health(N){const T=N.T,P=N.P,ng=dhGet().nguong||{},out=[],add=(go,l,v,sub,st,sv)=>out.push({go,sv,l,v,sub,st});
  let SK=[];try{SK=typeof skTiles==="function"?skTiles():[]}catch(e){}const sk=l=>SK.find(x=>x.l===l);
  if(!T){add("pl","Doanh thu thực","—","đang tải","gry");return out}
  const KH=mtGet(N.ym);add("pl","Doanh thu thực",tr(T.dt),KH&&KH.tong?"đạt "+Math.round(T.dt/KH.tong*100)+"% kế hoạch ("+tr(KH.tong)+")":"chưa đặt kế hoạch tháng",KH&&KH.tong?(T.dt/KH.tong>=.95?"grn":T.dt/KH.tong>=.8?"amb":"red"):"gry");
  const parts=[["quảng cáo",T.ads],["giá vốn",T.gv],["phí sàn, ship",T.phi],["chi phí chung",T.chung||0]].sort((a,b)=>b[1]-a[1]);
  add("pl","Tổng chi phí",T.cp==null?"—":tr(T.cp),T.cp==null?"chưa có chi phí chung":tq2P(T.cp/T.dt)+"% doanh thu · "+parts[0][0]+" "+tr(parts[0][1])+" là khoản lớn nhất",T.cp==null?"gry":"amb");
  const m=T.dt?T.lai/T.dt:0;add("pl","Lãi đóng góp",tr(T.lai),tq2P(m)+"% doanh thu · trước chi phí chung",m<.1?"red":m<.2?"amb":"grn");
  if(T.ln==null)add("pl","Lợi nhuận ròng","—","chưa có chi phí chung tháng này","gry");
  else{const thieu=[];if(!T.luong)thieu.push("chưa trừ lương");thieu.push("chưa trừ thuế");const it=P&&P.chung&&T.chung!=null&&T.chung<P.chung*.3;
    add("pl","Lợi nhuận ròng",tr(T.ln),tq2P(T.ln/T.dt)+"% · "+thieu.join(", ")+(it?" · chi chung mới ghi "+tr(T.chung):""),T.ln<0?"red":(!T.luong||it)?"amb":"grn")}
  const t=sk("Tiền đủ dùng");add(t?t.go:"tien_lich","Tiền đủ dùng",t?t.v:"—",t?t.sub:"chưa nhập số dư tài khoản",t?t.st:"gry");
  const b=sk("Chi phí / ngân sách");add(b?b.go:"ngan_sach","Chi phí / ngân sách",b?b.v:"—",b?b.sub:"chưa đặt ngân sách tháng này",b?b.st:"gry");
  return out}
/* Việc chờ: gom theo loại. Cảnh báo kinh doanh (tag "Cảnh báo") chuyển xuống khung Cảnh báo & đề xuất. */
function tq2Viec(){if(typeof vcItems!=="function"||!mhManage())return null;if(!(MH.orders&&MH.inv&&MH.pay&&MH.sup))return {loading:true};
  const L=vcItems(),G=[],by={},cb=[];
  L.forEach(x=>{if(x.tag[0]==="Cảnh báo"){cb.push(x);return}const k=x.tag[0];if(!by[k]){by[k]={k,c:x.tag[1],items:[],team:!!x.team};G.push(by[k])}by[k].items.push(x)});
  G.forEach(g=>{g.over=Math.max(0,...g.items.map(x=>x.over||0));g.leo=g.items.filter(x=>x.leo).length;
    const names={};g.items.forEach(x=>{const n=tq2Strip(x.t).replace(/^Ghi chứng từ của /,"").replace(/^Trả tiền cho /,"");names[n]=(names[n]||0)+1});
    const nl=Object.entries(names).map(([n,c])=>c>1?`${n} (${c})`:n);g.sub=nl.slice(0,4).join(" · ")+(nl.length>4?" · …":"");
    const n=g.items.length;g.title=g.k==="Chờ chứng từ"?`${n} phiếu mua đã nhập kho, chưa có chứng từ`:g.k==="Quá hạn"?`${n} việc của team trễ hạn`:g.k==="Âm kho"?`${n} mã thành phẩm âm kho`:n===1?tq2Strip(g.items[0].t):`${n} việc · ${g.k.toLowerCase()}`;
    if(n===1)g.sub=tq2Strip(g.items[0].s)});
  G.sort((a,b)=>(b.leo>0)-(a.leo>0)||(b.c==="red")-(a.c==="red")||b.over-a.over);
  return {G,cb,n:L.length-cb.length,leo:L.filter(x=>x.leo&&x.tag[0]!=="Cảnh báo").length,qh:L.filter(x=>x.over>0&&x.tag[0]!=="Cảnh báo").length}}
/* Cảnh báo & đề xuất: mỗi cảnh báo kèm một việc nên làm, theo ngưỡng ở Ngưỡng cảnh báo & chỉ số. */
function tq2Warn(N,V,D2,C,stk,HL){const W=[],ng=dhGet().nguong||{},qc=ng.qcMax||.4,T=N.T,P=N.P,nx=plYmAdd(N.ym,1).slice(5,7);
  PLC_K.forEach(([k,n])=>{const c=N.A.cols[k];if(!c||!c.dt||!(c.ads/c.dt>qc))return;
    W.push(["red",`Quảng cáo ${n} ăn ${Math.round(c.ads/c.dt*100)}% doanh thu`,`Chi ${tr(c.ads)}, doanh thu thực ${tr(c.dt)}, kênh còn lãi ${c.lai==null?"—":tq2P(c.lai/c.dt)+"%"}.`,`Đề xuất: đặt trần quảng cáo ${n} ≤ ${Math.round(qc*100)}% doanh thu, xem và tắt các combo, sản phẩm đang lỗ ở trang kênh.`,()=>tq2Go((N.A.by[k]||{}).go||"pl")])});
  if(D2&&D2.debt){const late=D2.b90p+D2.old,nk=D2.rows.filter(r=>(+r.b90p||0)+(+r.old||0)>0);
    if(late>0)W.push(["red",`${tr(late)} nợ quá 90 ngày (${nk.length} khách)`,`Chiếm ${Math.round(late/D2.debt*100)}% công nợ Kênh phân phối${nk.length?", nhiều nhất "+nk.sort((a,b)=>(b.b90p+b.old)-(a.b90p+a.old)).slice(0,2).map(r=>r.customer_name).join(", "):""}.`,"Đề xuất: giao sale lịch đòi từng khách tuần này, tạm dừng giao hàng công nợ cho khách quá 90 ngày.",()=>tq2Go("phai_thu")])}
  if(T&&T.ln!=null){const it=P&&P.chung&&T.chung!=null&&T.chung<P.chung*.3;
    if(!T.luong||it)W.push(["amb","Lợi nhuận tháng này đang cao hơn thật",[!T.luong?"Chưa có bảng lương chốt":"",it?`chi phí chung mới ghi ${tr(T.chung)} (tháng trước ${tr(P.chung)})`:""].filter(Boolean).join(" · ")+".",`Đề xuất: nhắc kế toán ghi đủ Sổ chi phí, chốt lương trước ngày 10/${nx} để chốt sổ.`,()=>tq2Go("so_cp")])}
  if(C&&(C.dang>=10||C.late>0))W.push(["amb",`${C.dang} video làm xong chưa đăng, mới đăng ${C.xong}${C.muc?"/"+C.muc:""}`,`${C.late} thẻ trễ hạn, ${C.cg} thẻ chưa giao người.`,"Đề xuất: giao người giữ kênh đăng hết video tồn trong tuần, Lead Content & Media giao các thẻ còn lại.",()=>tq2Go("bang_video")]);
  const ct=V&&V.G?V.G.find(g=>g.k==="Chờ chứng từ"):null;
  if(ct)W.push(["amb",`${ct.items.length} phiếu mua chưa có chứng từ${ct.over?", lâu nhất "+ct.over+" ngày":""}`,"Hàng đã nhập kho, chưa có hóa đơn: "+ct.sub+".","Đề xuất: chưa duyệt trả tiền phiếu chưa đủ chứng từ, giao người đòi hóa đơn nhà cung cấp.",()=>ct.items[0].go()]);
  const am=(stk||[]).filter(r=>r.st[1]==="red");
  if(am.length)W.push(["amb",`${am.length} mã âm kho`,am.slice(0,3).map(r=>r.ten).join(", ")+(am.length>3?"…":"")+".","Đề xuất: kế toán kho kiểm lại phiếu xuất, nhập bù hoặc điều chỉnh tồn.",()=>tq2Go("sx_kho")]);
  const ti=(HL||[]).find(x=>x.l==="Tiền đủ dùng");
  if(ti&&ti.st==="gry")W.push(["blu","Chưa biết tiền đủ dùng bao lâu","Chưa nhập số dư tài khoản ngân hàng, tiền mặt.","Đề xuất: kế toán nhập số dư ở Dòng tiền mỗi tuần.",()=>tq2Go("tien_lich")]);
  (V&&V.cb||[]).filter(x=>!/quảng cáo/i.test(tq2Strip(x.t))).forEach(x=>W.push(["blu",tq2Strip(x.t),tq2Strip(x.s).replace(/ · —$/,""),"",()=>x.go()]));
  return W.sort((a,b)=>["red","amb","blu"].indexOf(a[0])-["red","amb","blu"].indexOf(b[0]))}
function tq2Page(m){
  const N=tq2Nums(),T=N.T,vn=N.ym.slice(5,7)+"/"+N.ym.slice(0,4);
  /* Đơn Kênh phân phối (tái mua): tải một lần cho kỳ đang xem, xong thì vẽ lại một lần (kpLoad chỉ tự vẽ lại trang bc_b2b). */
  try{const k=PERIOD.from+"|"+PERIOD.to;if(typeof kpLoad==="function"&&TQ2.kp!==k&&!(KP.key===k&&(KP.d||KP.err))){TQ2.kp=k;kpLoad().then(()=>{if(PAGE==="exec")renderMain()})}}catch(e){}
  let K=null,D2=null;try{if(typeof KP!=="undefined"&&KP.d)K=kpCalc(KP.d)}catch(e){}try{D2=typeof kpDebt==="function"?kpDebt():null}catch(e){}
  const d=D(),cards=(d.cards||[]),cnt=st=>cards.filter(c=>st.includes(c.step)).length,muc=+((d.kpiTargets||{}).videoTT)||0;
  const C={xong:cnt(["xong"]),dang:cnt(["dang"]),lam:cnt(["kb","dkb","quay","edit","worker","dvd","dceo"]),cg:cnt(["cg"]),late:cards.filter(c=>{try{return isLate(c)}catch(e){return false}}).length,muc,gmv:cards.filter(c=>c.step==="xong").reduce((a,c)=>a+(+c.gmv||0),0)};
  let stk=[],sx=null,need=[];try{stk=typeof execStock==="function"?execStock()||[]:[]}catch(e){}try{sx=typeof SX==="function"?SX():null}catch(e){}try{need=typeof mhNeedBuy==="function"?mhNeedBuy():[]}catch(e){}
  const V=tq2Viec(),HL=tq2Health(N),W=tq2Warn(N,V,D2,C,stk,HL);
  const chot=N.ym<plYmAdd(iso(new Date()).slice(0,7),-1)||(N.ym===plYmAdd(iso(new Date()).slice(0,7),-1)&&+iso(new Date()).slice(8,10)>=10);
  const pc=(a,b)=>a==null||!b?"—":(Math.round(a/b*1000)/10).toLocaleString("vi-VN")+"%";
  const kv=(l,v,cl)=>`<div class="tq2-kv"><span>${l}</span><b class="${cl||""}">${v}</b></div>`,mu=s=>` <span class="hint">· ${s}</span>`;
  const note=(c,t)=>`<div class="tq2-note"><i class="tq2-dot ${c}"></i>${t}</div>`;
  /* Kênh bán lẻ */
  const le=N.le,qc=(dhGet().nguong||{}).qcMax||.4;
  const worst=PLC_K.filter(([k])=>["tts","fb","spe"].includes(k)&&N.A.cols[k]&&N.A.cols[k].dt).map(([k,n])=>({n,c:N.A.cols[k]})).sort((a,b)=>b.c.ads/b.c.dt-a.c.ads/a.c.dt)[0];
  const bLe=!le?`<p class="hint">Chưa có số.</p>`:kv("Doanh thu thực",tr(le.dt))+kv("Tổng chi phí",tr(le.cp)+mu(pc(le.cp,le.dt)))+kv("Lãi đóng góp",tr(le.lai)+mu(pc(le.lai,le.dt)))+kv("Quảng cáo · ROAS chung",tr(le.ads)+" · "+(le.ads?(le.dt/le.ads).toFixed(2).replace(".",","):"—"),le.dt&&le.ads/le.dt>qc?"t-red":"")+kv("Đơn hàng",nf(le.don))
    +(le.thieu.length?note("amb","Chưa có số "+le.thieu.map(k=>(PLC_K.find(x=>x[0]===k)||[])[1]).join(", ")):worst&&worst.c.ads/worst.c.dt>qc?note("red",`Quảng cáo ${worst.n} ${Math.round(worst.c.ads/worst.c.dt*100)}% doanh thu, kênh lãi ${pc(worst.c.lai,worst.c.dt)}`):note("grn","Quảng cáo các sàn trong ngưỡng"));
  /* Kênh phân phối */
  const pp=N.pp,reP=K&&K.buyers.length?K.re.length/K.buyers.length:null,preP=K&&K.pBuyers.length?K.pRe.length/K.pBuyers.length:null;
  const bPp=(!pp?kv("Doanh thu thực","—"):kv("Doanh thu thực",tr(pp.dt))+kv("Tổng chi phí",tr(pp.cp)+mu(pc(pp.cp,pp.dt)))+kv("Lãi đóng góp",tr(pp.lai)+mu(pc(pp.lai,pp.dt))))
    +kv("Khách tái mua",K?`${K.re.length}/${K.buyers.length} khách · ${reP==null?"—":Math.round(reP*100)+"%"}`:`<span class="hint">đang tải</span>`)
    +kv("Công nợ · quá 90 ngày",D2?tr(D2.debt)+" · "+tr(D2.b90p+D2.old):`<span class="hint">đang tải</span>`,D2&&D2.b90p+D2.old>0?"t-red":"")
    +(K&&preP!=null?note(reP>=preP?"grn":"amb",`Tái mua tháng trước ${K.pRe.length}/${K.pBuyers.length} khách (${Math.round(preP*100)}%) · ${K.moi.length} khách mới`):"");
  /* Content & Media */
  const bCt=kv("Video đã đăng",nf(C.xong)+(C.muc?` <span class="hint">/ ${nf(C.muc)} mục tiêu</span>`:""))+kv("Chờ đăng",nf(C.dang))+kv("Đang làm (kịch bản, quay, dựng)",nf(C.lam))+kv("Chưa giao người",nf(C.cg),C.cg?"t-amb":"")+kv("Doanh số từ video",C.gmv?tr(C.gmv):`<span class="hint">chưa có số</span>`)
    +(C.late||C.dang?note(C.late?"red":"amb",`${nf(C.late)} thẻ video trễ hạn · ${nf(C.dang)} video làm xong chưa đăng`):note("grn","Không có thẻ trễ"));
  /* Sản xuất & kho */
  const amb=stk.filter(r=>r.st[1]==="amb"||r.st[1]==="red"),r0=stk.find(x=>x.st[1]==="red")||stk.find(x=>x.st[1]==="amb");
  const bKho=kv("Đang sản xuất",sx?nf(sx.requests.filter(r=>r.st==="DANG_LAM").length)+" phiếu":"—")+kv("Lô chờ kiểm",sx?nf(sx.batches.filter(b=>b.st==="CHO_KIEM").length):"—")+kv("Sắp hết / âm kho",nf(amb.length)+" mã",stk.some(r=>r.st[1]==="red")?"t-red":"")+kv("Vật tư dưới tồn tối thiểu",nf(need.length)+" mã",need.length?"t-amb":"")
    +(r0?note(r0.st[1]==="red"?"red":"amb",`${esc(r0.ten)}: ${esc(r0.st[0].toLowerCase())}`):note("grn","Không có mã sắp hết"));
  const blk=(t,go,body)=>`<section class="card tq2-blk"><div class="tq2-ch"><h2>${t}</h2><a data-tq2go="${go}">Chi tiết ›</a></div>${body}</section>`;
  /* Việc chờ */
  const vc=!V?"":V.loading?`<section class="card"><div class="tq2-ch"><h2>Việc chờ chị</h2></div><p class="hint">Đang tải…</p></section>`:`<section class="card tq2-vc"><div class="tq2-ch"><h2>Việc chờ chị</h2><span class="hint">${V.leo?`<span class="tq2-leo">${V.leo} cần chị quyết</span> `:""}${V.n} việc${V.qh?" · "+V.qh+" quá hạn":""} · gom theo loại, bấm ▸ để xem từng việc</span></div>${V.G.length?V.G.map((g,gi)=>{const op=!!TQ2.open[g.k];
      return `<div class="tq2-g${op?" open":""}" data-tq2g="${esc(g.k)}"><div class="tq2-gs"><span class="tq2-ar">▶</span><span class="pill p-${g.c==="red"?"red":g.c==="amb"?"amb":"blu"}">${esc(g.k)}</span><span class="tq2-gt"><b>${esc(g.title)}</b><small>${esc(g.sub)}${!g.team&&typeof vcWho==="function"?" · "+tq2Strip(vcWho(g.items[0])).replace("Người làm: ","người làm: "):""}</small></span><span class="tq2-over">${g.over&&!g.team?"quá hạn lâu nhất "+g.over+" ngày":""}</span><span class="tq2-btns">${g.team?"":`<button type="button" class="btn sm" data-tq2give="${gi}">Giao việc</button>`}<button type="button" class="btn sm pri" data-tq2open="${gi}|0">Mở</button></span></div>
        <div class="tq2-gl" ${op?"":"hidden"}><table>${g.items.map((x,i)=>`<tr><td>${x.t}</td><td class="hint">${x.s}</td><td class="n">${x.han?"hạn "+esc(mhDM(x.han)):""}</td><td class="n">${x.over>0?`<b class="t-red">quá ${x.over} ngày</b>`:""}</td><td class="n"><button type="button" class="btn sm" data-tq2open="${gi}|${i}">${esc(x.btn||"Mở")}</button></td></tr>`).join("")}</table></div></div>`}).join(""):`<p class="hint">Không có việc nào.</p>`}</section>`;
  const warn=`<section class="card"><div class="tq2-ch"><h2>Cảnh báo & đề xuất</h2><span class="hint">xếp theo mức ảnh hưởng tới tiền và lãi · bấm để mở trang liên quan</span></div>${W.length?`<div class="tq2-wa">${W.map(([c,b,s,de],i)=>`<div class="tq2-w ${c}" data-tq2w="${i}"><b>${esc(b)}</b><span>${esc(s)}</span>${de?`<i>${esc(de)}</i>`:""}</div>`).join("")}</div>`:`<p class="hint">Không có cảnh báo.</p>`}</section>`;
  const html=`<div class="tq2"><div class="tq2-head"><h1>Tổng quan công ty</h1><span class="tq2-tag ${chot?"ok":""}">Tháng ${vn} · ${chot?"đã chốt":"dự kiến · chốt ngày 10/"+plYmAdd(N.ym,1).slice(5,7)}</span>
     <div class="tq2-links"><button type="button" class="btn sm" data-tq2go="pl">Lãi lỗ P&L ›</button><button type="button" class="btn sm" data-tq2go="tien_lich">Dòng tiền ›</button><button type="button" class="btn sm" data-tq2sub="gia">Giá thành & cảnh báo ›</button><button type="button" class="btn sm" data-tq2sub="caidat">Thiết lập ›</button></div></div>
    <section class="card"><div class="tq2-ch"><h2>Sức khỏe công ty</h2><span class="hint">xanh: ổn · vàng: cần để ý · đỏ: cần xử lý · xám: chưa có số · bấm ô để xem chi tiết</span></div>
     <div class="tq2-sk">${HL.map((x,i)=>`<button type="button" class="tq2-skt s-${x.st}" data-tq2h="${i}"><span>${esc(x.l)}</span><b>${esc(x.v)}</b><small>${esc(x.sub)}</small></button>`).join("")}</div></section>
    <div class="tq2-blks">${blk("Kênh bán lẻ","bc_tong",bLe)}${blk("Kênh phân phối","bc_b2b",bPp)}${blk("Content & Media","bang_video",bCt)}${blk("Sản xuất & kho","sx_tq",bKho)}</div>
    ${vc}${warn}</div>`;
  m.innerHTML=html;
  m.querySelectorAll("[data-tq2go]").forEach(b=>b.onclick=()=>tq2Go(b.dataset.tq2go));
  m.querySelectorAll("[data-tq2sub]").forEach(b=>b.onclick=()=>tq2Go("exec",b.dataset.tq2sub));
  m.querySelectorAll("[data-tq2h]").forEach(b=>b.onclick=()=>tq2Go(HL[+b.dataset.tq2h].go));
  m.querySelectorAll("[data-tq2w]").forEach(b=>b.onclick=()=>{try{W[+b.dataset.tq2w][4]()}catch(e){}});
  if(V&&V.G){m.querySelectorAll(".tq2-gs").forEach(s=>s.onclick=e=>{if(e.target.closest("button"))return;const g=s.parentElement,k=g.dataset.tq2g,on=!TQ2.open[k];TQ2.open[k]=on;g.classList.toggle("open",on);g.querySelector(".tq2-gl").hidden=!on});
    m.querySelectorAll("[data-tq2open]").forEach(b=>b.onclick=()=>{const [gi,i]=b.dataset.tq2open.split("|").map(Number);try{V.G[gi].items[i].go()}catch(e){}});
    m.querySelectorAll("[data-tq2give]").forEach(b=>b.onclick=()=>{try{vcGive(V.G[+b.dataset.tq2give].items[0])}catch(e){}})}
}
{const _ex=PAGES.exec;PAGES.exec=function(m){
  const on=typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin"&&typeof dhOk==="function"&&dhOk();
  if(on&&["kenh","thang"].includes(SUB.exec))SUB.exec="homnay";
  const r=_ex.apply(this,arguments);
  if(on&&(SUB.exec||"homnay")==="homnay"){try{tq2Page(m)}catch(e){console.error("Tổng quan mới lỗi, giữ trang cũ:",e)}}
  return r}}
(function(){if(typeof document==="undefined"||document.getElementById("tq2-css"))return;const s=document.createElement("style");s.id="tq2-css";s.textContent=`
.tq2{font-size:12.5px}.tq2 .hint{font-size:11.5px}.tq2 .card{margin:0 0 10px;padding:10px 12px}
.tq2-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:2px 0 10px}.tq2-head h1{font-size:19px;font-weight:800;margin:0;color:#1d3266}
.tq2-tag{font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;background:#fff3df;color:#c2810f}.tq2-tag.ok{background:#e2f5ec;color:#17915f}
.tq2-links{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
.tq2-ch{display:flex;align-items:baseline;gap:8px;margin-bottom:8px}.tq2-ch h2{font-size:13.5px;font-weight:700;margin:0}.tq2-ch>.hint{margin-left:auto}.tq2-ch a{color:#3b6fd8;cursor:pointer;font-size:12px;font-weight:600}
.tq2-sk{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
.tq2-skt{display:flex;flex-direction:column;align-items:flex-start;text-align:left;font:inherit;color:inherit;background:#fff;border:1px solid #e5e9f0;border-left:4px solid #c9cfdb;border-radius:8px;padding:8px 10px;cursor:pointer}
.tq2-skt>span{font-size:12px;font-weight:600}.tq2-skt b{font-size:18px;font-weight:800;margin:3px 0 1px}.tq2-skt small{font-size:11.5px;color:#6b7590}
.tq2-skt.s-grn{border-left-color:#17915f}.tq2-skt.s-amb{border-left-color:#c2810f}.tq2-skt.s-red{border-left-color:#d63c3c;background:#fffafa}.tq2-skt.s-red b{color:#d63c3c}
.tq2-blks{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px}.tq2-blks .card{margin:0}.tq2-blk .tq2-ch a{margin-left:4px}
.tq2-kv{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px dashed #eef1f6}.tq2-kv b{font-weight:700;text-align:right}
.tq2-note{margin-top:6px;font-size:11.5px;display:flex;gap:5px;align-items:flex-start;color:#4b5570}.tq2-dot{width:7px;height:7px;border-radius:50%;margin-top:5px;flex:none;background:#b7bfcf}.tq2-dot.red{background:#d63c3c}.tq2-dot.amb{background:#e0a020}.tq2-dot.grn{background:#17915f}
.tq2-leo{font-size:11px;font-weight:700;color:#fff;background:#d63c3c;border-radius:10px;padding:2px 8px}
.tq2-g{border-top:1px solid #e5e9f0}.tq2-g:first-of-type{border-top:0}
.tq2-gs{display:grid;grid-template-columns:16px 110px 1fr auto auto;gap:10px;align-items:center;padding:7px 4px;cursor:pointer}.tq2-gs:hover{background:#f7f9fd}
.tq2-ar{color:#6b7590;font-size:9px;transition:transform .15s}.tq2-g.open .tq2-ar{transform:rotate(90deg)}
.tq2-gs .pill{text-align:center}.tq2-gt b{font-weight:700}.tq2-gt small{display:block;color:#6b7590;font-size:11.5px}
.tq2-over{color:#d63c3c;font-weight:700;white-space:nowrap;font-size:12px}.tq2-btns{display:flex;gap:5px}
.tq2-gl table{width:calc(100% - 26px);margin:0 0 8px 26px;border-collapse:collapse}.tq2-gl td{padding:4px 6px;border-bottom:1px solid #f0f2f6;font-size:12px}.tq2-gl td.n{text-align:right;white-space:nowrap}
.tq2-wa{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.tq2-w{border:1px solid;border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:3px;cursor:pointer}.tq2-w b{font-size:12.5px}.tq2-w span{font-size:11.5px;color:#56607a}.tq2-w i{font-style:normal;font-size:12px;font-weight:600;margin-top:2px}
.tq2-w.red{background:#fff4f4;border-color:#f6caca}.tq2-w.red b,.tq2-w.red i{color:#d63c3c}.tq2-w.amb{background:#fff9ec;border-color:#f3dcab}.tq2-w.amb b,.tq2-w.amb i{color:#9a6508}.tq2-w.blu{background:#f2f6fe;border-color:#cfdbf7}.tq2-w.blu b,.tq2-w.blu i{color:#3b6fd8}
@media(max-width:1100px){.tq2-sk{grid-template-columns:repeat(3,1fr)}.tq2-blks{grid-template-columns:repeat(2,1fr)}.tq2-wa{grid-template-columns:1fr 1fr}}
@media(max-width:640px){.tq2-sk,.tq2-blks{grid-template-columns:1fr 1fr}.tq2-wa{grid-template-columns:1fr}.tq2-gs{grid-template-columns:14px 1fr}.tq2-gs .pill,.tq2-over,.tq2-btns{grid-column:2}}
`;document.head.appendChild(s)})();
