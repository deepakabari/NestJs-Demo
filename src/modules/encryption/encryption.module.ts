import { Global, Module, OnModuleInit } from '@nestjs/common';
import { KmsEnvelopeService } from './kms-envelope.service';
import { EncryptionService } from './encryption.service';
import { EncryptionTransformer } from './encryption.transformer';

@Global()
@Module({
  providers: [EncryptionService, KmsEnvelopeService],
  exports: [EncryptionService, KmsEnvelopeService],
})
export class EncryptionModule implements OnModuleInit {
  constructor(private readonly encryptionService: EncryptionService) {}

  onModuleInit() {
    EncryptionTransformer.setService(this.encryptionService);
  }
}
