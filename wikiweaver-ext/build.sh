#!/bin/bash
if [[ $1 == "" ]]; then 
    echo -e Usage: $0 \<firefox\|chrome\>
    exit
fi
rm -rdf ./build
mkdir -p ./build
cp -r icons ./build/icons
cp -r popup ./build/popup
cp -r $1/* ./build
