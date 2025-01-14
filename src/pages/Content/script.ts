import { v4 as uuidv4 } from 'uuid';
import browser from 'webextension-polyfill';
import {
  ActiveInputElementWriteData,
  AutofillData,
  GenerationResponseData,
  Message,
  MessageType,
  ReservationRequestData,
  ReservationResponseData,
} from '../../messages';
import { getBrowserStorageValue, setBrowserStorageValue } from '../../storage';
import './index.css';

const EMAIL_INPUT_QUERY_STRING =
  'input[type="email"], input[name="email"], input[id="email"]';

const LOADING_COPY = 'Hide My Email — Loading...';

// A unique CSS class prefix is used to guarantee that the style injected
// by the extension does not interfere with the existing style of
// a web page.
const STYLE_CLASS_PREFIX = 'd1691f0f-b8f0-495e-9ffb-fe4e6f84b518';

const className = (shortName: string): string =>
  `${STYLE_CLASS_PREFIX}-${shortName}`;

type AutofillableInputElement = {
  inputElement: HTMLInputElement;
  buttonSupport?: {
    btnElement: HTMLButtonElement;
    inputOnFocusCallback: (ev: FocusEvent) => void;
    inputOnBlurCallback: (ev: FocusEvent) => void;
    btnOnMousedownCallback: (ev: MouseEvent) => void;
  };
};

const disableButton = (
  btn: HTMLButtonElement,
  cursorClass: string,
  copy: string
): void => {
  btn.innerHTML = copy;
  btn.setAttribute('disabled', 'true');
  btn.classList.remove(className('hover-button'));
  btn.classList.forEach((name) => {
    if (name.startsWith(className('cursor-'))) {
      btn.classList.remove(name);
    }
  });
  btn.classList.add(className(cursorClass));
};

const enableButton = (
  btn: HTMLButtonElement,
  cursorClass: string,
  copy: string
): void => {
  btn.innerHTML = copy;
  btn.removeAttribute('disabled');
  btn.classList.add(className('hover-button'));
  btn.classList.forEach((name) => {
    if (name.startsWith(className('cursor-'))) {
      btn.classList.remove(name);
    }
  });
  btn.classList.add(className(cursorClass));
};

const makeButtonSupport = (
  inputElement: HTMLInputElement
): AutofillableInputElement['buttonSupport'] => {
  const btnElement = document.createElement('button');
  const btnElementId = uuidv4();
  btnElement.setAttribute('id', btnElementId);
  btnElement.setAttribute('type', 'button');
  btnElement.classList.add(className('button'));

  disableButton(btnElement, 'cursor-not-allowed', LOADING_COPY);

  const inputOnFocusCallback = async () => {
    disableButton(btnElement, 'cursor-progress', LOADING_COPY);
    inputElement.parentNode?.insertBefore(btnElement, inputElement.nextSibling);

    await browser.runtime.sendMessage({
      type: MessageType.GenerateRequest,
      data: btnElementId,
    });
  };

  inputElement.addEventListener('focus', inputOnFocusCallback);

  const inputOnBlurCallback = () => {
    disableButton(btnElement, 'cursor-not-allowed', LOADING_COPY);
    btnElement.remove();
  };

  inputElement.addEventListener('blur', inputOnBlurCallback);

  const btnOnMousedownCallback = async (ev: MouseEvent) => {
    ev.preventDefault();
    const hme = btnElement.innerHTML;
    disableButton(btnElement, 'cursor-progress', LOADING_COPY);
    await browser.runtime.sendMessage({
      type: MessageType.ReservationRequest,
      data: {
        hme,
        label: window.location.host,
        elementId: btnElement.id,
        inputElementXPath: getXPath(inputElement),
      },
    } as Message<ReservationRequestData>);
  };

  btnElement.addEventListener('mousedown', btnOnMousedownCallback);

  return {
    btnElement,
    inputOnFocusCallback,
    inputOnBlurCallback,
    btnOnMousedownCallback,
  };
};

const removeButtonSupport = (
  inputElement: HTMLInputElement,
  buttonSupport: NonNullable<AutofillableInputElement['buttonSupport']>
): void => {
  const { btnElement, inputOnFocusCallback, inputOnBlurCallback } =
    buttonSupport;
  inputElement.removeEventListener('focus', inputOnFocusCallback);
  inputElement.removeEventListener('blur', inputOnBlurCallback);
  btnElement.remove();
};

const getXPath = (element: Element): string => {
  if (!element.parentNode) return '';

  const siblings = Array.from(element.parentNode.children);
  const index = siblings.indexOf(element) + 1;
  const tagName = element.tagName.toLowerCase();
  const path = `${getXPath(
    element.parentNode as Element
  )}/${tagName}[${index}]`;

  return path.replace(/^\/+/, '');
};

const getElementByXPath = (xpath: string): Element | null => {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as Element;
  } catch (e) {
    console.error('Error finding element by XPath:', e);
    return null;
  }
};

