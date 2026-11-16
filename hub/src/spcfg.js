/* =====================================================================
   VẬN HÀNH › CẤU HÌNH › SẢN PHẨM · COMBO · KHUYẾN MÃI (chị Hoa duyệt 16/11, theo cách Poscake,
   demo C:\Users\ADMIN\Downloads\demo-san-pham-combo-km-poscake.html; giao diện theo màu web).
   Khác Poscake: trên mỗi trang chọn KÊNH / BỘ PHẬN, mỗi người chỉ thấy kênh của mình, không hiện giá vốn.
     Ads Facebook (phòng ADS)   : sản phẩm + combo Ads (spdangchay.js, d.fbCat)
     CSKH (phòng CSKH / B2C)    : sản phẩm + combo riêng của CSKH (d.cskhCat), không chạy ads
     TikTok (phòng CM), Shopee  : combo trên sàn (bảng quy đổi của kế toán) + khai combo mới (d.ttCombo)
     Kênh phân phối (phòng KV)  : sản phẩm + bảng giá 8 cấp (chỉ xem)
   Combo, khuyến mãi mới chờ kế toán duyệt (combo qua phiếu như Ads; khuyến mãi d.kmCat). Pancake: chỉ đọc
   (sản phẩm, giá, combo); ghi ngược lên Pancake chờ chị duyệt riêng. CEO, Ban điều hành (BDH), kế toán (KT) thấy hết.
   ===================================================================== */
const SPCF={ch:"",q:"",open:{},kmT:"all",b2b:null,b2bBusy:false,pkOpen:false,pkcb:null,pkcbBusy:false,pkcbErr:""};
const spcfAll=u=>!!u&&(u.role==="admin"||["BDH","KT"].includes(u.phongBan));
const SPCF_CH=[
  ["ads","Ads Facebook",u=>spcfAll(u)||u.phongBan==="ADS"||u.role==="digital"],
  ["cskh","CSKH",u=>spcfAll(u)||["CSKH","B2C"].includes(u.phongBan)],
  ["tt","TikTok",u=>spcfAll(u)||u.phongBan==="CM"],
  ["sp","Shopee",u=>spcfAll(u)],
  ["b2b","Kênh phân phối",u=>spcfAll(u)||u.phongBan==="KV"]];
const SPCF_BP=Object.fromEntries(SPCF_CH.map(c=>[c[0],c[1]]));
const spcfChs=u=>SPCF_CH.filter(c=>c[2](u));
const spcfMyBp=u=>spcfChs(u).map(c=>c[0]);
const spcfList=k=>{try{const a=D()[k];return Array.isArray(a)?a:[]}catch(e){return []}};
const spcfCanDuyet=()=>typeof spcCanDuyet==="function"&&spcCanDuyet();
const spcfVN=d=>d?d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(0,4):"";
const spcfToday=()=>new Date(Date.now()+7*3600e3).toISOString().slice(0,10);
const spcfNum=v=>+String(v||"").replace(/[^0-9]/g,"")||0;
/* Kênh đang chọn; Ads / CSKH thì đặt SPC.bpView để spdangchay.js đọc đúng kho (d.fbCat / d.cskhCat). */
function spcfCh(){const L=spcfChs(ME);if(!L.some(c=>c[0]===SPCF.ch))SPCF.ch=L.length?L[0][0]:"";
  if(typeof SPC!=="undefined")SPC.bpView=SPCF.ch==="ads"?"ADS":SPCF.ch==="cskh"?"CSKH":null;return SPCF.ch}
const spcfChBar=()=>`<nav class="settabs">${spcfChs(ME).map(([k,t])=>`<button class="${SPCF.ch===k?"on":""}" data-spcfch="${k}">${t}</button>`).join("")}</nav>`;
const spcfNoAccess=(m,t)=>{m.innerHTML=H(t,"")+`<div class="note">Trang này dành cho phòng Ads, Content (TikTok), CSKH, Kênh phân phối và kế toán.</div>`};
function spcfFrame(m,t,sub,body){m.innerHTML=H(t,sub)+spcfChBar()+body;
  m.querySelectorAll("[data-spcfch]").forEach(b=>b.onclick=()=>{SPCF.ch=b.dataset.spcfch;SPCF.open={};SPCF.pkOpen=false;renderMain()});
  m.querySelectorAll("[data-spbpk]").forEach(b=>b.onclick=()=>spbPkLoad());
  if(typeof spbPkBind==="function")spbPkBind(m);spcfBind(m)}
const spcfCatEd=()=>typeof spcCanEdit==="function"&&spcCanEdit();
const spcfVars=()=>(typeof spcCat==="function"?spcCat():[]).flatMap(p=>(p.bt||[]).filter(v=>v.ma).map(v=>({ma:v.ma,pkId:v.pkId||"",ten:p.ten+((v.dt||v.pl)?" ("+[v.dt,v.pl].filter(Boolean).join(" · ")+")":""),gia:+v.gia||(typeof spbPkPrice==="function"?spbPkPrice(v):0)||0,loai:p.loai,on:v.on!==false})));

