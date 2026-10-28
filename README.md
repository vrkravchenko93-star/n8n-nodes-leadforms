# @leadforms/n8n-nodes-leadforms

[n8n](https://n8n.io) community nodes for [LeadForms](https://leadforms.org): send leads from your
quizzes, Leadforms Pages and website widgets to any n8n workflow the moment they arrive.

- [Installation](#installation)
- [Credentials](#credentials)
- [Nodes](#nodes)
- [Lead fields](#lead-fields)
- [Example workflows](#example-workflows)
- [Compatibility](#compatibility)
- [Resources](#resources)

## Installation

Self-hosted n8n: **Settings → Community nodes → Install**, enter `@leadforms/n8n-nodes-leadforms`, confirm.
See the n8n guide to [installing community nodes](https://docs.n8n.io/integrations/community-nodes/installation/).

Manual install (queue mode, Docker images without the GUI installer):

```bash
cd ~/.n8n/nodes
npm install @leadforms/n8n-nodes-leadforms
# restart n8n
```

## Credentials

The nodes authenticate with a LeadForms API key.

1. Sign in to your LeadForms dashboard and open **AI agents and API**:
   [cp.leadforms.org/app/mcp](https://cp.leadforms.org/app/mcp) (leadforms.org accounts) or
   [cp.leadforms.ru/app/mcp](https://cp.leadforms.ru/app/mcp) (leadforms.ru accounts).
2. Create a key with the purpose **Zapier / Make / n8n**. It starts with `lfk_`, is shown once and can only
   read leads and manage lead subscriptions.
3. In n8n create **LeadForms API** credentials: choose your account (leadforms.org or leadforms.ru) and paste
   the key. n8n checks it against `GET /v1/me`.

Revoking the key in LeadForms also removes the subscriptions created with it.

## Nodes

| Node | What it does |
|---|---|
| **LeadForms Trigger** | Instant trigger. When the workflow is activated it subscribes to new leads (all quizzes, pages and widgets, or the ones you pick); when deactivated it unsubscribes. Every delivery is signed (`X-Leadforms-Signature`, HMAC-SHA256 with a per-subscription secret) and the node rejects requests with a wrong or missing signature. |
| **LeadForms** | *Get Many*: leads that arrived after a given lead ID (cursor, oldest first). *Get Latest*: most recent leads. *Get Sample*: the latest lead, or an example of the same shape if there are none yet. Can be used as a tool by n8n AI agents. |

Your n8n webhook URL must be reachable from the internet: LeadForms does not deliver to private or local
addresses. Leads are delivered within seconds; failed deliveries are retried for about 14 hours.

## Lead fields

Each item is the lead as LeadForms sends it (`id`, `quizId`, `created`, `created_at`, `contacts`, `answers`,
`extra`, `result`, `quizDurationSeconds`, `version`) plus flat fields for easy mapping:

| Field | Example |
|---|---|
| `name`, `phone`, `email`, `comment` | `John Smith`, `+15551234567`, `client@example.com` |
| `answers_text` | `Which service are you interested in?: Consultation` (one line per question) |
| `answers_by_question` | `{"Which service are you interested in?": "Consultation"}` |
| `page_url` | `https://example.com/` |
| `utm_source`, `utm_medium`, `utm_campaign` | `google`, `cpc`, `spring_sale` |
| `created_at` | `2026-10-21T09:00:00Z` (ISO 8601, UTC) |

## Example workflows

### New lead → Google Sheets row

1. **LeadForms Trigger**: pick the LeadForms API credentials; leave *Quiz, Page or Widget* empty for all leads.
2. **Google Sheets** → *Append Row in Sheet*: map columns, for example
   `Date` = `{{ $json.created_at }}`, `Name` = `{{ $json.name }}`, `Phone` = `{{ $json.phone }}`,
   `Email` = `{{ $json.email }}`, `Answers` = `{{ $json.answers_text }}`, `Source` = `{{ $json.utm_source }}`.
3. Activate the workflow and submit a test lead on your quiz.

### New lead → Slack or Telegram message

1. **LeadForms Trigger** (optionally limited to one quiz).
2. **Slack** → *Send Message* (or **Telegram** → *Send Message*) with text:

   ```
   New lead from {{ $json.page_url }}
   {{ $json.name }} {{ $json.phone }} {{ $json.email }}
   {{ $json.answers_text }}
   ```

### Catch up on missed leads on a schedule

1. **Schedule Trigger** every 15 minutes.
2. **LeadForms** → *Get Many* with *After Lead ID* = the ID of the last lead you processed
   (store it with workflow static data or in a sheet; `0` means from the very first lead).
3. Process the items and save the `id` of the last one for the next run.

## Compatibility

Built against `n8n-workflow` 2.x, `n8nNodesApiVersion` 1 (n8n 1.x and newer). No runtime dependencies.

## Resources

- [LeadForms](https://leadforms.org) · [LeadForms (Russia)](https://leadforms.ru)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- Support: [support@leadforms.org](mailto:support@leadforms.org), issues:
  [GitHub](https://github.com/vrkravchenko93-star/n8n-nodes-leadforms/issues)

## Development

```bash
npm install
npm run lint   # @n8n/node-cli lint (n8n community node rules)
npm test       # n8n-node build + node --test
```

Releases are published from GitHub Actions with npm provenance (`.github/workflows/publish.yml`) when a
`v*` tag matching `package.json` is pushed. The source of truth lives in the LeadForms monorepo
(`integrations/n8n`); this repository is its public mirror.

## License

[MIT](LICENSE)
