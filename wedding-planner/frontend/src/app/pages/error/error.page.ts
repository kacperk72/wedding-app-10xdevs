import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-error-page',
  imports: [RouterLink],
  templateUrl: './error.page.html',
  styleUrl: './error.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorPage {
  private readonly route = inject(ActivatedRoute);

  protected readonly code = computed(() => (this.route.snapshot.queryParamMap.get('error') === '500' ? '500' : '404'));
  protected readonly title = computed(() =>
    this.code() === '500' ? 'Wystapil blad' : 'Nie znaleziono strony',
  );
}
