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

  // Example: High-frequency polling (runs every second)
  @Cron('* * * * * *')
  handlePriceFetch() {
    if (!this.run_crons) return; // Safely abort if this is an API web container

    // 1. Check if we are inside the pre-market window (e.g. 11:59:30 - 12:00:00)
    // 2. Fetch price from CoinGecko
    this.logger.debug(`[${new Date().toISOString()}] Fetching latest price from CoinGecko...`);
  }

  // Example: Matching Engine runner
  @Cron('*/5 * * * * *') // Changed to every 5 seconds just for testing visibility
  handleMatchingEngine() {
    if (!this.run_crons) return;

    this.logger.log(`[${new Date().toISOString()}] Starting Matching Engine...`);
    // 1. Create Idempotency Audit Log in DB
    // 2. Fetch pending orders FOR UPDATE
    // 3. Match buyers and sellers
  }
}
