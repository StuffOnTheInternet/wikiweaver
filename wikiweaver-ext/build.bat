@echo off
if "%~1" == "" (
  echo "Usage: %0 <firefox|chrome>"
  exit
)

(
  if EXIST %CD%\build (
    RMDIR /S /Q "%CD%\build"
  )

  MKDIR %CD%\build
  MKDIR %CD%\build\icons
  MKDIR %CD%\build\popup

  COPY  "icons\*" "%CD%\build\icons"
  COPY  "popup\*" "%CD%\build\popup"
  COPY  "%~1\*" "%CD%\build"
)>NUL 2>&1