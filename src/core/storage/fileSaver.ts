export function sanitizeFilename(filename: string): string {
  // Remove characters forbidden on Windows/Linux/macOS
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SaveFileOptions {
  filename: string;
  mimeType: string;
  data: ArrayBuffer | Blob | Uint8Array;
  useFileSystemAccess?: boolean;
}

/**
 * Hands a Blob/File to the browser's download manager. Works for disk-backed
 * Files (OPFS) of any size — the browser reads from disk, not from RAM.
 */
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = sanitizeFilename(filename);
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Keep the URL alive long enough for the download manager to pick it up.
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  }, 60_000);
}

export async function saveFileToDisk({
  filename,
  mimeType,
  data,
  useFileSystemAccess = true,
}: SaveFileOptions): Promise<boolean> {
  const cleanName = sanitizeFilename(filename);
  const ext = cleanName.split('.').pop() || 'mp4';
  const blob = data instanceof Blob ? data : new Blob([data as any], { type: mimeType });

  // 1. Try File System Access API if supported and enabled
  if (useFileSystemAccess && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: cleanName,
        types: [
          {
            description: 'Media File',
            accept: {
              [mimeType]: [`.${ext}`],
            },
          },
        ],
      });

      const writable = await handle.createWritable();
      // Stream instead of loading the whole file into memory.
      await blob.stream().pipeTo(writable);
      return true;
    } catch (err: any) {
      // If user aborted/cancelled the picker, don't fallback to automatic download
      if (err.name === 'AbortError') {
        return false;
      }
      console.warn('File System Access API failed, falling back to Blob download:', err);
    }
  }

  // 2. Fallback: Standard Blob Download
  triggerBrowserDownload(blob, cleanName);
  return true;
}
