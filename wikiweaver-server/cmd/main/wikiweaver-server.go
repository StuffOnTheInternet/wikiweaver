package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	PORT                            = 4242
	CODE_LENGTH                     = 4
	LOBBY_CLEANING_INTERVAL         = 15 * time.Minute
	LOBBY_IDLE_TIME_BEFORE_SHUTDOWN = 60 * time.Minute
	HISTORY_SEND_INTERVAL           = 200 * time.Millisecond
	WORDS_FILEPATH                  = "words.json"
	MAX_USERNAME_LEN                = 16
	MAX_USERS_PER_LOBBY             = 16
)

var Version = "dev"

type GlobalState struct {
	Lobbies map[string]*Lobby
	Words   []string
	UserIDs map[string]bool
	Rand    *rand.Rand
	mu      sync.Mutex
}

var globalState GlobalState

type WebClient struct {
	conn   *websocket.Conn
	isHost bool
	mu     sync.Mutex
}

type ExtClient struct {
	UserID     string
	Username   string
	Clicks     int
	Pages      int
	FinishTime time.Duration
	Page       string
	mu         sync.Mutex
}

type LobbyState int

const (
	Initial LobbyState = iota
	Reset   LobbyState = iota
	Started LobbyState = iota
	Ended   LobbyState = iota
)

type Lobby struct {
	Code                string
	State               LobbyState
	WebClients          []*WebClient
	ExtClients          []*ExtClient
	LastInteractionTime time.Time
	StartTime           time.Time
	Countdown           time.Duration
	StartPage           string
	GoalPage            string
	History             []PageToWebMessage
	mu                  sync.Mutex
}

func (l *Lobby) close() {
	for _, wc := range l.WebClients {
		wc.conn.Close()
	}
}

func (l *Lobby) hasHost() bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	for _, wc := range l.WebClients {
		if wc.isHost {
			return true
		}
	}

	return false
}

func (l *Lobby) TimeLeft() int {
	if l.State == Started {
		return int((l.Countdown - time.Since(l.StartTime)).Seconds())
	} else {
		return int(l.Countdown.Seconds())
	}
}

func (l *Lobby) Broadcast(v interface{}) {
	for _, wc := range l.WebClients {
		wc.sendWithWarningOnFail(v)
	}
}

func (l *Lobby) removeWebClient(wcToRemove *WebClient) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	index := -1
	for i, wc := range l.WebClients {
		if wc == wcToRemove {
			index = i
			break
		}
	}

	if index == -1 {
		return fmt.Errorf("internal server error: web client %v not found in list %v", wcToRemove, l.WebClients)
	}

	length := len(l.WebClients)

	l.WebClients[index] = l.WebClients[length-1]
	l.WebClients[length-1] = nil
	l.WebClients = l.WebClients[:length-1]

	return nil
}

