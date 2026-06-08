import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { TimelineEvent, TimelineService } from '../../../core/services/timeline.service';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Icon } from '../../../shared/ui/icon/icon';

@Component({
  selector: 'app-timeline-event-list',
  imports: [EmptyState, FormsModule, Icon],
  templateUrl: './event-list.html',
  styleUrl: './event-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineEventList {
  readonly weddingId = input.required<string>();

  private readonly timeline = inject(TimelineService);
  private readonly toast = inject(ToastService);

  protected readonly events = this.timeline.events;
  protected readonly hasEvents = computed(() => this.events().length > 0);

  protected readonly newLabel = signal('');
  protected readonly newTime = signal('');

  protected addEvent(): void {
    const label = this.newLabel().trim();
    if (!label) return;

    this.timeline
      .addEvent(this.weddingId(), {
        label,
        eventTime: this.newTime() || null,
        sortOrder: this.nextSortOrder(),
      })
      .subscribe({
        next: () => {
          this.newLabel.set('');
          this.newTime.set('');
          this.toast.success('Punkt został dodany.');
        },
        error: () => this.toast.error('Nie udało się dodać punktu.'),
      });
  }

  protected seedTemplate(): void {
    this.timeline.seedTemplate(this.weddingId()).subscribe({
      next: () => this.toast.success('Szablon DJ-a został wczytany.'),
      error: () => this.toast.error('Nie udało się wczytać szablonu.'),
    });
  }

  protected changeTime(event: TimelineEvent, value: string): void {
    this.timeline.updateEvent(this.weddingId(), event.id, { eventTime: value || null }).subscribe({
      error: () => this.toast.error('Nie udało się zapisać godziny.'),
    });
  }

  protected moveUp(index: number): void {
    if (index <= 0) return;
    this.swap(index, index - 1);
  }

  protected moveDown(index: number): void {
    if (index >= this.events().length - 1) return;
    this.swap(index, index + 1);
  }

  protected removeEvent(event: TimelineEvent): void {
    if (!window.confirm(`Usunąć punkt „${event.label}"?`)) return;
    this.timeline.removeEvent(this.weddingId(), event.id).subscribe({
      next: () => this.toast.success('Punkt został usunięty.'),
      error: () => this.toast.error('Nie udało się usunąć punktu.'),
    });
  }

  private swap(indexA: number, indexB: number): void {
    const list = this.events();
    const a = list[indexA];
    const b = list[indexB];
    if (!a || !b) return;
    this.timeline.swapEvents(this.weddingId(), a, b).subscribe({
      error: () => this.toast.error('Nie udało się zmienić kolejności.'),
    });
  }

  private nextSortOrder(): number {
    const list = this.events();
    return list.length === 0 ? 0 : Math.max(...list.map((e) => e.sortOrder)) + 1;
  }
}
