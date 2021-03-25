import validator from 'validator';

// import { translate } from 'translator';
import moment from 'moment';
import parse, { inPost } from './parse';
import { canPostEvent, canPostMandatoryEvent } from './privileges';
import {
  deleteEvent,
  saveEvent,
  eventExists,
  getEvent,
  Event,
} from './event';
import validateEvent from './validateEvent';
import { notify } from './reminders';
import { getSetting } from './settings';
import { filter__post_save } from './hooks';

const { fireHook } = require.main?.require('./src/plugins');
const { getTopicField } = require.main?.require('./src/topics');
const { getPostField } = require.main?.require('./src/posts');
const winston = require.main?.require('winston');

// imports for Discord Webhook + base url + moment localization
const meta = require.main?.require('./src/meta');
const nconf = require.main?.require('nconf');
const Discord = require.main?.require('discord.js');

const isMainPost = async (pid: number, tid: number) => {
  const mainPid = await getTopicField(tid, 'mainPid');
  return mainPid === pid;
};

const postSave: filter__post_save = async (data) => {
  const { post } = data;
  const eventInfo = parse(post.content);

  const uid = post.uid || post.editor || data.uid || 0;
  const pid = parseInt(post.pid || data.data.pid || '', 10);
  const tid = parseInt(post.tid || await getPostField(pid, 'tid'), 10);

  // delete event if no longer in post
  if (!post.content.match(inPost)) {
    const existed = await eventExists(pid);
    if (existed) {
      const existingEvent = await getEvent(pid);
      await notify({
        event: existingEvent,
        message: `[[calendar:event_deleted, ${existingEvent.name}]]`,
      });

      await deleteEvent({ post: { pid } });
      winston.verbose(`[plugin-calendar] Event (pid:${pid}) deleted`);
    }

    return data;
  }

  const invalid = () => {
    post.content = post.content.replace(/\[(\/?)event\]/g, '[$1event-invalid]');
    return data;
  };

  if (!eventInfo) {
    return invalid();
  }

  const [failed, failures] = validateEvent(eventInfo);
  if (failed) {
    const obj = Object.fromEntries(failures.map(failure => [failure, failure === 'repeatEndDate' ? eventInfo.repeats?.endDate : eventInfo[failure]]));

    winston.verbose(`[plugin-calendar] Event (pid:${pid}) validation failed: `, obj);
    return invalid();
  }

  const main = post.isMain || data.data.isMain || await isMainPost(pid, tid);
  if (!main && await getSetting('mainPostOnly')) {
    return invalid();
  }

  if (!await canPostEvent(tid, uid)) {
    return invalid();
  }

  if (eventInfo.mandatory && !await canPostMandatoryEvent(tid, uid)) {
    return invalid();
  }

  let event: Event = {
    ...eventInfo,
    name: validator.escape(eventInfo.name),
    location: eventInfo.location.trim(),
    description: eventInfo.description.trim(),
    uid,
    pid,
  };

  event = await fireHook('filter:plugin-calendar.event.post', event);

  if (event) {
    await saveEvent(event);
    winston.verbose(`[plugin-calendar] Event (pid:${pid}) saved`);

    // If Discord notifications enabled in ACP, send message to Discord Webhook
    if (await getSetting('enableDiscordNotifications')) {
      const url = await getSetting('discordWebhookUrl');
      let hook = null;
      const match = url.match(/https:\/\/discord(?:app)?\.com\/api\/webhooks\/([0-9]+?)\/(.+?)$/);

      // Create Discord WebhookClient
      if (match) {
        hook = new Discord.WebhookClient(match[1], match[2]);
      }
      if (hook) {
        const forumURL = nconf.get('url');
        const momentLang = meta.config.defaultLang.toLowerCase().replace(/_/g, '-');
        moment.locale(momentLang);
        const startDate = moment(event.startDate).format('LLLL');
        const endDate = moment(event.endDate).format('LLLL');
        // const startLabel = translate('[[calendar:start_date]]');
        // const endLabel = translate('[[calendar:end_date]]');
        hook.send('', {
          embeds: [
            {
              title: event.name,
              description: event.description,
              url: `${forumURL}/topic/${tid}`,
              color: 14202131,
              thumbnail: {
                url: 'https://cdn4.iconfinder.com/data/icons/small-n-flat/24/calendar-512.png',
              },
              fields: [
                {
                  name: 'test',
                  value: startDate,
                },
                {
                  name: 'test',
                  value: endDate,
                },
              ],
            },
          ],
        });
        winston.verbose(`[plugin-calendar] Discord Notification for Event (pid:${pid}) sent.`);
      }
    }
  }

  return data;
};

export { postSave };
