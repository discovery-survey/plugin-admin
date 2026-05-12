<?php
/**
 * SurveyCreditPay
 *
 * LimeSurvey plugin that calls an external credit API for:
 * - completed interviews (afterSurveyComplete)
 * - quota-based screenouts (afterSurveyQuota)
 *
 */

/**
 *
 * @method get($key = null, $model = null, $id = null, $default = null):boolean
 * @method subscribe($event, $function = null)
 * @method log($message, $level = \CLogger::LEVEL_TRACE)
 * @method set(string $key, mixed $data, string|null $model, int|null $id)
 * @method getEvent() PluginEvent
 * @methid $this->gT(string $message) string
 *
 * @property PluginEvent|null $event
 * @property int|null $id
 */
class SurveyCreditPay extends PluginBase
{
    protected $storage = 'DbStorage';

    protected static  $name = 'SurveyCreditPay';
    protected static  $description = 'Credits participants on complete or screenout and can redirect to an external link.';

    /** @var array<string,mixed> */
    protected $settings = [
        'api_url' => [
            'type' => 'string',
            'label' => 'Credit API URL',
            'default' => 'https://1ca4-176-105-209-237.ngrok-free.app/api/credit',
            'help' => 'Global endpoint used for the invisible server-side callback.',
        ],
        'api_key' => [
            'type' => 'password',
            'label' => 'API key',
            'default' => 'jdkbvndfvfj43rvvvVVDSVEWASAqwewe43232edsfr5dvSDVDrtsfS__Dsddsd',
            'help' => 'Will be sent in the X-API-KEY header.',
        ],
        'token_fallback' => [
            'type' => 'string',
            'label' => 'Fallback token',
            'default' => '00000000',
            'help' => 'Used when the survey token cannot be resolved from session/response.',
        ],
        'http_timeout' => [
            'type' => 'int',
            'label' => 'HTTP timeout (seconds)',
            'default' => 10,
            'help' => 'Total request timeout for the credit API call.',
        ],
        'connect_timeout' => [
            'type' => 'int',
            'label' => 'Connect timeout (seconds)',
            'default' => 5,
            'help' => 'Connection timeout for the credit API call.',
        ],
        'user_error_prefix' => [
            'type' => 'text',
            'label' => 'User-facing error message prefix',
            'default' => 'Не удалось зачислить деньги, обратитесь к администратору.',
            'help' => 'The plugin appends the technical error after this text.',
        ],
    ];

    /** @inheritdoc */
    public $allowedPublicMethods = [];

    private const DEFAULT_API_URL = 'https://1ca4-176-105-209-237.ngrok-free.app/api/credit';
    private const DEFAULT_API_KEY = 'jdkbvndfvfj43rvvvVVDSVEWASAqwewe43232edsfr5dvSDVDrtsfS__Dsddsd';
    private const DEFAULT_TOKEN_FALLBACK = '00000000';
    private const DEFAULT_HTTP_TIMEOUT = 10;
    private const DEFAULT_CONNECT_TIMEOUT = 5;
    private const DEFAULT_USER_ERROR_PREFIX = 'Не удалось зачислить деньги, обратитесь к администратору.';

    public function init(): void
    {
        $this->subscribe('beforeSurveySettings');
        $this->subscribe('newSurveySettings');
        $this->subscribe('afterSurveyComplete', 'handleSurveyComplete');
        $this->subscribe('afterSurveyQuota', 'handleSurveyQuota');
    }

