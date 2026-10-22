import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cronToIst, istToCron } from '../src/lib/format.ts';

test('default schedule: Monday 06:00 IST is 00:30 UTC Monday', () => {
  assert.equal(istToCron(1, '06:00'), '30 0 * * 1');
  assert.deepEqual(cronToIst('30 0 * * 1'), { dow: 1, time: '06:00' });
});

test('early-morning IST falls on the previous UTC day, wrapping Sunday to Saturday', () => {
  assert.equal(istToCron(1, '02:00'), '30 20 * * 0'); // Mon 02:00 IST = Sun 20:30 UTC
  assert.equal(istToCron(0, '05:00'), '30 23 * * 6'); // Sun 05:00 IST = Sat 23:30 UTC
  assert.deepEqual(cronToIst('30 23 * * 6'), { dow: 0, time: '05:00' });
});

test('round-trips every half hour of the week', () => {
  for (let dow = 0; dow < 7; dow++) {
    for (let mins = 0; mins < 1440; mins += 30) {
      const time = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
      assert.deepEqual(cronToIst(istToCron(dow, time)!), { dow, time });
    }
  }
});

test('rejects anything that is not a weekly schedule', () => {
  assert.equal(istToCron(7, '06:00'), null);
  assert.equal(istToCron(1, '6:00'), null);
  assert.equal(istToCron(1, '24:00'), null);
  assert.equal(cronToIst('*/5 * * * *'), null);
  assert.equal(cronToIst('0 6 * * *'), null);
});
