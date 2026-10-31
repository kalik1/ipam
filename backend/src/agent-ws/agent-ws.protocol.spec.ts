import {
  extractDevices,
  extractNetwork,
  parseInbound,
} from './agent-ws.protocol';

describe('parseInbound', () => {
  it('parses a valid hello', () => {
    const result = parseInbound(
      JSON.stringify({
        type: 'hello',
        agent: 'agent-1',
        platform: 'linux',
        apiKey: 'ipam-abc',
        connectors: ['mikrotik'],
      }),
    );
    expect(result).toEqual({
      message: {
        type: 'hello',
        agent: 'agent-1',
        platform: 'linux',
        apiKey: 'ipam-abc',
        connectors: ['mikrotik'],
      },
    });
  });

  it('parses a valid ping', () => {
    expect(parseInbound('{"type":"ping"}')).toEqual({
      message: { type: 'ping' },
    });
  });

  it('parses a valid report with optional device fields', () => {
    const result = parseInbound(
      JSON.stringify({
        type: 'report',
        platform: 'linux',
        devices: [
          { ip: '192.168.1.10', mac: 'AA:BB', hostname: 'host', vendor: 'Dell' },
          { ip: '192.168.1.11' },
        ],
      }),
    );
    expect(result).toEqual({
      message: {
        type: 'report',
        platform: 'linux',
        devices: [
          { ip: '192.168.1.10', mac: 'AA:BB', hostname: 'host', vendor: 'Dell' },
          { ip: '192.168.1.11' },
        ],
      },
    });
  });

  it('parses a valid ok result with data', () => {
    const result = parseInbound(
      JSON.stringify({
        type: 'result',
        id: 'cmd-1',
        ok: true,
        data: { connector: 'mikrotik', devices: [] },
      }),
    );
    expect(result).toEqual({
      message: {
        type: 'result',
        id: 'cmd-1',
        ok: true,
        data: { connector: 'mikrotik', devices: [] },
      },
    });
  });

  it('parses a valid error result', () => {
    const result = parseInbound(
      JSON.stringify({
        type: 'result',
        id: 'cmd-1',
        ok: false,
        error: 'connection refused',
      }),
    );
    expect(result).toEqual({
      message: {
        type: 'result',
        id: 'cmd-1',
        ok: false,
        error: 'connection refused',
      },
    });
  });

  it('rejects invalid json', () => {
    expect(parseInbound('{nope')).toEqual({ error: 'invalid_json' });
  });

  it('rejects non-object json', () => {
    expect(parseInbound('42')).toEqual({ error: 'invalid_message' });
    expect(parseInbound('[1,2]')).toEqual({ error: 'invalid_message' });
  });

  it('rejects a missing type', () => {
    expect(parseInbound('{"agent":"x"}')).toEqual({ error: 'missing_type' });
  });

  it('rejects an unknown type', () => {
    expect(parseInbound('{"type":"nonsense"}')).toEqual({
      error: 'unknown_type',
    });
  });

  it('rejects hello with a too-long agent name', () => {
    expect(
      parseInbound(
        JSON.stringify({
          type: 'hello',
          agent: 'a'.repeat(101),
          platform: 'linux',
          apiKey: 'ipam-abc',
          connectors: [],
        }),
      ),
    ).toEqual({ error: 'invalid_agent' });
  });

  it('rejects hello with an empty agent name', () => {
    expect(
      parseInbound(
        JSON.stringify({
          type: 'hello',
          agent: '',
          platform: 'linux',
          apiKey: 'ipam-abc',
          connectors: [],
        }),
      ),
    ).toEqual({ error: 'invalid_agent' });
  });

  it('rejects hello with a missing platform', () => {
    expect(
      parseInbound(
        JSON.stringify({
          type: 'hello',
          agent: 'agent-1',
          apiKey: 'ipam-abc',
          connectors: [],
        }),
      ),
    ).toEqual({ error: 'invalid_platform' });
  });

  it('rejects hello with a missing api key', () => {
    expect(
      parseInbound(
        JSON.stringify({
          type: 'hello',
          agent: 'agent-1',
          platform: 'linux',
          connectors: [],
        }),
      ),
    ).toEqual({ error: 'invalid_api_key' });
  });

  it('rejects hello with non-string connectors', () => {
    expect(
      parseInbound(
        JSON.stringify({
          type: 'hello',
          agent: 'agent-1',
          platform: 'linux',
          apiKey: 'ipam-abc',
          connectors: [42],
        }),
      ),
    ).toEqual({ error: 'invalid_connectors' });
  });

  it('rejects report with a missing platform', () => {
    expect(
      parseInbound(JSON.stringify({ type: 'report', devices: [] })),
    ).toEqual({ error: 'invalid_platform' });
  });

  it('rejects report with a non-array devices field', () => {
    expect(
      parseInbound(
        JSON.stringify({ type: 'report', platform: 'linux', devices: 'x' }),
      ),
    ).toEqual({ error: 'invalid_devices' });
  });

  it('rejects report devices without ip', () => {
    expect(
      parseInbound(
        JSON.stringify({
          type: 'report',
          platform: 'linux',
          devices: [{ mac: 'AA:BB' }],
        }),
      ),
    ).toEqual({ error: 'invalid_device' });
  });

  it('rejects report devices with a non-string optional field', () => {
    expect(
      parseInbound(
        JSON.stringify({
          type: 'report',
          platform: 'linux',
          devices: [{ ip: '192.168.1.10', mac: 42 }],
        }),
      ),
    ).toEqual({ error: 'invalid_device' });
  });

  it('rejects result with a missing id', () => {
    expect(
      parseInbound(JSON.stringify({ type: 'result', ok: true, data: {} })),
    ).toEqual({ error: 'invalid_id' });
  });

  it('rejects result with a non-boolean ok', () => {
    expect(
      parseInbound(JSON.stringify({ type: 'result', id: 'x', ok: 'yes' })),
    ).toEqual({ error: 'invalid_ok' });
  });

  it('rejects an ok result without data', () => {
    expect(
      parseInbound(JSON.stringify({ type: 'result', id: 'x', ok: true })),
    ).toEqual({ error: 'invalid_data' });
  });

  it('rejects an ok result with non-object data', () => {
    expect(
      parseInbound(
        JSON.stringify({ type: 'result', id: 'x', ok: true, data: [1] }),
      ),
    ).toEqual({ error: 'invalid_data' });
  });

  it('rejects an error result without a string error', () => {
    expect(
      parseInbound(JSON.stringify({ type: 'result', id: 'x', ok: false })),
    ).toEqual({ error: 'invalid_error' });
  });
});

