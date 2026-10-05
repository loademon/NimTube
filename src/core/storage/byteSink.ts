/**
 * ByteSink — disk-backed storage for large downloads.
 *
 * Long videos (e.g. 8-hour livestreams, 10+ GB) cannot be held in RAM. Every
 * downloaded or muxed byte is written straight to disk through one of:
 *   1. A file the user picked with `showSaveFilePicker` (final output, zero extra copy)
 *   2. A temporary file in the Origin Private File System (OPFS)
 *   3. In-memory fallback (only for browsers without OPFS write support)
 *
 * `finish()` returns a disk-backed `File`/`Blob` that can be read lazily
 * (e.g. by mediabunny's BlobSource) without loading it into memory.
 */

export interface ByteSink {
  /** Write `data` at the given byte offset. Calls are serialized internally. */
  write(position: number, data: Uint8Array): Promise<void>;
  /** Commit all writes and return a lazily readable Blob of the content. */
  finish(): Promise<Blob>;
  /** Discard everything written so far. */
  abort(): Promise<void>;
  /** Delete the underlying temp file (no-op for user files / memory). */
  dispose(): Promise<void>;
  /** True if data goes to disk (OPFS or user file). */
  readonly diskBacked: boolean;
  /** True if the sink is a file the user chose (already saved to their disk). */
  readonly isUserFile: boolean;
}

const TEMP_DIR = 'nimtube-tmp';
const STALE_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

async function getTempDir(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (!navigator.storage?.getDirectory) return null;
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(TEMP_DIR, { create: true });
  } catch {
    return null;
  }
}

let opfsWritableSupport: Promise<boolean> | null = null;

/** Checks whether OPFS supports `createWritable` (Chrome/Edge/Firefox; not older Safari). */
export function isDiskStorageSupported(): Promise<boolean> {
  if (!opfsWritableSupport) {
    opfsWritableSupport = (async () => {
      const dir = await getTempDir();
      if (!dir) return false;
      try {
        const probe = await dir.getFileHandle('.probe', { create: true });
        if (typeof (probe as any).createWritable !== 'function') return false;
        const w = await (probe as any).createWritable();
        await w.close();
        await dir.removeEntry('.probe').catch(() => {});
        return true;
      } catch {
        return false;
      }
    })();
  }
  return opfsWritableSupport;
}

const LOCK_PREFIX = 'nimtube-tmp:';

/**
 * Holds a Web Lock for a temp file while it is in use, so other tabs (and the
 * cleanup below) know not to delete it. Returns a release function.
 */
function holdFileLock(name: string): () => void {
  let release: () => void = () => {};
  if (!navigator.locks?.request) return release;
  const held = new Promise<void>((resolve) => (release = resolve));
  navigator.locks.request(LOCK_PREFIX + name, () => held).catch(() => {});
  return release;
}

async function getLockedFileNames(): Promise<Set<string> | null> {
  try {
    if (!navigator.locks?.query) return null;
    const { held = [], pending = [] } = await navigator.locks.query();
    const names = new Set<string>();
    for (const l of [...held, ...pending]) {
      if (l.name?.startsWith(LOCK_PREFIX)) names.add(l.name.slice(LOCK_PREFIX.length));
    }
    return names;
  } catch {
    return null;
  }
}

/**
 * Removes leftover temp files from earlier sessions / crashed tabs. Files in
 * use by any tab are protected by a Web Lock; without lock support, only files
 * older than `maxAgeMs` are removed.
 */
export async function cleanupStaleTempFiles(maxAgeMs = STALE_AGE_MS): Promise<void> {
  const dir = await getTempDir();
  if (!dir) return;
  const locked = await getLockedFileNames();
  const now = Date.now();
  try {
    const names: string[] = [];
    for await (const [name, handle] of (dir as any).entries()) {
      if (handle.kind === 'file') names.push(name);
    }
    for (const name of names) {
      // Chrome writes through "<name>.crswap" swap files; they belong to <name>.
      const base = name.endsWith('.crswap') ? name.slice(0, -'.crswap'.length) : name;
      try {
        if (locked) {
          if (locked.has(base)) continue;
        } else {
          const file: File = await (await dir.getFileHandle(name)).getFile();
          if (now - file.lastModified <= maxAgeMs) continue;
        }
        await dir.removeEntry(name);
      } catch {
        // File may be locked by an active writer — skip.
      }
    }
  } catch {
    // Ignore — cleanup is best effort.
  }
}

