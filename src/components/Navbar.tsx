import React from 'react';
import { Clock, FileSpreadsheet, Code } from 'lucide-react';
import { OvertimeRecord } from '../types';

interface NavbarProps {
  activeTab: 'generator' | 'script';
  setActiveTab: (tab: 'generator' | 'script') => void;
  recordCount: number;
  totalHours: number;
  weekdayHours: number;
  weekendHours: number;
  records: OvertimeRecord[];
  setRecords: (records: OvertimeRecord[]) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  recordCount,
  totalHours,
  weekdayHours,
  weekendHours,
  records,
  setRecords,
}) => {
  return (
    <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-neutral-900 tracking-tight">奇美醫院加班批次申報助手</h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-neutral-100 text-neutral-600 rounded-full">
                  v2.0
                </span>
              </div>
              <p className="text-xs text-neutral-500">專為院內同仁設計 · 月度加班快速登錄</p>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center space-x-4">
            <div className="flex items-center space-x-4 bg-neutral-50 px-4 py-1.5 rounded-lg border border-neutral-200 text-xs">
              <div className="flex items-center space-x-1.5 text-neutral-600">
                <FileSpreadsheet className="w-4 h-4 text-neutral-400" />
                <span>本月: <strong className="text-neutral-900 font-semibold">{recordCount}</strong> 筆</span>
              </div>
              <div className="h-3 w-px bg-neutral-300" />
              <div className="flex items-center space-x-1.5 text-neutral-600">
                <Clock className="w-4 h-4 text-neutral-400" />
                <span>平日: <strong className="text-neutral-900 font-semibold">{weekdayHours}</strong> h</span>
                <span className="text-neutral-300">|</span>
                <span>假日: <strong className="text-neutral-900 font-semibold">{weekendHours}</strong> h</span>
                <span className="text-neutral-300">|</span>
                <span>總計: <strong className="text-blue-600 font-semibold">{totalHours}</strong> h</span>
              </div>
            </div>
          </div>

          <nav className="flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('generator')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 ${
                activeTab === 'generator'
                  ? 'bg-neutral-100 text-neutral-900'
                  : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">規則產生</span>
            </button>
            <button
              onClick={() => setActiveTab('script')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 ${
                activeTab === 'script'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              <Code className={`w-4 h-4 ${activeTab === 'script' ? 'text-blue-600' : ''}`} />
              <span>網頁腳本</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
