/**
 * Mock for @nestjs/jwt JwtService.
 * Import this in auth.service.spec.ts and auth guard/strategy tests.
 */
export const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-access-token'),
  verify: jest.fn(),
  decode: jest.fn(),
};
