/* =====================================================================
   CÔNG VIỆC › TỔNG QUAN VIỆC (dashboard, chị Hoa duyệt demo 02/11/2026)
   Cho Lead / quản lý chăm việc hằng ngày: việc đang mở, trễ hạn, chờ mình duyệt, tải việc từng người, hạn 7 ngày tới,
   hoàn thành theo tuần. Lấy đúng danh sách việc của trang Việc (cvItems + cvFilter trong congviec.js), không có số riêng.
   Kết quả video của team (số video, kênh, sản phẩm, video win) ở Marketing › Content › Tổng quan (tqcontent2.js).
   ===================================================================== */
let DV={scope:""};
const DV_CSS=`<style>
.dv .dvtop{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.dv .dvtop button{border:1px solid #e5e7f0;background:var(--surface,#fff);border-radius:20px;padding:6px 14px;font-weight:600;font-size:13px;cursor:pointer}.dv .dvtop button.on{background:#4f46e5;color:#fff;border-color:#4f46e5}
.dv .dvk{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:14px}.dv .dvk>div{background:var(--surface,#fff);border-radius:14px;padding:12px 14px;border-left:5px solid #2563eb}
.dv .dvk small{display:block;color:#6b7280;font-size:12px}.dv .dvk b{display:block;font-size:26px;line-height:1.25}.dv .dvk i{font-style:normal;font-size:11.5px;color:#6b7280}
.dv .dvk .a{border-color:#d97706}.dv .dvk .r{border-color:#dc2626}.dv .dvk .r b{color:#dc2626}.dv .dvk .p{border-color:#7c3aed}.dv .dvk .g{border-color:#16a34a}
.dv .dvkb{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}.dv .dvcol{background:#eef0f7;border-radius:14px;padding:10px}.dv .dvcol h3{font-size:13px;margin:2px 4px 8px;display:flex;justify-content:space-between}.dv .dvcol h3 span{color:#6b7280;font-weight:500}
.dv .dvt{background:var(--surface,#fff);border-radius:10px;padding:8px 10px;margin-bottom:7px;font-size:12.5px;border-left:3px solid #cbd5e1;cursor:pointer}.dv .dvt b{display:block;font-weight:600;font-size:13px}.dv .dvt .m{display:flex;justify-content:space-between;gap:6px;color:#6b7280;margin-top:3px}
.dv .dvt.late{border-color:#dc2626}.dv .dvt.late .h{color:#dc2626;font-weight:600}.dv .dvt.soon{border-color:#d97706}.dv .dvt.rv{border-color:#7c3aed}.dv .dvt.ok{border-color:#16a34a}
.dv .dvmore{font-size:12px;color:#4f46e5;cursor:pointer;padding:2px 6px}
.dv .av{display:inline-flex;width:20px;height:20px;border-radius:50%;background:#e0e7ff;color:#3730a3;font-size:11px;align-items:center;justify-content:center;font-weight:700;margin-right:4px;flex:none}
.dv .dvg2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;margin-bottom:14px}.dv .dvg3{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr);gap:14px}
.dv .card.dvc{padding:16px 18px;margin:0}.dv h2.dvh{font-size:15px;margin:0 0 10px;display:flex;align-items:center;gap:8px}.dv h2.dvh small{color:#6b7280;font-weight:400;font-size:12px}.dv h2.dvh .n{background:#eef2ff;color:#4f46e5;border-radius:20px;padding:0 8px;font-size:12px}
.dv .dvr{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #eceef5;font-size:13px}.dv .dvr:last-child{border:0}.dv .dvr .w{flex:1;min-width:0;cursor:pointer}.dv .dvr .w small{display:block;color:#6b7280}
.dv .bad{background:#fee2e2;color:#991b1b;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:600;white-space:nowrap}.dv .wait{background:#ede9fe;color:#5b21b6;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:600;white-space:nowrap}
.dv .load{display:grid;grid-template-columns:96px minmax(0,1fr) 64px;gap:8px;align-items:center;font-size:13px;margin:7px 0}.dv .lb{height:16px;display:flex;border-radius:5px;overflow:hidden;background:#eef0f7}.dv .lb i{display:block}
.dv .dvleg{display:flex;gap:10px;font-size:11.5px;color:#6b7280;flex-wrap:wrap}.dv .dvleg em{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px}
.dv .cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.dv .cal div{background:#f8f9fd;border-radius:10px;padding:8px 4px;text-align:center;font-size:12px}.dv .cal b{display:block;font-size:18px}.dv .cal .hot{background:#fee2e2}.dv .cal .warm{background:#fef3c7}
.dv .empty{color:#6b7280;padding:10px 0;text-align:center;font-size:13px}
@media(max-width:1100px){.dv .dvk{grid-template-columns:repeat(3,minmax(0,1fr))}.dv .dvkb{grid-template-columns:repeat(2,minmax(0,1fr))}.dv .dvg2,.dv .dvg3{grid-template-columns:1fr}}
@media(max-width:640px){.dv .dvk{grid-template-columns:repeat(2,minmax(0,1fr))}.dv .dvkb{grid-template-columns:1fr}}
</style>`;
const dvMgr=()=>!!ME&&(ME.role==="admin"||ME.role==="lead"||ME.role==="truongphong"||can(ME,"viec.giao"));
/* danh sách việc theo phạm vi: cả team / của tôi / tôi giao — dùng đúng bộ lọc của trang Việc */
function dvItems(scope){
  const keep=CVF;CVF=Object.assign({},CVF,{scope:scope==="mine"?"mine":(ME.role==="admin"?"all":"team"),team:"",nguoi:"",da:"",st:"",uu:"",q:"",tg:"",who:scope==="mine"?"mine":"all",tao:scope==="giao"?ME.id:"",wt:""});
  try{return cvFilter(cvItems())}finally{CVF=keep}}
