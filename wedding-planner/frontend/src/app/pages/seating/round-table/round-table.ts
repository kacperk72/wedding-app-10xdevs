import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Guest } from '../../../core/models/guest.model';
import { Table } from '../../../core/models/table.model';
import { Icon } from '../../../shared/ui/icon/icon';

@Component({
  selector: 'app-round-table',
  imports: [CdkDrag, CdkDropList, Icon],
  templateUrl: './round-table.html',
  styleUrl: './round-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoundTable {
  readonly table = input.required<Table>();
  readonly guests = input.required<Guest[]>();
  readonly isFull = input.required<boolean>();
  readonly enterPredicate = input.required<(drag: CdkDrag<Guest>, drop: CdkDropList<Table>) => boolean>();

  readonly dropped = output<CdkDragDrop<Table>>();
  readonly guestMenu = output<Guest>();
  readonly editTable = output<Table>();

  protected initials(guest: Guest): string {
    return `${guest.firstName.charAt(0)}${guest.lastName.charAt(0)}`.toUpperCase();
  }

  protected guestName(guest: Guest): string {
    return `${guest.firstName} ${guest.lastName}`;
  }
}
