import { Message, MessageType } from '../../messages';
import { v4 as uuidv4 } from 'uuid';
import './index.css';
import '@fortawesome/fontawesome-svg-core';
import '@fortawesome/free-solid-svg-icons';

const emailInputElements = document.querySelectorAll<HTMLInputElement>(
  'input[type="email"], input[name="email"], input[id="email"]'
);

const LOADING_COPY = `Hide My Email — Loading...`;
const STYLE_CLASS_PREFIX = 'd1691f0f-b8f0-495e-9ffb-fe4e6f84b518';

const className = (shortName: string): string =>
  `${STYLE_CLASS_PREFIX}-${shortName}`;

const ELEMENT_ID_NAMESPACE = uuidv4();

type InputElementWithButton = {
  inputElement: HTMLInputElement;
  btnElement: HTMLButtonElement;
  inputOnFocusCallback: (ev: FocusEvent) => void;
  inputOnBlurCallback: (ev: FocusEvent) => void;
  btnOnMousedownCallback: (ev: MouseEvent) => void;
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

const makeInputElementWithButton = (
  inputElement: HTMLInputElement
): InputElementWithButton => {
  const btnElement = document.createElement('button');
  const btnElementId = `${ELEMENT_ID_NAMESPACE}-${uuidv4()}`;
  btnElement.setAttribute('id', btnElementId);
  btnElement.setAttribute('type', 'button');
  btnElement.classList.add(className('button'));

  disableButton(btnElement, 'cursor-not-allowed', LOADING_COPY);

  const inputOnFocusCallback = async (ev: FocusEvent) => {
    disableButton(btnElement, 'cursor-progress', LOADING_COPY);
    inputElement.parentNode?.insertBefore(btnElement, inputElement.nextSibling);

    await chrome.runtime.sendMessage({
      type: MessageType.GenerateRequest,
      data: btnElementId,
    });
  };

  inputElement.addEventListener('focus', inputOnFocusCallback);

  const inputOnBlurCallback = (ev: FocusEvent) => {
    disableButton(btnElement, 'cursor-not-allowed', LOADING_COPY);
    btnElement.remove();
  };

  inputElement.addEventListener('blur', inputOnBlurCallback);

  const btnOnMousedownCallback = async (ev: MouseEvent) => {
    ev.preventDefault();
    const hme = btnElement.innerHTML;
    disableButton(btnElement, 'cursor-progress', LOADING_COPY);
    await chrome.runtime.sendMessage({
      type: MessageType.ReservationRequest,
      data: { hme, label: window.location.host, elementId: btnElement.id },
    });
  };

  btnElement.addEventListener('mousedown', btnOnMousedownCallback);

  return {
    inputElement,
    btnElement,
    inputOnFocusCallback,
    inputOnBlurCallback,
    btnOnMousedownCallback,
  };
};

const emaiInputElementsWithButtons = Array.from(emailInputElements).map(
  makeInputElementWithButton
);

const mutationCallback: MutationCallback = (mutations) => {
  mutations.forEach((mutation) => {
    const addedDfsStack = Array.from(mutation.addedNodes);

    while (addedDfsStack.length > 0) {
      const node = addedDfsStack.pop();
      if (
        node instanceof HTMLInputElement &&
        [node.name, node.type, node.id].includes('email')
      ) {
        const inputEmailWithButton = makeInputElementWithButton(node);
        emaiInputElementsWithButtons.push(inputEmailWithButton);
      }
      node?.childNodes.forEach((child) => {
        addedDfsStack.push(child);
      });
    }

    const removedDfsStack = Array.from(mutation.removedNodes);

    while (removedDfsStack.length > 0) {
      const node = removedDfsStack.pop();
      if (node instanceof HTMLInputElement) {
        const foundNode = emaiInputElementsWithButtons.find(
          (value) => value.inputElement.id === node.id
        );
        if (foundNode !== undefined) {
          removeItem(emaiInputElementsWithButtons, foundNode);
        }
      }
      node?.childNodes.forEach((child) => {
        removedDfsStack.push(child);
      });
    }
  });
};

const observer = new MutationObserver(mutationCallback);
observer.observe(document.body, {
  childList: true,
  attributes: false,
  subtree: true,
});

chrome.runtime.onMessage.addListener(
  (message: Message<unknown>, sender, sendResponse) => {
    switch (message.type) {
      case MessageType.Autofill:
        emaiInputElementsWithButtons.forEach(
          ({
            inputElement,
            inputOnFocusCallback,
            inputOnBlurCallback,
            btnElement,
          }) => {
            inputElement.value = message.data as string;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.removeEventListener('focus', inputOnFocusCallback);
            inputElement.removeEventListener('blur', inputOnBlurCallback);
            btnElement.remove();
          }
        );
        break;
      case MessageType.GenerateResponse:
        {
          const { hme, elementId, error } = message.data as {
            hme?: string;
            elementId: string;
            error?: string;
          };
          const element = document.getElementById(
            elementId
          ) as HTMLButtonElement | null;
          if (element) {
            if (hme !== undefined) {
              enableButton(element, 'cursor-pointer', hme);
            } else if (error !== undefined) {
              disableButton(element, 'cursor-not-allowed', error);
            }
          }
        }
        break;
      case MessageType.ReservationResponse:
        {
          const { hme, error, elementId } = message.data as {
            hme?: string;
            error?: string;
            elementId: string;
          };

          if (hme !== undefined) {
            emaiInputElementsWithButtons.forEach(
              ({
                inputElement,
                inputOnFocusCallback,
                inputOnBlurCallback,
                btnElement,
              }) => {
                inputElement.value = hme;
                inputElement.dispatchEvent(
                  new Event('input', { bubbles: true })
                );
                inputElement.removeEventListener('focus', inputOnFocusCallback);
                inputElement.removeEventListener('blur', inputOnBlurCallback);
                btnElement.remove();
              }
            );
          } else if (error) {
            const btnElement = document.getElementById(
              elementId
            ) as HTMLButtonElement | null;
            if (btnElement) {
              disableButton(btnElement, 'cursor-not-allowed', error);
            }
          }
        }
        break;
      default:
        break;
    }
  }
);

function removeItem<T>(arr: Array<T>, value: T): Array<T> {
  const index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}
