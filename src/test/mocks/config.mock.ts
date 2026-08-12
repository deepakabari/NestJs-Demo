/**
 * Mock for @nestjs/config ConfigService.
 * Add any env vars your tests depend on to the `config` map below.
 * Import this in any spec file that injects ConfigService.
 */
const config: Record<string, string> = {
  JWT_SECRET: 'test-secret',
  RUN_CRONS: 'false',
};

export const mockConfigService = {
  get: jest.fn((key: string): string | undefined => config[key]),
  getOrThrow: jest.fn((key: string): string => {
    const value = config[key];
    if (!value) throw new Error(`Config key "${key}" not found in test config`);
    return value;
  }),
};
