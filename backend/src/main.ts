import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import session from 'express-session';
import {ValidationPipe} from '@nestjs/common';

/** Parses TRUST_PROXY as a boolean or hop count; defaults to trusting one hop. */
function trustProxySetting(): boolean | number {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined) return 1;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const hops = Number(raw);
  return Number.isFinite(hops) ? hops : 1;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Required for secure cookies to work behind a TLS-terminating reverse proxy/load
  // balancer; without it Express sees the connection as plain HTTP and the session
  // cookie set during /oidc/login never reaches the browser, so the callback runs
  // with a brand-new empty session (the "Callback session state incomplete" error).
  app.getHttpAdapter().getInstance().set('trust proxy', trustProxySetting());
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'change-me-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      }
    })
  );
  app.useGlobalPipes(new ValidationPipe({transform: true, whitelist: true}));
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:4200',
    credentials: true
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
