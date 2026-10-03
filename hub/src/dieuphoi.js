/* =====================================================================
   ĐIỀU PHỐI SẢN XUẤT VIDEO (Marketing · bước 7 Làm hằng ngày)
   Một bảng cho Oanh: thẻ đang ở bước nào, ai giữ, trễ gì; giao hàng loạt
   (viết kịch bản, edit), xếp thẻ vào buổi quay tuần, quay xong chuyển cả loạt
   sang edit; theo dõi từng kênh đủ bao nhiêu video quay mới / reup / kho / nhân bản.
   Luồng: quay mới = kịch bản → Oanh duyệt → quay → edit → Oanh duyệt → chị duyệt → đăng
          reup có sửa = edit → Oanh duyệt → chị duyệt → đăng · video có sẵn trong kho = đăng thẳng
   ===================================================================== */
let DP={step:"",kenh:"",loai:"",nguoi:"",sku:"",sel:new Set()};
const DP_STEPS=["cg","kb","dkb","quay","edit","dvd","dceo","dang","xong"];
const dpCanGive=()=>can(ME,"viec.giao")||ME.role==="admin";
function dpCards(){return D().cards.filter(c=>(!DP.kenh||c.kenh===DP.kenh)&&(!DP.loai||loaiOf(c)===DP.loai)&&(!DP.nguoi||c.nguoi===DP.nguoi)&&(!DP.sku||c.sku===DP.sku))}
const dpLoaiPill=c=>{const L=loaiOf(c);return pill(LOAI_V[L],{moi:"blu",reup:"vio",kho:"gry",nhanban:"pnk"}[L])};
function pDieuPhoi(m){
  const d=D(),today=d.settings.today,C=dpCards(),workers=d.users.filter(u=>u.active&&["lead","content","truongphong","nhanvien"].includes(u.role)&&(u.phongBan==="CM"||u.role==="lead"));
  const by=s=>C.filter(c=>c.step===s||(s==="edit"&&c.step==="worker"));
  const open=C.filter(c=>c.step!=="xong");
  const L=(DP.step?by(DP.step):open).slice().sort((a,b)=>(isLate(b)-isLate(a))||(a.day-b.day));
  [...DP.sel].forEach(id=>{if(!L.some(c=>c.id===id))DP.sel.delete(id)});
  const W=WEEKS.find(w=>today>=w.tu&&today<=w.den)||WEEKS[0];
  const shoots=(d.shoots||[]).filter(s=>s.day>=W.tu-0&&s.day<=W.den+7).sort((a,b)=>a.day-b.day);
  const cell=s=>{const I=by(s),late=I.filter(isLate).length,st=STEPS.find(x=>x.id===s);return `<button type="button" class="dps${DP.step===s?" on":""}${I.length?"":" zero"}" data-dps="${s}"><b class="numeric">${I.length}</b><span>${st.t}</span><small>${st.who}</small>${late?`<em>${late} trễ</em>`:""}</button>`};
  const ownerOf=k=>userName(chanOwner(k))||"chưa đặt";
  const kenhRows=CHANNELS.map(ch=>{const I=d.cards.filter(c=>c.kenh===ch.k),cnt=t=>I.filter(c=>loaiOf(c)===t).length;return `<tr><td><b>${esc(ch.short)}</b><small>${esc(ownerOf(ch.k))}</small></td><td class="n">${I.length}</td><td class="n">${I.filter(c=>c.step==="xong").length}</td><td class="n">${cnt("moi")}</td><td class="n">${cnt("reup")}</td><td class="n">${cnt("kho")}</td><td class="n">${cnt("nhanban")}</td></tr>`}).join("");
  const otherTasks=(d.tasks||[]).filter(t=>t.team==="content"&&t.st!=="done"&&!t.hy);
  m.innerHTML=H("Điều phối sản xuất video",`Tháng ${MONTH.mon} · tuần ${W.w} (${W.tu}–${W.den}/${MONTH.mon}) · bấm một bước để xem thẻ, tick nhiều thẻ để giao cùng lúc`)+`
  <div class="filters"><select id="dp-k">${opt([["","Mọi kênh"]].concat(CHANNELS.map(c=>[c.k,c.k])),DP.kenh)}</select><select id="dp-l">${opt([["","Mọi loại video"]].concat(Object.entries(LOAI_V)),DP.loai)}</select><select id="dp-n">${opt([["","Mọi người"]].concat(workers.map(u=>[u.id,u.name])),DP.nguoi)}</select><select id="dp-s">${opt([["","Mọi sản phẩm"]].concat(skOpts()),DP.sku)}</select>${dpCanGive()?`<span class="sp"></span><button class="btn" data-go="kehoach">Kế hoạch tháng</button><button class="btn" data-go="phanbo">Phân bổ video kho</button>`:""}</div>
  <section class="dpstrip"><button type="button" class="dps all${DP.step===""?" on":""}" data-dps=""><b class="numeric">${open.length}</b><span>Đang mở</span><small>tất cả bước</small>${open.filter(isLate).length?`<em>${open.filter(isLate).length} trễ</em>`:""}</button>${DP_STEPS.map(cell).join("")}</section>
  <div class="dpmain">
   <section class="card flush"><div class="card-h pad"><h2>${DP.step?esc(stepName(DP.step)):"Thẻ đang mở"} <span class="hint">${L.length} thẻ</span></h2>${DP.sel.size&&dpCanGive()?`<span class="hint">đã chọn ${DP.sel.size}</span>`:""}</div>
    ${dpCanGive()&&L.length?`<div class="dpbulk"><label class="ck"><input type="checkbox" id="dp-all" ${L.length&&L.every(c=>DP.sel.has(c.id))?"checked":""}> Chọn tất cả</label>
     <select id="dp-to">${opt([["","Giao cho…"]].concat(workers.map(u=>[u.id,u.name])),"")}</select><button class="btn sm" id="dp-give" ${DP.sel.size?"":"disabled"}>${DP.step==="quay"||DP.step==="edit"?"Giao edit":"Giao việc"}</button>
     ${["dkb","quay"].includes(DP.step)||!DP.step?`<select id="dp-q">${opt([["","Xếp vào buổi quay…"]].concat(shoots.map(s=>[s.id,`${dayLbl(s.day)} ${s.gio||""} · ${s.diaDiem||""}`])),"")}</select><button class="btn sm" id="dp-qgo" ${DP.sel.size?"":"disabled"}>Xếp</button>`:""}
     ${DP.step&&nextAct({step:DP.step,kenh:DP.kenh||"TikTok chính",nguon:""})&&!["dkb","dvd","dceo"].includes(DP.step)?`<button class="btn sm" id="dp-next" ${DP.sel.size?"":"disabled"}>Chuyển bước tiếp</button>`:""}</div>`:""}
    <div class="tbl"><table><thead><tr>${dpCanGive()?"<th></th>":""}<th>Mã · nội dung</th><th>Loại</th><th>Kênh</th><th>Người giữ</th><th>Buổi quay</th><th>Ngày đăng</th><th>Bước</th></tr></thead><tbody>
    ${L.slice(0,80).map(c=>{const late=isLate(c),q=(d.shoots||[]).find(s=>s.id===c.buoiQuay);return `<tr class="clk" data-card="${c.id}">${dpCanGive()?`<td><input type="checkbox" data-dpc="${c.id}" ${DP.sel.has(c.id)?"checked":""} style="width:auto"></td>`:""}<td><div class="dpt">${swatch(c.sku)}<div class="dptc"><div><b class="mono">${esc(c.id)}</b> ${esc(c.hookText||c.yTuong||c.tuyen||"")}</div><div><small>${esc(sk(c.sku).n)}${c.tuyen?" · "+esc(c.tuyen):""}</small></div></div></div></td><td>${dpLoaiPill(c)}</td><td>${esc(chOf(c.kenh).short)}</td><td>${avatar(c.nguoi)}${esc(userName(c.nguoi)||"Chưa giao")}</td><td>${q?esc(dayLbl(q.day)):"—"}</td><td class="${late?"t-red":""}">${c.day?dd(c.day):"—"}${late?" · trễ":""}</td><td>${pill(stepName(c.step),["dkb","dvd","dceo"].includes(c.step)?"amb":c.step==="xong"?"grn":c.step==="cg"?"gry":"blu")}</td></tr>`}).join("")||`<tr><td colspan="8" class="empty">Không có thẻ ở bước này.</td></tr>`}</tbody></table></div>${L.length>80?`<p class="hint pad">Đang hiện 80/${L.length} thẻ, lọc thêm theo kênh hoặc người.</p>`:""}</section>
   <div class="dpside">
    <section class="card"><div class="card-h"><h2>Lịch quay</h2>${dpCanGive()?`<button class="lnk" data-go="giaoviec">+ Tạo buổi quay</button>`:""}</div>
     ${shoots.map(s=>{const I=d.cards.filter(c=>c.buoiQuay===s.id),wait=I.filter(c=>c.step==="quay"||c.step==="dkb");return `<div class="dpq"><div><b>${esc(dayLbl(s.day))} ${esc(s.gio||"")}</b><small>${esc(s.diaDiem||"")} · ${s.nguoi.map(userName).join(", ")||"chưa có người"}</small><small>${I.length} video · ${esc(s.trangThai||"")}</small></div>${dpCanGive()&&wait.length?`<button class="btn sm" data-dpqd="${s.id}">Đã quay xong</button>`:""}</div>`}).join("")||`<p class="empty">Chưa có buổi quay tuần này.</p>`}</section>
    <section class="card"><div class="card-h"><h2>Theo kênh</h2><span class="hint">người giữ kênh đăng bài</span></div>
     <div class="tbl"><table><thead><tr><th>Kênh</th><th class="n">Thẻ</th><th class="n">Đã đăng</th><th class="n">Mới</th><th class="n">Reup</th><th class="n">Kho</th><th class="n">NB</th></tr></thead><tbody>${kenhRows}</tbody></table></div>
     ${dpCanGive()?`<p class="hint">Đổi người giữ kênh ở Kế hoạch tháng › Kế hoạch theo kênh (phụ trách chính).</p>`:""}</section>
    <section class="card"><div class="card-h"><h2>Việc khác của team</h2>${dpCanGive()?`<button class="lnk" id="dp-task">+ Giao việc</button>`:""}</div>
     ${otherTasks.slice(0,6).map(t=>`<div class="dpo clk" data-ot="${t.id}"><b>${esc(t.ten)}</b><small>${esc(userName(t.nguoi)||"chưa giao")} · hạn ${dd(t.han)}${t.han<today?" · trễ":""}</small></div>`).join("")||`<p class="empty">Research, đạo cụ… giao ở đây.</p>`}</section>
   </div>
  </div>`;
  const re=()=>renderMain();
  [["dp-k","kenh"],["dp-l","loai"],["dp-n","nguoi"],["dp-s","sku"]].forEach(([id,k])=>{const e=$("#"+id);if(e)e.onchange=()=>{DP[k]=e.value;re()}});
  m.querySelectorAll("[data-dps]").forEach(b=>b.onclick=()=>{DP.step=b.dataset.dps;DP.sel.clear();re()});
  m.querySelectorAll("[data-dpc]").forEach(x=>{x.onclick=e=>e.stopPropagation();x.onchange=()=>{x.checked?DP.sel.add(x.dataset.dpc):DP.sel.delete(x.dataset.dpc);re()}});
  if($("#dp-all"))$("#dp-all").onchange=e=>{if(e.target.checked)L.forEach(c=>DP.sel.add(c.id));else DP.sel.clear();re()};
  if($("#dp-give"))$("#dp-give").onclick=()=>{const to=$("#dp-to").value;if(!to){toast("Chọn người được giao");return}const ids=[...DP.sel];
    DB.mutate(ME.name,`giao ${ids.length} thẻ cho ${userName(to)}`,dt=>ids.forEach(id=>{const x=dt.cards.find(y=>y.id===id);if(!x)return;if(x.step==="cg"){const Lo=loaiOf(x);x.step=Lo==="moi"?"kb":Lo==="kho"?"dang":"edit"}if(x.step==="quay"||x.step==="edit")x.nguoiEdit=to;if(x.step==="kb")x.nguoiKB=to;x.nguoi=to}));
    DP.sel.clear();toast(`Đã giao ${ids.length} thẻ cho ${userName(to)}`);re()};
  if($("#dp-qgo"))$("#dp-qgo").onclick=()=>{const q=$("#dp-q").value;if(!q){toast("Chọn buổi quay");return}const ids=[...DP.sel];DB.mutate(ME.name,`xếp ${ids.length} thẻ vào buổi quay`,dt=>ids.forEach(id=>{const x=dt.cards.find(y=>y.id===id);if(x)x.buoiQuay=q}));DP.sel.clear();toast("Đã xếp vào buổi quay");re()};
  if($("#dp-next"))$("#dp-next").onclick=()=>{let ok=0,err="";[...DP.sel].forEach(id=>{const c=D().cards.find(x=>x.id===id),nx=c&&nextAct(c);if(!nx)return;const e=moveCard(ME,id,nx[1]);if(e)err=id+": "+e;else ok++});DP.sel.clear();toast(`Đã chuyển ${ok} thẻ`+(err?` · chưa được ${err}`:""));re()};
  m.querySelectorAll("[data-dpqd]").forEach(b=>b.onclick=()=>{const q=b.dataset.dpqd;if(!confirm("Buổi quay đã xong? Các video đã duyệt kịch bản trong buổi này sẽ chuyển sang bước edit."))return;
    DB.mutate(ME.name,"quay xong buổi "+q,dt=>{const s=(dt.shoots||[]).find(x=>x.id===q);if(s)s.trangThai="Đã quay";dt.cards.filter(c=>c.buoiQuay===q&&c.step==="quay").forEach(c=>{c.step="edit";c.nguoiEdit=c.nguoiEdit||c.nguoi})});toast("Đã chuyển sang edit, giao người edit ở bước Đang edit");DP.step="edit";re()});
  m.querySelectorAll("[data-ot]").forEach(r=>r.onclick=()=>openTask(r.dataset.ot));
  if($("#dp-task"))$("#dp-task").onclick=()=>openTask(null);
}
PAGES.dieuphoi=pDieuPhoi;
