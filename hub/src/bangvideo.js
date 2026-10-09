/* =====================================================================
   BẢNG VIDEO THEO KÊNH (kiểu sheet "Hệ thống quản trị content"): mỗi video một dòng, mỗi kênh một bảng.
   Cột: tuần đăng, sản phẩm, dạng, hook, người viết hook, người quay / làm mẫu, người dựng, hạn, trạng thái.
   Chị không điền từng dòng: tích một nhóm dòng rồi ÁP hàng loạt (tuần, người, hạn), chia đều theo kế hoạch tuần và theo số người.
   ===================================================================== */
const BV={only:new Set(),k:"",sku:"",t:"",w:"",st:"",ng:"",sel:new Set(),act:"hook",pp:new Set(),val:"plan"};
const BV_T=["oneshot","kichban","worker","reup","outsource","ton","nhanban"];
const BV_ACT=[["hook","Người viết hook / kịch bản"],["quay","Người quay / làm mẫu"],["dung","Người dựng / làm"],["tuan","Tuần đăng"],["han","Hạn"]];
const bvLbl=t=>t==="bai"?"Bài Fanpage":(MIX.find(z=>z[0]===t)||[])[1]||t;
const bvTuan=c=>+c.tuan||(weekOf(cDay(c))||0);
const BV_STL={cg:"Cần làm",dkb:"Chờ duyệt kịch bản",dvd:"Chờ duyệt video",dceo:"Chờ CEO duyệt"};
/* Video đã gửi Worker và Worker còn đang làm (viết kịch bản / dựng): vẫn hiện ở "Cần làm", chỉ đổi dòng trạng thái */
const bvWkAct=c=>!!(c.wt&&c.step==="worker"&&!c.wDone&&!(c.wStatus==="review"&&c.wStage==="video"));
const bvWkTxt=c=>{if(c.wStatus==="error")return "Worker báo lỗi";if(c.wStatus==="review"&&c.wStage==="script")return "Worker viết xong, chờ duyệt kịch bản";if(c.wStatus==="review")return "Worker dựng xong bản nháp, chờ duyệt";if(c.wStatus==="queued")return "Chờ máy Worker nhận việc";
  const dt=c.wDetail||"",writing=c.wMode==="voice"&&(/viết lại/i.test(dt)||(!c.wHadScr&&(!dt||/viết/i.test(dt))));return writing?"✍ Worker đang viết kịch bản":"🎬 Worker đang dựng"};
