/* =====================================================================
   SẢN PHẨM ĐANG CHẠY + COMBO VÀ GIÁ (Facebook › Sản phẩm)
   - Chỉ một số sản phẩm đang chạy quảng cáo; quà tặng (nồi điện, body mist, chổi...) không tính vào hiệu quả.
   - Mỗi combo có landing, page, người test, giá, ship, quà, ngày áp dụng; combo nào chạy khi nào thì nhập lên đây.
   - Số liệu mặc định lấy từ Sheet "BẢNG GIÁ SP FACEBOOK" (24/10/2026); sửa trên web thì lưu vào d.fbCat.
   ===================================================================== */
const SPC={who:"",land:"",st:"",only:true};
const SPC_RUN="run",SPC_GIFT="gift",SPC_OFF="off";
const SPC_LBL={run:"Đang chạy",gift:"Quà tặng",off:"Không chạy"};
const SPC_DEF_CLS={TLG125:"run",TLG:"run",TM:"run",M300:"run",XM530ML:"run",R300:"run",XR:"run",TDST:"run",TDSH:"run",TDSX:"run",BTVN250:"run",LSCD5KG:"run",LSCD2KG:"run",ND:"gift",BD100:"gift",C:"gift",TOILET500:"gift"};
const SPC_L="https://www.giadungailla.online/";
const SPC_DEF_COMBOS=[
 ["Tẩy lồng Ailla + Tẩy mốc gioăng",SPC_L+"tay-long-giat-ailla","1 Lồng + 1 Mốc gioăng","1 Chổi quét",0,145000],
 ["Tẩy lồng Ailla + Tẩy mốc gioăng",SPC_L+"tay-long-giat-ailla","2 Lồng + 1 Mốc gioăng","1 Chổi quét + 1 Tinh dầu tím",0,205000],
 ["Tẩy lồng Ailla + Tẩy mốc gioăng",SPC_L+"tay-long-giat-ailla","2 Lồng + 2 Mốc gioăng","2 Chổi quét + 1 Nồi điện mini",0,269000],
 ["Tẩy lồng Ailla + Tẩy mốc gioăng",SPC_L+"tay-long-giat-ailla","2 Lồng + 2 Mốc gioăng","2 Chổi quét + 1 Tinh dầu tím",0,269000],
 ["Xịt muỗi Aibio",SPC_L+"xitmuoithongminhabio","Chai 300ML: 1 chai Xịt muỗi nhỏ","Chai 300ML: 1 chai Xịt muỗi nhỏ",0,169000],
 ["Xịt muỗi Aibio",SPC_L+"xitmuoithongminhabio","Chai 300ML: 1 chai Xịt muỗi nhỏ","1 Chai Nước lau sàn chuyên dụng Sả chanh 1L",0,169000],
 ["Xịt muỗi Aibio",SPC_L+"xitmuoithongminhabio","Chai 300ML: 2 chai Xịt muỗi nhỏ","Chai 300ML: 2 chai Xịt muỗi nhỏ",0,260000],
 ["Xịt muỗi Aibio",SPC_L+"xitmuoithongminhabio","Chai 300ML: 3 chai Xịt muỗi nhỏ","Chai 300ML: 3 chai Xịt muỗi nhỏ",0,359000],
 ["Xịt muỗi Aibio",SPC_L+"xitmuoithongminhabio","Chai 530ML: 2 chai Xịt muỗi to","",0,240000],
 ["Xịt ruồi Aibio",SPC_L+"binh-xit-aibio","Chai 300ML: 1 chai Xịt ruồi nhỏ","Chai 300ML: 1 chai Xịt ruồi nhỏ",0,169000],
 ["Xịt ruồi Aibio",SPC_L+"binh-xit-aibio","Chai 300ML: 1 chai Xịt muỗi nhỏ","1 Chai Nước lau sàn chuyên dụng Sả chanh 1L",0,169000],
 ["Xịt ruồi Aibio",SPC_L+"binh-xit-aibio","Chai 300ML: 2 chai Xịt ruồi nhỏ","Chai 300ML: 2 chai Xịt ruồi nhỏ",0,260000],
 ["Xịt ruồi Aibio",SPC_L+"binh-xit-aibio","Chai 300ML: 3 chai Xịt ruồi nhỏ","Chai 300ML: 3 chai Xịt ruồi nhỏ",0,359000],
 ["Xịt ruồi Aibio",SPC_L+"binh-xit-aibio","Chai 530ML: 2 chai Xịt ruồi to","",0,240000],
 ["Tẩy lồng Aibio",SPC_L+"aibiovesinhlonggiat","3 gói Bột tẩy lồng Aibio","",0,99000],
 ["Tẩy lồng Aibio",SPC_L+"aibiovesinhlonggiat","5 gói Bột tẩy lồng Aibio","2 gói Bột tẩy lồng Aibio",0,149000],
 ["Tẩy lồng Aibio",SPC_L+"aibiovesinhlonggiat","10 gói Bột tẩy lồng Aibio","4 gói Bột tẩy lồng Aibio",0,229000],
 ["Tinh dầu",SPC_L+"tinhdaugiatsay","1 chai Tinh dầu hồng","",20000,89000],
 ["Tinh dầu",SPC_L+"tinhdaugiatsay","2 chai Tinh dầu hồng + tím","1 chai Dung môi",0,165000,"2026-10-31","Combo ngày sale: tặng thêm 1 chai Body Mist 100ML (chạy đến hết 31/10)"],
 ["Tinh dầu",SPC_L+"tinhdaugiatsay","3 chai Tinh dầu hồng + tím + xanh dương","1 chai Dung môi + 1 gói Tẩy lồng Aibio",0,200000,"2026-10-31","Combo ngày sale: tặng thêm 1 chai Body Mist 100ML (chạy đến hết 31/10)"],
 ["Bột tẩy vạn năng",SPC_L+"bottayvannang_ailla","Lọ 250G: 1 lọ Bột tẩy vạn năng","Lọ 250G: 1 lọ Bột tẩy vạn năng",0,149000],
 ["Bột tẩy vạn năng",SPC_L+"bottayvannang_ailla","Lọ 250G: 3 lọ Bột tẩy vạn năng","Lọ 250G: 3 lọ Bột tẩy vạn năng + 2 Chổi cọ khóe",0,369000],
 ["Bột tẩy vạn năng",SPC_L+"bottayvannang_ailla","Lọ 250G: 5 lọ Bột tẩy vạn năng","Lọ 250G: 5 lọ Bột tẩy vạn năng + 1 Chổi cọ khóe + 1 Tẩy toilet 500ML",0,599000],
 ["Tẩy mốc gioăng Ailla",SPC_L+"taygioangcaosu","1 lọ Tẩy mốc gioăng cao su","1 Chổi quét + 2 gói Tẩy lồng Aibio",0,119000],
 ["Tẩy mốc gioăng Ailla",SPC_L+"taygioangcaosu","2 lọ Tẩy mốc gioăng cao su","2 Chổi quét + 6 gói Tẩy lồng Aibio",0,175000],
 ["Tẩy mốc gioăng Ailla",SPC_L+"taygioangcaosu","2 lọ Tẩy mốc gioăng cao su + 10 gói Tẩy lồng Aibio","2 Chổi quét + 1 lọ Bột tẩy vạn năng Ailla",0,239000],
 ["Nước lau sàn chuyên dụng",SPC_L+"taygioangcaosu","1 can 5KG","",0,205000,"","Link landing trong Sheet trùng với Tẩy mốc gioăng, cần kiểm tra lại"],
 ["Nước lau sàn chuyên dụng",SPC_L+"taygioangcaosu","1 can 5KG + 1 can 2KG","",0,259000,"","Link landing trong Sheet trùng với Tẩy mốc gioăng, cần kiểm tra lại"],
 ["Nước lau sàn chuyên dụng",SPC_L+"taygioangcaosu","2 can 5KG","",0,359000,"","Link landing trong Sheet trùng với Tẩy mốc gioăng, cần kiểm tra lại"]
].map((a,i)=>({id:"d"+(i+1),nhom:a[0],landing:a[1],page:"",nguoi:"Thảo",combo:a[2],qua:a[3],ship:a[4],gia:a[5],tu:"",den:a[6]||"",ghi:a[7]||""}));

