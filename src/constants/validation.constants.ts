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
  firstName: {
    required: 'First name is required.',
    type: 'First name must be a string.',
  },
  lastName: {
    required: 'Last name is required.',
    type: 'Last name must be a string.',
  },
};
