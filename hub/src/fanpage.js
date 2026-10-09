/* =====================================================================
   FANPAGE
   ① Kế hoạch: tuyến nội dung (tuyến gì, mục tiêu gì, bao nhiêu bài) + nhịp đăng theo tuần (bài tĩnh / video).
   ② Điều phối: lịch đăng chi tiết từng bài, mô phỏng file "AILLA CONTENT CALENDAR · LỊCH ĐĂNG CHI TIẾT":
      ngày đăng, thứ, tuần, tuyến, format, chủ đề, hook, nội dung, CTA, brief ảnh/video, text trên ảnh, PIC, trạng thái.
   Mỗi bài là một thẻ video của kênh Fanpage (mix "bai"), tuyến nằm ở d.fpPlan, nhịp ở d.fpNhip.
   ===================================================================== */
const FP_FMT=["Ảnh","Ảnh carousel","Ảnh infographic","Ảnh so sánh","Ảnh Q&A","Video"];
const FP_DANG=["Hỗn hợp"].concat(FP_FMT);
const FP_PIC=["Content","Design","Media","Ads","Sale","Khác"];
const FP_ST=[["cg","Chưa làm"],["kb","Đang làm"],["dvd","Chờ duyệt"],["dang","Đã duyệt"],["xong","Đã đăng"]];
const FP_THU=["CN","T2","T3","T4","T5","T6","T7"];
const FP={tuyen:"",st:"",fmt:"",w:"",ng:""},FP_OPEN=new Set();
const fpStOf=c=>c.step==="xong"?"xong":c.step==="dang"?"dang":["dkb","dvd","dceo"].includes(c.step)?"dvd":["kb","edit","worker","quay"].includes(c.step)?"kb":"cg";
const fpVid=c=>/video|reel/i.test(c.dangVideo||"");
const fpWk=c=>+c.day?(weekOf(+c.day)||0):0;
const fpThu=day=>day?FP_THU[new Date(MONTH.year,MONTH.mon-1,day).getDay()]:"—";
const fpFold=s=>String(s==null?"":s).normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase().trim();
const fpMine=c=>[c.nguoi,c.nguoiKB,c.nguoiEdit,c.nguoiQuay,c.giao].includes(ME.id);
function bvFpTop(){return ""}