/* ============================== SẢN PHẨM ============================== */
function pSpcfSp(m){
  const ch=spcfCh();if(!ch){spcfNoAccess(m,"Sản phẩm");return}
  const sub="Sản phẩm từng kênh · giá bán của kênh · không hiện giá vốn";
  if(ch==="b2b"){spcfFrame(m,"Sản phẩm",sub,spcfB2bView());return}
  if(ch==="tt"||ch==="sp"){spcfFrame(m,"Sản phẩm",sub,`<div class="note">Sản phẩm và giá ${SPCF_BP[ch]} nằm trên sàn. Combo trên sàn gồm những sản phẩm nào xem và khai ở mục <b>Combo</b>.</div>`);return}
  if(!SPCB.pk&&!SPCB.pkBusy&&!SPCB.pkErr&&typeof spbPkLoad==="function")setTimeout(()=>{if(!SPCB.pk&&!SPCB.pkBusy)spbPkLoad()},0);
  const ed=spcfCatEd(),cat=spcCat(),fold=typeof kfold==="function"?kfold:spcLow,q=fold(SPCF.q||"").trim();
  const L=cat.map((p,i)=>({p,i})).filter(({p})=>!q||fold(p.ten+" "+(p.bt||[]).map(v=>v.ma).join(" ")).includes(q));
  const LO={run:["Sản phẩm","grn"],gift:["Quà tặng","amb"],off:["Không bán","gry"]};
  const rows=L.map(({p,i})=>{const bt=p.bt||[],on=bt.some(v=>v.on!==false)&&p.loai!=="off",v0=bt[0]||{},open=!!SPCF.open[p.id];
    return `<tr><td><button class="lnk" data-spcfop="${esc(p.id)}">${bt.length>1?(open?"−":"+"):""}</button></td><td>${ed?`<input type="checkbox" data-spcfon="${esc(p.id)}" ${on?"checked":""} title="Bật / tắt bán ở kênh này">`:on?"✓":""}</td>
     <td class="mono">${esc(v0.ma||"")}</td><td><b>${esc(p.ten)}</b></td><td>${pill((LO[p.loai]||LO.run)[0],(LO[p.loai]||LO.run)[1])}</td><td class="n">${bt.length}</td>
     <td class="n">${bt.length===1?spcGiaTxt(v0):`<small class="hint">${bt.length} mẫu</small>`}</td><td class="n">${bt.length===1&&spbPkPrice(v0)!=null?nf(spbPkPrice(v0)):"—"}</td>
     <td style="white-space:nowrap">${ed?`<button class="btn sm" data-spcfpe="${esc(p.id)}">Sửa</button>`:""}</td></tr>`+
     (open?bt.map(v=>`<tr class="mut"><td></td><td>${v.on!==false?"✓":""}</td><td class="mono">${esc(v.ma)}</td><td><small>${esc([v.dt,v.pl].filter(Boolean).join(" · ")||"mặc định")}</small></td><td></td><td></td><td class="n">${spcGiaTxt(v)}</td><td class="n">${spbPkPrice(v)!=null?nf(spbPkPrice(v)):"—"}</td><td></td></tr>`).join(""):"")}).join("");
  const body=`<section class="card flush"><div class="card-h pad"><div class="filters"><input id="spcf-q" placeholder="Tìm mã, tên sản phẩm…" value="${esc(SPCF.q)}" style="max-width:260px"><span class="hint">${nf(L.length)} sản phẩm</span></div>
     <div class="filters">${ed?`<button class="btn" data-spcfpk="1">${SPCF.pkOpen?"Ẩn danh sách Pancake":"Lấy từ Pancake"}</button>`:""}<button class="btn" data-spbpk="1">⟳ Đồng bộ Pancake</button>${ed?`<button class="btn pri" data-spcfpe="">+ Tạo sản phẩm</button>`:""}</div></div>
    ${tbl(["","Bán","Mã SP","Tên sản phẩm","Loại","Số mẫu mã","Giá bán kênh","Giá Pancake",""],[rows])}
    <p class="hint pad">Giá bán kênh: giá riêng của kênh nếu đã đặt, chưa đặt thì theo giá Pancake. Bỏ dấu ở cột "Bán" để ngừng bán ở kênh này mà không xóa.</p></section>
    ${SPCF.pkOpen&&SPCB.pk?spbPkEditView(SPC.bpView):SPCF.pkOpen?`<p class="hint pad">Đang đọc Pancake…</p>`:""}`;
  spcfFrame(m,"Sản phẩm",sub,body);
}
/* Ô tạo / sửa sản phẩm (giống Poscake: mã, tên, loại, các mẫu mã kèm giá bán kênh) */
function spcfProdForm(id){
  const p=id?spcCat().find(x=>x.id===id):null,bt=p?(p.bt||[]).map(v=>({...v})):[{id:"v"+Date.now(),ma:"",dt:"",pl:"",on:true}],misa=typeof spcCanMisa==="function"&&spcCanMisa();
  const draw=()=>{openDrawerHTML(`<h2>${p?"Sửa":"Tạo"} sản phẩm · ${esc(SPCF_BP[SPCF.ch])}</h2>
    <div class="filters"><label class="inl" style="flex:1">Tên sản phẩm * <input id="spf-ten" style="width:100%" value="${esc(p?p.ten:"")}"></label><label class="inl">Loại <select id="spf-loai">${opt([["run","Sản phẩm"],["gift","Quà tặng"],["off","Không bán"]],p?p.loai:"run")}</select></label></div>
    <h3 style="margin:14px 0 6px">Mẫu mã</h3>
    ${tbl(["Bán","Mã mẫu (mã Pancake)","Dung tích","Phân loại / hương","Giá bán kênh (đ)"].concat(misa?["Mã kho (MISA)"]:[],[""]),bt.map((v,i)=>`<tr data-spfv="${i}"><td><input type="checkbox" class="spf-on" ${v.on!==false?"checked":""}></td><td><input class="spf-ma mono" value="${esc(v.ma)}" style="width:120px"></td><td><input class="spf-dt" value="${esc(v.dt||"")}" style="width:90px"></td><td><input class="spf-pl" value="${esc(v.pl||"")}" style="width:120px"></td>
      <td><input class="spf-gia n" inputmode="numeric" value="${v.gia?Math.round(v.gia):""}" placeholder="${spbPkPrice(v)!=null?nf(spbPkPrice(v)):"giá"}" style="width:110px"></td>${misa?`<td><input class="spf-misa mono" value="${esc(v.misa||"")}" style="width:130px"></td>`:""}<td>${bt.length>1?`<button class="btn sm" data-spfdel="${i}">✕</button>`:""}</td></tr>`))}
    <button class="btn sm" id="spf-add">+ Thêm mẫu mã</button>
    <div class="filters" style="margin-top:14px"><button class="btn pri" id="spf-save">Lưu</button>${p?`<button class="btn" id="spf-rm" style="margin-left:auto">Xóa sản phẩm</button>`:""}</div>`);
    const dr=$("#drawerIn"),read=()=>dr.querySelectorAll("[data-spfv]").forEach(r=>{const v=bt[+r.dataset.spfv],g=s=>r.querySelector(s);v.on=g(".spf-on").checked;v.ma=g(".spf-ma").value.trim();v.dt=g(".spf-dt").value.trim();v.pl=g(".spf-pl").value.trim();const n=spcfNum(g(".spf-gia").value);if(n)v.gia=n;else delete v.gia;if(g(".spf-misa"))v.misa=g(".spf-misa").value.trim()});
    $("#spf-add").onclick=()=>{read();bt.push({id:"v"+Date.now(),ma:"",dt:"",pl:"",on:true});draw()};
    dr.querySelectorAll("[data-spfdel]").forEach(b=>b.onclick=()=>{read();bt.splice(+b.dataset.spfdel,1);draw()});
    $("#spf-save").onclick=()=>{read();const ten=$("#spf-ten").value.trim(),loai=$("#spf-loai").value,V=bt.filter(v=>v.ma);if(!ten){toast("Nhập tên sản phẩm");return}if(!V.length){toast("Cần ít nhất một mã mẫu");return}
      spcEdit(p?"sửa sản phẩm "+ten:"tạo sản phẩm "+ten,c=>{if(p){const x=c.sp.find(y=>y.id===p.id);if(x)Object.assign(x,{ten,loai,bt:V})}else c.sp.push({id:"p"+Date.now(),ten,loai,bt:V})});closeDrawer()};
    if($("#spf-rm"))$("#spf-rm").onclick=()=>{const used=spcCombosAll().some(c=>(c.gom||[]).concat(c.tang||[]).some(x=>(p.bt||[]).some(v=>v.ma===x.ma)));if(used){toast("Sản phẩm đang nằm trong combo, sửa hoặc dừng combo trước");return}
      if(!confirm("Xóa "+p.ten+" khỏi danh sách "+SPCF_BP[SPCF.ch]+"?"))return;spcEdit("xóa sản phẩm "+p.ten,c=>{c.sp=c.sp.filter(y=>y.id!==p.id)});closeDrawer()}};
  draw();
}

