export enum MessageType {
  Autofill,
  GenerateRequest,
  GenerateResponse,
  ReservationRequest,
  ReservationResponse,
}

export type Message<T> = {
  type: MessageType;
  data: T;
};

export const sendMessageToActiveTab = async (
  type: MessageType,
  data: unknown
): Promise<void> => {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (tab.id !== undefined) {
    await chrome.tabs.sendMessage(tab.id, {
      type,
      data,
    });
  }
};
