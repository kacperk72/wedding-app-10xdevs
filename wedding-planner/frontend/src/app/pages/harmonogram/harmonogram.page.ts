import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, debounceTime, forkJoin, map, switchMap } from 'rxjs';
import { GuestsService } from '../../core/services/guests.service';
import { ToastService } from '../../core/services/toast.service';
import { Timeline, TimelinePatch, TimelineService } from '../../core/services/timeline.service';
import { VendorsService } from '../../core/services/vendors.service';
import { WeddingService } from '../../core/services/wedding.service';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { TimelineEventList } from './event-list/event-list';
import { TimelineSongList } from './song-list/song-list';
import {
  CEREMONY_TYPE_OPTIONS,
  ENTRANCE_ORDER_OPTIONS,
  GENRE_CATEGORIES,
  GLASS_THROWING_OPTIONS,
  MUSIC_STAGES,
  MUST_PLAY_LIMIT,
  WISHES_LOCATION_OPTIONS,
} from './harmonogram.constants';

type TriState = '' | 'yes' | 'no';

interface HarmonogramForm {
  ceremonyType: string;
  ceremonyTime: string;
  travelMinutes: string;
  venueArrivalTime: string;
  entranceOrder: string;
  glassThrowing: string;
  wishesLocation: string;
  danceFloorGroundFloor: TriState;
  hasChildren: TriState;
  gorzkoTolerance: TriState;
  venueManagerName: string;
  venueManagerPhone: string;
  witnesses: string;
  brideParents: string;
  groomParents: string;
  firstDanceTime: string;
  firstDanceSong: string;
  firstDanceFull: TriState;
  parentsThanksEnabled: TriState;
  parentsThanksTime: string;
  parentsThanksForm: string;
  parentsThanksSong: string;
  cakeTime: string;
  cakeEntrySong: string;
  cakeCuttingSong: string;
  notes: string;
}

const EMPTY_FORM: HarmonogramForm = {
  ceremonyType: '',
  ceremonyTime: '',
  travelMinutes: '',
  venueArrivalTime: '',
  entranceOrder: '',
  glassThrowing: '',
  wishesLocation: '',
  danceFloorGroundFloor: '',
  hasChildren: '',
  gorzkoTolerance: '',
  venueManagerName: '',
  venueManagerPhone: '',
  witnesses: '',
  brideParents: '',
  groomParents: '',
  firstDanceTime: '',
  firstDanceSong: '',
  firstDanceFull: '',
  parentsThanksEnabled: '',
  parentsThanksTime: '',
  parentsThanksForm: '',
  parentsThanksSong: '',
  cakeTime: '',
  cakeEntrySong: '',
  cakeCuttingSong: '',
  notes: '',
};

// Autozapis: PATCH leci 4 s po ostatniej zmianie (debounce). Nowa zmiana resetuje odliczanie.
const AUTOSAVE_DELAY_MS = 4000;

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

function tri(value: boolean | null): TriState {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return '';
}

function formFrom(timeline: Timeline): HarmonogramForm {
  return {
    ceremonyType: timeline.ceremonyType ?? '',
    ceremonyTime: timeline.ceremonyTime ?? '',
    travelMinutes: timeline.travelMinutes == null ? '' : String(timeline.travelMinutes),
    venueArrivalTime: timeline.venueArrivalTime ?? '',
    entranceOrder: timeline.entranceOrder ?? '',
    glassThrowing: timeline.glassThrowing ?? '',
    wishesLocation: timeline.wishesLocation ?? '',
    danceFloorGroundFloor: tri(timeline.danceFloorGroundFloor),
    hasChildren: tri(timeline.hasChildren),
    gorzkoTolerance: tri(timeline.gorzkoTolerance),
    venueManagerName: timeline.venueManagerName ?? '',
    venueManagerPhone: timeline.venueManagerPhone ?? '',
    witnesses: timeline.witnesses ?? '',
    brideParents: timeline.brideParents ?? '',
    groomParents: timeline.groomParents ?? '',
    firstDanceTime: timeline.firstDanceTime ?? '',
    firstDanceSong: timeline.firstDanceSong ?? '',
    firstDanceFull: tri(timeline.firstDanceFull),
    parentsThanksEnabled: tri(timeline.parentsThanksEnabled),
    parentsThanksTime: timeline.parentsThanksTime ?? '',
    parentsThanksForm: timeline.parentsThanksForm ?? '',
    parentsThanksSong: timeline.parentsThanksSong ?? '',
    cakeTime: timeline.cakeTime ?? '',
    cakeEntrySong: timeline.cakeEntrySong ?? '',
    cakeCuttingSong: timeline.cakeCuttingSong ?? '',
    notes: timeline.notes ?? '',
  };
}

