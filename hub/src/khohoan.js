/* Hàng hoàn các sàn: quét mã vận đơn (máy tít = bàn phím + Enter) → web tự biết kênh, đơn, món phải về →
   kiểm số về thực tế / hỏng → Nhập kho (mỗi kênh một phiếu nhập hàng hoàn) → đối soát, cảnh báo, khiếu nại. */
const RET={tab:"scan",day:"",scans:null,recon:null,busy:false,imp:"",impDay:""};
const RET_CH={TIKTOK:"TikTok",SHOPEE:"Shopee",FACEBOOK:"Facebook"};
const RET_PB=[["","Bình thường"],["THIEU","Thiếu hàng"],["HONG","Hỏng"],["SAI","Sai hàng"],["KHAC","Khác"]];
const RET_CL=[["","—"],["CAN","Cần khiếu nại (chưa gửi)"],["DA_GUI","Đã gửi khiếu nại"],["DUYET","Sàn duyệt đền"],["TU_CHOI","Sàn từ chối"],["XONG","Đã nhận tiền"],["TU_CHIU","Tự chịu (không khiếu nại)"]];
RET.open=new Set();RET.act={};
function retToday(){return new Date(Date.now()+7*3600e3).toISOString().slice(0,10)}
function retBeep(ok){try{const a=new (window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g=a.createGain();o.frequency.value=ok?1200:220;o.type=ok?"sine":"square";g.gain.value=.08;o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+(ok?.12:.45))}catch(e){}}
function retTime(s){return s?new Date(Date.parse(s)+7*3600e3).toISOString().slice(11,19):""}
async function retLoadScans(){RET.busy=true;try{RET.scans=await kApi("/ret/scans?day="+(RET.day||retToday()));RET.files=await kApi("/ret/files?day="+(RET.day||retToday())).catch(()=>[])}catch(e){toast(e.message);RET.scans={scans:[]}}RET.busy=false;if(PAGE==="kho_hoan")renderMain()}
async function retLoadRecon(){try{RET.recon=await kApi("/ret/recon")}catch(e){toast(e.message);RET.recon={summary:[],waiting:[],claims:[]}}if(PAGE==="kho_hoan")renderMain()}
function retTag(ch){return ch?`<span class="tag">${RET_CH[ch]||ch}</span>`:`<span class="tag amb">Không rõ kênh</span>`}
function retIssues(s){return (s.issues||[]).map(x=>`<span class="tag amb">${esc(x)}</span>`).join(" ")}

