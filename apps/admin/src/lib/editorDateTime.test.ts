import { describe, expect, it } from 'vitest';
import {
  formatEditorDateTime,
  fromDateTimeLocalValue,
  scheduleTimeNote,
  timeZoneLabel,
  toDateTimeLocalValue,
} from './editorDateTime';

const KYIV = 'Europe/Kyiv';

describe('поле дати розкладу ↔ ISO в поясі редактора', () => {
  it('зсув — той, що діє в дату розкладу: 25 жовтня 2026 Київ переходить з UTC+3 на UTC+2', () => {
    expect(fromDateTimeLocalValue('2026-10-24T10:00', KYIV)).toBe('2026-10-24T07:00:00.000Z');
    expect(fromDateTimeLocalValue('2026-10-26T10:00', KYIV)).toBe('2026-10-26T08:00:00.000Z');
    expect(toDateTimeLocalValue(new Date('2026-10-24T07:00:00.000Z'), KYIV)).toBe('2026-10-24T10:00');
    expect(toDateTimeLocalValue(new Date('2026-10-26T08:00:00.000Z'), KYIV)).toBe('2026-10-26T10:00');
  });


  it('інший пояс редактора — інша миттєвість того самого значення поля', () => {
    expect(fromDateTimeLocalValue('2026-10-26T10:00', 'America/New_York')).toBe('2026-10-26T14:00:00.000Z');
    expect(fromDateTimeLocalValue('2026-10-26T10:00', 'UTC')).toBe('2026-10-26T10:00:00.000Z');
  });

  it('порожнє чи неіснуюче значення — null', () => {
    for (const value of ['', '2026-02-30T10:00', '2026-10-26T24:00', '2026-10-26 10:00', '2026-10-26T10:00:00']) {
      expect(fromDateTimeLocalValue(value, KYIV)).toBeNull();
    }
  });
});

describe('перехід часу в Києві: яку мить обрано і що бачить редактор', () => {
  it('25.10.2026 03:30 буває двічі (о 04:00 годинник — назад на 03:00): обрано першу, ще за літнім часом, як у браузера', () => {
    expect(fromDateTimeLocalValue('2026-10-25T03:30', KYIV)).toBe('2026-10-25T00:30:00.000Z');
    // Редактор бачить: у полі — те саме 03:30, біля поля — «Kyiv, UTC+3» і пояснення, у списку — 03:30
    expect(toDateTimeLocalValue(new Date('2026-10-25T00:30:00.000Z'), KYIV)).toBe('2026-10-25T03:30');
    expect(timeZoneLabel(KYIV, new Date('2026-10-25T00:30:00.000Z'))).toBe('Kyiv, UTC+3');
    expect(formatEditorDateTime('2026-10-25T00:30:00.000Z', KYIV)).toBe('25 Oct 2026, 03:30');
    expect(scheduleTimeNote('2026-10-25T03:30', KYIV)).toBe(
      'This time happens twice: the clocks go back that night. The first one is used — 25 Oct 2026, 03:30 (Kyiv, UTC+3).',
    );
    // Друга 03:30 — уже за зимовим (UTC+2): на годиннику той самий час, поле її не відрізнить
    expect(toDateTimeLocalValue(new Date('2026-10-25T01:30:00.000Z'), KYIV)).toBe('2026-10-25T03:30');
    expect(timeZoneLabel(KYIV, new Date('2026-10-25T01:30:00.000Z'))).toBe('Kyiv, UTC+2');
  });

  it('28.03.2027 03:30 не існує (о 03:00 годинник — уперед на 04:00): зсув уперед, новина вийде о 04:30 за літнім часом', () => {
    expect(fromDateTimeLocalValue('2027-03-28T03:30', KYIV)).toBe('2027-03-28T01:30:00.000Z');
    expect(fromDateTimeLocalValue('2027-03-28T04:00', KYIV)).toBe('2027-03-28T01:00:00.000Z');
    // Редактор бачить: до збереження — пояснення зі справжнім часом, після — 04:30 і в полі, і в списку
    expect(scheduleTimeNote('2027-03-28T03:30', KYIV)).toBe(
      'No such time: the clocks go forward that night. The post goes live at 28 Mar 2027, 04:30 (Kyiv, UTC+3).',
    );
    expect(toDateTimeLocalValue(new Date('2027-03-28T01:30:00.000Z'), KYIV)).toBe('2027-03-28T04:30');
    expect(formatEditorDateTime('2027-03-28T01:30:00.000Z', KYIV)).toBe('28 Mar 2027, 04:30');
  });

  it('звичайний час — без пояснень, і в день переходу теж', () => {
    for (const value of ['2026-10-25T02:30', '2026-10-25T04:30', '2026-10-24T03:30', '2027-03-28T02:30', '2027-03-28T04:30', '']) {
      expect(scheduleTimeNote(value, KYIV)).toBeNull();
    }
  });
});

describe('підписи часу', () => {
  it('пояс біля поля — місто й зсув на вибрану дату; стара назва ICU «Kiev» — як Kyiv', () => {
    expect(timeZoneLabel(KYIV, new Date('2026-10-24T07:00:00.000Z'))).toBe('Kyiv, UTC+3');
    expect(timeZoneLabel(KYIV, new Date('2026-10-26T08:00:00.000Z'))).toBe('Kyiv, UTC+2');
    expect(timeZoneLabel('Europe/Kiev', new Date('2026-10-26T08:00:00.000Z'))).toBe('Kyiv, UTC+2');
    expect(timeZoneLabel('America/New_York', new Date('2026-10-26T08:00:00.000Z'))).toBe('New York, UTC-4');
    expect(timeZoneLabel('Asia/Kolkata', new Date('2026-10-26T08:00:00.000Z'))).toBe('Kolkata, UTC+5:30');
    expect(timeZoneLabel('UTC', new Date('2026-10-26T08:00:00.000Z'))).toBe('UTC');
  });

  it('дата в підписах — у поясі редактора', () => {
    expect(formatEditorDateTime('2026-10-26T08:00:00.000Z', KYIV)).toBe('26 Oct 2026, 10:00');
    expect(formatEditorDateTime('2026-10-26T08:00:00.000Z', 'America/New_York')).toBe('26 Oct 2026, 04:00');
  });
});
