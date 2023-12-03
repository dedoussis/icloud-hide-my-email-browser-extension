import axios, { AxiosRequestConfig, AxiosRequestHeaders } from 'axios';
import isEqual from 'lodash.isequal';

type BaseUrlConfig = {
  auth: string;
  home: string;
  setup: string;
};

export type ICloudClientSessionData = {
  webservices: {
    [k: string]: { url: string; status: string };
  };
  headers: { [k: string]: string };
};

export const EMPTY_SESSION_DATA = {
  headers: {},
  webservices: {},
  dsInfo: {},
};

export class ICloudClientSession {
  private static readonly ACCOUNT_COUNTRY_HEADER =
    'X-Apple-ID-Account-Country'.toLowerCase();
  private static readonly SESSION_ID_HEADER =
    'X-Apple-ID-Session-Id'.toLowerCase();
  private static readonly SESSION_TOKEN_HEADER =
    'X-Apple-Session-Token'.toLowerCase();
  private static readonly TWOSV_TRUST_TOKEN_HEADER =
    'X-Apple-TwoSV-Trust-Token'.toLowerCase();
  private static readonly SCNT_HEADER = 'scnt'.toLowerCase();

  public static readonly REQUIRED_HEADERS = [
    this.ACCOUNT_COUNTRY_HEADER,
    this.SESSION_ID_HEADER,
    this.SESSION_TOKEN_HEADER,
    this.SCNT_HEADER,
  ];

  private static readonly OPTIONAL_HEADERS = [this.TWOSV_TRUST_TOKEN_HEADER];

  public static readonly HEADERS = this.REQUIRED_HEADERS.concat(
    this.OPTIONAL_HEADERS
  );

  constructor(
    public data: ICloudClientSessionData = EMPTY_SESSION_DATA,
    private readonly persistCallback: (
      data: ICloudClientSessionData
    ) => void = async () => undefined
  ) {}

  async persist(): Promise<void> {
    await this.persistCallback(this.data);
  }

  async reset(): Promise<void> {
    this.data = EMPTY_SESSION_DATA;
    await this.persist();
  }

  public setHeaders(headers: Headers) {
    ICloudClientSession.HEADERS.forEach((headerKey: string) => {
      const headerVal = headers.get(headerKey);
      if (headerVal !== null) {
        this.data.headers[headerKey] = headerVal;
      }
    });
  }
}

export class ClientSessionIsMissingRequiredHeaders extends Error {}

class ICloudClient {
  public static readonly DEFAULT_BASE_URL_CONFIG = {
    auth: 'https://idmsa.apple.com/appleauth/auth',
    home: 'https://www.icloud.com',
    setup: 'https://setup.icloud.com/setup/ws/1',
  };

  public readonly requester;

  constructor(
    private readonly session: ICloudClientSession = new ICloudClientSession(),
    private readonly axiosConfig?: AxiosRequestConfig,
    readonly baseUrls: BaseUrlConfig = ICloudClient.DEFAULT_BASE_URL_CONFIG
  ) {
    this.requester = axios.create(this.axiosConfig);
    this.requester.interceptors.request.use(
      this.prepareRequest.bind(this),
      (error) => Promise.reject(error),
      { synchronous: true }
    );
  }

  private prepareRequest(config: AxiosRequestConfig) {
    ICloudClientSession.HEADERS.forEach((headerKey: string) => {
      const sessionVal = this.session.data.headers[headerKey];
      if (sessionVal !== undefined) {
        (config.headers as AxiosRequestHeaders)[headerKey] = sessionVal;
      }
    });
    return config;
  }

  public async populateAndPersistSessionHeaders(
    headers: Headers
  ): Promise<void> {
    this.session.setHeaders(headers);
    await this.session.persist();
  }

  public async resetSession(): Promise<void> {
    await this.session.reset();
  }

  public get authenticated(): boolean {
    return (
      !isEqual(this.session.data.webservices, {}) &&
      ICloudClientSession.REQUIRED_HEADERS.every(
        (header) => header in this.session.data.headers
      )
    );
  }