/* Nhập gộp hàng của các gói chưa tra ra đơn: chỉ sản phẩm + số lượng, không chia từng gói. */
function retBulkCard(list){
  const unk=list.filter(s=>!s.order_id&&s.source!=="BULK"&&s.state==="CHO");
  const done=list.filter(s=>s.source==="BULK");
  if(!unk.length&&!done.length)return "";
  RET.bk=RET.bk||{ch:"TIKTOK",rows:[]};const B=RET.bk;
  const rows=B.rows.map((r,i)=>`<tr><td><input class="rb-i" data-i="${i}" value="${esc(r.code?r.code+" - "+r.name:"")}" data-code="${esc(r.code||"")}" placeholder="Gõ mã hoặc tên sản phẩm" style="min-width:260px"></td><td><input class="rb-q n" data-i="${i}" type="number" min="0" step="1" value="${r.qty}" style="width:80px"></td><td><input class="rb-b n" data-i="${i}" type="number" min="0" step="1" value="${r.bad}" style="width:80px"></td><td><button class="btn sm rb-x" data-i="${i}">×</button></td></tr>`).join("");
  return `<section class="card"><div class="card-h"><h2>Nhập gộp hàng của các gói chưa tra ra đơn${unk.length?" ("+unk.length+" gói)":""}</h2></div>
   <p class="hint">Không cần chia từng gói: ghi tổng sản phẩm và số lượng bóc ra từ các gói chưa tra ra đơn (theo phần 3 của phiếu kiểm). Bấm Nhập kho thì các gói này coi như đã nhận, hết cảnh báo.${done.length?" Đã lưu gộp: "+done.map(s=>RET_CH[s.channel]+" "+(s.items||[]).reduce((a,i)=>a+(+i.received||0),0)+" sản phẩm").join(", ")+".":""}</p>
   <div class="filters"><label class="inl">Kênh <select id="rb-ch">${Object.entries(RET_CH).map(([v,t])=>`<option value="${v}"${B.ch===v?" selected":""}>${t}</option>`).join("")}</select></label></div>
   <table class="tbl"><thead><tr><th>Sản phẩm</th><th class="n">Số lượng</th><th class="n">Trong đó hỏng</th><th></th></tr></thead><tbody>${rows}</tbody></table>
   <div class="filters"><button class="btn sm" id="rb-add">+ Thêm sản phẩm</button> <button class="btn pri" id="rb-save">Lưu gộp</button></div></section>`;
}
/* Phiếu nhập hoàn của ngày: gộp theo sản phẩm từ các gói đã quét; kế toán nhập số thực nhập, web báo chênh. */
function retTicket(list){
  const by=new Map();
  list.filter(s=>s.state==="CHO"&&s.channel).forEach(s=>(s.items||[]).forEach(it=>{
    if(!it.mapped)return;
    const x=by.get(it.item)||{code:it.item,name:it.name,exp:0,abn:0,ok:0};
    if(s.order_id&&s.source!=="BULK"){x.exp+=+it.expected||0;x.abn+=Math.max(0,(+it.expected||0)-(+it.good||0))}
    x.ok+=+it.good||0;by.set(it.item,x)}));
  return [...by.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name)));
}
function retTicketCard(list,day){
  const T=retTicket(list),cho=list.filter(s=>s.state==="CHO"&&s.channel);
  if(!cho.length)return "";
  const val=x=>RET.act[x.code]!==undefined?RET.act[x.code]:x.ok;
  const diff=x=>val(x)-x.ok;
  const row=x=>`<tr><td class="mono">${esc(x.code)}</td><td>${esc(x.name)}</td><td class="n">${knum(x.exp)}</td><td class="n">${x.abn?`<b style="color:#c2410c">${knum(x.abn)}</b>`:"0"}</td><td class="n"><b>${knum(x.ok)}</b></td><td class="n"><input class="rt-act n" data-i="${esc(x.code)}" type="number" min="0" step="1" value="${val(x)}" style="width:80px"></td><td class="n">${diff(x)?`<span class="tag amb">${diff(x)>0?"+":""}${knum(diff(x))}</span>`:`<span class="tag">Khớp</span>`}</td></tr>`;
  const bad=T.filter(x=>diff(x)!==0).length;
  return `<section class="card flush"><div class="card-h pad"><h2>Phiếu nhập hoàn ngày ${kDd(day)}</h2><div class="filters"><button class="btn pri" id="rt-recv">Nhập kho</button></div></div>
   <p class="hint pad">Web gộp sẵn theo sản phẩm từ ${cho.length} gói đã quét: <b>Hàng ổn</b> = dự kiến trừ phần bất thường (thiếu / hỏng) đã khai. Kế toán nhập <b>Thực nhập</b> sau khi bóc đếm; lệch thì hiện chênh. Tồn kho tăng đúng số thực nhập. Món thiếu thì không cộng tồn (khiếu nại sàn để lấy lại tiền; đơn Facebook tự chịu).${bad?` <b style="color:#c2410c">Đang có ${bad} sản phẩm lệch so với dự kiến.</b>`:""}</p>
   ${T.length?`<div style="overflow:auto"><table class="tbl"><thead><tr><th>Mã MISA</th><th>Sản phẩm</th><th class="n">Dự kiến theo đơn</th><th class="n">Bất thường</th><th class="n">Hàng ổn</th><th class="n">Thực nhập</th><th class="n">Chênh</th></tr></thead><tbody>${T.map(row).join("")}</tbody></table></div>`:`<p class="hint pad">Chưa có sản phẩm nào có mã MISA trong các gói đã quét.</p>`}</section>`;
}
function retScanTab(){
  const S=RET.scans,list=(S&&S.scans)||[],day=RET.day||retToday(),cho=list.filter(s=>s.state==="CHO"&&s.channel);
  const cnt=ch=>list.filter(s=>s.channel===ch).length,unk=list.filter(s=>!s.channel).length;
  const card=s=>{const lock=s.state!=="CHO";const full=lock||RET.open.has(s.id)||!s.order_id||(s.issues||[]).length||s.problem;return `<tr style="border-top:2px solid #e5e7eb"><td style="white-space:nowrap">${retTime(s.scanned_at)}</td><td>${!s.channel&&!lock?`<select class="rt-ch" data-s="${s.id}"><option value="">Chưa rõ sàn…</option>${Object.entries(RET_CH).map(([v,t])=>`<option value="${v}">${t}</option>`).join("")}</select><div class="hint">Báo kế toán xác nhận sàn</div>`:retTag(s.channel)}</td><td><b class="mono">${esc(s.code)}</b>${s.order_id?`<br><span class="hint">Đơn ${esc(s.order_id)}${s.order&&s.order.shop?" · "+esc(s.order.shop):""}</span>`:""}</td>
    <td>${!full?`<span class="hint">${(s.items||[]).length} món · về đủ</span> <button class="btn sm rt-o" data-s="${s.id}">Báo lỗi</button>`:(s.items||[]).length?`<table class="tbl" style="margin:0"><thead><tr><th>Mã MISA</th><th>Tên sản phẩm</th><th class="n">Phải về</th><th class="n">Về thực tế</th><th class="n">Hỏng</th></tr></thead><tbody>${s.items.map((it,j)=>`<tr><td class="mono">${it.mapped?esc(it.item):"<span class='hint'>—</span>"}</td><td>${esc(it.name)}${it.mapped?"":" <span class='tag amb'>chưa có mã MISA</span>"}</td><td class="n">${knum(it.expected)}</td><td class="n">${lock?knum(it.received):`<input class="rt-r n" data-s="${s.id}" data-j="${j}" type="number" min="0" step="any" value="${it.received}" style="width:64px">`}</td><td class="n">${lock?knum(it.bad):`<input class="rt-b n" data-s="${s.id}" data-j="${j}" type="number" min="0" step="any" value="${it.bad}" style="width:64px">`}</td></tr>`).join("")}</tbody></table>`:""}${!s.order_id&&!lock&&s.source!=="BULK"?`<div style="display:flex;gap:6px;align-items:center"><span class="hint" style="white-space:nowrap">Chưa tra ra đơn ·</span><input class="rt-lk" data-s="${s.id}" placeholder="Mã đơn / mã vận đơn gốc (nếu có)" style="flex:1;min-width:0;height:30px"><button class="btn sm rt-lkb" data-s="${s.id}">Tra</button></div>`:""}</td>
    <td>${lock?`<span class="tag">Đã nhập kho</span>`:`<select class="rt-p" data-s="${s.id}" style="min-width:150px">${RET_PB.map(([k,t])=>`<option value="${k}"${s.problem===k?" selected":""}>${t}</option>`).join("")}</select>`}<div style="margin-top:4px">${retIssues(s)}</div></td>
    <td>${lock?"":`<button class="btn sm rt-x" data-s="${s.id}" title="Quét nhầm, bỏ gói này">×</button>`}</td></tr>`};
  return `<section class="card"><div class="card-h"><h2>Quét mã vận đơn</h2><div class="filters"><label class="inl" style="display:inline-flex;align-items:center;gap:8px;margin:0">Ngày nhận <input type="date" id="rt-day" value="${day}"></label></div></div>
    <input id="rt-code" autocomplete="off" placeholder="Đặt con trỏ ở đây rồi quét (nhớ tắt Unikey: chữ E)" style="width:100%;font-size:20px;padding:12px">
    <p class="hint">Quét liên tục, gói nào cũng quét vào ô này, web tự nhận TikTok / Shopee / Facebook. Gói bình thường không cần khai gì. Bóc hàng thấy thiếu, hỏng hoặc sai thì bấm <b>Báo lỗi</b> ở gói đó. Gói có vấn đề tự vào tab Khiếu nại (đơn Facebook ghi là tự chịu). Cuối ngày kế toán nhập <b>phiếu nhập hoàn</b> ở bảng bên dưới.</p></section>
   <div class="grid kpis">${kpi("Đã quét",knum(list.length))}${kpi("TikTok",knum(cnt("TIKTOK")))}${kpi("Shopee",knum(cnt("SHOPEE")))}${kpi("Facebook",knum(cnt("FACEBOOK")))}${kpi("Không rõ kênh",knum(unk))}</div>
   <section class="card flush"><div class="card-h pad"><h2>Gói đã quét ngày ${kDd(day)}</h2><div class="filters"></div></div>
    ${(RET.files||[]).length?`<div class="pad" style="padding-top:0"><span class="hint">Ảnh phiếu kiểm đã tải:</span> ${RET.files.map((f,i)=>`<a href="/api/hub/kho/ret/files/${f.id}" target="_blank" rel="noopener">Ảnh ${i+1}</a>`).join(" · ")}</div>`:""}
    ${RET.busy&&!list.length?`<p class="hint pad">Đang tải…</p>`:list.length?`<div style="overflow:auto"><table class="tbl"><thead><tr><th>Giờ quét</th><th>Kênh</th><th>Mã vận đơn</th><th>Hàng trong gói</th><th>Tình trạng</th><th></th></tr></thead><tbody>${list.map(card).join("")}</tbody></table></div>`:`<p class="hint pad">Chưa quét gói nào.</p>`}</section>`+retBulkCard(list)+retTicketCard(list,day);
}

