import {Body, Controller, Param, Post, UseGuards} from '@nestjs/common';
import {AuthGuard, RoleGuard, Roles} from '../auth/auth.guards';
import {DatabaseService} from '../database/database.service';
import {PurchaseRequestsService} from '../purchase-requests/purchase-requests.service';
import {IntegrationsService} from './integrations.service';

@Controller('api')
@UseGuards(AuthGuard, RoleGuard)
export class IntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly database: DatabaseService,
    private readonly purchases: PurchaseRequestsService
  ) {}

  @Post('google-sheets/export/:id')
  @Roles('admin', 'approver', 'purchaser')
  async export(@Param('id') id: string) {
    const request = this.purchases.detail(id);
    return this.integrations.exportToSheets({
      orderId: request.id,
      exportDate: new Date().toISOString().slice(0, 10),
      orderName: request.order_name || 'Unnamed Order',
      requester: request.requester_name,
      vendor: request.vendor_name,
      estimatedCost: Number(request.total).toFixed(2),
      actualCost: request.actual_amount_spent
        ? Number(request.actual_amount_spent).toFixed(2)
        : 'N/A',
      trackingNumber: request.tracking_number || 'N/A',
      estimatedDelivery: request.estimated_delivery_date || 'N/A',
      requestedArrival: request.requested_arrival_date || 'N/A',
      status: request.status,
      timestamp: new Date().toISOString()
    });
  }

  @Post('google-sheets/test') @Roles('admin') async testSheets() {
    return this.integrations.exportToSheets({
      orderId: `TEST-${Date.now()}`,
      orderName: 'Test Export from Purchasing Tracker',
      status: 'ordered',
      timestamp: new Date().toISOString()
    });
  }

  @Post('settings/test-slack') @Roles('admin') async testSlack(
    @Body() body: {webhook_url: string}
  ) {
    return this.integrations.sendSlack(
      'Test notification from Purchasing Tracker',
      body.webhook_url
    );
  }

  @Post('integrations/inventree/test') @Roles('admin') async testInvenTree(
    @Body() body: {url?: string; api_key?: string}
  ) {
    return this.integrations.testInvenTreeConnection(body.url, body.api_key);
  }
}
