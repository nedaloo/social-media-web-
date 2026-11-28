(function () {
  async function refresh() {
    try {
      const [meData, convData, groupData] = await Promise.all([api('me'), api('conversations'), api('groups')]);
      const me = meData.user;
      if (typeof currentMe !== 'undefined') currentMe = me;

      document.querySelectorAll('.top-actions img, .nav-avatar img').forEach((img) => {
        if (typeof setImgWithFallback === 'function') {
          setImgWithFallback(img, me.avatar);
        } else {
          img.src = typeof avatarUrl === 'function' ? avatarUrl(me.avatar) : me.avatar;
        }
      });

      if (typeof updateUnreadBadges === 'function') {
        updateUnreadBadges(convData.items, groupData.items);
      }

      if (typeof activeGroup !== 'undefined' && typeof renderGroupList === 'function') {
        renderGroupList(groupData.items, activeGroup ? activeGroup.id : null);
        if (activeGroup) {
          const gData = await api('group', { query: `&group_id=${activeGroup.id}` });
          const head = document.querySelector('.conversation-head');
          if (head && typeof groupStatus === 'function') {
            const status = groupStatus(gData.members, me);
            const dot = head.querySelector('.status-dot');
            const statusEl = head.querySelector('.status-text');
            const memberCount = head.querySelector('#member-count');
            if (dot) dot.className = `status-dot ${status.dotClass}`;
            if (statusEl) {
              statusEl.className = `status-text ${status.textClass}`;
              statusEl.textContent = status.text;
            }
            if (memberCount) memberCount.textContent = `${gData.members.length} members`;
          }
          const box = document.querySelector('.messages');
          if (box) {
            const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
            const html = gData.messages.map((message) => msg(message, me)).join('');
            if (box.innerHTML !== html) box.innerHTML = html;
            if (nearBottom) box.scrollTop = box.scrollHeight;
          }
        }
        return;
      }

      if (typeof renderChatList === 'function') {
        renderChatList(convData.items, typeof activeConversation !== 'undefined' && activeConversation ? activeConversation.id : null);
      }

      const current =
        typeof activeConversation !== 'undefined' &&
        activeConversation &&
        convData.items.find((item) => Number(item.id) === Number(activeConversation.id));

      if (current) {
        activeConversation.user = current;
        const head = document.querySelector('.conversation-head');
        if (head && typeof conversationStatus === 'function') {
          const status = conversationStatus(current);
          const dot = head.querySelector('.status-dot');
          const statusEl = head.querySelector('.status-text');
          if (dot) dot.className = `status-dot ${status.dotClass}`;
          if (statusEl) {
            statusEl.className = `status-text ${status.textClass}`;
            statusEl.textContent = status.text;
          }
        }
        const messages = await api('messages', { query: `&conversation_id=${current.id}` });
        const box = document.querySelector('.messages');
        if (box) {
          const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
          const html = messages.items.map((message) => messageHtml(message, me)).join('');
          if (box.innerHTML !== html) box.innerHTML = html;
          if (nearBottom) box.scrollTop = box.scrollHeight;
        }
      }
    } catch (_) {
      /* A temporary network failure is retried on the next interval. */
    }
  }
  setInterval(refresh, 2000);
})();
