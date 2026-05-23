import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../shared/ui/page-header/page-header';

@Component({
  selector: 'app-settings-page',
  imports: [PageHeader],
  templateUrl: './settings.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  protected readonly mealOptions = [
    'Schab tradycyjny',
    'Łosoś z koprem',
    'Wegańskie curry',
    'Bezglutenowe risotto',
    'Menu dziecięce',
  ];
}
