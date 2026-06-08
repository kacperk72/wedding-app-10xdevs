import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { GuestsService } from '../../../core/services/guests.service';
import { ToastService } from '../../../core/services/toast.service';
import { TimelineService } from '../../../core/services/timeline.service';
import { VendorsService } from '../../../core/services/vendors.service';
import { WeddingService } from '../../../core/services/wedding.service';
import {
  CEREMONY_TYPE_LABELS,
  ENTRANCE_ORDER_LABELS,
  GENRE_LABELS,
  GLASS_THROWING_LABELS,
  STAGE_LABELS,
  WISHES_LOCATION_LABELS,
} from '../harmonogram.constants';

@Component({
  selector: 'app-dj-export',
  imports: [DatePipe, RouterLink],
  templateUrl: './dj-export.html',
  styleUrl: './dj-export.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DjExport implements OnInit {
  private readonly timelineService = inject(TimelineService);
  private readonly weddingService = inject(WeddingService);
  private readonly guestsService = inject(GuestsService);
  private readonly vendorsService = inject(VendorsService);
  private readonly toast = inject(ToastService);

  protected readonly loaded = signal(false);

  protected readonly timeline = this.timelineService.timeline;
  protected readonly events = this.timelineService.events;
  protected readonly mustPlay = this.timelineService.mustPlay;
  protected readonly doNotPlay = this.timelineService.doNotPlay;

  protected readonly wedding = computed(() => this.weddingService.wedding());
  protected readonly coupleLabel = computed(() => this.weddingService.coupleLabel());
  protected readonly guestCount = computed(() => this.guestsService.aggregates());
  protected readonly djVendor = computed(
    () => this.vendorsService.vendors().find((v) => v.category === 'dj') ?? null,
  );
  protected readonly venueVendor = computed(
    () => this.vendorsService.vendors().find((v) => v.category === 'sala') ?? null,
  );

  // Wybrane gatunki z etykietami (kolejność wg zaznaczenia pary).
  protected readonly selectedGenres = computed<string[]>(() =>
    (this.timeline()?.genrePreferences ?? []).map((value) => GENRE_LABELS[value] ?? value),
  );

  // Muzyka per etap → pary {etykieta, wartość}, tylko niepuste wpisy.
  protected readonly stageMusic = computed<{ label: string; value: string }[]>(() =>
    Object.entries(this.timeline()?.musicPerStage ?? {})
      .filter(([, value]) => (value ?? '').trim() !== '')
      .map(([key, value]) => ({ label: STAGE_LABELS[key] ?? key, value })),
  );

  ngOnInit(): void {
    const weddingId = this.weddingService.wedding()?.id;
    if (weddingId) {
      this.bootstrap(weddingId);
      return;
    }

    this.weddingService.loadCurrent().subscribe({
      next: (wedding) => {
        if (wedding) {
          this.bootstrap(wedding.id);
          return;
        }
        this.toast.error('Najpierw skonfiguruj wesele.');
      },
      error: () => this.toast.error('Nie udało się pobrać wesela.'),
    });
  }

  protected print(): void {
    window.print();
  }

  protected ceremonyTypeLabel(value: string | null): string {
    return value ? CEREMONY_TYPE_LABELS[value] ?? value : '—';
  }

  protected entranceOrderLabel(value: string | null): string {
    return value ? ENTRANCE_ORDER_LABELS[value] ?? value : '—';
  }

  protected glassThrowingLabel(value: string | null): string {
    return value ? GLASS_THROWING_LABELS[value] ?? value : '—';
  }

  protected wishesLocationLabel(value: string | null): string {
    return value ? WISHES_LOCATION_LABELS[value] ?? value : '—';
  }

  protected yesNo(value: boolean | null): string {
    if (value === true) return 'Tak';
    if (value === false) return 'Nie';
    return '—';
  }

  protected text(value: string | number | null): string {
    if (value === null || value === undefined || `${value}`.trim() === '') return '—';
    return `${value}`;
  }

  private bootstrap(weddingId: string): void {
    forkJoin([
      this.timelineService.load(weddingId),
      this.guestsService.loadAggregates(weddingId),
      this.vendorsService.list(weddingId),
    ]).subscribe({
      next: () => this.loaded.set(true),
      error: () => this.toast.error('Nie udało się pobrać harmonogramu.'),
    });
  }
}
