import {Module} from '@nestjs/common';
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {DatabaseModule} from './database/database.module';
import {AuthModule} from './auth/auth.module';
import {CatalogModule} from './catalog/catalog.module';
import {PurchaseRequestsModule} from './purchase-requests/purchase-requests.module';
import {AdminModule} from './admin/admin.module';
import {IntegrationsModule} from './integrations/integrations.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    CatalogModule,
    PurchaseRequestsModule,
    AdminModule,
    IntegrationsModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
