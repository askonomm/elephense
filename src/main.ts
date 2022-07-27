import { defaultStubs } from './defaults';

let eventHandler: Emitter | null = null;
let langserver: IntelephenseLanguageServer | null = null;

nova.commands.register(
	'com.thorlaksson.intelephense.restartServer',
	(_workspace) => {
		if (langserver) {
			langserver.stop();
			langserver = null;
		}
		// Constructor automatically starts the server.
		langserver = new IntelephenseLanguageServer();
	}
);

nova.commands.register(
	'com.thorlaksson.intelephense.resetWorkspaceStubs',
	(workspace) => {
		workspace.config.set('intelephense.workspace-stubs', defaultStubs);
	}
);

const installIntelephense = () => {
	// Install via npm.
	const installProcess = new Process('usr/bin/env', {
		args: ['npm', 'ci'],
		cwd: nova.extension.path,
	});

	installProcess.onDidExit((exitStatus) => {
		console.log('=== install done ===');
		if (0 !== exitStatus) {
			eventHandler?.emit('intelephenseFailedToInstall');
		} else {
			eventHandler?.emit('intelephenseInstalled');
		}
	});

	installProcess.start();
};

const checkIntelephenseVersion = () => {
	const getIntelephensePath = new Process('usr/bin/env', {
		args: [
			'npm',
			'ls',
			'intelephense',
			'--parseable',
			'--long',
			'--depth',
			'0',
		],
		cwd: nova.extension.path,
	});

	let hasCorrectVersion = false;

	getIntelephensePath.onStdout((line) => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const [_, npmVersion] = line.trim().split('@');
		if ('1.8.0' === npmVersion) {
			hasCorrectVersion = true;
		}
	});

	getIntelephensePath.onDidExit((exitStatus) => {
		if (0 === exitStatus) {
			if (hasCorrectVersion) {
				console.info('Intelephense is installed and up to date');
				// Since we're installing Intelephense, provide the bundled version.
				eventHandler?.emit('intelephenseUpToDate');
				return;
			}
		}
		console.info(
			'Intelephense is either not installed or using the wrong version'
		);
		eventHandler?.emit('intelephenseOutOfDate');
	});

	getIntelephensePath.start();
};

class IntelephenseLanguageServer {
	languageClient: LanguageClient | null;

	constructor() {
		this.languageClient = null;

		// Observe the configuration setting for the server's location, and restart the server on change
		nova.config.observe(
			'intelephense.language-server-path',
			(path: string, _: string) => {
				this.checkPath(path);
			}
		);

		eventHandler?.on('startIntelephense', this.start);
		eventHandler?.on('intelephenseUpToDate', () => {
			this.start(
				nova.path.join(
					nova.extension.path,
					'node_modules',
					'intelephense',
					'lib',
					'intelephense.js'
				)
			);
		});
		eventHandler?.on('intelephenseInstalled', () => {
			this.start(
				nova.path.join(
					nova.extension.path,
					'node_modules',
					'intelephense',
					'lib',
					'intelephense.js'
				)
			);
		});
	}

	deactivate() {
		this.stop();
		eventHandler?.clear('startIntelephense');
		eventHandler?.clear('intelephenseUpToDate');
	}

	checkPath(providedPath: string) {
		if (!providedPath) {
			eventHandler?.emit('ensureBundledIntelephense');
		} else {
			eventHandler?.emit('startIntelephense', providedPath);
		}
	}

	start(path: string) {
		if (this.languageClient) {
			this.languageClient.stop();
		}

		// Create the client
		const serverOptions = {
			path: '/usr/bin/env',
			args: ['node', path, '--stdio'],
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
			// Start the client
			client.start();

			client.onDidStop((error) => {
				if (error) {
					console.error(error);
				}
			});

			// Add the client to the subscriptions to be cleaned up
			this.languageClient = client;
		} catch (err) {
			// If the .start() method throws, it's likely because the path to the language server is invalid

			if (nova.inDevMode()) {
				console.error(err);
			}
		}
	}

	stop() {
		if (this.languageClient) {
			this.languageClient.stop();
			this.languageClient = null;
		}
	}
}

exports.activate = function () {
	// Do work when the extension is activated
	eventHandler = new Emitter();

	eventHandler.on('intelephenseOutOfDate', () => {
		const needToInstall = new NotificationRequest(
			'com.thorlaksson.intelephense.installing-intelephense'
		);
		needToInstall.title = 'Initializing Intelephense';
		needToInstall.body =
			'Working on installing the Intelephense language server...';
		nova.notifications.add(needToInstall);
	});
	eventHandler.on('intelephenseOutOfDate', () => {
		installIntelephense();
	});

	eventHandler.on('intelephenseInstalled', () => {
		const successfullyInstalled = new NotificationRequest(
			'com.thorlaksson.intelephense.intelephense-installed'
		);
		successfullyInstalled.title = 'Intelephense successfully initialized';
		successfullyInstalled.body =
			'Intelephense has been successfully installed';
		nova.notifications.add(successfullyInstalled);
	});

	eventHandler.on('intelephenseFailedToInstall', () => {
		const failedToInstall = new NotificationRequest(
			'com.thorlaksson.intelephense.intelephense-installation-failed'
		);
		failedToInstall.title = 'Intelephense has failed to initialize';
		failedToInstall.body =
			'The Intelephense language server could not be installed';
		nova.notifications.add(failedToInstall);
	});

	eventHandler.on('ensureBundledIntelephense', checkIntelephenseVersion);

	// Make sure we start the language server last, since all events must be registered prior to
	// entering the constructor.
	langserver = new IntelephenseLanguageServer();

	// Watch for changes in project-specific stubs.
	nova.workspace.config.onDidChange(
		'intelephense.workspace-stubs',
		(newSettings: string[], _oldSettings) => {
			const shouldReset = () => {
				if (newSettings.length !== defaultStubs.length) {
					return false;
				}

				newSettings.forEach((stub) => {
					if (!defaultStubs.includes(stub)) {
						return false;
					}
				});
				return true;
			};

			// If project stubs are set to the default value we instead use the global stubs.
			if (shouldReset()) {
				if (nova.inDevMode()) {
					console.log('Resetting workspace stubs');
				}
				const globalStubs = nova.config.get('intelephense.stubs');
				nova.workspace.config.set('intelephense.stubs', globalStubs);
			} else {
				if (nova.inDevMode()) {
					console.log('Updating workspace stubs');
				}
				nova.workspace.config.set('intelephense.stubs', newSettings);
			}
		}
	);
};

exports.deactivate = function () {
	// Clean up state before the extension is deactivated
	if (langserver) {
		langserver.deactivate();
		langserver = null;
	}
	if (eventHandler) {
		eventHandler.clear('intelephenseOutOfDate');
		eventHandler.clear('intelephenseInstalled');
		eventHandler.clear('intelephenseFailedToInstall');
		eventHandler.clear('ensureBundledIntelephense');
		eventHandler = null;
	}
};