/* ============================== COMBO ============================== */
function pSpcfCb(m){
  const ch=spcfCh();if(!ch){spcfNoAccess(m,"Combo");return}
  const sub="Combo từng kênh · lưu xong chờ kế toán duyệt (nối mã kho) rồi mới chạy";
  if(ch==="b2b"){spcfFrame(m,"Combo",sub,`<div class="note">Kênh phân phối bán theo bảng giá 8 cấp, không dùng combo. Khuyến mãi cho NPP đặt ở mục <b>Khuyến mãi</b>.</div>`);return}
  if(ch==="tt"||ch==="sp"){spcfFrame(m,"Combo",sub,spcfSanView(ch==="tt"?"TIKTOK":"SHOPEE"));return}
  const ed=spcfCatEd(),fold=typeof kfold==="function"?kfold:spcLow,q=fold(SPCF.q||"").trim();
  const L=spcCombos().filter(c=>!q||fold([c.nhom,c.combo,c.qua].join(" ")).includes(q)).slice().sort((a,b)=>String(b.tu||"").localeCompare(String(a.tu||"")));
  const live=c=>spcTT(c)==="ok"&&spcSt(c)[0]!=="Đã hết";
  const rows=L.map(c=>`<tr${live(c)||spcTT(c)!=="ok"?"":' class="mut"'}><td class="mono">${esc(String(c.id).replace(/^\D+/,"").slice(-7))}</td><td><b>${esc(c.nhom||"")}</b><br><small class="hint">${esc(spcDesc(c))}</small></td><td>${pill("Sản phẩm","blu")}</td>
     <td>${(+c.ship||0)===0?"✓":`<small class="hint">ship ${nf(c.ship)}</small>`}</td><td class="n"><b>${nf(c.gia||0)}</b></td><td class="hint">${spcfVN(c.tu)}${c.den?" → "+spcfVN(c.den):""}</td><td>${spcTag(c)}</td>
     <td style="white-space:nowrap">${ed?`<button class="btn sm" data-spcfce="${esc(c.id)}">Sửa</button>${live(c)&&!c.dx?` <button class="btn sm" data-spc-act="sopen" data-spid="${esc(c.id)}">Dừng</button>`:""}`:""}</td></tr>`).join("");
  const body=(typeof spcFlow==="function"?spcFlow(ed):"")+`<section class="card flush"><div class="card-h pad"><div class="filters"><input id="spcf-q" placeholder="Tìm combo…" value="${esc(SPCF.q)}" style="max-width:260px"><span class="hint">${nf(L.length)} combo</span></div>
     <div class="filters"><button class="btn" data-spcfpkcb="1">${SPCF.pkcbBusy?"Đang đọc…":"⟳ Combo trên Pancake"}</button>${ed?`<button class="btn pri" data-spcfce="">+ Tạo combo</button>`:""}</div></div>
    ${tbl(["ID","Tên combo","Loại combo","Miễn phí vận chuyển","Giá trị","Thời gian áp dụng","Trạng thái",""],[rows])}</section>${spcfPkCbView(ed)}`;
  spcfFrame(m,"Combo",sub,body);
  if(typeof spcMdDraw==="function")spcMdDraw();
}
/* Ô tạo / sửa combo kiểu Poscake: tên, thời gian, giá trị combo hoặc giảm giá, freeship, phạm vi (sản phẩm + số lượng), quà kèm */
function spcfComboForm(id,pre){
  const c=id?spcCombos().find(x=>x.id===id):null,V=spcfVars(),vOf=ma=>V.find(v=>v.ma===ma);
  const st={ten:c?c.nhom||"":(pre&&pre.ten)||"",tu:c?c.tu||spcfToday():spcfToday(),den:c?c.den||"":"",land:c?(spcLands(c)[0]||""):"",kieu:"gt",gia:c?+c.gia||0:(pre&&pre.gia)||0,giam:0,giamPct:false,fs:c?(+c.ship||0)===0:(pre?!!pre.fs:true),ship:c?+c.ship||0:0,
    gom:c?(c.gom||[]).map(x=>({...x})):(pre&&pre.gom)||[],tang:c?(c.tang||[]).map(x=>({...x})):[],ghi:c?c.ghi||"":""};
  const goc=()=>st.gom.reduce((a,x)=>{const v=vOf(x.ma);return a+(v?v.gia:0)*(+x.sl||1)},0);
  const val=()=>st.kieu==="gt"?st.gia:Math.max(0,st.giamPct?Math.round(goc()*(1-st.giam/100)):goc()-st.giam);
  const opts=V.filter(v=>v.on).map(v=>`<option value="${esc(v.ma)}">${esc(v.ma+" · "+v.ten)}</option>`).join("");
  const lst=(k,lbl)=>`${tbl(["Sản phẩm","Số lượng","Giá kênh",""],st[k].map((x,i)=>{const v=vOf(x.ma);return `<tr><td>${v?`<span class="mono">${esc(x.ma)}</span> ${esc(v.ten)}`:`<span class="t-red">${esc(x.ma||x.ten||"")} (chưa có trong danh sách)</span>`}</td><td><input class="spcb-q n" data-k="${k}" data-i="${i}" type="number" min="1" value="${+x.sl||1}" style="width:70px"></td><td class="n">${k==="tang"?"0 (quà)":v?nf(v.gia):"—"}</td><td><button class="btn sm" data-spcbdel="${k}:${i}">✕</button></td></tr>`}))}
    <div class="filters"><select class="spcb-add" data-k="${k}"><option value="">+ Thêm ${lbl}…</option>${opts}</select></div>`;
  const draw=()=>{openDrawerHTML(`<h2>${c?"Sửa":"Tạo"} combo · ${esc(SPCF_BP[SPCF.ch])}</h2>
    <h3 style="margin:10px 0 6px">Thông tin cơ bản</h3>
    <div class="filters"><label class="inl" style="flex:1">Tên combo * <input id="spcb-ten" style="width:100%" value="${esc(st.ten)}" placeholder="Ví dụ: [250g] 2 bột tẩy vạn năng 185K"></label></div>
    <div class="filters"><label class="inl">Áp dụng từ * <input type="date" id="spcb-tu" value="${esc(st.tu)}"></label><label class="inl">đến <input type="date" id="spcb-den" value="${esc(st.den)}"></label>${SPCF.ch==="ads"?`<label class="inl" style="flex:1">Landing / page <input id="spcb-land" style="width:100%" value="${esc(st.land)}"></label>`:""}</div>
    <h3 style="margin:14px 0 6px">Giá combo</h3>
    <div class="filters"><label class="inl"><input type="radio" name="spcb-k" value="gt" ${st.kieu==="gt"?"checked":""} style="width:auto"> Giá trị combo</label><label class="inl"><input type="radio" name="spcb-k" value="gg" ${st.kieu==="gg"?"checked":""} style="width:auto"> Giảm giá</label>
     ${st.kieu==="gt"?`<label class="inl">Giá trị combo (đ) <input id="spcb-gia" inputmode="numeric" value="${st.gia||""}" style="width:130px"></label>`:`<label class="inl">Giảm <input id="spcb-giam" inputmode="numeric" value="${st.giam||""}" style="width:90px"></label><select id="spcb-pct">${opt([["d","đ"],["p","%"]],st.giamPct?"p":"d")}</select>`}</div>
    <div class="filters"><label class="inl"><input type="checkbox" id="spcb-fs" ${st.fs?"checked":""} style="width:auto"> Miễn phí vận chuyển</label>${st.fs?"":`<label class="inl">Phí ship (đ) <input id="spcb-ship" inputmode="numeric" value="${st.ship||""}" style="width:110px"></label>`}</div>
    <h3 style="margin:14px 0 6px">Phạm vi áp dụng · sản phẩm trong combo</h3>${lst("gom","sản phẩm")}
    <div class="note" style="margin-top:6px">Tổng tiền gốc: <b>${nf(goc())} đ</b> · Giá combo: <b>${nf(val())} đ</b></div>
    <h3 style="margin:14px 0 6px">Quà tặng kèm</h3>${lst("tang","quà")}
    <div class="filters"><label class="inl" style="flex:1">Ghi chú <input id="spcb-ghi" style="width:100%" value="${esc(st.ghi)}"></label></div>
    <div class="filters" style="margin-top:14px"><button class="btn pri" id="spcb-save">Lưu và gửi kế toán duyệt</button></div>`);
    const dr=$("#drawerIn"),read=()=>{const g=s=>dr.querySelector(s);st.ten=g("#spcb-ten").value.trim();st.tu=g("#spcb-tu").value;st.den=g("#spcb-den").value;if(g("#spcb-land"))st.land=g("#spcb-land").value.trim();
      st.kieu=(dr.querySelector("input[name=spcb-k]:checked")||{}).value||"gt";if(g("#spcb-gia"))st.gia=spcfNum(g("#spcb-gia").value);if(g("#spcb-giam")){st.giam=spcfNum(g("#spcb-giam").value);st.giamPct=g("#spcb-pct").value==="p"}
      st.fs=g("#spcb-fs").checked;if(g("#spcb-ship"))st.ship=spcfNum(g("#spcb-ship").value);st.ghi=g("#spcb-ghi").value.trim();dr.querySelectorAll(".spcb-q").forEach(i=>{st[i.dataset.k][+i.dataset.i].sl=Math.max(1,+i.value||1)})};
    dr.querySelectorAll("input[name=spcb-k],#spcb-fs,.spcb-q,#spcb-gia,#spcb-giam,#spcb-pct").forEach(i=>i.onchange=()=>{read();draw()});
    dr.querySelectorAll(".spcb-add").forEach(s=>s.onchange=()=>{if(!s.value)return;read();const L=st[s.dataset.k],f=L.find(x=>x.ma===s.value);if(f)f.sl=(+f.sl||1)+1;else L.push({ma:s.value,sl:1});draw()});
    dr.querySelectorAll("[data-spcbdel]").forEach(b=>b.onclick=()=>{read();const [k,i]=b.dataset.spcbdel.split(":");st[k].splice(+i,1);draw()});
    $("#spcb-save").onclick=()=>{read();if(!st.ten){toast("Nhập tên combo");return}if(!st.gom.length){toast("Chọn ít nhất một sản phẩm trong combo");return}if(!st.tu){toast("Chọn ngày áp dụng");return}if(st.den&&st.den<st.tu){toast("Đến ngày phải sau ngày bắt đầu");return}
      const gia=val();if(!(gia>0)){toast("Nhập giá trị combo hoặc mức giảm");return}
      const who={by:ME.name||"",byId:ME.id||"",at:new Date().toISOString()},cid=c?c.id:"n"+Date.now(),pid="ph"+Date.now();
      const d0={nhom:st.ten,gom:st.gom.filter(x=>x.ma),tang:st.tang.filter(x=>x.ma),gia,ship:st.fs?0:st.ship,tu:st.tu,den:st.den,ghi:st.ghi,landings:st.land?[st.land]:[],landing:st.land||"",page:c?c.page||"":"",nguoi:c?c.nguoi||ME.name||"":ME.name||""};
      d0.combo=spcCompText(d0.gom,1);d0.qua=spcCompText(d0.tang,1);
      spcEdit((c?"sửa":"tạo")+" combo "+st.ten,cc=>{if(!Array.isArray(cc.phieu))cc.phieu=[];let x;
        if(c){x=cc.combos.find(y=>y.id===c.id);if(!x)return;Object.assign(x,d0,{tt:"cho",sua:who,phieu:pid});delete x.traLai}else{x=Object.assign({id:cid},d0,{tt:"cho",tao:who,phieu:pid},SPC.bpView==="CSKH"?{bp:"CSKH"}:{});cc.combos.unshift(x)}
        cc.phieu.unshift(Object.assign({id:pid,ten:(c?"Sửa combo ":"Combo mới ")+st.ten,ghi:"",by:who.by,byId:who.byId,at:who.at,tt:"cho",items:[{loai:"moi",id:x.id,ten:spcDesc(x),gia,ngay:st.tu}]},SPC.bpView==="CSKH"?{bp:"CSKH"}:{}))});
      closeDrawer();toast("Đã lưu, chờ kế toán duyệt combo "+st.ten)}};
  draw();
}
/* Combo đang có trên Pancake (chỉ đọc) + đưa một combo về web */
function spcfPkMa(it,V){const ids=new Set(((SPCB.pk&&SPCB.pk.rows)||[]).filter(r=>it.pid&&r.pid===it.pid).map(r=>r.id));
  const v=V.find(y=>y.pkId&&ids.has(y.pkId))||V.find(y=>spcLow(y.ma)===spcLow(it.code))||V.find(y=>it.name&&spcLow(y.ten).startsWith(spcLow(it.name)));return v?v.ma:""}
