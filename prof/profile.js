function opengroup() {
  window.location.href = '../Home/group.html';
}

function openchat() {
  window.location.href = '../Home/index.html';
}

const PROFILE_API = '../api/index.php';

const profileApi = async (action, options = {}) => {
  const response = await fetch(`${PROFILE_API}?action=${action}${options.query || ''}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json();
  if (response.status === 401) {
    location.href = '../log in/index .html';
    throw new Error(data.error || 'Please log in first.');
  }
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
};

const safeProfile = (value) =>
  String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const avatarUrl = (value) => {
  if (!value) return '../prof/blank-profile-pic.png';
  if (/^(https?:|data:|blob:|\/|\.\.\/)/i.test(value)) return value;
  if (value.includes('/')) return `../${value}`;
  return `../prof/${value}`;
};

function setImgWithFallback(img, src) {
  if (!img) return;
  img.onerror = () => {
    img.onerror = null;
    img.src = '../prof/blank-profile-pic.png';
  };
  img.src = avatarUrl(src);
}

async function loadProfile() {
  const username = new URLSearchParams(location.search).get('username');
  const [meData, data] = await Promise.all([
    profileApi('me'),
    profileApi('profile', { query: username ? `&username=${encodeURIComponent(username)}` : '' }),
  ]);

  const me = meData.user;
  const user = data.user;
  const profileAvatar = avatarUrl(user.avatar);

  document.querySelector('.profile-name').textContent = user.display_name;
  document.querySelector('.profile-handle').textContent = `@${user.username}`;
  document.querySelector('.profile-stats').textContent = `${data.friends.length} Friends`;
  setImgWithFallback(document.querySelector('.profile-avatar'), profileAvatar);
  setImgWithFallback(document.querySelector('.nav-avatar img'), me.avatar);

  const action = document.querySelector('.edit-profile-btn');
  action.textContent = data.own ? 'Edit Profile' : 'Message';
  action.onclick = data.own
    ? editProfile
    : () => {
        location.href = `../Home/index.html?username=${encodeURIComponent(user.username)}`;
      };

  const friendsCard = document.querySelector('.friends-card');
  friendsCard.innerHTML = `<h3 class="card-title">Friends</h3>${
    data.friends
      .map(
        (friend) =>
          `<div class="friend-item" data-user="${safeProfile(friend.username)}"><img class="avatar" src="${safeProfile(
            avatarUrl(friend.avatar)
          )}" onerror="this.onerror=null;this.src='../prof/blank-profile-pic.png'"><div><p class="friend-name">${safeProfile(
            friend.display_name
          )}</p><p class="friend-handle">@${safeProfile(friend.username)} · ${Number(friend.online) ? 'Online' : 'Offline'}</p></div></div>`
      )
      .join('') || '<p>No friends yet.</p>'
  }`;

  document.querySelectorAll('.friend-item[data-user]').forEach((item) => {
    item.onclick = () => {
      location.href = `profile.HTML?username=${encodeURIComponent(item.dataset.user)}`;
    };
  });
}

async function editProfile() {
  if (document.querySelector('.popup')) return;
  const currentAvatar = document.querySelector('.profile-avatar')?.src || '../prof/blank-profile-pic.png';
  const currentName = document.querySelector('.profile-name')?.textContent.trim() || '';
  const popup = document.createElement('div');
  let pendingAvatar = '';

  popup.className = 'popup';
  popup.innerHTML = `
    <div class="popup-content">
      <h2>Edit Profile</h2>
      <div class="edit-avatar-row">
        <img id="previewAvatar" class="edit-avatar-preview" src="${safeProfile(currentAvatar)}" alt="Preview">
        <label for="editPhoto" class="change-photo-btn">Change Photo</label>
        <input id="editPhoto" type="file" accept="image/*" hidden>
      </div>
      <label for="editName">Name</label>
      <input id="editName" type="text" value="${safeProfile(currentName)}">
      <p class="popup-error" style="color:#ef4444;font-size:13px;min-height:1.2em;margin:0;"></p>
      <div class="popup-buttons">
        <button type="button" id="saveProfile">Save</button>
        <button type="button" class="close">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);
  const previewImg = popup.querySelector('#previewAvatar');
  const photoInput = popup.querySelector('#editPhoto');
  const nameInput = popup.querySelector('#editName');
  const saveBtn = popup.querySelector('#saveProfile');
  const errorEl = popup.querySelector('.popup-error');

  popup.querySelector('.close').onclick = () => popup.remove();

  photoInput.onchange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    errorEl.textContent = '';
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        pendingAvatar = reader.result;
        previewImg.src = pendingAvatar;
      }
    };
    reader.readAsDataURL(file);
  };

  const saveChanges = async () => {
    const displayName = nameInput.value.trim();
    if (!displayName) {
      errorEl.textContent = 'Name cannot be empty.';
      return;
    }
    saveBtn.disabled = true;
    errorEl.textContent = '';
    try {
      const result = await profileApi('profile_update', {
        method: 'POST',
        body: { display_name: displayName, avatar: pendingAvatar },
      });
      if (result.user) {
        setImgWithFallback(document.querySelector('.profile-avatar'), result.user.avatar);
        setImgWithFallback(document.querySelector('.nav-avatar img'), result.user.avatar);
        document.querySelector('.profile-name').textContent = result.user.display_name;
      }
      popup.remove();
      await loadProfile();
    } catch (error) {
      saveBtn.disabled = false;
      errorEl.textContent = error.message || 'Could not save profile.';
    }
  };

  saveBtn.onclick = saveChanges;
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveChanges();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.logout-link').onclick = async (event) => {
    event.preventDefault();
    await profileApi('logout', { method: 'POST' });
    location.href = '../log in/index .html';
  };
  loadProfile().catch(() => {
    location.href = '../log in/index .html';
  });
});

window.opengroup = opengroup;
window.openchat = openchat;
window.editProfile = editProfile;
