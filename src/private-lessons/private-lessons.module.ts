import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PrivateSessionRequest } from './entities/private-lesson-request.entity';
import { PrivateSessionRequestsService } from './private-lessons.service';
import { PrivateSessionRequestsController } from './private-lessons.controller';
import { TeacherProfile } from '../teacher/entities/teacher-profile.entity';
import { SessionsModule } from '../sessions/session.module';
import { Notification } from '../notifications/entities/notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PrivateSessionRequest,
      TeacherProfile,
      Notification,
    ]),
    forwardRef(() => SessionsModule),
  ],
  providers: [PrivateSessionRequestsService],
  controllers: [PrivateSessionRequestsController],
  exports: [PrivateSessionRequestsService],
})
export class PrivateSessionRequestsModule {}