import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, any>;
};

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(private readonly notificationsService: NotificationsService) {}

async sendToUser(
  userId: string,
  titleOrPayload: string | PushPayload,
  body?: string,
  data?: Record<string, any>,
) {
  const payload: PushPayload =
    typeof titleOrPayload === "string"
      ? {
          title: titleOrPayload,
          body: body ?? "",
          data,
        }
      : titleOrPayload;

  const tokens = await this.notificationsService.getActiveTokensForUser(userId);
    if (!tokens.length) {
      this.logger.log(`PUSH_SEND_SKIPPED_NO_TOKENS userId=${userId}`);
      return;
    }

    const validExpoTokens = tokens.filter(
      (token) =>
        token.startsWith('ExponentPushToken[') ||
        token.startsWith('ExpoPushToken['),
    );

    if (!validExpoTokens.length) {
      this.logger.warn(`PUSH_SEND_SKIPPED_NO_VALID_EXPO_TOKENS userId=${userId}`);
      return;
    }

    const messages = validExpoTokens.map((token) => ({
      to: token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const json: any = await response.json();

    const invalidTokens = new Set<string>();
const responseData = Array.isArray(json?.data) ? json.data : [];

responseData.forEach((item: any, index: number) => {
      if (item?.status === 'error') {
        const detailsError = item?.details?.error;
        const token = validExpoTokens[index];

        this.logger.warn(
          `PUSH_SEND_ITEM_FAILED userId=${userId} token=${token} error=${
            detailsError ?? item?.message ?? 'unknown'
          }`,
        );

        if (
          detailsError === 'DeviceNotRegistered' ||
          detailsError === 'MismatchSenderId'
        ) {
          invalidTokens.add(token);
        }
      }
    });

    if (invalidTokens.size > 0) {
      await this.notificationsService.deactivateTokens([...invalidTokens]);
    }

    this.logger.log(
      `PUSH_SEND_COMPLETED userId=${userId} requested=${validExpoTokens.length} invalidated=${invalidTokens.size}`,
    );
  }
}