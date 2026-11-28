<?php
declare(strict_types=1);

const DB_HOST = '127.0.0.1';
const DB_NAME = 'hive';
const DB_USER = 'root';
const DB_PASS = '';

function db(): PDO
{
    static $pdo;
    if ($pdo instanceof PDO) return $pdo;

    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
    return $pdo;
}

function userAvatarColumn(PDO $pdo): string
{
    static $col;
    if ($col !== null) return $col;
    $col = $pdo->query("SHOW COLUMNS FROM users LIKE 'avatar'")->fetch() ? 'avatar' : 'avatar_path';
    return $col;
}

function hasMessageRecipientColumn(PDO $pdo): bool
{
    static $has;
    if ($has !== null) return $has;
    $has = (bool) $pdo->query("SHOW COLUMNS FROM messages LIKE 'recipient_id'")->fetch();
    return $has;
}

function saveAvatarDataUrl(string $avatar, int $userId): string
{
    $avatar = trim($avatar);
    if ($avatar === '') return '';
    if (!preg_match('/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/i', $avatar, $matches)) {
        return $avatar;
    }

    $bytes = base64_decode($matches[2], true);
    if ($bytes === false || strlen($bytes) === 0) {
        throw new RuntimeException('Invalid image data.');
    }
    if (strlen($bytes) > 15 * 1024 * 1024) {
        throw new RuntimeException('Image is too large (max 15 MB).');
    }

    $ext = strtolower($matches[1]);
    if ($ext === 'jpeg') $ext = 'jpg';

    $dir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'avatars';
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('Could not create avatar upload directory.');
    }

    $filename = sprintf('avatar_%d_%s.%s', $userId, bin2hex(random_bytes(8)), $ext);
    $fullPath = $dir . DIRECTORY_SEPARATOR . $filename;
    if (file_put_contents($fullPath, $bytes) === false) {
        throw new RuntimeException('Could not save avatar file.');
    }

    return 'uploads/avatars/' . $filename;
}

function jsonResponse(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function requestBody(): array
{
    $raw = file_get_contents('php://input');
    return $raw ? (json_decode($raw, true) ?: []) : $_POST;
}

function requireUser(): int
{
    if (empty($_SESSION['user_id'])) jsonResponse(['error' => 'Please log in first.'], 401);
    return (int) $_SESSION['user_id'];
}

function userPayload(array $user): array
{
    $isOnline = !empty($user['online']) && !empty($user['last_seen']) && strtotime((string)$user['last_seen']) > (time() - 30);
    return [
        'id' => (int) $user['id'],
        'username' => $user['username'],
        'display_name' => $user['display_name'],
        'avatar' => ($user['avatar'] ?? $user['avatar_path'] ?? '') ?: 'blank-profile-pic.png',
        'online' => $isOnline ? 1 : 0,
        'typing' => ($isOnline && !empty($user['typing_until']) && strtotime((string)$user['typing_until']) > time()) ? 1 : 0,
    ];
}
