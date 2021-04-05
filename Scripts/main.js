let eventHandler = null;
var langserver = null;

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

const installIntelephense = () => {
	// Install via npm.
	const installProcess = new Process('usr/bin/env', {
		args: ['npm', 'ci'],
		cwd: nova.extension.path,
	});

	installProcess.onDidExit((exitStatus) => {
		console.log('=== install done ===');
		if (0 !== exitStatus) {
			eventHandler.emit('intelephenseFailedToInstall');
		} else {
			eventHandler.emit('intelephenseInstalled');
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
		const [_, npmVersion] = line.trim().split('@');
		if ('1.5.4' === npmVersion) {
			hasCorrectVersion = true;
		}
	});

	getIntelephensePath.onDidExit((exitStatus) => {
		if (0 === exitStatus) {
			if (hasCorrectVersion) {
				console.info('Intelephense is installed and up to date');
				// Since we're installing Intelephense, provide the bundled version.
				eventHandler.emit('intelephenseUpToDate');
				return;
			}
		}
		console.info(
			'Intelephense is either not installed or using the wrong version'
		);
		eventHandler.emit('intelephenseOutOfDate');
	});

	getIntelephensePath.start();
};

class IntelephenseLanguageServer {
	constructor() {
		// Observe the configuration setting for the server's location, and restart the server on change
		nova.config.observe(
			'intelephense.language-server-path',
			function (path) {
				this.checkPath(path);
			},
			this
		);

		eventHandler.on('startIntelephense', this.start);
		eventHandler.on('intelephenseUpToDate', () => {
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
		eventHandler.on('intelephenseInstalled', () => {
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
		eventHandler.clear('startIntelephense');
		eventHandler.clear('intelephenseUpToDate');
	}

	checkPath(providedPath) {
		if (!providedPath) {
			eventHandler.emit('ensureBundledIntelephense');
		} else {
			eventHandler.emit('startIntelephense', providedPath);
		}
	}

	start(path) {
		if (this.languageClient) {
			this.languageClient.stop();
			nova.subscriptions.remove(this.languageClient);
		}

		// Create the client
		var serverOptions = {
			path: '/usr/bin/env',
			args: ['node', path, '--stdio'],
		};
		var clientOptions = {
			// The set of document syntaxes for which the server is valid
			syntaxes: ['advphp', 'php', 'phtml'],
			initializationOptions: {
				clearCache: false,
			},
		};
		var client = new LanguageClient(
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
			nova.subscriptions.add(client);
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
			nova.subscriptions.remove(this.languageClient);
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
