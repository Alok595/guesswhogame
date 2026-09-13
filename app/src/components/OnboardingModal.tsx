import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CHARACTERS_LIST, GameItem } from '../constants/categories';
import { UserProfile } from '../utils/storage';

interface OnboardingModalProps {
  visible: boolean;
  onComplete: (profile: UserProfile) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ visible, onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Profile Form States
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('2000');
  const [birthMonth, setBirthMonth] = useState('01');
  const [birthDay, setBirthDay] = useState('01');
  const [age, setAge] = useState(24);
  const [selectedCharacter, setSelectedCharacter] = useState<GameItem>(CHARACTERS_LIST[0]);

  // Compute suggested age whenever birthYear changes
  const computedAge = useMemo(() => {
    const y = parseInt(birthYear, 10);
    const currentYear = new Date().getFullYear();
    if (!isNaN(y) && y >= 1940 && y <= currentYear) {
      return Math.max(5, Math.min(100, currentYear - y));
    }
    return 20;
  }, [birthYear]);

  const handleNextFromStep2 = () => {
    setAge(computedAge);
    setStep(3);
  };

  const handleFinalSubmit = () => {
    const birthDateStr = `${birthYear.padStart(4, '2000')}-${birthMonth.padStart(2, '01')}-${birthDay.padStart(2, '01')}`;
    const profile: UserProfile = {
      name: name.trim() || 'Detective Guest',
      birthDate: birthDateStr,
      age: Math.max(5, age),
      avatarCharacterId: selectedCharacter.id,
      avatarUrl: selectedCharacter.avatar,
      completed: true,
      createdAt: new Date().toISOString(),
      coins: 1000,
      xp: 0,
      level: 1,
      wins: 0,
      losses: 0,
    };
    onComplete(profile);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.containerCard}>
          {/* Header Banner */}
          <View style={styles.header}>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>DETECTIVE REGISTRATION</Text>
            </View>
            <Text style={styles.title}>WELCOME TO GUESS WHO!</Text>
            <Text style={styles.subtitle}>
              Set up your official detective identity to enter online duels & match with players.
            </Text>

