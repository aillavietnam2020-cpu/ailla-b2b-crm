/* =====================================================================
   HỘP "VIỆC CHỜ TÔI" Ở ĐẦU TỔNG QUAN (trang quản trị).
   Gom việc đang chờ chị Hoa / chị Thảo / chị Huệ xử lý, mỗi việc một dòng, bấm "Mở" là tới đúng chỗ.
   Mỗi việc có HẠN XỬ LÝ (số ngày cho phép chỉnh ở Cấu hình › Ngưỡng cảnh báo). Quá hạn thì báo đỏ ghi "quá N ngày";
   quá hạn từ số ngày leo thang trở lên thì đánh dấu "Cần chị Hoa quyết" lên đầu hộp.
   Hiện gom: mua hàng (chờ chuyển khoản trước, công nợ, chờ chứng từ, chờ nhập giá, trễ hàng), nguyên vật liệu dưới mức tối thiểu.
   Chỉ hiện cho người quản lý (mhManage). Không ghi dữ liệu gì, không gửi tin đi đâu.
   ===================================================================== */
const VC={busy:false,all:false,tried:false};
const VC_SLA0={ct:3,gia:2,tr:2,sau:3,leo:2};
const vcSla=()=>({...VC_SLA0,...(((D().fin||{}).sla)||{})});
const vcAdd=(d,n)=>{const x=new Date(d+"T00:00:00");x.setDate(x.getDate()+n);return iso(x)};
const vcLastRc=p=>(p.receipts||[]).filter(r=>r.status==="OK").map(r=>r.receipt_date).sort().pop()||"";
function vcLoad(){
  if(VC.busy||VC.tried||(MH.orders&&MH.inv&&MH.pay&&MH.sup))return;VC.busy=true;VC.tried=true;
  Promise.all([mhLoad(),mhLoadInv(),mhLoadPay()]).catch(()=>{}).finally(()=>{VC.busy=false;if(PAGE==="exec")renderMain()})}
