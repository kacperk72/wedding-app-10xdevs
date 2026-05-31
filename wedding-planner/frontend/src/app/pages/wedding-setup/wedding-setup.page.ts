import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastService } from '../../core/services/toast.service';
import { WeddingService } from '../../core/services/wedding.service';
import { PageHeader } from '../../shared/ui/page-header/page-header';

interface SetupForm {
  partnerAName: string;
  partnerBName: string;
  weddingDate: string;
  ceremonyLocation: string;
}

@Component({
  selector: 'app-wedding-setup-page',
  imports: [FormsModule, PageHeader],
  templateUrl: './wedding-setup.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeddingSetupPage {
  private readonly wedding = inject(WeddingService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly isSubmitting = signal(false);
  protected readonly form = signal<SetupForm>({
    partnerAName: '',
    partnerBName: '',
    weddingDate: '',
    ceremonyLocation: '',
  });

  protected update(patch: Partial<SetupForm>): void {
    this.form.update((current) => ({ ...current, ...patch }));
  }

  protected submit(): void {
    const form = this.form();
    if (!form.partnerAName.trim() || !form.partnerBName.trim() || !form.weddingDate) return;

    this.isSubmitting.set(true);
    this.wedding
      .create({
        partnerAName: form.partnerAName.trim(),
        partnerBName: form.partnerBName.trim(),
        weddingDate: form.weddingDate,
        ceremonyLocation: form.ceremonyLocation.trim() || null,
      })
      .subscribe({
        next: () => {
          this.toast.show({ kind: 'success', message: 'Profil wesela został utworzony.' });
          this.router.navigateByUrl('/app');
        },
        error: () => {
          this.isSubmitting.set(false);
          this.toast.show({ kind: 'error', message: 'Nie udało się utworzyć wesela.' });
        },
      });
  }
}
