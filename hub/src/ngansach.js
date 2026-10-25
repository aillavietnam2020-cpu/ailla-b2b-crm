/* =====================================================================
   NGÂN SÁCH CHI PHÍ THEO THÁNG (trang quản trị › Chi phí & Tiền).
   Mỗi tháng đặt ngân sách theo NHÓM chi phí × PHÒNG BAN. "Đã chi" lấy từ Sổ chi phí (nhập tay, phiếu chi nhà cung cấp, vận chuyển, quảng cáo tự cộng).
   Hiện đủ ô: ngân sách, đã chi, còn lại. Quá 85% ngân sách báo vàng, quá 100% báo đỏ.
   Lưu ở ngăn tài chính riêng (chỉ CEO và kế toán đọc được): D().fin.budgets["yyyy-mm"]["nhóm||phòng ban"] = số tiền. Chị Hoa, Thảo, Huệ sửa thẳng.
   ===================================================================== */
const NS={edit:false};
const nsYm=()=>{const a=PERIOD.from.slice(0,7),b=PERIOD.to.slice(0,7);return a===b?a:""};
const nsKey=(nh,pb)=>nh+"||"+pb;
function nsActual(){const A={};try{spRows().forEach(x=>{const k=nsKey(x.nhom||"Khác",x.pb||"");A[k]=(A[k]||0)+x.tien})}catch(e){}return A}
function pNganSach(m){
  mhLoad();mhLoadPay();spLoadShip();
  const T="Ngân sách chi phí",S="Mỗi tháng đặt mức chi cho từng nhóm chi phí và phòng ban, theo dõi đã chi bao nhiêu";
  const ym=nsYm();
  if(!ym){m.innerHTML=H(T,S)+`<div class="note">Ngân sách đặt theo từng tháng. Chị chọn <b>một tháng</b> ở ô thời gian phía trên (ví dụ “Tháng này”) để xem và đặt ngân sách.</div>`;return}
  if(!MH.pay){m.innerHTML=H(T,S)+`<p class="hint pad">Đang tải…</p>`;return}
  const d=D(),ed=mhManage()||can(ME,"chiphi.nhap"),B=((d.fin||{}).budgets||{})[ym]||{},A=nsActual();
  const nhoms=[...new Set([...(d.costCats||[]).map(c=>c.nhom),...Object.keys(A).map(k=>k.split("||")[0]),...Object.keys(B).map(k=>k.split("||")[0])])].filter(Boolean);
  const pbSet=[...new Set([...(d.departments||[]).map(p=>p.n),...Object.keys(A).map(k=>k.split("||")[1]),...Object.keys(B).map(k=>k.split("||")[1])])];
  const pbs=pbSet.filter(p=>p!==""),hasBlank=pbSet.includes("");if(hasBlank)pbs.push("");
  const lbl=p=>p||"Chưa gắn phòng ban";
  const cell=(nh,pb)=>{const k=nsKey(nh,pb),b=+B[k]||0,a=A[k]||0;
    if(NS.edit)return `<td class="n"><input class="nsin" type="number" min="0" step="1000" data-nk="${esc(k)}" value="${b||""}" placeholder="0"><div class="hint">đã chi ${nf(Math.round(a))}</div></td>`;
    if(!b&&!a)return `<td class="n nsz">—</td>`;
    const r=b?a/b:null,cl=r==null?"":r>1?"nsr":r>.85?"nsa":"nsg";
    return `<td class="n ${cl}"><b>${nf(Math.round(a))}</b>${b?`<div class="hint">/ ${nf(b)} · ${Math.round(r*100)}%</div>`:`<div class="hint">chưa đặt ngân sách</div>`}</td>`};
  const rowSum=nh=>{let b=0,a=0;pbs.forEach(p=>{b+=+B[nsKey(nh,p)]||0;a+=A[nsKey(nh,p)]||0});return [b,a]};
  const tot=nhoms.reduce((t,nh)=>{const [b,a]=rowSum(nh);return [t[0]+b,t[1]+a]},[0,0]);
  const sumCell=(b,a)=>{if(!b&&!a)return `<td class="n nsz">—</td>`;const r=b?a/b:null,cl=r==null?"":r>1?"nsr":r>.85?"nsa":"nsg";return `<td class="n ${cl}"><b>${nf(Math.round(a))}</b>${b?`<div class="hint">/ ${nf(b)} · ${Math.round(r*100)}%</div>`:""}</td>`};
  const over=nhoms.filter(nh=>{const [b,a]=rowSum(nh);return b&&a>b});
  m.innerHTML=H(T,S)+`<div class="grid kpis">${kpi("Ngân sách tháng "+ym.slice(5)+"/"+ym.slice(0,4),nf(tot[0]),tot[0]?"đã đặt cho "+nhoms.filter(nh=>rowSum(nh)[0]).length+" nhóm":"chưa đặt")}${kpi("Đã chi",nf(Math.round(tot[1])),"từ Sổ chi phí, gồm quảng cáo tự cộng")}${kpi("Còn lại",tot[0]?nf(Math.round(tot[0]-tot[1])):"—",tot[0]?Math.round(tot[1]/tot[0]*100)+"% ngân sách đã dùng":"")}${kpi("Nhóm vượt ngân sách",String(over.length),over.length?over.map(esc).join(", "):"không có nhóm nào vượt")}</div>
  ${nhoms.some(nh=>rowSum(nh)[0])?`<section class="card pad"><b>Mức dùng ngân sách theo nhóm</b>${qtBars(nhoms.filter(nh=>rowSum(nh)[0]).map(nh=>{const [b,a]=rowSum(nh),r=a/b;return {l:nh,v:a,p:Math.round(r*100),t:nf(Math.round(a))+" / "+nf(b)+" · "+Math.round(r*100)+"%",c:r>1?"r":r>.85?"y":"g",s:r>1?"vượt "+nf(Math.round(a-b)):"còn "+nf(Math.round(b-a))}}),{max:0})}</section>`:""}
  <div class="card pad"><div class="tlh"><b>Theo nhóm chi phí và phòng ban</b>${ed?(NS.edit?`<span><button class="btn sm" id="ns-cancel">Hủy</button> <button class="btn pri sm" id="ns-save">Lưu ngân sách</button></span>`:`<span><button class="btn sm" id="ns-copy">Chép từ tháng trước</button> <button class="btn pri sm" id="ns-edit">Đặt ngân sách</button></span>`):""}</div>
  <div class="nsw"><table class="tbl"><thead><tr><th>Nhóm chi phí</th>${pbs.map(p=>`<th class="n">${esc(lbl(p))}</th>`).join("")}<th class="n">Cộng nhóm</th></tr></thead><tbody>${nhoms.map(nh=>{const [b,a]=rowSum(nh);return `<tr><td><b>${esc(nh)}</b></td>${pbs.map(p=>cell(nh,p)).join("")}${sumCell(b,a)}</tr>`}).join("")}<tr class="nstot"><td><b>Tổng</b></td>${pbs.map(p=>{let b=0,a=0;nhoms.forEach(nh=>{b+=+B[nsKey(nh,p)]||0;a+=A[nsKey(nh,p)]||0});return sumCell(b,a)}).join("")}${sumCell(tot[0],tot[1])}</tr></tbody></table></div>
  <p class="hint">Ô xanh: dưới 85% ngân sách · vàng: từ 85% · đỏ: vượt ngân sách. Ô chưa đặt ngân sách chỉ hiện số đã chi.</p></div>`;
  const on=(id,f)=>{const b=m.querySelector(id);if(b)b.onclick=f};
  on("#ns-edit",()=>{NS.edit=true;renderMain()});on("#ns-cancel",()=>{NS.edit=false;renderMain()});
  on("#ns-save",()=>{const v={};m.querySelectorAll("[data-nk]").forEach(i=>{const n=Math.round(+i.value||0);if(n>0)v[i.dataset.nk]=n});
    DB.mutate(ME.name,"đặt ngân sách chi phí "+ym,dt=>{dt.fin=dt.fin||{};dt.fin.budgets=dt.fin.budgets||{};dt.fin.budgets[ym]=v});NS.edit=false;toast("Đã lưu ngân sách");renderMain()});
  on("#ns-copy",()=>{const a=new Date(ym+"-01T00:00:00");a.setMonth(a.getMonth()-1);const pm=a.getFullYear()+"-"+String(a.getMonth()+1).padStart(2,"0"),src=((D().fin||{}).budgets||{})[pm];
    if(!src||!Object.keys(src).length){toast("Tháng "+pm.slice(5)+"/"+pm.slice(0,4)+" chưa đặt ngân sách");return}
    if(Object.keys(B).length&&!confirm("Tháng này đã có ngân sách. Chép từ tháng trước sẽ thay thế. Tiếp tục?"))return;
    DB.mutate(ME.name,"chép ngân sách từ "+pm,dt=>{dt.fin=dt.fin||{};dt.fin.budgets=dt.fin.budgets||{};dt.fin.budgets[ym]={...(dt.fin.budgets[pm]||{})}});toast("Đã chép ngân sách từ tháng trước");renderMain()});
}
PAGES.ngan_sach=pNganSach;
