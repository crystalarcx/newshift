// 2026 年自訂放假日（作為計算平日 / 假日時數使用）
export const HOLIDAYS_2026: Record<string, string> = {
  '2026-09-25': '假日 (9/25)',
  '2026-09-28': '假日 (9/28)',
  '2026-10-09': '假日 (10/9)',
  '2026-10-26': '假日 (10/26)',
  '2026-12-25': '假日 (12/25)',
};

/**
 * 判斷指定日期是否為 2026 年自訂假日
 * @param dateStr 格式通常為 YYYY-MM-DD
 */
export function isCustomHoliday(dateStr: string): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const formatted = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    return Boolean(HOLIDAYS_2026[formatted]);
  }
  return Boolean(HOLIDAYS_2026[dateStr]);
}

/**
 * 取得假日名稱或說明
 */
export function getHolidayName(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const formatted = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    return HOLIDAYS_2026[formatted];
  }
  return HOLIDAYS_2026[dateStr];
}

/**
 * 判斷指定日期是否為假日（包含週六、週日，以及 2026 年指定的放假日）
 * 使用本地年月日解析，避免 UTC 時區位移誤差
 */
export function isWeekendOrHoliday(dateStr: string): boolean {
  if (!dateStr) return false;
  if (isCustomHoliday(dateStr)) return true;

  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const day = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
    return day === 0 || day === 6;
  }

  const day = new Date(dateStr).getDay();
  return day === 0 || day === 6;
}
