import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import { User } from '../users/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendVerificationDto } from './dto/send-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { MailService } from '../mail/mail.service';
import { TeacherProfile } from '../teacher/entities/teacher-profile.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private mailService: MailService,
    private dataSource: DataSource,
    @InjectRepository(TeacherProfile)
    private teacherProfileRepository: Repository<TeacherProfile>,
  ) {}

  async deleteMe(userId: string) {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `DELETE FROM reviews WHERE learner_id = $1 OR teacher_id = $1`,
        [userId],
      );
    

      await manager.query(
        `DELETE FROM bookings WHERE user_id = $1 OR cancelled_by_user_id = $1`,
        [userId],
      );

      await manager.query(`DELETE FROM notifications WHERE user_id = $1`, [
        userId,
      ]);

      await manager.query(
        `DELETE FROM teacher_followers WHERE user_id = $1 OR teacher_id = $1`,
        [userId],
      );

      await manager.query(
        `DELETE FROM private_session_requests WHERE learner_id = $1 OR teacher_id = $1`,
        [userId],
      );

await manager.query(
  `DELETE FROM sessions WHERE teacher_id = $1 OR private_invitee_user_id = $1`,
  [userId],
);

await manager.query(
  `DELETE FROM classes WHERE teacher_id = $1`,
  [userId],
);

await manager.query(`DELETE FROM teacher_profiles WHERE user_id = $1`, [
  userId,
]);

await manager.query(`DELETE FROM users WHERE id = $1`, [userId]);

      await manager.query(`DELETE FROM users WHERE id = $1`, [userId]);
    });

    this.logger.log(`AUTH_DELETE_ACCOUNT_SUCCESS userId=${userId}`);

    return { success: true };
  }

