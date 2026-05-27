import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Guest } from '../../core/models/guest.model';
import { CreateConflictDto } from '../../core/models/seating.model';
import { Table } from '../../core/models/table.model';
import { GuestsService } from '../../core/services/guests.service';
import { SeatingService } from '../../core/services/seating.service';
import { TablesService } from '../../core/services/tables.service';
import { ToastService } from '../../core/services/toast.service';
import { WeddingService } from '../../core/services/wedding.service';
import { Icon } from '../../shared/ui/icon/icon';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { ConflictsPanel } from './conflicts-panel/conflicts-panel';
import { RoundTable } from './round-table/round-table';

@Component({
  selector: 'app-seating-page',
  imports: [
    CdkDrag,
    CdkDropList,
    CdkDropListGroup,
    ConflictsPanel,
    FormsModule,
    Icon,
    PageHeader,
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
  protected readonly showConfirmedOnly = signal(false);
  protected readonly menuGuest = signal<Guest | null>(null);
  protected readonly selectedTableId = signal('');

  private readonly fullTableToastAt = new Map<string, number>();

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

  protected readonly unseatedGuests = computed(() =>
    this.guests()
      .filter((guest) => guest.tableId === null)
      .filter((guest) => !this.showConfirmedOnly() || guest.rsvpStatus === 'confirmed'),
  );

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

  protected readonly canEnterTable = (_drag: CdkDrag<Guest>, drop: CdkDropList<Table>): boolean => {
    const table = drop.data;
    if (!table) return false;
    if (this.isTableFull(table)) {
      this.showFullTableToast(table.id);
      return false;
    }
    return true;
  };

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

  protected unassignFromMenu(): void {
    const guest = this.menuGuest();
    if (!guest) return;
    this.unassignGuest(guest);
    this.closeGuestMenu();
  }

  protected createConflict(dto: CreateConflictDto): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    this.seating.createConflict(weddingId, dto).subscribe({
      next: () => this.toast.success('Konflikt został dodany.'),
      error: () => this.toast.error('Nie udało się dodać konfliktu.'),
    });
  }

  protected removeConflict(id: string): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    this.seating.removeConflict(weddingId, id).subscribe({
      next: () => this.toast.success('Konflikt został usunięty.'),
      error: () => this.toast.error('Nie udało się usunąć konfliktu.'),
    });
  }

  private loadResources(weddingId: string): void {
    forkJoin([
      this.guestsService.list(weddingId),
      this.tablesService.list(weddingId),
      this.seating.loadConflicts(weddingId),
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
      error: () => this.toast.error('Nie udało się usunąć miejsca.'),
    });
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
