# WikiWeaver

WikiWeaver makes participating in (and spectating) Wikipedia Races more fun by visualizing every page you and your peers visit as colorful nodes in a graph.

![Image of website](example.png)

## Getting started

Creating and joining lobbies is simple and intuitive:

- The host goes to the [WikiWeaver website](https://wikiweaver.stuffontheinter.net/), which will automatically create a lobby. The code for the lobby is shown in the top right.
- All players then join this lobby using this code in either the [Firefox addon](https://addons.mozilla.org/en-US/firefox/addon/wikiweaver/) or [Chrome extension](https://chromewebstore.google.com/detail/apmgfgikhdikmeljhhomehnkhabiidmp?hl=en). Upon successfully joining the lobby, their usernames will be shown on the leaderboard in the bottom right.
- To start a race, the host enters a start and end page (you can copy in a url too!), and when everyone is ready they press start.
- During the race, the pages players visit will be visualized as nodes in a graph, and upon reaching the end node their finish time and total clicks will be logged on the leaderboard.

## Advanced Settings

When a lobby is created, the website changes to wikiweaver.stuffontheinter.net/#\<LOBBY CODE\>. If anyone apart from the host enters that website into their browser of choice, they become a spectator. Spectators can see the graph, but cannot change anything about the race.

In the graph interface, you may right click nodes, edges and the background to bring up extras menu. The options are as follows:

- Go to Article: If you right click a node, you can click this to find the corresponding wikipedia article. This will open a new tab.
- Toggle Edge Names: If you right click the background, you can toggle between showing usernames on edges or not.
- Show player path: On a node/edge, you can select this option to show only the edges for that player.
- Toggle short/long name: On a node, you can choose to show the full name of a node if it's been automatically shortened.

## Self-hosting

WikiWeaver can be self-hosted using Docker (recommended) or using your webserver of choice.
Make sure the domain it's hosted on runs over HTTPS (the browser extension will refuse to connect over HTTP).

### docker cli

```bash
docker run -d \
  --name wikiweaver \
  --restart unless-stopped \
  -p 80:80 \
  -e TZ='Europe/Stockholm'
  # TODO: something like this: ghcr.io/stuffontheinter/wikiweaver:latest
```

### docker-compose

```yaml
services:
  wikiweaver:
    container_name: wikiweaver
    build: . # TODO: Reference ghcr.io hosted wikiweaver image
    ports:
      - 80:80
    environment:
      - TZ=Europe/Stockholm
    restart: unless-stopped
```
