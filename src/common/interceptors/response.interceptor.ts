import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { messages } from '../../constants/messages.constants';
import { ResponseFormat } from '../../interfaces/common.interface';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ResponseFormat<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();

    return next.handle().pipe(
      map((data: T | { message?: string; data?: T }) => {
        let responseData: T | null;
        let message: string = messages.SUCCESS;

        if (typeof data === 'object' && data !== null && 'message' in data) {
          // Service returned { message, data? } — hoist message regardless of data presence
          message = data.message ?? messages.SUCCESS;
          responseData = ('data' in data ? data.data : null) ?? null;
        } else {
          responseData = data as T;
        }

        const response = ctx.getResponse<Response>();

        request['resMessage'] = message;

        return {
          success: true,
          status_code: response.statusCode,
          message,
          data: responseData ?? null,
        };
      }),
    );
  }
}
