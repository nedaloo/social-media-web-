const escapeHtml = (str = "") =>
  str.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

const groupMembersList = ["Farah", "Marcus Chen", "Omar Nabil"];

const groupsStore = {
  "Design Squad": {
    membersCountText: "3 members",
    statusText: "4 online now",
    members: ["Farah", "Marcus Chen", "Omar Nabil"],
    messages: [
      { sender: "Farah", me: false, text: "Hey everyone! Are we still reviewing the dark mode palette today?", time: "4:05 PM" },
      { sender: "You", me: true, text: "Yes! Obsidian surface with amber accents is locked in.", time: "4:08 PM" },
      { sender: "Marcus", me: false, text: "The contrast and borders look super sharp on dark mode.", time: "4:11 PM" },
      { sender: "Farah", me: false, text: "Are we still reviewing the dark palette?", time: "4:12 PM" },
    ],
  },
  "Code & Algorithms": {
    membersCountText: "3 members",
    statusText: "3 online now",
    members: ["Omar", "Farah", "Sarah"],
    messages: [
      { sender: "Omar", me: false, text: "Pushed the new solution to the repo.", time: "3:48 PM" },
      { sender: "You", me: true, text: "Nice, checking it now.", time: "3:50 PM" },
    ],
  },
  "Web Builders": {
    membersCountText: "3 members",
    statusText: "2 online now",
    members: ["Sarah", "Marcus", "Yara"],
    messages: [
      { sender: "Sarah", me: false, text: "Layout spacing looks super clean.", time: "2:15 PM" },
    ],
  },
  "Media & Content": {
    membersCountText: "3 members",
    statusText: "4 online now",
    members: ["Yara", "Farah", "Omar"],
    messages: [
      { sender: "Yara", me: false, text: "Draft is ready for the team.", time: "Yesterday" },
    ],
  },
};

let activeGroupName = "Design Squad";

function updateMemberCountDisplay() {
  const memberCount = document.querySelector("#member-count");
  if (!memberCount) return;

  memberCount.textContent = `${groupMembersList.length} members`;

  if (groupsStore[activeGroupName]) {
    groupsStore[activeGroupName].members = [...groupMembersList];
    groupsStore[activeGroupName].membersCountText = memberCount.textContent;
  }
}

function updateGroupCountDisplay() {
  const chatList = document.querySelector(".chat-list");
  const groupCount = document.querySelector("#group-count");
  if (!chatList || !groupCount) return;

  const total = chatList.querySelectorAll(".chat-row").length;
  groupCount.textContent = `${total} active groups`;
}

const renderGroupMessagesHtml = (messages = []) =>
  messages
    .map((msg) => {
      const safeText = escapeHtml(msg.text || "");
      const safeTime = escapeHtml(msg.time || "");
      const safeSender = escapeHtml(msg.sender || "Member");

      if (msg.me) {
        return `
          <div class="message sent">
            <div>
              <div>${safeText}</div>
              <time>${safeTime}</time>
            </div>
          </div>
        `;
      }

      return `
        <div class="message">
          <img class="avatar" src="blank-profile-pic.png" alt="${safeSender}" />
          <div>
            <span class="sender-label">${safeSender}</span>
            <div>${safeText}</div>
            <time>${safeTime}</time>
          </div>
        </div>
      `;
    })
    .join("");

