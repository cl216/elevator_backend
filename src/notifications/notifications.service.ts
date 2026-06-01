import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { DeviceToken } from './entities/device-token.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(DeviceToken)
    private readonly deviceTokensRepository: Repository<DeviceToken>,
  ) {}

  async create(input: {
    user_id: string;
    type: string;
    title: string;
    body: string;
    payload?: any;
  }) {
    const notification = this.notificationsRepository.create({
      user_id: input.user_id,
      type: input.type,
      title: input.title,
      body: input.body,
      payload: input.payload ?? null,
    });

    return this.notificationsRepository.save(notification);
  }

  async createAndPush(
pushNotificationsService: {
  sendToUser: (
    userId: string,
    payload: {
      title: string;
      body: string;
      data?: Record<string, any>;
    },
  ) => Promise<void>;
},  input: {
    user_id: string;
    type: string;
    title: string;
    body: string;
    payload?: any;
  },
) {
  const notification = await this.create(input);

  await pushNotificationsService.sendToUser(input.user_id, {
    title: input.title,
    body: input.body,
    data: {
      type: input.type,
      ...(input.payload ?? {}),
    },
  });

  return notification;
}
  async getForUser(userId: string) {
    return this.notificationsRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: 50,
    });
  }

  async markAllRead(userId: string) {
    await this.notificationsRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ read: true })
      .where('user_id = :userId', { userId })
      .execute();

    return { success: true };
  }

  async markOneRead(userId: string, notificationId: string) {
    const notification = await this.notificationsRepository.findOne({
      where: {
        id: notificationId,
        user_id: userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.read) {
      notification.read = true;
      await this.notificationsRepository.save(notification);
    }

    return { success: true };
  }

  async registerDeviceToken(input: {
    user_id: string;
    token: string;
    platform?: string | null;
    device_id?: string | null;
  }) {
    const token = input.token.trim();

    let existing = await this.deviceTokensRepository.findOne({
      where: { token },
    });

    if (existing) {
      existing.user_id = input.user_id;
      existing.platform = input.platform ?? existing.platform ?? null;
      existing.device_id = input.device_id ?? existing.device_id ?? null;
      existing.is_active = true;
      existing.last_seen_at = new Date();

      const saved = await this.deviceTokensRepository.save(existing);

      this.logger.log(
        `PUSH_DEVICE_TOKEN_UPDATED userId=${input.user_id} token=${token}`,
      );

      return saved;
    }

    existing = this.deviceTokensRepository.create({
      user_id: input.user_id,
      token,
      platform: input.platform ?? null,
      device_id: input.device_id ?? null,
      is_active: true,
      last_seen_at: new Date(),
    });

    const saved = await this.deviceTokensRepository.save(existing);

    this.logger.log(
      `PUSH_DEVICE_TOKEN_REGISTERED userId=${input.user_id} token=${token}`,
    );

    return saved;
  }

  async unregisterDeviceToken(userId: string, token: string) {
    const existing = await this.deviceTokensRepository.findOne({
      where: {
        user_id: userId,
        token: token.trim(),
      },
    });

    if (!existing) {
      return { success: true };
    }

    existing.is_active = false;
    existing.last_seen_at = new Date();
    await this.deviceTokensRepository.save(existing);

    this.logger.log(
      `PUSH_DEVICE_TOKEN_UNREGISTERED userId=${userId} token=${token}`,
    );

    return { success: true };
  }

  async getActiveTokensForUser(userId: string): Promise<string[]> {
    const rows = await this.deviceTokensRepository.find({
      where: {
        user_id: userId,
        is_active: true,
      },
      order: { updated_at: 'DESC' },
    });

    return rows.map((row) => row.token);
  }

  async deactivateTokens(tokens: string[]) {
    if (!tokens.length) return;

    await this.deviceTokensRepository.update(
      { token: In(tokens) },
      { is_active: false, last_seen_at: new Date() },
    );

    this.logger.warn(
      `PUSH_DEVICE_TOKENS_DEACTIVATED count=${tokens.length}`,
    );
  }
}