/* ngày xong (số ngày trong tháng) của một việc đã xong */
function dvDoneDay(x){const d=D();if(x.src==="task"){const t=(d.tasks||[]).find(y=>y.id===x.id);return t&&+t.xongNgay||0}
  if(x.src==="card"){const c=d.cards.find(y=>y.id===x.id);return c?(+c.ngayDang||+c.day||0):0}return 0}
const dvAv=id=>{const n=userName(id)||"?";return `<span class="av">${esc(n.trim().slice(0,1).toUpperCase())}</span>`};
const dvOpen=(src,id)=>`data-dvo="${esc(src)}|${esc(id)}"`;
function pDvViec(m,embed){
  const d=D(),today=d.settings.today,nd=MONTH.ndays,mgr=dvMgr();
  if(!DV.scope)DV.scope=mgr?"team":"mine";
  const L=dvItems(DV.scope),open=L.filter(x=>x.st!=="done");
  const W=WEEKS.find(w=>today>=w.tu&&today<=w.den)||WEEKS[0],LW=WEEKS.find(w=>w.w===W.w-1);
  const done=L.filter(x=>x.st==="done").map(x=>Object.assign({},x,{dd:dvDoneDay(x)}));
  const doneW=done.filter(x=>x.dd>=W.tu&&x.dd<=W.den),doneLW=LW?done.filter(x=>x.dd>=LW.tu&&x.dd<=LW.den):[];
  const ontime=done.filter(x=>x.dd&&x.han),ontimeP=ontime.length?Math.round(ontime.filter(x=>x.dd<=x.han).length/ontime.length*100):null;
  const late=open.filter(x=>x.late).sort((a,b)=>b.lateD-a.lateD);
  /* chờ tôi duyệt: việc giao đến lượt mình duyệt, video / kịch bản chờ duyệt (Lead, CEO), lý do trễ chờ duyệt */
  const canRv=ME.role==="admin"||can(ME,"viec.duyet")||ME.role==="lead";
  const rvTask=(d.tasks||[]).filter(t=>t.st==="review"&&typeof tkMyTurn==="function"&&tkMyTurn(t));
  const rvCard=canRv?d.cards.filter(c=>["dkb","dvd","dceo"].includes(c.step)&&(c.step!=="dceo"||ME.role==="admin")):[];
  const rvTre=canRv?d.cards.filter(c=>c.tre&&c.tre.st==="cho"):[];
  const rvN=rvTask.length+rvCard.length+rvTre.length;
  const doing=open.filter(x=>x.st==="doing");
  /* ---- 6 ô số ---- */
  const k=(cl,ic,lb,v,sub)=>`<div class="${cl}"><small>${ic} ${lb}</small><b>${v}</b><i>${sub}</i></div>`;
  const chg=doneLW.length?Math.round((doneW.length/doneLW.length-1)*100):null;
  const kpis=`<div class="dvk">${k("","📋","Việc đang mở",nf(open.length),"chưa xong")}${k("a","⚙️","Đang làm",nf(doing.length),"đã bắt đầu")}
   ${k("r","⏰","Trễ hạn",nf(late.length),late.filter(x=>x.lateD>2).length+" việc trễ trên 2 ngày")}
   ${k("p","✋","Chờ tôi duyệt",nf(rvN),[rvCard.filter(c=>c.step==="dkb").length?"kịch bản "+rvCard.filter(c=>c.step==="dkb").length:"",rvCard.filter(c=>c.step!=="dkb").length?"video "+rvCard.filter(c=>c.step!=="dkb").length:"",rvTask.length?"việc "+rvTask.length:"",rvTre.length?"lý do trễ "+rvTre.length:""].filter(Boolean).join(" · ")||"không có gì chờ")}
   ${k("g","✔️","Xong tuần này",nf(doneW.length),LW?"tuần trước "+doneLW.length+(chg!==null?" · "+(chg>=0?"↑":"↓")+Math.abs(chg)+"%":""):"tuần đầu tháng")}
   ${k("g","🎯","Đúng hạn",ontimeP===null?"—":ontimeP+"%","trong các việc đã xong có hạn")}</div>`;
  /* ---- bảng 4 cột (việc video giống nhau gộp một dòng như trang Việc) ---- */
  const G=typeof cvGroup==="function"?cvGroup:(a=>a.map(x=>Object.assign({},x,{n:1,ids:[x.id]})));
  const col=(t,list,cls)=>{const g=G(list).sort((a,b)=>(b.lateD||0)-(a.lateD||0)||(a.han||99)-(b.han||99)),sh=g.slice(0,6);
    return `<div class="dvcol"><h3>${t}<span>${list.length}</span></h3>${sh.map(x=>{const c=cls(x);return `<div class="dvt ${c}" ${dvOpen(x.src,x.ids?x.ids[0]:x.id)}><b>${esc(String(x.ten||"").slice(0,60))}</b><div class="m"><span>${x.nguoi?dvAv(x.nguoi)+esc(userName(x.nguoi)):"Chưa giao"}</span><span class="h">${x.late?"trễ "+x.lateD+" ngày":x.st==="done"?"xong":x.han?(x.han===today+1?"hạn mai":x.han===today?"hạn hôm nay":"hạn "+dd(x.han)):"chưa có hạn"}</span></div></div>`}).join("")||`<div class="empty">Không có</div>`}${g.length>6?`<div class="dvmore" data-dvall="1">+ ${g.length-6} nhóm việc nữa · mở trang Việc</div>`:""}</div>`};
  const soon=x=>x.late?"late":x.han&&x.han-today<=1?"soon":"";
  const kb=`<div class="dvkb">${col("Cần làm",open.filter(x=>["cg","todo","nhan"].includes(x.st)),soon)}${col("Đang làm",doing,soon)}${col("Chờ duyệt",open.filter(x=>x.st==="review"),()=> "rv")}${col("Xong tuần này",doneW,()=>"ok")}</div>`;
  /* ---- việc trễ ---- */
  const lateG=G(late).sort((a,b)=>(b.lateD||0)-(a.lateD||0));
  const lateHtml=`<div class="card dvc"><h2 class="dvh">⏰ Việc trễ hạn <span class="n">${late.length}</span><small>xếp theo trễ lâu nhất</small></h2>${lateG.slice(0,8).map(x=>`<div class="dvr">${dvAv(x.nguoi)}<div class="w" ${dvOpen(x.src,x.ids?x.ids[0]:x.id)}><b>${esc(String(x.ten||"").slice(0,70))}</b><small>${esc(userName(x.nguoi)||"Chưa giao")} · ${x.mo?esc(String(x.mo).replace(/<[^>]*>/g,"").slice(0,60))+" · ":""}hạn ${x.han?dd(x.han):"—"}</small></div><span class="bad">trễ ${x.lateD} ngày</span>${mgr&&x.nguoi&&x.nguoi!==ME.id?`<button type="button" class="btn sm" data-dvnhac="${esc(x.nguoi)}|${esc(String(x.ten||"").slice(0,80))}">Nhắc</button>`:""}</div>`).join("")||`<p class="empty">Không có việc nào trễ hạn 👍</p>`}${lateG.length>8?`<div class="dvmore" data-dvall="late">+ ${lateG.length-8} việc trễ nữa</div>`:""}</div>`;
  /* ---- chờ tôi duyệt ---- */
  const rvRows=[].concat(
    rvCard.map(c=>`<div class="dvr"><span class="wait">${c.step==="dkb"?"Kịch bản":c.step==="dceo"?"Duyệt V2":"Video"}</span><div class="w" ${dvOpen("card",c.id)}><b>${esc(c.id)} · ${esc(String(c.hookText||c.yTuong||c.tuyen||"").slice(0,60))}</b><small>${esc(userName(c.nguoi)||"")} · ${esc(sk(c.sku).n)} · ${esc(chOf(c.kenh).short)}</small></div><button type="button" class="btn sm pri" ${dvOpen("card",c.id)}>Mở duyệt</button></div>`),
    rvTask.map(t=>`<div class="dvr"><span class="wait">Việc</span><div class="w" ${dvOpen("task",t.id)}><b>${esc(String(t.ten||"").slice(0,70))}</b><small>${esc(userName(t.nguoi)||"")} nộp kết quả</small></div><button type="button" class="btn sm pri" data-dvok="${esc(t.id)}">Duyệt</button><button type="button" class="btn sm" ${dvOpen("task",t.id)}>Xem</button></div>`),
    rvTre.map(c=>`<div class="dvr"><span class="wait">Lý do trễ</span><div class="w" ${dvOpen("card",c.id)}><b>"${esc(String(c.tre.lyDo||"").slice(0,70))}"</b><small>${esc(c.tre.by||"")} · ${esc(c.tre.buoc||"")} · ${esc(c.id)}</small></div><button type="button" class="btn sm pri" data-dvtre="${esc(c.id)}|1">Chấp nhận</button><button type="button" class="btn sm" data-dvtre="${esc(c.id)}|0">Không</button></div>`));
  const rvHtml=`<div class="card dvc"><h2 class="dvh">✋ Chờ tôi duyệt <span class="n">${rvN}</span><small>duyệt ngay hoặc mở để xem</small></h2>${rvRows.slice(0,8).join("")||`<p class="empty">Không có gì chờ duyệt.</p>`}${rvRows.length>8?`<div class="dvmore" data-dvall="rv">+ ${rvRows.length-8} mục nữa</div>`:""}</div>`;
  /* ---- tải việc theo người ---- */
  const people=[...new Set(open.map(x=>x.nguoi).filter(Boolean))].map(id=>{const mine=open.filter(x=>x.nguoi===id);return {id,lam:mine.filter(x=>!x.late&&x.st!=="review").length,tre:mine.filter(x=>x.late).length,rv:mine.filter(x=>x.st==="review").length,n:mine.length}}).sort((a,b)=>b.n-a.n);
  const pm=Math.max(1,...people.map(p=>p.n));
  const loadHtml=`<div class="card dvc"><h2 class="dvh">👥 Tải việc theo người <small>đang làm / trễ / chờ duyệt</small></h2>${people.slice(0,10).map(p=>`<div class="load"><span>${esc(userName(p.id)||p.id)}</span><div class="lb"><i style="width:${p.lam/pm*100}%;background:#f59e0b"></i><i style="width:${p.tre/pm*100}%;background:#ef4444"></i><i style="width:${p.rv/pm*100}%;background:#8b5cf6"></i></div><span>${p.n} việc</span></div>`).join("")||`<p class="empty">Chưa có việc đang mở.</p>`}
   <div class="dvleg"><span><em style="background:#f59e0b"></em>Đang làm</span><span><em style="background:#ef4444"></em>Trễ</span><span><em style="background:#8b5cf6"></em>Chờ duyệt</span></div></div>`;
  /* ---- hạn 7 ngày tới ---- */
  const TH=["CN","T2","T3","T4","T5","T6","T7"],days=Array.from({length:7},(_,i)=>today+i).filter(x=>x<=nd);
  const dayN=x=>open.filter(y=>y.han===x).length,dm=Math.max(1,...days.map(dayN));
  const calHtml=`<div class="card dvc"><h2 class="dvh">📅 Hạn 7 ngày tới <small>số việc đến hạn mỗi ngày</small></h2><div class="cal">${days.map(x=>{const n=dayN(x),dt=new Date(MONTH.year,MONTH.mon-1,x);return `<div class="${n&&n>=dm*.8&&n>=5?"hot":n&&n>=dm*.5&&n>=3?"warm":""}">${x===today?"Hôm nay":TH[dt.getDay()]}<b>${n}</b>${dd(x)}</div>`}).join("")}</div><p class="empty" style="text-align:left;margin:8px 0 0">Ngày tô đỏ là ngày dồn nhiều hạn, nên giãn bớt.</p></div>`;
  /* ---- hoàn thành theo tuần ---- */
  const wk=WEEKS.map(w=>{const L2=done.filter(x=>x.dd>=w.tu&&x.dd<=w.den);return {w,ok:L2.filter(x=>!x.han||x.dd<=x.han).length,tre:L2.filter(x=>x.han&&x.dd>x.han).length,cur:today>=w.tu&&today<=w.den,fut:w.tu>today}});
  const wm=Math.max(1,...wk.map(x=>x.ok+x.tre)),bw=40,gap=(300-wk.length*bw)/(wk.length+1);
  const wkHtml=`<div class="card dvc"><h2 class="dvh">📈 Hoàn thành theo tuần <small>đúng hạn / trễ</small></h2><svg viewBox="0 0 300 150" width="100%" style="display:block">${wk.map((x,i)=>{const X=gap+i*(bw+gap),h1=x.ok/wm*110,h2=x.tre/wm*110;return `<rect x="${X}" y="${125-h1}" width="${bw}" height="${h1}" rx="4" fill="#22c55e" opacity="${x.fut?.25:x.cur?.6:1}"/><rect x="${X}" y="${125-h1-h2}" width="${bw}" height="${h2}" rx="2" fill="#ef4444"/><text x="${X+bw/2}" y="${125-h1-h2-4}" text-anchor="middle" style="font-size:11px;fill:#1f2340">${x.ok+x.tre||""}</text><text x="${X+bw/2}" y="142" text-anchor="middle" style="font-size:11px;fill:#6b7280">T${x.w.w}${x.cur?" (nay)":""}</text>`}).join("")}</svg>
   <div class="dvleg"><span><em style="background:#22c55e"></em>Đúng hạn</span><span><em style="background:#ef4444"></em>Trễ</span></div></div>`;
  const chips=mgr?`<div class="dvtop">${[["team","Cả team"],["mine","Của tôi"],["giao","Tôi giao"]].map(([k2,t])=>`<button type="button" data-dvsc="${k2}" class="${DV.scope===k2?"on":""}">${t}</button>`).join("")}<span class="mut" style="font-size:12px;margin-left:6px">Bấm vào thẻ để mở đúng việc</span></div>`:"";
  m.innerHTML=DV_CSS+`<div class="dv">${embed?"":chips}${kpis}${embed?"":kb}<div class="dvg2">${lateHtml}${rvHtml}</div><div class="dvg3">${loadHtml}${calHtml}${wkHtml}</div></div>`;
  /* ---- thao tác ---- */
  m.querySelectorAll("[data-dvsc]").forEach(b=>b.onclick=()=>{DV.scope=b.dataset.dvsc;renderMain()});
  m.querySelectorAll("[data-dvo]").forEach(e=>e.onclick=ev=>{ev.stopPropagation();const [src,id]=e.dataset.dvo.split("|");if(src==="task"&&typeof openTask==="function")openTask(id);else if(src==="card"&&typeof openCard==="function")openCard(id);else{PAGE="cv_v";renderMain()}});
  m.querySelectorAll("[data-dvall]").forEach(e=>e.onclick=()=>{if(e.dataset.dvall==="late"&&typeof CVF!=="undefined")CVF.st="late";PAGE="cv_v";render();scrollTo(0,0)});
  m.querySelectorAll("[data-dvnhac]").forEach(b=>b.onclick=()=>{const [to,ten]=b.dataset.dvnhac.split("|");DB.mutate(ME.name,"nhắc việc trễ cho "+userName(to),dt=>{dt.notifs=dt.notifs||[];dt.notifs.push({id:"nt"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),to,text:"⏰ "+ME.name+" nhắc: việc trễ hạn — "+ten,at:new Date().toISOString(),ref:"page:cv_v",by:ME.id,read:false})});toast("Đã nhắc "+userName(to));b.disabled=true;b.textContent="Đã nhắc"});
  m.querySelectorAll("[data-dvok]").forEach(b=>b.onclick=()=>{if(typeof tkApprove==="function"&&tkApprove(b.dataset.dvok)!==false){toast("Đã duyệt");renderMain()}});
  m.querySelectorAll("[data-dvtre]").forEach(b=>b.onclick=()=>{const [id,ok]=b.dataset.dvtre.split("|"),yes=ok==="1";DB.mutate(ME.name,(yes?"duyệt":"không duyệt")+" lý do trễ "+id,dt=>{const c=dt.cards.find(y=>y.id===id);if(c&&c.tre){c.tre.st=yes?"ok":"khong";c.tre.duyet=ME.name}});toast(yes?"Đã chấp nhận lý do trễ":"Đã ghi không duyệt (tính trễ)");renderMain()});
}
/* chị Hoa 02/11: Tổng quan và Việc gộp một trang (trang Việc, thẻ tên Tổng quan) — đường dẫn cũ cv_tq mở trang đó */
PAGES.cv_tq=function(m){if(typeof pCvV==="function"){pCvV(m);return}try{pDvViec(m)}catch(e){console.error("Tổng quan việc lỗi",e);m.innerHTML=`<div class="note red"><b>Trang chưa hiện được.</b> Chụp dòng này gửi người quản trị web: ${esc(String(e&&e.message||e))}</div>`}};
/* mục menu: chỉ người quản lý việc (CEO, trưởng nhóm, người được giao việc) thấy; nhân viên vào thẳng trang Việc */
{const i=MODULES.findIndex(x=>x.k==="cv");MODULES.splice(i>=0?i+1:MODULES.length,0,{k:"cvtq",zone:"",ic:"task",n:"Tổng quan việc",sub:"",hide:true,groups:()=>[["",[MI("cv_tq","Tổng quan",()=>dvMgr())]]]})}
