import {Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards} from '@nestjs/common';
import type {Request} from 'express';
import * as bcrypt from 'bcryptjs';
import {AuthGuard, RoleGuard, Roles} from '../auth/auth.guards';
import {DatabaseService} from '../database/database.service';

@Controller('api')
@UseGuards(AuthGuard, RoleGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly database: DatabaseService) {}
  @Get('users') users() {
    return {
      users: this.database.db
        .prepare(
          'SELECT id,username,role,full_name,slack_user_id,created_at FROM users'
        )
        .all()
    };
  }

  @Get('approvers') approvers() {
    return {
      approvers: this.database.db
        .prepare(
          'SELECT id,full_name FROM users WHERE role IN (\'admin\',\'approver\') ORDER BY full_name'
        )
        .all()
    };
  }

  @Post('users') createUser(@Body() body: any) {
    if (!body.username || !body.password || !body.role || !body.full_name)
      return {success: false, error: 'All fields are required'};
    this.database.db
      .prepare(
        'INSERT INTO users(username,password,role,full_name,slack_user_id) VALUES(?,?,?,?,?)'
      )
      .run(
        body.username,
        bcrypt.hashSync(body.password, 10),
        body.role,
        body.full_name,
        body.slack_user_id || null
      );
    return {success: true};
  }

  @Put('users/:id') updateUser(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request
  ) {
    if (Number(id) === req.session.userId && body.role !== req.session.userRole)
      return {success: false, error: 'Cannot change your own role'};
    if (body.password)
      this.database.db
        .prepare(
          'UPDATE users SET password=?,role=?,full_name=?,slack_user_id=? WHERE id=?'
        )
        .run(
          bcrypt.hashSync(body.password, 10),
          body.role,
          body.full_name,
          body.slack_user_id || null,
          id
        );
    else
      this.database.db
        .prepare(
          'UPDATE users SET role=?,full_name=?,slack_user_id=? WHERE id=?'
        )
        .run(body.role, body.full_name, body.slack_user_id || null, id);
    return {success: true};
  }

  @Delete('users/:id') deleteUser(
    @Param('id') id: string,
    @Req() req: Request
  ) {
    if (Number(id) === req.session.userId)
      return {success: false, error: 'Cannot delete your own account'};
    this.database.db.prepare('DELETE FROM users WHERE id=?').run(id);
    return {success: true};
  }

  @Get('settings') settings() {
    const values: any = {};
    for (const row of this.database.db
      .prepare('SELECT key,value FROM settings')
      .all() as any[])
      values[row.key] = row.value;
    return {
      ...values,
      multi_approval_threshold: Number(values.multi_approval_threshold),
      required_approvals: Number(values.required_approvals),
      google_sheets_enabled: values.google_sheets_enabled === 'true',
      google_sheets_auto_export: values.google_sheets_auto_export === 'true',
      slack_webhook_url: values.slack_webhook_url || ''
    };
  }

  @Put('settings') updateSettings(@Body() body: any) {
    for (const [key, value] of Object.entries(body)) {
      if (key !== 'success')
        this.database.setSetting(
          key,
          typeof value === 'boolean' ? String(value) : String(value)
        );
    }
    return {success: true, ...body};
  }
}
