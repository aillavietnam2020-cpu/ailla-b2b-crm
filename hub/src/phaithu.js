/* =====================================================================
   PHẢI THU KHÁCH (NPP / đại lý) THEO TUỔI NỢ + DSO (trang quản trị › Chi phí & Tiền).
   Số lấy từ công nợ chính thức của CRM (đã kế toán xác nhận). Tiền khách trả được trừ vào đơn cũ nhất trước, nên phần nợ còn lại
   nằm ở các đơn mới. Tuổi tính từ ngày đơn. DSO = số ngày thu tiền bình quân = tổng nợ ÷ doanh thu 90 ngày gần nhất × 90.
   Số tính ở máy chủ debts.ts (debtAging), tách Kênh phân phối / Kênh OEM; cùng số trang Đối chiếu công nợ & tiền (tiencn.js).
   ===================================================================== */
const PT={d:null,busy:false,q:"",only:"",pg:null};
async function ptLoad(){if(PT.busy||PT.d)return;PT.busy=true;
  try{PT.d=await svApi("/api/debts/aging")}catch(e){PT.d={err:e.message||"Không tải được"}}
  PT.busy=false;if(["phai_thu","exec","bc_b2b"].includes(PAGE))renderMain()}
function pPhaiThu(m){
  ptLoad();if(typeof gdCss==="function")gdCss();const T="Phải thu khách",S="Khách đang nợ bao nhiêu, nợ bao lâu, bao nhiêu ngày thu được tiền";
  const D0=PT.d;
  if(!D0){m.innerHTML=H(T,S)+`<p class="hint pad">Đang tải…</p>`;return}
  if(D0.err){m.innerHTML=H(T,S)+`<div class="note red">${esc(D0.err)}</div>`;return}
  const t=D0.totals,q=kfold(PT.q||"").trim(),late=t.b90p+t.old;
  const R=D0.rows.filter(r=>(!q||kfold(r.customer_name+" "+(r.owner_name||"")).includes(q))&&(!PT.only||(PT.only==="90"?r.b90p+r.old>0:r.b90>0)));
  const seg=[["0–30 ngày","b30","nsg2"],["31–60 ngày","b60","nsy2"],["61–90 ngày","b90","nso2"],["Trên 90 ngày","b90p","nsr2"],["Nợ đầu kỳ (từ trước khi dùng web)","old","nsr2"]];
  const pc=v=>t.debt?Math.round(v/t.debt*100):0;
  const dso=D0.dso,bk=D0.by_kenh,kn=k=>bk&&bk[k]?bk[k]:null;
  const kenhRow=bk?`<div class="grid kpis">${TCN_KENH.map(([k,n])=>{const x=kn(k);return kpi("Phải thu "+n,nf(Math.round(x.debt)),x.customers+" khách · nợ quá 90 ngày "+(x.debt?Math.round((x.b90p+x.old)/x.debt*100):0)+"% · DSO "+(x.dso!=null?x.dso+" ngày":"—"))}).join("")}</div>`:"";
  m.innerHTML=H(T,S)+`<div class="grid kpis">${kpi("Tổng phải thu",nf(Math.round(t.debt)),R.length===D0.rows.length?D0.rows.length+" khách đang nợ":"")}${kpi("Nợ quá 90 ngày (gồm nợ đầu kỳ)",nf(Math.round(late)),t.debt?pc(late)+"% tổng nợ":"")}${kpi("Số ngày thu tiền (DSO)",dso!=null?dso+" ngày":"—",dso!=null?"doanh thu 90 ngày gần nhất "+nf(Math.round(D0.rev90)):"chưa có doanh thu 90 ngày")}${kpi("Nợ trong 30 ngày",nf(Math.round(t.b30)),t.debt?pc(t.b30)+"% tổng nợ":"")}</div>${kenhRow}
  <p class="hint pad">Phải thu = công nợ chính thức (kế toán đã xác nhận) của khách còn nợ; khách trả thừa để riêng. Chưa có hạn nợ cho khách nên tuổi nợ tính từ ngày đơn (ngày phát sinh), chưa tính quá hạn. Đối chiếu từng khách, từng chứng từ: <button class="lnk" data-ptgo="tcn_dc">Đối chiếu công nợ & tiền →</button></p>
  ${/* Gọn lại (chị Hoa 29/10): tuổi nợ một thanh mảnh + chú thích một dòng, 10 khách nợ nhiều nhất thành bảng gọn một dòng một khách. */""}
  <div class="card pad ptgon"><div class="ptgon-h"><b>Nợ theo tuổi</b><span class="ptleg">${seg.map(x=>`<span><i class="${x[2]}"></i>${x[0].replace(" (từ trước khi dùng web)","")} <b>${nf(Math.round(t[x[1]]))}</b>${t.debt&&t[x[1]]?` <small class="hint">${pc(t[x[1]])}%</small>`:""}</span>`).join("")}</span></div>
   <div class="ptbar">${t.debt?seg.filter(x=>t[x[1]]>0).map(x=>`<span class="${x[2]}" style="flex:${t[x[1]]}" title="${x[0]}: ${nf(Math.round(t[x[1]]))}"></span>`).join(""):""}</div>
   ${D0.rows.length?(()=>{const top=D0.rows.slice().sort((a,b)=>b.official_debt-a.official_debt).slice(0,10),mx=top[0]?top[0].official_debt:1;
     return `<div class="ptgon-h" style="margin-top:12px"><b>10 khách nợ nhiều nhất</b></div><table class="gd pttop"><thead><tr><th>#</th><th>Khách</th><th>Phụ trách</th><th class="n">Tổng nợ</th><th class="n">Quá 90 ngày</th><th style="width:30%"></th></tr></thead><tbody>${top.map((r,k)=>{const l=r.b90p+r.old;return `<tr><td class="hint">${k+1}</td><td><b>${esc(r.customer_name)}</b></td><td class="hint">${esc(r.owner_name||"—")}</td><td class="n"><b>${nf(Math.round(r.official_debt))}</b></td><td class="n ${l?"nsr":""}">${l?nf(Math.round(l)):"—"}</td><td><div class="ptmini"><span style="width:${Math.round(r.official_debt/mx*100)}%"><i style="width:${r.official_debt?Math.round(l/r.official_debt*100):0}%"></i></span></div></td></tr>`}).join("")}</tbody></table>`})():""}</div>
  <div class="card pad"><div class="tlh"><b>Từng khách</b><span><input id="pt-q" class="mhq" placeholder="Tìm khách, người phụ trách…" value="${esc(PT.q||"")}"> <select id="pt-o">${opt([["","Tất cả khách"],["90","Có nợ trên 90 ngày"],["60","Có nợ 61–90 ngày"]],PT.only||"")}</select></span></div>
  <div class="nsw"><table class="tbl gd"><thead><tr><th>Khách</th><th>Kênh</th><th>Phụ trách</th><th class="n">Tổng nợ</th><th class="n">0–30</th><th class="n">31–60</th><th class="n">61–90</th><th class="n">&gt; 90</th><th class="n">Nợ đầu kỳ</th><th class="n">Đơn cũ nhất</th><th>Liên quan</th></tr></thead><tbody>${R.length?(typeof gdCat==="function"?gdCat(R,ptPg()):R).map(r=>`<tr><td><b>${esc(r.customer_name)}</b></td><td>${r.kenh==="GIA_CONG"?"Kênh OEM":"Kênh phân phối"}</td><td>${esc(r.owner_name||"—")}</td><td class="n"><b>${nf(Math.round(r.official_debt))}</b></td>${["b30","b60","b90","b90p","old"].map(k=>`<td class="n ${r[k]&&(k==="b90p"||k==="old")?"nsr":""}">${r[k]?nf(Math.round(r[k])):"—"}</td>`).join("")}<td class="n">${r.oldest_days?r.oldest_days+" ngày":"—"}</td><td>${tcnLk("Chứng từ",`data-ptct="${esc(r.customer_id)}" data-ptn="${esc(r.customer_name)}"`,"Xem từng đơn, phiếu thu, hàng trả lại")}</td></tr>`).join(""):`<tr><td colspan="11" class="empty">Không có khách nào.</td></tr>`}</tbody></table></div>${R.length&&typeof gdChan==="function"?gdChan(`<span>Cộng <b>${R.length}</b> khách${R.length<D0.rows.length?" (đang lọc)":""}</span><span>tổng nợ <b>${nf(Math.round(R.reduce((a,r)=>a+r.official_debt,0)))}</b></span><span>quá 90 ngày (gồm nợ đầu kỳ) <b>${nf(Math.round(R.reduce((a,r)=>a+r.b90p+r.old,0)))}</b></span>`,R.length,ptPg(),"pt"):""}
  <p class="hint">Tuổi nợ tính từ ngày đơn. Tiền khách trả trừ vào đơn cũ nhất trước. Nợ đầu kỳ là nợ thật chị đã nạp từ lúc bắt đầu dùng web, chưa biết ngày đơn nên tính là nợ lâu. Chi tiết từng khoản thu và đối soát xem ở tab Công nợ khách hàng.</p></div>`;
  const qi=m.querySelector("#pt-q");qi.oninput=()=>{PT.q=qi.value;ptPg().trang=1;const p=qi.selectionStart;renderMain();const n=document.querySelector("#pt-q");if(n){n.focus();n.setSelectionRange(p,p)}};
  m.querySelector("#pt-o").onchange=e=>{PT.only=e.target.value;ptPg().trang=1;renderMain()};
  m.querySelectorAll("[data-ptct]").forEach(el=>el.onclick=ev=>{ev.stopPropagation();tcnCtOpen("kh",el.dataset.ptct,null,el.dataset.ptn)});
  if(typeof gdChanBind==="function")gdChanBind(m,"pt",ptPg(),renderMain);
  m.querySelectorAll("[data-ptgo]").forEach(b=>b.onclick=()=>{PAGE=b.dataset.ptgo;renderMain();scrollTo(0,0)})}
const ptPg=()=>PT.pg||(PT.pg={co:typeof gdCoNho==="function"?gdCoNho("pt",100):100,trang:1});
PAGES.phai_thu=pPhaiThu;
