import { describe, expect, it } from 'vitest';
import { fetchShippedLines } from '../../src/server/services/poscake';

/** Tách đơn Facebook Ads / CSKH (chị Hoa 16/11/2026): đơn nguồn "CSKH" trên Poscake ghi nguồn là CSKH, đơn landing giữ như cũ. */
describe('đơn Facebook nguồn CSKH', () => {
  it('ghi nguồn CSKH, không lẫn với landing', async () => {
    const t = '2026-11-12T03:00:00';
    const data = [
      { id: 1, status: 2, order_sources_name: 'CSKH', account: 'x', status_history: [{ status: 2, updated_at: t }], items: [{ quantity: 1, variation_info: { name: 'Nước giặt' } }] },
      { id: 2, status: 2, account: 'L1', status_history: [{ status: 2, updated_at: t }], items: [{ quantity: 2, variation_info: { name: 'Xịt ruồi' } }] },
    ];
    const fetchFn = async (url: string) => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(url.includes('/order_source') ? { data: [{ id: 'L1', name: 'Thảo-Muỗi' }] } : { total_pages: 1, data }),
    });
    const { lines } = await fetchShippedLines(fetchFn, 'FACEBOOK', 's', 'k', '2026-11-12', {});
    expect(lines.find((l) => l.order_id === '1')?.shop).toBe('CSKH');
    expect(lines.find((l) => l.order_id === '2')?.shop).toBe('Landing: Thảo-Muỗi');
  });
});
