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

enum PopupTransition {
  SuccessfulSignIn,
  FailedSignIn,
  SuccessfulVerification,
  FailedVerification,
  SuccessfulSignOut,
  FailedSignOut,
}

const LoadingButton = (props: { label: string; isSubmitting: boolean }) => {
  return (
    <button
      type="submit"
      disabled={props.isSubmitting}
      className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-sky-400 hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
    >
      {props.isSubmitting ? (
        <svg
          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
        props.label
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
          <LoadingButton label="Sign in" isSubmitting={isSubmitting} />
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
          <LoadingButton label="Verify" isSubmitting={isSubmitting} />
        </div>
      </form>
    </div>
  );
};

const HideMyEmail = (props: { callback: Callback; client: ICloudClient }) => {
  const [hmeList, setHmeList] = useState<HmeEmail[]>();

  useEffect(() => {

    const fetchHmeList = async () => {
      const pms = new PremiumMailSettings(props.client);
      setHmeList(await pms.listHme());
    };

    fetchHmeList().catch(console.error);
  }, [props.client]);

  return (
    <div>
      <ul className="divide-y divide-gray-200">
        {hmeList?.map((hme) => (
          <li key={hme.hme} className="py-4 flex">
            {hme.hme}
          </li>
        ))}
      </ul>
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
    <div className="min-h-full flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {transitionToNextStateElement(state, setState, client)}
      </div>
    </div>
  );
};

export default Popup;
