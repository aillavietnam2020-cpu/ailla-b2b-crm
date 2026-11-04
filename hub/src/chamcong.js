/* =====================================================================
   CHẤM CÔNG TRÊN ĐIỆN THOẠI (chị Hoa duyệt 04/11/2026)
   - Nhân viên mở vanhanh trên điện thoại, bấm Chấm vào / Chấm ra. Trình duyệt lấy vị trí, máy chủ ghi giờ máy chủ
     và khoảng cách tới điểm chấm gần nhất. Ngoài phạm vi thì phải ghi lý do (công tác, giao hàng…), HCNS thấy dấu đỏ.
   - Trưởng nhóm xem phòng mình; CEO, HCNS, kế toán xem cả công ty. Cài đặt (điểm chấm, giờ làm, phút ân hạn, thứ Bảy): CEO, HCNS.
   - Mỗi người theo một lịch làm (Văn phòng, Xưởng, Live theo ca, Sale giờ linh hoạt), gán theo phòng ban hoặc từng người.
     Lịch giờ cố định tính đi muộn (quá 8h05), về sớm, chuyên cần theo thông báo 01102026/TB-AILLA. Live, sale chỉ ghi giờ.
   - Chưa tự đổ vào bảng lương; HCNS vẫn chốt công ở Nhân sự › Chấm công. Máy chấm công cũ vẫn dùng song song.
   - Máy chủ: /api/hub/chamcong (src/server/routes/chamCong.ts). Chữ trên màn hình theo vai trò, không xưng chị/em.
   ===================================================================== */
