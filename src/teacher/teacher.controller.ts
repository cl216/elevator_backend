import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateTeacherProfileDto } from './dto/create-teacher-profile.dto';
import { TeacherStripeService } from './teacher-stripe.service';
import { TeacherService } from './teacher.service';

@Controller('teacher')
export class TeacherController {
  constructor(
    private readonly teacherService: TeacherService,
    private readonly teacherStripeService: TeacherStripeService,
  ) {}

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  createProfile(@Req() req, @Body() dto: CreateTeacherProfileDto) {
    return this.teacherService.createProfile(req.user, dto);
  }

  @Get('attention-summary')
  @UseGuards(JwtAuthGuard)
  async getTeacherAttentionSummary(@CurrentUser() user: { id: string }) {
    return this.teacherService.getTeacherAttentionSummary(user.id);
  }

  @Post('stripe/onboard')
  @UseGuards(JwtAuthGuard)
  async stripeOnboard(@CurrentUser() user: { id: string }) {
    return this.teacherStripeService.createOrResumeOnboarding(user.id);
  }

  @Get('stripe/status')
  @UseGuards(JwtAuthGuard)
  async stripeStatus(@CurrentUser() user: { id: string }) {
    return this.teacherStripeService.refreshStripeStatus(user.id);
  }

  @Get('stripe/can-create-sessions')
  @UseGuards(JwtAuthGuard)
  async canCreateSessions(@CurrentUser() user: { id: string }) {
    const status =
      await this.teacherStripeService.assertTeacherCanCreateSessions(user.id);

    return {
      can_create_sessions: true,
      ...status,
    };
  }

  @Get('stripe/refresh')
  async stripeRefresh(
    @Query('account') accountId: string,
    @Res() res: Response,
  ) {
    const url =
      await this.teacherStripeService.createRefreshOnboardingLink(accountId);

    return res.redirect(url);
  }

@Get('stripe/return')
async stripeReturn(@Res() res: Response) {
  return res.redirect('elevator://dashboard?refresh=1');
}

  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  async followTeacher(
    @CurrentUser() user: { id: string },
    @Param('id') teacherId: string,
  ) {
    return this.teacherService.followTeacher(user.id, teacherId);
  }

  @Delete(':id/follow')
  @UseGuards(JwtAuthGuard)
  async unfollowTeacher(
    @CurrentUser() user: { id: string },
    @Param('id') teacherId: string,
  ) {
    return this.teacherService.unfollowTeacher(user.id, teacherId);
  }

  @Get('me/following')
  @UseGuards(JwtAuthGuard)
  async getFollowing(@CurrentUser() user: { id: string }) {
    return this.teacherService.getFollowing(user.id);
  }

  @Get(':id/follow-status')
  @UseGuards(JwtAuthGuard)
  async getFollowStatus(
    @CurrentUser() user: { id: string },
    @Param('id') teacherId: string,
  ) {
    return this.teacherService.getFollowStatus(user.id, teacherId);
  }

  @Get('sessions/:id/bookings')
  @UseGuards(JwtAuthGuard)
  async getSessionBookings(
    @CurrentUser() user: { id: string },
    @Param('id') sessionId: string,
  ) {
    return this.teacherService.getSessionBookingsForTeacher(sessionId, user.id);
  }

  @Get('me/profile')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@CurrentUser() user: { id: string }) {
    return this.teacherService.getMyProfile(user.id);
  }

  @Get(':id/profile')
  async getPublicTeacherProfile(@Param('id') teacherId: string) {
    return this.teacherService.getPublicTeacherProfile(teacherId);
  }
}