# Offers / Angebote

Customers submit requests at /#angebote. Administrators manage them under Angebote.
The green paper-plane opens an editable German email with customer, vehicle and requested work prefilled. Enter a price before sending. The status changes to `quoted` only after Brevo accepts the message. Outlook / Gmail opens a mailto draft and does not mark it as sent.

Apply `lib/db/migrations/20261015_quote_requests.sql` to the same PostgreSQL database used by the API (additive migration).

Server environment:
- `BREVO_API_KEY`: Brevo API key (never a VITE variable).
- `BREVO_SENDER_EMAIL`: verified sender in Brevo; falls back to the shop email.
- The sender name comes from shop settings.

Restart the API after configuration. Do not place secrets in frontend configuration.
Brevo reference: https://developers.brevo.com/docs/send-a-transactional-email
