import type { User } from '../../modules/users/entities/user.entity';

/**
 * Factory for creating test User objects.
 * Pass `overrides` to customise individual fields per test case.
 *
 * Example:
 *   createUserFixture({ email: 'other@test.com', id: 99 })
 */
export const createUserFixture = (overrides: Partial<User> = {}): User => ({
  id: 1,
  email: 'test@example.com',
  password: '$2b$10$hashedpassword',
  first_name: 'Test',
  last_name: 'User',
  created_at: new Date('2024-01-01T00:00:00.000Z'),
  updated_at: new Date('2024-01-01T00:00:00.000Z'),
  deleted_at: null,
  ...overrides,
});
