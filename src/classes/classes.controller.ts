import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Get,
  Param,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  // Create a new class (TEACHER only)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TEACHER')
  create(@Req() req, @Body() dto: CreateClassDto) {
    return this.classesService.createClass(req.user, dto);
  }

  // Fetch full class details (used after map tap)
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.classesService.getClassById(id);
  }
}
