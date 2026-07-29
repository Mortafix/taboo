import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBriefcase,
  faCalculator,
  faCalendarDay,
  faCarSide,
  faChildReaching,
  faEarthEurope,
  faFilm,
  faFlask,
  faFutbol,
  faGamepad,
  faHouse,
  faLandmark,
  faLeaf,
  faMicrochip,
  faMusic,
  faPaw,
  faPerson,
  faStar,
  faTag,
  faUmbrellaBeach,
  faUtensils,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Ban,
  BookOpen,
  Check,
  ChevronLeft,
  Download,
  History,
  Infinity as InfinityIcon,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Settings,
  SkipForward,
  Smartphone,
  Target,
  Timer,
  Trash2,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { animate, createScope, stagger } from "animejs";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { cards, categories } from "../data/cards.generated";
import { AudioEngine } from "../lib/audio";
import {
  createMatch,
  gameReducer,
  restoreMatch,
  teamAccuracy,
  toSummary,
  type GameAction,
} from "../lib/game";
import { localGameRepository } from "../lib/storage";
import type {
  CardResult,
  GameSettings,
  MatchState,
  MatchSummary,
  Preferences,
  TeamColor,
} from "../lib/types";

type Screen = "home" | "setup" | "game" | "history" | "rules" | "settings";
type MatchAction =
  | GameAction
  | { type: "load"; match: MatchState }
  | { type: "clear" };

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const teamColors: TeamColor[] = ["coral", "blue", "amber", "violet"];
const teamThemeColors: Record<TeamColor, string> = {
  coral: "#c74455",
  blue: "#526bd1",
  amber: "#ba8429",
  violet: "#794fc0",
};
const teamDefaults = [
  { id: "team-1", name: "Professoroni", color: "coral" as const },
  { id: "team-2", name: "Talenti sprecati", color: "blue" as const },
  { id: "team-3", name: "Casi umani", color: "amber" as const },
  { id: "team-4", name: "Filosofeggianti", color: "violet" as const },
];

const defaultSettings: GameSettings = {
  durationSec: 120,
  skipsPerTeam: 5,
  targetScore: 10,
  categoryIds: categories.map((category) => category.id),
  teams: teamDefaults.slice(0, 2),
};

const deckIcons: Record<string, IconDefinition> = {
  paw: faPaw,
  person: faPerson,
  "child-reaching": faChildReaching,
  tag: faTag,
  film: faFilm,
  utensils: faUtensils,
  house: faHouse,
  briefcase: faBriefcase,
  "calendar-day": faCalendarDay,
  "earth-europe": faEarthEurope,
  calculator: faCalculator,
  music: faMusic,
  leaf: faLeaf,
  gamepad: faGamepad,
  flask: faFlask,
  futbol: faFutbol,
  landmark: faLandmark,
  microchip: faMicrochip,
  "umbrella-beach": faUmbrellaBeach,
  "car-side": faCarSide,
  star: faStar,
};

function DeckIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <FontAwesomeIcon
      icon={deckIcons[name] ?? faTag}
      className={className}
      aria-hidden="true"
    />
  );
}

const defaultPreferences: Preferences = {
  schemaVersion: 1,
  settings: defaultSettings,
  volume: 0.7,
  muted: false,
};

function ensureUniqueTeamColors(settings: GameSettings): GameSettings {
  const used = new Set<TeamColor>();
  return {
    ...settings,
    teams: settings.teams.map((team) => {
      const color = used.has(team.color)
        ? teamColors.find((candidate) => !used.has(candidate)) ?? team.color
        : team.color;
      used.add(color);
      return { ...team, color };
    }),
  };
}

function matchRootReducer(
  state: MatchState | null,
  action: MatchAction,
): MatchState | null {
  if (action.type === "load") return action.match;
  if (action.type === "clear") return null;
  return state ? gameReducer(state, action) : state;
}

const formatClock = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const formatDate = (timestamp: number) =>
  new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);

const titleCase = (word: string) =>
  word.length ? word[0].toLocaleUpperCase("it") + word.slice(1) : word;

function ScreenHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <header className="screen-header animate-in">
      <button className="icon-button" onClick={onBack} aria-label="Indietro">
        <ChevronLeft size={22} />
      </button>
      <div>
        <p className="eyebrow">{subtitle}</p>
        <h1>{title}</h1>
      </div>
    </header>
  );
}

