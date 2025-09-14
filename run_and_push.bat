@echo off

REM This script automates running the crypto analysis and pushing the results to GitHub.

REM Step 1: Pull the latest changes from the repository to avoid conflicts.
echo --- (1/4) Pulling latest changes from GitHub... ---
git pull

REM Step 2: Run your main Python analysis script.
echo.
echo --- (2/4) Running Python analysis script... ---
python run_analysis.py

REM Step 3: Add and commit the generated JSON files.
echo.
echo --- (3/4) Committing new data files... ---
git add *.json
git commit -m "Automated: Local update of signal data"

REM Step 4: Push the new commit to your GitHub repository.
echo.
echo --- (4/4) Pushing updates to GitHub... ---
git push

echo.
echo --- All steps complete. ---
echo Press any key to close this window.
pause