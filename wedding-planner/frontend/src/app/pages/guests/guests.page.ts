import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  CreateGuestDto,
  DIET_LABELS,
  Diet,
  Guest,
  RELATION_LABELS,
  RSVP_LABELS,
  Relation,
  RsvpStatus,
  UpdateGuestDto,
} from '../../core/models/guest.model';
import { GuestsService } from '../../core/services/guests.service';
import { MealOptionsService } from '../../core/services/meal-options.service';
import { TablesService } from '../../core/services/tables.service';
import { ToastService } from '../../core/services/toast.service';
import { WeddingService } from '../../core/services/wedding.service';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { Icon } from '../../shared/ui/icon/icon';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';

const RELATIONS = Object.keys(RELATION_LABELS) as Relation[];
const DIETS = Object.keys(DIET_LABELS) as Diet[];
const RSVP_STATUSES = Object.keys(RSVP_LABELS) as RsvpStatus[];

@Component({
  selector: 'app-guests-page',
  imports: [EmptyState, FormsModule, Icon, PageHeader],
  templateUrl: './guests.page.html',
  styleUrl: './guests.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestsPage implements OnInit {
  private readonly guestsService = inject(GuestsService);
  protected readonly mealOptionsService = inject(MealOptionsService);
  protected readonly tablesService = inject(TablesService);
  private readonly weddingService = inject(WeddingService);
  private readonly toast = inject(ToastService);

  protected readonly guests = this.guestsService.guests;
  protected readonly wedding = this.weddingService.wedding;
  protected readonly filters = this.guestsService.filters;
  protected readonly filteredGuests = this.guestsService.filteredGuests;
  protected readonly aggregates = this.guestsService.aggregates;
  protected readonly groupedByRelation = this.guestsService.groupedByRelation;

  protected readonly relationOptions = RELATIONS.map((value) => ({
    value,
    label: RELATION_LABELS[value],
  }));
  protected readonly dietOptions = DIETS.map((value) => ({ value, label: DIET_LABELS[value] }));
  protected readonly rsvpOptions = RSVP_STATUSES.map((value) => ({ value, label: RSVP_LABELS[value] }));

  protected readonly isAddDialogOpen = signal(false);
  protected readonly newGuest = signal<CreateGuestDto>({
    firstName: '',
    lastName: '',
    relation: 'wspolni_znajomi',
    diet: 'standard',
  });

  protected readonly editingGuest = signal<Guest | null>(null);
  protected readonly editForm = signal<{ firstName: string; lastName: string }>({
    firstName: '',
    lastName: '',
  });

  // Lista gości na wydruk winietek: wszyscy oprócz odmów (declined), sortowani
  // alfabetycznie po nazwisku, potem imieniu — deterministycznie, niezależnie
  // od filtrów ustawionych na ekranie.
  protected readonly winietkiList = computed(() =>
    this.guests()
      .filter((guest) => guest.rsvpStatus !== 'declined')
      .sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName, 'pl') ||
          a.firstName.localeCompare(b.firstName, 'pl'),
      ),
  );

  protected readonly aggregateCards = computed(() => {
    const a = this.aggregates();
    return [
      ['Zaproszonych', a.invited.toString()],
      ['Potwierdzonych', a.confirmed.toString()],
      ['Oczekuje', a.pending.toString()],
      ['Odmów', a.declined.toString()],
      ['Wege', a.vegeOrVegan.toString()],
      ['Dzieci', a.children.toString()],
      ['Bez dania', a.noMealPick.toString()],
    ];
  });

  ngOnInit(): void {
    const weddingId = this.weddingService.wedding()?.id;
    if (weddingId) {
      this.loadResources(weddingId);
      return;
    }

    this.weddingService.loadCurrent().subscribe({
      next: (wedding) => {
        if (wedding) {
          this.loadResources(wedding.id);
          return;
        }
        this.toast.error('Najpierw skonfiguruj wesele.');
      },
      error: () => this.toast.error('Nie udało się pobrać wesela.'),
    });
  }

  private loadResources(weddingId: string): void {
    forkJoin([
      this.guestsService.list(weddingId),
      this.mealOptionsService.list(weddingId),
      this.tablesService.list(weddingId),
    ]).subscribe({
      error: () => this.toast.error('Nie udało się pobrać danych gości.'),
    });
  }

  protected updateNewGuest(patch: Partial<CreateGuestDto>): void {
    this.newGuest.update((current) => ({ ...current, ...patch }));
  }

  protected setSearch(value: string): void {
    this.guestsService.setFilters({ search: value });
  }

  protected setRsvpFilter(value: string): void {
    this.guestsService.setFilters({ rsvp: this.isRsvpStatus(value) ? value : 'all' });
  }

  protected setDietFilter(value: string): void {
    this.guestsService.setFilters({ diet: this.isDiet(value) ? value : 'all' });
  }

  protected setRelationFilter(value: string): void {
    this.guestsService.setFilters({ relation: this.isRelation(value) ? value : 'all' });
  }

  protected setSort(value: string): void {
    this.guestsService.setFilters({ sort: value === 'firstName' ? 'firstName' : 'lastName' });
  }

  protected setNewGuestRelation(value: string): void {
    this.updateNewGuest({ relation: this.isRelation(value) ? value : 'wspolni_znajomi' });
  }

  protected setNewGuestDiet(value: string): void {
    this.updateNewGuest({ diet: this.isDiet(value) ? value : 'standard' });
  }

  protected addGuest(): void {
    const weddingId = this.requireWeddingId();
    const form = this.newGuest();
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    if (!weddingId || !firstName || !lastName) return;

    this.guestsService
      .create(weddingId, { ...form, firstName, lastName })
      .subscribe({
        next: () => {
          this.newGuest.set({
            firstName: '',
            lastName: '',
            relation: 'wspolni_znajomi',
            diet: 'standard',
          });
          this.isAddDialogOpen.set(false);
          this.toast.success('Gość został dodany.');
        },
        error: () => this.toast.error('Nie udało się dodać gościa.'),
      });
  }

  protected openEditDialog(guest: Guest): void {
    this.editingGuest.set(guest);
    this.editForm.set({ firstName: guest.firstName, lastName: guest.lastName });
  }

  protected closeEditDialog(): void {
    this.editingGuest.set(null);
  }

  protected updateEditForm(patch: Partial<{ firstName: string; lastName: string }>): void {
    this.editForm.update((current) => ({ ...current, ...patch }));
  }

  protected saveEditGuest(): void {
    const guest = this.editingGuest();
    const weddingId = this.requireWeddingId();
    if (!guest || !weddingId) return;

    const firstName = this.editForm().firstName.trim();
    const lastName = this.editForm().lastName.trim();
    if (!firstName || !lastName) return;

    if (firstName === guest.firstName && lastName === guest.lastName) {
      this.closeEditDialog();
      return;
    }

    this.guestsService.update(weddingId, guest.id, { firstName, lastName }).subscribe({
      next: () => {
        this.closeEditDialog();
        this.toast.success('Dane gościa zostały zapisane.');
      },
      error: () => this.toast.error('Nie udało się zapisać zmian.'),
    });
  }

  protected updateGuest(guest: Guest, patch: UpdateGuestDto): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    this.guestsService.update(weddingId, guest.id, patch).subscribe({
      error: () => this.toast.error('Nie udało się zapisać zmian.'),
    });
  }

  protected removeGuest(guest: Guest): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    if (!window.confirm(`Usunąć gościa "${guest.firstName} ${guest.lastName}"?`)) return;
    this.guestsService.remove(weddingId, guest.id).subscribe({
      next: () => this.toast.success('Gość został usunięty.'),
      error: () => this.toast.error('Nie udało się usunąć gościa.'),
    });
  }

  // Wydruk listy winietek. Druk odpalamy po flushu bindingu (setTimeout 0),
  // żeby window.print() złapał w pełni wyrenderowany blok .winietki-print-root.
  protected printWinietki(): void {
    setTimeout(() => window.print(), 0);
  }

  protected rsvpClass(status: RsvpStatus): string {
    return {
      confirmed: 'badge--success',
      pending: 'badge--warning',
      declined: 'badge--danger',
    }[status];
  }

  protected relationLabel(relation: Relation): string {
    return RELATION_LABELS[relation];
  }

  protected dietLabel(diet: Diet): string {
    return DIET_LABELS[diet];
  }

  protected rsvpLabel(status: RsvpStatus): string {
    return RSVP_LABELS[status];
  }

  protected tableLabel(tableId: string | null): string {
    if (!tableId) return '-';
    return this.tablesService.tables().find((table) => table.id === tableId)?.name ?? '-';
  }

  private requireWeddingId(): string | null {
    const id = this.weddingService.wedding()?.id ?? null;
    if (!id) this.toast.error('Najpierw skonfiguruj wesele.');
    return id;
  }

  private isRelation(value: string): value is Relation {
    return RELATIONS.includes(value as Relation);
  }

  private isRsvpStatus(value: string): value is RsvpStatus {
    return RSVP_STATUSES.includes(value as RsvpStatus);
  }

  private isDiet(value: string): value is Diet {
    return DIETS.includes(value as Diet);
  }
}