            {/* Stepper Progress Bar */}
            <View style={styles.progressRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <View
                  key={s}
                  style={[
                    styles.progressDot,
                    step === s && styles.progressDotActive,
                    step > s && styles.progressDotPassed,
                  ]}
                />
              ))}
            </View>
          </View>

          {/* STEP 1: NAME */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepIcon}>🕵️‍♂️</Text>
              <Text style={styles.stepHeading}>What is your Detective Name?</Text>
              <Text style={styles.stepDesc}>This name will appear on opponent screens during duels.</Text>

              <TextInput
                style={styles.input}
                placeholder="e.g. Inspector Holmes"
                placeholderTextColor="#64748B"
                value={name}
                onChangeText={setName}
                maxLength={20}
                autoFocus
              />

              <TouchableOpacity
                style={[styles.primaryBtn, !name.trim() && styles.disabledBtn]}
                disabled={!name.trim()}
                onPress={() => setStep(2)}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Continue to Date of Birth ➔</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: DATE OF BIRTH */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepIcon}>📅</Text>
              <Text style={styles.stepHeading}>Enter Your Date of Birth</Text>
              <Text style={styles.stepDesc}>Used to calibrate matchmaking brackets and detective rank.</Text>

              <View style={styles.dateRow}>
                <View style={styles.dateBlock}>
                  <Text style={styles.dateLabel}>DAY (DD)</Text>
                  <TextInput
                    style={styles.dateInput}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="01"
                    placeholderTextColor="#64748B"
                    value={birthDay}
                    onChangeText={setBirthDay}
                  />
                </View>

                <View style={styles.dateBlock}>
                  <Text style={styles.dateLabel}>MONTH (MM)</Text>
                  <TextInput
                    style={styles.dateInput}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="05"
                    placeholderTextColor="#64748B"
                    value={birthMonth}
                    onChangeText={setBirthMonth}
                  />
                </View>

                <View style={[styles.dateBlock, { flex: 1.4 }]}>
                  <Text style={styles.dateLabel}>YEAR (YYYY)</Text>
                  <TextInput
                    style={styles.dateInput}
                    keyboardType="number-pad"
                    maxLength={4}
                    placeholder="2000"
                    placeholderTextColor="#64748B"
                    value={birthYear}
                    onChangeText={setBirthYear}
                  />
                </View>
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                  <Text style={styles.backBtnText}>‹ Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 2 }]}
                  onPress={handleNextFromStep2}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>Continue to Age ➔</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 3: AGE */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepIcon}>🎂</Text>
              <Text style={styles.stepHeading}>Confirm Your Age</Text>
              <Text style={styles.stepDesc}>Calculated from your birth year. Adjust if necessary:</Text>

              <View style={styles.ageSelectorContainer}>
                <TouchableOpacity
                  style={styles.ageStepBtn}
                  onPress={() => setAge((a) => Math.max(5, a - 1))}
                >
                  <Text style={styles.ageStepBtnText}>−</Text>
                </TouchableOpacity>

                <View style={styles.ageDisplayBox}>
                  <Text style={styles.ageNumber}>{age}</Text>
                  <Text style={styles.ageLabel}>YEARS OLD</Text>
                </View>

                <TouchableOpacity
                  style={styles.ageStepBtn}
                  onPress={() => setAge((a) => Math.min(100, a + 1))}
                >
                  <Text style={styles.ageStepBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)}>
                  <Text style={styles.backBtnText}>‹ Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 2 }]}
                  onPress={() => setStep(4)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>Pick Signature Avatar ➔</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 4: SIGNATURE CHARACTER CHOICE */}
          {step === 4 && (
            <View style={[styles.stepContent, { maxHeight: 380 }]}>
              <Text style={styles.stepHeading}>Choose Your Detective Avatar</Text>
              <Text style={styles.stepDesc}>Pick a signature character to represent your profile in matches:</Text>

              <FlatList
                data={CHARACTERS_LIST}
                keyExtractor={(item) => item.id.toString()}
                numColumns={4}
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 220, marginVertical: 8 }}
                renderItem={({ item }) => {
                  const isSelected = selectedCharacter.id === item.id;
                  return (
                    <TouchableOpacity
                      style={[styles.avatarTile, isSelected && styles.avatarTileSelected]}
                      onPress={() => setSelectedCharacter(item)}
                      activeOpacity={0.7}
                    >
                      <Image source={{ uri: item.avatar }} style={styles.avatarImg} />
                      <Text style={styles.avatarName} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />

              <View style={styles.navRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(3)}>
                  <Text style={styles.backBtnText}>‹ Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 2 }]}
                  onPress={() => setStep(5)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>Review Detective Badge ➔</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 5: ID BADGE REVIEW & FINALIZE */}
          {step === 5 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepIcon}>🏅</Text>
              <Text style={styles.stepHeading}>Detective Badge Ready!</Text>
              <Text style={styles.stepDesc}>Here is your official player dossier:</Text>

              <View style={styles.badgeCard}>
                <View style={styles.badgeHeader}>
                  <Text style={styles.badgeTopText}>GUESS WHO? • DETECTIVE LICENSE</Text>
                  <Text style={{ fontSize: 16 }}>🔍</Text>
                </View>

                <View style={styles.badgeBody}>
                  <Image source={{ uri: selectedCharacter.avatar }} style={styles.badgeAvatar} />
                  <View style={styles.badgeDetails}>
                    <Text style={styles.badgeDetectiveName}>{name || 'Detective'}</Text>
                    <Text style={styles.badgeRole}>Signature Suspect: {selectedCharacter.name}</Text>
                    <View style={styles.badgeMetaRow}>
                      <Text style={styles.badgeMeta}>Age: {age}</Text>
                      <Text style={styles.badgeMeta}>•</Text>
                      <Text style={styles.badgeMeta}>DOB: {birthYear}-{birthMonth}-{birthDay}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(4)}>
                  <Text style={styles.backBtnText}>‹ Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, { flex: 2 }]}
                  onPress={handleFinalSubmit}
                  activeOpacity={0.85}
                >
                  <Text style={styles.confirmBtnText}>ENTER ARENA 🚀</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 11, 24, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  containerCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    padding: 20,
    shadowColor: '#38BDF8',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 12,
  },
  badgePill: {
    backgroundColor: '#0369A1',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  badgePillText: {
    color: '#E0F2FE',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  progressDot: {
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1E293B',
  },
  progressDotActive: {
    backgroundColor: '#38BDF8',
    width: 36,
  },
  progressDotPassed: {
    backgroundColor: '#10B981',
  },
  stepContent: {
    alignItems: 'center',
    paddingTop: 8,
  },
  stepIcon: {
    fontSize: 38,
    marginBottom: 6,
  },
  stepHeading: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  stepDesc: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 16,
  },
  input: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginBottom: 16,
  },
  dateBlock: {
    flex: 1,
  },
  dateLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  dateInput: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#334155',
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    paddingVertical: 10,
    textAlign: 'center',
  },
  ageSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: 16,
  },
  ageStepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ageStepBtnText: {
    color: '#38BDF8',
    fontSize: 24,
    fontWeight: '900',
  },
  ageDisplayBox: {
    backgroundColor: '#1E3A8A',
    borderWidth: 2,
    borderColor: '#60A5FA',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ageNumber: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
  },
  ageLabel: {
    color: '#BFDBFE',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  avatarTile: {
    flex: 1,
    margin: 4,
    padding: 6,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
    alignItems: 'center',
  },
  avatarTileSelected: {
    borderColor: '#38BDF8',
    backgroundColor: '#0369A1',
  },
  avatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginBottom: 4,
  },
  avatarName: {
    color: '#F8FAFC',
    fontSize: 9,
    fontWeight: '800',
  },
  badgeCard: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    padding: 12,
    marginBottom: 16,
  },
  badgeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 6,
    marginBottom: 8,
  },
  badgeTopText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  badgeBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgeAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  badgeDetails: {
    flex: 1,
  },
  badgeDetectiveName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  badgeRole: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  badgeMetaRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  badgeMeta: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
  backBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '800',
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  disabledBtn: {
    opacity: 0.4,
  },
  confirmBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
