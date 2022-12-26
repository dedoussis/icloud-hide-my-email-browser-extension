import browser from 'webextension-polyfill';

export const setupWebRequestListeners = () => {
  browser.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      const modifiedHeaders =
        details.requestHeaders?.filter(
          (header) => !['referer', 'origin'].includes(header.name.toLowerCase())
        ) || [];
      modifiedHeaders?.push({
        name: 'Referer',
        value: 'https://www.icloud.com/',
      });
      modifiedHeaders?.push({
        name: 'Origin',
        value: 'https://www.icloud.com',
      });

      return { requestHeaders: modifiedHeaders };
    },
    {
      urls: [
        'https://idmsa.apple.com/appleauth/auth/*',
        'https://setup.icloud.com/setup/ws/1/*',
        'https://*.icloud.com/v1/hme/*',
      ],
    },
    ['requestHeaders', 'blocking']
  );
};
