import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrivateSessionRequestsService } from './private-lessons.service';

@Controller('private-session-requests')
@UseGuards(JwtAuthGuard)
export class PrivateSessionRequestsController {
  constructor(
    private readonly privateSessionRequestsService: PrivateSessionRequestsService,
  ) {}

  @Post()
  async createRequest(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      teacher_id: string;
      message: string;
      requested_date_1?: string | null;
      requested_date_2?: string | null;
      requested_date_3?: string | null;
      requested_duration_minutes?: number | null;
      learner_note?: string | null;
    },
  ) {
    return this.privateSessionRequestsService.createRequest({
      learnerId: user.id,
      teacherId: body.teacher_id,
      message: body.message,
      requestedDate1: body.requested_date_1,
      requestedDate2: body.requested_date_2,
      requestedDate3: body.requested_date_3,
      requestedDurationMinutes: body.requested_duration_minutes,
      learnerNote: body.learner_note,
    });
  }

  @Get('mine/learner')
  async getMyLearnerRequests(@CurrentUser() user: { id: string }) {
    return this.privateSessionRequestsService.getMyLearnerRequests(user.id);
  }

  @Get('mine/teacher')
  async getMyTeacherRequests(@CurrentUser() user: { id: string }) {
    return this.privateSessionRequestsService.getMyTeacherRequests(user.id);
  }

  @Post(':id/cancel')
  async cancelRequest(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.privateSessionRequestsService.cancelRequest(id, user.id);
  }

  @Post(':id/decline')
  async declineRequest(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body()
    body: {
      message?: string | null;
    },
  ) {
    return this.privateSessionRequestsService.declineRequest(
      id,
      user.id,
      body?.message,
    );
  }

  @Post(':id/accept')
  async acceptRequest(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body()
    body: {
      title: string;
      description?: string | null;
      category: string;
      price: number;
      start_time: string;
      duration: number;
      lat: number;
      lng: number;
      rough_location: string;
      arrival_instructions?: string | null;
    },
  ) {
    return this.privateSessionRequestsService.acceptRequest({
      requestId: id,
      teacherId: user.id,
      title: body.title,
      description: body.description,
      category: body.category,
      price: Number(body.price),
      startTime: body.start_time,
      duration: Number(body.duration),
      lat: Number(body.lat),
      lng: Number(body.lng),
      roughLocation: body.rough_location,
      arrivalInstructions: body.arrival_instructions,
    });
  }
}