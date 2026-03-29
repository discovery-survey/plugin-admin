# SurveyCreditPay

LimeSurvey plugin for crediting participants after:
- successful survey completion (`completed`)
- quota-based screenout (`screenout`)

The plugin sends a **server-side invisible POST request** to an external API and can optionally redirect the participant to the link returned by that API.

## What is configurable

### Global plugin settings
Set in **Configuration -> Plugins -> SurveyCreditPay -> Settings**:
- `Credit API URL`
- `API key`
- `Fallback token`
- `HTTP timeout`
- `Connect timeout`
- `User-facing error message prefix`

### Per-survey settings
Set in **Survey -> Plugin settings -> SurveyCreditPay**:
- `Reward for completed interview`
- `Reward for screenout`
- `Enable credit callback`
- `Use redirect link from external API`

## API request

The plugin sends `application/x-www-form-urlencoded` POST data:

- `token` — resolved from LimeSurvey token/session if possible, otherwise fallback token
- `sid` — survey ID
- `result` — reward amount
- `reason` — `completed` or `screenout`
- `ts` — unix timestamp

HTTP header:

- `X-API-KEY: <configured API key>`

## Expected API responses

### Success
```json
{
  "status": "ok",
  "link": "https://example.com/redirect"
}
```

### Error
```json
{
  "status": "error",
  "message": "Credit not applied"
}
```

## Behavior details

- The normal LimeSurvey flow is **not blocked** if the API fails.
- On API failure the participant sees an error message, for example:
  - `Не удалось зачислить деньги, обратитесь к администратору. Укажите ошибку: ...`
- If redirect is enabled and the API returned a valid `http/https` link:
  - after `completed` the end page redirects via injected script
  - after quota `screenout` the plugin also sets quota redirect values and injects a fallback redirect script
- Duplicate calls for the same `surveyId + responseId + reason` are suppressed within the same PHP session.

## Important limitation

`screenout` in this plugin means **standard LimeSurvey quota termination**.

If your project uses another kind of screenout logic, this plugin will need one more hook or custom integration point.

## Installation

### Option A: upload ZIP
1. Zip the `SurveyCreditPay` folder.
2. In LimeSurvey go to **Configuration -> Plugins**.
3. Click **Upload & Install**.
4. Activate the plugin.
5. Open plugin global settings and fill API URL / API key.
6. Open a specific survey and configure survey-level reward values.

### Option B: copy to filesystem
1. Copy the folder to:
   ```
   plugins/SurveyCreditPay/
   ```
2. Make sure these files exist:
   ```
   plugins/SurveyCreditPay/SurveyCreditPay.php
   plugins/SurveyCreditPay/config.xml
   ```
3. In LimeSurvey go to **Configuration -> Plugins**.
4. Use **Scan files** if needed.
5. Install and activate the plugin.

## Folder structure

```text
SurveyCreditPay/
├── SurveyCreditPay.php
├── config.xml
└── README.md
```

## Notes for production

- Replace the ngrok URL with your stable production endpoint.
- Consider lowering the text of the technical error shown to end users if you do not want API/internal details displayed.
- Check `tmp/runtime/plugin.log` for plugin logs.
