import { ActivitiesService } from '@ghostfolio/api/app/activities/activities.service';
import { ImportService } from '@ghostfolio/api/app/import/import.service';
import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { PropertyService } from '@ghostfolio/api/services/property/property.service';
import {
  DEFAULT_CURRENCY,
  PROPERTY_IS_READ_ONLY_MODE
} from '@ghostfolio/common/config';
import { UserSettings } from '@ghostfolio/common/interfaces';

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AutomatedDividendImportService {
  private readonly logger = new Logger(AutomatedDividendImportService.name);

  public constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly importService: ImportService,
    private readonly portfolioService: PortfolioService,
    private readonly prismaService: PrismaService,
    private readonly propertyService: PropertyService
  ) {}

  public async importDividendsForAllUsers(): Promise<number> {
    const isReadOnlyMode =
      (await this.propertyService.getByKey(PROPERTY_IS_READ_ONLY_MODE)) ===
      true;

    if (isReadOnlyMode) {
      this.logger.log(
        'Read-only mode is enabled. Skipping automated dividend import.'
      );
      return 0;
    }

    let holdingsWithoutAssetProfile = 0;
    let totalCandidateDividends = 0;
    let totalDuplicateDividends = 0;
    let totalHoldings = 0;
    let totalImportedDividends = 0;
    let totalInvalidDividends = 0;
    let totalUsers = 0;

    try {
      const users = await this.prismaService.user.findMany({
        select: {
          id: true
        }
      });

      totalUsers = users.length;

      for (const user of users) {
        const accounts = await this.prismaService.account.findMany({
          select: { id: true },
          where: { userId: user.id }
        });

        if (!accounts || accounts.length === 0) {
          continue;
        }

        const settingsRecord = await this.prismaService.settings.findUnique({
          where: { userId: user.id }
        });

        const userCurrency =
          (settingsRecord?.settings as UserSettings)?.baseCurrency ??
          DEFAULT_CURRENCY;

        try {
          const holdings = await this.portfolioService.getHoldings({
            dateRange: 'max',
            userId: user.id
          });

          totalHoldings += holdings.length;

          for (const holding of holdings) {
            const { dataSource, symbol } = holding.assetProfile ?? {};
            if (!dataSource || !symbol) {
              holdingsWithoutAssetProfile++;
              continue;
            }

            const candidateDividends = await this.importService.getDividends({
              dataSource,
              symbol,
              userCurrency,
              userId: user.id
            });

            totalCandidateDividends += candidateDividends.length;

            for (const dividendActivity of candidateDividends) {
              if (dividendActivity.error) {
                totalDuplicateDividends++;
                continue;
              }

              if (dividendActivity.quantity <= 0) {
                totalInvalidDividends++;
                continue;
              }

              const accountId = dividendActivity.accountId ?? accounts[0]?.id;

              if (!accountId) {
                continue;
              }

              await this.activitiesService.createActivity({
                accountId,
                comment: 'Automated Dividend Import',
                currency: dividendActivity.assetProfile.currency,
                date: dividendActivity.date,
                fee: dividendActivity.fee ?? 0,
                quantity: dividendActivity.quantity,
                type: 'DIVIDEND',
                unitPrice: dividendActivity.unitPrice,
                SymbolProfile: {
                  connectOrCreate: {
                    create: {
                      currency: dividendActivity.assetProfile.currency,
                      dataSource: dividendActivity.assetProfile.dataSource,
                      name: dividendActivity.assetProfile.name,
                      symbol: dividendActivity.assetProfile.symbol,
                      userId:
                        dividendActivity.assetProfile.dataSource === 'MANUAL'
                          ? user.id
                          : undefined
                    },
                    where: {
                      dataSource_symbol: {
                        dataSource: dividendActivity.assetProfile.dataSource,
                        symbol: dividendActivity.assetProfile.symbol
                      }
                    }
                  }
                },
                tags: [],
                updateAccountBalance: false,
                user: { connect: { id: user.id } },
                userId: user.id
              });

              totalImportedDividends++;
            }
          }
        } catch (error) {
          this.logger.error(
            `Error importing dividends for user ${user.id}: ${error?.message || error}`,
            error?.stack
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error running automated dividend import: ${error?.message || error}`,
        error?.stack
      );
    }

    this.logger.log(
      `Automated dividend import: users=${totalUsers}, holdings=${totalHoldings}, candidates=${totalCandidateDividends}, duplicates=${totalDuplicateDividends}, invalid=${totalInvalidDividends}, missingAssetProfile=${holdingsWithoutAssetProfile}, imported=${totalImportedDividends}`
    );

    return totalImportedDividends;
  }
}
