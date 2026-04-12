import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { redisStore } from 'cache-manager-redis-yet';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RoomsModule } from './rooms/rooms.module';
import { BookingsModule } from './bookings/bookings.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    // Global Redis cache — available in all modules without re-importing
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: process.env.REDIS_HOST || 'redis',
            port: parseInt(process.env.REDIS_PORT || '6379'),
          },
        }),
        ttl: 300000, // 5 minutes in milliseconds
      }),
    }),

    // Global rate limiting — 30 requests per minute per IP across all routes
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute window
        limit: 30, // max 30 requests per window
      },
    ]),

    PrismaModule,
    AuthModule,
    RoomsModule,
    BookingsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Register ThrottlerGuard globally so every route is protected automatically
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
