import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Delegates all token verification to JwtStrategy.validate()
// No manual token parsing needed here
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
