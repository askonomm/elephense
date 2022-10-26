import * as config from './config';

class IntelephenseLanguageServer extends Disposable {
	private languageClient: LanguageClient | null;
	private didStopDisposable: Disposable | undefined;
	_clientPath: string;

	constructor() {
		super();
		this.languageClient = null;
		this._clientPath =
			config.getConfiguredIntelephensePath() ??
			this.getBundledIntelephensePath();

		console.info(`Found intelephense path: ${this._clientPath}`);
	}

	set clientPath(path: string) {
		this._clientPath = path;
	}
	get clientPath() {
		return this._clientPath;
	}

	private getBundledIntelephensePath() {
		return nova.path.join(
			nova.extension.path,
			'node_modules',
			'intelephense',
			'lib',
			'intelephense.js'
		);
	}

	async deactivate() {
		this.dispose();
	}

	async start() {
		console.info('Starting Intelephense');
		if (this.languageClient) {
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
			},
		};
		const client = new LanguageClient(
			'intelephense',
			'Intelephense Language Server',
			serverOptions,
			clientOptions
		);

		try {
			console.info('Starting client...');
			// Start the client
			client.start();
			console.info('Client started.');

			this.didStopDisposable = client.onDidStop((error) => {
				console.info('Intelephense stopped');
				if (error) {
					console.error(error);
				}
			});

			this.languageClient = client;
		} catch (err) {
			// If the .start() method throws, it's likely because the path to the language server is invalid
			if (nova.inDevMode()) {
				console.error(err);
			}
		}
	}

	async restart() {
		// LanguageClient is stopped asynchronously so we must make sure we wait for it to
		// completely stop before trying to start a new LanguageClient instance.
		let onStop: Disposable | undefined = undefined;
		onStop = this.languageClient?.onDidStop(() => {
			this.start();
			onStop?.dispose();
		});

		await this.dispose();
	}

	async dispose() {
		if (this.didStopDisposable) {
			this.didStopDisposable.dispose();
			this.didStopDisposable = undefined;
			console.info('language client disposables disposed and cleared');
		}

		if (this.languageClient) {
			this.languageClient.stop();
			this.languageClient = null;
			console.info('language client stopped and cleared');
		}
	}
}

export { IntelephenseLanguageServer };
