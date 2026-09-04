import React, { useState } from 'react';
import { CloudUpload, CloudDownload, Loader2 } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OvertimeRecord } from '../types';

interface CloudSyncButtonProps {
  records: OvertimeRecord[];
  setRecords: (records: OvertimeRecord[]) => void;
}

export const CloudSyncButton: React.FC<CloudSyncButtonProps> = ({ records, setRecords }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleUpload = async () => {
    const password = window.prompt('請輸入上傳密碼：');
    if (password !== 'A30825ER') {
      if (password !== null) {
        alert('密碼錯誤！');
      }
      return;
    }

    setIsUploading(true);
    try {
      await setDoc(doc(db, 'schedules', 'global_schedule'), {
        lastUpdated: new Date().toISOString(),
        records: records,
      });
      alert('上傳成功！雲端班表已更新。');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('上傳失敗，請檢查網路連線或設定。');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const docSnap = await getDoc(doc(db, 'schedules', 'global_schedule'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // 更穩健的陣列檢查與預設值
        const recordsToLoad = Array.isArray(data.records) ? data.records : [];
        
        if (recordsToLoad.length > 0) {
          setRecords(recordsToLoad);
          alert(`下載成功！已載入 ${recordsToLoad.length} 筆紀錄。`);
        } else if (data.records && !Array.isArray(data.records)) {
          // 如果 data.records 存在但不是陣列，嘗試將其轉換或報錯
           console.warn('雲端資料格式異常:', data.records);
           alert('雲端資料格式異常，請重新上傳。');
        } else {
           // 真的是空陣列
           setRecords([]);
           alert('下載成功！但雲端目前為空紀錄 (0 筆)。');
        }
      } else {
        alert('雲端尚無班表資料，請先上傳。');
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('下載失敗，請檢查網路連線或設定。');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 transition disabled:opacity-50"
      >
        {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudDownload className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">讀取雲端</span>
      </button>
      <button
        onClick={handleUpload}
        disabled={isUploading}
        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition disabled:opacity-50"
      >
        {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">儲存至雲端</span>
      </button>
    </div>
  );
};
