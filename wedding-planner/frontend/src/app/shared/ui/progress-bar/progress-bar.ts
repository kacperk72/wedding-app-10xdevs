import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type ProgressTone = 'auto' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'app-progress-bar',
  templateUrl: './progress-bar.html',
  styleUrl: './progress-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressBar {
  readonly value = input<number>(0);
  readonly tone = input<ProgressTone>('auto');

  protected readonly resolvedTone = computed<Exclude<ProgressTone, 'auto'>>(() => {
    const explicit = this.tone();
    if (explicit !== 'auto') return explicit;
    const v = this.clamped();
    if (v > 90) return 'danger';
    if (v >= 70) return 'warning';
    return 'success';
  });

  protected readonly clamped = computed(() => {
    const v = this.value();
    if (Number.isNaN(v)) return 0;
    return Math.max(0, Math.min(100, v));
  });
}
