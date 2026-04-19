import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, ConsoleLogger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ prefix: 'ict-hotel' }),
  });
  // Now NestJS expects every route to start with /api
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Hotel Booking System API')
    .setDescription(
      [
        'REST API for managing rooms, bookings, and notifications in the Hotel Booking System.',
        '',
        'Authentication:',
        '- Use POST /auth/login to receive an access_token.',
        '- Click "Authorize" and enter: Bearer <access_token>',
        '',
        'Rate limiting:',
        '- Global: 30 requests per minute per IP.',
        '- Login: 5 requests per 15 minutes per IP.',
        '- Register: 10 requests per 15 minutes per IP.',
        '- Rooms: 100 requests per minute per IP.',
        '- Exceeding any limit returns 429 Too Many Requests.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addTag('health', 'System health and operational readiness')
    .addTag('auth', 'User authentication, registration, and profile management')
    .addTag('rooms', 'Hotel room management and search')
    .addTag('bookings', 'Booking creation, management, and status updates')
    .addTag('notifications', 'Booking event notifications for frontend use')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Use: Authorization: Bearer <access_token>',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