async function spcfPkCbLoad(){SPCF.pkcbBusy=true;renderMain();if(!SPCB.pk&&typeof spbPkLoad==="function")try{await spbPkLoad()}catch(e){}try{SPCF.pkcb=await spcApi("/pancake-combos?channel=FACEBOOK");SPCF.pkcbErr=""}catch(e){SPCF.pkcbErr=e.message}SPCF.pkcbBusy=false;renderMain()}
function spcfPkCbView(ed){
  if(SPCF.pkcbErr)return `<div class="note red">Chưa đọc được combo Pancake: ${esc(SPCF.pkcbErr)}</div>`;
  const P=SPCF.pkcb;if(!P)return "";const V=spcfVars(),has=new Set(spcCombos().map(c=>spcLow(c.nhom)));
  return `<section class="card flush"><div class="card-h pad"><h2>Combo trên Pancake <small class="hint">${nf(P.count)} combo · chỉ đọc</small></h2></div>
   ${tbl(["Bật","Tên combo trên Pancake","Gồm","Freeship","Giá trị","Trên web",""],P.rows.map((x,i)=>{const miss=x.items.filter(it=>!spcfPkMa(it,V));
     return `<tr${x.on?"":' class="mut"'}><td>${x.on?"✓":""}</td><td><b>${esc(x.name)}</b></td><td><small>${esc(x.items.map(it=>it.qty+" × "+(it.name||it.code)).join(" + "))}</small></td><td>${x.free_ship?"✓":""}</td><td class="n">${x.value!=null?nf(x.value):"giảm "+esc(String(x.discount))}</td>
       <td>${has.has(spcLow(x.name))?pill("đã có","grn"):miss.length?`<small class="hint">thiếu SP: ${esc(miss.map(it=>it.name||it.code).join(", "))}</small>`:"—"}</td><td>${ed&&!has.has(spcLow(x.name))&&!miss.length&&x.value?`<button class="btn sm" data-spcfpkimp="${i}">Đưa về web</button>`:""}</td></tr>`}))}</section>`;
}
/* TikTok / Shopee: combo trên sàn (bảng quy đổi) + khai combo mới để kế toán quy đổi */
function spcfSanView(CH){
  spcLoad();
  const P=spcfList("ttCombo").filter(x=>x.tt!=="xong"&&(x.ch||"TIKTOK")===CH).slice().reverse(),ed=spcfChs(ME).some(c=>c[0]===SPCF.ch);
  const nm=p=>p.qty+" × "+((SPCB.items&&SPCB.items.get(spcLow(p.code))||{}).name||p.label);
  const fold=typeof kfold==="function"?kfold:spcLow,q=fold(SPCF.q||"").trim();
  const L=SPCB.rows?spcGroup(SPCB.rows.filter(r=>r.channel===CH),SPCB.sales,spcToday()).filter(c=>c.active&&(!q||fold(c.sku+" "+c.variant+" "+c.parts.map(p=>p.label).join(" ")).includes(q))).sort((a,b)=>b.orders-a.orders):null;
  return `<section class="card"><div class="card-h"><h2>Combo mới đã khai, chờ kế toán quy đổi</h2>${ed?`<button class="btn pri" data-spcftt="1">+ Khai combo mới</button>`:""}</div>
   <p class="hint">Lên combo mới trên ${CH==="TIKTOK"?"TikTok":"Shopee"} thì khai ở đây: mã trên sàn, gồm sản phẩm nào, quà gì. Kế toán khai vào bảng quy đổi (để trừ kho, tính giá vốn) rồi combo chuyển xuống danh sách bên dưới. Giá bán nằm trên sàn.</p>
   ${tbl(["Mã trên sàn","Gồm","Quà","Người khai","Trạng thái"],P.map(x=>`<tr><td><b class="mono">${esc(x.sku)}</b>${x.variant?`<br><small class="hint">${esc(x.variant)}</small>`:""}</td><td>${esc(x.gom)}</td><td class="hint">${esc(x.qua||"")}</td><td class="hint">${esc(x.by||"")}<br>${esc(typeof spcAt==="function"?spcAt(x.at):"")}</td><td>${pill("chờ kế toán quy đổi","amb")}</td></tr>`))}</section>
   <section class="card flush"><div class="card-h pad"><div class="filters"><input id="spcf-q" placeholder="Tìm mã sàn, sản phẩm…" value="${esc(SPCF.q)}" style="max-width:260px"><span class="hint">${L?nf(L.length)+" combo đang dùng":"Đang tải…"}</span></div></div>
   ${L?tbl(["Mã trên sàn","Gồm","Quà","Đơn"],L.slice(0,300).map(c=>`<tr><td><b class="mono">${esc(c.sku)}</b>${c.variant?`<br><small class="hint">${esc(c.variant)}</small>`:""}</td><td><small>${esc(c.parts.filter(p=>p.kind==="sp").map(nm).join(" + "))}</small></td><td><small>${esc(c.parts.filter(p=>p.kind==="gift").map(nm).join(" + "))}</small></td><td class="n">${c.orders||""}</td></tr>`)):""}</section>`;
}
function spcfTtForm(){const CH=SPCF.ch==="sp"?"SHOPEE":"TIKTOK";
  openDrawerHTML(`<h2>Khai combo mới · ${CH==="TIKTOK"?"TikTok":"Shopee"}</h2>
   <div class="filters"><label class="inl">Mã trên sàn (SKU) * <input id="tt-sku"></label><label class="inl">Phân loại <input id="tt-vr" placeholder="nếu có"></label></div>
   <div class="filters"><label class="inl" style="flex:1">Gồm * <input id="tt-gom" style="width:100%" placeholder="ví dụ: 2 Tẩy lồng Ailla 300g + 1 Tẩy mốc gioăng"></label></div>
   <div class="filters"><label class="inl" style="flex:1">Quà tặng <input id="tt-qua" style="width:100%"></label></div><div class="filters"><label class="inl" style="flex:1">Ghi chú <input id="tt-ghi" style="width:100%" placeholder="áp dụng từ ngày, chương trình…"></label></div>
   <div class="filters" style="margin-top:12px"><button class="btn pri" id="tt-go">Gửi kế toán</button></div>`);
  $("#tt-go").onclick=()=>{const sku=$("#tt-sku").value.trim(),gom=$("#tt-gom").value.trim();if(!sku||!gom){toast("Cần mã trên sàn và gồm sản phẩm nào");return}
    const x={id:"tt"+Date.now(),ch:CH,sku,variant:$("#tt-vr").value.trim(),gom,qua:$("#tt-qua").value.trim(),ghi:$("#tt-ghi").value.trim(),by:ME.name||"",byId:ME.id||"",at:new Date().toISOString(),tt:"cho"};
    DB.mutate(ME.name,"khai combo "+sku,d=>{d.ttCombo=Array.isArray(d.ttCombo)?d.ttCombo:[];d.ttCombo.push(x)});closeDrawer();toast("Đã gửi kế toán khai combo "+sku);renderMain()}}
