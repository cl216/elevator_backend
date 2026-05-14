import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

async validate(payload: any) {
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    is_admin: payload.is_admin === true,
    hasTeacherProfile: payload.hasTeacherProfile,
    emailVerified: payload.emailVerified,
  };
}
  
}