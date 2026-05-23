import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../shared/ui/page-header/page-header';

interface Payment {
  vendor: string;
  type: string;
  due: string;
  amount: string;
  urgency: 'danger' | 'warning' | 'info';
}

interface Contract {
  vendor: string;
  category: string;
  amount: string;
  schedule: string;
  signed: string;
  status: string;
  statusClass: string;
}

@Component({
  selector: 'app-contracts-page',
  imports: [PageHeader],
  templateUrl: './contracts.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractsPage {
  protected readonly payments: Payment[] = [
    {
      vendor: 'Sound Garden',
      type: 'zaliczka',
      due: '28.05.2026',
      amount: '1 500 zł',
      urgency: 'danger',
    },
    {
      vendor: 'Pałac Polanka',
      type: 'rata',
      due: '10.06.2026',
      amount: '9 700 zł',
      urgency: 'warning',
    },
    {
      vendor: 'Kadr i Światło',
      type: 'final',
      due: '22.06.2026',
      amount: '4 000 zł',
      urgency: 'info',
    },
  ];

  protected readonly contracts: Contract[] = [
    {
      vendor: 'Pałac Polanka',
      category: 'Sala',
      amount: '39 100 zł',
      schedule: '1/4 opłacone',
      signed: '12.02.2026',
      status: 'zaliczka opłacona',
      statusClass: 'badge--success',
    },
    {
      vendor: 'Kadr i Światło',
      category: 'Fotograf',
      amount: '8 500 zł',
      schedule: '1/2 opłacone',
      signed: '25.01.2026',
      status: 'w trakcie',
      statusClass: 'badge--warning',
    },
    {
      vendor: 'Sound Garden',
      category: 'DJ',
      amount: '5 800 zł',
      schedule: '0/2 opłacone',
      signed: 'brak',
      status: 'do podpisu',
      statusClass: 'badge--neutral',
    },
  ];

  protected urgencyClass(urgency: Payment['urgency']): string {
    return {
      danger: 'badge--danger',
      warning: 'badge--warning',
      info: 'badge--info',
    }[urgency];
  }
}
