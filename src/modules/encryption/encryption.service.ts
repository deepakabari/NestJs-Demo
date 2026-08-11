import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { EncryptionException } from '../../common/exceptions/encryption.exception';
import { messages } from '../../constants/messages.constants';

@Injectable()
export class EncryptionService implements OnModuleInit {
  private key: Buffer;
  private readonly algorithm = 'aes-256-gcm';
  private readonly iv_length = 12;
  private readonly logger = new Logger(EncryptionService.name);

  constructor(private config_service: ConfigService) {}

  async onModuleInit() {
    const secret_name = this.config_service.get<string>('AWS_SECRET_NAME');
    const raw_key = this.config_service.get<string>('ENCRYPTION_KEY');

    try {
      if (secret_name) {
        this.logger.log(`Fetching encryption key from AWS Secrets Manager: ${secret_name}`);
        this.key = await this.getSecretFromManager(secret_name);
      } else if (raw_key) {
        // Fallback for local development using a hex string in .env
        this.key = Buffer.from(raw_key, 'utf8');
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

  private async getSecretFromManager(secret_name: string): Promise<Buffer> {
    const region = this.config_service.get<string>('AWS_REGION', 'us-east-1');

    // In Production, we leave the client empty so it uses the server's IAM Role automatically.
    const client = new SecretsManagerClient({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    try {
      const response = await client.send(new GetSecretValueCommand({ SecretId: secret_name }));

      if (!response.SecretString) {
        throw new EncryptionException(messages.ENCRYPTION_SECRET_EMPTY);
      }

      // If the secret is stored as a JSON string like {"key": "..."}
      try {
        const parsed = JSON.parse(response.SecretString) as {
          key?: string;
          ENCRYPTION_KEY?: string;
        };
        const key_val = parsed.key || parsed.ENCRYPTION_KEY;

        if (!key_val) {
          throw new EncryptionException(messages.ENCRYPTION_KEY_NOT_FOUND);
        }

        return Buffer.from(key_val, 'utf8');
      } catch {
        // Otherwise assume the secret is just the raw hex string
        return Buffer.from(response.SecretString, 'utf8');
      }
    } catch (error) {
      const error_message =
        error instanceof Error ? error.message : messages.AWS_SECRET_FETCH_ERROR;
      this.logger.error(`${messages.AWS_SECRET_FETCH_ERROR} ${error_message}`);
      throw new EncryptionException(error_message);
    }
  }

  encrypt(text: string): string {
    if (!text) return text;
    const iv = crypto.randomBytes(this.iv_length);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const tag = cipher.getAuthTag().toString('base64');

    // Format: iv:tag:encryptedPayload
    return `${iv.toString('base64')}:${tag}:${encrypted}`;
  }

  decrypt(encrypted_data: string): string {
    if (!encrypted_data) return encrypted_data;

    const parts = encrypted_data.split(':');
    if (parts.length !== 3) {
      // Return as is if not in our encrypted format
      return encrypted_data;
    }

    try {
      const [iv_base64, tag_base64, encrypted_text] = parts;
      const iv = Buffer.from(iv_base64, 'base64');
      const tag = Buffer.from(tag_base64, 'base64');

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted_text, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', error);
      return encrypted_data;
    }
  }

  hash(text: string): string {
    if (!text) return text;
    // Blind index for fast searching/uniqueness
    const salt = this.config_service.get<string>('ENCRYPTION_SALT') || 'default-salt';
    return crypto.createHmac('sha256', salt).update(text.toLowerCase().trim()).digest('hex');
  }
}
