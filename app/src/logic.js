export const DECK_CARDS = Object.freeze(['1', '2', '3', '5', '8', '13', '21']);
export const DECK_NAME = 'fibonacci';
export const OBSERVERS_FREE_SUFFIX = ';obs-free';
export const MAX_COUNTED_MEMBERS = 15;
export const NAME_MAX_LENGTH = 32;
export const ROLE_LABELS = Object.freeze({ participant: 'Participant', DM: 'DM', PM: 'PM' });

const ROOM_ID_PATTERN = /^[a-z0-9]{4,32}(-[a-z0-9]{4,32})*$/;
const ROOM_ID_MAX_LENGTH = 128;
const ROOM_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ROLE_SUFFIX_PATTERN = /^(.*?)\s*\[(DM|PM)\]$/i;

export function generateRoomId(randomIndex = (max) => Math.floor(Math.random() * max)) {
  const segment = () =>
    Array.from({ length: 4 }, () => ROOM_ID_ALPHABET[randomIndex(ROOM_ID_ALPHABET.length)]).join('');
  return `${segment()}-${segment()}`;
}

export function isValidRoomId(room) {
  return typeof room === 'string' && room.length <= ROOM_ID_MAX_LENGTH && ROOM_ID_PATTERN.test(room);
}

export function parseDisplayName(raw) {
  const text = String(raw ?? '').trim();
  const match = ROLE_SUFFIX_PATTERN.exec(text);
  if (!match) return { name: text, role: 'participant' };
  return { name: match[1].trim(), role: match[2].toUpperCase() };
}

export function buildWireName(name, role) {
  return role === 'participant' ? name : `${name} [${role}]`;
}

export function validateJoin({ name, role }) {
  const typed = parseDisplayName(name);
  const finalRole = typed.role !== 'participant' ? typed.role : role;
  if (typed.name === '') {
    return { ok: false, error: 'Enter a display name of 1 to 32 characters.' };
  }
  const wireName = buildWireName(typed.name, finalRole);
  if (wireName.length > NAME_MAX_LENGTH) {
    return {
      ok: false,
      error:
        finalRole === 'participant'
          ? 'Enter a display name of 1 to 32 characters.'
          : 'Name and role must fit in 32 characters.',
    };
  }
  return { ok: true, name: wireName, role: finalRole };
}

export function buildDeck(observersFree) {
  return observersFree ? `${DECK_NAME}${OBSERVERS_FREE_SUFFIX}` : DECK_NAME;
}

export function parseDeck(deck) {
  const text = typeof deck === 'string' ? deck : '';
  const observersFree = text.endsWith(OBSERVERS_FREE_SUFFIX);
  return {
    deckName: observersFree ? text.slice(0, -OBSERVERS_FREE_SUFFIX.length) : text,
    observersCountTowardLimit: !observersFree,
  };
}

export function buildSocketUrl({ base, room, name, deck }) {
  const url = new URL(base);
  url.searchParams.set('room', room);
  url.searchParams.set('name', name);
  url.searchParams.set('deck', deck);
  return url.toString();
}

export function summarise(state, myId = null) {
  const s = state ?? {};
  const deck = parseDeck(s.deck);
  const votes = s.votes ?? null;
  const members = (s.users ?? []).map((user) => {
    const { name, role } = parseDisplayName(user.name);
    const isParticipant = role === 'participant';
    return {
      id: user.id,
      name,
      role,
      isParticipant,
      isHost: user.id === s.hostId,
      isMe: myId !== null && user.id === myId,
      hasVoted: isParticipant && user.hasVoted === true,
      vote: isParticipant && votes && Object.hasOwn(votes, user.id) ? votes[user.id] : undefined,
      counts: isParticipant || deck.observersCountTowardLimit,
    };
  });

  const revealed = s.revealed === true;
  const participants = members.filter((m) => m.isParticipant);
  const votedCount = participants.filter((m) => m.hasVoted).length;
  const outstanding = participants.length - votedCount;
  const me = members.find((m) => m.isMe) ?? null;
  const countedMembers = members.filter((m) => m.counts).length;
  const revealedVotes = revealed
    ? participants
        .filter((m) => m.vote !== undefined)
        .map((m) => ({ id: m.id, name: m.name, value: m.vote }))
    : [];

  return {
    revealed,
    members,
    participants,
    votedCount,
    outstanding,
    me,
    isHost: Boolean(me?.isHost),
    hostId: s.hostId ?? null,
    canVote: Boolean(me?.isParticipant) && !revealed,
    canReveal: !revealed && participants.length > 0 && outstanding === 0,
    canReset: revealed || votedCount > 0,
    countedMembers,
    observersCountTowardLimit: deck.observersCountTowardLimit,
    shouldLeaveForLimit: Boolean(me?.counts) && countedMembers > MAX_COUNTED_MEMBERS,
    votes: revealedVotes,
    agreement: findAgreement(revealedVotes),
    outliers: findOutliers(revealedVotes),
  };
}

export function findAgreement(votes) {
  if (votes.length < 2) return null;
  const value = votes[0].value;
  return votes.every((v) => v.value === value) ? { value } : null;
}

function toNumber(value) {
  const text = String(value).trim();
  if (text === '') return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function findOutliers(votes) {
  const numeric = votes
    .map((v) => ({ ...v, number: toNumber(v.value) }))
    .filter((v) => v.number !== null);
  if (numeric.length < 2) return [];
  const low = Math.min(...numeric.map((v) => v.number));
  const high = Math.max(...numeric.map((v) => v.number));
  if (low === high) return [];
  return numeric
    .filter((v) => v.number === low || v.number === high)
    .map((v) => ({ id: v.id, name: v.name, value: v.value, side: v.number === low ? 'lowest' : 'highest' }));
}

export function joinList(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function formatOutlierBanner(outliers) {
  if (outliers.length === 0) return null;
  return `${joinList(outliers.map((o) => `${o.name} (${o.value})`))}, please explain your estimates`;
}
