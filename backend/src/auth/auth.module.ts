import {Global, Module} from '@nestjs/common';
import {AuthController} from './auth.controller';
import {AuthService} from './auth.service';
import {OidcService} from './oidc.service';
import {AuthGuard, RoleGuard} from './auth.guards';
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, OidcService, AuthGuard, RoleGuard],
  exports: [AuthService, AuthGuard, RoleGuard]
})
export class AuthModule {}
