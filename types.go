package main

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
