import React, { useState, Dispatch, SetStateAction } from 'react';
import './Popup.css';

enum PopupTransition {
  SuccessfulSignIn,
  FailedSignIn,
  SuccessfulVerification,
  FailedVerification,
  SuccessfulSignOut,
  FailedSignOut,
}

type Callback = (transition: PopupTransition) => void;

const SignInForm = (props: { callback: Callback }) => {
  const onFormSubmit = () => {
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
            />
          </div>
        </div>

        <div className="text-sm">
          <a href="#" className="font-medium text-sky-400 hover:text-sky-500">
            Forgot your password?
          </a>
        </div>

        <div>
          <button
            type="submit"
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-sky-400 hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
          >
            Sign in
          </button>
        </div>
      </form>
    </div>
  );
};

const TwoFaForm = (props: { callback: Callback }) => {
  const onFormSubmit = () => {
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
        <div className="grid grid-cols-6 gap-2">
          {[1, 2, 3, 4, 5, 6].map((key) => (
            <input
              className="col-auto h-14 text-center text-2xl mt-1 block w-full shadow-bg bg:text-bg border-2 border-sky-200 focus:outline-none focus:ring-sky-400 focus:border-sky-400 rounded-md"
              type="tel"
              name={`pincode-${key}`}
              maxLength={1}
              pattern="[\d]*"
              tabIndex={1}
              placeholder="·"
              autoComplete="off"
            />
          ))}
        </div>
        <div>
          <button
            type="submit"
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-sky-400 hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
          >
            Verify
          </button>
        </div>
      </form>
    </div>
  );
};

const HideMyEmail = (props: { callback: Callback }) => {
  return <div>User is now signed-in and verified!</div>;
};

enum PopupState {
  SignedIn,
  Verified,
  SignedOut,
}

const STATE_ELEMENTS: {
  [key in PopupState]: React.FC<{ callback: Callback }>;
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
  setState: Dispatch<SetStateAction<PopupState>>
) => {
  const callback = (transition: PopupTransition) => {
    const currStateTransitions = STATE_MACHINE_TRANSITIONS[state];
    const nextState = currStateTransitions[transition];
    setState(nextState !== undefined ? nextState : state);
  };
  const StateElement = STATE_ELEMENTS[state];
  return <StateElement callback={callback} />;
};

const Popup = () => {
  return (
    <div className="min-h-full flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {transitionToNextStateElement(...useState(PopupState.SignedOut))}
      </div>
    </div>
  );
};

export default Popup;
