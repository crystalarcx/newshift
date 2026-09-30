import React, { useState } from 'react';
import { OvertimeRecord } from '../types';
import { Code, Copy, Check, ExternalLink, Play, Sparkles, Terminal, Download, FileCode, ShieldAlert, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { isWeekendOrHoliday } from '../lib/holidays';

interface BookmarkletScriptModalProps {
  records: OvertimeRecord[];
  isOpen: boolean;
  onClose: () => void;
  employeeId?: string;
}

export const BookmarkletScriptModal: React.FC<BookmarkletScriptModalProps> = ({
  records,
  isOpen,
  onClose,
  employeeId = '',
}) => {
  const [copied, setCopied] = useState(false);
  const [isCodeExpanded, setIsCodeExpanded] = useState(false);

  if (!isOpen) return null;

  const validRecords = records.filter((r) => r.status !== 'success');
  
  const weekdayHours = Math.round(validRecords.filter(r => !isWeekendOrHoliday(r.date)).reduce((sum, r) => sum + (Number(r.hours) || 0), 0) * 10) / 10;
  const weekendHours = Math.round(validRecords.filter(r => isWeekendOrHoliday(r.date)).reduce((sum, r) => sum + (Number(r.hours) || 0), 0) * 10) / 10;

  // Generate JavaScript Code payload to inject into chimei page
  const generateJsCode = () => {
    const recordsJson = JSON.stringify(
      validRecords.map((r) => ({
        date: r.date,
        startTime: (r.startTime || '').replace(/[^0-9]/g, '').padStart(4, '0'),
        endTime: (r.endTime || '').replace(/[^0-9]/g, '').padStart(4, '0'),
        hours: typeof r.hours === 'number' && !isNaN(r.hours) ? r.hours : 2,
        reason: r.reason,
      }))
    );

    return `(function() {
  // Polyfill NodeList.forEach 避免舊網頁缺少此方法導致報錯
  if (window.NodeList && !NodeList.prototype.forEach) { NodeList.prototype.forEach = Array.prototype.forEach; }
  if (window.HTMLCollection && !HTMLCollection.prototype.forEach) { HTMLCollection.prototype.forEach = Array.prototype.forEach; }

  const records = ${recordsJson};
  if (!records || records.length === 0) {
    console.log('%c【奇美加班助手】目前沒有待發送的加班記錄！', 'color:#f43f5e;font-size:14px;font-weight:bold;');
    alert('【奇美加班助手】目前沒有待發送的加班記錄！');
    return;
  }
  
  console.log('%c【奇美加班助手】簡化模式填寫啟動，共 ' + records.length + ' 筆明細', 'color:#38bdf8;font-size:14px;font-weight:bold;');
  console.log('%c⚠️ 【貼心提醒】腳本執行中請保持停留在本分頁，避免 Chrome 背景節流導致自動送出暫停！', 'color:#f59e0b;font-size:12px;font-weight:bold;');

  // 1. 取得或初始化待處理佇列 (支援同一批次重新整理後繼續處理，新腳本則自動重置為最新資料)
  const batchId = "${Date.now()}";
  let queue = [];
  let isAutoRunning = false;
  try {
    const savedBatch = sessionStorage.getItem('chimei_batch_id');
    const saved = sessionStorage.getItem('chimei_overtime_queue');
    if (savedBatch === batchId && saved) {
      queue = JSON.parse(saved);
    }
  } catch(e) {}
  
  if (!queue || queue.length === 0) {
    queue = records;
    try { 
      sessionStorage.setItem('chimei_batch_id', batchId);
      sessionStorage.setItem('chimei_overtime_queue', JSON.stringify(queue)); 
    } catch(e) {}
  }

  // 2. 跨 Window 及 iframe 收集 DOM
  function getDocs() {
    const docs = [document];
    function collect(win) {
      try {
        if (!win || !win.frames) return;
        for (let i = 0; i < win.frames.length; i++) {
          try {
            const d = win.frames[i].document;
            if (d && !docs.includes(d)) {
              docs.push(d);
              collect(win.frames[i]);
            }
          } catch(e) {}
        }
      } catch(e) {}
    }
    collect(window);
    return docs;
  }

  // 3. 欄位精準掃描
  function scanFields() {
    const docs = getDocs();
    let allInputs = [];
    let allTextareas = [];
    let allButtons = [];
    docs.forEach(doc => {
      try {
        allInputs.push(...Array.from(doc.querySelectorAll('input, select')));
        allTextareas.push(...Array.from(doc.querySelectorAll('textarea')));
        allButtons.push(...Array.from(doc.querySelectorAll('button, input[type="button"], input[type="submit"], input[value*="儲存"], input[value*="新增"], input[value*="送出"], a.btn')));
      } catch(e) {}
    });

    const visibleInputs = allInputs.filter(el => el.type !== 'hidden' && el.type !== 'submit' && el.type !== 'button');

    // (1) 日期欄位
    let dateEl = visibleInputs.find(el => {
      if (el.tagName && el.tagName.toLowerCase() === 'select') {
        const optText = el.options[1]?.text || el.options[0]?.text || '';
        if (/[0-9]{1,2}[-/][0-9]{1,2}/.test(optText)) return true;
      }
      const nameOrId = el.id || el.name || '';
      return /^d_over_date$|^date$|^bdate$|^idate$|^txtdate$|over_date$/i.test(nameOrId) || el.type === 'date';
    });

    // (2) 起始時間
    let startEl = visibleInputs.find(el => 
      el !== dateEl && /stime|btime|start|begin|time1|sbtime|txtbtime|txt_stime|time_s|s_time|over_time_start|time_start/i.test(el.id || el.name || el.placeholder || '')
    );

    // (3) 結束時間
    let endEl = visibleInputs.find(el => 
      el !== dateEl && el !== startEl && /etime|end|time2|setime|txtetime|txt_etime|time_e|e_time|over_time_end|time_end/i.test(el.id || el.name || el.placeholder || '')
    );

    // (4) 加班時數 (如果有)
    let hoursEl = visibleInputs.find(el => 
      el !== dateEl && el !== startEl && el !== endEl && /hours|over_hours|total|txt_hours|time/i.test(el.id || el.name || el.placeholder || '')
    );

    // (5) 加班事由描述
    let reasonEl = allTextareas[0] || visibleInputs.find(el => 
      el !== dateEl && el !== startEl && el !== endEl && el !== hoursEl && /reason|memo|remark|ps|事由|說明|txtreason|over_reason/i.test(el.id || el.name || el.placeholder || '')
    );

    // (6) 送出/儲存按鈕
    let submitBtn = allButtons.find(btn => {
      const text = (btn.value || btn.innerText || btn.textContent || '').trim();
      return /送出|儲存|新增|確定|確認|save|submit|add/i.test(text);
    });

    return { dateEl, startEl, endEl, hoursEl, reasonEl, submitBtn };
  }

  // 4. 執行當前筆資料填寫
  function processNext() {
    if (queue.length === 0) {
      console.log('%c✅ 【奇美加班助手】所有加班紀錄皆已填寫完畢！', 'color:#10b981;font-size:16px;font-weight:bold;');
      alert('🎉 奇美加班批次申報助手\\n\\n所有紀錄已自動填寫與送出完畢！請自行確認畫面上是否有成功訊息。');
      try {
        sessionStorage.removeItem('chimei_overtime_queue');
        sessionStorage.removeItem('chimei_batch_id');
      } catch(e) {}
      return;
    }

    const currentRecord = queue[0];
    console.log('%c⏳ 【奇美加班助手】準備填寫: ' + currentRecord.date + ' (' + queue.length + ' 筆待辦)', 'color:#eab308;font-weight:bold;');

    const fields = scanFields();
    console.log('📌 偵測到的目標欄位:', fields);

    if (!fields.dateEl || !fields.startEl || !fields.endEl || !fields.reasonEl) {
      console.error('❌ 【奇美加班助手】無法在畫面上找到完整的核心對應欄位。', fields);
      alert('【奇美加班助手】錯誤：找不到目標欄位！\\n可能原因：\\n1. 網頁尚未登入成功\\n2. 系統介面已大改版');
      return;
    }

    // 填寫欄位 (觸發 Change 事件並包裝 try/catch 防止目標網頁指令碼錯誤中斷流程)
    function setVal(el, val) {
      if (!el) return;
      el.value = val;
      try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch(e) {}
      try { 
        if (typeof jQuery !== 'undefined') jQuery(el).trigger('change');
        else el.dispatchEvent(new Event('change', { bubbles: true })); 
      } catch(e) { 
        console.warn('目標網頁的 onchange 事件發生錯誤，但不影響繼續執行:', e); 
      }
    }

    setVal(fields.dateEl, currentRecord.date);
    setVal(fields.startEl, currentRecord.startTime);
    setVal(fields.endEl, currentRecord.endTime);
    if (fields.hoursEl) setVal(fields.hoursEl, currentRecord.hours);
    setVal(fields.reasonEl, currentRecord.reason);

    console.log('✅ 【奇美加班助手】已填寫完畢本筆資料，準備點擊送出。');
    
    queue.shift();
    try { sessionStorage.setItem('chimei_overtime_queue', JSON.stringify(queue)); } catch(e) {}

    if (fields.submitBtn) {
      console.log('👆 點擊送出按鈕...', fields.submitBtn);
      isAutoRunning = true;
      setTimeout(() => {
        fields.submitBtn.click();
        setTimeout(() => {
          if (isAutoRunning) {
             console.log('🔄 網頁似乎沒有刷新 (AJAX 提交)，準備執行下一筆...');
             processNext();
          }
        }, 3000);
      }, 500);
    } else {
      console.warn('⚠️ 找不到送出按鈕，請手動點擊送出。');
    }
  }

  window.addEventListener('beforeunload', () => { isAutoRunning = false; });
  processNext();

})();`;
  };

  const codeString = generateJsCode();
  const bookmarkletHref = `javascript:${encodeURIComponent(codeString)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  };

  const hasEmployeeId = Boolean(employeeId.trim());
  const targetUserId = hasEmployeeId ? employeeId.trim() : '【請先輸入人事號】';
  const displayUrl = `https://www.chimei.org.tw/overwork/index5.htm?ihosp=10&iuser=${targetUserId}&CC=MdgQMdgQ10V=QQ&mode=`;
  const loginUrl = hasEmployeeId ? displayUrl : '#';

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!hasEmployeeId) {
      e.preventDefault();
      alert('請先在「匯入班表 (Excel)」區塊輸入人事號！');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white border border-neutral-200 rounded-2xl max-w-6xl xl:max-w-7xl w-full flex flex-col shadow-2xl max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-white rounded-t-2xl shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-100/60 text-blue-600 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                瀏覽器一鍵填表腳本
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-900 px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-neutral-100 transition"
          >
            關閉
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-neutral-50 flex flex-col gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* Left Column: Data Summary & Code Box */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              {/* Target Data Info */}
              <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2 mb-3">
                  <FileCode className="w-4 h-4 text-blue-600" />
                  準備匯出的資料
                </h3>
                <div className="flex flex-col gap-2 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-600 font-medium">待發送記錄數：</span>
                    <span className="font-bold text-blue-600 text-base">{validRecords.length} 筆</span>
                  </div>
                  <div className="flex items-center justify-between text-xs border-t border-neutral-200 pt-2">
                    <span className="text-neutral-600 font-medium">平日時數：</span>
                    <span className="font-bold text-neutral-800">{weekdayHours} h</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-600 font-medium">假日時數：</span>
                    <span className="font-bold text-neutral-800">{weekendHours} h</span>
                  </div>
                  <div className="flex items-center justify-between text-xs border-t border-neutral-200 pt-2">
                    <span className="text-neutral-600 font-bold">總計時數：</span>
                    <span className="font-bold text-indigo-700 text-sm">
                      {Math.round((weekdayHours + weekendHours) * 10) / 10} h
                    </span>
                  </div>
                </div>
                {validRecords.length === 0 && (
                  <p className="text-xs text-red-500 flex items-center gap-1.5 mt-2.5 font-medium bg-red-50 p-2 rounded-md border border-red-100">
                    <ShieldAlert className="w-4 h-4 shrink-0" /> 您目前沒有需要發送的紀錄。
                  </p>
                )}
              </div>

              {/* Code Box */}
              <div className="flex flex-col rounded-xl overflow-hidden border border-neutral-200 shadow-sm bg-white">
                <div className="bg-neutral-100/90 border-b border-neutral-200 px-3 py-2 flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-1.5">
                    <Code className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="text-xs font-mono text-neutral-600 font-semibold truncate max-w-[150px]">
                      腳本代碼
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                      copied
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 hover:text-blue-600'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>已複製 !</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>複製腳本代碼</span>
                      </>
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCodeExpanded(!isCodeExpanded)}
                  className="w-full text-left px-3 py-1.5 text-[11px] text-neutral-500 hover:text-neutral-800 flex items-center justify-between bg-neutral-50/50"
                >
                  <span>{isCodeExpanded ? '收合原始碼' : '展開原始碼檢視 (可手動貼至 Console)'}</span>
                  {isCodeExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {isCodeExpanded && (
                  <div className="h-44 bg-neutral-900 p-2.5 overflow-auto">
                    <pre className="text-[10px] font-mono text-blue-200 leading-relaxed font-medium">
                      <code>{codeString}</code>
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Execution Steps */}
            <div className="lg:col-span-8 bg-white border border-neutral-200 rounded-xl p-4 sm:p-5 shadow-sm">
              <h3 className="text-sm font-bold text-neutral-900 mb-3.5 flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-600" />
                執行步驟說明
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Step 1 */}
                <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-blue-600 text-white font-black text-[11px] px-2.5 py-0.5 rounded-md shadow-sm shrink-0">步驟 1</span>
                      <span className="text-sm font-bold text-blue-900">顯示瀏覽器書籤列</span>
                    </div>
                    <p className="text-xs text-blue-800 leading-relaxed">
                      若未看到書籤列，請按鍵盤 <strong className="bg-blue-200/60 px-1 py-0.5 rounded text-blue-900 font-mono">Ctrl+Shift+B</strong> (Mac: <strong className="bg-blue-200/60 px-1 py-0.5 rounded text-blue-900 font-mono">Cmd+Shift+B</strong>)。
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-indigo-600 text-white font-black text-[11px] px-2.5 py-0.5 rounded-md shadow-sm shrink-0">步驟 2</span>
                      <span className="text-sm font-bold text-indigo-900">拖曳下方按鈕至書籤列</span>
                    </div>
                    <div className="p-3 bg-white border-2 border-dashed border-indigo-300 rounded-xl flex justify-center items-center shadow-sm">
                      <span
                        dangerouslySetInnerHTML={{
                          __html: `<a href="${bookmarkletHref}" onclick="event.preventDefault()" class="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white font-extrabold text-xs rounded-lg shadow cursor-grab active:cursor-grabbing border border-indigo-700">
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>
                            <span>拖曳我至書籤列：奇美加班一鍵填寫</span>
                          </a>`
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-amber-500 text-white font-black text-[11px] px-2.5 py-0.5 rounded-md shadow-sm shrink-0">步驟 3</span>
                      <span className="text-sm font-bold text-amber-900">開啟並登入奇美加班網頁</span>
                    </div>
                    <div className="mt-1">
                      <a
                        href={loginUrl}
                        onClick={handleLinkClick}
                        target={hasEmployeeId ? "_blank" : undefined}
                        rel="noreferrer"
                        className="text-amber-800 hover:text-amber-950 font-mono text-xs break-all font-bold bg-amber-200/50 hover:bg-amber-200/80 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 border border-amber-300/60 transition"
                      >
                        <span>{displayUrl}</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-emerald-600 text-white font-black text-[11px] px-2.5 py-0.5 rounded-md shadow-sm shrink-0">步驟 4</span>
                      <span className="text-sm font-bold text-emerald-900">點擊書籤，自動執行！</span>
                    </div>
                    <p className="text-xs text-emerald-800 leading-relaxed mb-2">
                      在加班網頁中，點擊書籤列的<strong className="text-emerald-950">「奇美加班一鍵填寫」</strong>，程式即刻自動逐筆填入並送出。
                    </p>
                  </div>
                  {/* 重要提醒：腳本運行期間請保持停留在該分頁 */}
                  <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 text-amber-900 px-2.5 py-1.5 rounded-lg text-[11px] font-bold shadow-sm">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>重要提醒：腳本運行期間請保持停留在該分頁</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
