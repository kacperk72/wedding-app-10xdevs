import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../shared/ui/page-header/page-header';

interface Guest {
  name: string;
  tags: string;
}

interface Table {
  name: string;
  seats: string;
}

@Component({
  selector: 'app-seating-page',
  imports: [PageHeader],
  templateUrl: './seating.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeatingPage {
  protected readonly guests: Guest[] = [
    { name: 'Anna Kowalska', tags: 'wege · +1' },
    { name: 'Piotr Malinowski', tags: 'standard' },
    { name: 'Maja Zielińska', tags: 'dziecko' },
    { name: 'Julia Wójcik', tags: 'bez glutenu' },
  ];

  protected readonly tables: Table[] = [
    { name: 'Stół 1', seats: '8 / 10 miejsc' },
    { name: 'Stół 2', seats: '6 / 10 miejsc' },
    { name: 'Stół 3', seats: '9 / 10 miejsc' },
    { name: 'Stół 4', seats: '0 / 10 miejsc' },
  ];

  protected readonly conflicts = [
    'Anna Kowalska i Marek Kowalski · konflikt rodzinny',
    'Julia Wójcik i DJ Sound Garden · alergia na dym sceniczny',
  ];
}
