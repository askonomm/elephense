import { defaultStubs } from './defaults';
import * as config from './config';
import IntelephenseLanguageServer from './language-server';
import { createInfoNotice, sendNotification } from './notifications';
import {
	getLicenseKeyFromUser,
	activateLicense,
	writeLicenseActivationInformationToFile,
} from './license';
import {
	languageServerPathObserver,
	stubsObserver,
	enabledForWorkspaceObserver,
} from './observers';

let langserver: IntelephenseLanguageServer | undefined = undefined;

nova.commands.register('ee.nmm.elephense.restartServer', async (_workspace) => {
	console.log('Restarting server ...');

	if (!langserver) {
		langserver = await IntelephenseLanguageServer.init();
	}

	langserver.restart();
});

nova.commands.register('ee.nmm.elephense.resetWorkspaceStubs', (workspace) => {
	workspace.config.set('intelephense.workspace-stubs', defaultStubs);
});

nova.commands.register(
	'ee.nmm.elephense.enter-license-key',
	// We need to use the `langserver` variable in the function which is why it's not defined in
	// license.ts.
	async (_workspace) => {
		// The error notice can be used in multiple places so we prepare it here for brevity.
		const errorNotice = new NotificationRequest(
			'enter-intelephense-license-key-error'
		);
		errorNotice.title = 'Failed to activate Intelephense license key';

		const licenseKey = await getLicenseKeyFromUser();

		// If the license key is false that means the notice was dismissed.
		if (licenseKey === false) {
			return;
		}

		// Make sure the provided license key is an alphanumeric string with 15 characters.c
		if (!/^[0-9a-zA-Z]{15}$/.test(licenseKey)) {
			sendNotification(
				createInfoNotice(
					'enter-intelephense-license-key-error',
					'Failed to activate Intelephense license key',
					'A licence key must be a 15 character alphanumeric string.'
				)
			);

			if (config.shouldLogDebugInformation()) {
				console.error(
					`Failed to activate Intelephense license: ${errorNotice.body}`
				);
			}

			// Nothing more to do if the key is invalid.
			return;
		}

		try {
			const responseBody = await activateLicense(licenseKey);
			writeLicenseActivationInformationToFile(licenseKey, responseBody);
			config.setLicenseKey(licenseKey);

			// Send success notice.
			sendNotification(
				createInfoNotice(
					'activate-intelephense-license-success',
					'License key activation success!',
					'Your Intelephense licence key has been activated.'
				)
			);

			// If Intelephense is already running we restart it.
			if (langserver) {
				langserver.restart();
			}
		} catch (e) {
			sendNotification(
				createInfoNotice(
					'enter-intelephense-license-key-error',
					'Failed to activate Intelephense license key',
					`${e}`
				)
			);

			if (config.shouldLogDebugInformation()) {
				console.error(e);
			}
		}
	},
	langserver
);

exports.activate = async () => {
	try {
		langserver = await IntelephenseLanguageServer.init();
		nova.subscriptions.add(langserver);

		if (config.isEnabledForWorkspace()) {
			langserver.start();
		}

		// Make sure we start the language server last, since all events must be registered prior to
		// entering the constructor.

		// Observe the configuration setting for the server's location, and restart the server on change
		nova.config.observe(
			'intelephense.language-server-path',
			languageServerPathObserver,
			langserver
		);
		nova.workspace.config.observe(
			'intelephense.language-server-path',
			languageServerPathObserver,
			langserver
		);

		// Watch for changes in project-specific stubs.
		nova.workspace.config.onDidChange(
			'intelephense.workspace-stubs',
			stubsObserver
		);
		nova.workspace.config.observe(
			'intelephense.extension.enabled',
			enabledForWorkspaceObserver,
			langserver
		);
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
};

exports.deactivate = function () {
	// Clean up state before the extension is deactivated
	if (langserver) {
		langserver.deactivate();
		langserver = undefined;
	}
};
