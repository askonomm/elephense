var langserver = null;

exports.activate = function () {
	// Do work when the extension is activated
	langserver = new IntelephenseLanguageServer();
};

exports.deactivate = function () {
	// Clean up state before the extension is deactivated
	if (langserver) {
		langserver.deactivate();
		langserver = null;
	}
};

const shouldUpdateIntelephense = () => {
	return new Promise((resolve, reject) => {
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
					resolve(false);
					return;
				}
			}
			console.info(
				'Intelephense is either not installed or using the wrong version'
			);
			resolve(true);
		});

		getIntelephensePath.start();
	});
};

const installIntelephense = () => {
	return new Promise((resolve, reject) => {
		const needToInstall = new NotificationRequest(
			'com.thorlaksson.intelephense.installing-intelephense'
		);
		needToInstall.title = 'Initializing Intelephense';
		needToInstall.body =
			'Working on installing the Intelephense language server...';
		nova.notifications.add(needToInstall);

		// Install via npm.
		const installProcess = new Process('usr/bin/env', {
			args: ['npm', 'ci'],
			cwd: nova.extension.path,
		});

		installProcess.onDidExit((exitStatus) => {
			if (0 !== exitStatus) {
				const failedToInstall = new NotificationRequest(
					'com.thorlaksson.intelephense.intelephense-installation-failed'
				);
				failedToInstall.title = 'Intelephense has failed to initialize';
				failedToInstall.body =
					'The Intelephense language server could not be installed';
				nova.notifications.add(failedToInstall);
				reject('Could not install Intelephense');
				return;
			}

			const successfullyInstalled = new NotificationRequest(
				'com.thorlaksson.intelephense.intelephense-installed'
			);
			successfullyInstalled.title =
				'Intelephense successfully initialized';
			successfullyInstalled.body =
				'Intelephense has been successfully installed';
			nova.notifications.add(successfullyInstalled);

			resolve();
		});

		installProcess.start();
	});
};

class IntelephenseLanguageServer {
	constructor() {
		// Observe the configuration setting for the server's location, and restart the server on change
		nova.config.observe(
			'intelephense.language-server-path',
			function (path) {
				this.start(path);
			},
			this
		);
	}

	deactivate() {
		this.stop();
	}

	start(providedPath) {
		if (this.languageClient) {
			this.languageClient.stop();
			nova.subscriptions.remove(this.languageClient);
		}

		shouldUpdateIntelephense()
			.then((shouldUpdate) => {
				if (shouldUpdate) {
					return installIntelephense();
				}
			})
			.then(() => {
				// Use the default server path
				if (!providedPath) {
					providedPath = nova.path.join(
						nova.extension.path,
						'node_modules',
						'intelephense',
						'lib',
						'intelephense.js'
					);

					const pathInfo = nova.fs.stat(providedPath);
					if (!pathInfo || !pathInfo.isFile()) {
						const result = installIntelephense();
						if (!result) {
							// Failed to install, so we return and stop.
							throw new Error('No Intelephense available');
						}
					}
				}
				return providedPath;
			})
			.then((path) => {
				// Create the client
				var serverOptions = {
					path: '/usr/bin/env',
					args: ['node', path, '--stdio'],
				};
				var clientOptions = {
					// The set of document syntaxes for which the server is valid
					syntaxes: ['advphp', 'php', 'phtml'],
					initializationOptions: {
						clearCache: true,
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
			})
			.catch((err) => {
				console.error('Failed to start Intelephense:', err);
			});
	}

	stop() {
		if (this.languageClient) {
			this.languageClient.stop();
			nova.subscriptions.remove(this.languageClient);
			this.languageClient = null;
		}
	}
}
