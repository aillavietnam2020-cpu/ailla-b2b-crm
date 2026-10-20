import os
b = r'G:\CODE\CRM\ailla-b2b-crm'

def rw(rel, pairs):
    p = os.path.join(b, rel)
    s = open(p, encoding='utf-8').read()
    for a, n in pairs:
        assert a in s, (rel, a[:80])
        s = s.replace(a, n, 1)
    open(p, 'w', encoding='utf-8').write(s)

# Helper: tháng đang chọn ở bộ chọn thời gian trên cùng của Trang quản trị (cùng nguồn, cùng sessionStorage).
open(os.path.join(b, r'src\client\lib\hubPeriod.ts'), 'w', encoding='utf-8').write('''/**
 * Khoảng thời gian chọn ở thanh trên cùng của Trang quản trị (Tháng này, Tháng trước, tuần, ngày...) được lưu ở
 * sessionStorage "ailla_period". Các trang CRM nhúng trong khung dùng cùng nguồn gốc nên đọc được, để chọn gì ở trên
 * thì số liệu theo tháng ở đây đổi theo. Khoảng kéo qua nhiều tháng thì lấy tháng của ngày kết thúc.
 */
export function hubPeriodMonth(): string | null {
  try {
    const s = JSON.parse(sessionStorage.getItem('ailla_period') ?? 'null') as { from?: string; to?: string } | null;
    const day = s?.to || s?.from;
    return day && /^\\d{4}-\\d{2}-\\d{2}/.test(day) ? day.slice(0, 7) : null;
  } catch {
    return null;
  }
}
''')

rw(r'src\client\pages\BonusPages.tsx', [
    ("import { vnDate } from '@shared/datetime';", "import { vnDate } from '@shared/datetime';\nimport { hubPeriodMonth } from '../lib/hubPeriod';"),
    ("  const [month, setMonth] = useState(vnDate().slice(0, 7));",
     "  // Mặc định theo khoảng thời gian đang chọn ở thanh trên cùng; vẫn đổi được tháng ngay tại đây.\n  const [month, setMonth] = useState(hubPeriodMonth() ?? vnDate().slice(0, 7));"),
])

# Danh sách khách + chi tiết khách: số liệu tháng theo tháng đang chọn.
rw(r'src\server\services\customers.ts', [
    ("""  sort?: string;
  page: number;
  pageSize: number;
}""", """  sort?: string;
  /** Tháng tính doanh số (YYYY-MM); bỏ trống là tháng hiện tại. */
  month?: string;
  page: number;
  pageSize: number;
}

const monthOf = (m?: string) => (m && /^\\d{4}-\\d{2}$/.test(m) ? m : null);
/** LIST_SQL tính doanh số theo tháng hiện tại; thay bằng tham số để xem tháng khác. */
const LIST_SQL_BY_MONTH = LIST_SQL.replace("strftime('%Y-%m', 'now', '+7 hours')", '?');"""),
    ("""  const rows = await db
    .prepare(
      `${LIST_SQL} AND ${clause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    )
    .bind(...params, sortByComputed ? 500 : filters.pageSize, sortByComputed ? 0 : offset)""",
     """  const month = monthOf(filters.month) ?? vnDate().slice(0, 7);
  const rows = await db
    .prepare(
      `${LIST_SQL_BY_MONTH} AND ${clause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    )
    .bind(month, ...params, sortByComputed ? 500 : filters.pageSize, sortByComputed ? 0 : offset)"""),
    ("  const retailByCustomer = await monthRetailByCustomer(db, vnDate().slice(0, 7));",
     "  const retailByCustomer = await monthRetailByCustomer(db, month);"),
    ("""  auth: AuthContext,
  customerId: string,
): Promise<CustomerDetail> {
  const row = await db
    .prepare(`${LIST_SQL} AND c.id = ?`)
    .bind(customerId)""", """  auth: AuthContext,
  customerId: string,
  monthParam?: string,
): Promise<CustomerDetail> {
  const month = monthOf(monthParam) ?? vnDate().slice(0, 7);
  const row = await db
    .prepare(`${LIST_SQL_BY_MONTH} AND c.id = ?`)
    .bind(month, customerId)"""),
    ("  const retail = (await monthRetailByCustomer(db, vnDate().slice(0, 7))).get(customerId) ?? 0;",
     "  const retail = (await monthRetailByCustomer(db, month)).get(customerId) ?? 0;"),
])
rw(r'src\server\routes\customers.ts', [
    ("""    sort: query.sort,
    page: query.page,""", """    sort: query.sort,
    month: c.req.query('month') ?? undefined,
    page: query.page,"""),
])
print('ok')
