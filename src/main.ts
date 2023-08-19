import { sha256 } from 'hash.js';

import { defaultStubs } from './defaults';
import {
	shouldLogDebugInformation,
	isEnabledForWorkspace,
	setLicenseKey,
	getLicenseKey,
} from './config';
import { IntelephenseLanguageServer } from './language-server';
import { installOrUpdateIntelephense } from './installer';
import { createInfoNotice, sendNotification } from './notifications';
import {
	languageServerPathObserver,
	stubsObserver,
	enabledForWorkspaceObserver,
} from './observers';

let langserver: IntelephenseLanguageServer | undefined = undefined;

const activateLicense = async (licenseKey: string) => {
	return new Promise((resolve, reject) => {
		let responseBody = '';

		const machineId = sha256()
			.update(nova.path.expanduser('~'))
			.digest('hex');

		console.info(`machineId: ${machineId}`);

		const postData = `machineId=${machineId}&licenceKey=${licenseKey}`;

		const curlProcess = new Process('usr/bin/env', {
			args: [
				'curl',
				'--data',
				postData,
				'--request',
				'POST',
				'https://intelephense.com/activate',
			],
		});

		curlProcess.onStdout((line) => {
			responseBody += line;
		});

		curlProcess.onDidExit((exitStatus) => {
			responseBody = responseBody.trim();

			if (shouldLogDebugInformation()) {
				console.info('license activation response: ', responseBody);
			}

			if (0 !== exitStatus) {
				if (shouldLogDebugInformation()) {
					console.info(
						'curl exited with an error when trying to activate license.'
					);
				}

				console.error(
					`Could not activate license. Exited with code ${exitStatus}`
				);
				reject(`Failed to activate license "${licenseKey}"`);
			}

			resolve(responseBody);
		});

		curlProcess.start();
	});
};

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

nova.commands.register(
	'com.thorlaksson.intelephense.enter-license-key',
	async (_workspace) => {
		if (!langserver) {
			// TODO: show warning notice?
			return;
		}

		const enterKeyNotice = new NotificationRequest(
			'enter-intelephense-license-key'
		);
		enterKeyNotice.title = 'Intelephense license key';
		enterKeyNotice.body = 'Enter your Intelephense license key.';
		enterKeyNotice.type = 'input';
		enterKeyNotice.actions = ['Submit', 'Cancel'];
		enterKeyNotice.textInputValue = getLicenseKey() ?? '';
		enterKeyNotice.textInputPlaceholder = 'ABCDEF123456789';

		const errorNotice = new NotificationRequest(
			'enter-intelephense-license-key-error'
		);
		errorNotice.title = 'Failed to activate Intelephense license key';

		const reply = await nova.notifications.add(enterKeyNotice);
		// Only the 0 index int he action array is 'Submit'.
		if (reply.actionIdx !== 0) {
			return;
		}

		const licenseKey = reply?.textInputValue?.trim() ?? '';

		if (licenseKey && !/^[0-9a-zA-Z]{15}$/.test(licenseKey)) {
			errorNotice.body =
				'A licence key must be a 15 character alphanumeric string.';
			nova.notifications.add(errorNotice);

			if (shouldLogDebugInformation()) {
				console.error(
					`Failed to activate Intelephense license: ${errorNotice.body}`
				);
			}

			return;
		}

		try {
			const responseBody = await activateLicense(licenseKey);

			const path = nova.path.join(
				nova.extension.globalStoragePath,
				`intelephense_licence_key_${licenseKey}`
			);
			const f = nova.fs.open(path, 'w');
			f.write(JSON.stringify(responseBody));
			f.close();

			if (shouldLogDebugInformation()) {
				console.info('Successfully saved license activation response.');
			}

			setLicenseKey(licenseKey);

			const successNotice = new NotificationRequest(
				'activate-intelephense-license-success'
			);
			successNotice.title = 'License key activation success!';
			successNotice.body =
				'Your Intelephense licence key has been activated.';
			nova.notifications.add(successNotice);

			langserver.restart();
		} catch (e) {
			errorNotice.body = `${e}`;
			nova.notifications.add(errorNotice);

			if (shouldLogDebugInformation()) {
				console.error(e);
			}
		}
	},
	langserver
);

exports.activate = async function () {
	try {
		await installOrUpdateIntelephense();

		langserver = new IntelephenseLanguageServer();
		nova.subscriptions.add(langserver);

		if (isEnabledForWorkspace()) {
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
