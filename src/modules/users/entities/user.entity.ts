import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EncryptionTransformer } from '../../encryption/encryption.transformer';
import { Exclude } from 'class-transformer';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'email_hash', unique: true, select: false })
  email_hash: string;

  @Column({ transformer: new EncryptionTransformer() })
  email: string;

  @Column({ unique: true, nullable: true })
  cognito_sub: string;

  @Column({ nullable: true, transformer: new EncryptionTransformer() })
  first_name: string;

  @Column({ nullable: true, transformer: new EncryptionTransformer() })
  last_name: string;

  @Exclude()
  @Column({ type: 'text', nullable: true })
  mnemonic: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn({ nullable: true })
  deleted_at: Date | null;
}
