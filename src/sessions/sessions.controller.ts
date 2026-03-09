import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DuplicateSessionDto } from './dto/duplicate-session.dto';
import { UpdateArrivalInstructionsDto } from './dto/update-arrival-instructions.dto';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  /**
   * Create session (TEACHER only)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TEACHER')
  @Post()
  createSession(
    @CurrentUser() user,
    @Body()
    body: {
      classId: string;
      start_time: string;
      duration: number;
      max_participants: number;
      lat: number;
      lng: number;
    },
  ) {
    return this.sessionsService.createSession(
      user.id,
      body.classId,
      new Date(body.start_time),
      body.duration,
      body.max_participants,
      body.lat,
      body.lng,
    );
  }

  /**
   * Duplicate session (TEACHER only)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TEACHER')
  @Post(':id/duplicate')
  duplicateSession(
    @Param('id') id: string,
    @Body() dto: DuplicateSessionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.sessionsService.duplicateSession(
      id,
      user.id,
      new Date(dto.start_time),
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TEACHER')
  @Post(':id/arrival-instructions')
  updateArrivalInstructions(
    @Param('id') id: string,
    @Body() dto: UpdateArrivalInstructionsDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.sessionsService.updateArrivalInstructions(
      id,
      user.id,
      dto.arrival_instructions,
    );
  }

  /**
   * Map query
   */
  @Get('map')
  getForMap(
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

  /**
   * Full session fetch (tap marker)
   */
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.sessionsService.getSessionById(id);
  }
}
