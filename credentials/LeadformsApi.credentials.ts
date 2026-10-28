import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, Icon, INodeProperties } from 'n8n-workflow';

/**
 * Подключение к LeadForms: аккаунт (leadforms.org / leadforms.ru) и API-ключ из кабинета
 * (назначение «Zapier / Make / n8n»). Бэкенд один, адрес выбирается по аккаунту.
 */
export class LeadformsApi implements ICredentialType {
	name = 'leadformsApi';

	displayName = 'LeadForms API';

	icon: Icon = { light: 'file:../icons/leadforms.svg', dark: 'file:../icons/leadforms.dark.svg' };

	documentationUrl = 'https://github.com/vrkravchenko93-star/n8n-nodes-leadforms#credentials';

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
			description:
				'Create it in your LeadForms dashboard: <a href="https://cp.leadforms.org/app/mcp">AI agents and API</a> (for leadforms.ru: <a href="https://cp.leadforms.ru/app/mcp">AI agents and API</a>), purpose "Zapier / Make / n8n". Starts with lfk_.',
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
