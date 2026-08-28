import {Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards} from '@nestjs/common';
import {DatabaseService} from '../database/database.service';
import {AuthGuard, RoleGuard, Roles} from '../auth/auth.guards';

@Controller('api')
@UseGuards(AuthGuard)
export class CatalogController {
  constructor(private readonly database: DatabaseService) {}
  @Get('vendors')
  vendors() {
    return {
      vendors: this.database.db
        .prepare('SELECT * FROM vendors ORDER BY name')
        .all()
    };
  }

  @UseGuards(RoleGuard) @Roles('admin') @Post('vendors') vendor(
    @Body() body: any
  ) {
    return this.insert('vendors', body);
  }

  @UseGuards(RoleGuard)
  @Roles('admin')
  @Delete('vendors/:id')
  deleteVendor(@Param('id') id: string) {
    this.database.db.prepare('DELETE FROM vendors WHERE id=?').run(id);
    return {success: true};
  }

  @Get('departments')
  departments() {
    return {
      departments: this.database.db
        .prepare(
          'SELECT d.*,u.full_name approver_name FROM departments d LEFT JOIN users u ON d.approver_id=u.id ORDER BY d.name'
        )
        .all()
    };
  }

  @UseGuards(RoleGuard)
  @Roles('admin')
  @Post('departments')
  department(@Body() body: any) {
    return this.insert('departments', body);
  }

  @UseGuards(RoleGuard)
  @Roles('admin')
  @Put('departments/:id')
  updateDepartment(@Param('id') id: string, @Body() body: any) {
    this.database.db
      .prepare(
        'UPDATE departments SET name=?,approver_id=?,slack_approval_message=? WHERE id=?'
      )
      .run(
        body.name,
        body.approver_id || null,
        body.slack_approval_message || null,
        id
      );
    return {success: true};
  }

  @UseGuards(RoleGuard)
  @Roles('admin')
  @Delete('departments/:id')
  deleteDepartment(@Param('id') id: string) {
    this.database.db.prepare('DELETE FROM departments WHERE id=?').run(id);
    return {success: true};
  }

  @Get('funding-sources') funding() {
    return {
      fundingSources: this.database.db
        .prepare('SELECT * FROM funding_sources ORDER BY name')
        .all()
    };
  }

  @UseGuards(RoleGuard)
  @Roles('admin')
  @Post('funding-sources')
  fundingCreate(@Body() body: any) {
    this.database.db
      .prepare(
        'INSERT INTO funding_sources(name,description,is_active) VALUES(?,?,1)'
      )
      .run(body.name, body.description || null);
    return {success: true};
  }

  @UseGuards(RoleGuard)
  @Roles('admin')
  @Put('funding-sources/:id')
  fundingUpdate(@Param('id') id: string, @Body() body: any) {
    this.database.db
      .prepare(
        'UPDATE funding_sources SET name=?,description=?,is_active=? WHERE id=?'
      )
      .run(body.name, body.description || null, body.is_active, id);
    return {success: true};
  }

  @UseGuards(RoleGuard)
  @Roles('admin')
  @Delete('funding-sources/:id')
  fundingDelete(@Param('id') id: string) {
    this.database.db.prepare('DELETE FROM funding_sources WHERE id=?').run(id);
    return {success: true};
  }

  private insert(table: 'vendors' | 'departments', body: any) {
    try {
      const result
        = table === 'vendors'
          ? this.database.db
            .prepare(
              'INSERT INTO vendors(name,contact_person,email,phone) VALUES(?,?,?,?)'
            )
            .run(
              body.name?.trim(),
              body.contact_person || null,
              body.email || null,
              body.phone || null
            )
          : this.database.db
            .prepare(
              'INSERT INTO departments(name,approver_id,slack_approval_message) VALUES(?,?,?)'
            )
            .run(
              body.name?.trim(),
              body.approver_id || null,
              body.slack_approval_message || null
            );
      return {success: true, id: result.lastInsertRowid};
    } catch {
      return {
        success: false,
        error: `Failed to create ${table.slice(0, -1)}`
      };
    }
  }
}
