/* =====================================================================
   NGHỈ PHÉP & TĂNG CA, TẠM ỨNG LƯƠNG, PHIẾU LƯƠNG CỦA TÔI (chị Hoa duyệt demo 04/11/2026)
   - Nhân viên (Của tôi): gửi đơn nghỉ phép / ốm / không lương / xin về sớm, đến muộn / tăng ca; đề nghị tạm ứng; xem phiếu lương của mình.
   - Lead (Nhân sự › Nhóm của tôi): duyệt đơn phòng mình. Nghỉ từ 3 ngày (ô điền) Lead duyệt xong chuyển HCNS duyệt vòng 2.
   - HCNS, CEO (Nhân sự › Nghỉ phép & tạm ứng): mọi đơn, duyệt vòng 2, quỹ phép. Kế toán, CEO: duyệt tạm ứng (dưới mức tối đa, ô điền).
   - Đơn đã duyệt tự vào chấm công (chuyên cần, giờ tăng ca); tạm ứng đã duyệt tự vào bảng lương (dòng Tạm ứng).
   - Máy chủ: /api/hub/nghiphep (src/server/routes/nghiPhep.ts). Chữ trên màn hình theo vai trò, không xưng chị/em.
   ===================================================================== */
const NP={me:null,ql:null,tu:null,pl:null,cho:{lead:0,hcns:0,tu:0},vai:null,f:"",busy:false,tuInj:0};
const NP_PAGES=["np_toi","tu_toi","pl_toi","np_duyet","np_ql","tu_ql"];
const npOn=()=>typeof PAGE!=="undefined"&&NP_PAGES.includes(PAGE);
const npRedraw=()=>{if(npOn())renderMain()};
const npDm=d=>d?d.slice(8,10)+"/"+d.slice(5,7):"";
const npWhen=x=>npDm(x.tu)+(x.den&&x.den!==x.tu?" – "+npDm(x.den):"")+(x.buoi==="sang"?" · sáng":x.buoi==="chieu"?" · chiều":"");
const npTien=n=>Number(n||0).toLocaleString("vi-VN")+"đ";
const npNghi=l=>["phep","om","khongluong"].includes(l);
const npSL=x=>npNghi(x.loai)?String(x.so_ngay).replace(".",",")+" ngày":x.loai==="ot"?String(x.gio||0).replace(".",",")+" giờ":(x.ghi_chu||"");
const npSt=x=>x.st==="lead"?pill("Chờ Lead duyệt","amb"):x.st==="hcns"?(x.lead_id?pill("Lead đã duyệt","grn")+" ":"")+pill("Chờ HCNS duyệt","amb"):x.st==="xong"?pill("Đã duyệt","grn"):x.st==="huy"?pill("Đã rút","gry"):pill("Từ chối","red");
const npTuSt=x=>x.st==="kt"?pill("Chờ Kế toán duyệt","amb"):x.st==="xong"?pill("Đã duyệt","grn"):x.st==="huy"?pill("Đã rút","gry"):pill("Từ chối","red");
const npErr=(m,t,e)=>{m.innerHTML=H(t)+`<section class="card"><p class="empty">${esc(e)}</p></section>`};
const npLoad=async(k,url,force)=>{if(!force&&NP[k]&&!NP[k].loading)return;NP[k]={loading:true};try{NP[k]=await svApi(url)}catch(e){NP[k]={err:e.message||"Không tải được"}}npRedraw()};
const npKetoan=()=>!!(typeof SV!=="undefined"&&SV.me&&(SV.me.role==="CEO"||(SV.perms||[]).includes("debt.read.all")));
async function npCho(){try{const r=await svApi("/api/hub/nghiphep/cho");const ch=JSON.stringify(r.vai)!==JSON.stringify(NP.vai);NP.cho=r;NP.vai=r.vai;if(ch&&typeof render==="function"&&typeof ME!=="undefined"&&ME)render()}catch(e){}}

