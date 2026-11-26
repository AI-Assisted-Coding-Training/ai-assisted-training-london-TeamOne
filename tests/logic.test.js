import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDeck,
  buildSocketUrl,
  findOutliers,
  formatOutlierBanner,
  generateRoomId,
  isValidRoomId,
  parseDeck,
  summarise,
  validateJoin,
} from '../app/src/logic.js';

const user = (id, name, hasVoted = false) => ({ id, name, hasVoted });

test('generated room IDs match the contract pattern', () => {
  for (let i = 0; i < 50; i++) assert.equal(isValidRoomId(generateRoomId()), true);
});

test('room ID validation follows the contract', () => {
  assert.equal(isValidRoomId('xk29-4plm'), true);
  assert.equal(isValidRoomId('abc'), false);
  assert.equal(isValidRoomId('ABCD-efgh'), false);
  assert.equal(isValidRoomId('abcd--efgh'), false);
  assert.equal(isValidRoomId(''), false);
  assert.equal(isValidRoomId(undefined), false);
});

test('name validation trims and enforces 1 to 32 characters', () => {
  assert.equal(validateJoin({ name: '  Alice  ', role: 'participant' }).name, 'Alice');
  assert.equal(validateJoin({ name: '   ', role: 'participant' }).ok, false);
  assert.equal(validateJoin({ name: 'a'.repeat(32), role: 'participant' }).ok, true);
  assert.equal(validateJoin({ name: 'a'.repeat(33), role: 'participant' }).ok, false);
});

test('observer roles are appended to the name and count toward the 32 character limit', () => {
  assert.equal(validateJoin({ name: 'Sam', role: 'PM' }).name, 'Sam [PM]');
  assert.equal(validateJoin({ name: 'a'.repeat(27), role: 'DM' }).ok, true);
  assert.equal(validateJoin({ name: 'a'.repeat(28), role: 'DM' }).ok, false);
});

test('a role typed into the name wins over the radio button', () => {
  const result = validateJoin({ name: 'Sam [pm]', role: 'participant' });
  assert.equal(result.role, 'PM');
  assert.equal(result.name, 'Sam [PM]');
});

test('deck carries the observer setting as a suffix', () => {
  assert.equal(buildDeck(false), 'fibonacci');
  assert.equal(buildDeck(true), 'fibonacci;obs-free');
  assert.equal(parseDeck('fibonacci').observersCountTowardLimit, true);
  assert.equal(parseDeck('fibonacci;obs-free').observersCountTowardLimit, false);
  assert.equal(parseDeck('fibonacci;obs-free').deckName, 'fibonacci');
});

test('socket URL carries room, name and deck as query parameters', () => {
  const url = new URL(
    buildSocketUrl({ base: 'wss://example.test/ws', room: 'xk29-4plm', name: 'Sam [PM]', deck: 'fibonacci' }),
  );
  assert.equal(url.searchParams.get('room'), 'xk29-4plm');
  assert.equal(url.searchParams.get('name'), 'Sam [PM]');
  assert.equal(url.searchParams.get('deck'), 'fibonacci');
});

test('reveal is blocked until every participant has voted and needs at least one participant', () => {
  const state = (users, extra = {}) => ({ type: 'state', hostId: 'a', revealed: false, users, votes: null, ...extra });
  assert.equal(summarise(state([user('a', 'Ann', true), user('b', 'Bob', false)]), 'a').canReveal, false);
  assert.equal(summarise(state([user('a', 'Ann', true), user('b', 'Bob', true)]), 'a').canReveal, true);
  assert.equal(summarise(state([user('a', 'Sam [PM]')]), 'a').canReveal, false);
  assert.equal(summarise(state([user('a', 'Ann'), user('b', 'Sam [PM]', true)]), 'a').outstanding, 1);
});

test('non-participant voted flags and votes are ignored', () => {
  const s = summarise(
    {
      hostId: 'a',
      revealed: true,
      users: [user('a', 'Ann', true), user('b', 'Sam [DM]', true)],
      votes: { a: '5', b: '13' },
    },
    'b',
  );
  assert.equal(s.participants.length, 1);
  assert.deepEqual(s.votes, [{ id: 'a', name: 'Ann', value: '5' }]);
  assert.equal(s.me.isParticipant, false);
  assert.equal(s.me.hasVoted, false);
});

