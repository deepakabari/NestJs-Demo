import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SignupDto } from './signup.dto';

const toDto = (plain: Record<string, unknown>) => plainToInstance(SignupDto, plain);

describe('SignupDto', () => {
  describe('email field', () => {
    it('should pass with a valid email and password', async () => {
      const errors = await validate(toDto({ email: 'user@test.com', password: 'secret123' }));
      expect(errors).toHaveLength(0);
    });

    it('should fail when email is missing', async () => {
      const errors = await validate(toDto({ password: 'secret123' }));
      const emailError = errors.find((e) => e.property === 'email');
      expect(emailError).toBeDefined();
    });

    it('should fail when email is an invalid format', async () => {
      const errors = await validate(toDto({ email: 'bad-email', password: 'secret123' }));
      const emailError = errors.find((e) => e.property === 'email');
      expect(emailError).toBeDefined();
      expect(emailError?.constraints).toHaveProperty('isEmail');
    });
  });

  describe('password field', () => {
    it('should fail when password is too short', async () => {
      const errors = await validate(toDto({ email: 'user@test.com', password: 'abc' }));
      const pwError = errors.find((e) => e.property === 'password');
      expect(pwError).toBeDefined();
      const messages = Object.values(pwError?.constraints ?? {});
      expect(messages).toContain('Password must be at least 6 characters long');
    });

    it('should fail when password is missing', async () => {
      const errors = await validate(toDto({ email: 'user@test.com' }));
      const pwError = errors.find((e) => e.property === 'password');
      expect(pwError).toBeDefined();
    });
  });

  describe('optional fields', () => {
    it('should pass without first_name and last_name', async () => {
      const errors = await validate(toDto({ email: 'user@test.com', password: 'secret123' }));
      expect(errors).toHaveLength(0);
    });

    it('should pass with first_name and last_name provided', async () => {
      const errors = await validate(
        toDto({
          email: 'user@test.com',
          password: 'secret123',
          first_name: 'John',
          last_name: 'Doe',
        }),
      );
      expect(errors).toHaveLength(0);
    });
  });
});
