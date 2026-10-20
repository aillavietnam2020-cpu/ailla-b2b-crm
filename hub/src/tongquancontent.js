/* =====================================================================
   TỔNG QUAN CONTENT — phần đầu trang kiểu Pancake:
   3 thẻ tóm tắt (có so sánh xanh/đỏ) + dải 6 chỉ số + một biểu đồ đổi theo chỉ số được bấm + đề xuất AI một dòng.
   Chỉ so sánh với mốc thật tính được: nhịp kế hoạch, tuần trước, mục tiêu tháng.
   ===================================================================== */
let TQC_M="dang";
function tqcCmp(v,base,fmt){
  if(!base)return `<div class="tqd">&nbsp;</div>`;
  const p=Math.round((v/base-1)*100),good=p>=0;
  return `<div class="tqd ${good?"up":"dn"}">${good?"↑":"↓"} ${Math.abs(p)}% ${fmt}</div>`;
}
function tqcSeries(d,metric,today){
  const C=d.cards.filter(c=>c.step==="xong"&&c.day),out=[];let acc=0;
  for(let x=1;x<=today;x++){C.filter(c=>c.day===x).forEach(c=>{acc+=metric==="gmv"?(+c.gmv||0):1});out.push(acc)}
  return out;
}
function tqcChart(d,today){
  const n=MONTH.ndays,act=tqcSeries(d,TQC_M,today);
  const plan=TQC_M==="gmv"?(+(d.kpiTargets||{}).gmvVideo||0):d.cards.length;
  const mx=Math.max(1,plan,...act),W=600,H=170,px=x=>(x-1)/(n-1)*W,py=v=>H-8-(v/mx)*(H-24);
  const pts=act.map((v,i)=>`${px(i+1).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  const fmt=v=>TQC_M==="gmv"?money(v):nf(v);
  const ticks=[1,8,15,22,n].filter((v,i,a)=>a.indexOf(v)===i);
  return `<div class="tqchart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><g stroke="#e6e8f0"><line x1="0" y1="${py(mx)}" x2="${W}" y2="${py(mx)}"/><line x1="0" y1="${py(mx/2)}" x2="${W}" y2="${py(mx/2)}"/><line x1="0" y1="${py(0)}" x2="${W}" y2="${py(0)}"/></g>
   <polyline fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="5 4" points="${px(1)},${py(0)} ${px(n)},${py(plan)}"/>
   ${pts?`<polyline fill="none" stroke="#4f46e5" stroke-width="2.5" points="${pts}"/>`:""}</svg>
   <div class="tqax">${ticks.map(x=>`<span>${dd(x)}</span>`).join("")}</div></div>
   <div class="tqleg"><span><i></i>Thực tế</span><span><i class="ds"></i>Nhịp kế hoạch (tới ${fmt(plan)})</span><span class="r">Cộng dồn theo ngày · đang ${fmt(act[act.length-1]||0)}</span></div>`;
}
function tqcTop(){
  const d=D(),today=d.settings.today,C=d.cards,N=C.length;
  const posted=C.filter(c=>c.step==="xong"),cho=C.filter(c=>c.step==="dang").length,chua=C.filter(c=>c.step==="cg").length;
  const lam=C.filter(c=>["kb","dkb","quay","edit","worker","dvd","dceo"].includes(c.step)).length;
  const exp=Math.round(N*today/MONTH.ndays),late=C.filter(c=>c.step!=="xong"&&isLate(c)).length;
  const gmv=sum(posted,c=>+c.gmv||0),don=sum(posted,c=>+c.don||0),tg=+(d.kpiTargets||{}).gmvVideo||0,paceG=tg*today/MONTH.ndays;
  const wk=WEEKS.findIndex(w=>today>=w.tu&&today<=w.den),cur=WEEKS[wk],prev=WEEKS[wk-1];
  const inW=w=>w?posted.filter(c=>c.day>=w.tu&&c.day<=w.den).length:0;
  const thisW=inW(cur),lastW=inW(prev),thieu=Math.max(0,N-cho-posted.length);
  let T=[];try{T=aiTop(3)}catch(e){}
  const blank=`<div class="tqd">&nbsp;</div>`;
  const cell=(k,lb,v,sub,click)=>`<div class="tqcell${click?" clk":""}${click&&TQC_M===k?" on":""}" ${click?`data-tqm="${k}"`:""}><small>${lb}</small><b>${v}</b>${sub}</div>`;
  return `<div class="tqtop">
   <section class="card tqc"><div class="tqh"><span class="tqi i1">${ico("task")}</span>Video tháng ${MONTH.mon}</div><div class="tqtwo"><div><small>Đã đăng</small><b>${posted.length} / ${N}</b>${tqcCmp(posted.length,exp,"so với nhịp cần ("+exp+")")}</div><div><small>Còn thiếu</small><b>${thieu}</b><div class="tqd">${N?Math.round(thieu/N*100):0}% kế hoạch</div></div></div></section>
   <section class="card tqc"><div class="tqh"><span class="tqi i2">${ico("clock")}</span>Đang xử lý</div><div class="tqtwo"><div><small>Chờ đăng</small><b>${cho}</b><div class="tqd">chờ người giữ kênh đăng</div></div><div><small>Trễ hạn</small><b class="${late?"dn":""}">${late}</b><div class="tqd ${late?"dn":""}">${late?"cần xử lý":"không trễ"}</div></div></div></section>
   <section class="card tqc"><div class="tqh"><span class="tqi i3">${ico("money")}</span>Doanh thu video</div><div class="tqtwo"><div><small>Tháng này</small><b>${money(gmv)}</b>${tg?tqcCmp(gmv,paceG,"so với nhịp mục tiêu"):blank}</div><div><small>Đơn</small><b>${nf(don)}</b><div class="tqd">${tg?"mục tiêu "+money(tg):"&nbsp;"}</div></div></div></section>
  </div>
  <section class="card tqmain"><div class="tqstrip">
   ${cell("dang","Video đã đăng",posted.length,lastW||thisW?tqcCmp(thisW,lastW,"tuần này vs trước"):blank,true)}
   ${cell("c","Chờ đăng",cho,blank)}
   ${cell("l","Đang làm",lam,blank)}
   ${cell("x","Chưa làm",chua,blank)}
   ${cell("o","Đơn từ video",nf(don),blank)}
   ${cell("gmv","Doanh thu",money(gmv),tg?tqcCmp(gmv,paceG,"vs nhịp"):blank,true)}
  </div>${tqcChart(d,today)}</section>
  ${T.length?`<section class="tqai"><b>✨ Đề xuất của Trợ lý AI</b>${T.map(i=>`<span>${esc(i.title)}</span>`).join("")}<button type="button" class="btn sm" data-go="ai">Xem và áp dụng</button></section>`:""}`;
}
