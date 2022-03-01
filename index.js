require('dotenv').config();
const tmi = require('tmi.js');
const fetch = require('node-fetch');

const { CLIENT_ID, CLIENT_SECRET, CHANNELS, TW_OAUTH, USERNAME } = process.env;

const usernames = CHANNELS.split(',');
const userQuery = `user_login=${usernames.join('&user_login=')}`;

let liveChannels = [];
let msgQueue = [];
const hourMs = 60000 * 60; // ms in a hour

// Define configuration options
const opts = {
  identity: {
    username: USERNAME,
    password: TW_OAUTH,
  },
  channels: usernames,
};
// Create a client with our options
const client = new tmi.client(opts);

// Register our event handlers (defined below)
client.on('connected', onConnectedHandler);

// Connect to Twitch
client.connect();

// Called every time the bot connects to Twitch chat
function onConnectedHandler(addr, port) {
  console.log(`Connected to ${addr}:${port}`);
}

// ping all streams
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

    if (channels.length < 0) {
      return; // no channels live
    }

    liveChannels = [];
    for (let stream of channels) {
      const streamTime = Math.floor(new Date() - new Date(stream.started_at));
      const timeTilReminder = hourMs - (streamTime % hourMs);
      const hoursLive = Math.ceil(streamTime / hourMs);
      const streamName = stream.user_name;
      liveChannels.push(streamName);
      if (!msgQueue.includes(streamName)) {
        msgQueue.push(streamName);
        console.log(
          `Sending reminder to ${streamName} in ${(
            timeTilReminder / 60000
          ).toFixed(2)} min, ${hoursLive} hour live`
        );
        setTimeout(() => {
          sendReminder(streamName, hoursLive);
        }, timeTilReminder);
      }
    }
  } catch (error) {
    console.log(error);
  }
}

function sendReminder(username, hours) {
  // remove from message queue
  const index = msgQueue.indexOf(username);
  if (index > -1) {
    msgQueue.splice(index, 1); // remove user if not in the msgQueue
  }

  if (liveChannels.includes(username)) {
    // calculate hours and water amount
    let water = hours * 120;

    hours = `${hours} ${hours == 1 ? 'hour' : 'hours'}`;
    water = water >= 1000 ? `${Math.round(water / 100) / 10} L` : `${water} mL`;

    // send message to user
    console.log(`Send reminder to ${username} for ${hours} live`);
    client.say(
      username,
      `You have been live for ${hours} and should have consumed at least ${water} of water to maintain optimal hydration! 💦`
    );
  }
}

// main code loop
pingStreamUp();
setInterval(() => {
  pingStreamUp();
}, 5 * 60000); // 5 minutes

async function getAccessToken() {
  const url = `https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`;
  const res = await fetch(url, { method: 'POST' });
  return await res.json();
}
