import { UserService } from '@ghostfolio/api/app/user/user.service';
import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';
import { PropertyService } from '@ghostfolio/api/services/property/property.service';
import { DataGatheringService } from '@ghostfolio/api/services/queues/data-gathering/data-gathering.service';
import { StatisticsGatheringService } from '@ghostfolio/api/services/queues/statistics-gathering/statistics-gathering.service';
import { TwitterBotService } from '@ghostfolio/api/services/twitter-bot/twitter-bot.service';
import {
  DATA_GATHERING_QUEUE_PRIORITY_LOW,
  GATHER_ASSET_PROFILE_PROCESS_JOB_NAME,
  GATHER_ASSET_PROFILE_PROCESS_JOB_OPTIONS,
  PROPERTY_IS_DATA_GATHERING_ENABLED
} from '@ghostfolio/common/config';
import { getAssetProfileIdentifier } from '@ghostfolio/common/helper';

import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AutomatedDividendImportService } from './automated-dividend-import.service';

@Injectable()
export class CronService {
  private static readonly EVERY_HOUR_AT_RANDOM_MINUTE = `${new Date().getMinutes()} * * * *`;
  private static readonly EVERY_SUNDAY_AT_LUNCH_TIME = '0 12 * * 0';

  public constructor(private readonly moduleRef: ModuleRef) {
    console.log('CronService initialized');
  }

  @Cron(CronExpression.EVERY_HOUR)
  public async runEveryHour() {
    const configurationService = this.moduleRef.get(ConfigurationService, {
      strict: false
    });
    const statisticsGatheringService = this.moduleRef.get(
      StatisticsGatheringService,
      {
        strict: false
      }
    );

    if (configurationService.get('ENABLE_FEATURE_STATISTICS')) {
      await statisticsGatheringService.addJobsToQueue();
    }
  }

  @Cron(CronService.EVERY_HOUR_AT_RANDOM_MINUTE)
  public async runEveryHourAtRandomMinute() {
    const dataGatheringService = this.moduleRef.get(DataGatheringService, {
      strict: false
    });

    if (await this.isDataGatheringEnabled()) {
      await dataGatheringService.gatherHourlyMarketData();
      await dataGatheringService.gatherRecentMarketData();
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_5PM)
  public async runEveryDayAtFivePm() {
    const configurationService = this.moduleRef.get(ConfigurationService, {
      strict: false
    });
    const twitterBotService = this.moduleRef.get(TwitterBotService, {
      strict: false
    });

    if (configurationService.get('ENABLE_FEATURE_SUBSCRIPTION')) {
      twitterBotService.tweetFearAndGreedIndex();
    }
  }

  // @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  // public async runEveryDayAtMidnight() {
  //   if (this.configurationService.get('ENABLE_FEATURE_SUBSCRIPTION')) {
  //     this.userService.resetAnalytics();
  //   }

  //   await this.automatedDividendImportService.importDividendsForAllUsers();
  // }

  @Cron(CronExpression.EVERY_MINUTE)
  public async runAutomatedDividendImportEveryMinute() {
    console.log('CRON: Starting automated dividend import');

    const configurationService = this.moduleRef.get(ConfigurationService, {
      strict: false
    });
    const userService = this.moduleRef.get(UserService, {
      strict: false
    });
    const automatedDividendImportService = await this.moduleRef.resolve(
      AutomatedDividendImportService
    );

    if (configurationService.get('ENABLE_FEATURE_SUBSCRIPTION')) {
      await userService.resetAnalytics();
    }

    try {
      const result =
        await automatedDividendImportService.importDividendsForAllUsers();

      console.log(
        `CRON: Automated dividend import finished. ${result} dividends imported`
      );
    } catch (error) {
      console.error(
        'CRON: Automated dividend import failed',
        error
      );
    }
  }

  @Cron(CronService.EVERY_SUNDAY_AT_LUNCH_TIME)
  public async runEverySundayAtTwelvePm() {
    const dataGatheringService = this.moduleRef.get(DataGatheringService, {
      strict: false
    });

    if (await this.isDataGatheringEnabled()) {
      const assetProfileIdentifiers =
        await dataGatheringService.getActiveAssetProfileIdentifiers({
          maxAge: '60 days'
        });

      await dataGatheringService.addJobsToQueue(
        assetProfileIdentifiers.map(({ dataSource, symbol }) => {
          return {
            data: {
              dataSource,
              symbol
            },
            name: GATHER_ASSET_PROFILE_PROCESS_JOB_NAME,
            opts: {
              ...GATHER_ASSET_PROFILE_PROCESS_JOB_OPTIONS,
              jobId: getAssetProfileIdentifier({ dataSource, symbol }),
              priority: DATA_GATHERING_QUEUE_PRIORITY_LOW
            }
          };
        })
      );
    }
  }

  private async isDataGatheringEnabled() {
    const propertyService = this.moduleRef.get(PropertyService, {
      strict: false
    });

    return (await propertyService.getByKey(
      PROPERTY_IS_DATA_GATHERING_ENABLED
    )) === false
      ? false
      : true;
  }
}
