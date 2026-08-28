import {Module} from '@nestjs/common';
import {PurchaseRequestsController,
  PublicPurchaseRequestsController} from './purchase-requests.controller';
import {PurchaseRequestsService} from './purchase-requests.service';
@Module({
  controllers: [PurchaseRequestsController, PublicPurchaseRequestsController],
  providers: [PurchaseRequestsService],
  exports: [PurchaseRequestsService]
})
export class PurchaseRequestsModule {}
