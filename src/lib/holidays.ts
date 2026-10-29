// 2026 年預設放假日（作為計算平日 / 假日時數使用）
export const HOLIDAYS_2026: Record<string, string> = {
  '2026-09-25': '假日 (9/25)',
  '2026-09-28': '假日 (9/28)',
  '2026-10-09': '假日 (10/9)',
  '2026-10-26': '假日 (10/26)',
  '2026-12-25': '假日 (12/25)',
};

export const STORAGE_KEY_CUSTOM_HOLIDAYS = 'chimei_custom_holidays';

/**
 * 從 localStorage 取得使用者自訂假日列表 (支援記憶功能)
 */
export function getStoredCustomHolidays(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_HOLIDAYS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load custom holidays:', e);
    return [];
  }
}

/**
 * 儲存使用者自訂假日列表至 localStorage
 */
export function saveStoredCustomHolidays(holidays: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_HOLIDAYS, JSON.stringify(holidays));
  } catch (e) {
    console.error('Failed to save custom holidays:', e);
  }
}

/**
 * 判斷是否為使用者手動設定的自訂假日
 */
export function isUserCustomHoliday(dateStr: string, customHolidays?: string[]): boolean {
  if (!dateStr) return false;
  const userHolidays = customHolidays ?? getStoredCustomHolidays();
  if (userHolidays.includes(dateStr)) return true;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const formatted = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    return userHolidays.includes(formatted);
  }
  return false;
}

/**
 * 判斷指定日期是否為自訂假日 (包含 2026 預設放假日與使用者自訂放假日)
 * @param dateStr 格式通常為 YYYY-MM-DD
 */
export function isCustomHoliday(dateStr: string, customHolidays?: string[]): boolean {
  if (!dateStr) return false;
  if (isUserCustomHoliday(dateStr, customHolidays)) return true;

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
export function getHolidayName(dateStr: string, customHolidays?: string[]): string | undefined {
  if (!dateStr) return undefined;
  if (isUserCustomHoliday(dateStr, customHolidays)) {
    return '自訂假日';
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const formatted = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    return HOLIDAYS_2026[formatted];
  }
  return HOLIDAYS_2026[dateStr];
}

/**
 * 判斷是否為週末 (週六、週日)
 */
export function isWeekend(dateStr: string): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const day = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
    return day === 0 || day === 6;
  }
  const day = new Date(dateStr).getDay();
  return day === 0 || day === 6;
}

/**
 * 判斷指定日期是否為假日（包含週六、週日、2026 指定放假日，以及使用者自訂放假日）
 * 使用本地年月日解析，避免 UTC 時區位移誤差
 */
export function isWeekendOrHoliday(dateStr: string, customHolidays?: string[]): boolean {
  if (!dateStr) return false;
  if (isCustomHoliday(dateStr, customHolidays)) return true;
  return isWeekend(dateStr);
}
