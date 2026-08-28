# BD Dashboard - Developer Guide

Welcome! This guide will help you find your way around the BD Dashboard codebase, understand the architecture, and get productive quickly.

---

## 🚀 Quick Start

### First Time Setup

```bash
# Clone and install
git clone <repo>
cd c:/Users/Robert/.config/Desktop/BD

# Backend
cd Server
npm install
# Create .env (copy from .env.example)
npm start

# Frontend (in separate terminal)
cd workspace
npm install
npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:5001
- Test Frontend: http://localhost:5175 (when running test server)
- Test API: http://localhost:5002

### One-Command Build & Deploy
```bash
npm run build  # Builds both frontend and backend, embeds in Server/dist
```

---

## 📁 Project Structure at a Glance

```
BD-Dashboard/
├── Server/                          # Backend (Express + Mongoose)
│   ├── server.js                    # Entry point (237 lines, core app setup)
│   ├── config/db.js                 # MongoDB connection pooling
│   ├── models/                      # 24 Mongoose schemas
│   ├── routes/                      # 27 API route files
│   ├── services/                    # 17 business logic services
│   ├── middleware/                  # Upload handling
│   ├── scripts/                     # Database migrations
│   └── dist/                        # Built SPA (symlinked from workspace/dist)
│
├── workspace/                       # Frontend (React 19 + Vite)
│   ├── src/
│   │   ├── App.jsx                  # Root component
│   │   ├── main.jsx                 # React mount
│   │   ├── components/              # Shared UI components
│   │   │   ├── layouts/             # AppLayout, Header, Sidebar, ModuleRouter
│   │   │   ├── common/              # Button, Modal, Card, Badge, etc.
│   │   │   └── widgets/             # ProgressWidget, MatrixWidget
│   │   ├── context/                 # Global state (DashboardContext)
│   │   │   ├── hooks/               # useDashboard, useFetch, useLocalStorage
│   │   │   └── services/            # api.js (1,878 lines - ALL API methods)
│   │   ├── modules/                 # 13 feature modules
│   │   │   ├── pipeline/            # Sales pipeline, prospecting, cold calls
│   │   │   ├── tenders/             # RFQ, tender tracking
│   │   │   ├── events/              # Events, birthdays, milestones, DG event
│   │   │   ├── client-relationships/# Client management, health scoring
│   │   │   ├── proposals/           # Bid tracking, win/loss
│   │   │   ├── partnerships/        # Partner directory
│   │   │   ├── tasks/               # Task & project management
│   │   │   ├── social-media/        # Campaigns, content, outreach
│   │   │   ├── field-visit/         # Visit tracking, discovery forms
│   │   │   ├── trainings/           # Training programs, certs, roadmap
│   │   │   ├── reports/             # Document repository, memos
│   │   │   ├── tools/               # Shared tool launcher
│   │   │   ├── blogs/               # Content/blog management
│   │   │   └── reports/             # Analytics & reporting
│   │   ├── lib/                     # Utilities (sheetImport.js for Excel)
│   │   └── assets/                  # Colors, styles, static files
│   ├── package.json
│   ├── vite.config.js               # Build config (proxies /api to backend)
│   └── eslint.config.js
│
├── .env.example                     # Environment template (copy to .env)
├── package.json                     # Root workspace
├── render.yaml                      # Render deployment config
├── vercel.json                      # Vercel alternative config
├── TESTING.md                       # Test infrastructure docs
└── scratchpad/                      # Test suites (Python)
    ├── api_*.py                     # 11 API regression test suites
    ├── smoke_*.py                   # 11 browser automation tests
    ├── audit_*.py                   # Console/layout audits
    └── reset_db.py                  # Test database reset
