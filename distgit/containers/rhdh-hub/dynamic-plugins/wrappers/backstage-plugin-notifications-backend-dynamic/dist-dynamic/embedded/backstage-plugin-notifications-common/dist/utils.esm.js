const isNotificationsEnabledFor = (settings, channelId, originId) => {
  const channel = settings.channels.find((c) => c.id === channelId);
  if (!channel) {
    return true;
  }
  const origin = channel.origins.find((o) => o.id === originId);
  if (!origin) {
    return true;
  }
  return origin.enabled;
};

export { isNotificationsEnabledFor };
//# sourceMappingURL=utils.esm.js.map
