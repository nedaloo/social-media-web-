const API = '../api/index.php';
let activeConversation = null;
let currentMe = null;
const conversationMap = new Map();

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const avatarUrl = (value) => {
  if (!value) return '../prof/blank-profile-pic.png';
  if (/^(https?:|data:|blob:|\/|\.\.\/)/i.test(value)) return value;
  if (value.includes('/')) return `../${value}`;
  return `../prof/${value}`;
};

const api = async (action, options = {}) => {
  const r = await fetch(`${API}?action=${action}${options.query || ''}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const j = await r.json();
  if (r.status === 401) {
    location.href = '../log in/index .html';
    throw Error(j.error);
  }
  if (!r.ok) throw Error(j.error || 'Request failed');
  return j;
};

const time = (v) => (v ? new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

function setImgWithFallback(img, value) {
  if (!img) return;
  img.onerror = () => {
    img.onerror = null;
    img.src = '../prof/blank-profile-pic.png';
  };
  img.src = avatarUrl(value);
}

function updateUnreadBadges(conversations, groups) {
  const chatsEl = document.querySelector('#chats-unread-count');
  const groupsEl = document.querySelector('#groups-unread-count');
  if (chatsEl && Array.isArray(conversations)) {
    const activeId = activeConversation ? Number(activeConversation.id) : null;
    const totalChatsUnread = conversations.reduce(
      (sum, c) => sum + (Number(c.id) === activeId ? 0 : Number(c.unread || 0)),
      0
    );
    chatsEl.textContent = String(totalChatsUnread);
  }
  if (groupsEl && Array.isArray(groups)) {
    const totalGroupsUnread = groups.reduce((sum, g) => sum + Number(g.unread || 0), 0);
    groupsEl.textContent = String(totalGroupsUnread);
  }
}

async function loadMe() {
  const { user } = await api('me');
  currentMe = user;
  document.querySelectorAll('.top-actions img, .nav-avatar img').forEach((img) => setImgWithFallback(img, user.avatar));
  return user;
}

function conversationStatus(user) {
  const online = Number(user?.online) === 1;
  const typing = online && Number(user?.typing) === 1;
  if (typing) return { dotClass: 'online typing', textClass: 'typing', text: 'Typing...' };
  if (online) return { dotClass: 'online', textClass: 'online', text: 'Online · Active now' };
  return { dotClass: 'offline', textClass: 'offline', text: 'Offline' };
}

function profileHref(username) {
  return `../prof/profile.HTML?username=${encodeURIComponent(username || '')}`;
}

function messageHtml(m, me) {
  const mine = Number(m.sender_id) === Number(me.id);
  const avatar = esc(avatarUrl(m.avatar));
  return `<div class="message ${mine ? 'sent' : ''}">${
    mine ? '' : `<img class="avatar" src="${avatar}" onerror="this.onerror=null;this.src='../prof/blank-profile-pic.png'" alt="">`
  }<div>${
    mine
      ? `<div>${esc(m.body)}</div><small class="read-state ${m.seen_at ? 'seen' : ''}">${m.seen_at ? '✓✓ Seen' : '✓ Sent'}</small>`
      : `<div>${esc(m.body)}</div>`
  }<time>${time(m.created_at)}</time></div></div>`;
}

function renderChatList(items, activeId) {
  const list = document.querySelector('.chat-list');
  if (!list) return;
  conversationMap.clear();
  items.forEach((c) => conversationMap.set(Number(c.id), c));

  list.innerHTML = items.length
    ? items
        .map((c) => {
          const isActive = Number(c.id) === Number(activeId);
          const unread = isActive ? 0 : Number(c.unread || 0);
          return `<button type="button" class="chat-row ${isActive ? 'active' : ''}" data-id="${c.id}"><img class="avatar" src="${esc(
            avatarUrl(c.avatar)
          )}" onerror="this.onerror=null;this.src='../prof/blank-profile-pic.png'" alt=""><div><div><strong class="username">${esc(
            c.display_name || c.username
          )}</strong><time>${time(c.last_time)}</time></div><div><span>${esc(
            c.preview || 'Start a new conversation...'
          )}</span>${unread ? `<b>${unread}</b>` : ''}</div></div></button>`;
        })
        .join('')
    : '<p>No conversations yet. Click + to start one.</p>';

  const headingCount = document.querySelector('.sidebar-heading p');
  if (headingCount) {
    headingCount.textContent = `${items.filter((x) => Number(x.online)).length} online now`;
  }
}

let lastTypingSentAt = 0;
let typingStopTimer = null;

function notifyTyping(isTyping) {
  const now = Date.now();
  if (isTyping) {
    if (now - lastTypingSentAt >= 1500) {
      lastTypingSentAt = now;
      api('typing', { method: 'POST', body: { typing: true } }).catch(() => {});
    }
    clearTimeout(typingStopTimer);
    typingStopTimer = setTimeout(() => {
      lastTypingSentAt = 0;
      api('typing', { method: 'POST', body: { typing: false } }).catch(() => {});
    }, 2500);
  } else {
    clearTimeout(typingStopTimer);
    lastTypingSentAt = 0;
    api('typing', { method: 'POST', body: { typing: false } }).catch(() => {});
  }
}

async function loadConversation(id, user, me) {
  activeConversation = { id: Number(id), user };
  if (conversationMap.has(Number(id))) {
    conversationMap.get(Number(id)).unread = 0;
  }

  document.querySelectorAll('.chat-list .chat-row').forEach((row) => {
    const isMatch = Number(row.dataset.id) === Number(id);
    row.classList.toggle('active', isMatch);
    if (isMatch) row.querySelector('b')?.remove();
  });

  const data = await api('messages', { query: `&conversation_id=${id}` });
  const status = conversationStatus(user);
  const convEl = document.querySelector('.conversation');
  convEl.innerHTML = `<header class="conversation-head"><div class="person"><a class="profile-link" href="${profileHref(
    user.username
  )}" title="View profile"><img class="avatar" src="${esc(
    avatarUrl(user.avatar)
  )}" onerror="this.onerror=null;this.src='../prof/blank-profile-pic.png'" alt=""></a><div><a class="profile-link" href="${profileHref(
    user.username
  )}" title="View profile"><h2>${esc(
    user.display_name || user.username
  )}</h2></a><p><span class="status-dot ${status.dotClass}"></span><span class="status-text ${status.textClass}">${
    status.text
  }</span></p></div></div></header><div class="messages">${data.items
    .map((m) => messageHtml(m, me))
    .join('')}</div><form class="composer"><div class="input-wrap"><input class="message-input" placeholder="write a message"><button class="send-btn" type="submit">Send</button></div></form>`;

  const box = convEl.querySelector('.messages');
  box.scrollTop = box.scrollHeight;

  const input = convEl.querySelector('.message-input');
  input.addEventListener('input', () => {
    notifyTyping(input.value.trim().length > 0);
  });
  input.addEventListener('blur', () => {
    notifyTyping(false);
  });

  convEl.querySelector('.composer').onsubmit = async (e) => {
    e.preventDefault();
    const messageText = input.value.trim();
    if (!messageText) return;
    notifyTyping(false);
    await api('send', { method: 'POST', body: { conversation_id: id, message: messageText } });
    input.value = '';
    const freshUser = conversationMap.get(Number(id)) || user;
    await loadConversation(id, freshUser, me);
    const [convData, groupData] = await Promise.all([api('conversations'), api('groups')]);
    renderChatList(convData.items, id);
    updateUnreadBadges(convData.items, groupData.items);
  };
}

function bindChatListClicks() {
  const list = document.querySelector('.chat-list');
  if (!list || list.dataset.bound) return;
  list.dataset.bound = '1';
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.chat-row');
    if (!row) return;
    const conv = conversationMap.get(Number(row.dataset.id));
    if (!conv || !currentMe) return;
    loadConversation(conv.id, conv, currentMe).then(() => {
      updateUnreadBadges(Array.from(conversationMap.values()), null);
    });
  });
}

async function loadChats(targetConversationId = null) {
  const me = await loadMe();
  const [data, groupData] = await Promise.all([api('conversations'), api('groups')]);
  const selected =
    (targetConversationId && data.items.find((x) => Number(x.id) === Number(targetConversationId))) ||
    (activeConversation && data.items.find((x) => Number(x.id) === Number(activeConversation.id))) ||
    data.items[0] ||
    null;

  renderChatList(data.items, selected?.id || null);
  bindChatListClicks();

  if (selected) {
    await loadConversation(selected.id, selected, me);
  } else {
    document.querySelector('.conversation').innerHTML =
      '<div class="empty-state"><h2>No conversation selected</h2><p>Click + to start a new chat.</p></div>';
  }
  updateUnreadBadges(Array.from(conversationMap.values()), groupData.items);
}

async function newConversation() {
  if (document.querySelector('.popup')) return;
  const p = document.createElement('div');
  p.className = 'popup';
  p.innerHTML =
    '<div class="popup-content"><h2>New Conversation</h2><p>Enter a username:</p><input id="newUsername" placeholder="Username"><p class="popup-error"></p><div class="popup-buttons"><button type="button" id="createConversation">Create</button><button type="button" class="close">Cancel</button></div></div>';
  document.body.append(p);

  const input = p.querySelector('#newUsername');
  const errEl = p.querySelector('.popup-error');
  const createBtn = p.querySelector('#createConversation');
  input.focus();
  p.querySelector('.close').onclick = () => p.remove();

  const submitCreate = async () => {
    errEl.textContent = '';
    createBtn.disabled = true;
    try {
      const created = await api('create_conversation', { method: 'POST', body: { username: input.value.trim() } });
      p.remove();
      await loadChats(created.id);
    } catch (e) {
      createBtn.disabled = false;
      errEl.textContent = e.message;
    }
  };

  createBtn.onclick = submitCreate;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitCreate();
    }
  });
}

function openProfile() {
  location.href = '../prof/profile.HTML';
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.conversation .messages')?.replaceChildren();
  const username = new URLSearchParams(location.search).get('username');
  (async () => {
    if (username) {
      try {
        const created = await api('create_conversation', { method: 'POST', body: { username } });
        history.replaceState({}, '', location.pathname);
        await loadChats(created.id);
        return;
      } catch (e) {
        console.error(e.message);
      }
    }
    await loadChats();
  })().catch((e) => console.error(e));
});

window.newConversation = newConversation;
window.openProfile = openProfile;
window.avatarUrl = avatarUrl;
window.updateUnreadBadges = updateUnreadBadges;
window.renderChatList = renderChatList;
window.conversationStatus = conversationStatus;
window.conversationMap = conversationMap;
