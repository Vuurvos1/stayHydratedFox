package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gempir/go-twitch-irc/v2"
	"github.com/joho/godotenv"
)

type TokenResponse struct {
	AccessToken string `json:"access_token"`
}

type StreamsResponse struct {
	Data []Stream `json:"data"`
}

type Stream struct {
	UserID    string `json:"user_id"`
	UserName  string `json:"user_name"`
	StartedAt string `json:"started_at"`
}

const MINUTE = 60 * time.Second
const HOUR = 60 * MINUTE

var client *twitch.Client

var liveChannels = make(map[string]bool)
var messageQueue = make(map[string]bool)

func main() {
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

	ticker := time.NewTicker(5 * MINUTE)
	quit := make(chan struct{})
	go func() {
		for {
			select {
			case <-ticker.C:
				// looping logic

				// fetch and set streams
				token := getAccessToken(envs["CLIENT_ID"], envs["CLIENT_SECRET"])
				channels := fetchStreams(userQuery, envs["CLIENT_ID"], token)

				liveChannels = make(map[string]bool)
				for _, channel := range channels {
					liveChannels[channel.UserName] = true

					if messageQueue[channel.UserName] {
						continue // skip if already in queue
					}

					t, err := time.Parse(time.RFC3339, channel.StartedAt)
					if err != nil {
						fmt.Println("Error parsing time", err)
					}

					streamTime := time.Since(t)
					timeTilReminder := HOUR - (streamTime % HOUR)
					hoursLive := math.Ceil(streamTime.Hours())

					messageQueue[channel.UserName] = true

					time.AfterFunc(timeTilReminder, func() {
						sendReminder(channel.UserName, int(hoursLive))
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

func fetchStreams(users string, clientId string, token string) []Stream {
	req, err := http.NewRequest("GET", "https://api.twitch.tv/helix/streams?"+users, nil)
	req.Header.Set("Client-ID", clientId)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Println("Error fetching streams token", err)
	}

	defer resp.Body.Close()

	data := StreamsResponse{}
	err = json.NewDecoder(resp.Body).Decode(&data)
	if err != nil {
		fmt.Println("Error unmarshalling json", err)
	}

	liveChannels = make(map[string]bool)
	for _, channel := range data.Data {
		liveChannels[channel.UserName] = true
	}

	return data.Data
}

func sendReminder(channel string, hoursLive int) {
	delete(messageQueue, channel) // remove channel from liveChannels

	if _, ok := liveChannels[channel]; !ok {
		return
	}

	water := hoursLive * 120

	var waterText string
	if water >= 1000 {
		waterText = fmt.Sprintf("%.1f L", float32(water)/1000)
	} else {
		waterText = strconv.Itoa(water) + " mL"
	}

	var hourString string
	if hoursLive == 1 {
		hourString = "hour"
	} else {
		hourString = "hours"
	}

	message := "You have been live for " + strconv.Itoa(hoursLive) + " " + hourString + " and should have consumed at least " + waterText + " of water to maintain optimal hydration! 💦"
	fmt.Println("Send reminder to " + channel + " for " + strconv.Itoa(hoursLive) + " hour(s) live")

	client.Say(channel, message)
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

	// TODO: use expires in instead of always getting a new token
	res := TokenResponse{}
	json.NewDecoder(resp.Body).Decode(&res)

	return res.AccessToken
}