/* ---------- ① Kế hoạch Fanpage ---------- */
function fpPlanHtml(d,give,ch){
  const L=d.fpPlan||[],team=xvTeam(),tot=sum(L,x=>+x.sl||0),have=r=>d.cards.filter(c=>c.kenh===ch.k&&c.fpId===r.id).length,nh=d.fpNhip||{},W5=PB_W();
  const inp=(r,f,ph)=>`<input class="fpi" data-fp="${esc(r.id)}|${f}" value="${esc(r[f]||"")}" placeholder="${ph}" ${give?"":"disabled"}>`;
  const nIn=(w,f)=>{const v=(nh[w]||{})[f];return give?`<input type="number" min="0" class="num fpi" data-fpn="${w}|${f}" value="${v==null||v===""?"":v}" placeholder="0">`:`<b>${v||0}</b>`};
  const nT=sum(W5,w=>(+(nh[w.w]||{}).tinh||0)+(+(nh[w.w]||{}).video||0)),nSet=W5.some(w=>(nh[w.w]||{}).tinh!=null||(nh[w.w]||{}).video!=null);
  const chk=!tot?"":!nSet?"":nT===tot?`<span class="knchk ok">Nhịp đăng cộng ${nT} bài, khớp số bài các tuyến ✓</span>`:`<span class="knchk bad">Nhịp đăng cộng <b>${nT}</b> bài, các tuyến <b>${tot}</b> bài → <b>${nT>tot?"thừa "+(nT-tot):"thiếu "+(tot-nT)}</b> bài</span>`;
  return `<div class="wpch"><div class="pbbox"><div class="pbh"><b>Kế hoạch bài đăng · ${esc(ch.short)}</b> · tổng tháng: <b>${tot}</b> bài</div>
   <p class="hint">Fanpage lên kế hoạch theo tuyến nội dung: tuyến gì, mục tiêu gì, bao nhiêu bài. Điền xong, bước ② Điều phối là lịch đăng chi tiết từng bài.</p>
   ${L.length?`<div class="tbl"><table class="fptab"><thead><tr><th>Tuyến nội dung</th><th>Mục tiêu</th><th>Số bài</th><th>Dạng bài</th><th>Người phụ trách</th><th>Đã có ở Điều phối</th><th></th></tr></thead><tbody>${L.map(r=>`<tr><td>${inp(r,"tuyen","VD: Chia sẻ kiến thức")}</td><td>${inp(r,"mucTieu","VD: Tăng giá trị fanpage, lượt lưu")}</td><td><input type="number" min="0" class="num fpi" data-fp="${esc(r.id)}|sl" value="${+r.sl||""}" placeholder="0" ${give?"":"disabled"}></td><td><select data-fp="${esc(r.id)}|dang" ${give?"":"disabled"}>${opt(FP_DANG.map(x=>[x,x]),r.dang||"Hỗn hợp")}</select></td><td><select data-fp="${esc(r.id)}|nguoi" ${give?"":"disabled"}>${opt([["","—"]].concat(team.map(u=>[u.id,u.name])),r.nguoi||"")}</select></td><td>${have(r)}/${+r.sl||0}</td><td>${give?`<button type="button" class="lnk danger" data-fpdel="${esc(r.id)}">Xóa</button>`:""}</td></tr>`).join("")}</tbody></table></div>`:`<p class="empty">Chưa có tuyến nào. Bấm "+ Thêm tuyến", hoặc vào ② Điều phối bấm "Nhập từ Excel" để lấy cả tuyến và lịch đăng từ file lịch nội dung.</p>`}
   ${give?`<p><button type="button" class="btn sm" data-fpadd="1">+ Thêm tuyến</button></p>`:""}
   <div class="fpnhip"><b>Nhịp đăng theo tuần</b><span class="hint">ví dụ 4 bài ảnh + 2 video mỗi tuần</span>
    <table class="fptab"><thead><tr><th></th>${W5.map(w=>`<th class="n">Tuần ${w.w}<small>${dd(w.tu)}–${dd(w.den)}</small></th>`).join("")}<th class="n">Cộng</th></tr></thead><tbody>
     <tr><td>Bài tĩnh (ảnh)</td>${W5.map(w=>`<td class="n">${nIn(w.w,"tinh")}</td>`).join("")}<td class="n"><b>${sum(W5,w=>+(nh[w.w]||{}).tinh||0)}</b></td></tr>
     <tr><td>Video</td>${W5.map(w=>`<td class="n">${nIn(w.w,"video")}</td>`).join("")}<td class="n"><b>${sum(W5,w=>+(nh[w.w]||{}).video||0)}</b></td></tr>
     <tr class="knt"><td><b>Tổng bài</b></td>${W5.map(w=>`<td class="n"><b>${(+(nh[w.w]||{}).tinh||0)+(+(nh[w.w]||{}).video||0)}</b></td>`).join("")}<td class="n"><b>${nT}</b></td></tr></tbody></table>${chk}</div>
   </div></div>`
}
function fpBind(b){
  b.querySelectorAll("[data-fp]").forEach(i=>i.onchange=()=>{const [id,f]=i.dataset.fp.split("|"),v=String(i.value).trim();
    DB.mutate(ME.name,"kế hoạch Fanpage: sửa tuyến",dt=>{const r=(dt.fpPlan||[]).find(x=>x.id===id);if(!r)return;r[f]=f==="sl"?Math.max(0,Math.floor(+v||0)):v;
      dt.cards.forEach(c=>{if(c.fpId!==id)return;if(f==="tuyen")c.tuyen=v;else if(f==="mucTieu"&&!c.mucTieuRieng)c.mucTieu=v})});renderMain()});
  b.querySelectorAll("[data-fpn]").forEach(i=>i.onchange=()=>{const [w,f]=i.dataset.fpn.split("|"),raw=String(i.value).trim();DB.mutate(ME.name,"nhịp đăng Fanpage tuần "+w,dt=>{dt.fpNhip=dt.fpNhip||{};const o=dt.fpNhip[w]=Object.assign({},dt.fpNhip[w]||{});if(raw==="")delete o[f];else o[f]=Math.max(0,Math.floor(+raw||0))});renderMain()});
  b.querySelectorAll("[data-fpadd]").forEach(x=>x.onclick=()=>{DB.mutate(ME.name,"thêm tuyến Fanpage",dt=>{dt.fpPlan=dt.fpPlan||[];dt.fpPlan.push({id:uid("fp"),tuyen:"",mucTieu:"",sl:0,dang:"Hỗn hợp",nguoi:""})});renderMain()});
  b.querySelectorAll("[data-fpdel]").forEach(x=>x.onclick=()=>{const id=x.dataset.fpdel,d0=D(),mine=d0.cards.filter(c=>c.fpId===id),emp=mine.filter(c=>["cg","kb"].includes(c.step)&&!c.hookText&&!c.noiDung&&!c.linkVideo&&!c.linkFinal);
    if(!confirm("Xóa tuyến này?"+(emp.length?" "+emp.length+" dòng bài chưa làm của tuyến cũng bị xóa.":"")+(mine.length-emp.length?" "+(mine.length-emp.length)+" bài đã có nội dung được giữ lại.":"")))return;
    DB.mutate(ME.name,"xóa tuyến Fanpage",dt=>{dt.fpPlan=(dt.fpPlan||[]).filter(r=>r.id!==id);const del=new Set(emp.map(c=>c.id));dt.cards=dt.cards.filter(c=>!del.has(c.id))});renderMain()});
}

