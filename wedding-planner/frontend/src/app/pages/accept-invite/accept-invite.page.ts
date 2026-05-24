import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { apiUrl } from '../../core/http/api-url';

@Component({
  selector: 'app-accept-invite-page',
  templateUrl: './accept-invite.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcceptInvitePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  protected readonly status = signal<'loading' | 'success' | 'error'>('loading');
  protected readonly message = signal('Akceptujemy zaproszenie...');

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.status.set('error');
      this.message.set('Brakuje tokenu zaproszenia.');
      return;
    }

    if (!this.auth.token()) {
      this.auth.loginWithSso(`/accept-invite?token=${encodeURIComponent(token)}`);
      return;
    }

    this.http.post(apiUrl('/weddings/accept-invite'), { token }).subscribe({
      next: () => {
        this.status.set('success');
        this.message.set('Zaproszenie zaakceptowane.');
        this.router.navigateByUrl('/app');
      },
      error: (err) => {
        this.status.set('error');
        this.message.set(
          err.status === 409
            ? 'To konto jest juz przypisane do wesela.'
            : 'Zaproszenie jest nieprawidlowe albo wygaslo.',
        );
      },
    });
  }
}
