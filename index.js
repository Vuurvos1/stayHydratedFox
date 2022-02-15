require('dotenv').config();
const tmi = require('tmi.js');
const api = require('twitch-api-v5');

api.clientID = process.env.TW_CLIENT_ID;
const usernames = process.env.TW_CHANNELS.split(',');

// Store user ids
const userIdList = {};
let userIdArr = [];

let liveChannels = [];
let msgQueue = [];
const hourMs = 60000 * 60; // ms in a hour

api.users.usersByName(
  {
    users: usernames,
  },
  (err, res) => {
    if (err) {
      console.log(err);
    } else {
      console.log(`Found ${res._total} channels`);
      for (let user of res.users) {
        userIdList[user.name] = user._id;
      }
    }

    if (Object.keys(userIdList).length > usernames.length) {
      throw new Error('More usernames where fetched than defined in .env');
    }

    userIdArr = Object.values(userIdList);

    pingStreamUp();
  }
);

// Define configuration options
const opts = {
  identity: {
    username: process.env.TW_USERNAME,
    password: process.env.TW_OAUTH,
  },
  channels: usernames,
};
// Create a client with our options
const client = new tmi.client(opts);

// Register our event handlers (defined below)
client.on('connected', onConnectedHandler);

// Connect to Twitch:
client.connect();

// Called every time the bot connects to Twitch chat
function onConnectedHandler(addr, port) {
  console.log(`Connected to ${addr}:${port}`);
}

// ping all streams
async function pingStreamUp() {
  try {
    api.streams.live(
      {
        channel: userIdArr.join(),
      },
      (err, res) => {
        if (res) {
          if (!res.streams.length > 0) {
            return;
          }

          liveChannels = [];

          for (let stream of res.streams) {
            const streamTime = Math.floor(
              new Date() - new Date(stream.created_at)
            );
            const timeTilReminder = hourMs - (streamTime % hourMs);
            const hoursLive = Math.ceil(streamTime / hourMs);
            const streamName = stream.channel.name;

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
        } else {
          console.log(err);
        }
      }
    );
  } catch (error) {
    console.log(error);
  }
}

function sendReminder(userName, hours) {
  // remove from message queue
  const x = msgQueue.indexOf(userName);
  if (x > -1) {
    // remove user if not in the msgQueue
    msgQueue.splice(x, 1);
  }

  if (liveChannels.includes(userName)) {
    // calculate hours and water amount
    let water = hours * 120;

    hours = `${hours} ${hours == 1 ? 'hour' : 'hours'}`;
    water = water >= 1000 ? `${Math.round(water / 100) / 10} L` : `${water} mL`;

    // send message to user
    console.log(`Send reminder to ${userName} for ${hours} live`);
    client.say(
      userName,
      `You have been live for ${hours} and should have consumed at least ${water} of water to maintain optimal hydration! 💦`
    );
  }
}

// code loop
const interval = 5 * 60000; // 5 min
setInterval(() => {
  pingStreamUp();
}, interval);
