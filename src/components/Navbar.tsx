import React, { useState } from 'react';
import { Clock, FileSpreadsheet, Code, LogIn, LogOut, Loader2, Coins } from 'lucide-react';
import { OvertimeRecord } from '../types';
import { auth, provider } from '../lib/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';

interface NavbarProps {
  activeTab: 'generator' | 'script';
  setActiveTab: (tab: 'generator' | 'script') => void;
  recordCount: number;
  totalHours: number;
  weekdayHours: number;
  weekendHours: number;
  records: OvertimeRecord[];
  setRecords: (records: OvertimeRecord[]) => void;
  user: any;
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
  user,
}) => {
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const handleLogin = async () => {
    if (!auth) {
      alert("Firebase 尚未正確設定或環境變數遺失。");
      return;
    }
    setIsAuthLoading(true);
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
      alert("登入失敗，請稍後再試");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    setIsAuthLoading(true);
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsAuthLoading(false);
    }
  };

  return (
    <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Coins className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-neutral-900 tracking-tight">奇美醫院加班批次申報助手</h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-neutral-100 text-neutral-600 rounded-full">
                  v2.0
                </span>
              </div>
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

          <nav className="flex items-center space-x-2 ml-4">
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

            <div className="h-6 w-px bg-neutral-200 mx-1 hidden sm:block"></div>

            {user ? (
              <div className="flex items-center space-x-3 bg-neutral-50 border border-neutral-200 rounded-full pl-1.5 pr-3 py-1">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-neutral-700 truncate max-w-[100px] hidden md:block">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
                <button
                  onClick={handleLogout}
                  disabled={isAuthLoading}
                  className="text-neutral-400 hover:text-red-600 transition"
                  title="登出"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="hidden md:flex flex-col items-end text-[10px] leading-tight text-neutral-500">
                  <span className="font-semibold text-amber-600">管理者限定</span>
                  <span>一般使用者無須登入</span>
                </div>
                <button
                  onClick={handleLogin}
                  disabled={isAuthLoading}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-neutral-100 text-neutral-700 border border-neutral-200 rounded-lg text-sm font-medium hover:bg-neutral-200 transition disabled:opacity-50"
                  title="Google 登入 (管理者限定)"
                >
                  {isAuthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  <span className="hidden sm:inline">登入</span>
                </button>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};
