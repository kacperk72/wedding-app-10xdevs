import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { PartnerInvitation } from '../../core/models/wedding.model';
import { AuthService } from '../../core/services/auth.service';
import { MealOptionsService } from '../../core/services/meal-options.service';
import { TablesService } from '../../core/services/tables.service';
import { ToastService } from '../../core/services/toast.service';
import { WeddingService } from '../../core/services/wedding.service';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { PageHeader } from '../../shared/ui/page-header/page-header';

@Component({
  selector: 'app-settings-page',
  imports: [EmptyState, FormsModule, PageHeader],
  templateUrl: './settings.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements OnInit {
  protected readonly wedding = inject(WeddingService);
  protected readonly auth = inject(AuthService);
  protected readonly mealOptions = inject(MealOptionsService);
  protected readonly tables = inject(TablesService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly weddingDateDraft = signal('');
  protected readonly partnerEmail = signal('');
  protected readonly pendingInvitation = signal<PartnerInvitation | null>(null);

  protected readonly newMealLabel = signal('');
  protected readonly editingMealId = signal<string | null>(null);
  protected readonly editingMealLabel = signal('');

  protected readonly newTableName = signal('');
  protected readonly newTableSeats = signal(8);
  protected readonly editingTableId = signal<string | null>(null);
  protected readonly editingTableName = signal('');
  protected readonly editingTableSeats = signal(8);

  protected readonly partnerMember = computed(() =>
    this.wedding.wedding()?.members?.find((member) => member.role === 'partner_b') ?? null,
  );

  protected readonly isFounder = computed(() => {
    const current = this.auth.user();
    const wedding = this.wedding.wedding();
    return Boolean(current && wedding && current.id === wedding.createdByUserId);
  });

  ngOnInit(): void {
    this.auth.ensureUser().subscribe();
    const currentWedding = this.wedding.wedding();
    if (currentWedding) {
      this.weddingDateDraft.set(currentWedding.weddingDate);
      this.loadResources(currentWedding.id);
      return;
    }

    this.wedding.loadCurrent().subscribe({
      next: (wedding) => {
        if (wedding) {
          this.weddingDateDraft.set(wedding.weddingDate);
          this.loadResources(wedding.id);
          return;
        }
        this.toast.error('Najpierw skonfiguruj wesele.');
      },
      error: () => this.toast.error('Nie udalo sie pobrac wesela.'),
    });
  }

  private loadResources(weddingId: string): void {
    forkJoin([
      this.mealOptions.list(weddingId),
      this.tables.list(weddingId),
      this.wedding.exportJson(weddingId),
    ]).subscribe({
      next: ([, , exported]) => {
        this.pendingInvitation.set(
          exported.partnerInvitations.find((invitation) => invitation.status === 'pending') ?? null,
        );
      },
      error: () => this.toast.error('Nie udalo sie pobrac ustawien.'),
    });
  }

  protected saveWeddingDate(): void {
    const currentWedding = this.wedding.wedding();
    const weddingId = currentWedding?.id ?? null;
    const nextDate = this.weddingDateDraft();
    if (!weddingId || !currentWedding || !nextDate || nextDate === currentWedding.weddingDate) return;

    this.wedding.update(weddingId, { weddingDate: nextDate }).subscribe({
      next: () => this.toast.success('Data slubu zostala zapisana.'),
      error: () => this.toast.error('Nie udalo sie zapisac daty slubu.'),
    });
  }

  protected invitePartner(): void {
    const weddingId = this.requireWeddingId();
    const email = this.partnerEmail().trim().toLowerCase();
    if (!weddingId || !email) return;

    this.wedding.invitePartner(weddingId, email).subscribe({
      next: (invitation) => {
        this.pendingInvitation.set(invitation);
        this.partnerEmail.set('');
        this.toast.success('Zaproszenie zostalo wyslane.');
      },
      error: () => this.toast.error('Nie udalo sie wyslac zaproszenia.'),
    });
  }

  protected resendInvitation(): void {
    const invitation = this.pendingInvitation();
    if (!invitation) return;
    this.partnerEmail.set(invitation.email);
    this.invitePartner();
  }

  protected downloadJson(): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    this.wedding.exportBlob(weddingId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `wedding-${weddingId}-export.json`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.toast.error('Nie udalo sie pobrac eksportu.'),
    });
  }

  protected logout(): void {
    this.auth.logout();
  }

  protected deleteWedding(): void {
    const wedding = this.wedding.wedding();
    if (!wedding || !this.isFounder()) return;

    const expected = `${wedding.partnerAName} ${wedding.partnerBName}`;
    const typed = window.prompt(`Aby usunac wesele, wpisz: ${expected}`);
    if (typed !== expected) {
      this.toast.error('Potwierdzenie nie pasuje.');
      return;
    }

    this.wedding.deleteWedding(wedding.id).subscribe({
      next: () => {
        this.toast.success('Wesele zostalo usuniete.');
        this.router.navigateByUrl('/app/setup');
      },
      error: () => this.toast.error('Nie udalo sie usunac wesela.'),
    });
  }

  protected addMealOption(): void {
    const weddingId = this.requireWeddingId();
    const label = this.newMealLabel().trim();
    if (!weddingId || !label) return;

    this.mealOptions.create(weddingId, { label }).subscribe({
      next: () => {
        this.newMealLabel.set('');
        this.toast.success('Opcja menu zostala dodana.');
      },
      error: () => this.toast.error('Nie udalo sie dodac opcji menu.'),
    });
  }

  protected startMealEdit(id: string, label: string): void {
    this.editingMealId.set(id);
    this.editingMealLabel.set(label);
  }

  protected saveMealOption(id: string): void {
    const weddingId = this.requireWeddingId();
    const label = this.editingMealLabel().trim();
    if (!weddingId || !label) return;

    this.mealOptions.update(weddingId, id, { label }).subscribe({
      next: () => {
        this.editingMealId.set(null);
        this.toast.success('Opcja menu zostala zapisana.');
      },
      error: () => this.toast.error('Nie udalo sie zapisac opcji menu.'),
    });
  }

  protected removeMealOption(id: string): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    this.mealOptions.remove(weddingId, id).subscribe({
      next: () => this.toast.success('Opcja menu zostala usunieta.'),
      error: () => this.toast.error('Nie udalo sie usunac opcji menu.'),
    });
  }

  protected addTable(): void {
    const weddingId = this.requireWeddingId();
    const name = this.newTableName().trim();
    const seatsCount = this.newTableSeats();
    if (!weddingId || !name || !this.validSeats(seatsCount)) return;

    this.tables.create(weddingId, { name, seatsCount }).subscribe({
      next: () => {
        this.newTableName.set('');
        this.newTableSeats.set(8);
        this.toast.success('Stol zostal dodany.');
      },
      error: () => this.toast.error('Nie udalo sie dodac stolu.'),
    });
  }

  protected startTableEdit(id: string, name: string, seatsCount: number): void {
    this.editingTableId.set(id);
    this.editingTableName.set(name);
    this.editingTableSeats.set(seatsCount);
  }

  protected saveTable(id: string): void {
    const weddingId = this.requireWeddingId();
    const name = this.editingTableName().trim();
    const seatsCount = this.editingTableSeats();
    if (!weddingId || !name || !this.validSeats(seatsCount)) return;

    this.tables.update(weddingId, id, { name, seatsCount }).subscribe({
      next: () => {
        this.editingTableId.set(null);
        this.toast.success('Stol zostal zapisany.');
      },
      error: () => this.toast.error('Nie udalo sie zapisac stolu.'),
    });
  }

  protected removeTable(id: string): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    this.tables.remove(weddingId, id).subscribe({
      next: () => this.toast.success('Stol zostal usuniety.'),
      error: () => this.toast.error('Nie udalo sie usunac stolu.'),
    });
  }

  private validSeats(value: number): boolean {
    const ok = Number.isInteger(value) && value >= 1 && value <= 24;
    if (!ok) this.toast.error('Liczba miejsc musi byc w zakresie 1-24.');
    return ok;
  }

  private requireWeddingId(): string | null {
    const id = this.wedding.wedding()?.id ?? null;
    if (!id) this.toast.error('Najpierw skonfiguruj wesele.');
    return id;
  }

}
