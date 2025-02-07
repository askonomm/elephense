export const intelephensePath = (): Promise<string | null> => {
	return new Promise((resolve, reject) => {
		const getInstalledPath = new Process('usr/bin/env', {
			args: ['which', 'intelephense'],
			cwd: nova.extension.path,
		});

		getInstalledPath.onStdout((response) => {
			if (response.includes('not found')) {
				resolve(
					nova.config.get(
						'intelephense.language-server-path',
						'string'
					)
				);
			}

			resolve(response.trim());
		});

		getInstalledPath.onStderr(() => {
			resolve(
				nova.config.get('intelephense.language-server-path', 'string')
			);
		});

		getInstalledPath.start();
	});
};

export const shouldLogDebugInformation = () => {
	return (
		nova.config.get('intelephense.debug.debug-mode', 'boolean') ||
		nova.inDevMode()
	);
};

export const isEnabledForWorkspace = () => {
	return (
		nova.workspace.config.get(
			'intelephense.extension.enabled',
			'boolean'
		) ?? true
	);
};

export const setLicenseKey = (key: string) => {
	nova.config.set('ee.nmm.elephense.license-key', key);
};
export const getLicenseKey = () => {
	return nova.config.get('ee.nmm.elephense.license-key', 'string');
};
