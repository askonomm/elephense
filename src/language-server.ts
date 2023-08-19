import * as config from './config';
import { sendNotification, createInfoNotice } from './notifications';

class IntelephenseLanguageServer extends Disposable {
	private languageClient: LanguageClient | null;
	private didStopDisposable: Disposable | undefined;
	_clientPath: string;

	constructor() {
		super();
		this.languageClient = null;
		this._clientPath =
			config.getConfiguredIntelephensePath() ??
			config.getBundledIntelephensePath();

		if (config.shouldLogDebugInformation()) {
			console.info(
				`Language client path initialized to: ${this._clientPath}`
			);
		}
	}

	set clientPath(path: string) {
		this._clientPath = path;
	}
	get clientPath() {
		return this._clientPath;
	}

	public getWorkspaceStoragePath() {
		const workspaceStoragePath = nova.extension.workspaceStoragePath;

		if (!nova.fs.stat(workspaceStoragePath)?.isDirectory()) {
			nova.fs.mkdir(workspaceStoragePath);
		}

		return workspaceStoragePath;
	}

	public getGlobalStoragePath() {
		const globalStoragePath = nova.extension.globalStoragePath;

		if (!nova.fs.stat(globalStoragePath)?.isDirectory()) {
			nova.fs.mkdir(globalStoragePath);
		}

		return globalStoragePath;
	}

	async deactivate() {
		this.dispose();
	}

	async handleStop(error: Error | undefined) {
		if (error) {
			sendNotification(
				createInfoNotice(
					'intelephense-unexpectedly-stopped',
					nova.localize('Intelephense stopped'),
					nova.localize(
						'Intelephense unexpectedly stopped. See extension console for more details.'
					)
				)
			);

			console.error(
				'Intelephense stopped with the following error:',
				error.message
			);
		}
	}

	async start() {
		if (this.languageClient) {
			if (config.shouldLogDebugInformation()) {
				console.info(
					'Instance of the language client already exists, disposing before starting a new instance.'
				);
			}
			await this.dispose();
		}

		// Create the client
		const serverOptions = {
			path: '/usr/bin/env',
			args: ['node', this._clientPath, '--stdio'],
		};

		const clientOptions = {
			// The set of document syntaxes for which the server is valid
			syntaxes: ['advphp', 'php', 'phtml'],
			initializationOptions: {
				clearCache: false,
				storagePath: this.getWorkspaceStoragePath(),
				globalStoragePath: this.getGlobalStoragePath(),
				licenceKey: config.getLicenseKey(),
			},
		};

		if (config.shouldLogDebugInformation()) {
			console.info(
				'Starting language server with server options: ',
				JSON.stringify(serverOptions)
			);
			console.info(
				'Starting language server with client options: ',
				JSON.stringify(clientOptions)
			);
		}

		try {
			this.languageClient = new LanguageClient(
				'intelephense',
				'Intelephense Language Server',
				serverOptions,
				clientOptions
			);
			this.didStopDisposable = this.languageClient.onDidStop(
				this.handleStop
			);

			// Start the client
			this.languageClient.start();
		} catch (err) {
			console.error(err);

			sendNotification(
				createInfoNotice(
					'unable-to-start-intelephense',
					nova.localize('Intelephense could not be started'),
					nova.localize(
						'The extension could not start the Intelephense language server. See extension console for details.'
					)
				)
			);
		}
	}

	async restart() {
		// LanguageClient is stopped asynchronously so we must make sure we wait for it to
		// completely stop before trying to start a new LanguageClient instance.
		let onStop: Disposable | undefined = undefined;
		onStop = this.languageClient?.onDidStop(() => {
			this.start();
			onStop?.dispose();

			sendNotification(
				createInfoNotice(
					'intelephense-restarted',
					nova.localize('Intelephense restarted'),
					nova.localize('Intelephense has been restarted')
				)
			);
		});

		await this.dispose();
	}

	async dispose() {
		if (this.didStopDisposable) {
			if (config.shouldLogDebugInformation()) {
				console.info('Disposing of language client stop handler.');
			}

			this.didStopDisposable.dispose();
			this.didStopDisposable = undefined;
		}

		if (this.languageClient) {
			if (config.shouldLogDebugInformation()) {
				console.info('Stopping and clearing language client.');
			}

			this.languageClient.stop();
			this.languageClient = null;
		}
	}
}

export { IntelephenseLanguageServer };
