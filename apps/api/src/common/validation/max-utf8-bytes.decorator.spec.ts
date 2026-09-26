import { validate } from 'class-validator';
import { MaxUtf8Bytes } from './max-utf8-bytes.decorator';

class PasswordProbe {
  @MaxUtf8Bytes(72)
  password!: unknown;
}

async function countErrors(password: unknown): Promise<number> {
  const probe = new PasswordProbe();
  probe.password = password;
  return (await validate(probe)).length;
}

describe('MaxUtf8Bytes', () => {
  it('межа в байтах: 36 літер кирилицею (72 байти) — ок, 37 (74) — ні', async () => {
    expect(await countErrors('ї'.repeat(36))).toBe(0);
    expect(await countErrors('ї'.repeat(37))).toBe(1);
  });

  it('ASCII: 72 — ок, 73 — ні', async () => {
    expect(await countErrors('a'.repeat(72))).toBe(0);
    expect(await countErrors('a'.repeat(73))).toBe(1);
  });

  it('одиночний surrogate не кидає виняток (encodeURI кинув би)', async () => {
    await expect(countErrors('abcdefg\ud800')).resolves.toBe(0);
  });

  it('не рядок → помилка', async () => {
    expect(await countErrors(12345)).toBe(1);
  });
});