```

---

## 🗺️ Finding Things in the Codebase

### I want to modify a feature/page

**Step 1: Find the module**
- All 13 modules are in `workspace/src/modules/`
- Module names match the sidebar labels:
  - Pipeline Tracker → `modules/pipeline/`
  - Tenders & EOI → `modules/tenders/`
  - Client Relations → `modules/client-relationships/`
  - etc.

**Step 2: Understand the module structure**
- `*Module.jsx` - Main container (state, tabs, layout)
- `*FormModal.jsx` - Create/edit dialogs
- `*DetailModal.jsx` - View details dialogs
- `*Tab.jsx` - Tab views
- `components/` - Module-specific UI components

**Example:** Modifying client health scoring
```
workspace/src/modules/client-relationships/
├── ClientRelationsModule.jsx          # Main module
├── ClientFormModal.jsx                # Add/edit client
├── ClientRecordView.jsx               # Full client detail
├── ClientAppreciation.jsx             # Anniversary cards
└── LogInteractionModal.jsx            # Quick interaction logging
```

### I want to understand a data model

**Step 1: Find the model**
- All 24 MongoDB schemas in `Server/models/`
- Look for `YourModel.js`

**Step 2: Understand the structure**
- Fields defined in schema
- Virtuals (computed fields) use `.virtual()`
- Embedded schemas nested in main schema
- Indexes for performance/uniqueness

**Example:** Client model
```javascript
Server/models/Client.js
├── Schema fields (name, tier, status, etc.)
├── Virtuals (attentionReasons, healthStatus, etc.)
├── Methods and pre/post hooks
└── Exports mongoose model
```

### I want to add/modify an API endpoint

**Step 1: Find the route file**
- API routes in `Server/routes/`
- Named `*Routes.js` matching the feature
- Example: `Server/routes/clientRoutes.js`

**Step 2: Understand the pattern**
```javascript
// Routes delegate to services
router.get('/', (req, res) => {
  Service.getAll(req.query)
    .then(data => res.json(data))
    .catch(err => res.status(400).json({ message: err.message }));
});
```

**Step 3: Add service logic**
- Business logic lives in `Server/services/`
- Routes are thin HTTP adapters
- Services handle validation, calculations, etc.

### I want to call an API from the frontend

**Everything is in `workspace/src/context/services/api.js`** (1,878 lines)

```javascript
// Examples of what's available:
bdApi.getClients(filters)
bdApi.addClient(data)
bdApi.updateClient(id, data)
bdApi.deleteClient(id)
bdApi.getPipeline()
bdApi.addTender(data)
bdApi.getReminders()
// ... 100+ methods total

// All return promises:
bdApi.getClients().then(data => {
  setClients(data);
}).catch(err => {
  console.error(err.message);
});
```

**No need to write API calls** — if it's a feature that exists, there's already an API method.

### I want to add a new field to a form

**Step 1: Find the form component**
- Usually `*FormModal.jsx` in the module
- Contains input fields, validation, submit handler

**Step 2: Add input field**
```javascript
<input
  type="text"
  value={formData.fieldName}
  onChange={(e) => setFormData({...formData, fieldName: e.target.value})}
/>
```

**Step 3: Update model to accept the field**
- Add field to MongoDB schema in `Server/models/YourModel.js`
- Example: `newField: { type: String, default: '' }`

**Step 4: No need to create API** — it already handles all model fields

---

## 🏗️ Architecture Patterns to Know

### Pattern 1: React Module Structure
Every module follows this pattern:

```
Module/
├── ModuleModule.jsx         # Main container (state, tabs, rendering)
├── components/
│   ├── Tab1.jsx             # Tab content
│   ├── Tab2.jsx
│   ├── FormModal.jsx        # Create/edit
│   ├── DetailModal.jsx      # View details
│   └── utils.js             # Helper functions
└── modularConstants.js      # Enums, defaults (optional)
```

**State management:**
- `useState` for local state
- `useEffect` for loading data and side effects
- `useDashboard()` for global state (currentUser, serverConnected, etc.)
- No Redux — Context API is enough for this scale

### Pattern 2: Service Layer (Backend)
Always use this flow:

```
Frontend (api.js call)
    ↓
Route (HTTP adapter)
    ↓
Service (business logic)
    ↓
Mongoose Model (database)
```

**Never put logic in routes** — routes are just HTTP → service → response

### Pattern 3: Computed Virtuals (Not Stored)
```javascript
// In Mongoose schema:
clientSchema.virtual('healthStatus').get(function() {
  // Computed on every read, never stored
  // Ensures always reflects current state
  return this.attentionReasons[0]?.severity || 'Healthy';
});

// Automatically included in JSON output:
const json = client.toJSON();  // healthStatus included
```

**Benefit:** Derived data always current, no stale denormalizations

### Pattern 4: Archive-Before-Delete
```javascript
// Every major model has:
archived: { type: Boolean, default: false }
archivedAt: { type: Date }

