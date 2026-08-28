import {Injectable} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {randomUUID} from 'node:crypto';
import {DatabaseService} from '../database/database.service';
import {Request} from 'express';
import {Role} from './role';

interface UserRow {
  id: number;
  username: string;
  role: Role;
  full_name: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}

  async upsertOidcUser(
    subject: string,
    username: string,
    fullName: string,
    role: Role
  ): Promise<UserRow> {
    const bySubject = this.database.db
      .prepare(
        'SELECT id, username, role, full_name FROM users WHERE oidc_subject = ?'
      )
      .get(subject) as UserRow | undefined;
    if (bySubject) {
      this.database.db
        .prepare(
          'UPDATE users SET username = ?, role = ?, full_name = ? WHERE id = ?'
        )
        .run(username, role, fullName, bySubject.id);
      return {id: bySubject.id, username, role, full_name: fullName};
    }

    const byUsername = this.database.db
      .prepare(
        'SELECT id, username, role, full_name FROM users WHERE username = ?'
      )
      .get(username) as UserRow | undefined;
    if (byUsername) {
      this.database.db
        .prepare(
          'UPDATE users SET oidc_subject = ?, role = ?, full_name = ? WHERE id = ?'
        )
        .run(subject, role, fullName, byUsername.id);
      return {id: byUsername.id, username, role, full_name: fullName};
    }

    const placeholderPassword = await bcrypt.hash(randomUUID(), 10);
    const inserted = this.database.db
      .prepare(
        'INSERT INTO users (username, password, role, full_name, oidc_subject) VALUES (?, ?, ?, ?, ?)'
      )
      .run(username, placeholderPassword, role, fullName, subject);
    return {
      id: Number(inserted.lastInsertRowid),
      username,
      role,
      full_name: fullName
    };
  }

  signIn(request: Request, user: UserRow) {
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
