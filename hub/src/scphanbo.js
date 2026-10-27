/* =====================================================================
   QUY TẮC PHÂN BỔ CHI CHUNG (chị Hoa, chị Huệ, góp ý Kế toán trưởng 27/10). Tab "Quy tắc phân bổ" ở Sổ chi phí.
   - Chị Huệ (người duyệt chi) đặt cho từng nhóm chi phí: để ở chi chung công ty, chia theo doanh thu thực các kênh chọn,
     hoặc tỷ lệ % tự gõ. Dòng "Mặc định" áp cho nhóm chưa đặt riêng. Lương từng người chia ở trang Lương theo phòng ban và kênh.
   - Lưu: fin.pbqt (quy tắc đang dùng), fin.pblog (ai sửa, lúc nào, trước / sau), fin.pbchot[tháng] = các bản đã chốt.
     Tháng đã chốt dùng bản chốt mới nhất; chốt lại là thêm bản điều chỉnh, bản cũ giữ nguyên.
   - Báo cáo xem được hai chế độ: trước phân bổ chi chung (lãi đóng góp, để so kênh) và sau phân bổ (kênh gánh nổi phần chung không).
   - Luật chia thuần ở chicalc.js (scChiaChung), có test.
   ===================================================================== */
const SC_QT0=[{g:"*",cach:"dt",ks:["TikTok","Shopee Mall","Shopee thường","Facebook","NPP","Gia công"]}];
const scQTnow=()=>{const q=scFin().pbqt;return Array.isArray(q)?q:SC_QT0};
function scQT(ym){const V=((scFin().pbchot||{})[ym])||[];return V.length?{qt:V[V.length-1].qt,chot:V[V.length-1],n:V.length}:{qt:scQTnow(),chot:null,n:0}}
/* Chỉ chia đúng phần P&L tính là chi chung (cùng luật scChungNkc): nhóm loại B/C, trừ quảng cáo, phí sàn, vận chuyển.
   Nhóm "Chờ xác định" bổ Chung không đem chia (Kế toán trưởng: chưa xác định bản chất thì không phân bổ). */
const scLaChung=g=>/^[BC] - /.test(String(scG(g).lo||""))&&!SC_PL_TRU.includes(g);
/* Chia chi chung của kỳ đang xem (phải là một tháng). rows = scPBRows(). */
function scChiaPB(rows){const ym=PERIOD.from.slice(0,7),one=PERIOD.to.slice(0,7)===ym,ch=(rows||[]).filter(x=>x.k==="Chung"&&x.st!=="Chờ duyệt"&&scLaChung(x.g));
  if(!one)return {...scChiaChung(ch,[],{}),one,chot:null,ym};
  const Q=scQT(ym),o=scChiaChung(ch,Q.qt,scDtThang().DT),ten=t=>SC_KENH.reduce((a,k)=>a.split(k).join(SC_TEN(k)),String(t));
  o.loi=o.loi.map(ten);o.con.forEach(x=>x.why=ten(x.why));return {...o,one,chot:Q.chot,ym,qt:Q.qt}}
const scQTof=(qt,g)=>(qt||[]).find(z=>z.g===g&&z.on!==false)||(qt||[]).find(z=>z.g==="*"&&z.on!==false)||null;
function scQTtxt(r){if(!r||!r.cach||r.cach==="giu")return "Để ở chi chung công ty";
  if(r.cach==="dt")return "Theo doanh thu thực: "+(r.ks||[]).map(SC_TEN).join(", ");
  const E=Object.entries(r.tl||{}).filter(e=>+e[1]>0),s=E.reduce((a,e)=>a+ +e[1],0);
  return E.length?E.map(([k,p])=>p+"% "+SC_TEN(k)).join(" · ")+(s<100?` · ${Math.round((100-s)*100)/100}% để chung`:""):"Chưa đặt tỷ lệ"}
