import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

export interface LoginResult {
  access_token: string;
  user: { id: number; username: string };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string): Promise<LoginResult> {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const access_token = this.jwtService.sign({
      sub: user.id,
      username: user.username,
    });
    return { access_token, user: { id: user.id, username: user.username } };
  }
}
