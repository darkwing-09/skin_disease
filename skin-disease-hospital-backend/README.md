---
title: DermAI Hospital API
emoji: 🏥
colorFrom: blue
colorTo: gray
sdk: docker
pinned: false
---

# DermAI Hospital API

Hospital-grade skin disease detection API with patient records, annotated diagnostic image reports, RLHF feedback loop, and automated daily model retraining.

## Local Development

1. Copy `.env.example` to `.env` and configure variables.
2. Build and run docker-compose:
   ```bash
   docker compose up --build
   ```

## Production Deployment (HuggingFace Spaces + Supabase + Upstash)

Refer to the deployment instructions in the guide.
