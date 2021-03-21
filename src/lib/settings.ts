const {
  getObject,
  getObjectField,
  setObject,
} = require.main?.require('./src/database');

export interface Settings {
  // reminder checking interval [ms]
  checkingInterval: number,
  // tie respond privileges to reply, instead of view
  respondIfCanReply: boolean,
  // events can only be posted in the main post of a topic
  mainPostOnly: boolean,
  // views available in fullcalendar view
  calendarViews: string,
  // discord notification is activated
  enableDiscordNotifications: boolean,
  // provides discord webhook url
  discordWebhookUrl: string,
}

const convert = {
  checkingInterval: (x: string) => parseInt(x, 10) || 1000 * 60 * 5, // default 5 min
  respondIfCanReply: (x: string | boolean) => x === true || x === 'true', // default false
  mainPostOnly: (x: string | boolean) => x === true || x === 'true', // default false
  calendarViews: (x: string | null) => x || 'month,agendaWeek,agendaDay',
  enableDiscordNotifications: (x: string | boolean) => x === true || x === 'true',
  discordWebhookUrl: (x: string) => x,
};

const getSettings = async (): Promise<Settings> => {
  const {
    checkingInterval,
    respondIfCanReply,
    mainPostOnly,
    calendarViews,
    enableDiscordNotifications,
    discordWebhookUrl,
  } = await getObject('plugin-calendar:settings') || {};
  return {
    checkingInterval: convert.checkingInterval(checkingInterval),
    respondIfCanReply: convert.respondIfCanReply(respondIfCanReply),
    mainPostOnly: convert.mainPostOnly(mainPostOnly),
    calendarViews: convert.calendarViews(calendarViews),
    enableDiscordNotifications: convert.enableDiscordNotifications(enableDiscordNotifications),
    discordWebhookUrl: convert.discordWebhookUrl(discordWebhookUrl),
  };
};

const setSettings = (settings: Settings): Promise<void> => setObject('plugin-calendar:settings', settings);

const getSetting = async <K extends keyof Settings>(key: K): Promise<Settings[K]> => {
  const value = await getObjectField('plugin-calendar:settings', key);
  if (!convert[key]) {
    throw Error('invalid-data');
  }
  return convert[key](value) as Settings[K];
};

export {
  getSettings,
  getSetting,
  setSettings,
};
