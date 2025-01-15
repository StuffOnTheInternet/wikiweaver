#!/bin/bash -e

package() {
  TARGET=$1

  BUILD_BASE="./build"
  BUILD_TARGET="$BUILD_BASE/$TARGET/"

  rm -rdf $BUILD_TARGET
  mkdir -p $BUILD_TARGET

  rsync -a --exclude='manifest-*' "./wikiweaver-ext/" $BUILD_TARGET
  cp "./wikiweaver-ext/manifest-${TARGET}.json" "$BUILD_TARGET/manifest.json"

  PACKAGE_FILE_REL="$BUILD_BASE/wikiweaver-ext-$PACKAGE_VERSION-$TARGET.zip"
  rm -f $PACKAGE_FILE_REL
  PACKAGE_FILE_ABS="$PWD/$PACKAGE_FILE_REL"
  (cd $BUILD_TARGET && zip -qr $PACKAGE_FILE_ABS *)
  echo "Packaged extension: $PACKAGE_FILE_REL"
}

print_help_text() {
    cat << EOF
Package the WikiWeaver browser extension for Chrome or Firefox.

Usage: $0 <version>

Example: $0 v1.2.3

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
    *)
        PACKAGE_VERSION=$1
        shift
        break
        ;;
    esac
done

if [[ -z $PACKAGE_VERSION ]]; then
  echo "Error: no package version provided"
  print_help_text
  exit 1
fi

package firefox
package chrome

