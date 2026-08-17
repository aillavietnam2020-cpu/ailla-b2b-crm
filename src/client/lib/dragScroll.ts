/**
 * Giúp xem bảng rộng mà không phải mò cái thanh kéo bé tí ở đáy:
 *  - Bấm giữ chuột trên mặt bảng rồi kéo là bảng trượt theo (như kéo bản đồ).
 *  - Lăn chuột trên bảng chỉ cuộn ngang được thì cuộn ngang luôn.
 * Gắn một lần cho cả phần mềm, mọi bảng trong mọi trang đều có, không phải
 * sửa từng trang.
 */
const PAN_THRESHOLD = 4;
const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"]';

export function installTableScrolling(): () => void {
  let wrap: HTMLElement | null = null;
  let startX = 0;
  let startScroll = 0;
  let panning = false;

  const wrapOf = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Element)) return null;
    if (target.closest(INTERACTIVE)) return null;
    const found = target.closest('.table-wrap');
    return found instanceof HTMLElement && found.scrollWidth > found.clientWidth ? found : null;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const found = wrapOf(e.target);
    if (!found) return;
    wrap = found;
    startX = e.clientX;
    startScroll = found.scrollLeft;
    panning = false;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!wrap) return;
    const dx = e.clientX - startX;
    if (!panning && Math.abs(dx) < PAN_THRESHOLD) return;
    if (!panning) {
      panning = true;
      wrap.classList.add('is-panning');
      // Đang kéo bảng thì không cho bôi đen chữ, nếu không nhìn rất rối.
      document.body.style.userSelect = 'none';
    }
    wrap.scrollLeft = startScroll - dx;
    e.preventDefault();
  };

  const endPan = () => {
    if (!wrap) return;
    if (panning) {
      wrap.classList.remove('is-panning');
      document.body.style.userSelect = '';
      // Nuốt cú click sinh ra sau khi kéo, tránh bấm nhầm vào nút dưới con trỏ.
      window.addEventListener('click', swallowClick, { capture: true, once: true });
    }
    wrap = null;
    panning = false;
  };

  const swallowClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  /** Bảng chỉ thừa chiều ngang thì lăn chuột cho trượt ngang luôn. */
  const onWheel = (e: WheelEvent) => {
    const found = wrapOf(e.target) ?? closestWrap(e.target);
    if (!found) return;
    const canScrollY = found.scrollHeight > found.clientHeight + 1;
    if (canScrollY || e.shiftKey || e.deltaY === 0) return;
    const before = found.scrollLeft;
    found.scrollLeft += e.deltaY;
    if (found.scrollLeft !== before) e.preventDefault();
  };

  const closestWrap = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Element)) return null;
    const found = target.closest('.table-wrap');
    return found instanceof HTMLElement && found.scrollWidth > found.clientWidth ? found : null;
  };

  /** Bảng nào kéo ngang được thì hiện con trỏ bàn tay để người dùng biết. */
  const markPannable = () => {
    document.querySelectorAll<HTMLElement>('.table-wrap').forEach((el) => {
      el.classList.toggle('is-pannable', el.scrollWidth > el.clientWidth);
    });
  };

  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove, { passive: false });
  document.addEventListener('pointerup', endPan);
  document.addEventListener('pointercancel', endPan);
  document.addEventListener('wheel', onWheel, { passive: false });

  const observer = new MutationObserver(() => markPannable());
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', markPannable);
  markPannable();

  return () => {
    document.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', endPan);
    document.removeEventListener('pointercancel', endPan);
    document.removeEventListener('wheel', onWheel);
    window.removeEventListener('resize', markPannable);
    observer.disconnect();
  };
}
