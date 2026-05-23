import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../shared/ui/page-header/page-header';

interface VendorCard {
  category: string;
  company: string;
  contact: string;
  phone: string;
  email: string;
  amount: string;
  status: 'meeting' | 'reserved' | 'paid' | 'considering';
}

@Component({
  selector: 'app-vendors-page',
  imports: [PageHeader],
  templateUrl: './vendors.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorsPage {
  protected readonly statuses = [
    'Wszystkie statusy',
    'rozważany',
    'spotkanie',
    'zarezerwowany',
    'zapłacony',
  ];

  protected readonly categories = ['DJ', 'Fotograf', 'Sala', 'Kwiaciarz', 'Dekoracje', 'Tort'];

  protected readonly vendors: VendorCard[] = [
    {
      category: 'Sala',
      company: 'Pałac Polanka',
      contact: 'Monika Wrona',
      phone: '+48 601 222 501',
      email: 'kontakt@palac-polanka.pl',
      amount: '39 100 zł',
      status: 'reserved',
    },
    {
      category: 'Fotograf',
      company: 'Kadr i Światło',
      contact: 'Tomasz Bielecki',
      phone: '+48 502 114 930',
      email: 'studio@kadrswiatlo.pl',
      amount: '8 500 zł',
      status: 'paid',
    },
    {
      category: 'DJ',
      company: 'Sound Garden',
      contact: 'Michał Borkowski',
      phone: '+48 533 889 210',
      email: 'dj@soundgarden.pl',
      amount: '5 800 zł',
      status: 'meeting',
    },
    {
      category: 'Tort',
      company: 'Słodka Pracownia',
      contact: 'Alicja Nowak',
      phone: '+48 720 331 004',
      email: 'torty@pracownia.pl',
      amount: '1 900 zł',
      status: 'considering',
    },
  ];

  protected statusLabel(status: VendorCard['status']): string {
    return {
      meeting: 'spotkanie',
      reserved: 'zarezerwowany',
      paid: 'zapłacony',
      considering: 'rozważany',
    }[status];
  }

  protected statusClass(status: VendorCard['status']): string {
    return {
      meeting: 'badge--warning',
      reserved: 'badge--success',
      paid: 'badge--info',
      considering: 'badge--neutral',
    }[status];
  }
}
