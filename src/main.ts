import { defaultStubs } from './defaults';
import * as config from './config';
import { IntelephenseLanguageServer } from './language-server';
import { installOrUpdateIntelephense } from './installer';
import { createInfoNotice, sendNotification } from './notifications';

let langserver: IntelephenseLanguageServer | null = null;

nova.commands.register(
	'com.thorlaksson.intelephense.restartServer',
	(_workspace) => {
		if (!langserver) {
			langserver = new IntelephenseLanguageServer();
		}
		langserver.restart();
	}
);

nova.commands.register(
	'com.thorlaksson.intelephense.resetWorkspaceStubs',
	(workspace) => {
		workspace.config.set('intelephense.workspace-stubs', defaultStubs);
	}
);

exports.activate = async function () {
	try {
		await installOrUpdateIntelephense();

		langserver = new IntelephenseLanguageServer();
		nova.subscriptions.add(langserver);

		langserver.start();
	} catch (e) {
		console.error(
			'Something went wrong when updating or installing Intelephense:',
			e
		);

		sendNotification(
			createInfoNotice(
				'failed-to-install-intelephense',
				nova.localize('Could not install bundled Intelephense'),
				nova.localize(
					'Something went wrong while updating or installing Intelephense. See extension console for details.'
				)
			)
		);
	}

	// Make sure we start the language server last, since all events must be registered prior to
	// entering the constructor.

	// Observe the configuration setting for the server's location, and restart the server on change
	nova.config.observe(
		'intelephense.language-server-path',
		(path: string, _: string) => {
			if (!langserver) {
				return;
			}

			if (path && path !== langserver.clientPath) {
				console.info('Intelephense path updated');
				langserver.clientPath = path;
				langserver.restart();

				sendNotification(
					createInfoNotice(
						'new-intelephense-path',
						nova.localize('New Intelephense path detected'),
						nova.localize(
							'Intelephense has been restarted and is now using the newly provided path.'
						)
					)
				);
			} else if (
				!path &&
				config.getBundledIntelephensePath() !== langserver.clientPath
			) {
				langserver.clientPath = config.getBundledIntelephensePath();
				langserver.restart();

				sendNotification(
					createInfoNotice(
						'bundled-intelephense-path',
						nova.localize('New Intelephense path detected'),
						nova.localize(
							'Intelephense has been restarted and is now using the bundled version of the language server.'
						)
					)
				);
			}
		}
	);

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
};
