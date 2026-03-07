---
name: travel-planner
description: "Plan trips with real data — flights, hotels, activities, restaurants, budgets, and day-by-day itineraries. Use when: user asks to plan a trip, find travel options, create an itinerary, or get travel recommendations. NOT for: booking (can't execute transactions), visa/immigration advice."
metadata: { "openclaw": { "emoji": "🛫", "source": "awesome-llm-apps", "category": "productivity" } }
---

# Travel Planner Skill

Create comprehensive travel itineraries with real data.

## When to Use
- "Plan a trip to [destination]"
- "Create an itinerary for [X days] in [city]"
- "What should I do in [place]?"
- "Plan a weekend getaway near [location]"

## Workflow

### Phase 1: Requirements
Gather or infer:
- Destination(s)
- Dates / duration
- Budget level (budget / mid-range / luxury)
- Interests (culture, food, adventure, relaxation)
- Travel party (solo, couple, family, group)
- Any constraints (dietary, mobility, visa)

### Phase 2: Research
Use `web_search` for:
1. Best time to visit, weather for those dates
2. Top attractions and activities (with ratings)
3. Neighborhood guide (where to stay)
4. Local food specialties and top restaurants
5. Transport options (airport to city, between areas)
6. Safety tips and local customs
7. Approximate costs for key items

### Phase 3: Itinerary
```markdown
# [Destination] Trip — [X Days]
_Budget: [level] | Best for: [type of traveler]_

## Pre-Trip
- [ ] Visa requirements
- [ ] Vaccinations
- [ ] Travel insurance
- [ ] Currency / payment tips

## Day 1: [Theme]
**Morning:** [Activity] — [location, ~duration, ~cost]
**Lunch:** [Restaurant] — [cuisine, price range]
**Afternoon:** [Activity]
**Evening:** [Activity/Dinner]
**Transport:** [how to get between spots]

## Day 2: [Theme]
...

## Budget Estimate
| Category | Estimated Cost |
|----------|---------------|
| Accommodation | $X/night × Y nights |
| Food | $X/day × Y days |
| Activities | $X total |
| Transport | $X total |
| **Total** | **$X** |

## Pro Tips
- [Local insight 1]
- [Money-saving tip]
- [Cultural note]
```

## Quality Rules
- Activities should be geographically logical (no zigzagging across the city)
- Include walking times between spots
- Mix popular attractions with local gems
- Always mention if advance booking is needed
- Include at least one free activity per day
