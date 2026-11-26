import {
  DECK_CARDS,
  MAX_COUNTED_MEMBERS,
  ROLE_LABELS,
  buildDeck,
  buildSocketUrl,
  formatOutlierBanner,
  generateRoomId,
  isValidRoomId,
  joinList,
  summarise,
  validateJoin,
} from './logic.js';
import { connectRoom } from './socket.js';
import { playFireworks } from './fireworks.js';

const WS_BASE = 'wss://planning-poker-backend-ymq7.onrender.com/ws';
const CELEBRATION_MS = 4000;
const SLOW_CONNECT_MS = 15000;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

const $ = (id) => document.getElementById(id);
const el = {
  joinView: $('join-view'),
  roomView: $('room-view'),
  joinForm: $('join-form'),
  name: $('name'),
  nameError: $('name-error'),
  observersFree: $('observers-free'),
  roomLink: $('room-link'),
  copyLink: $('copy-link'),
  joinStatus: $('join-status'),
  joinError: $('join-error'),
  submitJoin: $('submit-join'),
  roomId: $('room-id'),
  myRole: $('my-role'),
  status: $('status'),
  alerts: $('alerts'),
  adminToggle: $('admin-toggle'),
  reconnect: $('reconnect'),
  rejoin: $('rejoin'),
  roster: $('roster'),
  cards: $('cards'),
  reveal: $('reveal'),
  reset: $('reset'),
  revealHint: $('reveal-hint'),
  banner: $('outlier-banner'),
  bannerText: $('outlier-text'),
  bannerDismiss: $('outlier-dismiss'),
  results: $('results'),
  resultsList: $('results-list'),
  agreement: $('agreement'),
  agreementText: $('agreement-text'),
  agreementDismiss: $('agreement-dismiss'),
  fireworks: $('fireworks'),
  admin: $('admin'),
  adminCount: $('admin-count'),
  adminSetting: $('admin-setting'),
  adminList: $('admin-list'),
};

const app = {
  roomId: null,
  lastJoin: null,
  session: null,
  myId: null,
  summary: null,
  selection: null,
  adminOpen: false,
  bannerDismissed: false,
  agreementDismissed: false,
  stopFireworks: null,
};

function init() {
  const params = new URLSearchParams(window.location.search);
  let room = params.get('room');
  if (room === null) {
    room = generateRoomId();
    window.history.replaceState(null, '', `?room=${room}`);
  }
  app.roomId = room;
  el.roomLink.value = window.location.href;

  buildCards();
  el.joinForm.addEventListener('submit', onJoinSubmit);
  el.copyLink.addEventListener('click', copyLink);
  el.reveal.addEventListener('click', () => send({ type: 'reveal' }));
  el.reset.addEventListener('click', () => send({ type: 'reset' }));
  el.adminToggle.addEventListener('click', () => {
    app.adminOpen = !app.adminOpen;
    render();
  });
  el.rejoin.addEventListener('click', () => startSession(app.lastJoin));
  el.bannerDismiss.addEventListener('click', () => {
    app.bannerDismissed = true;
    render();
  });
  el.agreementDismiss.addEventListener('click', () => {
    app.agreementDismissed = true;
    render();
  });

  showJoin(isValidRoomId(room) ? '' : 'This room link is not valid. Open the app without a room to start a new one.');
}

function buildCards() {
  for (const value of DECK_CARDS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'card';
    button.textContent = value;
    button.dataset.value = value;
    button.setAttribute('aria-label', `Vote ${value}`);
    button.addEventListener('click', () => vote(value));
    el.cards.append(button);
  }
}

function showJoin(message = '') {
  leaveSession();
  el.roomView.hidden = true;
  el.joinView.hidden = false;
  el.joinError.textContent = message;
  el.submitJoin.disabled = !isValidRoomId(app.roomId);
}

function showRoom() {
  el.joinView.hidden = true;
  el.roomView.hidden = false;
  el.joinError.textContent = '';
  el.joinStatus.textContent = '';
}

function onJoinSubmit(event) {
  event.preventDefault();
  const role = document.querySelector('input[name="role"]:checked').value;
  const result = validateJoin({ name: el.name.value, role });
  if (!result.ok) {
    el.nameError.textContent = result.error;
    el.name.setAttribute('aria-invalid', 'true');
    el.name.focus();
    return;
  }
  el.nameError.textContent = '';
  el.name.removeAttribute('aria-invalid');
  startSession({ name: result.name, observersFree: el.observersFree.checked });
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(el.roomLink.value);
    el.joinStatus.textContent = 'Room link copied.';
  } catch {
    el.roomLink.select();
    el.joinStatus.textContent = 'Select the link and copy it manually.';
  }
}

