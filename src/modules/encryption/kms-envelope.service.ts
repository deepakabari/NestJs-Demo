import { DecryptCommand, GenerateDataKeyCommand, KMSClient } from '@aws-sdk/client-kms';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { EncryptionException } from '../../common/exceptions/encryption.exception';
import { messages } from '../../constants/messages.constants';

export interface EnvelopePayload {
  v: number; // Version for key rotation
  edek: string; // Encrypted Data Encryption Key (base64)
  iv: string; // Initialization Vector (base64)
  tag: string; // GCM Auth Tag (base64)
  cip: string; // Ciphertext Payload (base64)
}

@Injectable()
export class KmsEnvelopeService {
  private readonly kms_client: KMSClient;
  private readonly logger = new Logger(KmsEnvelopeService.name);

  // Current version for rotation strategy
  private readonly CURRENT_KEY_VERSION = 1;

  constructor(private config_service: ConfigService) {
    const region = this.config_service.get<string>('AWS_REGION');
    this.kms_client = new KMSClient({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  /**
   * Encrypts a mnemonic using KMS Envelope Encryption.
   * Bonus: Supports an optional user-provided password/pin for secondary PBKDF2 encryption.
   */
  async encryptMnemonic(plaintext_mnemonic: string, user_pin?: string): Promise<string> {
    // Bypassing KMS Encryption for now as requested
    this.logger.warn('KMS Envelope Encryption is disabled. Storing plaintext mnemonic.');
    return plaintext_mnemonic;
  }

  /**
   * Decrypts the envelope payload back into the plaintext mnemonic.
   */
  async decryptMnemonic(
    envelope_base64: string,
    user_pin?: string,
    user_id?: number,
  ): Promise<string> {
    // Bypassing KMS Decryption for now as requested
    this.logger.warn('KMS Envelope Decryption is disabled. Returning plaintext mnemonic directly.');
    return envelope_base64;
  }
}
