// Shared constants

export const APP_NAME = 'UOADrop';

// Network (librarian laptop on local Wi-Fi, fixed IP)
export const DESKTOP_LAN_IP = '192.168.50.10';
export const DESKTOP_PORT = 3737;
export const DESKTOP_MDNS = 'uoadrop.local';

// PIN policy
export const PIN_LENGTH = 6;
export const PIN_MAX_ATTEMPTS = 5;           // per request
export const PIN_CUMULATIVE_MAX = 20;        // per student/day across requests
export const PIN_LOCKOUT_MINUTES = 30;
export const PIN_BCRYPT_ROUNDS = 12;

// File limits
export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILES_PER_REQUEST = 10;
export const MAX_TOTAL_SIZE_MB = 200;

// Allowed MIME + magic bytes
export const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.pptx',
  '.xlsx',
  '.jpg',
  '.jpeg',
  '.png',
] as const;

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
] as const;

// Idle / lock screen
export const IDLE_LOCK_MINUTES = 5;

// Notifications
export const EMAIL_DAILY_QUOTA = 100;
export const TELEGRAM_RATE_LIMIT_PER_SEC = 25;

// Pricing (IQD per page)
export const PRICE_BW_PER_PAGE = 100;
export const PRICE_COLOR_PER_PAGE = 250;

// Cleanup
export const ABANDONED_UPLOAD_TTL_HOURS = 24;
export const READY_REQUEST_RETENTION_DAYS = 3;
export const COMPLETED_REQUEST_RETENTION_DAYS = 30;

// Timezone
export const TIMEZONE = 'Asia/Baghdad';
