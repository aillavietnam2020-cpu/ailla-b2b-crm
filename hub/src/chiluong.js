/* =====================================================================
   CHI LƯƠNG BẰNG QR (chị Hoa duyệt demo 06/11/2026): Nhân sự › Lương › Chi lương bằng QR.
   - Lấy bảng lương đã chốt / đã phát hành của kỳ (HRD().payroll[kỳ].rows, số Thực lĩnh), số tài khoản + ngân hàng ở hồ sơ (HRD().ns[mã].hs.stk / .nh).
   - Mỗi người một mã VietQR (chuẩn NAPAS): app ngân hàng nào cũng quét được, tự điền số tài khoản, số tiền, nội dung.
   - Bấm "Đã chi · Tiếp" thì ghi HRD().payroll[kỳ].chi.list[mã] = {st:"da", at, by, tien}; "Bỏ qua" = {st:"bo"} để chi sau.
     Chi từ tài khoản nào lưu ở .chi.acct (tài khoản nhận tiền của công ty ở Mua hàng / Dòng tiền).
   - Ăn theo: Dòng tiền (chứng từ "Chi lương", dòng Lương, bảo hiểm; dự báo trừ phần đã chi), Phiếu lương của tôi ("Đã nhận lương").
     Không ghi vào Sổ chi phí: chi phí lương đã vào sổ từ bảng lương chốt (nhóm G07), ghi thêm là tính hai lần.
   - Người chi: CEO, người quản lý lương, Kế toán. Chữ trên màn hình theo vai trò, không xưng chị/em.
   ===================================================================== */
const CL={i:0,q:null,acct:""};
/* Ngân hàng: tên trong hồ sơ (gõ tự do) → mã ngân hàng NAPAS (BIN) để tạo mã VietQR. */
const CL_BANK=[["Vietcombank","970436",/vietcombank|\bvcb\b|ngoai thuong/],["VietinBank","970415",/vietin|\bctg\b|cong thuong/],["BIDV","970418",/\bbidv\b|dau tu va phat trien/],
 ["Agribank","970405",/agribank|nong nghiep/],["Techcombank","970407",/techcombank|\btcb\b|ky thuong/],["MB Bank","970422",/\bmb\b|mbbank|mb bank|quan doi/],["ACB","970416",/\bacb\b|a chau/],
 ["VPBank","970432",/vpbank|vp bank|thinh vuong/],["TPBank","970423",/tpbank|tp bank|tien phong/],["Sacombank","970403",/sacombank|\bstb\b|sai gon thuong tin/],["HDBank","970437",/hdbank|hd bank|phat trien tp/],
 ["VIB","970441",/\bvib\b|ngan hang quoc te/],["SHB","970443",/\bshb\b|sai gon ha noi|sai gon - ha noi/],["SeABank","970440",/seabank|dong nam a/],["OCB","970448",/\bocb\b|phuong dong/],
 ["MSB","970426",/\bmsb\b|maritime|hang hai/],["Eximbank","970431",/exim/],["LPBank","970449",/lpbank|lienviet|lien viet|loc phat/],["Nam A Bank","970428",/nam ?a ?bank|ngan hang nam a/],
 ["SCB","970429",/\bscb\b/],["VietABank","970427",/viet ?a ?bank|viet a\b/],["Bac A Bank","970409",/bac ?a/],["ABBANK","970425",/abbank|an binh/],["PVcomBank","970412",/pvcom/],
 ["Kienlongbank","970452",/kienlong|kien long/],["BVBank (Timo)","970454",/timo|bvbank|ban viet/],["Cake by VPBank","546034",/\bcake\b/],["Ubank","546035",/\bubank\b/],["NCB","970419",/\bncb\b|quoc dan/],
 ["Shinhan Bank","970424",/shinhan/],["Woori Bank","970457",/woori/],["Saigonbank","970400",/saigonbank/],["GPBank","970408",/gpbank|dau khi toan cau/],["BaoViet Bank","970438",/baoviet|bao viet/],
 ["PGBank","970430",/pgbank|xang dau/],["OceanBank","970414",/ocean/],["CIMB","422589",/cimb/]];
