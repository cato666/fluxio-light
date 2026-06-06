import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { StorageService } from './storage/storage.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const frontendUrl = config.get<string>('FRONTEND_URL') || '*';
  const nodeEnv = config.get<string>('NODE_ENV') || 'development';
  const jwtSecret = config.get<string>('JWT_SECRET') || '';
  const normalizeOrigin = (value?: string | null) => String(value || '').trim().replace(/\/$/, '');
  const allowedOrigins = frontendUrl
    .split(',')
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);
  const allowAllOrigins = allowedOrigins.includes('*');

  if (nodeEnv === 'production') {
    if (!jwtSecret || jwtSecret === 'change_me_super_secret' || jwtSecret === 'dev_secret') {
      throw new Error('JWT_SECRET must be set to a strong production value.');
    }
    if (!allowedOrigins.length || allowAllOrigins) {
      throw new Error('FRONTEND_URL must be set to the production frontend origin.');
    }
  }

  app.setGlobalPrefix('api');
  app.enableCors({
    origin(origin, callback) {
      const normalizedOrigin = normalizeOrigin(origin);
      if (!origin || allowAllOrigins || allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const storage = app.get(StorageService);
  app.useStaticAssets(storage.getRootPath(), { prefix: '/uploads/' });

  const port = config.get<number>('PORT') || 3000;
  await app.listen(port);
  console.log(`Fluxio Light API running on port ${port}`);
}

bootstrap();
