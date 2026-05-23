import { appEnv } from '../env/app-env';

export const apiUrl = (path: string): string =>
  `${appEnv.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
