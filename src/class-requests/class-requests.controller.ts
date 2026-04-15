import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateClassRequestDto } from './dto/create-class-request.dto';
import { ClassRequestsService } from './class-requests.service';

@Controller('class-requests')
@UseGuards(JwtAuthGuard)
export class ClassRequestsController {
  constructor(private readonly classRequestsService: ClassRequestsService) {}

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateClassRequestDto,
  ) {
    return this.classRequestsService.create(user.id, dto);
  }

  @Get('nearby-for-teacher')
  getNearbyForTeacher(@CurrentUser() user: { id: string }) {
    return this.classRequestsService.getNearbyDemandForTeacher(user.id);
  }
}