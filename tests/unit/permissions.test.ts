import { describe, expect, it } from 'vitest';
import { effectivePermissions } from '../../src/shared/permissions';

describe('quyền nhập hàng hoàn (CEO 10/11)', () => {
  it('tài khoản chỉ Marketing vẫn giữ quyền kho.hoan', () => {
    const p = effectivePermissions('EMPLOYEE', ['hub.access', 'hub.only', 'kho.hoan']);
    expect(p).toContain('kho.hoan');
    expect(p).not.toContain('sx.kiemke');
    expect(effectivePermissions('EMPLOYEE', ['hub.access', 'hub.only'])).not.toContain('kho.hoan');
  });
});
