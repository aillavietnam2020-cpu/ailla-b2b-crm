import { describe, expect, it } from 'vitest';
import { aiSensitive, hasQty, ORDER_WORDS, orderSignal, pickPlaybook } from '@shared/zalo';

/** Cài AI soạn sẵn (chị Hoa duyệt 27/11): từ khóa để người thật xử lý, luật gợi ý lên đơn. */
describe('từ khóa để người thật xử lý', () => {
  it('so theo nguyên chữ, không bắt nhầm "ý kiến", "kiện hàng"', () => {
    expect(aiSensitive('em xin ý kiến anh')).toBeNull();
    expect(aiSensitive('giao 2 kiện hàng nhé')).toBeNull();
    expect(aiSensitive('chị sẽ kiện bên em')).toBe('kiện');
    expect(aiSensitive('chi se kien ra toa')).toBe('kiện'); // khách gõ không dấu
    expect(aiSensitive('hàng lỗi rồi em')).toBe('hàng lỗi');
    expect(aiSensitive('em muốn hủy hợp đồng')).toBe('huỷ hợp đồng'); // hủy / huỷ đều trúng
    expect(aiSensitive('em muốn HOAN TIEN')).toBe('hoàn tiền');
  });
});

describe('khi nào gợi ý lên đơn', () => {
  const k = (s: string, m: 'clear' | 'ask' = 'clear') => orderSignal(s, m, ORDER_WORDS)?.kind ?? null;
  it('chỉ khi có từ đặt hàng VÀ có số lượng', () => {
    expect(k('Đợt này nước giặt 3.6kg giá sao em?')).toBeNull();
    expect(k('Bên kia báo 92k thôi em')).toBeNull();
    expect(k('Lấy cho anh 30 thùng nước giặt, ship luôn nhé')).toBe('order');
    expect(k('Chốt 10 thùng lau sàn sả chanh')).toBe('order');
    expect(k('lay cho anh 5 thung')).toBe('order');
    expect(k('anh đặt hàng nhé')).toBeNull(); // không có số lượng
    expect(k('lấy giá thế nào em')).toBeNull();
  });
  it('chế độ hỏi sale: khách nhắc số lượng thì hỏi; chế độ tắt thì không gì', () => {
    expect(k('giá 20 thùng bao nhiêu em', 'ask')).toBe('ask');
    expect(k('giá 20 thùng bao nhiêu em')).toBeNull();
    expect(orderSignal('chốt 10 thùng', 'off', ORDER_WORDS)).toBeNull();
    expect(hasQty('3.6kg')).toBe(false);
  });
  it('kịch bản khớp từ khóa trước, theo ưu tiên', () => {
    const e = (title: string, keywords: string[], priority: number) => ({ id: title, title, category: '', keywords, content: 'x', priority, enabled: 1 });
    const r = pickPlaybook([e('Giao hàng', ['giao', 'ship'], 60), e('Bảng giá', ['giá', 'bao nhiêu'], 90), e('Chung', [], 10)], 'giá bao nhiêu em, ship được không');
    expect(r.map((x) => x.title)).toEqual(['Bảng giá', 'Giao hàng', 'Chung']);
  });
});