/* Kế toán khai xong (lưu combo ở Sản phẩm & combo) thì đánh dấu đề xuất là xong. */
function spcfTtDone(id){DB.mutate(ME.name,"đã khai combo sàn",d=>{const x=(d.ttCombo||[]).find(y=>y.id===id);if(x){x.tt="xong";x.xong={by:ME.name||"",at:new Date().toISOString()}}})}
/* Mở ô khai combo của kế toán, điền sẵn theo đề xuất (từ trang Phê duyệt). */
async function spcfTtOpen(id){const x=spcfList("ttCombo").find(y=>y.id===id);if(!x)return;SPCB.at=0;await spcLoad(true);
  spcbEdit(null,{channel:x.ch||"TIKTOK",sku:x.sku,variant:x.variant||"",shops:[],orders:0,ttId:x.id,name:"Team khai: "+[x.gom,x.qua?"tặng "+x.qua:"",x.ghi].filter(Boolean).join(" · "),ttNote:[x.gom,x.qua?"tặng "+x.qua:"",x.ghi].filter(Boolean).join(" · ")})}

/* ---------- Kênh phân phối: sản phẩm + bảng giá 8 cấp (chỉ xem) ---------- */
async function spcfB2bLoad(){if(SPCF.b2bBusy)return;SPCF.b2bBusy=true;try{SPCF.b2b=await svApi("/api/prices?limit=1000")}catch(e){SPCF.b2b={err:e.message}}SPCF.b2bBusy=false;if(/^sp_/.test(PAGE))renderMain()}
function spcfB2bView(){
  if(!SPCF.b2b){spcfB2bLoad();return `<p class="hint pad">Đang tải…</p>`}
  if(SPCF.b2b.err)return `<div class="note red">${esc(SPCF.b2b.err)}</div>`;
  const T=SPCF.b2b.tiers||[],fold=typeof kfold==="function"?kfold:spcLow,q=fold(SPCF.q||"").trim();
  const L=(SPCF.b2b.products||[]).filter(p=>!q||fold(p.sku+" "+p.name).includes(q));
  return `<section class="card flush"><div class="card-h pad"><div class="filters"><input id="spcf-q" placeholder="Tìm mã, tên…" value="${esc(SPCF.q)}" style="max-width:240px"><span class="hint">${nf(L.length)} sản phẩm · bảng giá 8 cấp, chỉ xem · sửa giá ở Bảng giá (quản lý)</span></div></div>
   ${tbl(["Mã","Sản phẩm","ĐVT"].concat(T.map(t=>t.name)),L.slice(0,300).map(p=>`<tr><td class="mono">${esc(p.sku)}</td><td>${esc(p.name)}</td><td>${esc(p.unit||"")}</td>${T.map(t=>`<td class="n">${p.prices&&p.prices[t.code]!=null?nf(p.prices[t.code]):"—"}</td>`).join("")}</tr>`))}
   ${L.length>300?`<p class="hint pad">Hiện 300 / ${nf(L.length)}. Gõ để thu hẹp.</p>`:""}</section>`;
}

/* ============================== KHUYẾN MÃI ============================== */
/* 6 loại như Poscake. cfg theo loại:
   sl {ma, tiers:[{tu,den,pct}]} · gt {tiers:[{tu,pct|amt}]} · dg {mas:[], gia} · ch {min, pct|amt} · vc {code, pct|amt, fs, lan} · dk {ma, kem:[], pct|amt} */
const SPCF_KMT=[["sl","Giảm giá theo số lượng sản phẩm","Sản phẩm A: mua 1–2 giảm 10%, mua 3–4 giảm 20%"],["gt","Khuyến mãi theo giá trị đơn hàng","Đơn từ 500.000đ giảm 10%, từ 1.000.000đ giảm 20%"],["dg","Đồng giá","Các mã A, B, C đồng giá 99.000đ"],
  ["ch","Khuyến mãi chung","Đơn từ 500.000đ giảm 100.000đ hoặc giảm 10%"],["vc","Mã khuyến mãi (voucher)","Khách nhập mã KHACHCU giảm 10%, miễn phí vận chuyển"],["dk","Sản phẩm đính kèm","Mua A kèm B hoặc C thì A được giảm giá"]];
