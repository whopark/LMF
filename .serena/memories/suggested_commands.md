# Suggested Commands

## Windows System Commands
```powershell
# Navigation
dir              # List directory (instead of ls)
cd <path>        # Change directory
type <file>      # Read file (instead of cat)
findstr <pat>    # Search text (instead of grep)

# Git
git status
git add .
git commit -m "message"
git push
```

## GUI Backend (gui/backend/)
```powershell
cd gui/backend
npm install         # Install dependencies
npm start           # Start production server
npm run dev         # Start dev server with nodemon
```

## GUI Frontend (gui/frontend/)
```powershell
cd gui/frontend
npm install         # Install dependencies
npm run dev         # Start Vite dev server
npm run build       # Build for production
npm run preview     # Preview production build
```

## Autopus-ADK (autopus-adk/)
```powershell
cd autopus-adk
go build ./...      # Build all packages
go test ./...       # Run tests
go vet ./...        # Run linter
make build          # Build via Makefile
make test           # Test via Makefile
make lint           # Lint via Makefile
```

## Autopus Skills (via AI CLI)
```
/auto setup         # Generate project context
/auto plan "desc"   # Plan a feature
/auto go SPEC-ID    # Implement a spec
/auto review        # Code review
/auto fix "bug"     # Fix a bug
```
