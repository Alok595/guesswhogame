import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  StatusBar,
  Image,
  FlatList,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io, Socket } from 'socket.io-client';
import {
  GameItem,
  TraitCategory,
  CHARACTERS_LIST,
  TRAIT_CATEGORIES,
} from '../constants/categories';
import { soundManager } from '../utils/audio';
import { SplashScreen } from '../components/SplashScreen';
import { OnboardingModal } from '../components/OnboardingModal';
import { MatchmakingModal } from '../components/MatchmakingModal';
import { UserProfile, loadUserProfile, saveUserProfile, getDetectiveRank } from '../utils/storage';
import { syncProfileWithBackend } from '../utils/api';
import { voiceManager, VoiceState } from '../utils/voice';
import { VoiceChatBar } from '../components/VoiceChatBar';

export interface ChatMessage {
  id?: string;
  text: string;
  from: 'me' | 'opponent' | 'system';
  type?: 'chat' | 'question' | 'answer' | 'reaction' | 'system';
  time?: string;
  senderName?: string;
}

export interface ClueItem {
  question: string;
  answer: string;
  player: string;
}

const QUICK_EMOJIS = ['🔥', '😎', '🤔', '😱', '👏', '😂', '👀', '💪', '🎯', '🤫', '🎉', '💯'];
const QUICK_PHRASES = ['Good luck! 🍀', 'Thinking... 🤔', 'Your turn! 🎯', 'Almost got it! 🔥', 'Nice question! 👌', 'GG! 🏆'];

const DEFAULT_SERVER_URL = 'http://192.168.31.138:3000';
let socket: Socket;

const { width } = Dimensions.get('window');

type GameMode = 'random' | 'custom' | 'offline_2p' | 'bot';

export const getSuspectTraits = (item?: any) => {
  if (!item) {
    return {
      gender: 'Unknown',
      hairColor: 'Unknown',
      accessories: [] as string[],
      facialHair: [] as string[],
    };
  }

  const fullFromList = CHARACTERS_LIST.find((c) => c.id === item.id);
  const src = fullFromList || item;
  const t = src.traits || {};

  return {
    gender: t.gender || src.gender || 'Unknown',
    hairColor: t.hairColor || src.hair || 'Unknown',
    accessories: Array.isArray(t.accessories)
      ? t.accessories
      : [
          ...(src.glasses ? ['glasses'] : []),
          ...(src.hat ? ['hat'] : []),
        ],
    facialHair: Array.isArray(t.facialHair)
      ? t.facialHair
      : [
          ...(src.facialHair && src.facialHair !== 'none' && src.facialHair !== false ? ['beard'] : ['none']),
        ],
  };
};