function BottomNav({
  current,
  onNavigate,
}: {
  current: Screen;
  onNavigate: (screen: Screen) => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="Navigazione principale">
      {[
        ["home", Play, "Gioca"],
        ["history", History, "Storico"],
        ["settings", Settings, "Impostazioni"],
      ].map(([screen, Icon, label]) => (
        <button
          key={screen as string}
          className={current === screen ? "active" : ""}
          onClick={() => onNavigate(screen as Screen)}
        >
          <Icon size={20} />
          <span>{label as string}</span>
        </button>
      ))}
    </nav>
  );
}

export default function TabooApp() {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const interactionLockRef = useRef(false);
  const animationScope = useRef<ReturnType<typeof createScope> | null>(null);
  const audio = useRef(new AudioEngine());
  const archivedIds = useRef(new Set<string>());
  const countdownSecond = useRef<number | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [preferences, setPreferences] =
    useState<Preferences>(defaultPreferences);
  const [draftSettings, setDraftSettings] =
    useState<GameSettings>(defaultSettings);
  const [match, dispatch] = useReducer(matchRootReducer, null);
  const [history, setHistory] = useState<MatchSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [clockMs, setClockMs] = useState(defaultSettings.durationSec * 1000);
  const [interactionLocked, setInteractionLocked] = useState(false);
  const [cardFeedback, setCardFeedback] = useState<CardResult | null>(null);
  const [storageWarning, setStorageWarning] = useState("");
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [updateRegistration, setUpdateRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [isStandalone] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator &&
          Boolean((navigator as Navigator & { standalone?: boolean }).standalone))),
  );

  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const cardById = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [],
  );
  const currentCard = match ? cardById.get(match.currentCardId) : undefined;
  const activeTeam = match?.teams[match.activeTeamIndex];

  useEffect(() => {
    const themeColor = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (!themeColor) return;
    themeColor.content =
      screen === "game" && activeTeam
        ? teamThemeColors[activeTeam.color]
        : "#32181e";
  }, [activeTeam, screen]);

  useEffect(() => {
    animationScope.current?.revert();
    if (!rootRef.current || reducedMotion) return;
    animationScope.current = createScope({ root: rootRef }).add(() => {
      animate(".animate-in", {
        opacity: [0, 1],
        translateY: [16, 0],
        delay: stagger(45),
        duration: 420,
        ease: "out(3)",
      });
    });
    return () => animationScope.current?.revert();
  }, [screen, match?.phase, reducedMotion]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      localGameRepository.loadPreferences(),
      localGameRepository.loadActiveMatch(),
      localGameRepository.loadHistory(),
    ])
      .then(([savedPreferences, savedMatch, savedHistory]) => {
        if (cancelled) return;
        const loadedPreferences = savedPreferences ?? defaultPreferences;
        const nextPreferences = {
          ...loadedPreferences,
          settings: ensureUniqueTeamColors(loadedPreferences.settings),
        };
        setPreferences(nextPreferences);
        setDraftSettings(nextPreferences.settings);
        audio.current.setVolume(nextPreferences.volume);
        audio.current.setMuted(nextPreferences.muted);
        setHistory(savedHistory);
        if (savedMatch) dispatch({ type: "load", match: restoreMatch(savedMatch) });
      })
      .catch(() =>
        setStorageWarning(
          "Il salvataggio locale non è disponibile: la partita continuerà solo in memoria.",
        ),
      )
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    audio.current.setVolume(preferences.volume);
    audio.current.setMuted(preferences.muted);
    localGameRepository
      .savePreferences(preferences)
      .catch(() => setStorageWarning("Non riesco a salvare le preferenze."));
  }, [preferences, ready]);

  useEffect(() => {
    if (!ready || !match) return;
    if (match.phase === "finished" && match.winnerTeamId) {
      if (archivedIds.current.has(match.id)) return;
      archivedIds.current.add(match.id);
      const summary = toSummary(match);
      localGameRepository
        .archiveMatch(summary)
        .then(() =>
          setHistory((items) => [
            summary,
            ...items.filter((item) => item.id !== summary.id),
          ]),
        )
        .catch(() => {
          archivedIds.current.delete(match.id);
          setStorageWarning("Non riesco ad archiviare il risultato.");
        });
      audio.current.play("winner");
      return;
    }
    localGameRepository
      .saveActiveMatch(match)
      .catch(() => setStorageWarning("Non riesco a salvare la partita."));
  }, [match, ready]);

  useEffect(() => {
    if (match?.phase !== "playing" || !match.turnEndsAt) {
      countdownSecond.current = null;
      return;
    }

    const updateClock = () => {
      const remaining = Math.max(0, match.turnEndsAt! - Date.now());
      setClockMs(remaining);
      const second = Math.ceil(remaining / 1000);
      if (
        second > 0 &&
        second <= 5 &&
        countdownSecond.current !== second
      ) {
        countdownSecond.current = second;
        audio.current.play("countdown");
      }
      if (remaining <= 0) {
        dispatch({ type: "time-up", now: Date.now() });
      }
    };
    const initialUpdate = window.setTimeout(updateClock, 0);
    const interval = window.setInterval(updateClock, 100);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, [match?.phase, match?.turnEndsAt, match?.remainingMs, preferences.settings.durationSec]);

  useEffect(() => {
    const pauseAndSave = () => {
      if (!match || match.phase !== "playing") return;
      const paused = gameReducer(match, { type: "pause", now: Date.now() });
      dispatch({ type: "load", match: paused });
      localGameRepository.saveActiveMatch(paused).catch(() => undefined);
    };
    const onVisibility = () => document.hidden && pauseAndSave();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", pauseAndSave);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", pauseAndSave);
    };
  }, [match]);

  useEffect(() => {
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onInstallPrompt);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        if (registration.waiting) setUpdateRegistration(registration);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateRegistration(registration);
            }
          });
        });
      });
      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    }

    return () =>
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
  }, []);

  const startMatch = useCallback(
    (settings: GameSettings) => {
      const selectedCardIds = cards
        .filter((card) => settings.categoryIds.includes(card.categoryId))
        .map((card) => card.id);
      const nextMatch = createMatch(settings, selectedCardIds);
      setPreferences((current) => ({ ...current, settings }));
      setDraftSettings(settings);
      dispatch({ type: "load", match: nextMatch });
      setScreen("game");
    },
    [],
  );

  const playCard = (result: CardResult) => {
    if (
      !match ||
      match.phase !== "playing" ||
      interactionLocked ||
      interactionLockRef.current
    ) {
      return;
    }
    interactionLockRef.current = true;
    setInteractionLocked(true);
    setCardFeedback(result);
    audio.current.play(
      result === "correct" ? "correct" : result === "wrong" ? "wrong" : "skip",
    );
    const animatedCard = cardRef.current;
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      animatedCard?.removeAttribute("style");
      dispatch({ type: "card", result, now: Date.now() });
      setCardFeedback(null);
      interactionLockRef.current = false;
      setInteractionLocked(false);
    };
    if (reducedMotion || !animatedCard) {
      window.setTimeout(finish, reducedMotion ? 140 : 0);
      return;
    }
    const movement = result === "skip" ? 140 : result === "correct" ? 36 : -18;
    animate(animatedCard, {
      translateX: result === "skip" ? [0, movement] : [0, movement, 0],
      translateY: result === "correct" ? [0, -30] : 0,
      rotate: result === "skip" ? [0, 7] : result === "wrong" ? [0, -2, 2, 0] : 0,
      scale: result === "correct" ? [1, 1.03] : 1,
      opacity: result === "skip" ? [1, 0] : [1, 0.78, 1],
      duration: result === "skip" ? 300 : 360,
      ease: "out(3)",
      onComplete: finish,
    });
  };

  const saveDraftSettings = () => {
    const settings = ensureUniqueTeamColors({
      ...draftSettings,
      teams: draftSettings.teams.map((team) => ({
        ...team,
        name: team.name.trim(),
      })),
    });
    audio.current.play("tap");
    setPreferences((current) => ({ ...current, settings }));
    setDraftSettings(settings);
    setScreen("home");
  };

  const updateDraftTeam = (
    index: number,
    field: "name" | "color",
    value: string,
  ) =>
    setDraftSettings((current) => {
      if (
        field === "color" &&
        current.teams.some(
          (team, teamIndex) => teamIndex !== index && team.color === value,
        )
      ) {
        return current;
      }
      return {
        ...current,
        teams: current.teams.map((team, teamIndex) =>
          teamIndex === index ? { ...team, [field]: value } : team,
        ),
      };
    });

  const addTeam = () =>
    setDraftSettings((current) => {
      if (current.teams.length >= 4) return current;
      const template = teamDefaults[current.teams.length];
      const usedColors = new Set(current.teams.map((team) => team.color));
      const color =
        teamColors.find((candidate) => !usedColors.has(candidate)) ??
        template.color;
      return {
        ...current,
        teams: [
          ...current.teams,
          {
            ...template,
            color,
            id: `${template.id}-${Date.now().toString(36)}`,
          },
        ],
      };
    });

  const removeTeam = () =>
    setDraftSettings((current) =>
      current.teams.length <= 2
        ? current
        : { ...current, teams: current.teams.slice(0, -1) },
    );

  const requestInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const applyUpdate = () => {
    if (!updateRegistration?.waiting) return;
    if (match && match.phase !== "finished") {
      dispatch({ type: "pause", now: Date.now() });
    }
    updateRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
  };

  const homeStats = useMemo(() => {
    const attempts = history.flatMap((item) => item.teams);
    const correct = attempts.reduce((sum, team) => sum + team.correct, 0);
    const total = attempts.reduce(
      (sum, team) => sum + team.correct + team.wrong + team.skipped,
      0,
    );
    return {
      games: history.length,
      accuracy: total ? Math.round((correct / total) * 100) : 0,
    };
  }, [history]);

  const renderHome = () => (
    <>
      <section className="hero-card animate-in">
        <div className="brand-row">
          <span className="brand-mark">T</span>
          <button
            className="rules-button"
            onClick={() => setScreen("rules")}
            aria-label="Regole"
          >
            <BookOpen size={18} />
            <span>Regole</span>
          </button>
        </div>
        <div className="hero-copy">
          <p className="eyebrow">Il party game delle parole</p>
          <h1>Parla senza dire troppo.</h1>
          <p>
            Fai indovinare la parola. Evita quelle vietate. Batti il tempo.
          </p>
        </div>
        <div className="hero-actions">
          <button
            className="primary-button light"
            onClick={() => {
              audio.current.play("start");
              startMatch(preferences.settings);
            }}
          >
            <Play size={20} fill="currentColor" />
            Inizia partita
          </button>
          <button
            className="round-button light"
            onClick={() => {
              setDraftSettings(preferences.settings);
              setScreen("setup");
            }}
            aria-label="Configura partita"
          >
            <Settings size={21} />
          </button>
        </div>
        <div className="orb orb-one" />
        <div className="orb orb-two" />
      </section>

      {match && match.phase !== "finished" && (
        <section className="resume-card animate-in">
          <div>
            <p className="eyebrow">Partita sospesa</p>
            <h2>Turno di {activeTeam?.name}</h2>
            <p>
              Round {match.round} · {formatClock(match.remainingMs)} rimasti
            </p>
          </div>
          <button
            className="primary-button compact"
            onClick={() => setScreen("game")}
          >
            <RotateCcw size={18} />
            Riprendi
          </button>
        </section>
      )}

      <section className="next-match-card animate-in">
        <div className="section-title">
          <div>
            <p className="eyebrow">Impostazioni salvate</p>
            <h2>Prossima partita</h2>
          </div>
          <button
            className="text-button"
            onClick={() => {
              setDraftSettings(preferences.settings);
              setScreen("setup");
            }}
          >
            Modifica
          </button>
        </div>
        <div className="next-match-grid">
          <div>
            <Users size={18} />
            <span>
              <strong>{preferences.settings.teams.length} squadre</strong>
              <small>
                {preferences.settings.teams.map((team) => team.name).join(" · ")}
              </small>
            </span>
          </div>
          <div>
            <Timer size={18} />
            <span>
              <strong>{formatClock(preferences.settings.durationSec * 1000)}</strong>
              <small>per turno</small>
            </span>
          </div>
          <div>
            <SkipForward size={18} />
            <span>
              <strong>
                {preferences.settings.skipsPerTeam === null
                  ? "Illimitati"
                  : preferences.settings.skipsPerTeam}
              </strong>
              <small>salti per squadra</small>
            </span>
          </div>
          <div>
            <Target size={18} />
            <span>
              <strong>{preferences.settings.targetScore} punti</strong>
              <small>per vincere</small>
            </span>
          </div>
        </div>
        <div className="deck-summary">
          <span className="deck-summary-icons">
            {categories
              .filter((category) =>
                preferences.settings.categoryIds.includes(category.id),
              )
              .slice(0, 5)
              .map((category) => (
                <i key={category.id}>
                  <DeckIcon name={category.icon} />
                </i>
              ))}
          </span>
          <span>
            <strong>{preferences.settings.categoryIds.length} mazzi</strong>
            <small>
              {cards
                .filter((card) =>
                  preferences.settings.categoryIds.includes(card.categoryId),
                )
                .length.toLocaleString("it-IT")}{" "}
              carte disponibili
            </small>
          </span>
        </div>
      </section>
    </>
  );

  const renderSetup = () => (
    <>
      <ScreenHeader
        title="Nuova partita"
        subtitle="Personalizzazione"
        onBack={() => setScreen("home")}
      />
      <section className="setup-section animate-in">
        <div className="section-title">
          <div>
            <p className="eyebrow">Da 2 a 4</p>
            <h2>Squadre</h2>
          </div>
          <div className="stepper">
            <button onClick={removeTeam} disabled={draftSettings.teams.length <= 2}>
              <Minus size={17} />
            </button>
            <span>{draftSettings.teams.length}</span>
            <button onClick={addTeam} disabled={draftSettings.teams.length >= 4}>
              <Plus size={17} />
            </button>
          </div>
        </div>
        <div className="team-editor-list">
          {draftSettings.teams.map((team, index) => (
            <div className={`team-editor color-${team.color}`} key={team.id}>
              <span className="team-number">{index + 1}</span>
              <input
                value={team.name}
                maxLength={18}
                aria-label={`Nome squadra ${index + 1}`}
                onChange={(event) =>
                  updateDraftTeam(index, "name", event.target.value)
                }
              />
              <div className="color-picker">
                {teamColors.map((color) => (
                  <button
                    key={color}
                    className={`color-swatch color-${color} ${
                      team.color === color ? "selected" : ""
                    }`}
                    aria-label={`Colore ${color}`}
                    disabled={draftSettings.teams.some(
                      (otherTeam, otherIndex) =>
                        otherIndex !== index && otherTeam.color === color,
                    )}
                    onClick={() => updateDraftTeam(index, "color", color)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="setup-section animate-in">
        <div className="section-title">
          <div>
            <p className="eyebrow">Ritmo di gioco</p>
            <h2>Regole del match</h2>
          </div>
        </div>
        <label className="option-label">
          <span><Timer size={18} /> Durata turno</span>
          <div className="segmented">
            {[30, 60, 120, 300].map((duration) => (
              <button
                key={duration}
                className={draftSettings.durationSec === duration ? "selected" : ""}
                onClick={() =>
                  setDraftSettings((current) => ({
                    ...current,
                    durationSec: duration as GameSettings["durationSec"],
                  }))
                }
              >
                {duration < 60 ? `${duration}s` : `${duration / 60}m`}
              </button>
            ))}
          </div>
        </label>
        <label className="option-label">
          <span><SkipForward size={18} /> Salti per squadra</span>
          <div className="segmented">
            {[0, 5, 10, null].map((skips) => (
              <button
                key={skips ?? "infinite"}
                className={draftSettings.skipsPerTeam === skips ? "selected" : ""}
                onClick={() =>
                  setDraftSettings((current) => ({
                    ...current,
                    skipsPerTeam: skips as GameSettings["skipsPerTeam"],
                  }))
                }
              >
                {skips === null ? <InfinityIcon size={17} /> : skips}
              </button>
            ))}
          </div>
        </label>
        <label className="option-label">
          <span><Target size={18} /> Punti vittoria</span>
          <div className="segmented three">
            {[10, 25, 50].map((target) => (
              <button
                key={target}
                className={draftSettings.targetScore === target ? "selected" : ""}
                onClick={() =>
                  setDraftSettings((current) => ({
                    ...current,
                    targetScore: target as GameSettings["targetScore"],
                  }))
                }
              >
                {target}
              </button>
            ))}
          </div>
        </label>
      </section>

      <section className="setup-section animate-in">
        <div className="section-title">
          <div>
            <p className="eyebrow">
              {draftSettings.categoryIds.length} selezionati
            </p>
            <h2>Mazzi</h2>
          </div>
          <button
            className="text-button"
            onClick={() =>
              setDraftSettings((current) => ({
                ...current,
                categoryIds:
                  current.categoryIds.length === categories.length
                    ? []
                    : categories.map((category) => category.id),
              }))
            }
          >
            {draftSettings.categoryIds.length === categories.length
              ? "Deseleziona"
              : "Tutti"}
          </button>
        </div>
        <div className="category-grid">
          {categories.map((category) => {
            const selected = draftSettings.categoryIds.includes(category.id);
            return (
              <button
                className={`category-tile ${selected ? "selected" : ""}`}
                key={category.id}
                onClick={() =>
                  setDraftSettings((current) => ({
                    ...current,
                    categoryIds: selected
                      ? current.categoryIds.filter((id) => id !== category.id)
                      : [...current.categoryIds, category.id],
                  }))
                }
              >
                <span><DeckIcon name={category.icon} /></span>
                <strong>{category.title}</strong>
                <small>{category.count} carte</small>
                <i>{selected ? <Check size={14} /> : null}</i>
              </button>
            );
          })}
        </div>
      </section>

      <div className="sticky-action">
        <button
          className="primary-button wide"
          disabled={
            !draftSettings.categoryIds.length ||
            draftSettings.teams.some((team) => !team.name.trim())
          }
          onClick={saveDraftSettings}
        >
          <Save size={20} />
          Salva impostazioni
        </button>
      </div>
    </>
  );

  const renderGame = () => {
    if (!match || !activeTeam) return null;
    const activeColor = `color-${activeTeam.color}`;
    if (match.phase === "handoff") {
      return (
        <section className={`handoff-screen ${activeColor}`}>
          <button
            className="icon-button glass handoff-back"
            onClick={() => setScreen("home")}
            aria-label="Torna alla home"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="handoff-icon animate-in">
            <Smartphone size={40} />
          </div>
          <p className="eyebrow animate-in">Round {match.round}</p>
          <h1 className="animate-in">Passa il telefono a</h1>
          <div className="team-pill animate-in">
            <span />
            {activeTeam.name}
          </div>
          <p className="handoff-copy animate-in">
            Quando la squadra è pronta, avvia il timer e gira la prima carta.
          </p>
          <button
            className="primary-button light wide animate-in"
            onClick={() => {
              audio.current.play("start");
              setClockMs(match.remainingMs);
              dispatch({ type: "start-turn", now: Date.now() });
            }}
          >
            <Play size={21} fill="currentColor" />
            Siamo pronti
          </button>
        </section>
      );
    }

    if (match.phase === "finished") {
      const winner = match.teams.find(
        (team) => team.id === match.winnerTeamId,
      );
      return (
        <section className={`results-screen color-${winner?.color ?? "coral"}`}>
          <div className="trophy-wrap animate-in">
            <Trophy size={48} />
          </div>
          <p className="eyebrow animate-in">Partita conclusa</p>
          <h1 className="animate-in">Vince {winner?.name}</h1>
          <p className="results-subtitle animate-in">
            {match.round} round · obiettivo {match.settings.targetScore} punti
          </p>
          <div className="results-list">
            {[...match.teams]
              .sort((a, b) => b.score - a.score)
              .map((team, index) => (
                <article
                  className={`result-team color-${team.color} animate-in`}
                  key={team.id}
                >
                  <span className="rank">{index + 1}</span>
                  <div>
                    <strong>{team.name}</strong>
                    <small>
                      {team.correct} corrette · {team.wrong} errori · {team.skipped} salti
                    </small>
                  </div>
                  <div className="result-score">
                    <strong>{team.score}</strong>
                    <small>{Math.round(teamAccuracy(team) * 100)}%</small>
                  </div>
                </article>
              ))}
          </div>
          <div className="result-actions animate-in">
            <button
              className="secondary-button"
              onClick={() => {
                dispatch({ type: "clear" });
                setScreen("home");
              }}
            >
              Home
            </button>
            <button
              className="primary-button"
              onClick={() => {
                audio.current.play("start");
                startMatch(match.settings);
              }}
            >
              <RotateCcw size={19} />
              Rivincita
            </button>
          </div>
        </section>
      );
    }

    if (match.phase === "paused") {
      return (
        <section className={`pause-screen ${activeColor}`}>
          <div className="pause-icon animate-in"><Pause size={42} /></div>
          <p className="eyebrow animate-in">Timer fermo</p>
          <h1 className="animate-in">Partita in pausa</h1>
          <p className="animate-in">{formatClock(match.remainingMs)} rimasti</p>
          <button
            className="primary-button light wide animate-in"
            onClick={() => {
              audio.current.play("start");
              setClockMs(match.remainingMs);
              dispatch({ type: "resume", now: Date.now() });
            }}
          >
            <Play size={21} fill="currentColor" />
            Riprendi
          </button>
          <button
            className="text-button light-text animate-in"
            onClick={() => setScreen("home")}
          >
            Salva e torna alla home
          </button>
        </section>
      );
    }

    const skipUnavailable = activeTeam.skipsRemaining === 0;
    const currentCategory = categories.find(
      (category) => category.id === currentCard?.categoryId,
    );
    const progress = Math.max(
      0,
      Math.min(1, clockMs / (match.settings.durationSec * 1000)),
    );
    return (
      <section className={`game-screen ${activeColor}`}>
        <header className="game-topbar animate-in">
          <div className="active-team-badge">
            <span />
            <div>
              <small>Sta giocando</small>
              <strong>{activeTeam.name}</strong>
            </div>
          </div>
          <button
            className="icon-button glass"
            onClick={() => dispatch({ type: "pause", now: Date.now() })}
            aria-label="Pausa"
          >
            <Pause size={19} fill="currentColor" />
          </button>
        </header>
        <div
          className="score-strip animate-in"
          style={{
            gridTemplateColumns: `repeat(${match.teams.length}, minmax(0, 1fr))`,
          }}
        >
          {match.teams.map((team, index) => (
            <div
              className={`score-chip color-${team.color} ${
                index === match.activeTeamIndex ? "active" : ""
              }`}
              key={team.id}
            >
              <small>{team.name}</small>
              <strong>{team.score}</strong>
            </div>
          ))}
        </div>
        <div className="timer-block animate-in">
          <span>{formatClock(clockMs)}</span>
          <div className="timer-track">
            <i style={{ transform: `scaleX(${progress})` }} />
          </div>
        </div>
        {currentCard && (
          <div
            className={`game-card animate-in ${
              cardFeedback ? `feedback-${cardFeedback}` : ""
            }`}
            ref={cardRef}
            key={currentCard.id}
          >
            <div className="card-head">
              <div className="card-category">
                <DeckIcon name={currentCategory?.icon ?? "tag"} />
                <span>{currentCategory?.title ?? "Mazzo"}</span>
              </div>
              <span className="card-accent" aria-hidden="true" />
            </div>
            <div className="card-word-block">
              <p>Parola da indovinare</p>
              <h1>{titleCase(currentCard.word)}</h1>
            </div>
            <div className="forbidden-section">
              <div className="forbidden-heading">
                <Ban size={17} />
                <div>
                  <strong>Parole da non dire</strong>
                </div>
              </div>
              <div className="forbidden-list">
                {currentCard.forbidden.map((word, index) => (
                  <div key={`${word}-${index}`}>
                    <X size={15} />
                    <span>{titleCase(word)}</span>
                  </div>
                ))}
              </div>
            </div>
            {cardFeedback && (
              <div className={`card-feedback ${cardFeedback}`} aria-live="polite">
                {cardFeedback === "correct" ? (
                  <Check size={30} />
                ) : cardFeedback === "wrong" ? (
                  <X size={30} />
                ) : (
                  <SkipForward size={30} />
                )}
                <strong>
                  {cardFeedback === "correct"
                    ? "Corretta"
                    : cardFeedback === "wrong"
                      ? "Errore"
                      : "Salta"}
                </strong>
              </div>
            )}
          </div>
        )}
        <div className="game-actions animate-in">
          <button
            className="action-button skip"
            disabled={skipUnavailable || interactionLocked}
            onClick={() => playCard("skip")}
          >
            <SkipForward size={25} />
            <span>Salta</span>
            <small>
              {activeTeam.skipsRemaining === null
                ? "∞"
                : activeTeam.skipsRemaining}
            </small>
          </button>
          <button
            className="action-button wrong"
            disabled={interactionLocked}
            onClick={() => playCard("wrong")}
          >
            <X size={27} />
            <span>Errore</span>
          </button>
          <button
            className="action-button correct"
            disabled={interactionLocked}
            onClick={() => playCard("correct")}
          >
            <Check size={28} />
            <span>Corretta</span>
          </button>
        </div>
      </section>
    );
  };

  const renderHistory = () => (
    <>
      <ScreenHeader
        title="Storico"
        subtitle={`${history.length} partite salvate`}
        onBack={() => setScreen("home")}
      />
      {!history.length ? (
        <section className="empty-state animate-in">
          <History size={44} />
          <h2>Ancora nessuna partita</h2>
          <p>I risultati appariranno qui quando completi il primo match.</p>
          <button className="primary-button" onClick={() => setScreen("setup")}>
            Nuova partita
          </button>
        </section>
      ) : (
        <>
          <section className="history-stats animate-in">
            <article>
              <History size={20} />
              <div>
                <strong>{homeStats.games}</strong>
                <span>Partite giocate</span>
              </div>
            </article>
            <article>
              <Target size={20} />
              <div>
                <strong>{homeStats.accuracy}%</strong>
                <span>Accuratezza totale</span>
              </div>
            </article>
          </section>
          <div className="history-list">
            {history.map((item) => {
              const winner = item.teams.find(
                (team) => team.id === item.winnerTeamId,
              );
              return (
                <article className="history-card animate-in" key={item.id}>
                  <div className={`history-trophy color-${winner?.color ?? "coral"}`}>
                    <Trophy size={22} />
                  </div>
                  <div className="history-copy">
                    <strong>{winner?.name}</strong>
                    <small>
                      {formatDate(item.completedAt)} · {item.rounds} round
                    </small>
                    <div>
                      {item.teams.map((team) => (
                        <span key={team.id}>
                          {team.name} <b>{team.score}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    className="icon-button subtle"
                    aria-label="Elimina risultato"
                    onClick={() => {
                      const next = history.filter((entry) => entry.id !== item.id);
                      setHistory(next);
                      localGameRepository.saveHistory(next).catch(() => undefined);
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </article>
              );
            })}
          </div>
          <button
            className="danger-text-button animate-in"
            onClick={() => {
              setHistory([]);
              localGameRepository.clearHistory().catch(() => undefined);
            }}
          >
            <Trash2 size={17} />
            Cancella tutto lo storico
          </button>
        </>
      )}
    </>
  );

  const renderSettings = () => {
    const isIOS =
      /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone;
    return (
      <>
        <ScreenHeader
          title="Impostazioni"
          subtitle="Suoni e installazione"
          onBack={() => setScreen("home")}
        />
        <section className="settings-card animate-in">
          <div className="setting-row">
            <div className="setting-icon">
              {preferences.muted ? <VolumeX size={21} /> : <Volume2 size={21} />}
            </div>
            <div>
              <strong>Effetti sonori</strong>
              <small>Feedback, countdown e vittoria</small>
            </div>
            <button
              className={`switch ${preferences.muted ? "" : "active"}`}
              onClick={() =>
                setPreferences((current) => ({
                  ...current,
                  muted: !current.muted,
                }))
              }
              aria-label={preferences.muted ? "Attiva suoni" : "Disattiva suoni"}
            >
              <i />
            </button>
          </div>
          <label className="volume-row">
            <span>Volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={preferences.volume}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  volume: Number(event.target.value),
                }))
              }
            />
            <b>{Math.round(preferences.volume * 100)}%</b>
          </label>
        </section>
        <section className="install-card animate-in">
          <div className="install-icon"><Download size={28} /></div>
          <div>
            <p className="eyebrow">Gioca offline</p>
            <h2>{isStandalone ? "App installata" : "Installa Taboo"}</h2>
            <p>
              {isStandalone
                ? "Stai usando la versione installata sul dispositivo."
                : isIOS
                  ? "Su iPhone: Condividi → Aggiungi alla schermata Home."
                  : "Aggiungila alla schermata Home per aprirla come un’app."}
            </p>
          </div>
          {!isStandalone && installPrompt && (
            <button className="primary-button compact" onClick={requestInstall}>
              Installa
            </button>
          )}
        </section>
        {match && match.phase !== "finished" && (
          <section className="settings-card danger-zone animate-in">
            <div className="setting-row">
              <div className="setting-icon"><Trash2 size={21} /></div>
              <div>
                <strong>Partita sospesa</strong>
                <small>Elimina il salvataggio corrente</small>
              </div>
              <button
                className="danger-text-button compact"
                onClick={() => {
                  dispatch({ type: "clear" });
                  localGameRepository.deleteActiveMatch().catch(() => undefined);
                }}
              >
                Elimina
              </button>
            </div>
          </section>
        )}
      </>
    );
  };

  const renderRules = () => (
    <>
      <ScreenHeader
        title="Come si gioca"
        subtitle="Regole"
        onBack={() => setScreen("home")}
      />
      <section className="rules-hero animate-in">
        <span className="brand-mark">T</span>
        <h2>Fai indovinare la parola, senza pronunciare quelle vietate.</h2>
      </section>
      <div className="rules-list">
        {[
          ["01", "Passa il telefono", "A ogni turno il suggeritore cambia squadra."],
          ["02", "Descrivi", "Niente gesti, suoni, variazioni o parole vietate."],
          ["03", "Segna il risultato", "Corretta +1, errore −1, oppure usa un salto."],
          ["04", "Completa il giro", "Tutte le squadre giocano lo stesso numero di turni."],
          ["05", "Vinci", "Punteggio, meno salti, accuratezza e infine spareggio."],
        ].map(([number, title, copy]) => (
          <article className="rule-card animate-in" key={number}>
            <span>{number}</span>
            <div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </div>
          </article>
        ))}
      </div>
    </>
  );

  if (!ready) {
    return (
      <main className="app-shell loading-shell">
        <div className="loading-mark">T</div>
        <p>Sto preparando le carte…</p>
      </main>
    );
  }

  return (
    <main className="app-shell" ref={rootRef}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className={`screen-content screen-${screen}`}>
        {storageWarning && (
          <div className="warning-banner">
            <span>{storageWarning}</span>
            <button onClick={() => setStorageWarning("")} aria-label="Chiudi">
              <X size={16} />
            </button>
          </div>
        )}
        {updateRegistration && (
          <div className="update-banner">
            <span>È disponibile una nuova versione.</span>
            <button onClick={applyUpdate}>Aggiorna</button>
          </div>
        )}
        {screen === "home" && renderHome()}
        {screen === "setup" && renderSetup()}
        {screen === "game" && renderGame()}
        {screen === "history" && renderHistory()}
        {screen === "settings" && renderSettings()}
        {screen === "rules" && renderRules()}
      </div>
      {screen !== "game" && screen !== "setup" && screen !== "rules" && (
        <BottomNav current={screen} onNavigate={setScreen} />
      )}
    </main>
  );
}
