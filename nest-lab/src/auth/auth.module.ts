import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Auth module — registration, login, JWT guards, RBAC.
 *
 * Security fix (Evaluation Report — Issue #1):
 *   The JWT secret MUST come from environment. The previous
 *   `process.env.JWT_SECRET || 'defaultSecret'` fallback is removed — if the
 *   secret is missing the app refuses to start, which is the correct
 *   fail-closed behaviour for NFR-4.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');

        // Fail loudly at boot rather than silently using a weak default
        if (!secret || secret.trim().length < 16) {
          throw new Error(
            '[auth] JWT_SECRET environment variable is missing or too short ' +
              '(needs at least 16 characters). Refusing to start. ' +
              'Generate one with:  openssl rand -base64 48',
          );
        }

        return {
          secret,
          signOptions: {
            expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '1d') as any,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule, JwtStrategy],
})
export class AuthModule {}
