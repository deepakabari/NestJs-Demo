import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { CronService } from './cron.service';
import { ConfigService } from '@nestjs/config';
import { mockConfigService } from '../../test/mocks/config.mock';

describe('CronService', () => {
  let service: CronService;
  let logSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;

  /** Helper to build the service with a specific RUN_CRONS value */
  const buildService = async (runCrons: string) => {
    mockConfigService.get.mockImplementation((key: string) =>
      key === 'RUN_CRONS' ? runCrons : undefined,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [CronService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    return module.get<CronService>(CronService);
  };

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  // ─── constructor ──────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should log that crons are disabled when RUN_CRONS is not "true"', async () => {
      await buildService('false');
      expect(logSpy).toHaveBeenCalledWith(
        'Crons are disabled for this container (RUN_CRONS != true).',
      );
    });

    it('should log that cron jobs are enabled when RUN_CRONS is "true"', async () => {
      await buildService('true');
      expect(logSpy).toHaveBeenCalledWith('Cron jobs ENABLED for this Worker container!');
    });
  });

  // ─── handleMarketCycle ────────────────────────────────────────────────────

  describe('handleMarketCycle()', () => {
    it('should return early without logging when crons are disabled', async () => {
      service = await buildService('false');
      logSpy.mockClear();

      service.handleMarketCycle();

      expect(logSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('should log PRE-MARKET debug message during pre-market window', async () => {
      service = await buildService('true');
      logSpy.mockClear();

      // Simulate minute=4, second=30 → pre-market window (4 % 5 === 4, sec >= 30)
      jest
        .spyOn(global, 'Date')
        .mockImplementation(
          () => ({ getSeconds: () => 30, getMinutes: () => 4 }) as unknown as Date,
        );

      service.handleMarketCycle();

      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('[PRE-MARKET]'));
    });

    it('should log MATCHING ENGINE message during post-market window', async () => {
      service = await buildService('true');
      logSpy.mockClear();

      // Simulate minute=5, second=10 → post-market window (5 % 5 === 0, sec < 15)
      jest
        .spyOn(global, 'Date')
        .mockImplementation(
          () => ({ getSeconds: () => 10, getMinutes: () => 5 }) as unknown as Date,
        );

      service.handleMarketCycle();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[MATCHING ENGINE]'));
    });

    it('should not log anything during idle window', async () => {
      service = await buildService('true');
      logSpy.mockClear();

      // Simulate minute=1, second=20 → idle (1 % 5 === 1, not pre or post market)
      jest
        .spyOn(global, 'Date')
        .mockImplementation(
          () => ({ getSeconds: () => 20, getMinutes: () => 1 }) as unknown as Date,
        );

      service.handleMarketCycle();

      expect(logSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });
  });
});
