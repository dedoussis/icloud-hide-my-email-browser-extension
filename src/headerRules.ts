import browser from 'webextension-polyfill';
import templates from './rules.json';

let ready: Promise<void> | undefined;

// The installation's origin is only known at runtime (including Firefox's UUID).
// No static rule is enabled: requests fail closed if registration fails.
export function ensureHeaderRules(): Promise<void> {
  if (!ready) {
    const initiator = new URL(browser.runtime.getURL('')).hostname;
    const rules = templates.map((rule) => ({
      ...rule,
      condition: { ...rule.condition, initiatorDomains: [initiator] },
    })) as browser.DeclarativeNetRequest.Rule[];

    ready = browser.declarativeNetRequest
      .updateDynamicRules({
        removeRuleIds: rules.map((rule) => rule.id),
        addRules: rules,
      })
      .catch((error) => {
        ready = undefined;
        throw error;
      });
  }
  return ready;
}
