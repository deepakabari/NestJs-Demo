import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl } = request;
    const requestId = randomUUID();
    const startTime = Date.now();
    const funcName = this.deriveFunctionName(originalUrl);
    
    // IP Handling
    let displayIp = ip?.replace('::ffff:', '') || '127.0.0.1';
    if (displayIp === '::1') displayIp = '127.0.0.1';

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
    const userAgent = request.get('user-agent') || 'Unknown';
    const payload = Object.keys(request.body).length > 0 ? JSON.stringify(request.body) : 'None';

    console.log(`
${magenta}${bold}» REQUEST RECEIVED${reset}
${cyan}Function${reset}  : ${yellow}${funcName}${reset}
${cyan}ID${reset}        : ${gray}${requestId}${reset}
${cyan}Details${reset}   : ${bold}${method}${reset} ${yellow}${originalUrl.split('?')[0]}${reset} (${displayIp})
${cyan}UserAgent${reset} : ${gray}${userAgent}${reset}
${cyan}Payload${reset}   : ${gray}${payload}${reset}`);

    // 2. Log END
    response.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = response;
      const statusColor = statusCode >= 400 ? red : green;

      console.log(`
${green}${bold}« REQUEST COMPLETED${reset}
${cyan}ID${reset}        : ${gray}${requestId}${reset}
${cyan}Status${reset}    : ${statusColor}${bold}${statusCode}${reset}
${cyan}Duration${reset}  : ${yellow}${duration}ms${reset}
${gray}-----------------------------------------${reset}`);
    });

    next();
  }

  private deriveFunctionName(url: string): string {
    const parts = url.split('?')[0].split('/').filter((p) => p);
    if (parts.length === 0) return 'root';
    
    const lastPart = parts[parts.length - 1];
    return lastPart.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }
}
