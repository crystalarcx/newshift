import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { OvertimeRecord } from './types';
import { Navbar } from './components/Navbar';
import { BatchGenerator } from './components/BatchGenerator';
import { RecordTable } from './components/RecordTable';
import { BookmarkletScriptModal } from './components/BookmarkletScriptModal';
import { auth } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function App() {
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