const SPCF_KT={cho:["Chờ kế toán duyệt","amb"],ok:["Đã duyệt","grn"],tralai:["Bị trả lại","red"]};
const spcfKmCho=()=>{const n=spcfList("kmCat").filter(k=>k.tt==="cho").length;return n?` <b class="pdn">${n}</b>`:""};
const spcfKmName=t=>(SPCF_KMT.find(x=>x[0]===t)||["","Khuyến mãi"])[1];
const spcfKmSt=k=>{const t=spcfToday();return k.tt==="ok"?(k.den&&k.den<t?["Đã hết","gry"]:k.tu&&k.tu>t?["Sắp chạy","blu"]:["Đang chạy","grn"]):SPCF_KT[k.tt]||["?","gry"]};
function pSpcfKm(m){
  const ch=spcfCh();if(!ch){spcfNoAccess(m,"Khuyến mãi");return}
  const dy=spcfCanDuyet(),all=spcfAll(ME),T=SPCF.kmT;
  const L0=spcfList("kmCat").filter(k=>k.bp===ch),L=L0.filter(k=>T==="all"||(k.t||"ch")===T).slice().sort((a,b)=>String(b.at||"").localeCompare(String(a.at||"")));
  const canAdd=spcfMyBp(ME).includes(ch);
  const tabs=`<div class="filters">${[["all","Tất cả"]].concat(SPCF_KMT.map(x=>[x[0],x[1]])).map(([k,t])=>`<button class="btn sm${T===k?" pri":""}" data-spcfkt="${k}">${t} ${L0.filter(x=>k==="all"||(x.t||"ch")===k).length}</button>`).join("")}</div>`;
  const rows=L.map(k=>{const s=spcfKmSt(k);return `<tr><td>${pill(s[0],s[1])}${k.tt==="tralai"&&k.ly?`<br><small class="t-red">${esc(k.ly)}</small>`:""}</td><td><b>${esc(k.ten)}</b>${k.ghi?`<br><small class="hint">${esc(k.ghi)}</small>`:""}</td><td>${esc(spcfKmName(k.t||"ch"))}</td><td><small>${esc(k.ap||"")}</small></td>
    <td class="hint">${spcfVN(k.tu)}${k.den?" → "+spcfVN(k.den):""}</td><td class="hint">${esc(k.by||"")}</td>
    <td style="white-space:nowrap">${dy&&k.tt==="cho"?`<button class="btn sm pri" data-spcfkmok="${esc(k.id)}">Duyệt</button> <button class="btn sm" data-spcfkmno="${esc(k.id)}">Trả lại</button>`:""}${k.byId===ME.id&&k.tt!=="ok"?` <button class="btn sm" data-spcfkmdel="${esc(k.id)}">Xóa</button>`:""}</td></tr>`}).join("");
  spcfFrame(m,"Khuyến mãi","Khuyến mãi từng kênh · kế toán duyệt rồi mới áp dụng · khi tạo đơn web tự tính mức giảm",
    `<section class="card flush"><div class="card-h pad">${tabs}${canAdd?`<button class="btn pri" data-spcfkmnew="1">+ Tạo khuyến mãi</button>`:""}</div>
     ${tbl(["Trạng thái","Khuyến mãi","Loại","Áp dụng","Thời gian hiệu lực","Người tạo",""],[rows])}${all||dy?"":`<p class="hint pad">Bạn chỉ thấy khuyến mãi của kênh mình.</p>`}</section>`);
}
function spcfKmPick(){openDrawerHTML(`<h2>Khuyến mãi mới · ${esc(SPCF_BP[SPCF.ch])}</h2><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px">${SPCF_KMT.map(x=>`<section class="card" style="margin:0"><b>${x[1]}</b><p class="hint">${x[2]}</p><button class="btn pri sm" data-spcfkmt="${x[0]}">Tạo mới</button></section>`).join("")}</div>`);
  $("#drawerIn").querySelectorAll("[data-spcfkmt]").forEach(b=>b.onclick=()=>spcfKmForm(b.dataset.spcfkmt))}