async deleteAccount(userId: string) {
  return this.deleteMe(userId);
}

  private get isProduction() {
    return process.env.NODE_ENV === 'production';
  }

  private get refreshSecret() {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not set');
    }
    return secret;
  }

  private get refreshExpiresIn() {
    return process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  }

  private buildDevVerificationPayload(rawToken: string) {
    if (this.isProduction) return {};

    return {
      dev_verification_token: rawToken,
      dev_verification_url: `elevator://verify-email?token=${encodeURIComponent(rawToken)}`,
    };
  }

  private buildDevResetPayload(rawToken: string) {
    if (this.isProduction) return {};

    return {
      dev_reset_token: rawToken,
      dev_reset_url: `elevator://reset-password?token=${encodeURIComponent(rawToken)}`,
    };
  }

  private buildAccessPayload(user: User, hasTeacherProfile: boolean) {
    const emailVerified = this.isProduction ? !!user.email_verified_at : true;

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      is_admin: user.is_admin === true,
      hasTeacherProfile,
      emailVerified,
    };
  }

  private signAccessToken(payload: {
    sub: string;
    email: string;
    role: string;
    is_admin: boolean;
    hasTeacherProfile: boolean;
    emailVerified: boolean;
  }) {
    return this.jwtService.sign(payload);
  }

  private signRefreshToken(payload: { sub: string; email: string }) {
    return this.jwtService.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn as any,
    });
  }

  private async persistRefreshToken(user: User, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    user.refresh_token_hash = hash;
    user.refresh_token_expires_at = expiresAt;

    await this.userRepository.save(user);

    
  }

  private buildAuthResponse(
    user: User,
    hasTeacherProfile: boolean,
    accessToken: string,
    refreshToken: string,
  ) {
    const emailVerified = this.isProduction ? !!user.email_verified_at : true;

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        first_name: user.first_name,
        email: user.email,
        role: user.role,
        image_url: user.image_url,
        is_admin: user.is_admin === true,
        hasTeacherProfile,
        email_verified: emailVerified,
      },
    };
  }

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    this.logger.log(`AUTH_REGISTER_ATTEMPT email=${normalizedEmail}`);

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

    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    const autoVerifiedInDev = !this.isProduction;

    const user = this.userRepository.create({
      first_name: dto.first_name.trim(),
      email: normalizedEmail,
      password_hash: hashed,
      role: 'LEARNER',
      image_url: null,
      email_verified_at: autoVerifiedInDev ? new Date() : null,
      email_verification_token: autoVerifiedInDev ? null : hashedToken,
      email_verification_expires_at: autoVerifiedInDev ? null : expiresAt,
    });

    await this.userRepository.save(user);

    if (!this.isProduction) {
      this.logger.log(
        `AUTH_REGISTER_SUCCESS_DEV_AUTO_VERIFIED userId=${user.id} role=${user.role}`,
      );

      return {
        id: user.id,
        first_name: user.first_name,
        email: user.email,
        role: user.role,
        image_url: user.image_url,
        hasTeacherProfile: false,
        email_verified: true,
        message: 'Account created and auto-verified in development mode.',
      };
    }

    try {
      await this.mailService.sendVerificationEmail(user.email, rawToken);
    } catch (e) {
      this.logger.error(
        `AUTH_REGISTER_VERIFY_MAIL_FAILED userId=${user.id} email=${user.email} error=${e instanceof Error ? e.message : String(e)}`,
      );

      return {
        id: user.id,
        first_name: user.first_name,
        email: user.email,
        role: user.role,
        image_url: user.image_url,
        hasTeacherProfile: false,
        email_verified: false,
        message:
          'Account created, but we could not send the verification email. Please try resending verification shortly.',
        ...this.buildDevVerificationPayload(rawToken),
      };
    }

    this.logger.log(
      `AUTH_REGISTER_SUCCESS userId=${user.id} role=${user.role}`,
    );

    return {
      id: user.id,
      first_name: user.first_name,
      email: user.email,
      role: user.role,
      image_url: user.image_url,
      hasTeacherProfile: false,
      email_verified: false,
      message: 'Account created. Please verify the email we sent you before logging in.',
      ...this.buildDevVerificationPayload(rawToken),
    };
  }

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    this.logger.log(`AUTH_LOGIN_ATTEMPT email=${normalizedEmail}`);

    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
      relations: { teacherProfile: true },
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
    if (user.is_suspended) {
  throw new UnauthorizedException(
    'Your account has been suspended.',
  );
}

    if (this.isProduction && !user.email_verified_at) {
      this.logger.warn(`AUTH_LOGIN_BLOCKED_UNVERIFIED userId=${user.id}`);
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    const hasTeacherProfile = !!user.teacherProfile;
    const accessPayload = this.buildAccessPayload(user, hasTeacherProfile);
    const accessToken = this.signAccessToken(accessPayload);
    const refreshToken = this.signRefreshToken({
      sub: user.id,
      email: user.email,
    });

    await this.persistRefreshToken(user, refreshToken);

    this.logger.log(
      `AUTH_LOGIN_SUCCESS userId=${user.id} role=${user.role} hasTeacherProfile=${hasTeacherProfile}`,
    );

    return this.buildAuthResponse(
      user,
      hasTeacherProfile,
      accessToken,
      refreshToken,
    );
  }

  async refresh(refreshToken: string) {
    if (!refreshToken || !refreshToken.trim()) {
      throw new UnauthorizedException('Refresh token is required');
    }

    let payload: any;

    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      relations: { teacherProfile: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.refresh_token_hash || !user.refresh_token_expires_at) {
      throw new UnauthorizedException('Refresh token not available');
    }

    if (user.refresh_token_expires_at.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const matches = await bcrypt.compare(refreshToken, user.refresh_token_hash);

    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const hasTeacherProfile = !!user.teacherProfile;
    const accessPayload = this.buildAccessPayload(user, hasTeacherProfile);
    const nextAccessToken = this.signAccessToken(accessPayload);
    const nextRefreshToken = this.signRefreshToken({
      sub: user.id,
      email: user.email,
    });

    await this.persistRefreshToken(user, nextRefreshToken);

    this.logger.log(`AUTH_REFRESH_SUCCESS userId=${user.id}`);

    return this.buildAuthResponse(
      user,
      hasTeacherProfile,
      nextAccessToken,
      nextRefreshToken,
    );
  }

  async logout(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      return { success: true };
    }

    user.refresh_token_hash = null;
    user.refresh_token_expires_at = null;
    await this.userRepository.save(user);

    this.logger.log(`AUTH_LOGOUT_SUCCESS userId=${userId}`);

    return { success: true };
  }

