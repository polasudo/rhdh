import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { Notification } from '@backstage/plugin-notifications-common';

/**
 * @public
 */
declare const notificationsModuleEmail: _backstage_backend_plugin_api.BackendFeature;

/**
 * @public
 */
interface NotificationTemplateRenderer {
    getSubject?(notification: Notification): Promise<string>;
    getText?(notification: Notification): Promise<string>;
    getHtml?(notification: Notification): Promise<string>;
}
/**
 * @public
 */
interface NotificationsEmailTemplateExtensionPoint {
    setTemplateRenderer(renderer: NotificationTemplateRenderer): void;
}
/**
 * @public
 */
declare const notificationsEmailTemplateExtensionPoint: _backstage_backend_plugin_api.ExtensionPoint<NotificationsEmailTemplateExtensionPoint>;

export { type NotificationTemplateRenderer, type NotificationsEmailTemplateExtensionPoint, notificationsModuleEmail as default, notificationsEmailTemplateExtensionPoint };
