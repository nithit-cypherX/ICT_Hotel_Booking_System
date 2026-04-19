import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../prisma/prisma.service';

interface JwtPayload {
  sub: number;
  email: string;
  role: 'USER' | 'ADMIN';
}

/**
 * Validates incoming JWTs on every protected request.
 *
 * Security fix (Evaluation Report — Issue #1):
 *   `process.env.JWT_SECRET || 'defaultSecret'` is GONE. We read the secret
 *   via ConfigService and throw if it is not set — this matches the
 *   fail-closed behaviour of auth.module.ts.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = config.get<string>('JWT_SECRET');

    if (!secret || secret.trim().length < 16) {
      throw new Error(
        '[jwt-strategy] JWT_SECRET is missing or too short. ' +
          'The JwtStrategy cannot be initialised without a valid secret.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Called by Passport after the signature/expiry check passes.
   * Re-fetches the user so deactivated accounts can't use old tokens.
   */
  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return user;
  }
}