function vcLoadMore(){try{if(typeof ptLoad==="function")ptLoad();if(typeof spLoadFiles==="function")spLoadFiles()}catch(e){}}
function vcItems(){
  const L=[],S=vcSla(),today=mhToday();
  (MH.orders||[]).forEach(p=>{
    if(p.status==="HUY")return;
    let M,st;try{M=mhPoMoney(p);st=mhStage(p,M)}catch(e){return}
    const k=st[0],who=esc(p.supplier_name||""),no=esc(p.no||""),rc=vcLastRc(p);
    const go=()=>{PAGE="mh_po";MH.open=p.id;MH.st="";try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}renderMain();scrollTo(0,0)};
    const add=(t,s,tag,han,r)=>L.push({r,t,s,tag,han,go});
    if(k==="tr")add("Chuyển khoản trước cho "+who,"Phiếu mua "+no+" · nhà cung cấp yêu cầu trả trước khi giao",["Chờ CK trước","amb"],vcAdd(p.order_date||today,S.tr),1);
    else if(k==="no"&&st[2]==="red"){
      const T=mhTermOf(p).pay_terms,due=T==="CONG_NO"?mhDueOf(p):(rc?vcAdd(rc,S.sau):"");
      add("Trả tiền cho "+who,"Phiếu mua "+no+" · "+st[1],[st[1].startsWith("Công nợ")?"Quá hạn":"Chưa trả","red"],due,0)}
    else if(k==="no")add("Công nợ sắp đến hạn · "+who,"Phiếu mua "+no+" · "+st[1],["Công nợ","amb"],mhDueOf(p),3);
    else if(k==="ct")add("Ghi chứng từ của "+who,"Phiếu mua "+no+" · hàng đã nhập kho, chưa có chứng từ",["Chờ chứng từ","blu"],rc?vcAdd(rc,S.ct):"",2);
    else if(k==="gia")add("Nhập giá cho phiếu "+no,who+" · hàng đã về, chưa có giá",["Chờ nhập giá","amb"],rc?vcAdd(rc,S.gia):"",2);
    else if(k==="hang"&&st[2]==="red")add("Hỏi hàng trễ · "+who,"Phiếu mua "+no+" · "+st[1],["Trễ hàng","red"],p.expected_date||"",4);
  });
  try{const need=mhNeedBuy();if(need.length)L.push({r:5,t:need.length+" nguyên vật liệu dưới mức tồn tối thiểu",s:need.slice(0,3).map(x=>x.name).join(", ")+(need.length>3?"…":""),tag:["Cần mua","amb"],han:"",go:()=>{PAGE="mh_po";MH.open=null;renderMain();scrollTo(0,0)}})}catch(e){}
  /* phiếu sản xuất: gấp chưa bắt đầu, hoặc quá hạn cần hàng; lô đã báo hoàn thành đang chờ kiểm kê */
  try{sxShape(D());const s=SX(),goSx=()=>{PAGE="sx_nc";try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}renderMain();scrollTo(0,0)};
    s.requests.filter(r=>(r.st==="CAN_LAM"||r.st==="DANG_LAM")&&((r.han&&r.han<today)||(r.uu==="Gấp"&&r.st==="CAN_LAM"))).slice(0,6).forEach(r=>
      L.push({r:1,t:esc(sxP(r.sp).ten)+": phiếu sản xuất "+esc(r.id)+(r.st==="CAN_LAM"?" chưa bắt đầu":" đang làm"),s:(r.uu==="Gấp"?"Ưu tiên gấp · ":"")+(r.sl?nf(r.sl)+" cái · ":"")+(sxCach(r)==="CONG_NHAN"?"công nhân tự làm":"cần kỹ thuật pha chế"),tag:["Sản xuất",r.han&&r.han<today?"red":"amb"],han:r.han||"",go:goSx}));
    const ck=s.batches.filter(b=>b.st==="CHO_KIEM");
    if(ck.length)L.push({r:2,t:ck.length+" lô đã đóng gói, chờ kiểm kê",s:ck.slice(0,3).map(b=>sxP(b.sp).ten).join(", ")+(ck.length>3?"…":""),tag:["Chờ kiểm kê","blu"],han:"",go:()=>{PAGE="sx_lo";try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}renderMain();scrollTo(0,0)}})}catch(e){}
  /* khoản chi nhập tay tháng này chưa có ảnh bill */
  try{const ym=today.slice(0,7),F=SOCP.files,miss=F?(D().costs||[]).filter(c=>(c.ngay?c.ngay.slice(0,7):c.thang)===ym&&(+c.tien||0)>0&&!F[c.id]):[];
    if(miss.length)L.push({r:6,t:miss.length+" khoản chi tháng này chưa có ảnh bill",s:"Ghi ảnh chuyển khoản hoặc phiếu chi tiền mặt để sau này đối chiếu",tag:["Thiếu ảnh","blu"],han:"",go:()=>{PAGE="so_cp";try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}renderMain();scrollTo(0,0)}})}catch(e){}
  /* khách nợ quá 90 ngày (gồm nợ đầu kỳ) */
  try{const A=PT.d&&PT.d.rows?PT.d.rows.filter(r=>r.b90p+r.old>0):[];
    if(A.length)L.push({r:6,t:A.length+" khách nợ quá 90 ngày",s:"Tổng "+nf(Math.round(A.reduce((t,r)=>t+r.b90p+r.old,0)))+" đ · "+A.slice(0,2).map(r=>r.customer_name).join(", ")+(A.length>2?"…":""),tag:["Đòi nợ","red"],han:"",go:()=>{PAGE="phai_thu";try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}renderMain();scrollTo(0,0)}})}catch(e){}
  /* việc của team (video chờ đăng, chờ duyệt…) lấy từ Task giao việc, gộp chung một hộp cho khỏi có hai danh sách */
  try{(typeof execAttention==="function"?execAttention():[]).forEach(a=>L.push({r:a.late?3:7,team:true,t:esc(a.t),s:esc([a.dep,a.who,a.han].filter(Boolean).join(" · ")),tag:[a.st[0],["red","amb","blu","grn"].includes(a.st[1])?a.st[1]:"blu"],han:"",btn:a.btn||"Mở",go:()=>vcAtGo(a)}))}catch(e){}
  L.forEach(x=>{x.over=x.han?Math.max(0,tlDays(x.han,today)):0;if(x.team&&x.r===3)x.over=1;x.leo=x.over>=S.leo});
  return L.sort((a,b)=>(b.leo-a.leo)||(b.over-a.over)||a.r-b.r);
}
const vcKey=x=>typeof QT_TAGKEY!=="undefined"?QT_TAGKEY[x.tag[0]]:"";
function vcWho(x){const k=vcKey(x);if(!k||typeof qtRule!=="function")return "";const r=qtRule(k);return `<small class="vcwho">Người làm: <b>${esc(r.lam)}</b> · duyệt: ${esc(r.duyet)}</small>`}
/* Giao việc: mở form Giao việc có sẵn của Task giao việc, điền sẵn tên việc và mô tả. */
function vcGive(x){
  const txt=s=>String(s||"").replace(/<[^>]+>/g,"").replace(/&amp;/g,"&");
  if(typeof openTask!=="function"){toast("Chưa mở được form giao việc");return}
  openTask(null);
  setTimeout(()=>{const a=document.querySelector("#t-ten"),b=document.querySelector("#t-mo");
    if(a)a.value=txt(x.t);if(b)b.value=txt(x.s)+(x.han?" · hạn "+x.han:"")},60)}
