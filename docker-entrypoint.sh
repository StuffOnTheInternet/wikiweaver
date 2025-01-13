#!/bin/bash

nginx &>/var/log/nginx.log

cd ./wikiweaver-server
./bin/wikiweaver-server "$WW_SERVER_ARGS" &

wait $(jobs -p)

exit $?
