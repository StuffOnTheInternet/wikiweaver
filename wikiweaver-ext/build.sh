#!/bin/bash -e

print_help_text() {
    cat << EOF
Build and package the WikiWeaver browser extension for Chrome or Firefox.

Usage: $0 <chrome|firefox> [options]

Options:
    -h, --help     Print this message and exit.
    -p, --package  Also package the extension.
EOF
}

while test $# -gt 0; do
    case $1 in 
    -h | --help)
        print_help_text
        exit 0
        ;;
    firefox/ | chrome/)
        TARGET=${1%/}
        shift
        ;;
    firefox | chrome)
        TARGET=$1
        shift
        ;;
    -p | --package)
        PACKAGE_VERSION=$2
        shift
        shift
        ;;
    *)
        echo "Unrecognized argument '$1'"
        shift
        ;;
    esac
done

if [[ -z $TARGET ]]; then
    echo "No target specified. Must be either 'chrome' or 'firefox'"
    print_help_text
    exit 1
fi

BUILD_BASE="./build"
BUILD_TARGET="$BUILD_BASE/$TARGET/"

rm -rdf $BUILD_TARGET
mkdir -p $BUILD_TARGET

cp -r common/* $BUILD_TARGET
cp -r $TARGET/* $BUILD_TARGET

echo "Created extension in $BUILD_TARGET"

if [[ -n $PACKAGE_VERSION ]]; then
    PACKAGE_FILE="$BUILD_BASE/wikiweaver-ext-v$PACKAGE_VERSION-$TARGET.zip"
    zip -qr $PACKAGE_FILE $BUILD_TARGET

    echo "Packaged extension in $PACKAGE_FILE"
fi
