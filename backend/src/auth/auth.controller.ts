import {Body, Controller, Get, Post, Req} from '@nestjs/common';
import type {Request} from 'express';
import {AuthService} from './auth.service';
@Controller('api')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('login') async login(
    @Body() body: {username: string; password: string},
    @Req() request: Request
  ) {
    const user = await this.auth.validate(body.username, body.password);
    if (!user) return {success: false, error: 'Invalid credentials'};
    return this.auth.signIn(request, user);
  }

  @Post('logout') async logout(@Req() request: Request) {
    await this.auth.signOut(request);
    return {success: true};
  }

  @Get('auth/check') check(@Req() request: Request) {
    return request.session.userId
      ? {
        authenticated: true,
        userId: request.session.userId,
        role: request.session.userRole,
        fullName: request.session.userName
      }
      : {authenticated: false};
  }
}
