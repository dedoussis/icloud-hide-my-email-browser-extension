export class UnsuccessfulRequestError extends Error {}

type ServiceName = 'premiummailsettings';

class ICloudClient {
  public webservices?: Record<ServiceName, { url: string; status: string }>;

  constructor(webservices?: ICloudClient['webservices']) {
    this.webservices = webservices;
  }

  static get setupUrl() {
    return 'https://setup.icloud.com/setup/ws/1';
  }

  public async request(
    method: 'GET' | 'POST',
    url: string,
    options: {
      headers?: Record<string, string>;
      data?: Record<string, unknown>;
    } = {}
  ): Promise<unknown> {
    const { headers = {}, data = undefined } = options;

    const response = await fetch(url, {
      method,
      headers,
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new UnsuccessfulRequestError(
        `Request to ${method} ${url} failed with status code ${response.status}`
      );
    }

    return await response.json();
  }

  public webserviceUrl(serviceName: ServiceName): string {
    if (this.webservices === undefined) {
      throw new Error('webservices have not been initialised');
    }
    return this.webservices[serviceName].url;
  }

  public async isAuthenticated(): Promise<boolean> {
    try {
      await this.validateToken();
      return true;
    } catch {
      return false;
    }
  }

  public async validateToken(): Promise<void> {
    const { webservices } = (await this.request(
      'POST',
      `${ICloudClient.setupUrl}/validate`
    )) as {
      webservices: ICloudClient['webservices'];
    };

    if (webservices) {
      this.webservices = webservices;
    }
  }

  public async signOut(
    options: { trust: boolean } = { trust: false }
  ): Promise<void> {
    const { trust } = options;
    await this.request('POST', `${ICloudClient.setupUrl}/logout`, {
      data: {
        trustBrowsers: trust,
        allBrowsers: trust,
      },
    }).catch(console.debug);
  }
}

export type HmeEmail = {
  origin: 'ON_DEMAND' | 'SAFARI';
  anonymousId: string;
  domain: string;
  forwardToEmail: string;
  hme: string;
  isActive: boolean;
  label: string;
  note: string;
  createTimestamp: number;
  recipientMailId: string;
};

export type ListHmeResult = {
  hmeEmails: HmeEmail[];
  selectedForwardTo: string;
  forwardToEmails: string[];
};

type PremiumMailSettingsResponse<T = unknown> = {
  success: boolean;
  result: T;
  error?: {
    errorMessage: string;
  };
};

export class GenerateHmeException extends Error {}
export class ReserveHmeException extends Error {}
export class UpdateHmeMetadataException extends Error {}
export class DeactivateHmeException extends Error {}
export class ReactivateHmeException extends Error {}
export class DeleteHmeException extends Error {}
export class UpdateFwdToHmeException extends Error {}

export class PremiumMailSettings {
  private readonly baseUrl: string;
  private readonly v2BaseUrl: string;
  constructor(readonly client: ICloudClient) {
    this.baseUrl = `${client.webserviceUrl('premiummailsettings')}/v1`;
    this.v2BaseUrl = `${client.webserviceUrl('premiummailsettings')}/v2`;
  }

  async listHme(): Promise<ListHmeResult> {
    const { result } = (await this.client.request(
      'GET',
      `${this.v2BaseUrl}/hme/list`
    )) as PremiumMailSettingsResponse<ListHmeResult>;
    return result;
  }

  async generateHme(): Promise<string> {
    const response = (await this.client.request(
      'POST',
      `${this.baseUrl}/hme/generate`
    )) as PremiumMailSettingsResponse<{ hme: string }>;

    if (!response.success) {
      throw new GenerateHmeException(response.error?.errorMessage);
    }

    return response.result.hme;
  }

  async reserveHme(
    hme: string,
    label: string,
    note:
      | string
      | undefined = 'Generated through the iCloud Hide My Email browser extension'
  ): Promise<HmeEmail> {
    const response = (await this.client.request(
      'POST',
      `${this.baseUrl}/hme/reserve`,
      { data: { hme, label, note } }
    )) as PremiumMailSettingsResponse<{ hme: HmeEmail }>;

    if (!response.success) {
      throw new ReserveHmeException(response.error?.errorMessage);
    }

    return response.result.hme;
  }

  async updateHmeMetadata(
    anonymousId: string,
    label: string,
    note?: string
  ): Promise<void> {
    const response = (await this.client.request(
      'POST',
      `${this.baseUrl}/hme/updateMetaData`,
      { data: { anonymousId, label, note } }
    )) as PremiumMailSettingsResponse;

    if (!response.success) {
      throw new UpdateHmeMetadataException('Failed to update HME metadata');
    }
  }

  async deactivateHme(anonymousId: string): Promise<void> {
    const response = (await this.client.request(
      'POST',
      `${this.baseUrl}/hme/deactivate`,
      { data: { anonymousId } }
    )) as PremiumMailSettingsResponse;

    if (!response.success) {
      throw new DeactivateHmeException('Failed to deactivate HME');
    }
  }

  async reactivateHme(anonymousId: string): Promise<void> {
    const response = (await this.client.request(
      'POST',
      `${this.baseUrl}/hme/reactivate`,
      { data: { anonymousId } }
    )) as PremiumMailSettingsResponse;

    if (!response.success) {
      throw new ReactivateHmeException('Failed to reactivate HME');
    }
  }

  async deleteHme(anonymousId: string): Promise<void> {
    const response = (await this.client.request(
      'POST',
      `${this.baseUrl}/hme/delete`,
      { data: { anonymousId } }
    )) as PremiumMailSettingsResponse;

    if (!response.success) {
      throw new DeleteHmeException('Failed to delete HME');
    }
  }

  async updateForwardToHme(forwardToEmail: string): Promise<void> {
    const response = (await this.client.request(
      'POST',
      `${this.baseUrl}/hme/updateForwardTo`,
      { data: { forwardToEmail } }
    )) as PremiumMailSettingsResponse;

    if (!response.success) {
      throw new UpdateFwdToHmeException(
        'Failed to update the Forward To email.'
      );
    }
  }
}

export default ICloudClient;
