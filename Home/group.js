const API = '../api/index.php';
let activeGroup = null;
let currentMe = null;
const groupMap = new Map();

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const avatarUrl = (value) => {
  if (!value) return '../prof/blank-profile-pic.png';
  if (/^(https?:|data:|blob:|\/|\.\.\/)/i.test(value)) return value;
  if (value.includes('/')) return `../${value}`;
  return `../prof/${value}`;
};

const api = async (a, o = {}) => {
  const r = await fetch(`${API}?action=${a}${o.query || ''}`, {
    method: o.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: o.body ? JSON.stringify(o.body) : undefined,
  });
  const j = await r.json();
  if (r.status === 401) {
    location.href = '../log in/index .html';
    throw Error(j.error);
  }
  if (!r.ok) throw Error(j.error || 'Request failed');
  return j;
};

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
    const totalChatsUnread = conversations.reduce((sum, c) => sum + Number(c.unread || 0), 0);
    chatsEl.textContent = String(totalChatsUnread);
  }
  if (groupsEl && Array.isArray(groups)) {
    const activeId = activeGroup ? Number(activeGroup.id) : null;
    const totalGroupsUnread = groups.reduce(
      (sum, g) => sum + (Number(g.id) === activeId ? 0 : Number(g.unread || 0)),
      0
    );
    groupsEl.textContent = String(totalGroupsUnread);
  }
}

function groupStatus(members, me) {
  const typingNames = members
    .filter((x) => Number(x.user_id) !== Number(me?.id) && Number(x.online) === 1 && Number(x.typing) === 1)
    .map((x) => x.display_name || x.username);
  const onlineCount = members.filter((x) => Number(x.online) === 1).length;
  if (typingNames.length) {
    return { dotClass: 'online typing', textClass: 'typing', text: `${typingNames.join(', ')} typing...` };
  }
  return {
    dotClass: onlineCount ? 'online' : 'offline',
    textClass: onlineCount ? 'online' : 'offline',
    text: `${onlineCount} online now`,
  };
}

function profileHref(username) {
  return `../prof/profile.HTML?username=${encodeURIComponent(username || '')}`;
}

const msg = (m, me) => {
  const mine = Number(m.sender_id) === Number(me.id);
  const avatar = esc(avatarUrl(m.avatar));
  return `<div class="message ${mine ? 'sent' : ''}">${
    mine
      ? ''
      : `<img class="avatar" src="${avatar}" onerror="this.onerror=null;this.src='../prof/blank-profile-pic.png'" alt="">`
  }<div>${mine ? '' : `<span class="sender-label">${esc(m.display_name)}</span>`}<div>${esc(m.body)}</div><time>${
    m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  } ${
    mine ? `<small class="read-state ${m.seen_at ? 'seen' : ''}">${m.seen_at ? '✓✓ Seen' : '✓ Sent'}</small>` : ''
  }</time></div></div>`;
};

