import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CateringPackage } from '../../../../core/models/catering.model';
import { formatPLN } from '../../../../core/format/currency.format';

@Component({
  selector: 'app-package-tabs',
  templateUrl: './package-tabs.html',
  styleUrl: './package-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PackageTabs {
  readonly packages = input.required<CateringPackage[]>();
  readonly activePackageId = input<string | null>(null);
  readonly packageSelected = output<CateringPackage>();

  protected money(value: number): string {
    return formatPLN(value);
  }
}
