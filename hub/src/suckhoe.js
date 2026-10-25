/* =====================================================================
   "SỨC KHỎE CÔNG TY" MỘT HÀNG Ở ĐẦU TỔNG QUAN (trang quản trị).
   Theo cách quản trị thường dùng (bảng điểm cân bằng / dashboard CEO): nhìn một hàng là biết sáu thứ sống còn của công ty,
   mỗi thứ một đèn xanh, vàng hoặc đỏ so với ngưỡng đã đặt ở Cấu hình › Ngưỡng cảnh báo:
   1 Doanh thu thực so với kế hoạch · 2 Lãi sau chi phí trực tiếp · 3 Quảng cáo trên doanh thu · 4 Tiền và số ngày dự trữ ·
   5 Phải thu khách (nợ quá hạn) · 6 Chi phí so với ngân sách.
   Bấm vào ô để mở đúng trang xem sâu. Chỉ đọc, không ghi gì.
   ===================================================================== */
function skTiles(){
  const T=[],ym=PERIOD.to.slice(0,7),ng=(typeof dhGet==="function"&&D().fin)?dhGet().nguong:{qcMax:.38,runway:30};
  let N=null,B=null,G=null;try{N=execNums(PERIOD.from,PERIOD.to);B=b2bChannel("B2B");G=b2bChannel("GIA_CONG")}catch(e){}
  const rev=N?N.tong+(B?B.net:0)+(G?G.net:0):null;
  const add=(go,l,v,sub,st)=>T.push({go,l,v,sub,st});
  /* 1 doanh thu so với kế hoạch */
  try{const pl=typeof mtGet==="function"?mtGet(ym):null,days=new Date(+ym.slice(0,4),+ym.slice(5,7),0).getDate(),dn=Math.min(days,+mhToday().slice(8,10)),time=PERIOD.from.slice(0,7)===ym&&mhToday().slice(0,7)===ym?dn/days:1;
    if(rev==null)add("muctieu","Doanh thu thực","—","đang tải","gry");
    else if(pl&&pl.tong>0){const r=rev/pl.tong,cl=r>=time*.95?"grn":r>=time*.8?"amb":"red";add("muctieu","Doanh thu thực",tr(rev),"đạt "+Math.round(r*100)+"% kế hoạch · đã qua "+Math.round(time*100)+"% tháng",cl)}
    else add("muctieu","Doanh thu thực",tr(rev),"chưa đặt kế hoạch tháng","gry")}catch(e){}
  /* 2 lãi */
  try{if(N&&rev){const lr=[N.L.fb,N.L.spe,N.L.tts].filter(x=>x!=null),lai=lr.reduce((a,b)=>a+b,0)+(B?B.lai:0)+(G?G.lai:0),m=lai/rev;
      add("bc_tong","Lãi đóng góp",tr(lai),Math.round(m*100)+"% doanh thu · chưa trừ lương, kho",m<.1?"red":m<.2?"amb":"grn")}
    else add("bc_tong","Lãi đóng góp","—","chưa có số","gry")}catch(e){}
  /* 3 quảng cáo */
  try{if(N&&N.tong){const C=N.C||{},ads=(C.adsFB||0)+(C.adsTT||0)+(C.adsSPE||0),r=ads/N.tong;
      add("so_cp","Quảng cáo / doanh thu",Math.round(r*100)+"%","ngưỡng báo đỏ "+Math.round(ng.qcMax*100)+"% · "+tr(ads),r>ng.qcMax?"red":r>ng.qcMax*.85?"amb":"grn")}
    else add("so_cp","Quảng cáo / doanh thu","—","chưa có doanh thu sàn","gry")}catch(e){}
  /* 4 tiền */
  try{const t=typeof dhCalcTien==="function"?dhCalcTien():null;
    if(t&&t.last&&t.R.ngay!=null)add("tien_lich","Tiền đủ dùng",t.R.ngay+" ngày","tiền "+tr(t.R.co)+" · ngưỡng "+ng.runway+" ngày",t.R.ngay<ng.runway?"red":t.R.ngay<ng.runway*1.3?"amb":"grn");
    else add("tien_lich","Tiền đủ dùng","—","chưa nhập số dư tài khoản","gry")}catch(e){}
  /* 5 phải thu */
  try{if(typeof PT!=="undefined"&&PT.d&&PT.d.totals){const t=PT.d.totals,late=t.b90p+t.old,p=t.debt?late/t.debt:0;
      add("phai_thu","Phải thu khách",tr(t.debt),"nợ quá 90 ngày "+Math.round(p*100)+"% · DSO "+(PT.d.dso!=null?PT.d.dso+" ngày":"—"),p>.3?"red":p>.1?"amb":"grn")}
    else add("phai_thu","Phải thu khách","—","đang tải","gry")}catch(e){}
  /* 6 ngân sách */
  try{const bud=((D().fin||{}).budgets||{})[PERIOD.from.slice(0,7)]||{},bt=Object.values(bud).reduce((a,b)=>a+(+b||0),0);
    if(bt>0&&PERIOD.from.slice(0,7)===PERIOD.to.slice(0,7)){const used=spRows().reduce((a,x)=>a+x.tien,0),r=used/bt;add("ngan_sach","Chi phí / ngân sách",Math.round(r*100)+"%",tr(used)+" / "+tr(bt),r>1?"red":r>.85?"amb":"grn")}
    else add("ngan_sach","Chi phí / ngân sách","—","chưa đặt ngân sách tháng này","gry")}catch(e){}
  return T}
{const _ex=PAGES.exec;PAGES.exec=function(m){_ex.apply(this,arguments);
  try{if(typeof HOST_MODE==="undefined"||HOST_MODE!=="admin"||!mhManage())return;
    if((SUB.exec||"homnay")!=="homnay")return;
    const anchor=m.querySelector(".vcbox")||m.querySelector(".xkstrip");if(!anchor)return;
    if(typeof ptLoad==="function")ptLoad();
    const T=skTiles();
    anchor.insertAdjacentHTML("beforebegin",`<section class="skbox"><div class="skh"><b>Sức khỏe công ty</b><small>${esc(pLabel())} · xanh: ổn · vàng: cần để ý · đỏ: cần xử lý · xám: chưa có số</small></div><div class="skg">${T.map((x,i)=>`<button class="skt sk-${x.st}" data-sk="${i}"><span class="skl"><i></i>${esc(x.l)}</span><b>${esc(x.v)}</b><small>${esc(x.sub)}</small></button>`).join("")}</div></section>`);
    m.querySelectorAll("[data-sk]").forEach(b=>b.onclick=()=>{PAGE=T[+b.dataset.sk].go;try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}renderMain();scrollTo(0,0)});
  }catch(e){}}}
