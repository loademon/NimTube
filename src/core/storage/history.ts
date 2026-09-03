export interface HistoryItem {
  id: string;
  videoId: string;
  title: string;
  thumbnailUrl: string;
  formatLabel: string;
  ext: string;
  filesizeFormatted?: string;
  timestamp: number;
  originalUrl: string;
}

const STORAGE_KEY = 'nimtube_download_history';

export function getHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function addToHistory(item: Omit<HistoryItem, 'id' | 'timestamp'>): HistoryItem[] {
  const current = getHistory();
  const newItem: HistoryItem = {
    ...item,
    id: Math.random().toString(36).substring(2, 9),
    timestamp: Date.now(),
  };

  // Keep up to 50 latest items
  const updated = [newItem, ...current.filter((c) => c.videoId !== item.videoId || c.formatLabel !== item.formatLabel)].slice(0, 50);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('History save failed:', err);
  }
  return updated;
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
