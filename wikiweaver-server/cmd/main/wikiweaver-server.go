package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	PORT                            = 4242
	CONSOLE_SOCKET_PATH             = "/tmp/ww-console.sock"
	CODE_LENGTH                     = 4
	LOBBY_CLEANING_INTERVAL         = 15 * time.Minute
	LOBBY_IDLE_TIME_BEFORE_SHUTDOWN = 60 * time.Minute
	HISTORY_SEND_INTERVAL           = 200 * time.Millisecond
	WORDS_FILEPATH                  = "words.json"
	MAX_USERNAME_LEN                = 8
)

type GlobalState struct {
	Lobbies map[string]*Lobby
	Words   []string
	mu      sync.Mutex
}

var globalState GlobalState

type WebClient struct {
	conn   *websocket.Conn
	isHost bool
	mu     sync.Mutex
}

type ExtClient struct {
	Username string
	Clicks   int
	Pages    int
	mu       sync.Mutex
}

type Lobby struct {
	Code                string
	WebClients          []*WebClient
	ExtClients          []*ExtClient
	LastInteractionTime time.Time
	StartTime           time.Time
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

func (l *Lobby) hasStarted() bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return !l.StartTime.IsZero()
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

func generateRandomCode() string {
	LETTERS := "abcdefghijklmnopqrstuvxyz"

	b := make([]byte, CODE_LENGTH)

	for i := range b {
		b[i] = LETTERS[rand.Intn(len(LETTERS))]
	}

	return string(b)
}

func generateCodeFromWords() string {
	return globalState.Words[rand.Intn(len(globalState.Words))]
}

func generateUniqueCode() string {

	// This is possibly a race condition if we are just on the edge of 1000 lobbies,
	// but who cares. Fix later if necessary

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
				lobby.close()
				lobby.mu.Unlock()

				delete(globalState.Lobbies, code)
			}
		}
		globalState.mu.Unlock()
	}
}

func handleWebCreate(w http.ResponseWriter, r *http.Request) {

	code := generateUniqueCode()

	globalState.mu.Lock()
	globalState.Lobbies[code] = &Lobby{Code: code, LastInteractionTime: time.Now()}
	globalState.mu.Unlock()

	log.Printf("web client %s created lobby %s", r.RemoteAddr, code)

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Write([]byte(code))
}

type Message struct {
	Type string
}

type PongMessage struct {
	Message
}

type StartMessage struct {
	Message
	StartPage string
	GoalPage  string
}

type StartResponseMessage struct {
	Message
	Success bool
	Reason  string
}

type JoinResponseMessage struct {
	Message
	IsHost bool
}

func handleWebJoin(w http.ResponseWriter, r *http.Request) {

	code := r.URL.Query().Get("code")

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

	wc.sendJoinResponse(wc.isHost)

	go sendHistory(lobby, wc)

	go webClientListener(lobby, wc)
}

func sendHistory(lobby *Lobby, wc *WebClient) {
	log.Printf("sending history from lobby %s to web client %s", lobby.Code, wc.conn.RemoteAddr())

	if lobby.hasStarted() {
		startMsg := StartMessage{
			Message: Message{
				Type: "start",
			},
			StartPage: lobby.StartPage,
			GoalPage:  lobby.GoalPage,
		}

		err := wc.send(startMsg)
		if err != nil {
			log.Printf("failed to send history: %s", err)
			return
		}
	}

	lobby.mu.Lock()
	for _, extClient := range lobby.ExtClients {
		time.Sleep(HISTORY_SEND_INTERVAL)

		// Ugly to construct the message like this...
		joinMessageToWeb := JoinMessageToWeb{
			Message: Message{
				Type: "join",
			},
			Username: extClient.Username,
			Clicks:   extClient.Clicks,
			Pages:    extClient.Pages,
		}

		err := wc.send(joinMessageToWeb)
		if err != nil {
			log.Printf("failed to send history: %s", err)
			break
		}
	}

	for _, msg := range lobby.History {
		time.Sleep(HISTORY_SEND_INTERVAL)
		err := wc.send(msg)
		if err != nil {
			log.Printf("failed to send history: %s", err)
			break
		}
	}
	lobby.mu.Unlock()
}

func (wc *WebClient) sendStartResponse(success bool, reason string) {
	startResponseMessage := StartResponseMessage{
		Message: Message{
			Type: "startResponse",
		},
		Success: success,
		Reason:  reason,
	}

	err := wc.send(startResponseMessage)
	if err != nil {
		log.Printf("failed to send start response to %s: %s", wc.conn.RemoteAddr(), err)
	}
}

