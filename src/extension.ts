// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
// import {
// 	V1alpha2DevWorkspaceSpecTemplate, V1alpha2DevWorkspaceSpecTemplateComponentsItemsContainerEndpoints
//   } from '@devfile/api';
import { Endpoint } from './endpoint';
import { EndpointCategory } from './endpoint-category';
import { EndpointExposure } from './endpoint-exposure';
import { Command } from './command';
import {
	V1alpha2DevWorkspaceSpecTemplate, 
	V1alpha2DevWorkspaceSpecTemplateComponentsItemsContainerEndpoints,
	V1alpha2DevWorkspaceSpecTemplateCommands
} from '@devfile/api';

let endpoints : Array<Endpoint>;
let commands : Array<Command>;

async function initialize()
{
	if (!process.env.DEVWORKSPACE_ID) {
		return;
	}

	const extension = vscode.extensions.getExtension('eclipse-che.api');
	if (!extension) {
		vscode.window.showErrorMessage('eclipse-che.api not found', 'ok');
		return;
	}

	await extension.activate();
	const cheApi = extension?.exports;
	const devfileService = cheApi.getDevfileService();
	const devfile: V1alpha2DevWorkspaceSpecTemplate = await devfileService.get();

	const containerComponents = devfile?.components
		?.filter(component => component.container)
		.map(
			component =>
			({
				...component.container,
				componentAttributes: component.attributes,
			})
		) || [];

	const devfileEndpoints = containerComponents
		.map(container =>
			(container.endpoints || []).map(endpoint => ({
				...endpoint,
				componentAttributes: container.componentAttributes,
			}))
		)
		.reduce((acc, val) => acc.concat(val), []);

	endpoints = devfileEndpoints.map(exposedEndpoint => {
		let exposure: EndpointExposure;
		if (exposedEndpoint.exposure === V1alpha2DevWorkspaceSpecTemplateComponentsItemsContainerEndpoints.ExposureEnum.Public) {
			exposure = EndpointExposure.FROM_DEVFILE_PUBLIC;
		} else if (exposedEndpoint.exposure === V1alpha2DevWorkspaceSpecTemplateComponentsItemsContainerEndpoints.ExposureEnum.Internal) {
			exposure = EndpointExposure.FROM_DEVFILE_PRIVATE;
		} else {
			exposure = EndpointExposure.FROM_DEVFILE_NONE;
		}

		// category ? is is part of eclipse che-code
		let category;
		const isPartOfCheCode = (exposedEndpoint.componentAttributes as any)?.['app.kubernetes.io/part-of'] === 'che-code.eclipse.org';
		if (isPartOfCheCode) {
			category = EndpointCategory.PLUGINS;
		} else {
			category = EndpointCategory.USER;
		}

		return {
			name: exposedEndpoint.name,
			category,
			exposure,
			protocol: exposedEndpoint.protocol,
			url: (exposedEndpoint.attributes as any)?.['controller.devfile.io/endpoint-url'],
			targetPort: exposedEndpoint.targetPort,
		} as Endpoint;
	});

	commands = devfile?.commands?.map(
			command => ({
				name: command.id
			} as Command)
		) || [];
}


// this method is called when your extension is activated
export async function activate(context: vscode.ExtensionContext) {
	console.log('Extension "che-devfile-ext" is now active!');

	await initialize();

	const api = {
		getEndpoints() : Array<Endpoint> {
			return endpoints;
		},

		getEndpoint(endpointId: string): Endpoint | undefined {
			return endpoints.find(a => a.name === endpointId);
		},

		getEndpointUrl(endpointId: string): string | undefined {
			return endpoints.find(a => a.name === endpointId)?.url;
		}
	};

	let disposable = vscode.commands.registerCommand('che-devfile-ext.command-list', () => {
		commands?.forEach(a => {
			console.log(a.name);
		});
	});

	context.subscriptions.push(disposable);

	
	return api;
}

// this method is called when your extension is deactivated
export function deactivate() { }