function scPBSeg(CH){const s=SC.pbm==="sau";return `<span class="scseg" role="group" aria-label="Chế độ xem"><button type="button" data-pbm="truoc" class="${s?"":"on"}" aria-pressed="${!s}">Trước phân bổ chi chung</button><button type="button" data-pbm="sau" class="${s?"on":""}" aria-pressed="${s}">Sau phân bổ</button></span>${s&&!CH.one?'<span class="hint">chọn một tháng để chia</span>':""}`}
/* ---------- Tab Quy tắc phân bổ ---------- */
function scQTtab(){
  scNap();
  const ed=scCanDuyet(),ym=PERIOD.from.slice(0,7),one=PERIOD.to.slice(0,7)===ym,qt=scQTnow(),rows=scPBRows(),CH=scChiaPB(rows),Q=scQT(ym);
  const chungBy={};rows.filter(x=>x.k==="Chung").forEach(x=>chungBy[x.g]=(chungBy[x.g]||0)+(+x.t||0));
  const gs=[...new Set(scDM().filter(x=>/^[BC] - /.test(x.lo)).map(x=>x.g).concat(Object.keys(chungBy)).concat(qt.filter(z=>z.g!=="*").map(z=>z.g)))].sort();
  const def=qt.find(z=>z.g==="*");
  const tr=(g,r,own)=>`<tr><td>${g==="*"?"<b>Mặc định</b><div class=\"hint\">nhóm chưa đặt riêng</div>":`<span class="mono">${esc(g)}</span> ${esc(scG(g).n)}`}</td><td>${own?esc(scQTtxt(r)):`<span class="hint">theo mặc định: ${esc(scQTtxt(def))}</span>`}${r&&r.on===false?' <span class="scp p-c">đang tắt</span>':""}</td><td class="n">${g==="*"?"":chungBy[g]?scNf(chungBy[g]):'<span class="hint">—</span>'}</td><td>${ed?`<button class="btn sm" data-qte="${esc(g)}">Sửa</button>`:""}</td></tr>`;
  const kq=SC_KENH.map(k=>[k,Object.values(CH.kenh[k]||{}).reduce((a,b)=>a+b,0)]).filter(x=>x[1]),conT=CH.con.reduce((a,x)=>a+x.t,0);
  const V=Q.n?((scFin().pbchot||{})[ym]):[],log=(scFin().pblog||[]).slice(-20).reverse();
  return `<section class="card pad"><div class="sch"><h2>Quy tắc phân bổ chi chung</h2><span class="hint">${ed?"chị Huệ sửa ở đây, mọi báo cáo kênh đổi theo":"chỉ kế toán sửa"}</span></div>
  <p class="hint">Khoản đã biết kênh thì ghi thẳng cho kênh (chọn "Bổ vào" ở Nhật ký chi), không chia lại. Ở đây chỉ đặt cách chia cho khoản <b>dùng chung</b> (đang bổ "Chi chung công ty"). Khoản đang "Cần rà" hoặc chờ duyệt không được đem chia. Lương từng người (Khanh → TikTok, Nguyệt → Shopee, kho theo doanh thu…) đặt ở trang <button class="btn sm" id="scqt-lg">Lương theo phòng ban và kênh</button></p>
  <div class="tbl"><table><thead><tr><th>Nhóm chi phí</th><th>Cách chia</th><th class="n">Kỳ này đang ở chi chung</th><th></th></tr></thead><tbody>
  ${tr("*",def,true)}${gs.map(g=>{const r=qt.find(z=>z.g===g);return tr(g,r,!!r)}).join("")}</tbody></table></div></section>
  <section class="card pad"><div class="sch"><h2>Lương: chia theo người, bộ phận</h2><span class="sp"></span><button class="btn sm" id="scqt-lg2">Sửa cách chia lương →</button></div>${scQTluong()}</section>
  ${log.length?`<section class="card pad"><h2>Lịch sử sửa quy tắc</h2><div class="tbl"><table><thead><tr><th>Lúc</th><th>Người sửa</th><th>Nhóm</th><th>Trước</th><th>Sau</th></tr></thead><tbody>${log.map(x=>`<tr><td>${new Date(x.at).toLocaleString("vi-VN")}</td><td>${esc(x.by||"")}</td><td>${x.g==="*"?"Mặc định":esc(x.g+" "+scG(x.g).n)}</td><td class="hint">${esc(x.truoc||"")}</td><td>${esc(x.sau||"")}</td></tr>`).join("")}</tbody></table></div></section>`:""}`}