func (wc *WebClient) sendJoinResponse(isHost bool) {
	joinResponseMessage := JoinResponseMessage{
		Message: Message{
			Type: "joinResponse",
		},
		IsHost: isHost,
	}

	err := wc.send(joinResponseMessage)
	if err != nil {
		log.Printf("failed to send join response to %s: %s", wc.conn.RemoteAddr(), err)
	}
}

func (wc *WebClient) send(v interface{}) error {
	wc.mu.Lock()
	defer wc.mu.Unlock()
	return wc.conn.WriteJSON(v)
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

		switch msg.Type {
		case "ping":
			pongMessage := PongMessage{
				Message: Message{
					Type: "pong",
				},
			}

			err = wc.send(pongMessage)
			if err != nil {
				log.Printf("failed to respond with pong: %s", err)
				continue
			}

		case "start":
			var startMessageFromWeb StartMessageFromWeb
			err = json.Unmarshal(buf, &startMessageFromWeb)

			if err != nil {
				errMsg := fmt.Sprintf("failed to parse start message from web: %s", err)
				log.Print(errMsg)
				wc.sendStartResponse(false, errMsg)
				continue
			}

			code := startMessageFromWeb.Code

			lobby := globalState.Lobbies[code]

			if lobby == nil {
				errMsg := fmt.Sprintf("failed to start lobby %s: lobby does not exist", code)
				log.Print(errMsg)
				wc.sendStartResponse(false, errMsg)
				continue
			}

			if !wc.isHost {
				errMsg := fmt.Sprintf("failed to start lobby %s: web client %s is not host", code, wc.conn.RemoteAddr())
				log.Print(errMsg)
				wc.sendStartResponse(false, errMsg)
				continue
			}

			lobby.mu.Lock()
			lobby.StartTime = time.Now()
			lobby.StartPage = startMessageFromWeb.StartPage
			lobby.GoalPage = startMessageFromWeb.GoalPage
			lobby.LastInteractionTime = time.Now()
			lobby.History = lobby.History[:0]
			lobby.mu.Unlock()

			log.Printf("web client %s started lobby %s with %s to %s", wc.conn.RemoteAddr(), code, lobby.StartPage, lobby.GoalPage)

			for _, spectator := range lobby.WebClients {
				if spectator == wc {
					continue
				}

				startMsg := StartMessage{
					Message: Message{
						Type: "start",
					},
					StartPage: lobby.StartPage,
					GoalPage:  lobby.GoalPage,
				}

				err := spectator.send(startMsg)
				if err != nil {
					log.Printf("failed to notify web client %s of game start: %s", spectator.conn.RemoteAddr(), err)
					return
				}
			}

			wc.sendStartResponse(true, "")
		}
	}
}

type LobbyStatusResponse struct {
	Active bool
}

func handleWebStatus(w http.ResponseWriter, r *http.Request) {

	code := r.URL.Query().Get("code")

	globalState.mu.Lock()
	lobby := globalState.Lobbies[code]
	globalState.mu.Unlock()

	response := LobbyStatusResponse{Active: lobby != nil}

	msg, err := json.Marshal(response)
	if err != nil {
		log.Printf("failed to marshal status response: %s", err)
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)
	w.Write(msg)
}

type JoinMessageFromExt struct {
	Username string
	Code     string
}

type JoinMessageToWeb struct {
	Message
	Username string
	Clicks   int
	Pages    int
}

func handleExtJoin(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		body, err := io.ReadAll(r.Body)
		if err != nil {
			log.Printf("error reading extension request: %s", err)
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte{})
			return
		}

		var request JoinMessageFromExt
		err = json.Unmarshal(body, &request)
		if err != nil {
			log.Printf("failed to parse message from extension: %s", err)
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte{})
			return
		}

		if len(request.Username) > MAX_USERNAME_LEN {
			log.Printf("extension %s tried to join with a too long username %s", r.RemoteAddr, request.Username)
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte{})
			return
		}

		lobby := globalState.Lobbies[request.Code]

		if lobby == nil {
			log.Printf("extension %s tried to join non-existing lobby %s", r.RemoteAddr, request.Code)
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte{})
			return
		}

		if lobby.GetExtClientFromUsername(request.Username) != nil {
			log.Printf("extension %s tried to join, but username %s is already in lobby %s", r.RemoteAddr, request.Username, request.Code)
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte{})
			return
		}

		lobby.mu.Lock()
		extClient := ExtClient{
			Username: request.Username,
			Clicks:   0,
			Pages:    0,
		}
		lobby.ExtClients = append(lobby.ExtClients, &extClient)
		lobby.mu.Unlock()

		log.Printf("extension %s joined lobby %s as %s", r.RemoteAddr, request.Code, request.Username)

		joinMessageToWeb := JoinMessageToWeb{
			Message: Message{
				Type: "join",
			},
			Username: request.Username,
		}

		for _, wc := range lobby.WebClients {
			err = wc.send(joinMessageToWeb)
			if err != nil {
				log.Printf("failed to forward message %v to web client %s: %s", joinMessageToWeb, wc.conn.RemoteAddr(), err)
			}
		}
	}
}