export default async function main(): Promise<void> {
  const emailInputElements = document.querySelectorAll<HTMLInputElement>(
    EMAIL_INPUT_QUERY_STRING
  );

  const options = await getBrowserStorageValue('iCloudHmeOptions');

  // Store the last right-clicked input element's XPath
  document.addEventListener('contextmenu', async (event) => {
    const target = event.target as Element;
    if (target instanceof HTMLInputElement) {
      // Generate a unique ID if the element doesn't have one
      if (!target.id) {
        target.id = `hme-input-${uuidv4()}`;
      }
      await setBrowserStorageValue(
        `hme_target_${browser.runtime.id}`,
        target.id as string
      );
    }
  });

  const makeAutofillableInputElement = (
    inputElement: HTMLInputElement
  ): AutofillableInputElement => ({
    inputElement,
    buttonSupport:
      options?.autofill.button === false
        ? undefined
        : makeButtonSupport(inputElement),
  });

  const autofillableInputElements = Array.from(emailInputElements).map(
    makeAutofillableInputElement
  );

  const mutationCallback: MutationCallback = (mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) {
          return;
        }

        const addedElements = node.querySelectorAll<HTMLInputElement>(
          EMAIL_INPUT_QUERY_STRING
        );
        addedElements.forEach((el) => {
          const elementExists = autofillableInputElements.some((item) =>
            el.isEqualNode(item.inputElement)
          );
          if (!elementExists) {
            autofillableInputElements.push(makeAutofillableInputElement(el));
          }
        });
      });

      mutation.removedNodes.forEach((node) => {
        if (!(node instanceof Element)) {
          return;
        }

        const removedElements = node.querySelectorAll<HTMLInputElement>(
          EMAIL_INPUT_QUERY_STRING
        );
        removedElements.forEach((el) => {
          const foundIndex = autofillableInputElements.findIndex((item) =>
            el.isEqualNode(item.inputElement)
          );
          if (foundIndex !== -1) {
            const [{ inputElement, buttonSupport }] =
              autofillableInputElements.splice(foundIndex, 1);

            buttonSupport && removeButtonSupport(inputElement, buttonSupport);
          }
        });
      });
    });
  };

  const observer = new MutationObserver(mutationCallback);
  observer.observe(document.body, {
    childList: true,
    attributes: false,
    subtree: true,
  });

  browser.runtime.onMessage.addListener((uncastedMessage: unknown) => {
    const message = uncastedMessage as Message<unknown>;

    switch (message.type) {
      case MessageType.ActiveInputElementWrite:
        {
          const {
            data: { text, copyToClipboard },
          } = message as Message<ActiveInputElementWriteData>;

          (async () => {
            let targetElement: HTMLInputElement | null = null;

            // Try to get the stored XPath
            const storageKey = `hme_xpath_${browser.runtime.id}`;
            const xpath = await getBrowserStorageValue(storageKey);

            if (xpath) {
              const element = getElementByXPath(xpath as string);
              if (element && element instanceof HTMLInputElement) {
                targetElement = element;
              }
              // Clear the stored XPath after using it
              await browser.storage.local.remove(storageKey);
            }

            if (!targetElement) {
              // Fallback to active element if no right-clicked element is found
              const { activeElement } = document;
              if (
                !activeElement ||
                !(activeElement instanceof HTMLInputElement)
              ) {
                return;
              }
              targetElement = activeElement;
            }

            targetElement.value = text;
            targetElement.dispatchEvent(new Event('input', { bubbles: true }));
            targetElement.dispatchEvent(new Event('change', { bubbles: true }));

            if (copyToClipboard) {
              await navigator.clipboard.writeText(text);
            }

            // Remove button if it exists
            const found = autofillableInputElements.find((ael) =>
              ael.inputElement.isEqualNode(targetElement)
            );
            found?.buttonSupport &&
              removeButtonSupport(targetElement, found.buttonSupport);
          })().catch(console.error);
        }
        break;
      case MessageType.Autofill:
        {
          const { data: text } = message.data as AutofillData;

          (async () => {
            // Get the stored target element ID
            const targetId = await getBrowserStorageValue(
              `hme_target_${browser.runtime.id}`
            );
            if (!targetId) return;

            const targetElement = document.getElementById(targetId);
            if (!targetElement || !(targetElement instanceof HTMLInputElement))
              return;

            targetElement.focus();

            targetElement.value = text;
            targetElement.dispatchEvent(new Event('input', { bubbles: true }));
            targetElement.dispatchEvent(new Event('change', { bubbles: true }));

            // Only copy to clipboard and remove button if this is a successful email generation
            if (text.includes('@privaterelay.appleid.com')) {
              // Copy to clipboard for convenience
              navigator.clipboard.writeText(text).catch(console.error);

              // Remove button if it exists
              const found = autofillableInputElements.find((ael) =>
                ael.inputElement.isEqualNode(targetElement)
              );
              found?.buttonSupport &&
                removeButtonSupport(targetElement, found.buttonSupport);
            }
          })().catch(console.error);
        }
        break;
      case MessageType.GenerateResponse:
        {
          const { hme, elementId, error } =
            message.data as GenerationResponseData;

          const element = document.getElementById(elementId);

          if (!element || !(element instanceof HTMLButtonElement)) {
            break;
          }

          if (error) {
            disableButton(element, 'cursor-not-allowed', error);
            break;
          }

          if (!hme) {
            break;
          }

          enableButton(element, 'cursor-pointer', hme);
        }
        break;
      case MessageType.ReservationResponse:
        {
          const { hme, error, elementId, inputElementXPath } =
            message.data as ReservationResponseData;

          const btnElement = document.getElementById(elementId);

          if (!btnElement || !(btnElement instanceof HTMLButtonElement)) {
            break;
          }

          if (error) {
            disableButton(btnElement, 'cursor-not-allowed', error);
            break;
          }

          if (!hme || !inputElementXPath) {
            break;
          }

          const inputElement = getElementByXPath(inputElementXPath);
          if (inputElement && inputElement instanceof HTMLInputElement) {
            inputElement.value = hme;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
          }

          const found = autofillableInputElements.find(
            (ael) => ael.buttonSupport?.btnElement.id === btnElement.id
          );
          if (!found) {
            break;
          }

          const { buttonSupport } = found;
          buttonSupport &&
            removeButtonSupport(found.inputElement, buttonSupport);
        }
        break;
      default:
        break;
    }

    return undefined;
  });
}
