import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassRequest } from './class-request.entity';
import { User } from '../users/user.entity';
import { Session } from '../sessions/entities/session.entity';
import { ClassRequestsController } from './class-requests.controller';
import { ClassRequestsService } from './class-requests.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClassRequest, User, Session])],
  controllers: [ClassRequestsController],
  providers: [ClassRequestsService],
  exports: [ClassRequestsService],
})
export class ClassRequestsModule {}