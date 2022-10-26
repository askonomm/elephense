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
