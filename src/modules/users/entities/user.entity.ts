import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { EncryptionTransformer } from '../../encryption/encryption.transformer';

@Entity()
@Index(['status', 'email'])
export class User {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })
  id: string;

  @Column({ name: 'email_hash', unique: true, select: false })
  email_hash: string;

  @Column({ transformer: new EncryptionTransformer() })
  email: string;

  @Column({ unique: true, nullable: true })
  cognito_sub: string;

  @Column({ nullable: true })
  first_name: string;

  @Column({ nullable: true })
  last_name: string;

  @Exclude()
  @Column({ type: 'text', nullable: true })
  mnemonic: string;

  @Column({ type: 'enum', enum: ['pending', 'processing', 'created'], default: 'pending' })
  status: 'pending' | 'processing' | 'created';

  @Column({ nullable: true })
  publicKey: string;

  @Column({ type: 'boolean', nullable: true })
  marketing_consent: boolean | null;

  @Column({ type: 'timestamp', nullable: true })
  marketing_consent_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn({ nullable: true })
  deleted_at: Date | null;
}