@Component({
  selector: 'app-harmonogram-page',
  imports: [FormsModule, RouterLink, PageHeader, TimelineEventList, TimelineSongList],
  templateUrl: './harmonogram.page.html',
  styleUrl: './harmonogram.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HarmonogramPage implements OnInit, OnDestroy {
  private readonly timelineService = inject(TimelineService);
  private readonly weddingService = inject(WeddingService);
  private readonly guestsService = inject(GuestsService);
  private readonly vendorsService = inject(VendorsService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly ceremonyTypeOptions = CEREMONY_TYPE_OPTIONS;
  protected readonly entranceOrderOptions = ENTRANCE_ORDER_OPTIONS;
  protected readonly glassThrowingOptions = GLASS_THROWING_OPTIONS;
  protected readonly wishesLocationOptions = WISHES_LOCATION_OPTIONS;
  protected readonly genreCategories = GENRE_CATEGORIES;
  protected readonly musicStages = MUSIC_STAGES;
  protected readonly mustPlayLimit = MUST_PLAY_LIMIT;

  protected readonly weddingId = signal<string | null>(null);
  protected readonly loaded = signal(false);

  protected readonly form = signal<HarmonogramForm>({ ...EMPTY_FORM });
  protected readonly genres = signal<string[]>([]);
  protected readonly stageMusic = signal<Record<string, string>>({});

  // Read-only kontekst reużywany z innych encji (bez nadpisywania źródeł).
  protected readonly coupleLabel = computed(() => this.weddingService.coupleLabel());
  protected readonly ceremonyLocation = computed(
    () => this.weddingService.wedding()?.ceremonyLocation ?? null,
  );
  protected readonly guestCount = computed(() => this.guestsService.aggregates());
  protected readonly djVendor = computed(
    () => this.vendorsService.vendors().find((v) => v.category === 'dj') ?? null,
  );
  protected readonly venueVendor = computed(
    () => this.vendorsService.vendors().find((v) => v.category === 'sala') ?? null,
  );

  // Status autozapisu pokazywany dyskretnie w nagłówku (zamiast toasta co 4 s).
  protected readonly saveStatus = signal<SaveStatus>('idle');
  protected readonly lastSavedAt = signal<Date | null>(null);
  protected readonly lastSavedLabel = computed(() => {
    const at = this.lastSavedAt();
    return at ? at.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '';
  });

  private readonly saveTrigger = new Subject<void>();
  // Monotoniczne liczniki: jest niezapisana zmiana, gdy editSeq > savedSeq. Odporne na
  // edycję w trakcie zapisu i na anulowanie żądania przy opuszczeniu strony.
  private editSeq = 0;
  private savedSeq = 0;

  constructor() {
    this.saveTrigger
      .pipe(
        debounceTime(AUTOSAVE_DELAY_MS),
        switchMap(() => {
          const weddingId = this.weddingId();
          if (!weddingId) return EMPTY;
          const firingSeq = this.editSeq;
          this.saveStatus.set('saving');
          return this.timelineService.patchFields(weddingId, this.buildPatch()).pipe(
            map(() => firingSeq),
            catchError(() => {
              this.saveStatus.set('error');
              this.toast.error('Nie udało się zapisać harmonogramu.');
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((firingSeq) => {
        this.savedSeq = Math.max(this.savedSeq, firingSeq);
        this.lastSavedAt.set(new Date());
        // Jeśli w trakcie zapisu pojawiła się nowsza zmiana, wróć do stanu „oczekuje".
        this.saveStatus.set(this.editSeq > this.savedSeq ? 'pending' : 'saved');
      });
  }

  ngOnDestroy(): void {
    // Wyjście ze strony przed upływem 4 s nie może gubić zmian — dosyłamy ostatni stan.
    if (this.editSeq > this.savedSeq) {
      const weddingId = this.weddingId();
      if (weddingId) {
        this.timelineService.patchFields(weddingId, this.buildPatch()).subscribe();
      }
    }
  }

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

  protected updateForm(patch: Partial<HarmonogramForm>): void {
    this.form.update((current) => ({ ...current, ...patch }));
    this.queueSave();
  }

  protected toggleGenre(value: string): void {
    this.genres.update((current) =>
      current.includes(value) ? current.filter((g) => g !== value) : [...current, value],
    );
    this.queueSave();
  }

  protected isGenreSelected(value: string): boolean {
    return this.genres().includes(value);
  }

  protected stageValue(key: string): string {
    return this.stageMusic()[key] ?? '';
  }

  protected updateStage(key: string, value: string): void {
    this.stageMusic.update((current) => ({ ...current, [key]: value }));
    this.queueSave();
  }

  // Każda zmiana pola planuje debounce'owany zapis CAŁEGO formularza (jeden PATCH).
  // Pomijamy fazę ładowania — bootstrap() ustawia stan przez .set(), nie przez te metody.
  private queueSave(): void {
    if (!this.loaded()) return;
    this.editSeq++;
    this.saveStatus.set('pending');
    this.saveTrigger.next();
  }

  private buildPatch(): TimelinePatch {
    const f = this.form();
    // Usuń puste wpisy muzyki per etap, żeby nie zapisywać pustych łańcuchów.
    const musicPerStage = Object.fromEntries(
      Object.entries(this.stageMusic())
        .map(([key, value]) => [key, value.trim()] as const)
        .filter(([, value]) => value !== ''),
    );
    const patch: TimelinePatch = {
      ceremonyType: (f.ceremonyType || null) as TimelinePatch['ceremonyType'],
      ceremonyTime: f.ceremonyTime || null,
      travelMinutes: this.parseMinutes(f.travelMinutes),
      venueArrivalTime: f.venueArrivalTime || null,
      entranceOrder: (f.entranceOrder || null) as TimelinePatch['entranceOrder'],
      glassThrowing: (f.glassThrowing || null) as TimelinePatch['glassThrowing'],
      wishesLocation: (f.wishesLocation || null) as TimelinePatch['wishesLocation'],
      venueManagerName: f.venueManagerName.trim() || null,
      venueManagerPhone: f.venueManagerPhone.trim() || null,
      witnesses: f.witnesses.trim() || null,
      brideParents: f.brideParents.trim() || null,
      groomParents: f.groomParents.trim() || null,
      firstDanceTime: f.firstDanceTime || null,
      firstDanceSong: f.firstDanceSong.trim() || null,
      parentsThanksTime: f.parentsThanksTime || null,
      parentsThanksForm: f.parentsThanksForm.trim() || null,
      parentsThanksSong: f.parentsThanksSong.trim() || null,
      cakeTime: f.cakeTime || null,
      cakeEntrySong: f.cakeEntrySong.trim() || null,
      cakeCuttingSong: f.cakeCuttingSong.trim() || null,
      notes: f.notes.trim() || null,
      genrePreferences: this.genres(),
      musicPerStage,
    };
    this.applyTri(patch, 'danceFloorGroundFloor', f.danceFloorGroundFloor);
    this.applyTri(patch, 'hasChildren', f.hasChildren);
    this.applyTri(patch, 'gorzkoTolerance', f.gorzkoTolerance);
    this.applyTri(patch, 'firstDanceFull', f.firstDanceFull);
    this.applyTri(patch, 'parentsThanksEnabled', f.parentsThanksEnabled);
    return patch;
  }

  // `<input type="number">` emituje number|null (a po wpisaniu śmieci NaN) — sprowadzamy
  // wszystko do `number | null`, żeby wyczyszczone pole nie zapisało się jako 0.
  private parseMinutes(value: string): number | null {
    if (value === '' || value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private applyTri(patch: TimelinePatch, key: keyof TimelinePatch, value: TriState): void {
    // optionalBoolean na backendzie odrzuca null — pole pomijamy, dopóki nie wybrano Tak/Nie.
    if (value === '') return;
    (patch as Record<string, unknown>)[key] = value === 'yes';
  }

  private bootstrap(weddingId: string): void {
    this.weddingId.set(weddingId);
    forkJoin([
      this.timelineService.load(weddingId),
      this.guestsService.loadAggregates(weddingId),
      this.vendorsService.list(weddingId),
    ]).subscribe({
      next: ([timeline]) => {
        this.form.set(formFrom(timeline));
        this.genres.set([...timeline.genrePreferences]);
        this.stageMusic.set({ ...timeline.musicPerStage });
        this.loaded.set(true);
      },
      error: () => this.toast.error('Nie udało się pobrać harmonogramu.'),
    });
  }
}
