import React, { useState, Dispatch, useEffect } from 'react';
import ICloudClient, {
  PremiumMailSettings,
  HmeEmail,
  ICloudClientSessionData,
  ICloudClientSession,
} from '../../iCloudClient';
import './Popup.css';
import AuthCode from 'react-auth-code-input';
import { useChromeStorageState } from '../../hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRefresh,
  faClipboard,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';

enum PopupTransition {
  SuccessfulSignIn,
  FailedSignIn,
  SuccessfulVerification,
  FailedVerification,
  SuccessfulSignOut,
  FailedSignOut,
}

const LoadingButton = (
  props: {
    children?: React.ReactNode;
    isSubmitting: boolean;
  } & React.HTMLProps<HTMLButtonElement>
) => {
  const defaultClassName =
    'group relative w-full flex justify-center py-2 px-4 border border-transparent rounded-md text-white bg-sky-400 hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500';
  return (
    <button
      className={props.className || defaultClassName}
      onClick={props.onClick}
      type="submit"
      disabled={props.isSubmitting}
    >
      {props.isSubmitting ? (
        <svg
          className="animate-spin -ml-1 h-5 w-5 text-gray"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-0"
            cx="12"
            cy="12"
            r="10"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        props.children
      )}
    </button>
  );
};

type Callback = (transition: PopupTransition) => void;

const SignInForm = (props: { callback: Callback; client: ICloudClient }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    await props.client.signIn(email, password);
    await props.client.accountLogin();

    props.callback(PopupTransition.SuccessfulSignIn);
  };

  return (
    <div>
      <div>
        <img
          className="mx-auto h-24 w-auto"
          src="https://www.freeiconspng.com/uploads/icloud-icon-4.png"
          alt="Icons Download Png Icloud"
        />
        <h2 className="mt-6 text-center text-3xl tracking-tight font-bold text-gray-900">
          Sign in to iCloud
        </h2>
      </div>
      <form
        className="mt-8 space-y-6"
        action="#"
        method="POST"
        onSubmit={onFormSubmit}
      >
        <div className="rounded-md shadow-sm -space-y-px">
          <div>
            <label htmlFor="email-address" className="sr-only">
              Email address
            </label>
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-sky-500 focus:border-sky-500 focus:z-10 sm:text-sm"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-sky-500 focus:border-sky-500 focus:z-10 sm:text-sm"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="text-sm">
          <a
            href="https://iforgot.apple.com/password/verify/appleid"
            className="font-medium text-sky-400 hover:text-sky-500"
          >
            Forgot your password?
          </a>
        </div>

        <div>
          <LoadingButton isSubmitting>Sign In</LoadingButton>
        </div>
      </form>
    </div>
  );
};

const TwoFaForm = (props: { callback: Callback; client: ICloudClient }) => {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    await props.client.verify2faCode(code);
    await props.client.trustDevice();
    await props.client.accountLogin();

    props.callback(PopupTransition.SuccessfulVerification);
  };

  return (
    <div>
      <h2 className="mt-6 text-center text-3xl tracking-tight font-bold text-gray-900">
        Enter the 2FA code
      </h2>
      <form
        className="mt-8 space-y-6"
        action="#"
        method="POST"
        onSubmit={onFormSubmit}
      >
        <AuthCode
          onChange={(v) => setCode(v)}
          containerClassName="grid grid-cols-6 gap-2"
          inputClassName="col-auto h-14 text-center text-2xl mt-1 block w-full shadow-bg bg:text-bg border-2 border-sky-200 focus:outline-none focus:ring-sky-400 focus:border-sky-400 rounded-md"
          allowedCharacters="numeric"
          disabled={isSubmitting}
          placeholder="."
        />
        <div>
          <LoadingButton isSubmitting>Verify</LoadingButton>
        </div>
      </form>
    </div>
  );
};

const ErrorMessage = (props: { children?: React.ReactNode }) => {
  return (
    <div
      className="p-2 text-sm text-red-700 bg-red-100 rounded-lg"
      role="alert"
    >
      {props.children}
    </div>
  );
};

const ReservationResult = (props: { hme: HmeEmail }) => {
  const onCopyToClipboardClick = async () => {
    await navigator.clipboard.writeText(props.hme.hme);
  };

  const buttons = [
    {
      icon: faClipboard,
      label: 'Copy to clipboard',
      onClick: onCopyToClipboardClick,
    },
    { icon: faCheck, label: 'Autofill' },
  ];
  return (
    <div
      className="space-y-2 p-2 text-sm text-green-700 bg-green-100 rounded-lg"
      role="alert"
    >
      <p>
        <strong>{props.hme.hme}</strong> has successfully been reserved!
      </p>
      <div className={`grid grid-cols-${buttons.length} gap-2`}>
        {buttons.map(({ icon, label, onClick }) => (
          <button
            onClick={onClick}
            type="button"
            className="focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 block w-full"
          >
            <FontAwesomeIcon icon={icon} /> {label}
          </button>
        ))}
      </div>
    </div>
  );
};

const SignOutButton = (props: { callback: Callback; client: ICloudClient }) => {
  return (
    <button
      className="text-sky-400 hover:text-sky-500"
      onClick={async () => {
        await props.client.logOut();
        props.callback(PopupTransition.SuccessfulSignOut);
      }}
    >
      Sign Out
    </button>
  );
};

