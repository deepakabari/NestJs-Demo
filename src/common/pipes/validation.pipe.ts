import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

@Injectable()
export class ValidationPipe implements PipeTransform<unknown> {
  async transform(value: unknown, { metatype }: ArgumentMetadata): Promise<unknown> {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype, value as Record<string, unknown>);
    const errors: ValidationError[] = await validate(object);

    if (errors.length > 0) {
      throw new BadRequestException(this.formatErrors(errors));
    }
    return value;
  }

  private toValidate(metatype: unknown): metatype is new (...args: unknown[]) => object {
    const types: unknown[] = [String, Boolean, Number, Array, Object];
    return typeof metatype === 'function' && !types.includes(metatype);
  }

  private formatErrors(errors: ValidationError[]): unknown[] {
    return errors.map((error) => {
      const constraints = error.constraints ? Object.values(error.constraints) : [];

      if (error.children?.length) {
        return {
          property: error.property,
          constraints,
          children: this.formatErrors(error.children),
        };
      }

      return {
        property: error.property,
        constraints,
      };
    });
  }
}
