export const messages = {
  SUCCESS: 'Success',
  INTERNAL_SERVER_ERROR: 'An internal server error occurred.',
  JWT_SECRET_NOT_FOUND: 'JWT_SECRET is not defined in environment',
  ACCESS_DENIED: 'You do not have permission to perform this action.',
  PASSWORD_DOES_NOT_MATCH: 'Password and confirm password do not match.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  DUPLICATE_EMAIL:
    'An account with this email already exists. Please use a different email or login instead.',
  USER_NOT_FOUND: 'User not found.',

  // Cognito Auth Messages
  COGNITO_SIGNUP_SUCCESS:
    'User registered successfully. Please check your email for the verification code.',
  COGNITO_CONFIRM_SUCCESS: 'Email verified successfully. You can now log in.',
  COGNITO_AUTH_FAILED: 'Authentication failed. Please check your credentials.',
  COGNITO_TOKEN_VALID: 'Access token is valid.',
  COGNITO_TOKEN_INVALID: 'Access token is invalid or expired.',
  COGNITO_TOKEN_MISSING: 'Authorization header with Bearer token is required.',
  COGNITO_USER_EXISTS: 'An account with this email already exists.',
  COGNITO_USER_NOT_FOUND: 'No account found with this email address.',
  COGNITO_NOT_AUTHORIZED: 'Invalid email or password.',
  COGNITO_CODE_MISMATCH: 'Invalid verification code. Please try again.',
  COGNITO_CODE_EXPIRED: 'Verification code has expired. Please request a new one.',
  COGNITO_USER_NOT_CONFIRMED:
    'Your account has not been verified. Please check your email for the verification code.',
  COGNITO_INVALID_PASSWORD:
    'Password does not meet the requirements. It must be at least 8 characters with uppercase, lowercase, numbers, and special characters.',
  COGNITO_TOO_MANY_REQUESTS: 'Too many requests. Please wait a moment and try again.',
  COGNITO_PASSWORD_RESET_CODE_SENT: 'Password reset code sent to your email.',
  COGNITO_PASSWORD_RESET_SUCCESS: 'Password has been reset successfully.',
  COGNITO_CODE_RESENT: 'Confirmation code resent successfully.',

  // Encryption Messages
  ENCRYPTION_CONFIG_MISSING: 'Neither AWS_SECRET_NAME nor ENCRYPTION_KEY is defined',
  ENCRYPTION_SECRET_EMPTY: 'Encryption secret exists but has no value.',
  ENCRYPTION_KEY_NOT_FOUND: 'Encryption key not found in secret JSON structure.',
  AWS_SECRET_FETCH_ERROR: 'Error fetching secret from AWS.',
};
