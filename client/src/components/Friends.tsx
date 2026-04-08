import { useState, useEffect, useRef, useCallback } from 'react';
import { socket } from '../socket';
import type { FriendRecord, FriendRequest, ChatMessage } from '../../../shared/types';
import { loadDecks, type DeckList } from '../utils/deckStorage';
import { DECK_SIZE } from '../../../shared/deckRules';
import type { HeroClass } from '../../../shared/types';

interface FriendsProps {
  uid: string;
  onBack: () => void;
  incomingChallenge?: { challengeId: string; fromUid: string; fromName: string } | null;
  onChallengeHandled?: () => void;
}

type Tab = 'friends' | 'requests' | 'search';

interface FriendsListData {
  friends: FriendRecord[];
  requests: FriendRequest[];
  onlineUids: string[];
}

export function Friends({ uid, onBack, incomingChallenge, onChallengeHandled }: FriendsProps) {
  const [tab, setTab] = useState<Tab>('friends');
  const [data, setData] = useState<FriendsListData>({ friends: [], requests: [], onlineUids: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ uid: string; displayName: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [chatWith, setChatWith] = useState<FriendRecord | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [challengeDeck, setChallengeDeck] = useState<{ heroClass: HeroClass; cards: string[] } | null>(null);
  const [challengeDecks, setChallengeDecks] = useState<DeckList[]>([]);
  const [challengeTarget, setChallengeTarget] = useState<string | null>(null);
  const [pendingChallenge, setPendingChallenge] = useState<{ challengeId: string; fromUid: string; fromName: string } | null>(null);
  const [sentChallenge, setSentChallenge] = useState<string | null>(null);
  const [inGameFriends, setInGameFriends] = useState<Set<string>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadFriends = useCallback(() => {
    socket.emit('get-friends');
  }, []);

  useEffect(() => {
    loadFriends();

    const onFriendsList = (d: FriendsListData) => setData(d);
    const onFriendsUpdated = () => loadFriends();
    const onSearchResults = (results: { uid: string; displayName: string }[]) => {
      setSearchResults(results);
      setSearching(false);
    };
    const onFriendRequestReceived = () => loadFriends();
    const onFriendRequestSent = () => {
      setSearchQuery('');
      setSearchResults([]);
    };
    const onChatHistory = (d: { friendUid: string; messages: ChatMessage[] }) => {
      setChatMessages(d.messages);
    };
    const onNewChatMessage = (d: { friendUid: string; message: ChatMessage }) => {
      if (chatWith && d.friendUid === chatWith.uid) {
        setChatMessages(prev => [...prev, d.message]);
      }
    };
    const onDuelChallenge = (d: { challengeId: string; fromUid: string; fromName: string }) => {
      setPendingChallenge(d);
    };
    const onChallengeExpired = () => {
      setPendingChallenge(null);
      setSentChallenge(null);
    };
    const onChallengeDeclined = () => {
      setSentChallenge(null);
    };
    const onFriendsInGame = (data: { uids: string[] }) => setInGameFriends(new Set(data.uids));

    socket.on('friends-list', onFriendsList);
    socket.on('friends-in-game', onFriendsInGame);
    socket.on('friends-updated', onFriendsUpdated);
    socket.on('search-results', onSearchResults);
    socket.on('friend-request-received', onFriendRequestReceived);
    socket.on('friend-request-sent', onFriendRequestSent);
    socket.on('friend-request-accepted', onFriendsUpdated);
    socket.on('friend-request-rejected', onFriendsUpdated);
    socket.on('chat-history', onChatHistory);
    socket.on('new-chat-message', onNewChatMessage);
    socket.on('duel-challenge', onDuelChallenge);
    socket.on('challenge-expired', onChallengeExpired);
    socket.on('challenge-declined', onChallengeDeclined);
    socket.on('challenge-accepted', () => {/* game-state will handle view switch */});

    return () => {
      socket.off('friends-list', onFriendsList);
      socket.off('friends-updated', onFriendsUpdated);
      socket.off('search-results', onSearchResults);
      socket.off('friend-request-received', onFriendRequestReceived);
      socket.off('friend-request-sent', onFriendRequestSent);
      socket.off('friend-request-accepted', onFriendsUpdated);
      socket.off('friend-request-rejected', onFriendsUpdated);
      socket.off('chat-history', onChatHistory);
      socket.off('new-chat-message', onNewChatMessage);
      socket.off('duel-challenge', onDuelChallenge);
      socket.off('challenge-expired', onChallengeExpired);
      socket.off('challenge-declined', onChallengeDeclined);
      socket.off('friends-in-game', onFriendsInGame);
      socket.off('challenge-accepted');
    };
  }, [loadFriends, chatWith]);

  // Pick up incoming challenge passed from App (when redirected from lobby)
  useEffect(() => {
    if (incomingChallenge) {
      setPendingChallenge(incomingChallenge);
      onChallengeHandled?.();
    }
  }, [incomingChallenge, onChallengeHandled]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    socket.emit('search-users', { query: searchQuery.trim() });
  };

  const handleSendRequest = (targetUid: string) => {
    socket.emit('send-friend-request', { targetUid });
  };

  const handleAccept = (requestId: string) => {
    socket.emit('accept-friend-request', { requestId });
  };

  const handleReject = (requestId: string) => {
    socket.emit('reject-friend-request', { requestId });
  };

  const handleRemoveFriend = (friendUid: string) => {
    socket.emit('remove-friend', { friendUid });
  };

  const handleOpenChat = (friend: FriendRecord) => {
    setChatWith(friend);
    setChatMessages([]);
    socket.emit('get-chat-history', { friendUid: friend.uid });
  };

  const handleSendChat = () => {
    if (!chatInput.trim() || !chatWith) return;
    socket.emit('send-chat-message', { friendUid: chatWith.uid, text: chatInput.trim() });
    setChatInput('');
  };

  const handleChallenge = (friendUid: string) => {
    setChallengeTarget(friendUid);
    loadDecks(uid).then(d => setChallengeDecks(d.filter(dk => dk.cards.length === DECK_SIZE)));
  };

  const handleSelectChallengeDeck = (deck: DeckList) => {
    setChallengeDeck({ heroClass: deck.heroClass, cards: deck.cards });
  };

  const handleConfirmChallenge = () => {
    if (!challengeTarget || !challengeDeck) return;
    socket.emit('challenge-friend', { friendUid: challengeTarget, heroClass: challengeDeck.heroClass, deckCards: challengeDeck.cards });
    setSentChallenge(challengeTarget);
    setChallengeTarget(null);
  };

  const handleRespondChallenge = (accept: boolean) => {
    if (!pendingChallenge) return;
    if (accept && !challengeDeck) {
      setChallengeTarget('responding');
      loadDecks(uid).then(d => setChallengeDecks(d.filter(dk => dk.cards.length === DECK_SIZE)));
      return;
    }
    socket.emit('respond-challenge', {
      challengeId: pendingChallenge.challengeId,
      accept,
      heroClass: accept ? challengeDeck?.heroClass : undefined,
      deckCards: accept ? challengeDeck?.cards : undefined,
    });
    if (!accept) setPendingChallenge(null);
  };

  const handleConfirmResponseChallenge = () => {
    if (!pendingChallenge || !challengeDeck) return;
    socket.emit('respond-challenge', {
      challengeId: pendingChallenge.challengeId,
      accept: true,
      heroClass: challengeDeck.heroClass,
      deckCards: challengeDeck.cards,
    });
    setPendingChallenge(null);
    setChallengeTarget(null);
  };

  // Chat view
  if (chatWith) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-slate-800 rounded-2xl shadow-xl max-w-md w-full border border-slate-700 flex flex-col" style={{ height: '80vh' }}>
          <div className="p-4 border-b border-slate-700 flex items-center gap-3">
            <button onClick={() => setChatWith(null)} className="text-gray-400 hover:text-white cursor-pointer text-lg">&larr;</button>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${data.onlineUids.includes(chatWith.uid) ? 'bg-spero-green' : 'bg-gray-600'}`} />
              <h2 className="text-white font-bold">{chatWith.displayName}</h2>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {chatMessages.length === 0 && (
              <p className="text-gray-600 text-sm text-center mt-8">No messages yet. Say hello!</p>
            )}
            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.fromUid === uid ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
                  msg.fromUid === uid
                    ? 'bg-spero-blue text-white rounded-br-sm'
                    : 'bg-slate-700 text-gray-200 rounded-bl-sm'
                }`}>
                  {msg.text}
                  <div className="text-[10px] opacity-50 mt-0.5">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 border-t border-slate-700 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendChat()}
              placeholder="Type a message..."
              maxLength={500}
              className="flex-1 bg-slate-700 border border-gray-600 rounded-xl py-2 px-3 text-sm text-white placeholder-gray-500 focus:border-spero-yellow focus:outline-none"
            />
            <button
              onClick={handleSendChat}
              disabled={!chatInput.trim()}
              className="bg-spero-blue text-white font-bold py-2 px-4 rounded-xl text-sm hover:brightness-110 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Duel challenge incoming overlay
  if (pendingChallenge && challengeTarget !== 'responding') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-slate-800 rounded-2xl p-8 shadow-xl max-w-md w-full text-center border border-slate-700">
          <h2 className="text-2xl font-bold text-spero-yellow mb-4">Duel Challenge!</h2>
          <p className="text-white mb-6"><span className="font-bold">{pendingChallenge.fromName}</span> wants to duel you!</p>
          <div className="space-y-3">
            <button
              onClick={() => handleRespondChallenge(true)}
              className="w-full bg-spero-green text-white font-bold py-3 px-6 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              Accept
            </button>
            <button
              onClick={() => handleRespondChallenge(false)}
              className="w-full bg-slate-700 text-gray-300 font-bold py-3 px-6 rounded-xl text-lg hover:bg-slate-700/80 active:scale-95 transition-all cursor-pointer"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Deck selection for challenge (sending or responding)
  if (challengeTarget) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-slate-800 rounded-2xl p-8 shadow-xl max-w-md w-full text-center border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-4">Select Your Deck</h2>
          <p className="text-gray-400 text-sm mb-4">Choose a deck for the duel</p>
          <div className="mb-4 space-y-2">
            {challengeDecks.map(d => (
              <button
                key={d.id}
                onClick={() => handleSelectChallengeDeck(d)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm cursor-pointer transition-all ${
                  challengeDeck?.cards === d.cards
                    ? 'bg-spero-green/20 border border-spero-green text-white font-bold'
                    : 'bg-slate-700 text-gray-400 hover:bg-slate-700/80'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="truncate">{d.isStarterDeck && <span className="text-spero-yellow text-xs mr-1">&#9733;</span>}{d.name}</span>
                  <span className="text-[10px] text-gray-500">{d.cards.length}/{DECK_SIZE}</span>
                </div>
              </button>
            ))}
            {challengeDecks.length === 0 && <p className="text-[10px] text-gray-600">No valid decks. Build one in Collection!</p>}
          </div>
          <div className="space-y-3">
            <button
              onClick={challengeTarget === 'responding' ? handleConfirmResponseChallenge : handleConfirmChallenge}
              disabled={!challengeDeck}
              className="w-full bg-spero-green text-white font-bold py-3 px-6 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {challengeTarget === 'responding' ? 'Accept & Play' : 'Send Challenge'}
            </button>
            <button
              onClick={() => { setChallengeTarget(null); if (challengeTarget === 'responding') setPendingChallenge(null); }}
              className="text-gray-400 underline cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Waiting for challenge response
  if (sentChallenge) {
    const friendName = data.friends.find(f => f.uid === sentChallenge)?.displayName || 'friend';
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-slate-800 rounded-2xl p-8 shadow-xl max-w-md w-full text-center border border-slate-700">
          <div className="w-12 h-12 border-4 border-spero-yellow border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white font-bold text-lg mb-2">Waiting for {friendName}...</p>
          <p className="text-gray-400 text-sm mb-6">Challenge expires in 30 seconds</p>
          <button
            onClick={() => setSentChallenge(null)}
            className="bg-slate-700 text-gray-300 font-bold py-2 px-6 rounded-xl hover:bg-slate-700/80 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-slate-800 rounded-2xl p-6 shadow-xl max-w-md w-full border border-slate-700 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">Friends</h1>
          <button onClick={onBack} className="text-gray-400 hover:text-white cursor-pointer text-sm underline">Back</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4">
          {(['friends', 'requests', 'search'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold cursor-pointer transition-all ${
                tab === t
                  ? 'bg-spero-blue text-white'
                  : 'bg-slate-700 text-gray-400 hover:bg-slate-700/80'
              }`}
            >
              {t === 'friends' ? `Friends (${data.friends.length})` : t === 'requests' ? `Requests (${data.requests.length})` : 'Add'}
            </button>
          ))}
        </div>

        {/* Friends Tab */}
        {tab === 'friends' && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.friends.length === 0 && (
              <p className="text-gray-600 text-sm text-center py-8">No friends yet. Search and add some!</p>
            )}
            {data.friends.map(friend => {
              const isOnline = data.onlineUids.includes(friend.uid);
              return (
                <div key={friend.uid} className="bg-slate-700 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-spero-green' : 'bg-gray-600'}`} />
                    <span className="text-white font-medium text-sm">{friend.displayName}</span>
                    {isOnline && inGameFriends.has(friend.uid)
                      ? <span className="text-[10px] text-purple-400 font-bold">In Game</span>
                      : isOnline && <span className="text-[10px] text-spero-green">online</span>
                    }
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleOpenChat(friend)}
                      className="bg-spero-blue/20 text-spero-blue px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-spero-blue/30 cursor-pointer"
                    >
                      Chat
                    </button>
                    {isOnline && inGameFriends.has(friend.uid) && (
                      <button
                        onClick={() => {
                          socket.emit('spectate-friend', { friendUid: friend.uid });
                        }}
                        className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded hover:bg-purple-500 cursor-pointer"
                      >
                        Spectate
                      </button>
                    )}
                    {isOnline && (
                      <button
                        onClick={() => handleChallenge(friend.uid)}
                        className="bg-spero-yellow/20 text-spero-yellow px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-spero-yellow/30 cursor-pointer"
                      >
                        Duel
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveFriend(friend.uid)}
                      className="bg-red-500/20 text-red-400 px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-red-500/30 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Requests Tab */}
        {tab === 'requests' && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.requests.length === 0 && (
              <p className="text-gray-600 text-sm text-center py-8">No pending requests</p>
            )}
            {data.requests.map(req => (
              <div key={req.id} className="bg-slate-700 rounded-lg p-3 flex items-center justify-between">
                <span className="text-white font-medium text-sm">{req.fromName}</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleAccept(req.id)}
                    className="bg-spero-green/20 text-spero-green px-3 py-1 rounded-lg text-xs font-bold hover:bg-spero-green/30 cursor-pointer"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleReject(req.id)}
                    className="bg-red-500/20 text-red-400 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-500/30 cursor-pointer"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search Tab */}
        {tab === 'search' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search by username..."
                maxLength={30}
                className="flex-1 bg-slate-700 border border-gray-600 rounded-xl py-2 px-3 text-sm text-white placeholder-gray-500 focus:border-spero-yellow focus:outline-none"
              />
              <button
                onClick={handleSearch}
                disabled={!searchQuery.trim() || searching}
                className="bg-spero-blue text-white font-bold py-2 px-4 rounded-xl text-sm hover:brightness-110 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {searching ? '...' : 'Search'}
              </button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {searchResults.map(user => {
                const isFriend = data.friends.some(f => f.uid === user.uid);
                return (
                  <div key={user.uid} className="bg-slate-700 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-white font-medium text-sm">{user.displayName}</span>
                    {isFriend ? (
                      <span className="text-spero-green text-xs font-bold">Already friends</span>
                    ) : (
                      <button
                        onClick={() => handleSendRequest(user.uid)}
                        className="bg-spero-green/20 text-spero-green px-3 py-1 rounded-lg text-xs font-bold hover:bg-spero-green/30 cursor-pointer"
                      >
                        Add Friend
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
