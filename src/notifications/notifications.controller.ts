import {
  Body,
  Controller,
  Get,
  Post,
  Delete, 
  UseGuards,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getMine(@CurrentUser() user: { id: string }) {
    return this.notificationsService.getForUser(user.id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: { id: string }) {
    return this.notificationsService.markAllRead(user.id);
  }



@Delete()
clearAll(@CurrentUser() user: { id: string }) {
  return this.notificationsService.clearAll(user.id);
}

  @Delete(':notificationId')
deleteOne(
  @CurrentUser() user: { id: string },
  @Param('notificationId') notificationId: string,
) {
  return this.notificationsService.deleteOne(user.id, notificationId);
}

  @Post('read-one')
  markOneRead(
    @CurrentUser() user: { id: string },
    @Body('notificationId') notificationId: string,
  ) {
    if (!notificationId) {
      throw new BadRequestException('notificationId is required');
    }

    return this.notificationsService.markOneRead(user.id, notificationId);
  }

  @Post('devices/register')
  registerDevice(
    @CurrentUser() user: { id: string },
    @Body('token') token: string,
    @Body('platform') platform?: string,
    @Body('deviceId') deviceId?: string,
  ) {
    if (!token?.trim()) {
      throw new BadRequestException('token is required');
    }

    return this.notificationsService.registerDeviceToken({
      user_id: user.id,
      token,
      platform: platform ?? null,
      device_id: deviceId ?? null,
    });
  }

  @Post('devices/unregister')
  unregisterDevice(
    @CurrentUser() user: { id: string },
    @Body('token') token: string,
  ) {
    if (!token?.trim()) {
      throw new BadRequestException('token is required');
    }

    return this.notificationsService.unregisterDeviceToken(user.id, token);
  }
}