const HideMyEmail = (props: { callback: Callback; client: ICloudClient }) => {
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
      if (props.client.authenticated) {
        const pms = new PremiumMailSettings(props.client);
        const result = await pms.listHme();
        setFwdToEmail(result.selectedForwardTo);
      }
    };

    fetchHmeList().catch(console.error);
  }, [props.client]);

  useEffect(() => {
    const fetchHmeEmail = async () => {
      if (props.client.authenticated) {
        setIsEmailRefreshSubmitting(true);
        const pms = new PremiumMailSettings(props.client);
        setHmeEmail(await pms.generateHme());
      }
    };

    fetchHmeEmail()
      .catch((e) => setHmeError(e.toString()))
      .finally(() => setIsEmailRefreshSubmitting(false));
  }, [props.client]);

  useEffect(() => {
    const getTabHost = async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });

      const tabUrl = tab.url;
      if (tabUrl !== undefined) {
        const { hostname } = new URL(tabUrl);
        setTabHost(hostname);
        setLabel(hostname);
      }
    };

    getTabHost().catch(console.error);
  }, []);

  const onEmailRefreshSubmit = async () => {
    setIsEmailRefreshSubmitting(true);
    setReservedHme(undefined);
    setHmeError(undefined);
    setReserveError(undefined);

    const pms = new PremiumMailSettings(props.client);
    try {
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
      const pms = new PremiumMailSettings(props.client);
      try {
        setReservedHme(
          await pms.reserveHme(hmeEmail, label || tabHost, note || undefined)
        );
      } catch (e) {
        setReserveError(e.toString());
      }
      setLabel(undefined);
      setNote(undefined);
    }
    setIsUseSubmitting(false);
  };

  return (
    <div className="text-base">
      <div className="mb-3 text-center">
        <h2 className="text-3xl font-bold text-gray-900">Hide My Email</h2>
        <h3 className="font-medium text-gray-400">
          Create an address for '{tabHost}'
        </h3>
      </div>
      <hr />
      <div className="my-3 space-y-2 text-center">
        <span className="text-2xl">
          <LoadingButton
            className="mr-1"
            isSubmitting={isEmailRefreshSubmitting}
            onClick={onEmailRefreshSubmit}
          >
            <FontAwesomeIcon
              className="text-sky-400 hover:text-sky-500"
              icon={faRefresh}
            />
          </LoadingButton>
          {hmeEmail}
        </span>
        {fwdToEmail !== undefined && (
          <p className="text-gray-400">Forward to: {fwdToEmail}</p>
        )}
        {hmeError && <ErrorMessage>{hmeError}</ErrorMessage>}
      </div>
      <hr />
      <form className="space-y-3 my-3" onSubmit={onUseSubmit}>
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
            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-sky-500 focus:border-sky-500 focus:z-10 sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="note" className="block font-medium">
            Note
          </label>
          <textarea
            id="note"
            rows={1}
            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-sky-500 focus:border-sky-500 focus:z-10 sm:text-sm"
            placeholder="Make a note (optional)"
            value={note || ''}
            onChange={(e) => setNote(e.target.value)}
          ></textarea>
        </div>
        <LoadingButton isSubmitting={isUseSubmitting}>Use</LoadingButton>
        {reservedHme && <ReservationResult hme={reservedHme} />}
        {reserveError && <ErrorMessage>{reserveError}</ErrorMessage>}
      </form>
      <hr />
      <div className="grid grid-cols-2 mt-3">
        <div>
          <a
            className="text-sky-400 hover:text-sky-500"
            href="https://www.icloud.com/settings/hidemyemail"
          >
            iCloud Settings
          </a>
        </div>
        <div className="text-right">
          <SignOutButton client={props.client} callback={props.callback} />
        </div>
      </div>
    </div>
  );
};

enum PopupState {
  SignedIn,
  Verified,
  SignedOut,
}

const STATE_ELEMENTS: {
  [key in PopupState]: React.FC<{ callback: Callback; client: ICloudClient }>;
} = {
  [PopupState.SignedOut]: SignInForm,
  [PopupState.SignedIn]: TwoFaForm,
  [PopupState.Verified]: HideMyEmail,
};

const STATE_MACHINE_TRANSITIONS: {
  [key in PopupState]: { [key in PopupTransition]?: PopupState };
} = {
  [PopupState.SignedOut]: {
    [PopupTransition.SuccessfulSignIn]: PopupState.SignedIn,
  },
  [PopupState.SignedIn]: {
    [PopupTransition.SuccessfulVerification]: PopupState.Verified,
  },
  [PopupState.Verified]: {
    [PopupTransition.SuccessfulSignOut]: PopupState.SignedOut,
  },
};

const transitionToNextStateElement = (
  state: PopupState,
  setState: Dispatch<PopupState>,
  client: ICloudClient
) => {
  const callback = (transition: PopupTransition) => {
    const currStateTransitions = STATE_MACHINE_TRANSITIONS[state];
    const nextState = currStateTransitions[transition];
    nextState !== undefined && setState(nextState);
  };
  const StateElement = STATE_ELEMENTS[state];
  return <StateElement callback={callback} client={client} />;
};

const Popup = () => {
  const [state, setState] = useChromeStorageState(
    ['iCloudHmePopupState'],
    PopupState.SignedOut
  );

  const [sessionData, setSessionData] =
    useChromeStorageState<ICloudClientSessionData>(['iCloudHmeClientSession'], {
      headers: {},
      webservices: {},
    });

  const session = new ICloudClientSession(sessionData, setSessionData);
  const client = new ICloudClient(session);
  return (
    <div className="min-h-full flex items-center justify-center py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {transitionToNextStateElement(state, setState, client)}
      </div>
    </div>
  );
};

export default Popup;
