import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Query,
  Delete,
  Patch,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendVerificationDto } from './dto/send-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './jwt.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @Throttle({ short: { limit: 10, ttl: 60_000 } })
  refresh(@Body('refresh_token') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: { id: string }) {
    return this.authService.logout(user.id);
  }

  @Post('forgot-password')
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('send-verification')
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  sendVerification(@Body() dto: SendVerificationDto) {
    return this.authService.sendVerification(dto);
  }

  @Post('verify-email')
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Get('verify-email')
  @Throttle({ short: { limit: 10, ttl: 60_000 } })
  verifyEmailFromLink(@Query('token') token: string) {
    return this.authService.verifyEmail({ token });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.authService.getMe(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/profile-photo')
  updateMyProfilePhoto(
    @CurrentUser() user: { id: string },
    @Body('image_url') imageUrl: string,
  ) {
    return this.authService.updateMyProfilePhoto(user.id, imageUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  deleteMe(@CurrentUser() user: { id: string }) {
    return this.authService.deleteMe(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('delete-account')
  deleteAccount(@CurrentUser() user: { id: string }) {
    return this.authService.deleteAccount(user.id);
  }
}