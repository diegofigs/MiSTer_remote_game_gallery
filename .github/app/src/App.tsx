import React, { useState, useEffect, useRef, KeyboardEvent } from "react";
import placeholderImg from "./assets/placeholder.jpg";

// ----------------------------------------------------
// 1) Types & Interfaces
// ----------------------------------------------------
interface GameSystem {
  id: string;
  name: string;
  libRetroFolder: string;
  image?: string;
}

interface GameEntry {
  system: {
    id: string; // e.g. "PSX"
    name: string; // e.g. "PlayStation"
  };
  name: string;
  path: string;
}

interface SearchResponse {
  data: GameEntry[];
  total: number;
  pageSize: number;
  page: number;
}

// ----------------------------------------------------
// 2) Thumbnail Caching
// ----------------------------------------------------
function getCachedThumbnailUrl(game: GameEntry, system: GameSystem): string {
  const gameName = game.name.replace("&", "_");
  const key = `thumbnail_${system.id}_${gameName}`;
  const cached = localStorage.getItem(key);
  if (cached) {
    return cached;
  }

  const base = "https://thumbnails.libretro.com";
  const folder = encodeURIComponent(system.libRetroFolder);
  const subfolder = "Named_Boxarts";
  const gameFile = encodeURIComponent(gameName) + ".png";
  const finalUrl = `${base}/${folder}/${subfolder}/${gameFile}`;

  localStorage.setItem(key, finalUrl);
  return finalUrl;
}

// ----------------------------------------------------
// 3) Throttling (3 requests/sec)
// ----------------------------------------------------
let tokens = 3;
let lastReset = Date.now();

function getThrottleSlot(): Promise<void> {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      const now = Date.now();
      if (now - lastReset >= 1000) {
        tokens = 3;
        lastReset = now;
      }
      if (tokens > 0) {
        tokens--;
        resolve();
      } else {
        setTimeout(tryAcquire, 50);
      }
    };
    tryAcquire();
  });
}

async function throttledFetch(url: string, options?: RequestInit) {
  await getThrottleSlot();
  return fetch(url, options);
}

// ----------------------------------------------------
// 4) Systems Data
// ----------------------------------------------------
const SYSTEMS: GameSystem[] = [
  {
    id: "PSX",
    name: "PlayStation",
    libRetroFolder: "Sony - PlayStation",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Playstation_logo_colour.svg/1280px-Playstation_logo_colour.svg.png",
  },
  {
    id: "NES",
    name: "Nintendo Entertainment System",
    libRetroFolder: "Nintendo - Nintendo Entertainment System",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/NES_logo.svg/1920px-NES_logo.svg.png",
  },
  {
    id: "SNES",
    name: "Super Nintendo",
    libRetroFolder: "Nintendo - Super Nintendo Entertainment System",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/SNES_logo.svg/1280px-SNES_logo.svg.png",
  },
  {
    id: "Nintendo64",
    name: "Nintendo 64",
    libRetroFolder: "Nintendo - Nintendo 64",
    image:
      "https://upload.wikimedia.org/wikipedia/it/thumb/0/04/Nintendo_64_Logo.svg/1105px-Nintendo_64_Logo.svg.png",
  },
  {
    id: "Genesis",
    name: "Genesis",
    libRetroFolder: "Sega - Mega Drive - Genesis",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Sega_genesis_logo.svg/1280px-Sega_genesis_logo.svg.png",
  },
  {
    id: "Saturn",
    name: "Saturn",
    libRetroFolder: "Sega - Saturn",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/1/14/SEGA_Saturn_logo.png",
  },
  {
    id: "Gameboy",
    name: "Game Boy",
    libRetroFolder: "Nintendo - Game Boy",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Nintendo_Game_Boy_Logo.svg/1280px-Nintendo_Game_Boy_Logo.svg.png",
  },
  {
    id: "GBA",
    name: "Game Boy Advance",
    libRetroFolder: "Nintendo - Game Boy Advance",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Game_Boy_Advance_logo.svg/1280px-Game_Boy_Advance_logo.svg.png",
  },
  {
    id: "GameboyColor",
    name: "Game Boy Color",
    libRetroFolder: "Nintendo - Game Boy Color",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Game_Boy_Color_logo.svg/1280px-Game_Boy_Color_logo.svg.png",
  },
].sort((a, b) => a.name.localeCompare(b.name));

