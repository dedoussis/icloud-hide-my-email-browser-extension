import axios, {
  AxiosRequestConfig,
  AxiosRequestHeaders,
  AxiosResponse,
} from 'axios';
import { v4 as uuidv4 } from 'uuid';
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
  dsInfo: {
    hsaVersion?: number;
  };
  headers: { [k: string]: string };
  hsaChallengeRequired?: boolean;
  hsaTrustedBrowser?: boolean;
};

export const EMPTY_SESSION_DATA = {
  headers: {},
  webservices: {},
  dsInfo: {},
};

export class ICloudClientSession {
  constructor(
    public data: ICloudClientSessionData = EMPTY_SESSION_DATA,
    private readonly dataSaver: (data: ICloudClientSessionData) => void = (
      data
    ) => {}
  ) {}

  async save(): Promise<void> {
    await this.dataSaver(this.data);
  }

  async cleanUp(): Promise<void> {
    this.data = EMPTY_SESSION_DATA;
    await this.save();
  }
}

class ICloudClient {
  private static readonly DEFAULT_BASE_URL_CONFIG = {
    auth: 'https://idmsa.apple.com/appleauth/auth',
    home: 'https://www.icloud.com',
    setup: 'https://setup.icloud.com/setup/ws/1',
  };

  private static readonly ACCOUNT_COUNTRY_HEADER =
    'X-Apple-ID-Account-Country'.toLowerCase();
  private static readonly SESSION_ID_HEADER =
    'X-Apple-ID-Session-Id'.toLowerCase();
  private static readonly SESSION_TOKEN_HEADER =
    'X-Apple-Session-Token'.toLowerCase();
  private static readonly TWOSV_TRUST_TOKEN_HEADER =
    'X-Apple-TwoSV-Trust-Token'.toLowerCase();
  private static readonly SCNT_HEADER = 'scnt'.toLowerCase();

  private static readonly SESSION_HEADERS = [
    this.ACCOUNT_COUNTRY_HEADER,
    this.SESSION_ID_HEADER,
    this.SESSION_TOKEN_HEADER,
    this.TWOSV_TRUST_TOKEN_HEADER,
    this.SCNT_HEADER,
  ];

  private readonly clientId: string;
  public readonly requester;
  private readonly nonPersistingRequester;

  constructor(
    private readonly session: ICloudClientSession = new ICloudClientSession(),
    private readonly axiosConfig?: AxiosRequestConfig,
    readonly baseUrls: BaseUrlConfig = ICloudClient.DEFAULT_BASE_URL_CONFIG
  ) {
    this.clientId = uuidv4();

    this.requester = axios.create(this.axiosConfig);
    this.nonPersistingRequester = axios.create(this.axiosConfig);

    [this.requester, this.nonPersistingRequester].forEach((instance) =>
      instance.interceptors.request.use(
        this.prepareRequest.bind(this),
        (error) => Promise.reject(error),
        { synchronous: true }
      )
    );

    this.requester.interceptors.response.use(
      this.handleResponse.bind(this),
      (error) => Promise.reject(error),
      { synchronous: true }
    );
  }

  private prepareRequest(config: AxiosRequestConfig) {
    ICloudClient.SESSION_HEADERS.forEach((headerKey: string) => {
      const sessionVal = this.session.data.headers[headerKey];
      if (sessionVal !== undefined) {
        (config.headers as AxiosRequestHeaders)[headerKey] = sessionVal;
      }
    });
    return config;
  }

  private async handleResponse<T, D>(
    response: AxiosResponse<T, D>
  ): Promise<AxiosResponse<T, D>> {
    ICloudClient.SESSION_HEADERS.forEach((headerKey: string) => {
      const headerVal = response.headers[headerKey];
      if (headerVal !== undefined) {
        this.session.data.headers[headerKey] = headerVal;
      }
    });

    await this.session.save();

    return response;
  }