func (l *Lobby) GetExtClientFromUsername(usernameToCheck string) *ExtClient {
	l.mu.Lock()
	defer l.mu.Unlock()
	for _, extClient := range l.ExtClients {
		if usernameToCheck == extClient.Username {
			return extClient
		}
	}

	return nil
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func generateUserID() string {
	globalState.mu.Lock()
	defer globalState.mu.Unlock()

	userID := strconv.FormatInt(globalState.Rand.Int63(), 16)
	for {
		if _, ok := globalState.UserIDs[userID]; !ok {
			break
		}

		userID = strconv.FormatInt(globalState.Rand.Int63(), 16)
	}

	globalState.UserIDs[userID] = true

	return userID
}

func generateRandomCode() string {
	LETTERS := "abcdefghijklmnopqrstuvxyz"

	b := make([]byte, CODE_LENGTH)

	for i := range b {
		b[i] = LETTERS[globalState.Rand.Intn(len(LETTERS))]
	}

	return string(b)
}

func generateCodeFromWords() string {
	return globalState.Words[globalState.Rand.Intn(len(globalState.Words))]
}

func generateUniqueCode() string {
	globalState.mu.Lock()
	defer globalState.mu.Unlock()

	codeGenerator := generateRandomCode
	if len(globalState.Words) >= 0 && len(globalState.Words) > len(globalState.Lobbies) {
		codeGenerator = generateCodeFromWords
	}

	code := codeGenerator()

	for {
		if _, ok := globalState.Lobbies[code]; !ok {
			break
		}

		code = codeGenerator()
	}

	return code
}

func lobbyCleaner() {
	for {
		time.Sleep(LOBBY_CLEANING_INTERVAL)

		globalState.mu.Lock()
		for code, lobby := range globalState.Lobbies {

			lobby.mu.Lock()
			idleTime := time.Since(lobby.LastInteractionTime).Round(time.Second)
			lobby.mu.Unlock()

			if idleTime >= LOBBY_IDLE_TIME_BEFORE_SHUTDOWN {
				log.Printf("lobby %s idle for %s, closing", code, idleTime)

				lobby.mu.Lock()
				for _, extClient := range lobby.ExtClients {
					delete(globalState.UserIDs, extClient.UserID)
				}
				lobby.close()
				lobby.mu.Unlock()

				delete(globalState.Lobbies, code)
			}
		}
		globalState.mu.Unlock()
	}
}

type Message struct {
	Type string
}

type PongMessage struct {
	Message
}

type LobbyToWebMessage struct {
	Message
	Code   string
	IsHost bool
}

func CreateLobby(code string) {
	globalState.mu.Lock()
	defer globalState.mu.Unlock()

	globalState.Lobbies[code] = &Lobby{
		Code:                code,
		State:               Initial,
		LastInteractionTime: time.Now(),
	}
}

func handleWebJoin(w http.ResponseWriter, r *http.Request) {

	code := r.URL.Query().Get("code")

	if code == "" {
		code = generateUniqueCode()
		CreateLobby(code)
		log.Printf("web client %s created lobby %s", r.RemoteAddr, code)
	}

	lobby := globalState.Lobbies[code]

	if lobby == nil {
		log.Printf("%s tried to join non existent lobby: %s", r.RemoteAddr, code)
		return
	}

	upgrader.CheckOrigin = func(r *http.Request) bool { return true }
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	shouldBeHost := !lobby.hasHost()
	wc := &WebClient{conn: conn, isHost: shouldBeHost}

	lobby.mu.Lock()
	lobby.LastInteractionTime = time.Now()
	lobby.WebClients = append(lobby.WebClients, wc)
	lobby.mu.Unlock()

	if shouldBeHost {
		log.Printf("web client %s joined lobby %s as host", conn.RemoteAddr(), lobby.Code)
	} else {
		log.Printf("web client %s joined lobby %s as spectator", conn.RemoteAddr(), lobby.Code)
	}

	msgResponse := LobbyToWebMessage{
		Message: Message{
			Type: "lobby",
		},
		Code:   lobby.Code,
		IsHost: wc.isHost,
	}

	err = wc.send(msgResponse)
	if err != nil {
		log.Printf("failed to send lobby message to %s: %s", wc.conn.RemoteAddr(), err)
	}

	go sendHistory(lobby, wc)

	go webClientListener(lobby, wc)
}

func sendHistory(lobby *Lobby, wc *WebClient) {
	lobby.mu.Lock()
	defer lobby.mu.Unlock()

	if lobby.State == Reset {
		resetMessage := ResetToWebMessage{
			Message: Message{
				Type: "reset",
			},
			Success: true,
		}

		wc.sendWithWarningOnFail(resetMessage)
	}

	for _, extClient := range lobby.ExtClients {
		// Ugly to construct the message like this...
		joinToWebMessage := JoinToWebMessage{
			Message: Message{
				Type: "join",
			},
			Username:   extClient.Username,
			Clicks:     extClient.Clicks,
			Pages:      extClient.Pages,
			FinishTime: int(extClient.FinishTime.Seconds()),
		}

		wc.sendWithWarningOnFail(joinToWebMessage)
	}

	if countdown := lobby.TimeLeft(); countdown > 0 {

		startMsg := StartToWebMessage{
			Message: Message{
				Type: "start",
			},
			Success:   true,
			StartPage: lobby.StartPage,
			GoalPage:  lobby.GoalPage,
			Countdown: lobby.TimeLeft(),
		}

		wc.sendWithWarningOnFail(startMsg)
	}

	if lobby.State == Ended {
		endMessage := EndToWebMessage{
			Message: Message{
				"end",
			},
			Success:   true,
			Countdown: int(lobby.Countdown.Seconds()),
		}

		wc.sendWithWarningOnFail(endMessage)
	}

	for _, pageToWebMessage := range lobby.History {
		wc.sendWithWarningOnFail(pageToWebMessage)
	}
}

func (wc *WebClient) send(v interface{}) error {
	wc.mu.Lock()
	defer wc.mu.Unlock()
	return wc.conn.WriteJSON(v)
}

func (wc *WebClient) sendWithWarningOnFail(v interface{}) {
	err := wc.send(v)
	if err != nil {
		log.Printf("failed to send message %+v to %s: %s", v, wc.conn.RemoteAddr(), err)
	}
}

type EndToWebMessage struct {
	Message
	Success   bool
	Countdown int
}

func HandleMessageEnd(lobby *Lobby, wc *WebClient, buf []byte) {
	lobby.mu.Lock()
	defer lobby.mu.Unlock()

	msgResponse := EndToWebMessage{
		Message: Message{
			"end",
		},
		Success: false,
	}

	if !wc.isHost {
		log.Printf("web client %s failed to end lobby: is not host", wc.conn.RemoteAddr())
		wc.sendWithWarningOnFail(msgResponse)
		return
	}

	if lobby.State != Started {
		log.Printf("web client %s failed to end lobby %s: lobby is not started", wc.conn.LocalAddr(), lobby.Code)
		wc.sendWithWarningOnFail(msgResponse)
		return
	}

	log.Printf("web client %s ended lobby %s", wc.conn.RemoteAddr(), lobby.Code)

	lobby.State = Ended
	lobby.StartTime = time.Time{}

	msgResponse = EndToWebMessage{
		Message: Message{
			"end",
		},
		Success:   true,
		Countdown: int(lobby.Countdown.Seconds()),
	}

	lobby.Broadcast(msgResponse)
}

func HandleMessagePing(lobby *Lobby, wc *WebClient, buf []byte) {
	pongMessage := PongMessage{
		Message: Message{
			Type: "pong",
		},
	}

	wc.sendWithWarningOnFail(pongMessage)
}

type ResetToWebMessage struct {
	Message
	Success bool
}

func HandleMessageReset(lobby *Lobby, wc *WebClient, buf []byte) {
	lobby.mu.Lock()
	defer lobby.mu.Unlock()

	msgResponse := ResetToWebMessage{
		Message: Message{
			"reset",
		},
		Success: false,
	}

	if !wc.isHost {
		log.Printf("web client %s failed to reset lobby %s: is not host", wc.conn.RemoteAddr(), lobby.Code)
		wc.sendWithWarningOnFail(msgResponse)
		return
	}

	log.Printf("web client %s reset lobby %s", wc.conn.RemoteAddr(), lobby.Code)

	for _, extClient := range lobby.ExtClients {
		delete(globalState.UserIDs, extClient.UserID)
	}

	lobby.State = Reset
	lobby.ExtClients = lobby.ExtClients[:0]
	lobby.LastInteractionTime = time.Now()
	lobby.StartTime = time.Time{}
	lobby.Countdown = time.Duration(0)
	lobby.StartPage = ""
	lobby.GoalPage = ""
	lobby.History = lobby.History[:0]

	msgResponse = ResetToWebMessage{
		Message: Message{
			Type: "reset",
		},
		Success: true,
	}

	lobby.Broadcast(msgResponse)
}

type StartFromWebMessage struct {
	Code      string
	StartPage string
	GoalPage  string
	Countdown int
}

type StartToWebMessage struct {
	Message
	Success   bool
	StartPage string
	GoalPage  string
	Countdown int
}

func HandleMessageStart(lobby *Lobby, wc *WebClient, buf []byte) {
	lobby.mu.Lock()
	defer lobby.mu.Unlock()

	msgResponse := StartToWebMessage{
		Message: Message{
			"start",
		},
		Success: false,
	}

	var msgRequest StartFromWebMessage

	err := json.Unmarshal(buf, &msgRequest)
	if err != nil {
		log.Printf("failed to parse start message from web: %s", err)
		wc.sendWithWarningOnFail(msgResponse)
		return
	}

	if msgRequest.Code != lobby.Code {
		log.Printf("web client %s failed to start lobby %s: web client is in another lobby %s", wc.conn.RemoteAddr(), msgRequest.Code, lobby.Code)
		wc.sendWithWarningOnFail(msgResponse)
		return
	}

	if msgRequest.Countdown <= 0 {
		log.Printf("web client %s failed to start lobby %s: invalid countdown %d", wc.conn.RemoteAddr(), lobby.Code, msgRequest.Countdown)
		wc.sendWithWarningOnFail(msgResponse)
		return
	}

	if !wc.isHost {
		log.Printf("web client %s failed to start lobby %s: is not host", wc.conn.RemoteAddr(), lobby.Code)
		wc.sendWithWarningOnFail(msgResponse)
		return
	}

	if lobby.State == Started {
		log.Printf("web client %s failed to start lobby %s: lobby already started", wc.conn.RemoteAddr(), lobby.Code)
		wc.sendWithWarningOnFail(msgResponse)
		return
	}

	lobby.State = Started
	lobby.StartTime = time.Now()
	lobby.StartPage = msgRequest.StartPage
	lobby.GoalPage = msgRequest.GoalPage
	lobby.Countdown = time.Duration(msgRequest.Countdown * int(time.Second))
	lobby.LastInteractionTime = time.Now()
	lobby.History = lobby.History[:0]

	for _, extClient := range lobby.ExtClients {
		extClient.Clicks = 0
		extClient.Pages = 0
		extClient.FinishTime = 0
		extClient.Page = lobby.StartPage
	}

	log.Printf("web client %s started lobby %s with pages '%s' to '%s' (%.0f seconds)", wc.conn.RemoteAddr(), lobby.Code, lobby.StartPage, lobby.GoalPage, lobby.Countdown.Seconds())

	msgResponse = StartToWebMessage{
		Message: Message{
			"start",
		},
		Success:   true,
		StartPage: lobby.StartPage,
		GoalPage:  lobby.GoalPage,
		Countdown: int(lobby.Countdown.Seconds()),
	}

	lobby.Broadcast(msgResponse)
}

func webClientListener(lobby *Lobby, wc *WebClient) {
	defer wc.conn.Close()

	for {
		_, buf, err := wc.conn.ReadMessage()
		if err != nil {
			log.Printf("web client %s disconnected from lobby %s\n", wc.conn.RemoteAddr(), lobby.Code)

			err = lobby.removeWebClient(wc)
			if err != nil {
				log.Printf("failed to remove web client: %s", err)
			}

			return
		}

		var msg Message
		err = json.Unmarshal(buf, &msg)
		if err != nil {
			log.Printf("failed to unmarshal message: %s", err)
			continue
		}

		if wc == nil {
			log.Printf("internal server error: wc is nil")
			return
		}

		if lobby == nil {
			log.Printf("internal server error: lobby is nil")
			return
		}

		switch msg.Type {

		case "end":
			HandleMessageEnd(lobby, wc, buf)

		case "ping":
			HandleMessagePing(lobby, wc, buf)

		case "reset":
			HandleMessageReset(lobby, wc, buf)

		case "start":
			HandleMessageStart(lobby, wc, buf)

		default:
			log.Printf("web client %s sent an unrecognized message: '%s'", wc.conn.RemoteAddr(), msg)
		}
	}
}

type JoinFromExtRequest struct {
	UserID   string
	Username string
	Code     string
}

type JoinToExtResponse struct {
	Success        bool
	UserID         string
	AlreadyInLobby bool
}

type JoinToWebMessage struct {
	Message
	Username   string
	Clicks     int
	Pages      int
	FinishTime int
}

func SendResponseToExt(w http.ResponseWriter, response interface{}) {
	w.Header().Set("Access-Control-Allow-Origin", "*")

	responseJSON, err := json.Marshal(response)
	if err != nil {
		log.Printf("failed to marshal response to extension (%+v): %s", response, err)
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte{})
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write(responseJSON)
}

func handleExtJoin(w http.ResponseWriter, r *http.Request) {
	failResponse := JoinToExtResponse{
		Success: false,
	}

	switch r.Method {
	case http.MethodPost:
		body, err := io.ReadAll(r.Body)
		if err != nil {
			log.Printf("error reading extension request: %s", err)
			SendResponseToExt(w, failResponse)
			return
		}

		var request JoinFromExtRequest
		err = json.Unmarshal(body, &request)
		if err != nil {
			log.Printf("failed to parse message from extension: %s", err)
			SendResponseToExt(w, failResponse)
			return
		}

		if len(request.Code) != CODE_LENGTH {
			log.Printf("extension %s tried to join invalid lobby %s", r.RemoteAddr, request.Code)
			SendResponseToExt(w, failResponse)
			return
		}

		if len(request.Username) <= 0 {
			log.Printf("extension %s tried to join with an empty username", r.RemoteAddr)
			SendResponseToExt(w, failResponse)
			return
		}

		if len(request.Username) > MAX_USERNAME_LEN {
			log.Printf("extension %s tried to join with a too long username %s", r.RemoteAddr, request.Username)
			SendResponseToExt(w, failResponse)
			return
		}

		lobby := globalState.Lobbies[request.Code]

		if lobby == nil {
			log.Printf("extension %s tried to join non-existing lobby %s", r.RemoteAddr, request.Code)
			SendResponseToExt(w, failResponse)
			return
		}

		otherWithSameUsername := lobby.GetExtClientFromUsername(request.Username)

		if otherWithSameUsername != nil {
			if otherWithSameUsername.UserID == request.UserID {
				successResponse := JoinToExtResponse{
					Success:        true,
					UserID:         request.UserID,
					AlreadyInLobby: true,
				}
				SendResponseToExt(w, successResponse)
			} else {
				log.Printf("extension %s tried to join, but another user with username %s is already in %s", r.RemoteAddr, request.Username, request.Code)
				SendResponseToExt(w, failResponse)
			}
			return
		}

		for _, other := range lobby.ExtClients {
			if request.UserID == other.UserID {
				log.Printf("extension %s tried to join, using username '%s' but has already joined with username '%s'", r.RemoteAddr, request.Username, other.Username)
				SendResponseToExt(w, failResponse)
				return
			}
		}

		if len(lobby.ExtClients) >= MAX_USERS_PER_LOBBY {
			log.Printf("extension %s tried to join, but there are already %d users in lobby %s", r.RemoteAddr, len(lobby.ExtClients), request.Code)
			SendResponseToExt(w, failResponse)
			return
		}

		if lobby.State == Initial {
			log.Printf("extension %s tried to join, but lobby %s is still showing example lobby", r.RemoteAddr, lobby.Code)
			SendResponseToExt(w, failResponse)
			return
		}

		userID := generateUserID()

		lobby.mu.Lock()
		extClient := ExtClient{
			UserID:     userID,
			Username:   request.Username,
			Clicks:     0,
			Pages:      0,
			FinishTime: 0,
			Page:       lobby.StartPage,
		}
		lobby.ExtClients = append(lobby.ExtClients, &extClient)
		lobby.mu.Unlock()

		log.Printf("extension %s joined lobby %s as %s", r.RemoteAddr, request.Code, request.Username)

		joinToWebMessage := JoinToWebMessage{
			Message: Message{
				Type: "join",
			},
			Username: request.Username,
		}

		lobby.Broadcast(joinToWebMessage)

		successResponse := JoinToExtResponse{
			Success:        true,
			UserID:         userID,
			AlreadyInLobby: false,
		}
		SendResponseToExt(w, successResponse)
	}
}

type PageFromExtRequest struct {
	Code     string
	Username string
	Page     string
	Backmove bool
	Previous string
}

type PageToExtResponse struct {
	Success bool
}

type PageToWebMessage struct {
	Message
	Username   string
	Page       string
	TimeAdded  int64
	Backmove   bool
	Clicks     int
	Pages      int
	FinishTime int
}

func handleExtPage(w http.ResponseWriter, r *http.Request) {
	failResponse := PageToExtResponse{
		Success: false,
	}

	switch r.Method {
	case http.MethodPost:
		body, err := io.ReadAll(r.Body)
		if err != nil {
			log.Printf("error reading extension request: %s", err)
			SendResponseToExt(w, failResponse)
			return
		}

		var pageFromExtMessage PageFromExtRequest
		err = json.Unmarshal(body, &pageFromExtMessage)
		if err != nil {
			log.Printf("failed to parse message '%s' from extension: %s", body, err)
			SendResponseToExt(w, failResponse)
			return
		}

		code := pageFromExtMessage.Code

		if len(code) != CODE_LENGTH {
			log.Printf("refusing to forward page from %s to lobby %s: invalid lobby code", r.RemoteAddr, code)
			SendResponseToExt(w, failResponse)
			return
		}

		lobby := globalState.Lobbies[code]

		if lobby == nil {
			log.Printf("refusing to forward page from %s to lobby %s: lobby not found", r.RemoteAddr, code)
			SendResponseToExt(w, failResponse)
			return
		}

		if lobby.State == Ended {
			log.Printf("refusing to forward page from %s to lobby %s: lobby has ended", r.RemoteAddr, code)
			SendResponseToExt(w, failResponse)
			return
		}

		if lobby.State != Started {
			log.Printf("refusing to forward page from %s to lobby %s: lobby is not started", r.RemoteAddr, code)
			SendResponseToExt(w, failResponse)
			return
		}

		extClient := lobby.GetExtClientFromUsername(pageFromExtMessage.Username)

		if extClient == nil {
			log.Printf("refusing to forward page from %s to lobby %s: user %s not in lobby", r.RemoteAddr, code, pageFromExtMessage.Username)
			SendResponseToExt(w, failResponse)
			return
		}

		extClient.mu.Lock()

		if extClient.FinishTime != 0 {
			log.Printf("refusing to forward page from %s to lobby %s: user %s has already finished", r.RemoteAddr, code, pageFromExtMessage.Username)
			SendResponseToExt(w, failResponse)
			extClient.mu.Unlock()
			return
		}

		if lobby.StartPage == pageFromExtMessage.Page && extClient.Page == pageFromExtMessage.Page {
			log.Printf("extension %s went to start page, responding with success", r.RemoteAddr)
			successResponse := PageToExtResponse{
				Success: true,
			}
			SendResponseToExt(w, successResponse)
			extClient.mu.Unlock()
			return
		}

		if extClient.Page != pageFromExtMessage.Previous {
			log.Printf("refusing to forward page from %s to lobby %s: previous page mismatch: server thinks %s while extension thinks %s", r.RemoteAddr, code, extClient.Page, pageFromExtMessage.Previous)
			SendResponseToExt(w, failResponse)
			extClient.mu.Unlock()
			return
		}

		extClient.Clicks += 1

		if pageFromExtMessage.Backmove {
			extClient.Pages -= 1
			if extClient.Pages < 0 {
				log.Printf("web client %s went back before start page", r.RemoteAddr)
				extClient.Pages = 0
			}
		} else {
			extClient.Pages += 1
		}

		if pageFromExtMessage.Page == lobby.GoalPage {
			extClient.FinishTime = time.Since(lobby.StartTime)
		}

		extClient.Page = pageFromExtMessage.Page

		extClient.mu.Unlock()

		pageToWebMessage := PageToWebMessage{
			Message: Message{
				Type: "page",
			},
			Username:   pageFromExtMessage.Username,
			Page:       pageFromExtMessage.Page,
			TimeAdded:  time.Since(lobby.StartTime).Milliseconds(),
			Backmove:   pageFromExtMessage.Backmove,
			Clicks:     extClient.Clicks,
			Pages:      extClient.Pages,
			FinishTime: int(extClient.FinishTime.Seconds()),
		}

		lobby.mu.Lock()
		lobby.LastInteractionTime = time.Now()
		lobby.History = append(lobby.History, pageToWebMessage)
		lobby.mu.Unlock()

		log.Printf("extension %s sent page: %+v", r.RemoteAddr, pageFromExtMessage)

		log.Printf("forwarding page to %d web clients: %+v", len(lobby.WebClients), pageToWebMessage)

		lobby.Broadcast(pageToWebMessage)

		successResponse := PageToExtResponse{
			Success: true,
		}
		SendResponseToExt(w, successResponse)
	}
}

func readWords(wordsFilepath string) []string {
	contents, err := os.ReadFile(wordsFilepath)
	if err != nil {
		log.Printf("failed to read words: %s", err)
		return []string{}
	}

	var wordlist []string
	err = json.Unmarshal(contents, &wordlist)
	if err != nil {
		log.Printf("failed to unmarshal words: %s", err)
		return []string{}
	}

	return wordlist
}

func main() {

	log.Printf("WikiWeaver Server (%s)", Version)

	dev := false
	for _, arg := range os.Args[1:] {
		if arg == "--dev" {
			dev = true
		}
	}

	seed := time.Now().UnixNano()
	if dev {
		seed = 1
	}

	globalState = GlobalState{
		Lobbies: make(map[string]*Lobby),
		Words:   readWords(WORDS_FILEPATH),
		UserIDs: make(map[string]bool),
		Rand:    rand.New(rand.NewSource(seed)),
	}

	go lobbyCleaner()

	http.HandleFunc("/api/ws/web/join", handleWebJoin)

	http.HandleFunc("/api/ext/join", handleExtJoin)
	http.HandleFunc("/api/ext/page", handleExtPage)

	address := "0.0.0.0"
	if dev {
		address = "localhost"
	}

	address = fmt.Sprintf("%s:%d", address, PORT)

	log.Printf("listening on %s", address)

	var err error

	if dev {
		err = http.ListenAndServe(address, nil)
	} else {
		err = http.ListenAndServeTLS(address, "/fullchain.pem", "/privkey.pem", nil)
	}

	if err != nil {
		log.Fatalf("listen error: %s", err)
	}
}
