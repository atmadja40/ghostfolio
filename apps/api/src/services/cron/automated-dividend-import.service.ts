
import { ActivitiesService } from '@ghostfolio/api/services/activities/activities.service';
import { ImportService } from '@ghostfolio/api/services/import/import.service';
import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { PropertyService } from '@ghostfolio/api/services/property/property.service';
import {
  DEFAULT_CURRENCY,
  PROPERTY_IS_READ_ONLY_MODE
} from '@ghostfolio/common/config';
import { RequestWithUser, UserWithSettings } from '@ghostfolio/common/types';

import { Injectable, Logger } from '@nestjs/common';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';

@Injectable()
export class AutomatedDividendImportService {
  private readonly logger = new Logger(AutomatedDividendImportService.name);

  public constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly moduleRef: ModuleRef,
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
    let totalAmbiguousAccounts = 0;

    try {
      const users = await this.prismaService.user.findMany({
        select: {
          id: true
        }
      });

      totalUsers = users.length;

      for (const user of users) {
        try {
          const settingsRecord =
            await this.prismaService.settings.findUnique({
              where: { userId: user.id }
            });

          const userCurrency =
            (settingsRecord?.settings as UserWithSettings['settings']['settings'])
              ?.baseCurrency ?? DEFAULT_CURRENCY;

          // Create an isolated NestJS request context for this user.
          const contextId = ContextIdFactory.create();

          const request = {
            user: {
              id: user.id,
              settings: settingsRecord
            }
          } as unknown as RequestWithUser;

          this.moduleRef.registerRequestByContextId(request, contextId);

          // Resolve request-scoped services using the user's context.
          const portfolioService = await this.moduleRef.resolve(
            PortfolioService,
            contextId,
            { strict: false }
          );

          const importService = await this.moduleRef.resolve(
            ImportService,
            contextId,
            { strict: false }
          );

          const holdings = await portfolioService.getHoldings({
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

            const candidateDividends = await importService.getDividends({
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

              // Never assign a dividend to an arbitrary account.
              // ImportService only supplies accountId when the account
              // can be determined unambiguously.
              const accountId = dividendActivity.accountId;

              if (!accountId) {
                totalAmbiguousAccounts++;

                this.logger.warn(
                  `Skipping dividend for user ${user.id}, ` +
                    `${dataSource}/${symbol}: account could not be determined unambiguously.`
                );

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
            `Error importing dividends for user ${user.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
            error instanceof Error ? error.stack : undefined
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error running automated dividend import: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined
      );
    }

    this.logger.log(
      `Automated dividend import: ` +
        `users=${totalUsers}, ` +
        `holdings=${totalHoldings}, ` +
        `candidates=${totalCandidateDividends}, ` +
        `duplicates=${totalDuplicateDividends}, ` +
        `invalid=${totalInvalidDividends}, ` +
        `missingAssetProfile=${holdingsWithoutAssetProfile}, ` +
        `ambiguousAccounts=${totalAmbiguousAccounts}, ` +
        `imported=${totalImportedDividends}`
    );

    return totalImportedDividends;
  }
}