function startSession(join) {
  leaveSession();
  app.lastJoin = join;
  app.myId = null;
  app.summary = null;
  app.selection = null;
  app.bannerDismissed = false;
  app.agreementDismissed = false;
  el.reconnect.hidden = true;
  el.alerts.textContent = '';
  showRoom();

  const session = { welcomed: false, admitted: false, leaving: false, timer: null, connection: null };
  app.session = session;
  setStatus('Connecting to the room...');
  session.timer = setTimeout(() => {
    if (app.session === session && !session.welcomed) {
      setStatus('Still connecting. The server may be waking up, which can take up to a minute.');
    }
  }, SLOW_CONNECT_MS);

  session.connection = connectRoom({
    url: buildSocketUrl({ base: WS_BASE, room: app.roomId, name: join.name, deck: buildDeck(join.observersFree) }),
    onOpen: () => {
      if (app.session === session) setStatus('Connected. Waiting for the room...');
    },
    onMessage: (message) => handleMessage(session, message),
    onClose: () => handleClose(session),
  });
  render();
}

function leaveSession() {
  const session = app.session;
  app.session = null;
  if (session) {
    session.leaving = true;
    clearTimeout(session.timer);
    session.connection.close();
  }
  stopFireworks();
}

function handleMessage(session, message) {
  if (app.session !== session) return;
  if (message.type === 'welcome') {
    session.welcomed = true;
    clearTimeout(session.timer);
    app.myId = message.userId;
    setStatus('Joined the room.');
    render();
  } else if (message.type === 'state') {
    handleState(session, message);
  } else if (message.type === 'error') {
    el.alerts.textContent = message.message;
  }
}

function handleClose(session) {
  if (app.session !== session || session.leaving) return;
  clearTimeout(session.timer);
  app.session = null;
  stopFireworks();
  if (!session.welcomed) {
    showJoin('Could not join the room. The room may be full, or the room or name may not be valid.');
    return;
  }
  el.reconnect.hidden = false;
  setStatus('Disconnected. Your vote is no longer counted.');
  render();
}

function handleState(session, state) {
  const previous = app.summary;
  const summary = summarise(state, app.myId);

  if (!session.admitted) {
    if (summary.shouldLeaveForLimit) {
      showJoin(`This room is full. It holds ${MAX_COUNTED_MEMBERS} members who count toward the limit.`);
      return;
    }
    session.admitted = true;
  }

  app.summary = summary;
  el.alerts.textContent = '';
  updateSelection(previous, summary);

  if (previous && previous.revealed !== summary.revealed) {
    app.bannerDismissed = false;
    app.agreementDismissed = false;
  }
  const justRevealed = Boolean(previous) && !previous.revealed && summary.revealed;
  if (justRevealed && summary.agreement && !REDUCED_MOTION.matches) {
    stopFireworks();
    app.stopFireworks = playFireworks(el.fireworks, CELEBRATION_MS);
  }

  const announcement = describeChange(previous, summary);
  if (announcement) setStatus(announcement);
  render();
}

function updateSelection(previous, summary) {
  const me = summary.me;
  if (!me) return;
  if (summary.revealed && me.vote !== undefined) {
    app.selection = me.vote;
  } else if (previous && previous.revealed && !summary.revealed) {
    app.selection = null;
  } else if (previous?.me?.hasVoted && !me.hasVoted) {
    app.selection = null;
  }
}

function describeChange(previous, summary) {
  if (!previous) return '';
  if (!previous.revealed && summary.revealed) {
    const parts = ['Votes revealed.'];
    if (summary.agreement) parts.push(`The team agrees on ${summary.agreement.value}.`);
    const banner = formatOutlierBanner(summary.outliers);
    if (banner) parts.push(`${banner}.`);
    return parts.join(' ');
  }
  if (previous.revealed && !summary.revealed) return 'Votes reset. Voting is open.';
  if (summary.revealed) return '';

  const previouslyVoted = new Set(previous.members.filter((m) => m.hasVoted).map((m) => m.id));
  const newlyVoted = summary.members
    .filter((m) => m.hasVoted && !previouslyVoted.has(m.id) && !m.isMe)
    .map((m) => m.name);
  if (newlyVoted.length === 0) return '';
  const outstanding = summary.outstanding;
  return `${joinList(newlyVoted)} voted. ${outstanding} ${outstanding === 1 ? 'vote' : 'votes'} outstanding.`;
}

function vote(value) {
  if (!app.session?.welcomed || !app.summary?.canVote) return;
  app.session.connection.send({ type: 'vote', value });
  app.selection = value;
  render();
}

