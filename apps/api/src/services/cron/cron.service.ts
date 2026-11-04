import { Injectable, Logger, ModuleRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActivitiesService } from '@ghostfolio/api/services/activities/activities.service';
import { AutomatedDividendImportService } from './automated-dividend-import.service';
import { DataGatheringService } from '@ghostfolio/api/services/data-gathering/data-gathering.service';
import { PropertyService } from '@ghostfolio/api/services/property/property.service';
import { StatisticsGatheringService } from '@ghostfolio/api/services/statistics-gathering/statistics-gathering.service';
import { TwitterBotService } from '@ghostfolio/api/services/twitter-bot/twitter-bot.service';
import { UserService } from '@ghostfolio/api/services/user/user.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  public constructor(private readonly moduleRef: ModuleRef) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  public async gatherData() {
    const dataGatheringService = this.moduleRef.get(DataGatheringService, {
      strict: false
    });

    await dataGatheringService.gatherData();
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  public async gatherStatistics() {
    const statisticsGatheringService = this.moduleRef.get(
      StatisticsGatheringService,
      {
        strict: false
      }
    );

    await statisticsGatheringService.gatherStatistics();
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  public async updateProperties() {
    const propertyService = this.moduleRef.get(PropertyService, {
      strict: false
    });

    await propertyService.updateProperties();
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  public async updateTwitterBot() {
    const twitterBotService = this.moduleRef.get(TwitterBotService, {
      strict: false
    });

    await twitterBotService.updateTwitterBot();
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  public async updateUsers() {
    const userService = this.moduleRef.get(UserService, {
      strict: false
    });

    await userService.updateUsers();
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  public async importDividends() {
    try {
      const automatedDividendImportService = await this.moduleRef.resolve(
        AutomatedDividendImportService
      );

      await automatedDividendImportService.importDividendsForAllUsers();
    } catch (error) {
      this.logger.error(
        'Error while importing dividends automatically',
        error instanceof Error ? error.stack : String(error)
      );

      throw error;
    }
  }
}