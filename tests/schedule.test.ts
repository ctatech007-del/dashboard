import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cronToIst, istToCron } from '../src/lib/format.ts';

test('default schedule: 06:00 IST every day is 00:30 UTC', () => {
  assert.equal(istToCron('06:00'), '30 0 * * *');
  assert.equal(cronToIst('30 0 * * *'), '06:00');
});

test('early-morning IST wraps to the previous UTC evening', () => {
  assert.equal(istToCron('02:00'), '30 20 * * *');
  assert.equal(cronToIst('30 20 * * *'), '02:00');
});

test('round-trips every half hour of the day', () => {
  for (let mins = 0; mins < 1440; mins += 30) {
    const time = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    assert.equal(cronToIst(istToCron(time)!), time);
  }
});

test('rejects anything that is not a daily schedule', () => {
  assert.equal(istToCron('6:00'), null);
  assert.equal(istToCron('24:00'), null);
  assert.equal(cronToIst('*/5 * * * *'), null);
  assert.equal(cronToIst('30 0 * * 1'), null);
});