function retReconTab(){
  const R=RET.recon;if(!R)return `<p class="hint">Đang tải…</p>`;
  const sum=R.summary||[],all=R.waiting||[],w=all.filter(o=>!RET.wch||o.channel===RET.wch).sort((a,b)=>(!!b.overdue)-(!!a.overdue));
  const wf=`<div class="filters">${[["","Tất cả"],["TIKTOK","TikTok"],["SHOPEE","Shopee"],["FACEBOOK","Facebook"]].map(([v,t])=>`<button class="btn sm${(RET.wch||"")===v?" pri":""}" data-wch="${v}">${t} (${v?all.filter(o=>o.channel===v).length:all.length})</button>`).join(" ")}</div>`;
  const st=s=>s===4?"Đang hoàn":s===5?"Đã hoàn":s===15?"Hoàn một phần":String(s);
  return `<section class="card flush"><div class="card-h pad"><h2>Đối soát theo kênh</h2><div class="filters"><button class="btn sm" id="rt-sync">Kéo lại đơn hoàn từ Poscake (7 ngày)</button><button class="btn sm" id="rt-rematch">Gắn lại mã chưa khớp</button></div></div>
    ${tbl(["Kênh","Đang hoàn (chưa về)","Sàn báo đã hoàn, kho chưa quét","⚠ Quá hạn","Kho đã quét","Chờ nhập kho","Khiếu nại đang mở","Thiếu","Hỏng","Tự chịu (thiếu + hỏng)","Tiền sàn đền"],sum.map(s=>`<tr><td><b>${RET_CH[s.channel]}</b></td><td class="n">${knum(s.returning)}</td><td class="n">${knum(s.returned_not_scanned)}</td><td class="n">${s.overdue?`<b style="color:#c2410c">${knum(s.overdue)}</b>`:"0"}</td><td class="n">${knum(s.scanned)}</td><td class="n">${knum(s.waiting_receive)}</td><td class="n">${knum(s.claims)}</td><td class="n">${knum(s.missing||0)}</td><td class="n">${knum(s.bad||0)}</td><td class="n">${knum(s.self_loss||0)}</td><td class="n">${knum(s.claim_paid||0)}</td></tr>`))}
    ${R.unknown_scans?`<p class="hint pad">Có <b>${R.unknown_scans}</b> mã đã quét chưa khớp đơn hoàn nào (xem ở tab Khiếu nại).</p>`:""}
    <p class="hint pad">Quá hạn: sàn báo đã hoàn quá ${R.rules?R.rules.returned_days:3} ngày mà kho chưa quét, hoặc đang hoàn quá ${R.rules?R.rules.returning_days:20} ngày, nghi thất lạc, cần hỏi đơn vị vận chuyển.</p></section>
   ${(R.poscake_lag||[]).length?`<section class="card flush"><div class="card-h pad"><h2>Kho đã nhận, Poscake còn ghi “Đang hoàn” (${R.poscake_lag.length})</h2></div><p class="hint pad">Hàng đã về và đã quét (web tính là đã hoàn về). Nhờ nhân sự cập nhật trạng thái các đơn này trên Poscake cho khớp.</p><div style="overflow:auto">${tbl(["Kênh","Mã vận đơn","Mã đơn","Nguồn / shop","Ngày quét"],R.poscake_lag.map(o=>`<tr><td>${RET_CH[o.channel]||o.channel}</td><td class="mono">${esc(o.code)}</td><td class="mono">${esc(o.order_id)}</td><td>${esc(o.shop||"")}</td><td>${kDd(o.scan_day)}</td></tr>`))}</div></section>`:""}
   <section class="card flush"><div class="card-h pad"><h2>Đơn hoàn chưa về kho (${w.length})</h2>${wf}</div>
    ${w.length?`<div style="overflow:auto">${tbl(["Kênh","Mã vận đơn","Mã đơn","Shop","Trạng thái Poscake","Từ ngày","Cảnh báo"],w.map(o=>`<tr${o.overdue?' style="background:#fff4e0"':""}><td>${RET_CH[o.channel]||o.channel}</td><td class="mono">${esc(o.tracking||"—")}</td><td class="mono">${esc(o.order_id)}</td><td>${esc(o.shop||"")}</td><td>${st(o.status)}</td><td>${kDd(String(o.returned_at||o.returning_at||"").slice(0,10))}</td><td>${o.overdue?`<b>${esc(o.overdue)}</b>`:""}</td></tr>`))}</div>`:`<p class="hint pad">Không còn đơn hoàn nào chưa về.</p>`}</section>
   <details class="card"><summary><b>Nạp mã đã quét trước đây (từ file Sheet “Đơn hoàn các sàn”)</b></summary>
    <p class="hint">Mở tab ngày trong file, bôi đen 3 cột đơn tiktok / đơn shopee / đơn fb, copy, dán vào ô dưới, chọn đúng ngày rồi bấm Nạp. Web tự nhận kênh; mã trùng bỏ qua. Các gói nạp vào nằm ở tab Quét của ngày đó, chờ bấm Nhập kho.</p>
    <div class="filters"><label class="inl">Ngày <input type="date" id="rt-imp-day" value="${RET.impDay||""}"></label></div>
    <textarea id="rt-imp" rows="5" style="width:100%" placeholder="Dán các mã vận đơn vào đây">${esc(RET.imp||"")}</textarea>
    <div class="filters"><button class="btn pri" id="rt-imp-go">Nạp</button></div></details>`;
}

