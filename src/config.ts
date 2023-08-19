export const getConfiguredIntelephensePath = () => {
	return nova.config.get('intelephense.language-server-path', 'string');
};

export const getBundledIntelephensePath = () => {
	return nova.path.join(
		nova.extension.path,
		'node_modules',
		'intelephense',
		'lib',
		'intelephense.js'
	);
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
	nova.config.set('com.thorlaksson.intelephense.license-key', key);
};
export const getLicenseKey = () => {
	return nova.config.get(
		'com.thorlaksson.intelephense.license-key',
		'string'
	);
};
