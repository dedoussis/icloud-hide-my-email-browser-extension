import browser from 'webextension-polyfill';
import ICloudClient from './iCloudClient';

export const setupBlockingWebRequestListeners = () => {
  browser.webRequest.onBeforeSendHeaders.addListener(
    ({ requestHeaders, documentUrl, originUrl, initiator, url, }) => {
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

      const suffix = url.match(/icloud.com(\.\w+)/)?.[1] || '';

      modifiedHeaders.push({
        name: 'Referer',
        value: `https://www.icloud.com${suffix}/`,
      });
      modifiedHeaders.push({
        name: 'Origin',
        value: `https://www.icloud.com${suffix}`,
      });

      return { requestHeaders: modifiedHeaders };
    },
    {
      urls: [
        `${ICloudClient.setupUrl.default}/*`,
        `${ICloudClient.setupUrl.CN}/*`,
         'https://*.icloud.com/v*/hme/*',
         'https://*.icloud.com.cn/v*/hme/*',
      ],
    },
    ['requestHeaders', 'blocking']
  );
};
