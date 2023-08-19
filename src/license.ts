import { sha256 } from 'hash.js';

import * as config from './config';
import { createNotification, sendNotification } from './notifications';

export const activateLicense = async (licenseKey: string): Promise<string> => {
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

export const writeLicenseActivationInformationToFile = (
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

export const getLicenseKeyFromUser = async () => {
	try {
		const reply = await sendNotification(
			createNotification(
				'enter-intelephense-license-key',
				'Intelephense license key',
				'Enter your Intelephense license key.',
				'input',
				config.getLicenseKey() ?? '',
				'ABCDEF123456789',
				['Submit', 'Cancel']
			)
		);

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