function vcAtGo(a){
  if(a.href){location.href=a.href;return}
  if(a.open){if(a.open.src==="card")openCard(a.open.id);else if(a.open.src==="order"){PAGE="order";MOD="";render()}else openTask(a.open.id);return}
  if(a.go){PAGE=a.go;MOD="";render();scrollTo(0,0)}}
function vcCard(){
  const L=vcItems(),n=L.length,show=VC.all?L:L.slice(0,6),leo=L.filter(x=>x.leo).length,qh=L.filter(x=>x.over>0).length;
  VC.list=show;
  const han=x=>!x.han?"":x.over>0?`<b class="vcover">quá hạn ${x.over} ngày</b> · hạn ${esc(mhDM(x.han))}`:`hạn ${esc(mhDM(x.han))}`;
  return `<section class="vcbox"><div class="vch"><b>Việc chờ tôi</b><span>${leo?`<span class="vcn">${leo} cần chị Hoa quyết</span> `:""}<span class="vcn${n?"":" ok"}${qh&&!leo?"":""}">${n?n+" việc"+(qh?" · "+qh+" quá hạn":""):"Không có việc nào"}</span></span></div>${
    n?show.map((x,i)=>`<div class="vcrow${x.leo?" leo":""}"><span class="vctag ${x.tag[1]}">${esc(x.tag[0])}</span><div class="vct"><b>${x.t}</b><small>${x.s}${han(x)?" · "+han(x):""}</small>${x.team?"":vcWho(x)}</div>${x.leo?`<span class="vcleo">Cần chị Hoa quyết</span>`:""}${x.team?"":`<button class="btn sm" data-vg="${i}" title="Giao việc này cho một người">Giao việc</button>`}<button class="btn sm${x.btn==="Duyệt"?" pri":""}" data-vc="${i}">${x.btn||"Mở"}</button></div>`).join("")+(n>6?`<button class="vcmore" id="vc-more">${VC.all?"Thu gọn":"Xem thêm "+(n-6)+" việc"}</button>`:""):`<p class="hint" style="margin:8px 0 2px">Chuyển khoản, chứng từ, công nợ nhà cung cấp đều đã xong.</p>`}</section>`}
{const _ex=PAGES.exec;PAGES.exec=function(m){_ex.apply(this,arguments);
  try{if(typeof HOST_MODE==="undefined"||HOST_MODE!=="admin"||!mhManage())return;
    if((SUB.exec||"homnay")!=="homnay"||!m.querySelector(".xkstrip"))return;
    vcLoad();vcLoadMore();if(!(MH.orders&&MH.inv&&MH.pay&&MH.sup))return;
    m.querySelector(".xkstrip").insertAdjacentHTML("beforebegin",vcCard());
    const old=m.querySelector(".xatt");if(old)old.remove();
    m.querySelectorAll("[data-vc]").forEach(b=>b.onclick=()=>VC.list[+b.dataset.vc].go());
    m.querySelectorAll("[data-vg]").forEach(b=>b.onclick=()=>vcGive(VC.list[+b.dataset.vg]));
    const mo=m.querySelector("#vc-more");if(mo)mo.onclick=()=>{VC.all=!VC.all;renderMain()};
  }catch(e){}}}
