import {Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards} from '@nestjs/common';
import type {Request} from 'express';
import {AuthGuard, RoleGuard, Roles} from '../auth/auth.guards';
import {PurchaseRequestsService} from './purchase-requests.service';
@Controller('api')
@UseGuards(AuthGuard)
export class PurchaseRequestsController {
  constructor(private readonly purchases: PurchaseRequestsService) {}
  @Get('purchase-requests') list(@Req() req: Request) {
    return this.purchases.list(req);
  }

  @Get('purchase-requests/:id') detail(
    @Param('id') id: string,
    @Req() req: Request
  ) {
    return this.purchases.detail(id);
  }

  @Post('purchase-requests') create(@Body() body: any, @Req() req: Request) {
    return this.purchases.create(
      body,
      req.session.userId!,
      req.session.userName || 'Unknown'
    );
  }

  @Put('purchase-requests/:id/status')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles('admin', 'approver')
  status(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
    return this.purchases.updateStatus(
      id,
      body.status,
      body,
      req.session.userId!
    );
  }

  @Put('purchase-requests/:id/admin-override')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles('admin')
  override(@Param('id') id: string, @Req() req: Request) {
    return this.purchases.updateStatus(id, 'approved', {}, req.session.userId!);
  }

  @Put('purchase-requests/:id/tracking') tracking(
    @Param('id') id: string,
    @Body() body: any
  ) {
    return this.purchases.updateTracking(id, body);
  }

  @Put('purchase-requests/:requestId/items/:itemId/receive')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles('admin', 'purchaser')
  receive(
    @Param('requestId') requestId: string,
    @Param('itemId') itemId: string,
    @Body() body: any
  ) {
    return this.purchases.receive(requestId, itemId, body.quantity_received);
  }
}

@Controller('api/public')
export class PublicPurchaseRequestsController {
  constructor(private readonly purchases: PurchaseRequestsService) {}
  @Get('purchase-requests/status') status() {
    return this.purchases.publicStatus();
  }

  @Post('purchase-requests') create(@Body() body: any) {
    const publicUser = this.purchases.ensurePublicUser();
    return this.purchases.create(body, publicUser, body.requester_name);
  }
}
