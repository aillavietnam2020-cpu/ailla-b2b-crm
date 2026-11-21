/* =====================================================================
   HÔM NAY XƯỞNG (chị Hoa duyệt demo 21/11/2026) — trang cho CEO và người quản lý điều phối sản xuất.
   ① Việc sản xuất hôm nay: phiếu sản xuất (PSX) chưa xong, hạn đến hết ngày mai, quá hạn lên đầu.
   ② Đơn cần xuất hôm nay: đơn Kênh phân phối / Kênh OEM đã duyệt, chờ xuất, ngày giao ≤ hôm nay.
   ③ Ghi sản lượng cuối ngày: mỗi dòng = số người × từ giờ – đến giờ → số cái; "Việc khác" tách giờ không ra hàng.
   ④ Định mức giờ: trung bình từ sổ ghi, đủ dữ liệu khi một sản phẩm có từ 3 lần ghi.
   Sổ ghi lưu trong dữ liệu Sản xuất (SX().nk), ghi qua sxMut như các thao tác sản xuất khác.
   ===================================================================== */
const HN={day:"",draft:null,draftDay:"",orders:null,at:0,busy:false,err:""};
const hnOk=()=>typeof mhManage==="function"&&mhManage();
const HN_KHAC="__khac";
/* "7:30" → 7.5 giờ; sai định dạng → NaN */
const hnH=t=>{const m=String(t||"").trim().match(/^(\d{1,2})(?:[:h.](\d{0,2}))?$/i);return m?(+m[1])+(+(m[2]||0))/60:NaN};
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
  const T="Hôm nay xưởng",S0="Việc sản xuất, đơn cần xuất và sổ ghi sản lượng cuối ngày";
  if(!hnOk()){m.innerHTML=H(T,"")+`<div class="note">Trang này chỉ dành cho CEO và người quản lý điều phối sản xuất.</div>`;return}
  const s=SX(),today=sxToday(),day=HN.day||today,tmr=hnAdd(today,1);hnLoadOrders();
  /* ① Phiếu sản xuất chưa xong, hạn ≤ ngày mai (hoặc chưa đặt hạn nhưng đang làm) */
  const open=s.requests.filter(r=>["CAN_LAM","DANG_LAM"].includes(r.st)&&((r.han&&r.han<=tmr)||(!r.han&&r.st==="DANG_LAM")))
    .sort((a,b)=>(a.han||"9")<(b.han||"9")?-1:(a.han||"9")>(b.han||"9")?1:0);
  const late=open.filter(r=>r.han&&r.han<today).length;
  const reqRows=open.map(r=>{const st=SX_REQ_ST[r.st]||[r.st,"gry"],lt=r.han&&r.han<today;
    return `<tr><td class="mono">${esc(r.id)}</td><td>${esc(sxP(r.sp).ten)}</td><td class="n">${r.sl?nf(r.sl)+" "+esc(hnUnit(r.sp)):"chưa chốt"}</td><td>${esc(sxDd(r.han))}</td><td>${lt?pill("Quá hạn","red"):pill(st[0],st[1])}</td><td>${esc([r.nguon,r.ghiChu].filter(Boolean).join(" · "))}</td></tr>`});
  /* ② Đơn chờ xuất có ngày giao ≤ hôm nay; nối với phiếu sản xuất thiếu hàng cùng mã CRM nếu có */
  const due=(HN.orders||[]).filter(o=>{const d=String(o.ship_date||o.need_date||"").slice(0,10);return d&&d<=today});
  const psxOf=sku=>s.requests.find(r=>r.src==="THIEU_CRM"&&r.skuCrm===sku&&["CAN_LAM","DANG_LAM"].includes(r.st));
  const ordRows=due.map(o=>{const d=String(o.ship_date||o.need_date).slice(0,10),L=o.lines||[];
    const wait=[...new Set(L.map(l=>psxOf(l.sku)).filter(Boolean).map(r=>r.id))];
    return `<tr><td class="mono">${esc(o.order_no)}</td><td>${esc(o.customer_name)}</td><td>${o.kenh==="GIA_CONG"?"Kênh OEM":"Kênh phân phối"}</td><td>${esc(sxDd(d))} ${d<today?pill("Trễ","red"):""}</td><td>${L.map(l=>esc(l.name)+" × "+nf(l.qty)).join("<br>")}</td><td>${wait.length?pill("Chờ sản xuất ("+wait.join(", ")+")","amb"):"—"}</td></tr>`});
  /* ③ Sổ ghi ngày đang chọn */
  const dr=hnDraft(day),prods=s.products.filter(p=>p.active!==false).slice().sort((a,b)=>String(a.ten).localeCompare(String(b.ten),"vi"));
  const opt=v=>`<option value="">— chọn sản phẩm —</option><option value="${HN_KHAC}"${v===HN_KHAC?" selected":""}>Việc khác: chờ hàng, dọn, sửa máy</option>`+prods.map(p=>`<option value="${esc(p.ma)}"${p.ma===v?" selected":""}>${esc(p.ten)}</option>`).join("");
  const logRows=dr.map((r,i)=>{const k=r.sp===HN_KHAC,c=hnCong(r),rate=!k&&c>0&&+r.sl>0?nf(+r.sl/c)+" "+esc(hnUnit(r.sp)):"—";
    return `<tr${k?' class="hn-oth"':""}><td><select data-hn="sp" data-i="${i}">${opt(r.sp)}</select></td><td class="n"><input data-hn="nguoi" data-i="${i}" value="${esc(r.nguoi)}" inputmode="numeric" size="3"></td><td><input data-hn="tu" data-i="${i}" value="${esc(r.tu)}" placeholder="7:30" size="5"></td><td><input data-hn="den" data-i="${i}" value="${esc(r.den)}" placeholder="11:30" size="5"></td><td class="n">${k?"—":`<input data-hn="sl" data-i="${i}" value="${esc(r.sl)}" inputmode="numeric" size="6">`}</td><td><input data-hn="ghi" data-i="${i}" value="${esc(r.ghi)}" size="16"></td><td class="n">${c?hnR1(c):"—"}</td><td class="n">${rate}</td><td><button class="lnk" data-hndel="${i}" title="Xóa dòng">✕</button></td></tr>`});
  const saved=hnRowsOf(today),congHN=saved.filter(r=>r.sp!==HN_KHAC).reduce((a,r)=>a+hnCong(r),0),khacHN=saved.filter(r=>r.sp===HN_KHAC).reduce((a,r)=>a+hnCong(r),0);
  /* ④ Định mức giờ từ toàn bộ sổ ghi */
  const G={};(s.nk||[]).forEach(r=>{if(!r.sp||r.sp===HN_KHAC)return;const c=hnCong(r);if(!(c>0&&+r.sl>0))return;const g=G[r.sp]||(G[r.sp]={n:0,c:0,sl:0});g.n++;g.c+=c;g.sl+=+r.sl});
  const dmRows=Object.entries(G).sort((a,b)=>b[1].n-a[1].n).map(([sp,g])=>`<tr><td>${esc(sxP(sp).ten)}</td><td class="n">${g.n}</td><td class="n">${hnR1(g.c)}</td><td class="n">${nf(g.sl)}</td><td class="n">${nf(g.sl/g.c)} ${esc(hnUnit(sp))} ${g.n<3?pill("chưa đủ","amb"):pill("dùng được","grn")}</td></tr>`);
  const kpi=(t,v,x="")=>`<div class="card hn-kpi"><small>${t}</small><b>${v}</b> ${x}</div>`;
  m.innerHTML=H(T,S0+" · "+esc(sxDd(today)))+`
  <div class="hn-kpis">${kpi("Việc sản xuất đến hạn",open.length,late?pill(late+" quá hạn","red"):"")}${kpi("Đơn cần xuất hôm nay",HN.orders?due.length:"…",due.filter(o=>String(o.ship_date||o.need_date).slice(0,10)<today).length?pill("có đơn trễ","red"):"")}${kpi("Giờ công đã ghi hôm nay",hnR1(congHN)+" giờ")}${kpi("Giờ việc khác hôm nay",hnR1(khacHN)+" giờ")}</div>
  <div class="card"><h2 class="hn-h"><span>① Việc sản xuất hôm nay</span><button class="btn" data-go="sx_td">Mở tiến độ xưởng</button></h2>
   ${tbl(["Phiếu","Sản phẩm","Số lượng","Hạn","Trạng thái","Ghi chú"],reqRows)}
   <p class="hint">Phiếu sản xuất chưa xong có hạn đến hết ngày mai, quá hạn lên đầu.</p></div>
  <div class="card"><h2 class="hn-h"><span>② Đơn cần xuất hôm nay</span><button class="btn" data-go="kho_xuat_b2b">Mở xuất kho đơn</button></h2>
   ${HN.err?`<div class="note red">${esc(HN.err)}</div>`:""}${HN.orders?tbl(["Đơn","Khách","Kênh","Ngày giao","Hàng","Tình trạng"],ordRows):`<p class="hint">Đang tải…</p>`}</div>
  <div class="card"><h2 class="hn-h"><span>③ Ghi sản lượng cuối ngày</span><span><input type="date" id="hn-day" value="${esc(day)}" max="${esc(today)}"> <button class="btn pri" id="hn-save">Lưu sản lượng</button></span></h2>
   <div class="tbl"><table><thead><tr><th>Việc / sản phẩm</th><th class="n">Số người</th><th>Từ giờ</th><th>Đến giờ</th><th class="n">Số cái</th><th>Ghi chú</th><th class="n">Giờ công</th><th class="n">1 giờ công làm được</th><th></th></tr></thead><tbody>${logRows.join("")}</tbody></table></div>
   <p><button class="btn" id="hn-add">+ Thêm dòng</button> <span class="hint" id="hn-msg">${HN.dirty?"Có thay đổi chưa lưu.":""}</span></p>
   <div class="note">Mỗi dòng là một nhóm người làm một việc liên tục; đổi việc thì thêm dòng mới. Giờ chờ hàng, dọn dẹp, sửa máy chọn "Việc khác" để không tính vào sản phẩm.</div></div>
  <div class="card"><h2 class="hn-h"><span>④ Định mức giờ (tự tính từ sổ ghi)</span><small class="hint">dùng được khi một sản phẩm có từ 3 lần ghi</small></h2>
   ${tbl(["Sản phẩm","Số lần ghi","Tổng giờ công","Tổng số cái","1 giờ công làm được"],dmRows)}</div>`;
  /* Nút data-go do bindCommon (app.js) gắn sẵn. Gõ số thì chỉ cập nhật ô Giờ công / 1 giờ công của dòng đó, không vẽ lại cả trang. */
  const recalc=i=>{const r=HN.draft[i],tr=m.querySelector(`[data-hn][data-i="${i}"]`).closest("tr"),c=hnCong(r),k=r.sp===HN_KHAC;
    tr.cells[6].textContent=c?hnR1(c):"—";tr.cells[7].textContent=!k&&c>0&&+r.sl>0?nf(+r.sl/c)+" "+hnUnit(r.sp):"—";$("#hn-msg").textContent="Có thay đổi chưa lưu."};
  m.querySelectorAll("[data-hn]").forEach(el=>{const ev=el.tagName==="SELECT"?"change":"input";el.addEventListener(ev,()=>{const i=+el.dataset.i,r=HN.draft[i];r[el.dataset.hn]=el.value;HN.dirty=true;
    if(el.tagName==="SELECT"){if(el.value===HN_KHAC)r.sl="";renderMain()}else recalc(i)})});
  m.querySelectorAll("[data-hndel]").forEach(b=>b.onclick=()=>{HN.draft.splice(+b.dataset.hndel,1);if(!HN.draft.length)HN.draft.push({sp:"",nguoi:"",tu:"",den:"",sl:"",ghi:""});HN.dirty=true;renderMain()});
  $("#hn-add").onclick=()=>{const last=HN.draft[HN.draft.length-1]||{};HN.draft.push({sp:"",nguoi:last.nguoi||"",tu:last.den||"",den:"",sl:"",ghi:""});HN.dirty=true;renderMain()};
  $("#hn-day").onchange=e=>{if(HN.dirty&&!confirm("Có thay đổi chưa lưu ở ngày đang mở. Bỏ thay đổi và chuyển ngày?")){e.target.value=day;return}HN.day=e.target.value||today;HN.draft=null;HN.dirty=false;renderMain()};
  $("#hn-save").onclick=()=>{
    const rows=HN.draft.filter(r=>r.sp||r.nguoi||r.tu||r.den||r.sl);
    for(const [i,r] of rows.entries()){
      if(!r.sp)return toast("Dòng "+(i+1)+": chưa chọn sản phẩm hoặc Việc khác");
      if(!(+r.nguoi>0))return toast("Dòng "+(i+1)+": chưa ghi số người");
      if(!hnHours(r))return toast("Dòng "+(i+1)+": giờ chưa đúng (ví dụ 7:30 đến 11:30)");
      if(r.sp!==HN_KHAC&&!(+r.sl>=0&&String(r.sl).trim()!==""))return toast("Dòng "+(i+1)+": chưa ghi số cái làm được")}
    const clean=rows.map(r=>({id:r.id||("NK-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)),ngay:day,sp:r.sp,nguoi:+r.nguoi,tu:String(r.tu).trim(),den:String(r.den).trim(),sl:r.sp===HN_KHAC?0:+r.sl,ghi:String(r.ghi||"").trim(),by:r.by||ME.name,at:r.at||sxNow()}));
    sxMut("Ghi sản lượng ngày "+sxDd(day)+" ("+clean.length+" dòng)",d=>{d.nk=(d.nk||[]).filter(r=>r.ngay!==day).concat(clean)});
    HN.draft=null;HN.dirty=false;toast("Đã lưu sản lượng ngày "+sxDd(day));renderMain()};
}
PAGES.sx_hn=sxInit(pSxHn);
{
  const sx=MODULES.find(x=>x.k==="sx");
  if(sx){const g0=sx.groups;sx.groups=function(){const r=g0.apply(this,arguments)||[];if(r.some(g=>g[1].some(i=>i[0]==="sx_hn")))return r;
    const it=MI("sx_hn","Hôm nay xưởng",()=>hnOk());const g=r.find(x=>x[0]==="Sản xuất");if(g)g[1]=[it].concat(g[1]);else r.push(["Sản xuất",[it]]);return r}}
}
