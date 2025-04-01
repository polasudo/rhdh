'use strict';

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

exports.isNotificationsEnabledFor = isNotificationsEnabledFor;
//# sourceMappingURL=utils.cjs.js.map
