/* =====================================================================
   ĐIỀU ĐỘ SẢN XUẤT (chị Hoa duyệt demo 21/11/2026, đổi tên từ "Hôm nay xưởng") — trang cho CEO và người quản lý điều phối sản xuất.
   ① Lệnh sản xuất đến hạn: phiếu sản xuất (PSX) chưa xong, hạn đến hết ngày mai, quá hạn lên đầu.
   ② Đơn hàng cần xuất trong ngày: đơn Kênh phân phối / Kênh OEM đã duyệt, chờ xuất, ngày giao ≤ hôm nay.
   ③ Báo cáo sản lượng cuối ngày: mỗi dòng = số người × từ giờ – đến giờ → số cái; "Việc khác" tách giờ không ra hàng.
   ④ Định mức giờ: trung bình từ sổ ghi, đủ dữ liệu khi một sản phẩm có từ 3 lần ghi.
   Sổ ghi lưu trong dữ liệu Sản xuất (SX().nk), ghi qua sxMut như các thao tác sản xuất khác.
   ===================================================================== */
const HN={day:"",draft:null,draftDay:"",orders:null,at:0,busy:false,err:""};
const hnOk=()=>typeof mhManage==="function"&&mhManage();
const HN_KHAC="__khac";
/* "7:30" → 7.5 giờ; sai định dạng → NaN */
const hnH=t=>{const m=String(t||"").trim().match(/^(\d{1,2})(?:[:h.](\d{0,2}))?$/i);return m?(+m[1])+(+(m[2]||0))/60:NaN};
/* giá trị cho ô giờ (type=time cần dạng 07:30) */
const hnTime=t=>{const h=hnH(t);if(!isFinite(h))return "";const H=Math.floor(h),M=Math.round((h-H)*60);return sxPad(H)+":"+sxPad(M)};
const hnHours=r=>{const a=hnH(r.tu),b=hnH(r.den);return isFinite(a)&&isFinite(b)&&b>a?b-a:0};
const hnCong=r=>(+r.nguoi||0)*hnHours(r);
const hnR1=x=>Math.round(x*10)/10;
const hnAdd=(d,n)=>{const t=new Date(d+"T00:00:00");t.setDate(t.getDate()+n);return `${t.getFullYear()}-${sxPad(t.getMonth()+1)}-${sxPad(t.getDate())}`};
const hnUnit=sp=>{const p=sxP(sp);return p.dvt&&p.dvt!=="sp"?p.dvt:"cái"};

function hnLoadOrders(force){
  if(HN.busy||(!force&&HN.orders&&Date.now()-HN.at<30000))return;HN.busy=true;
  svApi("/api/hub/kho/b2b-pending").then(r=>{HN.orders=r||[];HN.err=""}).catch(e=>{HN.err=e.message;HN.orders=HN.orders||[]})
    .finally(()=>{HN.busy=false;HN.at=Date.now();if(PAGE==="sx_hn"&&!svTyping())renderMain()})}

function hnRowsOf(day){return (SX().nk||[]).filter(r=>r.ngay===day)}
function hnDraft(day){
  if(HN.draftDay!==day||!HN.draft||!HN.dirty){HN.draftDay=day;HN.draft=hnRowsOf(day).map(r=>({...r}));if(!HN.draft.length)HN.draft=[{sp:"",nguoi:"",tu:"",den:"",sl:"",ghi:""}]}
  return HN.draft}

