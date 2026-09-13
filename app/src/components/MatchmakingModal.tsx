import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { CHARACTERS_LIST } from '../constants/categories';

interface PlayerInfo {
  name: string;
  avatar?: string | null;
}

interface MatchmakingModalProps {
  visible: boolean;
  status: 'searching' | 'matched';
  player1: PlayerInfo;
  player2?: PlayerInfo | null;
  onCancel: () => void;
  onMatchAnimationComplete: () => void;
}

export const MatchmakingModal: React.FC<MatchmakingModalProps> = ({
  visible,
  status,
  player1,
  player2,
  onCancel,
  onMatchAnimationComplete,
}) => {
  // Search animation refs
  const radarSpin = useRef(new Animated.Value(0)).current;
  const pulseRing1 = useRef(new Animated.Value(0)).current;
  const pulseRing2 = useRef(new Animated.Value(0)).current;
  const pulseRing3 = useRef(new Animated.Value(0)).current;

  // Match found animation refs
  const vsScale = useRef(new Animated.Value(0)).current;
  const p1Slide = useRef(new Animated.Value(-120)).current;
  const p2Slide = useRef(new Animated.Value(120)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const [searchSeconds, setSearchSeconds] = useState(0);
  const [cyclingIndex, setCyclingIndex] = useState(0);

  // Search Timer
  useEffect(() => {
    if (!visible || status !== 'searching') {
      setSearchSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setSearchSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, status]);

  // Cycling random suspects in radar
  useEffect(() => {
    if (!visible || status !== 'searching') return;
    const interval = setInterval(() => {
      setCyclingIndex((i) => (i + 1) % CHARACTERS_LIST.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [visible, status]);

  // Radar Loop Animations
  useEffect(() => {
    if (visible && status === 'searching') {
      // Rotate sweep
      const spinAnimation = Animated.loop(
        Animated.timing(radarSpin, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spinAnimation.start();

      // Pulse rings sequence
      const createPulse = (val: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(val, {
              toValue: 1,
              duration: 2400,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(val, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const p1 = createPulse(pulseRing1, 0);
      const p2 = createPulse(pulseRing2, 800);
      const p3 = createPulse(pulseRing3, 1600);

      p1.start();
      p2.start();
      p3.start();

      return () => {
        spinAnimation.stop();
        p1.stop();
        p2.stop();
        p3.stop();
      };
    }
  }, [visible, status]);

  // Match Found Sequence Animation
  useEffect(() => {
    if (visible && status === 'matched') {
      // 1. Flash effect
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();

      // 2. Slide players and pop VS badge
      Animated.parallel([
        Animated.spring(p1Slide, { toValue: 0, tension: 70, friction: 7, useNativeDriver: true }),
        Animated.spring(p2Slide, { toValue: 0, tension: 70, friction: 7, useNativeDriver: true }),
        Animated.spring(vsScale, { toValue: 1, tension: 90, friction: 6, useNativeDriver: true }),
        Animated.timing(progressAnim, { toValue: 1, duration: 2500, easing: Easing.linear, useNativeDriver: false }),
      ]).start();

      // Transition to game after 2.6s
      const timeout = setTimeout(() => {
        onMatchAnimationComplete();
      }, 2600);

      return () => clearTimeout(timeout);
    } else {
      // Reset values
      vsScale.setValue(0);
      p1Slide.setValue(-120);
      p2Slide.setValue(120);
      flashOpacity.setValue(0);
      progressAnim.setValue(0);
    }
  }, [visible, status]);

  const spin = radarSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const p1Avatar = player1.avatar || 'https://api.dicebear.com/9.x/adventurer/png?seed=Player1&backgroundColor=b6e3f4';
  const p2Avatar = player2?.avatar || 'https://api.dicebear.com/9.x/adventurer/png?seed=Player2&backgroundColor=ffd5dc';

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        {/* Flash Overlay on Match */}
        <Animated.View style={[styles.flashOverlay, { opacity: flashOpacity }]} pointerEvents="none" />

        <View style={styles.cardContainer}>
          {/* ====================================================
              PHASE 1: SEARCHING RADAR
              ==================================================== */}
          {status === 'searching' && (
            <View style={styles.contentBox}>
              <View style={styles.headerPill}>
                <View style={styles.livePulseDot} />
                <Text style={styles.headerPillText}>LIVE MATCHMAKING</Text>
              </View>

              <Text style={styles.mainTitle}>Searching for Opponent...</Text>
              <Text style={styles.subTitle}>Scanning active detectives worldwide</Text>

              {/* Radar Viewport */}
              <View style={styles.radarViewport}>
                {/* Expanding Pulse Waves */}
                {[pulseRing1, pulseRing2, pulseRing3].map((val, idx) => {
                  const scale = val.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 2.8],
                  });
                  const opacity = val.interpolate({
                    inputRange: [0, 0.7, 1],
                    outputRange: [0.7, 0.25, 0],
                  });
                  return (
                    <Animated.View
                      key={idx}
                      style={[
                        styles.pulseRing,
                        {
                          transform: [{ scale }],
                          opacity,
                        },
                      ]}
                    />
                  );
                })}

                {/* Rotating Sweep Beam */}
                <Animated.View
                  style={[
                    styles.sweepBeam,
                    {
                      transform: [{ rotate: spin }],
                    },
                  ]}
                />

                {/* Compass Blips (Scanning suspects) */}
                <View style={styles.blipNorth}>
                  <Image
                    source={{ uri: CHARACTERS_LIST[cyclingIndex].avatar }}
                    style={styles.blipAvatar}
                  />
                </View>
                <View style={styles.blipSouth}>
                  <Image
                    source={{ uri: CHARACTERS_LIST[(cyclingIndex + 5) % CHARACTERS_LIST.length].avatar }}
                    style={styles.blipAvatar}
                  />
                </View>

                {/* Center User Avatar */}
                <View style={styles.radarCenterUser}>
                  <Image source={{ uri: p1Avatar }} style={styles.centerAvatarImg} />
                  <View style={styles.centerBadge}>
                    <Text style={{ fontSize: 10 }}>🔍</Text>
                  </View>
                </View>
              </View>

              {/* Timer & Detective Name */}
              <View style={styles.timerBadge}>
                <Text style={styles.timerText}>
                  Searching: 0:{searchSeconds < 10 ? `0${searchSeconds}` : searchSeconds}
                </Text>
              </View>

              <Text style={styles.playerNameFooter}>
                Queued as: <Text style={{ color: '#38BDF8', fontWeight: '900' }}>{player1.name}</Text>
              </Text>

              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
                <Text style={styles.cancelBtnText}>Cancel Search ✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ====================================================
              PHASE 2: MATCH FOUND (P1 VS P2 CLASH)
              ==================================================== */}
          {status === 'matched' && (
            <View style={styles.contentBox}>
              <View style={styles.matchFoundBanner}>
                <Text style={styles.matchFoundEmoji}>⚡</Text>
                <Text style={styles.matchFoundTitle}>MATCH FOUND!</Text>
                <Text style={styles.matchFoundEmoji}>⚡</Text>
              </View>

              <Text style={styles.matchFoundSubtitle}>Prepare your deduction strategy!</Text>

              {/* Player 1 vs Player 2 Duel Stage */}
              <View style={styles.duelStage}>
                {/* Player 1 Card (You) */}
                <Animated.View
                  style={[
                    styles.playerCard,
                    styles.p1CardBorder,
                    { transform: [{ translateX: p1Slide }] },
                  ]}
                >
                  <View style={styles.p1RoleTag}>
                    <Text style={styles.roleTagText}>YOU</Text>
                  </View>
                  <Image source={{ uri: p1Avatar }} style={styles.playerDuelAvatar} />
                  <Text style={styles.playerDuelName} numberOfLines={1}>
                    {player1.name}
                  </Text>
                  <Text style={styles.playerStatusText}>Ready 🟢</Text>
                </Animated.View>

                {/* VS Glowing Badge */}
                <Animated.View
                  style={[
                    styles.vsBadgeContainer,
                    { transform: [{ scale: vsScale }] },
                  ]}
                >
                  <Text style={styles.vsText}>VS</Text>
                  <View style={styles.vsGlowLine} />
                </Animated.View>

                {/* Player 2 Card (Opponent) */}
                <Animated.View
                  style={[
                    styles.playerCard,
                    styles.p2CardBorder,
                    { transform: [{ translateX: p2Slide }] },
                  ]}
                >
                  <View style={styles.p2RoleTag}>
                    <Text style={styles.roleTagText}>OPPONENT</Text>
                  </View>
                  <Image source={{ uri: p2Avatar }} style={styles.playerDuelAvatar} />
                  <Text style={styles.playerDuelName} numberOfLines={1}>
                    {player2?.name || 'Opponent'}
                  </Text>
                  <Text style={styles.playerStatusText}>Connected 🟢</Text>
                </Animated.View>
              </View>

              {/* Progress Countdown Bar */}
              <View style={styles.countdownBox}>
                <Text style={styles.countdownText}>Entering Suspect Selection...</Text>
                <View style={styles.progressBarTrack}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F59E0B',
  },
  cardContainer: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0F172A',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#38BDF8',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  contentBox: {
    width: '100%',
    alignItems: 'center',
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0369A1',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 8,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
  },
  headerPillText: {
    color: '#E0F2FE',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  mainTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  subTitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 20,
  },
  radarViewport: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#020617',
    borderWidth: 2,
    borderColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginVertical: 12,
  },
  pulseRing: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#38BDF8',
  },
  sweepBeam: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderTopWidth: 3,
    borderColor: 'rgba(56, 189, 248, 0.7)',
    backgroundColor: 'transparent',
  },
  radarCenterUser: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2.5,
    borderColor: '#38BDF8',
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    zIndex: 10,
  },
  centerAvatarImg: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  centerBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#0284C7',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  blipNorth: {
    position: 'absolute',
    top: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    overflow: 'hidden',
    opacity: 0.6,
  },
  blipSouth: {
    position: 'absolute',
    bottom: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#10B981',
    overflow: 'hidden',
    opacity: 0.6,
  },
  blipAvatar: {
    width: '100%',
    height: '100%',
  },
  timerBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 12,
  },
  timerText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  playerNameFooter: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 16,
  },
  cancelBtn: {
    width: '100%',
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  cancelBtnText: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '800',
  },

  // Match Found Styles
  matchFoundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#78350F44',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 6,
  },
  matchFoundEmoji: {
    fontSize: 18,
  },
  matchFoundTitle: {
    color: '#F59E0B',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  matchFoundSubtitle: {
    color: '#CBD5E1',
    fontSize: 12,
    marginBottom: 20,
  },
  duelStage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 10,
  },
  playerCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    position: 'relative',
  },
  p1CardBorder: {
    borderColor: '#38BDF8',
    backgroundColor: '#0F2647',
  },
  p2CardBorder: {
    borderColor: '#EC4899',
    backgroundColor: '#381329',
  },
  p1RoleTag: {
    position: 'absolute',
    top: -9,
    backgroundColor: '#0284C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  p2RoleTag: {
    position: 'absolute',
    top: -9,
    backgroundColor: '#BE185D',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleTagText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  playerDuelAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginVertical: 6,
  },
  playerDuelName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  playerStatusText: {
    color: '#4ADE80',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  vsBadgeContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.8,
    shadowRadius: 14,
    elevation: 10,
  },
  vsText: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  vsGlowLine: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    opacity: 0.7,
  },
  countdownBox: {
    width: '100%',
    marginTop: 20,
    alignItems: 'center',
  },
  countdownText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
});
