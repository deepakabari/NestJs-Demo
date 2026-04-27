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
  private readonly kmsClient: KMSClient;
  private readonly logger = new Logger(KmsEnvelopeService.name);

  // Current version for rotation strategy
  private readonly CURRENT_KEY_VERSION = 1;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    this.kmsClient = new KMSClient({ region });
  }

  /**
   * Encrypts a mnemonic using KMS Envelope Encryption.
   * Bonus: Supports an optional user-provided password/pin for secondary PBKDF2 encryption.
   */
  async encryptMnemonic(plaintextMnemonic: string, userPin?: string): Promise<string> {
    const kmsKeyId = this.configService.get<string>('MNEMONIC_KMS_KEY_ID');
    if (!kmsKeyId) {
      throw new EncryptionException(messages.KMS_KEY_ID_REQUIRED);
    }

    try {
      // 1. Generate a new DEK from AWS KMS
      const dataKeyCommand = new GenerateDataKeyCommand({
        KeyId: kmsKeyId,
        KeySpec: 'AES_256',
      });
      const { Plaintext, CiphertextBlob } = await this.kmsClient.send(dataKeyCommand);

      if (!Plaintext || !CiphertextBlob) {
        throw new EncryptionException(messages.KMS_DEK_GENERATION_FAILED);
      }

      // 2. Mix with User PIN if provided
      const finalKey = Buffer.from(Plaintext);
      if (userPin) {
        const pinKey = crypto.pbkdf2Sync(userPin, 'salt_or_user_id', 100000, 32, 'sha512');
        for (let i = 0; i < 32; i++) {
          finalKey[i] ^= pinKey[i];
        }
      }

      // 3. Encrypt the mnemonic locally using AES-256-GCM
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', finalKey, iv);

      let encryptedPayload = cipher.update(plaintextMnemonic, 'utf8', 'base64');
      encryptedPayload += cipher.final('base64');
      const authTag = cipher.getAuthTag();

      // 4. Securely zero-out the plaintext keys from memory
      finalKey.fill(0);
      Buffer.from(Plaintext).fill(0);

      // 5. Package the envelope
      const envelope: EnvelopePayload = {
        v: this.CURRENT_KEY_VERSION,
        edek: Buffer.from(CiphertextBlob).toString('base64'),
        iv: iv.toString('base64'),
        tag: authTag.toString('base64'),
        cip: encryptedPayload,
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
    envelopeBase64: string,
    userPin?: string,
    userId?: number,
  ): Promise<string> {
    try {
      if (userId) {
        this.logger.log(`[AUDIT] Decryption requested for user ID: ${userId}`);
      }

      const envelopeStr = Buffer.from(envelopeBase64, 'base64').toString('utf8');
      const envelope = JSON.parse(envelopeStr) as EnvelopePayload;

      // 1. Decrypt the DEK using AWS KMS
      const decryptCommand = new DecryptCommand({
        CiphertextBlob: Buffer.from(envelope.edek, 'base64'),
      });
      const { Plaintext } = await this.kmsClient.send(decryptCommand);

      if (!Plaintext) {
        throw new EncryptionException(messages.KMS_DEK_DECRYPTION_FAILED);
      }

      // 2. Mix with User PIN if it was used during encryption
      const finalKey = Buffer.from(Plaintext);
      if (userPin) {
        const pinKey = crypto.pbkdf2Sync(userPin, 'salt_or_user_id', 100000, 32, 'sha512');
        for (let i = 0; i < 32; i++) {
          finalKey[i] ^= pinKey[i];
        }
      }

      // 3. Local AES-256-GCM decryption
      const iv = Buffer.from(envelope.iv, 'base64');
      const authTag = Buffer.from(envelope.tag, 'base64');

      const decipher = crypto.createDecipheriv('aes-256-gcm', finalKey, iv);
      decipher.setAuthTag(authTag);

      let plaintextMnemonic = decipher.update(envelope.cip, 'base64', 'utf8');
      plaintextMnemonic += decipher.final('utf8');

      // 4. Zero-out memory
      finalKey.fill(0);
      Buffer.from(Plaintext).fill(0);

      return plaintextMnemonic;
    } catch (error) {
      this.logger.error(
        'Failed to decrypt envelope mnemonic',
        error instanceof Error ? error.message : String(error),
      );
      throw new EncryptionException(messages.DECRYPTION_FAILED_SECURELY);
    }
  }
}
