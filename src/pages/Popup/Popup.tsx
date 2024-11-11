import React, {
  useState,
  Dispatch,
  useEffect,
  ButtonHTMLAttributes,
  DetailedHTMLProps,
  ReactNode,
  ReactElement,
} from 'react';
import ICloudClient, {
  PremiumMailSettings,
  HmeEmail,
} from '../../iCloudClient';
import './Popup.css';
import { useBrowserStorageState } from '../../hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRefresh,
  faClipboard,
  faCheck,
  faList,
  faSignOut,
  IconDefinition,
  faPlus,
  faTrashAlt,
  faBan,
  faSearch,
  faInfoCircle,
  faExternalLink,
  faQuestionCircle,
} from '@fortawesome/free-solid-svg-icons';
import { faFirefoxBrowser } from '@fortawesome/free-brands-svg-icons';
import { MessageType, sendMessageToTab } from '../../messages';
import {
  ErrorMessage,
  LoadingButton,
  Spinner,
  TitledComponent,
  Link,
} from '../../commonComponents';
import { setBrowserStorageValue, Store } from '../../storage';

import browser from 'webextension-polyfill';
import Fuse from 'fuse.js';
import isEqual from 'lodash.isequal';
import {
  PopupAction,
  PopupState,
  AuthenticatedAction,
  STATE_MACHINE_TRANSITIONS,
  AuthenticatedAndManagingAction,
} from './stateMachine';
import {
  CONTEXT_MENU_ITEM_ID,
  SIGNED_OUT_CTA_COPY,
} from '../Background/constants';
import { isFirefox } from '../../browserUtils';

type TransitionCallback<T extends PopupAction> = (action: T) => void;

const SignInInstructions = () => {
  const userguideUrl = browser.runtime.getURL('userguide.html');

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
            className="w-full justify-center text-white bg-sky-400 hover:bg-sky-500 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg px-5 py-2.5 text-center mr-2 inline-flex items-center"
            aria-label="Help"
          >
            <FontAwesomeIcon icon={faQuestionCircle} className="mr-1" />
            Help
          </a>
          <a
            href="https://icloud.com"
            target="_blank"
            rel="noreferrer"
            className="w-full justify-center text-white bg-sky-400 hover:bg-sky-500 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg px-5 py-2.5 text-center mr-2 inline-flex items-center"
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
    'focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 block w-full';

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
    'appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:border-sky-400 focus:z-10 sm:text-sm';

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

const HmeDetails = (props: {
  hme: HmeEmail;
  client: ICloudClient;
  activationCallback: () => void;
  deletionCallback: () => void;
}) => {
  const [isActivateSubmitting, setIsActivateSubmitting] = useState(false);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);

  const [error, setError] = useState<string>();

  // Reset the error and the loaders when a new HME prop is passed to this component
  useEffect(() => {
    setError(undefined);
    setIsActivateSubmitting(false);
    setIsDeleteSubmitting(false);
  }, [props.hme]);

  const onActivationClick = async () => {
    setIsActivateSubmitting(true);
    try {
      const pms = new PremiumMailSettings(props.client);
      if (props.hme.isActive) {
        await pms.deactivateHme(props.hme.anonymousId);
      } else {
        await pms.reactivateHme(props.hme.anonymousId);
      }
      props.activationCallback();
    } catch (e) {
      setError(e.toString());
    } finally {
      setIsActivateSubmitting(false);
    }
  };

  const onDeletionClick = async () => {
    setIsDeleteSubmitting(true);
    try {
      const pms = new PremiumMailSettings(props.client);
      await pms.deleteHme(props.hme.anonymousId);
      props.deletionCallback();
    } catch (e) {
      setError(e.toString());
    } finally {
      setIsDeleteSubmitting(false);
    }
  };

  const onCopyClick = async () => {
    await navigator.clipboard.writeText(props.hme.hme);
  };

  const onAutofillClick = async () => {
    await sendMessageToTab(MessageType.Autofill, props.hme.hme);
  };

  const btnClassName =
    'w-full justify-center text-white focus:ring-4 focus:outline-none font-medium rounded-lg px-2 py-3 text-center inline-flex items-center';
  const labelClassName = 'font-bold';
  const valueClassName = 'text-gray-500 truncate';

  return (
    <div className="space-y-2">
      <div>
        <p className={labelClassName}>Email</p>
        <p title={props.hme.hme} className={valueClassName}>
          {props.hme.isActive || (
            <FontAwesomeIcon
              title="Deactivated"
              icon={faBan}
              className="text-red-500 mr-1"
            />
          )}
          {props.hme.hme}
        </p>
      </div>
      <div>
        <p className={labelClassName}>Label</p>
        <p title={props.hme.label} className={valueClassName}>
          {props.hme.label}
        </p>
      </div>
      <div>
        <p className={labelClassName}>Forward To</p>
        <p title={props.hme.forwardToEmail} className={valueClassName}>
          {props.hme.forwardToEmail}
        </p>
      </div>
      <div>
        <p className={labelClassName}>Created at</p>
        <p className={valueClassName}>
          {new Date(props.hme.createTimestamp).toLocaleString()}
        </p>
      </div>
      {props.hme.note && (
        <div>
          <p className={labelClassName}>Note</p>
          <p title={props.hme.note} className={valueClassName}>
            {props.hme.note}
          </p>
        </div>
      )}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <div className="grid grid-cols-3 gap-2">
        <button
          title="Copy"
          className={`${btnClassName} bg-sky-400 hover:bg-sky-500 focus:ring-blue-300`}
          onClick={onCopyClick}
        >
          <FontAwesomeIcon icon={faClipboard} />
        </button>
        <button
          title="Autofill"
          className={`${btnClassName} bg-sky-400 hover:bg-sky-500 focus:ring-blue-300`}
          onClick={onAutofillClick}
        >
          <FontAwesomeIcon icon={faCheck} />
        </button>
        <LoadingButton
          title={props.hme.isActive ? 'Deactivate' : 'Reactivate'}
          className={`${btnClassName} ${
            props.hme.isActive
              ? 'bg-red-500 hover:bg-red-600 focus:ring-red-300'
              : 'bg-sky-400 hover:bg-sky-500 focus:ring-blue-300'
          }`}
          onClick={onActivationClick}
          loading={isActivateSubmitting}
        >
          <FontAwesomeIcon icon={props.hme.isActive ? faBan : faRefresh} />
        </LoadingButton>
        {!props.hme.isActive && (
          <LoadingButton
            title="Delete"
            className={`${btnClassName} bg-red-500 hover:bg-red-600 focus:ring-red-300 col-span-3`}
            onClick={onDeletionClick}
            loading={isDeleteSubmitting}
          >
            <FontAwesomeIcon icon={faTrashAlt} className="mr-1" /> Delete
          </LoadingButton>
        )}
      </div>
    </div>
  );
};

