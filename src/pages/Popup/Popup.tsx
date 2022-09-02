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
    spinnerClassName?: string;
    displayChildrenWhileSubmitting?: boolean;
  } & React.HTMLProps<HTMLButtonElement>
) => {
  const defaultClassName =
    'w-full justify-center text-white bg-sky-400 hover:bg-sky-500 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg px-5 py-2.5 text-center mr-2 inline-flex items-center';

  const defaultSpinnerClassName = 'inline mr-3 w-4 h-4 text-white animate-spin';
  const displayChildrenWhileSubmitting =
    props.displayChildrenWhileSubmitting === undefined
      ? true
      : props.displayChildrenWhileSubmitting;
  return (
    <button
      disabled={props.isSubmitting}
      type="submit"
      className={props.className || defaultClassName}
      onClick={props.onClick}
    >
      {props.isSubmitting && (
        <svg
          aria-hidden="true"
          role="status"
          className={props.spinnerClassName || defaultSpinnerClassName}
          viewBox="0 0 100 101"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
            fill="#E5E7EB"
          />
          <path
            d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
            fill="currentColor"
          />
        </svg>
      )}
      {props.isSubmitting
        ? displayChildrenWhileSubmitting && props.children
        : props.children}
    </button>
  );
};

type Callback = (transition: PopupTransition) => void;

const SignInForm = (props: { callback: Callback; client: ICloudClient }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const onFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(undefined);

    try {
      await props.client.signIn(email, password);
      await props.client.accountLogin();
      setIsSubmitting(false);
      if (props.client.requires2fa) {
        props.callback(PopupTransition.SuccessfulSignIn);
      } else {
        props.callback(PopupTransition.SuccessfulVerification);
      }
    } catch (e) {
      setIsSubmitting(false);
      setError('Failed to sign in. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="mt-6 text-center text-3xl tracking-tight font-bold text-gray-900">
        Sign in to iCloud
      </h2>
      <form
        className="space-y-6 text-base"
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

        <div className="text-md">
          <a
            href="https://iforgot.apple.com/password/verify/appleid"
            className="font-medium text-sky-400 hover:text-sky-500"
          >
            Forgot your password?
          </a>
        </div>

        <div>
          <LoadingButton isSubmitting={isSubmitting}>Sign In</LoadingButton>
        </div>
      </form>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  );
};

const TwoFaForm = (props: { callback: Callback; client: ICloudClient }) => {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const onFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(undefined);
    if (code.length === 6) {
      try {
        await props.client.verify2faCode(code);
        await props.client.trustDevice();
        await props.client.accountLogin();

        setIsSubmitting(false);

        props.callback(PopupTransition.SuccessfulVerification);
      } catch (e) {
        setIsSubmitting(false);
        setError(
          '2FA failed. Please try entering the code again or sign-out and sign back in.'
        );
      }
    } else {
      setIsSubmitting(false);
      setError('Please fill in all of the 6 digits of the code.');
    }
  };

  return (
    <div className="text-base space-y-4">
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
          <LoadingButton isSubmitting={isSubmitting}>Verify</LoadingButton>
        </div>
      </form>
      <div className="text-center mt-3">
        <SignOutButton {...props} />
      </div>
      {error && <ErrorMessage>{error}</ErrorMessage>}
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
        {buttons.map(({ icon, label, onClick }, index) => (
          <button
            key={index}
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

  const onEmailRefreshClick = async () => {
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
            spinnerClassName="inline mr-1 w-5 h-5 text-black animate-spin"
            isSubmitting={isEmailRefreshSubmitting}
            displayChildrenWhileSubmitting={false}
            onClick={onEmailRefreshClick}
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
          <SignOutButton {...props} />
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
    [PopupTransition.SuccessfulSignOut]: PopupState.SignedOut,
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
      dsInfo: {},
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
