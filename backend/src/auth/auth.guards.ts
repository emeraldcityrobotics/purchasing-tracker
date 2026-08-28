import {CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {Request} from 'express';
import {Role} from './role';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    return !!context.switchToHttp().getRequest<Request>().session.userId;
  }
}
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const required
      = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];
    return (
      !!request.session.userId
      && (required.length === 0
        || required.includes(request.session.userRole as Role))
    );
  }
}
