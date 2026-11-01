import { isPrivateHost } from './private-host';

describe('isPrivateHost — хост у приватній мережі (http у production для вебхука, D57)', () => {
  it.each([
    'web',
    'football-web',
    'localhost',
    'web.localhost',
    'web.internal',
    'host.docker.internal',
    'printer.local',
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.10',
    '127.0.0.1',
    '169.254.1.1',
    '[::1]',
    '[fd12:3456::1]',
    '[fe80::1]',
  ])('%s — приватний', (hostname) => {
    expect(isPrivateHost(hostname)).toBe(true);
  });

  it.each([
    'example.com',
    'web.example.com',
    'internal.example.com',
    '8.8.8.8',
    '172.15.0.1',
    '172.32.0.1',
    '192.169.0.1',
    '[2001:db8::1]',
  ])('%s — публічний', (hostname) => {
    expect(isPrivateHost(hostname)).toBe(false);
  });
});
