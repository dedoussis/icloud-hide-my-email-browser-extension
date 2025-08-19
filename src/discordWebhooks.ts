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