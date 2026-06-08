import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { SongKind, TimelineSong, TimelineService } from '../../../core/services/timeline.service';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Icon } from '../../../shared/ui/icon/icon';

@Component({
  selector: 'app-timeline-song-list',
  imports: [EmptyState, FormsModule, Icon],
  templateUrl: './song-list.html',
  styleUrl: './song-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineSongList {
  readonly weddingId = input.required<string>();
  readonly kind = input.required<SongKind>();
  readonly limit = input<number | null>(null);

  private readonly timeline = inject(TimelineService);
  private readonly toast = inject(ToastService);

  protected readonly songs = computed<TimelineSong[]>(() =>
    this.kind() === 'must' ? this.timeline.mustPlay() : this.timeline.doNotPlay(),
  );

  protected readonly atLimit = computed<boolean>(() => {
    const limit = this.limit();
    return limit !== null && this.songs().length >= limit;
  });

  protected readonly newTitle = signal('');
  protected readonly newArtist = signal('');

  protected addSong(): void {
    const title = this.newTitle().trim();
    if (!title) return;
    if (this.atLimit()) {
      this.toast.error(`Lista może mieć maksymalnie ${this.limit()} utworów.`);
      return;
    }

    this.timeline
      .addSong(this.weddingId(), {
        kind: this.kind(),
        title,
        artist: this.newArtist().trim() || null,
        sortOrder: this.songs().length,
      })
      .subscribe({
        next: () => {
          this.newTitle.set('');
          this.newArtist.set('');
        },
        error: () => this.toast.error('Nie udało się dodać utworu.'),
      });
  }

  protected removeSong(song: TimelineSong): void {
    this.timeline.removeSong(this.weddingId(), song.id).subscribe({
      error: () => this.toast.error('Nie udało się usunąć utworu.'),
    });
  }
}
