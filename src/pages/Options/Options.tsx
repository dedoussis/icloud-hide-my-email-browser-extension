import React, { useState, useEffect } from 'react';
import './Options.css';
import { useChromeStorageState } from '../../hooks';
import ICloudClient, {
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
import { SESSION_DATA_STORAGE_KEYS } from '../../storage';

const SelectFwdToForm = (props: { client: ICloudClient }) => {
  const [selectedFwdToEmail, setSelectedFwdToEmail] = useState<string>();
  const [fwdToEmails, setFwdToEmails] = useState<string[]>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [fwdToError, setFwdToError] = useState<string>();

  useEffect(() => {
    const fetchHmeList = async () => {
      setIsSubmitting(true);
      if (props.client.authenticated) {
        setAuthenticated(true);
        const pms = new PremiumMailSettings(props.client);
        const result = await pms.listHme();
        setFwdToEmails(result.forwardToEmails);
        setSelectedFwdToEmail(result.selectedForwardTo);
      }
    };

    fetchHmeList()
      .catch(setFwdToError)
      .finally(() => setIsSubmitting(false));
  }, [props.client]);

  const onSelectedFwdToSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setIsSubmitting(true);
    const pms = new PremiumMailSettings(props.client);
    if (selectedFwdToEmail) {
      try {
        await pms.updateForwardToHme(selectedFwdToEmail);
      } catch (e) {
        setFwdToError(e.toString());
      }
    } else {
      setFwdToError('No Forward To address has been selected.');
    }
    setIsSubmitting(false);
  };

  if (!authenticated) {
    return (
      <ErrorMessage>
        Please sign-in through the extension pop-up in order to select a new
        Forward-To address.
      </ErrorMessage>
    );
  }

  if (fwdToEmails === undefined && fwdToError === undefined) {
    return <Spinner />;
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
            value=""
            disabled={isSubmitting}
            name={`fwdto-radio-${key}`}
            className="cursor-pointer w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
          />
          <label
            htmlFor={`radio-${key}`}
            className="cursor-pointer ml-2 text-gray-900"
          >
            {fwdToEmail}
          </label>
        </div>
      ))}
      <LoadingButton disabled={isSubmitting}>Update</LoadingButton>
      {fwdToError && <ErrorMessage>{fwdToError}</ErrorMessage>}
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
        <Link href="https://github.com/dedoussis/icloud-hide-my-email-chrome-extension">
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

const Options = () => {
  const [sessionData, setSessionData] =
    useChromeStorageState<ICloudClientSessionData>(
      SESSION_DATA_STORAGE_KEYS,
      EMPTY_SESSION_DATA
    );

  const session = new ICloudClientSession(sessionData, setSessionData);
  const client = new ICloudClient(session);

  return (
    <div className="w-9/12 m-auto mt-3">
      <TitledComponent title="Hide My Email" subtitle="Settings">
        <div>
          <h3 className="font-bold text-lg mb-3">Disclaimer</h3>
          <Disclaimer />
        </div>
        <div>
          <h3 className="font-bold text-lg mb-3">Forward To Address</h3>
          <SelectFwdToForm client={client} />
        </div>
      </TitledComponent>
    </div>
  );
};

export default Options;
