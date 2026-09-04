import React, { useState } from 'react';
import { OvertimeRecord } from '../types';
import { Code, Copy, Check, ExternalLink, Play, Sparkles, Terminal, Download, FileCode, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';

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

  // Generate JavaScript Code payload to inject into chimei page
  const generateJsCode = () => {
    const recordsJson = JSON.stringify(
      validRecords.map((r) => ({
        date: r.date,
        startTime: (r.startTime || '').replace(/[^0-9]/g, '').padStart(4, '0'),
        endTime: (r.endTime || '').replace(/[^0-9]/g, '').padStart(4, '0'),
        hours: r.hours || 2,
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

  // 1. 取得或初始化待處理佇列 (支援頁面重新整理後繼續處理)
  let queue = [];
  let isAutoRunning = false;
  try {
    const saved = sessionStorage.getItem('chimei_overtime_queue');
    if (saved) queue = JSON.parse(saved);
  } catch(e) {}
  
  if (!queue || queue.length === 0) {
    queue = records;
    try { sessionStorage.setItem('chimei_overtime_queue', JSON.stringify(queue)); } catch(e) {}
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
      try { sessionStorage.removeItem('chimei_overtime_queue'); } catch(e) {}
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
  const displayUrl = `https://www.chimei.org.tw/overwork/index1.htm?ihosp=10&iuser=${targetUserId}&CC=MdgQMdgQ10V=QQ`;
  const loginUrl = hasEmployeeId ? displayUrl : '#';

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!hasEmployeeId) {
      e.preventDefault();
      alert('請先在「匯入班表 (Excel)」區塊輸入人事號！');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-neutral-200 rounded-2xl max-w-4xl w-full flex flex-col shadow-2xl h-[90vh] sm:h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-neutral-200 bg-white rounded-t-2xl shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100/60 text-blue-600 shadow-sm">
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
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-neutral-50 flex flex-col gap-6">
            
          {/* Top Section: Info & Instructions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Target Data Info */}
            <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2 mb-4">
                <FileCode className="w-4 h-4 text-blue-600" />
                準備匯出的資料
              </h3>
              <div className="flex items-center justify-between text-xs bg-neutral-50 p-4 rounded-lg border border-neutral-200 mb-2">
                <span className="text-neutral-600 font-medium">待發送記錄數：</span>
                <span className="font-bold text-blue-600 text-base">{validRecords.length} 筆</span>
              </div>
              {validRecords.length === 0 && (
                <p className="text-xs text-red-500 flex items-center gap-1.5 mt-3 font-medium bg-red-50 p-2 rounded-md border border-red-100">
                  <ShieldAlert className="w-4 h-4" /> 提示：您目前沒有需要發送的紀錄，腳本將無法執行。
                </p>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-600" />
                執行步驟說明
              </h3>
              
              <ol className="list-decimal list-inside space-y-4 text-sm text-neutral-700">
                <li>
                  <span className="font-semibold text-neutral-900">拖曳按鈕至書籤列</span>
                  <div className="mt-2 p-3 bg-neutral-50 border border-blue-200 rounded-lg flex justify-center items-center">
                    <div className="flex items-center space-x-3">
                      <span
                        dangerouslySetInnerHTML={{
                          __html: `<a href="${bookmarkletHref}" onclick="event.preventDefault()" class="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-lg cursor-grab active:cursor-grabbing border border-blue-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>
                            <span>拖曳我至書籤列：奇美加班一鍵填寫</span>
                          </a>`
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500 mt-2 pl-5">
                    按住上方按鈕往上拖曳到瀏覽器「書籤列」(Bookmark bar) 放開。(沒看到請按 Ctrl+Shift+B 顯示)
                  </p>
                </li>
                <li className="pt-2 border-t border-neutral-100">
                  <span className="font-semibold text-neutral-900">開啟並登入奇美加班網頁：</span>
                  <a
                    href={loginUrl}
                    onClick={handleLinkClick}
                    target={hasEmployeeId ? "_blank" : undefined}
                    rel="noreferrer"
                    className="text-blue-600 underline font-mono ml-1 break-all mt-1 inline-block"
                  >
                    {displayUrl}
                  </a>
                </li>
                <li className="pt-2 border-t border-neutral-100">
                  <span className="font-semibold text-neutral-900">點擊書籤，自動執行！</span>
                  <p className="text-xs text-neutral-500 mt-1 pl-5">
                    點擊剛才加入書籤列的書籤，程式就會開始自動逐一填入並送出。
                  </p>
                </li>
              </ol>
            </div>
          </div>

          {/* Bottom Section: Code Preview (Collapsible) */}
          <div className="flex flex-col rounded-xl overflow-hidden border border-neutral-200 shadow-sm relative group bg-white">
            <button
              onClick={() => setIsCodeExpanded(!isCodeExpanded)}
              className="w-full bg-neutral-100 border-b border-neutral-200 px-4 py-2.5 flex items-center justify-between shrink-0 hover:bg-neutral-200/50 transition"
            >
              <div className="flex items-center space-x-2">
                <Code className="w-4 h-4 text-neutral-500" />
                <span className="text-xs font-mono text-neutral-600 font-semibold">
                  chimei-overtime-autofill.js (原始碼檢視)
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy();
                  }}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition ${
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
                      <span>複製程式碼</span>
                    </>
                  )}
                </div>
                {isCodeExpanded ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
              </div>
            </button>
            {isCodeExpanded && (
              <div className="h-48 bg-neutral-900 p-3 overflow-auto">
                <pre className="text-[10px] sm:text-[11px] font-mono text-blue-200 leading-relaxed font-medium">
                  <code>{codeString}</code>
                </pre>
              </div>
            )}
          </div>
            
        </div>
      </div>
    </div>
  );
};
