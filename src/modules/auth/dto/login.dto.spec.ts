import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginDto } from './login.dto';

/** Helper: transforms a plain object into a LoginDto instance and validates it. */
const toDto = (plain: Record<string, unknown>) => plainToInstance(LoginDto, plain);

describe('LoginDto', () => {
  describe('email field', () => {
    it('should pass with a valid email', async () => {
      const errors = await validate(toDto({ email: 'user@test.com', password: 'secret123' }));
      expect(errors).toHaveLength(0);
    });

    it('should fail when email is missing', async () => {
      const errors = await validate(toDto({ password: 'secret123' }));
      const emailError = errors.find((e) => e.property === 'email');
      expect(emailError).toBeDefined();
    });

    it('should fail when email is an invalid format', async () => {
      const errors = await validate(toDto({ email: 'not-an-email', password: 'secret123' }));
      const emailError = errors.find((e) => e.property === 'email');
      expect(emailError).toBeDefined();
      expect(emailError?.constraints).toHaveProperty('isEmail');
    });

    it('should fail when email is an empty string', async () => {
      const errors = await validate(toDto({ email: '', password: 'secret123' }));
      const emailError = errors.find((e) => e.property === 'email');
      expect(emailError).toBeDefined();
    });
  });

  describe('password field', () => {
    it('should fail when password is missing', async () => {
      const errors = await validate(toDto({ email: 'user@test.com' }));
      const pwError = errors.find((e) => e.property === 'password');
      expect(pwError).toBeDefined();
    });

    it('should fail when password is shorter than 6 characters', async () => {
      const errors = await validate(toDto({ email: 'user@test.com', password: '123' }));
      const pwError = errors.find((e) => e.property === 'password');
      expect(pwError).toBeDefined();
      expect(pwError?.constraints).toHaveProperty('minLength');
      const messages = Object.values(pwError?.constraints ?? {});
      expect(messages).toContain('Password must be at least 6 characters long');
    });

    it('should pass when password is exactly 6 characters', async () => {
      const errors = await validate(toDto({ email: 'user@test.com', password: '123456' }));
      expect(errors).toHaveLength(0);
    });
  });

  it('should fail when both fields are missing', async () => {
    const errors = await validate(toDto({}));
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});
