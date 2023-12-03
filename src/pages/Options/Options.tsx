import React, { useState, useEffect } from 'react';
import './Options.css';
import { useBrowserStorageState } from '../../hooks';
import ICloudClient, {
  ClientAuthenticationError,
  EMPTY_SESSION_DATA,
  ICloudClientSession,
  ICloudClientSessionData,
  PremiumMailSettings,
} from '../../iCloudClient';
import {
  Spinner,
  LoadingButton,
  ErrorMessage,
  TitledComponent,
} from '../../commonComponents';
import { OPTIONS_STORAGE_KEYS, SESSION_DATA_STORAGE_KEYS } from '../../storage';
import { DEFAULT_OPTIONS, Options } from '../../options';
import startCase from 'lodash.startcase';

const SelectFwdToForm = (props: { client: ICloudClient }) => {
  const [selectedFwdToEmail, setSelectedFwdToEmail] = useState<string>();
  const [fwdToEmails, setFwdToEmails] = useState<string[]>();
  const [isFetching, setIsFetching] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listHmeError, setListHmeError] = useState<string>();
  const [updateFwdToError, setUpdateFwdToError] = useState<string>();

  useEffect(() => {
    const fetchHmeList = async () => {
      setListHmeError(undefined);
      setIsFetching(true);
      try {
        const pms = new PremiumMailSettings(props.client);
        const result = await pms.listHme();
        setFwdToEmails(result.forwardToEmails);
        setSelectedFwdToEmail(result.selectedForwardTo);
      } catch (e) {
        const errorMsg =
          e instanceof ClientAuthenticationError
            ? 'To select a new Forward-To address, you first need to sign-in by following the instructions on the extension pop-up.'
            : e.toString();
        setListHmeError(errorMsg);
      } finally {
        setIsFetching(false);
      }
    };

    fetchHmeList();
  }, [props.client]);

  const onSelectedFwdToSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setIsSubmitting(true);
    if (selectedFwdToEmail) {
      try {
        const pms = new PremiumMailSettings(props.client);
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

const Link = (props: { children: React.ReactNode; href: string }) => {
  return (
    <a
      className="text-sky-400 hover:text-sky-500"
      href={props.href}
      target="_blank"
      rel="nolink noreferrer"
    >
      {props.children}
    </a>
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

const AutofillForm = () => {
  const [options, setOptions] = useBrowserStorageState<Options>(
    OPTIONS_STORAGE_KEYS,
    DEFAULT_OPTIONS
  );

  return (
    <form className="space-y-3">
      {Object.entries(options.autofill).map(([key, value]) => (
        <div className="flex items-center mb-3" key={key}>
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
            className="cursor-pointer w-4 h-4 accent-gray-900 hover:accent-gray-500"
          />
          <label
            htmlFor={`checkbox-${key}`}
            className="cursor-pointer ml-2 text-gray-900"
          >
            {startCase(key)}
          </label>
        </div>
      ))}
    </form>
  );
};

const Options = () => {
  const [sessionData, setSessionData] =
    useBrowserStorageState<ICloudClientSessionData>(
      SESSION_DATA_STORAGE_KEYS,
      EMPTY_SESSION_DATA
    );

  const session = new ICloudClientSession(sessionData, setSessionData);
  const client = new ICloudClient(session);

  return (
    <div className="w-9/12 m-auto my-3">
      <TitledComponent title="Hide My Email" subtitle="Settings">
        <div>
          <h3 className="font-bold text-lg mb-3">Disclaimer</h3>
          <Disclaimer />
        </div>
        <div>
          <h3 className="font-bold text-lg mb-3">Forward To Address</h3>
          <SelectFwdToForm client={client} />
        </div>
        <div>
          <h3 className="font-bold text-lg mb-3">Autofill</h3>
          <AutofillForm />
        </div>
      </TitledComponent>
    </div>
  );
};

export default Options;
