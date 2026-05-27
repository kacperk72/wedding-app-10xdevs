import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

export interface ShowToastInput {
  kind: ToastKind;
  message: string;
  durationMs?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show({ kind, message, durationMs }: ShowToastInput): void {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this._toasts.update((list) => [...list, { id, kind, message }]);
    setTimeout(() => this.dismiss(id), durationMs ?? 4000);
  }

  success(message: string): void {
    this.show({ kind: 'success', message });
  }

  error(message: string): void {
    this.show({ kind: 'error', message });
  }

  warning(message: string): void {
    this.show({ kind: 'warning', message });
  }

  dismiss(id: string): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