const searchHmeEmails = (
  searchPrompt: string,
  hmeEmails: HmeEmail[]
): HmeEmail[] | undefined => {
  if (!searchPrompt) {
    return undefined;
  }

  const searchEngine = new Fuse(hmeEmails, {
    keys: ['label', 'hme'],
    threshold: 0.4,
  });
  const searchResults = searchEngine.search(searchPrompt);
  return searchResults.map((result) => result.item);
};

const HmeManager = (props: {
  callback: TransitionCallback<AuthenticatedAndManagingAction>;
  client: ICloudClient;
}) => {
  const [fetchedHmeEmails, setFetchedHmeEmails] = useState<HmeEmail[]>();
  const [hmeEmailsError, setHmeEmailsError] = useState<string>();
  const [isFetching, setIsFetching] = useState(true);
  const [selectedHmeIdx, setSelectedHmeIdx] = useState(0);
  const [searchPrompt, setSearchPrompt] = useState<string>();

  useEffect(() => {
    const fetchHmeList = async () => {
      setHmeEmailsError(undefined);
      setIsFetching(true);
      try {
        const pms = new PremiumMailSettings(props.client);
        const result = await pms.listHme();
        setFetchedHmeEmails(
          result.hmeEmails.sort((a, b) => b.createTimestamp - a.createTimestamp)
        );
      } catch (e) {
        setHmeEmailsError(e.toString());
      } finally {
        setIsFetching(false);
      }
    };

    fetchHmeList();
  }, [props.client]);

  const activationCallbackFactory = (hmeEmail: HmeEmail) => () => {
    const newHmeEmail = { ...hmeEmail, isActive: !hmeEmail.isActive };
    setFetchedHmeEmails((prevFetchedHmeEmails) =>
      prevFetchedHmeEmails?.map((item) =>
        isEqual(item, hmeEmail) ? newHmeEmail : item
      )
    );
  };

  const deletionCallbackFactory = (hmeEmail: HmeEmail) => () => {
    setFetchedHmeEmails((prevFetchedHmeEmails) =>
      prevFetchedHmeEmails?.filter((item) => !isEqual(item, hmeEmail))
    );
  };

  const hmeListGrid = (fetchedHmeEmails: HmeEmail[]) => {
    const hmeEmails =
      searchHmeEmails(searchPrompt || '', fetchedHmeEmails) || fetchedHmeEmails;

    if (selectedHmeIdx >= hmeEmails.length) {
      setSelectedHmeIdx(hmeEmails.length - 1);
    }

    const selectedHmeEmail = hmeEmails[selectedHmeIdx];

    const searchBox = (
      <div className="relative p-2 rounded-tl-md bg-gray-100">
        <div className="absolute inset-y-0 flex items-center pl-3 pointer-events-none">
          <FontAwesomeIcon className="text-gray-400" icon={faSearch} />
        </div>
        <input
          type="search"
          className="pl-9 p-2 w-full rounded placeholder-gray-400 border border-gray-200 focus:outline-none focus:border-sky-400"
          placeholder="Search"
          aria-label="Search through your HideMyEmail addresses"
          onChange={(e) => {
            setSearchPrompt(e.target.value);
            setSelectedHmeIdx(0);
          }}
        />
      </div>
    );

    const btnBaseClassName =
      'p-2 w-full text-left border-b last:border-b-0 cursor-pointer truncate focus:outline-sky-400';
    const btnClassName = `${btnBaseClassName} hover:bg-gray-100`;
    const selectedBtnClassName = `${btnBaseClassName} text-white bg-sky-400 font-medium`;

    const labelList = hmeEmails.map((hme, idx) => (
      <button
        key={idx}
        aria-current={selectedHmeIdx === idx}
        type="button"
        className={idx === selectedHmeIdx ? selectedBtnClassName : btnClassName}
        onClick={() => setSelectedHmeIdx(idx)}
      >
        {hme.isActive ? (
          hme.label
        ) : (
          <div title="Deactivated">
            <FontAwesomeIcon icon={faBan} className="text-red-500 mr-1" />
            {hme.label}
          </div>
        )}
      </button>
    ));

    const noSearchResult = (
      <div className="p-3 break-words text-center text-gray-400">
        No results for &quot;{searchPrompt}&quot;
      </div>
    );

    return (
      <div className="grid grid-cols-2" style={{ height: 398 }}>
        <div className="overflow-y-auto text-sm rounded-l-md border border-gray-200">
          <div className="sticky top-0 border-b">{searchBox}</div>
          {hmeEmails.length === 0 && searchPrompt ? noSearchResult : labelList}
        </div>
        <div className="overflow-y-auto p-2 rounded-r-md border border-l-0 border-gray-200">
          {selectedHmeEmail && (
            <HmeDetails
              client={props.client}
              hme={selectedHmeEmail}
              activationCallback={activationCallbackFactory(selectedHmeEmail)}
              deletionCallback={deletionCallbackFactory(selectedHmeEmail)}
            />
          )}
        </div>
      </div>
    );
  };

  const emptyState = (
    <div className="text-center text-lg text-gray-400">
      There are no emails to list
    </div>
  );

  const resolveMainChildComponent = (): ReactNode => {
    if (isFetching) {
      return <Spinner />;
    }

    if (hmeEmailsError) {
      return <ErrorMessage>{hmeEmailsError}</ErrorMessage>;
    }

    if (!fetchedHmeEmails || fetchedHmeEmails.length === 0) {
      return emptyState;
    }

    return hmeListGrid(fetchedHmeEmails);
  };

  return (
    <TitledComponent
      title="Hide My Email"
      subtitle="Manage your HideMyEmail addresses"
    >
      {resolveMainChildComponent()}
      <div className="grid grid-cols-2">
        <div>
          <FooterButton
            onClick={() => props.callback('GENERATE')}
            icon={faPlus}
            label="Generate new email"
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
      const callback = (action: AuthenticatedAndManagingAction) =>
        setState(STATE_MACHINE_TRANSITIONS[state][action]);
      return (
        <HmeManager callback={callback} client={constructClient(clientState)} />
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

    !isClientStateLoading && !clientAuthStateSynced && syncClientAuthState();
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
