import { createHmac, timingSafeEqual } from 'crypto';
import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	IWebhookFunctions,
} from 'n8n-workflow';

type Ctx = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions | IWebhookFunctions;

/** Адрес API по аккаунту подключения (бэкенд один, ключ подходит обоим). */
export async function apiBase(this: Ctx): Promise<string> {
	const credentials = await this.getCredentials('leadformsApi');
	return credentials.region === 'ru' ? 'https://api.leadforms.ru' : 'https://api.leadforms.org';
}

export async function leadformsRequest(
	this: Ctx,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<any> {
	const baseURL = await apiBase.call(this);
	return this.helpers.httpRequestWithAuthentication.call(this, 'leadformsApi', {
		method,
		baseURL,
		url: path,
		body,
		qs,
		json: true,
	});
}

/** Квизы, страницы и виджеты аккаунта для выбора (GET /v1/leads/sources). */
export async function getQuizzes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const response = await leadformsRequest.call(this, 'GET', '/v1/leads/sources');
	return ((response && response.data) || []).map((s: { id: number; name: string; type: string }) => ({
		name: s.type === 'quiz' ? s.name : `${s.name} (${s.type})`,
		value: s.id,
	}));
}

/**
 * X-Leadforms-Signature: t=<unix>,v1=<hex>, hex = HMAC-SHA256(secret, "<t>.<raw body>").
 * Подписи старше tolerance секунд не принимаются.
 */
export function verifySignature(secret: string, rawBody: string, header: string | undefined, toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000)): boolean {
	if (!secret || !header) return false;
	let t: number | null = null;
	const sigs: string[] = [];
	for (const part of header.split(',')) {
		const [k, v] = part.trim().split('=');
		if (k === 't' && /^\d+$/.test(v || '')) t = Number(v);
		else if (k === 'v1' && v) sigs.push(v);
	}
	if (t === null || Math.abs(nowSec - t) > toleranceSec) return false;
	const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
	return sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

function answerText(a: unknown): string {
	if (a === null || a === undefined) return '';
	if (typeof a === 'string' || typeof a === 'number') return String(a);
	if (Array.isArray(a)) return a.map(answerText).filter(Boolean).join(', ');
	if (typeof a === 'object') {
		const o = a as Record<string, unknown>;
		if (Array.isArray(o.files)) return (o.files as Array<Record<string, string>>).map((f) => f.url || f.name || '').filter(Boolean).join(', ');
		if ('first' in o && 'second' in o) return `${o.first} – ${o.second}`;
		if ('dateFrom' in o) return [o.dateFrom, o.dateTo].filter(Boolean).join(' – ');
		return Object.values(o).map(answerText).filter(Boolean).join(', ');
	}
	return '';
}

/** Заявка как пришла + плоские поля для сопоставления (имя, телефон, почта, ответы строкой). */
export function normalizeLead(lead: IDataObject): IDataObject {
	const contacts = (lead.contacts as IDataObject) || {};
	const messenger = (contacts.messenger as IDataObject) || {};
	const answers = Array.isArray(lead.answers) ? (lead.answers as IDataObject[]) : [];
	const pairs = answers.map((x) => [String(x.q || ''), answerText(x.a)] as [string, string]);
	const extra = (lead.extra as IDataObject) || {};
	const utm = extra.utm && !Array.isArray(extra.utm) ? (extra.utm as IDataObject) : {};
	const phoneLike = ['phone', 'whatsapp', 'telegram', 'viber', 'max'].includes(String(messenger.type || ''));
	return {
		...lead,
		name: contacts.name || contacts.messengerName || '',
		phone: contacts.phone || (phoneLike ? messenger.value || '' : ''),
		email: contacts.email || '',
		comment: contacts.text || '',
		answers_text: pairs.map(([q, a]) => `${q}: ${a}`).join('\n'),
		answers_by_question: Object.fromEntries(pairs.filter(([q]) => q)),
		page_url: extra.href || '',
		utm_source: utm.utm_source || '',
		utm_medium: utm.utm_medium || '',
		utm_campaign: utm.utm_campaign || '',
	};
}
