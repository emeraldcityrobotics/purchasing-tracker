import {MiddlewareConsumer, Module, NestModule} from '@nestjs/common';
import {ServeStaticModule} from '@nestjs/serve-static';
import {join} from 'node:path';
import {DatabaseModule} from './database/database.module';
import {AuthModule} from './auth/auth.module';
import {CatalogModule} from './catalog/catalog.module';
import {PurchaseRequestsModule} from './purchase-requests/purchase-requests.module';
import {AdminModule} from './admin/admin.module';
import {IntegrationsModule} from './integrations/integrations.module';
import {LoggingMiddleware} from './common/logging.middleware';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      // Angular's application builder always outputs to a `browser` subfolder.
      rootPath:
        process.env.FRONTEND_DIST_PATH
        || join(__dirname, '..', '..', 'frontend', 'dist', 'frontend', 'browser'),
      exclude: ['/api/{*splat}']
    }),
    DatabaseModule,
    AuthModule,
    CatalogModule,
    PurchaseRequestsModule,
    AdminModule,
    IntegrationsModule
  ],
  controllers: [],
  providers: []
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
