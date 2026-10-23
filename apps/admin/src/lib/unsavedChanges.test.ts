import { describe, expect, it, vi } from 'vitest';
import { createUnsavedChangesGuard } from './unsavedChanges';

function setupGuard(answer = false) {
  const eventTarget = new EventTarget();
  const confirmDiscard = vi.fn(() => answer);
  const guard = createUnsavedChangesGuard({ eventTarget, confirmDiscard });
  /** Закриття чи перезавантаження вкладки: `true` — браузер спитає, чи йти */
  const isUnloadStopped = () => {
    const unloadEvent = new Event('beforeunload', { cancelable: true });
    eventTarget.dispatchEvent(unloadEvent);
    return unloadEvent.defaultPrevented;
  };
  return { guard, confirmDiscard, isUnloadStopped };
}

describe('сторож незбережених змін', () => {
  it('без змін — вихід без питання, вкладка закривається', () => {
    const { guard, confirmDiscard, isUnloadStopped } = setupGuard();
    expect(guard.confirmLeave()).toBe(true);
    expect(isUnloadStopped()).toBe(false);
    expect(confirmDiscard).not.toHaveBeenCalled();
  });

  it('є зміни — питає, і йти чи ні, вирішує редактор; закриття вкладки браузер зупиняє', () => {
    const stays = setupGuard(false);
    stays.guard.block();
    expect(stays.guard.confirmLeave()).toBe(false);
    expect(stays.confirmDiscard).toHaveBeenCalledTimes(1);
    expect(stays.isUnloadStopped()).toBe(true);

    const leaves = setupGuard(true);
    leaves.guard.block();
    expect(leaves.guard.confirmLeave()).toBe(true);
  });

  it('збережено перед переходом (allowLeave) — без питання, і закриття вкладки не зупиняється', () => {
    const { guard, confirmDiscard, isUnloadStopped } = setupGuard();
    guard.block();
    guard.allowLeave();
    expect(guard.hasUnsavedChanges()).toBe(false);
    expect(guard.confirmLeave()).toBe(true);
    expect(isUnloadStopped()).toBe(false);
    expect(confirmDiscard).not.toHaveBeenCalled();
  });

  it('нові зміни після збереження — знову питає', () => {
    const { guard, confirmDiscard } = setupGuard();
    guard.block()();
    guard.allowLeave();
    guard.block();
    expect(guard.confirmLeave()).toBe(false);
    expect(confirmDiscard).toHaveBeenCalledTimes(1);
  });

  it('блок знято (зміни скасовано, форма зникла) — без питання; повторне зняття не знімає чужого блоку', () => {
    const { guard, confirmDiscard, isUnloadStopped } = setupGuard();
    const release = guard.block();
    release();
    expect(guard.confirmLeave()).toBe(true);
    expect(isUnloadStopped()).toBe(false);

    guard.block();
    release();
    expect(guard.hasUnsavedChanges()).toBe(true);
    expect(isUnloadStopped()).toBe(true);
    expect(confirmDiscard).not.toHaveBeenCalled();
  });
});
