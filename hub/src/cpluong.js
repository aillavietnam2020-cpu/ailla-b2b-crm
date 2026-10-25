/* =====================================================================
   LƯƠNG THEO PHÒNG BAN VÀ KÊNH: lấy từ Bảng lương (Nhân sự), chia cho kênh, đổ vào bảng "Kênh nào gánh bao nhiêu chi phí".
   - Nguồn: kỳ lương đã chốt (hoặc phát hành) thì lấy số đã chốt; chưa chốt thì tính tạm từ bảng lương nháp. Số = Tổng thu nhập
     (lương theo công, phụ cấp, KPI/thưởng, OT), chưa gồm bảo hiểm công ty đóng (bảo hiểm ghi ở sổ chi phí).
   - Cách chia mỗi người: D().cpLuongChia[mã NS], nếu chưa đặt thì mặc định của phòng ban D().cpLuongPhong[mã phòng].
       {gv:1}           vào giá thành (sản xuất), không tính vào chi phí kênh
       {k:{kênh:%…}}   chia % cho kênh, phần còn lại thành chi chung công ty
       trống            chi chung công ty (chia cho kênh theo quy tắc ở Sổ chi phí)
   - Bật "Tính lương từ bảng lương" thì dòng Lương nhập tay trong sổ không cộng vào bảng kênh nữa (tránh tính hai lần).
   - Chỉ người có quyền làm lương (hoặc CEO) thấy trang này.
   ===================================================================== */
