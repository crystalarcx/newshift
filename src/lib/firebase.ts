import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// 正式環境 (您的 Firebase) 設定
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 為了防止 Vercel 環境變數遺失時直接白畫面，加入防呆機制
let app;
let db;

try {
  app = initializeApp(firebaseConfig);
  // 重要：個人專案的資料庫名稱都是預設的，不需要第二個參數
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase 初始化失敗，請檢查環境變數是否正確：", error);
}

export { db };