test('reset is disabled on a fresh round and enabled once a vote exists', () => {
  const base = { hostId: 'a', revealed: false, votes: null };
  assert.equal(summarise({ ...base, users: [user('a', 'Ann'), user('b', 'Bob')] }).canReset, false);
  assert.equal(summarise({ ...base, users: [user('a', 'Ann', true)] }).canReset, true);
  assert.equal(summarise({ ...base, revealed: true, users: [user('a', 'Ann')] }).canReset, true);
});

test('host is taken from hostId, so a handover moves the host controls', () => {
  const users = [user('a', 'Ann'), user('b', 'Bob')];
  assert.equal(summarise({ hostId: 'a', users }, 'a').isHost, true);
  assert.equal(summarise({ hostId: 'b', users }, 'a').isHost, false);
  assert.equal(summarise({ hostId: 'b', users }, 'b').isHost, true);
});

test('room limit counts participants, and observers only when the setting says so', () => {
  const participants = Array.from({ length: 15 }, (_, i) => user(`p${i}`, `P${i}`));
  const observer = user('o', 'Sam [PM]');
  const counted = summarise({ hostId: 'p0', users: [...participants, observer], deck: 'fibonacci' }, 'o');
  assert.equal(counted.countedMembers, 16);
  assert.equal(counted.shouldLeaveForLimit, true);
  const free = summarise({ hostId: 'p0', users: [...participants, observer], deck: 'fibonacci;obs-free' }, 'o');
  assert.equal(free.countedMembers, 15);
  assert.equal(free.shouldLeaveForLimit, false);
  const sixteenth = summarise({ hostId: 'p0', users: [...participants, user('x', 'Late')] }, 'x');
  assert.equal(sixteenth.shouldLeaveForLimit, true);
});

test('agreement needs at least two participant votes that all match', () => {
  const revealed = (users, votes) => summarise({ hostId: 'a', revealed: true, users, votes });
  assert.deepEqual(
    revealed([user('a', 'Ann', true), user('b', 'Bob', true)], { a: '5', b: '5' }).agreement,
    { value: '5' },
  );
  assert.equal(revealed([user('a', 'Ann', true), user('b', 'Bob', true)], { a: '5', b: '8' }).agreement, null);
  assert.equal(revealed([user('a', 'Ann', true)], { a: '5' }).agreement, null);
  assert.deepEqual(
    revealed([user('a', 'Ann', true), user('b', 'Bob', true), user('c', 'Sam [PM]')], { a: '5', b: '5', c: '8' })
      .agreement,
    { value: '5' },
  );
});

test('outliers are the lowest and highest voters when votes differ', () => {
  const votes = (pairs) => pairs.map(([name, value]) => ({ id: name, name, value }));
  assert.deepEqual(
    findOutliers(votes([['Alice', '3'], ['Bob', '21']])).map((o) => o.name),
    ['Alice', 'Bob'],
  );
  assert.deepEqual(
    findOutliers(votes([['Alice', '3'], ['Carol', '5'], ['Bob', '21']])).map((o) => o.name),
    ['Alice', 'Bob'],
  );
  assert.deepEqual(
    findOutliers(votes([['Alice', '3'], ['Carol', '3'], ['Bob', '21']])).map((o) => o.name),
    ['Alice', 'Carol', 'Bob'],
  );
  assert.deepEqual(findOutliers(votes([['Alice', '5'], ['Bob', '5']])), []);
  assert.deepEqual(findOutliers(votes([['Alice', '5']])), []);
});

test('outlier banner names everyone at the extremes', () => {
  const outliers = findOutliers([
    { id: 'a', name: 'Alice', value: '3' },
    { id: 'b', name: 'Bob', value: '21' },
  ]);
  assert.equal(formatOutlierBanner(outliers), 'Alice (3) and Bob (21), please explain your estimates');
  assert.equal(formatOutlierBanner([]), null);
});
