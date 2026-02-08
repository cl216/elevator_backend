import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    console.log('JWT_SECRETorprivate:', process.env.JWT_SECRET); // <-- debug

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET!, // <-- fallback for testing,
    });
  }

  async validate(payload: any) {
    // this becomes req.user
    console.log('JWT_SECRET:', process.env.JWT_SECRET); // <-- debug

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
