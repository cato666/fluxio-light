import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const frontendUrl = config.get<string>('FRONTEND_URL') || '*';
  const nodeEnv = config.get<string>('NODE_ENV') || 'development';
  const jwtSecret = config.get<string>('JWT_SECRET') || '';

  if (nodeEnv === 'production') {
    if (!jwtSecret || jwtSecret === 'change_me_super_secret' || jwtSecret === 'dev_secret') {
      throw new Error('JWT_SECRET must be set to a strong production value.');
    }
    if (!frontendUrl || frontendUrl === '*') {
      throw new Error('FRONTEND_URL must be set to the production frontend origin.');
    }
  }

  app.setGlobalPrefix('api');
  app.enableCors({ origin: frontendUrl === '*' ? true : frontendUrl, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  const port = config.get<number>('PORT') || 3000;
  await app.listen(port);
  console.log(`Fluxio Light API running on port ${port}`);
}

bootstrap();
