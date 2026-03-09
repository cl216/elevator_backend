import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    this.logger.log(
      `AUTH_REGISTER_ATTEMPT email=${normalizedEmail} role=${dto.role}`,
    );

    const existing = await this.userRepository.findOneBy({
      email: normalizedEmail,
    });

    if (existing) {
      this.logger.warn(
        `AUTH_REGISTER_DUPLICATE_EMAIL email=${normalizedEmail}`,
      );
      throw new ConflictException('Email already in use');
    }

    const hashed = await bcrypt.hash(dto.password, 10);

    const user = this.userRepository.create({
      first_name: dto.first_name.trim(),
      email: normalizedEmail,
      password_hash: hashed,
      role: dto.role,
    });

    await this.userRepository.save(user);

    this.logger.log(
      `AUTH_REGISTER_SUCCESS userId=${user.id} role=${user.role}`,
    );

    return {
      id: user.id,
      first_name: user.first_name,
      email: user.email,
      role: user.role,
    };
  }

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    this.logger.log(`AUTH_LOGIN_ATTEMPT email=${normalizedEmail}`);

    const user = await this.userRepository.findOneBy({
      email: normalizedEmail,
    });

    if (!user) {
      this.logger.warn(`AUTH_LOGIN_FAILED_NO_USER email=${normalizedEmail}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const match = await bcrypt.compare(dto.password, user.password_hash);

    if (!match) {
      this.logger.warn(`AUTH_LOGIN_FAILED_BAD_PASSWORD userId=${user.id}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload);

    this.logger.log(`AUTH_LOGIN_SUCCESS userId=${user.id} role=${user.role}`);

    return { access_token };
  }
}
