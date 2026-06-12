<?php
declare(strict_types=1);

/**
 * Meta Conversions API endpoint — DNA PPS
 * Recebe POST JSON do navegador (via window.sendCapi) e relaya pro Graph API v22.
 * Hash PII se ainda não estiver hashada. Dedup com Pixel via event_id.
 *
 * Env vars (capi.env):
 *   META_PIXEL_ID         (default 1922595521595366)
 *   META_CAPI_TOKEN       (System User token do Events Manager)
 *   META_TEST_EVENT_CODE  (opcional, pra validar no Events Manager → Test Events)
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

$PIXEL_ID        = getenv('META_PIXEL_ID')        ?: '1922595521595366';
$ACCESS_TOKEN    = getenv('META_CAPI_TOKEN')      ?: '';
$TEST_EVENT_CODE = getenv('META_TEST_EVENT_CODE') ?: '';

if ($ACCESS_TOKEN === '') {
    http_response_code(503);
    echo json_encode(['error' => 'capi_not_configured', 'hint' => 'set META_CAPI_TOKEN']);
    exit;
}

$rawBody = file_get_contents('php://input');
$payload = json_decode((string)$rawBody, true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_json']);
    exit;
}

$eventName      = (string)($payload['event_name']       ?? '');
$eventId        = (string)($payload['event_id']         ?? '');
$eventSourceUrl = (string)($payload['event_source_url'] ?? '');
$userDataIn     = is_array($payload['user_data']   ?? null) ? $payload['user_data']   : [];
$customDataIn   = is_array($payload['custom_data'] ?? null) ? $payload['custom_data'] : [];

if ($eventName === '' || $eventId === '') {
    http_response_code(400);
    echo json_encode(['error' => 'missing_fields']);
    exit;
}

/** IP real atrás do Traefik */
function clientIp(): string {
    $xff = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
    if ($xff !== '') {
        foreach (explode(',', $xff) as $cand) {
            $cand = trim($cand);
            if ($cand !== '' && filter_var($cand, FILTER_VALIDATE_IP)) {
                return $cand;
            }
        }
    }
    return $_SERVER['REMOTE_ADDR'] ?? '';
}

/** Hash SHA-256 hex se ainda não estiver hashado. */
function maybeHash(string $v): string {
    $v = trim(strtolower($v));
    if ($v === '') return '';
    if (preg_match('/^[a-f0-9]{64}$/', $v)) return $v;
    return hash('sha256', $v);
}

$ud = [];
foreach (['em','ph','fn','ln','ct','st','zp','country','external_id'] as $k) {
    if (!empty($userDataIn[$k])) {
        $ud[$k] = maybeHash((string)$userDataIn[$k]);
    }
}
if (!empty($userDataIn['fbp'])) $ud['fbp'] = (string)$userDataIn['fbp'];
if (!empty($userDataIn['fbc'])) $ud['fbc'] = (string)$userDataIn['fbc'];

$ud['client_ip_address'] = clientIp();
$ud['client_user_agent'] = (string)($userDataIn['client_user_agent'] ?? ($_SERVER['HTTP_USER_AGENT'] ?? ''));

$event = [
    'event_name'       => $eventName,
    'event_time'       => time(),
    'event_id'         => $eventId,
    'event_source_url' => $eventSourceUrl !== '' ? $eventSourceUrl : 'https://ppsdna.com.br/',
    'action_source'    => 'website',
    'user_data'        => $ud,
];
if (!empty($customDataIn)) $event['custom_data'] = $customDataIn;

$body = ['data' => [$event]];
if ($TEST_EVENT_CODE !== '') $body['test_event_code'] = $TEST_EVENT_CODE;

$url = "https://graph.facebook.com/v22.0/{$PIXEL_ID}/events?access_token=" . urlencode($ACCESS_TOKEN);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS     => json_encode($body),
    CURLOPT_TIMEOUT        => 5,
    CURLOPT_CONNECTTIMEOUT => 3,
]);
$response = curl_exec($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err      = curl_error($ch);
curl_close($ch);

if ($httpCode >= 200 && $httpCode < 300) {
    echo json_encode(['ok' => true, 'event_id' => $eventId]);
} else {
    error_log("CAPI DNA-PPS error http={$httpCode} err=" . ($err ?: '-') . " resp=" . ($response ?: '-'));
    http_response_code(502);
    echo json_encode([
        'ok'              => false,
        'event_id'        => $eventId,
        'upstream_status' => $httpCode,
    ]);
}
