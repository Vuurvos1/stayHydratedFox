import 'dotenv/config';
import tmi from 'tmi.js';
import fetch from 'node-fetch';

const { CLIENT_ID, CLIENT_SECRET, CHANNELS, TW_OAUTH, USERNAME } = process.env;

const usernames = CHANNELS.split(',');
const userQuery = `user_login=${usernames.join('&user_login=')}`;

let liveChannels = []; // Channels that are live
let msgQueue = []; // Array to keep track of queued messages
const MINUTE = 60 * 1000; // ms in a minute
const HOUR = 60 * MINUTE; // ms in a hour

// Define tmi configuration options
const options = {
  identity: {
    username: USERNAME,
    password: TW_OAUTH,
  },
  channels: usernames,
};

const client = new tmi.client(options); // Create a tmi client

// Called every time the bot connects to Twitch chat
client.on('connected', (addr, port) => {
  console.log(`Connected to ${addr}:${port}`);
});

client.connect(); // Connect to Twitch

// See which streams are currently live
async function pingStreamUp() {
  try {
    const token = await getAccessToken();

    const url = `https://api.twitch.tv/helix/streams?${userQuery}`;
    const res = await fetch(url, {
      headers: {
        'Client-ID': CLIENT_ID,
        Authorization: `Bearer ${token.access_token}`,
      },
    });

    const json = await res.json();
    const channels = json.data;

    if (channels.length < 1) {
      return; // No channels live
    }

    liveChannels = [];
    for (const stream of channels) {
      const { started_at, user_name } = stream;
      const streamTime = Math.floor(new Date() - new Date(started_at));
      const timeTilReminder = HOUR - (streamTime % HOUR);
      const hoursLive = Math.ceil(streamTime / HOUR);
      liveChannels.push(user_name);
      if (!msgQueue.includes(user_name)) {
        msgQueue.push(user_name);

        setTimeout(() => {
          sendReminder(user_name, hoursLive);
        }, timeTilReminder);
      }
    }
  } catch (error) {
    console.log(error);
  }
}

// Send hydration reminder to streamer
function sendReminder(username, hours) {
  // Remove user from message queue
  msgQueue = msgQueue.filter((user) => user !== username);

  if (liveChannels.includes(username)) {
    // Calculate hours and water amount
    const water = hours * 120;
    const waterText =
      water >= 1000 ? `${Math.round(water / 100) / 10} L` : `${water} mL`;

    // Send message to user
    console.log(`Send reminder to ${username} for ${hours} hour(s) live`);
    client.say(
      username,
      `You have been live for ${hours} ${
        hours === 1 ? 'hour' : 'hours'
      } and should have consumed at least ${waterText} of water to maintain optimal hydration! 💦`
    );
  }
}

pingStreamUp(); // See which streams are live
setInterval(() => {
  pingStreamUp();
}, 5 * MINUTE); // Check which streams are live every 5 minutes

async function getAccessToken() {
  const url = `https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`;
  const res = await fetch(url, { method: 'POST' });
  return await res.json();
}
