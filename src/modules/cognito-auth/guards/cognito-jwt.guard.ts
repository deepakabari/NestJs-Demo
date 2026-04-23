import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class CognitoJwtGuard extends AuthGuard('cognito-jwt') {}
