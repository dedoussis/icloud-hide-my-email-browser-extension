export type Autofill = {
  button: boolean;
  contextMenu: boolean;
};

export type Options = {
  autofill: Autofill;
};

export const DEFAULT_OPTIONS: Options = {
  autofill: {
    button: true,
    contextMenu: false,
  },
};