/* ---------- Nhân viên: Nghỉ phép & tăng ca ---------- */
function pNpToi(m){
  const R=NP.me;if(!R||R.loading){m.innerHTML=H("Nghỉ phép & tăng ca")+`<section class="card"><p class="empty">Đang tải…</p></section>`;npLoad("me","/api/hub/nghiphep/me");return}
  if(R.err)return npErr(m,"Nghỉ phép & tăng ca",R.err);
  const P=R.phep,cho=R.don.filter(x=>x.st==="lead"||x.st==="hcns").length;
  m.innerHTML=H("Nghỉ phép & tăng ca")+`<div class="grid kpis">${kpi("Phép năm còn",String(P.con).replace(".",",")+" ngày",`được hưởng ${P.huong} · đã nghỉ ${String(P.daCu+P.daMoi).replace(".",",")}`)}${kpi("Đơn đang chờ duyệt",cho)}</div>
  <div class="grid cols2"><section class="card"><div class="card-h"><h2>Gửi đơn</h2></div>
    <form class="frm" id="np-f">
      <label class="field">Loại đơn<select id="np-l">${Object.entries(R.loai).map(([k,t])=>`<option value="${k}">${esc(t)}</option>`).join("")}</select></label>
      <div class="row4"><label class="field">Từ ngày<input type="date" id="np-tu" value="${R.today}"></label><label class="field" id="np-denw">Đến ngày<input type="date" id="np-den" value="${R.today}"></label>
      <label class="field" id="np-bw">Nghỉ<select id="np-b"><option value="ca">Cả ngày</option><option value="sang">Buổi sáng</option><option value="chieu">Buổi chiều</option></select></label>
      <label class="field" id="np-gw" hidden>Số giờ tăng ca<input type="number" id="np-g" min="0.5" max="16" step="0.5" value="2"></label>
      <label class="field" id="np-cw" hidden>Về lúc / đến lúc<input id="np-c" placeholder="Ví dụ: về lúc 16:30"></label></div>
      <label class="field">Lý do<input id="np-ly" required placeholder="Ghi ngắn gọn"></label>
      <p class="hint" id="np-h"></p>
      <button class="btn pri" id="np-go"${NP.busy?" disabled":""}>Gửi đơn</button>
    </form></section>
  <section class="card"><div class="card-h"><h2>Đơn đã gửi</h2></div>${R.don.length?R.don.map(x=>`<div class="np-item"><b>${esc(x.loaiTen)}</b><div class="hint">${npWhen(x)} · ${esc(npSL(x))}</div><div>${npSt(x)}</div>${x.tu_choi?`<div class="hint">Lý do từ chối: ${esc(x.tu_choi)}</div>`:""}${x.st==="lead"||x.st==="hcns"?`<div><button class="btn sm" data-huy="${x.id}">Rút đơn</button></div>`:""}</div>`).join(""):`<p class="empty">Chưa gửi đơn nào.</p>`}</section></div>`;
  const hint=()=>{const l=$("#np-l").value,tu=$("#np-tu").value,den=$("#np-den").value,n=Math.round((Date.parse(den)-Date.parse(tu))/864e5)+1;
    $("#np-denw").hidden=!npNghi(l);$("#np-bw").hidden=!npNghi(l);$("#np-gw").hidden=l!=="ot";$("#np-cw").hidden=l!=="vesom";
    $("#np-h").textContent=l==="ot"?"Lead duyệt. HCNS nhận thông báo khi đơn được duyệt.":l==="vesom"?"Lead duyệt. Được duyệt thì lần về sớm / đến muộn đó không tính vi phạm chuyên cần.":n>=R.quyTac.mocVong2?`Nghỉ từ ${R.quyTac.mocVong2} ngày: Lead duyệt, rồi HCNS duyệt vòng 2. Số ngày tính theo lịch làm (bỏ Chủ nhật, ngày nghỉ, lễ).`:"Nghỉ dưới "+R.quyTac.mocVong2+" ngày: Lead duyệt là xong."};
  ["#np-l","#np-tu","#np-den"].forEach(s=>$(s).onchange=hint);hint();
  $("#np-f").onsubmit=async e=>{e.preventDefault();if(NP.busy)return;const l=$("#np-l").value;NP.busy=true;
    try{const r=await svApi("/api/hub/nghiphep/don",{method:"POST",body:JSON.stringify({loai:l,tu:$("#np-tu").value,den:$("#np-den").value,buoi:$("#np-b").value,gio:Number($("#np-g").value),ghiChu:$("#np-c").value,lyDo:$("#np-ly").value})});
      toast(r.st==="lead"?"Đã gửi đơn. Lead của phòng nhận thông báo.":"Đã gửi đơn. HCNS nhận thông báo.");NP.busy=false;npLoad("me","/api/hub/nghiphep/me",true)}catch(err){NP.busy=false;toast(err.message)}};
  m.querySelectorAll("[data-huy]").forEach(b=>b.onclick=async()=>{try{await svApi("/api/hub/nghiphep/don/"+b.dataset.huy+"/huy",{method:"POST"});toast("Đã rút đơn");npLoad("me","/api/hub/nghiphep/me",true)}catch(e){toast(e.message)}});
}

