/* =====================================================================
   GIAO VIỆC & LỊCH QUAY — tuần này ai viết kịch bản nào, hôm nào đi quay, ở đâu
   ===================================================================== */
const THU=["T2","T3","T4","T5","T6","T7","CN"];
const wd=day=>(MONTH.first+day-1)%7;
const dayLbl=day=>`${THU[wd(day)]} ${dd(day)}`;
const DIADIEM=["Văn phòng Ailla","Nhà máy Thanh Oai","Nhà máy Cự Khê","Nhà nhân viên / ngoại cảnh","Studio thuê"];
const TASK_LOAI=["Chuẩn bị đạo cụ, mẫu","Research","Viết caption","Thiết kế ảnh","Livestream","Khác"];
let GV={w:0,tab:"tuan",ng:""};
function pGiaoViec(m){
  const d=D(),ed=can(ME,"viec.giao");if(!GV.w)GV.w=weekOf(d.settings.today);
  const W=WEEKS.find(w=>w.w===GV.w),days=[];for(let i=W.tu;i<=W.den;i++)days.push(i);
  const inW=x=>x>=W.tu&&x<=W.den;
  const ng=GV.ng==="me"?ME.id:GV.ng,byNg=id=>!ng||id===ng;
  const pendAll=d.cards.filter(c=>["cg","kb","dkb","quay"].includes(c.step)&&c.nguon!=="Footage cũ"&&c.nguon!=="Đăng lại");
  const pend=pendAll.filter(c=>byNg(c.nguoi));
  const shoots=d.shoots.filter(s=>inW(s.day)&&(!ng||s.nguoi.includes(ng))).sort((a,b)=>a.day-b.day||(a.gio||"").localeCompare(b.gio||""));
  const tasks=d.tasks.filter(t=>inW(t.han)&&byNg(t.nguoi));
  const ngOpts=[["","Cả team"],["me","Việc của tôi"]].concat(d.users.filter(u=>u.active&&["admin","lead","content","digital"].includes(u.role)&&u.id!==ME.id).map(u=>[u.id,u.name]));
  const tabs=[["tuan","Lịch tuần"],["kichban","Phân công kịch bản"],["quay","Lịch đi quay"],["khac","Việc khác"]];
  m.innerHTML=H("Giao việc & lịch quay",`Tuần ${W.w} · ${dayLbl(W.tu)} – ${dayLbl(W.den)}`)+`<div class="filters">${WEEKS.map(w=>`<button class="btn sm${w.w===GV.w?" pri":""}" data-gw="${w.w}">Tuần ${w.w} · ${dd(w.tu)}–${dd(w.den)}</button>`).join("")}<label class="inl" style="margin-left:auto">Nhân sự <select id="gv-ng">${opt(ngOpts,GV.ng)}</select></label></div>
  <div class="grid kpis">${kpi("Buổi quay tuần này",shoots.length,shoots.length?shoots.map(s=>dayLbl(s.day)).join(", "):"chưa lên lịch",shoots.length?"":"var(--orange)")}${kpi("Kịch bản có hạn tuần này",pend.filter(c=>inW(c.hanKB||0)).length)}${kpi("Thẻ chưa có người làm",pend.filter(c=>!c.nguoi).length,"","var(--orange)")}${kpi("Thẻ chưa xếp buổi quay",pend.filter(c=>c.nguoi&&!c.buoiQuay&&inW(c.day)).length,"đăng trong tuần này")}${kpi("Việc khác",tasks.filter(t=>t.st!=="done").length+" chưa xong")}</div>
  <div class="tabs">${tabs.map(([k,t])=>`<button class="tab${GV.tab===k?" on":""}" data-gt="${k}">${t}</button>`).join("")}</div><div id="gvb"></div>`;
  m.querySelectorAll("[data-gw]").forEach(b=>b.onclick=()=>{GV.w=+b.dataset.gw;renderMain()});
  $("#gv-ng").onchange=e=>{GV.ng=e.target.value;renderMain()};
  m.querySelectorAll("[data-gt]").forEach(b=>b.onclick=()=>{GV.tab=b.dataset.gt;renderMain()});
  const B=$("#gvb");({tuan:gvTuan,kichban:gvKichBan,quay:gvQuay,khac:gvKhac})[GV.tab](B,{d,ed,W,days,inW,pend,pendAll,shoots,tasks,ng,byNg});
}
const shootName=s=>s?`${dayLbl(s.day)}${s.gio?" "+s.gio:""} · ${s.diaDiem}`:"";
function gvTuan(B,{d,days,pend,shoots,tasks,byNg}){
  const mine=x=>ME.role==="content"&&x===ME.id?" me":"";
  B.innerHTML=`<section class="card"><div class="calwrap"><div class="wk" style="grid-template-columns:repeat(${days.length},minmax(170px,1fr))">${days.map(day=>{
    const sh=shoots.filter(s=>s.day===day),kb=pend.filter(c=>c.hanKB===day),post=d.cards.filter(c=>c.day===day&&c.step!=="xong"&&byNg(c.nguoi)),tk=tasks.filter(t=>t.han===day);
    const byCh={};post.forEach(c=>byCh[chOf(c.kenh).short]=(byCh[chOf(c.kenh).short]||0)+1);
    return `<div class="wkd${day===d.settings.today?" today":""}"><div class="wkh">${dayLbl(day)}${wd(day)===6?" · nghỉ":""}</div>
     ${sh.map(s=>`<div class="ev ev-q" data-shoot="${s.id}"><b>🎬 Đi quay ${s.gio||""}</b><span>${esc(s.diaDiem)}</span><span>${s.nguoi.map(userName).join(", ")||"chưa có người"}</span><span>${d.cards.filter(c=>c.buoiQuay===s.id).length} video · ${esc(s.trangThai)}</span></div>`).join("")}
     ${kb.map(c=>`<div class="ev ev-k${mine(c.nguoi)}" data-card="${c.id}"><b>✍️ Hạn kịch bản</b><span>${c.id} · ${sk(c.sku).n}</span><span>${esc(userName(c.nguoi)||"chưa giao")}</span></div>`).join("")}
     ${tk.map(t=>`<div class="ev ev-t${t.st==="done"?" done":""}${mine(t.nguoi)}"><b>${t.st==="done"?"✅":"📌"} ${esc(t.ten)}</b><span>${esc(userName(t.nguoi))}</span></div>`).join("")}
     ${post.length?`<div class="ev ev-p"><b>📤 Lịch đăng</b><span>${Object.entries(byCh).map(([k,n])=>k+" "+n).join(" · ")}</span></div>`:""}
     ${!sh.length&&!kb.length&&!tk.length&&!post.length?`<div class="ev-empty">—</div>`:""}</div>`}).join("")}</div></div>
   <p class="hint">Bấm thẻ ✍️ để mở thẻ video. Lên lịch quay ở tab "Lịch đi quay", giao người viết kịch bản ở tab "Phân công kịch bản".</p></section>`;
  B.querySelectorAll("[data-shoot]").forEach(e=>e.onclick=()=>{GV.tab="quay";renderMain()});
  B.querySelectorAll("[data-card]").forEach(e=>e.onclick=()=>openCard(e.dataset.card));
}
let GVK={pham:"tuan",sel:new Set()};
function gvKichBan(B,{d,ed,W,inW,pend}){
  const L=pend.filter(c=>GVK.pham==="tuan"?(inW(c.day)||inW(c.hanKB||0)):GVK.pham==="chuagiao"?!c.nguoi:true).sort((a,b)=>a.day-b.day);
  const sOpts=[["","—"]].concat(d.shoots.filter(s=>s.trangThai!=="Hoãn").sort((a,b)=>a.day-b.day).map(s=>[s.id,shootName(s)]));
  const dOpts=x=>[["","—"]].concat(Array.from({length:MONTH.ndays},(_,i)=>[i+1,dayLbl(i+1)]).filter(o=>!x||o[0]<=x));
  B.innerHTML=`<section class="card"><div class="filters"><select id="gk-p">${opt([["tuan",`Video đăng hoặc có hạn trong tuần ${W.w}`],["chuagiao","Chưa có người làm (cả tháng)"],["all","Tất cả thẻ chưa quay xong"]],GVK.pham)}</select><span class="hint">${L.length} thẻ</span></div>
  ${ed?`<div class="bulk frm row7"><b>Giao các thẻ đã tích:</b><label class="field">Người làm<select id="gb-n">${opt(userOpts("—"),"")}</select></label><label class="field">Hạn kịch bản<select id="gb-h">${opt(dOpts(),"")}</select></label><label class="field">Buổi quay<select id="gb-q">${opt(sOpts,"")}</select></label><button class="btn pri" id="gb-go">Áp dụng</button></div>`:""}
  <div class="tbl edit"><table><thead><tr>${ed?`<th><input type="checkbox" id="gk-all" style="width:auto"></th>`:""}<th>Thẻ</th><th>Kênh</th><th>Sản phẩm · ý tưởng</th><th>Ngày đăng</th><th>Người làm kịch bản</th><th>Hạn kịch bản</th><th>Buổi quay</th><th>Bước</th></tr></thead><tbody>
  ${L.map(c=>{const late=c.hanKB&&c.hanKB<d.settings.today&&c.step==="kb";return `<tr>${ed?`<td><input type="checkbox" data-gs="${c.id}" ${GVK.sel.has(c.id)?"checked":""} style="width:auto"></td>`:""}<td class="mono"><button class="lnk" data-oc="${c.id}">${c.id}</button></td><td>${chOf(c.kenh).short}</td><td>${swatch(c.sku)}<b>${esc(sk(c.sku).n)}</b><small>${esc(c.hookText||c.yTuong||c.tuyen||"")}</small></td><td>${dayLbl(c.day)}</td><td>${ed?`<select data-gn="${c.id}">${opt(userOpts("— chưa giao"),c.nguoi||"")}</select>`:esc(userName(c.nguoi)||"—")}</td><td>${ed?`<select data-gh="${c.id}" class="${late?"bad":""}">${opt(dOpts(c.day),c.hanKB||"")}</select>`:c.hanKB?dayLbl(c.hanKB):"—"}</td><td>${ed?`<select data-gq="${c.id}">${opt(sOpts,c.buoiQuay||"")}</select>`:esc(shootName(d.shoots.find(s=>s.id===c.buoiQuay)))||"—"}</td><td>${stepPill(c)}</td></tr>`}).join("")||`<tr><td colspan="9" class="empty">Không có thẻ.</td></tr>`}</tbody></table></div></section>`;
  $("#gk-p").onchange=e=>{GVK.pham=e.target.value;renderMain()};
  B.querySelectorAll("[data-oc]").forEach(b=>b.onclick=()=>openCard(b.dataset.oc));
  const set=(id,f,v,msg)=>DB.mutate(ME.name,msg,dt=>{const c=dt.cards.find(x=>x.id===id);c[f]=v;if(f==="nguoi"&&v&&c.step==="cg")c.step="kb"});
  B.querySelectorAll("[data-gn]").forEach(s=>s.onchange=()=>{set(s.dataset.gn,"nguoi",s.value,`giao ${s.dataset.gn} cho ${userName(s.value)}`);toast("Đã giao");renderMain()});
  B.querySelectorAll("[data-gh]").forEach(s=>s.onchange=()=>{set(s.dataset.gh,"hanKB",+s.value||0,`đặt hạn kịch bản ${s.dataset.gh}`);toast("Đã lưu")});
  B.querySelectorAll("[data-gq]").forEach(s=>s.onchange=()=>{set(s.dataset.gq,"buoiQuay",s.value,`xếp ${s.dataset.gq} vào buổi quay`);toast("Đã lưu")});
  B.querySelectorAll("[data-gs]").forEach(x=>x.onchange=()=>{x.checked?GVK.sel.add(x.dataset.gs):GVK.sel.delete(x.dataset.gs)});
  if($("#gk-all"))$("#gk-all").onchange=e=>{B.querySelectorAll("[data-gs]").forEach(x=>{x.checked=e.target.checked;x.onchange()})};
  if($("#gb-go"))$("#gb-go").onclick=()=>{const ids=[...GVK.sel];if(!ids.length){toast("Chưa tích thẻ nào");return}const n=$("#gb-n").value,h=+$("#gb-h").value||0,q=$("#gb-q").value;if(!n&&!h&&!q){toast("Chọn người, hạn hoặc buổi quay");return}
    DB.mutate(ME.name,`giao hàng loạt ${ids.length} thẻ`,dt=>ids.forEach(id=>{const c=dt.cards.find(x=>x.id===id);if(!c)return;if(n){c.nguoi=n;if(c.step==="cg")c.step="kb"}if(h)c.hanKB=h;if(q)c.buoiQuay=q}));GVK.sel.clear();toast(`Đã giao ${ids.length} thẻ`);renderMain()};
}
function gvQuay(B,{d,ed,W,inW,pendAll:pend,shoots:L}){
  const crew=d.users.filter(u=>u.active&&["content","lead"].includes(u.role));
  B.innerHTML=`${L.map(s=>{const cs=d.cards.filter(c=>c.buoiQuay===s.id),free=pend.filter(c=>!c.buoiQuay&&c.nguoi&&["kb","dkb","quay"].includes(c.step));return `<section class="card"><div class="card-h"><h2>🎬 ${dayLbl(s.day)} ${esc(s.gio||"")} · ${esc(s.diaDiem)}</h2>${pill(s.trangThai,s.trangThai==="Đã quay"?"grn":s.trangThai==="Hoãn"?"red":"blu")}</div>
   ${ed?`<div class="frm row7"><label class="field">Ngày<select data-sq="${s.id}" data-f="day">${opt(Array.from({length:MONTH.ndays},(_,i)=>[i+1,dayLbl(i+1)]),s.day)}</select></label><label class="field">Giờ<input data-sq="${s.id}" data-f="gio" value="${esc(s.gio)}" placeholder="8:30"></label><label class="field">Địa điểm<input data-sq="${s.id}" data-f="diaDiem" value="${esc(s.diaDiem)}" list="dl-dd"></label><label class="field">Trạng thái<select data-sq="${s.id}" data-f="trangThai">${opt(["Đã lên lịch","Đã quay","Hoãn"],s.trangThai)}</select></label><label class="field grow">Chuẩn bị / ghi chú<input data-sq="${s.id}" data-f="ghiChu" value="${esc(s.ghiChu)}" placeholder="Mẫu, đạo cụ, người diễn…"></label></div>
   <div class="phc"><b>Người đi quay:</b> ${crew.map(u=>`<label class="ck sm"><input type="checkbox" data-sn="${s.id}" value="${u.id}" ${s.nguoi.includes(u.id)?"checked":""}> ${esc(u.name)}</label>`).join("")}</div>`:`<p>Người đi quay: <b>${s.nguoi.map(userName).join(", ")||"—"}</b>${s.ghiChu?` · ${esc(s.ghiChu)}`:""}</p>`}
   <h3>Quay ${cs.length} video</h3>${tbl(["Thẻ","Sản phẩm · ý tưởng","Người làm kịch bản","Kịch bản","Ngày đăng",""],cs.map(c=>`<tr><td class="mono"><button class="lnk" data-oc="${c.id}">${c.id}</button></td><td>${swatch(c.sku)}${esc(sk(c.sku).n)}<small>${esc(c.hookText||c.yTuong||"")}</small></td><td>${esc(userName(c.nguoi))}</td><td>${stepPill(c)}</td><td>${dayLbl(c.day)}</td><td>${ed?`<button class="btn sm" data-sx="${c.id}">Bỏ ra</button>`:""}</td></tr>`))}
   ${ed&&free.length?`<div class="frm row7"><label class="field grow">Thêm video vào buổi này<select id="sa-${s.id}">${opt(free.map(c=>[c.id,`${c.id} · ${sk(c.sku).n} · ${userName(c.nguoi)} · đăng ${dd(c.day)}`]),"")}</select></label><button class="btn" data-sa="${s.id}">Thêm</button></div>`:""}
   ${ed?`<div class="acts"><button class="btn sm danger" data-sd="${s.id}">Xóa buổi quay</button></div>`:""}</section>`}).join("")||`<section class="card"><p class="empty">Tuần ${W.w} chưa có buổi quay nào.</p></section>`}
  ${ed?`<section class="card"><div class="card-h"><h2>Lên lịch buổi quay mới</h2></div><form class="frm" id="sqf"><div class="row4"><label class="field">Ngày<select id="sq-d">${opt(Array.from({length:W.den-W.tu+1},(_,i)=>[W.tu+i,dayLbl(W.tu+i)]),W.tu)}</select></label><label class="field">Giờ<input id="sq-g" value="8:30"></label><label class="field grow">Địa điểm<input id="sq-dd" list="dl-dd" value="Văn phòng Ailla" required></label></div>
   <div class="phc"><b>Người đi quay:</b> ${crew.map(u=>`<label class="ck sm"><input type="checkbox" name="sq-n" value="${u.id}"> ${esc(u.name)}</label>`).join("")}</div><label class="field">Chuẩn bị / ghi chú<input id="sq-gc" placeholder="Mẫu, đạo cụ, người diễn…"></label><button class="btn pri">Thêm buổi quay</button></form></section>`:""}
  <datalist id="dl-dd">${DIADIEM.map(x=>`<option value="${x}">`).join("")}</datalist>`;
  B.querySelectorAll("[data-oc]").forEach(b=>b.onclick=()=>openCard(b.dataset.oc));
  B.querySelectorAll("[data-sq]").forEach(x=>x.onchange=()=>{DB.mutate(ME.name,"sửa buổi quay",dt=>{const s=dt.shoots.find(y=>y.id===x.dataset.sq);s[x.dataset.f]=x.dataset.f==="day"?+x.value:x.value});toast("Đã lưu");if(x.dataset.f==="day"||x.dataset.f==="trangThai")renderMain()});
  B.querySelectorAll("[data-sn]").forEach(x=>x.onchange=()=>{DB.mutate(ME.name,"sửa người đi quay",dt=>{const s=dt.shoots.find(y=>y.id===x.dataset.sn);s.nguoi=x.checked?[...new Set(s.nguoi.concat(x.value))]:s.nguoi.filter(v=>v!==x.value)});toast("Đã lưu")});
  B.querySelectorAll("[data-sx]").forEach(b=>b.onclick=()=>{DB.mutate(ME.name,"bỏ "+b.dataset.sx+" khỏi buổi quay",dt=>dt.cards.find(c=>c.id===b.dataset.sx).buoiQuay="");renderMain()});
  B.querySelectorAll("[data-sa]").forEach(b=>b.onclick=()=>{const id=$("#sa-"+b.dataset.sa).value;if(!id)return;DB.mutate(ME.name,"xếp "+id+" vào buổi quay",dt=>dt.cards.find(c=>c.id===id).buoiQuay=b.dataset.sa);renderMain()});
  B.querySelectorAll("[data-sd]").forEach(b=>b.onclick=()=>{if(!confirm("Xóa buổi quay này? Các video trong buổi sẽ về trạng thái chưa xếp lịch."))return;DB.mutate(ME.name,"xóa buổi quay",dt=>{dt.shoots=dt.shoots.filter(s=>s.id!==b.dataset.sd);dt.cards.forEach(c=>{if(c.buoiQuay===b.dataset.sd)c.buoiQuay=""})});renderMain()});
  if($("#sqf"))$("#sqf").onsubmit=e=>{e.preventDefault();const ng=[...B.querySelectorAll("[name=sq-n]:checked")].map(x=>x.value);DB.mutate(ME.name,"lên lịch quay "+dd(+$("#sq-d").value),dt=>dt.shoots.push({id:uid("sq"),day:+$("#sq-d").value,gio:$("#sq-g").value,diaDiem:$("#sq-dd").value,nguoi:ng,ghiChu:$("#sq-gc").value,trangThai:"Đã lên lịch"}));toast("Đã thêm buổi quay");renderMain()};
}
function gvKhac(B,{d,ed,W,inW,days,tasks}){
  const L=tasks.slice().sort((a,b)=>(a.st==="done")-(b.st==="done")||a.han-b.han);
  const canTick=t=>ed||t.nguoi===ME.id;
  B.innerHTML=`<section class="card">${tbl(["Xong","Việc","Loại","Người làm","Hạn","Ghi chú",""],L.map(t=>`<tr class="${t.st==="done"?"muted":""}"><td>${canTick(t)?`<input type="checkbox" data-tx="${t.id}" ${t.st==="done"?"checked":""} style="width:auto">`:t.st==="done"?"✅":""}</td><td><b>${esc(t.ten)}</b></td><td>${esc(t.loai)}</td><td>${esc(userName(t.nguoi))}</td><td>${dayLbl(t.han)}${t.st!=="done"&&t.han<d.settings.today?" "+pill("trễ","red"):""}</td><td>${esc(t.moTa||t.ghiChu||"")}</td><td>${ed?`<button class="btn sm danger" data-td="${t.id}">Xóa</button>`:""}</td></tr>`))}</section>
  ${ed?`<section class="card"><div class="card-h"><h2>Giao việc khác</h2><span class="hint">Việc ngoài thẻ video: chuẩn bị đạo cụ, research, thiết kế, livestream…</span></div><form class="frm row7" id="tkf"><label class="field grow">Việc<input id="tk-t" required></label><label class="field">Loại<select id="tk-l">${opt(TASK_LOAI,"Khác")}</select></label><label class="field">Người làm<select id="tk-n" required>${opt(userOpts(),"")}</select></label><label class="field">Hạn<select id="tk-h">${opt(days.map(x=>[x,dayLbl(x)]),days[0])}</select></label><label class="field">Ghi chú<input id="tk-g"></label><button class="btn pri">Giao</button></form></section>`:""}`;
  B.querySelectorAll("[data-tx]").forEach(x=>x.onchange=()=>{DB.mutate(ME.name,(x.checked?"xong: ":"mở lại: ")+(d.tasks.find(t=>t.id===x.dataset.tx)||{}).ten,dt=>dt.tasks.find(t=>t.id===x.dataset.tx).st=x.checked?"done":"todo");renderMain()});
  B.querySelectorAll("[data-td]").forEach(b=>b.onclick=()=>{DB.mutate(ME.name,"xóa việc",dt=>dt.tasks=dt.tasks.filter(t=>t.id!==b.dataset.td));renderMain()});
  if($("#tkf"))$("#tkf").onsubmit=e=>{e.preventDefault();DB.mutate(ME.name,"giao việc: "+$("#tk-t").value+" → "+userName($("#tk-n").value),dt=>dt.tasks.push({id:uid("tk"),ten:$("#tk-t").value,loai:$("#tk-l").value,nguoi:$("#tk-n").value,han:+$("#tk-h").value,moTa:$("#tk-g").value,team:"content",da:"",phoi:[],uu:"Trung bình",st:"todo",checklist:[],tao:ME.id,kq:""}));toast("Đã giao");renderMain()};
}
function gvSeed(d){
  if(d.shoots)return;d.shoots=[];d.tasks=[];
  const t=d.settings.today,w=WEEKS.find(x=>t>=x.tu&&t<=x.den)||WEEKS[0];
  const mon=Array.from({length:w.den-w.tu+1},(_,i)=>w.tu+i);const q1=mon.find(x=>wd(x)===1)||w.tu,q2=mon.find(x=>wd(x)===4)||w.den;
  d.shoots.push({id:"sq_demo1",day:q1,gio:"8:30",diaDiem:"Văn phòng Ailla",nguoi:["u_hoa","u_quynh"],ghiChu:"Mang áo trắng ố, khăn bếp bẩn để quay trước/sau",trangThai:q1<t?"Đã quay":"Đã lên lịch"});
  d.shoots.push({id:"sq_demo2",day:q2,gio:"14:00",diaDiem:"Nhà máy Thanh Oai",nguoi:["u_trinh","u_may"],ghiChu:"Quay tinh dầu + lau sàn chuyên dụng, chuẩn bị video sale 20/10",trangThai:"Đã lên lịch"});
  const pend=d.cards.filter(c=>["kb","dkb","quay"].includes(c.step)&&c.nguoi&&c.day>=w.tu&&c.day<=w.den+7);
  pend.slice(0,6).forEach((c,i)=>{c.buoiQuay=i<3?"sq_demo1":"sq_demo2";if(!c.hanKB)c.hanKB=Math.max(1,(i<3?q1:q2)-1)});
  d.tasks.push({id:"tk_demo1",ten:"Chuẩn bị mẫu Bột tẩy + đồ ố cho buổi quay",loai:"Chuẩn bị đạo cụ, mẫu",nguoi:"u_hoa",han:Math.max(w.tu,q1-1),ghiChu:"",xong:false});
  d.tasks.push({id:"tk_demo2",ten:"Duyệt lịch bài Fanpage tuần (agent tự tạo ảnh) + bài sale 20/10",loai:"Viết caption",nguoi:"u_oanh",han:w.den,ghiChu:"",xong:false});
}

