import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ScanRecord { id: string; data: string; type: string; date: number; }

const KEY = 'scan-history';
const MAX = 200;

export async function loadHistory(): Promise<ScanRecord[]> {
  try { return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]'); } catch { return []; }
}

export async function addToHistory(data: string, type: string): Promise<ScanRecord[]> {
  const list = await loadHistory();
  const rec: ScanRecord = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, data, type, date: Date.now() };
  const next = [rec, ...list.filter(r => r.data !== data)].slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function removeFromHistory(id: string): Promise<ScanRecord[]> {
  const next = (await loadHistory()).filter(r => r.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function clearHistory(): Promise<void> { await AsyncStorage.removeItem(KEY); }
