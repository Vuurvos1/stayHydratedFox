const tmi = require('tmi.js');
const api = require('twitch-api-v5');
require('dotenv').config();

api.clientID = process.env.TW_CLIENT_ID;

const usernames = [
  'Firefox__',
  'Wilbo__',
  'bueffel213',
  'adamantlte',
  'lucinovic14',
  'baister09',
  'doubledubbel',
  'riekelt',
  'rdvvstheworld',
  // 'msushi100',
  // 'canteven',
];

// Store user ids
const userIdList = {};
let userIdArr = [];

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
  console.log(userIdArr);

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

  // console.log(target);

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
    console.log(`* Executed ${commandName} command`);
  } else {
    // console.log(`* Unknown command ${commandName}`);
  }
}
// Function called when the "dice" command is issued
function rollDice() {
  const sides = 6;
  return Math.floor(Math.random() * sides) + 1;
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

  // console.log(res);
  let timeStart = new Date(y.stream.created_at);
  // console.log(timeStart);

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
    water = `${water} L `;
  } else {
    water = `${water} mL `;
  }

  return `You have been live for ${liveTime}and should have consumed at least ${water} of water to maintain optimal hydration! 💦`;
}

// Called every time the bot connects to Twitch chat
function onConnectedHandler(addr, port) {
  console.log(`* Connected to ${addr}:${port}`);
}

// const userIdArr = Object.values(userIdList);
// console.log(userIdArr);

// ping all streams
function pingStreamUp() {
  api.streams.live({ channel: userIdArr.join() }, (err, res) => {
    if (err) {
      console.log(err);
    } else {
      console.log(res);

      for (let i of res.streams) {
        let dateUTC = new Date();
        dateUTC.getUTCDate();
        // console.log(dateUTC);

        // console.log(res);
        let timeStart = new Date(i.created_at);
        // console.log(timeStart);

        let streamTime = Math.floor(dateUTC - timeStart);
        // let streamTime2 = streamTime;
        console.log(streamTime);
        const hourMs = 1000 * 60 * 60;

        let timeTilReminder = hourMs - (streamTime % hourMs);
        let hoursLive = Math.ceil(streamTime / hourMs);

        console.log(
          `sending reminder to ${i.channel.name} in ${timeTilReminder} ms, ${hoursLive} hour live`
        );

        setTimeout(() => {
          console.log(
            `sending reminder to ${i.channel.name} in ${timeTilReminder} ms, ${hoursLive} hour live`
          );
          sendReminder(timeTilReminder, i.channel.name, hoursLive);
        }, timeTilReminder);
        // setTimeout(() => {
        //   sendReminder(timeTilReminder, i.channel.name, hoursLive);
        // }, 5000);
      }
    }
  });
}

// pingStreamUp();

function sendReminder(time, userName, hours) {
  //send msg
  console.log(
    `sendReminder: time ${time}, userName ${userName}, hours ${hours}`
  );

  let water = hours * 120;
  if (hours === 1) {
    hours = `${hours} hour`;
  } else {
    hours = `${hours} hours`;
  }
  console.log(`send reminder to ${userName}`);
  let x = `You have been live for ${hours} and should have consumed at least ${water} of water to maintain optimal hydration! 💦`;
  client.say(userName, x);
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

// add water/hydrate fact command?

// code loop
const minutes = 5,
  the_interval = minutes * 60 * 1000;
setInterval(function () {
  console.log('I am doing my 5 minutes check');
  // do your stuff here

  // pingStreamUp();

  // set timouts if if statement
  // should contain stream id and if statement if still live
}, the_interval);
