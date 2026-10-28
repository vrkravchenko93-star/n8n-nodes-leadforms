import {
	NodeConnectionTypes,
	type IDataObject,
	type IHookFunctions,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';

import { getQuizzes, leadformsRequest, normalizeLead, verifySignature } from '../GenericFunctions';

/**
 * Мгновенный триггер «новая заявка»: при активации сценария n8n подписывается на заявки аккаунта
 * (POST /v1/hooks, source n8n), при выключении отписывается. Подпись X-Leadforms-Signature сверяется
 * с секретом подписки.
 */
export class LeadformsTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'LeadForms Trigger',
		name: 'leadformsTrigger',
		icon: 'file:leadforms.svg',
		group: ['trigger'],
		version: 1,
		subtitle: 'New lead',
		description: 'Starts the workflow when a visitor submits a LeadForms quiz, page or widget',
		defaults: { name: 'LeadForms Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'leadformsApi', required: true }],
		webhooks: [{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' }],
		properties: [
			{
				displayName: 'Quiz, Page or Widget Names or IDs',
				name: 'quizIds',
				type: 'multiOptions',
				typeOptions: { loadOptionsMethod: 'getQuizzes' },
				default: [],
				description:
					'Leads from these quizzes, pages or widgets only. Leave empty for all. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Verify Signature',
				name: 'verifySignature',
				type: 'boolean',
				default: true,
				description: 'Whether to reject requests without a valid X-Leadforms-Signature',
			},
		],
	};

	methods = { loadOptions: { getQuizzes } };

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				if (!data.webhookId || !data.secret) return false;
				const list = await leadformsRequest.call(this, 'GET', '/v1/hooks');
				const found = ((list && list.data) || []).some((h: IDataObject) => h.id === data.webhookId);
				if (!found) {
					delete data.webhookId;
					delete data.secret;
				}
				return found;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const quizIds = this.getNodeParameter('quizIds', []) as number[];
				const body: IDataObject = {
					target_url: this.getNodeWebhookUrl('default'),
					source: 'n8n',
					event: 'lead.created',
				};
				if (quizIds.length) body.quiz_ids = quizIds;
				const response = await leadformsRequest.call(this, 'POST', '/v1/hooks', body);
				if (!response || !response.id) return false;
				const data = this.getWorkflowStaticData('node');
				data.webhookId = response.id;
				data.secret = response.secret;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				if (data.webhookId) {
					try {
						await leadformsRequest.call(this, 'DELETE', `/v1/hooks/${data.webhookId}`);
					} catch (error) {
						// Уже снятая подписка (404, 410 на стороне LeadForms) — не ошибка.
						const status = (error as { httpCode?: string; cause?: { status?: number } }).httpCode;
						if (status !== '404') return false;
					}
				}
				delete data.webhookId;
				delete data.secret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const verify = this.getNodeParameter('verifySignature', true) as boolean;
		if (verify) {
			const data = this.getWorkflowStaticData('node');
			const req = this.getRequestObject() as unknown as { rawBody?: Buffer | string };
			const raw = req.rawBody === undefined ? JSON.stringify(this.getBodyData()) : req.rawBody.toString();
			const header = this.getHeaderData()['x-leadforms-signature'] as string | undefined;
			if (!verifySignature(String(data.secret || ''), raw, header)) {
				const res = this.getResponseObject();
				res.status(401).send('Invalid signature');
				return { noWebhookResponse: true };
			}
		}

		return {
			workflowData: [this.helpers.returnJsonArray([normalizeLead(this.getBodyData())])],
		};
	}
}