const CC={me:null,meKey:"",day:null,dayKey:"",mon:null,monKey:"",cfg:null,thang:"",ngay:"",pb:"",open:{},busy:false,reason:null,err:""};
ICONS.clock='<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';
const CC_PAGES=["cc_toi","cc_ngay","cc_thang","cc_caidat"];
const ccOn=()=>typeof PAGE!=="undefined"&&CC_PAGES.includes(PAGE);
const ccRedraw=()=>{if(ccOn())renderMain()};
const ccLead=u=>!!u&&["lead","truongphong"].includes(u.role);
const ccHr=u=>!!u&&(u.role==="admin"||u.phongBan==="HCNS"||hrOk());
const ccHm=iso=>{if(!iso)return "—";const d=new Date(Date.parse(iso)+7*3600e3);return String(d.getUTCHours()).padStart(2,"0")+":"+String(d.getUTCMinutes()).padStart(2,"0")};
const ccDow=n=>["CN","T2","T3","T4","T5","T6","T7"][new Date(n+"T00:00:00Z").getUTCDay()];
const ccDm=n=>n.slice(8)+"/"+n.slice(5,7);
const ccVnNow=()=>new Date(Date.now()+7*3600e3);
const ccToday=()=>ccVnNow().toISOString().slice(0,10);
const ccMonths=()=>{const d=ccVnNow(),o=[];for(let i=0;i<6;i++){const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-i,1));o.push(x.toISOString().slice(0,7))}return o};
const ccMonthSel=id=>`<select id="${id}">${ccMonths().map(k=>`<option value="${k}"${k===(CC.thang||ccMonths()[0])?" selected":""}>Tháng ${k.slice(5)}/${k.slice(0,4)}</option>`).join("")}</select>`;
const ccPbName=k=>{const d=(CC.day&&CC.day.deps||CC.mon&&CC.mon.deps||[]).find(x=>x.k===k);return d?d.n:(k||"—")};
const CC_T7={ca:"thứ Bảy làm cả ngày",nua:"thứ Bảy làm buổi sáng",nghi:"nghỉ thứ Bảy",nghi13:"nghỉ thứ Bảy tuần 1 và 3",nghi24:"nghỉ thứ Bảy tuần 2 và 4"};
const CC_KIEU={codinh:"Giờ cố định",ca:"Theo ca",tudo:"Giờ linh hoạt"};
const ccLate=l=>{const t=+l.gioVao.slice(0,2)*60+ +l.gioVao.slice(3)+l.anHan;return String(Math.floor(t/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0")};
const ccLichTxt=l=>l.kieu==="codinh"?`${l.gioVao}–${l.gioRa}, quá ${ccLate(l)} là muộn · ${CC_T7[l.thuBay]||""}`:l.kieu==="ca"?"làm theo ca, chỉ ghi giờ vào ra":"giờ linh hoạt, chỉ ghi giờ vào ra";
const ccGio=m=>m?Math.floor(m/60)+"g"+String(m%60).padStart(2,"0"):"—";
const ccPhut=m=>m>=60?Math.floor(m/60)+" giờ "+(m%60?m%60+" phút":""):m+" phút";
/* Ghi chú một ngày công: đi muộn, về sớm, quên chấm ra, ngoài phạm vi. */
const ccNote=x=>{const a=[];if(x.muon)a.push(pill("Muộn "+ccPhut(x.muon),"amb"));if(x.som)a.push(pill("Về sớm "+ccPhut(x.som),"amb"));if(x.quenRa)a.push(pill("Quên chấm ra","red"));if(x.ngoai)a.push(pill("Ngoài phạm vi","red"));return a.join(" ")};

async function ccLoadMe(force){
  const key=CC.thang||"";if(!force&&CC.meKey===key&&CC.me)return;CC.meKey=key;
  try{CC.me=await svApi("/api/hub/chamcong/me"+(CC.thang?"?thang="+CC.thang:""));CC.err=""}catch(e){CC.err=e.message||"Không tải được"}
  ccRedraw();
}
async function ccLoadDay(force){
  const key=CC.ngay||"";if(!force&&CC.dayKey===key&&CC.day)return;CC.dayKey=key;CC.day={loading:true};
  try{CC.day=await svApi("/api/hub/chamcong/ngay"+(CC.ngay?"?ngay="+CC.ngay:""))}catch(e){CC.day={err:e.message||"Không tải được"}}
  ccRedraw();
}
async function ccLoadMon(force){
  const key=CC.thang||"";if(!force&&CC.monKey===key&&CC.mon)return;CC.monKey=key;CC.mon={loading:true};
  try{CC.mon=await svApi("/api/hub/chamcong/thang"+(CC.thang?"?thang="+CC.thang:""))}catch(e){CC.mon={err:e.message||"Không tải được"}}
  ccRedraw();
}

/* Lấy vị trí điện thoại. Lỗi thì trả lời bằng câu dễ hiểu. */
function ccPos(){
  return new Promise((ok,bad)=>{
    if(!navigator.geolocation)return bad(new Error("Trình duyệt này không lấy được vị trí. Hãy mở bằng Chrome hoặc Safari trên điện thoại."));
    navigator.geolocation.getCurrentPosition(p=>ok(p.coords),e=>bad(new Error(e.code===1
      ?"Trang web chưa được phép xem vị trí. Bấm biểu tượng ổ khóa cạnh địa chỉ web › Quyền › Vị trí › Cho phép, rồi bấm lại."
      :"Chưa lấy được vị trí. Bật định vị (GPS) trên điện thoại, ra chỗ thoáng rồi bấm lại.")),{enableHighAccuracy:true,timeout:20000,maximumAge:0});
  });
}
async function ccCham(loai){
  if(CC.busy)return;CC.busy=true;CC.err="";ccRedraw();
  try{
    const c=await ccPos();
    const lyDo=CC.reason&&CC.reason.loai===loai?($("#cc-lydo")||{}).value||"":"";
    const r=await svApi("/api/hub/chamcong/cham",{method:"POST",body:JSON.stringify({loai,lat:c.latitude,lng:c.longitude,acc:c.accuracy,lyDo})});
    CC.reason=null;toast((loai==="vao"?"Đã chấm vào lúc ":"Đã chấm ra lúc ")+ccHm(r.at));
    await ccLoadMe(true);
  }catch(e){
    if(e.code==="NEED_REASON")CC.reason={loai,msg:e.message};else CC.err=e.message||"Chưa chấm được";
  }
  CC.busy=false;ccRedraw();
}

let CC_TICK=0;
function ccClock(){clearInterval(CC_TICK);CC_TICK=setInterval(()=>{const el=document.getElementById("cc-clock");if(!el||PAGE!=="cc_toi"){clearInterval(CC_TICK);return}const d=ccVnNow();el.textContent=[d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()].map(n=>String(n).padStart(2,"0")).join(":")},1000)}

/* ---------- Của tôi: nút chấm + công trong tháng ---------- */
function pCcToi(m){
  if(!CC.me){m.innerHTML=H("Chấm công")+(CC.err?`<section class="card"><p class="empty">${esc(CC.err)}</p></section>`:`<section class="card"><p class="empty">Đang tải…</p></section>`);ccLoadMe();return}
  const R=CC.me,L7=R.lich,T=R.tong,hn=R.homNay||[],vao=hn.find(x=>x.loai==="vao"),ra=hn.filter(x=>x.loai==="ra").pop(),today=R.today;
  const loai=vao?"ra":"vao",tdy=(R.ngay||[]).find(x=>x.ngay===today)||{};
  const D7=ccVnNow(),dstr=`${ccDow(today)}, ${ccDm(today)}/${today.slice(0,4)}`;
  const where=x=>x.diem?`${esc(x.diem)}${x.kc!=null?" · cách "+x.kc+" m":""}`:"Chưa cài điểm chấm";
  const st=!vao&&!ra?`<p class="cc-st">Hôm nay chưa chấm công.</p>`
    :`<div class="cc-st">${vao?`<div><b>Vào ${ccHm(vao.at)}</b> <span class="hint">${where(vao)}</span> ${tdy.muon?pill("Muộn "+ccPhut(tdy.muon),"amb"):""}${vao.trong===0?" "+pill("Ngoài phạm vi","red"):""}</div>`:`<div>${pill("Chưa chấm vào","amb")}</div>`}
      ${ra?`<div><b>Ra ${ccHm(ra.at)}</b> <span class="hint">${where(ra)}</span>${ra.trong===0?" "+pill("Ngoài phạm vi","red"):""}</div>`:""}</div>`;
  const rs=CC.reason&&CC.reason.loai===loai?`<div class="cc-reason"><p>${esc(CC.reason.msg)}</p><textarea id="cc-lydo" rows="2" placeholder="Ví dụ: đi giao hàng cho đại lý Hải Phòng"></textarea></div>`:"";
  const days=(R.ngay||[]).slice().reverse();
  m.innerHTML=H("Chấm công",`Lịch ${esc(L7.ten)}: ${ccLichTxt(L7)}`)+`
  <section class="card cc-main">
    <div class="cc-date">${dstr}</div>
    <div class="cc-clock" id="cc-clock">${[D7.getUTCHours(),D7.getUTCMinutes(),D7.getUTCSeconds()].map(n=>String(n).padStart(2,"0")).join(":")}</div>
    ${st}${rs}
    <button class="btn pri big cc-btn${loai==="ra"?" ra":""}" id="cc-go"${CC.busy?" disabled":""}>${CC.busy?"Đang lấy vị trí…":loai==="vao"?"Chấm vào":(ra?"Chấm ra lại":"Chấm ra")}</button>
    ${CC.err?`<p class="cc-err">${esc(CC.err)}</p>`:""}
    <p class="hint">Bấm nút, điện thoại sẽ hỏi cho phép xem vị trí: chọn Cho phép. Giờ chấm lấy theo đồng hồ máy chủ.${R.diem.length?"":" CEO / HCNS chưa cài điểm chấm nên chưa kiểm được vị trí."}</p>
  </section>
  <div class="filters">${ccMonthSel("cc-m")}</div>
  <div class="grid kpis">${kpi("Ngày có chấm công",T.cong+"/"+T.lamChuan)}${L7.kieu==="codinh"?kpi("Đi muộn + về sớm",T.muonLan+T.somLan,"tối đa 2 lần để giữ chuyên cần")+kpi("Chuyên cần tạm tính",T.chuyenCan?"Đạt":"Chưa đạt",T.nghi?`${T.nghi} ngày không chấm`:""):kpi("Tổng giờ làm",ccGio(T.phut))}${kpi("Quên chấm ra",T.quenRa)}</div>
  <section class="card flush">${tbl(["Ngày","Vào","Ra","Giờ làm","Ghi chú"],days.filter(x=>x.lam||x.vao||x.ra).map(x=>`<tr${x.ngay===today?' class="cc-today"':""}><td>${ccDow(x.ngay)} ${ccDm(x.ngay)}</td><td class="mono">${ccHm(x.vao)}</td><td class="mono">${ccHm(x.ra)}</td><td class="mono">${ccGio(x.phut)}</td><td>${ccNote(x)||(!x.vao&&!x.ra&&x.ngay!==today?pill("Không chấm","gry"):"")}</td></tr>`))}</section>`;
  $("#cc-go").onclick=()=>ccCham(loai);
  $("#cc-m").onchange=e=>{CC.thang=e.target.value;CC.me=null;ccLoadMe(true)};
  ccClock();
}

/* ---------- Hôm nay (trưởng nhóm: phòng mình; CEO, HCNS: cả công ty) ---------- */
function pCcNgay(m){
  const R=CC.day;if(!R||R.loading){m.innerHTML=H("Chấm công hôm nay")+`<section class="card"><p class="empty">Đang tải…</p></section>`;ccLoadDay();return}
  if(R.err){m.innerHTML=H("Chấm công hôm nay")+`<section class="card"><p class="empty">${esc(R.err)}</p></section>`;return}
  const L=R.list.filter(x=>!CC.pb||x.pb===CC.pb),lam=L.some(x=>x.lam);
  const co=L.filter(x=>x.vao),muon=L.filter(x=>x.muon),chua=L.filter(x=>!x.vao&&x.lam),ngoai=L.filter(x=>x.ngoai);
  const pbs=[...new Set(R.list.map(x=>x.pb).filter(Boolean))];
  const rank=x=>x.ngoai?0:x.muon?1:!x.vao?2:3;
  const rows=L.slice().sort((a,b)=>rank(a)-rank(b)||(a.vao||"z").localeCompare(b.vao||"z")).map(x=>{
    const ly=x.luot.filter(l=>l.ly_do).map(l=>`${l.loai==="vao"?"Vào":"Ra"}: ${esc(l.ly_do)}`).join("<br>");
    const kc=x.luot.filter(l=>l.trong===0).map(l=>`${l.loai==="vao"?"Vào":"Ra"} cách ${esc(l.diem||"")} ${l.kc} m`).join("<br>");
    return `<tr><td><b>${esc(x.name)}</b><div class="hint">${esc(x.lich)}</div></td><td>${esc(ccPbName(x.pb))}</td><td class="mono">${ccHm(x.vao)}</td><td class="mono">${ccHm(x.ra)}</td><td>${ccNote(x)||(x.vao?pill(x.kieu==="codinh"?"Đúng giờ":"Đã chấm","grn"):x.lam?pill("Chưa chấm","gry"):pill("Ngày nghỉ","gry"))}</td><td class="hint">${[kc,ly].filter(Boolean).join("<br>")}</td></tr>`});
  m.innerHTML=H("Chấm công hôm nay",R.vai.all?"Cả công ty":"Phòng "+esc(ccPbName(R.vai.pb)))+`
  <div class="filters"><input type="date" id="cc-d" value="${R.ngay}" max="${R.today}">${R.vai.all&&pbs.length>1?`<select id="cc-pb"><option value="">Tất cả phòng</option>${pbs.map(p=>`<option value="${esc(p)}"${p===CC.pb?" selected":""}>${esc(ccPbName(p))}</option>`).join("")}</select>`:""}<span class="sp"></span><button class="btn" id="cc-rl">Tải lại</button></div>
  ${!lam?`<section class="card"><p class="hint">Ngày ${ccDm(R.ngay)} là ngày nghỉ theo lịch làm của mọi người.</p></section>`:""}
  <div class="grid kpis">${kpi("Có mặt",co.length+"/"+L.length)}${kpi("Đi muộn",muon.length)}${kpi("Chưa chấm vào",chua.length)}${kpi("Ngoài phạm vi",ngoai.length)}</div>
  <section class="card flush">${tbl(["Người","Phòng","Vào","Ra","Tình trạng","Vị trí, lý do"],rows)}</section>`;
  $("#cc-d").onchange=e=>{CC.ngay=e.target.value;ccLoadDay(true)};
  if($("#cc-pb"))$("#cc-pb").onchange=e=>{CC.pb=e.target.value;renderMain()};
  $("#cc-rl").onclick=()=>ccLoadDay(true);
}

/* ---------- Bảng chấm công tháng ---------- */
function pCcThang(m){
  const R=CC.mon;if(!R||R.loading){m.innerHTML=H("Bảng chấm công tháng")+`<section class="card"><p class="empty">Đang tải…</p></section>`;ccLoadMon();return}
  if(R.err){m.innerHTML=H("Bảng chấm công tháng")+`<section class="card"><p class="empty">${esc(R.err)}</p></section>`;return}
  const L=R.list.filter(x=>!CC.pb||x.pb===CC.pb).sort((a,b)=>a.pb.localeCompare(b.pb)||a.name.localeCompare(b.name));
  const pbs=[...new Set(R.list.map(x=>x.pb).filter(Boolean))];
  const rows=L.map(x=>{const o=CC.open[x.id];
    const cd=x.kieu==="codinh",dash=v=>v||"—";
    const det=o?`<tr class="cc-det"><td colspan="10">${tbl(["Ngày","Vào","Ra","Giờ làm","Ghi chú"],x.ngay.slice().reverse().filter(d=>d.lam||d.vao||d.ra).map(d=>`<tr><td>${ccDow(d.n)} ${ccDm(d.n)}</td><td class="mono">${ccHm(d.vao)}</td><td class="mono">${ccHm(d.ra)}</td><td class="mono">${ccGio(d.phut)}</td><td>${ccNote(d)||(!d.vao&&!d.ra&&d.n!==R.today?pill("Không chấm","gry"):"")}</td></tr>`))}</td></tr>`:"";
    return `<tr class="cc-row" data-id="${esc(x.id)}"><td><b>${esc(x.name)}</b> <span class="hint">${o?"▾":"▸"}</span><div class="hint">${esc(ccPbName(x.pb))} · ${esc(x.lich)}</div></td><td class="n">${x.cong}/${x.lamChuan}</td><td class="n">${cd?dash(x.muonLan):"·"}${x.muon10?` <span class="hint">(${x.muon10} lần quá 10 phút)</span>`:""}</td><td class="n">${cd?dash(x.somLan):"·"}</td><td class="n">${cd?dash(x.nghi):"·"}</td><td class="n">${dash(x.quenRa)}</td><td class="n">${dash(x.ngoai)}</td><td class="n mono">${ccGio(x.phut)}</td><td>${x.chuyenCan===null?"·":x.chuyenCan?pill("Đạt","grn"):pill("Mất","red")}</td><td class="n">${x.cong}</td></tr>${det}`});
  m.innerHTML=H("Bảng chấm công tháng",(R.vai.all?"Cả công ty":"Phòng "+esc(ccPbName(R.vai.pb)))+" · lấy từ lượt chấm trên điện thoại")+`
  <div class="filters">${ccMonthSel("cc-m")}${R.vai.all&&pbs.length>1?`<select id="cc-pb"><option value="">Tất cả phòng</option>${pbs.map(p=>`<option value="${esc(p)}"${p===CC.pb?" selected":""}>${esc(ccPbName(p))}</option>`).join("")}</select>`:""}<span class="sp"></span>${typeof XLSX!=="undefined"?`<button class="btn" id="cc-xl">Xuất Excel</button>`:""}</div>
  <section class="card flush"><div class="tbl"><table><thead><tr><th>Người</th><th class="n">Ngày có chấm / ngày làm</th><th class="n">Đi muộn (lần)</th><th class="n">Về sớm (lần)</th><th class="n">Ngày không chấm</th><th class="n">Quên chấm ra</th><th class="n">Ngoài phạm vi</th><th class="n">Tổng giờ</th><th>Chuyên cần</th><th class="n">Bữa trưa</th></tr></thead><tbody>${rows.join("")||`<tr><td colspan="10" class="empty">Chưa có dữ liệu.</td></tr>`}</tbody></table></div></section>
  <p class="hint">Bấm vào tên để xem từng ngày. Chuyên cần (200.000đ, thông báo 01102026): đi muộn quá 5 phút + về sớm không quá 2 lần và không nghỉ quá 2 ngày. Đây là số tạm tính: chưa trừ lần về sớm có phép, ngày nghỉ có đơn, lễ tết; HCNS xem lại rồi chốt công ở Nhân sự › Chấm công như trước. Bữa trưa = số ngày có chấm (áp dụng nhân sự chính thức full time). Dấu · là lịch theo ca hoặc giờ linh hoạt, không tính.</p>`;
  m.querySelectorAll(".cc-row").forEach(r=>r.onclick=()=>{CC.open[r.dataset.id]=!CC.open[r.dataset.id];renderMain()});
  $("#cc-m").onchange=e=>{CC.thang=e.target.value;CC.mon=null;CC.me=null;ccLoadMon(true)};
  if($("#cc-pb"))$("#cc-pb").onchange=e=>{CC.pb=e.target.value;renderMain()};
  if($("#cc-xl"))$("#cc-xl").onclick=()=>{
    const rowsX=[];L.forEach(x=>x.ngay.forEach(d=>{if(!d.lam&&!d.vao&&!d.ra)return;rowsX.push({"Người":x.name,"Phòng":ccPbName(x.pb),"Ngày":d.n,"Vào":d.vao?ccHm(d.vao):"","Ra":d.ra?ccHm(d.ra):"","Lịch":x.lich,"Giờ làm (phút)":d.phut||"","Muộn (phút)":d.muon||"","Về sớm (phút)":d.som||"","Quên chấm ra":d.quenRa?"x":"","Ngoài phạm vi":d.ngoai?"x":""})}));
    const sum=L.map(x=>({"Người":x.name,"Phòng":ccPbName(x.pb),"Lịch":x.lich,"Ngày có chấm":x.cong,"Ngày làm":x.lamChuan,"Đi muộn (lần)":x.muonLan,"Muộn quá 10 phút (lần)":x.muon10,"Đi muộn (phút)":x.muonPhut,"Về sớm (lần)":x.somLan,"Ngày không chấm":x.nghi,"Quên chấm ra":x.quenRa,"Ngoài phạm vi":x.ngoai,"Tổng giờ làm (phút)":x.phut,"Chuyên cần":x.chuyenCan===null?"":x.chuyenCan?"Đạt":"Mất","Bữa trưa":x.cong}));
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(sum),"Tong hop");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rowsX),"Tung ngay");XLSX.writeFile(wb,`cham-cong-${R.thang}.xlsx`)};
}

