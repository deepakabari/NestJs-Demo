import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity'; // Adjust path if necessary
// import { Asset } from '../../assets/entities/asset.entity'; // Assuming this exists

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PROCESSING = 'PROCESSING',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  client_request_id: string;

  @Column({ type: 'uuid' })
  sender_user_id: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sender_user_id' })
  sender_user: User;

  @Column({ type: 'uuid' })
  receiver_user_id: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'receiver_user_id' })
  receiver_user: User;

  @Column({ type: 'uuid' })
  asset_id: string;

  // Assuming Asset entity exists. If not, just the column will suffice for the DB schema until the relation is created.
  // @ManyToOne(() => Asset, { onDelete: 'RESTRICT' })
  // @JoinColumn({ name: 'asset_id' })
  // asset: Asset;
  // I will add a generic 'any' relation here to make the find() query work without the actual Asset entity file, but you should replace 'any' with Asset
  @ManyToOne('Asset', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'asset_id' })
  asset: any;

  @Column({ type: 'numeric', precision: 20, scale: 7 })
  amount: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ type: 'text', unique: true, nullable: true })
  transaction_hash: string;

  @Column({ type: 'text', nullable: true })
  last_error_code: string;

  @Column({ type: 'text', nullable: true })
  last_error_message: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
