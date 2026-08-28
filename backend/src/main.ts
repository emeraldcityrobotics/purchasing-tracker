import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import session from 'express-session';
import {ValidationPipe} from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'change-me-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
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
