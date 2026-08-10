import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { parse as parseCookie } from 'cookie';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { Server, Socket } from 'socket.io';
import { CognitoJwtPayload } from '../../interfaces/auth.interface';
import { CognitoAuthService } from '../cognito-auth/cognito-auth.service';
import { SessionService } from '../cognito-auth/session.service';

@WebSocketGateway({
  path: '/ws',
  cors: {
    origin: '*', // Adjust for production
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly jwks_client: JwksClient;
  private readonly issuer: string;

  constructor(
    private readonly config_service: ConfigService,
    private readonly cognito_auth_service: CognitoAuthService,
    private readonly session_service: SessionService,
  ) {
    const region = this.config_service.getOrThrow<string>('AWS_REGION');
    const user_pool_id = this.config_service.getOrThrow<string>('COGNITO_USER_POOL_ID');

    this.issuer = `https://cognito-idp.${region}.amazonaws.com/${user_pool_id}`;

    this.jwks_client = new JwksClient({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
      jwksUri: `${this.issuer}/.well-known/jwks.json`,
    });
  }

  /**
   * Socket.IO middleware for authentication.
   * This runs BEFORE the connection is established.
   * If we return an Error here, the client will receive a `connect_error`
   * and will never connect at all.
   */
  afterInit(server: Server) {
    server.use((socket, next) => {
      const authenticate = async () => {
        try {
          // 1. Extract cookies from handshake headers
          const cookieHeader = socket.handshake.headers.cookie;
          if (!cookieHeader) {
            this.logger.warn(`Connection rejected: No cookies found`);
            return next(new Error('Authentication cookies are required'));
          }

          const cookies = parseCookie(cookieHeader) as unknown as Record<string, string>;
          const token = cookies['access_token'];
          const raw_fingerprint = cookies['__fingerprint'];

          if (!token || !raw_fingerprint) {
            this.logger.warn(`Connection rejected: Missing token or fingerprint cookie`);
            return next(new Error('Authentication credentials missing'));
          }

          // 2. Initial JWT decode to get KID
          const decoded = jwt.decode(token, { complete: true }) as unknown as {
            header: { kid: string };
            payload: CognitoJwtPayload;
          };

          if (!decoded || !decoded.header?.kid) {
            return next(new Error('Invalid token structure'));
          }

          // 3. Verify JWT Signature
          const key = await this.jwks_client.getSigningKey(decoded.header.kid);
          const signingKey = key.getPublicKey();

          const payload = jwt.verify(token, signingKey, {
            issuer: this.issuer,
            algorithms: ['RS256'],
          }) as CognitoJwtPayload;

          // 4. Validate Fingerprint Binding (Database Check)
          const is_fingerprint_valid = await this.session_service.validateFingerprint(
            payload.sub,
            raw_fingerprint,
          );

          if (!is_fingerprint_valid) {
            this.logger.warn(`WS Auth: Fingerprint mismatch for user ${payload.sub}`);
            return next(new Error('Invalid session fingerprint'));
          }

          // 5. Success - Attach user to socket
          socket.data.user = payload;
          next();
        } catch (error) {
          const err_message = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(`Connection rejected: ${err_message}`);
          next(new Error('Authentication failed'));
        }
      };

      void authenticate();
    });
  }

  /**
   * By the time handleConnection is called, the middleware has already authenticated the client.
   */
  handleConnection(client: Socket) {
    const user_sub = (client.data as { user?: CognitoJwtPayload })?.user?.sub || 'unknown';
    this.logger.log(`Client ${client.id} connected (sub: ${user_sub})`);

    if (user_sub !== 'unknown') {
      client.join(`user_${user_sub}`);
    }
  }

  handleDisconnect(client: Socket) {
    const user_sub = (client.data as { user?: CognitoJwtPayload })?.user?.sub || 'unknown';
    this.logger.log(`Client ${client.id} disconnected (sub: ${user_sub})`);
  }

  notifyUserStatusUpdated(userId: string, status: string, publicKey: string) {
    // Emit globally using the user's ID as the event name
    this.server.emit(`user_${userId}`, {
      status,
      publicKey,
    });
  }

  /**
   * Extract the JWT token from the socket handshake.
   * Supports: auth.token (recommended), query param, and Authorization header.
   */
  private extractToken(client: Socket): string | null {
    // 1. Check socket.io `auth` object (preferred method)
    const auth_token = client.handshake?.auth?.token as string | undefined;
    if (auth_token) return auth_token;

    // 2. Fallback to query parameter
    const query_token = client.handshake?.query?.token as string;
    if (query_token) return query_token;

    // 3. Fallback to Authorization header
    const auth_header = client.handshake?.headers?.authorization;
    if (auth_header) {
      const [type, token] = auth_header.split(' ');
      if (type === 'Bearer' && token) return token;
    }

    return null;
  }
}
