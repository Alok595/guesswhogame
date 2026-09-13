import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { CHARACTERS_LIST, GameItem } from '../constants/categories';
import { UserProfile } from '../utils/storage';

interface OnboardingModalProps {
  visible: boolean;
  onComplete: (profile: UserProfile) => void;
  initialProfile?: UserProfile | null;
  onClose?: () => void;
}

const { width } = Dimensions.get('window');

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  visible,
  onComplete,
  initialProfile,
  onClose,
}) => {
  // Form state: ONLY Name, Age, and Character!
  const [name, setName] = useState('Detective');
  const [age, setAge] = useState(24);
  const [selectedCharacter, setSelectedCharacter] = useState<GameItem>(CHARACTERS_LIST[0]);
  const [genderFilter, setGenderFilter] = useState<'all' | 'Male' | 'Female'>('all');

  // Sync with initial profile if editing
  useEffect(() => {
    if (initialProfile) {
      if (initialProfile.name) setName(initialProfile.name);
      if (initialProfile.age) setAge(initialProfile.age);
      if (initialProfile.avatarCharacterId) {
        const found = CHARACTERS_LIST.find((c) => c.id === initialProfile.avatarCharacterId);
        if (found) setSelectedCharacter(found);
      }
    }
  }, [initialProfile, visible]);

  // Filtered characters list
  const filteredCharacters = useMemo(() => {
    if (genderFilter === 'all') return CHARACTERS_LIST;
    return CHARACTERS_LIST.filter((c) => c.traits.gender === genderFilter);
  }, [genderFilter]);

  const handleSubmit = () => {
    const cleanName = name.trim() || 'Detective';
    const profile: UserProfile = {
      name: cleanName,
      age: Math.max(5, Math.min(100, age)),
      avatarCharacterId: selectedCharacter.id,
      avatarUrl: selectedCharacter.avatar,
      completed: true,
      createdAt: initialProfile?.createdAt || new Date().toISOString(),
      coins: initialProfile?.coins !== undefined ? initialProfile.coins : 1000,
      xp: initialProfile?.xp || 0,
      level: initialProfile?.level || 1,
      wins: initialProfile?.wins || 0,
      losses: initialProfile?.losses || 0,
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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <View style={styles.badgePill}>
                <Text style={styles.badgePillText}>
                  {initialProfile ? 'EDIT PROFILE' : 'DETECTIVE REGISTRATION'}
                </Text>
              </View>
              {onClose && initialProfile && (
                <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.title}>
              {initialProfile ? 'Update Detective Identity' : 'Welcome to Guess Who!'}
            </Text>
            <Text style={styles.subtitle}>
              Set your name, age, and signature suspect avatar to duel online.
            </Text>
          </View>

          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. NAME INPUT */}
            <View style={styles.inputSection}>
              <Text style={styles.sectionLabel}>DETECTIVE NAME</Text>
              <View style={styles.textInputWrap}>
                <Text style={styles.inputEmoji}>🕵️</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your name (e.g. Sherlock)"
                  placeholderTextColor="#64748B"
                  value={name}
                  onChangeText={setName}
                  maxLength={20}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* 2. AGE SELECTOR */}
            <View style={styles.inputSection}>
              <Text style={styles.sectionLabel}>AGE</Text>
              <View style={styles.ageRow}>
                <TouchableOpacity
                  style={styles.ageBtn}
                  onPress={() => setAge((prev) => Math.max(5, prev - 1))}
                  activeOpacity={0.7}
                >
                  <Text style={styles.ageBtnText}>−</Text>
                </TouchableOpacity>

                <View style={styles.ageValueBox}>
                  <Text style={styles.ageValueText}>{age}</Text>
                  <Text style={styles.ageUnitText}>YEARS OLD</Text>
                </View>

                <TouchableOpacity
                  style={styles.ageBtn}
                  onPress={() => setAge((prev) => Math.min(99, prev + 1))}
                  activeOpacity={0.7}
                >
                  <Text style={styles.ageBtnText}>+</Text>
                </TouchableOpacity>

                {/* Quick Age Presets */}
                <View style={styles.quickAgePresets}>
                  {[12, 18, 25, 35].map((preset) => (
                    <TouchableOpacity
                      key={preset}
                      style={[
                        styles.quickPresetBtn,
                        age === preset && styles.quickPresetBtnActive,
                      ]}
                      onPress={() => setAge(preset)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.quickPresetText,
                          age === preset && styles.quickPresetTextActive,
                        ]}
                      >
                        {preset}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* 3. CHARACTER SELECTION (FIXED & BEAUTIFIED) */}
            <View style={styles.inputSection}>
              <View style={styles.characterHeaderRow}>
                <Text style={styles.sectionLabel}>
                  CHOOSE CHARACTER ({filteredCharacters.length})
                </Text>
                {/* Gender Filters */}
                <View style={styles.filterTabRow}>
                  {(['all', 'Male', 'Female'] as const).map((filter) => (
                    <TouchableOpacity
                      key={filter}
                      style={[
                        styles.filterTab,
                        genderFilter === filter && styles.filterTabActive,
                      ]}
                      onPress={() => setGenderFilter(filter)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.filterTabText,
                          genderFilter === filter && styles.filterTabTextActive,
                        ]}
                      >
                        {filter === 'all' ? 'All' : filter === 'Male' ? 'Men 🧔' : 'Women 👩'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Selected Character Active Banner Preview */}
              <View style={styles.selectedPreviewBanner}>
                <View style={styles.selectedAvatarWrapper}>
                  <Image source={{ uri: selectedCharacter.avatar }} style={styles.selectedAvatarImg} />
                  <View style={styles.selectedCheckBadge}>
                    <Text style={styles.selectedCheckText}>✓</Text>
                  </View>
                </View>
                <View style={styles.selectedPreviewDetails}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.selectedNameText}>{selectedCharacter.name}</Text>
                    <View style={styles.signatureBadge}>
                      <Text style={styles.signatureBadgeText}>YOUR AVATAR</Text>
                    </View>
                  </View>
                  <Text style={styles.selectedTraitsText}>
                    {selectedCharacter.traits.gender} • {selectedCharacter.traits.hairColor} hair
                    {selectedCharacter.traits.accessories.length > 0 &&
                      ` • ${selectedCharacter.traits.accessories.join(', ')}`}
                  </Text>
                </View>
              </View>

              {/* Character Grid */}
              <View style={styles.characterGrid}>
                {filteredCharacters.map((item) => {
                  const isSelected = selectedCharacter.id === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.charCard, isSelected && styles.charCardSelected]}
                      onPress={() => setSelectedCharacter(item)}
                      activeOpacity={0.75}
                    >
                      {isSelected && (
                        <View style={styles.charBadgeCorner}>
                          <Text style={styles.charBadgeCheck}>✓</Text>
                        </View>
                      )}
                      <Image source={{ uri: item.avatar }} style={styles.charCardImg} />
                      <Text
                        style={[styles.charCardName, isSelected && styles.charCardNameSelected]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Bottom Submit Action */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} activeOpacity={0.88}>
              <Text style={styles.submitBtnText}>
                {initialProfile ? 'SAVE CHANGES ➔' : 'SAVE & START DUELING ➔'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  containerCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '92%',
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#38BDF840',
    overflow: 'hidden',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#131D33',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgePill: {
    backgroundColor: '#0369A135',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0284C7',
    alignSelf: 'flex-start',
  },
  badgePillText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  closeBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  formScroll: {
    flex: 1,
  },
  formScrollContent: {
    padding: 18,
    gap: 16,
  },
  inputSection: {
    gap: 8,
  },
  sectionLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  textInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#334155',
    paddingHorizontal: 14,
    height: 50,
  },
  inputEmoji: {
    fontSize: 20,
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ageBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#38BDF860',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ageBtnText: {
    color: '#38BDF8',
    fontSize: 24,
    fontWeight: '900',
  },
  ageValueBox: {
    minWidth: 80,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  ageValueText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  ageUnitText: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '800',
    marginTop: -2,
  },
  quickAgePresets: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
    justifyContent: 'flex-end',
  },
  quickPresetBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickPresetBtnActive: {
    backgroundColor: '#0284C730',
    borderColor: '#38BDF8',
  },
  quickPresetText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
  },
  quickPresetTextActive: {
    color: '#38BDF8',
  },
  characterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterTabRow: {
    flexDirection: 'row',
    gap: 4,
  },
  filterTab: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterTabActive: {
    backgroundColor: '#0284C740',
    borderColor: '#38BDF8',
  },
  filterTabText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  filterTabTextActive: {
    color: '#38BDF8',
  },
  selectedPreviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    gap: 12,
  },
  selectedAvatarWrapper: {
    position: 'relative',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#38BDF8',
    overflow: 'visible',
  },
  selectedAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  selectedCheckBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#10B981',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  selectedCheckText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  selectedPreviewDetails: {
    flex: 1,
  },
  selectedNameText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  signatureBadge: {
    backgroundColor: '#10B98125',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  signatureBadgeText: {
    color: '#10B981',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  selectedTraitsText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  characterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-start',
    marginTop: 4,
  },
  charCard: {
    width: (width > 440 ? 390 : width - 72) / 4 - 8,
    alignItems: 'center',
    padding: 6,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#334155',
    position: 'relative',
  },
  charCardSelected: {
    backgroundColor: '#1E3A8A',
    borderColor: '#38BDF8',
    elevation: 6,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  charBadgeCorner: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#10B981',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  charBadgeCheck: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  charCardImg: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0F172A',
  },
  charCardName: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  charCardNameSelected: {
    color: '#38BDF8',
    fontWeight: '900',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#131D33',
  },
  submitBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
