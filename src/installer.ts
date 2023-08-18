import * as config from './config';
import { createInfoNotice, sendNotification } from './notifications';

const getIntelephenseVersion = () => {
	return new Promise((resolve, reject) => {
		const getIntelephensePath = new Process('usr/bin/env', {
			args: ['npm', 'ls', 'intelephense', '--json'],
			cwd: nova.extension.path,
		});

		let getPathCommandOutput = '';

		getIntelephensePath.onStdout((line) => {
			getPathCommandOutput += line;
		});

		getIntelephensePath.onDidExit((exitStatus) => {
			if (config.shouldLogDebugInformation()) {
				console.info('npm ls returned: ', getPathCommandOutput);
			}

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

			try {
				const intelephenseInfo = JSON.parse(getPathCommandOutput);
				const version =
					intelephenseInfo?.dependencies?.intelephense?.version;

				if (config.shouldLogDebugInformation()) {
					console.info(`found version: ${version}`);
				}

				if (version) {
					resolve(version);
				}

				reject('Intelephense not installed');
			} catch (e) {
				if (config.shouldLogDebugInformation()) {
					console.info(
						'Could not find intelephense installation:',
						e
					);
				}
				reject('Intelephense is not installed.');
			}
		});

		getIntelephensePath.start();
	});
};

const hasCorrectIntelephenseVersion = async () => {
	const installedVersion = await getIntelephenseVersion();
	return '1.9.5' === installedVersion;
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