/* ---------- Nhân viên: Tạm ứng lương ---------- */
function pTuToi(m){
  const R=NP.me;if(!R||R.loading){m.innerHTML=H("Tạm ứng lương")+`<section class="card"><p class="empty">Đang tải…</p></section>`;npLoad("me","/api/hub/nghiphep/me");return}
  if(R.err)return npErr(m,"Tạm ứng lương",R.err);
  const max=R.quyTac.tuMax;
  m.innerHTML=H("Tạm ứng lương")+`<div class="grid cols2"><section class="card"><div class="card-h"><h2>Đề nghị tạm ứng</h2></div>
    <form class="frm" id="tu-f"><label class="field">Số tiền (đồng)<input type="number" id="tu-t" min="0" step="100000" required></label>
    <label class="field">Lý do<input id="tu-ly" required></label>
    <p class="hint" id="tu-h">${max?`Mỗi lần dưới ${npTien(max)}. `:""}Kế toán duyệt; cuối tháng tự trừ vào lương.</p>
    <button class="btn pri" id="tu-go">Gửi đề nghị</button></form></section>
  <section class="card"><div class="card-h"><h2>Đề nghị đã gửi</h2></div>${R.tamung.length?R.tamung.map(x=>`<div class="np-item"><b>${npTien(x.so_tien)}</b><div class="hint">Gửi ${npDm(vndateIso(x.created_at))} · trừ lương tháng ${x.ky.slice(5)}/${x.ky.slice(0,4)} · ${esc(x.ly_do)}</div><div>${npTuSt(x)}</div>${x.tu_choi?`<div class="hint">Lý do từ chối: ${esc(x.tu_choi)}</div>`:""}${x.st==="kt"?`<div><button class="btn sm" data-tuhuy="${x.id}">Rút đề nghị</button></div>`:""}</div>`).join(""):`<p class="empty">Chưa có đề nghị nào.</p>`}</section></div>`;
  const chk=()=>{const v=Number($("#tu-t").value||0),bad=max&&v>=max;$("#tu-go").disabled=!!bad;$("#tu-h").innerHTML=bad?`<span style="color:var(--red);font-weight:600">Tạm thời chỉ cho ứng dưới ${npTien(max)} một lần.</span>`:`${max?`Mỗi lần dưới ${npTien(max)}. `:""}Kế toán duyệt; cuối tháng tự trừ vào lương.`};
  $("#tu-t").oninput=chk;
  $("#tu-f").onsubmit=async e=>{e.preventDefault();try{await svApi("/api/hub/nghiphep/tamung",{method:"POST",body:JSON.stringify({soTien:Number($("#tu-t").value),lyDo:$("#tu-ly").value})});toast("Đã gửi đề nghị tạm ứng. Kế toán nhận thông báo.");npLoad("me","/api/hub/nghiphep/me",true)}catch(err){toast(err.message)}};
  m.querySelectorAll("[data-tuhuy]").forEach(b=>b.onclick=async()=>{try{await svApi("/api/hub/nghiphep/tamung/"+b.dataset.tuhuy+"/huy",{method:"POST"});toast("Đã rút đề nghị");npLoad("me","/api/hub/nghiphep/me",true)}catch(e){toast(e.message)}});
}
const vndateIso=iso=>{const d=new Date(Date.parse(iso)+7*3600e3);return d.toISOString().slice(0,10)};

