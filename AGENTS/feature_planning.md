# Feature Planning Guidelines

## Core Principles

### 1. **Think in User Value, Not Technical Tasks**
- Start with: "What can the user do that they couldn't before?"
- End with: "How do we prove this works end-to-end fastest?"

### 2. **The 1-Day Rule**
- Every slice must be completable in <1 day
- If it takes longer, slice smaller
- "Done" means deployed and working in production

### 3. **Vertical Slicing Over Horizontal**
- ✅ "User can see if they have events today" (end-to-end value)
- ❌ "Build calendar API" (no user value until UI exists)

## The Planning Process

### Step 1: Define the User Story
```
As a [user type]
I want to [capability]
So that [benefit]
```

**Example:**
```
As a busy professional
I want to see my calendar events during AI calls
So that I can reference my schedule during conversations
```

### Step 2: Break Into Deployable Slices

**Ask these questions:**
1. What's the simplest version that proves this works?
2. Can I fake parts to get end-to-end working?
3. What's the riskiest assumption to validate first?

**Example Slicing:**
```
Slice 1: "Connect to Google Calendar, log raw event data"
→ Value: Understand real API responses, auth flow works
→ Code: Integration function that logs actual Google data

Slice 2: "Extract event count from real data"
→ Value: AI can say accurate number of events
→ Code: Transform API response to simple count

Slice 3: "AI mentions event count during calls"
→ Value: User hears their actual schedule referenced
→ Code: Pass count to AI agent context
```

### Step 3: Validate Each Slice

**Before building, ask:**
- [ ] Can I deploy this slice independently?
- [ ] Does it provide ANY user value?
- [ ] Can I test it safely in production?
- [ ] Will it take less than 1 day to build?

If any answer is "No" → slice smaller.

## Common Slicing Patterns


### Pattern 2: **Happy Path → Edge Cases**
```
Slice 1: Everything works perfectly
Slice 2: Handle "no data" scenario
Slice 3: Handle "API error" scenario
```

### Pattern 3: **Core → Enhancement**
```
Slice 1: Basic functionality
Slice 2: Better UX/UI
Slice 3: Performance optimization
```

### Pattern 4: **Read → Write Operations**
```
Slice 1: User can VIEW data
Slice 2: User can CREATE data
Slice 3: User can EDIT data
Slice 4: User can DELETE data
```

## Feature Sizing Guidelines

### 🟢 Right Size (Good for 1-day slices)
- "User can see calendar event count"
- "AI mentions user's next meeting"
- "User can start a basic call"
- "System logs call attempts"

### 🟡 Too Big (Need to slice smaller)
- "Complete calendar integration"
- "Full calling system with AI"
- "User dashboard with analytics"
- "Advanced call routing"

## Anti-Patterns to Avoid

### ❌ Horizontal Slicing
```
Week 1: Build database schema
Week 2: Build API endpoints
Week 3: Build UI components
Week 4: Connect everything
```
**Problem:** Nothing works until week 4

### ❌ "Foundation First"
```
"We need to build the user management system first"
"Let's design the perfect database schema"
"We should set up monitoring before features"
```
**Problem:** Delays user value, often over-engineered

### ❌ Perfectionist Planning
```
"Let's plan every edge case"
"We need detailed wireframes for everything"
"What if users want to do X, Y, and Z?"
```
**Problem:** Analysis paralysis, delayed learning

## Decision Framework

### When Planning a Feature, Ask:

**1. Validate the Need**
- Is this solving a real user problem?
- How will we know if it's working?
- What's the smallest version that proves value?

**2. Find the Fastest Learning Path**
- What's the riskiest assumption?
- Can we fake anything to test faster?
- What would make us confident this is worth building?

**3. Plan for Momentum**
- Can each slice build excitement?
- Will early slices teach us about later ones?
- Are we optimizing for learning or perfection?

## Example: Planning "Calendar-Aware AI Calls"

### ❌ Traditional Planning
```
1. Research Google Calendar API (3 days)
2. Design database schema (2 days)
3. Build calendar sync system (1 week)
4. Build AI prompt system (1 week)
5. Build call integration (1 week)
6. Test everything together (3 days)
Total: 3-4 weeks before any user value
```

### ✅ Slice-Based Planning
```
Day 1: AI says "I see you have events today" (hardcoded)
→ Validates: conversation flow, user reaction

Day 2: AI says actual event count from Google API
→ Validates: Google integration, auth flow

Day 3: AI mentions specific event names
→ Validates: data parsing, privacy concerns

Day 4: AI can answer questions about events
→ Validates: full feature value

Total: 4 days to full working feature
```

## Templates for Common Features

### Template: **Data Integration Feature**
```
Slice 1: Show hardcoded sample data in UI
Slice 2: Connect to real API, show raw data
Slice 3: Format data properly
Slice 4: Handle errors gracefully
```

### Template: **User Action Feature**
```
Slice 1: User can trigger action (logs only)
Slice 2: Action has real effect
Slice 3: User gets feedback on success/failure
Slice 4: Handle edge cases
```

### Template: **AI/Smart Feature**
```
Slice 1: Connect to real data sources, understand constraints
Slice 2: Simple rule-based logic with real data
Slice 3: AI/ML integration using real data patterns
Slice 4: Learning and improvement based on real usage
```

## Success Metrics

**Good feature planning leads to:**
- ✅ Daily deployments with user value
- ✅ Fast learning about what users actually want
- ✅ Easy pivoting when assumptions are wrong
- ✅ Team momentum from frequent wins

**Warning signs:**
- ❌ Weeks without deployable progress
- ❌ "Almost done" syndrome
- ❌ Integration hell at the end
- ❌ Features that work technically but users don't use

## Remember: Perfect is the Enemy of Done
- Ship the simplest version that provides value
- Learn from real usage, not planning sessions
- Users will tell you what to build next
- Momentum matters more than perfect architecture



# guidelines

1. Understand the problem before picking tools

Is this a known time or unknown condition?
One-time event or recurring pattern?

2. Use what already works

How does this codebase solve similar problems?
Extend existing patterns instead of inventing new ones

3. Match complexity to the problem

Simple problems need simple solutions
Don't over-engineer

4. Choose the direct path

Calculate exact answers instead of polling/checking
Fewer steps = fewer bugs

5. State your assumptions out loud

"I'm treating this as [X] because [Y]"
Then check if that's actually true