async function retLoadUnm(){RET.unmBusy=true;try{RET.unm=await kApi("/ret/unmatched")}catch(e){toast(e.message);RET.unm=[]}RET.unmBusy=false;if(PAGE==="kho_hoan")renderMain()}
/* Gói chưa tra ra đơn: kế toán tra mã vận đơn trên seller (Shopee / TikTok / Facebook) rồi điền mã đơn vào đây. */
function retUnmTab(){
  const L=RET.unm;if(!L)return `<p class="hint">Đang tải…</p>`;
  const rows=L.map(s=>`<tr><td style="white-space:nowrap">${kDd(s.scan_day)}</td><td class="mono"><b>${esc(s.code)}</b></td>
    <td><select class="un-ch" data-s="${s.id}"><option value="">Chưa rõ sàn</option>${Object.entries(RET_CH).map(([v,t])=>`<option value="${v}"${s.channel===v?" selected":""}>${t}</option>`).join("")}</select></td>
    <td><input class="un-ref mono" data-s="${s.id}" value="${esc(s.order_ref||"")}" placeholder="Mã đơn tra được trên seller" style="min-width:230px"></td>
    <td>${s.order_ref?`<span class="tag amb">Đã điền, chờ Poscake có đơn</span>`:`<span class="tag">Chưa tra</span>`}</td>
    <td><button class="btn sm pri un-save" data-s="${s.id}">Lưu</button></td></tr>`).join("");
  return `<section class="card flush"><div class="card-h pad"><h2>Gói chưa tra ra đơn (${L.length})</h2><div class="filters"><button class="btn sm" id="rt-sync">Kéo lại đơn hoàn từ Poscake (7 ngày)</button><button class="btn sm" id="rt-rematch">Gắn lại mã chưa khớp</button></div></div>
   <p class="hint pad">Mã vận đơn của các gói này chưa có trong danh sách đơn hoàn của Poscake. Kế toán mở <b>seller</b> của sàn, tra mã vận đơn để lấy <b>mã đơn</b>, rồi điền vào cột “Mã đơn”. Đơn đã có trên Poscake thì web gắn luôn và hiện các món phải về; chưa có thì web nhớ mã, tự gắn khi Poscake cập nhật. Đơn không nằm trong danh sách hoàn nào thì bên Quét hàng hoàn dùng Nhập gộp để cộng hàng.</p>
   ${L.length?`<div style="overflow:auto">${tbl(["Ngày quét","Mã vận đơn","Sàn","Mã đơn","Tình trạng",""],[rows])}</div>`:`<p class="hint pad">Không còn gói nào chưa tra ra đơn.</p>`}</section>`;
}
function retClaimTab(){
  const R=RET.recon;if(!R)return `<p class="hint">Đang tải…</p>`;
  const all=(R.claims||[]),c=all.filter(s=>s.claim),unk=all.filter(s=>!s.claim);
  const head=["Ngày quét","Kênh","Mã vận đơn","Vấn đề","Link video","Tình trạng","Tiền sàn đền (đ)","Ghi chú"];
  const unkCard="";
  return `<section class="card flush"><div class="card-h pad"><h2>Gói cần khiếu nại (${c.length})</h2></div>
   <p class="hint pad">Gói về thiếu, hỏng, sai hàng tự vào đây. Khiếu nại sàn là để lấy lại <b>tiền</b> (hàng thiếu không về nữa): cập nhật tình trạng và ghi tiền sàn đền. Đơn Facebook không khiếu nại được nên ghi “Tự chịu”.</p>
   ${c.length?`<div style="overflow:auto">${tbl(head,c.map(s=>`<tr><td>${kDd(s.scan_day)} ${retTime(s.scanned_at)}</td><td>${retTag(s.channel)}</td><td class="mono">${esc(s.code)}${s.order_id?`<br><span class="hint">Đơn ${esc(s.order_id)}</span>`:""}</td><td>${retIssues(s)}</td>
     <td><input class="rt-v" data-s="${s.id}" value="${esc(s.video_url||"")}" placeholder="https://drive…" style="min-width:200px">${s.video_url?` <a href="${esc(s.video_url)}" target="_blank" rel="noopener">Mở</a>`:""}</td>
     <td><select class="rt-c" data-s="${s.id}">${RET_CL.map(([k,t])=>`<option value="${k}"${s.claim===k?" selected":""}>${t}</option>`).join("")}</select></td>
     <td>${s.channel==="FACEBOOK"?`<span class="hint">—</span>`:`<input class="rt-a n" data-s="${s.id}" type="number" min="0" step="1" value="${s.claim_amount||0}" style="width:110px">`}</td>
     <td><input class="rt-n" data-s="${s.id}" value="${esc(s.note||"")}" style="min-width:160px"></td></tr>`))}</div>`:`<p class="hint pad">Chưa có gói nào cần khiếu nại.</p>`}</section>`+unkCard;
}

