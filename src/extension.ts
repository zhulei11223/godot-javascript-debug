/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';
import { QuickJSDebugSession } from './quickjsDebug';
import * as Net from 'net';

export function activate(context: vscode.ExtensionContext) {
	// register a configuration provider for 'godot-quickjs' debug type
	const provider = new QuickJSConfigurationProvider();
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('godot-quickjs', provider));

	// The following use of a DebugAdapter factory shows how to run the debug adapter inside the extension host (and not as a separate process).
	const factory = new QuickJSDebugAdapterDescriptorFactory();
	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('godot-quickjs', factory));
	context.subscriptions.push(factory);
}

export function deactivate() {
	// nothing to do
}


class QuickJSConfigurationProvider implements vscode.DebugConfigurationProvider {

	/**
	 * Massage a debug configuration just before a debug session is being launched,
	 * e.g. add all missing attributes to the debug configuration.
	 */
	resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration | CommonArguments, token?: CancellationToken): ProviderResult<DebugConfiguration> {
		config.cwd = config.cwd || folder.uri.path;
		config.cwd = config.cwd.replace("${workspaceFolder}", folder.uri.path);
		if (config.program) {
			config.program = config.program.replace("${workspaceFolder}", folder.uri.path);
		}
		return config as DebugConfiguration;
	}
}

class QuickJSDebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {

	private server?: Net.Server;

	createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {

		if (!this.server) {
			// start listening on a random port
			this.server = Net.createServer(socket => {
				const session = new QuickJSDebugSession();
				session.setRunAsServer(true);
				session.start(<NodeJS.ReadableStream>socket, socket);
			}).listen(0);
		}

		// make VS Code connect to debug server
		return new vscode.DebugAdapterServer((<Net.AddressInfo>this.server.address()).port);
	}

	dispose() {
		if (this.server) {
			this.server.close();
		}
	}
}
