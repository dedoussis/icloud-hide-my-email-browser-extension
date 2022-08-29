import axios, {
  AxiosRequestConfig,
  AxiosRequestHeaders,
  AxiosResponse,
} from 'axios';
import { v4 as uuidv4 } from 'uuid';

type BaseUrlConfig = {
  auth: string;
  home: string;
  setup: string;
};

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
  private readonly session: { headers: { [k: string]: string } };
  private webservices: {
    [k: string]: { url: string; status: string };
  };

  constructor(
    readonly baseUrls: BaseUrlConfig = ICloudClient.DEFAULT_BASE_URL_CONFIG
  ) {
    this.clientId = uuidv4();
    this.session = { headers: {} };
    this.webservices = {};

    this.requester = axios.create();
    this.requester.interceptors.request.use(
      this.prepareRequest.bind(this),
      (error) => Promise.reject(error),
      { synchronous: true }
    );
    this.requester.interceptors.response.use(
      this.handleResponse.bind(this),
      (error) => Promise.reject(error),
      { synchronous: true }
    );
  }

  private prepareRequest(config: AxiosRequestConfig) {
    ICloudClient.SESSION_HEADERS.forEach((headerKey: string) => {
      const sessionVal = this.session.headers[headerKey];
      if (sessionVal !== undefined) {
        (config.headers as AxiosRequestHeaders)[headerKey] = sessionVal;
      }
    });
    return config;
  }

  private handleResponse(response: AxiosResponse) {
    ICloudClient.SESSION_HEADERS.forEach((headerKey: string) => {
      const headerVal = response.headers[headerKey];
      if (headerVal !== undefined) {
        this.session.headers[headerKey] = headerVal;
      }
    });
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

  webserviceUrl(serviceName: string): string {
    return this.webservices[serviceName].url;
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
        password: password,
        rememberMe: rememberMe,
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
          this.session.headers[ICloudClient.ACCOUNT_COUNTRY_HEADER],
        dsWebAuthToken: this.session.headers[ICloudClient.SESSION_TOKEN_HEADER],
        extended_login: true,
        trustToken: this.session.headers[ICloudClient.TWOSV_TRUST_TOKEN_HEADER],
      },
      { headers: this.authHeaders() }
    );

    this.webservices = response.data['webservices'];
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

export class PremiumMailSettings {
  private readonly baseUrl: string;
  constructor(readonly client: ICloudClient) {
    this.baseUrl = `${client.webserviceUrl('premiummailsettings')}/v1`;
  }

  async listHme(): Promise<HmeEmail[]> {
    const resposne = await this.client.requester.get(
      `${this.baseUrl}/hme/list`
    );
    return resposne.data.result.hmeEmails;
  }
}

export default ICloudClient;
