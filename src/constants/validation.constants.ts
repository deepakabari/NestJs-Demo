export const ValidationMessages = {
  email: {
    required: 'Email is required.',
    invalid: 'Invalid email format.',
  },
  password: {
    required: 'Password is required.',
    type: 'Password must be a string.',
    minLength: 'Password must be at least 8 characters long.',
    complexity:
      'Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.',
  },
  name: {
    required: 'Product name is required.',
    type: 'Product name must be a string.',
  },
  description: {
    required: 'Product description is required.',
    type: 'Product description must be a string.',
  },
  price: {
    required: 'Product price is required.',
    type: 'Product price must be a number.',
    min: 'Product price must be at least 0.',
  },
};
