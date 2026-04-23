import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { messages } from '../../constants/messages.constants';
import { EncryptionException } from '../../common/exceptions/encryption.exception';


@Injectable()
export class EncryptionService implements OnModuleInit {
  private key: Buffer;
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12;
  private readonly logger = new Logger(EncryptionService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const secretName = this.configService.get<string>('AWS_SECRET_NAME');
    const rawKey = this.configService.get<string>('ENCRYPTION_KEY');

    try {
      if (secretName) {
        this.logger.log(`Fetching encryption key from AWS Secrets Manager: ${secretName}`);
        this.key = await this.getSecretFromManager(secretName);
      } else if (rawKey) {
        // Fallback for local development using a hex string in .env
        this.key = Buffer.from(rawKey, 'utf8');
      } else {
        throw new EncryptionException(messages.ENCRYPTION_CONFIG_MISSING);
      }

      if (this.key.length !== 32) {
        this.logger.log('Deriving 32-byte encryption key using SHA-256 from provided secret.');
        this.key = crypto.createHash('sha256').update(this.key).digest();
      }
    } catch (error) {
      this.logger.error('Failed to initialize encryption key', error);
      throw error;
    }
  }

  private async getSecretFromManager(secretName: string): Promise<Buffer> {
    const region = this.configService.get<string>('AWS_REGION');

    // In Production, we leave the client empty so it uses the server's IAM Role automatically.
    const client = new SecretsManagerClient({ region });

    try {
      const response = await client.send(new GetSecretValueCommand({ SecretId: secretName }));

      if (!response.SecretString) {
        throw new EncryptionException(messages.ENCRYPTION_SECRET_EMPTY);
      }

      // If the secret is stored as a JSON string like {"key": "..."}
      try {
        const parsed = JSON.parse(response.SecretString) as {
          key?: string;
          ENCRYPTION_KEY?: string;
        };
        const keyVal = parsed.key || parsed.ENCRYPTION_KEY;

        if (!keyVal) {
          throw new EncryptionException(messages.ENCRYPTION_KEY_NOT_FOUND);
        }

        return Buffer.from(keyVal, 'utf8');
      } catch {
        // Otherwise assume the secret is just the raw hex string
        return Buffer.from(response.SecretString, 'utf8');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : messages.AWS_SECRET_FETCH_ERROR;
      this.logger.error(`${messages.AWS_SECRET_FETCH_ERROR} ${errorMessage}`);
      throw new EncryptionException(errorMessage);
    }
  }

  encrypt(text: string): string {
    if (!text) return text;
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const tag = cipher.getAuthTag().toString('base64');

    // Format: iv:tag:encryptedPayload
    return `${iv.toString('base64')}:${tag}:${encrypted}`;
  }

  decrypt(encryptedData: string): string {
    if (!encryptedData) return encryptedData;

    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      // Return as is if not in our encrypted format
      return encryptedData;
    }

    try {
      const [ivBase64, tagBase64, encryptedText] = parts;
      const iv = Buffer.from(ivBase64, 'base64');
      const tag = Buffer.from(tagBase64, 'base64');

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', error);
      return encryptedData;
    }
  }

  hash(text: string): string {
    if (!text) return text;
    // Blind index for fast searching/uniqueness
    const salt = this.configService.get<string>('ENCRYPTION_SALT') || 'default-salt';
    return crypto.createHmac('sha256', salt).update(text.toLowerCase().trim()).digest('hex');
  }
}
