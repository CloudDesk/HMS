# Initial hospital and localization configuration

New databases require explicit configuration before the first settings read can create the singleton document. Supply all of the following through the API's existing environment configuration and restart the API:

| Variable | Value |
| --- | --- |
| `HMS_INITIAL_HOSPITAL_NAME` | Actual hospital name |
| `HMS_INITIAL_HOSPITAL_PHONE` | Actual contact phone, matching the settings phone validation |
| `HMS_INITIAL_HOSPITAL_EMAIL` | Actual contact email |
| `HMS_INITIAL_HOSPITAL_ADDRESS` | Actual hospital address |
| `HMS_INITIAL_COUNTRY` | Explicitly selected supported country |
| `HMS_INITIAL_TIMEZONE` | Explicitly selected supported IANA timezone |
| `HMS_INITIAL_CURRENCY` | Explicitly selected supported currency code |
| `HMS_INITIAL_CURRENCY_SYMBOL` | Explicitly selected display symbol, 1–8 characters |

The supported country/timezone/currency values remain the existing Settings API enums. There is no implicit Kenya, India, USD, or UTC selection. Missing or invalid configuration returns `503 SETTINGS_SETUP_REQUIRED` and inserts nothing. This is a settings-initialization guard, not a global application setup gate: runtime helpers and other modules can still use their existing fallback behavior. Complete configuration before allowing clinical or billing use.

Existing saved settings are read unchanged even if these variables are absent, invalid, or changed. Environment configuration is bootstrap-only, not an override. All API instances for a fresh deployment should receive the same values. No data migration or correction of previously persisted templates is performed; an authorized administrator must review and explicitly edit any incorrect existing settings.

Hospital and localization resets return `409 SETTINGS_EXPLICIT_CONFIGURATION_REQUIRED`, preserving identity, locale, logo, and audit history. Use the existing authorized settings edit endpoints instead. General and user-preference resets continue to work. The neutral runtime hospital fallback says “Hospital not configured” and contains no invented contact details; it is not persisted as a valid hospital configuration.

Country/currency/timezone cross-field restrictions remain a product decision. Do not infer that USD billing or a selected timezone is invalid merely from country. Existing validation and formatting contracts remain unchanged; bootstrap values are individually validated against those contracts. Expanding supported markets or creating an interactive setup flow requires a separate scoped change.

Other modules still contain market-specific runtime fallbacks (including the web settings hook's timezone fallback). Those were not changed in C3. This fix prevents incorrect settings persistence; it does not claim to replace every application-wide localization fallback.
