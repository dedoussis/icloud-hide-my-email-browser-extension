import browser from 'webextension-polyfill';
import ICloudClient from './iCloudClient';

export const setupBlockingWebRequestListeners = () => {
  browser.webRequest.onBeforeSendHeaders.addListener(
    ({ requestHeaders, documentUrl, originUrl, initiator }) => {
      const initiatedByTheExtension = [documentUrl, originUrl, initiator].some(
        (url) =>
          url?.includes(browser.runtime.id) ||
          url?.includes('moz-extension') ||
          false
      );
      // Do not modify headers if the request is not initiated by the extension
      if (!initiatedByTheExtension) {
        return { requestHeaders };
      }

      const modifiedHeaders =
        requestHeaders?.filter(
          (header) => !['referer', 'origin'].includes(header.name.toLowerCase())
        ) || [];

      modifiedHeaders.push({
        name: 'Referer',
        value: 'https://www.icloud.com/',
      });
      modifiedHeaders.push({
        name: 'Origin',
        value: 'https://www.icloud.com',
      });

      return { requestHeaders: modifiedHeaders };
    },
    {
      urls: [
        `${ICloudClient.DEFAULT_BASE_URL_CONFIG.auth}/*`,
        `${ICloudClient.DEFAULT_BASE_URL_CONFIG.setup}/*`,
        'https://*.icloud.com/v*/hme/*',
      ],
    },
    ['requestHeaders', 'blocking']
  );
};
