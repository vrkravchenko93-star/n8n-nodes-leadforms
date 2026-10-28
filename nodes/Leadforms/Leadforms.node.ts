import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import { getQuizzes, leadformsRequest, normalizeLead } from '../GenericFunctions';

/**
 * Заявки LeadForms по запросу: лента после номера заявки (GET /v1/leads?since_id=) и пример заявки.
 * Для опроса по расписанию: храните номер последней полученной заявки и передавайте его в «After Lead ID».
 */
export class Leadforms implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'LeadForms',
		name: 'leadforms',
		icon: 'file:leadforms.svg',
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Get leads from LeadForms quizzes, pages and widgets',
		defaults: { name: 'LeadForms' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'leadformsApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Get Many', value: 'getMany', action: 'Get leads after a lead ID', description: 'Leads in order of arrival after the given lead' },
					{ name: 'Get Latest', value: 'getLatest', action: 'Get the latest leads', description: 'Newest leads first' },
					{ name: 'Get Sample', value: 'getSample', action: 'Get a sample lead', description: 'The latest lead, or a sample of the same shape if there are none' },
				],
				default: 'getMany',
			},
			{
				displayName: 'After Lead ID',
				name: 'sinceId',
				type: 'number',
				default: 0,
				description: 'Return leads that arrived after this lead. 0 means from the very first lead.',
				displayOptions: { show: { operation: ['getMany'] } },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 100 },
				default: 50,
				description: 'Max number of results to return',
				displayOptions: { show: { operation: ['getMany', 'getLatest'] } },
			},
			{
				displayName: 'Quiz, Page or Widget Names or IDs',
				name: 'quizIds',
				type: 'multiOptions',
				typeOptions: { loadOptionsMethod: 'getQuizzes' },
				default: [],
				description:
					'Only these quizzes, pages or widgets. Leave empty for all. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
		],
	};

	methods = { loadOptions: { getQuizzes } };

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const quizIds = this.getNodeParameter('quizIds', i, []) as number[];
				const qs: IDataObject = {};
				if (quizIds.length) qs.quiz_ids = quizIds.join(',');
				let leads: IDataObject[];
				if (operation === 'getSample') {
					const r = await leadformsRequest.call(this, 'GET', '/v1/leads/sample', undefined, qs);
					leads = r.data || [];
				} else {
					qs.limit = this.getNodeParameter('limit', i, 50) as number;
					if (operation === 'getLatest') {
						qs.since_id = 0;
						qs.order = 'desc';
					} else {
						qs.since_id = this.getNodeParameter('sinceId', i, 0) as number;
					}
					const r = await leadformsRequest.call(this, 'GET', '/v1/leads', undefined, qs);
					leads = r.data || [];
				}
				out.push(...leads.map((lead) => ({ json: normalizeLead(lead), pairedItem: { item: i } })));
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}
		return [out];
	}
}
