const CHARACTERS_LIST = [
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
];

const CATEGORIES = {
  characters: {
    id: 'characters',
    name: 'Guess Who?',
    icon: '🕵️‍♂️',
    description: 'Deduce the secret suspect by asking clever Yes/No questions!',
    items: CHARACTERS_LIST
  }
};

module.exports = CATEGORIES;