function pSxHn(m){
  const T="Điều độ sản xuất",S0="Lệnh sản xuất đến hạn, đơn hàng cần xuất, báo cáo sản lượng và định mức năng suất";
  if(!hnOk()){m.innerHTML=H(T,"")+`<div class="note">Trang này chỉ dành cho CEO và quản lý điều phối sản xuất.</div>`;return}
  const s=SX(),today=sxToday(),day=HN.day||today,tmr=hnAdd(today,1);hnLoadOrders();
  /* ① Lệnh sản xuất chưa xong, hạn ≤ ngày mai (hoặc đang làm mà chưa đặt hạn) — chia nhóm Quá hạn / Hôm nay / Ngày mai */
  const open=s.requests.filter(r=>["CAN_LAM","DANG_LAM"].includes(r.st)&&((r.han&&r.han<=tmr)||(!r.han&&r.st==="DANG_LAM")));
  const late=open.filter(r=>r.han&&r.han<today);
  const grp=(t,rows,cols,cls="")=>rows.length?`<tr class="hn-grp ${cls}"><td colspan="${cols}">${t} · ${rows.length}</td></tr>`+rows.join(""):"";
  const reqTr=r=>{const st=SX_REQ_ST[r.st]||[r.st,"gry"];
    return `<tr><td><b>${esc(sxP(r.sp).ten)}</b><div class="hn-sub"><span class="mono">${esc(r.id)}</span>${r.nguon?" · "+esc(r.nguon):""}${r.ghiChu?" · "+esc(r.ghiChu):""}</div></td><td class="n">${r.sl?nf(r.sl)+" "+esc(hnUnit(r.sp)):"chưa chốt"}</td><td>${pill(st[0],st[1])}</td></tr>`};
  const reqBody=grp("Quá hạn",late.map(reqTr),3,"red")+grp("Hạn hôm nay",open.filter(r=>r.han===today).map(reqTr),3)+grp("Hạn ngày mai",open.filter(r=>r.han===tmr).map(reqTr),3)+grp("Đang làm, chưa đặt hạn",open.filter(r=>!r.han).map(reqTr),3);
  /* ② Đơn chờ xuất có ngày giao ≤ hôm nay; nối với lệnh sản xuất thiếu hàng cùng mã CRM nếu có */
  const oDay=o=>String(o.ship_date||o.need_date||"").slice(0,10);
  const due=(HN.orders||[]).filter(o=>{const d=oDay(o);return d&&d<=today}),dueLate=due.filter(o=>oDay(o)<today);
  const psxOf=sku=>s.requests.find(r=>r.src==="THIEU_CRM"&&r.skuCrm===sku&&["CAN_LAM","DANG_LAM"].includes(r.st));
  const ordTr=o=>{const L=o.lines||[],wait=[...new Set(L.map(l=>psxOf(l.sku)).filter(Boolean).map(r=>r.id))];
    return `<tr><td><b>${esc(o.customer_name)}</b><div class="hn-sub"><span class="mono">${esc(o.order_no)}</span> · ${o.kenh==="GIA_CONG"?"Kênh OEM":"Kênh phân phối"} · giao ${esc(sxDd(oDay(o)))}</div></td><td>${L.map(l=>`<div>${esc(l.name)} <b>× ${nf(l.qty)}</b></div>`).join("")}</td><td>${wait.length?pill("Chờ sản xuất","amb")+`<div class="hn-sub mono">${esc(wait.join(", "))}</div>`:pill("Chờ xuất kho","gry")}</td></tr>`};
  const ordBody=grp("Trễ hạn giao",dueLate.map(ordTr),3,"red")+grp("Giao hôm nay",due.filter(o=>oDay(o)===today).map(ordTr),3);
  const box=(ic,l,v,h,c)=>`<div class="sxk hn-k t-${c}"><i>${ico(ic)}</i><span><small>${l}</small><b>${v}</b>${h?`<em>${h}</em>`:""}</span></div>`;
  const tb=(head,body,empty)=>`<div class="tbl"><table><thead><tr>${head}</tr></thead><tbody>${body||`<tr><td colspan="3" class="empty">${empty}</td></tr>`}</tbody></table></div>`;
  /* ③ Báo cáo sản lượng ngày đang chọn */
  const dr=hnDraft(day),prods=s.products.filter(p=>p.active!==false).slice().sort((a,b)=>String(a.ten).localeCompare(String(b.ten),"vi"));
  const opt=v=>`<option value="">— Chọn sản phẩm / công việc —</option><option value="${HN_KHAC}"${v===HN_KHAC?" selected":""}>Công việc gián tiếp (chờ vật tư, vệ sinh, sửa máy)</option><optgroup label="Sản phẩm">`+prods.map(p=>`<option value="${esc(p.ma)}"${p.ma===v?" selected":""}>${esc(p.ten)}</option>`).join("")+`</optgroup>`;
  const logRows=dr.map((r,i)=>{const k=r.sp===HN_KHAC,c=hnCong(r),rate=!k&&c>0&&+r.sl>0?nf(+r.sl/c)+" "+esc(hnUnit(r.sp)):"—";
    return `<tr${k?' class="hn-oth"':""}><td class="hn-i">${i+1}</td><td><select class="hn-in" data-hn="sp" data-i="${i}">${opt(r.sp)}</select></td><td><input class="hn-in hn-num" data-hn="nguoi" data-i="${i}" value="${esc(r.nguoi)}" inputmode="numeric"></td><td><input class="hn-in hn-t" type="time" data-hn="tu" data-i="${i}" value="${esc(hnTime(r.tu))}"></td><td><input class="hn-in hn-t" type="time" data-hn="den" data-i="${i}" value="${esc(hnTime(r.den))}"></td><td>${k?`<span class="hn-dash">—</span>`:`<input class="hn-in hn-num" data-hn="sl" data-i="${i}" value="${esc(r.sl)}" inputmode="numeric">`}</td><td class="n hn-calc">${c?hnR1(c):"—"}</td><td class="n hn-calc">${rate}</td><td><input class="hn-in" data-hn="ghi" data-i="${i}" value="${esc(r.ghi)}" placeholder="Ghi chú"></td><td><button class="lnk hn-del" data-hndel="${i}" title="Xóa dòng">✕</button></td></tr>`});
  const sum=f=>dr.reduce((a,r)=>a+f(r),0),tC=sum(r=>r.sp&&r.sp!==HN_KHAC?hnCong(r):0),tK=sum(r=>r.sp===HN_KHAC?hnCong(r):0);
  const saved=hnRowsOf(today),congHN=saved.filter(r=>r.sp!==HN_KHAC).reduce((a,r)=>a+hnCong(r),0),khacHN=saved.filter(r=>r.sp===HN_KHAC).reduce((a,r)=>a+hnCong(r),0);
  /* ④ Định mức năng suất từ toàn bộ báo cáo */
  const G={};(s.nk||[]).forEach(r=>{if(!r.sp||r.sp===HN_KHAC)return;const c=hnCong(r);if(!(c>0&&+r.sl>0))return;const g=G[r.sp]||(G[r.sp]={n:0,c:0,sl:0});g.n++;g.c+=c;g.sl+=+r.sl});
  const dmRows=Object.entries(G).sort((a,b)=>b[1].n-a[1].n).map(([sp,g])=>`<tr><td>${esc(sxP(sp).ten)}</td><td class="n">${g.n}</td><td class="n">${hnR1(g.c)}</td><td class="n">${nf(g.sl)}</td><td class="n"><b>${nf(g.sl/g.c)} ${esc(hnUnit(sp))}</b></td><td>${g.n<3?pill("Chưa đủ dữ liệu","amb"):pill("Áp dụng","grn")}</td></tr>`);
  m.innerHTML=H(T,S0+" · "+esc(sxDd(today)))+`
  <div class="sxkpis s4">${box("task","Lệnh sản xuất đến hạn",open.length,late.length?late.length+" quá hạn":"không có lệnh quá hạn",late.length?"red":"blu")}${box("box","Đơn hàng cần xuất trong ngày",HN.orders?due.length:"…",dueLate.length?dueLate.length+" đơn trễ hạn":"",dueLate.length?"red":"org")}${box("clock","Giờ công trực tiếp hôm nay",hnR1(congHN)+" giờ","theo báo cáo đã lưu","grn")}${box("alert","Giờ công gián tiếp hôm nay",hnR1(khacHN)+" giờ",congHN+khacHN>0?Math.round(khacHN/(congHN+khacHN)*100)+"% tổng giờ công":"","vio")}</div>
  <div class="sxgrid2 hn-row hn-eq">
   <section class="card"><div class="card-h hn-h"><h2>① Lệnh sản xuất đến hạn</h2><button class="lnk" data-go="sx_td">Tiến độ xưởng ›</button></div>
    ${tb(`<th>Sản phẩm / lệnh</th><th class="n">Số lượng</th><th>Trạng thái</th>`,reqBody,"Không có lệnh sản xuất đến hạn.")}</section>
   <section class="card"><div class="card-h hn-h"><h2>② Đơn hàng cần xuất trong ngày</h2><button class="lnk" data-go="kho_xuat_b2b">Xuất kho đơn ›</button></div>
    ${HN.err?`<div class="note red">${esc(HN.err)}</div>`:""}${HN.orders?tb(`<th>Khách hàng / đơn</th><th>Hàng hóa</th><th>Tình trạng</th>`,ordBody,"Không có đơn cần xuất hôm nay."):`<p class="hint">Đang tải…</p>`}</section>
  </div>
  <section class="card"><div class="card-h hn-h"><h2>③ Báo cáo sản lượng</h2><label class="hn-day">Ngày báo cáo <input type="date" id="hn-day" value="${esc(day)}" max="${esc(today)}"></label></div>
   <div class="tbl hn-log"><table><thead><tr><th>#</th><th>Công việc / sản phẩm</th><th>Số lao động</th><th>Bắt đầu</th><th>Kết thúc</th><th>Sản lượng</th><th class="n">Giờ công</th><th class="n">Năng suất / giờ công</th><th>Ghi chú</th><th></th></tr></thead>
   <tbody>${logRows.join("")}</tbody>
   <tfoot><tr><td></td><td colspan="5"><b>Tổng</b> <span class="hn-sub">trực tiếp <b id="hn-tc">${hnR1(tC)}</b> giờ · gián tiếp <b id="hn-tk">${hnR1(tK)}</b> giờ</span></td><td class="n"><b id="hn-tt">${hnR1(tC+tK)}</b></td><td colspan="3"></td></tr></tfoot></table></div>
   <div class="hn-act"><button class="btn" id="hn-add">+ Thêm dòng</button><span class="hint" id="hn-msg">${HN.dirty?"Có thay đổi chưa lưu.":""}</span><span class="sp"></span><button class="btn pri" id="hn-save">Lưu báo cáo</button></div>
   <p class="hint">Mỗi dòng: một nhóm lao động làm một công việc liên tục. Chuyển công việc thì thêm dòng. Thời gian chờ vật tư, vệ sinh, sửa máy chọn "Công việc gián tiếp" để không tính vào giá thành.</p></section>
  <section class="card"><div class="card-h hn-h"><h2>④ Định mức năng suất</h2><span class="hint">Tính từ báo cáo sản lượng · áp dụng khi sản phẩm có từ 3 lần báo cáo</span></div>
   <div class="tbl"><table><thead><tr><th>Sản phẩm</th><th class="n">Số lần báo cáo</th><th class="n">Tổng giờ công</th><th class="n">Tổng sản lượng</th><th class="n">Năng suất / giờ công</th><th>Trạng thái</th></tr></thead><tbody>${dmRows.join("")||`<tr><td colspan="6" class="empty">Chưa có báo cáo sản lượng.</td></tr>`}</tbody></table></div></section>`;
  /* Nút data-go do bindCommon (app.js) gắn sẵn. Gõ số thì chỉ cập nhật ô Giờ công / 1 giờ công của dòng đó, không vẽ lại cả trang. */
  const recalc=i=>{const r=HN.draft[i],tr=m.querySelector(`[data-hn][data-i="${i}"]`).closest("tr"),c=hnCong(r),k=r.sp===HN_KHAC;
    tr.cells[6].textContent=c?hnR1(c):"—";tr.cells[7].textContent=!k&&c>0&&+r.sl>0?nf(+r.sl/c)+" "+hnUnit(r.sp):"—";$("#hn-msg").textContent="Có thay đổi chưa lưu.";
    const t=f=>HN.draft.reduce((a,x)=>a+f(x),0),tc=t(x=>x.sp&&x.sp!==HN_KHAC?hnCong(x):0),tk=t(x=>x.sp===HN_KHAC?hnCong(x):0);$("#hn-tc").textContent=hnR1(tc);$("#hn-tk").textContent=hnR1(tk);$("#hn-tt").textContent=hnR1(tc+tk)};
  m.querySelectorAll("[data-hn]").forEach(el=>{const ev=el.tagName==="SELECT"?"change":"input";el.addEventListener(ev,()=>{const i=+el.dataset.i,r=HN.draft[i];r[el.dataset.hn]=el.value;HN.dirty=true;
    if(el.tagName==="SELECT"){if(el.value===HN_KHAC)r.sl="";renderMain()}else recalc(i)})});
  m.querySelectorAll("[data-hndel]").forEach(b=>b.onclick=()=>{HN.draft.splice(+b.dataset.hndel,1);if(!HN.draft.length)HN.draft.push({sp:"",nguoi:"",tu:"",den:"",sl:"",ghi:""});HN.dirty=true;renderMain()});
  $("#hn-add").onclick=()=>{const last=HN.draft[HN.draft.length-1]||{};HN.draft.push({sp:"",nguoi:last.nguoi||"",tu:last.den||"",den:"",sl:"",ghi:""});HN.dirty=true;renderMain()};
  $("#hn-day").onchange=e=>{if(HN.dirty&&!confirm("Có thay đổi chưa lưu ở ngày đang mở. Bỏ thay đổi và chuyển ngày?")){e.target.value=day;return}HN.day=e.target.value||today;HN.draft=null;HN.dirty=false;renderMain()};
  $("#hn-save").onclick=()=>{
    const rows=HN.draft.filter(r=>r.sp||r.nguoi||r.tu||r.den||r.sl);
    for(const [i,r] of rows.entries()){
      if(!r.sp)return toast("Dòng "+(i+1)+": chưa chọn sản phẩm hoặc công việc gián tiếp");
      if(!(+r.nguoi>0))return toast("Dòng "+(i+1)+": chưa ghi số lao động");
      if(!hnHours(r))return toast("Dòng "+(i+1)+": giờ chưa đúng (ví dụ 7:30 đến 11:30)");
      if(r.sp!==HN_KHAC&&!(+r.sl>=0&&String(r.sl).trim()!==""))return toast("Dòng "+(i+1)+": chưa ghi sản lượng")}
    const clean=rows.map(r=>({id:r.id||("NK-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)),ngay:day,sp:r.sp,nguoi:+r.nguoi,tu:String(r.tu).trim(),den:String(r.den).trim(),sl:r.sp===HN_KHAC?0:+r.sl,ghi:String(r.ghi||"").trim(),by:r.by||ME.name,at:r.at||sxNow()}));
    sxMut("Báo cáo sản lượng ngày "+sxDd(day)+" ("+clean.length+" dòng)",d=>{d.nk=(d.nk||[]).filter(r=>r.ngay!==day).concat(clean)});
    HN.draft=null;HN.dirty=false;toast("Đã lưu báo cáo sản lượng ngày "+sxDd(day));renderMain()};
}
PAGES.sx_hn=sxInit(pSxHn);
{
  const sx=MODULES.find(x=>x.k==="sx");
  if(sx){const g0=sx.groups;sx.groups=function(){const r=g0.apply(this,arguments)||[];if(r.some(g=>g[1].some(i=>i[0]==="sx_hn")))return r;
    const it=MI("sx_hn","Điều độ sản xuất",()=>hnOk());const g=r.find(x=>x[0]==="Sản xuất");if(g)g[1]=[it].concat(g[1]);else r.push(["Sản xuất",[it]]);return r}}
}
