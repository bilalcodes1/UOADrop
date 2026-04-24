// Shared TypeScript types for UOADrop (web + desktop + edge functions)

export type RequestStatus =
  | 'pending'   // uploaded, waiting for librarian
  | 'printing'  // librarian started printing
  | 'ready'     // printed, waiting for student pickup
  | 'done'      // picked up
  | 'canceled'  // student canceled
  | 'blocked';  // PIN lockout or abuse

export type PrintOptions = {
  copies: number;
  color: boolean;
  doubleSided: boolean;
  pagesPerSheet?: 1 | 2 | 4;
  pageRange?: string; // "1-5,7,9-12"
};

export type PrintRequest = {
  id: string;            // UUID
  ticket: string;        // short human code (e.g. "A7K9")
  studentName?: string;
  studentEmail?: string;
  telegramChatId?: string;
  pickupPin?: string;
  pinHash: string;       // bcrypt hash
  status: RequestStatus;
  options: PrintOptions;
  totalPages: number;
  priceIqd: number;
  createdAt: string;     // ISO
  updatedAt: string;
  printedAt?: string;
  pickedUpAt?: string;
};

export type RequestFile = {
  id: string;
  requestId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  pages?: number;
  options: PrintOptions;
  storagePath: string;   // Supabase Storage key
  localPath?: string;    // downloaded local cache
  sha256: string;
  magicByteVerified: boolean;
};

export type PrinterStatus =
  | 'ready'
  | 'printing'
  | 'paused'
  | 'offline'
  | 'error'
  | 'out-of-paper'
  | 'out-of-toner'
  | 'paper-jam'
  | 'unknown';

export type NotificationChannel = 'email' | 'telegram';

export type NotificationEvent =
  | 'received'
  | 'printing'
  | 'ready'
  | 'done'
  | 'canceled'
  | 'blocked';