function openGroup(rowEl) {
  const nameEl = rowEl?.querySelector("strong");
  const chat = document.querySelector(".conversation");
  if (!nameEl || !chat) return;

  const groupName = nameEl.textContent.trim();
  const safeGroupName = escapeHtml(groupName);
  const avatarSrc = rowEl.querySelector("img.avatar")?.getAttribute("src") || "blank-profile-pic.png";
  const safeAvatar = escapeHtml(avatarSrc);
  activeGroupName = groupName;

  document.querySelectorAll(".chat-row").forEach((row) => {
    row.classList.remove("active");
    row.removeAttribute("aria-current");
  });
  rowEl.classList.add("active");
  rowEl.setAttribute("aria-current", "true");

  const badge = rowEl.querySelector("b");
  if (badge) badge.remove();

  if (!groupsStore[groupName]) {
    groupsStore[groupName] = {
      membersCountText: "3 members",
      statusText: "1 online now",
      members: ["Farah", "Marcus Chen", "Omar Nabil"],
      messages: [
        {
          sender: "System",
          me: false,
          text: `Welcome to ${groupName}! Start chatting with the group.`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }),
        },
      ],
    };
  }

  const groupData = groupsStore[groupName];
  groupMembersList.length = 0;
  groupMembersList.push(...groupData.members);

  chat.setAttribute("aria-label", `Group conversation ${groupName}`);
  chat.innerHTML = `
    <header class="conversation-head">
      <div class="person">
        <img class="avatar" src="${safeAvatar}" alt="${safeGroupName}" />
        <div>
          <h2>${safeGroupName} <small id="member-count" onclick="memberPop()">${escapeHtml(groupData.membersCountText)}</small></h2>
          <p><span>${escapeHtml(groupData.statusText)}</span></p>
        </div>
      </div>
      <button type="button" onclick="addMember()" class="add-member-btn">+ Add Member</button>
    </header>

    <div class="messages">
      ${renderGroupMessagesHtml(groupData.messages)}
    </div>

    <form class="composer" onsubmit="send(event); return false;">
      <div class="input-wrap">
        <input class="message-input" type="text" placeholder="write message" aria-label="write message" />
        <button class="send-btn" type="submit">Send</button>
      </div>
    </form>
  `;

  const messagesBox = chat.querySelector(".messages");
  if (messagesBox) {
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }
}

function send(event) {
  if (event) event.preventDefault();

  const input = document.querySelector(".composer .message-input");
  const messagesBox = document.querySelector(".conversation .messages");
  if (!input || !messagesBox) return;

  const text = input.value.trim();
  if (text === "") return;

  const timeText = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  if (groupsStore[activeGroupName]) {
    groupsStore[activeGroupName].messages.push({
      sender: "You",
      me: true,
      text,
      time: timeText,
    });

    document.querySelectorAll(".chat-row").forEach((row) => {
      if (row.querySelector("strong")?.textContent.trim() === activeGroupName) {
        const preview = row.querySelector("span");
        const timeEl = row.querySelector("time");
        if (preview) preview.textContent = `You: ${text}`;
        if (timeEl) timeEl.textContent = timeText;
      }
    });
  }

  const messageEl = document.createElement("div");
  messageEl.classList.add("message", "sent");

  const contentCol = document.createElement("div");

  const bubbleEl = document.createElement("div");
  bubbleEl.textContent = text;

  const timeEl = document.createElement("time");
  timeEl.textContent = timeText;

  contentCol.append(bubbleEl, timeEl);
  messageEl.append(contentCol);
  messagesBox.appendChild(messageEl);

  input.value = "";
  input.focus();
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

function openProfile() {
  window.location.href = "../prof/profile.html";
}

function newGroup() {
  const chatList = document.querySelector(".chat-list");
  if (!chatList || document.querySelector(".popup")) return;

  const popup = document.createElement("div");
  popup.classList.add("popup");
  popup.innerHTML = `
    <div class="popup-content">
      <h2>New Group</h2>
      <p>Enter the name of the group you want to create:</p>
      <input type="text" placeholder="Group Name">
      <div class="popup-buttons">
        <button type="button" onclick="createGroup()">Create</button>
        <button type="button" class="close" onclick="this.closest('.popup').remove()">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);
  const input = popup.querySelector("input");
  input?.focus();

  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      createGroup();
    }
  });
}

function createGroup() {
  const chatList = document.querySelector(".chat-list");
  const popup = document.querySelector(".popup");
  const input = document.querySelector(".popup-content input");
  if (!chatList || !input) return;

  const rawName = input.value.trim();
  if (!rawName) {
    input.focus();
    return;
  }

  const safeName = escapeHtml(rawName);
  const timeText = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const newChat = document.createElement("button");
  newChat.type = "button";
  newChat.classList.add("chat-row");
  newChat.innerHTML = `
    <img class="avatar" src="blank-profile-pic.png" alt="${safeName}">
    <div>
      <div>
        <strong>${safeName}</strong>
        <time>${timeText}</time>
      </div>
      <div><span>Group created...</span></div>
    </div>
  `;

  chatList.appendChild(newChat);
  updateGroupCountDisplay();

  if (popup) popup.remove();
  openGroup(newChat);
}

function addMember() {
  if (document.querySelector(".popup")) return;

  const popup = document.createElement("div");
  popup.classList.add("popup");
  popup.innerHTML = `
    <div class="popup-content">
      <h2>Add Member</h2>
      <p>Enter the name of the new member:</p>
      <input type="text" id="newMemberInput" placeholder="Member name" />
      <div class="popup-buttons">
        <button type="button" id="confirmAddMember">Add</button>
        <button type="button" class="close" onclick="this.closest('.popup').remove()">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);
  const input = popup.querySelector("#newMemberInput");
  input?.focus();

  const submitMember = () => {
    const memberName = input.value.trim();
    if (!memberName) {
      input.focus();
      return;
    }

    groupMembersList.push(memberName);
    updateMemberCountDisplay();

    popup.querySelector(".popup-content").innerHTML = `
      <h2>New Member</h2>
      <p></p>
      <div class="popup-buttons">
        <button type="button" class="close" onclick="this.closest('.popup').remove()">Close</button>
      </div>
    `;
    popup.querySelector("p").textContent = `${memberName} has been added to the group.`;
  };

  popup.querySelector("#confirmAddMember")?.addEventListener("click", submitMember);

  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitMember();
    }
  });
}

