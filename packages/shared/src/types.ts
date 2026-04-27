// Shared TypeScript types for UOADrop (web + desktop + edge functions)

export type RequestStatus =
  | 'pending'   // uploaded, waiting for librarian
  | 'printing'  // librarian started printing
  | 'ready'     // printed, waiting for student pickup
  | 'done'      // picked up
  | 'canceled'  // student canceled
  | 'blocked';  // abuse

export type RequestSourceOfTruth = 'supabase_intake' | 'desktop';

export type OnlineImportState =
  | 'pending'
  | 'download_started'
  | 'downloaded'
  | 'imported'
  | 'cleanup_pending'
  | 'cleanup_done';

export type PrintQueueState = 'idle' | 'queued' | 'spooling' | 'failed';

export type RequestEventType =
  | 'request_created'
  | 'file_added'
  | 'desk_received'
  | 'price_set'
  | 'print_queued'
  | 'printing_started'
  | 'print_spooling'
  | 'print_failed'
  | 'print_recovered'
  | 'ready'
  | 'picked_up'
  | 'deleted'
  | 'status_changed'
  | 'cleanup_done';

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
  source: 'local' | 'online';
  studentName?: string;
  studentEmail?: string;
  telegramChatId?: string;
  notes?: string;
  status: RequestStatus;
  options: PrintOptions;
  totalPages: number;
  priceIqd: number;
  sourceOfTruth?: RequestSourceOfTruth;
  importState?: OnlineImportState;
  createdAt: string;     // ISO
  updatedAt: string;
  deskReceivedAt?: string;
  printedAt?: string;
  pickedUpAt?: string;
  finalPriceConfirmedAt?: string;
  onlineFilesCleanupAt?: string;
  fileCount?: number;
  printQueueState?: PrintQueueState;
  printQueueError?: string;
  printQueueUpdatedAt?: string;
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

export type RequestEvent = {
  id: number;
  requestId: string;
  type: RequestEventType;
  actor: 'system' | 'student' | 'librarian';
  status?: RequestStatus;
  details?: Record<string, unknown> | null;
  createdAt: string;
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