  private authHeaders(overrides?: { [k: string]: string }): {
    [k: string]: string;
  } {
    return {
      Accept: '*/*',
      'Content-Type': 'application/json',
      'X-Apple-OAuth-Client-Id':
        'd39ba9916b7251055b22c7f910e2ea796ee65e98b2ddecea8f5dde8d9d1a815d',
      'X-Apple-OAuth-Client-Type': 'firstPartyAuth',
      'X-Apple-OAuth-Redirect-URI': this.baseUrls.home,
      'X-Apple-OAuth-Require-Grant-Code': 'true',
      'X-Apple-OAuth-Response-Mode': 'web_message',
      'X-Apple-OAuth-Response-Type': 'code',
      'X-Apple-OAuth-State': this.clientId,
      'X-Apple-Widget-Key':
        'd39ba9916b7251055b22c7f910e2ea796ee65e98b2ddecea8f5dde8d9d1a815d',
      ...(overrides || {}),
    };
  }

  public get authenticated(): boolean {
    return (
      !isEqual(this.session.data.webservices, {}) &&
      !isEqual(this.session.data.dsInfo, {}) &&
      ICloudClient.SESSION_HEADERS.every(
        (header) => header in this.session.data.headers
      ) &&
      !this.requires2fa
    );
  }

  public get requires2fa(): boolean {
    return (
      this.session.data.dsInfo.hsaVersion === 2 &&
      (this.session.data.hsaChallengeRequired === true ||
        !this.isTrustedSession)
    );
  }

  public get isTrustedSession(): boolean {
    return this.session.data.hsaTrustedBrowser === true;
  }

  webserviceUrl(serviceName: string): string {
    return this.session.data.webservices[serviceName].url;
  }

  async validateToken(): Promise<void> {
    await this.nonPersistingRequester.post(`${this.baseUrls.setup}/validate`);
  }

  async signIn(
    appleId: string,
    password: string,
    rememberMe: boolean = true
  ): Promise<void> {
    await this.requester.post(
      `${this.baseUrls.auth}/signin`,
      {
        accountName: appleId,
        password,
        rememberMe,
        trustTokens: [],
      },
      { headers: this.authHeaders() }
    );
  }

  async accountLogin(): Promise<void> {
    const response = await this.requester.post(
      `${this.baseUrls.setup}/accountLogin`,
      {
        accountCountryCode:
          this.session.data.headers[ICloudClient.ACCOUNT_COUNTRY_HEADER],
        dsWebAuthToken:
          this.session.data.headers[ICloudClient.SESSION_TOKEN_HEADER],
        extended_login: true,
        trustToken:
          this.session.data.headers[ICloudClient.TWOSV_TRUST_TOKEN_HEADER],
      },
      { headers: this.authHeaders() }
    );

    this.session.data.webservices = response.data.webservices;
    this.session.data.hsaChallengeRequired = response.data.hsaChallengeRequired;
    this.session.data.hsaTrustedBrowser = response.data.hsaTrustedBrowser;
    this.session.data.dsInfo.hsaVersion = response.data.dsInfo.hsaVersion;
    await this.session.save();
  }

  async verify2faCode(code: string): Promise<void> {
    await this.requester.post(
      `${this.baseUrls.auth}/verify/trusteddevice/securitycode`,
      {
        securityCode: { code },
      },
      { headers: this.authHeaders({ Accept: 'application/json' }) }
    );
  }

  async trustDevice(): Promise<void> {
    await this.requester.get(`${this.baseUrls.auth}/2sv/trust`, {
      headers: this.authHeaders(),
    });
  }

  async logOut(trust: boolean = false): Promise<void> {
    if (this.authenticated) {
      try {
        await this.requester.post(`${this.baseUrls.setup}/logout`, {
          trustBrowsers: trust,
          allBrowsers: trust,
        });
      } catch {}
    }

    await this.session.cleanUp();
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
  constructor(readonly client: ICloudClient) {
    if (!client.authenticated) {
      throw new ClientAuthenticationError(
        'Client is not authenticated. A sing-in is required.'
      );
    }
    this.baseUrl = `${client.webserviceUrl('premiummailsettings')}/v1`;
  }

  async listHme(): Promise<ListHmeResult> {
    const response = await this.client.requester.get(
      `${this.baseUrl}/hme/list`
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
