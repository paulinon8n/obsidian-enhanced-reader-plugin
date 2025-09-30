export interface IStorage<T = unknown> {
  get: (key: string) => T | undefined;
  set: (key: string, value: T) => void;
  remove?: (key: string) => void;
}
