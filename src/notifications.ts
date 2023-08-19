import * as config from './config';

export const createNotification = (
	id: string,
	title: string,
	body: string,
	notificationType: 'input' | 'secure-input' | null = null,
	textInputValue = '',
	textInputPlaceholder = '',
	actions: string[] = []
) => {
	const notification = new NotificationRequest(id);

	notification.title = title;
	notification.body = body;

	if (notificationType) {
		notification.type = notificationType;
	}

	if (textInputValue) {
		notification.textInputValue = textInputValue;
	}

	if (textInputPlaceholder) {
		notification.textInputPlaceholder = textInputPlaceholder;
	}

	if (actions) {
		notification.actions = actions;
	}

	if (config.shouldLogDebugInformation()) {
		console.info(
			`Created a notice with the following information:\ntitle: ${title}\nbody: ${body}\ntype: ${notificationType}\ntextInputValue: ${textInputValue}\ntextInputPlaceholder: ${textInputPlaceholder}\nactions: ${actions}`
		);
	}

	return notification;
};

export const createInfoNotice = (id: string, title: string, body: string) =>
	createNotification(id, title, body);

export const sendNotification = (notification: NotificationRequest) => {
	return nova.notifications.add(notification);
};
