import { createHmac } from 'node:crypto';
import type { BrowserContext } from '@playwright/test';

// Shared secret between the hermetic backend (AUTH_TEST_MODE → verifyTestToken)
// and these e2e tokens. Must match the AUTH_TEST_SECRET passed to the backend
// webServer in playwright.config.ts. Test-only — never a real credential.
export const AUTH_TEST_SECRET = 'wedding-planner-e2e-secret';

// SSO payloads whose userId maps (via the mock-supabase USER_IDS table) to the
// seeded members of wedding-1: sso-a → user-a (partner_a), sso-b → user-b.
export const MEMBERS = {
  a: { userId: 'sso-a', email: 'ania@example.com', firstName: 'Ania', lastName: 'Nowak' },
  b: { userId: 'sso-b', email: 'bartek@example.com', firstName: 'Bartek', lastName: 'Kowalski' },
} as const;

export type MemberKey = keyof typeof MEMBERS;

function b64url(input: string): string {
  return Buffer.from(input).toString('base64url');
}

// Minimal HS256 JWT signer (no jsonwebtoken dependency in the frontend).
// Produces a token the backend's jwt.verify(..., { algorithms: ['HS256'] })
// accepts.
function signTestToken(payload: Record<string, unknown>, secret: string): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

// Inject a fake window.SSOAuth for the given member into a browser context, so
// AuthService reads a known token without contacting kubitksso.pl. Also blocks
// the real SDK <script> so it cannot overwrite the stub once the page loads.
export async function authenticateAs(context: BrowserContext, who: MemberKey): Promise<void> {
  const token = signTestToken({ ...MEMBERS[who] }, AUTH_TEST_SECRET);

  await context.route('**/sso-sdk.js', (route) => route.abort());

  await context.addInitScript((tok: string) => {
    (window as unknown as { SSOAuth: unknown }).SSOAuth = {
      login: () => {},
      logout: async () => {},
      refresh: async () => {},
      getToken: () => tok,
      getSubscription: () => ({ app: 'wedding-planner' }),
      isAuthenticated: () => true,
      hasAppAccess: () => true,
      onAuthChange: () => () => {},
    };
  }, token);
}
