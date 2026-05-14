import React, {
  useState,
  Dispatch,
  useEffect,
  ButtonHTMLAttributes,
  DetailedHTMLProps,
  ReactElement,
} from 'react';
import ICloudClient, {
  PremiumMailSettings,
  HmeEmail,
} from '@/src/iCloudClient';
// Popup styles in style.css
import { useBrowserStorageState } from '@/src/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRefresh,
  faClipboard,
  faCheck,
  faList,
  faSignOut,
  IconDefinition,
  faInfoCircle,
  faExternalLink,
  faQuestionCircle,
} from '@fortawesome/free-solid-svg-icons';
import { faFirefoxBrowser } from '@fortawesome/free-brands-svg-icons';
import { MessageType, sendMessageToTab } from '@/src/messages';
import {
  ErrorMessage,
  LoadingButton,
  Spinner,
  TitledComponent,
  Link,
} from '@/src/commonComponents';
import { setBrowserStorageValue, Store } from '@/src/storage';


import {
  PopupAction,
  PopupState,
  AuthenticatedAction,
  STATE_MACHINE_TRANSITIONS,
} from './stateMachine';
import {
  CONTEXT_MENU_ITEM_ID,
  SIGNED_OUT_CTA_COPY,
} from '@/src/constants';
import { isFirefox } from '@/src/browserUtils';
import { HmeManager } from './HmeManager';
import { clearHmeCache } from '@/src/hmeCache';

type TransitionCallback<T extends PopupAction> = (action: T) => void;