function memberPop() {
  if (document.querySelector(".popup")) return;

  const popup = document.createElement("div");
  popup.classList.add("popup");

  const content = document.createElement("div");
  content.classList.add("popup-content");

  const title = document.createElement("h2");
  title.textContent = "Group Members";

  const list = document.createElement("ul");
  list.classList.add("member-list");

  const renderItems = () => {
    list.innerHTML = "";

    if (groupMembersList.length === 0) {
      const emptyMsg = document.createElement("p");
      emptyMsg.classList.add("empty-members");
      emptyMsg.textContent = "No members in this group yet.";
      list.appendChild(emptyMsg);
      return;
    }

    groupMembersList.forEach((name, index) => {
      const li = document.createElement("li");
      li.classList.add("member-item");

      const info = document.createElement("div");
      info.classList.add("member-info");

      const avatar = document.createElement("img");
      avatar.src = "blank-profile-pic.png";
      avatar.alt = name;
      avatar.classList.add("member-avatar");

      const nameSpan = document.createElement("span");
      nameSpan.classList.add("member-name");
      nameSpan.textContent = name;

      info.append(avatar, nameSpan);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.classList.add("remove-member-btn");
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => {
        groupMembersList.splice(index, 1);
        updateMemberCountDisplay();
        renderItems();
      });

      li.append(info, removeBtn);
      list.appendChild(li);
    });
  };

  renderItems();

  const buttonsWrap = document.createElement("div");
  buttonsWrap.classList.add("popup-buttons");

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.classList.add("close");
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", () => popup.remove());

  buttonsWrap.appendChild(closeBtn);
  content.append(title, list, buttonsWrap);
  popup.appendChild(content);
  document.body.appendChild(popup);
}

document.addEventListener("DOMContentLoaded", () => {
  const chatList = document.querySelector(".chat-list");
  if (!chatList) return;

  chatList.addEventListener("click", (e) => {
    const row = e.target.closest(".chat-row");
    if (!row) return;
    openGroup(row);
  });
});

window.send = send;
window.openProfile = openProfile;
window.newGroup = newGroup;
window.createGroup = createGroup;
window.addMember = addMember;
window.memberPop = memberPop;
window.openGroup = openGroup;