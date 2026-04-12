import { Role } from '@prisma/client';

export interface JwtUser {
  id: number;
  username: string;
  role: Role;
}
