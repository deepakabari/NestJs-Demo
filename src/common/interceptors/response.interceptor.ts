import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { messages } from 'src/constants/messages.constants';
import { ResponseFormat } from 'src/interfaces/common.interface';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ResponseFormat<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ResponseFormat<T>> {
    return next.handle().pipe(
      map((data: T | { message?: string; data?: T }) => {
        let responseData: T;
        let message: string = messages.SUCCESS;

        if (typeof data === 'object' && data !== null && 'data' in data) {
          const casted = data as { message?: string; data?: T };
          responseData = casted.data ?? (data as unknown as T);
          message = casted.message ?? messages.SUCCESS;
        } else {
          responseData = data as T;
        }

        const request = context.switchToHttp().getRequest<Request>();
        request['resMessage'] = message;

        return {
          success: true,
          message,
          data: responseData ?? null,
        };
      }),
    );
  }
}