const SignInInstructions = () => {
  const userguideUrl = browser.runtime.getURL('/userguide.html');

  return (
    <TitledComponent title="Hide My Email" subtitle="Sign in to iCloud">
      <div className="space-y-4">
        <div className="text-sm space-y-2">
          <p>
            To use this extension, sign in to your iCloud account on{' '}
            <Link
              href="https://icloud.com"
              className="font-semibold"
              aria-label="Go to iCloud.com"
            >
              icloud.com
            </Link>
            .
          </p>
          <p>
            Complete the full sign-in process, including{' '}
            <span className="font-semibold">two-factor authentication</span> and{' '}
            <span className="font-semibold">Trust This Browser</span>.
          </p>
        </div>
        <div
          className="flex p-3 text-sm border text-gray-600 rounded-lg bg-gray-50"
          role="alert"
        >
          <FontAwesomeIcon icon={faInfoCircle} className="mr-2 mt-1" />
          <span className="sr-only">Info</span>
          <div>
            <span className="font-semibold">Pro-tip:</span> Tick the{' '}
            <span className="font-semibold">Keep me signed in</span> box
          </div>
        </div>
        {isFirefox && (
          <div
            className="flex p-3 text-sm border text-gray-600 rounded-lg bg-gray-50"
            role="alert"
          >
            <FontAwesomeIcon icon={faFirefoxBrowser} className="mr-2 mt-1" />
            <span className="sr-only">Info</span>
            <div>
              If using{' '}
              <Link
                href="https://support.mozilla.org/en-US/kb/containers"
                className="font-semibold"
                aria-label="Firefox Multi-Account Containers docs"
              >
                Firefox Containers
              </Link>
              , sign in to iCloud from a tab outside of a container.
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={userguideUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full justify-center text-white bg-sky-400 hover:bg-sky-500 focus:ring-4 focus:outline-hidden focus:ring-blue-300 font-medium rounded-lg px-5 py-2.5 text-center mr-2 inline-flex items-center"
            aria-label="Help"
          >
            <FontAwesomeIcon icon={faQuestionCircle} className="mr-1" />
            Help
          </a>
          <a
            href="https://icloud.com"
            target="_blank"
            rel="noreferrer"
            className="w-full justify-center text-white bg-sky-400 hover:bg-sky-500 focus:ring-4 focus:outline-hidden focus:ring-blue-300 font-medium rounded-lg px-5 py-2.5 text-center mr-2 inline-flex items-center"
            aria-label="Go to iCloud.com"
          >
            <FontAwesomeIcon icon={faExternalLink} className="mr-1" /> Go to
            icloud.com
          </a>
        </div>
      </div>
    </TitledComponent>
  );
};

const ReservationResult = (props: { hme: HmeEmail }) => {
  const onCopyToClipboardClick = async () => {
    await navigator.clipboard.writeText(props.hme.hme);
  };

  const onAutofillClick = async () => {
    await sendMessageToTab(MessageType.Autofill, props.hme.hme);
  };

  const btnClassName =
    'focus:outline-hidden text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 block w-full';

  return (
    <div
      className="space-y-2 p-2 text-sm text-green-700 bg-green-100 rounded-lg"
      role="alert"
    >
      <p>
        <strong>{props.hme.hme}</strong> has successfully been reserved!
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={btnClassName}
          onClick={onCopyToClipboardClick}
        >
          <FontAwesomeIcon icon={faClipboard} className="mr-1" />
          Copy to clipboard
        </button>
        <button
          type="button"
          className={btnClassName}
          onClick={onAutofillClick}
        >
          <FontAwesomeIcon icon={faCheck} className="mr-1" />
          Autofill
        </button>
      </div>
    </div>
  );
};

const FooterButton = (
  props: { label: string; icon: IconDefinition } & DetailedHTMLProps<
    ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  >
) => {
  return (
    <button
      className="text-sky-400 hover:text-sky-500 focus:outline-sky-400"
      {...props}
    >
      <FontAwesomeIcon icon={props.icon} className="mr-1" />
      {props.label}
    </button>
  );
};

async function performDeauthSideEffects(): Promise<void> {
  await browser.contextMenus
    .update(CONTEXT_MENU_ITEM_ID, {
      title: SIGNED_OUT_CTA_COPY,
      enabled: false,
    })
    .catch(console.debug);
}

const SignOutButton = (props: {
  callback: TransitionCallback<'SIGN_OUT'>;
  client: ICloudClient;
}) => {
  return (
    <FooterButton
      className="text-sky-400 hover:text-sky-500 focus:outline-sky-400"
      onClick={async () => {
        await props.client.signOut();
        // TODO: call the react state setter instead
        setBrowserStorageValue('clientState', undefined);
        performDeauthSideEffects();
        props.callback('SIGN_OUT');
      }}
      label="Sign out"
      icon={faSignOut}
    />
  );
};

const HmeGenerator = (props: {
  callback: TransitionCallback<AuthenticatedAction>;
  client: ICloudClient;
}) => {
  const [hmeEmail, setHmeEmail] = useState<string>();
  const [hmeError, setHmeError] = useState<string>();

  const [reservedHme, setReservedHme] = useState<HmeEmail>();
  const [reserveError, setReserveError] = useState<string>();

  const [isEmailRefreshSubmitting, setIsEmailRefreshSubmitting] =
    useState(false);
  const [isUseSubmitting, setIsUseSubmitting] = useState(false);
  const [tabHost, setTabHost] = useState('');
  const [fwdToEmail, setFwdToEmail] = useState<string>();

  const [note, setNote] = useState<string>();
  const [label, setLabel] = useState<string>();

  useEffect(() => {
    const fetchHmeList = async () => {
      setHmeError(undefined);
      try {
        const pms = new PremiumMailSettings(props.client);
        const result = await pms.listHme();
        setFwdToEmail(result.selectedForwardTo);
      } catch (e) {
        setHmeError(e.toString());
      }
    };

    fetchHmeList();
  }, [props.client]);

  useEffect(() => {
    const fetchHmeEmail = async () => {
      setHmeError(undefined);
      setIsEmailRefreshSubmitting(true);
      try {
        const pms = new PremiumMailSettings(props.client);
        setHmeEmail(await pms.generateHme());
      } catch (e) {
        setHmeError(e.toString());
      } finally {
        setIsEmailRefreshSubmitting(false);
      }
    };

    fetchHmeEmail();
  }, [props.client]);

  useEffect(() => {
    const getTabHost = async () => {
      const [tab] = await browser.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      const tabUrl = tab?.url;
      if (tabUrl !== undefined) {
        const { hostname } = new URL(tabUrl);
        setTabHost(hostname);
        setLabel(hostname);
      }
    };

    getTabHost().catch(console.error);
  }, []);

  const onEmailRefreshClick = async () => {
    setIsEmailRefreshSubmitting(true);
    setReservedHme(undefined);
    setHmeError(undefined);
    setReserveError(undefined);
    try {
      const pms = new PremiumMailSettings(props.client);
      setHmeEmail(await pms.generateHme());
    } catch (e) {
      setHmeError(e.toString());
    }
    setIsEmailRefreshSubmitting(false);
  };

  const onUseSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsUseSubmitting(true);
    setReservedHme(undefined);
    setReserveError(undefined);

    if (hmeEmail !== undefined) {
      try {
        const pms = new PremiumMailSettings(props.client);
        setReservedHme(
          await pms.reserveHme(hmeEmail, label || tabHost, note || undefined)
        );
        setLabel(undefined);
        setNote(undefined);
      } catch (e) {
        setReserveError(e.toString());
      }
    }
    setIsUseSubmitting(false);
  };

  const isReservationFormDisabled =
    isEmailRefreshSubmitting || hmeEmail == reservedHme?.hme;

  const reservationFormInputClassName =
    'appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-hidden focus:border-sky-400 focus:z-10 sm:text-sm';

  return (
    <TitledComponent
      title="Hide My Email"
      subtitle={`Create an address for '${tabHost}'`}
    >
      <div className="text-center space-y-1">
        <div>
          <span className="text-2xl">
            <button className="mr-2" onClick={onEmailRefreshClick}>
              <FontAwesomeIcon
                className="text-sky-400 hover:text-sky-500 align-text-bottom"
                icon={faRefresh}
                spin={isEmailRefreshSubmitting}
              />
            </button>
            {hmeEmail}
          </span>
          {fwdToEmail !== undefined && (
            <p className="text-gray-400">Forward to: {fwdToEmail}</p>
          )}
        </div>
        {hmeError && <ErrorMessage>{hmeError}</ErrorMessage>}
      </div>
      {hmeEmail && (
        <div className="space-y-3">
          <form
            className={`space-y-3 ${
              isReservationFormDisabled ? 'opacity-70' : ''
            }`}
            onSubmit={onUseSubmit}
          >
            <div>
              <label htmlFor="label" className="block font-medium">
                Label
              </label>
              <input
                id="label"
                placeholder={tabHost}
                required
                value={label || ''}
                onChange={(e) => setLabel(e.target.value)}
                className={reservationFormInputClassName}
                disabled={isReservationFormDisabled}
              />
            </div>
            <div>
              <label htmlFor="note" className="block font-medium">
                Note
              </label>
              <textarea
                id="note"
                rows={1}
                className={reservationFormInputClassName}
                placeholder="Make a note (optional)"
                value={note || ''}
                onChange={(e) => setNote(e.target.value)}
                disabled={isReservationFormDisabled}
              ></textarea>
            </div>
            <LoadingButton
              loading={isUseSubmitting}
              disabled={isReservationFormDisabled}
            >
              Use
            </LoadingButton>
            {reserveError && <ErrorMessage>{reserveError}</ErrorMessage>}
          </form>
          {reservedHme && <ReservationResult hme={reservedHme} />}
        </div>
      )}
      <div className="grid grid-cols-2">
        <div>
          <FooterButton
            onClick={() => props.callback('MANAGE')}
            icon={faList}
            label="Manage emails"
          />
        </div>
        <div className="text-right">
          <SignOutButton {...props} />
        </div>
      </div>
    </TitledComponent>
  );
};


const constructClient = (clientState: Store['clientState']): ICloudClient => {
  if (clientState === undefined) {
    throw new Error('Cannot construct client when client state is undefined');
  }

  return new ICloudClient(clientState.setupUrl, clientState.webservices);
};

const transitionToNextStateElement = (
  state: PopupState,
  setState: Dispatch<PopupState>,
  clientState: Store['clientState']
): ReactElement => {
  switch (state) {
    case PopupState.SignedOut: {
      return <SignInInstructions />;
    }
    case PopupState.Authenticated: {
      const callback = (action: AuthenticatedAction) =>
        setState(STATE_MACHINE_TRANSITIONS[state][action]);
      return (
        <HmeGenerator
          callback={callback}
          client={constructClient(clientState)}
        />
      );
    }
    case PopupState.AuthenticatedAndManaging: {
      const client = constructClient(clientState);
      return (
        <HmeManager
          client={client}
          onGenerate={() =>
            setState(STATE_MACHINE_TRANSITIONS[state]['GENERATE'])
          }
          onSignOut={async () => {
            await client.signOut();
            setBrowserStorageValue('clientState', undefined);
            await clearHmeCache();
            performDeauthSideEffects();
            setState(STATE_MACHINE_TRANSITIONS[state]['SIGN_OUT']);
          }}
        />
      );
    }
    default: {
      const exhaustivenessCheck: never = state;
      throw new Error(`Unhandled PopupState case: ${exhaustivenessCheck}`);
    }
  }
};

const Popup = () => {
  const [state, setState, isStateLoading] = useBrowserStorageState(
    'popupState',
    PopupState.SignedOut
  );

  const [clientState, setClientState, isClientStateLoading] =
    useBrowserStorageState('clientState', undefined);
  const [clientAuthStateSynced, setClientAuthStateSynced] = useState(false);

  useEffect(() => {
    const syncClientAuthState = async () => {
      const isAuthenticated =
        clientState?.setupUrl !== undefined &&
        (await new ICloudClient(clientState.setupUrl).isAuthenticated());

      if (isAuthenticated) {
        setState((prevState) =>
          prevState === PopupState.SignedOut
            ? PopupState.Authenticated
            : prevState
        );
      } else {
        setState(PopupState.SignedOut);
        setClientState(undefined);
        performDeauthSideEffects();
      }

      setClientAuthStateSynced(true);
    };

    if (!isClientStateLoading && !clientAuthStateSynced) {
      syncClientAuthState();
    }
  }, [
    setState,
    setClientState,
    clientAuthStateSynced,
    clientState?.setupUrl,
    isClientStateLoading,
  ]);

  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {isStateLoading || !clientAuthStateSynced ? (
          <Spinner />
        ) : (
          transitionToNextStateElement(state, setState, clientState)
        )}
      </div>
    </div>
  );
};

export default Popup;