const clBo=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D");
const clBank=nh=>{const t=clBo(nh).toLowerCase().trim();if(!t)return null;const b=CL_BANK.find(x=>x[2].test(t));return b?{ten:b[0],bin:b[1]}:null};
/* Mã VietQR (EMVCo): 00 phiên bản, 01 "12" mã có số tiền, 38 người nhận (A000000727 + BIN + số TK + QRIBFTTA), 53 VND, 54 số tiền, 58 VN, 62 nội dung, 63 CRC16. */
const clF=(id,v)=>id+String(v.length).padStart(2,"0")+v;
function clCrc(s){let c=0xFFFF;for(let i=0;i<s.length;i++){c^=s.charCodeAt(i)<<8;for(let j=0;j<8;j++)c=c&0x8000?((c<<1)^0x1021)&0xFFFF:(c<<1)&0xFFFF}return c.toString(16).toUpperCase().padStart(4,"0")}
function clVietQr(bin,stk,tien,nd){const acc=clF("00","A000000727")+clF("01",clF("00",bin)+clF("01",stk))+clF("02","QRIBFTTA");
  const s=clF("00","01")+clF("01","12")+clF("38",acc)+clF("53","704")+clF("54",String(Math.round(tien)))+clF("58","VN")+clF("62",clF("08",nd))+"6304";return s+clCrc(s)}
const clNd=(ky,ten)=>("Luong "+ky.slice(5)+" "+ky.slice(0,4)+" "+clBo(ten)).replace(/[^A-Za-z0-9 ]/g,"").slice(0,50);
const clStk=s=>String(s||"").replace(/[\s.\-]/g,"");
const clCan=()=>typeof ME!=="undefined"&&ME&&(canLuong()||(typeof npKetoan==="function"&&npKetoan()));
/* Danh sách người nhận của kỳ: số thực lĩnh từ bản chốt, ngân hàng, trạng thái chi. */
function clRows(ky){const P=payPeriod(ky),chi=(P.chi||{}).list||{};
  return (P.rows||[]).map(r=>{const hs=(HRD().ns[r.ma]||{}).hs||{},stk=clStk(hs.stk),b=clBank(hs.nh),c=chi[r.ma]||null,tien=Math.round(+r.thucLinh||0);
    return {ma:r.ma,ten:r.ten,pb:r.pb,tien,stk,nh:hs.nh||"",bank:b,st:c?c.st:"",at:c&&c.at||"",by:c&&c.by||"",ok:!!(stk&&b&&tien>0)}})}
function clSave(ky,why,f){DB.mutate(ME.name,why,dt=>{const p=dt.hr.payroll[ky];if(!p)return;p.chi=p.chi||{list:{}};p.chi.list=p.chi.list||{};f(p.chi,dt)})}

