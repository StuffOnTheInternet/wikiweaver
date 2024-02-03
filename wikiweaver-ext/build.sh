#!/bin/bash -e

print_help_text() {
    cat << EOF
Build and package the WikiWeaver browser extension for Chrome or Firefox.

Usage: $0 <chrome|firefox> [options]

Options:
    -h, --help  Print this message and exit.
EOF
}

while test $# -gt 0; do
    case $1 in 
    -h | --help)
        print_help_text
        exit 0
        ;;
    firefox | firefox/ | chrome | chrome/)
        TARGET=$1
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

BUILD_DIR="./build/$TARGET"

rm -rdf $BUILD_DIR
mkdir -p $BUILD_DIR

cp -r common/* $BUILD_DIR/
cp -r $TARGET/* $BUILD_DIR

echo "Created extension in $BUILD_DIR"
