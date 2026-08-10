import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Session entity stores the SHA-256 hashed fingerprint bound to each user session.
 *
 * SECURITY RATIONALE:
 * - Even if an attacker steals the HttpOnly access_token cookie (e.g., via a
 *   man-in-the-middle on a misconfigured proxy), they cannot forge requests
 *   without also possessing the matching fingerprint cookie.
 * - The fingerprint is stored as a SHA-256 hash in the database so that a
 *   database compromise does not directly expose raw fingerprints.
 * - One row per active session allows immediate server-side revocation on logout.
 */
@Entity('sessions')
@Index(['cognito_sub'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Cognito user identifier — links session to a specific user */
  @Column()
  cognito_sub: string;

  /**
   * SHA-256 hash of the raw fingerprint.
   * The raw fingerprint is only stored in the client's HttpOnly cookie,
   * never persisted server-side.
   */
  @Column()
  fingerprint_hash: string;

  /** Optional: store user_id for faster local joins */
  @Column({ nullable: true })
  user_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
