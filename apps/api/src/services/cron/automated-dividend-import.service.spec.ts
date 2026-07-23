import { ActivitiesService } from '@ghostfolio/api/app/activities/activities.service';
import { ImportService } from '@ghostfolio/api/app/import/import.service';
import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { PropertyService } from '@ghostfolio/api/services/property/property.service';

import { AutomatedDividendImportService } from './automated-dividend-import.service';

describe('AutomatedDividendImportService', () => {
  let activitiesService: ActivitiesService;
  let automatedDividendImportService: AutomatedDividendImportService;
  let importService: ImportService;
  let portfolioService: PortfolioService;
  let prismaService: PrismaService;
  let propertyService: PropertyService;

  beforeEach(() => {
    activitiesService = { createActivity: jest.fn() } as any;
    importService = { getDividends: jest.fn() } as any;
    portfolioService = { getHoldings: jest.fn() } as any;
    prismaService = {
      account: { findMany: jest.fn() },
      settings: { findUnique: jest.fn() },
      user: { findMany: jest.fn() }
    } as any;
    propertyService = { getByKey: jest.fn() } as any;

    automatedDividendImportService = new AutomatedDividendImportService(
      activitiesService,
      importService,
      portfolioService,
      prismaService,
      propertyService
    );
  });

  it('should import dividends automatically for active users', async () => {
    jest.spyOn(propertyService, 'getByKey').mockResolvedValue(false);
    jest.spyOn(prismaService.user, 'findMany').mockResolvedValue([
      {
        id: 'user-1'
      }
    ] as any);
    jest.spyOn(prismaService.account, 'findMany').mockResolvedValue([
      { id: 'acc-1' }
    ] as any);
    jest.spyOn(prismaService.settings, 'findUnique').mockResolvedValue({
      settings: { baseCurrency: 'USD' }
    } as any);

    jest.spyOn(portfolioService, 'getHoldings').mockResolvedValue([
      {
        assetProfile: {
          dataSource: 'YAHOO',
          symbol: 'AAPL'
        },
        quantity: 10
      }
    ] as any);

    jest.spyOn(importService, 'getDividends').mockResolvedValue([
      {
        accountId: 'acc-1',
        assetProfile: {
          currency: 'USD',
          dataSource: 'YAHOO',
          name: 'Apple Inc.',
          symbol: 'AAPL'
        },
        date: new Date('2026-05-01'),
        error: undefined,
        fee: 0,
        quantity: 10,
        type: 'DIVIDEND',
        unitPrice: 0.25,
        value: 2.5
      }
    ] as any);

    const importedCount =
      await automatedDividendImportService.importDividendsForAllUsers();

    expect(importedCount).toBe(1);
    expect(activitiesService.createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acc-1',
        comment: 'Automated Dividend Import',
        quantity: 10,
        type: 'DIVIDEND',
        unitPrice: 0.25,
        userId: 'user-1'
      })
    );
  });

  it('should skip import if read-only mode is enabled', async () => {
    jest.spyOn(propertyService, 'getByKey').mockResolvedValue(true);

    const importedCount =
      await automatedDividendImportService.importDividendsForAllUsers();

    expect(importedCount).toBe(0);
    expect(prismaService.user.findMany).not.toHaveBeenCalled();
  });
});