    /**
     * Add per-survey settings.
     */
    public function beforeSurveySettings(): void
    {
        $event = $this->event;
        $surveyId = (int) $event->get('survey');

        $event->set("surveysettings.{$this->id}", [
            'name' => get_class($this),
            'settings' => [
                'api_info' => [
                    'type' => 'info',
                    'content' => $this->gT('Configure the reward amounts and callback behavior for this survey. The API URL and key are set in the global plugin settings.'),
                ],
                'api_settings' => [
                    'type' => 'info',
                    'content' => sprintf('Url: %s<br>Key: %s', CHtml::encode($this->get('api_url', null, null, self::DEFAULT_API_URL)), str_repeat('*', max(8, strlen($this->get('api_key', null, null, self::DEFAULT_API_KEY))))),
                ],
                'credit_completed_amount' => [
                    'type' => 'string',
                    'label' => $this->gT('Reward for completed interview'),
                    'current' => $this->get('credit_completed_amount', 'Survey', $surveyId),
                    'help' => $this->gT('Numeric amount to send as result for completed interviews.'),
                    'htmlOptions' => [
                        'placeholder' => '20',
                    ],
                ],
                'credit_screenout_amount' => [
                    'type' => 'string',
                    'label' => $this->gT('Reward for screenout'),
                    'current' => $this->get('credit_screenout_amount', 'Survey', $surveyId),
                    'help' => $this->gT('Numeric amount to send as result for quota screenouts.'),
                    'htmlOptions' => [
                        'placeholder' => '5',
                    ],
                ],
                'credit_enabled' => [
                    'type' => 'select',
                    'label' => $this->gT('Enable credit callback'),
                    'current' => (string) $this->get('credit_enabled', 'Survey', $surveyId, '0'),
                    'default' => '0',
                    'options' => [
                        '0' => $this->gT('Disabled'),
                        '1' => $this->gT('Enabled',)
                    ],
                ],
                'credit_use_api_redirect' => [
                    'type' => 'select',
                    'label' => $this->gT('Use redirect link from external API'),
                    'current' => (string) $this->get('credit_use_api_redirect', 'Survey', $surveyId, '0'),
                    'default' => '0',
                    'options' => [
                        '0' => $this->gT('No'),
                        '1' => $this->gT('Yes'),
                    ],
                    'help' => $this->gT('If enabled and the API returns a non-empty link, the participant will be redirected there.'),
                ],
            ],
        ]);
    }

    /**
     * Persist per-survey settings.
     */
    public function newSurveySettings(): void
    {
        $event = $this->event;
        $surveyId = (int) $event->get('survey');
        $settings = (array) $event->get('settings');

        $keys = [
            'credit_completed_amount',
            'credit_screenout_amount',
            'credit_enabled',
            'credit_use_api_redirect',
        ];

        foreach ($keys as $key) {
            $this->set($key, $settings[$key] ?? null, 'Survey', $surveyId);
        }
    }

    public function handleSurveyComplete(): void
    {
        $this->processOutcomeSafely('completed');
    }

    public function handleSurveyQuota(): void
    {
        $this->processOutcomeSafely('screenout');
    }

    private function processOutcomeSafely(string $reason): void
    {
        try {
            $this->processOutcome($reason);
        } catch (Throwable $e) {
            $this->log(sprintf('Fatal error while processing %s: %s', $reason, $e->getMessage()), \CLogger::LEVEL_ERROR);
            $this->appendUserWarning($this->buildUserErrorMessage($e->getMessage()));
        }
    }

