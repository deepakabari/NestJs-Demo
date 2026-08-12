import { BadRequestException } from '@nestjs/common';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { ValidationPipe } from './validation.pipe';

/** Minimal DTO for testing the pipe in isolation */
class TestDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

describe('ValidationPipe', () => {
  let pipe: ValidationPipe;

  beforeEach(() => {
    pipe = new ValidationPipe();
  });

  it('should return the transformed instance when the DTO is valid', async () => {
    const result = await pipe.transform(
      { email: 'user@test.com' },
      { metatype: TestDto, type: 'body', data: '' },
    );
    expect(result).toBeInstanceOf(TestDto);
    expect((result as TestDto).email).toBe('user@test.com');
  });

  it('should throw BadRequestException with the first error message when DTO is invalid', async () => {
    await expect(
      pipe.transform({ email: 'bad-email' }, { metatype: TestDto, type: 'body', data: '' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should return value as-is for primitive types (String)', async () => {
    const result = await pipe.transform('hello', { metatype: String, type: 'body', data: '' });
    expect(result).toBe('hello');
  });

  it('should return value as-is for primitive types (Number)', async () => {
    const result = await pipe.transform(42, { metatype: Number, type: 'body', data: '' });
    expect(result).toBe(42);
  });

  it('should bypass validation for type === "custom" (e.g. @GetUser decorator)', async () => {
    const result = await pipe.transform(
      { id: 1 },
      { metatype: TestDto, type: 'custom', data: 'user' },
    );
    expect(result).toEqual({ id: 1 });
  });

  it('should return value when no metatype is provided', async () => {
    const result = await pipe.transform(
      { email: 'bad' },
      { metatype: undefined, type: 'body', data: '' },
    );
    expect(result).toEqual({ email: 'bad' });
  });

  it('should throw BadRequestException for unknown properties (forbidNonWhitelisted: true)', async () => {
    await expect(
      pipe.transform(
        { email: 'user@test.com', extra_field: 'should-not-exist' },
        { metatype: TestDto, type: 'body', data: '' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should handle nested validation errors and extract the child constraint', () => {
    // We can directly invoke the private getFirstError method for simplicity
    // to test the recursive branch since `class-validator` handles the DTO mapping
    // which requires complex setup to actually hit in unit test without `ValidateNested`.
    const getFirstError = pipe['getFirstError'].bind(pipe);

    const nestedError = {
      property: 'nested',
      children: [
        {
          property: 'email',
          constraints: {
            isEmail: 'email must be an email',
          },
        },
      ],
    };

    expect(getFirstError([nestedError as any])).toBe('email must be an email');
  });

  it('should fallback to default error message if constraints are missing', () => {
    const getFirstError = pipe['getFirstError'].bind(pipe);
    const emptyError = { property: 'empty' };
    expect(getFirstError([emptyError as any])).toBe('Validation failed');
  });

  it('should ignore empty constraints object and fallback', () => {
    const getFirstError = pipe['getFirstError'].bind(pipe);
    const emptyConstraintsError = { property: 'empty', constraints: {} };
    expect(getFirstError([emptyConstraintsError as any])).toBe('Validation failed');
  });
});
