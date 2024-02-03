#!/bin/bash -e

print_help_text() {
    cat << EOF
Build and package the WikiWeaver browser extension for Chrome or Firefox.

Usage: $0 <chrome|firefox> [options]

Example: $0 firefox --package v1.0.0

Options:
    -h, --help              Print this message and exit.
    -p, --package <version> Also package the extension.
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
    print_help_text
    exit 1
fi

BUILD_BASE="./build"
BUILD_TARGET="$BUILD_BASE/$TARGET/"

rm -rdf $BUILD_TARGET
mkdir -p $BUILD_TARGET

cp -r common/* $BUILD_TARGET
cp -r $TARGET/* $BUILD_TARGET

echo "Extension files moved to $BUILD_TARGET"

if [[ -n $PACKAGE_VERSION ]]; then
    PACKAGE_FILE_REL="$BUILD_BASE/wikiweaver-ext-$PACKAGE_VERSION-$TARGET.zip"

    rm -f $PACKAGE_FILE_REL
    
    PACKAGE_FILE_ABS="$PWD/$PACKAGE_FILE_REL"
    (cd $BUILD_TARGET && zip -qr $PACKAGE_FILE_ABS *)

    echo "Extension files packaged into $PACKAGE_FILE_REL"
fi
