import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function Match(property: string, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'match',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const relatedPropertyName = args.constraints?.[0] as string;
          const relatedValue = (args.object as Record<string, unknown>)[relatedPropertyName];
          return value === relatedValue;
        },
      },
    });
  };
}
