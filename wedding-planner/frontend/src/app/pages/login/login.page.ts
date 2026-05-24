import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../../shared/ui/icon/icon';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [Icon],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);

  protected login(): void {
    this.auth.loginWithSso('/app');
  }
}