/* ---------- Nhân viên: Phiếu lương ---------- */
function pPlToi(m){
  const R=NP.pl;if(!R||R.loading){m.innerHTML=H("Phiếu lương")+`<section class="card"><p class="empty">Đang tải…</p></section>`;npLoad("pl","/api/hub/nghiphep/phieu-luong");return}
  if(R.err)return npErr(m,"Phiếu lương",R.err);
  if(!R.ma){m.innerHTML=H("Phiếu lương")+`<section class="card"><p class="empty">Tài khoản chưa gắn với hồ sơ nhân sự. Nhờ HCNS gắn ở Nhân sự › Nhân viên.</p></section>`;return}
  m.innerHTML=H("Phiếu lương")+`<section class="card"><div class="card-h"><h2>Các tháng</h2><span class="hint">chỉ hiện tháng HCNS đã phát</span></div>${R.list.length?tbl(["Tháng","Phát ngày","Thực nhận","",""],R.list.map(x=>`<tr><td><b>Tháng ${x.ky.slice(5)}/${x.ky.slice(0,4)}</b></td><td>${esc(x.ph)}</td><td class="n">${npTien(x.row.thucLinh)}</td><td>${x.xem?pill("Đã xem","gry"):pill("Mới","amb")}</td><td><button class="btn sm pri" data-pl="${x.ky}">Xem phiếu</button> <button class="btn sm" data-hoi="${x.ky}">Có thắc mắc</button></td></tr>`)):`<p class="empty">Chưa có phiếu lương nào được phát.</p>`}</section>
  <section class="card" id="pl-hoiw" hidden><div class="card-h"><h2 id="pl-hoit">Hỏi HCNS</h2></div><form class="frm" id="pl-hoif"><label class="field">Điều cần hỏi<input id="pl-hoin" required placeholder="Ví dụ: ngày công tháng này thiếu 1 ngày"></label><button class="btn pri">Gửi câu hỏi</button></form></section>`;
  m.querySelectorAll("[data-pl]").forEach(b=>b.onclick=()=>{const x=R.list.find(y=>y.ky===b.dataset.pl);if(typeof openPhieu==="function")openPhieu(x.row,x.ky,{st:"phathanh",ph:x.ph});if(!x.xem){x.xem=1;svApi("/api/hub/nghiphep/phieu-luong/"+x.ky+"/xem",{method:"POST"}).catch(()=>{})}});
  let ky="";m.querySelectorAll("[data-hoi]").forEach(b=>b.onclick=()=>{ky=b.dataset.hoi;$("#pl-hoiw").hidden=false;$("#pl-hoit").textContent=`Hỏi HCNS về phiếu lương tháng ${ky.slice(5)}/${ky.slice(0,4)}`;$("#pl-hoin").focus()});
  $("#pl-hoif").onsubmit=async e=>{e.preventDefault();try{await svApi("/api/hub/nghiphep/phieu-luong/"+ky+"/hoi",{method:"POST",body:JSON.stringify({noiDung:$("#pl-hoin").value})});toast("Đã gửi câu hỏi cho HCNS");$("#pl-hoiw").hidden=true}catch(err){toast(err.message)}};
}