// ----------------------------------------------------
// 5) Main App
// ----------------------------------------------------
const App: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [indexReady, setIndexReady] = useState(false);

  // Track user-selected MiSTer IP from localStorage or fallback to "mister"
  const [misterIp, setMisterIp] = useState(() => {
    return localStorage.getItem("misterIp") || "mister.local";
  });

  // Build final API URL from the IP
  function getApiUrl() {
    return `http://${misterIp}:8182`;
  }

  // Modal to edit MiSTer IP
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempIp, setTempIp] = useState(misterIp);

  // Toggle dark mode
  const [darkMode, setDarkMode] = useState(true);

  // If the user changes misterIp, store it in localStorage
  useEffect(() => {
    localStorage.setItem("misterIp", misterIp);
  }, [misterIp]);

  const [selectedSystem, setSelectedSystem] = useState<GameSystem | null>(null);

  // Game data states
  const [loadingGames, setLoadingGames] = useState(false);
  const [games, setGames] = useState<GameEntry[]>([]);

  // Global search states
  const [globalSearchInput, setGlobalSearchInput] = useState("");
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [globalResults, setGlobalResults] = useState<GameEntry[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);

  // Debounce for global search
  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalSearchTerm(globalSearchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [globalSearchInput]);

  // On mount -> generate index
  useEffect(() => {
    const generateIndex = async () => {
      try {
        const resp = await throttledFetch(`${getApiUrl()}/api/games/index`, {
          method: "POST",
        });
        if (!resp.ok) {
          throw new Error(`Index generation failed: ${resp.statusText}`);
        }
        setIndexReady(true);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        }
      }
    };
    generateIndex();
  }, [misterIp]); // re-run if the IP changes

  // Global search effect
  useEffect(() => {
    const doGlobalSearch = async () => {
      if (!indexReady) return;
      if (selectedSystem) return; // Only do global if no system selected
      if (!globalSearchTerm.trim()) {
        setGlobalResults([]);
        return;
      }

      setGlobalLoading(true);
      setError(null);
      try {
        const payload = { query: globalSearchTerm.trim(), system: "" };
        const resp = await throttledFetch(`${getApiUrl()}/api/games/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          throw new Error(`Global Search failed: ${resp.statusText}`);
        }
        const data: SearchResponse = await resp.json();
        setGlobalResults(data.data || []);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        }
      } finally {
        setGlobalLoading(false);
      }
    };

    doGlobalSearch();
  }, [globalSearchTerm, indexReady, selectedSystem, misterIp]);

  // Once a system is selected, fetch its games
  useEffect(() => {
    if (!selectedSystem) {
      setGames([]);
      return;
    }

    const fetchGames = async () => {
      setLoadingGames(true);
      setError(null);
      try {
        const payload = { query: "", system: selectedSystem.id };
        const resp = await throttledFetch(`${getApiUrl()}/api/games/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          throw new Error(`Search failed: ${resp.statusText}`);
        }
        const data: SearchResponse = await resp.json();
        setGames(data.data);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        }
      } finally {
        setLoadingGames(false);
      }
    };
    fetchGames();
  }, [selectedSystem, misterIp]);

  // Dark/Light classes
  const appClass = darkMode ? "dark" : "";

  // Render UI
  return (
    <div
      className={`${appClass} w-screen min-h-screen flex flex-col font-sans`}
    >
      <div
        className={`
          flex-grow w-full flex flex-col
          ${darkMode ? "bg-[#111] text-gray-100" : "bg-[#f0f0f0] text-[#111]"}
        `}
      >
        <header
          className={`
            w-full p-4 flex items-center justify-between
            ${darkMode ? "bg-[#21E1E1] text-[#111]" : "bg-[#ddd] text-[#222]"}
          `}
        >
          <h1 className="text-2xl font-bold tracking-wider uppercase">
            MiSTer Retro UI
          </h1>

          <div className="flex items-center gap-2">
            {/* Settings Button */}
            <button
              onClick={() => {
                setTempIp(misterIp);
                setSettingsOpen(true);
              }}
              className={`
                px-3 py-2 font-semibold
                uppercase tracking-wide outline-none
                focus:ring-2 focus:ring-offset-2
                ${
                  darkMode
                    ? "bg-[#222] text-[#21E1E1] focus:ring-[#21E1E1]"
                    : "bg-[#21E1E1] text-[#111] focus:ring-[#21E1E1]"
                }
              `}
            >
              Settings
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`
                px-3 py-2 font-semibold uppercase tracking-wide outline-none
                focus:ring-2 focus:ring-offset-2
                ${
                  darkMode
                    ? "bg-[#222] text-[#21E1E1] focus:ring-[#21E1E1]"
                    : "bg-[#21E1E1] text-[#111] focus:ring-[#21E1E1]"
                }
              `}
            >
              {darkMode ? "Light Mode" : "Dark Mode"}
            </button>
          </div>
        </header>

        {error && (
          <div
            className={`
              p-2 m-2
              ${
                darkMode ? "bg-red-800 text-red-200" : "bg-red-200 text-red-800"
              }
            `}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        <main className="flex-grow w-full max-w-screen-2xl mx-auto p-4">
          {!indexReady && <p>Generating or verifying the game index...</p>}

          {/* If no system selected, show global search + system list */}
          {indexReady && !selectedSystem && (
            <div>
              {/* Global search input with 500ms debounce */}
              <div className="mb-4">
                <label
                  htmlFor="globalSearch"
                  className={`
                    font-semibold mr-2
                    ${darkMode ? "text-[#21E1E1]" : "text-[#21A1A1]"}
                  `}
                >
                  Global Search:
                </label>
                <input
                  id="globalSearch"
                  type="text"
                  value={globalSearchInput}
                  onChange={(e) => setGlobalSearchInput(e.target.value)}
                  className={`
                    px-2 py-2 border focus:outline-none
                    ${
                      darkMode
                        ? "bg-[#333] text-[#21E1E1] border-[#555] focus:ring-2 focus:ring-[#21E1E1]"
                        : "bg-[#eee] text-[#111] border-[#aaa] focus:ring-2 focus:ring-[#21A1A1]"
                    }
                  `}
                  placeholder="Type to search across ALL systems..."
                />
              </div>

              {!globalSearchTerm.trim() && (
                <SystemSelectView
                  onSelectSystem={setSelectedSystem}
                  darkMode={darkMode}
                />
              )}

              {globalSearchTerm.trim() && (
                <GlobalSearchResults
                  results={globalResults}
                  loading={globalLoading}
                  darkMode={darkMode}
                />
              )}
            </div>
          )}

          {/* If system selected, show system-level search + games */}
          {indexReady && selectedSystem && (
            <GamesView
              system={selectedSystem}
              games={games}
              loading={loadingGames}
              onBack={() => setSelectedSystem(null)}
              darkMode={darkMode}
            />
          )}
        </main>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className={`
              ${
                darkMode ? "bg-[#333] text-white" : "bg-white text-black"
              } p-4 rounded shadow-lg w-80
            `}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Settings</h2>

            <label className="block mb-2 font-semibold">
              MiSTer IP Address:
            </label>
            <input
              type="text"
              value={tempIp}
              onChange={(e) => setTempIp(e.target.value)}
              className={`
                w-full mb-4 px-2 py-1 border
                ${
                  darkMode
                    ? "bg-[#555] text-white border-[#777]"
                    : "bg-[#eee] border-[#ccc]"
                }
              `}
              placeholder="e.g. 192.168.1.100"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSettingsOpen(false)}
                className={`
                  px-3 py-1
                  ${
                    darkMode
                      ? "bg-gray-600 text-white hover:bg-gray-500"
                      : "bg-gray-300 text-black hover:bg-gray-400"
                  } rounded
                `}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setMisterIp(tempIp || "mister");
                  setSettingsOpen(false);
                }}
                className={`
                  px-3 py-1
                  ${
                    darkMode
                      ? "bg-blue-700 text-white hover:bg-blue-600"
                      : "bg-blue-500 text-white hover:bg-blue-400"
                  } rounded
                `}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

