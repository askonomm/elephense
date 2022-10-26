export const getConfiguredIntelephensePath = () => {
	return nova.config.get('intelephense.language-server-path', 'string');
};
