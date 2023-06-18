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
import { OPTIONS_STORAGE_KEYS, getBrowserStorageValue } from '../../storage';
import { Options } from '../../options';

const EMAIL_INPUT_QUERY_STRING =
  'input[type="email"], input[name="email"], input[id="email"]';

const emailInputElements = document.querySelectorAll<HTMLInputElement>(
  EMAIL_INPUT_QUERY_STRING
);

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

function removeItem<T>(arr: Array<T>, value: T): Array<T> {
  const index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}

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
async function main(): Promise<void> {
  const options = await getBrowserStorageValue<Options>(OPTIONS_STORAGE_KEYS);

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
        addedElements.forEach((el) =>
          autofillableInputElements.push(makeAutofillableInputElement(el))
        );
      });

      mutation.removedNodes.forEach((node) => {
        if (!(node instanceof Element)) {
          return;
        }

        const removedElements = node.querySelectorAll<HTMLInputElement>(
          EMAIL_INPUT_QUERY_STRING
        );
        removedElements.forEach((el) => {
          const foundElement = autofillableInputElements.find((item) =>
            el.isEqualNode(item.inputElement)
          );
          if (foundElement) {
            removeItem(autofillableInputElements, foundElement);
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

  browser.runtime.onMessage.addListener((message: Message<unknown>) => {
    switch (message.type) {
      case MessageType.Autofill:
        autofillableInputElements.forEach(({ inputElement, buttonSupport }) => {
          inputElement.value = message.data as string;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));

          if (buttonSupport) {
            const { btnElement, inputOnFocusCallback, inputOnBlurCallback } =
              buttonSupport;
            inputElement.removeEventListener('focus', inputOnFocusCallback);
            inputElement.removeEventListener('blur', inputOnBlurCallback);
            btnElement.remove();
          }
        });
        break;
      case MessageType.GenerateResponse:
        {
          const { hme, elementId, error } =
            message.data as GenerationResponseData;

          const element = document.getElementById(elementId);

          if (!element || !(element instanceof HTMLButtonElement)) {
            return;
          }

          if (error) {
            return disableButton(element, 'cursor-not-allowed', error);
          }

          if (!hme) {
            return;
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
            return;
          }

          if (error) {
            return disableButton(btnElement, 'cursor-not-allowed', error);
          }

          if (!hme) {
            return;
          }

          const found = autofillableInputElements.find(
            (ael) => ael.buttonSupport?.btnElement.id === btnElement.id
          );
          if (!found) {
            return;
          }

          const { inputElement, buttonSupport } = found;
          inputElement.value = hme;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
          btnElement.remove();

          if (!buttonSupport) {
            return;
          }

          const { inputOnFocusCallback, inputOnBlurCallback } = buttonSupport;
          inputElement.removeEventListener('focus', inputOnFocusCallback);
          inputElement.removeEventListener('blur', inputOnBlurCallback);
        }
        break;
      case MessageType.ActiveInputElementWrite:
        {
          const { activeElement } = document;
          if (!activeElement || !(activeElement instanceof HTMLInputElement)) {
            return;
          }

          const { text } = message.data as ActiveInputElementWriteData;
          activeElement.value = text;
          activeElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
        break;
      default:
        break;
    }
  });
}

main();