/* ---------- Lead, HCNS: duyệt đơn ---------- */
async function npDuyet(id,okk,reload){
  let note="";if(!okk){const el=document.getElementById("np-n-"+id);note=el?el.value.trim():"";if(!note){if(el){el.hidden=false;el.focus()}toast("Ghi lý do từ chối rồi bấm Từ chối lần nữa");return}}
  try{const r=await svApi("/api/hub/nghiphep/don/"+id+"/duyet",{method:"POST",body:JSON.stringify({ok:okk,note})});toast(!okk?"Đã từ chối, người gửi nhận thông báo":r.st==="hcns"?"Đã duyệt. Đơn chuyển HCNS duyệt vòng 2.":"Đã duyệt, người gửi nhận thông báo");npCho();if(typeof CC!=="undefined"){CC.day=null;CC.mon=null}reload()}catch(e){toast(e.message)}
}
const npActs=x=>x.duyet?`<div class="btns" style="display:flex;gap:6px;flex-wrap:wrap"><input id="np-n-${x.id}" placeholder="Lý do từ chối" hidden style="flex:1;min-width:140px"><button class="btn sm" data-no="${x.id}">Từ chối</button><button class="btn sm pri" data-ok="${x.id}">${x.st==="hcns"&&x.lead_id?"Duyệt vòng 2":"Duyệt"}</button></div>`:"";
const npBind=(m,reload)=>{m.querySelectorAll("[data-ok]").forEach(b=>b.onclick=()=>npDuyet(b.dataset.ok,true,reload));m.querySelectorAll("[data-no]").forEach(b=>b.onclick=()=>npDuyet(b.dataset.no,false,reload))};
function pNpDuyet(m){
  const R=NP.ql;if(!R||R.loading){m.innerHTML=H("Duyệt nghỉ phép & tăng ca")+`<section class="card"><p class="empty">Đang tải…</p></section>`;npLoad("ql","/api/hub/nghiphep/duyet");return}
  if(R.err)return npErr(m,"Duyệt nghỉ phép & tăng ca",R.err);
  const cho=R.list.filter(x=>x.duyet),xong=R.list.filter(x=>!x.duyet).slice(0,40);
  const card=x=>`<div class="np-item"><b>${esc(x.ten)} · ${esc(x.loaiTen)}</b><div class="hint">${npWhen(x)} · ${esc(npSL(x))}</div><div class="hint">Lý do: ${esc(x.ly_do)}</div>${x.st==="lead"&&npNghi(x.loai)&&x.so_ngay>=R.mocVong2?`<div>${pill("Từ "+R.mocVong2+" ngày: sau khi duyệt chuyển HCNS","blu")}</div>`:""}${npActs(x)}</div>`;
  m.innerHTML=H("Duyệt nghỉ phép & tăng ca")+`<div class="grid cols2"><section class="card"><div class="card-h"><h2>Chờ duyệt</h2>${pill(String(cho.length),"amb")}</div><p class="hint">${R.vai.all?"Cả công ty":"Phòng "+esc(R.vai.pbTen)}</p>${cho.length?cho.map(card).join(""):`<p class="empty">Không còn đơn nào chờ duyệt.</p>`}</section>
  <section class="card"><div class="card-h"><h2>Đã xử lý gần đây</h2></div>${xong.length?xong.map(x=>`<div class="np-item"><b>${esc(x.ten)} · ${esc(x.loaiTen)}</b><div class="hint">${npWhen(x)} · ${esc(npSL(x))}</div><div>${npSt(x)}</div></div>`).join(""):`<p class="empty">Chưa có.</p>`}</section></div>`;
  npBind(m,()=>npLoad("ql","/api/hub/nghiphep/duyet",true));
}
function pNpQl(m){
  const R=NP.ql;if(!R||R.loading){m.innerHTML=H("Nghỉ phép & tăng ca")+`<section class="card"><p class="empty">Đang tải…</p></section>`;npLoad("ql","/api/hub/nghiphep/duyet");return}
  if(R.err)return npErr(m,"Nghỉ phép & tăng ca",R.err);
  const F=NP.f,L=R.list.filter(x=>!F||(F==="cho"?x.st==="lead"||x.st==="hcns":x.st===F));
  const nH=R.list.filter(x=>x.st==="hcns").length,nL=R.list.filter(x=>x.st==="lead").length,ot=R.list.filter(x=>x.loai==="ot"&&x.st==="xong").reduce((t,x)=>t+(x.gio||0),0);
  m.innerHTML=H("Nghỉ phép & tăng ca")+`<div class="grid kpis">${kpi("Chờ HCNS duyệt",nH)}${kpi("Đang chờ Lead",nL)}${kpi("Giờ tăng ca đã duyệt (2 tháng)",String(ot).replace(".",","))}</div>
  <div class="filters"><select id="np-ff"><option value="">Tất cả đơn</option><option value="cho"${F==="cho"?" selected":""}>Đang chờ duyệt</option><option value="hcns"${F==="hcns"?" selected":""}>Chờ HCNS</option><option value="xong"${F==="xong"?" selected":""}>Đã duyệt</option><option value="tuchoi"${F==="tuchoi"?" selected":""}>Từ chối</option></select><span class="sp"></span><button class="btn pri" data-npme="1">+ Gửi đơn của tôi</button><button class="btn" id="np-rl">Tải lại</button></div>
  <section class="card flush">${tbl(["Nhân viên","Loại","Ngày","Số lượng","Lý do","Trạng thái",""],L.map(x=>`<tr><td><b>${esc(x.ten)}</b><div class="hint">${esc(x.pbTen)}</div></td><td>${esc(x.loaiTen)}</td><td>${npWhen(x)}</td><td>${esc(npSL(x))}</td><td>${esc(x.ly_do)}</td><td>${npSt(x)}${x.leadTen?`<div class="hint">Lead: ${esc(x.leadTen)}</div>`:""}${x.tu_choi?`<div class="hint">${esc(x.tu_choi)}</div>`:""}</td><td>${npActs(x)}</td></tr>`))}</section>
  <section class="card"><div class="card-h"><h2>Quỹ phép năm ${new Date().getFullYear()}</h2><span class="hint">đã nghỉ = trước đây (hồ sơ) + đơn mới đã duyệt</span></div>${tbl(["Nhân viên","Phòng","Được hưởng","Đã nghỉ","Còn"],R.phep.filter(p=>p.ma).sort((a,b)=>a.con-b.con).map(p=>`<tr><td><b>${esc(p.ten)}</b><div class="hint">${esc(p.ma)}</div></td><td>${esc(p.pbTen)}</td><td class="n">${p.huong}</td><td class="n">${String(p.daCu+p.daMoi).replace(".",",")}</td><td class="n">${p.con<=1?pill(String(p.con).replace(".",","),"red"):String(p.con).replace(".",",")}</td></tr>`))}</section>
  <p class="hint">Đơn đã duyệt tự vào chấm công: nghỉ phép năm, nghỉ ốm không tính ngày nghỉ khi xét chuyên cần; xin về sớm / đến muộn không tính vi phạm; giờ tăng ca vào bảng chấm công tháng. Mốc duyệt vòng 2 sửa ở Cài đặt chấm công.</p>`;
  $("#np-ff").onchange=e=>{NP.f=e.target.value;renderMain()};$("#np-rl").onclick=()=>npLoad("ql","/api/hub/nghiphep/duyet",true);
  npBind(m,()=>npLoad("ql","/api/hub/nghiphep/duyet",true));
}

