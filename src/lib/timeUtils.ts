/**
 * 依據起時 (HHMM) 與迄時 (HHMM) 計算加班時數
 * @param startTime 4 碼數字字串，例如 "1730"
 * @param endTime 4 碼數字字串，例如 "1930"
 * @param fallback 若格式尚未填滿或無效時的回退時數
 */
export function calcOvertimeHours(startTime: string, endTime: string, fallback: number = 0): number {
  if (!startTime || !endTime) return fallback;
  
  const cleanStart = startTime.replace(/[^0-9]/g, '');
  const cleanEnd = endTime.replace(/[^0-9]/g, '');

  if (cleanStart.length !== 4 || cleanEnd.length !== 4) {
    return fallback;
  }

  const sh = parseInt(cleanStart.substring(0, 2), 10);
  const sm = parseInt(cleanStart.substring(2, 4), 10);
  const eh = parseInt(cleanEnd.substring(0, 2), 10);
  const em = parseInt(cleanEnd.substring(2, 4), 10);

  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) {
    return fallback;
  }

  if (sh < 0 || sh > 23 || sm < 0 || sm > 59 || eh < 0 || eh > 23 || em < 0 || em > 59) {
    return fallback;
  }

  let hrs = (eh + em / 60) - (sh + sm / 60);
  if (hrs < 0) {
    // 跨午夜計算，例如 23:00 至 01:00 => 2 小時
    hrs += 24;
  } else if (hrs === 0) {
    return 0;
  }

  // 四捨五入至小數點後第一位
  return Math.round(hrs * 10) / 10;
}