/* ---------- Cài đặt: điểm chấm, lịch làm, gán lịch ---------- */
const ccPbName2=(deps,k)=>{const d=deps.find(x=>x.k===k);return d?d.n:k};
function pCcCaiDat(m){
  if(!CC.cfg){m.innerHTML=H("Cài đặt chấm công")+`<section class="card"><p class="empty">Đang tải…</p></section>`;
    svApi("/api/hub/chamcong/caidat").then(s=>{CC.cfg=JSON.parse(JSON.stringify(s));ccRedraw()}).catch(e=>{m.innerHTML=H("Cài đặt chấm công")+`<section class="card"><p class="empty">${esc(e.message)}</p></section>`});return}
  const s=CC.cfg,deps=s.deps||[],people=(s.people||[]).slice().sort((a,b)=>a.pb.localeCompare(b.pb)||a.name.localeCompare(b.name));
  const lichSel=(id,val,blank)=>`<select id="${id}">${blank?`<option value="">${blank}</option>`:""}${s.lich.map(l=>`<option value="${esc(l.id)}"${l.id===val?" selected":""}>${esc(l.ten)}</option>`).join("")}</select>`;
  const rowD=(d,i)=>`<tr><td><input id="cc-dt-${i}" value="${esc(d.ten)}"></td><td><input id="cc-dl-${i}" value="${d.lat===""?"":d.lat+", "+d.lng}" placeholder="21.02851, 105.85416"></td><td><input id="cc-db-${i}" class="num s" type="number" min="30" max="2000" value="${d.bk}"> m</td><td>${d.lat!==""?`<a class="btn sm" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${d.lat},${d.lng}">Xem bản đồ</a> `:""}<button class="btn sm danger" data-del="${i}">Xóa</button></td></tr>`;
  const t7=(i,v)=>`<select id="cc-l7-${i}">${Object.entries(CC_T7).map(([k,t])=>`<option value="${k}"${k===v?" selected":""}>${t[0].toUpperCase()+t.slice(1)}</option>`).join("")}</select>`;
  const rowL=(l,i)=>`<tr><td><input id="cc-ln-${i}" value="${esc(l.ten)}"></td><td><select id="cc-lk-${i}">${Object.entries(CC_KIEU).map(([k,t])=>`<option value="${k}"${k===l.kieu?" selected":""}>${t}</option>`).join("")}</select></td><td><input type="time" id="cc-lv-${i}" value="${l.gioVao}"> – <input type="time" id="cc-lr-${i}" value="${l.gioRa}"></td><td><input type="number" class="num s" id="cc-la-${i}" min="0" max="120" value="${l.anHan}"> phút</td><td>${t7(i,l.thuBay)}</td><td><input type="time" id="cc-l8-${i}" value="${l.gioRaT7}"></td></tr>`;
  const ov=Object.entries(s.nguoiLich);
  m.innerHTML=H("Cài đặt chấm công","Điểm chấm, lịch làm của từng nhóm, ai theo lịch nào")+`
  <section class="card"><div class="card-h"><h2>Điểm chấm công</h2><span class="hint">văn phòng, xưởng, kho</span></div>
    <p class="hint">Cách dễ nhất: đứng tại văn phòng hoặc xưởng, bấm "Thêm điểm tại chỗ tôi đang đứng". Hoặc mở Google Maps, bấm giữ vào vị trí, chép hai số tọa độ dán vào ô. Bán kính nên để 100–200 m vì định vị trong nhà hay lệch.</p>
    ${tbl(["Tên điểm","Tọa độ","Bán kính",""],s.diem.map(rowD))}
    <div class="filters"><button class="btn" id="cc-here">Thêm điểm tại chỗ tôi đang đứng</button><button class="btn" id="cc-add">Thêm điểm (nhập tọa độ)</button></div>
  </section>
  <section class="card"><div class="card-h"><h2>Lịch làm</h2></div>
    ${tbl(["Tên lịch","Kiểu","Giờ vào – ra","Được trễ","Thứ Bảy","Ra thứ Bảy (buổi sáng)"],s.lich.map(rowL))}
    <p class="hint">Giờ cố định: tính đi muộn, về sớm, chuyên cần. Văn phòng theo thông báo 01102026: vào 8h00, quá 8h05 là muộn (được trễ 5 phút). Theo ca, giờ linh hoạt: chỉ ghi giờ vào ra và tổng giờ làm, chưa tính muộn (team live sẽ tính khi có xếp ca). Nghỉ trưa không cần chấm.</p>
  </section>
  <section class="card"><div class="card-h"><h2>Phòng ban theo lịch nào</h2></div>
    <div class="cc-form">${deps.map((d,i)=>`<label>${esc(d.n)}${lichSel("cc-pb-"+i,s.pbLich[d.k]||"","Mặc định ("+esc((s.lich.find(l=>l.id===s.macDinh)||{}).ten||"")+")")}</label>`).join("")}<label>Mặc định cho phòng chưa chọn${lichSel("cc-md",s.macDinh)}</label></div>
  </section>
  <section class="card"><div class="card-h"><h2>Người theo lịch riêng</h2><span class="hint">ví dụ người team live nằm trong phòng Content</span></div>
    ${tbl(["Người","Lịch",""],ov.map(([id,l],i)=>`<tr><td>${esc((people.find(p=>p.id===id)||{name:id}).name)}</td><td>${lichSel("cc-ov-"+i,l)}</td><td><button class="btn sm danger" data-ovdel="${esc(id)}">Bỏ</button></td></tr>`))}
    <div class="filters"><select id="cc-ovp"><option value="">Chọn người…</option>${people.filter(p=>!s.nguoiLich[p.id]).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.pb?" · "+esc(ccPbName2(deps,p.pb)):""}</option>`).join("")}</select>${lichSel("cc-ovl","live")}<button class="btn" id="cc-ova">Thêm</button></div>
  </section>
  <div class="filters"><span class="sp"></span><button class="btn pri" id="cc-save">Lưu cài đặt</button></div>`;
  const v=id=>($("#"+id)||{}).value;
  const pull=()=>{
    s.diem=s.diem.map((d,i)=>{const ll=(v("cc-dl-"+i)||"").split(/[,\s]+/).filter(Boolean).map(Number);return {...d,ten:v("cc-dt-"+i)||d.ten,lat:ll.length===2?ll[0]:"",lng:ll.length===2?ll[1]:"",bk:Number(v("cc-db-"+i))||d.bk}});
    s.lich=s.lich.map((l,i)=>({...l,ten:v("cc-ln-"+i)||l.ten,kieu:v("cc-lk-"+i)||l.kieu,gioVao:v("cc-lv-"+i)||l.gioVao,gioRa:v("cc-lr-"+i)||l.gioRa,anHan:Number(v("cc-la-"+i))||0,thuBay:v("cc-l7-"+i)||l.thuBay,gioRaT7:v("cc-l8-"+i)||l.gioRaT7}));
    const pl={};deps.forEach((d,i)=>{const x=v("cc-pb-"+i);if(x)pl[d.k]=x});s.pbLich=pl;s.macDinh=v("cc-md")||s.macDinh;
    ov.forEach(([id],i)=>{const x=v("cc-ov-"+i);if(x)s.nguoiLich[id]=x});
  };
  m.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{pull();s.diem.splice(Number(b.dataset.del),1);renderMain()});
  m.querySelectorAll("[data-ovdel]").forEach(b=>b.onclick=()=>{pull();delete s.nguoiLich[b.dataset.ovdel];renderMain()});
  $("#cc-ova").onclick=()=>{const p=v("cc-ovp");if(!p){toast("Chọn người trước");return}pull();s.nguoiLich[p]=v("cc-ovl");renderMain()};
  $("#cc-add").onclick=()=>{pull();s.diem.push({id:"d"+Date.now(),ten:"Điểm "+(s.diem.length+1),lat:"",lng:"",bk:150});renderMain()};
  $("#cc-here").onclick=async()=>{pull();try{const c=await ccPos();s.diem.push({id:"d"+Date.now(),ten:s.diem.length?"Điểm "+(s.diem.length+1):"Văn phòng",lat:+c.latitude.toFixed(6),lng:+c.longitude.toFixed(6),bk:Math.max(100,Math.min(300,Math.round((c.accuracy||0)*2)))});renderMain();toast("Đã thêm điểm, sửa tên rồi bấm Lưu")}catch(e){toast(e.message)}};
  $("#cc-save").onclick=async()=>{pull();const bad=s.diem.filter(d=>d.lat===""||!isFinite(d.lat)||!isFinite(d.lng));if(bad.length){toast("Có điểm chưa đúng tọa độ: "+bad.map(d=>d.ten).join(", "));return}
    try{const r=await svApi("/api/hub/chamcong/caidat",{method:"PUT",body:JSON.stringify(s)});CC.cfg={...r,people:s.people,deps:s.deps};CC.me=null;CC.day=null;CC.mon=null;toast("Đã lưu cài đặt chấm công");renderMain()}catch(e){toast(e.message)}};
}

PAGES.cc_toi=pCcToi;PAGES.cc_ngay=pCcNgay;PAGES.cc_thang=pCcThang;PAGES.cc_caidat=pCcCaiDat;

/* Menu (chạy sau menubang.js): bên vận hành một mục "Chấm công" ngay dưới "Công việc", ai cũng thấy phần của mình. */
{
  const ADMH=typeof HOST_MODE!=="undefined"&&HOST_MODE==="admin";
  if(!ADMH){const i=MODULES.findIndex(x=>x.k==="cv");MODULES.splice(i>=0?i+1:0,0,{k:"ccg",zone:"",ic:"clock",n:"Chấm công",sub:"",tabs:true,groups:()=>[["",[MI("cc_toi","Của tôi"),MI("cc_ngay","Hôm nay",u=>ccHr(u)||ccLead(u)),MI("cc_thang","Bảng tháng",u=>ccHr(u)||ccLead(u)),MI("cc_caidat","Cài đặt",ccHr)]]]})}
  const me=MODULES.find(x=>x.k==="me");if(me){const g0=me.groups;me.groups=()=>{const G=g0();if(G[0]&&!G[0][1].some(i=>i[0]==="cc_toi"))G[0][1].unshift(MI("cc_toi","Chấm công"));return G}}
}