function spcfKmForm(t){
  const V=SPCF.ch==="ads"||SPCF.ch==="cskh"?spcfVars().filter(v=>v.on):[],vOpts=sel=>V.map(v=>`<option value="${esc(v.ma)}" ${sel&&sel.includes(v.ma)?"selected":""}>${esc(v.ma+" · "+v.ten)}</option>`).join("");
  const st={tiers:t==="sl"?[{tu:1,den:2,pct:10},{tu:3,den:"",pct:20}]:t==="gt"?[{tu:500000,pct:10},{tu:1000000,pct:20}]:[]};
  const pick=(id,multi)=>V.length?`<select id="${id}" ${multi?"multiple size=6":""} style="min-width:280px">${multi?"":`<option value="">Chọn sản phẩm…</option>`}${vOpts()}</select>`:`<input id="${id}" placeholder="Mã sản phẩm${multi?", cách nhau dấu phẩy":""}" style="min-width:280px">`;
  const val=(id,multi)=>{const e=$("#"+id);if(!e)return multi?[]:"";if(e.tagName==="SELECT")return multi?[...e.selectedOptions].map(o=>o.value):e.value;const s=e.value.trim();return multi?s.split(",").map(x=>x.trim()).filter(Boolean):s};
  const amt=(id)=>`<input id="${id}" inputmode="numeric" style="width:110px"><select id="${id}-u">${opt([["p","%"],["d","đ"]],"p")}</select>`;
  const draw=()=>{const tr=st.tiers.map((x,i)=>t==="sl"?`<tr><td><input class="km-a" data-i="${i}" type="number" min="1" value="${x.tu}" style="width:70px"></td><td><input class="km-b" data-i="${i}" type="number" min="1" value="${x.den}" placeholder="trở lên" style="width:80px"></td><td><input class="km-p" data-i="${i}" type="number" min="0" max="100" value="${x.pct}" style="width:70px"> %</td></tr>`
      :`<tr><td><input class="km-a" data-i="${i}" inputmode="numeric" value="${x.tu}" style="width:130px"> đ</td><td><input class="km-p" data-i="${i}" type="number" min="0" max="100" value="${x.pct}" style="width:70px"> %</td></tr>`).join("");
    const body=t==="sl"?`<div class="filters"><label class="inl">Sản phẩm ${pick("km-ma")}</label></div>${tbl(["Mua từ","Đến","Giảm"],[tr])}<button class="btn sm" id="km-tadd">+ Thêm mức</button>`
      :t==="gt"?`${tbl(["Đơn hàng từ","Giảm"],[tr])}<button class="btn sm" id="km-tadd">+ Thêm mức</button>`
      :t==="dg"?`<div class="filters"><label class="inl">Các mã đồng giá ${pick("km-mas",true)}</label></div><div class="filters"><label class="inl">Giá đồng giá (đ) <input id="km-gia" inputmode="numeric" style="width:130px"></label></div>`
      :t==="vc"?`<div class="filters"><label class="inl">Mã voucher <input id="km-code" style="width:150px;text-transform:uppercase"></label><label class="inl">Giảm ${amt("km-amt")}</label><label class="inl"><input type="checkbox" id="km-fs" style="width:auto"> Miễn phí vận chuyển</label><label class="inl">Số lần dùng tối đa <input id="km-lan" type="number" min="0" value="0" style="width:80px"></label></div>`
      :t==="dk"?`<div class="filters"><label class="inl">Sản phẩm chính (A) ${pick("km-ma")}</label></div><div class="filters"><label class="inl">Đi kèm (B, C…) ${pick("km-kem",true)}</label></div><div class="filters"><label class="inl">A được giảm ${amt("km-amt")}</label></div>`
      :`<div class="filters"><label class="inl">Đơn hàng từ (đ) <input id="km-min" inputmode="numeric" style="width:130px"></label><label class="inl">Giảm ${amt("km-amt")}</label></div>`;
    openDrawerHTML(`<h2>${esc(spcfKmName(t))} · ${esc(SPCF_BP[SPCF.ch])}</h2>
     <div class="filters"><label class="inl" style="flex:1">Tên khuyến mãi * <input id="km-ten" style="width:100%" placeholder="Ví dụ: Sale 11/11"></label></div>
     <div class="filters"><label class="inl">Hiệu lực từ * <input type="date" id="km-tu" value="${spcfToday()}"></label><label class="inl">đến <input type="date" id="km-den"></label></div>
     <h3 style="margin:14px 0 6px">Điều kiện</h3>${body}
     <div class="filters" style="margin-top:8px"><label class="inl" style="flex:1">Ghi chú <input id="km-ghi" style="width:100%"></label></div>
     <div class="filters" style="margin-top:14px"><button class="btn pri" id="km-save">Lưu và gửi kế toán duyệt</button></div>`);
    const dr=$("#drawerIn"),rd=()=>{dr.querySelectorAll(".km-a").forEach(i=>{st.tiers[+i.dataset.i].tu=t==="gt"?spcfNum(i.value):+i.value||1});dr.querySelectorAll(".km-b").forEach(i=>{st.tiers[+i.dataset.i].den=i.value===""?"":+i.value});dr.querySelectorAll(".km-p").forEach(i=>{st.tiers[+i.dataset.i].pct=+i.value||0})};
    if($("#km-tadd"))$("#km-tadd").onclick=()=>{rd();st.tiers.push(t==="sl"?{tu:1,den:"",pct:0}:{tu:0,pct:0});draw()};
    $("#km-save").onclick=()=>{rd();const ten=$("#km-ten").value.trim(),tu=$("#km-tu").value,den=$("#km-den").value;if(!ten){toast("Nhập tên khuyến mãi");return}if(!tu){toast("Chọn ngày bắt đầu");return}if(den&&den<tu){toast("Đến ngày phải sau ngày bắt đầu");return}
      const am=()=>{const n=spcfNum(($("#km-amt")||{}).value);return ($("#km-amt-u")||{}).value==="d"?{amt:n}:{pct:n}};let cfg={},ap="";
      if(t==="sl"){cfg={ma:val("km-ma"),tiers:st.tiers};if(!cfg.ma){toast("Chọn sản phẩm");return}ap=cfg.ma+": "+st.tiers.map(x=>`mua ${x.tu}${x.den?"–"+x.den:"+"} giảm ${x.pct}%`).join(", ")}
      else if(t==="gt"){cfg={tiers:st.tiers.filter(x=>x.tu>0)};ap=cfg.tiers.map(x=>`đơn từ ${nf(x.tu)}đ giảm ${x.pct}%`).join(", ")}
      else if(t==="dg"){cfg={mas:val("km-mas",true),gia:spcfNum($("#km-gia").value)};if(!cfg.mas.length||!cfg.gia){toast("Chọn mã và giá đồng giá");return}ap=cfg.mas.join(", ")+" đồng giá "+nf(cfg.gia)+"đ"}
      else if(t==="vc"){cfg=Object.assign({code:$("#km-code").value.trim().toUpperCase(),fs:$("#km-fs").checked,lan:+$("#km-lan").value||0},am());if(!cfg.code){toast("Nhập mã voucher");return}ap="mã "+cfg.code+" giảm "+(cfg.amt?nf(cfg.amt)+"đ":cfg.pct+"%")+(cfg.fs?", miễn phí vận chuyển":"")}
      else if(t==="dk"){cfg=Object.assign({ma:val("km-ma"),kem:val("km-kem",true)},am());if(!cfg.ma||!cfg.kem.length){toast("Chọn sản phẩm chính và sản phẩm đi kèm");return}ap=cfg.ma+" kèm "+cfg.kem.join("/")+" giảm "+(cfg.amt?nf(cfg.amt)+"đ":cfg.pct+"%")}
      else{cfg=Object.assign({min:spcfNum($("#km-min").value)},am());ap="đơn từ "+nf(cfg.min)+"đ giảm "+(cfg.amt?nf(cfg.amt)+"đ":cfg.pct+"%")}
      const k={id:"km"+Date.now(),bp:SPCF.ch,t,ten,tu,den,cfg,ap,gia:t==="dg"?cfg.gia:0,ghi:$("#km-ghi").value.trim(),by:ME.name||"",byId:ME.id||"",at:new Date().toISOString(),tt:"cho"};
      DB.mutate(ME.name,"thêm khuyến mãi "+ten,d=>{d.kmCat=Array.isArray(d.kmCat)?d.kmCat:[];d.kmCat.push(k)});closeDrawer();toast("Đã gửi kế toán duyệt khuyến mãi");renderMain()}};
  draw();
}
function spcfKmDuyet(id,ok,ly){if(!spcfCanDuyet())return;DB.mutate(ME.name,(ok?"duyệt":"trả lại")+" khuyến mãi",d=>{const k=(d.kmCat||[]).find(x=>x.id===id);if(!k||k.tt!=="cho")return;k.tt=ok?"ok":"tralai";k.duyet={by:ME.name||"",at:new Date().toISOString()};if(ly)k.ly=ly;
  try{if(typeof notifyU==="function")notifyU(d,[k.byId],ok?`Kế toán đã duyệt khuyến mãi “${k.ten}”`:`Khuyến mãi “${k.ten}” bị trả lại: ${ly||""}`,"page:sp_km")}catch(e){}});toast(ok?"Đã duyệt khuyến mãi":"Đã trả lại");renderMain()}

function spcfBind(m){
  const q=$("#spcf-q");if(q)q.oninput=()=>{SPCF.q=q.value;const p=q.selectionStart;renderMain();const x=$("#spcf-q");if(x){x.focus();x.setSelectionRange(p,p)}};
  const on=(sel,f)=>m.querySelectorAll(sel).forEach(b=>b.onclick=()=>f(b));
  on("[data-spcfop]",b=>{SPCF.open[b.dataset.spcfop]=!SPCF.open[b.dataset.spcfop];renderMain()});
  m.querySelectorAll("[data-spcfon]").forEach(x=>x.onchange=()=>{const id=x.dataset.spcfon,v=x.checked;spcEdit((v?"bật":"tắt")+" bán sản phẩm",c=>{const p=c.sp.find(y=>y.id===id);if(p){(p.bt||[]).forEach(b=>b.on=v);if(v&&p.loai==="off")p.loai="run"}})});
  on("[data-spcfpe]",b=>spcfProdForm(b.dataset.spcfpe||null));
  on("[data-spcfpk]",()=>{SPCF.pkOpen=!SPCF.pkOpen;if(SPCF.pkOpen&&!SPCB.pk)spbPkLoad();renderMain()});
  on("[data-spcfce]",b=>spcfComboForm(b.dataset.spcfce||null));
  on("[data-spcfpkcb]",()=>spcfPkCbLoad());
  on("[data-spcfpkimp]",b=>{const x=SPCF.pkcb.rows[+b.dataset.spcfpkimp],V=spcfVars();spcfComboForm(null,{ten:x.name,gia:x.value,fs:x.free_ship,gom:x.items.map(it=>({ma:spcfPkMa(it,V)||it.code,sl:it.qty}))})});
  on("[data-spcftt]",()=>spcfTtForm());
  on("[data-spcfkt]",b=>{SPCF.kmT=b.dataset.spcfkt;renderMain()});
  on("[data-spcfkmnew]",()=>spcfKmPick());
  on("[data-spcfkmok]",b=>{if(confirm("Duyệt khuyến mãi này?"))spcfKmDuyet(b.dataset.spcfkmok,true)});
  on("[data-spcfkmno]",b=>{const ly=prompt("Lý do trả lại:");if(ly)spcfKmDuyet(b.dataset.spcfkmno,false,ly)});
  on("[data-spcfkmdel]",b=>{if(!confirm("Xóa khuyến mãi này?"))return;DB.mutate(ME.name,"xóa khuyến mãi",d=>{d.kmCat=(d.kmCat||[]).filter(x=>!(x.id===b.dataset.spcfkmdel&&x.byId===ME.id&&x.tt!=="ok"))});renderMain()});
}
/* Phê duyệt (pdcalc.js): khuyến mãi chờ duyệt + combo sàn chờ kế toán khai */
function spcfPdSrc(d){return {kmCho:((d&&d.kmCat)||[]).filter(k=>k.tt==="cho"),ttCho:((d&&d.ttCombo)||[]).filter(x=>x.tt==="cho")}}

