import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionsService } from './sessions.service';
import { CreateTeacherSessionDto } from './dto/create-teacher-session.dto';
import { DuplicateSessionDto } from './dto/duplicate-session.dto';
import { UpdateArrivalInstructionsDto } from './dto/update-arrival-instructions.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

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

  @Get(':id')
  getSessionById(@Param('id') id: string) {
    return this.sessionsService.getSessionById(id);
  }
}