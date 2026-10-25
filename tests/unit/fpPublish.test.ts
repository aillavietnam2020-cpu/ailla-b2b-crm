import { describe, expect, it } from 'vitest';
import { buildPost, pickDue, type FpCard } from '../../src/server/services/fpPublish';

// 25/10/2026 10:30 giờ Việt Nam = 03:30 UTC
const NOW = new Date('2026-10-25T03:30:00Z');
const card = (o: Partial<FpCard> = {}): FpCard => ({ id: 'c1', step: 'dang', day: 25, thang: '2026-10', pageId: '123456', gio: '09:00', noiDung: 'Xin chào', ...o });

describe('pickDue: chỉ đăng bài đã duyệt, đúng ngày, tới giờ', () => {
  it('lấy bài tới giờ', () => expect(pickDue([card()], NOW)).toHaveLength(1));
  it('không lấy bài chưa duyệt', () => expect(pickDue([card({ step: 'dvd' })], NOW)).toHaveLength(0));
  it('không lấy bài chưa tới giờ', () => expect(pickDue([card({ gio: '11:00' })], NOW)).toHaveLength(0));
  it('không lấy bài trễ quá 6 giờ', () => expect(pickDue([card({ gio: '03:00' })], NOW)).toHaveLength(0));
  it('không lấy bài ngày khác hoặc tháng khác', () => {
    expect(pickDue([card({ day: 24 })], NOW)).toHaveLength(0);
    expect(pickDue([card({ thang: '2026-09' })], NOW)).toHaveLength(0);
  });
  it('không lấy bài thiếu page hoặc giờ', () => {
    expect(pickDue([card({ pageId: '' })], NOW)).toHaveLength(0);
    expect(pickDue([card({ gio: '' })], NOW)).toHaveLength(0);
  });
  it('không đăng lại bài đang gửi, đã đăng hoặc đã lỗi', () => {
    expect(pickDue([card({ fbState: 'sending' })], NOW)).toHaveLength(0);
    expect(pickDue([card({ fbPostId: '1_2' })], NOW)).toHaveLength(0);
    expect(pickDue([card({ fbState: 'error' })], NOW)).toHaveLength(0);
  });
  it('giờ lẻ phút: 10:15 đã tới, 10:45 chưa tới', () => {
    expect(pickDue([card({ gio: '10:15' })], NOW)).toHaveLength(1);
    expect(pickDue([card({ gio: '10:45' })], NOW)).toHaveLength(0);
  });
  it('lịch nhiều tháng: dùng ngày đầy đủ pdate', () => {
    expect(pickDue([card({ pdate: '2026-10-25', day: 3, thang: '2026-09' })], NOW)).toHaveLength(1);
    expect(pickDue([card({ pdate: '2026-11-25' })], NOW)).toHaveLength(0);
  });
  it('mỗi lần tối đa 5 bài', () => {
    const many = Array.from({ length: 8 }, (_, i) => card({ id: 'c' + i }));
    expect(pickDue(many, NOW)).toHaveLength(5);
  });
});

describe('buildPost: chọn kiểu đăng', () => {
  it('chữ + link landing', () => {
    const p = buildPost(card({ cta: 'Mua ngay', linkLanding: 'https://ailla.vn/x' }));
    expect(p.path).toBe('feed');
    expect(p.params.message).toBe('Xin chào\n\nMua ngay');
    expect(p.params.link).toBe('https://ailla.vn/x');
  });
  it('ảnh', () => expect(buildPost(card({ dangVideo: 'Ảnh', mediaUrl: 'https://a/b.jpg' })).path).toBe('photos'));
  it('video', () => expect(buildPost(card({ dangVideo: 'Video', mediaUrl: 'https://a/b.mp4' })).path).toBe('videos'));
});
