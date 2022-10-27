import * as config from './config';
import { createInfoNotice, sendNotification } from './notifications';

const getIntelephenseVersion = () => {
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

		getIntelephensePath.onStdout((line) => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const [_, npmVersion] = line.trim().split('@');

			if (config.shouldLogDebugInformation()) {
				console.info(
					'NPM found the following intelephense versions: ',
					line
				);
				console.info(
					`Bundled Intelephense detected as version ${npmVersion}`
				);
			}

			if (!npmVersion) {
				if (config.shouldLogDebugInformation()) {
					console.info('No installation of Intelephense detected.');
				}

				reject('Intelephense is not installed.');
			}

			resolve(npmVersion);
		});

		getIntelephensePath.onDidExit((exitStatus) => {
			if (0 !== exitStatus) {
				if (config.shouldLogDebugInformation()) {
					console.info(
						'NPM exited with an error when trying to find an installation of the bundled Intelephense.'
					);
				}

				console.error(
					`Intelephense is not installed. Exited with code ${exitStatus}`
				);
				reject('Intelephense is not installed.');
			}
		});

		getIntelephensePath.start();
	});
};

const hasCorrectIntelephenseVersion = async () => {
	const installedVersion = await getIntelephenseVersion();
	return '1.8.2' === installedVersion;
};

export const installOrUpdateIntelephense = async () => {
	try {
		if (await hasCorrectIntelephenseVersion()) {
			if (config.shouldLogDebugInformation()) {
				console.info(
					'Intelephense already installed and has the right version.'
				);
			}

			return;
		}
	} catch (e) {
		if (config.shouldLogDebugInformation()) {
			console.info(
				'Something went wrong while looking for an installation of the bundled Intelephense version.'
			);
			console.error(e);
		}
	}

	sendNotification(
		createInfoNotice(
			'intelephense-will-be-installed',
			nova.localize('Intelephense must be updated or installed'),
			nova.localize(
				'A new version of Intelephense will now be installed.'
			)
		)
	);

	return new Promise((resolve, reject) => {
		// Install via npm.
		const installProcess = new Process('usr/bin/env', {
			args: ['npm', 'ci'],
			cwd: nova.extension.path,
		});

		installProcess.onDidExit((exitStatus) => {
			if (0 !== exitStatus) {
				sendNotification(
					createInfoNotice(
						'failed-to-install-intelephense',
						nova.localize(
							'Failed to update or install Intelephense'
						),
						nova.localize(
							'Something went wrong when trying to install the bundled version of the Intelephense language server.'
						)
					)
				);

				reject('Failed to install intelephense');
			}

			sendNotification(
				createInfoNotice(
					'intelephense-installed',
					nova.localize('Intelephense installed or updated'),
					nova.localize(
						'A new version of Intelephense has been successfully installed.'
					)
				)
			);
			resolve(true);
		});

		installProcess.start();
	});
};
