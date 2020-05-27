const tmi = require('tmi.js');
const api = require('twitch-api-v5');
require('dotenv').config();

api.clientID = process.env.TW_CLIENT_ID;

// Define configuration options
const opts = {
  identity: {
    username: process.env.TW_USERNAME,
    password: process.env.TW_OAUTH,
  },
  channels: ['Firefox__', 'Wilbo__', 'adamantlte', 'baister09'],
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
  if (self) {
    return;
  } // Ignore messages from the bot

  //   console.log(msg);
  //   console.log(target);

  // Remove whitespace from chat message
  const commandName = msg.trim();

  // If the command is known, let's execute it
  if (commandName === '!dice') {
    const num = rollDice();
    client.say(target, `You rolled a ${num}`);
    console.log(`* Executed ${commandName} command`);
  } else if (commandName === '!hydrate') {
    const hydration = await hydrate(target);
    console.log(hydration);
    client.say(target, `${hydration}`);
  } else {
    console.log(`* Unknown command ${commandName}`);
  }
}
// Function called when the "dice" command is issued
function rollDice() {
  const sides = 6;
  return Math.floor(Math.random() * sides) + 1;
}

async function hydrate(user) {
  let str = user.slice(1);
  console.log(str);

  let x = await getUserId(str);
  console.log(x);
  x = x.users[0]._id;
  console.log(x);
  let y = await getUptime(x);
  console.log(y);
  console.log(y.stream);

  if (y.stream == null) {
    return `Yikes this streamer ain't live, but you should still stay hydrated!`;
  }

  let dateUTC = new Date();
  dateUTC.getUTCDate();
  console.log(dateUTC);

  // console.log(res);
  let timeStart = new Date(y.stream.created_at);
  //   console.log(timeStart);

  let streamTime = Math.floor(dateUTC - timeStart);
  let streamTime2 = streamTime;
  console.log(streamTime2);

  // 2 ml a minute
  let hydrationAmountMin = 2;

  streamTime = convertMS(streamTime);

  let liveTime = '';
  let hours = streamTime.day * 12 + streamTime.hour;
  let min = streamTime.minute;

  if (hours == 1) {
    liveTime += `1 hour `;
  } else if (hours != 0) {
    liveTime += `${hours} hours `;
  }

  if (min == 1) {
    liveTime += `1 minute `;
  } else if (min != 0) {
    liveTime += `${min} minutes `;
  }

  console.log(liveTime);

  let water = Math.floor(hydrationAmountMin * (streamTime2 / 1000 / 60));
  if (water >= 1000) {
    water = Math.round((water / 1000) * 10) / 10;
    water = `${water} L`;
  } else {
    water = `${water} mL `;
  }

  return `You have been live for more than ${liveTime}and you should have consumed at least ${water} of water to maintain optimal hydration! 💦`;
}

// Called every time the bot connects to Twitch chat
function onConnectedHandler(addr, port) {
  console.log(`* Connected to ${addr}:${port}`);
}

// code loop
const minutes = 5,
  the_interval = minutes * 60 * 1000;
setInterval(function () {
  console.log('I am doing my 5 minutes check');
  // do your stuff here
}, the_interval);

async function getUserId(userName) {
  let promise = new Promise(function (resolve, reject) {
    api.users.usersByName({ users: userName }, (err, res) => {
      if (err) {
        console.log(err);
      } else {
        resolve(res);
      }
    });
  });

  return promise;
}

async function getUptime(id) {
  let promise = new Promise(function (resolve, reject) {
    api.streams.channel({ channelID: id }, (err, res) => {
      if (err) {
        console.log(err);
      } else {
        resolve(res);
      }
    });
  });

  return promise;
}

function convertMS(milliseconds) {
  var day, hour, minute, seconds;
  seconds = Math.floor(milliseconds / 1000);
  minute = Math.floor(seconds / 60);
  seconds = seconds % 60;
  hour = Math.floor(minute / 60);
  minute = minute % 60;
  day = Math.floor(hour / 24);
  hour = hour % 24;
  return {
    day: day,
    hour: hour,
    minute: minute,
    seconds: seconds,
  };
}
