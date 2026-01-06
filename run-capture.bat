@echo off
REM Windows batch file to run the TVL capture script
REM Schedule this in Task Scheduler to run every 6 hours

cd /d "%~dp0"
echo Running TVL capture at %date% %time%
node capture-tvl-data.js
echo Capture completed at %date% %time%

