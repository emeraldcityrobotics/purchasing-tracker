import {Injectable} from '@nestjs/common';
import {DatabaseService} from '../database/database.service';

export interface InvenTreeVendor {
  external_id: number;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
}

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

  async fetchInvenTreeVendors(): Promise<{
    success: boolean;
    vendors?: InvenTreeVendor[];
    message?: string;
  }> {
    const baseUrl = this.database.setting('inventree_url');
    const apiKey = this.database.setting('inventree_api_key');
    if (!baseUrl || !apiKey)
      return {
        success: false,
        message: 'InvenTree integration is not configured'
      };

    const vendors: InvenTreeVendor[] = [];
    let url: string | null
      = `${baseUrl.replace(/\/$/, '')}/api/company/?is_supplier=true`;
    while (url) {
      let response: Response;
      try {
        response = await fetch(url, {
          headers: {Authorization: `Token ${apiKey}`}
        });
      } catch {
        return {success: false, message: 'Unable to reach InvenTree'};
      }
      if (!response.ok)
        return {success: false, message: `InvenTree returned ${response.status}`};
      const body = await response.json();
      const results = Array.isArray(body) ? body : (body.results ?? []);
      for (const company of results)
        vendors.push({
          external_id: company.pk,
          name: company.name,
          contact_person: company.contact || null,
          email: company.email || null,
          phone: company.phone || null
        });
      url = Array.isArray(body) ? null : (body.next ?? null);
    }
    return {success: true, vendors};
  }

  async testInvenTreeConnection(
    url?: string,
    apiKey?: string
  ): Promise<{success: boolean; message: string}> {
    const baseUrl = url || this.database.setting('inventree_url');
    const key = apiKey || this.database.setting('inventree_api_key');
    if (!baseUrl || !key)
      return {
        success: false,
        message: 'InvenTree URL and API key are required'
      };
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/`, {
        headers: {Authorization: `Token ${key}`}
      });
      return response.ok
        ? {success: true, message: 'Connected to InvenTree successfully'}
        : {success: false, message: `InvenTree returned ${response.status}`};
    } catch {
      return {success: false, message: 'Unable to reach InvenTree'};
    }
  }
}