/* Danh sách sản phẩm cố định cho trang vận hành (không dùng số giá vốn): mã, tên, nhóm */
const SPC_SKUS=[["TLG125","Túi tẩy lồng giặt Aibio 125g","Tẩy lồng giặt"],["TLG","Tẩy lồng giặt Ailla 300g","Tẩy lồng giặt"],["TM","Tẩy mốc gioăng cao su 100g","Tẩy chuyên dụng"],["M300","Bình xịt muỗi, kiến, gián 300ml","Kiểm soát côn trùng"],["XM530ML","Xịt đuổi muỗi 530ml","Kiểm soát côn trùng"],["R300","Xịt ruồi 300ml","Kiểm soát côn trùng"],["XR","Xịt đuổi ruồi 530ml","Kiểm soát côn trùng"],["TDST","Tinh dầu sấy luxury (Tím)","Tinh dầu giặt sấy"],["TDSH","Tinh dầu sấy Hygeine (Hồng)","Tinh dầu giặt sấy"],["TDSX","Tinh dầu sấy nắng mai (Xanh)","Tinh dầu giặt sấy"],["TDSXL","Tinh dầu sấy France (Xanh lá)","Tinh dầu giặt sấy"],["TDSD","Tinh dầu giặt sấy Ban Mê","Tinh dầu giặt sấy"],["TD","Tinh dầu giặt sấy 80ml","Tinh dầu giặt sấy"],["BTVN250","Bột tẩy vạn năng 250g",""],["BTVN","Bột tẩy vạn năng Ailla Natural",""],["LSCD5KG","Lau sàn chuyên dụng 5kg",""],["LSCD2KG","Lau sàn chuyên dụng 2kg",""],["LS5CDSC","Lau sàn 5kg chuyên dụng sả chanh",""],["LS1LCDHH","Lau sàn chuyên dụng 1 lít hương hoa hồng",""],["MT","Tẩy mốc trắng quần áo",""],["10CFT","Nước giặt 10kg hương hoa nắng",""],["ND","Nồi điện mini 18cm","Hàng thương mại"],["BD100","Bodymist 100ml",""],["C","Chổi quét sơn",""],["TOILET500","Tẩy toilet 500ml",""]];
const spcStore=()=>{try{return D().fbCat||null}catch(e){return null}};
const spcCls=c=>{const s=spcStore();return (s&&s.cls&&s.cls[c])||SPC_DEF_CLS[c]||SPC_OFF};
const spcCombos=()=>{const s=spcStore();return s&&Array.isArray(s.combos)?s.combos:SPC_DEF_COMBOS};
const spcCanEdit=()=>{try{return ME.role==="admin"||(typeof dgOk==="function"&&dgOk(ME))}catch(e){return false}};
function spcEdit(msg,fn){DB.mutate(ME.name,msg,d=>{if(!d.fbCat)d.fbCat={cls:{},combos:SPC_DEF_COMBOS.map(x=>Object.assign({},x))};if(!d.fbCat.cls)d.fbCat.cls={};fn(d.fbCat)});toast("Đã lưu");renderMain()}
const spcSt=c=>{const t=iso(new Date());if(c.tu&&c.tu>t)return ["Sắp chạy","amb"];if(c.den&&c.den<t)return ["Đã hết","gry"];return ["Đang áp dụng","grn"]};
const spcShort=u=>String(u||"").replace(/^https?:\/\/(www\.)?/,"");