export default function App() {
  // Navigation State
  const [currentScreen, setCurrentScreen] = useState<
    'home' | 'custom_room_menu' | 'searching' | 'lobby' | 'selecting' | 'playing'
  >('home');
  const [gameMode, setGameMode] = useState<GameMode>('random');
  const [showSplash, setShowSplash] = useState(true);
  const [activeSubModal, setActiveSubModal] = useState<'rules' | 'settings' | 'about' | null>(null);
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);

  // Scores
  const [redScore, setRedScore] = useState(0);
  const [blueScore, setBlueScore] = useState(0);

  // Player & Room (Online)
  const [playerName, setPlayerName] = useState('Player 1');
  const [roomId, setRoomId] = useState('');
  const [, setRoomData] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  // User Profile & First-Time Onboarding
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [onboardingVisible, setOnboardingVisible] = useState<boolean>(false);

  // Matchmaking State (Radar & P1 vs P2 Clash)
  const [matchmakingModalVisible, setMatchmakingModalVisible] = useState<boolean>(false);
  const [matchmakingStatus, setMatchmakingStatus] = useState<'searching' | 'matched'>('searching');
  const [matchedOpponent, setMatchedOpponent] = useState<{ name: string; avatar?: string | null } | null>(null);

  // Real-Time Voice Chat State
  const [voiceState, setVoiceState] = useState<VoiceState>(voiceManager.getState());

  // Common Gameplay State
  const [previewSecret, setPreviewSecret] = useState<GameItem | null>(null);
  const [selectedTraitCategory, setSelectedTraitCategory] = useState<TraitCategory | null>(null);
  const [secretModalVisible, setSecretModalVisible] = useState(false);
  const [guessModalVisible, setGuessModalVisible] = useState(false);
  const [selectedGuessItem, setSelectedGuessItem] = useState<GameItem | null>(null);
  const [clueHistory, setClueHistory] = useState<ClueItem[]>([]);
  const [gameOverData, setGameOverData] = useState<{
    winnerName: string;
    isWinner: boolean;
    winningCharacter?: GameItem;
    opponentCharacter?: GameItem;
    reason?: 'correct_guess' | 'wrong_guess';
    guesserName?: string;
    guessedCharacterName?: string;
  } | null>(null);

  // Online / Bot Gameplay State
  const [mySecret, setMySecret] = useState<GameItem | null>(null);
  const [botSecret, setBotSecret] = useState<GameItem | null>(null);
  const [eliminatedIds, setEliminatedIds] = useState<number[]>([]);
  const [currentTurn, setCurrentTurn] = useState<string>('');
  const [currentTurnName, setCurrentTurnName] = useState<string>('');
  const [incomingQuestion, setIncomingQuestion] = useState<string | null>(null);
  const [lastAskedQuestion, setLastAskedQuestion] = useState<string>('');
  const [latestAnswerBanner, setLatestAnswerBanner] = useState<{
    question?: string;
    answer: string;
    responder: string;
  } | null>(null);
  const [isEliminationPhase, setIsEliminationPhase] = useState(false);

  // Chat & Log Drawer
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatText, setChatText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const chatScrollRef = useRef<ScrollView>(null);

  // Offline 2-Player Pass & Play State
  const [offlineTurn, setOfflineTurn] = useState<'p1' | 'p2'>('p1');
  const [offlineP1Secret, setOfflineP1Secret] = useState<GameItem | null>(null);
  const [offlineP2Secret, setOfflineP2Secret] = useState<GameItem | null>(null);
  const [offlineP1Eliminated, setOfflineP1Eliminated] = useState<number[]>([]);
  const [offlineP2Eliminated, setOfflineP2Eliminated] = useState<number[]>([]);
  const [offlineSelectionStep, setOfflineSelectionStep] = useState<'p1_pick' | 'p2_pick'>('p1_pick');
  const [offlinePhase, setOfflinePhase] = useState<'ask' | 'answer' | 'eliminate'>('ask');
  const [offlinePendingQuestion, setOfflinePendingQuestion] = useState<string | null>(null);
  const [privacyShieldVisible, setPrivacyShieldVisible] = useState(false);
  const [privacyShieldInfo, setPrivacyShieldInfo] = useState({
    title: 'PASS DEVICE TO OPPONENT',
    subtitle: 'Keep your secret cards hidden! Hand the screen over.',
    nextPlayerText: 'READY TO PLAY',
    onProceed: () => {},
  });

  // Audio & Music State
  const [isMuted, setIsMuted] = useState(false);
  const [bgMusicEnabled, setBgMusicEnabled] = useState(true);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [musicVolume, setMusicVolume] = useState(0.5);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundManager.setMuted(next);
    if (!next) soundManager.playSfx('ding');
  };

  const toggleMusic = () => {
    const next = !bgMusicEnabled;
    setBgMusicEnabled(next);
    soundManager.setMusicEnabled(next);
    soundManager.playSfx('click');
  };

  const toggleSfx = () => {
    const next = !sfxEnabled;
    setSfxEnabled(next);
    soundManager.setSfxEnabled(next);
    if (next) soundManager.playSfx('click');
  };

  const adjustVolume = (delta: number) => {
    const newVol = Math.max(0, Math.min(1, Math.round((musicVolume + delta) * 10) / 10));
    setMusicVolume(newVol);
    soundManager.setVolume(newVol);
    if (isMuted && newVol > 0) {
      setIsMuted(false);
      soundManager.setMuted(false);
    }
    soundManager.playSfx('click');
  };

  const setExactVolume = (val: number) => {
    setMusicVolume(val);
    soundManager.setVolume(val);
    if (isMuted && val > 0) {
      setIsMuted(false);
      soundManager.setMuted(false);
    }
    soundManager.playSfx('click');
  };

  // Economy & Coin Betting Handlers (100 in, 200 to winner)
  const handleMatchStartBet = () => {
    setUserProfile((prev) => {
      if (!prev) return prev;
      let coins = prev.coins !== undefined ? prev.coins : 1000;
      if (coins < 100) {
        coins += 500; // Emergency detective stipend
      }
      const updated: UserProfile = {
        ...prev,
        coins: Math.max(0, coins - 100),
      };
      saveUserProfile(updated);
      syncProfileWithBackend(serverUrl, updated);
      return updated;
    });
  };

  const handleMatchWinReward = () => {
    setUserProfile((prev) => {
      if (!prev) return prev;
      const currentCoins = prev.coins !== undefined ? prev.coins : 1000;
      const currentXp = (prev.xp !== undefined ? prev.xp : 0) + 100;
      const newLevel = Math.floor(currentXp / 200) + 1;
      const updated: UserProfile = {
        ...prev,
        coins: currentCoins + 200, // Winner takes 200 coin pot
        xp: currentXp,
        level: newLevel,
        wins: (prev.wins || 0) + 1,
      };
      saveUserProfile(updated);
      syncProfileWithBackend(serverUrl, updated);
      return updated;
    });
  };

  const handleMatchLossPenalty = () => {
    setUserProfile((prev) => {
      if (!prev) return prev;
      const updated: UserProfile = {
        ...prev,
        losses: (prev.losses || 0) + 1,
      };
      saveUserProfile(updated);
      syncProfileWithBackend(serverUrl, updated);
      return updated;
    });
  };

  useEffect(() => {
    initSocket(serverUrl);
    soundManager.setServerUrl(serverUrl);
    soundManager.startMusic();

    // Subscribe to real-time voice chat state
    const unsubVoice = voiceManager.subscribe(setVoiceState);

    // Load or create first-time user profile
    (async () => {
      const stored = await loadUserProfile();
      if (stored && stored.completed) {
        setUserProfile(stored);
        setPlayerName(stored.name);
        syncProfileWithBackend(serverUrl, stored);
      } else {
        setOnboardingVisible(true);
      }
    })();

    return () => {
      if (socket) socket.disconnect();
      soundManager.cleanup();
      unsubVoice();
      voiceManager.leaveVoiceRoom();
    };
  }, []);

  const handleOnboardingComplete = async (profile: UserProfile) => {
    await saveUserProfile(profile);
    setUserProfile(profile);
    setPlayerName(profile.name);
    setOnboardingVisible(false);
    soundManager.playSfx('ding');
    syncProfileWithBackend(serverUrl, profile);
  };

  const initSocket = (url: string) => {
    if (socket) socket.disconnect();
    socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 4,
    });

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      setIsConnected(false);
    });

    socket.on('game_started', (room) => {
      setRoomData(room);
      setRoomId(room.id);
      setEliminatedIds([]);
      setMySecret(null);
      setPreviewSecret(null);
      setGameOverData(null);
      setClueHistory([]);

      const opponent = room.players?.find((p: any) => p.socketId !== socket.id);
      const opponentInfo = {
        name: opponent?.name || 'Opponent',
        avatar: opponent?.avatar || null,
      };
      setMatchedOpponent(opponentInfo);

      // Deduct 100 Coin Entry Bet for the Match Pot
      handleMatchStartBet();

      // Play match found audio cue
      soundManager.playSfx('ding');

      // Auto-connect cross-platform voice chat for online match
      if (socket && room.id) {
        voiceManager.joinVoiceRoom(socket, room.id);
      }

      if (room.isMatchmaking) {
        // Trigger Player 1 vs Player 2 clash animation
        setMatchmakingStatus('matched');
        setMatchmakingModalVisible(true);
      } else {
        setCurrentScreen('selecting');
      }

      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages([{ text: `🎮 Match Started! Pick your secret suspect.`, from: 'system', type: 'system', time }]);
    });

    socket.on('character_confirmed', (character: any) => {
      const full = CHARACTERS_LIST.find((c) => c.id === character?.id) || character;
      setMySecret(full);
    });

    socket.on('start_guessing_phase', ({ currentTurn: turnId, currentTurnName: turnName }) => {
      setCurrentScreen('playing');
      setCurrentTurn(turnId);
      setCurrentTurnName(turnName);
      const isMine = socket && socket.id === turnId;
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        {
          text: isMine
            ? `🎯 Game started! It's YOUR TURN to ask first.`
            : `⏳ Game started! It's ${turnName}'s turn first.`,
          from: 'system',
          type: 'system',
          time,
        },
      ]);
    });

    socket.on('turn_changed', ({ currentTurn: turnId, currentTurnName: turnName }) => {
      setCurrentTurn(turnId);
      setCurrentTurnName(turnName);
      const isMine = socket && socket.id === turnId;
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        {
          text: isMine ? `🎯 It's YOUR TURN to ask or GUESS!` : `⏳ It's ${turnName}'s turn.`,
          from: 'system',
          type: 'system',
          time,
        },
      ]);
    });

    socket.on('receive_question', ({ question }) => {
      setIncomingQuestion(question);
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        { text: `❓ Opponent asked: "${question}"`, from: 'opponent', type: 'question', time },
      ]);
      if (!chatDrawerOpen) setUnreadChatCount((c) => c + 1);
    });

    socket.on('receive_answer', ({ answer }) => {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        { text: `💬 Opponent answered: ${answer}`, from: 'opponent', type: 'answer', time },
        { text: `✂️ Eliminate suspects on your board, then tap PASS TURN ⏭️`, from: 'system', type: 'system', time },
      ]);
      if (!chatDrawerOpen) setUnreadChatCount((c) => c + 1);
      setLatestAnswerBanner({
        answer,
        responder: 'Opponent',
        question: lastAskedQuestion,
      });
      if (lastAskedQuestion) {
        setClueHistory((prev) => [
          { question: lastAskedQuestion, answer, player: 'Opponent' },
          ...prev,
        ]);
      }
      setIsEliminationPhase(true);
    });

    socket.on('receive_chat', ({ message, senderName, time }) => {
      const timeStr = time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        { text: message, from: 'opponent', type: 'chat', time: timeStr, senderName: senderName || 'Opponent' },
      ]);
      if (!chatDrawerOpen) setUnreadChatCount((c) => c + 1);
    });

    socket.on('player_passed_turn', ({ passerName }) => {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        { text: `⏭️ ${passerName} passed turn! It's YOUR TURN to ask!`, from: 'system', type: 'system', time },
      ]);
    });

    socket.on('wrong_guess', ({ guesserName, guessedCharacter }: any) => {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        { text: `❌ ${guesserName} wrongly guessed "${guessedCharacter.name}"! Direct loss!`, from: 'system', type: 'system', time },
      ]);
    });

    socket.on('game_over', ({ winnerId, winnerName, winningCharacter, opponentCharacter, reason, guesserId, guesserName, guessedCharacter }: any) => {
      const isWinner = winnerId === socket.id;
      if (isWinner) {
        soundManager.playSfx('correct');
        setRedScore((s) => s + 1);
        handleMatchWinReward();
      } else {
        soundManager.playSfx('wrong');
        setBlueScore((s) => s + 1);
        handleMatchLossPenalty();
      }

      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (reason === 'wrong_guess') {
        const whoGuessed = guesserId === socket.id ? 'You' : (guesserName || 'Opponent');
        setMessages((prev) => [
          ...prev,
          {
            text: `💥 ${whoGuessed} made an incorrect final accusation on "${guessedCharacter?.name || 'suspect'}" and lost directly!`,
            from: 'system',
            type: 'system',
            time,
          },
        ]);
      }

      setGameOverData({
        winnerName,
        isWinner,
        winningCharacter,
        opponentCharacter,
        reason,
        guesserName,
        guessedCharacterName: guessedCharacter?.name,
      });
    });

    socket.on('game_restarted', () => {
      setCurrentScreen('selecting');
      setMySecret(null);
      setPreviewSecret(null);
      setEliminatedIds([]);
      setGameOverData(null);
      setClueHistory([]);
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages([{ text: '🔄 Rematch started! Choose your secret suspect.', from: 'system', type: 'system', time }]);
    });

    socket.on('opponent_disconnected', () => {
      voiceManager.leaveVoiceRoom();
      Alert.alert('Opponent Left', 'Your opponent has left the match.');
      setCurrentScreen('home');
      setRoomData(null);
    });
  };

  // --- 1. RANDOM MATCHMAKING ---
  const startRandomMatchmaking = () => {
    if (!isConnected) {
      return Alert.alert('Offline', `Cannot reach server at ${serverUrl}. Ensure the backend is running.`);
    }
    setGameMode('random');
    setMatchmakingStatus('searching');
    setMatchmakingModalVisible(true);
    socket.emit('find_match', {
      playerName: playerName.trim() || userProfile?.name || 'Player 1',
      playerAvatar: userProfile?.avatarUrl || null,
    });
  };

  const cancelMatchmaking = () => {
    if (socket) {
      socket.emit('cancel_matchmaking');
    }
    setMatchmakingModalVisible(false);
    setMatchmakingStatus('searching');
    setCurrentScreen('home');
  };

  const handleMatchAnimationComplete = () => {
    setMatchmakingModalVisible(false);
    setCurrentScreen('selecting');
  };

  // --- 2. CUSTOM ROOM ---
  const createCustomRoom = () => {
    if (!isConnected) {
      return Alert.alert('Offline', `Cannot reach server at ${serverUrl}.`);
    }
    setGameMode('custom');
    const genCode = `GW_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const targetCode = roomId.trim() ? roomId.trim().toUpperCase() : genCode;
    setRoomId(targetCode);

    socket.emit(
      'create_room',
      {
        roomId: targetCode,
        playerName: playerName.trim() || 'Player 1',
      },
      (res: any) => {
        if (res.error) Alert.alert('Error', res.error);
        else {
          setRoomData(res.room);
          setCurrentScreen('lobby');
        }
      }
    );
  };

  const joinCustomRoom = () => {
    if (!roomId.trim()) {
      return Alert.alert('Missing Code', 'Please enter a Room Code to join!');
    }
    if (!isConnected) {
      return Alert.alert('Offline', `Cannot reach server at ${serverUrl}.`);
    }
    setGameMode('custom');

    socket.emit(
      'join_room',
      {
        roomId: roomId.trim().toUpperCase(),
        playerName: playerName.trim() || 'Player 2',
      },
      (res: any) => {
        if (res.error) Alert.alert('Error', res.error);
        else {
          setRoomData(res.room);
          setCurrentScreen('selecting');
        }
      }
    );
  };

  // --- 3. OFFLINE 2-PLAYER PASS & PLAY ---
  const startOffline2PlayerGame = () => {
    setGameMode('offline_2p');
    setOfflineTurn('p1');
    setOfflineP1Secret(null);
    setOfflineP2Secret(null);
    setOfflineP1Eliminated([]);
    setOfflineP2Eliminated([]);
    setOfflineSelectionStep('p1_pick');
    setOfflinePhase('ask');
    setOfflinePendingQuestion(null);
    setPreviewSecret(null);
    setClueHistory([]);
    setGameOverData(null);
    setLatestAnswerBanner(null);
    setCurrentScreen('selecting');
  };

  const startOfflineBotGame = () => {
    setGameMode('bot');
    const randomBotPick = CHARACTERS_LIST[Math.floor(Math.random() * CHARACTERS_LIST.length)];
    setBotSecret(randomBotPick);
    setCurrentScreen('selecting');
    setEliminatedIds([]);
    setMySecret(null);
    setPreviewSecret(null);
    setGameOverData(null);
    setClueHistory([]);
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages([
      { text: `🤖 Bot picked its secret suspect. Now pick yours!`, from: 'system', type: 'system', time },
    ]);
  };

  // --- SELECTION CONFIRMATION ---
  const confirmSecretPick = (itemToLock?: GameItem) => {
    const target = itemToLock || previewSecret;
    if (!target) {
      return Alert.alert('Pick a Suspect', 'Please tap any suspect card to pick your secret character!');
    }

    if (gameMode === 'offline_2p') {
      if (offlineSelectionStep === 'p1_pick') {
        setOfflineP1Secret(target);
        setPreviewSecret(null);
        setPrivacyShieldInfo({
          title: 'PASS DEVICE TO PLAYER 2',
          subtitle: 'Player 1 has locked their secret suspect. Player 2, tap ready to choose yours!',
          nextPlayerText: "PLAYER 2: I'M READY 👍",
          onProceed: () => {
            setOfflineSelectionStep('p2_pick');
            setPrivacyShieldVisible(false);
          },
        });
        setPrivacyShieldVisible(true);
      } else {
        setOfflineP2Secret(target);
        setPreviewSecret(null);
        setPrivacyShieldInfo({
          title: 'GAME ON! PASS TO PLAYER 1',
          subtitle: 'Both secret suspects are locked in! Player 1 starts the game by asking the first question.',
          nextPlayerText: "PLAYER 1: START GAME 🚀",
          onProceed: () => {
            setOfflineTurn('p1');
            setOfflinePhase('ask');
            setPrivacyShieldVisible(false);
            setCurrentScreen('playing');
          },
        });
        setPrivacyShieldVisible(true);
      }
      return;
    }

    // Online or Bot Mode
    setMySecret(target);
    setPreviewSecret(target);
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (gameMode === 'bot') {
      setCurrentScreen('playing');
      setCurrentTurn('me');
      setCurrentTurnName(playerName || 'Player 1');
      setMessages((prev) => [
        ...prev,
        { text: `🎯 Game Started! It's your turn to ask the first question.`, from: 'system', type: 'system', time },
      ]);
    } else {
      socket.emit('select_character', { roomId: roomId.trim().toUpperCase(), characterId: target.id });
    }
  };

  const pickRandomSecret = () => {
    const randomIndex = Math.floor(Math.random() * CHARACTERS_LIST.length);
    setPreviewSecret(CHARACTERS_LIST[randomIndex]);
  };

  // --- TOGGLE ELIMINATE ---
  const toggleEliminate = (id: number) => {
    soundManager.playSfx('flip');
    if (gameMode === 'offline_2p') {
      if (offlineTurn === 'p1') {
        setOfflineP1Eliminated((prev) =>
          prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
      } else {
        setOfflineP2Eliminated((prev) =>
          prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
      }
      return;
    }
    setEliminatedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // --- ASKING QUESTIONS ---
  const askQuestion = (qText: string) => {
    const q = qText.trim();
    if (!q) return;
    soundManager.playSfx('click');
    setLastAskedQuestion(q);
    setSelectedTraitCategory(null);

    // 1. OFFLINE 2-PLAYER PASS & PLAY FLOW
    if (gameMode === 'offline_2p') {
      setOfflinePendingQuestion(q);
      const responder = offlineTurn === 'p1' ? 'Player 2' : 'Player 1';
      setPrivacyShieldInfo({
        title: `PASS DEVICE TO ${responder.toUpperCase()}`,
        subtitle: `${offlineTurn === 'p1' ? 'Player 1' : 'Player 2'} asked: "${q}". ${responder}, answer YES or NO!`,
        nextPlayerText: `${responder.toUpperCase()}: ANSWER QUESTION`,
        onProceed: () => {
          setOfflinePhase('answer');
          setPrivacyShieldVisible(false);
        },
      });
      setPrivacyShieldVisible(true);
      return;
    }

    // 2. BOT MATCH FLOW
    if (gameMode === 'bot') {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        { text: `❓ Asked: "${q}"`, from: 'me', type: 'question', time, senderName: playerName || 'You' },
        { text: `⏳ Bot 🤖 is checking its suspect card...`, from: 'system', type: 'system', time },
      ]);

      setTimeout(() => {
        if (!botSecret) return;
        let ans: 'YES 👍' | 'NO 👎' = 'NO 👎';

        let foundOption = null;
        for (const tCat of TRAIT_CATEGORIES) {
          const opt = tCat.options.find((o) => o.label === q);
          if (opt) {
            foundOption = opt;
            break;
          }
        }

        if (foundOption && botSecret) {
          const traits = getSuspectTraits(botSecret);
          ans = foundOption.check(traits) ? 'YES 👍' : 'NO 👎';
        } else {
          ans = Math.random() > 0.5 ? 'YES 👍' : 'NO 👎';
        }

        const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setMessages((prev) => [
          ...prev,
          { text: `💬 Answered: ${ans}`, from: 'opponent', type: 'answer', time: botTime, senderName: 'Bot 🤖' },
          { text: `✂️ Eliminate suspects on your board, then tap PASS TURN ⏭️ to let Bot ask!`, from: 'system', type: 'system', time: botTime },
        ]);
        if (!chatDrawerOpen) setUnreadChatCount((c) => c + 1);
        setLatestAnswerBanner({
          answer: ans,
          responder: 'Bot 🤖',
          question: q,
        });
        setClueHistory((prev) => [{ question: q, answer: ans, player: 'Bot 🤖' }, ...prev]);
        setIsEliminationPhase(true);
      }, 700);
      return;
    }

    // 3. ONLINE SOCKET FLOW
    socket.emit('ask_question', { roomId: roomId.trim().toUpperCase(), question: q });
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      { text: `❓ Asked: "${q}"`, from: 'me', type: 'question', time, senderName: playerName || 'You' },
    ]);
  };

  // --- ANSWERING QUESTIONS ---
  const answerQuestion = (ans: 'YES 👍' | 'NO 👎') => {
    if (ans.includes('YES')) {
      soundManager.playSfx('ding');
    } else {
      soundManager.playSfx('click');
    }

    if (gameMode === 'offline_2p') {
      const q = offlinePendingQuestion || 'Question';
      const askingPlayer = offlineTurn === 'p1' ? 'Player 1' : 'Player 2';
      const answeringPlayer = offlineTurn === 'p1' ? 'Player 2' : 'Player 1';

      setClueHistory((prev) => [{ question: q, answer: ans, player: answeringPlayer }, ...prev]);
      setLatestAnswerBanner({
        answer: ans,
        responder: answeringPlayer,
        question: q,
      });

      setPrivacyShieldInfo({
        title: `PASS DEVICE BACK TO ${askingPlayer.toUpperCase()}`,
        subtitle: `${answeringPlayer} answered: ${ans}! Now eliminate suspects on your board.`,
        nextPlayerText: `${askingPlayer.toUpperCase()}: ELIMINATE SUSPECTS`,
        onProceed: () => {
          setOfflinePhase('eliminate');
          setPrivacyShieldVisible(false);
        },
      });
      setPrivacyShieldVisible(true);
      return;
    }

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    socket.emit('answer_question', { roomId: roomId.trim().toUpperCase(), answer: ans });
    setMessages((prev) => [
      ...prev,
      { text: `💬 Answered: ${ans}`, from: 'me', type: 'answer', time, senderName: playerName || 'You' },
    ]);
    setIncomingQuestion(null);
  };

  // --- PASS TURN ---
  const passTurn = () => {
    soundManager.playSfx('click');
    if (gameMode === 'offline_2p') {
      const nextP = offlineTurn === 'p1' ? 'p2' : 'p1';
      const nextName = nextP === 'p1' ? 'Player 1' : 'Player 2';

      setLatestAnswerBanner(null);
      setOfflinePendingQuestion(null);

      setPrivacyShieldInfo({
        title: `PASS DEVICE TO ${nextName.toUpperCase()}`,
        subtitle: `It is now ${nextName}'s turn to inspect their board and ask a question!`,
        nextPlayerText: `${nextName.toUpperCase()}: START TURN 🚀`,
        onProceed: () => {
          setOfflineTurn(nextP);
          setOfflinePhase('ask');
          setPrivacyShieldVisible(false);
        },
      });
      setPrivacyShieldVisible(true);
      return;
    }

    setLatestAnswerBanner(null);
    setIsEliminationPhase(false);

    if (gameMode === 'bot') {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        { text: `⏭️ You passed your turn to Bot 🤖.`, from: 'me', type: 'system', time },
        { text: `⏳ Bot 🤖 is picking a trait question to ask you...`, from: 'system', type: 'system', time },
      ]);
      setCurrentTurn('bot');
      setCurrentTurnName('Bot 🤖');

      setTimeout(() => {
        const allOpts: string[] = [];
        TRAIT_CATEGORIES.forEach((tc) => tc.options.forEach((o) => allOpts.push(o.label)));
        const randomQ = allOpts[Math.floor(Math.random() * allOpts.length)] || 'Is it male?';
        setIncomingQuestion(randomQ);
        const botAskTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setMessages((prev) => [
          ...prev,
          { text: `❓ Bot asks: "${randomQ}"`, from: 'opponent', type: 'question', time: botAskTime, senderName: 'Bot 🤖' },
          { text: `🔔 Please answer the bot's question (YES 👍 or NO 👎)`, from: 'system', type: 'system', time: botAskTime },
        ]);
        if (!chatDrawerOpen) setUnreadChatCount((c) => c + 1);
      }, 1000);
      return;
    }

    if (socket && roomId) {
      socket.emit('pass_turn', { roomId: roomId.trim().toUpperCase() });
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        { text: `⏭️ You finished eliminating cards & passed turn to opponent.`, from: 'me', type: 'system', time },
      ]);
    }
  };

  // --- FINAL ACCUSATION / GUESS ---
  const submitFinalGuess = () => {
    if (!selectedGuessItem) return;

    if (gameMode === 'offline_2p') {
      const targetSecret = offlineTurn === 'p1' ? offlineP2Secret : offlineP1Secret;
      const mySecretSuspect = offlineTurn === 'p1' ? offlineP1Secret : offlineP2Secret;
      const currentGuesser = offlineTurn === 'p1' ? 'Player 1 (Red)' : 'Player 2 (Blue)';
      const otherPlayer = offlineTurn === 'p1' ? 'Player 2 (Blue)' : 'Player 1 (Red)';

      if (targetSecret && selectedGuessItem.id === targetSecret.id) {
        soundManager.playSfx('correct');
        if (offlineTurn === 'p1') setRedScore((s) => s + 1);
        else setBlueScore((s) => s + 1);
        handleMatchWinReward();

        setGameOverData({
          winnerName: currentGuesser,
          isWinner: true,
          winningCharacter: targetSecret,
          opponentCharacter: mySecretSuspect || undefined,
          reason: 'correct_guess',
          guesserName: currentGuesser,
        });
      } else {
        // DIRECT LOSS on wrong guess! Opponent immediately wins!
        soundManager.playSfx('wrong');
        if (offlineTurn === 'p1') setBlueScore((s) => s + 1);
        else setRedScore((s) => s + 1);
        handleMatchLossPenalty();

        setGameOverData({
          winnerName: otherPlayer,
          isWinner: false,
          winningCharacter: targetSecret || undefined,
          opponentCharacter: mySecretSuspect || undefined,
          reason: 'wrong_guess',
          guesserName: currentGuesser,
          guessedCharacterName: selectedGuessItem.name,
        });
      }
      setGuessModalVisible(false);
      setSelectedGuessItem(null);
      return;
    }

    if (gameMode === 'bot') {
      if (!botSecret) return;
      if (selectedGuessItem.id === botSecret.id) {
        soundManager.playSfx('correct');
        setRedScore((s) => s + 1);
        handleMatchWinReward();

        setGameOverData({
          winnerName: playerName || 'Player 1',
          isWinner: true,
          winningCharacter: botSecret,
          opponentCharacter: mySecret || undefined,
          reason: 'correct_guess',
          guesserName: playerName || 'You',
        });
      } else {
        // DIRECT LOSS on wrong guess! Bot immediately wins!
        soundManager.playSfx('wrong');
        setBlueScore((s) => s + 1);
        handleMatchLossPenalty();

        setGameOverData({
          winnerName: 'Bot 🤖',
          isWinner: false,
          winningCharacter: botSecret,
          opponentCharacter: mySecret || undefined,
          reason: 'wrong_guess',
          guesserName: playerName || 'You',
          guessedCharacterName: selectedGuessItem.name,
        });
      }
      setGuessModalVisible(false);
      setSelectedGuessItem(null);
      return;
    }

    // Online Socket
    socket.emit('make_guess', {
      roomId: roomId.trim().toUpperCase(),
      characterId: selectedGuessItem.id,
    });
    setGuessModalVisible(false);
    setSelectedGuessItem(null);
  };

  const sendChatMessage = (customMsg?: string) => {
    const txt = (customMsg || chatText).trim();
    if (!txt) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { text: txt, from: 'me', type: 'chat', time, senderName: playerName || 'You' }]);
    setChatText('');

    if (gameMode === 'bot') {
      setTimeout(() => {
        const botReactions = [
          'Nice deduction! 😉',
          'Let me examine my suspect board... 🤔',
          'Good try! 👏',
          'I see your clever strategy! 👀',
          'May the best detective win! 🕵️',
        ];
        const randomReaction = botReactions[Math.floor(Math.random() * botReactions.length)];
        const bTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setMessages((prev) => [
          ...prev,
          { text: randomReaction, from: 'opponent', type: 'chat', time: bTime, senderName: 'Bot 🤖' },
        ]);
        if (!chatDrawerOpen) setUnreadChatCount((c) => c + 1);
      }, 700);
      return;
    }

    if (socket && roomId) {
      socket.emit('send_chat', {
        roomId: roomId.trim().toUpperCase(),
        message: txt,
        senderName: playerName || 'Player 1',
      });
    }
  };

  const restartGame = () => {
    setLatestAnswerBanner(null);
    setLastAskedQuestion('');
    setGameOverData(null);
    setClueHistory([]);

    if (gameMode === 'offline_2p') {
      startOffline2PlayerGame();
      return;
    }
    if (gameMode === 'bot') {
      startOfflineBotGame();
      return;
    }
    socket.emit('restart_game', { roomId: roomId.trim().toUpperCase() });
  };

  const confirmExitGame = () => {
    Alert.alert(
      'Exit Game? 🚪',
      'Return to the main menu? Current match progress will be reset.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Exit to Menu',
          style: 'destructive',
          onPress: () => {
            voiceManager.leaveVoiceRoom();
            if (socket) socket.disconnect();
            initSocket(serverUrl);
            setMySecret(null);
            setBotSecret(null);
            setOfflineP1Secret(null);
            setOfflineP2Secret(null);
            setEliminatedIds([]);
            setOfflineP1Eliminated([]);
            setOfflineP2Eliminated([]);
            setLatestAnswerBanner(null);
            setLastAskedQuestion('');
            setClueHistory([]);
            setGameOverData(null);
            setPrivacyShieldVisible(false);
            setCurrentScreen('home');
          },
        },
      ]
    );
  };

  // Active suspect calculations
  const currentActiveEliminated =
    gameMode === 'offline_2p'
      ? offlineTurn === 'p1'
        ? offlineP1Eliminated
        : offlineP2Eliminated
      : eliminatedIds;

  const remainingCount = CHARACTERS_LIST.length - currentActiveEliminated.length;
  const isGuessUnlocked = remainingCount <= 3;

  const currentSecretSuspect =
    gameMode === 'offline_2p'
      ? offlineTurn === 'p1'
        ? offlineP1Secret
        : offlineP2Secret
      : mySecret;

  const isMyTurnOnline = gameMode === 'bot' ? currentTurn === 'me' : socket && socket.id === currentTurn;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Animated Detective Splash Screen */}
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      {/* ========================================================
          1. HOME SCREEN: GUESS WHO? FLAGSHIP EXPERIENCE
          ======================================================== */}
      {currentScreen === 'home' && (
        <View style={styles.homeContainer}>
          {/* Top Brand Header - Symmetrically Centered */}
          <View style={styles.homeHeader}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={toggleMute} activeOpacity={0.8}>
              <Text style={styles.headerIconText}>{isMuted ? '🔇' : '🔊'}</Text>
            </TouchableOpacity>

            <View style={styles.brandContainer}>
              <View style={styles.brandTitleRow}>
                <Text style={styles.brandDetectiveEmoji}>🕵️‍♂️</Text>
                <Text style={styles.brandTitle}>GUESS WHO?</Text>
              </View>
              <Text style={styles.brandSub}>THE CLASSIC SUSPECT DEDUCTION DUEL</Text>
            </View>

            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setActiveSubModal('rules')} activeOpacity={0.8}>
              <Text style={styles.headerIconText}>📖</Text>
            </TouchableOpacity>
          </View>

          {/* Suspect Avatars Marquee Strip */}
          <View style={styles.marqueeStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.marqueeScroll}>
              {CHARACTERS_LIST.slice(0, 14).map((char) => (
                <View key={char.id} style={styles.marqueeAvatarWrap}>
                  <Image source={{ uri: char.avatar }} style={styles.marqueeAvatar} />
                  <Text style={styles.marqueeName}>{char.name}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Detective Profile Badge Banner */}
          {userProfile && (() => {
            const rank = getDetectiveRank(userProfile.level || 1);
            return (
              <TouchableOpacity
                style={styles.playerProfileBanner}
                onPress={() => setOnboardingVisible(true)}
                activeOpacity={0.85}
              >
                <Image source={{ uri: userProfile.avatarUrl }} style={styles.profileBannerAvatar} />
                <View style={styles.profileBannerInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.profileBannerName}>{userProfile.name}</Text>
                    <View style={[styles.profileBadgeTag, { backgroundColor: rank.color + '25', borderColor: rank.color }]}>
                      <Text style={[styles.profileBadgeTagText, { color: rank.color }]}>
                        {rank.badge} LVL {userProfile.level || 1} • {rank.title.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <Text style={styles.profileCoinsText}>
                      🪙 {(userProfile.coins !== undefined ? userProfile.coins : 1000).toLocaleString()} Coins
                    </Text>
                    <Text style={styles.profileRecordText}>
                      🏆 {userProfile.wins || 0}W - {userProfile.losses || 0}L
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 16 }}>✏️</Text>
              </TouchableOpacity>
            );
          })()}

          {/* Main Requested Game Modes & Settings Card */}
          <ScrollView style={styles.modesScrollView} contentContainerStyle={styles.modesContainer} showsVerticalScrollIndicator={false}>
            {/* MODE 1: RANDOM MATCH */}
            <TouchableOpacity style={styles.modeCard} onPress={startRandomMatchmaking} activeOpacity={0.88}>
              <View style={[styles.modeCardShadow, { backgroundColor: '#1E3A8A' }]}>
                <View style={[styles.modeCardFace, { backgroundColor: '#2563EB' }]}>
                  <View style={styles.modeIconCircle}>
                    <Text style={styles.modeIconEmoji}>⚡</Text>
                  </View>
                  <View style={styles.modeTextColumn}>
                    <View style={styles.modeBadgeOnline}>
                      <Text style={styles.modeBadgeText}>ONLINE 1v1</Text>
                    </View>
                    <Text style={styles.modeTitle}>RANDOM MATCH</Text>
                    <Text style={styles.modeDesc}>Instant matchmaking with an online player worldwide</Text>
                  </View>
                  <Text style={styles.modeArrow}>➔</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* MODE 2: CUSTOM ROOM */}
            <TouchableOpacity style={styles.modeCard} onPress={() => setCurrentScreen('custom_room_menu')} activeOpacity={0.88}>
              <View style={[styles.modeCardShadow, { backgroundColor: '#4338CA' }]}>
                <View style={[styles.modeCardFace, { backgroundColor: '#4F46E5' }]}>
                  <View style={styles.modeIconCircle}>
                    <Text style={styles.modeIconEmoji}>👥</Text>
                  </View>
                  <View style={styles.modeTextColumn}>
                    <View style={styles.modeBadgeOnline}>
                      <Text style={styles.modeBadgeText}>PRIVATE ROOM</Text>
                    </View>
                    <Text style={styles.modeTitle}>CUSTOM ROOM</Text>
                    <Text style={styles.modeDesc}>Generate or enter room code to challenge your friend</Text>
                  </View>
                  <Text style={styles.modeArrow}>➔</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* MODE 3: OFFLINE 2 PLAYER */}
            <TouchableOpacity style={styles.modeCard} onPress={startOffline2PlayerGame} activeOpacity={0.88}>
              <View style={[styles.modeCardShadow, { backgroundColor: '#065F46' }]}>
                <View style={[styles.modeCardFace, { backgroundColor: '#059669' }]}>
                  <View style={styles.modeIconCircle}>
                    <Text style={styles.modeIconEmoji}>📱</Text>
                  </View>
                  <View style={styles.modeTextColumn}>
                    <View style={[styles.modeBadgeOnline, { backgroundColor: '#10B981' }]}>
                      <Text style={styles.modeBadgeText}>SAME DEVICE</Text>
                    </View>
                    <Text style={styles.modeTitle}>OFFLINE 2 PLAYER</Text>
                    <Text style={styles.modeDesc}>Pass & Play turn by turn with privacy shields</Text>
                  </View>
                  <Text style={styles.modeArrow}>➔</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* MODE 4: SETTINGS & AUDIO */}
            <TouchableOpacity style={styles.modeCard} onPress={() => setActiveSubModal('settings')} activeOpacity={0.88}>
              <View style={[styles.modeCardShadow, { backgroundColor: '#334155' }]}>
                <View style={[styles.modeCardFace, { backgroundColor: '#1E293B', borderWidth: 1.5, borderColor: '#475569' }]}>
                  <View style={[styles.modeIconCircle, { backgroundColor: '#334155' }]}>
                    <Text style={styles.modeIconEmoji}>⚙️</Text>
                  </View>
                  <View style={styles.modeTextColumn}>
                    <View style={[styles.modeBadgeOnline, { backgroundColor: '#475569' }]}>
                      <Text style={styles.modeBadgeText}>PREFERENCES & AUDIO</Text>
                    </View>
                    <Text style={styles.modeTitle}>GAME SETTINGS</Text>
                    <Text style={styles.modeDesc}>Profile, sound & music volume, and server connection</Text>
                  </View>
                  <Text style={styles.modeArrow}>➔</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Quick Practice vs Bot Sub-Option */}
            <TouchableOpacity style={styles.botPracticeBtn} onPress={startOfflineBotGame} activeOpacity={0.8}>
              <Text style={styles.botPracticeText}>🤖 Practice Solo vs AI Bot</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Bottom Duel Score Bar */}
          <View style={styles.bottomScoreBar}>
            <View style={styles.scorePlayerSide}>
              <View style={[styles.scoreBadge, styles.redScoreBadge]}>
                <Text style={styles.scoreNumber}>{redScore}</Text>
              </View>
              <Text style={styles.scoreLabel}>PLAYER 1</Text>
            </View>

            <View style={styles.scoreCenterDivider}>
              <Text style={styles.vsBadgeText}>VS</Text>
            </View>

            <View style={styles.scorePlayerSide}>
              <Text style={styles.scoreLabel}>PLAYER 2</Text>
              <View style={[styles.scoreBadge, styles.blueScoreBadge]}>
                <Text style={styles.scoreNumber}>{blueScore}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ========================================================
          2. CUSTOM ROOM SCREEN: CREATE / JOIN
          ======================================================== */}
      {currentScreen === 'custom_room_menu' && (
        <View style={styles.customRoomContainer}>
          <View style={styles.subScreenHeader}>
            <TouchableOpacity style={styles.backCircleBtn} onPress={() => setCurrentScreen('home')} activeOpacity={0.8}>
              <Text style={styles.backCircleBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.subScreenTitle}>CUSTOM ROOM</Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView contentContainerStyle={styles.customRoomContent}>
            {/* Create Box */}
            <View style={styles.customBox}>
              <Text style={styles.customBoxIcon}>🏠</Text>
              <Text style={styles.customBoxTitle}>CREATE A PRIVATE ROOM</Text>
              <Text style={styles.customBoxDesc}>Get a 5-letter room code and send it to your friend.</Text>
              <TouchableOpacity style={styles.primaryActionButton} onPress={createCustomRoom} activeOpacity={0.85}>
                <Text style={styles.primaryActionText}>➕ Generate Private Room</Text>
              </TouchableOpacity>
            </View>

            {/* Join Box */}
            <View style={[styles.customBox, { marginTop: 18 }]}>
              <Text style={styles.customBoxIcon}>🔑</Text>
              <Text style={styles.customBoxTitle}>JOIN FRIEND'S ROOM</Text>
              <Text style={styles.customBoxDesc}>Enter the room code shared by your friend to jump in.</Text>

              <TextInput
                style={styles.roomCodeTextInput}
                placeholder="Enter Room Code (e.g. GW_A7)"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                value={roomId}
                onChangeText={setRoomId}
              />

              <TouchableOpacity
                style={[styles.primaryActionButton, { backgroundColor: '#0284C7' }]}
                onPress={joinCustomRoom}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryActionText}>🚀 Join Room Now</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      {/* ========================================================
          3. SEARCHING SCREEN (MATCHMAKING)
          ======================================================== */}
      {currentScreen === 'searching' && (
        <View style={styles.centerContainer}>
          <View style={styles.radarPulseRing}>
            <ActivityIndicator size="large" color="#38BDF8" />
          </View>
          <Text style={styles.searchingEmoji}>⚡</Text>
          <Text style={styles.searchingTitle}>Finding Opponent...</Text>
          <Text style={styles.searchingSub}>Searching active Guess Who queue for 1v1 battle...</Text>

          <TouchableOpacity
            style={styles.cancelActionBtn}
            onPress={() => {
              if (socket) socket.emit('cancel_matchmaking');
              setCurrentScreen('home');
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelActionText}>Cancel Search</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ========================================================
          4. LOBBY SCREEN (WAITING FOR FRIEND)
          ======================================================== */}
      {currentScreen === 'lobby' && (
        <View style={styles.centerContainer}>
          <Text style={styles.lobbyEmoji}>⏳</Text>
          <Text style={styles.lobbyTitle}>Room Ready!</Text>
          <Text style={styles.lobbySub}>Share this code with your friend to join the match:</Text>

          <View style={styles.shareCodeCard}>
            <Text style={styles.shareCodeLabel}>ROOM CODE</Text>
            <Text style={styles.shareCodeValue}>{roomId.toUpperCase()}</Text>
          </View>

          <Text style={styles.lobbyHint}>The match will automatically begin as soon as Player 2 enters the code.</Text>

          <TouchableOpacity style={styles.cancelActionBtn} onPress={confirmExitGame} activeOpacity={0.8}>
            <Text style={styles.cancelActionText}>Cancel & Exit</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ========================================================
          5. SECRET SUSPECT SELECTION SCREEN
          ======================================================== */}
      {currentScreen === 'selecting' && (
        <View style={styles.selectionScreenContainer}>
          {/* Header */}
          <View style={styles.selectionHeader}>
            <TouchableOpacity style={styles.exitMiniBtn} onPress={confirmExitGame} activeOpacity={0.8}>
              <Text style={styles.exitMiniBtnText}>✕ Exit</Text>
            </TouchableOpacity>

            <View style={{ alignItems: 'center' }}>
              <Text style={styles.selectionTitleText}>
                {gameMode === 'offline_2p'
                  ? offlineSelectionStep === 'p1_pick'
                    ? '🔴 PLAYER 1: CHOOSE SECRET'
                    : '🔵 PLAYER 2: CHOOSE SECRET'
                  : '🕵️‍♂️ CHOOSE YOUR SECRET SUSPECT'}
              </Text>
              <Text style={styles.selectionSubtitleText}>
                {previewSecret
                  ? `Selected: ${previewSecret.name}. Tap "Lock In" to confirm!`
                  : 'Tap any suspect card below to hide!'}
              </Text>
            </View>

            <TouchableOpacity style={styles.randomMiniBtn} onPress={pickRandomSecret} activeOpacity={0.8}>
              <Text style={styles.randomMiniBtnText}>🎲 Random</Text>
            </TouchableOpacity>
          </View>

          {/* Live WebRTC Voice Chat Deck */}
          {(gameMode === 'random' || gameMode === 'custom') && (
            <VoiceChatBar
              compact
              onPressReconnect={() => {
                if (socket && roomId) {
                  voiceManager.joinVoiceRoom(socket, roomId.trim().toUpperCase());
                }
              }}
            />
          )}

          {/* Selected Suspect Preview Card */}
          {previewSecret && (() => {
            const traits = getSuspectTraits(previewSecret);
            return (
              <View style={styles.previewLockedBanner}>
                <Image source={{ uri: previewSecret.avatar }} style={styles.previewAvatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewName}>{previewSecret.name}</Text>
                  <Text style={styles.previewTraitsSummary}>
                    {traits.gender} • {traits.hairColor} hair
                    {traits.accessories.length > 0 ? ` • ${traits.accessories.join(', ')}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.lockInSecretBtn}
                  onPress={() => confirmSecretPick(previewSecret)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.lockInSecretBtnText}>🔒 LOCK IN</Text>
                </TouchableOpacity>
              </View>
            );
          })()}

          {/* 36 Suspects Selection Grid */}
          <FlatList
            data={CHARACTERS_LIST}
            keyExtractor={(item) => item.id.toString()}
            numColumns={4}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.boardGridPadding}
            renderItem={({ item }) => {
              const isSelected = previewSecret?.id === item.id;
              return (
                <TouchableOpacity
                  style={[styles.tactileBoardCard, isSelected && styles.tactileBoardCardSelected]}
                  onPress={() => setPreviewSecret(item)}
                  activeOpacity={0.7}
                >
                  <Image source={{ uri: item.avatar }} style={styles.cardAvatar} />
                  <View style={[styles.cardNameBar, isSelected && { backgroundColor: '#F59E0B' }]}>
                    <Text style={styles.cardNameText} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* ========================================================
          6. NEXT-LEVEL BOARD GAMEPLAY SCREEN
          ======================================================== */}
      {currentScreen === 'playing' && (
        <View style={styles.playingMainContainer}>
          {/* Top Header Bar */}
          <View style={styles.playingTopBar}>
            {/* My Secret Suspect Quick Peek Button */}
            {currentSecretSuspect ? (
              <TouchableOpacity
                style={[
                  styles.secretPeekBtn,
                  voiceState.isLocalSpeaking && styles.speakingWaveBorder,
                ]}
                onPress={() => setSecretModalVisible(true)}
                activeOpacity={0.8}
              >
                <Image source={{ uri: currentSecretSuspect.avatar }} style={styles.secretPeekAvatar} />
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.secretPeekLabel}>MY SECRET</Text>
                    {voiceState.isLocalSpeaking && (
                      <Text style={styles.liveVoiceBadge}>🎙️ LIVE</Text>
                    )}
                  </View>
                  <Text style={styles.secretPeekName} numberOfLines={1}>
                    {currentSecretSuspect.name}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 80 }} />
            )}

            {/* Turn Status Pill */}
            <View
              style={[
                styles.turnStatusPill,
                voiceState.isRemoteSpeaking
                  ? styles.turnPillSpeaking
                  : gameMode === 'offline_2p'
                  ? offlineTurn === 'p1'
                    ? styles.turnPillRed
                    : styles.turnPillBlue
                  : isMyTurnOnline
                  ? styles.turnPillMine
                  : styles.turnPillOpp,
              ]}
            >
              <Text style={styles.turnStatusPillText}>
                {voiceState.isRemoteSpeaking
                  ? '🗣️ OPPONENT SPEAKING...'
                  : gameMode === 'offline_2p'
                  ? offlineTurn === 'p1'
                    ? "🔴 PLAYER 1'S TURN"
                    : "🔵 PLAYER 2'S TURN"
                  : isMyTurnOnline
                  ? '🎯 YOUR TURN TO ASK'
                  : `⏳ ${currentTurnName.toUpperCase()}'S TURN`}
              </Text>
            </View>

            {/* Suspect Counter & Exit */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.suspectCountBadge}>
                <Text style={styles.suspectCountText}>{remainingCount}/36</Text>
              </View>

              <TouchableOpacity style={styles.exitPlayingBtn} onPress={confirmExitGame} activeOpacity={0.8}>
                <Text style={styles.exitPlayingBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Live WebRTC Voice Chat Deck */}
          {(gameMode === 'random' || gameMode === 'custom') && (
            <VoiceChatBar
              compact
              onPressReconnect={() => {
                if (socket && roomId) {
                  voiceManager.joinVoiceRoom(socket, roomId.trim().toUpperCase());
                }
              }}
            />
          )}

          {/* 36 Suspect Tactile Board */}
          <View style={styles.woodenBoardWrapper}>
            <FlatList
              data={CHARACTERS_LIST}
              keyExtractor={(item) => item.id.toString()}
              numColumns={4}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.boardGridPadding}
              renderItem={({ item }) => {
                const isEliminated = currentActiveEliminated.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.tactileBoardCard, isEliminated && styles.tactileBoardCardEliminated]}
                    onPress={() => toggleEliminate(item.id)}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{ uri: item.avatar }}
                      style={[styles.cardAvatar, isEliminated && styles.cardAvatarEliminated]}
                    />
                    <View style={[styles.cardNameBar, isEliminated && styles.cardNameBarEliminated]}>
                      <Text style={[styles.cardNameText, isEliminated && styles.cardNameTextEliminated]} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                    {isEliminated && (
                      <View style={styles.cardCrossOverlay}>
                        <Text style={styles.cardCrossSymbol}>✕</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          {/* Latest Answer / Clue Banner */}
          {latestAnswerBanner && (
            <View
              style={[
                styles.clueBanner,
                latestAnswerBanner.answer?.includes('YES') ? styles.clueBannerYes : styles.clueBannerNo,
              ]}
            >
              <View style={styles.clueBannerBadge}>
                <Text style={styles.clueBannerBadgeText}>
                  {latestAnswerBanner.answer?.includes('YES') ? 'YES 👍' : 'NO 👎'}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.clueBannerQuestion} numberOfLines={1}>
                  "{latestAnswerBanner.question || 'Question'}"
                </Text>
                <Text style={styles.clueBannerSub}>
                  {latestAnswerBanner.responder} • Tap cards to eliminate, then tap Pass Turn!
                </Text>
              </View>
              <TouchableOpacity style={styles.clueDismissBtn} onPress={() => setLatestAnswerBanner(null)}>
                <Text style={styles.clueDismissText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Incoming Question Prompt (Online & Bot) */}
          {incomingQuestion && gameMode !== 'offline_2p' && (
            <View style={styles.incomingQuestionBanner}>
              <Text style={styles.incomingQuestionTitle}>Opponent asks:</Text>
              <Text style={styles.incomingQuestionText}>"{incomingQuestion}"</Text>
              <View style={styles.incomingQuestionBtnRow}>
                <TouchableOpacity
                  style={[styles.answerChoiceBtn, { backgroundColor: '#10B981' }]}
                  onPress={() => answerQuestion('YES 👍')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.answerChoiceBtnText}>YES 👍</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.answerChoiceBtn, { backgroundColor: '#EF4444' }]}
                  onPress={() => answerQuestion('NO 👎')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.answerChoiceBtnText}>NO 👎</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Incoming Question Answer Phase (Offline 2 Player) */}
          {gameMode === 'offline_2p' && offlinePhase === 'answer' && offlinePendingQuestion && (
            <View style={styles.incomingQuestionBanner}>
              <Text style={styles.incomingQuestionTitle}>
                {offlineTurn === 'p1' ? 'Player 1 asks:' : 'Player 2 asks:'}
              </Text>
              <Text style={styles.incomingQuestionText}>"{offlinePendingQuestion}"</Text>
              <View style={styles.incomingQuestionBtnRow}>
                <TouchableOpacity
                  style={[styles.answerChoiceBtn, { backgroundColor: '#10B981' }]}
                  onPress={() => answerQuestion('YES 👍')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.answerChoiceBtnText}>YES 👍</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.answerChoiceBtn, { backgroundColor: '#EF4444' }]}
                  onPress={() => answerQuestion('NO 👎')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.answerChoiceBtnText}>NO 👎</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Bottom Action Bar: Trait Question Buttons + Pass + Guess + Chat */}
          <View style={styles.bottomControlDeck}>
            <View style={styles.traitsRowDeck}>
              {TRAIT_CATEGORIES.map((cat) => {
                const canAsk =
                  gameMode === 'offline_2p'
                    ? offlinePhase === 'ask'
                    : isMyTurnOnline && !isEliminationPhase;

                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.traitDeckBtn, !canAsk && styles.traitDeckBtnDisabled]}
                    disabled={!canAsk}
                    onPress={() => setSelectedTraitCategory(cat)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.traitDeckIcon}>{cat.icon}</Text>
                    <Text style={styles.traitDeckTitle}>{cat.name}</Text>
                  </TouchableOpacity>
                );
              })}

              {/* Pass Turn Button */}
              <TouchableOpacity
                style={[
                  styles.traitDeckBtn,
                  {
                    backgroundColor: isEliminationPhase || (gameMode === 'offline_2p' && offlinePhase === 'eliminate') ? '#7C3AED' : '#334155',
                    borderColor: '#A855F7',
                  },
                ]}
                onPress={passTurn}
                activeOpacity={0.8}
              >
                <Text style={styles.traitDeckIcon}>⏭️</Text>
                <Text style={[styles.traitDeckTitle, { color: '#FFF' }]}>
                  {isEliminationPhase || (gameMode === 'offline_2p' && offlinePhase === 'eliminate') ? 'DONE / PASS' : 'PASS'}
                </Text>
              </TouchableOpacity>

              {/* Final Guess Button */}
              <TouchableOpacity
                style={[
                  styles.traitDeckBtn,
                  isGuessUnlocked
                    ? { backgroundColor: '#F59E0B', borderColor: '#FDE047' }
                    : { backgroundColor: '#1E293B', opacity: 0.75 },
                ]}
                onPress={() => {
                  if (!isGuessUnlocked) {
                    Alert.alert(
                      '🔒 Final Guess Locked',
                      `Final Guess unlocks when 3 or fewer suspects remain!\n\n(${remainingCount} suspects currently active on your board).`
                    );
                    return;
                  }
                  setGuessModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.traitDeckIcon}>{isGuessUnlocked ? '🏆' : '🔒'}</Text>
                <Text style={[styles.traitDeckTitle, isGuessUnlocked && { color: '#FFF', fontWeight: '900' }]}>
                  {isGuessUnlocked ? 'GUESS' : `LOCK (${remainingCount})`}
                </Text>
              </TouchableOpacity>

              {/* Chat Toggle (Online / Bot) */}
              {gameMode !== 'offline_2p' && (
                <TouchableOpacity
                  style={[styles.traitDeckBtn, { backgroundColor: '#0284C7' }]}
                  onPress={() => {
                    setChatDrawerOpen(true);
                    setUnreadChatCount(0);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.traitDeckIcon}>💬</Text>
                  <Text style={[styles.traitDeckTitle, { color: '#FFF' }]}>CHAT</Text>
                  {unreadChatCount > 0 && (
                    <View style={styles.chatBadgeCount}>
                      <Text style={styles.chatBadgeCountText}>{unreadChatCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}

      {/* ========================================================
          MODAL: TRAIT QUESTIONS DRAWER
          ======================================================== */}
      <Modal visible={!!selectedTraitCategory} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.drawerCard}>
            <View style={styles.drawerTopRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 24 }}>{selectedTraitCategory?.icon}</Text>
                <Text style={styles.drawerTitle}>{selectedTraitCategory?.name} QUESTIONS</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedTraitCategory(null)}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.drawerSubtitle}>Tap any question below to ask your opponent:</Text>

            <ScrollView style={{ maxHeight: 280, marginVertical: 8 }} showsVerticalScrollIndicator={false}>
              {selectedTraitCategory?.options.map((opt, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.questionOptionRow}
                  onPress={() => askQuestion(opt.label)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Text style={{ fontSize: 20 }}>{opt.emoji || selectedTraitCategory?.icon}</Text>
                    <Text style={styles.questionOptionText}>{opt.label}</Text>
                  </View>
                  <Text style={styles.questionOptionArrow}>➔</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL: PASS & PLAY PRIVACY SHIELD
          ======================================================== */}
      <Modal visible={privacyShieldVisible} transparent animationType="fade">
        <View style={styles.privacyShieldBackdrop}>
          <View style={styles.privacyShieldCard}>
            <Text style={styles.privacyShieldEmoji}>🛡️</Text>
            <Text style={styles.privacyShieldTitle}>{privacyShieldInfo.title}</Text>
            <Text style={styles.privacyShieldSub}>{privacyShieldInfo.subtitle}</Text>

            <View style={styles.privacyWarningPill}>
              <Text style={styles.privacyWarningText}>DO NOT PEEK AT THE SCREEN</Text>
            </View>

            <TouchableOpacity
              style={styles.privacyProceedBtn}
              onPress={privacyShieldInfo.onProceed}
              activeOpacity={0.85}
            >
              <Text style={styles.privacyProceedBtnText}>{privacyShieldInfo.nextPlayerText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL: MY SECRET SUSPECT INSPECTOR
          ======================================================== */}
      <Modal visible={secretModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.secretInspectorCard}>
            <View style={styles.secretInspectorHeader}>
              <Text style={{ fontSize: 22 }}>🔒</Text>
              <Text style={styles.secretInspectorTitle}>YOUR SECRET SUSPECT</Text>
            </View>

            {currentSecretSuspect && (() => {
              const traits = getSuspectTraits(currentSecretSuspect);
              return (
                <View style={styles.secretInspectorBody}>
                  <Image source={{ uri: currentSecretSuspect.avatar }} style={styles.secretInspectorAvatar} />
                  <Text style={styles.secretInspectorName}>{currentSecretSuspect.name}</Text>

                  <View style={styles.secretTraitsTable}>
                    <View style={styles.traitRow}>
                      <Text style={styles.traitLabel}>Gender:</Text>
                      <Text style={styles.traitValue}>{traits.gender}</Text>
                    </View>
                    <View style={styles.traitRow}>
                      <Text style={styles.traitLabel}>Hair Color:</Text>
                      <Text style={styles.traitValue}>{traits.hairColor}</Text>
                    </View>
                    <View style={styles.traitRow}>
                      <Text style={styles.traitLabel}>Accessories:</Text>
                      <Text style={styles.traitValue}>
                        {traits.accessories.length > 0
                          ? traits.accessories.join(', ')
                          : 'None'}
                      </Text>
                    </View>
                    <View style={styles.traitRow}>
                      <Text style={styles.traitLabel}>Facial Hair:</Text>
                      <Text style={styles.traitValue}>
                        {traits.facialHair.length > 0
                          ? traits.facialHair.join(', ')
                          : 'None'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={() => setSecretModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryActionText}>Keep Secret & Return ➔</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL: FINAL GUESS (ACCUSATION)
          ======================================================== */}
      <Modal visible={guessModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.guessAccusationCard}>
            <View style={styles.drawerTopRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 22 }}>🎯</Text>
                <Text style={styles.drawerTitle}>MAKE FINAL ACCUSATION</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setGuessModalVisible(false)}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.drawerSubtitle}>
              Select the suspect you believe is your opponent's secret character:
            </Text>

            <View style={styles.accusationWarningBanner}>
              <Text style={styles.accusationWarningIcon}>⚠️</Text>
              <Text style={styles.accusationWarningText}>
                HIGH-STAKES: An incorrect accusation results in an INSTANT MATCH LOSS!
              </Text>
            </View>

            <FlatList
              data={CHARACTERS_LIST.filter((c) => !currentActiveEliminated.includes(c.id))}
              keyExtractor={(item) => item.id.toString()}
              numColumns={4}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 260, marginVertical: 8 }}
              renderItem={({ item }) => {
                const isSelected = selectedGuessItem?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.guessSuspectTile, isSelected && styles.guessSuspectTileSelected]}
                    onPress={() => setSelectedGuessItem(item)}
                    activeOpacity={0.7}
                  >
                    <Image source={{ uri: item.avatar }} style={styles.guessSuspectAvatar} />
                    <Text style={styles.guessSuspectName} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={styles.cancelGuessBtn}
                onPress={() => {
                  setGuessModalVisible(false);
                  setSelectedGuessItem(null);
                }}
              >
                <Text style={styles.cancelGuessBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmGuessBtn, !selectedGuessItem && { opacity: 0.5 }]}
                disabled={!selectedGuessItem}
                onPress={submitFinalGuess}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmGuessBtnText}>
                  {selectedGuessItem ? `Confirm "${selectedGuessItem.name}" 🏆` : 'Pick Suspect'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL: GAME OVER VICTORY / DEFEAT CELEBRATION
          ======================================================== */}
      {gameOverData && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.victoryCard}>
              <Text style={styles.victoryEmoji}>{gameOverData.isWinner ? '🎉' : '💀'}</Text>
              <Text style={styles.victoryTitle}>
                {gameOverData.reason === 'wrong_guess'
                  ? gameOverData.isWinner
                    ? 'OPPONENT ELIMINATED! 🎯'
                    : 'DIRECT ELIMINATION! 💥'
                  : gameOverData.isWinner
                  ? 'VICTORY! 🏆'
                  : 'DEFEAT! 💀'}
              </Text>
              <Text style={styles.victorySubtitle}>
                {gameOverData.reason === 'wrong_guess'
                  ? gameOverData.isWinner
                    ? `${gameOverData.guesserName || 'Opponent'} wrongly accused "${gameOverData.guessedCharacterName || 'Suspect'}" and lost immediately! You win directly! 🎯`
                    : `You wrongly accused "${gameOverData.guessedCharacterName || 'Suspect'}" and lost the match directly! 💥`
                  : gameOverData.isWinner
                  ? `${gameOverData.winnerName} correctly cracked the secret suspect!`
                  : `${gameOverData.winnerName} identified your secret suspect!`}
              </Text>
              {/* Coins Pot & XP Payout Banner */}
              {gameOverData.isWinner ? (
                <View style={styles.coinRewardBanner}>
                  <Text style={styles.coinRewardTitle}>🪙 +200 COIN POT WON!</Text>
                  <Text style={styles.coinRewardSub}>+100 XP Earned • Level Up Progression ⭐</Text>
                </View>
              ) : (
                <View style={styles.coinLossBanner}>
                  <Text style={styles.coinLossTitle}>💸 -100 COINS (MATCH POT LOST)</Text>
                  <Text style={styles.coinLossSub}>Remember: Incorrect final guess is an instant match loss!</Text>
                </View>
              )}

              <View style={styles.victorySuspectRow}>
                {gameOverData.winningCharacter && (
                  <View style={styles.victorySuspectBox}>
                    <Text style={styles.victorySuspectTag}>OPPONENT SECRET</Text>
                    <Image source={{ uri: gameOverData.winningCharacter.avatar }} style={styles.victoryAvatar} />
                    <Text style={styles.victorySuspectName}>{gameOverData.winningCharacter.name}</Text>
                  </View>
                )}

                {gameOverData.opponentCharacter && (
                  <View style={styles.victorySuspectBox}>
                    <Text style={styles.victorySuspectTag}>YOUR SECRET</Text>
                    <Image source={{ uri: gameOverData.opponentCharacter.avatar }} style={styles.victoryAvatar} />
                    <Text style={styles.victorySuspectName}>{gameOverData.opponentCharacter.name}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity style={styles.primaryActionButton} onPress={restartGame} activeOpacity={0.85}>
                <Text style={styles.primaryActionText}>PLAY AGAIN 🔄</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.exitVictoryBtn} onPress={confirmExitGame}>
                <Text style={styles.exitVictoryText}>Back to Main Menu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ========================================================
          MODAL: LIVE CHAT & LOG DRAWER
          ======================================================== */}
      <Modal visible={chatDrawerOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.chatDrawerCard}>
            <View style={styles.chatDrawerHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={styles.liveIndicatorDot} />
                <Text style={styles.chatDrawerTitle}>MATCH CHAT & CLUES</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setChatDrawerOpen(false)}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Emojis */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickEmojisBar}>
              {QUICK_EMOJIS.map((e, idx) => (
                <TouchableOpacity key={idx} style={styles.quickEmojiBtn} onPress={() => sendChatMessage(e)}>
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Quick Phrases */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickPhrasesBar}>
              {QUICK_PHRASES.map((p, idx) => (
                <TouchableOpacity key={idx} style={styles.quickPhraseChip} onPress={() => sendChatMessage(p)}>
                  <Text style={styles.quickPhraseText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Messages Feed */}
            <ScrollView
              ref={chatScrollRef}
              style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 8 }}
              onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.map((m, idx) => {
                const isMe = m.from === 'me';
                const isSys = m.from === 'system';

                if (isSys) {
                  return (
                    <View key={idx} style={styles.chatSystemNotice}>
                      <Text style={styles.chatSystemNoticeText}>{m.text}</Text>
                    </View>
                  );
                }

                return (
                  <View key={idx} style={[styles.chatBubbleRow, isMe ? styles.chatBubbleMe : styles.chatBubbleOpp]}>
                    <Text style={styles.chatBubbleSender}>{isMe ? 'You' : m.senderName || 'Opponent'}</Text>
                    <Text style={styles.chatBubbleBody}>{m.text}</Text>
                  </View>
                );
              })}
            </ScrollView>

            {/* Input Row */}
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatTextInput}
                placeholder="Type a message or clue..."
                placeholderTextColor="#94A3B8"
                value={chatText}
                onChangeText={setChatText}
                onSubmitEditing={() => sendChatMessage()}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[styles.chatSendBtn, !chatText.trim() && { opacity: 0.5 }]}
                disabled={!chatText.trim()}
                onPress={() => sendChatMessage()}
              >
                <Text style={styles.chatSendBtnText}>Send 🚀</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL: RULES (HOW TO PLAY)
          ======================================================== */}
      <Modal visible={activeSubModal === 'rules'} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.infoModalCard}>
            <Text style={styles.infoModalTitle}>📖 Guess Who? Official Rules</Text>
            <ScrollView style={{ maxHeight: 300, marginVertical: 10 }}>
              <Text style={styles.ruleStep}>1. 🕵️‍♂️ Secret Pick: Each detective secretly chooses 1 suspect card from the 36 suspects pool.</Text>
              <Text style={styles.ruleStep}>2. ❓ Trait Interrogation: Take turns asking Yes/No questions (e.g. "Is the suspect Female?", "Wearing a hat?", "Has black hair?").</Text>
              <Text style={styles.ruleStep}>3. ✂️ Board Elimination: Tap suspects on your tactile board to eliminate them (✕) based on the clue.</Text>
              <Text style={[styles.ruleStep, { color: '#EF4444', fontWeight: '900' }]}>
                4. ⚡ HIGH-STAKES ACCUSATION: When you tap GUESS to accuse:
                {'\n'}• If your guess is RIGHT: YOU WIN INSTANTLY! 🏆
                {'\n'}• If your guess is WRONG: YOU DIRECTLY LOSE! Opponent wins immediately! 💥
              </Text>
              <Text style={[styles.ruleStep, { color: '#F59E0B', fontWeight: '800' }]}>
                5. 🪙 100 COIN POT: Each match costs 100 coins from each player. The winner takes home the 200 Coin Pot!
              </Text>
              <Text style={[styles.ruleStep, { color: '#38BDF8', fontWeight: '800' }]}>
                6. ⭐ DETECTIVE RANKS: Every win gives +100 XP to level up your detective rank (Rookie ➔ Junior ➔ Senior ➔ Mastermind ➔ Sherlock)!
              </Text>
              <Text style={styles.ruleStep}>7. 🎙️ Live Voice Chat: Press and hold "HOLD TO TALK" to speak with your opponent live!</Text>
            </ScrollView>
            <TouchableOpacity style={styles.primaryActionButton} onPress={() => setActiveSubModal(null)}>
              <Text style={styles.primaryActionText}>Got it! 🚀</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL: SETTINGS
          ======================================================== */}
      <Modal visible={activeSubModal === 'settings'} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.infoModalCard}>
            <Text style={styles.infoModalTitle}>⚙️ Settings</Text>

            {/* Detective Profile Shortcut in Settings */}
            <TouchableOpacity
              style={styles.settingsProfileBtn}
              onPress={() => {
                setActiveSubModal(null);
                setOnboardingVisible(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 20 }}>🕵️‍♂️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingsProfileBtnTitle}>
                  {userProfile ? `Edit Profile: ${userProfile.name}` : 'Setup Detective Profile'}
                </Text>
                <Text style={styles.settingsProfileBtnSub}>Update name, birth date, age & signature avatar</Text>
              </View>
              <Text style={{ color: '#38BDF8', fontWeight: '900' }}>➔</Text>
            </TouchableOpacity>

            <Text style={styles.settingLabel}>Your Player Name</Text>
            <TextInput
              style={styles.settingInput}
              value={playerName}
              onChangeText={setPlayerName}
              placeholder="Player Name"
            />

            <Text style={[styles.settingLabel, { marginTop: 12 }]}>Backend Server URL</Text>
            <TextInput
              style={styles.settingInput}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="http://192.168.1.X:3000"
            />

            {/* Audio & Music Settings Box */}
            <View style={styles.audioSettingsBox}>
              <Text style={styles.audioSettingsTitle}>🎵 AUDIO & MUSIC CONTROLS</Text>

              {/* Background Music Toggle */}
              <View style={styles.audioRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.audioRowLabel}>Background Music</Text>
                  <Text style={styles.audioRowSub}>Loop cheerful detective arcade music</Text>
                </View>
                <TouchableOpacity
                  style={[styles.audioToggleBtn, bgMusicEnabled && styles.audioToggleBtnActive]}
                  onPress={toggleMusic}
                  activeOpacity={0.8}
                >
                  <Text style={styles.audioToggleBtnText}>{bgMusicEnabled ? 'MUSIC ON 🎵' : 'MUSIC OFF 🔇'}</Text>
                </TouchableOpacity>
              </View>

              {/* Mute All Audio Toggle */}
              <View style={styles.audioRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.audioRowLabel}>Mute All Sounds</Text>
                  <Text style={styles.audioRowSub}>Silence both music & sound effects</Text>
                </View>
                <TouchableOpacity
                  style={[styles.audioToggleBtn, isMuted ? styles.audioToggleBtnMuted : styles.audioToggleBtnActive]}
                  onPress={toggleMute}
                  activeOpacity={0.8}
                >
                  <Text style={styles.audioToggleBtnText}>{isMuted ? 'MUTED 🔇' : 'UNMUTED 🔊'}</Text>
                </TouchableOpacity>
              </View>

              {/* Volume Adjuster */}
              <View>
                <View style={[styles.audioRow, { marginBottom: 6 }]}>
                  <Text style={styles.audioRowLabel}>Music Volume</Text>
                  <Text style={[styles.audioRowLabel, { color: '#38BDF8' }]}>{Math.round(musicVolume * 100)}%</Text>
                </View>
                <View style={styles.volumeMeterRow}>
                  <TouchableOpacity
                    style={styles.volumeStepBtn}
                    onPress={() => adjustVolume(-0.1)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.volumeStepBtnText}>-</Text>
                  </TouchableOpacity>

                  <View style={styles.volumeLevelPills}>
                    {[0.25, 0.5, 0.75, 1.0].map((lvl) => {
                      const isActive = musicVolume >= lvl;
                      return (
                        <TouchableOpacity
                          key={lvl}
                          style={[styles.volumePill, isActive && styles.volumePillActive]}
                          onPress={() => setExactVolume(lvl)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.volumePillText, isActive && styles.volumePillTextActive]}>
                            {Math.round(lvl * 100)}%
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    style={styles.volumeStepBtn}
                    onPress={() => adjustVolume(0.1)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.volumeStepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sound Effects (SFX) Toggle */}
              <View style={styles.audioRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.audioRowLabel}>Game Sound Effects</Text>
                  <Text style={styles.audioRowSub}>Card clicks, flips, dings & buzzers</Text>
                </View>
                <TouchableOpacity
                  style={[styles.audioToggleBtn, sfxEnabled && styles.audioToggleBtnActive]}
                  onPress={toggleSfx}
                  activeOpacity={0.8}
                >
                  <Text style={styles.audioToggleBtnText}>{sfxEnabled ? 'SFX ON 🔔' : 'SFX OFF 🔕'}</Text>
                </TouchableOpacity>
              </View>

              {/* In-Game Real-Time Voice Chat Setting */}
              <View style={styles.audioRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.audioRowLabel}>Live Voice Chat (Mic)</Text>
                  <Text style={styles.audioRowSub}>
                    {voiceState.isConnected
                      ? 'Connected 🟢'
                      : voiceState.isConnecting
                      ? 'Connecting 🟡'
                      : 'Active in online matches 🎙️'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.audioToggleBtn, !voiceState.isMicMuted ? styles.audioToggleBtnActive : styles.audioToggleBtnMuted]}
                  onPress={() => voiceManager.toggleMic()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.audioToggleBtnText}>
                    {!voiceState.isMicMuted ? 'MIC ON 🎙️' : 'MIC MUTED 🔇'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={() => {
                initSocket(serverUrl);
                Alert.alert('Saved', 'Reconnected to ' + serverUrl);
                setActiveSubModal(null);
              }}
            >
              <Text style={styles.primaryActionText}>Save & Reconnect</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancelLink} onPress={() => setActiveSubModal(null)}>
              <Text style={styles.modalCancelLinkText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL: FIRST-TIME USER ONBOARDING (NAME, DOB, AGE, AVATAR)
          ======================================================== */}
      <OnboardingModal
        visible={onboardingVisible}
        onComplete={handleOnboardingComplete}
      />

      {/* ========================================================
          MODAL: MATCHMAKING RADAR & P1 VS P2 CINEMATIC CLASH
          ======================================================== */}
      <MatchmakingModal
        visible={matchmakingModalVisible}
        status={matchmakingStatus}
        player1={{
          name: playerName || userProfile?.name || 'Player 1',
          avatar: userProfile?.avatarUrl || null,
        }}
        player2={matchedOpponent}
        onCancel={cancelMatchmaking}
        onMatchAnimationComplete={handleMatchAnimationComplete}
      />
    </SafeAreaView>
  );
}

// ========================================================
// STYLES
// ========================================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },

  // --- HOME SCREEN ---
  homeContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  homeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconText: {
    fontSize: 20,
  },
  brandContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandDetectiveEmoji: {
    fontSize: 26,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 1.5,
  },
  brandSub: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 1.2,
    marginTop: 2,
  },

  // Marquee Strip
  marqueeStrip: {
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  marqueeScroll: {
    paddingHorizontal: 12,
    gap: 12,
  },
  marqueeAvatarWrap: {
    alignItems: 'center',
    width: 44,
  },
  marqueeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
  },
  marqueeName: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '700',
  },

  // Player Detective Profile Banner
  playerProfileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    gap: 12,
    shadowColor: '#38BDF8',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  profileBannerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#38BDF8',
    backgroundColor: '#0F172A',
  },
  profileBannerInfo: {
    flex: 1,
  },
  profileBannerName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  profileBadgeTag: {
    backgroundColor: '#0369A1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  profileBadgeTagText: {
    color: '#E0F2FE',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  profileBannerSub: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },

  // Settings Profile Shortcut
  settingsProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  settingsProfileBtnTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  settingsProfileBtnSub: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },

  // Mode Cards
  modesScrollView: {
    flex: 1,
  },
  modesContainer: {
    padding: 16,
    gap: 14,
  },
  modeCard: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  modeCardShadow: {
    borderRadius: 18,
    paddingBottom: 5,
  },
  modeCardFace: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 14,
  },
  modeIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeIconEmoji: {
    fontSize: 26,
  },
  modeTextColumn: {
    flex: 1,
  },
  modeBadgeOnline: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  modeBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modeTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modeDesc: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    marginTop: 2,
  },
  modeArrow: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },

  botPracticeBtn: {
    alignSelf: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  botPracticeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
  },

  // Bottom Score Bar
  bottomScoreBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  scorePlayerSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  redScoreBadge: {
    backgroundColor: '#EF4444',
  },
  blueScoreBadge: {
    backgroundColor: '#3B82F6',
  },
  scoreNumber: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },
  scoreLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
  },
  scoreCenterDivider: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  vsBadgeText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900',
  },

  // --- SUB SCREENS (CUSTOM ROOM / LOBBY / SEARCHING) ---
  customRoomContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  subScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backCircleBtnText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },
  subScreenTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  customRoomContent: {
    padding: 16,
  },
  customBox: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 18,
    alignItems: 'center',
  },
  customBoxIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  customBoxTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
  },
  customBoxDesc: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
    marginVertical: 8,
  },
  roomCodeTextInput: {
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#4F46E5',
    borderRadius: 12,
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 2,
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  radarPulseRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(56,189,248,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchingEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  searchingTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
  },
  searchingSub: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  cancelActionBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 24,
  },
  cancelActionText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },

  lobbyEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  lobbyTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
  },
  lobbySub: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  shareCodeCard: {
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#4F46E5',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 30,
    alignItems: 'center',
    marginVertical: 18,
  },
  shareCodeLabel: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  shareCodeValue: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: 4,
  },
  lobbyHint: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // --- SELECTION SCREEN ---
  selectionScreenContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  exitMiniBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  exitMiniBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  selectionTitleText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  selectionSubtitleText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  randomMiniBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  randomMiniBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  previewLockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderRadius: 14,
    margin: 10,
    padding: 10,
    gap: 10,
  },
  previewAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#334155',
  },
  previewName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },
  previewTraitsSummary: {
    color: '#CBD5E1',
    fontSize: 10,
    marginTop: 2,
  },
  lockInSecretBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  lockInSecretBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
  },

  // --- PLAYING BOARD SCREEN ---
  playingMainContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  playingTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  secretPeekBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#4F46E5',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  secretPeekAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#334155',
  },
  secretPeekLabel: {
    color: '#818CF8',
    fontSize: 8,
    fontWeight: '900',
  },
  secretPeekName: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    maxWidth: 70,
  },
  turnStatusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  turnPillRed: {
    backgroundColor: '#EF4444',
  },
  turnPillBlue: {
    backgroundColor: '#3B82F6',
  },
  turnPillMine: {
    backgroundColor: '#10B981',
  },
  turnPillOpp: {
    backgroundColor: '#F59E0B',
  },
  turnPillSpeaking: {
    backgroundColor: '#047857',
    borderWidth: 1.5,
    borderColor: '#34D399',
  },
  speakingWaveBorder: {
    borderColor: '#34D399',
    backgroundColor: '#064E3B33',
  },
  liveVoiceBadge: {
    color: '#34D399',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  turnStatusPillText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  suspectCountBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  suspectCountText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '900',
  },
  exitPlayingBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exitPlayingBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },

  // 3D Wooden/Physical Board
  woodenBoardWrapper: {
    flex: 1,
    backgroundColor: '#1E293B',
    margin: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  boardGridPadding: {
    padding: 6,
  },
  tactileBoardCard: {
    width: Math.floor((width - 44) / 4),
    height: 96,
    margin: 3,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  tactileBoardCardSelected: {
    borderColor: '#F59E0B',
    borderWidth: 2.5,
    backgroundColor: '#FEF3C7',
  },
  tactileBoardCardEliminated: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    opacity: 0.35,
  },
  cardAvatar: {
    width: 58,
    height: 58,
    marginTop: 4,
    borderRadius: 8,
  },
  cardAvatarEliminated: {
    opacity: 0.2,
  },
  cardNameBar: {
    width: '100%',
    backgroundColor: '#0F172A',
    paddingVertical: 3,
    alignItems: 'center',
  },
  cardNameBarEliminated: {
    backgroundColor: '#0F172A',
  },
  cardNameText: {
    color: '#F8FAFC',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  cardNameTextEliminated: {
    color: '#64748B',
    textDecorationLine: 'line-through',
  },
  cardCrossOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardCrossSymbol: {
    color: '#EF4444',
    fontSize: 28,
    fontWeight: '900',
  },

  // Clue & Question Banners
  clueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 6,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  clueBannerYes: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
  },
  clueBannerNo: {
    backgroundColor: '#7F1D1D',
    borderColor: '#EF4444',
  },
  clueBannerBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clueBannerBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
  },
  clueBannerQuestion: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  clueBannerSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 9,
    marginTop: 1,
  },
  clueDismissBtn: {
    padding: 6,
  },
  clueDismissText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },

  incomingQuestionBanner: {
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#F59E0B',
    marginHorizontal: 8,
    marginBottom: 6,
    padding: 10,
    borderRadius: 12,
  },
  incomingQuestionTitle: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  incomingQuestionText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    marginVertical: 4,
  },
  incomingQuestionBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  answerChoiceBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  answerChoiceBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },

  // Bottom Control Deck
  bottomControlDeck: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  traitsRowDeck: {
    flexDirection: 'row',
    gap: 6,
  },
  traitDeckBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  traitDeckBtnDisabled: {
    opacity: 0.45,
  },
  traitDeckIcon: {
    fontSize: 16,
  },
  traitDeckTitle: {
    color: '#CBD5E1',
    fontSize: 8,
    fontWeight: '900',
    marginTop: 2,
  },
  chatBadgeCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatBadgeCountText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },

  // --- MODALS COMMON ---
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  drawerCard: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
  },
  drawerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  drawerTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  drawerSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 6,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  questionOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
  },
  questionOptionText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  questionOptionArrow: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '900',
  },

  // Privacy Shield Modal
  privacyShieldBackdrop: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  privacyShieldCard: {
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  privacyShieldEmoji: {
    fontSize: 54,
    marginBottom: 10,
  },
  privacyShieldTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  privacyShieldSub: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 12,
    lineHeight: 18,
  },
  privacyWarningPill: {
    backgroundColor: '#7F1D1D',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 20,
  },
  privacyWarningText: {
    color: '#FCA5A5',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  privacyProceedBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  privacyProceedBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Secret Inspector
  secretInspectorCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#4F46E5',
    padding: 20,
    margin: 20,
    alignSelf: 'center',
    width: '90%',
    maxWidth: 380,
  },
  secretInspectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  secretInspectorTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  secretInspectorBody: {
    alignItems: 'center',
    marginVertical: 8,
  },
  secretInspectorAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#334155',
    marginBottom: 8,
  },
  secretInspectorName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  secretTraitsTable: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    gap: 6,
  },
  traitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  traitLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  traitValue: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '900',
  },

  // Guess Accusation Card
  accusationWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7F1D1D44',
    borderWidth: 1,
    borderColor: '#EF444488',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginVertical: 6,
    gap: 6,
  },
  accusationWarningIcon: {
    fontSize: 14,
  },
  accusationWarningText: {
    flex: 1,
    color: '#FCA5A5',
    fontSize: 10,
    fontWeight: '800',
  },
  guessAccusationCard: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  guessSuspectTile: {
    flex: 1,
    margin: 4,
    padding: 6,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#334155',
    alignItems: 'center',
  },
  guessSuspectTileSelected: {
    borderColor: '#F59E0B',
    backgroundColor: '#1E3A8A',
  },
  guessSuspectAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 4,
  },
  guessSuspectName: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  cancelGuessBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelGuessBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  confirmGuessBtn: {
    flex: 2,
    backgroundColor: '#D97706',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmGuessBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },

  // Victory Card
  victoryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#F59E0B',
    padding: 24,
    margin: 20,
    alignItems: 'center',
    alignSelf: 'center',
    width: '90%',
    maxWidth: 380,
  },
  victoryEmoji: {
    fontSize: 50,
    marginBottom: 6,
  },
  victoryTitle: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },
  victorySubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  victorySuspectRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 18,
  },
  victorySuspectBox: {
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  victorySuspectTag: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  victoryAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 6,
  },
  victorySuspectName: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },
  exitVictoryBtn: {
    marginTop: 12,
  },
  exitVictoryText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },

  // Chat Drawer
  chatDrawerCard: {
    height: '75%',
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chatDrawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  liveIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  chatDrawerTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  quickEmojisBar: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#0F172A',
  },
  quickEmojiBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quickPhrasesBar: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  quickPhraseChip: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
  },
  quickPhraseText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '800',
  },
  chatBubbleRow: {
    marginVertical: 4,
    maxWidth: '80%',
    padding: 8,
    borderRadius: 12,
  },
  chatBubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563EB',
  },
  chatBubbleOpp: {
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
  },
  chatBubbleSender: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 2,
  },
  chatBubbleBody: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  chatSystemNotice: {
    alignSelf: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginVertical: 4,
  },
  chatSystemNoticeText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  chatInputRow: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#0F172A',
    gap: 8,
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFF',
    fontSize: 12,
  },
  chatSendBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatSendBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
  },

  // Info Modal (Settings / Rules)
  infoModalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 20,
    margin: 20,
    alignSelf: 'center',
    width: '90%',
    maxWidth: 380,
  },
  infoModalTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
  },
  ruleStep: {
    color: '#CBD5E1',
    fontSize: 12,
    marginVertical: 4,
    lineHeight: 18,
  },
  settingLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  settingInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFF',
    fontSize: 13,
  },
  modalCancelLink: {
    alignSelf: 'center',
    marginTop: 10,
  },
  modalCancelLinkText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },

  // Reusable Primary Button
  primaryActionButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  primaryActionText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Audio Controls in Settings Modal
  audioSettingsBox: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#334155',
    marginVertical: 12,
    gap: 12,
  },
  audioSettingsTitle: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  audioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  audioRowLabel: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  audioRowSub: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  audioToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569',
  },
  audioToggleBtnActive: {
    backgroundColor: '#10B981',
    borderColor: '#34D399',
  },
  audioToggleBtnMuted: {
    backgroundColor: '#EF4444',
    borderColor: '#F87171',
  },
  audioToggleBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
  },
  volumeMeterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  volumeStepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  volumeStepBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  volumeLevelPills: {
    flexDirection: 'row',
    flex: 1,
    gap: 4,
  },
  volumePill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  volumePillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#60A5FA',
  },
  volumePillText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
  },
  volumePillTextActive: {
    color: '#FFF',
    fontWeight: '900',
  },

  // Coin Rewards & Loss Banners
  coinRewardBanner: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    marginVertical: 10,
    width: '100%',
  },
  coinRewardTitle: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  coinRewardSub: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  coinLossBanner: {
    backgroundColor: '#7F1D1D',
    borderColor: '#EF4444',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    marginVertical: 10,
    width: '100%',
  },
  coinLossTitle: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '900',
  },
  coinLossSub: {
    color: '#FECACA',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  profileCoinsText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '900',
  },
  profileRecordText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
});
