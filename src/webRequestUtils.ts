import browser from 'webextension-polyfill';
import { DEFAULT_SETUP_URL, CN_SETUP_URL } from './iCloudClient';

export const setupBlockingWebRequestListeners = () => {
  browser.webRequest.onBeforeSendHeaders.addListener(
    ({ requestHeaders, originUrl, initiator, url }) => {
      const initiatedByTheExtension = [originUrl, initiator].some(
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

      const originComponents = new URL(url).origin.split('.');
      const pivot = originComponents.indexOf('icloud');
      const tld = originComponents.slice(pivot + 1).join('.');

      modifiedHeaders.push({
        name: 'Referer',
        value: `https://www.icloud.${tld}/`,
      });
      modifiedHeaders.push({
        name: 'Origin',
        value: `https://www.icloud.${tld}`,
      });

      return { requestHeaders: modifiedHeaders };
    },
    {
      urls: [
        `${DEFAULT_SETUP_URL}/*`,
        `${CN_SETUP_URL}/*`,
        'https://*.icloud.com/v*/hme/*',
        'https://*.icloud.com.cn/v*/hme/*',
      ],
    },
    ['requestHeaders', 'blocking']
  );
};
