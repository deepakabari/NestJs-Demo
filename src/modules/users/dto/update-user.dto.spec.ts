import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateUserDto } from './update-user.dto';

const toDto = (plain: Record<string, unknown>) => plainToInstance(UpdateUserDto, plain);

describe('UpdateUserDto', () => {
  it('should pass with an empty object — all fields are optional', async () => {
    const errors = await validate(toDto({}));
    expect(errors).toHaveLength(0);
  });

  describe('email field', () => {
    it('should pass with a valid email', async () => {
      const errors = await validate(toDto({ email: 'updated@test.com' }));
      expect(errors).toHaveLength(0);
    });

    it('should fail when email is an invalid format', async () => {
      const errors = await validate(toDto({ email: 'not-an-email' }));
      const emailError = errors.find((e) => e.property === 'email');
      expect(emailError).toBeDefined();
      expect(emailError?.constraints).toHaveProperty('isEmail');
    });
  });

  describe('name fields', () => {
    it('should pass with valid string names', async () => {
      const errors = await validate(toDto({ first_name: 'Jane', last_name: 'Doe' }));
      expect(errors).toHaveLength(0);
    });

    it('should fail when first_name is not a string', async () => {
      const errors = await validate(toDto({ first_name: 123 }));
      const nameError = errors.find((e) => e.property === 'first_name');
      expect(nameError).toBeDefined();
      expect(nameError?.constraints).toHaveProperty('isString');
    });

    it('should fail when last_name is not a string', async () => {
      const errors = await validate(toDto({ last_name: true }));
      const nameError = errors.find((e) => e.property === 'last_name');
      expect(nameError).toBeDefined();
      expect(nameError?.constraints).toHaveProperty('isString');
    });
  });
});
