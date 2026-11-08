/*
 * Các bước bấm trên Seller Center TikTok, viết thành hàm để script tải hằng ngày chạy KHÔNG cần AI.
 * Điều khiển Chrome của chị Hoa qua đường nối OpenClaw (`openclaw browser --browser-profile chrome ...`), giống hệt cách agent đang làm,
 * và dùng lại bat-tai.sh + lay-file.sh đã chạy tốt để file đi thẳng về VPS.
 *
 * LƯU Ý: các bước bấm dưới đây viết theo mô tả trong SKILL.md, CHƯA thử trên trang thật. Trang đổi giao diện thì sửa ở đây.
 * Chạy `node tai-tiktok-ngay.mjs --kham <url>` để in chữ + danh sách nút của một trang, dùng chỉnh các chữ bên dưới.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { msVN, nhanLoiTrang } from './tai-tiktok-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ENV = { ...process.env, XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || '/run/user/0' };
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

export class Chan extends Error {
  /** Lỗi cần DỪNG hẳn (không thử cách khác): loai = DANG_NHAP | XAC_MINH | MAT_CHROME */
  constructor(loai, chiTiet = '') {
    super(`${loai}${chiTiet ? ': ' + chiTiet : ''}`);
    this.loai = loai;
  }
}

export function taoDriver(profile = 'chrome') {
  const ob = (args, timeoutMs = 60000) => {
    try {
      return execFileSync('openclaw', ['browser', '--browser-profile', profile, ...args], { env: ENV, timeout: timeoutMs, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      const m = String(e.stderr || e.stdout || e.message || '');
      if (/No tabs|tab not found|has been closed|context was destroyed|timed out|Timeout|ECONNREFUSED|relay/i.test(m)) throw new Chan('MAT_CHROME', m.slice(0, 160));
      throw new Error(`openclaw browser ${args[0]} lỗi: ${m.slice(0, 200)}`);
    }
  };
  const bash = (script, args, timeoutMs = 600000) => {
    try {
      return execFileSync('bash', [join(here, script), ...args], { env: ENV, timeout: timeoutMs, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      throw new Error(`${script} lỗi: ${String(e.stdout || '').slice(-200)}${String(e.stderr || '').slice(-200)}`);
    }
  };
  const lastLine = (s) => {
    const l = String(s).trim().split('\n').pop().trim();
    if (l.startsWith('"')) {
      try { return JSON.parse(l); } catch { /* giữ nguyên */ }
    }
    return l;
  };
  const d = {
    profile,
    ob,
    bash,
    /** Chạy một đoạn JS (thân hàm) trong tab, trả chữ. */
    js(tab, body, timeoutMs = 60000) {
      return lastLine(ob(['evaluate', '--target-id', tab, '--fn', `() => { ${HELPER}; ${body} }`], timeoutMs));
    },
    /** Đọc trạng thái Chrome: ném MAT_CHROME nếu không có tab nào sau vài lần thử. */
    async khoiDong() {
      ob(['status'], 45000);
      for (let i = 0; i < 4; i++) {
        const t = ob(['tabs'], 45000);
        if (!/No tabs/i.test(t)) return t;
        await sleep(i === 0 ? 45 : 60);
      }
      throw new Chan('MAT_CHROME', 'Không có tab nào');
    },
    /** Mở url ở tab mới, trả id tab (t5...). */
    async mo(url) {
      const o = ob(['open', url], 60000);
      let tab = (o.match(/\b(t\d+)\b/) || [])[1];
      if (!tab) {
        const dau = url.split('?')[0].replace(/^https?:\/\//, '');
        const hang = ob(['tabs'], 45000).split('\n').filter((l) => l.includes(dau)).pop() || '';
        tab = (hang.match(/\b(t\d+)\b/) || [])[1];
      }
      if (!tab) throw new Error(`Không tìm thấy tab vừa mở cho ${url}`);
      await sleep(6);
      await d.canh(tab);
      return tab;
    },
    /** Nhìn trang: ném Chan nếu đòi đăng nhập / xác minh. */
    async canh(tab) {
      const s = d.js(tab, 'return location.href + "\\n@@\\n" + document.body.innerText.slice(0,4000)');
      const [u, ...rest] = s.split('\n@@\n');
      const loi = nhanLoiTrang(u, rest.join('\n'));
      if (loi) throw new Chan(loi, u.slice(0, 120));
      return { url: u, text: rest.join('\n') };
    },
    /** Bấm phần tử có đúng dòng chữ (khớp đúng trước, rồi khớp chứa). Trả true nếu bấm được. */
    bamChu(tab, chu, vung = '') {
      return d.js(tab, `return __ttx.bamChu(${JSON.stringify(chu)}, ${JSON.stringify(vung)})`) === 'OK';
    },
    bamCss(tab, css) {
      return d.js(tab, `return __ttx.bamCss(${JSON.stringify(css)})`) === 'OK';
    },
    coChu(tab, re) {
      return d.js(tab, `return /${re.source}/${re.flags}.test(document.body.innerText) ? "Y" : "N"`) === 'Y';
    },
    /** Đợi tới khi trang có chữ khớp, tối đa giây; luôn canh hộp đăng nhập/xác minh giữa chừng. */
    async doiChu(tab, re, giay = 60) {
      for (let i = 0; i < giay; i += 3) {
        if (d.coChu(tab, re)) return true;
        await sleep(3);
        await d.canh(tab);
      }
      return false;
    },
    /** Ghi lại chữ + nút của trang để người làm web chỉnh các bước bấm khi trang đổi giao diện. */
    kham(tab) {
      return d.js(tab, 'return __ttx.kham()', 60000);
    },
    gaiBay(tab) {
      bash('bat-tai.sh', [tab], 120000);
    },
    layFile(tab, dich, giay = 90) {
      const o = bash('lay-file.sh', [tab, dich, String(giay)], 900000);
      if (!existsSync(dich) || statSync(dich).size < 200) throw new Error(`File tải về trống: ${dich} (${o.trim().slice(0, 120)})`);
      return o.trim();
    },
    dong(tab) {
      try { ob(['close', '--target-id', tab], 30000); } catch { /* không sao */ }
    },
  };
  return d;
}

/* Bộ đồ nghề chạy trong trang (gắn vào mỗi lần evaluate vì chuyển trang là mất). */
const HELPER = `
if(!window.__ttx){ const N=s=>String(s||'').replace(/\\s+/g,' ').trim();
const vis=e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'};
const click=e=>{ const t=e.closest('button,a,[role=button],[role=menuitem],[role=tab],[role=option],li,label')||e; t.scrollIntoView({block:'center'});
  for(const ev of ['pointerdown','mousedown','pointerup','mouseup','click']) t.dispatchEvent(new MouseEvent(ev,{bubbles:true,cancelable:true,view:window})); return 'OK' };
window.__ttx={ N, vis, click,
 bamChu(chu, vung){ const root=vung?(document.querySelector(vung)||document):document; const all=[...root.querySelectorAll('button,a,[role=button],[role=menuitem],[role=tab],[role=option],li,label,span,div,p')].filter(vis);
  const dung=all.filter(e=>N(e.innerText||e.textContent)===chu); const chua=all.filter(e=>N(e.innerText||e.textContent).includes(chu));
  const dsc=(dung.length?dung:chua).sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height);
  return dsc.length?click(dsc[0]):'KHONG_THAY' },
 bamCss(css){ const e=[...document.querySelectorAll(css)].filter(vis)[0]; return e?click(e):'KHONG_THAY' },
 kham(){ const nut=[...document.querySelectorAll('button,a,[role=button],[role=tab],input,[aria-label]')].filter(vis).slice(0,150).map(e=>(e.tagName+' '+N(e.innerText||e.value||e.getAttribute('aria-label')||e.placeholder||'')+' | '+(e.className&&e.className.baseVal===undefined?String(e.className).slice(0,60):''))).join('\\n');
  return location.href+'\\n--- CHỮ ---\\n'+document.body.innerText.slice(0,3000)+'\\n--- NÚT ---\\n'+nut } } }`;

const DAU_THANG = /Tháng\s*(\d{1,2})[^\d]{0,6}(\d{4})|(\d{1,2})\s*\/\s*(\d{4})|(\d{4})\s*[-/]\s*(\d{2})/;

/** Chọn khoảng ngày trên bảng lịch đang mở (hai lần bấm: ngày đầu rồi ngày cuối, sau đó bấm OK/Áp dụng). */
async function chonKhoang(d, tab, from, to, xacNhan = ['OK', 'Áp dụng', 'Xác nhận']) {
  for (const iso of [from, to]) {
    const [y, m, dd] = iso.split('-').map(Number);
    let xong = false;
    for (let i = 0; i < 16 && !xong; i++) {
      const hienThi = d.js(tab, `const hs=[...document.querySelectorAll('[class*="picker" i] *, [class*="calendar" i] *, [role=dialog] *')].filter(__ttx.vis).map(e=>__ttx.N(e.innerText)).filter(t=>t.length<40&&${DAU_THANG}.test(t)); return hs.join(' || ')`);
      const thang = [...hienThi.matchAll(new RegExp(DAU_THANG, 'g'))].map((x) => (x[1] ? [+x[2], +x[1]] : x[3] ? [+x[4], +x[3]] : [+x[5], +x[6]]));
      const co = thang.some(([yy, mm]) => yy === y && mm === m);
      if (co) {
        const kq = d.js(tab, `const ds=[...document.querySelectorAll('[class*="picker" i] td, [class*="calendar" i] td, [role=gridcell], [class*="cell" i]')].filter(__ttx.vis).filter(e=>__ttx.N(e.innerText)==="${dd}" && !/disabled|out|other|prev|next/i.test(e.className+" "+(e.getAttribute('aria-disabled')||"")));
          if(!ds.length) return "KHONG_THAY"; const nhieu=ds.length>1; const t=ds[${thang.length > 1 && thang[1][0] === y && thang[1][1] === m ? 'ds.length-1' : '0'}]; return __ttx.click(t)+(nhieu?"+":"")`);
        if (kq.startsWith('OK')) { xong = true; break; }
      }
      const cu = thang.length ? thang[0][0] * 12 + thang[0][1] : 0;
      const dich = y * 12 + m;
      const lui = cu > dich;
      const bam = d.bamCss(tab, lui ? '[class*="prev" i], [aria-label*="prev" i], [aria-label*="trước" i]' : '[class*="next" i], [aria-label*="next" i], [aria-label*="sau" i]');
      if (!bam) throw new Error(`Không chuyển được tháng trên lịch (${iso})`);
      await sleep(1);
    }
    if (!xong) throw new Error(`Không chọn được ngày ${iso} trên lịch`);
    await sleep(1);
  }
  for (const t of xacNhan) if (d.bamChu(tab, t, '[role=dialog], [class*="picker" i], [class*="popover" i], [class*="popup" i]')) return;
}

function moLich(d, tab) {
  return d.bamCss(tab, 'input[placeholder*="/"], input[placeholder*="ngày" i], [class*="date-picker" i], [class*="datepicker" i], [class*="range-picker" i]');
}

/* ───────────────────────── Các file ───────────────────────── */

/** Quảng cáo GMV Max: ngày nằm sẵn trong đường dẫn, chỉ cần bấm nút tải sau ô ngày. */
export async function taiQuangCao(d, v, dich) {
  const tab = await d.mo(`https://seller-vn.tiktok.com/ads-creation/dashboard?mpa=1&type=product&list_start_date=${msVN(v.ads.from)}&list_end_date=${msVN(v.ads.to)}`);
  try {
    await d.doiChu(tab, /GMV|Chiến dịch|Campaign|Chi phí|Cost/i, 45);
    d.gaiBay(tab);
    const ok = d.bamCss(tab, '[class*="download" i], [aria-label*="download" i], [aria-label*="tải" i], [data-tid*="download" i]') || d.bamChu(tab, 'Tải xuống');
    if (!ok) throw new Error('Không thấy nút tải ở trang quảng cáo');
    return d.layFile(tab, dich);
  } finally {
    d.dong(tab);
  }
}

/** Đơn hàng: Bộ lọc → Thời gian đã tạo → Áp dụng → Xuất → Đơn hàng đã lọc + CSV → đợi Lịch sử xuất → Tải xuống. */
export async function taiDonHang(d, v, dich) {
  const tab = await d.mo('https://seller-vn.tiktok.com/order');
  try {
    await d.doiChu(tab, /Đơn hàng|Order/i, 45);
    if (!d.bamChu(tab, 'Bộ lọc')) throw new Error('Không thấy nút Bộ lọc (đơn hàng)');
    await sleep(2);
    d.bamChu(tab, 'Thời gian đã tạo');
    await sleep(2);
    if (!moLich(d, tab)) throw new Error('Không mở được ô ngày (đơn hàng)');
    await sleep(1);
    await chonKhoang(d, tab, v.ord.from, v.ord.to);
    await sleep(1);
    d.bamChu(tab, 'Áp dụng');
    await sleep(4);
    if (!d.bamChu(tab, 'Xuất')) throw new Error('Không thấy nút Xuất (đơn hàng)');
    await sleep(2);
    d.bamChu(tab, 'Đơn hàng đã lọc');
    d.bamChu(tab, 'CSV');
    await sleep(1);
    if (!d.bamChu(tab, 'Xuất', '[role=dialog], [class*="modal" i]')) throw new Error('Không bấm được Xuất trong hộp xuất đơn');
    await sleep(5);
    d.bamChu(tab, 'Lịch sử xuất');
    if (!(await d.doiChu(tab, /Tải xuống/, 300))) throw new Error('Đợi 5 phút file đơn chưa xuất xong');
    d.gaiBay(tab);
    if (!d.bamChu(tab, 'Tải xuống')) throw new Error('Không bấm được Tải xuống (đơn hàng)');
    return d.layFile(tab, dich, 120);
  } finally {
    d.dong(tab);
  }
}

/** Quyết toán income: Tài chính → Báo cáo → Xem theo đơn hàng → chọn ngày → Xuất (phải chọn lại 2 ngày trong popup) → Tải xuống. */
export async function taiQuyetToan(d, v, dich) {
  const tab = await d.mo('https://seller-vn.tiktok.com/finance/bills');
  try {
    await d.doiChu(tab, /Tài chính|Finance|Báo cáo/i, 45);
    d.bamChu(tab, 'Báo cáo');
    await sleep(3);
    d.bamChu(tab, 'Xem theo đơn hàng');
    await sleep(3);
    if (!moLich(d, tab)) throw new Error('Không mở được ô ngày (quyết toán)');
    await chonKhoang(d, tab, v.inc.from, v.inc.to);
    await sleep(3);
    if (!d.bamChu(tab, 'Xuất')) throw new Error('Không thấy nút Xuất (quyết toán)');
    await sleep(2);
    // Popup "Chọn phạm vi ngày để xuất" trống: bấm vào ô và chọn lại đúng 2 ngày rồi OK.
    if (!d.bamCss(tab, '[role=dialog] input, [class*="modal" i] input, [class*="date" i] input')) throw new Error('Không thấy ô ngày trong hộp xuất quyết toán');
    await chonKhoang(d, tab, v.inc.from, v.inc.to);
    if (!d.bamChu(tab, 'Xuất', '[role=dialog], [class*="modal" i]')) throw new Error('Không bấm được Xuất trong hộp quyết toán');
    await sleep(8);
    if (!(await d.doiChu(tab, /Đã xuất/, 360))) throw new Error('Đợi 6 phút file quyết toán chưa xuất xong');
    d.gaiBay(tab);
    if (!d.bamChu(tab, 'Tải xuống')) throw new Error('Không bấm được Tải xuống (quyết toán)');
    return d.layFile(tab, dich, 120);
  } finally {
    d.dong(tab);
  }
}

/** File team nhẹ (tuỳ chọn, thiếu thì bỏ qua): Key metrics, Video › Hiệu suất — ô ngày → Tùy chỉnh → ⬇. */
export async function taiTeamNhe(d, url, v, dich) {
  const tab = await d.mo(url);
  try {
    await sleep(6);
    if (!moLich(d, tab)) throw new Error('Không mở được ô ngày (file team)');
    d.bamChu(tab, 'Tùy chỉnh');
    await chonKhoang(d, tab, v.team.from, v.team.to);
    await sleep(4);
    d.gaiBay(tab);
    if (!d.bamCss(tab, '[class*="download" i], [aria-label*="download" i], [aria-label*="tải" i]')) throw new Error('Không thấy biểu tượng tải (file team)');
    return d.layFile(tab, dich);
  } finally {
    d.dong(tab);
  }
}

export const TEAM_NHE = [
  { loai: 'km', url: 'https://seller-vn.tiktok.com/compass/data-overview' },
  { loai: 'vdays', url: 'https://seller-vn.tiktok.com/compass/video-analytics' },
];
