import { Logger } from '@nestjs/common';

import { PortfolioSnapshotProcessor } from './portfolio-snapshot.processor';

describe('PortfolioSnapshotProcessor', () => {
  it('should propagate Redis failures from the snapshot cache write', async () => {
    const error = new Error('Redis is unavailable');
    const redisCacheService = {
      getPortfolioSnapshotKey: jest.fn().mockReturnValue('snapshot-key'),
      set: jest.fn().mockRejectedValue(error)
    };
    const processor = new PortfolioSnapshotProcessor(
      {
        getAccountBalanceItems: jest.fn().mockResolvedValue([])
      } as any,
      {
        getActivitiesForPortfolioCalculator: jest
          .fn()
          .mockResolvedValue({ activities: [] })
      } as any,
      {
        createCalculator: jest.fn().mockReturnValue({
          computeSnapshot: jest.fn().mockResolvedValue({ errors: [] })
        })
      } as any,
      {
        get: jest.fn().mockReturnValue(60000)
      } as any,
      redisCacheService as any
    );

    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await expect(
      processor.calculatePortfolioSnapshot({
        data: {
          calculationType: 'ROAI',
          userCurrency: 'USD',
          userId: 'user-1'
        }
      } as any)
    ).rejects.toBe(error);

    expect(loggerError).toHaveBeenCalledWith(
      "Could not cache portfolio snapshot for user 'user-1': Redis is unavailable",
      error.stack
    );
  });
});
