package main

import (
	"encoding/json"
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
	ExpiresIn   int    `json:"expires_in"`
	TokenType   string `json:"token_type"`
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

var liveChannels = make(map[string]time.Time)
var messageQueue = make(map[string]bool)

var accessToken = ""

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
			// looping logic
			case <-ticker.C:
				// fetch and set streams
				channels := fetchStreams(userQuery, envs["CLIENT_ID"], envs["CLIENT_SECRET"])

				// for every item in livechannels, check if it's still live
				for channel, _ := range liveChannels {
					found := false
					for _, stream := range channels {
						if stream.UserName == channel {
							found = true
							break
						}
					}

					if !found {
						delete(liveChannels, channel)
					}
				}

				// liveChannels = make(map[string]bool)
				for _, channel := range channels {
					if _, ok := liveChannels[channel.UserName]; !ok {
						t, err := time.Parse(time.RFC3339, channel.StartedAt)
						if err != nil {
							log.Panic("Error parsing time", err)
						}
						liveChannels[channel.UserName] = t
					}

					streamTime := time.Since(liveChannels[channel.UserName])

					if messageQueue[channel.UserName] {
						continue // skip if already in queue
					}

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

	client.OnConnect(func() {
		log.Println("Successfully connected to Twitch!")
	})

	// Connect to the Twitch IRC
	err = client.Connect()
	if err != nil {
		panic(err)
	}
}

func fetchStreams(users string, clientId string, clientSecret string) []Stream {
	req, err := http.NewRequest("GET", "https://api.twitch.tv/helix/streams?"+users, nil)
	req.Header.Set("Client-ID", clientId)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)

	// if 401 Unauthorized, get new token and try again
	if resp.StatusCode == 401 {
		accessToken = getAccessToken(clientId, clientSecret)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		resp, err = http.DefaultClient.Do(req)
	}

	if err != nil {
		log.Panic("Error fetching streams token", err)
	}

	defer resp.Body.Close()

	data := StreamsResponse{}
	err = json.NewDecoder(resp.Body).Decode(&data)
	if err != nil {
		log.Panic("Error unmarshalling json", err)
	}

	return data.Data
}

func sendReminder(channel string, hoursLive int) {
	delete(messageQueue, channel) // remove channel from liveChannels

	if _, ok := liveChannels[channel]; !ok {
		return // skip if not live
	}

	water := hoursLive * 120

	var waterText string
	if water >= 1000 {
		waterText = strconv.FormatFloat(float64(water)/1000, 'f', 1, 64) + " L"
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
	log.Println("Send reminder to " + channel + ", " + strconv.Itoa(hoursLive) + " hour(s) live")

	client.Say(channel, message)
}

func getAccessToken(clientId string, clientSecret string) string {
	log.Println("Getting new access token")

	data := url.Values{
		"client_id":     {clientId},
		"client_secret": {clientSecret},
		"grant_type":    {"client_credentials"},
	}

	resp, err := http.PostForm("https://id.twitch.tv/oauth2/token", data)
	if err != nil {
		log.Panic("Error fetching getting access token", err)
	}

	res := TokenResponse{}
	json.NewDecoder(resp.Body).Decode(&res)

	return res.AccessToken
}