function scQTedit(g){
  const qt=scQTnow(),cur=qt.find(z=>z.g===g),r=cur||{g,cach:"giu"},ks=SC_KENH;
  openDrawerHTML(`<h2>Cách chia: ${g==="*"?"Mặc định":esc(g+" · "+scG(g).n)}</h2><p class="hint">Chỉ áp cho phần của nhóm này đang bổ "Chi chung công ty". Sửa xong, tháng chưa chốt tính lại ngay; tháng đã chốt giữ bản chốt.</p>
  <form class="frm" id="scqtf">
   <label class="chk"><input type="radio" name="qtc" value="giu"${r.cach==="giu"?" checked":""}> Để ở chi chung công ty (không chia xuống kênh)</label>
   <label class="chk"><input type="radio" name="qtc" value="dt"${r.cach==="dt"?" checked":""}> Chia theo doanh thu thực của các kênh chọn dưới đây</label>
   <div id="qt-dt" style="padding-left:24px">${ks.map(k=>`<label class="chk"><input type="checkbox" data-qk="${esc(k)}"${(r.ks||SC_QT0[0].ks).includes(k)?" checked":""}> ${esc(SC_TEN(k))}</label>`).join("")}</div>
   <label class="chk"><input type="radio" name="qtc" value="tl"${r.cach==="tl"?" checked":""}> Chia theo tỷ lệ % (phần còn lại để chung)</label>
   <div id="qt-tl" style="padding-left:24px">${ks.map(k=>`<label class="field">${esc(SC_TEN(k))} (%)<input type="number" min="0" max="100" step="0.1" data-qp="${esc(k)}" value="${(r.tl||{})[k]||""}"></label>`).join("")}</div>
   ${g!=="*"?`<label class="chk"><input type="checkbox" id="qt-off"${r.on===false?" checked":""}> Tạm tắt quy tắc riêng này (dùng mặc định)</label>`:""}
   <div id="qt-e"></div>
   <div class="acts"><button class="btn pri">Lưu</button>${cur&&g!=="*"?`<button type="button" class="btn" id="qt-del">Bỏ quy tắc riêng, theo mặc định</button>`:""}</div></form>`);
  const save=(nr,msg)=>{const truoc=cur?scQTtxt(cur)+(cur.on===false?" (tắt)":""):"theo mặc định",sau=nr?scQTtxt(nr)+(nr.on===false?" (tắt)":""):"theo mặc định";
    DB.mutate(ME.name,msg,dt=>{dt.fin=dt.fin||{};const L=Array.isArray(dt.fin.pbqt)?dt.fin.pbqt:JSON.parse(JSON.stringify(SC_QT0)),i=L.findIndex(z=>z.g===g);
      if(nr){if(i>=0)L[i]=nr;else L.push(nr)}else if(i>=0)L.splice(i,1);dt.fin.pbqt=L;
      (dt.fin.pblog=dt.fin.pblog||[]).push({at:Date.now(),by:ME.name,g,truoc,sau});if(dt.fin.pblog.length>300)dt.fin.pblog=dt.fin.pblog.slice(-300)});
    closeDrawer();toast("Đã lưu quy tắc");renderMain()};
  $("#scqtf").onsubmit=e=>{e.preventDefault();const c=(document.querySelector('[name="qtc"]:checked')||{}).value||"giu",nr={g,cach:c};
    if(c==="dt"){nr.ks=[...document.querySelectorAll("[data-qk]")].filter(i=>i.checked).map(i=>i.dataset.qk);if(!nr.ks.length){$("#qt-e").innerHTML=`<div class="note red">Chọn ít nhất một kênh nhận.</div>`;return}}
    if(c==="tl"){const o={};let s=0;document.querySelectorAll("[data-qp]").forEach(i=>{const v=+i.value||0;if(v>0){o[i.dataset.qp]=v;s+=v}});
      if(s>100.0001){$("#qt-e").innerHTML=`<div class="note red">Tổng ${Math.round(s*100)/100}% vượt 100%.</div>`;return}if(!s){$("#qt-e").innerHTML=`<div class="note red">Nhập tỷ lệ cho ít nhất một kênh.</div>`;return}nr.tl=o}
    if($("#qt-off")&&$("#qt-off").checked)nr.on=false;
    save(nr,"sửa quy tắc phân bổ "+(g==="*"?"mặc định":g))};
  if($("#qt-del"))$("#qt-del").onclick=()=>save(null,"bỏ quy tắc phân bổ riêng "+g)}
function scQTchot(){
  const ym=PERIOD.from.slice(0,7),Q=scQT(ym);let ghi="";
  if(Q.n){ghi=prompt("Lý do chốt bản điều chỉnh (bản cũ vẫn giữ trong lịch sử):","");if(ghi==null)return;if(!ghi.trim()){toast("Cần ghi lý do điều chỉnh");return}}
  else if(!confirm("Chốt phân bổ tháng "+ym.slice(5)+"/"+ym.slice(0,4)+"? Sau khi chốt, sửa quy tắc không làm đổi số tháng này; muốn đổi thì chốt bản điều chỉnh."))return;
  const qt=JSON.parse(JSON.stringify(scQTnow()));
  DB.mutate(ME.name,"chốt phân bổ chi chung "+ym,dt=>{dt.fin=dt.fin||{};const P=dt.fin.pbchot=dt.fin.pbchot||{},V=P[ym]=P[ym]||[];V.push({v:V.length+1,by:ME.name,at:Date.now(),qt,ghi:ghi.trim()})});
  toast("Đã chốt phân bổ tháng "+ym.slice(5));renderMain()}
