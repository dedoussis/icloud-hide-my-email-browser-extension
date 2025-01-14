import {
  faDesktop,
  faMoon,
  faSpinner,
  faSun,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, {
  ButtonHTMLAttributes,
  DetailedHTMLProps,
  useEffect,
} from 'react';
import { useBrowserStorageState } from './hooks';

export const Spinner = () => {
  return (
    <div className="text-center">
      <FontAwesomeIcon
        icon={faSpinner}
        spin={true}
        className="text-3xl text-primary-light dark:text-primary-dark"
      />
    </div>
  );
};

export const LoadingButton = (
  props: {
    loading: boolean;
  } & DetailedHTMLProps<
    ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  >
) => {
  const { loading, disabled, ...btnHtmlAttrs } = props;

  const defaultClassName =
    'w-full justify-center text-white bg-primary-light hover:opacity-90 dark:bg-primary-dark focus:ring-4 focus:outline-none focus:ring-primary-light/30 dark:focus:ring-primary-dark/30 font-medium rounded-lg px-5 py-2.5 text-center mr-2 inline-flex items-center';

  const disabledClassName =
    'w-full justify-center text-white bg-gray-400 font-medium rounded-lg px-5 py-2.5 text-center mr-2 inline-flex items-center';

  const btnClassName = disabled ? disabledClassName : defaultClassName;

  return (
    <button
      type="submit"
      className={btnClassName}
      disabled={loading || disabled}
      {...btnHtmlAttrs}
    >
      {loading && !disabled && (
        <FontAwesomeIcon icon={faSpinner} spin={true} className="mr-1" />
      )}
      {props.children}
    </button>
  );
};

export const ErrorMessage = (props: { children?: React.ReactNode }) => {
  return (
    <div
      className="p-2 text-sm text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded-lg"
      role="alert"
    >
      {props.children}
    </div>
  );
};

export const TitledComponent = (props: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) => {
  const children =
    props.children instanceof Array ? props.children : [props.children];

  return (
    <div className="text-base space-y-3">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">
          {props.title}
        </h1>
        <h2 className="font-medium text-gray-400">{props.subtitle}</h2>
      </div>
      {children?.map((child, key) => {
        return (
          child && (
            <React.Fragment key={key}>
              <hr className="border-gray-200 dark:border-gray-700" />
              {child}
            </React.Fragment>
          )
        );
      })}
    </div>
  );
};

export const Link = (
  props: React.DetailedHTMLProps<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    HTMLAnchorElement
  >
) => {
  // https://github.com/jsx-eslint/eslint-plugin-react/issues/3284
  // eslint-disable-next-line react/prop-types
  const { className, children, ...restProps } = props;
  return (
    <a
      className={`text-primary-light dark:text-primary-dark hover:opacity-80 ${className}`}
      target="_blank"
      rel="noreferrer"
      {...restProps}
    >
      {children}
    </a>
  );
};

export const ThemeSwitch = () => {
  const [theme, setTheme] = useBrowserStorageState('theme', 'system');

  const updateTheme = (isDark: boolean) => {
    const elements = [
      document.documentElement,
      document.body,
      document.getElementById('app-container'),
    ];
    elements.forEach((el) => el?.classList.toggle('dark', isDark));
  };

  const getSystemTheme = () =>
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Initialize theme on mount
  useEffect(() => {
    if (theme === 'system') {
      updateTheme(getSystemTheme());
    } else {
      updateTheme(theme === 'dark');
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        updateTheme(mediaQuery.matches);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const themeIcons = {
    light: faSun,
    dark: faMoon,
    system: faDesktop,
  } as const;

  const nextTheme = {
    light: 'dark',
    dark: 'system',
    system: 'light',
  } as const;

  const themeLabels = {
    light: 'Light theme',
    dark: 'Dark theme',
    system: 'System theme',
  } as const;

  return (
    <button
      onClick={() => setTheme(nextTheme[theme])}
      className="p-2 rounded-lg text-text-light dark:text-text-dark hover:bg-surface-light dark:hover:bg-surface-dark"
      title={themeLabels[theme]}
      aria-label={themeLabels[theme]}
    >
      <FontAwesomeIcon icon={themeIcons[theme]} className="text-lg" />
    </button>
  );
};
