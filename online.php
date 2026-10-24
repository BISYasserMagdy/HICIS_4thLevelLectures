<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$file = __DIR__ . '/online_sessions.json';
$timeout = 60; // seconds
$now = time();

// Load existing sessions
$sessions = [];
if (file_exists($file)) {
    $raw = file_get_contents($file);
    $sessions = json_decode($raw, true) ?: [];
}

// Get or create session ID
$sid = isset($_GET['sid']) ? preg_replace('/[^a-zA-Z0-9]/', '', $_GET['sid']) : '';
if (empty($sid)) {
    $sid = bin2hex(random_bytes(8));
}

// Update this session's timestamp
$sessions[$sid] = $now;

// Remove expired sessions
foreach ($sessions as $id => $ts) {
    if ($now - $ts > $timeout) {
        unset($sessions[$id]);
    }
}

// Save back
file_put_contents($file, json_encode($sessions), LOCK_EX);

// Return count and sid
echo json_encode([
    'online' => count($sessions),
    'sid' => $sid
]);
