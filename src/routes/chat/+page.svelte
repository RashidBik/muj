<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { user } from '$lib/stores/user'
  import Avatar from '$lib/components/ui/Avatar.svelte'
  import { supabase } from '$lib/client/supabase'
  import { getUserConversations, getUsersStatus, getOrCreateConversation } from '$lib/services/chat-service'
  import type { Conversation } from '$lib/services/chat-service'
  import { formatDistanceToNow } from 'date-fns'
  import { faIR } from 'date-fns/locale'

  // Icon imports
  import {
    ArrowLeft,
    MessageCircle,
    Search,
    Users,
    Clock,
    UserPlus,
    UserCheck,
    User as UserIcon
  } from 'lucide-svelte'

  // حالت‌ها
  let conversations = $state<Conversation[]>([])
  let followers = $state<any[]>([])
  let following = $state<any[]>([])
  let loading = $state(true)
  let currentUser = $state<any>(null)
  let searchQuery = $state('')
  let onlineUsers = $state<Record<string, boolean>>({})
  let activeTab = $state<'conversations' | 'followers' | 'following'>('conversations')
  let dataLoaded = $state(false)
  let subscription: any = null

  // اشتراک‌گذاری در store کاربر
  $effect(() => {
    const unsubscribe = user.subscribe(value => {
      console.log('👤 User changed:', value?.id)
      currentUser = value
      if (value && !dataLoaded) {
        loadAllData()
        dataLoaded = true
        setupRealtimeSubscription()
      }
    })
    return () => unsubscribe()
  })

  // ✅ Setup real-time subscription for new messages
  function setupRealtimeSubscription() {
    if (!currentUser) return

    // First, get all conversation IDs for this user
    supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', currentUser.id)
      .then(({ data }) => {
        if (!data || data.length === 0) return
        
        const conversationIds = data.map(c => c.conversation_id)
        
        // Subscribe to new messages in these conversations
        subscription = supabase
          .channel('chat-messages')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=in.(${conversationIds.join(',')})`
            },
            async (payload) => {
              // Get the full message with sender info
              const { data: messageData, error } = await supabase
                .from('messages')
                .select(`
                  *,
                  sender:users(
                    id,
                    name,
                    username,
                    avatar
                  )
                `)
                .eq('id', payload.new.id)
                .single()

              if (!error && messageData) {
                // Update the conversation list
                await updateConversationWithNewMessage(messageData)
                
                // Update unread count in header
                await updateUnreadCount()
                
                // Emit event for header to update
                window.dispatchEvent(new CustomEvent('new-message', { 
                  detail: { message: messageData }
                }))
              }
            }
          )
          .subscribe()
      })
  }

  // ✅ Update conversation with new message
  async function updateConversationWithNewMessage(message: any) {
    // Find if conversation exists in list
    const existingIndex = conversations.findIndex(c => c.id === message.conversation_id)
    
    if (existingIndex !== -1) {
      // Update existing conversation
      const conv = conversations[existingIndex]
      conv.last_message = message
      conv.updated_at = message.created_at
      
      // Increment unread count if message is not from current user
      if (message.sender_id !== currentUser?.id) {
        conv.unread_count = (conv.unread_count || 0) + 1
      }
      
      // Move to top of list
      const updatedConv = conversations.splice(existingIndex, 1)[0]
      conversations = [updatedConv, ...conversations]
    } else {
      // This is a new conversation, reload all data
      await loadAllData()
    }
  }

  // ✅ Update unread count and dispatch event
  async function updateUnreadCount() {
    if (!currentUser) return
    
    try {
      const convs = await getUserConversations(currentUser.id)
      const totalUnread = convs.reduce((acc, c) => acc + (c.unread_count || 0), 0)
      
      // Dispatch event for header
      window.dispatchEvent(new CustomEvent('chat-unread-count', { 
        detail: totalUnread 
      }))
    } catch (error) {
      console.error('Error updating unread count:', error)
    }
  }

  // ✅ بارگذاری ساده و مستقیم
  async function loadAllData() {
    if (!currentUser) {
      console.warn('⚠️ No current user')
      return
    }
    
    loading = true
    console.log('🔄 Loading data for user:', currentUser.id)

    try {
      // 1. دریافت فالوینگ‌ها
      console.log('📥 Getting following...')
      const { data: followData, error: followError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUser.id)

      if (followError) {
        console.error('❌ Follow error:', followError)
      } else {
        console.log('📊 Follow data:', followData)
        
        if (followData && followData.length > 0) {
          const followingIds = followData.map(f => f.following_id)
          console.log('📊 Following IDs:', followingIds)
          
          const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, name, username, avatar, bio')
            .in('id', followingIds)

          if (usersError) {
            console.error('❌ Users error:', usersError)
          } else {
            following = users || []
            console.log('✅ Following set to:', following)
          }
        } else {
          following = []
          console.log('ℹ️ No following found')
        }
      }

      // 2. دریافت فالوورها
      console.log('📥 Getting followers...')
      const { data: followerData, error: followerError } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', currentUser.id)

      if (followerError) {
        console.error('❌ Follower error:', followerError)
      } else if (followerData && followerData.length > 0) {
        const followerIds = followerData.map(f => f.follower_id)
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, name, username, avatar, bio')
          .in('id', followerIds)
        
        if (!usersError && users) {
          followers = users
          console.log('✅ Followers set to:', followers)
        } else {
          followers = []
        }
      } else {
        followers = []
        console.log('ℹ️ No followers found')
      }

      // 3. دریافت مکالمات
      console.log('📥 Getting conversations...')
      const convs = await getUserConversations(currentUser.id)
      conversations = convs
      console.log('✅ Conversations set to:', conversations.length)

      // Update unread count after loading
      await updateUnreadCount()

      const userIds = convs.flatMap(c => c.participants.map(p => p.id))
      if (userIds.length > 0) {
        onlineUsers = await getUsersStatus(userIds)
      }

    } catch (error) {
      console.error('❌ Error loading data:', error)
    } finally {
      loading = false
      console.log('✅ Loading complete')
      console.log('📊 Final following:', following)
      console.log('📊 Final followers:', followers)
    }
  }

  // Clean up subscription on destroy
  onDestroy(() => {
    if (subscription) {
      supabase.removeChannel(subscription)
    }
  })

  // شروع چت با کاربر
  async function startChatWithUser(userId: string) {
    if (!currentUser) return
    
    try {
      const conversationId = await getOrCreateConversation(currentUser.id, userId)
      goto(`/chat/${conversationId}`)
    } catch (error) {
      console.error('Error starting chat:', error)
      alert('خطا در شروع چت. لطفاً دوباره تلاش کنید.')
    }
  }

  function formatTime(date: string): string {
    try {
      return formatDistanceToNow(new Date(date), { 
        addSuffix: true,
        locale: faIR
      })
    } catch {
      return 'چندی پیش'
    }
  }

  function getOtherUser(conversation: Conversation): any {
    return conversation.participants.find(p => p.id !== currentUser?.id)
  }

  function goToChat(conversationId: string) {
    goto(`/chat/${conversationId}`)
  }

  function getMessagePreview(message: any): string {
    if (!message) return 'پیامی وجود ندارد'
    const content = message.content
    if (content.length > 40) {
      return content.substring(0, 40) + '...'
    }
    return content
  }

  function switchTab(tab: 'conversations' | 'followers' | 'following') {
    activeTab = tab
  }

  // ✅ CORRECT $derived syntax for Svelte 5
  // Filtered conversations based on search
  const filteredConversations = $derived(() => {
    const search = searchQuery.toLowerCase().trim()
    if (!search) return conversations
    
    return conversations.filter(conv => {
      const otherUser = getOtherUser(conv)
      if (!otherUser) return false
      return otherUser.name?.toLowerCase().includes(search) ||
             otherUser.username?.toLowerCase().includes(search)
    })
  })

  // Filtered followers based on search
  const filteredFollowers = $derived(() => {
    const search = searchQuery.toLowerCase().trim()
    if (!search) return followers
    
    return followers.filter(user => 
      user.name?.toLowerCase().includes(search) ||
      user.username?.toLowerCase().includes(search)
    )
  })

  // Filtered following based on search
  const filteredFollowing = $derived(() => {
    const search = searchQuery.toLowerCase().trim()
    if (!search) return following
    
    return following.filter(user => 
      user.name?.toLowerCase().includes(search) ||
      user.username?.toLowerCase().includes(search)
    )
  })

  // These console logs will now show the correct values
  $effect(() => {
    console.log('📊 Following count updated:', following.length)
    console.log('📊 Followers count updated:', followers.length)
  })
</script>

<div class="chat-list-page">
  <div class="chat-container">
    <!-- Header -->
    <div class="header">
      <button class="back-btn" onclick={() => history.back()}>
        <ArrowLeft size={20} />
      </button>
      <h1>
        <MessageCircle size={22} />
        پیام‌ها
      </h1>
      <button class="new-chat-btn" onclick={() => goto('/search')}>
        <UserPlus size={20} />
      </button>
    </div>

    <!-- Search -->
    <div class="search-box">
      <Search size={18} />
      <input
        type="text"
        placeholder="جستجو در مکالمات، فالوورها..."
        bind:value={searchQuery}
      />
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button 
        class="tab {activeTab === 'conversations' ? 'active' : ''}"
        onclick={() => switchTab('conversations')}
      >
        <MessageCircle size={16} />
        مکالمات
        <span class="tab-badge">{conversations.length}</span>
      </button>
      <button 
        class="tab {activeTab === 'followers' ? 'active' : ''}"
        onclick={() => switchTab('followers')}
      >
        <Users size={16} />
        فالوورها
        <span class="tab-badge">{followers.length}</span>
      </button>
      <button 
        class="tab {activeTab === 'following' ? 'active' : ''}"
        onclick={() => switchTab('following')}
      >
        <UserCheck size={16} />
        فالوینگ
        <span class="tab-badge">{following.length}</span>
      </button>
    </div>

    <!-- Content -->
    {#if activeTab === 'conversations'}
      <!-- مکالمات -->
      {#if loading}
        <div class="loading">⏳ در حال بارگذاری...</div>
      {:else if conversations.length === 0}
        <div class="empty">
          <MessageCircle size={48} />
          <h3>هیچ پیامی وجود ندارد</h3>
          <p>با دنبال‌کنندگان خود شروع به چت کنید</p>
          <button class="find-friends-btn" onclick={() => switchTab('followers')}>
            <Users size={18} />
            مشاهده فالوورها
          </button>
        </div>
      {:else if filteredConversations().length === 0}
        <div class="empty">
          <Search size={48} />
          <h3>نتیجه‌ای یافت نشد</h3>
          <p>مکالمه‌ای با "{searchQuery}" پیدا نشد</p>
        </div>
      {:else}
        <div class="conversations-list">
          {#each filteredConversations() as conv (conv.id)}
            {@const otherUser = getOtherUser(conv)}
            {#if otherUser}
              <div class="conversation-item" onclick={() => goToChat(conv.id)}>
                <div class="conv-avatar">
                  <Avatar src={otherUser.avatar} size="md" />
                  {#if onlineUsers[otherUser.id]}
                    <span class="online-dot"></span>
                  {/if}
                </div>
                <div class="conv-info">
                  <div class="conv-header">
                    <span class="conv-name">{otherUser.name}</span>
                    <span class="conv-time">
                      {#if conv.last_message}
                        {formatTime(conv.last_message.created_at)}
                      {/if}
                    </span>
                  </div>
                  <div class="conv-preview">
                    {#if conv.last_message}
                      <span class="preview-text">
                        {#if conv.last_message.sender_id === currentUser?.id}
                          <span class="you-label">شما: </span>
                        {/if}
                        {getMessagePreview(conv.last_message)}
                      </span>
                    {:else}
                      <span class="preview-text empty">شروع مکالمه</span>
                    {/if}
                    {#if conv.unread_count && conv.unread_count > 0}
                      <span class="unread-badge">{conv.unread_count}</span>
                    {/if}
                  </div>
                </div>
              </div>
            {/if}
          {/each}
        </div>
      {/if}

    {:else if activeTab === 'followers'}
      <!-- فالوورها -->
      {#if loading}
        <div class="loading">⏳ در حال بارگذاری...</div>
      {:else if followers.length === 0}
        <div class="empty">
          <Users size={48} />
          <h3>هیچ فالووری ندارید</h3>
          <p>با انتشار محتوای خوب، فالوور جذب کنید</p>
        </div>
      {:else if filteredFollowers().length === 0}
        <div class="empty">
          <Search size={48} />
          <h3>نتیجه‌ای یافت نشد</h3>
          <p>فالووری با "{searchQuery}" پیدا نشد</p>
        </div>
      {:else}
        <div class="user-list">
          {#each filteredFollowers() as user (user.id)}
            <div class="user-item">
              <div class="user-info" onclick={() => goto(`/profile/${user.username}`)}>
                <Avatar src={user.avatar} size="md" />
                <div>
                  <div class="user-name">{user.name}</div>
                  <div class="user-username">@{user.username}</div>
                </div>
              </div>
              <button 
                class="chat-user-btn"
                onclick={() => startChatWithUser(user.id)}
                title="شروع چت"
              >
                <MessageCircle size={18} />
              </button>
            </div>
          {/each}
        </div>
      {/if}

    {:else if activeTab === 'following'}
      <!-- فالووینگ‌ها -->
      {#if loading}
        <div class="loading">⏳ در حال بارگذاری...</div>
      {:else if following.length === 0}
        <div class="empty">
          <UserCheck size={48} />
          <h3>هیچ کسی را دنبال نمی‌کنید</h3>
          <p>برای دیدن محتوای بیشتر، دیگران را دنبال کنید</p>
          <button class="find-friends-btn" onclick={() => goto('/search')}>
            <Search size={18} />
            پیدا کردن کاربران
          </button>
        </div>
      {:else if filteredFollowing().length === 0}
        <div class="empty">
          <Search size={48} />
          <h3>نتیجه‌ای یافت نشد</h3>
          <p>کاربری با "{searchQuery}" پیدا نشد</p>
        </div>
      {:else}
        <div class="user-list">
          {#each filteredFollowing() as user (user.id)}
            <div class="user-item">
              <div class="user-info" onclick={() => goto(`/profile/${user.username}`)}>
                <Avatar src={user.avatar} size="md" />
                <div>
                  <div class="user-name">{user.name}</div>
                  <div class="user-username">@{user.username}</div>
                </div>
              </div>
              <button 
                class="chat-user-btn"
                onclick={() => startChatWithUser(user.id)}
                title="شروع چت"
              >
                <MessageCircle size={18} />
              </button>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<!-- All your existing styles remain exactly the same -->
<style>
  /* All your existing styles remain unchanged */
  .chat-list-page {
    min-height: 100vh;
    background: #f0f2f5;
    padding: 16px;
  }

  .chat-container {
    max-width: 600px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    background: white;
    padding: 14px 18px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .header h1 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 700;
    margin: 0;
    flex: 1;
    color: #1a1a2e;
  }

  .header h1 :global(svg) {
    color: #6366f1;
  }

  .back-btn {
    background: none;
    border: none;
    color: #6366f1;
    cursor: pointer;
    padding: 4px;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .back-btn:hover {
    background: #f0f0ff;
  }

  .new-chat-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #6366f1;
    border: none;
    color: white;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .new-chat-btn:hover {
    background: #4f46e5;
    transform: scale(1.05);
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 10px;
    background: white;
    padding: 10px 16px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .search-box :global(svg) {
    color: #94a3b8;
    flex-shrink: 0;
  }

  .search-box input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 15px;
    font-family: inherit;
    background: transparent;
    color: #1a1a2e;
  }

  .search-box input::placeholder {
    color: #94a3b8;
  }

  .tabs {
    display: flex;
    gap: 4px;
    background: white;
    padding: 4px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    padding: 10px 12px;
    border: none;
    border-radius: 8px;
    background: transparent;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
    color: #64748b;
    justify-content: center;
  }

  .tab:hover {
    background: #f1f5f9;
  }

  .tab.active {
    background: #6366f1;
    color: white;
  }

  .tab :global(svg) {
    color: #94a3b8;
    transition: color 0.2s ease;
  }

  .tab.active :global(svg) {
    color: white;
  }

  .tab-badge {
    font-size: 11px;
    background: #e2e8f0;
    padding: 0 8px;
    border-radius: 12px;
    color: #64748b;
    font-weight: 600;
  }

  .tab.active .tab-badge {
    background: rgba(255,255,255,0.2);
    color: white;
  }

  .loading {
    text-align: center;
    padding: 40px;
    color: #94a3b8;
  }

  .empty {
    text-align: center;
    padding: 60px 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .empty :global(svg) {
    color: #cbd5e1;
    margin-bottom: 16px;
  }

  .empty h3 {
    margin: 0 0 8px 0;
    color: #1a1a2e;
  }

  .empty p {
    color: #94a3b8;
    margin: 0 0 16px 0;
  }

  .find-friends-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    border: none;
    border-radius: 10px;
    background: #6366f1;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .find-friends-btn:hover {
    background: #4f46e5;
    transform: translateY(-2px);
  }

  .conversations-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .conversation-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
    cursor: pointer;
    transition: all 0.2s ease;
    border-bottom: 1px solid #f1f5f9;
  }

  .conversation-item:last-child {
    border-bottom: none;
  }

  .conversation-item:hover {
    background: #f8fafc;
  }

  .conv-avatar {
    position: relative;
    flex-shrink: 0;
  }

  .online-dot {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #10b981;
    border: 2px solid white;
  }

  .conv-info {
    flex: 1;
    min-width: 0;
  }

  .conv-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .conv-name {
    font-weight: 600;
    color: #1a1a2e;
    font-size: 15px;
  }

  .conv-time {
    font-size: 11px;
    color: #94a3b8;
    flex-shrink: 0;
  }

  .conv-preview {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .preview-text {
    flex: 1;
    font-size: 13px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .preview-text.empty {
    color: #94a3b8;
  }

  .you-label {
    color: #6366f1;
    font-weight: 500;
  }

  .unread-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 50%;
    background: #6366f1;
    color: white;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .user-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .user-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
    border-bottom: 1px solid #f1f5f9;
    transition: all 0.2s ease;
  }

  .user-item:last-child {
    border-bottom: none;
  }

  .user-item:hover {
    background: #f8fafc;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    flex: 1;
    min-width: 0;
  }

  .user-name {
    font-weight: 600;
    color: #1a1a2e;
    font-size: 14px;
  }

  .user-username {
    font-size: 13px;
    color: #94a3b8;
  }

  .chat-user-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #6366f1;
    border: none;
    color: white;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .chat-user-btn:hover {
    background: #4f46e5;
    transform: scale(1.05);
  }

  @media (max-width: 640px) {
    .chat-list-page {
      padding: 12px;
    }

    .header {
      padding: 12px 14px;
    }

    .conversation-item {
      padding: 12px 14px;
    }

    .user-item {
      padding: 10px 14px;
    }

    .tab {
      font-size: 12px;
      padding: 8px 10px;
    }

    .tab-badge {
      font-size: 10px;
      padding: 0 6px;
    }
  }
</style>