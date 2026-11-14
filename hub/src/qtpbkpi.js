/* =====================================================================
   QUẢN TRỊ PHÒNG BAN — đợt 2 (CEO chốt 14/11/2026): Work Flow + KPI nhân sự
   - Work Flow (Lead): xem các luồng duyệt đang chạy thật của phòng; Lead chỉ sửa HẠN DUYỆT của bước Lead.
     Bước Quản lý mua hàng, Kế toán, Kế toán kho, HCNS, CEO giữ nguyên (luồng có tiền: Lead chỉ sửa phần của Lead).
     Hiện việc đang chờ Lead duyệt, việc nào quá hạn.
   - Duyệt video final của CEO: Lead không bỏ được; CEO bật / tắt ở Ranh giới quyền Lead (d.qtpb.cfg.videoCeo, mặc định bật).
   - KPI nhân sự (Lead): Hiệu suất (định mức theo cấp, web tự đếm, so định mức) · Chỉ tiêu & quy định
     (định mức theo cấp + chỉ tiêu tháng theo người: Lead gửi, CEO duyệt mới có hiệu lực; ngưỡng cảnh báo).
   - Chỉ tiêu chờ duyệt (CEO). Hiệu suất & lương thưởng (HCNS): mặc định TẮT, chưa vào bảng lương.
   Máy chủ: Lead không tự ghi được định mức / chỉ tiêu, không đổi được công tắc CEO (src/server/lib/qtpb.ts).
   ===================================================================== */
