const escapeHtml = (str = "") =>
  str.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

// كل شات ليه سجل منفصل هنا حسب اسم المستخدم (أو الـ id)
const conversationsState = {};
let activeConversation = null;

// رسائل مبدئية لأي شات يتفتح لأول مرة (تقدر تغيرها من مكان واحد أو تستبدلها بداتا الباك إند)
const createInitialMessages = (username) => [
  {
    id: "1",
    sender: "them",
    text: `Hey ${username}! Ready whenever you are.`,
    time: "4:05 PM",
  },
  {
    id: "2",
    sender: "me",
    text: `Hey ${username}, let's get started.`,
    time: "4:08 PM",
  },
];

const renderMessages = (messages = [], safeName = "User", avatar = "blank-profile-pic.png") =>
  messages
    .map((msg) => {
      const isMe = msg.sender === "me";
      return `
        <div class="message ${isMe ? "outgoing sent" : "incoming"}" data-msg-id="${escapeHtml(String(msg.id || ""))}">
          ${!isMe ? `<img class="avatar" src="${escapeHtml(avatar)}" alt="${safeName} profile picture">` : ""}
          <div>
            <div>${escapeHtml(msg.text || "")}</div>
            <time>${escapeHtml(msg.time || "")}</time>
          </div>
        </div>
      `;
    })
    .join("");

// دالة للباك إند لتحديث أو تحميل محادثة شخص معين
const setConversationData = (payload) => {
  const key = payload.username;
  conversationsState[key] = {
    id: payload.id ?? key,
    username: key,
    avatar: payload.avatar || "blank-profile-pic.png",
    status: payload.status || "Online · Active now",
    messages: Array.isArray(payload.messages) ? payload.messages : [],
  };

  if (activeConversation?.username === key) {
    renderConversationView(conversationsState[key]);
  }
};

const renderConversationView = (conv) => {
  const chat = document.querySelector(".conversation");
  if (!chat || !conv) return;

  activeConversation = conv;
  const safeName = escapeHtml(conv.username);
  const safeStatus = escapeHtml(conv.status);
  const safeAvatar = escapeHtml(conv.avatar);

  chat.setAttribute("aria-label", `Conversation with ${conv.username}`);
  chat.innerHTML = `
    <header class="conversation-head">
      <div class="person">
        <img class="avatar" src="${safeAvatar}" alt="${safeName} profile picture">
        <div>
          <h2>${safeName}</h2>
          <p><span>${safeStatus}</span></p>
        </div>
      </div>
    </header>
    <div class="messages">
      ${renderMessages(conv.messages, safeName, safeAvatar)}
    </div>
    <form class="composer" onsubmit="send(event); return false;">
      <div class="input-wrap">
      <input
          class="message-input"
          type="text"
          placeholder="write a message"
          aria-label="write a message"
        />
        <button class="send-btn" type="submit">Send</button>
      </div>
    </form>
  `;

  const messagesBox = chat.querySelector(".messages");
  if (messagesBox) {
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }
};

const openchat = async (rowEl) => {
  const usernameEl = rowEl?.querySelector(".username, strong");
  if (!usernameEl) return;

  const username = usernameEl.textContent.trim();
  const rowId = rowEl.dataset.conversationId || username;
  const avatarSrc = rowEl.querySelector("img.avatar")?.getAttribute("src") || "blank-profile-pic.png";

  document.querySelectorAll(".chat-row").forEach((row) => {
    row.classList.toggle("active", row === rowEl);
  });

  const badge = rowEl.querySelector("b");
  if (badge) badge.remove();

  if (!conversationsState[username]) {
    setConversationData({
      id: rowId,
      username,
      avatar: avatarSrc,
      status: "Online · Active now",
      messages: createInitialMessages(username),
    });

    // لو هتجيب رسائل الشخص ده من الباك إند:
    // const res = await fetch(`/api/conversations/${encodeURIComponent(rowId)}/messages`);
    // const data = await res.json();
    // setConversationData({ id: rowId, username, avatar: avatarSrc, status: data.status, messages: data.messages });
  }

  renderConversationView(conversationsState[username]);
};
 
function send(event) {
  if (event) event.preventDefault();
  if (!activeConversation) return;

  const input = document.querySelector(".composer .message-input");
  const messagesBox = document.querySelector(".conversation .messages");
  if (!input || !messagesBox) return;

  const message = input.value.trim();
  if (!message) return;

  const timeText = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const newMsg = {
    id: String(Date.now()),
    sender: "me",
    text: message,
    time: timeText,
  };

  // حفظ الرسالة داخل محادثة الشخص المفتوح فقط
  activeConversation.messages.push(newMsg);

  messagesBox.insertAdjacentHTML(
    "beforeend",
    renderMessages([newMsg], escapeHtml(activeConversation.username), activeConversation.avatar)
  );
  messagesBox.scrollTop = messagesBox.scrollHeight;

  // تحديث آخر رسالة ووقتها في صف هذا الشخص فقط في القائمة
  document.querySelectorAll(".chat-row").forEach((row) => {
    const rowName = row.querySelector(".username, strong")?.textContent.trim();
    if (rowName === activeConversation.username) {
      const preview = row.querySelector("span");
      const timeEl = row.querySelector("time");
      if (preview) preview.textContent = message;
      if (timeEl) timeEl.textContent = timeText;
    }
  });

  // جاهز للإرسال للباك إند:
  // fetch("/api/messages", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({
  //     conversationId: activeConversation.id,
  //     recipient: activeConversation.username,
  //     message: newMsg,
  //   }),
  // });

  input.value = "";
  input.focus();
}

function openProfile() {
  window.location.href = "../prof/profile.html";
}

function newConversation() {
  const chatList = document.querySelector(".chat-list");
  if (!chatList || document.querySelector(".popup")) return;

  const popup = document.createElement("div");
  popup.classList.add("popup");
  popup.innerHTML = `
    <div class="popup-content">
      <h2>New Conversation</h2>
      <p>Enter the username of the person you want to chat with:</p>
      <input type="text" placeholder="Username">
      <div class="popup-buttons">
        <button type="button" onclick="createConversation()">Create</button>
        <button type="button" class="close" onclick="this.parentElement.parentElement.parentElement.remove()">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);
  popup.querySelector("input")?.focus();
}

function createConversation() {
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
    <img class="avatar" src="blank-profile-pic.png" alt="user-picture">
    <div>
      <div>
        <strong class="username">${safeName}</strong>
        <time>${timeText}</time>
      </div>
      <div><span>Start a new conversation...</span></div>
    </div>
  `;

  chatList.appendChild(newChat);
  if (popup) popup.remove();
  openchat(newChat);
}

// ربط الضغط على أي شات (سواء قديم أو جديد) بفتح محادثته المستقلة
document.addEventListener("DOMContentLoaded", () => {
  const chatList = document.querySelector(".chat-list");
  if (!chatList) return;

  chatList.addEventListener("click", (e) => {
    const row = e.target.closest(".chat-row");
    if (!row) return;
    e.preventDefault();
    openchat(row);
  });
});
// شيل الفريم الذهبي من كل الصفوف وحطه على الصف اللي اتداس عليه بس
  document.querySelectorAll(".chat-row").forEach((row) => {
    row.classList.remove("active");
    row.removeAttribute("aria-current");
  });

  rowEl.classList.add("active");
  rowEl.setAttribute("aria-current", "true");

window.send = send;
window.openchat = openchat;
window.newConversation = newConversation;
window.createConversation = createConversation;
window.openProfile = openProfile;
window.setConversationData = setConversationData;
function groupChats() {
  window.location.href = "group.html";
}