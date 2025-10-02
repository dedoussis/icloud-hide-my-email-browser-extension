import React, { useState, useEffect } from 'react';
import './Options.css';
import { useBrowserStorageState } from '../../hooks';
import ICloudClient, { PremiumMailSettings } from '../../iCloudClient';
import {
  Spinner,
  LoadingButton,
  ErrorMessage,
  TitledComponent,
  Link,
} from '../../commonComponents';
import { DEFAULT_STORE } from '../../storage';
import { startCase } from '../../utils/startCase';
import { deepEqual } from '../../utils/deepEqual';

const SELECT_FWD_TO_SIGNED_OUT_CTA_COPY =
  'To select a new Forward-To address, you first need to sign-in by following the instructions on the extension pop-up.';

const SelectFwdToForm = () => {
  const [selectedFwdToEmail, setSelectedFwdToEmail] = useState<string>();
  const [fwdToEmails, setFwdToEmails] = useState<string[]>();
  const [isFetching, setIsFetching] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listHmeError, setListHmeError] = useState<string>();
  const [updateFwdToError, setUpdateFwdToError] = useState<string>();
  const [clientState, setClientState, isClientStateLoading] =
    useBrowserStorageState('clientState', undefined);

  useEffect(() => {
    const fetchHmeList = async () => {
      setListHmeError(undefined);
      setIsFetching(true);

      if (clientState?.setupUrl === undefined) {
        setListHmeError(SELECT_FWD_TO_SIGNED_OUT_CTA_COPY);
        setIsFetching(false);
        return;
      }

      const client = new ICloudClient(clientState.setupUrl);
      const isClientAuthenticated = await client.isAuthenticated();
      if (!isClientAuthenticated) {
        setListHmeError(SELECT_FWD_TO_SIGNED_OUT_CTA_COPY);
        setIsFetching(false);
        return;
      }

      try {
        const pms = new PremiumMailSettings(client);
        const result = await pms.listHme();
        setFwdToEmails((prevState) =>
          deepEqual(prevState, result.forwardToEmails)
            ? prevState
            : result.forwardToEmails
        );
        setSelectedFwdToEmail(result.selectedForwardTo);
      } catch (e) {
        setListHmeError(e.toString());
      } finally {
        setIsFetching(false);
      }
    };

    !isClientStateLoading && fetchHmeList();
  }, [setClientState, clientState?.setupUrl, isClientStateLoading]);

  const onSelectedFwdToSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setIsSubmitting(true);
    if (clientState === undefined) {
      // Entering this branch of the control flow should not be possible
      // as the client state is validated prior to rendering the form that
      // triggered this event handler.
      console.error('onSelectedFwdToSubmit: clientState is undefined');
      setUpdateFwdToError(SELECT_FWD_TO_SIGNED_OUT_CTA_COPY);
    } else if (selectedFwdToEmail) {
      try {
        const client = new ICloudClient(
          clientState.setupUrl,
          clientState.webservices
        );
        const pms = new PremiumMailSettings(client);
        await pms.updateForwardToHme(selectedFwdToEmail);
      } catch (e) {
        setUpdateFwdToError(e.toString());
      }
    } else {
      setUpdateFwdToError('No Forward To address has been selected.');
    }
    setIsSubmitting(false);
  };

  if (isFetching) {
    return <Spinner />;
  }

  if (listHmeError !== undefined) {
    return <ErrorMessage>{listHmeError}</ErrorMessage>;
  }

  return (
    <form className="space-y-4" onSubmit={onSelectedFwdToSubmit}>
      {fwdToEmails?.map((fwdToEmail, key) => (
        <div
          className="flex items-center gap-3 rounded-2xl border border-slate-800/60 bg-slate-950/50 px-4 py-3 shadow-inner shadow-slate-900/30"
          key={key}
        >
          <input
            onChange={() => setSelectedFwdToEmail(fwdToEmail)}
            checked={fwdToEmail === selectedFwdToEmail}
            id={`radio-${key}`}
            type="radio"
            disabled={isSubmitting}
            name={`fwdto-radio-${key}`}
            className="h-4 w-4 cursor-pointer accent-rainbow-purple"
          />
          <label
            htmlFor={`radio-${key}`}
            className="cursor-pointer text-sm font-medium text-slate-100"
          >
            {fwdToEmail}
          </label>
        </div>
      ))}
      <LoadingButton loading={isSubmitting}>Update forwarding</LoadingButton>
      {updateFwdToError && <ErrorMessage>{updateFwdToError}</ErrorMessage>}
    </form>
  );
};

const Disclaimer = () => {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-200/90">
      <p>
        This extension is not endorsed by, directly affiliated with, maintained,
        authorized, or sponsored by Apple.
      </p>
      <p className="text-center">
        Made by <Link href="https://sachit.me">Sachit Vithaldas</Link>.
      </p>
      <p className="text-center">
        Forked from{' '}
        <Link href="https://github.com/dedoussis/icloud-hide-my-email-browser-extension">
          icloud-hide-my-email-browser-extension
        </Link>{' '}
        by <Link href="https://twitter.com/dedoussis">Dimitrios Dedoussis</Link>
        .
      </p>
      <p className="text-center">
        The source code is available at{' '}
        <Link href="https://github.com/sachitv/icloud-hide-my-email-browser-extension">
          Github
        </Link>
        .
      </p>
      <p>
        The extension itself is licensed under the same license as the source
        code.
      </p>
    </div>
  );
};

const AutofillForm = () => {
  const [options, setOptions] = useBrowserStorageState(
    'iCloudHmeOptions',
    DEFAULT_STORE.iCloudHmeOptions
  );

  return (
    <form className="space-y-3">
      {Object.entries(options.autofill).map(([key, value]) => (
        <div
          className="flex items-center gap-3 rounded-2xl border border-slate-800/60 bg-slate-950/50 px-4 py-3 shadow-inner shadow-slate-900/25"
          key={key}
        >
          <input
            onChange={() =>
              setOptions({
                ...options,
                autofill: { ...options.autofill, [key]: !value },
              })
            }
            checked={value}
            id={`checkbox-${key}`}
            type="checkbox"
            name={`checkbox-${key}`}
            className="h-4 w-4 cursor-pointer accent-rainbow-green"
          />
          <label
            htmlFor={`checkbox-${key}`}
            className="cursor-pointer text-sm font-medium text-slate-100"
          >
            {startCase(key)}
          </label>
        </div>
      ))}
    </form>
  );
};

const Options = () => {
  return (
    <div className="min-h-screen px-4 py-10 text-slate-100">
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <TitledComponent title="Control Center" subtitle="Tune your experience">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">Disclaimer</h3>
            <Disclaimer />
          </div>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">
              Forward To Address
            </h3>
            <SelectFwdToForm />
          </div>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">Autofill</h3>
            <AutofillForm />
          </div>
        </TitledComponent>
      </div>
    </div>
  );
};

export default Options;