// Routes:
PATCH /:id/archive  { archived: true/false }   // Toggle archive
DELETE /:id         // Only works if archived === true
```

**Why:** Preserves data for auditing, enables undo

### Pattern 5: API Wrapper (api.js)
```javascript
// Every data operation goes through bdApi:
bdApi.getClients()
bdApi.addClient(data)
bdApi.updateClient(id, data)
bdApi.deleteClient(id)
bdApi.logInteraction(clientId, data)

// One place to modify:
// - Base URL
// - Headers
// - Error handling
// - Authentication (when added)
```

---

## 📊 Understanding Key Features

### Client Relations (Most Complex Feature)

**What it does:** Relationship management with health scoring

**Key files:**
- `workspace/src/modules/client-relationships/` - Frontend
- `Server/models/Client.js` - 11 computed virtuals for health
- `Server/services/clientService.js` - CRUD operations

**How it works:**
1. Client has contacts, commitments, surveys (embedded)
2. System computes 11 virtuals (expectedCadenceDays, daysSinceLastContact, healthStatus, etc.)
3. attentionReasons virtual returns array of explicit reasons for action
4. Frontend displays work queue sorted by severity
5. User clicks client → see full detail with interactions, commitments, surveys

**The health scoring (most complex part):**
```javascript
// Client.js attentionReasons virtual
// Returns array of {code, label, severity, detail}
// Reasons include:
- Never contacted
- Gone quiet (past cadence)
- Commitment overdue
- Renewal approaching
- Renewal lapsed
- Low satisfaction

// healthStatus = worst-first severity:
// Critical > At Risk > Watch > Healthy
```

### Reminders System (9 Evaluators)

**What it does:** Daily 07:00 cron job that raises 9 types of reminders

**Key files:**
- `Server/services/reminderEngine.js` - The 9 evaluators
- `Server/models/Reminder.js` - Polymorphic schema
- `workspace/src/components/layouts/ReminderBell.jsx` - UI display

**The 9 evaluators check for:**
1. Campaigns - warn before launch, escalate after end
2. Events - upcoming/overdue
3. Milestones - upcoming/overdue
4. Documents - stale (30+ days)
5. Clients - gone quiet (past cadence)
6. Interactions - unwritten reports (3+ days)
7. Proposals - no update (14+ days)
8. Tenders - no metrics (ended 3+ days)
9. Certifications - expiring/expired/lapsed

**Why it's interesting:**
- Unique index on (sourceType, sourceId, reminderDate) prevents duplicates
- Polymorphic: one collection for all reminder types
- Runs nightly, so users see same reminders daily until actioned

### Archive-Before-Delete Pattern

**Used by:** Clients, Tenders, Proposals, Trainings, Tasks, Tools, Partners, Documents, etc.

**How it works:**
```javascript
// User clicks delete
// Server returns: "Archive this item before deleting"

// User clicks archive
// Item archived (archived: true, archivedAt: now)
// Removed from normal list (default query filters archived: false)

// User can toggle archive to restore

// Once archived, user can permanently delete
// DELETE only works if archived === true
```

**Why:** Preserves audit trail, enables undo, safe against accidental deletion

---

## 🧪 Testing Your Changes

### Run Regression Tests

```bash
# From workspace directory:
cd scratchpad

# Run all API tests (11 suites, 436 checks)
python reset_db.py && python api_tenders.py
python reset_db.py && python api_clients.py
python reset_db.py && python api_trainings.py
# ... etc

# Run browser tests (11 suites, 209 checks)
python reset_db.py && python smoke_tenders.py
python reset_db.py && python smoke_clients.py
# ... etc

# Check for console errors
python reset_db.py && python audit_render.py

# Check for enum drift
python check_drift.py
```

### Add a Test

**Example:** Testing new field in Client model

1. Find relevant test suite (e.g., `scratchpad/api_clients.py`)
2. Add check in the validation section:
   ```python
   def check(label, ok, detail=""):
       results.append(ok)
       print(("PASS  " if ok else "FAIL  ") + label)
   
   # Add your check:
   check("New field saved", client['newField'] == 'expected_value')
   ```

3. Run: `python api_clients.py`
4. See output: `PASS  New field saved` or `FAIL  New field saved`

---

## 🔧 Common Workflows

### Add a New Feature Field to Existing Model

```
1. Update MongoDB schema (Server/models/Model.js)
   - Add field: fieldName: { type: String, default: '' }

