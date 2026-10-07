# TalentLens frontend prototype

## Implemented
- Expanded company workspace with shareable hash navigation and browser history.
- Company overview, six sample creators, card/table layouts, fee filter, sorting.
- Detailed creator profiles and reproducible weighted sample fit explanations.
- Campaign planner with brief, objective, dates, deliverables and budget validation.
- Campaign details, milestones, status updates and confirmed deletion.
- Sample performance results, CSV export and print-ready executive reports.
- Company preferences reflected in workspace identity and reports.
- Brand overview, creator search, platform/category filters, CSV export.
- Browser-local shortlist and comparison of up to three creators.
- Creator profile dialog with explicit sample score explanation.
- Campaign drafts with budgets, creator assignments, status, deletion.
- Creator overview, sample content performance, audience breakdown.
- Responsive layouts and creator/brand demo switcher.

All profiles and metrics are illustrative. Portraits are representative stock
images. Shortlists and campaigns are saved in this browser, not tied to accounts.
No API calls or social-platform connections are made by this prototype.
Company plans and preferences use tl.company.v1 in localStorage. Earlier shortlist
and draft data is migrated on the first visit. Creator studio remains the earlier
prototype; company upgrades do not implement creator sponsorship or idea tools.

## Backend entities suggested by these screens
- User: identity and account role.
- CreatorProfile: name, category, handle and profile image.
- SocialAccount: creator, platform, platform identifier and connection status.
- MetricSnapshot: account, observation date, followers, engagement and reach.
- ContentItem: account, publication date, media, reach and engagement.
- AudienceSnapshot: account, observation date, locations and age distributions.
- ShortlistEntry: brand owner and creator.
- Campaign: brand owner, title, currency, budget, status and dates.
- CampaignCreator: campaign, creator, deliverables, cost and outcomes.
- ScoreSnapshot: creator, brand context, component scores and confidence.

## Next steps
1. Review the workflows and decide what the first release requires.
2. Add profile onboarding and account-access screens.
3. Implement persistent APIs for these entities and connect the frontend.
4. Replace sample data with authorized platform integrations.
5. Add real scoring, campaign measurement and deployment checks.

## Local preview
From frontend, run `npm install`, then `npm run dev`.
Open http://localhost:3000. No database or backend is required for this preview.