// ----------------------------------------------------
// 6) SystemSelectView
// ----------------------------------------------------
interface SystemSelectViewProps {
  onSelectSystem: (sys: GameSystem) => void;
  darkMode: boolean;
}

const SystemSelectView: React.FC<SystemSelectViewProps> = ({
  onSelectSystem,
  darkMode,
}) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, sys: GameSystem) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectSystem(sys);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
      {SYSTEMS.map((sys) => (
        <div
          key={sys.id}
          onClick={() => onSelectSystem(sys)}
          tabIndex={0}
          onKeyDown={(e) => handleKeyDown(e, sys)}
          className={`
            cursor-pointer text-center p-5 transition-colors
            outline-none focus:ring-2 focus:ring-offset-2
            ${
              darkMode
                ? "bg-[#333] hover:bg-[#444] text-[#eee] focus:ring-[#21E1E1]"
                : "bg-[#ddd] hover:bg-[#ccc] text-[#111] focus:ring-[#21A1A1]"
            }
          `}
        >
          {sys.image && (
            <img
              src={sys.image}
              alt={sys.name}
              className="object-contain max-h-14 mx-auto mb-3"
            />
          )}
          <span
            className={`block text-lg font-semibold 
              ${darkMode ? "text-[#21E1E1]" : "text-[#21A1A1]"}
            `}
          >
            {sys.name}
          </span>
          <span className="block text-sm opacity-80">{sys.id}</span>
        </div>
      ))}
    </div>
  );
};