/* ---------- CSKH tạo đơn (cskh.js csDonForm) dùng danh mục CSKH ----------
   Ô tìm sản phẩm: combo CSKH đang chạy → sản phẩm CSKH (giá CSKH) → mọi sản phẩm Pancake còn lại.
   Chọn combo: thêm từng món theo giá CSKH (quà giá 0), phần chênh với giá combo cộng vào ô Giảm giá. */
const spcfCk=()=>{try{return D().cskhCat||{}}catch(e){return {}}};
function spcfDonList(list){
  const ck=spcfCk(),byId=new Map((list||[]).map(x=>[x.id,x])),t=spcfToday(),mine=[];
  (ck.sp||[]).forEach(p=>(p.bt||[]).forEach(v=>{if(v.on===false||p.loai==="off")return;const pv=v.pkId&&byId.get(v.pkId);mine.push({id:pv?pv.id:(v.pkId||""),name:pv?pv.name:p.ten,price:v.gia||(pv?pv.price:0),cskh:true,ma:v.ma})}));
  const ids=new Set(mine.map(x=>x.id));
  const combos=(ck.combos||[]).filter(c=>(c.tt||"ok")==="ok"&&!(c.den&&c.den<t)&&!(c.tu&&c.tu>t)).map(c=>({combo:c,name:"Combo CSKH: "+(c.nhom||"")+(c.combo?" · "+c.combo:""),price:+c.gia||0,id:"combo"}));
  return combos.concat(mine,(list||[]).filter(x=>!ids.has(x.id)));
}
function spcfDonCombo(c,list){
  const ck=spcfCk(),byId=new Map((list||[]).map(x=>[x.id,x])),items=[];let sum=0;
  const vOf=ma=>{for(const p of (ck.sp||[]))for(const v of (p.bt||[]))if(v.ma===ma)return {p,v};return null};
  const add=(x,gift)=>{const lk=x.ma?vOf(x.ma):null,pv=lk&&lk.v.pkId?byId.get(lk.v.pkId):null,price=gift?0:(lk&&lk.v.gia)||(pv?pv.price:0),q=+x.sl||1;
    items.push({n:pv?pv.name:(lk?lk.p.ten:(x.ten||x.ma||"")),vid:pv?pv.id:"",q,price});sum+=q*price};
  (c.gom||[]).forEach(x=>add(x,false));(c.tang||[]).forEach(x=>add(x,true));
  return {items,disc:Math.max(0,sum-(+c.gia||0))};
}
/* Khuyến mãi CSKH đang chạy áp vào đơn: tính mức giảm theo từng loại (đồng giá, theo số lượng, theo giá trị đơn, chung, voucher, đính kèm).
   items: [{vid, q, price}] của ô tạo đơn; trả [{k, giam, ly}] khuyến mãi khớp đơn. */
function spcfDonKmCalc(items,code){
  const t=spcfToday(),ck=spcfCk(),maOf=vid=>{for(const p of (ck.sp||[]))for(const v of (p.bt||[]))if(v.pkId&&v.pkId===vid)return v.ma;return ""};
  const L=spcfList("kmCat").filter(k=>k.bp==="cskh"&&k.tt==="ok"&&!(k.tu&&k.tu>t)&&!(k.den&&k.den<t));
  const its=(items||[]).map(i=>({...i,ma:maOf(i.vid)})),sub=its.reduce((a,i)=>a+i.q*i.price,0),out=[];
  const off=(c,base)=>c.amt?Math.min(base,c.amt):Math.round(base*(+c.pct||0)/100);
  L.forEach(k=>{const c=k.cfg||{};let g=0;
    if(k.t==="dg")its.filter(i=>(c.mas||[]).includes(i.ma)&&i.price>c.gia).forEach(i=>{g+=i.q*(i.price-c.gia)});
    else if(k.t==="sl"){const ln=its.filter(i=>i.ma===c.ma),q=ln.reduce((a,i)=>a+i.q,0),tr=(c.tiers||[]).filter(x=>q>=x.tu&&(x.den===""||x.den==null||q<=x.den)).pop();if(tr)ln.forEach(i=>{g+=Math.round(i.q*i.price*tr.pct/100)})}
    else if(k.t==="gt"){const tr=(c.tiers||[]).filter(x=>sub>=x.tu).sort((a,b)=>b.tu-a.tu)[0];if(tr)g=Math.round(sub*tr.pct/100)}
    else if(k.t==="ch"){if(sub>=(c.min||0)&&sub>0)g=off(c,sub)}
    else if(k.t==="vc"){if(code&&String(code).trim().toUpperCase()===c.code)g=off(c,sub)}
    else if(k.t==="dk"){const a=its.filter(i=>i.ma===c.ma);if(a.length&&its.some(i=>(c.kem||[]).includes(i.ma)))a.forEach(i=>{g+=off(c,i.q*i.price)})}
    if(g>0)out.push({k,giam:g})});
  return out;
}
/* Ô nhắc trong ô tạo đơn CSKH: khuyến mãi đang chạy + nút áp mức giảm vào ô Giảm giá */
function spcfDonKm(st){const t=spcfToday(),L=spcfList("kmCat").filter(k=>k.bp==="cskh"&&k.tt==="ok"&&!(k.tu&&k.tu>t)&&!(k.den&&k.den<t));if(!L.length)return "";
  const hit=st?spcfDonKmCalc(st.items,st.voucher):[],done=(st&&st.kmDone)||{};
  return `<div class="note" style="margin-top:8px"><b>Khuyến mãi CSKH đang chạy:</b> ${L.map(k=>esc(k.ten)+" ("+esc(k.ap||"")+")").join("; ")}
   ${hit.length?`<div style="margin-top:6px">${hit.map(h=>done[h.k.id]?`<span class="pill p-grn">đã áp ${esc(h.k.ten)} −${nf(h.giam)} đ</span>`:`<button class="btn sm pri" data-kmap="${esc(h.k.id)}" data-kmg="${h.giam}">Áp ${esc(h.k.ten)} −${nf(h.giam)} đ</button>`).join(" ")}</div>`:""}
   ${L.some(k=>k.t==="vc")?`<div class="filters" style="margin-top:6px"><input id="cd-vc" placeholder="Mã voucher khách đưa" value="${esc((st&&st.voucher)||"")}" style="max-width:200px"></div>`:""}</div>`}

PAGES.sp_cfg=pSpcfSp;PAGES.sp_cb=pSpcfCb;PAGES.sp_km=pSpcfKm;
/* Trang cũ dồn về đây */
PAGES.dg_sp=m=>{SPCF.ch="ads";pSpcfSp(m)};
PAGES.kd_combo=m=>{SPCF.ch="cskh";pSpcfCb(m)};
MODULES.push({k:"spcf",zone:"Vận hành",ic:"gear",n:"Sản phẩm",sub:"",groups:()=>[["",[MI("sp_cfg","Sản phẩm",u=>spcfChs(u).length>0),MI("sp_cb","Combo",u=>spcfChs(u).length>0),MI("sp_km","Khuyến mãi",u=>spcfChs(u).length>0,()=>spcfCanDuyet()?spcfList("kmCat").filter(k=>k.tt==="cho").length||"":"")]]]});
