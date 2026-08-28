import {Injectable} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {DatabaseService} from '../database/database.service';
import {Request} from 'express';

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}
  async validate(username: string, password: string) {
    const user = this.database.db
      .prepare('SELECT * FROM users WHERE username=?')
      .get(username) as any;
    return user && (await bcrypt.compare(password, user.password))
      ? user
      : null;
  }

  signIn(request: Request, user: any) {
    request.session.userId = user.id;
    request.session.userRole = user.role;
    request.session.userName = user.full_name;
    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name
      }
    };
  }

  signOut(request: Request) {
    return new Promise<void>((resolve, reject) =>
      request.session.destroy(error => (error ? reject(error) : resolve()))
    );
  }

  isAuthenticated(request: Request) {
    return !!request.session.userId;
  }
}