const bvStT=id=>BV_STL[id]||(STEPS.find(s=>s.id===id)||{}).t||id;
const bvNxL=l=>/gửi.*duyệt/i.test(String(l||""))?"Gửi duyệt":String(l||"").replace(/\bOanh\s+/g,"").replace(/Oanh/g,"lead").replace(/^(\w)/,m=>m.toUpperCase());
const bvNg=(d,uid)=>userName(uid)||"";
/* các thẻ của một kênh theo bộ lọc */
function bvRows(d){
  return d.cards.filter(c=>c.kenh===BV.k&&(!BV.only.size||BV.only.has(c.id))&&(!BV.sku||c.sku===BV.sku)&&(!BV.t||mixOf(c)===BV.t)&&(!BV.st||c.step===BV.st||(BV.st==="cg"&&bvWkAct(c)))&&(!BV.w||String(bvTuan(c))===String(BV.w))&&(!BV.ng||[c.nguoiKB,c.nguoiEdit,c.nguoiQuay,c.nguoi,c.giao].includes(BV.ng)))
   .sort((a,b)=>a.sku.localeCompare(b.sku)||String(mixOf(a)).localeCompare(String(mixOf(b)))||String(a.id).localeCompare(String(b.id)))
}
/* số video cần có theo kế hoạch của một sản phẩm và dạng */
const bvPlanN=(d,sku,kenh,t)=>{if(!ptPairs().some(x=>x.sku===sku&&x.kenh===kenh&&knShown(d,x)))return 0;if(t==="ton"){const pr=ptPairs().find(x=>x.sku===sku&&x.kenh===kenh);if(pr&&+pr.ton>0)return +pr.ton}const M=((d.weekPlan||{}).M||{})[wpKey(sku,kenh)];if(M&&M.mix&&M.mix[t]!=null)return Math.max(0,Math.floor(+M.mix[t]||0));return lvPlan(d,sku,kenh,t).reduce((a,b)=>a+b,0)};
const BV_RT=["oneshot","kichban","worker","reup","outsource","nhanban"];
function bvMissing(d,kenh){
  if(!chOf(kenh).needId)return (d.fpPlan||[]).map(r=>({fp:r.id,sku:"TH",t:"bai",n:Math.max(0,(+r.sl||0)-d.cards.filter(c=>c.kenh===kenh&&c.fpId===r.id).length)})).filter(x=>x.n>0);
  const out=[];ptPairs().filter(x=>x.kenh===kenh&&knShown(d,x)).forEach(x=>{["oneshot","kichban","worker","reup","outsource","nhanban"].forEach(t=>{const plan=bvPlanN(d,x.sku,kenh,t),have=d.cards.filter(c=>c.sku===x.sku&&c.kenh===kenh&&mixOf(c)===t&&c.nguon!=="Order Digital").length;if(plan>have)out.push({sku:x.sku,t,n:plan-have})})});
  return out
}
function bvNewCard(dt,sku,kenh,t){
  const base={sku,kenh,day:0,qday:0,mix:t,batDau:dt.settings.today,han:0,giao:"",nguoi:"",step:"cg"};
  const by={oneshot:{nguon:"Quay mới",loai:"moi",oneShot:true,yTuong:"Viết hook one shot",dangVideo:"One shot"},kichban:{nguon:"Quay mới",loai:"moi",yTuong:"Viết kịch bản review / voice off"},
   worker:{nguon:"Kho cảnh + Worker",loai:"worker",wkMode:"A",nguoiDung:"Worker",dangVideo:"Giọng đọc (Adam/AI)",yTuong:"Chọn cảnh trong kho cảnh, cho Worker dựng + voice"},
   reup:{nguon:"Reup có sửa",loai:"reup",yTuong:"Tìm video reup, dán link video gốc rồi gửi Worker"},bai:{nguon:"Fanpage",loai:"moi",dangVideo:"Ảnh",yTuong:"Viết caption, chuẩn bị ảnh / video"},nhanban:{nguon:"Nhân bản winner",loai:"nhanban",yTuong:"Dán link video win mẫu rồi bấm Nhân bản (Hypit)"},outsource:{nguon:"Order outsource",loai:"outsource",wkBat:true,dangVideo:"Video outsource",yTuong:"Gửi brief cho bên outsource, nhận video về rồi dán link"}};
  return newCard(dt,Object.assign(base,by[t]||{}))
}
/* hạn hoàn thiện video: trước tuần đăng, tức cuối tuần liền trước; tuần hiện tại hoặc chưa xếp tuần thì 2 ngày tới */
function bvHan(d,c){const td=d.settings.today,nd=MONTH.ndays,cw=weekOf(td)||1,w=bvTuan(c);if(w>cw)return Math.min(nd,(WEEKS.find(x=>x.w===w-1)||WEEKS[0]).den);return Math.min(nd,td+2)}
/* áp hàng loạt */
function bvApply(){
  const d0=D(),order=bvRows(d0).filter(c=>BV.sel.has(c.id)).map(c=>c.id);if(!order.length){toast("Chưa tích dòng nào");return}
  const none=BV.pp.has("__none"),P=[...BV.pp].filter(x=>x!=="__none"),act=BV.act,val=BV.val;
  if(["hook","quay","dung"].includes(act)&&!P.length&&!none){toast("Chọn ít nhất một người, hoặc chọn Bỏ trống");return}
  if(act==="tuan"&&val!=="plan"&&!(+val>=1&&+val<=5)){toast("Chọn tuần");return}
  if(act==="han"&&val!=="auto"&&!(+val>=1)){toast("Chọn ngày hạn");return}
  DB.mutate(ME.name,"áp hàng loạt "+(BV_ACT.find(z=>z[0]===act)||[])[1]+" cho "+order.length+" video",dt=>{
    const rows=order.map(id=>dt.cards.find(c=>c.id===id)).filter(Boolean),td=dt.settings.today,cw=weekOf(td)||1;
    if(["hook","quay","dung"].includes(act)){
      if(none&&!P.length){rows.forEach(c=>{if(act==="quay")c.nguoiQuay="";else if(act==="hook")c.nguoiKB="";else c.nguoiEdit=""});return}
      rows.forEach((c,i)=>{const u=P[i%P.length],t=mixOf(c);
        if(act==="quay")c.nguoiQuay=u;
        else if(act==="hook"){c.nguoiKB=u;if(["cg","kb"].includes(c.step)){c.nguoi=u;c.giao=c.giao||u}if(c.step==="cg"&&["oneshot","kichban"].includes(t))c.step="kb"}
        else{c.nguoiEdit=u;if(["worker","outsource","reup"].includes(t)){c.nguoi=u;c.giao=u;if(t==="reup")c.nguoiKB=u;if(c.step==="cg")c.step=t==="reup"?"kb":"worker"}}})
    }else if(act==="tuan"){
      if(val!=="plan")rows.forEach(c=>{c.tuan=+val});
      else{const groups={};rows.forEach(c=>{const k=c.sku+"|"+mixOf(c);(groups[k]=groups[k]||[]).push(c)});
        Object.values(groups).forEach(g=>{const sku=g[0].sku,t=mixOf(g[0]),plan=lvPlan(dt,sku,g[0].kenh,t),sel=new Set(g.map(c=>c.id)),other=[0,0,0,0,0];
          dt.cards.filter(c=>c.sku===sku&&c.kenh===g[0].kenh&&mixOf(c)===t&&!sel.has(c.id)).forEach(c=>{const w=bvTuan(c);if(w>=1&&w<=5)other[w-1]++});
          const cap=plan.map((n,i)=>Math.max(0,n-other[i]));let w=0;g.forEach(c=>{while(w<4&&cap[w]<=0)w++;c.tuan=w+1;cap[w]--})})}
    }else{
      rows.forEach(c=>{c.han=val==="auto"?bvHan(dt,c):+val})
    }
  });
  BV.pp=new Set();toast("Đã áp \""+(BV_ACT.find(z=>z[0]===act)||[])[1]+"\" cho "+order.length+" dòng");renderMain()
}
/* lõi áp hàng loạt: dùng cho cửa sổ Cập nhật nhanh. Mỗi khâu chỉ đổi đúng khâu đó. */
function bvCore(dt,order,act,P,none,val){
  const rows=order.map(id=>dt.cards.find(c=>c.id===id)).filter(Boolean),td=dt.settings.today;
  if(["hook","quay","dung"].includes(act)){
    if(none&&!P.length){rows.forEach(c=>{if(act==="quay")c.nguoiQuay="";else if(act==="hook")c.nguoiKB="";else c.nguoiEdit=""});return}
    rows.forEach((c,i)=>{const u=P[i%P.length],t=mixOf(c);
      if(act==="quay")c.nguoiQuay=u;
      else if(act==="hook"){c.nguoiKB=u;if(["cg","kb"].includes(c.step)){c.nguoi=u;c.giao=c.giao||u}if(c.step==="cg"&&["oneshot","kichban"].includes(t))c.step="kb"}
      else{c.nguoiEdit=u;if(["worker","outsource","reup"].includes(t)){c.nguoi=u;c.giao=u;if(t==="reup")c.nguoiKB=u;if(c.step==="cg")c.step=t==="reup"?"kb":"worker"}}})
  }else if(act==="tuan"){
    if(val!=="plan")rows.forEach(c=>{c.tuan=+val});
    else{const groups={};rows.forEach(c=>{const k=c.sku+"|"+mixOf(c);(groups[k]=groups[k]||[]).push(c)});
      Object.values(groups).forEach(g=>{const sku=g[0].sku,t=mixOf(g[0]),plan=lvPlan(dt,sku,g[0].kenh,t),sel=new Set(g.map(c=>c.id)),other=[0,0,0,0,0];
        dt.cards.filter(c=>c.sku===sku&&c.kenh===g[0].kenh&&mixOf(c)===t&&!sel.has(c.id)).forEach(c=>{const w=bvTuan(c);if(w>=1&&w<=5)other[w-1]++});
        const cap=plan.map((n,i)=>Math.max(0,n-other[i]));let w=0;g.forEach(c=>{while(w<4&&cap[w]<=0)w++;c.tuan=w+1;cap[w]--})})}
  }else{rows.forEach(c=>{c.han=val==="auto"?bvHan(dt,c):+val})}
}
/* cửa sổ Cập nhật nhanh: chọn người viết hook, người quay, người dựng (và tuần, hạn nếu cần) cho cả nhóm đang lọc hoặc các dòng đã tích */
function bvQuick(){
  const d=D(),team=xvTeam(),rows=bvRows(d),sel=rows.filter(c=>BV.sel.has(c.id)),tg=sel.length?sel:rows;
  if(!tg.length){toast("Không có dòng nào để cập nhật");return}
  const Q={hook:new Set(),quay:new Set(),dung:new Set()},days=Array.from({length:MONTH.ndays},(_,i)=>[String(i+1),dd(i+1)]);
  const ST=[["hook","Người viết hook"],["quay","Người quay / làm mẫu"],["dung","Người edit / dựng"]],ov=document.createElement("div");ov.className="wpmodal";
  const hint=k=>{const s=Q[k];return s.has("__none")?"sẽ xóa người ở khâu này":s.size>1?"chia đều "+s.size+" người":s.size?"cùng một người":"không đổi"};
  const paint=()=>{ov.innerHTML=`<div class="wpmbox bvq"><div class="wpmh"><b>Cập nhật nhanh · ${tg.length} video${sel.length?" đã tích":""}</b><button type="button" class="lnk" data-q="x">✕ Đóng</button></div>
   <p class="hint">${sel.length?"Áp cho các dòng đã tích.":"Áp cho toàn bộ "+tg.length+" dòng đang lọc."} Khâu nào không chọn người thì giữ nguyên.</p>
   ${ST.map(([k,l])=>`<div class="bvqr"><b>${l}</b><div class="bvqc">${team.map(u=>`<button type="button" class="gvchip${Q[k].has(u.id)?" on":""}" data-qp="${k}|${esc(u.id)}">${esc(u.name)}</button>`).join("")}<button type="button" class="gvchip${Q[k].has("__none")?" on":""}" data-qp="${k}|__none">— bỏ trống —</button></div><small>${hint(k)}</small></div>`).join("")}
   <div class="bvqr two"><label>Trạng thái (chuyển bước)<select data-qv="st">${opt([["","— không đổi —"],["next","Chuyển sang bước kế tiếp của từng video"]].concat(STEPS.map(s=>[s.id,"Chuyển sang: "+bvStT(s.id)])),ov.dataset.st||"")}</select></label>${(can(ME,"viec.duyet")||ME.role==="admin")?`<label>Trạng thái duyệt<select data-qv="duyet">${opt([["","— không đổi —"]].concat(LISTS.duyet.map(x=>[x,x])),ov.dataset.duyet||"")}</select></label>`:""}${ME.role==="admin"?`<label>CEO check<select data-qv="ceo">${opt([["","— không đổi —"]].concat(LISTS.ceo.map(x=>[x,x])),ov.dataset.ceo||"")}</select></label>`:""}</div>
   <div class="bvqr two"><label>Tuần đăng<select data-qv="tuan">${opt([["","— không đổi —"],["plan","Chia theo kế hoạch tuần"]].concat([1,2,3,4,5].map(w=>[String(w),"Tuần "+w])),ov.dataset.tuan||"")}</select></label><label>Hạn<button type="button" class="bvhan wide" data-qhan="1">${ov.dataset.han?(ov.dataset.han==="auto"?"Tự tính theo tuần đăng":dd(+ov.dataset.han)):"— không đổi —"} ▾</button></label></div>
   <div class="acts"><button type="button" class="btn ghost" data-q="x">Hủy</button><button type="button" class="btn pri" data-q="ok">Áp dụng cho ${tg.length} dòng</button></div></div>`;
   ov.querySelectorAll("[data-q=x]").forEach(b=>b.onclick=()=>ov.remove());
   ov.querySelectorAll("[data-qp]").forEach(b=>b.onclick=()=>{const [k,u]=b.dataset.qp.split("|"),s=Q[k];if(u==="__none")Q[k]=s.has(u)?new Set():new Set([u]);else{s.delete("__none");s.has(u)?s.delete(u):s.add(u)}paint()});
   ov.querySelectorAll("[data-qv]").forEach(s=>s.onchange=()=>{ov.dataset[s.dataset.qv]=s.value});
   const qh=ov.querySelector("[data-qhan]");if(qh)qh.onclick=()=>bvCal(qh,+ov.dataset.han||0,v=>{ov.dataset.han=v==="0"?"":v;paint()},[["auto","Tự tính theo tuần đăng"],["0","Không đổi"]]);
   ov.querySelector("[data-q=ok]").onclick=()=>{
     const tuan=ov.dataset.tuan||"",han=ov.dataset.han||"",stp=ov.dataset.st||"",dy=ov.dataset.duyet||"",ce=ov.dataset.ceo||"",any=tuan||han||stp||dy||ce||ST.some(([k])=>Q[k].size);if(!any){toast("Chưa chọn gì để cập nhật");return}
     const ids=tg.map(c=>c.id),what=[];
     DB.mutate(ME.name,"cập nhật nhanh "+ids.length+" video",dt=>{
       if(tuan)bvCore(dt,ids,"tuan",[],false,tuan);
       ST.forEach(([k])=>{const s=Q[k];if(!s.size)return;const none=s.has("__none"),P=[...s].filter(x=>x!=="__none");bvCore(dt,ids,k,P,none,"")});
       if(han)bvCore(dt,ids,"han",[],false,han);
       if(dy||ce)dt.cards.forEach(c=>{if(ids.includes(c.id)){if(dy)c.duyet=dy;if(ce)c.ceo=ce}})});
     let moved=0;const errs={};
     if(stp)ids.forEach(id=>{const c=D().cards.find(x=>x.id===id);if(!c)return;let to=stp;if(stp==="next"){const nx=nextAct(c);if(!nx){errs["Không có bước tiếp theo"]=(errs["Không có bước tiếp theo"]||0)+1;return}to=nx[1]}if(c.step===to)return;const err=moveCard(ME,id,to);if(err)errs[err]=(errs[err]||0)+1;else moved++});
     ov.remove();BV.sel=new Set();
     const eN=Object.values(errs).reduce((a,b)=>a+b,0);
     toast("Đã cập nhật "+ids.length+" video"+(stp?" · chuyển bước "+moved+" video"+(eN?", "+eN+" video chưa chuyển được: "+Object.entries(errs).map(([m,n])=>n+" "+m.replace(/\.$/,"").toLowerCase()).join("; "):""):""));
     renderMain()}};
  ov.onclick=e=>{if(e.target===ov)ov.remove()};paint();document.body.appendChild(ov)
}
/* trạng thái duyệt, CEO check như sheet: lead duyệt, CEO check */
function bvDuyetCells(d,c,give){
  const lead=can(ME,"viec.duyet")||ME.role==="admin",adm=ME.role==="admin";
  /* video chưa tới bước duyệt: ẩn dấu duyệt cũ để khỏi hiểu nhầm là đã duyệt (chỉ CEO còn thấy để tự duyệt thẳng) */
  if(["cg","kb","quay","edit","worker"].includes(c.step)&&!adm)return `<td><span class="hint">—</span></td><td><span class="hint">—</span></td>`;
  const dv=(c.duyet||"Chưa duyệt"),ce=(c.ceo||"CẦN KIỂM TRA");
  return `<td>${lead?`<select class="bvdy ${dv==="Đã duyệt"?"ok":dv==="Cần sửa"?"fix":""}" data-bvd="${esc(c.id)}|duyet">${opt(LISTS.duyet,dv)}</select>`:`<span class="pill ${dv==="Đã duyệt"?"p-grn":dv==="Cần sửa"?"p-amb":"p-gry"}">${esc(dv)}</span>`}</td><td>${adm?`<select class="bvdy ${ce==="PASS"?"ok":ce==="KHÔNG DÙNG"?"fix":""}" data-bvd="${esc(c.id)}|ceo">${opt(LISTS.ceo,ce)}</select>`:`<span class="pill ${ce==="PASS"?"p-grn":ce==="KHÔNG DÙNG"?"p-red":"p-gry"}">${esc(ce)}</span>`}</td>`
}
/* trạng thái chọn được + một nút chuyển bước tiếp theo (gửi lead duyệt, chuyển quay, edit, Hypit nhân bản…) */
const bvMau=c=>["reup","nhanban"].includes(mixOf(c));
function bvWkOk(c){const k=typeof wkKind==="function"?wkKind(c):"";if(!k||c.wt||mixOf(c)==="nhanban")return false;if(!xvGive()&&![c.nguoiEdit,c.nguoiQuay,c.nguoiKB,c.nguoi,c.giao].includes(ME.id))return false;return k==="oneshot"||k==="review"?c.step==="edit":["cg","kb","worker"].includes(c.step)}
/* nhãn nút bước tiếp theo viết ngắn để không kéo dài cột */
const bvShort=l=>({"Đã quay, chuyển sang edit":"Quay xong","Edit xong, gửi duyệt":"Edit xong → gửi duyệt","Dựng xong, gửi duyệt":"Dựng xong → gửi duyệt","Người duyệt, gửi CEO duyệt":"Gửi CEO duyệt","Người duyệt, gửi CEO":"Gửi CEO duyệt","CEO duyệt, cho đăng":"Cho đăng","Đã đăng, lưu ID":"Đã đăng","Đã đăng, lưu link bài":"Đã đăng","Duyệt kịch bản, gửi Worker dựng":"Duyệt, gửi Worker","Đã có link video gốc, gửi Worker":"Gửi Worker","Bắt đầu edit":"Bắt đầu edit"})[l]||l;
function bvStCell(d,c,give){
  const t=mixOf(c),nb=t==="nhanban"||loaiOf(c)==="nhanban",wk=bvWkOk(c),nx=(typeof nextAct==="function")?nextAct(c):null,can1=canMove(ME,c,nx?nx[1]:c.step);
  const sel=bvWkAct(c)?`<span class="pill p-blu">${esc(bvStT("cg"))}</span>`:give||can1?`<select class="bvst2 s-${c.step}" data-bvst="${esc(c.id)}">${opt(STEPS.map(s=>[s.id,bvStT(s.id)]),c.step)}</select>`:`<span class="pill p-blu">${esc(bvStT(c.step))}</span>`;
  const scrRv=c.wt&&c.wStage==="script"&&c.wStatus==="review",btn=nx&&can1&&!nb&&!scrRv&&!(wk&&c.step!=="edit")?`<button type="button" class="bvnx" data-bvnx="${esc(c.id)}" title="${esc(bvNxL(nx[0]))}">${esc(bvShort(nx[0])!==nx[0]?bvShort(nx[0]):bvNxL(nx[0]))}</button>`:"";
  const wb=wk?`<button type="button" class="bvnx bvwkb" data-bvwk="${esc(c.id)}" title="Gửi video này cho Worker dựng">Order Worker</button>`:"";
  const WS={queued:"chờ máy văn phòng nhận việc",running:"Worker đang dựng",review:"có bản nháp, chờ duyệt",done:"Worker dựng xong",error:"Worker báo lỗi"},wl=c.wt?`<small class="bvwl"><b class="${c.wStatus==="error"?"t-red":"t-grn"}">${esc(bvWkTxt(c))}</b>${c.wStatus==="running"&&c.wProg?` · ${c.wProg}%`:""}${c.wStatus==="error"&&c.wDetail?`<br>${esc(c.wDetail)}`:""}</small>`:"";
  let hy="";if(nb){const ht=typeof hyFor==="function"?hyFor("CARD:"+c.id):null;hy=ht?`<button type="button" class="bvnx hy" data-bvhyw="${esc(ht.id)}">${esc(((HY_ST||{})[ht.status]||[ht.status])[0])} · mở cửa sổ</button>`:`<button type="button" class="bvnx hy" data-bvhyn="${esc(c.id)}">Nhân bản (Hypit) →</button>`}
  const dvA=can(ME,"viec.duyet")||ME.role==="admin",sb=scrRv?(dvA?`<button type="button" class="bvnx" onclick="bvScrOpen('${esc(c.id)}')">Xem kịch bản</button>`:`<small class="bvwl">Kịch bản chờ duyệt</small>`):"";
  return sel+btn+sb+wb+hy+wl
}
/* Thêm sản phẩm: chọn sản phẩm và dạng video, web đọc kế hoạch tháng và tạo đúng số dòng còn thiếu (ví dụ 30 One shot) */
function bvAdd(){
  const d=D(),kenh=BV.k,prs=ptPairs().filter(x=>x.kenh===kenh&&knShown(d,x)),TY=["oneshot","kichban","worker","reup","outsource"];
  if(!prs.length){toast("Kênh này chưa có sản phẩm trong kế hoạch. Thêm ở Kế hoạch triển khai.");return}
  const S={sku:BV.sku&&prs.some(x=>x.sku===BV.sku)?BV.sku:prs[0].sku,t:BV.t&&TY.includes(BV.t)?BV.t:"all",n:null},ov=document.createElement("div");ov.className="wpmodal";
  const info=(sku)=>TY.map(t=>{const plan=bvPlanN(d,sku,kenh,t),have=d.cards.filter(c=>c.sku===sku&&c.kenh===kenh&&mixOf(c)===t).length;return {t,plan,have,miss:Math.max(0,plan-have)}});
  const paint=()=>{const I=info(S.sku),one=S.t!=="all"?I.find(x=>x.t===S.t):null,n=S.t==="all"?sum(I,x=>x.miss):(S.n!=null?S.n:one.miss);
   ov.innerHTML=`<div class="wpmbox bvq"><div class="wpmh"><b>Thêm sản phẩm vào bảng video · ${esc(chOf(kenh).short)}</b><button type="button" class="lnk" data-q="x">✕ Đóng</button></div>
   <p class="hint">Chọn sản phẩm và dạng video. Web đọc kế hoạch tháng rồi tạo đúng số dòng còn thiếu.</p>
   <div class="bvqr two"><label>Sản phẩm<select data-av="sku">${opt(prs.map(x=>[x.sku,sk(x.sku).n]),S.sku)}</select></label><label>Dạng video<select data-av="t">${opt([["all","Tất cả dạng còn thiếu"]].concat(TY.map(t=>[t,bvLbl(t)])),S.t)}</select></label>${S.t!=="all"?`<label>Số dòng tạo<input type="number" min="0" class="num" data-av="n" value="${n}"></label>`:""}</div>
   <table class="lvtab"><thead><tr><th>Dạng</th><th class="n">Kế hoạch tháng</th><th class="n">Đã có dòng</th><th class="n">Sẽ tạo</th></tr></thead><tbody>${I.map(x=>`<tr class="${S.t!=="all"&&S.t!==x.t?"dim":""}"><td>${esc(bvLbl(x.t))}</td><td class="n">${x.plan}</td><td class="n">${x.have}</td><td class="n"><b>${S.t==="all"?x.miss:S.t===x.t?n:0}</b></td></tr>`).join("")}</tbody></table>
   <div class="acts"><button type="button" class="btn ghost" data-q="x">Hủy</button><button type="button" class="btn pri" data-q="ok">Tạo ${n} dòng</button></div></div>`;
   ov.querySelectorAll("[data-q=x]").forEach(b=>b.onclick=()=>ov.remove());
   ov.querySelectorAll("[data-av]").forEach(s=>s.onchange=()=>{const k=s.dataset.av;if(k==="n")S.n=Math.max(0,Math.floor(+s.value||0));else{S[k]=s.value;S.n=null}paint()});
   ov.querySelector("[data-q=ok]").onclick=()=>{if(!(n>0)){toast("Không có dòng nào cần tạo");return}const todo=S.t==="all"?I.filter(x=>x.miss>0).map(x=>({t:x.t,n:x.miss})):[{t:S.t,n}];
     DB.mutate(ME.name,"thêm "+n+" dòng video "+sk(S.sku).n+" · "+chOf(kenh).short,dt=>{todo.forEach(x=>{for(let i=0;i<x.n;i++)dt.cards.push(bvNewCard(dt,S.sku,kenh,x.t))})});
     BV.sku=S.sku;BV.t=S.t==="all"?"":S.t;BV.sel=new Set();BV.only=new Set();ov.remove();toast("Đã tạo "+n+" dòng · "+sk(S.sku).n);renderMain()}};
  ov.onclick=e=>{if(e.target===ov)ov.remove()};paint();document.body.appendChild(ov)
}
/* vẽ lại nhưng giữ nguyên vị trí cuộn, để bấm tích hay sửa không bị nhảy */
/* lịch chọn ngày theo tuần của tháng: hàng = tuần, cột = thứ. extra = các lựa chọn thêm (vd Tự tính) */
function bvCal(anchor,cur,cb,extra){
  document.querySelectorAll(".bvcal").forEach(x=>x.remove());
  const td=D().settings.today,nd=MONTH.ndays,TH=["T2","T3","T4","T5","T6","T7","CN"];
  const wkRow=W=>{const st=(W.tu-1+MONTH.first)%7;let cells="";for(let i=0;i<7;i++){const n=W.tu+(i-st);cells+=(i<st||n>W.den||n>nd)?'<i></i>':'<button type="button" data-cd="'+n+'" class="'+(n===+cur?"on ":"")+(n===td?"td":"")+'">'+n+'</button>'}return '<div class="bvcw"><b>T'+W.w+'</b>'+cells+'</div>'};
  const pop=document.createElement("div");pop.className="bvcal";
  pop.innerHTML='<div class="bvch"><b>Tháng '+MONTH.mon+'/'+MONTH.year+'</b><button type="button" data-cx="1">✕</button></div><div class="bvcw hd"><b></b>'+TH.map(x=>'<span>'+x+'</span>').join("")+'</div>'+WEEKS.map(wkRow).join("")+((extra&&extra.length)?'<div class="bvce">'+extra.map(e=>'<button type="button" data-ce="'+esc(e[0])+'">'+esc(e[1])+'</button>').join("")+'</div>':"");
  document.body.appendChild(pop);
  const r=anchor.getBoundingClientRect(),pw=pop.offsetWidth,ph=pop.offsetHeight;
  let x=Math.min(Math.max(8,r.left),innerWidth-pw-8),y=r.bottom+4;if(y+ph>innerHeight-8)y=Math.max(8,r.top-ph-4);
  pop.style.left=x+"px";pop.style.top=y+"px";
  const close=()=>{pop.remove();document.removeEventListener("mousedown",off,true)};
  const off=e=>{if(!pop.contains(e.target)&&e.target!==anchor)close()};
  setTimeout(()=>document.addEventListener("mousedown",off,true),0);
  pop.querySelector("[data-cx]").onclick=close;
  pop.querySelectorAll("[data-cd]").forEach(b=>b.onclick=()=>{close();cb(b.dataset.cd)});
  pop.querySelectorAll("[data-ce]").forEach(b=>b.onclick=()=>{close();cb(b.dataset.ce)});
}
function bvRe(){const sc=document.querySelector(".bvscroll"),st=sc?sc.scrollTop:0,sl=sc?sc.scrollLeft:0,py=window.scrollY;renderMain();const s2=document.querySelector(".bvscroll");if(s2){s2.scrollTop=st;s2.scrollLeft=sl}window.scrollTo(0,py)}
/* tự đẩy từ kế hoạch sang: kênh nào có số lượng ở Dạng nội dung thì đủ dòng video, không phải bấm tạo */
function bvAutoSync(chs){
  const d=D();if(!xvGive())return false;
  if(BV._auto&&Date.now()-BV._auto<4000)return false;
  const todo=[];chs.forEach(ch=>bvMissing(d,ch.k).forEach(x=>todo.push({kenh:ch.k,sku:x.sku,t:x.t,n:x.n,fp:x.fp})));
  const n=sum(todo,x=>x.n);if(!n)return false;
  BV._auto=Date.now();
  DB.mutate(ME.name,"tự tạo "+n+" dòng video từ kế hoạch",dt=>{todo.forEach(x=>{for(let i=0;i<x.n;i++){const c=bvNewCard(dt,x.sku,x.kenh,x.t);if(x.fp){const r=(dt.fpPlan||[]).find(z=>z.id===x.fp);if(r){c.fpId=r.id;c.tuyen=r.tuyen||"";c.mucTieu=r.mucTieu||"";if(r.dang&&r.dang!=="Hỗn hợp")c.dangVideo=r.dang;if(r.nguoi)c.nguoi=r.nguoi}}dt.cards.push(c)}})});
  toast("Đã tự tạo "+n+" dòng video từ kế hoạch");return true
}
/* thống kê mỗi người bao nhiêu video ở từng khâu (theo bộ lọc đang xem) */
function bvPeopleHtml(d,rows){
  const ST=[["nguoiKB","Viết hook"],["nguoiQuay","Quay / mẫu"],["nguoiEdit","Dựng / làm"]];
  const line=([f,l])=>{const m={};let none=0;rows.forEach(c=>{const u=c[f];if(u)m[u]=(m[u]||0)+1;else none++});const parts=Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([u,n])=>`<span class="bvpp">${esc(userName(u)||"?")} <b>${n}</b></span>`).join("");return `<div class="bvpl"><i>${l}</i>${parts}</div>`};
  return `<div class="bvpeople">${ST.map(line).join("")}</div>`
}
/* dọn dòng thừa: mỗi nhóm (sản phẩm, kênh, dạng) đang có nhiều thẻ hơn kế hoạch thì bỏ bớt các dòng CHƯA AI LÀM (còn ở bước Cần làm / Viết hook, chưa có hook, chưa có link, không phải video nhập). Có vẻ thừa vì video nhập từ Excel cộng thêm lên dòng kế hoạch, hoặc vì kênh không chạy tháng này. */
/* dòng chưa ai bắt đầu: chưa hook, chưa link, không phải video nhập từ Excel / nhập tay */
const bvFreeTay=c=>["cg","kb","worker"].includes(c.step)&&!c.nhapExcel&&!c.nhapTay&&!String(c.hookText||"").trim()&&!c.linkVideo&&!c.linkFinal&&!c.linkDang&&!c.repostOf&&!c.wkDone;
/* dọn dòng thừa. mode "tay": nút bấm tay, bỏ cả dòng chưa hook ở bước Worker và việc nhân bản chưa làm. mode "tu": tự chạy khi mở Điều phối, chỉ bỏ dòng chưa ai bắt đầu (Cần làm, hoặc Viết hook mà chưa giao người, chưa có hook / link) */
function bvDonPlan(d,mode){
  const tay=mode!=="tu",out=[],tks=[],sum2={},rows=[],ORD=["nhanban","outsource","worker","reup","kichban","oneshot","ton"],STO={cg:0,kb:1,worker:2};
  const free=c=>(tay?["cg","kb","worker"]:["cg","kb"]).includes(c.step)&&(tay||c.step==="cg"||!c.nguoiKB)&&!c.nhapExcel&&!c.nhapTay&&!String(c.hookText||"").trim()&&!c.linkVideo&&!c.linkFinal&&!c.linkDang&&!c.repostOf&&!c.wkDone;
  const isT=c=>c.nguon!=="Order Digital"&&(BV_RT.includes(mixOf(c))||mixOf(c)==="ton"),keys=new Set(),TK=tay?(d.tasks||[]).filter(z=>z.mix==="nhanban"&&z.st==="todo"&&z.sku&&z.kenh&&chOf(z.kenh).needId):[];
  d.cards.forEach(c=>{if(chOf(c.kenh).needId&&isT(c))keys.add(c.sku+"|"+c.kenh)});TK.forEach(z=>keys.add(z.sku+"|"+z.kenh));
  keys.forEach(k=>{const [sku,kenh]=k.split("|"),cs=d.cards.filter(c=>c.sku===sku&&c.kenh===kenh&&isT(c)),tk=TK.filter(z=>z.sku===sku&&z.kenh===kenh),kpi=sum(ptPairs().filter(x=>x.sku===sku&&x.kenh===kenh&&knShown(d,x)),x=>+x.sl||0);
    let excess=cs.length+sum(tk,z=>z.sl||1)-kpi;if(excess<=0)return;const s=sk(sku).n+" · "+chOf(kenh).short;
    /* việc nhân bản chưa làm bỏ trước (trùng với dòng nhân bản), rồi tới các dòng chưa ai bắt đầu */
    tk.forEach(z=>{if(excess<=0)return;tks.push(z.id);excess-=(z.sl||1);sum2[s+" (việc nhân bản)"]=(sum2[s+" (việc nhân bản)"]||0)+1});
    if(excess<=0)return;
    const freeK0=c=>["cg","kb","worker"].includes(c.step)&&!c.nhapExcel&&!c.nhapTay&&!c.linkVideo&&!c.linkFinal&&!c.linkDang&&!c.repostOf&&!c.wkDone,rm=cs.filter(kpi===0&&tay?freeK0:free).sort((p,q)=>(p.nguoiKB?1:0)-(q.nguoiKB?1:0)||(STO[p.step]-STO[q.step])||(ORD.indexOf(mixOf(p))-ORD.indexOf(mixOf(q)))||String(q.id).localeCompare(String(p.id))).slice(0,excess);
    rm.forEach(c=>{out.push(c.id);rows.push({sku,kenh,t:mixOf(c)})});if(rm.length)sum2[s]=(sum2[s]||0)+rm.length});
  return {ids:out,tks,sum:sum2,rows}
}
/* ghi: bỏ các dòng / việc đã tính, rồi hạ số chia dạng nội dung cho khớp số dòng còn lại để web không tự tạo lại */
function bvDonDo(dt,mode){
  const q=bvDonPlan(dt,mode),s=new Set(q.ids),st=new Set(q.tks);dt.cards=dt.cards.filter(c=>!s.has(c.id));if(st.size)dt.tasks=(dt.tasks||[]).filter(z=>!st.has(z.id));
  const seen=new Set();q.rows.forEach(r=>{const key=r.sku+"|"+r.kenh;if(seen.has(key))return;seen.add(key);
    const have=t2=>dt.cards.filter(c=>c.sku===r.sku&&c.kenh===r.kenh&&mixOf(c)===t2).length,types=BV_RT.concat(["ton"]),need=types.filter(t2=>(t2==="ton"?(+((ptPairs().find(x=>x.sku===r.sku&&x.kenh===r.kenh)||{}).ton)||0):bvPlanN(dt,r.sku,r.kenh,t2))>have(t2));
    if(!need.length)return;dt.weekPlan=dt.weekPlan||{};dt.weekPlan.M=dt.weekPlan.M||{};const e=dt.weekPlan.M[key]=dt.weekPlan.M[key]||{};
    const mx=Object.assign({},e.mix||{});BV_RT.forEach(t2=>{if(mx[t2]==null)mx[t2]=bvPlanN(dt,r.sku,r.kenh,t2)});
    need.forEach(t2=>{if(t2!=="ton")mx[t2]=Math.min(+mx[t2]||0,have(t2))});e.mix=mx;e.sl=Object.values(mx).reduce((a,b)=>a+(+b||0),0)});
  return q.ids.length+q.tks.length
}
function bvDon(){
  const p=bvDonPlan(D(),"tay"),n=p.ids.length+p.tks.length;if(!n){toast("Không có dòng thừa nào để dọn");return}
  const lines=Object.entries(p.sum).map(([k,v])=>"  • "+k+": bỏ "+v).join("\n");
  if(!confirm("Dọn các dòng và việc thừa chưa bắt đầu (chưa hook, chưa link):\n"+lines+"\n\nVideo đã nhập, đã có hook hoặc link không bị đụng tới. Số chia dạng nội dung ở bước ① cũng giảm theo để web không tự tạo lại dòng. Tiếp tục?"))return;
  DB.mutate(ME.name,"dọn "+n+" dòng / việc thừa ở Điều phối",dt=>{bvDonDo(dt,"tay")});
  BV.sel=new Set();toast("Đã dọn "+n+" dòng / việc thừa");renderMain()
}
/* tự bớt khi mở Điều phối: dòng vượt KPI mà chưa ai bắt đầu thì bỏ */
function bvAutoTrim(){
  if(!xvGive())return false;if(BV._trim&&Date.now()-BV._trim<4000)return false;
  const p=bvDonPlan(D(),"tu");if(!p.ids.length)return false;BV._trim=Date.now();
  DB.mutate(ME.name,"tự bỏ "+p.ids.length+" dòng thừa chưa bắt đầu",dt=>{bvDonDo(dt,"tu")});
  toast("Đã tự bỏ "+p.ids.length+" dòng thừa chưa bắt đầu");return true
}
/* số trên tab kênh: đã duyệt / kế hoạch tháng của kênh (kế hoạch = mục tiêu tổng tháng chị đặt; = 0 thì chỉ hiện số đã duyệt) */
function bvTabN(d,k){const kp=k===WP_K?(d.fpPlan||[]).reduce((a,x)=>a+(+x.sl||0),0):kn(d,k).T,dn=d.cards.filter(x=>x.kenh===k&&["dang","xong"].includes(x.step)).length;return kp?dn+"/"+kp:String(dn)}
function pBangVideo(m){
  const d=D(),lead=xvGive(),give=true,team=xvTeam(),td=d.settings.today,chs=CHANNELS.filter(ch=>ptPairs().some(x=>x.kenh===ch.k||d.cards.some(c=>c.kenh===ch.k)));
  if(!BV.k||!chs.some(c=>c.k===BV.k))BV.k=(chs[0]||{}).k||"";
  if(!lead)BV.ng=ME.id;
  if(bvAutoTrim()){renderMain();return}
  if(bvAutoSync(chs)){renderMain();return}
  if(!chOf(BV.k).needId){pFanpageLich(m,chs);return}
  const ch=chOf(BV.k),prs=ptPairs().filter(x=>x.kenh===BV.k&&knShown(d,x)),all=d.cards.filter(c=>c.kenh===BV.k),rows=bvRows(d),miss=bvMissing(d,BV.k);
  const kpiT=sum(prs,x=>+x.sl||0),rowsPlan=sum(prs,x=>sum(BV_RT,t2=>bvPlanN(d,x.sku,BV.k,t2))),tonP=sum(prs,x=>bvPlanN(d,x.sku,BV.k,"ton")),nbP=sum(prs,x=>bvPlanN(d,x.sku,BV.k,"nhanban")),thieu=sum(prs,x=>sum(BV_RT.concat(["ton"]),t2=>Math.max(0,bvPlanN(d,x.sku,BV.k,t2)-all.filter(c=>c.sku===x.sku&&mixOf(c)===t2).length))),made=all.filter(c=>BV_RT.includes(mixOf(c))||mixOf(c)==="ton").length;
  const kpi=cs=>({tao:cs.length,duyet:cs.filter(c=>["dang","xong"].includes(c.step)).length,dang:cs.filter(c=>c.step==="xong").length});
  const K=kpi(all),skus=[...new Set(prs.map(x=>x.sku).concat(all.map(c=>c.sku)))];
  const pOpt=[["","—"]].concat(team.map(u=>[u.id,u.name])),days=[[0,"—"]].concat(Array.from({length:MONTH.ndays},(_,i)=>[i+1,dd(i+1)])),wk=[[0,"—"]].concat([1,2,3,4,5].map(w=>[w,"T"+w]));
  const selN=rows.filter(c=>BV.sel.has(c.id)).length,tong=rows.length,allSel=tong&&selN===tong;
  const preview=(()=>{if(!["hook","quay","dung"].includes(BV.act)||!BV.pp.size||!selN)return "";const P=[...BV.pp],cnt={};for(let i=0;i<selN;i++){const u=P[i%P.length];cnt[u]=(cnt[u]||0)+1}return Object.entries(cnt).map(([u,n])=>userName(u)+" "+n).join(" · ")})();
  m.innerHTML=`<div class="seg ptk">${chs.map(c=>`<button data-bvk="${esc(c.k)}" class="${c.k===BV.k?"on":""}">${esc(c.short)} <span class="xbadge">${bvTabN(d,c.k)}</span></button>`).join("")}</div>
  <section class="card bvtop"><div class="bvstats"><span title="Tổng KPI của các sản phẩm ở bước ①"><b>${kpiT}</b> kế hoạch</span><span title="Video đã làm xong, sẵn sàng đăng hoặc đã đăng (gồm cả video lấy từ kho)"><b>${K.duyet}</b> đã duyệt</span><span><b>${K.dang}</b> đã đăng</span><span class="${Math.max(0,kpiT-K.duyet)?"lack":""}" title="Kế hoạch trừ đã duyệt"><b>${Math.max(0,kpiT-K.duyet)}</b> chưa xong</span></div>
   <div class="bvchips">${skus.map(s=>{const cs=all.filter(c=>c.sku===s&&(BV_RT.includes(mixOf(c))||mixOf(c)==="ton")),pl=sum(BV_RT.concat(["ton"]),t2=>bvPlanN(d,s,BV.k,t2)),th=Math.max(0,pl-cs.filter(c=>["dang","xong"].includes(c.step)).length);return `<button type="button" class="bvchip${BV.sku===s?" on":""}" data-bvsku="${esc(s)}">${swatch(s)}${esc(sk(s).n)} <b title="Đã duyệt (đã làm xong, sẵn sàng đăng hoặc đã đăng) trên kế hoạch">${cs.filter(c=>["dang","xong"].includes(c.step)).length}/${pl}</b>${th?` <i>còn ${th}</i>`:""}</button>`}).join("")}</div></section>
  <section class="card flush"><div class="bvbar"><select data-bvf="sku">${opt([["","Mọi sản phẩm"]].concat(skus.map(s=>[s,sk(s).n])),BV.sku)}</select><select data-bvf="t">${opt([["","Mọi dạng"]].concat(BV_T.map(t=>[t,bvLbl(t)])),BV.t)}</select><select data-bvf="w">${opt([["","Mọi tuần"],["0","Chưa xếp tuần"]].concat([1,2,3,4,5].map(w=>[String(w),"Tuần "+w])),BV.w)}</select><select data-bvf="st">${opt([["","Mọi trạng thái"]].concat(STEPS.map(s=>[s.id,bvStT(s.id)])),BV.st)}</select><select data-bvf="ng" ${lead?"":"disabled"}>${opt(lead?[["","Mọi người"]].concat(team.map(u=>[u.id,u.name])):[[ME.id,ME.name]],BV.ng)}</select><span class="hint">${tong} dòng${selN?" · "+selN+" đã tích":""}</span><button type="button" class="btn sm" data-bvcol="1" title="Chọn cột muốn hiện hoặc ẩn">☰ Cột${bvHid().size?" ("+bvHid().size+" ẩn)":""}</button>${BV.only.size?`<button type="button" class="btn sm" data-bvonly="1">Đang xem một nhóm việc (${BV.only.size} video) · Bỏ lọc</button>`:""}${give?`<span class="bvrt"><button type="button" class="btn sm" data-bvdon="1" title="Bỏ các dòng thừa chưa ai làm (do video nhập Excel cộng thêm, hoặc kênh không chạy tháng này)">🧹 Dọn dòng thừa</button> <button type="button" class="btn pri sm bvquick" data-bvquick="1">⚡ Cập nhật nhanh</button></span>`:""}</div>
  ${bvPeopleHtml(d,rows)}
  ${bvHidCss()}<div class="tbl bvscroll"><table class="bvtab pn34"><thead><tr><th><input type="checkbox" data-bvall="1" ${allSel?"checked":""}></th><th class="bvstt">STT</th><th>Mã</th><th>Sản phẩm</th><th>Dạng</th><th>Tuần</th><th>Hook / Link mẫu</th><th>Viết hook</th><th>Quay / mẫu</th><th>Dựng / làm</th><th>Link video (gửi duyệt)</th><th>Caption đăng</th><th>Cmt cần trả lời</th><th>Hạn</th><th>Duyệt</th><th>CEO check</th><th>Trạng thái · chuyển bước</th></tr></thead><tbody>
  ${rows.slice(0,400).map((c,ix)=>{const t=mixOf(c),late=isLate(c);return `<tr data-bvr="${esc(c.id)}" class="${BV.sel.has(c.id)?"sel":""}"><td><input type="checkbox" data-bvs="${esc(c.id)}" ${BV.sel.has(c.id)?"checked":""}></td>
   <td class="bvstt">${ix+1}</td><td class="mono clk" data-card="${esc(c.id)}">${esc(c.id)}</td><td>${swatch(c.sku)}${esc(sk(c.sku).n)}</td><td>${esc(bvLbl(t))}</td>
   <td>${give?`<select data-bvc="${esc(c.id)}|tuan">${opt(wk,bvTuan(c))}</select>`:"T"+bvTuan(c)}</td>
   <td>${mixOf(c)==="worker"?(c.wScript?`<button type="button" class="btn sm" onclick="bvScrOpen('${esc(c.id)}')">Xem kịch bản</button>`:c.wt&&c.wStatus!=="error"&&!c.wDone?`<span class="hint">⏳ Worker đang viết kịch bản…</span>`:`<span class="hint">Worker tự viết</span>`):bvMau(c)?bvMauCell(c,give):`<input class="bvhook" data-bvc="${esc(c.id)}|hook" value="${esc(c.hookText||"")}" placeholder="${esc(c.yTuong||"Viết hook ở đây…")}" ${give||c.nguoi===ME.id||c.nguoiKB===ME.id?"":"disabled"}>`}</td>
   <td>${mixOf(c)==="worker"?`<span class="hint">—</span>`:give?`<select data-bvc="${esc(c.id)}|nguoiKB">${opt(pOpt,c.nguoiKB||"")}</select>`:esc(bvNg(d,c.nguoiKB))}</td>
   <td>${mixOf(c)==="worker"?`<span class="hint">—</span>`:give?`<select data-bvc="${esc(c.id)}|nguoiQuay">${opt(pOpt,c.nguoiQuay||"")}</select>`:esc(bvNg(d,c.nguoiQuay))}</td>
   <td>${give?`<select data-bvc="${esc(c.id)}|nguoiEdit">${opt(pOpt,c.nguoiEdit||"")}</select>`:esc(bvNg(d,c.nguoiEdit))}</td>
   <td class="bvlk">${mixOf(c)==="worker"&&!c.linkFinal?`<span class="hint">Worker tự điền</span>`:`<input class="bvhook" data-bvc="${esc(c.id)}|${bvMau(c)?"linkFinal":"linkVideo"}" value="${esc(bvMau(c)?(c.linkFinal||""):(c.linkFinal||c.linkVideo||""))}" placeholder="Dán link Drive…" ${lead||[c.nguoiEdit,c.nguoiQuay,c.nguoiKB,c.nguoi].includes(ME.id)?"":"disabled"}>${(bvMau(c)?c.linkFinal:(c.linkFinal||c.linkVideo))?`<a href="${esc(bvMau(c)?c.linkFinal:(c.linkFinal||c.linkVideo))}" target="_blank" rel="noopener" title="Mở link">↗</a>`:""}`}</td>
   <td class="bvcap"><input class="bvhook" data-bvc="${esc(c.id)}|caption" value="${esc(c.caption||"")}" placeholder="Viết caption đăng…" title="${esc(c.caption||"")}" ${lead||[c.nguoiEdit,c.nguoiQuay,c.nguoiKB,c.nguoi].includes(ME.id)?"":"disabled"}></td>
   <td class="bvcap"><input class="bvhook" data-bvc="${esc(c.id)}|cmt" value="${esc(c.cmt||"")}" placeholder="Cmt cần tag / trả lời khi đăng…" title="${esc(c.cmt||"")}" ${lead||[c.nguoiEdit,c.nguoiQuay,c.nguoiKB,c.nguoi].includes(ME.id)?"":"disabled"}></td>
   <td>${give?`<button type="button" class="bvhan${+c.han?"":" none"}" data-bvhan="${esc(c.id)}">${+c.han?dd(+c.han):"Chọn ngày"} ▾</button>`:(+c.han?dd(+c.han):"—")}${late?` <span class="pill p-red">trễ</span>`:""}</td>
   ${bvDuyetCells(d,c,give)}<td class="bvstc">${bvStCell(d,c,give)}</td></tr>`}).join("")||`<tr><td colspan="17" class="empty">Chưa có video nào${miss.length?". Bấm \"Tạo các dòng còn thiếu\" ở trên.":"."}</td></tr>`}
  </tbody></table></div>${rows.length>400?`<p class="hint pad">Chỉ hiện 400 dòng đầu, lọc theo sản phẩm hoặc dạng để xem tiếp.</p>`:""}</section>
  `;
  const oo=m.querySelector("[data-bvonly]");if(oo)oo.onclick=()=>{BV.only=new Set();renderMain()};
  m.querySelectorAll("[data-bvk]").forEach(b=>b.onclick=()=>{BV.k=b.dataset.bvk;BV.sel=new Set();BV.sku=BV.t=BV.w=BV.st=BV.ng="";renderMain()});
  m.querySelectorAll("[data-bvf]").forEach(s=>s.onchange=()=>{BV[s.dataset.bvf]=s.value;BV.sel=new Set();renderMain()});
  const bvCount=()=>{const n=rows.filter(c=>BV.sel.has(c.id)).length,h=m.querySelector(".bvbar .hint");if(h)h.textContent=tong+" dòng"+(n?" · "+n+" đã tích":"");const a=m.querySelector("[data-bvall]");if(a)a.checked=tong>0&&n===tong};
  m.querySelectorAll("[data-bvs]").forEach(i=>i.onchange=()=>{const tr=i.closest("tr");if(i.checked){BV.sel.add(i.dataset.bvs);tr.classList.add("sel")}else{BV.sel.delete(i.dataset.bvs);tr.classList.remove("sel")}bvCount()});
  const al=m.querySelector("[data-bvall]");if(al)al.onchange=()=>{m.querySelectorAll("[data-bvs]").forEach(i=>{i.checked=al.checked;i.closest("tr").classList.toggle("sel",al.checked);al.checked?BV.sel.add(i.dataset.bvs):BV.sel.delete(i.dataset.bvs)});bvCount()};
  m.querySelectorAll("button[data-bvact]").forEach(b=>b.onclick=()=>{BV.act=b.dataset.bvact;BV.pp=new Set();BV.val=BV.act==="han"?"auto":"plan";renderMain()});
  m.querySelectorAll("[data-bvp]").forEach(b=>b.onclick=()=>{const u=b.dataset.bvp;if(u==="__none")BV.pp=BV.pp.has(u)?new Set():new Set([u]);else{BV.pp.delete("__none");BV.pp.has(u)?BV.pp.delete(u):BV.pp.add(u)}renderMain()});
  const vv=m.querySelector("[data-bvv]");if(vv)vv.onchange=()=>{BV.val=vv.value;renderMain()};
  m.querySelectorAll("[data-bvhan]").forEach(b=>b.onclick=()=>{const id=b.dataset.bvhan,c=D().cards.find(x=>x.id===id);bvCal(b,c?+c.han||0:0,v=>{DB.mutate(ME.name,"sửa hạn "+id,dt=>{const k=dt.cards.find(x=>x.id===id);if(k)k.han=+v});bvRe()},[["0","Xóa hạn"]])});
  const qk=m.querySelector("[data-bvquick]");if(qk)qk.onclick=bvQuick;
  const dn=m.querySelector("[data-bvdon]");if(dn)dn.onclick=bvDon;
  const ad=m.querySelector("[data-bvadd]");if(ad)ad.onclick=bvAdd;
  m.querySelectorAll("[data-bvsku]").forEach(b=>b.onclick=()=>{BV.sku=BV.sku===b.dataset.bvsku?"":b.dataset.bvsku;BV.sel=new Set();renderMain()});
  m.querySelectorAll("[data-bvst]").forEach(s=>s.onchange=()=>{const err=moveCard(ME,s.dataset.bvst,s.value);if(err)toast(err);else toast("Đã chuyển "+s.dataset.bvst+" sang "+bvStT(s.value));bvRe()});
  m.querySelectorAll("[data-bvnx]").forEach(b=>b.onclick=()=>{const c=D().cards.find(x=>x.id===b.dataset.bvnx),nx=c&&nextAct(c);if(!nx)return;const err=moveCard(ME,c.id,nx[1]);if(err)toast(err);else toast(c.id+": "+bvNxL(nx[0]));bvRe()});
  m.querySelectorAll("[data-bvwin]").forEach(b=>b.onclick=e=>{e.stopPropagation();bvWinPick(b.dataset.bvwin)});
  m.querySelectorAll("[data-bvscok]").forEach(b=>b.onclick=async e=>{e.stopPropagation();const c=D().cards.find(y=>y.id===b.dataset.bvscok);if(!c)return;b.disabled=true;const er=await wkTask("card_script_ok",c);toast(er||"Đã duyệt kịch bản, Worker tạo giọng và ghép cảnh");if(er){b.disabled=false;return}DB.mutate(ME.name,"duyệt kịch bản Worker "+c.id,dt=>{const y=dt.cards.find(z=>z.id===c.id);if(y){y.wStage="";y.wStatus="running";y.wHadScr=true;y.wDetail="Kịch bản đã duyệt, Worker đang tạo giọng + ghép cảnh";y.wFixAt=new Date().toISOString()}});renderMain()});
  m.querySelectorAll("[data-bvscfix]").forEach(b=>b.onclick=async e=>{e.stopPropagation();const n=prompt("Cần sửa kịch bản thế nào?");if(!n||!n.trim())return;const c=D().cards.find(y=>y.id===b.dataset.bvscfix);if(!c)return;const er=await wkTask("card_script_fix",c,{note:n.trim()});toast(er||"Đã gửi góp ý, Worker viết lại kịch bản");if(er)return;DB.mutate(ME.name,"sửa kịch bản Worker "+c.id,dt=>{const y=dt.cards.find(z=>z.id===c.id);if(y){y.wStage="";y.wStatus="running";y.wDetail="Worker đang viết lại kịch bản theo góp ý";y.wFixAt=new Date().toISOString()}});renderMain()});
  m.querySelectorAll("[data-bvcol]").forEach(b=>b.onclick=e=>{e.stopPropagation();bvColPop(b)});
  m.querySelectorAll("[data-bvwk]").forEach(b=>b.onclick=()=>openWorkerSend(b.dataset.bvwk));
  m.querySelectorAll("[data-bvhyn]").forEach(b=>b.onclick=()=>{const c=D().cards.find(x=>x.id===b.dataset.bvhyn);if(!c)return;if(!String(c.linkVideo||"").trim()){toast("Chọn video win mẫu ở cột Hook / Link mẫu trước");return}const ref="CARD:"+c.id;hyAnalyzeForm(ref,{ref,ten:"Nhân bản "+sk(c.sku).n+" · "+c.id,link:c.linkVideo,sku:c.sku,nguon:"Điều phối "+c.id})});
  m.querySelectorAll("[data-bvhyw]").forEach(b=>b.onclick=()=>hyWin(b.dataset.bvhyw));
  m.querySelectorAll("[data-bvd]").forEach(s=>s.onchange=()=>{const [id,f]=s.dataset.bvd.split("|"),v=s.value;DB.mutate(ME.name,(f==="ceo"?"CEO check ":"duyệt ")+id+" → "+v,dt=>{const c=dt.cards.find(x=>x.id===id);if(c)c[f]=v});
    /* chọn Đã duyệt / PASS thì bước tự chuyển, không phải bấm thêm nút */
    const go=to=>{const e=moveCard(ME,id,to);if(e){toast(e);return false}return true};let c=D().cards.find(x=>x.id===id),nx=c&&nextAct(c);
    /* CEO tự edit: có link + caption, chọn Đã duyệt và PASS thì video đi thẳng tới Chờ đăng, không phải bấm từng nút */
    if(c&&ME.role==="admin"&&c.duyet==="Đã duyệt"&&c.ceo==="PASS"&&["edit","dvd","dceo"].includes(c.step)){let ok=true,g=0;while(ok&&g++<4){c=D().cards.find(x=>x.id===id);if(!c||!["edit","dvd","dceo"].includes(c.step))break;const n=nextAct(c);if(!n)break;ok=go(n[1])}
      DB.mutate(ME.name,"CEO duyệt thẳng "+id,dt=>{const x=dt.cards.find(y=>y.id===id);if(x){x.duyet="Đã duyệt";x.ceo="PASS"}});c=D().cards.find(x=>x.id===id);if(c&&c.step==="dang")toast("Đã duyệt xong, video sang Chờ đăng");bvRe();return}
    if(c&&f==="duyet"&&v==="Đã duyệt"&&["dkb","dvd"].includes(c.step)&&nx){const was=c.step;if(go(nx[1])){c=D().cards.find(x=>x.id===id);if(was==="dvd"&&c&&c.step==="dceo"&&ME.role==="admin"&&c.ceo==="PASS"){const n2=nextAct(c);if(n2)go(n2[1])}}}
    else if(c&&f==="ceo"&&v==="PASS"&&c.step==="dceo"&&nx)go(nx[1]);
    else if(c&&f==="duyet"&&v==="Cần sửa"&&["dkb","dvd","dceo"].includes(c.step)){try{sendBack(ME,id,"Cần sửa")}catch(e){}}
    bvRe()});
  m.querySelectorAll("[data-bvc]").forEach(i=>i.onchange=()=>{const [id,f]=i.dataset.bvc.split("|"),v=i.value;DB.mutate(ME.name,"sửa video "+id,dt=>{const c=dt.cards.find(x=>x.id===id);if(!c)return;
    if(f==="hook")c.hookText=v;else if(f==="linkFinal")c.linkFinal=v.trim();else if(f==="linkVideo"){c.linkVideo=v.trim();if(c.linkFinal&&!bvMau(c))c.linkFinal=v.trim()}else if(f==="han"||f==="tuan")c[f]=+v;else{c[f]=v;if(f==="nguoiKB"&&["cg","kb"].includes(c.step)){c.nguoi=v||c.nguoi;if(c.step==="cg"&&v&&["oneshot","kichban"].includes(mixOf(c)))c.step="kb"}}});bvRe()});

}
PAGES.bang_video=pBangVideo;
/* chuyển sang bảng video đã lọc sẵn theo sản phẩm và dạng */
function bvGo(kenh,sku,t){BV.only=new Set();BV.k=kenh;BV.sku=sku||"";BV.t=t||"";BV.w=BV.st=BV.ng="";BV.sel=new Set();MOD="mkt";PAGE="kehoach";STEP=7;XV.tab="pc";render();scrollTo(0,0)}

