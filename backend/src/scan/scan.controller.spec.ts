import { BadRequestException } from '@nestjs/common';
import { ScanController } from './scan.controller';
import { ScanService } from './scan.service';

describe('ScanController', () => {
  let listReports: jest.Mock;
  let controller: ScanController;

  beforeEach(() => {
    listReports = jest.fn(async () => []);
    controller = new ScanController({ listReports } as unknown as ScanService);
  });

  it('lists reports with the limit and no filter by default', async () => {
    await controller.list('20');

    expect(listReports).toHaveBeenCalledWith(20, {});
  });

  it('filters reports by subnet and by the time they were received', async () => {
    await controller.list(undefined, '3', '2026-10-31T00:00:00.000Z');

    expect(listReports).toHaveBeenCalledWith(undefined, {
      subnetId: 3,
      since: new Date('2026-10-31T00:00:00.000Z'),
    });
  });

  it('rejects a subnet id that is not an integer', () => {
    expect(() => controller.list(undefined, 'abc')).toThrow(BadRequestException);
    expect(() => controller.list(undefined, '1.5')).toThrow(BadRequestException);
  });

  it('rejects a since value that is not a date', () => {
    expect(() => controller.list(undefined, undefined, 'yesterday')).toThrow(
      BadRequestException,
    );
  });
});