/* Khung chọn sản phẩm đang chạy / quà tặng và bảng combo, giá */
function spcEditor(F,days,opt){
  const ed=spcCanEdit(),rev={},noRev=!F||!F.sk;opt=opt||{};
  if(!noRev)days.forEach(k=>((F.p||{})[k]||[]).forEach(([i,q,dt])=>{rev[i]=(rev[i]||0)+dt*1000}));
  const base=noRev?SPC_SKUS.map(s=>[s[0],s]):Object.entries(F.sk).map(([i,s])=>[i,s]);
  const sk=base.map(([i,s])=>({i,c:s[0],n:s[1],g:s[2]||"",dt:rev[i]||0,k:spcCls(s[0])})).filter(x=>noRev||x.dt>0||x.k!==SPC_OFF).sort((a,b)=>(b.k===SPC_RUN)-(a.k===SPC_RUN)||(b.k===SPC_GIFT)-(a.k===SPC_GIFT)||b.dt-a.dt);
  const cnt=k=>sk.filter(x=>x.k===k).length;
  const skRows=sk.map(x=>`<tr><td class="mono">${esc(x.c)}</td><td><b>${esc(x.n)}</b>${x.g?`<small>${esc(x.g)}</small>`:""}</td>${noRev?"":`<td class="n">${x.dt?tr(x.dt):"—"}</td>`}<td>${ed?`<select class="spc-in" data-spc-cls="${esc(x.c)}">${[SPC_RUN,SPC_GIFT,SPC_OFF].map(v=>`<option value="${v}"${x.k===v?" selected":""}>${SPC_LBL[v]}</option>`).join("")}</select>`:pill(SPC_LBL[x.k],x.k===SPC_RUN?"grn":x.k===SPC_GIFT?"amb":"gry")}</td></tr>`).join("");
  const all=spcCombos(),who=[...new Set(all.map(c=>c.nguoi).filter(Boolean))],lands=[...new Set(all.map(c=>c.landing).filter(Boolean))];
  const list=all.filter(c=>(!SPC.who||c.nguoi===SPC.who)&&(!SPC.land||c.landing===SPC.land)&&(!SPC.st||spcSt(c)[0]===SPC.st));
  const inp=(c,f,w,ph)=>ed?`<input class="spc-in" style="min-width:${w}px" data-spf="${f}" data-spid="${esc(c.id)}" value="${esc(c[f]==null?"":c[f])}"${ph?` placeholder="${ph}"`:""}>`:esc(c[f]==null?"":c[f]);
  const money0=v=>nf(v||0);
  const cRows=list.map(c=>{const st=spcSt(c);return `<tr><td>${inp(c,"nhom",130)}</td><td>${ed?`<input class="spc-in" style="min-width:170px" data-spf="landing" data-spid="${esc(c.id)}" value="${esc(c.landing||"")}">`:`<span class="mono">${esc(spcShort(c.landing))}</span>`}</td><td>${inp(c,"page",120,"tất cả page")}</td><td>${inp(c,"nguoi",70)}</td><td>${inp(c,"combo",190)}</td><td>${inp(c,"qua",170)}</td><td class="n">${ed?`<input class="spc-in" style="min-width:70px;text-align:right" data-spf="ship" data-spid="${esc(c.id)}" value="${money0(c.ship)}">`:money0(c.ship)}</td><td class="n">${ed?`<input class="spc-in" style="min-width:84px;text-align:right" data-spf="gia" data-spid="${esc(c.id)}" value="${money0(c.gia)}">`:`<b>${money0(c.gia)}</b>`}</td><td>${ed?`<input type="date" class="spc-in" data-spf="tu" data-spid="${esc(c.id)}" value="${esc(c.tu||"")}">`:esc(c.tu||"—")}</td><td>${ed?`<input type="date" class="spc-in" data-spf="den" data-spid="${esc(c.id)}" value="${esc(c.den||"")}">`:esc(c.den||"—")}</td><td>${inp(c,"ghi",160,"ngày sale, test giá...")}</td><td>${pill(st[0],st[1])}</td>${ed?`<td style="white-space:nowrap"><button class="btn" data-spc-act="dup" data-spid="${esc(c.id)}" title="Nhân bản để đổi giá, ngày, page">Nhân bản</button> <button class="btn" data-spc-act="del" data-spid="${esc(c.id)}">Xóa</button></td>`:""}</tr>`}).join("")||`<tr><td colspan="13" class="empty">Không có combo nào theo bộ lọc này.</td></tr>`;
  const selOpt=(arr,v,all)=>`<option value="">${all}</option>`+arr.map(x=>`<option value="${esc(x)}"${v===x?" selected":""}>${esc(x)}</option>`).join("");
  return `<style>.spc-in{padding:3px 6px;font-size:12px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--ink);width:100%}.spc-box{max-height:330px;overflow:auto}.spc-cb table{min-width:1500px}.spc-cb th,.spc-cb td{padding:4px 6px;vertical-align:middle}.spc-f{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:4px 0 8px}</style>
  <section class="fbd-card fbd-wide"><h3>Sản phẩm đang chạy quảng cáo <span class="hint" style="font-weight:400">${cnt(SPC_RUN)} đang chạy · ${cnt(SPC_GIFT)} quà tặng</span></h3>
  <p class="fbd-note">${opt.van?"Digital tự điền: chọn sản phẩm nào <b>đang chạy</b> quảng cáo, món nào là <b>quà tặng</b>. Giá vốn không hiện ở trang này. ":""}Chỉ <b>sản phẩm đang chạy</b> được tính vào bảng hiệu quả ở trang quản trị. <b>Quà tặng</b> (nồi điện, body mist, chổi...) tách riêng, không tính vào hiệu quả. Hôm nay chạy sản phẩm nào, chị chọn ở cột bên phải.${ed?"":" Chị cần quyền Digital để sửa."}</p>
  <div class="tbl spc-box"><table><thead><tr><th>Mã</th><th>Sản phẩm</th>${noRev?"":`<th class="n">Doanh thu kỳ này</th>`}<th>Phân loại</th></tr></thead><tbody>${skRows}</tbody></table></div></section>
  <section class="fbd-card fbd-wide"><h3>Combo và giá bán <span class="hint" style="font-weight:400">${list.length}/${all.length} combo</span></h3>
  <p class="fbd-note">Mỗi dòng là một combo của một landing. Khi chạy giá mới hoặc test giá: bấm <b>Nhân bản</b>, sửa giá, page, người test và ngày áp dụng (từ ngày, đến ngày). Combo hết hạn tự hiện "Đã hết". Bỏ trống page nghĩa là áp dụng cho mọi page.</p>
  <div class="spc-f"><select class="spc-in" style="width:auto" data-spc-fl="who">${selOpt(who,SPC.who,"Tất cả người")}</select><select class="spc-in" style="width:auto;max-width:260px" data-spc-fl="land">${selOpt(lands,SPC.land,"Tất cả landing")}</select><select class="spc-in" style="width:auto" data-spc-fl="st">${selOpt(["Đang áp dụng","Sắp chạy","Đã hết"],SPC.st,"Mọi trạng thái")}</select>${ed?`<button class="btn pri" data-spc-act="add">+ Thêm combo</button>`:""}</div>
  <div class="tbl spc-cb" style="overflow-x:auto"><table><thead><tr><th>Nhóm sản phẩm</th><th>Landing</th><th>Page</th><th>Người test</th><th>Combo</th><th>Quà tặng</th><th class="n">Ship</th><th class="n">Giá bán</th><th>Từ ngày</th><th>Đến ngày</th><th>Ghi chú</th><th>Trạng thái</th>${ed?"<th></th>":""}</tr></thead><tbody>${cRows}</tbody></table></div></section>`;
}

