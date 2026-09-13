// Universal Cross-Platform In-Game Voice Engine (Android, iOS & Web)
// Supports Native Android/iOS via expo-audio & Web Browser via MediaRecorder
import { Platform } from 'react-native';
import { Socket } from 'socket.io-client';
import * as FileSystem from 'expo-file-system/legacy';
import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  createAudioPlayer,
  setAudioModeAsync,
} from 'expo-audio';

export interface VoiceState {
  isConnected: boolean;
  isConnecting: boolean;
  isRecording: boolean;
  isMicMuted: boolean;
  isSpeakerDeafened: boolean;
  isLocalSpeaking: boolean;
  isRemoteSpeaking: boolean;
  error?: string | null;
}

type VoiceStateListener = (state: VoiceState) => void;

class VoiceChatManager {
  private socket: Socket | null = null;
  private roomId: string | null = null;

  // Native mobile recorder & player
  private nativeRecorder: any = null;
  private nativePlayer: any = null;

  // Web recorder & stream
  private webMediaRecorder: any = null;
  private webMediaStream: any = null;
  private webAudioChunks: any[] = [];
  private webCurrentAudio: any = null;

  private permissionGranted: boolean = false;

  private state: VoiceState = {
    isConnected: false,
    isConnecting: false,
    isRecording: false,
    isMicMuted: false,
    isSpeakerDeafened: false,
    isLocalSpeaking: false,
    isRemoteSpeaking: false,
    error: null,
  };

  private listeners: Set<VoiceStateListener> = new Set();

  public subscribe(listener: VoiceStateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private updateState(partial: Partial<VoiceState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l(this.state));
  }

  public getState(): VoiceState {
    return this.state;
  }

