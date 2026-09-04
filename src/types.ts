export type OvertimeType = '延時加班' | '值班留守' | '緊急召回' | '專案/會診/病歷';

export interface OvertimeRecord {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  hours: number;
  type: OvertimeType;
  reason: string;
  status: 'pending' | 'sending' | 'success' | 'failed';
  source?: 'auto' | 'custom';
  responseMessage?: string;
  submittedAt?: string;
}

export interface FieldMapping {
  dateField: string;
  startTimeField: string;
  endTimeField: string;
  hoursField: string;
  typeField: string;
  reasonField: string;
  userField: string;
  hospField: string;
  tokenField: string;
}

export interface PortalConfig {
  targetUrl: string;
  postUrl: string;
  ihosp: string;
  iuser: string;
  ccToken: string;
  cookieString: string;
  fieldMapping: FieldMapping;
}

export type SubmissionMethod = 'bookmarklet' | 'tampermonkey' | 'server_proxy' | 'curl_export';

export interface MonthlySummary {
  month: string; // YYYY-MM
  totalRecords: number;
  totalHours: number;
  pendingCount: number;
  successCount: number;
  failedCount: number;
}
