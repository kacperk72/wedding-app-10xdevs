import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PageHeader } from '../../shared/ui/page-header/page-header';

interface Course {
  title: string;
  hint: string;
  dishes: string[];
}

interface Addon {
  name: string;
  price: number;
  unit: string;
  selected: boolean;
}

@Component({
  selector: 'app-catering-page',
  imports: [FormsModule, PageHeader],
  templateUrl: './catering.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CateringPage {
  protected readonly guestCount = signal(100);
  protected readonly packages = ['Szefa Kuchni', 'Srebrny', 'Złoty', 'Diamentowy'];

  protected readonly courses: Course[] = [
    {
      title: 'Obiad · danie główne',
      hint: 'Każdy gość wybiera 1 z 3',
      dishes: ['Polędwiczka w sosie borowikowym', 'Łosoś z koprem', 'Risotto z warzywami'],
    },
    {
      title: 'Bufet zimny',
      hint: 'Wybrano 8 z 20',
      dishes: ['Mini burrata', 'Tatar z łososia', 'Deska serów', 'Sałatka z gruszką'],
    },
    {
      title: 'Sałatki',
      hint: 'Wybrano 3 z 8',
      dishes: ['Cezar z kurczakiem', 'Grecka', 'Kasza bulgur z warzywami'],
    },
  ];

  protected readonly addons = signal<Addon[]>([
    { name: 'Pokrowce na krzesła', price: 8, unit: 'os.', selected: true },
    { name: 'Wiejski stół', price: 1_500, unit: 'impreza', selected: true },
    { name: 'Korkowe', price: 25, unit: 'butelka', selected: false },
  ]);

  protected readonly packagePrice = 374;

  protected readonly totalPrice = computed(() => {
    const guestCount = this.guestCount();
    const addonsTotal = this.addons()
      .filter((addon) => addon.selected)
      .reduce((sum, addon) => sum + (addon.unit === 'os.' ? addon.price * guestCount : addon.price), 0);
    return this.packagePrice * guestCount + addonsTotal;
  });

  protected toggleAddon(name: string): void {
    this.addons.update((addons) =>
      addons.map((addon) =>
        addon.name === name ? { ...addon, selected: !addon.selected } : addon,
      ),
    );
  }

  protected setGuestCount(value: string | number): void {
    const count = Math.max(1, Math.round(Number(value)));
    this.guestCount.set(Number.isFinite(count) ? count : 1);
  }

  protected money(value: number): string {
    return `${Math.round(value).toLocaleString('pl-PL')} zł`;
  }
}
