import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';
import { ValidationMessages } from '../../../constants/validation.constants';

const toDto = (plain: Record<string, unknown>) => plainToInstance(CreateUserDto, plain);

describe('CreateUserDto', () => {
  describe('email field', () => {
    it('should pass with a valid email', async () => {
      const errors = await validate(toDto({ email: 'user@test.com' }));
      expect(errors).toHaveLength(0);
    });

    it('should fail when email is missing — uses custom required message', async () => {
      const errors = await validate(toDto({}));
      const emailError = errors.find((e) => e.property === 'email');
      expect(emailError).toBeDefined();
      const messages = Object.values(emailError?.constraints ?? {});
      expect(messages).toContain(ValidationMessages.email.required);
    });

    it('should fail when email has an invalid format', async () => {
      const errors = await validate(toDto({ email: 'bad-format' }));
      const emailError = errors.find((e) => e.property === 'email');
      expect(emailError).toBeDefined();
      expect(emailError?.constraints).toHaveProperty('isEmail');
    });
  });

  describe('optional name fields', () => {
    it('should pass when first_name and last_name are strings', async () => {
      const errors = await validate(
        toDto({ email: 'user@test.com', first_name: 'Jane', last_name: 'Doe' }),
      );
      expect(errors).toHaveLength(0);
    });

    it('should pass when optional fields are absent', async () => {
      const errors = await validate(toDto({ email: 'user@test.com' }));
      expect(errors).toHaveLength(0);
    });

    it('should fail when first_name is a number', async () => {
      const errors = await validate(toDto({ email: 'user@test.com', first_name: 42 }));
      const nameError = errors.find((e) => e.property === 'first_name');
      expect(nameError).toBeDefined();
      expect(nameError?.constraints).toHaveProperty('isString');
    });
  });
});
