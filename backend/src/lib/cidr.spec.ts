import {
  cidrContains,
  ipToNumber,
  isNetworkOrBroadcast,
  isValidCidr,
  isValidIp,
  numberToIp,
  parseCidr,
  totalHosts,
} from './cidr';

describe('cidr', () => {
  describe('ipToNumber / numberToIp', () => {
    it('converts ip to number', () => {
      expect(ipToNumber('0.0.0.0')).toBe(0);
      expect(ipToNumber('255.255.255.255')).toBe(4294967295);
      expect(ipToNumber('192.168.1.1')).toBe(3232235777);
      expect(ipToNumber('10.0.0.0')).toBe(167772160);
    });

    it('converts number to ip', () => {
      expect(numberToIp(0)).toBe('0.0.0.0');
      expect(numberToIp(4294967295)).toBe('255.255.255.255');
      expect(numberToIp(3232235777)).toBe('192.168.1.1');
    });

    it('round-trips', () => {
      for (const ip of ['1.2.3.4', '10.0.0.1', '172.16.255.254']) {
        expect(numberToIp(ipToNumber(ip))).toBe(ip);
      }
    });

    it('throws on invalid ip', () => {
      expect(() => ipToNumber('256.1.1.1')).toThrow();
      expect(() => ipToNumber('1.2.3')).toThrow();
      expect(() => numberToIp(-1)).toThrow();
      expect(() => numberToIp(4294967296)).toThrow();
    });
  });

  describe('isValidIp', () => {
    it('accepts valid ips', () => {
      expect(isValidIp('0.0.0.0')).toBe(true);
      expect(isValidIp('255.255.255.255')).toBe(true);
      expect(isValidIp('192.168.1.1')).toBe(true);
    });

    it('rejects invalid ips', () => {
      expect(isValidIp('256.0.0.1')).toBe(false);
      expect(isValidIp('1.2.3')).toBe(false);
      expect(isValidIp('1.2.3.4.5')).toBe(false);
      expect(isValidIp('')).toBe(false);
      expect(isValidIp('a.b.c.d')).toBe(false);
      expect(isValidIp('01.2.3.4')).toBe(false);
      expect(isValidIp('1.2.3.4 ')).toBe(false);
    });
  });

  describe('isValidCidr', () => {
    it('accepts valid cidrs', () => {
      expect(isValidCidr('192.168.1.0/24')).toBe(true);
      expect(isValidCidr('10.0.0.0/8')).toBe(true);
      expect(isValidCidr('1.2.3.4/32')).toBe(true);
      expect(isValidCidr('0.0.0.0/0')).toBe(true);
    });

    it('rejects invalid cidrs', () => {
      expect(isValidCidr('192.168.1.0/33')).toBe(false);
      expect(isValidCidr('192.168.1.0')).toBe(false);
      expect(isValidCidr('192.168.1.0/24/24')).toBe(false);
      expect(isValidCidr('256.1.1.0/24')).toBe(false);
      expect(isValidCidr('')).toBe(false);
    });
  });

  describe('parseCidr', () => {
    it('parses /24', () => {
      expect(parseCidr('192.168.1.0/24')).toEqual({
        network: 3232235776,
        mask: 24,
        size: 256,
        broadcast: 3232236031,
      });
    });

    it('masks non-zero host bits', () => {
      const parsed = parseCidr('192.168.1.5/24');
      expect(parsed.network).toBe(3232235776);
      expect(parsed.broadcast).toBe(3232236031);
    });

    it('parses /30', () => {
      expect(parseCidr('10.0.0.0/30')).toEqual({
        network: 167772160,
        mask: 30,
        size: 4,
        broadcast: 167772163,
      });
    });

    it('parses /31', () => {
      expect(parseCidr('10.0.0.0/31')).toEqual({
        network: 167772160,
        mask: 31,
        size: 2,
        broadcast: 167772161,
      });
    });

    it('parses /32', () => {
      expect(parseCidr('8.8.8.8/32')).toEqual({
        network: 134744072,
        mask: 32,
        size: 1,
        broadcast: 134744072,
      });
    });

    it('parses /0', () => {
      expect(parseCidr('0.0.0.0/0')).toEqual({
        network: 0,
        mask: 0,
        size: 4294967296,
        broadcast: 4294967295,
      });
    });

    it('throws on invalid cidr', () => {
      expect(() => parseCidr('192.168.1.0/33')).toThrow();
      expect(() => parseCidr('192.168.1.0')).toThrow();
    });
  });

  describe('cidrContains', () => {
    it('contains ips in the range', () => {
      expect(cidrContains('192.168.1.0/24', '192.168.1.1')).toBe(true);
      expect(cidrContains('192.168.1.0/24', '192.168.1.254')).toBe(true);
      expect(cidrContains('10.0.0.0/8', '10.255.255.255')).toBe(true);
      expect(cidrContains('172.16.0.0/16', '172.16.255.1')).toBe(true);
    });

    it('rejects ips outside the range', () => {
      expect(cidrContains('192.168.1.0/24', '192.168.2.1')).toBe(false);
      expect(cidrContains('10.0.0.0/8', '11.0.0.1')).toBe(false);
      expect(cidrContains('192.168.1.0/30', '192.168.1.4')).toBe(false);
    });
  });

  describe('totalHosts', () => {
    it('computes usable hosts', () => {
      expect(totalHosts('192.168.1.0/24')).toBe(254);
      expect(totalHosts('10.0.0.0/8')).toBe(16777214);
      expect(totalHosts('10.0.0.0/30')).toBe(2);
      expect(totalHosts('10.0.0.0/31')).toBe(0);
      expect(totalHosts('10.0.0.0/32')).toBe(0);
    });

    it('throws on invalid cidr', () => {
      expect(() => totalHosts('bad')).toThrow();
    });

    it('counts all hosts when includeFirstLast is true', () => {
      expect(totalHosts('192.168.1.0/24', true)).toBe(256);
      expect(totalHosts('10.0.0.0/30', true)).toBe(4);
      expect(totalHosts('10.0.0.0/31', true)).toBe(2);
      expect(totalHosts('10.0.0.0/32', true)).toBe(1);
    });

    it('keeps the legacy behavior when includeFirstLast is false', () => {
      expect(totalHosts('192.168.1.0/24', false)).toBe(254);
      expect(totalHosts('10.0.0.0/31', false)).toBe(0);
      expect(totalHosts('10.0.0.0/32', false)).toBe(0);
    });
  });

  describe('isNetworkOrBroadcast', () => {
    it('detects the first and last addresses', () => {
      expect(isNetworkOrBroadcast('192.168.1.0/24', '192.168.1.0')).toBe(true);
      expect(isNetworkOrBroadcast('192.168.1.0/24', '192.168.1.255')).toBe(true);
      expect(isNetworkOrBroadcast('192.168.1.0/24', '192.168.1.1')).toBe(false);
      expect(isNetworkOrBroadcast('192.168.1.0/24', '192.168.1.254')).toBe(false);
    });

    it('handles /31 and /32', () => {
      expect(isNetworkOrBroadcast('10.0.0.0/31', '10.0.0.0')).toBe(true);
      expect(isNetworkOrBroadcast('10.0.0.0/31', '10.0.0.1')).toBe(true);
      expect(isNetworkOrBroadcast('8.8.8.8/32', '8.8.8.8')).toBe(true);
      expect(isNetworkOrBroadcast('8.8.8.8/32', '8.8.8.9')).toBe(false);
    });
  });
});