function pClQr(m){
  if(!clCan()){m.innerHTML=H("Chi lương bằng QR")+`<section class="card"><p class="empty">Chỉ CEO, người quản lý lương và Kế toán dùng trang này.</p></section>`;return}
  if(!HRD().loaded){m.innerHTML=H("Chi lương bằng QR")+hrEmpty();return}
  HRM=hrmFromPeriod();const ky=HRM,P=payPeriod(ky),kyT=`${ky.slice(5)}/${ky.slice(0,4)}`;
  if(P.st==="nhap"){m.innerHTML=H("Chi lương bằng QR","Kỳ "+kyT)+`<section class="card"><p class="empty">Bảng lương tháng ${kyT} chưa chốt. Chốt ở Nhân sự › Bảng lương trước khi chi lương. Đổi tháng ở ô chọn thời gian trên cùng.</p></section>`;return}
  if(typeof mhAccts==="function"&&typeof MH!=="undefined"&&!MH.accts)mhAccts().then(()=>{if(PAGE==="cl_qr")renderMain()});
  const R=clRows(ky),tong=R.reduce((t,x)=>t+Math.max(0,x.tien),0),da=R.filter(x=>x.st==="da"),daT=da.reduce((t,x)=>t+x.tien,0);
  const thieu=R.filter(x=>!x.stk),saiNh=R.filter(x=>x.stk&&!x.bank),con=R.filter(x=>x.ok&&x.st!=="da");
  const accts=(typeof MH!=="undefined"&&MH.accts)||[],acct=(P.chi||{}).acct||CL.acct||"";
  const st=x=>x.st==="da"?pill("Đã chi","grn")+`<div class="hint">${esc(x.at)}${x.by?" · "+esc(x.by):""}</div>`:x.tien<=0?pill("Không có tiền phải chi","gry"):!x.stk?pill("Chưa có số tài khoản","red"):!x.bank?pill("Chưa nhận ra ngân hàng","amb"):x.st==="bo"?pill("Bỏ qua, chi sau","amb"):pill("Chưa chi","gry");
  const bankCell=x=>!x.stk?`<span class="hint">HCNS bổ sung ở hồ sơ nhân viên</span>`:x.bank?`${esc(x.bank.ten)} · <span class="mono">${esc(x.stk)}</span>`
    :`<select data-clnh="${esc(x.ma)}"><option value="">Chọn ngân hàng${x.nh?` (hồ sơ ghi "${esc(x.nh)}")`:""}</option>${CL_BANK.map(b=>`<option value="${esc(b[0])}">${esc(b[0])}</option>`).join("")}</select> <span class="mono">${esc(x.stk)}</span>`;
  m.innerHTML=H("Chi lương bằng QR",`Kỳ ${kyT} · ${P.st==="phathanh"?"đã phát hành phiếu lương":"đã chốt"}`)+`
  <div class="grid kpis">${kpi("Tổng thực lĩnh",money(tong))}${kpi("Đã chi",money(daT),`${da.length}/${R.length} người`)}${kpi("Còn phải chi",money(tong-daT),"",tong-daT>0?"var(--orange)":"")}${kpi("Chưa có số tài khoản",thieu.length+" người","",thieu.length?"var(--red)":"")}</div>
  <section class="card"><div class="cl-top"><label class="field">Chi từ tài khoản công ty${accts.length?`<select id="cl-acct"><option value="">Chọn tài khoản</option>${accts.map(a=>`<option value="${esc(a.id)}"${String(a.id)===String(acct)?" selected":""}>${esc(mhAcctLabel(a))}</option>`).join("")}</select>`:`<input id="cl-acct" value="${esc(acct)}" placeholder="Ví dụ: Vietcombank 0071…">`}</label>
    <button class="btn pri" id="cl-go"${con.length?"":" disabled"}>${da.length?"Chi tiếp bằng QR":"Chi lương bằng QR"} (${con.length} người)</button></div>
    <p class="hint">Quét mã bằng app ngân hàng của công ty (app nào cũng được). App hiện tên chủ tài khoản thật: so với tên nhân viên trước khi chuyển. Tài khoản doanh nghiệp cần người duyệt lệnh thì bấm "Đã chi" sau khi lệnh đã duyệt xong.</p></section>
  ${saiNh.length?`<div class="note">${saiNh.length} người có số tài khoản nhưng tên ngân hàng trong hồ sơ chưa nhận ra được. Chọn ngân hàng ở cột bên dưới, web lưu luôn vào hồ sơ.</div>`:""}
  <section class="card flush nomlist"><div class="tbl"><table><thead><tr><th>Nhân viên</th><th>Ngân hàng · số tài khoản</th><th class="n">Thực lĩnh</th><th>Trạng thái</th><th></th></tr></thead><tbody>
  ${R.map(x=>`<tr><td><b>${esc(x.ten)}</b><div class="hint">${esc(x.ma)} · ${esc(pbName(x.pb))}</div></td><td>${bankCell(x)}</td><td class="n"><b>${nf(x.tien)}</b></td><td>${st(x)}</td><td>${x.st==="da"&&canLuong()?`<button class="btn sm" data-clhuy="${esc(x.ma)}">Bỏ đánh dấu</button>`:x.ok&&x.st!=="da"?`<button class="btn sm" data-clone="${esc(x.ma)}">Mã QR</button>`:""}</td></tr>`).join("")}</tbody></table></div></section>
  <p class="hint">Số tiền là Thực lĩnh trong bảng lương đã chốt. Đã chi tự vào Dòng tiền (dòng Lương, bảo hiểm) và nhân viên thấy "Đã nhận lương" ở Phiếu lương của mình. Chi phí lương đã vào Sổ chi phí từ bảng lương chốt nên không ghi thêm ở đó.</p>`;
  const acEl=$("#cl-acct");if(acEl)acEl.onchange=()=>{CL.acct=acEl.value;clSave(ky,"chọn tài khoản chi lương "+ky,c=>{c.acct=acEl.value})};
  const need=f=>()=>{const v=(($("#cl-acct")||{}).value||"").trim();if(!v){toast("Chọn tài khoản công ty dùng để chi lương trước");$("#cl-acct").focus();return}CL.acct=v;f()};
  $("#cl-go").onclick=need(()=>clOpen(ky,con.map(x=>x.ma)));
  m.querySelectorAll("[data-clone]").forEach(b=>b.onclick=need(()=>clOpen(ky,[b.dataset.clone])));
  m.querySelectorAll("[data-clhuy]").forEach(b=>b.onclick=()=>{const x=R.find(r=>r.ma===b.dataset.clhuy);if(!confirm(`Bỏ đánh dấu đã chi lương cho ${x?x.ten:""}? Chỉ làm khi bấm nhầm, tiền chưa chuyển.`))return;clSave(ky,"bỏ đánh dấu chi lương "+b.dataset.clhuy,c=>{delete c.list[b.dataset.clhuy]});renderMain()});
  m.querySelectorAll("[data-clnh]").forEach(s=>s.onchange=()=>{if(!s.value)return;const ma=s.dataset.clnh;DB.mutate(ME.name,"sửa ngân hàng hồ sơ "+ma,dt=>{const n=dt.hr.ns[ma]=dt.hr.ns[ma]||{};n.hs=n.hs||{};n.hs.nh=s.value});toast("Đã lưu ngân hàng vào hồ sơ");renderMain()});
}

