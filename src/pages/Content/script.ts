import {
  ActiveInputElementWriteData,
  GenerationResponseData,
  Message,
  MessageType,
  ReservationRequestData,
  ReservationResponseData,
} from '../../messages';
import { v4 as uuidv4 } from 'uuid';
import './index.css';
import browser from 'webextension-polyfill';
import { getBrowserStorageValue } from '../../storage';

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
      data: { hme, label: window.location.host, elementId: btnElement.id },
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

export default async function main(): Promise<void> {
  const emailInputElements = document.querySelectorAll<HTMLInputElement>(
    EMAIL_INPUT_QUERY_STRING
  );

  const options = await getBrowserStorageValue('iCloudHmeOptions');

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
      case MessageType.Autofill:
        autofillableInputElements.forEach(({ inputElement, buttonSupport }) => {
          inputElement.value = message.data as string;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
          buttonSupport && removeButtonSupport(inputElement, buttonSupport);
        });
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
          const { hme, error, elementId } =
            message.data as ReservationResponseData;

          const btnElement = document.getElementById(elementId);

          if (!btnElement || !(btnElement instanceof HTMLButtonElement)) {
            break;
          }

          if (error) {
            disableButton(btnElement, 'cursor-not-allowed', error);
            break;
          }

          if (!hme) {
            break;
          }

          const found = autofillableInputElements.find(
            (ael) => ael.buttonSupport?.btnElement.id === btnElement.id
          );
          if (!found) {
            break;
          }

          const { inputElement, buttonSupport } = found;
          inputElement.value = hme;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
          inputElement.dispatchEvent(new Event('change', { bubbles: true }));

          buttonSupport && removeButtonSupport(inputElement, buttonSupport);
        }
        break;
      case MessageType.ActiveInputElementWrite:
        {
          const { activeElement } = document;
          if (!activeElement || !(activeElement instanceof HTMLInputElement)) {
            break;
          }

          const {
            data: { text, copyToClipboard },
          } = message as Message<ActiveInputElementWriteData>;
          activeElement.value = text;
          activeElement.dispatchEvent(new Event('input', { bubbles: true }));
          activeElement.dispatchEvent(new Event('change', { bubbles: true }));
          copyToClipboard && navigator.clipboard.writeText(text);

          // Remove button if it exists. This should rarely happen as context menu
          // users are expected to have turned off button support.
          const found = autofillableInputElements.find((ael) =>
            ael.inputElement.isEqualNode(activeElement)
          );
          found?.buttonSupport &&
            removeButtonSupport(activeElement, found.buttonSupport);
        }
        break;
      default:
        break;
    }

    return undefined;
  });
}
