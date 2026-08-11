import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  private readonly run_crons: boolean;

  constructor(private readonly config_service: ConfigService) {
    // Check if the current container is designated as the Worker container
    this.run_crons = this.config_service.get<string>('RUN_CRONS') === 'true';
    if (!this.run_crons) {
      this.logger.log('Crons are disabled for this container (RUN_CRONS != true).');
    } else {
      this.logger.log('Cron jobs ENABLED for this Worker container!');
    }
  }

  // Master Tick: Runs every second but only executes logic during specific windows
  @Cron('* * * * * *')
  handleMarketCycle() {
    if (!this.run_crons) return; // Safely abort if this is an API web container

    const now = new Date();
    const seconds = now.getSeconds();
    const minutes = now.getMinutes();

    // The market intervals are every 5 minutes (0, 5, 10, 15...)
    const currentMinuteInCycle = minutes % 5;
    
    // T-30s to T=0: PRE-MARKET (Fetch Prices)
    // Happens at minute 4, 9, 14, 19... from second 30 to 59
    const isPreMarket = currentMinuteInCycle === 4 && seconds >= 30;

    // T=0 to T+15s: POST-MARKET (Run Matching Engine)
    // Happens at minute 0, 5, 10, 15... from second 0 to 14
    const isPostMarket = currentMinuteInCycle === 0 && seconds < 15;

    if (isPreMarket) {
      this.logger.debug(`[PRE-MARKET] Fetching latest price from CoinGecko... (T-${60 - seconds}s until match)`);
      // TODO: Fetch price from CoinGecko here
    } else if (isPostMarket) {
      this.logger.log(`[MATCHING ENGINE] Running order matcher... (T+${seconds}s since open)`);
      // TODO: Match buyers and sellers here
    }
    // For the other 4 minutes and 15 seconds, it silently does nothing!
  }
}
