export enum PopupState {
  Authenticated,
  SignedOut,
  AuthenticatedAndManaging,
}

export type SignedOutAction = 'AUTHENTICATE';
export type AuthenticatedAction = 'MANAGE' | 'SIGN_OUT';
export type AuthenticatedAndManagingAction = 'GENERATE' | 'SIGN_OUT';

export type PopupAction =
  | SignedOutAction
  | AuthenticatedAction
  | AuthenticatedAndManagingAction;

type GenericTranstitions<Actions extends PopupAction> = {
  [key in Actions]: PopupState;
};

type SignedOutTransitions = GenericTranstitions<SignedOutAction>;
type AuthenticatedTransitions = GenericTranstitions<AuthenticatedAction>;
type AuthenticatedAndManagingTransition =
  GenericTranstitions<AuthenticatedAndManagingAction>;

type Transitions = {
  [PopupState.SignedOut]: SignedOutTransitions;
  [PopupState.Authenticated]: AuthenticatedTransitions;
  [PopupState.AuthenticatedAndManaging]: AuthenticatedAndManagingTransition;
} & { [key in PopupState]: unknown };

export const STATE_MACHINE_TRANSITIONS: Transitions = {
  [PopupState.SignedOut]: {
    AUTHENTICATE: PopupState.Authenticated,
  },
  [PopupState.Authenticated]: {
    MANAGE: PopupState.AuthenticatedAndManaging,
    SIGN_OUT: PopupState.SignedOut,
  },
  [PopupState.AuthenticatedAndManaging]: {
    GENERATE: PopupState.Authenticated,
    SIGN_OUT: PopupState.SignedOut,
  },
};
