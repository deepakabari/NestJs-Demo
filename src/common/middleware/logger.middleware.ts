import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FastifyRequest, FastifyReply } from 'fastify';
import { STATUS_CODES } from 'http';

const SENSITIVE_FIELDS = [
  'password',
  'pin',
  'confirmation_code',
  'new_password',
  'refresh_token',
  'access_token',
  'id_token',
  'secret',
];

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: FastifyRequest['raw'], response: FastifyReply['raw'], next: () => void): void {
    const ip = request.socket.remoteAddress;
    const method = request.method;
    const originalUrl = request.url;
    const request_id = randomUUID();
    const start_time = Date.now();
    const func_name = this.deriveFunctionName(originalUrl || '/');

    // IP Handling
    let display_ip = ip?.replace('::ffff:', '') || '127.0.0.1';
    if (display_ip === '::1') display_ip = '127.0.0.1';

    // ANSI Colors
    const cyan = '\x1b[36m';
    const yellow = '\x1b[33m';
    const gray = '\x1b[90m';
    const magenta = '\x1b[35m';
    const green = '\x1b[32m';
    const red = '\x1b[31m';
    const reset = '\x1b[0m';
    const bold = '\x1b[1m';

    // 1. Log START
    const user_agent = (request.headers['user-agent'] as string) || 'Unknown';
    const payload = this.redactSensitiveFields(
      (request as unknown as { body?: Record<string, unknown> }).body,
    );

    this.logger.log(`
${magenta}${bold}» REQUEST RECEIVED${reset}
${cyan}Function${reset}  : ${yellow}${func_name}${reset}
${cyan}ID${reset}        : ${gray}${request_id}${reset}
${cyan}Details${reset}   : ${bold}${method}${reset} ${yellow}${originalUrl?.split('?')[0] || '/'}${reset} (${display_ip})
${cyan}UserAgent${reset} : ${gray}${user_agent}${reset}
${cyan}Payload${reset}   : ${gray}${payload}${reset}`);

    // 2. Log END
    response.on('finish', () => {
      const duration = Date.now() - start_time;
      const statusCode = response.statusCode;
      const is_error = statusCode >= 400;
      const status_color = is_error ? red : green;
      const status_text = STATUS_CODES[statusCode] || (is_error ? 'ERROR' : 'SUCCESS');
      const response_message =
        (request as unknown as { resMessage?: string }).resMessage || status_text;
      const header_color = is_error ? red : green;

      this.logger.log(`
${header_color}${bold}« REQUEST COMPLETED${reset}
${cyan}ID${reset}        : ${gray}${request_id}${reset}
${cyan}Status${reset}    : ${status_color}${bold}${statusCode} [${status_text.toUpperCase()}]${reset}
${cyan}Message${reset}   : ${status_color}${response_message}${reset}
${cyan}Duration${reset}  : ${yellow}${duration}ms${reset}
${gray}-----------------------------------------${reset}`);
    });

    next();
  }

  private deriveFunctionName(url: string): string {
    const parts = url
      .split('?')[0]
      .split('/')
      .filter((p) => p);
    if (parts.length === 0) return 'root';

    const last_part = parts[parts.length - 1];
    return last_part.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }

  /**
   * Redact sensitive fields from request payload before logging.
   */
  private redactSensitiveFields(body: Record<string, unknown> | undefined): string {
    if (!body || Object.keys(body).length === 0) return 'None';

    const redacted = { ...body };
    for (const field of SENSITIVE_FIELDS) {
      if (field in redacted) {
        redacted[field] = '[REDACTED]';
      }
    }
    return JSON.stringify(redacted);
  }
}
