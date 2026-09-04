import React, { useState, useEffect } from 'react';
import { OvertimeRecord } from './types';
import { Navbar } from './components/Navbar';
import { BatchGenerator } from './components/BatchGenerator';
import { RecordTable } from './components/RecordTable';
import { BookmarkletScriptModal } from './components/BookmarkletScriptModal';

export default function App() {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [targetMonth, setTargetMonth] = useState<string>(defaultMonth);
  const [employeeId, setEmployeeId] = useState<string>('');

  const [records, setRecords] = useState<OvertimeRecord[]>([]);

  const [activeTab, setActiveTab] = useState<'generator' | 'script'>('generator');
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);

  useEffect(() => {
    localStorage.removeItem('chimei_overtime_records'); // Clean up old data
    sessionStorage.removeItem('chimei_overtime_records'); // Clean up old data
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
