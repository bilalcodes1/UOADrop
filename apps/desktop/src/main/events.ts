import { EventEmitter } from 'node:events';

export type AppEvent =
  | { type: 'requests:changed'; reason: string; requestId?: string }
  | { type: 'printer:changed'; status: string };

export const bus = new EventEmitter();

export function emit(ev: AppEvent): void {
  bus.emit(ev.type, ev);
}

export function subscribe(
  type: AppEvent['type'],
  handler: (ev: AppEvent) => void,
): () => void {
  bus.on(type, handler);
  return () => bus.off(type, handler);
}
