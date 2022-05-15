import 'dotenv/config';
import tmi from 'tmi.js';
import fetch from 'node-fetch';

const { CLIENT_ID, CLIENT_SECRET, CHANNELS, TW_OAUTH, USERNAME } = process.env;

const usernames = CHANNELS.split(',');
const userQuery = `user_login=${usernames.join('&user_login=')}`;

let liveChannels = []; // Channels that are live
let msgQueue = []; // Array to keep track of queued messages
const hourMs = 60000 * 60; // miliseconds in a hour

// Define tmi configuration options
const options = {
  identity: {
    username: USERNAME,
    password: TW_OAUTH,
  },
  channels: usernames,
};
// Create a tmi client with our options
const client = new tmi.client(options);

// Called every time the bot connects to Twitch chat
client.on('connected', (addr, port) => {
  console.log(`Connected to ${addr}:${port}`);
});

// Connect to Twitch
client.connect();

// Check which streams are currently live
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

// Send hydration reminder to streamer
function sendReminder(username, hours) {
  // Remove user from message queue
  msgQueue = msgQueue.filter((user) => user !== username);

  if (liveChannels.includes(username)) {
    // Calculate hours and water amount
    let water = hours * 120;

    hours = `${hours} ${hours == 1 ? 'hour' : 'hours'}`;
    water = water >= 1000 ? `${Math.round(water / 100) / 10} L` : `${water} mL`;

    // Send message to user
    console.log(`Send reminder to ${username} for ${hours} live`);
    client.say(
      username,
      `You have been live for ${hours} and should have consumed at least ${water} of water to maintain optimal hydration! 💦`
    );
  }
}

pingStreamUp(); // See which streams are live
setInterval(() => {
  pingStreamUp();
}, 5 * 60000); // Continue check which streams are live every 5 minutes

async function getAccessToken() {
  const url = `https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`;
  const res = await fetch(url, { method: 'POST' });
  return await res.json();
}