/* ---------- ② Lịch đăng chi tiết ---------- */
function fpNewPost(dt,kenh,fpId){
  const c=bvNewCard(dt,"TH",kenh,"bai"),r=(dt.fpPlan||[]).find(x=>x.id===fpId);
  if(r){c.fpId=r.id;c.tuyen=r.tuyen||"";c.mucTieu=r.mucTieu||"";if(r.dang&&r.dang!=="Hỗn hợp")c.dangVideo=r.dang;if(r.nguoi)c.nguoi=r.nguoi}
  c.dangVideo=c.dangVideo&&FP_FMT.includes(c.dangVideo)?c.dangVideo:"Ảnh";return c
}
function pFanpageLich(m,chs){
  const d=D(),lead=xvGive(),kenh=BV.k,team=xvTeam(),plan=d.fpPlan||[],all=d.cards.filter(c=>c.kenh===kenh),nh=d.fpNhip||{};
  const rows=all.filter(c=>(lead||fpMine(c))&&(!FP.tuyen||c.fpId===FP.tuyen)&&(!FP.st||fpStOf(c)===FP.st)&&(!FP.fmt||c.dangVideo===FP.fmt)&&(!FP.w||String(fpWk(c))===FP.w)&&(!FP.ng||[c.nguoi,c.nguoiKB,c.nguoiEdit,c.giao].includes(FP.ng)))
    .sort((a,b)=>((+a.day||99)-(+b.day||99))||String(a.id).localeCompare(String(b.id)));
  const can1=c=>lead||fpMine(c),dis=c=>can1(c)?"":"disabled";
  const n0=all.filter(c=>!+c.day).length,duyet=all.filter(c=>["dang","xong"].includes(c.step)).length,dang=all.filter(c=>c.step==="xong").length,planN=sum(plan,x=>+x.sl||0)||all.length;
  const W5=PB_W(),groups=[0].concat(W5.map(w=>w.w)).map(w=>({w,L:rows.filter(c=>fpWk(c)===w)})).filter(g=>g.L.length);
  const selO=(arr,v)=>opt(arr,v);
  const tuyOpt=[["","—"]].concat(plan.map(r=>[r.id,r.tuyen||"(chưa đặt tên)"]));
  const peopleOpt=[["","—"]].concat(team.map(u=>[u.id,u.name]));
  const wkHead=g=>{if(!g.w)return `<b>Chưa xếp ngày</b><span class="hint">${g.L.length} bài · bấm "Chọn ngày" hoặc "Tự xếp ngày"</span>`;const W=W5.find(x=>x.w===g.w),vd=g.L.filter(fpVid).length,ti=g.L.length-vd,pl=(+(nh[g.w]||{}).tinh||0)+(+(nh[g.w]||{}).video||0),cnt=all.filter(c=>fpWk(c)===g.w).length;
    return `<b>Tuần ${g.w} (${dd(W.tu)}–${dd(W.den)})</b><span class="hint">${g.L.length} bài · ${ti} bài tĩnh · ${vd} video</span>${pl?(cnt===pl?`<span class="pill p-grn">đủ nhịp ${pl} bài</span>`:`<span class="pill p-amb">nhịp ${pl} bài · ${cnt>pl?"thừa "+(cnt-pl):"thiếu "+(pl-cnt)}</span>`):""}`};
  const post=(c,i)=>{const st=fpStOf(c),op=FP_OPEN.has(c.id),late=c.day&&c.day<d.settings.today&&!["dang","xong"].includes(c.step);
    return `<tr class="fpr${op?" open":""}${late?" late":""}" data-fpr="${esc(c.id)}"><td><button type="button" class="lnk fpx" data-fpo="${esc(c.id)}" title="Mở chi tiết bài">${op?"▾":"▸"}</button></td><td class="fpstt">${i+1}</td>
     <td><button type="button" class="bvhan${+c.day?"":" none"}" data-fpday="${esc(c.id)}" ${dis(c)}>${+c.day?dd(+c.day):"Chọn ngày"} ▾</button></td><td class="fpthu">${fpThu(+c.day)}</td>
     <td><select data-fpc="${esc(c.id)}|fpId" ${dis(c)}>${selO(tuyOpt,c.fpId||"")}</select></td>
     <td><select data-fpc="${esc(c.id)}|dangVideo" ${dis(c)}>${selO(FP_FMT.map(x=>[x,x]),c.dangVideo||"Ảnh")}</select></td>
     <td><input class="fpi" data-fpc="${esc(c.id)}|chuDe" value="${esc(c.chuDe||"")}" placeholder="Sản phẩm / chủ đề" ${dis(c)}></td>
     <td class="fphook"><input class="fpi" data-fpc="${esc(c.id)}|hookText" value="${esc(c.hookText||"")}" placeholder="Tiêu đề / hook" ${dis(c)}></td>
     <td><select data-fpc="${esc(c.id)}|pic" ${dis(c)}>${selO([["","—"]].concat(FP_PIC.map(x=>[x,x])),c.pic||"")}</select></td>
     <td><select data-fpc="${esc(c.id)}|nguoi" ${lead?"":"disabled"}>${selO(peopleOpt,c.nguoi||"")}</select></td>
     <td><select class="bvst2 s-${st}" data-fpst="${esc(c.id)}" ${dis(c)}>${selO(FP_ST,st)}</select>${late?` <span class="pill p-red">trễ</span>`:""}</td></tr>
     ${op?`<tr class="fpdet"><td></td><td colspan="10"><div class="fpdg">
      <label>Mục tiêu<input class="fpi" data-fpc="${esc(c.id)}|mucTieu" value="${esc(c.mucTieu||"")}" ${dis(c)}></label>
      <label>CTA<input class="fpi" data-fpc="${esc(c.id)}|cta" value="${esc(c.cta||"")}" ${dis(c)}></label>
      <label class="w2">Nội dung bài đăng chi tiết<textarea rows="5" data-fpc="${esc(c.id)}|noiDung" ${dis(c)}>${esc(c.noiDung||"")}</textarea></label>
      <label>Brief ảnh / video<textarea rows="4" data-fpc="${esc(c.id)}|briefHinh" ${dis(c)}>${esc(c.briefHinh||"")}</textarea></label>
      <label>Text chính trên ảnh<textarea rows="4" data-fpc="${esc(c.id)}|textAnh" ${dis(c)}>${esc(c.textAnh||"")}</textarea></label>
      <label>Link bài đã đăng<input class="fpi" data-fpc="${esc(c.id)}|linkDang" value="${esc(c.linkDang||"")}" placeholder="https://facebook.com/…" ${dis(c)}></label>
      <label>Link ảnh / video thành phẩm<input class="fpi" data-fpc="${esc(c.id)}|linkVideo" value="${esc(c.linkFinal||c.linkVideo||"")}" placeholder="Link Drive" ${dis(c)}></label>
      ${lead?`<div class="fpdd"><button type="button" class="lnk danger" data-fpdelp="${esc(c.id)}">Xóa bài này</button></div>`:""}</div></td></tr>`:""}`};
  m.innerHTML=`<div class="seg ptk">${chs.map(c=>`<button data-bvk="${esc(c.k)}" class="${c.k===BV.k?"on":""}">${esc(c.short)} <span class="xbadge">${bvTabN(d,c.k)}</span></button>`).join("")}</div>
  <section class="card bvtop"><div class="bvstats"><span><b>${planN}</b> bài kế hoạch</span><span><b>${all.length}</b> đã có trong lịch</span><span class="${n0?"lack":""}"><b>${n0}</b> chưa xếp ngày</span><span><b>${duyet}</b> đã duyệt</span><span><b>${dang}</b> đã đăng</span></div>
   <div class="bvchips">${plan.map(r=>{const n=all.filter(c=>c.fpId===r.id).length;return `<button type="button" class="bvchip${FP.tuyen===r.id?" on":""}" data-fptu="${esc(r.id)}">${esc(r.tuyen||"(chưa đặt tên)")} <b>${n}/${+r.sl||0}</b></button>`}).join("")||`<span class="hint">Chưa có tuyến. Thêm ở ① Kế hoạch › Fanpage, hoặc bấm "Nhập từ Excel".</span>`}</div></section>
  <section class="card flush"><div class="bvbar"><select data-fpf="tuyen">${opt([["","Mọi tuyến"]].concat(plan.map(r=>[r.id,r.tuyen||"(chưa đặt tên)"])),FP.tuyen)}</select><select data-fpf="fmt">${opt([["","Mọi format"]].concat(FP_FMT.map(x=>[x,x])),FP.fmt)}</select><select data-fpf="w">${opt([["","Mọi tuần"],["0","Chưa xếp ngày"]].concat(W5.map(w=>[String(w.w),"Tuần "+w.w])),FP.w)}</select><select data-fpf="st">${opt([["","Mọi trạng thái"]].concat(FP_ST.map(x=>[x[0],x[1]])),FP.st)}</select>${lead?`<select data-fpf="ng">${opt([["","Mọi người"]].concat(team.map(u=>[u.id,u.name])),FP.ng)}</select>`:""}<span class="hint">${rows.length} bài</span>
    ${lead?`<span class="bvrt"><button type="button" class="btn sm" data-fpimp="1" title="Lấy tuyến và lịch đăng chi tiết từ file Excel lịch nội dung">⬆ Nhập từ Excel</button><button type="button" class="btn sm" data-fpauto="1" title="Xếp các bài chưa có ngày vào những ngày còn trống">Tự xếp ngày</button><button type="button" class="btn pri sm" data-fpnew="1">+ Thêm bài</button><input type="file" id="fp-file" accept=".xlsx,.xlsm,.xls" hidden></span>`:""}</div>
   ${groups.map(g=>`<div class="fpwk"><div class="fpwh">${wkHead(g)}</div><div class="tbl bvscroll"><table class="bvtab fplich"><thead><tr><th></th><th>STT</th><th>Ngày đăng</th><th>Thứ</th><th>Tuyến nội dung</th><th>Format</th><th>Sản phẩm / Chủ đề</th><th>Tiêu đề / Hook</th><th>PIC</th><th>Người làm</th><th>Trạng thái</th></tr></thead><tbody>${g.L.map(c=>post(c,rows.indexOf(c))).join("")}</tbody></table></div></div>`).join("")||`<p class="empty pad">Chưa có bài nào. Bấm "Nhập từ Excel" để lấy lịch đăng chi tiết từ file, hoặc "+ Thêm bài".</p>`}</section>`;
  fpLichBind(m,rows,all);
}
function fpLichBind(m,rows,all){
  const d=D();
  m.querySelectorAll("[data-bvk]").forEach(b=>b.onclick=()=>{BV.k=b.dataset.bvk;renderMain()});
  m.querySelectorAll("[data-fptu]").forEach(b=>b.onclick=()=>{FP.tuyen=FP.tuyen===b.dataset.fptu?"":b.dataset.fptu;renderMain()});
  m.querySelectorAll("[data-fpf]").forEach(s=>s.onchange=()=>{FP[s.dataset.fpf]=s.value;renderMain()});
  m.querySelectorAll("[data-fpo]").forEach(b=>b.onclick=()=>{const id=b.dataset.fpo;FP_OPEN.has(id)?FP_OPEN.delete(id):FP_OPEN.add(id);bvRe()});
  m.querySelectorAll("[data-fpday]").forEach(b=>b.onclick=()=>{const id=b.dataset.fpday,c=D().cards.find(x=>x.id===id);bvCal(b,c?+c.day||0:0,v=>{DB.mutate(ME.name,"đặt ngày đăng "+id,dt=>{const k=dt.cards.find(x=>x.id===id);if(k)k.day=+v||0});bvRe()},[["0","Chưa xếp ngày"]])});
  m.querySelectorAll("[data-fpc]").forEach(i=>i.onchange=()=>{const [id,f]=i.dataset.fpc.split("|"),v=i.value;DB.mutate(ME.name,"sửa bài Fanpage "+id,dt=>{const c=dt.cards.find(x=>x.id===id);if(!c)return;
    if(f==="fpId"){const r=(dt.fpPlan||[]).find(x=>x.id===v);c.fpId=v;c.tuyen=r?r.tuyen:"";if(r&&!c.mucTieu)c.mucTieu=r.mucTieu||""}
    else if(f==="mucTieu"){c.mucTieu=v;c.mucTieuRieng=1}
    else if(f==="linkVideo"){c.linkVideo=v.trim();if(c.linkFinal)c.linkFinal=v.trim()}
    else if(f==="linkDang")c.linkDang=v.trim();
    else if(f==="nguoi"){c.nguoi=v;c.nguoiEdit=v;c.nguoiKB=v}
    else c[f]=v});bvRe()});
  m.querySelectorAll("[data-fpst]").forEach(s=>s.onchange=()=>{const id=s.dataset.fpst,to=s.value,c=D().cards.find(x=>x.id===id);if(!c)return;
    const boss=xvGive()||can(ME,"viec.duyet")||ME.role==="admin";
    if(["dang"].includes(to)&&!boss){toast("Chỉ người duyệt mới chuyển sang Đã duyệt");bvRe();return}
    if(to==="xong"&&!boss){toast("Chỉ lead hoặc người duyệt mới chuyển sang Đã đăng");bvRe();return}
    if(to==="xong"&&!String(c.linkDang||"").trim()){toast("Mở chi tiết bài, dán link bài đã đăng rồi chuyển Đã đăng");bvRe();return}
    DB.mutate(ME.name,"chuyển bài "+id+" sang "+(FP_ST.find(x=>x[0]===to)||[])[1],dt=>{const k=dt.cards.find(x=>x.id===id);if(!k)return;k.step=to;if(to==="xong")k.ngayDang=dt.settings.today;k.history=(k.history||[]).concat({t:new Date().toLocaleString("vi-VN"),who:ME.name,to:to})});bvRe()});
  m.querySelectorAll("[data-fpdelp]").forEach(b=>b.onclick=()=>{const id=b.dataset.fpdelp;if(!confirm("Xóa bài này khỏi lịch?"))return;DB.mutate(ME.name,"xóa bài Fanpage "+id,dt=>{const c0=dt.cards.find(c=>c.id===id),r=c0&&(dt.fpPlan||[]).find(z=>z.id===c0.fpId);if(r&&+r.sl>0)r.sl=+r.sl-1;dt.cards=dt.cards.filter(c=>c.id!==id)});renderMain()});
  const nw=m.querySelector("[data-fpnew]");if(nw)nw.onclick=()=>{const k=BV.k,fid=FP.tuyen||((d.fpPlan||[])[0]||{}).id||"";DB.mutate(ME.name,"thêm bài Fanpage",dt=>{dt.cards.push(fpNewPost(dt,k,fid))});renderMain()};
  const au=m.querySelector("[data-fpauto]");if(au)au.onclick=()=>{
    const k=BV.k,U=D().cards.filter(c=>c.kenh===k&&!+c.day&&!["xong"].includes(c.step)).sort((a,b)=>String(a.fpId).localeCompare(String(b.fpId))||String(a.id).localeCompare(String(b.id)));
    if(!U.length){toast("Không còn bài nào chưa có ngày");return}
    const td=D().settings.today,cnt={};D().cards.filter(c=>c.kenh===k&&+c.day).forEach(c=>{cnt[c.day]=(cnt[c.day]||0)+1});
    const days=[];for(let x=Math.max(1,td);x<=MONTH.ndays;x++){if(new Date(MONTH.year,MONTH.mon-1,x).getDay()!==0)days.push(x)}
    if(!days.length){toast("Hết ngày trong tháng để xếp");return}
    DB.mutate(ME.name,"tự xếp ngày đăng Fanpage "+U.length+" bài",dt=>{U.forEach(u=>{const c=dt.cards.find(x=>x.id===u.id);if(!c)return;let best=days[0];days.forEach(x=>{if((cnt[x]||0)<(cnt[best]||0))best=x});c.day=best;cnt[best]=(cnt[best]||0)+1})});
    toast("Đã xếp ngày cho "+U.length+" bài. Chị chỉnh lại từng bài nếu cần");renderMain()};
  const im=m.querySelector("[data-fpimp]"),fi=m.querySelector("#fp-file");if(im&&fi){im.onclick=()=>fi.click();fi.onchange=()=>{if(fi.files[0])fpImport(fi.files[0]);fi.value=""}}
}

