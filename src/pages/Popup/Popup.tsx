import React, {
  useState,
  Dispatch,
  useEffect,
  ButtonHTMLAttributes,
  DetailedHTMLProps,
} from 'react';
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
  faSpinner,
  faList,
  faSignOut,
  IconDefinition,
  faPlus,
  faTrashAlt,
  faBan,
} from '@fortawesome/free-solid-svg-icons';
import { MessageType, sendMessageToActiveTab } from '../../messages';

enum PopupTransition {
  SuccessfulSignIn,
  FailedSignIn,
  SuccessfulVerification,
  FailedVerification,
  SuccessfulSignOut,
  FailedSignOut,
  List,
  Generate,
}

const LoadingButton = (
  props: {
    children?: React.ReactNode;
  } & DetailedHTMLProps<
    ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  >
) => {
  const defaultClassName =
    'w-full justify-center text-white bg-sky-400 hover:bg-sky-500 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg px-5 py-2.5 text-center mr-2 inline-flex items-center';

  return (
    <button type="submit" className={defaultClassName} {...props}>
      {props.disabled && (
        <FontAwesomeIcon icon={faSpinner} spin={true} className="mr-1" />
      )}
      {props.children}
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
              autoFocus
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
          <LoadingButton disabled={isSubmitting}>Sign In</LoadingButton>
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
          <LoadingButton disabled={isSubmitting}>Verify</LoadingButton>
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

  const onAutofillClick = async () => {
    await sendMessageToActiveTab(MessageType.Autofill, props.hme.hme);
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
      <div className={`grid grid-cols-2 gap-2`}>
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
    <button className="text-sky-400 hover:text-sky-500" {...props}>
      <FontAwesomeIcon icon={props.icon} className="mr-1" />
      {props.label}
    </button>
  );
};

const SignOutButton = (props: { callback: Callback; client: ICloudClient }) => {
  return (
    <FooterButton
      className="text-sky-400 hover:text-sky-500"
      onClick={async () => {
        await props.client.logOut();
        props.callback(PopupTransition.SuccessfulSignOut);
      }}
      label="Sign out"
      icon={faSignOut}
    />
  );
};

const HmeGenerator = (props: { callback: Callback; client: ICloudClient }) => {
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

  const useInputClassName =
    'appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-sky-500 focus:border-sky-500 focus:z-10 sm:text-sm';

  return (
    <div className="text-base space-y-3">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900">Hide My Email</h2>
        <h3 className="font-medium text-gray-400">
          Create an address for '{tabHost}'
        </h3>
      </div>
      <hr />
      <div className="text-center">
        <span className="text-2xl">
          <button className="mr-1" onClick={onEmailRefreshClick}>
            <FontAwesomeIcon
              className="text-sky-400 hover:text-sky-500"
              icon={faRefresh}
              spin={isEmailRefreshSubmitting}
            />
          </button>
          {hmeEmail}
        </span>
        {fwdToEmail !== undefined && (
          <p className="text-gray-400">Forward to: {fwdToEmail}</p>
        )}
        {hmeError && <ErrorMessage>{hmeError}</ErrorMessage>}
      </div>
      <hr />
      <form className="space-y-3" onSubmit={onUseSubmit}>
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
            className={useInputClassName}
          />
        </div>
        <div>
          <label htmlFor="note" className="block font-medium">
            Note
          </label>
          <textarea
            id="note"
            rows={1}
            className={useInputClassName}
            placeholder="Make a note (optional)"
            value={note || ''}
            onChange={(e) => setNote(e.target.value)}
          ></textarea>
        </div>
        <LoadingButton disabled={isUseSubmitting}>Use</LoadingButton>
        {reservedHme && <ReservationResult hme={reservedHme} />}
        {reserveError && <ErrorMessage>{reserveError}</ErrorMessage>}
      </form>
      <hr />
      <div className="grid grid-cols-2">
        <div>
          <FooterButton
            onClick={() => props.callback(PopupTransition.List)}
            icon={faList}
            label="List emails"
          />
        </div>
        <div className="text-right">
          <SignOutButton {...props} />
        </div>
      </div>
    </div>
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

  const onActivationClick = async () => {
    setIsActivateSubmitting(true);
    const pms = new PremiumMailSettings(props.client);
    try {
      if (props.hme.isActive) {
        await pms.deactivateHme(props.hme.anonymousId);
      } else {
        await pms.reactivateHme(props.hme.anonymousId);
      }
      setIsActivateSubmitting(false);
      props.activationCallback();
    } catch (e) {
      setIsActivateSubmitting(false);
      setError(e.toString());
    }
  };

  const onDeletionClick = async () => {
    setIsDeleteSubmitting(true);
    const pms = new PremiumMailSettings(props.client);
    try {
      await pms.deleteHme(props.hme.anonymousId);
      setIsDeleteSubmitting(false);
      props.deletionCallback();
    } catch (e) {
      setIsDeleteSubmitting(false);
      setError(e.toString());
    }
  };

  const onCopyClick = async () => {
    await navigator.clipboard.writeText(props.hme.hme);
  };

  const onAutofillClick = async () => {
    await sendMessageToActiveTab(MessageType.Autofill, props.hme.hme);
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
          disabled={isActivateSubmitting}
        >
          <FontAwesomeIcon icon={props.hme.isActive ? faBan : faRefresh} />
        </LoadingButton>
        {!props.hme.isActive && (
          <LoadingButton
            title="Delete"
            className={`${btnClassName} bg-red-500 hover:bg-red-600 focus:ring-red-300 col-span-3`}
            onClick={onDeletionClick}
            disabled={isDeleteSubmitting}
          >
            <FontAwesomeIcon icon={faTrashAlt} className="mr-1" /> Delete
          </LoadingButton>
        )}
      </div>
    </div>
  );
};

const HmeList = (props: { callback: Callback; client: ICloudClient }) => {
  const [hmeEmails, setHmeEmails] = useState<HmeEmail[]>();
  const [hmeEmailsError, setHmeEmailsError] = useState<string>(); // TODO
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedHmeIdx, setSelectedHmeIndex] = useState(0);

  useEffect(() => {
    const fetchHmeList = async () => {
      if (props.client.authenticated) {
        setIsSubmitting(true);
        const pms = new PremiumMailSettings(props.client);
        const result = await pms.listHme();
        setHmeEmails(
          result.hmeEmails.sort((a, b) => b.createTimestamp - a.createTimestamp)
        );
      }
    };

    fetchHmeList()
      .catch((e) => setHmeEmailsError(e.toString()))
      .finally(() => setIsSubmitting(false));
  }, [props.client]);

  const activationCallback = () => {
    setHmeEmails(
      hmeEmails?.map((hmeEmail, idx) => {
        if (idx === selectedHmeIdx) {
          hmeEmail.isActive = !hmeEmail.isActive;
        }
        return hmeEmail;
      })
    );
  };

  const deletionCallback = () => {
    const currSelectedIdxTmp = selectedHmeIdx;
    if (hmeEmails && selectedHmeIdx >= hmeEmails.length - 1) {
      setSelectedHmeIndex(selectedHmeIdx - 1);
    }
    setHmeEmails(hmeEmails?.filter((_, idx) => idx !== currSelectedIdxTmp));
  };

  const btnBaseClassName =
    'p-2 w-full text-left border-b border-gray-200 cursor-pointer focus:outline-none truncate';
  const btnClassName = `${btnBaseClassName} hover:bg-gray-100`;
  const selectedBtnClassName = `${btnBaseClassName} text-white bg-sky-400 font-medium`;

  const hmeListGrid = (
    <div className="grid grid-cols-2" style={{ height: 394 }}>
      <div className="overflow-y-auto text-sm rounded-l-md text-gray-900 border border-gray-200">
        {hmeEmails?.map((hme, idx) => (
          <button
            key={idx}
            aria-current={selectedHmeIdx === idx}
            type="button"
            className={
              idx === selectedHmeIdx ? selectedBtnClassName : btnClassName
            }
            onClick={() => setSelectedHmeIndex(idx)}
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
        ))}
      </div>
      <div className="p-2 overflow-y-auto rounded-r-md text-gray-900 border border-l-0 border-gray-200">
        {hmeEmails && (
          <HmeDetails
            client={props.client}
            hme={hmeEmails[selectedHmeIdx]}
            activationCallback={activationCallback}
            deletionCallback={deletionCallback}
          />
        )}
      </div>
    </div>
  );

  const spinner = (
    <div className="text-center">
      <FontAwesomeIcon
        icon={faSpinner}
        spin={true}
        className="text-3xl text-sky-400"
      />
    </div>
  );

  const emptyState = (
    <div className="text-center text-lg text-gray-400">
      There are no emails to list
    </div>
  );

  return (
    <div className="text-base space-y-3">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900">Hide My Email</h2>
        <h3 className="font-medium text-gray-400">All HideMyEmail addresses</h3>
      </div>
      <hr />
      {isSubmitting
        ? spinner
        : hmeEmails && hmeEmails?.length > 0
        ? hmeListGrid
        : emptyState}
      <hr />
      <div className="grid grid-cols-2">
        <div>
          <FooterButton
            onClick={() => props.callback(PopupTransition.Generate)}
            icon={faPlus}
            label="Generate new email"
          />
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
  VerifiedAndListing,
}

const STATE_ELEMENTS: {
  [key in PopupState]: React.FC<{ callback: Callback; client: ICloudClient }>;
} = {
  [PopupState.SignedOut]: SignInForm,
  [PopupState.SignedIn]: TwoFaForm,
  [PopupState.Verified]: HmeGenerator,
  [PopupState.VerifiedAndListing]: HmeList,
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
    [PopupTransition.List]: PopupState.VerifiedAndListing,
  },
  [PopupState.VerifiedAndListing]: {
    [PopupTransition.SuccessfulSignOut]: PopupState.SignedOut,
    [PopupTransition.Generate]: PopupState.Verified,
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
      <div className="max-w-md w-full">
        {transitionToNextStateElement(state, setState, client)}
      </div>
    </div>
  );
};

export default Popup;