    private function processOutcome(string $reason): void
    {
        $event = $this->getEvent();
        $surveyId = $this->resolveSurveyIdFromEvent($event);
        $responseId = $this->resolveResponseIdFromEvent($event);

        if ($surveyId <= 0 || !$this->isEnabledForSurvey($surveyId)) {
            return;
        }

        if ($this->wasAlreadyProcessed($surveyId, $responseId, $reason)) {
            $this->log(sprintf('Skipping duplicate callback. survey=%d response=%d reason=%s', $surveyId, $responseId, $reason));
            return;
        }

        $amount = $this->getAmountForReason($surveyId, $reason);
        if ($amount === null) {
            $this->appendUserWarning($this->buildUserErrorMessage($this->gT('invalid reward amount in plugin settings')));
            return;
        }

        $payload = [
            'token' => $this->resolveToken($surveyId, $responseId),
            'sid' => $surveyId,
            'result' => $amount,
            'reason' => $reason,
            'ts' => time(),
        ];

        $apiResult = $this->callCreditApi($payload);
        if (!$apiResult['ok']) {
            $this->log(
                sprintf(
                    'Credit API error. survey=%d response=%d reason=%s error=%s',
                    $surveyId,
                    $responseId,
                    $reason,
                    $apiResult['error']
                ),
                \CLogger::LEVEL_ERROR
            );

            $this->appendUserWarning($this->buildUserErrorMessage($apiResult['error']));
            return;
        }

        $this->markProcessed($surveyId, $responseId, $reason);

        $this->log(
            sprintf(
                'Credit callback success. survey=%d response=%d reason=%s payload=%s response=%s',
                $surveyId,
                $responseId,
                $reason,
                json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                json_encode($apiResult['data'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            )
        );

        if (!$this->shouldUseApiRedirect($surveyId)) {
            return;
        }

        $redirectUrl = $this->sanitizeRedirectUrl((string) ($apiResult['data']['link'] ?? ''));
        if ($redirectUrl === null) {
            return;
        }

        $this->applyRedirect($redirectUrl, $reason);
    }

    private function isEnabledForSurvey(int $surveyId): bool
    {
        return (string) $this->get('credit_enabled', 'Survey', $surveyId, '0') === '1';
    }

    private function shouldUseApiRedirect(int $surveyId): bool
    {
        return (string) $this->get('credit_use_api_redirect', 'Survey', $surveyId, '0') === '1';
    }

    /**
     * @return int|float|null
     */
    private function getAmountForReason(int $surveyId, string $reason)
    {
        $settingKey = $reason === 'screenout' ? 'credit_screenout_amount' : 'credit_completed_amount';
        $raw = trim((string) $this->get($settingKey, 'Survey', $surveyId));

        if ($raw === '') {
            return 0;
        }

        $normalized = str_replace(',', '.', $raw);
        if (!is_numeric($normalized)) {
            return null;
        }

        return strpos($normalized, '.') !== false ? (float) $normalized : (int) $normalized;
    }

    private function resolveSurveyIdFromEvent(PluginEvent $event): int
    {
        $candidates = [
            $event->get('surveyId'),
            $event->get('survey'),
            $event->get('sid'),
        ];

        foreach ($candidates as $candidate) {
            $value = (int) $candidate;
            if ($value > 0) {
                return $value;
            }
        }

        return 0;
    }

    private function resolveResponseIdFromEvent(PluginEvent $event): int
    {
        $candidates = [
            $event->get('responseId'),
            $event->get('id'),
            $event->get('srid'),
        ];

        foreach ($candidates as $candidate) {
            $value = (int) $candidate;
            if ($value > 0) {
                return $value;
            }
        }

        return 0;
    }

    private function resolveToken(int $surveyId, int $responseId): string
    {
        $sessionKey = 'survey_' . $surveyId;

        $candidate = $_SESSION[$sessionKey]['tokenused']
            ?? $_SESSION[$sessionKey]['token']
            ?? $_SESSION[$sessionKey]['filltoken']
            ?? null;

        if (!empty($candidate)) {
            return (string) $candidate;
        }

        if ($responseId > 0) {
            try {
                $response = SurveyDynamic::model($surveyId)->findByPk($responseId);
                if ($response && $response->hasAttribute('token') && !empty($response->token)) {
                    return (string) $response->token;
                }
            } catch (Throwable $e) {
                $this->log(sprintf('Failed to resolve token from response: %s', $e->getMessage()), \CLogger::LEVEL_WARNING);
            }
        }

        return (string) $this->get('token_fallback', null, null, self::DEFAULT_TOKEN_FALLBACK);
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function callCreditApi(array $payload): array
    {
        $apiUrl = trim((string) $this->get('api_url', null, null, self::DEFAULT_API_URL));
        $apiKey = (string) $this->get('api_key', null, null, self::DEFAULT_API_KEY);
        $httpTimeout = (int) $this->get('http_timeout', null, null, self::DEFAULT_HTTP_TIMEOUT);
        $connectTimeout = (int) $this->get('connect_timeout', null, null, self::DEFAULT_CONNECT_TIMEOUT);

        if ($apiUrl === '') {
            return [
                'ok' => false,
                'error' => $this->gT('API URL is empty in plugin global settings.'),
            ];
        }

        $ch = curl_init($apiUrl);
        if ($ch === false) {
            return [
                'ok' => false,
                'error' => $this->gT('Unable to initialize cURL.'),
            ];
        }

        $body = http_build_query($payload, '', '&');

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => false,
            CURLOPT_TIMEOUT => max(1, $httpTimeout),
            CURLOPT_CONNECTTIMEOUT => max(1, $connectTimeout),
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_HTTPHEADER => [
                'X-API-KEY: ' . $apiKey,
                'Accept: application/json',
                'Content-Type: application/x-www-form-urlencoded',
            ],
        ]);

        $rawResponse = curl_exec($ch);
        $curlErrNo = curl_errno($ch);
        $curlError = curl_error($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($curlErrNo !== 0) {
            return [
                'ok' => false,
                'error' => sprintf('cURL error %d: %s', $curlErrNo, $curlError),
            ];
        }

        if (!is_string($rawResponse) || $rawResponse === '') {
            return [
                'ok' => false,
                'error' => sprintf('Empty API response (HTTP %d).', $httpCode),
            ];
        }

        $decoded = json_decode($rawResponse, true);
        if (!is_array($decoded)) {
            return [
                'ok' => false,
                'error' => sprintf('Invalid JSON response (HTTP %d): %s', $httpCode, mb_substr($rawResponse, 0, 500)),
            ];
        }

        if ($httpCode !== 200) {
            return [
                'ok' => false,
                'error' => sprintf('API returned HTTP %d: %s', $httpCode, (string) ($decoded['message'] ?? mb_substr($rawResponse, 0, 500))),
            ];
        }

        if (($decoded['status'] ?? null) !== 'ok') {
            return [
                'ok' => false,
                'error' => (string) ($decoded['message'] ?? 'Unknown API error.'),
            ];
        }

        return [
            'ok' => true,
            'data' => $decoded,
        ];
    }

    private function applyRedirect(string $url, string $reason): void
    {
        if ($reason === 'screenout') {
            $event = $this->getEvent();
            $event->set('url', $url);
            $event->set('urldescrip', $url);
            $event->set('autoloadurl', '1');
            $this->appendRedirectScript($url);
            return;
        }

        $this->appendRedirectScript($url);
    }

    private function appendUserWarning(string $message): void
    {
        $content = $this->getEvent()->getContent($this);
        $html = '<div class="alert alert-danger" role="alert" style="margin-top:15px;">' . $message . '</div>';
        $content->addContent($html);
    }

    private function appendRedirectScript(string $url): void
    {
        $content = $this->getEvent()->getContent($this);
        $encodedUrl = CHtml::encode($url);
        $jsUrl = json_encode($url, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        $html = <<<HTML
<script>
(function () {
    var redirectUrl = {$jsUrl};
    if (!redirectUrl) {
        return;
    }
    window.location.replace(redirectUrl);
})();
</script>
<noscript>
    <p><a href="{$encodedUrl}">Continue</a></p>
</noscript>
HTML;

        $content->addContent($html);
    }

    private function sanitizeRedirectUrl(string $url): ?string
    {
        $url = trim($url);
        if ($url === '') {
            return null;
        }

        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            $this->log(sprintf('Invalid redirect URL from API: %s', $url), \CLogger::LEVEL_WARNING);
            return null;
        }

        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        if (!in_array($scheme, ['http', 'https'], true)) {
            $this->log(sprintf('Rejected redirect URL due to unsupported scheme: %s', $url), \CLogger::LEVEL_WARNING);
            return null;
        }

        return $url;
    }

    private function buildUserErrorMessage(string $technicalError): string
    {
        $prefix = trim((string) $this->get('user_error_prefix', null, null, self::DEFAULT_USER_ERROR_PREFIX));
        if ($prefix === '') {
            $prefix = self::DEFAULT_USER_ERROR_PREFIX;
        }

        return CHtml::encode($prefix . ' Укажите ошибку: ' . $technicalError);
    }

    private function wasAlreadyProcessed(int $surveyId, int $responseId, string $reason): bool
    {
        $key = $this->buildProcessMarkerKey($surveyId, $responseId, $reason);
        return !empty($_SESSION['SurveyCreditPay'][$key]);
    }

    private function markProcessed(int $surveyId, int $responseId, string $reason): void
    {
        $key = $this->buildProcessMarkerKey($surveyId, $responseId, $reason);
        if (!isset($_SESSION['SurveyCreditPay']) || !is_array($_SESSION['SurveyCreditPay'])) {
            $_SESSION['SurveyCreditPay'] = [];
        }
        $_SESSION['SurveyCreditPay'][$key] = time();
    }

    private function buildProcessMarkerKey(int $surveyId, int $responseId, string $reason): string
    {
        return $surveyId . ':' . $responseId . ':' . $reason;
    }
}