/* ---------- Kế toán, HCNS: tạm ứng ---------- */
function pTuQl(m){
  const R=NP.tu;if(!R||R.loading){m.innerHTML=H("Tạm ứng lương")+`<section class="card"><p class="empty">Đang tải…</p></section>`;npLoad("tu","/api/hub/nghiphep/tamung");return}
  if(R.err)return npErr(m,"Tạm ứng lương",R.err);
  const cho=R.list.filter(x=>x.st==="kt"),ky=new Date(Date.now()+7*3600e3).toISOString().slice(0,7),sum=R.list.filter(x=>x.st==="xong"&&x.ky===ky).reduce((t,x)=>t+x.so_tien,0);
  m.innerHTML=H("Tạm ứng lương")+`<div class="grid kpis">${kpi("Chờ duyệt",cho.length)}${kpi("Đã duyệt tháng này",npTien(sum))}${kpi("Mức tối đa mỗi lần",R.tuMax?"dưới "+npTien(R.tuMax):"không giới hạn")}</div>
  <section class="card flush">${tbl(["Nhân viên","Ngày gửi","Số tiền","Lý do","Trừ lương tháng","Trạng thái",""],R.list.map(x=>`<tr><td><b>${esc(x.ten)}</b><div class="hint">${esc(x.pbTen)}</div></td><td>${npDm(vndateIso(x.created_at))}</td><td class="n">${npTien(x.so_tien)}</td><td>${esc(x.ly_do)}</td><td>${x.ky.slice(5)}/${x.ky.slice(0,4)}</td><td>${npTuSt(x)}${x.ktTen?`<div class="hint">${esc(x.ktTen)}</div>`:""}${x.tu_choi?`<div class="hint">${esc(x.tu_choi)}</div>`:""}</td><td>${R.vai.duyet&&x.st==="kt"?`<div style="display:flex;gap:6px;flex-wrap:wrap"><input id="tu-n-${x.id}" placeholder="Lý do từ chối" hidden><button class="btn sm" data-tno="${x.id}">Từ chối</button><button class="btn sm pri" data-tok="${x.id}">Duyệt</button></div>`:""}</td></tr>`))}</section>
  <p class="hint">Duyệt xong khoản tạm ứng tự vào bảng lương tháng (dòng "Tạm ứng" trên phiếu lương). Mức tối đa sửa ở Nhân sự › Cài đặt chấm công.</p>`;
  const act=async(id,okk)=>{let note="";if(!okk){const el=$("#tu-n-"+id);note=el.value.trim();if(!note){el.hidden=false;el.focus();toast("Ghi lý do từ chối rồi bấm Từ chối lần nữa");return}}
    try{await svApi("/api/hub/nghiphep/tamung/"+id+"/duyet",{method:"POST",body:JSON.stringify({ok:okk,note})});toast(okk?"Đã duyệt, người đề nghị nhận thông báo":"Đã từ chối");NP.tuInj=0;npCho();npLoad("tu","/api/hub/nghiphep/tamung",true)}catch(e){toast(e.message)}};
  m.querySelectorAll("[data-tok]").forEach(b=>b.onclick=()=>act(b.dataset.tok,true));m.querySelectorAll("[data-tno]").forEach(b=>b.onclick=()=>act(b.dataset.tno,false));
}

