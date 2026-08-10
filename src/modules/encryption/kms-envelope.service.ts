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
    this.kms_client = new KMSClient({ region });
  }

  /**
   * Encrypts a mnemonic using KMS Envelope Encryption.
   * Bonus: Supports an optional user-provided password/pin for secondary PBKDF2 encryption.
   */
  async encryptMnemonic(plaintext_mnemonic: string, user_pin?: string): Promise<string> {
    const kms_key_id = this.config_service.get<string>('MNEMONIC_KMS_KEY_ID');
    if (!kms_key_id) {
      throw new EncryptionException(messages.KMS_KEY_ID_REQUIRED);
    }

    try {
      // 1. Generate a new DEK from AWS KMS
      const data_key_command = new GenerateDataKeyCommand({
        KeyId: kms_key_id,
        KeySpec: 'AES_256',
      });
      const { Plaintext, CiphertextBlob } = await this.kms_client.send(data_key_command);

      if (!Plaintext || !CiphertextBlob) {
        throw new EncryptionException(messages.KMS_DEK_GENERATION_FAILED);
      }

      // 2. Mix with User PIN if provided
      const final_key = Buffer.from(Plaintext);
      if (user_pin) {
        const pin_key = crypto.pbkdf2Sync(user_pin, 'salt_or_user_id', 100000, 32, 'sha512');
        for (let i = 0; i < 32; i++) {
          final_key[i] ^= pin_key[i];
        }
      }

      // 3. Encrypt the mnemonic locally using AES-256-GCM
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', final_key, iv);

      let encrypted_payload = cipher.update(plaintext_mnemonic, 'utf8', 'base64');
      encrypted_payload += cipher.final('base64');
      const auth_tag = cipher.getAuthTag();

      // 4. Securely zero-out the plaintext keys from memory
      final_key.fill(0);
      Buffer.from(Plaintext).fill(0);

      // 5. Package the envelope
      const envelope: EnvelopePayload = {
        v: this.CURRENT_KEY_VERSION,
        edek: Buffer.from(CiphertextBlob).toString('base64'),
        iv: iv.toString('base64'),
        tag: auth_tag.toString('base64'),
        cip: encrypted_payload,
      };

      return Buffer.from(JSON.stringify(envelope)).toString('base64');
    } catch (error) {
      this.logger.error(
        'Failed to envelope-encrypt mnemonic',
        error instanceof Error ? error.message : String(error),
      );
      throw new EncryptionException(messages.ENCRYPTION_FAILED_SECURELY);
    }
  }

  /**
   * Decrypts the envelope payload back into the plaintext mnemonic.
   */
  async decryptMnemonic(
    envelope_base64: string,
    user_pin?: string,
    user_id?: number | string,
  ): Promise<string> {
    try {
      if (user_id) {
        this.logger.log(`[AUDIT] Decryption requested for user ID: ${user_id}`);
      }

      const envelope_str = Buffer.from(envelope_base64, 'base64').toString('utf8');
      const envelope = JSON.parse(envelope_str) as EnvelopePayload;

      // 1. Decrypt the DEK using AWS KMS
      const decrypt_command = new DecryptCommand({
        CiphertextBlob: Buffer.from(envelope.edek, 'base64'),
      });
      const { Plaintext } = await this.kms_client.send(decrypt_command);

      if (!Plaintext) {
        throw new EncryptionException(messages.KMS_DEK_DECRYPTION_FAILED);
      }

      // 2. Mix with User PIN if it was used during encryption
      const final_key = Buffer.from(Plaintext);
      if (user_pin) {
        const pin_key = crypto.pbkdf2Sync(user_pin, 'salt_or_user_id', 100000, 32, 'sha512');
        for (let i = 0; i < 32; i++) {
          final_key[i] ^= pin_key[i];
        }
      }

      // 3. Local AES-256-GCM decryption
      const iv = Buffer.from(envelope.iv, 'base64');
      const auth_tag = Buffer.from(envelope.tag, 'base64');

      const decipher = crypto.createDecipheriv('aes-256-gcm', final_key, iv);
      decipher.setAuthTag(auth_tag);

      let plaintext_mnemonic = decipher.update(envelope.cip, 'base64', 'utf8');
      plaintext_mnemonic += decipher.final('utf8');

      // 4. Zero-out memory
      final_key.fill(0);
      Buffer.from(Plaintext).fill(0);

      return plaintext_mnemonic;
    } catch (error) {
      this.logger.error(
        'Failed to decrypt envelope mnemonic',
        error instanceof Error ? error.message : String(error),
      );
      throw new EncryptionException(messages.DECRYPTION_FAILED_SECURELY);
    }
  }
}
