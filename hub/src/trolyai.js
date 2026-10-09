/* =====================================================================
   HỎI AI (hiện ở mọi trang): nhân sự hỏi bằng lời thường, web gửi kèm bản tóm tắt số liệu đã tính sẵn,
   máy chủ chặn số câu mỗi ngày (nhân viên 10, trưởng nhóm / trưởng phòng 20, CEO 50) rồi hỏi AI.
   Gói số liệu hiện có: Marketing. Phòng ban khác thêm gói riêng ở đây.
   ===================================================================== */
const AI_SUG=["Tuần này còn phải sản xuất bao nhiêu video?","Tóm tắt hiệu quả video 7 ngày qua","Việc nào đang trễ hạn?","Sản phẩm nào còn thiếu video nhiều nhất?"];
let AI_OPEN=false,AI_BUSY=false,AI_LOG=[],AI_Q=null;

/* Gói số liệu Marketing: toàn bộ con số do web tính sẵn, AI chỉ đọc và diễn đạt lại */
function aiPackMkt(){
  const d=D(),td=d.settings.today,W5=PB_W(),cw=weekOf(td)||1,Wc=W5[cw-1]||W5[0],L=[],lead=["admin","lead","truongphong"].includes(ME.role);
  const sp=k=>k==="khac"?"Sản phẩm khác":sk(k).n,N=pbNeed(d);
  L.push(`Hôm nay ngày ${td}/${MONTH.mon}/${MONTH.year}, đang ở tuần ${cw} (ngày ${Wc.tu} đến ${Wc.den}) của tháng ${MONTH.mon} (tháng có ${MONTH.ndays} ngày).`);
  CHANNELS.forEach(ch=>{const pr=knPairs(d,ch.k);if(!pr.length)return;const K=kn(d,ch.k),P=knPlan(d,ch.k),u=ch.needId?"video":"bài";
    L.push(`KÊNH ${ch.short}: mục tiêu tháng ${K.T} ${u}, trung bình ${fx1(K.tb)} ${u}/ngày${K.nS?`, tuần sale từ ngày ${K.tu} đến ngày ${K.den}`:""}.`);
    L.push("  KPI tháng từng sản phẩm: "+pr.map(x=>sp(x.sku)+" "+x.sl).join(", ")+".");
    L.push("  Kế hoạch từng tuần của kênh: "+P.map((m,i)=>`tuần ${i+1} ${m.tong}`).join(", ")+".");
    L.push(`  Kế hoạch tuần ${cw} theo sản phẩm: `+P.ks.map(k=>sp(k)+" "+(P[cw-1][k]||0)).join(", ")+".")});
  L.push("CÒN CẦN SẢN XUẤT (cộng các kênh, đã trừ video dùng tồn và video đã có hoặc đang làm):");
  N.ks.forEach(k=>{const r=N.bySku[k],cum=r.need.slice(0,cw).reduce((a,b)=>a+b,0),tuan=Math.max(0,cum-r.have),thang=Math.max(0,r.need.reduce((a,b)=>a+b,0)-r.have);
    L.push(`  ${sp(k)}: tính tới hết tuần ${cw} cần có ${cum} video, đã có hoặc đang làm ${r.have}, nên TUẦN NÀY còn phải sản xuất thêm ${tuan}; cả tháng còn cần làm ${thang}; dùng video tồn ${r.ton}, kho tồn hiện có ${r.kho}.`)});
  const byStep={};d.cards.forEach(c=>{byStep[c.step]=(byStep[c.step]||0)+1});
  L.push("THẺ VIDEO THEO TRẠNG THÁI (cả tháng): "+STEPS.map(s=>`${s.t} ${byStep[s.id]||0}`).join(", ")+".");
  d.products.forEach(p=>{const C=d.cards.filter(c=>c.sku===p.k);if(!C.length)return;L.push(`  ${p.n}: ${C.length} video đã giao việc, đã đăng ${C.filter(c=>c.step==="xong").length}, chờ đăng ${C.filter(c=>c.step==="dang").length}, đang làm ${C.filter(c=>!["xong","dang","cg"].includes(c.step)).length}, chưa giao người ${C.filter(c=>c.step==="cg").length}.`)});
  const posted=d.cards.filter(c=>c.step==="xong"&&c.day>=Wc.tu&&c.day<=Wc.den).length;
  L.push(`Đã đăng trong tuần ${cw}: ${posted} video.`);
  const late=d.cards.filter(isLate);
  L.push(`VIỆC TRỄ HẠN: ${late.length} video`+(late.length?". Ví dụ: "+late.slice(0,5).map(c=>`${sp(c.sku)} (${userName(c.giao||c.nguoi)||"chưa có người"}, ${(STEPS.find(s=>s.id===c.step)||{}).t||c.step})`).join("; "):"")+".");
  const sh=(d.shoots||[]).filter(s=>s.day>=td&&!["Đã quay","Đã hủy"].includes(s.trangThai)).sort((a,b)=>a.day-b.day).slice(0,4);
  L.push("LỊCH QUAY SẮP TỚI: "+(sh.length?sh.map(s=>`ngày ${s.day} ${s.buoi||""} tại ${s.diaDiem||"?"}`).join("; "):"chưa có buổi nào")+".");
  const rec=d.cards.filter(c=>["dang","xong"].includes(c.step)&&c.day>=td-6&&c.day<=td&&(c.view||c.don));
  const tv=sum(rec,c=>+c.view||0),td2=sum(rec,c=>+c.don||0),tg=sum(rec,c=>+c.gmv||0);
  L.push(`HIỆU QUẢ VIDEO 7 NGÀY QUA (ngày ${Math.max(1,td-6)} đến ${td}): ${rec.length} video có số liệu, tổng ${tv} view, ${td2} đơn, GMV ${Math.round(tg)}.`);
  const bySku={};rec.forEach(c=>{const o=bySku[c.sku]=bySku[c.sku]||{n:0,v:0,o:0};o.n++;o.v+=+c.view||0;o.o+=+c.don||0});
  Object.entries(bySku).forEach(([k,o])=>L.push(`  ${sp(k)}: ${o.n} video, ${o.v} view, ${o.o} đơn.`));
  rec.slice().sort((a,b)=>(+b.don||0)-(+a.don||0)).slice(0,5).forEach(c=>L.push(`  Video nhiều đơn: ${sp(c.sku)} · ${String(c.hookText||c.noiDung||c.id).slice(0,60)}: ${+c.view||0} view, ${+c.don||0} đơn.`));
  return L.join("\n").slice(0,12000)
}
async function aiSend(q){
  q=String(q||"").trim();if(!q||AI_BUSY)return;
  const it={q,a:null,err:""};AI_LOG.push(it);AI_BUSY=true;aiPaint();
  try{const r=await svApi("/api/hub/ask",{method:"POST",body:JSON.stringify({question:q,pack:aiPackMkt()})});it.a=r.text;AI_Q={limit:r.limit,left:r.left}}
  catch(e){it.err=(e&&e.message)||"Chưa hỏi được, thử lại sau.";aiQuota()}
  AI_BUSY=false;aiPaint()
}
async function aiQuota(){try{const r=await svApi("/api/hub/ask/quota");AI_Q={limit:r.limit,left:r.left};aiPaint()}catch(e){}}
const aiFmt=s=>esc(String(s)).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>");
function aiPaint(){
  const p=document.getElementById("aipanel");if(!p)return;
  p.className="aipanel"+(AI_OPEN?" on":"");
  p.innerHTML=`<div class="aih"><b>Hỏi AI</b><button type="button" class="lnk" id="aix">✕</button></div>
   <div class="aib" id="aibody">${AI_LOG.length?AI_LOG.map(m=>`<div class="aiq">${esc(m.q)}</div><div class="aia${m.err?" err":""}">${m.err?esc(m.err):m.a==null?"Đang trả lời, có thể mất tới 1 phút…":aiFmt(m.a)}</div>`).join(""):`<p class="hint">Hỏi bằng lời thường về số liệu Marketing, ví dụ:</p>${AI_SUG.map(s=>`<button type="button" class="aisug" data-aisug="${esc(s)}">${esc(s)}</button>`).join("")}`}</div>
   <form class="aif" id="aiform"><input id="aiq" placeholder="Gõ câu hỏi rồi Enter…" maxlength="300" autocomplete="off" ${AI_BUSY?"disabled":""}><button class="btn pri" ${AI_BUSY?"disabled":""}>Gửi</button></form>`;
  const bd=document.getElementById("aibody");if(bd)bd.scrollTop=bd.scrollHeight;
  document.getElementById("aix").onclick=()=>{AI_OPEN=false;aiPaint()};
  document.getElementById("aiform").onsubmit=e=>{e.preventDefault();const i=document.getElementById("aiq"),v=i.value;i.value="";aiSend(v)};
  p.querySelectorAll("[data-aisug]").forEach(b=>b.onclick=()=>aiSend(b.dataset.aisug));
  if(AI_OPEN&&!AI_BUSY){const i=document.getElementById("aiq");if(i&&document.activeElement!==i&&!document.activeElement.matches("input,textarea,select"))i.focus()}
}
function aiEnsure(){
  if(typeof ME==="undefined"||!ME||!document.body)return;
  if(document.getElementById("aibtn"))return;
  const b=document.createElement("button");b.id="aibtn";b.type="button";b.className="aibtn";b.innerHTML="💬 Hỏi AI";
  const p=document.createElement("div");p.id="aipanel";p.className="aipanel";
  b.onclick=()=>{AI_OPEN=!AI_OPEN;if(AI_OPEN&&!AI_Q)aiQuota();aiPaint()};
  document.body.appendChild(p);document.body.appendChild(b);aiPaint()
}
setInterval(()=>{try{aiEnsure()}catch(e){}},1500);

/* Tab đang mở là bản cũ thì nhắc tải lại (mỗi lần cập nhật web có một mã bản) */
setInterval(async()=>{try{if(document.hidden||document.getElementById("newver"))return;const t=await fetch(location.pathname,{cache:"no-store",credentials:"same-origin"}).then(r=>r.text()),m=t.match(/const BUILD_ID="(\d+)"/);if(m&&m[1]!==BUILD_ID){const d=document.createElement("div");d.id="newver";d.className="newver";d.innerHTML="Có bản web mới <button type=\"button\">Tải lại ngay</button>";d.querySelector("button").onclick=()=>location.reload();document.body.appendChild(d)}}catch(e){}},60000);
