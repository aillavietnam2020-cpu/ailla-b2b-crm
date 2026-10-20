/**
 * Điện thoại: mỗi dòng của bảng hiện thành một "thẻ" (cột đầu là tiêu đề, các cột còn lại là
 * "tên cột: giá trị") thay vì bắt người dùng vuốt ngang. Chỉ gắn nhãn cho ô; phần hiển thị
 * do CSS (styles.css, khối "Thẻ trên điện thoại") quyết định, nên máy tính không bị ảnh hưởng.
 * Gắn một lần cho cả phần mềm, không phải sửa từng trang.
 */
const NARROW = '(max-width: 760px)';

function labelTable(table: HTMLTableElement): void {
  const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
  if (!headRow) return;
  const labels = Array.from(headRow.cells).map((c) => (c.textContent ?? '').trim());
  for (const body of Array.from(table.tBodies)) {
    for (const row of Array.from(body.rows)) {
      Array.from(row.cells).forEach((cell, i) => {
        if (cell.colSpan > 1) {
          cell.dataset.span = '1';
          return;
        }
        const label = labels[i] ?? '';
        if (cell.dataset.label !== label) cell.dataset.label = label;
        const hollow = (cell.textContent ?? '').trim() === '' && !cell.querySelector('button,a,input,select,textarea,img');
        if (hollow) cell.dataset.empty = '1';
        else delete cell.dataset.empty;
      });
    }
  }
}

export function installMobileTables(): () => void {
  const mq = window.matchMedia(NARROW);
  let timer = 0;
  const run = () => {
    if (!mq.matches) return;
    document
      .querySelectorAll<HTMLTableElement>('.table-wrap table.data')
      .forEach((t) => labelTable(t));
  };
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(run, 80);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  mq.addEventListener('change', schedule);
  schedule();
  return () => {
    observer.disconnect();
    mq.removeEventListener('change', schedule);
    window.clearTimeout(timer);
  };
}