/* Bảng hiệu quả: chỉ sản phẩm đang chạy; quà tặng và sản phẩm không chạy tách riêng */
function spcProdTable(F,days){
  const m={};let n=0;
  days.forEach(k=>{const r=F.p[k];if(!r)return;n++;r.forEach(([i,q,dt,gv])=>{const t=m[i]||(m[i]={i,q:0,dt:0,gv:0});t.q+=q;t.dt+=dt*1000;t.gv+=gv*1000})});
  if(!n)return "";
  const L=Object.values(m).map(x=>{const s=F.sk[x.i]||["?","?",""];return Object.assign(x,{c:s[0],n:s[1],g:s[2]||"(chưa nhóm)",k:spcCls(s[0])})}).sort((a,b)=>b.dt-a.dt);
  const R=L.filter(x=>x.k===SPC_RUN),G=L.filter(x=>x.k===SPC_GIFT),O=L.filter(x=>x.k===SPC_OFF);
  const S=a=>a.reduce((o,x)=>({q:o.q+x.q,dt:o.dt+x.dt,gv:o.gv+x.gv}),{q:0,dt:0,gv:0}),T=S(R);
  const row=(x,tot,pct)=>{const b=x.dt?(x.dt-x.gv)/x.dt*100:0;return `<tr${tot?' class="tot"':""}><td><b>${esc(x.n)}</b>${x.c?`<small>${esc(x.c)} · ${esc(x.g)}</small>`:""}</td><td class="n">${nf(x.q)}</td><td class="n">${tr(x.dt)}</td><td class="n">${tr(x.gv)}</td><td class="n">${tr(x.dt-x.gv)}</td><td class="n">${x.dt?pill(Math.round(b)+"%",b>=70?"grn":b>=40?"amb":"red"):"—"}</td><td class="n">${pct&&T.dt?(x.dt/T.dt*100).toFixed(1).replace(".",",")+"%":"—"}</td></tr>`};
  const head=["Sản phẩm","Số lượng","Doanh thu","Giá vốn","Lãi gộp","Biên gộp","% doanh thu"];
  const so=S(O),sg=S(G);
  const main=R.length?tbl(head,R.map(x=>row(x,false,true)).concat([row(Object.assign({n:"Tổng sản phẩm đang chạy",c:"",g:""},T),true,false)])):`<p class="empty">Chưa chọn sản phẩm nào đang chạy. Chị chọn ở bảng phía trên.</p>`;
  const extra=(G.length?`<h4 style="margin:12px 0 4px;font-size:13px">Quà tặng (không tính vào hiệu quả)</h4>${tbl(head,G.map(x=>row(x,false,false)).concat([row(Object.assign({n:"Tổng quà tặng",c:"",g:""},sg),true,false)]))}`:"")+(O.length?`<details style="margin-top:10px"><summary style="cursor:pointer;font-size:13px">Sản phẩm không chạy quảng cáo (${O.length} sản phẩm · ${tr(so.dt)}), bấm để xem</summary>${tbl(head,O.map(x=>row(x,false,false)))}</details>`:"");
  return `<section class="fbd-card fbd-wide"><h3>Hiệu quả theo sản phẩm đang chạy · ${n} ngày có số</h3>${main}${extra}<p class="fbd-note">Đơn đã giao thành công, giá vốn theo bảng quy đổi sản phẩm trong Sheet Pancake. Lãi gộp ở đây chưa trừ vận chuyển và quảng cáo (chưa phân bổ theo từng sản phẩm).</p></section>`;
}

