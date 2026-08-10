import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { Session } from './entities/session.entity';

/**
 * SessionService manages the lifecycle of fingerprint-bound sessions.
 *
 * Each login creates a session record with a SHA-256 hash of a random
 * 32-byte fingerprint. The raw fingerprint travels only in an HttpOnly
 * cookie; the server never stores it in plaintext.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @InjectRepository(Session)
    private readonly session_repository: Repository<Session>,
  ) {}

  /**
   * Generate a cryptographically random 32-byte fingerprint.
   *
   * WHY 32 BYTES: Matches the entropy of a 256-bit key, making brute-force
   * infeasible even if an attacker knows the hashing algorithm.
   *
   * @returns Hex-encoded fingerprint string (64 characters)
   */
  generateFingerprint(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Compute the SHA-256 hash of a raw fingerprint.
   *
   * WHY SHA-256: Fast, deterministic, and collision-resistant. We don't need
   * bcrypt's slowness here because the input (32 random bytes) already has
   * sufficient entropy — brute-force is impractical regardless of hash speed.
   *
   * @param raw_fingerprint - The raw fingerprint string
   * @returns SHA-256 hex digest
   */
  hashFingerprint(raw_fingerprint: string): string {
    return createHash('sha256').update(raw_fingerprint).digest('hex');
  }

  /**
   * Create a new session record after successful authentication.
   *
   * @param cognito_sub - The Cognito user identifier
   * @param fingerprint_hash - SHA-256 hash of the raw fingerprint
   * @param user_id - Optional local user ID for faster lookups
   * @returns The created session entity
   */
  async createSession(
    cognito_sub: string,
    fingerprint_hash: string,
    user_id?: string,
  ): Promise<Session> {
    const session = this.session_repository.create({
      cognito_sub,
      fingerprint_hash,
      user_id,
    });

    this.logger.log(`Session created for cognito_sub: ${cognito_sub}`);
    return this.session_repository.save(session);
  }

  /**
   * Validate that the provided fingerprint matches the stored hash for the user.
   *
   * SECURITY: This is called on every protected request to ensure the
   * cookie-bearer is the same client that originally authenticated.
   *
   * @param cognito_sub - The Cognito user identifier from the JWT
   * @param raw_fingerprint - The raw fingerprint from the cookie
   * @returns true if a matching session exists, false otherwise
   */
  async validateFingerprint(cognito_sub: string, raw_fingerprint: string): Promise<boolean> {
    const fingerprint_hash = this.hashFingerprint(raw_fingerprint);

    const session = await this.session_repository.findOneBy({
      cognito_sub,
      fingerprint_hash,
    });

    return !!session;
  }

  /**
   * Delete all sessions for a given user (used during logout).
   *
   * WHY DELETE ALL: Ensures that even if multiple cookies leaked,
   * none of them remain valid after an explicit logout.
   *
   * @param cognito_sub - The Cognito user identifier
   */
  async deleteSessionsBySub(cognito_sub: string): Promise<void> {
    const result = await this.session_repository.delete({ cognito_sub });
    this.logger.log(
      `Deleted ${result.affected} session(s) for cognito_sub: ${cognito_sub}`,
    );
  }

  /**
   * Delete a specific session by its fingerprint hash (used during refresh rotation).
   *
   * @param cognito_sub - The Cognito user identifier
   * @param raw_fingerprint - The raw fingerprint to remove
   */
  async deleteSessionByFingerprint(
    cognito_sub: string,
    raw_fingerprint: string,
  ): Promise<void> {
    const fingerprint_hash = this.hashFingerprint(raw_fingerprint);
    await this.session_repository.delete({ cognito_sub, fingerprint_hash });
  }
}
