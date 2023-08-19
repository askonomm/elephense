import { sha256 } from 'hash.js';

import { defaultStubs } from './defaults';
import * as config from './config';
import { IntelephenseLanguageServer } from './language-server';
import { installOrUpdateIntelephense } from './installer';
import { createInfoNotice, sendNotification } from './notifications';
import {
	languageServerPathObserver,
	stubsObserver,
	enabledForWorkspaceObserver,
} from './observers';

let langserver: IntelephenseLanguageServer | undefined = undefined;

const activateLicense = async (licenseKey: string): Promise<string> => {
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

			if (config.shouldLogDebugInformation()) {
				console.info('license activation response: ', responseBody);
			}

			const responseJson = (() => {
				try {
					return JSON.parse(responseBody);
				} catch (_e) {
					return false;
				}
			})();

			if (
				0 !== exitStatus ||
				false === responseJson ||
				responseJson?.error
			) {
				if (config.shouldLogDebugInformation()) {
					console.info(
						'curl exited with an error when trying to activate license.'
					);
				}

				console.error(
					`Could not activate license. Exited with code ${exitStatus}, and resposne ${responseBody}`
				);
				reject(`Failed to activate license "${licenseKey}"`);
			}

			resolve(responseBody);
		});

		curlProcess.start();
	});
};

const writeLicenseActivationInformationToFile = (
	licenseKey: string,
	licenseActivationInformation: string
) => {
	// Create global storage path if it doesn't already exist.
	// This shouldn't happen, but good to cover this edge case.
	if (!nova.fs.stat(nova.extension.globalStoragePath)?.isDirectory()) {
		nova.fs.mkdir(nova.extension.globalStoragePath);
	}

	const path = nova.path.join(
		nova.extension.globalStoragePath,
		`intelephense_licence_key_${licenseKey}`
	);
	const f = nova.fs.open(path, 'w');
	f.write(licenseActivationInformation);
	f.close();
};

const getLicenseKeyFromUser = async () => {
	const enterKeyNotice = new NotificationRequest(
		'enter-intelephense-license-key'
	);
	enterKeyNotice.title = 'Intelephense license key';
	enterKeyNotice.body = 'Enter your Intelephense license key.';
	enterKeyNotice.type = 'input';
	enterKeyNotice.actions = ['Submit', 'Cancel'];
	enterKeyNotice.textInputValue = config.getLicenseKey() ?? '';
	enterKeyNotice.textInputPlaceholder = 'ABCDEF123456789';

	try {
		const reply = await nova.notifications.add(enterKeyNotice);
		// Only the 0 index int he action array is 'Submit'.
		if (reply.actionIdx !== 0) {
			return false;
		}

		return reply?.textInputValue?.trim() ?? '';
	} catch (_e) {
		// We don't really care if delivering the notice failed or not, so we just treat it as if
		// the notice was dismissed.
		return false;
	}
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
			errorNotice.body =
				'A licence key must be a 15 character alphanumeric string.';
			nova.notifications.add(errorNotice);

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
			const successNotice = new NotificationRequest(
				'activate-intelephense-license-success'
			);
			successNotice.title = 'License key activation success!';
			successNotice.body =
				'Your Intelephense licence key has been activated.';
			nova.notifications.add(successNotice);

			// If Intelephense is already running we restart it.
			if (langserver) {
				langserver.restart();
			}
		} catch (e) {
			errorNotice.body = `${e}`;
			nova.notifications.add(errorNotice);

			if (config.shouldLogDebugInformation()) {
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
