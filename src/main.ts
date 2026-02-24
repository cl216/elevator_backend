import * as dotenv from 'dotenv';
dotenv.config(); // MUST be first
import * as bodyParser from 'body-parser';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {



  const app = await NestFactory.create(AppModule);
  
    app.use('/payments/webhook', bodyParser.raw({ type: 'application/json' }));


  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    
  }));


  //console.log(`Listening on ${await app.getUrl()}`);
  await app.listen(3000);
}
bootstrap();
