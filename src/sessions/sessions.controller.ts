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
   * Map query (Step 7)
   */
  @Get('map')
  getForMap(
    @Query('north') north: string,
    @Query('south') south: string,
    @Query('east') east: string,
    @Query('west') west: string,
  ) {
    return this.sessionsService.getSessionsForMap(
      Number(north),
      Number(south),
      Number(east),
      Number(west),
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
