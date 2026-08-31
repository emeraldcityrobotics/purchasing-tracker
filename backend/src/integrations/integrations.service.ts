import {Injectable} from '@nestjs/common';
import {DatabaseService} from '../database/database.service';

@Injectable()
export class IntegrationsService {
  constructor(private readonly database: DatabaseService) {}
  async sendSlack(message: string, configuredWebhook?: string) {
    const webhook
      = configuredWebhook || this.database.setting('slack_webhook_url');
    if (!webhook)
      return {success: false, message: 'Slack webhook is not configured'};
    const response = await fetch(webhook, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({text: message})
    });
    return {
      success: response.ok,
      message: response.ok
        ? 'Notification sent'
        : `Slack returned ${response.status}`
    };
  }

  async sendDiscord(message: string, configuredWebhook?: string) {
    const webhook
      = configuredWebhook || this.database.setting('discord_webhook_url');
    if (!webhook)
      return {success: false, message: 'Discord webhook is not configured'};
    const response = await fetch(webhook, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      // Discord webhooks expect the message under "content", unlike Slack's "text".
      body: JSON.stringify({content: message})
    });
    return {
      success: response.ok,
      message: response.ok
        ? 'Notification sent'
        : `Discord returned ${response.status}`
    };
  }

  async exportToSheets(data: object) {
    const webhook = this.database.setting('google_apps_script_webhook');
    if (this.database.setting('google_sheets_enabled') !== 'true' || !webhook)
      return {
        success: false,
        message: 'Google Sheets export is disabled or not configured'
      };
    const response = await fetch(webhook, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(data)
    });
    return {
      success: response.ok || response.status === 302,
      message: response.ok
        ? 'Exported to Google Sheets'
        : `Export returned ${response.status}`
    };
  }
}
