#!/bin/bash -e

if [[ $1 == "" ]]; then 
    echo -e Usage: $0 \<firefox\|chrome\>
    exit
fi

BUILD_DIR="./build/$1"

rm -rdf $BUILD_DIR
mkdir -p $BUILD_DIR

cp -r common/* $BUILD_DIR/
cp -r $1/* $BUILD_DIR

echo "Created extension in $BUILD_DIR"
