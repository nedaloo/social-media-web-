function opengroup() {
    window.location.href = "../Home/group.html";
}
function openchat() {
    window.location.href = "../Home/index.html";}
function editProfile() {
  if (document.querySelector(".popup")) return;

  const nameEl = document.querySelector(".profile-name");
  const mainAvatar = document.querySelector(".profile-avatar");
  const navAvatar = document.querySelector(".nav-avatar img");
  if (!nameEl) return;

  const currentName = nameEl.textContent.trim();
  const currentSrc = mainAvatar?.getAttribute("src") || "Uruma.png";

  let pendingAvatarSrc = currentSrc;

  const popup = document.createElement("div");
  popup.classList.add("popup");
  popup.innerHTML = `
    <div class="popup-content">
      <h2>Edit Profile</h2>

      <div class="edit-avatar-row">
        <img id="previewAvatar" src="" alt="Preview" class="edit-avatar-preview" />
        <label for="editAvatarInput" class="change-photo-btn">Change Photo</label>
        <input type="file" id="editAvatarInput" accept="image/*" hidden />
      </div>

      <label for="editNameInput">Name</label>
      <input type="text" id="editNameInput" />

      <div class="popup-buttons">
        <button type="button" id="saveProfileBtn">Save</button>
        <button type="button" class="close" onclick="this.closest('.popup').remove()">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  const previewImg = popup.querySelector("#previewAvatar");
  const fileInput = popup.querySelector("#editAvatarInput");
  const nameInput = popup.querySelector("#editNameInput");

  if (previewImg) previewImg.src = currentSrc;
  nameInput.value = currentName;
  nameInput.focus();

  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        pendingAvatarSrc = reader.result;
        if (previewImg) previewImg.src = pendingAvatarSrc;
      }
    };
    reader.readAsDataURL(file);
  });

  const saveChanges = () => {
    const newName = nameInput.value.trim();

    if (newName) {
      nameEl.textContent = newName;
      if (mainAvatar) mainAvatar.alt = newName;
      if (navAvatar) navAvatar.alt = newName;
    }

    if (pendingAvatarSrc) {
      if (mainAvatar) mainAvatar.src = pendingAvatarSrc;
      if (navAvatar) navAvatar.src = pendingAvatarSrc;
    }

    popup.remove();
  };

  popup.querySelector("#saveProfileBtn")?.addEventListener("click", saveChanges);
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveChanges();
    }
  });
}