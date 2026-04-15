import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DeepLinkService {
  constructor(private readonly configService: ConfigService) {}

  bookingDetails(bookingId: string): string {
    const scheme =
      this.configService.get<string>('APP_DEEP_LINK_SCHEME') || 'elevator://';

    return `${scheme}bookings/${bookingId}`;
  }

  bookingDetailsFallback(bookingId: string): string {
    const webUrl =
      this.configService.get<string>('APP_WEB_URL') || 'http://localhost:3000';

    return `${webUrl}/bookings/${bookingId}`;
  }

  resetPassword(token: string): string {
    const scheme =
      this.configService.get<string>('APP_DEEP_LINK_SCHEME') || 'elevator://';

    return `${scheme}reset-password?token=${encodeURIComponent(token)}`;
  }

  verifyEmail(token: string): string {
    const scheme =
      this.configService.get<string>('APP_DEEP_LINK_SCHEME') || 'elevator://';

    return `${scheme}verify-email?token=${encodeURIComponent(token)}`;
  }
}