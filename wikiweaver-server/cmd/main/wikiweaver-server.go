package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

const (
	PORT                            = 4242
	CONSOLE_SOCKET_PATH             = "/tmp/ww-console.sock"
	CODE_LENGTH                     = 4
	LOBBY_IDLE_TIME_BEFORE_SHUTDOWN = 15 * time.Minute
)

type GlobalState struct {
	Lobbies map[string]*Lobby
}

var globalState GlobalState

type Lobby struct {
	Code                string
	HostConn            *websocket.Conn
	HostConnAddress     string
	LastInteractionTime time.Time
}

func (l *Lobby) close() {
	l.HostConn.Close()
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func generateCode() string {
	CAPITAL_LETTERS := "ABCDEFGHIJKLMNOPQRSTUVXYZ"

	b := make([]byte, CODE_LENGTH)
	for i := range b {
		b[i] = CAPITAL_LETTERS[rand.Intn(len(CAPITAL_LETTERS))]
	}

	return string(b)
}

func lobbyCleaner() {
	for {
		time.Sleep(LOBBY_IDLE_TIME_BEFORE_SHUTDOWN)

		log.Printf("closing idle lobbies")

		for code, lobby := range globalState.Lobbies {
			if time.Now().After(lobby.LastInteractionTime.Add(LOBBY_IDLE_TIME_BEFORE_SHUTDOWN)) {
				idleTime := time.Since(lobby.LastInteractionTime).Round(time.Second)
				log.Printf("lobby %s idle for %s, closing", code, idleTime)
				lobby.close()
				delete(globalState.Lobbies, code)
			}
		}
	}
}

func handlerLobbyCreate(w http.ResponseWriter, r *http.Request) {

	code := generateCode()

	globalState.Lobbies[code] = &Lobby{Code: code, LastInteractionTime: time.Now()}

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

func handlerLobbyJoinWeb(w http.ResponseWriter, r *http.Request) {

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

	address, ok := conn.RemoteAddr().(*net.TCPAddr)
	if !ok {
		log.Printf("failed to convert address to TCP address: %s", conn.RemoteAddr())
		return
	}

	lobby.HostConn = conn
	lobby.HostConnAddress = address.IP.String()
	lobby.LastInteractionTime = time.Now()

	log.Printf("web client %s joined lobby %s", lobby.HostConnAddress, lobby.Code)

	go hostListener(lobby)
}

func hostListener(lobby *Lobby) {
	defer lobby.HostConn.Close()

	for {
		_, buf, err := lobby.HostConn.ReadMessage()
		if err != nil {
			log.Printf("web client %s disconnected\n", lobby.HostConnAddress)
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
			log.Printf("received ping from: %s", lobby.HostConnAddress)

			pongMessage := PongMessage{
				Message: Message{
					Type: "pong",
				},
			}

			err = lobby.HostConn.WriteJSON(pongMessage)
			if err != nil {
				log.Printf("failed to respond with pong: %s", err)
				continue
			}

			log.Printf("responding with pong to: %s", lobby.HostConnAddress)
		}
	}
}

type LobbyStatusResponse struct {
	Active bool
}

func handlerLobbyStatus(w http.ResponseWriter, r *http.Request) {

	code := r.URL.Query().Get("code")

	lobby := globalState.Lobbies[code]

	var response LobbyStatusResponse

	if lobby != nil {
		response = LobbyStatusResponse{Active: true}
	} else {
		response = LobbyStatusResponse{Active: false}
	}

	msg, err := json.Marshal(response)
	if err != nil {
		log.Printf("failed to marshal status response: %s", err)
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)
	w.Write(msg)
}

type PageFromExtMessage struct {
	Code     string
	Username string
	Page     string
}

type PageToWebMessage struct {
	Message
	Username string
	Page     string
}

func handlerPage(w http.ResponseWriter, r *http.Request) {
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

		log.Printf("received data from extension: %v", pageFromExtMessage)

		code := pageFromExtMessage.Code

		lobby := globalState.Lobbies[code]
		if lobby == nil {
			log.Printf("lobby %s not found, refusing to forward message", code)

			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte{})

			return
		}

		if lobby.HostConn == nil {
			log.Printf("no host for lobby %s, refusing to forward message", code)

			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte{})

			return
		}

		lobby.LastInteractionTime = time.Now()

		pageToWebMessage := PageToWebMessage{
			Message: Message{
				Type: "page",
			},
			Username: pageFromExtMessage.Username,
			Page:     pageFromExtMessage.Page,
		}

		log.Printf("forwarding page '%s' from user '%s' to lobby %s", pageToWebMessage.Page, pageToWebMessage.Username, code)

		err = lobby.HostConn.WriteJSON(pageToWebMessage)
		if err != nil {
			log.Printf("failed to forward message to lobby: %s", err)

			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte{})

			return
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte{})
	}
}

func main() {

	dev := false
	for _, arg := range os.Args[1:] {
		if arg == "--dev" {
			dev = true
		}
	}

	globalState = GlobalState{Lobbies: make(map[string]*Lobby)}

	go ConsoleListener()
	go lobbyCleaner()

	http.HandleFunc("/api/web/lobby/create", handlerLobbyCreate)
	http.HandleFunc("/api/ws/web/lobby/join", handlerLobbyJoinWeb)
	http.HandleFunc("/api/web/lobby/status", handlerLobbyStatus)
	http.HandleFunc("/api/ext/page", handlerPage)

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

func ConsoleListener() {

	_, err := os.Stat(CONSOLE_SOCKET_PATH)
	if !os.IsNotExist(err) {
		log.Println("deleting old console socket")
		os.Remove(CONSOLE_SOCKET_PATH)
	}

	listener, err := net.Listen("unix", CONSOLE_SOCKET_PATH)
	if err != nil {
		log.Fatal("listen error: ", err)
	}
	defer listener.Close()

	for {
		conn, err := listener.Accept()
		if err != nil {
			log.Fatal("accept error:", err)
		}

		log.Printf("received console connection")
		go ConsoleHandler(conn)
	}
}

func ConsoleHandler(conn net.Conn) {
	defer conn.Close()

	for {
		buf := make([]byte, 512)
		n, err := conn.Read(buf)
		if err != nil {
			log.Printf("console connection closed")
			return
		}

		cmd := strings.Fields(string(buf[:n]))

		if len(cmd) > 0 {
			if cmd[0] != "newpage" {
				conn.Write([]byte("unknown command\n"))
				continue
			}

			if len(cmd) != 4 {
				conn.Write([]byte("usage: newpage <lobby> <username> <page>\n"))
				continue
			}

			lobby := globalState.Lobbies[cmd[1]]

			if lobby == nil {
				conn.Write([]byte("lobby does not exist\n"))
				continue
			}

			lobby.LastInteractionTime = time.Now()

			msg := PageToWebMessage{Username: cmd[2], Page: cmd[3]}
			lobby.HostConn.WriteJSON(msg)
		}
	}
}
