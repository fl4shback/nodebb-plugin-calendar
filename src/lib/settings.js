import { promisify as p } from 'util';

const db = require.main.require('./src/database');

const getObject = p(db.getObject);
const getObjectField = p(db.getObjectField);
const setObject = p(db.setObject);

const convert = {
  checkingInterval: x => parseInt(x, 10) || 1000 * 60 * 5,
  respondIfCanReply: x => x === true || x === 'true',
  mainPostOnly: x => x === true || x === 'true',
  calendarViews: x => x || 'month,agendaWeek,agendaDay',
  enableDiscordNotifications: x => x === true || x === 'true',
  discordWebhookUrl: x => x,
};

const getSettings = async () => {
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

const setSettings = settings => setObject('plugin-calendar:settings', settings);

const getSetting = async (key) => {
  const value = await getObjectField('plugin-calendar:settings', key);
  if (!convert[key]) {
    throw Error('invalid-data');
  }
  return convert[key](value);
};

export {
  getSettings,
  getSetting,
  setSettings,
};