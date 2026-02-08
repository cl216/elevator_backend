import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { Session } from './entities/session.entity';
import { Class } from '../classes/entities/class.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, Class, User]), // 👈 ADD User
  ],
  providers: [SessionsService],
  controllers: [SessionsController],
})
export class SessionsModule {}
