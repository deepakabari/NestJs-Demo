import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { messages } from '../../constants/messages.constants';
import { CustomExceptionResponse } from '../../interfaces/common.interface';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = messages.INTERNAL_SERVER_ERROR;
    let error_code: string | number | null = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const res_object = res as CustomExceptionResponse;
        message = res_object.message ?? exception.message;
        error_code = res_object.error_code ?? null;
      } else {
        message = exception.message;
      }
    } else if (
      typeof exception === 'object' &&
      exception !== null &&
      ('code' in exception || 'message' in exception)
    ) {
      const error = exception as { code?: string; message?: string };
      if (error.code === 'ER_DUP_ENTRY' || error.code === '23505') {
        status = HttpStatus.CONFLICT;
        message = messages.DUPLICATE_EMAIL;
        error_code = error.code;
      } else if (error.message) {
        message = error.message;
      }
    }

    request['resMessage'] = message;

    const errorResponse: Record<string, unknown> = {
      success: false,
      status_code: status,
      message,
    };

    if (error_code !== null) {
      errorResponse['error_code'] = error_code;
    }

    response.status(status).json(errorResponse);
  }
}
