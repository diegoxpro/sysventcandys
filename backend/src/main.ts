import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // El certificado .pfx llega en base64 dentro del JSON.
  app.useBodyParser('json', { limit: '1mb' });
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API lista en http://localhost:${port}/api`);
}
bootstrap();
