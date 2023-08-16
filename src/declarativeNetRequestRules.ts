const STATIC_RULESET_ID = 'icloud_com_simulation_headers';

const constructRules = (): chrome.declarativeNetRequest.Rule[] => [
  {
    id: 1,
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      requestHeaders: [
        {
          header: 'Origin',
          operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          value: 'https://www.icloud.com',
        },
        {
          header: 'Referer',
          operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          value: 'https://www.icloud.com/',
        },
      ],
    },
    condition: {
      urlFilter: '|https://*.apple.com/*',
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST],
      excludedInitiatorDomains: ['apple.com', 'icloud.com'],
    },
  },
  {
    id: 2,
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      requestHeaders: [
        {
          header: 'Origin',
          operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          value: 'https://www.icloud.com',
        },
        {
          header: 'Referer',
          operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          value: 'https://www.icloud.com/',
        },
      ],
    },
    condition: {
      urlFilter: '|https://*.icloud.com/*',
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST],
      excludedInitiatorDomains: ['apple.com', 'icloud.com'],
    },
  },
];

export { STATIC_RULESET_ID, constructRules };
