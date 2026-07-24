import { ActivitiesModule } from '@ghostfolio/api/app/activities/activities.module';
import { ImportModule } from '@ghostfolio/api/app/import/import.module';
import { PortfolioModule } from '@ghostfolio/api/app/portfolio/portfolio.module';
import { UserModule } from '@ghostfolio/api/app/user/user.module';
import { ConfigurationModule } from '@ghostfolio/api/services/configuration/configuration.module';
import { PrismaModule } from '@ghostfolio/api/services/prisma/prisma.module';
import { PropertyModule } from '@ghostfolio/api/services/property/property.module';
import { DataGatheringQueueModule } from '@ghostfolio/api/services/queues/data-gathering/data-gathering.module';
import { StatisticsGatheringQueueModule } from '@ghostfolio/api/services/queues/statistics-gathering/statistics-gathering.module';
import { TwitterBotModule } from '@ghostfolio/api/services/twitter-bot/twitter-bot.module';

import { Module } from '@nestjs/common';

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
  providers: [AutomatedDividendImportService, CronService]
})
export class CronModule {}
