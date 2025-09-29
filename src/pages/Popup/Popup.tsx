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
    <TitledComponent title="Hide My Email+" subtitle="Sign in to iCloud">
      <div className="space-y-6 text-slate-100">
        <div className="space-y-3 text-sm leading-relaxed text-slate-200/95">
          <p>
            To use this extension, sign in to your iCloud account on{' '}
            <Link href="https://icloud.com" aria-label="Go to iCloud.com">
              icloud.com
            </Link>
            . Complete the flow, including{' '}
            <span className="font-semibold text-white">
              two-factor authentication
            </span>{' '}
            and{' '}
            <span className="font-semibold text-white">Trust This Browser</span>
            .
          </p>
        </div>
        <div
          className="flex items-start gap-3 rounded-2xl border border-rainbow-blue/40 bg-rainbow-blue/10 px-4 py-3 text-sm text-slate-100"
          role="alert"
        >
          <FontAwesomeIcon
            icon={faInfoCircle}
            className="mt-1 text-rainbow-blue"
          />
          <div>
            <p className="font-semibold text-white">Pro tip</p>
            <p>
              Tick the{' '}
              <span className="font-semibold text-white">
                Keep me signed in
              </span>{' '}
              box so the extension stays connected.
            </p>
          </div>
        </div>
        {isFirefox && (
          <div
            className="flex items-start gap-3 rounded-2xl border border-rainbow-orange/50 bg-rainbow-orange/10 px-4 py-3 text-sm text-amber-100"
            role="alert"
          >
            <FontAwesomeIcon icon={faFirefoxBrowser} className="mt-1" />
            <div>
              If you use{' '}
              <Link
                href="https://support.mozilla.org/en-US/kb/containers"
                aria-label="Firefox Multi-Account Containers docs"
              >
                Firefox Containers
              </Link>
              , sign in to iCloud from a tab outside of any container.
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={userguideUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#34a853] via-success to-[#4285f4] px-5 py-3 text-sm font-semibold text-slate-900 shadow-[0_18px_35px_-18px_rgba(52,211,153,0.7)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_46px_-18px_rgba(37,211,174,0.75)] focus:outline-none focus:ring-2 focus:ring-emerald-200/70"
            aria-label="Help"
          >
            <FontAwesomeIcon icon={faQuestionCircle} />
            Help
          </a>
          <a
            href="https://icloud.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-200 via-rose-200 to-pink-300 px-5 py-3 text-sm font-semibold text-slate-900 shadow-[0_18px_35px_-18px_rgba(249,168,212,0.75)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_46px_-18px_rgba(249,168,212,0.85)] focus:outline-none focus:ring-2 focus:ring-amber-200/70"
            aria-label="Go to iCloud.com"
          >
            <FontAwesomeIcon icon={faExternalLink} />
            Open icloud.com
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
    'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_-16px_rgba(16,185,129,0.75)] transition hover:-translate-y-0.5 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/80 focus:ring-offset-2 focus:ring-offset-slate-950';

  return (
    <div
      className="space-y-3 rounded-2xl border border-rainbow-green/40 bg-rainbow-green/10 p-4 text-sm text-emerald-50"
      role="alert"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200/90">
        Reserved address
      </p>
      <p className="break-all text-base font-semibold text-white">
        {props.hme.hme}
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
  const { label, icon, className, ...rest } = props;
  const baseClassName =
    'inline-flex items-center gap-2 rounded-full bg-slate-800/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500/70 focus:ring-offset-2 focus:ring-offset-slate-950';
  const composedClassName = [baseClassName, className]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={composedClassName} {...rest}>
      <FontAwesomeIcon icon={icon} />
      {label}
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
      className="bg-transparent text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 focus:ring-rose-300/60"
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
    'w-full rounded-2xl border border-slate-800/70 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition focus:border-rainbow-purple focus:outline-none focus:ring-2 focus:ring-rainbow-purple/70';

  return (
    <TitledComponent hideHeader>
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="inline-flex items-center gap-3 rounded-full border border-rainbow-purple/50 bg-slate-900/70 px-5 py-2 text-lg font-semibold text-white shadow-inner shadow-rainbow-purple/20">
            <button
              className="rounded-full bg-rainbow-purple/20 px-2 py-2 text-rainbow-purple transition hover:bg-rainbow-purple/40 focus:outline-none focus:ring-2 focus:ring-rainbow-purple/70"
              onClick={onEmailRefreshClick}
              aria-label="Refresh email"
            >
              <FontAwesomeIcon
                className="align-middle"
                icon={faRefresh}
                spin={isEmailRefreshSubmitting}
              />
            </button>
            <span className="max-w-[260px] break-all text-left">
              {hmeEmail}
            </span>
          </div>
          {fwdToEmail !== undefined && (
            <p className="text-sm text-slate-300">
              Forwarding to: {fwdToEmail}
            </p>
          )}
          {hmeError && <ErrorMessage>{hmeError}</ErrorMessage>}
        </div>
        {hmeEmail && (
          <div className="space-y-4">
            <form
              className={`space-y-4 rounded-3xl border border-slate-800/70 bg-slate-950/50 p-4 shadow-inner shadow-slate-900/40 transition ${
                isReservationFormDisabled ? 'opacity-60' : ''
              }`}
              onSubmit={onUseSubmit}
            >
              <div className="space-y-2">
                <label
                  htmlFor="label"
                  className="block text-xs font-semibold uppercase tracking-[0.32em] text-slate-400"
                >
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
              <div className="space-y-2">
                <label
                  htmlFor="note"
                  className="block text-xs font-semibold uppercase tracking-[0.32em] text-slate-400"
                >
                  Note
                </label>
                <textarea
                  id="note"
                  rows={2}
                  className={reservationFormInputClassName}
                  placeholder="Add a short reminder (optional)"
                  value={note || ''}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={isReservationFormDisabled}
                ></textarea>
              </div>
              <LoadingButton
                loading={isUseSubmitting}
                disabled={isReservationFormDisabled}
              >
                Use this email
              </LoadingButton>
              {reserveError && <ErrorMessage>{reserveError}</ErrorMessage>}
            </form>
            {reservedHme && <ReservationResult hme={reservedHme} />}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 pt-4">
        <div>
          <FooterButton
            onClick={() => props.callback('MANAGE')}
            icon={faList}
            label="Manage emails"
            className="bg-slate-800/80 text-slate-200 hover:bg-slate-700"
          />
        </div>
        <div className="text-right">
          <SignOutButton {...props} />
        </div>
      </div>
      <div className="pt-4 text-xs text-slate-400">
        <p className="text-center">
          Made by <Link href="https://sachit.dev">Sachit Vithaldas</Link>.
        </p>
        <p className="text-center">
          Forked from{' '}
          <Link href="https://github.com/dedoussis/icloud-hide-my-email-browser-extension">
            icloud-hide-my-email-browser-extension
          </Link>{' '}
          by{' '}
          <Link href="https://twitter.com/dedoussis">Dimitrios Dedoussis</Link>.
        </p>
        <p className="text-center">
          The source code is available on{' '}
          <Link href="https://github.com/sachitv/icloud-hide-my-email-browser-extension">
            Github
          </Link>
          .
        </p>
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

  const buttonBaseClass =
    'inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950';
  const labelClassName =
    'text-xs font-semibold uppercase tracking-[0.3em] text-slate-400';
  const valueClassName =
    'mt-1 rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm font-medium text-slate-100 truncate';

  return (
    <div className="space-y-4 text-slate-100">
      <div>
        <p className={labelClassName}>Email</p>
        <p title={props.hme.hme} className={valueClassName}>
          {props.hme.isActive || (
            <FontAwesomeIcon
              title="Deactivated"
              icon={faBan}
              className="mr-2 text-rainbow-red"
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
        <p className={labelClassName}>Forward to</p>
        <p title={props.hme.forwardToEmail} className={valueClassName}>
          {props.hme.forwardToEmail}
        </p>
      </div>
      <div>
        <p className={labelClassName}>Created</p>
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
          className={`${buttonBaseClass} bg-slate-800 text-white hover:bg-slate-700 focus:ring-slate-500`}
          onClick={onCopyClick}
        >
          <FontAwesomeIcon icon={faClipboard} />
        </button>
        <button
          title="Autofill"
          className={`${buttonBaseClass} bg-emerald-500 text-white hover:bg-emerald-400 focus:ring-emerald-300`}
          onClick={onAutofillClick}
        >
          <FontAwesomeIcon icon={faCheck} />
        </button>
        <LoadingButton
          title={props.hme.isActive ? 'Deactivate' : 'Reactivate'}
          className={`${buttonBaseClass} ${
            props.hme.isActive
              ? 'bg-red-500 text-white hover:bg-red-400 focus:ring-red-300'
              : 'bg-indigo-500 text-white hover:bg-indigo-400 focus:ring-indigo-300'
          }`}
          onClick={onActivationClick}
          loading={isActivateSubmitting}
        >
          <FontAwesomeIcon icon={props.hme.isActive ? faBan : faRefresh} />
        </LoadingButton>
        {!props.hme.isActive && (
          <LoadingButton
            title="Delete"
            className={`${buttonBaseClass} col-span-3 bg-red-500 text-white hover:bg-red-400 focus:ring-red-300`}
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
      <div className="relative p-3 rounded-tl-3xl border-b border-slate-800/60 bg-slate-950">
        <div className="pointer-events-none absolute inset-y-0 flex items-center pl-3">
          <FontAwesomeIcon className="text-slate-500" icon={faSearch} />
        </div>
        <input
          type="search"
          className="w-full rounded-2xl border border-slate-700 bg-slate-900 py-2 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/60"
          placeholder="Search"
          aria-label="Search through your HideMyEmail+ aliases"
          onChange={(e) => {
            setSearchPrompt(e.target.value);
            setSelectedHmeIdx(0);
          }}
        />
      </div>
    );

    const btnBaseClassName =
      'w-full truncate border-b border-slate-800/50 bg-slate-950/40 px-3 py-3 text-left text-sm font-medium text-slate-200 transition focus:outline-none focus:ring-2 focus:ring-rainbow-purple/60';
    const btnClassName = `${btnBaseClassName} hover:bg-slate-900/80`;
    const selectedBtnClassName = `${btnBaseClassName} bg-gradient-to-r from-[rgba(139,92,246,0.4)] via-[rgba(79,70,229,0.4)] to-[rgba(66,133,244,0.4)] text-white shadow-[inset_0_0_0_1px_rgba(129,140,248,0.4)]`;

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
            <FontAwesomeIcon icon={faBan} className="text-rainbow-red mr-1" />
            {hme.label}
          </div>
        )}
      </button>
    ));

    const noSearchResult = (
      <div className="break-words p-4 text-center text-slate-500">
        No results for &quot;{searchPrompt}&quot;
      </div>
    );

    return (
      <div
        className="flex rounded-3xl border border-slate-800/80 bg-slate-950/50 shadow-inner shadow-slate-900/50"
        style={{ height: 450 }}
      >
        <div className="w-[30%] min-w-[220px] max-w-[30%] shrink-0 overflow-y-auto rounded-l-3xl bg-slate-950/70">
          <div className="sticky top-0 z-10">{searchBox}</div>
          {hmeEmails.length === 0 && searchPrompt ? noSearchResult : labelList}
        </div>
        <div className="basis-[70%] grow overflow-y-auto rounded-r-3xl border-l border-slate-800/60 bg-slate-950/30 p-4">
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
    <div className="text-center text-lg text-slate-500">
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
    <TitledComponent hideHeader>
      {resolveMainChildComponent()}
      <div className="grid grid-cols-2 pt-3">
        <div>
          <FooterButton
            onClick={() => props.callback('GENERATE')}
            icon={faPlus}
            label="Generate new email"
            className="bg-slate-800/80 text-slate-200 hover:bg-slate-700"
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
    <div className="flex items-start justify-center px-4 py-4 text-slate-100">
      <div className="w-full max-w-[960px]">
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