/* Khung chi từng người (giống app ngân hàng): mã QR, số tiền, số tài khoản, nội dung; Bỏ qua / Đã chi · Tiếp. */
function clOpen(ky,mas){CL.q={ky,mas,i:0,n:mas.length,da:0,bo:0};clShow()}
function clClose(){const o=document.getElementById("cl-ov");if(o)o.remove();CL.q=null;if(PAGE==="cl_qr")renderMain()}
function clShow(){
  const Q=CL.q;if(!Q)return;let o=document.getElementById("cl-ov");
  if(!o){o=document.createElement("div");o.id="cl-ov";o.className="cl-ov";document.body.appendChild(o);o.addEventListener("click",e=>{if(e.target===o)clClose()})}
  const R=clRows(Q.ky),pct=Math.round(Q.i/Math.max(1,Q.n)*100);
  if(Q.i>=Q.n){o.innerHTML=`<div class="cl-ph" role="dialog" aria-modal="true"><div class="cl-hd"><span></span><b>Xong lượt chi</b><span></span></div><div class="cl-prog"><i style="width:100%"></i></div>
    <div class="cl-done"><b>Đã chi ${Q.da} người${Q.bo?`, bỏ qua ${Q.bo}`:""}</b><p class="hint">${Q.bo?"Người bỏ qua vẫn nằm trong danh sách để chi sau. ":""}Các khoản đã chi đã vào Dòng tiền và phiếu lương của từng người.</p><button class="btn pri" id="cl-end">Về danh sách</button></div></div>`;
    document.getElementById("cl-end").onclick=clClose;return}
  const x=R.find(r=>r.ma===Q.mas[Q.i]);if(!x||!x.ok||x.st==="da"){Q.i++;return clShow()}
  const nd=clNd(Q.ky,x.ten),txt=clVietQr(x.bank.bin,x.stk,x.tien,nd);
  let svg="";try{const q=qrcode(0,"M");q.addData(txt);q.make();svg=q.createSvgTag({cellSize:Math.max(3,Math.floor(232/(q.getModuleCount()+2))),margin:2,scalable:true})}catch(e){svg=`<p class="hint">Không tạo được mã QR. Chuyển tay theo số tài khoản bên dưới.</p>`}
  o.innerHTML=`<div class="cl-ph" role="dialog" aria-modal="true" aria-label="Chi lương ${esc(x.ten)}">
   <div class="cl-hd"><button class="btn sm" id="cl-x">Đóng</button><b>Chi lương ${Q.i+1}/${Q.n}</b><span></span></div>
   <div class="cl-prog"><i style="width:${pct}%"></i></div>
   <div class="cl-who"><span class="cl-av">${esc((w=>(w.length>1?w[0][0]+w[w.length-1][0]:(w[0]||"?")[0]).toUpperCase())(x.ten.split(" ").filter(Boolean)))}</span><div><b>${esc(x.ten)}</b><div class="hint">${esc(pbName(x.pb))} · tháng ${Q.ky.slice(5)}/${Q.ky.slice(0,4)}</div></div></div>
   <div class="cl-qr">${svg}</div><div class="cl-amt">${nf(x.tien)}đ</div>
   <div class="cl-info"><div class="cl-row"><div><small>${esc(x.bank.ten)}</small><span class="mono">${esc(x.stk)}</span></div><button class="cl-cp" data-c="${esc(x.stk)}">Chép</button></div>
    <div class="cl-row"><div><small>Tên nhân viên (so với chủ tài khoản app hiện)</small>${esc(clBo(x.ten).toUpperCase())}</div><span></span></div>
    <div class="cl-row"><div><small>Nội dung</small>${esc(nd)}</div><button class="cl-cp" data-c="${esc(nd)}">Chép</button></div></div>
   <div class="cl-acts"><button class="btn" id="cl-skip">Bỏ qua</button><button class="btn pri" id="cl-ok">Đã chi · Tiếp</button></div>
   <p class="hint" style="text-align:center;margin:0">Chuyển xong (lệnh đã duyệt) mới bấm Đã chi.</p></div>`;
  o.querySelectorAll(".cl-cp").forEach(b=>b.onclick=()=>{const t=b.textContent;try{navigator.clipboard.writeText(b.dataset.c).then(()=>{b.textContent="Đã chép";setTimeout(()=>b.textContent=t,1200)}).catch(()=>toast(b.dataset.c))}catch(e){toast(b.dataset.c)}});
  document.getElementById("cl-x").onclick=clClose;
  const mark=s=>{const now=new Date(Date.now()+7*36e5).toISOString().slice(0,16).replace("T"," ");const acct=(document.getElementById("cl-acct")||{}).value||CL.acct||"";
    clSave(Q.ky,(s==="da"?"chi lương ":"bỏ qua chi lương ")+x.ma+" "+Q.ky,c=>{if(acct&&!c.acct)c.acct=acct;c.list[x.ma]=s==="da"?{st:"da",at:now,by:ME.name,tien:x.tien,acct:acct||c.acct||""}:{st:"bo",at:now,by:ME.name}});
    if(s==="da")Q.da++;else Q.bo++;Q.i++;clShow()};
  document.getElementById("cl-ok").onclick=()=>mark("da");
  document.getElementById("cl-skip").onclick=()=>mark("bo");
}
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&CL.q)clClose()});
if(typeof document!=="undefined"&&!document.getElementById("cl-css")){const st=document.createElement("style");st.id="cl-css";st.textContent=`
.cl-top{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}.cl-top .field{flex:1;min-width:220px}.cl-top .btn{min-height:44px}
.cl-ov{position:fixed;inset:0;background:rgba(10,20,40,.55);display:grid;place-items:center;padding:16px;z-index:200}
.cl-ph{width:min(400px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--bg,#f5f6fb);border-radius:26px;padding:16px;display:grid;gap:12px;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.cl-hd{display:grid;grid-template-columns:72px 1fr 72px;align-items:center}.cl-hd b{text-align:center}
.cl-prog{height:6px;border-radius:9px;background:var(--line);overflow:hidden}.cl-prog i{display:block;height:100%;background:var(--green,#1f8a55)}
.cl-who{display:flex;gap:10px;align-items:center}.cl-av{width:38px;height:38px;border-radius:10px;background:var(--green,#1f8a55);color:#fff;display:grid;place-items:center;font-weight:700;font-size:13px}
.cl-qr{background:#fff;border-radius:18px;padding:12px;justify-self:center;width:232px;height:232px;box-shadow:0 2px 12px rgba(0,0,0,.08)}.cl-qr svg{width:100%;height:100%;display:block}
.cl-amt{text-align:center;font-size:24px;font-weight:700;font-variant-numeric:tabular-nums}
.cl-info{background:var(--surface,#fff);border-radius:14px;padding:2px 14px}
.cl-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line)}.cl-row:last-child{border-bottom:0}.cl-row small{display:block;color:var(--muted);font-size:12px}
.cl-cp{border:0;background:none;color:var(--blue,#4b54d1);font:inherit;font-weight:600;font-size:13px;cursor:pointer;padding:6px}
.cl-acts{display:grid;grid-template-columns:1fr 2fr;gap:10px}.cl-acts .btn{min-height:48px;justify-content:center}
.cl-done{text-align:center;display:grid;gap:8px;padding:8px 0}`;document.head.appendChild(st)}

