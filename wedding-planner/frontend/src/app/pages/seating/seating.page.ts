import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  CdkDropListGroup,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Guest, GuestSide, relationToSide } from '../../core/models/guest.model';
import { Table } from '../../core/models/table.model';
import { GuestsService } from '../../core/services/guests.service';
import { SeatingService } from '../../core/services/seating.service';
import { TablesService } from '../../core/services/tables.service';
import { ToastService } from '../../core/services/toast.service';
import { WeddingService } from '../../core/services/wedding.service';
import { Icon } from '../../shared/ui/icon/icon';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import {
  AssignNoSeatRequest,
  DetailedTable,
  ReseatRequest,
} from './detailed-table/detailed-table';
import { RoundTable } from './round-table/round-table';

type SeatingViewMode = 'compact' | 'detailed';

const VIEW_MODE_STORAGE_KEY = 'seating-view-mode';

@Component({
  selector: 'app-seating-page',
  imports: [
    CdkDrag,
    CdkDropList,
    CdkDropListGroup,
    FormsModule,
    Icon,
    PageHeader,
    DetailedTable,
    RoundTable,
  ],
  templateUrl: './seating.page.html',
  styleUrl: './seating.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeatingPage implements OnInit {
  private readonly guestsService = inject(GuestsService);
  protected readonly tablesService = inject(TablesService);
  protected readonly seating = inject(SeatingService);
  private readonly weddingService = inject(WeddingService);
  private readonly toast = inject(ToastService);

  protected readonly guests = this.guestsService.guests;
  protected readonly tables = this.tablesService.tables;
  protected readonly viewMode = signal<SeatingViewMode>(this.readStoredViewMode());
  protected readonly showConfirmedOnly = signal(false);
  protected readonly sideFilter = signal<GuestSide | 'all'>('all');
  protected readonly searchTerm = signal('');
  protected readonly menuGuest = signal<Guest | null>(null);
  protected readonly selectedTableId = signal('');
  protected readonly editingTable = signal<Table | null>(null);
  protected readonly editTableName = signal('');
  protected readonly editTableSeats = signal(8);
  protected readonly showAddTable = signal(false);
  protected readonly newTableName = signal('');
  protected readonly newTableSeats = signal(8);

  private readonly fullTableToastAt = new Map<string, number>();

  // Polite live-region text announced to screen readers on a successful seating
  // action — the accessible equivalent of "the guest visibly moved" (FR-029).
  protected readonly announcement = signal('');

  protected readonly guestsByTable = computed(() => {
    const grouped = new Map<string, Guest[]>();
    for (const guest of this.guests()) {
      if (!guest.tableId) continue;
      const list = grouped.get(guest.tableId) ?? [];
      list.push(guest);
      grouped.set(guest.tableId, list);
    }
    return grouped;
  });

  protected readonly unseatedGuests = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const side = this.sideFilter();
    return this.guests()
      .filter((guest) => guest.tableId === null)
      .filter((guest) => !this.showConfirmedOnly() || guest.rsvpStatus === 'confirmed')
      .filter((guest) => side === 'all' || relationToSide(guest.relation) === side)
      .filter(
        (guest) =>
          !term ||
          `${guest.firstName} ${guest.lastName}`.toLowerCase().includes(term) ||
          `${guest.lastName} ${guest.firstName}`.toLowerCase().includes(term),
      );
  });

  protected readonly localStats = computed(() => {
    const tableCounts = this.guestsByTable();
    return {
      seatedCount: this.guests().filter((guest) => guest.tableId !== null).length,
      unseatedCount: this.guests().filter((guest) => guest.tableId === null).length,
      tablesUsed: tableCounts.size,
      totalSeats: this.tables().reduce((sum, table) => sum + table.seatsCount, 0),
      conflictsCount: this.seating.conflicts().length,
      fullTablesCount: this.tables().filter((table) => this.isTableFull(table)).length,
    };
  });

  protected readonly stats = computed(() => this.seating.stats() ?? this.localStats());

  protected readonly statsLabel = computed(() => {
    const stats = this.stats();
    const totalGuests = stats.seatedCount + stats.unseatedCount;
    return `Rozsadzono ${stats.seatedCount} / ${totalGuests} · stołów ${stats.tablesUsed} używanych · konfliktów ${stats.conflictsCount}`;
  });

  protected readonly availableTables = computed(() => {
    const guest = this.menuGuest();
    return this.tables().filter((table) => table.id === guest?.tableId || !this.isTableFull(table));
  });

  // Predykat wejścia dla obszaru gości przy stole: przyjmuje tylko przeciąganie
  // gościa (nie kartę stołu z reorderu) i tylko gdy stół nie jest pełny.
  protected readonly canEnterTable = (drag: CdkDrag<Guest | Table>, drop: CdkDropList<Table>): boolean => {
    if (this.isTableDrag(drag)) return false;
    const table = drop.data;
    if (!table) return false;
    if (this.isTableFull(table)) {
      this.showFullTableToast(table.id);
      return false;
    }
    return true;
  };

  // Pula nieposadzonych gości nie może przyjąć przeciąganej karty stołu.
  protected readonly canEnterPool = (drag: CdkDrag<Guest | Table>): boolean => !this.isTableDrag(drag);

  // Siatka stołów (reorder) przyjmuje wyłącznie przeciąganie karty stołu — nigdy gościa.
  protected readonly canReorderTable = (drag: CdkDrag<Guest | Table>): boolean => this.isTableDrag(drag);

  // Rozróżnia przeciąganą kartę stołu od karty gościa po kształcie danych drag.
  private isTableDrag(drag: CdkDrag<Guest | Table>): boolean {
    const data = drag.data;
    return !!data && 'seatsCount' in data;
  }

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

  protected guestsForTable(tableId: string): Guest[] {
    return this.guestsByTable().get(tableId) ?? [];
  }

  protected isTableFull(table: Table): boolean {
    return this.guestsForTable(table.id).length >= table.seatsCount;
  }

  protected guestName(guest: Guest): string {
    return `${guest.firstName} ${guest.lastName}`;
  }

  protected guestTags(guest: Guest): string {
    return [
      guest.rsvpStatus === 'confirmed' ? 'potwierdzony' : 'oczekuje',
      guest.diet === 'pending' ? null : guest.diet,
      guest.hasPlusOne ? '+1' : null,
      guest.isChild ? 'dziecko' : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  protected dropGuest(event: CdkDragDrop<Table>): void {
    const guest = event.item.data as Guest | undefined;
    const table = event.container.data as Table | undefined;
    if (!guest || !table || guest.tableId === table.id) return;
    this.assignGuestToTable(guest, table.id);
  }

  // Reorder przez przeciągnięcie karty stołu w siatce.
  protected dropTable(event: CdkDragDrop<Table[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const ordered = [...this.tables()];
    moveItemInArray(ordered, event.previousIndex, event.currentIndex);
    this.persistTableOrder(ordered);
  }

  // Klawiaturowy fallback reorderu: strzałki na uchwycie karty (-1 w lewo, 1 w prawo).
  protected moveTable(table: Table, direction: -1 | 1): void {
    const ordered = [...this.tables()];
    const index = ordered.findIndex((candidate) => candidate.id === table.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    moveItemInArray(ordered, index, target);
    this.persistTableOrder(ordered);
    this.announce(`Przeniesiono stół ${table.name} na pozycję ${target + 1} z ${ordered.length}.`);
  }

  private persistTableOrder(ordered: Table[]): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    this.tablesService.reorder(weddingId, ordered).subscribe({
      error: () => {
        this.toast.error('Nie udało się zapisać kolejności stołów.');
        this.tablesService.list(weddingId).subscribe();
      },
    });
  }

  protected openGuestMenu(guest: Guest): void {
    this.menuGuest.set(guest);
    const firstAvailable = this.tables().find((table) => table.id === guest.tableId || !this.isTableFull(table));
    this.selectedTableId.set(firstAvailable?.id ?? '');
  }

  protected closeGuestMenu(): void {
    this.menuGuest.set(null);
    this.selectedTableId.set('');
  }

  protected assignFromMenu(): void {
    const guest = this.menuGuest();
    const tableId = this.selectedTableId();
    if (!guest || !tableId) return;
    this.assignGuestToTable(guest, tableId);
    this.closeGuestMenu();
  }

  protected printLayout(): void {
    window.print();
  }

  protected setViewMode(mode: SeatingViewMode): void {
    this.viewMode.set(mode);
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      // Brak localStorage (SSR/prywatny tryb/quota) — wybór po prostu nietrwały.
    }
  }

  private readStoredViewMode(): SeatingViewMode {
    try {
      return localStorage.getItem(VIEW_MODE_STORAGE_KEY) === 'detailed' ? 'detailed' : 'compact';
    } catch {
      return 'compact';
    }
  }

  // Kolejność krzesełek przy stole i na wydruku: wg numeru krzesła (puste na końcu),
  // a w obrębie nieprzypisanych — alfabetycznie po nazwisku.
  protected sortedGuestsForTable(tableId: string): Guest[] {
    return this.guestsForTable(tableId).slice().sort((a, b) => {
      if (a.seatNumber != null && b.seatNumber != null) return a.seatNumber - b.seatNumber;
      if (a.seatNumber != null) return -1;
      if (b.seatNumber != null) return 1;
      return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
    });
  }

  protected seatNumbers(table: Table): number[] {
    return Array.from({ length: table.seatsCount }, (_, index) => index + 1);
  }

  protected guestAtSeat(tableId: string, seatNumber: number): Guest | null {
    return this.guestsForTable(tableId).find((guest) => guest.seatNumber === seatNumber) ?? null;
  }

  protected unseatedAtTable(tableId: string): Guest[] {
    return this.guestsForTable(tableId)
      .filter((guest) => guest.seatNumber == null)
      .slice()
      .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
  }

  protected assignSeatById(tableId: string, seatNumber: number, guestId: string): void {
    if (!guestId) return;
    const guest = this.guestsForTable(tableId).find((candidate) => candidate.id === guestId);
    if (guest) this.assignSeat(guest, seatNumber);
  }

  // Przeciągnięcie gościa na krzesło w widoku szczegółowym (puste → przesadzenie,
  // zajęte → zamiana miejscami). Klawiaturowy odpowiednik: edytor stołu (selecty
  // per krzesło) i menu przypisania — patrz openTableEditor / openGuestMenu.
  protected onReseat(request: ReseatRequest): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    this.seating.reseat(weddingId, request.guest.id, request.tableId, request.seatNumber).subscribe({
      next: (response) => {
        const tableName = this.tables().find((table) => table.id === request.tableId)?.name ?? '';
        this.announce(
          `Przeniesiono ${this.guestName(request.guest)} na krzesło ${request.seatNumber} przy stole ${tableName}.`,
        );
        if (response.warnings.length > 0) {
          this.toast.show({
            kind: 'warning',
            message: this.warningMessage(response.warnings),
            durationMs: 7000,
          });
        }
      },
      error: () => this.toast.error('Nie udało się zmienić miejsca.'),
    });
  }

  // Upuszczenie w strefie „bez krzesła" — przypięcie do stołu bez konkretnego
  // miejsca (współdzieli logikę i ostrzeżenia z przypisaniem do stołu).
  protected onAssignNoSeat(request: AssignNoSeatRequest): void {
    if (request.guest.tableId === request.tableId && request.guest.seatNumber == null) return;
    this.assignGuestToTable(request.guest, request.tableId);
  }

  protected assignSeat(guest: Guest, seatNumber: number): void {
    const weddingId = this.weddingService.wedding()?.id;
    if (!weddingId) return;
    this.guestsService.update(weddingId, guest.id, { seatNumber }).subscribe({
      next: () => this.announce(`Posadzono ${this.guestName(guest)} na krześle ${seatNumber}.`),
      error: () => this.toast.error('Nie udało się przypisać krzesła.'),
    });
  }

  protected clearSeat(guest: Guest): void {
    const weddingId = this.weddingService.wedding()?.id;
    if (!weddingId) return;
    this.guestsService.update(weddingId, guest.id, { seatNumber: null }).subscribe({
      next: () => this.announce(`Zwolniono krzesło gościa ${this.guestName(guest)}.`),
      error: () => this.toast.error('Nie udało się zwolnić krzesła.'),
    });
  }

  protected openAddTable(): void {
    this.newTableName.set(`Stół ${this.tables().length + 1}`);
    this.newTableSeats.set(8);
    this.showAddTable.set(true);
  }

  protected closeAddTable(): void {
    this.showAddTable.set(false);
  }

  protected createTable(): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    const name = this.newTableName().trim();
    const seats = Math.max(1, Math.min(24, Math.round(this.newTableSeats() || 0)));
    if (!name) {
      this.toast.error('Nazwa stołu jest wymagana.');
      return;
    }
    this.tablesService.create(weddingId, { name, seatsCount: seats }).subscribe({
      next: () => {
        this.closeAddTable();
        this.toast.success('Stół dodany.');
      },
      error: () => this.toast.error('Nie udało się dodać stołu.'),
    });
  }

  protected openTableEditor(table: Table): void {
    this.editingTable.set(table);
    this.editTableName.set(table.name);
    this.editTableSeats.set(table.seatsCount);
  }

  protected closeTableEditor(): void {
    this.editingTable.set(null);
  }

  protected saveTableEdit(): void {
    const table = this.editingTable();
    const weddingId = this.requireWeddingId();
    if (!table || !weddingId) return;
    const name = this.editTableName().trim();
    const seats = Math.max(1, Math.min(24, Math.round(this.editTableSeats() || 0)));
    if (!name) {
      this.toast.error('Nazwa stołu jest wymagana.');
      return;
    }
    const occupied = this.guestsForTable(table.id).length;
    if (seats < occupied) {
      this.toast.warning(`Stół ma już ${occupied} posadzonych gości — zwolnij miejsca lub wybierz większą liczbę.`);
      return;
    }
    this.tablesService.update(weddingId, table.id, { name, seatsCount: seats }).subscribe({
      next: () => {
        this.closeTableEditor();
        this.toast.success('Stół zaktualizowany.');
      },
      error: () => this.toast.error('Nie udało się zapisać stołu.'),
    });
  }

  protected deleteTable(): void {
    const table = this.editingTable();
    const weddingId = this.requireWeddingId();
    if (!table || !weddingId) return;
    const occupied = this.guestsForTable(table.id).length;
    if (occupied > 0) {
      this.toast.warning('Najpierw zwolnij wszystkie miejsca przy tym stole.');
      return;
    }
    if (!window.confirm(`Usunąć stół "${table.name}"?`)) return;
    this.tablesService.remove(weddingId, table.id).subscribe({
      next: () => {
        this.closeTableEditor();
        this.toast.success('Stół usunięty.');
      },
      error: () => this.toast.error('Nie udało się usunąć stołu.'),
    });
  }

  protected releaseTable(): void {
    const table = this.editingTable();
    const weddingId = this.requireWeddingId();
    if (!table || !weddingId) return;
    const occupied = this.guestsForTable(table.id).length;
    if (occupied === 0) {
      this.toast.warning('Przy tym stole nie ma gości.');
      return;
    }
    if (!window.confirm(`Zwolnić wszystkich gości (${occupied}) przy stole „${table.name}”?`)) return;
    this.seating.releaseTable(weddingId, table.id).subscribe({
      next: () => this.toast.success('Stół zwolniony.'),
      error: () => this.toast.error('Nie udało się zwolnić stołu.'),
    });
  }

  protected unassignFromMenu(): void {
    const guest = this.menuGuest();
    if (!guest) return;
    this.unassignGuest(guest);
    this.closeGuestMenu();
  }

  private loadResources(weddingId: string): void {
    forkJoin([
      this.guestsService.list(weddingId),
      this.tablesService.list(weddingId),
      this.seating.loadStats(weddingId),
    ]).subscribe({
      error: () => this.toast.error('Nie udało się pobrać rozsadzenia.'),
    });
  }

  private assignGuestToTable(guest: Guest, tableId: string): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;

    this.seating.assignTable(weddingId, guest.id, tableId).subscribe({
      next: (response) => {
        const tableName = this.tables().find((table) => table.id === tableId)?.name;
        this.announce(`Przypisano ${this.guestName(guest)} do stołu ${tableName ?? ''}.`);
        if (response.warnings.length > 0) {
          this.toast.show({
            kind: 'warning',
            message: this.warningMessage(response.warnings),
            durationMs: 7000,
          });
        }
      },
      error: () => this.toast.error('Nie udało się przypisać gościa do stołu.'),
    });
  }

  private unassignGuest(guest: Guest): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    this.seating.unassignTable(weddingId, guest.id).subscribe({
      next: () => this.announce(`Usunięto ${this.guestName(guest)} ze stołu.`),
      error: () => this.toast.error('Nie udało się usunąć miejsca.'),
    });
  }

  private announce(message: string): void {
    this.announcement.set(message);
  }

  private warningMessage(warnings: { otherGuestName: string | null; reason: string }[]): string {
    const details = warnings
      .map((warning) => `${warning.otherGuestName ?? 'Inny gość'}: ${warning.reason}`)
      .join('; ');
    return `Uwaga, konflikt przy stole: ${details}`;
  }

  private showFullTableToast(tableId: string): void {
    const now = Date.now();
    const last = this.fullTableToastAt.get(tableId) ?? 0;
    if (now - last < 1400) return;
    this.fullTableToastAt.set(tableId, now);
    this.toast.warning('Stół pełny.');
  }

  private requireWeddingId(): string | null {
    const id = this.weddingService.wedding()?.id ?? null;
    if (!id) this.toast.error('Najpierw skonfiguruj wesele.');
    return id;
  }
}
