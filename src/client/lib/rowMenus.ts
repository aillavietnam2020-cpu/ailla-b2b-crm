/**
 * Nút "⋯" cho cột thao tác của bảng: các nút phụ (Xóa, Khoá, Hủy...) gom vào một menu nhỏ, nút chính vẫn hiện sẵn.
 * Nút gốc chỉ bị ẩn; bấm trong menu là bấm nút gốc nên hộp xác nhận và thao tác cũ giữ nguyên.
 * Giống hệt cách làm ở khung Trang quản trị (hub/src/rowmenu.js).
 */
const SECONDARY = /^(xóa|xoá|ngừng dùng|ngừng bán|dùng lại|khóa|khoá|mở khóa|mở khoá|hủy|huỷ|gỡ|ẩn|lưu trữ|nhân bản|vô hiệu)(\s|$)/i;

function closePop() {
  document.querySelector('.rmpop')?.remove();
}

function scan() {
  document.querySelectorAll<HTMLTableRowElement>('table tbody tr').forEach((tr) => {
    if (tr.dataset.rm) return;
    const td = tr.lastElementChild as HTMLElement | null;
    if (!td || td.tagName !== 'TD') return;
    if (td.querySelector('input,select,textarea,.rmb')) return;
    const ctl = [...td.querySelectorAll<HTMLButtonElement>('button')].filter((x) => !x.classList.contains('rmb'));
    if (ctl.length < 2) return;
    const sec = ctl.filter((x) => SECONDARY.test((x.textContent ?? '').replace(/\s+/g, ' ').trim()) && !x.disabled);
    if (!sec.length) return;
    tr.dataset.rm = '1';
    sec.forEach((x) => {
      x.style.display = 'none';
    });
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn sm rmb';
    b.textContent = '⋯';
    b.title = 'Thêm thao tác';
    b.setAttribute('aria-label', 'Thêm thao tác');
    b.onclick = (e) => {
      e.stopPropagation();
      const had = document.querySelector<HTMLElement & { _src?: HTMLElement }>('.rmpop');
      const mine = had && (had as unknown as { _src?: HTMLElement })._src === b;
      closePop();
      if (mine) return;
      const r = b.getBoundingClientRect();
      const pop = document.createElement('div') as HTMLDivElement & { _src?: HTMLElement };
      pop.className = 'rmpop';
      pop._src = b;
      pop.style.top = `${Math.min(r.bottom + 4, window.innerHeight - (sec.length * 38 + 16))}px`;
      pop.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
      sec.forEach((x) => {
        const it = document.createElement('button');
        it.type = 'button';
        const t = (x.textContent ?? '').replace(/\s+/g, ' ').trim();
        it.textContent = t;
        if (/^(xóa|xoá)/i.test(t)) it.className = 'dg';
        it.onclick = (ev) => {
          ev.stopPropagation();
          closePop();
          x.click();
        };
        pop.appendChild(it);
      });
      document.body.appendChild(pop);
    };
    td.appendChild(document.createTextNode(' '));
    td.appendChild(b);
  });
}

export function installRowMenus(): () => void {
  let timer: number | null = null;
  const run = () => {
    timer = null;
    scan();
  };
  const obs = new MutationObserver(() => {
    if (timer === null) timer = window.setTimeout(run, 80);
  });
  obs.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', closePop);
  window.addEventListener('scroll', closePop, true);
  run();
  return () => {
    obs.disconnect();
    document.removeEventListener('click', closePop);
    window.removeEventListener('scroll', closePop, true);
    closePop();
  };
}