/** Returns free browser storage quota for this site in bytes, or Infinity if unknown. */
export async function getAvailableStorage(): Promise<number> {
  try {
    const est = await navigator.storage?.estimate?.();
    if (est && typeof est.quota === 'number' && typeof est.usage === 'number') {
      return Math.max(0, est.quota - est.usage);
    }
  } catch {}
  return Infinity;
}

/** Wraps a FileSystemFileHandle's writable into a serialized positional ByteSink. */
async function createHandleSink(
  handle: FileSystemFileHandle,
  opts: { isUserFile: boolean; onDispose?: () => Promise<void> }
): Promise<ByteSink> {
  const writable: any = await (handle as any).createWritable({ keepExistingData: false });
  const writer: WritableStreamDefaultWriter<any> = writable.getWriter();
  let queue: Promise<void> = Promise.resolve();
  let failed: unknown = null;
  let closed = false;

  return {
    diskBacked: true,
    isUserFile: opts.isUserFile,
    write(position, data) {
      if (failed) return Promise.reject(failed);
      queue = queue.then(() =>
        writer.write({ type: 'write', position, data }).catch((err) => {
          failed = err;
          throw err;
        })
      );
      return queue;
    },
    async finish() {
      await queue;
      if (!closed) {
        closed = true;
        await writer.close();
      }
      return await handle.getFile();
    },
    async abort() {
      if (closed) return;
      closed = true;
      try {
        await writer.abort();
      } catch {}
    },
    async dispose() {
      await opts.onDispose?.();
    },
  };
}

/** In-memory fallback. Only used when the browser has no OPFS write support. */
function createMemorySink(mimeType: string): ByteSink {
  const parts = new Map<number, Uint8Array>();
  return {
    diskBacked: false,
    isUserFile: false,
    async write(position, data) {
      parts.set(position, data);
    },
    async finish() {
      const ordered = [...parts.entries()].sort((a, b) => a[0] - b[0]).map(([, d]) => d);
      parts.clear();
      return new Blob(ordered as BlobPart[], { type: mimeType });
    },
    async abort() {
      parts.clear();
    },
    async dispose() {
      parts.clear();
    },
  };
}

/** Creates a temporary disk-backed sink (OPFS), falling back to memory. */
export async function createTempSink(label: string, mimeType = 'application/octet-stream'): Promise<ByteSink> {
  if (await isDiskStorageSupported()) {
    const dir = await getTempDir();
    if (dir) {
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${label}`;
      const release = holdFileLock(name);
      try {
        const handle = await dir.getFileHandle(name, { create: true });
        return await createHandleSink(handle, {
          isUserFile: false,
          onDispose: async () => {
            await dir.removeEntry(name).catch(() => {});
            release();
          },
        });
      } catch (err) {
        release();
        console.warn('[ByteSink] OPFS temp file could not be created, using memory:', err);
      }
    }
  }
  return createMemorySink(mimeType);
}

/** Creates a sink writing directly into a file the user picked. */
export async function createUserFileSink(handle: FileSystemFileHandle): Promise<ByteSink> {
  return createHandleSink(handle, {
    isUserFile: true,
    onDispose: async () => {},
  });
}

/**
 * Asks the user where to save the file. MUST be called while the click's user
 * activation is still valid (i.e. before any long awaits). Returns null if the
 * picker is unsupported/disabled; throws AbortError if the user cancelled.
 */
export async function pickSaveFile(
  suggestedName: string,
  mimeType: string,
  enabled: boolean
): Promise<FileSystemFileHandle | null> {
  if (!enabled || !('showSaveFilePicker' in window)) return null;
  const ext = suggestedName.split('.').pop() || 'mp4';
  try {
    return await (window as any).showSaveFilePicker({
      suggestedName,
      types: [{ description: 'Media File', accept: { [mimeType]: [`.${ext}`] } }],
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    // SecurityError (no user activation) or other — fall back to normal download.
    console.warn('[ByteSink] Save picker unavailable, using normal download:', err);
    return null;
  }
}

/** Removes an (empty) user file after a failed/cancelled download. Best effort. */
export async function removeUserFile(handle: FileSystemFileHandle | null): Promise<void> {
  if (!handle) return;
  try {
    await (handle as any).remove?.();
  } catch {}
}

/** Adapts a ByteSink into a WritableStream usable by mediabunny's StreamTarget. */
export function sinkToWritableStream(
  sink: ByteSink
): WritableStream<{ type: 'write'; data: Uint8Array; position: number }> {
  return new WritableStream({
    async write(chunk) {
      // mediabunny may reuse its buffers — copy to be safe for queued writes.
      await sink.write(chunk.position, chunk.data.slice());
    },
  });
}
