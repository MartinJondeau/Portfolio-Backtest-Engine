#!/bin/bash

# setup_cron.sh
# Usage: ./setup_cron.sh

# 1. Get the current directory (Absolute Path)
PROJECT_DIR=$(pwd)
SCRIPT_PATH="$PROJECT_DIR/backend/daily_report.py"
PYTHON_PATH="$PROJECT_DIR/venv/bin/python" # Assuming Linux venv structure

# 2. Check if Python script exists
if [ ! -f "$SCRIPT_PATH" ]; then
    echo "Error: Could not find daily_report.py at $SCRIPT_PATH"
    exit 1
fi

# 3. Define the Cron Job (20:00 every day)
# Format: m h  dom mon dow   command
CRON_JOB="0 20 * * * cd $PROJECT_DIR/backend && $PYTHON_PATH daily_report.py >> daily_report.log 2>&1"

# 4. Add to Crontab (avoiding duplicates)
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo " Cron job added! The report will run daily at 20:00."
echo " Command: $CRON_JOB"