package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"time"

	"github.com/gempir/go-twitch-irc/v2"
	"github.com/joho/godotenv"
)

const MINUTE = 60 * time.Second
const HOUR = 60 * MINUTE

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

	// liveChannels := map[string]bool{}
	// messageQueue := map[string]bool{}

	// Create a new client instance
	client := twitch.NewClient(envs["USERNAME"], envs["TW_OAUTH"])

	// client.Say("Firefox__", "Hello, World!")

	token := getAccessToken(envs["CLIENT_ID"], envs["CLIENT_SECRET"])
	fmt.Println(token)

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

func pingStreams() {

}

func sendReminder() {

}

func getAccessToken(ClientId string, ClientSecret string) string {
	data := url.Values{
		"client_id":     {ClientId},
		"client_secret": {ClientSecret},
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
