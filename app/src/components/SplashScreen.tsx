import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Animated,
  Dimensions,
  Easing,
  TouchableOpacity,
} from 'react-native';

interface SplashScreenProps {
  onFinish: () => void;
  minDuration?: number;
}

const { width } = Dimensions.get('window');

const DETECTIVE_PHRASES = [
  '🔍 Analyzing suspect database...',
  '🕵️ Polishing magnifying glasses...',
  '💼 Encrypting Detective HQ hotline...',
  '🪙 Preparing wager prize pool...',
  '✨ Suspect lineup ready. Deduction duel awaits!',
];

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  minDuration = 2800,
}) => {
  const [percent, setPercent] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Initial fade-in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // 2. Continuous logo pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.98,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // 3. Continuous spinner rotation
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotateLoop.start();

    // 4. Progress bar fill
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: minDuration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();

    // 5. Percent number counter & phrase changer
    const intervalTime = 35;
    const totalSteps = minDuration / intervalTime;
    let currentStep = 0;

    const counterInterval = setInterval(() => {
      currentStep++;
      const currentPct = Math.min(100, Math.round((currentStep / totalSteps) * 100));
      setPercent(currentPct);

      const phraseIdx = Math.min(
        DETECTIVE_PHRASES.length - 1,
        Math.floor((currentStep / totalSteps) * DETECTIVE_PHRASES.length)
      );
      setPhraseIndex(phraseIdx);

      if (currentStep >= totalSteps) {
        clearInterval(counterInterval);
        setTimeout(() => {
          // Smooth fade out
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }).start(() => {
            onFinish();
          });
        }, 200);
      }
    }, intervalTime);

    return () => {
      pulseLoop.stop();
      rotateLoop.stop();
      clearInterval(counterInterval);
    };
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const handleSkip = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onFinish();
    });
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Background Ambient Glow */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      {/* Skip Button in Top Corner */}
      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
        <Text style={styles.skipText}>SKIP ➔</Text>
      </TouchableOpacity>

      {/* Center Logo Showcase */}
      <View style={styles.centerSection}>
        {/* Animated Rotating Radar Ring */}
        <Animated.View
          style={[
            styles.radarRing,
            {
              transform: [{ rotate: spin }],
            },
          ]}
        />

        {/* Pulsing Logo Card */}
        <Animated.View
          style={[
            styles.logoWrapper,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Image
            source={require('../../assets/images/logo.jpg')}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Game Title & Badge */}
        <View style={styles.titleBadge}>
          <Text style={styles.titleBadgeText}>🕵️ 1v1 DETECTIVE DUEL</Text>
        </View>

        <Text style={styles.brandTitle}>GUESS WHO?</Text>
        <Text style={styles.brandSubtitle}>SECRET SUSPECT INVESTIGATION</Text>
      </View>

      {/* Bottom Loading Progress Bar & Status */}
      <View style={styles.bottomSection}>
        {/* Dynamic Phrase */}
        <View style={styles.phraseRow}>
          <Text style={styles.phraseText}>{DETECTIVE_PHRASES[phraseIndex]}</Text>
          <Text style={styles.percentText}>{percent}%</Text>
        </View>

        {/* Progress Track */}
        <View style={styles.progressBarTrack}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: progressWidth,
              },
            ]}
          />
        </View>

        {/* Sub-label */}
        <Text style={styles.footerNote}>
          High-Stakes Deduction • Live Voice Chat • 36 Suspects
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#090D16',
    zIndex: 9999,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  glowTop: {
    position: 'absolute',
    top: -100,
    left: width / 2 - 150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#2563EB20',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -80,
    right: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#7C3AED18',
  },
  skipBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#1E293B99',
    borderWidth: 1,
    borderColor: '#334155',
  },
  skipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  radarRing: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 2,
    borderColor: '#38BDF840',
    borderStyle: 'dashed',
  },
  logoWrapper: {
    width: 190,
    height: 190,
    borderRadius: 95,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#38BDF8',
    elevation: 20,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    backgroundColor: '#0F172A',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  titleBadge: {
    marginTop: 26,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#2563EB30',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  titleBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#60A5FA',
    letterSpacing: 1.5,
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 2,
    marginTop: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(56, 189, 248, 0.4)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 2,
    marginTop: 4,
    textAlign: 'center',
  },
  bottomSection: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  phraseRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  phraseText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  percentText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#38BDF8',
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#38BDF8',
  },
  footerNote: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 14,
    textAlign: 'center',
  },
});
