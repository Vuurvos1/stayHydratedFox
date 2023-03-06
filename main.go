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

// var liveChannels = make(map[string]bool))
var liveChannels map[string]bool

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

	// liveChannels := map[string]bool{}
	// messageQueue := map[string]bool{}

	// Create a new client instance
	client := twitch.NewClient(envs["USERNAME"], envs["TW_OAUTH"])

	token := getAccessToken(envs["CLIENT_ID"], envs["CLIENT_SECRET"])
	fmt.Println(token)

	channels := pingStreams(userQuery, envs["CLIENT_ID"], token)
	fmt.Println(channels)

	ticker := time.NewTicker(5 * MINUTE)
	quit := make(chan struct{})
	go func() {
		for {
			select {
			case <-ticker.C:
				// looping logic
				fmt.Println("tick")

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

func pingStreams(users string, clientId string, token string) map[string]bool {
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

func sendReminder() {
	// client.Say("Firefox__", "Hello, World!")
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
