@echo off
REM E3 自動同步 + AI 生成筆記 Workflow

setlocal
set "PROJECT=%~dp0.."
set "LOG=%PROJECT%\scripts\sync.log"
set "STUBS=%PROJECT%\scripts\stubs.json"
set "PROMPT=%PROJECT%\scripts\generate-notes-prompt.md"

echo [%date% %time%] === Starting E3 sync === >> "%LOG%"

REM Step 1: Check Python dependencies
python -c "import PyPDF2; import pptx; import docx" 2>> "%LOG%"
if %errorlevel% neq 0 (
    echo [%date% %time%] ERROR: Missing Python deps. Run: pip install PyPDF2 python-pptx python-docx >> "%LOG%"
    goto :done
)

REM Step 2: Download new slides + create stub notes + sync calendar
echo [%date% %time%] Running e3 sync... >> "%LOG%"
node "%PROJECT%\packages\cli\dist\bin\e3.js" sync >> "%LOG%" 2>&1
if %errorlevel% neq 0 (
    echo [%date% %time%] ERROR: e3 sync failed (exit code %errorlevel%) >> "%LOG%"
    goto :done
)

REM Step 3: Find stub notes that need AI content
echo [%date% %time%] Finding stubs... >> "%LOG%"
node "%PROJECT%\scripts\find-stubs.js" > "%STUBS%" 2>> "%LOG%"

if %errorlevel% == 0 (
    echo [%date% %time%] Found stubs, calling Claude Code... >> "%LOG%"
    type "%PROMPT%" | claude -p --allowedTools "Read,Write,Edit,Glob,Bash" >> "%LOG%" 2>&1
    if %errorlevel% neq 0 (
        echo [%date% %time%] WARNING: Claude Code exited with code %errorlevel% >> "%LOG%"
    ) else (
        echo [%date% %time%] Notes generated successfully. >> "%LOG%"
    )
) else (
    echo [%date% %time%] No stubs to fill. All notes up to date. >> "%LOG%"
)

:done
echo [%date% %time%] === Done === >> "%LOG%"