const QK={tab:"hs",ky:"ngay"};
const QK_LOAI=[["edit","Edit video"],["kb","Viết kịch bản"],["hook","Viết hook"]];
const qkDc=()=>qpDeptCfg(qpD());
const qkVidCeo=()=>{const c=((D()&&D().qtpb)||{}).cfg||{};return c.videoCeo!==false};
const qkHr=()=>((D()&&D().qtpb)||{}).hrcfg||{on:false,muc:[]};
const qkNow=()=>new Date();
const qkYM=()=>{const t=qkNow();return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")};
const qkIso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
/* Ngày lưu trên web có hai kiểu: ISO, hoặc kiểu "8:52:31 14/11/2026" (toLocaleString vi-VN). */
function qkDay(s){if(!s)return "";s=String(s);let m=s.match(/(\d{4})-(\d{2})-(\d{2})/);if(m)return m[0];m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`:""}
function qkTime(s){if(!s)return 0;s=String(s);const d=qkDay(s);if(!d)return 0;const t=s.match(/(\d{1,2}):(\d{2})/);return new Date(d+"T"+(t?t[1].padStart(2,"0")+":"+t[2]:"00:00")+":00").getTime()}
/* Ngày công tạm tính: các ngày trong tháng trừ Chủ nhật (chưa trừ ngày nghỉ theo Chấm công). */
function qkCong(uptoToday){const t=qkNow(),y=t.getFullYear(),m=t.getMonth(),last=uptoToday?t.getDate():new Date(y,m+1,0).getDate();let n=0;for(let d=1;d<=last;d++)if(new Date(y,m,d).getDay()!==0)n++;return n}
const qkFirst=(c,steps)=>{const h=(c.history||[]).find(x=>steps.includes(x.to));return h?qkDay(h.t):""};
/* Web tự đếm: Edit video = video người đó edit đã nộp duyệt; Viết kịch bản = kịch bản gửi duyệt; Viết hook = task Viết hook đã xong. */
function qkCount(uid,from,to){
  const inR=d=>!!d&&d>=from&&d<=to,o={edit:0,kb:0,hook:0};
  (D().cards||[]).forEach(c=>{if(c.nguoiEdit===uid&&inR(qkFirst(c,["dvd","dceo"])))o.edit++;if(c.nguoiKB===uid&&inR(qkFirst(c,["dkb"])))o.kb++});
  (D().tasks||[]).forEach(t=>{if(t.nguoi===uid&&t.loai==="Viết hook"&&t.st==="done"&&inR(qkDay(t.nopAt||t.stAt)))o.hook+=Math.max(1,(t.hookCards||[]).length)});
  return o;
}
const qkDm=cap=>((qkDc().dm||{})[cap])||{};
const qkCt=uid=>(((qkDc().ct||{})[qkYM()]||{})[uid])||{};
const qkNg=()=>Object.assign({ngay:80,gan:80},qkDc().nguong||{});
function qkBonus(pct){const h=qkHr();if(!h.on)return null;const L=(h.muc||[]).filter(x=>pct>=x.tu).sort((a,b)=>b.tu-a.tu);return L.length?L[0].thuong:0}
const qkChip=(p,g)=>p>=100?pill("Đạt","grn"):p>=g?pill("Gần đạt","amb"):pill("Chưa đạt","red");
const qkMembers=()=>D().users.filter(u=>qpManaged(u)&&u.active!==false);

/* ---------- KPI nhân sự (Lead) ---------- */
function pQkKpi(m){
  if(!qpAct()){m.innerHTML=qpDeptPick()+H("KPI nhân sự","")+qpNo("Mục này dành cho Lead của phòng đã mở Quản trị phòng.");return}
  const pend=(qkDc().pend||[]).length;
  m.innerHTML=qpDeptPick()+H("KPI nhân sự","Đo hiệu suất từng người và đặt chỉ tiêu của phòng "+esc(qpPb(qpD()))+". Định mức, chỉ tiêu CEO duyệt mới có hiệu lực.")+
   `<div class="cwtabs" role="tablist">${[["hs","Hiệu suất",0],["ct","Chỉ tiêu & quy định",pend]].map(([k,n,c])=>`<button role="tab" aria-selected="${QK.tab===k}" class="${QK.tab===k?"on":""}" data-qktab="${k}">${n}${c?` <span class="n">${c} chờ CEO</span>`:""}</button>`).join("")}</div><div id="qk-sub"></div>`;
  m.querySelectorAll("[data-qktab]").forEach(b=>b.onclick=()=>{QK.tab=b.dataset.qktab;renderMain()});
  (QK.tab==="ct"?qkTabCt:qkTabHs)(m.querySelector("#qk-sub"));
}
function qkTabHs(s){
  const t=qkNow(),day=qkIso(t),ym=qkYM(),from=QK.ky==="ngay"?day:ym+"-01",cong=qkCong(true),mul=QK.ky==="ngay"?1:cong,ng=qkNg();
  const rows=[];qkMembers().forEach(u=>{const cap=u.cap||"",dm=qkDm(cap),ct=qkCt(u.id),n=qkCount(u.id,from,day);
    QK_LOAI.forEach(([k,lb])=>{const tgt=QK.ky==="ngay"?(dm[k]||0):(ct[k]!=null?Math.round(ct[k]*cong/qkCong(false)):(dm[k]||0)*mul);if(!tgt&&!n[k])return;rows.push({u,cap,k,lb,n:n[k],tgt,p:tgt?Math.round(n[k]/tgt*100):0})})});
  const noDm=!Object.keys(qkDc().dm||{}).length,low=rows.filter(r=>r.tgt&&r.p<ng.ngay).length,hb=qkHr().on;
  s.innerHTML=`<div class="filters"><span class="cwseg">${[["ngay","Hôm nay "+day.slice(8,10)+"/"+day.slice(5,7)],["thang","Tháng này đến nay · "+cong+" ngày công"]].map(([k,n])=>`<button class="btn sm ${QK.ky===k?"pri":""}" data-qkky="${k}">${n}</button>`).join("")}</span>
    ${rows.length?`<span class="hint">${rows.filter(r=>r.tgt&&r.p>=100).length}/${rows.filter(r=>r.tgt).length} dòng đạt · ${low} dòng dưới ${ng.ngay}%</span>`:""}</div>
   ${noDm?`<div class="note">Phòng chưa có định mức. Vào tab <b>Chỉ tiêu & quy định</b>, đặt định mức theo cấp rồi gửi CEO duyệt.</div>`:""}
   <section class="card flush">${tbl(["Nhân sự","Cấp","Việc","Làm được","Định mức","Tỉ lệ","",...(hb?["Thưởng dự kiến"]:[])],rows.length?rows.map(r=>`<tr><td><b>${esc(r.u.name)}</b><div class="hint">${esc(r.u.title||"")}</div></td><td>${esc(r.cap||"—")}</td><td>${r.lb}</td><td>${r.n}</td><td>${r.tgt||"—"}</td>
     <td style="min-width:120px">${r.tgt?`<div style="background:#eff0f4;border-radius:9px;height:7px;overflow:hidden"><div style="height:7px;width:${Math.min(r.p,100)}%;background:${r.p>=100?"#1f8a5b":r.p>=ng.gan?"#b06a00":"#d93a3a"}"></div></div><span class="hint">${r.p}%</span>`:""}</td><td>${r.tgt?qkChip(r.p,ng.gan):""}</td>${hb?`<td>${r.tgt&&QK.ky==="thang"?nf(qkBonus(r.p)||0)+"đ":""}</td>`:""}</tr>`):[`<tr><td colspan="7" class="hint">Chưa có số. Đặt cấp cho nhân sự ở bảng dưới và định mức ở tab Chỉ tiêu & quy định.</td></tr>`])}</section>
   <section class="card"><h2 style="margin:0 0 6px">Cấp của từng người</h2><p class="hint">Định mức lấy theo cấp. Đổi cấp lưu ngay.</p>
    ${tbl(["Nhân sự","Chức vụ","Cấp"],qkMembers().map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.title||"")}</td><td><select data-qkcap="${u.id}">${opt([["","— chọn —"]].concat(QP_CAP.map(c=>[c,c])),u.cap||"")}</select></td></tr>`))}</section>
   <p class="hint">Web tự đếm, không nhập tay: <b>Edit video</b> = video người đó edit đã gửi duyệt (Điều phối); <b>Viết kịch bản</b> = kịch bản đã gửi duyệt; <b>Viết hook</b> = task Viết hook đã xong. Ngày công tạm tính = các ngày trong tháng trừ Chủ nhật.${hb?" Thưởng dự kiến theo cài đặt của HCNS, chưa vào bảng lương.":""}</p>`;
  s.querySelectorAll("[data-qkky]").forEach(b=>b.onclick=()=>{QK.ky=b.dataset.qkky;renderMain()});
  s.querySelectorAll("[data-qkcap]").forEach(x=>x.onchange=()=>{const u=userBy(x.dataset.qkcap);DB.mutate(ME.name,`đặt cấp ${u.name}: ${x.value||"—"}`,d=>{const y=d.users.find(z=>z.id===u.id);if(y&&qpManaged(y))y.cap=x.value});toast("Đã lưu cấp "+u.name);renderMain()});
}
function qkSend(ten,kind,items){if(!items.length){toast("Chưa đổi gì");return}
  DB.mutate(ME.name,"gửi CEO duyệt: "+ten,d=>{d.qtpb=d.qtpb||{};d.qtpb.dept=d.qtpb.dept||{};const c=d.qtpb.dept[qpD()]=d.qtpb.dept[qpD()]||{};c.pend=(c.pend||[]).concat([{id:uid("kp"),kind,ten,ym:qkYM(),by:ME.name,byId:ME.id,at:nowISO(),items}]);
    const ad=d.users.filter(u=>u.role==="admin"&&u.active!==false).map(u=>u.id);if(typeof notifyU==="function")notifyU(d,ad,`${ME.name} gửi CEO duyệt ${ten} (${qpPb(qpD())})`,"qp_ct")});
  toast("Đã gửi CEO duyệt. Số cũ vẫn dùng tới khi CEO duyệt.");renderMain()}
function qkTabCt(s){
  const dc=qkDc(),pend=dc.pend||[],M=qkMembers(),ym=qkYM(),cf=qkCong(false),ng=qkNg();
  s.innerHTML=`${pend.length?`<div class="note"><b>Đang chờ CEO duyệt</b>${pend.map(p=>`<div class="hint" style="margin-top:4px">${esc(p.ten)} · ${p.items.length} thay đổi · ${esc(p.by||"")} gửi ${esc(qpDate(p.at))}</div>`).join("")}</div>`:""}
   <section class="card"><h2 style="margin:0 0 6px">Định mức theo cấp <small class="hint">số việc mỗi ngày công · CEO duyệt mới có hiệu lực</small></h2>
    ${tbl(["Cấp",...QK_LOAI.map(l=>l[1])],QP_CAP.map(c=>`<tr><td><b>${c}</b></td>${QK_LOAI.map(([k])=>`<td><input type="number" min="0" step="0.5" style="width:80px" data-qkdm="${esc(c)}|${k}" value="${qkDm(c)[k]!=null?qkDm(c)[k]:""}" placeholder="—"></td>`).join("")}</tr>`))}
    <div class="acts"><button class="btn pri" id="qk-dm">Gửi CEO duyệt định mức</button></div></section>
   <section class="card"><h2 style="margin:0 0 6px">Chỉ tiêu tháng ${ym.slice(5)}/${ym.slice(0,4)} theo người <small class="hint">để trống = theo định mức × ${cf} ngày công</small></h2>
    ${M.length?tbl(["Nhân sự","Cấp",...QK_LOAI.map(l=>l[1])],M.map(u=>{const dm=qkDm(u.cap||""),ct=qkCt(u.id);return `<tr><td>${esc(u.name)}</td><td>${esc(u.cap||"—")}</td>${QK_LOAI.map(([k])=>`<td><input type="number" min="0" style="width:80px" data-qkct="${u.id}|${k}" value="${ct[k]!=null?ct[k]:""}" placeholder="${dm[k]?dm[k]*cf:"—"}"></td>`).join("")}</tr>`})):`<p class="hint">Phòng chưa có nhân sự.</p>`}
    <div class="acts"><button class="btn pri" id="qk-ct">Gửi CEO duyệt chỉ tiêu</button></div></section>
   <section class="card"><h2 style="margin:0 0 6px">Ngưỡng cảnh báo <small class="hint">Lead tự đặt, lưu ngay</small></h2>
    <div class="row4" style="align-items:center;gap:10px"><label class="field">Dưới bao nhiêu % định mức thì báo đỏ<input type="number" min="1" max="100" id="qk-n1" value="${ng.ngay}"></label><label class="field">Từ bao nhiêu % là "Gần đạt"<input type="number" min="1" max="100" id="qk-n2" value="${ng.gan}"></label></div>
    <div class="acts"><button class="btn" id="qk-ng">Lưu ngưỡng</button></div></section>`;
  const num=v=>v===""?null:Math.max(0,Number(v));
  $("#qk-dm").onclick=()=>{const it=[];s.querySelectorAll("[data-qkdm]").forEach(x=>{const [cap,k]=x.dataset.qkdm.split("|"),b=qkDm(cap)[k],a=num(x.value);if((b==null?null:b)!==a)it.push({cap,k,before:b==null?null:b,after:a})});qkSend("Định mức theo cấp","dm",it)};
  $("#qk-ct").onclick=()=>{const it=[];s.querySelectorAll("[data-qkct]").forEach(x=>{const [id,k]=x.dataset.qkct.split("|"),b=qkCt(id)[k],a=num(x.value);if((b==null?null:b)!==a)it.push({uid:id,name:(userBy(id)||{}).name||"",k,before:b==null?null:b,after:a})});qkSend("Chỉ tiêu tháng "+ym.slice(5)+"/"+ym.slice(0,4),"ct",it)};
  $("#qk-ng").onclick=()=>{const a=Math.min(100,Math.max(1,Number($("#qk-n1").value)||80)),b=Math.min(100,Math.max(1,Number($("#qk-n2").value)||80));
    DB.mutate(ME.name,"sửa ngưỡng cảnh báo hiệu suất",d=>{d.qtpb=d.qtpb||{};d.qtpb.dept=d.qtpb.dept||{};const c=d.qtpb.dept[qpD()]=d.qtpb.dept[qpD()]||{};c.nguong={ngay:a,gan:b}});toast("Đã lưu ngưỡng");renderMain()};
}

/* ---------- CEO: Chỉ tiêu chờ duyệt ---------- */
const qkAllPend=()=>{const q=(D()&&D().qtpb)||{},o=[];Object.entries(q.dept||{}).forEach(([pb,c])=>(c.pend||[]).forEach(p=>o.push(Object.assign({pb},p))));return o};
const qkLb=k=>(QK_LOAI.find(l=>l[0]===k)||[k,k])[1];
function pQkCt(m){
  if(ME.role!=="admin"){m.innerHTML=H("Chỉ tiêu chờ duyệt","")+qpNo("Chỉ CEO.");return}
  const P=qkAllPend();
  m.innerHTML=H("Chỉ tiêu chờ duyệt","Lead đặt định mức theo cấp và chỉ tiêu tháng. CEO duyệt xong mới có hiệu lực.")+(P.length?P.map(p=>`<section class="card"><div class="row4" style="align-items:center;gap:10px"><b style="font-size:16px">${esc(p.ten)}</b>${pill("Chờ CEO duyệt","amb")}<span style="flex:1"></span><span class="hint">${esc(p.by||"")} · ${esc(qpPb(p.pb))} · ${esc(qpDate(p.at))}</span></div>
    ${tbl(["Thay đổi","Đang dùng","Đề nghị"],p.items.map(i=>`<tr><td>${p.kind==="dm"?esc(i.cap):esc(i.name)} · ${qkLb(i.k)}</td><td>${i.before==null?"—":i.before}</td><td><b>${i.after==null?"(bỏ)":i.after}</b></td></tr>`))}
    <div class="acts"><button class="btn pri" data-qkok="${p.id}">Duyệt</button><button class="btn" data-qkno="${p.id}">Trả lại</button></div></section>`).join(""):qpNo("Không có chỉ tiêu nào chờ duyệt."));
  const find=id=>P.find(x=>x.id===id);
  const done=(p,msg,apply)=>DB.mutate(ME.name,msg,d=>{const c=((d.qtpb||{}).dept||{})[p.pb];if(!c)return;c.pend=(c.pend||[]).filter(x=>x.id!==p.id);if(apply)apply(c);
    const L=qpLeadIds(d,p.pb);if(typeof notifyU==="function")notifyU(d,L,msg,"qp_kpi")});
  m.querySelectorAll("[data-qkok]").forEach(b=>b.onclick=()=>{const p=find(b.dataset.qkok);done(p,"CEO đã duyệt "+p.ten,c=>{
    if(p.kind==="dm"){c.dm=c.dm||{};p.items.forEach(i=>{const r=c.dm[i.cap]=c.dm[i.cap]||{};if(i.after==null)delete r[i.k];else r[i.k]=i.after})}
    else{c.ct=c.ct||{};const mo=c.ct[p.ym]=c.ct[p.ym]||{};p.items.forEach(i=>{const r=mo[i.uid]=mo[i.uid]||{};if(i.after==null)delete r[i.k];else r[i.k]=i.after})}});toast("Đã duyệt, có hiệu lực ngay");renderMain()});
  m.querySelectorAll("[data-qkno]").forEach(b=>b.onclick=()=>{const p=find(b.dataset.qkno),why=prompt("Góp ý cho Lead:","");if(why===null)return;done(p,`CEO trả lại ${p.ten}${why?": "+why:""}`);toast("Đã trả lại, Lead nhận góp ý");renderMain()});
}

/* ---------- HCNS: Hiệu suất & lương thưởng ---------- */
function pQkHr(m){
  if(!(ME.role==="admin"||hrOk())){m.innerHTML=H("Hiệu suất & lương thưởng","")+qpNo("Chỉ HCNS và CEO.");return}
  const h=qkHr(),L=(h.muc&&h.muc.length?h.muc:[{tu:100,thuong:0}]);
  m.innerHTML=H("Hiệu suất & lương thưởng","Cách hiệu suất (tỉ lệ đạt định mức tháng) tính vào thưởng. Đang để tắt: hiệu suất chỉ để theo dõi.")+
   `<section class="card"><label class="row4" style="align-items:center;gap:10px"><input type="checkbox" id="qkh-on" ${h.on?"checked":""}><b>Tính hiệu suất vào thưởng</b></label>
    <p class="hint">Bật: trang KPI nhân sự của Lead hiện thêm cột "Thưởng dự kiến" theo bảng mức dưới. Bảng lương CHƯA tự lấy số này; khi CEO chốt cách tính sẽ nối vào bảng lương.</p></section>
   <section class="card"><h2 style="margin:0 0 6px">Bảng mức thưởng</h2>${tbl(["Đạt từ (% định mức tháng)","Thưởng (đồng)",""],L.map((r,i)=>`<tr><td><input type="number" min="0" max="300" data-qkt="${i}" value="${r.tu}"></td><td><input type="number" min="0" step="50000" data-qkb="${i}" value="${r.thuong}"></td><td><button class="btn sm" data-qkx="${i}">Bỏ</button></td></tr>`))}
    <div class="acts"><button class="btn" id="qkh-add">+ Thêm mức</button><button class="btn pri" id="qkh-save">Lưu</button></div></section>`;
  const read=()=>[...m.querySelectorAll("[data-qkt]")].map(x=>({tu:Number(x.value)||0,thuong:Number(m.querySelector(`[data-qkb="${x.dataset.qkt}"]`).value)||0}));
  const save=(muc,on)=>{DB.mutate(ME.name,"cài đặt hiệu suất & lương thưởng",d=>{d.qtpb=d.qtpb||{};d.qtpb.hrcfg={on,muc}});toast("Đã lưu");renderMain()};
  $("#qkh-add").onclick=()=>save(read().concat([{tu:120,thuong:0}]),$("#qkh-on").checked);
  m.querySelectorAll("[data-qkx]").forEach(b=>b.onclick=()=>save(read().filter((_,i)=>i!==Number(b.dataset.qkx)),$("#qkh-on").checked));
  $("#qkh-save").onclick=()=>save(read(),$("#qkh-on").checked);
}

/* ---------- Work Flow (Lead) ---------- */
const QK_WF=[
  {id:"video",ten:"Duyệt video final",lead:true,co:"Điều phối, Bảng video",steps:()=>[["Lead phòng","lead"],[qkVidCeo()?"CEO duyệt V2 (đang bật)":"CEO duyệt V2 (đang tắt)","CEO bật / tắt, Lead không bỏ được"]]},
  {id:"kb",ten:"Duyệt kịch bản",lead:true,co:"Điều phối",steps:()=>[["Lead phòng (người có quyền Duyệt kịch bản, video)","lead"]]},
  {id:"task",ten:"Duyệt việc giao (Task)",lead:true,co:"Công việc",steps:()=>[["Lead phòng","lead"],["CEO vòng 2 (khi việc bật duyệt 2 vòng)","Theo từng việc"]]},
  {id:"nghi",ten:"Xin nghỉ phép, tăng ca",lead:true,co:"Nghỉ phép & tăng ca",steps:()=>[["Lead phòng","lead"],["HCNS khi nghỉ từ số ngày HCNS đặt","HCNS đặt"]]},
  {id:"mua",ten:"Đề nghị mua đồ dùng",lead:true,tien:1,co:"Đồ dùng – thiết bị",steps:()=>[["Lead phòng","lead"],["Quản lý mua hàng","Giữ nguyên"],["CEO khi từ 5 triệu","Giữ nguyên"]]},
  {id:"mau",ten:"Lấy hàng mẫu đi quay",lead:true,tien:1,co:"Đồ dùng – thiết bị",steps:()=>[["Lead phòng","lead"],["Kế toán kho xuất kho","Giữ nguyên"]]},
  {id:"tamung",ten:"Tạm ứng lương",lead:false,tien:1,co:"Nghỉ phép & tạm ứng",steps:()=>[["Kế toán (dưới mức HCNS đặt)","Giữ nguyên"]]},
];
const qkHan=id=>(((qkDc().wf||{})[id])||{}).han||0;
/* Việc đang chờ Lead duyệt mà web thấy được ngay ở trình duyệt: video, kịch bản của người trong phòng; task chờ Lead. */
function qkWaiting(){const ids=new Set(D().users.filter(u=>u.phongBan===qpD()).map(u=>u.id)),now=Date.now(),o=[];
  const lastTo=(c,st)=>{const h=(c.history||[]).filter(x=>x.to===st).pop();return h?qkTime(h.t):0};
  (D().cards||[]).forEach(c=>{if(c.step==="dvd"&&ids.has(c.nguoiEdit||c.nguoi))o.push({wf:"video",ten:c.id+" · "+(c.tieuDe||c.ten||c.sku||""),ai:userName(c.nguoiEdit||c.nguoi),at:lastTo(c,"dvd")});
    if(c.step==="dkb"&&ids.has(c.nguoiKB||c.nguoi))o.push({wf:"kb",ten:c.id+" · "+(c.tieuDe||c.ten||c.sku||""),ai:userName(c.nguoiKB||c.nguoi),at:lastTo(c,"dkb")})});
  (D().tasks||[]).forEach(t=>{if(t.st==="review"&&t.vong!==2&&typeof tkAppr==="function"){let a=[];try{a=tkAppr(t)||[]}catch(e){}if(a.includes(ME.id))o.push({wf:"task",ten:t.ten,ai:userName(t.nguoi),at:qkTime(t.nopAt||t.stAt)})}});
  return o.map(x=>Object.assign(x,{gio:x.at?Math.floor((now-x.at)/3600000):null,han:qkHan(x.wf)})).sort((a,b)=>(b.gio||0)-(a.gio||0))}
function pQkWf(m){
  if(!qpAct()){m.innerHTML=qpDeptPick()+H("Work Flow","")+qpNo("Mục này dành cho Lead của phòng đã mở Quản trị phòng.");return}
  const W=qkWaiting(),over=W.filter(x=>x.han&&x.gio!=null&&x.gio>x.han);
  m.innerHTML=qpDeptPick()+H("Work Flow","Các luồng duyệt đang chạy của phòng "+esc(qpPb(qpD()))+". Lead đặt hạn duyệt cho bước của mình; bước của Quản lý mua hàng, Kế toán, Kế toán kho, HCNS, CEO giữ nguyên.")+
   `${QK_WF.map(f=>`<section class="card"><div class="row4" style="align-items:center;gap:10px"><b style="font-size:15px">${f.ten}</b>${f.tien?pill("Có tiền","gry"):""}<span style="flex:1"></span>${(()=>{const n=W.filter(x=>x.wf===f.id),o=n.filter(x=>x.han&&x.gio!=null&&x.gio>x.han).length;return n.length?`<span class="hint">Đang chờ Lead duyệt: <b>${n.length}</b>${o?` · <b style="color:#d93a3a">${o} quá hạn</b>`:""}</span>`:""})()}<span class="hint">Duyệt ở: ${esc(f.co)}</span></div>
     <ol style="margin:8px 0 0;padding-left:20px">${f.steps().map(([n,k])=>`<li style="margin:4px 0">${esc(n)} ${k==="lead"?`<span class="hint">· hạn duyệt</span> <input type="number" min="1" max="720" style="width:70px" data-qkh="${f.id}" value="${qkHan(f.id)||""}" placeholder="—"> <span class="hint">giờ</span>`:(f.id==="video"&&k!=="lead"&&ME.role==="admin"?`<label class="row4" style="display:inline-flex;align-items:center;gap:6px;margin-left:6px"><input type="checkbox" id="qk-vc" ${qkVidCeo()?"checked":""}> Bật</label>`:pill(k,"gry"))}</li>`).join("")}</ol>
     ${!f.lead?`<p class="hint">Luồng này không có bước của Lead.</p>`:""}</section>`).join("")}
   <div class="acts"><button class="btn pri" id="qk-wf">Lưu hạn duyệt</button></div>`;
  const vc=$("#qk-vc");if(vc)vc.onchange=()=>{const on=vc.checked;DB.mutate(ME.name,(on?"bật":"tắt")+" bước CEO duyệt video final",d=>{d.qtpb=d.qtpb||{};d.qtpb.cfg=Object.assign({},d.qtpb.cfg||{},{videoCeo:on})});toast(on?"Video final lại qua CEO duyệt":"Đã tắt bước CEO duyệt video final: Lead duyệt xong là sang Đăng");renderMain()};
  $("#qk-wf").onclick=()=>{const wf={};m.querySelectorAll("[data-qkh]").forEach(x=>{const v=Number(x.value);if(v>0)wf[x.dataset.qkh]={han:Math.min(720,Math.round(v))}});
    DB.mutate(ME.name,"sửa hạn duyệt Work Flow phòng "+qpPb(qpD()),d=>{d.qtpb=d.qtpb||{};d.qtpb.dept=d.qtpb.dept||{};const c=d.qtpb.dept[qpD()]=d.qtpb.dept[qpD()]||{};c.wf=wf});toast("Đã lưu hạn duyệt");renderMain()};
}

Object.assign(PAGES,{qp_kpi:pQkKpi,qp_wf:pQkWf,qp_ct:pQkCt,qp_hrkpi:pQkHr});

/* ---------- Công tắc CEO duyệt video final (CEO tắt thì Lead duyệt xong là sang Đăng) ---------- */
{
  const _na=nextAct;nextAct=function(c){const r=_na.apply(this,arguments);if(r&&r[1]==="dceo"&&!qkVidCeo())return [r[0],"dang"];return r};
  const _mv=moveCard;moveCard=function(u,id,to,inp){if(to==="dceo"&&!qkVidCeo()){const e=_mv(u,id,"dang",inp);if(!e)return e}return _mv(u,id,to,inp)};
  if(typeof ktApplyLead==="function"&&typeof ktApplyDuyet==="function"){const _kl=ktApplyLead;ktApplyLead=function(dt,k){if(!qkVidCeo())return ktApplyDuyet(dt,k);return _kl.apply(this,arguments)}}
}
