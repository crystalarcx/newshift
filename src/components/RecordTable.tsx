import React, { useState } from 'react';
import { OvertimeRecord } from '../types';
import {
  FileSpreadsheet,
  Trash2,
  Send,
  Code,
  Edit2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Sparkles,
  CheckSquare,
  Square,
  Filter,
} from 'lucide-react';

interface RecordTableProps {
  records: OvertimeRecord[];
  setRecords: React.Dispatch<React.SetStateAction<OvertimeRecord[]>>;
  onOpenScriptModal: () => void;
  targetMonth: string;
}

export const RecordTable: React.FC<RecordTableProps> = ({
  records,
  setRecords,
  onOpenScriptModal,
  targetMonth,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchReasonText, setBatchReasonText] = useState('');
  const [showReasonEditor, setShowReasonEditor] = useState(false);

  // Filter records by current month and sort by date
  const monthRecords = records
    .filter((r) => r.date.startsWith(targetMonth))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const handleSelectAll = () => {
    if (selectedIds.length === monthRecords.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(monthRecords.map((r) => r.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    
    // In iframe environments, window.confirm can be blocked or ignored silently.
    // We will bypass the confirm dialog and perform deletion immediately.
    setRecords((prev: OvertimeRecord[]) => prev.filter((r) => !selectedIds.includes(r.id)));
    setSelectedIds([]);
    setShowReasonEditor(false);
  };

  const handleApplyBatchReason = () => {
    if (!batchReasonText) return;
    const toUpdate = selectedIds.length > 0 ? selectedIds : monthRecords.map(r => r.id);
    
    setRecords(
      records.map((r) => (toUpdate.includes(r.id) ? { ...r, reason: batchReasonText } : r))
    );
    setShowReasonEditor(false);
    setBatchReasonText('');
  };

  return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xl text-neutral-900">
      {/* Table Header & Summary Cards */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-neutral-200 mb-5">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <span>
              {targetMonth} 本月份申報明細清單
            </span>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
              共 {monthRecords.length} 筆
            </span>
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            資料儲存於瀏覽器中，準備好後可點擊右側按鈕批次發送
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Script Generator Button */}
          <button
            id="open-script-generator-btn"
            type="button"
            onClick={onOpenScriptModal}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-600/20 transition flex items-center space-x-1.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>產生網頁自動填表書籤</span>
          </button>

          {selectedIds.length > 0 && (
            <div className="flex items-center space-x-1 bg-neutral-50 p-1 rounded-xl border border-neutral-200">
              <button
                type="button"
                onClick={() => setShowReasonEditor(true)}
                className="px-2.5 py-1 text-[11px] bg-neutral-100 hover:bg-neutral-200 text-blue-600 rounded-lg flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" />
                <span>批次修改事由 ({selectedIds.length})</span>
              </button>

              <button
                type="button"
                onClick={handleDeleteSelected}
                className="px-2.5 py-1 text-[11px] bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>刪除所選</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Batch Reason Editor Popover */}
      {showReasonEditor && (
        <div className="p-3 bg-neutral-50 border border-neutral-300 rounded-xl mb-4 flex items-center gap-2 text-xs">
          <Edit2 className="w-4 h-4 text-neutral-500 shrink-0" />
          <input
            type="text"
            placeholder="輸入要統一修改的事由..."
            value={batchReasonText}
            onChange={(e) => setBatchReasonText(e.target.value)}
            className="flex-1 bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-1.5 text-neutral-900 focus:outline-none focus:border-blue-600"
          />
          <button
            type="button"
            onClick={handleApplyBatchReason}
            className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-lg"
          >
            套用
          </button>
          <button
            type="button"
            onClick={() => setShowReasonEditor(false)}
            className="px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-lg"
          >
            取消
          </button>
        </div>
      )}

      {/* Table */}
      {monthRecords.length === 0 ? (
        <div className="py-16 text-center text-neutral-400 text-xs flex flex-col items-center">
          <Clock className="w-10 h-10 mb-2 stroke-1 text-neutral-400" />
          <span>目前本月份尚無加班明細，請點擊上方「規則快速產生」自動建立</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500 bg-neutral-50/60">
                <th className="py-3 px-3 w-10 text-center">
                  <button type="button" onClick={handleSelectAll} className="text-neutral-500 hover:text-neutral-900">
                    {selectedIds.length === monthRecords.length ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3 font-semibold">1. 日期</th>
                <th className="py-3 px-3 font-semibold">2. 起時 <span className="text-[10px] text-neutral-400 font-normal">(0000格式)</span></th>
                <th className="py-3 px-3 font-semibold">3. 迄時 <span className="text-[10px] text-neutral-400 font-normal">(0000格式)</span></th>
                <th className="py-3 px-3 font-semibold">4. 事由描述</th>
                <th className="py-3 px-3 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 text-neutral-800">
              {monthRecords.map((r) => {
                const isSelected = selectedIds.includes(r.id);
                
                // Determine row background color
                let bgClass = 'hover:bg-neutral-100/40 transition';
                if (r.source === 'auto') {
                  bgClass += ' bg-blue-50/40';
                } else if (r.source === 'custom') {
                  bgClass += ' bg-orange-50/40';
                }
                
                if (isSelected) {
                  bgClass = 'bg-blue-100/40 hover:bg-blue-100/60 transition';
                }

                return (
                  <tr
                    key={r.id}
                    className={bgClass}
                  >
                    <td className="py-3 px-3 text-center">
                      <button type="button" onClick={() => handleToggleSelect(r.id)}>
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-400" />
                        )}
                      </button>
                    </td>
                    {/* Date */}
                    <td className="py-3 px-3 font-mono font-semibold text-blue-600 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="px-1 py-0.5">{r.date}</span>
                        <span className="text-[10px] text-neutral-400 pl-1 font-sans">
                          {r.source === 'auto' && r.shiftCode ? `班別: ${r.shiftCode}` : (r.source === 'custom' ? '自訂' : '')}
                        </span>
                      </div>
                    </td>
                    {/* Start Time (0000) */}
                    <td className="py-3 px-3 font-mono text-neutral-700">
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="1730"
                        value={r.startTime}
                        onChange={(e) =>
                          setRecords(
                            records.map((item) =>
                              item.id === r.id
                                ? { ...item, startTime: e.target.value.replace(/[^0-9]/g, '') }
                                : item
                            )
                          )
                        }
                        className="w-16 bg-neutral-50 border border-neutral-200 rounded px-1.5 py-0.5 text-center text-xs font-mono font-bold text-amber-700 focus:outline-none focus:border-blue-600"
                      />
                    </td>
                    {/* End Time (0000) */}
                    <td className="py-3 px-3 font-mono text-neutral-700">
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="1930"
                        value={r.endTime}
                        onChange={(e) =>
                          setRecords(
                            records.map((item) =>
                              item.id === r.id
                                ? { ...item, endTime: e.target.value.replace(/[^0-9]/g, '') }
                                : item
                            )
                          )
                        }
                        className="w-16 bg-neutral-50 border border-neutral-200 rounded px-1.5 py-0.5 text-center text-xs font-mono font-bold text-amber-700 focus:outline-none focus:border-blue-600"
                      />
                    </td>
                    {/* Reason */}
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        value={r.reason}
                        onChange={(e) =>
                          setRecords(
                            records.map((item) => (item.id === r.id ? { ...item, reason: e.target.value } : item))
                          )
                        }
                        className="w-full bg-neutral-50 border border-neutral-200 rounded px-2 py-1 text-neutral-800 focus:outline-none focus:border-blue-600"
                      />
                    </td>
                    {/* Action */}
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setRecords(records.filter((item) => item.id !== r.id))}
                        className="text-neutral-400 hover:text-red-600 transition p-1"
                        title="刪除此筆"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
