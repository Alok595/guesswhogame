import { Platform } from 'react-native';

const DEFAULT_SERVER_MUSIC = 'https://guesswhogame.onrender.com/music/bg_music.mp3';
const ONLINE_FALLBACK_MUSIC = 'https://archive.org/download/satie_gymnopedieI_20251213/satie_gymnopedieI_20251213.mp3';

let ExpoAudioModule: any = null;
try {
  ExpoAudioModule = require('expo-audio');
} catch {
  ExpoAudioModule = null;
}

class SoundManager {
  private currentMusicUrl: string = DEFAULT_SERVER_MUSIC;
  private bgPlayer: any = null;
  private isPlaying: boolean = false;
  private volume: number = 0.5; // 0.0 to 1.0
  private isMuted: boolean = false;
  private musicEnabled: boolean = true;
  private sfxEnabled: boolean = true;
  private htmlAudio: any = null;
  private hasInteractionListener: boolean = false;

  constructor() {
    this.initAudioMode();
    this.setupWebAutoUnlock();
  }

  public setServerUrl(serverBaseUrl: string) {
    if (serverBaseUrl) {
      const clean = serverBaseUrl.replace(/\/+$/, '');
      this.currentMusicUrl = `${clean}/music/bg_music.mp3`;
    }
  }

  private async initAudioMode() {
    try {
      if (Platform.OS !== 'web' && ExpoAudioModule?.setAudioModeAsync) {
        await ExpoAudioModule.setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
        });
      }
    } catch {
      // Ignore audio mode init error
    }
  }

  private setupWebAutoUnlock() {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && !this.hasInteractionListener) {
      this.hasInteractionListener = true;
      const unlock = () => {
        if (this.musicEnabled && !this.isMuted && !this.isPlaying) {
          this.startMusic();
        }
        window.removeEventListener('click', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('click', unlock, { once: true });
      window.addEventListener('touchstart', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
    }
  }

  public async startMusic() {
    if (!this.musicEnabled || this.isMuted) return;

    // 1. Web HTML5 Audio
    if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).Audio) {
      try {
        if (this.htmlAudio) {
          try {
            this.htmlAudio.pause();
          } catch {}
          this.htmlAudio = null;
        }

        const audio = new (window as any).Audio(this.currentMusicUrl);
        audio.loop = true;
        audio.volume = this.volume;
        this.htmlAudio = audio;

        audio.onerror = () => {
          // Fallback to online CDN if local server is unreachable on web
          if (this.htmlAudio && this.currentMusicUrl !== ONLINE_FALLBACK_MUSIC) {
            this.htmlAudio.src = ONLINE_FALLBACK_MUSIC;
            this.htmlAudio.play().catch(() => {});
          }
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              this.isPlaying = true;
            })
            .catch(() => {
              this.isPlaying = false;
            });
        }
      } catch {
        this.isPlaying = false;
      }
      return;
    }

    // 2. Native Expo Audio (expo-audio SDK 57)
    if (ExpoAudioModule?.createAudioPlayer) {
      try {
        if (this.bgPlayer) {
          try {
            this.bgPlayer.pause();
          } catch {}
          this.bgPlayer = null;
        }

        const player = ExpoAudioModule.createAudioPlayer(this.currentMusicUrl);
        if (player) {
          player.loop = true;
          player.volume = this.volume;
          player.muted = this.isMuted;
          player.play();
          this.bgPlayer = player;
          this.isPlaying = true;
        }
      } catch (err) {
        console.warn('Native bg music play failed, trying fallback:', err);
        try {
          const fallbackPlayer = ExpoAudioModule.createAudioPlayer(ONLINE_FALLBACK_MUSIC);
          if (fallbackPlayer) {
            fallbackPlayer.loop = true;
            fallbackPlayer.volume = this.volume;
            fallbackPlayer.muted = this.isMuted;
            fallbackPlayer.play();
            this.bgPlayer = fallbackPlayer;
            this.isPlaying = true;
          }
        } catch {}
      }
    }
  }

  public async pauseMusic() {
    try {
      if (this.htmlAudio) {
        this.htmlAudio.pause();
      }
      if (this.bgPlayer) {
        this.bgPlayer.pause();
      }
      this.isPlaying = false;
    } catch {
      // Ignore
    }
  }

  public async setVolume(val: number) {
    const clamped = Math.max(0, Math.min(1, val));
    this.volume = clamped;

    try {
      if (this.htmlAudio) {
        this.htmlAudio.volume = this.isMuted ? 0 : this.volume;
      }
      if (this.bgPlayer) {
        this.bgPlayer.volume = this.isMuted ? 0 : this.volume;
      }
    } catch {
      // Ignore
    }
  }

  public async setMuted(muted: boolean) {
    this.isMuted = muted;

    if (muted) {
      if (this.htmlAudio) this.htmlAudio.volume = 0;
      if (this.bgPlayer) this.bgPlayer.muted = true;
    } else {
      if (this.htmlAudio) {
        this.htmlAudio.volume = this.volume;
        if (!this.isPlaying && this.musicEnabled) {
          this.startMusic();
        }
      }
      if (this.bgPlayer) {
        this.bgPlayer.muted = false;
        this.bgPlayer.volume = this.volume;
        if (!this.isPlaying && this.musicEnabled) {
          this.bgPlayer.play();
          this.isPlaying = true;
        }
      } else if (this.musicEnabled) {
        this.startMusic();
      }
    }
  }

  public async setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (enabled) {
      await this.startMusic();
    } else {
      await this.pauseMusic();
    }
  }

  public setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
  }

  public getSettings() {
    return {
      volume: this.volume,
      isMuted: this.isMuted,
      musicEnabled: this.musicEnabled,
      sfxEnabled: this.sfxEnabled,
      isPlaying: this.isPlaying,
    };
  }

  // --- PROCEDURAL SOUND EFFECTS (Web Audio API for instant response) ---
  public playSfx(type: 'click' | 'flip' | 'correct' | 'wrong' | 'ding') {
    if (!this.sfxEnabled || this.isMuted) return;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        const vol = this.volume * 0.35;

        if (type === 'click') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
          gain.gain.setValueAtTime(vol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc.start(now);
          osc.stop(now + 0.05);
        } else if (type === 'flip') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(260, now);
          osc.frequency.exponentialRampToValueAtTime(130, now + 0.1);
          gain.gain.setValueAtTime(vol * 1.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.start(now);
          osc.stop(now + 0.1);
        } else if (type === 'correct') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, now); // C5
          osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
          osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
          gain.gain.setValueAtTime(vol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
        } else if (type === 'wrong') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.linearRampToValueAtTime(110, now + 0.22);
          gain.gain.setValueAtTime(vol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.start(now);
          osc.stop(now + 0.22);
        } else if (type === 'ding') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, now); // A5
          gain.gain.setValueAtTime(vol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          osc.start(now);
          osc.stop(now + 0.18);
        }
      } catch {
        // Ignored
      }
    }
  }

  public async cleanup() {
    try {
      if (this.htmlAudio) {
        this.htmlAudio.pause();
        this.htmlAudio = null;
      }
      if (this.bgPlayer) {
        this.bgPlayer.pause();
        this.bgPlayer = null;
      }
    } catch {}
  }
}

export const soundManager = new SoundManager();
