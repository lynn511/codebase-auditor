![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
# Codebase Auditor

<p align="center">
  <img src="https://github.com/user-attachments/assets/4ec2b9f6-81e0-453c-9fa6-fb437cfdcb53" width="32%">
  <img src="https://github.com/user-attachments/assets/86fa1710-f103-4466-b5cf-c981976f16ac" width="32%">
  <img src="https://github.com/user-attachments/assets/515c21bd-d011-4623-bd77-76ee88961d8f" width="32%">
</p>

AI-powered repository auditor for public GitHub projects.  
Paste a repo URL, get a structured health report with architecture mapping, MLOps issue detection, and an interactive follow-up chat.

## Live Demo

[codebase-auditor.vercel.app](https://codebase-auditor.vercel.app)

## What it does

Most AI repos are messy. This tool helps engineers quickly understand and clean up codebases they didn't write.

- Ingests any public GitHub repository
- Builds a high-level architecture map
- Detects common AI/MLOps issues by severity
- Produces a structured audit report with a health score
- Lets users ask follow-up questions about the findings
- Stores chat session memory across the conversation

## Example Audit Output

<p align="center">
  <img src="https://github.com/user-attachments/assets/c1daf13d-898d-45c1-ac03-fa21b02ea63c" width="48%">
  <img src="https://github.com/user-attachments/assets/1b739ff6-86bc-48c0-b63b-b8fe671dc03d" width="48%">
</p>

## How it works
```mermaid
flowchart LR
    A[GitHub URL] --> B[Tree fetch + file sampling]
    B --> C[AWS Bedrock LLM]
    C --> D[Structured JSON report]
    D --> E[Interactive chat]
```

## Tech Stack

### Frontend
- Next.js 16
- TypeScript
- Tailwind CSS

### Backend
- FastAPI
- Python 3.12
- AWS Bedrock

### Infrastructure
- AWS Lambda
- API Gateway
- S3
- OpenTofu

## Project Structure
```bash
.
├── backend
├── frontend
├── opentofu
├── scripts
└── .env.example
```

## Architecture

Designed for a serverless deployment flow:

- Frontend on Vercel
- Backend on AWS Lambda
- API Gateway as HTTP entrypoint
- S3 for session memory
- OpenTofu for infrastructure management
