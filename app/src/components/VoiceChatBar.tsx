import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { voiceManager, VoiceState } from '../utils/voice';

interface VoiceChatBarProps {
  onPressReconnect?: () => void;
  compact?: boolean;
}

export const VoiceChatBar: React.FC<VoiceChatBarProps> = ({ onPressReconnect, compact = false }) => {
  const [voiceState, setVoiceState] = useState<VoiceState>(voiceManager.getState());

  useEffect(() => {
    const unsubscribe = voiceManager.subscribe((st) => {
      setVoiceState(st);
    });
    return unsubscribe;
  }, []);

  const handleStartTalk = async () => {
    await voiceManager.startTalking();
  };

  const handleStopTalk = async () => {
    await voiceManager.stopTalkingAndSend();
  };

  const handleToggleSpeaker = () => {
    voiceManager.toggleSpeaker();
  };

  return (
    <View style={[styles.barContainer, compact && styles.barContainerCompact]}>
      {/* Left: Status & Activity */}
      <View style={styles.statusSection}>
        <View
          style={[
            styles.statusDot,
            voiceState.isConnected
              ? styles.statusDotLive
              : voiceState.isConnecting
              ? styles.statusDotConnecting
              : styles.statusDotOff,
          ]}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.statusLabel}>
            {voiceState.isConnected
              ? 'VOICE CHAT'
              : voiceState.isConnecting
              ? 'CONNECTING VOICE...'
              : 'VOICE OFFLINE'}
          </Text>

          {voiceState.isRemoteSpeaking ? (
            <Text style={styles.speakingRemoteLabel}>Opponent speaking 🗣️</Text>
          ) : voiceState.isRecording ? (
            <Text style={styles.speakingLocalLabel}>Transmitting voice... 🎙️</Text>
          ) : (
            <Text style={styles.subStatusLabel}>
              {voiceState.isConnected ? 'Hold button to talk' : 'Voice ready'}
            </Text>
          )}

          {voiceState.error && (
            <Text style={styles.errorSubLabel} numberOfLines={1}>
              ⚠️ {voiceState.error}
            </Text>
          )}
        </View>
      </View>

      {/* Right: Controls (Hold-to-Talk and Speaker) */}
      <View style={styles.controlsRow}>
        {/* Reconnect / Join Button if not connected */}
        {!voiceState.isConnected && !voiceState.isConnecting && onPressReconnect && (
          <TouchableOpacity style={styles.joinBtn} onPress={onPressReconnect} activeOpacity={0.8}>
            <Text style={styles.joinBtnText}>Join Voice 🎙️</Text>
          </TouchableOpacity>
        )}

        {/* Push-to-Talk (Hold to Speak / Release to Send) Button */}
        <TouchableOpacity
          style={[
            styles.talkBtn,
            voiceState.isRecording ? styles.talkBtnRecording : styles.talkBtnIdle,
          ]}
          onPressIn={handleStartTalk}
          onPressOut={handleStopTalk}
          activeOpacity={0.7}
        >
          <Text style={styles.talkBtnIcon}>{voiceState.isRecording ? '🔴' : '🎙️'}</Text>
          <Text style={styles.talkBtnText}>
            {voiceState.isRecording ? 'RELEASE' : 'HOLD TO TALK'}
          </Text>
        </TouchableOpacity>

        {/* Speaker / Deafen Toggle Button */}
        <TouchableOpacity
          style={[
            styles.speakerBtn,
            voiceState.isSpeakerDeafened ? styles.speakerBtnMuted : styles.speakerBtnActive,
          ]}
          onPress={handleToggleSpeaker}
          activeOpacity={0.8}
        >
          <Text style={styles.speakerBtnIcon}>
            {voiceState.isSpeakerDeafened ? '🔇' : '🔊'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0B1329',
    marginHorizontal: 12,
    marginVertical: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1E3A8A',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  barContainerCompact: {
    marginHorizontal: 0,
    marginVertical: 4,
    paddingVertical: 6,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDotLive: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  statusDotConnecting: {
    backgroundColor: '#F59E0B',
  },
  statusDotOff: {
    backgroundColor: '#64748B',
  },
  statusLabel: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  speakingRemoteLabel: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 1,
  },
  speakingLocalLabel: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 1,
  },
  subStatusLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  errorSubLabel: {
    color: '#F87171',
    fontSize: 9,
    fontWeight: '600',
    maxWidth: 150,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  joinBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  joinBtnText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  talkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  talkBtnIdle: {
    backgroundColor: '#0369A1',
    borderColor: '#38BDF8',
  },
  talkBtnRecording: {
    backgroundColor: '#991B1B',
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 6,
  },
  talkBtnIcon: {
    fontSize: 12,
  },
  talkBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  speakerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  speakerBtnActive: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  speakerBtnMuted: {
    backgroundColor: '#7F1D1D',
    borderColor: '#EF4444',
  },
  speakerBtnIcon: {
    fontSize: 14,
  },
});
