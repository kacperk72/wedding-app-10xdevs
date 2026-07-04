import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Guest } from '../../../core/models/guest.model';
import { Table } from '../../../core/models/table.model';
import { Icon } from '../../../shared/ui/icon/icon';

export interface SeatSlot {
  // 1-based numer krzesła przy stole (zgodny z Guest.seatNumber).
  seatNumber: number;
  // Gość posadzony na tym krześle lub null dla wolnego miejsca.
  guest: Guest | null;
  // Kąt położenia krzesła na okręgu; 0° = góra, rośnie zgodnie z ruchem zegara.
  angleDeg: number;
}

/**
 * Prezentacyjny „plan sali" jednego okrągłego stołu dla widoku szczegółowego.
 * Nazwiska rozmieszczone wokół okręgu — widać kto i gdzie siedzi. Bez drag&drop
 * (to widok do czytania); interakcja przez reużyte modale rodzica: klik w nazwę
 * stołu → editTable, klik w gościa → guestMenu.
 */
@Component({
  selector: 'app-detailed-table',
  imports: [Icon],
  templateUrl: './detailed-table.html',
  styleUrl: './detailed-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailedTable {
  readonly table = input.required<Table>();
  readonly guests = input.required<Guest[]>();

  readonly editTable = output<Table>();
  readonly guestMenu = output<Guest>();

  // Wspólne obliczenie rozsadzenia — jawne numery krzeseł trafiają na swoje
  // pozycje, pozostali goście stołu (drag ustawia tylko tableId, nie seatNumber)
  // wypełniają wolne miejsca po kolei, alfabetycznie. Nadmiar → overflow.
  private readonly layout = computed<{ seats: SeatSlot[]; overflow: Guest[] }>(() => {
    const count = Math.max(0, this.table().seatsCount);
    const slots: (Guest | null)[] = Array.from({ length: count }, () => null);

    const remaining: Guest[] = [];
    for (const guest of this.guests()) {
      const n = guest.seatNumber;
      if (n != null && n >= 1 && n <= count && slots[n - 1] === null) {
        slots[n - 1] = guest;
      } else {
        remaining.push(guest);
      }
    }

    remaining.sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'pl'),
    );

    let ri = 0;
    for (let i = 0; i < count && ri < remaining.length; i++) {
      if (slots[i] === null) slots[i] = remaining[ri++];
    }

    const seats: SeatSlot[] = slots.map((guest, index) => ({
      seatNumber: index + 1,
      guest,
      angleDeg: count > 0 ? (index / count) * 360 : 0,
    }));

    return { seats, overflow: remaining.slice(ri) };
  });

  readonly seats = computed(() => this.layout().seats);
  readonly overflowGuests = computed(() => this.layout().overflow);
  readonly occupiedCount = computed(() => this.guests().length);

  protected guestName(guest: Guest): string {
    return `${guest.firstName} ${guest.lastName}`;
  }
}
