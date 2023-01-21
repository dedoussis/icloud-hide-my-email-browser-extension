export enum PopupState {
  SignedIn,
  Verified,
  SignedOut,
  VerifiedAndManaging,
}

export type SignedOutAction = 'SUCCESSFUL_SIGN_IN' | 'SUCCESSFUL_VERIFICATION';
export type SignedInAction = 'SUCCESSFUL_VERIFICATION' | 'SUCCESSFUL_SIGN_OUT';
export type VerifiedAction = 'MANAGE' | 'SUCCESSFUL_SIGN_OUT';
export type VerifiedAndManagingAction = 'GENERATE' | 'SUCCESSFUL_SIGN_OUT';
export type PopupAction =
  | SignedOutAction
  | SignedInAction
  | VerifiedAction
  | VerifiedAndManagingAction;

type GenericTranstitions<Actions extends PopupAction> = {
  [key in Actions]: PopupState;
};

type SignedOutTransitions = GenericTranstitions<SignedOutAction>;
type SignedInTransitions = GenericTranstitions<SignedInAction>;
type VerifiedTransitions = GenericTranstitions<VerifiedAction>;
type VerifiedAndManagingTransition =
  GenericTranstitions<VerifiedAndManagingAction>;

type Transitions = {
  [PopupState.SignedOut]: SignedOutTransitions;
  [PopupState.SignedIn]: SignedInTransitions;
  [PopupState.Verified]: VerifiedTransitions;
  [PopupState.VerifiedAndManaging]: VerifiedAndManagingTransition;
} & { [key in PopupState]: unknown };

export const STATE_MACHINE_TRANSITIONS: Transitions = {
  [PopupState.SignedOut]: {
    SUCCESSFUL_SIGN_IN: PopupState.SignedIn,
    SUCCESSFUL_VERIFICATION: PopupState.Verified,
  },
  [PopupState.SignedIn]: {
    SUCCESSFUL_VERIFICATION: PopupState.Verified,
    SUCCESSFUL_SIGN_OUT: PopupState.SignedOut,
  },
  [PopupState.Verified]: {
    MANAGE: PopupState.VerifiedAndManaging,
    SUCCESSFUL_SIGN_OUT: PopupState.SignedOut,
  },
  [PopupState.VerifiedAndManaging]: {
    GENERATE: PopupState.Verified,
    SUCCESSFUL_SIGN_OUT: PopupState.SignedOut,
  },
};