  // --- PERMISSION REQUEST ---
  public async requestMicPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Stop initial test stream
          stream.getTracks().forEach((t) => t.stop());
          this.permissionGranted = true;
          this.updateState({ error: null });
          return true;
        }
        return false;
      } else {
        // Native mobile (Android / iOS)
        const response = await requestRecordingPermissionsAsync();
        this.permissionGranted = response?.granted ?? false;
        if (!this.permissionGranted) {
          this.updateState({
            error: 'Microphone permission denied. Allow mic access in settings.',
          });
        } else {
          this.updateState({ error: null });
        }
        return this.permissionGranted;
      }
    } catch (err: any) {
      console.warn('Microphone permission error:', err);
      this.updateState({
        error: 'Microphone permission request failed. Check device settings.',
      });
      return false;
    }
  }

  // --- JOIN VOICE ROOM ---
  public async joinVoiceRoom(socket: Socket, roomId: string) {
    this.leaveVoiceRoom(); // Clean up previous session

    this.socket = socket;
    this.roomId = roomId;
    this.updateState({ isConnecting: true, error: null });

    try {
      if (Platform.OS !== 'web') {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        }).catch(() => {});
      }

      await this.requestMicPermission();

      // Listen for opponent audio
      this.socket.on('voice_audio_stream', async ({ audioBase64 }: { audioBase64: string }) => {
        if (this.state.isSpeakerDeafened) return;
        await this.playIncomingAudio(audioBase64);
      });

      // Listen for opponent speaking status
      this.socket.on('voice_speaking_state', ({ isSpeaking }: { isSpeaking: boolean }) => {
        this.updateState({ isRemoteSpeaking: isSpeaking });
      });

      this.socket.on('voice_peer_left', () => {
        this.updateState({ isRemoteSpeaking: false });
      });

      this.socket.emit('voice_join', { roomId });
      this.updateState({ isConnected: true, isConnecting: false, error: null });
    } catch (err: any) {
      console.warn('Error joining voice room:', err);
      this.updateState({
        isConnected: false,
        isConnecting: false,
        error: 'Could not connect to voice channel.',
      });
    }
  }

  // --- START TALKING (PUSH-TO-TALK) ---
  public async startTalking(): Promise<boolean> {
    if (this.state.isMicMuted) {
      this.updateState({ error: 'Mic is muted. Unmute to speak!' });
      return false;
    }

    if (!this.permissionGranted) {
      const granted = await this.requestMicPermission();
      if (!granted) return false;
    }

    try {
      if (Platform.OS === 'web') {
        // --- WEB RECORDER ---
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          this.webMediaStream = stream;
          this.webAudioChunks = [];

          const mimeType = (window as any).MediaRecorder?.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : 'audio/mp4';

          const mr = new (window as any).MediaRecorder(stream, { mimeType });
          this.webMediaRecorder = mr;

          mr.ondataavailable = (e: any) => {
            if (e.data && e.data.size > 0) {
              this.webAudioChunks.push(e.data);
            }
          };

          mr.start();
          this.updateState({ isRecording: true, isLocalSpeaking: true, error: null });
          if (this.socket && this.roomId) {
            this.socket.emit('voice_speaking_state', { roomId: this.roomId, isSpeaking: true });
          }
          return true;
        }
        return false;
      } else {
        // --- NATIVE ANDROID / IOS RECORDER ---
        const recorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
        await recorder.prepareToRecordAsync();
        recorder.record();
        this.nativeRecorder = recorder;

        this.updateState({ isRecording: true, isLocalSpeaking: true, error: null });
        if (this.socket && this.roomId) {
          this.socket.emit('voice_speaking_state', { roomId: this.roomId, isSpeaking: true });
        }
        return true;
      }
    } catch (err: any) {
      console.warn('Failed to start recording voice:', err);
      this.updateState({
        isRecording: false,
        isLocalSpeaking: false,
        error: 'Microphone recording error. Check mic permission.',
      });
      return false;
    }
  }

  // --- STOP TALKING & TRANSMIT AUDIO ---
  public async stopTalkingAndSend(): Promise<void> {
    if (Platform.OS === 'web') {
      // --- WEB STOP & TRANSMIT ---
      if (this.webMediaRecorder && this.webMediaRecorder.state !== 'inactive') {
        const mr = this.webMediaRecorder;
        this.webMediaRecorder = null;

        mr.onstop = () => {
          const blob = new Blob(this.webAudioChunks, { type: 'audio/webm' });
          this.webAudioChunks = [];

          if (this.webMediaStream) {
            this.webMediaStream.getTracks().forEach((track: any) => track.stop());
            this.webMediaStream = null;
          }

          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result as string;
            if (base64Audio && this.socket && this.roomId) {
              this.socket.emit('voice_audio_stream', {
                roomId: this.roomId,
                audioBase64: base64Audio,
              });
            }
          };
          reader.readAsDataURL(blob);
        };

        try {
          mr.stop();
        } catch {}
      }

      this.updateState({ isRecording: false, isLocalSpeaking: false });
      if (this.socket && this.roomId) {
        this.socket.emit('voice_speaking_state', { roomId: this.roomId, isSpeaking: false });
      }
    } else {
      // --- NATIVE STOP & TRANSMIT ---
      if (!this.nativeRecorder) {
        this.updateState({ isRecording: false, isLocalSpeaking: false });
        return;
      }

      try {
        const rec = this.nativeRecorder;
        this.nativeRecorder = null;

        await rec.stop();
        const uri = rec.uri;

        this.updateState({ isRecording: false, isLocalSpeaking: false });
        if (this.socket && this.roomId) {
          this.socket.emit('voice_speaking_state', { roomId: this.roomId, isSpeaking: false });
        }

        if (!uri) return;

        let base64Audio = '';
        try {
          const rawBase64 = await FileSystem.readAsStringAsync(uri, {
            encoding: 'base64' as any,
          });
          // Use standard audio/mp4 MIME for universal browser & phone compatibility
          base64Audio = `data:audio/mp4;base64,${rawBase64}`;
        } catch {
          // Fallback if file system read fails
          const response = await fetch(uri);
          const blob = await response.blob();
          base64Audio = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result as string;
              resolve(res.replace('data:audio/m4a', 'data:audio/mp4'));
            };
            reader.readAsDataURL(blob);
          });
        }

        if (base64Audio && this.socket && this.roomId) {
          this.socket.emit('voice_audio_stream', {
            roomId: this.roomId,
            audioBase64: base64Audio,
          });
        }
      } catch (err) {
        console.warn('Error transmitting recorded voice audio:', err);
        this.updateState({ isRecording: false, isLocalSpeaking: false });
      }
    }
  }

  // --- PLAY INCOMING OPPONENT AUDIO ---
  private async playIncomingAudio(audioBase64: string) {
    if (!audioBase64) return;

    try {
      this.updateState({ isRemoteSpeaking: true });

      if (Platform.OS === 'web') {
        if (this.webCurrentAudio) {
          try {
            this.webCurrentAudio.pause();
          } catch {}
          this.webCurrentAudio = null;
        }

        // Standardize audio/m4a to audio/mp4 for Chrome/Edge/Firefox
        let cleanUri = audioBase64;
        if (cleanUri.startsWith('data:audio/m4a')) {
          cleanUri = cleanUri.replace('data:audio/m4a', 'data:audio/mp4');
        }

        const audio = new (window as any).Audio(cleanUri);
        this.webCurrentAudio = audio;
        audio.volume = 1.0;
        audio.onended = () => {
          this.updateState({ isRemoteSpeaking: false });
        };
        audio.onerror = (e: any) => {
          console.warn('Web audio playback error:', e);
          this.updateState({ isRemoteSpeaking: false });
        };
        await audio.play().catch((err: any) => {
          console.warn('Audio play was prevented or failed:', err);
          this.updateState({ isRemoteSpeaking: false });
        });
      } else {
        // Native mobile audio player (Android / iOS)
        if (this.nativePlayer) {
          try {
            this.nativePlayer.pause();
          } catch {}
          this.nativePlayer = null;
        }

        // Android ExoPlayer requires a file:// URI rather than a raw data: URI
        const isWebm = audioBase64.startsWith('data:audio/webm');
        const ext = isWebm ? '.webm' : '.mp4';
        const tempFile = `${FileSystem.cacheDirectory}incoming_voice_${Date.now()}${ext}`;

        const rawBase64 = audioBase64.includes('base64,')
          ? audioBase64.split('base64,')[1]
          : audioBase64;

        await FileSystem.writeAsStringAsync(tempFile, rawBase64, {
          encoding: 'base64' as any,
        });

        const player = createAudioPlayer(tempFile);
        this.nativePlayer = player;
        if (player) {
          player.volume = 1.0;
          player.play();
          setTimeout(() => {
            this.updateState({ isRemoteSpeaking: false });
          }, 3500);
        }
      }
    } catch (err) {
      console.warn('Error playing incoming voice audio:', err);
      this.updateState({ isRemoteSpeaking: false });
    }
  }

  // --- CONTROLS ---
  public toggleMic(muted?: boolean): boolean {
    const newMute = muted !== undefined ? muted : !this.state.isMicMuted;
    this.updateState({ isMicMuted: newMute });
    if (newMute && this.state.isRecording) {
      this.stopTalkingAndSend();
    }
    return newMute;
  }

  public toggleSpeaker(deafened?: boolean): boolean {
    const newDeaf = deafened !== undefined ? deafened : !this.state.isSpeakerDeafened;
    this.updateState({ isSpeakerDeafened: newDeaf });
    if (newDeaf) {
      if (this.nativePlayer) {
        try {
          this.nativePlayer.pause();
        } catch {}
      }
      if (this.webCurrentAudio) {
        try {
          this.webCurrentAudio.pause();
        } catch {}
      }
      this.updateState({ isRemoteSpeaking: false });
    }
    return newDeaf;
  }

  // --- CLEANUP ---
  public leaveVoiceRoom() {
    if (this.nativeRecorder) {
      try {
        this.nativeRecorder.stop();
      } catch {}
      this.nativeRecorder = null;
    }

    if (this.nativePlayer) {
      try {
        this.nativePlayer.pause();
      } catch {}
      this.nativePlayer = null;
    }

    if (this.webMediaStream) {
      try {
        this.webMediaStream.getTracks().forEach((t: any) => t.stop());
      } catch {}
      this.webMediaStream = null;
    }

    if (this.webCurrentAudio) {
      try {
        this.webCurrentAudio.pause();
      } catch {}
      this.webCurrentAudio = null;
    }

    if (this.socket && this.roomId) {
      this.socket.emit('voice_leave', { roomId: this.roomId });
      this.socket.off('voice_audio_stream');
      this.socket.off('voice_speaking_state');
      this.socket.off('voice_peer_left');
    }

    this.socket = null;
    this.roomId = null;
    this.updateState({
      isConnected: false,
      isConnecting: false,
      isRecording: false,
      isLocalSpeaking: false,
      isRemoteSpeaking: false,
      error: null,
    });
  }
}

export const voiceManager = new VoiceChatManager();