2. Update form (workspace/src/modules/*/FormModal.jsx)
   - Add input: <input onChange={...} />

3. No API changes needed (routes accept all model fields)

4. Test with regression suite
```

### Create a New Data Model

```
1. Create Server/models/NewModel.js
   - Define Mongoose schema
   - Add virtuals if needed
   - Add indexes

2. Create Server/services/newService.js
   - getNewModels(filters)
   - createNewModel(data)
   - updateNewModel(id, data)
   - deleteNewModel(id)

3. Create Server/routes/newRoutes.js
   - GET / → newService.getNewModels()
   - POST / → newService.createNewModel()
   - PUT /:id → newService.updateNewModel()
   - DELETE /:id → newService.deleteNewModel()

4. Mount in Server/server.js
   - app.use('/api/new-models', require('./routes/newRoutes'))

5. Add to workspace/src/context/services/api.js
   - getNewModels()
   - addNewModel()
   - updateNewModel()
   - deleteNewModel()

6. Create module in workspace/src/modules/new-feature/
   - NewFeatureModule.jsx
   - NewFeatureFormModal.jsx
   - etc.

7. Add to ModuleRouter.jsx
   - case 'new-feature': return <NewFeatureModule />

8. Test with new regression suite
```

### Modify How Health Status is Calculated

**File:** `Server/models/Client.js` (lines 169-250)

```javascript
// Edit the attentionReasons virtual
clientSchema.virtual('attentionReasons').get(function() {
  const reasons = [];
  
  // Add/modify conditions:
  if (condition) {
    reasons.push({
      code: 'unique-code',
      label: 'Display label',
      severity: 'Critical|At Risk|Watch',
      detail: 'Explanation'
    });
  }
  
  return reasons;
});
```

Then test with: `python api_clients.py` (checks health scoring)

### Add a New Tab to Existing Module

**Example:** Add tab to TrainingModule

```javascript
// workspace/src/modules/trainings/TrainingModule.jsx

const TABS = [
  { key: 'active', label: 'Active Pipeline' },
  { key: 'schedules', label: 'Schedules & Calendar' },
  { key: 'certifications', label: 'Certifications Matrix' },
  { key: 'new-tab', label: 'New Tab' },  // Add here
];

// Add tab content component
const renderTab = () => {
  switch (activeTab) {
    // ... existing cases
    case 'new-tab':
      return <NewTabComponent data={data} />;
  }
};

// Create: workspace/src/modules/trainings/components/NewTabComponent.jsx
```

---

## 🐛 Debugging Tips

### API Not Responding

**Check 1: Backend running?**
```bash
curl http://localhost:5001/api/health
# Should return: {"status":"ok","database":"connected", ...}
```

**Check 2: Database connected?**
- Health endpoint reports database state
- Check `MONGODB_URI` in `.env`
- Check MongoDB Atlas whitelist (should allow 0.0.0.0/0 for serverless IPs)

**Check 3: Route mounted?**
- Check `server.js` for mount statement
- Check for bootErrors in `/api/health` response
- Check console for "Failed to mount" messages

### Frontend Not Showing Data

**Check 1: API returning data?**
- Open browser DevTools → Network tab
- Trigger data load
- Inspect response (should be JSON array)

**Check 2: Errors in console?**
- DevTools → Console tab
- Look for red errors
- Check CORS if errors mention "No 'Access-Control-Allow-Origin'"

**Check 3: State updating?**
- Add console.log in useEffect after API call
- Verify data flows to state
- Check component re-renders

### Test Suite Failing

**Always check:**
1. Database cleaned? `python reset_db.py` first
2. Test DB running? `npm start` on port 5002
3. API healthy? `curl http://localhost:5002/api/health`
4. Look for "refuses to run against a non-test database" (safety guard working)

---

## 📚 Learning Paths

### New to React?
1. Read `workspace/src/App.jsx` (3 components, clear flow)
2. Study one module: `workspace/src/modules/pipeline/PipelineModule.jsx`
3. Understand hooks: `useState`, `useEffect`, `useDashboard()`
4. Modify a form: Add a field to `PipelineModule` → test

### New to Express/Node?
1. Read `Server/server.js` (middleware stack, route mounting)
2. Pick a model: `Server/models/Pipeline.js` (simplest)
3. Read corresponding service: `Server/services/bdService.js` (search for pipeline)
4. Read corresponding route: `Server/routes/pipelineRoutes.js` (thin delegates)
5. Add a field: Model → Service → Route → API wrapper → Test

### New to MongoDB?
1. Read `Server/models/Client.js` (most complex, with virtuals)
2. Understand schema fields (required, defaults, enums)
3. Understand virtuals (computed, not stored)
4. Understand embedded schemas (contactSchema, commitmentSchema)
5. Run a query: `python scratchpad/api_clients.py` (see real data flows)

### New to Project Overall?
1. **Day 1:** Read this README + TESTING.md
2. **Day 2:** Explore one module end-to-end
   - Frontend: Pick a tab in a module
   - API: Find corresponding api.js method
   - Backend: Find route and service
   - Database: Find and read the model
3. **Day 3:** Make a small change (add a field, new tab, etc.)
4. **Day 4:** Run regression tests, fix any issues
5. **Day 5:** Pick your first real task

---

## 📋 Checklist: Making Changes Safely

Before committing:

- [ ] Changed code follows existing patterns (no new patterns)
- [ ] New code is in correct directory structure
- [ ] MongoDB schema updated (if data changes)
- [ ] API methods added/updated (if new endpoints)
- [ ] Frontend form updated (if new fields)
- [ ] Regression tests still pass
- [ ] No console errors in browser
- [ ] No "FAIL" messages in test output
- [ ] Commit message clear (what changed, why)

---

## 🤝 Code Style & Conventions

### Naming
- `functionName` - camelCase for functions/variables
- `ClassName` - PascalCase for components/classes
- `TABLE_CONSTANT` - UPPER_CASE for constants
- `snake_case.js` - filenames in kebab/snake case
- `ComponentName.jsx` - React components PascalCase

### Database Models
- Singular model names: `Client`, `Proposal`, `Task` (not Clients)
- Embedded schemas lowercase: `contactSchema`
- Virtuals for computed data (not stored fields)
- Archive pattern: `archived: Boolean`, `archivedAt: Date`

### React Components
- One component per file (with rare exceptions)
- Functional components with hooks (no class components)
- Extract modals to separate *Modal.jsx files
- Props passed explicitly (no prop spreading)
- Comments for complex logic only

### Error Messages
- Clear and actionable: "Client needs a name" not "validation failed"
- Include context when helpful: "Must archive before deleting"
- Server returns: `{ message: "User-friendly error message" }`

---

## 📞 Who Does What

| Task | Where | Who |
|------|-------|-----|
| Add UI field | `workspace/src/modules/*/FormModal.jsx` | Frontend dev |
| Add data field | `Server/models/Model.js` | Backend dev |
| Modify business logic | `Server/services/service.js` | Backend dev |
| Change API response | `Server/routes/routes.js` | Backend dev |
| Add computed field | `Server/models/Model.js` (virtual) | Backend dev |
| Add health check | `Server/models/Client.js` (virtual) | Backend dev |
| Add reminder type | `Server/services/reminderEngine.js` | Backend dev |
| Add tab/view | `workspace/src/modules/*/` | Frontend dev |
| Add module | See "Create New Feature" above | Both devs |
| Write tests | `scratchpad/*.py` | QA/Any dev |

---

## 🆘 Getting Help

### Understanding a File
1. Read the comments (start there)
2. Check file size in editor status bar (longer = more complex)
3. Look for imports (what does it depend on?)
4. Find tests that exercise it (shows how it's used)
5. Search codebase for examples (how it's called elsewhere)

### Stuck on a Task?
1. Search for similar existing code (patterns already exist)
2. Check tests (show how to use the feature)
3. Read the audit report for architectural patterns
4. Look at git history (git log -p -- filename)
5. Ask another developer who understands that area

### Performance Issue?
1. Open DevTools → Performance tab → record interaction → stop
2. Look for long tasks (yellow/red bars)
3. Check Network tab for slow requests
4. Check if code computes virtuals on large datasets
5. Check for missing indexes in MongoDB

---

## 🎯 Next Steps

1. **Clone the repo** and set up local environment
2. **Read TESTING.md** to understand test infrastructure
3. **Pick a simple task** (fix a bug, add a field)
4. **Make the change** following patterns in this guide
5. **Run regression tests** to ensure nothing broke
6. **Create a pull request** with clear description

Good luck! Welcome to the team. 🚀
