import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { DeepLinkService } from '../common/links/deep-link.service';
import { BookingEmailBuilder } from './builders/booking-email.builder';

@Module({
  imports: [ConfigModule],
  providers: [EmailService, DeepLinkService, BookingEmailBuilder],
  exports: [EmailService, BookingEmailBuilder],
})
export class EmailModule {}