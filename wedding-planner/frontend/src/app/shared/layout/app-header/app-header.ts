import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { WeddingService } from '../../../core/services/wedding.service';
import { formatDDMMYYYY } from '../../../core/format/date.format';
import { CoupleAvatarPair } from '../couple-avatar-pair/couple-avatar-pair';
import { Icon } from '../../ui/icon/icon';

@Component({
  selector: 'app-header',
  imports: [CoupleAvatarPair, Icon],
  templateUrl: './app-header.html',
  styleUrl: './app-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeader {
  protected readonly wedding = inject(WeddingService);
  protected readonly fmtDate = formatDDMMYYYY;

  protected readonly linkedPartner = computed(() =>
    this.wedding.wedding()?.members?.find((member) => member.role === 'partner_b') ?? null,
  );

  protected readonly accountLabel = computed(() =>
    this.linkedPartner() ? 'Konto połączone' : 'Zaproś partnera',
  );

  protected readonly accountInitials = computed(() => {
    const initials = this.wedding.coupleInitials();
    return {
      a: initials.a || 'W',
      b: this.linkedPartner() ? initials.b : '',
    };
  });
}
