import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  NotFoundException,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { NotificationsService } from '../notifications/notifications.service';
import { PushNotificationsService } from '../notifications/push-notifications.service';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionsService } from './sessions.service';
import { CreateTeacherSessionDto } from './dto/create-teacher-session.dto';
import { DuplicateSessionDto } from './dto/duplicate-session.dto';
import { UpdateArrivalInstructionsDto } from './dto/update-arrival-instructions.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { RejectSessionDto } from './dto/reject-session.dto';

@Controller('sessions')
export class SessionsController {
constructor(
  private readonly sessionsService: SessionsService,
  private readonly notificationsService: NotificationsService,
  private readonly pushNotificationsService: PushNotificationsService,
) {}
  @Post('teacher/create')
  @UseGuards(JwtAuthGuard)
  createTeacherSession(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateTeacherSessionDto,
  ) {
    return this.sessionsService.createTeacherSessionFromSingleForm(
      user.id,
      dto,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMySessions(@CurrentUser() user: { id: string }) {
    return this.sessionsService.getMySessions(user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  updateSession(
    @CurrentUser() user: { id: string },
    @Param('id') sessionId: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.sessionsService.updateSession(sessionId, user.id, dto);
  }

  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard)
  duplicateSession(
    @CurrentUser() user: { id: string },
    @Param('id') sessionId: string,
    @Body() dto: DuplicateSessionDto,
  ) {
    return this.sessionsService.duplicateSession(
      sessionId,
      user.id,
      new Date(dto.start_time),
    );
  }

  @Patch(':id/arrival-instructions')
  @UseGuards(JwtAuthGuard)
  updateArrivalInstructions(
    @CurrentUser() user: { id: string },
    @Param('id') sessionId: string,
    @Body() dto: UpdateArrivalInstructionsDto,
  ) {
    return this.sessionsService.updateArrivalInstructions(
      sessionId,
      user.id,
      dto.arrival_instructions,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  cancelSession(
    @CurrentUser() user: { id: string },
    @Param('id') sessionId: string,
  ) {
    return this.sessionsService.cancelSession(sessionId, user.id);
  }

  @Get('map')
  @Throttle({
    short: {
      limit: 60,
      ttl: 60_000,
    },
  })
  getSessionsForMap(
    @Query('north') north: string,
    @Query('south') south: string,
    @Query('east') east: string,
    @Query('west') west: string,
    @Query('category') category?: string,
  ) {
    return this.sessionsService.getSessionsForMap(
      Number(north),
      Number(south),
      Number(east),
      Number(west),
      category,
    );
  }

    @Patch(':id/review/approve')
  @UseGuards(JwtAuthGuard)
  approveSessionForReview(
    @Param('id') sessionId: string,
  ) {
    return this.sessionsService.approveSessionForReview(sessionId);
  }

  @Patch(':id/review/reject')
  @UseGuards(JwtAuthGuard)
  rejectSessionForReview(
    @Param('id') sessionId: string,
    @Body() dto: RejectSessionDto,
  ) {
    return this.sessionsService.rejectSessionForReview(
      sessionId,
      dto.reason,
    );
  }
  
  @Get('teacher/:id')
@UseGuards(JwtAuthGuard)
getMySessionById(
  @CurrentUser() user: { id: string },
  @Param('id') sessionId: string,
) {
  return this.sessionsService.getMySessionById(sessionId, user.id);
}


  
@Get('admin/pending-review')
@UseGuards(JwtAuthGuard, AdminGuard)
getPendingReviewSessions() {
  return this.sessionsService.getPendingReviewSessions();
}

@Patch('admin/:id/approve')
@UseGuards(JwtAuthGuard, AdminGuard)
async approveSession(@Param('id') sessionId: string) {
  const session = await this.sessionsService.sessionsRepository.findOne({
    where: { id: sessionId },
    relations: ['teacher', 'class'],
  });

  if (!session) {
    throw new NotFoundException('Session not found');
  }

  session.reviewStatus = 'ACTIVE';

  await this.sessionsService.sessionsRepository.save(session);

  await this.notificationsService.create({
  user_id: session.teacher.id,
  type: "SESSION_APPROVED",
  title: "Session approved",
  body: `"${session.class.title}" is now live on the marketplace.`,
  payload: {
    session_id: session.id,
  },
});

await this.pushNotificationsService.sendToUser(
  session.teacher.id,
  "Session approved",
  `"${session.class.title}" is now live on the marketplace.`,
  {
    session_id: session.id,
    type: "SESSION_APPROVED",
  },
);

  await this.notificationsService.create({
    user_id: session.teacher.id,
    type: 'SESSION_APPROVED',
    title: 'Session approved',
    body: `"${session.class.title}" is now live on the marketplace.`,
    payload: {
      session_id: session.id,
    },
  });

  await this.pushNotificationsService.sendToUser(
    session.teacher.id,
    'Session approved',
    `"${session.class.title}" is now live on the marketplace.`,
    {
      session_id: session.id,
      type: 'SESSION_APPROVED',
    },
  );

  return {
    success: true,
  };
}

@Patch('admin/:id/reject')
@UseGuards(JwtAuthGuard, AdminGuard)
async rejectSession(@Param('id') sessionId: string) {
  const session = await this.sessionsService.sessionsRepository.findOne({
    where: { id: sessionId },
    relations: ['teacher', 'class'],
  });

  if (!session) {
    throw new NotFoundException('Session not found');
  }

  session.reviewStatus = 'REJECTED';

  await this.sessionsService.sessionsRepository.save(session);

  await this.notificationsService.create({
    user_id: session.teacher.id,
    type: 'SESSION_REJECTED',
    title: 'Session needs changes',
    body: `"${session.class.title}" was not approved. Please review and update it.`,
    payload: {
      session_id: session.id,
    },
  });

  await this.pushNotificationsService.sendToUser(
    session.teacher.id,
    'Session needs changes',
    `"${session.class.title}" was not approved. Please review and update it.`,
    {
      session_id: session.id,
      type: 'SESSION_REJECTED',
    },
  );

  return {
    success: true,
  };
}

@Get('nearby')
getNearbySessions(
  @Query('lat') lat: string,
  @Query('lng') lng: string,
  @Query('limit') limit?: string,
  @Query('category') category?: string,
) {
  return this.sessionsService.getNearbySessions(
    Number(lat),
    Number(lng),
    limit ? Number(limit) : 3,
    category,
  );
}

  @Get(':id')
  getSessionById(@Param('id') id: string) {
    return this.sessionsService.getSessionById(id);
  }
}