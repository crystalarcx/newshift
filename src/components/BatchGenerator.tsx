import React, { useState, useEffect } from 'react';
import { OvertimeRecord, OvertimeType } from '../types';
import { Calendar, Plus, Zap, CheckSquare, Square, Clock, AlertCircle, FileText, Sparkles, Filter, Upload, X, CloudUpload, CloudDownload, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface BatchGeneratorProps {
  records: OvertimeRecord[];
  onAddRecords: (records: OvertimeRecord[]) => void;
  onRemoveRecordsByDate: (dateStr: string, source?: 'auto' | 'custom') => void;
  targetMonth: string;
  setTargetMonth: (m: string) => void;
  weekdayHours: number;
  weekendHours: number;
  employeeId: string;
  setEmployeeId: (id: string) => void;
}

export const BatchGenerator: React.FC<BatchGeneratorProps> = ({
  records,
  onAddRecords,
  onRemoveRecordsByDate,
  targetMonth,
  setTargetMonth,
  weekdayHours,
  weekendHours,
  employeeId,
  setEmployeeId,
}) => {
  const [overtimeType, setOvertimeType] = useState<OvertimeType>('延時加班');
  
  // Selection presets

  // Custom multi-select date array for current month
  const selectedDates = Array.from(new Set(records.filter(r => r.source === 'auto' && r.date.startsWith(targetMonth)).map(r => r.date)));
  const customSelectedDates = Array.from(new Set(records.filter(r => r.source === 'custom' && r.date.startsWith(targetMonth)).map(r => r.date)));

  // CSV Import States
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [encoding, setEncoding] = useState('utf-8');
  const [shiftSchedule, setShiftSchedule] = useState<Record<string, string>>({});
  const [importStatus, setImportStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
  
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleUploadExcelToCloud = async () => {
    if (csvData.length < 3) {
      setImportStatus({ type: 'error', message: '請先選擇並成功讀取 Excel 檔案！' });
      return;
    }
    const password = window.prompt('請輸入全院班表上傳密碼：');
    if (password !== 'A30825ER') {
      if (password !== null) alert('密碼錯誤！');
      return;
    }
    setIsUploading(true);
    setImportStatus({ type: 'idle', message: '正在上傳全院班表至雲端...' });
    try {
      // JSON stringify the 2D array to bypass Firestore array/field limitations easily
      const compressedData = JSON.stringify(csvData);
      await setDoc(doc(db, 'schedules', 'global_schedule'), {
        lastUpdated: new Date().toISOString(),
        csvData: compressedData,
      });
      setImportStatus({ type: 'success', message: '全院班表上傳雲端成功！其他同仁現在可以透過人事號帶入班表了。' });
    } catch (error) {
      console.error('Upload failed:', error);
      setImportStatus({ type: 'error', message: '上傳失敗，請檢查網路連線或設定。' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadExcelFromCloud = async () => {
    setIsDownloading(true);
    setImportStatus({ type: 'idle', message: '正在從雲端下載最新全院班表...' });
    try {
      const docSnap = await getDoc(doc(db, 'schedules', 'global_schedule'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.csvData) {
          const parsedCsv = JSON.parse(data.csvData);
          if (Array.isArray(parsedCsv) && parsedCsv.length > 0) {
            setCsvData(parsedCsv);
            setImportStatus({ type: 'success', message: '雲端班表下載成功！請在右方輸入人事號帶入月曆。' });
          } else {
            setImportStatus({ type: 'error', message: '雲端班表格式異常。' });
          }
        } else {
          setImportStatus({ type: 'error', message: '雲端尚無有效的班表資料。' });
        }
      } else {
        setImportStatus({ type: 'error', message: '雲端尚無班表資料，請先上傳。' });
      }
    } catch (error) {
      console.error('Download failed:', error);
      setImportStatus({ type: 'error', message: '下載失敗，請檢查網路連線。' });
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (!csvFile) {
      setCsvData([]);
      setImportStatus({ type: 'idle', message: '' });
      return;
    }

    if (csvFile.name.toLowerCase().endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/);
        const parsed = lines.map(line => line.split(',').map(cell => cell.trim()));
        setCsvData(parsed);
        setImportStatus({ type: 'idle', message: '' });
      };
      reader.readAsText(csvFile, encoding);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const aoa = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
          const stringData = aoa.map(row => row.map(cell => String(cell).trim()));
          setCsvData(stringData);
          setImportStatus({ type: 'idle', message: '' });
        } catch (error) {
          console.error(error);
          setImportStatus({ type: 'error', message: 'Excel 檔案解析失敗，請確認檔案格式是否正確。' });
        }
      };
      reader.readAsArrayBuffer(csvFile);
    }
  }, [csvFile, encoding]);

  const handleExtractSchedule = () => {
    setImportStatus({ type: 'idle', message: '' });
    if (csvData.length < 3) {
      setImportStatus({ type: 'error', message: '檔案格式不正確或尚未成功讀取檔案。' });
      return;
    }
    
    // Find the row that contains "人事號"
    let employeeRowIndex = -1;
    let dayColIndex = -1;
    
    for (let i = 0; i < Math.min(csvData.length, 10); i++) {
      const colIdx = csvData[i].findIndex(cell => cell.includes('人事號'));
      if (colIdx !== -1) {
        employeeRowIndex = i;
        dayColIndex = colIdx;
        break;
      }
    }

    if (employeeRowIndex === -1) {
      setImportStatus({ type: 'error', message: '無法在檔案前 10 列找到「人事號」欄位，請確認檔案格式。' });
      return;
    }

    const employeeRow = csvData[employeeRowIndex];

    const targetId = employeeId.trim();
    const targetColIndex = employeeRow.findIndex(cell => cell === targetId || cell.replace(/['"]/g, '') === targetId);
    
    if (targetColIndex === -1) {
      setImportStatus({ type: 'error', message: `找不到人事號: ${targetId}，請確認輸入是否正確。` });
      return;
    }

    const newSchedule: Record<string, string> = {};
    let count = 0;
    
    for (let i = employeeRowIndex + 1; i < csvData.length; i++) {
      const row = csvData[i];
      if (!row || row.length <= targetColIndex) continue;
      
      const cellValue = row[dayColIndex]?.trim() || '';
      
      if (/^\d{1,2}$/.test(cellValue)) {
        const dayNum = parseInt(cellValue, 10);
        if (dayNum >= 1 && dayNum <= 31) {
          const shiftCode = row[targetColIndex]?.trim();
          if (shiftCode) {
            const [y, m] = targetMonth.split('-');
            const dateStr = `${y}-${m}-${String(dayNum).padStart(2, '0')}`;
            newSchedule[dateStr] = shiftCode;
            count++;
          }
        }
      }
    }

    if (count === 0) {
      setImportStatus({ type: 'error', message: `該人事號 (${targetId}) 當月沒有班表資料。` });
    } else {
      setShiftSchedule(newSchedule);
      
      const generatedRecords: OvertimeRecord[] = [];
      const newSelectedDates: string[] = [];

      Object.entries(newSchedule).forEach(([dateStr, shiftCode]) => {
        const recordsToAdd = generateRecordsForDate(dateStr, shiftCode);
        if (recordsToAdd.length > 0) {
          newSelectedDates.push(dateStr);
          generatedRecords.push(...recordsToAdd);
        }
      });

      if (generatedRecords.length > 0) {
        onAddRecords(generatedRecords);
        setImportStatus({ type: 'success', message: `成功帶入 ${count} 筆班表，並自動產生了 ${generatedRecords.length} 筆加班紀錄！` });
      } else {
        setImportStatus({ type: 'success', message: `成功帶入 ${count} 筆班表資料，但沒有符合自動加班規則的班表代號。` });
      }
    }
  };

  const getShiftMapping = () => {
    return {
        "S": [{ start: '0700', end: '0800' }, { start: '1700', end: '1900' }],
        "T": [{ start: '0700', end: '0800' }, { start: '1700', end: '1900' }],
        "H": [{ start: '0700', end: '0800' }, { start: '1700', end: '1900' }],
        "◇D": [{ start: '0700', end: '0800' }, { start: '1700', end: '1900' }],
        "D*": [{ start: '0700', end: '0800' }, { start: '1700', end: '1900' }],
        "佳D": [{ start: '0700', end: '0800' }, { start: '1700', end: '1900' }],
        "δ": [{ start: '0700', end: '0800' }, { start: '1800', end: '2000' }],
        "柳δ": [{ start: '0700', end: '0800' }, { start: '1800', end: '2000' }],
        "d'": [{ start: '0700', end: '0800' }, { start: '1800', end: '2000' }],
        "d'2": [{ start: '0700', end: '0800' }, { start: '1800', end: '2000' }],
        "d%": [{ start: '0700', end: '0800' }, { start: '1800', end: '2000' }],
        "D#": [{ start: '0700', end: '0800' }, { start: '1700', end: '1900' }],
        "◇d'": [{ start: '0700', end: '0800' }, { start: '1800', end: '2000' }],
        "!D": [{ start: '0700', end: '0800' }, { start: '1800', end: '2000' }],
        "!D1": [{ start: '0700', end: '0800' }, { start: '1800', end: '2000' }],
        "!D2": [{ start: '0700', end: '0800' }, { start: '1800', end: '2000' }],
        "!D3": [{ start: '0700', end: '0800' }, { start: '1800', end: '2000' }],
        "D2": [{ start: '0600', end: '0700' }, { start: '1800', end: '2000' }],
        "D": [{ start: '0600', end: '0700' }, { start: '1800', end: '2000' }],
        "○D": [{ start: '0600', end: '0700' }, { start: '1800', end: '2000' }],
        "A": [{ start: '0600', end: '0800' }, { start: '2100', end: '2300' }],
        "a'": [{ start: '0600', end: '0800' }, { start: '2100', end: '2300' }],
        "○A": [{ start: '0600', end: '0800' }, { start: '2100', end: '2300' }],
        "柳A": [{ start: '0600', end: '0800' }, { start: '2100', end: '2300' }],
        "柳a'": [{ start: '0600', end: '0800' }, { start: '2100', end: '2300' }],
        "佳A": [{ start: '0600', end: '0800' }, { start: '2100', end: '2300' }],
        "佳a'": [{ start: '0600', end: '0800' }, { start: '2100', end: '2300' }],
        "A*": [{ start: '0600', end: '0800' }, { start: '2100', end: '2300' }],
        "a'*": [{ start: '0600', end: '0800' }, { start: '2100', end: '2300' }],
        "佳P": [{ start: '0600', end: '0800' }, { start: '2100', end: '2300' }],
        "柳D": [{ start: '0645', end: '0745' }, { start: '1630', end: '1930' }],
        
        // New night/cross-day shifts
        "E": [{ start: '1400', end: '1600' }, { start: '0100', end: '0300', isNextDay: true }],
        "E2": [{ start: '1400', end: '1600' }, { start: '0100', end: '0300', isNextDay: true }],
        "e'": [{ start: '1400', end: '1600' }, { start: '0100', end: '0300', isNextDay: true }],
        "e'2": [{ start: '1400', end: '1600' }, { start: '0100', end: '0300', isNextDay: true }],
        "○E": [{ start: '1400', end: '1600' }, { start: '0100', end: '0300', isNextDay: true }],
        "E*": [{ start: '1400', end: '1600' }, { start: '0100', end: '0300', isNextDay: true }],
        "◇E": [{ start: '1400', end: '1600' }, { start: '0100', end: '0300', isNextDay: true }],
        "E#": [{ start: '1400', end: '1600' }, { start: '0100', end: '0300', isNextDay: true }],
        "佳E": [{ start: '1400', end: '1600' }, { start: '0100', end: '0300', isNextDay: true }],
        "!E": [{ start: '1400', end: '1600' }, { start: '0100', end: '0300', isNextDay: true }],
        "柳E": [{ start: '1345', end: '1545' }, { start: '0030', end: '0230', isNextDay: true }],
        
        "柳C": [{ start: '0900', end: '1000' }, { start: '2300', end: '0000' }, { start: '0000', end: '0100', isNextDay: true }],
        "佳C": [{ start: '0900', end: '1000' }, { start: '2300', end: '0000' }, { start: '0000', end: '0100', isNextDay: true }],
        "C": [{ start: '0900', end: '1000' }, { start: '2300', end: '0000' }, { start: '0000', end: '0100', isNextDay: true }],
        
        "柳Q": [{ start: '1100', end: '1200' }, { start: '0100', end: '0300', isNextDay: true }],
        "佳Q": [{ start: '1100', end: '1200' }, { start: '0100', end: '0300', isNextDay: true }],
        "Q": [{ start: '1100', end: '1200' }, { start: '0100', end: '0300', isNextDay: true }],
        
        "B": [{ start: '1900', end: '2000' }, { start: '0900', end: '1100', isNextDay: true }],
        "○B": [{ start: '1900', end: '2000' }, { start: '0900', end: '1100', isNextDay: true }],
        "b'": [{ start: '1800', end: '2000' }, { start: '0900', end: '1100', isNextDay: true }],
        "B＊": [{ start: '1900', end: '2000' }, { start: '0900', end: '1100', isNextDay: true }],
        "柳B": [{ start: '1900', end: '2000' }, { start: '0900', end: '1100', isNextDay: true }],
        "柳b'": [{ start: '1900', end: '2000' }, { start: '0900', end: '1100', isNextDay: true }],
        "佳B": [{ start: '1800', end: '2000' }, { start: '0900', end: '1100', isNextDay: true }],
        
        "N": [{ start: '2200', end: '2300' }, { start: '0900', end: '1100', isNextDay: true }],
        "○N": [{ start: '2100', end: '2300' }, { start: '0900', end: '1100', isNextDay: true }],
        "n'": [{ start: '2100', end: '2300' }, { start: '0900', end: '1100', isNextDay: true }],
        "!N": [{ start: '2100', end: '2300' }, { start: '0900', end: '1100', isNextDay: true }],
        "N＊": [{ start: '2130', end: '2330' }, { start: '0830', end: '1030', isNextDay: true }],
        
        "◇e'": [{ start: '1500', end: '1600' }, { start: '0000', end: '0200', isNextDay: true }],
        
        "△D": [{ start: '0700', end: '0800' }, { start: '1700', end: '1900' }],
        "△E": [{ start: '1500', end: '1600' }, { start: '0100', end: '0300', isNextDay: true }],
        
        "K": [{ start: '1000', end: '1100' }, { start: '0000', end: '0200', isNextDay: true }],
        "柳K": [{ start: '1000', end: '1100' }, { start: '0000', end: '0200', isNextDay: true }],
        "佳K": [{ start: '1000', end: '1100' }, { start: '0000', end: '0200', isNextDay: true }]
    };
  };

  const generateRecordsForDate = (dateStr: string, shiftCode: string): OvertimeRecord[] => {
    const shiftMapping = getShiftMapping();
    const generated: OvertimeRecord[] = [];
    
    let times = shiftMapping[shiftCode];
    if (!times) {
       const normalizeStr = (s: string) => {
         return s
           .replace(/[\uff01-\uff5e]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
           .replace(/\s+/g, '')
           .toLowerCase();
       };
       
       const targetNormalized = normalizeStr(shiftCode);
       const normalizedCode = Object.keys(shiftMapping).find(k => normalizeStr(k) === targetNormalized);
       
       if (normalizedCode) times = shiftMapping[normalizedCode];
    }

    if (times) {
      times.forEach(t => {
        let targetDate = dateStr;
        if (t.isNextDay) {
          const [y, m, d] = dateStr.split('-');
          const dateObj = new Date(Number(y), Number(m) - 1, Number(d) + 1);
          targetDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        }

        const sh = parseInt(t.start.substring(0, 2), 10);
        const sm = parseInt(t.start.substring(2, 4), 10);
        const eh = parseInt(t.end.substring(0, 2), 10);
        const em = parseInt(t.end.substring(2, 4), 10);
        
        let hrs = (eh + em/60) - (sh + sm/60);
        if (hrs <= 0) hrs += 24; 

        generated.push({
          id: `${dateStr}_${t.start}_${Math.random().toString(36).substring(2, 7)}`,
          date: targetDate,
          startTime: t.start,
          endTime: t.end,
          hours: Number(hrs.toFixed(1)),
          type: overtimeType,
          reason: '臨床處置、病患照護與寫病歷',
          status: 'pending',
          source: 'auto',
        });
      });
    }
    
    return generated;
  };

  // Calculate days in selected month
  const getDaysInMonth = (yearMonthStr: string) => {
    const [yearStr, monthStr] = yearMonthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-12
    const daysInMonth = new Date(year, month, 0).getDate();

    const days: { dateStr: string; dayNum: number; dayOfWeek: number; isWeekend: boolean }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dayOfWeek = dateObj.getDay(); // 0 is Sun, 6 is Sat
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: d,
        dayOfWeek,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      });
    }
    return days;
  };

  const currentMonthDays = getDaysInMonth(targetMonth);

  // Quick select actions



  const handleClearSelection = () => {
    // Before clearing, remove all currently selected dates
    selectedDates.forEach(dateStr => {
      onRemoveRecordsByDate(dateStr);
    });
    customSelectedDates.forEach(dateStr => {
      onRemoveRecordsByDate(dateStr);
    });
  };

  const [activeDateModal, setActiveDateModal] = useState<string | null>(null);
  const [customHours, setCustomHours] = useState('2');
  const [customStartTime, setCustomStartTime] = useState('1730');
  const [customReasonType, setCustomReasonType] = useState('處置病人、會診與病歷撰寫');
  const [customReasonText, setCustomReasonText] = useState('');

  const handleDateClick = (dateStr: string) => {
    setActiveDateModal(dateStr);
  };

  const handleAutoAddFromModal = (dateStr: string) => {
    const shiftCode = shiftSchedule[dateStr];
    if (shiftCode) {
      const recordsToAdd = generateRecordsForDate(dateStr, shiftCode);
      if (recordsToAdd.length > 0) {
        onAddRecords(recordsToAdd);
      }
    }
    setActiveDateModal(null);
  };

  const handleCustomAddFromModal = (dateStr: string) => {
    const sh = parseInt(customStartTime.substring(0, 2), 10);
    const sm = parseInt(customStartTime.substring(2, 4), 10);
    const addedHrs = parseInt(customHours, 10);
    
    if (isNaN(sh) || isNaN(sm) || isNaN(addedHrs) || customStartTime.length !== 4) {
      alert("請輸入正確的起始時間格式 (例如 1730)");
      return;
    }

    let eh = sh + addedHrs;
    const em = sm;
    
    let nextDay = false;
    if (eh >= 24) {
       eh -= 24;
       nextDay = true;
    }
    
    const endTimeStr = `${String(eh).padStart(2, '0')}${String(em).padStart(2, '0')}`;
    
    let targetDate = dateStr;
    if (nextDay) {
      const [y, m, d] = dateStr.split('-');
      const dateObj = new Date(Number(y), Number(m) - 1, Number(d) + 1);
      targetDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    }

    const finalReason = customReasonType === '自訂' ? customReasonText : customReasonType;

    const newRecord: OvertimeRecord = {
      id: `${dateStr}_${customStartTime}_${Math.random().toString(36).substring(2, 7)}`,
      date: targetDate,
      startTime: customStartTime,
      endTime: endTimeStr,
      hours: addedHrs,
      type: overtimeType,
      reason: finalReason || '臨床處置、病患照護與寫病歷',
      status: 'pending',
      source: 'custom',
    };

    onAddRecords([newRecord]);
    setActiveDateModal(null);
  };

  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 shadow-xl text-neutral-900 mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              加班單批次產生器
            </h3>
            <p className="text-xs text-neutral-500">
              勾選月份日曆與加班時間範本，自動產生整個月份的加班申報明細
            </p>
          </div>
        </div>

        {/* Target Month Select */}
        <div className="flex items-center space-x-2">
          <label className="text-xs text-neutral-700 font-medium">申報月份:</label>
          <input
            id="target-month-picker"
            type="month"
            value={targetMonth}
            onChange={(e) => {
              setTargetMonth(e.target.value);
              setShiftSchedule({});
            }}
            className="bg-white border border-neutral-300 rounded-lg px-3 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-blue-600 font-mono"
          />
        </div>
      </div>
      
      {/* CSV Import Section */}
      <div className="mt-5 bg-white border border-neutral-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-emerald-600" />
          <h4 className="text-xs font-bold text-neutral-800">取得全院班表 (Excel)</h4>
          <span className="text-[10px] text-neutral-400 font-normal ml-2">上傳排班表 Excel 檔，或從雲端下載最新班表</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center flex-wrap">
          <input 
            type="file" 
            accept=".csv, .xlsx, .xls"
            onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            className="text-xs text-neutral-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer w-48"
          />
          
          <div className="h-4 w-px bg-neutral-300 hidden sm:block mx-1" />

          <button
            type="button"
            onClick={handleUploadExcelToCloud}
            disabled={isUploading || csvData.length < 3}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition disabled:opacity-50"
            title="將目前選取的 Excel 發布至雲端"
          >
            {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CloudUpload className="w-3 h-3" />}
            上傳至雲端
          </button>
          
          <button
            type="button"
            onClick={handleDownloadExcelFromCloud}
            disabled={isDownloading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition disabled:opacity-50"
          >
            {isDownloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CloudDownload className="w-3 h-3" />}
            從雲端下載班表
          </button>

          <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto mt-2 sm:mt-0 p-2 sm:p-0 bg-neutral-50 sm:bg-transparent rounded border border-neutral-200 sm:border-transparent">
            <span className="text-xs font-bold text-neutral-700">擷取個人班表:</span>
            <input 
              type="text" 
              placeholder="輸入人事號"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="bg-white border border-neutral-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 w-24 uppercase"
            />
            <button 
              type="button"
              onClick={handleExtractSchedule}
              disabled={csvData.length < 3 || !employeeId}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              帶入月曆
            </button>
          </div>
        </div>
        
        {importStatus.message && (
          <div className={`text-xs px-2 py-1.5 rounded ${importStatus.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            {importStatus.message}
          </div>
        )}
      </div>

      {/* Main Form Settings & Calendar Grid */}
      <div className="pt-5 flex flex-col items-center">
        
        {/* Calendar Date Picker */}
        <div className="w-full max-w-3xl bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                自動帶入日期(藍底) ({targetMonth})
              </span>
              <div className="flex items-center gap-2 text-[10px] text-neutral-500 pl-5">
                <span>目前時數預估：</span>
                <span className="text-blue-600 font-medium">平日 {weekdayHours}h</span>
                <span className="text-amber-600 font-medium">假日 {weekendHours}h</span>
              </div>
            </div>

            {/* Quick Select Buttons */}
            <div className="flex items-center space-x-1.5 text-[11px]">
              <button
                type="button"
                onClick={handleClearSelection}
                className="px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-500 border border-neutral-300 transition"
              >
                清除
              </button>
            </div>
          </div>

          {/* Calendar Grid Header (Mon-Sun) */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-neutral-500 mb-1">
            <div>日</div>
            <div>一</div>
            <div>二</div>
            <div>三</div>
            <div>四</div>
            <div>五</div>
            <div>六</div>
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* Padding offset for first day of month */}
            {Array.from({ length: currentMonthDays[0]?.dayOfWeek || 0 }).map((_, i) => (
              <div key={`empty_${i}`} className="h-12 rounded border border-transparent" />
            ))}

            {currentMonthDays.map((d) => {
              const isAutoSelected = selectedDates.includes(d.dateStr);
              const isCustomSelected = customSelectedDates.includes(d.dateStr);
              const isSelected = isAutoSelected || isCustomSelected;
              const shift = shiftSchedule[d.dateStr];
              
              return (
                <button
                  key={d.dateStr}
                  type="button"
                  onClick={() => handleDateClick(d.dateStr)}
                  className={`h-12 rounded-lg text-xs transition-all flex flex-col items-center justify-center border relative ${
                    isAutoSelected && isCustomSelected
                      ? 'bg-[linear-gradient(135deg,#2563eb_50%,#f97316_50%)] text-white border-transparent shadow-md scale-[1.02]'
                      : isCustomSelected
                      ? 'bg-orange-500 text-white border-orange-500 shadow-md scale-[1.02]'
                      : isAutoSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-[1.02]'
                      : d.isWeekend
                      ? 'bg-neutral-50 border-neutral-200 text-amber-700 hover:border-neutral-300 hover:bg-neutral-100'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-100'
                  }`}
                >
                  <span className="font-semibold">{d.dayNum}</span>
                  {shift && (
                    <span className={`text-[10px] mt-0.5 truncate max-w-full px-0.5 font-bold ${isSelected ? 'text-blue-100' : 'text-emerald-600'}`}>
                      {shift}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          
          <div className="mt-4 pt-3 border-t border-neutral-200 flex justify-between items-center">
            <span className="text-[10px] text-neutral-400">若有帶入班表，將顯示於日期下方</span>
            <span className="text-xs text-neutral-500">
              已選擇 <strong className="text-blue-600 font-bold">{selectedDates.length}</strong> 天
            </span>
          </div>
        </div>
      </div>

      {/* Custom Add Date Modal */}
      {activeDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-neutral-200">
            <div className="bg-orange-500 px-4 py-3 flex justify-between items-center">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {activeDateModal} 自訂加入
              </h3>
              <button onClick={() => setActiveDateModal(null)} className="text-white/80 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-5 bg-neutral-50">
              {shiftSchedule[activeDateModal] && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm">
                  <div className="text-sm text-blue-800 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    偵測到排班代號: <strong className="text-lg bg-blue-100 px-2 py-0.5 rounded">{shiftSchedule[activeDateModal]}</strong>
                  </div>
                  {selectedDates.includes(activeDateModal) ? (
                    <button 
                      onClick={() => {
                        onRemoveRecordsByDate(activeDateModal, 'auto');
                        setActiveDateModal(null);
                      }} 
                      className="w-full bg-red-100 text-red-600 rounded-lg py-2.5 text-sm font-bold hover:bg-red-200 transition shadow-sm flex justify-center items-center gap-2"
                    >
                      <X className="w-4 h-4" /> 移除自動帶入排班
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleAutoAddFromModal(activeDateModal)} 
                      className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-bold hover:bg-blue-700 transition shadow shadow-blue-600/20 flex justify-center items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> 自動帶入排班
                    </button>
                  )}
                </div>
              )}
              
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-neutral-300"></div>
                <span className="flex-shrink-0 mx-4 text-neutral-400 text-xs font-semibold">
                  {shiftSchedule[activeDateModal] ? '或 自訂加入' : '自訂加入'}
                </span>
                <div className="flex-grow border-t border-neutral-300"></div>
              </div>
              
              <div className="bg-white border border-orange-200 rounded-xl p-4 shadow-sm space-y-4">
                {customSelectedDates.includes(activeDateModal) ? (
                  <div className="text-center space-y-3">
                    <div className="text-orange-600 font-bold flex justify-center items-center gap-1">
                      <CheckSquare className="w-4 h-4" /> 已有一筆自訂加入
                    </div>
                    <button 
                      onClick={() => {
                        onRemoveRecordsByDate(activeDateModal, 'custom');
                        setActiveDateModal(null);
                      }} 
                      className="w-full bg-red-100 text-red-600 rounded-lg py-2.5 text-sm font-bold hover:bg-red-200 transition shadow-sm flex justify-center items-center gap-2"
                    >
                      <X className="w-4 h-4" /> 移除自訂加入
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1.5">新增時數 (hr)</label>
                      <select 
                        value={customHours} 
                        onChange={e => setCustomHours(e.target.value)} 
                        className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm bg-neutral-50 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition outline-none font-semibold text-neutral-800"
                      >
                        <option value="1">1 小時</option>
                        <option value="2">2 小時</option>
                        <option value="3">3 小時</option>
                        <option value="4">4 小時</option>
                        <option value="5">5 小時</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1.5">起始時間 (hhmm)</label>
                      <input 
                        type="text" 
                        maxLength={4} 
                        value={customStartTime} 
                        onChange={e => setCustomStartTime(e.target.value.replace(/\D/g,''))} 
                        className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm bg-neutral-50 font-mono focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition outline-none" 
                        placeholder="例如 1730" 
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1.5">事由</label>
                      <select 
                        value={customReasonType} 
                        onChange={e => setCustomReasonType(e.target.value)} 
                        className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm bg-neutral-50 mb-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition outline-none text-neutral-800"
                      >
                        <option value="處置病人、會診與病歷撰寫">處置病人、會診與病歷撰寫</option>
                        <option value="開會">開會</option>
                        <option value="自訂">自訂...</option>
                      </select>
                      
                      {customReasonType === '自訂' && (
                        <input 
                          type="text" 
                          value={customReasonText} 
                          onChange={e => setCustomReasonText(e.target.value)} 
                          placeholder="請輸入自訂事由" 
                          className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm bg-neutral-50 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition outline-none" 
                        />
                      )}
                    </div>
                    
                    <button 
                      onClick={() => handleCustomAddFromModal(activeDateModal)} 
                      className="w-full bg-orange-500 text-white rounded-lg py-2.5 text-sm font-bold hover:bg-orange-600 mt-2 transition shadow shadow-orange-500/20 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> 確認自訂加入
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
