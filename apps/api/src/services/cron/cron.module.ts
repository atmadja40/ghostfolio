
import { ActivitiesModule } from '@ghostfolio/api/services/activities/activities.module';
import { ImportModule } from '@ghostfolio/api/services/import/import.module';
import { PortfolioModule } from '@ghostfolio/api/app/portfolio/portfolio.module';
import { ConfigurationModule } from '@ghostfolio/api/services/configuration/configuration.module';
import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';
import { PrismaModule } from '@ghostfolio/api/services/prisma/prisma.module';
import { PropertyModule } from '@ghostfolio/api/services/property/property.module';
import { DataGatheringQueueModule } from '@ghostfolio/api/services/queues/data-gathering/data-gathering.module';
import { StatisticsGatheringQueueModule } from '@ghostfolio/api/services/queues/statistics-gathering/statistics-gathering.module';
import { TwitterBotModule } from '@ghostfolio/api/services/twitter-bot/twitter-bot.module';
import { UserModule } from '@ghostfolio/api/services/user/user.module';

import { Logger, Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { AutomatedDividendImportService } from './automated-dividend-import.service';
import { CronService } from './cron.service';

@Module({
  imports: [
    ActivitiesModule,
    ConfigurationModule,
    DataGatheringQueueModule,
    ImportModule,
    PortfolioModule,
    PrismaModule,
    PropertyModule,
    StatisticsGatheringQueueModule,
    TwitterBotModule,
    UserModule
  ],
  providers: [
    AutomatedDividendImportService,
    {
      provide: CronService,
      inject: [ConfigurationService, ModuleRef],
      useFactory: (
        configurationService: ConfigurationService,
        moduleRef: ModuleRef
      ) => {
        if (!configurationService.get('ENABLE_FEATURE_CRON')) {
          Logger.log(
            'Scheduled cron jobs are disabled',
            CronService.name
          );
          return null;
        }

        return new CronService(moduleRef);
      }
    }
  ]
})
export class CronModule {}
