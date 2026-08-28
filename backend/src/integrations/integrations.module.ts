import {Module} from '@nestjs/common';
import {IntegrationsService} from './integrations.service';
import {IntegrationsController} from './integrations.controller';
import {PurchaseRequestsModule} from '../purchase-requests/purchase-requests.module';
@Module({
  imports: [PurchaseRequestsModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  exports: [IntegrationsService]
})
export class IntegrationsModule {}
