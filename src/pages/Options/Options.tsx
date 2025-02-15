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
import startCase from 'lodash.startcase';
import isEqual from 'lodash.isequal';
import { DEFAULT_STORE } from '../../storage';

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
          isEqual(prevState, result.forwardToEmails)
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
    <form className="space-y-3" onSubmit={onSelectedFwdToSubmit}>
      {fwdToEmails?.map((fwdToEmail, key) => (
        <div className="flex items-center mb-3" key={key}>
          <input
            onChange={() => setSelectedFwdToEmail(fwdToEmail)}
            checked={fwdToEmail === selectedFwdToEmail}
            id={`radio-${key}`}
            type="radio"
            disabled={isSubmitting}
            name={`fwdto-radio-${key}`}
            className="cursor-pointer w-4 h-4 accent-gray-900 hover:accent-gray-500"
          />
          <label
            htmlFor={`radio-${key}`}
            className="cursor-pointer ml-2 text-gray-900"
          >
            {fwdToEmail}
          </label>
        </div>
      ))}
      <LoadingButton loading={isSubmitting}>Update</LoadingButton>
      {updateFwdToError && <ErrorMessage>{updateFwdToError}</ErrorMessage>}
    </form>
  );
};

const Disclaimer = () => {
  return (
    <div>
      <p>
        This extension is not endorsed by, directly affiliated with, maintained,
        authorized, or sponsored by Apple.
      </p>
      <p>
        It is developed independently by{' '}
        <Link href="https://twitter.com/dedoussis">Dimitrios Dedoussis</Link>.
      </p>
      <p>
        The source code is publicly available at{' '}
        <Link href="https://github.com/dedoussis/icloud-hide-my-email-browser-extension">
          GitHub
        </Link>{' '}
        under the MIT license.
      </p>
      <p>
        The extension itself is licensed under the same license as the source
        code.
      </p>
    </div>
  );
};

const SettingsForm = () => {
  const [options, setOptions] = useBrowserStorageState(
    'iCloudHmeOptions',
    DEFAULT_STORE.iCloudHmeOptions
  );

  const settingsCheckBox = ([key, value]: [string, boolean]) => <div className="flex items-center mb-3" key={key}>
    <input
      onChange={() => {
        if (key in options.autofill) { // Handle nested autofill options
          setOptions({
            ...options,
            autofill: { ...options.autofill, [key]: !value },
          });
        } else { // Handle top-level options
          setOptions({
            ...options,
            [key]: !value,
          });
        }
      }}
      checked={value}
      id={`checkbox-${key}`}
      type="checkbox"
      name={`checkbox-${key}`}
      className="cursor-pointer w-4 h-4 accent-gray-900 hover:accent-gray-500"
    />
    <label
      htmlFor={`checkbox-${key}`}
      className="cursor-pointer ml-2 text-gray-900"
    >
      {startCase(key)}
    </label>
  </div>

  return (
    <form className="space-y-3">
      <h4 className="font-bold text-md mb-4">Autofill</h4>
      {Object.entries(options.autofill).map(([key, value]) => (
        settingsCheckBox([key, value])
      ))}

      <h4 className="font-bold text-md mb-4">Other</h4>
      {settingsCheckBox(["useEmailOnGenerate", options.useEmailOnGenerate])}
    </form>
  );
};

const Options = () => {
  return (
    <div className="w-9/12 m-auto my-3">
      <TitledComponent title="Hide My Email" subtitle="Settings">
        <div>
          <h3 className="font-bold text-lg mb-3">Disclaimer</h3>
          <Disclaimer />
        </div>
        <div>
          <h3 className="font-bold text-lg mb-3">Forward To Address</h3>
          <SelectFwdToForm />
        </div>
        <div>
          <h3 className="font-bold text-lg mb-3">Settings</h3>
          <SettingsForm />
        </div>
      </TitledComponent>
    </div>
  );
};

export default Options;
