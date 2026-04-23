import { ValueTransformer } from 'typeorm';
import { EncryptionService } from './encryption.service';

export class EncryptionTransformer implements ValueTransformer {
  private static service: EncryptionService;

  static setService(service: EncryptionService) {
    this.service = service;
  }

  to(value: string | null): string | null {
    if (!value || !EncryptionTransformer.service) return value;
    return EncryptionTransformer.service.encrypt(value);
  }

  from(value: string | null): string | null {
    if (!value || !EncryptionTransformer.service) return value;
    return EncryptionTransformer.service.decrypt(value);
  }
}
