import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Response } from 'express';
import type { RequestWithRequestId } from '../middleware/request-id.middleware';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();

    const req = http.getRequest<RequestWithRequestId>();
    const res = http.getResponse<Response>();

    const method = req.method;
    const url = req.originalUrl;
    const userId = req.user?.id ?? 'anonymous';
    const requestId = req.requestId ?? 'unknown';
    const startedAt = Date.now();

    this.logger.log(
      `REQ requestId=${requestId} method=${method} url=${url} userId=${userId}`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startedAt;

          this.logger.log(
            `RES requestId=${requestId} method=${method} url=${url} userId=${userId} status=${res.statusCode} durationMs=${durationMs}`,
          );
        },
        error: (err) => {
          const durationMs = Date.now() - startedAt;

          this.logger.error(
            `RES_ERROR requestId=${requestId} method=${method} url=${url} userId=${userId} status=${res.statusCode} durationMs=${durationMs} message=${err?.message ?? 'unknown'}`,
            err?.stack,
          );
        },
      }),
    );
  }
}
