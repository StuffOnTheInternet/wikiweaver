package main

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"math/rand"
	"net"
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/websocket"
)

const (
	CONSOLE_SOCKET_PATH = "/tmp/ww-console.sock"
	CODE_LENGTH         = 4
)

type GlobalState struct {
	Lobbies map[string]*Lobby
}

var globalState GlobalState

type NewPageMessage struct {
	Username string
	Page     string
}

type Lobby struct {
	Code     string
	HostConn *websocket.Conn
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

func handlerLobbyCreate(w http.ResponseWriter, r *http.Request) {

	code := generateCode()

	globalState.Lobbies[code] = &Lobby{Code: code}

	log.Printf("web client %s created lobby %s", r.RemoteAddr, code)

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Write([]byte(code))
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
	defer conn.Close()

	lobby.HostConn = conn
	log.Printf("web client %s joined lobby %s", conn.RemoteAddr(), lobby.Code)

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			log.Printf("closed connection %s\n", conn.RemoteAddr())
			return
		}
	}
}

func moveEndpointHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		body, err := ioutil.ReadAll(r.Body)
		if err != nil {
			log.Printf("error reading extension request: %s", err)
			return
		}

		var msg NewPageMessage
		err = json.Unmarshal(body, &msg)
		if err != nil {
			log.Printf("failed to parse json from extension: %s", err)
		}

		log.Printf("received data from extension: %v", msg)

		// TODO: Send only to specific, cant handle that right now since
		// extension isn't used web sockets and doesnt send code in request

		for code, lobby := range globalState.Lobbies {
			log.Printf("sending %v to lobby %s", msg, code)

			err = lobby.HostConn.WriteJSON(msg)
			if err != nil {
				log.Printf("failed to send data to lobby %s", code)
			}
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte{})
	}
}

func main() {

	globalState = GlobalState{Lobbies: make(map[string]*Lobby)}

	go ConsoleListener()

	http.HandleFunc("/api/lobby/create", handlerLobbyCreate)
	http.HandleFunc("/api/lobby/join/web", handlerLobbyJoinWeb)
	http.HandleFunc("/move", moveEndpointHandler)
	http.ListenAndServe("localhost:4242", nil)
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

			msg := NewPageMessage{Username: cmd[2], Page: cmd[3]}
			lobby.HostConn.WriteJSON(msg)
		}
	}
}
