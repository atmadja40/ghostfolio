import { ActivitiesModule } from '@ghostfolio/api/app/activities/activities.module';
import { ImportModule } from '@ghostfolio/api/app/import/import.module';
import { PortfolioModule } from '@ghostfolio/api/app/portfolio/portfolio.module';
import { UserModule } from '@ghostfolio/api/app/user/user.module';
import { UserService } from '@ghostfolio/api/app/user/user.service';
import { ConfigurationModule } from '@ghostfolio/api/services/configuration/configuration.module';
import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';
import { PrismaModule } from '@ghostfolio/api/services/prisma/prisma.module';
import { PropertyModule } from '@ghostfolio/api/services/property/property.module';
import { PropertyService } from '@ghostfolio/api/services/property/property.service';
import { DataGatheringQueueModule } from '@ghostfolio/api/services/queues/data-gathering/data-gathering.module';
import { DataGatheringService } from '@ghostfolio/api/services/queues/data-gathering/data-gathering.service';
import { StatisticsGatheringQueueModule } from '@ghostfolio/api/services/queues/statistics-gathering/statistics-gathering.module';
import { StatisticsGatheringService } from '@ghostfolio/api/services/queues/statistics-gathering/statistics-gathering.service';
import { TwitterBotModule } from '@ghostfolio/api/services/twitter-bot/twitter-bot.module';
import { TwitterBotService } from '@ghostfolio/api/services/twitter-bot/twitter-bot.service';

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
