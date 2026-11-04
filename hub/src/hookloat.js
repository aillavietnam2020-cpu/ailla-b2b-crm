/* =====================================================================
   GIAO VIẾT HOOK THÀNH TASK (chị Hoa 04/11/2026)
   Lead chọn video ở Điều phối › Cập nhật nhanh, giao người viết hook (số hook mỗi người).
   Video dạng hook (one shot): mỗi người nhận MỘT task "Viết N hook" ở Công việc. Nhân sự viết hook vào file Drive,
   dán link ở ô Kết quả rồi Nộp. Lead duyệt task là các video đó sang "Chờ quay"; Lead trả lại thì video giữ nguyên.
   Không cần điền từng hook vào ô ở Điều phối (viết hook chỉ để đi quay).
   Video dạng kịch bản: vẫn làm và nộp từng kịch bản ở từng video như cũ.
   ===================================================================== */
const hlTask=(dt,c)=>c&&c.hookTask?(dt.tasks||[]).find(t=>t.id===c.hookTask):null;
const hlName=(dt,ids)=>{const L=ids.map(id=>dt.cards.find(c=>c.id===id)).filter(Boolean),sp=[...new Set(L.map(c=>sk(c.sku).n))].slice(0,2).join(", "),tu=[...new Set(L.map(c=>{const t=(dt.tuyen||[]).find(x=>x.ma===c.maTuyen);return t?t.tuyen:""}).filter(Boolean))];
  return `Viết ${L.length} hook · ${sp}${tu.length===1?" · "+tu[0]:""}`};
const hlDesc=(dt,ids)=>ids.map((id,i)=>{const c=dt.cards.find(y=>y.id===id);if(!c)return "";const t=(dt.tuyen||[]).find(x=>x.ma===c.maTuyen);return `${i+1}. ${c.id} · ${sk(c.sku).n}${t?" · "+t.tuyen:""}${c.yTuong&&!/^Viết /.test(c.yTuong)?" · "+c.yTuong:""}`}).filter(Boolean).join("\n")
  +"\n\nViết các hook vào một file Drive, dán link ở ô Kết quả rồi bấm Nộp. Lead duyệt xong là các video này sang Chờ quay.";
/* gọi trong DB.mutate của Cập nhật nhanh, sau khi đã gán người viết */
function hlGiao(dt,ids){const per={},kb={},td=dt.settings.today;dt.tasks=dt.tasks||[];
  ids.forEach(id=>{const c=dt.cards.find(x=>x.id===id);if(!c||!c.nguoiKB||c.step!=="kb")return;
    if(!hkIsHook(c)){(kb[c.nguoiKB]=kb[c.nguoiKB]||[]).push(c);return}
    const o=hlTask(dt,c);if(o&&o.st!=="done"&&o.nguoi===c.nguoiKB)return;
    if(o&&o.st!=="done"){o.hookCards=(o.hookCards||[]).filter(x=>x!==c.id);if(o.hookCards.length){o.ten=hlName(dt,o.hookCards);o.moTa=hlDesc(dt,o.hookCards)}else{o.st="done";o.huy=true;tkLog(o,"Các video đã giao người khác viết hook")}}
    (per[c.nguoiKB]=per[c.nguoiKB]||[]).push(c)});
  Object.entries(per).forEach(([u,L])=>{const ids2=L.map(c=>c.id),hn=L.map(c=>+c.han||0).filter(Boolean).sort((a,b)=>a-b)[0]||Math.min(MONTH.ndays,td+1),id=uid("cv");
    const x={id,ten:hlName(dt,ids2),moTa:hlDesc(dt,ids2),team:"content",da:"",nguoi:u,phoi:[],han:hn,bd:td,uu:"Cao",st:"todo",checklist:[],files:[],loai:"Viết hook",tao:ME.id,duyet:ME.id,hookCards:ids2,log:[]};
    tkLog(x,`${ME.name} giao viết ${ids2.length} hook từ Điều phối`);dt.tasks.push(x);L.forEach(c=>{c.hookTask=id});
    if(typeof notifyU==="function")notifyU(dt,[u],`✍️ ${ME.name} giao bạn viết ${ids2.length} hook · hạn ${dd(hn)}`,"task:"+id)});
  if(typeof notifyU==="function")Object.entries(kb).forEach(([u,L])=>{const hn=L.map(c=>+c.han||0).filter(Boolean).sort((a,b)=>a-b)[0];notifyU(dt,[u],`📝 ${ME.name} giao bạn viết ${L.length} kịch bản · ${[...new Set(L.map(c=>sk(c.sku).n))].slice(0,2).join(", ")}${hn?" · hạn "+dd(hn):""} · làm và nộp từng kịch bản ở Điều phối`,"page:bang_video")})}
/* Lead duyệt task viết hook → các video sang Chờ quay */
function hlDone(id){const t=(D().tasks||[]).find(x=>x.id===id);if(!t||t.st!=="done"||t.huy||!(t.hookCards||[]).length)return;
  const now=new Date().toLocaleString("vi-VN");
  DB.mutate(ME.name,`duyệt ${t.hookCards.length} hook · ${t.ten}`,dt=>t.hookCards.forEach(cid=>{const c=dt.cards.find(y=>y.id===cid);if(!c||!["kb","dkb"].includes(c.step))return;
    c.step="quay";c.duyet="Đã duyệt";c.hookLink=t.kq||"";c.history=(c.history||[]).concat({t:now,who:ME.name,to:"quay"})}))}
const _tkApproveHl=tkApprove;
tkApprove=function(id){const r=_tkApproveHl(id);try{hlDone(id)}catch(e){console.error("duyệt viết hook",e)}return r};
/* ô hook ở Điều phối: video đã giao theo task thì hiện tên task + link file, không bắt điền */
function hlCell(c){const d=D(),t=hlTask(d,c);if(!t)return "";const st=t.st==="done"?"đã duyệt":t.st==="review"?"chờ Lead duyệt":"đang viết";
  return `<span class="hlcell">📄 <button type="button" class="lnk" onclick="openTask('${esc(t.id)}')">${esc(t.ten)}</button> <small class="hint">· ${esc(userName(t.nguoi)||"")} · ${st}</small>${t.kq?` <a href="${esc(t.kq)}" target="_blank" rel="noopener">Mở file hook</a>`:""}</span>`}
const _tkSetStHl=tkSetSt;
tkSetSt=function(id,k,extra,note){const r=_tkSetStHl(id,k,extra,note);if(k==="done")try{hlDone(id)}catch(e){console.error("duyệt viết hook",e)}return r};
