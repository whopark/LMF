# LMF_all Project Overview

## Purpose
A multi-component project focused on:
1. **Laboratory Accreditation Review** - GUI application for managing lab accreditation
2. **Autopus-ADK** - Agent Development Kit for AI coding tools
3. **PDF Document Storage** - Korean lab operation documents (검사실운영)

## User Focus (from CLAUDE.md)
- Medical image AI annotation
- Rib fracture detection in chest X-rays (L1→L10, R1→R10)
- DICOM image processing with arrow indicators and metadata

## Main Components
- `gui/` - Lab Accreditation Review application
  - `backend/` - Express.js API server
  - `frontend/` - React 19 + Vite web UI
- `autopus-adk/` - Go-based AI agent harness
- `pdf/` - Lab operation PDF documents

## Architecture
```
LMF_all/
├── gui/
│   ├── backend/     # Express + MongoDB API
│   └── frontend/    # React 19 + Vite SPA
├── autopus-adk/     # Go Agent Development Kit
└── pdf/             # Lab operation documents
```
