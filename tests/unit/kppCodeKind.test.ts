import { describe, expect, it } from 'vitest';
import { codeKind } from '../../src/server/services/kppCode';

/** Mọi mã kho đều tạo được mã bán khi lên đơn (chị Hoa 14/11): nhóm và kiểu mã theo loại hàng. */
describe('mã bán tạo từ mã kho', () => {
  it('thành phẩm (vd Arila 2kg): mã bán = mã kho, không nhóm quà / vật tư', () => {
    expect(codeKind('TP')).toEqual({ group: null, prefix: false });
    expect(codeKind('BTP')).toEqual({ group: null, prefix: false });
    expect(codeKind('COMBO')).toEqual({ group: null, prefix: false });
  });
  it('hàng hóa / quà giữ quy ước QUA-, vật tư vào nhóm vật tư bán kèm', () => {
    expect(codeKind('HH')).toEqual({ group: 'QUA_TANG', prefix: true });
    expect(codeKind('NVL')).toEqual({ group: 'VAT_TU_BAN', prefix: false });
    expect(codeKind('CCDC')).toEqual({ group: 'VAT_TU_BAN', prefix: false });
  });
});