const cpLgCan=()=>!!ME&&(ME.role==="admin"||can(ME,"luong.quanly"));
const cpLgYm=()=>{const f=PERIOD.from.slice(0,7);return PERIOD.to.slice(0,7)===f?f:""};
/* Lương từng người của một tháng: {ok, st, rows:[{ma,ten,pb,tong}]} */
function cpLgRows(ym){
  if(typeof HRD!=="function"||!HRD()||!HRD().loaded)return {ok:false,why:"Chưa nạp dữ liệu nhân sự (file HR MASTER) nên chưa có bảng lương."};
  const h=HRD(),P=(h.payroll||{})[ym];
  if(P&&P.rows&&P.rows.length)return {ok:true,st:P.st==="phathanh"?"Đã phát hành":"Đã chốt",chot:true,rows:P.rows.map(r=>({ma:r.ma,ten:r.ten,pb:r.pb,tong:+r.tong||0}))};
  try{const rows=D().staff.filter(x=>x.tt!=="Đã nghỉ"&&h.ns[x.ma]).map(x=>{const r=calcRow(x.ma,ym);return {ma:r.ma,ten:r.ten,pb:r.pb,tong:+r.tong||0}});
    return rows.length?{ok:true,st:"Nháp, tạm tính",chot:false,rows}:{ok:false,why:"Chưa có người nào trong bảng lương."}}catch(e){return {ok:false,why:"Chưa tính được bảng lương: "+(e.message||"")}}
}
const cpLgPlan=(ma,pb)=>{const d=D();return (d.cpLuongChia||{})[ma]||(d.cpLuongPhong||{})[pb]||(pb==="SX"?{gv:1}:{})};
function cpLgTxt(p,kenhs){if(p.gv)return "Vào giá thành";const e=Object.entries(p.k||{}).filter(x=>x[1]>0);if(!e.length)return "Chi chung công ty";return e.length===1&&e[0][1]>=100?"100% "+e[0][0]:e.map(x=>x[1]+"% "+x[0]).join(" · ")}
/* Tổng hợp: lương theo kênh, chi chung, giá thành. */
function cpLuongAuto(){
  const ym=cpLgYm(),d=D();if(!ym||!cpLgCan()||d.cpLuongAuto===false)return null;
  const S=cpLgRows(ym);if(!S.ok)return null;
  const perKenh={},perPb={};let chung=0,gv=0,tong=0;
  S.rows.forEach(r=>{const p=cpLgPlan(r.ma,r.pb);tong+=r.tong;perPb[r.pb]=(perPb[r.pb]||0)+r.tong;
    if(p.gv){gv+=r.tong;return}let used=0;
    Object.entries(p.k||{}).forEach(([k,pc])=>{const v=r.tong*(+pc||0)/100;if(v>0){perKenh[k]=(perKenh[k]||0)+v;used+=+pc||0}});
    chung+=r.tong*Math.max(0,100-used)/100});
  return {on:true,ym,st:S.st,chot:S.chot,tong,perKenh,chung,gv,perPb,n:S.rows.length};
}
/* ---------- Trang Lương theo phòng ban và kênh ---------- */
const CPLG={};
function pCpLuong(m){
  const d=D(),ym=cpLgYm(),kenhs=CP_KENH();
  if(!cpLgCan()){m.innerHTML=H("Lương theo phòng ban và kênh")+`<p class="empty pad">Trang này dành cho người làm lương và chị Hoa.</p>`;return}
  if(!ym){m.innerHTML=H("Lương theo phòng ban và kênh")+`<div class="note">Chọn <b>một tháng</b> ở ô thời gian phía trên (ví dụ "Tháng này" hoặc "Tháng trước") để xem lương của tháng đó.</div>`;return}
  const S=cpLgRows(ym);
  if(!S.ok){m.innerHTML=H("Lương theo phòng ban và kênh","Kỳ "+ym.slice(5)+"/"+ym.slice(0,4))+`<div class="note amb">${esc(S.why)}</div><div class="acts"><button class="btn pri" data-go="hr_nap">Nạp file HR MASTER</button></div>`;return}
  const A=cpLuongAuto()||(()=>{const ed=d.cpLuongAuto;d.cpLuongAuto=true;const r=cpLuongAuto();d.cpLuongAuto=ed;return r})(),on=d.cpLuongAuto!==false;
  const ed=cpLgCan(),pbs=[...new Set(S.rows.map(r=>r.pb))],pbN=k=>(d.departments.find(p=>p.k===k)||{n:k||"—"}).n;
  const presets=[["","Chi chung công ty (chia theo doanh thu)"],["gv","Vào giá thành (sản xuất)"]].concat(kenhs.map(k=>["k:"+k,"100% "+k]),[["split","Chia % cho nhiều kênh…"]]);
  const cur=p=>p.gv?"gv":(()=>{const e=Object.entries(p.k||{}).filter(x=>x[1]>0);return !e.length?"":e.length===1&&e[0][1]>=100?"k:"+e[0][0]:"split"})();
  const perK=A.perKenh;
  m.innerHTML=H("Lương theo phòng ban và kênh","Kỳ "+ym.slice(5)+"/"+ym.slice(0,4)+" · bảng lương "+S.st.toLowerCase())+
  `<div class="filters"><label class="chk"><input type="checkbox" id="lg-auto"${on?" checked":""}${ed?"":" disabled"}> Tính lương từ bảng lương vào bảng "Kênh nào gánh bao nhiêu chi phí"</label><span class="sp"></span><button class="btn" data-go="hr_bl">Mở Bảng lương</button></div>
  ${ed&&!Object.keys(d.cpLuongChia||{}).length&&!Object.keys(d.cpLuongPhong||{}).length?`<div class="note amb" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span>Chưa đặt cách chia nào. Gợi ý theo ảnh chị Huệ: Khanh → TikTok · Nguyệt → Shopee · Ads/Digital và Sale B2C → Facebook · Content & Media → 47% TikTok, 47% Facebook, 6% Shopee · Sản xuất → vào giá thành. Kho, quản lý, Kế toán, HCNS để chi chung.</span><button class="btn pri" id="lg-goiy">Áp gợi ý này</button></div>`:""}
  ${S.chot?"":`<div class="note amb">Bảng lương tháng này chưa chốt, số đang tạm tính (có thể đổi khi chốt công, KPI, thưởng).</div>`}
  <div class="grid kpis">${kpi("Tổng thu nhập",nf(Math.round(A.tong)),A.n+" người")}${kpi("Vào chi phí các kênh",nf(Math.round(Object.values(perK).reduce((a,b)=>a+b,0))),"trực tiếp từng kênh")}${kpi("Chi chung công ty",nf(Math.round(A.chung)),"chia theo quy tắc ở Sổ chi phí")}${kpi("Vào giá thành",nf(Math.round(A.gv)),"lương sản xuất")}</div>
  <section class="card flush"><div class="card-h pad"><h2>Mặc định theo phòng ban</h2><span class="hint">áp cho người chưa được đặt riêng</span></div>
  ${tbl(["Phòng ban","Số người","Tổng thu nhập","Cách chia mặc định"],pbs.map(pb=>{const rs=S.rows.filter(r=>r.pb===pb),p=(d.cpLuongPhong||{})[pb]||(pb==="SX"?{gv:1}:{});
    return `<tr><td><b>${esc(pbN(pb))}</b></td><td class="n">${rs.length}</td><td class="n">${nf(Math.round(rs.reduce((t,r)=>t+r.tong,0)))}</td><td>${ed?`<select data-pb="${esc(pb)}">${opt(presets,cur(p))}</select>`:esc(cpLgTxt(p))}${cur(p)==="split"?` <span class="hint">${esc(cpLgTxt(p))}</span>`:""}</td></tr>`}))}</section>
  <section class="card flush"><div class="card-h pad"><h2>Từng người</h2><span class="hint">đặt riêng khi người đó làm cho kênh khác phòng ban của mình</span></div>
  ${tbl(["Mã","Họ tên","Phòng ban","Tổng thu nhập","Cách chia","Đang áp dụng"],S.rows.map(r=>{const own=(d.cpLuongChia||{})[r.ma],p=cpLgPlan(r.ma,r.pb);
    return `<tr><td class="mono">${esc(r.ma)}</td><td><b>${esc(r.ten)}</b></td><td>${esc(pbN(r.pb))}</td><td class="n">${nf(Math.round(r.tong))}</td><td>${ed?`<select data-ma="${esc(r.ma)}"><option value="*">Theo phòng ban</option>${opt(presets,own?cur(own):"*")}</select>`:esc(cpLgTxt(p))}</td><td>${esc(cpLgTxt(p))}${own?"":` <span class="hint">(theo phòng ban)</span>`}</td></tr>`}))}</section>
  <section class="card pad"><b>Lương theo kênh</b>${tbl(["Kênh","Lương tính vào kênh"],kenhs.filter(k=>perK[k]).map(k=>`<tr><td>${esc(k)}</td><td class="n"><b>${nf(Math.round(perK[k]))}</b></td></tr>`).concat([`<tr class="tot"><td>Chi chung công ty (chưa gắn kênh)</td><td class="n">${nf(Math.round(A.chung))}</td></tr>`]))}
  <p class="hint">Số này đã nằm trong bảng "Kênh nào gánh bao nhiêu chi phí" ở Sổ chi phí. Lương nhập tay trong sổ (khoản chi "Lương cứng") không cộng thêm khi đang bật ô trên. Thưởng, hoa hồng nhập ở sổ vẫn cộng bình thường.${(()=>{const sx=(d.costs||[]).filter(c=>c.cat==="LUONG"&&(c.ngay?c.ngay.slice(0,7):c.thang)===ym).reduce((t,c)=>t+(+c.tien||0),0);return sx?` Lương đã duyệt trong sổ tháng này: ${nf(Math.round(sx))} đ, bảng lương: ${nf(Math.round(A.tong))} đ.`:""})()}</p></section>`;
  if($("#lg-goiy"))$("#lg-goiy").onclick=()=>{const K=CP_KENH(),TT=K.find(k=>/tiktok/i.test(k)),SP=K.find(k=>/shopee/i.test(k)),FB=K.find(k=>/facebook/i.test(k));
    if(!TT||!SP||!FB){toast("Thiếu kênh TikTok, Shopee hoặc Facebook trong Kênh bán & phí");return}
    const find=re=>(d.staff||[]).find(x=>re.test(x.ten||""));const kh=find(/khanh/i),ng=find(/nguyệt/i),own={};
    if(kh)own[kh.ma]={k:{[TT]:100}};if(ng)own[ng.ma]={k:{[SP]:100}};
    if(!confirm("Áp gợi ý chia lương? Khanh → TikTok, Nguyệt → Shopee, Ads/Digital + Sale B2C → Facebook, Content & Media → 47/47/6, Sản xuất → giá thành."))return;
    save(dt=>{dt.cpLuongChia=Object.assign(dt.cpLuongChia||{},own);dt.cpLuongPhong=Object.assign(dt.cpLuongPhong||{},{ADS:{k:{[FB]:100}},B2C:{k:{[FB]:100}},CM:{k:{[TT]:47,[FB]:47,[SP]:6}},SX:{gv:1}})},"áp gợi ý chia lương theo phòng ban và kênh")};
  const save=(fn,msg)=>{DB.mutate(ME.name,msg,dt=>{fn(dt)});renderMain()};
  m.querySelectorAll("#lg-auto").forEach(c=>c.onchange=()=>save(dt=>{dt.cpLuongAuto=c.checked},"đổi cách tính lương vào chi phí kênh"));
  const apply=(sel,get,set,clear)=>{const v=sel.value;if(v==="split"){cpLgSplit(get(),set);return}
    if(v==="*"){save(dt=>clear(dt),"đặt lại cách chia lương");return}
    const plan=v===""?{}:v==="gv"?{gv:1}:{k:{[v.slice(2)]:100}};save(dt=>set(dt,plan),"đặt cách chia lương")};
  m.querySelectorAll("select[data-pb]").forEach(s=>{const pb=s.dataset.pb;s.onchange=()=>apply(s,()=>(d.cpLuongPhong||{})[pb]||{},(dt,p)=>{(dt.cpLuongPhong=dt.cpLuongPhong||{})[pb]=p},dt=>{if(dt.cpLuongPhong)delete dt.cpLuongPhong[pb]})});
  m.querySelectorAll("select[data-ma]").forEach(s=>{const ma=s.dataset.ma;s.onchange=()=>apply(s,()=>(d.cpLuongChia||{})[ma]||{},(dt,p)=>{(dt.cpLuongChia=dt.cpLuongChia||{})[ma]=p},dt=>{if(dt.cpLuongChia)delete dt.cpLuongChia[ma]})});
  function cpLgSplit(p,set){const kk=CP_KENH();openDrawerHTML(`<h2>Chia lương cho nhiều kênh</h2><p class="hint">Nhập phần trăm công sức cho từng kênh. Phần còn lại là chi chung công ty.</p><form class="frm" id="lgf">${kk.map((k,i)=>`<label class="field">${esc(k)} (%)<input type="number" min="0" max="100" step="1" data-k="${esc(k)}" value="${(p.k||{})[k]||""}"></label>`).join("")}<div id="lgf-e"></div><button class="btn pri">Lưu</button></form>`);
    $("#lgf").onsubmit=e=>{e.preventDefault();const o={};let sum=0;document.querySelectorAll("#lgf input[data-k]").forEach(i=>{const v=+i.value||0;if(v>0){o[i.dataset.k]=v;sum+=v}});if(sum>100){$("#lgf-e").innerHTML=`<div class="note red">Tổng ${sum}% vượt 100%.</div>`;return}closeDrawer();save(dt=>set(dt,{k:o}),"chia lương cho nhiều kênh")}}
}
PAGES.cp_luong=pCpLuong;
