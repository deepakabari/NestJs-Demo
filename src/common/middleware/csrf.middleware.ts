import { Injectable, NestMiddleware, ForbiddenException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createHmac, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';

/**
 * CSRF Protection Middleware — Double Submit Cookie Pattern
 *
 * HOW IT WORKS:
 * 1. On login, the server sets a `csrf_token` cookie (NOT HttpOnly — JS can read it).
 * 2. The client reads this cookie and sends it back in the `X-CSRF-Token` header.
 * 3. This middleware compares the cookie value with the header value.
 *
 * WHY THIS WORKS:
 * - A cross-origin attacker can trigger the browser to send cookies automatically,
 *   but CANNOT read the cookie value (due to SameSite + CORS restrictions).
 * - Therefore, the attacker cannot set the matching `X-CSRF-Token` header.
 * - An HMAC signature on the token prevents attackers from forging valid tokens.
 *
 * WHY NOT csurf:
 * - The `csurf` package is deprecated. The double-submit cookie pattern provides
 *   equivalent protection without server-side token storage overhead.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CsrfMiddleware.name);
  private readonly csrf_secret: string;

  /** HTTP methods that modify state and require CSRF validation */
  private readonly state_changing_methods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

  /** Routes excluded from CSRF checks (public auth endpoints) */
  private readonly excluded_routes = [
    '/cognito-auth/login',
    '/cognito-auth/signup',
    '/cognito-auth/confirm',
    '/cognito-auth/forgot-password',
    '/cognito-auth/reset-password',
    '/cognito-auth/resend-code',
    '/cognito-auth/google',
    '/cognito-auth/google/callback',
  ];

  constructor(private readonly config_service: ConfigService) {
    this.csrf_secret = this.config_service.getOrThrow<string>('CSRF_SECRET');
  }

  use(req: Request, _res: Response, next: NextFunction) {
    // Skip non-state-changing methods (GET, HEAD, OPTIONS are safe)
    if (!this.state_changing_methods.has(req.method)) {
      return next();
    }

    // Skip excluded auth routes that don't have a session yet
    if (this.excluded_routes.some((route) => req.path.startsWith(route))) {
      return next();
    }

    const cookie_token = req.cookies?.['csrf_token'] as string | undefined;
    const header_token = req.headers['x-csrf-token'] as string | undefined;

    // Both must be present
    if (!cookie_token || !header_token) {
      this.logger.warn(`CSRF validation failed — missing token. Path: ${req.path}`);
      throw new ForbiddenException('CSRF token missing');
    }

    // Both must match exactly
    if (cookie_token !== header_token) {
      this.logger.warn(`CSRF validation failed — token mismatch. Path: ${req.path}`);
      throw new ForbiddenException('CSRF token mismatch');
    }

    // Verify the HMAC signature to ensure the token wasn't forged
    if (!this.verifyToken(cookie_token)) {
      this.logger.warn(`CSRF validation failed — invalid signature. Path: ${req.path}`);
      throw new ForbiddenException('CSRF token invalid');
    }

    next();
  }

  /**
   * Generate a signed CSRF token: `randomData.hmacSignature`
   *
   * The HMAC signature prevents an attacker from generating valid tokens
   * even if they find a way to set cookies (e.g., via a subdomain XSS).
   */
  static generateToken(csrf_secret: string): string {
    const random_data = randomBytes(32).toString('hex');
    const signature = createHmac('sha256', csrf_secret).update(random_data).digest('hex');
    return `${random_data}.${signature}`;
  }

  /**
   * Verify the HMAC signature of a CSRF token.
   */
  private verifyToken(token: string): boolean {
    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const [random_data, signature] = parts;
    const expected_signature = createHmac('sha256', this.csrf_secret)
      .update(random_data)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expected_signature.length) return false;

    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expected_signature.charCodeAt(i);
    }
    return result === 0;
  }
}
