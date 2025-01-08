#!/bin/bash

nginx &>/var/log/nginx.log

cd ./wikiweaver-server
./bin/wikiweaver-server &

wait $(jobs -p)

exit $?
