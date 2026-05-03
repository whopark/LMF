# Task Completion Checklist

## When a task is completed:

### GUI Backend
1. Run tests: `npm test` (if tests exist)
2. Check for lint errors
3. Verify server starts: `npm start`
4. Test API endpoints manually

### GUI Frontend
1. Run build: `npm run build`
2. Check for TypeScript/ESLint errors
3. Verify dev server: `npm run dev`
4. Test UI functionality in browser

### Autopus-ADK (Go)
1. Format code: `go fmt ./...`
2. Run vet: `go vet ./...`
3. Run tests: `go test ./...`
4. Build: `go build ./...`
5. Run lint: `make lint`

### Medical Imaging Tasks
1. Verify DICOM metadata updates
2. Check arrow indicators on images
3. Validate fracture detection (all ribs L1-L10, R1-R10)
4. Ensure proper error handling for image processing

### Git Commit
1. Stage relevant files: `git add <files>`
2. Write descriptive commit message
3. Include Co-Author for AI assistance
4. Push if requested
