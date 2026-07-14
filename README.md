# TalentLens

TalentLens is an explainable creator-performance and brand-investment intelligence platform.

## Current functionality

- Next.js frontend
- FastAPI backend
- Frontend-to-backend health connection
- CORS configuration
- Environment-based API configuration

## Technology stack

### Frontend

- Next.js
- TypeScript
- Tailwind CSS

### Backend

- Python
- FastAPI

## Running locally

### Backend

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
fastapi dev app/main.py