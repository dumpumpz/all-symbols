@echo off

REM This script pushes ANY local changes (new files, modified files) to GitHub.
REM It will ask you for a commit message to describe your changes.
REM It does NOT run the Python script.

REM Step 1: Pull the latest changes from the repository to avoid conflicts.
echo --- (1/4) Pulling latest changes from GitHub... ---
git pull

REM Step 2: Stage all new, modified, or deleted files for the commit.
echo.
echo --- (2/4) Staging all your local changes... ---
git add .
echo The following changes will be committed:
git status --short

REM Step 3: Ask you for a commit message.
echo.
echo --- (3/4) Please provide a commit message. ---
set /p COMMIT_MESSAGE="Enter your commit message (e.g., 'Updated website style'): "

REM Provide a default message if you enter nothing.
if not defined COMMIT_MESSAGE set COMMIT_MESSAGE="General update via batch script"

REM Step 4: Commit the changes and push them to your GitHub repository.
echo.
echo --- (4/4) Committing and pushing to GitHub... ---
git commit -m "%COMMIT_MESSAGE%"
git push

echo.
echo --- All steps complete! Your changes are on GitHub. ---
echo Press any key to close this window.
pause