/* Thay phần "Hiệu quả theo sản phẩm" của trang Facebook › Sản phẩm bằng bản có danh mục sản phẩm đang chạy */
if(typeof fbdProdCard==="function"&&!window.__spcWrap){window.__spcWrap=1;const _spc0=fbdProdCard;
  fbdProdCard=function(days,topN,title){const F=typeof FBC!=="undefined"&&FBC.raw;if(!F||!F.p||!F.sk)return _spc0(days,topN,title);
    try{return spcEditor(F,days)+spcProdTable(F,days)}catch(e){console.warn("danh mục sản phẩm đang chạy",e);return _spc0(days,topN,title)}}}

/* Lưu khi chị sửa (bắt sự kiện chung, chỉ gắn một lần) */
if(!window.__spcBound){window.__spcBound=1;
  document.addEventListener("change",e=>{const t=e.target;if(!t||!t.dataset)return;
    if(t.dataset.spcFl){SPC[t.dataset.spcFl]=t.value;renderMain();return}
    if(t.dataset.spcCls!==undefined&&spcCanEdit()){const code=t.dataset.spcCls,v=t.value;spcEdit(`phân loại sản phẩm ${code}: ${SPC_LBL[v]}`,c=>{c.cls[code]=v});return}
    if(t.dataset.spf&&spcCanEdit()){const id=t.dataset.spid,f=t.dataset.spf;let v=t.value;if(f==="ship"||f==="gia")v=Math.round(+String(v).replace(/[^\d]/g,""))||0;spcEdit(`sửa combo (${f})`,c=>{const x=c.combos.find(y=>y.id===id);if(x)x[f]=v})}});
  document.addEventListener("click",e=>{const b=e.target&&e.target.closest?e.target.closest("[data-spc-act]"):null;if(!b||!spcCanEdit())return;const act=b.dataset.spcAct,id=b.dataset.spid;
    if(act==="add")spcEdit("thêm combo mới",c=>{c.combos.unshift({id:"n"+Date.now(),nhom:"",landing:"",page:"",nguoi:ME.name||"",combo:"",qua:"",ship:0,gia:0,tu:iso(new Date()),den:"",ghi:""})});
    else if(act==="dup")spcEdit("nhân bản combo",c=>{const i=c.combos.findIndex(y=>y.id===id);if(i>=0)c.combos.splice(i+1,0,Object.assign({},c.combos[i],{id:"n"+Date.now(),tu:iso(new Date()),den:"",ghi:""}))});
    else if(act==="del"&&confirm("Xóa combo này?"))spcEdit("xóa combo",c=>{c.combos=c.combos.filter(y=>y.id!==id)})})}

