import {ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection} from '@angular/core';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {provideRouter} from '@angular/router';

import {routes} from './app.routes';
import {authInterceptor} from './core/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideAnimationsAsync(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};
