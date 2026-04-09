# Cross-Tab Synchronization Flow

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BROWSER TAB 1 (Instructor)                        │
│                                                                             │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐    │
│  │ SettingsPage.tsx │────▶│ localStorage.set │────▶│ broadcastSync()  │    │
│  │                  │     │('preview-mode',  │     │                  │    │
│  │ Toggle Switch    │     │ 'true')          │     │ Sets sync channel│    │
│  └──────────────────┘     └──────────────────┘     └────────┬─────────┘    │
│                                                             │               │
└─────────────────────────────────────────────────────────────┼───────────────┘
                                                              │
                                                              │ StorageEvent
                                                              │ (Broadcast)
                                                              │
┌─────────────────────────────────────────────────────────────┼───────────────┐
│                           BROWSER TAB 2 (Learning Interface)│               │
│                                                             ▼               │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐    │
│  │ LearningInterface│◀────│ StorageEvent     │◀────│ subscribeToSync()│    │
│  │    .tsx          │     │ Listener         │     │                  │    │
│  │                  │     │ (storage event)  │     │ Handler invoked  │    │
│  │ Updates UI state │     └──────────────────┘     └──────────────────┘    │
│  └──────────────────┘                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Sequence Diagram

```
Tab 1 (Settings)                    Browser                    Tab 2 (Learning)
     │                                 │                              │
     │ Click: Enable Preview           │                              │
     │────────────────────────────────▶│                              │
     │                                 │                              │
     │ localStorage.setItem()          │                              │
     │────────────────────────────────▶│                              │
     │                                 │                              │
     │ broadcastSync()                 │                              │
     │────────────────────────────────▶│                              │
     │                                 │                              │
     │ 1. localStorage.setItem(SYNC_CHANNEL, event)                  │
     │────────────────────────────────▶│                              │
     │                                 │                              │
     │ 2. localStorage.removeItem(SYNC_CHANNEL)                      │
     │────────────────────────────────▶│                              │
     │                                 │                              │
     │                                 │ StorageEvent fired           │
     │                                 │─────────────────────────────▶│
     │                                 │                              │
     │                                 │                              │ subscribeToSync callback
     │                                 │                              │────────────────▶
     │                                 │                              │
     │                                 │                              │ setIsPreviewMode(true)
     │                                 │                              │────────────────▶
     │                                 │                              │
     │                                 │                              │ UI updates
     │                                 │                              │◀───────────────
     │                                 │                              │
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     SYNC EVENT STRUCTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  {                                                              │
│    "key": "sql-adapt-preview-mode",    // The storage key      │
│    "value": "true",                     // The new value        │
│    "timestamp": 1709445600000           // Event timestamp      │
│  }                                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    SYNC CHANNEL MECHANISM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: broadcastSync() is called                              │
│          ↓                                                      │
│  Step 2: localStorage.setItem('sql-adapt-sync', '{...}')        │
│          ↓                                                      │
│  Step 3: StorageEvent fires in ALL tabs (except sender)         │
│          ↓                                                      │
│  Step 4: localStorage.removeItem('sql-adapt-sync')              │
│          ↓                                                      │
│  Step 5: Other tabs receive event via subscribeToSync()         │
│          ↓                                                      │
│  Step 6: Tabs update their local state                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## State Synchronization

```
┌─────────────────────────────────────────────────────────────────┐
│                    STATE MANAGEMENT                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tab 1 (Source)                    Tab 2 (Target)              │
│  ──────────────                    ──────────────              │
│                                                                 │
│  1. User toggles switch            1. Receives StorageEvent     │
│                                                                 │
│  2. setIsPreviewMode(true)         2. Callback invoked          │
│     ↓                                   ↓                       │
│  3. localStorage.setItem()         3. Validates event           │
│     ↓                                   ↓                       │
│  4. broadcastSync()                4. Check: is key relevant?   │
│     ↓                                   ↓                       │
│  5. UI updates immediately         5. Check: age < 5s?          │
│     ↓                                   ↓                       │
│  6. Event broadcasted              6. setIsPreviewMode(true)    │
│     ↓                                   ↓                       │
│  7. Other tabs receive             7. UI updates automatically │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key Implementation Details

### 1. Why "Set Then Remove"?

```javascript
// This technique triggers StorageEvent WITHOUT persisting data
localStorage.setItem(SYNC_CHANNEL, JSON.stringify(event));
localStorage.removeItem(SYNC_CHANNEL);

// Result:
// - Event is broadcast to all tabs
// - No persistent data left in localStorage
// - Clean and memory-efficient
```

### 2. Flood Protection

```javascript
// Events older than 5 seconds are ignored
const age = Date.now() - (event.timestamp || 0);
if (age > 5000) {
  return; // Ignore stale events
}
```

### 3. Event Validation

```javascript
// Only process valid events
if (typeof event.key !== 'string') {
  console.warn('[Sync] Invalid sync event: missing key');
  return;
}
```

### 4. Cleanup Pattern

```javascript
// Always return cleanup function for React
useEffect(() => {
  const unsubscribe = subscribeToSync((key, value) => {
    // Handle sync
  });
  return unsubscribe; // Cleanup on unmount
}, []);
```

## Component Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPONENT USAGE MAP                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SettingsPage.tsx                                               │
│  ├─ Import: broadcastSync                                       │
│  ├─ State: isPreviewMode                                        │
│  ├─ Handler: handlePreviewModeChange()                          │
│  │  ├─ Updates local state                                      │
│  │  ├─ Updates localStorage                                     │
│  │  └─ Calls broadcastSync()                                    │
│  └─ UI: Switch component with onCheckedChange                   │
│                                                                 │
│  LearningInterface.tsx                                          │
│  ├─ Import: subscribeToSync                                     │
│  ├─ State: isPreviewMode                                        │
│  ├─ Effect: useEffect with subscribeToSync                      │
│  │  ├─ Listens for 'sql-adapt-preview-mode' key                 │
│  │  ├─ Updates state when received                              │
│  │  └─ Returns unsubscribe for cleanup                          │
│  └─ UI: Preview mode banner (conditional)                       │
│                                                                 │
│  InstructorDashboard.tsx                                        │
│  ├─ Import: broadcastSync                                       │
│  └─ Handler: Start Preview button                               │
│     ├─ Sets localStorage                                        │
│     └─ Calls broadcastSync()                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Testing Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    TEST COVERAGE                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  E2E Tests (apps/web/tests/cross-tab-sync.spec.ts)              │
│  ├─ Enable in tab 1 → Verify in tab 2                           │
│  ├─ Disable in tab 2 → Verify in tab 1                          │
│  ├─ Close/reopen tab → State persists                           │
│  ├─ Rapid toggles → No infinite loops                           │
│  ├─ Other storage keys → Not affected                           │
│  ├─ Student role → No preview controls                          │
│  └─ Dashboard start → Broadcasts to all                         │
│                                                                 │
│  Manual Test (cross-tab-sync-demo.html)                         │
│  └─ Open in 2+ tabs, toggle to see sync                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
