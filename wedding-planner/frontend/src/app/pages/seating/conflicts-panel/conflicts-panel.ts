import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Guest } from '../../../core/models/guest.model';
import { CreateConflictDto, SeatingConflict } from '../../../core/models/seating.model';
import { Icon } from '../../../shared/ui/icon/icon';

@Component({
  selector: 'app-conflicts-panel',
  imports: [FormsModule, Icon],
  templateUrl: './conflicts-panel.html',
  styleUrl: './conflicts-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConflictsPanel {
  readonly conflicts = input.required<SeatingConflict[]>();
  readonly guests = input.required<Guest[]>();

  readonly createConflict = output<CreateConflictDto>();
  readonly removeConflict = output<string>();

  protected readonly isDialogOpen = signal(false);
  protected readonly form = signal<CreateConflictDto>({
    guestAId: '',
    guestBId: '',
    reason: '',
  });

  protected readonly secondGuestOptions = computed(() =>
    this.guests().filter((guest) => guest.id !== this.form().guestAId),
  );

  protected guestName(guest: Guest): string {
    return `${guest.firstName} ${guest.lastName}`;
  }

  protected updateForm(patch: Partial<CreateConflictDto>): void {
    this.form.update((current) => ({ ...current, ...patch }));
  }

  protected openDialog(): void {
    const firstGuest = this.guests()[0];
    const secondGuest = this.guests().find((guest) => guest.id !== firstGuest?.id);
    this.form.set({
      guestAId: firstGuest?.id ?? '',
      guestBId: secondGuest?.id ?? '',
      reason: '',
    });
    this.isDialogOpen.set(true);
  }

  protected closeDialog(): void {
    this.isDialogOpen.set(false);
  }

  protected submit(): void {
    const form = this.form();
    const reason = form.reason.trim();
    if (!form.guestAId || !form.guestBId || !reason || form.guestAId === form.guestBId) return;

    this.createConflict.emit({ ...form, reason });
    this.closeDialog();
  }
}