/* Bảng lương: tạm ứng duyệt trên máy chủ đưa vào danh sách tạm ứng (HRD().tu) trước khi tính, để dòng "Tạm ứng" đúng. */
async function npTuInject(){
  if(typeof HRD!=="function"||!HRD()||!Array.isArray(HRD().tu)||Date.now()-NP.tuInj<60000)return false;NP.tuInj=Date.now();
  try{const r=await svApi("/api/hub/nghiphep/tamung");let n=0;(r.list||[]).filter(x=>x.st==="xong"&&x.ma).forEach(x=>{const id="sv:"+x.id;if(HRD().tu.some(t=>t.id===id))return;HRD().tu.push({id,ma:x.ma,ngay:vndateIso(x.created_at),tien:x.so_tien,lyDo:x.ly_do,tt:"duyet",ky:x.ky});n++});return n>0}catch(e){return false}
}
{const wrap=k=>{const o=PAGES[k];if(!o)return;PAGES[k]=m=>{o(m);npTuInject().then(ch=>{if(ch&&PAGE===k)renderMain()})}};wrap("hr_bl");wrap("hr_pl")}
/* Phiếu lương (HCNS): ai đã xem, câu hỏi của nhân viên — thêm vào cuối trang Phiếu lương. */
{const o=PAGES.hr_pl;if(o)PAGES.hr_pl=m=>{o(m);if(!(typeof HRD==="function"&&HRD()&&HRD().payroll))return;const ks=Object.entries(HRD().payroll).filter(([,p])=>p.st==="phathanh").map(([k])=>k).sort();const ky=ks[ks.length-1];if(!ky)return;
  const box=document.createElement("section");box.className="card";box.innerHTML=`<div class="card-h"><h2>Câu hỏi về phiếu lương tháng ${ky.slice(5)}/${ky.slice(0,4)}</h2></div><p class="empty">Đang tải…</p>`;m.appendChild(box);
  svApi("/api/hub/nghiphep/phieu-luong-hcns?ky="+ky).then(r=>{const P=HRD().payroll[ky],n=(P.rows||[]).length;
    box.innerHTML=`<div class="card-h"><h2>Phiếu lương tháng ${ky.slice(5)}/${ky.slice(0,4)}: ${r.xem.length}/${n} người đã xem</h2></div>${r.hoi.length?r.hoi.map(q=>`<div class="np-item"><b>${esc(q.ten)}</b><div>${esc(q.noi_dung)}</div>${q.tra_loi?`<div class="hint">Đã trả lời: ${esc(q.tra_loi)}</div>`:`<div style="display:flex;gap:6px"><input id="pl-tl-${q.id}" placeholder="Trả lời" style="flex:1"><button class="btn sm pri" data-tl="${q.id}">Gửi</button></div>`}</div>`).join(""):`<p class="empty">Chưa có câu hỏi nào.</p>`}`;
    box.querySelectorAll("[data-tl]").forEach(b=>b.onclick=async()=>{try{await svApi("/api/hub/nghiphep/phieu-luong/hoi/"+b.dataset.tl+"/tra-loi",{method:"POST",body:JSON.stringify({traLoi:$("#pl-tl-"+b.dataset.tl).value})});toast("Đã trả lời");renderMain()}catch(e){toast(e.message)}})}).catch(()=>{box.remove()})}}