function renderGroupList(items, activeId) {
  const list = document.querySelector('.chat-list');
  if (!list) return;
  groupMap.clear();
  items.forEach((g) => groupMap.set(Number(g.id), g));

  list.innerHTML = items.length
    ? items
        .map((g) => {
          const isActive = Number(g.id) === Number(activeId);
          const unread = isActive ? 0 : Number(g.unread || 0);
          return `<button type="button" class="chat-row ${isActive ? 'active' : ''}" data-id="${
            g.id
          }"><img class="avatar" src="../prof/blank-profile-pic.png" alt=""><div><div><strong>${esc(
            g.name
          )}</strong><time></time></div><div><span>${g.members} members</span>${
            unread ? `<b>${unread}</b>` : ''
          }</div></div></button>`;
        })
        .join('')
    : '<p>No groups yet. Click + to create one.</p>';

  const groupCountEl = document.querySelector('#group-count');
  if (groupCountEl) {
    groupCountEl.textContent = `${items.length} active groups`;
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

async function openGroup(g, me) {
  activeGroup = g;
  if (groupMap.has(Number(g.id))) {
    groupMap.get(Number(g.id)).unread = 0;
  }

  document.querySelectorAll('.chat-list .chat-row').forEach((row) => {
    const isMatch = Number(row.dataset.id) === Number(g.id);
    row.classList.toggle('active', isMatch);
    if (isMatch) row.querySelector('b')?.remove();
  });

  const d = await api('group', { query: `&group_id=${g.id}` });
  const members = d.members;
  const status = groupStatus(members, me);

  const convEl = document.querySelector('.conversation');
  convEl.innerHTML = `<header class="conversation-head"><div class="person"><img class="avatar" src="../prof/blank-profile-pic.png" alt=""><div><h2>${esc(
    g.name
  )} <button type="button" id="member-count" aria-label="Show group members">${members.length} members</button></h2><p><span class="status-dot ${
    status.dotClass
  }"></span><span class="status-text ${status.textClass}">${esc(
    status.text
  )}</span></p></div></div><button class="add-member-btn" type="button" onclick="addMember()">+ Add Member</button></header><div class="messages">${d.messages
    .map((x) => msg(x, me))
    .join('')}</div><form class="composer"><div class="input-wrap"><input class="message-input" placeholder="write message"><button class="send-btn" type="submit">Send</button></div></form>`;

  convEl.querySelector('#member-count').onclick = () => showMembers(g.id, me);

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
    await api('group_send', { method: 'POST', body: { group_id: g.id, message: messageText } });
    input.value = '';
    await openGroup(g, me);
    const [convData, groupData] = await Promise.all([api('conversations'), api('groups')]);
    renderGroupList(groupData.items, g.id);
    updateUnreadBadges(convData.items, groupData.items);
  };
}

function renderMemberItems(members, ownerId) {
  if (!members.length) return '<li class="empty-members">No members in this group.</li>';
  return members
    .map(
      (member) => `<li class="member-item" data-member-id="${member.user_id}"><a class="member-info" href="${profileHref(
        member.username
      )}"><img class="member-avatar" src="${esc(
        avatarUrl(member.avatar)
      )}" onerror="this.onerror=null;this.src='../prof/blank-profile-pic.png'" alt=""><span class="member-name">${esc(
        member.display_name || member.username
      )}</span></a>${
        Number(member.user_id) === Number(ownerId)
          ? '<span class="member-owner">Owner</span>'
          : `<button type="button" class="remove-member-btn" data-user-id="${member.user_id}">Remove</button>`
      }</li>`
    )
    .join('');
}

async function showMembers(groupId, me) {
  if (document.querySelector('.popup')) return;
  const d = await api('group', { query: `&group_id=${groupId}` });
  const members = d.members || [];
  const ownerId = d.group?.owner_id ?? activeGroup?.owner_id;
  if (activeGroup && Number(activeGroup.id) === Number(groupId)) {
    activeGroup = { ...activeGroup, ...d.group, members: members.length };
  }

  const popup = document.createElement('div');
  popup.className = 'popup members-popup';
  popup.innerHTML = `<div class="popup-content"><div class="members-popup-head"><h2>Group Members</h2><button type="button" class="members-close" aria-label="Close">&times;</button></div><ul class="member-list">${renderMemberItems(
    members,
    ownerId
  )}</ul><p class="popup-error"></p><div class="popup-buttons"><button type="button" class="close">Close</button></div></div>`;
  document.body.append(popup);

  const close = () => {
    document.removeEventListener('keydown', onKeyDown);
    popup.remove();
  };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKeyDown);
  popup.querySelector('.members-close').onclick = close;
  popup.querySelector('.close').onclick = close;
  popup.addEventListener('click', (event) => {
    if (event.target === popup) close();
  });
  popup.querySelectorAll('.remove-member-btn').forEach((button) => {
    button.onclick = () => removeMember(Number(button.dataset.userId), popup, me);
  });
}

async function removeMember(userId, popup, me) {
  const button = popup.querySelector(`[data-user-id="${userId}"]`);
  const error = popup.querySelector('.popup-error');
  error.textContent = '';
  if (button) button.disabled = true;
  try {
    await api('remove_member', { method: 'POST', body: { group_id: activeGroup.id, user_id: userId } });
    popup.querySelector(`.member-item[data-member-id="${userId}"]`)?.remove();
    const listEl = popup.querySelector('.member-list');
    const remaining = listEl.querySelectorAll('.member-item').length;
    if (!remaining) listEl.innerHTML = '<li class="empty-members">No members in this group.</li>';

    const countEl = document.querySelector('#member-count');
    if (countEl) countEl.textContent = `${remaining} members`;

    const [convData, groupData] = await Promise.all([api('conversations'), api('groups')]);
    renderGroupList(groupData.items, activeGroup.id);
    updateUnreadBadges(convData.items, groupData.items);

    const gData = await api('group', { query: `&group_id=${activeGroup.id}` });
    const head = document.querySelector('.conversation-head');
    if (head) {
      const status = groupStatus(gData.members, me);
      const dot = head.querySelector('.status-dot');
      const statusEl = head.querySelector('.status-text');
      if (dot) dot.className = `status-dot ${status.dotClass}`;
      if (statusEl) {
        statusEl.className = `status-text ${status.textClass}`;
        statusEl.textContent = status.text;
      }
    }
  } catch (e) {
    if (button) button.disabled = false;
    error.textContent = e.message;
  }
}