PAGES.cl_qr=pClQr;
/* Menu: Nhân sự › Lương › Chi lương bằng QR (sau Bảng lương). Nút trên Bảng lương khi kỳ đã chốt. */
{const hr=MODULES.find(x=>x.k==="hr");if(hr){const g0=hr.groups;hr.groups=()=>g0().map(([g,its])=>{const i=its.findIndex(t=>t[0]==="hr_bl");if(i<0||its.some(t=>t[0]==="cl_qr"))return [g,its];const c=its.slice();c.splice(i+1,0,MI("cl_qr","Chi lương bằng QR",()=>clCan()));return [g,c]})}}
{const o=PAGES.hr_bl;if(o)PAGES.hr_bl=m=>{o(m);try{const P=payPeriod(HRM);if(P.st==="nhap"||!clCan())return;const f=m.querySelector(".filters");if(!f||f.querySelector("#bl-cl"))return;
  const b=document.createElement("button");b.className="btn";b.id="bl-cl";const da=Object.values((P.chi||{}).list||{}).filter(x=>x.st==="da").length;b.textContent=da?`Chi lương QR (${da}/${(P.rows||[]).length} đã chi)`:"Chi lương bằng QR";b.onclick=()=>{PAGE="cl_qr";render();scrollTo(0,0)};f.insertBefore(b,f.querySelector("#bl-xl"))}catch(e){}}}
