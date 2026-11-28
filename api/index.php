<?php
declare(strict_types=1);
session_start();
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';
$body = requestBody();
$pdo = db();
$avatarCol = userAvatarColumn($pdo);
$hasRecipient = hasMessageRecipientColumn($pdo);

try {
    if ($action === 'register') {
        $username = strtolower(trim((string)($body['username'] ?? '')));
        $display = trim((string)($body['display_name'] ?? $username));
        $password = (string)($body['password'] ?? '');
        if (!preg_match('/^[a-z0-9_.-]{3,32}$/', $username)) jsonResponse(['error' => 'Use 3-32 letters, numbers, dots, dashes, or underscores.'], 422);
        if (strlen($password) < 8) jsonResponse(['error' => 'Password must be at least 8 characters.'], 422);
        $stmt = $pdo->prepare('INSERT INTO users (username, display_name, password_hash, online, last_seen) VALUES (?, ?, ?, 1, NOW())');
        try { $stmt->execute([$username, $display ?: $username, password_hash($password, PASSWORD_DEFAULT)]); }
        catch (PDOException $e) { if ((int)($e->errorInfo[1] ?? 0) === 1062) jsonResponse(['error' => 'That username is already taken.'], 409); throw $e; }
        $_SESSION['user_id'] = (int)$pdo->lastInsertId();
        jsonResponse(['user' => ['username' => $username, 'display_name' => $display ?: $username], 'redirect' => '../Home/index.html']);
    }

    if ($action === 'login') {
        $stmt = $pdo->prepare('SELECT * FROM users WHERE username = ? LIMIT 1');
        $stmt->execute([strtolower(trim((string)($body['username'] ?? '')))]);
        $user = $stmt->fetch();
        if (!$user || !password_verify((string)($body['password'] ?? ''), $user['password_hash'])) jsonResponse(['error' => 'Incorrect username or password.'], 422);
        $_SESSION['user_id'] = (int)$user['id'];
        $pdo->prepare('UPDATE users SET online = 1, last_seen = NOW() WHERE id = ?')->execute([$user['id']]);
        jsonResponse(['redirect' => '../Home/index.html']);
    }

    if ($action === 'logout') {
        if (!empty($_SESSION['user_id'])) $pdo->prepare('UPDATE users SET online = 0, typing_until = NULL, last_seen = NOW() WHERE id = ?')->execute([$_SESSION['user_id']]);
        $_SESSION = [];
        session_destroy();
        jsonResponse(['redirect' => '../log in/index .html']);
    }

    $uid = requireUser();
    $pdo->prepare('UPDATE users SET online = 1, last_seen = NOW() WHERE id = ?')->execute([$uid]);

    if ($action === 'me') {
        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$uid]);
        $user = $stmt->fetch();
        if (!$user) jsonResponse(['error' => 'User not found.'], 404);
        jsonResponse(['user' => userPayload($user)]);
    }

    if ($action === 'typing') {
        $pdo->prepare('UPDATE users SET typing_until = IF(?, DATE_ADD(NOW(), INTERVAL 4 SECOND), NULL) WHERE id = ?')->execute([!empty($body['typing']), $uid]);
        jsonResponse(['ok' => true]);
    }

    if ($action === 'profile') {
        $username = strtolower(trim((string)($_GET['username'] ?? '')));
        $stmt = $pdo->prepare('SELECT * FROM users WHERE ' . ($username ? 'username = ?' : 'id = ?'));
        $stmt->execute([$username ?: $uid]);
        $user = $stmt->fetch();
        if (!$user) jsonResponse(['error' => 'User not found.'], 404);
        $friends = $pdo->prepare('SELECT u.* FROM users u JOIN conversations c ON (c.user_one = ? AND c.user_two = u.id) OR (c.user_two = ? AND c.user_one = u.id) WHERE c.id IS NOT NULL ORDER BY u.display_name');
        $friends->execute([$user['id'], $user['id']]);
        jsonResponse(['user' => userPayload($user), 'friends' => array_map('userPayload', $friends->fetchAll()), 'own' => (int)$user['id'] === $uid]);
    }

    if ($action === 'profile_update') {
        $display = trim((string)($body['display_name'] ?? ''));
        $avatarInput = (string)($body['avatar'] ?? '');
        if (!$display) jsonResponse(['error' => 'Name cannot be empty.'], 422);
        $avatarStored = saveAvatarDataUrl($avatarInput, $uid);
        $pdo->prepare("UPDATE users SET display_name = ?, {$avatarCol} = COALESCE(NULLIF(?, ''), {$avatarCol}) WHERE id = ?")
            ->execute([$display, $avatarStored, $uid]);
        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$uid]);
        jsonResponse(['ok' => true, 'user' => userPayload($stmt->fetch())]);
    }

    if ($action === 'conversations') {
        $msgMatch = $hasRecipient
            ? '(m.conversation_id = c.id OR (m.conversation_id IS NULL AND ((m.sender_id = c.user_one AND m.recipient_id = c.user_two) OR (m.sender_id = c.user_two AND m.recipient_id = c.user_one))))'
            : 'm.conversation_id = c.id';
        $sql = "SELECT c.id, u.id AS user_id, u.username, u.display_name, u.{$avatarCol} AS avatar,
                IF(u.online = 1 AND u.last_seen > DATE_SUB(NOW(), INTERVAL 30 SECOND), 1, 0) AS online,
                IF(u.online = 1 AND u.typing_until > NOW(), 1, 0) AS typing,
                (SELECT body FROM messages m WHERE {$msgMatch} ORDER BY m.id DESC LIMIT 1) AS preview,
                (SELECT created_at FROM messages m WHERE {$msgMatch} ORDER BY m.id DESC LIMIT 1) AS last_time,
                (SELECT COUNT(*) FROM messages m WHERE {$msgMatch} AND m.sender_id != ? AND m.seen_at IS NULL) AS unread
                FROM conversations c
                JOIN users u ON u.id = IF(c.user_one = ?, c.user_two, c.user_one)
                WHERE c.user_one = ? OR c.user_two = ?
                ORDER BY last_time DESC, c.id DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$uid, $uid, $uid, $uid]);
        jsonResponse(['items' => $stmt->fetchAll()]);
    }

    if ($action === 'create_conversation') {
        $name = strtolower(trim((string)($body['username'] ?? '')));
        if ($name === '') jsonResponse(['error' => 'Please enter a username.'], 422);
        $stmt = $pdo->prepare('SELECT * FROM users WHERE username = ? LIMIT 1');
        $stmt->execute([$name]);
        $other = $stmt->fetch();
        if (!$other) jsonResponse(['error' => 'No username found called by this'], 404);
        if ((int)$other['id'] === $uid) jsonResponse(['error' => 'You cannot start a conversation with yourself.'], 422);
        $one = min($uid, (int)$other['id']);
        $two = max($uid, (int)$other['id']);
        $pdo->prepare('INSERT IGNORE INTO conversations (user_one, user_two) VALUES (?, ?)')->execute([$one, $two]);
        $stmt = $pdo->prepare('SELECT id FROM conversations WHERE user_one = ? AND user_two = ?');
        $stmt->execute([$one, $two]);
        jsonResponse(['id' => (int)$stmt->fetchColumn(), 'user' => userPayload($other)]);
    }

    if ($action === 'messages') {
        $cid = (int)($_GET['conversation_id'] ?? 0);
        $convStmt = $pdo->prepare('SELECT * FROM conversations WHERE id = ? AND (user_one = ? OR user_two = ?) LIMIT 1');
        $convStmt->execute([$cid, $uid, $uid]);
        $conv = $convStmt->fetch();
        if (!$conv) jsonResponse(['error' => 'Conversation not found.'], 404);

        $msgMatch = $hasRecipient
            ? '(m.conversation_id = ? OR (m.conversation_id IS NULL AND ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))))'
            : 'm.conversation_id = ?';
        $matchParams = $hasRecipient
            ? [$cid, (int)$conv['user_one'], (int)$conv['user_two'], (int)$conv['user_two'], (int)$conv['user_one']]
            : [$cid];

        $pdo->prepare("UPDATE messages m SET m.seen_at = NOW() WHERE {$msgMatch} AND m.sender_id != ? AND m.seen_at IS NULL")
            ->execute([...$matchParams, $uid]);

        $stmt = $pdo->prepare("SELECT m.*, u.username, u.display_name, u.{$avatarCol} AS avatar FROM messages m JOIN users u ON u.id = m.sender_id WHERE {$msgMatch} ORDER BY m.id");
        $stmt->execute($matchParams);
        jsonResponse(['items' => $stmt->fetchAll()]);
    }

    if ($action === 'send') {
        $cid = (int)($body['conversation_id'] ?? 0);
        $text = trim((string)($body['message'] ?? ''));
        if (!$text) jsonResponse(['error' => 'Message cannot be empty.'], 422);
        $convStmt = $pdo->prepare('SELECT * FROM conversations WHERE id = ? AND (user_one = ? OR user_two = ?) LIMIT 1');
        $convStmt->execute([$cid, $uid, $uid]);
        $conv = $convStmt->fetch();
        if (!$conv) jsonResponse(['error' => 'Conversation not found.'], 404);

        if ($hasRecipient) {
            $recipientId = ((int)$conv['user_one'] === $uid) ? (int)$conv['user_two'] : (int)$conv['user_one'];
            $pdo->prepare('INSERT INTO messages (conversation_id, sender_id, recipient_id, body) VALUES (?, ?, ?, ?)')
                ->execute([$cid, $uid, $recipientId, $text]);
        } else {
            $pdo->prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)')
                ->execute([$cid, $uid, $text]);
        }
        $pdo->prepare('UPDATE users SET typing_until = NULL WHERE id = ?')->execute([$uid]);
        jsonResponse(['ok' => true]);
    }

    if ($action === 'groups') {
        $stmt = $pdo->prepare('SELECT g.*, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members, (SELECT COUNT(*) FROM group_messages x WHERE x.group_id = g.id AND x.sender_id != ? AND x.seen_at IS NULL) AS unread FROM `groups` g JOIN group_members me ON me.group_id = g.id AND me.user_id = ? ORDER BY g.id DESC');
        $stmt->execute([$uid, $uid]);
        jsonResponse(['items' => $stmt->fetchAll()]);
    }

    if ($action === 'create_group') {
        $name = trim((string)($body['name'] ?? ''));
        if (!$name) jsonResponse(['error' => 'Group name is required.'], 422);
        $pdo->prepare('INSERT INTO `groups` (`name`, `owner_id`) VALUES (?, ?)')->execute([$name, $uid]);
        $gid = (int)$pdo->lastInsertId();
        $pdo->prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)')->execute([$gid, $uid]);
        jsonResponse(['id' => $gid]);
    }

    if ($action === 'group') {
        $gid = (int)($_GET['group_id'] ?? 0);
        $memberCheck = $pdo->prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1');
        $memberCheck->execute([$gid, $uid]);
        if (!$memberCheck->fetch()) jsonResponse(['error' => 'Group not found.'], 404);

        $pdo->prepare('UPDATE group_messages SET seen_at = NOW() WHERE group_id = ? AND sender_id != ? AND seen_at IS NULL')->execute([$gid, $uid]);
        $s = $pdo->prepare("SELECT g.*, u.id AS user_id, u.username, u.display_name, u.{$avatarCol} AS avatar, IF(u.online = 1 AND u.last_seen > DATE_SUB(NOW(), INTERVAL 30 SECOND), 1, 0) AS online, IF(u.online = 1 AND u.typing_until > NOW(), 1, 0) AS typing FROM `groups` g JOIN group_members gm ON gm.group_id = g.id JOIN users u ON u.id = gm.user_id WHERE g.id = ?");
        $s->execute([$gid]);
        $rows = $s->fetchAll();
        if (!$rows) jsonResponse(['error' => 'Group not found.'], 404);
        $m = $pdo->prepare("SELECT gm.*, u.username, u.display_name, u.{$avatarCol} AS avatar FROM group_messages gm JOIN users u ON u.id = gm.sender_id WHERE group_id = ? ORDER BY gm.id");
        $m->execute([$gid]);
        jsonResponse(['group' => $rows[0], 'members' => $rows, 'messages' => $m->fetchAll()]);
    }

    if ($action === 'add_member') {
        $gid = (int)($body['group_id'] ?? 0);
        $name = strtolower(trim((string)($body['username'] ?? '')));
        $s = $pdo->prepare('SELECT u.* FROM users u JOIN `groups` g ON g.owner_id = ? WHERE u.username = ? AND g.id = ?');
        $s->execute([$uid, $name, $gid]);
        $member = $s->fetch();
        if (!$member) jsonResponse(['error' => 'No username found called by this'], 404);
        $pdo->prepare('INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)')->execute([$gid, $member['id']]);
        jsonResponse(['ok' => true]);
    }

    if ($action === 'remove_member') {
        $gid = (int)($body['group_id'] ?? 0);
        $memberId = (int)($body['user_id'] ?? 0);
        if (!$gid || !$memberId) jsonResponse(['error' => 'Invalid group member.'], 422);

        $s = $pdo->prepare('SELECT owner_id FROM `groups` WHERE id = ? LIMIT 1');
        $s->execute([$gid]);
        $ownerId = $s->fetchColumn();
        if (!$ownerId || (int)$ownerId !== $uid) jsonResponse(['error' => 'Only the group owner can remove members.'], 403);
        if ($memberId === (int)$ownerId) jsonResponse(['error' => 'The group owner cannot be removed.'], 422);

        $pdo->prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?')->execute([$gid, $memberId]);
        jsonResponse(['ok' => true]);
    }

    if ($action === 'group_send') {
        $gid = (int)($body['group_id'] ?? 0);
        $text = trim((string)($body['message'] ?? ''));
        if (!$text) jsonResponse(['error' => 'Message cannot be empty.'], 422);
        $memberCheck = $pdo->prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1');
        $memberCheck->execute([$gid, $uid]);
        if (!$memberCheck->fetch()) jsonResponse(['error' => 'Group not found.'], 404);
        $pdo->prepare('INSERT INTO group_messages (group_id, sender_id, body) VALUES (?, ?, ?)')->execute([$gid, $uid, $text]);
        $pdo->prepare('UPDATE users SET typing_until = NULL WHERE id = ?')->execute([$uid]);
        jsonResponse(['ok' => true]);
    }

    jsonResponse(['error' => 'Unknown action.'], 404);
} catch (Throwable $e) {
    jsonResponse(['error' => 'Server error: ' . $e->getMessage()], 500);
}
