import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Device } from '../entities/device.entity';
import { EventsService } from '../events/events.service';
import { LiveEvent } from '../events/live-event';
import { DeviceStatusScheduler } from './device-status.scheduler';

function makeDevice(overrides: Partial<Device>): Device {
  return {
    ip: '192.168.1.10',
    mac: '',
    hostname: '',
    vendor: '',
    subnetId: 1,
    status: 'online',
    lastSeen: new Date('2026-10-31T09:00:00.000Z'),
    notes: '',
    ...overrides,
  } as Device;
}

describe('DeviceStatusScheduler', () => {
  let scheduler: DeviceStatusScheduler;
  let deviceRepo: { find: jest.Mock; save: jest.Mock };
  let events: LiveEvent[];

  beforeEach(async () => {
    deviceRepo = {
      find: jest.fn(async () => []),
      save: jest.fn(async (device: Device) => device),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        DeviceStatusScheduler,
        EventsService,
        { provide: getRepositoryToken(Device), useValue: deviceRepo },
      ],
    }).compile();
    scheduler = moduleRef.get(DeviceStatusScheduler);
    events = [];
    moduleRef
      .get(EventsService)
      .stream()
      .subscribe((event) => events.push(event));
  });

  it('marks stale online devices offline and emits one device.offline with exactly them', async () => {
    const stale = [
      makeDevice({ id: 3, status: 'online' }),
      makeDevice({ id: 4, status: 'offline' }),
      makeDevice({ id: 9, status: 'online' }),
    ];
    deviceRepo.find.mockResolvedValue(stale);

    await scheduler.markStaleDevicesOffline();

    expect(stale.map((device) => device.status)).toEqual([
      'offline',
      'offline',
      'offline',
    ]);
    expect(deviceRepo.save).toHaveBeenCalledTimes(2);
    expect(events).toEqual([
      { type: 'device.offline', data: { deviceIds: [3, 9] } },
    ]);
  });

  it('emits nothing when no device changed', async () => {
    deviceRepo.find.mockResolvedValue([
      makeDevice({ id: 4, status: 'offline' }),
    ]);

    await scheduler.markStaleDevicesOffline();

    expect(deviceRepo.save).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('emits nothing when no device is stale', async () => {
    await scheduler.markStaleDevicesOffline();

    expect(events).toEqual([]);
  });
});