/* Trang riêng ở bản vận hành (Marketing › Digital Marketing › Sản phẩm và combo): Digital tự điền, không có giá vốn */
PAGES.dg_sp=function(m){m.innerHTML=H("Sản phẩm và combo","Sản phẩm nào đang chạy, combo, giá, landing, page và ngày áp dụng · không có giá vốn")+spcEditor(null,[],{van:true})};
(function(){try{
  const st=PAGE_SETS.find(x=>x.n==="Digital Marketing");
  if(st&&!st.ids.includes("dg_sp")){const i=st.ids.indexOf("dg_lib");const at=i>=0?i:st.ids.length;st.ids.splice(at,0,"dg_sp");st.labels.splice(at,0,"Sản phẩm và combo")}
  const mk=MODULES.find(x=>x.k==="mkt");
  if(mk&&!mk._sp){mk._sp=1;const g0=mk.groups;mk.groups=function(){const r=g0.apply(this,arguments);r.forEach(gr=>{const arr=gr[1],j=arr.findIndex(it=>it&&it[0]==="dg_lib");if(j>=0&&!arr.some(it=>it&&it[0]==="dg_sp"))arr.splice(j,0,MI("dg_sp","Sản phẩm và combo",tm("ads",dgOk)))});return r}}
}catch(e){console.warn("menu sản phẩm và combo",e)}})();