function pKhoHoan(m){
  const T=[["scan","Quét hàng hoàn"],["unm","Chưa tra ra đơn"],["recon","Đối soát"],["claim","Khiếu nại"],["docs","Phiếu đã nhập"]];
  const nav=`<nav class="settabs">${T.map(([k,t])=>`<button class="${k===RET.tab?"on":""}" data-rt="${k}">${t}${k==="unm"&&RET.unm&&RET.unm.length?" ("+RET.unm.length+")":""}${k==="claim"&&RET.recon&&RET.recon.claims&&RET.recon.claims.filter(c=>c.claim).length?" ("+RET.recon.claims.filter(c=>c.claim).length+")":""}</button>`).join("")}</nav>`;
  if(RET.tab==="docs"){pKhoDocs(m,"TL");const s=m.querySelector("nav.kgsub")||m.querySelector("nav.settabs");if(s)s.insertAdjacentHTML("afterend",nav);retBind(m);return}
  if(RET.tab==="scan"&&!RET.scans&&!RET.busy)retLoadScans();
  if(RET.tab!=="scan"&&!RET.recon)retLoadRecon();
  if(!RET.recon&&RET.tab==="scan")retLoadRecon();
  if(!RET.unm&&!RET.unmBusy)retLoadUnm();
  const body=RET.tab==="scan"?retScanTab():RET.tab==="recon"?retReconTab():RET.tab==="unm"?retUnmTab():retClaimTab();
  khoFrame(m,"kho_hoan","Hàng hoàn các sàn","Quét mã vận đơn gói hoàn TikTok, Shopee, Facebook; web tự nhận kênh, tự lập phiếu nhập hàng hoàn, đối soát và cảnh báo thất lạc.",nav+body);
  retBind(m);
  const inp=$("#rt-code");if(inp){inp.value=RET.keep||"";RET.keep="";setTimeout(()=>inp.focus({preventScroll:true}),0)}
}

