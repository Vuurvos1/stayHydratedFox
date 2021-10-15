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
      for (let i of res.users) {
        userIdList[i.name] = i._id;
      }
    }
    console.log(userIdList);
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
client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

// Connect to Twitch:
client.connect();

// Called every time a message comes in
async function onMessageHandler(target, context, msg, self) {
  // enable this is you also want the bot to listen to commands
  //
  // Ignore messages from the bot
  // if (self) {
  //   return;
  // }
  //
  // Remove whitespace from chat message
  // const commandName = msg.trim();
}

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
          liveChannels = [];

          for (let i of res.streams) {
            const streamTime = Math.floor(new Date() - new Date(i.created_at));
            const timeTilReminder = hourMs - (streamTime % hourMs);
            const hoursLive = Math.ceil(streamTime / hourMs);

            liveChannels.push(i.channel.name);

            if (!msgQueue.includes(i.channel.name)) {
              msgQueue.push(i.channel.name);
              console.log(
                `Sending reminder to ${i.channel.name} in ${(
                  timeTilReminder / 60000
                ).toFixed(2)} min, ${hoursLive} hour live`
              );

              setTimeout(() => {
                sendReminder(i.channel.name, hoursLive);
              }, timeTilReminder);
            }
          }

          const date = new Date();
          console.log(
            `${date.getHours()}:${('0' + date.getMinutes()).slice(
              -2
            )} Currently live: ${liveChannels.join(', ')}`
          );
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
    // Calculate hours and water amount
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
