import * as config from './config';
import { defaultStubs } from './defaults';
import { sendNotification, createInfoNotice } from './notifications';

import type { IntelephenseLanguageServer } from './language-server';

export function languageServerPathObserver(
	this: IntelephenseLanguageServer | undefined,
	path: string,
	_: string
) {
	if (!this) {
		return;
	}

	if (path && path !== this.clientPath) {
		console.info('Intelephense path updated');
		this.clientPath = path;
		this.restart();

		sendNotification(
			createInfoNotice(
				'new-intelephense-path',
				nova.localize('New Intelephense path detected'),
				nova.localize(
					'Intelephense has been restarted and is now using the newly provided path.'
				)
			)
		);
	} else if (
		!path &&
		config.getBundledIntelephensePath() !== this.clientPath
	) {
		this.clientPath = config.getBundledIntelephensePath();
		this.restart();

		sendNotification(
			createInfoNotice(
				'bundled-intelephense-path',
				nova.localize('New Intelephense path detected'),
				nova.localize(
					'Intelephense has been restarted and is now using the bundled version of the language server.'
				)
			)
		);
	}
}

export const stubsObserver = (
	newSettings: string[],
	_oldSettings: string[]
) => {
	const shouldReset = () => {
		if (newSettings.length !== defaultStubs.length) {
			return false;
		}

		newSettings.forEach((stub) => {
			if (!defaultStubs.includes(stub)) {
				return false;
			}
		});
		return true;
	};

	// If project stubs are set to the default value we instead use the global stubs.
	if (shouldReset()) {
		if (nova.inDevMode()) {
			console.log('Resetting workspace stubs');
		}
		const globalStubs = nova.config.get('intelephense.stubs');
		nova.workspace.config.set('intelephense.stubs', globalStubs);
	} else {
		if (nova.inDevMode()) {
			console.log('Updating workspace stubs');
		}
		nova.workspace.config.set('intelephense.stubs', newSettings);
	}
};

export function enabledForWorkspaceObserver(
	this: IntelephenseLanguageServer,
	isEnabled: boolean,
	_: boolean
) {
	console.info('is enabled for workspace:', isEnabled);

	// Do nothing if the languageserver doesn't exist.
	if (!this) {
		return;
	}

	if (isEnabled) {
		this.start();
	} else {
		this.dispose();
	}
}
