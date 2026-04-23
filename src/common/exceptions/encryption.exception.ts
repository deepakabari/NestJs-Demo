import { InternalServerErrorException } from '@nestjs/common';

export class EncryptionException extends InternalServerErrorException {
  constructor(message: string) {
    super(message);
  }
}