/* gửi duyệt video phải có caption (cmt cần trả lời tùy loại video, lead không duyệt thì bấm Cần sửa) */
const _ckCap=checkMove;
checkMove=function(c,to,inp){const v=k=>((inp||{})[k]!==undefined?inp[k]:c[k])||"";if(to==="dvd"&&!c.fpId&&chOf(c.kenh).needId&&!String(v("caption")).trim())return "Điền caption đăng trước khi gửi duyệt video.";return _ckCap(c,to,inp)};

/* ô Hook / Link mẫu của dòng Nhân bản win: bấm là sổ ra danh sách video win để chọn */
function bvMauCell(c,give){
  const can=give||c.nguoi===ME.id||c.nguoiKB===ME.id,has=String(c.linkVideo||"").trim();
  if(mixOf(c)!=="nhanban")return `<input class="bvhook" data-bvc="${esc(c.id)}|linkVideo" value="${esc(c.linkVideo||"")}" placeholder="Dán link video mẫu (Drive / TikTok)" ${can?"":"disabled"}>`;
  if(!has)return `<button type="button" class="bvwinp" data-bvwin="${esc(c.id)}" ${can?"":"disabled"}>Chọn video win mẫu ▾</button>`;
  const lk=/^https?:/.test(c.linkVideo)?c.linkVideo:"https://"+c.linkVideo;
  return `<div class="bvwinc"><span class="bvwint" title="${esc(c.winTen||c.linkVideo)}">${esc(c.winTen||"Video mẫu")}</span> <a href="${esc(lk)}" target="_blank" rel="noopener" title="Mở video mẫu">↗</a>${can?` <button type="button" class="lnk" data-bvwin="${esc(c.id)}">Đổi</button>`:""}</div>`
}
function bvWinPick(id){
  const d=D(),c=d.cards.find(x=>x.id===id);if(!c)return;
  const all=(typeof winSources==="function"?winSources():[]).slice().sort((a,b)=>(+b.don||0)-(+a.don||0)),st={sku:c.sku,q:""};
  const ov=document.createElement("div");ov.className="wpmodal";
  ov.innerHTML='<div class="wpmbox" style="max-width:760px"><div class="wpmh"><b>Chọn video win để nhân bản</b><button type="button" class="lnk" data-rx="1">✕ Đóng</button></div><div class="m-row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input id="wpk-q" class="bvhook" placeholder="Tìm theo tên video…" style="flex:1;min-width:180px"><label class="ck" style="white-space:nowrap"><input type="checkbox" id="wpk-all"> Hiện cả sản phẩm khác</label></div><div id="wpk-l" style="max-height:52vh;overflow:auto;margin-top:8px"></div><div class="m-row" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input id="wpk-lk" class="bvhook" placeholder="Hoặc dán link video mẫu khác (Drive / TikTok)" style="flex:1;min-width:200px"><button type="button" class="btn sm" id="wpk-use">Dùng link này</button></div></div>';
  document.body.appendChild(ov);
  const draw=()=>{const fq=(st.q||"").toLowerCase(),ck=document.querySelector("#wpk-all").checked,L0=all.filter(s=>(ck||!st.sku||s.sku===st.sku)&&(!fq||String(s.ten||"").toLowerCase().includes(fq))),fb=!L0.length&&!ck&&!fq,L=fb?all:L0;
    ov.querySelector("#wpk-l").innerHTML=(fb&&L.length?'<p class="hint">Chưa có video win của '+esc(sk(st.sku).n)+', đang hiện video win của mọi sản phẩm.</p>':'')+(L.length?'<table class="m-tbl" style="width:100%;font-size:13px"><thead><tr><th>Video</th><th>Sản phẩm</th><th>Nguồn</th><th class="r">Đơn</th><th class="r">GMV</th><th></th></tr></thead><tbody>'+L.slice(0,80).map((s,i)=>'<tr><td style="white-space:normal;max-width:260px">'+esc(String(s.ten||"").slice(0,90))+'</td><td>'+esc(sk(s.sku).n)+'</td><td>'+esc(String(s.nguon||"").slice(0,22))+'</td><td class="r"><b>'+(s.don?nf(s.don):"—")+'</b></td><td class="r">'+(s.gmv?money(s.gmv):"—")+'</td><td>'+(s.link?'<button type="button" class="btn sm pri" data-wpk="'+all.indexOf(s)+'">Chọn</button>':'<span class="hint">Chưa có link</span>')+'</td></tr>').join("")+'</tbody></table>':'<p class="hint">Chưa có video win nào trong web. Tải báo cáo video TikTok ở Nhập báo cáo, hoặc dán link ở dưới.</p>');
    ov.querySelectorAll("[data-wpk]").forEach(b=>b.onclick=()=>{const s=all[+b.dataset.wpk];if(!s)return;set(s.link,s.ref,s.ten)})};
  const set=(link,ref,ten)=>{DB.mutate(ME.name,"chọn video win mẫu cho "+id,dt=>{const x=dt.cards.find(y=>y.id===id);if(!x)return;x.linkVideo=link;x.winSrc=ref||"";x.winTen=String(ten||"").slice(0,80)});ov.remove();toast("Đã chọn video mẫu, bấm Nhân bản (Hypit) để làm tiếp");renderMain()};
  ov.querySelectorAll("[data-rx]").forEach(x=>x.onclick=()=>ov.remove());
  ov.querySelector("#wpk-q").oninput=e=>{st.q=e.target.value;draw()};ov.querySelector("#wpk-all").onchange=draw;
  ov.querySelector("#wpk-use").onclick=()=>{const v=ov.querySelector("#wpk-lk").value.trim();if(!/^https?:\/\//i.test(v)){toast("Dán link bắt đầu bằng https://");return}set(v,"","Video mẫu (dán link)")};
  draw()
}

/* ẩn / hiện cột bảng Điều phối như Excel: chọn cột ở nút "Cột", nhớ lại theo từng người trên máy này */
const BV_COLS=[[2,"STT"],[5,"Dạng"],[6,"Tuần"],[7,"Hook / Link mẫu"],[8,"Viết hook"],[9,"Quay / mẫu"],[10,"Dựng / làm"],[11,"Link video"],[12,"Caption đăng"],[13,"Cmt cần trả lời"],[14,"Hạn"],[15,"Duyệt"],[16,"CEO check"]];
const BV_HK="ailla_bvhid_";
function bvHid(){try{const r=JSON.parse(localStorage.getItem(BV_HK+(ME?ME.id:""))||"[]");return new Set(r.filter(n=>BV_COLS.some(c=>c[0]===n)))}catch(e){return new Set()}}
function bvHidSave(S){try{localStorage.setItem(BV_HK+(ME?ME.id:""),JSON.stringify([...S]))}catch(e){}}
function bvHidCss(){const S=bvHid();return S.size?"<style>"+[...S].map(i=>".bvtab th:nth-child("+i+"),.bvtab td:nth-child("+i+"){display:none}").join("")+"</style>":""}
function bvColPop(anchor){
  document.querySelectorAll(".bvcolpop").forEach(x=>x.remove());
  const S=bvHid(),pop=document.createElement("div");pop.className="kpop bvcolpop";
  pop.innerHTML='<div class="kph"><b>Cột hiển thị</b><small>bỏ tick để ẩn</small><button type="button" class="lnk" data-kx="1">✕</button></div>'+BV_COLS.map(([i,n])=>'<label class="kpl"><input type="checkbox" data-bvci="'+i+'" '+(S.has(i)?"":"checked")+'> '+esc(n)+'</label>').join("")+'<div style="margin-top:6px"><button type="button" class="btn sm" data-bvcall="1">Hiện tất cả</button></div>';
  document.body.appendChild(pop);const r=anchor.getBoundingClientRect();pop.style.left=Math.max(8,Math.min(r.left,innerWidth-pop.offsetWidth-8))+"px";pop.style.top=Math.min(r.bottom+4,Math.max(8,innerHeight-pop.offsetHeight-8))+"px";
  const close=()=>{pop.remove();document.removeEventListener("mousedown",off,true)},off=e=>{if(!pop.contains(e.target)&&e.target!==anchor)close()};setTimeout(()=>document.addEventListener("mousedown",off,true),0);
  pop.querySelector("[data-kx]").onclick=close;
  /* tích nhiều cột liên tiếp: bảng đổi ngay, hộp chọn vẫn mở, chỉ đóng khi bấm ✕ hoặc bấm ra ngoài */
  const live=()=>{const H=bvHid();let st=document.getElementById("bvhidlive");if(!st){st=document.createElement("style");st.id="bvhidlive";document.head.appendChild(st)}st.textContent=[...H].map(i=>".bvtab th:nth-child("+i+"),.bvtab td:nth-child("+i+"){display:none}").join("");anchor.textContent="☰ Cột"+(H.size?" ("+H.size+" ẩn)":"")};
  pop.querySelectorAll("[data-bvci]").forEach(x=>x.onchange=()=>{const H=bvHid(),i=+x.dataset.bvci;if(x.checked)H.delete(i);else H.add(i);bvHidSave(H);live()});
  pop.querySelector("[data-bvcall]").onclick=()=>{bvHidSave(new Set());pop.querySelectorAll("[data-bvci]").forEach(x=>x.checked=true);live()}
}

/* Xem / sửa kịch bản Worker viết: khung bên phải kiểu trang ghi chú. Sửa thẳng chữ rồi duyệt, hoặc góp ý để Worker viết lại. */
function bvScrOpen(id){
  const c=(D().cards||[]).find(x=>x.id===id);if(!c)return;
  const ed=!!(c.wt&&c.wStage==="script"&&c.wStatus==="review"&&(can(ME,"viec.duyet")||ME.role==="admin"));
  openDrawerHTML(`<h2 style="margin:6px 0 2px">Kịch bản ${esc(c.wJob||c.id)}</h2><p class="hint">${ed?"Chị sửa thẳng vào chữ bên dưới. Sửa xong bấm Duyệt, Worker sẽ dựng theo đúng bản chị sửa. Không ưng thì bấm Góp ý để Worker viết lại.":"Kịch bản Worker đã viết."}</p><textarea id="bvScT" class="bvscT" ${ed?"":"readonly"}>${esc(c.wScript||"")}</textarea>${ed?`<div class="acts"><button class="btn pri" id="bvScOk">Duyệt kịch bản</button><button class="btn" id="bvScFixB">Góp ý để Worker viết lại</button></div><div id="bvScFixBox" hidden><textarea id="bvScN" class="bvscN" placeholder="Chị góp ý ngắn, ví dụ: bớt cảm thán, nói rõ cách pha cồn…"></textarea><button class="btn pri" id="bvScFix">Gửi góp ý, viết lại</button></div>`:""}`);
  const T=document.getElementById("bvScT");if(!T)return;
  const fit=()=>{T.style.height="auto";T.style.height=Math.max(360,T.scrollHeight+4)+"px"};fit();
  if(!ed)return;
  const ok=document.getElementById("bvScOk"),orig=(c.wScript||"").trim();
  T.oninput=()=>{fit();ok.textContent=T.value.trim()!==orig?"Lưu bản sửa & duyệt":"Duyệt kịch bản"};
  const done=(msg,upd)=>{toast(msg);DB.mutate(ME.name,"kịch bản Worker "+c.id,dt=>{const y=dt.cards.find(z=>z.id===c.id);if(y){y.wStage="";y.wStatus="running";y.wFixAt=new Date().toISOString();upd(y)}});closeDrawer();renderMain()};
  ok.onclick=async()=>{const txt=T.value.trim();if(!txt){toast("Kịch bản đang trống");return}
    const changed=txt!==orig;ok.disabled=true;
    const er=await wkTask(changed?"card_script_edit":"card_script_ok",c,changed?{script:txt}:{});
    if(er){toast(er);ok.disabled=false;return}
    done(changed?"Đã lưu bản chị sửa, Worker tạo giọng và ghép cảnh":"Đã duyệt kịch bản, Worker tạo giọng và ghép cảnh",y=>{y.wHadScr=true;y.wDetail="Kịch bản đã duyệt, Worker đang tạo giọng + ghép cảnh";if(changed)y.wScript=txt})};
  document.getElementById("bvScFixB").onclick=()=>{const bx=document.getElementById("bvScFixBox");bx.hidden=!bx.hidden;if(!bx.hidden)document.getElementById("bvScN").focus()};
  document.getElementById("bvScFix").onclick=async()=>{const n=document.getElementById("bvScN").value.trim();if(!n){toast("Chị ghi góp ý ngắn trước nhé");return}
    const er=await wkTask("card_script_fix",c,{note:n});if(er){toast(er);return}
    done("Đã gửi góp ý, Worker viết lại kịch bản",y=>{y.wDetail="Worker đang viết lại kịch bản theo góp ý"})};
}
