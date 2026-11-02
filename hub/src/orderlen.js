/* =====================================================================
   ORDER LÊN QUẢN LÝ (chị Hoa 02/11/2026): nhân sự order ngược lên Lead / trưởng phòng / CEO.
   - Order hỗ trợ việc: thành một việc giao cho người được order (tasks[].order=true, người order là người duyệt kết quả —
     tkAppr trong congviec.js), đi đúng luồng nhận việc → nộp kết quả → người order xác nhận / trả lại.
   - Order lịch họp: xem lịch người được hẹn theo từng ngày (khung đã có hẹn hiện "bận"), chọn giờ trống gửi đi;
     người được hẹn Đồng ý / Đổi giờ (đề xuất giờ khác) / Từ chối; người order đồng ý giờ mới thì lịch chốt.
     Dữ liệu: d.meets [{id,by,to,title,note,hinh,link,date:"YYYY-MM-DD",from,end,st:cho|doi|ok|tuchoi|huy,de:{date,from,end,note},log}].
   - Báo bằng chuông (notifyU, ref "meet:<id>"), khung "Lịch họp & order" ở đầu Công việc › Tổng quan.
   ===================================================================== */
const OD={kind:"ho",to:"",date:"",from:"",dur:60};
const OD_ST={cho:["Chờ trả lời","amb"],doi:["Đề xuất đổi giờ","blu"],ok:["Đã chốt","grn"],tuchoi:["Từ chối","red"],huy:["Đã huỷ","gry"]};
const odMin=s=>+String(s).slice(0,2)*60+ +String(s).slice(3,5);
const odHM=n=>String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
const odIso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const odDayLbl=iso=>{const d=new Date(iso+"T00:00:00");return ["CN","T2","T3","T4","T5","T6","T7"][d.getDay()]+" "+String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")};
const odMeets=()=>(D().meets||[]);
/* người nhận order: Lead / trưởng phòng cùng phòng trước, rồi CEO, quản lý khác */
const odBosses=()=>D().users.filter(u=>u.active&&u.name&&u.id!==ME.id&&(u.role==="admin"||u.role==="truongphong"||(typeof tkLead==="function"&&tkLead(u))))
  .sort((a,b)=>(tkSameTeam(b,ME)?1:0)-(tkSameTeam(a,ME)?1:0)||(a.role==="admin")-(b.role==="admin"));
const odDays=()=>{const out=[],d=new Date();for(let i=d.getHours()>=17?1:0;out.length<7&&i<14;i++){const x=new Date(d.getTime()+i*864e5);if(x.getDay()!==0)out.push(odIso(x))}return out};
/* khung bận của một người trong ngày: lịch họp đang chờ / đã chốt có người đó */
const odBusy=(uid,date,skip)=>odMeets().filter(m=>m.id!==skip&&["cho","doi","ok"].includes(m.st)&&(m.to===uid||m.by===uid)).map(m=>m.st==="doi"&&m.de?Object.assign({},m,m.de):m).filter(m=>m.date===date);
const odClash=(uids,date,from,dur,skip)=>{const a=odMin(from),b=a+dur;return uids.some(u=>odBusy(u,date,skip).some(m=>odMin(m.from)<b&&odMin(m.end)>a))};
/* lưới giờ 08:00–17:30, khung 30 phút; khung bận của người được hẹn (và của mình) không chọn được */
function odSlotsHtml(uids,date,sel,dur,skip){const now=new Date(),isToday=date===odIso(now),nowM=now.getHours()*60+now.getMinutes();
  const S=[];for(let t=8*60;t+dur<=18*60;t+=30){if(t>=12*60&&t<13*60+30&&t+dur>12*60)continue;S.push(t)}
  return `<div class="odslots">${S.map(t=>{const h=odHM(t),busy=odClash(uids,date,h,dur,skip),past=isToday&&t<=nowM;return `<button type="button" class="${h===sel?"on":""}${busy?" busy":""}" data-odt="${h}" ${busy||past?"disabled":""} title="${busy?"Đã có lịch":past?"Đã qua":"Còn trống"}">${h}${busy?"<small>bận</small>":""}</button>`}).join("")}</div>`}
function odPicker(uids,skip){const days=odDays();if(!days.includes(OD.date))OD.date=days[0];
  return `<div class="field">Ngày<div class="oddays">${days.map(d=>`<button type="button" class="${d===OD.date?"on":""}" data-odd="${d}">${odDayLbl(d)}<small>${uids.reduce((z,u)=>z+odBusy(u,d,skip).length,0)?"có lịch":"trống"}</small></button>`).join("")}</div></div>
   <div class="field">Giờ bắt đầu <small class="hint">(khung xám là đã có lịch, không đặt được)</small><div id="od-slots">${odSlotsHtml(uids,OD.date,OD.from,OD.dur,skip)}</div></div>`}
function odBindPicker(uids,skip){const re=()=>{const w=$("#od-slots");if(w){w.innerHTML=odSlotsHtml(uids,OD.date,OD.from,OD.dur,skip);bindT()}};
  const bindT=()=>document.querySelectorAll("[data-odt]").forEach(b=>b.onclick=()=>{OD.from=b.dataset.odt;document.querySelectorAll("[data-odt]").forEach(x=>x.classList.toggle("on",x===b))});
  document.querySelectorAll("[data-odd]").forEach(b=>b.onclick=()=>{OD.date=b.dataset.odd;OD.from="";document.querySelectorAll("[data-odd]").forEach(x=>x.classList.toggle("on",x===b));re()});
  const du=$("#od-dur");if(du)du.onchange=()=>{OD.dur=+du.value;OD.from="";re()};bindT()}

function openOrder(kind){if(kind)OD.kind=kind;const B=odBosses();if(!B.length){toast("Chưa có quản lý nào để order");return}
  if(!B.some(u=>u.id===OD.to))OD.to=B[0].id;const td=D().settings.today;
  const tab=(k,l)=>`<button type="button" class="${OD.kind===k?"on":""}" data-odk="${k}">${l}</button>`;
  const who=`<label class="field">${OD.kind==="hop"?"Hẹn gặp ai":"Gửi cho ai"}<select id="od-to">${opt(B.map(u=>[u.id,u.name+" · "+(u.role==="admin"?"CEO":u.role==="truongphong"?"Trưởng phòng":"Lead")+(tkSameTeam(u,ME)?" (phòng mình)":"")]),OD.to)}</select></label>`;
  openDrawerHTML(`<h2>Order lên quản lý</h2><div class="odtab">${tab("ho","🙋 Hỗ trợ việc")}${tab("hop","📅 Lịch họp")}</div>
   ${OD.kind==="ho"?`<form class="frm" id="od-f">${who}<label class="field">Cần hỗ trợ việc gì<input id="od-ten" required placeholder="Ví dụ: Duyệt giúp kịch bản sale 11/11, xin thêm ngân sách quay"></label>
     <label class="field">Mô tả<textarea id="od-mo" rows="3" placeholder="Bối cảnh, đã làm đến đâu, cần quản lý quyết gì"></textarea></label>
     <div class="row4"><label class="field">Cần xong trước${tkDate("od-han",td+1,"required")}</label><label class="field">Mức gấp<select id="od-uu">${opt(UU,"Trung bình")}</select></label></div>
     <p class="hint">Quản lý nhận được thông báo, việc nằm trong "Việc của tôi" của quản lý. Làm xong quản lý nộp kết quả, bạn xác nhận hoặc trả lại.</p>
     <div class="acts"><button class="btn pri">Gửi order</button></div></form>`
   :`<form class="frm" id="od-f">${who}<label class="field">Nội dung họp<input id="od-ten" required placeholder="Ví dụ: Trao đổi kế hoạch video tháng 12"></label>
     <div class="row4"><label class="field">Thời lượng<select id="od-dur">${opt([[30,"30 phút"],[60,"1 giờ"],[90,"1 giờ 30"],[120,"2 giờ"]],OD.dur)}</select></label><label class="field">Hình thức<select id="od-hinh">${opt(["Gặp trực tiếp","Online (Meet / Zalo)"],"Gặp trực tiếp")}</select></label></div>
     ${odPicker([OD.to,ME.id])}
     <label class="field">Ghi chú<textarea id="od-mo" rows="2" placeholder="Cần chuẩn bị gì, link tài liệu"></textarea></label>
     <div class="acts"><button class="btn pri">Gửi order lịch</button></div></form>`}
   ${odMyHtml()}`);
  document.querySelectorAll("[data-odk]").forEach(b=>b.onclick=()=>openOrder(b.dataset.odk));
  $("#od-to").onchange=()=>{OD.to=$("#od-to").value;OD.from="";openOrder()};
  if(OD.kind==="hop")odBindPicker([OD.to,ME.id]);
  odBindMy();
  $("#od-f").onsubmit=e=>{e.preventDefault();const to=$("#od-to").value,ten=$("#od-ten").value.trim(),mo=$("#od-mo").value.trim(),bo=D().users.find(u=>u.id===to);if(!ten||!bo)return;
    if(OD.kind==="ho"){const han=tkDay($("#od-han").value);if(!han){toast("Chọn ngày cần xong");return}const id=uid("cv"),team=TEAMS[teamOf(ME)]?teamOf(ME):(TEAMS[teamOf(bo)]?teamOf(bo):"chung");
      DB.mutate(ME.name,"order hỗ trợ: "+ten+" → "+bo.name,dt=>{const x={id,ten,moTa:mo,team,da:"",nguoi:to,phoi:[],han,bd:0,uu:$("#od-uu").value,st:"todo",checklist:[],files:[],loai:"Order hỗ trợ",order:true,v2:false,tao:ME.id,log:[]};
        tkLog(x,ME.name+" order hỗ trợ cho "+bo.name+" · cần xong "+dd(han));dt.tasks.push(x);notifyU(dt,[to],`🙋 ${ME.name} order hỗ trợ: "${ten}" · cần xong ${dd(han)}`,"task:"+id)});
      toast("Đã gửi order cho "+bo.name);closeDrawer();renderMain()}
    else{if(!OD.from){toast("Chọn giờ bắt đầu");return}if(odClash([to,ME.id],OD.date,OD.from,OD.dur)){toast("Giờ này vừa có lịch, chọn giờ khác");openOrder();return}
      const id=uid("mt"),end=odHM(odMin(OD.from)+OD.dur),hinh=$("#od-hinh").value;
      DB.mutate(ME.name,"order lịch họp với "+bo.name,dt=>{dt.meets=dt.meets||[];dt.meets.push({id,by:ME.id,to,title:ten,note:mo,hinh,date:OD.date,from:OD.from,end,st:"cho",at:new Date().toISOString(),log:[ME.name+" gửi order lịch "+odDayLbl(OD.date)+" "+OD.from+"–"+end]});
        notifyU(dt,[to],`📅 ${ME.name} xin lịch họp ${odDayLbl(OD.date)} ${OD.from}–${end}: ${ten}`,"meet:"+id)});
      toast("Đã gửi order lịch cho "+bo.name);OD.from="";closeDrawer();renderMain()}}}

/* lịch họp của tôi + order hỗ trợ tôi đã gửi */
function odMyHtml(){const today=odIso(new Date()),M=odMeets().filter(m=>(m.by===ME.id||m.to===ME.id)&&m.st!=="huy"&&((m.de&&m.st==="doi"?m.de.date:m.date)>=today)).sort((a,b)=>(a.date+a.from).localeCompare(b.date+b.from));
  const T=(D().tasks||[]).filter(t=>t.order&&t.tao===ME.id&&t.st!=="done").slice(0,8);
  return `<h3 style="margin-top:18px">Lịch họp của tôi</h3>${M.length?M.map(odRow).join(""):`<p class="hint">Chưa có lịch họp nào sắp tới.</p>`}
   <h3 style="margin-top:14px">Order hỗ trợ tôi đã gửi</h3>${T.length?T.map(t=>`<div class="odrow" data-odtask="${esc(t.id)}"><span><b>${esc(t.ten)}</b><small>gửi ${esc(userName(t.nguoi)||"")} · cần xong ${dd(t.han)}</small></span>${pill(cvStN(t.st),t.st==="review"?"amb":t.st==="doing"||t.st==="nhan"?"blu":"gry")}</div>`).join(""):`<p class="hint">Chưa có order nào đang mở.</p>`}`}
function odRow(m){const s=OD_ST[m.st]||["",""],w=m.st==="doi"&&m.de?m.de:m,other=m.by===ME.id?m.to:m.by;
  return `<div class="odrow" data-odm="${esc(m.id)}"><span><b>${esc(m.title)}</b><small>${odDayLbl(w.date)} ${w.from}–${w.end} · ${m.by===ME.id?"với":"từ"} ${esc(userName(other)||"")}${m.hinh?" · "+esc(m.hinh):""}</small></span>${pill(s[0],s[1])}</div>`}
function odBindMy(){document.querySelectorAll("[data-odm]").forEach(e=>e.onclick=()=>openMeet(e.dataset.odm));document.querySelectorAll("[data-odtask]").forEach(e=>e.onclick=()=>openTask(e.dataset.odtask))}

/* chi tiết một lịch họp: người được hẹn Đồng ý / Đổi giờ / Từ chối; người order đồng ý giờ mới hoặc huỷ */
function openMeet(id,doi){const m=odMeets().find(x=>x.id===id);if(!m){toast("Không thấy lịch họp");return}
  const isTo=m.to===ME.id,isBy=m.by===ME.id,s=OD_ST[m.st]||["",""];
  if(doi){OD.date=m.date;OD.from="";OD.dur=odMin(m.end)-odMin(m.from)}
  openDrawerHTML(`<h2>📅 ${esc(m.title)}</h2><p>${pill(s[0],s[1])}</p>
   <div class="odinfo"><div><small>Người order</small><b>${esc(userName(m.by)||"")}</b></div><div><small>Gặp</small><b>${esc(userName(m.to)||"")}</b></div><div><small>Giờ xin</small><b>${odDayLbl(m.date)} ${m.from}–${m.end}</b></div><div><small>Hình thức</small><b>${esc(m.hinh||"—")}</b></div></div>
   ${m.de&&m.st==="doi"?`<div class="note amb">${esc(userName(m.to)||"")} đề xuất đổi sang <b>${odDayLbl(m.de.date)} ${m.de.from}–${m.de.end}</b>${m.de.note?": "+esc(m.de.note):""}</div>`:""}
   ${m.note?`<p>${esc(m.note)}</p>`:""}${m.lyDo?`<p class="hint">Lý do: ${esc(m.lyDo)}</p>`:""}
   ${doi?`<form class="frm" id="od-doi"><label class="field">Thời lượng<select id="od-dur">${opt([[30,"30 phút"],[60,"1 giờ"],[90,"1 giờ 30"],[120,"2 giờ"]],OD.dur)}</select></label>${odPicker([m.to,m.by],m.id)}<label class="field">Lời nhắn<input id="od-dn" placeholder="Ví dụ: sáng đó chị bận, chuyển chiều nhé"></label><div class="acts"><button class="btn pri">Gửi đề xuất giờ mới</button><button type="button" class="btn" id="od-back">Quay lại</button></div></form>`
   :`<div class="acts">${isTo&&m.st==="cho"?`<button class="btn pri" id="od-ok">Đồng ý</button><button class="btn" id="od-doi">Đổi giờ</button><button class="btn danger" id="od-no">Từ chối</button>`:""}
     ${isBy&&m.st==="doi"?`<button class="btn pri" id="od-okde">Đồng ý giờ mới</button>`:""}${(isBy||isTo)&&["cho","doi","ok"].includes(m.st)?`<button class="btn" id="od-huy">Huỷ lịch</button>`:""}</div>`}
   <details style="margin-top:12px"><summary class="hint">Nhật ký (${(m.log||[]).length})</summary>${(m.log||[]).map(l=>`<div class="hint">${esc(l)}</div>`).join("")}</details>`);
  const W=(txt,f,ids,msg)=>{DB.mutate(ME.name,txt,dt=>{const x=(dt.meets||[]).find(y=>y.id===id);if(!x)return;f(x);(x.log=x.log||[]).push(ME.name+": "+txt);notifyU(dt,ids,msg,"meet:"+id)});renderMain()};
  if(doi){odBindPicker([m.to,m.by],m.id);$("#od-back").onclick=()=>openMeet(id);
    $("#od-doi").onsubmit=e=>{e.preventDefault();if(!OD.from){toast("Chọn giờ mới");return}const end=odHM(odMin(OD.from)+OD.dur),note=$("#od-dn").value.trim();
      W("đề xuất đổi giờ "+odDayLbl(OD.date)+" "+OD.from+"–"+end,x=>{x.st="doi";x.de={date:OD.date,from:OD.from,end,note}},[m.by],`📅 ${ME.name} đề xuất đổi lịch "${m.title}" sang ${odDayLbl(OD.date)} ${OD.from}–${end}${note?": "+note:""}`);toast("Đã gửi giờ mới");openMeet(id)};return}
  if($("#od-ok"))$("#od-ok").onclick=()=>{W("đồng ý lịch",x=>{x.st="ok"},[m.by],`✅ ${ME.name} đồng ý lịch "${m.title}" ${odDayLbl(m.date)} ${m.from}–${m.end}`);toast("Đã chốt lịch");openMeet(id)};
  if($("#od-doi"))$("#od-doi").onclick=()=>openMeet(id,true);
  if($("#od-no"))$("#od-no").onclick=()=>{const r=(prompt("Lý do từ chối (người order sẽ nhận được)")||"").trim();if(!r)return;W("từ chối lịch: "+r,x=>{x.st="tuchoi";x.lyDo=r},[m.by],`${ME.name} từ chối lịch "${m.title}": ${r}`);openMeet(id)};
  if($("#od-okde"))$("#od-okde").onclick=()=>{if(odClash([m.to,m.by],m.de.date,m.de.from,odMin(m.de.end)-odMin(m.de.from),m.id)){toast("Giờ mới vừa trùng lịch khác, nhờ quản lý chọn lại");return}
    W("đồng ý giờ mới",x=>{Object.assign(x,{date:x.de.date,from:x.de.from,end:x.de.end,st:"ok"});delete x.de},[m.to],`✅ ${ME.name} đồng ý giờ mới cho lịch "${m.title}"`);toast("Đã chốt lịch");openMeet(id)};
  if($("#od-huy"))$("#od-huy").onclick=()=>{if(!confirm("Huỷ lịch họp này?"))return;W("huỷ lịch",x=>{x.st="huy"},[isBy?m.to:m.by],`${ME.name} huỷ lịch "${m.title}"`);closeDrawer()}}

/* khung ở đầu Công việc › Tổng quan: lịch cần trả lời + lịch sắp tới (chỉ hiện khi có) */
function odCardHtml(){if(!ME)return "";const today=odIso(new Date()),M=odMeets(),wait=M.filter(m=>(m.to===ME.id&&m.st==="cho")||(m.by===ME.id&&m.st==="doi"));
  const up=M.filter(m=>m.st==="ok"&&(m.to===ME.id||m.by===ME.id)&&m.date>=today).sort((a,b)=>(a.date+a.from).localeCompare(b.date+b.from)).slice(0,4);
  if(!wait.length&&!up.length)return "";
  return `<section class="card odcard"><div class="odch"><h3>📅 Lịch họp</h3>${wait.length?`<span class="pill p-amb">${wait.length} cần trả lời</span>`:""}</div>${wait.concat(up).map(odRow).join("")}</section>`}
function odAttach(m){const bar=m.querySelector(".cvvbar");if(!bar)return;
  if(!m.querySelector("#cv-order")){const nb=bar.querySelector("#cv-new");const b=document.createElement("button");b.className="btn";b.id="cv-order";b.type="button";b.textContent="↑ Order quản lý";b.title="Order hỗ trợ việc hoặc xin lịch họp với Lead, trưởng phòng, CEO";if(nb)nb.before(b);else bar.append(b);b.onclick=()=>openOrder()}
  const h=odCardHtml();if(h){bar.insertAdjacentHTML("beforebegin",h);m.querySelectorAll(".odcard [data-odm]").forEach(e=>e.onclick=()=>openMeet(e.dataset.odm))}}
const _pCvVOd=pCvV;
pCvV=function(m){_pCvVOd(m);try{odAttach(m)}catch(e){console.error("order lên quản lý",e)}};
PAGES.cv_v=m=>pCvV(m);
/* bấm thông báo lịch họp: mở đúng lịch */
const _ntGoOd=ntGo;
ntGo=function(n){if(n&&n.ref&&String(n.ref).startsWith("meet:")){_ntGoOd(Object.assign({},n,{ref:""}));openMeet(String(n.ref).slice(5));return}return _ntGoOd(n)};
