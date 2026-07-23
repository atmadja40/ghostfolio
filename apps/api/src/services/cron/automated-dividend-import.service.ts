import { ActivitiesService } from '@ghostfolio/api/app/activities/activities.service';
import { ImportService } from '@ghostfolio/api/app/import/import.service';
import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { PropertyService } from '@ghostfolio/api/services/property/property.service';
import { PROPERTY_IS_READ_ONLY_MODE } from '@ghostfolio/common/config';

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AutomatedDividendImportService {
  private readonly logger = new Logger(AutomatedDividendImportService.name);

  public constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly configurationService: ConfigurationService,
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

    this.logger.log(
      'Starting automated dividend import for all active users...'
    );

    let totalImportedDividends = 0;

    try {
      const users = await this.prismaService.user.findMany({
        select: {
          currency: true,
          id: true,
          accounts: {
            select: { id: true }
          }
        }
      });

      for (const user of users) {
        if (!user.accounts || user.accounts.length === 0) {
          continue;
        }

        try {
          const holdings = await this.portfolioService.getHoldings({
            dateRange: 'max',
            impersonationId: undefined,
            userId: user.id
          });

          for (const holding of holdings) {
            const { dataSource, symbol } = holding;
            if (!dataSource || !symbol) {
              continue;
            }

            const candidateDividends = await this.importService.getDividends({
              dataSource,
              symbol,
              userCurrency: user.currency,
              userId: user.id
            });

            for (const dividendActivity of candidateDividends) {
              if (dividendActivity.error || dividendActivity.quantity <= 0) {
                continue;
              }

              const accountId =
                dividendActivity.accountId ?? user.accounts[0]?.id;

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
                      symbol: dividendActivity.assetProfile.symbol
                    },
                    where: {
                      dataSource_symbol: {
                        dataSource: dividendActivity.assetProfile.dataSource,
                        symbol: dividendActivity.assetProfile.symbol
                      }
                    }
                  }
                },
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
      `Automated dividend import finished. Total new dividends imported: ${totalImportedDividends}`
    );

    return totalImportedDividends;
  }
}
