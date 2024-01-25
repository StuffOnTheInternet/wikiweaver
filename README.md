# WikiWeaver

Wikiweaver makes spectating wikiraces a lot more interesting.
It visualises every page a player visits as a node.

![Image of website](example.png)

## For developers

Make the website and browser extension connect to the development server by chaning which lines are commented out at the top of `networking.js` and `background.js`, respectively. 

Serve the website in `wikiweaver-web/` using whatever webserver you like. I prefer `python3 -m http.server <port>`.

Start the server in `wikiweaver-server/` in development mode with `make dev`.

Install the extension in `wikiweaver-ext/` by running `build.sh firefox` and going to `about:debugging` in Firefox and loading the contents of the `build/` folder.
