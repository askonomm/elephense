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
			console.info(
				`Bundled Intelephense currently at version ${npmVersion}`
			);

			if (!npmVersion) {
				reject('Intelephense is not installed.');
			}
			resolve(npmVersion);
		});

		getIntelephensePath.onDidExit((exitStatus) => {
			if (0 !== exitStatus) {
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
			console.info(
				'Intelephense already installed and has the right version.'
			);
			return;
		}
		console.info('Bundled intelephense is out of date, updating...');
	} catch (e) {
		console.error('Intelephense not installed (probably third time?)');
		console.error(e);
	}

	return new Promise((resolve, reject) => {
		// Install via npm.
		const installProcess = new Process('usr/bin/env', {
			args: ['npm', 'ci'],
			cwd: nova.extension.path,
		});

		installProcess.onDidExit((exitStatus) => {
			if (0 !== exitStatus) {
				console.error('Failed to install Intelephense');
				reject('Failed to install intelephense');
			}
			console.info('Intelephense successfully installed');
			resolve(true);
		});

		installProcess.start();
	});
};
