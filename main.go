package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gempir/go-twitch-irc/v2"
	"github.com/joho/godotenv"
)

type Stream struct {
	UserID    string `json:"user_id"`
	UserName  string `json:"user_name"`
	StartedAt string `json:"started_at"`
}

const MINUTE = 60 * time.Second
const HOUR = 60 * MINUTE

var client *twitch.Client

// var liveChannels = make(map[string]bool))
var liveChannels map[string]bool
var messageQueue map[string]bool

func main() {
	fmt.Println("Hello, World!")

	var envs map[string]string
	envs, err := godotenv.Read(".env")
	godotenv.Load(".env")

	// ensure needed envs are set
	if envs["TW_OAUTH"] == "" {
		log.Fatal("TW_OAUTH not set")
	}

	if envs["CLIENT_ID"] == "" {
		log.Fatal("CLIENT_ID not set")
	}

	if envs["CLIENT_SECRET"] == "" {
		log.Fatal("CLIENT_SECRET not set")
	}

	if err != nil {
		log.Fatal("Error loading .env file")
	}

	usernames := strings.Split(envs["CHANNELS"], ",")
	userQuery := "user_login=" + strings.Join(usernames, "&user_login=")

	// Create a new client instance
	client = twitch.NewClient(envs["USERNAME"], envs["TW_OAUTH"])

	token := getAccessToken(envs["CLIENT_ID"], envs["CLIENT_SECRET"])
	fmt.Println(token)

	channels := fetchStreams(userQuery, envs["CLIENT_ID"], token)
	fmt.Println(channels)

	time.AfterFunc(5*time.Second, func() {
		// do stuff after 5 seconds

		if channels["channel"] {
			fmt.Println("channel is live")
		}
	})

	ticker := time.NewTicker(5 * MINUTE)
	quit := make(chan struct{})
	go func() {
		for {
			select {
			case <-ticker.C:
				// looping logic
				fmt.Println("tick")

				// fetch and set streams
				token := getAccessToken(envs["CLIENT_ID"], envs["CLIENT_SECRET"])
				fetchStreams(userQuery, envs["CLIENT_ID"], token)

				liveChannels = make(map[string]bool)

				for channel, _ := range liveChannels {
					liveChannels[channel] = true

					if messageQueue[channel] {
						continue // skip if already in queue
					}

					// send reminders
					// const streamTime = time.Since(time.Now());
					// get stream time
					// get time till reminder
					// get hours live

					messageQueue[channel] = true

					time.AfterFunc(5*time.Second, func() {
						// do stuff after 5 seconds
						sendReminder(channel, 5)
					})
				}

			case <-quit:
				ticker.Stop()
				return
			}
		}
	}()

	// Connect to the Twitch IRC
	err = client.Connect()
	if err != nil {
		panic(err)
	}
}

func fetchStreams(users string, clientId string, token string) map[string]bool {
	fmt.Println(users)

	req, err := http.NewRequest("GET", "https://api.twitch.tv/helix/streams?"+users, nil)
	req.Header.Set("Client-ID", clientId)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)

	if err != nil {
		fmt.Println("Error fetching streams token", err)
	}

	liveChannels = make(map[string]bool)

	// print body as stirng
	body, _ := ioutil.ReadAll(resp.Body)
	fmt.Println(string(body))

	// TODO: add better typing
	type Data struct {
		Data []Stream `json:"data"`
	}

	data := Data{}

	err = json.Unmarshal(body, &data)

	if err != nil {
		fmt.Println("Error unmarshalling json", err)
	}

	var res map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&res)

	for _, channel := range data.Data {
		fmt.Println(channel)
		liveChannels[channel.UserName] = true

		date, err := time.Parse(time.RFC3339, channel.StartedAt)
		if err != nil {
			fmt.Println("Error parsing time", err)
		}

		fmt.Println("Hours live:", time.Since(date))
	}

	fmt.Println(liveChannels)

	return liveChannels
}

func sendReminder(channel string, hoursLive int) {
	delete(messageQueue, channel) // remove channel from liveChannels

	if _, ok := liveChannels[channel]; !ok {
		return
	}

	// create message

	// client.Say(channel, "You have been live for: " + hoursLive)
}

func getAccessToken(clientId string, clientSecret string) string {
	data := url.Values{
		"client_id":     {clientId},
		"client_secret": {clientSecret},
		"grant_type":    {"client_credentials"},
	}

	url := "https://id.twitch.tv/oauth2/token"
	resp, err := http.PostForm(url, data)

	if err != nil {
		fmt.Println("Error fetching getting access token", err)
	}

	// TODO: add better typing
	// TODO: use expires in instead of always getting a new token
	var res map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&res)

	return res["access_token"].(string)
}
