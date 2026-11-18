/* =====================================================================
   ĐỐI SOÁT TIỀN VỀ FACEBOOK THEO THÁNG (cách chị Huệ dạy agent kế toán trưởng 17–18/11/2026, chị Hoa bảo web làm theo).
   Gốc là file "Đơn FB tháng …" xuất từ Pancake (mỗi đơn một mã vận đơn, COD một lần cho cả đơn).
   Ghép mã vận đơn với file tiền về của hãng: SPX (các tài khoản) trước, rồi Best (mỗi file một nguồn, đặt theo tên file).
   - Đơn FB ghi hoàn/trả: không tính doanh thu.
   - Đơn có trong file hãng và COD hãng thu > 0: đã về tiền, doanh thu = COD hãng thu (lệch với COD Facebook thì liệt kê để kiểm).
   - Đơn có trong file hãng mà COD hãng = 0: coi như hoàn, không tính.
   - Đơn không có trong file hãng: chưa về tiền, không tính, theo dõi kỳ sau.
   - Phí vận chuyển = phí hãng tính của mọi đơn tháng này có trong file hãng (kể cả đơn hoàn).
   Hàm thuần, nhận bảng (mảng các dòng) để test được. Giao diện ở fbds.js.
   ===================================================================== */
const fdsS=v=>v==null?"":String(v).trim();
const fdsN=v=>{if(v==null||v===""||v==="-")return 0;if(typeof v==="number")return v;const x=+String(v).replace(/VND|đ|\s/gi,"").replace(/,/g,"");return Number.isFinite(x)?x:0};
const fdsLow=s=>fdsS(s).normalize("NFC").toLowerCase();
/* Tìm dòng tiêu đề có ô "Mã vận đơn" trong 20 dòng đầu. */
function fdsHead(rows){for(let i=0;i<Math.min(rows.length,20);i++){const r=(rows[i]||[]).map(fdsLow);if(r.includes("mã vận đơn"))return {i,h:r}}return null}
const fdsCol=(h,pred)=>h.findIndex(pred);
/* File tiền về SPX: Mã vận đơn, Tiền thu hộ (A), Tổng phí phải trả (C). */
function fdsReadSpx(rows,file,S){const hd=fdsHead(rows);if(!hd)return 0;const h=hd.h;
  const cT=h.indexOf("mã vận đơn"),cC=fdsCol(h,x=>x.startsWith("tiền thu hộ")),cF=fdsCol(h,x=>x.startsWith("tổng phí phải trả")),cSt=h.indexOf("trạng thái vận đơn"),cD=h.indexOf("thời gian hoàn thành");
  if(cC<0)return 0;let n=0;
  for(let i=hd.i+1;i<rows.length;i++){const r=rows[i]||[],t=fdsS(r[cT]);if(!t)continue;
    S[t]={src:"SPX",file,cod:fdsN(r[cC]),fee:cF<0?0:fdsN(r[cF]),st:cSt<0?"":fdsS(r[cSt]),done:cD<0?"":fdsS(r[cD])};n++}
  return n}
/* File Best: mọi trang có cột Mã vận đơn; Số tiền COD trên phiếu thanh toán, Tổng cước vận chuyển. Nguồn = tên file. */
function fdsReadBest(sheets,file,T){let n=0;const src=fdsS(file).replace(/\.(xlsx|xls|csv)$/i,"");
  for(const rows of sheets){const hd=fdsHead(rows);if(!hd)continue;const h=hd.h;
    const cT=h.indexOf("mã vận đơn"),cC=h.indexOf("số tiền cod trên phiếu thanh toán"),cF=h.indexOf("tổng cước vận chuyển"),cSt=h.indexOf("trạng thái ký nhận"),cD=h.indexOf("thời gian ký nhận");
    if(cC<0)continue;
    for(let i=hd.i+1;i<rows.length;i++){const r=rows[i]||[],t=fdsS(r[cT]);if(!t)continue;
      T[t]={src,file,cod:fdsN(r[cC]),fee:cF<0?0:fdsN(r[cF]),st:cSt<0?"":fdsS(r[cSt]),done:cD<0?"":fdsS(r[cD])};n++}}
  return n}
/* File đơn FB (Pancake): dòng đầu là tiêu đề; dòng sản phẩm phụ của cùng đơn để trống mã đơn. */
function fdsReadFb(rows){const h=(rows[0]||[]).map(fdsLow),c=k=>h.indexOf(k);
  const cF=c("mã đơn hàng đầy đủ"),cT=c("mã vận đơn"),cC=c("cod"),cS=c("trạng thái"),cV=c("trạng thái vc"),cP=c("sản phẩm"),cQ=c("số lượng"),cG=c("đơn giá");
  if(cF<0||cT<0||cC<0)return null;
  const O={};let last=null;
  for(let i=1;i<rows.length;i++){const r=rows[i]||[],id=fdsS(r[cF]);
    if(id){last=O[id]={id,track:fdsS(r[cT]),cod:fdsN(r[cC]),st:fdsS(r[cS]),vc:cV<0?"":fdsS(r[cV]),sp:[]}}
    if(!last)continue;const p=cP<0?"":fdsS(r[cP]),q=cQ<0?0:fdsN(r[cQ]);if(p||q)last.sp.push([p,q,cG<0?0:fdsN(r[cG])])}
  return O}
/* Gộp: fb = bảng file đơn FB; spx = [{name, rows}]; best = [{name, sheets:[rows…]}]. */
function fdsBuild(fb,spx,best){const O=fdsReadFb(fb);if(!O)throw new Error("File đơn Facebook thiếu cột Mã đơn hàng đầy đủ / Mã vận đơn / COD");
  const S={},T={},src=[];
  (spx||[]).forEach(f=>src.push({name:f.name,loai:"SPX",n:fdsReadSpx(f.rows,f.name,S)}));
  (best||[]).forEach(f=>src.push({name:f.name,loai:"Best",n:fdsReadBest(f.sheets,f.name,T)}));
  const g={ve:[0,0,0],lech:[0,0,0],cod0:[0,0,0],chua:[0,0,0],hoan:[0,0,0]},list=[];let fee=0,codFb=0;
  for(const o of Object.values(O)){const x=S[o.track]||T[o.track]||null,hoan=/hoàn|trả/.test(fdsLow(o.st+" "+o.vc));codFb+=o.cod;
    if(x)fee+=x.fee;
    let k;if(hoan)k="hoan";else if(!x)k="chua";else if(!(x.cod>0))k="cod0";else k=Math.abs(o.cod-x.cod)>0.5?"lech":"ve";
    const a=g[k];a[0]++;a[1]+=o.cod;a[2]+=x?x.cod:0;
    list.push({id:o.id,track:o.track,st:o.st,cod:o.cod,src:x?x.src:"",codvc:x?x.cod:0,fee:x?x.fee:0,k,sp:o.sp})}
  const dt=g.ve[2]+g.lech[2],don=g.ve[0]+g.lech[0];
  return {list,src,sum:{don,dt,ship:fee,tong:list.length,codFb,g}}}
/* Tóm tắt gọn để lưu theo tháng (không mã đơn, không thông tin khách). */
function fdsSummary(R,ky,files){const s=R.sum;return {ky,don:s.don,dt:Math.round(s.dt),ship:Math.round(s.ship),tong:s.tong,codFb:Math.round(s.codFb),
  g:Object.fromEntries(Object.entries(s.g).map(([k,v])=>[k,v.map(Math.round)])),src:R.src.map(x=>({name:x.name,loai:x.loai,n:x.n})),files:files||[]}}
