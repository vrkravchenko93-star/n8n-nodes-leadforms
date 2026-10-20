# n8n-nodes-leadforms

[n8n](https://n8n.io) community nodes for [LeadForms](https://leadforms.org): send leads from your
quizzes, Leadforms Pages and website widgets to any n8n workflow the moment they arrive.

## Nodes

| Node | What it does |
|---|---|
| **LeadForms Trigger** | Instant trigger. When the workflow is activated it subscribes to new leads (all objects or the ones you pick); when deactivated it unsubscribes. Every delivery is signed (`X-Leadforms-Signature`, HMAC-SHA256) and the node rejects unsigned requests. |
| **LeadForms** | *Get Many* — leads after a given lead number (cursor), *Get Latest* — most recent leads, *Get Sample* — an example lead for mapping. Can be used as a tool by n8n AI agents. |

Each lead also gets flat fields for easy mapping: `name`, `phone`, `email`, `comment`, `answers_text`,
`answers_by_question`, `page_url`, `utm_source`, `utm_medium`, `utm_campaign`. Original fields are kept as is.

## Installation

Self-hosted n8n: **Settings → Community nodes → Install** → `n8n-nodes-leadforms`.

## Credentials

1. In the LeadForms dashboard open **AI agents and API** and create a key with the purpose **Zapier / Make / n8n**
   (it starts with `lfk_` and can only read leads and manage subscriptions).
2. In n8n create **LeadForms API** credentials: choose your account (leadforms.org or leadforms.ru) and paste the key.

Your n8n webhook URL must be reachable from the internet: LeadForms does not deliver to private or local addresses.

## Development

```bash
npm install
npm test   # TypeScript build, icons, node --test
```

The source of truth lives in the LeadForms monorepo (`integrations/n8n`); this repository is its public mirror.

## License

[MIT](LICENSE)
