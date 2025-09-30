import type { IStorage } from '../../core/storage';

export class LocalStorageAdapter<T = unknown> implements IStorage<T> {
  constructor(private readonly namespace = 'enhanced-reader') {}

  private keyName(key: string) {
    return `${this.namespace}:${key}`;
  }

  get(key: string): T | undefined {
    try {
      const raw = localStorage.getItem(this.keyName(key));
      if (raw == null) return undefined;
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  set(key: string, value: T): void {
    try {
      localStorage.setItem(this.keyName(key), JSON.stringify(value));
    } catch {
      // ignore quota or serialization errors
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.keyName(key));
    } catch {
      // ignore
    }
  }
}
