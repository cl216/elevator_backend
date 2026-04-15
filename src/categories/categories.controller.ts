import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProposeCategoryDto } from './dto/propose-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  getApprovedCategories() {
    return this.categoriesService.getApprovedCategories();
  }

  @Post('propose')
  @UseGuards(JwtAuthGuard)
  proposeCategory(
    @CurrentUser() user: { id: string },
    @Body() dto: ProposeCategoryDto,
  ) {
    return this.categoriesService.proposeCategory(user.id, dto.label);
  }
}