/* Phiếu kiểm hàng hoàn để in: mỗi gói các món phải về, chừa cột Thực nhận / Hỏng / Ghi chú để kho tích tay. */
/* Thu nhỏ ảnh chụp điện thoại (thường 3–5 MB) xuống dưới 1,5 MB trước khi tải lên. */
async function retShrink(f){if(!f.type.startsWith("image/")||f.size<1400000)return f;const img=await createImageBitmap(f);const s=Math.min(1,2000/Math.max(img.width,img.height));const cv=document.createElement("canvas");cv.width=Math.round(img.width*s);cv.height=Math.round(img.height*s);cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);const b=await new Promise(r=>cv.toBlob(r,"image/jpeg",0.8));return new File([b],f.name.replace(/.w+$/,"")+".jpg",{type:"image/jpeg"})}
function retPrint(){
  const day=RET.day||retToday(),L=((RET.scans&&RET.scans.scans)||[]).slice().reverse();
  const known=L.filter(s=>s.order_id),unk=L.filter(s=>!s.order_id);
  /* Phần 1: cộng theo sản phẩm của các gói đã tra ra đơn — gói đủ thì chỉ cần đối chiếu tổng này. */
  const by=new Map();known.forEach(s=>(s.items||[]).forEach(it=>{const k=it.mapped?it.item:it.name;const x=by.get(k)||{code:it.mapped?it.item:"",name:it.name||"",qty:0};x.qty+=+it.expected||0;by.set(k,x)}));
  const sum=[...by.values()].sort((a,b)=>a.name.localeCompare(b.name));
  const tSum=sum.map((x,i)=>`<tr><td class="c">${i+1}</td><td class="m">${esc(x.code)}</td><td>${esc(x.name)}</td><td class="c"><b>${knum(x.qty)}</b></td><td></td></tr>`).join("");
  const blank=(n,cols)=>Array.from({length:n},()=>`<tr>${"<td>&nbsp;</td>".repeat(cols)}</tr>`).join("");
  const tUnk=unk.map((s,i)=>`<tr><td class="c">${i+1}</td><td class="m">${esc(s.code)}</td><td>${esc(RET_CH[s.channel]||"")}</td><td></td><td></td><td></td></tr>`+`<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join("");
  const w=window.open("","_blank");if(!w){toast("Trình duyệt chặn cửa sổ in, cho phép bật cửa sổ rồi bấm lại");return}
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Phiếu kiểm hàng hoàn ${kDd(day)}</title><style>body{font:12px Arial,sans-serif;margin:16px}h1{font-size:16px;margin:0 0 4px}h2{font-size:13px;margin:16px 0 4px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #444;padding:5px;vertical-align:top}th{background:#eee}.c{text-align:center}.m{font-family:monospace}.sig{display:flex;justify-content:space-between;margin-top:28px}.hint{color:#555}@media print{button{display:none}}</style></head><body>
  <h1>PHIẾU KIỂM HÀNG HOÀN · ngày ${kDd(day)}</h1>
  <div>Đã quét ${L.length} gói: ${known.length} gói tra ra đơn, ${unk.length} gói chưa tra ra đơn.</div>
  <h2>1. Tổng sản phẩm phải về (các gói đã tra ra đơn)</h2>
  <div class="hint">Gói đủ, nguyên vẹn thì không cần ghi gì. Chỉ đếm tổng; lệch thì ghi ở cột Thực nhận.</div>
  <table><thead><tr><th style="width:28px">#</th><th style="width:150px">Mã MISA</th><th>Sản phẩm</th><th style="width:70px">Phải về</th><th style="width:80px">Thực nhận</th></tr></thead><tbody>${tSum||'<tr><td colspan="5" class="c">Không có</td></tr>'}</tbody></table>
  <h2>2. Gói có vấn đề (thiếu / hỏng / sai hàng) · ghi lại để khiếu nại, nhớ quay video</h2>
  <table><thead><tr><th style="width:170px">Mã vận đơn</th><th style="width:70px">Thiếu / Hỏng / Sai</th><th>Sản phẩm</th><th style="width:50px">SL</th><th>Ghi chú</th></tr></thead><tbody>${blank(8,5)}</tbody></table>
  <h2>3. Gói chưa tra ra đơn · ghi các món có trong gói</h2>
  <table><thead><tr><th style="width:28px">#</th><th style="width:150px">Mã vận đơn</th><th style="width:60px">Kênh</th><th>Sản phẩm trong gói</th><th style="width:50px">SL</th><th>Ghi chú (mã đơn gốc nếu có)</th></tr></thead><tbody>${tUnk||'<tr><td colspan="6" class="c">Không có</td></tr>'}</tbody></table>
  <div class="sig"><div>Người kiểm hàng<br><br><br>(ký, ghi rõ họ tên)</div><div>Kế toán kho<br><br><br>(ký, ghi rõ họ tên)</div></div>
  <br><button onclick="print()">In</button></body></html>`);
  w.document.close();setTimeout(()=>{try{w.print()}catch(e){}},300);
}
function retBindBulk(m){
  const B=RET.bk;if(!B)return;
  if($("#rb-ch"))$("#rb-ch").onchange=e=>{B.ch=e.target.value};
  if($("#rb-add"))$("#rb-add").onclick=()=>{B.rows.push({code:"",name:"",qty:1,bad:0});renderMain()};
  m.querySelectorAll(".rb-x").forEach(b=>b.onclick=()=>{B.rows.splice(+b.dataset.i,1);renderMain()});
  m.querySelectorAll(".rb-q").forEach(x=>x.onchange=()=>{B.rows[+x.dataset.i].qty=+x.value||0});
  m.querySelectorAll(".rb-b").forEach(x=>x.onchange=()=>{B.rows[+x.dataset.i].bad=+x.value||0});
  m.querySelectorAll(".rb-i").forEach(x=>khoPick(x,null,it=>{const r=B.rows[+x.dataset.i];r.code=it.code;r.name=it.name;x.value=it.code+" - "+it.name}));
  if($("#rb-save"))$("#rb-save").onclick=async()=>{const items=B.rows.filter(r=>r.code&&r.qty>0).map(r=>({item:r.code,received:r.qty,bad:r.bad}));if(!items.length){toast("Chọn sản phẩm và số lượng");return}
    try{await kApi("/ret/bulk",{method:"POST",body:JSON.stringify({day:RET.day||retToday(),channel:B.ch,items})});toast("Đã lưu gộp "+items.length+" sản phẩm. Bấm Nhập kho để cộng tồn.");B.rows=[];RET.scans=null;renderMain()}catch(e){toast(e.message)}};
}
function retBind(m){
  retBindBulk(m);
  if($("#rt-print"))$("#rt-print").onclick=retPrint;
  if($("#rt-sheet"))$("#rt-sheet").onchange=async e=>{const fs=[...e.target.files];if(!fs.length)return;const day=RET.day||retToday();let ok=0;
    for(const f0 of fs){const f=await retShrink(f0);try{const fd=new FormData();fd.set("day",day);fd.set("file",f,f.name);const r=await fetch("/api/hub/kho/ret/files",{method:"POST",body:fd,credentials:"same-origin"});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error((j.error&&j.error.message)||"Lỗi "+r.status);ok++}catch(err){toast(f.name+": "+err.message)}}
    if(ok)toast("Đã tải "+ok+" ảnh phiếu kiểm. Giờ nhập số thực nhận / hỏng của từng gói ở bảng dưới.");RET.scans=null;renderMain()};
  m.querySelectorAll("[data-wch]").forEach(b=>b.onclick=()=>{RET.wch=b.dataset.wch;renderMain()});
  m.querySelectorAll("[data-rt]").forEach(b=>b.onclick=()=>{RET.tab=b.dataset.rt;if(RET.tab!=="scan")RET.recon=null;renderMain()});
  const inp=$("#rt-code");
  if(inp)inp.onkeydown=async e=>{if(e.key!=="Enter")return;e.preventDefault();const code=inp.value.trim();inp.value="";if(!code)return;
    try{const s=await kApi("/ret/scan",{method:"POST",body:JSON.stringify({code,day:RET.day||retToday()})});retBeep(!!s.channel);
      RET.scans=RET.scans||{scans:[]};RET.scans.scans=[s].concat(RET.scans.scans||[]);RET.keep=($("#rt-code")||{}).value||"";renderMain();if(!s.channel)toast("Không tra được đơn hoàn cho mã "+code)}
    catch(err){retBeep(false);toast(err.message)}};
  if($("#rt-day"))$("#rt-day").onchange=()=>{RET.day=$("#rt-day").value;RET.scans=null;renderMain()};
  const find=id=>((RET.scans&&RET.scans.scans)||[]).find(s=>String(s.id)===String(id));
  const save=async(id,patch)=>{try{const s=await kApi("/ret/scans/"+id,{method:"PUT",body:JSON.stringify(patch)});const L=(RET.scans&&RET.scans.scans)||[];const i=L.findIndex(x=>x.id===s.id);if(i>=0)L[i]=s;if(RET.recon)RET.recon=null;renderMain()}catch(e){toast(e.message)}};
  m.querySelectorAll(".rt-r,.rt-b").forEach(x=>x.onchange=()=>{const s=find(x.dataset.s);if(!s)return;const items=s.items.map((it,j)=>{const r=m.querySelector(`.rt-r[data-s="${s.id}"][data-j="${j}"]`),b=m.querySelector(`.rt-b[data-s="${s.id}"][data-j="${j}"]`);return {item:it.item,name:it.name,received:+(r?r.value:it.received)||0,bad:+(b?b.value:it.bad)||0}});save(s.id,{items})});
  m.querySelectorAll(".rt-p").forEach(x=>x.onchange=()=>save(x.dataset.s,{problem:x.value}));
  const link=async id=>{const inp=m.querySelector('.rt-lk[data-s="'+id+'"]');const code=inp&&inp.value.trim();if(!code){toast("Gõ mã đơn hoặc mã vận đơn gốc");return}try{const s=await kApi("/ret/scans/"+id+"/link",{method:"POST",body:JSON.stringify({code})});retBeep(true);const L=(RET.scans&&RET.scans.scans)||[];const i=L.findIndex(x=>x.id===s.id);if(i>=0)L[i]=s;toast("Đã gắn vào đơn "+s.order_id);renderMain()}catch(e){retBeep(false);toast(e.message)}};
  m.querySelectorAll(".rt-lkb").forEach(b=>b.onclick=()=>link(b.dataset.s));
  m.querySelectorAll(".rt-lk").forEach(x=>x.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();link(x.dataset.s)}});
  m.querySelectorAll(".rt-ch").forEach(x=>x.onchange=()=>save(x.dataset.s,{channel:x.value}));
  m.querySelectorAll(".rt-mi").forEach(x=>khoPick(x,null,()=>{}));
  m.querySelectorAll(".rt-ma").forEach(b=>b.onclick=()=>{const s=find(b.dataset.s);if(!s)return;const inp=m.querySelector('.rt-mi[data-s="'+s.id+'"]'),code=inp&&inp.dataset.code,q=+(m.querySelector('.rt-mq[data-s="'+s.id+'"]')||{}).value||1;
    if(!code){toast("Chọn sản phẩm trong danh sách gợi ý");return}const ch=(m.querySelector('.rt-ch[data-s="'+s.id+'"]')||{}).value||s.channel;if(!ch){toast("Chọn kênh trước");return}
    const it=KHO.items.get(code),items=(s.items||[]).map(x=>({item:x.item,name:x.name,received:x.received,bad:x.bad})).filter(x=>x.item!==code).concat([{item:code,name:it?it.name:code,received:q,bad:0}]);save(s.id,{channel:ch,items})});
  m.querySelectorAll(".rt-x").forEach(b=>b.onclick=async()=>{if(!confirm("Bỏ gói quét nhầm này?"))return;try{await kApi("/ret/scans/"+b.dataset.s,{method:"DELETE"});RET.scans=null;renderMain()}catch(e){toast(e.message)}});
  const unmSave=async id=>{const ref=(m.querySelector('.un-ref[data-s="'+id+'"]')||{}).value||"",ch=(m.querySelector('.un-ch[data-s="'+id+'"]')||{}).value||"";
    if(!ref.trim()){toast("Điền mã đơn tra được trên seller");return}
    try{const r=await kApi("/ret/scans/"+id+"/order-ref",{method:"POST",body:JSON.stringify({order_ref:ref,channel:ch})});
      toast(r.linked?"Đã gắn vào đơn "+r.order_id+", xem các món phải về ở tab Quét":"Đã lưu mã đơn. Web tự gắn khi Poscake có đơn này");
      RET.unm=null;RET.scans=null;RET.recon=null;renderMain()}catch(e){toast(e.message)}};
  m.querySelectorAll(".un-save").forEach(b=>b.onclick=()=>unmSave(b.dataset.s));
  m.querySelectorAll(".un-ref").forEach(x=>x.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();unmSave(x.dataset.s)}});
  m.querySelectorAll(".rt-o").forEach(b=>b.onclick=()=>{RET.open.add(+b.dataset.s);renderMain()});
  m.querySelectorAll(".rt-act").forEach(x=>x.onchange=()=>{RET.act[x.dataset.i]=Math.max(0,+x.value||0);renderMain()});
  if($("#rt-recv"))$("#rt-recv").onclick=async()=>{const day=RET.day||retToday();
    const T=retTicket((RET.scans&&RET.scans.scans)||[]);
    const val=x=>RET.act[x.code]!==undefined?RET.act[x.code]:x.ok;
    const actual=T.map(x=>({item:x.code,qty:val(x)}));
    const lech=T.filter(x=>val(x)!==x.ok).length;
    if(!confirm("Nhập kho phiếu nhập hoàn ngày "+kDd(day)+"? Tồn tăng đúng số thực nhập."+(lech?"\nCó "+lech+" sản phẩm lệch so với dự kiến, lệch sẽ ghi vào phiếu.":"")))return;
    try{const r=await kApi("/ret/receive",{method:"POST",body:JSON.stringify({day,actual})});const sk=r.flatMap(x=>x.skipped||[]);toast("Đã lập phiếu "+r.map(x=>x.no).join(", ")+" ("+r.reduce((n,x)=>n+x.packages,0)+" gói)");if(sk.length)alert("Các món sau chưa có mã MISA nên chưa cộng tồn:\n"+sk.join("\n"));RET.act={};RET.open=new Set();RET.scans=null;RET.recon=null;KHO.at=0;renderMain()}catch(e){alert(e.message)}};
  if($("#rt-sync"))$("#rt-sync").onclick=async()=>{toast("Đang kéo đơn hoàn từ Poscake…");try{const r=await kApi("/ret/sync",{method:"POST",body:JSON.stringify({days:7})});const bad=r.filter(x=>!x.ok);toast(bad.length?"Lỗi: "+bad[0].channel+" "+bad[0].note:"Đã kéo xong");RET.recon=null;renderMain()}catch(e){toast(e.message)}};
  if($("#rt-rematch"))$("#rt-rematch").onclick=async()=>{try{const r=await kApi("/ret/rematch",{method:"POST",body:"{}"});toast("Gắn được "+r.matched+" mã, còn "+r.left+" mã chưa khớp");RET.recon=null;RET.scans=null;renderMain()}catch(e){toast(e.message)}};
  if($("#rt-imp"))$("#rt-imp").oninput=e=>{RET.imp=e.target.value};
  if($("#rt-imp-day"))$("#rt-imp-day").onchange=e=>{RET.impDay=e.target.value};
  if($("#rt-imp-go"))$("#rt-imp-go").onclick=async()=>{const day=$("#rt-imp-day").value;if(!day){toast("Chọn ngày");return}
    const codes=[...new Set(String($("#rt-imp").value).split(/[\s,;\t]+/).map(x=>x.trim()).filter(x=>x.length>=6&&!/^đơn$|tiktok|shopee|^fb$/i.test(x)))];
    if(!codes.length){toast("Không thấy mã nào");return}if(!confirm("Nạp "+codes.length+" mã cho ngày "+kDd(day)+"?"))return;
    try{const r=await kApi("/ret/import",{method:"POST",body:JSON.stringify({rows:codes.map(code=>({day,code}))})});alert("Đã nạp "+r.added+" mã ("+r.matched+" khớp đơn hoàn), bỏ qua "+r.duplicate+" mã trùng.");RET.imp="";RET.recon=null;RET.scans=null;renderMain()}catch(e){alert(e.message)}};
  m.querySelectorAll(".rt-v").forEach(x=>x.onchange=()=>save(x.dataset.s,{video_url:x.value}));
  m.querySelectorAll(".rt-c").forEach(x=>x.onchange=()=>save(x.dataset.s,{claim:x.value}));
  m.querySelectorAll(".rt-n").forEach(x=>x.onchange=()=>save(x.dataset.s,{note:x.value}));
  m.querySelectorAll(".rt-a").forEach(x=>x.onchange=()=>save(x.dataset.s,{claim_amount:+x.value||0}));
}
PAGES.kho_hoan=pKhoHoan;