document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-npme]");if(b){e.preventDefault();PAGE="np_toi";render()}});
PAGES.np_toi=pNpToi;PAGES.tu_toi=pTuToi;PAGES.pl_toi=pPlToi;PAGES.np_duyet=pNpDuyet;PAGES.np_ql=pNpQl;PAGES.tu_ql=pTuQl;
if(typeof document!=="undefined"&&!document.getElementById("np-css")){const st=document.createElement("style");st.id="np-css";st.textContent=`.np-item{display:flex;flex-direction:column;gap:4px;padding:10px 0;border-bottom:1px solid var(--line)}.np-item:last-child{border-bottom:0}`;document.head.appendChild(st)}
if(typeof window!=="undefined"&&typeof SERVER!=="undefined"&&SERVER){setTimeout(npCho,1500);setInterval(npCho,120000)}

/* Menu (chạy sau chamcong.js):
   - Của tôi: Chấm công, Nghỉ phép & tăng ca, Tạm ứng lương, Phiếu lương (thay mục cũ "Nghỉ phép, OT, tạm ứng").
   - Bên quản trị: Tài chính – Kế toán › Tạm ứng lương cho Kế toán, CEO. Phần trong Nhân sự do chamcong.js sắp. */
{
  const ADMH=typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin";
  const me=MODULES.find(x=>x.k==="me");if(me){const g0=me.groups;me.groups=()=>{const G=g0();if(G[0]){G[0][1]=G[0][1].filter(i=>i[0]!=="hr_me"&&i[0]!=="hr_plme");const at=G[0][1].findIndex(i=>i[0]==="cc_toi")+1;if(!G[0][1].some(i=>i[0]==="np_toi"))G[0][1].splice(at,0,MI("np_toi","Nghỉ phép & tăng ca"),MI("tu_toi","Tạm ứng lương"),MI("pl_toi","Phiếu lương"))}return G}}
  if(ADMH){const t=MODULES.find(x=>x.k==="q_tc");if(t){const g0=t.groups;t.groups=()=>{const G=g0();const it=MI("tu_ql","Tạm ứng lương",()=>npKetoan(),()=>NP.cho.tu||"");if(G[0]&&!G[0][1].some(i=>i[0]==="tu_ql"))G[0][1].push(it);return G}}}
}
