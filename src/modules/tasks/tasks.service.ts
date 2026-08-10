import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private eventsGateway: EventsGateway,
  ) {}

  // @Cron('0 0 * * * *') // Every hour
  @Cron('*/10 * * * * *') // Every 10 seconds
  async handlePendingUsers() {
    this.logger.debug('Running cron to process pending users');

    try {
      const users = await this.userRepository.find({
        where: {
          status: 'pending',
          publicKey: IsNull(),
        },
        order: {
          id: 'ASC',
        },
        take: 25,
      });

      if (!users?.length) {
        return;
      }

      const userIds = users.map((u) => u.id);
      this.logger.debug(`Processing IDs: ${JSON.stringify(userIds)}`);

      // Claim users by setting status to 'processing'
      await this.userRepository.update({ id: In(userIds) }, { status: 'processing' });

      this.logger.debug(`Found ${users.length} pending users. Claimed & updated to 'processing'.`);

      // Process users asynchronously so next cron can run without waiting
      this.processUsersAsync(users).catch((error) => {
        this.logger.error('Error processing users asynchronously', error);
      });
    } catch (error) {
      this.logger.error('Error in handlePendingUsers cron', error);
    }
  }

  private async processUsersAsync(users: User[]) {
    try {
      // 1. Prepare data (synchronous map, no database calls)
      const updatedUsers = users.map((user) => {
        user.status = 'created';
        user.publicKey = `fake-key-${user.id}`;
        return user;
      });

      // 2. Execute a single bulk save operation (most efficient Repository API method)
      await this.userRepository.save(updatedUsers);

      this.logger.debug(`Successfully generated keys and updated ${users.length} users`);

      // 3. Emit WebSocket events (synchronous functional iteration)
      updatedUsers.forEach((user) => {
        this.eventsGateway.notifyUserStatusUpdated(user.id, 'created', user.publicKey);
      });
    } catch (error) {
      this.logger.error('Failed to process batch of users', error);
    }
  }
}