/* Nhập từ file lịch nội dung: sheet "LỊCH ĐĂNG CHI TIẾT" (từng bài) và sheet "ĐỊNH HƯỚNG TUYẾN" (tuyến, số bài, mục tiêu) nếu có */
function fpImport(file){
  if(typeof XLSX==="undefined"){toast("Cần mạng để đọc file Excel");return}
  const fr=new FileReader();
  fr.onload=()=>{try{
    const wb=XLSX.read(fr.result,{type:"array",cellDates:true}),rowsOf=n=>XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:""});
    const nm=wb.SheetNames.find(n=>/chi\s*tiet/.test(fpFold(n)));if(!nm){toast("Không thấy sheet LỊCH ĐĂNG CHI TIẾT trong file");return}
    const A=rowsOf(nm),hi=A.findIndex(r=>r.some(c=>fpFold(c)==="ngay dang")&&r.some(c=>/^tuyen/.test(fpFold(c))));if(hi<0){toast("Không thấy dòng tiêu đề (Ngày đăng, Tuyến nội dung…)");return}
    const H=A[hi].map(fpFold),ix=(...ks)=>H.findIndex(h=>ks.some(k=>h.includes(k)));
    const C={day:ix("ngay dang"),tuyen:ix("tuyen"),fmt:ix("format"),chude:ix("san pham","chu de"),mt:ix("muc tieu"),hook:ix("tieu de","hook"),nd:ix("noi dung bai"),cta:ix("cta"),brief:ix("brief"),text:ix("text chinh","text tren"),pic:ix("pic"),st:ix("trang thai")};
    const toDay=v=>{if(v instanceof Date&&!isNaN(v)){const t=new Date(v.getTime()+12*3600e3);return t.getUTCMonth()+1===MONTH.mon?t.getUTCDate():0}
      if(typeof v==="number"&&v>40000){const t=new Date(Math.round((v-25569)*86400e3)+12*3600e3);return t.getUTCMonth()+1===MONTH.mon?t.getUTCDate():0}
      const s=String(v||"").trim(),a=s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/),b=s.match(/(\d{1,2})\/(\d{1,2})/);if(a)return +a[2]===MONTH.mon?+a[3]:0;if(b)return +b[2]===MONTH.mon?+b[1]:0;return 0};
    const g=(r,k)=>C[k]>=0?String(r[C[k]]==null?"":r[C[k]]).trim():"";
    const P=A.slice(hi+1).filter(r=>g(r,"hook")||g(r,"chude")).map(r=>({day:toDay(r[C.day]),tuyen:g(r,"tuyen"),fmt:g(r,"fmt"),chude:g(r,"chude"),mt:g(r,"mt"),hook:g(r,"hook"),nd:g(r,"nd"),cta:g(r,"cta"),brief:g(r,"brief"),text:g(r,"text"),pic:g(r,"pic"),st:fpFold(g(r,"st"))}));
    if(!P.length){toast("Không có bài nào trong file");return}
    const dir={},tn=wb.SheetNames.find(n=>/dinh huong/.test(fpFold(n)));
    if(tn){const T=rowsOf(tn),h2=T.findIndex(r=>r.some(c=>fpFold(c)==="tuyen")&&r.some(c=>/so bai/.test(fpFold(c))));if(h2>=0){const hh=T[h2].map(fpFold),it=hh.findIndex(x=>x==="tuyen"),is=hh.findIndex(x=>/so bai/.test(x)),im=hh.findIndex(x=>/muc tieu/.test(x));T.slice(h2+1).forEach(r=>{const t=String(r[it]||"").trim();if(t)dir[fpFold(t)]={sl:+r[is]||0,mt:im>=0?String(r[im]||"").trim():""}})}}
    const kenh=BV.k,old=D().cards.filter(c=>c.kenh===kenh),seen=new Set(old.map(c=>(+c.day||0)+"|"+fpFold(c.hookText)));
    const fresh=P.filter(p=>!seen.has(p.day+"|"+fpFold(p.hook)));
    if(!fresh.length){toast("Các bài trong file đã có đủ trong lịch");return}
    if(!confirm("Nhập "+fresh.length+" bài (bỏ qua "+(P.length-fresh.length)+" bài đã có) vào lịch Fanpage tháng "+MONTH.mon+"?"))return;
    const STM={"chua lam":"cg","dang lam":"kb","cho duyet":"dvd","da duyet":"dang","da dang":"xong"};
    DB.mutate(ME.name,"nhập lịch đăng Fanpage từ Excel ("+fresh.length+" bài)",dt=>{
      dt.fpPlan=dt.fpPlan||[];
      fresh.forEach(p=>{
        const key=fpFold(p.tuyen)||"khac";let r=dt.fpPlan.find(x=>fpFold(x.tuyen)===key);
        if(!r){r={id:uid("fp"),tuyen:p.tuyen||"Khác",mucTieu:(dir[key]||{}).mt||p.mt||"",sl:0,dang:"Hỗn hợp",nguoi:""};dt.fpPlan.push(r)}
        const c=fpNewPost(dt,kenh,r.id);
        c.day=p.day;c.fpId=r.id;c.tuyen=r.tuyen;c.chuDe=p.chude;c.mucTieu=p.mt||r.mucTieu;if(p.mt)c.mucTieuRieng=1;c.hookText=p.hook;c.noiDung=p.nd;c.cta=p.cta;c.briefHinh=p.brief;c.textAnh=p.text;
        c.dangVideo=FP_FMT.find(x=>fpFold(x)===fpFold(p.fmt))||(/video/.test(fpFold(p.fmt))?"Video":"Ảnh");
        if(FP_PIC.includes(p.pic))c.pic=p.pic;
        c.step=STM[p.st]||"cg";
        dt.cards.push(c)});
      dt.fpPlan.forEach(r=>{const n=dt.cards.filter(c=>c.kenh===kenh&&c.fpId===r.id).length,want=(dir[fpFold(r.tuyen)]||{}).sl||0;r.sl=Math.max(+r.sl||0,n,want)})});
    toast("Đã nhập "+fresh.length+" bài vào lịch Fanpage");renderMain()
  }catch(e){toast("Không đọc được file: "+(e&&e.message||e))}};
  fr.readAsArrayBuffer(file)
}
