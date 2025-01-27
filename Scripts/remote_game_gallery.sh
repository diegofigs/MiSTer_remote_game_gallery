#!/usr/bin/env python3

import os
import subprocess
import socket
import sys
from pathlib import Path

# Configuration
SERVER_DIR = "/media/fat/remote_game_gallery"
PID_FILE = "/media/fat/http_server.pid"
LOG_FILE = "/media/fat/http_server.log"
PORT = 8080
STARTUP_SCRIPT = "/media/fat/linux/user-startup.sh"


# Helper Functions
def is_server_running():
    """Check if the server is running using the PID file."""
    if os.path.exists(PID_FILE):
        try:
            with open(PID_FILE, "r") as f:
                pid = int(f.read().strip())
            os.kill(pid, 0)  # Check if process is alive
            return True
        except (ValueError, ProcessLookupError, FileNotFoundError):
            os.remove(PID_FILE)
    return False


def start_server():
    """Start the HTTP server and track its PID."""
    if is_server_running():
        return "Service is already running."

    os.makedirs(SERVER_DIR, exist_ok=True)

    with open(LOG_FILE, "w") as log_file:
        process = subprocess.Popen(
            ["python3", "-m", "http.server", str(PORT), "--directory", SERVER_DIR],
            stdout=log_file,
            stderr=log_file,
        )
        with open(PID_FILE, "w") as pid_file:
            pid_file.write(str(process.pid))
    return "Service started successfully."


def stop_server():
    """Stop the HTTP server."""
    if not is_server_running():
        return "No running service found."

    with open(PID_FILE, "r") as f:
        pid = int(f.read().strip())
    os.kill(pid, 15)  # Send SIGTERM
    os.remove(PID_FILE)
    return "Service stopped successfully."


def get_ip_addresses():
    """Retrieve the local IP address and hostname."""
    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
    except Exception:
        hostname, local_ip = "Unknown", "0.0.0.0"
    return hostname, local_ip


def update_startup_script():
    """Add the server start command to the startup script."""
    startup_line = f"[[ -e {__file__} ]] && python3 {__file__} start"
    if Path(STARTUP_SCRIPT).read_text().find(startup_line) != -1:
        return "Startup script is already configured."
    with open(STARTUP_SCRIPT, "a") as f:
        f.write(f"\n# Start Remote Game Gallery\n{startup_line}\n")
    return "Added to startup script successfully."


def show_menu():
    """Display the styled menu interface."""
    hostname, local_ip = get_ip_addresses()
    status = (
        f"Service is RUNNING.\n\nAccess Remote with these URLs:\n"
        f"http://{local_ip}:{PORT}/\nhttp://{hostname}.local:{PORT}/"
        if is_server_running()
        else "Service is STOPPED."
    )

    while True:
        menu_cmd = [
            "dialog",
            "--clear",
            "--title",
            "Remote Game Gallery",
            "--menu",
            f"{status}\n\nChoose an action:",
            "15",
            "60",
            "4",
            "1",
            "Stop Service" if is_server_running() else "Start Service",
            "2",
            "Restart Service",
            "3",
            "Add to Startup",
            "4",
            "Exit",
        ]
        try:
            choice = (
                subprocess.run(menu_cmd, stderr=subprocess.PIPE).stderr.decode().strip()
            )

            if choice == "1":
                message = stop_server() if is_server_running() else start_server()
            elif choice == "2":
                message = stop_server() + "\n" + start_server()
            elif choice == "3":
                message = update_startup_script()
            elif choice == "4":
                break
            else:
                message = "Invalid choice. Please try again."

            subprocess.run(["dialog", "--clear", "--msgbox", message, "8", "50"])
        except KeyboardInterrupt:
            break


# Script Entry Point
if __name__ == "__main__":
    if len(sys.argv) > 1:
        if sys.argv[1] == "start":
            print(start_server())
        elif sys.argv[1] == "stop":
            print(stop_server())
        else:
            print(f"Unknown command: {sys.argv[1]}")
    else:
        show_menu()