// ----------------------------------------------------
// 7) GlobalSearchResults
// ----------------------------------------------------
interface GlobalSearchResultsProps {
  results: GameEntry[];
  loading: boolean;
  darkMode: boolean;
}

const GlobalSearchResults: React.FC<GlobalSearchResultsProps> = ({
  results,
  loading,
  darkMode,
}) => {
  const [refs] = useState<(HTMLDivElement | null)[]>([]);

  // Launch game
  const handleLaunchGame = async (game: GameEntry) => {
    try {
      const resp = await throttledFetch(
        `http://${localStorage.getItem("misterIp") || "mister"}:8182/api/games/launch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: game.path }),
        },
      );
      if (!resp.ok) {
        throw new Error(`Launch failed: ${resp.statusText}`);
      }
      console.log("Game launched:", game.path);
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert("Failed to launch: " + err.message);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, game: GameEntry) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleLaunchGame(game);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2">
        <div
          className={`
            w-8 h-8 border-4 border-t-transparent 
            rounded-full animate-spin
            ${darkMode ? "border-[#21E1E1]" : "border-[#21A1A1]"}
          `}
        />
        <span>Searching all systems...</span>
      </div>
    );
  }

  if (!results.length) {
    return <p className="opacity-80">No global results found.</p>;
  }
  return (
    <div>
      <h2
        className={`text-lg font-bold mb-2 ${
          darkMode ? "text-[#21E1E1]" : "text-[#21A1A1]"
        }`}
      >
        Global Results
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
        {results.map((game, idx) => {
          const sysObj = SYSTEMS.find((s) => s.id === game.system.id);
          const thumbUrl = sysObj
            ? getCachedThumbnailUrl(game, sysObj)
            : placeholderImg;

          return (
            <div
              key={game.path + idx}
              ref={(el) => (refs[idx] = el)}
              onClick={() => handleLaunchGame(game)}
              tabIndex={0}
              onKeyDown={(e) => handleKeyDown(e, game)}
              className={`
                cursor-pointer p-3 text-center outline-none
                focus:ring-2 focus:ring-offset-2
                ${
                  darkMode
                    ? "bg-[#333] hover:bg-[#444] text-[#eee] focus:ring-[#21E1E1]"
                    : "bg-[#ddd] hover:bg-[#ccc] text-[#111] focus:ring-[#21A1A1]"
                }
              `}
            >
              <img
                src={thumbUrl}
                alt={game.name}
                className="object-contain max-h-20 mx-auto mb-2"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = placeholderImg;
                }}
              />
              <div
                className={`
                  text-sm font-bold 
                  ${darkMode ? "text-[#21E1E1]" : "text-[#21A1A1]"}
                `}
              >
                {game.name}
              </div>
              <div className="text-xs opacity-80 mt-1">
                {game.system.name} ({game.system.id})
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ----------------------------------------------------
// 8) GamesView
// ----------------------------------------------------
interface GamesViewProps {
  system: GameSystem;
  games: GameEntry[];
  loading: boolean;
  onBack: () => void;
  darkMode: boolean;
}

const GamesView: React.FC<GamesViewProps> = ({
  system,
  games,
  loading,
  onBack,
  darkMode,
}) => {
  // 500ms debounce for system-level search
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const filtered = games.filter((g) =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pagedGames = filtered.slice(startIndex, endIndex);

  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const colCount = 5;

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const handlePrev = () => setPage((p) => Math.max(1, p - 1));
  const handleNext = () => setPage((p) => Math.min(totalPages, p + 1));

  const handleLaunchGame = async (game: GameEntry) => {
    try {
      const ip = localStorage.getItem("misterIp") || "mister";
      const resp = await throttledFetch(`http://${ip}:8182/api/games/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: game.path }),
      });
      if (!resp.ok) {
        throw new Error(`Launch failed: ${resp.statusText}`);
      }
      console.log("Game launched:", game.path);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("Failed to launch:", err.message);
        alert("Failed to launch game: " + err.message);
      }
    }
  };

  const handleGameKeyDown = (
    e: KeyboardEvent<HTMLDivElement>,
    game: GameEntry,
    idx: number,
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleLaunchGame(game);
    } else if (
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowDown"
    ) {
      e.preventDefault();
      navigateByArrow(e.key, idx);
    }
  };

  const navigateByArrow = (key: string, idx: number) => {
    let newIndex = idx;
    if (key === "ArrowLeft") {
      newIndex = Math.max(idx - 1, 0);
    } else if (key === "ArrowRight") {
      newIndex = Math.min(idx + 1, pagedGames.length - 1);
    } else if (key === "ArrowUp") {
      newIndex = Math.max(idx - colCount, 0);
    } else if (key === "ArrowDown") {
      newIndex = Math.min(idx + colCount, pagedGames.length - 1);
    }
    itemRefs.current[newIndex]?.focus();
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2 items-center">
          <button
            onClick={onBack}
            className={`
              px-4 py-2 uppercase tracking-wider outline-none
              focus:ring-2 focus:ring-offset-2
              ${
                darkMode
                  ? "bg-[#444] text-[#21E1E1] focus:ring-[#21E1E1]"
                  : "bg-[#ccc] text-[#21A1A1] focus:ring-[#21A1A1]"
              }
            `}
          >
            &larr; Back
          </button>
          <h2
            className={`
              text-2xl font-bold 
              ${darkMode ? "text-[#21E1E1]" : "text-[#21A1A1]"}
            `}
          >
            {system.name} ({system.id})
          </h2>
        </div>
        <div>
          <label
            htmlFor="searchTerm"
            className={`
              mr-2 font-semibold 
              ${darkMode ? "text-[#21E1E1]" : "text-[#21A1A1]"}
            `}
          >
            Search:
          </label>
          <input
            id="searchTerm"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={`
              px-2 py-2 border focus:outline-none
              ${
                darkMode
                  ? "bg-[#333] text-[#21E1E1] border-[#555] focus:ring-2 focus:ring-[#21E1E1]"
                  : "bg-[#eee] text-[#111] border-[#aaa] focus:ring-2 focus:ring-[#21A1A1]"
              }
            `}
            placeholder="Filter by name..."
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 mb-4">
          <div
            className={`
              w-8 h-8 border-4 border-t-transparent 
              rounded-full animate-spin
              ${darkMode ? "border-[#21E1E1]" : "border-[#21A1A1]"}
            `}
          />
          <span>Loading games...</span>
        </div>
      )}

      {!loading && games.length === 0 && (
        <p className="opacity-80">No games found for {system.name}.</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 mb-4">
        {pagedGames.map((game, idx) => {
          const thumbUrl = getCachedThumbnailUrl(game, system);
          return (
            <div
              key={game.path}
              ref={(el) => (itemRefs.current[idx] = el)}
              onClick={() => handleLaunchGame(game)}
              tabIndex={0}
              onKeyDown={(e) => handleGameKeyDown(e, game, idx)}
              className={`
                cursor-pointer p-4 text-center transition-colors outline-none
                focus:ring-2 focus:ring-offset-2
                ${
                  darkMode
                    ? "bg-[#333] hover:bg-[#444] focus:ring-[#21E1E1]"
                    : "bg-[#ddd] hover:bg-[#ccc] focus:ring-[#21A1A1]"
                }
              `}
            >
              <img
                src={thumbUrl}
                alt={game.name}
                className="w-full h-auto object-contain mx-auto mb-2 max-h-40"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = placeholderImg;
                }}
              />
              <div
                className={`
                  text-lg font-bold 
                  ${darkMode ? "text-[#21E1E1]" : "text-[#21A1A1]"}
                `}
              >
                {game.name}
              </div>
              <div className="text-xs opacity-80 mt-1">{system.name}</div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && filtered.length > 0 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handlePrev}
            className={`
              px-3 py-1 uppercase tracking-wide outline-none
              focus:ring-2 focus:ring-offset-2
              disabled:opacity-50
              ${
                darkMode
                  ? "bg-[#333] text-[#21E1E1] focus:ring-[#21E1E1]"
                  : "bg-[#ddd] text-[#21A1A1] focus:ring-[#21A1A1]"
              }
            `}
            disabled={page <= 1}
          >
            Previous
          </button>
          <span
            className={`
              ${darkMode ? "text-[#21E1E1]" : "text-[#21A1A1]"}
            `}
          >
            Page {page} of {totalPages}
          </span>
          <button
            onClick={handleNext}
            className={`
              px-3 py-1 uppercase tracking-wide outline-none
              focus:ring-2 focus:ring-offset-2
              disabled:opacity-50
              ${
                darkMode
                  ? "bg-[#333] text-[#21E1E1] focus:ring-[#21E1E1]"
                  : "bg-[#ddd] text-[#21A1A1] focus:ring-[#21A1A1]"
              }
            `}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
