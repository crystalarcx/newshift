import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, Info, MonitorSmartphone, X } from 'lucide-react';
import { OvertimeRecord } from './types';
import { Navbar } from './components/Navbar';
import { BatchGenerator } from './components/BatchGenerator';
import { RecordTable } from './components/RecordTable';
import { BookmarkletScriptModal } from './components/BookmarkletScriptModal';
import { auth } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function App() {
  const [showMobileNotice, setShowMobileNotice] = useState(true);
  const [showSecurityNotice, setShowSecurityNotice] = useState(true);
  
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [targetMonth, setTargetMonth] = useState<string>(defaultMonth);
  const [employeeId, setEmployeeId] = useState<string>('');

  const [records, setRecords] = useState<OvertimeRecord[]>([]);

  const [activeTab, setActiveTab] = useState<'generator' | 'script'>('generator');
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  
  const [user, setUser] = useState<User | null>(null);

  const [hasAccess, setHasAccess] = useState(() => {
    return localStorage.getItem('app_access_granted') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === '7900') {
      setHasAccess(true);
      localStorage.setItem('app_access_granted', 'true');
    } else {
      setPasswordError(true);
      setPasswordInput('');
    }
  };

  useEffect(() => {
    localStorage.removeItem('chimei_overtime_records'); // Clean up old data
    sessionStorage.removeItem('chimei_overtime_records'); // Clean up old data
    
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
      });
      return () => unsubscribe();
    }
  }, []);

  const handleAddRecords = (newRecords: OvertimeRecord[]) => {
    const existingKeys = new Set(records.map((r) => `${r.date}_${r.startTime}_${r.endTime}`));
    const filteredNew = newRecords.filter((nr) => !existingKeys.has(`${nr.date}_${nr.startTime}_${nr.endTime}`));

    if (filteredNew.length < newRecords.length) {
      // In iframe environments, window.confirm is blocked and halts execution silently.
      // We will automatically overwrite/merge without prompting.
      const newKeysSet = new Set(newRecords.map((r) => `${r.date}_${r.startTime}_${r.endTime}`));
      setRecords([...records.filter((r) => !newKeysSet.has(`${r.date}_${r.startTime}_${r.endTime}`)), ...newRecords]);
      return;
    }

    setRecords([...records, ...filteredNew]);
  };

  const handleRemoveRecordsByDate = (dateStr: string, source?: 'auto' | 'custom') => {
    setRecords((prev) => prev.filter((r) => {
      const isMatch = r.id.startsWith(dateStr + '_') || r.date === dateStr;
      if (!isMatch) return true; // Keep if not matching date
      if (source) {
        return r.source !== source; // Keep if matching date but DIFFERENT source
      }
      return false; // Remove if matching date and NO source specified
    }));
  };

  const currentMonthRecords = records.filter((r) => r.date.startsWith(targetMonth));
  
  const isWeekend = (dateStr: string) => {
    const day = new Date(dateStr).getDay();
    return day === 0 || day === 6;
  };
  
  const totalHours = currentMonthRecords.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
  const weekdayHours = currentMonthRecords.filter(r => !isWeekend(r.date)).reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
  const weekendHours = currentMonthRecords.filter(r => isWeekend(r.date)).reduce((sum, r) => sum + (Number(r.hours) || 0), 0);

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center border border-neutral-200">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5 text-blue-600">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 mb-2">請輸入存取密碼</h1>
          <p className="text-sm text-neutral-500 mb-6">為避免流量超載，請輸入通關密碼以進入系統。</p>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setPasswordError(false);
              }}
              placeholder="請輸入密碼"
              className={`w-full text-center px-4 py-3 rounded-xl border ${
                passwordError 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50' 
                  : 'border-neutral-200 focus:border-blue-500 focus:ring-blue-200'
              } transition-all outline-none focus:ring-4 mb-4`}
              autoFocus
            />
            {passwordError && (
              <p className="text-sm text-red-500 mb-4 font-medium">密碼錯誤，請重新輸入</p>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-blue-600/20"
            >
              進入系統
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'script') {
            setIsScriptModalOpen(true);
          }
        }}
        recordCount={currentMonthRecords.length}
        totalHours={totalHours}
        weekdayHours={weekdayHours}
        weekendHours={weekendHours}
        records={records}
        setRecords={setRecords}
        user={user}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        <div className="space-y-4">
          {showMobileNotice && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex gap-4 relative pr-10 shadow-sm">
              <div className="flex-shrink-0 mt-0.5">
                <MonitorSmartphone className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm sm:text-base font-bold text-amber-900 mb-1">
                  使用裝置提醒
                </h2>
                <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
                  因網頁腳本機制之限制，本系統<strong>目前不支援手機操作</strong>。為了確保您能順利進行加班明細申報，請務必使用<strong>電腦版網頁瀏覽器 (如 Chrome, Edge 等) </strong>來開啟並使用本系統。
                </p>
              </div>
              <button 
                onClick={() => setShowMobileNotice(false)}
                className="absolute top-4 right-4 text-amber-400 hover:text-amber-700 transition bg-amber-100/50 hover:bg-amber-200/50 rounded-full p-1"
                aria-label="關閉提示"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {showSecurityNotice && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 sm:p-5 flex gap-4 relative pr-10 shadow-sm">
              <div className="flex-shrink-0 mt-0.5">
                <ShieldCheck className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm sm:text-base font-bold text-blue-900 mb-1">
                  關於網頁腳本的運作原理與安全性聲明
                </h2>
                <div className="text-xs sm:text-sm text-blue-800 space-y-2 leading-relaxed">
                  <p>
                    <strong>運作原理：</strong>本系統是透過產生一段「網頁腳本 (JavaScript)」，讓您在醫院的加班網頁中執行。這段腳本的功能，僅是代替您的滑鼠與鍵盤，幫您自動「點擊對應日期」與「填寫加班時間」，以省去手動逐筆輸入的麻煩。
                  </p>
                  <p>
                    <strong>資安保障：</strong>使用本服務<strong>沒有任何安全性顧慮</strong>。所有加班資料的處理與腳本的執行，都完全在您的個人電腦（瀏覽器）上進行。本系統不會、也無法攔截您的醫院登入帳號密碼。
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowSecurityNotice(false)}
                className="absolute top-4 right-4 text-blue-400 hover:text-blue-700 transition bg-blue-100/50 hover:bg-blue-200/50 rounded-full p-1"
                aria-label="關閉提示"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {activeTab === 'generator' && (
          <BatchGenerator
            records={records}
            onAddRecords={handleAddRecords}
            onRemoveRecordsByDate={handleRemoveRecordsByDate}
            targetMonth={targetMonth}
            setTargetMonth={setTargetMonth}
            weekdayHours={weekdayHours}
            weekendHours={weekendHours}
            employeeId={employeeId}
            setEmployeeId={setEmployeeId}
            user={user}
          />
        )}

        <RecordTable
          records={records}
          setRecords={setRecords}
          onOpenScriptModal={() => setIsScriptModalOpen(true)}
          targetMonth={targetMonth}
        />
      </main>

      <BookmarkletScriptModal
        records={records}
        isOpen={isScriptModalOpen}
        onClose={() => setIsScriptModalOpen(false)}
        employeeId={employeeId}
      />

      <footer className="border-t border-neutral-200 bg-white py-8 text-center text-sm text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>奇美醫療財團法人奇美醫院 · 加班時數批次申報助手</div>
        </div>
      </footer>
    </div>
  );
}
