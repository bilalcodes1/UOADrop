// File validation helpers — shared between desktop, web, edge functions.
// Magic-byte sniffing for the formats we accept.

export type DetectedKind =
  | 'pdf'
  | 'docx'
  | 'pptx'
  | 'xlsx'
  | 'jpg'
  | 'png'
  | 'unknown';

export function detectMagic(buf: Uint8Array): DetectedKind {
  if (buf.length < 4) return 'unknown';

  // PDF: %PDF
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return 'pdf';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'png';
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpg';
  }

  // ZIP (PK\x03\x04) → could be docx/pptx/xlsx (OOXML). We can't distinguish
  // strictly without peeking into the archive; caller should combine with
  // extension/MIME for office formats.
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    return 'docx'; // treat generically as OOXML
  }

  return 'unknown';
}

export function extensionForMime(mime: string): string | null {
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  };
  return map[mime] ?? null;
}

export function isAllowedExtension(ext: string, allowed: readonly string[]): boolean {
  return allowed.includes(ext.toLowerCase());
}

export function isAllowedMime(mime: string, allowed: readonly string[]): boolean {
  return allowed.includes(mime);
}