function send(message) {
  if (app.session?.welcomed) app.session.connection.send(message);
}

function stopFireworks() {
  app.stopFireworks?.();
  app.stopFireworks = null;
}

function setStatus(text) {
  el.status.textContent = text;
}

function render() {
  const s = app.summary;
  const connected = Boolean(app.session?.welcomed);
  const isHost = connected && Boolean(s?.isHost);

  el.roomId.textContent = app.roomId ?? '';
  el.adminToggle.hidden = !isHost;
  el.adminToggle.setAttribute('aria-expanded', String(isHost && app.adminOpen));
  el.admin.hidden = !(isHost && app.adminOpen);
  el.reveal.hidden = !isHost;
  el.reveal.disabled = !(connected && s?.canReveal);
  el.reveal.textContent = s?.revealed ? 'Votes revealed' : 'Reveal votes';
  el.reset.hidden = !isHost;
  el.reset.disabled = !(connected && s?.canReset);
  el.revealHint.textContent = revealHint(s, connected);
  el.myRole.textContent = s?.me
    ? s.me.isParticipant
      ? 'You are voting.'
      : `You are observing as ${ROLE_LABELS[s.me.role]}. You cannot vote.`
    : '';

  el.roster.replaceChildren(...(s?.members ?? []).map((m) => rosterItem(m, s)));

  for (const card of el.cards.children) {
    const value = card.dataset.value;
    const selected = app.selection === value;
    card.setAttribute('aria-pressed', String(selected));
    card.classList.toggle('selected', selected);
    card.disabled = !(connected && s?.canVote);
  }

  el.results.hidden = !s?.revealed;
  el.resultsList.replaceChildren(...(s?.revealed ? s.votes.map((v) => resultItem(v, s.outliers)) : []));

  const bannerText = s?.revealed && !app.bannerDismissed ? formatOutlierBanner(s.outliers) : null;
  el.banner.hidden = !bannerText;
  el.bannerText.textContent = bannerText ?? '';

  const showAgreement = Boolean(s?.revealed && s.agreement && !app.agreementDismissed);
  el.agreement.hidden = !showAgreement;
  el.agreementText.textContent = showAgreement ? `The team agrees on ${s.agreement.value}` : '';

  renderAdmin(s);
}

function revealHint(s, connected) {
  if (!connected || !s || s.revealed) return '';
  if (s.participants.length === 0) return 'Reveal is available once at least one participant has joined.';
  if (s.outstanding > 0) {
    return `Waiting for ${s.outstanding} ${s.outstanding === 1 ? 'vote' : 'votes'} before reveal.`;
  }
  return '';
}

function memberStatus(member, s) {
  if (!member.isParticipant) return 'Observing';
  if (s.revealed) return member.vote ?? 'No vote';
  return member.hasVoted ? 'Voted' : 'Not voted';
}

function rosterItem(member, s) {
  const item = document.createElement('li');
  item.className = 'member';

  const name = document.createElement('span');
  name.className = 'member-name';
  name.textContent = member.isMe ? `${member.name} (you)` : member.name;
  item.append(name);

  if (member.isHost) item.append(badge('Host'));
  if (!member.isParticipant) item.append(badge(ROLE_LABELS[member.role]));

  const status = document.createElement('span');
  status.className = 'member-status';
  status.textContent = memberStatus(member, s);
  item.append(status);
  return item;
}

function resultItem(vote, outliers) {
  const outlier = outliers.find((o) => o.id === vote.id);
  const item = document.createElement('li');
  item.className = outlier ? 'result outlier' : 'result';
  item.textContent = `${vote.name}: ${vote.value}`;
  if (outlier) item.append(' ', badge(`Outlier, ${outlier.side}`));
  return item;
}

function badge(text) {
  const span = document.createElement('span');
  span.className = 'badge';
  span.textContent = text;
  return span;
}

function renderAdmin(s) {
  el.adminCount.textContent = s
    ? `${s.countedMembers} of ${MAX_COUNTED_MEMBERS} members count toward the limit.`
    : '';
  el.adminSetting.textContent = s
    ? `${s.observersCountTowardLimit ? 'Observers (DM and PM) count toward the limit.' : 'Observers (DM and PM) do not count toward the limit.'} This was set when the room was created and cannot be changed during this session.`
    : '';
  el.adminList.replaceChildren(
    ...(s?.members ?? []).map((m) => {
      const item = document.createElement('li');
      const host = m.isHost ? ', host' : '';
      item.textContent = `${m.name}, ${ROLE_LABELS[m.role]}${host}, ${memberStatus(m, s)}`;
      return item;
    }),
  );
}

init();