function bindGroupListClicks() {
  const list = document.querySelector('.chat-list');
  if (!list || list.dataset.bound) return;
  list.dataset.bound = '1';
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.chat-row');
    if (!row) return;
    const g = groupMap.get(Number(row.dataset.id));
    if (!g || !currentMe) return;
    openGroup(g, currentMe).then(() => {
      updateUnreadBadges(null, Array.from(groupMap.values()));
    });
  });
}

async function loadGroups(targetGroupId = null) {
  const [meData, d, convData] = await Promise.all([api('me'), api('groups'), api('conversations')]);
  const me = meData.user;
  currentMe = me;
  document.querySelectorAll('.top-actions img').forEach((x) => setImgWithFallback(x, me.avatar));

  const selected =
    (targetGroupId && d.items.find((g) => Number(g.id) === Number(targetGroupId))) ||
    (activeGroup && d.items.find((g) => Number(g.id) === Number(activeGroup.id))) ||
    d.items[0] ||
    null;

  renderGroupList(d.items, selected?.id || null);
  bindGroupListClicks();

  if (selected) {
    await openGroup(selected, me);
  } else {
    document.querySelector('.conversation').innerHTML =
      '<div class="empty-state"><h2>No group selected</h2><p>Click + to create a group.</p></div>';
  }
  updateUnreadBadges(convData.items, Array.from(groupMap.values()));
}

async function newGroup() {
  if (document.querySelector('.popup')) return;
  const p = document.createElement('div');
  p.className = 'popup';
  p.innerHTML =
    '<div class="popup-content"><h2>New Group</h2><input placeholder="Group name"><p class="popup-error"></p><div class="popup-buttons"><button type="button" id="createGroup">Create</button><button type="button" class="close">Cancel</button></div></div>';
  document.body.append(p);
  const input = p.querySelector('input');
  input.focus();
  p.querySelector('.close').onclick = () => p.remove();
  p.querySelector('#createGroup').onclick = async () => {
    try {
      const created = await api('create_group', { method: 'POST', body: { name: input.value.trim() } });
      p.remove();
      await loadGroups(created.id);
    } catch (e) {
      p.querySelector('.popup-error').textContent = e.message;
    }
  };
}

async function addMember() {
  if (!activeGroup || document.querySelector('.popup')) return;
  const p = document.createElement('div');
  p.className = 'popup';
  p.innerHTML =
    '<div class="popup-content"><h2>Add Member</h2><input placeholder="Username"><p class="popup-error"></p><div class="popup-buttons"><button type="button" id="add">Add</button><button type="button" class="close">Cancel</button></div></div>';
  document.body.append(p);
  const input = p.querySelector('input');
  input.focus();
  p.querySelector('.close').onclick = () => p.remove();
  p.querySelector('#add').onclick = async () => {
    try {
      await api('add_member', { method: 'POST', body: { group_id: activeGroup.id, username: input.value.trim() } });
      p.remove();
      await loadGroups(activeGroup.id);
    } catch (e) {
      p.querySelector('.popup-error').textContent = e.message;
    }
  };
}

function openProfile() {
  location.href = '../prof/profile.HTML';
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.conversation .messages')?.replaceChildren();
  loadGroups().catch(console.error);
});

window.newGroup = newGroup;
window.addMember = addMember;
window.showMembers = showMembers;
window.openProfile = openProfile;
window.avatarUrl = avatarUrl;
window.updateUnreadBadges = updateUnreadBadges;
window.renderGroupList = renderGroupList;
window.groupStatus = groupStatus;
window.groupMap = groupMap;
