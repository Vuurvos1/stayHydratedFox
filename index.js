const tmi = require('tmi.js');
const api = require('twitch-api-v5');
require('dotenv').config();

api.clientID = process.env.TW_CLIENT_ID;

const usernames = [
  'Wilbo__',
  'riekelt',
  'adamantlte',
  'bakenwake42',
  'reeverm',
  'baister09',
  'Firefox__',
  'doubledubbel',
  'rdvvstheworld',
  'bueffel213',
  'lucinovic14',
  // 'msushi100',
  // 'canteven',
];

// Store user ids
const userIdList = {};
let userIdArr = [];
let liveChannels = [];
let msgQueue = [];

api.users.usersByName({ users: usernames }, (err, res) => {
  if (err) {
    console.log(err);
  } else {
    console.log(`found ${res._total} channels`);
    for (let i of res.users) {
      userIdList[i.name] = i._id;
    }
  }
  console.log(userIdList);
  userIdArr = Object.values(userIdList);

  pingStreamUp();
});

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
  if (self) {
    return;
  } // Ignore messages from the bot

  // Remove whitespace from chat message
  const commandName = msg.trim();

  // If the command is known, let's execute it
  switch (commandName) {
    case '!hydrate':
      const hydration = await hydrate(target);
      client.say(target, `${hydration}`);
      console.log(`* Executed ${commandName} command`);
      break;
  }
}

async function hydrate(user) {
  let str = user.slice(1).toLowerCase();
  console.log(str);
  let y = await getUptime(userIdList[str]);
  console.log(y);
  console.log(y.stream);

  if (y.stream == null) {
    return `Yikes this streamer ain't live, but you should still stay hydrated!`;
  }

  let dateUTC = new Date();
  dateUTC.getUTCDate();
  console.log(dateUTC);

  let timeStart = new Date(y.stream.created_at);

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
    water = `${water} mL`;
  }

  return `You have been live for ${liveTime} and should have consumed at least ${water} of water to maintain optimal hydration! 💦`;
}

// Called every time the bot connects to Twitch chat
function onConnectedHandler(addr, port) {
  console.log(`* Connected to ${addr}:${port}`);
}

// ping all streams
function pingStreamUp() {
  api.streams.live({ channel: userIdArr.join() }, (err, res) => {
    if (err) {
      console.log(err);
    } else {
      liveChannels = [];

      for (let i of res.streams) {
        let dateUTC = new Date();
        dateUTC.getUTCDate();
        let timeStart = new Date(i.created_at);
        let streamTime = Math.floor(dateUTC - timeStart);
        const hourMs = 60000 * 60; // ms in a hour

        let timeTilReminder = hourMs - (streamTime % hourMs);
        let hoursLive = Math.ceil(streamTime / hourMs);

        liveChannels.push(i.channel.name);

        if (!msgQueue.includes(i.channel.name)) {
          msgQueue.push(i.channel.name);
          console.log(
            `sending reminder to ${i.channel.name} in ${timeTilReminder} ms, ${hoursLive} hour live`
          );

          setTimeout(() => {
            sendReminder(timeTilReminder, i.channel.name, hoursLive);
          }, timeTilReminder);
        }
      }

      console.log(`Currently live channels: ${liveChannels.join(', ')}`);
      console.log(`msgQueue constain: ${msgQueue}`);
    }
  });
}

function sendReminder(time, userName, hours) {
  //send msg
  if (liveChannels.includes(userName)) {
    // remove from arrays queue
    let index = liveChannels.indexOf(userName);
    if (index > -1) {
      liveChannels.splice(index, 1);
      console.log(
        `removed ${userName} from liveChannels, liveChannels: ${liveChannels}`
      );
    }

    let index2 = msgQueue.indexOf(userName);
    if (index2 > -1) {
      msgQueue.splice(index2, 1);
      console.log(`removed ${userName} from msgQueue, msgQueue: ${msgQueue}`);
    }

    let water = hours * 120;
    if (hours === 1) {
      hours = `${hours} hour`;
    } else {
      hours = `${hours} hours`;
    }

    if (water >= 1000) {
      water = Math.round((water / 1000) * 10) / 10;
      water = `${water} L`;
    } else {
      water = `${water} mL`;
    }

    console.log(`send reminder to ${userName} who has been live for ${hours}`);
    let x = `You have been live for ${hours} and should have consumed at least ${water} of water to maintain optimal hydration! 💦`;
    client.say(userName, x);
  }
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
  let day, hour, minute, seconds;
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

// code loop
const interval = 5 * 60000; // 5 min
setInterval(function () {
  console.log('5 minute up check');
  pingStreamUp();
}, interval);

// add water/hydrate fact command?
