@echo off
REM E3 自動同步 + AI 生成筆記 Workflow

setlocal
set "PROJECT=C:\Users\twsha\Desktop\E3 plugin"
set "LOG=%PROJECT%\scripts\sync.log"
set "STUBS=%PROJECT%\scripts\stubs.json"
set "PROMPT=%PROJECT%\scripts\generate-notes-prompt.md"

echo [%date% %time%] === Starting E3 sync === >> "%LOG%"

REM Step 1: Download new slides + create stub notes + sync calendar
node "%PROJECT%\packages\cli\dist\bin\e3.js" sync >> "%LOG%" 2>&1

REM Step 2: Find stub notes that need AI content
node "%PROJECT%\scripts\find-stubs.js" > "%STUBS%" 2>> "%LOG%"

if %errorlevel% == 0 (
    echo [%date% %time%] Found stubs, calling Claude Code... >> "%LOG%"
    type "%PROMPT%" | claude -p --allowedTools "Read,Write,Edit,Glob,Bash" >> "%LOG%" 2>&1
    echo [%date% %time%] Notes generated. >> "%LOG%"
) else (
    echo [%date% %time%] No stubs to fill. >> "%LOG%"
)

echo [%date% %time%] === Done === >> "%LOG%"