type StartMessageFromWeb struct {
	Code      string
	StartPage string
	GoalPage  string
}

type PageFromExtMessage struct {
	Code     string
	Username string
	Page     string
	Backmove bool
}

type PageToWebMessage struct {
	Message
	Username  string
	Page      string
	TimeAdded int64
	Backmove  bool
	Clicks    int
	Pages     int
}

func handleExtPage(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		body, err := io.ReadAll(r.Body)
		if err != nil {
			log.Printf("error reading extension request: %s", err)
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte{})
			return
		}

		var pageFromExtMessage PageFromExtMessage
		err = json.Unmarshal(body, &pageFromExtMessage)
		if err != nil {
			log.Printf("failed to parse message from extension: %s", err)
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte{})
			return
		}

		code := pageFromExtMessage.Code

		lobby := globalState.Lobbies[code]
		if lobby == nil {
			log.Printf("refusing to forward page to lobby %s: lobby not found", code)
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte{})
			return
		}

		if !lobby.hasStarted() {
			log.Printf("refusing to forward page to lobby %s: lobby is not started", code)
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte{})
			return
		}

		extClient := lobby.GetExtClientFromUsername(pageFromExtMessage.Username)
		if extClient == nil {
			log.Printf("refusing to forward page to lobby %s: user %s not in lobby", code, pageFromExtMessage.Username)
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte{})
			return
		}

		extClient.mu.Lock()
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
		extClient.mu.Unlock()

		pageToWebMessage := PageToWebMessage{
			Message: Message{
				Type: "page",
			},
			Username:  pageFromExtMessage.Username,
			Page:      pageFromExtMessage.Page,
			TimeAdded: time.Since(lobby.StartTime).Milliseconds(),
			Backmove:  pageFromExtMessage.Backmove,
			Clicks:    extClient.Clicks,
			Pages:     extClient.Pages,
		}

		lobby.mu.Lock()
		lobby.LastInteractionTime = time.Now()
		lobby.History = append(lobby.History, pageToWebMessage)
		lobby.mu.Unlock()

		log.Printf("forwarding page from extension %s to %d web clients in lobby %s: %v", r.RemoteAddr, len(lobby.WebClients), code, pageToWebMessage)

		for _, wc := range lobby.WebClients {
			err = wc.send(pageToWebMessage)
			if err != nil {
				log.Printf("failed to forward message to web client %s: %s", wc.conn.RemoteAddr(), err)
			}
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte{})
	}
}

func readWords(wordsFilepath string) []string {
	contents, err := os.ReadFile(wordsFilepath)
	if err != nil {
		log.Printf("failed to read words, defaulting to random letters")
		return []string{}
	}

	var wordlist []string
	err = json.Unmarshal(contents, &wordlist)
	if err != nil {
		log.Printf("failed to unmarshal words, defaulting to random letters")
		return []string{}
	}

	return wordlist
}

func main() {

	dev := false
	for _, arg := range os.Args[1:] {
		if arg == "--dev" {
			dev = true
		}
	}

	globalState = GlobalState{
		Lobbies: make(map[string]*Lobby),
		Words:   readWords(WORDS_FILEPATH),
	}

	go lobbyCleaner()

	http.HandleFunc("/api/web/create", handleWebCreate)
	http.HandleFunc("/api/ws/web/join", handleWebJoin)
	http.HandleFunc("/api/web/status", handleWebStatus)

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
		err = http.ListenAndServeTLS(address, "/secrets/ssl_certificate.txt", "/secrets/ssl_privatekey.txt", nil)
	}

	if err != nil {
		log.Fatalf("listen error: %s", err)
	}
}
