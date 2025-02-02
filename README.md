# MiSTer remote-game-gallery

The leanest, [remote](https://github.com/wizzomafizzo/mrext)-powered MiSTer web portal.

[![CI](https://github.com/diegofigs/MiSTer_remote_game_gallery/actions/workflows/ci.yml/badge.svg)](https://github.com/diegofigs/MiSTer_remote_game_gallery/actions/workflows/ci.yml)

## Features

- Simple platform/game selection menu with pagination.
- Top level and per platform search.
- Game Boxarts (No-Intro/Redump).
- Click to launch game.

## Installation

The portal can be automatically updated with the MiSTer downloader script (and update_all). Add the following text to the `downloader.ini` file on your SD card:

```
[favorites]
db_url = https://raw.githubusercontent.com/diegofigs/MiSTer_remote_game_gallery/db/db.json.zip
```
