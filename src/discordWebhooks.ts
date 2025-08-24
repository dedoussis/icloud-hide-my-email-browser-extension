export const sendDiscordWebhook = async (text: string | undefined, debug: boolean) => {
  try {
    const { discordWebhook, name, debugDiscordWebhook } = await chrome.storage.local.get([
      "discordWebhook",
      "name",
      "debugDiscordWebhook"
    ]);

    if (!discordWebhook) {
      console.error("No Discord webhook URL set in storage");
      return;
    }

    const payload = {
      content: name ? `[${name}] ${text}` : text,
    };

    await fetch(debug ? debugDiscordWebhook : discordWebhook , {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Failed to send to Discord:", error);
  }
}

export async function safeSendDiscordWebhook(message: string, isError: boolean, maxRetries = 3): Promise<void> {
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    try {
      await sendDiscordWebhook(message, isError);
      return; // success → stop retrying
    } catch (err) {
      console.warn(`sendDiscordWebhook failed (attempt ${attempt}/${maxRetries})`, err);
      if (attempt >= maxRetries) {
        console.error("sendDiscordWebhook failed after max retries");
      } else {
        // small delay before retry
        await new Promise(res => setTimeout(res, attempt * 500)); // 0.5s, 1s, 1.5s
      }
    }
  }
}