async forgotPassword(dto: ForgotPasswordDto) {
  const normalizedEmail = dto.email.toLowerCase().trim();

  this.logger.log(`AUTH_FORGOT_PASSWORD_ATTEMPT email=${normalizedEmail}`);

  const user = await this.userRepository.findOne({
    where: { email: normalizedEmail },
  });

  const genericMessage =
    'If an account exists for that email, a reset code has been sent.';

  if (!user) {
    this.logger.warn(
      `AUTH_FORGOT_PASSWORD_NO_USER email=${normalizedEmail}`,
    );

    return { message: genericMessage };
  }

  const resetCode = String(Math.floor(100000 + Math.random() * 900000));
  const hashedCode = createHash('sha256').update(resetCode).digest('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15);

  user.password_reset_token = hashedCode;
  user.password_reset_expires_at = expiresAt;
  await this.userRepository.save(user);

  await this.mailService.sendPasswordResetEmail(user.email, resetCode);

  this.logger.log(`AUTH_FORGOT_PASSWORD_SUCCESS userId=${user.id}`);

  return {
    message: genericMessage,
  };
}

async resetPassword(dto: ResetPasswordDto) {
  const normalizedEmail = dto.email.toLowerCase().trim();
  const rawCode = dto.code.trim();

  const hashedCode = createHash('sha256').update(rawCode).digest('hex');

  this.logger.log(`AUTH_RESET_PASSWORD_ATTEMPT email=${normalizedEmail}`);

  const user = await this.userRepository.findOne({
    where: {
      email: normalizedEmail,
      password_reset_token: hashedCode,
    },
  });

  if (!user) {
    this.logger.warn(`AUTH_RESET_PASSWORD_INVALID_CODE email=${normalizedEmail}`);
    throw new BadRequestException('Invalid or expired reset code');
  }

  if (
    !user.password_reset_expires_at ||
    user.password_reset_expires_at.getTime() < Date.now()
  ) {
    this.logger.warn(`AUTH_RESET_PASSWORD_EXPIRED_CODE userId=${user.id}`);
    throw new BadRequestException('Invalid or expired reset code');
  }

  const hashedPassword = await bcrypt.hash(dto.new_password, 10);

  user.password_hash = hashedPassword;
  user.password_reset_token = null;
  user.password_reset_expires_at = null;
  user.refresh_token_hash = null;
  user.refresh_token_expires_at = null;

  await this.userRepository.save(user);

  this.logger.log(`AUTH_RESET_PASSWORD_SUCCESS userId=${user.id}`);

  return {
    message: 'Password reset successfully',
  };
}
async sendVerification(dto: SendVerificationDto) {
  const normalizedEmail = dto.email.toLowerCase().trim();

  this.logger.log(`AUTH_SEND_VERIFICATION_ATTEMPT email=${normalizedEmail}`);

  const user = await this.userRepository.findOne({
    where: { email: normalizedEmail },
  });

  if (!user) {
    this.logger.warn(
      `AUTH_SEND_VERIFICATION_NO_USER email=${normalizedEmail}`,
    );

    return {
      message:
        'If an account exists for that email, a verification link has been sent.',
    };
  }

  if (!this.isProduction) {
    if (!user.email_verified_at) {
      user.email_verified_at = new Date();
      user.email_verification_token = null;
      user.email_verification_expires_at = null;
      await this.userRepository.save(user);
    }

    return {
      message: 'Email auto-verified in development mode.',
    };
  }

  if (user.email_verified_at) {
    return {
      message: 'Email is already verified.',
    };
  }

  const rawToken = randomBytes(32).toString('hex');
  const hashedToken = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

  user.email_verification_token = hashedToken;
  user.email_verification_expires_at = expiresAt;
  await this.userRepository.save(user);

  await this.mailService.sendVerificationEmail(user.email, rawToken);

  this.logger.log(`AUTH_SEND_VERIFICATION_SUCCESS userId=${user.id}`);

  return {
    message:
      'If an account exists for that email, a verification link has been sent.',
    ...this.buildDevVerificationPayload(rawToken),
  };
}

  async verifyEmail(dto: VerifyEmailDto) {
    if (!this.isProduction) {
      return {
        message: 'Email verification skipped in development mode.',
      };
    }

    const rawToken = dto.token.trim();
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');

    this.logger.log(`AUTH_VERIFY_EMAIL_ATTEMPT`);

    const user = await this.userRepository.findOne({
      where: { email_verification_token: hashedToken },
    });

    if (!user) {
      this.logger.warn(`AUTH_VERIFY_EMAIL_INVALID_TOKEN`);
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (
      !user.email_verification_expires_at ||
      user.email_verification_expires_at.getTime() < Date.now()
    ) {
      this.logger.warn(`AUTH_VERIFY_EMAIL_EXPIRED_TOKEN userId=${user.id}`);
      throw new BadRequestException('Invalid or expired verification token');
    }

    user.email_verified_at = new Date();
    user.email_verification_token = null;
    user.email_verification_expires_at = null;

    await this.userRepository.save(user);

    this.logger.log(`AUTH_VERIFY_EMAIL_SUCCESS userId=${user.id}`);

    return {
      message: 'Email verified successfully',
    };
  }

  async updateMyProfilePhoto(userId: string, imageUrl: string) {
    const trimmedImageUrl = imageUrl?.trim();

    if (!trimmedImageUrl) {
      throw new BadRequestException('Profile image URL is required');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    user.image_url = trimmedImageUrl;

    await this.userRepository.save(user);

    await this.teacherProfileRepository.update(
  { user: { id: user.id } as any },
  { image_url: user.image_url },
);

    return {
      id: user.id,
      first_name: user.first_name,
      email: user.email,
      role: user.role,
      image_url: user.image_url,
      is_admin: user.is_admin === true,
    };
  }

  async getMe(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { teacherProfile: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      first_name: user.first_name,
      email: user.email,
      role: user.role,
      image_url: user.image_url,
      is_admin: user.is_admin === true,
      hasTeacherProfile: !!user.teacherProfile,
      email_verified: this.isProduction ? !!user.email_verified_at : true,
    };
  }
}