/* ---------- CRM B2B nhúng trong khung ---------- */
const CRM_URL="https://ailla-b2b-crm-demo.aillavietnam2020.workers.dev";
const CRM_PAGES=[["crm_perf","Hiệu quả bán hàng","/sales/performance"],["crm_kh","Khách hàng","/sales/customers"],["crm_don","Đơn hàng","/sales/orders"],["crm_cn","Công nợ","/sales/debts"],["crm_gia","Bảng giá","/sales/prices"],["crm_ceo","Báo cáo CEO","/admin/ceo"],["crm_qt","Quản trị CRM","/admin"]];
function pCRMFrame(path,title){return m=>{m.innerHTML=H("CRM B2B · "+title,"Khách sỉ, đại lý, đơn hàng, công nợ")+`<section class="card"><div class="crmgo"><div><h2>${title}</h2><p>CRM B2B đang chạy ở một địa chỉ riêng và có lớp bảo vệ không cho mở lồng bên trong trang khác. Vì vậy bản demo này mở CRM ở tab mới. Khi dựng bản thật, CRM sẽ nằm ngay trong khung này, đăng nhập một lần là dùng được cả Marketing, Digital, P&L lẫn CRM.</p><a class="btn pri big" href="${CRM_URL+path}" target="_blank" rel="noopener">Mở ${title} ↗</a></div></div>
  <h3>Các trang của CRM</h3><div class="crmlinks">${CRM_PAGES.map(([k,t,p])=>`<a class="btn" href="${CRM_URL+p}" target="_blank" rel="noopener">${t} ↗</a>`).join("")}</div></section>`}}
CRM_PAGES.forEach(([k,t,p])=>PAGES[k]=pCRMFrame(p,t));