function scQTbind(m){
  m.querySelectorAll("[data-pbm]").forEach(b=>b.onclick=()=>{SC.pbm=b.dataset.pbm;renderMain()});
  m.querySelectorAll("[data-qte]").forEach(b=>b.onclick=()=>scQTedit(b.dataset.qte));
  const c=m.querySelector("#scqt-chot");if(c)c.onclick=scQTchot;
  const l2=m.querySelector("#scqt-lg2");if(l2)l2.onclick=()=>{PAGE="cp_luong";try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}render();scrollTo(0,0)};
  const l=m.querySelector("#scqt-lg");if(l)l.onclick=()=>{PAGE="cp_luong";try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}render();scrollTo(0,0)};
  if(!document.getElementById("scqt-css")){const s=document.createElement("style");s.id="scqt-css";s.textContent=`.sochi .scseg{display:inline-flex;border:1px solid #e3e6ee;border-radius:8px;overflow:hidden}.sochi .scseg button{border:0;background:#fff;padding:5px 10px;font:600 12.5px inherit;font-family:inherit;color:#667085;cursor:pointer}.sochi .scseg button.on{background:#5146c8;color:#fff}
.sochi .scpbl{display:flex;flex-wrap:wrap;gap:6px 22px;align-items:center;background:#f7f8fb;border:1px solid #e3e6ee;border-radius:10px;padding:9px 12px;margin:-4px 0 12px;font-size:13px}`;document.head.appendChild(s)}}
/* Cho trang Lãi lỗ (chat Doanh thu): chi phí tháng ym theo kênh, mã kênh là cột Sổ chi phí
   (TikTok, Shopee Mall = Aillavn, Shopee thường = Aillavn1, Facebook, NPP, Gia công).
   - luong{k}: lương làm riêng cho kênh từ bảng lương ĐÃ CHỐT (trang Lương theo phòng ban và kênh); trừ ở lãi đóng góp.
   - luongChung: phần lương bảng lương chưa gắn kênh (đã nằm trong chi chung để chia, không trừ thêm).
     Sổ đã ghi tay nhóm G07 trong tháng thì không lấy bảng lương (tránh tính hai lần), cả hai trường là 0.
   - chia{k}: chi chung được chia theo Quy tắc phân bổ (gồm luongChung nếu quy tắc chia nó); con: phần còn ở chi chung.
     Lãi sau phân bổ = lãi đóng góp − chia{k}. truoc = sau là kiểm tra tổng. chot: bản chốt tháng hoặc null. */
function scPLKenh(ym){const o={f:PERIOD.from,t:PERIOD.to},[y,m]=ym.split("-").map(Number);
  try{PERIOD.from=ym+"-01";PERIOD.to=ym+"-"+String(new Date(y,m,0).getDate()).padStart(2,"0");
    const rows=scPBRows(),CH=scChiaPB(rows),luong={};let luongChung=0;
    rows.filter(x=>x.ext&&x.ext.src==="luong").forEach(x=>{if(x.k==="Chung")luongChung+=+x.t||0;else luong[x.k]=(luong[x.k]||0)+(+x.t||0)});
    const chia={};Object.entries(CH.kenh).forEach(([k,g])=>chia[k]=Object.values(g).reduce((a,b)=>a+b,0));
    return {ym,luong,luongChung,chia,con:CH.con.reduce((a,x)=>a+x.t,0),truoc:CH.truoc,sau:CH.sau,loi:CH.loi,chot:CH.chot||null}}
  finally{PERIOD.from=o.f;PERIOD.to=o.t}}
/* Tóm tắt cách chia lương đang đặt (trang Lương theo phòng ban và kênh) để chị Huệ thấy cùng chỗ với quy tắc chi chung. */
function scQTluong(){const d=D(),P=d.cpLuongPhong||{},C=d.cpLuongChia||{},pbN=k=>(d.departments.find(p=>p.k===k)||{n:k}).n,ten=ma=>((d.staff||[]).find(x=>x.ma===ma)||{ten:ma}).ten;
  const L=Object.keys(P).map(k=>["Bộ phận "+pbN(k),cpLgTxt(P[k])]).concat(Object.keys(C).map(ma=>[ten(ma),cpLgTxt(C[ma])]));
  return L.length?`<div class="tbl"><table><thead><tr><th>Áp cho</th><th>Cách chia</th></tr></thead><tbody>${L.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("")}</tbody></table></div>`:'<p class="hint">Chưa đặt cách chia lương nào: toàn bộ lương đang ở chi chung (bộ phận Sản xuất vào giá thành). Bấm "Sửa cách chia lương" để đặt: Khanh → TikTok, Nguyệt → 2 shop Shopee, sale và chạy quảng cáo → Facebook, kho → theo doanh thu thực…</p>'}
