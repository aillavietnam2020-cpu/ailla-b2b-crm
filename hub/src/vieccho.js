/* =====================================================================
   HỘP "VIỆC CHỜ TÔI" Ở ĐẦU TỔNG QUAN (trang quản trị).
   Gom việc đang chờ chị Hoa / chị Thảo / chị Huệ xử lý, mỗi việc một dòng, bấm "Mở" là tới đúng chỗ.
   Hiện chưa gom: mua hàng (chờ chuyển khoản trước, công nợ, chờ chứng từ, chờ nhập giá, trễ hàng), nguyên vật liệu dưới mức tối thiểu.
   Chỉ hiện cho người quản lý (mhManage). Không ghi dữ liệu gì.
   ===================================================================== */
const VC={busy:false,all:false};
function vcLoad(){
  if(VC.busy||VC.tried||(MH.orders&&MH.inv&&MH.pay&&MH.sup))return;VC.busy=true;VC.tried=true;
  Promise.all([mhLoad(),mhLoadInv(),mhLoadPay()]).catch(()=>{}).finally(()=>{VC.busy=false;if(PAGE==="exec")renderMain()})}
function vcItems(){
  const L=[];
  (MH.orders||[]).forEach(p=>{
    if(p.status==="HUY")return;
    let M,st;try{M=mhPoMoney(p);st=mhStage(p,M)}catch(e){return}
    const k=st[0],who=esc(p.supplier_name||""),no=esc(p.no||"");
    const go=()=>{PAGE="mh_po";MH.open=p.id;MH.st="";try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}renderMain();scrollTo(0,0)};
    if(k==="tr")L.push({r:1,t:"Chuyển khoản trước cho "+who,s:"Phiếu mua "+no+" · nhà cung cấp yêu cầu trả trước khi giao",tag:["Chờ CK trước","amb"],go});
    else if(k==="no"&&st[2]==="red")L.push({r:0,t:"Trả tiền cho "+who,s:"Phiếu mua "+no+" · "+st[1],tag:[st[1].startsWith("Công nợ")?"Quá hạn":"Chưa trả","red"],go});
    else if(k==="no")L.push({r:3,t:"Công nợ sắp đến hạn · "+who,s:"Phiếu mua "+no+" · "+st[1],tag:["Công nợ","amb"],go});
    else if(k==="ct")L.push({r:2,t:"Ghi chứng từ của "+who,s:"Phiếu mua "+no+" · hàng đã nhập kho, chưa có chứng từ",tag:["Chờ chứng từ","blu"],go});
    else if(k==="gia")L.push({r:2,t:"Nhập giá cho phiếu "+no,s:who+" · hàng đã về, chưa có giá",tag:["Chờ nhập giá","amb"],go});
    else if(k==="hang"&&st[2]==="red")L.push({r:4,t:"Hỏi hàng trễ · "+who,s:"Phiếu mua "+no+" · "+st[1],tag:["Trễ hàng","red"],go});
  });
  try{const need=mhNeedBuy();if(need.length)L.push({r:5,t:need.length+" nguyên vật liệu dưới mức tồn tối thiểu",s:need.slice(0,3).map(x=>x.name).join(", ")+(need.length>3?"…":""),tag:["Cần mua","amb"],go:()=>{PAGE="mh_po";MH.open=null;renderMain();scrollTo(0,0)}})}catch(e){}
  return L.sort((a,b)=>a.r-b.r);
}
function vcCard(){
  const L=vcItems(),n=L.length,show=VC.all?L:L.slice(0,6);
  VC.list=show;
  return `<section class="vcbox"><div class="vch"><b>Việc chờ tôi</b><span class="vcn${n?"":" ok"}">${n?n+" việc":"Không có việc nào"}</span></div>${
    n?show.map((x,i)=>`<div class="vcrow"><span class="vctag ${x.tag[1]}">${esc(x.tag[0])}</span><div class="vct"><b>${x.t}</b><small>${x.s}</small></div><button class="btn sm" data-vc="${i}">Mở</button></div>`).join("")+(n>6?`<button class="vcmore" id="vc-more">${VC.all?"Thu gọn":"Xem thêm "+(n-6)+" việc"}</button>`:""):`<p class="hint" style="margin:8px 0 2px">Chuyển khoản, chứng từ, công nợ nhà cung cấp đều đã xong.</p>`}</section>`}
{const _ex=PAGES.exec;PAGES.exec=function(m){_ex.apply(this,arguments);
  try{if(typeof HOST_MODE==="undefined"||HOST_MODE!=="admin"||!mhManage())return;
    if((SUB.exec||"homnay")!=="homnay"||!m.querySelector(".xkstrip"))return;
    vcLoad();if(!(MH.orders&&MH.inv&&MH.pay&&MH.sup))return;
    m.querySelector(".xkstrip").insertAdjacentHTML("beforebegin",vcCard());
    m.querySelectorAll("[data-vc]").forEach(b=>b.onclick=()=>VC.list[+b.dataset.vc].go());
    const mo=m.querySelector("#vc-more");if(mo)mo.onclick=()=>{VC.all=!VC.all;renderMain()};
  }catch(e){}}}
