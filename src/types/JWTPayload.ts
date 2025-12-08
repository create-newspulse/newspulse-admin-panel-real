import { User } from './User';

export interface JWTPayload {
  email: string;
  role: User['role'];
  name?: string;
  exp: number;
  iat: number;
}