describe('extractDevices', () => {
  it('extracts devices from a result payload', () => {
    expect(
      extractDevices({
        connector: 'mikrotik',
        devices: [
          { ip: '10.0.0.1', mac: 'AA:BB' },
          { ip: '10.0.0.2' },
        ],
      }),
    ).toEqual([
      { ip: '10.0.0.1', mac: 'AA:BB' },
      { ip: '10.0.0.2' },
    ]);
  });

  it('returns null when data is not an object', () => {
    expect(extractDevices(null)).toBeNull();
    expect(extractDevices('x')).toBeNull();
    expect(extractDevices(undefined)).toBeNull();
  });

  it('returns null when devices is not an array', () => {
    expect(extractDevices({ devices: 'nope' })).toBeNull();
    expect(extractDevices({})).toBeNull();
  });

  it('returns null when a device is invalid', () => {
    expect(extractDevices({ devices: [{ mac: 'AA:BB' }] })).toBeNull();
    expect(extractDevices({ devices: [42] })).toBeNull();
  });
});

describe('extractNetwork', () => {
  it('extracts vlans and subnets', () => {
    expect(
      extractNetwork({
        vlans: [{ vlanId: 220, name: 'vlan-220' }],
        subnets: [
          { cidr: '192.168.220.0/24', name: 'bridge220', gateway: '192.168.220.1', vlanId: 220 },
          { cidr: '192.168.100.0/24', name: 'ether4' },
        ],
      }),
    ).toEqual({
      vlans: [{ vlanId: 220, name: 'vlan-220' }],
      subnets: [
        { cidr: '192.168.220.0/24', name: 'bridge220', gateway: '192.168.220.1', vlanId: 220 },
        { cidr: '192.168.100.0/24', name: 'ether4' },
      ],
      reservedIps: [],
      dhcpRanges: [],
    });
  });

  it('returns null when no network sections are present', () => {
    expect(extractNetwork({ devices: [] })).toBeNull();
    expect(extractNetwork(null)).toBeNull();
    expect(extractNetwork({ vlans: [], subnets: [], reservedIps: [], dhcpRanges: [] })).toBeNull();
  });

  it('returns null when vlans is not an array or has invalid entries', () => {
    expect(extractNetwork({ vlans: 'nope' })).toBeNull();
    expect(extractNetwork({ vlans: [{ name: 'x' }] })).toBeNull();
    expect(extractNetwork({ vlans: [{ vlanId: 1.5, name: 'x' }] })).toBeNull();
  });

  it('returns null when subnets is not an array or has invalid entries', () => {
    expect(extractNetwork({ subnets: 'nope' })).toBeNull();
    expect(extractNetwork({ subnets: [{ name: 'x' }] })).toBeNull();
    expect(extractNetwork({ subnets: [{ cidr: '1.2.3.0/24', name: 'x', gateway: 7 }] })).toBeNull();
    expect(
      extractNetwork({ subnets: [{ cidr: '1.2.3.0/24', name: 'x', dnsServers: 'nope' }] }),
    ).toBeNull();
  });

  it('accepts a null vlanId on a subnet', () => {
    expect(extractNetwork({ subnets: [{ cidr: '1.2.3.0/24', name: 'x', vlanId: null }] })).toEqual({
      vlans: [],
      subnets: [{ cidr: '1.2.3.0/24', name: 'x', vlanId: null }],
      reservedIps: [],
      dhcpRanges: [],
    });
  });

  it('extracts subnet domain, dns and ntp config', () => {
    expect(
      extractNetwork({
        subnets: [
          {
            cidr: '192.168.4.0/24',
            name: 'bridge4',
            domainName: 'sec.pillon.org',
            dnsServers: ['1.1.1.1', '8.8.8.8'],
            ntpServers: ['ntp.pillon.org'],
          },
        ],
      }),
    ).toEqual({
      vlans: [],
      subnets: [
        {
          cidr: '192.168.4.0/24',
          name: 'bridge4',
          domainName: 'sec.pillon.org',
          dnsServers: ['1.1.1.1', '8.8.8.8'],
          ntpServers: ['ntp.pillon.org'],
        },
      ],
      reservedIps: [],
      dhcpRanges: [],
    });
  });

  it('extracts reserved ips and dhcp ranges', () => {
    expect(
      extractNetwork({
        reservedIps: [
          { ip: '192.168.220.100', mac: 'AA:BB', hostname: 'reserved' },
          { ip: '192.168.220.101' },
        ],
        dhcpRanges: [{ name: 'dhcp-220', startIp: '192.168.220.100', endIp: '192.168.220.200' }],
      }),
    ).toEqual({
      vlans: [],
      subnets: [],
      reservedIps: [
        { ip: '192.168.220.100', mac: 'AA:BB', hostname: 'reserved' },
        { ip: '192.168.220.101' },
      ],
      dhcpRanges: [{ name: 'dhcp-220', startIp: '192.168.220.100', endIp: '192.168.220.200' }],
    });
  });

  it('returns null for invalid reserved ips or dhcp ranges', () => {
    expect(extractNetwork({ reservedIps: [{ mac: 'AA:BB' }] })).toBeNull();
    expect(extractNetwork({ reservedIps: [{ ip: '1.2.3.4', mac: 7 }] })).toBeNull();
    expect(extractNetwork({ dhcpRanges: [{ startIp: '1.2.3.4', endIp: '1.2.3.5' }] })).toBeNull();
    expect(extractNetwork({ dhcpRanges: 'nope' })).toBeNull();
  });
});
