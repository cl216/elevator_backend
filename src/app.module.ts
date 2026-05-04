import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { UploadsModule } from "./uploads/uploads.module";

import { CategoriesModule } from './categories/categories.module';
import { ClassRequestsModule } from './class-requests/class-requests.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TeacherModule } from './teacher/teacher.module';
import { ClassesModule } from './classes/classes.module';
import { SessionsModule } from './sessions/session.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { ReviewsModule } from './reviews/reviews.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { PrivateSessionRequestsModule } from './private-lessons/private-lessons.module';

@Module({
  imports: [

    ServeStaticModule.forRoot({
  rootPath: join(process.cwd(), "uploads"),
  serveRoot: "/uploads",
}),
UploadsModule,

    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().uri().required(),
        JWT_SECRET: Joi.string().min(16).required(),
        JWT_EXPIRES_IN: Joi.string().required(),
        STRIPE_SECRET_KEY: Joi.string().required(),
        STRIPE_WEBHOOK_SECRET: Joi.string().required(),
        STRIPE_PUBLISHABLE_KEY: Joi.string().required(),
        STRIPE_CONNECT_REFRESH_URL: Joi.string().uri().required(),
        STRIPE_CONNECT_RETURN_URL: Joi.string().uri().required(),
        APP_URL: Joi.string().uri().required(),
        CHECKOUT_SUCCESS_URL: Joi.string().uri().required(),
        CHECKOUT_CANCEL_URL: Joi.string().uri().required(),
        PAYMENTS_CURRENCY: Joi.string().length(3).required(),
        DB_HOST: Joi.string().optional(),
        DB_PORT: Joi.number().optional(),
        DB_USER: Joi.string().optional(),
        DB_PASS: Joi.string().optional(),
        DB_NAME: Joi.string().optional(),
      }),
    }),

    ScheduleModule.forRoot(),

    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: false,
    }),

    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60_000,
        limit: 20,
      },
    ]),

    HealthModule,
    UsersModule,
    AuthModule,
    TeacherModule,
    ClassesModule,
    SessionsModule,
    BookingsModule,
    PaymentsModule,
    ReviewsModule,
    ClassRequestsModule,
    CategoriesModule,
    NotificationsModule,
    PrivateSessionRequestsModule,

  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}