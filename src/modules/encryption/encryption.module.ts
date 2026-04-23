import { Global, Module, OnModuleInit } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { EncryptionTransformer } from './encryption.transformer';

@Global()
@Module({
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class EncryptionModule implements OnModuleInit {
  constructor(private readonly encryptionService: EncryptionService) {}

  onModuleInit() {
    EncryptionTransformer.setService(this.encryptionService);
  }
}
