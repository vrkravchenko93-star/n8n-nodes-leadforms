// Проверки собранного пакета: описание узлов, подпись, нормализация заявки, подписка/отписка триггера на моках.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');
const { verifySignature, normalizeLead } = require('../dist/nodes/GenericFunctions.js');
const { LeadformsTrigger } = require('../dist/nodes/LeadformsTrigger/LeadformsTrigger.node.js');
const { Leadforms } = require('../dist/nodes/Leadforms/Leadforms.node.js');
const { LeadformsApi } = require('../dist/credentials/LeadformsApi.credentials.js');

const sign = (secret, body, t) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;

test('package lists built files', () => {
  for (const f of [...pkg.n8n.nodes, ...pkg.n8n.credentials]) require(`../${f}`);
  assert.ok(pkg.keywords.includes('n8n-community-node-package'));
});

test('credentials point to the account server', () => {
  const c = new LeadformsApi();
  assert.equal(c.name, 'leadformsApi');
  assert.match(String(c.test.request.baseURL), /api\.leadforms\.ru.*api\.leadforms\.org/);
  assert.equal(c.authenticate.properties.headers.Authorization, '=Bearer {{$credentials.apiKey}}');
});

test('signature', () => {
  const body = '{"id":1,"version":1}';
  assert.equal(verifySignature('whsec_test', body, sign('whsec_test', body, 1760000000), 300, 1760000010), true);
  assert.equal(verifySignature('whsec_other', body, sign('whsec_test', body, 1760000000), 300, 1760000010), false);
  assert.equal(verifySignature('whsec_test', body + ' ', sign('whsec_test', body, 1760000000), 300, 1760000010), false);
  assert.equal(verifySignature('whsec_test', body, sign('whsec_test', body, 1760000000), 300, 1760000500), false);
  assert.equal(verifySignature('whsec_test', body, undefined), false);
});

test('normalizeLead keeps fields and adds flat ones', () => {
  const lead = normalizeLead({
    id: 5, answers: [{ q: 'Service?', a: { 9: 'Consultation' } }], contacts: { name: 'Ann', messenger: { type: 'whatsapp', value: '+1555' } },
    extra: { href: 'https://s.com/', utm: { utm_source: 'google' } }, version: 1,
  });
  assert.equal(lead.id, 5);
  assert.equal(lead.phone, '+1555');
  assert.equal(lead.answers_text, 'Service?: Consultation');
  assert.equal(lead.utm_source, 'google');
  assert.equal(lead.version, 1);
});

function hookCtx({ calls, responses, staticData, params = {} }) {
  return {
    getWorkflowStaticData: () => staticData,
    getNodeParameter: (name, def) => (name in params ? params[name] : def),
    getNodeWebhookUrl: () => 'https://n8n.example.com/webhook/abc',
    getCredentials: async () => ({ region: 'org', apiKey: 'lfk_x' }),
    helpers: {
      httpRequestWithAuthentication: async (cred, opts) => {
        calls.push({ cred, ...opts });
        const r = responses.shift();
        if (r instanceof Error) throw r;
        return r;
      },
    },
  };
}

test('trigger subscribes, checks and unsubscribes', async () => {
  const trigger = new LeadformsTrigger();
  const calls = [];
  const staticData = {};
  const ctx = hookCtx({ calls, staticData, params: { quizIds: [6903] }, responses: [{ id: 1234567, secret: 'whsec_n' }, { data: [{ id: 1234567 }] }, { ok: true }] });
  const m = trigger.webhookMethods.default;
  assert.equal(await m.checkExists.call(ctx), false);
  assert.equal(await m.create.call(ctx), true);
  assert.deepEqual(calls[0].body, { target_url: 'https://n8n.example.com/webhook/abc', source: 'n8n', event: 'lead.created', quiz_ids: [6903] });
  assert.equal(calls[0].baseURL, 'https://api.leadforms.org');
  assert.equal(calls[0].url, '/v1/hooks');
  assert.equal(staticData.secret, 'whsec_n');
  assert.equal(await m.checkExists.call(ctx), true);
  assert.equal(await m.delete.call(ctx), true);
  assert.equal(calls[2].method, 'DELETE');
  assert.equal(calls[2].url, '/v1/hooks/1234567');
  assert.equal(staticData.webhookId, undefined);
});

test('trigger webhook verifies signature', async () => {
  const trigger = new LeadformsTrigger();
  const body = { id: 7, contacts: { name: 'Ann' }, version: 1 };
  const raw = JSON.stringify(body);
  let status = null;
  const ctx = (header) => ({
    getNodeParameter: () => true,
    getWorkflowStaticData: () => ({ secret: 'whsec_n' }),
    getRequestObject: () => ({ rawBody: Buffer.from(raw) }),
    getHeaderData: () => ({ 'x-leadforms-signature': header }),
    getBodyData: () => body,
    getResponseObject: () => ({ status: (s) => { status = s; return { send: () => {} }; } }),
    helpers: { returnJsonArray: (a) => a.map((json) => ({ json })) },
  });
  const ok = await trigger.webhook.call(ctx(sign('whsec_n', raw, Math.floor(Date.now() / 1000))));
  assert.equal(ok.workflowData[0][0].json.name, 'Ann');
  const bad = await trigger.webhook.call(ctx(sign('whsec_x', raw, Math.floor(Date.now() / 1000))));
  assert.equal(bad.noWebhookResponse, true);
  assert.equal(status, 401);
});

test('regular node builds feed queries', async () => {
  const node = new Leadforms();
  const calls = [];
  const params = { operation: 'getMany', sinceId: 900000010, limit: 10, quizIds: [1, 2] };
  const ctx = {
    getInputData: () => [{ json: {} }],
    getNodeParameter: (name, i, def) => (name in params ? params[name] : def),
    getCredentials: async () => ({ region: 'ru', apiKey: 'lfk_x' }),
    continueOnFail: () => false,
    getNode: () => ({}),
    helpers: { httpRequestWithAuthentication: async (cred, opts) => { calls.push(opts); return { data: [{ id: 3, contacts: {} }] }; } },
  };
  const [items] = await node.execute.call(ctx);
  assert.equal(items[0].json.id, 3);
  assert.equal(calls[0].baseURL, 'https://api.leadforms.ru');
  assert.deepEqual(calls[0].qs, { quiz_ids: '1,2', limit: 10, since_id: 900000010 });
});
