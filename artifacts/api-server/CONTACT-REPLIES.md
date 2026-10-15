# Contact replies

Configure these environment variables on the API server (never in Vite/client variables):

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
```

The sender must be verified in Brevo. If `BREVO_SENDER_EMAIL` is omitted, the business email in admin settings is used. Business name, phone and email in the AI signature come from admin settings.

Opening a contact reply generates a draft using the customer's name, subject and message plus business details. Draft generation does not send an email or change the contact status. Staff can edit the subject and body, regenerate with confirmation before replacing existing text, or write manually if AI is unavailable. Only the explicit send button submits email to Brevo; the recipient is resolved from the stored contact on the server. A successful provider response updates the status to `replied`. Outlook / Gmail opens a mail client with the draft and does not update the status because sending cannot be confirmed there.

Both POST endpoints require admin authentication:

- `/api/admin/contact-messages/:id/draft`: returns `{ subject, message }`.
- `/api/admin/contact-messages/:id/reply`: accepts `{ subject, message }`, returns `{ sent: true, warning?: string }`.

Missing provider configuration returns a visible error and leaves manual drafting/mail-client use available. If sending times out, check Brevo's history before retrying because the delivery result may be uncertain.

References: [OpenAI text generation](https://developers.openai.com/api/docs/guides/text), [Brevo transactional email](https://developers.brevo.com/reference/send-transac-email).
