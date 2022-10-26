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
	}

	set clientPath(path: string) {
		this._clientPath = path;
	}
	get clientPath() {
		return this._clientPath;
	}

	async deactivate() {
		this.dispose();
	}

	async handleStop(error: Error | undefined) {
		if (error) {
			console.info('Intelephense stopped');
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
			if (nova.inDevMode()) {
				console.error(err);
			}

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
			this.didStopDisposable.dispose();
			this.didStopDisposable = undefined;
		}

		if (this.languageClient) {
			this.languageClient.stop();
			this.languageClient = null;
		}
	}
}

export { IntelephenseLanguageServer };
