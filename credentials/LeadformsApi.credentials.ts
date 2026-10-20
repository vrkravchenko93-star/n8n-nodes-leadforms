import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

/**
 * Подключение к LeadForms: аккаунт (leadforms.org / leadforms.ru) и API-ключ из кабинета
 * (назначение «Zapier / Make / n8n»). Бэкенд один, адрес выбирается по аккаунту.
 */
export class LeadformsApi implements ICredentialType {
	name = 'leadformsApi';

	displayName = 'LeadForms API';

	documentationUrl = 'https://leadforms.org';

	properties: INodeProperties[] = [
		{
			displayName: 'Account',
			name: 'region',
			type: 'options',
			options: [
				{ name: 'leadforms.org', value: 'org' },
				{ name: 'leadforms.ru', value: 'ru' },
			],
			default: 'org',
			description: 'Where your LeadForms account lives',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Dashboard → AI agents and API → key for "Zapier / Make / n8n". Starts with lfk_.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.region === "ru" ? "https://api.leadforms.ru" : "https://api.leadforms.org"}}',
			url: '/v1/me',
		},
	};
}
