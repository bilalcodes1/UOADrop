import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';

/**
 * Count printable pages for a locally saved file.
 * - PDF  → exact page count via pdf-lib
 * - PPTX → slide count (each slide = 1 page)
 * - JPG / PNG → 1 page per image
 * - DOCX / XLSX → 0 (requires Office renderer; entered manually on dashboard)
 */
export async function countFilePages(localPath: string, ext: string): Promise<number> {
  try {
    switch (ext) {
      case '.pdf':
        return await countPdfPages(localPath);
      case '.pptx':
        return await countPptxSlides(localPath);
      case '.jpg':
      case '.jpeg':
      case '.png':
        return 1;
      default:
        return 0;
    }
  } catch {
    return 0;
  }
}

async function countPdfPages(localPath: string): Promise<number> {
  const buf = await readFile(localPath);
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  return doc.getPageCount();
}

async function countPptxSlides(localPath: string): Promise<number> {
  const buf = await readFile(localPath);
  // PPTX is a ZIP archive; slide files follow the pattern ppt/slides/slideN.xml.
  // The filename string appears in both the local-file-header and the central-directory,
  // so we deduplicate by slide number using a Set.
  const text = buf.toString('binary');
  const re = /ppt\/slides\/slide(\d+)\.xml/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    seen.add(m[1]!);
  }
  return seen.size;
}
