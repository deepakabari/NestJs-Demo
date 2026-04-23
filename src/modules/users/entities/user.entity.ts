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
  emailHash: string;

  @Column({ transformer: new EncryptionTransformer() })
  email: string;

  @Column({ unique: true, nullable: true })
  cognitoSub: string;

  @Column({ nullable: true, transformer: new EncryptionTransformer() })
  firstName: string;

  @Column({ nullable: true, transformer: new EncryptionTransformer() })
  lastName: string;

  @Exclude()
  @Column({ type: 'text', nullable: true })
  mnemonic: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;
}
