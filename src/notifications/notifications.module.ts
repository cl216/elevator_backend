import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { DeviceToken } from './entities/device-token.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PushNotificationsService } from './push-notifications.service';
import { BookingRemindersService } from './booking-reminders.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, DeviceToken])],
providers: [
  NotificationsService,
  PushNotificationsService,
  BookingRemindersService,
],
  controllers: [NotificationsController],
  exports: [NotificationsService, PushNotificationsService],
})
export class NotificationsModule {}