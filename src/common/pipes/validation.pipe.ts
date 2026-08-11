import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

@Injectable()
export class ValidationPipe implements PipeTransform<unknown> {
  async transform(value: unknown, { metatype }: ArgumentMetadata): Promise<unknown> {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype, value);
    const errors: ValidationError[] = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: true,
    });

    if (errors.length > 0) {
      throw new BadRequestException(this.getFirstError(errors));
    }
    return object;
  }

  private toValidate(metatype: unknown): metatype is new (...args: unknown[]) => object {
    const types: unknown[] = [String, Boolean, Number, Array, Object];
    return typeof metatype === 'function' && !types.includes(metatype);
  }

  private getFirstError(errors: ValidationError[]): string {
    const error = errors[0];

    if (error.constraints) {
      const constraintKeys = Object.keys(error.constraints);
      if (constraintKeys.length > 0) {
        return error.constraints[constraintKeys[0]];
      }
    }

    if (error.children && error.children.length > 0) {
      return this.getFirstError(error.children);
    }

    return 'Validation failed';
  }
}
