import * as dotenv from 'dotenv';
dotenv.config();

import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as bodyParser from 'body-parser';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use('/payments/webhook', bodyParser.raw({ type: 'application/json' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
  prefix: '/uploads',
});
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors();

  
  await app.listen(3000);
}
bootstrap();
