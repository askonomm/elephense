import { defaultStubs } from './defaults';
import { IntelephenseLanguageServer } from './language-server';
import { installOrUpdateIntelephense } from './installer';
import { createInfoNotice, sendNotification } from './notifications';
import { languageServerPathObserver, stubsObserver } from './observers';

let langserver: IntelephenseLanguageServer | null = null;

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

exports.activate = async function () {
	try {
		await installOrUpdateIntelephense();

		langserver = new IntelephenseLanguageServer();
		nova.subscriptions.add(langserver);

		langserver.start();
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

	// Make sure we start the language server last, since all events must be registered prior to
	// entering the constructor.

	// Observe the configuration setting for the server's location, and restart the server on change
	nova.config.observe(
		'intelephense.language-server-path',
		languageServerPathObserver,
		// TS throws an error here because of missing declaration in DefinitelyTyped.
		langserver
	);
	nova.workspace.config.observe(
		'intelephense.language-server-path',
		languageServerPathObserver,
		// TS throws an error here because of missing declaration in DefinitelyTyped.
		langserver
	);

	// Watch for changes in project-specific stubs.
	nova.workspace.config.onDidChange(
		'intelephense.workspace-stubs',
		stubsObserver
	);
};

exports.deactivate = function () {
	// Clean up state before the extension is deactivated
	if (langserver) {
		langserver.deactivate();
		langserver = null;
	}
};
