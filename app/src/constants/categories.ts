export interface GameItem {
  id: number;
  name: string;
  avatar: string;
  traits: {
    gender: 'Male' | 'Female';
    hairColor: 'Blonde' | 'Brown' | 'Black' | 'Red' | 'White' | 'Grey' | 'Bald';
    accessories: string[]; // 'glasses', 'hat', 'earrings', 'necklace'
    facialHair: string[]; // 'mustache', 'beard', 'none'
  };
}

export interface TraitOption {
  label: string;
  emoji?: string;
  key: string;
  check: (traits: GameItem['traits']) => boolean;
}

export interface TraitCategory {
  id: string;
  name: string;
  icon: string;
  options: TraitOption[];
}

export const CHARACTERS_LIST: GameItem[] = [
  { id: 1, name: 'Lucy', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Lucy&backgroundColor=ffd5dc', traits: { gender: 'Female', hairColor: 'Black', accessories: ['hat', 'earrings'], facialHair: ['none'] } },
  { id: 2, name: 'Tom', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Tom&backgroundColor=ffdfbf', traits: { gender: 'Male', hairColor: 'Brown', accessories: ['glasses'], facialHair: ['mustache'] } },
  { id: 3, name: 'Sara', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Sara&backgroundColor=d1d4f9', traits: { gender: 'Female', hairColor: 'Brown', accessories: ['glasses', 'hat'], facialHair: ['none'] } },
  { id: 4, name: 'Emma', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Emma&backgroundColor=ffd5dc', traits: { gender: 'Female', hairColor: 'White', accessories: ['earrings'], facialHair: ['none'] } },
  { id: 5, name: 'Henry', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Henry&backgroundColor=c0aede', traits: { gender: 'Male', hairColor: 'Black', accessories: [], facialHair: ['beard'] } },
  { id: 6, name: 'Rose', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Rose&backgroundColor=b6e3f4', traits: { gender: 'Female', hairColor: 'Black', accessories: ['hat'], facialHair: ['none'] } },
  { id: 7, name: 'Jeff', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Jeff&backgroundColor=ffdfbf', traits: { gender: 'Male', hairColor: 'Blonde', accessories: ['glasses'], facialHair: ['beard'] } },
  { id: 8, name: 'Lia', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Lia&backgroundColor=ffd5dc', traits: { gender: 'Female', hairColor: 'Grey', accessories: ['earrings'], facialHair: ['none'] } },
  { id: 9, name: 'Rob', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Rob&backgroundColor=c0aede', traits: { gender: 'Male', hairColor: 'Black', accessories: ['hat'], facialHair: ['beard'] } },
  { id: 10, name: 'Aria', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Aria&backgroundColor=d1d4f9', traits: { gender: 'Female', hairColor: 'White', accessories: ['glasses'], facialHair: ['none'] } },
  { id: 11, name: 'Bob', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Bob&backgroundColor=b6e3f4', traits: { gender: 'Male', hairColor: 'Brown', accessories: [], facialHair: ['none'] } },
  { id: 12, name: 'Bella', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Bella&backgroundColor=ffd5dc', traits: { gender: 'Female', hairColor: 'Red', accessories: [], facialHair: ['none'] } },
  { id: 13, name: 'Sophia', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Sophia&backgroundColor=ffdfbf', traits: { gender: 'Female', hairColor: 'Blonde', accessories: [], facialHair: ['none'] } },
  { id: 14, name: 'Jack', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Jack&backgroundColor=c0aede', traits: { gender: 'Male', hairColor: 'White', accessories: ['hat'], facialHair: ['beard'] } },
  { id: 15, name: 'Jose', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Jose&backgroundColor=b6e3f4', traits: { gender: 'Male', hairColor: 'Black', accessories: [], facialHair: ['beard', 'mustache'] } },
  { id: 16, name: 'Theo', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Theo&backgroundColor=d1d4f9', traits: { gender: 'Male', hairColor: 'Blonde', accessories: [], facialHair: ['none'] } },
  { id: 17, name: 'Annie', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Annie&backgroundColor=ffd5dc', traits: { gender: 'Female', hairColor: 'Red', accessories: ['earrings'], facialHair: ['none'] } },
  { id: 18, name: 'Paul', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Paul&backgroundColor=ffdfbf', traits: { gender: 'Male', hairColor: 'Brown', accessories: [], facialHair: ['beard', 'mustache'] } },
  { id: 19, name: 'Olivia', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Olivia&backgroundColor=b6e3f4', traits: { gender: 'Female', hairColor: 'Black', accessories: ['earrings'], facialHair: ['none'] } },
  { id: 20, name: 'Chloe', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Chloe&backgroundColor=ffd5dc', traits: { gender: 'Female', hairColor: 'Brown', accessories: ['necklace'], facialHair: ['none'] } },
  { id: 21, name: 'Nora', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Nora&backgroundColor=c0aede', traits: { gender: 'Female', hairColor: 'Brown', accessories: ['glasses', 'hat'], facialHair: ['none'] } },
  { id: 22, name: 'James', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=James&backgroundColor=d1d4f9', traits: { gender: 'Male', hairColor: 'Brown', accessories: ['glasses', 'hat'], facialHair: ['none'] } },
  { id: 23, name: 'Bill', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Bill&backgroundColor=ffdfbf', traits: { gender: 'Male', hairColor: 'Blonde', accessories: [], facialHair: ['none'] } },
  { id: 24, name: 'Julia', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Julia&backgroundColor=ffd5dc', traits: { gender: 'Female', hairColor: 'White', accessories: ['necklace'], facialHair: ['none'] } },
  { id: 25, name: 'Naomi', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Naomi&backgroundColor=b6e3f4', traits: { gender: 'Female', hairColor: 'Black', accessories: [], facialHair: ['none'] } },
  { id: 26, name: 'Ryan', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Ryan&backgroundColor=ffdfbf', traits: { gender: 'Male', hairColor: 'Brown', accessories: ['glasses', 'hat'], facialHair: ['mustache'] } },
  { id: 27, name: 'David', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=David&backgroundColor=c0aede', traits: { gender: 'Male', hairColor: 'Black', accessories: [], facialHair: ['mustache'] } },
  { id: 28, name: 'Mila', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Mila&backgroundColor=ffd5dc', traits: { gender: 'Female', hairColor: 'Blonde', accessories: ['glasses'], facialHair: ['none'] } },
  { id: 29, name: 'John', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=John&backgroundColor=d1d4f9', traits: { gender: 'Male', hairColor: 'White', accessories: ['hat'], facialHair: ['beard'] } },
  { id: 30, name: 'Ben', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Ben&backgroundColor=ffdfbf', traits: { gender: 'Male', hairColor: 'Bald', accessories: ['glasses'], facialHair: ['none'] } },
  { id: 31, name: 'Luna', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Luna&backgroundColor=ffd5dc', traits: { gender: 'Female', hairColor: 'Red', accessories: ['earrings', 'glasses'], facialHair: ['none'] } },
  { id: 32, name: 'Zack', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Zack&backgroundColor=b6e3f4', traits: { gender: 'Male', hairColor: 'Blonde', accessories: ['hat'], facialHair: ['beard'] } },
  { id: 33, name: 'Elena', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Elena&backgroundColor=d1d4f9', traits: { gender: 'Female', hairColor: 'Black', accessories: ['necklace'], facialHair: ['none'] } },
  { id: 34, name: 'Victor', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Victor&backgroundColor=c0aede', traits: { gender: 'Male', hairColor: 'Grey', accessories: ['glasses'], facialHair: ['mustache'] } },
  { id: 35, name: 'Maya', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Maya&backgroundColor=ffdfbf', traits: { gender: 'Female', hairColor: 'Brown', accessories: ['hat'], facialHair: ['none'] } },
  { id: 36, name: 'Oscar', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Oscar&backgroundColor=b6e3f4', traits: { gender: 'Male', hairColor: 'Bald', accessories: ['glasses', 'hat'], facialHair: ['beard'] } },
  { id: 37, name: 'Ravi', avatar: 'https://api.dicebear.com/9.x/adventurer/png?seed=Ravi&backgroundColor=c0aede', traits: { gender: 'Male', hairColor: 'Black', accessories: ['glasses'], facialHair: ['mustache'] } },
];

export const TRAIT_CATEGORIES: TraitCategory[] = [
  {
    id: 'gender',
    name: 'GENDER',
    icon: '🚻',
    options: [
      { label: 'Is the suspect male?', emoji: '👨', key: 'gender', check: (t: any) => (t?.gender || t?.sex) === 'Male' },
      { label: 'Is the suspect female?', emoji: '👩', key: 'gender', check: (t: any) => (t?.gender || t?.sex) === 'Female' },
    ]
  },
  {
    id: 'hairColor',
    name: 'HAIR COLOR',
    icon: '🎨',
    options: [
      { label: 'Has blonde hair?', emoji: '👱', key: 'hairColor', check: (t: any) => (t?.hairColor || t?.hair) === 'Blonde' },
      { label: 'Has black hair?', emoji: '🧑‍🦱', key: 'hairColor', check: (t: any) => (t?.hairColor || t?.hair) === 'Black' },
      { label: 'Has brown hair?', emoji: '🟤', key: 'hairColor', check: (t: any) => (t?.hairColor || t?.hair) === 'Brown' },
      { label: 'Has red hair?', emoji: '🔴', key: 'hairColor', check: (t: any) => (t?.hairColor || t?.hair) === 'Red' },
      { label: 'Has white or grey hair?', emoji: '🦳', key: 'hairColor', check: (t: any) => (t?.hairColor || t?.hair) === 'White' || (t?.hairColor || t?.hair) === 'Grey' },
      { label: 'Is the person bald?', emoji: '👨‍🦲', key: 'hairColor', check: (t: any) => (t?.hairColor || t?.hair) === 'Bald' },
    ]
  },
  {
    id: 'accessories',
    name: 'ACCESSORIES',
    icon: '👓',
    options: [
      { label: 'Wearing glasses?', emoji: '👓', key: 'accessories', check: (t: any) => (Array.isArray(t?.accessories) && t.accessories.includes('glasses')) || !!t?.glasses },
      { label: 'Wearing a hat or cap?', emoji: '🧢', key: 'accessories', check: (t: any) => (Array.isArray(t?.accessories) && t.accessories.includes('hat')) || !!t?.hat },
      { label: 'Wearing earrings?', emoji: '👂', key: 'accessories', check: (t: any) => Array.isArray(t?.accessories) && t.accessories.includes('earrings') },
      { label: 'Wearing a necklace?', emoji: '📿', key: 'accessories', check: (t: any) => Array.isArray(t?.accessories) && t.accessories.includes('necklace') },
      { label: 'Has no accessories?', emoji: '❌', key: 'accessories', check: (t: any) => (!t?.accessories || t.accessories.length === 0) && !t?.glasses && !t?.hat },
    ]
  },
  {
    id: 'facialHair',
    name: 'FACIAL HAIR',
    icon: '🧔',
    options: [
      { label: 'Has a mustache?', emoji: '🥸', key: 'facialHair', check: (t: any) => (Array.isArray(t?.facialHair) && t.facialHair.includes('mustache')) || !!t?.mustache },
      { label: 'Has a beard?', emoji: '🧔', key: 'facialHair', check: (t: any) => (Array.isArray(t?.facialHair) && t.facialHair.includes('beard')) || (!!t?.facialHair && t.facialHair !== 'none' && t.facialHair !== false) },
      { label: 'Has beard & mustache?', emoji: '🧔‍♂️', key: 'facialHair', check: (t: any) => (Array.isArray(t?.facialHair) && t.facialHair.includes('beard') && t.facialHair.includes('mustache')) },
      { label: 'Clean shaven (no facial hair)?', emoji: '🪒', key: 'facialHair', check: (t: any) => !t?.facialHair || (Array.isArray(t?.facialHair) && (t.facialHair.includes('none') || t.facialHair.length === 0)) || t?.facialHair === false },
    ]
  },
];

export interface CategoryData {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  description: string;
  bgColor: string;
  traitCategories: TraitCategory[];
  items: GameItem[];
}

export const CATEGORIES: Record<string, CategoryData> = {
  characters: {
    id: 'characters',
    name: 'GUESS WHO?',
    tagline: '30 Suspects Deduction',
    icon: '🕵️‍♂️',
    description: 'Ask clever Yes/No questions to deduce which character your opponent secretly picked!',
    bgColor: '#4F46E5',
    traitCategories: TRAIT_CATEGORIES,
    items: CHARACTERS_LIST,
  }
};