  public webserviceUrl(serviceName: string): string {
    return this.session.data.webservices[serviceName].url;
  }

  public async validateToken(
    populateAndPersistSessionWebservices = false
  ): Promise<void> {
    const sessionHasEveryRequiredHeader =
      ICloudClientSession.REQUIRED_HEADERS.every(
        (header) => header in this.session.data.headers
      );

    if (!sessionHasEveryRequiredHeader) {
      throw new ClientSessionIsMissingRequiredHeaders(
        'Session of the iCloud client is missing required headers'
      );
    }

    const {
      data: { webservices },
    } = await this.requester.post(`${this.baseUrls.setup}/validate`);

    if (populateAndPersistSessionWebservices && webservices) {
      this.session.data.webservices = webservices;
      await this.session.persist();
    }
  }

  public async signOut(trust = false): Promise<void> {
    if (this.authenticated) {
      await this.requester
        .post(`${this.baseUrls.setup}/logout`, {
          trustBrowsers: trust,
          allBrowsers: trust,
        })
        .catch(console.debug);
    }

    await this.resetSession();
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

export class ClientAuthenticationError extends Error {}

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
    if (!client.authenticated) {
      throw new ClientAuthenticationError(
        'Client is not authenticated. A sing-in is required.'
      );
    }
    this.baseUrl = `${client.webserviceUrl('premiummailsettings')}/v1`;
    this.v2BaseUrl = `${client.webserviceUrl('premiummailsettings')}/v2`;
  }

  async listHme(): Promise<ListHmeResult> {
    const response = await this.client.requester.get(
      `${this.v2BaseUrl}/hme/list`
    );
    return response.data.result;
  }

  async generateHme(): Promise<string> {
    const response = await this.client.requester.post(
      `${this.baseUrl}/hme/generate`
    );

    if (!response.data.success) {
      throw new GenerateHmeException(response.data.error.errorMessage);
    }

    return response.data.result.hme;
  }

  async reserveHme(
    hme: string,
    label: string,
    note:
      | string
      | undefined = 'Generated through the iCloud Hide My Email browser extension'
  ): Promise<HmeEmail> {
    const response = await this.client.requester.post(
      `${this.baseUrl}/hme/reserve`,
      {
        hme,
        label,
        note,
      }
    );

    if (!response.data.success) {
      throw new ReserveHmeException(response.data.error.errorMessage);
    }

    return response.data.result.hme;
  }

  async updateHmeMetadata(
    anonymousId: string,
    label: string,
    note?: string
  ): Promise<void> {
    const response = await this.client.requester.post(
      `${this.baseUrl}/hme/updateMetaData`,
      {
        anonymousId,
        label,
        note,
      }
    );

    if (!response.data.success) {
      throw new UpdateHmeMetadataException('Failed to update HME metadata');
    }
  }

  async deactivateHme(anonymousId: string): Promise<void> {
    const response = await this.client.requester.post(
      `${this.baseUrl}/hme/deactivate`,
      {
        anonymousId,
      }
    );

    if (!response.data.success) {
      throw new DeactivateHmeException('Failed to deactivate HME');
    }
  }

  async reactivateHme(anonymousId: string): Promise<void> {
    const response = await this.client.requester.post(
      `${this.baseUrl}/hme/reactivate`,
      {
        anonymousId,
      }
    );

    if (!response.data.success) {
      throw new ReactivateHmeException('Failed to reactivate HME');
    }
  }

  async deleteHme(anonymousId: string): Promise<void> {
    const response = await this.client.requester.post(
      `${this.baseUrl}/hme/delete`,
      {
        anonymousId,
      }
    );

    if (!response.data.success) {
      throw new DeleteHmeException('Failed to delete HME');
    }
  }

  async updateForwardToHme(forwardToEmail: string): Promise<void> {
    const response = await this.client.requester.post(
      `${this.baseUrl}/hme/updateForwardTo`,
      { forwardToEmail }
    );

    if (!response.data.success) {
      throw new UpdateFwdToHmeException(
        'Failed to update the Forward To email.'
      );
    }
  }
}

export default ICloudClient;
